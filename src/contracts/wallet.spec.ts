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
} from '@evan.network/dbcp';

import { accounts } from '../test/accounts';
import { configTestcore as config } from '../config-testcore';
import { CryptoProvider } from '../encryption/crypto-provider';
import { Ipfs } from '../dfs/ipfs';
import { sampleContext, TestUtils } from '../test/test-utils';
import { Sharing } from './sharing';
import { Wallet } from './wallet';

use(chaiAsPromised);


describe('Wallet handler', function() {
  this.timeout(60000);
  let dfs: DfsInterface;
  let contractLoader: ContractLoader;
  let executor: Executor;
  let wallet: Wallet;
  let web3: any;

  before(async () => {
    web3 = TestUtils.getWeb3();
    dfs = await TestUtils.getIpfs();
    wallet = await TestUtils.getWallet(web3, dfs);
    executor = await TestUtils.getExecutor(web3);
    contractLoader = await TestUtils.getContractLoader(web3);
  });

  function runTests(walletType, createWallet) {
    it('can create new wallets', async () => {
      if (walletType === 'MultiSigWallet') {
        // create wallet via factory, returned wallet is of type 'MultiSigWallet'
        await createWallet(accounts[0], accounts[0], [accounts[0]]);
      } else if (walletType === 'MultiSigWalletSG') {
        // create wallet by hand
        const walletContract = await executor.createContract(
          walletType,
          [ [ accounts[0] ], 1 ],
          { from: accounts[0], gas: 2000000 },
        );
        wallet.load(walletContract.options.address, walletType);
      } else {
        throw new Error(`unknown wallet type: ${walletType}`);
      }
    });

    describe('when submitting transactions', () => {
      it('can instantly submit transactions', async () => {
        await createWallet(accounts[0], accounts[0], [accounts[0], accounts[1]]);

        // create test contract and hand over to wallet
        const testContract = await executor.createContract('Owned', [], { from: accounts[0], gas: 200000, });
        expect(await executor.executeContractCall(testContract, 'owner')).to.eq(accounts[0]);
        await executor.executeContractTransaction(testContract, 'transferOwnership', { from: accounts[0], }, wallet.walletAddress);
        expect(await executor.executeContractCall(testContract, 'owner')).to.eq(wallet.walletAddress);

        await wallet.submitTransaction(testContract, 'transferOwnership', { from: accounts[0], }, accounts[1]);
        expect(await executor.executeContractCall(testContract, 'owner')).to.eq(accounts[1]);

        await executor.executeContractTransaction(testContract, 'transferOwnership', { from: accounts[1], }, wallet.walletAddress);

        await wallet.submitTransaction(testContract, 'transferOwnership', { from: accounts[1], }, accounts[0]);
        expect(await executor.executeContractCall(testContract, 'owner')).to.eq(accounts[0]);
      });

      it('cannot submit transactions, when not in owners group', async () => {
        await createWallet(accounts[0], accounts[0], [accounts[0]]);

        // create test contract and hand over to wallet
        const testContract = await executor.createContract('Owned', [], { from: accounts[0], gas: 200000, });
        expect(await executor.executeContractCall(testContract, 'owner')).to.eq(accounts[0]);
        await executor.executeContractTransaction(testContract, 'transferOwnership', { from: accounts[0], }, wallet.walletAddress);
        expect(await executor.executeContractCall(testContract, 'owner')).to.eq(wallet.walletAddress);

        const promise = wallet.submitTransaction(testContract, 'transferOwnership', { from: accounts[1], }, accounts[1]);
        await expect(promise).to.be.rejected;
      });
    });

    describe('when submitting transactions on wallets for multiple accounts', () => {
      async function createContract() {
        const contract = await executor.createContract(
          'Owned', [], { from: accounts[0], gas: 200000, });
        await executor.executeContractTransaction(
          contract,
          'transferOwnership',
          { from: accounts[0], },
          wallet.walletAddress,
        );
        return contract;
      }

      before(async () => {
        // setup wallet that needs 2 confirmations
        await createWallet(accounts[0], accounts[0], [accounts[0], accounts[1]], 2);
      });

      it('allows any member to submit transactions', async () => {
        const testContract = await createContract();
        // test with account1
        await expect(wallet.submitTransaction(
          testContract, 'transferOwnership', { from: accounts[0], }, accounts[1])).not.to.be.rejected;
        // test with account2
        await expect(wallet.submitTransaction(
          testContract, 'transferOwnership', { from: accounts[1], }, accounts[0])).not.to.be.rejected;
      });

      it('returns txinfo upon submitting a tx and missing confirmations', async () => {
        const testContract = await createContract();
        const txInfo = await wallet.submitTransaction(
          testContract, 'transferOwnership', { from: accounts[0], }, accounts[1]);
        expect(txInfo).to.be.ok;
        expect(txInfo.result).to.be.ok;
        expect(txInfo.result.status).to.eq('pending');
        expect(txInfo.result.transactionId).to.match(/\d+/);

        // still owned by wallet
        expect(await executor.executeContractCall(testContract, 'owner'))
          .to.eq(wallet.walletAddress);
      });

      it('executes tx when submitting the final confirmation', async () => {
        const testContract = await createContract();
        const txInfo = await wallet.submitTransaction(
          testContract, 'transferOwnership', { from: accounts[0], }, accounts[1]);

        // still owned by wallet
        expect(await executor.executeContractCall(testContract, 'owner'))
          .to.eq(wallet.walletAddress);

        await wallet.confirmTransaction(accounts[1], txInfo.result.transactionId);

        // ownership has changed
        expect(await executor.executeContractCall(testContract, 'owner')).to.eq(accounts[1]);
      });
    });

    describe('when submitting funds alongside transactions', () => {
      async function createContract(accountId) {
        const contract = await executor.createContract(
          'TestContract', [], { from: accounts[0], gas: 1000000, });
        await executor.executeContractTransaction(
          contract,
          'transferOwnership',
          { from: accounts[0], },
          wallet.walletAddress,
        );
        return contract;
      }

      it('allows to transfer funds to wallet', async () => {
        await createWallet(accounts[0], accounts[0], [accounts[0]]);
        const walletAddress = wallet.walletAddress;
        const valueToSend = Math.floor(Math.random() * 10000);
        const executeSendP = executor.executeSend(
          { from: accounts[0], to: walletAddress, value: valueToSend });
        await expect(executeSendP).not.to.be.rejected;
        expect(await web3.eth.getBalance(walletAddress)).to.eq(valueToSend.toString());
      });

      it('intantly submits funds to target if instantly submitting transaction', async () => {
        await createWallet(accounts[0], accounts[0], [accounts[0]]);
        const walletAddress = wallet.walletAddress;

        const valueToSend = Math.floor(Math.random() * 10000);
        await executor.executeSend({ from: accounts[0], to: walletAddress, value: valueToSend });
        expect(await web3.eth.getBalance(walletAddress)).to.eq(valueToSend.toString());

        const testContract = await executor.createContract(
          'TestContract', ['test'], { from: accounts[0], gas: 1000000, });
        expect(await web3.eth.getBalance(testContract.options.address)).to.eq('0');

        const txInfo = await wallet.submitTransaction(testContract, 'chargeFunds', { from: accounts[0], value: valueToSend, });
        expect(await web3.eth.getBalance(testContract.options.address)).to.eq(valueToSend.toString());
        expect(await web3.eth.getBalance(walletAddress)).to.eq('0');
      });

      it('waits for final confirmation to transfer funds, when multisigning transactions', async () => {
        await createWallet(accounts[0], accounts[0], [accounts[0], accounts[1]], 2);
        const walletAddress = wallet.walletAddress;

        const valueToSend = Math.floor(Math.random() * 10000);
        await executor.executeSend({ from: accounts[0], to: walletAddress, value: valueToSend });
        expect(await web3.eth.getBalance(walletAddress)).to.eq(valueToSend.toString());

        const testContract = await executor.createContract(
          'TestContract', ['test'], { from: accounts[0], gas: 1000000, });
        expect(await web3.eth.getBalance(testContract.options.address)).to.eq('0');

        const txInfo = await wallet.submitTransaction(testContract, 'chargeFunds', { from: accounts[0], value: valueToSend, });
        expect(await web3.eth.getBalance(testContract.options.address)).to.eq('0');
        expect(await web3.eth.getBalance(walletAddress)).to.eq(valueToSend.toString());

        await wallet.confirmTransaction(accounts[1], txInfo.result.transactionId);
        expect(await web3.eth.getBalance(testContract.options.address)).to.eq(valueToSend.toString());
        expect(await web3.eth.getBalance(walletAddress)).to.eq('0');
      });
    });
  }

  describe('when using managed wallets', () => {
    async function createWallet(
        executingAccount: string, manager: string, participants: string[], confirmations?: number) {
      // create wallet via factory, returned wallet is of type 'MultiSigWallet'
      if (typeof confirmations !== 'undefined') {
        await wallet.create(executingAccount, manager, participants, confirmations);
      } else {
        await wallet.create(executingAccount, manager, participants);
      }
    }

    runTests('MultiSigWallet', createWallet);

    describe('when managing members', () => {
      it('can add members, when admin', async () => {
        await createWallet(accounts[0], accounts[0], [accounts[0]]);
        expect(await wallet.getOwners()).to.deep.eq([accounts[0]]);
        await wallet.addOwner(accounts[0], accounts[1]);
        expect(await wallet.getOwners()).to.deep.eq([accounts[0], accounts[1]]);
      });

      it('cannot add members, when not admin', async () => {
        await createWallet(accounts[0], accounts[0], [accounts[0]]);
        const promise = wallet.addOwner(accounts[1], accounts[1]);
        await expect(promise).to.be.rejected;
      });

      it('can remove members, when admin', async () => {
        await createWallet(accounts[0], accounts[0], [accounts[0], accounts[1]]);
        expect(await wallet.getOwners()).to.deep.eq([accounts[0], accounts[1]]);
        await wallet.removeOwner(accounts[0], accounts[1]);
        expect(await wallet.getOwners()).to.deep.eq([accounts[0]]);
      });

      it('cannot remove members, when not admin', async () => {
        await createWallet(accounts[0], accounts[0], [accounts[0], accounts[1]]);
        const promise = wallet.removeOwner(accounts[1], accounts[1]);
        await expect(promise).to.be.rejected;
      });
    });
  });

  describe('when using self governed wallets', () => {
    async function createWallet(
        executingAccount: string, manager: string, participants: string[], confirmations?: number) {
      // create wallet by hand
      const walletContract = await executor.createContract(
        'MultiSigWalletSG',
        [ participants, typeof confirmations !== 'undefined' ? confirmations : 1 ],
        { from: executingAccount, gas: 2000000 },
      );
      wallet.load(walletContract.options.address, 'MultiSigWalletSG');
    }

    runTests('MultiSigWalletSG', createWallet);

    describe('when managing members', () => {
      it('can add members, when member of wallet', async () => {
        await createWallet(accounts[0], accounts[0], [accounts[0]]);
        expect(await wallet.getOwners()).to.deep.eq([accounts[0]]);
        await wallet.addOwner(accounts[0], accounts[1]);
        expect(await wallet.getOwners()).to.deep.eq([accounts[0], accounts[1]]);
        await wallet.addOwner(accounts[1], accounts[2]);
        expect(await wallet.getOwners()).to.deep.eq([accounts[0], accounts[1], accounts[2]]);
      });

      it('cannot add members, when not in wallet', async () => {
        await createWallet(accounts[0], accounts[0], [accounts[0]]);
        const promise = wallet.addOwner(accounts[1], accounts[2]);
        await expect(promise).to.be.rejected;
      });

      it('can remove members, when in wallet', async () => {
        await createWallet(accounts[0], accounts[0], [accounts[0], accounts[1]]);
        expect(await wallet.getOwners()).to.deep.eq([accounts[0], accounts[1]]);
        await wallet.removeOwner(accounts[1], accounts[0]);
        expect(await wallet.getOwners()).to.deep.eq([accounts[1]]);
      });

      it('cannot remove members, when not in wallet', async () => {
        await createWallet(accounts[0], accounts[0], [accounts[0]]);
        expect(await wallet.getOwners()).to.deep.eq([accounts[0]]);
        const promise = wallet.removeOwner(accounts[1], accounts[0]);
        await expect(promise).to.be.rejected;
      });
    });
  });
});
