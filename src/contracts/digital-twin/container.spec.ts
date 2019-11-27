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

import { promisify } from 'util';
import { readFile } from 'fs';

import 'mocha';
import * as chaiAsPromised from 'chai-as-promised';
import { expect, use } from 'chai';
import {
  Executor,
  Ipfs,
} from '@evan.network/dbcp';

import { accounts } from '../../test/accounts';
import { TestUtils } from '../../test/test-utils';
import { VerificationsStatus } from '../../verifications/verifications';
import {
  Container,
  ContainerConfig,
  ContainerOptions,
  ContainerPlugin,
  ContainerVerificationEntry,
} from './container';

use(chaiAsPromised);


describe('Container', function() {
  this.timeout(600000);
  let [ owner, consumer, otherUser ] = accounts;
  let createRuntime: Function;
  let dfs: Ipfs;
  let defaultConfig: ContainerConfig;
  let executor: Executor;
  const description = {
    name: 'test container',
    description: 'container from test run',
    author: 'evan GmbH',
    version: '0.1.0',
    dbcpVersion: 2,
  };
  let runtimes: { [id: string]: ContainerOptions } = {};
  let sha3: Function;

  /**
   * Returns the container instance for the consumer based on an existing container.
   *
   * @param      {Container}  container  container to setup the container runtime for
   */
  async function getConsumerContainer(container: Container) {
    return new Container(
      runtimes[consumer],
      { ...defaultConfig, address: await container.getContractAddress(), accountId: consumer },
    );
  }

  /**
   * Create a test container with the configured test accounts, adds applied properties and sets random values
   *
   * @param      {string}  properties  The properties
   */
  async function createTestContainerWithProperties(properties: string[]) {
    const plugin: ContainerPlugin = JSON.parse(JSON.stringify(Container.plugins.metadata));
    const randomValues = { };

    // setup custom properties
    properties.forEach(property => {
      plugin.template.properties[property] = {
        dataSchema: { type: 'string' },
        permissions: { 0: ['set'] },
        type: 'entry',
      };
    });

    // create the container with these properties      
    const container = await Container.create(runtimes[owner], { ...defaultConfig, plugin });

    // set random values
    await Promise.all(properties.map(async (property: string) => {
      randomValues[property] = Math.floor(Math.random() * 1e12).toString(36);
      await container.setEntry(property, randomValues[property]);
      expect(await container.getEntry(property)).to.eq(randomValues[property]);
    }));
    
    return { container, randomValues, };
  }

  before(async () => {
    dfs = await TestUtils.getIpfs();
    const web3 = await TestUtils.getWeb3();
    executor = await TestUtils.getExecutor(web3);
    sha3 = (...args) => web3.utils.soliditySha3(...args);
    const sha9 = (accountId1, accountId2) => sha3(...[sha3(accountId1), sha3(accountId2)].sort());
    createRuntime = async (accountId) => {
      // data contract instance has sha3 self key and edges to self and other accounts
      const requestedKeys = [sha3(accountId), ...accounts.map(partner => sha9(accountId, partner))];
      const runtime = {
        contractLoader: await TestUtils.getContractLoader(web3),
        cryptoProvider: await TestUtils.getCryptoProvider(dfs),
        dataContract: await TestUtils.getDataContract(web3, dfs, requestedKeys),
        description: await TestUtils.getDescription(web3, dfs, requestedKeys),
        executor,
        nameResolver: await TestUtils.getNameResolver(web3),
        rightsAndRoles: await TestUtils.getRightsAndRoles(web3),
        sharing: await TestUtils.getSharing(web3, dfs, requestedKeys),
        verifications: await TestUtils.getVerifications(web3, dfs, requestedKeys),
        web3,
      };
      runtime.executor.eventHub = await TestUtils.getEventHub(web3);
      return runtime;
    };
    for (let accountId of accounts) {
      runtimes[accountId] = await createRuntime(accountId);
    }
    defaultConfig = {
      accountId: accounts[0],
      description,
      plugin: 'metadata',
    };
    // create factory for test
    const factory = await executor.createContract(
      'ContainerDataContractFactory', [], { from: accounts[0], gas: 6e6 });
    defaultConfig.factoryAddress = factory.options.address;
    console.log(`Container tests are using factory "${defaultConfig.factoryAddress}"`);
  });

  describe('when setting entries', async () => {
    it('can create new contracts', async () => {
      const container = await Container.create(runtimes[owner], defaultConfig);
      expect(await container.getContractAddress()).to.match(/0x[0-9a-f]{40}/i);
    });

    it('can create multiple new contracts in parallel without colliding identities', async () => {
      const [container1, container2, container3, container4, container5] = await Promise.all([
        Container.create(runtimes[owner], defaultConfig),
        Container.create(runtimes[owner], defaultConfig),
        Container.create(runtimes[owner], defaultConfig),
        Container.create(runtimes[owner], defaultConfig),
        Container.create(runtimes[consumer], {
          accountId: consumer,
          description,
          plugin: 'metadata',
          factoryAddress: defaultConfig.factoryAddress
        })
      ])

      const desc1 = await container1.getDescription();
      const desc2 = await container2.getDescription();
      const desc3 = await container3.getDescription();
      const desc4 = await container4.getDescription();
      const desc5 = await container5.getDescription();

      expect(desc1.identity).to.not.eq(desc2.identity);
      expect(desc2.identity).to.not.eq(desc3.identity);
      expect(desc1.identity).to.not.eq(desc3.identity)
      expect(desc4.identity).to.not.eq(desc3.identity)
      expect(desc5.identity).to.not.eq(desc3.identity)
      expect(await container1.getContractAddress()).to.match(/0x[0-9a-f]{40}/i);
      expect(await container2.getContractAddress()).to.match(/0x[0-9a-f]{40}/i);
      expect(await container3.getContractAddress()).to.match(/0x[0-9a-f]{40}/i);
      expect(await container4.getContractAddress()).to.match(/0x[0-9a-f]{40}/i);
      expect(await container5.getContractAddress()).to.match(/0x[0-9a-f]{40}/i);


      const verifications: ContainerVerificationEntry[] = [...Array(3)].map(
        (_, i) => (<ContainerVerificationEntry> { topic: `verifcation_${i}` }));

      for (let container of [container1, container2, container3]) {
        await container.addVerifications(verifications);
        const verificationsResults = await container.getVerifications();
        expect(verificationsResults.length).to.eq(3);
        // all validation lists should have at least 1 valid verification
        const allValid = verificationsResults.every(vs => vs.some(v => v.valid));
        expect(allValid).to.be.true;
        // all validations should be confirmed, as issuing account is owner
        const allConfirmed = verificationsResults.every(
          vs => vs.some(v => v.status === VerificationsStatus.Confirmed));
        expect(allConfirmed).to.be.true;
      }

    });

    it('can get the correct owner for contracts', async () => {
      const container = await Container.create(runtimes[owner], defaultConfig);

      expect(await container.getOwner()).to.be.eq(owner);
    });

    it('writes plugin type to automatic field "type"', async () => {
      const plugin: ContainerPlugin = {
        template: {
          type: Math.floor(Math.random() * 1e12).toString(36),
          properties: {
            testField: {
              dataSchema: { type: 'string' },
              permissions: { 0: ['set'] },
              type: 'entry',
            },
          },
        }
      };
      const container = await Container.create(runtimes[owner], { ...defaultConfig, plugin });
      expect(await container.getEntry('type')).to.eq(plugin.template.type);
    });

    it('can add new entry properties', async() => {
      const container = await Container.create(runtimes[owner], defaultConfig);
      await container.ensureProperty('testField', Container.defaultSchemas.stringEntry);
      await container.shareProperties([{ accountId: consumer, readWrite: ['testField'] }]);

      const randomString = Math.floor(Math.random() * 1e12).toString(36);
      let consumerContainer = await getConsumerContainer(container);
      await consumerContainer.setEntry('testField', randomString);

      expect(await container.getEntry('testField')).to.eq(randomString);
      expect(await consumerContainer.getEntry('testField')).to.eq(randomString);
    });

    it('can set and get entries for properties defined in (custom) plugin', async () => {
      const { container, randomValues } = await createTestContainerWithProperties([ 'testField' ]);
    });

    it('can set entries if not defined in plugin template (auto adds properties)', async () => {
      const container = await Container.create(runtimes[owner], defaultConfig);
      const randomString = Math.floor(Math.random() * 1e12).toString(36);
      await container.setEntry('testField', randomString);

      expect(await container.getEntry('testField')).to.eq(randomString);
      const expectedSchema = {
        $id: 'testField_schema',
        type: 'string',
      };
      const containerDescription = await container.getDescription();
      expect(containerDescription.dataSchema.testField).to.deep.eq(expectedSchema);
    });

    it('can handle files', async () => {
      const container = await Container.create(runtimes[owner], defaultConfig);
      await container.ensureProperty('sampleFiles', Container.defaultSchemas.filesEntry);

      const file = await promisify(readFile)(
        `${__dirname}/testfiles/animal-animal-photography-cat-96938.jpg`);
      const sampleFiles = {
        files: [{
          name: 'animal-animal-photography-cat-96938.jpg',
          fileType: 'image/jpeg',
          file,
        }]
      };
      const sampleFilesBackup = {
        files: [{
          name: 'animal-animal-photography-cat-96938.jpg',
          fileType: 'image/jpeg',
          file,
        }]
      };
      await container.setEntry('sampleFiles', sampleFiles);

      expect(await container.getEntry('sampleFiles')).to.deep.eq(sampleFilesBackup);
    });

    it('can handle files in complex objects', async () => {
      const plugin: ContainerPlugin = JSON.parse(JSON.stringify(Container.plugins.metadata));
      plugin.template.properties.complexItem = {
        dataSchema: {
          type: 'object',
          properties: {
            description: Container.defaultSchemas.stringEntry,
            images: Container.defaultSchemas.filesEntry
          },
        },
        permissions: { 0: ['set'] },
        type: 'entry',
      };
      const container = await Container.create(runtimes[owner], { ...defaultConfig, plugin });

      const file = await promisify(readFile)(
        `${__dirname}/testfiles/animal-animal-photography-cat-96938.jpg`);
      const sampleValue = {
        description: 'what a cute kitten',
        images: {
          files: [{
            name: 'animal-animal-photography-cat-96938.jpg',
            fileType: 'image/jpeg',
            file,
          }],
        },
      }
      const sampleValueBackup = {
        description: 'what a cute kitten',
        images: {
          files: [{
            name: 'animal-animal-photography-cat-96938.jpg',
            fileType: 'image/jpeg',
            file,
          }],
        },
      };
      await container.setEntry('complexItem', sampleValue);

      expect(await container.getEntry('complexItem')).to.deep.eq(sampleValueBackup);
    });
  });

  describe('when setting list entries', async () => {
    it('can set and get entries for properties defined in (custom) template', async () => {
      const plugin: ContainerPlugin = JSON.parse(JSON.stringify(Container.plugins.metadata));
      plugin.template.properties.testList = {
        dataSchema: { type: 'array', items: { type: 'number' } },
        permissions: { 0: ['set'] },
        type: 'list',
      };
      const container = await Container.create(runtimes[owner], { ...defaultConfig, plugin });
      const randomNumbers = [...Array(8)].map(() => Math.floor(Math.random() * 1e12));
      await container.addListEntries('testList', randomNumbers);
      expect(await container.getListEntries('testList')).to.deep.eq(randomNumbers);
    });

    it('can set list entries if not defined in template (auto adds properties)', async () => {
      const container = await Container.create(runtimes[owner], defaultConfig);
      const randomString = Math.floor(Math.random() * 1e12).toString(36);
      await container.addListEntries('testList', [ randomString ]);

      expect(await container.getListEntries('testList')).to.deep.eq([ randomString ]);
      const expectedSchema = {
        $id: 'testList_schema',
        type: 'array',
        items: { type: 'string'},
      };
      const containerDescription = await container.getDescription();
      expect(containerDescription.dataSchema.testList).to.deep.eq(expectedSchema);
    });

    it('can add new list properties', async() => {
      const container = await Container.create(runtimes[owner], defaultConfig);
      await container.ensureProperty('testList', Container.defaultSchemas.stringList);
      await container.shareProperties([{ accountId: consumer, readWrite: ['testList'] }]);

      const randomStrings = [...Array(3)].map(() => Math.floor(Math.random() * 1e12).toString(36));
      let consumerContainer = await getConsumerContainer(container);
      await consumerContainer.addListEntries('testList', randomStrings);

      expect(await container.getListEntries('testList')).to.deep.eq(randomStrings);
      expect(await consumerContainer.getListEntries('testList')).to.deep.eq(randomStrings);
    });

    it('can handle files', async () => {
      const container = await Container.create(runtimes[owner], defaultConfig);
      await container.ensureProperty('testList', Container.defaultSchemas.filesList);

      const file1 = await promisify(readFile)(
        `${__dirname}/testfiles/animal-animal-photography-cat-96938.jpg`);
      const file2 = await promisify(readFile)(
        `${__dirname}/testfiles/adorable-animal-animal-photography-774731.jpg`);
      const sampleFiles = [
        {
          files: [{
            name: 'animal-animal-photography-cat-96938.jpg',
            fileType: 'image/jpeg',
            file: file1,
          }],
        },
        {
          files: [{
            name: 'adorable-animal-animal-photography-774731.jpg',
            fileType: 'image/jpeg',
            file: file2,
          }],
        }
      ];
      const sampleFilesBackup = [
        {
          files: [{
            name: 'animal-animal-photography-cat-96938.jpg',
            fileType: 'image/jpeg',
            file: file1,
          }],
        },
        {
          files: [{
            name: 'adorable-animal-animal-photography-774731.jpg',
            fileType: 'image/jpeg',
            file: file2,
          }],
        }
      ];
      await container.addListEntries('testList', sampleFiles);

      expect(await container.getListEntries('testList')).to.deep.eq(sampleFilesBackup);
    });

    it('can handle files in complex objects', async () => {
      const plugin: ContainerPlugin = JSON.parse(JSON.stringify(Container.plugins.metadata));
      plugin.template.properties.complexItemList = {
        dataSchema: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: Container.defaultSchemas.stringEntry,
              images: Container.defaultSchemas.filesEntry
            },
          },
        },
        permissions: { 0: ['set'] },
        type: 'entry',
      };
      const container = await Container.create(runtimes[owner], { ...defaultConfig, plugin });

      const file1 = await promisify(readFile)(
        `${__dirname}/testfiles/animal-animal-photography-cat-96938.jpg`);
      const file2 = await promisify(readFile)(
        `${__dirname}/testfiles/adorable-animal-animal-photography-774731.jpg`);
      const sampleFiles = [
        {
          description: 'what a cute kitten',
          images: {
            files: [{
              name: 'animal-animal-photography-cat-96938.jpg',
              fileType: 'image/jpeg',
              file: file1,
            }],
          },
        },
        {
          description: 'this one is even cuter',
          images: {
            files: [{
              name: 'adorable-animal-animal-photography-774731.jpg',
              fileType: 'image/jpeg',
              file: file2,
            }],
          },
        },
      ];
      const sampleFilesBackup = [
        {
          description: 'what a cute kitten',
          images: {
            files: [{
              name: 'animal-animal-photography-cat-96938.jpg',
              fileType: 'image/jpeg',
              file: file1,
            }],
          },
        },
        {
          description: 'this one is even cuter',
          images: {
            files: [{
              name: 'adorable-animal-animal-photography-774731.jpg',
              fileType: 'image/jpeg',
              file: file2,
            }],
          },
        },
      ];
      await container.addListEntries('complexItemList', sampleFiles);

      expect(await container.getListEntries('complexItemList')).to.deep.eq(sampleFilesBackup);
    });
  });

  describe('when working with plugins', async () => {
    it('can store current contract as plugin', async () => {
      const plugin: ContainerPlugin = JSON.parse(JSON.stringify(Container.plugins.metadata));
      plugin.template.properties.testEntry = {
        dataSchema: { $id: 'testEntry_schema', type: 'string' },
        permissions: { 0: ['set'] },
        type: 'entry',
      };
      plugin.template.properties.testList = {
        dataSchema: { $id: 'testList_schema', type: 'array', items: { type: 'number' } },
        permissions: { 0: ['set'] },
        type: 'list',
      };
      const container = await Container.create(runtimes[owner], { ...defaultConfig, plugin });
      const exported = await container.toPlugin();
      expect(exported.template).to.deep.eq(plugin.template);
    });

    it('can store current contract as plugin with values', async () => {
      const plugin: ContainerPlugin = JSON.parse(JSON.stringify(Container.plugins.metadata));
      plugin.template.properties.testEntry = {
        dataSchema: { $id: 'testEntry_schema', type: 'string' },
        permissions: { 0: ['set'] },
        type: 'entry',
      };
      plugin.template.properties.testList = {
        dataSchema: { $id: 'testList_schema', type: 'array', items: { type: 'number' } },
        permissions: { 0: ['set'] },
        type: 'list',
      };
      const container = await Container.create(runtimes[owner], { ...defaultConfig, plugin });
      const exported = await container.toPlugin(true);
      // we do not export values, so remove them
      expect(exported.template).to.deep.eq(plugin.template);
    });

    it('can clone contracts', async () => {
      const { container, randomValues } = await createTestContainerWithProperties([ 'testField' ]);

      const clonedContainer = await Container.clone(runtimes[owner], defaultConfig, container, true);
      expect(await clonedContainer.getEntry('testField')).to.eq(randomValues['testField']);
    });

    it('can save plugins to users profile', async () => {
      const profile = await TestUtils.getProfile(runtimes[owner].web3, dfs, null, owner);

      // setup template
      const pluginName = 'awesometemplate';
      const plugin: ContainerPlugin = JSON.parse(JSON.stringify(Container.plugins.metadata));
      plugin.template.properties.testField = {
        dataSchema: { type: 'string' },
        permissions: { 0: ['set'] },
        type: 'entry',
      };

      // save it to the profile
      await Container.saveContainerPlugin(profile, pluginName, plugin);

      // load single template
      const loadedPlugin = await Container.getContainerPlugin(profile, pluginName);
      expect(loadedPlugin).to.deep.equal(plugin);

      // load multiple plugins
      let plugins = await Container.getContainerPlugins(profile);
      expect(plugins).to.have.property(pluginName);
      expect(plugins[pluginName]).to.deep.equal(plugin);

      // remove template
      await Container.deleteContainerPlugin(profile, pluginName);
      plugins = await Container.getContainerPlugins(profile);
      expect(plugins).to.not.have.property(pluginName);
    });
  });

  describe('when setting multiple entries at once with storeData', async () => {
    it('can save data to automatically generated entries', async () => {
      const container = await Container.create(runtimes[owner], defaultConfig);
      await container.ensureProperty('testField', Container.defaultSchemas.stringEntry);
      const randomString = Math.floor(Math.random() * 1e12).toString(36);
      await container.setEntry('testField', randomString);
      expect(await container.getEntry('testField')).to.eq(randomString);

      const anotherRandomString = Math.floor(Math.random() * 1e12).toString(36);
      await container.storeData({
        testField: anotherRandomString,
      });
      expect(await container.getEntry('testField')).to.eq(anotherRandomString);
    });

    it('can save data to automatically generated list entries', async () => {
      const container = await Container.create(runtimes[owner], defaultConfig);
      await container.ensureProperty('testList', Container.defaultSchemas.numberList);
      const randomNumbers = [...Array(3)].map(() => Math.floor(Math.random() * 1e12));
      await container.addListEntries('testList', randomNumbers);
      expect(await container.getListEntries('testList')).to.deep.eq(randomNumbers);
      const moreRandomNumbers = [...Array(3)].map(() => Math.floor(Math.random() * 1e12));
      await container.storeData({
        testList: moreRandomNumbers,
      });
      expect(await container.getListEntries('testList')).to.deep.eq([...randomNumbers, ...moreRandomNumbers]);
    });

    it('can save data to entries from plugins', async () => {
      const plugin: ContainerPlugin = JSON.parse(JSON.stringify(Container.plugins.metadata));
      plugin.template.properties.testField = {
        dataSchema: { type: 'string' },
        permissions: { 0: ['set'] },
        type: 'entry',
      };
      const container = await Container.create(runtimes[owner], { ...defaultConfig, plugin });
      const randomString = Math.floor(Math.random() * 1e12).toString(36);
      await container.storeData({
        testField: randomString,
      });
      expect(await container.getEntry('testField')).to.eq(randomString);
    });

    it('can extend list data of lists from plugins', async () => {
      const plugin: ContainerPlugin = JSON.parse(JSON.stringify(Container.plugins.metadata));
      plugin.template.properties.testList = {
        dataSchema: { type: 'array', items: { type: 'number' } },
        permissions: { 0: ['set'] },
        type: 'list',
      };
      const container = await Container.create(runtimes[owner], { ...defaultConfig, plugin });
      const randomNumbers = [...Array(3)].map(() => Math.floor(Math.random() * 1e12));
      await container.addListEntries('testList', randomNumbers);
      expect(await container.getListEntries('testList')).to.deep.eq(randomNumbers);
      const moreRandomNumbers = [...Array(3)].map(() => Math.floor(Math.random() * 1e12));
      await container.storeData({
        testList: moreRandomNumbers,
      });
      expect(await container.getListEntries('testList')).to.deep.eq([...randomNumbers, ...moreRandomNumbers]);
    });

    it('can implicitly add new entries to data schema', async () => {
      const container = await Container.create(runtimes[owner], defaultConfig);
      await container.ensureProperty('testField', Container.defaultSchemas.stringEntry);
      const randomString = Math.floor(Math.random() * 1e12).toString(36);
      await container.storeData({
        testField: randomString,
      });
      expect(await container.getEntry('testField')).to.eq(randomString);
    });

    it('can implicitly add new lists to data schema', async () => {
      const container = await Container.create(runtimes[owner], defaultConfig);
      await container.ensureProperty('testList', Container.defaultSchemas.numberList);
      const randomNumbers = [...Array(3)].map(() => Math.floor(Math.random() * 1e12));
      await container.storeData({
        testList: randomNumbers,
      });
      expect(await container.getListEntries('testList')).to.deep.eq([...randomNumbers]);
    });
  });

  describe('when sharing properties', async () => {
    describe('when sharing entries', async () => {
      it('can share read access a property from owner to another user', async() => {
        const plugin: ContainerPlugin = JSON.parse(JSON.stringify(Container.plugins.metadata));
        plugin.template.properties.testField = {
          dataSchema: { type: 'string' },
          permissions: { 0: ['set'] },
          type: 'entry',
        };
        const container = await Container.create(runtimes[owner], { ...defaultConfig, plugin });
        const randomString = Math.floor(Math.random() * 1e12).toString(36);
        await container.setEntry('testField', randomString);
        expect(await container.getEntry('testField')).to.eq(randomString);

        await container.shareProperties([{ accountId: consumer, read: ['testField'] }]);
        const consumerContainer = new Container(
          runtimes[consumer],
          { ...defaultConfig, address: await container.getContractAddress(), accountId: consumer },
        );
        expect(await consumerContainer.getEntry('testField')).to.eq(randomString);

        const shareConfig = await container.getContainerShareConfigForAccount(consumer);
        expect(shareConfig).to.haveOwnProperty('read');
        expect(shareConfig.read).to.include('testField');
      });

      it('can share write access a property from owner to another user', async() => {
        const plugin: ContainerPlugin = JSON.parse(JSON.stringify(Container.plugins.metadata));
        plugin.template.properties.testField = {
          dataSchema: { type: 'string' },
          permissions: { 0: ['set'] },
          type: 'entry',
        };
        const container = await Container.create(runtimes[owner], { ...defaultConfig, plugin });
        const randomString = Math.floor(Math.random() * 1e12).toString(36);
        await container.setEntry('testField', randomString);
        expect(await container.getEntry('testField')).to.eq(randomString);

        await container.shareProperties([{ accountId: consumer, readWrite: ['testField'] }]);
        const consumerContainer = new Container(
          runtimes[consumer],
          { ...defaultConfig, address: await container.getContractAddress(), accountId: consumer },
        );
        expect(await consumerContainer.getEntry('testField')).to.eq(randomString);

        // now change property with invited user
        const newRandomString = Math.floor(Math.random() * 1e12).toString(36);
        await consumerContainer.setEntry('testField', newRandomString);
        expect(await consumerContainer.getEntry('testField')).to.eq(newRandomString);
        expect(await container.getEntry('testField')).to.eq(newRandomString);

        const shareConfig = await container.getContainerShareConfigForAccount(consumer);
        expect(shareConfig).to.haveOwnProperty('readWrite');
        expect(shareConfig.readWrite).to.include('testField');
      });
    });

    describe('when sharing lists', async () => {
      it('can share read access a property from owner to another user', async() => {
        const plugin: ContainerPlugin = JSON.parse(JSON.stringify(Container.plugins.metadata));
        plugin.template.properties.testList = {
          dataSchema: { type: 'array', items: { type: 'string' } },
          permissions: { 0: ['set'] },
          type: 'list',
        };
        const container = await Container.create(runtimes[owner], { ...defaultConfig, plugin });
        const randomString = Math.floor(Math.random() * 1e12).toString(36);
        await container.addListEntries('testList', [randomString]);
        expect(await container.getListEntries('testList')).to.deep.eq([randomString]);

        await container.shareProperties([{ accountId: consumer, read: ['testList'] }]);
        const consumerContainer = new Container(
          runtimes[consumer],
          { ...defaultConfig, address: await container.getContractAddress(), accountId: consumer },
        );
        expect(await consumerContainer.getListEntries('testList')).to.deep.eq([randomString]);
      });

      it('can share write access a property from owner to another user', async() => {
        const plugin: ContainerPlugin = JSON.parse(JSON.stringify(Container.plugins.metadata));
        plugin.template.properties.testList = {
          dataSchema: { type: 'array', items: { type: 'string' } },
          permissions: { 0: ['set'] },
          type: 'list',
        };
        const container = await Container.create(runtimes[owner], { ...defaultConfig, plugin });
        const randomString = Math.floor(Math.random() * 1e12).toString(36);
        await container.addListEntries('testList', [randomString]);
        expect(await container.getListEntries('testList')).to.deep.eq([randomString]);

        await container.shareProperties([{ accountId: consumer, readWrite: ['testList'] }]);
        await TestUtils.nextBlock(runtimes[consumer].executor, consumer);
        const consumerContainer = new Container(
          runtimes[consumer],
          { ...defaultConfig, address: await container.getContractAddress(), accountId: consumer },
        );
        expect(await consumerContainer.getListEntries('testList')).to.deep.eq([randomString]);

        // now add list entry with invited user
        const newRandomString = Math.floor(Math.random() * 1e12).toString(36);
        await consumerContainer.addListEntries('testList', [newRandomString]);
        expect(await consumerContainer.getListEntries('testList'))
          .to.deep.eq([randomString, newRandomString]);
        expect(await container.getListEntries('testList'))
          .to.deep.eq([randomString, newRandomString]);
      });

      it('can share remove access a property from owner to another user', async() => {
        const plugin: ContainerPlugin = JSON.parse(JSON.stringify(Container.plugins.metadata));
        plugin.template.properties.testList = {
          dataSchema: { type: 'array', items: { type: 'string' } },
          permissions: { 0: ['set'] },
          type: 'list',
        };
        const container = await Container.create(runtimes[owner], { ...defaultConfig, plugin });
        const randomString = Math.floor(Math.random() * 1e12).toString(36);
        await container.addListEntries('testList', [randomString]);
        expect(await container.getListEntries('testList')).to.deep.eq([randomString]);

        await container.shareProperties([{ accountId: consumer, readWrite: ['testList'], removeListEntries: ['testList'] }]);
        const consumerContainer = new Container(
          runtimes[consumer],
          { ...defaultConfig, address: await container.getContractAddress(), accountId: consumer },
        );
        expect(await consumerContainer.getListEntries('testList')).to.deep.eq([randomString]);

        // now add list entry with invited user
        const newRandomString = Math.floor(Math.random() * 1e12).toString(36);
        await consumerContainer.addListEntries('testList', [newRandomString]);

        const containerId = await consumerContainer.getContractAddress();
        await runtimes[consumer].dataContract.removeListEntry(containerId, 'testList', 1, consumer);

        expect(await consumerContainer.getListEntries('testList'))
          .to.deep.eq([randomString]);
        expect(await container.getListEntries('testList'))
          .to.deep.eq([randomString]);
      });
    });

    describe('when working on shared containers', async () => {
      it('cannot have other user access properties before sharing them', async() => {
        const plugin: ContainerPlugin = JSON.parse(JSON.stringify(Container.plugins.metadata));
        plugin.template.properties.testField = {
          dataSchema: { type: 'string' },
          permissions: { 0: ['set'] },
          type: 'entry',
        };
        const container = await Container.create(runtimes[owner], { ...defaultConfig, plugin });
        const randomString = Math.floor(Math.random() * 1e12).toString(36);
        await container.setEntry('testField', randomString);
        expect(await container.getEntry('testField')).to.eq(randomString);

        const consumerContainer = new Container(
          runtimes[consumer],
          { ...defaultConfig, address: await container.getContractAddress(), accountId: consumer },
        );

        const getPromise = consumerContainer.getEntry('testField');
        await expect(getPromise).to.be.rejectedWith(new RegExp('^could not get entry', 'i'));
      });

      it('cannot share access, when member, but not owner of the container', async () => {
        const plugin: ContainerPlugin = JSON.parse(JSON.stringify(Container.plugins.metadata));
        plugin.template.properties.testField = {
          dataSchema: { type: 'string' },
          permissions: { 0: ['set'] },
          type: 'entry',
        };
        const container = await Container.create(runtimes[owner], { ...defaultConfig, plugin });
        const randomString = Math.floor(Math.random() * 1e12).toString(36);
        await container.setEntry('testField', randomString);
        expect(await container.getEntry('testField')).to.eq(randomString);

        await container.shareProperties([{ accountId: consumer, read: ['testField'] }]);
        const consumerContainer = new Container(
          runtimes[consumer],
          { ...defaultConfig, address: await container.getContractAddress(), accountId: consumer },
        );
        expect(await consumerContainer.getEntry('testField')).to.eq(randomString);

        const sharePromise = consumerContainer.shareProperties(
          [{ accountId: otherUser, read: ['testField'] }]);
        await expect(sharePromise).to.be.rejectedWith(new RegExp(
          '^current account "0x[0-9a-f]{40}" is unable to share properties, as it isn\'t owner of ' +
          'the underlying contract "0x[0-9a-f]{40}"$', 'i'));
      });

      it('cannot share access from a non-member account to another user', async() => {
        const plugin: ContainerPlugin = JSON.parse(JSON.stringify(Container.plugins.metadata));
        plugin.template.properties.testField = {
          dataSchema: { type: 'string' },
          permissions: { 0: ['set'] },
          type: 'entry',
        };
        const container = await Container.create(runtimes[owner], { ...defaultConfig, plugin });
        const randomString = Math.floor(Math.random() * 1e12).toString(36);
        await container.setEntry('testField', randomString);
        expect(await container.getEntry('testField')).to.eq(randomString);

        await container;
        const consumerContainer = new Container(
          runtimes[consumer],
          { ...defaultConfig, address: await container.getContractAddress(), accountId: consumer },
        );

        const sharePromise = consumerContainer.shareProperties(
          [{ accountId: consumer, read: ['testField'] }]);
        await expect(sharePromise).to.be.rejectedWith(
          new RegExp('^current account "0x[0-9a-f]{40}" is unable to share properties, as it ' +
            'isn\'t owner of the underlying contract "0x[0-9a-f]{40}"$', 'i'));
      });

      it('can clone a partially shared container from the receiver of a sharing', async() => {
        const plugin: ContainerPlugin = JSON.parse(JSON.stringify(Container.plugins.metadata));
        plugin.template.properties.testField = {
          dataSchema: { type: 'string' },
          permissions: { 0: ['set'] },
          type: 'entry',
        };
        const container = await Container.create(runtimes[owner], { ...defaultConfig, plugin });
        const randomString = Math.floor(Math.random() * 1e12).toString(36);
        await container.setEntry('testField', randomString);
        expect(await container.getEntry('testField')).to.eq(randomString);

        await container.shareProperties([{ accountId: consumer, read: ['testField'] }]);
        const consumerContainer = new Container(
          runtimes[consumer],
          { ...defaultConfig, address: await container.getContractAddress(), accountId: consumer },
        );
        expect(await consumerContainer.getEntry('testField')).to.eq(randomString);

        const clonedContainer = await Container.clone(
          runtimes[consumer], { ...defaultConfig, accountId: consumer }, consumerContainer, true);
        expect(await clonedContainer.getEntry('testField')).to.eq(randomString);
      });
    });
  });

  describe('when unsharing properties', async () => {
    // positive unshare
    it('can revoke read access of one property from owner to another user', async() => {
      const { container, randomValues } = await createTestContainerWithProperties([ 'testField' ]);
      await container.shareProperties([{ accountId: consumer, read: ['testField'] }]);

      let consumerContainer = await getConsumerContainer(container);
      expect(await consumerContainer.getEntry('testField')).to.eq(randomValues['testField']);

      let shareConfig = await container.getContainerShareConfigForAccount(consumer);
      expect(shareConfig).not.to.haveOwnProperty('readWrite');
      expect(shareConfig).to.haveOwnProperty('read');
      expect(shareConfig.read).to.include('testField');

      // now unshare
      let consumerSharing = ((consumerContainer as any).options as ContainerOptions).sharing;
      await container.unshareProperties([{ accountId: consumer, readWrite: ['testField'] }]);

      // create new consumer runtime to avoid cached keys, then check result
      const newConsumerRuntime = await createRuntime(consumer);
      consumerContainer = new Container(
        newConsumerRuntime,
        { ...defaultConfig, address: await container.getContractAddress(), accountId: consumer },
      );
      ((consumerContainer as any).options as ContainerOptions).sharing.clearCache();
      consumerSharing = ((consumerContainer as any).options as ContainerOptions).sharing;
      shareConfig = await container.getContainerShareConfigForAccount(consumer);
      await expect(consumerContainer.getEntry('testField'))
        .to.be.rejectedWith('could not get entry; no hashKey key found');
      expect(shareConfig).not.to.haveOwnProperty('read');
      expect(shareConfig).not.to.haveOwnProperty('readWrite');
      const contractSharings = await consumerSharing
        .getSharingsFromContract(newConsumerRuntime.contractLoader.loadContract(
          'DataContract', await container.getContractAddress()));
      expect(contractSharings).not.to.haveOwnProperty(sha3(consumer));
    });

    it('can revoke read access of multiple properties from owner to another user', async() => {
      const { container, randomValues } = await createTestContainerWithProperties([ 'testField', 'anotherTestField' ]);

      await container.shareProperties(
        [{ accountId: consumer, read: ['testField', 'anotherTestField'] }]);
      let consumerContainer = await getConsumerContainer(container);
      expect(await consumerContainer.getEntry('testField')).to.eq(randomValues['testField']);
      expect(await consumerContainer.getEntry('anotherTestField')).to.eq(randomValues['anotherTestField']);

      let shareConfig = await container.getContainerShareConfigForAccount(consumer);
      expect(shareConfig).not.to.haveOwnProperty('readWrite');
      expect(shareConfig).to.haveOwnProperty('read');
      expect(shareConfig.read).to.include('testField');
      expect(shareConfig.read).to.include('anotherTestField');

      // now unshare testField
      let consumerSharing = ((consumerContainer as any).options as ContainerOptions).sharing;
      await container.unshareProperties([{ accountId: consumer, readWrite: ['testField'] }]);
      // create new consumer runtime to avoid cached keys, then check result
      let newConsumerRuntime = await createRuntime(consumer);
      consumerContainer = new Container(
        newConsumerRuntime,
        { ...defaultConfig, address: await container.getContractAddress(), accountId: consumer },
      );
      ((consumerContainer as any).options as ContainerOptions).sharing.clearCache();
      shareConfig = await container.getContainerShareConfigForAccount(consumer);
      await expect(consumerContainer.getEntry('testField'))
        .to.be.rejectedWith('could not get entry; no content key found');
      expect(shareConfig).to.haveOwnProperty('read');
      expect(shareConfig.read).not.to.include('testField');
      expect(shareConfig.read).to.include('anotherTestField');
      expect(shareConfig).not.to.haveOwnProperty('readWrite');
      let contractSharings = await ((consumerContainer as any).options as ContainerOptions)
        .sharing.getSharingsFromContract(newConsumerRuntime.contractLoader.loadContract(
          'DataContract', await container.getContractAddress()));
      expect(contractSharings).to.haveOwnProperty(sha3(consumer));
      expect(contractSharings[sha3(consumer)]).to.haveOwnProperty(sha3('anotherTestField'));
      expect(contractSharings[sha3(consumer)]).to.haveOwnProperty(sha3('*'));

      // now unshare anotherTestField
      consumerSharing = ((consumerContainer as any).options as ContainerOptions).sharing;
      await container.unshareProperties([{ accountId: consumer, readWrite: ['anotherTestField'] }]);
      // create new consumer runtime to avoid cached keys, then check result
      newConsumerRuntime = await createRuntime(consumer);
      consumerContainer = new Container(
        newConsumerRuntime,
        { ...defaultConfig, address: await container.getContractAddress(), accountId: consumer },
      );
      ((consumerContainer as any).options as ContainerOptions).sharing.clearCache();
      consumerSharing = ((consumerContainer as any).options as ContainerOptions).sharing;
      shareConfig = await container.getContainerShareConfigForAccount(consumer);
      await expect(consumerContainer.getEntry('anotherTestField'))
        .to.be.rejectedWith('could not get entry; no hashKey key found');
      expect(shareConfig).not.to.not.haveOwnProperty('read');
      expect(shareConfig).not.to.haveOwnProperty('readWrite');
      contractSharings = await consumerSharing
        .getSharingsFromContract(newConsumerRuntime.contractLoader.loadContract(
          'DataContract', await container.getContractAddress()));
      expect(contractSharings).not.to.haveOwnProperty(sha3(consumer));
    });

    it('can revoke readWrite access of one property from owner to another user', async() => {
      const { container, randomValues } = await createTestContainerWithProperties([ 'testField', ]);

      await container.shareProperties([{ accountId: consumer, readWrite: ['testField'] }]);
      let consumerContainer = await getConsumerContainer(container);
      expect(await consumerContainer.getEntry('testField')).to.eq(randomValues['testField']);

      let shareConfig = await container.getContainerShareConfigForAccount(consumer);
      expect(shareConfig).not.to.haveOwnProperty('read');
      expect(shareConfig).to.haveOwnProperty('readWrite');
      expect(shareConfig.readWrite).to.include('testField');

      // now unshare
      let consumerSharing = ((consumerContainer as any).options as ContainerOptions).sharing;
      await container.unshareProperties([{ accountId: consumer, readWrite: ['testField'] }]);

      // create new consumer runtime to avoid cached keys, then check result
      const newConsumerRuntime = await createRuntime(consumer);
      consumerContainer = new Container(
        newConsumerRuntime,
        { ...defaultConfig, address: await container.getContractAddress(), accountId: consumer },
      );
      ((consumerContainer as any).options as ContainerOptions).sharing.clearCache();
      consumerSharing = ((consumerContainer as any).options as ContainerOptions).sharing;
      shareConfig = await container.getContainerShareConfigForAccount(consumer);
      await expect(consumerContainer.getEntry('testField'))
        .to.be.rejectedWith('could not get entry; no hashKey key found');
      expect(shareConfig).not.to.haveOwnProperty('read');
      expect(shareConfig).not.to.haveOwnProperty('readWrite');
      const contractSharings = await consumerSharing
        .getSharingsFromContract(newConsumerRuntime.contractLoader.loadContract(
          'DataContract', await container.getContractAddress()));
      expect(contractSharings).not.to.haveOwnProperty(sha3(consumer));
    });

    it('can revoke readWrite access of multiple properties from owner to another user', async() => {
      const { container, randomValues } = await createTestContainerWithProperties([ 'testField', 'anotherTestField' ]);

      await container.shareProperties(
        [{ accountId: consumer, readWrite: ['testField', 'anotherTestField'] }]);
      let consumerContainer = await getConsumerContainer(container);
      expect(await consumerContainer.getEntry('testField')).to.eq(randomValues['testField']);
      expect(await consumerContainer.getEntry('anotherTestField')).to.eq(randomValues['anotherTestField']);

      let shareConfig = await container.getContainerShareConfigForAccount(consumer);
      expect(shareConfig).not.to.haveOwnProperty('read');
      expect(shareConfig).to.haveOwnProperty('readWrite');
      expect(shareConfig.readWrite).to.include('testField');
      expect(shareConfig.readWrite).to.include('anotherTestField');

      // now unshare testField
      let consumerSharing = ((consumerContainer as any).options as ContainerOptions).sharing;
      await container.unshareProperties([{ accountId: consumer, readWrite: ['testField'] }]);
      // create new consumer runtime to avoid cached keys, then check result
      let newConsumerRuntime = await createRuntime(consumer);
      consumerContainer = new Container(
        newConsumerRuntime,
        { ...defaultConfig, address: await container.getContractAddress(), accountId: consumer },
      );
      ((consumerContainer as any).options as ContainerOptions).sharing.clearCache();
      shareConfig = await container.getContainerShareConfigForAccount(consumer);
      await expect(consumerContainer.getEntry('testField'))
        .to.be.rejectedWith('could not get entry; no content key found');
      expect(shareConfig).not.to.haveOwnProperty('read');
      expect(shareConfig).to.haveOwnProperty('readWrite');
      expect(shareConfig.readWrite).not.to.include('testField');
      expect(shareConfig.readWrite).to.include('anotherTestField');
      let contractSharings = await ((consumerContainer as any).options as ContainerOptions)
        .sharing.getSharingsFromContract(newConsumerRuntime.contractLoader.loadContract(
          'DataContract', await container.getContractAddress()));
      expect(contractSharings).to.haveOwnProperty(sha3(consumer));
      expect(contractSharings[sha3(consumer)]).to.haveOwnProperty(sha3('anotherTestField'));
      expect(contractSharings[sha3(consumer)]).to.haveOwnProperty(sha3('*'));

      // now unshare anotherTestField
      consumerSharing = ((consumerContainer as any).options as ContainerOptions).sharing;
      await container.unshareProperties([{ accountId: consumer, readWrite: ['anotherTestField'] }]);
      // create new consumer runtime to avoid cached keys, then check result
      newConsumerRuntime = await createRuntime(consumer);
      consumerContainer = new Container(
        newConsumerRuntime,
        { ...defaultConfig, address: await container.getContractAddress(), accountId: consumer },
      );
      ((consumerContainer as any).options as ContainerOptions).sharing.clearCache();
      consumerSharing = ((consumerContainer as any).options as ContainerOptions).sharing;
      shareConfig = await container.getContainerShareConfigForAccount(consumer);
      await expect(consumerContainer.getEntry('anotherTestField'))
        .to.be.rejectedWith('could not get entry; no hashKey key found');
      expect(shareConfig).not.to.not.haveOwnProperty('read');
      expect(shareConfig).not.to.haveOwnProperty('readWrite');
      contractSharings = await consumerSharing
        .getSharingsFromContract(newConsumerRuntime.contractLoader.loadContract(
          'DataContract', await container.getContractAddress()));
      expect(contractSharings).not.to.haveOwnProperty(sha3(consumer));
    });

    it('can remove write permissions but keep read permissions', async() => {
      const { container, randomValues } = await createTestContainerWithProperties([ 'testField', ]);

      await container.shareProperties([{ accountId: consumer, readWrite: ['testField'] }]);
      let consumerContainer = await getConsumerContainer(container);
      expect(await consumerContainer.getEntry('testField')).to.eq(randomValues['testField']);

      let shareConfig = await container.getContainerShareConfigForAccount(consumer);
      expect(shareConfig).not.to.haveOwnProperty('read');
      expect(shareConfig).to.haveOwnProperty('readWrite');
      expect(shareConfig.readWrite).to.include('testField');

      // now unshare
      let consumerSharing = ((consumerContainer as any).options as ContainerOptions).sharing;
      await container.unshareProperties([{ accountId: consumer, write: ['testField'] }]);

      // create new consumer runtime to avoid cached keys, then check result
      const newConsumerRuntime = await createRuntime(consumer);
      consumerContainer = new Container(
        newConsumerRuntime,
        { ...defaultConfig, address: await container.getContractAddress(), accountId: consumer },
      );
      ((consumerContainer as any).options as ContainerOptions).sharing.clearCache();
      consumerSharing = ((consumerContainer as any).options as ContainerOptions).sharing;
      shareConfig = await container.getContainerShareConfigForAccount(consumer);
      expect(await consumerContainer.getEntry('testField'))
        .to.eq(randomValues['testField']);
      expect(shareConfig).to.haveOwnProperty('read');
      expect(shareConfig).not.to.haveOwnProperty('readWrite');
      const contractSharings = await consumerSharing
        .getSharingsFromContract(newConsumerRuntime.contractLoader.loadContract(
          'DataContract', await container.getContractAddress()));
      expect(contractSharings).to.haveOwnProperty(sha3(consumer));
    });

    // negative unshare tests
    it('cannot revoke access from another user to another user', async() => {
      const { container, randomValues } = await createTestContainerWithProperties([ 'testField', 'anotherTestField' ]);

      await container.shareProperties([{ accountId: consumer, readWrite: ['testField'] }]);

      // now unshare
      let consumerContainer = await getConsumerContainer(container);
      const unshare = consumerContainer.unshareProperties([{
        accountId: consumer, readWrite: ['testField'] }])
      expect(unshare).to.be.rejectedWith(new RegExp(`^current account "${ consumer }" is unable to unshare properties, as it isn't owner of the underlying contract`, 'i'));
    });
    
    // // setContainerShareConfigs
    it('can save a full share configuration for a user', async() => {
      const { container, } = await createTestContainerWithProperties([ 'testField', 'testField2', 'testField3' ]);

      await container.shareProperties([{
        accountId: consumer,
        read: [ 'testField', ],
        readWrite: [ 'testField2', ]
      }]);

      let shareConfig = await container.getContainerShareConfigForAccount(consumer);

      expect(shareConfig.read).to.include('testField');
      expect(shareConfig.readWrite).to.include('testField2');
      expect(shareConfig.read).to.not.include('testField3');
      expect(shareConfig.readWrite).to.not.include('testField3');

      shareConfig.readWrite = [ 'testField3' ];
      await container.setContainerShareConfigs(shareConfig);

      shareConfig = await container.getContainerShareConfigForAccount(consumer);
      expect(shareConfig.read).to.include('testField');
      expect(shareConfig.read).to.not.include('testField2');
      expect(shareConfig.readWrite).to.not.include('testField2');
      expect(shareConfig.readWrite).to.include('testField3');
    });

    it('can save share configurations for multiple users', async() => {
      const { container, } = await createTestContainerWithProperties([ 'testField', 'testField2', 'testField3' ]);

      await container.shareProperties([{
        accountId: consumer,
        read: [ 'testField', ],
        readWrite: [ 'testField2', ]
      }]);

      await container.shareProperties([{
        accountId: otherUser,
        read: [ ],
        readWrite: [ 'testField3', ]
      }]);

      let shareConfig = await container.getContainerShareConfigForAccount(consumer);
      expect(shareConfig.read).to.include('testField');
      expect(shareConfig.readWrite).to.include('testField2');
      expect(shareConfig.read).to.not.include('testField3');
      expect(shareConfig.readWrite).to.not.include('testField3');

      let otherShareConfig = await container.getContainerShareConfigForAccount(otherUser);
      expect(otherShareConfig.read).to.be.eq(undefined);
      expect(otherShareConfig.readWrite).to.include('testField3');

      shareConfig.readWrite = [ 'testField3' ];
      otherShareConfig.readWrite = [ 'testField2' ];
      await container.setContainerShareConfigs([ shareConfig, otherShareConfig ]);

      shareConfig = await container.getContainerShareConfigForAccount(consumer);
      expect(shareConfig.read).to.include('testField');
      expect(shareConfig.readWrite).to.not.include('testField2');
      expect(shareConfig.readWrite).to.include('testField3');
      expect(shareConfig.read).to.not.include('testField3');
      expect(shareConfig.readWrite).to.include('testField3');

      otherShareConfig = await container.getContainerShareConfigForAccount(otherUser);
      expect(otherShareConfig.read).to.be.eq(undefined);
      expect(otherShareConfig.readWrite).to.include('testField2');
      expect(otherShareConfig.readWrite).to.not.include('testField3');
    });

    it('cannot save share configurations as another user', async() => {
      const { container, } = await createTestContainerWithProperties([ 'testField', 'testField2', 'testField3' ]);

      await container.shareProperties([{
        accountId: consumer,
        read: [ 'testField', ],
        readWrite: [ 'testField2', ]
      }]);

      let shareConfig = await container.getContainerShareConfigForAccount(consumer);
      const consumerContainer = getConsumerContainer(container);

      shareConfig.readWrite = [ 'testField3' ];
      const sharingProcess = container.setContainerShareConfigs(shareConfig);
      expect(sharingProcess).to.be.rejectedWith(new RegExp(`^current account "${ consumer }" is unable to unshare properties, as it isn't owner of the underlying contract`, 'i'));
    });

    it('can apply the original sharing configuration by saving a full share configuration for a user', async() => {
      const { container, } = await createTestContainerWithProperties([ 'testField', 'testField2', 'testField3' ]);

      await container.shareProperties([{
        accountId: consumer,
        read: [ 'testField', ],
        readWrite: [ 'testField2', ]
      }]);

      let shareConfig = await container.getContainerShareConfigForAccount(consumer);
      let originalConfig = JSON.parse(JSON.stringify(shareConfig));

      expect(shareConfig.read).to.include('testField');
      expect(shareConfig.readWrite).to.include('testField2');
      expect(shareConfig.read).to.not.include('testField3');
      expect(shareConfig.readWrite).to.not.include('testField3');

      shareConfig.readWrite = [ 'testField3' ];
      await container.setContainerShareConfigs(shareConfig, originalConfig);

      shareConfig = await container.getContainerShareConfigForAccount(consumer);
      expect(shareConfig.read).to.include('testField');
      expect(shareConfig.read).to.not.include('testField2');
      expect(shareConfig.readWrite).to.not.include('testField2');
      expect(shareConfig.readWrite).to.include('testField3');
    });

    it('can apply different original sharing configurations by saving a full share configuration for a user and the API will reload original ones', async() => {
      const { container, } = await createTestContainerWithProperties([ 'testField', 'testField2', 'testField3' ]);

      await container.shareProperties([{
        accountId: consumer,
        read: [ 'testField', ],
        readWrite: [ 'testField2', ]
      }]);

      await container.shareProperties([{
        accountId: otherUser,
        read: [ ],
        readWrite: [ 'testField3', ]
      }]);

      let shareConfig = await container.getContainerShareConfigForAccount(consumer);
      let originalConfig = JSON.parse(JSON.stringify(shareConfig));
      expect(shareConfig.read).to.include('testField');
      expect(shareConfig.readWrite).to.include('testField2');
      expect(shareConfig.read).to.not.include('testField3');
      expect(shareConfig.readWrite).to.not.include('testField3');

      let otherShareConfig = await container.getContainerShareConfigForAccount(otherUser);
      expect(otherShareConfig.read).to.be.eq(undefined);
      expect(otherShareConfig.readWrite).to.include('testField3');

      shareConfig.readWrite = [ 'testField3' ];
      otherShareConfig.readWrite = [ 'testField2' ];
      await container.setContainerShareConfigs([ shareConfig, otherShareConfig ], [ originalConfig ]);

      shareConfig = await container.getContainerShareConfigForAccount(consumer);
      expect(shareConfig.read).to.include('testField');
      expect(shareConfig.readWrite).to.not.include('testField2');
      expect(shareConfig.readWrite).to.include('testField3');
      expect(shareConfig.read).to.not.include('testField3');
      expect(shareConfig.readWrite).to.include('testField3');

      otherShareConfig = await container.getContainerShareConfigForAccount(otherUser);
      expect(otherShareConfig.read).to.be.eq(undefined);
      expect(otherShareConfig.readWrite).to.include('testField2');
      expect(otherShareConfig.readWrite).to.not.include('testField3');
    });

    // cleanup properties
    it('automatically removes field from description when last member of group is removed (1 member)', async() => {
      const plugin: ContainerPlugin = JSON.parse(JSON.stringify(Container.plugins.metadata));
      plugin.template.properties.testField = {
        dataSchema: { type: 'string' },
        permissions: { 0: ['set'] },
        type: 'entry',
      };
      const container = await Container.create(runtimes[owner], { ...defaultConfig, plugin });
      await container.unshareProperties([{ accountId: owner, readWrite: ['testField'], force: true }]);

      const description = await container.getDescription();
      expect(description.dataSchema).not.to.haveOwnProperty('testField');
    });

    it('automatically removes field from description when last member of group is removed (2 members)', async() => {
      const plugin: ContainerPlugin = JSON.parse(JSON.stringify(Container.plugins.metadata));
      plugin.template.properties.testField = {
        dataSchema: { type: 'string' },
        permissions: { 0: ['set'] },
        type: 'entry',
      };
      const container = await Container.create(runtimes[owner], { ...defaultConfig, plugin });
      await container.shareProperties([{ accountId: consumer, read: ['testField'] }]);
      await container.unshareProperties([{ accountId: consumer, readWrite: ['testField'], force: true }]);

      let description = await container.getDescription();
      expect(description.dataSchema).to.haveOwnProperty('testField');
      await container.unshareProperties([{ accountId: owner, readWrite: ['testField'], force: true }]);

      description = await container.getDescription();
      expect(description.dataSchema).not.to.haveOwnProperty('testField');
    });

    it('do not allow owner removal without setting the force flag', async() => {
      const plugin: ContainerPlugin = JSON.parse(JSON.stringify(Container.plugins.metadata));
      plugin.template.properties.testField = {
        dataSchema: { type: 'string' },
        permissions: { 0: ['set'] },
        type: 'entry',
      };
      const container = await Container.create(runtimes[owner], { ...defaultConfig, plugin });
      const unshare = container.unshareProperties([{ accountId: owner, readWrite: ['testField'], }]);
      expect(unshare).to.be.rejectedWith(new RegExp(`^current account "${ owner }" is owner of the contract and cannot remove himself from sharing without force attribute`, 'i'));
    });
    it('can remove properties as owner', async() => {
      const { container, } = await createTestContainerWithProperties([ 'testField', 'testField2', 'testField3' ]);

      await container.shareProperties([{
        accountId: consumer,
        read: [ 'testField', ],
        readWrite: [ 'testField2', ]
      }]);

      await container.removeEntries('testField');

      const description = await container.getDescription();
      expect(description.dataSchema).not.to.haveOwnProperty('testField');

      const shareConfig = await container.getContainerShareConfigForAccount(consumer);
      expect(shareConfig.read).to.be.eq(undefined);
    });
    it('can remove multiple properties as owner', async() => {
      const { container, } = await createTestContainerWithProperties([ 'testField', 'testField2', 'testField3' ]);

      await container.shareProperties([{
        accountId: consumer,
        read: [ 'testField', ],
        readWrite: [ 'testField2', ]
      }]);

      await container.removeEntries([ 'testField', 'testField2' ]);

      const description = await container.getDescription();
      expect(description.dataSchema).not.to.haveOwnProperty('testField');
      expect(description.dataSchema).not.to.haveOwnProperty('testField2');

      const shareConfig = await container.getContainerShareConfigForAccount(consumer);
      expect(shareConfig.read).to.be.eq(undefined);
      expect(shareConfig.readWrite).to.be.eq(undefined);
    });
    it('cannot remove propertie as another user', async() => {
      const { container, } = await createTestContainerWithProperties([ 'testField', 'testField2', 'testField3' ]);

      await container.shareProperties([{
        accountId: consumer,
        read: [ 'testField', ],
        readWrite: [ 'testField2', ]
      }]);

      expect(container.removeEntries('testField')).to.be.rejectedWith(new RegExp(`^current account "${ owner }" is owner of the contract and cannot remove himself from sharing without force attribute`, 'i'));
    });
  });

  describe('when working with verifications', () => {
    it('can set verifications to container', async () => {
      const container = await Container.create(runtimes[owner], defaultConfig);
      const verifications: ContainerVerificationEntry[] = [...Array(3)].map(
        (_, i) => ({ topic: `verifcation_${i}` }));
      await container.addVerifications(verifications);
      const verificationsResults = await container.getVerifications();
      expect(verificationsResults.length).to.eq(3);
      // all validation lists should have at least 1 valid verification
      const allValid = verificationsResults.every(vs => vs.some(v => v.valid));
      expect(allValid).to.be.true;
      // all validations should be confirmed, as issuing account is owner
      const allConfirmed = verificationsResults.every(
        vs => vs.some(v => v.status === VerificationsStatus.Confirmed));
      expect(allConfirmed).to.be.true;
    });
  });

  describe('when fetching permissions from container', async() => {
    it('can fetch permissions for a single account', async() => {
      const { container, randomValues } = await createTestContainerWithProperties([ 'testField' ]);

      await container.shareProperties([{ accountId: consumer, read: ['testField'] }]);
      let consumerContainer = await getConsumerContainer(container);
      expect(await consumerContainer.getEntry('testField')).to.eq(randomValues['testField']);

      const shareConfig = await container.getContainerShareConfigForAccount(consumer);
      expect(shareConfig).to.haveOwnProperty('read');
      expect(shareConfig.read).to.include('testField');
    });

    it('can fetch permissions for all accounts', async() => {
      const container = await Container.create(runtimes[owner], defaultConfig);
      const randomString1 = Math.floor(Math.random() * 1e12).toString(36);
      await container.setEntry('testField1', randomString1);
      const randomString2 = Math.floor(Math.random() * 1e12).toString(36);
      await container.setEntry('testField2', randomString2);

      await container.shareProperties([
        { accountId: consumer, readWrite: ['testField1'] },
        { accountId: consumer, read: ['testField2'] },
      ]);
      let consumerContainer = await getConsumerContainer(container);
      expect(await consumerContainer.getEntry('testField1')).to.eq(randomString1);
      expect(await consumerContainer.getEntry('testField2')).to.eq(randomString2);


      const expected = [
        { accountId: owner, readWrite: ['testField1', 'testField2'] },
        { accountId: consumer, readWrite: ['testField1'], read: ['testField2'] },
      ];
      const shareConfigs = await container.getContainerShareConfigs();
      const byAccountId = (e1, e2) => { return e1.accountId < e2.accountId ? -1 : 1; };
      expect(shareConfigs.sort(byAccountId)).to.deep.eq(expected.sort(byAccountId));
    });
  });
});
