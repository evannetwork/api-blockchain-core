/*
  Copyright (C) 2018-present evan GmbH.

  This program is free software: you can redistribute it and/or modify it
  under the terms of the GNU Affero General Public License, version 3,
  as published by the Free Software Foundation.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
  See the GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program. If not, see http://www.gnu.org/licenses/ or
  write to the Free Software Foundation, Inc., 51 Franklin Street,
  Fifth Floor, Boston, MA, 02110-1301 USA, or download the license from
  the following URL: https://evan.network/license/
*/

import * as didJWT from 'did-jwt';
import * as _ from 'lodash';
import {
  AccountStore,
  ContractLoader,
  DfsInterface,
  Executor,
  Logger,
  LoggerOptions,
} from '@evan.network/dbcp';
import {
  getEnvironment,
  nullBytes32,
} from '../common/utils';
import {
  NameResolver,
  SignerIdentity,
} from '../index';
import { VerificationsDelegationInfo, Verifications } from '../verifications/verifications';


const didRegEx = /^did:evan:(?:(testcore|core):)?(0x(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64}))$/;


/**
 * additional configuration for new `Did` instance
 */
export interface DidConfig {
  /** contract address or ENS name for `DidRegistry` */
  registryAddress?: string;
}

/**
 * DID document structure
 */
export interface DidDocument {
  '@context': string;
  id: string;
  controller?: string;
  authentication: string[];
  publicKey?: ({
    id: string;
    type: string;
    publicKeyHex: string;
  } | {
    id: string;
    type: string;
    controller: string;
    ethereumAddress: string;
  })[];
  updated?: string;
  created?: string;
  proof?: DidProof;
  service?: DidServiceEntry[];
}

/**
 * interface for services in DIDs
 */
export interface DidServiceEntry {
  id: string;
  type: string;
  serviceEndpoint: string;
}

/**
 * interface for proof in DIDs
 */
export interface DidProof {
  type: string;
  created: string;
  proofPurpose: string;
  verificationMethod: string;
  jws: string;
}

/**
 * Holds a list of supported proof types for DID (JWS) proofs
 */
export const enum DidProofType {
  EcdsaPublicKeySecp256k1 = 'EcdsaPublicKeySecp256k1',
}

const JWTProofMapping = {};
JWTProofMapping[(DidProofType.EcdsaPublicKeySecp256k1)] = 'ES256K-R';

/**
 * options for Did constructor
 */
export interface DidOptions extends LoggerOptions {
  accountStore: AccountStore;
  contractLoader: ContractLoader;
  dfs: DfsInterface;
  executor: Executor;
  nameResolver: NameResolver;
  signerIdentity: SignerIdentity;
  verifications: Verifications;
  web3: any;
}

/**
 * module for working with did resolver registry
 *
 * @class      Did (name)
 */
export class Did extends Logger {
  private cached: any;

  private config: DidConfig;

  private options: DidOptions;

  /**
   * Creates a new `Did` instance.
   *
   * @param      {DidOptions}  options  runtime like options for `Did`
   * @param      {DidConfig}   options  (optional) additional config for `Did`
   */
  public constructor(options: DidOptions, config: DidConfig = {}) {
    super(options as LoggerOptions);
    this.options = options;
    this.config = config;
    this.cached = {};
  }

  /**
   * Converts given DID to a evan.network identity.
   *
   * @param      {string}  did      a DID like
   *                                "did:evan:testcore:0x000000000000000000000000000000000000001234"
   * @return     {Promise<string>}  evan.network identity like
   *                                "0x000000000000000000000000000000000000001234"
   */
  public async convertDidToIdentity(did: string): Promise<string> {
    const groups = await this.validateDidAndGetSections(did);
    const [, didEnvironment = 'core', identity] = groups;
    const environment = await this.getEnvironment();
    if ((environment.toLocaleLowerCase() === 'testcore' && didEnvironment.toLocaleLowerCase() !== 'testcore')
        || (environment.toLocaleLowerCase() === 'core' && didEnvironment.toLocaleLowerCase() !== 'core')) {
      throw new Error(`DIDs environment "${environment} does not match ${didEnvironment}`);
    }

    // convert identities, that are addresses to checksum address
    return identity.length === 42
      ? this.options.web3.utils.toChecksumAddress(identity)
      : identity;
  }

  /**
   * Converts given evan.network identity hash to DID.
   *
   * @param      {string}  identity  evan.network identity like
   *                                 "0x000000000000000000000000000000000000001234"
   * @return     {Promise<string>}   DID like
   *                                 did:evan:testcore:0x000000000000000000000000000000000000001234
   */
  public async convertIdentityToDid(identity: string): Promise<string> {
    return `did:evan:${await this.getDidInfix()}${identity.toLowerCase()}`;
  }

  /**
   * Gets the deactivation status of a DID
   *
   * @param did DID to check
   * @returns {boolean} true, if the DID is deactivated
   */
  public async didIsDeactivated(did: string): Promise<boolean> {
    let identity = await this.convertDidToIdentity(did);
    identity = this.padIdentity(identity);

    const isDeactivated = await this.options.executor.executeContractCall(
      await this.getRegistryContract(),
      'deactivatedDids',
      identity,
    );

    return isDeactivated;
  }

  /**
   * Get DID document for given DID.
   *
   * @param      {string}  did     DID to fetch DID document for
   * @return     {Promise<DidDocument>}    a DID document.
   *                               For deactiated DIDs it returns a default DID document containing
   *                               no authentication material.
   */
  public async getDidDocument(did: string): Promise<DidDocument> {
    let result = null;
    if (await this.didIsDeactivated(did)) {
      return this.getDeactivatedDidDocument(did);
    }

    const identity = this.padIdentity(
      did
        ? await this.convertDidToIdentity(did)
        : this.options.signerIdentity.activeIdentity,
    );

    const documentHash = await this.options.executor.executeContractCall(
      await this.getRegistryContract(),
      'didDocuments',
      identity,
    );

    if (documentHash === nullBytes32) {
      return this.getDefaultDidDocument(did);
    }
    result = JSON.parse(await this.options.dfs.get(documentHash) as any);

    if (result.proof) {
      await this.validateProof(result);
    }
    return result;
  }

  /**
   * Gets a DID document for currently configured account/identity pair. Notice, that this document
   * may a complete DID document for currently configured active identity, a part of it or not
   * matching it at all. You can use the result of this function to build a new DID document but
   * should extend it or an existing DID document, if your details derive from default format.
   *
   * All three arguments are optional. When they are used, all of them have to be given and the
   * result then describes a contracts DID document. If all of them are omitted the result describes
   * an accounts DID document.
   *
   * @param      {string}  did                   (optional) contract DID
   * @param      {string}  controllerDid         (optional) controller of contracts identity (DID)
   * @param      {string[]}  authenticationKeys  (optional) array of authentication keys
   * @return     {Promise<DidDocument>}  a DID document template
   */
  public async getDidDocumentTemplate(
    did?: string, controllerDid?: string, authenticationKeys?: string[],
  ): Promise<DidDocument> {
    if (did && controllerDid && authenticationKeys) {
      await this.validateDid(did);
      await this.validateDid(controllerDid);
      // use given key to create a contract DID document
      return {
        '@context': 'https://w3id.org/did/v1',
        id: did,
        controller: controllerDid,
        authentication: authenticationKeys,
      };
    } if (!(did || controllerDid || authenticationKeys)) {
      const identity = this.options.signerIdentity.activeIdentity;
      const didAddress = await this.convertIdentityToDid(identity);

      return {
        '@context': 'https://w3id.org/did/v1',
        id: didAddress,
        publicKey: [{
          id: `${didAddress}#key-1`,
          type: 'Secp256k1VerificationKey2018',
          controller: `${didAddress}`,
          ethereumAddress: `${this.options.signerIdentity.underlyingAccount.toLowerCase()}`,
        }],
        authentication: [
          `${didAddress}#key-1`,
        ],
      };
    }
    throw new Error('invalid config for template document');
  }

  /**
   * Get service from DID document.
   *
   * @param      {string}  did     DID name to get service for
   * @return     {Promise<DidServiceEntry[]>}  services
   */
  public async getService(did: string): Promise<DidServiceEntry[]> {
    return (await this.getDidDocument(did)).service;
  }

  /**
   * Store given DID document for given DID.
   *
   * @param      {string}  did       DID to store DID document for
   * @param      {DidDocument}     document  DID document to store
   * @param      {VerificationDelegationInfo} txInfo Optional. If given, the transaction
   *                                 is executed on behalf of the tx signer.
   * @return     {Promise<void>}  resolved when done
   */
  public async setDidDocument(did: string, document: DidDocument): Promise<void> {
    if (await this.didIsDeactivated(did)) {
      throw Error('Cannot set document for deactivated DID');
    }

    const identity = this.padIdentity(did
      ? await this.convertDidToIdentity(did)
      : this.options.signerIdentity.activeIdentity);

    const finalDoc = await this.setAdditionalProperties(document);
    const documentHash = await this.options.dfs.add(
      'did-document',
      Buffer.from(JSON.stringify(finalDoc), 'utf8'),
    );

    await this.options.executor.executeContractTransaction(
      await this.getRegistryContract(),
      'setDidDocument',
      { from: this.options.signerIdentity.activeIdentity },
      identity,
      documentHash,
    );
  }

  /**
   * Creates a transaction for setting a DID document and returns the signed transaction,
   * as well as the document's associated ipfs hash
   *
   * @param did DID to set document for
   * @param document Document to store
   * @returns Tuple of the signed transaction and the document's ipfs hash
   */
  public async setDidDocumentOffline(did: string, document: DidDocument):
  Promise<[VerificationsDelegationInfo, string]> {
    const identity = this.padIdentity(did
      ? await this.convertDidToIdentity(did)
      : this.options.signerIdentity.activeIdentity);

    const finalDoc = await this.setAdditionalProperties(document);

    const documentHash = await this.options.dfs.add(
      'did-document',
      Buffer.from(JSON.stringify(finalDoc), 'utf8'),
    );

    const txInfo = await this.options.verifications.signTransaction(
      await this.getRegistryContract(),
      'setDidDocument',
      { from: this.options.signerIdentity.underlyingAccount },
      identity,
      documentHash,
    );

    return [txInfo, documentHash];
  }


  /**
   * Sets service in DID document. Overrides the old service property.
   *
   * @param      {string}                               did      DID name to set service for
   * @param      {DidServiceEntry[] | DidServiceEntry}  service  service(s) to set
   * @return     {Promise<void>}  resolved when done
   */
  public async setService(
    did: string,
    service: DidServiceEntry[] | DidServiceEntry,
  ): Promise<void> {
    if (service instanceof Array) {
      await this.setDidDocument(did, { ...(await this.getDidDocument(did)), service });
    } else {
      const serviceToSet: DidServiceEntry[] = [service];
      await this.setDidDocument(did, {
        ...(await this.getDidDocument(did)),
        service: serviceToSet,
      });
    }
  }

  /**
   * Unlinks the current DID document from the DID
   * @param did DID to unlink the DID document from
   */
  public async deactivateDidDocument(did: string): Promise<void> {
    const identity = this.padIdentity(did
      ? await this.convertDidToIdentity(did)
      : this.options.signerIdentity.activeIdentity);
    try {
      await this.options.executor.executeContractTransaction(
        await this.getRegistryContract(),
        'deactivateDid',
        { from: this.options.signerIdentity.activeIdentity },
        identity,
      );
    } catch (e) {
      throw Error('Deactivation failed. Is the DID active and do you have permission to deactivate the DID?');
    }
  }

  /**
   * Validates if a given DID is a valid evan DID.
   *
   * @param did DID to validate.
   * @returns {Promise<void>} If the DID is valid.
   * @throws If the DID is not valid.
   */
  public async validateDid(did: string): Promise<void> {
    await this.validateDidAndGetSections(did);
  }

  /**
   * Create a JWT over a DID document
   *
   * @param      {DidDocument}   DID        The DID document
   * @param      {string}        proofIssuer     The issuer (key owner) of the proof
   * @param      {DidProofType}  proofType  The type of algorithm used for generating the JWT
   */
  private async createJwtForDid(didDocument: DidDocument, proofIssuer: string,
    proofType: DidProofType):
    Promise<string> {
    const signer = didJWT.SimpleSigner(
      await this.options.accountStore.getPrivateKey(this.options.signerIdentity.underlyingAccount),
    );
    const jwt = await didJWT.createJWT(
      {
        didDocument,
      }, {
        alg: JWTProofMapping[proofType],
        issuer: proofIssuer,
        signer,
      },
    );

    return jwt;
  }


  /**
   * Creates a new `DidProof` object for a given DID document, including generating a JWT token over
   * the whole document.
   *
   * @param      {DidDocument}   Did         The DID document to create the proof for.
   * @param      {DidProofType}  proofType  Specify if you want a proof type different from the
   *                                       default one.
   * @returns    {DidProof}                 A proof object containing a JWT.
   * @throws           If the Decentralized identity and the signer identity differ from each other
   */
  private async createProofForDid(didDocument,
    proofType: DidProofType = DidProofType.EcdsaPublicKeySecp256k1): Promise<DidProof> {
    const issuerIdentity = (await this.convertDidToIdentity(didDocument.id)).toLocaleLowerCase();
    const activeIdentity = this.options.signerIdentity.activeIdentity.toLocaleLowerCase();
    const controllerIdentity = didDocument.controller
      ? (await this.convertDidToIdentity(didDocument.controller)).toLocaleLowerCase()
      : '';
    const account = this.options.signerIdentity.underlyingAccount.toLocaleLowerCase();
    const signaturePublicKey = (await this.options.signerIdentity.getPublicKey(
      this.options.signerIdentity.underlyingAccount,
    )).toLocaleLowerCase();

    let keys;
    let proofIssuer;
    if (activeIdentity === issuerIdentity) {
      keys = didDocument.publicKey;
      proofIssuer = didDocument.id;
    } else if (activeIdentity === controllerIdentity) {
      const controllerDidDoc = await this.getDidDocument(didDocument.controller);
      keys = controllerDidDoc.publicKey;
      proofIssuer = didDocument.controller;
    } else {
      throw Error('You are not authorized to issue this Did');
    }

    const key = keys.filter((entry) => {
      // Fallback for old DIDs still using publicKeyHex
      if (entry.ethereumAddress) {
        return entry.ethereumAddress.toLocaleLowerCase() === account;
      }
      if (entry.publicKeyHex) {
        return entry.publicKeyHex.toLocaleLowerCase() === signaturePublicKey;
      }
      return false;
    })[0];
    if (!key) {
      throw Error('The signature key of the active account is not associated to its DID document.');
    }

    const jwt = await this.createJwtForDid(didDocument, proofIssuer, proofType);
    const proof: DidProof = {
      type: `${proofType}`,
      created: new Date(Date.now()).toISOString(),
      proofPurpose: 'assertionMethod',
      verificationMethod: key.id,
      jws: jwt,
    };

    return proof;
  }

  /*
   * Returns the standard DID document for deactivated DIDs
   */
  private async getDeactivatedDidDocument(did: string): Promise<DidDocument> {
    return {
      '@context': 'https://w3id.org/did/v1',
      id: did,
      publicKey: [],
      authentication: [],
      service: [],
    };
  }

  /**
   * Retrieve a default DID document for identities that do not have a document associated yet.
   * @param did DID to fetch a document for.
   * @returns Resolves to a DID document.
   */
  private async getDefaultDidDocument(did: string): Promise<DidDocument> {
    const identity = await this.convertDidToIdentity(did);
    let controllerIdentity;
    try {
      controllerIdentity = await this.options.verifications
        .getOwnerAddressForIdentity(identity);
    } catch (e) {
      throw Error(`Unable to resolve: Invalid DID ${did}`);
    }

    if (identity.length === 42) {
      // Identity is account identity and therefore self-sovereign
      return {
        '@context': 'https://w3id.org/did/v1',
        id: did,
        publicKey: [{
          id: `${did}#key-1`,
          type: 'Secp256k1VerificationKey2018',
          controller: did,
          ethereumAddress: controllerIdentity.toLowerCase(),
        }],
        authentication: [
          `${did}#key-1`,
        ],
      };
    }
    // Identity is contract identity and therefore controlled by another identity
    const controllerDid = await this.convertIdentityToDid(controllerIdentity);
    const controllerDidDoc = await this.getDidDocument(controllerDid);
    const authKeyIds = controllerDidDoc.publicKey.map((key) => key.id);
    return this.getDidDocumentTemplate(did,
      controllerDid,
      authKeyIds);
  }

  /**
   * Get environment dependent DID infix ('testcore:' || ''). Result is cached.
   *
   * @return     {Promise<string>}  DID infix
   */
  private async getDidInfix(): Promise<string> {
    if (typeof this.cached.didInfix === 'undefined') {
      this.cached.didInfix = (await this.getEnvironment()).toLocaleLowerCase()
        === 'testcore' ? 'testcore:' : '';
    }
    return this.cached.didInfix;
  }

  /**
   * Get current environment ('testcore:' || 'core'). Result is cached.
   *
   * @return     {Promise<string>}  current environment
   */
  private async getEnvironment(): Promise<string> {
    if (!this.cached.environment) {
      this.cached.environment = await getEnvironment(this.options.web3);
    }
    return this.cached.environment;
  }

  /**
   * Get web3 contract instance for DID registry contract via ENS. Result is cached.
   *
   * @return     {Promise<any>}  DID registry contract
   */
  private async getRegistryContract(): Promise<any> {
    if (!this.cached.didRegistryContract) {
      const didRegistryAddress = this.config.registryAddress?.startsWith('0x')
        ? this.config.registryAddress
        : await this.options.nameResolver.getAddress(
          this.options.nameResolver.getDomainName(
            this.config.registryAddress || this.options.nameResolver.config.domains.didRegistry,
          ),
        );
      this.cached.didRegistryContract = this.options.contractLoader.loadContract(
        'DidRegistry', didRegistryAddress,
      );
    }
    return this.cached.didRegistryContract;
  }

  /**
   * Pad leading zeroes to 20B identity, required for addressing 32B identity references in
   * registry.
   *
   * @param      {string}  identity  identity contract/hash to pad
   * @return     {string}  padded identity value
   */
  private padIdentity(identity: string): string {
    return identity.length !== 66
      ? `0x${identity.replace(/^0x/, '').padStart(64, '0')}`
      : identity;
  }

  private async setAdditionalProperties(document: DidDocument): Promise<DidDocument> {
    const clone = _.cloneDeep(document);
    const now = (new Date(Date.now())).toISOString();
    // Only set 'created' for new did documents
    if (!document.created) {
      clone.created = now;
    }

    clone.updated = now;
    clone.proof = await this.createProofForDid(clone, DidProofType.EcdsaPublicKeySecp256k1);

    return clone;
  }


  /**
   * Validates if a given DID is a valid evan DID and returns its parts.
   *
   * @param      {string}  did     DID to validate.
   * @return     {Promise<RegExpExecArray>}  The parts of the DID if it is valid.
   * @throws           If the DID is not valid.
   */
  private async validateDidAndGetSections(did: string): Promise<RegExpExecArray> {
    const groups = didRegEx.exec(did);
    if (!groups) {
      throw new Error(`Given did ("${did}") is no valid evan DID`);
    }
    return groups;
  }

  /**
   * Validates the JWS of a DID Document proof
   *
   * @param      {DidDocument}    document  The DID Document
   * @returns    {Promise<void>}           Resolves when done
   */
  private async validateProof(document: DidDocument): Promise<void> {
    // Mock the did-resolver package that did-jwt usually requires
    const getResolver = (didModule) => ({
      async resolve(did) {
        if (did.toLowerCase() === document.id.toLowerCase()) {
          return document; // Avoid JWT cycling through documents forever
        }
        return didModule.getDidDocument(document.controller);
      },
    });

    // fails if invalid signature
    const verifiedSignature = await didJWT.verifyJWT(
      document.proof.jws,
      { resolver: getResolver(this) },
    );

    // fails if signed payload and the DID document differ
    const payload = {
      ...verifiedSignature.payload.didDocument,
    };
    delete payload.proof;
    const prooflessDocument = {
      ...document,
    };
    delete prooflessDocument.proof;

    const proofPayloadHash = await this.options.nameResolver.soliditySha3(JSON.stringify(payload));
    const documentHash = await this.options.nameResolver.soliditySha3(
      JSON.stringify(prooflessDocument),
    );
    if (proofPayloadHash !== documentHash) {
      throw Error('Invalid proof. Signed payload does not match given document.');
    }
  }
}
