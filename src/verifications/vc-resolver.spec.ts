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

import { use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { accounts } from '../test/accounts';
import { TestUtils } from '../test/test-utils';
import { Runtime } from '../index';
import { Verifications } from './verifications';
import { VcResolverDocument } from './vc-resolver';

use(chaiAsPromised);

describe('VC Resolver', function() {
  this.timeout(600000);
  let runtime: Runtime;
  let verifications: Verifications;
  const issuerAccountId = accounts[0];
  const subjectAccountId = accounts[1];
  let issuerIdentityId;
  let subjectIdentityId;

  before(async () => {
    runtime = await TestUtils.getRuntime(accounts[0], null, { useIdentity: true });
    verifications = await TestUtils.getVerifications(runtime.web3, await TestUtils.getIpfs());
    issuerIdentityId = await verifications.getIdentityForAccount(issuerAccountId, true);
    subjectIdentityId = await verifications.getIdentityForAccount(subjectAccountId, true);
  });

  describe('When creating a verification', async () => {
    it.only('', async () => {
      const doc: VcResolverDocument = await runtime.vcResolver.storeNewVC({
        issuer: {id: 'did:evan:testcore:' + issuerIdentityId},
        validFrom: new Date(Date.now()).toISOString(),
        credentialSubject: {id: 'did:evan:testcore:' + subjectIdentityId},
        proof: {
          type: '',
          created: '',
          proofPurpose: '',
          verificationMethod: '',
          jws: ''}
      });

      console.log(await runtime.vcResolver.getVC(doc.id.replace('vc:evan:', '')));
    });
  });
});
