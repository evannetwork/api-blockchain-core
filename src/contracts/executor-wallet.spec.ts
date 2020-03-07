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
import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import {
  ContractLoader,
  DfsInterface,
  Executor,
  NameResolver,
} from '@evan.network/dbcp';
import { accounts, useIdentity } from '../test/accounts';
import { ExecutorWallet } from './executor-wallet';
import { TestUtils } from '../test/test-utils';
import { Wallet } from './wallet';
import { Runtime } from '../runtime';

use(chaiAsPromised);


describe('Signer Wallet', function test() {
  this.timeout(60000);
  let contractLoader: ContractLoader;
  let executor: Executor;
  let executorWallet0: ExecutorWallet;
  let executorWallet1: ExecutorWallet;
  let identity0: string;
  let identity1: string;
  let nameResolver: NameResolver;
  let wallet0: Wallet;
  let wallet1: Wallet;
  let web3: any;

  before(async () => {
    web3 = TestUtils.getWeb3();
    const runtimes = await Promise.all(
      accounts.slice(0, 2).map((account) => TestUtils.getRuntime(account, null, { useIdentity })),
    );
    identity0 = runtimes[0].activeIdentity;
    identity1 = runtimes[1].activeIdentity;
    wallet0 = await TestUtils.getWallet(runtimes[0]);
    wallet1 = await TestUtils.getWallet(runtimes[1]);
    await wallet0.create(identity0, identity0, [identity0]);
    await wallet1.create(identity1, identity1, [identity1]);
    executor = runtimes[0].executor;
    contractLoader = runtimes[0].contractLoader;
    nameResolver = runtimes[0].nameResolver;
    executor.eventHub = runtimes[0].eventHub;
    executorWallet0 = await TestUtils.getExecutorWallet(
      wallet0,
      runtimes[0],
    );
    executorWallet1 = await TestUtils.getExecutorWallet(
      wallet1,
      runtimes[1],
    );
  });

  describe('when submitting transactions via wallet', () => {
    it('can instantly submit transactions', async () => {
      // create test contract and hand over to wallet
      const testContract = await executor.createContract(
        'Owned', [], { from: identity0, gas: 200000 },
      );
      expect(await executor.executeContractCall(testContract, 'owner')).to.eq(identity0);
      await executor.executeContractTransaction(
        testContract, 'transferOwnership', { from: identity0 }, wallet0.walletAddress,
      );
      expect(await executor.executeContractCall(
        testContract, 'owner',
      )).to.eq(wallet0.walletAddress);
      await TestUtils.nextBlock(executor, identity0);
      await executorWallet0.executeContractTransaction(
        testContract,
        'transferOwnership',
        { from: wallet0.walletAddress },
        identity1,
      );
      expect(await executor.executeContractCall(testContract, 'owner')).to.eq(identity1);
    });

    it('cannot submit transactions, when not in owners group', async () => {
      // create test contract and hand over to wallet
      const testContract = await executor.createContract(
        'Owned', [], { from: identity0, gas: 200000 },
      );
      expect(await executor.executeContractCall(testContract, 'owner')).to.eq(identity0);

      await executor.executeContractTransaction(
        testContract,
        'transferOwnership',
        { from: identity0, autoGas: 1.1 },
        wallet0.walletAddress,
      );
      expect(await executor.executeContractCall(
        testContract, 'owner',
      )).to.eq(wallet0.walletAddress);

      const promise = executorWallet1.executeContractTransaction(
        testContract, 'transferOwnership', { from: wallet1.walletAddress }, identity1,
      );
      await expect(promise).to.be.rejected;
    });

    it('can instantly submit transactions a second time', async () => {
      // create test contract and hand over to wallet
      const testContract = await executor.createContract(
        'Owned', [], { from: identity0, gas: 200000 },
      );
      expect(await executor.executeContractCall(testContract, 'owner')).to.eq(identity0);
      await executor.executeContractTransaction(
        testContract, 'transferOwnership', { from: identity0 }, wallet0.walletAddress,
      );
      expect(await executor.executeContractCall(
        testContract, 'owner',
      )).to.eq(wallet0.walletAddress);
      await executorWallet0.executeContractTransaction(
        testContract,
        'transferOwnership',
        { from: wallet0.walletAddress, autoGas: 1.1 },
        identity1,
      );
      expect(await executor.executeContractCall(testContract, 'owner')).to.eq(identity1);
    });

    it('can instantly submit transactions with event based result', async () => {
      const factoryAddress = await nameResolver.getAddress('testcontract.factory.testbc.evan');
      const factory = contractLoader.loadContract('TestContractFactory', factoryAddress);

      const data = `I like random numbers, for example: ${Math.random()}`;
      const contractId = await executorWallet0.executeContractTransaction(
        factory,
        'createContract', {
          from: wallet0.walletAddress,
          event: { target: 'TestContractFactory', eventName: 'ContractCreated' },
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

      const data = `I like random numbers, for example: ${Math.random()}`;
      const contractId = await executorWallet0.executeContractTransaction(
        factory,
        'createContract', {
          from: wallet0.walletAddress,
          event: { target: 'TestContractFactory', eventName: 'ContractCreated' },
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
      const testContract = await executor.createContract(
        'Owned', [], { from: identity0, gas: 200000 },
      );
      expect(await executor.executeContractCall(testContract, 'owner')).to.eq(identity0);
      await executor.executeContractTransaction(
        testContract, 'transferOwnership', { from: identity0 }, wallet0.walletAddress,
      );
      expect(await executor.executeContractCall(
        testContract, 'owner',
      )).to.eq(wallet0.walletAddress);

      await executorWallet0.executeContractTransaction(
        testContract,
        'transferOwnership',
        { from: wallet0.walletAddress, autoGas: 1.1 },
        identity1,
      );
      expect(await executor.executeContractCall(testContract, 'owner')).to.eq(identity1);
    });

    it('can create new contracts', async () => {
      // create new contract
      const testContract = await executorWallet0.createContract(
        'Owned', [], { from: wallet0.walletAddress, autoGas: 1.1 },
      );
      expect(testContract.options.address).to.match(/0x[0-9a-f]{40}/ig);

      // current owner is wallet
      expect(await executor.executeContractCall(testContract, 'owner'))
        .to.eq(wallet0.walletAddress);

      // transfer owner
      await executorWallet0.executeContractTransaction(
        testContract,
        'transferOwnership',
        { from: wallet0.walletAddress, autoGas: 1.1 },
        identity1,
      );
      expect(await executor.executeContractCall(testContract, 'owner')).to.eq(identity1);
    });
  });
});
