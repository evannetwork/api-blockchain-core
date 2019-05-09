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
  Cryptor,
  CryptoInfo,
  Logger,
  LoggerOptions,
} from '@evan.network/dbcp';

/**
 * aes ecb instance options
 */
export interface AesEcbOptions extends LoggerOptions {

}

export class AesEcb extends Logger implements Cryptor {

  private readonly encodingUnencrypted = 'utf-8';
  private readonly encodingEncrypted = 'hex';

  options: any;
  static defaultOptions = {
    keyLength: 256,
    algorithm: 'aes-256-ecb',
  };

  constructor(options?: AesEcbOptions) {
    super(options);
    this.options = Object.assign({}, AesEcb.defaultOptions, options || {});
  }


  /**
   * convert string to array buffer
   *
   * @param      {string}  str     string to convert
   * @return     {Buffer}  converted input
   */
  stringToArrayBuffer(str) {
    let len = str.length;
    let bytes = new Uint8Array( len );
    for (let i = 0; i < len; i++) {
      bytes[i] = str.charCodeAt(i);
    }
    return bytes.buffer;
  }


  getCryptoInfo(originator: string): CryptoInfo {
    return Object.assign({ originator, }, this.options);
  }

  /**
   * generate key for cryptor/decryption
   *
   * @return     {any}  The iv from key.

   */
  async generateKey(): Promise<any> {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(this.options.keyLength / 8, (err, buf) => {
        if (err) {
          reject(err);
        } else {
          const hexString = buf.toString('hex')
          resolve(hexString);
        }
      });
    })
  }

  /**
   * encrypt a message
   *
   * @param      {any}     message  The message
   * @param      {any}     options  cryptor options
   * @return     {Buffer}  encrypted message
   */
  async encrypt(message: Buffer, options: any): Promise<Buffer> {
    try {
      if (!options.key) {
        throw new Error('no key given');
      }
      const computedKey = this.computeSecret(Buffer.from(options.key, 'hex'));
      const cipher = crypto.createCipheriv(
        this.options.algorithm,
        Buffer.from(computedKey, 'hex'),
        null
      );
      cipher.setAutoPadding(false);
      const encrypted = Buffer.concat([cipher.update(message), cipher.final()]);
      return Promise.resolve(encrypted);
    } catch (ex) {
      this.log(`could not encrypt; ${ex.message || ex}`, 'error');
      return Promise.reject(ex);
    }
  }

  /**
   * decrypt a message
   *
   * @param      {Buffer}  message  The message
   * @param      {any}     options  decryption options
   * @return     {any}  decrypted message
   */
  async decrypt(message: Buffer, options: any): Promise<Buffer> {
    try {
      if (!options.key) {
        throw new Error('no key given');
      }
      const computedKey = this.computeSecret(Buffer.from(options.key, 'hex'));
      const decipher = crypto.createDecipheriv(
        this.options.algorithm,
        Buffer.from(computedKey, 'hex'),
        ''
      );
      decipher.setAutoPadding(false);
      const decrypted = Buffer.concat([decipher.update(message), decipher.final()]);
      return Promise.resolve(decrypted);
    } catch (ex) {
      this.log(`could not decrypt; ${ex.message || ex}`, 'error');
      return Promise.reject(ex);
    }
  }

  /**
   * calculates a secret out of a given ecb passphrase
   * https://gist.github.com/bnoordhuis/2de2766d3d3a47ebe41aaaec7e8b14df
   *
   * @param      {Buffer}  passphrase  given passphrase to createCipher
   * @return     {string}  secret of the passphrase.
   */
  private computeSecret(passphrase: Buffer): string {
    let nkey = 32;
    let niv = 0;
    for (let key = '', iv = '', p = '';;) {
      const h = crypto.createHash('md5');
      h.update(p, 'hex');
      h.update(passphrase);
      p = h.digest('hex');
      let n, i = 0;
      n = Math.min(p.length - i, 2 * nkey);
      nkey -= n / 2, key += p.slice(i, i + n), i += n;
      n = Math.min(p.length - i, 2 * niv);
      niv -= n / 2, iv += p.slice(i, i + n), i += n;
      if (nkey + niv === 0) {
        return key;
      }
    }
  }
}
