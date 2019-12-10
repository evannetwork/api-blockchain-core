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
import * as chaiAsPromised from 'chai-as-promised';

use(chaiAsPromised);

import { Ipfs } from './dfs/ipfs';
import { Ipld } from './dfs/ipld';
import { KeyExchange } from './keyExchange';
import { Mailbox } from './mailbox';
import { Profile } from './profile/profile';
import { TestUtils } from './test/test-utils';
import { accounts } from './test/accounts';
import { Onboarding } from './onboarding';

describe('KeyExchange class', function() {
  this.timeout(600000);
  let ipfs: Ipfs;
  let mailbox: Mailbox;
  let mailbox2: Mailbox;
  let keyExchange1: KeyExchange;
  let keyExchange2: KeyExchange;
  let web3;
  let ipld: Ipld;
  let profile: Profile;
  let profile2: Profile;

  before(async () => {
    web3 = TestUtils.getWeb3();

    ipfs = await TestUtils.getIpfs();
    ipld = await TestUtils.getIpld(ipfs);

    // create profile 1
    const profile1Runtime = await TestUtils.getRuntime(accounts[0]);
    profile1Runtime.profile = await TestUtils.getProfile(web3, ipfs, ipld, accounts[0]);
    await Onboarding.createProfile(profile1Runtime, {
      accountDetails: {
        profileType: 'company',
        accountName: 'test account'
      }
    });
    // create profile 2
    const profile2Runtime = await TestUtils.getRuntime(accounts[1]);
    profile2Runtime.profile = await TestUtils.getProfile(web3, ipfs, ipld, accounts[1]);
    await Onboarding.createProfile(profile2Runtime, {
      accountDetails: {
        profileType: 'company',
        accountName: 'test account',
      }
    });

    profile = profile1Runtime.profile;
    profile2 = profile2Runtime.profile;
    await profile.loadForAccount();
    await profile2.loadForAccount();
    mailbox = profile1Runtime.mailbox;
    mailbox2 = profile2Runtime.mailbox;
    keyExchange1 = profile1Runtime.keyExchange;
    keyExchange2 = profile2Runtime.keyExchange;
  });

  it('should be able to send an invitation mail and store new commKey', async () => {
    const foreignPubkey = await profile2.getPublicKey();
    const commKey = await keyExchange1.generateCommKey();
    await keyExchange1.sendInvite(accounts[1], foreignPubkey, commKey, { fromAlias: 'Bob', });
    await profile.addContactKey(accounts[1], 'commKey', commKey);
    await profile.storeForAccount(profile.treeLabels.addressBook);
  });

  it('should compute 2 different keys for the both accounts', async () => {
    expect(keyExchange1.getDiffieHellmanKeys().publicKey)
      .to.not.eq(keyExchange2.getDiffieHellmanKeys().publicKey);
  });

  it('should be able to retrieve the invite mail from the second account', async () => {
    const result = await mailbox2.getMails(1, 0);
    const keys = Object.keys(result.mails);
    expect(keys.length).to.eq(1);
  });

  it('should be able retrieve the encrypted communication key with the public key of account 2',
    async () => {
      const result = await mailbox2.getMails(1, 0);
      const keys = Object.keys(result.mails);
      expect(result.mails[keys[0]].content.attachments[0].type).to.equal('commKey');
      const profileFromMail = await TestUtils.getProfile(web3, null, ipld, result.mails[keys[0]].content.from);

      const publicKeyProfile = await profileFromMail.getPublicKey();
      const commSecret = keyExchange2.computeSecretKey(publicKeyProfile);
      await expect(
        keyExchange2.decryptCommKey(
          result.mails[keys[0]].content.attachments[0].key, commSecret.toString('hex')))
        .not.to.be.rejected;
    });

  it('should not be able to decrypt the communication key when a third person gets the message',
    async () => {
      const result = await mailbox2.getMails(1, 0);
      const keys = Object.keys(result.mails);
      expect(result.mails[keys[0]].content.attachments[0].type).to.equal('commKey');

      const profileFromMail = await TestUtils.getProfile(web3, null, ipld, result.mails[keys[0]].content.from);
      const keyExchangeOptions = {
        mailbox,
        cryptoProvider:  TestUtils.getCryptoProvider(),
        defaultCryptoAlgo: 'aes',
        account: accounts[2],
        keyProvider: TestUtils.getKeyProvider(),
      };

      const blackHat = new KeyExchange(keyExchangeOptions);
      const publicKeyProfile = await profileFromMail.getPublicKey();
      const commSecret = blackHat.computeSecretKey(publicKeyProfile);
      await expect(
        blackHat.decryptCommKey(
          result.mails[keys[0]].content.attachments[0].key, commSecret.toString('hex')))
        .to.be.rejected;
    });

  it('should be able to send an invitation to a remote account', async () => {
    const profileLocal = await TestUtils.getProfile(web3, null, ipld, accounts[1]);
    const foreignPubkey = await profileLocal.getPublicKey();
    const commKey = await keyExchange1.generateCommKey();
    await keyExchange1.sendInvite(accounts[1], foreignPubkey, commKey, 'hi');
    await profile.addContactKey(accounts[1], 'commKey', commKey);
    await profile.storeForAccount(profile.treeLabels.addressBook);
  });
});
