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
import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import {
  Executor,
  Ipfs,
} from '@evan.network/dbcp';

import { accounts } from '../../test/accounts';
import { TestUtils } from '../../test/test-utils';
import {
  DigitalIdentity,
  DigitalIdentityConfig,
  DigitalIdentityOptions,
  VerificationEntry,
} from './digital-identity';

use(chaiAsPromised);


describe('DigitalIdentity (name pending)', function() {
  this.timeout(60000);
  let dfs: Ipfs;
  let defaultConfig: DigitalIdentityConfig;
  let executor: Executor;
  const description = {
    name: 'test identity',
    description: 'identity from test run',
    author: 'evan GmbH',
    version: '0.1.0',
    dbcpVersion: 2,
  };
  let runtime: DigitalIdentityOptions;

  before(async () => {
    dfs = await TestUtils.getIpfs();
    const web3 = await TestUtils.getWeb3();
    executor = await TestUtils.getExecutor(web3);
    runtime = {
      contractLoader: await TestUtils.getContractLoader(web3),
      dataContract: await TestUtils.getDataContract(web3, dfs),
      description: await TestUtils.getDescription(web3, dfs),
      dfs,
      executor,
      nameResolver: await TestUtils.getNameResolver(web3),
      verifications: await TestUtils.getVerifications(web3, dfs),
      web3,
    };
    runtime.executor.eventHub = await TestUtils.getEventHub(web3);
    defaultConfig = {
      accountId: accounts[0],
      description,
    };
    // create factory for test
    const factory = await executor.createContract('IndexContractFactory', [], { from: accounts[0], gas: 3e6 });
    defaultConfig.factoryAddress = factory.options.address;
    console.log(`factory: ${defaultConfig.factoryAddress}`);
  });

  after(async () => {
    await dfs.stop();
  });

  it('can can create new contracts', async () => {
    const identity = await DigitalIdentity.create(runtime, defaultConfig);
    expect(identity.contract.options.address).to.match(/0x[0-9a-f]{40}/i);
    const identityDescription = await identity.getDescription();
    expect(identityDescription).to.deep.eq(description);
  });

  describe('when performing basic set/get operations', () => {
    it('can add entries to index', async () => {
      const identity = await DigitalIdentity.create(runtime, defaultConfig);
      await identity.setEntry('sample', TestUtils.getRandomBytes32());
    });

    it('can get entries from index', async () => {
      const identity = await DigitalIdentity.create(runtime, defaultConfig);
      const value = TestUtils.getRandomBytes32();
      await identity.setEntry('sample', value);
      const result = await identity.getEntry('sample');
      expect(result.value).to.eq(value);
    });

    it('can set and get bytes32 values', async () => {
      const identity = await DigitalIdentity.create(runtime, defaultConfig);
      const value = TestUtils.getRandomBytes32();
      await identity.setEntry('sample', value);
      const result = await identity.getEntry('sample');
      expect(result.value).to.eq(value);
      expect(result.type).to.eq('bytes32');
    });

    it('can set and get address values', async () => {
      const identity = await DigitalIdentity.create(runtime, defaultConfig);
      const value = TestUtils.getRandomAddress();
      await identity.setEntry('sample', value);
      const result = await identity.getEntry('sample');
      expect(result.value).to.eq(value);
      expect(result.type).to.eq('address');
    });

    it('can get multiple entries from index', async () => {
      const samples = {};
      for (let i = 0; i < 3; i++) {
        samples['sample ' + i.toString().padStart(2, '0')] =
          TestUtils.getRandomBytes32().replace(/.{4}$/, i.toString().padStart(4, '0'));
      };
      const identity = await DigitalIdentity.create(runtime, defaultConfig);
      await identity.setEntries(samples);
      const result = await identity.getEntries();
      for (let key of Object.keys(samples)) {
        expect(result[key].value).to.eq(samples[key]);
      }
    });
  });

  describe('when paging entries', () => {
    const checkIdentity = async (identity, samples) => {
      const result = await identity.getEntries();
      for (let key of Object.keys(samples)) {
        expect(result[key].value).to.eq(samples[key]);
      }
    };
    const createIdentityWithEntries = async (entryCount): Promise<any> => {
      const samples = {};
      for (let i = 0; i < entryCount; i++) {
        samples['sample ' + i.toString().padStart(2, '0')] =
          TestUtils.getRandomBytes32().replace(/.{4}$/, i.toString().padStart(4, '0'));
      };
      const identity = await DigitalIdentity.create(runtime, defaultConfig);
      await identity.setEntries(samples);
      return { identity, samples };
    };

    it('can get handle result counts less than a page', async () => {
      const { identity, samples } = await createIdentityWithEntries(4);
      await checkIdentity(identity, samples);
    });

    it('can get handle result counts equal to a page', async () => {
      const { identity, samples } = await createIdentityWithEntries(10);
      await checkIdentity(identity, samples);
    });

    it('can get handle result counts more than a page', async () => {
      const { identity, samples } = await createIdentityWithEntries(14);
      await checkIdentity(identity, samples);
    });

    it('can get handle result counts with two pages', async () => {
      const { identity, samples } = await createIdentityWithEntries(20);
      await checkIdentity(identity, samples);
    });

    it('can get handle result counts with multiple pages', async () => {
      const { identity, samples } = await createIdentityWithEntries(24);
      await checkIdentity(identity, samples);
    });
  });

  describe('when working with verifications', async () => {
    it.only('can set verifications to identity', async () => {
      const identity = await DigitalIdentity.create(runtime, defaultConfig);
      const verifications: VerificationEntry[] = [...Array(3)].map((_, i) => (<VerificationEntry> {
        topic: `verifcation_${i}`,
      }));
      await identity.addVerifications(verifications);
      const verificationsResults = await identity.getVerifications();
      expect(verificationsResults.length).to.eq(3);
      // all validation lists should have at least 1 valid verification
      const allValid = verificationsResults.every(vs => vs.some(v => v.valid));
      expect(allValid).to.be.true;
    });
  });
});
