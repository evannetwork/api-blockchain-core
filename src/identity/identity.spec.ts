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

import { accounts, identities, useIdentity } from '../test/accounts';
import { Identity, IdentityOptions, IdentityBMailContent } from './identity';
import { Runtime, getRuntimeForIdentity } from '../runtime';
import { Mailbox, Mail } from '../mailbox';
import { TestUtils } from '../test/test-utils';

use(chaiAsPromised);

describe('identity handling', function test() {
  this.timeout(600000);

  let runtime0: Runtime;
  let runtime1: Runtime;

  const getBMailContent = (): IdentityBMailContent => ({
    body: 'shared identity',
    fromAlias: 'bcc_test',
    title: `Identity access ${Date.now() + Math.random()}`,
  });

  /**
   * Search for a bmail with a specific title
   *
   * @return     {Mail}  loaded bmail
   */
  const getBmailWithTitle = async (mailbox: Mailbox, title: string): Promise<Mail> => {
    const { mails } = await mailbox.getReceivedMails(5, 0);
    const foundMailAddress = Object.keys(mails).find(
      (mailAddress: string) => mails[mailAddress]?.content?.title === title,
    );
    return runtime1.mailbox.getMail(foundMailAddress);
  };

  /**
   * Grant access for identity 0 to identity 1.
   *
   * @return     {Promise<void>}  resolved when done
   */
  const grantAccess0To1 = async (accessType: string): Promise<any> => {
    const bmailContent = getBMailContent();
    // remove access before, it would not send a bmail, if the user was added before
    await runtime0.identity.removeAccess(identities[1], 'readWrite');
    await runtime0.identity.grantAccess(
      identities[1],
      accessType,
      bmailContent,
      'best and most awesome guy',
    );

    // load encryption key from mailbox of user 1
    const accessMail = await getBmailWithTitle(runtime1.mailbox, bmailContent.title);
    const { encryptionKey } = accessMail.content.attachments[0];

    // check if the bmail was received and if the user has get the correct encryptionKey
    const identity0Sha3 = runtime0.web3.utils.soliditySha3(identities[0]);
    const expectedEncryptionKey = runtime0.runtimeConfig.keyConfig[identity0Sha3];
    expect(encryptionKey).to.be.eq(expectedEncryptionKey);

    // check everything can be stored in the profile
    await runtime1.profile.loadForAccount();
    await runtime1.profile.setIdentityAccess(identities[0], encryptionKey);
    await runtime1.profile.storeForAccount(runtime1.profile.treeLabels.addressBook);
    await runtime1.profile.loadForAccount(runtime1.profile.treeLabels.addressBook);

    return {
      bmailContent,
      encryptionKey,
    };
  };

  before(async () => {
    runtime0 = await TestUtils.getRuntime(accounts[0], null, { useIdentity: true });
    runtime1 = await TestUtils.getRuntime(accounts[1], null, { useIdentity: true });
  });

  describe('useIdentity false', () => {
    it('runtime should not have identity instance for old profiles', async () => {
      const oldRuntime0 = await TestUtils.getRuntime(accounts[0], null, { useIdentity: false });
      expect(oldRuntime0.identity).to.be.eq(undefined);
    });

    it('Should reject when granting access via old profile', async () => {
      const oldRuntime0 = await TestUtils.getRuntime(accounts[0], null, { useIdentity: false });
      const identity0Inst = new Identity({ ...oldRuntime0 as IdentityOptions });
      const grantAccessP = identity0Inst.grantAccess(identities[1], 'read', getBMailContent());
      await expect(grantAccessP).to.be.rejectedWith('"grantAccess" is only supported for identity based profiles.');
    });
  });

  (useIdentity ? describe : describe.skip)('useIdentity true', () => {
    describe('ensure correct function usage', () => {
      it('only grant access of type read / readWrite', async () => {
        const grantAccessP = runtime0.identity.grantAccess(identities[1], 'gnarf', getBMailContent());
        await expect(grantAccessP).to.be.rejectedWith(`Unknown access type passed to "identity.grantAccess(${identities[1]}, gnarf, undefined)`);
      });

      it('only remove access of type read / write / readWrite', async () => {
        const grantAccessP = runtime0.identity.removeAccess(identities[1], 'gnarf', getBMailContent());
        await expect(grantAccessP).to.be.rejectedWith(`Unknown access type passed to "identity.removeAccess(${identities[1]}, gnarf)`);
      });

      it('only owner can grant access to an identity', async () => {
        const { bmailContent } = await grantAccess0To1('readWrite');

        const runtime1For0 = await getRuntimeForIdentity(runtime1, identities[0]);
        // grant access
        const grantAccessP = runtime1For0.identity.grantAccess(identities[2], 'readWrite', bmailContent);
        expect(grantAccessP).to.be.rejectedWith('Granting write permissions to identity is only allowed by the identity owner.');
      });
    });

    describe('grant / remove permissions', () => {
      it('grant read access to identity', async () => {
        const { encryptionKey } = await grantAccess0To1('read');

        const accessList = await runtime1.profile.getIdentityAccessList();
        const identity0EdgeHash = runtime0.nameResolver.soliditySha3(
          ...[
            runtime0.nameResolver.soliditySha3(identities[0]),
            runtime0.nameResolver.soliditySha3(identities[1]),
          ].sort(),
        );
        expect(accessList[identity0EdgeHash].identityAccess).to.be.eq(encryptionKey);

        // check if the user can read on behalf of
        const runtime1For0 = await getRuntimeForIdentity(runtime1, identities[0]);
        const addressBook = await runtime1For0.profile.getAddressBook();
        expect(addressBook.profile[identities[1]].hasIdentityAccess).to.be.eq('read');
      });

      it('grant write access to identity', async () => {
        await grantAccess0To1('readWrite');

        const runtime1For0 = await getRuntimeForIdentity(runtime1, identities[0]);
        await expect(runtime1For0.profile.addProfileKey(
          identities[1],
          'identityAccessNote', 'More awesome, than you thought!',
        )).to.be.ok;
        await expect(runtime1For0.profile.storeForAccount(
          runtime1.profile.treeLabels.addressBook,
        )).to.be.ok;

        await runtime0.profile.loadForAccount(runtime1.profile.treeLabels.addressBook);
        const addressBook = await runtime1For0.profile.getAddressBook();
        expect(addressBook.profile[identities[1]].identityAccessNote).to.be.eq('More awesome, than you thought!');
      });

      it('should be able to remove write permissions', async () => {
        await grantAccess0To1('read');

        const runtime1For0 = await getRuntimeForIdentity(runtime1, identities[0]);
        await runtime1For0.profile.addProfileKey(
          identities[1],
          'identityAccessNote',
          'More awesome, than you thought!',
        );

        await runtime0.profile.loadForAccount(runtime1.profile.treeLabels.addressBook);
        const addressBook = await runtime1For0.profile.getAddressBook();
        expect(addressBook.profile[identities[1]].identityAccessNote).to.be.eq('More awesome, than you thought!');

        await runtime0.identity.removeAccess(identities[1], 'write');

        await runtime1For0.profile.addProfileKey(
          identities[1],
          'identityAccessNote',
          'Much more awesome, than you thought!',
        );
        await expect(runtime1For0.profile.storeForAccount(
          runtime1.profile.treeLabels.addressBook,
        )).to.be.rejectedWith(new RegExp('executeOnIdentity failed', 'i'));
      });

      it('should reject when having no write permissions', async () => {
        await grantAccess0To1('read');

        const runtime1For0 = await getRuntimeForIdentity(runtime1, identities[0]);
        await runtime1For0.profile.addProfileKey(
          identities[1],
          'identityAccessNote',
          'More awesome, than you thought!',
        );
        await expect(runtime1For0.profile.storeForAccount(
          runtime1.profile.treeLabels.addressBook,
        )).to.be.rejectedWith(new RegExp('executeOnIdentity failed', 'i'));
      });

      it('should send bmail when removing access', async () => {
        await grantAccess0To1('read');

        const removeBmail = getBMailContent();
        await runtime0.identity.removeAccess(identities[1], 'readWrite', removeBmail);
        const accessMail = await getBmailWithTitle(runtime1.mailbox, removeBmail.title);
        expect(accessMail.content.attachments[0].type).to.be.eq('identityAccessRemove');
      });
    });
  });
});
