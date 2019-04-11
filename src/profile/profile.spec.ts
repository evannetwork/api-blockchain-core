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

import 'mocha';
import { expect } from 'chai';
// import IpfsServer = require('ipfs');

import {
  ContractLoader,
  KeyProvider,
  NameResolver,
  SignerInternal,
} from '@evan.network/dbcp';

import { accountMap } from '../test/accounts';
import { accounts } from '../test/accounts';
import { Aes } from '../encryption/aes';
import { config } from '../config';
import { CryptoProvider } from '../encryption/crypto-provider';
import { DataContract } from '../contracts/data-contract/data-contract';
import { Ipld } from '../dfs/ipld';
import { KeyExchange } from '../keyExchange';
import { Mailbox } from '../mailbox';
import { Profile } from './profile';
import { RightsAndRoles } from '../contracts/rights-and-roles';
import { TestUtils } from '../test/test-utils';


describe('Profile helper', function() {
  this.timeout(600000);
  let ipfs;
  let ipld;
  let nameResolver: NameResolver;
  let ensName;
  let web3;
  let dataContract: DataContract;
  let contractLoader: ContractLoader;
  let keyExchange;
  let mailbox;
  let executor;
  let rightsAndRoles: RightsAndRoles;
  let cryptoProvider;
  const sampleDesc = {
    title: 'sampleTest',
    description: 'desc',
    img: 'img',
    primaryColor: '#FFFFFF',
  };
  const sampleUpdateDesc = {
    title: 'sampleUpdateTest',
    description: 'desc',
    img: 'img',
    primaryColor: '#FFFFFF',
  };
  const emptyProfile = {
    bookmarkedDapps: {},
    addressBook: {},
    contracts: {}
  }

  before(async () => {
    web3 = TestUtils.getWeb3();
    ipfs = await TestUtils.getIpfs();
    ipld = await TestUtils.getIpld(ipfs);
    contractLoader = await TestUtils.getContractLoader(web3);
    dataContract = await TestUtils.getDataContract(web3, ipld.ipfs)
    nameResolver = await TestUtils.getNameResolver(web3);
    ensName = nameResolver.getDomainName(config.nameResolver.domains.profile);
    cryptoProvider = await TestUtils.getCryptoProvider();
    mailbox = new Mailbox({
      mailboxOwner: accounts[0],
      nameResolver: await TestUtils.getNameResolver(web3),
      ipfs: ipld.ipfs,
      contractLoader: await TestUtils.getContractLoader(web3),
      cryptoProvider,
      keyProvider:  TestUtils.getKeyProvider(),
      defaultCryptoAlgo: 'aes',
    });
    const keyExchangeOptions = {
      mailbox: mailbox,
      cryptoProvider,
      defaultCryptoAlgo: 'aes',
      account: accounts[0],
      keyProvider: TestUtils.getKeyProvider(),
    };
    keyExchange = new KeyExchange(keyExchangeOptions);
    const eventHub = await TestUtils.getEventHub(web3);
    executor = await TestUtils.getExecutor(web3);
    executor.eventHub = eventHub;
    rightsAndRoles = await TestUtils.getRightsAndRoles(web3);
  });

  it('should be able to be add contact keys', async () => {
    let profile = new Profile({
      nameResolver,
      defaultCryptoAlgo: 'aes',
      dataContract,
      contractLoader,
      ipld,
      executor,
      accountId: accounts[0],
      rightsAndRoles,
    });
    await profile.addContactKey(accounts[0], 'context a', 'key 0x01_a');
    await profile.addContactKey(accounts[1], 'context a', 'key 0x02_a');
    await profile.addContactKey(accounts[1], 'context b', 'key 0x02_b');

    expect(await profile.getContactKey(accounts[0], 'context a')).to.eq('key 0x01_a');
    expect(await profile.getContactKey(accounts[1], 'context a')).to.eq('key 0x02_a');
    expect(await profile.getContactKey(accounts[1], 'context b')).to.eq('key 0x02_b');
    expect(await profile.getContactKey(accounts[2], 'context a')).to.be.undefined;
  });

  it('should be able to be add dapp bookmarks', async () => {
    let profile = new Profile({
      nameResolver,
      defaultCryptoAlgo: 'aes',
      dataContract,
      contractLoader,
      ipld,
      executor,
      accountId: accounts[0],
      rightsAndRoles,
    });
    await profile.addDappBookmark('sample1.test', sampleDesc);

    expect(await profile.getDappBookmark('sample1.test')).to.be.ok;
    expect((await profile.getDappBookmark('sample1.test')).title)
      .to.eq('sampleTest');

    // adding on existing
    await profile.addDappBookmark('sample1.test', sampleUpdateDesc);
    expect((await profile.getDappBookmark('sample1.test')).title)
      .to.eq('sampleUpdateTest');
  });

  it('should be able to store templates', async () => {
    let profile = new Profile({
      nameResolver,
      defaultCryptoAlgo: 'aes',
      dataContract,
      contractLoader,
      ipld,
      executor,
      accountId: accounts[0],
      rightsAndRoles,
    });
    const templates = {
      templates: 'can',
      have: {
        any: 'format'
      },
      depending: ['on', 'your', 'needs'],
    };
    await profile.loadForAccount(profile.treeLabels.templates);
    await profile.setTemplates(templates);
    expect(await profile.getTemplates()).to.eq(templates);

    await profile.storeForAccount(profile.treeLabels.templates);
    profile = new Profile({
      nameResolver,
      defaultCryptoAlgo: 'aes',
      dataContract,
      contractLoader,
      ipld,
      executor,
      accountId: accounts[0],
      rightsAndRoles,
    });
    await profile.loadForAccount(profile.treeLabels.templates);
    expect(await profile.getTemplates()).to.deep.eq(templates);
  });

  it('should be able to save an encrypted profile to IPLD', async () => {
    let profile = new Profile({
      nameResolver,
      defaultCryptoAlgo: 'aes',
      dataContract,
      contractLoader,
      ipld,
      executor,
      accountId: accounts[0],
      rightsAndRoles,
    });
    await profile.addContactKey(accounts[0], 'context a', 'key 0x01_a');
    await profile.addContactKey(accounts[1], 'context a', 'key 0x02_a');
    await profile.addContactKey(accounts[1], 'context b', 'key 0x02_b');
    await profile.addDappBookmark('sample1.test', sampleDesc);

    // store as ipldIpfsHash
    const ipldIpfsHash = await profile.storeToIpld(profile.treeLabels.addressBook);
    expect(ipldIpfsHash).not.to.be.undefined;

    // load it to new profile instance
    const loadedProfile = new Profile({
      nameResolver,
      defaultCryptoAlgo: 'aes',
      dataContract,
      contractLoader,
      ipld,
      executor,
      accountId: accounts[0],
      rightsAndRoles,
    });
    await loadedProfile.loadFromIpld(profile.treeLabels.addressBook, ipldIpfsHash);

    // test contacts
    expect(await loadedProfile.getContactKey(accounts[0], 'context a')).to.eq('key 0x01_a');
    expect(await loadedProfile.getContactKey(accounts[1], 'context a')).to.eq('key 0x02_a');
    expect(await loadedProfile.getContactKey(accounts[1], 'context b')).to.eq('key 0x02_b');
    expect(await loadedProfile.getContactKey(accounts[2], 'context a')).to.be.undefined;

    // test bookmarks
    expect(await profile.getDappBookmark('sample1.test')).to.be.ok;
    expect((await profile.getDappBookmark('sample1.test')).title).to.eq('sampleTest');

    // adding on existing
    await profile.addDappBookmark('sample1.test', sampleUpdateDesc);
    expect((await profile.getDappBookmark('sample1.test')).title).to.eq('sampleUpdateTest');
  });

  it('should be able to set and load a value for a given users profile contract from the blockchain', async () => {
    const nameResolver = await TestUtils.getNameResolver(web3);
    const address = await nameResolver.getAddress(ensName);
    const contract = nameResolver.contractLoader.loadContract('ProfileIndexInterface', address);
    const label = await nameResolver.sha3('profiles');
    const valueToSet = '0x0000000000000000000000000000000000000004';
    let hash;
    const from = Object.keys(accountMap)[0];
    hash = await nameResolver.executor.executeContractCall(contract, 'getProfile', from, { from, });
    const internalSigner = nameResolver.executor.signer as SignerInternal;
    await nameResolver.executor.executeContractTransaction(
      contract,
      'setMyProfile',
      { from, autoGas: 1.1, },
      valueToSet,
    );
    hash = await nameResolver.executor.executeContractCall(contract, 'getProfile', from, { from, });
    expect(hash).to.eq(valueToSet);
  });

  it('should be able to set and load a profile for a given user from the blockchain shorthand', async () => {
    // create profile
    const profile = new Profile({
      nameResolver,
      defaultCryptoAlgo: 'aes',
      dataContract,
      contractLoader,
      ipld,
      executor,
      accountId: accounts[0],
      rightsAndRoles,
    });
    await profile.createProfile(keyExchange.getDiffieHellmanKeys());
    await profile.addContactKey(accounts[0], 'context a', 'key 0x01_a');
    await profile.addContactKey(accounts[1], 'context a', 'key 0x02_a');
    await profile.addContactKey(accounts[1], 'context b', 'key 0x02_b');
    await profile.addDappBookmark('sample1.test', sampleDesc);

    // store
    const from = Object.keys(accountMap)[0];
    await profile.storeForAccount(profile.treeLabels.addressBook);

    // load
    const newProfile = new Profile({
      nameResolver,
      defaultCryptoAlgo: 'aes',
      dataContract,
      contractLoader,
      ipld,
      executor,
      accountId: accounts[0],
      rightsAndRoles,
    });

    // test contacts
    expect(await newProfile.getContactKey(accounts[0], 'context a')).to.eq('key 0x01_a');
    expect(await newProfile.getContactKey(accounts[1], 'context a')).to.eq('key 0x02_a');
    expect(await newProfile.getContactKey(accounts[1], 'context b')).to.eq('key 0x02_b');
    expect(await newProfile.getContactKey(accounts[2], 'context a')).to.be.undefined;
    // test bookmarks
    expect(await profile.getDappBookmark('sample1.test')).to.be.ok;
    expect((await profile.getDappBookmark('sample1.test')).title).to.eq('sampleTest');
  });

  it('allow to check if a profile exists', async () => {
    let profile = new Profile({
      nameResolver,
      defaultCryptoAlgo: 'aes',
      dataContract,
      contractLoader,
      ipld,
      executor,
      accountId: '0xbbF5029Fd710d227630c8b7d338051B8E76d50B3',
      rightsAndRoles,
    });
    expect(await profile.exists()).to.be.false;

    profile = new Profile({
      nameResolver,
      defaultCryptoAlgo: 'aes',
      dataContract,
      contractLoader,
      ipld,
      executor,
      accountId: accounts[0],
      rightsAndRoles,
    });
    expect(await profile.exists()).to.be.true;
  });

  it('should remove a bookmark from a given profile', async () => {
    let profile = new Profile({
      nameResolver,
      defaultCryptoAlgo: 'aes',
      dataContract,
      contractLoader,
      ipld,
      executor,
      accountId: accounts[0],
      rightsAndRoles,
    });
    await profile.addDappBookmark('sample1.test', sampleDesc);
    await profile.addDappBookmark('sample2.test', sampleDesc);

    expect(await profile.getDappBookmark('sample1.test')).to.be.ok;
    expect(await profile.getDappBookmark('sample2.test')).to.be.ok;

    await profile.removeDappBookmark('sample1.test');
    expect(await profile.getDappBookmark('sample1.test')).not.to.be.ok;
    expect(await profile.getDappBookmark('sample2.test')).to.be.ok;
  });

  it('should create a new Profile', async () => {
    // create new profile helper instance
    const from = Object.keys(accountMap)[0];
    ipld.originator = nameResolver.soliditySha3(from);
    let profile = new Profile({
      nameResolver,
      defaultCryptoAlgo: 'aes',
      dataContract,
      contractLoader,
      ipld,
      executor,
      accountId: accounts[0],
      rightsAndRoles,
    });

    // create new profile, set private key and keyexchange partial key
    await profile.createProfile(keyExchange.getDiffieHellmanKeys());

    // add a bookmark
    await profile.addDappBookmark('sample1.test', sampleDesc);

    // store tree to contract
    await profile.storeForAccount(profile.treeLabels.bookmarkedDapps);

    // load
    const newProfile = new Profile({
      nameResolver,
      defaultCryptoAlgo: 'aes',
      dataContract,
      contractLoader,
      ipld,
      executor,
      accountId: accounts[0],
      rightsAndRoles,
    });
    // test contacts
    expect(await profile.getDappBookmark('sample1.test')).to.deep.eq(sampleDesc);
  });

  it('should read a public part of a profile (e.g. public key)', async () => {
    let profile = new Profile({
      nameResolver,
      defaultCryptoAlgo: 'aes',
      dataContract,
      contractLoader,
      ipld,
      executor,
      accountId: accounts[0],
      rightsAndRoles,
    });

    const mailbox = new Mailbox({
      mailboxOwner: accounts[0],
      nameResolver: await TestUtils.getNameResolver(web3),
      ipfs: ipld.ipfs,
      contractLoader: await TestUtils.getContractLoader(web3),
      cryptoProvider:  TestUtils.getCryptoProvider(),
      keyProvider:  TestUtils.getKeyProvider(),
      defaultCryptoAlgo: 'aes',
    });
    const keyExchangeOptions = {
      mailbox: mailbox,
      cryptoProvider:  TestUtils.getCryptoProvider(),
      defaultCryptoAlgo: 'aes',
      account: accounts[0],
      keyProvider: TestUtils.getKeyProvider(),
    };
    const keyExchange = new KeyExchange(keyExchangeOptions);

    // store
    const from = Object.keys(accountMap)[0];

    await profile.createProfile(keyExchange.getDiffieHellmanKeys());

    // simulate a different account with a different keyStore
    const originalKeyStore = ipld.keyProvider;
    const modifiedKeyStore = TestUtils.getKeyProvider(['mailboxKeyExchange']);
    ipld.keyProvider = modifiedKeyStore;
    // load
    const newProfile = new Profile({
      nameResolver,
      defaultCryptoAlgo: 'aes',
      dataContract,
      contractLoader,
      ipld,
      executor,
      accountId: accounts[0],
      rightsAndRoles,
    });

    const pubKey = await newProfile.getPublicKey();
    expect(pubKey).to.be.ok;

    const bookmarks = await newProfile.getBookmarkDefinitions();
    expect(bookmarks).to.deep.eq({});

    // set original key provider back
    ipld.keyProvider = originalKeyStore;
  });

  it('should be able to set a contact as known', async () => {
    let profile = new Profile({
      nameResolver,
      defaultCryptoAlgo: 'aes',
      dataContract,
      contractLoader,
      ipld,
      executor,
      accountId: accounts[0],
      rightsAndRoles,
    });

    await profile.createProfile(keyExchange.getDiffieHellmanKeys());

    await profile.loadForAccount();
    expect(await profile.getContactKnownState(accounts[1])).to.be.false;
    await profile.setContactKnownState(accounts[1], true);
    expect(await profile.getContactKnownState(accounts[1])).to.be.true;
  });

  it('should be able to set a contact as unknown', async () => {
    let profile = new Profile({
      nameResolver,
      defaultCryptoAlgo: 'aes',
      dataContract,
      contractLoader,
      ipld,
      executor,
      accountId: accounts[0],
      rightsAndRoles,
    });

    await profile.createProfile(keyExchange.getDiffieHellmanKeys());

    await profile.loadForAccount();
    expect(await profile.getContactKnownState(accounts[1])).to.be.false;
    await profile.setContactKnownState(accounts[1], true);
    expect(await profile.getContactKnownState(accounts[1])).to.be.true;
    await profile.setContactKnownState(accounts[1], false);
    expect(await profile.getContactKnownState(accounts[1])).to.be.false;
  });

  it('should allow to create profile profile and propfile data with separate accounts', async () => {
    const [ profileReceiver, profileCreator, profileTestUser, ] = accounts;
    const getKeyIpld = async (accountId) => {
      const defaultKeys = TestUtils.getKeys();
      const keys = {};
      const dataKeyKeys = [
        nameResolver.soliditySha3('mailboxKeyExchange'),
        nameResolver.soliditySha3(accountId),
        nameResolver.soliditySha3(
          nameResolver.soliditySha3(accountId), nameResolver.soliditySha3(accountId)),
      ];
      dataKeyKeys.forEach((key) => { keys[key] = defaultKeys[key]; });
      const keyProvider = new KeyProvider({ keys, });
      const accountIpld = await TestUtils.getIpld(ipfs, keyProvider);
      accountIpld.originator = nameResolver.soliditySha3(accountId);
      return accountIpld;
    };
    // separate profiles (with separate key providers for ipld)
    const profile1 = new Profile({
      nameResolver,
      defaultCryptoAlgo: 'aes',
      dataContract,
      contractLoader,
      ipld: await getKeyIpld(profileReceiver),
      executor,
      accountId: profileReceiver,
      rightsAndRoles,
    });

    // create profile data with profileReceiver (profileReceiver is the account, that will own the profile)
    const dhKeys = keyExchange.getDiffieHellmanKeys();
    await profile1.addContactKey(profileReceiver, 'dataKey', dhKeys.privateKey.toString('hex'));
    await profile1.addProfileKey(profileReceiver, 'alias', 'sample user 1');
    await profile1.addPublicKey(dhKeys.publicKey.toString('hex'));
    const sharing = await dataContract.createSharing(profileReceiver);
    const fileHashes = <any>{};
    fileHashes[profile1.treeLabels.addressBook] = await profile1.storeToIpld(profile1.treeLabels.addressBook);
    fileHashes[profile1.treeLabels.publicKey] = await profile1.storeToIpld(profile1.treeLabels.publicKey);
    fileHashes.sharingsHash = sharing.sharingsHash;
    const cryptor = cryptoProvider.getCryptorByCryptoAlgo('aesEcb');
    fileHashes[profile1.treeLabels.addressBook] = await cryptor.encrypt(
      Buffer.from(fileHashes[profile1.treeLabels.addressBook].substr(2), 'hex'),
      { key: sharing.hashKey, }
    );
    fileHashes[profile1.treeLabels.addressBook] = `0x${fileHashes[profile1.treeLabels.addressBook].toString('hex')}`;

    // store it with profileCreator
    const factoryDomain = nameResolver.getDomainName(nameResolver.config.domains.profileFactory);
    const profileContract = await dataContract.create(
      factoryDomain,
      profileCreator,
      null,
      '0x0000000000000000000000000000000000000000000000000000000000000000',
      true,
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    );
    await dataContract.setEntry(
      profileContract,
      profile1.treeLabels.publicKey,
      fileHashes[profile1.treeLabels.publicKey],
      profileCreator,
      false,
      false,
    );
    await dataContract.setEntry(
      profileContract,
      profile1.treeLabels.addressBook,
      fileHashes[profile1.treeLabels.addressBook],
      profileCreator,
      false,
      false,
    );
    await executor.executeContractTransaction(
      profileContract,
      'setSharing',
      { from: profileCreator, autoGas: 1.1, },
      fileHashes.sharingsHash,
    );

    // profileCreator hands contract over to profileReceiver
    await dataContract.inviteToContract(null, profileContract.options.address, profileCreator, profileReceiver);
    // grand admin role
    await rightsAndRoles.addAccountToRole(profileContract, profileCreator, profileReceiver, 0);
    // cancel own member role
    await rightsAndRoles.removeAccountFromRole(profileContract, profileCreator, profileCreator, 1);
    // cancel own admin role
    await rightsAndRoles.removeAccountFromRole(profileContract, profileCreator, profileCreator, 0);
    // transfer ownership
    await rightsAndRoles.transferOwnership(profileContract, profileCreator, profileReceiver);


    // user profile with account 1
    // stores profile (atm still done as receiver, as this is msg.sender relative)
    const profileIndexDomain = nameResolver.getDomainName(nameResolver.config.domains.profile);
    const address = await nameResolver.getAddress(profileIndexDomain);
    const contract = nameResolver.contractLoader.loadContract('ProfileIndexInterface', address);
    await executor.executeContractTransaction(
         contract, 'setMyProfile', { from: profileReceiver, autoGas: 1.1, }, profileContract.options.address);
    // can read own keys
    const profile2 = new Profile({
      nameResolver,
      defaultCryptoAlgo: 'aes',
      dataContract,
      contractLoader,
      ipld: await getKeyIpld(profileReceiver),
      executor,
      accountId: profileReceiver,
      rightsAndRoles,
    });

    // can read public key
    await profile2.loadForAccount(profile2.treeLabels.publicKey);
    expect(await profile2.getPublicKey()).to.eq(dhKeys.publicKey.toString('hex'));

    // can read private key and alias (==> has access to data)
    await profile2.loadForAccount(profile2.treeLabels.addressBook);
    expect(await profile2.getContactKey(profileReceiver, 'dataKey')).to.eq(dhKeys.privateKey.toString('hex'));
    expect(await profile2.getProfileKey(profileReceiver, 'alias')).to.eq('sample user 1');

    // could transfer it to another user (==> has smart contract permissions)
    // profileCreator hands contract over to profileReceiver
    await dataContract.inviteToContract(null, profileContract.options.address, profileReceiver, profileTestUser);
    // grand admin role
    await rightsAndRoles.addAccountToRole(profileContract, profileReceiver, profileTestUser, 0);
    // // cancel own member role
    await rightsAndRoles.removeAccountFromRole(profileContract, profileReceiver, profileReceiver, 1);
    // cancel own admin role
    await rightsAndRoles.removeAccountFromRole(profileContract, profileReceiver, profileReceiver, 0);
    // transfer ownership
    await rightsAndRoles.transferOwnership(profileContract, profileReceiver, profileTestUser);
  });
});
