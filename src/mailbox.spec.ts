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
import { expect } from 'chai';
import * as BigNumber from 'bignumber.js';

import { accounts, useIdentity } from './test/accounts';
import { Ipld } from './dfs/ipld';
import { Mail, Mailbox } from './mailbox';
import { TestUtils } from './test/test-utils';
import { Runtime } from './runtime';

describe('Mailbox class', function test() {
  this.timeout(600000);
  let mailbox0: Mailbox;
  let mailbox1: Mailbox;
  let identity0: string;
  let identity1: string;
  let runtimes: Runtime[];
  let web3: any;
  const random = Math.random();
  const getTestMail = (to): Mail => ({
    content: {
      from: runtimes[0].activeIdentity,
      to,
      title: 'talking to myself',
      body: `hi, me. I like random numbers, for example ${random}`,
      attachments: [
        {
          type: 'sharedExchangeKey',
          key: '',
        },
      ],
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
    runtimes = await Promise.all(
      accounts.slice(0, 2).map(
        (account) => TestUtils.getRuntime(account, null, { useIdentity }),
      ),
    );
    ([{ activeIdentity: identity0, mailbox: mailbox0, web3 },
      { activeIdentity: identity1, mailbox: mailbox1 }] = runtimes);
  });

  it('should be able to send a mail', async () => {
    const startTime = Date.now();
    await mailbox0.sendMail(getTestMail(identity0), identity0, identity0);
    const result = await mailbox0.getMails(1, 0);
    const keys = Object.keys(result.mails);
    expect(keys.length).to.eq(1);
    expect(result.mails[keys[0]].content.sent).to.be.ok;
    expect(result.mails[keys[0]].content.sent).to.be.gt(startTime);
    expect(result.mails[keys[0]].content.sent).to.be.lt(Date.now());
    delete result.mails[keys[0]].content.sent;
    expect(result.mails[keys[0]].content).to.deep.eq(getTestMail(identity0).content);
  });

  it('should be able to load anything', async () => {
    const mails = await mailbox0.getMails(1, 0);
    expect(mails).not.to.be.undefined;
    expect(mails.totalResultCount).to.be.gte(0);
    expect(Object.keys(mails.mails).length).to.be.gte(0);
  });

  it('should be able to get a set amount of mails', async () => {
    await mailbox0.sendMail(getTestMail(identity0), identity0, identity0);
    let mails;
    mails = await mailbox0.getMails(1);
    expect(mails).not.to.be.undefined;
    expect(Object.keys(mails.mails).length).to.eq(1);
    mails = await mailbox0.getMails(2);
    expect(mails).not.to.be.undefined;
    expect(Object.keys(mails.mails).length).to.eq(2);
  });

  it('should be able to load all mails in the correct order', async () => {
    // get last two mails
    const mailSet1 = await mailbox0.getMails(1, 0);
    const mailSet2 = await mailbox0.getMails(1, 1);

    // check that mails were returned in correct order
    const indexMail1 = parseInt(Object.keys(mailSet1.mails)[0], 16);
    const indexMail2 = parseInt(Object.keys(mailSet2.mails)[0], 16);
    expect(indexMail1).to.be.gt(indexMail2);
  });

  it('should be able to send and retrieve answers', async () => {
    await mailbox0.sendMail(getTestMail(identity0), identity0, identity0);
    let result = await mailbox0.getMails(1, 0);
    let keys = Object.keys(result.mails);
    expect(keys.length).to.eq(1);
    const initialMailId = keys[0];
    const answer = getTestAnswer(initialMailId);
    answer.content.from = identity0;
    await mailbox0.sendAnswer({ ...answer }, identity0, identity0);

    result = await mailbox0.getAnswersForMail(initialMailId);
    expect(result).not.to.be.undefined;
    expect(result.totalResultCount).to.eq(1);
    keys = Object.keys(result.mails);
    const answerId = keys[0];
    const mail = result.mails[answerId];
    Ipld.purgeCryptoInfo(mail);
    expect(mail).to.deep.eq(answer);
  });

  it('should be able to read mails sent from another user', async () => {
    await mailbox0.sendMail(getTestMail(identity1), identity0, identity1);

    const result = await mailbox1.getMails(1, 0);
    const keys = Object.keys(result.mails);
    expect(keys.length).to.eq(1);
    expect(result.mails[keys[0]].content.sent).to.be.ok;
    expect(result.mails[keys[0]].content.sent).to.be.lt(Date.now());
    delete result.mails[keys[0]].content.sent;
    expect(result.mails[keys[0]].content).to.deep.eq(getTestMail(identity1).content);
  });

  it('should be able to send UTC tokens with a mail', async () => {
    await mailbox0.init();
    const balanceToSend = new BigNumber(web3.utils.toWei('1', 'kWei'));
    const balanceBefore = new BigNumber(await web3.eth.getBalance(runtimes[0].underlyingAccount));
    const mailboxBalanceBefore = new BigNumber(
      await web3.eth.getBalance(mailbox0.mailboxContract.options.address),
    );
    await mailbox0.sendMail(getTestMail(identity1), identity0, identity1, `0x${balanceToSend.toString(16)}`);
    const mailboxBalanceAfter = new BigNumber(
      await web3.eth.getBalance(mailbox0.mailboxContract.options.address),
    );
    const balanceAfter = new BigNumber(await web3.eth.getBalance(runtimes[0].underlyingAccount));
    // before - cost = after + value // (sender pays cost)
    expect(balanceAfter.plus(balanceToSend).lte(balanceBefore)).to.be.true;
    // before + value = after
    expect(mailboxBalanceBefore.plus(balanceToSend).eq(mailboxBalanceAfter)).to.be.true;
  });

  it('should allow checking balance for a mail', async () => {
    const balanceToSend = new BigNumber(web3.utils.toWei('0.1', 'Ether'));
    await mailbox0.sendMail(getTestMail(identity1), identity0, identity1, web3.utils.toWei('0.1', 'Ether'));
    const result = await mailbox1.getMails(1, 0);
    const keys = Object.keys(result.mails);
    const mailBalance = await mailbox1.getBalanceFromMail(keys[0]);
    expect(balanceToSend.eq(mailBalance)).to.be.true;
  });

  it('should allow withdrawing UTC tokens for a mail', async () => {
    const balanceToSend = new BigNumber(web3.utils.toWei('0.1', 'Ether'));
    await mailbox0.sendMail(getTestMail(identity1), identity0, identity1, web3.utils.toWei('0.1', 'Ether'));
    const result = await mailbox1.getMails(1, 0);
    const keys = Object.keys(result.mails);
    const balanceBefore = new BigNumber(await web3.eth.getBalance(identity1));
    const mailboxBalanceBefore = new BigNumber(
      await web3.eth.getBalance(mailbox0.mailboxContract.options.address),
    );
    await mailbox1.withdrawFromMail(keys[0], identity1);
    const mailboxBalanceAfter = new BigNumber(
      await web3.eth.getBalance(mailbox0.mailboxContract.options.address),
    );
    const balanceAfter = new BigNumber(await web3.eth.getBalance(identity1));
    // before + value - cost = after // (withdrawer pays cost)
    expect(balanceBefore.plus(balanceToSend).gte(balanceAfter)).to.be.true;
    // before - value = after
    expect(mailboxBalanceAfter.plus(balanceToSend).eq(mailboxBalanceBefore)).to.be.true;
  });
});
