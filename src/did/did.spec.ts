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
import * as _ from 'lodash';
import { expect, use } from 'chai';
import { Did, DidProofType } from './did';
import { SignerIdentity } from '../contracts/signer-identity';
import { TestUtils } from '../test/test-utils';
import { accounts } from '../test/accounts';
import {
  DigitalTwin,
  DigitalTwinOptions,
  Runtime,
} from '../index';


use(chaiAsPromised);

describe('DID Resolver', function test() {
  this.timeout(600000);
  let accounts0Identity: string;
  let accounts0Did: string;
  let runtimes: Runtime[];

  before(async () => {
    runtimes = await Promise.all([
      TestUtils.getRuntime(accounts[0], null, { useIdentity: true }),
      TestUtils.getRuntime(accounts[1], null, { useIdentity: true }),
      TestUtils.getRuntime(accounts[2], null, { useIdentity: false }),
    ]);
    accounts0Identity = await runtimes[0].verifications.getIdentityForAccount(
      runtimes[0].underlyingAccount, true,
    );
    accounts0Did = await runtimes[0].did.convertIdentityToDid(accounts0Identity);
    // create new registry and update runtimes 0 and 1
    const registry = await runtimes[2].executor.createContract(
      'DidRegistry', [], { from: accounts[2], gas: 1_000_000 },
    );
    const options0 = (({
      accountStore,
      contractLoader,
      dfs,
      executor,
      nameResolver,
      signer,
      verifications,
      web3,
    }) => ({
      accountStore,
      contractLoader,
      dfs,
      executor,
      nameResolver,
      signerIdentity: signer as SignerIdentity,
      verifications,
      web3,
    }))(runtimes[0]);
    runtimes[0].did = new Did(options0, { registryAddress: registry.options.address });
    const options1 = (({
      accountStore,
      contractLoader,
      dfs,
      executor,
      nameResolver,
      signer,
      verifications,
      web3,
    }) => ({
      accountStore,
      contractLoader,
      dfs,
      executor,
      nameResolver,
      signerIdentity: signer as SignerIdentity,
      verifications,
      web3,
    }))(runtimes[1]);
    runtimes[1].did = new Did(options1, { registryAddress: registry.options.address });
  });

  describe('when storing did documents for account identities', async () => {
    it('allows to store a DID document for the own identity', async () => {
      const document = await runtimes[0].did.getDidDocumentTemplate();
      const promise = runtimes[0].did.setDidDocument(accounts0Did, document);
      await expect(promise).not.to.be.rejected;
    });

    it('can get retrieve an account identities DID document', async () => {
      const document = await runtimes[0].did.getDidDocumentTemplate();
      await runtimes[0].did.setDidDocument(accounts0Did, document);
      const retrieved = await runtimes[0].did.getDidDocument(accounts0Did);
      expect(retrieved.authentication).to.deep.eq(document.authentication);
      expect(retrieved.id).to.eq(document.id);
      expect(retrieved.publicKey).to.deep.eq(document.publicKey);
    });

    it('allows to get a DID document of another identity', async () => {
      const document = await runtimes[0].did.getDidDocumentTemplate();
      await runtimes[0].did.setDidDocument(accounts0Did, document);
      const retrieved = await runtimes[1].did.getDidDocument(accounts0Did);
      expect(retrieved.authentication).to.deep.eq(document.authentication);
      expect(retrieved.id).to.eq(document.id);
      expect(retrieved.publicKey).to.deep.eq(document.publicKey);
    });

    it('does not allow to store a DID document for another identity', async () => {
      const document = await runtimes[0].did.getDidDocumentTemplate();
      const accounts1Identity = await runtimes[0].verifications.getIdentityForAccount(
        runtimes[1].underlyingAccount,
        true,
      );
      const accounts1Did = await runtimes[0].did.convertIdentityToDid(accounts1Identity);
      const promise = runtimes[0].did.setDidDocument(accounts1Did, document);
      await expect(promise).to.be.rejectedWith(/^could not estimate gas usage for setDidDocument/);
    });

    it('allows to define services in a DID document', async () => {
      const template = await runtimes[0].did.getDidDocumentTemplate();
      await runtimes[0].did.setDidDocument(accounts0Did, template);
      const servicelessDocument = await runtimes[0].did.getDidDocument(accounts0Did);

      // set new service
      const random = Math.floor(Math.random() * 1e9);
      const service = [{
        id: `${accounts0Did}#randomService`,
        type: `randomService-${random}`,
        serviceEndpoint: `https://openid.example.com/${random}`,
      }];
      await runtimes[0].did.setService(accounts0Did, service);
      const serviceDocument = await runtimes[0].did.getDidDocument(accounts0Did);
      expect(await runtimes[0].did.getService(accounts0Did))
        .to.deep.eq(service);
      expect(serviceDocument.created).to.eq(servicelessDocument.created);
      expect(serviceDocument.id).to.eq(servicelessDocument.id);
      expect(serviceDocument.publicKey).to.deep.eq(servicelessDocument.publicKey);
    });

    it('does not allow me to fetch a default did document for accounts that have no identity set', async () => {
      const randomIdentity = TestUtils.getRandomAddress();
      const did = await runtimes[0].did.convertIdentityToDid(randomIdentity);
      const identityDidDocP = runtimes[0].did.getDidDocument(did);
      await expect(identityDidDocP).to.be.rejectedWith(
        new RegExp(`^No record found for ${randomIdentity}\\. Is this a valid identity address\\?$`, 'i'),
      );
    });

    it('automatically sets created, proof, and updated properties', async () => {
      const document = await runtimes[0].did.getDidDocumentTemplate();
      await runtimes[0].did.setDidDocument(accounts0Did, document);
      const didDoc = await runtimes[0].did.getDidDocument(accounts0Did);
      expect(didDoc).to.have.property('created');
      expect(didDoc).to.have.property('updated');
      expect(didDoc).to.have.property('proof');
    });

    it('throws if a DID document has an invalid proof', async () => {
      const didContract = await (runtimes[0].did as any).getRegistryContract();

      // Create scenario where a document carries a proof that has been
      //   created over a differing document
      const documentToSave = await runtimes[0].did.getDidDocumentTemplate();
      const documentToCreateProofOver = _.cloneDeep(documentToSave);
      documentToCreateProofOver.updated = new Date(Date.now()).toISOString();

      const invalidProof = await (runtimes[0].did as any).createJwtForDid(
        documentToCreateProofOver,
        accounts0Did,
        DidProofType.EcdsaPublicKeySecp256k1,
      );
      documentToSave.proof = {
        type: DidProofType.EcdsaPublicKeySecp256k1,
        created: new Date(Date.now()).toISOString(),
        proofPurpose: 'assertionMethod',
        verificationMethod: documentToSave.publicKey[0].id,
        jws: invalidProof,
      };

      // Set did document with invalid proof manually (the api wouldn't allow this)
      const identity = await runtimes[0].did.convertDidToIdentity(accounts0Did);
      const targetHash = await (runtimes[0].did as any).padIdentity(identity);
      const documentHash = await runtimes[0].dfs.add('did', Buffer.from(JSON.stringify(documentToSave)));
      await runtimes[0].executor.executeContractTransaction(
        didContract,
        'setDidDocument',
        { from: runtimes[0].activeIdentity },
        targetHash,
        documentHash,
      );

      // Try to retrieve it
      expect(runtimes[0].did.getDidDocument(accounts0Did))
        .to.be.eventually.rejectedWith('Invalid proof');
    });
  });

  describe('when storing did documents for contract identities', () => {
    const twinDescription = {
      name: 'test twin',
      description: 'twin from test run',
      author: 'evan GmbH',
      version: '0.1.0',
      dbcpVersion: 2,
    };
    before(async () => {
      // Set DID document of testaccount back to normal, or else these tests will fail ( :( )
      const document = await runtimes[0].did.getDidDocumentTemplate();
      await runtimes[0].did.setDidDocument(accounts0Did, document);
    });

    it('allows to store a DID document for the identity of an own contract', async () => {
      const twin = await DigitalTwin.create(
        runtimes[0] as DigitalTwinOptions,
        {
          accountId: runtimes[0].activeAccount,
          containerConfig: null,
          description: twinDescription,
        },
      );
      const twinIdentity = await runtimes[0].verifications.getIdentityForAccount(
        await twin.getContractAddress(), true,
      );
      const twinDid = await runtimes[0].did.convertIdentityToDid(twinIdentity);

      const controllerDid = await runtimes[0].did.convertIdentityToDid(
        runtimes[0].activeIdentity,
      );
      const controllerDidDocument = await runtimes[0].did.getDidDocument(accounts0Did);
      const document = await runtimes[0].did.getDidDocumentTemplate(
        twinDid, controllerDid, controllerDidDocument.authentication[0],
      );
      const promise = runtimes[0].did.setDidDocument(twinDid, document);
      await expect(promise).not.to.be.rejected;
    });

    it('can retrieve a contract identities DID document', async () => {
      const accountRuntime = await TestUtils.getRuntime(
        runtimes[0].underlyingAccount, null, { useIdentity: true },
      );
      const twin = await DigitalTwin.create(
        accountRuntime as DigitalTwinOptions,
        {
          accountId: accountRuntime.activeAccount,
          containerConfig: null,
          description: twinDescription,
        },
      );
      const twinIdentity = await runtimes[0].verifications.getIdentityForAccount(
        await twin.getContractAddress(), true,
      );
      const twinDid = await runtimes[0].did.convertIdentityToDid(twinIdentity);

      const controllerDid = await runtimes[0].did.convertIdentityToDid(
        runtimes[0].activeIdentity,
      );
      const controllerDidDocument = await runtimes[0].did.getDidDocument(accounts0Did);
      const document = await runtimes[0].did.getDidDocumentTemplate(
        twinDid, controllerDid, controllerDidDocument.authentication[0],
      );
      await runtimes[0].did.setDidDocument(twinDid, document);
      const retrieved = await runtimes[0].did.getDidDocument(twinDid);

      expect(retrieved.authentication).to.deep.eq(document.authentication);
      expect(retrieved.id).to.eq(document.id);
      expect(retrieved.publicKey).to.deep.eq(document.publicKey);
      expect(retrieved.controller).to.eq(document.controller);
      expect(retrieved).to.have.property('created');
      expect(retrieved).to.have.property('updated');
      expect(retrieved).to.have.property('proof');
    });

    it('allows to get a DID document of another identity', async () => {
      const twin = await DigitalTwin.create(
        runtimes[0] as DigitalTwinOptions,
        {
          accountId: runtimes[0].activeAccount,
          containerConfig: null,
          description: twinDescription,
        },
      );
      const twinIdentity = await runtimes[0].verifications.getIdentityForAccount(
        await twin.getContractAddress(), true,
      );
      const twinDid = await runtimes[0].did.convertIdentityToDid(twinIdentity);

      const controllerDid = await runtimes[0].did.convertIdentityToDid(
        runtimes[0].activeIdentity,
      );
      const controllerDidDocument = await runtimes[0].did.getDidDocument(accounts0Did);
      const document = await runtimes[0].did.getDidDocumentTemplate(
        twinDid, controllerDid, controllerDidDocument.authentication[0],
      );
      await runtimes[0].did.setDidDocument(twinDid, document);

      const retrieved = await runtimes[1].did.getDidDocument(twinDid);

      expect(retrieved.authentication).to.deep.eq(document.authentication);
      expect(retrieved.id).to.eq(document.id);
      expect(retrieved.publicKey).to.deep.eq(document.publicKey);
      expect(retrieved.controller).to.eq(document.controller);
    });

    it('does not allow to store a DID document for the identity of a contract I do not own', async () => {
      const accountRuntime = await TestUtils.getRuntime(
        runtimes[0].underlyingAccount, null, { useIdentity: true },
      );

      const twin = await DigitalTwin.create(
        accountRuntime as DigitalTwinOptions,
        {
          accountId: accountRuntime.activeAccount,
          containerConfig: null,
          description: twinDescription,
        },
      );
      const twinIdentity = await runtimes[0].verifications.getIdentityForAccount(
        await twin.getContractAddress(), true,
      );

      const twinDid = await runtimes[0].did.convertIdentityToDid(twinIdentity);

      const controllerDid = await runtimes[0].did.convertIdentityToDid(
        runtimes[0].activeIdentity,
      );
      const controllerDidDocument = await runtimes[0].did.getDidDocument(accounts0Did);
      const document = await runtimes[0].did.getDidDocumentTemplate(
        twinDid, controllerDid, controllerDidDocument.authentication[0],
      );
      const runtime1 = runtimes[1];
      const promise = runtime1.did.setDidDocument(twinDid, document);
      await expect(promise).to.be.rejectedWith(/^You are not authorized to issue this Did/);
    });

    it('allows to fetch a default DID document for newly created contract identities', async () => {
      const accountRuntime = await TestUtils.getRuntime(
        runtimes[0].underlyingAccount, null, { useIdentity: true },
      );
      delete accountRuntime.did; // Do not create DID document

      const twin = await DigitalTwin.create(
        accountRuntime as DigitalTwinOptions,
        {
          accountId: accountRuntime.activeAccount,
          containerConfig: null,
          description: twinDescription,
        },
      );
      const twinIdentity = await runtimes[0].verifications.getIdentityForAccount(
        await twin.getContractAddress(), true,
      );
      const did = await runtimes[0].did.convertIdentityToDid(twinIdentity);
      const controllerDid = await runtimes[0].did.convertIdentityToDid(runtimes[0].activeIdentity);
      const controllerDidDoc = await runtimes[0].did.getDidDocument(controllerDid);
      const authKeyIds = controllerDidDoc.publicKey.map((key) => key.id).join(',');

      const expectedDefaultDid = {
        '@context': 'https://w3id.org/did/v1',
        id: did,
        controller: controllerDidDoc.id,
        authentication: [
          authKeyIds,
        ],
      };
      const defaultDidDoc = await runtimes[0].did.getDidDocument(did);
      await expect(defaultDidDoc).to.deep.eq(expectedDefaultDid);
    });
  });

  describe('when storing did documents for alias identities', () => {
    before(async () => {
      // Set DID document of testaccount back to normal, or else these tests will fail ( :( )
      const document = await runtimes[0].did.getDidDocumentTemplate();
      await runtimes[0].did.setDidDocument(accounts0Did, document);
    });

    it('can create did documents for alias identities', async () => {
      const aliasHash = TestUtils.getRandomBytes32();
      const aliasIdentity = await runtimes[0].verifications.createIdentity(
        runtimes[0].underlyingAccount, aliasHash, false,
      );

      const did = await runtimes[0].did.convertIdentityToDid(aliasIdentity);
      const controllerDid = await runtimes[0].did.convertIdentityToDid(
        runtimes[0].activeIdentity,
      );
      const controllerDidDocument = await runtimes[0].did.getDidDocument(accounts0Did);
      const document = await runtimes[0].did.getDidDocumentTemplate(
        did, controllerDid, controllerDidDocument.authentication[0],
      );
      const promise = runtimes[0].did.setDidDocument(did, document);

      await expect(promise).not.to.be.rejected;
    });

    it('can create did documents for alias identities without backlinking to given hash', async () => {
      const aliasHash = TestUtils.getRandomBytes32();
      const aliasIdentity = await runtimes[0].verifications.createIdentity(
        runtimes[0].underlyingAccount, aliasHash, false, false,
      );

      const did = await runtimes[0].did.convertIdentityToDid(aliasIdentity);
      const controllerDid = await runtimes[0].did.convertIdentityToDid(
        runtimes[0].activeIdentity,
      );
      const controllerDidDocument = await runtimes[0].did.getDidDocument(accounts0Did);
      const document = await runtimes[0].did.getDidDocumentTemplate(
        did, controllerDid, controllerDidDocument.authentication[0],
      );
      const promise = runtimes[0].did.setDidDocument(did, document);

      await expect(promise).not.to.be.rejected;
    });

    it('can fetch did documents for alias identities', async () => {
      const aliasHash = TestUtils.getRandomBytes32();
      const aliasIdentity = await runtimes[0].verifications.createIdentity(
        runtimes[0].underlyingAccount, aliasHash, false,
      );

      const did = await runtimes[0].did.convertIdentityToDid(aliasIdentity);
      const controllerDid = await runtimes[0].did.convertIdentityToDid(
        runtimes[0].activeIdentity,
      );
      const controllerDidDocument = await runtimes[0].did.getDidDocument(accounts0Did);
      const documentTemplate = await runtimes[0].did.getDidDocumentTemplate(
        did, controllerDid, controllerDidDocument.authentication[0],
      );
      await runtimes[0].did.setDidDocument(did, documentTemplate);
      const actualDocument = await runtimes[0].did.getDidDocument(did);
      expect(actualDocument.authentication).to.deep.eq(documentTemplate.authentication);
      expect(actualDocument.controller).to.eq(documentTemplate.controller);
      expect(actualDocument.id).to.eq(documentTemplate.id);
      expect(actualDocument).to.have.property('created');
      expect(actualDocument).to.have.property('updated');
      expect(actualDocument).to.have.property('proof');
    });

    it('can fetch did documents for alias identities that have not set a doc themselves yet', async () => {
      const aliasHash = TestUtils.getRandomBytes32();
      const aliasIdentity = await runtimes[0].verifications.createIdentity(
        runtimes[0].underlyingAccount, aliasHash, false,
      );

      const ownerIdentity = await runtimes[0].verifications
        .getIdentityForAccount(runtimes[0].underlyingAccount, true);
      const controllerDid = await runtimes[0].did.convertIdentityToDid(ownerIdentity);
      const controllerDidDoc = await runtimes[0].did.getDidDocument(controllerDid);
      const did = await runtimes[0].did.convertIdentityToDid(aliasIdentity);
      const authKeyIds = controllerDidDoc.publicKey.map((key) => key.id).join(',');

      const expectedDefaultDid = {
        '@context': 'https://w3id.org/did/v1',
        id: did,
        controller: controllerDidDoc.id,
        authentication: [
          authKeyIds,
        ],
      };

      const aliasIdentityDid = await runtimes[0].did.getDidDocument(did);
      expect(aliasIdentityDid).to.deep.eq(expectedDefaultDid);
    });
  });
});
