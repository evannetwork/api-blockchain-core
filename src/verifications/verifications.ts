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
import prottle = require('prottle');
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


const nullAddress = '0x0000000000000000000000000000000000000000';
const nullBytes32 = '0x0000000000000000000000000000000000000000000000000000000000000000';


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

  /**
   * check if currently the storage is ensuring, if yes, dont run it twice
   */
  storageEnsuring: Promise<any>;

  /**
   * backup already loaded verification descriptions
   */
  verificationDescriptions: any = { };

  /**
   * cache all the verifications using an object of promises, to be sure, that the verification is loaded only
   * once
   */
  verificationCache: any = { };

  /**
   * cache all the ens owners
   */
  ensOwners: any = { };

  constructor(options: VerificationsOptions) {
    super(options);
    this.options = options;

    if (options.storage) {
      this.contracts.storage = this.options.contractLoader.loadContract('V00_UserRegistry',
        options.storage);
    }
  }

  /**
   * Takes an array of verifications and combines all the states for one quick view.
   *
   * {
   *   verifications: verifications,
   *   creationDate: null,
   *   displayName: topic.split('/').pop() || 'evan',
   *   loading: verifications.filter(verification => verification.loading).length > 0,
   *   name: topic,
   *   status: -1,
   *   subjects: [ ],
   *   warnings: [ ], // have a look at getNestedVerifications
   * }
   *
   * @param      {string}      topic          topic of all the verifications
   * @param      {Array<any>}  verifications  all verifications of a specific topic
   * @return     {any}         computed verification including latest creationDate, combined color,
   *                           displayName
   */
  public async computeVerifications(topic: string, verifications: Array<any>) {
    const computed: any = {
      creationDate: null,
      disableSubVerifications: verifications.filter(verification => verification.disableSubVerifications).length > 0,
      displayName: topic.split('/').pop() || 'evan',
      loading: verifications.filter(verification => verification.loading).length > 0,
      name: topic,
      status: -1,
      subjects: [ ],
      verifications: verifications,
      warnings: [ ],
    };

    // load the description for the given topic
    await this.ensureVerificationDescription(computed);

    // keep creationDates of all verifications, so we can check after the final combined status was set,
    // which creation date should be used
    const creationDates = { '-1': [ ], '0': [ ], '1': [ ], '2': [ ]};
    const expirationDates = { '-1': [ ], '0': [ ], '1': [ ], '2': [ ]};

    // iterate through all verifications and check for warnings and the latest creation date of an verification
    for (let verification of verifications) {
      // concadinate all warnings
      computed.warnings = computed.warnings.concat(verification.warnings);

      // use the highest status (-1 missing, 0 issued, 1 valid, 2 rejected)
      if (verification.status === 2) {
        if (computed.status === -1) {
          computed.status = 2;
        }
      } else {
        if (computed.status === 2) {
          computed.status = verification.status;
        } else {
          computed.status = computed.status < verification.status ? verification.status : computed.status;
        }
      }

      // search one subject of all
      if (computed.subjects.indexOf(verification.subject) === -1) {
        computed.subjects.push(verification.subject);
      }

      // save all creation dates for later usage
      if (typeof verification.creationDate !== 'undefined') {
        creationDates[verification.status].push(verification.creationDate);
      }

      // save all creation dates for later usage
      if (typeof verification.expirationDate !== 'undefined') {
        expirationDates[verification.status].push(verification.expirationDate);
      }
    }

    // use the latest creationDate for the specific status
    if (creationDates[computed.status].length > 0) {
      computed.creationDate = creationDates[computed.status].sort()[0];
    }

    // use the latest creationDate for the specific status
    if (expirationDates[computed.status].length > 0) {
      const curExpiration = expirationDates[computed.status].sort();
      computed.expirationDate = curExpiration[curExpiration.length - 1];
    }

    return computed;
  }

  /**
   * confirms a verification; this can be done, if a verification has been issued for a subject and
   * the subject wants to confirm it
   *
   * @param      {string}         accountId       account, that performs the action
   * @param      {string}         subject         verification subject
   * @param      {string}         verificationId  id of a verification to confirm
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

    // clear cache for this verification
    this.deleteFromVerificationCache(subject, '/');
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
        'VerificationHolder', [ accountId ], { from: accountId, gas: 3000000, });

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
      identity = await this.createContractIdentity(accountId);

      // write identity to description
      const description = await this.options.description.getDescription(contractId, accountId);
      description.public.identity = identity;
      // update to dbcpVersion 2 if 1 is selected, to support the new identity property
      if (!description.public.dbcpVersion || description.public.dbcpVersion === 1) {
        description.public.dbcpVersion = 2;
      }
      await this.options.description.setDescriptionToContract(contractId, description, accountId);

      await this.linkContractIdentity(accountId, identity, contractId);
    }

    // clear cache for this account
    this.deleteFromVerificationCache(accountId, '/');

    return identity;
  }

  /**
   * Delete a single entry from the verification cache object using subject and topic
   *
   * @param      {string}  subject  the subject that should be removed
   * @param      {string}  topic    the topic that should be removed
   * @return     {void}
   */
  public deleteFromVerificationCache(subject: string, topic: string) {
    // prepent starting slash if it does not exists
    if (topic.indexOf('/') !== 0) {
      topic = '/' + topic;
    }

    // search for all parents, that could have links to the topic, so remove them
    Object.keys(this.verificationCache).forEach(key => {
      // if the key is equal to the topic that should be checked, delete only the cache for the
      // given subject
      if (key === topic) {
        // delete all related subjectes for the given topic, or remove all, when subject is a
        // wildcard
        if (this.verificationCache[topic] && (this.verificationCache[topic][subject] || subject === '*')) {
          delete this.verificationCache[topic][subject];
        }

        return;
      // else remove all child topics
      } else if (key.indexOf(topic) !== -1) {
        delete this.verificationCache[key];
      }
    });
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

    // clear cache for this verification
    this.deleteFromVerificationCache(subject, '/');
  }

  /**
   * Gets and sets the default description for a verification if it does not exists.
   *
   * @param      {any}     verification  the verification that should be checked
   */
  public async ensureVerificationDescription(verification: any) {
    // map the topic to the verification ens name and extract the top level verifications domain to check, if
    // the user can set the verification tree
    const ensAddress = this.getVerificationEnsAddress(verification.name);
    const topLevelDomain = ensAddress.split('.').splice(-3, 3).join('.');

    // if no description was set, use the latest one or load it
    if (!verification.description) {
      // if the description could not be loaded, the cache will set to false, so we do not need to load again
      if (!this.verificationDescriptions[ensAddress] && this.verificationDescriptions[ensAddress] !== false) {
        this.verificationDescriptions[ensAddress] = (async () => {
          try {
            // load the description
            return await this.options.description.getDescriptionFromEns(ensAddress);
          } catch (ex) {
            return false;
          }
        })();
      }

      verification.description = await this.verificationDescriptions[ensAddress];
    }

    if (verification.description) {
      // map the properties to a flat description
      if (verification.description.public) {
        verification.description = verification.description.public;
      }

      // move the img to the basic verification
      if (verification.description.imgSquare) {
        verification.icon = verification.description.imgSquare;
      }
    } else {
      verification.description = {
        author: nullAddress,
        dbcpVersion: 1,
        description: verification.name,
        name: verification.name,
        version: '1.0.0',
      };
    }

    verification.description.i18n = verification.description.i18n || { };
    verification.description.i18n.name = verification.description.i18n.name || { };
    verification.description.i18n.name.en = verification.description.i18n.name.en || verification.name.split('/').pop();

    // try to load a clear name
    try {
      verification.displayName = verification.description.i18n.name.en;
    } catch (ex) { }

    // if the top level ens owner was not loaded before, load it!
    if (!this.ensOwners[topLevelDomain]) {
      this.ensOwners[topLevelDomain] = (async () => {
        // transform the ens domain into a namehash and load the ens top level topic owner
        const namehash = this.options.nameResolver.namehash(topLevelDomain);
        return await this.options.executor.executeContractCall(
          this.options.nameResolver.ensContract, 'owner', namehash);
      })();
    }

    verification.ensAddress = ensAddress;
    verification.topLevelEnsOwner = await this.ensOwners[topLevelDomain];
  }

  /**
   * Loads a list of verifications for a topic and a subject and combines to a single view for a
   * simple verification status check.
   *
   * @param      {string}   subject     subject, that performs the description loading
   * @param      {string}   topic       topic of all the verifications
   * @param      {boolean}  isIdentity  optional indicates if the subject is already a identity
   * @return     {any}      computed verification including latest creationDate, combined color,
   *                        displayName
   */
  public async getComputedVerification(subject: string, topic: string, isIdentity?: boolean) {
    return await this.computeVerifications(
      topic,
      await this.getNestedVerifications(subject, topic, isIdentity)
    );
  }

  /**
   * gets the identity contract for a given account id or contract
   *
   * @param      {string}        subject      the subject for the identity contract
   * @param      {boolean}       onlyAddress  should only the identity address
   * @return     {Promise<any>}  the identity contract instance
   */
  public async getIdentityForAccount(subject: string, onlyAddress?: boolean): Promise<any> {
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

        // if the subject has an description, it it's an contract, so we can set the subjectType
        if (description && description.public) {
          this.subjectTypes[subject] = 'contract';

          // if an identity is available, try to resolve it!
          if (description.public.identity) {
            // we got an identity from description, now check, that contract id matches linked address
            const linked = await this.options.executor.executeContractCall(
              this.contracts.registry, 'getLink', description.public.identity);
            if (linked !== subject) {
              const msg = `subject description of "${subject}" points to identity ` +
                `"${description.public.identity}", but this identity is linked to address "${linked}"`;
              this.log(msg, 'error');
              throw new Error(msg);
            }

            this.cachedIdentities[subject] = description.public.identity;
          }
        }

        // if no description could be loaded for a contract, throw it
        if (!(description && description.public && description.public.identity)) {
          const msg = `could not find identity for "${subject}"`;
          this.log(msg, 'error');
          throw new Error(msg);
        }
      }
    }

    if (onlyAddress && this.cachedIdentities[subject].options) {
      return this.cachedIdentities[subject].options.address;
    } else {
      return this.cachedIdentities[subject];
    }
  }

  /**
   * Get all the verifications for a specific subject.
   *
   * @param      {string}      subject     subject to load the verifications for.
   * @param      {string}      topic       topic to load the verifications for.
   * @param      {boolean}     isIdentity  optional indicates if the subject is already a identity
   * @return     {Promise<Array<any>>}  all the verifications with the following properties.
   *   {
   *     id: '...',
   *     // creator of the verification
   *     issuer: '0x1813587e095cDdfd174DdB595372Cb738AA2753A',
   *     // topic of the verification
   *     name: '/company/b-s-s/employee/swo',
   *     // -1: Not issued => no verification was issued
   *     // 0: Issued => status = 0, warning.length > 0
   *     // 1: Confirmed => issued by both, self issued state is 2, values match
   *     // 2: Rejected => reject by the creator / subject
   *     status: 2,
   *     // verification for account id / contract id
   *     subject: subject,
   *     // ???
   *     value: '',
   *     // ???
   *     uri: '',
   *     // ???
   *     signature: ''
   *     // icon for cards display
   *     icon: 'icon to display',
   *     // if the verification was rejected, a reject reason could be applied
   *     rejectReason: '' || { },
   *     // subjec type
   *     subjectType: 'account' || 'contract',
   *     // if it's a contract, it can be an contract
   *     subjectOwner: 'account' || 'contract',
   *     // warnings
   *     [
   *       'issued', // verification.status === 0
   *       'missing', // no verification exists
   *       'expired', // is the verification expired?
   *       'rejected', // rejected
   *       'selfIssued' // issuer === subject
   *       'invalid', // signature is manipulated
   *       'parentMissing',  // parent path does not exists
   *       'parentUntrusted',  // root path (/) is not issued by evan
   *       'notEnsRootOwner', // invalid ens root owner when check topic is
   *       'noIdentity', // checked subject has no identity
   *       'disableSubVerifications' // when sub verifications are disable on the parent
   *     ],
   *     parents: [ ... ],
   *     parentComputed: [ ... ]
   *   }
   */
  public async getNestedVerifications(subject: string, topic: string, isIdentity?: boolean) {
    // prepent starting slash if it does not exists
    if (topic.indexOf('/') !== 0) {
      topic = '/' + topic;
    }

    // if no storage was ensured before, run it only once
    await this.ensureStorage();

    // if no cache is found, set it
    this.verificationCache[topic] = this.verificationCache[topic] || { };
    if (!this.verificationCache[topic][subject]) {
      // load the verifications and store promise within the verification cache object
      this.verificationCache[topic][subject] = (async () => {
        const isValidAddress = this.options.executor.web3.utils.isAddress(subject);
        let verifications = [ ];
        let subjectIdentity;

        // only load verifications for correct contract / accoun id's
        if (isValidAddress) {
          try {
            subjectIdentity = await this.getIdentityForAccount(subject, true);

            if (subjectIdentity !== '0x0000000000000000000000000000000000000000') {
              verifications = await this.getVerifications(subject, topic, isIdentity);
            }
          } catch (ex) {
            verifications = [ ];
          }
        }

        if (verifications.length > 0) {
          // build display name for verifications and apply computed states for ui status
          await prottle(10, verifications.map(verification => async () => {
            const splitName = verification.name.split('/');

            verification.displayName = splitName.pop();
            verification.parent = splitName.join('/');
            verification.warnings = [ ];
            verification.creationDate = verification.creationDate * 1000;

            // if expiration date is given, format the unix timestamp
            if (verification.expirationDate) {
              verification.expirationDate = verification.expirationDate * 1000;
            }

            // recover the original account id for the identity issuer
            verification.subjectIdentity = subjectIdentity;

            if (this.subjectTypes[subject] === 'contract') {
              verification.subjectType = 'contract';
              verification.subjectOwner = await this.options.executor.executeContractCall(
                await this.options.contractLoader.loadContract('BaseContract', subject),
                'owner'
              );
            } else {
              verification.subjectType = 'account';
            }

            const dataHash = this.options.nameResolver
              .soliditySha3(verification.subjectIdentity, verification.topic, verification.data).replace('0x', '');
            verification.issuerAccount = this.options.executor.web3.eth.accounts
              .recover(dataHash, verification.signature);

            // ensure, that the description was loaded
            await this.ensureVerificationDescription(verification);

            if (verification.status === 0) {
              verification.warnings.push('issued');
            }

            if (verification.status === 2) {
              verification.warnings.unshift('rejected');
            }

            // if signature is not valid
            if (!verification.valid) {
              verification.warnings.push('invalid');
            }

            // if isser === subject and only if a parent is passed, so if the root one is empty and no
            // slash is available
            if (verification.issuerAccount === verification.subject && verification.parent) {
              verification.warnings.push('selfIssued');
            }

            if (verification.expirationDate && verification.expirationDate < Date.now()) {
              verification.warnings.push('expired');
            }

            if (verification.parent) {
              // load all sub verifications
              verification.parents = await this.getNestedVerifications(verification.issuerAccount,
                verification.parent, false);

              // load the computed status of all parent verifications, to check if the parent tree is valid
              verification.parentComputed = await this.computeVerifications(verification.parent,
                verification.parents);
              if (verification.parentComputed.status === -1) {
                verification.warnings.push('parentMissing');
              } else if (verification.parentComputed.status === 0) {
                verification.warnings.push('parentUntrusted');
              }

              // is the sub verification creation is disabled?
              if (verification.parentComputed.disableSubVerifications ||
                  verification.parentComputed.warnings.indexOf('disableSubVerifications') !== -1) {
                verification.warnings.push('disableSubVerifications');
              }
            } else {
              verification.parents = [ ];

              if (verification.name === '/evan' &&
                 (verification.issuerAccount !== this.options.config.ensRootOwner ||
                   verification.subject !== this.options.config.ensRootOwner)) {
                verification.warnings = [ 'notEnsRootOwner' ];
              } else {
                const whitelistWarnings = [ 'expired', 'rejected', 'invalid', 'noIdentity',
                  'issued' ];

                // if it's a root verification, remove parent, selfIssued and issued warnings
                verification.warnings = verification.warnings.filter(warning =>
                  whitelistWarnings.indexOf('warning') !== -1
                );
              }
            }

            if (verification.status !== 2) {
              // set computed status
              verification.status = verification.warnings.length > 0 ? 0 : 1;
            }
          }));

          // calculate the computed level around all verifications, so we can check all verifications for this user
          // (used for issueing)
          const computed = await this.computeVerifications(topic, verifications);
          verifications.forEach(verification => verification.levelComputed = computed);
        }

        // if no verifications are available the status would be "no verification issued"
        if (verifications.length === 0) {
          verifications.push({
            displayName: topic.split('/').pop() || 'evan',
            name: topic,
            parents: [ ],
            status: -1,
            subject: subject,
            tree: [ ],
            warnings: [ 'missing' ],
            subjectIdentity: isValidAddress ?
              await this.options.executor.executeContractCall(
                this.contracts.storage, 'users', subject) :
              '0x0000000000000000000000000000000000000000',
          });

          if (this.subjectTypes[subject] === 'contract') {
            verifications[0].subjectType = 'contract';
            verifications[0].subjectOwner = await this.options.executor.executeContractCall(
              await this.options.contractLoader.loadContract('BaseContract', subject),
              'owner'
            );
          } else {
            verifications[0].subjectType = 'account';
          }

          if (!verifications[0].subjectIdentity ||
              verifications[0].subjectIdentity === '0x0000000000000000000000000000000000000000') {
            verifications[0].warnings.unshift('noIdentity');
          }

          await this.ensureVerificationDescription(verifications[0]);
        }

        return verifications;
      })();
    }

    return await this.verificationCache[topic][subject];
  }

  /**
   * Map the topic of a verification to it's default ens domain
   *
   * @param      {string}  topic   the verification name / topic
   * @return     {string}  The verification ens address
   */
  public getVerificationEnsAddress(topic: string) {
    // remove starting evan, /evan and / to get the correct domain
    const clearedTopic = topic.replace(/^(?:(?:\/)?(?:evan)?)(?:\/)?/gm, '');

    // if a reverse domain is available, add it and seperate using a dot
    let domain = 'verifications.evan';
    if (clearedTopic.length > 0) {
      domain = `${ clearedTopic.split('/').reverse().join('.') }.${ domain }`;
    } else if (topic.indexOf('/evan') === 0 || topic.indexOf('evan') === 0) {
      domain = `evan.${ domain }`;
    }

    return domain;
  }

  /**
   * gets verification information for a verification name from a given account; results has the
   * following properties: creationBlock, creationDate, data, description, expired, expirationDate,
   * id, issuer, name, signature, status, subject, topic, uri, valid
   *
   * @param      {string}          subject     subject of the verifications
   * @param      {string}          topic       name (/path) of a verification
   * @param      {boolean}         isIdentity  (optional) indicates if the subject is already an
   *                                           identity
   * @return     {Promise<any[]>}  verification info array
   */
  public async getVerifications(subject: string, topic: string, isIdentity?: boolean): Promise<any[]> {
    const sha3VerificationName = this.options.nameResolver.soliditySha3(topic);
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
        'getDisableSubVerifications',
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

      let [verification, verificationStatus, creationBlock, creationDate, disableSubVerifications, expirationDate, rejected, description] =
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
        disableSubVerifications,
        expirationDate: `${expirationDate}` === '0' ? null : expirationDate,
        expired: `${expirationDate}` === '0' ? false : expirationDate * 1000 < Date.now(),
        id: verificationId,
        issuer: (<any>verification).issuer,
        name: topic,
        rejectReason,
        signature: (<any>verification).signature,
        status: verificationFlag,
        subject,
        topic: verification.topic,
        uri: (<any>verification).uri,
        valid: await this.validateVerification(subject, verificationId, isIdentity),
      };
    }));

    // drop null values
    return verifications.filter(el => el);
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
   * reject a Verification. This verification will be marked as rejected but not deleted. This is
   * important for tracking reasons. You can also optionally add a reject reason as JSON object to
   * track additional informations about the rejection. Issuer and Subject can reject a special
   * verification.
   *
   * @param      {string}         accountId       account, that performs the action
   * @param      {string}         subject         account, that rejects the verification
   * @param      {string}         verificationId  id of a verification to reject
   * @param      {any}            rejectReason    (optional) rejectReason object
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

    // clear cache for this verification
    this.deleteFromVerificationCache(subject, '/');
  }

  /**
   * Sets or creates a verification; this requires the issuer to have permissions for the parent
   * verification (if verification name seen as a path, the parent 'folder').
   *
   * @param      {string}           issuer             issuer of the verification
   * @param      {string}           subject            subject of the verification and the owner of
   *                                                   the verification node
   * @param      {string}           topic              name of the verification (full path)
   * @param      {number}           expirationDate     expiration date, for the verification,
   *                                                   defaults to `0` (does not expire)
   * @param      {object}           verificationValue  json object which will be stored in the
   *                                                   verification
   * @param      {string}           descriptionDomain  domain of the verification, this is a
   *                                                   subdomain under 'verifications.evan', so
   *                                                   passing 'example' will link verifications
   *                                                   description to 'example.verifications.evan'
   * @return     {Promise<string>}  verificationId
   */
  public async setVerification(
      issuer: string,
      subject: string,
      topic: string,
      expirationDate = 0,
      verificationValue?: any,
      descriptionDomain?: string,
      disabelSubVerifications = false
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
      const msg = `trying to set verification ${topic} with account ${issuer}, ` +
        `but target identity for account ${subject} does not exist`;
      this.log(msg, 'error');
      throw new Error(msg);
    }

    // convert the verification name to a uint256
    const sha3VerificationName = this.options.nameResolver.soliditySha3(topic);
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
        this.getFullDescriptionDomainWithHash(topic, descriptionDomain));
    }

    // clear cache for this verification
    this.deleteFromVerificationCache(subject, topic);

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
      disabelSubVerifications,
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

    // clear cache for verifications using this description ens address
    this.deleteFromVerificationCache('*', topic);
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

    let subjectIdentity = isIdentity ? subject : await this.getIdentityForAccount(subject, true);

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

  private async createContractIdentity(accountId: string): Promise<any> {
    let abiOnRegistry = this.contracts.registry.methods.createIdentity().encodeABI();
    return this.executeAndHandleEventResult(
      accountId,
      abiOnRegistry,
      { contract: this.contracts.registry, eventName: 'IdentityCreated' },
      (_, args) => args.identity,
    );
  }

  /**
   * Checks if a storage was initialized before, if not, load the default one.
   *
   * @return     {Promise<void>}  resolved when storage exists or storage was loaded
   */
  private async ensureStorage() {
    if (!this.contracts.storage) {
      // only load the storage once at a time (this function could be called quickly several times)
      if (!this.storageEnsuring) {
        this.storageEnsuring = Promise.all([
          this.options.nameResolver
            .getAddress(`identities.${ this.options.nameResolver.config.labels.ensRoot }`),
          this.options.nameResolver
            .getAddress(`contractidentities.${ this.options.nameResolver.config.labels.ensRoot }`),
        ]);
      }

      // await storage address
      const [ identityStorage, contractIdentityStorage ] = await this.storageEnsuring;
      this.contracts.storage = this.options.contractLoader.loadContract('V00_UserRegistry',
        identityStorage);
      this.contracts.registry = this.options.contractLoader.loadContract('VerificationsRegistry',
        contractIdentityStorage);
    }
  }

  private async executeAndHandleEventResult(
      accountId: string, data: string, eventInfo?: any, getEventResults?: Function): Promise<any> {
    // get users identity
    const userIdentity = await this.getIdentityForAccount(accountId);

    // prepare sucess + result event handling
    const options = {
      event: { eventName: 'Approved', target: 'KeyHolderLibrary' },
      from: accountId,
      getEventResult: (event, eventArgs) => [eventArgs.executionId, event.blockNumber],
    };

    // run tx
    const [executionId, blockNumber] = await this.options.executor.executeContractTransaction(
      userIdentity, 'execute', options, this.contracts.registry.options.address, 0, data);

    // fetch result from event
    // load user identity as a library, to retrieve library events from users identity
    const keyHolderLibrary = this.options.contractLoader.loadContract(
      'KeyHolderLibrary', userIdentity.options.address);
    const [ executed, failed ] = await Promise.all([
      keyHolderLibrary.getPastEvents(
        'Executed', { fromBlock: blockNumber, toBlock: blockNumber }),
      keyHolderLibrary.getPastEvents(
        'ExecutionFailed', { fromBlock: blockNumber, toBlock: blockNumber }),
    ]);
    // flatten and filter eventso n exection id from identity tx
    const filtered = [ ...executed, ...failed ].filter(
      event => event.returnValues && event.returnValues.executionId === executionId);
    if (filtered.length && filtered[0].event === 'Executed') {
      // if execution was successfull
      if (eventInfo) {
        // if original options had an event property for retrieving evnet results
        const targetIdentityEvents = await eventInfo.contract.getPastEvents(
          eventInfo.eventName, { fromBlock: blockNumber, toBlock: blockNumber });
        if (targetIdentityEvents.length) {
          return getEventResults(targetIdentityEvents[0], targetIdentityEvents[0].returnValues);
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
      let abiOnRegistry = this.contracts.registry.methods[fun](
        await this.getIdentityForAccount(subject), ...args).encodeABI();
      if (options.event) {
        return this.executeAndHandleEventResult(
          options.from,
          abiOnRegistry,
          {
            contract: this.options.contractLoader.loadContract('VerificationsRegistryLibrary', this.contracts.registry.options.address),
            eventName: options.event.eventName,
          },
          options.getEventResult,
        );
      } else {
        return this.executeAndHandleEventResult(options.from, abiOnRegistry);
      }
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

  private async linkContractIdentity(
      accountId: string, contractIdentity: string, contractAddress: string): Promise<void> {
    let abiOnRegistry = this.contracts.registry.methods.linkIdentity(
      contractIdentity, contractAddress).encodeABI();
    return this.executeAndHandleEventResult(accountId, abiOnRegistry);
  }
}
