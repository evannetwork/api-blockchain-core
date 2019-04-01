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
  Container,
  ContainerConfig,
  ContainerOptions,
  ContainerTemplate,
  ContainerTemplateProperty,
} from './container';

use(chaiAsPromised);


describe('Container', function() {
  this.timeout(60000);
  let [ owner, consumer, otherUser ] = accounts;
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
  let runtimes: { [id: string]: ContainerOptions; } = {};

  before(async () => {
    dfs = await TestUtils.getIpfs();
    const web3 = await TestUtils.getWeb3();
    executor = await TestUtils.getExecutor(web3);
    const sha3 = (...args) => web3.utils.soliditySha3(...args);
    const sha9 = (accountId1, accountId2) => sha3(...[sha3(accountId1), sha3(accountId2)].sort());
    for (let accountId of accounts) {
      // data contract instance has sha3 self key and edges to self and other accounts
      const requestedKeys = [sha3(accountId), ...accounts.map(partner => sha9(accountId, partner))];
      runtimes[accountId] = {
        contractLoader: await TestUtils.getContractLoader(web3),
        cryptoProvider: await TestUtils.getCryptoProvider(),
        dataContract: await TestUtils.getDataContract(web3, dfs, requestedKeys),
        description: await TestUtils.getDescription(web3, dfs, requestedKeys),
        executor,
        nameResolver: await TestUtils.getNameResolver(web3),
        rightsAndRoles: await TestUtils.getRightsAndRoles(web3),
        sharing: await TestUtils.getSharing(web3, dfs, requestedKeys),
        web3,
      };
      runtimes[accountId].executor.eventHub = await TestUtils.getEventHub(web3);
    }
    defaultConfig = {
      accountId: accounts[0],
      description,
      template: 'metadata',
    };
    // create factory for test
    const factory = await executor.createContract('ContainerDataContractFactory', [], { from: accounts[0], gas: 6e6 });
    defaultConfig.factoryAddress = factory.options.address;
    console.log(`Container tests are using factory "${defaultConfig.factoryAddress}"`);
  });
  describe('when setting entries', async () => {
    it('can can create new contracts', async () => {
      const container = await Container.create(runtimes[owner], defaultConfig);
      expect(await container.getContractAddress()).to.match(/0x[0-9a-f]{40}/i);
    });

    it('writes template type to automatic field "type"', async () => {
      const template: ContainerTemplate = {
        type: Math.floor(Math.random() * 1e12).toString(36),
        properties: {
          testField: {
            dataSchema: { type: 'string' },
            permissions: { 0: ['set'] },
            type: 'entry',
          },
        },
      };
      const container = await Container.create(runtimes[owner], { ...defaultConfig, template });
      expect(await container.getEntry('type')).to.eq(template.type);
    });
  });

  describe('when setting entries', async () => {
    it('can set and get entries for properties defined in (custom) template', async () => {
      const template: ContainerTemplate = JSON.parse(JSON.stringify(Container.templates.metadata));
      template.properties.testField = {
        dataSchema: { type: 'string' },
        permissions: { 0: ['set'] },
        type: 'entry',
      };
      const container = await Container.create(runtimes[owner], { ...defaultConfig, template });
      const randomString = Math.floor(Math.random() * 1e12).toString(36);
      await container.setEntry('testField', randomString);
      expect(await container.getEntry('testField')).to.eq(randomString);
    });

    it('can set entries if not defined in template (auto adds properties)', async () => {
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
  });

  describe('when setting list entries', async () => {
    it('can set and get entries for properties defined in (custom) template', async () => {
      const template: ContainerTemplate = JSON.parse(JSON.stringify(Container.templates.metadata));
      template.properties.testList = {
        dataSchema: { type: 'array', items: { type: 'number' } },
        permissions: { 0: ['set'] },
        type: 'list',
      };
      const container = await Container.create(runtimes[owner], { ...defaultConfig, template });
      const randomNumbers = [...Array(8)].map(() => Math.floor(Math.random() * 1e12));
      await container.addListEntries('testList', randomNumbers);
      expect(await container.getListEntries('testList')).to.deep.eq(randomNumbers);
    });
  });

  describe('when working with templates', async () => {
    it('can store current contract as template', async () => {
      const template: ContainerTemplate = JSON.parse(JSON.stringify(Container.templates.metadata));
      template.properties.testEntry = {
        dataSchema: { $id: 'testEntry_schema', type: 'string' },
        permissions: { 0: ['set'] },
        type: 'entry',
      };
      template.properties.testList = {
        dataSchema: { $id: 'testList_schema', type: 'array', items: { type: 'number' } },
        permissions: { 0: ['set'] },
        type: 'list',
      };
      const container = await Container.create(runtimes[owner], { ...defaultConfig, template });
      const exported = await container.toTemplate();
      expect(exported).to.deep.eq(template);
    });

    it('can store current contract as template with values', async () => {
      const template: ContainerTemplate = JSON.parse(JSON.stringify(Container.templates.metadata));
      template.properties.testEntry = {
        dataSchema: { $id: 'testEntry_schema', type: 'string' },
        permissions: { 0: ['set'] },
        type: 'entry',
      };
      template.properties.testList = {
        dataSchema: { $id: 'testList_schema', type: 'array', items: { type: 'number' } },
        permissions: { 0: ['set'] },
        type: 'list',
      };
      const container = await Container.create(runtimes[owner], { ...defaultConfig, template });
      const exported = await container.toTemplate(true);
      // we do not export values, so remove them
      expect(exported).to.deep.eq(template);
    });

    it('can clone contracts', async () => {
      const template: ContainerTemplate = JSON.parse(JSON.stringify(Container.templates.metadata));
      template.properties.testField = {
        dataSchema: { type: 'string' },
        permissions: { 0: ['set'] },
        type: 'entry',
      };
      const container = await Container.create(runtimes[owner], { ...defaultConfig, template });
      const randomString = Math.floor(Math.random() * 1e12).toString(36);
      await container.setEntry('testField', randomString);
      expect(await container.getEntry('testField')).to.eq(randomString);

      const clonedContainer = await Container.clone(runtimes[owner], defaultConfig, container, true);
      expect(await clonedContainer.getEntry('testField')).to.eq(randomString);
    });
  });

  describe('when sharing properties', async () => {
    describe('when sharing entries', async () => {
      it('can share read access a property from owner to another user', async() => {
        const template: ContainerTemplate = JSON.parse(JSON.stringify(Container.templates.metadata));
        template.properties.testField = {
          dataSchema: { type: 'string' },
          permissions: { 0: ['set'] },
          type: 'entry',
        };
        const container = await Container.create(runtimes[owner], { ...defaultConfig, template });
        const randomString = Math.floor(Math.random() * 1e12).toString(36);
        await container.setEntry('testField', randomString);
        expect(await container.getEntry('testField')).to.eq(randomString);

        await container.shareProperties([{ accountId: consumer, read: ['testField'] }]);
        const consumerContainer = new Container(
          runtimes[consumer],
          { ...defaultConfig, address: await container.getContractAddress(), accountId: consumer },
        );
        expect(await consumerContainer.getEntry('testField')).to.eq(randomString);
      });

      it('can share write access a property from owner to another user', async() => {
        const template: ContainerTemplate = JSON.parse(JSON.stringify(Container.templates.metadata));
        template.properties.testField = {
          dataSchema: { type: 'string' },
          permissions: { 0: ['set'] },
          type: 'entry',
        };
        const container = await Container.create(runtimes[owner], { ...defaultConfig, template });
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
      });
    });

    describe('when sharing lists', async () => {
      it('can share read access a property from owner to another user', async() => {
        const template: ContainerTemplate = JSON.parse(JSON.stringify(Container.templates.metadata));
        template.properties.testList = {
          dataSchema: { type: 'array', items: { type: 'string' } },
          permissions: { 0: ['set'] },
          type: 'list',
        };
        const container = await Container.create(runtimes[owner], { ...defaultConfig, template });
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
        const template: ContainerTemplate = JSON.parse(JSON.stringify(Container.templates.metadata));
        template.properties.testList = {
          dataSchema: { type: 'array', items: { type: 'string' } },
          permissions: { 0: ['set'] },
          type: 'list',
        };
        const container = await Container.create(runtimes[owner], { ...defaultConfig, template });
        const randomString = Math.floor(Math.random() * 1e12).toString(36);
        await container.addListEntries('testList', [randomString]);
        expect(await container.getListEntries('testList')).to.deep.eq([randomString]);

        await container.shareProperties([{ accountId: consumer, readWrite: ['testList'] }]);
        const consumerContainer = new Container(
          runtimes[consumer],
          { ...defaultConfig, address: await container.getContractAddress(), accountId: consumer },
        );
        expect(await consumerContainer.getListEntries('testList')).to.deep.eq([randomString]);

        // now add list entry with invited user
        const newRandomString = Math.floor(Math.random() * 1e12).toString(36);
        await consumerContainer.addListEntries('testList', [newRandomString]);
        expect(await consumerContainer.getListEntries('testList')).to.deep.eq([randomString, newRandomString]);
        expect(await container.getListEntries('testList')).to.deep.eq([randomString, newRandomString]);
      });
    });

    describe('when working on shared containers', async () => {
      it('cannot have other user access properties before sharing them', async() => {
        const template: ContainerTemplate = JSON.parse(JSON.stringify(Container.templates.metadata));
        template.properties.testField = {
          dataSchema: { type: 'string' },
          permissions: { 0: ['set'] },
          type: 'entry',
        };
        const container = await Container.create(runtimes[owner], { ...defaultConfig, template });
        const randomString = Math.floor(Math.random() * 1e12).toString(36);
        await container.setEntry('testField', randomString);
        expect(await container.getEntry('testField')).to.eq(randomString);

        const consumerContainer = new Container(
          runtimes[consumer],
          { ...defaultConfig, address: await container.getContractAddress(), accountId: consumer },
        );

        expect(consumerContainer.getEntry('testField')).to.be.rejected;
      });

      it('cannot share access from a non-owner account to another user', async() => {
        const template: ContainerTemplate = JSON.parse(JSON.stringify(Container.templates.metadata));
        template.properties.testField = {
          dataSchema: { type: 'string' },
          permissions: { 0: ['set'] },
          type: 'entry',
        };
        const container = await Container.create(runtimes[owner], { ...defaultConfig, template });
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
        expect(sharePromise).to.be.rejected;
      });

      it('can clone a partially shared container from the receiver of a sharing', async() => {
        const template: ContainerTemplate = JSON.parse(JSON.stringify(Container.templates.metadata));
        template.properties.testField = {
          dataSchema: { type: 'string' },
          permissions: { 0: ['set'] },
          type: 'entry',
        };
        const container = await Container.create(runtimes[owner], { ...defaultConfig, template });
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

    describe('when sharing entire containers', async () => {
      it.skip('can share access a property from owner to another user', async() => {});

      it.skip('can clone a fully shared container from the receiver of a sharing', async() => {});
    });
  });
});
