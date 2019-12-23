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

  const existingVcId = '0x2a838a6961be98f6a182f375bb9158848ee9760ca97a379939ccdf03fc442a22'

  before(async () => {
    runtime = await TestUtils.getRuntime(accounts[0], null, { useIdentity: true });
    verifications = await TestUtils.getVerifications(runtime.web3, await TestUtils.getIpfs());
    issuerIdentityId = await verifications.getIdentityForAccount(issuerAccountId, true);
    subjectIdentityId = await verifications.getIdentityForAccount(subjectAccountId, true);
    minimalVcData = {
      issuer: {
        id: await runtime.did.convertIdentityToDid(issuerIdentityId),
      },
      credentialSubject: {
        id: await runtime.did.convertIdentityToDid(subjectIdentityId),
      },
      validFrom: new Date(Date.now()).toISOString()
    };
  });

  describe('When creating a VC', async () => {
    it('allows me to store a valid VC', async () => {
      const createdVcDoc = await runtime.vc.setVc(minimalVcData);
      const vcId = createdVcDoc.id.replace('vc:evan:', '');
      const fetchedVcDoc = await runtime.vc.getVc(vcId.replace('testcore:', ''));

      expect(createdVcDoc.id).to.eq(fetchedVcDoc.id);
      expect(createdVcDoc.issuer.did).to.eq(fetchedVcDoc.issuer.did);
    });

    it('Creates a valid proof if none is given', async() => {
      const createdVcDoc = await runtime.vc.setVc(minimalVcData);

      expect(createdVcDoc.proof).not.to.be.undefined;
      expect(createdVcDoc.proof.jws).not.to.be.undefined;

      const jwt = createdVcDoc.proof.jws;

      // Mock the did-resolver package that did-jwt usually requires
      const resolver = {
        async resolve() {
          const doc = await runtime.did.getDidDocument(createdVcDoc.issuer.did);
          // TODO: Workaround until we fixed the public key type array structure (bc that is not allowed)
          doc.publicKey[0].type = 'Secp256k1SignatureVerificationKey2018';
          return doc as any;
        }
      }

      expect(didJWT.verifyJWT(jwt, {resolver: resolver})).to.be.eventually.fulfilled;
    });

    it('allows me to get an existing VC', async () => {     
      const fetchedVcDoc = runtime.vc.getVC(existingVcId.replace('testcore:', ''));
      
      await expect(fetchedVcDoc).to.not.be.rejected
    });    

    it('does not allow me to get a non existing VC', async () => {
      const existingVcId = '0x2a838a6961be98f6a182f375bb9158848ee9760ca97a379939ccdf03fc442a23'
      const fetchedVcDoc = runtime.vc.getVC(existingVcId.replace('testcore:', ''));

      await expect(Error).to.exist;
      await expect(fetchedVcDoc).to.be.rejected
    });     

    it('should not create and store VC with wrong data', async () => {

      minimalVcData = {
        issuer: {
          did: await runtime.did.convertIdentityToDid('0x390f70a9AD51a845C8ea4c74E141219361D24f'),
        },
        credentialSubject: {
          did: await runtime.did.convertIdentityToDid(subjectIdentityId),
        },
        validFrom: new Date(Date.now()).toISOString()
      };
      const createdVcDoc = runtime.vc.storeNewVC(minimalVcData);      

      await expect(Error).to.exist;
      await expect(createdVcDoc).to.be.rejected
    });

    // it.skip('should not allow to store a VC where you are not the issuer', async () => { 
    // });

    // (it.skip('should not allow to store a VC where you are not the issuer on smart contract level', async () => {
    // });

    // it.skip('should not create a VC with invalid proof', async () => {
    // });                   
  });
});
