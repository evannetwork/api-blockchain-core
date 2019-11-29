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

import 'mocha';
import { expect, use } from 'chai';
import { isEqual } from 'lodash';
import chaiAsPromised = require('chai-as-promised');

import {
  ContractLoader,
  KeyProvider,
  NameResolver,
  SignerInternal,
} from '@evan.network/dbcp';

import { accountMap } from '../test/accounts';
import { accounts } from '../test/accounts';
import { configTestcore as config } from '../config-testcore';
import { createDefaultRuntime } from '../runtime';
import { DataContract } from '../contracts/data-contract/data-contract';
import { KeyExchange } from '../keyExchange';
import { Mailbox } from '../mailbox';
import { Onboarding } from '../onboarding';
import { RightsAndRoles } from '../contracts/rights-and-roles';
import { TestUtils } from '../test/test-utils';

use(chaiAsPromised);

describe('Profile helper', function() {
  this.timeout(600000);
  let ipfs;
  let ipld;
  let nameResolver: NameResolver;
  let ensName;
  let web3;
  let dataContract: DataContract;
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

  before(async () => {
    web3 = TestUtils.getWeb3();
    ipfs = await TestUtils.getIpfs();
    ipld = await TestUtils.getIpld(ipfs);
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
    let profile = await TestUtils.getProfile(web3, ipfs, ipld, accounts[0]);
    await profile.addContactKey(accounts[0], 'context a', 'key 0x01_a');
    await profile.addContactKey(accounts[1], 'context a', 'key 0x02_a');
    await profile.addContactKey(accounts[1], 'context b', 'key 0x02_b');

    expect(await profile.getContactKey(accounts[0], 'context a')).to.eq('key 0x01_a');
    expect(await profile.getContactKey(accounts[1], 'context a')).to.eq('key 0x02_a');
    expect(await profile.getContactKey(accounts[1], 'context b')).to.eq('key 0x02_b');
    expect(await profile.getContactKey(accounts[2], 'context a')).to.be.undefined;
  });

  it('should be able to be add dapp bookmarks', async () => {
    let profile = await TestUtils.getProfile(web3, ipfs, ipld, accounts[0]);
    await profile.addDappBookmark('sample1.test', sampleDesc);

    expect(await profile.getDappBookmark('sample1.test')).to.be.ok;
    expect((await profile.getDappBookmark('sample1.test')).title)
      .to.eq('sampleTest');

    // adding on existing
    await profile.addDappBookmark('sample1.test', sampleUpdateDesc);
    expect((await profile.getDappBookmark('sample1.test')).title)
      .to.eq('sampleUpdateTest');
  });

  it('should be able to store data container plugins', async () => {
    let profile = await TestUtils.getProfile(web3, ipfs, ipld, accounts[0]);
    const templates = {
      templates: 'can',
      have: {
        any: 'format'
      },
      depending: ['on', 'your', 'needs'],
    };
    await profile.loadForAccount(profile.treeLabels.dtContainerPlugins);
    await profile.setPlugins(templates);
    expect(await profile.getPlugins()).to.eq(templates);

    await profile.storeForAccount(profile.treeLabels.dtContainerPlugins);
    profile = await TestUtils.getProfile(web3, ipfs, ipld, accounts[0]);
    await profile.loadForAccount(profile.treeLabels.dtContainerPlugins);
    expect(await profile.getPlugins()).to.deep.eq(templates);
  });

  it('should be able to save an encrypted profile to IPLD', async () => {
    let profile = await TestUtils.getProfile(web3, ipfs, ipld, accounts[0]);
    await profile.addContactKey(accounts[0], 'context a', 'key 0x01_a');
    await profile.addContactKey(accounts[1], 'context a', 'key 0x02_a');
    await profile.addContactKey(accounts[1], 'context b', 'key 0x02_b');
    await profile.addDappBookmark('sample1.test', sampleDesc);

    // store as ipldIpfsHash
    const ipldIpfsHash = await profile.storeToIpld(profile.treeLabels.addressBook);
    expect(ipldIpfsHash).not.to.be.undefined;

    // load it to new profile instance
    const loadedProfile = await TestUtils.getProfile(web3, ipfs, ipld, accounts[0]);
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
    const address = await nameResolver.getAddress(ensName);
    const contract = nameResolver.contractLoader.loadContract('ProfileIndexInterface', address);
    const valueToSet = '0x0000000000000000000000000000000000000004';
    let hash;
    const from = Object.keys(accountMap)[0];
    hash = await nameResolver.executor.executeContractCall(contract, 'getProfile', from, { from, });
    await nameResolver.executor.executeContractTransaction(
      contract,
      'setMyProfile',
      { from, autoGas: 1.1, },
      valueToSet,
    );
    const newHash = await nameResolver.executor.executeContractCall(contract, 'getProfile', from, { from, });
    expect(newHash).to.eq(valueToSet);
    await nameResolver.executor.executeContractTransaction(
      contract,
      'setMyProfile',
      { from, autoGas: 1.1, },
      hash,
    );
  });

  it('should be able to set and load a profile for a given user from the blockchain shorthand', async () => {
    // create profile
    const initRuntime = await TestUtils.getRuntime(accounts[0]);
    initRuntime.profile = await TestUtils.getProfile(web3, ipfs, ipld, accounts[0]);
    await Onboarding.createProfile(initRuntime, {
      accountDetails: {
        profileType: 'company',
        accountName: 'test account'
      }
    })
    let profile = await TestUtils.getProfile(web3, ipfs, ipld, accounts[0]);
    await profile.loadForAccount();
    await profile.addContactKey(accounts[0], 'context a', 'key 0x01_a');
    await profile.addContactKey(accounts[1], 'context a', 'key 0x02_a');
    await profile.addContactKey(accounts[1], 'context b', 'key 0x02_b');
    await profile.addDappBookmark('sample1.test', sampleDesc);

    console.log('store')
    // store
    await profile.storeForAccount(profile.treeLabels.addressBook);

    // load
    const newProfile = await TestUtils.getProfile(web3, ipfs, ipld, accounts[0]);

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
    let profile = await TestUtils.getProfile(web3, ipfs, ipld, '0x000000000000000000000000000000000000beef');
    expect(await profile.exists()).to.be.false;

    profile = await TestUtils.getProfile(web3, ipfs, ipld, accounts[0]);
    expect(await profile.exists()).to.be.true;
  });

  it('should remove a bookmark from a given profile', async () => {
    let profile = await TestUtils.getProfile(web3, ipfs, ipld, accounts[0]);
    await profile.addDappBookmark('sample1.test', sampleDesc);
    await profile.addDappBookmark('sample2.test', sampleDesc);

    expect(await profile.getDappBookmark('sample1.test')).to.be.ok;
    expect(await profile.getDappBookmark('sample2.test')).to.be.ok;

    await profile.removeDappBookmark('sample1.test');
    expect(await profile.getDappBookmark('sample1.test')).not.to.be.ok;
    expect(await profile.getDappBookmark('sample2.test')).to.be.ok;
  });

  it('should read a public part of a profile (e.g. public key)', async () => {
    let profile = await TestUtils.getProfile(web3, ipfs, ipld, accounts[0]);

    const customMailbopx = new Mailbox({
      mailboxOwner: accounts[0],
      nameResolver: await TestUtils.getNameResolver(web3),
      ipfs: ipld.ipfs,
      contractLoader: await TestUtils.getContractLoader(web3),
      cryptoProvider:  TestUtils.getCryptoProvider(),
      keyProvider:  TestUtils.getKeyProvider(),
      defaultCryptoAlgo: 'aes',
    });
    const keyExchangeOptions = {
      mailbox: customMailbopx,
      cryptoProvider:  TestUtils.getCryptoProvider(),
      defaultCryptoAlgo: 'aes',
      account: accounts[0],
      keyProvider: TestUtils.getKeyProvider(),
    };
    const customKeyExchange = new KeyExchange(keyExchangeOptions);

    const initRuntime = await TestUtils.getRuntime(accounts[0]);
    initRuntime.profile = await TestUtils.getProfile(web3, ipfs, ipld, accounts[0]);
    await Onboarding.createProfile(initRuntime, {
      accountDetails: {
        profileType: 'company',
        accountName: 'test account'
      }
    })

    // simulate a different account with a different keyStore
    const originalKeyStore = ipld.keyProvider;
    const modifiedKeyStore = TestUtils.getKeyProvider(['mailboxKeyExchange']);
    ipld.keyProvider = modifiedKeyStore;
    // load
    const newProfile = await TestUtils.getProfile(web3, ipfs, ipld, accounts[0]);

    const pubKey = await newProfile.getPublicKey();
    expect(pubKey).to.be.ok;

    const bookmarks = await newProfile.getBookmarkDefinitions();
    expect(bookmarks).to.deep.eq({});

    // set original key provider back
    ipld.keyProvider = originalKeyStore;
  });

  it.skip('should be able to set a contact as known', async () => {

    const initRuntime = await TestUtils.getRuntime(accounts[0]);
    let profile = await TestUtils.getProfile(web3, ipfs, ipld, accounts[0]);
    await Onboarding.createProfile(initRuntime, {
      accountDetails: {
        profileType: 'company',
        accountName: 'test account'
      }
    })

    await profile.loadForAccount();
    expect(await profile.getContactKnownState(accounts[1])).to.be.false;
    await profile.setContactKnownState(accounts[1], true);
    expect(await profile.getContactKnownState(accounts[1])).to.be.true;
  });

  it.skip('should be able to set a contact as unknown', async () => {
    const initRuntime = await TestUtils.getRuntime(accounts[0]);
    let profile = await TestUtils.getProfile(web3, ipfs, ipld, accounts[0]);
    await Onboarding.createProfile(initRuntime, {
      accountDetails: {
        profileType: 'company',
        accountName: 'test account'
      }
    })

    await profile.loadForAccount();
    expect(await profile.getContactKnownState(accounts[1])).to.be.false;
    await profile.setContactKnownState(accounts[1], true);
    expect(await profile.getContactKnownState(accounts[1])).to.be.true;
    await profile.setContactKnownState(accounts[1], false);
    expect(await profile.getContactKnownState(accounts[1])).to.be.false;
  });

  describe('Handle data contract entries in profile', () => {
    const mnemonics = {
      company: 'place connect elite pigeon toilet song suggest primary endless science lizard tomato',
      device: 'cement fatal hybrid wing always amateur top good maximum snake screen first',
    };

    const dateString = Date.now().toString();
    const companyProfileProperties = {
      registration: {
        court: `trst ${ dateString }`,
        register: 'hra',
        registerNumber: `qwer ${ dateString }`,
        salesTaxID: `qw ${ dateString }`,
      },
      contact: {
        country: 'DE',
        city: `City ${ dateString }`,
        postalCode: '12345',
        streetAndNumber: `Street ${ dateString }`,
        website: 'https://evan.network'
      }
    };
    const deviceProfileProperties = {
      deviceDetails: {
        dataStreamSettings: `dataStreamSettings ${ dateString }`,
        location: `location ${ dateString }`,
        manufacturer: `manufacturer ${ dateString }`,
        owner: '0xcA4f9fF9e32a768BC68399B9F46d8A884089997d',
        serialNumber: `serialNumber ${ dateString }`,
        settings: { files: [] },
        type: { files: [] }
      }
    };

    /**
     * Return the runtime for a test mnemonic.
     *
     * @param      {string}  mnemonic  mnemonic to create the runtime with
     * @param      {string}  password  password to create the runtime with
     */
    async function getProfileRuntime(mnemonic: string, password = 'Test1234') {
      return createDefaultRuntime(
        await TestUtils.getWeb3(),
        await TestUtils.getIpfs(),
        { mnemonic, password, }
      );
    }

    it('can transform user profile to company profile', async () => {
      const newMnemonic = Onboarding.createMnemonic();
      const initRuntime = await TestUtils.getRuntime(accounts[0]);

      await Onboarding.createNewProfile(initRuntime, newMnemonic, 'Test1234', {
        accountDetails: {
          profileType: 'user',
          accountName: 'test account',
        }
      });
      const runtime = await getProfileRuntime(newMnemonic);

      await runtime.profile.setProfileProperties({
        accountDetails: {
          accountName: 'New company',
          profileType: 'company',
        }
      });
      const accountDetails = await runtime.profile.getProfileProperty('accountDetails');
      await expect(accountDetails.accountName).to.be.eq('New company');
    });

    it('cannot transform specified profile to another profile type', async () => {
      const newMnemonic = Onboarding.createMnemonic();
      const initRuntime = await TestUtils.getRuntime(accounts[0]);

      await Onboarding.createNewProfile(initRuntime, newMnemonic, 'Test1234', {
        accountDetails: {
          profileType: 'user',
          accountName: 'test account',
        }
      });
      const runtime = await getProfileRuntime(newMnemonic);

      await runtime.profile.setProfileProperties({
        accountDetails: {
          accountName: 'New company',
          profileType: 'company',
        }
      });
      const accountDetails = await runtime.profile.getProfileProperty('accountDetails');
      await expect(accountDetails.accountName).to.be.eq('New company');

      const promise = runtime.profile.setProfileProperties({
        accountDetails: {
          accountName: 'Now it\'s a device',
          profileType: 'device',
        }
      });

      await expect(promise).to.be.rejected;
    });

    it('can transform user profile to device profile', async () => {
      const newMnemonic = Onboarding.createMnemonic();
      const initRuntime = await TestUtils.getRuntime(accounts[0]);

      await Onboarding.createNewProfile(initRuntime, newMnemonic, 'Test1234', {
        accountDetails: {
          profileType: 'user',
          accountName: 'test account',
        }
      });
      const runtime = await getProfileRuntime(newMnemonic);

      await runtime.profile.setProfileProperties({
        accountDetails: {
          accountName: 'New device',
          profileType: 'device',
        }
      });
      const accountDetails = await runtime.profile.getProfileProperty('accountDetails');
      await expect(accountDetails.accountName).to.be.eq('New device');
    });

    it('can transform user profile to type that does not exists', async () => {
      const newMnemonic = Onboarding.createMnemonic();
      const initRuntime = await TestUtils.getRuntime(accounts[0]);

      await Onboarding.createNewProfile(initRuntime, newMnemonic, 'Test1234', {
        accountDetails: {
          profileType: 'user',
          accountName: 'test account',
        }
      });
      const runtime = await getProfileRuntime(newMnemonic);

      const promise = runtime.profile.setProfileProperties({
        accountDetails: {
          accountName: 'custom profile',
          profileType: 'my own type',
        }
      });

      await expect(promise).to.be.rejected;
    });

    it('can save company profile specific properties to a profile of type company', async () => {
      const runtime = await getProfileRuntime(mnemonics.company);
      await runtime.profile.setProfileProperties(companyProfileProperties);
      const [accountDetails, contact, registration] =
        await Promise.all(['accountDetails', 'contact', 'registration'].map(
          p => runtime.profile.getProfileProperty(p)));
      await expect(accountDetails.profileType).to.be.eq('company');
      await expect(isEqual(companyProfileProperties.registration, registration)).to.be.true;
      await expect(isEqual(companyProfileProperties.contact, contact)).to.be.true;
    });

    it('cannot save device profile specific properties into company profile', async () => {
      const runtime = await getProfileRuntime(mnemonics.company);
      const promise = runtime.profile.setProfileProperties(deviceProfileProperties);
      await expect(promise).to.be.rejected;
    });

    it('can save device profile specific properties to a profile of type device', async () => {
      const runtime = await getProfileRuntime(mnemonics.device);
      await runtime.profile.setProfileProperties(deviceProfileProperties);
      const [accountDetails, deviceDetails] =
        await Promise.all(['accountDetails', 'deviceDetails'].map(
          p => runtime.profile.getProfileProperty(p)));
      await expect(accountDetails.profileType).to.be.eq('device');
      await expect(isEqual(deviceProfileProperties.deviceDetails, deviceDetails)).to.be.true;
    });

    it('cannot save company profile specific properties into device profile', async () => {
      const runtime = await getProfileRuntime(mnemonics.device);
      const promise = runtime.profile.setProfileProperties(companyProfileProperties);
      await expect(promise).to.be.rejected;
    });
  });
});
