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

import {
  ContractLoader,
  EventHub,
  Executor,
  ExecutorOptions,
  SignerInterface,
} from '@evan.network/dbcp';

import { AbiCoder } from 'web3-eth-abi';
import { Wallet } from './wallet';


const coder: AbiCoder = new AbiCoder();

/**
 * options for executor instance
 */
export interface ExecutorWalletOptions extends ExecutorOptions {
  contractLoader: ContractLoader;
  accountId: string;
  wallet: Wallet;
  defaultOptions?: any;
}


/**
 * helper for calling contract functions, executing transactions, uses wallet for performing
 * transactions
 *
 * @class      ExecutorWallet (name)
 */
export class ExecutorWallet extends Executor {
  options: ExecutorWalletOptions;

  /**
   * note, that the ExecutorWallet requires the "init" function to be called when intending to use
   * EventHub helper for transactions with event return values
   */
  constructor(options: ExecutorWalletOptions) {
    super(options);
    this.options = options;
    this.defaultOptions = options.defaultOptions || {};
  }

  /**
   * will throw, as creating contracts directly is not supported by the walled based executor
   *
   * @param      {string}        contractName       contract name
   * @param      {any[]}         functionArguments  arguments for contract creation, pass empty
   *                                                Array if no arguments
   * @param      {any}           inputOptions       transaction arguments, having at least .from and
   *                                                .gas
   * @return     {Promise<any>}  new contract
   */
  async createContract(contractName: string, functionArguments: any[], inputOptions: any):
      Promise<any> {
    this.log(`starting creation of contract "${contractName}"`, 'debug');
    const compiledContract = this.options.contractLoader.getCompiledContract(contractName);
    if (!compiledContract || !compiledContract.bytecode) {
      throw new Error(`cannot find contract bytecode for contract "${contractName}"`);
    }
    // build bytecode and arguments for constructor
    const input = `0x${compiledContract.bytecode}` +
      this.encodeConstructorParams(JSON.parse(compiledContract.interface), functionArguments);
    // submit tx; ContractCreated event is handled in submitRawTransaction, if target is null
    const txInfo = await this.options.wallet.submitRawTransaction(
      null, input, Object.assign({}, inputOptions, { from: this.options.accountId }));
    if (!txInfo.result) {
      throw new Error(`contract creation failed; txInfo: ${txInfo}`)
    } else {
      return this.options.contractLoader.loadContract(contractName, txInfo.result);
    }
  }

  /**
   * @brief      run the given call from contract
   *
   * @param      {any}           contract      the target contract
   * @param      {string}        functionName  name of the contract function to call
   * @param      {any[]}         args          optional array of arguments for contract call. if
   *                                           last arguments is {Object}, it is used as the options
   *                                           parameter
   * @return     {Promise<any>}  resolves to: {Object} contract calls result
   */
  async executeContractCall(contract: any, functionName: string, ...args): Promise<any>  {
    this.log(`starting contract call "${functionName}"`, 'debug');
    if (!contract.methods[functionName]) {
      throw new Error(`contract does not support method "${functionName}", ` +
        `supported methods are ${Object.keys(contract.methods)}`);
    }
    if (!contract || !contract.options || !contract.options.address) {
      throw new Error('contract undefined or contract has no address');
    }
    let options;
    options = this.defaultOptions ? Object.assign({}, this.defaultOptions) : null;
    if (args.length && typeof args[args.length - 1] === 'object') {
      // merge options, use wallet address as from
      options = Object.assign(
        options || {},
        args[args.length - 1],
        { from: this.options.wallet.walletAddress, },
      );
      return contract.methods[functionName].apply(
        contract.methods, args.slice(0, args.length - 1)).call(options);
    } else if (options) {
      return contract.methods[functionName].apply(contract.methods, args).call(options);
    } else {
      return contract.methods[functionName].apply(contract.methods, args).call();
    }
  }

  /**
   * execute a transaction against the blockchain, handle gas exceeded and return values from
   * contract function
   *
   * transactions, that transfer EVEs, will be rejected
   *
   * @param      {any}           contract           contract instance
   * @param      {string}        functionName       name of the contract function to call
   * @param      {any}           inputOptions       currently supported: from, gas, event,
   *                                                getEventResult, eventTimeout, estimate, force
   * @param      {any[]}         functionArguments  optional arguments to pass to contract
   *                                                transaction
   * @return     {Promise<any>}  Promise, that resolves to: no result (if no event to watch was
   *                             given), the event (if event but no getEventResult was given), the
   *                             value returned by getEventResult(eventObject)
   */
  async executeContractTransaction(
      contract: any, functionName: string, inputOptions: any, ...functionArguments: any[]):
      Promise<any> {
    // autoGas 1.1 ==> if truthy, enables autoGas 1.1 ==> adds 10% to estimated value capped to
    // current block maximum minus 4* the allowed derivation per block -
    // The protocol allows the miner of a block
    // to adjust the block gas limit by a factor of 1/1024 (0.0976%) in either direction.
    // (http://hudsonjameson.com/2017-06-27-accounts-transactions-gas-ethereum/) makes it
    // Math.min(gasEstimated * autoGas, gasLimitCurrentBlock  * 255/256)
    this.log(`starting contract transaction "${functionName}"`, 'debug');
    if (inputOptions.value && parseInt(inputOptions.value, 10)) {
      if (typeof inputOptions.value !== 'string') {
        inputOptions.value = `0x${inputOptions.value.toString(16)}`
      }
    }
    if (!this.signer) {
      throw new Error('signer is undefined');
    }
    if (!contract.methods[functionName]) {
      throw new Error(`contract does not support method "${functionName}", ` +
        `supported methods are ${Object.keys(contract.methods)}`);
    }
    if (!contract || !contract.options || !contract.options.address) {
      throw new Error('contract undefined or contract has no address');
    }

    // every argument beyond the third is an argument for the contract function
    let options = Object.assign(
      { timeout: 300000 },
      this.defaultOptions || {},
      inputOptions,
    );

    // keep timeout before deletion
    const transactionTimeout = options.eventTimeout || options.timeout;

    // strip unrelated option
    this.scrubOptions(options);

    let autoGas;
    if (inputOptions.autoGas) {
      autoGas = inputOptions.autoGas;
    } else if (this.config && this.config.alwaysAutoGasLimit) {
      autoGas = this.config.alwaysAutoGasLimit;
    } else {
      autoGas = false;
    }

    const initialArguments = functionArguments.slice(0);
    const logGas = (extraParams) => {
      const staticEntries = {
        arguments: initialArguments,
        contract: contract.address || contract._address,
        from: inputOptions.from,
        gasEstimated: null,
        gasGiven: options.gas,
        gasUsed: 0,
        status: 'unknown',
        transaction: functionName,
        transactionHash: null,
      };
      const level = 'gasLog';
      this.log(JSON.stringify(Object.assign(staticEntries, extraParams)), level);
    }
    return new Promise(async (resolve, reject) => {
      // keep track of the promise state via variable as we may run into a timeout
      let isPending = true;
      let transactionHash;
      const eventResults = { };

      // timeout and event listener with this
      let subscription;
      const stopWatching = async (isError?) => {
        return new Promise((resolveStop) => {
          setTimeout(() => {
        if (inputOptions.event && subscription) {
          if (this.eventHub) {
            this.eventHub
              .unsubscribe({ subscription})
              .catch((ex) => {
                this.log('error occurred while unsubscribing from transaction event; ' +
                  `${ex.message || ex}${ex.stack || ''}`, 'error');
              })
            ;
          } else {
            reject('passed an event to a transaction but no event hub registered');
          }
        }
        isPending = false;
            resolveStop();
          }, isError ? 1000 : 0);
        });
      }

      try {
        // timeout rejects promise if not already done so
        setTimeout(async () => {
          if (isPending) {
            await stopWatching(true);
            logGas({ status: 'error', message: 'timeout' });
            reject(new Error(`timeout after ${transactionTimeout}ms during ${functionName}`));
          }
        }, transactionTimeout);

        // if we wait for a 'result', pick this result from event watch and resolve the promise
        if (inputOptions.event) {
          if (this.eventHub) {
            this.eventHub
              .subscribe(
                inputOptions.event.target,
                contract.options.address,
                inputOptions.event.eventName,
                (event) => true,
                (event) => {
                  if (transactionHash === event.transactionHash) {
                    // if we have a retriever function, use it, otherwise return entire event object
                    if (inputOptions.getEventResult) {
                      resolve(inputOptions.getEventResult(event, event.args || event.returnValues));
                    } else {
                      resolve(event);
                    }
                  } else {
                    // if execution event is fired before callback,
                    // hold the evenTransaction and trigger resolve within execution callback
                    eventResults[event.transactionHash] = event;
                  }
                }
              )
              .then((result) => { subscription = result; })
              .catch((ex) => {
                this.log('error occurred while subscribing to transaction event; ' +
                  `${ex.message || ex}; ${ex.stack || ''}`, 'error');
              })
            ;
          } else {
            this.log('passed an event to a transaction but no event hub registered', 'warning');
          }
        }

        // add options and callback function to arguments
        functionArguments.push(options);
        // const estimationArguments = functionArguments.slice();
        let gasEstimated;
        let executeCallback;
        const estimationCallback = async (estimationError, gasAmount) => {
          gasEstimated = gasAmount;
          if (estimationError) {
            await stopWatching(true);
            logGas({ status: 'error', message: `could not estimate; ${estimationError}` });
            reject(`could not estimate gas usage for ${functionName}: ${estimationError}; ` +
              estimationError.stack);
          } else if (inputOptions.estimate) {
            await stopWatching();
            resolve(gasAmount);
          } else if (!inputOptions.force &&
              parseInt(inputOptions.gas, 10) === parseInt(gasAmount, 10)) {
            await stopWatching(true);
            logGas({ status: 'error', message: 'out of gas estimated' });
            reject(`transaction ${functionName} by ${options.from} would most likely fail`);
          } else {
            // execute contract function
            // recover original from, as estimate converts from to lower case
            // overwrite given gas with estimation plus autoGas factor
            if (inputOptions.timeout) {
              options.timeout = inputOptions.timeout;
            }
            if (autoGas) {
              this.web3.eth.getBlock('latest', (blockError, result) => {
                if (blockError) {
                  reject(`could not get latest block for ${functionName}: ${blockError}; ` +
                    blockError.stack);
                } else {
                  const currentLimit = result.gasLimit;
                  const gas = Math.floor(
                    Math.min(gasEstimated * autoGas, currentLimit * (255 / 256)));
                  logGas({
                    status: 'autoGas.estimation',
                    gasEstimated: gasEstimated,
                    gasGiven: gas,
                    message: `estimated with ${autoGas}`,
                  });
                  options.gas = gas;
                  this.signAndExecuteTransactionViaWallet(
                    contract,
                    functionName,
                    functionArguments.slice(0, -1),
                    Object.assign({}, options),
                    (...args) => {
                      executeCallback.apply(this, args).catch((ex) => { reject(ex); });
                    },
                  );
                }
              });
            } else {
              this.signAndExecuteTransactionViaWallet(
                contract,
                functionName,
                functionArguments.slice(0, -1),
                Object.assign({}, options),
                (...args) => { executeCallback.apply(this, args).catch((ex) => { reject(ex); }); },
              );
            }
          }
        };

        executeCallback = async (err, packedResult) => {
          if (err) {
            return reject(`${functionName} failed: ${err}`);
          }
          const { receipt } = packedResult;
          try {
            // keep transaction hash for checking agains it in event
            transactionHash = receipt && receipt.transactionHash ? receipt.transactionHash : '';
            if (err) {
              this.log(`${functionName} failed: ${err.message || err}`, 'error');
              logGas({
                status: 'error',
                message: 'transaction submit error',
                gasEstimated,
                transactionHash,
              });
              reject(err);
            } else {
              let optionsGas;
              if (typeof options.gas === 'string' && options.gas.startsWith('0x')) {
                optionsGas = parseInt(options.gas, 16);
              } else {
                optionsGas = parseInt(options.gas, 10);
              }
              if (optionsGas !== receipt.gasUsed) {
                logGas({
                  status: 'success',
                  gasUsed: receipt.gasUsed,
                  gasEstimated,
                  transactionHash,
                });
                // log autoGas entry
                if (autoGas) {
                  logGas({
                    status: 'autoGas.success',
                    gasEstimated,
                    gasGiven: options.gas,
                    gasUsed: receipt.gasUsed,
                    message: `estimated with ${autoGas}`,
                  });
                }
                // if no event to watch for was given, resolve promise here
                if (!inputOptions.event || !this.eventHub) {
                  isPending = false;
                  resolve();
                } else if (eventResults[transactionHash]) {
                  await stopWatching();
                  if (inputOptions.getEventResult) {
                    resolve(inputOptions.getEventResult(
                      eventResults[transactionHash],
                      eventResults[transactionHash].args ||
                        eventResults[transactionHash].returnValues
                    ));
                  } else {
                    resolve(eventResults[transactionHash]);
                  }
                }
              } else {
                const errorText = 'all gas used up';
                this.log(`${functionName} failed: ${errorText}`, 'error');
                // log autoGas entry
                if (autoGas) {
                  logGas({
                    status: 'autoGas.error',
                    gasEstimated,
                    gasGiven: options.gas,
                    gasUsed: receipt.gasUsed,
                    message: `estimated with ${autoGas}`,
                  });
                }
                if (inputOptions.event && this.eventHub) {
                  await stopWatching(true);
                }
                logGas({
                  status: 'error',
                  message: 'transaction failed',
                  gasUsed: receipt.gasUsed,
                  gasEstimated,
                  transactionHash,
                });
                reject(errorText);
              }
            }
          } catch (ex) {
            return reject(`${functionName} failed: ${ex.message}`);
          }
        };
        // estimate tx with wallet accountid instead of users account id
        const estimateOptions = Object.assign(
          {}, options, { from: this.options.wallet.walletAddress, });
        contract.methods[functionName]
          .apply(contract.methods, initialArguments)
          .estimateGas(
            estimateOptions,
            (...args) => { estimationCallback.apply(this, args).catch((ex) => { reject(ex); }); },
          )
        ;
      } catch (ex) {
        this.log(`${functionName} failed: ${ex.message}`, 'error');
        await stopWatching(true);
        logGas({ status: 'error', message: 'transaction could not be started' });
        reject(ex);
      }
    });
  }

  /**
   * will throw, as sending funds directly is not supported by the walled based executor
   *
   * @param      {any}            inputOptions  transaction options, having at least from, to and
   *                                            value
   * @return     {Promise<void>}  resolved when done
   */
  async executeSend(inputOptions): Promise<void> {
    throw new Error(`sending funds is not supported by the walled based executor`);
  }

  /**
   * Should be called to encode constructor params (taken from
   * https://github.com/ethereum/web3.js/blob/develop/lib/web3/contract.js)
   *
   * @param      abi     The abi
   * @param      params  The parameters
   *
   * @return     encoded params
   */
  private encodeConstructorParams(abi: any[], params: any[]) {
    if (params.length) {
      return abi
        .filter(json => json.type === 'constructor' && json.inputs.length === params.length)
        .map(json => json.inputs.map(input => input.type))
        .map(types => coder.encodeParameters(types, params))
        .map(encodedParams => encodedParams.replace(/^0x/, ''))[0] || ''
      ;
    } else {
      return '';
    }
  }

  /**
   * create, sign and submit a contract transaction with private key of options.from
   *
   * @param      {any}       contract           contract instance from api.eth.loadContract(...)
   * @param      {string}    functionName       function name
   * @param      {any[]}     functionArguments  arguments for contract creation, pass empty Array if
   *                                            no arguments
   * @param      {any}       options            transaction arguments, having at least .from and
   *                                            .gas
   * @param      {function}  handleTxResult     callback(error, result)
   * @return     {void}
   */
  private signAndExecuteTransactionViaWallet (
      contract, functionName, functionArguments, options, handleTxResult): void {
    this.log(`using wallet ${this.options.wallet.walletAddress} ` +
      `for making transaction "${functionName}"`, 'debug');
    this.options.wallet
      .submitTransaction(
        contract,
        functionName,
        Object.assign({}, options, { from: this.options.accountId }),
        ...functionArguments,
      )
      .then((result) => Promise.all([this.options.web3.eth.getTransactionReceipt(result.event.transactionHash), result]))
      .then(([receipt, result]) => { handleTxResult(null, { receipt, ...result }); })
      .catch((error) => { handleTxResult(error); })
    ;
  }
}
