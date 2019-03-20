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
import { Verifications } from '../../verifications/verifications';

const defaultFactoryAddress = 'index.factory.evan';

/**
 * possible entry types for entries in index
 */
export enum EntryType {
  AccountId,
  GenericContract,
  IndexContract,
  ContainerContract,
  FileHash,
  Hash
};

export interface IndexEntries {
  [id: string]: IndexEntry;
}

export interface IndexEntry {
  raw?: any;
  entryType?: EntryType;
  value?: string;
}

export interface VerificationEntry {
  subject: string;
  topic: string;
  descriptionDomain?: string;
  disableSubverifications?: boolean;
  expirationDate?: number;
  verificationValue?: string;
}

export interface DigitalIdentityConfig {
  accountId: string;
  address?: string;
  description?: any;
  factoryAddress?: string;
}

/**
 * options for DigitalIdentity constructor
 */
export interface DigitalIdentityOptions extends LoggerOptions {
  contractLoader: ContractLoader;
  description: Description;
  dfs: DfsInterface;
  executor: Executor;
  dataContract: DataContract;
  nameResolver: NameResolver;
  verifications: Verifications;
  web3: any;
}


/**
 * helper class for managing digital identities
 *
 * @class      DigitalIdentity (name)
 */
export class DigitalIdentity extends Logger {
  protected config: DigitalIdentityConfig;
  protected options: DigitalIdentityOptions;
  public contract: any;

  /**
   * create digital identity contract
   *
   * @param      {any}  description  description (public part, without envelope)
   */
  public static async create(options: DigitalIdentityOptions, config: DigitalIdentityConfig):
      Promise<DigitalIdentity> {
    // check config
    if (!config.description) {
      throw new Error('identity config is missing property description');
    }
    const instanceConfig = JSON.parse(JSON.stringify(config));

    // check description values and upload it
    const envelope: Envelope = { public: instanceConfig.description };
    const validation = options.description.validateDescription(envelope);
    if (validation !== true) {
      throw new Error(`validation of description failed with: ${JSON.stringify(validation)}`);
    }

    // create contract
    let factoryAddress;
    if (instanceConfig.factoryAddress.startsWith('0x')) {
      factoryAddress = instanceConfig.factoryAddress;
    } else {
      factoryAddress = await options.nameResolver.getAddress(
        instanceConfig.factoryAddress || defaultFactoryAddress);
    }
    const factory = options.contractLoader.loadContract(
      'IndexContractFactory', factoryAddress);
    const contractId = await options.executor.executeContractTransaction(
      factory,
      'createContract', {
        from: instanceConfig.accountId,
        autoGas: 1.1,
        event: { target: 'IndexContractFactory', eventName: 'ContractCreated' },
        getEventResult: (event, args) => args.newAddress,
      },
      instanceConfig.accountId,
    );

    // set description to contract
    await options.description.setDescription(contractId, envelope, instanceConfig.accountId);

    // set to ENS if address was passed in config
    if (instanceConfig.address) {
      await options.nameResolver.setAddress(config.address, contractId, config.accountId);
    }
    instanceConfig.address = contractId;

    // create identity for index and write it to description
    await options.verifications.createIdentity(config.accountId, contractId);

    const identity = new DigitalIdentity(options, instanceConfig);
    await identity.ensureContract();
    return identity;
  }

  /**
   * create new DititalIdentity instance
   *
   * @param      {DigitalIdentityOptions}  options  runtime-like object with required modules
   * @param      {DigitalIdentityConfig}   config   digital identity related config
   */
  constructor(options: DigitalIdentityOptions, config: DigitalIdentityConfig) {
    super(options as LoggerOptions);
    this.options = options;
    this.config = config;
  }

  public async addVerifications(verifications: VerificationEntry[]): Promise<void> {
    await this.ensureContract();
    await Throttle.all(verifications.map(verification => async () =>
      this.options.verifications.setVerification(
        this.config.accountId,
        this.contract.options.address,
        verification.topic,
        verification.expirationDate,
        verification.verificationValue,
        verification.descriptionDomain,
        verification.disableSubverifications,
    )));
    const verificationTags = verifications.map(verification => `verification:${verification.topic}`);
    const description = await this.getDescription();
    const oldTags = description.tags || [];
    const toAdd = verificationTags.filter(tag => !oldTags.includes(tag));
    if (toAdd.length) {
      description.tags = oldTags.concat(toAdd);
      await this.setDescription(description);
    }
  }

  /**
   * check if digital identity contract already has been loaded, load from address / ENS if required
   */
  public async ensureContract(): Promise<void> {
    if (this.contract) {
      return;
    }
    let address = this.config.address.startsWith('0x') ?
      this.config.address : await this.options.nameResolver.getAddress(this.config.address);
    this.contract = this.options.contractLoader.loadContract('IndexContract', address)
  }

  /**
   * returns description from identity
   */
  public async getDescription(): Promise<any> {
    await this.ensureContract();
    return (await this.options.description.getDescription(
      this.contract.options.address, this.config.accountId)).public;
  }

  /**
   * get all entries from index contract
   */
  public async getEntries(): Promise<IndexEntries> {
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
        results[queryResult.names[i]] = {
          raw: { value: queryResult.values[i], entryType: queryResult.entryTypes[i] },
        };
      }
      if (itemsRetrieved < queryResult.totalCount) {
        await getResults(singleQueryOffset + resultsPerPage);
      }
    };
    await getResults(0);
    for (let key of Object.keys(results)) {
      this.processEntry(results[key]);
    }
    return results;
  }

  /**
   * get single entry from index contract
   *
   * @param      {string}  name    entry name
   */
  public async getEntry(name: string): Promise<IndexEntry> {
    await this.ensureContract();
    // write value to contract
    const result: IndexEntry = {
      raw: await this.options.executor.executeContractCall(
        this.contract,
        'getEntry',
        name,
      )
    };
    this.processEntry(result);
    return result;
  }

  public async getVerifications(): Promise<any[]> {
    await this.ensureContract();
    const description = await this.getDescription();
    const tags = description.tags || [];
    return Throttle.all(tags
      .filter(tag => tag.startsWith('verification:'))
      .map(tag => tag.substr(13))
      .map(topic => async () => this.options.verifications.getVerifications(
        description.identity,
        topic,
        true,
      ))
    );
  }

  /**
   * create description info, pass `true` to automatically upload it to ipfs
   *
   * @param      {any}  uploadToIpfs  upload description to ipfs
   */
  public async setDescription(description: any) {
    await this.ensureContract();
    await this.options.description.setDescription(
      this.contract.options.address, { public: description }, this.config.accountId);
  }

  /**
   * set multiple entries at index contract
   *
   * @param      {any}  entries  The entries
   */
  public async setEntries(entries: any): Promise<void> {
    await this.ensureContract();
    await Throttle.all(Object.keys(entries).map((name) => async () => this.setEntry(name, entries[name].value, entries[name].entryType)));
  }

  /**
   * set entry in index contract; entries are uniquie, setting the same name a second time will
   * overwrite the first value
   *
   * @param      {string}  name    entry name
   * @param      {string}  value   value to set (address or bytes32 value)
   */
  public async setEntry(name: string, value: string, entryType: EntryType): Promise<void> {
    await this.ensureContract();
    // write value to contract
    await this.options.executor.executeContractTransaction(
      this.contract,
      'setEntry',
      { from: this.config.accountId },
      name,
      value.length === 66 ? value : `0x000000000000000000000000${value.substr(2)}`,
      entryType,
    );
  }

  /**
   * add type and value from raw value to entry
   *
   * @param      {IndexEntry}  entry   The entry
   */
  private processEntry(entry: IndexEntry) {
    entry.entryType = parseInt(entry.raw.entryType, 10);
    if ([
        EntryType.AccountId,
        EntryType.ContainerContract,
        EntryType.GenericContract,
        EntryType.IndexContract,
        ].includes(entry.entryType)) {
      entry.value = this.options.web3.utils.toChecksumAddress(`0x${entry.raw.value.substr(26)}`);
    } else {
      entry.value = entry.raw.value;
    }
  }
}
