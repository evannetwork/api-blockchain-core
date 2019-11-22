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
  CryptoProvider,
  Envelope,
  Executor,
  Logger,
  LoggerOptions,
} from '@evan.network/dbcp';

import { DataContract } from '../data-contract/data-contract';
import { Description } from '../../shared-description';
import { NameResolver } from '../../name-resolver';
import { Profile } from '../../profile/profile';
import { RightsAndRoles, ModificationType, PropertyType } from '../rights-and-roles';
import { Sharing } from '../sharing';
import { Verifications } from '../../verifications/verifications';


/**
 * config properties, specific to `Container` instances
 */
export interface ContainerConfig {
  /** account id of user, that interacts with container */
  accountId: string;
  /** address of a ``DataContract`` instance, can be ENS or contract address */
  address?: string;
  /** description has to be passed to ``.create`` to apply it to to contract */
  description?: any;
  /** factory address can be passed to ``.create`` for custom container factory */
  factoryAddress?: string;
  /** plugin to be used in ``.create``, can be string with name or a ``ContainerTemplate`` */
  plugin?: string | ContainerPlugin;
}

/**
 * description and content of a single file, usually used in arrays (add/get/set operations)
 */
export interface ContainerFile {
  /** filename, e.g. 'animal-animal-photography-cat-96938.jpg' */
  name: string;
  /** mime type of the file, e.g. 'image/jpeg' */
  fileType: string;
  /** file data as Buffer */
  file: Buffer;
}

/**
 * options for Container constructor
 */
export interface ContainerOptions extends LoggerOptions {
  contractLoader: ContractLoader;
  cryptoProvider: CryptoProvider;
  dataContract: DataContract;
  description: Description;
  executor: Executor;
  nameResolver: NameResolver;
  rightsAndRoles: RightsAndRoles;
  sharing: Sharing;
  verifications: Verifications;
  web3: any;
}

/**
 * config for sharing multiple fields to one account (read and/or readWrite access)
 */
export interface ContainerShareConfig {
  /** account, that gets properties shared */
  accountId: string;
  /** list of properties, that are shared read-only */
  read?: string[];
  /** list of properties, that are shared readable and writable */
  readWrite?: string[];
  /** list of properties, that are giving the rights to remove listentries */
  removeListEntries?: string[];
}

/**
 * config for unsharing multiple fields from one account (write and/or readWrite access)
 */
export interface ContainerUnshareConfig {
  /** account, that gets properties unshared */
  accountId: string;
  /** list of properties, that are unshared (read and write permissions) */
  readWrite?: string[];
  /** list of properties, that are losing the rights to remove listentries */
  removeListEntries?: string[];
  /** list of properties, for which write permissions should be removed */
  write?: string[];
}

/**
 * base definition of a container instance, covers properties setup and permissions
 */
export interface ContainerPlugin {
  /** container dbcp description (name, description, ...) **/
  description?: any;
  /** template for container instances, covers properties setup and permissions **/
  template: ContainerTemplate;
}

/**
 * template for container instances, covers properties setup and permissions
 */
export interface ContainerTemplate {
  /** type of the template (equals name of the template) */
  type: string;
  /** list of properties included in this template, key is field name, value is property setup */
  properties?: { [id: string]: ContainerTemplateProperty };
}

/**
 * property in `ContainerTemplate`, defines an `entry` or `list` at the data contract
 */
export interface ContainerTemplateProperty {
  /** `Ajv <https://github.com/epoberezkin/ajv>`_ data schema for field */
  dataSchema: any;
  /** permissions for this template, key is role id, value is array with 'set' and/or 'remove' */
  permissions: { [id: number]: string[] };
  /** type of property (entry/list) */
  type: string;
  /** value of property */
  value?: any;
}

/**
 * data for verifications for containers, see ``Validation`` documentation for details
 */
export interface ContainerVerificationEntry {
  /** validation path */
  topic: string;
  /** domain, where the description of this validation is stored */
  descriptionDomain?: string;
  /** if set, validations created in a sub-path are invalid by default */
  disableSubverifications?: boolean;
  /** expiration date, validations do not expire if omitted */
  expirationDate?: number;
  /** reference to additional validation details */
  verificationValue?: string;
}

// helper for handling global pending created identities
const pendingIdentities = [];

/**
 * helper class for managing data contracts; all values are stored encrypted, hashes are encrypted
 * as well, use `contract` property and `DataContract` module for custom logic for special cases
 * like unencrypted values
 *
 * @class      Container (name)
 */
export class Container extends Logger {
  public static defaultDescription = {
    name: 'Container Contract (DataContract)',
    description: 'Container for Digital Twin Data',
    author: '',
    version: '0.1.0',
    dbcpVersion: 2,
  };
  public static defaultSchemas = {
    booleanEntry: { type: 'boolean' },
    booleanList: { type: 'array', items: { type: 'boolean' } },
    filesEntry: {
      type: 'object',
      $comment: '{"isEncryptedFile": true}',
      properties: {
        additionalProperties: false,
        files: {
          type: 'array', items: { type: 'string', }
        },
      },
      required: [ 'files' ],
    },
    filesList: {
      type: 'array',
      items: {
        type: 'object',
        $comment: '{"isEncryptedFile": true}',
        properties: {
          additionalProperties: false,
          files: {
            type: 'array', items: { type: 'string', }
          },
        },
        required: [ 'files' ],
      },
    },
    numberEntry: { type: 'number' },
    numberList: { type: 'array', items: { type: 'number' } },
    objectEntry: { type: 'object' },
    objectList: { type: 'array', items: { type: 'object' } },
    stringEntry: { type: 'string' },
    stringList: { type: 'array', items: { type: 'string' } },
  };
  public static defaultPlugin = 'metadata';
  public static profilePluginsKey = 'templates.datacontainer.digitaltwin.evan';
  public static plugins: { [id: string]: ContainerPlugin } = {
    metadata: {
      description: {
        name: '',
        description: '',
      },
      template: {
        type: 'metadata',
        properties: {},
      },
    },
  };
  private config: ContainerConfig;
  private contract: any;
  private mutexes: { [id: string]: Mutex };
  private options: ContainerOptions;
  private reservedRoles = 64;

  /**
   * Clone ``Container`` instance into template and creates new ``Container`` with it.
   *
   * @param      {ContainerOptions}  options  runtime for new `Container`
   * @param      {ContainerConfig}   config   config for new container
   * @param      {Container}         source   will be serialized to a template that will be applied
   *                                          to new `Container`
   */
  public static async clone(
    options: ContainerOptions,
    config: ContainerConfig,
    source: Container,
    copyValues = false,
  ): Promise<Container> {
    const plugin = await source.toPlugin(copyValues);
    return Container.create(options, { ...config, plugin });
  }

  /**
   * Creates a new digital container contract on the blockchain.
   *
   * @param      {ContainerOptions}  options  runtime for new `Container`
   * @param      {ContainerConfig}   config   config for new container
   */
  public static async create(
    options: ContainerOptions,
    config: ContainerConfig,
  ): Promise<Container> {
    const instanceConfig = cloneDeep(config);

    // subscribe to emit IdentityCreated(newIdentity, msg.sender);
    const contractIdentities = await options.nameResolver.getAddress('contractidentities.evan');
    const identitiesSubscription = await options.executor.eventHub.subscribe(
      'IdentityHolder',
      contractIdentities,
      'IdentityCreated',
      ({ returnValues: { identity }}) => {
        if (!pendingIdentities.includes(identity)) {
          pendingIdentities.push(identity);
          return true;
        } else {
          return false;
        }
      },
      () => {}
    );

    // convert template properties to jsonSchema
    if (instanceConfig.plugin &&
        instanceConfig.plugin.template &&
        instanceConfig.plugin.template.properties) {
      instanceConfig.description.dataSchema = toJsonSchema(
        instanceConfig.plugin.template.properties)
    }

    // check description values and upload it
    const envelope: Envelope = {
      public: JSON.parse(JSON.stringify(instanceConfig.description || Container.defaultDescription)),
    };

    // ensure abi definition is saved to the data container
    if (!envelope.public.abis) {
      envelope.public.abis = {
        own: JSON.parse(options.contractLoader.contracts.DataContract.interface)
      };
    }

    const validation = options.description.validateDescription(envelope);
    if (validation !== true) {
      throw new Error(`validation of description failed with: ${JSON.stringify(validation)}`);
    }

    // create contract
    const contract = await options.dataContract.create(
      instanceConfig.factoryAddress ||
        options.nameResolver.getDomainName(options.nameResolver.config.domains.containerFactory),
      instanceConfig.accountId,
      null,
      '0x0000000000000000000000000000000000000000000000000000000000000000',
      true,
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    );

    const contractId = contract.options.address;
    instanceConfig.address = contractId;
    const container = new Container(options, instanceConfig);
    await container.ensureContract();

    // now check all remaining identities if they match the new created contract
    const identityHolderContract = options.contractLoader.loadContract(
      'IdentityHolder',
      contractIdentities
    );

    const resolvedIdentities = await Promise.all(pendingIdentities.map(async (pendingIdentity) => {
      return {
        identity: pendingIdentity,
        contract: await options.executor.executeContractCall(
          identityHolderContract,
          'getLink',
          pendingIdentity
        )
      }
    }));
    const targetIdentity = resolvedIdentities.find((resolvedIdentity) => {
      return new RegExp(`${contractId.substr(2)}$`, 'i').test(resolvedIdentity.contract);
    });

    // after found the correct identity, stop the subscription
    options.executor.eventHub.unsubscribe({
      subscription: identitiesSubscription
    });

    pendingIdentities.splice(pendingIdentities.indexOf(targetIdentity.identity), 1);
    envelope.public.identity = targetIdentity.identity;

    // write values from template to new contract
    await applyPlugin(options, instanceConfig, container, envelope);

    return container;
  }

  /**
   * Remove a container plugin from a users profile.
   *
   * @param      {Profile}  profile  profile instance
   * @param      {string}   name     plugin name
   */
  public static async deleteContainerPlugin(
    profile: Profile,
    name: string
  ): Promise<void> {
    // force reload to work on latest tree
    await profile.loadForAccount(profile.treeLabels.dtContainerPlugins);
    const plugins = await this.getContainerPlugins(profile);

    // remove plugin
    delete plugins[name];

    await profile.setPlugins(plugins);
    await profile.storeForAccount(profile.treeLabels.dtContainerPlugins);
    await profile.loadForAccount(profile.treeLabels.dtContainerPlugins);
  }

  /**
   * Get one container plugin for a users profile by name.
   *
   * @param      {Profile}  profile  profile instance
   * @param      {string}   name     plugin name
   */
  public static async getContainerPlugin(
    profile: Profile,
    name: string
  ): Promise<ContainerPlugin> {
    return (await this.getContainerPlugins(profile))[name];
  }

  /**
   * Get all container plugins for a users profile.
   *
   * @param      {Profile}            profile      profile instance
   */
  public static async getContainerPlugins(
    profile: Profile
  ): Promise<{[id: string]: ContainerPlugin}> {
    return (await profile.getPlugins() || { });
  }

  /**
   * Persists a plugin including an dbcp description to the users profile.
   *
   * @param      {Profile}            profile     profile instance
   * @param      {string}             name        plugin name
   * @param      {ContainerTemplate}  plugin      container plugin object
   * @param      {string}             beforeName  remove previous plugin instance when it was
   *                                              renamed
   * @param      {any}  description  predefined plugin dbcp description
   */
  public static async saveContainerPlugin(
    profile: Profile,
    name: string,
    plugin: ContainerPlugin,
    beforeName?: string,
  ): Promise<void> {
    // force reload to work on latest tree
    await profile.loadForAccount(profile.treeLabels.dtContainerPlugins);
    const plugins = await this.getContainerPlugins(profile);

    // if plugin was renamed, remove the plugin
    if (beforeName && beforeName !== name) {
      delete plugins[beforeName];
    }

    // set the new plugin definition and save it
    plugins[name] = plugin;

    await profile.setPlugins(plugins);
    await profile.storeForAccount(profile.treeLabels.dtContainerPlugins);
    await profile.loadForAccount(profile.treeLabels.dtContainerPlugins);
  }

  /**
   * Create new ``Container`` instance. This will not create a smart contract contract but is used
   * to load existing containers. To create a new contract, use the static ``create`` function.
   *
   * @param      {ContainerOptions}  options  runtime for new container
   * @param      {ContainerConfig}   config   config for new container
   */
  public constructor(options: ContainerOptions, config: ContainerConfig) {
    super(options as LoggerOptions);
    this.options = options;
    this.config = config;
    this.mutexes = {};
  }

  /**
   * Add list entries to a list list property.
   *
   * List entries can be added in bulk, so the value argument is an array with values. This array
   * can be arbitrarily large **up to a certain degree**. Values are inserted on the blockchain side
   * and adding very large arrays this way may take more gas during the contract transaction, than
   * may fit into a single transaction. If this is the case, values can be added in chunks (multiple
   * transactions).
   *
   * @param      {string}  listName  name of the list in the data contract
   * @param      {any}     values    values to add
   */
  public async addListEntries(listName: string, values: any[]): Promise<void> {
    await this.ensureContract();
    await this.ensureProperty(listName, this.deriveSchema(values), 'list');
    await this.wrapPromise(
      'add list entries to contract',
      (async () => {
        const toSet = await this.encryptFilesIfRequired(listName, values);
        await this.options.dataContract.addListEntries(
          this.contract, listName, toSet, this.config.accountId)
      })(),
    );
  }

  /**
   * Add verifications to this container; this will also add verifications to contract description.
   * Due to the automatic expansion of the contract description, this function can only be called by
   * the container owner.
   *
   * @param      {ContainerVerificationEntry[]}  verifications  list of verifications to add
  */
  public async addVerifications(verifications: ContainerVerificationEntry[]): Promise<void> {
    await this.ensureContract();
    const owner = await this.options.executor.executeContractCall(this.contract, 'owner');
    const isOwner = owner === this.config.accountId;
    await Throttle.all(verifications.map(verification => async () => {
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
      const tags = verifications.map(verification => `verification:${verification.topic}`);
      await this.getMutex('description').runExclusive(async () => {
        const description = await this.getDescription();
        const oldTags = description.tags || [];
        const toAdd = tags.filter(tag => !oldTags.includes(tag));
        if (toAdd.length) {
          description.tags = oldTags.concat(toAdd);
          await this.setDescription(description);
        }
      });
    }
  }

  /**
   * Ensure that container supports given property.
   *
   * @param      {string}  propertyName  name of an entry or list
   * @param      {any}     dataSchema    ajv data schema
   * @param      {string}  propertyType  (optional) 'list' if dataSchema.type is 'array', otherwise
   *                                     'entry'
   */
  public async ensureProperty(
    propertyName: string,
    dataSchema: any,
    propertyType = dataSchema.type === 'array' ? 'list' : 'entry',
  ): Promise<void> {
    await this.ensureContract();
    await this.ensurePermissionOnField(propertyName, propertyType);
    await this.ensureKeyInSharing(propertyName);
    await this.ensureTypeInSchema(propertyName, dataSchema);
  }

  /**
   * Derive type from item value, ensure, that it is in DBCPs  data schema. If no description is
   * given, this function will fetch current description and update it. If a description is
   * provided, this function will not update contracts description and only merge updates into given
   * description.
   *
   * @param      {string}  name         property name
   * @param      {any}     schema       data schema for given property
   * @param      {any}     description  (optional): description ot update
   * @return     {Promise<void>}  resolved when done
   */
  public async ensureTypeInSchema(name: string, schema: any, description?: any): Promise<void> {
    await this.getMutex('schema').runExclusive(async () => {
      let descriptionToEdit;
      if (description) {
        descriptionToEdit = description;
      } else {
        descriptionToEdit = await this.getDescription();
      }
      if (!descriptionToEdit.dataSchema) {
        descriptionToEdit.dataSchema = {};
      }
      if (!descriptionToEdit.dataSchema[name]) {
        const fieldId = name.replace(/[^a-zA-Z0-9]/g, '');
        descriptionToEdit.dataSchema[name] = cloneDeep(schema);
        descriptionToEdit.dataSchema[name].$id = `${fieldId}_schema`;
        if (!description) {
          await this.setDescription(descriptionToEdit);
        }
      }
    });
  }

  /**
   * Get contract address of underlying ``DataContract``.
   */
  public async getContractAddress(): Promise<string> {
    await this.ensureContract();
    return this.contract.options.address;
  }

  /**
   * Get description from container contract.
   */
  public async getDescription(): Promise<any> {
    await this.ensureContract();
    return (await this.options.description.getDescription(
      this.contract.options.address, this.config.accountId)).public;
  }

  /**
   * Return entry from contract.
   *
   * @param      {string}  entryName  entry name
   */
  public async getEntry(entryName: string): Promise<any> {
    await this.ensureContract();
    return this.wrapPromise(
      'get entry',
      (async () => {
        let value = await this.options.dataContract.getEntry(
          this.contract, entryName, this.config.accountId);

        if (entryName !== 'type') {
          value = await this.decryptFilesIfRequired(entryName, value);
        }

        return value;
      })(),
    );
  }

  /**
   * Return list entries from contract. Note, that in the current implementation, this function
   * retrieves the entries one at a time and may take a longer time when querying large lists, so be
   * aware of that
   *
   * @param      {string}   listName  name of a list in the container
   * @param      {number}   count     number of items to retrieve
   * @param      {number}   offset    skip this many entries
   * @param      {boolean}  reverse   if true, fetches last items first
   */
  public async getListEntries(listName: string, count = 10, offset = 0, reverse = false
  ): Promise<any[]> {
    await this.ensureContract();
    return this.wrapPromise(
      'get list entries',
      (async () => {
        const values = await this.options.dataContract.getListEntries(
          this.contract, listName, this.config.accountId, true, true, count, offset, reverse);
        return this.decryptFilesIfRequired(listName, values);
      })(),
    );
  }

  /**
   * Return a single list entry from contract.
   *
   * @param      {string}  listName  name of a list in the container
   * @param      {number}  index     list entry id to retrieve
   */
  public async getListEntry(listName: string, index: number): Promise<any> {
    await this.ensureContract();
    return this.wrapPromise(
      'get list entry',
      (async () => {
        const value = await this.options.dataContract.getListEntry(
          this.contract, listName, index, this.config.accountId);
        return this.decryptFilesIfRequired(listName, value);
      })(),
    );
  }

  /**
   * Return number of entries in the list.
   * Does not try to actually fetch and decrypt values, but just returns the count.
   *
   * @param      {string}  listName  name of a list in the container
   */
  public async getListEntryCount(listName: string): Promise<number> {
    await this.ensureContract();
    return this.wrapPromise(
      'get list entry count',
      this.options.dataContract.getListEntryCount(this.contract, listName),
    );
  }

  /**
   * Check permissions for given account and return them as ContainerShareConfig object.
   *
   * @param      {string}  accountId  account to check permissions for
   */
  public async getContainerShareConfigForAccount(accountId: string): Promise<ContainerShareConfig> {
    await this.ensureContract();
    const result: ContainerShareConfig = {
      accountId,
    };
    const read = [];
    const readWrite = [];
    const sha3 = (...args) => this.options.nameResolver.soliditySha3(...args);
    const [description, sharings] = await Promise.all([
      this.getDescription(),
      this.options.sharing.getSharingsFromContract(this.contract),
    ]);
    if (description.dataSchema) {
      const authority = this.options.contractLoader.loadContract(
        'DSRolesPerContract',
        await this.options.executor.executeContractCall(this.contract, 'authority'),
      );
      const getCanWrite = async (property, type) => {
        const enumType = type === 'array' ? PropertyType.ListEntry : PropertyType.Entry;
        return this.options.executor.executeContractCall(
          authority,
          'canCallOperation',
          accountId,
          '0x0000000000000000000000000000000000000000',
          this.options.rightsAndRoles.getOperationCapabilityHash(
            property, enumType, ModificationType.Set),
        );
      };
      const tasks = Object.keys(description.dataSchema).map(property => async () => {
        if (property === 'type') {
          // do not list type property
          return;
        }
        if (await getCanWrite(property, description.dataSchema[property].type)) {
          readWrite.push(property);
        } else if (sharings[sha3(accountId)] && sharings[sha3(accountId)][sha3(property)]) {
          read.push(property);
        }
      });
      await Throttle.all(tasks);
    }
    if (read.length) {
      result.read = read;
    }
    if (readWrite.length) {
      result.readWrite = readWrite;
    }
    return result;
  }

  /**
   * Check permissions for all members and return them as array of ContainerShareConfig.
   */
  public async getContainerShareConfigs(): Promise<ContainerShareConfig[]> {
    await this.ensureContract();
    const roleMap = await this.options.rightsAndRoles.getMembers(this.contract);
    const unique = Array.from(new Set([].concat(...Object.values(roleMap))));
    return Throttle.all(unique.map(accountId => async () =>
      this.getContainerShareConfigForAccount(accountId)));
  }

  /**
   * Gets the owner account id.
   */
  public async getOwner(): Promise<string> {
    const authContract = this.options.contractLoader.loadContract(
      'DSAuth',
      await this.getContractAddress()
    );

    return await this.options.executor.executeContractCall(authContract, 'owner')
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

  removeProperty() {
    
  }

  /**
   * Takes a full share configuration for a accountId (or a list of them), share newly added
   * properties and unshare removed properties from the container. Also accepts a list / instance of
   * the original sharing configurations duplicated loading can be avoided.
   *
   * @param      {ContainerShareConfig[]}  newConfigs       sharing configurations that should be
   *                                                        persisted
   * @param      {ContainerShareConfig[]}  originalConfigs  pass original share configurations, for
   *                                                        that the sharing delta should be built
   *                                                        (reduces load time)
   */
  async setContainerShareConfigs(
    newConfigs: ContainerShareConfig | ContainerShareConfig[],
    originalConfigs?: ContainerShareConfig | ContainerShareConfig[]
  ) {
    // collect all users that properties should be shared / unshared
    const shareConfigs: Array<ContainerShareConfig> = [ ];
    const unshareConfigs: Array<ContainerShareConfig> = [ ];

    // ensure working with arrays
    if (!Array.isArray(newConfigs)) {
      newConfigs = [ newConfigs ];
    }
    if (!Array.isArray(originalConfigs)) {
      originalConfigs = originalConfigs ? [ originalConfigs ] : [ ];
    }

    // iterate through all configurations and check for sharing updates
    Promise.all((newConfigs).map(async (newConfig: ContainerShareConfig) => {
      // objects to store sharing configuration delta (accountId, read, readWrite, removeListEntries)
      const shareConfig: ContainerShareConfig = { accountId: newConfig.accountId };
      const unshareConfig: ContainerShareConfig = { accountId: newConfig.accountId };
      let originalConfig = (originalConfigs as ContainerShareConfig[])
        .filter(orgConf => orgConf.accountId === newConfig.accountId)[0];

      // load latest share configuration to buil delta against
      if (!originalConfig) {
        originalConfig = await this.getContainerShareConfigForAccount(newConfig.accountId);
      }

      // fill empty sharing types, so further checks will be easier
      const shareConfigProperties = [ 'read', 'readWrite', 'removeListEntries' ];
      shareConfigProperties.forEach(type => {
        newConfig[type] = newConfig[type] || [ ];
        originalConfig[type] = originalConfig[type] || [ ];
        shareConfig[type] = shareConfig[type] || [ ];
        unshareConfig[type] = unshareConfig[type] || [ ];
      });

      // iterate through all share config properties and detect changes
      shareConfigProperties.forEach(type => {
        // track new properties that should be shared
        newConfig[type].forEach(property => {
          if (originalConfig[type].indexOf(property) === -1) {
            shareConfig[type].push(property);
          }
        });
        // track properties that should be unshared
        originalConfig[type].forEach(property => {
          if (newConfig[type].indexOf(property) === -1) {
            unshareConfig[type].push(property);
          }
        });
      });

      // transform unshare read permissions to readWrite permissions
      unshareConfig.readWrite = unshareConfig.readWrite.concat(unshareConfig.read);
      delete unshareConfig.read;

      // apply them to the share configs arrays, so they can be processed afterwards
      shareConfigs.push(shareConfig);
      unshareConfigs.push(unshareConfig);
    }));

    // apply new sharings
    await this.shareProperties(shareConfigs);
    await this.unshareProperties(unshareConfigs]);
  }

  /**
   * Write given description to containers DBCP.
   *
   * @param      {any}  description  description (public part)
   */
  public async setDescription(description: any): Promise<void> {
    await this.ensureContract();
    await this.wrapPromise(
      'set description',
      this.options.description.setDescription(
        this.contract.options.address, { public: description }, this.config.accountId),
    );
  }

  /**
   * Set a value for an entry.
   *
   * @param      {string}  entryName  name of an entry in the container
   * @param      {any}     value      value to set
   */
  public async setEntry(entryName: string, value: any, updateDescription = true): Promise<void> {
    await this.ensureContract();
    if (updateDescription) {
      await this.ensureProperty(entryName, this.deriveSchema(value), 'entry');
    }
    const toSet = await this.encryptFilesIfRequired(entryName, value);
    await this.wrapPromise(
      'set entry',
      this.options.dataContract.setEntry(this.contract, entryName, toSet, this.config.accountId),
    );
  }

  /**
   * Share entry/list to another user; this handles role permissions, role memberships.
   *
   * @param      {ContainerShareConfig[]}  shareConfigs  list of share configs
   */
  public async shareProperties(shareConfigs: ContainerShareConfig[]): Promise<void> {
    await this.ensureContract();
    ///////////////////////////////////////////////////////////////////////////// check requirements
    // check ownership
    const authority = this.options.contractLoader.loadContract(
      'DSRolesPerContract',
      await this.options.executor.executeContractCall(this.contract, 'authority'),
    );
    if (!await this.options.executor.executeContractCall(
        authority, 'hasUserRole', this.config.accountId, 0)) {
      throw new Error(`current account "${this.config.accountId}" is unable to share properties, ` +
        `as it isn't owner of the underlying contract "${this.contract.options.address}"`);
    }

    // check fields
    const localShareConfig = cloneDeep(shareConfigs);
    const schemaProperties = (await this.toPlugin(false)).template.properties;
    const sharedProperties = Array.from(
      new Set([].concat(...localShareConfig.map(shareConfig => [].concat(
        shareConfig.read, shareConfig.readWrite)))))
      .filter(property => property !== undefined);
    const missingProperties = sharedProperties
      .filter(property => !schemaProperties.hasOwnProperty(property));
    if (missingProperties.length) {
      throw new Error(
        `tried to share properties, but missing one or more in schema: ${missingProperties}`);
    }
    // for all share configs
    for (let { accountId, read = [], readWrite = [], removeListEntries = [] } of localShareConfig) {
      //////////////////////////////////////////////////// ensure that account is member in contract
      if (! await this.options.executor.executeContractCall(
          this.contract, 'isConsumer', accountId)) {
        await this.options.dataContract.inviteToContract(
          null, this.contract.options.address, this.config.accountId, accountId);
      }

      ///////////////////////////////////////////////////////// ensure property roles and membership
      // share type every time as it is mandatory
      if (!read.includes('type')) {
        read.push('type');
      }
      // ensure that roles for fields exist and that accounts have permissions
      for (let property of readWrite) {
        // get permissions from contract
        const hash = this.options.rightsAndRoles.getOperationCapabilityHash(
          property,
          getPropertyType(schemaProperties[property].type),
          ModificationType.Set,
        );
        const rolesMap = await this.options.executor.executeContractCall(
          authority,
          'getOperationCapabilityRoles',
          '0x0000000000000000000000000000000000000000',
          hash,
        );
        const binary = (new BigNumber(rolesMap)).toString(2);
        // search for role with permissions
        let permittedRole = [...binary].reverse().join('').indexOf('1');
        if (permittedRole < this.reservedRoles) {
          // if not found or included in reserved roles, add new role
          const roleCount = await this.options.executor.executeContractCall(authority, 'roleCount');
          if (roleCount >= 256) {
            throw new Error(`could not share property "${property}", maximum role count reached`);
          }
          permittedRole = Math.max(this.reservedRoles, roleCount);
          await this.options.rightsAndRoles.setOperationPermission(
            authority,
            this.config.accountId,
            permittedRole,
            property,
            getPropertyType(schemaProperties[property].type),
            ModificationType.Set,
            true,
          );
        }

        // ensure that account has role
        const hasRole = await this.options.executor.executeContractCall(
          authority, 'hasUserRole', accountId, permittedRole);
        if (!hasRole) {
          await this.options.rightsAndRoles.addAccountToRole(
            this.contract, this.config.accountId, accountId, permittedRole);
        }
      }


      for (let property of removeListEntries) {
        const propertyType = getPropertyType(schemaProperties[property].type);

        // throw error if remove should be given on no list
        if (propertyType !== PropertyType.ListEntry) {
          throw new Error(`property "${property}" is no list. Can not give remove rights`);
        }

        // get permissions from contract
        const hash = this.options.rightsAndRoles.getOperationCapabilityHash(
          property,
          propertyType,
          ModificationType.Remove,
        );
        const rolesMap = await this.options.executor.executeContractCall(
          authority,
          'getOperationCapabilityRoles',
          '0x0000000000000000000000000000000000000000',
          hash,
        );
        const binary = (new BigNumber(rolesMap)).toString(2);
        // search for role with permissions
        let permittedRole = [...binary].reverse().join('').indexOf('1');
        if (permittedRole < this.reservedRoles) {
          // if not found or included in reserved roles, add new role
          const roleCount = await this.options.executor.executeContractCall(authority, 'roleCount');
          if (roleCount >= 256) {
            throw new Error(`could not share property "${property}", maximum role count reached`);
          }
          permittedRole = Math.max(this.reservedRoles, roleCount);
          await this.options.rightsAndRoles.setOperationPermission(
            authority,
            this.config.accountId,
            permittedRole,
            property,
            propertyType,
            ModificationType.Remove,
            true,
          );
        }

        // ensure that account has role
        const hasRole = await this.options.executor.executeContractCall(
          authority, 'hasUserRole', accountId, permittedRole);
        if (!hasRole) {
          await this.options.rightsAndRoles.addAccountToRole(
            this.contract, this.config.accountId, accountId, permittedRole);
        }
      }

      // ensure that content keys were created for all shared properties
      await Promise.all([...read, ...readWrite].map(
        property => this.ensureKeyInSharing(property)
      ));

      //////////////////////////////////////////////////////// ensure encryption keys for properties
      // run with mutex to prevent breaking sharing info
      await this.getMutex('sharing').runExclusive(async () => {
        // checkout sharings
        const sharings = await this.options.sharing.getSharingsFromContract(this.contract);

        // check if account already has a hash key
        const sha3 = (...args) => this.options.nameResolver.soliditySha3(...args);
        const isShared = (section, block?) => {
          if (!sharings[sha3(accountId)] ||
              !sharings[sha3(accountId)][sha3(section)] ||
              (typeof block !== 'undefined' && !sharings[sha3(accountId)][sha3(section)][block])) {
            return false;
          }
          return true;
        };
        let modified = false;
        if (!isShared('*', 'hashKey')) {
          const hashKeyToShare = await this.options.sharing.getHashKey(
            this.contract.options.address, this.config.accountId);
          await this.options.sharing.extendSharings(
            sharings, this.config.accountId, accountId, '*', 'hashKey', hashKeyToShare, null);
          modified = true;
        }

        // ensure that target user has sharings for properties
        const blockNr = await this.options.web3.eth.getBlockNumber();
        // share keys for read and readWrite
        for (let property of [...read, ...readWrite]) {
          if (!isShared(property)) {
            // get key
            const contentKey = await this.options.sharing.getKey(
              this.contract.options.address, this.config.accountId, property, blockNr);
            // share this key
            await this.options.sharing.extendSharings(
              sharings, this.config.accountId, accountId, property, 0, contentKey);
            modified = true;
          }
        }
        if (modified) {
          // store sharings
          await this.options.sharing.saveSharingsToContract(
            this.contract.options.address, sharings, this.config.accountId);
        }
      });
    }
  }

  /**
   * Store data to a container. This allows to
   * - store data into already existing entries and/or list entries
   * - implicitely create new entries and/or list entries (the same logic for deciding on their type
   *   is applied as in `setEntry`/`addListEntries` is applied here)
   * - in case of entries, their value is overwritten
   * - in case of list entries, given values are added to the list
   *
   * @param      {any}  data      object with keys, that are names of lists or entries and values,
   *                              that are the values to store to them
   * @return     {Promise<void>}  resolved when done
   */
  public async storeData(data: { [id: string]: any }): Promise<void> {
    await this.ensureContract();

    // fetch description, for checking types
    const description = await this.getDescription();

    // create a task function for each field
    const tasks = Object.keys(data).map((property) => async () => {
      let type;
      if (description.dataSchema && description.dataSchema[property]) {
        type = description.dataSchema[property].type;
      } else {
        type = this.deriveSchema(data[property]).type;
      }
      // add field or entry, based on property type
      await (type === 'array' ?
        this.addListEntries(property, data[property]) :
        this.setEntry(property, data[property])
      );
    });

    await Throttle.all(tasks);
  }

  /**
   * Export current container state as plugin.
   *
   * @param      {boolean}  getValues  export entry values or not (list entries are always excluded)
   */
  public async toPlugin(getValues = false): Promise<ContainerPlugin> {
    await this.ensureContract();

    // fetch description, add fields from data schema
    const description = await this.getDescription();

    // create empty plugin
    const template: Partial<ContainerTemplate> = {
      properties: { }
    };
    const plugin: ContainerPlugin = {
      description,
      template: template as ContainerTemplate
    };

    // if values should be loaded, load permissions first, so we won't load unreadable data
    let readableEntries;
    if (getValues) {
      const containerShareConfig = await this.getContainerShareConfigForAccount(
        this.config.accountId
      );

      readableEntries = [ ].concat(
        containerShareConfig.read || [],
        containerShareConfig.readWrite || [ ]
      );
    }

    if (description.dataSchema) {
      const authority = this.options.contractLoader.loadContract(
        'DSRolesPerContract',
        await this.options.executor.executeContractCall(this.contract, 'authority'),
      );
      for (let property of Object.keys(description.dataSchema)) {
        if (property === 'type') {
          continue;
        }
        const dataSchema = description.dataSchema[property];
        const type = dataSchema.type === 'array' ? 'list' : 'entry';
        template.properties[property] = {
          dataSchema,
          permissions: {},
          type,
        };
        // only load values for entries (if it's an array and the items are type of encrypted files,
        // it's also an entry)
        if (getValues && dataSchema.type !== 'array') {
          if (readableEntries.indexOf(property) !== -1) {
            let value;
            try {
              value = await this.getEntry(property);
            } catch (ex) {
              this.log(`Could not load value for entry ${ property } in toPlugin:
                ${ ex.message }`, 'error');
            }

            if (value &&
                value !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
              template.properties[property].value = value;
            }
          }
        }
        template.properties[property].permissions =
          await this.getRolePermission(authority, property, type);
      }
    }
    // write type value to template property
    template.type = await this.getEntry('type');

    return plugin;
  }

  /**
   * Remove keys and/or permissions for a user; this also handles role permissions, role
   * memberships.
   *
   * @param      {ContainerUnshareConfig[]}  unshareConfigs  list of account-field setups to remove
   *                                                         permissions/keys for
   */
  public async unshareProperties(unshareConfigs: ContainerUnshareConfig[]): Promise<void> {
    await this.ensureContract();
    this.log(`unsharing properties`, 'debug');
    ///////////////////////////////////////////////////////////////////////////// check requirements
    // check ownership
    const authority = this.options.contractLoader.loadContract(
      'DSRolesPerContract',
      await this.options.executor.executeContractCall(this.contract, 'authority'),
    );
    if (!await this.options.executor.executeContractCall(
      authority, 'hasUserRole', this.config.accountId, 0)) {
      throw new Error(`current account "${this.config.accountId}" is unable to unshare ` +
        'properties, as it isn\'t owner of the underlying contract ' +
        this.contract.options.address);
    }

    // check fields
    const localUnshareConfigs = cloneDeep(unshareConfigs);
    const schemaProperties = (await this.toPlugin(false)).template.properties;
    const sharedProperties = Array.from(
      new Set([].concat(...localUnshareConfigs.map(unshareConfig => [].concat(
        unshareConfig.write, unshareConfig.readWrite)))))
      .filter(property => property !== undefined);
    const missingProperties = sharedProperties
      .filter(property => !schemaProperties.hasOwnProperty(property));
    if (missingProperties.length) {
      throw new Error(
        `tried to share properties, but missing one or more in schema: ${missingProperties}`);
    }
    // for all share configs
    for (let { accountId, readWrite = [], removeListEntries = [], write = [] } of localUnshareConfigs) {
      this.log(`checking unshare configs`, 'debug');
      // remove write permissions for all in readWrite and write
      for (let property of [...readWrite, ...write]) {
        this.log(`removing write permissions for ${property}`, 'debug');
        const propertyType = getPropertyType(schemaProperties[property].type);
        // search for role with permissions
        let permittedRole = await this.getPermittedRole(
          authority, property, propertyType, ModificationType.Set);
        if (permittedRole < this.reservedRoles) {
          // if not found or included in reserved roles, exit
          this.log('can not find a role that has write permissions for property ' + property);
        } else {
          // remove account from role
          const hasRole = await this.options.executor.executeContractCall(
            authority, 'hasUserRole', accountId, permittedRole);
          if (hasRole) {
            await this.options.rightsAndRoles.removeAccountFromRole(
              this.contract, this.config.accountId, accountId, permittedRole);
          }

          // if no members are left, remove role
          const memberCount = await this.options.executor.executeContractCall(
            authority, 'role2userCount', permittedRole);
          if (memberCount.eq(0)) {
            this.log(`removing role for property "${property}"`, 'debug')
            await this.options.rightsAndRoles.setOperationPermission(
              authority,
              this.config.accountId,
              permittedRole,
              property,
              getPropertyType(schemaProperties[property].type),
              ModificationType.Set,
              false,
            );
          }
        }
      }

      /////////////////////// check if only remaining property is 'type', cleanup if that's the case
      const shareConfig = await this.getContainerShareConfigForAccount(accountId);
      const remainingFields = Array.from(new Set([
        ...(shareConfig.read ? shareConfig.read : []),
        ...(shareConfig.readWrite ? shareConfig.readWrite : []),
      ]));
      if (remainingFields.length === 1 && remainingFields[0] === 'type') {
        // remove property
        let permittedRole = await this.getPermittedRole(
          authority, 'type', PropertyType.Entry, ModificationType.Set);
        await this.options.rightsAndRoles.removeAccountFromRole(
          this.contract, this.config.accountId, accountId, permittedRole);

        // remove read if applicable
        readWrite.push('type');

        // uninvite
        this.options.dataContract.removeFromContract(
          null, await this.getContractAddress(), this.config.accountId, accountId);
      }

      ///////////////////////////////////////////////////////////////// remove list entries handling
      for (let property of removeListEntries) {
        const propertyType = getPropertyType(schemaProperties[property].type);

        // throw error if remove should be given on no list
        if (propertyType !== PropertyType.ListEntry) {
          throw new Error(`property "${property}" is no list. Can not give remove rights`);
        }

        // search for role with permissions
        let permittedRole = await this.getPermittedRole(
          authority, property, propertyType, ModificationType.Remove);
        if (permittedRole < this.reservedRoles) {
          // if not found or included in reserved roles, exit
          throw new Error(`can not find a role that has remove permissions for list "${property}"`);
        }

        // remove account from role
        const hasRole = await this.options.executor.executeContractCall(
          authority, 'hasUserRole', accountId, permittedRole);
        if (hasRole) {
          await this.options.rightsAndRoles.removeAccountFromRole(
            this.contract, this.config.accountId, accountId, permittedRole);
        }

        // if no members are left, remove role
        const memberCount = await this.options.executor.executeContractCall(
          authority, 'role2userCount', permittedRole);
        if (memberCount.eq(0)) {
          await this.options.rightsAndRoles.setOperationPermission(
            authority,
            this.config.accountId,
            permittedRole,
            property,
            getPropertyType(schemaProperties[property].type),
            ModificationType.Set,
            false,
          );
        }
      }

      //////////////////////////////////////////////////////// ensure encryption keys for properties
      // run with mutex to prevent breaking sharing info
      await this.getMutex('sharing').runExclusive(async () => {
        this.log(`checking read permisssions`, 'debug');
        // checkout sharings
        const sharings = await this.options.sharing.getSharingsFromContract(this.contract);

        // check if account already has a hash key
        const sha3 = (...args) => this.options.nameResolver.soliditySha3(...args);
        const isShared = (section, block?) => {
          if (!sharings[sha3(accountId)] ||
              !sharings[sha3(accountId)][sha3(section)] ||
              (typeof block !== 'undefined' && !sharings[sha3(accountId)][sha3(section)][block])) {
            return false;
          }
          return true;
        };
        let modified = false;

        // remove keys for readWrite
        for (let property of readWrite) {
          this.log(`checking read permissions for ${property}`, 'debug');
          if (isShared(property)) {
            this.log(`removing key for ${property}`, 'debug');
            await this.options.sharing.trimSharings(sharings, accountId, property);
            modified = true;
          }
        }
        // cleanup sharings, this relies on a few conditions,
        // that are met, when sharings are managed by Container API
        if (sharings[sha3(accountId)] &&  // account has any sharing
          Object.keys(sharings[sha3(accountId)]).length === 2 &&  // only 2 sections remain
          sharings[sha3(accountId)][sha3('*')] &&  // * section remains
          Object.keys(sharings[sha3(accountId)][sha3('*')]).length === 1 && // only 1 entry in *
          sharings[sha3(accountId)][sha3('*')].hashKey &&  // only the hash key in *
          sharings[sha3(accountId)][sha3('type')]) {  // type remains
          this.log(`account from sharings`, 'debug');
          await this.options.sharing.trimSharings(sharings, accountId);
          modified = true;
        }

        if (modified) {
          this.log(`sharings updated, saving sharings`, 'debug');
          // store sharings
          await this.options.sharing.saveSharingsToContract(
            this.contract.options.address, sharings, this.config.accountId);
        }

        // inner mutex, as we also rely on sharings
        await this.getMutex('description').runExclusive(async () => {
          // check if field still exists in updated sharing, if not remove field schema
          const description = await this.getDescription();
          const propertyHashes = [];
          for (let accountHash of Object.keys(sharings)) {
            propertyHashes.push(...Object.keys(sharings[accountHash]));
          }
          modified = false;
          for (let property of readWrite) {
            if (!propertyHashes.includes(this.options.nameResolver.soliditySha3(property))) {
              delete description.dataSchema[property];
              modified = true;
            }
          }
          if (modified) {
            await this.setDescription(description);
          }
        });
      });
    }
  }

  /**
   * Helper function for encrypting and decrypting, checks if a given property requires file
   * encryption.
   *
   * @param      {any}       subSchema  schema to check in
   * @param      {any}       toInspect  value to inspect
   * @param      {Function}  toApply    function, that will be applied to values in `toInspect`
   */
  private async applyIfEncrypted(subSchema: any, toInspect: any, toApply: Function) {
    if (this.isEncryptedFile(subSchema)) {
      // simple entry
      return toApply(toInspect);
    } else if (subSchema.type === 'array' && this.isEncryptedFile(subSchema.items)) {
      // list/array with entries
      return Promise.all(toInspect.map(entry => toApply(entry)));
    } else {
      // check if nested
      if (subSchema.type === 'array') {
        return Promise.all(toInspect.map(entry => this.applyIfEncrypted(
          subSchema.items, entry, toApply)));
      } else if (subSchema.type === 'object') {
        // check objects subproperties
        const transformed = {};
        for (let key of Object.keys(toInspect)) {
          // traverse further, if suproperties are defined
          if (subSchema.properties && subSchema.properties[key]) {
            // if included in schema, drill down
            transformed[key] = await this.applyIfEncrypted(
              subSchema.properties[key], toInspect[key], toApply);
          } else {
            // if not in schema, just copy
            transformed[key] = toInspect[key];
          }
        }
        return transformed;
      }
      // no encryption required
      return toInspect;
    }
  }

  /**
   * checks if given property is a `ContainerFile` object and decrypts in that case
   *
   * @param      {string}  entryName  name of the property
   * @param      {any}     value      (raw) value to analyze
   */
  private async decryptFilesIfRequired(propertyName: string, value: any): Promise<ContainerFile[]> {
    if (value === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      return value;
    }
    let result = value;
    const description = await this.getDescription();
    if (!description.dataSchema || !description.dataSchema[propertyName]) {
      throw new Error(`could not find description for entry "${propertyName}"`);
    }
    const decrypt = async (toEncrypt) => {
      const encryptedFiles = await Throttle.all(toEncrypt.files.map(file => async () => {
        try {
          JSON.parse(file);
        } catch (ex) {
          this.log(`can't validate file ${file}, no valid JSON`, 'error');
          return null;
        }
        const decrypted = await this.options.dataContract.decrypt(
          file,
          this.contract,
          this.config.accountId,
          propertyName,
        );

        return decrypted.private;
      }));

      return { files: encryptedFiles.filter((f) => f !== null) };
    };
    result = await this.applyIfEncrypted(description.dataSchema[propertyName], value, decrypt);

    return result;
  }

  /**
   * create ajv schema (without $id value) by analyzing value
   *
   * @param      {any}    value    value to analyze
   * @param      {any[]}  visited  (optional) not intended for direct use, visited nodes for
   *                               recursion
   * @return     {any}    ajv schema
   */
  private deriveSchema(value: any, visited: any = []): any {
    if (visited.includes(value)) {
      throw new Error('could not derive type of value; cyclic references detected');
    }
    let schema;
    let type = typeof value;
    if (['boolean', 'number', 'string'].includes(type)) {
      schema = { type };
    } else if (type === 'object') {
      if (Array.isArray(value)) {
        schema = { type: 'array' };
        if (value.length) {
          schema.items = this.deriveSchema(value[0], visited.concat([value]));
        }
      } else {
        schema = { type: 'object' };
      }
    }
    return schema;
  }

  /**
   * checks if given property is a `ContainerFile` array and encrypts in that case
   *
   * @param      {string}             propertyName  name of the property
   * @param      {ContainerFile|any}  value         value to encrypt (if required)
   */
  private async encryptFilesIfRequired(
    propertyName: string,
    value: ContainerFile[]|any,
  ): Promise<any> {
    let result = value;
    const description = await this.getDescription();
    if (!description.dataSchema || !description.dataSchema[propertyName]) {
      throw new Error(`could not find description for entry "${propertyName}"`);
    }

    // encrypt files and map them into the correct object format
    const blockNr = await this.options.web3.eth.getBlockNumber();
    const encrypt = async (toEncrypt) => {
      const encryptedFiles = await Throttle.all(toEncrypt.files.map(file => async () =>
        this.options.dataContract.encrypt(
          { private: file },
          this.contract,
          this.config.accountId,
          propertyName,
          blockNr,
          'aesBlob',
        )
      ));

      return { files: encryptedFiles };
    };

    // check for encrypted files
    result = await this.applyIfEncrypted(description.dataSchema[propertyName], value, encrypt);

    return result;
  }

  /**
   * Check if container contract already has been loaded, load from address / ENS if required.
   */
  private async ensureContract(): Promise<void> {
    if (this.contract) {
      return;
    }
    checkConfigProperties(this.config, ['address']);
    let address = this.config.address.startsWith('0x') ?
      this.config.address : await this.options.nameResolver.getAddress(this.config.address);
    this.contract = this.options.contractLoader.loadContract('DataContract', address)
  }

  /**
   * ensure that current account has a key for given entry in sharings
   *
   * @param      {string}  entryName  name of an entry to ensure a key for
   */
  private async ensureKeyInSharing(entryName: string): Promise<void> {
    let key = await this.options.sharing.getKey(
      this.contract.options.address, this.config.accountId, entryName);
    if (!key) {
      const cryptor = this.options.cryptoProvider.getCryptorByCryptoAlgo('aes');
      key = await cryptor.generateKey();
      await this.getMutex('sharing').runExclusive(async () => {
        // clear cache to remove failed key request
        this.options.sharing.clearCache();
        this.options.dataContract.clearSharingCache();
        await this.options.sharing.addSharing(
          this.contract.options.address,
          this.config.accountId,
          this.config.accountId,
          entryName,
          0,
          key,
        );
      });
    }
  }

  /**
   * ensure, that current user has permission to set values on given property; note that this
   * function is for internal use in `Container` and skips a check to verify, that given account is
   * in specified role; used out of context, this may check check if an account has permissions on a
   * field and add then adds this account to an unrelated role, therefore not granting permissions
   * on checked field
   *
   * @param      {string}  name       name of the property to ensure permission for
   * @param      {string}  type       type of property ('entry'/'list')
   * @param      {string}  accountId  (optional) accountId to ensure permission for, defaults to
   *                                  account from container config (active account)
   * @param      {number}  role       (optional) role id, defaults to 0
   */
  private async ensurePermissionOnField(
    name: string,
    type: string,
    accountId = this.config.accountId,
    role = 0,
  ): Promise<void> {
    // ensure entry is writable by current account
    const authority = this.options.contractLoader.loadContract(
      'DSRolesPerContract',
      await this.options.executor.executeContractCall(this.contract, 'authority'),
    );
    const enumType = getPropertyType(type);
    let canSetField = await this.options.executor.executeContractCall(
      authority,
      'canCallOperation',
      accountId,
      '0x0000000000000000000000000000000000000000',
      this.options.rightsAndRoles.getOperationCapabilityHash(name, enumType, ModificationType.Set),
    );
    if (!canSetField) {
      this.log(`adding permissions on ${type} "${name}" for role ${role} to enable account ` +
        `"${accountId}" on container "${this.contract.address}"`, 'debug');
      await this.options.rightsAndRoles.setOperationPermission(
        this.contract,
        this.config.accountId,
        role,
        name,
        enumType,
        ModificationType.Set,
        true,
      );
    }
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
   * get hash for operation permission, this creates the hashes, that are used in
   * `DSRolesPerContract` to check operation capabilities
   *
   * @param      {string}  name       property name
   * @param      {string}  type       'entry' or 'list'
   * @param      {string}  operation  'set' or 'remove'
   * @return     {string}  bytes32 hash as string
   */
  private getOperationHash(name: string, type: string, operation = 'set'): string {
    const keccak256 = this.options.web3.utils.soliditySha3;
    const label = type === 'entry' ?
      '0x84f3db82fb6cd291ed32c6f64f7f5eda656bda516d17c6bc146631a1f05a1833' : // entry
      '0x7da2a80303fd8a8b312bb0f3403e22702ece25aa85a5e213371a770a74a50106';  // list entry
    let operationHash;
    if (operation === 'set') {
      operationHash = '0xd2f67e6aeaad1ab7487a680eb9d3363a597afa7a3de33fa9bf3ae6edcb88435d';
    } else if (operation === 'remove') {
      operationHash = '0x8dd27a19ebb249760a6490a8d33442a54b5c3c8504068964b74388bfe83458be';
    }
    return keccak256(keccak256(label, keccak256(name)), operationHash);
  }

  private async getPermittedRole(
    authority: any, property: string, propertyType: PropertyType, modificationType: ModificationType
  ): Promise<number> {
    // get permissions from contract
    const hash = this.options.rightsAndRoles.getOperationCapabilityHash(
      property,
      propertyType,
      modificationType,
    );
    const rolesMap = await this.options.executor.executeContractCall(
      authority,
      'getOperationCapabilityRoles',
      '0x0000000000000000000000000000000000000000',
      hash,
    );
    // search for role with permissions
    // build string with all roles and 1/0 depending on permissions
    const binary = (new BigNumber(rolesMap)).toString(2);
    // check index in group list, ignore reserved roles for this
    let index = [...binary.substr(0, binary.length - this.reservedRoles)]
      .reverse().join('').indexOf('1');
    // if group was found, re-apply reserved roles count, result is group with permission
    const permittedRole = (index === -1) ? index : (index + this.reservedRoles);

    return permittedRole;
  }

  /**
   * get role permission for given property and type from authority contract
   *
   * @param      {any}     authorityContract  `DSRolesPerContract` instance
   * @param      {string}  property           property name
   * @param      {string}  type               'entry' or 'list'
   */
  private async getRolePermission(authorityContract: any, property: string, type: string
  ): Promise<any> {
    const permissions = {};
    for (let operation of ['set', 'remove']) {
      const rolesMap = await this.options.executor.executeContractCall(
        authorityContract,
        'getOperationCapabilityRoles',
        this.config.address,
        this.options.rightsAndRoles.getOperationCapabilityHash(
          property, getPropertyType(type), getModificationType(operation)),
      );
      // iterates over all roles and checks which roles are included
      const checkNumber = (bnum) => {
        const results = [];
        for (let i = 0; i < 256; i++) {
          const divisor = (new BigNumber(2)).pow(i);
          if (divisor.gt(bnum)) {
            break;
          }
          results.push(parseInt(bnum.dividedToIntegerBy(divisor).mod(2).toString(), 10));
        }
        return results;
      };
      // format output
      const roleMap = checkNumber(new BigNumber(rolesMap));
      roleMap.forEach((value, i) => {
        if (value) {
          if (!permissions[i])  {
            permissions[i] = [];
          }
          permissions[i].push(operation);
        }
      });
    }
    return permissions;
  }

  /**
   * Checks a ajv data schema is type of encrypted files.
   *
   * @param      {any}      schema  ajv data sub schema
   * @return     {boolean}  True if encrypted file, False otherwise
   */
  private isEncryptedFile(schema): boolean {
    if (schema.type === 'object' && schema.$comment) {
      try {
        return !!JSON.parse(schema.$comment).isEncryptedFile;
      } catch (ex) {
        // ignore non-JSON comments
      }
    }

    return false;
  }

  /**
   * wrap try, catch around promise and throw error with message if rejected
   *
   * @param      {string}      task     name of a task, is included in error message
   * @param      {Promise<any>}  promise  promise to await
   */
  private async wrapPromise(task: string, promise: Promise<any>): Promise<any> {
    try {
      return await promise;
    } catch (ex) {
      throw new Error(`could not ${task}; ${ex.message || ex}; ${ex.stack}`);
    }
  }
}

/**
 * Apply template to data contract; this should be used with caution and is intended to only be
 * used on new contract (e.g. in `create` and `clone`).
 *
 * @param      {ContainerOptions}  options   runtime for new `Container`
 * @param      {ContainerConfig}   config    config for new container
 * @param      {any}               contract  `DataContract` instance
 */
async function applyPlugin(
  options: ContainerOptions,
  config: ContainerConfig,
  container: Container,
  envelope: Envelope,
): Promise<Envelope> {
  // use default template if omitted, get template properties
  let plugin;
  if (typeof config.plugin === 'undefined' || typeof config.plugin === 'string') {
    plugin = Container.plugins[config.plugin as string || Container.defaultPlugin];
  } else {
    plugin = config.plugin;
  }

  // add type property
  const properties = cloneDeep(plugin.template.properties);
  if (!properties.type) {
    properties.type = {
      dataSchema: { $id: 'type_schema', type: 'string' },
      type: 'entry',
      permissions: {
        0: ['set']
      },
      value: plugin.template.type,
    };
  }

  const permissionUpdates = {
    roles: [],
    operations: [],
  };
  const propertyNames = Object.keys(properties);
  for (let propertyName of propertyNames) {
    const property: ContainerTemplateProperty = properties[propertyName];
    for (let role of Object.keys(property.permissions)) {
      for (let modification of property.permissions[role]) {
        permissionUpdates.roles.push(parseInt(role, 10));
        permissionUpdates.operations.push(options.rightsAndRoles.getOperationCapabilityHash(
          propertyName,
          getPropertyType(property.type),
          getModificationType(modification),
        ));
      }
    }

    // build schema in description (envelopes "public" property)
    await container.ensureTypeInSchema(propertyName, property.dataSchema, envelope.public);
  }

  const dsAuth = options.contractLoader.loadContract('DSAuth', await container.getContractAddress());
  const dsRolesAddress = await options.executor.executeContractCall(dsAuth, 'authority');
  const dsRolesContract = options.contractLoader.loadContract('DSRolesPerContract', dsRolesAddress);

  await options.executor.executeContractTransaction(
    dsRolesContract,
    'setRoleOperationCapabilities',
    { from: config.accountId },
    permissionUpdates.roles,
    permissionUpdates.operations,
    true,
  );

  // write description
  await options.description.setDescription(
    await container.getContractAddress(),
    envelope,
    config.accountId,
  );

  // write sharings to contract
  await generateSharings(
    options, await container.getContractAddress(), config.accountId, propertyNames);

  // set values after desription has been set
  const tasks = [];
  for (let propertyName of propertyNames) {
    const property: ContainerTemplateProperty = properties[propertyName];
    if (property.hasOwnProperty('value')) {
      tasks.push(async () => container.setEntry(propertyName, property.value, false));
    }
  }
  await Throttle.all(tasks);

  return envelope;
}

/**
 * Check, that given subset of properties is present at config, collections missing properties and
 * throws a single error.
 *
 * @param      {ContainerConfig}  config      config for container instance
 * @param      {string}           properties  list of property names, that should be present
 */
function checkConfigProperties(config: ContainerConfig, properties: string[]): void {
  let missing = properties.filter(property => !config.hasOwnProperty(property));
  if (missing.length === 1) {
    throw new Error(`missing property in config: "${missing[0]}"`);
  } else if (missing.length > 1) {
    throw new Error(`missing properties in config: "${missing.join(', ')}"`);
  }
}

/**
 * Generates keys and sharings for given fields, used when creating new containers. This will store
 * new sharings at given contract.
 *
 * @param      {any}       runtime          initialized runtime
 * @param      {string}    contractAddress  contract to generate sharings for
 * @param      {string}    accountId        executing account (contract owner)
 * @param      {string[]}  fields           fields to generate keys for
 */
async function generateSharings(
  runtime: any, contractAddress: string, accountId: string, fields: string[]
) {
  // get current sharing
  const sharings = {};

  // get block number and keys for sharing
  const cryptor = runtime.cryptoProvider.getCryptorByCryptoAlgo('aes');
  const keys = await Promise.all([
    ...[...Array(fields.length + 1)].map(async () => cryptor.generateKey()),
  ]);

  // add hash key
  const tasks = [];
  tasks.push(async () =>
    runtime.sharing.extendSharings(
      sharings, accountId, accountId, '*', 'hashKey', keys[keys.length - 1], null)
  );

  for (let i = 0; i < fields.length; i++) {
    tasks.push(async () =>
      runtime.sharing.extendSharings(
        sharings, accountId, accountId, fields[i], 0, keys[i])
    );
  }

  await Throttle.all(tasks);

  // save modifications
  await runtime.sharing.saveSharingsToContract(contractAddress, sharings, accountId);
}

/**
 * Converts 'remove'/'set' to rights and roles enum type, throws if invalid.
 *
 * @param      {string}            typeName  remove/set
 * @return     {ModificationType}  enum value from `RightsAndRoles`
 */
function getModificationType(typeName: string): ModificationType {
  switch (typeName) {
    case 'remove': return ModificationType.Remove;
    case 'set': return ModificationType.Set;
    default: throw new Error(`unsupported modification type "${typeName}"`);
  }
}

/**
 * Converts 'entry'/'list' to rights and roles enum type, throws if invalid.
 *
 * @param      {string}        typeName  entry/list
 * @return     {PropertyType}  enum value from `RightsAndRoles`
 */
function getPropertyType(typeName: string): PropertyType {
  switch (typeName) {
    case 'entry': return PropertyType.Entry;
    case 'list': return PropertyType.ListEntry;
    default: throw new Error(`unsupported property type type "${typeName}"`);
  }
}

/**
 * Converts a properties object to a jsonSchema object.
 *
 * @param      {any}  properties  properties object from template
 */
function toJsonSchema(properties: any): any {
  const jsonSchema = {};

  for (let field of Object.keys(properties)) {
    const fieldId = field.replace(/[^a-zA-Z0-9]/g, '');
    jsonSchema[field] = { $id: `${fieldId}_schema`, ...properties[field].dataSchema };
  }

  return jsonSchema;
}