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

  let minimalValidVcData: VcDocumentTemplate;

  // Mock the did-resolver package that did-jwt usually requires
  const evanResolver = {
    async resolve(did) {
      return (await runtime.did.getDidDocument(did)) as any;
    }
  }

  before(async () => {
    runtime = await TestUtils.getRuntime(accounts[0], null, { useIdentity: true });
    verifications = await TestUtils.getVerifications(runtime.web3, await TestUtils.getIpfs());
    issuerIdentityId = await verifications.getIdentityForAccount(issuerAccountId, true);
    subjectIdentityId = await verifications.getIdentityForAccount(subjectAccountId, true);
    minimalValidVcData = {
      id: 'randomCustomId',
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
    it('allows me to create a valid offline VC', async () => {
      const createdVcDoc = await runtime.vc.createVc(minimalValidVcData);

      expect(createdVcDoc.id).to.eq(minimalValidVcData.id);
      expect(createdVcDoc.issuer.id).to.eq(minimalValidVcData.issuer.id);
      expect(createdVcDoc.credentialSubject.id).to.eq(minimalValidVcData.credentialSubject.id);
      expect(didJWT.verifyJWT(createdVcDoc.proof.jws, {resolver: evanResolver})).to.be.eventually.fulfilled;
    });

    it('allows me to store a valid VC on-chain (and registering an ID implicitly)', async () => {
      const promise = runtime.vc.storeVc(minimalValidVcData, true);
      await expect(promise).to.not.be.rejected;
      await expect(didJWT.verifyJWT((await promise).proof.jws, {resolver: evanResolver})).to.not.be.rejected;
    });

    it('adds a credentialStatus property to the VC document when storing on-chain', async () => {
      const promise = runtime.vc.storeVc(minimalValidVcData, true);
      const endpointUrl = runtime.vc.options.credentialStatusEndpoint;
      await expect(promise).to.not.be.rejected;

      const doc = await promise;
      expect(doc.credentialStatus.id).to.eq(`${endpointUrl}${doc.id}`);
    });

    it('allows me to store a valid VC on-chain under my registered ID', async () => {
      const myRegisteredId = await runtime.vc.createId();
      const myDoc: VcDocumentTemplate = {...minimalValidVcData};
      myDoc.id = myRegisteredId;
      const promise = runtime.vc.storeVc(myDoc);

      await expect(promise).to.not.be.rejected;
      expect((await promise).id).to.eq(myRegisteredId);
    });

    it('does not allow me to store a valid VC on-chain under an invalid ID', async () => {
      const invalidId = 'invalidId';
      const myDoc: VcDocumentTemplate = {
        ...minimalValidVcData,
        id: invalidId
      };
      const promise = runtime.vc.storeVc(myDoc);

      await expect(promise).to.be.rejectedWith(`Given VC ID ("${invalidId}") is no valid evan VC ID`);
    });

    it('does not allow me to issue a VC under a different issuer ID', async () => {
      const myDoc: VcDocumentTemplate = {
        ...minimalValidVcData,
        issuer: {
          id: await runtime.did.convertIdentityToDid(subjectIdentityId)
        }
      };
      const promise = runtime.vc.createVc(myDoc);

      await expect(promise).to.be.rejectedWith('You are not authorized to issue this VC');
    });

    it('does not allow me to store a VC under an ID I do not own', async() => {
      // Have another identity create a VC that we then want to store
      const otherRuntime = await TestUtils.getRuntime(accounts[1], null, { useIdentity: true });
      const someoneElsesId = await otherRuntime.vc.createId();

      const vcData = {
        ...minimalValidVcData,
        id: someoneElsesId
      }

      const promise = runtime.vc.storeVc(vcData);
      await expect(promise).to.be.rejectedWith(`Active identity is not the owner of the given VC ID ${someoneElsesId}`);
    });

    it('allows me to get an existing VC using the full VC ID URI', async () => {
      const storedVcDoc = await runtime.vc.storeVc(minimalValidVcData, true);
      const promise =  runtime.vc.getVc(storedVcDoc.id);

      await expect(promise).to.not.be.rejected;
      expect((await promise).id).to.eq(storedVcDoc.id);
    });

    it('allows me to get an existing VC using only the VC ID (discarding vc:evan prefix)', async () => {
      const storedVcDoc = await runtime.vc.storeVc(minimalValidVcData, true);
      const promise =  runtime.vc.getVc(storedVcDoc.id.replace('vc:evan:testcore:', ''));

      await expect(promise).to.not.be.rejected;
      expect((await promise).id).to.eq(storedVcDoc.id);
    });

    it('does not allow me to get a valid but non-existing VC', async () => {
      const nonExistingVcId = '0x2a838a6961be98f6a182f375bb9158848ee9760ca97a379939ccdf03fc442a23'
      const fetchedVcDoc = runtime.vc.getVc(nonExistingVcId);

      expect(fetchedVcDoc).to.be.rejectedWith(`VC for address ${nonExistingVcId} does not exist`);
    });

    it('does not allow me to get an existing VC in the wrong environment', async () => {
      const storedVcDoc = await runtime.vc.storeVc(minimalValidVcData, true);
      const fetchedVcDoc = runtime.vc.getVc(storedVcDoc.id.replace('testcore:', 'core:'));

      await expect(fetchedVcDoc).to.be.rejectedWith('Given VC ID environment "core" does not match current "testcore"');
    });

    it('does not allow me to create a VC without an issuer', async() => {
      const vc = {
        ...minimalValidVcData,
        issuer: {
          id: ''
        }
      };
      const promise = runtime.vc.createVc(vc);

      await expect(promise).to.be.rejectedWith(`Invalid issuer DID: ${vc.issuer.id}`);
    });

    it('does not allow me to create a VC without a subject', async() => {
      const vc = {
        ...minimalValidVcData,
        credentialSubject: {
          id: ''
        }
      };
      const promise = runtime.vc.createVc(vc);

      await expect(promise).to.be.rejectedWith('No Subject ID provided');
    });
  });
});
