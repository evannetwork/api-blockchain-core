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
  Executor,
  NameResolver,
} from '@evan.network/dbcp';

import { accounts } from '../../test/accounts';
import { configTestcore as config } from '../../config-testcore';
import { TestUtils } from '../../test/test-utils';

use(chaiAsPromised);


describe('Business Center', function() {
  this.timeout(60000);
  let businessCenter;
  let executor: Executor;
  const empty = '0x0000000000000000000000000000000000000000000000000000000000000000';
  let loader;
  let ensDomain;
  let nameResolver: NameResolver;
  let web3;

  before(() => {
    web3 = TestUtils.getWeb3();
  });

  /**
   * create new busines center
   *
   * @param      {number}        joinSchema  --> JoinBehavior { SelfJoin, AddOnly, Handshake }
   * @return     {Promise<any>}  contract instance
   */
  async function createBusinessCenter(joinSchema: number): Promise<any> {
    const adminFactoryEnsDomain = nameResolver.getDomainName(config.nameResolver.domains.adminFactory);
    const adminFactoryContractAddress = await nameResolver.getAddress(adminFactoryEnsDomain);
    const adminFactory = await loader.loadContract('BusinessCenterFactory', adminFactoryContractAddress);
    const address = await executor.executeContractTransaction(
      adminFactory,
      'createContract',
      {
        from: accounts[0],
        gas: 5000000,
        event: { target: 'BusinessCenterFactory', eventName: 'ContractCreated', },
        getEventResult: (event, args) => args.newAddress,
      },
      nameResolver.namehash(ensDomain),
      config.nameResolver.ensAddress
    );
    const bc = loader.loadContract('BusinessCenterInterface', address);
    const storageAddress = '0x0000000000000000000000000000000000000000';
    await executor.executeContractTransaction(
      bc,
      'init',
      { from: accounts[0], autoGas: 1.1, },
      storageAddress,
      joinSchema,
    );
    await executor.executeContractTransaction(bc, 'join', { from: accounts[0], autoGas: 1.1, });
    return bc;
  }

  before(async () => {
    executor = await TestUtils.getExecutor(web3);
    executor.eventHub = await TestUtils.getEventHub(web3);
    loader = await TestUtils.getContractLoader(web3);
    nameResolver = await TestUtils.getNameResolver(web3);
    ensDomain = nameResolver.getDomainName(config.nameResolver.domains.businessCenter);
    const bcAddress = await nameResolver.getAddress(ensDomain);
    businessCenter = loader.loadContract('BusinessCenter', bcAddress);
    let isMember = await executor.executeContractCall(
      businessCenter, 'isMember', accounts[2], { from: accounts[2], gas: 3000000, });
    if (!isMember) {
      await executor.executeContractTransaction(
        businessCenter, 'join', { from: accounts[2], autoGas: 1.1, });
    }
  });

  describe('when working with a SelfJoin Business Center', async () => {
    it('allows to join', async () => {
      const selfJoinBc = await createBusinessCenter(0);
      await executor.executeContractTransaction(
        selfJoinBc, 'join', { from: accounts[2], autoGas: 1.1, });
      let isMember = await executor.executeContractCall(
        selfJoinBc, 'isMember', accounts[2], { from: accounts[2], gas: 3000000, });
      expect(isMember).to.be.true;
    });

    it('rejects an invite of a member', async () => {
      const selfJoinBc = await createBusinessCenter(0);
      const invitePromise = executor.executeContractTransaction(
        selfJoinBc, 'invite', accounts[2], { from: accounts[0], autoGas: 1.1, });
      expect(invitePromise).to.be.rejected;
    });
  });

  describe('when working with a InviteOnly Business Center', async () => {
    it('rejects a join', async () => {
      const inviteOnlyBc = await createBusinessCenter(1);
      const joinPromise = executor.executeContractTransaction(
        inviteOnlyBc, 'join', { from: accounts[2], autoGas: 1.1, });
      expect(joinPromise).to.be.rejected;
    });

    it('adds a member, when a member is invited', async () => {
      const inviteOnlyBc = await createBusinessCenter(1);
      await executor.executeContractTransaction(
        inviteOnlyBc, 'invite', { from: accounts[0], autoGas: 1.1, }, accounts[2], );
      let isMember = await executor.executeContractCall(inviteOnlyBc, 'isMember', accounts[2]);
      expect(isMember).to.be.true;
    });
  });

  describe('when working with a Handshake Business Center', async () => {
    it('allows a join request, but does not add a member with only this', async () => {
      const handshakeBc = await createBusinessCenter(2);
      await executor.executeContractTransaction(
        handshakeBc, 'join', { from: accounts[2], autoGas: 1.1, });
    });

    it('allows sending invitations, but does not add a member with only this', async () => {
      const handshakeBc = await createBusinessCenter(2);
      await executor.executeContractTransaction(
        handshakeBc, 'invite', { from: accounts[0], autoGas: 1.1, }, accounts[2]);
    });

    it('adds a member when invite and join have been called', async () => {
      let isMember;
      const handshakeBc = await createBusinessCenter(2);
      await executor.executeContractTransaction(
        handshakeBc, 'join', { from: accounts[2], autoGas: 1.1, });
      isMember = await executor.executeContractCall(
        handshakeBc, 'isMember', accounts[2], { from: accounts[2], gas: 3000000, });
      expect(isMember).to.be.false;
      await executor.executeContractTransaction(
        handshakeBc, 'invite', { from: accounts[0], autoGas: 1.1, }, accounts[2]);
      isMember = await executor.executeContractCall(
        handshakeBc, 'isMember', accounts[2], { from: accounts[2], gas: 3000000, });
      expect(isMember).to.be.true;
    });

    it('adds a member when join and invite have been called (other order than last test', async () => {
      let isMember;
      const handshakeBc = await createBusinessCenter(2);
      await executor.executeContractTransaction(
        handshakeBc, 'invite', { from: accounts[0], autoGas: 1.1, }, accounts[2]);
      isMember = await executor.executeContractCall(
        handshakeBc, 'isMember', accounts[2], { from: accounts[2], gas: 3000000, });
      expect(isMember).to.be.false;
      await executor.executeContractTransaction(
        handshakeBc, 'join', { from: accounts[2], autoGas: 1.1, });
      isMember = await executor.executeContractCall(
        handshakeBc, 'isMember', accounts[2], { from: accounts[2], gas: 3000000, });
      expect(isMember).to.be.true;
    });
  });

  describe('when changing the join schema', async () => {
    let currentBc;
    before(async () => {
      currentBc = await createBusinessCenter(0);
    });
    describe('when working with a SelfJoin Business Center', async () => {
      it('allows to join', async () => {
        await executor.executeContractTransaction(
          currentBc, 'join', { from: accounts[2], autoGas: 1.1, });
        let isMember = await executor.executeContractCall(
          currentBc, 'isMember', accounts[2], { from: accounts[2], gas: 3000000, });
        expect(isMember).to.be.true;
      });

      it('rejects an invite of a member', async () => {
        const invitePromise = executor.executeContractTransaction(
          currentBc, 'invite', accounts[1], { from: accounts[0], autoGas: 1.1, });
        expect(invitePromise).to.be.rejected;
      });

      it('allows to change the join Schema', async () => {
        await executor.executeContractTransaction(
          currentBc, 'setJoinSchema', { from: accounts[0], autoGas: 1.1, }, 1);
      });

      it('does not allow to change the join schema', async () => {
        const setJoinSchemaPromise = executor.executeContractTransaction(
          currentBc, 'setJoinSchema', { from: accounts[2], autoGas: 1.1, }, 1);
        expect(setJoinSchemaPromise).to.be.rejected;
      });

      it('allows to leave the business center', async () => {
        await executor.executeContractTransaction(
          currentBc, 'cancel', { from: accounts[2], autoGas: 1.1, });
        const isMember = await executor.executeContractCall(
          currentBc, 'isMember', accounts[2], { from: accounts[2], gas: 3000000, });
        expect(isMember).to.be.false;
      })
    });

    describe('when working with a InviteOnly Business Center', async () => {
      it('rejects a join', async () => {
        const joinPromise = executor.executeContractTransaction(
          currentBc, 'join', { from: accounts[2], autoGas: 1.1, });
        expect(joinPromise).to.be.rejected;
      });

      it('adds a member, when a member is invited', async () => {
        await executor.executeContractTransaction(
          currentBc, 'invite', { from: accounts[0], autoGas: 1.1, }, accounts[1], );
        let isMember = await executor.executeContractCall(currentBc, 'isMember', accounts[1]);
        expect(isMember).to.be.true;
      });
    });
  });

  it('allows to to cancel membership', async () => {
    let isMember = await executor.executeContractCall(
      businessCenter, 'isMember', accounts[2], { from: accounts[2], gas: 3000000, });
    if (!isMember) {
      await executor.executeContractTransaction(
        businessCenter, 'join', { from: accounts[2], autoGas: 1.1, });
    }
    await executor.executeContractTransaction(
      businessCenter, 'cancel', { from: accounts[2], autoGas: 1.1, });
    isMember = await executor.executeContractCall(
      businessCenter, 'isMember', accounts[2], { from: accounts[2], gas: 3000000, });
    expect(isMember).to.be.false;
  });

  it('does not allow to cancel a membership if not joined', async () => {
    let isMember = await executor.executeContractCall(
      businessCenter, 'isMember', accounts[2], { from: accounts[2], gas: 3000000, });
    if (isMember) {
      await executor.executeContractTransaction(
        businessCenter, 'cancel', { from: accounts[2], autoGas: 1.1, });
    }
    const promise = executor.executeContractTransaction(
      businessCenter, 'cancel', { from: accounts[2], autoGas: 1.1, });
    await expect(promise).to.be.rejected;
  });

  it('does not allow sending fake contract events', async () => {
    let isMember = await executor.executeContractCall(
      businessCenter, 'isMember', accounts[2], { from: accounts[2], gas: 3000000, });
    if (isMember) {
      await executor.executeContractTransaction(
        businessCenter, 'cancel', { from: accounts[2], autoGas: 1.1, });
    }
    const promise = executor.executeContractTransaction(
      businessCenter,
      'sendContractEvent',
      { from: accounts[2], autoGas: 1.1, },
      1,
      empty,
      accounts[2],
    );
    await expect(promise).to.be.rejected;
  });

  it('allows members to set their own profile', async () => {
    const sampleProfile = '0x1234000000000000000000000000000000000000000000000000000000000000';
    let isMember = await executor.executeContractCall(
      businessCenter, 'isMember', accounts[2], { from: accounts[2], gas: 3000000, });
    if (!isMember) {
      await executor.executeContractTransaction(
        businessCenter, 'join', { from: accounts[2], autoGas: 1.1, });
    }
    let profile = await executor.executeContractCall(businessCenter, 'getProfile', accounts[2]);
    if (profile !== empty) {
      await executor.executeContractTransaction(
        businessCenter, 'setMyProfile', { from: accounts[2], autoGas: 1.1, }, empty);
    }
    await executor.executeContractTransaction(
      businessCenter, 'setMyProfile', { from: accounts[2], autoGas: 1.1, }, sampleProfile);
    profile = await executor.executeContractCall(businessCenter, 'getProfile', accounts[2]);
    expect(profile).to.eq(sampleProfile);
  });

  it('removes a user profile when this user leaves', async () => {
    const sampleProfile = '0x1234000000000000000000000000000000000000000000000000000000000000';
    let isMember = await executor.executeContractCall(
      businessCenter, 'isMember', accounts[2], { from: accounts[2], gas: 3000000, });
    if (!isMember) {
      await executor.executeContractTransaction(
        businessCenter, 'join', { from: accounts[2], autoGas: 1.1, });
    }
    await executor.executeContractTransaction(
      businessCenter, 'setMyProfile', { from: accounts[2], autoGas: 1.1, }, sampleProfile);
    let profile = await executor.executeContractCall(
      businessCenter, 'getProfile', accounts[2]);
    expect(profile).to.eq(sampleProfile);
    await executor.executeContractTransaction(
      businessCenter, 'cancel', { from: accounts[2], autoGas: 1.1, });
    profile = await executor.executeContractCall(businessCenter, 'getProfile', accounts[2]);
    expect(profile).to.eq(empty);
  });

  it('does not allow setting a profile when executing user is not a member  ', async () => {
    const sampleProfile = '0x1234000000000000000000000000000000000000000000000000000000000000';
    let isMember = await executor.executeContractCall(
      businessCenter, 'isMember', accounts[2], { from: accounts[2], gas: 3000000, });
    if (isMember) {
      await executor.executeContractTransaction(
        businessCenter, 'cancel', { from: accounts[2], autoGas: 1.1, });
    }
    const promise = executor.executeContractTransaction(
      businessCenter, 'setMyProfile', { from: accounts[2], autoGas: 1.1, }, sampleProfile);
    await expect(promise).to.be.rejected;
  });

  it('allows members to update own profile', async () => {
    const sampleProfile1 = '0x1234000000000000000000000000000000000000000000000000000000000000';
    const sampleProfile2 = '0x1234500000000000000000000000000000000000000000000000000000000000';
    let isMember = await executor.executeContractCall(
      businessCenter, 'isMember', accounts[2], { from: accounts[2], gas: 3000000, });
    if (!isMember) {
      await executor.executeContractTransaction(
        businessCenter, 'join', { from: accounts[2], autoGas: 1.1, });
    }
    let profile = await executor.executeContractCall(businessCenter, 'getProfile', accounts[2]);
    if (profile !== empty) {
      await executor.executeContractTransaction(
        businessCenter, 'setMyProfile', { from: accounts[2], autoGas: 1.1, }, empty);
    }
    await executor.executeContractTransaction(
      businessCenter, 'setMyProfile', { from: accounts[2], autoGas: 1.1, }, sampleProfile1);
    profile = await executor.executeContractCall(
      businessCenter, 'getProfile', accounts[2]);
    expect(profile).to.eq(sampleProfile1);
    await executor.executeContractTransaction(
      businessCenter, 'setMyProfile', { from: accounts[2], autoGas: 1.1, }, sampleProfile2);
    profile = await executor.executeContractCall(businessCenter, 'getProfile', accounts[2]);
    expect(profile).to.eq(sampleProfile2);
  });
});
