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
import crypto = require('crypto');
import { BigNumber } from 'bignumber.js';
import {
  AccountStore,
  ContractLoader,
  Description,
  EventHub,
  Executor,
  Logger,
  LoggerOptions,
  NameResolver,
  DfsInterface
} from '@evan.network/dbcp';
import { Ipfs } from '../dfs/ipfs';


const nullBytes32 = '0x0000000000000000000000000000000000000000000000000000000000000000';
const nullAddress = '0x0000000000000000000000000000000000000000';

export enum ClaimsStatus {
  /**
   * issued by a non-issuer parent claim holder, self issued state is 0
   */
  Issued,
  /**
   * issued by a non-issuer parent claim holder, self issued state is 0
   */
  Confirmed,
  /**
   * claim rejected status
   */
  Rejected
}


export interface ClaimsOptions extends LoggerOptions {
  accountStore: AccountStore;
  config: any;
  contractLoader: ContractLoader;
  description: Description;
  dfs: DfsInterface;
  executor: Executor;
  nameResolver: NameResolver;
  storage?: string;
}


/**
 * Claims helper
 *
 * @class      Claims (name)
 */
export class Claims extends Logger {
  cachedIdentities: any = { };
  contracts: any = { };
  encodingEnvelope = 'binary';
  options: ClaimsOptions;
  subjectTypes: any = { };

  constructor(options: ClaimsOptions) {
    super(options);
    this.options = options;

    if (options.storage) {
      this.contracts.storage = this.options.contractLoader.loadContract('V00_UserRegistry',
        options.storage);
    }
  }

  /**
   * confirms a claim; this can be done, if a claim has been issued for a subject and the subject
   * wants to confirm it
   *
   * @param      {string}         accountId  account, that performs the action
   * @param      {string}         subject    claim subject
   * @param      {string}         claimId    id of a claim to confirm
   * @return     {Promise<void>}  resolved when done
   */
  public async confirmClaim(
      accountId: string, subject: string, claimId: string): Promise<void> {
    await this.executeOnIdentity(
      subject,
      'approveClaim',
      { from: accountId },
      claimId,
    );
  }

  /**
   * Creates a new identity for account or contract and registers them on the storage. Returned
   * identity is either a 40B contract address (for account identities) or a 32B idenity hash
   * contract identities
   *
   * @param      {string}           accountId   The account identifier
   * @param      {<type>}           contractId  The contract identifier
   * @return     {Promise<string>}  new identity
   */
  public async createIdentity(accountId: string, contractId?: string): Promise<string> {
    let identity;
    if (!contractId) {
      // create Identity contract
      await this.ensureStorage();
      const identityContract = await this.options.executor.createContract(
        'OriginIdentity', [], { from: accountId, gas: 3000000, });

      const identityStorage = this.contracts.storage.options.address !== nullAddress ?
        this.options.contractLoader.loadContract('V00_UserRegistry', this.contracts.storage.options.address) : null;
      // register the new user in the registry
      await this.options.executor.executeContractTransaction(
        identityStorage,
        'registerUser',
        { from: accountId, },
        identityContract.options.address,
      );
      identity = identityContract.options.address;
    } else {
      identity = await this.options.executor.executeContractTransaction(
        this.contracts.registry,
        'createIdentity',
        {
          from: accountId,
          // event IdentityCreated(bytes32 indexed identity, address indexed owner);
          event: { target: 'IdentityHolder', eventName: 'IdentityCreated' },
          getEventResult: (_, args) => args.identity,
        },
      );
      const description = await this.options.description.getDescription(contractId, accountId);
      description.public.identity = identity;
      await this.options.description.setDescriptionToContract(contractId, description, accountId);
    }
    return identity;
  }

  /**
   * delete a claim. This requires the accountId to have permissions for the parent claim (if claim
   * name seen as a path, the parent 'folder'). Subjects of a claim may only delete it, if they are
   * the issuer as well. If not, they can only react to it by confirming or rejecting the claim.
   *
   * @param      {string}         accountId  account, that performs the action
   * @param      {string}         subject    the subject of the claim
   * @param      {string}         claimId    id of a claim to delete
   * @return     {Promise<void>}  resolved when done
   */
  public async deleteClaim(
      accountId: string, subject: string, claimId: string): Promise<void> {
    await this.executeOnIdentity(
      subject,
      'removeClaim',
      { from: accountId },
      claimId,
    );
  }

  /**
   * gets claim information for a claim name from a given account; results has the following
   * properties: creationBlock, creationDate, data, description, expirationDate, id, issuer, name,
   * signature, status, subject, topic, uri, valid
   *
   * @param      {string}        subject     subject of the claims
   * @param      {string}        claimName   name (/path) of a claim
   * @param      {boolean}       isIdentity  (optional) indicates if the subject is already an identity
   * @return     {Promise<any[]>}  claim info array
   */
  public async getClaims(subject: string, claimName: string, isIdentity?: boolean): Promise<any[]> {
    const sha3ClaimName = this.options.nameResolver.soliditySha3(claimName);
    const uint256ClaimName = new BigNumber(sha3ClaimName).toString(10);

    const claimsForTopic = await this.callOnIdentity(
      subject,
      isIdentity,
      'getClaimIdsByTopic',
      uint256ClaimName,
    );

    const claims = await Promise.all(claimsForTopic.map(async (claimId) => {
      const claimDetails = [
        'getClaim',
        'isClaimApproved',
        'claimCreationBlock',
        'claimCreationDate',
        'getClaimExpirationDate',
        'isClaimRejected',
      ].map(fun => this.callOnIdentity(subject, isIdentity, fun, claimId));
      claimDetails.push((async () => {
        const descriptionNodeHash = await this.callOnIdentity(subject, isIdentity, 'getClaimDescription', claimId);
        let parsedDescription;
        if (descriptionNodeHash === nullBytes32) {
          return null;
        } else {
          const resolverAddress = await this.options.executor.executeContractCall(
            this.options.nameResolver.ensContract, 'resolver', descriptionNodeHash);
          if (resolverAddress === nullAddress) {
            return null;
          } else {
            const resolver =
              this.options.contractLoader.loadContract('PublicResolver', resolverAddress);
            const descriptionHash =
              await this.options.executor.executeContractCall(resolver, 'content', descriptionNodeHash);
            const envelope = (await this.options.dfs.get(descriptionHash)).toString(this.encodingEnvelope);
            return JSON.parse(envelope).public;
          }
        }
      })());

      let [claim, claimStatus, creationBlock, creationDate, expirationDate, rejected, description] =
        await Promise.all(claimDetails);

      if (claim.issuer === nullAddress) {
        return false;
      }

      let claimFlag = claimStatus ? ClaimsStatus.Confirmed : ClaimsStatus.Issued;
      let rejectReason;
      if (rejected.rejected) {
        claimFlag = ClaimsStatus.Rejected;
      }

      if (rejected.rejectReason !== nullBytes32) {
        try {
          const ipfsResponse = await this.options.dfs.get(rejected.rejectReason);
          rejectReason = JSON.parse(ipfsResponse.toString());
        } catch (e) {
          const msg = `error parsing rejectReason -> ${e.message}`;
          this.log(msg, 'info');
        }
      }

      return {
        creationBlock,
        creationDate,
        data: (<any>claim).data,
        description,
        expirationDate: expirationDate == 0 ? null : expirationDate,
        id: claimId,
        issuer: (<any>claim).issuer,
        name: claimName,
        rejectReason,
        signature: (<any>claim).signature,
        status: claimFlag,
        subject,
        topic: claim.topic,
        uri: (<any>claim).uri,
        valid: await this.validateClaim(subject, claimId, isIdentity)
      };
    }));

    // drop null values
    return claims.filter(el => el);
  }

  /**
   * gets the identity contract for a given account id or contract
   *
   * @param      {string}        subject  the subject for the identity contract
   * @return     {Promise<any>}  the identity contract instance
   */
  public async getIdentityForAccount(subject: string): Promise<any> {
    if (!this.cachedIdentities[subject]) {
      await this.ensureStorage();

      // get the target identity contract for the subject
      const targetIdentity = await this.options.executor.executeContractCall(
        this.contracts.storage,
        'users',
        subject,
      );
      // check if target identity exists
      if (subject === nullAddress) {
        const msg = `target identity for account ${subject} does not exist`;
        this.log(msg, 'error');
        throw new Error(msg);
      }

      this.cachedIdentities[subject] = this.options.contractLoader.loadContract('OriginIdentity', targetIdentity);
    }
    return this.cachedIdentities[subject];
  }

  /**
   * checks if a account has already a identity contract
   *
   * @param      {string}            subject  the target subject
   * @return     {Promise<boolean>}  true if identity exists, otherwise false
   */
  public async identityAvailable(subject: string): Promise<any> {
    await this.ensureStorage();

    // get the target identity contract for the subject
    const identity = await this.options.executor.executeContractCall(
      this.contracts.storage,
      'users',
      subject
    );

    if (!identity || identity === nullAddress) {
      return false;
    } else {
      return true;
    }
  }

  /**
   * reject a Claim. This claim will be marked as rejected but not deleted. This is important for
   * tracking reasons. You can also optionally add a reject reason as JSON object to track
   * additional informations about the rejection. Issuer and Subject can reject a special claim.
   *
   * @param      {string}         accountId     account, that performs the action
   * @param      {string}         subject       account, that rejects the claim
   * @param      {string}         claimId       id of a claim to reject
   * @param      {any}            rejectReason  (optional) rejectReason object
   * @return     {Promise<void>}  resolved when done
   */
  public async rejectClaim(
      accountId: string, subject: string, claimId: string, rejectReason?: any): Promise<void> {
    if (rejectReason) {
      try {
        const stringified = JSON.stringify(rejectReason);
        const stateMd5 = crypto.createHash('md5').update(stringified).digest('hex');
        rejectReason = await this.options.dfs.add(stateMd5, Buffer.from(stringified));
      } catch (e) {
        const msg = `error parsing claimValue -> ${e.message}`;
        this.log(msg, 'info');
      }
    } else {
      rejectReason = nullBytes32;
    }

    await this.executeOnIdentity(
      subject,
      'rejectClaim',
      { from: accountId },
      claimId,
      rejectReason,
    );
  }

  /**
   * Sets or creates a claim; this requires the issuer to have permissions for the parent claim (if
   * claim name seen as a path, the parent 'folder').
   *
   * @param      {string}           issuer             issuer of the claim
   * @param      {string}           subject            subject of the claim and the owner of the
   *                                                   claim node
   * @param      {string}           claimName          name of the claim (full path)
   * @param      {number}           expirationDate     expiration date, for the claim, defaults to
   *                                                   `0` (does not expire)
   * @param      {object}           claimValue         json object which will be stored in the claim
   * @param      {string}           descriptionDomain  domain of the claim, this is a subdomain
   *                                                   under 'claims.evan', so passing 'example'
   *                                                   will link claims description to
   *                                                   'example.claims.evan'
   * @return     {Promise<string>}  claimId
   */
  public async setClaim(
      issuer: string,
      subject: string,
      claimName: string,
      expirationDate = 0 ,
      claimValue?: any,
      descriptionDomain?: string,
      ): Promise<string> {
    await this.ensureStorage();
    let targetIdentity;
    const subjectType = await this.getSubjectType(subject);
    if (subjectType === 'contract') {
      targetIdentity = (await this.options.description.getDescription(subject, issuer)).public.identity;
    } else {
      targetIdentity = await this.options.executor.executeContractCall(
        this.contracts.storage,
        'users',
        subject
      );
    }
    // get the issuer identity contract
    const sourceIdentity = await this.options.executor.executeContractCall(
      this.contracts.storage,
      'users',
      issuer
    );
    // check if target and source identity are existing
    if (!targetIdentity || targetIdentity === nullAddress) {
      const msg = `trying to set claim ${claimName} with account ${issuer}, ` +
        `but target identity for account ${subject} does not exist`;
      this.log(msg, 'error');
      throw new Error(msg);
    }

    // convert the claim name to a uint256
    const sha3ClaimName = this.options.nameResolver.soliditySha3(claimName);
    const uint256ClaimName = new BigNumber(sha3ClaimName).toString(10);

    let claimData = nullBytes32;
    let claimDataUrl = '';
    if (claimValue) {
      try {
        const stringified = JSON.stringify(claimValue);
        const stateMd5 = crypto.createHash('md5').update(stringified).digest('hex');
        claimData = await this.options.dfs.add(stateMd5, Buffer.from(stringified));
        claimDataUrl = `https://ipfs.evan.network/ipfs/${Ipfs.bytes32ToIpfsHash(claimData)}`;
      } catch (e) {
        const msg = `error parsing claimValue -> ${e.message}`;
        this.log(msg, 'info');
      }
    }

    // create the signature for the claim
    const signedSignature = await this.options.executor.web3.eth.accounts.sign(
      this.options.nameResolver.soliditySha3(targetIdentity, uint256ClaimName, claimData).replace('0x', ''),
      '0x' + await this.options.accountStore.getPrivateKey(issuer)
    );

    // build description hash if required
    let ensFullNodeHash;
    if (descriptionDomain) {
      ensFullNodeHash = this.options.nameResolver.namehash(
        this.getFullDescriptionDomainWithHash(claimName, descriptionDomain));
    }

    // add the claim to the target identity
    return await this.executeOnIdentity(
      subject,
      'addClaimWithMetadata',
      {
        from: issuer,
        event: {
          target: subjectType === 'contract' ? 'ClaimsRegistryLibrary' : 'ClaimHolderLibrary',
          eventName: 'ClaimAdded',
        },
        getEventResult: (_, args) => { return args.claimId; },
      },
      uint256ClaimName,
      '1',
      sourceIdentity,
      signedSignature.signature,
      claimData,
      claimDataUrl,
      expirationDate || 0,
      ensFullNodeHash || nullBytes32,
    );
  }

  /**
   * set description for a claim under a domain owned by given account
   *
   * @param      {string}         accountId    accountId, that performs the description update
   * @param      {string}         topic        name of the claim (full path) to set description
   * @param      {string}         domain       domain of the claim, this is a subdomain under
   *                                           'claims.evan', so passing `example` will link claims
   *                                           description to 'example.claims.evan'
   * @param      {any}            description  description of the claim; can be an Envelope but
   *                                           only public properties are used
   * @return     {Promise<void>}  resolved when done
   */
  public async setClaimDescription(
      accountId: string, topic: string, domain: string, description: any): Promise<void> {
    let toSet = JSON.parse(JSON.stringify(description));
    if (!toSet.hasOwnProperty('public')) {
      toSet = { public: toSet };
    }
    const domainWithHash = this.getFullDescriptionDomainWithHash(topic, domain);
    await this.options.description.setDescription(domainWithHash, toSet, accountId);
  }

  /**
   * validates a given claimId in case of integrity
   *
   * @param      {string}            subject     the subject of the claim
   * @param      {string}            claimId     claim identifier
   * @param      {boolean}           isIdentity  optional indicates if the subject is already an
   *                                             identity
   * @return     {Promise<boolean>}  resolves with true if the claim is valid, otherwise false
   */
  public async validateClaim(
      subject: string, claimId: string, isIdentity?: boolean): Promise<boolean> {
    await this.ensureStorage();

    let subjectIdentity = isIdentity ? subject : await this.getIdentityForAccount(subject);
    if (subjectIdentity.options) {
      subjectIdentity = subjectIdentity.options.address;
    }

    const claim = await this.callOnIdentity(
      subject,
      isIdentity,
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
   * validates a whole claim tree if the path is valid (called recursively)
   *
   * @param      {string}          subject     subject of the claim and the owner of the claim node
   * @param      {string}          claimLabel  claim topic of a claim to build the tree for
   * @param      {array}           treeArr     (optional) result tree array, used for recursion
   * @return     {Promise<any[]>}  Array with all resolved claims for the tree
   */
  public async validateClaimTree(subject: string, claimLabel: string, treeArr = []) {
    const splittedClaimLabel = claimLabel.split('/');
    const claims = await this.getClaims(subject, claimLabel, true);
    // TODO: -> Add validation of more than one claim if there are more claims for the label
    if (claims.length > 0) {
      // check at the moment the first claim
      treeArr.push(claims[0]);
      if (splittedClaimLabel.length > 1) {
        splittedClaimLabel.pop();
        const subClaim = splittedClaimLabel.join('/');
        await this.validateClaimTree(claims[0].issuer, subClaim, treeArr);
      }
    } else {
      return treeArr;
    }
    return treeArr;
  }

  /**
   * execute contract call on identity, checks if account or contract identity is used and if given
   * subject is alraedy an identity
   *
   * @param      {string}        subject     account/contract with identity or an identity of it
   * @param      {boolean}       isIdentity  true if given subject is an identity
   * @param      {string}        fun         function to call
   * @param      {any[]}         args        arguments for function (exluding the identity (for
   *                                         ClaimsRegistry functions))
   * @return     {Promise<any>}  result of called function
   */
  private async callOnIdentity(subject: string, isIdentity: boolean, fun: string, ...args): Promise<any> {
    const subjectType = await this.getSubjectType(subject, isIdentity);
    if (subjectType === 'contract') {
      // contract identity
      return this.options.executor.executeContractCall(
        this.contracts.registry,
        fun,
        isIdentity ? subject : await this.getIdentityForAccount(subject),
        ...args,
      );
    } else if (subjectType === 'account') {
      // account identity
      return this.options.executor.executeContractCall(
        isIdentity ?
          this.options.contractLoader.loadContract('OriginIdentity', subject) :
          await this.getIdentityForAccount(subject),
        fun,
        ...args,
      );
    }
  }

  /**
   * execute contract transaction on identity, checks if account or contract identity is used and if
   * given subject is alraedy an identity
   *
   * @param      {string}        subject  account/contract with identity or an identity of it
   * @param      {string}        fun      function to call
   * @param      {any}           options  options for transaction
   * @param      {any[]}         args     arguments for function (exluding the identity (for
   *                                      ClaimsRegistry functions))
   * @return     {Promise<any>}  result of called function
   */
  private async executeOnIdentity(subject: string, fun: string, options: any, ...args): Promise<any> {
    const subjectType = await this.getSubjectType(subject, false);
    if (subjectType === 'contract') {
      // contract identity
      return this.options.executor.executeContractTransaction(
        this.contracts.registry,
        fun,
        options,
        await this.getIdentityForAccount(subject),
        ...args,
      );
    } else if (subjectType === 'account') {
      // account identity
      return this.options.executor.executeContractTransaction(
        await this.getIdentityForAccount(subject),
        fun,
        options,
        ...args,
      );
    }
  }

  /**
   * Checks if a storage was initialized before, if not, load the default one.
   *
   * @return     {Promise<void>}  resolved when storage exists or storage was loaded
   */
  private async ensureStorage() {
    if (!this.contracts.storage) {
      const storageAddress = await this.options.nameResolver
        .getAddress(`identities.${ this.options.nameResolver.config.labels.ensRoot }`);

      this.contracts.storage = this.options.contractLoader.loadContract('V00_UserRegistry',
        storageAddress);
    }
  }

  /**
   * checks if given given subject belongs to an account to a contract
   *
   * @param      {string}           subject     claim subject
   * @param      {boolean}          isIdentity  true if given subject is an identity
   * @return     {Promise<string>}  resolves to 'account' or 'contract'
   */
  private async getSubjectType(subject: string, isIdentity?: boolean): Promise<string> {
    if (isIdentity && subject.length === 66) {
      return 'contract';
    } else if (isIdentity && subject.length === 42) {
      return 'account';
    } else if (!this.subjectTypes[subject]) {
      const targetIdentity = await this.options.executor.executeContractCall(
        this.contracts.storage,
        'users',
        subject,
      );
      if (targetIdentity !== nullAddress) {
        this.subjectTypes[subject] = 'account';
      } else {
        const description = await this.options.description.getDescription(subject, null);
        if (description && description.public && description.public.identity) {
          this.subjectTypes[subject] = 'contract';
          this.cachedIdentities[subject] = description.public.identity;
        } else {
          throw new Error(`could not find identity for "${subject}"`);
        }
      }
    }
    return this.subjectTypes[subject];
  }

  /**
   * returns full domain for description
   *
   * @param      {string}  topic              claim topic
   * @param      {string}  descriptionDomain  domain of description
   * @return     {string}  full domain
   */
  private getFullDescriptionDomainWithHash(topic: string, descriptionDomain: string): string {
    return `${this.options.nameResolver.soliditySha3(topic).substr(2)}.${descriptionDomain}.claims.evan`;
  }
}
