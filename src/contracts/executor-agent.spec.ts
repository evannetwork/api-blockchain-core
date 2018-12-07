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
import chaiAsPromised = require('chai-as-promised');

import {
  ContractLoader,
  LogLevel,
  SignerInternal,
  SignerInterface,
} from '@evan.network/dbcp';

import { accounts } from '../test/accounts';
import { ExecutorAgent } from './executor-agent';
import { TestUtils } from '../test/test-utils'


const agentUser = '0xa60F5EAfBb782793d7589bc5F55BfA3a599B182d';
const ensDomain = '0xa4f4bc00d00f32992d5115ca850962b66537252c8367317a7d70a85c59cc1954';
const ensMainAccount = '0x4a6723fC5a926FA150bAeAf04bfD673B056Ba83D';
const randomAccount = `0x${Math.floor(Math.random() * 255 * 255 * 255).toString(16).padStart(40, '0')}`;

let contract;
let contractLoader;
let password;
let web3;

use(chaiAsPromised);

describe.skip('Executor handler', function() {
  this.timeout(300000);
  let executor: ExecutorAgent;

  before(async () => {
    web3 = TestUtils.getWeb3();
    const accountStore = TestUtils.getAccountStore({});
    contractLoader = await TestUtils.getContractLoader(web3);
    const signer = new SignerInternal({
      accountStore,
      contractLoader,
      config: {},
      web3,
    });
    executor = new ExecutorAgent({
      config: {},
      contractLoader,
      signer,
      web3,
    });
    password = web3.utils.soliditySha3('fluffy cat is fluffy');
  });

  after(() => {
    web3.currentProvider.connection.close();
  });

  it('should be able to call a contract method', async () => {
    const sampleContract = contractLoader.loadContract('AbstractENS', TestUtils.getConfig().nameResolver.ensAddress);
    const owner = await executor.executeContractCall(sampleContract, 'owner', ensDomain);
    expect(owner).to.eq(ensMainAccount);
  });

  it('should be able to create a contract', async () => {
    // create token for creating contract
    const token = await executor.generateToken(password, [{ signature: 'Owned', }]);
    executor.token = token;
    contract = await executor.createContract('Owned', [], { gas: 2000000, });
    expect(contract).not.to.be.undefined;
    const owner = await executor.executeContractCall(contract, 'owner');
    expect(owner).to.eq(agentUser);
  });

  it('should be able to perform transactions', async () => {
    let owner = await executor.executeContractCall(contract, 'owner');
    expect(owner).to.eq(agentUser);

    // grant tx token
    const token = await executor.generateToken(password, [{ contract, functionName: 'transferOwnership', }]);
    executor.token = token;
    // try to transfer ownership
    await executor.executeContractTransaction(contract, 'transferOwnership', { gas: 2000000, }, randomAccount);
    owner = await executor.executeContractCall(contract, 'owner');
    expect(owner.toLowerCase()).to.eq(randomAccount);
  });

  describe('when managing tokens', () => {
    it('should allow contract creation and transactions, when token has been granted', async () => {
      // create token for creating contract
      let token = await executor.generateToken(password, [{ signature: 'Owned', }]);
      executor.token = token;
      // allowed, as token has been set
      const localContract = await executor.createContract('Owned', [], { gas: 2000000, });
      expect(localContract).not.to.be.undefined;
      let owner = await executor.executeContractCall(localContract, 'owner');
      expect(owner).to.eq(agentUser);

      // grant tx token
      token = await executor.generateToken(password, [{ contract: localContract, functionName: 'transferOwnership', }]);
      executor.token = token;
      // allowed, as token has been set
      await executor.executeContractTransaction(localContract, 'transferOwnership', { gas: 2000000, }, randomAccount);
      owner = await executor.executeContractCall(localContract, 'owner');
      expect(owner.toLowerCase()).to.eq(randomAccount);
    });

    it('should not allow contract creation, when token has been granted', async () => {
      // allowed, as token has been set
      delete executor.token;
      const localContractPromise = executor.createContract('Owned', [], { gas: 2000000, });
      await expect(localContractPromise).to.be.rejected;
    });

    it('should not allow transactions, when token has not been granted', async () => {
      // create token for creating contract
      const token = await executor.generateToken(password, [{ signature: 'Owned', }]);
      executor.token = token;
      // allowed, as token has been set
      const localContract = await executor.createContract('Owned', [], { gas: 2000000, });
      expect(localContract).not.to.be.undefined;
      const owner = await executor.executeContractCall(localContract, 'owner');
      expect(owner).to.eq(agentUser);

      // allowed, as token has been set
      delete executor.token;
      const txPromise = executor.executeContractTransaction(localContract, 'transferOwnership', { gas: 2000000, }, randomAccount);
      await expect(txPromise).to.be.rejected;
    });

    it('should allow multiple transactions, when matching token has been granted', async () => {
      // create token for creating contract
      let token = await executor.generateToken(password, [{ signature: 'Owned', }]);
      executor.token = token;
      // allowed, as token has been set
      const localContract = await executor.createContract('Owned', [], { gas: 2000000, });
      expect(localContract).not.to.be.undefined;
      const owner = await executor.executeContractCall(localContract, 'owner');
      expect(owner).to.eq(agentUser);

      // grant tx token
      token = await executor.generateToken(password, [{ contract: localContract, functionName: 'transferOwnership', count: 3, }]);
      executor.token = token;
      // allowed (1/3), as token has been set
      await executor.executeContractTransaction(localContract, 'transferOwnership', { gas: 2000000, }, agentUser);
      // allowed (2/3), as token has been set
      await executor.executeContractTransaction(localContract, 'transferOwnership', { gas: 2000000, }, agentUser);
      // allowed (3/3), as token has been set
      await executor.executeContractTransaction(localContract, 'transferOwnership', { gas: 2000000, }, agentUser);
      // will fail
      const txPromise = executor.executeContractTransaction(localContract, 'transferOwnership', { gas: 2000000, }, agentUser);
      await expect(txPromise).to.be.rejected;
    });

    it('rejects contract creations, when value has been set', async() => {
      // create token for creating contract
      let token = await executor.generateToken(password, [{ signature: 'Owned', }]);
      executor.token = token;
      // fails, as value has been given
      const localContractPromise = executor.createContract('Owned', [], { gas: 2000000, value: 1000, });
      await expect(localContractPromise).to.be.rejected;
    });

    it('rejects contract transactions, when value has been set', async() => {
      // create token for creating contract
      let token = await executor.generateToken(password, [{ signature: 'Owned', }]);
      executor.token = token;
      // allowed, as token has been set
      const localContract = await executor.createContract('Owned', [], { gas: 2000000, });
      expect(localContract).not.to.be.undefined;
      let owner = await executor.executeContractCall(localContract, 'owner');
      expect(owner).to.eq(agentUser);

      // grant tx token
      token = await executor.generateToken(password, [{ contract: localContract, functionName: 'transferOwnership', }]);
      executor.token = token;

      // fails, as value has been given
      const txPromise = executor.executeContractTransaction(localContract, 'transferOwnership', { gas: 2000000, value: 1000, }, randomAccount);
      await expect(txPromise).to.be.rejected;
    });
  });
});
