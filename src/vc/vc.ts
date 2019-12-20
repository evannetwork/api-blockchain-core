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

import  * as didJWT from 'did-jwt';

import { nullBytes32 } from '../common/utils';
import {
  AccountStore,
  ContractLoader,
  DfsInterface,
  Did,
  Executor,
  Logger,
  LoggerOptions,
  NameResolver,
  SignerIdentity,
  Verifications,
} from '../index';


/**
 * A valid VC document
 */
export interface VcDocument {
  '@context': string[];
  id: string;
  type: string[];
  issuer: VcIssuer;
  validFrom: string;
  validUntil?: string;
  credentialSubject: VcCredentialSubject;
  credentialStatus?: VcCredentialStatus;
  proof?: VcProof;
}

/**
 * Template for a VC that will be converted into a valid VC by the resolver
 */
export interface VcDocumentTemplate {
  '@context'?: string[];
  type?: string[];
  issuer: VcIssuer;
  validFrom: string;
  validUntil?: string;
  credentialSubject: VcCredentialSubject;
  credentialStatus?: VcCredentialStatus;
  proof?: VcProof;
}

/**
 * A VC's credential status property
 */
export interface VcCredentialStatus {
  id: string;
  type: string;
}

/**
 * Information about a VC's subject
 */
export interface VcCredentialSubject {
  did: string;
  data?: VcCredentialSubjectPayload[];
  description?: string;
  uri?: string;
}

/**
 * (Optional) Payload for a VC credential subject
 */
export interface VcCredentialSubjectPayload {
  name: string;
  value: string;
}

/**
 * Issuer of a VC
 */
export interface VcIssuer {
  did: string;
  name?: string;
}

/**
 * The proof for a VC, containing the JWS and metadata
 */
export interface VcProof {
  type: string;
  created: string;
  proofPurpose: string;
  verificationMethod: string;
  jws: string;
}

/**
 * Holds a list of supported proof types for VC (JWS) proofs
 */
export const enum VcProofType {
  EcdsaPublicKeySecp256k1 = 'EcdsaPublicKeySecp256k1',
}

const JWTProofMapping = {};
JWTProofMapping[(VcProofType.EcdsaPublicKeySecp256k1)] =  'ES256K-R';

/**
 * Options for the VcResolver
 */
export interface VcOptions extends LoggerOptions {
  accountStore: AccountStore;
  activeAccount: string;
  contractLoader: ContractLoader;
  dfs: DfsInterface;
  executor: Executor;
  nameResolver: NameResolver;
  signerIdentity: SignerIdentity;
  verifications: Verifications;
  web3: any;
}

const vcRegEx = /^vc:evan:(?:(testcore|core):)?(0x(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64}))$/;
/**
 * Module for storing VCs in and retrieving VCs from the VC registry
 *
 * @class Vc
 */
export class Vc extends Logger {
  public did: Did;

  public options: VcOptions;

  private cache: any = {};

  /**
   * Creates a new `Vc` instance
   *
   * @param {VcOptions} options options for `Vc`
   * @param {Did} did Instance of `Did` used for resolving DIDs
   */
  public constructor(options: VcOptions, did: Did) {
    super(options as LoggerOptions);
    this.options = options;
    this.did = did;
  }

  /**
   * Returns a VC document for a given ID.
   *
   * @param vcId The registry ID the VC document is associated with.
   *
   * @returns {Promise<VcDocument} A VC document stored in the registry.
   *
   * @throws If an invalid VC ID is given or no document is registered under this ID.
   */
  public async getVc(vcId: string): Promise<VcDocument> {
    // Check whether the full URI (vc:evan:[vcId]) or just the internal ID was given
    let identityAddress = vcId;
    if(!identityAddress.startsWith('0x')) {
      const groups = vcRegEx.exec(vcId);
      if (!groups) {
        throw new Error(`Given VC ID ("${vcId}") is no valid evan VC ID`);
      }
      identityAddress = groups[2];
    }

    const vcDfsHash = await this.options.executor.executeContractCall(
      await this.getRegistryContract(),
      'vcStore',
      identityAddress,
    );

    if (vcDfsHash === nullBytes32) {
      throw Error(`VC for address ${vcDfsHash} does not exist`);
    }

    return JSON.parse(await this.options.dfs.get(vcDfsHash) as any) as VcDocument;
  }

  /**
   * Creates a new VC document from a template, registers an ID in the registry
   * and stores the document under the ID.
   *
   * @param {VcDocumentTemplate} vcData Template for the VC document containing the relevant data.
   *
   * @return {Promise<VcDocument} The final VC document as it is stored in the registry.
   */
  public async storeNewVc(vcData: VcDocumentTemplate): Promise<VcDocument> {
    const vcId = await this.buyVcId();
    const types = vcData.type ? vcData.type : ['VerifiableCredential']

    const w3cMandatoryContext = 'https://www.w3.org/2018/credentials/v1';
    const context = vcData["@context"] ? vcData["@context"] : [w3cMandatoryContext];
    if (!context.includes(w3cMandatoryContext)) {
      context.push(w3cMandatoryContext);
    }

    const documentToStore: VcDocument = {
      '@context': context,
      id: `vc:evan:${vcId}`,
      type: types,
      ...vcData
    };

    // Document is not signed, create own proof
    if (!documentToStore.proof) {
      documentToStore.proof = await this.createProofForVc(documentToStore);
    }

    await this.validateVcDocument(documentToStore);

    const vcDfsAddress = await this.options.dfs.add('vc',
      Buffer.from(JSON.stringify(documentToStore), 'utf-8'));

    await this.options.executor.executeContractTransaction(
      await this.getRegistryContract(),
      'setVc',
      { from: this.options.signerIdentity.activeIdentity },
      vcId,
      vcDfsAddress,
    )

    return documentToStore;
  }

  /**
   * Associates the active identity with a new ID in the registry to store a VC at.
   * @returns {Promise<string>} The reserved ID.
   */
  private async buyVcId(): Promise<string> {
    return await this.options.executor.executeContractTransaction(
      await this.getRegistryContract(),
      'createId', {
        from: this.options.signerIdentity.activeIdentity,
        event: { target: 'VCRegistry', eventName: 'VCIdRegistered', },
        getEventResult: (event, args) => args.vcId,
      },
    );
  }

  /**
   * Create a JWT over a VC document
   *
   * @param vc The VC document
   * @param proofType The type of algorithm used for generating the JWT
   * @returns The JWT
   */
  private async createJWTForVc(vc: VcDocument, proofType: VcProofType): Promise<string> {
    const signer = didJWT.SimpleSigner(await this.options.accountStore.getPrivateKey(this.options.activeAccount));
    let jwt = '';
    await didJWT.createJWT(
      { vc: vc,
        exp: vc.validUntil
      },{
        alg: JWTProofMapping[proofType],
        issuer: vc.issuer.did,
        signer
      }).then( response => { jwt = response });

    return jwt;
  }

  /**
   * Creates a new `VcProof` object for a given VC document, including generating
   * a JWT token over the whole document.
   *
   * @param vc The VC document to create the proof for.
   * @param issuerIdentityId The ID of the VC issuer.
   * @param proofType Specify if you want a proof type different from the default one.
   * @returns {VcProof} A proof object containing a JWT.
   * @throws If the VC issuer identity and the signer identity differ from each other
   */
  private async createProofForVc(vc: VcDocument,
    proofType: VcProofType = VcProofType.EcdsaPublicKeySecp256k1): Promise<VcProof> {

    const issuerIdentity = await this.did.convertDidToIdentity(vc.issuer.did)
    const accountIdentity = await this.options.verifications.getIdentityForAccount(this.options.activeAccount, true);

    if (accountIdentity !== issuerIdentity) {
      throw Error('You are not authorized to issue this VC');
    }

    const jwt = await this.createJWTForVc(vc, proofType);

    const verMethod = await this.getPublicKeyURIFromDid(vc.issuer.did);

    const proof: VcProof = {
      type: `${proofType}`,
      created: new Date(Date.now()).toISOString(),
      proofPurpose: 'assertionMethod',
      verificationMethod: verMethod,
      jws: jwt
    };

    return proof;
  }

  /**
   * Retrieves the ID of the public key of an VC's issuer's DID document that matches the active identity's public key.
   *
   * @param issuerDid DID of the VC issuer.
   * @returns The URI of the key in the DID document.
   * @throws If there is no authentication material given in the DID or no key matching the active identity is found.
   */
  private async getPublicKeyURIFromDid(issuerDid: string): Promise<string> {
    const signaturePublicKey =
      await this.options.signerIdentity.getPublicKey(this.options.signerIdentity.underlyingAccount);
    const doc = await this.did.getDidDocument(issuerDid);

    if (!(doc.authentication || doc.publicKey || doc.publicKey.length == 0)) {
      throw Error(`Document for ${issuerDid} does not provide authentication material. Cannot sign VC.`);
    }

    const key = doc.publicKey.filter(key => {return key.publicKeyHex === signaturePublicKey})[0];

    if (!key) {
      throw Error('The signature key for the active account is not associated to its DID document. Cannot sign VC.');
    }

    return key.id;
  }

  /**
   * Get web3 contract instance for VC registry contract via ENS. Result is cached.
   *
   * @return     {Promise<any>}  VC registry contract
   */
  private async getRegistryContract(): Promise<any> {
    if (!this.cache.vcRegistryContract) {
      const vcRegistryDomain = this.options.nameResolver.getDomainName(
        this.options.nameResolver.config.domains.vcRegistry);
      const vcRegistryAddress = await this.options.nameResolver.getAddress(vcRegistryDomain);

      this.cache.vcRegistryContract = this.options.contractLoader.loadContract(
        'VCRegistry', vcRegistryAddress);
    }

    return this.cache.vcRegistryContract;
  }

  /**
   * Validates the JWS of a VC Document proof
   *
   * @param document The VC Document
   * @returns {Promise<void>} Resolves when done
   */
  private async validateProof(document: VcDocument): Promise<void> {
    // Mock the did-resolver package that did-jwt usually requires
    const didResolver = this.did;
    const resolver = {
      async resolve() {
        const doc = await didResolver.getDidDocument(document.issuer.did);
        // TODO: Workaround until we fix the public key type array structure (bc that is not allowed)
        doc.publicKey[0].type = 'Secp256k1SignatureVerificationKey2018';
        return doc as any;
      }
    };
    await didJWT.verifyJWT(document.proof.jws, {resolver: resolver})
  }

  /**
   * Checks various criteria a VC document has to meet
   *
   * @param document The VC document to check.
   * @returns {Promise<void>} If the checks are succesfull.
   * @throws If any of the criteria is not met.
   */
  private async validateVcDocument(document: VcDocument): Promise<void> {
    // Subject
    if (!document.credentialSubject.did) {
      throw new Error('No Subject ID provided');
    }
    await this.did.validateDid(document.credentialSubject.did);

    // Issuer
    if (!document.issuer.did) {
      throw new Error('No Issuer ID provided');
    }
    await this.did.validateDid(document.issuer.did);

    // Proof
    if (!document.proof || !document.proof.jws || document.proof.jws === '') {
      throw new Error('VC misses proof');
    } else if (!document.proof.type) {
      throw new Error('VC proof misses type');
    }
    await this.validateProof(document);
  }
}
