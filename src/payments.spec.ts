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
import { TestUtils } from './test/test-utils';
import { Payments } from './payments';
import { Runtime } from './runtime';


describe('Payment Channels', function test() {
  this.timeout(600000);
  let payments0: Payments;
  let payments1: Payments;
  let executor;
  let identity0: string;
  let identity1: string;
  let initialChannel;
  let proof;
  let runtimes: Runtime[];
  let startBlock: number;
  let web3: any;
  before(async () => {
    runtimes = await Promise.all(
      accounts.slice(0, 2).map(
        (account) => TestUtils.getRuntime(account, null, { useIdentity }),
      ),
    );
    [{
      activeIdentity: identity0, executor, payments: payments0, web3,
    }, {
      activeIdentity: identity1, payments: payments1,
    }] = runtimes;

    // keep current block as starting point for `loadChannelFromBlockchain`
    startBlock = await runtimes[0].web3.eth.getBlockNumber();

    const channelManager = await executor.createContract(
      'RaidenMicroTransferChannels',
      [500, []],
      { from: identity0, gas: 3000000 },
    );
    payments0.setChannelManager(channelManager.options.address);
    payments1.setChannelManager(channelManager.options.address);
  });

  it('should open a new channel to a other account', async () => {
    initialChannel = await payments0.openChannel(identity0, identity1, 5);
    payments1.setChannel(initialChannel);
  });

  it('should reload a channel to an other account, when loading from blockchain', async () => {
    const channel = await payments0.loadChannelFromBlockchain(identity0, identity1, startBlock);
    expect(channel.block).to.equal(initialChannel.block);
  });

  it('should sign a new payment from the target', async () => {
    proof = await payments0.incrementBalanceAndSign(1);
    payments0.confirmPayment(proof);
    payments1.channel.proof = proof;
    expect(proof.balance.eq(1));
  });

  it('should top up a channel with new eves', async () => {
    await payments0.topUpChannel(10);
    const info = await payments0.getChannelInfo();
    expect(info.deposit.eq(new BigNumber(15))).to.be.true;
  });

  it.skip('[re-enable after CORE-1157] should close a channel cooperative from the receiver side', async () => {
    const closingSig = await payments1.getClosingSig(identity1);

    // store balance before closing
    const balanceReceiverBefore = new BigNumber(
      await web3.eth.getBalance(runtimes[1].underlyingAccount),
    );
    await payments1.closeChannel(closingSig);

    const result = await payments1.getChannelInfo();
    expect(result).to.have.all.keys('state', 'block', 'deposit', 'withdrawn');
    expect(result.state).to.be.equal('settled');
    expect(result.deposit.eq(new BigNumber(0))).to.be.true;

    const balanceReceiverAfter = new BigNumber(
      await web3.eth.getBalance(runtimes[1].underlyingAccount),
    );
    expect(balanceReceiverAfter.eq(balanceReceiverBefore.add(1)));
  });

  it('should close a channel cooperative from the sender side', async () => {
    initialChannel = await payments0.openChannel(identity0, identity1, 5);
    payments1.setChannel(initialChannel);
    proof = await payments0.incrementBalanceAndSign(1);
    payments0.confirmPayment(proof);
    payments1.channel.proof = proof;
    const closingSig = await payments1.getClosingSig(identity1);

    // store balance before closing
    const balanceReceiverBefore = new BigNumber(
      await web3.eth.getBalance(runtimes[1].underlyingAccount),
    );

    await payments0.closeChannel(closingSig);

    const result = await payments0.getChannelInfo();
    expect(result).to.have.all.keys('state', 'block', 'deposit', 'withdrawn');
    expect(result.state).to.be.equal('settled');
    expect(result.deposit.eq(new BigNumber(0))).to.be.true;

    const balanceReceiverAfter = new BigNumber(
      await web3.eth.getBalance(runtimes[1].underlyingAccount),
    );
    expect(balanceReceiverAfter.eq(balanceReceiverBefore.add(1)));
  });

  it.skip('should close a channel un-cooperative from the receiver side', async () => {
    const closingSig = await payments1.getClosingSig(identity1);
    await payments1.closeChannel(closingSig);
  });
});
