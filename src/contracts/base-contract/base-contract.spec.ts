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
import {
  ContractLoader,
  EventHub,
  Executor,
} from '@evan.network/dbcp';

import { accounts, useIdentity } from '../../test/accounts';
import { ConsumerState, ContractState } from './base-contract';
import { configTestcore as config } from '../../config-testcore';
import { Ipfs } from '../../dfs/ipfs';
import { Ipld } from '../../dfs/ipld';
import { TestUtils } from '../../test/test-utils';
import { Runtime } from '../../runtime';


use(chaiAsPromised);

describe('runtimes[0].baseContract', function test() {
  this.timeout(60000);
  let identity1; let identity2; let
    identity3: string;
  let businessCenterDomain;
  let runtimes: Runtime[];

  before(async () => {
    runtimes = await Promise.all(
      accounts.slice(0, 3).map(
        (account) => TestUtils.getRuntime(account, null, { useIdentity }),
      ),
    );
    identity1 = runtimes[0].activeIdentity;
    identity2 = runtimes[1].activeIdentity;
    identity3 = runtimes[2].activeIdentity;
    businessCenterDomain = runtimes[0].nameResolver.getDomainName(
      config.nameResolver.domains.businessCenter,
    );
    const businessCenterAddress = await runtimes[0].nameResolver.getAddress(businessCenterDomain);
    const businessCenter = await runtimes[0].contractLoader.loadContract('BusinessCenter', businessCenterAddress);
    await runtimes[0].profile.loadForAccount();
    // await profile.setContactKnownState(identity1, true);
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
    const contractId = await runtimes[0].baseContract.createUninitialized(
      'testdatacontract',
      identity1,
      businessCenterDomain,
    );
    expect(contractId).not.to.be.undefined;
  });

  it('can not be created', async () => {
    const contractPromise = runtimes[0].baseContract.createUninitialized(
      'testdatacontract',
      identity1,
      'testdatacontract.factory.testbc.evan',
    );
    expect(contractPromise).to.be.rejected;
  });

  it('can have new members invited to it by the owner', async () => {
    const contractId = await runtimes[0].baseContract.createUninitialized(
      'testdatacontract',
      identity1,
      businessCenterDomain,
    );
    const contract = runtimes[0].contractLoader.loadContract('BaseContractInterface', contractId);
    let isMember = await runtimes[0].executor.executeContractCall(contract, 'isConsumer', identity2);
    expect(isMember).to.be.false;
    await runtimes[0].baseContract.inviteToContract(
      businessCenterDomain,
      contractId,
      identity1,
      identity2,
    );
    isMember = await runtimes[0].executor.executeContractCall(contract, 'isConsumer', identity2);
    expect(isMember).to.be.true;
  });

  it('can remove invited members to it by the owner', async () => {
    const contractId = await runtimes[0].baseContract.createUninitialized(
      'testdatacontract',
      identity1,
      businessCenterDomain,
    );
    const contract = runtimes[0].contractLoader.loadContract('BaseContractInterface', contractId);
    let isMember = await runtimes[0].executor.executeContractCall(contract, 'isConsumer', identity2);
    expect(isMember).to.be.false;
    await runtimes[0].baseContract.inviteToContract(
      businessCenterDomain,
      contractId,
      identity1,
      identity2,
    );
    isMember = await runtimes[0].executor.executeContractCall(contract, 'isConsumer', identity2);
    expect(isMember).to.be.true;
    await runtimes[0].baseContract.removeFromContract(
      businessCenterDomain,
      contractId,
      identity1,
      identity2,
    );
    isMember = await runtimes[0].executor.executeContractCall(contract, 'isConsumer', identity2);
    expect(isMember).to.be.false;
  });

  it('cannot have new members invited to it by members that are not the owner ', async () => {
    const contractId = await runtimes[0].baseContract.createUninitialized(
      'testdatacontract',
      identity1,
      businessCenterDomain,
    );
    await runtimes[0].baseContract.inviteToContract(
      businessCenterDomain,
      contractId,
      identity1,
      identity2,
    );
    const promise = runtimes[0].baseContract.inviteToContract(
      businessCenterDomain,
      contractId,
      identity2,
      identity3,
    );
    await expect(promise).to.be.rejected;
  });

  it('cannot have new members invited to it by users that are not in the contract ', async () => {
    const contractId = await runtimes[0].baseContract.createUninitialized(
      'testdatacontract',
      identity1,
      businessCenterDomain,
    );
    const promise = runtimes[0].baseContract.inviteToContract(
      businessCenterDomain,
      contractId,
      identity2,
      identity3,
    );
    await expect(promise).to.be.rejected;
  });

  // intendend skip, tested but currently not activated
  it.skip('cannot have members invited, when the invitee doesn\'t know / ignores inviter', async () => {
    const contractId = await runtimes[0].baseContract.createUninitialized(
      'testdatacontract',
      identity1,
      businessCenterDomain,
    );
    const contract = runtimes[0].contractLoader.loadContract('BaseContractInterface', contractId);
    const isMember = await runtimes[0].executor.executeContractCall(contract, 'isConsumer', identity2);
    expect(isMember).to.be.false;
    await runtimes[0].profile.setContactKnownState(identity1, false);
    const invitePromise = runtimes[0].baseContract.inviteToContract(
      businessCenterDomain,
      contractId,
      identity1,
      identity2,
    );
    await expect(invitePromise).to.be.rejected;
    await runtimes[0].profile.setContactKnownState(identity1, true);
  });

  it('can have its state set by the owner', async () => {
    const contractId = await runtimes[0].baseContract.createUninitialized(
      'testdatacontract',
      identity1,
      businessCenterDomain,
    );
    await runtimes[0].baseContract.changeContractState(
      contractId,
      identity1,
      ContractState.PendingApproval,
    );
  });

  it('cannot have its state set by members that are not the owner', async () => {
    const contractId = await runtimes[0].baseContract.createUninitialized(
      'testdatacontract',
      identity1,
      businessCenterDomain,
    );
    await runtimes[0].baseContract.inviteToContract(
      businessCenterDomain,
      contractId,
      identity1,
      identity2,
    );
    const promise = runtimes[0].baseContract.changeContractState(
      contractId,
      identity2,
      ContractState.PendingApproval,
    );
    await expect(promise).to.be.rejected;
  });

  it('cannot have its state set by users that are not in the contract', async () => {
    const contractId = await runtimes[0].baseContract.createUninitialized(
      'testdatacontract',
      identity1,
      businessCenterDomain,
    );
    const promise = runtimes[0].baseContract.changeContractState(contractId, identity2, 1);
    await expect(promise).to.be.rejected;
  });

  it('can have the owner set its own state', async () => {
    const contractId = await runtimes[0].baseContract.createUninitialized(
      'testdatacontract',
      identity1,
      businessCenterDomain,
    );
    await runtimes[0].baseContract.changeConsumerState(
      contractId,
      identity1,
      identity1,
      ConsumerState.Active,
    );
  });

  describe('when used without a business center', () => {
    it('can be created', async () => {
      const contractId = await runtimes[0].baseContract.createUninitialized(
        'testdatacontract',
        identity1,
        null,
      );
      await runtimes[0].baseContract.changeConsumerState(
        contractId,
        identity1,
        identity1,
        ConsumerState.Active,
      );
    });

    it('can have new members invited to it by the owner', async () => {
      const contractId = await runtimes[0].baseContract.createUninitialized(
        'testdatacontract',
        identity1,
        null,
      );
      const contract = runtimes[0].contractLoader.loadContract('BaseContractInterface', contractId);
      let isMember = await runtimes[0].executor.executeContractCall(contract, 'isConsumer', identity2);
      expect(isMember).to.be.false;
      await runtimes[0].baseContract.inviteToContract(
        null,
        contractId,
        identity1,
        identity2,
      );
      isMember = await runtimes[0].executor.executeContractCall(contract, 'isConsumer', identity2);
      expect(isMember).to.be.true;
    });

    it('can remove invited members to it by the owner', async () => {
      const contractId = await runtimes[0].baseContract.createUninitialized(
        'testdatacontract',
        identity1,
        null,
      );
      const contract = runtimes[0].contractLoader.loadContract('BaseContractInterface', contractId);
      let isMember = await runtimes[0].executor.executeContractCall(contract, 'isConsumer', identity2);
      expect(isMember).to.be.false;
      await runtimes[0].baseContract.inviteToContract(
        null,
        contractId,
        identity1,
        identity2,
      );
      isMember = await runtimes[0].executor.executeContractCall(contract, 'isConsumer', identity2);
      expect(isMember).to.be.true;
      await runtimes[0].baseContract.removeFromContract(
        null,
        contractId,
        identity1,
        identity2,
      );
      isMember = await runtimes[0].executor.executeContractCall(contract, 'isConsumer', identity2);
      expect(isMember).to.be.false;
    });

    // eslint-disable-next-line
    it('triggers contract events from on its own instead of letting the bc do this', async () => {
      // eslint-disable-next-line
      return new Promise(async (resolve, reject) => {
        try {
          const contractId = await runtimes[0].baseContract.createUninitialized(
            'testdatacontract',
            identity1,
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
          await runtimes[0].baseContract.inviteToContract(
            null,
            contractId,
            identity1,
            identity2,
          );
        } catch (ex) {
          reject(ex);
        }
      });
    });
  });
});
