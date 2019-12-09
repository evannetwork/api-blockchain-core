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

const didRegEx = /^did:evan:(?:(testcore|core):)?(0x(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64}))$/;

export interface DidResolverDocumentTemplate {
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
    type: string[];
    publicKeyHex: string;
  }[];
  service?: {
    id: string;
    type: string;
    serviceEndpoint: string;
  }[];
}

/**
 * options for DidResolver constructor
 */
export interface DidResolverOptions extends LoggerOptions {
  contractLoader: ContractLoader;
  dfs: DfsInterface;
  executor: Executor;
  nameResolver: NameResolver;
  signerIdentity: SignerIdentity;
  web3: any;
}

/**
 * module for working with did resolver registry
 *
 * @class      DidResolver (name)
 */
export class DidResolver extends Logger {
  private cached: any;
  private options: DidResolverOptions;

  /**
   * Creates a new `DidResolver` instance.
   *
   * @param      {DidResolverOptions}  options  runtime like options for `DidResolver`
   */
  public constructor(options: DidResolverOptions) {
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
    const groups = didRegEx.exec(did);
    if (!groups) {
      throw new Error(`given did ("${did}") is no valid evan DID`);
    }
    const [ , didEnvironment = 'core', identity ] = groups;
    const environment = await this.getEnvironment();
    if (environment === 'testcore' && didEnvironment !== 'testcore' ||
        environment === 'core' && didEnvironment !== 'core') {
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
   *                                 "did:evan:testcore:0x000000000000000000000000000000000000001234"
   */
  public async convertIdentityToDid(identity: string): Promise<string> {
    return `did:evan:${await this.getDidInfix()}${identity}`;
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
   * @return     {Promise<DidResolverDocumentTemplate>}  a DID document template
   */
  public async getDidResolverDocumentTemplate(
    did?: string, controllerDid?: string, authenticationKey?: string
  ): Promise<DidResolverDocumentTemplate> {
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
    } else if (!(did || controllerDid || authenticationKey)) {
      const identity = this.options.signerIdentity.activeIdentity;
      const [ didInfix, publicKey ] = await Promise.all([
        this.getDidInfix(),
        this.options.signerIdentity.getPublicKey(
          this.options.signerIdentity.underlyingAccount),
      ]);

      return JSON.parse(`{
        "@context": "https://w3id.org/did/v1",
        "id": "did:evan:${didInfix}${identity}",
        "publicKey": [{
          "id": "did:evan:${didInfix}${identity}#key-1",
          "type": ["Secp256k1SignatureVerificationKey2018", "ERC725ManagementKey"],
          "publicKeyHex": "${publicKey}"
        }],
        "authentication": [
          "did:evan:${didInfix}${identity}#key-1"
        ]
      }`);
    } else {
      throw new Error('invalid config for template document');
    }
  }

  /**
   * Get DID document for given DID or for currently configured active identity.
   *
   * @param      {string}  did     (optional) DID to fetch DID document for
   * @return     {Promise<any>}    a DID document that MAY resemble `DidResolverDocumentTemplate` format
   */
  public async getDidDocument(did?: string): Promise<any> {
    let result = null;
    const identity = this.padIdentity(did ?
      await this.convertDidToIdentity(did) :
      this.options.signerIdentity.activeIdentity
    );
    const documentHash = await this.options.executor.executeContractCall(
      await this.getRegistryContract(),
      'didDocuments',
      identity,
    );
    if (documentHash !== nullBytes32) {
      result = JSON.parse(await this.options.dfs.get(documentHash) as any);
    }
    return result;
  }

  /**
   * Store given DID document for given DID or for currently configured active identity.
   *
   * @param      {any}     document  DID document to store
   * @param      {string}  did       (optional) DID to store DID document for
   * @return     {Promise<void>}  resolved when done
   */
  public async setDidDocument(document: any, did?: string): Promise<void> {
    const identity = this.padIdentity(did ?
      await this.convertDidToIdentity(did) :
      this.options.signerIdentity.activeIdentity
    );
    const documentHash = await this.options.dfs.add(
      'did-document', Buffer.from(JSON.stringify(document), 'utf8'));
    await this.options.executor.executeContractTransaction(
      await this.getRegistryContract(),
      'setDidDocument',
      { from: this.options.signerIdentity.activeIdentity },
      identity,
      documentHash,
    );
  }

  /**
   * Get environment dependent DID infix ('testcore:' || ''). Result is cached.
   *
   * @return     {Promise<string>}  DID infix
   */
  private async getDidInfix(): Promise<string> {
    if (typeof this.cached.didInfix === 'undefined') {
      this.cached.didInfix =
        (await this.getEnvironment()) === 'testcore' ? 'testcore:' : '';
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
        this.options.nameResolver.config.domains.didRegistry);
      const didRegistryAddress = await this.options.nameResolver.getAddress(didRegistryDomain);
      this.cached.didRegistryContract = this.options.contractLoader.loadContract(
        'DidRegistry', didRegistryAddress);
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
    return identity.length !== 66 ?
      `0x${identity.replace(/^0x/, '').padStart(64, '0')}` :
      identity;
  }
}
