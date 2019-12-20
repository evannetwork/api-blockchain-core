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

import * as chaiAsPromised from 'chai-as-promised';
import * as didJWT from 'did-jwt';
import { expect, use } from 'chai';

import { Runtime } from '../index';
import { TestUtils } from '../test/test-utils';
import { VcDocumentTemplate } from './vc';
import { Verifications } from '../verifications/verifications';
import { accounts } from '../test/accounts';


use(chaiAsPromised);

describe('VC Resolver', function() {
  this.timeout(600000);
  let runtime: Runtime;
  let verifications: Verifications;
  const issuerAccountId = accounts[0];
  const subjectAccountId = accounts[1];
  let issuerIdentityId;
  let subjectIdentityId;

  let minimalVcData: VcDocumentTemplate;

  before(async () => {
    runtime = await TestUtils.getRuntime(accounts[0], null, { useIdentity: true });
    verifications = await TestUtils.getVerifications(runtime.web3, await TestUtils.getIpfs());
    issuerIdentityId = await verifications.getIdentityForAccount(issuerAccountId, true);
    subjectIdentityId = await verifications.getIdentityForAccount(subjectAccountId, true);
    minimalVcData = {
      issuer: {
        did: await runtime.did.convertIdentityToDid(issuerIdentityId),
      },
      credentialSubject: {
        did: await runtime.did.convertIdentityToDid(subjectIdentityId),
      },
      validFrom: new Date(Date.now()).toISOString()
    };
  });

  describe('When creating a VC', async () => {
    it('allows me to store a valid VC', async () => {
      const createdVcDoc = await runtime.vc.storeNewVC(minimalVcData);
      const vcId = createdVcDoc.id.replace('vc:evan:', '');
      const fetchedVcDoc = await runtime.vc.getVC(vcId.replace('testcore:', ''));

      expect(createdVcDoc.id).to.eq(fetchedVcDoc.id);
      expect(createdVcDoc.issuer.id).to.eq(fetchedVcDoc.issuer.id);
    });

    it('Creates a valid proof if none is given', async() => {
      const createdVcDoc = await runtime.vc.storeNewVC(minimalVcData);

      expect(createdVcDoc.proof).not.to.be.undefined;
      expect(createdVcDoc.proof.jws).not.to.be.undefined;

      const jwt = createdVcDoc.proof.jws;

      // Mock the did-resolver package that did-jwt usually requires
      const resolver = {
        async resolve() {
          const doc = await runtime.did.getDidDocument(createdVcDoc.issuer.id);
          // TODO: Workaround until we fixed the public key type array structure (bc that is not allowed)
          doc.publicKey[0].type = 'Secp256k1SignatureVerificationKey2018';
          return doc as any;
        }
      }

      expect(didJWT.verifyJWT(jwt, {resolver: resolver})).to.be.eventually.fulfilled;
    });
  });
});
