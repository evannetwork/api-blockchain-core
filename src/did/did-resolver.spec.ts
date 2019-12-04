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

import { promisify } from 'util';
import { readFile } from 'fs';

import 'mocha';
import * as chaiAsPromised from 'chai-as-promised';
import { expect, use } from 'chai';
import {
  Executor,
  Ipfs,
} from '@evan.network/dbcp';

import { accounts } from '../test/accounts';
import { TestUtils } from '../test/test-utils';
import {
  DidResolver,
  Verifications,
} from '../index';

use(chaiAsPromised);


describe('DID Resolver', function() {
  this.timeout(600000);
  let didResolver: DidResolver;
  let verifications: Verifications;
  let web3: any;

  before(async () => {
    web3 = TestUtils.getWeb3();
    didResolver = await TestUtils.getDidResolver(web3);
    verifications = await TestUtils.getVerifications(web3);
  });

  describe('when storing did documents for account identities', () => {
    it('allows to store a DID document for the own identity (implicitely)', async () => {
      const document = await didResolver.getDidDocumentTemplate();
      const promise = didResolver.setDidDocument(document);
      await expect(promise).not.to.be.rejected;
    });

    it('allows to store a DID document for the own identity (explicitely)', async () => {
      const document = await didResolver.getDidDocumentTemplate();
      const accounts0Identity = await verifications.getIdentityForAccount(accounts[0], true);
      const accounts0Did = await didResolver.convertIdentityToDid(accounts0Identity);
      const promise = didResolver.setDidDocument(document, accounts0Did);
      await expect(promise).not.to.be.rejected;
    });

    it('can get retrieve an account identities DID document', async () => {
      const document = await didResolver.getDidDocumentTemplate();
      await didResolver.setDidDocument(document);
      const retrieved = await didResolver.getDidDocument();
      expect(retrieved).to.deep.eq(document);
    });

    it('allows to get a DID document of another identity', async () => {
      const document = await didResolver.getDidDocumentTemplate();
      await didResolver.setDidDocument(document);

      const otherResolver = await TestUtils.getDidResolver(web3, accounts[1]);
      const accounts0Identity = await verifications.getIdentityForAccount(accounts[0], true);
      const accounts0Did = await otherResolver.convertIdentityToDid(accounts0Identity);
      const retrieved = await otherResolver.getDidDocument(accounts0Did);

      expect(retrieved).to.deep.eq(document);
    });

    it('does not allow to store a DID document for another identity', async () => {
      const document = await didResolver.getDidDocumentTemplate();
      const accounts1Identity = await verifications.getIdentityForAccount(accounts[1], true);
      const accounts1Did = await didResolver.convertIdentityToDid(accounts1Identity);
      const promise = didResolver.setDidDocument(document, accounts1Did);
      await expect(promise).to.be.rejectedWith(/^could not estimate gas usage for setDidDocument/);
    });
  });

  describe('when storing did documents for contract identities', () => {
    it.skip('allows to store a DID document for the identity of an own contract', async () => {});
    it.skip('can get retrieve an account identities DID document', async () => {});
    it.skip('does not allow to store a DID document for another users contracts identity', async () => {});
  });
});
