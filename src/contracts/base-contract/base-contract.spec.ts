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
import * as chaiAsPromised from 'chai-as-promised';
import { expect, use } from 'chai';
import { ContractLoader } from '@evan.network/dbcp';
import { accounts, useIdentity } from '../../test/accounts';
import { ConsumerState, ContractState, BaseContract } from './base-contract';
import { configTestcore as config } from '../../config-testcore';
import { TestUtils } from '../../test/test-utils';
import { Runtime } from '../../runtime';
import { Executor } from '../..';


use(chaiAsPromised);

describe('baseContract', function test() {
  this.timeout(60000);
  let baseContract: BaseContract;
  let contractLoader: ContractLoader;
  let executor: Executor;
  let identity0: string;
  let identity1: string;
  let identity2: string;
  let businessCenterDomain;
  let runtimes: Runtime[];

  before(async () => {
    runtimes = await Promise.all(
      accounts.slice(0, 3).map(
        (account) => TestUtils.getRuntime(account, null, { useIdentity }),
      ),
    );
    identity0 = runtimes[0].activeIdentity;
    identity1 = runtimes[1].activeIdentity;
    identity2 = runtimes[2].activeIdentity;
    await runtimes[0].profile.loadForAccount();
    executor = runtimes[0].executor;
    baseContract = runtimes[0].baseContract;
    contractLoader = runtimes[0].contractLoader;

    businessCenterDomain = runtimes[0].nameResolver.getDomainName(
      config.nameResolver.domains.businessCenter,
    );
    const businessCenterAddress = await runtimes[0].nameResolver.getAddress(businessCenterDomain);
    const businessCenter = await contractLoader.loadContract('BusinessCenter', businessCenterAddress);
    for (const runtime of runtimes) {
      const isMember = await runtime.executor.executeContractCall(
        businessCenter,
        'isMember',
        runtime.activeIdentity,
        { from: runtime.activeIdentity },
      );
      if (!isMember) {
        await runtime.executor.executeContractTransaction(
          businessCenter,
          'join',
          { from: runtime.activeIdentity, autoGas: 1.1 },
        );
      }
    }
  });

  it('can be created', async () => {
    const contractId = await baseContract.createUninitialized(
      'testdatacontract',
      identity0,
      businessCenterDomain,
    );
    expect(contractId).not.to.be.undefined;
  });

  it('can not be created', async () => {
    const contractPromise = baseContract.createUninitialized(
      'testdatacontract',
      identity0,
      'testdatacontract.factory.testbc.evan',
    );
    expect(contractPromise).to.be.rejected;
  });

  it('can have new members invited to it by the owner', async () => {
    const contractId = await baseContract.createUninitialized(
      'testdatacontract',
      identity0,
      businessCenterDomain,
    );
    const contract = contractLoader.loadContract('BaseContractInterface', contractId);
    let isMember = await executor.executeContractCall(contract, 'isConsumer', identity1);
    expect(isMember).to.be.false;
    await baseContract.inviteToContract(
      businessCenterDomain,
      contractId,
      identity0,
      identity1,
    );
    isMember = await executor.executeContractCall(contract, 'isConsumer', identity1);
    expect(isMember).to.be.true;
  });

  it('can remove invited members to it by the owner', async () => {
    const contractId = await baseContract.createUninitialized(
      'testdatacontract',
      identity0,
      businessCenterDomain,
    );
    const contract = contractLoader.loadContract('BaseContractInterface', contractId);
    let isMember = await executor.executeContractCall(contract, 'isConsumer', identity1);
    expect(isMember).to.be.false;
    await baseContract.inviteToContract(
      businessCenterDomain,
      contractId,
      identity0,
      identity1,
    );
    isMember = await executor.executeContractCall(contract, 'isConsumer', identity1);
    expect(isMember).to.be.true;
    await baseContract.removeFromContract(
      businessCenterDomain,
      contractId,
      identity0,
      identity1,
    );
    isMember = await executor.executeContractCall(contract, 'isConsumer', identity1);
    expect(isMember).to.be.false;
  });

  it('cannot have new members invited to it by members that are not the owner ', async () => {
    const contractId = await baseContract.createUninitialized(
      'testdatacontract',
      identity0,
      businessCenterDomain,
    );
    await baseContract.inviteToContract(
      businessCenterDomain,
      contractId,
      identity0,
      identity1,
    );
    const promise = baseContract.inviteToContract(
      businessCenterDomain,
      contractId,
      identity1,
      identity2,
    );
    await expect(promise).to.be.rejected;
  });

  it('cannot have new members invited to it by users that are not in the contract ', async () => {
    const contractId = await baseContract.createUninitialized(
      'testdatacontract',
      identity0,
      businessCenterDomain,
    );
    const promise = baseContract.inviteToContract(
      businessCenterDomain,
      contractId,
      identity1,
      identity2,
    );
    await expect(promise).to.be.rejected;
  });

  // intendend skip, tested but currently not activated
  it.skip('cannot have members invited, when the invitee doesn\'t know / ignores inviter', async () => {
    const contractId = await baseContract.createUninitialized(
      'testdatacontract',
      identity0,
      businessCenterDomain,
    );
    const contract = contractLoader.loadContract('BaseContractInterface', contractId);
    const isMember = await executor.executeContractCall(contract, 'isConsumer', identity1);
    expect(isMember).to.be.false;
    await runtimes[0].profile.setContactKnownState(identity0, false);
    const invitePromise = baseContract.inviteToContract(
      businessCenterDomain,
      contractId,
      identity0,
      identity1,
    );
    await expect(invitePromise).to.be.rejected;
    await runtimes[0].profile.setContactKnownState(identity0, true);
  });

  it('can have its state set by the owner', async () => {
    const contractId = await baseContract.createUninitialized(
      'testdatacontract',
      identity0,
      businessCenterDomain,
    );
    await baseContract.changeContractState(
      contractId,
      identity0,
      ContractState.PendingApproval,
    );
  });

  it('cannot have its state set by members that are not the owner', async () => {
    const contractId = await baseContract.createUninitialized(
      'testdatacontract',
      identity0,
      businessCenterDomain,
    );
    await baseContract.inviteToContract(
      businessCenterDomain,
      contractId,
      identity0,
      identity1,
    );
    const promise = baseContract.changeContractState(
      contractId,
      identity1,
      ContractState.PendingApproval,
    );
    await expect(promise).to.be.rejected;
  });

  it('cannot have its state set by users that are not in the contract', async () => {
    const contractId = await baseContract.createUninitialized(
      'testdatacontract',
      identity0,
      businessCenterDomain,
    );
    const promise = baseContract.changeContractState(contractId, identity1, 1);
    await expect(promise).to.be.rejected;
  });

  it('can have the owner set its own state', async () => {
    const contractId = await baseContract.createUninitialized(
      'testdatacontract',
      identity0,
      businessCenterDomain,
    );
    await baseContract.changeConsumerState(
      contractId,
      identity0,
      identity0,
      ConsumerState.Active,
    );
  });

  describe('when used without a business center', () => {
    it('can be created', async () => {
      const contractId = await baseContract.createUninitialized(
        'testdatacontract',
        identity0,
        null,
      );
      await baseContract.changeConsumerState(
        contractId,
        identity0,
        identity0,
        ConsumerState.Active,
      );
    });

    it('can have new members invited to it by the owner', async () => {
      const contractId = await baseContract.createUninitialized(
        'testdatacontract',
        identity0,
        null,
      );
      const contract = contractLoader.loadContract('BaseContractInterface', contractId);
      let isMember = await executor.executeContractCall(contract, 'isConsumer', identity1);
      expect(isMember).to.be.false;
      await baseContract.inviteToContract(
        null,
        contractId,
        identity0,
        identity1,
      );
      isMember = await executor.executeContractCall(contract, 'isConsumer', identity1);
      expect(isMember).to.be.true;
    });

    it('can remove invited members to it by the owner', async () => {
      const contractId = await baseContract.createUninitialized(
        'testdatacontract',
        identity0,
        null,
      );
      const contract = contractLoader.loadContract('BaseContractInterface', contractId);
      let isMember = await executor.executeContractCall(contract, 'isConsumer', identity1);
      expect(isMember).to.be.false;
      await baseContract.inviteToContract(
        null,
        contractId,
        identity0,
        identity1,
      );
      isMember = await executor.executeContractCall(contract, 'isConsumer', identity1);
      expect(isMember).to.be.true;
      await baseContract.removeFromContract(
        null,
        contractId,
        identity0,
        identity1,
      );
      isMember = await executor.executeContractCall(contract, 'isConsumer', identity1);
      expect(isMember).to.be.false;
    });

    // eslint-disable-next-line
    it('triggers contract events from on its own instead of letting the bc do this', async () => {
      // eslint-disable-next-line
      return new Promise(async (resolve, reject) => {
        try {
          const contractId = await baseContract.createUninitialized(
            'testdatacontract',
            identity0,
            null,
          );
          // reject on timeout
          let resolved;
          setTimeout(() => {
            if (!resolved) {
              reject(new Error('timeout during waiting for ContractEvent'));
            }
          }, 10000);
          // if event is triggered, resolve test
          runtimes[0].eventHub.once('EventHub', null, 'ContractEvent',
            (event) => {
              const { sender, eventType } = event.returnValues;
              return sender === contractId && eventType.toString() === '0';
            },
            () => {
              resolved = true; resolve();
            });
          await baseContract.inviteToContract(
            null,
            contractId,
            identity0,
            identity1,
          );
        } catch (ex) {
          reject(ex);
        }
      });
    });
  });
});
