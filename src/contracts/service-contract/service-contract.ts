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

import _ = require('lodash');
import crypto = require('crypto');
import prottle = require('prottle');
import Web3 = require('web3');

import {
  ContractLoader,
  DfsInterface,
  Envelope,
  KeyProviderInterface,
  Logger,
  Validator,
} from '@evan.network/dbcp';

import { BaseContract, BaseContractOptions, } from '../base-contract/base-contract';
import { CryptoProvider } from '../../encryption/crypto-provider';
import { Sharing } from '../sharing';

const requestWindowSize = 10;
const web3 = new Web3(null);
const uintMax = web3.utils.toBN('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

const serviceSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    serviceName: { type: 'string', },
    requestParameters: { type: 'object', },
    responseParameters: { type: 'object', },
  },
};

export interface Answer {
  data: any;
  hash: string;
  owner: string;
  created: number;
  parent: number;
}

export interface AnswerResult {
  [index: number]: Answer;
}

export interface Call {
  data: any;
  hash: string;
  owner: string;
  created: number;
  answerCount: number;
  sharing: string;
}

export interface CallResult {
  [index: number]: Call;
}

/**
 * options for ServiceContract constructor
 */
export interface ServiceContractOptions extends BaseContractOptions {
  cryptoProvider: CryptoProvider,
  dfs: DfsInterface,
  keyProvider: KeyProviderInterface,
  sharing: Sharing,
  web3: any,
  defaultCryptoAlgo?: string,
}

/**
 * helper class for ServiceContracts
 *
 * @class      ServiceContract (name)
 */
export class ServiceContract extends BaseContract {
  public options: ServiceContractOptions;
  private readonly encodingUnencrypted = 'utf-8';
  private readonly encodingEncrypted = 'hex';
  private readonly encodingUnencryptedHash = 'hex';
  private readonly cryptoAlgorithHashes = 'aesEcb';
  private serviceDefinition;

  constructor(optionsInput: ServiceContractOptions) {
    super(optionsInput as BaseContractOptions);
    this.options = optionsInput;
    if (!this.options.defaultCryptoAlgo) {
      this.options.defaultCryptoAlgo = 'aes';
    }
  }

  /**
   * adds list of accounts to a calls sharings list
   *
   * @param      {any|string}     contract   contract instance or contract id
   * @param      {string}         accountId  account id of sharing user
   * @param      {number}         callId     id of the call to extend sharings for
   * @param      {string[]}       to         list of account ids
   * @return     {Promise<void>}  resolved when done
   */
  public async addToCallSharing(
      contract: any|string,
      accountId: string,
      callId: number,
      to: string[],
      hashKey?: string,
      contentKey?: string,
      section = '*'): Promise<void> {
    const serviceContract = (typeof contract === 'object') ?
      contract : this.options.loader.loadContract('ServiceContractInterface', contract);
    const callIdHash = this.numberToBytes32(callId);
    const [blockNr, hashKeyToShare] = await Promise.all([
      this.options.web3.eth.getBlockNumber(),
      hashKey || this.options.sharing.getHashKey(serviceContract.options.address, accountId, callIdHash),
    ]);
    const contentKeyToShare = contentKey ||
      (await this.options.sharing.getKey(serviceContract.options.address, accountId, section, blockNr, callIdHash));
    for (let target of to) {
      await this.options.sharing.ensureHashKey(
        serviceContract.options.address, accountId, target, hashKeyToShare, null, callIdHash);
      await this.options.sharing.addSharing(
        serviceContract.options.address, accountId, target, section, 0, contentKeyToShare, null, false, callIdHash);
    }
  }

  /**
   * create and initialize new contract
   *
   * @param      {string}        accountId             owner of the new contract and transaction
   *                                                   executor
   * @param      {string}        businessCenterDomain  ENS domain name of the business center
   * @param      {any}           service               service definition
   * @param      {string}        descriptionDfsHash    bytes32 hash of DBCP description
   * @return     {Promise<any>}  contract instance
   */
  public async create(
      accountId: string,
      businessCenterDomain: string,
      service: any,
      descriptionDfsHash = '0x0000000000000000000000000000000000000000000000000000000000000000',
      ): Promise<any> {
    // validate service definition
    const validator = new Validator({ schema: serviceSchema, });
    const checkFails = validator.validate(service);
    if (checkFails !== true) {
      throw new Error(`validation of service values failed with: ${JSON.stringify(checkFails)}`);
    }

    const contractP = (async () => {
      const contractId = await super.createUninitialized(
        'service', accountId, businessCenterDomain, descriptionDfsHash);
      return this.options.loader.loadContract('ServiceContractInterface', contractId);
    })();

    // create sharing key for owner
    const cryptor = this.options.cryptoProvider.getCryptorByCryptoAlgo(this.options.defaultCryptoAlgo);
    const hashCryptor = this.options.cryptoProvider.getCryptorByCryptoAlgo(this.cryptoAlgorithHashes);
    const [contentKey, hashKey, contract] = await Promise.all(
      [cryptor.generateKey(), hashCryptor.generateKey(), contractP]);
    await this.options.sharing.addSharing(contract.options.address, accountId, accountId, '*', 0, contentKey);
    await this.options.sharing.ensureHashKey(contract.options.address, accountId, accountId, hashKey);

    // add service after sharing has been added
    await this.setService(contract, accountId, service, businessCenterDomain, true);
    return contract;
  }

  /**
   * retrieve a single answer
   *
   * @param      {any|string}    contract     smart contract instance or contract ID
   * @param      {string}        accountId    Ethereum account ID
   * @param      {number}        callId       index of the call to which the answer was created
   * @param      {number}        answerIndex  index of the answer in the call (starts from 0 for
   *                                          every call)
   * @return     {Promise<any>}  the answer
   */
  public async getAnswer(
      contract: any|string, accountId: string, callId: number, answerIndex: number): Promise<any> {
    const serviceContract = (typeof contract === 'object') ?
      contract : this.options.loader.loadContract('ServiceContractInterface', contract);
    const queryResult = await this.options.executor.executeContractCall(
      serviceContract, 'getAnswers', callId, answerIndex);
    const result = {};
    ['hash', 'owner', 'created', 'parent'].forEach((key) => { result[key] = queryResult[0][key]; });
    const decryptedHash = await this.decryptHash(
      queryResult.hash[0], serviceContract, accountId, this.numberToBytes32(callId));
    if (decryptedHash) {
      const data = await this.decrypt(
        (await this.options.dfs.get(decryptedHash)).toString('utf-8'),
        serviceContract,
        accountId,
        '*'
      );
    }
    return result;
  }

  /**
   * retrieves number of answers for a given call
   *
   * @param      {any|string}       contract  smart contract instance or contract ID
   * @param      {number}           callId    call index
   * @return     {Promise<number>}  number of answers
   */
  public async getAnswerCount(contract: any|string, callId: number): Promise<number> {
    const serviceContract = (typeof contract === 'object') ?
      contract : this.options.loader.loadContract('ServiceContractInterface', contract);
    const { answerCount}  = await this.options.executor.executeContractCall(
      serviceContract, 'calls', callId);
    return parseInt(answerCount, 10);
  }

  /**
   * gets answers for a given call
   *
   * @param      {any|string}      contract   smart contract instance or contract ID
   * @param      {string}          accountId  Ethereum account ID
   * @param      {number}          callId     index of the call to which the answer was created
   * @param      {number}          count      number of elements to retrieve
   * @param      {number}          offset     skip this many elements
   * @param      {boolean}         reverse    retrieve last elements first
   * @return     {Promise<any[]>}  the calls
   */
  public async getAnswers(
      contract: any|string,
      accountId: string,
      callId: number,
      count = 10,
      offset = 0,
      reverse = false): Promise<AnswerResult> {
    const serviceContract = (typeof contract === 'object') ?
      contract : this.options.loader.loadContract('ServiceContractInterface', contract);

    // get entries
    const { entries, indices } = await this.getEntries(
      serviceContract, 'answers', callId, count, offset, reverse);

    // decrypt contents
    const result = {};
    // answer hashes are encrypted with calls hash key
    const callIdString = this.numberToBytes32(callId);
    const tasks = indices.map((index) => async () => {
      const decryptedHash = await this.decryptHash(
        entries[index].hash, serviceContract, accountId, callIdString);
      result[index] = entries[index];
      if (decryptedHash) {
        result[index].data = await this.decrypt(
          (await this.options.dfs.get(decryptedHash)).toString('utf-8'),
          serviceContract,
          accountId,
          '*',
          callIdString,
        );
      }
    });

    if (tasks.length) {
      await prottle(requestWindowSize, tasks);
    }

    return result;
  }

  /**
   * get a call from a contract
   *
   * @param      {any|string}    contract   smart contract instance or contract ID
   * @param      {string}        accountId  Ethereum account ID
   * @param      {number}        callId  index of the call to retrieve
   * @return     {Promise<any>}  the call
   */
  public async getCall(contract: any|string, accountId: string, callId: number): Promise<any> {
    const serviceContract = (typeof contract === 'object') ?
      contract : this.options.loader.loadContract('ServiceContractInterface', contract);
    const callIdString = this.numberToBytes32(callId);
    let call = await this.options.executor.executeContractCall(
      serviceContract, 'calls', callIdString);
    const decryptedHash = await this.decryptHash(call.hash, serviceContract, accountId, callIdString);
    if (decryptedHash) {
      call.data = await this.decrypt(
        (await this.options.dfs.get(decryptedHash)).toString('utf-8'),
        serviceContract,
        accountId,
        '*',
        callIdString,
      );
    }
    return call;
  }

 /**
   * get all calls from a contract
   *
   * @param      {any|string}      contract   smart contract instance or contract ID
   * @param      {string}          accountId  Ethereum account ID
   * @param      {number}          count      number of elements to retrieve
   * @param      {number}          offset     skip this many elements
   * @param      {boolean}         reverse    retrieve last elements first
   * @return     {Promise<any>}  the calls
   */
  public async getCalls(
      contract: any|string,
      accountId: string,
      count = 10,
      offset = 0,
      reverse = false): Promise<CallResult> {
    const serviceContract = (typeof contract === 'object') ?
      contract : this.options.loader.loadContract('ServiceContractInterface', contract);

    // get entries
    const { entries, indices } = await this.getEntries(serviceContract,
      'calls', null, count, offset, reverse);

    // add sharings hashes to sharing module cache
    indices.forEach((index) => {
      this.options.sharing.addHashToCache(serviceContract.options.address,
        entries[index].sharing, this.numberToBytes32(index));
    });

    // decrypt contents
    const result = {};
    const tasks = indices.map((index) => async () => {
      const callIdString = this.numberToBytes32(index);
      const decryptedHash = await this.decryptHash(entries[index].hash, serviceContract,
        accountId, callIdString);
      result[index] = entries[index];
      if (decryptedHash) {
        result[index].data = await this.decrypt(
          (await this.options.dfs.get(decryptedHash)).toString('utf-8'),
          serviceContract,
          accountId,
          '*',
          callIdString,
        );
      }
    });

    if (tasks.length) {
      await prottle(requestWindowSize, tasks);
    }

    return result;
  }

  /**
   * get number of calls of a contract
   *
   * @param      {any|string}  contract  smart contract instance or contract ID
   * @return     {Promise<number>}      number of calls
   */
  public async getCallCount(contract: any|string): Promise<number> {
    const serviceContract = (typeof contract === 'object') ?
      contract : this.options.loader.loadContract('ServiceContractInterface', contract);
    const count = await this.options.executor.executeContractCall(serviceContract, 'callCount');
    return parseInt(count, 10);
  }

  /**
   * gets the owner/creator of a call
   *
   * @param      {any|string}       contract  contract instance or id
   * @param      {number}           callId    id of a call
   * @return     {Promise<string>}  account id of call owner
   */
  public async getCallOwner(contract: any|string, callId: number): Promise<string> {
    const serviceContract = (typeof contract === 'object') ?
      contract : this.options.loader.loadContract('ServiceContractInterface', contract);
    return (await this.options.executor.executeContractCall(
      serviceContract, 'calls', callId)).owner;
  }

  /**
   * gets the service of a service contract
   *
   * @param      {any|string}       contract   smart contract instance or contract ID
   * @param      {string}           accountId  Ethereum account ID
   * @return     {Promise<string>}  service description
   */
  public async getService(contract: any|string, accountId: string): Promise<string> {
    const serviceContract = (typeof contract === 'object') ?
      contract : this.options.loader.loadContract('ServiceContractInterface', contract);
    const encryptedHash = await this.options.executor.executeContractCall(serviceContract, 'service');
    const decryptedHash = await this.decryptHash(encryptedHash, serviceContract, accountId);
    const decrypted = await this.decrypt(
      (await this.options.dfs.get(decryptedHash)).toString('utf-8'),
      serviceContract,
      accountId,
      '*'
    );
    this.serviceDefinition = decrypted;
    return decrypted;
  }

  /**
   * send answer to service contract call
   *
   * @param      {any|string}     contract    smart contract instance or contract ID
   * @param      {string}         accountId   Ethereum account ID
   * @param      {any}            answer      answer to send
   * @param      {number}         callId      index of the call to which the answer was created
   * @param      {string}         callAuthor  Ethereum account ID of the creator of the initial call
   * @return     {Promise<number>}  resolved when done
   */
  public async sendAnswer(
      contract: any|string,
      accountId: string,
      answer: any,
      callId: number,
      callAuthor: string,
      callParent = uintMax): Promise<number> {
    const serviceContract = (typeof contract === 'object') ?
      contract : this.options.loader.loadContract('ServiceContractInterface', contract);

    // validate call
    if (!this.serviceDefinition) {
      // this.serviceDefinition is set and updated via side effects in getService and setService
      await this.getService(serviceContract, accountId);
    }
    const validator = new Validator({ schema: this.serviceDefinition.responseParameters, });
    const checkFails = validator.validate(answer);
    if (checkFails !== true) {
      throw new Error(`validation of input values failed with: ${JSON.stringify(checkFails)}`);
    }

    const blockNr = 0;  // will be ignored as callAuthor is set
    const encrypted = await this.encrypt(answer, serviceContract, accountId, '*', blockNr, callAuthor);
    const stateMd5 = crypto.createHash('md5').update(encrypted).digest('hex');
    const answerHash = await this.options.dfs.add(stateMd5, Buffer.from(encrypted));
    const hashKey = await this.options.sharing.getHashKey(serviceContract.options.address, accountId, this.numberToBytes32(callId));
    const encryptdHash = await this.encryptHash(answerHash, serviceContract, accountId, hashKey);
    const answerId = await this.options.executor.executeContractTransaction(
      serviceContract,
      'sendAnswer', {
        from: accountId,
        autoGas: 1.1,
        event: {
          target: 'ServiceContractInterface',
          eventName: 'ServiceContractEvent',
        },
        getEventResult: (event, args) => args.entryId,
      },
      encryptdHash,
      callId,
      callParent,
    );
    return parseInt(answerId, 16);
  };

  /**
   * send a call to a service
   *
   * @param      {any|string}       contract   smart contract instance or contract ID
   * @param      {string}           accountId  Ethereum account ID
   * @param      {any}              call       call to send
   * @return     {Promise<number>}  returns id of new call
   */
  public async sendCall(
      contract: any|string,
      accountId: string,
      call: any,
      to: string[] = []): Promise<number> {
    const serviceContract = (typeof contract === 'object') ?
      contract : this.options.loader.loadContract('ServiceContractInterface', contract);

    // validate call
    if (!this.serviceDefinition) {
      // this.serviceDefinition is set and updated via side effects in getService and setService
      await this.getService(serviceContract, accountId);
    }
    const validator = new Validator({ schema: this.serviceDefinition.requestParameters, });
    const checkFails = validator.validate(call);
    if (checkFails !== true) {
      throw new Error(`validation of input values failed with: ${JSON.stringify(checkFails)}`);
    }

    // create local copy of call for encryption
    const callCopy = _.cloneDeep(call);

    // get block number for cryptoInfos
    const blockNr = await this.options.web3.eth.getBlockNumber();

    // subproperties metadata.fnord and payload.fnord use the same key,
    // so track keys for subproperties and cryptors like 'fnord' here
    const innerEncryptionData = {};
    const innerPropertiesToEncrpt = {};
    // encrypt properties
    const generateKeys = async (property) => {
      innerPropertiesToEncrpt[property] = [];
      if (callCopy[property]) {
        for (let key of Object.keys(callCopy[property])) {
          if (callCopy[property][key].hasOwnProperty('private') &&
              callCopy[property][key].hasOwnProperty('cryptoInfo') &&
              !innerPropertiesToEncrpt[property][key]) {
            innerPropertiesToEncrpt[property].push(key);
            innerEncryptionData[key] = {};
            innerEncryptionData[key].cryptor = this.options.cryptoProvider.getCryptorByCryptoInfo(
              callCopy[property][key].cryptoInfo);
            innerEncryptionData[key].key = await innerEncryptionData[key].cryptor.generateKey();
          }
        }
      }
    };
    // run once for metadata and once for payload, await them sequentially to track already generated keys
    await Object.keys(callCopy).reduce((chain, key) => chain.then(() => { generateKeys(key) }), Promise.resolve());

    // create keys for new call (outer properties)
    const cryptor = this.options.cryptoProvider.getCryptorByCryptoAlgo(this.options.defaultCryptoAlgo);
    const hashCryptor = this.options.cryptoProvider.getCryptorByCryptoAlgo(this.cryptoAlgorithHashes);
    const [contentKey, hashKey] = await Promise.all([cryptor.generateKey(), hashCryptor.generateKey()]);

    // use key to encrypt message  (outer properties)
    const encrypted = await this.encrypt(
      callCopy,
      serviceContract,
      accountId,
      '*',
      blockNr,
      null,
      contentKey,
      innerPropertiesToEncrpt,
      innerEncryptionData,
    );

    // store enc message and sharing to contract
    const stateMd5 = crypto.createHash('md5').update(encrypted).digest('hex');
    const serviceHash = await this.options.dfs.add(stateMd5, Buffer.from(encrypted));
    const encryptdHash = await this.encryptHash(serviceHash, serviceContract, accountId, hashKey);
    const callIdUint256 = parseInt(await this.options.executor.executeContractTransaction(
      serviceContract,
      'sendCall', {
        from: accountId,
        autoGas: 1.1,
        event: {
          target: 'ServiceContractInterface',
          eventName: 'ServiceContractEvent',
        },
        getEventResult: (event, args) => args.entryId,
      },
      encryptdHash,
    ), 10);

    // put key in sharings, requires msg to be stored
    // add hash key
    const callId = this.numberToBytes32(callIdUint256);
    // keep keys for owner
    await this.options.sharing.ensureHashKey(
      serviceContract.options.address, accountId, accountId, hashKey, null, callId);
    await this.options.sharing.addSharing(
      serviceContract.options.address, accountId, accountId, '*', 0, contentKey, null, false, callId);
    // if subproperties were encryted, keep them for owner as well
    for (let propertyName of Object.keys(innerEncryptionData)) {
      await this.options.sharing.addSharing(
        serviceContract.options.address,
        accountId,
        accountId,
        propertyName,
        0,
        innerEncryptionData[propertyName].key,
        null,
        false,
        callId
      );
    }
    // for each to, add sharing keys
    await this.addToCallSharing(serviceContract, accountId, callIdUint256, to, hashKey, contentKey);

    // return id of new call
    return parseInt(callId, 16);
  }

  /**
   * set service description
   *
   * @param      {any|string}     contract              smart contract instance or contract ID
   * @param      {string}         accountId             Ethereum account ID
   * @param      {any}            service               service to set
   * @param      {string}         businessCenterDomain  domain of the business the service contract
   *                                                    belongs to
   * @param      {bool}           skipValidation        (optional) skip validation of service
   *                                                    definition, validation is enabled by default
   * @return     {Promise<void>}  resolved when done
   */
  public async setService(
      contract: any|string,
      accountId: string,
      service: any,
      businessCenterDomain: string,
      skipValidation?): Promise<void> {
    const serviceContract = (typeof contract === 'object') ?
      contract : this.options.loader.loadContract('ServiceContractInterface', contract);
    if (!skipValidation) {
      // validate service definition
      const validator = new Validator({ schema: serviceSchema, });
      const checkFails = validator.validate(service);
      if (checkFails !== true) {
        throw new Error(`validation of service definition failed with: ${JSON.stringify(checkFails)}`);
      }
    }
    const blockNr = await this.options.web3.eth.getBlockNumber();
    const serviceHashP = (async () => {
      const encrypted = await this.encrypt(service, serviceContract, accountId, '*', blockNr);
      const stateMd5 = crypto.createHash('md5').update(encrypted).digest('hex');
      const serviceHash = await this.options.dfs.add(stateMd5, Buffer.from(encrypted));
      return await this.encryptHash(serviceHash, serviceContract, accountId);
    })();
    const [businessCenterAddress, encryptdHash] = await Promise.all([
      this.options.nameResolver.getAddress(businessCenterDomain),
      serviceHashP,
    ]);
    await this.options.executor.executeContractTransaction(
      serviceContract,
      'setService', {from: accountId, autoGas: 1.1, },
      businessCenterAddress,
      encryptdHash,
    );
    this.serviceDefinition = service;
  }

  /**
   * decrypt message; returns null if unable to decyrypt
   *
   * @param      {string}           toDecrypt     message to decrypt
   * @param      {any}              contract      contract the message belongs to
   * @param      {string}           accountId     account, that decrypts
   * @param      {string}           propertyName  name of the property to decrypt
   * @param      {string}           callId        (optional) if a call, id of the call to decrypt
   * @return     {Promise<string>}  decrypted message or null (if unable to decyrypt)
   */
  private async decrypt(
      toDecrypt: string,
      contract: any,
      accountId: string,
      propertyName: string,
      callId?: string): Promise<string> {
    try {
      const envelope: Envelope = JSON.parse(toDecrypt);
      const cryptor = this.options.cryptoProvider.getCryptorByCryptoInfo(envelope.cryptoInfo);
      // check if directed message, encrypted with comm key
      let contentKey = await this.options.keyProvider.getKey(envelope.cryptoInfo);
      if (!contentKey) {
        // check if encrypted via sharing
        contentKey = await this.options.sharing.getKey(
          contract.options.address, accountId, propertyName, envelope.cryptoInfo.block, callId);
      }
      if (!contentKey) {
        throw new Error(`could not decrypt data, no content key found for contract ` +
          `"${contract.options.address}" and account "${accountId}"`);
      }
      const decryptedObject = await cryptor.decrypt(
        Buffer.from(envelope.private, this.encodingEncrypted), { key: contentKey, });

      await Promise.all(Object.keys(decryptedObject).map(async (property) => {
        await Promise.all(Object.keys(decryptedObject[property]).map(async (key) => {
          if (decryptedObject[property][key].hasOwnProperty('private') &&
              decryptedObject[property][key].hasOwnProperty('cryptoInfo')) {
            try {
              const innerCryptor = this.options.cryptoProvider.getCryptorByCryptoInfo(
                decryptedObject[property][key].cryptoInfo);
              const envelopeInner = decryptedObject[property][key];
              const contentKeyInner = await this.options.sharing.getKey(
                contract.options.address, accountId, key, envelopeInner.cryptoInfo.block, callId);
              decryptedObject[property][key] = await innerCryptor.decrypt(
                Buffer.from(envelopeInner.private, this.encodingEncrypted), { key: contentKeyInner, });
            } catch (ex) {
              this.log(`could not decrypt inner service message part ` +
                `${property}/${key}; ${ex.message || ex}`, 'info')
            }
          }
        }));
      }));

      return decryptedObject;
    } catch (ex) {
      this.log(`could not decrypt service contract message "${toDecrypt}" for contract ` +
        `"${contract.options.address}" with account id "${accountId}" in section "${propertyName}"` +
        callId ? (' for call ' + callId) : '',
        'debug',
      );
      return null;
    }
  }

  /**
   * decrypt input hash, return decrypted hash; returns null if unable to decyrypt
   *
   * @param      {string}        toDecrypt  data to decrypt
   * @param      {any}           contract   contract instance or contract id
   * @param      {string}        accountId  account id that decrypts the data
   * @param      {string}        callId     (optional) if a call should be decrypted, id of the call
   * @return     {Promise<any>}  decrypted envelope or null (if unable to decyrypt)
   */
  private async decryptHash(
      toDecrypt: string, contract: any, accountId: string, callId?: string): Promise<string> {
    const dataContract = (typeof contract === 'object') ?
      contract : this.options.loader.loadContract('ServiceContractInterface', contract);
    try {
      // decode hash
      const cryptor = this.options.cryptoProvider.getCryptorByCryptoAlgo(this.cryptoAlgorithHashes);
      const hashKey = await this.options.sharing.getHashKey(dataContract.options.address, accountId, callId);
      if (!hashKey) {
        throw new Error(`no hashKey key found for contract "${dataContract.options.address}" and account "${accountId}"`);
      }
      const decryptedBuffer = await cryptor.decrypt(
        Buffer.from(toDecrypt.substr(2), this.encodingEncrypted), { key: hashKey, });
      return `0x${decryptedBuffer.toString(this.encodingUnencryptedHash)}`;
    } catch (ex) {
      this.log(`could not decrypt service contract hash "${toDecrypt}" for contract ` +
        `"${dataContract.options.address}" with account id "${accountId}"` +
        callId ? (' for call ' + callId) : '',
        'debug',
      );
      return null;
    }
  }

  /**
   * encrypt message
   *
   * @param      {string}           toEncrypt     message to encrypt
   * @param      {any}              contract      contract to encrypt message for
   * @param      {string}           from          encrypting account
   * @param      {string}           propertyName  property, that is encrypted
   * @param      {number}           block         current block
   * @param      {to}               to            (optional) target of message (if encrypting a
   *                                              call, target is none (no specific ENCRYPTION
   *                                              target, keys wrapped in multi sharings))
   * @param      {Buffer}           key           (optional) key to use, if no key is provided,
   *                                              sharings is used to look for a key
   * @return     {Promise<string>}  stringified {Envelope}
   */
  private async encrypt(
      toEncrypt: any,
      contract: any,
      from: string,
      propertyName: string,
      block: number,
      to?: string,
      key?: Buffer,
      innerPropertiesToEncrpt?: any,
      innerEncryptionData?: any): Promise<string> {
    // helper for encrypting properties
    const encryptSubProperties = async (property) => {
      if (innerPropertiesToEncrpt[property]) {
        await Promise.all(innerPropertiesToEncrpt[property].map(async (keyInner) => {
          if (innerPropertiesToEncrpt[property].includes(keyInner) &&
              toEncrypt[property][keyInner]) {
            // encrypt with content key
            const encryptedBufferInner = await innerEncryptionData[keyInner].cryptor.encrypt(
              toEncrypt[property][keyInner].private, { key: innerEncryptionData[keyInner].key, });
            const encryptedProperty = encryptedBufferInner.toString(this.encodingEncrypted);
            const envelopeInner: Envelope = {
              private: encryptedProperty,
              cryptoInfo: toEncrypt[property][keyInner].cryptoInfo,
            };
            envelopeInner.cryptoInfo.block = block;
            toEncrypt[property][keyInner] = envelopeInner;
          }
        }));
      }
    };
    // encrypt properties
    if (innerPropertiesToEncrpt) {
      await Promise.all(Object.keys(toEncrypt).map(async (toEncryptKey) => encryptSubProperties(toEncryptKey)));
    }

    // get content key from contract
    const cryptor = this.options.cryptoProvider.getCryptorByCryptoAlgo(this.options.defaultCryptoAlgo);
    let cryptoInfo;
    let contentKey;
    if (to) {
      // directed message, encrypted with comm key
      const fromHash = this.options.nameResolver.soliditySha3(from);
      const toHash = this.options.nameResolver.soliditySha3(to);
      const combinedHash = this.options.nameResolver.soliditySha3.apply(this.options.nameResolver, [fromHash, toHash].sort());
      cryptoInfo = cryptor.getCryptoInfo(combinedHash);
      if (key) {
        contentKey = key;
      } else {
        contentKey = await this.options.keyProvider.getKey(cryptoInfo);
      }
    } else {
      // group message, scoped to contract
      cryptoInfo = cryptor.getCryptoInfo(this.options.nameResolver.soliditySha3(contract.options.address));
      if (key) {
        // encrpted with calls data key from argument
        contentKey = key;
      } else {
        // retrieve calls data key from sharings
        contentKey = await this.options.sharing.getKey(contract.options.address, from, propertyName, block);
      }
    }
    if (!contentKey) {
      throw new Error(`no content key found for contract "${contract.options.address}" and account "${from}"`);
    }
    // encrypt with content key
    const encryptedBuffer = await cryptor.encrypt(toEncrypt, { key: contentKey, });
    const encrypted = encryptedBuffer.toString(this.encodingEncrypted);
    const envelope: Envelope = {
      private: encrypted,
      cryptoInfo,
    };
    envelope.cryptoInfo.block = block;
    return JSON.stringify(envelope);
  }

  /**
   * encrypt incoming hash
   *
   * @param      {string}           toEncrypt  hash to encrypt
   * @param      {any}              contract   contract to encrypt data for
   * @param      {string}           accountId  encrypting account
   * @param      {Buffer}           key        key to use (if no key is provided, use key from
   *                                           sharings)
   * @return     {Promise<string>}  encrypted envelope or hash as string
   */
  private async encryptHash(
      toEncrypt: string, contract: any, accountId: string,  key?: Buffer): Promise<string> {
    // get hashKkey from contract
    let hashKey;
    if (key) {
      hashKey = key;
    } else {
      hashKey = await this.options.sharing.getHashKey(contract.options.address, accountId);
    }

    if (!hashKey) {
      throw new Error(`no hashKey found for contract "${contract.options.address}" and account "${accountId}"`);
    }
    // encrypt with hashKkey
    const cryptor = this.options.cryptoProvider.getCryptorByCryptoAlgo(this.cryptoAlgorithHashes);
    const encryptedBuffer = await cryptor.encrypt(Buffer.from(toEncrypt.substr(2), this.encodingUnencryptedHash), { key: hashKey, });
    return `0x${encryptedBuffer.toString(this.encodingEncrypted)}`;
  }

  /**
   * gets calls or answers from service contract
   *
   * @param      {any}           serviceContract  smart contract instance or contract ID
   * @param      {string}        type             'calls' or 'answers'
   * @param      {number}        callId           id of parent call (if retrieving answers) or null
   * @param      {number}        count            number of items to retrieve
   * @param      {number}        offset           skip this many entries
   * @param      {boolean}       reverse          fetch entries, starting with last entry
   * @return     {Promise<any>}  object with result info
   */
  private async getEntries(
      serviceContract: any,
      type = 'calls' || 'answers',
      callId?: number,
      count = 10,
      offset = 0,
      reverse = false): Promise<any> {
    let result = {
      entries: {},
      indices: [],
    };
    if (type !== 'calls' && type !== 'answers') {
      throw new Error(`unsupported service contract entry type: ${type}`);
    }
    let entryCount;
    let queryOffset = offset;
    if (reverse) {
      entryCount = await (type === 'calls' ?
        this.getCallCount(serviceContract) : this.getAnswerCount(serviceContract, callId));
      queryOffset = Math.max(entryCount - offset - count, 0);
    }
    let itemsRetrieved = 0;
    const resultsPerPage = 10;
    const getResults = async (singleQueryOffset) => {
      let queryResult;
      if (type === 'calls') {
        queryResult = await this.options.executor.executeContractCall(
          serviceContract, 'getCalls', singleQueryOffset);
      } else {
        queryResult = await this.options.executor.executeContractCall(
          serviceContract, 'getAnswers', callId, singleQueryOffset);
      }
      itemsRetrieved += resultsPerPage;

      for (let i = 0; i < queryResult.hash.length; i++) {
        const resultId = i + singleQueryOffset;
        result.indices.push(resultId);
        result.entries[resultId] = {};
        ['hash', 'owner', 'created', 'answerCount', 'sharing', 'parent'].forEach((key) => {
          if (queryResult[key] && queryResult[key][i]) {
            result.entries[resultId][key] = queryResult[key][i];
          }
        });
      }

      if (typeof entryCount === 'undefined') {
        entryCount = parseInt(queryResult.totalCount, 10);
      }
      if (itemsRetrieved < count && itemsRetrieved < entryCount) {
        // continue if items remaining
        await getResults(queryOffset + resultsPerPage);
      }
    };
    await getResults(queryOffset);
    // trim unneccessary or empty results
    const limit = Math.min(count, entryCount - offset);
    if (limit < result.indices.length) {
      result.indices = result.indices.slice(0, limit);
    }
    if (reverse) {
      result.indices.reverse();
    }
    return result;
  }

  /**
   * convert number bytes32 string
   *
   * @param      {number}  number  number to convert
   * @return     {string}  bytes32 string with '0x' prefix
   */
  private numberToBytes32(number: number): string {
    return `0x${(number).toString(16).padStart(64, '0')}`;
  }
}
