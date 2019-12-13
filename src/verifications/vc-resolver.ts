import {
  Logger, LoggerOptions, Executor, AccountStore
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
  proof: VCProof;
}

export interface VCCredentialStatus {
  id: string;
  type: string;
}

export interface VCCredentialSubject {
  id: string;
  credential: string;
  data?: VCCredentialSubjectPayload[];
  description?: string;
  uri?: string;
  enableSubVerifications: boolean;
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
  executor: Executor;
  nameResolver: NameResolver;
  signerIdentity: SignerIdentity;
  verifications: Verifications;
}

export class VCResolver extends Logger {

  public options: VCResolverOptions;

  public didResolver: DidResolver;

  public constructor(options: VCResolverOptions, didResolver: DidResolver) {
    super(options as LoggerOptions);
    this.options = options;
    this.didResolver = didResolver;
  }

  public async createVCFromVerification(verification: VerificationsVerificationEntry): Promise<VCDocument> {
    const subjectDid = await this.didResolver.convertIdentityToDid(verification.details.subjectIdentity);
    const issuerDid = await this.didResolver.convertIdentityToDid(verification.details.issuerIdentity);

    const subject: VCCredentialSubject = {
      id: subjectDid,
      credential: verification.details.topic,
      enableSubVerifications: !verification.raw.disableSubVerifications,
    }

    const vc: VCDocument = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1'
      ],
      id: this.createVCId(verification),
      type: [ 'VerifiableCredential', 'evanCredential' ],
      issuer: { id: issuerDid },
      validFrom: new Date(parseInt(`${verification.details.creationDate}`)).toISOString(), // milliseconds
      credentialSubject: subject,
      proof: null
    };

    if (verification.details.expirationDate)
      vc.validUntil = new Date(`${verification.details.expirationDate}`).toISOString();

    vc.proof = await this.createProofForVc(vc, verification.details.issuerIdentity);

    return vc;
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

  private createVCId(verification: any): string {
    return 'vc:evan:' + verification.subject + '-' + verification.id
  }

  private async createJWTForVC(vc: VCDocument, proofType: VCProofType): Promise<string> {
    const signer = didJWT.SimpleSigner(await this.options.accountStore.getPrivateKey(this.options.activeAccount));
    let jwt = '';
    await didJWT.createJWT({exp: vc.validUntil}, {alg: JWTProofMapping[proofType], issuer: vc.issuer.id, signer})
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

}
