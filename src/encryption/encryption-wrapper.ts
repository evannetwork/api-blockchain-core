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

import {
  CryptoInfo,
  Envelope,
  Logger,
  LoggerOptions,
  NameResolver,
} from '@evan.network/dbcp';

import { CryptoProvider } from './crypto-provider';
import { Profile } from '../profile/profile';


export enum EncryptionWrapperKeyType {
  Profile = 'profile',
}

export enum EncryptionWrapperCryptorType {
  Content = 'aes-256-cbc',
  File = 'aes-blob',
  Unencrypted = 'unencrypted',
}

/**
 * encryption wrapper instance options
 */
export interface EncryptionWrapperOptions extends LoggerOptions {
  cryptoProvider: CryptoProvider;
  nameResolver: NameResolver;
  profile: Profile;
  web3: any;
}


/**
 * wrapper for aes-blob, transforms unencrypted files to Envelopes
 *
 * @class      EncryptionWrapper (name)
 */
export class EncryptionWrapper extends Logger {
  static defaultOptions = {
    keyLength: 256,
    algorithm: 'aes-blob',
  };

  private readonly encodingUnencrypted = 'utf-8';
  private readonly encodingEncrypted = 'hex';

  options: EncryptionWrapperOptions;

  constructor(options?: EncryptionWrapperOptions) {
    super(options);
    this.options = { ...options };
  }

  /**
   * decrypt given envelope
   *
   * @param      {Envelope}  toDecrypt  encrypted envelop
   */
  public async decrypt(toDecrypt: Envelope): Promise<any> {
    const [ cryptor, key ] = await Promise.all([
      this.options.cryptoProvider.getCryptorByCryptoInfo(toDecrypt.cryptoInfo),
      this.getKey(toDecrypt.cryptoInfo),
    ]);

    const decrypted = await cryptor.decrypt(
      Buffer.from(toDecrypt.private, this.encodingEncrypted), { key });
    return decrypted;
  }

  /**
   * encrypt given object, depending on given cryptoInfo, additional information may be required,
   * which can be given via ``artifacts``
   *
   * @param      {any}         toEncrypt   object to encrypt
   * @param      {CryptoInfo}  cryptoInfo  details for encryption, can be created with
   *                                       `getCryptoInfos`
   * @param      {any}         artifacts   additional information for decrypting
   */
  public async encrypt(toEncrypt: any, cryptoInfo: CryptoInfo, artifacts?: any): Promise<Envelope> {
    const [ cryptor, key ] = await Promise.all([
      this.options.cryptoProvider.getCryptorByCryptoInfo(cryptoInfo),
      this.getKey(cryptoInfo),
    ]);

    if (!cryptor) {
      throw new Error(`no cryptor found for cryptoInfo "${cryptoInfo}"`);
    }
    if (!key) {
      throw new Error(`no key found for cryptoInfo "${cryptoInfo}"`);
    }

    const encryptedBuffer = await cryptor.encrypt(toEncrypt, { key });
    const encrypted = encryptedBuffer.toString(this.encodingEncrypted);
    const envelope: Envelope = {
      private: encrypted,
      cryptoInfo: { ...cryptoInfo },
    };
    return envelope;
  }

  /**
   * generate new encryption key, uses ``cryptoInfo`` to decide which ``cryptor`` to use for this
   *
   * @param      {CryptoInfo}  cryptoInfo  details for encryption, can be created with
   *                                       `getCryptoInfos`
   */
  public async generateKey(cryptoInfo: CryptoInfo): Promise<any> {
    const cryptor = this.options.cryptoProvider.getCryptorByCryptoInfo(cryptoInfo);
    return cryptor.generateKey();
  }

  /**
   * create new ``CryptoInfo`` instance
   *
   * @param      {any}                           keyContext   used to identify key
   * @param      {EncryptionWrapperKeyType}      keyType      defines where keys are stored
   * @param      {EncryptionWrapperCryptorType}  cryptorType  cryptor to use
   */
  public async getCryptoInfo(
    keyContext: any,
    keyType: EncryptionWrapperKeyType,
    cryptorType: EncryptionWrapperCryptorType = EncryptionWrapperCryptorType.Content,
  ): Promise<CryptoInfo> {
    switch (keyType) {
      case EncryptionWrapperKeyType.Profile: {
        return {
          algorithm: cryptorType,
          block: await this.options.web3.eth.getBlockNumber(),
          originator: `profile:${keyContext}`,
        };
      }
      default:
        throw new Error(`unknown key type "${keyType}"`);
    }
  }

  /**
   * get key for given ``cryptoInfo``
   *
   * @param      {CryptoInfo}  cryptoInfo  details for encryption, can be created with
   *                                       `getCryptoInfos`
   */
  public async getKey(cryptoInfo: CryptoInfo) {
    let result;
    const split = cryptoInfo.originator.split(':');
    if (split.length < 2) {
      throw new Error(`unsupported originator "${cryptoInfo.originator}" at crypto info`);
    }
    switch (split[0]) {
      case 'profile':
        const [ context, profileProperty = 'encryptionKeys' ] = split.slice(1).reverse();
        result = await this.options.profile.getEncryptionKey(context);
        break;
      default:
        throw new Error(`unknown key type "${split[0]}"`);
    }

    if (!result) {
      throw new Error(`missing key for cryptoInfo "${JSON.stringify(cryptoInfo)}"`);
    }

    return result;
  }

  /**
   * store key in respective storage location, depending on given cryptoInfo, additional information
   * may be required, which can be given via ``artifacts``
   *
   * @param      {CryptoInfo}  cryptoInfo  details for encryption, can be created with
   *                                       `getCryptoInfos`
   * @param      {any}         key         key to store
   */
  public async storeKey(cryptoInfo: CryptoInfo, key: any) {
    const split = cryptoInfo.originator.split(':');
    if (split.length < 2) {
      throw new Error(`unsupported originator "${cryptoInfo.originator}" at crypto info`);
    }
    switch (split[0]) {
      case 'profile':
        const [ context, profileProperty = 'encryptionKeys' ] = split.slice(1).reverse();
        await this.options.profile.loadForAccount(this.options.profile.treeLabels.encryptionKeys);
        await this.options.profile.setEncryptionKey(context, key);
        await this.options.profile.storeForAccount(this.options.profile.treeLabels.encryptionKeys);
        break;
      default:
        throw new Error(`unknown key type "${split[0]}"`);
    }
  }
}
