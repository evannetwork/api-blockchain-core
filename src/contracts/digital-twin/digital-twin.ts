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
import { Mutex } from 'async-mutex';
import {
  Envelope,
  Logger,
  LoggerOptions,
} from '@evan.network/dbcp';

import {
  Container,
  ContainerConfig,
  ContainerOptions,
  ContainerPlugin,
} from './container';
import { Profile } from '../../profile/profile';


// empty address
const nullAddress = '0x0000000000000000000000000000000000000000';

/**
 * possible entry types for entries in index
 */
export enum DigitalTwinEntryType {
  AccountId,
  // eslint-disable-next-line no-shadow
  Container,
  FileHash,
  GenericContract,
  Hash,
  DigitalTwin,
}

/**
 * Digital twin template definition. Basicly includes a sample description and a sets of plugins,
 * that should be applied to the new twin.
 */
export interface DigitalTwinTemplate {
  /** default description has to be passed to ``.create`` to apply it to to contract */
  description: any;
  /** set of plugins that should be applied to the twin as new containers */
  plugins: { [pluginName: string]: ContainerPlugin };
}

/**
 * config for digital twin
 */
export interface DigitalTwinConfig {
  /** account id of user, that interacts with digital twin */
  accountId: string;
  /** default configuration for new containers */
  containerConfig?: ContainerConfig;
  /** address of a ``DigitalTwin`` instance, can be ENS or contract address */
  address?: string;
  /** description has to be passed to ``.create`` to apply it to to contract */
  description?: any;
  /** factory address can be passed to ``.create`` for customer digital twin factory */
  factoryAddress?: string;
  /** Preset of plugins that should be applied to the twin. Will directly create several containers
      with the given plugin definition. */
  plugins?: { [id: string]: ContainerPlugin };
}

/**
 * container for digital twin entry values
 */
export interface DigitalTwinIndexEntry {
  /** type of entry in index */
  entryType?: DigitalTwinEntryType;
  /** raw value (``bytes32`` hash) */
  raw?: any;
  /** decrypted/loaded value */
  value?: any;
}

/**
 * data for verifications for digital twins
 */
export interface DigitalTwinVerificationEntry {
  /** name of the verification (full path) */
  topic: string;
  /** domain of the verification, this is a subdomain under 'verifications.evan',
   * so passing 'example' will link verifications */
  descriptionDomain?: string;
  /** if true, verifications created under  this path are invalid, defaults to ``false`` */
  disableSubverifications?: boolean;
  /** expiration date, for the verification, defaults to `0` (does not expire) */
  expirationDate?: number;
  /** json object which will be stored in the verification */
  verificationValue?: string;
}

/**
 * options for DigitalTwin constructor (uses same properties as ContainerOptions)
 */
export interface DigitalTwinOptions extends ContainerOptions {
  profile: Profile;
}

/**
 * helper class for managing digital twins
 *
 * @class      DigitalTwin (name)
 */
export class DigitalTwin extends Logger {
  public static defaultDescription = {
    name: 'Digital Twin',
    description: 'Digital Twin Contract',
    author: '',
    version: '0.1.0',
    dbcpVersion: 2,
  };

  private config: DigitalTwinConfig;

  private contract: any;

  private options: DigitalTwinOptions;

  private mutexes: { [id: string]: Mutex };

  /**
   * Create digital twin contract.
   *
   * @param      {DigitalTwinOptions}  options  twin runtime options
   * @param      {DigitalTwinConfig}   config   configuration for the new twin instance
   */
  public static async create(
    options: DigitalTwinOptions,
    config: DigitalTwinConfig,
  ): Promise<DigitalTwin> {
    const instanceConfig = JSON.parse(JSON.stringify(config));

    // ensure, that the evan digital twin tag is set
    instanceConfig.description.tags = instanceConfig.description.tags || [];
    if (instanceConfig.description.tags.indexOf('evan-digital-twin') === -1) {
      instanceConfig.description.tags.push('evan-digital-twin');
    }

    // check description values and upload it
    const envelope: Envelope = {
      public: instanceConfig.description || DigitalTwin.defaultDescription,
    };
    const validation = options.description.validateDescription(envelope);
    if (validation !== true) {
      throw new Error(`validation of description failed with: ${JSON.stringify(validation)}`);
    }

    // check for valid plugin descriptions
    if (config.plugins) {
      Object.keys(config.plugins).forEach((pluginName: string) => {
        const pluginDescription = {
          public: config.plugins[pluginName].description || config.containerConfig.description,
        };

        const pluginValidation = options.description.validateDescription(pluginDescription);
        if (pluginValidation !== true) {
          throw new Error(`validation of plugin "${pluginName}" description failed with:
            ${JSON.stringify(pluginValidation)}`);
        }
      });
    }

    // ensure, that the user can set an contract to the specified ens address
    if (instanceConfig.address && instanceConfig.address.indexOf('0x') !== 0) {
      try {
        const splitEns = config.address.split('.');
        for (let i = splitEns.length - 1; i > -1; i -= 1) {
          const checkAddress = splitEns.slice(i, splitEns.length).join('.');

          const owner = await options.executor.executeContractCall(
            options.nameResolver.ensContract, 'owner', options.nameResolver.namehash(checkAddress),
          );
          if (owner === nullAddress) {
            await options.nameResolver.setAddress(
              checkAddress,
              nullAddress,
              instanceConfig.accountId,
            );
          }
        }
      } catch (ex) {
        throw new Error(`account is not permitted to create a contract for the ens address
          ${config.address}`);
      }
    }

    // create contract
    let factoryAddress;
    if (instanceConfig.factoryAddress && instanceConfig.factoryAddress.startsWith('0x')) {
      factoryAddress = instanceConfig.factoryAddress;
    } else {
      factoryAddress = await options.nameResolver.getAddress(
        instanceConfig.factoryAddress
        || options.nameResolver.getDomainName(options.nameResolver.config.domains.indexFactory),
      );
    }
    const factory = options.contractLoader.loadContract(
      'DigitalTwinFactory', factoryAddress,
    );
    const contractId = await options.executor.executeContractTransaction(
      factory,
      'createContract', {
        from: instanceConfig.accountId,
        autoGas: 1.1,
        event: { target: 'DigitalTwinFactory', eventName: 'ContractCreated' },
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

    const twin = new DigitalTwin(options, instanceConfig);
    await twin.ensureContract();

    // if plugins were applied to the twin, run the createContainers function
    if (config.plugins) {
      // transform plugins to container configs
      const containerPartials: { [id: string]: Partial<ContainerConfig> } = { };
      Object.keys(config.plugins).forEach((pluginName: string) => {
        containerPartials[pluginName] = {
          description: config.plugins[pluginName].description,
          plugin: config.plugins[pluginName],
        };
      });
      // create the containers for the given plugins
      await twin.createContainers(containerPartials);
    }

    return twin;
  }

  /**
   * Gets bookmarked twins from profile.
   *
   * @param      {DigitalTwinOptions}  options  twin runtime options
   */
  public static async getFavorites(options: DigitalTwinOptions): Promise<string[]> {
    const favorites = (await options.profile.getBcContracts('twins.evan')) || { };

    // purge crypto info directly
    delete favorites.cryptoInfo;

    return Object.keys(favorites);
  }

  /**
   * Check if a valid contract is located under the specified address, which allows to check for
   * twins before actually loading them.
   *
   * @param      {DigitalTwinOptions}  options     twin runtime options
   * @param      {string}                  ensAddress  ens address that should be checked
   */
  public static async getValidity(
    options: DigitalTwinOptions,
    ensAddress: string,
  ): Promise<{ valid: boolean; exists: boolean; error: Error }> {
    let valid = false; let exists = false; let
      error = null;

    // create temporary twin instance, to ensure the contract
    const twinInstance = new DigitalTwin(options, {
      accountId: nullAddress,
      address: ensAddress,
      containerConfig: { accountId: nullAddress },
    });

    // try to load the contract, this will throw, when the specification is invalid
    try {
      await twinInstance.ensureContract();
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
   * Create new DigitalTwin instance. This will not create a smart contract contract but is used
   * to load existing containers. To create a new contract, use the static ``create`` function.
   *
   * @param      {DigitalTwinOptions}  options  runtime-like object with required modules
   * @param      {DigitalTwinConfig}   config   digital twin related config
   */
  public constructor(options: DigitalTwinOptions, config: DigitalTwinConfig) {
    super(options as LoggerOptions);
    this.config = config;
    this.config.containerConfig = this.config.containerConfig || { accountId: nullAddress };
    this.options = options;
    this.mutexes = {};
  }

  /**
   * Add the digital twin with given address to profile.
   */
  public async addAsFavorite() {
    await this.getMutex('profile').runExclusive(async () => {
      await this.options.profile.loadForAccount(this.options.profile.treeLabels.contracts);
      await this.options.profile.addBcContract('twins.evan', this.config.address, {});
      await this.options.profile.storeForAccount(this.options.profile.treeLabels.contracts);
    });
  }

  /**
   * Add verifications to this twin; this will also add verifications to contract description
   *
   * @param      {DigitalTwinVerificationEntry[]}  verifications  list of verifications to add
   */
  public async addVerifications(verifications: DigitalTwinVerificationEntry[]): Promise<void> {
    await this.ensureContract();
    const owner = await this.options.executor.executeContractCall(this.contract, 'owner');
    const isOwner = owner === this.config.accountId;
    await Throttle.all(verifications.map((verification) => async () => {
      const verificationId = await this.options.verifications.setVerification(
        this.config.accountId,
        this.contract.options.address,
        verification.topic,
        verification.expirationDate,
        verification.verificationValue,
        verification.descriptionDomain,
        verification.disableSubverifications,
      );
      if (isOwner) {
        // auto-accept if current user is owner
        await this.options.verifications.confirmVerification(
          this.config.accountId,
          await this.getContractAddress(),
          verificationId,
        );
      }
    }));
    // update description if current user is owner
    if (owner === this.config.accountId) {
      // update description
      const verificationTags = verifications.map((verification) => `verification:${verification.topic}`);
      const description = await this.getDescription();
      const oldTags = description.tags || [];
      const toAdd = verificationTags.filter((tag) => !oldTags.includes(tag));
      if (toAdd.length) {
        description.tags = oldTags.concat(toAdd);
        await this.setDescription(description);
      }
    }
  }

  /**
   * Create new `Container` instances and add them as entry to twin.
   *
   * @param      {{ [id: string]: Partial<ContainerConfig> }}  containers  object with containers to
   *                                                                       create, name is used as
   *                                                                       entry name in twin
   */
  public async createContainers(
    containers: { [id: string]: Partial<ContainerConfig> },
  ): Promise<{ [id: string]: Container }> {
    await this.ensureContract();
    const result = {};
    await Throttle.all(Object.keys(containers).map((name) => async () => {
      result[name] = await Container.create(
        this.options,
        {
          accountId: this.config.accountId,
          ...this.config.containerConfig,
          ...containers[name],
        },
      );
      await this.setEntry(name, result[name], DigitalTwinEntryType.Container);
    }));
    return result;
  }

  /**
   * Check if digital twin contract already has been loaded, load from address / ENS if required
   * and throw an error, when no contract exists or the description doesn't match the twin
   * specifications.
   */
  public async ensureContract(): Promise<void> {
    if (this.contract) {
      return;
    }
    const address = this.config.address.startsWith('0x')
      ? this.config.address : await this.options.nameResolver.getAddress(this.config.address);
    const baseError = `ens address ${this.config.address} / contract address ${address}:`;
    let description;

    // if no address is set, throw an error
    if (!address || address === nullAddress) {
      throw new Error(`${baseError} contract does not exist`);
    } else {
      try {
        description = (await this.options.description
          .getDescription(address, nullAddress)).public;
      } catch (ex) {
        // when the dbcp could not be loaded, throw
        this.log(`${baseError} address ${address}: Could not load dbcp:
          ${ex.message}`, 'info');
      }
    }

    // if the evan digital twin tag does not exist, throw
    if (!description || !description.tags || description.tags
      .indexOf('evan-digital-twin') === -1) {
      throw new Error(`${baseError} doesn't match the specification (missing `
        + 'evan-digital-twin\' tag)');
    }

    this.contract = this.options.contractLoader.loadContract('DigitalTwin', address);
  }

  /**
   * Exports the twin template definition for this twin.
   *
   * @param      {boolean}  getValues  export entry values of containers or not (list entries are
   *                                   always excluded)
   */
  public async exportAsTemplate(getValues = false): Promise<DigitalTwinTemplate> {
    // load twin specific data
    const [description, entries] = (await Promise.all([
      this.getDescription(),
      this.getEntries(),
    ])) as [ any, {[id: string]: DigitalTwinIndexEntry} ];

    // create clean twin template
    const twinTemplate: DigitalTwinTemplate = {
      description: await Container.purgeDescriptionForTemplate({
        version: '1.0.0',
        versions: { },
        ...description,
      }),
      plugins: { },
    };

    // load plugin definitions for all containers that are attached to this twin
    await Throttle.all(Object.keys(entries).map((pluginName: string) => async () => {
      twinTemplate.plugins[pluginName] = await entries[pluginName].value.toPlugin(getValues);
    }));

    return twinTemplate;
  }

  /**
   * Get contract address of underlying DigitalTwin.
   */
  public async getContractAddress(): Promise<string> {
    await this.ensureContract();
    return this.contract.options.address;
  }

  /**
   * Returns description from digital twin.
   */
  public async getDescription(): Promise<any> {
    await this.ensureContract();
    return (await this.options.description.getDescription(
      this.contract.options.address, this.config.accountId,
    )).public;
  }

  /**
   * Get all entries from index contract.
   */
  public async getEntries(): Promise<{[id: string]: DigitalTwinIndexEntry}> {
    await this.ensureContract();
    // get all from contract
    const results = {};
    let itemsRetrieved = 0;
    const resultsPerPage = 10;
    const getResults = async (singleQueryOffset) => {
      const queryResult = await this.options.executor.executeContractCall(
        this.contract,
        'getEntries',
        singleQueryOffset,
      );
      itemsRetrieved += resultsPerPage;
      for (let i = 0; i < queryResult.names.length; i += 1) {
        if (!queryResult.names[i]) {
          // result pages have empty entries after valid results, so drop those
          break;
        }
        results[queryResult.names[i]] = {
          raw: { value: queryResult.values[i], entryType: queryResult.entryTypes[i] },
        };
      }
      if (itemsRetrieved < queryResult.totalCount) {
        await getResults(singleQueryOffset + resultsPerPage);
      }
    };
    await getResults(0);
    for (const key of Object.keys(results)) {
      this.processEntry(results[key]);
    }
    return results;
  }

  /**
   * Get single entry from index contract. When this twin has other twins as its entries, properties
   * from those can be selected by building a path of properties.
   *
   * @param      {string}  name    entry name or path to data in linked twin
   */
  public async getEntry(name: string): Promise<DigitalTwinIndexEntry> {
    await this.ensureContract();
    const [, firstKey, remainder] = /([^/]+)(?:\/(.+))?/.exec(name);
    const result: DigitalTwinIndexEntry = {
      raw: await this.options.executor.executeContractCall(
        this.contract,
        'getEntry',
        firstKey,
      ),
    };
    this.processEntry(result);
    if (remainder && result.entryType === DigitalTwinEntryType.DigitalTwin) {
      return result.value.getEntry(remainder);
    }
    return result;
  }

  /**
   * Gets verifications from description and fetches list of verifications for each of them.
   */
  public async getVerifications(): Promise<any[]> {
    await this.ensureContract();
    const description = await this.getDescription();
    const tags = description.tags || [];
    return Throttle.all(tags
      .filter((tag) => tag.startsWith('verification:'))
      .map((tag) => tag.substr(13))
      .map((topic) => async () => this.options.verifications.getVerifications(
        description.identity,
        topic,
        true,
      )));
  }

  /**
   * Check if this digital twin is bookmarked in profile.
   */
  public async isFavorite(): Promise<boolean> {
    const favorites = await DigitalTwin.getFavorites(this.options);
    return favorites.indexOf(this.config.address) !== -1;
  }

  /**
   * Removes the current twin from the favorites in profile.
   */
  public async removeFromFavorites() {
    await this.getMutex('profile').runExclusive(async () => {
      await this.options.profile.loadForAccount(this.options.profile.treeLabels.contracts);
      await this.options.profile.removeBcContract('twins.evan', this.config.address);
      await this.options.profile.storeForAccount(this.options.profile.treeLabels.contracts);
    });
  }

  /**
   * Write given description to digital twins DBCP.
   *
   * @param      {any}  description  description to set (`public` part)
   */
  public async setDescription(description: any): Promise<void> {
    await this.ensureContract();
    await this.getMutex('description').runExclusive(async () => {
      const descriptionParam = description;
      // ensure, that the evan digital twin tag is set
      descriptionParam.tags = descriptionParam.tags || [];
      if (descriptionParam.tags.indexOf('evan-digital-twin') === -1) {
        descriptionParam.tags.push('evan-digital-twin');
      }

      await this.options.description.setDescription(
        this.contract.options.address, { public: descriptionParam }, this.config.accountId,
      );
    });
  }

  /**
   * Set multiple entries at index contract.
   *
   * @param      {{[id: string]: DigitalTwinIndexEntry}}  entries  entries to set
   */
  public async setEntries(entries: {[id: string]: DigitalTwinIndexEntry}): Promise<void> {
    await this.ensureContract();
    await Throttle.all(
      Object.keys(entries).map(
        (name) => async () => this.setEntry(name, entries[name].value, entries[name].entryType),
      ),
    );
  }

  /**
   * Set entry in index contract; entries are unique, setting the same name a second time will
   * overwrite the first value.
   *
   * @param      {string}                    name       entry name
   * @param      {string}                    value      value to set
   * @param      {DigitalTwinEntryType}  entryType  type of given value
   */
  public async setEntry(
    name: string,
    value: string|Container,
    entryType: DigitalTwinEntryType,
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
   * @param      {DigitalTwinIndexEntry}  entry   The entry
   */
  private processEntry(entry: DigitalTwinIndexEntry): void {
    let address;
    const entryParam = entry;
    entryParam.entryType = parseInt(entryParam.raw.entryType, 10);
    switch (entryParam.entryType) {
      case DigitalTwinEntryType.AccountId:
      case DigitalTwinEntryType.GenericContract:
        entryParam.value = this.options.web3.utils.toChecksumAddress(`0x${entryParam.raw.value.substr(26)}`);
        break;
      case DigitalTwinEntryType.Container:
        address = this.options.web3.utils.toChecksumAddress(`0x${entryParam.raw.value.substr(26)}`);
        entryParam.value = new Container(
          this.options,
          {
            accountId: this.config.accountId,
            ...this.config.containerConfig,
            address,
          },
        );
        break;
      case DigitalTwinEntryType.DigitalTwin:
        address = this.options.web3.utils.toChecksumAddress(`0x${entryParam.raw.value.substr(26)}`);
        entryParam.value = new DigitalTwin(this.options, { ...this.config, address });
        break;
      default:
        entryParam.value = entryParam.raw.value;
    }
  }
}
