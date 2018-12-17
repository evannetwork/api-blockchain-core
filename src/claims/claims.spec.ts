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
  let claimsContracts;
  let contractLoader: ContractLoader;
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
    await claims.createIdentity(accounts[0]);
    await claims.createIdentity(accounts[1]);
  });

  after(async () => {
    web3.currentProvider.connection.close();
  });

  // can be used for creating new libraries, but disabled by default
  // it.only('can deploy a new structure', async () => {
  //   const keyHolderLib = await executor.createContract(
  //     'KeyHolderLibrary', [], { from: accounts[0], gas: 3000000, });
  //   contractLoader.contracts['ClaimHolderLibrary'].bytecode = linker.linkBytecode(
  //     contractLoader.contracts['ClaimHolderLibrary'].bytecode,
  //     { 'claims/KeyHolderLibrary.sol:KeyHolderLibrary': keyHolderLib.options.address }
  //   );
  //   const claimHolderLib = await executor.createContract(
  //     'ClaimHolderLibrary', [], { from: accounts[0], gas: 3000000, });
  //   contractLoader.contracts['OriginIdentity'].bytecode = linker.linkBytecode(
  //   contractLoader.contracts['OriginIdentity'].bytecode,
  //     {
  //       'claims/ClaimHolderLibrary.sol:ClaimHolderLibrary': claimHolderLib.options.address,
  //       'claims/KeyHolderLibrary.sol:KeyHolderLibrary': keyHolderLib.options.address,
  //     },
  //   )
  //   console.dir({keyHolderLib: keyHolderLib.options.address, claimHolderLib: claimHolderLib.options.address});
  // })

  it('can add a claim', async () => {
    const oldLength = (await claims.getClaims('/company', accounts[1])).length;
    await claims.setClaim(accounts[0], accounts[1], '/company');
    const claimsForAccount = await claims.getClaims('/company', accounts[1]);
    expect(claimsForAccount).to.have.lengthOf(oldLength + 1);
    expect(claimsForAccount[oldLength]).to.have.property('status', ClaimsStatus.Issued);
  });

  it('can add a claim with specific data', async () => {
    const oldLength = (await claims.getClaims('/company', accounts[1])).length;
    await claims.setClaim(accounts[0], accounts[1], '/company', null, {foo: 'bar'});
    const claimsForAccount = await claims.getClaims('/company', accounts[1]);
    expect(claimsForAccount).to.have.lengthOf(oldLength + 1);
    expect(claimsForAccount[oldLength]).to.have.property('uri', 'https://ipfs.evan.network/ipfs/Qmbjig3cZbUUufWqCEFzyCppqdnmQj3RoDjJWomnqYGy1f');
  });

  it('can add a claim with specific expirationDate', async () => {
    const oldLength = (await claims.getClaims('/company', accounts[1])).length;
    const now = Math.floor(new Date().getTime() / 1000);
    await claims.setClaim(accounts[0], accounts[1], '/company', now);
    const claimsForAccount = await claims.getClaims('/company', accounts[1]);
    expect(claimsForAccount).to.have.lengthOf(oldLength + 1);
    expect(claimsForAccount[oldLength]).to.have.property('expirationDate', now.toString());
  });

  it('can add a claim and validate the integrity', async () => {
    const oldLength = (await claims.getClaims('/company', accounts[1])).length;
    await claims.setClaim(accounts[0], accounts[1], '/company');
    const claimsForAccount = await claims.getClaims('/company', accounts[1]);
    expect(claimsForAccount).to.have.lengthOf(oldLength + 1);
    await claims.validateClaim(claimsForAccount[oldLength].id, accounts[1]);
    expect(claimsForAccount[oldLength]).to.have.property('status', ClaimsStatus.Issued);
  });

  it('can add subclaim paths and validate it', async () => {
    const oldLength = (await claims.getClaims('/company', accounts[1])).length;
    await claims.setClaim(accounts[0], accounts[0], '/company');
    await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
    await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
    await claims.setClaim(accounts[0], accounts[1], '/company/b-s-s/employee/swo');
    const identity = await claims.getIdentityForAccount(accounts[1]);
    const claimTree = await claims.validateClaimTree('/company/b-s-s/employee/swo', identity.options.address);
    expect(claimTree).to.have.lengthOf(4);
  });

  it('can add subclaim paths and don\'t have the needed root claims.', async () => {
    const oldLength = (await claims.getClaims('/company', accounts[1])).length;
    await claims.setClaim(accounts[0], accounts[0], '/company/evan/employee');
    await claims.setClaim(accounts[0], accounts[1], '/company/evan/employee/swo2');
    const identity = await claims.getIdentityForAccount(accounts[1]);
    const claimTree = await claims.validateClaimTree('/company/evan/employee/swo2', identity.options.address);
    expect(claimTree).to.have.lengthOf(2);
  });

  it('can add subclaim paths', async () => {
    const oldLength = (await claims.getClaims('/company/b-s-s/employee/swo3', accounts[1])).length;
    await claims.setClaim(accounts[0], accounts[0], '/company');
    await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
    await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
    await claims.setClaim(accounts[0], accounts[1], '/company/b-s-s/employee/swo3');
    const claimsForAccount = await claims.getClaims('/company/b-s-s/employee/swo3', accounts[1]);
    expect(claimsForAccount).to.have.lengthOf(1);
    expect(claimsForAccount[oldLength]).to.have.property('status', ClaimsStatus.Issued);
  });

  it('can confirm a subclaim paths with the subject user', async () => {
    const oldLength = (await claims.getClaims('/company/b-s-s/employee/swo4', accounts[1])).length;
    await claims.setClaim(accounts[0], accounts[0], '/company');
    await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
    await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
    const claimId = await claims.setClaim(accounts[0], accounts[1], '/company/b-s-s/employee/swo4');
    await claims.confirmClaim(accounts[1], '/company/b-s-s/employee/swo4', accounts[0], claimId);
    const claimsForAccount = await claims.getClaims('/company/b-s-s/employee/swo4', accounts[1]);
    expect(claimsForAccount).to.have.lengthOf(oldLength + 1);
    expect(claimsForAccount[oldLength]).to.have.property('status', ClaimsStatus.Confirmed);
  });

  it('can reject a subclaim paths with the subject user', async () => {
    await claims.setClaim(accounts[0], accounts[0], '/company');
    await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
    await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
    const claimId = await claims.setClaim(accounts[0], accounts[1], '/company/b-s-s/employee/swo6');
    await claims.deleteClaim(accounts[1], '/company/b-s-s/employee/swo6', accounts[0], claimId);
    const claimsForAccount = await claims.getClaims('/company/b-s-s/employee/swo6', accounts[1]);
    expect(claimsForAccount).to.have.lengthOf(0);
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
    const claimsForAccount = await claims.getClaims(sampleClaimTopic, accounts[1]);
    const last = claimsForAccount.length - 1;
    expect(claimsForAccount[last]).to.have.property('status', ClaimsStatus.Issued);
    expect(claimsForAccount[last]).to.have.property('creationBlock');
    expect(claimsForAccount[last].description).to.deep.eq(sampleDescription);
  });

  it('can reject a claim', async () => {
    const oldLength = (await claims.getClaims('/company/b-s-s/employee/swo4', accounts[1])).length;
    await claims.setClaim(accounts[0], accounts[0], '/company');
    await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
    await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
    const claimId = await claims.setClaim(accounts[0], accounts[1], '/company/b-s-s/employee/swo4');
    await claims.rejectClaim(accounts[1], '/company/b-s-s/employee/swo4', accounts[0], claimId);
    const claimsForAccount = await claims.getClaims('/company/b-s-s/employee/swo4', accounts[1]);
    expect(claimsForAccount).to.have.lengthOf(oldLength + 1);
    expect(claimsForAccount[oldLength]).to.have.property('status', ClaimsStatus.Rejected);
  });

  it('can reject a claim with a reason', async () => {
    const oldLength = (await claims.getClaims('/company/b-s-s/employee/swo4', accounts[1])).length;
    await claims.setClaim(accounts[0], accounts[0], '/company');
    await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
    await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
    const claimId = await claims.setClaim(accounts[0], accounts[1], '/company/b-s-s/employee/swo4');
    await claims.rejectClaim(accounts[1], '/company/b-s-s/employee/swo4', accounts[0], claimId, { reason: 'denied' });
    const claimsForAccount = await claims.getClaims('/company/b-s-s/employee/swo4', accounts[1]);
    expect(claimsForAccount).to.have.lengthOf(oldLength + 1);
    expect(claimsForAccount[oldLength]).to.have.property('status', ClaimsStatus.Rejected);
    expect(claimsForAccount[oldLength]).to.have.deep.property('rejectReason', { reason: 'denied' });
  });

  it('can reject a claim with a reason from the issuer side', async () => {
    const oldLength = (await claims.getClaims('/company/b-s-s/employee/swo4', accounts[1])).length;
    await claims.setClaim(accounts[0], accounts[0], '/company');
    await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
    await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
    const claimId = await claims.setClaim(accounts[0], accounts[1], '/company/b-s-s/employee/swo4');
    await claims.rejectClaim(accounts[0], '/company/b-s-s/employee/swo4', accounts[0], claimId, { reason: 'denied' });
    const claimsForAccount = await claims.getClaims('/company/b-s-s/employee/swo4', accounts[1]);
    expect(claimsForAccount).to.have.lengthOf(oldLength + 1);
    expect(claimsForAccount[oldLength]).to.have.property('status', ClaimsStatus.Rejected);
    expect(claimsForAccount[oldLength]).to.have.deep.property('rejectReason', { reason: 'denied' });
  });

  it('can not re accept a rejected claim', async () => {
    const oldLength = (await claims.getClaims('/company/b-s-s/employee/swo4', accounts[1])).length;
    await claims.setClaim(accounts[0], accounts[0], '/company');
    await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s');
    await claims.setClaim(accounts[0], accounts[0], '/company/b-s-s/employee');
    const claimId = await claims.setClaim(accounts[0], accounts[1], '/company/b-s-s/employee/swo4');
    await claims.rejectClaim(accounts[1], '/company/b-s-s/employee/swo4', accounts[0], claimId);
    const reacceptedP = claims.confirmClaim(accounts[1], '/company/b-s-s/employee/swo4', accounts[0], claimId);
    await expect(reacceptedP).to.be.rejected;
  });
});
