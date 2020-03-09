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

import { TestUtils } from '../test/test-utils';
import { accounts, useIdentity } from '../test/accounts';
import { configTestcore as config } from '../config-testcore';
import {
  BusinessCenterProfile,
  Ipld,
  KeyProvider,
  Runtime,
} from '../index';


describe('BusinessCenterProfile helper', function test() {
  this.timeout(600000);
  let businessCenterDomain;
  let runtime: Runtime;
  const sampleProfile = {
    alias: 'fnord',
    contact: 'fnord@contoso.com',
  };

  before(async () => {
    runtime = await TestUtils.getRuntime(accounts[0], null, { useIdentity });

    businessCenterDomain = runtime.nameResolver.getDomainName(
      config.nameResolver.domains.businessCenter,
    );
    const bcAddress = await runtime.nameResolver.getAddress(businessCenterDomain);
    const businessCenter = runtime.contractLoader.loadContract('BusinessCenter', bcAddress);
    const isMember = await runtime.executor.executeContractCall(
      businessCenter, 'isMember', runtime.activeIdentity,
    );
    if (!isMember) {
      await runtime.executor.executeContractTransaction(
        businessCenter, 'join', { from: runtime.activeIdentity, autoGas: 1.1 },
      );
    }
  });

  it('should be able to set and load a profile for a given user in a business center', async () => {
    // use own key for test
    const businessCenterKey = runtime.nameResolver.soliditySha3(businessCenterDomain);
    const identityKey = runtime.nameResolver.soliditySha3(runtime.activeIdentity);
    const keyProvider = runtime.ipld.keyProvider as KeyProvider;
    keyProvider.keys[businessCenterKey] = keyProvider.keys[identityKey];
    // create profile
    const profile = new BusinessCenterProfile({
      defaultCryptoAlgo: 'aes',
      bcAddress: businessCenterDomain,
      ...(runtime as any),
    });
    await profile.setContactCard(JSON.parse(JSON.stringify(sampleProfile)));

    // store
    const from = runtime.activeIdentity;
    await profile.storeForBusinessCenter(businessCenterDomain, from);

    // load
    const newProfile = new BusinessCenterProfile({
      defaultCryptoAlgo: 'aes',
      bcAddress: businessCenterDomain,
      ...(runtime as any),
    });
    await newProfile.loadForBusinessCenter(businessCenterDomain, from);

    // test contacts
    const loadedProfile = await newProfile.getContactCard();
    Ipld.purgeCryptoInfo(loadedProfile);
    expect(loadedProfile).to.deep.eq(sampleProfile);
  });
});
