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
} from '@evan.network/dbcp';

import { CryptoProvider } from './crypto-provider';


export enum EncryptionWrapperKeyType {
  Profile,
}

/**
 * encryption wrapper instance options
 */
export interface EncryptionWrapperOptions extends LoggerOptions {
  cryptoProvider: CryptoProvider;
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

  options: any;

  constructor(options?: LoggerOptions) {
    super(options);
    this.options = { ...options };
  }

  public async decrypt(toDecrypt: Envelope): Promise<any> {
    throw new Error('not implemented');
  }

  public async encrypt(toEncrypt: any, cryptoInfo: CryptoInfo): Promise<Envelope> {
    throw new Error('not implemented');
  }

  public async getCryptoInfo(
    keyType: EncryptionWrapperKeyType,
    keyContext: any,
  ): Promise<CryptoInfo> {
    switch (keyType) {
      case EncryptionWrapperKeyType.Profile: {
        return {
          algorithm: 'aes',
          originator: `profile:keys:${keyContext}`,
        };
      }
      default:
        throw new Error(`unknown key type "${keyType}"`);
    }
  }
}
