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
import { BaseContract } from '../contracts/base-contract/base-contract';
import { Claims, ClaimsStatus, } from './claims';
import { config } from '../config';
import { Description } from '../shared-description';
import { TestUtils } from '../test/test-utils';


const linker = require('solc/linker');

use(chaiAsPromised);

describe('Claims handler', function() {
  let baseContract: BaseContract;
  let claims: Claims;
  let claimsContracts;
  let contractLoader: ContractLoader;
  let description: Description;
  let dfs: any;
  let executor: Executor;
  let nameResolver;
  let web3: any;

  before(async () => {
    web3 = TestUtils.getWeb3();
    console.log(web3.version)
    executor = await TestUtils.getExecutor(web3);
    contractLoader = await TestUtils.getContractLoader(web3);
    dfs = await TestUtils.getIpfs();
    claims = await TestUtils.getClaims(web3, dfs);
    nameResolver = await TestUtils.getNameResolver(web3);
    baseContract = await TestUtils.getBaseContract(web3);
    description = await TestUtils.getDescription(web3, dfs);
    await claims.createIdentity(accounts[0]);
    await claims.createIdentity(accounts[1]);
  });

  after(async () => {
    web3.currentProvider.connection.close();
  });

  // // // can be used for creating new libraries, but disabled by default
  // it('can deploy a new structure', async () => {
  //   const claimsRegistryLib = await executor.createContract(
  //     'ClaimsRegistryLibrary', [], { from: accounts[0], gas: 3000000, });
  //   contractLoader.contracts['ClaimsRegistry'].bytecode = linker.linkBytecode(
  //     contractLoader.contracts['ClaimsRegistry'].bytecode,
  //     { 'claims/ClaimsRegistryLibrary.sol:ClaimsRegistryLibrary': claimsRegistryLib.options.address }
  //   );

  //   const keyHolderLib = await executor.createContract(
  //     'KeyHolderLibrary', [], { from: accounts[0], gas: 3000000, });
  //   contractLoader.contracts['ClaimHolderLibrary'].bytecode = linker.linkBytecode(
  //     contractLoader.contracts['ClaimHolderLibrary'].bytecode,
  //     { 'claims/KeyHolderLibrary.sol:KeyHolderLibrary': keyHolderLib.options.address }
  //   );

  //   const claimHolderLib = await executor.createContract(
  //     'ClaimHolderLibrary', [], { from: accounts[0], gas: 3000000, });
  //   contractLoader.contracts['OriginIdentity'].bytecode = linker.linkBytecode(
  //     contractLoader.contracts['OriginIdentity'].bytecode,
  //     {
  //       'claims/ClaimHolderLibrary.sol:ClaimHolderLibrary': claimHolderLib.options.address,
  //       'claims/KeyHolderLibrary.sol:KeyHolderLibrary': keyHolderLib.options.address,
  //     },
  //   )
  //   console.dir({
  //     keyHolderLib: keyHolderLib.options.address,
  //     claimHolderLib: claimHolderLib.options.address,
  //     claimsRegistryLib: claimsRegistryLib.options.address,
  //   });
  //   process.exit();
  // });

  describe('when using external account based identities', () => {
    it('can add a claim', async () => {
      const oldLength = (await claims.getClaims(accounts[1], '/company')).length;
      const claimId = await claims.setClaim(accounts[0], accounts[1], '/company');
      expect(claimId).to.be.ok;
      const claimsForAccount = await claims.getClaims(accounts[1], '/company');
      expect(claimsForAccount).to.have.lengthOf(oldLength + 1);
      expect(claimsForAccount[oldLength]).to.have.property('status', ClaimsStatus.Issued);
    });

    it('can add a claim with specific data', async () => {
      const oldLength = (await claims.getClaims(accounts[1], '/company')).length;
      await claims.setClaim(accounts[0], accounts[1], '/company', null, {foo: 'bar'});
      const claimsForAccount = await claims.getClaims(accounts[1], '/company');
      expect(claimsForAccount).to.have.lengthOf(oldLength + 1);
      expect(claimsForAccount[oldLength]).to.have.property('uri', 'https://ipfs.evan.network/ipfs/Qmbjig3cZbUUufWqCEFzyCppqdnmQj3RoDjJWomnqYGy1f');
    });

    it('can add a claim with specific expirationDate', async () => {
      const oldLength = (await claims.getClaims(accounts[1], '/company')).length;
      const now = Math.floor(new Date().getTime() / 1000);
      await claims.setClaim(accounts[0], accounts[1], '/company', now);
      const claimsForAccount = await claims.getClaims(accounts[1], '/company');
      expect(claimsForAccount).to.have.lengthOf(oldLength + 1);
      expect(claimsForAccount[oldLength]).to.have.property('expirationDate', now.toString());
    });

    it('can add a claim and validate the integrity', async () => {
      const oldLength = (await claims.getClaims(accounts[1], '/company')).length;
      await claims.setClaim(accounts[0], accounts[1], '/company');
      const claimsForAccount = await claims.getClaims(accounts[1], '/company');
      expect(claimsForAccount).to.have.lengthOf(oldLength + 1);
      await claims.validateClaim(accounts[1], claimsForAccount[oldLength].id);
      expect(claimsForAccount[oldLength]).to.have.property('status', ClaimsStatus.Issued);
    });

    it('can add subclaim paths and validate it', async () => {
      const oldLength = (await claims.getClaims(accounts[1], '/company')).length;
      await claims.setClaim(accounts[0], accounts[0], '/company');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
      await claims.setClaim(accounts[0], accounts[1], '/company/b-s-s/employee/swo');
      const identity = await claims.getIdentityForAccount(accounts[1]);
      const claimTree = await claims.validateClaimTree(identity.options.address, '/company/b-s-s/employee/swo');
      expect(claimTree).to.have.lengthOf(4);
    });

    it('can add subclaim paths and don\'t have the needed root claims.', async () => {
      const oldLength = (await claims.getClaims(accounts[1], '/company')).length;
      await claims.setClaim(accounts[0], accounts[0], '/company/evan/employee');
      await claims.setClaim(accounts[0], accounts[1], '/company/evan/employee/swo2');
      const identity = await claims.getIdentityForAccount(accounts[1]);
      const claimTree = await claims.validateClaimTree(identity.options.address, '/company/evan/employee/swo2');
      expect(claimTree).to.have.lengthOf(2);
    });

    it('can add subclaim paths', async () => {
      const oldLength = (await claims.getClaims(accounts[1], '/company/b-s-s/employee/swo3')).length;
      await claims.setClaim(accounts[0], accounts[0], '/company');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
      await claims.setClaim(accounts[0], accounts[1], '/company/b-s-s/employee/swo3');
      const claimsForAccount = await claims.getClaims(accounts[1], '/company/b-s-s/employee/swo3');
      expect(claimsForAccount).to.have.lengthOf(1);
      expect(claimsForAccount[oldLength]).to.have.property('status', ClaimsStatus.Issued);
    });

    it('can confirm a subclaim paths with the subject user', async () => {
      const oldLength = (await claims.getClaims(accounts[1], '/company/b-s-s/employee/swo4')).length;
      await claims.setClaim(accounts[0], accounts[0], '/company');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
      const claimId = await claims.setClaim(accounts[0], accounts[1], '/company/b-s-s/employee/swo4');
      await claims.confirmClaim(accounts[1], accounts[1], claimId);
      const claimsForAccount = await claims.getClaims(accounts[1], '/company/b-s-s/employee/swo4');
      expect(claimsForAccount).to.have.lengthOf(oldLength + 1);
      expect(claimsForAccount[oldLength]).to.have.property('status', ClaimsStatus.Confirmed);
    });

    it('can reject a subclaim paths with the subject user', async () => {
      await claims.setClaim(accounts[0], accounts[0], '/company');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
      const claimId = await claims.setClaim(accounts[0], accounts[1], '/company/b-s-s/employee/swo6');
      await claims.deleteClaim(accounts[1], accounts[1], claimId);
      const claimsForAccount = await claims.getClaims(accounts[1], '/company/b-s-s/employee/swo6');
      expect(claimsForAccount).to.have.lengthOf(0);
    });

    it('can track the creation date', async() => {
      const before = Date.now() / 1000;
      await claims.setClaim(accounts[0], accounts[1], '/company');
      const after = Date.now() / 1000;
      const claimsForAccount = await claims.getClaims(accounts[1], '/company');
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
      const claimsForAccount = await claims.getClaims(accounts[1], '/company');
      const last = claimsForAccount.length - 1;
      expect(claimsForAccount[last]).to.have.property('status', ClaimsStatus.Issued);
      expect(claimsForAccount[last]).to.have.property('creationBlock');
      expect(parseInt(claimsForAccount[last].creationBlock, 10)).to.be.gte(before);
      expect(parseInt(claimsForAccount[last].creationBlock, 10)).to.be.lte(after);
    });

    it('can add a description to a claim', async() => {
      const sampleClaimsDomain = 'sample';
      const sampleClaimTopic = '/company';
      const sampleDescription = {
        name: 'sample claim',
        description: 'I\'m a sample claim',
        author: 'evan.network',
        version: '1.0.0',
        dbcpVersion: 1,
      };
      await claims.setClaimDescription(accounts[0], sampleClaimTopic, sampleClaimsDomain, sampleDescription);
      await claims.setClaim(accounts[0], accounts[1], sampleClaimTopic, null, null, sampleClaimsDomain);
      const claimsForAccount = await claims.getClaims(accounts[1], sampleClaimTopic);
      const last = claimsForAccount.length - 1;
      expect(claimsForAccount[last]).to.have.property('status', ClaimsStatus.Issued);
      expect(claimsForAccount[last]).to.have.property('creationBlock');
      expect(claimsForAccount[last].description).to.deep.eq(sampleDescription);
    });

    it('can reject a claim', async () => {
      const oldLength = (await claims.getClaims(accounts[1], '/company/b-s-s/employee/swo4')).length;
      await claims.setClaim(accounts[0], accounts[0], '/company');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
      const claimId = await claims.setClaim(accounts[0], accounts[1], '/company/b-s-s/employee/swo4');
      await claims.rejectClaim(accounts[1], accounts[1], claimId);
      const claimsForAccount = await claims.getClaims(accounts[1], '/company/b-s-s/employee/swo4');
      expect(claimsForAccount).to.have.lengthOf(oldLength + 1);
      expect(claimsForAccount[oldLength]).to.have.property('status', ClaimsStatus.Rejected);
    });

    it('can reject a claim with a reason', async () => {
      const oldLength = (await claims.getClaims(accounts[1], '/company/b-s-s/employee/swo4')).length;
      await claims.setClaim(accounts[0], accounts[0], '/company');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
      const claimId = await claims.setClaim(accounts[0], accounts[1], '/company/b-s-s/employee/swo4');
      await claims.rejectClaim(accounts[1], accounts[1], claimId, { reason: 'denied' });
      const claimsForAccount = await claims.getClaims(accounts[1], '/company/b-s-s/employee/swo4');
      expect(claimsForAccount).to.have.lengthOf(oldLength + 1);
      expect(claimsForAccount[oldLength]).to.have.property('status', ClaimsStatus.Rejected);
      expect(claimsForAccount[oldLength]).to.have.deep.property('rejectReason', { reason: 'denied' });
    });

    it('can reject a claim with a reason from the issuer side', async () => {
      const oldLength = (await claims.getClaims(accounts[1], '/company/b-s-s/employee/swo4')).length;
      await claims.setClaim(accounts[0], accounts[0], '/company');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
      const claimId = await claims.setClaim(accounts[0], accounts[1], '/company/b-s-s/employee/swo4');
      await claims.rejectClaim(accounts[0], accounts[1], claimId, { reason: 'denied' });
      const claimsForAccount = await claims.getClaims(accounts[1], '/company/b-s-s/employee/swo4');
      expect(claimsForAccount).to.have.lengthOf(oldLength + 1);
      expect(claimsForAccount[oldLength]).to.have.property('status', ClaimsStatus.Rejected);
      expect(claimsForAccount[oldLength]).to.have.deep.property('rejectReason', { reason: 'denied' });
    });

    it('can not re accept a rejected claim', async () => {
      const oldLength = (await claims.getClaims(accounts[1], '/company/b-s-s/employee/swo4')).length;
      await claims.setClaim(accounts[0], accounts[0], '/company');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
      const claimId = await claims.setClaim(accounts[0], accounts[1], '/company/b-s-s/employee/swo4');
      await claims.rejectClaim(accounts[1], accounts[1], claimId);
      const reacceptedP = claims.confirmClaim(accounts[1], accounts[1], claimId);
      await expect(reacceptedP).to.be.rejected;
    });
  });

  describe('when using identities for contracts', () => {
    let claimsRegistry;
    let contractId;

    before(async () => {
      claimsRegistry = await executor.createContract(
        'ClaimsRegistry', [], { from: accounts[2], gas: 8000000 });
      claims.contracts.registry = claimsRegistry;
    });

    it('can create a new identity for a contract', async() => {
      const businessCenterDomain = nameResolver.getDomainName(config.nameResolver.domains.businessCenter);
      contractId = await baseContract.createUninitialized(
        'testdatacontract',
        accounts[0],
        businessCenterDomain,
      );
      await description.setDescriptionToContract(
        contractId,
        {
          public: {
            name: 'sample claim',
            description: 'I\'m a sample claim',
            author: 'evan.network',
            version: '1.0.0',
            dbcpVersion: 1,
          },
        },
        accounts[0],
      );
      const identity = await claims.createIdentity(accounts[0], contractId);
      expect(identity).to.match(/0x[0-9-a-f]{64}/i);
    });

    it('can add a claim', async () => {
      const oldLength = (await claims.getClaims(contractId, '/company')).length;
      await claims.setClaim(accounts[0], contractId, '/company');
      const claimsForAccount = await claims.getClaims(contractId, '/company');
      expect(claimsForAccount).to.have.lengthOf(oldLength + 1);
      expect(claimsForAccount[oldLength]).to.have.property('status', ClaimsStatus.Issued);
    });

    it('can add a claim with specific data', async () => {
      const oldLength = (await claims.getClaims(contractId, '/company')).length;
      await claims.setClaim(accounts[0], contractId, '/company', null, {foo: 'bar'});
      const claimsForAccount = await claims.getClaims(contractId, '/company');
      expect(claimsForAccount).to.have.lengthOf(oldLength + 1);
      expect(claimsForAccount[oldLength]).to.have.property('uri', 'https://ipfs.evan.network/ipfs/Qmbjig3cZbUUufWqCEFzyCppqdnmQj3RoDjJWomnqYGy1f');
    });

    it('can add a claim with specific expirationDate', async () => {
      const oldLength = (await claims.getClaims(contractId, '/company')).length;
      const now = Math.floor(new Date().getTime() / 1000);
      await claims.setClaim(accounts[0], contractId, '/company', now);
      const claimsForAccount = await claims.getClaims(contractId, '/company');
      expect(claimsForAccount).to.have.lengthOf(oldLength + 1);
      expect(claimsForAccount[oldLength]).to.have.property('expirationDate', now.toString());
    });

    it('can add a claim and validate the integrity', async () => {
      const oldLength = (await claims.getClaims(contractId, '/company')).length;
      await claims.setClaim(accounts[0], contractId, '/company');
      const claimsForAccount = await claims.getClaims(contractId, '/company');
      expect(claimsForAccount).to.have.lengthOf(oldLength + 1);
      await claims.validateClaim(contractId, claimsForAccount[oldLength].id);
      expect(claimsForAccount[oldLength]).to.have.property('status', ClaimsStatus.Issued);
    });

    it('can add subclaim paths and validate it', async () => {
      const oldLength = (await claims.getClaims(contractId, '/company')).length;
      await claims.setClaim(accounts[0], accounts[0], '/company');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
      await claims.setClaim(accounts[0], contractId, '/company/b-s-s/employee/swo');
      const identity = await claims.getIdentityForAccount(contractId);
      const claimTree = await claims.validateClaimTree(identity, '/company/b-s-s/employee/swo');
      expect(claimTree).to.have.lengthOf(4);
    });

    it('can add subclaim paths and don\'t have the needed root claims.', async () => {
      const oldLength = (await claims.getClaims(contractId, '/company')).length;
      await claims.setClaim(accounts[0], accounts[0], '/company/evan/employee');
      await claims.setClaim(accounts[0], contractId, '/company/evan/employee/swo2');
      const identity = await claims.getIdentityForAccount(contractId);
      const claimTree = await claims.validateClaimTree(identity, '/company/evan/employee/swo2');
      expect(claimTree).to.have.lengthOf(2);
    });

    it('can add subclaim paths', async () => {
      const oldLength = (await claims.getClaims(contractId, '/company/b-s-s/employee/swo3')).length;
      await claims.setClaim(accounts[0], accounts[0], '/company');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
      await claims.setClaim(accounts[0], contractId, '/company/b-s-s/employee/swo3');
      const claimsForAccount = await claims.getClaims(contractId, '/company/b-s-s/employee/swo3');
      expect(claimsForAccount).to.have.lengthOf(1);
      expect(claimsForAccount[oldLength]).to.have.property('status', ClaimsStatus.Issued);
    });

    it('can confirm a subclaim paths with the subject user', async () => {
      const oldLength = (await claims.getClaims(contractId, '/company/b-s-s/employee/swo4')).length;
      await claims.setClaim(accounts[0], accounts[0], '/company');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
      const claimId = await claims.setClaim(accounts[0], contractId, '/company/b-s-s/employee/swo4');
      await claims.confirmClaim(accounts[0], contractId, claimId);
      const claimsForAccount = await claims.getClaims(contractId, '/company/b-s-s/employee/swo4');
      expect(claimsForAccount).to.have.lengthOf(oldLength + 1);
      expect(claimsForAccount[oldLength]).to.have.property('status', ClaimsStatus.Confirmed);
    });

    it('can reject a subclaim paths with the subject user', async () => {
      await claims.setClaim(accounts[0], accounts[0], '/company');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
      const claimId = await claims.setClaim(accounts[0], contractId, '/company/b-s-s/employee/swo6');
      await claims.deleteClaim(accounts[0], contractId, claimId);
      const claimsForAccount = await claims.getClaims(contractId, '/company/b-s-s/employee/swo6');
      expect(claimsForAccount).to.have.lengthOf(0);
    });

    it('can track the creation date', async() => {
      const before = Date.now() / 1000;
      await claims.setClaim(accounts[0], contractId, '/company');
      const after = Date.now() / 1000;
      const claimsForAccount = await claims.getClaims(contractId, '/company');
      const last = claimsForAccount.length - 1;
      expect(claimsForAccount[last]).to.have.property('status', ClaimsStatus.Issued);
      expect(claimsForAccount[last]).to.have.property('creationDate');
      expect(parseInt(claimsForAccount[last].creationDate, 10)).to.be.gte(before);
      expect(parseInt(claimsForAccount[last].creationDate, 10)).to.be.lte(after);
    });

    it('can track the creation block', async() => {
      const before = await web3.eth.getBlockNumber();
      await claims.setClaim(accounts[0], contractId, '/company');
      const after = await web3.eth.getBlockNumber();
      const claimsForAccount = await claims.getClaims(contractId, '/company');
      const last = claimsForAccount.length - 1;
      expect(claimsForAccount[last]).to.have.property('status', ClaimsStatus.Issued);
      expect(claimsForAccount[last]).to.have.property('creationBlock');
      expect(parseInt(claimsForAccount[last].creationBlock, 10)).to.be.gte(before);
      expect(parseInt(claimsForAccount[last].creationBlock, 10)).to.be.lte(after);
    });

    it('can add a description to a claim', async() => {
      const sampleClaimsDomain = 'sample';
      const sampleClaimTopic = '/company';
      const sampleDescription = {
        name: 'sample claim',
        description: 'I\'m a sample claim',
        author: 'evan.network',
        version: '1.0.0',
        dbcpVersion: 1,
      };
      await claims.setClaimDescription(accounts[0], sampleClaimTopic, sampleClaimsDomain, sampleDescription);
      await claims.setClaim(accounts[0], contractId, sampleClaimTopic, null, null, sampleClaimsDomain);
      const claimsForAccount = await claims.getClaims(contractId, sampleClaimTopic);
      const last = claimsForAccount.length - 1;
      expect(claimsForAccount[last]).to.have.property('status', ClaimsStatus.Issued);
      expect(claimsForAccount[last]).to.have.property('creationBlock');
      expect(claimsForAccount[last].description).to.deep.eq(sampleDescription);
    });

    it('can reject a claim', async () => {
      const oldLength = (await claims.getClaims(contractId, '/company/b-s-s/employee/swo4')).length;
      await claims.setClaim(accounts[0], accounts[0], '/company');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
      const claimId = await claims.setClaim(accounts[0], contractId, '/company/b-s-s/employee/swo4');
      await claims.rejectClaim(accounts[0], contractId, claimId);
      const claimsForAccount = await claims.getClaims(contractId, '/company/b-s-s/employee/swo4');
      expect(claimsForAccount).to.have.lengthOf(oldLength + 1);
      expect(claimsForAccount[oldLength]).to.have.property('status', ClaimsStatus.Rejected);
    });

    it('can reject a claim with a reason', async () => {
      const oldLength = (await claims.getClaims(contractId, '/company/b-s-s/employee/swo4')).length;
      await claims.setClaim(accounts[0], accounts[0], '/company');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
      const claimId = await claims.setClaim(accounts[0], contractId, '/company/b-s-s/employee/swo4');
      await claims.rejectClaim(accounts[0], contractId, claimId, { reason: 'denied' });
      const claimsForAccount = await claims.getClaims(contractId, '/company/b-s-s/employee/swo4');
      expect(claimsForAccount).to.have.lengthOf(oldLength + 1);
      expect(claimsForAccount[oldLength]).to.have.property('status', ClaimsStatus.Rejected);
      expect(claimsForAccount[oldLength]).to.have.deep.property('rejectReason', { reason: 'denied' });
    });

    it('can not re accept a rejected claim', async () => {
      const oldLength = (await claims.getClaims(contractId, '/company/b-s-s/employee/swo4')).length;
      await claims.setClaim(accounts[0], accounts[0], '/company');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
      const claimId = await claims.setClaim(accounts[0], contractId, '/company/b-s-s/employee/swo4');
      await claims.rejectClaim(accounts[0], contractId, claimId);
      const reacceptedP = claims.confirmClaim(accounts[0], contractId, claimId);
      await expect(reacceptedP).to.be.rejected;
    });

    it('cannot have other users approve claims of a contract of another user', async () => {
      const oldLength = (await claims.getClaims(contractId, '/company/b-s-s/employee/swo4')).length;
      await claims.setClaim(accounts[0], accounts[0], '/company');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
      await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
      const claimId = await claims.setClaim(accounts[0], contractId, '/company/b-s-s/employee/swo4');
      await expect(claims.confirmClaim(accounts[1], contractId, claimId)).to.be.rejected;
    });
  });
});
