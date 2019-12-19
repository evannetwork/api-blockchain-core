import {
  Logger, LoggerOptions, Executor, AccountStore, ContractLoader, DfsInterface
} from '@evan.network/dbcp'

import {
  NameResolver,
  Verifications,
  SignerIdentity,
} from '../index';

import {
  DidResolver
} from '../did/did-resolver'

import { VerificationsVerificationEntry } from './verifications';

import didJWT = require('did-jwt');
import { nullBytes32 } from '../common/utils';

export const enum VCProofType {
  EcdsaPublicKeySecp256k1 = 'EcdsaPublicKeySecp256k1',
}

let JWTProofMapping = {};
JWTProofMapping[(VCProofType.EcdsaPublicKeySecp256k1)] =  'ES256K-R';

export interface VCDocument {
  '@context': string[];
  id: string;
  type: string[];
  issuer: VCIssuer;
  validFrom: string;
  validUntil?: string;
  credentialSubject: VCCredentialSubject;
  credentialStatus?: VCCredentialStatus;
  proof?: VCProof;
}

export interface VCDocumentTemplate {
  type?: string[];
  issuer: VCIssuer;
  validFrom: string;
  validUntil?: string;
  credentialSubject: VCCredentialSubject;
  credentialStatus?: VCCredentialStatus;
  proof?: VCProof;
}

export interface VCCredentialStatus {
  id: string;
  type: string;
}

export interface VCCredentialSubject {
  id: string;
  data?: VCCredentialSubjectPayload[];
  description?: string;
  uri?: string;
}

export interface VCCredentialSubjectPayload {
  name: string;
  value: string;
}

export interface VCIssuer {
  id: string;
  name?: string;
}

export interface VCProof {
  type: string;
  created: string;
  proofPurpose: string;
  verificationMethod: string;
  jws: string;
}

export interface VCResolverOptions extends LoggerOptions {
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

export class VCResolver extends Logger {

  public options: VCResolverOptions;

  public didResolver: DidResolver;

  private cache: any = {};

  public constructor(options: VCResolverOptions, didResolver: DidResolver) {
    super(options as LoggerOptions);
    this.options = options;
    this.didResolver = didResolver;
  }

  public async storeNewVC(vcData: VCDocumentTemplate): Promise<VCDocument> {
    const vcId = await this.buyVCId();
    const types = vcData.type ? vcData.type : ['VerifiableCredential']

    const documentToStore: VCDocument = {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      id: 'vc:evan:' + vcId,
      type: types,
      ...vcData
    };

    await this.validateVCDocument(documentToStore);

    // Document is not signed, create own proof
    if (!documentToStore.proof) {
      const issuerIdentity = await this.didResolver.convertDidToIdentity(documentToStore.issuer.id)
      documentToStore.proof = await this.createProofForVc(documentToStore, issuerIdentity);
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

  public async getVC(vcId: string): Promise<VCDocument> {
    const vcDfsHash = await this.options.executor.executeContractCall(
      await this.getRegistryContract(),
      'vcStore',
      vcId,
    );

    if (vcDfsHash === nullBytes32) {
      throw Error(`VC for address ${vcDfsHash} does not exist`);
    }

    return JSON.parse(await this.options.dfs.get(vcDfsHash) as any) as VCDocument;
  }

  private async validateVCDocument(document: VCDocument) {
    // TODO: Implement
    throw new Error('Not implemented');
  }

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

  private async createProofForVc(vc: VCDocument, issuerIdentityId: string, proofType: VCProofType = VCProofType.EcdsaPublicKeySecp256k1): Promise<VCProof> {
    const accountIdentityId = await this.options.verifications.getIdentityForAccount(this.options.activeAccount, true);

    if (accountIdentityId !== issuerIdentityId)
      throw Error('You are not authorized to issue this VC');

    const jwt = await this.createJWTForVC(vc, proofType);

    const verMethod = await this.getPublicKeyURIFromDid(vc.issuer.id);

    const proof: VCProof = {
      type: `${proofType}`,
      created: new Date(Date.now()).toISOString(),
      proofPurpose: 'assertionMethod',
      verificationMethod: verMethod,
      jws: jwt
    }

    return proof;
  }

  private async createJWTForVC(vc: VCDocument, proofType: VCProofType): Promise<string> {
    const signer = didJWT.SimpleSigner(await this.options.accountStore.getPrivateKey(this.options.activeAccount));
    let jwt = '';
    await didJWT.createJWT({vc: vc, exp: vc.validUntil}, {alg: JWTProofMapping[proofType], issuer: vc.issuer.id, signer})
      .then( response => { jwt = response });

    return jwt;
  }

  private async getPublicKeyURIFromDid(issuerDid: string): Promise<string> {
    const signaturePublicKey = await this.options.signerIdentity.getPublicKey(this.options.signerIdentity.underlyingAccount);
    const doc = await this.didResolver.getDidDocument(issuerDid);

    if (!(doc.authentication || doc.publicKey || doc.publicKey.length == 0))
      throw Error(`Document for ${issuerDid} does not provide authentication material. Cannot sign VC.`);

    const key = doc.publicKey.filter(key => {return key.publicKeyHex === signaturePublicKey})[0];

    if (!key)
      throw Error('The signature key for the active account is not associated to its DID document. Cannot sign VC.');

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
