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
        activeIdentity: await verifications.getIdentityForAccount(accounts[3], true),
        underlyingAccount: accounts[3],
        underlyingSigner,
      }
    );
    executor = new Executor(
      { config: { alwaysAutoGasLimit: 1.1 }, signer: signer, web3 });
    await executor.init({ eventHub: await TestUtils.getEventHub(web3) });

  });

  describe('when making transaction with underlying accountId', () => {
    it('can create a new contract', async () => {
      const randomString = Math.floor(Math.random() * 1e12).toString(36);
      const contract = await executor.createContract(
        'TestContract', [randomString], { from: signer.underlyingAccount, gas: 1e6 });
      expect(await executor.executeContractCall(contract, 'data')).to.eq(randomString);
    });

    it('can make transactions on contracts', async () => {
      const contract = await executor.createContract(
        'TestContract', [''], { from: signer.underlyingAccount, gas: 1e6 });

      const randomString = Math.floor(Math.random() * 1e12).toString(36);
      await executor.executeContractTransaction(
        contract, 'setData', { from: signer.underlyingAccount }, randomString);
      expect(await executor.executeContractCall(contract, 'data')).to.eq(randomString);
    });

    it('can send funds', async () => {
      const amountToSend = Math.floor(Math.random() * 1e3);
      const balanceBefore = new BigNumber(await web3.eth.getBalance(accounts[1])); 
      await executor.executeSend(
        { from: signer.underlyingAccount, to: accounts[1], gas: 100e5, value: amountToSend });
      const balanceAfter = new BigNumber(await web3.eth.getBalance(accounts[1]));
      const diff = balanceAfter.minus(balanceBefore);
      expect(diff.eq(new BigNumber(amountToSend))).to.be.true;
    });

    it('can sign messages', async () => {
      const randomString = Math.floor(Math.random() * 1e12).toString(36);
      const signed = await signer.signMessage(signer.underlyingAccount, randomString);
      const recovered = web3.eth.accounts.recover(randomString, signed);
      expect(recovered).to.eq(signer.underlyingAccount);
    });
  });

  describe('when making transaction with given identity', () => {
    it('can create a new contract', async () => {
      const randomString = Math.floor(Math.random() * 1e12).toString(36);
      const contract = await executor.createContract(
        'TestContract', [randomString], { from: signer.activeIdentity, gas: 1e6 });
      expect(await executor.executeContractCall(contract, 'data')).to.eq(randomString);
    });

    it('can make transactions on contracts', async () => {
      const contract = await executor.createContract(
        'TestContract', [''], { from: signer.activeIdentity, gas: 1e6 });

      const randomString = Math.floor(Math.random() * 1e12).toString(36);
      await executor.executeContractTransaction(
        contract, 'setData', { from: signer.activeIdentity }, randomString);
      expect(await executor.executeContractCall(contract, 'data')).to.eq(randomString);
    });

    it('can handle events in contract transactions', async () => {
      const contract = await executor.createContract(
        'TestContractEvent', [''], { from: signer.activeIdentity, gas: 1e6 });

      const randomString = Math.floor(Math.random() * 1e12).toString(36);
      const eventValue = await executor.executeContractTransaction(
        contract,
        'fireStringEvent',
        {
          from: signer.activeIdentity,
          event: {
            target: 'TestContractEvent',
            eventName: 'StringEvent',
          },
          getEventResult: (_, args) => args.text,
        },
        randomString,
      );
      expect(eventValue).to.eq(randomString);
    });

    it('can handle events in parallel transactions', async () => {
      const runOneTest = async () => {
        const contract = await executor.createContract(
          'TestContractEvent', [''], { from: signer.activeIdentity, gas: 1e6 });

        const randomString = Math.floor(Math.random() * 1e12).toString(36);
        const eventValue = await executor.executeContractTransaction(
          contract,
          'fireStringEvent',
          {
            from: signer.activeIdentity,
            event: {
              target: 'TestContractEvent',
              eventName: 'StringEvent',
            },
            getEventResult: (_, args) => args.text,
          },
          randomString,
        );
        expect(eventValue).to.eq(randomString);
      };
      expect(Promise.all([...Array(10)].map(() => runOneTest())))
        .not.to.be.rejected;
    });

    it('can make transactions on multiple contracts', async () => {
      const runOneTest = async () => {
        const contract = await executor.createContract(
          'TestContract', [''], { from: signer.activeIdentity, gas: 1e6 });
        const randomString = Math.floor(Math.random() * 1e12).toString(36);
        await executor.executeContractTransaction(
          contract, 'setData', { from: signer.activeIdentity }, randomString);
        expect(await executor.executeContractCall(contract, 'data')).to.eq(randomString);
      };
      await Promise.all([...Array(20)].map(() => runOneTest()));
    });

    it('can execute multiple transactions in parallel', async () => {
      const runOneTest = async () => {
        const contract = await executor.createContract(
          'TestContract', [''], { from: signer.activeIdentity, gas: 1e6 });
        const randomString = Math.floor(Math.random() * 1e12).toString(36);
        const executedContracts = await executor.executeContractTransaction(
          contract, 'setData', { from: signer.activeIdentity }, randomString);
      };
      await Promise.all([...Array(10)].map(() => runOneTest()));
    });

    it('can create multiple contracts in parallel', async () => {
      const runOneTest = async () => {
        const contract = await executor.createContract(
          'TestContract', [''], { from: signer.activeIdentity, gas: 1e6 });
        expect(contract).to.be.an('Object')
        return contract
      };
      const contractList = await Promise.all([...Array(10)].map(() => runOneTest()));     
      expect(contractList).to.be.an('array')
    });

    it('can send funds', async () => {
      const amountToSend = Math.floor(Math.random() * 1e3);
      const balanceBefore = new BigNumber(await web3.eth.getBalance(accounts[1])); 
      await executor.executeSend(
        { from: signer.activeIdentity, to: accounts[1], gas: 100e3, value: amountToSend });
      const balanceAfter = new BigNumber(await web3.eth.getBalance(accounts[1]));
      const diff = balanceAfter.minus(balanceBefore);
      expect(diff.eq(new BigNumber(amountToSend))).to.be.true;
    });

    it('should reject transfer and balance of identity should remain same', async () => {
      const randomString = Math.floor(Math.random() * 1e12).toString(36);
      const contract = await executor.createContract(
        'TestContract', [randomString], { from: signer.activeIdentity, gas: 1e6 });
      expect(contract).to.be.a('Object')

      const amountToSend = Math.floor(Math.random() * 1e3);
      const balanceBefore = new BigNumber(await web3.eth.getBalance(signer.activeIdentity));
      await expect( executor.executeSend(
        { from: signer.activeIdentity, to: contract.options.address, gas: 100e3,
         value: amountToSend })).to.rejected
      
      const balanceAfter = new BigNumber(await web3.eth.getBalance(signer.activeIdentity));
      expect(balanceAfter.eq(balanceBefore)).to.be.true;     
    })  

    it('should reject transfer and funds should deduct transfer fee in underlaying account', async () => {
      const randomString = Math.floor(Math.random() * 1e12).toString(36);
      const contract = await executor.createContract(
        'TestContract', [randomString], { from: signer.activeIdentity, gas: 1e6 });
      expect(contract).to.be.a('Object')

      const amountToSend = Math.floor(Math.random() * 1e3);

      const balanceBefore = new BigNumber(await web3.eth.getBalance(signer.underlyingAccount));

      await expect( executor.executeSend(
        { from: signer.activeIdentity, to: contract.options.address, gas: 100e3,
         value: amountToSend })).to.rejected
      
      const balanceAfter = new BigNumber(await web3.eth.getBalance(signer.underlyingAccount));
      expect(balanceAfter.eq(balanceBefore)).to.be.not.true     
    })

    it('should reject fund transfer to contract', async () => {
      const randomString = Math.floor(Math.random() * 1e12).toString(36);
      const contract = await executor.createContract(
        'TestContract', [randomString], { from: signer.activeIdentity, gas: 1e6 });
      expect(contract).to.be.a('Object')

      const amountToSend = Math.floor(Math.random() * 1e3);
      const balanceBefore = new BigNumber(await web3.eth.getBalance(contract.options.address)); 
      await expect( executor.executeSend(
        { from: signer.activeIdentity, to: contract.options.address, gas: 100e3,
         value: amountToSend })).to.rejected
      
      const balanceAfter = new BigNumber(await web3.eth.getBalance(contract.options.address));
      expect(balanceAfter.eq(balanceBefore)).to.be.true;     
    })

    it('should reject fund transfer to new contract and funds should stay with identity ', async () => {
      const randomString = Math.floor(Math.random() * 1e12).toString(36);
      const contract = await executor.createContract(
        'TestContract', [randomString], { from: signer.activeIdentity, gas: 1e6 });
      expect(contract).to.be.a('Object')

      const amountToSend = Math.floor(Math.random() * 1e3);
      const balanceBefore = new BigNumber(await web3.eth.getBalance(signer.activeIdentity)); 
      await expect( executor.executeSend(
        { from: signer.activeIdentity, to: contract.options.address, gas: 100e3,
         value: amountToSend })).to.rejected
      
      const balanceAfter = new BigNumber(await web3.eth.getBalance(signer.activeIdentity));
      expect(balanceAfter.eq(balanceBefore)).to.be.true;     
    })    

    it('cannot sign messages', async () => {
      const randomString = Math.floor(Math.random() * 1e12).toString(36);
      const signPromise = signer.signMessage(signer.activeIdentity, randomString);
      await expect(signPromise)
        .to.be.rejectedWith('signing messages with identities is not supported');
    });
  });
});
