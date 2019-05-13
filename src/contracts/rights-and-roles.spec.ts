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
import * as Throttle from 'promise-parallel-throttle';
import chaiAsPromised = require('chai-as-promised');
import { expect, use } from 'chai';

import {
  ContractLoader,
  Executor,
  NameResolver,
} from '@evan.network/dbcp';

import { accounts } from '../test/accounts';
import { config } from '../config';
import { DataContract } from './data-contract/data-contract';
import { RightsAndRoles, ModificationType, PropertyType } from './rights-and-roles';
import { ServiceContract } from './service-contract/service-contract';
import { TestUtils } from '../test/test-utils'

use(chaiAsPromised);


describe('Rights and Roles handler', function() {
  this.timeout(300000);
  let sc: ServiceContract;
  let executor;
  let rar: RightsAndRoles;
  let businessCenterDomain;
  let businessCenter;
  let ipfs;
  let web3;
  let dc: DataContract;
  let sharing;

  before(async () => {
    ipfs = await TestUtils.getIpfs();
    web3 = TestUtils.getWeb3();
    executor = await TestUtils.getExecutor(web3);
    rar = await TestUtils.getRightsAndRoles(web3);
    sc = await TestUtils.getServiceContract(web3, ipfs);
    const loader = await TestUtils.getContractLoader(web3);
    const nameResolver = await TestUtils.getNameResolver(web3);
    businessCenterDomain = nameResolver.getDomainName(config.nameResolver.domains.businessCenter);
    const businessCenterAddress = await nameResolver.getAddress(businessCenterDomain);
    businessCenter = await loader.loadContract('BusinessCenter', businessCenterAddress);
    if (!await executor.executeContractCall(
        businessCenter, 'isMember', accounts[0], { from: accounts[0], })) {
      await executor.executeContractTransaction(
        businessCenter, 'join', { from: accounts[0], autoGas: 1.1, });
    }
    if (!await executor.executeContractCall(
        businessCenter, 'isMember', accounts[1], { from: accounts[1], })) {
      await executor.executeContractTransaction(
        businessCenter, 'join', { from: accounts[1], autoGas: 1.1, });
    }
    if (!await executor.executeContractCall(
        businessCenter, 'isMember', accounts[2], { from: accounts[2], })) {
      await executor.executeContractTransaction(
        businessCenter, 'join', { from: accounts[2], autoGas: 1.1, });
    }
    dc = await TestUtils.getDataContract(web3, ipfs);
    sharing = await TestUtils.getSharing(web3, ipfs);
  });

  it('should be able to retrieve all members', async () => {
     const contract = await dc.create('testdatacontract', accounts[0], businessCenterDomain);
     await dc.inviteToContract(
       businessCenterDomain, contract.options.address, accounts[0], accounts[1]);
     await dc.inviteToContract(
       businessCenterDomain, contract.options.address, accounts[0], accounts[2]);
     const contractParticipants = await rar.getMembers(contract);
     const members = contractParticipants[1];
     expect(members.length).to.eq(3);
     expect(members[0]).to.eq(accounts[0]);
     expect(members[1]).to.eq(accounts[1]);
     expect(members[2]).to.eq(accounts[2]);
  });

  it('should be able to retrieve more than 10 members per role', async () => {
     const contract = await dc.create('testdatacontract', accounts[0], null);
     const invitees = [...Array(31)].map(() => TestUtils.getRandomAddress());
     await Promise.all(invitees.map(invitee =>
       dc.inviteToContract(null, contract.options.address, accounts[0], invitee)));
     const contractParticipants = await rar.getMembers(contract);
     const membersResult = contractParticipants[1].sort();
     expect(membersResult).to.deep.eq([accounts[0], ...invitees].sort());
  });

  it('should be able to retrieve members from a business center', async () => {
    const bcMembers = await rar.getMembers(businessCenter);
    expect(Object.keys(bcMembers).length).to.eq(5);
  });

  describe('when updating permissions', async() => {
    const samples = [
      '0x0000000000000000000000000000000000000000000000000000000000000001',
      '0x0000000000000000000000000000000000000000000000000000000000000002',
      '0x0000000000000000000000000000000000000000000000000000000000000003',
    ];
    const memberRole = 1;
    async function createSampleContract(): Promise<any> {
      const blockNr = await web3.eth.getBlockNumber();
      // create sample contract, invite second user, add sharing for this user
      const contract = await dc.create('testdatacontract', accounts[0], businessCenterDomain);
      await dc.inviteToContract(
        businessCenterDomain, contract.options.address, accounts[0], accounts[1]);
      const contentKey = await sharing.getKey(contract.options.address, accounts[0], '*', blockNr);
      await sharing.addSharing(
        contract.options.address, accounts[0], accounts[1], '*', blockNr, contentKey);
      return contract;
    }

    it('should be able to grant operation permissions to an existing contract', async () => {
      const contract = await createSampleContract();
      await expect(dc.addListEntries(
        contract, 'new_entry', [samples[0]], accounts[1])).to.be.rejected;
      await rar.setOperationPermission(
        contract,
        accounts[0],
        memberRole,
        'new_entry',
        PropertyType.ListEntry,
        ModificationType.Set,
        true,
      );
      await expect(dc.addListEntries(
        contract, 'new_entry', [samples[0]], accounts[1])).to.be.fulfilled;
    });

    it('should be able to revoke operation permissions to an existing contract', async () => {
      const contract = await createSampleContract();
      await expect(dc.addListEntries(
        contract, 'list_settable_by_member', [samples[0]], accounts[1])).to.be.fulfilled;
      await rar.setOperationPermission(
        contract,
        accounts[0],
        memberRole,
        'list_settable_by_member',
        PropertyType.ListEntry,
        ModificationType.Set,
        false,
      );
      await expect(dc.addListEntries(
        contract, 'list_settable_by_member', [samples[0]], accounts[1])).to.be.rejected;
    });

    it('should be able to grant function permissions to an existing contract', async () => {
      const contract = await createSampleContract();
      await dc.addListEntries(contract, 'list_settable_by_member', [samples[0]], accounts[1]);
      await dc.addListEntries(contract, 'list_settable_by_member', [samples[1]], accounts[1]);
      await dc.addListEntries(contract, 'list_settable_by_member', [samples[2]], accounts[1]);
      await expect(dc.removeListEntry(
        contract, 'list_settable_by_member', 2, accounts[1])).to.be.rejected;

      await rar.setFunctionPermission(
        contract, accounts[0], memberRole, 'removeListEntry(bytes32,uint256)', true)
      await rar.setOperationPermission(
        contract,
        accounts[0],
        memberRole,
        'list_settable_by_member',
        PropertyType.ListEntry,
        ModificationType.Remove,
        true,
      );
      await expect(dc.removeListEntry(
        contract, 'list_settable_by_member', 2, accounts[1])).to.be.fulfilled;
    });

    it('should be able to revoke function permissions to an existing contract', async () => {
      const contract = await createSampleContract();
      await expect(dc.addListEntries(
        contract, 'list_settable_by_member', [samples[0]], accounts[1])).to.be.fulfilled;

      await rar.setFunctionPermission(
        contract, accounts[0], memberRole, 'addListEntries(bytes32[],bytes32[])', false);
      await expect(dc.addListEntries(
        contract, 'list_settable_by_member', [samples[1]], accounts[1])).to.be.rejected;
    });


    it('should be able to transfer ownership multiple times from an existing contract', async () => {
      const contract = await createSampleContract();

      let contractParticipants = await rar.getMembers(contract);
      let owners = contractParticipants[0];
      expect(owners.length).to.eq(1);
      expect(owners[0]).to.eq(accounts[0]);

      await rar.addAccountToRole(contract, accounts[0], accounts[1], 0);
      await rar.transferOwnership(contract, accounts[1], accounts[1]);
      await rar.removeAccountFromRole(contract, accounts[1], accounts[0], 0);

      contractParticipants = await rar.getMembers(contract);
      owners = contractParticipants[0];
      expect(owners.length).to.eq(1);
      expect(owners[0]).to.eq(accounts[1]);

      await rar.addAccountToRole(contract, accounts[1], accounts[0], 0);
      await rar.transferOwnership(contract, accounts[0], accounts[0]);
      await rar.removeAccountFromRole(contract, accounts[0], accounts[1], 0);

      contractParticipants = await rar.getMembers(contract);
      owners = contractParticipants[0];
      expect(owners.length).to.eq(1);
      expect(owners[0]).to.eq(accounts[0]);

      await rar.addAccountToRole(contract, accounts[0], accounts[1], 0);
      await rar.transferOwnership(contract, accounts[1], accounts[1]);
      await rar.removeAccountFromRole(contract, accounts[1], accounts[0], 0);

      contractParticipants = await rar.getMembers(contract);
      owners = contractParticipants[0];
      expect(owners.length).to.eq(1);
      expect(owners[0]).to.eq(accounts[1]);
    });
  });
});
