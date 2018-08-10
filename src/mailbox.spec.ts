/*
  Copyright (C) 2018-present evan GmbH.

  This program is free software: you can redistribute it and/or modify it
  under the terms of the GNU Affero General Public License, version 3,
  as published by the Free Software Foundation.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
  See the GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License along with this program.
  If not, see http://www.gnu.org/licenses/ or write to the

  Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA, 02110-1301 USA,

  or download the license from the following URL: https://evan.network/license/

  You can be released from the requirements of the GNU Affero General Public License
  by purchasing a commercial license.
  Buying such a license is mandatory as soon as you use this software or parts of it
  on other blockchains than evan.network.

  For more information, please contact evan GmbH at this address: https://evan.network/license/
*/

import 'mocha';
import { expect } from 'chai';
import BigNumber = require('bignumber.js');

import {
  Ipfs,
  NameResolver,
} from '@evan.network/dbcp';

import { accounts } from './test/accounts';
import { Ipld } from './dfs/ipld';
import { Mail, Mailbox, MailboxOptions } from './mailbox';
import { TestUtils } from './test/test-utils';

describe('Mailbox class', function() {
  this.timeout(600000);
  let ipfs: Ipfs;
  let mailbox: Mailbox;
  let web3;
  const random = Math.random();
  const getTestMail = (to): Mail => ({
    content: {
      from: accounts[0],
      to,
      title: 'talking to myself',
      body: `hi, me. I like random numbers, for example ${random}`,
      attachments: [
        {
          type: 'sharedExchangeKey',
          key: ''
        }
      ]
    },
  });
  const getTestAnswer = (parentId): Mail => ({
    parentId,
    content: {
      body: `but my favorite random number is ${random}`,
      from: null,
      title: 'I like random numbers as well',
    },
  });

  before(async () => {
    web3 = TestUtils.getWeb3();
    ipfs = await TestUtils.getIpfs();
    mailbox = new Mailbox({
      mailboxOwner: accounts[0],
      nameResolver: await TestUtils.getNameResolver(web3),
      ipfs,
      contractLoader: await TestUtils.getContractLoader(web3),
      cryptoProvider:  TestUtils.getCryptoProvider(),
      keyProvider:  TestUtils.getKeyProvider(),
      defaultCryptoAlgo: 'aes',
    });
  });

  after(async () => {
    web3.currentProvider.connection.close();
    await ipfs.stop();
  });

  it('should be able to send a mail', async () => {
    const startTime = Date.now();
    await mailbox.sendMail(getTestMail(accounts[0]), accounts[0], accounts[0]);
    const result = await mailbox.getMails(1, 0);
    const keys = Object.keys(result.mails);
    expect(keys.length).to.eq(1);
    expect(result.mails[keys[0]].content.sent).to.be.ok;
    expect(result.mails[keys[0]].content.sent).to.be.gt(startTime);
    expect(result.mails[keys[0]].content.sent).to.be.lt(Date.now());
    delete result.mails[keys[0]].content.sent;
    expect(result.mails[keys[0]].content).to.deep.eq(getTestMail(accounts[0]).content);
  });

  it('should be able to load anything', async () => {
    const mails = await mailbox.getMails();
    expect(mails).not.to.be.undefined;
    expect(mails.totalResultCount).to.be.gte(0);
    expect(Object.keys(mails.mails).length).to.be.gte(0);
  });

  it('should be able to get a set amount of mails', async () => {
    await mailbox.sendMail(getTestMail(accounts[0]), accounts[0], accounts[0]);
    let mails;
    mails = await mailbox.getMails(1)
    expect(mails).not.to.be.undefined;
    expect(Object.keys(mails.mails).length).to.eq(1);
    mails = await mailbox.getMails(2)
    expect(mails).not.to.be.undefined;
    expect(Object.keys(mails.mails).length).to.eq(2);
  });

  it('should be able to load all mails in the correct order', async () => {
    // get last two mails
    const mailSet1 = await mailbox.getMails(1, 0);
    const mailSet2 = await mailbox.getMails(1, 1);

    // check that mails were returned in correct order
    const indexMail1 = parseInt(Object.keys(mailSet1.mails)[0], 16);
    const indexMail2 = parseInt(Object.keys(mailSet2.mails)[0], 16);
    expect(indexMail1).to.be.gt(indexMail2);
  });

  it('should be able to send and retrieve answers', async () => {
    await mailbox.sendMail(getTestMail(accounts[0]), accounts[0], accounts[0]);
    let result = await mailbox.getMails(1, 0);
    let keys = Object.keys(result.mails);
    expect(keys.length).to.eq(1);
    const initialMailId = keys[0];
    const answer = getTestAnswer(initialMailId);
    answer.content.from = accounts[0];
    await mailbox.sendAnswer(Object.assign({}, answer), accounts[0], accounts[0]);

    result = await mailbox.getAnswersForMail(initialMailId);
    expect(result).not.to.be.undefined;
    expect(result.totalResultCount).to.eq(1);
    keys = Object.keys(result.mails);
    const answerId = keys[0];
    const mail = result.mails[answerId];
    Ipld.purgeCryptoInfo(mail);
    expect(mail).to.deep.eq(answer);
  });

  it('should be able to read mails sent from another user', async () => {
    const startTime = Date.now();
    // mailbox user 2
    const  mailbox2 = new Mailbox({
      mailboxOwner: accounts[1],
      nameResolver: await TestUtils.getNameResolver(web3),
      ipfs,
      contractLoader: await TestUtils.getContractLoader(web3),
      cryptoProvider:  TestUtils.getCryptoProvider(),
      keyProvider:  TestUtils.getKeyProvider(),
      defaultCryptoAlgo: 'aes',
    });

    await mailbox.sendMail(getTestMail(accounts[1]), accounts[0], accounts[1]);

    const result = await mailbox2.getMails(1, 0);
    const keys = Object.keys(result.mails);
    expect(keys.length).to.eq(1);
    expect(result.mails[keys[0]].content.sent).to.be.ok;
    expect(result.mails[keys[0]].content.sent).to.be.gt(startTime);
    expect(result.mails[keys[0]].content.sent).to.be.lt(Date.now());
    delete result.mails[keys[0]].content.sent;
    expect(result.mails[keys[0]].content).to.deep.eq(getTestMail(accounts[1]).content);
  });

  it('should be able to send UTC tokens with a mail', async () => {
    const startTime = Date.now();
    await mailbox.init();
    const balanceToSend = new BigNumber(web3.utils.toWei('1', 'kWei'));
    const balanceBefore = new BigNumber(await web3.eth.getBalance(accounts[0]));
    const mailboxBalanceBefore = new BigNumber(await web3.eth.getBalance(mailbox.mailboxContract.options.address));
    await mailbox.sendMail(getTestMail(accounts[1]), accounts[0], accounts[1], `0x${balanceToSend.toString(16)}`);
    const mailboxBalanceAfter = new BigNumber(await web3.eth.getBalance(mailbox.mailboxContract.options.address));
    const balanceAfter = new BigNumber(await web3.eth.getBalance(accounts[0]));
    expect(balanceAfter.plus(balanceToSend).lte(balanceBefore)).to.be.true;  // before - cost = after + value // (sender pays cost)
    expect(mailboxBalanceBefore.plus(balanceToSend).eq(mailboxBalanceAfter)).to.be.true;  // before + value = after
  });

  it('should allow checking balance for a mail', async () => {
    const startTime = Date.now();
    const  mailbox2 = new Mailbox({
      mailboxOwner: accounts[1],
      nameResolver: await TestUtils.getNameResolver(web3),
      ipfs,
      contractLoader: await TestUtils.getContractLoader(web3),
      cryptoProvider:  TestUtils.getCryptoProvider(),
      keyProvider:  TestUtils.getKeyProvider(),
      defaultCryptoAlgo: 'aes',
    });
    const balanceToSend = new BigNumber(web3.utils.toWei('0.1', 'Ether'));
    await mailbox.sendMail(getTestMail(accounts[1]), accounts[0], accounts[1], web3.utils.toWei('0.1', 'Ether'));
    const result = await mailbox2.getMails(1, 0);
    const keys = Object.keys(result.mails);
    const mailBalance = await mailbox2.getBalanceFromMail(keys[0]);
    expect(balanceToSend.eq(mailBalance)).to.be.true;
  });

  it('should allow withdrawing UTC tokens for a mail', async () => {
    const startTime = Date.now();
    const  mailbox2 = new Mailbox({
      mailboxOwner: accounts[1],
      nameResolver: await TestUtils.getNameResolver(web3),
      ipfs,
      contractLoader: await TestUtils.getContractLoader(web3),
      cryptoProvider:  TestUtils.getCryptoProvider(),
      keyProvider:  TestUtils.getKeyProvider(),
      defaultCryptoAlgo: 'aes',
    });
    const balanceToSend = new BigNumber(web3.utils.toWei('0.1', 'Ether'));
    await mailbox.sendMail(getTestMail(accounts[1]), accounts[0], accounts[1], web3.utils.toWei('0.1', 'Ether'));
    const result = await mailbox2.getMails(1, 0);
    const keys = Object.keys(result.mails);
    const balanceBefore = new BigNumber(await web3.eth.getBalance(accounts[1]));
    const mailboxBalanceBefore = new BigNumber(await web3.eth.getBalance(mailbox.mailboxContract.options.address));
    await mailbox2.withdrawFromMail(keys[0], accounts[1]);
    const mailboxBalanceAfter = new BigNumber(await web3.eth.getBalance(mailbox.mailboxContract.options.address));
    const balanceAfter = new BigNumber(await web3.eth.getBalance(accounts[1]));
    expect(balanceBefore.plus(balanceToSend).gte(balanceAfter)).to.be.true;  // before + value - cost = after // (withdrawer pays cost)
    expect(mailboxBalanceAfter.plus(balanceToSend).eq(mailboxBalanceBefore)).to.be.true;  // before - value = after
  });

  it('should now allow withdrawing UTC tokens for a mail that has no tokens', async () => {});
});
