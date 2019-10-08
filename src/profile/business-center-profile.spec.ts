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

import {
  NameResolver,
  SignerInternal,
  KeyProvider
} from '@evan.network/dbcp';

import { accounts } from '../test/accounts';
import { accountMap } from '../test/accounts';
import { Aes } from '../encryption/aes';
import { BusinessCenterProfile } from './business-center-profile';
import { configTestcore as config } from '../config-testcore';
import { CryptoProvider } from '../encryption/crypto-provider';
import { Ipld } from '../dfs/ipld';
import { TestUtils } from '../test/test-utils';


describe('BusinessCenterProfile helper', function() {
  this.timeout(600000);
  let ipld: Ipld;
  let nameResolver: NameResolver;
  let ensName;
  let businessCenterDomain;
  let web3;
  let cryptoProvider = TestUtils.getCryptoProvider();
  const sampleProfile = {
    alias: 'fnord',
    contact: 'fnord@contoso.com',
  };

  before(async () => {
    web3 = TestUtils.getWeb3();
    ipld = await TestUtils.getIpld();

    nameResolver = await TestUtils.getNameResolver(web3);
    ensName = nameResolver.getDomainName(config.nameResolver.domains.profile);
    businessCenterDomain = nameResolver.getDomainName(config.nameResolver.domains.businessCenter);
    nameResolver = await TestUtils.getNameResolver(web3);
    const loader = await TestUtils.getContractLoader(web3);
    const bcAddress = await nameResolver.getAddress(businessCenterDomain);
    const businessCenter = loader.loadContract('BusinessCenter', bcAddress);
    const executor = await TestUtils.getExecutor(web3);
    let isMember = await executor.executeContractCall(
      businessCenter, 'isMember', accounts[0], { from: accounts[0], gas: 3000000, });
    if (!isMember) {
      await executor.executeContractTransaction(
        businessCenter, 'join', { from: accounts[0], autoGas: 1.1, });
    }
  });

  it('should be able to set and load a profile for a given user in a business center', async () => {
    // use own key for test
    (<KeyProvider>ipld.keyProvider).keys[nameResolver.soliditySha3(businessCenterDomain)] =
      (<KeyProvider>ipld.keyProvider).keys[nameResolver.soliditySha3(accounts[0])];
    // create profile
    const profile = new BusinessCenterProfile({
      ipld,
      nameResolver,
      defaultCryptoAlgo: 'aes',
      bcAddress: businessCenterDomain,
      cryptoProvider: TestUtils.getCryptoProvider()
    });
    await profile.setContactCard(JSON.parse(JSON.stringify(sampleProfile)));

    // store
    const from = Object.keys(accountMap)[0];
    await profile.storeForBusinessCenter(businessCenterDomain, from);

    // load
    const newProfile = new BusinessCenterProfile({
      ipld,
      nameResolver,
      defaultCryptoAlgo: 'aes',
      bcAddress: businessCenterDomain,
      cryptoProvider: TestUtils.getCryptoProvider()
    });
    await newProfile.loadForBusinessCenter(businessCenterDomain, from);

    // test contacts
    const loadedProfile = await newProfile.getContactCard();
    Ipld.purgeCryptoInfo(loadedProfile);
    expect(loadedProfile).to.deep.eq(sampleProfile);
  });
});
