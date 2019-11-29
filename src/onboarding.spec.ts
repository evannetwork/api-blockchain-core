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
import chaiAsPromised = require('chai-as-promised');


import { accounts } from './test/accounts';
import { configTestcore as config } from './config-testcore';
import { KeyExchange } from './keyExchange';
import { Onboarding } from './onboarding';
import { Mailbox } from './mailbox';
import { TestUtils } from './test/test-utils';

use(chaiAsPromised);

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
    await profile.loadForAccount();
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

  it('should NOT create a new profile directly onchain if profile data is incorrect', async () => {
    const originRuntime = await TestUtils.getRuntime(accounts[0])
    const password = 'Test1234';
    const mnemonicNew = Onboarding.createMnemonic();
    const profilePromise = Onboarding.createNewProfile(originRuntime, mnemonicNew, password, {
      accountDetails: {
          profileType: 'dumb dumb',
          accountName: 'test account'
      }})
    await expect(profilePromise)
      .to.be.rejectedWith('The parameters passed are incorrect, profile properties need to be reconfigured');

  });

  it('should create a new random mnemonic', () => {
    const mnemonic = Onboarding.createMnemonic();
    expect(mnemonic).to.be.an('string');
  })

  it('should check if an account has enough amount of eves to create new profile', async () => {
    const originRuntime = await TestUtils.getRuntime(accounts[0])
    const password = 'Test1234';
    const mnemonicNew = Onboarding.createMnemonic();
    const runtimeConfig: any = await Onboarding.generateRuntimeConfig(mnemonicNew, password, web3);
    const balance = await web3.eth.getBalance(originRuntime.activeAccount)
    const minimumAmount = web3.utils.toWei('1.0097')

    expect(Number(balance)).to.be.gt(Number(minimumAmount))
  })

  it('should be able to create new profile if enough funds are available', async () => {
    const originRuntime = await TestUtils.getRuntime(accounts[0])
    const password = 'Test1234';
    const mnemonicNew = Onboarding.createMnemonic();
    const runtimeConfig: any = await Onboarding.generateRuntimeConfig(mnemonicNew, password, web3);
    const balance = await web3.eth.getBalance(originRuntime.activeAccount)
    const minimumAmount = web3.utils.toWei('1.0097')

    expect(Number(balance)).to.be.gt(Number(minimumAmount))

    const newProfile = await Onboarding.createNewProfile(originRuntime, mnemonicNew, password, {
      accountDetails: {
        profileType: 'company',
        accountName: 'test account'
      }});
    expect(newProfile).to.be.exist
    expect(newProfile.runtimeConfig).to.be.deep.eq(runtimeConfig)
  })

  it('should create a new profile from a different account', async () => {
    const originRuntime = await TestUtils.getRuntime(accounts[0])
    const password = 'Test1234';
    const mnemonicNew = Onboarding.createMnemonic();
    const runtimeConfig: any = await Onboarding.generateRuntimeConfig(mnemonicNew, password, web3);

    const newProfile = await Onboarding.createNewProfile(originRuntime, mnemonicNew, password, {
      accountDetails: {
        profileType: 'company',
        accountName: 'test account'
      }
    });

    expect(newProfile.runtimeConfig).to.be.deep.eq(runtimeConfig)
  })

  it.skip('should be able to send an invitation via smart agent', async () => {
    await onboarding.sendInvitation({
      fromAlias: 'example inviter',
      to: 'example invitee <example.invitee@evan.network>',
      lang: 'en',
      subject: 'evan.network Onboarding Invitation',
      body: 'I\'d like to welcome you on board.',
    }, web3.utils.toWei('1'));
  });
});
