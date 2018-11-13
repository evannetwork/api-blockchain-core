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

import coder = require('web3-eth-abi');
import { BigNumber } from 'bignumber.js';
var linker = require('solc/linker');

const nullBytes32 = '0x0000000000000000000000000000000000000000000000000000000000000000';
const nullAddress = '0x0000000000000000000000000000000000000000';

import {
  AccountStore,
  ContractLoader,
  Description,
  EventHub,
  Executor,
  Logger,
  LoggerOptions,
  NameResolver,
} from '@evan.network/dbcp';

export enum ClaimsStatus {
  /**
   * empty subject
   */
  None,
  /**
   * self issued state is 1, values may match
   */
  Rejected,
  /**
   * issued by both, self issued state is 2, values match
   */
  Confirmed,
  /**
   * issued by a non-issuer parent claim holder, self issued state is 0
   */
  Issued,
  /**
   * value from issuer and subject (self issued) missmatch
   */
  ValueMissmatch,
  /**
   * subject set, but value and/or states do not fall within expected range
   */
  Unknown,
}


export interface ClaimsOptions extends LoggerOptions {
  contractLoader: ContractLoader;
  executor: Executor;
  nameResolver: NameResolver;
  accountStore: AccountStore;
  storage?: string;
}

/**
 * Claims helper
 *
 * @class      Sharing (name)
 */
export class Claims extends Logger {
  contracts: any;
  options: ClaimsOptions;

  constructor(options: ClaimsOptions) {
    super(options);
    this.options = options;
    if (options.storage) {
      this.contracts.storage = this.options.contractLoader.loadContract('V00_UserRegistry', options.storage);
    }
  }

  /**
   * create a new claims structure; this includes a new registry and a default resolver for it
   *
   * @param      {string}        accountId  account, that execute the transaction and owner of the
   *                                        new registry
   * @return     {Promise<any>}  object with properties 'registry' and 'resolver', that are web3js
   *                             contract instances
   */
  public async createStructure(accountId: string): Promise<any> {

    // create Identity Storage
    const storage = await this.options.executor.createContract(
      'V00_UserRegistry', [], { from: accountId, gas: 1000000, });

    const keyHolderLib = await this.options.executor.createContract(
      'KeyHolderLibrary', [], { from: accountId, gas: 2000000, });

    this.options.contractLoader.contracts['ClaimHolderLibrary'].bytecode = linker.linkBytecode(
      this.options.contractLoader.contracts['ClaimHolderLibrary'].bytecode, 
      { 'claims/KeyHolderLibrary.sol:KeyHolderLibrary': keyHolderLib.options.address }
    )

    const claimHolderLib = await this.options.executor.createContract(
      'ClaimHolderLibrary', [], { from: accountId, gas: 2000000, });

    this.options.contractLoader.contracts['OriginIdentity'].bytecode = linker.linkBytecode(
      this.options.contractLoader.contracts['OriginIdentity'].bytecode, 
      { 
        'claims/ClaimHolderLibrary.sol:ClaimHolderLibrary': claimHolderLib.options.address,
        'claims/KeyHolderLibrary.sol:KeyHolderLibrary': keyHolderLib.options.address 
      },
    )

    this.contracts = { storage, };
  }

  public async createIdentity(accountId: string): Promise<any> {
    // create Identity contract
    const identityContract = await this.options.executor.createContract(
      'OriginIdentity', [], { from: accountId, gas: 2000000, });

    const identityStorage = this.contracts.storage.options.address !== nullAddress ?
      this.options.contractLoader.loadContract('V00_UserRegistry', this.contracts.storage.options.address) : null;

    await this.options.executor.executeContractTransaction(
      identityStorage,
      'registerUser',
      { from: accountId, },
      identityContract.options.address,
    );
  }

  /**
   * confirms a claim; this can be done, it a claim has been issued for a subject and the subject
   * wants to confirms it
   *
   * @param      {string}         subject     account, that approves the claim
   * @param      {string}         claimName   name of the claim (full path)
   * @return     {Promise<void>}  resolved when done
   */
  public async confirmClaim(
      subject: string, claimName: string, issuer: string): Promise<void> {

    const identity = await this.options.executor.executeContractCall(
      this.contracts.storage,
      'users',
      subject
    );

    const issuerIdentity = await this.options.executor.executeContractCall(
      this.contracts.storage,
      'users',
      issuer
    );

    const identityContract = this.options.contractLoader.loadContract('OriginIdentity', identity);
    const sha3ClaimName = this.options.nameResolver.soliditySha3(claimName);
    const uint256ClaimName = new BigNumber(sha3ClaimName).toString(10);
    const sha3ClaimId = this.options.nameResolver.soliditySha3(issuerIdentity, uint256ClaimName);
    await this.options.executor.executeContractTransaction(
      identityContract,
      'approveClaim',
      { from: subject, },
      sha3ClaimId
    );
  }

  /**
   * delete a claim. This requires the issuer to have permissions for the parent claim (if claim
   * name seen as a path, the parent 'folder'). Subjects of a claim may only delete it, if they are
   * the issuer as well. If not, they can only react to it by confirming or rejecting the claim.
   *
   * @param      {string}         issuer     issuer of the claim; only the issuer can delete a claim
   * @param      {string}         claimName  name of the claim (full path)
   * @return     {Promise<void>}  resolved when done
   */
  public async deleteClaim(subject: string, claimName: string, issuer: string): Promise<void> {
    const identity = await this.options.executor.executeContractCall(
      this.contracts.storage,
      'users',
      subject
    );

    const issuerIdentity = await this.options.executor.executeContractCall(
      this.contracts.storage,
      'users',
      issuer
    );

    const identityContract = this.options.contractLoader.loadContract('OriginIdentity', identity);
    const sha3ClaimName = this.options.nameResolver.soliditySha3(claimName);
    const uint256ClaimName = new BigNumber(sha3ClaimName).toString(10);
    const sha3ClaimId = this.options.nameResolver.soliditySha3(issuerIdentity, uint256ClaimName);
    
    await this.options.executor.executeContractTransaction(
      identityContract,
      'removeClaim',
      { from: subject, },
      sha3ClaimId
    );
  }

  /**
   * gets claim information for a claim name
   *
   * @param      {string}        claimName  name (/path) of a claim
   * @return     {Promise<any>}  claim info, contains: issuer, name, selfIssuedState, selfIssuedValue,
   *                             status, subject, value
   */
  public async getClaims(claimName: string, accountId: string): Promise<any> {
    const identity = await this.options.executor.executeContractCall(
      this.contracts.storage,
      'users',
      accountId
    );

    if(!identity) {
      const msg = `trying to get claim ${claimName} with account ${accountId}, ` +
        `but the idendity for account ${accountId} not exists`;
      this.log(msg, 'error');
      throw new Error(msg);
    }


    const identityContract = this.options.contractLoader.loadContract('OriginIdentity', identity);
    const sha3ClaimName = this.options.nameResolver.soliditySha3(claimName);
    const uint256ClaimName = new BigNumber(sha3ClaimName).toString(10);
    const claimsForTopic = await this.options.executor.executeContractCall(
      identityContract,
      'getClaimIdsByTopic',
      uint256ClaimName
    );

    const claims = await Promise.all(claimsForTopic.map(async (claimId) => {
      const claimP = this.options.executor.executeContractCall(
        identityContract,
        'getClaim',
        claimId
      );
      const claimStatusP = this.options.executor.executeContractCall(
        identityContract,
        'isClaimApproved',
        claimId
      );
      let [claim, claimStatus] = await Promise.all([claimP, claimStatusP]);

      return {
        issuer: (<any>claim).issuer,
        name: claimName,
        status: claimStatus ? ClaimsStatus.Confirmed : ClaimsStatus.Issued,
        subject: accountId,
        value: (<any>claim).data,
        uri: (<any>claim).uri,
        signature: (<any>claim).signature,
      };
    }));

    return claims;
  }

  /**
   * sets or creates a claim; this requires the issuer to have permissions for the parent claim (if
   * claim name seen as a path, the parent 'folder')
   *
   * @param      {string}         issuer      issuer of the claim
   * @param      {string}         subject     subject of the claim and the owner of the claim node
   * @param      {string}         claimName   name of the claim (full path)
   * @param      {string}         claimValue  bytes32 hash of the claim value
   * @return     {Promise<void>}  resolved when done
   */
  public async setClaim(
      issuer: string, subject: string, claimName: string, claimValue?: string): Promise<void> {


    // get the identiy contract for the subject

    const targetIdentity = await this.options.executor.executeContractCall(
      this.contracts.storage,
      'users',
      subject
    );

    const sourceIdentity = await this.options.executor.executeContractCall(
      this.contracts.storage,
      'users',
      issuer
    );

    if(!targetIdentity) {
      const msg = `trying to set claim ${claimName} with account ${issuer}, ` +
        `but target idendity for account ${subject} not exists`;
      this.log(msg, 'error');
      throw new Error(msg);
    }


    const identityContract = this.options.contractLoader.loadContract('OriginIdentity', targetIdentity);
    
    const sha3ClaimName = this.options.nameResolver.soliditySha3(claimName);
    const uint256ClaimName = new BigNumber(sha3ClaimName).toString(10);
    const signedSignature = await this.options.executor.web3.eth.accounts.sign(
      this.options.nameResolver.soliditySha3(targetIdentity, uint256ClaimName).replace('0x', ''), 
      await this.options.accountStore.getPrivateKey(issuer)
    );

    await this.options.executor.executeContractTransaction(
      identityContract,
      'addClaim',
      { from: issuer, },
      uint256ClaimName,
      '1',
      sourceIdentity,
      signedSignature.signature,
      '0x00',
      ''
    );
  }

  private loadContracts(registry, resolver) {
    this.contracts = {
      registry: this.options.contractLoader.loadContract('ENS', registry),
      resolver: this.options.contractLoader.loadContract('ClaimsPublicResolver', resolver),
    };
  }
}
