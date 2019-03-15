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
import { DigitalIdentity, DigitalIdentityOptions } from './digital-identity';
import { TestUtils } from '../../test/test-utils';

use(chaiAsPromised);


describe('DigitalIdentity (name pending)', function() {
  this.timeout(60000);
  let dfs: Ipfs;
  let defaultOptions: DigitalIdentityOptions;
  let executor: Executor;
  const description = {
    name: 'test identity',
    description: 'identity from test run',
    author: 'evan GmbH',
    version: '0.1.0',
    dbcpVersion: 2,
  };

  before(async () => {
    dfs = await TestUtils.getIpfs();
    const web3 = await TestUtils.getWeb3();
    executor = await TestUtils.getExecutor(web3);
    defaultOptions = {
      accountId: 'will be replaced in test cases',
      contractLoader: await TestUtils.getContractLoader(web3),
      dataContract: await TestUtils.getDataContract(web3, dfs),
      description: await TestUtils.getDescription(web3, dfs),
      dfs,
      executor,
      nameResolver: await TestUtils.getNameResolver(web3),
    };
    defaultOptions.executor.eventHub = await TestUtils.getEventHub(web3);
    // create factory for test
    const factory = await executor.createContract('IndexContractFactory', [], { from: accounts[0], gas: 3e6 });
    defaultOptions.factoryAddress = factory.options.address;
    // defaultOptions.factoryAddress = '';
    console.log(`factory: ${defaultOptions.factoryAddress}`);
  });

  after(async () => {
    await dfs.stop();
  });

  it('can can create new contracts', async () => {
    const digident = new DigitalIdentity({ ...defaultOptions, accountId: accounts[0] });
    await digident.create(description);
    expect(digident.contract.options.address).to.match(/0x[0-9a-f]{40}/i);
  });

  it('can add entries to index', async () => {
    const digident = new DigitalIdentity({ ...defaultOptions, accountId: accounts[0] });
    await digident.create(description);
    await digident.setEntry('sample', TestUtils.getRandomBytes32());
  });

  it('can get entries from index', async () => {
    const digident = new DigitalIdentity({ ...defaultOptions, accountId: accounts[0] });
    await digident.create(description);
    const value = TestUtils.getRandomBytes32();
    await digident.setEntry('sample', value);
    const result = await digident.getEntry('sample');
    expect(result).to.eq(value);
  });

  it.only('can get multiple entries from index', async () => {
    const digident = new DigitalIdentity({ ...defaultOptions, accountId: accounts[0] });
    const samples = {};
    for (let i = 0; i < 2; i++) {
      samples['sample ' + i.toString().padStart(2, '0')] =
        TestUtils.getRandomBytes32().replace(/.{4}$/, i.toString().padStart(4, '0'));
    };
    await digident.create(description);
    for (let key of Object.keys(samples)) {
      await digident.setEntry(key, samples[key]);
    }
    const result = await digident.getEntries();
    for (let key of Object.keys(samples)) {
      expect(result[key].value).to.eq(samples[key]);
    }
  });
});
