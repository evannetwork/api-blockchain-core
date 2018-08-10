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

import { KeyProvider } from '@evan.network/dbcp';

import { accounts } from './test/accounts';
import { config } from './config';
import { Ipld } from './dfs/ipld';
import { InvitationMail, Onboarding } from './onboarding';
import { Mailbox } from './mailbox';
import { Profile } from './profile/profile';
import { TestUtils } from './test/test-utils';

describe('Onboarding helper', function() {
  this.timeout(600000);
  let ipfs;
  let eventHub;
  let mailbox: Mailbox;
  let nameResolver;
  let onboarding: Onboarding;
  let web3;

  before(async () => {
    web3 = TestUtils.getWeb3();
    ipfs = await TestUtils.getIpfs();
    const keyProvider = await TestUtils.getKeyProvider();
    const ipld = await TestUtils.getIpld(ipfs, keyProvider);
    const profile = await TestUtils.getProfile(web3, ipfs, ipld);
    await profile.loadForAccount(accounts[0]);
    keyProvider.init(profile);
    keyProvider.currentAccount = accounts[0];

    nameResolver = await TestUtils.getNameResolver(web3);
    mailbox = new Mailbox({
      mailboxOwner: accounts[0],
      nameResolver: await TestUtils.getNameResolver(web3),
      ipfs,
      contractLoader: await TestUtils.getContractLoader(web3),
      cryptoProvider: TestUtils.getCryptoProvider(),
      keyProvider,
      defaultCryptoAlgo: 'aes',
    });
    const executor = await TestUtils.getExecutor(web3);
    onboarding = new Onboarding({
      mailbox,
      smartAgentId: config.smartAgents.onboarding.accountId,
      executor,
    });
  });

  after(async () => {
    web3.currentProvider.connection.close();
    await ipfs.stop();
  });

  it('should be able to send an invitation via smart agent', async () => {
    await onboarding.sendInvitation({
      fromAlias: 'example inviter',
      to: 'example invitee <example.invitee@evan.network>',
      lang: 'en',
      subject: 'evan.network Onboarding Invitation',
      body: 'I\'d like to welcome you on board.',
    }, web3.utils.toWei('1'));
  });
});
