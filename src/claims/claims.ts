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
  DfsInterface,
  Ipfs
} from '@evan.network/dbcp';


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
  Confirmed
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
  contracts: any = { };
  encodingEnvelope = 'binary';
  options: ClaimsOptions;

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
   * @param      {string}         subject    account, that approves the claim
   * @param      {string}         claimName  name of the claim (full path)
   * @param      {string}         issuer     The issuer which has signed the claim
   * @param      {string}         claimId    id of a claim to confirm
   * @return     {Promise<void>}  resolved when done
   */
  public async confirmClaim(
      subject: string, claimName: string, issuer: string, claimId: string): Promise<void> {
    await this.ensureStorage();

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
    const sha3ClaimId = claimId;
    await this.options.executor.executeContractTransaction(
      identityContract,
      'approveClaim',
      { from: subject, },
      claimId,
    );
  }

  /**
   * Creates a new identity for an account
   *
   * @param      {string}        accountId  The account identifier
   * @return     {Promise<any>}  resolves when done
   */
  public async createIdentity(accountId: string): Promise<any> {
    await this.ensureStorage();

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
   * delete a claim. This requires the issuer to have permissions for the parent claim (if claim
   * name seen as a path, the parent 'folder'). Subjects of a claim may only delete it, if they are
   * the issuer as well. If not, they can only react to it by confirming or rejecting the claim.
   *
   * @param      {string}         subject    the subject of the claim
   * @param      {string}         claimName  name of the claim (full path)
   * @param      {string}         issuer     issuer of the claim; only the issuer can delete a claim
   * @param      {string}         claimId    id of a claim to delete
   * @return     {Promise<void>}  resolved when done
   */
  public async deleteClaim(
      subject: string, claimName: string, issuer: string, claimId: string): Promise<void> {
    await this.ensureStorage();

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
    await this.options.executor.executeContractTransaction(
      identityContract,
      'removeClaim',
      { from: subject, },
      claimId,
    );
  }

  /**
   * gets claim informations for a claim name from a given account; results has the following
   * properties: creationBlock, creationDate, data, description, expirationDate, id, issuer, name,
   * signature, status, subject, topic, uri, valid
   *
   * @param      {string}        claimName   name (/path) of a claim
   * @param      {string}        subject     the target subject
   * @param      {boolean}       isIdentity  optional indicates if the subject is already a identity
   * @return     {Promise<any>}  claim info array
   */
  public async getClaims(claimName: string, subject: string, isIdentity?: boolean): Promise<any> {
    await this.ensureStorage();

    // get the target identity contract for the subject
    let identity = subject;
    if (!isIdentity) {
      identity = await this.options.executor.executeContractCall(
        this.contracts.storage,
        'users',
        subject
      );

      if (!identity) {
        const msg = `trying to get claim ${claimName} with account ${subject}, ` +
          `but the idendity for account ${subject} does not exist`;
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
      const claimCreationBlockP = this.options.executor.executeContractCall(
        identityContract,
        'claimCreationBlock',
        claimId
      );
      const claimCreationP = this.options.executor.executeContractCall(
        identityContract,
        'claimCreationDate',
        claimId
      );
      const claimexpirationDateP = this.options.executor.executeContractCall(
        identityContract,
        'getClaimExpirationDate',
        claimId
      );
      const claimDescriptionP = (async () => {
        const descriptionNodeHash = await this.options.executor.executeContractCall(
          identityContract,
          'getClaimDescription',
          claimId
        );
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
      })();
      let [
        claim,
        claimStatus,
        creationBlock,
        creationDate,
        expirationDate,
        description,
        ] = await Promise.all([
          claimP,
          claimStatusP,
          claimCreationBlockP,
          claimCreationP,
          claimexpirationDateP,
          claimDescriptionP,
        ])
      ;

      if (claim.issuer === nullAddress) {
        return false;
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
        signature: (<any>claim).signature,
        status: claimStatus ? ClaimsStatus.Confirmed : ClaimsStatus.Issued,
        subject,
        topic: claim.topic,
        uri: (<any>claim).uri,
        valid: await this.validateClaim(claimId, subject, isIdentity),
      };
    }));

    return claims.filter(function (el) {
      return el;
    });
  }

  /**
   * gets the identity contract for a given account id
   *
   * @param      {string}        subject  the subject for the identity contract
   * @return     {Promise<any>}  the identity contract instance
   */
  public async getIdentityForAccount(subject: string) {
    await this.ensureStorage();

    // get the target identity contract for the subject
    const targetIdentity = await this.options.executor.executeContractCall(
      this.contracts.storage,
      'users',
      subject
    );
    // check if target identity exists
    if (!targetIdentity) {
      const msg = `target identity for account ${subject} does not exist`;
      this.log(msg, 'error');
      throw new Error(msg);
    }

    return this.options.contractLoader.loadContract('OriginIdentity', targetIdentity);
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
   * sets or creates a claim to a given subject identity
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

    // get the target identity contract for the subject
    const targetIdentity = await this.options.executor.executeContractCall(
      this.contracts.storage,
      'users',
      subject
    );
    // get the issuer identity contract
    const sourceIdentity = await this.options.executor.executeContractCall(
      this.contracts.storage,
      'users',
      issuer
    );
    // check if target and source identity are existing
    if (!targetIdentity || targetIdentity === nullAddress) {
      const msg = `trying to set claim ${claimName} with account ${issuer}, ` +
        `but target idendity for account ${subject} does not exist`;
      this.log(msg, 'error');
      throw new Error(msg);
    }

    const identityContract = this.options.contractLoader.loadContract('OriginIdentity', targetIdentity);
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
    return await this.options.executor.executeContractTransaction(
      identityContract,
      'addClaimWithMetadata',
      {
        from: issuer,
        event: { target: 'ClaimHolderLibrary', eventName: 'ClaimAdded' },
        getEventResult: (_, args) => { return args.claimId; },
      },
      uint256ClaimName,
      '1',
      sourceIdentity,
      signedSignature.signature,
      claimData,
      claimDataUrl,
      expirationDate,
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
  public async setClaimDescription(accountId: string, topic: string, domain: string, description: any) {  
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
   * @param      {string}            claimId     claim identifier
   * @param      {string}            subject     the subject of the claim
   * @param      {boolean}           isIdentity  optional indicates if the subject is already an
   *                                             identity
   * @return     {Promise<boolean>}  resolves with true if the claim is valid, otherwise false
   */
  public async validateClaim(claimId: string, subject: string, isIdentity?: boolean) {
    await this.ensureStorage();

    let subjectIdentity = subject;
    if (!isIdentity) {
      // get the target identity contract for the subject
      subjectIdentity = await this.options.executor.executeContractCall(
        this.contracts.storage,
        'users',
        subject
      );

      // check if target and source identity are existing
      if (!subjectIdentity) {
        const msg = `target idendity for account ${subject} does not exist`;
        this.log(msg, 'error');
        throw new Error(msg);
      }
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
   * @param      {string}          claimLabel  claim topic of a claim to build the tree for
   * @param      {string}          subject     subject of the claim and the owner of the claim node
   * @param      {array}           treeArr     (optional) result tree array, used for recursion
   * @return     {Promise<any[]>}  Array with all resolved claims for the tree
   */
  public async validateClaimTree(claimLabel: string, subject: string, treeArr = []) {
    const splittedClaimLabel = claimLabel.split('/');
    const claims = await this.getClaims(claimLabel, subject, true);
    // TODO: -> Add validation of more than one claim if there are more claims for the label
    if (claims.length > 0) {
      // check at the moment the first claim
      treeArr.push(claims[0]);
      if (splittedClaimLabel.length > 1) {
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

  private getFullDescriptionDomainWithHash(topic: string, descriptionDomain: string) {
    return `${this.options.nameResolver.soliditySha3(topic).substr(2)}.${descriptionDomain}.claims.evan`;
  }

  private loadContracts(storage) {
    this.contracts = {
      storage: this.options.contractLoader.loadContract('V00_UserRegistry', storage),
    };
  }
}
