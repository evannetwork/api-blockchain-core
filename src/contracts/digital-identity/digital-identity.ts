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
import { Mutex } from 'async-mutex';
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
import { Profile } from '../../profile/profile';
import { RightsAndRoles } from '../rights-and-roles';
import { Sharing } from '../sharing';
import { Verifications } from '../../verifications/verifications';


// empty address
const nullAddress = '0x0000000000000000000000000000000000000000';

/**
 * Check, that given subset of properties is present at config, collections missing properties and
 * throws a single error.
 *
 * @param      {ContainerConfig}  config      config for container instance
 * @param      {string}           properties  list of property names, that should be present
 */
function checkConfigProperties(config: DigitalIdentityConfig, properties: string[]): void {
  let missing = properties.filter(property => !config.hasOwnProperty(property));
  if (missing.length === 1) {
    throw new Error(`missing property in config: "${missing[0]}"`);
  } else if (missing.length > 1) {
    throw new Error(`missing properties in config: "${missing.join(', ')}"`);
  }
}


/**
 * possible entry types for entries in index
 */
export enum DigitalIdentityEntryType {
  AccountId,
  ContainerContract,
  FileHash,
  GenericContract,
  Hash,
  IndexContract,
}

/**
 * config for digital identity
 */
export interface DigitalIdentityConfig {
  /** account id of user, that interacts with digital identity */
  accountId: string;
  /** address of a ``DigitalIdentity`` instance, can be ENS or contract address */
  containerConfig: ContainerConfig;
  /** address of a ``DigitalIdentity`` instance, can be ENS or contract address */
  address?: string;
  /** description has to be passed to ``.create`` to apply it to to contract */
  description?: any;
  /** factory address can be passed to ``.create`` for customer digital identity factory*/
  factoryAddress?: string;
}

/**
 * container for digital identity entry values
 */
export interface DigitalIdentityIndexEntry {
  /** type of entry in index */
  entryType?: DigitalIdentityEntryType;
  /** raw value (``bytes32`` hash) */
  raw?: any;
  /** decrypted/loaded value */
  value?: any;
}

/**
 * data for verifications for digital identities
 */
export interface DigitalIdentityVerificationEntry {
  /** name of the verification (full path) */
  topic: string;
  /** domain of the verification, this is a subdomain under 'verifications.evan', so passing 'example' will link verifications */
  descriptionDomain?: string;
  /** if true, verifications created under  this path are invalid, defaults to ``false`` */
  disableSubverifications?: boolean;
  /** expiration date, for the verification, defaults to `0` (does not expire) */
  expirationDate?: number;
  /** json object which will be stored in the verification */
  verificationValue?: string;
}

/**
 * options for DigitalIdentity constructor (uses same properties as ContainerOptions)
 */
export interface DigitalIdentityOptions extends ContainerOptions {
  profile: Profile;
}

/**
 * helper class for managing digital identities
 *
 * @class      DigitalIdentity (name)
 */
export class DigitalIdentity extends Logger {
  private config: DigitalIdentityConfig;
  private contract: any;
  private options: DigitalIdentityOptions;
  private mutexes: { [id: string]: Mutex; };

  /**
   * Create digital identity contract.
   *
   * @param      {DigitalIdentityOptions}  options  identity runtime options
   * @param      {DigitalIdentityConfig}   config   configuration for the new identity instance
   */
  public static async create(
    options: DigitalIdentityOptions,
    config: DigitalIdentityConfig,
  ): Promise<DigitalIdentity> {
    checkConfigProperties(config, ['description']);
    const instanceConfig = JSON.parse(JSON.stringify(config));

    // ensure, that the evan digital identity tag is set
    instanceConfig.description.tags = instanceConfig.description.tags || [ ];
    if (instanceConfig.description.tags.indexOf('evan-digital-identity') === -1) {
      instanceConfig.description.tags.push('evan-digital-identity');
    }

    // check description values and upload it
    const envelope: Envelope = { public: instanceConfig.description };
    const validation = options.description.validateDescription(envelope);
    if (validation !== true) {
      throw new Error(`validation of description failed with: ${JSON.stringify(validation)}`);
    }

    // ensure, that the user can set an contract to the specified ens address
    if (instanceConfig.address && instanceConfig.address.indexOf('0x') !== 0) {
      try {
        const splitEns = config.address.split('.');
        for (let i = splitEns.length - 1; i > -1; i--) {
          const checkAddress = splitEns.slice(i, splitEns.length).join('.');

          const owner = await options.executor.executeContractCall(
            options.nameResolver.ensContract, 'owner', options.nameResolver.namehash(checkAddress));
          if (owner === nullAddress) {
            await options.nameResolver.setAddress(
              checkAddress,
              nullAddress,
              instanceConfig.accountId
            );
          }
        }
      } catch (ex) {
        throw new Error(`account is not permitted to create a contract for the ens address
          ${ config.address }`);
      }
    }

    // create contract
    let factoryAddress;
    if (instanceConfig.factoryAddress && instanceConfig.factoryAddress.startsWith('0x')) {
      factoryAddress = instanceConfig.factoryAddress;
    } else {
      factoryAddress = await options.nameResolver.getAddress(
        instanceConfig.factoryAddress ||
        options.nameResolver.getDomainName(options.nameResolver.config.domains.indexFactory),
      );
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
    if (instanceConfig.address && instanceConfig.address.indexOf('0x') !== 0) {
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
   * Gets bookmarked identities from profile.
   *
   * @param      {DigitalIdentityOptions}  options  identity runtime options
   */
  public static async getFavorites(options: DigitalIdentityOptions): Promise<Array<string>> {
    const favorites = (await options.profile.getBcContracts('identities.evan')) || { };

    // purge crypto info directly
    delete favorites.cryptoInfo;

    return Object.keys(favorites);
  }

  /**
   * Check if a valid contract is located under the specified address, which allows to check for
   * identities before actually loading them.
   *
   * @param      {DigitalIdentityOptions}  options     identity runtime options
   * @param      {string}                  ensAddress  ens address that should be checked
   */
  public static async getValidity(
    options: DigitalIdentityOptions,
    ensAddress: string,
  ): Promise<{ valid: boolean, exists: boolean, error: Error }> {
    let valid = false, exists = false, error = null;

    // create temporary identity instance, to ensure the contract
    const identityInstance = new DigitalIdentity(options, {
      accountId: nullAddress,
      address: ensAddress,
      containerConfig: { accountId: nullAddress }
    });

    // try to load the contract, this will throw, when the specification is invalid
    try {
      await identityInstance.ensureContract();
      valid = true;
    } catch (ex) {
      error = ex;
    }

    // set exists parameter
    if (!error || error.message.indexOf('contract does not exist') === -1) {
      exists = true;
    }

    return { valid, error, exists };
  }

  /**
   * Create new DititalIdentity instance. This will not create a smart contract contract but is used
   * to load existing containers. To create a new contract, use the static ``create`` function.
   *
   * @param      {DigitalIdentityOptions}  options  runtime-like object with required modules
   * @param      {DigitalIdentityConfig}   config   digital identity related config
   */
  constructor(options: DigitalIdentityOptions, config: DigitalIdentityConfig) {
    super(options as LoggerOptions);
    this.options = options;
    this.config = config;
    this.mutexes = {};
  }

  /**
   * Add the digital identity with given address to profile.
   */
  async addAsFavorite() {
    await this.getMutex('profile').runExclusive(async () => {
      const description = await this.getDescription();

      await this.options.profile.loadForAccount(this.options.profile.treeLabels.contracts);
      await this.options.profile.addBcContract('identities.evan', this.config.address, null);
      await this.options.profile.storeForAccount(this.options.profile.treeLabels.contracts);
    });
  }

  /**
   * Add verifications to this identity; this will also add verifications to contract description
   *
   * @param      {DigitalIdentityVerificationEntry[]}  verifications  list of verifications to add
   */
  public async addVerifications(verifications: DigitalIdentityVerificationEntry[]): Promise<void> {
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
   * Create new `Container` instances and add them as entry to identity.
   *
   * @param      {{ [id: string]: Partial<ContainerConfig> }}  containers  object with containers to
   *                                                                       create, name is used as
   *                                                                       entry name in identity
   */
  public async createContainers(containers: { [id: string]: Partial<ContainerConfig> }
  ): Promise<{ [id: string]: Container }> {
    await this.ensureContract();
    const result = {};
    await Throttle.all(Object.keys(containers).map((name) => async () => {
      result[name] = await Container.create(
        this.options, { ...this.config.containerConfig, ...containers[name] });
      await this.setEntry(name, result[name], DigitalIdentityEntryType.ContainerContract);
    }));
    return result;
  }

  /**
   * Check if digital identity contract already has been loaded, load from address / ENS if required
   * and throw an error, when no contract exists or the description doesn't match the identity
   * specifications.
   */
  public async ensureContract(): Promise<void> {
    if (this.contract) {
      return;
    }
    let address = this.config.address.startsWith('0x') ?
      this.config.address : await this.options.nameResolver.getAddress(this.config.address);
    const baseError = `ens address ${ this.config.address } / contract address ${ address }:`;
    let description;

    // if no address is set, throw an error
    if (!address || address === nullAddress) {
      throw new Error(`${ baseError } contract does not exist`);
    } else {
      try {
        description = (await this.options.description
          .getDescription(address, nullAddress)).public;
      } catch (ex) {
        // when the dbcp could not be loaded, throw
        this.log(`${ baseError } address ${ address }: Could not load dbcp:
          ${ ex.message }`, 'info');
      }
    }

    // if the evan digital identity tag does not exist, throw
    if (!description || !description.tags || description.tags
      .indexOf('evan-digital-identity') === -1) {
      throw new Error(`${ baseError } doesn't match the specification (missing ` +
        'evan-digital-identity\' tag)');
    }

    this.contract = this.options.contractLoader.loadContract('IndexContract', address);
  }

  /**
   * Get contract address of underlying IndexContract.
   */
  public async getContractAddress(): Promise<string> {
    await this.ensureContract();
    return this.contract.options.address;
  }

  /**
   * Returns description from digital identity.
   */
  public async getDescription(): Promise<any> {
    await this.ensureContract();
    return (await this.options.description.getDescription(
      this.contract.options.address, this.config.accountId)).public;
  }

  /**
   * Get all entries from index contract.
   */
  public async getEntries(): Promise<{[id: string]: DigitalIdentityIndexEntry}> {
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
   * Get single entry from index contract.
   *
   * @param      {string}  name    entry name
   */
  public async getEntry(name: string): Promise<DigitalIdentityIndexEntry> {
    await this.ensureContract();
    const [ , firstKey, remainder ] = /([^/]+)(?:\/(.+))?/.exec(name);
    const result: DigitalIdentityIndexEntry = {
      raw: await this.options.executor.executeContractCall(
        this.contract,
        'getEntry',
        firstKey,
      ),
    };
    this.processEntry(result);
    if (remainder && result.entryType === DigitalIdentityEntryType.IndexContract) {
      return result.value.getEntry(remainder);
    } else {
      return result;
    }
  }

  /**
   * Gets verifications from description and fetches list of verifications for each of them.
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
   * Check if this digital identity is bookmarked in profile.
   */
  public async isFavorite(): Promise<boolean> {
    const favorites = await DigitalIdentity.getFavorites(this.options);
    return favorites.indexOf(this.config.address) !== -1;
  }

  /**
   * Removes the current identity from the favorites in profile.
   */
  public async removeFromFavorites() {
    await this.getMutex('profile').runExclusive(async () => {
      const description = await this.getDescription();

      await this.options.profile.loadForAccount(this.options.profile.treeLabels.contracts);
      await this.options.profile.removeBcContract('identities.evan', this.config.address);
      await this.options.profile.storeForAccount(this.options.profile.treeLabels.contracts);
    });
  }

  /**
   * Write given description to digital identities DBCP.
   *
   * @param      {any}  description  description to set (`public` part)
   */
  public async setDescription(description: any): Promise<void> {
    await this.ensureContract();

    this.getMutex('description').runExclusive(async () => {
      // ensure, that the evan digital identity tag is set
      description.tags = description.tags || [ ];
      if (description.tags.indexOf('evan-digital-identity') === -1) {
        description.tags.push('evan-digital-identity');
      }

      await this.options.description.setDescription(
        this.contract.options.address, { public: description }, this.config.accountId);
    });
  }

  /**
   * Set multiple entries at index contract.
   *
   * @param      {{[id: string]: DigitalIdentityIndexEntry}}  entries  entries to set
   */
  public async setEntries(entries: {[id: string]: DigitalIdentityIndexEntry}): Promise<void> {
    await this.ensureContract();
    await Throttle.all(Object.keys(entries).map((name) => async () =>
      this.setEntry(name, entries[name].value, entries[name].entryType)));
  }

  /**
   * Set entry in index contract; entries are unique, setting the same name a second time will
   * overwrite the first value.
   *
   * @param      {string}                    name       entry name
   * @param      {string}                    value      value to set
   * @param      {DigitalIdentityEntryType}  entryType  type of given value
   */
  public async setEntry(
    name: string,
    value: string|Container,
    entryType: DigitalIdentityEntryType,
  ): Promise<void> {
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
   * get mutex for keyword, this can be used to lock several sections during updates
   *
   * @param      {string}  name    name of a section; e.g. 'sharings', 'schema'
   * @return     {Mutex}   Mutex instance
   */
  private getMutex(name: string): Mutex {
    if (!this.mutexes[name]) {
      this.mutexes[name] = new Mutex();
    }
    return this.mutexes[name];
  }

  /**
   * add type and value from raw value to entry
   *
   * @param      {DigitalIdentityIndexEntry}  entry   The entry
   */
  private processEntry(entry: DigitalIdentityIndexEntry): void {
    let address;
    entry.entryType = parseInt(entry.raw.entryType, 10);
    switch (entry.entryType) {
        case DigitalIdentityEntryType.AccountId:
        case DigitalIdentityEntryType.GenericContract:
          entry.value = this.options.web3.utils.toChecksumAddress(`0x${entry.raw.value.substr(26)}`);
          break;
        case DigitalIdentityEntryType.ContainerContract:
          address = this.options.web3.utils.toChecksumAddress(`0x${entry.raw.value.substr(26)}`);
          entry.value = new Container(this.options, { ...this.config.containerConfig, address });
          break;
        case DigitalIdentityEntryType.IndexContract:
          address = this.options.web3.utils.toChecksumAddress(`0x${entry.raw.value.substr(26)}`);
          entry.value = new DigitalIdentity(this.options, { ...this.config, address });
          break;
        default:
          entry.value = entry.raw.value;
    }
  }
}
