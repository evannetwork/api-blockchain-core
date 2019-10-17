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
// import https = require('https');
import http = require('http');

import {
  Logger,
  LoggerOptions,
} from '@evan.network/dbcp';

import { Ipfs } from './dfs/ipfs';
import { Mail, Mailbox } from './mailbox';
import { createDefaultRuntime } from './runtime';

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
  options: OnboardingOptions;


  /**
   * creates a new random mnemonic
   */
  public static createMnemonic(): string {
    return KeyStore.generateRandomSeed();
  }

  /**
   * Creates a new profile for a given mnemonic, and password
   *
   * @param      {string}  mnemonic  given mnemonic for the new profile
   * @param      {string}  password  password for the given profile
   * @param      {string}  network   selected network (testcore/core) - defaults to testcore
   *
   * @return     {Promise<any>}   resolved when done
   */
  public static async createNewProfile(mnemonic: string, password: string, network = 'testcore'
  ): Promise<any> {
    if (!mnemonic) {
      throw new Error(`mnemonic is a required parameter!`);
    }

    if (!password) {
      throw new Error(`password is a required parameter!`);
    }

    if (network !== 'testcore' && network !== 'core') {
      throw new Error(`a valid network (testcore/core) must be specified`);
    }

    const web3Provider = `wss://${network}.evan.network/ws`;
    // use Web3 without its typings to avoid issues with constructor typing
    const web3 = new (Web3 as any)(web3Provider, null, { transactionConfirmationBlocks: 1 });

    const runtimeConfig: any = await Onboarding.generateRuntimeConfig(mnemonic, password, web3);

    const accountId = Object.keys((runtimeConfig).accountMap)[0];
    const privateKey = (runtimeConfig).accountMap[accountId];
    const ipfs = new Ipfs({
      dfsConfig: {
        host: `ipfs${network === 'testcore' ? '.test' : ''}.evan.network`,
        port: '443',
        protocol: 'https'
      },
      disablePin: true,
      accountId: accountId,
      privateKey: `0x${privateKey}`,
      web3
    });

    const runtime = await createDefaultRuntime(web3, ipfs, runtimeConfig);

    await Onboarding.createOfflineProfile(
      runtime, 'Generated via API', accountId, privateKey, network)

    return {
      mnemonic,
      password,
      runtimeConfig
    }
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
   * @param      {any}     runtime    initialized runtime
   * @param      {string}  alias      alias of the profile
   * @param      {string}  accountId  accountId of the privateKey
   * @param      {string}  pKey       private key
   * @param      {string}  network    selected network (testcore/core) - defaults to testcore
   */
  public static async createOfflineProfile(
    runtime: any,
    alias: string,
    accountId: string,
    pKey: string,
    network = 'testcore'
  ) {
    return new Promise(async (resolve, reject) => {
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
        });

        const reqOptions = {
          // hostname: `agents${network === 'testcore' ? '.test' : ''}.evan.network`,
          hostname: `192.168.100.166`,
          // port: 443,
          port: 8080,
          path: '/api/smart-agents/profile/create',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': requestProfilePayload.length
          }
        };

        const reqProfileReq = http.request(reqOptions, function (res) {
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
      await profile.addProfileKey(runtime.activeAccount, 'alias', alias);
      await profile.addPublicKey(dhKeys.publicKey.toString('hex'));


      // set initial structure by creating addressbook structure and saving it to ipfs
      const cryptor = runtime.cryptoProvider.getCryptorByCryptoAlgo('aesEcb');
      const fileHashes: any = {};


      const cryptorAes = runtime.cryptoProvider.getCryptorByCryptoAlgo(
        runtime.dataContract.options.defaultCryptoAlgo);
      const hashCryptor = runtime.cryptoProvider.getCryptorByCryptoAlgo(
        runtime.dataContract.cryptoAlgorithHashes);
      const [accountDetailsContentKey, hashKey, blockNr] = await Promise.all(
        [cryptorAes.generateKey(), hashCryptor.generateKey(), runtime.web3.eth.getBlockNumber()]);

      const sharings =  {};
      await runtime.sharing.extendSharings(
        sharings, accountId, accountId, 'accountDetails', blockNr, accountDetailsContentKey);
      await runtime.sharing.extendSharings(
        sharings, accountId, accountId, '*', 'hashKey', hashKey);

      let sharingsHash = await runtime.dfs.add(
        'sharing', Buffer.from(JSON.stringify(sharings), runtime.dataContract.encodingUnencrypted));

      const accountDetails = await cryptorAes.encrypt({
        accountName: alias
      }, {
        key: accountDetailsContentKey
      });

      const envelope = {
        private: accountDetails.toString('hex'),
        cryptoInfo: cryptorAes.getCryptoInfo(
          runtime.nameResolver.soliditySha3((requestedProfile as any).contractId)),
      };
      let accountDetailsHash = await runtime.dfs.add(
        'accountDetails', Buffer.from(JSON.stringify(envelope)));
      profile.ipld.hashLog.push(`${ accountDetailsHash.toString('hex') }`)
      fileHashes.properties  = {
        entries: {
          accountDetails: await cryptor.encrypt(
            Buffer.from(accountDetailsHash.substr(2), 'hex'),
            { key: hashKey, })
        }
      }

      fileHashes.properties.entries.accountDetails = `0x${ fileHashes.properties.entries.accountDetails
        .toString('hex') }`;

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
              elem !== fileHashes.properties.entries.accountDetails)
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
        // hostname: `agents${network === 'testcore' ? '.test' : ''}.evan.network`,
        hostname: `192.168.100.166`,
        // port: 443,
        port: 8080,
        path: '/api/smart-agents/profile/fill',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      }

      // const req = https.request(options, (res) => {
      const req = http.request(options, (res) => {
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

  constructor(optionsInput: OnboardingOptions) {
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
  async sendInvitation(invitation: InvitationMail, weiToSend: string): Promise<void> {
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
