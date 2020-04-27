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
import { cloneDeep } from 'lodash';

import { createDefaultRuntime, getRuntimeForIdentity } from './runtime';
import { TestUtils } from './test/test-utils';
import {
  accountMap, useIdentity, identities, dataKeys,
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
        encryptionKey: '6d3bcfb8ff2fde2f10fcd79574435b32aee0268c1e2103d2132a0ac18511e11e',
        identity: '0x617Cbb36a12ab15e83Cca471D4008E55A411c6aD',
        mnemonic: 'retire plunge spring current album shiver network bicycle equal burden able code',
        password: 'Evan1234',
        privateKey: '23358a2c345baefdc1144258c3e23ab6619ee14ca67ce1244e82176ac467d943',
      },
      // use an mnemonic with identity address encryption salting
      {
        accountId: '0xb6D7f0C3A88dDfF426cdcF6cE1666978844b9ba1',
        encryptionKey: 'fc543dda9394705bcfbe7e3c9abe77f06a5952e938964d3150bae9ea07400ea3',
        identity: '0x82c436230BfBE4D9F88d20d2E1F5C697E9dC4091',
        mnemonic: 'window ivory shoe toward mammal link lecture cliff shadow holiday force view',
        password: 'Test1234',
        privateKey: '5e03d038960aab7e80f80bef7706d562e1133a4e7c44ee3483e9576442e7f2f8',
      },
    ];
  } else {
    // use an mnemonic for an old account
    mnemonicAndPasswords = [
      {
        accountId: '0x1cf81039Cd6dFbeD999586Ac3B21963C0275E6D7',
        encryptionKey: 'b36f9f9e598deaac8bf7219a283c798e3000c526bb2b3fae9e8219e7fdace362',
        identity: '0x1cf81039Cd6dFbeD999586Ac3B21963C0275E6D7',
        mnemonic: 'annual lyrics orbit slight object space jeans ethics broccoli umbrella entry couch',
        password: 'Test1234',
        privateKey: 'dfb9d2c5be6e7123fa1e1c9fe82becdb0adfb3561b18e4bc79e4cfa549b8ca46',
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

  it('should create a new runtime and parse accountid and password in keyConfig', async () => {
    for (const loginData of mnemonicAndPasswords) {
      const tmpRuntimeConfig = cloneDeep(runtimeConfig);
      tmpRuntimeConfig.accountMap = {
        [loginData.accountId]: loginData.privateKey,
      };
      tmpRuntimeConfig.keyConfig = {
        [loginData.accountId]: loginData.password,
      };
      const runtime = await createDefaultRuntime(web3, dfs, tmpRuntimeConfig);
      const sha3Account = web3.utils.soliditySha3(loginData.accountId);
      const sha9Account = web3.utils.soliditySha3(sha3Account, sha3Account);
      expect(runtime).to.be.ok;
      expect(runtime.profile).to.be.not.null;
      expect(runtime.activeIdentity).to.be.eq(
        useIdentity ? loginData.identity : loginData.accountId,
      );
      expect(runtime.runtimeConfig.keyConfig[sha3Account]).to.be.eq(loginData.encryptionKey);
      expect(runtime.runtimeConfig.keyConfig[sha9Account]).to.be.eq(loginData.encryptionKey);
    }
  });

  it('should create a new and valid runtime with a mnemonic and a password', async () => {
    for (const loginData of mnemonicAndPasswords) {
      const runtime = await createDefaultRuntime(web3, dfs, {
        mnemonic: loginData.mnemonic,
        password: loginData.password,
        useIdentity,
      });
      const sha3Account = web3.utils.soliditySha3(loginData.accountId);
      const sha9Account = web3.utils.soliditySha3(sha3Account, sha3Account);
      expect(runtime).to.be.ok;
      expect(runtime.profile).to.be.not.null;
      expect(runtime.activeIdentity).to.be.eq(
        useIdentity ? loginData.identity : loginData.accountId,
      );
      expect(runtime.runtimeConfig.accountMap[loginData.accountId]).to.be.eq(loginData.privateKey);
      expect(runtime.runtimeConfig.keyConfig[sha3Account]).to.be.eq(loginData.encryptionKey);
      expect(runtime.runtimeConfig.keyConfig[sha9Account]).to.be.eq(loginData.encryptionKey);
    }
  });


  it('should create a new and valid runtime with a mnemonic and a password and merge with given accounts', async () => {
    const expectedKeyNum = useIdentity ? 18 : 17;
    for (const loginData of mnemonicAndPasswords) {
      const runtime = await createDefaultRuntime(web3, dfs, {
        mnemonic: loginData.mnemonic,
        password: loginData.password,
        ...runtimeConfig,
        useIdentity,
      });
      const sha3Account = web3.utils.soliditySha3(loginData.accountId);
      const sha9Account = web3.utils.soliditySha3(sha3Account, sha3Account);
      expect(runtime).to.be.ok;
      expect(runtime.profile).to.be.not.null;
      expect(runtime.activeIdentity).to.be.eq(
        useIdentity ? loginData.identity : loginData.accountId,
      );
      expect(runtime.runtimeConfig.accountMap[loginData.accountId]).to.be.eq(loginData.privateKey);
      expect(runtime.runtimeConfig.keyConfig[sha3Account]).to.be.eq(loginData.encryptionKey);
      expect(runtime.runtimeConfig.keyConfig[sha9Account]).to.be.eq(loginData.encryptionKey);
      expect(Object.keys(runtime.keyProvider.keys).length).to.eq(expectedKeyNum);
    }
  });

  it('should throw an error by passing a invalid password', async () => {
    const runtimePromise = createDefaultRuntime(web3, dfs, {
      mnemonic: mnemonicAndPasswords[0].mnemonic,
      password: 'this is a wrong password',
      ...runtimeConfig,
      useIdentity,
    });
    await expect(runtimePromise).to.be.rejectedWith(
      `incorrect password for ${mnemonicAndPasswords[0].accountId} passed to keyConfig`,
    );
  });

  it('use fallback encryptionKey salting for non initialized identities', async () => {
    const runtimePromise = createDefaultRuntime(web3, dfs, {
      mnemonic: 'annual lyrics orbit slight object space jeans ethics broccoli umbrella entry couch',
      accountMap: { },
    });
    await expect(runtimePromise).to.be.rejected;
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
