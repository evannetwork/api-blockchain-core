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
  Executor,
} from '@evan.network/dbcp';

import { accounts, useIdentity } from '../test/accounts';
import { TestUtils } from '../test/test-utils';
import { Wallet } from './wallet';
import { Runtime } from '../runtime';

use(chaiAsPromised);


describe('Wallet handler', function test() {
  this.timeout(60000);
  let executor: Executor;
  let identity0: string;
  let identity1: string;
  let runtimes: Runtime[];
  let wallet0: Wallet;
  let wallet1: Wallet;
  let web3: any;

  before(async () => {
    runtimes = await Promise.all(
      accounts.slice(0, 2).map((account) => TestUtils.getRuntime(account, null, { useIdentity })),
    );
    ([{ activeIdentity: identity0, executor, web3 }, { activeIdentity: identity1 }] = runtimes);
    wallet0 = await TestUtils.getWallet(runtimes[0]);
    wallet1 = await TestUtils.getWallet(runtimes[1]);
  });

  function runTests(walletType, createWallet) {
    it('can create new wallets', async () => {
      if (walletType === 'MultiSigWallet') {
        // create wallet via factory, returned wallet is of type 'MultiSigWallet'
        await createWallet(identity0, identity0, [identity0]);
      } else if (walletType === 'MultiSigWalletSG') {
        // create wallet by hand
        const walletContract = await executor.createContract(
          walletType,
          [[identity0], 1],
          { from: identity0, gas: 2000000 },
        );
        wallet0.load(walletContract.options.address, walletType);
      } else {
        throw new Error(`unknown wallet type: ${walletType}`);
      }
    });

    describe('when submitting transactions', () => {
      it('can instantly submit transactions', async () => {
        await createWallet(identity0, identity0, [identity0, identity1]);

        // create test contract and hand over to wallet
        const testContract = await executor.createContract('Owned', [], { from: identity0, gas: 200000 });
        expect(await executor.executeContractCall(testContract, 'owner')).to.eq(identity0);
        await executor.executeContractTransaction(testContract, 'transferOwnership', { from: identity0 }, wallet0.walletAddress);
        expect(await executor.executeContractCall(testContract, 'owner')).to.eq(wallet0.walletAddress);

        await wallet0.submitTransaction(testContract, 'transferOwnership', { from: identity0 }, identity1);
        expect(await executor.executeContractCall(testContract, 'owner')).to.eq(identity1);

        await runtimes[1].executor.executeContractTransaction(testContract, 'transferOwnership', { from: identity1 }, wallet0.walletAddress);

        await wallet1.submitTransaction(testContract, 'transferOwnership', { from: identity1 }, identity0);
        expect(await executor.executeContractCall(testContract, 'owner')).to.eq(identity0);
      });

      it('cannot submit transactions, when not in owners group', async () => {
        await createWallet(identity0, identity0, [identity0]);

        // create test contract and hand over to wallet
        const testContract = await executor.createContract('Owned', [], { from: identity0, gas: 200000 });
        expect(await executor.executeContractCall(testContract, 'owner')).to.eq(identity0);
        await executor.executeContractTransaction(testContract, 'transferOwnership', { from: identity0 }, wallet0.walletAddress);
        expect(await executor.executeContractCall(testContract, 'owner')).to.eq(wallet0.walletAddress);

        const promise = wallet1.submitTransaction(testContract, 'transferOwnership', { from: identity1 }, identity1);
        await expect(promise).to.be.rejected;
      });
    });

    describe('when submitting transactions on wallets for multiple accounts', () => {
      async function createContract() {
        const contract = await executor.createContract(
          'Owned', [], { from: identity0, gas: 200000 },
        );
        await executor.executeContractTransaction(
          contract,
          'transferOwnership',
          { from: identity0 },
          wallet0.walletAddress,
        );
        return contract;
      }

      before(async () => {
        // setup wallet that needs 2 confirmations
        await createWallet(identity0, identity0, [identity0, identity1], 2);
      });

      it('allows any member to submit transactions', async () => {
        const testContract = await createContract();
        // test with account1
        await expect(wallet0.submitTransaction(
          testContract, 'transferOwnership', { from: identity0 }, identity1,
        )).not.to.be.rejected;
        // test with account2
        await expect(wallet1.submitTransaction(
          testContract, 'transferOwnership', { from: identity1 }, identity0,
        )).not.to.be.rejected;
      });

      it('returns txinfo upon submitting a tx and missing confirmations', async () => {
        const testContract = await createContract();
        const txInfo = await wallet0.submitTransaction(
          testContract, 'transferOwnership', { from: identity0 }, identity1,
        );
        expect(txInfo).to.be.ok;
        expect(txInfo.result).to.be.ok;
        expect(txInfo.result.status).to.eq('pending');
        expect(txInfo.result.transactionId).to.match(/\d+/);

        // still owned by wallet
        expect(await executor.executeContractCall(testContract, 'owner'))
          .to.eq(wallet0.walletAddress);
      });

      it('executes tx when submitting the final confirmation', async () => {
        const testContract = await createContract();
        const txInfo = await wallet0.submitTransaction(
          testContract, 'transferOwnership', { from: identity0 }, identity1,
        );

        // still owned by wallet
        expect(await executor.executeContractCall(testContract, 'owner'))
          .to.eq(wallet0.walletAddress);

        wallet1.load(wallet0.walletAddress, wallet0.walletType);
        await wallet1.confirmTransaction(identity1, txInfo.result.transactionId);

        // ownership has changed
        expect(await executor.executeContractCall(testContract, 'owner')).to.eq(identity1);
      });
    });

    describe('when submitting funds alongside transactions', () => {
      it('allows to transfer funds to wallet', async () => {
        await createWallet(identity0, identity0, [identity0]);
        const { walletAddress } = wallet0;
        const valueToSend = Math.floor(Math.random() * 10000);
        const executeSendP = executor.executeSend(
          { from: identity0, to: walletAddress, value: valueToSend },
        );
        await expect(executeSendP).not.to.be.rejected;
        expect(await web3.eth.getBalance(walletAddress)).to.eq(valueToSend.toString());
      });

      it('instantly submits funds to target if instantly submitting transaction', async () => {
        await createWallet(identity0, identity0, [identity0]);
        const { walletAddress } = wallet0;

        const valueToSend = Math.floor(Math.random() * 10000);
        await executor.executeSend({ from: identity0, to: walletAddress, value: valueToSend });
        expect(await web3.eth.getBalance(walletAddress)).to.eq(valueToSend.toString());

        const testContract = await executor.createContract(
          'TestContract', ['test'], { from: identity0, gas: 1000000 },
        );
        expect(await web3.eth.getBalance(testContract.options.address)).to.eq('0');

        await wallet0.submitTransaction(testContract, 'chargeFunds', { from: identity0, value: valueToSend });
        expect(await web3.eth.getBalance(testContract.options.address))
          .to.eq(valueToSend.toString());
        expect(await web3.eth.getBalance(walletAddress)).to.eq('0');
      });

      it('waits for final confirmation to transfer funds, when multisigning transactions', async () => {
        await createWallet(identity0, identity0, [identity0, identity1], 2);
        const { walletAddress } = wallet0;

        const valueToSend = Math.floor(Math.random() * 10000);
        await executor.executeSend({ from: identity0, to: walletAddress, value: valueToSend });
        expect(await web3.eth.getBalance(walletAddress)).to.eq(valueToSend.toString());

        const testContract = await executor.createContract(
          'TestContract', ['test'], { from: identity0, gas: 1000000 },
        );
        expect(await web3.eth.getBalance(testContract.options.address)).to.eq('0');

        const txInfo = await wallet0.submitTransaction(testContract, 'chargeFunds', { from: identity0, value: valueToSend });
        expect(await web3.eth.getBalance(testContract.options.address)).to.eq('0');
        expect(await web3.eth.getBalance(walletAddress)).to.eq(valueToSend.toString());

        await wallet1.confirmTransaction(identity1, txInfo.result.transactionId);
        expect(await web3.eth.getBalance(testContract.options.address))
          .to.eq(valueToSend.toString());
        expect(await web3.eth.getBalance(walletAddress)).to.eq('0');
      });
    });
  }

  describe('when using managed wallets', () => {
    async function createWallet(
      executingAccount: string,
      manager: string,
      participants: string[],
      confirmations?: number,
    ) {
      // create wallet via factory, returned wallet is of type 'MultiSigWallet'
      if (typeof confirmations !== 'undefined') {
        await wallet0.create(executingAccount, manager, participants, confirmations);
      } else {
        await wallet0.create(executingAccount, manager, participants);
      }
      wallet1.load(wallet0.walletAddress, wallet0.walletType);
    }

    runTests('MultiSigWallet', createWallet);

    describe('when managing members', () => {
      it('can add members, when admin', async () => {
        await createWallet(identity0, identity0, [identity0]);
        expect(await wallet0.getOwners()).to.deep.eq([identity0]);
        await wallet0.addOwner(identity0, identity1);
        expect(await wallet0.getOwners()).to.deep.eq([identity0, identity1]);
      });

      it('cannot add members, when not admin', async () => {
        await createWallet(identity0, identity0, [identity0]);
        const promise = wallet0.addOwner(identity1, identity1);
        await expect(promise).to.be.rejected;
      });

      it('can remove members, when admin', async () => {
        await createWallet(identity0, identity0, [identity0, identity1]);
        expect(await wallet0.getOwners()).to.deep.eq([identity0, identity1]);
        await wallet0.removeOwner(identity0, identity1);
        expect(await wallet0.getOwners()).to.deep.eq([identity0]);
      });

      it('cannot remove members, when not admin', async () => {
        await createWallet(identity0, identity0, [identity0, identity1]);
        const promise = wallet0.removeOwner(identity1, identity1);
        await expect(promise).to.be.rejected;
      });
    });
  });

  describe('when using self governed wallets', () => {
    async function createWallet(
      executingAccount: string,
      manager: string,
      participants: string[],
      confirmations?: number,
    ) {
      // create wallet by hand
      const walletContract = await executor.createContract(
        'MultiSigWalletSG',
        [participants, typeof confirmations !== 'undefined' ? confirmations : 1],
        { from: identity0, gas: 2000000 },
      );
      wallet0.load(walletContract.options.address, 'MultiSigWalletSG');
      wallet1.load(wallet0.walletAddress, wallet0.walletType);
    }

    runTests('MultiSigWalletSG', createWallet);

    describe('when managing members', () => {
      it('can add members, when member of wallet', async () => {
        await createWallet(identity0, identity0, [identity0]);
        expect(await wallet0.getOwners()).to.deep.eq([identity0]);
        await wallet0.addOwner(identity0, identity1);
        expect(await wallet0.getOwners()).to.deep.eq([identity0, identity1]);
        await wallet1.addOwner(identity1, accounts[2]);
        expect(await wallet0.getOwners()).to.deep.eq([identity0, identity1, accounts[2]]);
      });

      it('cannot add members, when not in wallet', async () => {
        await createWallet(identity0, identity0, [identity0]);
        const promise = wallet1.addOwner(identity1, accounts[2]);
        await expect(promise).to.be.rejected;
      });

      it('can remove members, when in wallet', async () => {
        await createWallet(identity0, identity0, [identity0, identity1]);
        expect(await wallet0.getOwners()).to.deep.eq([identity0, identity1]);
        await wallet1.removeOwner(identity1, identity0);
        expect(await wallet0.getOwners()).to.deep.eq([identity1]);
      });

      it('cannot remove members, when not in wallet', async () => {
        await createWallet(identity0, identity0, [identity0]);
        expect(await wallet0.getOwners()).to.deep.eq([identity0]);
        const promise = wallet0.removeOwner(identity1, identity0);
        await expect(promise).to.be.rejected;
      });
    });
  });
});
