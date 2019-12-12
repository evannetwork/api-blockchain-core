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

import {
  ContractLoader,
  Executor,
  Logger,
  LoggerOptions,
} from '@evan.network/dbcp';

import { NameResolver } from '../name-resolver';


const nullAddress = '0x0000000000000000000000000000000000000000';
const defaultProposalOptions = {
  data: '0x',
  to: nullAddress,
  value: '0',
};

/**
 * info about a member of the voting contract
 */
export interface MemberInfo {
  /**
   * accountId of member
   */
  address: string;
  /**
   * description text of member
   */
  name: string;
  /**
   * date of joining votings contract
   */
  memberSince: string;
}

/**
 * options for membership on voting contract
 */
export interface MemberOptions {
  /**
   * description text for member
   */
  name: string;
}

/**
 * details about a proposal
 */
export interface ProposalInfo {
  /**
   * current number of positive votes
   */
  currentResult: number;
  /**
   * description text
   */
  description: string;
  /**
   * true if already executed
   */
  executed: boolean;
  /**
   * earliest day of execution
   */
  minExecutionDate: number;
  /**
   * number of submitted votes
   */
  numberOfVotes: number;
  /**
   * checksum of proposal: keccak256(beneficiary, weiAmount, transactionBytecode)
   */
  proposalHash: string;
  /**
   * true if executed and proposal passed
   */
  proposalPassed: boolean;
  /**
   * target of proposal (contract/account to send transaction to)
   */
  to: string;
  /**
   * amount of Wei to send to target
   */
  value: string;
}

/**
 * result set for paging through proposals
 */
export interface ProposalInfos {
  /**
   * proposals of current page (length is 10)
   */
  results: ProposalInfo[];
  /**
   * total number of results
   */
  totalCount: number;
}

/**
 * options for creating a proposal
 */
export interface ProposalOptions {
  /**
   * description text
   */
  description: string;
  /**
   * input data for proposal (defaults to '0x' if omitted)
   */
  data?: string;
  /**
   * target of proposal (contract/account to send transaction to)
   */
  to?: string;
  /**
   * amount of Wei to send to target
   */
  value?: string;
}

/**
 * options for creating a new voting contract
 */
export interface VotingsContractOptions {
  /**
   * votes that must have been given before any proposal is accepted; updates to this may affect
   * running proposals
   */
  minimumQuorumForProposals: number;
  /**
   * time to have passed before a proposal can be accepted; updates to this do not affect running
   * proposals
   */
  minutesForDebate: number;
  /**
   * accepting votes that must have been given before any proposal is accepted; updates to this may
   * affect running proposals
   */
  marginOfVotesForMajority: number;
}

/**
 * options for votings library
 */
export interface VotingsOptions extends LoggerOptions {
  contractLoader: ContractLoader;
  executor: Executor;
  nameResolver: NameResolver;
}

/**
 * Votings helper
 *
 * @class      Votings (name)
 */
export class Votings extends Logger {
  public options: VotingsOptions;

  /**
   * create new Votings instance.
   */
  public constructor(options: VotingsOptions) {
    super(options);
    this.options = options;
  }

  /**
   * add member to voting contract
   *
   * @param      {string|any}     contract       web3 voting contract instance or contract address
   * @param      {string}         accountId      account that performs the action
   * @param      {string}         targetAccount  account to add to votings contract
   * @param      {MemberOptions}  memberOptions  options for new member
   * @return     {Promise<void>}  resolved when done
   */
  public async addMember(
    contract: string|any,
    accountId: string,
    targetAccount: string,
    memberOptions: MemberOptions,
  ): Promise<void> {
    await this.options.executor.executeContractTransaction(
      this.ensureContract(contract),
      'addMember',
      { from: accountId },
      targetAccount,
      memberOptions.name,
    );
  }

  /**
   * create new voting contract instance
   *
   * @param      {string}                  accountId               account that performs the action
   * @param      {VotingsContractOptions}  votingsContractOptions  additional options for voting
   *                                                               contract
   * @return     {Promise<any>}            votings contract web3 instance
   */
  public async createContract(accountId: string, votingsContractOptions: VotingsContractOptions
  ): Promise<any> {
    const congressOptions = [
      votingsContractOptions.minimumQuorumForProposals,
      votingsContractOptions.minutesForDebate,
      votingsContractOptions.marginOfVotesForMajority,
    ];
    return await this.options.executor.createContract(
      'Congress', congressOptions, { from: accountId, gas: 2000000 });
  }

  /**
   * create a new proposal in votings contract
   *
   * @param      {string|any}       contract         web3 voting contract instance or contract
   *                                                 address
   * @param      {string}           accountId        account that performs the action
   * @param      {ProposalOptions}  proposalOptions  options for new proposal
   * @return     {Promise<string>}  id of new proposal
   */
  public async createProposal(
    contract: string|any,
    accountId: string,
    proposalOptions: ProposalOptions,
  ): Promise<string> {
    this.log(`creating proposal in congress "${contract.options.address}" ` +
      `with account ${accountId}`, 'info');
    const options = Object.assign({}, defaultProposalOptions, proposalOptions);
    return await this.options.executor.executeContractTransaction(
      this.ensureContract(contract),
      'newProposal',
      {
        from: accountId,
        // emit ProposalAdded(proposalID, beneficiary, weiAmount, jobDescription);
        event: { target: 'Congress', eventName: 'ProposalAdded' },
        getEventResult: (_, args) => args.proposalID.toString(),
      },
      options.to,
      options.value,
      options.description,
      options.data,
    );
  }

  /**
   * execute a proposal
   *
   * @param      {string|any}     contract   web3 voting contract instance or contract address
   * @param      {string}         accountId  account that performs the action
   * @param      {string|number}  proposal   id of proposal
   * @param      {string}         data       (optional) transaction input bytes as string
   *                                         (`0x${functionhash}${argumentsData}`)
   * @return     {Promise<void>}  resolved when done
   */
  public async execute(
    contract: string|any,
    accountId: string,
    proposal: string|number, data = '0x',
  ): Promise<any> {
    this.log(`executing proposal in congress "${contract.options.address}", ` +
      `proposal "${proposal}" with account ${accountId}`, 'info');
    await this.options.executor.executeContractTransaction(
      this.ensureContract(contract),
      'executeProposal',
      { from: accountId, force: true },
      proposal,
      data,
    );
  }

  /**
   * get info of a member
   *
   * @param      {string|any}           contract       web3 voting contract instance or contract
   *                                                   address
   * @param      {string}               targetAccount  account to get info for
   * @return     {Promise<MemberInfo>}  info about member
   */
  public async getMemberInfo(contract: string|any, targetAccount: string): Promise<MemberInfo> {
    const memberId = await this.options.executor.executeContractCall(
      this.ensureContract(contract),
      'memberId',
      targetAccount,
    );
    if (memberId.toString() !== '0') {
      const fromContract = await this.options.executor.executeContractCall(
        this.ensureContract(contract),
        'members',
        memberId.toString(),
      );
      if (fromContract.member === targetAccount) {
        return {
          ...fromContract,
          memberSince: parseInt(`${fromContract.fromContract}000`, 10),
        };
      }
    }
    return null;
  }

  /**
   * get number of proposals in votings contract
   *
   * @param      {string|any}       contract  web3 voting contract instance or contract address
   * @return     {Promise<number>}  number of proposals
   */
  public async getProposalCount(contract: string|any): Promise<number> {
    return parseInt(await this.options.executor.executeContractCall(
      this.ensureContract(contract),
      'numProposals',
    ), 10);
  }

  /**
   * gets info about a given proposal in contract
   *
   * @param      {string|any}             contract  web3 voting contract instance or contract
   *                                                address
   * @param      {string|number}          proposal  id of proposal
   * @return     {Promise<ProposalInfo>}  info about proposal
   */
  public async getProposalInfo(contract: string|any, proposal: string): Promise<ProposalInfo> {
    const fromContract = await this.options.executor.executeContractCall(
      this.ensureContract(contract),
      'proposals',
      proposal,
    );
    return {
      currentResult: parseInt(fromContract.currentResult, 10),
      description: fromContract.description,
      executed: fromContract.executed,
      minExecutionDate: parseInt(`${fromContract.minExecutionDate}000`, 10),
      numberOfVotes: parseInt(fromContract.numberOfVotes,  10),
      proposalHash: fromContract.proposalHash,
      proposalPassed: fromContract.proposalPassed,
      to: fromContract.recipient,
      value: fromContract.amount,
    };
  }

  /**
   * get multiple proposals from votings contract
   *
   * @param      {string|any}              contract  web3 voting contract instance or
   *                                                 contractaddress
   * @param      {number}                  count     number of items to retrieve
   * @param      {number}                  offset    skip this many entries
   * @param      {boolean}                 reverse   fetch entries, starting with last entry
   * @return     {Promise<ProposalInfos>}  proposals listing
   */
  public async getProposalInfos(
    contract: string|any,
    count = 10,
    offset = 0,
    reverse = true,
  ): Promise<ProposalInfos> {
    let totalCountString;
    const votingsContract = this.ensureContract(contract);
    const results = await this.options.nameResolver.getArrayFromUintMapping(
      votingsContract,
      async () => {
        totalCountString = await this.options.executor.executeContractCall(
          votingsContract, 'numProposals');
        return totalCountString;
      },
      (i) => this.getProposalInfo(votingsContract, i),
      count,
      offset,
      reverse,
    );
    return {
      results: results.filter(result => !!result.minExecutionDate),
      totalCount: parseInt(totalCountString, 10),
    };
  }

  /**
   * checks if a given account is member in voting contract
   *
   * @param      {string|any}  contract       web3 voting contract instance or contract address
   * @param      {string}      targetAccount  account to check
   * @return     {Promise<boolean>}  true if member, false otherwise.
   */
  public async isMember(contract: string|any, targetAccount: string): Promise<any> {
    const memberInfo = await this.getMemberInfo(contract, targetAccount);
    return !!memberInfo;
  }

  /**
   * remove member from votings contract
   *
   * @param      {string|any}  contract       web3 voting contract instance or contract address
   * @param      {string}      accountId      account that performs the action
   * @param      {string}      targetAccount  account to remove from votings contract
   * @return     {Promise<void>}   resolved when done
   */
  public async removeMember(
    contract: string|any,
    accountId: string,
    targetAccount: string,
  ): Promise<void> {
    await this.options.executor.executeContractTransaction(
      this.ensureContract(contract),
      'removeMember',
      { from: accountId },
      targetAccount,
    );
  }

  /**
   * vote for a proposal
   *
   * @param      {string|any}     contract   web3 voting contract instance or contract address
   * @param      {string}         accountId  account that performs the action
   * @param      {string|number}  proposal   id of proposal
   * @param      {boolean}        accept     true if accepting proposal
   * @param      {string}         comment    (optional) comment for vote
   * @return     {Promise<void>}  resolved when done
   */
  public async vote(
    contract: string|any,
    accountId: string,
    proposal: string,
    accept: boolean,
    comment = '',
  ): Promise<void> {
    this.log(`voting for proposal in congress "${contract.options.address}", ` +
      `proposal "${proposal}" with account ${accountId}, responst is "${accept}"`, 'info');
    await this.options.executor.executeContractTransaction(
      this.ensureContract(contract),
      'vote',
      { from: accountId },
      proposal,
      accept,
      comment,
    );
  }

  /**
   * check if given argument is a contract instance, load contract if not
   *
   * @param      {string|any}  contract  web3 voting contract instance or contract address
   * @return     {any}         contract instance
   */
  private ensureContract(contract: string|any): any {
    return typeof contract === 'string' ?
      this.options.contractLoader.loadContract('Congress', contract) :
      contract
    ;
  }
}
