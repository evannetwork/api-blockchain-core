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

import { Container, ContainerConfig, ContainerOptions } from './container';
import { DataContract } from '../data-contract/data-contract';
import { Description } from '../../shared-description';
import { NameResolver } from '../../name-resolver';
import { RightsAndRoles } from '../rights-and-roles';
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
  value?: any;
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
  containerConfig: ContainerConfig;
  description?: any;
  factoryAddress?: string;
}

/**
 * options for DigitalIdentity constructor
 */
export interface DigitalIdentityOptions extends ContainerOptions {
  dfs: DfsInterface;
  verifications: Verifications;
}

// empty address
const nullAddress = '0x0000000000000000000000000000000000000000';

/**
 * helper class for managing digital identities
 *
 * @class      DigitalIdentity (name)
 */
export class DigitalIdentity extends Logger {
  private config: DigitalIdentityConfig;
  private contract: any;
  private options: DigitalIdentityOptions;

  /**
   * check, that given subset of properties is present at config, collections missing properties and
   * throws a single error
   *
   * @param      {ContainerConfig}  config      config for container instance
   * @param      {string}           properties  list of property names, that should be present
   */
  public static checkConfigProperties(config: DigitalIdentityConfig, properties: string[]): void {
    let missing = properties.filter(property => !config.hasOwnProperty(property));
    if (missing.length === 1) {
      throw new Error(`missing property in config: "${missing[0]}"`);
    } else if (missing.length > 1) {
      throw new Error(`missing properties in config: "${missing.join(', ')}"`);
    }
  }

  /**
   * create digital identity contract
   *
   * @param      {DigitalIdentityOptions}  options  identity runtime options
   * @param      {DigitalIdentityConfig}   config   configuration for the new identity instance
   */
  public static async create(options: DigitalIdentityOptions, config: DigitalIdentityConfig):
      Promise<DigitalIdentity> {
    DigitalIdentity.checkConfigProperties(config, ['description']);
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
   * check if a contract is located under the specified address
   *
   * @param      {DigitalIdentityOptions}  options     identity runtime options
   * @param      {string}                  ensAddress  ens address that should be checked
   */
  public static async isValidDigitalIdentity(
    options: DigitalIdentityOptions,
    ensAddress: string,
  ): Promise<{valid: boolean, error: Error}> {
    let error, valid = false;

    // create temporary identity instance, to ensure the contract
    const identityInstance = new DigitalIdentity(options, {
      accountId: nullAddress,
      address: ensAddress,
      containerConfig: { accountId: nullAddress }
    });

    // try to load the contract, this will throw, when the specification is invalid
    try {
      await identityInstance.ensureContract();
    } catch (ex) {
      error = ex;
    }

    return { valid, error };
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

  /**
   * add verifications to this identity; this will also add verifications to contract description
   *
   * @param      {VerificationEntry[]}  verifications  list of verifications to add
   */
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
   * create new `Container` instance and add it as entry to identity
   *
   * @param      {string}                    name              name of the entry
   * @param      {Partial<ContainerConfig>}  containerOptions  properties for container config; will
   *                                                           be merged with config defined in
   *                                                           `config.containerConfig`
   */
  public async createContainer(name: string, containerOptions: Partial<ContainerConfig>):
      Promise<Container> {
    await this.ensureContract();
    const container = await Container.create(
      this.options, { ...this.config.containerConfig, ...containerOptions });
    await this.setEntry(name, container, EntryType.ContainerContract);
    return container;
  }

  /**
   * check if digital identity contract already has been loaded, load from address / ENS if required
   * and throw an error, when no contract exists or the description machtes not the identity
   * specifications
   */
  public async ensureContract(): Promise<void> {
    if (this.contract) {
      return;
    }
    let address = this.config.address.startsWith('0x') ?
      this.config.address : await this.options.nameResolver.getAddress(this.config.address);
    const baseError = `ens address ${ this.config.address } / contract address ${ address }:`;

    // if no address is set, throw an error
    if (!address || address === nullAddress) {
      throw new Error(`${ baseError } contract does not exists`);
    } else {
      try {
        const description = (await this.options.description
          .getDescription(address, nullAddress)).public;

        // if the evan digital identity tag does not exist, throw 
        if (!description || !description.tags || description.tags
          .indexOf('evan-digital-identity') === -1) {
          throw new Error(`${ baseError } match not the specification (missing
            'evan-digital-identity' tag)`);
        }
      } catch (ex) {
        // when the dbcp could not be loaded, throw
        this.options.log(`${ baseError } address ${ address }: Could not load dbcp:
          ${ ex.message }`, 'info');
      }
    }

    this.contract = this.options.contractLoader.loadContract('IndexContract', address);
  }

  /**
   * get contract address of underlying IndexContract
   */
  public async getContractAddress(): Promise<string> {
    await this.ensureContract();
    return this.contract.options.address;
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
    const [ , firstKey, remainder ] = /([^/]+)(?:\/(.+))?/.exec(name);
    const result: IndexEntry = {
      raw: await this.options.executor.executeContractCall(
        this.contract,
        'getEntry',
        firstKey,
      ),
    };
    this.processEntry(result);
    if (remainder && result.entryType === EntryType.IndexContract) {
      return result.value.getEntry(remainder);
    } else {
      return result;
    }
  }

  /**
   * gets verifications from description and fetches list of verifications for each of them
   */
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

    // ensure, that the evan digital identity tag is set
    description.tags = description.tags || [ ];
    if (description.tags.indexOf('evan-digital-identity') === -1) {
      description.tags.push('evan-digital-identity');
    }

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
  public async setEntry(name: string, value: string|Container, entryType: EntryType):
      Promise<void> {
    await this.ensureContract();
    // write value to contract
    let toSet;
    if (value instanceof Container) {
      const contractAddress = await value.getContractAddress();
      toSet = `0x000000000000000000000000${contractAddress.substr(2)}`;
    } else if (value.length === 42) {
      toSet = `0x000000000000000000000000${value.substr(2)}`;
    } else {
      toSet = value;
    }
    await this.options.executor.executeContractTransaction(
      this.contract,
      'setEntry',
      { from: this.config.accountId },
      name,
      toSet,
      entryType,
    );
  }

  /**
   * add type and value from raw value to entry
   *
   * @param      {IndexEntry}  entry   The entry
   */
  private processEntry(entry: IndexEntry) {
    let address;
    entry.entryType = parseInt(entry.raw.entryType, 10);
    switch (entry.entryType) {
        case EntryType.AccountId:
        case EntryType.GenericContract:
          entry.value = this.options.web3.utils.toChecksumAddress(`0x${entry.raw.value.substr(26)}`);
          break;
        case EntryType.ContainerContract:
          address = this.options.web3.utils.toChecksumAddress(`0x${entry.raw.value.substr(26)}`);
          entry.value = new Container(this.options, { ...this.config.containerConfig, address });
          break;
        case EntryType.IndexContract:
          address = this.options.web3.utils.toChecksumAddress(`0x${entry.raw.value.substr(26)}`);
          entry.value = new DigitalIdentity(this.options, { ...this.config, address });
          break;
        default:
          entry.value = entry.raw.value;
    }
  }
}
