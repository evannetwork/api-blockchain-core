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

import * as Throttle from 'promise-parallel-throttle';
import BigNumber from 'bignumber.js';
import { Mutex } from 'async-mutex';
import { cloneDeep } from 'lodash';
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

export interface DidDocumentTemplate {
  '@context': string;
  id: string;
  publicKey: {
    id: string;
    type: string[];
    publicKeyHex: string;
  }[];
  authentication: {
    type: string;
    publicKey: string;
  } | {
    type: string;
    publicKey: string;
  }[];
  service?: {
    id: string;
    type: string;
    serviceEndpoint: string;
  }[];
}

/**
 * config properties, specific to `DidResolver` instances
 */
export interface DidResolverConfig {

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


export class DidResolver extends Logger {
  private cached: any;
  private config: DidResolverConfig;
  private options: DidResolverOptions;

  public constructor(options: DidResolverOptions, config: DidResolverConfig = {}) {
    super(options as LoggerOptions);
    this.options = options;
    this.config = config;
    this.cached = {};
  }

  public async getDidDocumentTemplate(): Promise<DidDocumentTemplate> {
    const identity = this.options.signerIdentity.activeIdentity;
    const [ didInfix, publicKey ] = await Promise.all([
      this.getDidInfix(),
      this.options.signerIdentity.getPublicKey(
        this.options.signerIdentity.underlyingAccount),
    ]);

    return JSON.parse(`{
      "@context": "https://w3id.org/did/v1",
      "is": "did:evan:${didInfix}${identity}",
      "publicKey": [{
        "id": "did:evan:${didInfix}${identity}#key-1",
        "type": ["Secp256k1SignatureVerificationKey2018", "ERC725ManagementKey"],
        "publicKeyHex": "${publicKey}"
      }],
      "authentication": {
        "type": "Secp256k1SignatureAuthentication2018",
        "publicKey": "did:evan:${didInfix}${identity}#key-1"
      }
    }`);
  }

  public async getDidDocument(identity?: string): Promise<any> {
    let result = null;
    const documentHash = await this.options.executor.executeContractCall(
      await this.getRegistryContract(),
      'didDocuments',
      this.padIdentity(identity || this.options.signerIdentity.activeIdentity),
    );
    if (documentHash !== nullBytes32) {
      result = JSON.parse(await this.options.dfs.get(documentHash) as any);
    }
    return result;
  }

  public async setDidDocument(document: any, identity?: string): Promise<void> {
    const documentHash = await this.options.dfs.add(
      'did-document', Buffer.from(JSON.stringify(document), 'utf8'));
    await this.options.executor.executeContractTransaction(
      await this.getRegistryContract(),
      'setDidDocument',
      { from: this.options.signerIdentity.activeIdentity },
      this.padIdentity(identity || this.options.signerIdentity.activeIdentity),
      documentHash,
    );
  }

  private async getDidInfix(): Promise<string> {
    if (typeof this.cached.didInfix === 'undefined') {
      this.cached.didInfix =
        (await getEnvironment(this.options.web3)) === 'testcore' ? 'testnet:' : '';
    }
    return this.cached.didInfix;
  }

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

  private padIdentity(identity: string): string {
    return identity.length !== 66 ?
      `0x${identity.replace(/^0x/, '').padStart(64, '0')}` :
      identity;
  }
}
