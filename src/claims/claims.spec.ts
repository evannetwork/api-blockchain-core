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
import chaiAsPromised = require('chai-as-promised');
import { expect, use } from 'chai';
import { ContractLoader, Executor } from '@evan.network/dbcp';

import { accounts } from '../test/accounts';
import { Claims, ClaimsStatus, } from './claims';
import { TestUtils } from '../test/test-utils';


const linker = require('solc/linker');

use(chaiAsPromised);

describe('Claims handler', function() {
  let claims: Claims;
  let contractLoader: ContractLoader;
  let executor: Executor;
  let nameResolver;
  let web3: any;
  let dfs: any;

  before(async () => {
    web3 = TestUtils.getWeb3();
    executor = await TestUtils.getExecutor(web3);
    contractLoader = await TestUtils.getContractLoader(web3);
    dfs = await TestUtils.getIpfs();
    claims = await TestUtils.getClaims(web3, dfs);
    nameResolver = await TestUtils.getNameResolver(web3);
    await claims.createIdentity(accounts[0]);
    await claims.createIdentity(accounts[1]);
  });

  after(async () => {
    web3.currentProvider.connection.close();
  });

  describe('when creating basic contracts', () => {
    let claimsContracts;

    it('can deploy a new structure', async () => {
      const keyHolderLib = await executor.createContract(
        'KeyHolderLibrary', [], { from: accounts[0], gas: 3000000, });
       contractLoader.contracts['ClaimHolderLibrary'].bytecode = linker.linkBytecode(
       contractLoader.contracts['ClaimHolderLibrary'].bytecode, 
        { 'claims/KeyHolderLibrary.sol:KeyHolderLibrary': keyHolderLib.options.address }
      )
       const claimHolderLib = await executor.createContract(
        'ClaimHolderLibrary', [], { from: accounts[0], gas: 3000000, });
       contractLoader.contracts['OriginIdentity'].bytecode = linker.linkBytecode(
       contractLoader.contracts['OriginIdentity'].bytecode, 
        {
          'claims/ClaimHolderLibrary.sol:ClaimHolderLibrary': claimHolderLib.options.address,
          'claims/KeyHolderLibrary.sol:KeyHolderLibrary': keyHolderLib.options.address,
        },
      )
      console.dir({keyHolderLib: keyHolderLib.options.address, claimHolderLib: claimHolderLib.options.address});
    })

    it('can add a claim', async () => {
      await claims.setClaim(accounts[0], accounts[1], '/company');
      const claimsForAccount = await claims.getClaims('/company', accounts[1]);
      expect(claimsForAccount).to.have.length(1);
      expect(claimsForAccount[0]).to.have.property('status', ClaimsStatus.Issued);
    });

    it('can add a claim with specific data', async () => {
      await claims.setClaim(accounts[0], accounts[1], '/company', null, {foo: 'bar'});
      const claimsForAccount = await claims.getClaims('/company', accounts[1]);
      expect(claimsForAccount).to.have.length(1);
      expect(claimsForAccount[0]).to.have.property('uri', 'https://ipfs.evan.network/ipfs/Qmbjig3cZbUUufWqCEFzyCppqdnmQj3RoDjJWomnqYGy1f');
    });

    it('can add a claim with specific expirationDate', async () => {
      const now = Math.floor(new Date().getTime() / 1000);
      await claims.setClaim(accounts[0], accounts[1], '/company', now);
      const claimsForAccount = await claims.getClaims('/company', accounts[1]);
      expect(claimsForAccount).to.have.length(1);
      expect(claimsForAccount[0]).to.have.property('expirationDate', now.toString());
    });

    it('can add a claim with specific description', async () => {
      const claimName = '/company';
      const descriptionDomain = 'sample';
      const ensFullNodeHash = nameResolver.soliditySha3(
        nameResolver.namehash(`${descriptionDomain}.claims.evan`),
        nameResolver.soliditySha3(claimName),
      );

      await claims.setClaim(accounts[0], accounts[1], claimName, null, null, descriptionDomain);
      const claimsForAccount = await claims.getClaims(claimName, accounts[1]);

      expect(claimsForAccount).to.have.length(1);
      expect(claimsForAccount[0]).to.have.property('description', ensFullNodeHash);
    });

    it('can add a claim and validate the integrity', async () => {
      await claims.setClaim(accounts[0], accounts[1], '/company');
      const claimsForAccount = await claims.getClaims('/company', accounts[1]);
      expect(claimsForAccount).to.have.length(1);
      await claims.validateClaim(claimsForAccount[0].id, accounts[1]);
      expect(claimsForAccount[0]).to.have.property('status', ClaimsStatus.Issued);
    });

    it('can add subclaim paths and validate it', async () => {
      await claims.setClaim(accounts[0], accounts[0], '/company');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
      await claims.setClaim(accounts[0], accounts[1], '/company/b-s-s/employee/swo');
      const identity = await claims.getIdentityForAccount(accounts[1]);
      const claimTree = await claims.validateClaimTree('/company/b-s-s/employee/swo', identity.options.address);
      expect(claimTree).to.have.length(4);
    });

    it('can add subclaim paths and don\'t have the needed root claims.', async () => {
      await claims.setClaim(accounts[0], accounts[0], '/company/evan/employee');
      await claims.setClaim(accounts[0], accounts[1], '/company/evan/employee/swo');
      const identity = await claims.getIdentityForAccount(accounts[1]);
      const claimTree = await claims.validateClaimTree('/company/evan/employee/swo', identity.options.address);
      expect(claimTree).to.have.length(2);
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

    it('can update a claim and the status should be not confirmed', async () => {
      await claims.setClaim(accounts[0], accounts[1], '/company/b-s-s/employee/swo');
      await claims.confirmClaim(accounts[1], '/company/b-s-s/employee/swo', accounts[0]);
      const claimsForAccount = await claims.getClaims('/company/b-s-s/employee/swo', accounts[1]);
      expect(claimsForAccount).to.have.length(1);
      expect(claimsForAccount[0]).to.have.property('status', ClaimsStatus.Confirmed);
      await claims.setClaim(
        accounts[0], accounts[1], '/company/b-s-s/employee/swo', null, { test: 'test' });
      const claimsForAccount2 = await claims.getClaims('/company/b-s-s/employee/swo', accounts[1]);
      expect(claimsForAccount2).to.have.length(1);
      expect(claimsForAccount2[0]).to.have.property('status', ClaimsStatus.Issued);
    });

    it('can reject a subclaim paths with the subject user', async () => {
      await claims.setClaim(accounts[0], accounts[0], '/company');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
      await claims.setClaim(accounts[0], accounts[1], '/company/b-s-s/employee/swo');
      await claims.deleteClaim(accounts[1], '/company/b-s-s/employee/swo', accounts[0]);
      const claimsForAccount = await claims.getClaims('/company/b-s-s/employee/swo', accounts[1]);
      expect(claimsForAccount).to.have.length(0);
    });

    it('can track the creation date', async() => {
      const before = Date.now() / 1000;
      await claims.setClaim(accounts[0], accounts[1], '/company');
      const after = Date.now() / 1000;
      const claimsForAccount = await claims.getClaims('/company', accounts[1]);
      const last = claimsForAccount.length - 1;
      expect(claimsForAccount[last]).to.have.property('status', ClaimsStatus.Issued);
      expect(claimsForAccount[last]).to.have.property('creationDate');
      expect(parseInt(claimsForAccount[last].creationDate, 10)).to.be.gte(before);
      expect(parseInt(claimsForAccount[last].creationDate, 10)).to.be.lte(after);
    });

    it('can track the creation block', async() => {
      const before = await web3.eth.getBlockNumber();
      await claims.setClaim(accounts[0], accounts[1], '/company');
      const after = await web3.eth.getBlockNumber();
      const claimsForAccount = await claims.getClaims('/company', accounts[1]);
      const last = claimsForAccount.length - 1;
      expect(claimsForAccount[last]).to.have.property('status', ClaimsStatus.Issued);
      expect(claimsForAccount[last]).to.have.property('creationBlock');
      expect(parseInt(claimsForAccount[last].creationBlock, 10)).to.be.gte(before);
      expect(parseInt(claimsForAccount[last].creationBlock, 10)).to.be.lte(after);
    });
  });
});
