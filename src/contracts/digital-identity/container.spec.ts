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


describe('Container (name pending)', function() {
  this.timeout(60000);
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
  let runtime: ContainerOptions;

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
      rightsAndRoles: await TestUtils.getRightsAndRoles(web3),
      sharing: await TestUtils.getSharing(web3, dfs),
      web3,
    };
    runtime.executor.eventHub = await TestUtils.getEventHub(web3);
    defaultConfig = {
      accountId: accounts[1],
      description,
      template: 'metadata',
    };
    // create factory for test
    const factory = await executor.createContract('ContainerDataContractFactory', [], { from: accounts[0], gas: 6e6 });
    defaultConfig.factoryAddress = factory.options.address;
    console.log(`factory: ${defaultConfig.factoryAddress}`);
  });

  it('can can create new contracts', async () => {
    const container = await Container.create(runtime, defaultConfig);
    expect(await container.getContractAddress()).to.match(/0x[0-9a-f]{40}/i);
  });

  describe('when setting entries', async () => {
    it('can set and get entries for properties defined in (custom) template', async () => {
      const template: ContainerTemplate = JSON.parse(JSON.stringify(Container.templates.metadata));
      template.properties.testField = {
        dataSchema: { type: 'string' },
        permissions: { 0: ['set'] },
        type: 'entry',
      };
      const container = await Container.create(runtime, { ...defaultConfig, template });
      const randomString = Math.floor(Math.random() * 1e12).toString(36);
      await container.setEntry('testField', randomString);
      expect(await container.getEntry('testField')).to.eq(randomString);
    });

    it('can set entries if not defined in template (auto adds properties)', async () => {
      const container = await Container.create(runtime, defaultConfig);
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
      const container = await Container.create(runtime, defaultConfig);
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
      const container = await Container.create(runtime, { ...defaultConfig, template });
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
      const container = await Container.create(runtime, { ...defaultConfig, template });
      const exported = await container.toTemplate();
      // we do not export values, so remove them
      delete template.properties.type.value;
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
      const container = await Container.create(runtime, { ...defaultConfig, template });
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
      const container = await Container.create(runtime, { ...defaultConfig, template });
      const randomString = Math.floor(Math.random() * 1e12).toString(36);
      await container.setEntry('testField', randomString);
      expect(await container.getEntry('testField')).to.eq(randomString);

      const dolly = await Container.clone(runtime, defaultConfig, container, true);
      expect(await dolly.getEntry('testField')).to.eq(randomString);
    });
  });
});
