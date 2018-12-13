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
import { Executor } from '@evan.network/dbcp';

import { accounts } from '../test/accounts';
import { TestUtils } from '../test/test-utils';
import { Votings } from './votings';

const [ votingOwner, member, nonMember ] = accounts;

use(chaiAsPromised);

describe('Voting handler', () => {
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
    executor = await TestUtils.getExecutor(web3);
    votings = await TestUtils.getVotings(web3);
  });

  after(async () => {
    web3.currentProvider.connection.close();
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
      await votings.vote(votingContract, votingOwner, proposal, true);
      await votings.vote(votingContract, member, proposal, true);
      await expect(votings.execute(votingContract, votingOwner, proposal)).not.to.be.rejected;
    });

    it('allows member to execute a proposal, if enough votes have been given', async () => {
      const proposal = await createProposal(createDescription());
      await votings.vote(votingContract, votingOwner, proposal, true);
      await votings.vote(votingContract, member, proposal, true);
      await expect(votings.execute(votingContract, member, proposal)).not.to.be.rejected;
    });

    it('allows any account to execute a proposal, if enough votes have been given', async () => {
      const proposal = await createProposal(createDescription());
      await votings.vote(votingContract, votingOwner, proposal, true);
      await votings.vote(votingContract, member, proposal, true);
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
      await votings.vote(votingContract, votingOwner, proposal, true);
      await votings.vote(votingContract, member, proposal, true);

      // check before update
      expect(await executor.executeContractCall(testContract, 'data')).to.eq('abc');
      // make new block to update time check in contract (for gas estimation)
      await nextBlock();
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
});
