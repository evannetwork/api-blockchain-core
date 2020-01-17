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
import { VcDocumentTemplate, VcDocument } from './vc';
import { Verifications } from '../verifications/verifications';
import { accounts } from '../test/accounts';


use(chaiAsPromised);

// eslint-disable-next-line func-names
describe('VC Resolver', function () {
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
    },
  };

  async function compareDocuments(original: VcDocument, signedPayload: any): Promise<void> {
    const sig = {
      ...signedPayload,
    };
    const orig = {
      ...original,
    };
    delete sig.proof;
    delete orig.proof;
    const proofPayloadHash = await runtime.nameResolver.soliditySha3(JSON.stringify(sig));
    const documentHash = await runtime.nameResolver.soliditySha3(JSON.stringify(orig));
    expect(proofPayloadHash).eq(documentHash);
  }

  before(async () => {
    runtime = await TestUtils.getRuntime(accounts[0], null, { useIdentity: true });
    verifications = await TestUtils.getVerifications(runtime.web3, await TestUtils.getIpfs());
    issuerIdentityId = await verifications.getIdentityForAccount(issuerAccountId, true);
    subjectIdentityId = await verifications.getIdentityForAccount(subjectAccountId, true);
    minimalValidVcData = {
      issuer: {
        id: await runtime.did.convertIdentityToDid(issuerIdentityId),
      },
      credentialSubject: {
        id: await runtime.did.convertIdentityToDid(subjectIdentityId),
        data: [
          {
            name: 'isTrustedSupplier',
            value: 'true',
          },
        ],
      },
      validFrom: new Date(Date.now()).toISOString(),
    };
  });

  describe('When creating a VC', async () => {
    it('allows me to create a valid offline VC', async () => {
      const myDoc: VcDocumentTemplate = {
        ...minimalValidVcData,
        id: 'randomCustomId',
      };
      const createdVcDoc = await runtime.vc.createVc(myDoc);

      expect(createdVcDoc.id).to.eq(myDoc.id);
      expect(createdVcDoc.issuer.id).to.eq(myDoc.issuer.id);
      expect(createdVcDoc.credentialSubject.id).to.eq(myDoc.credentialSubject.id);
      await expect(didJWT.verifyJWT(createdVcDoc.proof.jws, { resolver: evanResolver }))
        .to.be.eventually.fulfilled;

      await expect(didJWT.verifyJWT(createdVcDoc.proof.jws, { resolver: evanResolver }))
        .to.not.be.rejected;
      const verifiedSignature = await didJWT.verifyJWT(
        createdVcDoc.proof.jws,
        { resolver: evanResolver },
      );

      // fails if signed VC and proof-carrying VC not matching
      await compareDocuments(createdVcDoc, verifiedSignature.payload.vc);
    });

    it('does not allow me to issue a VC with missing issuer ID', async () => {
      const promise = runtime.vc.createVc(minimalValidVcData);
      await expect(promise).to.be.rejectedWith('VC misses id');
    });

    it('does not allow me to issue a VC under a different issuer ID', async () => {
      const myDoc: VcDocumentTemplate = {
        ...minimalValidVcData,
        id: 'randomCustomId',
        issuer: {
          id: await runtime.did.convertIdentityToDid(subjectIdentityId),
        },
      };
      const promise = runtime.vc.createVc(myDoc);

      await expect(promise).to.be.rejectedWith('You are not authorized to issue this VC');
    });

    it('does not allow me to create a VC without an issuer', async () => {
      const vc = {
        ...minimalValidVcData,
        id: 'randomCustomId',
        issuer: {
          id: '',
        },
      };
      const promise = runtime.vc.createVc(vc);

      await expect(promise).to.be.rejectedWith(`Invalid issuer DID: ${vc.issuer.id}`);
    });

    it('does not allow me to create a VC without a subject', async () => {
      const vc = {
        ...minimalValidVcData,
        id: 'randomCustomId',
        credentialSubject: {
          id: '',
        },
      };
      const promise = runtime.vc.createVc(vc);

      await expect(promise).to.be.rejectedWith('No Subject ID provided');
    });
  });

  describe('When storing a VC onchain', async () => {
    it('allows me to store a valid VC on-chain (and registering an ID implicitly)', async () => {
      const promise = runtime.vc.storeVc(minimalValidVcData);
      await expect(promise).to.not.be.rejected;
      const storedVc = await promise;
      await expect(didJWT.verifyJWT(storedVc.proof.jws, { resolver: evanResolver }))
        .to.not.be.rejected;
      const verifiedSignature = await didJWT.verifyJWT(
        storedVc.proof.jws,
        { resolver: evanResolver },
      );

      // fails if signed VC and proof-carrying VC not matching
      await compareDocuments(storedVc, verifiedSignature.payload.vc);
    });

    it('adds a credentialStatus property to the VC document when storing on-chain', async () => {
      const promise = runtime.vc.storeVc(minimalValidVcData);
      const endpointUrl = runtime.vc.credentialStatusEndpoint;
      await expect(promise).to.not.be.rejected;

      const doc = await promise;
      expect(doc.credentialStatus.id).to.eq(`${endpointUrl}${doc.id}`);
    });

    it('allows me to store a valid VC on-chain under my registered ID', async () => {
      const myRegisteredId = await runtime.vc.createId();
      const myDoc: VcDocumentTemplate = { ...minimalValidVcData };
      myDoc.id = myRegisteredId;
      const promise = runtime.vc.storeVc(myDoc);

      await expect(promise).to.not.be.rejected;
      expect((await promise).id).to.eq(myRegisteredId);
    });

    it('does not allow me to store a valid VC on-chain under an invalid ID', async () => {
      const invalidId = 'invalidId';
      const myDoc: VcDocumentTemplate = {
        ...minimalValidVcData,
        id: invalidId,
      };
      const promise = runtime.vc.storeVc(myDoc);

      await expect(promise)
        .to.be.rejectedWith(`Given VC ID ("${invalidId}") is no valid evan VC ID`);
    });

    it('(API level) does not allow me to store a VC under an ID I do not own', async () => {
      // Have another identity create a VC that we then want to store
      const otherRuntime = await TestUtils.getRuntime(accounts[1], null, { useIdentity: true });
      const someoneElsesId = await otherRuntime.vc.createId();

      const vcData = {
        ...minimalValidVcData,
        id: someoneElsesId,
      };

      const promise = runtime.vc.storeVc(vcData);
      await expect(promise).to.be.rejectedWith(
        `Active identity is not the owner of the given VC ID ${someoneElsesId}`,
      );
    });

    it('(contract level) does not allow me to store a VC under an ID I do not own', async () => {
      // Have another identity create a VC that we then want to store
      const otherRuntime = await TestUtils.getRuntime(accounts[1], null, { useIdentity: true });
      const someoneElsesId = (await otherRuntime.vc.createId()).replace('vc:evan:testcore:', '');

      // Try to write a fake dfs hash under someone else's registered ID
      const promise = runtime.executor.executeContractTransaction(
        await (runtime.vc as any).getRegistryContract(),
        'setVc',
        { from: runtime.activeIdentity },
        someoneElsesId,
        '0x2a838a6961be98f6a182f375bb9158848ee9760ca97a379939ccdf03fc442a23', // fake address
      );

      // Expect that the transaction is rejected since we do not own the address
      await expect(promise).to.be.rejectedWith('could not estimate gas usage');
    });

    it('allows me to get an existing VC using the full VC ID URI', async () => {
      const storedVcDoc = await runtime.vc.storeVc(minimalValidVcData);
      const promise = runtime.vc.getVc(storedVcDoc.id);

      await expect(promise).to.not.be.rejected;
      expect((await promise).id).to.eq(storedVcDoc.id);
    });

    it('allows me to get an existing VC using only the VC ID (discarding vc:evan prefix)', async () => {
      const storedVcDoc = await runtime.vc.storeVc(minimalValidVcData);
      const promise = runtime.vc.getVc(storedVcDoc.id);

      await expect(promise).to.not.be.rejected;
      expect((await promise).id).to.eq(storedVcDoc.id);
    });

    it('does not allow me to get a valid but non-existing VC', async () => {
      const nonExistingVcId = '0x2a838a6961be98f6a182f375bb9158848ee9760ca97a379939ccdf03fc442a23';
      const fetchedVcDoc = runtime.vc.getVc(nonExistingVcId);

      expect(fetchedVcDoc).to.be.rejectedWith(`VC for address ${nonExistingVcId} does not exist`);
    });

    it('does not allow me to get an existing VC in the wrong environment', async () => {
      const storedVcDoc = await runtime.vc.storeVc(minimalValidVcData);
      const fetchedVcDoc = runtime.vc.getVc(storedVcDoc.id.replace('testcore:', 'core:'));

      await expect(fetchedVcDoc)
        .to.be.rejectedWith('Given VC ID environment "core" does not match current "testcore"');
    });
  });

  describe('When revoking a VC', async () => {
    it('allows me to store online VC and revoke it using the bcc', async () => {
      const storedVcDoc = await runtime.vc.storeVc(minimalValidVcData);
      const issuerId = storedVcDoc.issuer.id.replace('did:evan:testcore:', '');
      expect(issuerId).to.be.eq(issuerIdentityId);

      const vcId = storedVcDoc.id.replace('vc:evan:testcore:', '');
      const vcRevokeStatus = await runtime.executor.executeContractCall(
        await (runtime.vc as any).getRegistryContract(),
        'vcRevoke',
        vcId,
      );
      expect(vcRevokeStatus).to.be.false;

      const revokeProcessed = runtime.executor.executeContractTransaction(
        await (runtime.vc as any).getRegistryContract(),
        'revokeVC',
        { from: runtime.activeIdentity },
        vcId,
      );
      await expect(revokeProcessed).to.be.not.rejected;

      const vcRevokeStatusNew = await runtime.executor.executeContractCall(
        await (runtime.vc as any).getRegistryContract(),
        'vcRevoke',
        vcId,
      );
      expect(vcRevokeStatusNew).to.be.not.false;
    });

    it('allows me to store online VC and revoke it using the vc api', async () => {
      const storedVcDoc = await runtime.vc.storeVc(minimalValidVcData);
      const issuerId = storedVcDoc.issuer.id.replace('did:evan:testcore:', '');
      expect(issuerId).to.be.eq(issuerIdentityId);

      const vcId = storedVcDoc.id;

      const vcRevokeStatus = await runtime.vc.getRevokeVcStatus(vcId);
      expect(vcRevokeStatus).to.be.false;

      const revokeProcessed = runtime.vc.revokeVc(vcId);
      await expect(revokeProcessed).to.be.not.rejected;

      const vcRevokeStatusNew = await runtime.vc.getRevokeVcStatus(vcId);
      expect(vcRevokeStatusNew).to.be.not.false;
    });

    it('does not allow me to revoke a non existing VC using the vc api', async () => {
      const nonExistingVcId = '0x2a838a6961be98f6a182f375bb9158848ee9760ca97a379939ccdf03fc442a23';

      const vcRevokeStatus = await runtime.vc.getRevokeVcStatus(nonExistingVcId);
      expect(vcRevokeStatus).to.be.false;

      const revokeProcessed = runtime.vc.revokeVc(nonExistingVcId);
      await expect(revokeProcessed).to.be.rejected;

      const vcRevokeStatusNew = await runtime.vc.getRevokeVcStatus(nonExistingVcId);
      expect(vcRevokeStatusNew).to.be.false;
    });

    it('allows me to get revoke status of an existing VC using the vc api', async () => {
      const storedVcDoc = await runtime.vc.storeVc(minimalValidVcData);
      const issuerId = storedVcDoc.issuer.id.replace('did:evan:testcore:', '');
      expect(issuerId).to.be.eq(issuerIdentityId);
      const vcId = storedVcDoc.id;

      const vcRevokeStatus = await runtime.vc.getRevokeVcStatus(vcId);
      expect(vcRevokeStatus).to.be.false;
    });

    it('does not allow me to revoke VC using non issuer account via bcc', async () => {
      const storedVcDoc = await runtime.vc.storeVc(minimalValidVcData);
      const issuerId = storedVcDoc.issuer.id.replace('did:evan:testcore:', '');
      expect(issuerId).to.be.eq(issuerIdentityId);
      const vcId = storedVcDoc.id.replace('vc:evan:testcore:', '');

      const otherRuntime = await TestUtils.getRuntime(accounts[1], null, { useIdentity: true });

      const vcRevokeStatus = await runtime.executor.executeContractCall(
        await (runtime.vc as any).getRegistryContract(),
        'vcRevoke',
        vcId,
      );
      expect(vcRevokeStatus).to.be.false;

      const revokeProcessed = otherRuntime.executor.executeContractTransaction(
        await (otherRuntime.vc as any).getRegistryContract(),
        'revokeVC',
        { from: otherRuntime.activeIdentity },
        vcId,
      );
      await expect(revokeProcessed).to.be.rejected;

      const vcRevokeStatusNew = await runtime.executor.executeContractCall(
        await (runtime.vc as any).getRegistryContract(),
        'vcRevoke',
        vcId,
      );
      expect(vcRevokeStatusNew).to.be.false;
    });

    it('allows me to store online VC but not revoke it using non issuer account via vc api', async () => {
      const storedVcDoc = await runtime.vc.storeVc(minimalValidVcData);
      const issuerId = storedVcDoc.issuer.id.replace('did:evan:testcore:', '');
      expect(issuerId).to.be.eq(issuerIdentityId);

      const vcId = storedVcDoc.id;
      const otherRuntime = await TestUtils.getRuntime(accounts[1], null, { useIdentity: true });

      const vcRevokeStatus = await runtime.vc.getRevokeVcStatus(vcId);
      expect(vcRevokeStatus).to.be.false;

      const revokeProcessed = otherRuntime.vc.revokeVc(vcId);
      await expect(revokeProcessed).to.be.rejected;

      const vcRevokeStatusNew = await runtime.vc.getRevokeVcStatus(vcId);
      expect(vcRevokeStatusNew).to.be.false;
    });
  });
});
