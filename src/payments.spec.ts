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

import { KeyProvider } from '@evan.network/dbcp';

import { accounts } from './test/accounts';
import { config } from './config';
import { KeyExchange } from './keyExchange';
import { Ipld } from './dfs/ipld';
import { InvitationMail, Onboarding } from './onboarding';
import { Mailbox } from './mailbox';
import { Profile } from './profile/profile';
import { TestUtils } from './test/test-utils';

import * as BigNumber from 'bignumber.js';

describe('Payment Channels', function() {
  this.timeout(600000);
  let nameResolver;
  let payments1;
  let payments2;
  let executor;
  let web3;
  let initialChannel;
  let proof;
  before(async () => {
    web3 = TestUtils.getWeb3();
    executor = await TestUtils.getExecutor(web3);
    payments1 = await TestUtils.getPayments(web3, accounts[0]);
    payments2 = await TestUtils.getPayments(web3, accounts[1]);
  });


  it('should create a new channel manager', async () => {
    const channelManager = await executor.createContract(
      'RaidenMicroTransferChannels',
      [500, []],
      { from: accounts[0], gas: 3000000, }
    );
    payments1.setChannelManager(channelManager.options.address);
    payments2.setChannelManager(channelManager.options.address);
    console.dir(channelManager.options.address);
  });

  it('should open a new channel to a other account', async () => {
    initialChannel = await payments1.openChannel(accounts[0], accounts[1], 5);
    payments2.setChannel(initialChannel);
  });

  it('should reload a channel to a other account, when loading from blockchain', async () => {
    const channel = await payments1.loadChannelFromBlockchain(accounts[0], accounts[1]);
    expect(channel.block).to.equal(initialChannel.block);
  });

  it('should sign a new payment from the target', async () => {
    proof = await payments1.incrementBalanceAndSign(1);
    payments1.confirmPayment(proof);
    payments2.channel.proof = proof;
    expect(proof.balance.eq(1));
  });

  it('should top up a channel with new eves', async () => {
    const closingSig = await payments1.topUpChannel(10);
    const info = await payments1.getChannelInfo();
    expect(info.deposit.eq(new BigNumber(15))).to.be.true;
  });

  it('should close a channel cooperative from the receiver side', async () => {
    const closingSig = await payments2.getClosingSig(accounts[1], proof);

    // store balance before closing
    const balanceReceiverBefore = new BigNumber(await web3.eth.getBalance(accounts[1]));
    await payments2.closeChannel(closingSig);

    let result = await payments2.getChannelInfo();
    expect(result).to.have.all.keys('state', 'block', 'deposit', 'withdrawn');
    expect(result.state).to.be.equal('settled');
    expect(result.deposit.eq(new BigNumber(0))).to.be.true;

    const balanceReceiverAfter = new BigNumber(await web3.eth.getBalance(accounts[1]));
    expect(balanceReceiverAfter.eq(balanceReceiverBefore.add(1)));
  });

  it('should close a channel cooperative from the sender side', async () => {
    initialChannel = await payments1.openChannel(accounts[0], accounts[1], 5);
    payments2.setChannel(initialChannel);
    proof = await payments1.incrementBalanceAndSign(1);
    payments1.confirmPayment(proof);
    payments2.channel.proof = proof;
    const closingSig = await payments2.getClosingSig(accounts[1], proof);

    // store balance before closing
    const balanceReceiverBefore = new BigNumber(await web3.eth.getBalance(accounts[1]));

    await payments1.closeChannel(closingSig);

    let result = await payments1.getChannelInfo();
    expect(result).to.have.all.keys('state', 'block', 'deposit', 'withdrawn');
    expect(result.state).to.be.equal('settled');
    expect(result.deposit.eq(new BigNumber(0))).to.be.true;

    const balanceReceiverAfter = new BigNumber(await web3.eth.getBalance(accounts[1]));
    expect(balanceReceiverAfter.eq(balanceReceiverBefore.add(1)));
  });

   it.skip('should close a channel un-cooperative from the receiver side', async () => {
    const closingSig = await payments2.getClosingSig(accounts[1], proof);
    await payments2.closeChannel(closingSig);
  });
});