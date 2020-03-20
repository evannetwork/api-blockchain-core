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

import { Ipld } from './dfs/ipld';
import { KeyExchange } from './keyExchange';
import { Mailbox } from './mailbox';
import { Profile } from './profile/profile';
import { Runtime } from './index';
import { TestUtils } from './test/test-utils';
import { accounts, identities, useIdentity } from './test/accounts';

use(chaiAsPromised);

describe('KeyExchange class', function test() {
  this.timeout(600000);
  let mailbox0: Mailbox;
  let mailbox1: Mailbox;
  let keyExchange0: KeyExchange;
  let keyExchange1: KeyExchange;
  let ipld: Ipld;
  let identity1: string;
  let profile0: Profile;
  let profile1: Profile;
  let runtimes: Runtime[];

  before(async () => {
    runtimes = await Promise.all(
      accounts.slice(0, 2).map(
        (account) => TestUtils.getRuntime(account, null, { useIdentity }),
      ),
    );
    [{
      ipld,
    }] = runtimes;

    identity1 = runtimes[1].activeIdentity;
    profile0 = runtimes[0].profile;
    profile1 = runtimes[1].profile;
    await profile0.loadForAccount();
    await profile1.loadForAccount();
    mailbox0 = runtimes[0].mailbox;
    mailbox1 = runtimes[1].mailbox;
    keyExchange0 = runtimes[0].keyExchange;
    keyExchange1 = runtimes[1].keyExchange;
  });

  it('should be able to send an invitation mail and store new commKey', async () => {
    const foreignPubkey = await profile1.getPublicKey();
    const commKey = await keyExchange0.generateCommKey();
    await keyExchange0.sendInvite(identity1, foreignPubkey, commKey, { fromAlias: 'Bob' });
    await profile0.addContactKey(identity1, 'commKey', commKey);
    await profile0.storeForAccount(profile0.treeLabels.addressBook);
  });

  it('should compute 2 different keys for the both accounts', async () => {
    expect(keyExchange0.getDiffieHellmanKeys().publicKey)
      .to.not.eq(keyExchange1.getDiffieHellmanKeys().publicKey);
  });

  it('should be able to retrieve the invite mail from the second account', async () => {
    const result = await mailbox1.getMails(1, 0);
    const keys = Object.keys(result.mails);
    expect(keys.length).to.eq(1);
  });

  it('should be able retrieve the encrypted communication key with the public key of account 2',
    async () => {
      const result = await mailbox1.getMails(1, 0);
      const keys = Object.keys(result.mails);
      expect(result.mails[keys[0]].content.attachments[0].type).to.equal('commKey');
      const profileFromMail = await TestUtils.getProfile(
        runtimes[0],
        null,
        ipld,
        result.mails[keys[0]].content.from,
      );

      const publicKeyProfile = await profileFromMail.getPublicKey();
      const commSecret = keyExchange1.computeSecretKey(publicKeyProfile);
      await expect(
        keyExchange1.decryptCommKey(
          result.mails[keys[0]].content.attachments[0].key, commSecret.toString('hex'),
        ),
      ).not.to.be.rejected;
    });

  it('should not be able to decrypt the communication key when a third person gets the message',
    async () => {
      const result = await mailbox1.getMails(1, 0);
      const keys = Object.keys(result.mails);
      expect(result.mails[keys[0]].content.attachments[0].type).to.equal('commKey');

      const profileFromMail = await TestUtils.getProfile(
        runtimes[0],
        null,
        ipld,
        result.mails[keys[0]].content.from,
      );
      const keyExchangeOptions = {
        mailbox: mailbox0,
        cryptoProvider: runtimes[0].cryptoProvider,
        defaultCryptoAlgo: 'aes',
        account: identities[2],
        keyProvider: runtimes[0].keyProvider,
      };

      const blackHat = new KeyExchange(keyExchangeOptions);
      const publicKeyProfile = await profileFromMail.getPublicKey();
      const commSecret = blackHat.computeSecretKey(publicKeyProfile);
      await expect(
        blackHat.decryptCommKey(
          result.mails[keys[0]].content.attachments[0].key, commSecret.toString('hex'),
        ),
      ).to.be.rejected;
    });

  it('should be able to send an invitation to a remote account', async () => {
    const profileLocal = await TestUtils.getProfile(runtimes[0], null, ipld, identity1);
    const foreignPubkey = await profileLocal.getPublicKey();
    const commKey = await keyExchange0.generateCommKey();
    await keyExchange0.sendInvite(identity1, foreignPubkey, commKey, 'hi');
    await profile0.addContactKey(identity1, 'commKey', commKey);
    await profile0.storeForAccount(profile0.treeLabels.addressBook);
  });
});
