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

  You can be released from the requirements of the GNU Affero General Public
  License by purchasing a commercial license.
  Buying such a license is mandatory as soon as you use this software or parts
  of it on other blockchains than evan.network.

  For more information, please contact evan GmbH at this address:
  https://evan.network/license/
*/

import * as Throttle from 'promise-parallel-throttle';

import {
  ContractLoader,
  DfsInterface,
  Envelope,
  Executor,
  Logger,
  LoggerOptions,
} from '@evan.network/dbcp';

import { DataContract } from '../data-contract/data-contract';
import { Description } from '../../shared-description';
import { NameResolver } from '../../name-resolver';
import { Sharing } from '../sharing';

const defaultFactoryAddress = 'index.factory.evan';

/**
 * options for DigitalIdentity constructor
 */
export interface DigitalIdentityOptions extends LoggerOptions {
  accountId: string;
  contractLoader: ContractLoader;
  description: Description;
  dfs: DfsInterface;
  executor: Executor;
  dataContract: DataContract;
  nameResolver: NameResolver;
  address?: string;
  factoryAddress?: string;
}

/**
 * helper class for managing digital identities
 *
 * @class      DigitalIdentity (name)
 */
export class DigitalIdentity extends Logger {
  protected options: DigitalIdentityOptions;
  public contract: any;

  constructor(optionsInput: DigitalIdentityOptions) {
    super(optionsInput as LoggerOptions);
    this.options = optionsInput;

  }

  /**
   * create digital identity contract
   */
  public async create(description: any): Promise<void> {
    // check description values and upload it
    const envelope: Envelope = { public: description };
    const validation = this.options.description.validateDescription(envelope);
    if (validation !== true) {
      throw new Error(`validation of description failed with: ${JSON.stringify(validation)}`);
    }

    // create contract
    let factoryAddress;
    if (this.options.factoryAddress.startsWith('0x')) {
      factoryAddress = this.options.factoryAddress;
    } else {
      factoryAddress = await this.options.nameResolver.getAddress(
        this.options.factoryAddress || defaultFactoryAddress);
    }
    const factory = this.options.contractLoader.loadContract(
      'IndexContractFactory', factoryAddress);
    const contractId = await this.options.executor.executeContractTransaction(
      factory,
      'createContract', {
        from: this.options.accountId,
        autoGas: 1.1,
        event: { target: 'IndexContractFactory', eventName: 'ContractCreated', },
        getEventResult: (event, args) => args.newAddress,
      },
      this.options.accountId,
    );
    this.contract = this.options.contractLoader.loadContract('IndexContract', contractId);

    // set description to contract
    await this.options.description.setDescription(contractId, envelope, this.options.accountId);
  }

  /**
   * create description info, pass `true` to automatically upload it to ipfs
   *
   * @param      {any}  uploadToIpfs  upload description to ipfs
   */
  public async setDescription(uploadToIpfs = false) {
    const description = {
      public: {
        name: 'DBCP sample contract',
        description: 'DBCP sample contract description',
        author: 'dbcp test',
        tags: [
          'example',
          'greeter'
        ],
        version: '0.1.0'
      }
    };
    if (!uploadToIpfs) {
      return description;
    } else {
      return this.options.dfs.add('description', Buffer.from(JSON.stringify(description), 'binary'));
    }
  }

  public async getDescription(uploadToIpfs = false): Promise<any> {
    return this.options.description.getDescription(this.options.address, this.options.accountId);
  }

  public async getEntries(): Promise<any> {
    await this.ensureContract();
    // get all from contract
    let results = {};
    let itemsRetrieved = 0;
    const resultsPerPage = 10;
    const getResults = async (singleQueryOffset) => {
      const queryResult = await this.options.executor.executeContractCall(
        this.contract,
        'getEntries',
        singleQueryOffset,
      );
      itemsRetrieved += resultsPerPage;
      for (let i = 0; i < queryResult.names.length; i++) {
        const resultId = i + singleQueryOffset;
        results[queryResult.names[i]] = { raw: queryResult.values[i] };
      }
      if (itemsRetrieved < queryResult.totalCount) {
        await getResults(singleQueryOffset + resultsPerPage);
      }
    };
    await getResults(0);
    for (let key of Object.keys(results)) {
      const result = results[key];
      const [ , first12B, last20B ] = /0x([0-9a-f]{24})([0-9a-f]{40})/.exec(result.raw);
      if (first12B === '000000000000000000000000') {
        result.type = 'address';
        result.value = `0x${last20B}`;
      } else {
        result.type = 'bytes32';
        result.value = result.raw;
      }
    }
    return results;
  }

  public async setEntry(name: string, value: string): Promise<void> {
    // write value to contract
    await this.options.executor.executeContractTransaction(
      this.contract,
      'setEntry',
      { from: this.options.accountId },
      name,
      value,
    );
  }

  public async getEntry(name: string): Promise<void> {
    // write value to contract
    return this.options.executor.executeContractCall(
      this.contract,
      'getEntry',
      name,
    );
  }

  /**
   * check if digital identity contract already has been loaded, load from address / ENS if required
   */
  private async ensureContract(): Promise<void> {
    if (this.contract) {
      return;
    }
    let address = this.options.address.startsWith('0x') ?
      this.options.address : await this.options.nameResolver.getAddress(this.options.address);
    this.contract = this.options.contractLoader.loadContract('Index', address)
  }
}
