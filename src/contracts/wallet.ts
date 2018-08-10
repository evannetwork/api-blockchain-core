/*
  Copyright (C) 2018-present evan GmbH.

  This program is free software: you can redistribute it and/or modify it
  under the terms of the GNU Affero General Public License, version 3,
  as published by the Free Software Foundation.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
  See the GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License along with this program.
  If not, see http://www.gnu.org/licenses/ or write to the

  Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA, 02110-1301 USA,

  or download the license from the following URL: https://evan.network/license/

  You can be released from the requirements of the GNU Affero General Public License
  by purchasing a commercial license.
  Buying such a license is mandatory as soon as you use this software or parts of it
  on other blockchains than evan.network.

  For more information, please contact evan GmbH at this address: https://evan.network/license/
*/

import coder = require('web3-eth-abi');

import {
  ContractLoader,
  Description,
  EventHub,
  Executor,
  Logger,
  LoggerOptions,
  NameResolver,
} from '@evan.network/dbcp';


export interface WalletOptions extends LoggerOptions {
  contractLoader: ContractLoader;
  description: Description;
  eventHub: EventHub;
  executor: Executor;
  nameResolver: NameResolver;
}

/**
 * Wallet helper. Used to create and manage wallets
 *
 * @class      Sharing (name)
 */
export class Wallet extends Logger {
  options: WalletOptions;
  defaultDescription: any = {
    'public': {
      'name': 'MultiSigWallet contract',
      'description': 'allows multiple accounts to aggree on transactions',
      'author': 'evan.network GmbH',
      'version': '0.0.1',
      'dbcpVersion': 1,
    }
  };
  receipts = {};
  walletContract: any;

  constructor(options: WalletOptions) {
    super(options);
    this.options = options;
    this.defaultDescription.public.abis = {
      own: JSON.parse(this.options.contractLoader.contracts.MultiSigWallet.interface),
    };
    const that = this;
    const signAndExecuteTransaction = this.options.executor.signer.signAndExecuteTransaction;
    this.options.executor.signer.signAndExecuteTransaction =
      function(contract, functionName, functionArguments, innerOptions, handleTxResult) {
        signAndExecuteTransaction.call(that.options.executor.signer, contract, functionName, functionArguments, innerOptions, (error, receipt) => {
          if (receipt) {
            that.receipts[receipt.transactionHash] = receipt;
          }
          handleTxResult(error, receipt);
        });
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
    await this.options.executor.executeContractTransaction(
      this.ensureContract(),
      'addOwner',
      { from: accountId, },
      toAdd
    );
  }

  /**
   * create a new wallet contract and uses it as its wallet contract
   *
   * @param      {string}         accountId  account id, that creates the wallet
   * @param      {string}         manager    account, that will be able to manage the new wallet
   * @param      {string[]}       owners     wallet owners
   * @return     {Promise<void>}  resolved when done
   */
  public async create(accountId: string, manager: string, owners: string[]): Promise<void> {
    // get factory
    const factoryDomain = this.options.nameResolver.getDomainName(
      this.options.nameResolver.config.domains.factory,
      this.options.nameResolver.config.labels.wallet
    );
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
      1,
    );
    // add description
    await this.options.description.setDescriptionToContract(contractId, this.defaultDescription, accountId);

    this.walletContract = this.options.contractLoader.loadContract('MultiSigWallet', contractId);
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
   * @param      {string}  contractId  a wallet contract address
   * @return     {void}
   */
  public load(contractId: string): void {
    this.walletContract = this.options.contractLoader.loadContract('MultiSigWallet', contractId);
  }

  /**
   * remove an owner from a wallet contract
   *
   * @param      {string}         accountId  account with management permissions on wallet
   * @param      {string}         toRemove   account to remove from wallet owners
   * @return     {Promise<void>}  resolved when done
   */
  public async removeOwner(accountId: string, toRemove: string): Promise<void> {
    await this.options.executor.executeContractTransaction(
      this.ensureContract(),
      'removeOwner',
      { from: accountId, },
      toRemove
    );
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
  public async submitTransaction(target: any, functionName: string, inputOptions: any, ...functionArguments): Promise<any> {
    const subscriptions = [];
    let receipt;
    try {
      receipt = await new Promise(async (resolve, reject) => {
        try {
          let txResolved;
          setTimeout(() => {
            if (!txResolved) {
              txResolved = true;
              reject('wallet timeout');
            }
          }, 600000);

          // serialize data
          const encoded = this.encodeFunctionParams(functionName, target, functionArguments);

          // tx status variables
          let transactionHash;
          let walletTransactionId;
          const transactionEvents = {};
          const transactionEventResults = {};

          // helper functions
          const resolveIfPossible = () => {
            if (transactionHash &&                          // from Submission event
              walletTransactionId &&                        // from Submission event
              this.receipts[transactionHash] &&             // from signer receipt fetching
              transactionEvents[walletTransactionId]) {     // from Execution/ExecutionFailure
                txResolved = true;
                if (transactionEvents[walletTransactionId].event === 'ExecutionFailure') {
                  return reject('ExecutionFailure');
                }
                resolve(this.receipts[transactionHash]);
            }
          };

          // subscribe to events for status tracking
          const walletInstance = this.ensureContract();
          // triggers on tx submission
          // triggers on success
          subscriptions.push(await this.options.eventHub.subscribe('MultiSigWallet', walletInstance.options.address, 'Execution', () => true,
            (event) => {
              this.log(`received MultiSigWallet Execution event with txid: ${event.returnValues.transactionId} ${event.transactionHash}`, 'debug');
              transactionEvents[event.returnValues.transactionId] = event;
              resolveIfPossible();
            }
          ));
          // triggers on failure
          subscriptions.push(await this.options.eventHub.subscribe('MultiSigWallet', walletInstance.options.address, 'ExecutionFailure', () => true,
            (event) => {
              this.log(`received MultiSigWallet ExecutionFailure event with txid: ${event.returnValues.transactionId} ${event.transactionHash}`, 'debug');
              transactionEvents[event.returnValues.transactionId] = event;
              resolveIfPossible();
            }
          ));

          // execute to contract
          const options = Object.assign(JSON.parse(JSON.stringify(inputOptions)), {
            event: { target: 'MultiSigWallet', eventName: 'Submission', },
            getEventResult: (event, args) => {
              this.log(`received MultiSigWallet Submission event with hash: ${event.transactionHash} and txid: ${args.transactionId}`, 'debug');
              transactionHash = event.transactionHash;
              walletTransactionId = args.transactionId;
              resolveIfPossible();
            }
          });
          await this.options.executor.executeContractTransaction(
            walletInstance,
            'submitTransaction',
            options,
            target.options.address,
            inputOptions.value || 0,
            encoded,
          );
          resolveIfPossible();
        } catch (ex) {
          reject(ex);
        }
      });
    } catch (ex) {
      throw new Error(ex.message || ex);
    } finally {
      // cleanup subscriptions
      await Promise.all(subscriptions.map(s => this.options.eventHub.unsubscribe({ subscription: s })));
    }

    return receipt;
  }

  private encodeFunctionParams(functionName: string, contractInstance: any, params: any[]) {
    if (params.length) {
      return contractInstance.options.jsonInterface
        .filter(json => json.name === functionName && json.inputs.length === params.length)
        .map(json => [ json.inputs.map(input => input.type), this.options.executor.web3.eth.abi.encodeFunctionSignature(json) ])
        .map(([types, signature]) => `${signature}${coder.encodeParameters(types, params).replace('0x', '')}`)[0]
      ;
    } else {
      return '0x';
    }
  }

  private ensureContract(): any {
    if (!this.walletContract) {
      throw new Error('no wallet contract specified at wallet helper, load or create one');
    }
    return this.walletContract;
  }
}
