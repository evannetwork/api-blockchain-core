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
  DfsInterface,
  Executor,
  NameResolver,
  SignerInternal,
} from '@evan.network/dbcp';

import { accounts } from '../test/accounts';
import { config } from '../config';
import { CryptoProvider } from '../encryption/crypto-provider';
import { ExecutorWallet } from './executor-wallet';
import { Ipfs } from '../dfs/ipfs';
import { sampleContext, TestUtils } from '../test/test-utils';
import { Sharing } from './sharing';
import { Wallet } from './wallet';

use(chaiAsPromised);


describe('Signer Wallet', function() {
  this.timeout(60000);
  let dfs: DfsInterface;
  let contractLoader: ContractLoader;
  let executor: Executor;
  let executorWallet0: ExecutorWallet;
  let executorWallet1: ExecutorWallet;
  let nameResolver: NameResolver;
  let wallet0: Wallet;
  let wallet1: Wallet;
  let web3: any;

  before(async () => {
    web3 = TestUtils.getWeb3();
    dfs = await TestUtils.getIpfs();
    wallet0 = await TestUtils.getWallet(web3, dfs);
    wallet1 = await TestUtils.getWallet(web3, dfs);
    await wallet0.create(accounts[0], accounts[0], [accounts[0]]);
    await wallet1.create(accounts[1], accounts[1], [accounts[1]]);
    executor = await TestUtils.getExecutor(web3);
    executor.defaultOptions = { gasPrice: 110e9 };
    contractLoader = await TestUtils.getContractLoader(web3);
    nameResolver = await TestUtils.getNameResolver(web3);
    const eventHub = await TestUtils.getEventHub(web3);
    executor.eventHub = eventHub;
    executorWallet0 = await TestUtils.getExecutorWallet(web3, wallet0, accounts[0], dfs);
    executorWallet0.eventHub = eventHub;
    executorWallet1 = await TestUtils.getExecutorWallet(web3, wallet1, accounts[1], dfs);
    executorWallet1.eventHub = eventHub;
  });

  describe('when submitting transactions via wallet', () => {
    it('can instantly submit transactions', async () => {
      // create test contract and hand over to wallet
      const testContract = await executor.createContract('Owned', [], { from: accounts[0], gas: 200000, });
      expect(await executor.executeContractCall(testContract, 'owner')).to.eq(accounts[0]);
      await executor.executeContractTransaction(testContract, 'transferOwnership', { from: accounts[0], }, wallet0.walletAddress);
      expect(await executor.executeContractCall(testContract, 'owner')).to.eq(wallet0.walletAddress);

      await executorWallet0.executeContractTransaction(testContract, 'transferOwnership', { from: wallet0.walletAddress, autoGas: 1.1, }, accounts[1]);
      expect(await executor.executeContractCall(testContract, 'owner')).to.eq(accounts[1]);
    });

    it('cannot submit transactions, when not in owners group', async () => {
      // create test contract and hand over to wallet
      const testContract = await executor.createContract('Owned', [], { from: accounts[0], gas: 200000, });
      expect(await executor.executeContractCall(testContract, 'owner')).to.eq(accounts[0]);

      await executor.executeContractTransaction(testContract, 'transferOwnership', { from: accounts[0], autoGas: 1.1, }, wallet0.walletAddress);
      expect(await executor.executeContractCall(testContract, 'owner')).to.eq(wallet0.walletAddress);

      const promise = executorWallet1.executeContractTransaction(testContract, 'transferOwnership', { from: wallet1.walletAddress, }, accounts[1]);
      await expect(promise).to.be.rejected;
    });

    it('can instantly submit transactions a second time', async () => {
      // create test contract and hand over to wallet
      const testContract = await executor.createContract('Owned', [], { from: accounts[0], gas: 200000, });
      expect(await executor.executeContractCall(testContract, 'owner')).to.eq(accounts[0]);
      await executor.executeContractTransaction(testContract, 'transferOwnership', { from: accounts[0], }, wallet0.walletAddress);
      expect(await executor.executeContractCall(testContract, 'owner')).to.eq(wallet0.walletAddress);
      await executorWallet0.executeContractTransaction(testContract, 'transferOwnership', { from: wallet0.walletAddress, autoGas: 1.1, }, accounts[1]);
      expect(await executor.executeContractCall(testContract, 'owner')).to.eq(accounts[1]);
    });

    it('can instantly submit transactions with event based result', async () => {
      const factoryAddress = await nameResolver.getAddress('testcontract.factory.testbc.evan');
      const factory = contractLoader.loadContract('TestContractFactory', factoryAddress);
      const businessCenterDomain = nameResolver.getDomainName(config.nameResolver.domains.businessCenter);
      const businessCenterAddress = '0x0000000000000000000000000000000000000000';

      const data = `I like random numbers, for example: ${Math.random()}`;
      const contractId = await executorWallet0.executeContractTransaction(
        factory,
        'createContract', {
          from: wallet0.walletAddress,
          event: { target: 'TestContractFactory', eventName: 'ContractCreated', },
          getEventResult: (event, args) => args.newAddress,
        },
        data,
      );
      expect(contractId).to.match(/0x[0-9a-f]{40}/i);
      const testContract = contractLoader.loadContract('TestContract', contractId);
      expect(await executor.executeContractCall(testContract, 'data')).to.eq(data);
    });

    it('can instantly submit transactions with event based result a second time', async () => {
      const factoryAddress = await nameResolver.getAddress('testcontract.factory.testbc.evan');
      const factory = contractLoader.loadContract('TestContractFactory', factoryAddress);
      const businessCenterDomain = nameResolver.getDomainName(config.nameResolver.domains.businessCenter);
      const businessCenterAddress = '0x0000000000000000000000000000000000000000';

      const data = `I like random numbers, for example: ${Math.random()}`;
      const contractId = await executorWallet0.executeContractTransaction(
        factory,
        'createContract', {
          from: wallet0.walletAddress,
          event: { target: 'TestContractFactory', eventName: 'ContractCreated', },
          getEventResult: (event, args) => args.newAddress,
        },
        data,
      );
      expect(contractId).to.match(/0x[0-9a-f]{40}/i);
      const testContract = contractLoader.loadContract('TestContract', contractId);
      expect(await executor.executeContractCall(testContract, 'data')).to.eq(data);
    });

    it('can instantly submit transactions a third time', async () => {
      // create test contract and hand over to wallet
      const testContract = await executor.createContract('Owned', [], { from: accounts[0], gas: 200000, });
      expect(await executor.executeContractCall(testContract, 'owner')).to.eq(accounts[0]);
      await executor.executeContractTransaction(testContract, 'transferOwnership', { from: accounts[0], }, wallet0.walletAddress);
      expect(await executor.executeContractCall(testContract, 'owner')).to.eq(wallet0.walletAddress);

      await executorWallet0.executeContractTransaction(testContract, 'transferOwnership', { from: wallet0.walletAddress, autoGas: 1.1, }, accounts[1]);
      expect(await executor.executeContractCall(testContract, 'owner')).to.eq(accounts[1]);
    });

    it('can create new contracts', async () => {
      // create new contract
      const testContract = await executorWallet0.createContract(
        'Owned', [], { from: wallet0.walletAddress, autoGas: 1.1, });
      expect(testContract.options.address).to.match(/0x[0-9a-f]{40}/ig);

      // current owner is wallet
      expect(await executor.executeContractCall(testContract, 'owner'))
        .to.eq(wallet0.walletAddress);

      // transfer owner
      await executorWallet0.executeContractTransaction(
        testContract, 'transferOwnership', { from: wallet0.walletAddress, autoGas: 1.1, }, accounts[1]);
      expect(await executor.executeContractCall(testContract, 'owner')).to.eq(accounts[1]);
    });
  });
});
