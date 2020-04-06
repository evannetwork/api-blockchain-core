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
  DfsInterface,
  Executor,
  Logger,
  LoggerOptions,
  obfuscate,
} from '@evan.network/dbcp';

import * as accountTypes from './types/types';
import { Container } from '../contracts/digital-twin/container';
import { CryptoProvider } from '../encryption/crypto-provider';
import { DataContract } from '../contracts/data-contract/data-contract';
import { Description } from '../shared-description';
import { Ipld } from '../dfs/ipld';
import { NameResolver } from '../name-resolver';
import { RightsAndRoles, ModificationType, PropertyType } from '../contracts/rights-and-roles';
import { Sharing } from '../contracts/sharing';

/**
 * parameters for Profile constructor
 */
export interface ProfileOptions extends LoggerOptions {
  accountId: string;
  contractLoader: ContractLoader;
  cryptoProvider: CryptoProvider;
  dataContract: DataContract;
  defaultCryptoAlgo: string;
  description: Description;
  dfs: DfsInterface;
  executor: Executor;
  ipld: Ipld;
  nameResolver: NameResolver;
  rightsAndRoles: RightsAndRoles;
  sharing: Sharing;
  profileOwner?: string;
}


/**
 * bookmark to a dapp
 */
export interface DappBookmark {
  description: string;
  img: string;
  primaryColor: string;
  secondaryColor?: string;
  title: string;
}


/**
 * profile helper class, builds profile graphs
 *
 * @class      Profile (name)
 */
export class Profile extends Logger {
  public activeAccount: string;

  public contractLoader: ContractLoader;

  public dataContract: DataContract;

  public defaultCryptoAlgo: string;

  public executor: Executor;

  public ipld: Ipld;

  public nameResolver: NameResolver;

  public options: ProfileOptions;

  public profileContainer: Container;

  public profileContract: any;

  public profileOwner: string;

  public trees: any;

  public treeLabels = {
    activeVerifications: 'activeVerifications',
    addressBook: 'addressBook',
    bookmarkedDapps: 'bookmarkedDapps',
    contacts: 'contacts',
    contracts: 'contracts',
    dtContainerPlugins: 'dtContainerPlugins',
    encryptionKeys: 'encryptionKeys',
    profileOptions: 'profileOptions',
    publicKey: 'publicKey',
    templates: 'templates',
  };

  /**
   * All available account types, mapped to its data contract template specification. Each account
   * type is based on the uspecified type, so each type includes this data too.
   */
  public accountTypes = accountTypes;

  public constructor(options: ProfileOptions) {
    super(options);
    this.activeAccount = options.accountId;
    this.contractLoader = options.contractLoader;
    this.dataContract = options.dataContract;
    this.defaultCryptoAlgo = options.defaultCryptoAlgo;
    this.executor = options.executor;
    this.ipld = options.ipld;
    this.nameResolver = options.nameResolver;
    this.options = options;
    this.profileOwner = options.profileOwner || this.activeAccount;
    this.trees = {};
  }

  /**
   * Check if profile data is correct, according to a specific profile type. Throws, when the data
   * is invalid.
   *
   * @param      {any}     data    profile data (accountDetails, registration, contact, ...)
   * @param      {string}  type    profile type (user, company, device)
   * @return     {booleaen}       true, when it's valid
   */
  public static checkCorrectProfileData(data: any, type: string) {
    // build array with allowed fields (may include duplicates)
    const allowedFields = [
      ...Object.keys(accountTypes.user.template.properties),
      ...Object.keys(accountTypes[type].template.properties),
    ];
    // look for properties, that are not allowed in allowed fields (aka forbidden)
    const notAllowed = Object.keys(data).filter((key) => !allowedFields.includes(key));
    if (notAllowed.length) {
      throw new Error(`one or more fields are not allowed in profile: ${notAllowed}`);
    }

    return true;
  }

  /**
   * add a contract (task contract etc. ) to a business center scope of the current profile
   *
   * @param      {string}         bc       business center ens address or contract address
   * @param      {string}         address  contact address
   * @param      {any}            data     bookmark metadata
   * @return     {Promise<void>}  resolved when done
   */
  public async addBcContract(bc: string, address: string, data: any): Promise<void> {
    this.throwIfNotOwner('add a contract to a specific scope');
    this.ensureTree('contracts');
    const bcSet = await this.ipld.getLinkedGraph(this.trees.contracts, bc);
    if (!bcSet) {
      await this.ipld.set(this.trees.contracts, bc, {}, false);
    }
    await this.ipld.set(this.trees.contracts, `${bc}/${address}`, data, false);
  }

  /**
   * add a key for a contact to address book
   *
   * @param      {string}         address  account key of the contact
   * @param      {string}         context  store key for this context, can be a contract, bc, etc.
   * @param      {string}         key      communication key to store
   * @return     {Promise<void>}  resolved when done
   */
  public async addContactKey(address: string, context: string, key: string): Promise<void> {
    this.log(
      `add contact key: account "${address}", context "${context}", key "${obfuscate(key)}"`,
      'debug',
    );
    this.throwIfNotOwner('add a key for a contact to address book');
    this.ensureTree('addressBook');

    let addressHash;
    // check if address is already hashed
    if (address.length === 42) {
      addressHash = this.nameResolver.soliditySha3(
        ...[
          this.nameResolver.soliditySha3(address),
          this.nameResolver.soliditySha3(this.activeAccount),
        ].sort(),
      );
    } else {
      addressHash = address;
    }
    const keysSet = await this.ipld.getLinkedGraph(this.trees.addressBook, 'keys');
    if (!keysSet) {
      await this.ipld.set(this.trees.addressBook, 'keys', {}, true);
    }
    const contactSet = await this.ipld.getLinkedGraph(
      this.trees.addressBook, `keys/${addressHash}`,
    );
    if (!contactSet) {
      await this.ipld.set(this.trees.addressBook, `keys/${addressHash}`, {}, true);
    }
    await this.ipld.set(this.trees.addressBook, `keys/${addressHash}/${context}`, key, true);
  }

  /**
   * add a contract to the current profile
   *
   * @param      {string}  address  contract address
   * @return     {any}     bookmark info
   */
  public async addContract(address: string, data: any): Promise<any> {
    this.throwIfNotOwner('add a contract');
    this.ensureTree('contracts');
    await this.ipld.set(this.trees.contracts, address, data, false);
  }

  /**
   * add a bookmark for a dapp
   *
   * @param      {string}         address      ENS name or contract address (if no ENS name is set)
   * @param      {DappBookmark}   description  description for bookmark
   * @return     {Promise<void>}  resolved when done
   */
  public async addDappBookmark(address: string, description: DappBookmark): Promise<void> {
    this.throwIfNotOwner('add a dapp bookmark');
    this.ensureTree('bookmarkedDapps');
    if (!address || !description) {
      throw new Error('no valid description or address given!');
    }
    await this.ipld.set(this.trees.bookmarkedDapps, `bookmarkedDapps/${address}`, {}, true);
    const descriptionKeys = Object.keys(description);
    for (const key of descriptionKeys) {
      await this.ipld.set(
        this.trees.bookmarkedDapps, `bookmarkedDapps/${address}/${key}`, description[key], true,
      );
    }
  }

  /**
   * Sets an identity to address book.
   *
   * @param      {string}  address  identity address
   * @param      {string}  key    identity datakey
   * @return     {Promise<void>}  resolved when done
   */
  public async setIdentityAccess(address: string, key: string): Promise<void> {
    this.throwIfNotOwner('add identity Key');
    const context = 'identityAccess';
    await this.addContactKey(address, context, key);
  }

  /**
   * add a profile value to an account
   *
   * @param      {string}         address  account key of the contact
   * @param      {string}         key      store key for the account like alias, etc.
   * @param      {string}         value    value of the profile key
   * @return     {Promise<void>}  resolved when done
   */
  public async addProfileKey(address: string, key: string, value: string): Promise<void> {
    this.throwIfNotOwner('add a profile value to an account');
    this.ensureTree('addressBook');
    const profileSet = await this.ipld.getLinkedGraph(this.trees.addressBook, 'profile');
    if (!profileSet) {
      await this.ipld.set(this.trees.addressBook, 'profile', {}, true);
    }
    const addressSet = await this.ipld.getLinkedGraph(
      this.trees.addressBook, `profile/${address}`,
    );
    if (!addressSet) {
      await this.ipld.set(this.trees.addressBook, `profile/${address}`, {}, true);
    }
    await this.ipld.set(this.trees.addressBook, `profile/${address}/${key}`, value, true);
  }

  /**
   * add a key for a contact to bookmarks
   *
   * @param      {string}         key     public Diffie Hellman key part to store
   * @return     {Promise<void>}  resolved when done
   */
  public async addPublicKey(key: string): Promise<void> {
    this.throwIfNotOwner('set public key');
    this.ensureTree('publicKey');
    await this.ipld.set(this.trees.publicKey, 'publicKey', key, true);
  }

  /**
   * check if a profile has been stored for current account
   *
   * @return     {Promise<boolean>}  true if a contract was registered, false if not
   */
  public async exists(): Promise<boolean> {
    try {
      const ensName = this.nameResolver.getDomainName(this.nameResolver.config.domains.profile);
      const address = await this.nameResolver.getAddress(ensName);
      const indexContract = this.nameResolver.contractLoader.loadContract(
        'ProfileIndexInterface', address,
      );
      const profileContractAddress = await this.executor.executeContractCall(
        indexContract, 'getProfile', this.profileOwner, { from: this.activeAccount },
      );
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
  public async getAddressBook(): Promise<any> {
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
  public async getAddressBookAddress(address: string): Promise<any> {
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
  public async getBcContract(bc: string, address: string): Promise<any> {
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
  public async getBcContracts(bc: string): Promise<any> {
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
  public async getBookmarkDefinitions(): Promise<any> {
    if (!this.trees[this.treeLabels.bookmarkedDapps]) {
      await this.loadForAccount(this.treeLabels.bookmarkedDapps);
    }
    return this.ipld.getLinkedGraph(this.trees[this.treeLabels.bookmarkedDapps], 'bookmarkedDapps');
  }

  /**
   * get a communication key for a contact from bookmarks
   *
   * @param      {string}           address  account key of the contact
   * @param      {string}           context  store key for this context, can be a contract, bc, etc.
   * @return     {Promise<string>}  matching key
   */
  public async getContactKey(address: string, context: string): Promise<string> {
    this.throwIfNotOwner('read a contact key');
    let addressHash;
    // check if address is already hashed
    if (address.length === 42) {
      addressHash = this.nameResolver.soliditySha3(
        ...[
          this.nameResolver.soliditySha3(address),
          this.nameResolver.soliditySha3(this.activeAccount),
        ].sort(),
      );
    } else {
      addressHash = address;
    }
    if (!this.trees[this.treeLabels.addressBook]) {
      await this.loadForAccount(this.treeLabels.addressBook);
    }
    return this.ipld.getLinkedGraph(
      this.trees[this.treeLabels.addressBook], `keys/${addressHash}/${context}`,
    );
  }

  /**
   * get a specific contract entry for a given address
   *
   * @param      {string}        address  contact address
   * @return     {Promise<any>}  bookmark info
   */
  public async getContract(address: string): Promise<any> {
    this.throwIfNotOwner('get a contract');
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
  public async getContracts(): Promise<any> {
    this.throwIfNotOwner('get all contracts');
    if (!this.trees[this.treeLabels.contracts]) {
      await this.loadForAccount(this.treeLabels.contracts);
    }
    return this.ipld.getLinkedGraph(
      this.trees[this.treeLabels.contracts], this.treeLabels.contracts,
    );
  }

  /**
   * get a bookmark for a given address if any
   *
   * @param      {string}        address  ENS name or contract address (if no ENS name is set)
   * @return     {Promise<any>}  bookmark info
   */
  public async getDappBookmark(address: string): Promise<any> {
    this.throwIfNotOwner('get dapp bookmarks');
    if (!this.trees[this.treeLabels.bookmarkedDapps]) {
      await this.loadForAccount(this.treeLabels.bookmarkedDapps);
    }
    return this.ipld.getLinkedGraph(
      this.trees[this.treeLabels.bookmarkedDapps], `bookmarkedDapps/${address}`,
    );
  }

  /**
   * check, known state for given account
   *
   * @param      {string}            accountId  account id of a contact
   * @return     {Promise<boolean>}  true if known account
   */
  public async getContactKnownState(accountId: string): Promise<boolean> {
    const value = await this.dataContract.getMappingValue(
      this.profileContract,
      'contacts',
      accountId,
      this.profileOwner,
      false,
      false,
    );
    return value.substr(-1) !== '0';
  }

  /**
   * get encryption key from profile
   *
   * @param      {string}  context  key context
   */
  public async getEncryptionKey(context: string): Promise<any> {
    this.throwIfNotOwner('get an encryption key');
    if (!this.trees[this.treeLabels.encryptionKeys]) {
      await this.loadForAccount(this.treeLabels.encryptionKeys);
    }

    return this.ipld.getLinkedGraph(
      this.trees[this.treeLabels.encryptionKeys],
      `${this.treeLabels.encryptionKeys}/${context}`,
    );
  }


  /**
   * The adress book needs to be loaded beforehand
   * using loadForAccount API.
   * Gets the identity list from loaded address book.
   * @return     {any}     identity list from address book
   */
  public async getIdentityAccessList(): Promise<any> {
    const addressBook = await this.getAddressBook();
    const { keys } = addressBook;
    // filter key list by hashes with identity access and assign it to result
    const result = {};
    for (const sha9Hash of Object.keys(keys)) {
      if (keys[sha9Hash].identityAccess) {
        result[sha9Hash] = { identityAccess: keys[sha9Hash].identityAccess };
      }
    }
    const profiles = Object.keys(addressBook.profile);
    const activeIdentityHash = this.options.nameResolver.soliditySha3(this.activeAccount);
    for (const id of profiles) {
      const sha9Hash = this.options.nameResolver.soliditySha3(
        ...[
          this.options.nameResolver.soliditySha3(id),
          activeIdentityHash,
        ].sort(),
      );
      if (result[sha9Hash]) {
        result[sha9Hash].alias = addressBook.profile[id].alias;
        result[id] = result[sha9Hash];
      }
    }
    return result;
  }

  /**
   * Return the saved profile information according to the specified profile type. No type directly
   * uses "user" type.
   *
   * @param      {string}        property  Restrict properties that should be loaded.
   * @return     {Promise<any>}  the wantet profile object data (e.g. accountDetails, registration)
   */
  public async getProfileProperty(property: string): Promise<any> {
    // run loadAccount, when it's not runned before
    if (!this.profileContainer) {
      await this.loadForAccount();
    }

    const description = await this.profileContainer.getDescription();

    if (!description.dataSchema || !description.dataSchema[property]) {
      throw new Error(`property "${property}" not found in description of profile`);
    }
    if (description.dataSchema[property].type === 'array') {
      throw new Error(`property "${property}" is type "array", which is not supported`);
    }
    const value = await this.profileContainer.getEntry(property);
    return value !== '0x0000000000000000000000000000000000000000000000000000000000000000'
      ? value
      : null;
  }

  /**
   * get a key from an address in the address book
   *
   * @param      {string}        address  address to look up
   * @param      {string}        key      type of key to get
   * @return     {Promise<any>}  key
   */
  public async getProfileKey(address: string, key: string): Promise<any> {
    this.throwIfNotOwner('get a profile value');
    if (!this.trees[this.treeLabels.addressBook]) {
      await this.loadForAccount(this.treeLabels.addressBook);
    }
    return this.ipld.getLinkedGraph(
      this.trees[this.treeLabels.addressBook], `profile/${address}/${key}`,
    );
  }

  /**
   * get public key of profiles
   *
   * @return     {any}  public key
   */
  public async getPublicKey(): Promise<any> {
    if (!this.trees[this.treeLabels.publicKey]) {
      await this.loadForAccount(this.treeLabels.publicKey);
    }
    return this.ipld.getLinkedGraph(this.trees[this.treeLabels.publicKey], 'publicKey');
  }

  /**
   * get plugin from profile
   */
  public async getPlugins(): Promise<any> {
    this.throwIfNotOwner('get plugins');
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
  // eslint-disable-next-line consistent-return
  public async loadForAccount(tree?: string): Promise<void> {
    // ensure profile contract
    if (!this.profileContract) {
      const ensName = this.nameResolver.getDomainName(this.nameResolver.config.domains.profile);
      const address = await this.nameResolver.getAddress(ensName);
      const indexContract = this.nameResolver.contractLoader.loadContract('ProfileIndexInterface', address);
      const profileContractAddress = await this.executor.executeContractCall(
        indexContract, 'getProfile', this.profileOwner, { from: this.activeAccount },
      );
      if (profileContractAddress === '0x0000000000000000000000000000000000000000') {
        throw new Error(`no profile found for account "${this.profileOwner}"`);
      } else {
        const contractAddress = profileContractAddress.length === 66
          ? this.executor.web3.utils.toChecksumAddress(profileContractAddress.substr(0, 42))
          : profileContractAddress;
        this.profileContract = this.contractLoader.loadContract('DataContractInterface', contractAddress);
        this.profileContainer = new Container(
          { ...this.options, verifications: null, web3: this.options.executor.web3 },
          { accountId: this.activeAccount, address: this.profileContract.address },
        );
      }
    }
    if (tree) {
      this.throwIfNotOwner('load secured profile data');

      let hash;
      if (tree === this.treeLabels.publicKey) {
        hash = await this.dataContract.getEntry(
          this.profileContract, tree, this.activeAccount, false, false,
        );
      } else {
        hash = await this.dataContract.getEntry(
          this.profileContract, tree, this.activeAccount, false, true,
        );
      }
      if (hash === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        this.trees[tree] = {
          bookmarkedDapps: {},
          addressBook: {},
          contracts: {},
        };
        return Promise.resolve();
      }
      await this.loadFromIpld(tree, hash);
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
  public async loadFromIpld(tree: string, ipldIpfsHash: string): Promise<Profile> {
    this.throwIfNotOwner('load secured profile data');
    let loaded;
    try {
      loaded = await this.ipld.getLinkedGraph(ipldIpfsHash);
    } catch (e) {
      this.log(`could not load profile from ipld ${e.message || e}`, 'error');
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
  public async removeBcContract(bc: string, address: string): Promise<void> {
    this.throwIfNotOwner('remove a contract from a specific scope');
    this.ensureTree('contracts');
    const bcSet = await this.ipld.getLinkedGraph(this.trees.contracts, bc);

    if (bcSet) {
      await this.ipld.remove(this.trees.contracts, `${bc}/${address}`);
    }
  }

  /**
   * remove a contact from bookmarkedDapps
   *
   * @param      {string}         address  account key of the contact
   * @return     {Promise<void>}  resolved when done
   */
  public async removeContact(address: string): Promise<void> {
    this.throwIfNotOwner('remove a contract');
    const addressHash = this.nameResolver.soliditySha3(
      ...[
        this.nameResolver.soliditySha3(address),
        this.nameResolver.soliditySha3(this.activeAccount),
      ].sort(),
    );
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
  public async removeDappBookmark(address: string): Promise<void> {
    this.throwIfNotOwner('remove a dapp bookmark');
    if (!address) {
      throw new Error('no valid address given!');
    }
    this.ensureTree('bookmarkedDapps');
    await this.ipld.remove(this.trees.bookmarkedDapps, `bookmarkedDapps/${address}`);
  }


  /**
   * Removes an identity access from address book.
   *
   * @param      {string}  address  identity address
   * @return     {Promise<void>} resolved when done
   */
  public async removeIdentityAccess(address: string): Promise<void> {
    this.throwIfNotOwner('remove identity key');
    const addressHash = this.nameResolver.soliditySha3(
      ...[
        this.nameResolver.soliditySha3(address),
        this.nameResolver.soliditySha3(this.activeAccount),
      ].sort(),
    );
    const addressBook = await this.getAddressBook();
    delete (addressBook.keys[addressHash].identityAccess);
  }

  /**
   * set bookmarks with given value
   *
   * @param      {any}            bookmarks  bookmarks to set
   * @return     {Promise<void>}  resolved when done
   */
  public async setDappBookmarks(bookmarks: any): Promise<void> {
    this.throwIfNotOwner('update a dapp bookmark');
    if (!bookmarks) {
      throw new Error('no valid bookmarks are given');
    }
    this.ensureTree(this.treeLabels.bookmarkedDapps);
    await this.ipld.set(
      this.trees[this.treeLabels.bookmarkedDapps],
      this.treeLabels.bookmarkedDapps,
      bookmarks,
      true,
    );
  }

  /**
   * Load all verifications that should be displayed for this profile within the ui.
   *
   * @return     {string[]}  array of topics of verifications that should be displayed
   */
  public async loadActiveVerifications(): Promise<string[]> {
    this.throwIfNotOwner('get verifications');
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
  public async setActiveVerifications(verifications: string[]): Promise<void> {
    this.throwIfNotOwner('set verifications');
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
      true,
    );
  }

  /**
   * store given state for this account
   *
   * @param      {string}         accountId     account id of a contact
   * @param      {boolean}        contactKnown  true if known, false if not
   * @return     {Promise<void>}  resolved when done
   */
  public async setContactKnownState(accountId: string, contactKnown: boolean): Promise<void> {
    this.throwIfNotOwner('set a contact known state');
    await this.dataContract.setMappingValue(
      this.profileContract,
      'contacts',
      accountId,
      `0x${(contactKnown ? '1' : '0').padStart(64, '0')}`, // cast bool to bytes32
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
  public async setEncryptionKey(context: string, key: string): Promise<void> {
    this.throwIfNotOwner('set an encryption key');
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
  public async setPlugins(plugins: any): Promise<void> {
    this.throwIfNotOwner('set plugins value');
    this.ensureTree(this.treeLabels.dtContainerPlugins);

    await this.ipld.set(
      this.trees[this.treeLabels.dtContainerPlugins],
      this.treeLabels.dtContainerPlugins,
      plugins,
      true,
    );
  }

  /**
   * Takes a set of profile properties and saves them into the profile DataContainer. Throws errors,
   * if not the correct properties are applied for the specified account type.
   *
   * @param      {any}  data    Object that should saved. Each entry will be saved as seperated
   *                            entry.
   */
  public async setProfileProperties(data: any): Promise<void> {
    await this.loadForAccount();

    // older profiles may have an invalid format in files, use these as user
    let accountDetails;
    try {
      accountDetails = await this.getProfileProperty('accountDetails');
    } catch (ex) {
      this.log(`could not get account details, will use this profile as user; ${
        ex.message}` || ex, 'warning');
    }

    // get profile type and forbid invalid type transitions
    let profileType = (accountDetails && accountDetails.profileType)
      ? accountDetails.profileType : 'user';
    if (data.accountDetails
        && data.accountDetails.profileType
        && data.accountDetails.profileType !== profileType
        && profileType !== 'user') {
      throw new Error(`invalid profile type change ${accountDetails.profileType} `
        + `--> ${data.accountDetails.profileType}, change not allowed`);
    }
    if (data.accountDetails
        && data.accountDetails.profileType
        && !Object.keys(accountTypes).includes(data.accountDetails.profileType)) {
      throw new Error(`invalid profile type change ${accountDetails.profileType} `
        + `--> ${data.accountDetails.profileType}, target type not supported`);
    }
    if (data.accountDetails
        && data.accountDetails.profileType
        && data.accountDetails.profileType !== profileType) {
      profileType = data.accountDetails.profileType;
    }

    // build array with allowed fields (may include duplicates)
    Profile.checkCorrectProfileData(data, profileType);

    await this.profileContainer.storeData(data);
  }

  /**
   * stores profile tree or given hash to global profile contract
   *
   * @param      {string}   tree      tree to store ('bookmarkedDapps', 'contracts', ...)
   * @param      {string}   ipldHash  store this hash instead of the current tree for account
   * @return     {Promise}  resolved when done
   */
  public async storeForAccount(tree: string, ipldHash?: string): Promise<void> {
    this.throwIfNotOwner('store secured profile data');
    await this.ensurePropertyInProfile(tree);
    if (ipldHash) {
      this.log(`store tree "${tree}" with given hash to profile contract for account `
        + `"${this.activeAccount}"`);
      if (tree === this.treeLabels.publicKey) {
        await this.dataContract.setEntry(
          this.profileContract, tree, ipldHash, this.activeAccount, false, false,
        );
      } else {
        await this.dataContract.setEntry(
          this.profileContract, tree, ipldHash, this.activeAccount, false, false,
        );
      }
    } else {
      this.log(`store tree "${tree}" to ipld and then to profile contract for account `
        + `"${this.activeAccount}"`);
      const stored = await this.storeToIpld(tree);
      if (tree === this.treeLabels.publicKey) {
        await this.dataContract.setEntry(
          this.profileContract, tree, stored, this.activeAccount, false, false,
        );
      } else {
        await this.dataContract.setEntry(
          this.profileContract, tree, stored, this.activeAccount, false, true,
        );
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
  public async storeToIpld(tree: string): Promise<string> {
    return this.ipld.store(this.trees[tree]);
  }

  /**
   * Throws an exception if a profile was loaded for another account.
   *
   * @param      {string}  action  description of the action that should be performed
   */
  private throwIfNotOwner(action: string) {
    if (this.activeAccount !== this.profileOwner) {
      throw new Error(`tried to ${action} on "${this.profileOwner}"s profile with `
        + `"${this.activeAccount}", this is only supported for the owner of a profile`);
    }
  }

  /**
   * ensure that `activeAccount` has permissions on given tree in profile; will throw if permissions
   * cannot be granted (e.g. because `activeAccount` isn't owner of the profile contract)
   *
   * @param      {string}  tree    name of a tree/entry in profile
   */
  private async ensurePropertyInProfile(tree: string): Promise<void> {
    const hash = this.options.rightsAndRoles.getOperationCapabilityHash(
      tree, PropertyType.Entry, ModificationType.Set,
    );
    if (!await this.options.rightsAndRoles.canCallOperation(
      this.profileContract.options.address, this.activeAccount, hash,
    )) {
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
          algorithm: 'unencrypted',
        },
      };
    } else if (!this.trees[tree]) {
      this.trees[tree] = {};
    }
  }
}
