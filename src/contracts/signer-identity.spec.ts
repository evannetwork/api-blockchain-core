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
import { TestUtils } from '../test/test-utils';


use(chaiAsPromised);

describe('signer-identity (identity based signer)', function() {
  this.timeout(300000);

  let executor: Executor;
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
        underlyingAccount: accounts[0],
        underlyingSigner,
      },
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

    it('can create expensive contracts', async () => {
      const randomString = Math.floor(Math.random() * 1e12).toString(36);
      const contractPromise = executor.createContract(
        'HugeContract', [randomString], { from: signer.underlyingAccount, gas: 12e6 });
      await expect(contractPromise).not.to.be.rejected;
      expect(await executor.executeContractCall(await contractPromise, 'data')
      ).to.eq(randomString);
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
        { from: signer.underlyingAccount, to: accounts[1], gas: 10e6, value: amountToSend });
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
    describe('when performing transactions on contract', () => {
      it('can create a new contract', async () => {
        const randomString = Math.floor(Math.random() * 1e12).toString(36);
        const contract = await executor.createContract(
          'TestContract', [randomString], { from: signer.activeIdentity, gas: 1e6 });
        expect(await executor.executeContractCall(contract, 'data')).to.eq(randomString);
      });

      it('can create expensive contracts', async () => {
        const randomString = Math.floor(Math.random() * 1e12).toString(36);
        const contractPromise = executor.createContract(
          'HugeContract', [randomString], { from: signer.activeIdentity, gas: 1e6 });
        await expect(contractPromise).not.to.be.rejected;
        expect(await executor.executeContractCall(await contractPromise, 'data')
        ).to.eq(randomString);
      });

      it('can make transactions on contracts', async () => {
        const contract = await executor.createContract(
          'TestContract', [''], { from: signer.activeIdentity, gas: 1e6 });

        const randomString = Math.floor(Math.random() * 1e12).toString(36);
        await executor.executeContractTransaction(
          contract, 'setData', { from: signer.activeIdentity }, randomString);
        expect(await executor.executeContractCall(contract, 'data')).to.eq(randomString);
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
        await Promise.all([...Array(10)].map(() => runOneTest()));
      });

      it('can execute multiple transactions in parallel', async () => {
        const runOneTest = async () => {
          const contract = await executor.createContract(
            'TestContract', [''], { from: signer.activeIdentity, gas: 1e6 });
          const randomString = Math.floor(Math.random() * 1e12).toString(36);
          await executor.executeContractTransaction(
            contract, 'setData', { from: signer.activeIdentity }, randomString);
        };
        await Promise.all([...Array(10)].map(() => runOneTest()));
      });

      it('can create multiple contracts in parallel', async () => {
        const runOneTest = async () => {
          const contract = await executor.createContract(
            'TestContract', [''], { from: signer.activeIdentity, gas: 1e6 });
          expect(contract).to.be.an('Object');
          return contract;
        };
        const contractList = await Promise.all([...Array(10)].map(() => runOneTest()));
        expect(contractList).to.be.an('array');
      });
    });

    describe('when handling events', () => {
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
        await expect(Promise.all([...Array(10)].map(() => runOneTest())))
          .not.to.be.rejected;
      });
    });

    describe('when sending funds', () => {
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
        expect(contract).to.be.a('Object');

        const amountToSend = Math.floor(Math.random() * 1e3);
        const balanceBefore = new BigNumber(await web3.eth.getBalance(signer.activeIdentity));
        await expect( executor.executeSend({
          from: signer.activeIdentity,
          to: contract.options.address,
          gas: 100e3,
          value: amountToSend,
        })).to.rejected;

        const balanceAfter = new BigNumber(await web3.eth.getBalance(signer.activeIdentity));
        expect(balanceAfter.eq(balanceBefore)).to.be.true;
      });

      it('should reject transfer and funds should deduct transfer fee in underlaying account',
        async () => {
          const randomString = Math.floor(Math.random() * 1e12).toString(36);
          const contract = await executor.createContract(
            'TestContract', [randomString], { from: signer.activeIdentity, gas: 1e6 });
          expect(contract).to.be.a('Object');

          const amountToSend = Math.floor(Math.random() * 1e3);

          const balanceBefore = new BigNumber(await web3.eth.getBalance(signer.underlyingAccount));

          await expect( executor.executeSend({
            from: signer.activeIdentity,
            to: contract.options.address,
            gas: 100e3,
            value: amountToSend,
          })).to.rejected;

          const balanceAfter = new BigNumber(await web3.eth.getBalance(signer.underlyingAccount));
          expect(balanceAfter.lt(balanceBefore)).to.be.true;
        }
      );

      it('should transfer funds to contract', async () => {
        const amountToSend = Math.floor(Math.random() * 1e3);
        const contract = await executor.createContract(
          'TestContract', [], { from: signer.activeIdentity, gas: 1e6 });
        expect(contract).to.be.a('Object');
        const balanceBefore = new BigNumber(await web3.eth.getBalance(contract.options.address));
        await executor.executeContractTransaction(
          contract, 'chargeFunds', { from: signer.activeIdentity, value: amountToSend });
        const balanceAfter = new BigNumber(await web3.eth.getBalance(contract.options.address));
        const diff = balanceAfter.minus(balanceBefore);
        expect(diff.eq(new BigNumber(amountToSend))).to.be.true;
        expect(balanceAfter.gt(balanceBefore)).to.be.true;
      });

      it('should reject fund transfer to contract without a fallback function', async () => {
        const randomString = Math.floor(Math.random() * 1e12).toString(36);
        const contract = await executor.createContract(
          'TestContract', [randomString], { from: signer.activeIdentity, gas: 1e6 });
        expect(contract).to.be.a('Object');

        const amountToSend = Math.floor(Math.random() * 1e3);
        const balanceBefore = new BigNumber(await web3.eth.getBalance(contract.options.address));
        await expect( executor.executeSend({
          from: signer.activeIdentity,
          to: contract.options.address,
          gas: 100e3,
          value: amountToSend,
        })).to.rejected;

        const balanceAfter = new BigNumber(await web3.eth.getBalance(contract.options.address));
        expect(balanceAfter.eq(balanceBefore)).to.be.true;
      });

      it('should perform fund transfer to contract with a fallback function, e.g. identities',
        async () => {
          const amountToSend = Math.floor(Math.random() * 1e3);
          const balanceBefore = new BigNumber(await web3.eth.getBalance(signer.activeIdentity));
          await executor.executeSend({
            from: signer.underlyingAccount,
            to: signer.activeIdentity,
            gas: 100e3,
            value: amountToSend,
          });
          const balanceAfter = new BigNumber(await web3.eth.getBalance(signer.activeIdentity));
          const diff = balanceAfter.minus(balanceBefore);
          expect(diff.eq(new BigNumber(amountToSend))).to.be.true;
        }
      );

      it('should reject fund transfer to new contract and funds should stay with identity ',
        async () => {
          const randomString = Math.floor(Math.random() * 1e12).toString(36);
          const contract = await executor.createContract(
            'TestContract', [randomString], { from: signer.activeIdentity, gas: 1e6 });
          expect(contract).to.be.a('Object');

          const amountToSend = Math.floor(Math.random() * 1e3);
          const balanceBefore = new BigNumber(await web3.eth.getBalance(signer.activeIdentity));
          await expect( executor.executeSend({
            from: signer.activeIdentity,
            to: contract.options.address,
            gas: 100e3,
            value: amountToSend,
          })).to.rejected;

          const balanceAfter = new BigNumber(await web3.eth.getBalance(signer.activeIdentity));
          expect(balanceAfter.eq(balanceBefore)).to.be.true;
        }
      );
    });

    describe('when signing messages', () => {
      it('cannot sign messages', async () => {
        const randomString = Math.floor(Math.random() * 1e12).toString(36);
        const signPromise = signer.signMessage(signer.activeIdentity, randomString);
        await expect(signPromise)
          .to.be.rejectedWith('signing messages with identities is not supported');
      });
    });
  });
});
