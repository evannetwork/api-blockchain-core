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

import KeyStore = require('../libs/eth-lightwallet/keystore');
import Web3 = require('web3');
import https = require('https');
import { cloneDeep, merge } from 'lodash';

import {
  Logger,
  LoggerOptions,
} from '@evan.network/dbcp';

import { createDefaultRuntime, Runtime } from './runtime';
import { Ipfs } from './dfs/ipfs';
import { Mail, Mailbox } from './mailbox';
import { Profile } from './profile/profile';
import * as AccountType from './profile/types/types';

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

  public static async createNewProfile(runtime: Runtime, mnemonic: string, password: string, profileProperties: any
  ): Promise<any> {
    if (!mnemonic) {
      throw new Error(`mnemonic is a required parameter!`);
    }

    if (!password) {
      throw new Error(`password is a required parameter!`);
    }

    const runtimeConfig: any = await Onboarding.generateRuntimeConfig(mnemonic, password, runtime.web3);
    const runtimeNew = await createDefaultRuntime(runtime.web3, runtime.dfs, runtimeConfig);

    // check if the source runtime has enough funds
    const profileCost = runtime.web3.utils.toWei('1.0097');
    const runtimeFunds = await runtime.web3.eth.getBalance(runtime.activeAccount);
    console.log(runtimeFunds)
    const BN = runtime.web3.utils.BN;
    if ((new BN(runtimeFunds)).lt(new BN(profileCost))) {
      throw new Error(`The account ${runtime.activeAccount} has less than 1.0097 EVE to create a new profile`);
    }

    try {
      await Profile.checkCorrectProfileData(
        profileProperties,
        profileProperties.accountDetails.profileType
      );
    } catch (ex) {
      throw new Error('The parameters passed are incorrect, profile properties need to be reconfigured')
    }

    await runtime.executor.executeSend({
      from: runtime.activeAccount,
      to: runtimeNew.activeAccount,
      value: profileCost
    })

    await Onboarding.createProfile(runtimeNew, profileProperties)

    return {
      mnemonic,
      password,
      runtimeConfig
    }
  }



  /**
   * create new profile, store it to profile index initialize addressBook and publicKey
   *
   * @param      {string}         keys    communication key to store
   * @return     {Promise<void>}  resolved when done
   */
  public static async createProfile(runtime, profileData: any): Promise<void> {

    const factoryDomain = runtime.nameResolver.getDomainName(
      runtime.nameResolver.config.domains.profileFactory);
    const factoryAddress = await runtime.nameResolver.getAddress(factoryDomain);

    const combinedDataSchema = merge(
        ...Object.keys(AccountType).map(accountType => cloneDeep(AccountType[accountType])))
    const properties = combinedDataSchema.template.properties
    const ajvProperties = {}
    for (let key of Object.keys(properties)) {
      ajvProperties[key] = properties[key].dataSchema
    }
    const dataSchemaEntries =
      Object.keys(ajvProperties).filter(property => ajvProperties[property].type !== 'array')
    const dataSchemaLists =
      Object.keys(ajvProperties).filter(property => ajvProperties[property].type === 'array')

    const description = {
      public: {
        name: 'Container Contract (DataContract)',
        description: 'Container for Digital Twin Data',
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
      'description', Buffer.from(JSON.stringify(description), 'binary'));

    const factory = runtime.contractLoader.loadContract(
      'ProfileDataContractFactoryInterface', factoryAddress)
    const contractId = await runtime.executor.executeContractTransaction(
      factory,
      'createContract',
      {
        from: runtime.activeAccount,
        autoGas: 1.1,
        event: { target: 'BaseContractFactoryInterface', eventName: 'ContractCreated', },
        getEventResult: (event, args) => args.newAddress,
      },
      '0x'.padEnd(42, '0'),
      runtime.activeAccount,
      descriptionHash,
      runtime.nameResolver.config.ensAddress,
      [...Object.values(runtime.profile.treeLabels), ...dataSchemaEntries]
        .map(name => runtime.nameResolver.soliditySha3(name)),
      dataSchemaLists
        .map(name => runtime.nameResolver.soliditySha3(name)),
    );
    const contractInterface =
      runtime.contractLoader.loadContract('DataContractInterface', contractId);
    const rootDomain = runtime.nameResolver.namehash(
      runtime.nameResolver.getDomainName(
        runtime.nameResolver.config.domains.root));
    await runtime.executor.executeContractTransaction(
      contractInterface,
      'init',
      { from: runtime.activeAccount, autoGas: 1.1, },
      rootDomain,
      false,
    );


   // set initial structure by creating addressbook structure and saving it to ipfs
    const cryptor = runtime.cryptoProvider.getCryptorByCryptoAlgo('aesEcb');
    const fileHashes: any = {};
    const encodingUnencrypted = 'utf-8';
    const encodingEncrypted = 'hex';
    const encodingUnencryptedHash = 'hex';
    const cryptoAlgorithHashes = 'aesEcb';
    const cryptorAes = runtime.cryptoProvider.getCryptorByCryptoAlgo(
      'aes');
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
      sharings, runtime.activeAccount, runtime.activeAccount, '*', 'hashKey', hashKey);
    // extend sharings for profile data
    const dataContentKeys = await Promise.all(profileKeys.map(() => cryptorAes.generateKey()));
    for (let i = 0; i < profileKeys.length; i++) {
      await runtime.sharing.extendSharings(
        sharings, runtime.activeAccount, runtime.activeAccount, profileKeys[i], blockNr, dataContentKeys[i]);
    }
    // upload sharings
    let sharingsHash = await runtime.dfs.add(
      'sharing', Buffer.from(JSON.stringify(sharings), encodingUnencrypted));




    runtime.profile.profileOwner = runtime.activeAccount;
    runtime.profile.profileContract = runtime.contractLoader.loadContract('DataContract', contractId)

    await runtime.executor.executeContractTransaction(
      runtime.profile.profileContract,
      'setSharing',
      { from: runtime.activeAccount, autoGas: 1.1, },
      sharingsHash
    );
    const dhKeys = runtime.keyExchange.getDiffieHellmanKeys();
    await Promise.all([
      // call `setEntry` for each pre-build entry value
      ...((profileData ?  Object.keys(profileData) : [])
        .map(entry =>
          runtime.dataContract.setEntry(
            runtime.profile.profileContract,
            entry,
            profileData[entry],
            runtime.activeAccount,
          )
        )
      ),
      (async () => {
        await runtime.profile.addContactKey(
          runtime.activeAccount, 'dataKey', dhKeys.privateKey.toString('hex'));
        await runtime.profile.addProfileKey(runtime.activeAccount, 'alias', profileData.accountDetails.accountName);
        await runtime.profile.addPublicKey(dhKeys.publicKey.toString('hex'));
        await runtime.profile.storeForAccount(runtime.profile.treeLabels.addressBook);
        await runtime.profile.storeForAccount(runtime.profile.treeLabels.publicKey);
      })(),
      (async () => {
        const profileIndexDomain = runtime.nameResolver.getDomainName(
          runtime.nameResolver.config.domains.profile);

        const profileIndexAddress = await runtime.nameResolver.getAddress(profileIndexDomain);
        // register profile for user
        const profileIndexContract = runtime.contractLoader.loadContract(
          'ProfileIndexInterface', profileIndexAddress);
        await runtime.executor.executeContractTransaction(
          profileIndexContract,
          'setMyProfile',
          { from: runtime.activeAccount, autoGas: 1.1, },
          runtime.profile.profileContract.options.address,
        );
      })()
    ])

  }

  /**
   * generates a runtime config for a given mneomic and password
   *
   * @param      {string}  mnemonic  specified mnemonic
   * @param      {string}  password  given password
   * @param      {any}     web3      web3 instance
   */
  public static async generateRuntimeConfig(mnemonic: string, password: string, web3: any) {
    // generate a new vault from the mnemnonic and the password
    const vault: any = await new Promise((res) => {
      KeyStore.createVault({
        seedPhrase: mnemonic,
        password: password,
        hdPathString : 'm/45\'/62\'/13\'/7'
      }, (err, result) => {
        res(result)
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
    const sha3Account = web3.utils.soliditySha3(accountId)
    const dataKey = web3.utils
      .keccak256(accountId + password)
      .replace(/0x/g, '');
    const runtimeConfig = {
      accountMap: {
        [accountId]: pKey
      },
      keyConfig: {
        [sha9Account]: dataKey,
        [sha3Account]: dataKey
      }
    };

    return runtimeConfig;
  };

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
    network = 'testcore'
  ) {
    // check for correct profile data
    if (!profileData || !profileData.accountDetails || !profileData.accountDetails.accountName) {
      throw new Error('No profile data specified or accountDetails missing');
    }
    profileData.accountDetails.profileType = profileData.accountDetails.profileType || 'user';

    // fill empty container type
    if (!profileData.type) {
      profileData.type = 'profile';
    }

    // build array with allowed fields (may include duplicates)
    Profile.checkCorrectProfileData(profileData, profileData.accountDetails.profileType);

    const profile = runtime.profile;
    // disable pinning while profile files are being created
    profile.ipld.ipfs.disablePin = true;
    // clear hash log
    profile.ipld.hashLog = [];

    const pk = '0x' + pKey;
    const signature = runtime.web3.eth.accounts.sign('Gimme Gimme Gimme!', pk).signature;
    // request a new profile contract

    const requestedProfile = await new Promise((resolve) => {
      const requestProfilePayload = JSON.stringify({
        accountId: accountId,
        signature: signature,
        captchaToken: recaptchaToken
      });

      const reqOptions = {
        hostname: `agents${network === 'testcore' ? '.test' : ''}.evan.network`,
        port: 443,
        path: '/api/smart-agents/profile/create',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': requestProfilePayload.length
        }
      };

      const reqProfileReq = https.request(reqOptions, function (res) {
        const chunks = [];

        res.on('data', function (chunk) {
          chunks.push(chunk);
        });

        res.on('end', function () {
          const body = Buffer.concat(chunks);
          resolve(JSON.parse(body.toString()))
        });
      });
      reqProfileReq.write(requestProfilePayload);
      reqProfileReq.end();
    })

    const dhKeys = runtime.keyExchange.getDiffieHellmanKeys();
    await profile.addContactKey(
      runtime.activeAccount, 'dataKey', dhKeys.privateKey.toString('hex'));
    await profile.addProfileKey(runtime.activeAccount, 'alias', profileData.accountDetails.accountName);
    await profile.addPublicKey(dhKeys.publicKey.toString('hex'));

    // set initial structure by creating addressbook structure and saving it to ipfs
    const cryptor = runtime.cryptoProvider.getCryptorByCryptoAlgo('aesEcb');
    const fileHashes: any = {};

    const cryptorAes = runtime.cryptoProvider.getCryptorByCryptoAlgo(
      runtime.dataContract.options.defaultCryptoAlgo);
    const hashCryptor = runtime.cryptoProvider.getCryptorByCryptoAlgo(
      runtime.dataContract.cryptoAlgorithHashes);
    const [hashKey, blockNr] = await Promise.all([
      hashCryptor.generateKey(),
      runtime.web3.eth.getBlockNumber(),
    ]);

    // setup sharings for new profile
    const sharings = {};
    const profileKeys = Object.keys(profileData);
    // add hashKey
    await runtime.sharing.extendSharings(
      sharings, accountId, accountId, '*', 'hashKey', hashKey);
    // extend sharings for profile data
    const dataContentKeys = await Promise.all(profileKeys.map(() => cryptorAes.generateKey()));
    for (let i = 0; i < profileKeys.length; i++) {
      await runtime.sharing.extendSharings(
        sharings, accountId, accountId, profileKeys[i], blockNr, dataContentKeys[i]);
    }
    // upload sharings
    let sharingsHash = await runtime.dfs.add(
      'sharing', Buffer.from(JSON.stringify(sharings), runtime.dataContract.encodingUnencrypted));

    // used to exclude encrypted hashes from fileHashes.ipfsHashes
    const ipfsExcludeHashes = [ ];
    // encrypt profileData
    fileHashes.properties = { entries: { } };
    await Promise.all(Object.keys(profileData).map(async (key: string, index: number) => {
      const encrypted = await cryptorAes.encrypt(
        profileData[key],
        { key: dataContentKeys[index] }
      );
      const envelope = {
        private: encrypted.toString('hex'),
        cryptoInfo: cryptorAes.getCryptoInfo(
          runtime.nameResolver.soliditySha3((requestedProfile as any).contractId)),
      };
      let ipfsHash = await runtime.dfs.add(key, Buffer.from(JSON.stringify(envelope)));
      profile.ipld.hashLog.push(`${ ipfsHash.toString('hex') }`);

      fileHashes.properties.entries[key] = await cryptor.encrypt(
        Buffer.from(ipfsHash.substr(2), 'hex'),
        { key: hashKey, }
      );

      fileHashes.properties.entries[key] = `0x${ fileHashes.properties.entries[key]
        .toString('hex') }`;
      ipfsExcludeHashes.push(fileHashes.properties.entries[key]);
    }));

    fileHashes.properties.entries[profile.treeLabels.addressBook] =
      await profile.storeToIpld(profile.treeLabels.addressBook);
    fileHashes.properties.entries[profile.treeLabels.publicKey] =
      await profile.storeToIpld(profile.treeLabels.publicKey);
    fileHashes.sharingsHash = sharingsHash;
    fileHashes.properties.entries[profile.treeLabels.addressBook] = await cryptor.encrypt(
      Buffer.from(fileHashes.properties.entries[profile.treeLabels.addressBook].substr(2), 'hex'),
      { key: hashKey, }
    )
    fileHashes.properties.entries[profile.treeLabels.addressBook] =
      `0x${fileHashes.properties.entries[profile.treeLabels.addressBook].toString('hex')}`;
    // keep only unique values, ignore addressbook (encrypted hash)
    fileHashes.ipfsHashes = [
      ...profile.ipld.hashLog,
      ...Object.keys(fileHashes.properties.entries)
        .map(key => fileHashes.properties.entries[key]),
    ];
    fileHashes.ipfsHashes = (
      (arrArg) => arrArg.filter(
        (elem, pos, arr) =>
          arr.indexOf(elem) === pos &&
          (elem !== fileHashes.properties.entries[profile.treeLabels.addressBook] &&
            ipfsExcludeHashes.indexOf(elem) === -1)
      )
    )(fileHashes.ipfsHashes);
    // clear hash log
    profile.ipld.hashLog = [];
    // re-enable pinning
    profile.ipld.ipfs.disablePin = false;

    const data = JSON.stringify({
      accountId: accountId,
      signature: signature,
      profileInfo: fileHashes,
      accessToken: (requestedProfile as any).accessToken,
      contractId: (requestedProfile as any).contractId,
    })
    const options = {
      hostname: `agents${network === 'testcore' ? '.test' : ''}.evan.network`,
      port: 443,
      path: '/api/smart-agents/profile/fill',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }

    await new Promise(async (resolve, reject) => {
      const req = https.request(options, (res) => {
        res.on('data', () => {
          resolve()
        })
      })

      req.on('error', (error) => {
        reject(error)
      })

      req.write(data)
      req.end()
    });
  }

  public constructor(optionsInput: OnboardingOptions) {
    super(optionsInput);
    this.options = optionsInput;
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
        }]
      }
    };

    // send mail to smart agent
    await this.options.mailbox.sendMail(
      mail, this.options.mailbox.mailboxOwner, this.options.smartAgentId, weiToSend);
  }
}
