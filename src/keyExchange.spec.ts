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
import { expect, use } from 'chai';
import chaiAsPromised = require('chai-as-promised');

use(chaiAsPromised);

import BigNumber = require('bignumber.js');

import {
  Ipfs,
  NameResolver,
} from '@evan.network/dbcp';

import { accounts } from './test/accounts';
import { Mail, Mailbox, MailboxOptions } from './mailbox';
import { Profile } from './profile/profile';
import { KeyExchange, KeyExchangeOptions } from './keyExchange';
import { TestUtils } from './test/test-utils';
import { Ipld } from './dfs/ipld';

describe('KeyExchange class', function() {
  this.timeout(600000);
  let ipfs: Ipfs;
  let mailbox: Mailbox;
  let mailbox2: Mailbox;
  let keyExchange1: KeyExchange;
  let keyExchange2: KeyExchange;
  let keyExchangeKeys: any;
  let commKey: Buffer;
  let web3;
  let ipld: Ipld;
  let profile: Profile;
  let profile2: Profile;
  const random = Math.random();
  const getTestMail = (): Mail => ({
    content: {
      from: accounts[0],
      title: 'talking to myself',
      body: `hi, me. I like random numbers, for example ${random}`,
      attachments: [
        {
          type: 'sharedExchangeKey',
          key: '',
        }
      ],
    },
  });
  const getTestAnswer = (parentId): Mail => ({
    parentId,
    content: {
      body: `but my favorite random number is ${random}`,
      title: 'I like random numbers as well',
    },
  });

  before(async () => {
    web3 = TestUtils.getWeb3();

    ipfs = await TestUtils.getIpfs();
    ipld = await TestUtils.getIpld(ipfs);

    profile = new Profile({
      nameResolver: await TestUtils.getNameResolver(web3),
      defaultCryptoAlgo: 'aes',
      dataContract: await TestUtils.getDataContract(web3, ipfs),
      contractLoader: await TestUtils.getContractLoader(web3),
      ipld,
      executor: await TestUtils.getExecutor(web3),
      accountId: accounts[0],
    });

    profile2 = new Profile({
      nameResolver: await TestUtils.getNameResolver(web3),
      defaultCryptoAlgo: 'aes',
      dataContract: await TestUtils.getDataContract(web3, ipfs),
      contractLoader: await TestUtils.getContractLoader(web3),
      ipld,
      executor: await TestUtils.getExecutor(web3),
      accountId: accounts[1],
    });

    mailbox = new Mailbox({
      mailboxOwner: accounts[0],
      nameResolver: await TestUtils.getNameResolver(web3),
      ipfs,
      contractLoader: await TestUtils.getContractLoader(web3),
      cryptoProvider:  TestUtils.getCryptoProvider(),
      keyProvider:  TestUtils.getKeyProvider(),
      defaultCryptoAlgo: 'aes',
    });

    // mailbox user 2
    mailbox2 = new Mailbox({
      mailboxOwner: accounts[1],
      nameResolver: await TestUtils.getNameResolver(web3),
      ipfs,
      contractLoader: await TestUtils.getContractLoader(web3),
      cryptoProvider:  TestUtils.getCryptoProvider(),
      keyProvider:  TestUtils.getKeyProvider(),
      defaultCryptoAlgo: 'aes',
    });

    const keyExchangeOptions = {
      mailbox,
      cryptoProvider:  TestUtils.getCryptoProvider(),
      defaultCryptoAlgo: 'aes',
      account: accounts[0],
      keyProvider: TestUtils.getKeyProvider(),
    }
    const keyExchangeOptions2 = {
      mailbox: mailbox2,
      cryptoProvider:  TestUtils.getCryptoProvider(),
      defaultCryptoAlgo: 'aes',
      account: accounts[1],
      keyProvider: TestUtils.getKeyProvider(),
    }
    keyExchange1 = new KeyExchange(keyExchangeOptions);
    keyExchange2 = new KeyExchange(keyExchangeOptions2);

    // create profile 1
    await profile.createProfile(keyExchange1.getDiffieHellmanKeys());
    // create profile 2
    await profile2.createProfile(keyExchange2.getDiffieHellmanKeys());
  });

  after(async () => {
    await ipfs.stop();
    web3.currentProvider.connection.close();
  });

  it('should be able to send an invitation mail and store new commKey', async () => {
    const foreignPubkey = await profile2.getPublicKey();
    const commKey = await keyExchange1.generateCommKey();
    await keyExchange1.sendInvite(accounts[1], foreignPubkey, commKey, { fromAlias: 'Bob', });
    await profile.addContactKey(accounts[1], 'commKey', commKey);
    await profile.storeForAccount(profile.treeLabels.addressBook);
  });

  it('should compute 2 different keys for the both accounts', async () => {
    expect(keyExchange1.getDiffieHellmanKeys().publicKey).to.not.eq(keyExchange2.getDiffieHellmanKeys().publicKey);
  });

  it('should be able to retrieve the invite mail from the second account', async () => {
    const result = await mailbox2.getMails(1, 0);
    const keys = Object.keys(result.mails);
    expect(keys.length).to.eq(1);
  });

  it('should be able retrieve the encrypted communication key with the public key of account 2', async () => {
    const result = await mailbox2.getMails(1, 0);
    const keys = Object.keys(result.mails);
    expect(result.mails[keys[0]].content.attachments[0].type).to.equal('commKey');
    let profile = new Profile({
      nameResolver: await TestUtils.getNameResolver(web3),
      defaultCryptoAlgo: 'aes',
      dataContract: await TestUtils.getDataContract(web3, ipfs),
      contractLoader: await TestUtils.getContractLoader(web3),
      ipld,
      executor: await TestUtils.getExecutor(web3),
      accountId: result.mails[keys[0]].content.from,
    });

    const publicKeyProfile = await profile.getPublicKey();
    const commSecret = keyExchange2.computeSecretKey(publicKeyProfile);
    commKey = await keyExchange2.decryptCommKey(result.mails[keys[0]].content.attachments[0].key, commSecret.toString('hex'));
  });

  it('should not be able to decrypt the communication key when a third person gets the message', async () => {
    const result = await mailbox2.getMails(1, 0);
    const keys = Object.keys(result.mails);
    expect(result.mails[keys[0]].content.attachments[0].type).to.equal('commKey');
    let profile = new Profile({
      nameResolver: await TestUtils.getNameResolver(web3),
      defaultCryptoAlgo: 'aes',
      dataContract: await TestUtils.getDataContract(web3, ipfs),
      contractLoader: await TestUtils.getContractLoader(web3),
      ipld,
      executor: await TestUtils.getExecutor(web3),
      accountId: result.mails[keys[0]].content.from,
    });
    const keyExchangeOptions = {
      mailbox,
      cryptoProvider:  TestUtils.getCryptoProvider(),
      defaultCryptoAlgo: 'aes',   
      account: accounts[2],
      keyProvider: TestUtils.getKeyProvider(),
    };

    const blackHat = new KeyExchange(keyExchangeOptions);
    const publicKeyProfile = await profile.getPublicKey();
    const commSecret = blackHat.computeSecretKey(publicKeyProfile);
    await expect(blackHat.decryptCommKey(result.mails[keys[0]].content.attachments[0].key, commSecret.toString('hex'))).to.be.rejected;
  });

  it('should be able to send an invitation to a remote account', async () => {
    const remoteAddress = '';
    const profileLocal = new Profile({
      nameResolver: await TestUtils.getNameResolver(web3),
      defaultCryptoAlgo: 'aes',
      dataContract: await TestUtils.getDataContract(web3, ipfs),
      contractLoader: await TestUtils.getContractLoader(web3),
      ipld,
      executor: await TestUtils.getExecutor(web3),
      accountId: accounts[1],
    });
    const foreignPubkey = await profileLocal.getPublicKey();
    const commKey = await keyExchange1.generateCommKey();
    await keyExchange1.sendInvite(accounts[1], foreignPubkey, commKey, 'hi');
    await profile.addContactKey(accounts[1], 'commKey', commKey);
    await profile.storeForAccount(profile.treeLabels.addressBook);
  });
});
