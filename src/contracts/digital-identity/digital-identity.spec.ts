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
import { config } from '../../config';
import { TestUtils } from '../../test/test-utils';
import {
  ContainerConfig,
} from './container';
import {
  DigitalIdentity,
  DigitalIdentityConfig,
  DigitalIdentityOptions,
  EntryType,
  VerificationEntry,
} from './digital-identity';

use(chaiAsPromised);


const ownedDomain = 'identitytest.fifs.registrar.test.evan';

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
      rightsAndRoles: await TestUtils.getRightsAndRoles(web3),
      verifications: await TestUtils.getVerifications(web3, dfs),
      web3,
    };
    runtime.executor.eventHub = await TestUtils.getEventHub(web3);
    defaultConfig = {
      accountId: accounts[0],
      description,
      containerConfig: {
        accountId: accounts[0],
        mailTemplates: {
          share: {},
          sendTemplate: {},
        },
      },
    };
    // create factory for test
    const factory = await executor.createContract('IndexContractFactory', [], { from: accounts[0], gas: 3e6 });
    defaultConfig.factoryAddress = factory.options.address;
    console.log(`using identity factory: ${defaultConfig.factoryAddress}`);
  });

  after(async () => {
    await dfs.stop();
  });

  it('can can create new contracts', async () => {
    const identity = await DigitalIdentity.create(runtime, defaultConfig);
    expect(identity.contract.options.address).to.match(/0x[0-9a-f]{40}/i);
  });

  describe('when performing set/get operations', () => {
    describe('when performing basic set/get operations', () => {
      it('can add entries to index', async () => {
        const identity = await DigitalIdentity.create(runtime, defaultConfig);
        await identity.setEntry('sample', TestUtils.getRandomBytes32(), EntryType.Hash);
      });

      it('can get entries from index', async () => {
        const identity = await DigitalIdentity.create(runtime, defaultConfig);
        const value = TestUtils.getRandomBytes32();
        await identity.setEntry('sample', value, EntryType.Hash);
        const result = await identity.getEntry('sample');
        expect(result.value).to.eq(value);
      });

      it('can set and get bytes32 values', async () => {
        const identity = await DigitalIdentity.create(runtime, defaultConfig);
        const value = TestUtils.getRandomBytes32();
        await identity.setEntry('sample', value, EntryType.Hash);
        const result = await identity.getEntry('sample');
        expect(result.value).to.eq(value);
        expect(result.entryType).to.eq(EntryType.Hash);
      });

      it('can set and get address values', async () => {
        const identity = await DigitalIdentity.create(runtime, defaultConfig);
        const value = TestUtils.getRandomAddress();
        await identity.setEntry('sample', value, EntryType.GenericContract);
        const result = await identity.getEntry('sample');
        expect(result.value).to.eq(value);
        expect(result.entryType).to.eq(EntryType.GenericContract);
      });

      it('can get multiple entries from index', async () => {
        const samples = {};
        for (let i = 0; i < 3; i++) {
          samples['sample ' + i.toString().padStart(2, '0')] = {
            value: TestUtils.getRandomBytes32().replace(/.{4}$/, i.toString().padStart(4, '0')),
            entryType: EntryType.Hash,
          }
        };
        const identity = await DigitalIdentity.create(runtime, defaultConfig);
        await identity.setEntries(samples);
        const result = await identity.getEntries();
        for (let key of Object.keys(samples)) {
          expect(result[key].value).to.eq(samples[key].value);
          expect(result[key].entryType).to.eq(samples[key].entryType);
        }
      });
    });

    describe('when paging entries', () => {
      const checkIdentity = async (identity, samples) => {
        const result = await identity.getEntries();
        for (let key of Object.keys(samples)) {
          expect(result[key].value).to.eq(samples[key].value);
          expect(result[key].entryType).to.eq(samples[key].entryType);
        }
      };
      const createIdentityWithEntries = async (entryCount): Promise<any> => {
        const samples = {};
        for (let i = 0; i < entryCount; i++) {
          samples['sample ' + i.toString().padStart(2, '0')] = {
            value: TestUtils.getRandomBytes32().replace(/.{4}$/, i.toString().padStart(4, '0')),
            entryType: EntryType.Hash,
          }
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

    describe('when working with linked indices', () => {
      it('can link two identities and fetch properties via entry path navigtion', async () => {
        const car = await DigitalIdentity.create(runtime, defaultConfig);
        const tire = await DigitalIdentity.create(runtime, defaultConfig);

        const container = TestUtils.getRandomAddress();
        await tire.setEntry('metadata', container, EntryType.GenericContract);
        await car.setEntry('tire', tire.contract.options.address, EntryType.IndexContract);

        const otherIdentity = await car.getEntry('tire');
        await otherIdentity.value.ensureContract();
        expect(otherIdentity.raw.value).to.eq(`0x000000000000000000000000${tire.contract.options.address.substr(2).toLowerCase()}`);
        expect(otherIdentity.entryType).to.eq(EntryType.IndexContract);
        expect(otherIdentity.value.contract.options.address).to.eq(tire.contract.options.address);

        const entry = await car.getEntry('tire/metadata');
        expect(entry.value).to.eq(container);
        expect(entry.entryType).to.eq(EntryType.GenericContract);
      });

      it('can link three identities and fetch properties via entry path navigtion', async () => {
        const car = await DigitalIdentity.create(runtime, defaultConfig);
        const tire = await DigitalIdentity.create(runtime, defaultConfig);
        const screw = await DigitalIdentity.create(runtime, defaultConfig);

        const container = TestUtils.getRandomAddress();
        await screw.setEntry('metadata', container, EntryType.GenericContract);
        await car.setEntry('tire', tire.contract.options.address, EntryType.IndexContract);
        await tire.setEntry('screw', screw.contract.options.address, EntryType.IndexContract);

        const otherIdentity1 = await car.getEntry('tire');
        await otherIdentity1.value.ensureContract();
        expect(otherIdentity1.raw.value).to.eq(`0x000000000000000000000000${tire.contract.options.address.substr(2).toLowerCase()}`);
        expect(otherIdentity1.entryType).to.eq(EntryType.IndexContract);
        expect(otherIdentity1.value.contract.options.address).to.eq(tire.contract.options.address);

        const otherIdentity2 = await car.getEntry('tire/screw');
        await otherIdentity2.value.ensureContract();
        expect(otherIdentity2.raw.value).to.eq(`0x000000000000000000000000${screw.contract.options.address.substr(2).toLowerCase()}`);
        expect(otherIdentity2.entryType).to.eq(EntryType.IndexContract);
        expect(otherIdentity2.value.contract.options.address).to.eq(screw.contract.options.address);

        const entry = await car.getEntry('tire/screw/metadata');
        expect(entry.value).to.eq(container);
        expect(entry.entryType).to.eq(EntryType.GenericContract);
      });
    });
  });

  describe('when working with verifications', () => {
    it('can set verifications to identity', async () => {
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

  describe('when working with ENS', () => {
    let ens;
    before(async () => {
      // get address for tests
      ens = runtime.contractLoader.loadContract('AbstractENS', config.nameResolver.ensAddress);
      const domainOwner = await executor.executeContractCall(
        ens, 'owner', runtime.nameResolver.namehash(ownedDomain));
      if (domainOwner === '0x0000000000000000000000000000000000000000') {
        await runtime.nameResolver.claimAddress(ownedDomain, accounts[0]);
      }
    });

    it('can save contracts to ENS', async () => {
      const randomName = Math.floor(Math.random() * 1e12).toString(36);
      const address = `${randomName}.${ownedDomain}`;
      const identity = await DigitalIdentity.create(runtime, { ...defaultConfig, address });
      expect(identity.contract.options.address).to.match(/0x[0-9a-f]{40}/i);
      expect(identity.contract.options.address).to.eq(
        await runtime.nameResolver.getAddress(address));
    });

    it('can load indicdes from ENS', async () => {
      const randomName = Math.floor(Math.random() * 1e12).toString(36);
      const address = `${randomName}.${ownedDomain}`;
      const identity = await DigitalIdentity.create(runtime, { ...defaultConfig, address });

      const loadedIdentity = new DigitalIdentity(runtime, { ...defaultConfig, address });
      await loadedIdentity.ensureContract();
      expect(loadedIdentity.contract.options.address).to.match(/0x[0-9a-f]{40}/i);
      expect(loadedIdentity.contract.options.address).to.eq(
        await runtime.nameResolver.getAddress(address));
    });
  });
});
