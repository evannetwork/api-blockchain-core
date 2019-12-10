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

import { accounts } from '../../test/accounts';
import { BaseContract, ConsumerState, ContractState } from './base-contract';
import { configTestcore as config } from '../../config-testcore';
import { Ipfs } from '../../dfs/ipfs';
import { Ipld } from '../../dfs/ipld';
import { Profile } from '../../profile/profile';
import { TestUtils } from '../../test/test-utils';


use(chaiAsPromised);

describe('BaseContract', function() {
  this.timeout(60000);
  let baseContract: BaseContract;
  let executor: Executor;
  let ipfs: Ipfs;
  let ipld: Ipld;
  let loader: ContractLoader;
  let businessCenterDomain;
  let eventHub: EventHub;
  let nameResolver;
  let profile: Profile;
  let web3;

  before(async () => {
    web3 = TestUtils.getWeb3();
    nameResolver = await TestUtils.getNameResolver(web3);
    executor = await TestUtils.getExecutor(web3);
    eventHub = await TestUtils.getEventHub(web3);
    executor.eventHub = eventHub;
    loader = await TestUtils.getContractLoader(web3);
    baseContract = new BaseContract({
      executor,
      loader,
      log: TestUtils.getLogger(),
      nameResolver,
    });
    businessCenterDomain = nameResolver.getDomainName(config.nameResolver.domains.businessCenter);
    const businessCenterAddress = await nameResolver.getAddress(businessCenterDomain);
    const businessCenter = await loader.loadContract('BusinessCenter', businessCenterAddress);
    ipfs = await TestUtils.getIpfs();
    ipld = await TestUtils.getIpld(ipfs);
    ipld.originator = nameResolver.soliditySha3(accounts[1]);
    profile = await TestUtils.getProfile(web3, ipfs);
    await profile.loadForAccount();
    // await profile.setContactKnownState(accounts[0], true);
    if (!await executor.executeContractCall(businessCenter, 'isMember', accounts[0], { from: accounts[0], })) {
      await executor.executeContractTransaction(businessCenter, 'join', { from: accounts[0], autoGas: 1.1, });
    }
    if (!await executor.executeContractCall(businessCenter, 'isMember', accounts[1], { from: accounts[1], })) {
      await executor.executeContractTransaction(businessCenter, 'join', { from: accounts[1], autoGas: 1.1, });
    }
    if (!await executor.executeContractCall(businessCenter, 'isMember', accounts[2], { from: accounts[2], })) {
      await executor.executeContractTransaction(businessCenter, 'join', { from: accounts[2], autoGas: 1.1, });
    }
  });

  it('can be created', async () => {
    const contractId = await baseContract.createUninitialized(
      'testdatacontract',
      accounts[0],
      businessCenterDomain);
    expect(contractId).not.to.be.undefined;
  });

  it('can not be created', async () => {
    const contractPromise = baseContract.createUninitialized(
      'testdatacontract',
      accounts[0],
      'testdatacontract.factory.testbc.evan');
    expect(contractPromise).to.be.rejected;
  });

  it('can have new members invited to it by the owner', async () => {
    const contractId = await baseContract.createUninitialized(
      'testdatacontract',
      accounts[0],
      businessCenterDomain);
    const contract = loader.loadContract('BaseContractInterface', contractId);
    let isMember = await executor.executeContractCall(contract, 'isConsumer', accounts[1]);
    expect(isMember).to.be.false;
    await baseContract.inviteToContract(
      businessCenterDomain,
      contractId,
      accounts[0],
      accounts[1],
    );
    isMember = await executor.executeContractCall(contract, 'isConsumer', accounts[1]);
    expect(isMember).to.be.true;
  });

  it('can remove invited members to it by the owner', async () => {
    const contractId = await baseContract.createUninitialized(
      'testdatacontract',
      accounts[0],
      businessCenterDomain);
    const contract = loader.loadContract('BaseContractInterface', contractId);
    let isMember = await executor.executeContractCall(contract, 'isConsumer', accounts[1]);
    expect(isMember).to.be.false;
    await baseContract.inviteToContract(
      businessCenterDomain,
      contractId,
      accounts[0],
      accounts[1],
    );
    isMember = await executor.executeContractCall(contract, 'isConsumer', accounts[1]);
    expect(isMember).to.be.true;
    await baseContract.removeFromContract(
      businessCenterDomain,
      contractId,
      accounts[0],
      accounts[1],
    );
    isMember = await executor.executeContractCall(contract, 'isConsumer', accounts[1]);
    expect(isMember).to.be.false;
  });

  it('cannot have new members invited to it by members that are not the owner ', async () => {
    const contractId = await baseContract.createUninitialized(
      'testdatacontract',
      accounts[0],
      businessCenterDomain);
    await baseContract.inviteToContract(
      businessCenterDomain,
      contractId,
      accounts[0],
      accounts[1],
    );
    const promise = baseContract.inviteToContract(
      businessCenterDomain,
      contractId,
      accounts[1],
      accounts[2],
    );
    await expect(promise).to.be.rejected;
  });

  it('cannot have new members invited to it by users that are not in the contract ', async () => {
    const contractId = await baseContract.createUninitialized(
      'testdatacontract',
      accounts[0],
      businessCenterDomain);
    const promise = baseContract.inviteToContract(
      businessCenterDomain,
      contractId,
      accounts[1],
      accounts[2],
    );
    await expect(promise).to.be.rejected;
  });

  // intendend skip, tested but currently not activated
  it.skip('cannot have members invited, when the invitee doesn\'t know / ignores inviter', async () => {
    const contractId = await baseContract.createUninitialized(
      'testdatacontract',
      accounts[0],
      businessCenterDomain);
    const contract = loader.loadContract('BaseContractInterface', contractId);
    const isMember = await executor.executeContractCall(contract, 'isConsumer', accounts[1]);
    expect(isMember).to.be.false;
    await profile.setContactKnownState(accounts[0], false);
    const invitePromise = baseContract.inviteToContract(
      businessCenterDomain,
      contractId,
      accounts[0],
      accounts[1],
    );
    await expect(invitePromise).to.be.rejected;
    await profile.setContactKnownState(accounts[0], true);
  });

  it('can have its state set by the owner', async () => {
    const contractId = await baseContract.createUninitialized(
      'testdatacontract',
      accounts[0],
      businessCenterDomain);
    await baseContract.changeContractState(contractId, accounts[0], ContractState.PendingApproval);
  });

  it('cannot have its state set by members that are not the owner', async () => {
    const contractId = await baseContract.createUninitialized(
      'testdatacontract',
      accounts[0],
      businessCenterDomain);
    await baseContract.inviteToContract(
      businessCenterDomain,
      contractId,
      accounts[0],
      accounts[1],
    );
    const promise = baseContract.changeContractState(contractId, accounts[1], ContractState.PendingApproval);
    await expect(promise).to.be.rejected;
  });

  it('cannot have its state set by users that are not in the contract', async () => {
    const contractId = await baseContract.createUninitialized(
      'testdatacontract',
      accounts[0],
      businessCenterDomain);
    const promise = baseContract.changeContractState(contractId, accounts[1], 1);
    await expect(promise).to.be.rejected;
  });

  it('can have the owner set its own state', async () => {
    const contractId = await baseContract.createUninitialized(
      'testdatacontract',
      accounts[0],
      businessCenterDomain);
    await baseContract.changeConsumerState(contractId, accounts[0], accounts[0], ConsumerState.Active);
  });

  describe('when used without a business center', () => {
    it('can be created', async () => {
      const contractId = await baseContract.createUninitialized(
        'testdatacontract',
        accounts[0],
        null);
      await baseContract.changeConsumerState(contractId, accounts[0], accounts[0], ConsumerState.Active);
    });

    it('can have new members invited to it by the owner', async () => {
      const contractId = await baseContract.createUninitialized(
        'testdatacontract',
        accounts[0],
        null);
      const contract = loader.loadContract('BaseContractInterface', contractId);
      let isMember = await executor.executeContractCall(contract, 'isConsumer', accounts[1]);
      expect(isMember).to.be.false;
      await baseContract.inviteToContract(
        null,
        contractId,
        accounts[0],
        accounts[1],
      );
      isMember = await executor.executeContractCall(contract, 'isConsumer', accounts[1]);
      expect(isMember).to.be.true;
    });

    it('can remove invited members to it by the owner', async () => {
      const contractId = await baseContract.createUninitialized(
        'testdatacontract',
        accounts[0],
        null);
      const contract = loader.loadContract('BaseContractInterface', contractId);
      let isMember = await executor.executeContractCall(contract, 'isConsumer', accounts[1]);
      expect(isMember).to.be.false;
      await baseContract.inviteToContract(
        null,
        contractId,
        accounts[0],
        accounts[1],
      );
      isMember = await executor.executeContractCall(contract, 'isConsumer', accounts[1]);
      expect(isMember).to.be.true;
      await baseContract.removeFromContract(
        null,
        contractId,
        accounts[0],
        accounts[1],
      );
      isMember = await executor.executeContractCall(contract, 'isConsumer', accounts[1]);
      expect(isMember).to.be.false;
    });

    it('triggers contract events from on its own instead of letting the bc do this', async () => {
      return new Promise(async (resolve, reject) => {
        try {
          const contractId = await baseContract.createUninitialized(
            'testdatacontract',
            accounts[0],
            null);
          // reject on timeout
          let resolved;
          setTimeout(() => {
            if (!resolved) {
              reject('timeout during waiting for ContractEvent');
            }
          }, 10000);
          // if event is triggered, resolve test
          eventHub.once('EventHub', null, 'ContractEvent',
            (event) => {
              const { sender, eventType } = event.returnValues;
              return sender === contractId && eventType.toString() === '0';
            },
            () => { resolved = true; resolve(); }
          );
          await baseContract.inviteToContract(
            null,
            contractId,
            accounts[0],
            accounts[1],
          );
        } catch (ex) {
          reject(ex);
        }
      });
    });
  });
});
