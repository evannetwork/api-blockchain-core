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

import { BigNumber } from 'bignumber.js';
import {
  AccountStore,
  ContractLoader,
  Executor,
  Logger,
  LoggerOptions,
  NameResolver,
  DfsInterface,
} from '@evan.network/dbcp';

import {
  nullAddress,
  nullBytes32,
} from '../common/utils';
import {
  Description,
  Ipfs,
} from '../index';

import crypto = require('crypto');
import prottle = require('prottle');


/**
 * verification status from blockchain
 */
export enum VerificationsStatus {
  /** issued by a non-issuer parent verification holder, self issued state is 0 */
  Issued,
  /** issued by a non-issuer parent verification holder, self issued state is 0 */
  Confirmed,
  /** verification rejected status */
  Rejected,
}

/**
 * status annotations about verification, depending on defined ``VerificationsQueryOptions``,
 * this may lead to the verification to be invalid or less trustworthy
 */
export enum VerificationsStatusFlagsV2 {
  /** parent verification does not allow subverifications */
  disableSubVerifications = 'disableSubVerifications',
  /** verification has expired */
  expired = 'expired',
  /** signature does not match requirements, this could be because it hasn’t been signed
    * by correct account or underlying checksum does not match subject, topic and data */
  invalid = 'invalid',
  /** verification has been issued, but not accepted or rejected by subject */
  issued = 'issued',
  /** verification has not been issued */
  missing = 'missing',
  /** given subject has no identity */
  noIdentity = 'noIdentity',
  /** verification path has a trusted root verification topic, but this verification is not signed
    * by a trusted instance */
  notEnsRootOwner = 'notEnsRootOwner',
  /** parent verification is missing in path */
  parentMissing = 'parentMissing',
  /** verification path cannot be traced back to a trusted root verification */
  parentUntrusted = 'parentUntrusted',
  /** verification has been issued and then rejected by subject */
  rejected = 'rejected',
  /** verification issuer is the same account as the subject */
  selfIssued = 'selfIssued',
}

/**
 * represents the status of a requested verification topic
 * after applying rules in ``VerificationsQueryOptions``
 */
export enum VerificationsStatusV2 {
  /** verification is valid according to ``VerificationsQueryOptions`` */
  Green = 'green',
  /** verification may be valid but more checks may be required more for trusting it,
   *  see status flags for details  */
  Yellow = 'yellow',
  /** verification is invalid, see status flags for details */
  Red = 'red',
}

/**
 * information for submitting a delegated transaction,
 * created with ``signSetVerificationTransaction`` consumed by ``executeVerification``
 */
export interface VerificationsDelegationInfo {
  /** address of identity contract, that issues verification */
  sourceIdentity: string;
  /** value to transfer, usually 0 */
  value: number;
  /** abi encoded input for transaction */
  input: string;
  /** signed data from transaction */
  signedTransactionInfo?: string;
  /** source identity contract execution nonce for this transaction */
  nonce?: string;
  /** address of identity contract, that receives verification;
   * either this or `to` has to be given */
  targetIdentity?: string;
  /** address of target of transaction, either this or `targetIdentity` has to be given */
  to?: string;
}

/**
 * options for ``getNestedVerificationsV2``, define how to calculate status of verification
 */
export interface VerificationsQueryOptions {
  /** specification of how to handle status flags of each single verification */
  validationOptions?: VerificationsValidationOptions;
  /** function for setting verification with custom logic */
  statusComputer?: VerificationsStatusComputer;
}

/**
 * result of a verification query
 */
export interface VerificationsResultV2 {
  /** overall status of verification */
  status: VerificationsStatusV2;
  /** list of verifications on same topic and subject */
  verifications?: VerificationsVerificationEntry[];
  /** consolidated information about verification  */
  levelComputed?: {
    /** identity contract address or hash of subject */
    subjectIdentity: string;
    /** type of subject (account/contract) */
    subjectType: string;
    /** topic (name) of verification */
    topic: string;
    /** js timestamp */
    expirationDate?: number;
    /** verifications of parent path, issued for all issuers of verifications on this level */
    parents?: VerificationsResultV2;
    /** subject accountId/contractId (if query was issued with ``isIdentity`` set to ``false``) */
    subject?: string;
  };
}

/**
 * a single verification; usually used in ``VerificationsResultV2``
 */
export interface VerificationsVerificationEntry {
  /** details about verification */
  details: {
    /** js timestamp of verification creation */
    creationDate: number;
    /** ens address of description for this verification */
    ensAddress: string;
    /** expiration date of verification (js timestamp) */
    expirationDate?: number;
    /** id in verification holder / verifications registry */
    id: string;
    /** account id of verification issuer */
    issuer: string;
    /** issuers identity contract id */
    issuerIdentity: string;
    /** identity (contract or identity hash) of subject */
    subjectIdentity: string;
    /** type of subject (account/contract) */
    subjectType: string;
    /** topic of identity (name) */
    topic: string;
    /** 32B data hash string of identity */
    data?: any;
    /** only if actually set */
    description?: any;
    /** if applicable, reason for verification rejection */
    rejectReason?: string;
    /** status of verification, is optional during result computation and required when done */
    status?: VerificationsStatusV2;
    /** subject accountId/contractId (if query was issued with ``isIdentity`` set to ``false``) */
    subject?: string;
  };
  /** raw data about verification from contract */
  raw?: {
    /** block in which verification was issued */
    creationBlock: string;
    /** unix timestamp is s when verification was issued */
    creationDate: string;
    /** 32B data hash string of identity, bytes32 zero if unset */
    data: string;
    /** true if subverification are not allowed */
    disableSubVerifications: boolean;
    /** signature over verification data */
    signature: string;
    /** status of verification, (issued, accepted, rejected, etc.) */
    status: number;
    /** uint string of verification name (topic), is uint representation of sha3 of name */
    topic: string;
  };
  /** all found flags, those may not have impact on statusm
   *  depends on ``VerificationsStatusFlagsV2`` */
  statusFlags?: string[];
}

/**
 * Computes status for a single verification. verification, partialResult
 *
 * @param      {Partial<VerificationsVerificationEntry>} verification   current verification result
 *                                                                      (without status)
 * @param      {Partial<VerificationsResultV2>}          partialResult  options for verifications
 *                                                                      query
 * @return     {Promise<VerificationsStatusV2>}                   status for this verification
 */
export interface VerificationsVerificationEntryStatusComputer {
  (
    verification: Partial<VerificationsVerificationEntry>,
    partialResult: Partial<VerificationsResultV2>,
  ): Promise<VerificationsStatusV2>;
}

/**
 * Computes status from overall verifications result.
 * This function is applied after each verification has received an own computed status.
 *
 * @param      {Partial<VerificationsResultV2>} partialResult  current verification result
 *                                                             (without status)
 * @param      {VerificationsQueryOptions}      queryOptions   options for verifications query
 * @param      {VerificationsStatusV2}          currentStatus  current status of verification
 * @return     {Promise<VerificationsStatusV2>} updated status, will be used at verification status
 */
export interface VerificationsStatusComputer {
  (
    partialResult: Partial<VerificationsResultV2>,
    queryOptions: VerificationsQueryOptions,
    currentStatus: VerificationsStatusV2,
  ): Promise<VerificationsStatusV2>;
}

/**
 * Options for verification status computation. Keys are string representations of
 * ``VerificationsStatusFlagsV2``, values can be ``VerificationsStatusV2`` or functions.
 * If value is ``VerificationsStatusV2``, then finding given status flag sets verification value
 * to given ``VerificationsStatusV2`` (if not already at a higher trust level).
 * If value is function, pass verification to this function and set verification status to
 * return value (if not already at a higher trust level).
 */
export interface VerificationsValidationOptions {
  [id: string]: VerificationsStatusV2 | VerificationsVerificationEntryStatusComputer;
}

/**
 * options for Verification constructor, basically a trimmed runtime
 */
export interface VerificationsOptions extends LoggerOptions {
  accountStore: AccountStore;
  config: any;
  contractLoader: ContractLoader;
  description: Description;
  dfs: DfsInterface;
  executor: Executor;
  nameResolver: NameResolver;
  registry?: string;
  storage?: string;
}

/**
 * Verifications helper
 *
 * @class      Verifications (name)
 */
export class Verifications extends Logger {
  public readonly defaultValidationOptions: VerificationsValidationOptions = {
    disableSubVerifications: VerificationsStatusV2.Red,
    expired: VerificationsStatusV2.Red,
    invalid: VerificationsStatusV2.Red,
    issued: VerificationsStatusV2.Red,
    missing: VerificationsStatusV2.Red,
    noIdentity: VerificationsStatusV2.Red,
    notEnsRootOwner: VerificationsStatusV2.Red,
    parentMissing: VerificationsStatusV2.Red,
    parentUntrusted: VerificationsStatusV2.Red,
    rejected: VerificationsStatusV2.Red,
    selfIssued: VerificationsStatusV2.Red,
  };

  public readonly defaultQueryOptions: VerificationsQueryOptions = {
    validationOptions: this.defaultValidationOptions,
  };

  public cachedIdentities: any = { };

  public contracts: any = { };

  public encodingEnvelope = 'binary';

  /** cache all the ens owners */
  public ensOwners: any = { };

  public options: VerificationsOptions;

  /** check if currently the storage is ensuring, if yes, don't run it twice */
  public storageEnsuring: Promise<any>;

  public subjectTypes: any = { };

  /** cache all the verifications using an object of promises, to be sure, that the verification is
   * loaded only once */
  public verificationCache: any = { };

  /** backup already loaded verification descriptions */
  public verificationDescriptions: any = { };

  /**
   * Creates a new Verifications instance.
   *
   * Note, that the option properties ``registry`` and ``resolver`` are optional but should be
   * provided in most cases. As the module allows to create an own ENS structure, that includes an
   * own ENS registry and an own default resolver for it, setting them beforehand is optional.
   *
   * @param    {VerificationsOptions} options
   */
  public constructor(options: VerificationsOptions) {
    super(options);
    this.options = options;

    if (options.storage) {
      this.contracts.storage = this.options.contractLoader.loadContract(
        'V00_UserRegistry', options.storage,
      );
    }
    if (options.registry) {
      this.contracts.registry = this.options.contractLoader.loadContract(
        'VerificationsRegistry', options.registry,
      );
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
  public async computeVerifications(topic: string, verifications: any[]) {
    const computed: any = {
      creationDate: null,
      disableSubVerifications: verifications.filter(
        (verification) => verification.disableSubVerifications,
      ).length > 0,
      displayName: topic.split('/').pop() || 'evan',
      loading: verifications.filter((verification) => verification.loading).length > 0,
      name: topic,
      status: -1,
      subjects: [],
      verifications,
      warnings: [],
    };

    // load the description for the given topic
    await this.ensureVerificationDescription(computed);

    // keep creationDates of all verifications, so we can check after the final combined status was
    // set, which creation date should be used
    const creationDates = {
      '-1': [], 0: [], 1: [], 2: [],
    };
    const expirationDates = {
      '-1': [], 0: [], 1: [], 2: [],
    };

    // iterate through all verifications and check for warnings and the latest creation date of an
    // verification
    for (const verification of verifications) {
      // concatenate all warnings
      computed.warnings = computed.warnings.concat(verification.warnings);

      // use the highest status (-1 missing, 0 issued, 1 valid, 2 rejected)
      if (verification.status === 2) {
        if (computed.status === -1) {
          computed.status = 2;
        }
      } else if (computed.status === 2) {
        computed.status = verification.status;
      } else {
        computed.status = computed.status < verification.status
          ? verification.status : computed.status;
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
      [computed.creationDate] = creationDates[computed.status].sort();
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
   * @param      {string}   accountId       account, that performs the action
   * @param      {string}   subject         verification subject
   * @param      {string}   verificationId  id of a verification to confirm
   * @param      {boolean}  isIdentity      (optional): ``true`` if given ``subject`` is an
   *                                        identity, defaults to ``false``
   * @return     {Promise<void>}  resolved when done
   */
  public async confirmVerification(
    accountId: string,
    subject: string,
    verificationId: string,
    isIdentity = false,
  ): Promise<void> {
    await this.executeOnIdentity(
      subject,
      isIdentity,
      'approveVerification',
      { from: accountId },
      verificationId,
    );

    // clear cache for this verification
    this.deleteFromVerificationCache(subject, '/');
  }

  /**
   * Creates a new identity for account or contract and registers them on the storage. Returned
   * identity is either a 40B contract address (for account identities) or a 32B identity hash
   * contract identities
   *
   * @param      {string}  accountId          account that runs transaction, receiver of identity
   *                                          when omitting the other arguments
   * @param      {string}  contractId         (optional) contract address to create the identity
   *                                          for, creates account identity for ``accountId`` if
   *                                          omitted
   * @param      {bool}    updateDescription  (optional) update description of contract, defaults to
   *                                          ``true``
   * @param      {bool}    linkContract       link contract address to its identity
   * @return     {Promise<string>}  new identity (40Bytes for accounts, 32Bytes for other)
   */
  public async createIdentity(
    accountId: string,
    contractId?: string,
    updateDescription = true,
    linkContract = true,
  ): Promise<string> {
    await this.ensureStorage();
    let identity;
    // create account ids, if no contract id given and if this identity should not be linked
    if (!contractId && linkContract) {
      // create Identity contract
      const identityContract = await this.options.executor.createContract(
        'VerificationHolder', [accountId], { from: accountId, gas: 3000000 },
      );

      const identityStorage = this.contracts.storage.options.address !== nullAddress
        ? this.options.contractLoader.loadContract(
          'V00_UserRegistry', this.contracts.storage.options.address,
        )
        : null;
      // register the new user in the registry
      await this.options.executor.executeContractTransaction(
        identityStorage,
        'registerUser',
        { from: accountId },
        identityContract.options.address,
      );
      identity = identityContract.options.address;
    } else {
      identity = await this.executeAndHandleEventResult(
        accountId,
        this.contracts.registry.methods.createIdentity().encodeABI(),
        { contract: this.contracts.registry, eventName: 'IdentityCreated' },
        (_, args) => args.identity,
      );

      // write identity to description
      if (updateDescription) {
        const description = await this.options.description.getDescription(contractId, accountId);
        description.public.identity = identity;
        // update to dbcpVersion 2 if 1 is selected, to support the new identity property
        if (!description.public.dbcpVersion || description.public.dbcpVersion === 1) {
          description.public.dbcpVersion = 2;
        }
        await this.options.description.setDescriptionToContract(contractId, description, accountId);
      }

      // link contract address to its identity in global registry?
      if (linkContract) {
        const link = `0x${contractId.substr(2).toLowerCase().padStart(64, '0')}`;
        await this.executeAndHandleEventResult(
          accountId,
          this.contracts.registry.methods.linkIdentity(identity, link).encodeABI(),
        );
      }
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
    // prepend starting slash if it does not exists
    if (topic.indexOf('/') !== 0) {
      // eslint-disable-next-line no-param-reassign
      topic = `/${topic}`;
    }

    // search for all parents, that could have links to the topic, so remove them
    Object.keys(this.verificationCache).forEach((key) => {
      // if the key is equal to the topic that should be checked, delete only the cache for the
      // given subject
      if (key === topic) {
        // delete all related subjects for the given topic, or remove all, when subject is a
        // wildcard
        if (this.verificationCache[topic]
            && (this.verificationCache[topic][subject] || subject === '*')) {
          delete this.verificationCache[topic][subject];
        }


      // else remove all child topics
      } else if (key.indexOf(topic) !== -1) {
        delete this.verificationCache[key];
      }
    });
  }

  /**
   * delete a verification. This requires the accountId to have permissions for the parent
   * verification (if verification name seen as a path, the parent 'folder'). Subjects of a
   * verification may only delete it, if they are the issuer as well. If not, they can only react to
   * it by confirming or rejecting the verification.
   *
   * @param      {string}   accountId       account, that performs the action
   * @param      {string}   subject         the subject of the verification
   * @param      {string}   verificationId  id of a verification to delete
   * @param      {boolean}  isIdentity      (optional): ``true`` if given ``subject`` is an
   *                                        identity, defaults to ``false``
   * @return     {Promise<void>}  resolved when done
   */
  public async deleteVerification(
    accountId: string,
    subject: string,
    verificationId: string,
    isIdentity = false,
  ): Promise<void> {
    await this.executeOnIdentity(
      subject,
      isIdentity,
      'removeVerification',
      { from: accountId },
      verificationId,
    );

    // clear cache for this verification
    this.deleteFromVerificationCache(subject, '/');
  }

  /**
   * Gets and sets the default description for a verification if it does not exist.
   *
   * @param      {any}     verification  the verification that should be checked
   */
  public async ensureVerificationDescription(verification: any) {
    // map the topic to the verification ens name and extract the top level verifications domain
    // to check, if the user can set the verification tree
    const fullDomain = this.getVerificationEnsAddress(verification.name);
    const topLevelDomain = fullDomain.replace('.verifications.evan', '').split('.').reverse()[0];
    const ensAddress = this.getFullDescriptionDomainWithHash(verification.name, topLevelDomain);

    // if no description was set, use the latest one or load it
    if (!verification.description) {
      // if the description could not be loaded, the cache will set to false, so we do not need to
      // load again
      if (!this.verificationDescriptions[ensAddress]
          && this.verificationDescriptions[ensAddress] !== false) {
        this.verificationDescriptions[ensAddress] = (async () => {
          try {
            // load the description
            return await this.options.description.getDescriptionFromEns(ensAddress);
          } catch (ex) {
            return false;
          }
        })();
      }
      // eslint-disable-next-line no-param-reassign
      verification.description = await this.verificationDescriptions[ensAddress];
    }

    if (verification.description) {
      // map the properties to a flat description
      if (verification.description.public) {
        // eslint-disable-next-line no-param-reassign
        verification.description = verification.description.public;
      }

      // move the img to the basic verification
      if (verification.description.imgSquare) {
        // eslint-disable-next-line no-param-reassign
        verification.icon = verification.description.imgSquare;
      }
    } else {
      // eslint-disable-next-line no-param-reassign
      verification.description = {
        author: nullAddress,
        dbcpVersion: 1,
        description: verification.name,
        name: verification.name,
        version: '1.0.0',
      };
    }
    // eslint-disable-next-line no-param-reassign
    verification.description.i18n = verification.description.i18n || { };
    // eslint-disable-next-line no-param-reassign
    verification.description.i18n.name = verification.description.i18n.name || { };
    // eslint-disable-next-line no-param-reassign
    verification.description.i18n.name.en = verification.description.i18n.name.en || verification.name.split('/').pop();

    // try to load a clear name
    try {
      // eslint-disable-next-line no-param-reassign
      verification.displayName = verification.description.i18n.name.en;
    } catch (ex) {
      this.log(ex, 'debug');
    }

    // if the top level ens owner was not loaded before, load it!
    if (!this.ensOwners[topLevelDomain]) {
      this.ensOwners[topLevelDomain] = (async () => {
        // transform the ens domain into a namehash and load the ens top level topic owner
        const namehash = this.options.nameResolver.namehash(`${topLevelDomain}.verifications.evan`);
        return this.options.executor.executeContractCall(
          this.options.nameResolver.ensContract, 'owner', namehash,
        );
      })();
    }
    // eslint-disable-next-line no-param-reassign
    verification.ensAddress = ensAddress;
    // eslint-disable-next-line no-param-reassign
    verification.topLevelEnsOwner = await this.ensOwners[topLevelDomain];
  }

  /**
   * Executes a pre-signed verification transaction with given account.
   * This account will be the origin of the transaction and not of the verification.
   * Second argument is generated with ``signSetVerificationTransaction``.
   *
   * @param      {string}                       accountId  account, that submits the transaction
   * @param      {VerificationsDelegationInfo}  txInfo     information with verification tx data
   * @return     {Promise<string>}  id of new verification
   */
  public async executeVerification(
    accountId: string,
    txInfo: VerificationsDelegationInfo,
  ): Promise<any> {
    return this.executeTransaction(
      accountId,
      txInfo,
      {
        event: {
          target: 'VerificationHolderLibrary',
          targetAddress: txInfo.targetIdentity,
          eventName: 'VerificationAdded',
          contract: this.options.contractLoader.loadContract(
            'VerificationHolderLibrary', txInfo.targetIdentity,
          ),
        },
        getEventResult: (_, args) => args.verificationId,
      },
    );
  }

  /**
   * Executes a pre-signed transaction from from ``signTransaction`` of an identity. This can be and
   * usually is a transaction, that has been prepared by the identity owner and is now submitted to
   * the chain and executed by another account.
   *
   * @param      {string}                       accountId       account, that sends transaction to
   *                                                            the blockchain and pays for it
   * @param      {VerificationsDelegationInfo}  txInfo          details about the transaction
   * @param      {<type>}                       event           The event
   * @param      {Function}                     getEventResult  The get event result
   * @param      {any}                          partialOptions  (optional) data for handling event
   *                                                            triggered by this transaction
   */
  public async executeTransaction(
    accountId: string,
    txInfo: VerificationsDelegationInfo,
    { event = null, getEventResult = null }: { event?: any; getEventResult?: Function } = {},
  ): Promise<any> {
    const {
      sourceIdentity,
      to,
      value,
      input,
      signedTransactionInfo,
      targetIdentity,
    } = txInfo;

    const transactionTarget = to || (targetIdentity.length === 42
      ? targetIdentity // target identity contract given
      : this.contracts.registry.options.address); // contract/pseudonym identity given

    return this.executeAndHandleEventResult(
      accountId,
      input,
      event,
      getEventResult,
      sourceIdentity,
      value,
      transactionTarget,
      signedTransactionInfo,
    );
  }

  /**
   * Gets an identity's owner account's address
   *
   * @param {string} identityAddress The identity address to fetch the owner for
   * @returns {string} The address of the owner account
   */
  public async getAccountAddressForIdentity(identityAddress: string): Promise<string> {
    const ownerAddress = await this.options.executor.executeContractCall(
      this.contracts.storage,
      'owners',
      identityAddress,
    );

    return ownerAddress;
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
    return this.computeVerifications(
      topic,
      await this.getNestedVerifications(subject, topic, isIdentity),
    );
  }

  /**
   * Gets current execution nonce for an identity or an accounts identity.
   *
   * @param      {string}   issuer      account or identity to get execution nonce for
   * @param      {boolean}  isIdentity  optional, true if given issuer is an identity, defaults to
   *                                    ``false``
   * @return     {Promise<string>}  execution nonce
   */
  public async getExecutionNonce(issuer: string, isIdentity = false): Promise<string> {
    await this.ensureStorage();
    const identity = isIdentity ? issuer : await this.getIdentityForAccount(issuer, true);
    const identityContract = this.options.contractLoader.loadContract(
      'VerificationHolder', identity,
    );
    return this.options.executor.executeContractCall(identityContract, 'getExecutionNonce');
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
        this.cachedIdentities[subject] = this.options.contractLoader.loadContract(
          'VerificationHolder', targetIdentity,
        );
      } else {
        let description;
        try {
          description = await this.options.description.getDescription(subject, null);
        } catch (_) {
          throw new Error(
            `could not get identity for "${subject}" use either an account with an identity, `
            + 'a contract with a description or work with the 32Bytes identity instead of contractId',
          );
        }

        // if the subject has an description, it it's an contract, so we can set the subjectType
        if (description && description.public) {
          this.subjectTypes[subject] = 'contract';

          // if an identity is available, try to resolve it!
          if (description.public.identity) {
            // we got an identity from description, now check, that contract id matches
            // linked address
            const linked = await this.options.executor.executeContractCall(
              this.contracts.registry, 'getLink', description.public.identity,
            );
            if (!(new RegExp(`${subject.substr(2)}$`, 'i')).test(linked)) {
              const msg = `subject description of "${subject}" points to identity `
                + `"${description.public.identity}", but this identity is linked to address `
                + `"${linked}"`;
              this.log(msg, 'error');
              throw new Error(msg);
            }

            this.cachedIdentities[subject] = description.public.identity;
          }
        }

        // if no description could be loaded, throw
        if (!(description && description.public && description.public.identity)) {
          const msg = `could not find identity for "${subject}"`;
          this.log(msg, 'error');
          throw new Error(msg);
        }
      }
    }

    if (onlyAddress && this.cachedIdentities[subject].options) {
      return this.cachedIdentities[subject].options.address;
    }
    return this.cachedIdentities[subject];
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
   *     // subject type
   *     subjectType: 'account' || 'contract',
   *     // if it's a contract, it can be an contract
   *     subjectOwner: 'account' || 'contract',
   *     // warnings
   *     [
   *       // parent verification does not allow subverifications
   *       'disableSubVerifications',
   *       // verification has expired
   *       'expired',
   *       // signature does not match requirements, this could be because it hasn't been signed by
   *       // correct account or underlying checksum does not match
   *       // ``subject``, ``topic`` and ``data``
   *       'invalid',
   *       // verification has been issued, but not accepted or rejected by subject
   *       'issued',
   *       // verification has not been issued
   *       'missing',
   *       // given subject has no identity
   *       'noIdentity',
   *       // verification path has a trusted root verification topic, but this verification is not
   *       // signed by a trusted instance
   *       'notEnsRootOwner',
   *       // parent verification is missing in path
   *       'parentMissing',
   *       // verification path cannot be traced back to a trusted root verification
   *       'parentUntrusted',
   *       // verification has been issued and then rejected by subject
   *       'rejected',
   *       // verification issuer is the same account as the subject
   *       'selfIssued',
   *     ],
   *     parents: [ ... ],
   *     parentComputed: [ ... ]
   *   }
   */
  public async getNestedVerifications(subject: string, topic: string, isIdentity?: boolean) {
    // prepend starting slash if it does not exist
    if (topic.indexOf('/') !== 0) {
      // eslint-disable-next-line no-param-reassign
      topic = `/${topic}`;
    }

    // if no storage was ensured before, run it only once
    await this.ensureStorage();

    // if no cache is found, set it
    this.verificationCache[topic] = this.verificationCache[topic] || { };
    if (!this.verificationCache[topic][subject]) {
      // load the verifications and store promise within the verification cache object
      this.verificationCache[topic][subject] = (async () => {
        let verifications = [];
        let subjectIdentity;

        if (isIdentity) {
          subjectIdentity = subject;
        } else {
          try {
            subjectIdentity = await this.getIdentityForAccount(subject, true);
          } catch (ex) {
            verifications = [];
          }
        }
        if (subjectIdentity !== nullAddress) {
          verifications = await this.getVerifications(subject, topic, isIdentity);
        }

        if (verifications.length > 0) {
          // build display name for verifications and apply computed states for ui status
          await prottle(10, verifications.map((verification) => async () => {
            const splitName = verification.name.split('/');
            // eslint-disable-next-line no-param-reassign
            verification.displayName = splitName.pop();
            // eslint-disable-next-line no-param-reassign
            verification.parent = splitName.join('/');
            // eslint-disable-next-line no-param-reassign
            verification.warnings = [];
            // eslint-disable-next-line no-param-reassign
            verification.creationDate *= 1000;

            // if expiration date is given, format the unix timestamp
            if (verification.expirationDate) {
              // eslint-disable-next-line no-param-reassign
              verification.expirationDate *= 1000;
            }

            // recover the original account id for the identity issuer
            // eslint-disable-next-line no-param-reassign
            verification.subjectIdentity = subjectIdentity;

            if (this.subjectTypes[subject] === 'contract') {
              // eslint-disable-next-line no-param-reassign
              verification.subjectType = 'contract';
              // eslint-disable-next-line no-param-reassign
              verification.subjectOwner = await this.options.executor.executeContractCall(
                await this.options.contractLoader.loadContract('BaseContract', subject),
                'owner',
              );
            } else {
              // eslint-disable-next-line no-param-reassign
              verification.subjectType = 'account';
            }

            const dataHash = this.options.nameResolver
              .soliditySha3(verification.subjectIdentity, verification.topic, verification.data)
              .replace('0x', '');
            // eslint-disable-next-line no-param-reassign
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

            // if issuer === subject and only if a parent is passed, so if the root one is empty
            // and no slash is available
            if (verification.issuerAccount === verification.subject && verification.parent
                && verification.issuerAccount !== this.options.config.rootVerificationIssuer) {
              verification.warnings.push('selfIssued');
            }

            if (verification.expirationDate && verification.expirationDate < Date.now()) {
              verification.warnings.push('expired');
            }

            if (verification.parent) {
              // load all sub verifications
              // eslint-disable-next-line no-param-reassign
              verification.parents = await this.getNestedVerifications(verification.issuerAccount,
                verification.parent, false);

              // load the computed status of all parent verifications,
              // to check if the parent tree is valid
              // eslint-disable-next-line no-param-reassign
              verification.parentComputed = await this.computeVerifications(verification.parent,
                verification.parents);
              if (verification.parentComputed.status === -1) {
                verification.warnings.push('parentMissing');
              } else if (verification.parentComputed.status === 0) {
                verification.warnings.push('parentUntrusted');
              }

              // is the sub verification creation is disabled?
              if (verification.parentComputed.disableSubVerifications
                  || verification.parentComputed.warnings.indexOf('disableSubVerifications') !== -1) {
                verification.warnings.push('disableSubVerifications');
              }
            } else {
              // eslint-disable-next-line no-param-reassign
              verification.parents = [];

              if (verification.name === '/evan'
                && verification.issuerAccount !== this.options.config.rootVerificationIssuer) {
                // eslint-disable-next-line no-param-reassign
                verification.warnings = ['notEnsRootOwner'];
              } else {
                const whitelistWarnings = ['expired', 'rejected', 'invalid', 'noIdentity',
                  'issued'];

                // if it's a root verification, remove parent, selfIssued and issued warnings
                // eslint-disable-next-line no-param-reassign
                verification.warnings = verification.warnings.filter(
                  (warning) => whitelistWarnings.indexOf(warning) !== -1,
                );
              }
            }

            if (verification.status !== 2) {
              // set computed status
              // eslint-disable-next-line no-param-reassign
              verification.status = verification.warnings.length > 0 ? 0 : 1;
            }
          }));

          // calculate the computed level around all verifications,
          // so we can check all verifications for this user (used for issuing)
          const computed = await this.computeVerifications(topic, verifications);
          // eslint-disable-next-line no-param-reassign,no-return-assign
          verifications.forEach((verification) => verification.levelComputed = computed);
        }

        // if no verifications are available the status would be "no verification issued"
        if (verifications.length === 0) {
          verifications.push({
            displayName: topic.split('/').pop() || 'evan',
            name: topic,
            parents: [],
            status: -1,
            subject,
            tree: [],
            warnings: ['missing'],
            subjectIdentity: subjectIdentity || nullAddress,
          });

          if (this.subjectTypes[subject] === 'contract') {
            verifications[0].subjectType = 'contract';
            verifications[0].subjectOwner = await this.options.executor.executeContractCall(
              await this.options.contractLoader.loadContract('BaseContract', subject),
              'owner',
            );
          } else {
            verifications[0].subjectType = 'account';
          }

          if (!subjectIdentity) {
            verifications[0].warnings.unshift('noIdentity');
          }

          await this.ensureVerificationDescription(verifications[0]);
        }

        return verifications;
      })();
    }

    return this.verificationCache[topic][subject];
  }

  /**
   * Get verifications and their parent paths for a specific subject, then format it to updated
   * result format.
   *
   * @param      {string}                     subject       subject (account/contract or identity)
   * @param      {string}                     topic         topic (verification name) to check
   * @param      {boolean}                    isIdentity    true if subject is identity
   * @param      {VerificationsQueryOptions}  queryOptions  options for query and status computation
   * @return     {Promise<VerificationsResultV2>}  verification result object with status,
   *                                               verification data and tree
   */
  public async getNestedVerificationsV2(
    subject: string,
    topic: string,
    isIdentity?: boolean,
    queryOptions?: VerificationsQueryOptions,
  ): Promise<VerificationsResultV2> {
    const nested = await this.getNestedVerifications(subject, topic, isIdentity);
    return this.formatToV2(nested, queryOptions || this.defaultQueryOptions);
  }

  /**
    * Builds required data for a transaction from an identity (offchain) and returns data, that can
    * be used to submit it later on. Return value can be passed to ``executeTransaction``.
    * Transaction information is not signed and therefore can only be submitted by an appropriate
    * key hold of given identity.
    *
    * Note that, when creating multiple signed transactions, the ``nonce`` argument **has to be
    * specified and incremented between calls**, as the nonce is included in transaction data and
    * restricts the order of transactions, that can be made.
    *
    * @param      {any}     contract      target contract of transaction or ``null`` if just sending
    *                                     funds
    * @param      {string}  functionName  function for transaction or ``null`` if just sending funds
    * @param      {any}     options       options for transaction, supports from, to, nonce, input,
    *                                     value
    * @param      {any[]}   args          arguments for function transaction
    * @return     {VerificationsDelegationInfo}  prepared transaction for ``executeTransaction``
    */
  public async getTransactionInfo(
    contract: any = null,
    functionName: string = null,
    options: any,
    ...args
  ): Promise<VerificationsDelegationInfo> {
    // sign arguments for on-chain check
    const sourceIdentity = await this.getIdentityForAccount(options.from, true);

    // fetch nonce as late as possible
    const nonce = (typeof options.nonce !== 'undefined' && options.nonce !== -1)
      ? `${options.nonce}` : await this.getExecutionNonce(sourceIdentity, true);

    const input = contract
      ? contract.methods[functionName](...args).encodeABI()
      : options.input;

    const to = contract
      ? contract.options.address
      : (options.to || nullAddress);

    const value = options.value || 0;

    return {
      sourceIdentity,
      to,
      value,
      input,
      nonce,
    };
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

    // if a reverse domain is available, add it and separate using a dot
    let domain = 'verifications.evan';
    if (clearedTopic.length > 0) {
      domain = `${clearedTopic.split('/').reverse().join('.')}.${domain}`;
    } else if (topic.indexOf('/evan') === 0 || topic.indexOf('evan') === 0) {
      domain = `evan.${domain}`;
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
  public async getVerifications(
    subject: string,
    topic: string,
    isIdentity?: boolean,
  ): Promise<any[]> {
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
      ].map((fun) => this.callOnIdentity(subject, isIdentity, fun, verificationId));
      verificationDetails.push((async () => {
        const descriptionNodeHash = await this.callOnIdentity(
          subject, isIdentity, 'getVerificationDescription', verificationId,
        );
        if (descriptionNodeHash === nullBytes32) {
          return null;
        }
        const resolverAddress = await this.options.executor.executeContractCall(
          this.options.nameResolver.ensContract, 'resolver', descriptionNodeHash,
        );
        if (resolverAddress === nullAddress) {
          return null;
        }
        const resolver = this.options.contractLoader.loadContract('PublicResolver', resolverAddress);
        const descriptionHash = await this.options.executor.executeContractCall(
          resolver, 'content', descriptionNodeHash,
        );
        const envelope = (await this.options.dfs.get(descriptionHash))
          .toString(this.encodingEnvelope);
        return JSON.parse(envelope).public;
      })());

      const [
        verification,
        verificationStatus,
        creationBlockRaw,
        creationDateRaw,
        disableSubVerifications,
        expirationDateRaw,
        rejected,
        description,
      ] = await Promise.all(verificationDetails);

      // check BigNumber Objects and convert back
      const expirationDate = expirationDateRaw.toString
        ? expirationDateRaw.toString()
        : expirationDateRaw;
      const creationBlock = creationBlockRaw.toNumber
        ? creationBlockRaw.toNumber()
        : creationBlockRaw;
      const creationDate = creationDateRaw.toString
        ? creationDateRaw.toString()
        : creationDateRaw;

      if (verification.issuer === nullAddress) {
        return false;
      }

      let verificationFlag = verificationStatus
        ? VerificationsStatus.Confirmed : VerificationsStatus.Issued;
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
        data: (verification as any).data,
        description,
        disableSubVerifications,
        expirationDate: `${expirationDate}` === '0' ? null : expirationDate,
        expired: `${expirationDate}` === '0' ? false : expirationDate * 1000 < Date.now(),
        id: verificationId,
        issuer: (verification as any).issuer,
        name: topic,
        rejectReason,
        signature: (verification as any).signature,
        status: verificationFlag,
        subject,
        topic: verification.topic.toString(),
        uri: (verification as any).uri,
        valid: await this.validateVerification(subject, verificationId, isIdentity),
      };
    }));

    // drop null values
    return verifications.filter((el) => el);
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
      subject,
    );

    if (!identity || identity === nullAddress) {
      return false;
    }
    return true;
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
    accountId: string,
    subject: string,
    verificationId: string,
    rejectReason?: any,
    isIdentity = false,
  ): Promise<void> {
    if (rejectReason) {
      try {
        const stringified = JSON.stringify(rejectReason);
        const stateMd5 = crypto.createHash('md5').update(stringified).digest('hex');
        // eslint-disable-next-line no-param-reassign
        rejectReason = await this.options.dfs.add(stateMd5, Buffer.from(stringified));
      } catch (e) {
        const msg = `error parsing verificationValue -> ${e.message}`;
        this.log(msg, 'info');
      }
    } else {
      // eslint-disable-next-line no-param-reassign
      rejectReason = nullBytes32;
    }

    await this.executeOnIdentity(
      subject,
      isIdentity,
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
   * @param      {string}           issuer                   issuer of the verification
   * @param      {string}           subject                  subject of the verification and the
   *                                                         owner of the verification node
   * @param      {string}           topic                    name of the verification (full path)
   * @param      {number}           expirationDate           expiration date, for the verification,
   *                                                         defaults to `0` (≈does not expire)
   * @param      {any}              verificationValue        json object which will be stored in the
   *                                                         verification
   * @param      {string}           descriptionDomain        domain of the verification, this is a
   *                                                         subdomain under 'verifications.evan',
   *                                                         so passing 'example' will link
   *                                                         verifications description to
   *                                                         'example.verifications.evan'
   * @param      {boolean}          disableSubVerifications  if true, verifications created under
   *                                                         this path are invalid
   * @param      {boolean}          isIdentity               if true, the subject is already a
   *                                                         identity
   * @param      {string}           uri                      when given this uri will be stored on
   *                                                         the new verification
   * @return     {Promise<string>}  verificationId
   */
  public async setVerification(
    issuer: string,
    subject: string,
    topic: string,
    expirationDate = 0,
    verificationValue?: any,
    descriptionDomain?: string,
    disableSubVerifications = false,
    isIdentity = false,
    uri = '',
  ): Promise<string> {
    await this.ensureStorage();

    const {
      targetIdentity,
      subjectType,
      uint256VerificationName,
      sourceIdentity,
      signature,
      verificationData,
      verificationDataUrl,
      ensFullNodeHash,
    } = await this.getSetVerificationData(
      issuer,
      subject,
      topic,
      verificationValue,
      descriptionDomain,
      isIdentity,
      uri,
    );

    // clear cache for this verification
    this.deleteFromVerificationCache(subject, topic);

    // add the verification to the target identity
    return this.executeOnIdentity(
      targetIdentity,
      true,
      'addVerificationWithMetadata',
      {
        from: issuer,
        event: {
          target: subjectType === 'contract'
            ? 'VerificationsRegistryLibrary' : 'VerificationHolderLibrary',
          eventName: 'VerificationAdded',
        },
        getEventResult: (_, args) => args.verificationId,
      },
      uint256VerificationName,
      '1',
      sourceIdentity,
      signature,
      verificationData,
      verificationDataUrl,
      expirationDate,
      ensFullNodeHash,
      disableSubVerifications,
    );
  }

  /**
   * set description for a verification under a domain owned by given account
   *
   * @param      {string}  accountId    accountId, that performs the description update
   * @param      {string}  topic        name of the verification (full path) to set description
   * @param      {string}  domain       domain of the verification, this is a subdomain under
   *                                    'verifications.evan', so passing `example` will link
   *                                    verifications description to 'example.verifications.evan'
   * @param      {any}     description  description of the verification; can be an Envelope but only
   *                                    public properties are used
   * @return     {Promise<void>}  resolved when done
   */
  public async setVerificationDescription(
    accountId: string, topic: string, domain: string, description: any,
  ): Promise<void> {
    let toSet = JSON.parse(JSON.stringify(description));
    if (!Object.prototype.hasOwnProperty.call(toSet, 'public')) {
      toSet = { public: toSet };
    }
    const domainWithHash = this.getFullDescriptionDomainWithHash(topic, domain);
    await this.options.description.setDescription(domainWithHash, toSet, accountId);

    // clear cache for verifications using this description ens address
    this.deleteFromVerificationCache('*', topic);
  }

  /**
   * Signs a transaction from an identity (offchain) and returns data, that can be used to submit it
   * later on. Return value can be passed to ``executeTransaction``.
   *
   * Note that, when creating multiple signed transactions, the ``nonce`` argument **has to be
   * specified and incremented between calls**, as the nonce is included in transaction data and
   * restricts the order of transactions, that can be made.
   *
   * @param      {any}     contract      target contract of transaction or ``null`` if just sending
   *                                     funds
   * @param      {string}  functionName  function for transaction or ``null`` if just sending funds
   * @param      {any}     options       options for transaction, supports from, to, nonce, input,
   *                                     value
   * @param      {any[]}   args          arguments for function transaction
   * @return     {VerificationsDelegationInfo}  prepared transaction for ``executeTransaction``
   */
  public async signTransaction(
    contract: any = null,
    functionName: string = null,
    options: any,
    ...args
  ): Promise<VerificationsDelegationInfo> {
    const {
      sourceIdentity,
      to,
      value,
      input,
      nonce,
    } = await this.getTransactionInfo(contract, functionName, options, ...args);

    // note that issuer is given for signing, as this ACCOUNT is used to sign the message
    const signedTransactionInfo = await this.signPackedHash(
      options.from, [sourceIdentity, nonce, to, value, input],
    );

    return {
      sourceIdentity,
      to,
      value,
      input,
      signedTransactionInfo,
      nonce,
    };
  }

  /**
   * Signs a verification (off-chain) and returns data, that can be used to submit it later on.
   * Return value can be passed to ``executeVerification``.
   *
   * Note that, when creating multiple signed verification transactions, the ``nonce`` argument
   * **has to be specified and incremented between calls**, as the nonce is included in transaction
   * data and restricts the order of transactions, that can be made.
   *
   * @param      {string}   issuer                   issuer of the verification
   * @param      {string}   subject                  subject of the verification and the owner of
   *                                                 the verification node
   * @param      {string}   topic                    name of the verification (full path)
   * @param      {number}   expirationDate           expiration date, for the verification, defaults
   *                                                 to `0` (≈does not expire)
   * @param      {any}      verificationValue        json object which will be stored in the
   *                                                 verification
   * @param      {string}   descriptionDomain        domain of the verification, this is a subdomain
   *                                                 under 'verifications.evan', so passing
   *                                                 'example' will link verifications description
   *                                                 to 'example.verifications.evan'
   * @param      {boolean}  disableSubVerifications  if true, verifications created under this path
   *                                                 are invalid
   * @param      {boolean}  isIdentity               (optional) true if given subject is an
   *                                                 identity, defaults to ``false``
   *                                                 are invalid
   * @param      {number}   nonce                    issuer identities execution nonce, will be
   *                                                 automatically retrieved if if omitted or set to
   *                                                 -1, if set to -1 will automatically retrieve
   *                                                 latest nonce from chain
   * @param      {string}   uri                      when given this uri will be stored on
   *                                                 the new verification
   * @return     {Promise<VerificationsDelegationInfo>}  information for executing transaction with
   *                                                     another account
   */
  public async signSetVerificationTransaction(
    issuer: string,
    subject: string,
    topic: string,
    expirationDate = 0,
    verificationValue?: any,
    descriptionDomain?: string,
    disableSubVerifications = false,
    isIdentity = false,
    executionNonce: string | number = -1,
    uri = '',
  ): Promise<VerificationsDelegationInfo> {
    await this.ensureStorage();
    // get input arguments
    const {
      targetIdentity,
      uint256VerificationName,
      sourceIdentity,
      signature,
      verificationData,
      verificationDataUrl,
      ensFullNodeHash,
    } = await this.getSetVerificationData(
      issuer,
      subject,
      topic,
      verificationValue,
      descriptionDomain,
      isIdentity,
      uri,
    );

    // sign arguments for on-chain check
    const targetIdentityContract = this.options.contractLoader.loadContract('VerificationHolder', targetIdentity);

    const txInfo = await this.signTransaction(
      targetIdentityContract,
      'addVerificationWithMetadata',
      { from: issuer, nonce: executionNonce },
      uint256VerificationName, // uint256 _topic,
      '1', // uint256 _scheme,
      sourceIdentity, // address _issuer,
      signature, // bytes _signature,
      verificationData, // bytes _data,
      verificationDataUrl, // string _uri,
      expirationDate, // uint256 _expirationDate,
      ensFullNodeHash, // bytes32 _description,
      disableSubVerifications, // bool _disableSubVerifications
    );

    return {
      sourceIdentity: txInfo.sourceIdentity,
      targetIdentity: txInfo.to,
      value: txInfo.value,
      input: txInfo.input,
      signedTransactionInfo: txInfo.signedTransactionInfo,
      nonce: txInfo.nonce,
    };
  }

  /**
   * Trim ``VerificationsResultV2`` result down to statusFlags and status values for analysis
   * purposes and debugging.
   *
   * @param      {VerificationsResultV2}  inputResult  result to trim down
   * @return     {any}                    trimmed down tree
   */
  public trimToStatusTree(inputResult: VerificationsResultV2): any {
    const trimmed: any = {
      status: inputResult.status,
      verifications: inputResult.verifications.map((v) => ({
        details: {
          status: v.details.status,
          topic: inputResult.levelComputed.topic,
        },
        statusFlags: v.statusFlags,
      })),
    };
    if (inputResult.levelComputed && inputResult.levelComputed.parents) {
      trimmed.levelComputed = { parents: this.trimToStatusTree(inputResult.levelComputed.parents) };
    }
    return trimmed;
  }

  /**
   * validates a given verificationId in case of integrity
   *
   * @param      {string}   subject         the subject of the verification
   * @param      {string}   verificationId  verification identifier
   * @param      {boolean}  isIdentity      optional indicates if the subject is already an identity
   * @return     {Promise<boolean>}  resolves with true if the verification is valid,
   *                                 otherwise false
   */
  public async validateVerification(
    subject: string, verificationId: string, isIdentity?: boolean,
  ): Promise<boolean> {
    await this.ensureStorage();

    const subjectIdentity = isIdentity ? subject : await this.getIdentityForAccount(subject, true);

    const verification = await this.callOnIdentity(
      subject,
      isIdentity,
      'getVerification',
      verificationId,
    );

    const dataHash = this.options.nameResolver.soliditySha3(
      subjectIdentity, verification.topic.toString(), verification.data,
    ).replace('0x', '');
    const recoveredAddress = this.options.executor.web3.eth.accounts.recover(
      dataHash, verification.signature,
    );
    const issuerContract = this.options.contractLoader.loadContract(
      'VerificationHolder', verification.issuer,
    );
    const keyHasPurpose = await this.options.executor.executeContractCall(
      issuerContract,
      'keyHasPurpose',
      this.options.nameResolver.soliditySha3(recoveredAddress),
      '1',
    );
    return keyHasPurpose;
  }

  /**
   * execute contract call on identity, checks if account or contract identity is used and if given
   * subject is already an identity
   *
   * @param      {string}        subject     account/contract with identity or an identity of it
   * @param      {boolean}       isIdentity  true if given subject is an identity
   * @param      {string}        fun         function to call
   * @param      {any[]}         args        arguments for function (excluding the identity (for
   *                                         VerificationsRegistry functions))
   * @return     {Promise<any>}  result of called function
   */
  // eslint-disable-next-line consistent-return
  private async callOnIdentity(
    subject: string,
    isIdentity: boolean,
    fun: string,
    ...args
  ): Promise<any> {
    const subjectType = await this.getSubjectType(subject, isIdentity);
    if (subjectType === 'contract') {
      // contract identity
      return this.options.executor.executeContractCall(
        this.contracts.registry,
        fun,
        isIdentity ? subject : await this.getIdentityForAccount(subject),
        ...args,
      );
    } if (subjectType === 'account') {
      // account identity
      return this.options.executor.executeContractCall(
        isIdentity
          ? this.options.contractLoader.loadContract('VerificationHolder', subject)
          : await this.getIdentityForAccount(subject),
        fun,
        ...args,
      );
    }
  }

  /**
   * Compute status for given (partial) result.
   *
   * @param      {Partial<VerificationsResultV2>}  partialResult  current to be calculated result
   * @param      {VerificationsQueryOptions}       queryOptions   options for query and
   *                                                              status computation
   */
  private async computeStatus(
    partialResult: Partial<VerificationsResultV2>,
    queryOptions: VerificationsQueryOptions,
  ): Promise<VerificationsStatusV2> {
    let status: VerificationsStatusV2;

    let bestReachableStatus = VerificationsStatusV2.Green;
    // 'inherit' parent status only if parent actually has verifications
    if (partialResult.levelComputed.parents
        && partialResult.levelComputed.parents.verifications.length) {
      bestReachableStatus = partialResult.levelComputed.parents.status;
    }

    // 'collect colors' (if best reachable is yellow or green)
    // iterate over all verifications, then over all flags and update status
    // later on pick most trustworthy verification as trust level
    // iterate even if best reachable is 'red', as status is set per verification
    for (const verification of partialResult.verifications) {
      // check this levels trustworthiness
      let currentVerificationStatus;
      if (verification.statusFlags
          && verification.statusFlags.length) {
        // flags found, set to false and start to prove trustworthiness
        currentVerificationStatus = VerificationsStatusV2.Red;
        for (const statusFlag of verification.statusFlags) {
          // current flag is untrusted by default, start checks
          let tempStatus = VerificationsStatusV2.Red;
          // use defined status or function for check
          if (typeof queryOptions.validationOptions[statusFlag] === 'function') {
            tempStatus = await (queryOptions.validationOptions[statusFlag] as Function)(
              verification, partialResult,
            );
          } else if (typeof queryOptions.validationOptions[statusFlag] === 'string') {
            tempStatus = queryOptions.validationOptions[statusFlag] as VerificationsStatusV2;
          } else if (typeof this.defaultValidationOptions[statusFlag] === 'function') {
            tempStatus = await (this.defaultValidationOptions[statusFlag] as Function)(
              verification, partialResult,
            );
          } else if (typeof this.defaultValidationOptions[statusFlag] === 'string') {
            tempStatus = this.defaultValidationOptions[statusFlag] as VerificationsStatusV2;
          }

          if (tempStatus === VerificationsStatusV2.Red
              || bestReachableStatus === VerificationsStatusV2.Red) {
            // if one status flag results red status, instant return, other flags does not need to
            // be checked
            currentVerificationStatus = VerificationsStatusV2.Red;
            break;
          } else if (tempStatus === VerificationsStatusV2.Yellow) {
            // if current overall trust level is still "red" and current verification is "yellow",
            // increase trust level to "yellow"
            currentVerificationStatus = VerificationsStatusV2.Yellow;
          } else if (currentVerificationStatus !== VerificationsStatusV2.Yellow) {
            // within the first statusFlag check, currentVerificationStatus will be "red", so we can
            // increase the latest status, never increase "yellow" state to "green"
            currentVerificationStatus = bestReachableStatus;
          }
        }
        verification.details.status = currentVerificationStatus;
      } else {
        verification.details.status = bestReachableStatus;
      }
    }

    // bestReachableStatus has already been taken into consideration in last block,
    // so we can just take status flag here
    if (partialResult.verifications
      .filter((v) => v.details.status === VerificationsStatusV2.Green).length) {
      status = VerificationsStatusV2.Green;
    } else if (partialResult.verifications
      .filter((v) => v.details.status === VerificationsStatusV2.Yellow).length) {
      status = VerificationsStatusV2.Yellow;
    } else {
      status = VerificationsStatusV2.Red;
    }

    // if custom status computation has been defined, apply it after using default computation
    if (queryOptions.statusComputer) {
      status = await queryOptions.statusComputer(partialResult, queryOptions, status);
    }

    return status;
  }

  /**
   * Checks if a storage was initialized before, if not, load the default one.
   *
   * @return     {Promise<void>}  resolved when storage exists or storage was loaded
   */
  private async ensureStorage() {
    if (!this.contracts.storage || !this.contracts.registry) {
      // only load the storage once at a time (this function could be called quickly several times)
      if (!this.storageEnsuring) {
        this.storageEnsuring = Promise.all([
          this.options.storage || this.options.nameResolver
            .getAddress(`identities.${this.options.nameResolver.config.labels.ensRoot}`),
          this.options.registry || this.options.nameResolver
            .getAddress(`contractidentities.${this.options.nameResolver.config.labels.ensRoot}`),
        ]);
      }

      // await storage address
      const [identityStorage, contractIdentityStorage] = await this.storageEnsuring;
      if (!this.contracts.storage) {
        this.contracts.storage = this.options.contractLoader.loadContract('V00_UserRegistry',
          identityStorage);
      }
      if (!this.contracts.registry) {
        this.contracts.registry = this.options.contractLoader.loadContract('VerificationsRegistry',
          contractIdentityStorage);
      }
    }
  }

  /**
   * run given data (serialized contract tx) with given users identity
   *
   * @param      {string}        accountId        account execute given tx on own identity
   * @param      {string}        data             serialized function data
   * @param      {any}           eventInfo        (optional) object with properties: 'eventName' and
   *                                              'contract' (web3 contract instance, that triggers
   *                                              event)
   * @param      {Function}      getEventResults  (optional) function with arguments event and
   *                                              eventArges, that returns result of
   *                                              `executeAndHandleEventResult` call
   * @return     {Promise<any>}  if `eventInfo` and `getEventResults`, result of `getEventResults`,
   *                             otherwise void
   */
  // eslint-disable-next-line consistent-return
  private async executeAndHandleEventResult(
    accountId: string,
    data: string,
    eventInfo?: any,
    getEventResults?: Function,
    sourceIdentity?: string,
    value = 0,
    to?: string,
    signedTransactionInfo?: string,
  ): Promise<any> {
    // get users identity
    const userIdentity = sourceIdentity
      ? this.options.contractLoader.loadContract('VerificationHolder', sourceIdentity)
      : await this.getIdentityForAccount(accountId);

    // prepare success + result event handling
    const options = {
      event: { eventName: 'Approved', target: 'KeyHolderLibrary' },
      from: accountId,
      getEventResult: (event, eventArgs) => [eventArgs.executionId, event.blockNumber],
      value,
    };

    // run tx
    const { executor } = this.options;
    const [executionId, blockNumber] = await (executor.executeContractTransaction as any)(...[
      userIdentity,
      signedTransactionInfo ? 'executeDelegated' : 'execute',
      options,
      to || this.contracts.registry.options.address,
      value,
      data,
    ].concat(signedTransactionInfo ? [signedTransactionInfo] : []));

    // fetch result from event
    // load user identity as a library, to retrieve library events from users identity
    const keyHolderLibrary = this.options.contractLoader.loadContract(
      'KeyHolderLibrary', userIdentity.options.address,
    );
    const [executed, failed] = await Promise.all([
      keyHolderLibrary.getPastEvents(
        'Executed', { fromBlock: blockNumber, toBlock: blockNumber },
      ),
      keyHolderLibrary.getPastEvents(
        'ExecutionFailed', { fromBlock: blockNumber, toBlock: blockNumber },
      ),
    ]);
    // flatten and filter events on execution id from identity tx
    const filtered = [...executed, ...failed].filter(
      (event) => {
        if (event.returnValues && event.returnValues.executionId) {
          // check if executionId is a BigNumber object
          if (event.returnValues.executionId.eq) {
            return event.returnValues.executionId.eq(executionId);
          }
          // otherwise check normal equality
          return event.returnValues.executionId === executionId;
        }
        return false;
      },
    );
    if (filtered.length && filtered[0].event === 'Executed') {
      // if execution was successful
      if (eventInfo) {
        // if original options had an event property for retrieving event results
        let targetIdentityEvents = await eventInfo.contract.getPastEvents(
          eventInfo.eventName, { fromBlock: blockNumber, toBlock: blockNumber },
        );
        targetIdentityEvents = targetIdentityEvents.filter(
          (event) => event.transactionHash === filtered[0].transactionHash,
        );
        if (targetIdentityEvents.length) {
          return getEventResults(targetIdentityEvents[0], targetIdentityEvents[0].returnValues);
        }
      }
    } else if (filtered.length && filtered[0].event === 'ExecutionFailed') {
      const values = filtered[0].returnValues;
      throw new Error('executeOnIdentity failed; ExecutionFailed event was triggered: '
        + `executionId: "${values.executionId}", to: "${values.to}", value: "${values.value}"`);
    } else {
      throw new Error('executeOnIdentity failed; subject type was \'account\', '
        + 'but no proper identity tx status event could be retrieved');
    }
  }

  /**
   * execute contract transaction on identity, checks if account or contract identity is used and if
   * given subject is already an identity
   *
   * @param      {string}        subject  account/contract with identity or an identity of it
   * @param      {string}        fun      function to call
   * @param      {any}           options  options for transaction
   * @param      {any[]}         args     arguments for function (excluding the identity (for
   *                                      VerificationsRegistry functions))
   * @return     {Promise<any>}  result of called function
   */
  // eslint-disable-next-line consistent-return
  private async executeOnIdentity(
    subject: string,
    isIdentity: boolean,
    fun: string,
    options: any,
    ...args
  ): Promise<any> {
    const subjectType = await this.getSubjectType(subject, isIdentity);
    if (subjectType === 'contract') {
      const targetIdentity = isIdentity ? subject : await this.getIdentityForAccount(subject);
      const abiOnRegistry = this.contracts.registry.methods[fun](targetIdentity, ...args)
        .encodeABI();
      if (options.event) {
        return this.executeAndHandleEventResult(
          options.from,
          abiOnRegistry,
          {
            contract: this.options.contractLoader.loadContract(
              'VerificationsRegistryLibrary', this.contracts.registry.options.address,
            ),
            eventName: options.event.eventName,
          },
          options.getEventResult,
        );
      }
      return this.executeAndHandleEventResult(options.from, abiOnRegistry);
    } if (subjectType === 'account') {
      // account identity
      let targetIdentityAddress;
      if (isIdentity) {
        targetIdentityAddress = subject;
      } else {
        targetIdentityAddress = (await this.getIdentityForAccount(subject)).options.address;
      }
      const targetIdentity = this.options.contractLoader.loadContract(
        'VerificationHolder',
        targetIdentityAddress,
      );

      // get encoded abi for passing it to identity tx
      const abi = targetIdentity.methods[fun].apply(
        targetIdentity.methods[fun],
        args,
      ).encodeABI();

      // backup original event data and set event data for handling identity tx
      const originalEvent = options.event;
      const originalGetEventResult = options.getEventResult;
      // eslint-disable-next-line no-param-reassign
      options.event = {
        // event Approved(uint256 indexed executionId, bool approved);
        eventName: 'Approved',
        target: 'KeyHolderLibrary', // VerificationsRegistryLibrary
      };
      // eslint-disable-next-line no-param-reassign
      options.getEventResult = (event, eventArgs) => [eventArgs.executionId, event.blockNumber];

      const identity = await this.getIdentityForAccount(options.from);
      const [executionId, blockNumber] = await this.options.executor.executeContractTransaction(
        identity, 'execute', options, targetIdentity.options.address, 0, abi,
      );
      const keyHolderLibrary = this.options.contractLoader.loadContract(
        'KeyHolderLibrary', identity.options.address,
      );
      const [executed, failed] = await Promise.all([
        keyHolderLibrary.getPastEvents(
          'Executed', { fromBlock: blockNumber, toBlock: blockNumber },
        ),
        keyHolderLibrary.getPastEvents(
          'ExecutionFailed', { fromBlock: blockNumber, toBlock: blockNumber },
        ),
      ]);
      // flatten and filter events on execution id from identity tx
      const filtered = [...executed, ...failed].filter(
        (event) => {
          if (event.returnValues && event.returnValues.executionId) {
            // check if executionId is a BigNumber object
            if (event.returnValues.executionId.eq) {
              return event.returnValues.executionId.eq(executionId);
            }
            // otherwise check normal equality
            return event.returnValues.executionId === executionId;
          }
          return false;
        },
      );
      if (filtered.length && filtered[0].event === 'Executed') {
        // if execution was successful
        if (originalEvent) {
          // if original options had an event property for retrieving event results
          const targetIdentityEvents = await targetIdentity.getPastEvents(
            originalEvent.eventName, { fromBlock: blockNumber, toBlock: blockNumber },
          );
          if (targetIdentityEvents.length) {
            return originalGetEventResult(
              targetIdentityEvents[0], targetIdentityEvents[0].returnValues,
            );
          }
        }
      } else if (filtered.length && filtered[0].event === 'ExecutionFailed') {
        const values = filtered[0].returnValues;
        throw new Error('executeOnIdentity failed; ExecutionFailed event was triggered: '
          + `executionId: "${values.executionId}", to: "${values.to}", value: "${values.value}"`);
      } else {
        throw new Error('executeOnIdentity failed; subject type was \'account\', '
          + 'but no proper identity tx status event could be retrieved');
      }
    }
  }

  /**
   * Format given result to V2 data format.
   *
   * @param      {any}                        nestedVerificationsInput  verifications array
   * @param      {VerificationsQueryOptions}  queryOptions              options for result
   *                                                                    status computation
   */
  private async formatToV2(
    nestedVerificationsInput: any[],
    queryOptions: VerificationsQueryOptions,
  ): Promise<VerificationsResultV2> {
    const nestedVerifications = nestedVerificationsInput.filter(
      (verification) => verification.status !== -1,
    );
    if (!nestedVerifications.length) {
      return {
        status: VerificationsStatusV2.Red,
        verifications: [],
      };
    }
    const verifications = [];
    let levelComputed: any;

    if (nestedVerifications.length) {
      let parents;
      if (nestedVerifications[0].parents
          && nestedVerifications[0].parents.length) {
        parents = await this.formatToV2(nestedVerifications[0].parents, queryOptions);
      }
      levelComputed = {
        subjectIdentity: nestedVerifications[0].subjectIdentity,
        subjectType: nestedVerifications[0].subjectType,
        topic: nestedVerifications[0].levelComputed.name,
      };
      if (nestedVerifications[0].subjectIdentity !== nestedVerifications[0].subject) {
        levelComputed.subject = nestedVerifications[0].subject;
      }
      if (nestedVerifications[0].levelComputed.expirationDate) {
        levelComputed.expirationDate = nestedVerifications[0].levelComputed.expirationDate;
      }
      if (parents) {
        levelComputed.parents = parents;
      }
    }

    // convert verification data
    for (const nestedVerification of nestedVerifications) {
      const verification: Partial<VerificationsVerificationEntry> = {
        details: {
          creationDate: nestedVerification.creationDate,
          ensAddress: nestedVerification.ensAddress,
          id: nestedVerification.id,
          issuer: nestedVerification.issuerAccount,
          issuerIdentity: nestedVerification.issuer,
          subject: nestedVerification.subject,
          subjectIdentity: nestedVerification.subjectIdentity,
          subjectType: nestedVerification.subjectIdentity,
          topic: nestedVerification.name,
        },
        raw: {
          creationBlock: nestedVerification.creationBlock,
          creationDate: typeof nestedVerification.creationDate === 'number'
            ? `${nestedVerification.creationDate}`.replace(/...$/, '')
            : nestedVerification.creationDate,
          data: nestedVerification.data,
          disableSubVerifications: nestedVerification.disableSubVerifications,
          signature: nestedVerification.signature,
          status: nestedVerification.status,
          topic: nestedVerification.topic,
        },
      };
      if (nestedVerification.subjectIdentity !== nestedVerification.subject) {
        // .subject may be .subject's identity, ignore value in this case
        levelComputed.subject = nestedVerification.subject;
      }
      if (nestedVerification.warnings) {
        verification.statusFlags = nestedVerification.warnings;
      }
      if (nestedVerification.description && nestedVerification.description.author !== nullAddress) {
        verification.details.description = nestedVerification.description;
      }
      if (nestedVerification.data && nestedVerification.data !== nullBytes32) {
        verification.details.data = await this.options.dfs.get(
          Ipfs.bytes32ToIpfsHash(nestedVerification.data),
        );
      }
      // eslint-disable-next-line
      ['expirationDate', 'rejectReason'].map((property) => {
        if (nestedVerification[property]) {
          verification.details[property] = nestedVerification[property];
        }
      });
      verifications.push(verification);
    }

    const result: any = { verifications };
    if (levelComputed) {
      result.levelComputed = levelComputed;
    }

    result.status = await this.computeStatus(result, queryOptions);

    return result;
  }

  /**
   * returns full domain for description
   *
   * @param      {string}  topic              verification topic
   * @param      {string}  descriptionDomain  domain of description
   * @return     {string}  full domain
   */
  private getFullDescriptionDomainWithHash(topic: string, descriptionDomain: string): string {
    const hash = this.options.nameResolver.soliditySha3(topic);
    return `${hash.substr(2)}.${descriptionDomain}.verifications.evan`;
  }

  /**
   * Generates input for functions ``setVerification`` and ``signSetVerificationTransaction``.
   *
   * @param      {string}   issuer                   issuer of the verification
   * @param      {string}   subject                  subject of the verification and the owner of
   *                                                 the verification node
   * @param      {string}   topic                    name of the verification (full path)
   * @param      {any}      verificationValue        json object which will be stored in the
   *                                                 verification
   * @param      {string}   descriptionDomain        domain of the verification, this is a subdomain
   *                                                 under 'verifications.evan', so passing
   *                                                 'example' will link verifications description
   *                                                 to 'example.verifications.evan'
   * @param      {string}   uri                      when given this uri will be stored on
   *                                                 the new verification
   * @return     {any}      data for setting verifications
   */
  private async getSetVerificationData(
    issuer: string,
    subject: string,
    topic: string,
    verificationValue?: any,
    descriptionDomain?: string,
    isIdentity = false,
    uri = '',
  ): Promise<{
      targetIdentity: string;
      subjectType: string;
      uint256VerificationName: string;
      sourceIdentity: string;
      signature: string;
      verificationData: string;
      verificationDataUrl: string;
      ensFullNodeHash: string;
    }> {
    await this.ensureStorage();
    const subjectType = await this.getSubjectType(subject, isIdentity);
    let targetIdentity;
    if (isIdentity) {
      targetIdentity = subject;
    } else if (subjectType === 'contract') {
      targetIdentity = (await this.options.description.getDescription(
        subject, issuer,
      )).public.identity;
    } else {
      targetIdentity = await this.options.executor.executeContractCall(
        this.contracts.storage,
        'users',
        subject,
      );
    }

    // get the issuer identity contract
    const sourceIdentity = await this.options.executor.executeContractCall(
      this.contracts.storage,
      'users',
      issuer,
    );
    // check if target and source identity are existing
    if (!targetIdentity || targetIdentity === nullAddress) {
      const msg = `trying to set verification ${topic} with account ${issuer}, `
        + `but target identity for account ${subject} does not exist`;
      this.log(msg, 'error');
      throw new Error(msg);
    }

    // convert the verification name to a uint256
    const sha3VerificationName = this.options.nameResolver.soliditySha3(topic);
    const uint256VerificationName = new BigNumber(sha3VerificationName).toString(10);

    let verificationData = nullBytes32;
    const verificationDataUrl = uri;
    if (verificationValue) {
      try {
        const stringified = JSON.stringify(verificationValue);
        const stateMd5 = crypto.createHash('md5').update(stringified).digest('hex');
        verificationData = await this.options.dfs.add(stateMd5, Buffer.from(stringified));
      } catch (e) {
        const msg = `error parsing verificationValue -> ${e.message}`;
        this.log(msg, 'info');
      }
    }

    // create the signature for the verification
    const signedSignature = await this.options.executor.web3.eth.accounts.sign(
      this.options.nameResolver.soliditySha3(
        targetIdentity, uint256VerificationName, verificationData,
      ).replace('0x', ''),
      `0x${await this.options.accountStore.getPrivateKey(issuer)}`,
    );

    // build description hash if required
    let ensFullNodeHash;
    if (descriptionDomain) {
      ensFullNodeHash = this.options.nameResolver.namehash(
        this.getFullDescriptionDomainWithHash(topic, descriptionDomain),
      );
    }

    // return arguments for setting verification
    return {
      targetIdentity,
      subjectType,
      uint256VerificationName,
      sourceIdentity,
      signature: signedSignature.signature,
      verificationData,
      verificationDataUrl,
      ensFullNodeHash: ensFullNodeHash || nullBytes32,
    };
  }

  /**
   * checks if given given subject belongs to an account to a contract
   *
   * @param      {string}           subject     verification subject
   * @param      {boolean}          isIdentity  true if given subject is an identity
   * @return     {Promise<string>}  resolves to 'account' or 'contract'
   */
  private async getSubjectType(subject: string, isIdentity?: boolean): Promise<string> {
    if (subject.length === 66) {
      return 'contract';
    } if (isIdentity && subject.length === 42) {
      return 'account';
    } if (!this.subjectTypes[subject]) {
      // fills subject type upon retrieval
      await this.getIdentityForAccount(subject);
    }
    return this.subjectTypes[subject];
  }

  /**
   * Tightly pack given arguments (excluding first argument of course), hash result and sign this
   * with private key of account.
   * This function will remove leading '0x' from resulting hash before signing it.
   *
   * @param      {string}  accountId  account, that is used to sign data
   * @param      {any[]}   toSign     arguments, that will be packed, hashed, signed
   * @return     {any}     object with signed data
   */
  private async signPackedHash(accountId: string, toSign: any): Promise<any> {
    return this.options.executor.signer.signMessage(
      accountId, this.options.nameResolver.soliditySha3(...toSign),
    );
  }
}
