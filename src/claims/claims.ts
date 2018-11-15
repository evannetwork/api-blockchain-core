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
import crypto = require('crypto');

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
  DfsInterface,
  Ipfs
} from '@evan.network/dbcp';

export enum ClaimsStatus {
  /**
   * issued by a non-issuer parent claim holder, self issued state is 0
   */
  Issued,
  /**
   * issued by a non-issuer parent claim holder, self issued state is 0
   */
  Confirmed
}


export interface ClaimsOptions extends LoggerOptions {
  contractLoader: ContractLoader;
  executor: Executor;
  nameResolver: NameResolver;
  accountStore: AccountStore;
  dfs: DfsInterface;
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
   * Creates a new identity for Account 
   *
   * @param      {string}  accountId  The account identifier
   * @return     {Promise<any>}       resolves when done
   */
  public async createIdentity(accountId: string): Promise<any> {
    // create Identity contract
    const identityContract = await this.options.executor.createContract(
      'OriginIdentity', [], { from: accountId, gas: 2000000, });

    const identityStorage = this.contracts.storage.options.address !== nullAddress ?
      this.options.contractLoader.loadContract('V00_UserRegistry', this.contracts.storage.options.address) : null;
    // register the new user in the registry
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
   * @param      {string}         subject    account, that approves the claim
   * @param      {string}         claimName  name of the claim (full path)
   * @param      {string}         issuer     The issuer which has signed the claim
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
   * @param      {string}         subject    the subject of the claim
   * @param      {string}         claimName  name of the claim (full path)
   * @param      {string}         issuer     issuer of the claim; only the issuer can delete a claim
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
   * gets claim informations for a claim name from a given account
   *
   * @param      {string}        claimName   name (/path) of a claim
   * @param      {string}        subject     the target subject
   * @param      {boolean}       isIdentity  optional indicates if the subject is already a identity
   * @return     {Promise<any>}  claim info array, contains: issuer, name, status, subject, data,
   *                             uri, signature, creationDate, valid
   */
  public async getClaims(claimName: string, subject: string, isIdentity?: boolean): Promise<any> {
    // get the target identity contract for the subject
    let identity = subject;
    if(!isIdentity) {
      identity = await this.options.executor.executeContractCall(
        this.contracts.storage,
        'users',
        subject
      );

      if(!identity) {
        const msg = `trying to get claim ${claimName} with account ${subject}, ` +
          `but the idendity for account ${subject} not exists`;
        this.log(msg, 'error');
        throw new Error(msg);
      }
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
      const claimCreationP = this.options.executor.executeContractCall(
        identityContract,
        'claimCreationDate',
        claimId
      );
      let [claim, claimStatus, creationDate] = await Promise.all([
        claimP,
        claimStatusP,
        claimCreationP
      ]);

      if(claim.issuer == nullAddress) {
        return false;
      }

      return {
        issuer: (<any>claim).issuer,
        name: claimName,
        status: claimStatus ? ClaimsStatus.Confirmed : ClaimsStatus.Issued,
        subject,
        data: (<any>claim).data,
        uri: (<any>claim).uri,
        signature: (<any>claim).signature,
        creationDate: creationDate,
        id: claimId,
        valid: await this.validateClaim(claimId, subject)
      };
    }));

    return claims.filter(function (el) {
      return el;
    });;
  }


  /**
   * validates a given claimId in case of integrity
   *
   * @param      {string}  claimId  The claim identifier
   * @param      {string}  subject  the subject of the claim
   * @return     {Promise<bool>}  resolves with true if the claim is valid, otherwise false
   */
  public async validateClaim(claimId: string, subject: string) {
    // get the target identiy contract for the subject
    const subjectIdentity = await this.options.executor.executeContractCall(
      this.contracts.storage,
      'users',
      subject
    );

    // check if target and source identity are existing
    if(!subjectIdentity) {
      const msg = `target idendity for account ${subject} not exists`;
      this.log(msg, 'error');
      throw new Error(msg);
    }

    const identityContract = this.options.contractLoader.loadContract('OriginIdentity', subjectIdentity);
    const claim = await this.options.executor.executeContractCall(
      identityContract,
      'getClaim',
      claimId
    );

    const dataHash = this.options.nameResolver.soliditySha3(subjectIdentity, claim.topic, claim.data).replace('0x', '');
    const recoveredAddress = this.options.executor.web3.eth.accounts.recover(dataHash, claim.signature);
    const issuerContract = this.options.contractLoader.loadContract('OriginIdentity', claim.issuer);
    const keyHasPurpose = await this.options.executor.executeContractCall(
      issuerContract,
      'keyHasPurpose',
      this.options.nameResolver.soliditySha3(recoveredAddress),
      '1'
    );
    return keyHasPurpose;
  }


  /**
   * validates a whole claim tree if the path is valid (called recursive)
   *
   * @param      {string}  claimLabel  The claim label
   * @param      {string}  subject     The subject of the claim
   * @param      {array}  treeArr     the result tree array
   * @return     {Promise<any>}  Array with all resolved claims for the tree
   */
  public async validateClaimTree(claimLabel: string, subject: string, treeArr = []) {
    const splittedClaimLabel = claimLabel.split('/');
    const claims = await this.getClaims(claimLabel, subject, true);
    // TODO: -> Add validation of more than one claim if there are more claims for the label
    if(claims.length > 0) {
      // check at the moment the first claim
      treeArr.push(claims[0]);
      if(splittedClaimLabel.length > 1) {
        splittedClaimLabel.pop();
        const subClaim = splittedClaimLabel.join('/');
        await this.validateClaimTree(subClaim, claims[0].issuer, treeArr);
      }
    } else {
      return treeArr;
    }
    return treeArr;
  }

  /**
   * checks if a account has already a identity contract
   *
   * @param      {string}        subject  the target subject
   * @return     {Promise<any>}  true if identity exists, otherwise false
   */
  public async identityAvailable(subject: string): Promise<any> {
    // get the target identity contract for the subject
    const identity = await this.options.executor.executeContractCall(
      this.contracts.storage,
      'users',
      subject
    );

    if(!identity) {
      return false;
    } else {
      return true;
    }

  }

  /**
   * sets or creates a claim to a given subject identity
   *
   * @param      {string}         issuer      issuer of the claim
   * @param      {string}         subject     subject of the claim and the owner of the claim node
   * @param      {string}         claimName   name of the claim (full path)
   * @param      {object}         claimValue  json object which will be stored in the claim
   * @return     {Promise<void>}  resolved when done
   */
  public async setClaim(
      issuer: string, subject: string, claimName: string, claimValue?: any): Promise<void> {

    // get the target identiy contract for the subject
    const targetIdentity = await this.options.executor.executeContractCall(
      this.contracts.storage,
      'users',
      subject
    );
    // get the issuer identiy contract
    const sourceIdentity = await this.options.executor.executeContractCall(
      this.contracts.storage,
      'users',
      issuer
    );
    // check if target and source identity are existing
    if(!targetIdentity) {
      const msg = `trying to set claim ${claimName} with account ${issuer}, ` +
        `but target idendity for account ${subject} not exists`;
      this.log(msg, 'error');
      throw new Error(msg);
    }


    const identityContract = this.options.contractLoader.loadContract('OriginIdentity', targetIdentity);
    // convert the claim name to a unit256
    const sha3ClaimName = this.options.nameResolver.soliditySha3(claimName);
    const uint256ClaimName = new BigNumber(sha3ClaimName).toString(10);

    let claimData = nullBytes32;
    let claimDataUrl = '';
    if(claimValue) {
      try{
        const stringified = JSON.stringify(claimValue);
        const stateMd5 = crypto.createHash('md5').update(stringified).digest('hex');
        claimData = await this.options.dfs.add(stateMd5, Buffer.from(stringified));
        claimDataUrl = `https://ipfs.evan.network/ipfs/${Ipfs.bytes32ToIpfsHash(claimData)}`;
      } catch(e) {
        const msg = `error parsing claimValue -> ${e.message}`;
        this.log(msg, 'info');
      }
    }

    // create the signature for the claim
    const signedSignature = await this.options.executor.web3.eth.accounts.sign(
      this.options.nameResolver.soliditySha3(targetIdentity, uint256ClaimName, claimData).replace('0x', ''), 
      '0x' + await this.options.accountStore.getPrivateKey(issuer)
    );



    // add the claim to the target identity
    await this.options.executor.executeContractTransaction(
      identityContract,
      'addClaim',
      { from: issuer, },
      uint256ClaimName,
      '1',
      sourceIdentity,
      signedSignature.signature,
      claimData,
      claimDataUrl
    );
  }

  /**
   * Gets the identity contract for a given accountid.
   *
   * @param      {string}  subject  the subject for the identity contract
   * @return     {Promise<any>}  the identity contract instance 
   */
  public async getIdentityForAccount(subject: string) {
    // get the target identity contract for the subject
    const targetIdentity = await this.options.executor.executeContractCall(
      this.contracts.storage,
      'users',
      subject
    );
    // check if target identity are existing
    if(!targetIdentity) {
      const msg = `target identity for account ${subject} not exists`;
      this.log(msg, 'error');
      throw new Error(msg);
    }

    return this.options.contractLoader.loadContract('OriginIdentity', targetIdentity);
  }

  private loadContracts(storage) {
    this.contracts = {
      storage: this.options.contractLoader.loadContract('V00_UserRegistry', storage),
    };
  }
}
