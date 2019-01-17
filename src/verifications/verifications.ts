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

export enum VerificationsStatus {
  /**
   * issued by a non-issuer parent verification holder, self issued state is 0
   */
  Issued,
  /**
   * issued by a non-issuer parent verification holder, self issued state is 0
   */
  Confirmed,
  /**
   * verification rejected status
   */
  Rejected
}


export interface VerificationsOptions extends LoggerOptions {
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
 * Verifications helper
 *
 * @class      Verifications (name)
 */
export class Verifications extends Logger {
  cachedIdentities: any = { };
  contracts: any = { };
  encodingEnvelope = 'binary';
  options: VerificationsOptions;
  subjectTypes: any = { };

  constructor(options: VerificationsOptions) {
    super(options);
    this.options = options;

    if (options.storage) {
      this.contracts.storage = this.options.contractLoader.loadContract('V00_UserRegistry',
        options.storage);
    }
  }

  /**
   * confirms a verification; this can be done, if a verification has been issued for a subject and the subject
   * wants to confirm it
   *
   * @param      {string}         accountId  account, that performs the action
   * @param      {string}         subject    verification subject
   * @param      {string}         verificationId    id of a verification to confirm
   * @return     {Promise<void>}  resolved when done
   */
  public async confirmVerification(
      accountId: string, subject: string, verificationId: string): Promise<void> {
    await this.executeOnIdentity(
      subject,
      'approveVerification',
      { from: accountId },
      verificationId,
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
        'VerificationHolder', [], { from: accountId, gas: 3000000, });

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
      // create identity hash from registry
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
      // write identity to description
      const description = await this.options.description.getDescription(contractId, accountId);
      description.public.identity = identity;
      await this.options.description.setDescriptionToContract(contractId, description, accountId);
      // write identity to contract
      await this.options.executor.executeContractTransaction(
        this.contracts.registry,
        'linkIdentity',
        { from: accountId },
        identity,
        contractId,
      );
    }
    return identity;
  }

  /**
   * delete a verification. This requires the accountId to have permissions for the parent verification (if verification
   * name seen as a path, the parent 'folder'). Subjects of a verification may only delete it, if they are
   * the issuer as well. If not, they can only react to it by confirming or rejecting the verification.
   *
   * @param      {string}         accountId  account, that performs the action
   * @param      {string}         subject    the subject of the verification
   * @param      {string}         verificationId    id of a verification to delete
   * @return     {Promise<void>}  resolved when done
   */
  public async deleteVerification(
      accountId: string, subject: string, verificationId: string): Promise<void> {
    await this.executeOnIdentity(
      subject,
      'removeVerification',
      { from: accountId },
      verificationId,
    );
  }

  /**
   * gets verification information for a verification name from a given account; results has the following
   * properties: creationBlock, creationDate, data, description, expirationDate, id, issuer, name,
   * signature, status, subject, topic, uri, valid
   *
   * @param      {string}        subject     subject of the verifications
   * @param      {string}        verificationName   name (/path) of a verification
   * @param      {boolean}       isIdentity  (optional) indicates if the subject is already an identity
   * @return     {Promise<any[]>}  verification info array
   */
  public async getVerifications(subject: string, verificationName: string, isIdentity?: boolean): Promise<any[]> {
    const sha3VerificationName = this.options.nameResolver.soliditySha3(verificationName);
    const uint256VerificationName = new BigNumber(sha3VerificationName).toString(10);

    const verificationsForTopic = await this.callOnIdentity(
      subject,
      isIdentity,
      'getVerificationIdsByTopic',
      uint256VerificationName,
    );

    const verifications = await Promise.all(verificationsForTopic.map(async (verificationId) => {
      const verificationDetails = [
        'getVerification',
        'isVerificationApproved',
        'verificationCreationBlock',
        'verificationCreationDate',
        'getVerificationExpirationDate',
        'isVerificationRejected',
      ].map(fun => this.callOnIdentity(subject, isIdentity, fun, verificationId));
      verificationDetails.push((async () => {
        const descriptionNodeHash = await this.callOnIdentity(subject, isIdentity, 'getVerificationDescription', verificationId);
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

      let [verification, verificationStatus, creationBlock, creationDate, expirationDate, rejected, description] =
        await Promise.all(verificationDetails);

      if (verification.issuer === nullAddress) {
        return false;
      }

      let verificationFlag = verificationStatus ? VerificationsStatus.Confirmed : VerificationsStatus.Issued;
      let rejectReason;
      if (rejected.rejected) {
        verificationFlag = VerificationsStatus.Rejected;
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
        data: (<any>verification).data,
        description,
        expirationDate: expirationDate == 0 ? null : expirationDate,
        id: verificationId,
        issuer: (<any>verification).issuer,
        name: verificationName,
        rejectReason,
        signature: (<any>verification).signature,
        status: verificationFlag,
        subject,
        topic: verification.topic,
        uri: (<any>verification).uri,
        valid: await this.validateVerification(subject, verificationId, isIdentity)
      };
    }));

    // drop null values
    return verifications.filter(el => el);
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
      if (targetIdentity !== nullAddress) {
        this.subjectTypes[subject] = 'account';
        this.cachedIdentities[subject] = this.options.contractLoader.loadContract('VerificationHolder', targetIdentity);
      } else {
        const description = await this.options.description.getDescription(subject, null);
        if (description && description.public && description.public.identity) {
          // we got an identity from description, now check, that contract id matches linked address
          const linked = await this.options.executor.executeContractCall(
            this.contracts.registry, 'getLink', description.public.identity);
          if (linked !== subject) {
            const msg = `subject description of "${subject}" points to identity ` +
              `"${description.public.identity}", but this identity is linked to address "${linked}"`;
            this.log(msg, 'error');
            throw new Error(msg);
          }
          this.subjectTypes[subject] = 'contract';
          this.cachedIdentities[subject] = description.public.identity;
        } else {
          const msg = `could not find identity for "${subject}"`;
          this.log(msg, 'error');
          throw new Error(msg);
        }

      }
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
   * reject a Verification. This verification will be marked as rejected but not deleted. This is important for
   * tracking reasons. You can also optionally add a reject reason as JSON object to track
   * additional informations about the rejection. Issuer and Subject can reject a special verification.
   *
   * @param      {string}         accountId     account, that performs the action
   * @param      {string}         subject       account, that rejects the verification
   * @param      {string}         verificationId       id of a verification to reject
   * @param      {any}            rejectReason  (optional) rejectReason object
   * @return     {Promise<void>}  resolved when done
   */
  public async rejectVerification(
      accountId: string, subject: string, verificationId: string, rejectReason?: any): Promise<void> {
    if (rejectReason) {
      try {
        const stringified = JSON.stringify(rejectReason);
        const stateMd5 = crypto.createHash('md5').update(stringified).digest('hex');
        rejectReason = await this.options.dfs.add(stateMd5, Buffer.from(stringified));
      } catch (e) {
        const msg = `error parsing verificationValue -> ${e.message}`;
        this.log(msg, 'info');
      }
    } else {
      rejectReason = nullBytes32;
    }

    await this.executeOnIdentity(
      subject,
      'rejectVerification',
      { from: accountId },
      verificationId,
      rejectReason,
    );
  }

  /**
   * Sets or creates a verification; this requires the issuer to have permissions for the parent verification (if
   * verification name seen as a path, the parent 'folder').
   *
   * @param      {string}           issuer             issuer of the verification
   * @param      {string}           subject            subject of the verification and the owner of the
   *                                                   verification node
   * @param      {string}           verificationName          name of the verification (full path)
   * @param      {number}           expirationDate     expiration date, for the verification, defaults to
   *                                                   `0` (does not expire)
   * @param      {object}           verificationValue         json object which will be stored in the verification
   * @param      {string}           descriptionDomain  domain of the verification, this is a subdomain
   *                                                   under 'verifications.evan', so passing 'example'
   *                                                   will link verifications description to
   *                                                   'example.verifications.evan'
   * @return     {Promise<string>}  verificationId
   */
  public async setVerification(
      issuer: string,
      subject: string,
      verificationName: string,
      expirationDate = 0 ,
      verificationValue?: any,
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
      const msg = `trying to set verification ${verificationName} with account ${issuer}, ` +
        `but target identity for account ${subject} does not exist`;
      this.log(msg, 'error');
      throw new Error(msg);
    }

    // convert the verification name to a uint256
    const sha3VerificationName = this.options.nameResolver.soliditySha3(verificationName);
    const uint256VerificationName = new BigNumber(sha3VerificationName).toString(10);

    let verificationData = nullBytes32;
    let verificationDataUrl = '';
    if (verificationValue) {
      try {
        const stringified = JSON.stringify(verificationValue);
        const stateMd5 = crypto.createHash('md5').update(stringified).digest('hex');
        verificationData = await this.options.dfs.add(stateMd5, Buffer.from(stringified));
        verificationDataUrl = `https://ipfs.evan.network/ipfs/${Ipfs.bytes32ToIpfsHash(verificationData)}`;
      } catch (e) {
        const msg = `error parsing verificationValue -> ${e.message}`;
        this.log(msg, 'info');
      }
    }

    // create the signature for the verification
    const signedSignature = await this.options.executor.web3.eth.accounts.sign(
      this.options.nameResolver.soliditySha3(targetIdentity, uint256VerificationName, verificationData).replace('0x', ''),
      '0x' + await this.options.accountStore.getPrivateKey(issuer)
    );

    // build description hash if required
    let ensFullNodeHash;
    if (descriptionDomain) {
      ensFullNodeHash = this.options.nameResolver.namehash(
        this.getFullDescriptionDomainWithHash(verificationName, descriptionDomain));
    }

    // add the verification to the target identity
    return await this.executeOnIdentity(
      subject,
      'addVerificationWithMetadata',
      {
        from: issuer,
        event: {
          target: subjectType === 'contract' ? 'VerificationsRegistryLibrary' : 'VerificationHolderLibrary',
          eventName: 'VerificationAdded',
        },
        getEventResult: (_, args) => { return args.verificationId; },
      },
      uint256VerificationName,
      '1',
      sourceIdentity,
      signedSignature.signature,
      verificationData,
      verificationDataUrl,
      expirationDate || 0,
      ensFullNodeHash || nullBytes32,
    );
  }

  /**
   * set description for a verification under a domain owned by given account
   *
   * @param      {string}         accountId    accountId, that performs the description update
   * @param      {string}         topic        name of the verification (full path) to set description
   * @param      {string}         domain       domain of the verification, this is a subdomain under
   *                                           'verifications.evan', so passing `example` will link verifications
   *                                           description to 'example.verifications.evan'
   * @param      {any}            description  description of the verification; can be an Envelope but
   *                                           only public properties are used
   * @return     {Promise<void>}  resolved when done
   */
  public async setVerificationDescription(
      accountId: string, topic: string, domain: string, description: any): Promise<void> {
    let toSet = JSON.parse(JSON.stringify(description));
    if (!toSet.hasOwnProperty('public')) {
      toSet = { public: toSet };
    }
    const domainWithHash = this.getFullDescriptionDomainWithHash(topic, domain);
    await this.options.description.setDescription(domainWithHash, toSet, accountId);
  }

  /**
   * validates a given verificationId in case of integrity
   *
   * @param      {string}            subject     the subject of the verification
   * @param      {string}            verificationId     verification identifier
   * @param      {boolean}           isIdentity  optional indicates if the subject is already an
   *                                             identity
   * @return     {Promise<boolean>}  resolves with true if the verification is valid, otherwise false
   */
  public async validateVerification(
      subject: string, verificationId: string, isIdentity?: boolean): Promise<boolean> {
    await this.ensureStorage();

    let subjectIdentity = isIdentity ? subject : await this.getIdentityForAccount(subject);
    if (subjectIdentity.options) {
      subjectIdentity = subjectIdentity.options.address;
    }

    const verification = await this.callOnIdentity(
      subject,
      isIdentity,
      'getVerification',
      verificationId
    );

    const dataHash = this.options.nameResolver.soliditySha3(subjectIdentity, verification.topic, verification.data).replace('0x', '');
    const recoveredAddress = this.options.executor.web3.eth.accounts.recover(dataHash, verification.signature);
    const issuerContract = this.options.contractLoader.loadContract('VerificationHolder', verification.issuer);
    const keyHasPurpose = await this.options.executor.executeContractCall(
      issuerContract,
      'keyHasPurpose',
      this.options.nameResolver.soliditySha3(recoveredAddress),
      '1'
    );
    return keyHasPurpose;
  }

  /**
   * validates a whole verification tree if the path is valid (called recursively)
   *
   * @param      {string}          subject     subject of the verification and the owner of the verification node
   * @param      {string}          verificationLabel  verification topic of a verification to build the tree for
   * @param      {array}           treeArr     (optional) result tree array, used for recursion
   * @return     {Promise<any[]>}  Array with all resolved verifications for the tree
   */
  public async validateVerificationTree(subject: string, verificationLabel: string, treeArr = []) {
    const splittedVerificationLabel = verificationLabel.split('/');
    const verifications = await this.getVerifications(subject, verificationLabel, true);
    // TODO: -> Add validation of more than one verification if there are more verifications for the label
    if (verifications.length > 0) {
      // check at the moment the first verification
      treeArr.push(verifications[0]);
      if (splittedVerificationLabel.length > 1) {
        splittedVerificationLabel.pop();
        const subVerification = splittedVerificationLabel.join('/');
        await this.validateVerificationTree(verifications[0].issuer, subVerification, treeArr);
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
   *                                         VerificationsRegistry functions))
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
          this.options.contractLoader.loadContract('VerificationHolder', subject) :
          await this.getIdentityForAccount(subject),
        fun,
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
   * execute contract transaction on identity, checks if account or contract identity is used and if
   * given subject is alraedy an identity
   *
   * @param      {string}        subject  account/contract with identity or an identity of it
   * @param      {string}        fun      function to call
   * @param      {any}           options  options for transaction
   * @param      {any[]}         args     arguments for function (exluding the identity (for
   *                                      VerificationsRegistry functions))
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
      const targetIdentity = await this.getIdentityForAccount(subject);
      const userIdentity = this.options.contractLoader.loadContract(
        'VerificationHolder',
        targetIdentity.options.address
      );

      // get encoded abi for passing it to identity tx
      const abi = userIdentity.methods[fun].apply(
        userIdentity.methods[fun],
        args
      ).encodeABI();

      // backup orignal event data and set event data for handling identity tx
      const originalEvent = options.event;
      const originalGetEventResult = options.getEventResult;
      options.event = {
        // event Approved(uint256 indexed executionId, bool approved);
        eventName: 'Approved',
        target: 'KeyHolderLibrary', // VerificationsRegistryLibrary
      };
      options.getEventResult = (event, eventArgs) => {
        return [eventArgs.executionId, event.blockNumber];
      };

      const identity = await this.getIdentityForAccount(options.from);
      const [executionId, blockNumber] = await this.options.executor.executeContractTransaction(
        identity, 'execute', options, targetIdentity.options.address, 0, abi);
      const keyHolderLibrary = this.options.contractLoader.loadContract(
        'KeyHolderLibrary', identity.options.address);
      const [ executed, failed ] = await Promise.all([
        // event Executed(uint256 indexed executionId, address indexed to, uint256 indexed value, bytes data);
        keyHolderLibrary.getPastEvents('Executed', { fromBlock: blockNumber, toBlock: blockNumber }),
        // event ExecutionFailed(uint256 indexed executionId, address indexed to, uint256 indexed value, bytes data);
        keyHolderLibrary.getPastEvents('ExecutionFailed', { fromBlock: blockNumber, toBlock: blockNumber }),
      ]);
      // flatten and filter eventso n exection id from identity tx
      const filtered = [ ...executed, ...failed ].filter(
        event => event.returnValues && event.returnValues.executionId === executionId);
      if (filtered.length && filtered[0].event === 'Executed') {
        // if execution was successfull
        if (originalEvent) {
          // if original options had an event property for retrieving evnet results
          const targetIdentityEvents = await targetIdentity.getPastEvents(
            originalEvent.eventName, { fromBlock: blockNumber, toBlock: blockNumber });
          if (targetIdentityEvents.length) {
            return originalGetEventResult(targetIdentityEvents[0], targetIdentityEvents[0].returnValues);
          }
        }
      } else if (filtered.length && filtered[0].event === 'ExecutionFailed') {
        const values = filtered[0].returnValues;
        throw new Error('executeOnIdentity failed; ExecutionFailed event was triggered: ' +
          `executionId: "${values.executionId}", to: "${values.to}", value: "${values.value}"`);
      } else {
        throw new Error('executeOnIdentity failed; subject type was \'account\', ' +
          'but no proper identity tx status event could be retrieved');
      }
    }
  }

  /**
   * returns full domain for description
   *
   * @param      {string}  topic              verification topic
   * @param      {string}  descriptionDomain  domain of description
   * @return     {string}  full domain
   */
  private getFullDescriptionDomainWithHash(topic: string, descriptionDomain: string): string {
    return `${this.options.nameResolver.soliditySha3(topic).substr(2)}.${descriptionDomain}.verifications.evan`;
  }

  /**
   * checks if given given subject belongs to an account to a contract
   *
   * @param      {string}           subject     verification subject
   * @param      {boolean}          isIdentity  true if given subject is an identity
   * @return     {Promise<string>}  resolves to 'account' or 'contract'
   */
  private async getSubjectType(subject: string, isIdentity?: boolean): Promise<string> {
    if (isIdentity && subject.length === 66) {
      return 'contract';
    } else if (isIdentity && subject.length === 42) {
      return 'account';
    } else if (!this.subjectTypes[subject]) {
      // fills subject type upon retrieval
      await this.getIdentityForAccount(subject);
    }
    return this.subjectTypes[subject];
  }
}
