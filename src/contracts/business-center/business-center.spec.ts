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
import { accounts, useIdentity } from '../../test/accounts';
import { configTestcore as config } from '../../config-testcore';
import { TestUtils } from '../../test/test-utils';
import { Runtime } from '../../runtime';

use(chaiAsPromised);


describe('Business Center', function test() {
  this.timeout(60000);
  let businessCenter;
  const empty = '0x0000000000000000000000000000000000000000000000000000000000000000';
  let ensDomain;
  let identity0: string;
  let identity1: string;
  let runtimes: Runtime[];


  /**
   * create new busines center
   *
   * @param      {number}        joinSchema  --> JoinBehavior { SelfJoin, AddOnly, Handshake }
   * @return     {Promise<any>}  contract instance
   */
  async function createBusinessCenter(joinSchema: number): Promise<any> {
    const adminFactoryEnsDomain = runtimes[0].nameResolver.getDomainName(
      config.nameResolver.domains.adminFactory,
    );
    const adminFactoryContractAddress = await runtimes[0].nameResolver.getAddress(
      adminFactoryEnsDomain,
    );
    const adminFactory = await runtimes[0].contractLoader.loadContract(
      'BusinessCenterFactory',
      adminFactoryContractAddress,
    );
    const address = await runtimes[0].executor.executeContractTransaction(
      adminFactory,
      'createContract',
      {
        from: identity0,
        gas: 5000000,
        event: { target: 'BusinessCenterFactory', eventName: 'ContractCreated' },
        getEventResult: (event, args) => args.newAddress,
      },
      runtimes[0].nameResolver.namehash(ensDomain),
      config.nameResolver.ensAddress,
    );
    const bc = runtimes[0].contractLoader.loadContract('BusinessCenterInterface', address);
    const storageAddress = '0x0000000000000000000000000000000000000000';
    await runtimes[0].executor.executeContractTransaction(
      bc,
      'init',
      { from: identity0, autoGas: 1.1 },
      storageAddress,
      joinSchema,
    );
    await runtimes[0].executor.executeContractTransaction(bc, 'join', { from: identity0, autoGas: 1.1 });
    return bc;
  }

  before(async () => {
    runtimes = await Promise.all(
      accounts.slice(0, 2).map((account) => TestUtils.getRuntime(account, null, { useIdentity })),
    );
    identity0 = runtimes[0].activeIdentity;
    identity1 = runtimes[1].activeIdentity;
    ensDomain = runtimes[0].nameResolver.getDomainName(config.nameResolver.domains.businessCenter);
    businessCenter = await createBusinessCenter(0);
    const isMember = await runtimes[0].executor.executeContractCall(
      businessCenter, 'isMember', identity0,
    );
    if (!isMember) {
      await runtimes[0].executor.executeContractTransaction(
        businessCenter, 'join', { from: identity0, autoGas: 1.1 },
      );
    }
  });

  describe('when working with a SelfJoin Business Center', async () => {
    it('allows to join', async () => {
      const selfJoinBc = await createBusinessCenter(0);
      await runtimes[1].executor.executeContractTransaction(
        selfJoinBc, 'join', { from: identity1, autoGas: 1.1 },
      );
      const isMember = await runtimes[0].executor.executeContractCall(
        selfJoinBc, 'isMember', identity1,
      );
      expect(isMember).to.be.true;
    });

    it('rejects an invite of a member', async () => {
      const selfJoinBc = await createBusinessCenter(0);
      const invitePromise = runtimes[0].executor.executeContractTransaction(
        selfJoinBc, 'invite', { from: identity0, autoGas: 1.1 }, identity1,
      );
      expect(invitePromise).to.be.rejected;
    });
  });

  describe('when working with a InviteOnly Business Center', async () => {
    it('rejects a join', async () => {
      const inviteOnlyBc = await createBusinessCenter(1);
      const joinPromise = runtimes[1].executor.executeContractTransaction(
        inviteOnlyBc, 'join', { from: identity1, autoGas: 1.1 },
      );
      expect(joinPromise).to.be.rejected;
    });

    it('adds a member, when a member is invited', async () => {
      const inviteOnlyBc = await createBusinessCenter(1);
      await runtimes[0].executor.executeContractTransaction(
        inviteOnlyBc, 'invite', { from: identity0, autoGas: 1.1 }, identity1,
      );
      const isMember = await runtimes[0].executor.executeContractCall(inviteOnlyBc, 'isMember', identity1);
      expect(isMember).to.be.true;
    });
  });

  describe('when working with a Handshake Business Center', async () => {
    it('allows a join request, but does not add a member with only this', async () => {
      const handshakeBc = await createBusinessCenter(2);
      await runtimes[1].executor.executeContractTransaction(
        handshakeBc, 'join', { from: identity1, autoGas: 1.1 },
      );
    });

    it('allows sending invitations, but does not add a member with only this', async () => {
      const handshakeBc = await createBusinessCenter(2);
      await runtimes[0].executor.executeContractTransaction(
        handshakeBc, 'invite', { from: identity0, autoGas: 1.1 }, identity1,
      );
    });

    it('adds a member when invite and join have been called', async () => {
      let isMember;
      const handshakeBc = await createBusinessCenter(2);
      await runtimes[1].executor.executeContractTransaction(
        handshakeBc, 'join', { from: identity1, autoGas: 1.1 },
      );
      isMember = await runtimes[0].executor.executeContractCall(
        handshakeBc, 'isMember', identity1,
      );
      expect(isMember).to.be.false;
      await runtimes[0].executor.executeContractTransaction(
        handshakeBc, 'invite', { from: identity0, autoGas: 1.1 }, identity1,
      );
      isMember = await runtimes[0].executor.executeContractCall(
        handshakeBc, 'isMember', identity1,
      );
      expect(isMember).to.be.true;
    });

    it('adds a member when join and invite have been called (other order than last test', async () => {
      let isMember;
      const handshakeBc = await createBusinessCenter(2);
      await runtimes[0].executor.executeContractTransaction(
        handshakeBc, 'invite', { from: identity0, autoGas: 1.1 }, identity1,
      );
      isMember = await runtimes[0].executor.executeContractCall(
        handshakeBc, 'isMember', identity1,
      );
      expect(isMember).to.be.false;
      await runtimes[1].executor.executeContractTransaction(
        handshakeBc, 'join', { from: identity1, autoGas: 1.1 },
      );
      isMember = await runtimes[0].executor.executeContractCall(
        handshakeBc, 'isMember', identity1,
      );
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
        await runtimes[1].executor.executeContractTransaction(
          currentBc, 'join', { from: identity1, autoGas: 1.1 },
        );
        const isMember = await runtimes[0].executor.executeContractCall(
          currentBc, 'isMember', identity0,
        );
        expect(isMember).to.be.true;
      });

      it('rejects an invite of a member', async () => {
        const invitePromise = runtimes[0].executor.executeContractTransaction(
          currentBc, 'invite', { from: identity0, autoGas: 1.1 }, identity1,
        );
        expect(invitePromise).to.be.rejected;
      });

      it('allows to change the join Schema', async () => {
        await runtimes[0].executor.executeContractTransaction(
          currentBc, 'setJoinSchema', { from: identity0, autoGas: 1.1 }, 1,
        );
      });

      it('does not allow to change the join schema', async () => {
        const setJoinSchemaPromise = runtimes[1].executor.executeContractTransaction(
          currentBc, 'setJoinSchema', { from: identity1, autoGas: 1.1 }, 1,
        );
        expect(setJoinSchemaPromise).to.be.rejected;
      });

      it('allows to leave the business center', async () => {
        await runtimes[1].executor.executeContractTransaction(
          currentBc, 'cancel', { from: identity1, autoGas: 1.1 },
        );
        const isMember = await runtimes[0].executor.executeContractCall(
          currentBc, 'isMember', identity1,
        );
        expect(isMember).to.be.false;
      });
    });

    describe('when working with a InviteOnly Business Center', async () => {
      it('rejects a join', async () => {
        const joinPromise = runtimes[1].executor.executeContractTransaction(
          currentBc, 'join', { from: identity1, autoGas: 1.1 },
        );
        expect(joinPromise).to.be.rejected;
      });

      it('adds a member, when a member is invited', async () => {
        await runtimes[0].executor.executeContractTransaction(
          currentBc, 'invite', { from: identity0, autoGas: 1.1 }, identity1,
        );
        const isMember = await runtimes[0].executor.executeContractCall(currentBc, 'isMember', identity0);
        expect(isMember).to.be.true;
      });
    });
  });

  it('allows to cancel membership', async () => {
    let isMember = await runtimes[0].executor.executeContractCall(
      businessCenter, 'isMember', identity1,
    );
    if (!isMember) {
      await runtimes[1].executor.executeContractTransaction(
        businessCenter, 'join', { from: identity1, autoGas: 1.1 },
      );
    }
    await runtimes[1].executor.executeContractTransaction(
      businessCenter, 'cancel', { from: identity1, autoGas: 1.1 },
    );
    isMember = await runtimes[0].executor.executeContractCall(
      businessCenter, 'isMember', identity1,
    );
    expect(isMember).to.be.false;
  });

  it('does not allow to cancel a membership if not joined', async () => {
    const isMember = await runtimes[0].executor.executeContractCall(
      businessCenter, 'isMember', identity1,
    );
    if (isMember) {
      await runtimes[1].executor.executeContractTransaction(
        businessCenter, 'cancel', { from: identity1, autoGas: 1.1 },
      );
    }
    const promise = runtimes[1].executor.executeContractTransaction(
      businessCenter, 'cancel', { from: identity1, autoGas: 1.1 },
    );
    await expect(promise).to.be.rejected;
  });

  it('does not allow sending fake contract events', async () => {
    const isMember = await runtimes[0].executor.executeContractCall(
      businessCenter, 'isMember', identity1,
    );
    if (isMember) {
      await runtimes[1].executor.executeContractTransaction(
        businessCenter, 'cancel', { from: identity1, autoGas: 1.1 },
      );
    }
    const promise = runtimes[1].executor.executeContractTransaction(
      businessCenter,
      'sendContractEvent',
      { from: identity1, autoGas: 1.1 },
      1,
      empty,
      identity1,
    );
    await expect(promise).to.be.rejected;
  });

  it('allows members to set their own profile', async () => {
    const sampleProfile = '0x1234000000000000000000000000000000000000000000000000000000000000';
    const isMember = await runtimes[0].executor.executeContractCall(
      businessCenter, 'isMember', identity1,
    );
    if (!isMember) {
      await runtimes[1].executor.executeContractTransaction(
        businessCenter, 'join', { from: identity1, autoGas: 1.1 },
      );
    }
    let profile = await runtimes[0].executor.executeContractCall(businessCenter, 'getProfile', identity1);
    if (profile !== empty) {
      await runtimes[1].executor.executeContractTransaction(
        businessCenter, 'setMyProfile', { from: identity1, autoGas: 1.1 }, empty,
      );
    }
    await runtimes[1].executor.executeContractTransaction(
      businessCenter, 'setMyProfile', { from: identity1, autoGas: 1.1 }, sampleProfile,
    );
    profile = await runtimes[0].executor.executeContractCall(businessCenter, 'getProfile', identity1);
    expect(profile).to.eq(sampleProfile);
  });

  it('removes a user profile when this user leaves', async () => {
    const sampleProfile = '0x1234000000000000000000000000000000000000000000000000000000000000';
    const isMember = await runtimes[1].executor.executeContractCall(
      businessCenter, 'isMember', identity1,
    );
    if (!isMember) {
      await runtimes[1].executor.executeContractTransaction(
        businessCenter, 'join', { from: identity1, autoGas: 1.1 },
      );
    }
    await runtimes[1].executor.executeContractTransaction(
      businessCenter, 'setMyProfile', { from: identity1, autoGas: 1.1 }, sampleProfile,
    );
    let profile = await runtimes[0].executor.executeContractCall(
      businessCenter, 'getProfile', identity1,
    );
    expect(profile).to.eq(sampleProfile);
    await runtimes[1].executor.executeContractTransaction(
      businessCenter, 'cancel', { from: identity1, autoGas: 1.1 },
    );
    profile = await runtimes[0].executor.executeContractCall(businessCenter, 'getProfile', identity1);
    expect(profile).to.eq(empty);
  });

  it('does not allow setting a profile when executing user is not a member  ', async () => {
    const sampleProfile = '0x1234000000000000000000000000000000000000000000000000000000000000';
    const isMember = await runtimes[0].executor.executeContractCall(
      businessCenter, 'isMember', identity1,
    );
    if (isMember) {
      await runtimes[1].executor.executeContractTransaction(
        businessCenter, 'cancel', { from: identity1, autoGas: 1.1 },
      );
    }
    const promise = runtimes[1].executor.executeContractTransaction(
      businessCenter, 'setMyProfile', { from: identity1, autoGas: 1.1 }, sampleProfile,
    );
    await expect(promise).to.be.rejected;
  });

  it('allows members to update own profile', async () => {
    const sampleProfile1 = '0x1234000000000000000000000000000000000000000000000000000000000000';
    const sampleProfile2 = '0x1234500000000000000000000000000000000000000000000000000000000000';
    const isMember = await runtimes[0].executor.executeContractCall(
      businessCenter, 'isMember', identity1,
    );
    if (!isMember) {
      await runtimes[1].executor.executeContractTransaction(
        businessCenter, 'join', { from: identity1, autoGas: 1.1 },
      );
    }
    let profile = await runtimes[0].executor.executeContractCall(businessCenter, 'getProfile', identity1);
    if (profile !== empty) {
      await runtimes[1].executor.executeContractTransaction(
        businessCenter, 'setMyProfile', { from: identity1, autoGas: 1.1 }, empty,
      );
    }
    await runtimes[1].executor.executeContractTransaction(
      businessCenter, 'setMyProfile', { from: identity1, autoGas: 1.1 }, sampleProfile1,
    );
    profile = await runtimes[0].executor.executeContractCall(
      businessCenter, 'getProfile', identity1,
    );
    expect(profile).to.eq(sampleProfile1);
    await runtimes[1].executor.executeContractTransaction(
      businessCenter, 'setMyProfile', { from: identity1, autoGas: 1.1 }, sampleProfile2,
    );
    profile = await runtimes[0].executor.executeContractCall(businessCenter, 'getProfile', identity1);
    expect(profile).to.eq(sampleProfile2);
  });
});
