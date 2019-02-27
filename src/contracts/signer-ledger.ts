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

import BigNumber = require('bignumber.js');
import coder = require('web3-eth-abi');
import Eth from "@ledgerhq/hw-app-eth";
import Transaction = require('ethereumjs-tx');
import TransportNodeHid from "@ledgerhq/hw-transport-node-hid";

import {
  Logger,
  LoggerOptions,
  SignerInterface,
} from '@evan.network/dbcp';

const nonces = {};

/**
 * signer internal instance options
 */
export interface SignerLedgerOptions extends LoggerOptions {
  contractLoader: any;
  config: any;
  web3: any;
  chainId?: number;
}

export class SignerLedger extends Logger implements SignerInterface {
  chainId: number;
  config: any;
  contractLoader: any;
  eth: Eth;
  hdPath = `44'/60'/0'/0/0`;
  web3: any;

  constructor(options: SignerLedgerOptions) {
    super(options);
    this.chainId = options.chainId || 508674158;
    this.contractLoader = options.contractLoader;
    this.config = options.config;
    this.web3 = options.web3;
  }

  public async init(): Promise<void> {
    const transport = await TransportNodeHid.open('');
    transport.setDebugMode(true);
    this.eth = new Eth(transport);
  }

  /**
   * patch '0x' prefix to input if not already added, also casts numbers to hex string
   *
   * @param      input  input to prefix with '0x'
   *
   * @return     patched input
   */
  ensureHashWithPrefix(input: string | number) {
    if (typeof input === 'number') {
      return `0x${input.toString(16)}`;
    } else if (!input.toString().startsWith('0x')) {
      return `0x${input}`;
    }
    return input;
  }

  /**
   * get gas price (either from config or from api.eth.web3.eth.gasPrice (gas price median of last
   * blocks) or api.config.eth.gasPrice; unset config value or set it to falsy for median gas price
   *
   * @return     hex string with gas price
   */
   getGasPrice() {
    let chain;
    if (this.config.gasPrice) {
      chain = Promise.resolve(this.config.gasPrice);
    } else {
      chain = this.web3.eth
        .getGasPrice()
        .then((gp) => {
          if (gp === '0' || gp === 0) {
            this.log(`returned gas price was 0, using fallback 20GWei`, 'debug');
            return '20000000000';
          } else {
            return '20000000000';
          }
        })
      ;
    }
    return chain
      .then(priceWei => this.ensureHashWithPrefix(parseInt(priceWei, 10).toString(16)))
    ;
  }

  /**
   * gets nonce for current user, looks into actions submitted by current user in current block for
   * this as well
   *
   * @param      accountId  Ethereum account ID
   *
   * @return     nonce of given user
   */
  getNonce(accountId: string) {
    return this.web3.eth
      .getTransactionCount(accountId)
      .then((count) => {
        const nonce = Math.max((nonces[accountId] || 0), count);
        nonces[accountId] = nonce + 1;
        this.log(`current nonce: ${nonce}`, 'debug');
        return nonce;
      })
    ;
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
  encodeConstructorParams(abi: any[], params: any[]) {
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

  async signAndExecuteSend(options, handleTxResult) {
    this.log('will sign tx for eth for transaction', 'debug');
    const [gasPrice, nonce] = await Promise.all([
      typeof options.gasPrice !== 'undefined' ? options.gasPrice : this.getGasPrice(),
      this.getNonce(options.from),
    ]);
    const tx = new Transaction({
      nonce,
      gasPrice,
      gasLimit: this.ensureHashWithPrefix(options.gas),
      to: options.to,
      chainId: this.chainId,
    });
    const signed = await this.signTransaction(tx, options.from);
    this.web3.eth.sendSignedTransaction(signed)
      .on('receipt', (receipt) => { handleTxResult(null, receipt); })
      .on('error', (error) => { handleTxResult(error); })
    ;
  }

  /**
   * create, sing and submit a contract transaction with private key of options.from
   *
   * @param      contract           contract instance from api.eth.loadContract(...)
   * @param      functionName       function name
   * @param      functionArguments  arguments for contract creation, pass empty Array if no
   *                                arguments
   * @param      options            transaction arguments, having at least .from and .gas
   * @param      handleTxResult     callback(error, result)
   *
   * @return     Promise, resolved when done or resolves to event result if event given
   */
  signAndExecuteTransaction(contract, functionName, functionArguments, options, handleTxResult) {
    throw new Error('not implemented');
    // this.log(`will sign tx for function "${functionName}"`, 'debug');
    // Promise
    //   .all([
    //     this.getPrivateKey(options.from),
    //     typeof options.gasPrice !== 'undefined' ? options.gasPrice : this.getGasPrice(),
    //     this.getNonce(options.from),
    //   ])
    //   .then(([privateKey, gasPrice, nonce]: [string, number, number]) => {
    //     /* eslint-disable no-underscore-dangle */
    //     const data = contract.methods[functionName](...functionArguments).encodeABI();
    //     /* eslint-enable no-underscore-dangle */
    //     const txParams = {
    //       nonce,
    //       gasPrice,
    //       gasLimit: this.ensureHashWithPrefix(options.gas),
    //       to: contract.options.address,
    //       value: options.value ? ('0x' + (new BigNumber(options.value, 10)).toString(16)) : 0,
    //       data: this.ensureHashWithPrefix(data),
    //       chainId: NaN,
    //     };

    //     const privateKeyBuffer = Buffer.from(privateKey, 'hex');
    //     const txObject = new Transaction(txParams);
    //     txObject.sign(privateKeyBuffer);
    //     const signedTx = this.ensureHashWithPrefix(txObject.serialize().toString('hex'));

    //     // submit via sendRawTransaction
    //     this.web3.eth.sendSignedTransaction(signedTx)
    //       .on('receipt', (receipt) => { handleTxResult(null, receipt); })
    //       .on('error', (error) => { handleTxResult(error); })
    //     ;
    //   })
    //   .catch((ex) => {
    //     const msg = `could not sign transaction; "${(ex.message || ex)}${ex.stack ? ex.stack : ''}"`;
    //     handleTxResult(msg);
    //   })
    // ;
  }


  /**
   * creates a contract by contstructing creation transaction and signing it with private key of
   * options.from
   *
   * @param      contractName       contract name
   * @param      functionArguments  arguments for contract creation, pass empty Array if no
   *                                arguments
   * @param      options            transaction arguments, having at least .from and .gas
   *
   * @return     Promise, resolved when done
   */
  public async createContract(contractName: string, functionArguments: any[], options: any): Promise<any> {
    this.log('will sign tx for contract creation', 'debug');
    const compiledContract = this.contractLoader.getCompiledContract(contractName);
    if (!compiledContract) {
      throw new Error(`cannot find contract description for contract "${contractName}"`);
    }
    const [gasPrice, nonce] = await Promise.all([
      typeof options.gasPrice !== 'undefined' ? options.gasPrice : this.getGasPrice(),
      this.getNonce(options.from),
    ]);
    const abi = JSON.parse(compiledContract.interface);
    const tx = new Transaction({
      nonce,
      gasPrice,
      gasLimit: this.ensureHashWithPrefix(options.gas),
      value: options.value || 0,
      data: this.ensureHashWithPrefix(
        `${compiledContract.bytecode}` +
        `${this.encodeConstructorParams(abi, functionArguments)}`),
      chainId: this.chainId,
    })
    debugger;
    const signed = await this.signTransaction(tx, options.from);
    const receipt = await this.web3.eth.sendSignedTransaction(signed);
    if (options.gas === receipt.gasUsed) {
      throw new Error('all gas used up');
    } else {
      this.log(`contract creation of "${contractName}" used ${receipt.gasUsed} gas`)
      return new this.web3.eth.Contract(abi, receipt.contractAddress);
    }
  }
  public async getAccount(): Promise<string> {
    return (await this.eth.getAddress(this.hdPath)).address;
  }

  public async signMessage(message: string): Promise<string> {
    const { r, s, v } = await this.eth.signPersonalMessage(this.hdPath, Buffer.from(message, 'utf-8'));
    const vHex = (v - 27).toString(16).padStart(2, '0')
    return `0x${r}${s}${vHex}`;
  }

  public async signTransaction(tx, accountId): Promise<string> {
    tx.raw[6] = this.chainId // v
    tx.raw[7] = Buffer.from([]) // r
    tx.raw[8] = Buffer.from([]) // s

    const result = await this.eth.signTransaction(this.hdPath, tx.serialize().toString('hex'))
 
    var v = result['v'].toString(16);
    // EIP155 support. check/recalc signature v value.
    var rv = parseInt(v, 16);
    var cv = tx._chainId * 2 + 35;
    if (rv !== cv && (rv & cv) !== rv) {
      cv += 1; // add signature v bit.
    }
    v = cv.toString(16);
    tx.v = `0x${v}`;
    tx.r = `0x${result['r']}`;
    tx.s = `0x${result['s']}`;
 
    const signedChainId = Math.floor((tx.v[0] - 35) / 2) // EIP155: v should be chain_id * 2 + {35, 36}
    const validChainId = this.chainId & 0xff // eslint-disable-line no-bitwise
 
    let signed = `0x${tx.serialize().toString('hex')}`;
    if (this.web3.eth.accounts.recoverTransaction(signed) !== accountId) {
      this.log('signer account missmatch, resigning tx', 'debug');
      cv += 1;
      v = cv.toString(16);
      tx.v = "0x" + v;
      signed = `0x${tx.serialize().toString('hex')}`;
    }
    return signed;
  }
}
