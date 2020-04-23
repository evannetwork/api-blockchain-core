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
  let mnemonicAndPasswords;

  if (useIdentity) {
    mnemonicAndPasswords = [
      // use an mnemonic with accountId encryption salting
      {
        accountId: '0xE88eC34914f423761073458DcA3F16d6d7E8c6Cf',
        identity: '0x617Cbb36a12ab15e83Cca471D4008E55A411c6aD',
        mnemonic: 'retire plunge spring current album shiver network bicycle equal burden able code',
        password: 'Test1234',
      },
      // use an mnemonic with identity address encryption salting
      {
        accountId: '0xb6D7f0C3A88dDfF426cdcF6cE1666978844b9ba1',
        identity: '0x82c436230BfBE4D9F88d20d2E1F5C697E9dC4091',
        mnemonic: 'window ivory shoe toward mammal link lecture cliff shadow holiday force view',
        password: 'Test1234',
      },
    ];
  } else {
    // use an mnemonic for an old account
    mnemonicAndPasswords = [
      {
        mnemonic: 'annual lyrics orbit slight object space jeans ethics broccoli umbrella entry couch',
        password: 'Test1234',
        accountId: '0x1cf81039Cd6dFbeD999586Ac3B21963C0275E6D7',
        identity: '0x1cf81039Cd6dFbeD999586Ac3B21963C0275E6D7',
      },
    ];
  }

  before(async () => {
    web3 = TestUtils.getWeb3();
    dfs = await TestUtils.getIpfs();

    runtimeConfig = {
      accountMap,
      keyConfig: dataKeys,
      useIdentity,
    };
  });

  it('should create a new runtime for a given config', async () => {
    const runtime = await createDefaultRuntime(web3, dfs, runtimeConfig);
    expect(runtime).to.be.ok;
    expect(runtime.profile).to.be.not.null;
  });

  it('should switch the runtime for identity', async () => {
    const runtime = await createDefaultRuntime(web3, dfs, {
      ...runtimeConfig,
      identity: identities[0],
    });
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
    const tempRuntime = await TestUtils.getRuntime(identities[1], null, { useIdentity });
    expect(switchedRuntime.activeIdentity).to.be.eq(tempRuntime.activeIdentity);
    expect(switchedRuntime.profile).to.be.not.null;
  });

  it('should create a new runtime and parse accountid and password in accountMap', async () => {
    for (const loginData of mnemonicAndPasswords) {
      const tmpRuntimeConfig = JSON.parse(JSON.stringify(runtimeConfig));
      tmpRuntimeConfig.accountMap = {
        [loginData.account]: loginData.password,
      };
      const runtime = await createDefaultRuntime(web3, dfs, tmpRuntimeConfig);
      expect(runtime).to.be.ok;
      expect(runtime.profile).to.be.not.null;
      expect(runtime.profile.activeAccount).to.be
        .eq(useIdentity ? loginData.identity : loginData.account);
      expect(runtime.activeIdentity).to.be.eq(identities[0]);
    }
  });

  it('should create a new runtime and parse accountid and password in keyConfig', async () => {
    for (const loginData of mnemonicAndPasswords) {
      const tmpRuntimeConfig = JSON.parse(JSON.stringify(runtimeConfig));
      tmpRuntimeConfig.keyConfig = {
        [loginData.account]: loginData.password,
      };
      const runtime = await createDefaultRuntime(web3, dfs, tmpRuntimeConfig);
      expect(runtime).to.be.ok;
      expect(runtime.profile).to.be.not.null;
      expect(runtime.profile.activeAccount).to.be
        .eq(useIdentity ? loginData.identity : loginData.account);
      expect(runtime.activeIdentity).to.be.eq(identities[0]);
    }
  });

  it('should create a new and valid runtime with a mnemonic and a password', async () => {
    for (const loginData of mnemonicAndPasswords) {
      const runtime = await createDefaultRuntime(web3, dfs, {
        mnemonic: loginData.mnemonic,
        password: loginData.password,
        useIdentity,
      });
      expect(runtime).to.be.ok;
      expect(runtime.profile).to.be.not.null;
      expect(runtime.profile.activeAccount).to.be
        .eq(useIdentity ? loginData.identity : loginData.account);
    }
  });

  it('should create a new and valid runtime with a mnemonic and a password and merge with given accounts', async () => {
    for (const loginData of mnemonicAndPasswords) {
      const expectedKeyNum = useIdentity ? 18 : 17;
      const tmpRuntimeConfig = runtimeConfig;
      tmpRuntimeConfig.mnemonic = loginData.mnemonic;
      tmpRuntimeConfig.password = loginData.password;
      const runtime = await createDefaultRuntime(web3, dfs, tmpRuntimeConfig);
      expect(runtime).to.be.ok;
      expect(runtime.profile).to.be.not.null;
      expect(runtime.profile.activeAccount).to.be
        .eq(useIdentity ? loginData.identity : loginData.account);
      expect(Object.keys(runtime.keyProvider.keys).length).to.eq(expectedKeyNum);
    }
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
