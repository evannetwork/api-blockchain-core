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

import crypto = require('crypto-browserify');

import {
  ContractLoader,
  KeyProvider,
  Logger,
  LoggerOptions,
  NameResolver,
} from '@evan.network/dbcp';

import { Aes } from './encryption/aes';
import { CryptoProvider } from './encryption/crypto-provider';
import { Ipld } from './dfs/ipld';
import { Ipfs } from './dfs/ipfs';
import { Mail, Mailbox } from './mailbox';


/**
 * parameters for KeyExchange constructor
 */
export interface KeyExchangeOptions extends LoggerOptions {
  account: string;
  cryptoProvider: CryptoProvider;
  defaultCryptoAlgo: string;
  keyProvider: KeyProvider;
  mailbox: Mailbox;
  privateKey?: string;
  publicKey?: string;
}

/**
 * The KeyExchange module is used to exchange communication keys between two parties, assuming that
 * both have created a profile and public have a public facing partial Diffie Hellman key part (the
 * combination of their own secret and the shared secret)
 *
 * @class      KeyExchange (name)
 */
export class KeyExchange extends Logger {

  private SHARED_SECRET = Buffer.from('a832d7a4c60473d4fcddabf5c31f5b64dcb2382bbebbeb7c49b6cfc2f08fe9c3', 'hex');
  private diffieHellman: any;
  private COMM_KEY_CONTEXT = 'mailboxKeyExchange';
  private mailbox: Mailbox;
  private cryptoProvider: CryptoProvider;
  private defaultCryptoAlgo: string;
  private account: string;
  private keyProvider: KeyProvider;
  private aes: Aes;

  public publicKey: string;

  /**
   * Creates an instance of KeyExchange.
   * @param {KeyExchangeOptions} options
   * @memberof KeyExchange
   */
  constructor(options: KeyExchangeOptions) {
    super(options);
    this.aes = new Aes();
    this.mailbox = options.mailbox;
    this.diffieHellman = crypto.createDiffieHellman(this.SHARED_SECRET);

    if (options.publicKey && options.privateKey) {
      this.diffieHellman.setPublicKey(options.publicKey);
      this.diffieHellman.setPrivateKey(options.privateKey);
    } else {
      this.diffieHellman.generateKeys('hex');
    }
    this.cryptoProvider = options.cryptoProvider;
    this.defaultCryptoAlgo = options.defaultCryptoAlgo;
    this.account = options.account;
    this.keyProvider = options.keyProvider;
  }

  /**
   * combines given partial key from another profile with own private key
   *
   * @param      {string}  partialKey  publicKey(shared + private) from another profile
   * @return     {string}  combined exchange key
   */
  public computeSecretKey(partialKey: string) {
    const secret = this.diffieHellman.computeSecret(Buffer.from(partialKey, 'hex'), 'hex');
    return secret;
  }

  /**
   * decrypts a given communication key with an exchange key
   *
   * @param      {string}           encryptedCommKey  encrypted communications key received from another account
   * @param      {string}           exchangeKey       Diffie Hellman exchange key from computeSecretKey
   * @return     {Promise<Buffer>}  commKey as a buffer
   */
  public async decryptCommKey(encryptedCommKey: string, exchangeKey: string): Promise<Buffer> {
    const cryptor = this.cryptoProvider.getCryptorByCryptoAlgo(this.defaultCryptoAlgo);
    return await cryptor.decrypt(Buffer.from(encryptedCommKey, 'hex'), { key: exchangeKey, });
  }

  /**
   * returns the public and private key from the diffieHellman
   *
   * @return     {any}  public and private key from the diffieHellman.
   */
  public getDiffieHellmanKeys() {
    return {
      publicKey: this.diffieHellman.getPublicKey(),
      privateKey: this.diffieHellman.getPrivateKey(),
    }
  }

  /**
   * generates a new communication key end returns the hex string
   *
   * @return     {string}  comm key as string
   */
  public async generateCommKey() {
    return this.aes.generateKey();
  }

  /**
   * creates a bmail for exchanging comm keys
   *
   * @param      {string}  from              sender accountId
   * @param      {any}     mailContent       bmail metadata
   * @param      {string}  encryptedCommKey  comm key, that should be exchanged
   * @return     {Mail}    bmail for key exchange
   */
  public getExchangeMail = (from: string, mailContent: any, encryptedCommKey?: string): Mail => {
    const ret: Mail = {
      content: {
        from,
        fromAlias : mailContent.fromAlias,
        fromMail : mailContent.fromMail,
        title: mailContent.title,
        body: mailContent.body,
        attachments: mailContent.attachments || []
      }
    };

    ret.content.title = ret.content.title || 'Contact request';
    ret.content.body = ret.content.body || `Hi,

I'd like to add you as a contact. Do you accept my invitation?

With kind regards,

${mailContent && mailContent.fromAlias || from}`;
    ret.content.attachments.push({
      type: 'commKey',
      key: encryptedCommKey
    });
    return ret;
  };

  /**
   * sends a mailbox mail to the target account with the partial key for the key exchange
   *
   * @param      {string}         targetAccount    receiver of the invitation
   * @param      {string}         targetPublicKey  combination of shared secret plus targetAccounts
   *                                               private secret
   * @param      {string}         commKey          communication key between sender and
   *                                               targetAccount
   * @param      {any}            mailContent      mail to send
   * @return     {Promise<void>}  resolved when done
   */
  public async sendInvite(targetAccount: string, targetPublicKey: string, commKey: string, mailContent: any): Promise<void> {
    const secret = this.computeSecretKey(targetPublicKey).toString('hex');
    const cryptor = this.cryptoProvider.getCryptorByCryptoAlgo(this.defaultCryptoAlgo);
    const encryptedCommKey = await cryptor.encrypt(commKey, { key: secret, });
    await this.mailbox.sendMail(
      this.getExchangeMail(this.account, mailContent, encryptedCommKey.toString('hex')),
      this.account,
      targetAccount,
      '0',
      'mailboxKeyExchange'
    );
  }

  /**
   * set the private and public key on the current diffieHellman object
   *
   * @param      {string}  publicKey   public Diffie Hellman key
   * @param      {string}  privateKey  private Diffie Hellman key
   */
  public setPublicKey(publicKey: string, privateKey: string) {
    this.diffieHellman.setPrivateKey(Buffer.from(privateKey, 'hex'));
    this.diffieHellman.setPublicKey(Buffer.from(publicKey, 'hex'));
  }
}
