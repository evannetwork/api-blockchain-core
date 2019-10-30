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
  Executor,
  Logger,
  LoggerOptions,
  NameResolver
} from '@evan.network/dbcp';


/**
 * describes contracts overall state
 */
export enum ContractState {
  Initial,
  Error,
  Draft,
  PendingApproval,
  Approved,
  Active,
  VerifyTerminated,
  Terminated,
};

/**
 * describes the state of a consumer or owner in a contract
 */
export enum ConsumerState {
    Initial,
    Error,
    Draft,
    Rejected,
    Active,
    Terminated
};

/**
 * options for BaseContract constructor
 */
export interface BaseContractOptions extends LoggerOptions {
  executor: Executor,
  loader: ContractLoader,
  nameResolver: NameResolver,
}

/**
 * wrapper for BaseContract interactions
 *
 * @class      BaseContract (name)
 */
export class BaseContract extends Logger {
  protected options: BaseContractOptions;

  constructor(optionsInput: BaseContractOptions) {
    super(optionsInput);
    this.options = optionsInput;
  }

  /**
   * create new contract but do not initialize it yet
   *
   * @param      {string}           factoryName           contract factory name, used for ENS lookup
   * @param      {string}           accountId             Ethereum account id
   * @param      {string}           businessCenterDomain  business center in which the contract will
   *                                                      be created; use null when working without
   *                                                      business center
   * @param      {string}           descriptionDfsHash    bytes32 hash for description in dfs
   * @return     {Promise<string>}  Ethereum id of new contract
   */
  public async createUninitialized(
      factoryName: string,
      accountId: string,
      businessCenterDomain?: string,
      descriptionDfsHash = '0x0000000000000000000000000000000000000000000000000000000000000000')
      : Promise<string> {
    let factoryAddress;
    if (factoryName.startsWith('0x')) {
      factoryAddress = factoryName;
    } else {
      let factoryDomain;
      if (factoryName.includes('.')) {
        // full ens domain name
        factoryDomain = factoryName;
      } else {
        // partial name, bc relative domain
        factoryDomain = this.options.nameResolver.getDomainName(
          this.options.nameResolver.config.domains.factory, factoryName);
      }
      factoryAddress = await this.options.nameResolver.getAddress(factoryDomain);
    }
    if (!factoryAddress) {
      throw new Error(`factory "${factoryName}" not found`);
    }
    const factory = this.options.loader.loadContract('BaseContractFactoryInterface', factoryAddress);
    let businessCenterAddress;
    if (businessCenterDomain) {
      businessCenterAddress = await this.options.nameResolver.getAddress(businessCenterDomain);
      if (businessCenterAddress != '0x0000000000000000000000000000000000000000') {
        const businessCenterContract = await this.options.loader.loadContract('BusinessCenterInterface', businessCenterAddress);
        try{
          const returnedContract = await this.options.executor.executeContractCall(businessCenterContract,'joinSchema');
          console.log(returnedContract)
        }
        catch(e){
          console.log(e)
          throw new Error("There is no Business Center domain exisiting");
        }
      }
    } else {
      businessCenterAddress = '0x0000000000000000000000000000000000000000';
    }
    const contractId = await this.options.executor.executeContractTransaction(
      factory,
      'createContract', {
        from: accountId,
        autoGas: 1.1,
        event: { target: 'BaseContractFactoryInterface', eventName: 'ContractCreated', },
        getEventResult: (event, args) => args.newAddress,
      },
      businessCenterAddress,
      accountId,
      descriptionDfsHash,
      this.options.nameResolver.config.ensAddress,
    );
    return contractId.toString();
  }

  /**
   * invite user to contract
   *
   * @param      {string}         businessCenterDomain  ENS domain name of the business center the
   *                                                    contract was created in; use null when
   *                                                    working without business center
   * @param      {string}         contract              Ethereum id of the contract
   * @param      {string}         inviterId             account id of inviting user
   * @param      {string}         inviteeId             account id of invited user
   * @return     {Promise<void>}  resolved when done
   */
  public async inviteToContract(
      businessCenterDomain: string,
      contract: string,
      inviterId: string,
      inviteeId: string): Promise<void> {
    const baseContractInterface = (typeof contract === 'object') ?
      contract : this.options.loader.loadContract('BaseContractInterface', contract);
    let businessCenterAddress;
    if (businessCenterDomain) {
      businessCenterAddress = await this.options.nameResolver.getAddress(businessCenterDomain);
    } else {
      businessCenterAddress = '0x0000000000000000000000000000000000000000';
    }
    await this.options.executor.executeContractTransaction(
      baseContractInterface,
      'inviteConsumer',
      { from: inviterId, autoGas: 1.1, },
      inviteeId,
      businessCenterAddress,
    );
  }

  /**
   * set state of the contract
   *
   * @param      {string|any}     contract   contract instance or contract id
   * @param      {string}         accountId  Ethereum account id
   * @param      {ContractState}  state      new state
   * @return     {Promise<void>}  resolved when done
   */
  public async changeContractState(contract: string|any, accountId: string, state: ContractState): Promise<void> {
    const baseContractInterface = (typeof contract === 'object') ?
      contract : this.options.loader.loadContract('BaseContractInterface', contract);
    await this.options.executor.executeContractTransaction(
      baseContractInterface,
      'changeContractState',
      { from: accountId, autoGas: 1.1, },
      state,
    );
  }

  /**
   * set state of a consumer
   *
   * @param      {string|any}     contract    contract instance or contract id
   * @param      {string}         accountId   Ethereum account id
   * @param      {string}         consumerId  Ethereum account id
   * @param      {ConsumerState}  state       new state
   * @return     {Promise<void>}  resolved when done
   */
  public async changeConsumerState(
      contract: string|any,
      accountId: string,
      consumerId: string,
      state: ConsumerState): Promise<void> {
    const baseContractInterface = (typeof contract === 'object') ?
      contract : this.options.loader.loadContract('BaseContractInterface', contract);
    await this.options.executor.executeContractTransaction(
      baseContractInterface,
      'changeConsumerState',
      { from: accountId, autoGas: 1.1, },
      consumerId,
      state,
    );
  }

  /**
   * remove user from contract
   *
   * @param      {string}         businessCenterDomain  ENS domain name of the business center the
   *                                                    contract was created in; use null when
   *                                                    working without business center
   * @param      {string}         contract              Ethereum id of the contract
   * @param      {string}         accountId             account id of executing user
   * @param      {string}         idToBeRemoved         account id which should be removed
   * @return     {Promise<void>}  resolved when done
   */
  public async removeFromContract(
      businessCenterDomain: string,
      contract: string,
      accountId: string,
      idToBeRemoved: string): Promise<void> {
    const baseContractInterface = (typeof contract === 'object') ?
      contract : this.options.loader.loadContract('BaseContractInterface', contract);
    let businessCenterAddress;
    if (businessCenterDomain) {
      businessCenterAddress = await this.options.nameResolver.getAddress(businessCenterDomain);
    } else {
      businessCenterAddress = '0x0000000000000000000000000000000000000000';
    }
    await this.options.executor.executeContractTransaction(
      baseContractInterface,
      'removeConsumer',
      { from: accountId, autoGas: 1.1, },
      idToBeRemoved,
      businessCenterAddress
    );
  }
}
