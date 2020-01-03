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

import {
  nullBytes32,
  getEnvironment
} from '../common/utils';

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
  id: string;
  type?: string[];
  issuer: VcIssuer;
  validFrom: string;
  validUntil?: string;
  credentialSubject: VcCredentialSubject;
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
  id: string;
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
 * The parts an VC ID in evan is made of
 */
export interface VcIdSections {
  environment: string;
  internalId: string;
}

/**
 * Issuer of a VC
 */
export interface VcIssuer {
  id: string;
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
  credentialStatusEndpoint: string;
  dfs: DfsInterface;
  executor: Executor;
  nameResolver: NameResolver;
  signerIdentity: SignerIdentity;
  verifications: Verifications;
  web3: any;
}

const vcRegEx = /^vc:evan:(?:(testcore|core):)?(0x(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64}))$/;

const w3cMandatoryContext = 'https://www.w3.org/2018/credentials/v1';

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
   * @param      {VcOptions}  options  options for `Vc`
   * @param      {Did}        did      Instance of `Did` used for resolving DIDs
   */
  public constructor(options: VcOptions, did: Did) {
    super(options as LoggerOptions);
    this.options = options;
    this.did = did;
  }

  /**
   * Returns a VC document for a given ID.
   *
   * @param      {string}  vcId    The registry ID the VC document is associated with.
   * @returns     {Promise<VcDocument}  A VC document stored in the registry.
   * @throws           If an invalid VC ID is given or no document is registered under this ID.
   */
  public async getVc(vcId: string): Promise<VcDocument> {
    // Check whether the full URI (vc:evan:[vcId]) or just the internal ID was given
    let identityAddress = vcId;
    if(!identityAddress.startsWith('0x')) {
      const groups = vcRegEx.exec(vcId);
      if (!groups) {
        throw new Error(`Given VC ID ("${vcId}") is no valid evan VC ID`);
      }
      const [ , vcEnvironment = 'core', address ] = groups;
      identityAddress = address;
      const environment = await this.getEnvironment();
      if (environment === 'testcore' && vcEnvironment !== 'testcore' ||
          environment === 'core' && vcEnvironment !== 'core') {
        throw new Error(`Given VC ID environment "${vcEnvironment}" does not match current "${environment}"`);
      }
    }

    const vcDfsHash = await this.options.executor.executeContractCall(
      await this.getRegistryContract(),
      'vcStore',
      identityAddress,
    );

    if (vcDfsHash === nullBytes32) {
      throw Error(`VC for address ${vcId} does not exist`);
    }
    const document = JSON.parse(await this.options.dfs.get(vcDfsHash) as any) as VcDocument;
    await this.validateProof(document);
    return document;
  }

  /**
   * Creates a new VC document from a template.
   *
   * @param      {VcDocumentTemplate}  vcData  Template for the VC document containing the relevant
   *                                           data.
   * @returns     {Promise<VcDocument}  The final VC document as it is stored in the registry.
   */
  public async createVc(vcData: VcDocumentTemplate): Promise<VcDocument> {
    const types = vcData.type ? vcData.type : ['VerifiableCredential']

    const context = vcData["@context"] ? vcData["@context"] : [w3cMandatoryContext];
    if (!context.includes(w3cMandatoryContext)) {
      context.push(w3cMandatoryContext);
    }

    const vcDocument: VcDocument = {
      '@context': context,
      type: types,
      ...vcData
    };

    vcDocument.proof = await this.createProofForVc(vcDocument);

    await this.validateVcDocument(vcDocument);

    return vcDocument;
  }

  /**
   * Stores the given VC document in the registry under the provided ID.
   * The ID has to be a valid and registered VC ID.
   * Creates a proof if none is given or validates it if one is given.
   *
   * @param      {VcDocumentTemplate}  vcData  Template for the VC document containing the relevant
   *                                           data.
   * @returns     {Promise<VcDocument}  The final VC document as it is stored in the registry.
   */
  public async storeVc(vcData: VcDocumentTemplate, shouldRegisterNewId = false): Promise<VcDocument> {
    const documentToStore = await this.createVc(vcData);

    let internalId;
    if (shouldRegisterNewId) {
      documentToStore.id = await this.createId();
      internalId = (await this.validateVcIdAndGetSections(documentToStore.id)).internalId;
    } else {
      // We prefix the ID specified in the document with the evan identifier (vc:evan:[core|testcore]:)
      // However, we only need the actual ID to address the registry
      const sections = await this.validateVcIdAndGetSections(vcData.id);
      internalId = sections.internalId;
      // Is the given VC ID valid and the active identity the owner of the VC ID?
      await this.validateVcIdOwnership(internalId);
    }

    documentToStore.credentialStatus = {
      id: `${this.options.credentialStatusEndpoint}${documentToStore.id}`,
      type: '' // TODO: Add to evan context
    }


    const vcDfsAddress = await this.options.dfs.add('vc',
      Buffer.from(JSON.stringify(documentToStore), 'utf-8'));
    await this.options.executor.executeContractTransaction(
      await this.getRegistryContract(),
      'setVc',
      { from: this.options.signerIdentity.activeIdentity },
      internalId,
      vcDfsAddress,
    );

    return documentToStore;
  }

  /**
   * Validates whether a given ID is a valid evan VC ID and returns
   * its sections (environment and internal ID)
   *
   * @param vcId VC ID
   * @returns {VcIdSections} Sections of the ID
   */
  private async validateVcIdAndGetSections(vcId: string): Promise<VcIdSections> {
    const groups = vcRegEx.exec(vcId);
    if (!groups) {
      throw new Error(`Given VC ID ("${vcId}") is no valid evan VC ID`);
    }
    const [ , vcEnvironment = 'core', internalId ] = groups;
    const environment = await this.getEnvironment();
    if (environment === 'testcore' && vcEnvironment !== 'testcore' ||
        environment === 'core' && vcEnvironment !== 'core') {
      throw new Error(`VCs environment "${environment} does not match ${vcEnvironment}`);
    }

    return {environment: vcEnvironment, internalId: internalId};
  }

  /**
   * Associates the active identity with a new ID in the registry to store a VC at.
   *
   * @returns     {Promise<string>}  The reserved ID.
   */
  public async createId(): Promise<string> {
    const id = await this.options.executor.executeContractTransaction(
      await this.getRegistryContract(),
      'createId', {
        from: this.options.signerIdentity.activeIdentity,
        event: { target: 'VcRegistry', eventName: 'VcIdRegistered', },
        getEventResult: (event, args) => args.vcId,
      },
    );

    return await this.convertInternalVcIdToUri(id);
  }

  /**
   * Create a JWT over a VC document
   *
   * @param      {VcDocument}   vc         The VC document
   * @param      {VcProofType}  proofType  The type of algorithm used for generating the JWT
   */
  private async createJWTForVc(vc: VcDocument, proofType: VcProofType): Promise<string> {
    const signer = didJWT.SimpleSigner(await this.options.accountStore.getPrivateKey(this.options.activeAccount));
    let jwt = '';
    await didJWT.createJWT(
      { vc: vc,
        exp: vc.validUntil
      },{
        alg: JWTProofMapping[proofType],
        issuer: vc.issuer.id,
        signer
      }).then( response => { jwt = response });

    return jwt;
  }

  /**
   * Creates a new `VcProof` object for a given VC document, including generating a JWT token over
   * the whole document.
   *
   * @param      {VcDocument}   vc         The VC document to create the proof for.
   * @param      {VcProofType}  proofType  Specify if you want a proof type different from the
   *                                       default one.
   * @returns     {VcProof}  A proof object containing a JWT.
   * @throws           If the VC issuer identity and the signer identity differ from each other
   */
  private async createProofForVc(vc: VcDocument,
    proofType: VcProofType = VcProofType.EcdsaPublicKeySecp256k1): Promise<VcProof> {
    let issuerIdentity;
    try {
      issuerIdentity = await this.did.convertDidToIdentity(vc.issuer.id);
    } catch(e) {
      throw Error(`Invalid issuer DID: ${vc.issuer.id}`);
    }
    const accountIdentity = await this.options.verifications.getIdentityForAccount(this.options.activeAccount, true);

    if (accountIdentity !== issuerIdentity) {
      throw Error('You are not authorized to issue this VC');
    }

    const jwt = await this.createJWTForVc(vc, proofType);

    const verMethod = await this.getPublicKeyUriFromDid(vc.issuer.id);

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
   * Get current environment ('testcore:' || 'core'). Result is cached.
   *
   * @returns     {Promise<string>}  current environment
   */
  private async getEnvironment(): Promise<string> {
    if (!this.cache.environment) {
      this.cache.environment = await getEnvironment(this.options.web3);
    }
    return this.cache.environment;
  }

  /**
   * Retrieves the ID of the public key of an VC's issuer's DID document that matches the active
   * identity's public key.
   *
   * @param      {string}  issuerDid  DID of the VC issuer.
   * @throws           If there is no authentication material given in the DID or no key matching the
   *                   active identity is found.
   */
  private async getPublicKeyUriFromDid(issuerDid: string): Promise<string> {
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
   * @returns     {Promise<any>}  VC registry contract
   */
  private async getRegistryContract(): Promise<any> {
    if (!this.cache.vcRegistryContract) {
      const vcRegistryDomain = this.options.nameResolver.getDomainName(
        this.options.nameResolver.config.domains.vcRegistry);
      const vcRegistryAddress = await this.options.nameResolver.getAddress(vcRegistryDomain);

      this.cache.vcRegistryContract = this.options.contractLoader.loadContract(
        'VcRegistry', vcRegistryAddress);
    }

    return this.cache.vcRegistryContract;
  }

  /**
   * Validates the JWS of a VC Document proof
   *
   * @param      {VcDocument}  document  The VC Document
   * @returns     {Promise<void>}  Resolves when done
   */
  private async validateProof(document: VcDocument): Promise<void> {
    // Mock the did-resolver package that did-jwt usually requires
    const didResolver = this.did;
    const resolver = {
      async resolve() {
        const doc = await didResolver.getDidDocument(document.issuer.id);
        return doc as any;
      }
    };
    await didJWT.verifyJWT(document.proof.jws, {resolver: resolver})
  }

  /**
   * Checks various criteria a VC document has to meet
   *
   * @param      {VcDocument}  document  The VC document to check.
   * @returns     {Promise<void>}  If the checks are succesfull.
   * @throws           If any of the criteria is not met.
   */
  private async validateVcDocument(document: VcDocument): Promise<void> {
    // Subject
    if (!document.credentialSubject.id || document.credentialSubject.id === '') {
      throw new Error('No Subject ID provided');
    }
    await this.did.validateDid(document.credentialSubject.id);

    // Issuer
    if (!document.issuer.id || document.issuer.id === '') {
      throw new Error('No Issuer ID provided');
    }
    await this.did.validateDid(document.issuer.id);

    // Proof
    if (!document.proof || !document.proof.jws || document.proof.jws === '') {
      throw new Error('VC misses proof');
    } else if (!document.proof.type) {
      throw new Error('VC proof misses type');
    }
    await this.validateProof(document);
  }

  /**
   * Converts an interal VC ID (0x...) to a URI (vc:evan:...)
   *
   * @param internalVcId Internal 32bytes ID
   * @returns The VC's URI
   */
  private async convertInternalVcIdToUri(internalVcId: string): Promise<string> {
    const environment = await this.getEnvironment();

    return `vc:evan:${environment}:${internalVcId}`;
  }

  /**
   * Checks if the given VC ID is associated to the active identity at the VC registry
   *
   * @param vcId VC ID registered at the VC registry
   * @returns {Promise<void>} Resolves when successful
   * @throws {Error} If the ID is not valid or the identity is not the ID owner
   */
  private async validateVcIdOwnership(vcId: string): Promise<void> {
    const ownerAddress = await this.options.executor.executeContractCall(
      await this.getRegistryContract(),
      'vcOwner',
      vcId,
    );

    if (this.options.signerIdentity.activeIdentity !== ownerAddress) {
      throw Error(`Active identity is not the owner of the given VC ID ${await this.convertInternalVcIdToUri(vcId)}`);
    }
  }
  /**
   * Revokes a given VC document
   *
   * @param      {string}  vcId    The registry ID the VC document is associated with.
   * @return     {revokeProcessed}  A Boolean value. true = successful
   */
  public async revokeVc(vcId: string): Promise<void> {
    await this.validateVcIdOwnership(vcId);
    const revokeProcessed = await this.options.executor.executeContractTransaction(
      await this.getRegistryContract(),
      'revokeVC',
      { from: this.options.signerIdentity.activeIdentity },
      vcId);

    return revokeProcessed;
  }

  /**
   * get the Revoke status of a given VC document
   *
   * @param      {string}  vcId    The registry ID the VC document is associated with.
   * @return     {revokationStatus}  A boolean value. False = not revoked, True = revoked
   */
  public async getRevokeVcStatus(vcId: string): Promise<void> {

    const revokationStatus = await this.options.executor.executeContractCall(
      await this.getRegistryContract(),
      'vcRevoke',
      vcId);

    return revokationStatus;
  }
}
