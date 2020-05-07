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

import { cloneDeep, merge } from 'lodash';

import {
  Logger,
  LoggerOptions,
  SignerInternal,
} from '@evan.network/dbcp';

import { nullAddress } from './common/utils';
import { createDefaultRuntime, Runtime } from './runtime';
import { Mail, Mailbox } from './mailbox';
import { Profile } from './profile/profile';
import * as AccountType from './profile/types/types';
import { SignerIdentity } from './contracts/signer-identity';
import { Did } from './did/did';
import { VerificationsDelegationInfo } from './verifications/verifications';
import { Aes } from './encryption/aes';

import KeyStore = require('../libs/eth-lightwallet/keystore');
import https = require('https');
import http = require('http');

/**
 * mail that will be sent to invitee
 */
export interface InvitationMail {
  body: string;
  subject: string;
  to: string;
  fromAlias?: string;
  lang?: string;
}

/**
 * parameters for Onboarding constructor
 */
export interface OnboardingOptions extends LoggerOptions {
  mailbox: Mailbox;
  smartAgentId: string;
  executor: any;
}

/**
 * helper class for sending onboarding mails
 *
 * @class      Mailbox (name)
 */
export class Onboarding extends Logger {
  public options: OnboardingOptions;

  public constructor(optionsInput: OnboardingOptions) {
    super(optionsInput);
    this.options = optionsInput;
  }

  /**
   * creates a new random mnemonic
   */
  public static createMnemonic(): string {
    return KeyStore.generateRandomSeed();
  }

  /**
   * Creates a new profile for a given mnemonic, and password
   *
   * @param      {string}  mnemonic            given mnemonic for the new profile
   * @param      {string}  password            password for the given profile
   * @param      {any}     profileProperties   Properties for the profile to be created
   *
   * @return     {Promise<any>}   resolved when done
   */

  public static async createNewProfile(
    runtime: Runtime,
    mnemonic: string,
    password: string,
    profileProperties: any,
  ): Promise<any> {
    if (!mnemonic) {
      throw new Error('mnemonic is a required parameter!');
    }

    if (!password) {
      throw new Error('password is a required parameter!');
    }
    const runtimeNew = await createDefaultRuntime(runtime.web3, runtime.dfs, {
      mnemonic,
      password,
      useIdentity: runtime.runtimeConfig.useIdentity,
    });

    // check if the source runtime has enough funds
    const profileCost = runtime.web3.utils.toWei('1.0097');
    const runtimeFunds = await runtime.web3.eth.getBalance(runtime.activeAccount);
    const { BN } = runtime.web3.utils;
    if ((new BN(runtimeFunds)).lt(new BN(profileCost))) {
      throw new Error(`The account ${runtime.activeAccount} has less than 1.0097 EVE to create a new profile`);
    }

    try {
      await Profile.checkCorrectProfileData(
        profileProperties,
        profileProperties.accountDetails.profileType,
      );
    } catch (ex) {
      throw new Error('The parameters passed are incorrect, profile properties need to be reconfigured');
    }

    await runtime.executor.executeSend({
      from: runtime.activeAccount,
      to: runtimeNew.activeAccount,
      value: profileCost,
    });

    await Onboarding.createProfile(runtimeNew, profileProperties);

    return {
      mnemonic,
      password,
      runtimeConfig: runtimeNew.runtimeConfig,
    };
  }


  /**
   * create new profile, store it to profile index initialize addressBook and publicKey
   *
   * @param      {string}         keys    communication key to store
   * @return     {Promise<void>}  resolved when done
   */
  public static async createProfile(runtime, profileData: any): Promise<void> {
    const factoryDomain = runtime.nameResolver.getDomainName(
      runtime.nameResolver.config.domains.profileFactory,
    );
    const factoryAddress = await runtime.nameResolver.getAddress(factoryDomain);

    const combinedDataSchema = merge(
      ...Object.keys(AccountType).map((accountType) => cloneDeep(AccountType[accountType])),
    );
    const { properties } = combinedDataSchema.template;
    const ajvProperties = {};
    for (const key of Object.keys(properties)) {
      ajvProperties[key] = properties[key].dataSchema;
    }
    const dataSchemaEntries = Object.keys(ajvProperties).filter((property) => ajvProperties[property].type !== 'array');
    const dataSchemaLists = Object.keys(ajvProperties).filter((property) => ajvProperties[property].type === 'array');

    const description = {
      public: {
        name: 'Profile Container',
        description: 'Container contract for storing and sharing profile related information '
          + '(account type, company information, device detail, ...)',
        author: '',
        version: '0.1.0',
        dbcpVersion: 2,
        abis: {
          own: JSON.parse(runtime.contractLoader.contracts.DataContract.interface),
        },
        dataSchema: ajvProperties,
      },
    };
    const descriptionHash = await runtime.dfs.add(
      'description', Buffer.from(JSON.stringify(description), 'utf8'),
    );

    const factory = runtime.contractLoader.loadContract(
      'ProfileDataContractFactoryInterface', factoryAddress,
    );
    const contractId = await runtime.executor.executeContractTransaction(
      factory,
      'createContract',
      {
        from: runtime.activeIdentity,
        autoGas: 1.1,
        event: { target: 'BaseContractFactoryInterface', eventName: 'ContractCreated' },
        getEventResult: (event, args) => args.newAddress,
      },
      '0x'.padEnd(42, '0'),
      runtime.activeIdentity,
      descriptionHash,
      runtime.nameResolver.config.ensAddress,
      [...Object.values(runtime.profile.treeLabels), ...dataSchemaEntries]
        .map((name) => runtime.nameResolver.soliditySha3(name)),
      dataSchemaLists
        .map((name) => runtime.nameResolver.soliditySha3(name)),
    );
    const contractInterface = runtime.contractLoader.loadContract('DataContractInterface', contractId);
    const rootDomain = runtime.nameResolver.namehash(
      runtime.nameResolver.getDomainName(
        runtime.nameResolver.config.domains.root,
      ),
    );
    await runtime.executor.executeContractTransaction(
      contractInterface,
      'init',
      { from: runtime.activeIdentity, autoGas: 1.1 },
      rootDomain,
      false,
    );

    const encodingUnencrypted = 'utf-8';
    const cryptoAlgorithHashes = 'aesEcb';
    const cryptorAes = runtime.cryptoProvider.getCryptorByCryptoAlgo(
      'aes',
    );
    const hashCryptor = runtime.cryptoProvider.getCryptorByCryptoAlgo(cryptoAlgorithHashes);
    const [hashKey, blockNr] = await Promise.all([
      hashCryptor.generateKey(),
      runtime.web3.eth.getBlockNumber(),
    ]);

    // setup sharings for new profile
    const sharings = {};
    const profileKeys = Object.keys(profileData);
    // add hashKey
    await runtime.sharing.extendSharings(
      sharings, runtime.activeIdentity, runtime.activeIdentity, '*', 'hashKey', hashKey,
    );
    // extend sharings for profile data
    const dataContentKeys = await Promise.all(profileKeys.map(() => cryptorAes.generateKey()));
    for (let i = 0; i < profileKeys.length; i += 1) {
      await runtime.sharing.extendSharings(
        sharings,
        runtime.activeIdentity,
        runtime.activeIdentity, profileKeys[i], blockNr, dataContentKeys[i],
      );
    }
    // upload sharings
    const sharingsHash = await runtime.dfs.add(
      'sharing', Buffer.from(JSON.stringify(sharings), encodingUnencrypted),
    );

    // eslint-disable-next-line no-param-reassign
    runtime.profile.profileOwner = runtime.activeIdentity;
    // eslint-disable-next-line no-param-reassign
    runtime.profile.profileContract = runtime.contractLoader.loadContract('DataContract', contractId);

    await runtime.executor.executeContractTransaction(
      runtime.profile.profileContract,
      'setSharing',
      { from: runtime.activeIdentity, autoGas: 1.1 },
      sharingsHash,
    );
    const dhKeys = runtime.keyExchange.getDiffieHellmanKeys();
    await Promise.all([
      // call `setEntry` for each pre-build entry value
      ...((profileData ? Object.keys(profileData) : [])
        .map((entry) => runtime.dataContract.setEntry(
          runtime.profile.profileContract,
          entry,
          profileData[entry],
          runtime.activeIdentity,
        ))
      ),
      (async () => {
        await runtime.profile.addContactKey(
          runtime.activeAccount, 'dataKey', dhKeys.privateKey.toString('hex'),
        );
        await runtime.profile.addProfileKey(runtime.activeIdentity, 'alias', profileData.accountDetails.accountName);
        await runtime.profile.addPublicKey(dhKeys.publicKey.toString('hex'));
        await runtime.profile.storeForAccount(runtime.profile.treeLabels.addressBook);
        await runtime.profile.storeForAccount(runtime.profile.treeLabels.publicKey);
      })(),
      (async () => {
        const profileIndexDomain = runtime.nameResolver.getDomainName(
          runtime.nameResolver.config.domains.profile,
        );

        const profileIndexAddress = await runtime.nameResolver.getAddress(profileIndexDomain);
        // register profile for user
        const profileIndexContract = runtime.contractLoader.loadContract(
          'ProfileIndexInterface', profileIndexAddress,
        );
        await runtime.executor.executeContractTransaction(
          profileIndexContract,
          'setMyProfile',
          { from: runtime.activeIdentity, autoGas: 1.1 },
          runtime.profile.profileContract.options.address,
        );
      })(),
    ]);
  }

  /**
   * generates a runtime config for a given mnemonic and password
   *
   * @param      {string}  mnemonic         specified mnemonic
   * @param      {string}  password         given password
   * @param      {any}     web3             web3 instance
   * @param      {string}  passwordSalting  string that should be used for encryptionKey salting
   *                                        instead of account id (e.g. identity)
   */
  public static async generateRuntimeConfig(
    mnemonic: string,
    password: string,
    web3: any,
    passwordSalting?: string,
  ) {
    // generate a new vault from the mnemnonic and the password
    const vault: any = await new Promise((res) => {
      KeyStore.createVault({
        seedPhrase: mnemonic,
        password,
        hdPathString: 'm/45\'/62\'/13\'/7',
      }, (err, result) => {
        res(result);
      });
    });
    // get the derived key
    const pwDerivedKey = await new Promise((res) => {
      (vault).keyFromPassword(password, (err, result) => res(result));
    });
    // generate one initial address
    (vault).generateNewAddress(pwDerivedKey, 1);

    const accountId = web3.utils.toChecksumAddress((vault).getAddresses()[0]);
    const pKey = (vault).exportPrivateKey(accountId.toLowerCase(), pwDerivedKey);

    const sha9Account = web3.utils.soliditySha3.apply(web3.utils.soliditySha3,
      [web3.utils.soliditySha3(accountId), web3.utils.soliditySha3(accountId)].sort());
    const sha3Account = web3.utils.soliditySha3(accountId);
    const dataKey = web3.utils
      .keccak256((passwordSalting || accountId) + password)
      .replace(/0x/g, '');
    const runtimeConfig = {
      accountMap: {
        [accountId]: pKey,
      },
      keyConfig: {
        [sha9Account]: dataKey,
        [sha3Account]: dataKey,
      },
    };

    return runtimeConfig;
  }

  /**
   * creates a complete profile and emits it to the given smart agent
   *
   * @param      {any}     runtime         initialized runtime
   * @param      {any}     profileData     object that included profile data (accountDetails,
   *                                       registration, contact, ...)
   * @param      {string}  accountId       accountId of the privateKey
   * @param      {string}  pKey            private key
   * @param      {string}  recaptchaToken  recaptcha token
   * @param      {string}  network         selected network (testcore/core) - defaults to testcore
   */
  public static async createOfflineProfile(
    runtime: any,
    profileData: any,
    accountId: string,
    pKey: string,
    recaptchaToken: string,
    password: string,
    network = 'testcore',
  ) {
    // ensure to set activeIdentity to 0x0..., when use identity is disabled
    const creationRuntime = {
      ...runtime,
      activeIdentity: nullAddress,
    };
    // check for correct profile data
    if (!profileData || !profileData.accountDetails || !profileData.accountDetails.accountName) {
      throw new Error('No profile data specified or accountDetails missing');
    }
    // eslint-disable-next-line no-param-reassign
    profileData.accountDetails.profileType = profileData.accountDetails.profileType || 'user';

    // fill empty container type
    if (!profileData.type) {
      // eslint-disable-next-line no-param-reassign
      profileData.type = 'profile';
    }

    // build array with allowed fields (may include duplicates)
    Profile.checkCorrectProfileData(profileData, profileData.accountDetails.profileType);

    const { profile } = creationRuntime;
    // disable pinning while profile files are being created
    profile.ipld.ipfs.disablePin = true;
    // clear hash log
    profile.ipld.hashLog = [];

    const pk = `0x${pKey}`;
    const { signature } = creationRuntime.web3.eth.accounts.sign('Gimme Gimme Gimme!', pk);
    // request a new profile contract

    const requestMode = process.env.TEST_ONBOARDING ? http : https;

    const requestedProfile: any = await new Promise((resolve, reject) => {
      const requestProfilePayload = JSON.stringify({
        companyProfile: profileData.accountDetails.profileType === 'company',
        accountId,
        signature,
        captchaToken: recaptchaToken,
      });
      const reqOptions = {
        hostname: this.getAgentHost(network),
        port: this.getAgentPort(),
        path: '/api/smart-agents/profile/create',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': requestProfilePayload.length,
        },
      };

      const reqProfileReq = requestMode.request(reqOptions, (res) => {
        const chunks = [];
        if (res.statusCode > 299) {
          reject(Error(`Bad response: HTTP ${res.statusCode}: ${res.statusMessage}`));
        }

        res.on('data', (chunk) => {
          chunks.push(chunk);
        });

        res.on('error', (error) => {
          reject(error);
        });

        res.on('end', () => {
          const body = Buffer.concat(chunks);
          resolve(JSON.parse(body.toString()));
        });
      });
      reqProfileReq.write(requestProfilePayload);
      reqProfileReq.end();
    });

    if (profileData.accountDetails.profileType === 'company') {
      // company profile data to fill
      const companyDataToFill = {
        accountDetails: {
          accountName: profileData.accountDetails.companyAlias,
          profileType: 'company',
        },
        registration: profileData.registration,
        contact: profileData.contact,
      };
      // company data
      const companyIdentity = requestedProfile.company.identity;
      const accountHash = creationRuntime.web3.utils.soliditySha3(accountId);
      const companyIdentityHash = creationRuntime.web3.utils.soliditySha3(companyIdentity);
      const companyAccount = creationRuntime.runtimeConfig.useIdentity
        ? companyIdentity : accountId;
      const companyAccountHash = creationRuntime.runtimeConfig.useIdentity ? companyIdentityHash
        : accountHash;

      // user profile data to fill
      const userDataToFill = {
        accountDetails: {
          accountName: profileData.accountDetails.accountName,
          profileType: 'user',
        },
      };
      // user data
      const userIdentity = requestedProfile.user.identity;
      const userIdentityHash = creationRuntime.web3.utils.soliditySha3(userIdentity);
      const userAccount = creationRuntime.runtimeConfig.useIdentity ? userIdentity : accountId;
      const userAccountHash = creationRuntime.runtimeConfig.useIdentity ? userIdentityHash
        : accountHash;

      // Generate company encryption key
      const aes = new Aes();
      const key = await aes.generateKey();
      // eslint-disable-next-line
      creationRuntime.keyProvider.keys[companyAccountHash] = key;
      // eslint-disable-next-line
      creationRuntime.keyProvider.keys[creationRuntime.web3.utils.soliditySha3(companyAccountHash, companyAccountHash)] = key;

      // generate the encryption key with the provided password and the target account
      const dataKey = creationRuntime.web3.utils.sha3(userAccount + password).replace(/0x/g, '');
      // eslint-disable-next-line
      creationRuntime.keyProvider.keys[userAccountHash] = dataKey;
      // eslint-disable-next-line
      creationRuntime.keyProvider.keys[creationRuntime.web3.utils.soliditySha3(userAccountHash, userAccountHash)] = dataKey;

      // generate the communication key
      const commKey = await creationRuntime.keyExchange.generateCommKey();

      // additionalKeys for company
      const additionalKeysCompany = {
        contactKeys: [
          { address: userAccount, context: 'commKey', key: commKey },
        ],
        profileKeys: [
          { address: userAccount, key: 'alias', value: profileData.accountDetails.accountName },
          { address: userAccount, key: 'hasIdentityAccess', value: 'readWrite' },
          { address: userAccount, key: 'identityAccessGranted', value: Date.now().toString() },
          { address: userAccount, key: 'identityAccessNote', value: 'company owner' },
        ],
        shareWith: [
          userAccount,
        ],
      };

      // additionalKeys for user
      const additionalKeysUser = {
        contactKeys: [
          { address: companyAccount, context: 'commKey', key: commKey },
          { address: companyAccount, context: 'identityAccess', key },
        ],
        profileKeys: [
          { address: companyAccount, key: 'alias', value: profileData.accountDetails.companyAlias },
        ],
        shareWith: [
          companyAccount,
        ],
      };

      await Promise.all([
        this.fillProfile(
          requestedProfile.company,
          companyIdentity,
          companyAccount,
          creationRuntime,
          accountId,
          key,
          companyDataToFill,
          network,
          signature,
          additionalKeysCompany,
        ),
        this.fillProfile(
          requestedProfile.user,
          userIdentity,
          userAccount,
          creationRuntime,
          accountId,
          dataKey,
          userDataToFill,
          network,
          signature,
          additionalKeysUser,
        )]);
    } else {
      const newIdentity = requestedProfile.user.identity;
      const accountHash = creationRuntime.web3.utils.soliditySha3(accountId);
      const identityHash = creationRuntime.web3.utils.soliditySha3(newIdentity);
      const targetAccount = creationRuntime.runtimeConfig.useIdentity ? newIdentity : accountId;
      const targetAccountHash = creationRuntime.runtimeConfig.useIdentity ? identityHash
        : accountHash;
      // generate the encryption key with the provided password and the target account
      const dataKey = creationRuntime.web3.utils.sha3(targetAccount + password).replace(/0x/g, '');
      // eslint-disable-next-line
      creationRuntime.keyProvider.keys[targetAccountHash] = dataKey;
      // eslint-disable-next-line
      creationRuntime.keyProvider.keys[creationRuntime.web3.utils.soliditySha3(targetAccountHash, targetAccountHash)] = dataKey;      
      await this.fillProfile(
        requestedProfile.user,
        newIdentity,
        targetAccount,
        creationRuntime,
        accountId,
        password,
        profileData,
        network,
        signature,
      );
    }
  }

  private static async fillProfile(
    requestedProfile: any,
    newIdentity: string,
    targetAccount: string,
    passedRuntime: any,
    accountId: string,
    keys: any,
    profileData: any,
    network = 'testcore',
    signature: any,
    additionalKeys?: any,
  ) {
    const sha3Account = passedRuntime.web3.utils.sha3(accountId);
    const sha3Identity = passedRuntime.web3.utils.sha3(newIdentity);
    const sha9Identity = passedRuntime.web3.utils.sha3(sha3Identity, sha3Identity);
    const creationRuntime = await createDefaultRuntime(
      passedRuntime.web3,
      passedRuntime.dfs,
      {
        ...passedRuntime.runtimeConfig,
        identity: newIdentity,
        keyConfig: {
          [sha3Identity]: passedRuntime[sha3Account],
          [sha9Identity]: passedRuntime[sha3Account],
          ...passedRuntime.runtimeConfig.keyConfig,
        },
      },
    );
    const { profile } = creationRuntime;
    profile.ipld.originator = creationRuntime.web3.utils.soliditySha3(targetAccount);
    profile.activeAccount = targetAccount;
    profile.profileOwner = targetAccount;

    const dhKeys = creationRuntime.keyExchange.getDiffieHellmanKeys();
    await profile.addContactKey(
      targetAccount, 'dataKey', dhKeys.privateKey.toString('hex'),
    );
    await profile.addProfileKey(targetAccount, 'alias', profileData.accountDetails.accountName);
    await profile.addPublicKey(dhKeys.publicKey.toString('hex'));

    if (additionalKeys) {
      for (const { address, context, key } of additionalKeys.contactKeys) {
        await profile.addContactKey(address, context, key);
      }
      for (const { address, key, value } of additionalKeys.profileKeys) {
        await profile.addProfileKey(address, key, value);
      }
    }

    // set initial structure by creating addressbook structure and saving it to ipfs
    const cryptor = creationRuntime.cryptoProvider.getCryptorByCryptoAlgo('aesEcb');
    const fileHashes: any = {};

    const cryptorAes = creationRuntime.cryptoProvider.getCryptorByCryptoAlgo('aes');
    const hashCryptor = creationRuntime.cryptoProvider.getCryptorByCryptoAlgo('aesEcb');
    const [hashKey, blockNr] = await Promise.all([
      hashCryptor.generateKey(),
      creationRuntime.web3.eth.getBlockNumber(),
    ]);

    // setup sharings for new profile
    const sharings = {};
    const profileKeys = Object.keys(profileData);
    await creationRuntime.sharing.extendSharings(
      sharings, targetAccount, targetAccount, '*', 'hashKey', hashKey,
    );
    // extend sharings for profile data
    const dataContentKeys = await Promise.all(profileKeys.map(() => cryptorAes.generateKey()));
    for (let i = 0; i < profileKeys.length; i += 1) {
      await creationRuntime.sharing.extendSharings(
        sharings,
        targetAccount,
        targetAccount,
        profileKeys[i],
        blockNr,
        dataContentKeys[i],
      );
    }

    // extend sharing for profile data with company profile
    if (additionalKeys?.shareWith) {
      for (const shareWith of additionalKeys.shareWith) {
        await creationRuntime.sharing.extendSharings(
          sharings, targetAccount, shareWith, '*', 'hashKey', hashKey,
        );

        for (let i = 0; i < profileKeys.length; i += 1) {
          await creationRuntime.sharing.extendSharings(
            sharings,
            targetAccount,
            shareWith,
            profileKeys[i],
            blockNr,
            dataContentKeys[i],
          );
        }
      }
    }
    // upload sharings
    const sharingsHash = await creationRuntime.dfs.add(
      'sharing',
      Buffer.from(JSON.stringify(sharings), 'utf-8'),
    );

    // used to exclude encrypted hashes from fileHashes.ipfsHashes
    const ipfsExcludeHashes = [];
    // encrypt profileData
    fileHashes.properties = { entries: { } };
    await Promise.all(Object.keys(profileData).map(async (key: string, index: number) => {
      const encrypted = await cryptorAes.encrypt(
        profileData[key],
        { key: dataContentKeys[index] },
      );
      const envelope = {
        private: encrypted.toString('hex'),
        cryptoInfo: cryptorAes.getCryptoInfo(
          creationRuntime.nameResolver.soliditySha3(requestedProfile.contractId),
        ),
      };
      const ipfsHash: any = await creationRuntime.dfs.add(
        key,
        Buffer.from(JSON.stringify(envelope))
      );
      profile.ipld.hashLog.push(`${ipfsHash.toString('hex')}`);

      fileHashes.properties.entries[key] = await cryptor.encrypt(
        Buffer.from(ipfsHash.substr(2), 'hex'),
        { key: hashKey },
      );

      fileHashes.properties.entries[key] = `0x${fileHashes.properties.entries[key]
        .toString('hex')}`;
      ipfsExcludeHashes.push(fileHashes.properties.entries[key]);
    }));

    fileHashes.properties.entries[profile.treeLabels.addressBook] = await profile.storeToIpld(
      profile.treeLabels.addressBook,
    );
    fileHashes.properties.entries[profile.treeLabels.publicKey] = await profile.storeToIpld(
      profile.treeLabels.publicKey,
    );
    fileHashes.sharingsHash = sharingsHash;
    fileHashes.properties.entries[profile.treeLabels.addressBook] = await cryptor.encrypt(
      Buffer.from(fileHashes.properties.entries[profile.treeLabels.addressBook].substr(2), 'hex'),
      { key: hashKey },
    );
    fileHashes.properties.entries[profile.treeLabels.addressBook] = `0x${fileHashes.properties.entries[profile.treeLabels.addressBook].toString('hex')}`;
    // keep only unique values, ignore addressbook (encrypted hash)
    fileHashes.ipfsHashes = [
      ...profile.ipld.hashLog,
      ...Object.keys(fileHashes.properties.entries)
        .map((key) => fileHashes.properties.entries[key]),
    ];
    fileHashes.ipfsHashes = (
      (arrArg) => arrArg.filter(
        (elem, pos, arr) => arr.indexOf(elem) === pos
          && (elem !== fileHashes.properties.entries[profile.treeLabels.addressBook]
            && ipfsExcludeHashes.indexOf(elem) === -1),
      )
    )(fileHashes.ipfsHashes);
    // clear hash log
    profile.ipld.hashLog = [];


    const data = {
      accountId,
      identityId: creationRuntime.runtimeConfig.useIdentity ? newIdentity : undefined,
      signature,
      profileInfo: fileHashes,
      accessToken: requestedProfile.accessToken,
      contractId: requestedProfile.contractId,
    } as any;

    // TODO if statement can be removed after account/identity switch is done
    if (creationRuntime.runtimeConfig.useIdentity) {
      const didTransactionTuple = await this.createOfflineDidTransaction(creationRuntime,
        accountId, requestedProfile.identity);
      const didTransaction = didTransactionTuple[0];
      const documentHash = didTransactionTuple[1];
      data.didTransaction = didTransaction;
      fileHashes.ipfsHashes.push(documentHash);
    }

    // re-enable pinning
    profile.ipld.ipfs.disablePin = false;
    const requestMode = process.env.TEST_ONBOARDING ? http : https;

    const jsonPayload = JSON.stringify(data);
    const options = {
      hostname: this.getAgentHost(network),
      port: this.getAgentPort(),
      path: '/api/smart-agents/profile/fill',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': jsonPayload.length,
      },
    };

    await new Promise((resolve, reject) => {
      const req = requestMode.request(options, (res) => {
        if (res.statusCode > 299) {
          reject(Error(`Bad response: HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
        res.on('data', () => {
          resolve();
        });
      });
      req.on('error', (error) => {
        reject(error);
      });

      req.write(jsonPayload);
      req.end();
    });
  }

  /**
   * Create an offline did document for an account identity transaction
   *
   * @param runtime Runtime object
   * @param accountId Account ID of the identity's owner
   */
  private static async createOfflineDidTransaction(
    runtime: any,
    account: string,
    identity: string,
  ): Promise<[VerificationsDelegationInfo, string]> {
    const underlyingSigner = new SignerInternal({
      accountStore: runtime.accountStore,
      contractLoader: runtime.contractLoader,
      config: {},
      web3: runtime.web3,
    });
    const signer = new SignerIdentity({
      contractLoader: runtime.contractLoader,
      verifications: runtime.verifications,
      web3: runtime.web3,
    },
    {
      activeIdentity: identity,
      underlyingAccount: account,
      underlyingSigner,
    });

    if (runtime.activeAccount !== runtime.activeIdentity) {
      const updateConfig = {
        activeIdentity: identity,
        underlyingAccount: account,
      };
      runtime.verifications.options.executor.signer.updateConfig({
        verifications: runtime.verifications,
      }, {
        ...updateConfig,
        underlyingSigner,
      });
      runtime.verifications.updateConfig({ }, updateConfig);
    }

    const did = new Did({
      accountStore: runtime.accountStore,
      contractLoader: runtime.contractLoader,
      dfs: runtime.dfs,
      executor: runtime.executor,
      nameResolver: runtime.nameResolver,
      signerIdentity: signer,
      verifications: runtime.verifications,
      web3: runtime.web3,
    });

    const doc = await did.getDidDocumentTemplate();
    const identityDid = await did.convertIdentityToDid(identity);
    const [txInfo, documentHash] = await did.setDidDocumentOffline(identityDid, doc, identity);

    return [txInfo, documentHash];
  }

  /**
   * Checks for env variable TEST_ONBOARDING and if given
   * issues http requests to localhost (used for testing)
   *
   * @param {string} network Network to use
   * @returns {string} host address
   */
  private static getAgentHost(network: string): string {
    if (process.env.TEST_ONBOARDING) {
      return 'localhost';
    }
    return `agents${network === 'testcore' ? '.test' : ''}.evan.network`;
  }

  /**
   * Checks for env variable and if given
   * parses given port number to use for http requests (used for testing)
   *
   * @returns {number} port
   */
  private static getAgentPort(): number {
    if (process.env.TEST_ONBOARDING) {
      const { port } = JSON.parse(process.env.TEST_ONBOARDING);
      return port;
    }
    return 443;
  }

  /**
   * send invitation to another user via smart agent that sends a mail
   *
   * @param      {InvitationMail}  invitation  mail that will be sent to invited person
   * @param      {string}          weiToSend   amount of ETC to transfert to new member, can be
   *                                           created with web3.utils.toWei(10, 'ether')
   *                                           [web3 >=1.0] / web.toWei(10, 'ether') [web3 < 1.0]
   * @return     {Promise<void>}   resolved when done
   */
  public async sendInvitation(invitation: InvitationMail, weiToSend: string): Promise<void> {
    // build bmail container
    const mail: Mail = {
      content: {
        attachments: [{
          type: 'onboardingEmail',
          data: JSON.stringify(invitation),
        }],
      },
    };

    // send mail to smart agent
    await this.options.mailbox.sendMail(
      mail, this.options.mailbox.mailboxOwner, this.options.smartAgentId, weiToSend,
    );
  }
}
