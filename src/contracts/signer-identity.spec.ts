/*
  Copyright (c) 2018-present evan GmbH.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import 'mocha';
import BigNumber = require('bignumber.js');
import chaiAsPromised = require('chai-as-promised');
import { expect, use } from 'chai';
import {
  ContractLoader,
  Executor,
  SignerInternal,
} from '@evan.network/dbcp';

import { accounts } from '../test/accounts';
import { SignerIdentity } from './signer-identity';
import { TestUtils } from '../test/test-utils'


use(chaiAsPromised);

describe('signer-identity (identity based signer)', function() {
  this.timeout(300000);

  let executor: Executor;
  let identityAddress: string;
  let signer;
  let web3;

  before(async () => {
    web3 = TestUtils.getWeb3();

    const contracts = await TestUtils.getContracts();
    const contractLoader =  new ContractLoader({
      contracts,
      web3,
    });
    const accountStore = TestUtils.getAccountStore({});
    const verifications = await TestUtils.getVerifications(web3, await TestUtils.getIpfs());
    const underlyingSigner = new SignerInternal({
      accountStore,
      contractLoader,
      config: {},
      web3,
    });
    signer = new SignerIdentity(
      {
        contractLoader,
        verifications,
        web3,
      },
      {
        activeIdentity: await verifications.getIdentityForAccount(accounts[0], true),
        underlyingAccountId: accounts[0],
        underlyingSigner,
      }
    );
    executor = new Executor(
      { config: { alwaysAutoGasLimit: 1.1 }, signer: signer, web3 });
    await executor.init({});

  });

  describe('when making transaction with underlying accountId', () => {
    it('can create a new contract', async () => {
      const randomString = Math.floor(Math.random() * 1e12).toString(36);
      const contract = await executor.createContract(
        'TestContract', [randomString], { from: accounts[0], gas: 1e6 });
      expect(await executor.executeContractCall(contract, 'data')).to.eq(randomString);
    });

    it('can make transactions on contracts', async () => {
      const contract = await executor.createContract(
        'TestContract', [''], { from: accounts[0], gas: 1e6 });

      const randomString = Math.floor(Math.random() * 1e12).toString(36);
      await executor.executeContractTransaction(
        contract, 'setData', { from: accounts[0] }, randomString);
      expect(await executor.executeContractCall(contract, 'data')).to.eq(randomString);
    });

    it('can send funds', async () => {
      const amountToSend = Math.floor(Math.random() * 1_000);
      const balanceBefore = new BigNumber(await web3.eth.getBalance(accounts[1])); 
      await executor.executeSend(
        { from: accounts[0], to: accounts[1], gas: 100_000, value: amountToSend });
      const balanceAfter = new BigNumber(await web3.eth.getBalance(accounts[1]));
      const diff = balanceAfter.minus(balanceBefore);
      expect(diff.eq(new BigNumber(amountToSend))).to.be.true;
    });

    it('can sign messages', async () => {
      const randomString = Math.floor(Math.random() * 1e12).toString(36);
      const signed = await signer.signMessage(accounts[0], randomString);
      const recovered = web3.eth.accounts.recover(randomString, signed);
      expect(recovered).to.eq(accounts[0]);
    });
  });

  describe('when making transaction with given identity', () => {
    it.skip('can create a new contract', async () => {
      throw new Error('not implemented');
      const randomString = Math.floor(Math.random() * 1e12).toString(36);
      const contract = await executor.createContract(
        'TestContract', [randomString], { from: signer.activeIdentity, gas: 1e6 });
      expect(await executor.executeContractCall(contract, 'data')).to.eq(randomString);
    });

    it('can make transactions on contracts', async () => {
      const contract = await executor.createContract(
        'TestContract', [''], { from: accounts[0], gas: 1e6 });

      const randomString = Math.floor(Math.random() * 1e12).toString(36);
      await executor.executeContractTransaction(
        contract, 'setData', { from: signer.activeIdentity }, randomString);
      expect(await executor.executeContractCall(contract, 'data')).to.eq(randomString);
    });

    it('can send funds', async () => {
      const amountToSend = Math.floor(Math.random() * 1_000);
      const balanceBefore = new BigNumber(await web3.eth.getBalance(accounts[1])); 
      await executor.executeSend(
        { from: signer.activeIdentity, to: accounts[1], gas: 100e3, value: amountToSend });
      const balanceAfter = new BigNumber(await web3.eth.getBalance(accounts[1]));
      const diff = balanceAfter.minus(balanceBefore);
      expect(diff.eq(new BigNumber(amountToSend))).to.be.true;
    });

    it('cannot sign messages', async () => {
      const randomString = Math.floor(Math.random() * 1e12).toString(36);
      const signPromise = signer.signMessage(signer.activeIdentity, randomString);
      await expect(signPromise)
        .to.be.rejectedWith('signing messages with identities is not supported');
    });
  });
});
