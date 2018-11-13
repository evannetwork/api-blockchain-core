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

  You can be released from the requirements of the GNU Affero General Public
  License by purchasing a commercial license.
  Buying such a license is mandatory as soon as you use this software or parts
  of it on other blockchains than evan.network.

  For more information, please contact evan GmbH at this address:
  https://evan.network/license/
*/

import 'mocha';
import { expect, use } from 'chai';
import chaiAsPromised = require('chai-as-promised');

import {
  ContractLoader,
  Executor,
} from '@evan.network/dbcp';

import { accounts } from '../test/accounts';
import { Claims, ClaimsStatus, } from './claims';
import { TestUtils } from '../test/test-utils';

use(chaiAsPromised);


describe('Claims handler', function() {
  let claims: Claims;
  let contractLoader: ContractLoader;
  let executor: Executor;
  let web3: any;

  before(async () => {
    web3 = TestUtils.getWeb3();
    executor = await TestUtils.getExecutor(web3);
    contractLoader = await TestUtils.getContractLoader(web3);
    claims = await TestUtils.getClaims(web3);
    await claims.createStructure(accounts[0]);
    console.dir(claims);
    process.exit();
    await claims.createIdentity(accounts[0]);
    await claims.createIdentity(accounts[1]);
  });

  after(async () => {
    web3.currentProvider.connection.close();
  });

  describe('when creating basic contracts', () => {
    let claimsContracts;

    it.only('can add a claim', async () => {
      await claims.setClaim(accounts[0], accounts[1], '/company');
      const claimsForAccount = await claims.getClaims('/company', accounts[1]);
      expect(claimsForAccount).to.have.length(1);
      expect(claimsForAccount[0]).to.have.property('status', ClaimsStatus.Issued);
    });

    it('can add subclaim paths', async () => {
      await claims.setClaim(accounts[0], accounts[0], '/company');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
      await claims.setClaim(accounts[0], accounts[1], '/company/b-s-s/employee/swo');
      const claimsForAccount = await claims.getClaims('/company/b-s-s/employee/swo', accounts[1]);
      expect(claimsForAccount).to.have.length(1);
      expect(claimsForAccount[0]).to.have.property('status', ClaimsStatus.Issued);
    });

    it('can confirm a subclaim paths with the subject user', async () => {
      await claims.setClaim(accounts[0], accounts[0], '/company');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
      await claims.setClaim(accounts[0], accounts[1], '/company/b-s-s/employee/swo');
      await claims.confirmClaim(accounts[1], '/company/b-s-s/employee/swo', accounts[0]);
      const claimsForAccount = await claims.getClaims('/company/b-s-s/employee/swo', accounts[1]);
      expect(claimsForAccount).to.have.length(1);
      expect(claimsForAccount[0]).to.have.property('status', ClaimsStatus.Confirmed);
    });

    it('cannot confirm a subclaim paths with a non-subject user', async () => {
      await claims.setClaim(accounts[0], accounts[0], '/company');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
      await claims.setClaim(accounts[0], accounts[1], '/company/b-s-s/employee/swo');
      const promise = claims.confirmClaim(accounts[0], '/company/b-s-s/employee/swo', accounts[1]);
      await expect(promise).to.be.rejected;
    });

    it('can reject a subclaim paths with the subject user', async () => {
      await claims.setClaim(accounts[0], accounts[0], '/company');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
      await claims.setClaim(accounts[0], accounts[1], '/company/b-s-s/employee/swo');
      await claims.deleteClaim(accounts[1], '/company/b-s-s/employee/swo', accounts[0]);
      const claimsForAccount = await claims.getClaims('/company/b-s-s/employee/swo', accounts[1]);
      console.dir(claimsForAccount);
      expect(claimsForAccount).to.have.length(0);
    });
  });
});
