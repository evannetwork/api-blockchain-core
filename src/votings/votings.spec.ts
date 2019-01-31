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
import { ContractLoader, Executor } from '@evan.network/dbcp';
import { expect, use } from 'chai';

import { accounts } from '../test/accounts';
import { TestUtils } from '../test/test-utils';
import { Votings } from './votings';

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const [ votingOwner, member, nonMember ] = accounts;

use(chaiAsPromised);

describe('Voting handler', function() {
  this.timeout(600000);
  let contractLoader: ContractLoader;
  let executor: Executor;
  let votingContract: any;
  let votings: Votings;
  let web3: any;

  let createDescription = () => `${Math.random()} is the most awesome random number ever`;
  let createProposal = async (description) =>
    votings.createProposal(votingContract, votingOwner, { description, });
  let nextBlock = async () => await executor.executeSend({ from: votingOwner, value: 0, to: votingOwner });
  let psleep = (ms) => new Promise(s => setTimeout(() => s(), ms));

  before(async () => {
    web3 = TestUtils.getWeb3();
    contractLoader = await TestUtils.getContractLoader(web3);
    executor = await TestUtils.getExecutor(web3);
    votings = await TestUtils.getVotings(web3);
  });

  it('can create a new voting contract', async() => {
    votingContract = await votings.createContract(
      votingOwner,
      {
        minimumQuorumForProposals: 2,
        minutesForDebate: 0,
        marginOfVotesForMajority: 0,
      },
    );
    await votings.addMember(votingContract, votingOwner, member, { name: 'Member No. 2' });
  });

  describe('when managing voting members', () => {
    it('can add new members', async () => {
      await expect(await votings.isMember(votingContract, nonMember)).to.be.false;
      await votings.addMember(votingContract, votingOwner, nonMember, { name: 'Member No. 3' });
      await expect(await votings.isMember(votingContract, nonMember)).to.be.true;
    });

    it('can remove members', async () => {
      await expect(await votings.isMember(votingContract, nonMember)).to.be.true;
      await votings.removeMember(votingContract, votingOwner, nonMember);
      await expect(await votings.isMember(votingContract, nonMember)).to.be.false;
    });

    it('can re-add members', async () => {
      await expect(await votings.isMember(votingContract, nonMember)).to.be.false;
      await votings.addMember(votingContract, votingOwner, nonMember, { name: 'Member No. 3' });
      await expect(await votings.isMember(votingContract, nonMember)).to.be.true;
      await votings.removeMember(votingContract, votingOwner, nonMember);
    });
  });

  describe('when voting', () => {
    it('can create a new proposal', async () => {
      const description = createDescription();
      const proposal = await createProposal(description);
      const newProposal = await votings.getProposalInfo(votingContract, proposal);
      expect(newProposal.description).to.eq(description);
    });

    it('accepts votes from members', async () => {
      let description;
      let proposal;
      // accept
      description = createDescription();
      proposal = await createProposal(description);
      await expect(votings.vote(votingContract, member, proposal, true)).not.to.be.rejected;
      // reject
      description = createDescription();
      proposal = await createProposal(description);
      await expect(votings.vote(votingContract, member, proposal, false, 'Objection!')).not.to.be.rejected;
    });

    it('does not accept votes from non-members', async () => {
      let description;
      let proposal;
      // accept
      description = createDescription();
      proposal = await createProposal(description);
      await expect(votings.vote(votingContract, nonMember, proposal, true)).to.be.rejected;
      // reject
      description = createDescription();
      proposal = await createProposal(description);
      await expect(votings.vote(votingContract, nonMember, proposal, false, 'Objection!')).to.be.rejected;
    });
  });

  describe('when executing proposals', () => {
    it('allows votings owner to execute a proposal, if enough votes have been given', async () => {
      const proposal = await createProposal(createDescription());
      await timeout(5000);
      await votings.vote(votingContract, votingOwner, proposal, true);
      await timeout(5000);
      await votings.vote(votingContract, member, proposal, true);
      await timeout(5000);
      await expect(votings.execute(votingContract, votingOwner, proposal)).not.to.be.rejected;
    });

    it('allows member to execute a proposal, if enough votes have been given', async () => {
      const proposal = await createProposal(createDescription());
      await timeout(5000);
      await votings.vote(votingContract, votingOwner, proposal, true);
      await timeout(5000);
      await votings.vote(votingContract, member, proposal, true);
      await timeout(5000);
      await expect(votings.execute(votingContract, member, proposal)).not.to.be.rejected;
    });

    it('allows any account to execute a proposal, if enough votes have been given', async () => {
      const proposal = await createProposal(createDescription());
      await timeout(5000);
      await votings.vote(votingContract, votingOwner, proposal, true);
      await timeout(5000);
      await votings.vote(votingContract, member, proposal, true);
      await timeout(5000);
      await expect(votings.execute(votingContract, nonMember, proposal)).not.to.be.rejected;
    });

    it('does not allow to execute a proposal, if not enough votes have been given', async () => {
      const proposal = await createProposal(createDescription());
      await votings.vote(votingContract, votingOwner, proposal, true);
      await expect(votings.execute(votingContract, votingOwner, proposal)).to.be.rejected;
    });

    it('can perform transactions (and not only votes) via congress contract', async() => {
      const testContract = await executor.createContract(
        'TestContract', ['abc'], { from: votingOwner, gas: 2000000 });
      // input for: setData("def")
      const setDataToDef = '0x47064d6a' +
        '0000000000000000000000000000000000000000000000000000000000000020' +
        '0000000000000000000000000000000000000000000000000000000000000003' +
        '6465660000000000000000000000000000000000000000000000000000000000'
      ;
      const proposal = await votings.createProposal(
        votingContract,
        votingOwner,
        {
          description: createDescription(),
          data: setDataToDef,
          to: testContract.options.address,
        }
      );
      await timeout(5000);
      await votings.vote(votingContract, votingOwner, proposal, true);
      await timeout(5000);
      await votings.vote(votingContract, member, proposal, true);

      // check before update
      expect(await executor.executeContractCall(testContract, 'data')).to.eq('abc');
      await timeout(5000);
      // make new block to update time check in contract (for gas estimation)
      await nextBlock();
      await timeout(5000);
      await expect(votings.execute(votingContract, votingOwner, proposal, setDataToDef)).not.to.be.rejected;
      expect(await executor.executeContractCall(testContract, 'data')).to.eq('def');
    });
  });

  describe('when executing proposals with voting time', async () => {
    it('allows proposal execution if executing after vote time ended', async () => {
      const contract = await votings.createContract(
        votingOwner,
        {
          minimumQuorumForProposals: 2,
          minutesForDebate: 1,
          marginOfVotesForMajority: 0,
        },
      );
      await votings.addMember(contract, votingOwner, member, { name: 'Member No. 2' });
      const proposal = await votings.createProposal(
        contract, votingOwner, { description: createDescription() });
      await votings.vote(contract, votingOwner, proposal, true);
      await votings.vote(contract, member, proposal, true);

      // wait until time reached (+10s)
      await psleep(70000);
      // make new block to update time check in contract (for gas estimation)
      await nextBlock();
      await expect(votings.execute(contract, votingOwner, proposal)).not.to.be.rejected;
    });

    it('does not allow proposal execution if executing before vote time ended', async () => {
      const contract = await votings.createContract(
        votingOwner,
        {
          minimumQuorumForProposals: 2,
          minutesForDebate: 1,
          marginOfVotesForMajority: 0,
        },
      );
      await votings.addMember(contract, votingOwner, member, { name: 'Member No. 2' });
      const proposal = await votings.createProposal(
        contract, votingOwner, { description: createDescription() });
      await votings.vote(contract, votingOwner, proposal, true);
      await votings.vote(contract, member, proposal, true);

      // wait 2s
      await psleep(2000);
      // make new block to update time check in contract (for gas estimation)
      await nextBlock();
      await expect(votings.execute(contract, votingOwner, proposal)).to.be.rejected;
    });
  });

  describe('when paging through proposals', async() => {
    const descriptions = [
      '0.17664580626145200 is the most awesome random number ever',
      '0.67163320670743580 is the most awesome random number ever',
      '0.07618375841815772 is the most awesome random number ever',
      '0.18392786041740372 is the most awesome random number ever',
      '0.56878702637737870 is the most awesome random number ever',
      '0.82279484477584890 is the most awesome random number ever',
      '0.24555098987061785 is the most awesome random number ever',
      '0.51627801995238800 is the most awesome random number ever',
      '0.82731705261710630 is the most awesome random number ever',
      '0.23951314981719540 is the most awesome random number ever',
      '0.26150436924424314 is the most awesome random number ever',
      '0.23829951536378036 is the most awesome random number ever',
      '0.08490078250525390 is the most awesome random number ever',
      '0.34190422508920770 is the most awesome random number ever',
      '0.62188391550323250 is the most awesome random number ever',
      '0.57579188868901630 is the most awesome random number ever',
      '0.64027735039496060 is the most awesome random number ever',
      '0.27940837974617727 is the most awesome random number ever',
      '0.09509236784919683 is the most awesome random number ever',
      '0.33218270780830240 is the most awesome random number ever',
      '0.94567104633843300 is the most awesome random number ever',
      '0.50758494770653860 is the most awesome random number ever',
      '0.44964184294725840 is the most awesome random number ever',
      '0.90566670541089360 is the most awesome random number ever',
      '0.14632923460168112 is the most awesome random number ever',
      '0.07838871652030921 is the most awesome random number ever',
      '0.98703823197063150 is the most awesome random number ever',
    ];
    const descriptionsNewestFirst = descriptions.reverse();
    const numOfProposals = 27;
    let contract;

    before(async () => {
      // create new voting contract
      contract = await votings.createContract(
        votingOwner,
        {
          minimumQuorumForProposals: 2,
          minutesForDebate: 1,
          marginOfVotesForMajority: 0,
        },
      );
      for (let description of descriptions) {
        await votings.createProposal(contract, votingOwner, { description });
      }
      // contract = contractLoader.loadContract('Congress', '0x9C1F4d7E75163D054A98700b1568347C5f687238');
    });

    it('can retrieve a single page', async () => {
      const retrieved = await votings.getProposalInfos(contract);
      expect(retrieved.totalCount).to.eq(numOfProposals);
      expect(retrieved.results.length).to.eq(Math.min(10, numOfProposals));
      for (let [i, result] of retrieved.results.entries()) {
        expect(result.description).to.eq(descriptionsNewestFirst[i]);
      }
    });

    it('can page to last result', async () => {
      let count = await votings.getProposalCount(contract);
      let results = await votings.getProposalInfos(contract, count);

      expect(results.totalCount).to.eq(numOfProposals);
      expect(results.results.length).to.eq(Math.min(numOfProposals, results.totalCount));
      for (let [i, result] of results.results.entries()) {
        expect(result.description).to.eq(descriptionsNewestFirst[i]);
      }
    });
  });
});
