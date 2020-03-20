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
import * as chaiAsPromised from 'chai-as-promised';
import { expect, use } from 'chai';
import { Ipfs } from '../../dfs/ipfs';
import { accounts, useIdentity, identities } from '../../test/accounts';
import { configTestcore as config } from '../../config-testcore';
import { Container } from './container';
import { TestUtils } from '../../test/test-utils';
import { VerificationsStatus } from '../../verifications/verifications';
import twinTemplate from './testfiles/twin-template';
import {
  DigitalTwin,
  DigitalTwinConfig,
  DigitalTwinEntryType,
  DigitalTwinOptions,
  DigitalTwinTemplate,
  DigitalTwinVerificationEntry,
} from './digital-twin';
import {
  nullAddress,
  nullBytes32,
  getSmartAgentAuthHeaders,
} from '../../common/utils';
import { Runtime } from '../../runtime';

import https = require('https');

const [identity0, identity1] = identities;

use(chaiAsPromised);

const ownedDomain = useIdentity ? 'twintestidentity.fifs.registrar.test.evan' : 'twintest.fifs.registrar.test.evan';

async function getRuntimeWithEnabledPinning(defaultRuntime: Runtime): Promise<Runtime> {
  const runtime = defaultRuntime;
  (runtime.dfs as any).disablePin = false;
  return runtime;
}

async function getPinnedFileHashes(): Promise<string[]> {
  const authHeaders = await getSmartAgentAuthHeaders(
    await TestUtils.getRuntime(identity0),
    Date.now().toString(),
  );
  const reqOptions = {
    hostname: 'payments.test.evan.network',
    path: '/api/smart-agents/ipfs-payments/hash/get/',
    headers: {
      authorization: authHeaders,
    },
  };
  const response = await new Promise<any>((resolve) => {
    https.get(reqOptions, (res) => {
      let rawData = '';
      let parsedData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        parsedData = JSON.parse(rawData);
        resolve(parsedData);
      });
    });
  });
  return Object.keys(response.hashes).map((ipfsHash) => Ipfs.ipfsHashToBytes32(ipfsHash));
}

describe('DigitalTwin', function test() {
  this.timeout(600000);
  let defaultConfig: DigitalTwinConfig;
  const description = {
    name: 'test twin',
    description: 'twin from test run',
    author: 'evan GmbH',
    version: '0.1.0',
    dbcpVersion: 2,
  };
  const containerDescription = {
    name: 'test container',
    description: 'container from test run',
    author: 'evan GmbH',
    version: '0.1.0',
    dbcpVersion: 2,
  };
  let twinOptions: DigitalTwinOptions;
  let runtime: Runtime;

  before(async () => {
    runtime = await TestUtils.getRuntime(accounts[0], null, { useIdentity });
    twinOptions = {
      ...(runtime as any),
    };

    defaultConfig = {
      accountId: identity0,
      containerConfig: {
        accountId: identity0,
        description: containerDescription,
      },
      description,
    };
    // create factory for test
    const factory = await runtime.executor.createContract('DigitalTwinFactory', [], { from: runtime.activeIdentity, gas: 3e6 });
    defaultConfig.factoryAddress = factory.options.address;
  });

  describe('working with twins', () => {
    it('can can create new contracts', async () => {
      const twin = await DigitalTwin.create(twinOptions, defaultConfig);
      expect(await twin.getContractAddress()).to.match(/0x[0-9a-f]{40}/i);
    });

    it('empty description.tags twins should have tag \'evan-digital-twin\' after creation', async () => {
      const customConfig = JSON.parse(JSON.stringify(defaultConfig));
      delete customConfig.description.tags;
      const twin = await DigitalTwin.create(twinOptions, customConfig);
      const twinDescription = await twin.getDescription();

      expect(twinDescription.tags).to.include('evan-digital-twin');
    });

    it('loading a twin without the tag \'evan-digital-twin\' should be invalid', async () => {
      const twin = await DigitalTwin.create(twinOptions, defaultConfig);
      const address = await twin.getContractAddress();
      const customDescription = JSON.parse(JSON.stringify(description));
      delete customDescription.tags;

      // reset filled tags
      await runtime.description.setDescription(address, { public: customDescription }, identity0);
      const validity = await DigitalTwin.getValidity(twinOptions, address);

      expect(validity.valid).to.be.false;
      expect(validity.error.message).to.include('doesn\'t match the specification');
    });

    it('loading a twin with the tag \'evan-digital-twin\' should be valid', async () => {
      const twin = await DigitalTwin.create(twinOptions, defaultConfig);
      const address = await twin.getContractAddress();
      const validity = await DigitalTwin.getValidity(twinOptions, address);

      expect(validity.valid).to.be.true;
      expect(validity.error).to.be.null;
    });

    it('can handle twin as favorites within my profile', async () => {
      const twin = await DigitalTwin.create(twinOptions, defaultConfig);
      let favorites;

      // check favorite adding
      await twin.addAsFavorite();
      favorites = await DigitalTwin.getFavorites(twinOptions);
      expect(favorites).to.include(await twin.getContractAddress());

      // check favorite remove
      await twin.removeFromFavorites();
      favorites = await DigitalTwin.getFavorites(twinOptions);
      expect(favorites).to.not.include(await twin.getContractAddress());
    });

    it('can pass empty containerConfig to twin constructor', () => {
      // create custom config without container config
      const customConfig = JSON.parse(JSON.stringify(defaultConfig));
      delete customConfig.containerConfig;

      const twin = new DigitalTwin(twinOptions, customConfig);
      expect((twin as any).config.containerConfig.accountId).to.be.eq(defaultConfig.accountId);
    });

    it('ensure that dbcpVersion 2 is used', async () => {
      // create custom config without dbcpVersion
      const customConfig = JSON.parse(JSON.stringify(defaultConfig));
      delete customConfig.description.dbcpVersion;

      const twin = await DigitalTwin.create(twinOptions, defaultConfig);
      const newDesc = await twin.getDescription();
      expect(newDesc.dbcpVersion).to.be.eq(2);
    });

    (useIdentity ? it : it.skip)('automatically creates a valid did document upon twin creation', async () => {
      const twin = await DigitalTwin.create(twinOptions, defaultConfig);
      const twinIdentity = (await twin.getDescription()).identity;
      const did = await runtime.did.convertIdentityToDid(twinIdentity);
      const ownerIdentity = await runtime.verifications
        .getIdentityForAccount(defaultConfig.accountId, true);
      const ownerDid = await runtime.did.convertIdentityToDid(ownerIdentity);
      const ownerDidDocument = await runtime.did.getDidDocument(ownerDid);

      const promise = runtime.did.getDidDocument(did);

      expect(ownerDidDocument).not.to.be.null;
      expect(promise).not.to.be.rejected;
      await expect(promise).to.eventually.have.property('id').that.equals(did);
      await expect(promise).to.eventually.have.property('controller').that.equals(ownerDid);
      await expect(promise).to.eventually.have.property('authentication').that.include(ownerDidDocument.authentication[0]);
    });

    it.skip('can deactivate a created twin (also checks for hashes, unskip this as soon as'
      + 'ticket is included & remove other test', async () => {
      const localRuntime = await getRuntimeWithEnabledPinning(runtime);

      const configWithTemplate = {
        ...defaultConfig,
        ...twinTemplate,
      };
      const twin = await DigitalTwin.create(localRuntime as DigitalTwinOptions, configWithTemplate);

      const twinIdentity = (await twin.getDescription()).identity;
      const twinContract = await localRuntime.contractLoader.loadContract(
        'DigitalTwin',
        await twin.getContractAddress(),
      );
      let twinDescriptionHash = await localRuntime.executor.executeContractCall(
        twinContract,
        'contractDescription',
      );

      // Create sharing
      const entries = await twin.getEntries();
      const randomSecret = `super secret; ${Math.random()}`;
      await localRuntime.sharing.addSharing(
        entries.plugin1.value.config.address,
        identity0,
        identity1,
        '*',
        0,
        randomSecret,
        null,
        false,
        null,
      );

      // Collect all pinned hashes to later test if they have been unpinned
      let pinnedHashes = [];
      let containerAddress;
      let containerContract;
      let containerEntries;
      let containerDescriptionHash;
      for (const entry of Object.keys(entries)) {
        if (entries[entry].entryType === DigitalTwinEntryType.Container) {
          containerAddress = entries[entry].value.config.address;
          containerContract = await localRuntime.contractLoader.loadContract('DataContract', containerAddress);
          containerDescriptionHash = await localRuntime.executor.executeContractCall(
            containerContract,
            'contractDescription',
          );
          containerEntries = await (twin as any).getContainerEntryHashes(
            containerContract,
            containerDescriptionHash,
          );
          pinnedHashes = pinnedHashes.concat(containerEntries);
          pinnedHashes.push(await localRuntime.executor.executeContractCall(containerContract, 'sharing'));
          pinnedHashes.push(containerDescriptionHash);
        }
      }
      pinnedHashes.push(twinDescriptionHash);

      const pinnedHashesAfterCreation = await getPinnedFileHashes();

      // Make sure hashes have indeed been pinned, as a safety mechanism
      // in case the smart agent acts weird
      pinnedHashes.forEach((hash) => {
        expect(
          pinnedHashesAfterCreation.includes(hash),
          'Hash should have been pinned upon creation, but wasn\'t',
        ).to.be.true;
      });

      await twin.deactivate();

      // Check if all containers' owner == 0x0
      // & consumers are removed
      // & authority is removed
      // & description is unpinned
      // & sharing is unpinned & removed
      let containerOwner;
      let containerAuthority;
      let consumerCount;
      let sharingAddress;
      for (const entry of Object.keys(entries)) {
        if (entries[entry].entryType === DigitalTwinEntryType.Container) {
          containerAddress = entries[entry].value.config.address;
          containerContract = await localRuntime.contractLoader.loadContract('DataContract', containerAddress);
          containerOwner = await localRuntime.executor.executeContractCall(containerContract, 'owner');
          containerAuthority = await localRuntime.executor.executeContractCall(containerContract, 'authority');
          consumerCount = await localRuntime.executor.executeContractCall(containerContract, 'consumerCount');
          sharingAddress = await localRuntime.executor.executeContractCall(containerContract, 'sharing');

          expect(containerOwner).to.eq(nullAddress);
          expect(containerAuthority).to.eq(nullAddress);
          expect(consumerCount.toString()).to.eq('0'); // BigNumber
          expect(sharingAddress).to.eq(nullBytes32);
        }
      }

      // Check if twin's description is 0x0
      // & twin's owner is 0x0
      // & twin's authority is 0x0
      // & twin's identity's owner is 0x0
      const twinOwner = await localRuntime.executor.executeContractCall(
        twinContract,
        'owner',
      );
      const twinAuthority = await localRuntime.executor.executeContractCall(
        twinContract,
        'authority',
      );

      const twinIdentityOwnerPromise = localRuntime.verifications.getOwnerAddressForIdentity(
        twinIdentity,
      );
      await expect(twinIdentityOwnerPromise)
        .to.be.eventually.rejectedWith('No owner found for');

      twinDescriptionHash = await localRuntime.executor.executeContractCall(
        twinContract,
        'contractDescription',
      );

      expect(twinOwner).to.equal(nullAddress);
      expect(twinAuthority).to.equal(nullAddress);
      expect(twinDescriptionHash).to.equal(nullBytes32);

      // Check if did has been deactivated
      const did = await TestUtils.getDid(
        localRuntime.web3,
        localRuntime.activeAccount,
        localRuntime.dfs,
      );
      const twinDid = await did.convertIdentityToDid(twinIdentity);
      await expect(did.didIsDeactivated(twinDid)).to.eventually.be.true;

      // Check if all pinned hashes have been unpinned
      const pinnedHashesAfterDeactivation = await getPinnedFileHashes();
      pinnedHashes.forEach((pinned) => {
        expect(pinnedHashesAfterDeactivation.includes(pinned)).to.be.false;
      });
    });

    it('can deactivate a created twin (without hash unpinning check)', async () => {
      const localRuntime = await getRuntimeWithEnabledPinning(runtime);

      const configWithTemplate = {
        ...defaultConfig,
        ...twinTemplate,
      };
      const twin = await DigitalTwin.create(localRuntime as DigitalTwinOptions, configWithTemplate);
      const twinIdentity = (await twin.getDescription()).identity;
      const twinContract = await localRuntime.contractLoader.loadContract(
        'DigitalTwin',
        await twin.getContractAddress(),
      );

      // Create sharing
      const entries = await twin.getEntries();
      const randomSecret = `super secret; ${Math.random()}`;
      await localRuntime.sharing.addSharing(
        entries.plugin1.value.config.address,
        identity0,
        identity1,
        '*',
        0,
        randomSecret,
        null,
        false,
        null,
      );

      await twin.deactivate();

      // Check if container's owner == 0x0
      // & consumers are removed
      // & authority is removed
      // & description is unpinned
      // & sharing is unpinned & removed
      let containerAddress;
      let containerContract;
      let containerOwner;
      let containerAuthority;
      let consumerCount;
      let sharingAddress;
      for (const entry of Object.keys(entries)) {
        if (entries[entry].entryType === DigitalTwinEntryType.Container) {
          containerAddress = entries[entry].value.config.address;
          containerContract = await localRuntime.contractLoader.loadContract('DataContract', containerAddress);
          containerOwner = await localRuntime.executor.executeContractCall(containerContract, 'owner');
          containerAuthority = await localRuntime.executor.executeContractCall(containerContract, 'authority');
          consumerCount = await localRuntime.executor.executeContractCall(containerContract, 'consumerCount');
          sharingAddress = await localRuntime.executor.executeContractCall(containerContract, 'sharing');

          expect(containerOwner).to.eq(nullAddress);
          expect(containerAuthority).to.eq(nullAddress);
          expect(consumerCount.toString()).to.eq('0'); // BigNumber
          expect(sharingAddress).to.eq(nullBytes32);
        }
      }

      // Check if twin's description is 0x0
      // & twin's owner is 0x0
      // & twin's authority is 0x0
      // & twin's identity's owner is 0x0
      const twinOwner = await localRuntime.executor.executeContractCall(
        twinContract,
        'owner',
      );
      const twinAuthority = await localRuntime.executor.executeContractCall(
        twinContract,
        'authority',
      );

      const twinIdentityOwnerPromise = localRuntime.verifications.getOwnerAddressForIdentity(
        twinIdentity,
      );
      await expect(twinIdentityOwnerPromise)
        .to.be.eventually.rejectedWith('No owner found for');

      const twinDescriptionHash = await localRuntime.executor.executeContractCall(
        twinContract,
        'contractDescription',
      );

      expect(twinOwner).to.equal(nullAddress);
      expect(twinAuthority).to.equal(nullAddress);
      expect(twinDescriptionHash).to.equal(nullBytes32);

      if (useIdentity) {
        // Check if did has been deactivated
        const did = await TestUtils.getDid(
          localRuntime.web3,
          localRuntime.activeAccount,
          localRuntime.dfs,
        );
        const twinDid = await did.convertIdentityToDid(twinIdentity);
        await expect(did.didIsDeactivated(twinDid)).to.eventually.be.true;
      }
    });
  });

  describe('when working with templates', () => {
    it('can create new contracts using twin templates', async () => {
      const configWithTemplate = {
        ...defaultConfig,
        ...twinTemplate,
      };
      const twin = await DigitalTwin.create(twinOptions, configWithTemplate);
      expect(await twin.getContractAddress()).to.match(/0x[0-9a-f]{40}/i);

      // check if containers were created
      const entries = await twin.getEntries();
      expect(entries).to.have.property('plugin1');
      expect(entries).to.have.property('plugin2');

      // ensure plugin descriptions
      const plugin1: Container = entries.plugin1.value;
      const plugin2: Container = entries.plugin2.value;

      // check plugin 1
      const plugin1Desc = await plugin1.getDescription();
      // check correct i18n
      expect(plugin1Desc.i18n.en).to.have.property('dataset1');
      expect(plugin1Desc.i18n.en.dataset1.name).to.be.eq('dataset 1');
      // check correct properties
      expect(plugin1Desc.dataSchema).to.have.property('dataset1');
      expect(plugin1Desc.dataSchema).to.have.property('dataset2');
      expect(plugin1Desc.dataSchema.dataset1.type).to.be.eq('object');
      expect(plugin1Desc.dataSchema.dataset1.properties).to.have.property('prop1');
      expect(plugin1Desc.dataSchema.dataset1.properties.prop1.type).to.be.eq('string');

      // check plugin 2
      const plugin2Desc = await plugin2.getDescription();
      // check correct i18n
      expect(plugin2Desc).to.not.have.property('i18n');
      // check correct properties
      expect(plugin2Desc.dataSchema).to.have.property('testlist');
      expect(plugin2Desc.dataSchema.testlist.type).to.be.eq('array');
      expect(plugin2Desc.dataSchema.testlist.items.type).to.be.eq('object');
      expect(plugin2Desc.dataSchema.testlist.items.properties).to.have.property('prop1');
      expect(plugin2Desc.dataSchema.testlist.items.properties.prop1.type).to.be.eq('string');

      // check initial values
      const dataset1Value = await plugin1.getEntry('dataset1');
      expect(dataset1Value.prop1).to.be.eq(undefined);
      const dataset2Value = await plugin1.getEntry('dataset2');
      expect(dataset2Value.prop1).to.be.eq('test value 1');
      expect(dataset2Value.prop2).to.be.eq('test value 2');
    });

    it('can export a twin template from a twin', async () => {
      const configWithTemplate = {
        ...defaultConfig,
        ...twinTemplate,
      };
      const twin = await DigitalTwin.create(twinOptions, configWithTemplate);
      const template = await twin.exportAsTemplate();

      // check exported description
      expect(template.description.name).to.be.eq('sampletwin');
      expect(template.description.author).to.be.eq('sample author');
      expect(template.description.description).to.be.eq('Sample Twin Template');
      expect(template.description.i18n.en.name).to.be.eq('Sample Twin Template');
      expect(template.description).to.not.have.property('dataSchema');

      // checkup plugin1
      const { plugin1, plugin2 } = template.plugins;
      expect(template.plugins).to.have.property('plugin1');
      expect(plugin1.description.name).to.be.eq('plugin1');
      expect(plugin1.description.i18n.en.name).to.be.eq('Container 1');
      expect(plugin1.description.i18n.en.dataset1.properties).to.have.property('prop1');
      expect(plugin1.template.type).to.be.eq('plugin1');
      expect(plugin1.template.properties).to.have.property('dataset1');
      expect(plugin1.template.properties.dataset1.dataSchema.properties).to.have.property('prop1');
      expect(plugin1.template.properties).to.have.property('dataset2');

      // checkup plugin2
      expect(template.plugins).to.have.property('plugin2');
      expect(plugin2.description).to.not.have.property('i18n');
      expect(plugin2.template.type).to.be.eq('plugin2');
      expect(plugin2.template.properties).to.have.property('testlist');
      expect(plugin2.template.properties.testlist.dataSchema.items.properties).to.have
        .property('prop1');
    });

    it('can export a twin template from a twin with value', async () => {
      const configWithTemplate = {
        ...defaultConfig,
        ...twinTemplate,
      };
      const twin = await DigitalTwin.create(twinOptions, configWithTemplate);
      const { plugins: { plugin1, plugin2 } } = await twin.exportAsTemplate(true);

      expect(plugin2.template.properties.testlist.value).to.be.eq(undefined);
      expect(plugin1.template.properties.dataset1.value).to.be.eq(undefined);
      expect(plugin1.template.properties.dataset2.value.prop1).to.be.eq('test value 1');
      expect(plugin1.template.properties.dataset2.value.prop2).to.be.eq('test value 2');
    });

    it('should throw if invalid plugin is applied', async () => {
      const brokenTemplate: DigitalTwinTemplate = JSON.parse(JSON.stringify(twinTemplate));
      brokenTemplate.plugins.plugin1.template.properties.dataset1.dataSchema.properties
        .prop1.type = 'text';
      const createPromise = DigitalTwin.create(twinOptions, {
        ...defaultConfig,
        ...brokenTemplate,
      });

      await expect(createPromise).to.be.rejectedWith(
        /^validation of plugin "plugin1" description failed with/,
      );
    });
  });

  describe('when performing set/get operations', () => {
    describe('when performing basic set/get operations', () => {
      it('can add entries to index', async () => {
        const twin = await DigitalTwin.create(twinOptions, defaultConfig);
        await twin.setEntry('sample', TestUtils.getRandomBytes32(), DigitalTwinEntryType.Hash);
      });

      it('can get entries from index', async () => {
        const twin = await DigitalTwin.create(twinOptions, defaultConfig);
        const value = TestUtils.getRandomBytes32();
        await twin.setEntry('sample', value, DigitalTwinEntryType.Hash);
        const result = await twin.getEntry('sample');
        expect(result.value).to.eq(value);
      });

      it('can set and get bytes32 values', async () => {
        const twin = await DigitalTwin.create(twinOptions, defaultConfig);
        const value = TestUtils.getRandomBytes32();
        await twin.setEntry('sample', value, DigitalTwinEntryType.Hash);
        const result = await twin.getEntry('sample');
        expect(result.value).to.eq(value);
        expect(result.entryType).to.eq(DigitalTwinEntryType.Hash);
      });

      it('can set and get address values', async () => {
        const twin = await DigitalTwin.create(twinOptions, defaultConfig);
        const value = TestUtils.getRandomAddress();
        await twin.setEntry('sample', value, DigitalTwinEntryType.GenericContract);
        const result = await twin.getEntry('sample');
        expect(result.value).to.eq(value);
        expect(result.entryType).to.eq(DigitalTwinEntryType.GenericContract);
      });

      it('can get multiple entries from index', async () => {
        const samples = {};
        for (let i = 0; i < 3; i += 1) {
          samples[`sample ${i.toString().padStart(2, '0')}`] = {
            value: TestUtils.getRandomBytes32().replace(/.{4}$/, i.toString().padStart(4, '0')),
            entryType: DigitalTwinEntryType.Hash,
          };
        }
        const twin = await DigitalTwin.create(twinOptions, defaultConfig);
        await twin.setEntries(samples);
        const result = await twin.getEntries();
        expect(Object.keys(result).length).to.eq(Object.keys(samples).length);
        for (const key of Object.keys(samples)) {
          expect(result[key].value).to.eq(samples[key].value);
          expect(result[key].entryType).to.eq(samples[key].entryType);
        }
      });
    });

    describe('when paging entries', () => {
      const checkTwin = async (twin, samples) => {
        const result = await twin.getEntries();
        for (const key of Object.keys(samples)) {
          expect(result[key].value).to.eq(samples[key].value);
          expect(result[key].entryType).to.eq(samples[key].entryType);
        }
      };
      const createTwinWithEntries = async (entryCount): Promise<any> => {
        const samples = {};
        for (let i = 0; i < entryCount; i += 1) {
          samples[`sample ${i.toString().padStart(2, '0')}`] = {
            value: TestUtils.getRandomBytes32().replace(/.{4}$/, i.toString().padStart(4, '0')),
            entryType: DigitalTwinEntryType.Hash,
          };
        }
        const twin = await DigitalTwin.create(twinOptions, defaultConfig);
        await twin.setEntries(samples);
        return { twin, samples };
      };

      it('can get handle result counts less than a page', async () => {
        const { twin, samples } = await createTwinWithEntries(4);
        await checkTwin(twin, samples);
      });

      it('can get handle result counts equal to a page', async () => {
        const { twin, samples } = await createTwinWithEntries(10);
        await checkTwin(twin, samples);
      });

      it('can get handle result counts more than a page', async () => {
        const { twin, samples } = await createTwinWithEntries(14);
        await checkTwin(twin, samples);
      });

      it('can get handle result counts with two pages', async () => {
        const { twin, samples } = await createTwinWithEntries(20);
        await checkTwin(twin, samples);
      });

      it('can get handle result counts with multiple pages', async () => {
        const { twin, samples } = await createTwinWithEntries(24);
        await checkTwin(twin, samples);
      });
    });

    describe('when working with linked indices', () => {
      it('can link two twins and fetch properties via entry path navigtion', async () => {
        const car = await DigitalTwin.create(twinOptions, defaultConfig);
        const tire = await DigitalTwin.create(twinOptions, defaultConfig);

        const tireAddress = await tire.getContractAddress();

        const container = TestUtils.getRandomAddress();
        await tire.setEntry('metadata', container, DigitalTwinEntryType.GenericContract);
        await car.setEntry('tire', await tire.getContractAddress(), DigitalTwinEntryType.DigitalTwin);

        const otherTwin = await car.getEntry('tire');
        expect(otherTwin.raw.value).to.eq(`0x000000000000000000000000${tireAddress.substr(2).toLowerCase()}`);
        expect(otherTwin.entryType).to.eq(DigitalTwinEntryType.DigitalTwin);
        expect(await otherTwin.value.getContractAddress()).to.eq(tireAddress);

        const entry = await car.getEntry('tire/metadata');
        expect(entry.value).to.eq(container);
        expect(entry.entryType).to.eq(DigitalTwinEntryType.GenericContract);
      });

      it('can link three twins and fetch properties via entry path navigtion', async () => {
        const car = await DigitalTwin.create(twinOptions, defaultConfig);
        const tire = await DigitalTwin.create(twinOptions, defaultConfig);
        const screw = await DigitalTwin.create(twinOptions, defaultConfig);

        const tireAddress = await tire.getContractAddress();
        const screwAddress = await screw.getContractAddress();

        const container = TestUtils.getRandomAddress();
        await screw.setEntry('metadata', container, DigitalTwinEntryType.GenericContract);
        await car.setEntry('tire', tireAddress, DigitalTwinEntryType.DigitalTwin);
        await tire.setEntry('screw', screwAddress, DigitalTwinEntryType.DigitalTwin);

        const otherTwin1 = await car.getEntry('tire');
        expect(otherTwin1.raw.value).to.eq(`0x000000000000000000000000${tireAddress.substr(2).toLowerCase()}`);
        expect(otherTwin1.entryType).to.eq(DigitalTwinEntryType.DigitalTwin);
        expect(await otherTwin1.value.getContractAddress()).to.eq(tireAddress);

        const otherTwin2 = await car.getEntry('tire/screw');
        expect(otherTwin2.raw.value).to.eq(`0x000000000000000000000000${screwAddress.substr(2).toLowerCase()}`);
        expect(otherTwin2.entryType).to.eq(DigitalTwinEntryType.DigitalTwin);
        expect(await otherTwin2.value.getContractAddress()).to.eq(screwAddress);

        const entry = await car.getEntry('tire/screw/metadata');
        expect(entry.value).to.eq(container);
        expect(entry.entryType).to.eq(DigitalTwinEntryType.GenericContract);
      });
    });

    describe('when adding containers', () => {
      before(async () => {
        const factory = await runtime.executor.createContract(
          'ContainerDataContractFactory', [], { from: identity0, gas: 6e6 },
        );
        defaultConfig.containerConfig.factoryAddress = factory.options.address;
      });

      it('creates new containers automatically', async () => {
        const twin = await DigitalTwin.create(twinOptions, defaultConfig);
        const customPlugin = JSON.parse(JSON.stringify(Container.plugins.metadata));
        customPlugin.template.properties.type = {
          dataSchema: { type: 'string' },
          permissions: { 0: ['set'] },
          type: 'entry',
          value: 'customTemplate',
        };
        const containers = await twin.createContainers({
          entry1: { plugin: 'metadata' },
          entry2: { plugin: customPlugin },
        });
        // new container has type property (default)
        expect(await containers.entry1.getEntry('type')).to.eq('metadata');
        expect(await containers.entry2.getEntry('type')).to.eq('customTemplate');
        // new containers are linked to twin
        let entry;
        entry = await twin.getEntry('entry1');
        expect(await entry.value.getEntry('type')).to.eq('metadata');
        entry = await twin.getEntry('entry2');
        expect(await entry.value.getEntry('type')).to.eq('customTemplate');
      });
    });
  });

  describe('when working with verifications', () => {
    it('can set verifications to twin', async () => {
      const twin = await DigitalTwin.create(twinOptions, defaultConfig);
      const verifications: DigitalTwinVerificationEntry[] = [...Array(3)].map(
        (_, i) => ({ topic: `verifcation_${i}` } as DigitalTwinVerificationEntry),
      );
      await twin.addVerifications(verifications);
      const verificationsResults = await twin.getVerifications();
      expect(verificationsResults.length).to.eq(3);
      // all verification lists should have at least 1 valid verification
      const allValid = verificationsResults.every((vs) => vs.some((v) => v.valid));
      expect(allValid).to.be.true;
      // all verifications should be confirmed, as issuing account is owner
      const allConfirmed = verificationsResults.every(
        (vs) => vs.some((v) => v.status === VerificationsStatus.Confirmed),
      );
      expect(allConfirmed).to.be.true;
    });
  });

  let ens;
  before(async () => {
    // get address for tests
    ens = runtime.contractLoader.loadContract('AbstractENS', config.nameResolver.ensAddress);
    const domainOwner = await runtime.executor.executeContractCall(
      ens, 'owner', runtime.nameResolver.namehash(ownedDomain),
    );
    if (domainOwner === '0x0000000000000000000000000000000000000000') {
      await runtime.nameResolver.claimAddress(ownedDomain, identity0);
    }
  });

  describe('when working with ENS', () => {
    it('can save contracts to ENS', async () => {
      const randomName = Math.floor(Math.random() * 1e12).toString(36);
      const address = `${randomName}.${ownedDomain}`;
      const twin = await DigitalTwin.create(twinOptions, { ...defaultConfig, address });

      expect(await twin.getContractAddress()).to.match(/0x[0-9a-f]{40}/i);
      expect(await twin.getContractAddress()).to.eq(
        await runtime.nameResolver.getAddress(address),
      );
    });

    it('can load indicdes from ENS', async () => {
      const randomName = Math.floor(Math.random() * 1e12).toString(36);
      const address = `${randomName}.${ownedDomain}`;
      await DigitalTwin.create(twinOptions, { ...defaultConfig, address });
      const loadedTwin = new DigitalTwin(twinOptions, { ...defaultConfig, address });

      expect(await loadedTwin.getContractAddress()).to.match(/0x[0-9a-f]{40}/i);
      expect(await loadedTwin.getContractAddress()).to.eq(
        await runtime.nameResolver.getAddress(address),
      );
    });

    it('loading an empty ens address should throw an error', async () => {
      const isValidTwin = await DigitalTwin.getValidity(twinOptions,
        'there.s.really.no.twin.evan');

      expect(isValidTwin.valid).to.be.false;
      expect(isValidTwin.error.message).to.include('contract does not exist');
    });
  });
});
