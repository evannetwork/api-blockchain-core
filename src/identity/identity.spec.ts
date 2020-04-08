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
import { TestUtils } from '../test/test-utils';

use(chaiAsPromised);

describe('identity handling', function test() {
  this.timeout(600000);

  const getBMailContent = (): IdentityBMailContent => ({
    body: 'shared identity',
    fromAlias: 'bcc_test',
    title: `Identity acces ${Date.now() + Math.random()}`,
  });
  let runtime0: Runtime;
  let runtime1: Runtime;

  before(async () => {
    runtime0 = await TestUtils.getRuntime(accounts[0], null, { useIdentity: true });
    runtime1 = await TestUtils.getRuntime(accounts[1], null, { useIdentity: true });
  });

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

  it('only grant access of type read / readWrite', async () => {
    const grantAccessP = runtime0.identity.grantAccess(identities[1], 'gnarf', getBMailContent());
    await expect(grantAccessP).to.be.rejectedWith(`Unknown access type passed to "identity.grantAccess(${identities[1]}, gnarf, undefined)`);
  });

  it.skip('only owner can grant access to an identity', async () => {
    throw new Error('not implemented');
  });

  it.only('grant read access to identity', async () => {
    const bmailContent = getBMailContent();
    // remove access before, it would not send a bmail, if the user was added before
    await runtime0.identity.removeAccess(identities[1], 'readWrite');
    await runtime0.identity.grantAccess(
      identities[1],
      'read',
      bmailContent,
      'best and most awesome guy',
    );

    // get all the bmails
    const { mails } = await runtime1.mailbox.getReceivedMails(5, 0);
    const foundMailAddress = Object.keys(mails).find(
      (mailAddress: string) => mails[mailAddress]?.content?.title === bmailContent.title,
    );
    const accessMail = await runtime1.mailbox.getMail(foundMailAddress);
    const { encryptionKey } = (accessMail.content.attachments.find(
      (att: any) => att.type === 'identityAccess',
    ));

    // check if the bmail was received and if the user has get the correct encryptionKey
    const identity0Sha3 = runtime0.web3.utils.soliditySha3(identities[0]);
    const expectedEncryptionKey = runtime0.runtimeConfig.keyConfig[identity0Sha3];
    expect(encryptionKey).to.be.eq(expectedEncryptionKey);

    // check everything can be stored in the profile
    await runtime1.profile.loadForAccount();
    await runtime1.profile.setIdentityAccess(identities[0], encryptionKey);
    await runtime1.profile.storeForAccount(runtime1.profile.treeLabels.addressBook);
    await runtime1.profile.loadForAccount(runtime1.profile.treeLabels.addressBook);
    const accessList = await runtime1.profile.getIdentityAccessList();
    expect(accessList[identities[0]].identityAccess).to.be.eq(encryptionKey);

    // check if the user can read on behalf of
    const runtime1For0 = await getRuntimeForIdentity(runtime1, identities[0]);
    const addressBook = await runtime1For0.profile.getAddressBook();
    expect(addressBook.profile[identities[1].hasIdentityAccess]).to.be.eq('read');
  });

  it.skip('grant write access to identity', async () => {

  });
});
