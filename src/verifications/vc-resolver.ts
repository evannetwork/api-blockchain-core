import {
  Logger, LoggerOptions, ContractLoader, DfsInterface, Executor, AccountStore, Runtime
} from '@evan.network/dbcp'

import {
  NameResolver,
  SignerIdentity,
  Verifications,
} from '../index';

import {
  DidResolver
} from '../did/did-resolver'
import { accounts } from 'src/test/accounts';


export interface VCDocument {
  '@context': string[];
  id: string;
  type: string[];
  issuer: VCIssuer;
  validFrom: string;
  validUntil: string;
  credentialSubject: CredentialSubject;
  credentialStatus: CredentialStatus | undefined;
  proof: VCProof;
}

export interface CredentialStatus {
  id: string;
  type: string;
}

export interface CredentialSubject {
  id: string;
  credential: string;
  data: CredentialSubjectPayload[] | undefined;
  description: string;
  uri: string;
  enableSubVerifications: boolean;
}

export interface CredentialSubjectPayload {
  name: string;
  value: string;
}

export interface VCIssuer {
  id: string;
  name: string;
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

  public async createVCFromVerification(verification: any): Promise<VCDocument> {
    const subjectDid = await this.didResolver.convertIdentityToDid(verification.subject);
    const issuerDid = await this.didResolver.convertIdentityToDid(verification.issuer);

    const validUntilString: string = verification.expirationDate ?
      new Date(verification.expirationDate + '000').toISOString() :
      null;

    const subject: CredentialSubject = {
      id: subjectDid,
      credential: verification.topic,
      description: undefined, // TODO
      uri: undefined, // TODO
      enableSubVerifications: !verification.disable,
      data: undefined
    }

    const vc: VCDocument = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1'
      ],
      id: this.createVCId(verification),
      type: [ 'VerifiableCredential', 'evanCredential' ],
      issuer: { id: issuerDid, name: '' }, // TODO: Where to get name from?
      validFrom: new Date(parseInt(verification.creationDate + '000')).toISOString(), // milliseconds
      validUntil: validUntilString,
      credentialSubject: subject,
      credentialStatus: undefined,
      proof: null
    };

    vc.proof = await this.createProofForVc(vc, verification.issuer);

    return vc;
  }

  private async createProofForVc(vc: VCDocument, issuerIdentityId: string): Promise<VCProof> {
    // create the signature for the VC
    // TODO: Validate that signer is issuer
    const documentPayloadToSign = JSON.stringify(vc);
    // TODO: Get accountID for identityID
    const accountIdentityId = await this.options.verifications.getIdentityForAccount(this.options.activeAccount, true);

    if (accountIdentityId !== issuerIdentityId) {
      throw Error('You are not authorized to issue this VC');
    }

    const signature = await this.options.executor.web3.eth.accounts.sign(
      this.options.nameResolver.soliditySha3(documentPayloadToSign),
      '0x' + await this.options.accountStore.getPrivateKey(this.options.activeAccount)
    );

    const proof: VCProof = {
      type: 'Placeholder', // TODO: Which type to use?
      created: new Date(Date.now()).toISOString(),
      proofPurpose: 'assertionMethod',
      verificationMethod: '', // TODO: Which method to use?
      jws: signature
    }

    return proof;
  }

  private createVCId(verification: any): string {
    return 'vc:evan:' + verification.subject + '-' + verification.id
  }
}
