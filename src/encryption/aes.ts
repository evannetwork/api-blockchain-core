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
  Cryptor,
  CryptoInfo,
  Logger,
  LoggerOptions as AesOptions,
} from '@evan.network/dbcp';

import crypto = require('crypto-browserify');

/**
 * aes instance options
 */
export {
  LoggerOptions as AesOptions,
} from '@evan.network/dbcp';


/**
 * generate new intiala vector, length is 16 bytes (aes)
 *
 * @return     {Buffer}  initial vector as Buffer
 */
function generateInitialVector(): Buffer {
  return crypto.randomBytes(16);
}

export class Aes extends Logger implements Cryptor {
  public static defaultOptions = {
    keyLength: 256,
    algorithm: 'aes-256-cbc',
  };

  public options: any;

  private readonly encodingUnencrypted = 'utf-8';

  public constructor(options?: AesOptions) {
    super(options);
    this.options = { ...Aes.defaultOptions, ...options || {} };
  }


  /**
   * convert string to array buffer
   *
   * @param      {string}  str     string to convert
   * @return     {Buffer}  converted input
   */
  public stringToArrayBuffer(str) {
    const len = str.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) {
      bytes[i] = str.charCodeAt(i);
    }
    return bytes.buffer;
  }


  public getCryptoInfo(originator: string): CryptoInfo {
    return { originator, ...this.options };
  }

  /**
   * generate key for cryptor/decryption
   *
   * @return     {any}  The iv from key.

   */
  public async generateKey(): Promise<any> {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(this.options.keyLength / 8, (err, buf) => {
        if (err) {
          reject(err);
        } else {
          const hexString = buf.toString('hex');
          resolve(hexString);
        }
      });
    });
  }

  /**
   * encrypt a message
   *
   * @param      {any}     message  The message
   * @param      {any}     options  cryptor options
   * @return     {Buffer}  encrypted message
   */
  public async encrypt(message: any, options: any): Promise<Buffer> {
    try {
      if (!options.key) {
        throw new Error('no key given');
      }
      const initialVector = generateInitialVector();
      const bufferedMessage = Buffer.from(JSON.stringify(message), this.encodingUnencrypted);
      const cipher = crypto.createCipheriv(this.options.algorithm, Buffer.from(options.key, 'hex'), initialVector);
      const encrypted = Buffer.concat([cipher.update(bufferedMessage), cipher.final()]);

      return Promise.resolve(Buffer.concat([initialVector, encrypted]));
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
  public async decrypt(message: Buffer, options: any): Promise<any> {
    try {
      if (!options.key) {
        throw new Error('no key given');
      }
      const initialVector = message.slice(0, 16);
      const encrypted = message.slice(16);

      const decipher = crypto.createDecipheriv(this.options.algorithm, Buffer.from(options.key, 'hex'), initialVector);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

      const result = JSON.parse(decrypted.toString(this.encodingUnencrypted));
      return Promise.resolve(result);
    } catch (ex) {
      this.log(`could not decrypt; ${ex.message || ex}`, 'error');
      return Promise.reject(ex);
    }
  }
}
