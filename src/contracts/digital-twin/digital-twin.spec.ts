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
import {
  Executor,
  Ipfs,
} from '@evan.network/dbcp';

import { accounts } from '../../test/accounts';
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
  DigitalTwinVerificationEntry,
} from './digital-twin';


use(chaiAsPromised);

const ownedDomain = 'twintest.fifs.registrar.test.evan';

describe('DigitalTwin', function test() {
  this.timeout(60000);
  let dfs: Ipfs;
  let defaultConfig: DigitalTwinConfig;
  let executor: Executor;
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
  let runtime: DigitalTwinOptions;

  before(async () => {
    dfs = await TestUtils.getIpfs();
    const web3 = await TestUtils.getWeb3();
    executor = await TestUtils.getExecutor(web3);
    runtime = {
      contractLoader: await TestUtils.getContractLoader(web3),
      cryptoProvider: await TestUtils.getCryptoProvider(),
      dataContract: await TestUtils.getDataContract(web3, dfs),
      description: await TestUtils.getDescription(web3, dfs),
      executor,
      nameResolver: await TestUtils.getNameResolver(web3),
      profile: await TestUtils.getProfile(web3, dfs, null, accounts[0]),
      rightsAndRoles: await TestUtils.getRightsAndRoles(web3),
      sharing: await TestUtils.getSharing(web3, dfs),
      verifications: await TestUtils.getVerifications(web3, dfs),
      web3,
    };
    runtime.executor.eventHub = await TestUtils.getEventHub(web3);
    defaultConfig = {
      accountId: accounts[0],
      containerConfig: {
        accountId: accounts[0],
        description: containerDescription,
      },
      description,
    };
    // create factory for test
    const factory = await executor.createContract('DigitalTwinFactory', [], { from: accounts[0], gas: 3e6 });
    defaultConfig.factoryAddress = factory.options.address;
  });

  describe('working with twins', () => {
    it('can can create new contracts', async () => {
      const twin = await DigitalTwin.create(runtime, defaultConfig);
      expect(await twin.getContractAddress()).to.match(/0x[0-9a-f]{40}/i);
    });

    it('empty description.tags twins should have tag \'evan-digital-twin\' after creation', async () => {
      const customConfig = JSON.parse(JSON.stringify(defaultConfig));
      delete customConfig.description.tags;
      const twin = await DigitalTwin.create(runtime, customConfig);
      const twinDescription = await twin.getDescription();

      expect(twinDescription.tags).to.include('evan-digital-twin');
    });

    it('loading a twin without the tag \'evan-digital-twin\' should be invalid', async () => {
      const twin = await DigitalTwin.create(runtime, defaultConfig);
      const address = await twin.getContractAddress();
      const customDescription = JSON.parse(JSON.stringify(description));
      delete customDescription.tags;

      // reset filled tags
      await runtime.description.setDescription(address, { public: customDescription }, accounts[0]);
      const validity = await DigitalTwin.getValidity(runtime, address);

      expect(validity.valid).to.be.false;
      expect(validity.error.message).to.include('doesn\'t match the specification');
    });

    it('loading a twin with the tag \'evan-digital-twin\' should be valid', async () => {
      const twin = await DigitalTwin.create(runtime, defaultConfig);
      const address = await twin.getContractAddress();
      const validity = await DigitalTwin.getValidity(runtime, address);

      expect(validity.valid).to.be.true;
      expect(validity.error).to.be.null;
    });

    it('can handle twin as favorites within my profile', async () => {
      const twin = await DigitalTwin.create(runtime, defaultConfig);
      let favorites;

      // check favorite adding
      await twin.addAsFavorite();
      favorites = await DigitalTwin.getFavorites(runtime);
      expect(favorites).to.include(await twin.getContractAddress());

      // check favorite remove
      await twin.removeFromFavorites();
      favorites = await DigitalTwin.getFavorites(runtime);
      expect(favorites).to.not.include(await twin.getContractAddress());
    });

    it('can pass empty containerConfig to twin constructor', () => {
      // create custom config without container config
      const customConfig = JSON.parse(JSON.stringify(defaultConfig));
      delete customConfig.containerConfig;

      const twin = new DigitalTwin(runtime, customConfig);
      expect((twin as any).config.containerConfig.accountId).to.be.eq(defaultConfig.accountId);
    });

    it('ensure that dbcpVersion 2 is used', async () => {
      // create custom config without dbcpVersion
      const customConfig = JSON.parse(JSON.stringify(defaultConfig));
      delete customConfig.description.dbcpVersion;

      const twin = await DigitalTwin.create(runtime, defaultConfig);
      const newDesc = await twin.getDescription();
      expect(newDesc.dbcpVersion).to.be.eq(2);
    });
  });

  describe('when working with tempaltes', () => {
    it('can create new contracts using twin templates', async () => {
      const configWithTemplate = {
        ...defaultConfig,
        ...twinTemplate,
      };
      const twin = await DigitalTwin.create(runtime, configWithTemplate);
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
      const twin = await DigitalTwin.create(runtime, configWithTemplate);
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
      const twin = await DigitalTwin.create(runtime, configWithTemplate);
      const { plugins: { plugin1, plugin2 } } = await twin.exportAsTemplate(true);

      expect(plugin2.template.properties.testlist.value).to.be.eq(undefined);
      expect(plugin1.template.properties.dataset1.value).to.be.eq(undefined);
      expect(plugin1.template.properties.dataset2.value.prop1).to.be.eq('test value 1');
      expect(plugin1.template.properties.dataset2.value.prop2).to.be.eq('test value 2');
    });
  });

  describe('when performing set/get operations', () => {
    describe('when performing basic set/get operations', () => {
      it('can add entries to index', async () => {
        const twin = await DigitalTwin.create(runtime, defaultConfig);
        await twin.setEntry('sample', TestUtils.getRandomBytes32(), DigitalTwinEntryType.Hash);
      });

      it('can get entries from index', async () => {
        const twin = await DigitalTwin.create(runtime, defaultConfig);
        const value = TestUtils.getRandomBytes32();
        await twin.setEntry('sample', value, DigitalTwinEntryType.Hash);
        const result = await twin.getEntry('sample');
        expect(result.value).to.eq(value);
      });

      it('can set and get bytes32 values', async () => {
        const twin = await DigitalTwin.create(runtime, defaultConfig);
        const value = TestUtils.getRandomBytes32();
        await twin.setEntry('sample', value, DigitalTwinEntryType.Hash);
        const result = await twin.getEntry('sample');
        expect(result.value).to.eq(value);
        expect(result.entryType).to.eq(DigitalTwinEntryType.Hash);
      });

      it('can set and get address values', async () => {
        const twin = await DigitalTwin.create(runtime, defaultConfig);
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
        const twin = await DigitalTwin.create(runtime, defaultConfig);
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
        const twin = await DigitalTwin.create(runtime, defaultConfig);
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
        const car = await DigitalTwin.create(runtime, defaultConfig);
        const tire = await DigitalTwin.create(runtime, defaultConfig);

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
        const car = await DigitalTwin.create(runtime, defaultConfig);
        const tire = await DigitalTwin.create(runtime, defaultConfig);
        const screw = await DigitalTwin.create(runtime, defaultConfig);

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
        const factory = await executor.createContract(
          'ContainerDataContractFactory', [], { from: accounts[0], gas: 6e6 },
        );
        defaultConfig.containerConfig.factoryAddress = factory.options.address;
      });

      it('creates new containers automatically', async () => {
        const twin = await DigitalTwin.create(runtime, defaultConfig);
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
      const twin = await DigitalTwin.create(runtime, defaultConfig);
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
    const domainOwner = await executor.executeContractCall(
      ens, 'owner', runtime.nameResolver.namehash(ownedDomain),
    );
    if (domainOwner === '0x0000000000000000000000000000000000000000') {
      await runtime.nameResolver.claimAddress(ownedDomain, accounts[0]);
    }
  });

  describe('when working with ENS', () => {
    it('can save contracts to ENS', async () => {
      const randomName = Math.floor(Math.random() * 1e12).toString(36);
      const address = `${randomName}.${ownedDomain}`;
      const twin = await DigitalTwin.create(runtime, { ...defaultConfig, address });

      expect(await twin.getContractAddress()).to.match(/0x[0-9a-f]{40}/i);
      expect(await twin.getContractAddress()).to.eq(
        await runtime.nameResolver.getAddress(address),
      );
    });

    it('can load indicdes from ENS', async () => {
      const randomName = Math.floor(Math.random() * 1e12).toString(36);
      const address = `${randomName}.${ownedDomain}`;
      await DigitalTwin.create(runtime, { ...defaultConfig, address });
      const loadedTwin = new DigitalTwin(runtime, { ...defaultConfig, address });

      expect(await loadedTwin.getContractAddress()).to.match(/0x[0-9a-f]{40}/i);
      expect(await loadedTwin.getContractAddress()).to.eq(
        await runtime.nameResolver.getAddress(address),
      );
    });

    it('loading an empty ens address should throw an error', async () => {
      const isValidTwin = await DigitalTwin.getValidity(runtime,
        'there.s.really.no.twin.evan');

      expect(isValidTwin.valid).to.be.false;
      expect(isValidTwin.error.message).to.include('contract does not exist');
    });
  });
});
