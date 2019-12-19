import {
  Logger, LoggerOptions, Executor, AccountStore, ContractLoader, DfsInterface
} from '@evan.network/dbcp'

import  * as didJWT from 'did-jwt';

import {
  NameResolver,
  Verifications,
  SignerIdentity,
} from '../index';

import {
  DidResolver
} from '../did/did-resolver';

import { nullBytes32 } from '../common/utils';

export interface VcResolverDocument {
  '@context': string[];
  id: string;
  type: string[];
  issuer: VcResolverIssuer;
  validFrom: string;
  validUntil?: string;
  credentialSubject: VcResolverCredentialSubject;
  credentialStatus?: VcResolverCredentialStatus;
  proof?: VcResolverProof;
}

export interface VcResolverDocumentTemplate {
  '@context'?: string[];
  type?: string[];
  issuer: VcResolverIssuer;
  validFrom: string;
  validUntil?: string;
  credentialSubject: VcResolverCredentialSubject;
  credentialStatus?: VcResolverCredentialStatus;
  proof?: VcResolverProof;
}

export interface VcResolverCredentialStatus {
  id: string;
  type: string;
}

export interface VcResolverCredentialSubject {
  id: string;
  data?: VcResolverCredentialSubjectPayload[];
  description?: string;
  uri?: string;
}

export interface VcResolverCredentialSubjectPayload {
  name: string;
  value: string;
}

export interface VcResolverIssuer {
  id: string;
  name?: string;
}

export interface VcResolverProof {
  type: string;
  created: string;
  proofPurpose: string;
  verificationMethod: string;
  jws: string;
}

export const enum VcResolverProofType {
  EcdsaPublicKeySecp256k1 = 'EcdsaPublicKeySecp256k1',
}

const JWTProofMapping = {};
JWTProofMapping[(VcResolverProofType.EcdsaPublicKeySecp256k1)] =  'ES256K-R';

export interface VcResolverOptions extends LoggerOptions {
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

/**
 * Module for storing VCs in and retrieving VCs from the VC registry
 *
 * @class VcResolver
 */
export class VcResolver extends Logger {

  public options: VcResolverOptions;

  public didResolver: DidResolver;

  private cache: any = {};

  /**
   * Creates a new `VcResolver` instance
   *
   * @param {VcResolverOptions} options options for `VcResolver`
   * @param {DidResolver} didResolver Instance of `DidResolver` used for resolving DIDs
   */
  public constructor(options: VcResolverOptions, didResolver: DidResolver) {
    super(options as LoggerOptions);
    this.options = options;
    this.didResolver = didResolver;
  }

  /**
   * Creates a new VC document from a template, registers an ID in the registry
   * and stores the document under the ID.
   *
   * @param {VcResolverDocumentTemplate} vcData Template for the VC document containing the relevant data.
   *
   * @return {Promise<VcResolverDocument} The final VC document as it is stored in the registry.
   */
  public async storeNewVC(vcData: VcResolverDocumentTemplate): Promise<VcResolverDocument> {
    const vcId = await this.buyVCId();
    const types = vcData.type ? vcData.type : ['VerifiableCredential']

    const w3cMandatoryContext = 'https://www.w3.org/2018/credentials/v1';
    const context = vcData["@context"] ? vcData["@context"] : [w3cMandatoryContext];
    if (!context.includes(w3cMandatoryContext)) {
      context.push(w3cMandatoryContext);
    }

    const documentToStore: VcResolverDocument = {
      '@context': context,
      id: `vc:evan:${vcId}`,
      type: types,
      ...vcData
    };

    await this.validateVCDocument(documentToStore);

    // Document is not signed, create own proof
    if (!documentToStore.proof) {
      documentToStore.proof = await this.createProofForVc(documentToStore);
    }

    const vcDfsAddress = await this.options.dfs.add('vc',
      Buffer.from(JSON.stringify(documentToStore), 'utf-8'));

    await this.options.executor.executeContractTransaction(
      await this.getRegistryContract(),
      'setVC',
      { from: this.options.signerIdentity.activeIdentity },
      vcId,
      vcDfsAddress,
    )

    return documentToStore;
  }

  /**
   * Returns a VC document for a given ID.
   *
   * @param vcId The registry ID the VC document is associated with.
   *
   * @returns {Promise<VcResolverDocument} A VC document stored in the registry.
   *
   * @throws If an invalid VC ID is given or no document is registered under this ID.
   */
  public async getVC(vcId: string): Promise<VcResolverDocument> {
    const vcDfsHash = await this.options.executor.executeContractCall(
      await this.getRegistryContract(),
      'vcStore',
      vcId,
    );

    if (vcDfsHash === nullBytes32) {
      throw Error(`VC for address ${vcDfsHash} does not exist`);
    }

    return JSON.parse(await this.options.dfs.get(vcDfsHash) as any) as VcResolverDocument;
  }

  /**
   * Checks various criteria a VC document has to meet
   *
   * @param document The VC document to check.
   * @returns {Promise<void>} If the checks are succesfull.
   * @throws If any of the criteria is not met.
   */
  private async validateVCDocument(document: VcResolverDocument): Promise<void> {
    // Subject
    if (!document.credentialSubject.id) {
      throw new Error('No Subject ID provided');
    }
    await this.didResolver.validateDid(document.credentialSubject.id);

    // Issuer
    if (!document.issuer.id) {
      throw new Error('No Issuer ID provided');
    }
    await this.didResolver.validateDid(document.issuer.id);

    // Proof
    if (!document.proof || !document.proof.jws || document.proof.jws === '') {
      throw new Error('VC misses proof');
    } else if (!document.proof.type) {
      throw new Error('VC proof misses type');
    }

    throw new Error('Not implemented');
  }

  /**
   * Associates the active identity with a new ID in the registry to store a VC at.
   * @returns {Promise<string>} The reserved ID.
   */
  private async buyVCId(): Promise<string> {
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
   * Creates a new `VcResolverProof` object for a given VC document, including generating
   * a JWT token over the whole document.
   *
   * @param vc The VC document to create the proof for.
   * @param issuerIdentityId The ID of the VC issuer.
   * @param proofType Specify if you want a proof type different from the default one.
   * @returns {VcResolverProof} A proof object containing a JWT.
   * @throws If the VC issuer identity and the signer identity differ from each other
   */
  private async createProofForVc(vc: VcResolverDocument,
    proofType: VcResolverProofType = VcResolverProofType.EcdsaPublicKeySecp256k1): Promise<VcResolverProof> {

    const issuerIdentity = await this.didResolver.convertDidToIdentity(vc.issuer.id)
    const accountIdentity = await this.options.verifications.getIdentityForAccount(this.options.activeAccount, true);

    if (accountIdentity !== issuerIdentity) {
      throw Error('You are not authorized to issue this VC');
    }

    const jwt = await this.createJWTForVC(vc, proofType);

    const verMethod = await this.getPublicKeyURIFromDid(vc.issuer.id);

    const proof: VcResolverProof = {
      type: `${proofType}`,
      created: new Date(Date.now()).toISOString(),
      proofPurpose: 'assertionMethod',
      verificationMethod: verMethod,
      jws: jwt
    };

    return proof;
  }

  /**
   * Create a JWT over a VC document
   *
   * @param vc The VC document
   * @param proofType The type of algorithm used for generating the JWT
   * @returns The JWT
   */
  private async createJWTForVC(vc: VcResolverDocument, proofType: VcResolverProofType): Promise<string> {
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
   * Retrieves the ID of the public key of an VC's issuer's DID document that matches the active identity's public key.
   *
   * @param issuerDid DID of the VC issuer.
   * @returns The URI of the key in the DID document.
   * @throws If there is no authentication material given in the DID or no key matching the active identity is found.
   */
  private async getPublicKeyURIFromDid(issuerDid: string): Promise<string> {
    const signaturePublicKey =
      await this.options.signerIdentity.getPublicKey(this.options.signerIdentity.underlyingAccount);
    const doc = await this.didResolver.getDidDocument(issuerDid);

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
}
