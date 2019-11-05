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


import { accounts } from './test/accounts';
import { configTestcore as config } from './config-testcore';
import { KeyExchange } from './keyExchange';
import { Onboarding } from './onboarding';
import { Mailbox } from './mailbox';
import { TestUtils } from './test/test-utils';

describe('Onboarding helper', function() {
  this.timeout(600000);
  let ipfs;
  let mailbox: Mailbox;
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

    const keyExchangeOptions = {
      mailbox,
      cryptoProvider:  TestUtils.getCryptoProvider(),
      defaultCryptoAlgo: 'aes',
      account: accounts[0],
      keyProvider: TestUtils.getKeyProvider(),
    };
    const keyExchange = new KeyExchange(keyExchangeOptions);

    const commKey = await keyExchange.generateCommKey();
    await profile.addContactKey(config.smartAgents.onboarding.accountId, 'commKey', commKey);

  });

  it('should create a new random mnemonic', () => {
    const mnemonic = Onboarding.createMnemonic();
    expect(mnemonic).to.be.an('string');
  })

  it.skip('should create a new profile with a new mnemonic on the testcore', async () => {
    const mnemonic = Onboarding.createMnemonic();
    await Onboarding.createNewProfile(mnemonic, 'Test1234');
    expect(mnemonic).to.be.an('string');
  })

  it.skip('should create a new profile with a new mnemonic on the core', async () => {
    const mnemonic = Onboarding.createMnemonic();
    await Onboarding.createNewProfile(mnemonic, 'Test1234', 'core');
    expect(mnemonic).to.be.an('string');
  })
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
