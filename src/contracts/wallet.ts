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

import { AbiCoder } from 'web3-eth-abi';

import {
  ContractLoader,
  Description,
  EventHub,
  Executor,
  Logger,
  LoggerOptions,
  NameResolver,
} from '@evan.network/dbcp';


const coder: AbiCoder = new AbiCoder();

export interface WalletOptions extends LoggerOptions {
  contractLoader: ContractLoader;
  description: Description;
  eventHub: EventHub;
  executor: Executor;
  nameResolver: NameResolver;
  defaultOptions?: any;
}

/**
 * Wallet helper. Used to create and manage wallets
 *
 * @class      Sharing (name)
 */
export class Wallet extends Logger {
  options: WalletOptions;
  defaultOptions: any;
  defaultDescription: any = {
    'public': {
      'name': 'MultiSigWallet contract',
      'description': 'allows multiple accounts to agree on transactions',
      'author': 'evan.network GmbH',
      'version': '0.0.1',
      'dbcpVersion': 1,
    }
  };
  receipts = {};
  walletType: string;
  walletContract: any;

  get walletAddress() {
    return this.walletContract ? this.walletContract.options.address : null;
  }

  constructor(options: WalletOptions) {
    super(options);
    this.options = options;
    this.defaultOptions = options.defaultOptions || {};
    this.defaultDescription.public.abis = {
      own: JSON.parse(this.options.contractLoader.contracts.MultiSigWallet.interface),
    };
    const that = this;
    const signAndExecuteTransaction = this.options.executor.signer.signAndExecuteTransaction;
    this.options.executor.signer.signAndExecuteTransaction =
      function(contract, functionName, functionArguments, innerOptions, handleTxResult) {
        signAndExecuteTransaction.call(
          that.options.executor.signer,
          contract,
          functionName,
          functionArguments,
          innerOptions,
          (error, receipt) => {
            if (receipt) {
              that.receipts[receipt.transactionHash] = receipt;
            }
            handleTxResult(error, receipt);
          },
        );
      };
  }

  /**
   * add an owner to a wallet contract
   *
   * @param      {string}         accountId  account with management permissions on wallet
   * @param      {string}         toAdd      account to add as an owner
   * @return     {Promise<void>}  resolved when done
   */
  public async addOwner(accountId: string, toAdd: string): Promise<void> {
    if (this.walletType === 'MultiSigWallet') {
      await this.options.executor.executeContractTransaction(
        this.ensureContract(),
        'addOwner',
        { from: accountId, },
        toAdd
      );
    } else if (this.walletType === 'MultiSigWalletSG') {
      await this.submitTransaction(
        this.walletContract,
        'addOwner',
        { from: accountId },
        toAdd,
      );
    } else {
      throw new Error(`unknown wallet type: ${this.walletType}`);
    }
  }

  public async confirmTransaction(accountId: string, transactionId: string|number): Promise<any> {
    return this.submitAndHandleConfirmation(
      null, 'confirmTransaction', { from: accountId }, transactionId);
  }

  /**
   * create a new wallet contract and uses it as its wallet contract
   *
   * @param      {string}         accountId      account id, that creates the wallet
   * @param      {string}         manager        account, that will be able to manage the new wallet
   * @param      {string[]}       owners         wallet owners
   * @param      {number}         confirmations  number of confirmations required to complete a
   *                                             transaction, defaults to 1
   * @return     {Promise<void>}  resolved when done
   */
  public async create(accountId: string, manager: string, owners: string[], confirmations = 1):
     Promise<void> {
    // get factory
    const factoryDomain = [
      this.options.nameResolver.config.labels.wallet,
      this.options.nameResolver.config.labels.factory,
      this.options.nameResolver.config.labels.ensRoot,
    ].join('.');
    const factoryAddress = await this.options.nameResolver.getAddress(factoryDomain);
    if (!factoryAddress) {
      throw new Error(`factory '${factoryDomain}' for creating wallets not found in ` +
        `'${this.options.nameResolver.config.labels.businessCenterRoot}'`);
    }
    const factory = this.options.contractLoader.loadContract('MultiSigWalletFactory', factoryAddress);
    // create contract via factory
    const contractId = await this.options.executor.executeContractTransaction(
      factory,
      'createContract', {
        from: accountId,
        autoGas: 1.1,
        event: { target: 'MultiSigWalletFactory', eventName: 'ContractCreated', },
        getEventResult: (event, args) => args.newAddress,
      },
      manager,
      owners,
      confirmations,
    );
    // add description
    await this.options.description.setDescriptionToContract(
      contractId, this.defaultDescription, accountId);

    this.walletType = 'MultiSigWallet';
    this.walletContract = this.options.contractLoader.loadContract(this.walletType, contractId);
  }

  /**
   * get all owners of a wallet
   *
   * @return     {string[]}  wallet owners
   */
  public async getOwners(): Promise<string[]> {
    return this.options.executor.executeContractCall(this.ensureContract(), 'getOwners');
  }

  /**
   * load wallet contract from address
   *
   * @param      {string}      contractId  a wallet contract address
   * @param      {walletType}  walletType  (optional) wallet contract type, defaults to
   *                                       'MultiSigWallet'
   */
  public load(contractId: string, walletType = 'MultiSigWallet'): void {
    this.walletType = walletType;
    this.walletContract = this.options.contractLoader.loadContract(walletType, contractId);
  }

  /**
   * remove an owner from a wallet contract
   *
   * @param      {string}         accountId  account with management permissions on wallet
   * @param      {string}         toRemove   account to remove from wallet owners
   * @return     {Promise<void>}  resolved when done
   */
  public async removeOwner(accountId: string, toRemove: string): Promise<void> {
    if (this.walletType === 'MultiSigWallet') {
      await this.options.executor.executeContractTransaction(
        this.ensureContract(),
        'removeOwner',
        { from: accountId, },
        toRemove
      );
    } else if (this.walletType === 'MultiSigWalletSG') {
      await this.submitTransaction(
        this.walletContract,
        'removeOwner',
        { from: accountId },
        toRemove,
      );
    } else {
      throw new Error(`unknown wallet type: ${this.walletType}`);
    }
  }

  /**
   * submit a transaction to a wallet
   *
   * @param      {any}           target             contract of the submitted transaction
   * @param      {string}        functionName       name of the contract function to call
   * @param      {any}           inputOptions       currently supported: from, gas, event,
   *                                                getEventResult, eventTimeout, estimate, force
   * @param      {any[]}         functionArguments  optional arguments to pass to contract
   *                                                transaction
   * @return     {Promise<any>}  status information about transaction
   */
  public async submitRawTransaction(
      target: any, encoded: string, inputOptions: any): Promise<any> {
    return this.submitAndHandleConfirmation(
      target, 'submitTransaction', inputOptions, encoded);
  }

  /**
   * submit a transaction to a wallet
   *
   * @param      {any}           target             contract of the submitted transaction
   * @param      {string}        functionName       name of the contract function to call
   * @param      {any}           inputOptions       currently supported: from, gas, event,
   *                                                getEventResult, eventTimeout, estimate, force
   * @param      {any[]}         functionArguments  optional arguments to pass to contract
   *                                                transaction
   * @return     {Promise<any>}  status information about transaction
   */
  public async submitTransaction(
      target: any, functionName: string, inputOptions: any, ...functionArguments): Promise<any> {
    // serialize data
    const encoded = this.encodeFunctionParams(functionName, target, functionArguments);
    return this.submitRawTransaction(target, encoded, inputOptions);
  }

  private encodeFunctionParams(functionName: string, contractInstance: any, params: any[]) {
    let functionAbi;
    if (contractInstance.abiModel) {
      functionAbi = contractInstance.abiModel.getMethod(functionName).abiItem;
    } else {
      functionAbi = contractInstance.options.jsonInterface
        .filter(json => json.name === functionName && json.inputs.length === params.length)[0]
    }
    const types = functionAbi.inputs.map(input => input.type);
    const signature = this.options.executor.web3.eth.abi.encodeFunctionSignature(functionAbi);

    return `${signature}${coder.encodeParameters(types, params).replace('0x', '')}`;
  }

  private ensureContract(): any {
    if (!this.walletContract) {
      throw new Error('no wallet contract specified at wallet helper, load or create one');
    }
    return this.walletContract;
  }

  public async submitAndHandleConfirmation(
      target: any, functionName: string, inputOptions: any, ...functionArguments): Promise<any> {
    const subscriptions = [];
    let receipt;
    let walletOptions = Object.assign(
      { timeout: 300000 },
      this.defaultOptions || {},
      inputOptions,
    );
    try {
      receipt = await new Promise(async (resolve, reject) => {
        try {
          let txResolved;
          const transactionTimeout = walletOptions.eventTimeout || walletOptions.timeout;
          setTimeout(() => {
            if (!txResolved) {
              txResolved = true;
              reject(`wallet timeout after ${transactionTimeout}ms`);
            }
          }, transactionTimeout);

          // tx status variables
          let transactionHash;
          let walletTransactionId;
          const transactionResults = {};

          // helper functions
          const resolveIfPossible = () => {
            if (transactionHash &&                                // from Confirmation event
                walletTransactionId &&                            // from Confirmation event
                this.receipts[transactionHash] &&                 // from signer receipt fetching
                transactionResults[walletTransactionId].event) {  // from Execution/ExecutionFailure
              txResolved = true;
              if (transactionResults[walletTransactionId].event.event === 'ExecutionFailure') {
                return reject('ExecutionFailure');
              }
              resolve(transactionResults[walletTransactionId]);
            }
          };

          // subscribe to events for status tracking
          const walletInstance = this.ensureContract();
          const handleConfirmation = async(event) => {
            try {
              // get all events from block
              const events = {};
              const eventNames = [];
              let eventList = await walletInstance.getPastEvents(
                'allEvents',
                { fromBlock: event.blockNumber, toBlock: event.blockNumber });
              eventList = eventList.filter(ev => ev.transactionHash === event.transactionHash);
              eventList.forEach((entry) => {
                events[entry.event] = entry;
                eventNames.push(entry.event);
              });
              transactionResults[event.returnValues.transactionId] = { event };
              if (eventNames.includes('ContractCreated')) {
                this.log('received MultiSigWallet ContractCreated event with txid: ' +
                  `${event.returnValues.transactionId} ${event.transactionHash}`, 'debug');
                transactionResults[event.returnValues.transactionId].result =
                  eventList.filter(ev => ev.event === 'ContractCreated')[0].returnValues.contractId;
              } else if (eventNames.includes('Execution')) {
                this.log('received MultiSigWallet Execution event with txid: ' +
                  `${event.returnValues.transactionId} ${event.transactionHash}`, 'debug');
              } else if (eventNames.includes('ExecutionFailure')) {
                this.log('received MultiSigWallet ExecutionFailure event with txid: ' +
                  `${event.returnValues.transactionId} ${event.transactionHash}`, 'debug');
              } else {
                this.log('received MultiSigWallet Confirmation event with hash: ' +
                  `${event.transactionHash} and txid: ${event.returnValues.transactionId}`, 'debug');
                transactionResults[event.returnValues.transactionId].result = {
                  status: 'pending',
                  transactionId: event.returnValues.transactionId,
                };
              }
            } catch (ex) {
              const msg = 'handling of confirmation of ' +
                (target ? `transaction to "${target.options.address}"` : 'constructor') +
                ` with ${ex.message || ex}`;
              this.log(msg, 'error');
              throw new Error(msg);
            }
          };

          // execute to contract
          const options = Object.assign(JSON.parse(JSON.stringify(walletOptions)), {
            event: { target: 'MultiSigWallet', eventName: 'Confirmation', },
            getEventResult: async (event, args) => {
              this.log('received MultiSigWallet Confirmation event with hash: ' +
                `${event.transactionHash} and txid: ${args.transactionId}`, 'debug');
              transactionHash = event.transactionHash;
              walletTransactionId = args.transactionId;
              await handleConfirmation(event);
              resolveIfPossible();
            }
          });
          let value = 0;
          if (options.value) {
            this.log('wallet transaction has "value" set, removing this from tx options ' +
              'and passing it as argument', 'debug');
            value = options.value;
            delete options.value;
          }
          if (functionName === 'submitTransaction') {
            await this.options.executor.executeContractTransaction(
              walletInstance,
              functionName,
              options,
              (target && target.options) ?
                target.options.address : '0x0000000000000000000000000000000000000000',
              value,
              ...functionArguments,
            );
          } else if (functionName === 'confirmTransaction') {
            await this.options.executor.executeContractTransaction(
              walletInstance,
              functionName,
              options,
              ...functionArguments,
            );
          }
        } catch (ex) {
          reject(ex);
        }
      });
    } catch (ex) {
      throw new Error(ex.message || ex);
    } finally {
      // cleanup subscriptions
      await Promise.all(
        subscriptions.map(s => this.options.eventHub.unsubscribe({ subscription: s })));
    }

    return receipt;
  }
}
