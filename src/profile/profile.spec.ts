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
import * as chaiAsPromised from 'chai-as-promised';

import {
  NameResolver,
} from '@evan.network/dbcp';

import {
  accounts, identities, useIdentity,
} from '../test/accounts';

import { configTestcore as config } from '../config-testcore';
import { Runtime, createDefaultRuntime } from '../runtime';
import { Onboarding } from '../onboarding';
import { Profile } from './profile';
import { TestUtils } from '../test/test-utils';

use(chaiAsPromised);
describe('Profile helper', function test() {
  this.timeout(600000);
  let ensName;
  let nameResolver: NameResolver;
  let profile: Profile;
  let runtime: Runtime;
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
    runtime = await TestUtils.getRuntime(accounts[1], null, { useIdentity });
    ({ nameResolver, profile } = runtime);
    ensName = nameResolver.getDomainName(config.nameResolver.domains.profile);
  });

  it('should be able to be add contact keys', async () => {
    await profile.addContactKey(identities[0], 'context a', 'key 0x01_a');
    await profile.addContactKey(identities[1], 'context a', 'key 0x02_a');
    await profile.addContactKey(identities[1], 'context b', 'key 0x02_b');

    expect(await profile.getContactKey(identities[0], 'context a')).to.eq('key 0x01_a');
    expect(await profile.getContactKey(identities[1], 'context a')).to.eq('key 0x02_a');
    expect(await profile.getContactKey(identities[1], 'context b')).to.eq('key 0x02_b');
    expect(await profile.getContactKey(identities[2], 'context a')).to.be.undefined;
  });

  it('should be able to be add identity key', async () => {
    await profile.loadForAccount(profile.treeLabels.addressBook);
    await profile.setIdentityAccess(identities[0], 'key 0x01_a');
    const list = await profile.getIdentityAccessList();
    expect(list).to.be.not.empty;

    await profile.storeForAccount(profile.treeLabels.addressBook);
    await profile.loadForAccount(profile.treeLabels.addressBook);
    const loadedList = await profile.getIdentityAccessList();
    expect(loadedList).to.be.deep.eq(list);
  });

  it('should remove an identity key', async () => {
    await profile.loadForAccount(profile.treeLabels.addressBook);
    await profile.setIdentityAccess(identities[1], 'key 0x01_b');
    await profile.storeForAccount(profile.treeLabels.addressBook);
    await profile.loadForAccount(profile.treeLabels.addressBook);

    const beforeSettingList = await profile.getIdentityAccessList();
    expect(beforeSettingList[identities[1]]).to.be.eq('key 0x01_b');

    await profile.removeIdentityAccess(identities[1]);
    await profile.storeForAccount(profile.treeLabels.addressBook);
    await profile.loadForAccount(profile.treeLabels.addressBook);
    const afterRemovingList = await profile.getIdentityAccessList();
    expect(afterRemovingList).to.not.include(identities[1]);
  });

  it('should remove an identity', async () => {
    await profile.addDappBookmark('sample1.test', sampleDesc);
    await profile.addDappBookmark('sample2.test', sampleDesc);

    expect(await profile.getDappBookmark('sample1.test')).to.be.ok;
    expect(await profile.getDappBookmark('sample2.test')).to.be.ok;

    await profile.removeDappBookmark('sample1.test');
    expect(await profile.getDappBookmark('sample1.test')).not.to.be.ok;
    expect(await profile.getDappBookmark('sample2.test')).to.be.ok;
  });

  it('should be able to store data container plugins', async () => {
    const templates = {
      templates: 'can',
      have: {
        any: 'format',
      },
      depending: ['on', 'your', 'needs'],
    };
    await profile.loadForAccount(profile.treeLabels.dtContainerPlugins);
    await profile.setPlugins(templates);
    expect(await profile.getPlugins()).to.eq(templates);

    await profile.storeForAccount(profile.treeLabels.dtContainerPlugins);
    await profile.loadForAccount(profile.treeLabels.dtContainerPlugins);
    expect(await profile.getPlugins()).to.deep.eq(templates);
  });

  it('should be able to save an encrypted profile to IPLD', async () => {
    await profile.addContactKey(identities[0], 'context a', 'key 0x01_a');
    await profile.addContactKey(identities[1], 'context a', 'key 0x02_a');
    await profile.addContactKey(identities[1], 'context b', 'key 0x02_b');
    await profile.addDappBookmark('sample1.test', sampleDesc);

    // store as ipldIpfsHash
    const ipldIpfsHash = await profile.storeToIpld(profile.treeLabels.addressBook);
    expect(ipldIpfsHash).not.to.be.undefined;

    // load it to new profile instance
    const loadedProfile = await TestUtils.getProfile(runtime);
    await loadedProfile.loadFromIpld(profile.treeLabels.addressBook, ipldIpfsHash);

    // test contacts
    expect(await loadedProfile.getContactKey(identities[0], 'context a')).to.eq('key 0x01_a');
    expect(await loadedProfile.getContactKey(identities[1], 'context a')).to.eq('key 0x02_a');
    expect(await loadedProfile.getContactKey(identities[1], 'context b')).to.eq('key 0x02_b');
    expect(await loadedProfile.getContactKey(identities[2], 'context a')).to.be.undefined;

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
    const from = runtime.activeIdentity;
    const hash = await nameResolver.executor.executeContractCall(contract, 'getProfile', from, { from });
    await nameResolver.executor.executeContractTransaction(
      contract,
      'setMyProfile',
      { from, autoGas: 1.1 },
      valueToSet,
    );
    const newHash = await nameResolver.executor.executeContractCall(contract, 'getProfile', from, { from });
    expect(newHash).to.eq(valueToSet);
    await nameResolver.executor.executeContractTransaction(
      contract,
      'setMyProfile',
      { from, autoGas: 1.1 },
      hash,
    );
  });

  it('should be able to set and load a profile for a given user from the blockchain shorthand', async () => {
    // create profile
    await Onboarding.createProfile(runtime, {
      accountDetails: {
        profileType: 'company',
        accountName: 'test account',
      },
    });
    await profile.loadForAccount();
    await profile.addContactKey(identities[0], 'context a', 'key 0x01_a');
    await profile.addContactKey(identities[1], 'context a', 'key 0x02_a');
    await profile.addContactKey(identities[1], 'context b', 'key 0x02_b');
    await profile.addDappBookmark('sample1.test', sampleDesc);

    // store
    await profile.storeForAccount(profile.treeLabels.addressBook);

    // load
    const newProfile = runtime.profile;
    // test contacts
    expect(await newProfile.getContactKey(identities[0], 'context a')).to.eq('key 0x01_a');
    expect(await newProfile.getContactKey(identities[1], 'context a')).to.eq('key 0x02_a');
    expect(await newProfile.getContactKey(identities[1], 'context b')).to.eq('key 0x02_b');
    expect(await newProfile.getContactKey(identities[2], 'context a')).to.be.undefined;
    // test bookmarks
    expect(await profile.getDappBookmark('sample1.test')).to.be.ok;
    expect((await profile.getDappBookmark('sample1.test')).title).to.eq('sampleTest');
  });

  it('allow to check if a profile exists', async () => {
    expect(await profile.exists()).to.be.true;

    const profile2 = await TestUtils.getProfile(
      runtime,
      null,
      null,
      '0x000000000000000000000000000000000000beef',
    );
    expect(await profile2.exists()).to.be.false;
  });

  it('should remove a bookmark from a given profile', async () => {
    await profile.addDappBookmark('sample1.test', sampleDesc);
    await profile.addDappBookmark('sample2.test', sampleDesc);

    expect(await profile.getDappBookmark('sample1.test')).to.be.ok;
    expect(await profile.getDappBookmark('sample2.test')).to.be.ok;

    await profile.removeDappBookmark('sample1.test');
    expect(await profile.getDappBookmark('sample1.test')).not.to.be.ok;
    expect(await profile.getDappBookmark('sample2.test')).to.be.ok;
  });

  it('should read a public part of a profile (e.g. public key)', async () => {
    const initRuntime = await TestUtils.getRuntime(accounts[0], null, { useIdentity });
    await Onboarding.createProfile(initRuntime, {
      accountDetails: {
        profileType: 'company',
        accountName: 'test account',
      },
    });

    // simulate a different account with a different keyStore
    const originalKeyStore = runtime.ipld.keyProvider;
    const modifiedKeyStore = TestUtils.getKeyProvider(['mailboxKeyExchange']);
    runtime.ipld.keyProvider = modifiedKeyStore;
    // load
    const newProfile = await TestUtils.getProfile(runtime);

    const pubKey = await newProfile.getPublicKey();
    expect(pubKey).to.be.ok;

    const bookmarks = await newProfile.getBookmarkDefinitions();
    expect(bookmarks).to.deep.eq({});

    // set original key provider back
    runtime.ipld.keyProvider = originalKeyStore;
  });

  it.skip('should be able to set a contact as known', async () => {
    const initRuntime = await TestUtils.getRuntime(accounts[0], null, { useIdentity });
    await Onboarding.createProfile(initRuntime, {
      accountDetails: {
        profileType: 'company',
        accountName: 'test account',
      },
    });

    await profile.loadForAccount();
    expect(await profile.getContactKnownState(identities[1])).to.be.false;
    await profile.setContactKnownState(identities[1], true);
    expect(await profile.getContactKnownState(identities[1])).to.be.true;
  });

  it.skip('should be able to set a contact as unknown', async () => {
    const initRuntime = await TestUtils.getRuntime(accounts[0], null, { useIdentity });
    await Onboarding.createProfile(initRuntime, {
      accountDetails: {
        profileType: 'company',
        accountName: 'test account',
      },
    });

    await profile.loadForAccount();
    expect(await profile.getContactKnownState(identities[1])).to.be.false;
    await profile.setContactKnownState(identities[1], true);
    expect(await profile.getContactKnownState(identities[1])).to.be.true;
    await profile.setContactKnownState(identities[1], false);
    expect(await profile.getContactKnownState(identities[1])).to.be.false;
  });

  describe('Handle data contract entries in profile', () => {
    const mnemonics = {
      company: useIdentity
        ? 'ocean language medal odor ketchup cupboard equal wave palm accuse ivory minute'
        : 'place connect elite pigeon toilet song suggest primary endless science lizard tomato',
    };

    const dateString = Date.now().toString();
    const companyProfileProperties = {
      registration: {
        court: `trst ${dateString}`,
        register: 'hra',
        registerNumber: `qwer ${dateString}`,
        salesTaxID: `qw ${dateString}`,
      },
      contact: {
        country: 'DE',
        city: `City ${dateString}`,
        postalCode: '12345',
        streetAndNumber: `Street ${dateString}`,
        website: 'https://evan.network',
      },
    };
    const deviceProfileProperties = {
      deviceDetails: {
        dataStreamSettings: `dataStreamSettings ${dateString}`,
        location: `location ${dateString}`,
        manufacturer: `manufacturer ${dateString}`,
        owner: '0xcA4f9fF9e32a768BC68399B9F46d8A884089997d',
        serialNumber: `serialNumber ${dateString}`,
        settings: { files: [] },
        type: { files: [] },
      },
    };

    /**
     * Return the runtime for a test mnemonic.
     *
     * @param      {string}  mnemonic  mnemonic to create the runtime with
     * @param      {string}  password  password to create the runtime with
     */
    async function getProfileRuntime(mnemonic: string, password = 'Test1234', useIdentityFlag = false) {
      return createDefaultRuntime(
        await TestUtils.getWeb3(),
        await TestUtils.getIpfs(),
        {
          mnemonic,
          password,
          useIdentity: useIdentityFlag,
        },
      );
    }

    it('can transform user profile to company profile', async () => {
      const newMnemonic = Onboarding.createMnemonic();
      const initRuntime = await TestUtils.getRuntime(accounts[0]);

      await Onboarding.createNewProfile(initRuntime, newMnemonic, 'Test1234', {
        accountDetails: {
          profileType: 'user',
          accountName: 'test account',
        },
      });
      const localRuntime = await getProfileRuntime(newMnemonic);

      await localRuntime.profile.setProfileProperties({
        accountDetails: {
          accountName: 'New company',
          profileType: 'company',
        },
      });
      const accountDetails = await localRuntime.profile.getProfileProperty('accountDetails');
      await expect(accountDetails.accountName).to.be.eq('New company');
    });

    it('cannot transform specified profile to another profile type', async () => {
      const newMnemonic = Onboarding.createMnemonic();
      const initRuntime = await TestUtils.getRuntime(accounts[0], null, { useIdentity });
      await Onboarding.createNewProfile(initRuntime, newMnemonic, 'Test1234', {
        accountDetails: {
          profileType: 'user',
          accountName: 'test account',
        },
      });
      const localRuntime = await getProfileRuntime(newMnemonic);

      await localRuntime.profile.setProfileProperties({
        accountDetails: {
          accountName: 'New company',
          profileType: 'company',
        },
      });
      const accountDetails = await localRuntime.profile.getProfileProperty('accountDetails');
      await expect(accountDetails.accountName).to.be.eq('New company');

      const promise = localRuntime.profile.setProfileProperties({
        accountDetails: {
          accountName: 'Now it\'s a device',
          profileType: 'device',
        },
      });

      await expect(promise).to.be.rejected;
    });

    it('can transform user profile to device profile', async () => {
      const newMnemonic = Onboarding.createMnemonic();
      const initRuntime = await TestUtils.getRuntime(accounts[0], null, { useIdentity });

      await Onboarding.createNewProfile(initRuntime, newMnemonic, 'Test1234', {
        accountDetails: {
          profileType: 'user',
          accountName: 'test account',
        },
      });
      const localRuntime = await getProfileRuntime(newMnemonic);

      await localRuntime.profile.setProfileProperties({
        accountDetails: {
          accountName: 'New device',
          profileType: 'device',
        },
      });
      const accountDetails = await localRuntime.profile.getProfileProperty('accountDetails');
      await expect(accountDetails.accountName).to.be.eq('New device');
    });

    it('can transform user profile to type that does not exists', async () => {
      const newMnemonic = Onboarding.createMnemonic();
      const initRuntime = await TestUtils.getRuntime(accounts[0], null, { useIdentity });

      await Onboarding.createNewProfile(initRuntime, newMnemonic, 'Test1234', {
        accountDetails: {
          profileType: 'user',
          accountName: 'test account',
        },
      });
      const localRuntime = await getProfileRuntime(newMnemonic);

      const promise = localRuntime.profile.setProfileProperties({
        accountDetails: {
          accountName: 'custom profile',
          profileType: 'my own type',
        },
      });

      await expect(promise).to.be.rejected;
    });

    it('can save company profile specific properties to a profile of type company', async () => {
      const localRuntime = await getProfileRuntime(mnemonics.company, 'Test1234', useIdentity);
      await localRuntime.profile.setProfileProperties(companyProfileProperties);
      const [accountDetails, contact, registration] = await Promise.all(['accountDetails', 'contact', 'registration'].map(
        (p) => localRuntime.profile.getProfileProperty(p),
      ));
      await expect(accountDetails.profileType).to.be.eq('company');
      await expect(isEqual(companyProfileProperties.registration, registration)).to.be.true;
      await expect(isEqual(companyProfileProperties.contact, contact)).to.be.true;
    });

    it('cannot save device profile specific properties into company profile', async () => {
      const localRuntime = await getProfileRuntime(mnemonics.company);
      const promise = localRuntime.profile.setProfileProperties(deviceProfileProperties);
      await expect(promise).to.be.rejected;
    });
  });
});
