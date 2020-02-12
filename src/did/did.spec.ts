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
import { expect, use } from 'chai';

import { accounts } from '../test/accounts';
import { TestUtils } from '../test/test-utils';
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
    ]);
    accounts0Identity = await runtimes[0].verifications.getIdentityForAccount(
      runtimes[0].underlyingAccount, true,
    );
    accounts0Did = await runtimes[0].did.convertIdentityToDid(accounts0Identity);
  });

  describe('when storing did documents for account identities', async () => {
    it.only('allows to store a DID document for the own identity', async () => {
      const document = await runtimes[0].did.getDidDocumentTemplate();
      const promise = runtimes[0].did.setDidDocument(accounts0Did, document);
      await expect(promise).not.to.be.rejected;
    });

    it('can get retrieve an account identities DID document', async () => {
      const document = await runtimes[0].did.getDidDocumentTemplate();
      await runtimes[0].did.setDidDocument(accounts0Did, document);
      const retrieved = await runtimes[0].did.getDidDocument(accounts0Did);
      expect(retrieved).to.deep.eq(document);
    });

    it('allows to get a DID document of another identity', async () => {
      const document = await runtimes[0].did.getDidDocumentTemplate();
      await runtimes[0].did.setDidDocument(accounts0Did, document);
      const retrieved = await runtimes[1].did.getDidDocument(accounts0Did);

      expect(retrieved).to.deep.eq(document);
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
      const document = await runtimes[0].did.getDidDocumentTemplate();
      await runtimes[0].did.setDidDocument(accounts0Did, document);

      // set new service
      const random = Math.floor(Math.random() * 1e9);
      const service = [{
        id: `${accounts0Did}#randomService`,
        type: `randomService-${random}`,
        serviceEndpoint: `https://openid.example.com/${random}`,
      }];
      await runtimes[0].did.setService(accounts0Did, service);

      expect(await runtimes[0].did.getService(accounts0Did))
        .to.deep.eq(service);
      expect(await runtimes[0].did.getDidDocument(accounts0Did))
        .to.deep.eq({ ...document, service });
    });

    it('allows me to fetch a default did document for accounts that have not set a did document yet', async () => {
      const randomIdentity = TestUtils.getRandomAddress();
      const did = await runtimes[0].did.convertIdentityToDid(randomIdentity);

      const expectedDefaultDid = {
        '@context': 'https://w3id.org/did/v1',
        id: did,
        publicKey: [{
          id: `${did}#key-1`,
          type: 'Secp256k1VerificationKey2018',
          owner: did,
          ethereumAddress: randomIdentity,
        }],
        authentication: [`${did}#key-1`],
      };

      const identityDidDoc = await runtimes[0].did.getDidDocument(did);
      expect(identityDidDoc).to.deep.eq(expectedDefaultDid);
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

    it('allows to store a DID document for the identity of an own contract', async () => {
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
      const promise = runtimes[0].did.setDidDocument(twinDid, document);
      await expect(promise).not.to.be.rejected;
    });

    it('can get retrieve an contract identities DID document', async () => {
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
      expect(retrieved).to.deep.eq(document);
    });

    it('allows to get a DID document of another identity', async () => {
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

      const retrieved = await runtimes[1].did.getDidDocument(twinDid);
      expect(retrieved).to.deep.eq(document);
    });

    it('does not allow to store a DID document for the identity of an own contract', async () => {
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
      await expect(promise).to.be.rejectedWith(/^could not estimate gas usage for setDidDocument/);
    });

    it('allows to fetch a default DID document for newly created contract identities', async () => {
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
      const controllerDid = await runtimes[0].did.convertIdentityToDid(runtimes[0].activeIdentity);
      const controllerDidDoc = await runtimes[0].did.getDidDocument(controllerDid);
      const authKeyIds = controllerDidDoc.publicKey.map((key) => key.id).join(',');

      const expectedDefaultDid = {
        '@context': 'https://w3id.org/did/v1',
        id: twinDid,
        controller: controllerDidDoc.id,
        authentication: [
          authKeyIds,
        ],
      };

      const defaultDidDoc = await runtimes[0].did.getDidDocument(twinDid);
      await expect(defaultDidDoc).to.deep.eq(expectedDefaultDid);
    });
  });

  describe('when storing did documents for alias identities', () => {
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
        aliasIdentity, controllerDid, controllerDidDocument.authentication[0],
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
        aliasIdentity, controllerDid, controllerDidDocument.authentication[0],
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
      const document = await runtimes[0].did.getDidDocumentTemplate(
        aliasIdentity, controllerDid, controllerDidDocument.authentication[0],
      );
      await runtimes[0].did.setDidDocument(did, document);

      expect(runtimes[0].did.getDidDocument(did)).to.eventually.deep.eq(document);
    });

    it('can fetch did documents for alias identities that have not set a doc themselves, yet', async () => {
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
