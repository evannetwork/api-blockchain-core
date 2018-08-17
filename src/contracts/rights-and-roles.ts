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

import prottle = require('prottle');

import {
  ContractLoader,
  Executor,
  NameResolver,
  Logger,
  LoggerOptions,
} from '@evan.network/dbcp';


const simultaneousRolesProcessed = 2;

/**
 * type of modification in contraction
 */
export enum ModificationType {
  Set = '0xd2f67e6aeaad1ab7487a680eb9d3363a597afa7a3de33fa9bf3ae6edcb88435d',  // web3.sha3('set')
  Remove = '0x8dd27a19ebb249760a6490a8d33442a54b5c3c8504068964b74388bfe83458be',  // web3.sha3('remove')
}

/**
 * property to set in contract
 */
export enum PropertyType {
  Entry = '0x84f3db82fb6cd291ed32c6f64f7f5eda656bda516d17c6bc146631a1f05a1833',  // web3.sha3('entry')
  ListEntry = '0x7da2a80303fd8a8b312bb0f3403e22702ece25aa85a5e213371a770a74a50106',  // web3.sha3('listentry')
}

export interface RightsAndRolesOptions extends LoggerOptions {
  contractLoader: ContractLoader;
  executor: Executor;
  nameResolver: NameResolver;
  web3: any;
}

/**
 * Rights and Roles helper for managing contract permissions
 *
 * @class      RightsAndRoles (name)
 */
export class RightsAndRoles extends Logger {
  options: RightsAndRolesOptions;

  constructor(options: RightsAndRolesOptions) {
    super(options);
    this.options = Object.assign({}, options);
  }

  /**
   * returns all roles with all members
   *
   * @param      {any|string}    contract  contractId or contract instance
   * @return     {Promise<any>}  Object with mapping roleId -> [accountId, accountId,...]
   */
  public async getMembers(contract: any|string): Promise<any> {
    const result = {};
    const contractInstance = (typeof contract === 'object') ?
      contract : this.options.contractLoader.loadContract('BaseContractInterface', contract);
    const rolesAddress = await this.options.executor.executeContractCall(contractInstance, 'authority');
    const rolesContract = this.options.contractLoader.loadContract('DSRolesPerContract', rolesAddress);
    const roleCount = await this.options.executor.executeContractCall(rolesContract, 'roleCount');
    // array of functions that retrieve an element as a promise
    const retrievals = [...Array(parseInt(roleCount, 10))].map(
      (_, role) => role).reverse().map(role => async () => {
        result[role] = await this.options.nameResolver.getArrayFromUintMapping(
          rolesContract,
          () => this.options.executor.executeContractCall(rolesContract, 'role2userCount', role),
          (i) => this.options.executor.executeContractCall(rolesContract, 'role2index2user', role, i + 1),
        );
      });
    // run these function windowed, chain .then()s, return result array
    await prottle(simultaneousRolesProcessed, retrievals);
    return result;
  }

  /**
   * allows or denies contract function for the accountId
   *
   * @param      {string|any}     contract           contractId or contract instance
   * @param      {string}         accountId          executing accountId
   * @param      {number}         role               roleid
   * @param      {string}         functionSignature  4 Bytes function signature
   * @param      {boolean}        allow              allow or deny function
   * @return     {Promise<void>}  resolved when done
   */
  public async setFunctionPermission(
      contract: string|any, accountId: string, role: number, functionSignature: string, allow: boolean) {
    const contractId = typeof contract === 'string' ? contract : contract.options.address;
    const auth = this.options.contractLoader.loadContract('DSAuth', contractId);
    const dsRolesAddress = await this.options.executor.executeContractCall(auth, 'authority');
    const dsRolesContract = this.options.contractLoader.loadContract('DSRolesPerContract', dsRolesAddress);
    const keccak256 = this.options.web3.utils.soliditySha3;
    const bytes4 = input => input.substr(0, 10);
    const permissionHash = bytes4(keccak256(functionSignature));
    await this.options.executor.executeContractTransaction(
      dsRolesContract, 'setRoleCapability', { from: accountId, autoGas: 1.1, },
      role, 0, permissionHash, allow);
  }

  /**
   * allows or denies setting properties on a contract
   *
   * @param      {string|any}        contract          contractId or contract instance
   * @param      {string}            accountId         executing accountId
   * @param      {number}            role              roleId
   * @param      {string}            propertyName      target property name
   * @param      {PropertyType}      propertyType      list or entry
   * @param      {ModificationType}  modificationType  set or remove
   * @param      {boolean}           allow             allow or deny
   * @return     {Promise<void>}     resolved when done
   */
  public async setOperationPermission(
      contract: string|any,
      accountId: string,
      role: number,
      propertyName: string,
      propertyType: PropertyType,
      modificationType: ModificationType,
      allow: boolean) {
    const contractId = typeof contract === 'string' ? contract : contract.options.address;
    const auth = this.options.contractLoader.loadContract('DSAuth', contractId);
    const dsRolesAddress = await this.options.executor.executeContractCall(auth, 'authority');
    const dsRolesContract = this.options.contractLoader.loadContract('DSRolesPerContract', dsRolesAddress);
    const keccak256 = this.options.web3.utils.soliditySha3;
    const permissionHash = keccak256(keccak256(propertyType, keccak256(propertyName)), modificationType)
    await this.options.executor.executeContractTransaction(
      dsRolesContract, 'setRoleOperationCapability', { from: accountId, autoGas: 1.1, },
      role, 0, permissionHash, allow);
  }

  /**
   * adds the target account to a specific role
   *
   * @param      {string|any}     contract         contractId or contract instance
   * @param      {string}         accountId        executing accountId
   * @param      {string}         targetAccountId  target accountId
   * @param      {number}         role             roleId
   * @return     {Promise<void>}  resolved when done
   */
  public async addAccountToRole(
      contract: string|any,
      accountId: string,
      targetAccountId: string,
      role: number) {
    const contractId = typeof contract === 'string' ? contract : contract.options.address;
    const auth = this.options.contractLoader.loadContract('DSAuth', contractId);
    const dsRolesAddress = await this.options.executor.executeContractCall(auth, 'authority');
    const dsRolesContract = this.options.contractLoader.loadContract('DSRolesPerContract', dsRolesAddress);
    await this.options.executor.executeContractTransaction(
      dsRolesContract, 'setUserRole', { from: accountId, autoGas: 1.1, },
      targetAccountId, role, true);
  }

  /**
   * returns true or false, depending on if the account has the specific role
   * @deprecated second argument "accountId" will be dropped, as it isnt' required anymore
   *
   * @param      {string|any}        contract         contractId or contract instance
   * @param      {string}            accountId        executing accountId
   * @param      {string}            targetAccountId  to be checked accountId
   * @param      {number}            role             roleId
   * @return     {Promise<boolean>}  true is given user as specified role
   */
  public async hasUserRole(
      contract: string|any,
      accountId: string,
      targetAccountId: string,
      role: number) {
    const contractId = typeof contract === 'string' ? contract : contract.options.address;
    const auth = this.options.contractLoader.loadContract('DSAuth', contractId);
    const dsRolesAddress = await this.options.executor.executeContractCall(auth, 'authority');
    const dsRolesContract = this.options.contractLoader.loadContract('DSRolesPerContract', dsRolesAddress);
    return this.options.executor.executeContractCall(dsRolesContract, 'hasUserRole', targetAccountId, role)
  }

  /**
   * removes target account from a specific role
   *
   * @param      {string|any}     contract         contractId or contract instance
   * @param      {string}         accountId        executing accountId
   * @param      {string}         targetAccountId  target accountId
   * @param      {number}         role             roleId
   * @return     {Promise<void>}  resolved when done
   */
  public async removeAccountFromRole(
      contract: string|any,
      accountId: string,
      targetAccountId: string,
      role: number) {
    const contractId = typeof contract === 'string' ? contract : contract.options.address;
    const auth = this.options.contractLoader.loadContract('DSAuth', contractId);
    const dsRolesAddress = await this.options.executor.executeContractCall(auth, 'authority');
    const dsRolesContract = this.options.contractLoader.loadContract('DSRolesPerContract', dsRolesAddress);
    await this.options.executor.executeContractTransaction(
      dsRolesContract, 'setUserRole', { from: accountId, autoGas: 1.1, },
      targetAccountId, role, false);
  }

  /**
   * transfer ownership of a contract and its authority to another account
   *
   * @param      {string|any}     contract         contractId or contract instance
   * @param      {string}         accountId        executing accountId
   * @param      {string}         targetAccountId  target accountId
   * @return     {Promise<void>}  resolved when done
   */
  public async transferOwnership(contract: string|any, accountId: string, targetAccountId: string
    ): Promise<void> {
    const contractId = typeof contract === 'string' ? contract : contract.options.address;
    const auth = this.options.contractLoader.loadContract('DSAuth', contractId);
    const dsRolesAddress = await this.options.executor.executeContractCall(auth, 'authority');
    const dsRolesContract = this.options.contractLoader.loadContract('DSRolesPerContract', dsRolesAddress);
    await this.options.executor.executeContractTransaction(
      auth, 'setOwner', { from: accountId, autoGas: 1.1, }, targetAccountId);
    await this.options.executor.executeContractTransaction(
      dsRolesContract, 'setOwner', { from: accountId, autoGas: 1.1, }, targetAccountId);
  }
}
