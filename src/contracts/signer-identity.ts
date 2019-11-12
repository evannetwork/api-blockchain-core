/*
  Copyright (c) 2018-present evan GmbH.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import {
  ContractLoader,
  Logger,
  LoggerOptions,
  SignerInterface,
  SignerInternal,
  SignerInternalOptions,
} from '@evan.network/dbcp';

import { AbiCoder } from 'web3-eth-abi';
import { Verifications } from '../verifications/verifications';


/**
 * signer identity config
 */
export interface SignerIdentityConfig {
  activeIdentity: string;
  underlyingAccountId: string;
  underlyingSigner: SignerInterface;
}

/**
 * signer identity options
 */
export interface SignerIdentityOptions extends LoggerOptions {
  contractLoader: ContractLoader;
  verifications: Verifications;
  web3: any;
}

/**
 * Signer, that can sign transactions for identity based transactions. If given an identity contract
 * address as `.from`, an identity based transaction is made, if given an accountId as `.from`, a
 * direct transaction via externally owned account is made.
 *
 * @class      SignerIdentity (name)
 */
export class SignerIdentity extends Logger implements SignerInterface {
  public activeIdentity: string;
  public underlyingAccountId: string;
  private coder: any = new AbiCoder();
  private config: SignerIdentityConfig;
  private options: SignerIdentityOptions;

  public constructor(options: SignerIdentityOptions, config: SignerIdentityConfig) {
    super(options);
    this.options = options;
    this.config = config;
    this.activeIdentity = this.config.activeIdentity;
    this.underlyingAccountId = this.config.underlyingAccountId;
  }

  /**
   * Creates a smart contract.
   *
   * @param      {string}  contractName       contract name
   * @param      {any[]}   functionArguments  arguments for contract creation, pass empty Array if
   *                                          no arguments
   * @param      {any}     options            transaction options, having at least .from and .gas
   * @return     {Promise<any>}  new contract reference
   */
  public async createContract(
    contractName: string,
    functionArguments: any[],
    options: any,
  ): Promise<any> {
    if (options.from === this.config.underlyingAccountId) {
      return this.config.underlyingSigner.createContract(contractName, functionArguments, options);
    }
    // build input for contructror call
    const compiledContract = this.options.contractLoader.getCompiledContract(contractName);
    if (!compiledContract || !compiledContract.bytecode) {
      throw new Error(`cannot find contract bytecode for contract "${contractName}"`);
    }
    // build bytecode and arguments for constructor
    options.input = `0x${compiledContract.bytecode}` +
      this.encodeConstructorParams(JSON.parse(compiledContract.interface), functionArguments);

    const { blockNumber, transactionHash } = await this.handleIdentityTransaction(null, null, [], options);
    const keyHolderLibrary = this.options.contractLoader.loadContract(
      'KeyHolderLibrary', this.config.activeIdentity);
    const events = await keyHolderLibrary.getPastEvents(
        'ContractCreated', { fromBlock: blockNumber, toBlock: blockNumber });
    const matches = events.filter(ev => ev.transactionHash === transactionHash);
    if (matches.length !== 1) {
      throw new Error('contract creation failed');
    }
    return this.options.contractLoader.loadContract(
      contractName, matches[0].returnValues.contractId);
  }

  /**
   * Performs a value transfer transaction. This will send specified funds to identity, which will
   * send it to target. Funds are returned if transaction fails.
   *
   * @param      {any}       options         options for transaction
   * @param      {Function}  handleTxResult  result handler function
   * @return     {Promise<void>}  resolved when done
   */
  public async signAndExecuteSend(
    options: any,
    handleTxResult: Function,
  ): Promise<void> {
    if (options.from === this.config.underlyingAccountId) {
      return this.config.underlyingSigner.signAndExecuteSend(options, handleTxResult);
    }

    try {
      debugger;
      handleTxResult(
        null,
        await this.handleIdentityTransaction(null, null, [], { ...options, input: '0x' }),
      );
    } catch (ex) {
      handleTxResult(ex);
    }
  }

  /**
   * Create, sign and submit a contract transaction.
   *
   * @param      {any}       contract           contract instance from api.eth.loadContract(...)
   * @param      {string}    functionName       function name
   * @param      {any[]}     functionArguments  arguments for contract creation, pass empty Array if
   *                                            no arguments
   * @param      {any}       options            transaction arguments, having at least .from and
   *                                            .gas
   * @param      {Function}  handleTxResult     callback(error, result)
   * @return     {Promise<void>}  resolved when done
   */
  public async signAndExecuteTransaction(
    contract: any,
    functionName: string,
    functionArguments: any[],
    options: any,
    handleTxResult: Function,
  ): Promise<void> {
    if (options.from === this.config.underlyingAccountId) {
      return this.config.underlyingSigner.signAndExecuteTransaction(
        contract, functionName, functionArguments, options, handleTxResult);
    }

    try {
      handleTxResult(
        null,
        await this.handleIdentityTransaction(contract, functionName, functionArguments, options),
      );
    } catch (ex) {
      handleTxResult(ex);
    }
  }

  /**
   * Sign given message with accounts private key, does not work for identity.
   *
   * @param      {string}  accountId  accountId to sign with
   * @param      {string}  message    message to sign
   * @return     {Promise<string}  signature
   */
  public async signMessage(
    accountId: string,
    message: string,
  ): Promise<string> {
    if (accountId === this.config.underlyingAccountId) {
      return this.config.underlyingSigner.signMessage(accountId, message);
    } else {
      throw new Error('signing messages with identities is not supported');
    }
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
        .map(types => this.coder.encodeParameters(types, params))
        .map(encodedParams => encodedParams.replace(/^0x/, ''))[0] || ''
      ;
    } else {
      return '';
    }
  }

  /**
   * Performs a transaction via identity contract.
   *
   * @param      {any}     contract           target contract
   * @param      {string}  functionName       function that is called
   * @param      {any}     functionArguments  arguments for function
   * @param      {any}     options            transaction options (web3 options, event handling)
   * @return     {Promise<any>}               result of transaction if anny
   */
  private async handleIdentityTransaction(
    contract: any,
    functionName: string,
    functionArguments: any[],
    options: any,
  ): Promise<any> {
    // replace tx origin with underlying account
    const optionsClone = { ...options };
    optionsClone.from = this.config.underlyingAccountId;

    // sign identity tx for this account
    const txInfo = await this.options.verifications.signTransaction(
      contract,
      functionName,
      optionsClone,
      ...functionArguments
    );
    const txResult = await this.options.verifications.executeTransaction(
      this.config.underlyingAccountId,
      txInfo,
      {
        event: {
          contract: this.options.contractLoader.loadContract(
            'VerificationHolder', this.config.activeIdentity),
          eventName: 'ExecutionRequested',
        },
        getEventResult: ({ transactionHash }) =>
          this.options.web3.eth.getTransactionReceipt(transactionHash),
      }
    );
    return txResult;
  }
}
