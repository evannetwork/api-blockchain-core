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
import { ContractLoader, Executor } from '@evan.network/dbcp';
import chaiAsPromised = require('chai-as-promised');

import { accounts } from './test/accounts';
import { config } from './config';
import { NameResolver } from './name-resolver';
import { TestUtils } from './test/test-utils';


use(chaiAsPromised);

const registrarDomain = 'fifs.registrar.test.evan';

describe('NameResolver class', function() {
  this.timeout(600000);
  let contractLoader: ContractLoader;
  let executor: Executor;
  let fifsRegistrar;
  let nameResolver: NameResolver;
  let web3;

  function prepareData() {
    const randomAccount = web3.utils.toChecksumAddress(
      `0x${[...Array(40)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`);
    const randomNode = Math.random().toString(32).substr(2);
    const domain = `${randomNode}.${registrarDomain}`;
    const domainHash = nameResolver.namehash(domain);
    const ens = contractLoader.loadContract('AbstractENS', config.nameResolver.ensAddress);
    return {
      domain,
      domainHash,
      ens,
      randomAccount,
      randomNode,
    };
  }

  before(async () => {
    web3 = TestUtils.getWeb3();
    contractLoader = await TestUtils.getContractLoader(web3);
    executor = await TestUtils.getExecutor(web3);
    nameResolver = await TestUtils.getNameResolver(web3);
    // create fifs registrar for testing and give it ownership over 'registrar.test.evan'
    const ens = contractLoader.loadContract('AbstractENS', config.nameResolver.ensAddress);
    // fifsRegistrar = await executor.createContract(
    //   'FIFSRegistrar',
    //   [config.nameResolver.ensAddress, nameResolver.namehash('fifs.registrar.test.evan')],
    //   { from: accounts[0], gas: 1000000, },
    // );
    // await nameResolver.setAddress(
    //   registrarDomain,
    //   fifsRegistrar.options.address,
    //   accounts[0],
    //   fifsRegistrar.options.address,
    // );
  });

  after(() => {
    web3.currentProvider.connection.close();
  });

  it('should be able to claim a new domain from a FIFS registrar', async () => {
    const data = prepareData();
    // check owner at ens
    const oldOwner = await executor.executeContractCall(data.ens, 'owner', data.domainHash);
    expect(oldOwner).not.to.eq(data.randomAccount);
    // claim domain
    await nameResolver.claimAddress(data.domain, accounts[0], data.randomAccount);
    // check again
    expect(await executor.executeContractCall(
      data.ens, 'owner', data.domainHash)).to.eq(data.randomAccount);
  });

  it('should not allow to take a fifs claimed domain from another account', async () => {
    const data = prepareData();
    // check owner at ens
    const oldOwner = await executor.executeContractCall(data.ens, 'owner', data.domainHash);
    expect(oldOwner).not.to.eq(data.randomAccount);
    // claim domain
    await nameResolver.claimAddress(data.domain, accounts[0], data.randomAccount);
    // check again
    expect(await executor.executeContractCall(
      data.ens, 'owner', data.domainHash)).to.eq(data.randomAccount);
    // try to claim address, that is already onwed by data.randomAccount
    const addressTakeover = nameResolver.claimAddress(data.domain, accounts[1]);
    await expect(addressTakeover).to.be.rejected;
  });
});
