/*
  Copyright (C) 2018-present evan GmbH.

  This program is free software: you can redistribute it and/or modify it
  under the terms of the GNU Affero General Public License, version 3,
  as published by the Free Software Foundation.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
  See the GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License along with this program.
  If not, see http://www.gnu.org/licenses/ or write to the

  Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA, 02110-1301 USA,

  or download the license from the following URL: https://evan.network/license/

  You can be released from the requirements of the GNU Affero General Public License
  by purchasing a commercial license.
  Buying such a license is mandatory as soon as you use this software or parts of it
  on other blockchains than evan.network.

  For more information, please contact evan GmbH at this address: https://evan.network/license/
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
    // claims.loadContracts(
    //   '0xb09AD99908725A453508979D5007A958aB0C9EB3', '0xCc21A067D2bAEfD485ED063134F63EEF2C76d39f');
    await claims.createStructure(accounts[0]);
  });

  after(async () => {
    web3.currentProvider.connection.close();
  });

  describe('when creating basic contracts', () => {
    let claimsContracts;

    it('can add a claim', async () => {
      await claims.setClaim(accounts[0], accounts[1], '/company');
      expect(await claims.getClaim('/company')).to.have.property('status', ClaimsStatus.Issued);
    });

    it('cannot add a claim, if parent node isn\'t owned by issuer', async () => {
      const promise = claims.setClaim(accounts[1], accounts[0], '/company');
      await expect(promise).to.be.rejected;
    });

    it('can add subclaim paths', async () => {
      await claims.setClaim(accounts[0], accounts[0], '/company');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
      await claims.setClaim(accounts[0], accounts[1], '/company/b-s-s/employee/swo');
      expect(await claims.getClaim('/company/b-s-s/employee/swo')).to.have.property('status', ClaimsStatus.Issued);
    });

    it('cannot add subclaim, when a node is not owned by issuer', async () => {
      await claims.setClaim(accounts[0], accounts[0], '/company');
      await claims.setClaim(accounts[0], accounts[1], '/company/b-s-s');
      const promise = claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
      await expect(promise).to.be.rejected;
    });

    it('can confirm a subclaim paths with the subject user', async () => {
      await claims.setClaim(accounts[0], accounts[0], '/company');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
      await claims.setClaim(accounts[0], accounts[1], '/company/b-s-s/employee/swo');
      await claims.confirmClaim(accounts[1], '/company/b-s-s/employee/swo');
      expect(await claims.getClaim('/company/b-s-s/employee/swo')).to.have.property('status', ClaimsStatus.Confirmed);
    });

    it('cannot confirm a subclaim paths with a non-subject user', async () => {
      await claims.setClaim(accounts[0], accounts[0], '/company');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
      await claims.setClaim(accounts[0], accounts[1], '/company/b-s-s/employee/swo');
      const promise = claims.confirmClaim(accounts[0], '/company/b-s-s/employee/swo');
      await expect(promise).to.be.rejected;
    });

    it('can reject a subclaim paths with the subject user', async () => {
      await claims.setClaim(accounts[0], accounts[0], '/company');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
      await claims.setClaim(accounts[0], accounts[1], '/company/b-s-s/employee/swo');
      await claims.rejectClaim(accounts[1], '/company/b-s-s/employee/swo');
      expect(await claims.getClaim('/company/b-s-s/employee/swo')).to.have.property('status', ClaimsStatus.Rejected);
    });

    it('cannot reject a subclaim paths with non-subject user', async () => {
      await claims.setClaim(accounts[0], accounts[0], '/company');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
      await claims.setClaim(accounts[0], accounts[1], '/company/b-s-s/employee/swo');
      const promise = claims.rejectClaim(accounts[0], '/company/b-s-s/employee/swo');
      await expect(promise).to.be.rejected;
    });

    it('rejects using a different resolver than registered', async () => {
      // ensure claim (with default resolver) has been issued
      await claims.setClaim(accounts[0], accounts[0], '/company');
      // try to use an unregistered resolver
      const unregisteredResolver = await executor.createContract(
        'ClaimsPublicResolver',
        [ claims.contracts.registry.options.address ],
        { from: accounts[0], gas: 2000000, }
      );
      let promise = executor.executeContractTransaction(
        claims.contracts.registry,
        'setResolver',
        { from: accounts[0], },
        claims.options.nameResolver.namehash('company'),
        unregisteredResolver.options.address,
      );
      await expect(promise).to.be.rejected;
      // check, that we can use a proper resolver
      promise = executor.executeContractTransaction(
        claims.contracts.registry,
        'setResolver',
        { from: accounts[0], },
        claims.options.nameResolver.namehash('company'),
        claims.contracts.resolver.options.address,
      );
      await expect(promise).to.be.fulfilled;
    });

    it('allows to delete a certificate', async() => {
      await claims.setClaim(accounts[0], accounts[0], '/company');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
      await claims.setClaim(accounts[0], accounts[1], '/company/b-s-s/employee/swo');
      await claims.deleteClaim(accounts[0], '/company/b-s-s/employee/swo');
      expect(await claims.getClaim('/company/b-s-s/employee/swo')).to.have.property('status', ClaimsStatus.None);
    });
  });
});
