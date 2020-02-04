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
  Logger,
  LoggerOptions,
  SignerInterface,
} from '@evan.network/dbcp';

import { AbiCoder } from 'web3-eth-abi';
import { Verifications } from '../verifications/verifications';


/**
 * signer identity config
 */
export interface SignerIdentityConfig {
  activeIdentity: string;
  underlyingAccount: string;
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

  public underlyingAccount: string;

  private coder: any = new AbiCoder();

  private config: SignerIdentityConfig;

  private options: SignerIdentityOptions;

  /**
   * Creates a new `SignerInternal` instance. `config` can be set up later on with `updateConfig`,
   * if required (e.g. when initializing a circular structure).
   *
   * @param      {SignerIdentityOptions}  options  runtime like object
   * @param      {SignerIdentityConfig}  config    (optional) config for `SignerInternal`
   */
  public constructor(options: SignerIdentityOptions, config: SignerIdentityConfig = null) {
    super(options);
    this.options = options;
    if (config) {
      this.updateConfig(options, config);
    }
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
    if (options.from === this.underlyingAccount) {
      return this.config.underlyingSigner.createContract(contractName, functionArguments, options);
    }
    if (options.from !== this.activeIdentity) {
      throw new Error(`given accountId ${options.from} `
          + 'is neither configured as underlying accountId or active identity');
    }
    // build input for constructor call
    const compiledContract = this.options.contractLoader.getCompiledContract(contractName);
    if (!compiledContract || !compiledContract.bytecode) {
      throw new Error(`cannot find contract bytecode for contract "${contractName}"`);
    }
    // build bytecode and arguments for constructor
    // eslint-disable-next-line no-param-reassign
    options.input = `0x${compiledContract.bytecode}${
      this.encodeConstructorParams(JSON.parse(compiledContract.interface), functionArguments)}`;

    const { blockNumber, transactionHash } = await this.handleIdentityTransaction(
      null,
      null,
      [],
      options,
    );
    const keyHolderLibrary = this.options.contractLoader.loadContract(
      'KeyHolderLibrary', this.activeIdentity,
    );
    const events = await keyHolderLibrary.getPastEvents(
      'ContractCreated', { fromBlock: blockNumber, toBlock: blockNumber },
    );
    const matches = events.filter((ev) => ev.transactionHash === transactionHash);
    if (matches.length !== 1) {
      throw new Error('contract creation failed');
    }
    return this.options.contractLoader.loadContract(
      contractName, matches[0].returnValues.contractId,
    );
  }

  /**
   * get gas price (either from config or from api.eth.web3.eth.gasPrice (gas price median of last
   * blocks) or api.config.eth.gasPrice; unset config value or set it to falsy for median gas price
   *
   * @return    {Promeise<string>} hex string with gas price
   */
  public async getGasPrice(): Promise<string> {
    return this.config.underlyingSigner.getGasPrice();
  }

  /**
   * get public key for given account
   *
   * @param      {string}  accountId  account to get public key for
   */
  public async getPublicKey(accountId: string): Promise<string> {
    if (accountId !== this.underlyingAccount) {
      throw new Error('getting public key is only supported for \'underlyingAccount\'');
    }

    return this.config.underlyingSigner.getPublicKey(accountId);
  }

  /**
   * Performs a value transfer transaction. This will send specified funds to identity, which will
   * send it to target. Funds are returned if transaction fails.
   *
   * @param      {any}       options         options for transaction
   * @param      {Function}  handleTxResult  result handler function
   * @return     {Promise<void>}  resolved when done
   */
  // eslint-disable-next-line consistent-return
  public async signAndExecuteSend(
    options: any,
    handleTxResult: Function,
  ): Promise<void> {
    if (options.from === this.underlyingAccount) {
      return this.config.underlyingSigner.signAndExecuteSend(options, handleTxResult);
    }
    if (options.from !== this.activeIdentity) {
      handleTxResult(`given accountId ${options.from} `
        + 'is neither configured as underlying accountId or active identity');
      return Promise.resolve();
    }

    try {
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
  // eslint-disable-next-line consistent-return
  public async signAndExecuteTransaction(
    contract: any,
    functionName: string,
    functionArguments: any[],
    options: any,
    handleTxResult: Function,
  ): Promise<void> {
    if (options.from === this.underlyingAccount) {
      return this.config.underlyingSigner.signAndExecuteTransaction(
        contract, functionName, functionArguments, options, handleTxResult,
      );
    }
    if (options.from !== this.activeIdentity) {
      handleTxResult(`given accountId ${options.from} `
        + 'is neither configured as underlying accountId or active identity');
      return Promise.resolve();
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
    if (accountId !== this.underlyingAccount) {
      throw new Error('signing messages with identities is only supported for \'underlyingAccount\'');
    }
    return this.config.underlyingSigner.signMessage(accountId, message);
  }

  /**
   * Update config of `SignerInternal` can also be used to setup verifications and accounts after
   * initial setup and linking with other modules.
   *
   * @param      {{ verifications: Verifications }}  partialOptions  object with `verifications`
   *                                                                 property, e.g. a runtime
   * @param      {SignerIdentityConfig}              config          signer identity config
   */
  public updateConfig(
    partialOptions: { verifications: Verifications },
    config: SignerIdentityConfig,
  ): void {
    this.options.verifications = partialOptions.verifications;
    this.config = config;
    this.activeIdentity = this.config.activeIdentity;
    this.underlyingAccount = this.config.underlyingAccount;
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
        .filter((json) => json.type === 'constructor' && json.inputs.length === params.length)
        .map((json) => json.inputs.map((input) => input.type))
        .map((types) => this.coder.encodeParameters(types, params))
        .map((encodedParams) => encodedParams.replace(/^0x/, ''))[0] || '';
    }
    return '';
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
    optionsClone.from = this.underlyingAccount;

    // sign identity tx for this account
    const txInfo = await this.options.verifications.getTransactionInfo(
      contract,
      functionName,
      optionsClone,
      ...functionArguments,
    );
    const txResult = await this.options.verifications.executeTransaction(
      this.underlyingAccount,
      txInfo,
      {
        event: {
          contract: this.options.contractLoader.loadContract(
            'VerificationHolder', this.activeIdentity,
          ),
          eventName: 'ExecutionRequested',
        },
        getEventResult: ({ transactionHash }) => this.options.web3.eth.getTransactionReceipt(
          transactionHash,
        ),
      },
    );
    return txResult;
  }
}
