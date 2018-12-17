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


describe('Payment Channels', function() {
  this.timeout(600000);
  let nameResolver;
  let payments;
  let executor;
  let web3;

  before(async () => {
    web3 = TestUtils.getWeb3();
    executor = await TestUtils.getExecutor(web3);
    payments = await TestUtils.getPayments(web3, accounts[0]);
    
  });


  it('should create a new channel manager', async () => {
    const channelManager = await executor.createContract(
      'RaidenMicroTransferChannels',
      [500, []],
      { from: accounts[0], gas: 3000000, }
    );
    payments.setChannelManager(channelManager.options.address);
    console.dir(channelManager.options.address);
  });

  it('should open a new channel to a other account', async () => {

    const channel = await payments.openChannel(accounts[0], accounts[1], 5);
    console.dir(channel);
  });
});