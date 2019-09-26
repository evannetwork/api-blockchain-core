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

const BigNumber = require('bignumber.js');
const http = require('http');
const https = require('https');
const querystring = require('querystring');
const url = require('url');

/**
 * Use this function instead of request node_module to reduce browser bundle file size.
 *
 * @param      {any}       requestOptions  options including normal request node_module options
 * @param      {Function}  callback        callback function
 */
const request = (requestOptions: any) => {
  return new Promise((resolve, reject) => {
    const requestModule = requestOptions.url.startsWith('https') ? https : http;
    const parsed = url.parse(requestOptions.url);
    let result = '';

    // define request options
    const options = {
      method: requestOptions.method || 'POST',
      headers: requestOptions.header || { 'Content-Type': 'application/json' },
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.path,
    };

    // start the request
    const req = requestModule.request(options, (res) => {
      res.on('data', (d) => result += d);
      res.on('end', () => {
        const resultObj = JSON.parse(result);
        if (resultObj.error) {
          reject(resultObj.error);
        } else {
          resolve(resultObj.result);
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(JSON.stringify(requestOptions.body));
    req.end();
  });
};

import {
  ContractLoader,
  EventHub,
  Executor,
  ExecutorOptions,
  SignerInterface,
} from '@evan.network/dbcp';


/**
 * options for executor agent instance
 */
export interface ExecutorAgentOptions extends ExecutorOptions {
  contractLoader: ContractLoader;
  agentUrl?: string;
  token?: string;
}


/**
 * helper for calling contract functions, executing transactions
 *
 * @class      ExecutorAgent (name)
 */
export class ExecutorAgent extends Executor {
  agentUrl: string;
  config: any;
  contractLoader: ContractLoader;
  defaultOptions: any;
  eventHub: EventHub;
  signer: SignerInterface;
  web3: any;
  token: string;

  /**
   * note, that the ExecutorAgent requires the "init" function to be called when intending to use the
   * EventHub helper for transactions with event return values
   */
  constructor(options: ExecutorAgentOptions) {
    super(options);
    this.config = options.config;
    this.contractLoader = options.contractLoader;
    this.defaultOptions = options.defaultOptions;
    this.signer = options.signer;
    this.token = options.token;
    this.web3 = options.web3;
    this.agentUrl = options.agentUrl || 'http://localhost:8080';
  }

  /**
   * creates a contract by contstructing creation transaction and signing it with private key of
   * options.from
   *
   * transactions, that transfer EVEs, will be rejected
   *
   * @param      {string}        contractName       contract name
   * @param      {any[]}         functionArguments  arguments for contract creation, pass empty
   *                                                Array if no arguments
   * @param      {any}           inputOptions       transaction arguments, having at least .from and
   *                                                .gas
   * @return     {Promise<any>}  new contract
   */
  public async createContract(contractName: string, functionArguments: any[], inputOptions: any): Promise<any> {
    this.log(`starting contract creation for "${contractName}" via agent`, 'debug');
    if (inputOptions.value && parseInt(inputOptions.value, 10)) {
      throw new Error('sending funds is not supported by the agent based executor; ' +
        `value has been set to ${inputOptions.value} for new contract "${contractName}"`);
    }

    // submit to action
    const contractId = await request({
      url: `${this.agentUrl}/api/smart-agents/executor/createContract`,
      method: 'POST',
      body: {
        contractName,
        functionArguments,
        inputOptions,
        token: this.token,
      },
    });
    return this.contractLoader.loadContract(contractName, contractId as string);
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
  public async executeContractCall(contract: any, functionName: string, ...args): Promise<any>  {
    this.log(`starting contract call "${functionName}" via agent`, 'debug');

    // web3 compatibility for 1.2 and 2.0
    let functionSignature;
    if (contract.options.jsonInterface) {
      // web3 1.2
      functionSignature = contract.options.jsonInterface.filter(fun => fun.name === functionName)[0];
    } else {
      // web3 2.0
      functionSignature = contract.abiModel.abi.methods[functionName].abiItem;
    }

    let result: any = await request({
      url: `${this.agentUrl}/api/smart-agents/executor/executeContractCall`,
      method: 'POST',
      body: {
        contractId: contract.options.address,
        functionSignature,
        functionName,
        functionArguments: args,
      },
    });

    // Request response would serialize the result and big numbers can't be detected. The server
    // transforms BigNumbers to numbers and put them into an object, so they can be transformed into
    // BigNumber again.
    if (Array.isArray(result)) {
      result.forEach((value, index) => {
        if (value && value.isBigNumber) {
          result[index] = new BigNumber(result[index].value);
        }
      });
    } else {
      if (result && result.isBigNumber) {
        result = new BigNumber(result.value);
      }
    }

    return result;
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
  public async executeContractTransaction(
    contract: any, functionName: string, inputOptions: any, ...functionArguments: any[]): Promise<any> {
    this.log(`starting contract transaction "${functionName}" via agent`, 'debug');
    if (inputOptions.value && parseInt(inputOptions.value, 10)) {
      throw new Error('sending funds is not supported by the agent based executor; ' +
        `value has been set to ${inputOptions.value} for tx "${functionName}"`);
    }

    // web3 compatibility for 1.2 and 2.0
    let functionSignature;
    if (contract.options.jsonInterface) {
      // web3 1.2
      functionSignature = contract.options.jsonInterface.filter(fun => fun.name === functionName)[0];
    } else {
      // web3 2.0
      functionSignature = contract.abiModel.abi.methods[functionName].abiItem;
    }

    // submit to action
    return request({
      url: `${this.agentUrl}/api/smart-agents/executor/executeContractTransaction`,
      method: 'POST',
      body: {
        contractId: contract.options.address,
        functionSignature,
        functionName,
        options: inputOptions,
        functionArguments,
        token: this.token,
      },
    });
  }

  /**
   * will throw, as sending funds directly is not supported by the walled based executor
   *
   * @param      {any}            inputOptions  transaction options, having at least from, to and
   *                                            value
   * @return     {Promise<void>}  resolved when done
   */
  public async executeSend(inputOptions): Promise<void> {
    throw new Error(`sending funds is not supported by the agent based executor`);
  }

  /**
   * initialize executor
   *
   * @param      {any}  options  object with the property "eventHub" (of the type EventHub)
   */
  public init(options: any) {
    this.eventHub = options.eventHub;
  }

  /**
   * generate a new token for transactions (or contract creations)
   *
   * @param      {string}           password   password for token creation
   * @param      {any[]}            functions  array of function signatures as abi objects
   * @return     {Promise<string>}  new token
   */
  public async generateToken(password, functions): Promise<string> {
    // patch zero id contract addresses, if required
    const updatedFunctions = functions.map((fun) => {
      const newFun = {
        contractId: fun.contractId || '0x0000000000000000000000000000000000000000',
        signature: fun.signature || null,
        count: fun.count || 1,
      };

      if (fun.contract) {
        newFun.contractId = fun.contract.options.address;
        if (fun.functionName) {
          if (fun.contract.options.jsonInterface) {
            // web3 1.2
            newFun.signature  = fun.contract.options.jsonInterface.filter(ff => ff.name === fun.functionName)[0];
          } else {
            // web3 2.0
            newFun.signature  = fun.contract.abiModel.abi.methods[fun.functionName].abiItem;
          }
        }
      }
      return newFun;
    })
    return request({
      url: `${this.agentUrl}/api/smart-agents/executor/generateToken`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        password,
        functions: updatedFunctions,
      },
    }) as Promise<string>;
  }

  private handleRequestResult(resolve, reject, error, msg, body) {
    if (error) {
      reject(error);
    } else if (body.error) {
      reject(body.error);
    } else {
      resolve(body.result);
    }
  }
}
