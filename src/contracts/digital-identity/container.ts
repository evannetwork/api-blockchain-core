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
import { RightsAndRoles, ModificationType, PropertyType } from '../rights-and-roles';
import { Sharing } from '../sharing';


/**
 * config properties, specific to `Container` instances
 */
export interface ContainerConfig {
  accountId: string;
  address?: string;
  description?: any;
  factoryAddress?: string;
  mailTemplates?: {
    share: {},
    sendTemplate: {},
  },
  origin?: Container;
  template?: string | ContainerTemplate;
}

/**
 * template for container instances, covers properties setup and permissions
 */
export interface ContainerTemplate {
  permissions?: ContainerTemplatePermissions;
  properties?: { [id: string]: ContainerTemplateProperty; }
}

/**
 * permissions for `ContainerTemplate`
 */
export interface ContainerTemplatePermissions {
  /**
   * group id is key, value is a lkist of function signatures (not hashed)
   */
  roleCapability?: { [id: number]: string[]; };
  /**
   * group id is key, value is a list of arrays, that will be hashed (tied to operation permission checks)
   */
  roleOperationCapability?: { [id: number]: string[][]; };
}

/**
 * property in `ContainerTemplate`, defines an `entry` or `list` at the data contract
 */
export interface ContainerTemplateProperty {
  dataSchema: any;
  permissions: { [id: number]: string[]; };
  sharing: string;
  type: string;
  value?: string;
}

/**
 * options for Container constructor
 */
export interface ContainerOptions extends LoggerOptions {
  contractLoader: ContractLoader;
  dataContract: DataContract;
  description: Description;
  executor: Executor;
  nameResolver: NameResolver;
  rightsAndRoles: RightsAndRoles;
  web3: any;
}


/**
 * helper class for managing data contracts; all values are stored encrypted, hashes are encrypted
 * as well, use `contract` property and `DataContract` module for custom logic for special cases
 * like unencrypted values
 *
 * @class      Container (name)
 */
export class Container extends Logger {
  public static templates: { [id: string]: ContainerTemplate; } = {
    metadata: {
      properties: {
        type: {
          dataSchema: { type: 'string' },
          type: 'entry',
          permissions: {
            0: ['set']
          },
          sharing: '*',
          value: 'metadata',
        },
        fieldForAll: {
          dataSchema: { type: 'string' },
          type: 'entry',
          permissions: {
            0: ['set', 'remove'],
            1: ['set'],
          },
          sharing: 'fieldForAll',
          value: 'test value for all',
        },
      },
      permissions: {
        roleCapability: {
          1: ['setEntry(bytes32,bytes32)'],
        },
        roleOperationCapability: {
          0: [
            ['contractState', 'Draft', 'PendingApproval'],
            ['contractState', 'PendingApproval', 'Approved'],
            ['contractState', 'Approved', 'Terminated'],
            ['othersState', 'Draft', 'Terminated'],
          ],
          1: [
            ['ownState', 'Draft', 'Active'],
            ['ownState', 'Active', 'Terminated'],
          ],
        },
      },
    },
  };
  private static defaultFactoryAddress = 'container.factory.evan';
  private static defaultTemplate = 'metadata';
  private config: ContainerConfig;
  private contract: any;
  private options: ContainerOptions;

  /**
   * apply template to data contract; this should be used with caution and is intended to only be
   * used on new contract (e.g. in `create` and `clone`)
   *
   * @param      {ContainerOptions}  options   runtime for new `Container`
   * @param      {ContainerConfig}   config    config for new container
   * @param      {any}               contract  `DataContract` instance
   */
  public static async applyTemplate(
      options: ContainerOptions, config: ContainerConfig, container: Container): Promise<void> {
    Container.checkConfigProperties(config, ['template']);
    let tasks = [];
    const template = typeof config.template === 'string' ?
      Container.templates[config.template] :
      config.template;
    for (let propertyName of Object.keys(template.properties)) {
      const property: ContainerTemplateProperty = template.properties[propertyName];
      const permissionTasks = [];
      for (let role of Object.keys(property.permissions)) {
        for (let modification of property.permissions[role]) {
          let propertyType: PropertyType;
          if (property.type === 'entry') {
            propertyType = PropertyType.Entry;
          } else if (property.type === 'list') {
            propertyType = PropertyType.ListEntry;
          } else {
            throw new Error(`invalid property type "${property.type}" for property "${propertyName}"`);
          }
          let modificationType: ModificationType;
          if (modification === 'set') {
            modificationType = ModificationType.Set;
          } else if (modification === 'remove') {
            modificationType = ModificationType.Remove;
          } else {
            throw new Error(`invalid modification "${modification}" for property "${propertyName}"`);
          }
          // allow setting this field; if value is specified, add value AFTER this
          permissionTasks.push(async () => {
            await options.rightsAndRoles.setOperationPermission(
              container.contract.options.address,
              config.accountId,
              parseInt(role, 10),
              propertyName,
              propertyType,
              modificationType,
              true,
            );
          });
        }
      }
      if (property.hasOwnProperty('value')) {
        // if value has been defined, wait for permissions to be completed, then set value
        tasks.push(async () => {
          await Throttle.all(permissionTasks);
          await container.setEntry(propertyName, property.value);
        });
      } else {
        // if no value has been specified, flatten permission tasks and add to task list
        tasks = tasks.concat(async () => Throttle.all(permissionTasks));
      }
    }
    if (template.permissions) {
      if (template.permissions.roleCapability) {
        for (let role of Object.keys(template.permissions.roleCapability)) {
          for (let fun of template.permissions.roleCapability[role]) {
            tasks.push(async () => options.rightsAndRoles.setFunctionPermission(
              container.contract.options.address,
              config.accountId,
              parseInt(role, 10),
              options.web3.utils.sha3(fun).substr(0, 10),
              true,
            ));
          }
        }
      }
      if (template.permissions.roleOperationCapability) {
        const dsRolesAddress = await options.executor.executeContractCall(container.contract, 'authority');
        const dsRolesContract = options.contractLoader.loadContract('DSRolesPerContract', dsRolesAddress);
        const keccak256 = options.web3.utils.soliditySha3;
        const rekkeccak = (toKeccak) => toKeccak.length === 2 ? keccak256(...toKeccak) : keccak256(toKeccak.shift(), rekkeccak(toKeccak));
        for (let role of Object.keys(template.permissions.roleOperationCapability)) {
          for (let parts of template.permissions.roleOperationCapability[role]) {
            tasks.push(async () => options.executor.executeContractTransaction(
              dsRolesContract,
              'setRoleOperationCapability',
              { from: config.accountId },
              role,
              '0x0000000000000000000000000000000000000000',
              rekkeccak(parts),
              true,
            ));
          }
        }
      }
    }
    await Throttle.all(tasks);
  }

  /**
   * check, that given subset of properties is present at config, collections missing properties and
   * throws a single error
   *
   * @param      {ContainerConfig}  config      config for container instance
   * @param      {string}           properties  list of property names, that should be present
   */
  public static checkConfigProperties(config: ContainerConfig, properties: string[]): void {
    let missing = properties.filter(property => !config.hasOwnProperty(property));
    if (missing.length === 1) {
      throw new Error(`missing property in config: "${missing[0]}"`);
    } else if (missing.length > 1) {
      throw new Error(`missing properties in config: "${missing.join(', ')}"`);
    }
  }

  /**
   * clone `Container` instance into template and creates new `Container` with it
   *
   * @param      {ContainerOptions}  options  runtime for new `Container`
   * @param      {ContainerConfig}   config   config for new container
   * @param      {Container}         source   will be serialized to a template that will be applied
   *                                          to new `Container`
   */
  public static async clone(
      options: ContainerOptions, config: ContainerConfig, source: Container): Promise<void> {
    throw new Error('not implemented');
  }

  /**
   * create digital container contract
   *
   * @param      {ContainerOptions}  options  runtime for new `Container`
   * @param      {ContainerConfig}   config   config for new container
   */
  public static async create(options: ContainerOptions, config: ContainerConfig):
      Promise<Container> {
    Container.checkConfigProperties(config, ['description']);
    const instanceConfig = JSON.parse(JSON.stringify(config));

    // convert template properties to jsonSchema
    if (instanceConfig.template.properties) {
      instanceConfig.description.dataSchema = Container.toJsonSchema(instanceConfig.template.properties)
    }

    // check description values and upload it
    const envelope: Envelope = { public: instanceConfig.description };
    const validation = options.description.validateDescription(envelope);
    if (validation !== true) {
      throw new Error(`validation of description failed with: ${JSON.stringify(validation)}`);
    }

    // create contract
    const contract = await options.dataContract.create(
      instanceConfig.factoryAddress || Container.defaultFactoryAddress,
      instanceConfig.accountId,
      null,
      envelope,
    );
    instanceConfig.address = contract.options.address;

    const container = new Container(options, instanceConfig);
    await container.ensureContract();

    await Container.applyTemplate(options, instanceConfig, container);

    return container;
  }

  /**
   * converts a properties object to a jsonSchema object
   *
   * @param      {any}  properties  properties object from template
   */
  public static toJsonSchema(properties: any) {
    const jsonSchema = {};

    for (let field of Object.keys(properties)) {
      jsonSchema[field] = { $id: `${field}_schema`, ...properties[field].dataSchema };
    }

    return jsonSchema;
  }

  constructor(options: ContainerOptions, config: ContainerConfig) {
    super(options as LoggerOptions);
    this.options = options;
    this.config = config;
  }

  /**
   * add list entriesd
   *
   * @param      {stringstring}  listName  name of the list in the data contract
   * @param      {any}           values    values to add
   */
  public async addListEntries(listName: string|string[], values: any[]): Promise<void> {
    await this.options.dataContract.addListEntries(
      this.contract, listName, values, this.config.accountId);
  }

  /**
   * get contract address of underlying DataContract
   */
  public async getContractAddress(): Promise<string> {
    await this.ensureContract();
    return this.contract.options.address;
  }

  /**
   * check if container contract already has been loaded, load from address / ENS if required
   */
  public async ensureContract(): Promise<void> {
    if (this.contract) {
      return;
    }
    Container.checkConfigProperties(this.config, ['address']);
    let address = this.config.address.startsWith('0x') ?
      this.config.address : await this.options.nameResolver.getAddress(this.config.address);
    this.contract = this.options.contractLoader.loadContract('DataContract', address)
  }

  /**
   * return entry from contract
   *
   * @param      {string}  entryName  The entry name
   */
  public async getEntry(entryName: string): Promise<any> {
    await this.ensureContract();
    return this.options.dataContract.getEntry(this.contract, entryName, this.config.accountId);
  }

  /**
   * return list entries from contract. Note, that in the current implementation, this function
   * retrieves the entries one at a time and may take a longer time when querying large lists, so be
   * aware of that
   *
   * @param      {string}   listName  name of a list in the container
   * @param      {number}   count     number of items to retrieve
   * @param      {number}   offset    skip this many entries
   * @param      {boolean}  reverse   if true, fetches last items first
   */
  public async getListEntries(listName: string, count = 10, offset = 0, reverse = false):
      Promise<any[]> {
    await this.ensureContract();
    return this.options.dataContract.getListEntries(
      this.contract, listName, this.config.accountId, true, true, count, offset, reverse);
  }

  /**
   * return a single list entry from contract
   *
   * @param      {string}  listName  name of a list in the container
   * @param      {number}  index     list entry id to retrieve
   */
  public async getListEntry(listName: string, index: number): Promise<any> {
    await this.ensureContract();
    return this.options.dataContract.getListEntry(
      this.contract, listName, index, this.config.accountId);
  }

  /**
   * return number of entries in the list
   *
   * @param      {string}  listName  name of a list in the container
   */
  public async getListEntryCount(listName: string): Promise<number> {
    await this.ensureContract();
    return this.options.dataContract.getListEntryCount(this.contract, listName);
  }

  /**
   * remove entry from a list
   *
   * @param      {string}  listName    name of a list in the container
   * @param      {number}  entryIndex  index of the entry to remove from list
   */
  public async removeListEntry(listName: string, entryIndex: number): Promise<void> {
    await this.ensureContract();
    await this.options.dataContract.removeListEntry(
      this.contract,
      listName,
      entryIndex,
      this.config.accountId,
    );
  }

  /**
   * set entry for a key
   *
   * @param      {string}  entryName  name of an entry in the container
   * @param      {any}     value      value to set
   */
  public async setEntry(entryName: string, value: any): Promise<void> {
    await this.ensureContract();
    await this.options.dataContract.setEntry(this.contract, entryName, value, this.config.accountId);
  }

  /**
   * share entry/list/mapping, send bmail if template is set, otherwise just set property
   *
   * @param      {string[]}  recipients  recipients of property/properties
   * @param      {string[]}  properties  (optional) properties to share, omit to share all
   */
  public async shareProperties(recipients: string[], properties?: string[]): Promise<void> {
    throw new Error('not implemented');
  }

  /**
   * convert contract to template and share it via bmail
   *
   * @param      {string[]}  recipients  bmail recipients
   */
  public async shareTemplate(recipients: string[]): Promise<void> {
    throw new Error('not implemented');
  }

  public async toTemplate(): Promise<any> {
    // build template object
    /*
      § DataSchema copied from DBCP
        □ only copy entries from dataschema where i'm permitted
        □ dbcp will be cleaned
      § Metadata
        □ entries including it's configurations
          ® name
          ®  type
          ® value (per default not copied, but can be enabled)
        □ roles for the entries
        □ sharings are not saved within the template!
    */
    throw new Error('not implemented');
  }
}
