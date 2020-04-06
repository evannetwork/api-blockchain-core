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
import * as chaiAsPromised from 'chai-as-promised';

import { createDefaultRuntime, getRuntimeForIdentity } from './runtime';
import { TestUtils } from './test/test-utils';
import {
  accountMap, accounts, useIdentity, identities, dataKeys,
} from './test/accounts';

use(chaiAsPromised);

describe('Runtime', function test() {
  this.timeout(600000);

  let web3;
  let dfs;
  let runtimeConfig;

  before(async () => {
    web3 = TestUtils.getWeb3();
    dfs = await TestUtils.getIpfs();

    runtimeConfig = {
      accountMap,
      keyConfig: dataKeys,
      useIdentity,
      // identity: identities[1],
    };
  });

  it('should create a new runtime for a given config', async () => {
    const runtime = await createDefaultRuntime(web3, dfs, runtimeConfig);
    expect(runtime).to.be.ok;
  });

  it('should switch the runtime for identity', async () => {
    const runtime = await createDefaultRuntime(web3, dfs, runtimeConfig);
    await runtime.profile.loadForAccount(runtime.profile.treeLabels.addressBook);
    await runtime.profile.getIdentityAccessList();
    await runtime.profile.setIdentityAccess(
      identities[1],
      dataKeys[web3.utils.sha3(identities[1])],
    );

    await runtime.profile.storeForAccount(runtime.profile.treeLabels.addressBook);
    await runtime.profile.loadForAccount(runtime.profile.treeLabels.addressBook);

    const switchedRuntime = await getRuntimeForIdentity(runtime, identities[1]);
    expect(runtime).to.be.ok;
    expect(switchedRuntime).to.be.ok;
    expect(switchedRuntime.profile).to.exist;
  });

  it('should create a new runtime and parse accountid and password in keyConfig', async () => {
    const expectedKeyNum = useIdentity ? 16 : 3;
    const tmpRuntimeConfig = runtimeConfig;
    tmpRuntimeConfig.keyConfig[accounts[0]] = 'Test1234';
    const runtime = await createDefaultRuntime(web3, dfs, runtimeConfig);
    expect(runtime).to.be.ok;
    expect(Object.keys(runtime.keyProvider.keys).length).to.eq(expectedKeyNum);
  });

  it('should create a new and valid runtime with a mnemonic and a password', async () => {
    const runtime = await createDefaultRuntime(web3, dfs, {
      mnemonic: 'annual lyrics orbit slight object space jeans ethics broccoli umbrella entry couch',
      password: 'Test1234',
    });
    expect(runtime).to.be.ok;
    expect(Object.keys(runtime.keyProvider.keys).length).to.eq(2);
  });

  it('should create a new and valid runtime with a mnemonic and a password and merge with given accounts', async () => {
    const expectedKeyNum = useIdentity ? 18 : 5;
    const tmpRuntimeConfig = runtimeConfig;
    tmpRuntimeConfig.keyConfig[accounts[0]] = 'Test1234';
    tmpRuntimeConfig.mnemonic = 'annual lyrics orbit slight object space jeans ethics broccoli umbrella entry couch';
    tmpRuntimeConfig.password = 'Test1234';
    const runtime = await createDefaultRuntime(web3, dfs, tmpRuntimeConfig);
    expect(runtime).to.be.ok;
    expect(Object.keys(runtime.keyProvider.keys).length).to.eq(expectedKeyNum);
  });

  it('should NOT create a new and valid runtime with only passing mnemonic and empty account map', async () => {
    const runtimePromise = createDefaultRuntime(web3, dfs, {
      mnemonic: 'annual lyrics orbit slight object space jeans ethics broccoli umbrella entry couch',
      accountMap: { },
    });
    await expect(runtimePromise).to.be.rejected;
  });

  it('should NOT create a new and valid runtime with account map is invalid', async () => {
    const runtimePromise = createDefaultRuntime(web3, dfs, {
      accountMap: { },
    });
    await expect(runtimePromise).to.be.rejectedWith('accountMap invalid');
  });
});
