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

import crypto = require('crypto');
import prottle = require('prottle');

import {
  Description,
  DfsInterface,
  Envelope,
  Logger,
  Validator,
} from '@evan.network/dbcp';

import { BaseContract, BaseContractOptions } from '../base-contract/base-contract';
import { CryptoProvider } from '../../encryption/crypto-provider';
import { Sharing } from '../sharing';


const requestWindowSize = 10;


/**
 * options for DataContract constructor
 */
export interface DataContractOptions extends BaseContractOptions {
  cryptoProvider: CryptoProvider,
  dfs: DfsInterface,
  sharing: Sharing,
  web3: any,
  defaultCryptoAlgo?: string,
  description: Description,
}

/**
 * helper class for AssetDataContracts
 *
 * @class      AssetDataContract (name)
 */
export class DataContract extends BaseContract {
  protected options: DataContractOptions;
  private readonly encodingUnencrypted = 'utf-8';
  private readonly encodingEncrypted = 'hex';
  private readonly encodingUnencryptedHash = 'hex';
  private readonly cryptoAlgorithHashes = 'aesEcb';

  constructor(optionsInput: DataContractOptions) {
    super(optionsInput as BaseContractOptions);
    this.options = optionsInput;
    if (!this.options.defaultCryptoAlgo) {
      this.options.defaultCryptoAlgo = 'aes';
    }
  }

  /**
   * create and initialize new contract
   *
   * @param      {string}        factoryName           factory to use for creating contract (without
   *                                                   the business center suffix)
   * @param      {string}        accountId             owner of the new contract and transaction
   *                                                   executor
   * @param      {string}        businessCenterDomain  ENS domain name of the business center
   * @param      {string|any}    contractDescription   bytes32 hash of DBCP description or a schema
   *                                                   object
   * @param      {bool}          allowConsumerInvite   true if consumers are allowed to invite other
   *                                                   consumers
   * @param      {string}        sharingsHash          sharings hash to use
   * @return     {Promise<any>}  contract instance
   */
  public async create(
      factoryName: string,
      accountId: string,
      businessCenterDomain?: string,
      contractDescription: any = '0x0000000000000000000000000000000000000000000000000000000000000000',
      allowConsumerInvite = true,
      sharingsHash = null,
  ): Promise<any> {
    const contractP = (async () => {
      const descriptionHash = (typeof contractDescription === 'object') ?
        '0x0000000000000000000000000000000000000000000000000000000000000000' : contractDescription;
      const contractId = await super.createUninitialized(
        factoryName, accountId, businessCenterDomain, descriptionHash);
      const contractInterface = this.options.loader.loadContract('DataContractInterface', contractId);
      const rootDomain = this.options.nameResolver.namehash(
        this.options.nameResolver.getDomainName(this.options.nameResolver.config.domains.root));
      await this.options.executor.executeContractTransaction(
        contractInterface,
        'init',
        { from: accountId, autoGas: 1.1, },
        rootDomain,
        allowConsumerInvite,
      );
      return contractInterface;
    })();
    const [contract, sharingInfo] = await Promise.all([contractP, sharingsHash ? { sharingsHash, } : this.createSharing(accountId)]);
    await this.options.executor.executeContractTransaction(
      contract, 'setSharing', { from: accountId, autoGas: 1.1, }, sharingInfo.sharingsHash);
    if (typeof contractDescription === 'object') {
      await this.options.description.setDescriptionToContract(contract.options.address, contractDescription, accountId);
    }
    return contract;
  }

  /**
   * create initial sharing for contract
   *
   * @param      {string}        accountId  owner of the new contract
   * @return     {Promise<any>}  sharing info with { contentKey, hashKey, sharings, sharingsHash, }
   */
  public async createSharing(accountId: string, skipUpload = false): Promise<any> {
    // create sharing key for owner
    const cryptor = this.options.cryptoProvider.getCryptorByCryptoAlgo(this.options.defaultCryptoAlgo);
    const hashCryptor = this.options.cryptoProvider.getCryptorByCryptoAlgo(this.cryptoAlgorithHashes);
    const [contentKey, hashKey, blockNr] = await Promise.all(
      [cryptor.generateKey(), hashCryptor.generateKey(), this.options.web3.eth.getBlockNumber()]);

    const sharings =  {};
    await this.options.sharing.extendSharings(sharings, accountId, accountId, '*', blockNr, contentKey);
    await this.options.sharing.extendSharings(sharings, accountId, accountId, '*', 'hashKey', hashKey);

    let sharingsHash = null;
    if (!skipUpload) {
      sharingsHash = await this.options.dfs.add('sharing', Buffer.from(JSON.stringify(sharings), this.encodingUnencrypted));
    }

    return {
      contentKey,
      hashKey,
      sharings,
      sharingsHash,
    };
  }

  /**
   * add list entries to lists
   *
   * @param      {object|string}  contract         contract or contractId
   * @param      {string}         listName         name of the list in the data contract
   * @param      {any}            values           values to add
   * @param      {string}         accountId        Ethereum account id
   * @param      {boolean}        dfsStorage       store values in dfs
   * @param      {boolean}        encryptedHashes  encrypt hashes from values
   * @param      {string}         encryption       encryption algorithm to use
   * @return     {Promise<void>}  resolved when done
   */
  public async addListEntries(
      contract: any|string,
      listName: string|string[],
      values: any[],
      accountId: string,
      dfsStorage = true,
      encryptedHashes = true,
      encryption: string = this.options.defaultCryptoAlgo,
      encryptionContext = accountId): Promise<void> {
    const dataContract = (typeof contract === 'object') ?
      contract : this.options.loader.loadContract('DataContractInterface', contract);
    const listNames = Array.isArray(listName) ? listName : [listName];

    let hashes = values;
    if (!dfsStorage) {
      if (encryptedHashes) {
        hashes = await Promise.all(hashes.map(hash => this.encryptHash(hash, dataContract, encryptionContext)));
      }
      // store as is
      await this.options.executor.executeContractTransaction(
        dataContract,
        'addListEntries',
        { from: accountId, autoGas: 1.1, },
        listNames.map(name => this.options.web3.utils.sha3(name)),
        hashes,
      );
    } else {
      // upload to ipfs
      const [ description, blockNr ] = await Promise.all([
        this.options.description.getDescriptionFromContract(dataContract.options.address, encryptionContext),
        this.options.web3.eth.getBlockNumber(),
      ]);
      await Promise.all((listNames).map(name => this.validate(description, name, hashes)));
      // get all keys and check if they differ
      const keys = await Promise.all(listNames.map(name => this.options.sharing.getKey(dataContract.options.address, encryptionContext, name, blockNr)));
      const groupedKeys = {};
      keys.forEach((key, index) => {
        if (groupedKeys[key]) {
          groupedKeys[key].push(listNames[index]);
        } else {
          groupedKeys[key] = [ listNames[index] ];
        }
      });
      // push grouped by key
      for (let key of Object.keys(groupedKeys)) {
        const ipfsFiles = [];
        for (let value of hashes) {
          const encrypted = await this.encrypt({private: value}, dataContract, encryptionContext, groupedKeys[key][0], blockNr, encryption);
          const stateMd5 = crypto.createHash('md5').update(encrypted).digest('hex');
          ipfsFiles.push({
            path: stateMd5,
            content: Buffer.from(encrypted),
          });
        };
        hashes = await this.options.dfs.addMultiple(ipfsFiles);
        if (encryptedHashes) {
          hashes = await Promise.all(hashes.map(hash => this.encryptHash(hash, dataContract, encryptionContext)));
        }
        await this.options.executor.executeContractTransaction(
          dataContract,
          'addListEntries',
          { from: accountId, autoGas: 1.1, },
          groupedKeys[key].map(name => this.options.web3.utils.sha3(name)),
          hashes,
        );
      }
    }
  }

  /**
   * decrypt input envelope return decrypted envelope
   *
   * @param      {string}        toDecrypt     data to decrypt
   * @param      {any}           contract      contract instance or contract id
   * @param      {string}        accountId     account id that decrypts the data
   * @param      {string}        propertyName  property in contract that is decrypted
   * @return     {Promise<any>}  decrypted envelope
   */
  public async decrypt(toDecrypt: string, contract: any, accountId: string, propertyName: string): Promise<Envelope> {
    const dataContract = (typeof contract === 'object') ?
      contract : this.options.loader.loadContract('DataContractInterface', contract);
    // decode envelope
    const envelope: Envelope = JSON.parse(toDecrypt);
    if (envelope.cryptoInfo) {
      const cryptor = this.options.cryptoProvider.getCryptorByCryptoInfo(envelope.cryptoInfo);
      let contentKey;

      // only load the contentKey when the algorithm isn't unencrypted if we try to load the content
      // key for the current user and this user has no profile, it would break
      if (envelope.cryptoInfo.algorithm !== 'unencrypted') {
        contentKey = await this.options.sharing.getKey(dataContract.options.address, accountId,
          propertyName, envelope.cryptoInfo.block);

        if (!contentKey) {
          throw new Error(`no content key found for contract "${dataContract.options.address}" and account "${accountId}"`);
        }
      }

      const decryptedBuffer = await cryptor.decrypt(
        Buffer.from(envelope.private, this.encodingEncrypted), { key: contentKey, });
      envelope.private = decryptedBuffer;
    }
    return envelope;
  }

  /**
   * decrypt input hash, return decrypted hash
   *
   * @param      {string}           toDecrypt  hash to decrypt
   * @param      {any}              contract   contract instance or contract id
   * @param      {string}           accountId  account id that decrypts the data
   * @return     {Promise<string>}  decrypted hash
   */
  public async decryptHash(toDecrypt: string, contract: any, accountId: string): Promise<string> {
    const dataContract = (typeof contract === 'object') ?
      contract : this.options.loader.loadContract('DataContractInterface', contract);
    // decode hash
    const cryptor = this.options.cryptoProvider.getCryptorByCryptoAlgo(this.cryptoAlgorithHashes);
    const hashKey = await this.options.sharing.getHashKey(dataContract.options.address, accountId);

    if (!hashKey) {
      throw new Error(`no hashKey key found for contract "${dataContract.options.address}" and account "${accountId}"`);
    }
    const decryptedBuffer = await cryptor.decrypt(
      Buffer.from(toDecrypt.substr(2), this.encodingEncrypted), { key: hashKey, });
    return `0x${decryptedBuffer.toString(this.encodingUnencryptedHash)}`;
  }

  /**
   * encrypt incoming envelope
   *
   * @param      {Envelope}         toEncrypt     envelope with data to encrypt
   * @param      {any}              contract      contract instance or contract id
   * @param      {string}           accountId     encrypting account
   * @param      {string}           propertyName  property in contract, the data is encrypted for
   * @param      {number}           block         block the data belongs to
   * @param      {string}           encryption    encryption name
   * @return     {Promise<string>}  encrypted envelope or hash as string
   */
  public async encrypt(
    toEncrypt: Envelope,
    contract: any,
    accountId: string,
    propertyName: string,
    block: number,
    encryption: string = this.options.defaultCryptoAlgo): Promise<string> {
    const dataContract = (typeof contract === 'object') ?
       contract : this.options.loader.loadContract('DataContractInterface', contract);

    // get content key from contract
    const contentKey = await this.options.sharing.getKey(dataContract.options.address, accountId, propertyName, block);

    if (!contentKey) {
      throw new Error(`no content key found for contract "${dataContract.options.address}" and account "${accountId}"`);
    }

    // encrypt with content key
    const cryptor = this.options.cryptoProvider.getCryptorByCryptoAlgo(encryption);
    const encryptedBuffer = await cryptor.encrypt(toEncrypt.private, { key: contentKey, });
    const encrypted = encryptedBuffer.toString(this.encodingEncrypted);
    const envelope: Envelope = {
      private: encrypted,
      cryptoInfo: cryptor.getCryptoInfo(this.options.nameResolver.soliditySha3(dataContract.options.address)),
    };
    envelope.cryptoInfo.block = block;
    if (toEncrypt.public) {
      envelope.public = toEncrypt.public;
    }
    return JSON.stringify(envelope);
  }

  /**
   * encrypt incoming hash
   *
   * @param      {string}           toEncrypt  hash to encrypt
   * @param      {any}              contract   contract to encrypt data for
   * @param      {string}           accountId  encrypting account
   * @return     {Promise<string>}  encrypted hash as string
   */
  public async encryptHash(toEncrypt: string, contract: any, accountId: string): Promise<string> {
    const dataContract = (typeof contract === 'object') ?
       contract : this.options.loader.loadContract('DataContractInterface', contract);

    // get hash key from contract
    const hashKey = await this.options.sharing.getHashKey(dataContract.options.address, accountId);

    if (!hashKey) {
      throw new Error(`no hashKey found for contract "${dataContract.options.address}" and account "${accountId}"`);
    }
    // encrypt with hashKkey
    const cryptor = this.options.cryptoProvider.getCryptorByCryptoAlgo(this.cryptoAlgorithHashes);
    const encryptedBuffer = await cryptor.encrypt(Buffer.from(toEncrypt.substr(2), this.encodingUnencryptedHash), { key: hashKey, });
    return `0x${encryptedBuffer.toString(this.encodingEncrypted)}`;
  }

  /**
   * return entry from contract
   *
   * @param      {object|string}   contract         contract or contractId
   * @param      {string}          entryName        entry name
   * @param      {string}          accountId        Ethereum account id
   * @param      {boolean}         dfsStorage       store values in dfs
   * @param      {boolean}         encryptedHashes  decrypt hashes from values
   * @return     {Promise<any[]>}  list entries
   */
  public async getEntry(
      contract: any|string,
      entryName: string,
      accountId: string,
      dfsStorage = true,
      encryptedHashes = true): Promise<any> {
    const dataContract = (typeof contract === 'object') ?
      contract : this.options.loader.loadContract('DataContractInterface', contract);
    const entryRaw = await this.options.executor.executeContractCall(
      dataContract,
      'getEntry',
      this.options.web3.utils.sha3(entryName),
    );
    // if no entry / empty entry was returned, skip further processing
    if (entryRaw === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      return entryRaw;
    }
    let hash = entryRaw;
    if (encryptedHashes) {
      hash = await this.decryptHash(entryRaw, dataContract, accountId);
    }
    if (!dfsStorage) {
      return hash;
    } else {
      const encryptedContent = (await this.options.dfs.get(hash)).toString('utf-8');
      const decrypted = await this.decrypt(
        encryptedContent,
        dataContract,
        accountId,
        entryName
      );
      return decrypted.private;
    }
  }

  /**
   * return a value from a mapping
   *
   * @param      {object|string}  contract         contract or contractId
   * @param      {string}         mappingName      name of a data contracts mapping property
   * @param      {string}         entryName        entry name
   * @param      {string}         accountId        Ethereum account id
   * @param      {boolean}        dfsStorage       store values in dfs
   * @param      {boolean}        encryptedHashes  encrypt hashes from values
   * @return     {Promise<any>}   mappings value for given key
   */
  public async getMappingValue(
      contract: any|string,
      mappingName: string,
      entryName: string,
      accountId: string,
      dfsStorage = true,
      encryptedHashes = true): Promise<any> {
    const dataContract = (typeof contract === 'object') ?
      contract : this.options.loader.loadContract('DataContractInterface', contract);
    const entryRaw = await this.options.executor.executeContractCall(
      dataContract,
      'getMappingValue',
      this.options.web3.utils.sha3(mappingName),
      this.options.web3.utils.sha3(entryName),
    );
    let hash = entryRaw;
    if (encryptedHashes) {
      hash = await this.decryptHash(entryRaw, dataContract, accountId);
    }
    if (!dfsStorage) {
      return entryRaw;
    } else {
      const encryptedContent = (await this.options.dfs.get(hash)).toString('utf-8');
      const decrypted = await this.decrypt(
        encryptedContent,
        dataContract,
        accountId,
        mappingName
      );
      return decrypted.private;
    }
  }

  /**
   * return list entries from contract
   *
   * @param      {object|string}   contract         contract or contractId
   * @param      {string}          listName         name of the list in the data contract
   * @param      {string}          accountId        Ethereum account id
   * @param      {boolean}         dfsStorage       store values in dfs
   * @param      {boolean}         encryptedHashes  encrypt hashes from values
   * @param      {number}          count            number of elements to retrieve (page size)
   * @param      {number}          offset           skip this many elements when retrieving
   * @param      {boolean}         reverse          reverse order of entries
   * @return     {Promise<any[]>}  list entries
   */
  public async getListEntries(
      contract: any|string,
      listName: string,
      accountId: string,
      dfsStorage = true,
      encryptedHashes = true,
      count = 10,
      offset = 0,
      reverse = false): Promise<any[]> {
    const dataContract = (typeof contract === 'object') ?
      contract : this.options.loader.loadContract('DataContractInterface', contract);
    const listKey = this.options.web3.utils.sha3(listName);

    const elements = await this.options.nameResolver.getArrayFromUintMapping(
      dataContract,
      () => this.options.executor.executeContractCall(dataContract, 'getListEntryCount', listKey),
      (i) => this.options.executor.executeContractCall(dataContract, 'getListEntry', listKey, i),
      count,
      offset,
      reverse,
    );
    if (!elements.length) {
      // skip processing if no results returned
      return elements;
    }
    let hashes = elements;
    if (encryptedHashes) {
      hashes = await Promise.all(elements.map(element => this.decryptHash(element, dataContract, accountId)));
    }
    if (!dfsStorage) {
      return hashes;
    } else {
      const envelopes = await prottle(requestWindowSize, hashes.map((hash) => async () => {
        const decrypted = await this.decrypt(
          (await this.options.dfs.get(hash)).toString('utf-8'),
          dataContract,
          accountId,
          listName
        );
        return decrypted;
      }));
      return envelopes.map(envelope => envelope.private);
    }
  }

  /**
   * return a single list entry from contract
   *
   * @param      {object|string}  contract         contract or contractId
   * @param      {string}         listName         name of the list in the data contract
   * @param      {number}         index            list entry id to retrieve
   * @param      {string}         accountId        Ethereum account id
   * @param      {boolean}        dfsStorage       store values in dfs
   * @param      {boolean}        encryptedHashes  encrypt hashes from values
   * @return     {Promise<any>}   list entry
   */
  public async getListEntry(
      contract: any|string,
      listName: string,
      index: number,
      accountId: string,
      dfsStorage = true,
      encryptedHashes = true): Promise<any> {
    const dataContract = (typeof contract === 'object') ?
      contract : this.options.loader.loadContract('DataContractInterface', contract);
    const listKey = this.options.web3.utils.sha3(listName);
    const entryRaw = await this.options.executor.executeContractCall(dataContract, 'getListEntry', listKey, index);
    let hash = entryRaw;
    if (encryptedHashes) {
      hash = await this.decryptHash(entryRaw, dataContract, accountId);
    }
    if (!dfsStorage) {
      return hash;
    } else {
      const decrypted = await this.decrypt(
        (await this.options.dfs.get(hash)).toString('utf-8'),
        dataContract,
        accountId,
        listName
      );
      return decrypted.private;
    }
  }

  /**
   * return number of entries in the list
   *
   * @param      {object|string}    contract  contract or contractId
   * @param      {string}           listName  name of the list in the data contract
   * @return     {Promise<number>}  list entry count
   */
  public async getListEntryCount(
      contract: any|string,
      listName: string): Promise<number> {
    const dataContract = (typeof contract === 'object') ?
      contract : this.options.loader.loadContract('DataContractInterface', contract);
    const listKey = this.options.web3.utils.sha3(listName);
    return parseInt(await this.options.executor.executeContractCall(dataContract, 'getListEntryCount', listKey), 10);
  }

  /**
   * move one list entry to one or more lists
   *
   * @param      {object|string}  contract      contract or contractId
   * @param      {string}         listNameFrom  origin list
   * @param      {number}         entryIndex    index of the entry to move in the origin list
   * @param      {string[]}       listNamesTo   lists to move data into
   * @param      {string}         accountId     Ethereum account id
   * @return     {Promise<void>}  resolved when done
   */
  public async moveListEntry(
      contract: any|string,
      listNameFrom: string,
      entryIndex: number,
      listNamesTo: string[],
      accountId: string): Promise<void> {
    const dataContract = (typeof contract === 'object') ?
      contract : this.options.loader.loadContract('DataContractInterface', contract);
    await this.options.executor.executeContractTransaction(
      dataContract,
      'moveListEntry',
      { from: accountId, gas: 2000000, },
      this.options.web3.utils.sha3(listNameFrom),
      entryIndex,
      listNamesTo.map(name => this.options.web3.utils.sha3(name)),
    );
  }

  /**
   * remove list entry from list; will reposition last list entry into emptied slot
   *
   * @param      {object|string}  contract    contract or contractId
   * @param      {string}         listName    name of the list in the data contract
   * @param      {number}         entryIndex  index of list entry
   * @param      {string}         accountId   Ethereum account id
   * @return     {Promise<void>}  resolved when done
   */
  public async removeListEntry(
      contract: any|string,
      listName: string,
      entryIndex: number,
      accountId: string): Promise<void> {
    const dataContract = (typeof contract === 'object') ?
      contract : this.options.loader.loadContract('DataContractInterface', contract);
    await this.options.executor.executeContractTransaction(
      dataContract,
      'removeListEntry',
      { from: accountId, gas: 2000000, },
      this.options.web3.utils.sha3(listName),
      entryIndex,
    );
  }

  /**
   * set entry for a key
   *
   * @param      {object|string}  contract         contract or contractId
   * @param      {string}         entryName        entry name
   * @param      {any}            value            value to add
   * @param      {string}         accountId        Ethereum account id
   * @param      {boolean}        dfsStorage       store values in dfs
   * @param      {boolean}        encryptedHashes  encrypt hashes from values
   * @param      {string}         encryption       encryption algorithm to use
   * @return     {Promise<void>}  resolved when done
   */
  public async setEntry(
      contract: any|string,
      entryName: string,
      value: any,
      accountId: string,
      dfsStorage = true,
      encryptedHashes = true,
      encryption: string = this.options.defaultCryptoAlgo,
      encryptionContext = accountId): Promise<void> {
    const dataContract = (typeof contract === 'object') ?
      contract : this.options.loader.loadContract('DataContractInterface', contract);
    let toSet;

    if (!dfsStorage) {
      // store as is
      toSet = value;
    } else {
      const [ description, blockNr ] = await Promise.all([
        this.options.description.getDescriptionFromContract(dataContract.options.address, encryptionContext),
        this.options.web3.eth.getBlockNumber(),
      ]);
      await this.validate(description, entryName, value);
      const encrypted = await this.encrypt({ private: value }, dataContract, encryptionContext, entryName, blockNr, encryption);
      const stateMd5 = crypto.createHash('md5').update(encrypted).digest('hex');
      toSet = await this.options.dfs.add(stateMd5, Buffer.from(encrypted));
    }
    if (encryptedHashes) {
      toSet = await this.encryptHash(toSet, dataContract, encryptionContext);
    }
    await this.options.executor.executeContractTransaction(
      dataContract,
      'setEntry',
      { from: accountId, autoGas: 1.1, },
      this.options.web3.utils.sha3(entryName),
      toSet,
    );
  }

  /**
   * set entry for a key in a mapping
   *
   * @param      {object|string}  contract         contract or contractId
   * @param      {string}         mappingName      name of a data contracts mapping property
   * @param      {string}         entryName        entry name (property in the mapping)
   * @param      {any}            value            value to add
   * @param      {string}         accountId        Ethereum account id
   * @param      {boolean}        dfsStorage       store values in dfs
   * @param      {boolean}        encryptedHashes  encrypt hashes from values
   * @param      {string}         encryption       encryption algorith (key provider property)
   * @return     {Promise<void>}  resolved when done
   */
  public async setMappingValue(
      contract: any|string,
      mappingName: string,
      entryName: string,
      value: any,
      accountId: string,
      dfsStorage = true,
      encryptedHashes = true,
      encryption: string = this.options.defaultCryptoAlgo,
      encryptionContext = accountId): Promise<void> {
    const dataContract = (typeof contract === 'object') ?
      contract : this.options.loader.loadContract('DataContractInterface', contract);
    let toSet;

    if (!dfsStorage) {
      // store as is
      toSet = value;
    } else {
      const [ description, blockNr ] = await Promise.all([
        this.options.description.getDescriptionFromContract(contract.options.address, encryptionContext),
        this.options.web3.eth.getBlockNumber(),
      ]);
      await this.validate(description, mappingName, value);
      const encrypted = await this.encrypt({ private: value }, dataContract, accountId, mappingName, blockNr);
      const stateMd5 = crypto.createHash('md5').update(encrypted).digest('hex');
      toSet = await this.options.dfs.add(stateMd5, Buffer.from(encrypted));
    }
    if (encryptedHashes) {
      toSet = await this.encryptHash(toSet, dataContract, encryptionContext);
    }
    await this.options.executor.executeContractTransaction(
      dataContract,
      'setMappingValue',
      { from: accountId, autoGas: 1.1, },
      this.options.web3.utils.sha3(mappingName),
      this.options.web3.utils.sha3(entryName),
      toSet,
    );
  }

  private async validate(description: any, fieldName: string, toCheck: any[]) {
    // get merged description
    if (!description) {
      return true;
    }
    const merged = {...description.public, ...description.private};
    if (merged.dataSchema && merged.dataSchema[fieldName]) {
      // check values if description found
      let schema = merged.dataSchema[fieldName];
      if (schema.type === 'array') {
        // for list types, check only items
        schema = schema.items;
      }
      const validator = new Validator({ schema });
      let values;
      if (Array.isArray(toCheck)) {
        values = toCheck;
      } else {
        values = [toCheck];
      }
      const checkFails = values
        .map(value => validator.validate(value))
        .filter(result => result !== true)
      ;
      if (checkFails.length) {
        throw new Error(`validation of input values failed with: ${JSON.stringify(checkFails)}`);
      }
    }
  }
}
