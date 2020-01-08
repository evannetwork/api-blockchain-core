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

import {
  CryptoInfo,
  Envelope,
  Logger,
  LoggerOptions,
  NameResolver,
} from '@evan.network/dbcp';

import { CryptoProvider } from './crypto-provider';
import { Profile } from '../profile/profile';
import { Sharing } from '../contracts/sharing';


/**
 * specifies which type of encryption is done
 */
export enum EncryptionWrapperCryptorType {
  /** content encryption is used for generic data (strings, in memory objects) */
  Content = 'aes-256-cbc',
  /** file encryption is used for binary file data */
  File = 'aes-blob',
  /** unencrypted data encryption can be used to embed unencrypted data in encryption containers */
  Unencrypted = 'unencrypted',
}

/**
 * storage location for encryption keys
 */
export enum EncryptionWrapperKeyType {
  /** custom key handling means that the key is handled elsewhere and has to be given to profile */
  Custom = 'custom',
  /** key is stored in profile, usually in property "encryptionKeys" */
  // eslint-disable-next-line no-shadow
  Profile = 'profile',
  /** key is stored in Shared or MultiShared contract */
  // eslint-disable-next-line no-shadow
  Sharing = 'sharing',
}

/**
 * encryption wrapper instance options
 */
export interface EncryptionWrapperOptions extends LoggerOptions {
  cryptoProvider: CryptoProvider;
  nameResolver: NameResolver;
  profile: Profile;
  sharing: Sharing;
  web3: any;
}


/**
 * wrapper for encryption realizes a uniform way to en- and decrypt different types of data with
 * different key storages
 *
 * @class      EncryptionWrapper (name)
 */
export class EncryptionWrapper extends Logger {
  public static defaultOptions = {
    keyLength: 256,
    algorithm: 'aes-blob',
  };

  public options: EncryptionWrapperOptions;

  private readonly encodingUnencrypted = 'utf-8';

  private readonly encodingEncrypted = 'hex';

  public constructor(options?: EncryptionWrapperOptions) {
    super(options);
    this.options = { ...options };
  }

  /**
   * decrypt given ``Envelope``
   *
   * @param      {Envelope}  toDecrypt  encrypted envelop
   * @param      {any}       artifacts  additional information for decrypting
   */
  public async decrypt(
    toDecrypt: Envelope,
    // for type === Sharing or type === Custom
    artifacts?: { accountId: string; propertyName: string } | { key: string },
  ): Promise<any> {
    const [cryptor, key] = await Promise.all([
      this.options.cryptoProvider.getCryptorByCryptoInfo(toDecrypt.cryptoInfo),
      this.getKey(toDecrypt.cryptoInfo, artifacts),
    ]);

    const decrypted = await cryptor.decrypt(
      Buffer.from(toDecrypt.private, this.encodingEncrypted), { key },
    );
    return decrypted;
  }

  /**
   * encrypt given object, depending on given ``cryptoInfo``, additional information may be
   * required, which can be given via ``artifacts``
   *
   * @param      {any}         toEncrypt   object to encrypt
   * @param      {CryptoInfo}  cryptoInfo  details for encryption, can be created with
   *                                       ``getCryptoInfos``
   * @param      {any}         artifacts   additional information for decrypting
   */
  public async encrypt(
    toEncrypt: any,
    cryptoInfo: CryptoInfo,
    // for type === Sharing or type === Custom
    artifacts?: { accountId: string; block?: number; propertyName: string } | { key: string },
  ): Promise<Envelope> {
    const [cryptor, key] = await Promise.all([
      this.options.cryptoProvider.getCryptorByCryptoInfo(cryptoInfo),
      this.getKey(cryptoInfo, artifacts),
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
   * @param      {string}                        keyContext   used to identify key, can be any
   *                                                          string (but must not have colons)
   * @param      {EncryptionWrapperKeyType}      keyType      defines where keys are stored
   * @param      {EncryptionWrapperCryptorType}  cryptorType  cryptor to use
   * @param      {any}                           artifacts    (optional) additional information for
   *                                                          encryption may be required, depends
   *                                                          on ``keyType``
   */
  public async getCryptoInfo(
    keyContext: string,
    keyType: EncryptionWrapperKeyType,
    cryptorType: EncryptionWrapperCryptorType = EncryptionWrapperCryptorType.Content,
    // for type === Sharing
    artifacts?: { sharingContractId: string; sharingId?: string },
  ): Promise<CryptoInfo> {
    switch (keyType) {
      case EncryptionWrapperKeyType.Custom:
      case EncryptionWrapperKeyType.Profile:
        return {
          algorithm: cryptorType,
          block: await this.options.web3.eth.getBlockNumber(),
          originator: `${keyType}:${keyContext}`,
        };
      case EncryptionWrapperKeyType.Sharing: {
        this.checkProperties(artifacts, ['sharingContractId']);
        const { sharingContractId, sharingId } = artifacts;
        const originator = typeof sharingId !== 'undefined'
          ? `${keyType}:${sharingContractId}:${sharingId}`
          : `${keyType}:${sharingContractId}`;
        return {
          algorithm: cryptorType,
          block: await this.options.web3.eth.getBlockNumber(),
          originator,
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
  public async getKey(
    cryptoInfo: CryptoInfo,
    // for type === Sharing or type === Custom
    artifacts?: { accountId: string; propertyName: string } | { key: string },
  ) {
    let result;
    const split = cryptoInfo.originator.split(':');
    if (split.length < 2) {
      throw new Error(`unsupported originator "${cryptoInfo.originator}" at crypto info`);
    }
    switch (split[0]) {
      case 'profile':
        result = await this.options.profile.getEncryptionKey(split[1]);
        break;
      case 'sharing': {
        this.checkProperties(artifacts, ['accountId']);
        const [contractid, sharingId = null] = split.slice(1);
        const { accountId, propertyName = '*' } = artifacts as any;
        result = await this.options.sharing.getKey(
          contractid,
          accountId,
          propertyName,
          cryptoInfo.block || 0,
          sharingId,
        );
        break;
      }
      case 'custom': {
        this.checkProperties(artifacts, ['key']);
        const { key } = artifacts as any;
        result = key;
        break;
      }
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
   * @param      {any}         artifacts   (optional) additional information for encryption may be
   *                                       required
   */
  public async storeKey(
    cryptoInfo: CryptoInfo,
    key: any,
    // for type === Sharing
    artifacts?: { accountId: string; receiver?: string },
  ): Promise <void> {
    const split = cryptoInfo.originator.split(':');
    if (split.length < 2) {
      throw new Error(`unsupported originator "${cryptoInfo.originator}" at crypto info`);
    }
    switch (split[0]) {
      case 'profile': {
        const context = split[1];
        await this.options.profile.loadForAccount(this.options.profile.treeLabels.encryptionKeys);
        await this.options.profile.setEncryptionKey(context, key);
        await this.options.profile.storeForAccount(this.options.profile.treeLabels.encryptionKeys);
        break;
      }
      case 'sharing': {
        this.checkProperties(artifacts, ['accountId']);
        const [contractid, sharingId = null] = split.slice(1);
        await this.options.sharing.addSharing(
          contractid,
          artifacts.accountId,
          artifacts.receiver || artifacts.accountId,
          '*',
          0,
          key,
          null,
          false,
          sharingId,
        );
        break;
      }
      default:
        throw new Error(`unknown key type "${split[0]}"`);
    }
  }

  /**
   * check if given artifacts contain given set of properties; throws if missing properties
   *
   * @param      {any}     artifacts   object to ckeck
   * @param      {string}  properties  list of properties to check
   */
  private checkProperties(artifacts: any, properties: string[]) {
    if (artifacts) {
      const missing = properties.filter(
        (property) => !Object.prototype.hasOwnProperty.call(artifacts, property),
      );
      if (missing.length) {
        throw new Error([
          'artifacts is missing ',
          missing.length === 1 ? 'property: ' : 'properties: ',
          missing.join(', '),
        ].join(''));
      }
    }
  }
}
