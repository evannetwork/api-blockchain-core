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

describe('DID Resolver', function() {
  this.timeout(600000);
  let runtimes: Runtime[];

  before(async () => {
    runtimes = await Promise.all([
      TestUtils.getRuntime(accounts[0], null, { useIdentity: true }),
      TestUtils.getRuntime(accounts[1], null, { useIdentity: true }),
    ]);
  });

  describe('when storing did documents for account identities', () => {
    it('allows to store a DID document for the own identity (implicitely)', async () => {
      const document = await runtimes[0].didResolver.getDidResolverDocumentTemplate();
      const promise = runtimes[0].didResolver.setDidDocument(document);
      await expect(promise).not.to.be.rejected;
    });

    it('allows to store a DID document for the own identity (explicitely)', async () => {
      const document = await runtimes[0].didResolver.getDidResolverDocumentTemplate();
      const accounts0Identity = await runtimes[0].verifications.getIdentityForAccount(
        accounts[0], true);
      const accounts0Did = await runtimes[0].didResolver.convertIdentityToDid(accounts0Identity);
      const promise = runtimes[0].didResolver.setDidDocument(document, accounts0Did);
      await expect(promise).not.to.be.rejected;
    });

    it('can get retrieve an account identities DID document', async () => {
      const document = await runtimes[0].didResolver.getDidResolverDocumentTemplate();
      await runtimes[0].didResolver.setDidDocument(document);
      const retrieved = await runtimes[0].didResolver.getDidDocument();
      expect(retrieved).to.deep.eq(document);
    });

    it('allows to get a DID document of another identity', async () => {
      const document = await runtimes[0].didResolver.getDidResolverDocumentTemplate();
      await runtimes[0].didResolver.setDidDocument(document);

      const accounts0Identity = await runtimes[0].verifications.getIdentityForAccount(accounts[0], true);
      const accounts0Did = await runtimes[1].didResolver.convertIdentityToDid(accounts0Identity);
      const retrieved = await runtimes[1].didResolver.getDidDocument(accounts0Did);

      expect(retrieved).to.deep.eq(document);
    });

    it('does not allow to store a DID document for another identity', async () => {
      const document = await runtimes[0].didResolver.getDidResolverDocumentTemplate();
      const accounts1Identity = await runtimes[0].verifications.getIdentityForAccount(accounts[1], true);
      const accounts1Did = await runtimes[0].didResolver.convertIdentityToDid(accounts1Identity);
      const promise = runtimes[0].didResolver.setDidDocument(document, accounts1Did);
      await expect(promise).to.be.rejectedWith(/^could not estimate gas usage for setDidDocument/);
    });

    it('allows to define services in a DID document', async () => {
      const document = await runtimes[0].didResolver.getDidResolverDocumentTemplate();
      const accounts0Identity = await runtimes[0].verifications.getIdentityForAccount(
        accounts[0], true);
      const accounts0Did = await runtimes[0].didResolver.convertIdentityToDid(accounts0Identity);
      await runtimes[0].didResolver.setDidDocument(document, accounts0Did);

      // set new service
      const random = Math.floor(Math.random() * 1e9);
      const service = [{
        id: `${accounts0Did}#randomService`,
        type: `randomService-${random}`,
        serviceEndpoint: `https://openid.example.com/${random}`,
      }];
      await runtimes[0].didResolver.setService(service, accounts0Did);

      expect(await runtimes[0].didResolver.getService(accounts0Did))
        .to.deep.eq(service);
      expect(await runtimes[0].didResolver.getDidDocument(accounts0Did))
        .to.deep.eq({ ...document, service });
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
      const accountRuntime = await TestUtils.getRuntime(accounts[0]);
      const twin = await DigitalTwin.create(
        accountRuntime as DigitalTwinOptions,
        {
          accountId: accountRuntime.activeAccount,
          containerConfig: null,
          description: twinDescription,
        },
      );
      const twinIdentity = await runtimes[0].verifications.getIdentityForAccount(
        await twin.getContractAddress(), true);
      const twinDid = await runtimes[0].didResolver.convertIdentityToDid(twinIdentity);

      const controllerDid = await runtimes[0].didResolver.convertIdentityToDid(
        runtimes[0].activeIdentity);
      const controllerDidDocument = await runtimes[0].didResolver.getDidDocument();
      const document = await runtimes[0].didResolver.getDidResolverDocumentTemplate(
        twinDid, controllerDid, controllerDidDocument.authentication[0]);
      const promise = runtimes[0].didResolver.setDidDocument(document, twinDid);
      await expect(promise).not.to.be.rejected;
    });

    it('can get retrieve an contract identities DID document', async () => {
      const accountRuntime = await TestUtils.getRuntime(accounts[0]);
      const twin = await DigitalTwin.create(
        accountRuntime as DigitalTwinOptions,
        {
          accountId: accountRuntime.activeAccount,
          containerConfig: null,
          description: twinDescription,
        },
      );
      const twinIdentity = await runtimes[0].verifications.getIdentityForAccount(
        await twin.getContractAddress(), true);
      const twinDid = await runtimes[0].didResolver.convertIdentityToDid(twinIdentity);

      const controllerDid = await runtimes[0].didResolver.convertIdentityToDid(
        runtimes[0].activeIdentity);
      const controllerDidDocument = await runtimes[0].didResolver.getDidDocument();
      const document = await runtimes[0].didResolver.getDidResolverDocumentTemplate(
        twinDid, controllerDid, controllerDidDocument.authentication[0]);
      await runtimes[0].didResolver.setDidDocument(document, twinDid);
      const retrieved = await runtimes[0].didResolver.getDidDocument(twinDid);
      expect(retrieved).to.deep.eq(document);
    });

    it('allows to get a DID document of another identity', async () => {
      const accountRuntime = await TestUtils.getRuntime(accounts[0]);
      const twin = await DigitalTwin.create(
        accountRuntime as DigitalTwinOptions,
        {
          accountId: accountRuntime.activeAccount,
          containerConfig: null,
          description: twinDescription,
        },
      );
      const twinIdentity = await runtimes[0].verifications.getIdentityForAccount(
        await twin.getContractAddress(), true);
      const twinDid = await runtimes[0].didResolver.convertIdentityToDid(twinIdentity);

      const controllerDid = await runtimes[0].didResolver.convertIdentityToDid(
        runtimes[0].activeIdentity);
      const controllerDidDocument = await runtimes[0].didResolver.getDidDocument();
      const document = await runtimes[0].didResolver.getDidResolverDocumentTemplate(
        twinDid, controllerDid, controllerDidDocument.authentication[0]);
      await runtimes[0].didResolver.setDidDocument(document, twinDid);

      const retrieved = await runtimes[1].didResolver.getDidDocument(twinDid);
      expect(retrieved).to.deep.eq(document);
    });

    it('does not allow to store a DID document for the identity of an own contract', async () => {
      const accountRuntime = await TestUtils.getRuntime(accounts[0]);
      const twin = await DigitalTwin.create(
        accountRuntime as DigitalTwinOptions,
        {
          accountId: accountRuntime.activeAccount,
          containerConfig: null,
          description: twinDescription,
        },
      );
      const twinIdentity = await runtimes[0].verifications.getIdentityForAccount(
        await twin.getContractAddress(), true);
      const twinDid = await runtimes[0].didResolver.convertIdentityToDid(twinIdentity);

      const controllerDid = await runtimes[0].didResolver.convertIdentityToDid(
        runtimes[0].activeIdentity);
      const controllerDidDocument = await runtimes[0].didResolver.getDidDocument();
      const document = await runtimes[0].didResolver.getDidResolverDocumentTemplate(
        twinDid, controllerDid, controllerDidDocument.authentication[0]);
      const runtime1 = runtimes[1];
      const promise = runtime1.didResolver.setDidDocument(document, twinDid);
      await expect(promise).to.be.rejectedWith(/^could not estimate gas usage for setDidDocument/);
    });
  });
});
