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

import * as Throttle from 'promise-parallel-throttle';
import crypto = require('crypto');
import { merge, cloneDeep, isEqual } from 'lodash';

import {
  ContractLoader,
  DfsInterface,
  Executor,
  Logger,
  LoggerOptions,
  NameResolver,
  obfuscate,
} from '@evan.network/dbcp';


import * as accountTypes from './types/types';
import { CryptoProvider } from '../encryption/crypto-provider';
import { DataContract } from '../contracts/data-contract/data-contract';
import { Description } from '../shared-description';
import { Ipld } from '../dfs/ipld';
import { KeyExchange } from '../keyExchange';
import { RightsAndRoles, ModificationType, PropertyType } from '../contracts/rights-and-roles';
import { Sharing } from '../contracts/sharing';

/**
 * parameters for Profile constructor
 */
export interface ProfileOptions extends LoggerOptions {
  accountId: string,
  contractLoader: ContractLoader,
  description: Description,
  cryptoProvider: CryptoProvider,
  dataContract: DataContract,
  defaultCryptoAlgo: string,
  dfs: DfsInterface,
  executor: Executor,
  ipld: Ipld,
  nameResolver: NameResolver,
  rightsAndRoles: RightsAndRoles,
  sharing: Sharing,
}


/**
 * bookmark to a dapp
 */
export interface DappBookmark {
  description: string,
  img: string,
  primaryColor: string,
  secondaryColor?: string,
  title: string,
}


/**
 * profile helper class, builds profile graphs
 *
 * @class      Profile (name)
 */
export class Profile extends Logger {
  activeAccount: string;
  contractLoader: ContractLoader;
  dataContract: DataContract;
  defaultCryptoAlgo: string;
  executor: Executor;
  ipld: Ipld;
  nameResolver: NameResolver;
  options: ProfileOptions;
  profileContract: any;
  trees: any;
  treeLabels = {
    activeVerifications: 'activeVerifications',
    addressBook: 'addressBook',
    bookmarkedDapps: 'bookmarkedDapps',
    contracts: 'contracts',
    dtContainerPlugins: 'dtContainerPlugins',
    encryptionKeys: 'encryptionKeys',
    publicKey: 'publicKey',
  };

  /**
   * All available account types, mapped to it's data contract template specification. Each account
   * type is based on the uspecified type, so each type includes this data too.
   */
  accountTypes = accountTypes;

  constructor(options: ProfileOptions) {
    super(options);
    this.activeAccount = options.accountId;
    this.contractLoader = options.contractLoader;
    this.dataContract = options.dataContract;
    this.defaultCryptoAlgo = options.defaultCryptoAlgo;
    this.executor = options.executor;
    this.ipld = options.ipld;
    this.nameResolver = options.nameResolver;
    this.trees = {};
    this.options = options;
  }

  /**
   * add a contract (task contract etc. ) to a business center scope of the current profile
   *
   * @param      {string}         bc       business center ens address or contract address
   * @param      {string}         address  contact address
   * @param      {any}            data     bookmark metadata
   * @return     {Promise<void>}  resolved when done
   */
  async addBcContract(bc: string, address: string, data: any): Promise<void> {
    this.ensureTree('contracts');
    const bcSet = await this.ipld.getLinkedGraph(this.trees['contracts'], bc);
    if (!bcSet) {
      await this.ipld.set(this.trees['contracts'], bc, {}, false);
    }
    await this.ipld.set(this.trees['contracts'], `${bc}/${address}`, data, false);
  }

  /**
   * add a key for a contact to bookmarks
   *
   * @param      {string}         address  account key of the contact
   * @param      {string}         context  store key for this context, can be a contract, bc, etc.
   * @param      {string}         key      communication key to store
   * @return     {Promise<void>}  resolved when done
   */
  async addContactKey(address: string, context: string, key: string): Promise<void> {
    this.log(`add contact key: account "${address}", context "${context}", key "${obfuscate(key)}"`, 'debug');
    this.ensureTree('addressBook');

    let addressHash;
    // check if address is already hashed
    if (address.length === 42) {
      addressHash = this.nameResolver.soliditySha3.apply(this.nameResolver, [
        this.nameResolver.soliditySha3(address),
        this.nameResolver.soliditySha3(this.activeAccount),
      ].sort());
    } else {
      addressHash = address;
    }
    const keysSet = await this.ipld.getLinkedGraph(this.trees['addressBook'], `keys`);
    if (!keysSet) {
      await this.ipld.set(this.trees['addressBook'], 'keys', {}, true);
    }
    const contactSet = await this.ipld.getLinkedGraph(this.trees['addressBook'], `keys/${addressHash}`);
    if (!contactSet) {
      await this.ipld.set(this.trees['addressBook'], `keys/${addressHash}`, {}, true);
    }
    await this.ipld.set(this.trees['addressBook'], `keys/${addressHash}/${context}`, key, true);
  }

  /**
   * add a contract to the current profile
   *
   * @param      {string}  address  contract address
   * @return     {any}     bookmark info
   */
  async addContract(address: string, data: any): Promise<any> {
    this.ensureTree('contracts');
    await this.ipld.set(this.trees['contracts'], address, data, false);
  }

  /**
   * add a bookmark for a dapp
   *
   * @param      {string}         address      ENS name or contract address (if no ENS name is set)
   * @param      {DappBookmark}   description  description for bookmark
   * @return     {Promise<void>}  resolved when done
   */
  async addDappBookmark(address: string, description: DappBookmark): Promise<void> {
    this.ensureTree('bookmarkedDapps');
    if (!address || !description) {
      throw new Error('no valid description or address given!');
    }
    await this.ipld.set(this.trees['bookmarkedDapps'], `bookmarkedDapps/${address}`, {}, true);
    const descriptionKeys = Object.keys(description);
    for (let key of descriptionKeys) {
      await this.ipld.set(this.trees['bookmarkedDapps'], `bookmarkedDapps/${address}/${key}`, description[key], true);
    }
  }

  /**
   * add a profile value to an account
   *
   * @param      {string}         address  account key of the contact
   * @param      {string}         key      store key for the account like alias, etc.
   * @param      {string}         value    value of the profile key
   * @return     {Promise<void>}  resolved when done
   */
  async addProfileKey(address: string, key: string, value: string): Promise<void> {
    this.ensureTree('addressBook');
    const profileSet = await this.ipld.getLinkedGraph(this.trees['addressBook'], `profile`);
    if (!profileSet) {
      await this.ipld.set(this.trees['addressBook'], `profile`, {}, true);
    }
    const addressSet = await this.ipld.getLinkedGraph(this.trees['addressBook'], `profile/${address}`);
    if (!addressSet) {
      await this.ipld.set(this.trees['addressBook'], `profile/${address}`, {}, true);
    }
    await this.ipld.set(this.trees['addressBook'], `profile/${address}/${key}`, value, true);
  }

  /**
   * add a key for a contact to bookmarks
   *
   * @param      {string}         key     public Diffie Hellman key part to store
   * @return     {Promise<void>}  resolved when done
   */
  async addPublicKey(key: string): Promise<void> {
    this.ensureTree('publicKey');
    await this.ipld.set(this.trees['publicKey'], 'publicKey', key, true);
  }

  /**
   * create new profile, store it to profile index initialize addressBook and publicKey
   *
   * @param      {string}         keys    communication key to store
   * @return     {Promise<void>}  resolved when done
   */
  async createProfile(keys: any): Promise<void> {
    // create new profile contract and store in profile index
    const factoryDomain = this.nameResolver.getDomainName(this.nameResolver.config.domains.profileFactory);
    this.profileContract = await this.dataContract.create(factoryDomain, this.activeAccount);
    await Promise.all([
      (async () => {
        const ensName = this.nameResolver.getDomainName(this.nameResolver.config.domains.profile);
        const address = await this.nameResolver.getAddress(ensName);
        const contract = this.nameResolver.contractLoader.loadContract('ProfileIndexInterface', address);
        await this.executor.executeContractTransaction(
          contract, 'setMyProfile', { from: this.activeAccount, autoGas: 1.1, }, this.profileContract.options.address);
      })(),
      (async () => {
        await this.addContactKey(this.activeAccount, 'dataKey', keys.privateKey.toString('hex'));
        await this.addPublicKey(keys.publicKey.toString('hex'));
        await Promise.all([
          this.storeForAccount('addressBook'),
          this.storeForAccount('publicKey')
        ]);
      })(),
    ]);
  }

  /**
   * check if a profile has been stored for current account
   *
   * @return     {Promise<boolean>}  true if a contract was registered, false if not
   */
  async exists(): Promise<boolean> {
    try {
      const ensName = this.nameResolver.getDomainName(this.nameResolver.config.domains.profile);
      const address = await this.nameResolver.getAddress(ensName);
      const indexContract = this.nameResolver.contractLoader.loadContract('ProfileIndexInterface', address);
      const profileContractAddress = await this.executor.executeContractCall(
        indexContract, 'getProfile', this.activeAccount, { from: this.activeAccount, });
      return profileContractAddress !== '0x0000000000000000000000000000000000000000';
    } catch (ex) {
      this.log(`error occurred while checking if profile exists; ${ex.message || ex}`, 'debug');
      return false;
    }
  }

  /**
   * get the whole addressBook
   *
   * @return     {any}     bookmark info
   */
  async getAddressBook(): Promise<any> {
    if (!this.trees[this.treeLabels.addressBook]) {
      await this.loadForAccount(this.treeLabels.addressBook);
    }
    return this.trees[this.treeLabels.addressBook];
  }

  /**
   * get a specific addressBook entry for a given address
   *
   * @param      {string}        address  contact address
   * @return     {Promise<any>}  bookmark info
   */
  async getAddressBookAddress(address: string): Promise<any> {
    if (!this.trees[this.treeLabels.addressBook]) {
      await this.loadForAccount(this.treeLabels.addressBook);
    }
    return this.ipld.getLinkedGraph(this.trees[this.treeLabels.addressBook], `profile/${address}`);
  }

  /**
   * get a specific contract entry for a given address
   *
   * @param      {string}        bc       business center ens address or contract address
   * @param      {string}        address  contact address
   * @return     {Promise<any>}  bookmark info
   */
  async getBcContract(bc: string, address: string): Promise<any> {
    if (!this.trees[this.treeLabels.contracts]) {
      await this.loadForAccount(this.treeLabels.contracts);
    }
    return this.ipld.getLinkedGraph(this.trees[this.treeLabels.contracts], `${bc}/${address}`);
  }

  /**
   * get all contracts grouped under a business center
   *
   * @param      {string}        bc      business center
   * @return     {Promise<any>}  bc contracts.
   */
  async getBcContracts(bc: string): Promise<any> {
    if (!this.trees[this.treeLabels.contracts]) {
      await this.loadForAccount(this.treeLabels.contracts);
    }
    return this.ipld.getLinkedGraph(this.trees[this.treeLabels.contracts], bc);
  }

  /**
   * get all bookmarks for profile
   *
   * @return     {any}  all bookmarks for profile
   */
  async getBookmarkDefinitions(): Promise<any> {
    if (!this.trees[this.treeLabels.bookmarkedDapps]) {
      await this.loadForAccount(this.treeLabels.bookmarkedDapps);
    }
    return this.ipld.getLinkedGraph(this.trees[this.treeLabels.bookmarkedDapps], `bookmarkedDapps`);
  }

  /**
   * get a communication key for a contact from bookmarks
   *
   * @param      {string}           address  account key of the contact
   * @param      {string}           context  store key for this context, can be a contract, bc, etc.
   * @return     {Promise<string>}  matching key
   */
  async getContactKey(address: string, context: string): Promise<string> {
    let addressHash;
    // check if address is already hashed
    if (address.length === 42) {
      addressHash = this.nameResolver.soliditySha3.apply(this.nameResolver, [
        this.nameResolver.soliditySha3(address),
        this.nameResolver.soliditySha3(this.activeAccount),
      ].sort());
    } else {
      addressHash = address;
    }
    if (!this.trees[this.treeLabels.addressBook]) {
      await this.loadForAccount(this.treeLabels.addressBook);
    }
    return this.ipld.getLinkedGraph(this.trees[this.treeLabels.addressBook], `keys/${addressHash}/${context}`);
  }

  /**
   * get a specific contract entry for a given address
   *
   * @param      {string}        address  contact address
   * @return     {Promise<any>}  bookmark info
   */
  async getContract(address: string): Promise<any> {
    if (!this.trees[this.treeLabels.contracts]) {
      await this.loadForAccount(this.treeLabels.contracts);
    }
    return this.ipld.getLinkedGraph(this.trees[this.treeLabels.contracts], address);
  }

  /**
   * get all contracts for the current profile
   *
   * @return     {Promise<any>}  contracts info
   */
  async getContracts(): Promise<any> {
    if (!this.trees[this.treeLabels.contracts]) {
      await this.loadForAccount(this.treeLabels.contracts);
    }
    return this.ipld.getLinkedGraph(this.trees[this.treeLabels.contracts], this.treeLabels.contracts);
  }

  /**
   * get a bookmark for a given address if any
   *
   * @param      {string}        address  ENS name or contract address (if no ENS name is set)
   * @return     {Promise<any>}  bookmark info
   */
  async getDappBookmark(address: string): Promise<any> {
    if (!this.trees[this.treeLabels.bookmarkedDapps]) {
      await this.loadForAccount(this.treeLabels.bookmarkedDapps);
    }
    return this.ipld.getLinkedGraph(this.trees[this.treeLabels.bookmarkedDapps], `bookmarkedDapps/${address}`);
  }

  /**
   * check, known state for given account
   *
   * @param      {string}            accountId  account id of a contact
   * @return     {Promise<boolean>}  true if known account
   */
  async getContactKnownState(accountId: string): Promise<boolean> {
    const value = await this.dataContract.getMappingValue(
      this.profileContract,
      'contacts',
      accountId,
      this.activeAccount,
      false,
      false,
    );
    return value.substr(-1) === '0' ? false : true;
  }

  /**
   * get encryption key from profile
   *
   * @param      {string}  context  key context
   */
  async getEncryptionKey(context: string): Promise<any> {
    if (!this.trees[this.treeLabels.encryptionKeys]) {
      await this.loadForAccount(this.treeLabels.encryptionKeys);
    }

    return this.ipld.getLinkedGraph(
      this.trees[this.treeLabels.encryptionKeys],
      `${this.treeLabels.encryptionKeys}/${context}`,
    );
  }

  /**
   * Return the saved profile information according to the specified profile type. No type directly
   * uses unspecified type.
   *
   * @param      {Array<string>}  properties  Restrict properties that should be loaded.
   * @return     {Promise<any>}  Property keys mapped to it's values. When a property was not set, a
   *                             empty object will be returned
   */
  async getProfileProperties(properties?: Array<string>) {
    const data: any = {  };
    let ajvSpecs;

    // reset previous loaded profile contract to be sure to load corrcet profile data after
    // migration
    delete this.profileContract;
    await this.loadForAccount();

    // try to resolve profiles dbcp and get it's data specification
    try {
      const description = await this.options.description
        .getDescription(this.profileContract.address, this.activeAccount);
      if (description && description.public && description.public.dataSchema) {
        ajvSpecs = description.public.dataSchema;
      }
    } catch (ex) { }

    // if no dbcp data specification could be loaded, resolve it from the profile type and the
    // latest templates
    if (!ajvSpecs) {
      // load account details and type that should be resolved
      const accountDetails = (await this.dataContract.getEntry(this.profileContract, 'accountDetails',
        this.activeAccount)) || { profileType: 'unspecified' };
      data.accountDetails = accountDetails;

      // merge unspecified account specifications with the current selected one
      ajvSpecs = merge(
        cloneDeep(this.accountTypes.unspecified),
        cloneDeep(this.accountTypes[accountDetails.profileType]),
      ).template.properties;
    }

    // load profile data
    await Throttle.all(
      Object.keys(ajvSpecs).map((propKey: string) => async () => {
        // only load properties that should be loaded
        if (!properties || properties.indexOf(propKey) !== -1) {
          const prop = ajvSpecs[propKey];
          const fields = prop.properties ? prop.properties : prop.dataSchema.properties;

          switch (prop.type) {
            case 'array': {
              // TODO: load list entries
              data[propKey] = [ ];
              this.log('list entry loading for profile properties are not implemented!', 'warning');
              break;
            }
            case 'entry':
            default: {
              data[propKey] = data[propKey] || (await this.dataContract.getEntry(
                this.profileContract, propKey, this.activeAccount)) || { };
            }
          }

          // check for file properties that should be decrypted
          await Promise.all(Object.keys(fields).map(async (fieldKey: string) => {
            if (fields[fieldKey].$comment &&
                fields[fieldKey].$comment.indexOf('isEncryptedFile') !== -1 &&
                typeof data[propKey][fieldKey] === 'string') {
              // generate new keys
              const cryptor = this.options.cryptoProvider.getCryptorByCryptoAlgo('aesBlob');
              const hashCryptor = this.options.cryptoProvider.getCryptorByCryptoAlgo('aesEcb');

              const hashKey = await this.options.sharing.getHashKey(
                this.profileContract.options.address,
                this.activeAccount
              );
              const contentKey = await this.options.sharing.getKey(
                this.profileContract.options.address,
                this.activeAccount,
                propKey
              );
              const dencryptedHashBuffer = await hashCryptor.decrypt(
                Buffer.from(data[propKey][fieldKey].substr(2), 'hex'),
                { key: hashKey }
              );
              const retrieved = await (<any>this.options.dfs)
                .get('0x' + dencryptedHashBuffer.toString('hex'), true);
              data[propKey][fieldKey] = await cryptor.decrypt(retrieved, { key: contentKey });
              data[propKey][fieldKey].forEach(file => file.size = file.file.length);
            }
          }));
        }
      })
    );

    return data;
  }

  /**
   * get a key from an address in the address book
   *
   * @param      {string}        address  address to look up
   * @param      {string}        key      type of key to get
   * @return     {Promise<any>}  key
   */
  async getProfileKey(address: string, key: string): Promise<any> {
    if (!this.trees[this.treeLabels.addressBook]) {
      await this.loadForAccount(this.treeLabels.addressBook);
    }
    return this.ipld.getLinkedGraph(this.trees[this.treeLabels.addressBook], `profile/${address}/${key}`);
  }

  /**
   * get public key of profiles
   *
   * @return     {any}  public key
   */
  async getPublicKey(): Promise<any> {
    if (!this.trees[this.treeLabels.publicKey]) {
      await this.loadForAccount(this.treeLabels.publicKey);
    }
    return this.ipld.getLinkedGraph(this.trees[this.treeLabels.publicKey], 'publicKey');
  }

  /**
   * get plugin from profile
   */
  async getPlugins(): Promise<any> {
    if (!this.trees[this.treeLabels.dtContainerPlugins]) {
      await this.loadForAccount(this.treeLabels.dtContainerPlugins);
    }

    return this.ipld.getLinkedGraph(
      this.trees[this.treeLabels.dtContainerPlugins],
      this.treeLabels.dtContainerPlugins,
    );
  }

  /**
   * load profile for given account from global profile contract, if a tree is given, load that tree
   * from ipld as well
   *
   * @param      {string}         tree    tree to load ('bookmarkedDapps', 'contracts', ...)
   * @return     {Promise<void>}  resolved when done
   */
  async loadForAccount(tree?: string): Promise<void> {
    // ensure profile contract
    if (!this.profileContract) {
      const ensName = this.nameResolver.getDomainName(this.nameResolver.config.domains.profile);
      const address = await this.nameResolver.getAddress(ensName);
      const indexContract = this.nameResolver.contractLoader.loadContract('ProfileIndexInterface', address);
      const profileContractAddress = await this.executor.executeContractCall(
        indexContract, 'getProfile', this.activeAccount, { from: this.activeAccount, });
      if (profileContractAddress === '0x0000000000000000000000000000000000000000') {
        throw new Error(`no profile found for account "${this.activeAccount}"`);
      } else {
        const contractAddress = profileContractAddress.length === 66 ?
          this.executor.web3.utils.toChecksumAddress(profileContractAddress.substr(0, 42)) : profileContractAddress;
        this.profileContract = this.contractLoader.loadContract('DataContractInterface', contractAddress);
      }
    }
    if (tree) {
      let hash;
      if (tree === this.treeLabels.publicKey) {
        hash = await this.dataContract.getEntry(this.profileContract, tree, this.activeAccount, false, false);
      } else {
        hash = await this.dataContract.getEntry(this.profileContract, tree, this.activeAccount, false, true);
      }
      if (hash === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        this.trees[tree] = {
          bookmarkedDapps: {},
          addressBook: {},
          contracts: {},
        };
        return Promise.resolve();
      } else {
        await this.loadFromIpld(tree, hash);
      }
    }
  }

  /**
   * load profile from ipfs via ipld dag via ipfs file hash
   *
   * @param      {string}            tree          tree to load ('bookmarkedDapps', 'contracts',
   *                                               ...)
   * @param      {string}            ipldIpfsHash  ipfs file hash that points to a file with ipld a
   *                                               hash
   * @return     {Promise<Profile>}  this profile
   */
  async loadFromIpld(tree: string, ipldIpfsHash: string): Promise<Profile> {
    let loaded;
    try {
     loaded = await this.ipld.getLinkedGraph(ipldIpfsHash);
    } catch (e) {
      this.log(`could not load profile from ipld ${ e.message || e }`, 'error');
      loaded = {
        bookmarkedDapps: {},
        addressBook: {},
        contracts: {},
      };
    }
    this.trees[tree] = loaded;
    return this;
  }

  /**
   * removes a contract (task contract etc. ) from a business center scope of the current profile
   *
   * @param      {string}         bc       business center ens address or contract address
   * @param      {string}         address  contact address
   * @return     {Promise<void>}  resolved when done
   */
  async removeBcContract(bc: string, address: string): Promise<void> {
    this.ensureTree('contracts');
    const bcSet = await this.ipld.getLinkedGraph(this.trees['contracts'], bc);
    if (bcSet) {
      await this.ipld.remove(this.trees['contracts'], `${bc}/${address}`);
    }
  }

  /**
   * remove a contact from bookmarkedDapps
   *
   * @param      {string}         address  account key of the contact
   * @return     {Promise<void>}  resolved when done
   */
  async removeContact(address: string): Promise<void> {
    const addressHash = this.nameResolver.soliditySha3.apply(this.nameResolver, [
      this.nameResolver.soliditySha3(address),
      this.nameResolver.soliditySha3(this.activeAccount),
    ].sort());
    const addressBook = await this.getAddressBook();
    delete addressBook.keys[addressHash];
    delete addressBook.profile[address];
  }

  /**
   * remove a dapp bookmark from the bookmarkedDapps
   *
   * @param      {string}         address  address of the bookmark to remove
   * @return     {Promise<void>}  resolved when done
   */
  async removeDappBookmark(address: string): Promise<void> {
    if (!address ) {
      throw new Error('no valid address given!');
    }
    this.ensureTree('bookmarkedDapps');
    await this.ipld.remove(this.trees['bookmarkedDapps'], `bookmarkedDapps/${address}`);
  }

  /**
   * set bookmarks with given value
   *
   * @param      {any}            bookmarks  bookmarks to set
   * @return     {Promise<void>}  resolved when done
   */
  async setDappBookmarks(bookmarks: any): Promise<void> {
    if (!bookmarks) {
      throw new Error('no valid bookmarks are given');
    }
    this.ensureTree(this.treeLabels.bookmarkedDapps);
    await this.ipld.set(
      this.trees[this.treeLabels.bookmarkedDapps],
      this.treeLabels.bookmarkedDapps,
      bookmarks,
      true
    );
  }

  /**
   * Load all verifications that should be displayed for this profile within the ui.
   *
   * @return     {Array<string>}  array of topics of verifications that should be displayed
   */
  async loadActiveVerifications() {
    const defaultVerifications = [
      '/evan/onboarding/termsofuse',
    ];

    if (!this.trees[this.treeLabels.activeVerifications]) {
      await this.loadForAccount(this.treeLabels.activeVerifications);
    }

    return (await this.ipld.getLinkedGraph(this.trees[this.treeLabels.activeVerifications],
      this.treeLabels.activeVerifications)) || defaultVerifications;
  }

  /**
   * Save an array of active verifications to the profile.
   *
   * @param      {any}            bookmarks  bookmarks to set
   * @return     {Promise<void>}  resolved when done
   */
  async setActiveVerifications(verifications: Array<string>): Promise<void> {
    if (!verifications) {
      throw new Error('no verifications are given');
    }
    // ensure that the tree exists
    this.ensureTree(this.treeLabels.activeVerifications);

    // save it!
    await this.ipld.set(
      this.trees[this.treeLabels.activeVerifications],
      this.treeLabels.activeVerifications,
      verifications,
      true
    );
  }

  /**
   * store given state for this account
   *
   * @param      {string}         accountId     account id of a contact
   * @param      {boolean}        contactKnown  true if known, false if not
   * @return     {Promise<void>}  resolved when done
   */
  async setContactKnownState(accountId: string, contactKnown: boolean): Promise<void> {
    await this.dataContract.setMappingValue(
      this.profileContract,
      'contacts',
      accountId,
      `0x${(contactKnown ? '1' : '0').padStart(64, '0')}`,      // cast bool to bytes32
      this.activeAccount,
      false,
      false,
    );
  }

  /**
   * save encryption key to profile
   *
   * @param      {string}  context  key context
   * @param      {string}  key      key value
   */
  async setEncryptionKey(context: string, key: string): Promise<void> {
    this.ensureTree(this.treeLabels.encryptionKeys);

    await this.ipld.set(
      this.trees[this.treeLabels.encryptionKeys],
      `${this.treeLabels.encryptionKeys}/${context}`,
      key,
      true,
    );
  }

  /**
   * save set of templates to profile
   *
   * @param      {any}     plugin  entire collections of plugin to store in profile
   */
  async setPlugins(plugins: any): Promise<void> {
    this.ensureTree(this.treeLabels.dtContainerPlugins);

    await this.ipld.set(
      this.trees[this.treeLabels.dtContainerPlugins],
      this.treeLabels.dtContainerPlugins,
      plugins,
      true,
    );
  }

  /**
   * Takes a set of profile properties and saves them into the profile data contract. If one
   * property wasn't specified before, it will be permitted for writing.
   *
   * @param      {any}  payload  Object that should saved. Each entry will be saved as seperated
   *                             entry.
   */
  async setProfileProperties(data: any) {
    const profileAddress = this.profileContract.address;
    let description;
    let profileType;

    // gt profile type
    if (data.accountDetails && data.accountDetails.profileType) {
      profileType = data.accountDetails.profileType;
    } else {
      profileType = (await this.getProfileProperties([ 'accountDetails' ])).profileType;
    }

    // try to resolve profiles dbcp and get it's data specification
    try {
      description = await this.options.description
        .getDescription(this.profileContract.address, this.activeAccount);
    } catch (ex) { }

    // fill empty dbcp entries
    description = description || {
      'public': {
        'name': 'Profile Contract',
        'description': 'Profile Contract',
        'author': 'evan.network',
        'tags': [
          'profile'
        ],
        'version': '1.0.0',
        'dbcpVersion': 2
      }
    };
    description.public.dataSchema = description.public.dataSchema || { };

    // latest profile type definition
    const originDescription = cloneDeep(description);
    const latestSpecification = merge(
      cloneDeep(this.accountTypes.unspecified),
      cloneDeep(this.accountTypes[profileType]),
    );
    const newFields = Object
      .keys(latestSpecification.template.properties)
      .filter((propKey: string) => !description.public.dataSchema[propKey]);

    // apply latest specifications after new fields were checked
    Object.keys(latestSpecification.template.properties).forEach((propKey: string) => {
      description.public.dataSchema[propKey] = cloneDeep(latestSpecification.template
        .properties[propKey].dataSchema);
    });

    // set new permissions
    if (newFields.length > 0) {
      const shared = this.options.contractLoader.loadContract('Shared', profileAddress);
      const sharings = await this.options.sharing.getSharingsFromContract(shared);

      await Throttle.all(newFields.map((propKey: string) => async () => {
        // create unique keys for the new fields
        const cryptor = this.options.cryptoProvider.getCryptorByCryptoAlgo('aes');
        const [contentKey, blockNr] = await Promise.all(
          [cryptor.generateKey(), this.executor.web3.eth.getBlockNumber()])
        await this.options.sharing.extendSharings(sharings, this.activeAccount,
          this.activeAccount, propKey, blockNr, contentKey);
        await this.options.rightsAndRoles.setOperationPermission(
          profileAddress,            // contract to be updated
          this.activeAccount,        // account, that can change permissions
          0,                         // role id, uint8 value
          propKey,                   // name of the object
          PropertyType.Entry,        // what type of element is modified
          ModificationType.Set,      // type of the modification
          true,                      // grant this capability
        );
      }));

      await this.options.sharing.saveSharingsToContract(profileAddress, sharings, this.activeAccount);
      await this.options.sharing.getSharings(profileAddress);
    }

    // if description has changed, save it
    if (!isEqual(originDescription, description)) {
      await this.options.description.setDescription(profileAddress, description, this.activeAccount);
    }

    // save the data
    await Throttle.all(Object.keys(data).map((propKey: string) => async () => {
      const fields = description.public.dataSchema[propKey].properties;

      // check for files
      await Promise.all(Object.keys(fields).map(async (fieldKey) => {
        if (fields[fieldKey].$comment &&
            fields[fieldKey].$comment.indexOf('isEncryptedFile') !== -1 &&
            data[propKey][fieldKey] && data[propKey][fieldKey].length !== 0) {
          const blobs = [];
          data[propKey][fields[fieldKey]].forEach((control: any) =>
            blobs.push({
              name: control.name,
              fileType: control.fileType,
              file: control.file
            })
          );
          // generate new keys
          const cryptor = this.options.cryptoProvider.getCryptorByCryptoAlgo('aesBlob')
          const hashCryptor = this.options.cryptoProvider.getCryptorByCryptoAlgo('aesEcb')
          const hashKey = await this.options.sharing.getHashKey(profileAddress, this.activeAccount);
          const contentKey = await this.options.sharing.getKey(profileAddress, this.activeAccount,
            data.type);

          const encryptedFileBuffer = await cryptor.encrypt(blobs, { key: contentKey })
          const stateMd5 = crypto.createHash('md5').update(encryptedFileBuffer).digest('hex')
          const fileHash = await this.options.dfs.add(stateMd5, encryptedFileBuffer)
          const encryptedHashBuffer = await hashCryptor.encrypt(
            Buffer.from(fileHash.substr(2), 'hex'), { key: hashKey })
          const encryptedHashString = `0x${encryptedHashBuffer.toString('hex')}`
          data[propKey][fields[fieldKey]] = encryptedHashString;
        }
      }));

      await this.options.dataContract.setEntry(
        this.profileContract,
        propKey,
        data[propKey],
        this.activeAccount
      );
    }));
  }

  /**
   * stores profile tree or given hash to global profile contract
   *
   * @param      {string}   tree      tree to store ('bookmarkedDapps', 'contracts', ...)
   * @param      {string}   ipldHash  store this hash instead of the current tree for account
   * @return     {Promise}  resolved when done
   */
  async storeForAccount(tree: string, ipldHash?: string): Promise<void> {
    await this.ensurePropertyInProfile(tree);
    if (ipldHash) {
      this.log(`store tree "${tree}" with given hash to profile contract for account "${this.activeAccount}"`);
      if (tree === this.treeLabels.publicKey) {
        await this.dataContract.setEntry(this.profileContract, tree, ipldHash, this.activeAccount, false, false);
      } else {
        await this.dataContract.setEntry(this.profileContract, tree, ipldHash, this.activeAccount, false, false);
      }
    } else {
      this.log(`store tree "${tree}" to ipld and then to profile contract for account "${this.activeAccount}"`);
      const stored = await this.storeToIpld(tree);
      let hash;
      if (tree === this.treeLabels.publicKey) {
        await this.dataContract.setEntry(this.profileContract, tree, stored, this.activeAccount, false, false);
      } else {
        await this.dataContract.setEntry(this.profileContract, tree, stored, this.activeAccount, false, true);
      }
      await this.loadForAccount(tree);
    }
  }

  /**
   * store profile in ipfs as an ipfs file that points to a ipld dag
   *
   * @param      {string}           tree    tree to store ('bookmarkedDapps', 'contracts', ...)
   * @return     {Promise<string>}  hash of the ipfs file
   */
  async storeToIpld(tree: string): Promise<string> {
    return await this.ipld.store(this.trees[tree]);
  }

  /**
   * ensure that `activeAccount` has permissions on given tree in profile; will throw if permissions
   * cannot be granted (e.g. because `activeAccount` isn't owner of the profile contract)
   *
   * @param      {string}  tree    name of a tree/entry in profile
   */
  private async ensurePropertyInProfile(tree: string): Promise<void> {
    const hash = this.options.rightsAndRoles.getOperationCapabilityHash(
      tree, PropertyType.Entry, ModificationType.Set);
    if (! await this.options.rightsAndRoles.canCallOperation(
        this.profileContract.options.address, this.activeAccount, hash)) {
      await this.options.rightsAndRoles.setOperationPermission(
        this.profileContract,
        this.activeAccount,
        0,
        tree,
        PropertyType.Entry,
        ModificationType.Set,
        true,
      );
    }
  }

  /**
   * make sure that specified tree is available locally for inserting values
   *
   * @param      {string}  tree    name of the tree
   */
  private ensureTree(tree: string): void {
    if (!this.trees[tree] && tree === 'publicKey') {
      this.trees[tree] = {
        cryptoInfo: {
          algorithm: 'unencrypted'
        },
      };
    } else if (!this.trees[tree]) {
      this.trees[tree] = {};
    }
  }
}
