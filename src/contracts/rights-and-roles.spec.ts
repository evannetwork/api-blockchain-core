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

import { accounts, useIdentity } from '../test/accounts';
import { configTestcore as config } from '../config-testcore';
import { DataContract } from './data-contract/data-contract';
import { RightsAndRoles, ModificationType, PropertyType } from './rights-and-roles';
import { TestUtils } from '../test/test-utils';
import { Runtime } from '../runtime';

use(chaiAsPromised);


describe('Rights and Roles handler', function test() {
  this.timeout(300000);
  let rar0: RightsAndRoles;
  let rar1: RightsAndRoles;
  let businessCenterDomain;
  let businessCenter;
  let identity0: string;
  let identity1: string;
  let identity2: string;
  let web3;
  let dc0: DataContract;
  let dc1: DataContract;
  let sharing;
  let runtimes: Runtime[];

  before(async () => {
    runtimes = await Promise.all(
      accounts.slice(0, 3).map((account) => TestUtils.getRuntime(account, null, { useIdentity })),
    );
    identity0 = runtimes[0].activeIdentity;
    identity1 = runtimes[1].activeIdentity;
    identity2 = runtimes[2].activeIdentity;
    web3 = TestUtils.getWeb3();
    rar0 = runtimes[0].rightsAndRoles;
    rar1 = runtimes[1].rightsAndRoles;
    businessCenterDomain = runtimes[0].nameResolver.getDomainName(
      config.nameResolver.domains.businessCenter,
    );
    const businessCenterAddress = await runtimes[0].nameResolver.getAddress(businessCenterDomain);
    businessCenter = await runtimes[0].contractLoader.loadContract('BusinessCenter', businessCenterAddress);
    if (!await runtimes[0].executor.executeContractCall(
      businessCenter, 'isMember', identity0, { from: identity0 },
    )
    ) {
      await runtimes[0].executor.executeContractTransaction(
        businessCenter, 'join', { from: identity0, autoGas: 1.1 },
      );
    }
    if (!await runtimes[1].executor.executeContractCall(
      businessCenter, 'isMember', identity1, { from: identity1 },
    )
    ) {
      await runtimes[1].executor.executeContractTransaction(
        businessCenter, 'join', { from: identity1, autoGas: 1.1 },
      );
    }
    if (!await runtimes[2].executor.executeContractCall(
      businessCenter, 'isMember', identity2, { from: identity2 },
    )
    ) {
      await runtimes[2].executor.executeContractTransaction(
        businessCenter, 'join', { from: identity2, autoGas: 1.1 },
      );
    }
    dc0 = runtimes[0].dataContract;
    dc1 = runtimes[1].dataContract;
    sharing = runtimes[0].sharing;
  });

  it('should be able to retrieve all members', async () => {
    const contract = await dc0.create('testdatacontract', identity0, businessCenterDomain);
    await dc0.inviteToContract(
      businessCenterDomain, contract.options.address, identity0, identity1,
    );
    await dc0.inviteToContract(
      businessCenterDomain, contract.options.address, identity0, identity2,
    );
    const contractParticipants = await rar0.getMembers(contract);
    const members = contractParticipants[1];
    expect(members.length).to.eq(3);
    expect(members[0]).to.eq(identity0);
    expect(members[1]).to.eq(identity1);
    expect(members[2]).to.eq(identity2);
  });

  it('should be able to retrieve more than 10 members per role', async () => {
    const contract = await dc0.create('testdatacontract', identity0, null);
    const invitees = [...Array(31)].map(() => TestUtils.getRandomAddress());
    await Promise.all(invitees.map((invitee) => dc0.inviteToContract(
      null,
      contract.options.address,
      identity0,
      invitee,
    )));
    const contractParticipants = await rar0.getMembers(contract);
    const membersResult = contractParticipants[1].sort();
    expect(membersResult).to.deep.eq([identity0, ...invitees].sort());
  });

  it('should be able to retrieve members from a business center', async () => {
    const bcMembers = await rar0.getMembers(businessCenter);
    expect(Object.keys(bcMembers).length).to.eq(5);
  });

  describe('when updating permissions', async () => {
    const samples = [
      '0x0000000000000000000000000000000000000000000000000000000000000001',
      '0x0000000000000000000000000000000000000000000000000000000000000002',
      '0x0000000000000000000000000000000000000000000000000000000000000003',
    ];
    const memberRole = 1;
    async function createSampleContract(): Promise<any> {
      const blockNr = await web3.eth.getBlockNumber();
      // create sample contract, invite second user, add sharing for this user
      const contract = await dc0.create('testdatacontract', identity0, businessCenterDomain);
      await dc0.inviteToContract(
        businessCenterDomain, contract.options.address, identity0, identity1,
      );
      const contentKey = await sharing.getKey(contract.options.address, identity0, '*', blockNr);
      await sharing.addSharing(
        contract.options.address, identity0, identity1, '*', blockNr, contentKey,
      );
      return contract;
    }

    it('should be able to grant operation permissions to an existing contract', async () => {
      const contract = await createSampleContract();
      await expect(dc1.addListEntries(
        contract, 'new_entry', [samples[0]], identity1,
      )).to.be.rejected;
      await rar0.setOperationPermission(
        contract,
        identity0,
        memberRole,
        'new_entry',
        PropertyType.ListEntry,
        ModificationType.Set,
        true,
      );
      await expect(dc1.addListEntries(
        contract, 'new_entry', [samples[0]], identity1,
      )).to.be.fulfilled;
    });

    it('should be able to revoke operation permissions to an existing contract', async () => {
      const contract = await createSampleContract();
      await expect(dc1.addListEntries(
        contract, 'list_settable_by_member', [samples[0]], identity1,
      )).to.be.fulfilled;
      await rar0.setOperationPermission(
        contract,
        identity0,
        memberRole,
        'list_settable_by_member',
        PropertyType.ListEntry,
        ModificationType.Set,
        false,
      );
      await expect(dc1.addListEntries(
        contract, 'list_settable_by_member', [samples[0]], identity1,
      )).to.be.rejected;
    });

    it('should be able to grant function permissions to an existing contract', async () => {
      const contract = await createSampleContract();
      await dc1.addListEntries(contract, 'list_settable_by_member', [samples[0]], identity1);
      await dc1.addListEntries(contract, 'list_settable_by_member', [samples[1]], identity1);
      await dc1.addListEntries(contract, 'list_settable_by_member', [samples[2]], identity1);
      await expect(dc1.removeListEntry(
        contract, 'list_settable_by_member', 2, identity1,
      )).to.be.rejected;

      await rar0.setFunctionPermission(
        contract, identity0, memberRole, 'removeListEntry(bytes32,uint256)', true,
      );
      await rar0.setOperationPermission(
        contract,
        identity0,
        memberRole,
        'list_settable_by_member',
        PropertyType.ListEntry,
        ModificationType.Remove,
        true,
      );
      await expect(dc1.removeListEntry(
        contract, 'list_settable_by_member', 2, identity1,
      )).to.be.fulfilled;
    });

    it('should be able to revoke function permissions to an existing contract', async () => {
      const contract = await createSampleContract();
      await expect(dc1.addListEntries(
        contract, 'list_settable_by_member', [samples[0]], identity1,
      )).to.be.fulfilled;

      await rar0.setFunctionPermission(
        contract, identity0, memberRole, 'addListEntries(bytes32[],bytes32[])', false,
      );
      await expect(dc1.addListEntries(
        contract, 'list_settable_by_member', [samples[1]], identity1,
      )).to.be.rejected;
    });


    it('should be able to transfer ownership multiple times from an existing contract', async () => {
      const contract = await createSampleContract();

      let contractParticipants = await rar0.getMembers(contract);
      let owners = contractParticipants[0];
      expect(owners.length).to.eq(1);
      expect(owners[0]).to.eq(identity0);

      await rar0.addAccountToRole(contract, identity0, identity1, 0);
      await rar1.transferOwnership(contract, identity1, identity1);
      await rar1.removeAccountFromRole(contract, identity1, identity0, 0);

      contractParticipants = await rar0.getMembers(contract);
      // eslint-disable-next-line
      owners = contractParticipants[0];
      expect(owners.length).to.eq(1);
      expect(owners[0]).to.eq(identity1);

      await rar1.addAccountToRole(contract, identity1, identity0, 0);
      await rar0.transferOwnership(contract, identity0, identity0);
      await rar0.removeAccountFromRole(contract, identity0, identity1, 0);

      contractParticipants = await rar0.getMembers(contract);

      owners = contractParticipants['0'];
      expect(owners.length).to.eq(1);
      expect(owners[0]).to.eq(identity0);

      await rar0.addAccountToRole(contract, identity0, identity1, 0);
      await rar1.transferOwnership(contract, identity1, identity1);
      await rar1.removeAccountFromRole(contract, identity1, identity0, 0);

      contractParticipants = await rar0.getMembers(contract);
      // eslint-disable-next-line
      owners = contractParticipants[0];
      expect(owners.length).to.eq(1);
      expect(owners[0]).to.eq(identity1);
    });
  });
});
