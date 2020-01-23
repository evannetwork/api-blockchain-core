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

import {
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
 * template for a new DID document, can be used as a starting point for building own documents
 */
export interface DidDocumentTemplate {
  '@context': string;
  id: string;
  authentication: {
    type: string;
    publicKey: string;
  } | {
    type: string;
    publicKey: string;
  }[];
  publicKey?: {
    id: string;
    type: string;
    publicKeyHex: string;
  }[];
  service?: {
    id: string;
    type: string;
    serviceEndpoint: string;
  }[];
}

/**
 * interface for services in DIDs
 */
export interface DidServiceEntry {
  type: any;
  serviceEndpoint: any;
  '@context'?: any;
  id?: any;
  [id: string]: any;
}

/**
 * options for Did constructor
 */
export interface DidOptions extends LoggerOptions {
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

  private options: DidOptions;

  /**
   * Creates a new `Did` instance.
   *
   * @param      {DidOptions}  options  runtime like options for `Did`
   */
  public constructor(options: DidOptions) {
    super(options as LoggerOptions);
    this.options = options;
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
    if ((environment === 'testcore' && didEnvironment !== 'testcore')
        || (environment === 'core' && didEnvironment !== 'core')) {
      throw new Error(`DIDs environment "${environment} does not match ${didEnvironment}`);
    }

    return identity;
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
    return `did:evan:${await this.getDidInfix()}${identity}`;
  }

  /**
   * Get DID document for given DID.
   *
   * @param      {string}  did     DID to fetch DID document for
   * @return     {Promise<any>}    a DID document that MAY resemble `DidDocumentTemplate` format
   */
  public async getDidDocument(did: string): Promise<any> {
    let result = null;
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
    result = await this.removePublicKeyTypeArray(result);

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
   * @param      {string}  authenticationKey     (optional) authentication key used for contract
   * @return     {Promise<DidDocumentTemplate>}  a DID document template
   */
  public async getDidDocumentTemplate(
    did?: string, controllerDid?: string, authenticationKey?: string,
  ): Promise<DidDocumentTemplate> {
    if (did && controllerDid && authenticationKey) {
      // use given key to create a contract DID document
      return JSON.parse(`{
        "@context": "https://w3id.org/did/v1",
        "id": "${did}",
        "controller": "${controllerDid}",
        "authentication": [
          "${authenticationKey}"
        ]
      }`);
    } if (!(did || controllerDid || authenticationKey)) {
      const identity = this.options.signerIdentity.activeIdentity;
      const [didAddress, publicKey] = await Promise.all([
        this.convertIdentityToDid(identity),
        this.options.signerIdentity.getPublicKey(
          this.options.signerIdentity.underlyingAccount,
        ),
      ]);

      return JSON.parse(`{
        "@context": "https://w3id.org/did/v1",
        "id": "${didAddress}",
        "publicKey": [{
          "id": "${didAddress}#key-1",
          "type": "Secp256k1SignatureVerificationKey2018",
          "publicKeyHex": "${publicKey}"
        }],
        "authentication": [
          "${didAddress}#key-1"
        ]
      }`);
    }
    throw new Error('invalid config for template document');
  }

  /**
   * Get service from DID document.
   *
   * @param      {string}  did     DID name to get service for
   * @return     {Promise<DidServiceEntry[] | DidServiceEntry>}  service
   */
  public async getService(did: string): Promise<DidServiceEntry[] | DidServiceEntry> {
    return (await this.getDidDocument(did)).service;
  }

  /**
   * Store given DID document for given DID.
   *
   * @param      {string}  did       DID to store DID document for
   * @param      {any}     document  DID document to store
   * @param      {VerificationDelegationInfo} txInfo Optional. If given, the transaction
   *    is executed on behalf of the tx signer.
   * @return     {Promise<void>}  resolved when done
   */
  public async setDidDocument(did: string, document: any): Promise<void> {
    const identity = this.padIdentity(did
      ? await this.convertDidToIdentity(did)
      : this.options.signerIdentity.activeIdentity);
    const documentHash = await this.options.dfs.add(
      'did-document', Buffer.from(JSON.stringify(document), 'utf8'),
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
  public async setDidDocumentOffline(did: string, document: any):
  Promise<[VerificationsDelegationInfo, string]> {
    const identity = this.padIdentity(did
      ? await this.convertDidToIdentity(did)
      : this.options.signerIdentity.activeIdentity);
    const documentHash = await this.options.dfs.add(
      'did-document', Buffer.from(JSON.stringify(document), 'utf8'),
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
   * Sets service in DID document.
   *
   * @param      {string}                               did      DID name to set service for
   * @param      {DidServiceEntry[] | DidServiceEntry}  service  service to set
   * @return     {Promise<void>}  resolved when done
   */
  public async setService(
    did: string,
    service: DidServiceEntry[] | DidServiceEntry,
  ): Promise<void> {
    await this.setDidDocument(did, { ...(await this.getDidDocument(did)), service });
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
   * Retrieve a default DID document for identities that do not have a document associated yet.
   * @param did DID to fetch a document for.
   * @returns Resolves to a DID document.
   */
  private async getDefaultDidDocument(did: string): Promise<any> {
    const identity = await this.convertDidToIdentity(did);
    try {
      // Try to get Owner address for identity and return doc for it
      const controllerIdentity = await this.options.verifications
        .getOwnerAddressForIdentity(identity);
      const controllerDid = await this.convertIdentityToDid(controllerIdentity);
      const controllerDidDoc = await this.getDidDocument(controllerDid);
      return await this.getDidDocumentTemplate(did,
        controllerDid,
        controllerDidDoc.authentication[0]);
    } catch (e) {
      if (e.message && e.message.includes('No record found for')) {
        // Is account, return default doc
        return JSON.parse(`{
          "@context": "https://w3id.org/did/v1",
          "id": "${did}",
          "publicKey": [{
            "id": "${did}#key-1",
            "type": "Secp256k1VerificationKey2018",
            "owner": "${did}",
            "ethereumAddress": "${identity}"
          }],
          "authentication": [
            "${did}#key-1"
          ]
        }`);
      }

      throw (e);
    }
  }

  /**
   * Get environment dependent DID infix ('testcore:' || ''). Result is cached.
   *
   * @return     {Promise<string>}  DID infix
   */
  private async getDidInfix(): Promise<string> {
    if (typeof this.cached.didInfix === 'undefined') {
      this.cached.didInfix = (await this.getEnvironment()) === 'testcore' ? 'testcore:' : '';
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
      const didRegistryDomain = this.options.nameResolver.getDomainName(
        this.options.nameResolver.config.domains.didRegistry,
      );
      const didRegistryAddress = await this.options.nameResolver.getAddress(didRegistryDomain);
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

  /**
   * Method to ensure no public key array types are written into a retrieved did document. This is
   * just a legacy method because we still have various faulty DID documents stored that have an
   * array as the publicKey.type property.
   *
   * @param      {any}  result  The cleaned and valid DID document
   */
  private async removePublicKeyTypeArray(result: any): Promise<any> {
    // TODO: Method can be deleted as soon as there is a real DID validation in place
    const cleanedResult = result;
    let keyTypes = [];

    for (const pos in result.publicKey) {
      // Discard ERC725ManagementKey type entry
      if (result.publicKey[pos].type instanceof Array) {
        keyTypes = result.publicKey[pos].type.filter((type) => !type.startsWith('ERC725'));
        [cleanedResult.publicKey[pos].type] = keyTypes;
      }
    }
    return cleanedResult;
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
}
