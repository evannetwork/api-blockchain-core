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
  Cryptor,
  Description,
  Executor,
  DfsInterface,
  KeyProvider,
  NameResolver,
  Logger,
  LoggerOptions,
} from '@evan.network/dbcp';

import { CryptoProvider } from '../encryption/crypto-provider';


// constant hash: this.options.nameResolver.soliditySha3('*')
const catchAllSection = '0x04994f67dc55b09e814ab7ffc8df3686b4afb2bb53e60eae97ef043fe03fb829';

export interface SharingOptions extends LoggerOptions {
  contractLoader: ContractLoader;
  cryptoProvider: CryptoProvider;
  description: Description;
  executor: Executor;
  dfs: DfsInterface;
  keyProvider: KeyProvider;
  nameResolver: NameResolver;
  defaultCryptoAlgo?: string;
}

/**
 * Sharing helper. Can add Sharings to contract addresses and ENS endpoints
 *
 * @class      Sharing (name)
 */
export class Sharing extends Logger {
  options: SharingOptions;

  private readonly encodingUnencrypted = 'binary';
  private readonly encodingEncrypted = 'hex';
  private sharingCache = {};
  private hashCache = {};

  constructor(options: SharingOptions) {
    super(options);
    this.options = Object.assign({
      defaultCryptoAlgo: 'aes',
    }, options);
  }

  /**
   * add a sharing to a contract or an ENS address
   *
   * @param      {string}         address     contract address or ENS address
   * @param      {string}         originator  Ethereum account id of the sharing user
   * @param      {string}         partner     Ethereum account id for which key shall be added
   * @param      {string}         section     data section the key is intended for or '*'
   * @param      {number|string}  block       starting with this block, the key is valid
   * @param      {string}         sharingKey  key to share
   * @param      {string}         context     context to share key in
   * @param      {boolean}        isHashKey   indicates if given key already is a hash key
   * @param      {string}         sharingId   id of a sharing (when multi-sharings is used)
   * @return     {Promise<void>}  resolved when done
   */
  public async addSharing(
      address: string,
      originator: string,
      partner: string,
      section: string,
      block: number|string,
      sharingKey: string,
      context?: string,
      isHashKey = false,
      sharingId: string = null,
      ): Promise<void> {
    let sharings;
    let contract;
    let description;

    // load
    if (address.startsWith('0x')) {
      // encrypted sharings from contract
      if (sharingId) {
        contract = this.options.contractLoader.loadContract('MultiShared', address);
      } else {
        contract = this.options.contractLoader.loadContract('Shared', address);
      }
      sharings = await this.getSharingsFromContract(contract, sharingId);
    } else {
      throw new Error('setting sharings to ens adresses is not supported');
    }

    // extend sharings
    sharings = await this.extendSharings(sharings, originator, partner, section, block, sharingKey, context);

    // if not already sharing a hash key
    if (!isHashKey) {
      // check, if partner already has a hash key
      const setHashKey = await this.getHashKey(address, partner, sharingId);
      if (!setHashKey) {
        // retrieve hash key with originator account, extend hash key if required
        const hashKey = await this.getHashKey(address, originator, sharingId);
        if (hashKey) {
          await this.extendSharings(sharings, originator, partner, '*', 'hashKey', hashKey, context);
        } else {
          this.log('originator does not have access to a hash key, skipping setting it', 'debug');
        }
      } else {
        this.log('partners hash key already set, skipping setting it', 'debug');
      }
    }

    // save updated sharings
    await this.saveSharingsToContract(address, sharings, originator, sharingId);
  }

  /**
   * add a hash to to cache, can be used to speed up sharing key retrieval, when
   * sharings hash is already known
   *
   * @param      {string}  address    contract address
   * @param      {any}     sharings   encrypted sharings object
   * @param      {string}  sharingId  id of a multisharing
   */
  public addHashToCache(address: string, sharings: any, sharingId: string = null): void {
    if (!this.hashCache[address]) {
      this.hashCache[address] = {};
    }
    this.hashCache[address][sharingId] = sharings;
  }

  /**
   * Bump keys for given accounts by adding given key to their sharings. This is basically a
   * shorthand version for adding the new key for every account in the `partners` array in a single
   * transaction. Sharing context and sharingIds are currently not supported.
   *
   * @param      {string}         address     contract address
   * @param      {string}         originator  executing users account id
   * @param      {string}         partners    account ids of a contract participant
   * @param      {string}         section     data section the key is intended for or '*'
   * @param      {number}         block       starting with this block, the key is valid
   * @param      {string}         sharingKey  new key to share
   * @return     {Promise<void>}  resolved when done
   */
  public async bumpSharings(
      address: string,
      originator: string,
      partners: string[],
      section: string,
      block: number,
      sharingKey: string,
    ): Promise<void> {
    let sharings;
    let contract;
    let description;

    // load
    if (address.startsWith('0x')) {
      // encrypted sharings from contract
      contract = this.options.contractLoader.loadContract('Shared', address);
      sharings = await this.getSharingsFromContract(contract);
    } else {
      description = await this.options.description.getDescriptionFromEns(address);
      // ensure sharings
      if (description && description.public && description.public.sharings) {
        sharings = description.public.sharings;
      } else {
        sharings = {};
      }
      // ensure description
      if (!description) {
        description = {};
      }
      if (!description.public) {
        description.public = {};
      }
    }

    // add new keys
    for (let partner of partners) {
      sharings = await this.extendSharings(sharings, originator, partner, section, block, sharingKey);
    }

    // save updated sharings
    if (address.startsWith('0x')) {
      await this.saveSharingsToContract(address, sharings, originator);
    } else {
      // save to ens
      description.public.sharings = sharings;
      await this.options.description.setDescriptionToEns(address, description, originator);
    }
  }

  /**
   * clear caches and fetch new hashes and sharing on next request
   *
   * @return     {void}  resolved when done
   */
  public clearCache() {
    this.sharingCache = {};
    this.hashCache = {};
  }

  /**
   * give hash key "hashKey" to account "partner", if this account does not have a hash key already
   *
   * @param      {string}         address     contract adress
   * @param      {string}         originator  executing users account id
   * @param      {string}         partner     account id of a contract participant
   * @param      {string}         hashKey     key for DFS hashes
   * @param      {string}         context     (optional) context for encryption
   * @param      {string}         sharingId   id of a sharing (when multi-sharings is used)
   * @return     {Promise<void>}  resolved when done
   */
  public async ensureHashKey(
      address: string, originator: string, partner: string, hashKey: string, context?: string, sharingId: string = null): Promise<void> {
    const setHashKey = await this.getHashKey(address, partner, sharingId);
    if (!setHashKey) {
      return this.addSharing(address, originator, partner, '*', 'hashKey', hashKey, context, true, sharingId);
    }
  }

  /**
   * extend an existing sharing info with given key; this is done on a sharings object and does not
   * perform a transaction on its own
   *
   * @param      {any}            sharings    a sharings info
   * @param      {string}         originator  Ethereum account id of the sharing user
   * @param      {string}         partner     Ethereum account id for which key shall be added
   * @param      {string}         section     data section the key is intended for or '*'
   * @param      {number|string}  block       starting with this block, the key is valid
   * @param      {string}         sharingKey  key to share
   * @param      {string}         context     context to share key in
   * @return     {Promise<any>}   updated sharings info
   */
  public async extendSharings(
      sharings: any,
      originator: string,
      partner: string,
      section: string,
      block: number|string,
      sharingKey: string,
      context?: string): Promise<string> {
    // encrypt sharing key
    const originatorHash = this.options.nameResolver.soliditySha3(originator);
    const partnerHash = this.options.nameResolver.soliditySha3(partner);
    const sectionHash = this.options.nameResolver.soliditySha3(section);
    const edgeKey = context ? this.options.nameResolver.soliditySha3(context) :
      this.options.nameResolver.soliditySha3.apply(this.options.nameResolver, [originatorHash, partnerHash].sort());
    const cryptor = this.options.cryptoProvider.getCryptorByCryptoAlgo(this.options.defaultCryptoAlgo);
    const cryptoInfo = cryptor.getCryptoInfo(edgeKey);
    const encryptionKey = await this.options.keyProvider.getKey(cryptoInfo);
    if (!encryptionKey) {
      throw new Error(`could not extend sharings, no key found for "${originatorHash}" to "${partnerHash}"` +
        `${context ? (' in context "' + context + '"') : ''}`);
    }
    const encryptedBuffer = await cryptor.encrypt(sharingKey, { key: encryptionKey, });
    sharings[partnerHash] = sharings[partnerHash] ? sharings[partnerHash] : {};
    sharings[partnerHash][sectionHash] = sharings[partnerHash][sectionHash] ? sharings[partnerHash][sectionHash] : {};
    sharings[partnerHash][sectionHash][block] = {
      private: encryptedBuffer.toString(this.encodingEncrypted),
      cryptoInfo,
    };
    return sharings;
  }

  /**
   * returns an accounts key for file hashes
   *
   * @param      {string}           address    contract address or ENS address
   * @param      {string}           partner    Ethereum account id for which key shall be retrieved
   * @param      {string}           sharingId  id of a sharing (when multi-sharings is used)
   * @return     {Promise<string>}  matching key
   */
  public async getHashKey(address: string, partner: string, sharingId: string = null): Promise<any> {
    return this.getKey(address, partner, '*', 'hashKey', sharingId);
  }

  /**
   * get sharing from a contract, if _partner, _section, _block matches
   *
   * @param      {string}        address   address of a contract or an ENS address
   * @param      {string}        _partner  Ethereum account id for which key shall be retrieved
   * @param      {string}        _section  data section the key is intended for or '*'
   * @param      {number}        _block    starting with this block, the key is valid
   * @return     {Promise<any>}  sharings as an object.
   */
  public async getSharings(address: string, _partner?: string, _section?: string, _block?: number, sharingId: string = null): Promise<any> {
    let sharings;
    if (address.startsWith('0x')) {
      // encrypted sharings from contract
      let contract;
      if (sharingId) {
        contract = this.options.contractLoader.loadContract('MultiShared', address);
      } else {
        contract = this.options.contractLoader.loadContract('Shared', address);
      }
      sharings = await this.getSharingsFromContract(contract, sharingId);
    } else {
      // enrypted sharings from ens
      const description = await this.options.description.getDescriptionFromEns(address);
      if (description && description.public && description.public.sharings) {
        sharings = description.public.sharings;
      } else {
        sharings = {};
      }
    }
    return this.decryptSharings(sharings, _partner, _section, _block);
  }

  /**
   * get encrypted sharings from smart contract
   *
   * @param      {any}           contract   contract with sharing info
   * @param      {string}        sharingId  id of a sharing in mutlisharings
   * @return     {Promise<any>}  sharings object
   */
  public async getSharingsFromContract(contract: any, sharingId: string = null): Promise<any> {
    let result = {};
    let sharings;

    // use preloaded hashes if available
    if (!this.hashCache[contract.options.address] ||
        !this.hashCache[contract.options.address][sharingId] ||
        this.hashCache[contract.options.address][sharingId] === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      if (!this.hashCache[contract.options.address]) {
        this.hashCache[contract.options.address] = {};
      }

      let sharingHash;

      if (sharingId) {
        sharingHash =
          await this.options.executor.executeContractCall(contract, 'multiSharings', sharingId);
      } else {
        sharingHash =
          await this.options.executor.executeContractCall(contract, 'sharing');
      }

      if (sharingHash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        const buffer = await this.options.dfs.get(sharingHash);
        if (!buffer) {
          throw new Error(`could not get sharings from hash ${sharingHash}`);
        }
        this.hashCache[contract.options.address][sharingId] = JSON.parse(buffer.toString());
      } else {
        this.hashCache[contract.options.address][sharingId] = {};
      }
    }
    return this.hashCache[contract.options.address][sharingId];
  }

  /**
   * get a content key from the sharing of a contract
   *
   * @param      {string}           address    contract address or ENS address
   * @param      {string}           partner    Ethereum account id for which key shall be retrieved
   * @param      {string}           section    data section the key is intended for or '*'
   * @param      {number|string}    block      starting with this block, the key is valid
   * @param      {string}           sharingId  id of a sharing (when multi-sharings is used)
   * @return     {Promise<string>}  matching key
   */
  public async getKey(
      address: string,
      partner: string,
      section: string,
      block: number|string = Number.MAX_SAFE_INTEGER,
      sharingId: string = null): Promise<string> {
    const partnerHash = this.options.nameResolver.soliditySha3(partner);
    const sectionHash = this.options.nameResolver.soliditySha3(section || '*');
    if (!this.sharingCache[address] ||
        !this.sharingCache[address][sharingId] ||
        !this.sharingCache[address][sharingId][partnerHash] ||
        !this.sharingCache[address][sharingId][partnerHash][sectionHash] ||
        !this.sharingCache[address][sharingId][partnerHash][sectionHash][block]) {
      if (!this.sharingCache[address]) {
        this.sharingCache[address] = {};
      }
      this.sharingCache[address][sharingId] = await this.getSharings(address, null, null, null, sharingId);
    }
    // check partner
    const partnerSections = this.sharingCache[address][sharingId][partnerHash];
    if (!partnerSections) {
      this.log(`could not find any keys for "${address}" and partner "${partner}"`, 'debug');
    } else {
      // check section
      let sectionBlocks;
      if (partnerSections[sectionHash]) {
        sectionBlocks = partnerSections[sectionHash];
      } else if (partnerSections[catchAllSection]) {
        sectionBlocks = partnerSections[catchAllSection];
      } else {
        this.log(`could not find section keys for contract "${address}" and partner "${partner}" for section "${section}"`, 'debug');
        return undefined;
      }
      if (typeof block === 'number') {
        // look for matching block
        // the block key, that was set last before encrypting (encryption happened after block ${block})
        const blocks = Object.keys(sectionBlocks).map(blockNr => parseInt(blockNr, 10));
        const lteBlocks = blocks.filter(blockNr => blockNr <= block);
        if (!lteBlocks.length) {
          this.log(`could not find key for contract "${address}" and partner "${partner}" ` +
            `for section "${section}", that is new enough`, 'debug');
        } else {
          // oldest key block, that is younger than the context block
          const matchingBlock = lteBlocks[lteBlocks.length - 1];
          return sectionBlocks[matchingBlock];
        }
      } else {
        // use drectly matching block (e.g. for 'hashKey')
        return sectionBlocks[block];
      }

    }
  }

  /**
   * get history of keys for an account and a section
   *
   * @param      {string}        address    contract address or ENS address
   * @param      {string}        partner    Ethereum account id for which key shall be retrieved
   * @param      {string}        section    data section the key is intended for or '*'
   * @param      {string}        sharingId  id of a sharing (when multi-sharings is used)
   * @return     {Promise<any>}  object with key: blockNr, value: key
   */
  public async getKeyHistory(address: string, partner: string, section: string, sharingId: string = null): Promise<any[]> {
    const sharings = await this.getSharings(address, partner, section, null, sharingId);
    const partnetHash = this.options.nameResolver.soliditySha3(partner);
    const sectiontHash = this.options.nameResolver.soliditySha3(section);
    if (sharings && sharings[partnetHash] && sharings[partnetHash][sectiontHash]) {
      return sharings[partnetHash][sectiontHash];
    } else {
      return null;
    }
  }

  /**
   * remove a sharing key from a contract with sharing info
   *
   * @param      {string}         address     contract address or ENS address
   * @param      {string}         originator  Ethereum account id of the sharing user
   * @param      {string}         partner     Ethereum account id for which key shall be removed
   * @param      {string}         section     data section of the key
   * @param      {string}         sharingId   id of a sharing (when multi-sharings is used)
   * @return     {Promise<void>}  resolved when done
   */
  public async removeSharing(
      address: string,
      originator: string,
      partner: string,
      section: string,
      sharingId: string = null): Promise<void> {
    const partnerHash = this.options.nameResolver.soliditySha3(partner);
    const sectionHash = this.options.nameResolver.soliditySha3(section);
    let sharings;
    let contract;
    let description;
    // load
    if (address.startsWith('0x')) {
      if (sharingId) {
        contract = this.options.contractLoader.loadContract('MultiShared', address);
      } else {
        contract = this.options.contractLoader.loadContract('Shared', address);
      }
      sharings = await this.getSharingsFromContract(contract, sharingId);
    } else {
      description = await this.options.description.getDescriptionFromEns(address);
      // ensure sharings
      if (description && description.public && description.public.sharings) {
        sharings = description.public.sharings;
      } else {
        sharings = {};
      }
      // ensure description
      if (!description) {
        description = {};
      }
      if (!description.public) {
        description.public = {};
      }
    }
    if (sharings[partnerHash] && sharings[partnerHash][sectionHash]) {
      // delete entry
      delete sharings[partnerHash][sectionHash];
      // remove from cache if already cached
       if (this.sharingCache[address] &&
          this.sharingCache[address][sharingId] &&
          this.sharingCache[address][sharingId][partnerHash] &&
          this.sharingCache[address][sharingId][partnerHash][sectionHash]) {
        delete this.sharingCache[address][sharingId][partnerHash][sectionHash];
       }
      // save
      if (address.startsWith('0x')) {
        const updatedHash = await this.options.dfs.add(
          'sharing', Buffer.from(JSON.stringify(sharings), this.encodingUnencrypted));
        if (sharingId) {
          await this.options.executor.executeContractTransaction(
            contract, 'setMultiSharing', { from: originator, autoGas: 1.1, }, sharingId, updatedHash);
        } else {
          await this.options.executor.executeContractTransaction(
            contract, 'setSharing', { from: originator, autoGas: 1.1, }, updatedHash);
        }
        if (this.hashCache[contract.options.address] && this.hashCache[contract.options.address][sharingId]) {
          delete this.hashCache[contract.options.address][sharingId];
        }
      } else {
        // save to ens
        description.public.sharings = sharings;
        await this.options.description.setDescriptionToEns(address, description, originator);
      }
    }
  }

  /**
   * save sharings object with encrypted keys to contract
   *
   * @param      {string|any}     contract    contract address or instance
   * @param      {any}            sharings    sharings object with encrypted keys
   * @param      {string}         originator  Ethereum account id of the sharing user
   * @param      {string}         sharingId   id of a sharing (when multi-sharings is used)
   * @return     {Promise<void>}  resolved when done
   */
  public async saveSharingsToContract(
      contract: string, sharings: any, originator: string, sharingId?: string): Promise<void> {
    let shareContract;
    if (typeof contract === 'string') {
      if (sharingId) {
        shareContract = this.options.contractLoader.loadContract('MultiShared', contract);
      } else {
        shareContract = this.options.contractLoader.loadContract('Shared', contract);
      }
    } else {
      shareContract = contract;
    }
    // upload to ipfs and hash
    const updatedHash = await this.options.dfs.add(
      'sharing', Buffer.from(JSON.stringify(sharings), this.encodingUnencrypted));
    // save to contract
    if (sharingId) {
      await this.options.executor.executeContractTransaction(
        shareContract, 'setMultiSharing', { from: originator, autoGas: 1.1, }, sharingId, updatedHash);
    } else {
      await this.options.executor.executeContractTransaction(
        shareContract, 'setSharing', { from: originator, autoGas: 1.1, }, updatedHash);
    }
    if (this.hashCache[shareContract.options.address] && this.hashCache[shareContract.options.address][sharingId]) {
      delete this.hashCache[shareContract.options.address][sharingId];
    }
  }

  private async decryptSharings(sharings: any, _partner?: string, _section?: string, _block?: number): Promise<any> {
    let result = {};
    const _partnerHash = _partner ? this.options.nameResolver.soliditySha3(_partner) : null;
    for (let partnerHashKey of Object.keys(sharings)) {
      if (_partnerHash && _partnerHash !== partnerHashKey) {
        continue;
      }
      result[partnerHashKey] = {};
      const partner = sharings[partnerHashKey];
      const _sectionHash = _section ? this.options.nameResolver.soliditySha3(_section) : null;
      for (let sectionHashKey of Object.keys(partner)) {
        if (_sectionHash && _sectionHash !== sectionHashKey) {
          continue;
        }
        result[partnerHashKey][sectionHashKey] = {};
        const section = partner[sectionHashKey];
        for (let blockKey of Object.keys(section)) {
          if (_block && _block !== parseInt(blockKey, 10)) {
            continue;
          }
          const block = section[blockKey];
          const cryptor = this.options.cryptoProvider.getCryptorByCryptoInfo(block.cryptoInfo);
          const decryptKey = await this.options.keyProvider.getKey(block.cryptoInfo);
          if (decryptKey) {
            const decrypted = await cryptor.decrypt(
              Buffer.from(block.private, this.encodingEncrypted), { key: decryptKey, });
            result[partnerHashKey][sectionHashKey][blockKey] = decrypted.toString(this.encodingUnencrypted);
          }
        }
        if (!Object.keys(result[partnerHashKey][sectionHashKey]).length) {
          delete result[partnerHashKey][sectionHashKey]
        }
      }
      if (!Object.keys(result[partnerHashKey]).length) {
        delete result[partnerHashKey];
      }
    }
    return result;
  }
}
