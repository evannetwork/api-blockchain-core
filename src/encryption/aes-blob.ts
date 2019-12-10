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

import crypto = require('crypto-browserify');

import {
  Cryptor,
  CryptoInfo,
  Logger,
  LoggerOptions,
} from '@evan.network/dbcp';


/**
 * generate new intiala vector, length is 16 bytes (aes)
 *
 * @return     {Buffer}  initial vector as Buffer
 */
function generateInitialVector(): Buffer {
  return crypto.randomBytes(16);
}

/**
 * aes blob instance options
 */
export interface AesBlobOptions extends LoggerOptions {
  dfs: any;
}


/**
 * encrypts files, uploads them to DFS and keeps their references in an envelope
 *
 * @class      AesBlob (name)
 */
export class AesBlob extends Logger implements Cryptor {
  public static defaultOptions = {
    keyLength: 256,
    algorithm: 'aes-blob',
  };

  private readonly encodingUnencrypted = 'utf-8';
  private readonly encodingEncrypted = 'hex';

  public options: any;
  public algorithm: string;
  public webCryptoAlgo: string;

  public constructor(options?: AesBlobOptions) {
    super(options);
    this.algorithm = 'aes-256-cbc';
    this.webCryptoAlgo = 'AES-CBC';
    this.options = Object.assign({}, AesBlob.defaultOptions, options || {});
  }


  /**
   * convert string to array buffer
   *
   * @param      {string}  str     string to convert
   * @return     {any}  converted input
   */
  public stringToArrayBuffer(str): any {
    const len = str.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = str.charCodeAt(i);
    }
    return bytes.buffer;
  }


  public getCryptoInfo(originator: string): CryptoInfo {
    const ret = Object.assign({ originator, }, this.options);
    delete ret.dfs;
    return ret;
  }

  public chunkBuffer(buffer, chunkSize) {
    const result = [];
    const len = buffer.length;
    let i = 0;
    while (i < len) {
      result.push(buffer.slice(i, i += chunkSize));
    }
    return result;
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
          const hexString = buf.toString('hex')
          resolve(hexString);
        }
      });
    })
  }

  public async decryptBrowser(algorithm, buffer, decryptKey, iv) {
    const key = await (global as any).crypto.subtle.importKey(
      'raw',
      decryptKey,
      {
        name: algorithm,
        length: 256,
      },
      false,
      ['decrypt']
    );
    const decrypted = await (global as any).crypto.subtle.decrypt(
      {
        name: algorithm,
        iv: iv,
      },
      key,
      buffer
    );
    return Buffer.from(decrypted);
  }

  public async encryptBrowser(algorithm, buffer, encryptionKey, iv) {
    const key = await (global as any).crypto.subtle.importKey(
      'raw',
      encryptionKey,
      {
        name: algorithm,
        length: 256,
      },
      false,
      ['encrypt']
    );
    const encrypted = await (global as any).crypto.subtle.encrypt(
      {
        name: algorithm,
        iv: iv,
      },
      key,
      buffer
    );
    return Buffer.from(encrypted);
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
      let encryptedWrapperMessage;
      // its an array of blobs

      const initialVector = generateInitialVector();
      const cipher = crypto.createCipheriv(
        this.algorithm,
        Buffer.from(options.key, 'hex'),
        initialVector
      );
      if (Array.isArray(message)) {
        const files = [];
        for (const blob of message) {
          let encrypted;
          if ((global as any).crypto && (global as any).crypto.subtle) {
            encrypted = await this.encryptBrowser(
              this.webCryptoAlgo,
              Buffer.from(blob.file),
              Buffer.from(options.key, 'hex'),
              initialVector
            );
          } else {
            encrypted = Buffer.concat([cipher.update(Buffer.from(blob.file)), cipher.final()]);
          }
          const encryptedWithIv = Buffer.concat([initialVector, encrypted]);
          const stateMd5 = crypto.createHash('md5').update(encryptedWithIv).digest('hex');
          files.push({
            path: stateMd5,
            content: encryptedWithIv
          });
        }
        const hashes = await this.options.dfs.addMultiple(files);
        for (let i = 0; i < message.length; i++) {
          message[i].file = hashes[i];
        }
      } else {
        let encrypted;
        if ((global as any).crypto && (global as any).crypto.subtle) {
          encrypted = await this.encryptBrowser(
            this.webCryptoAlgo,
            Buffer.from(message.file),
            Buffer.from(options.key, 'hex'),
            initialVector
          );
        } else {
          encrypted = Buffer.concat([cipher.update(Buffer.from(message.file)), cipher.final()]);
        }
        const encryptedWithIv = Buffer.concat([initialVector, encrypted]);
        const stateMd5 = crypto.createHash('md5').update(encryptedWithIv).digest('hex');
        const hash = await this.options.dfs.add(stateMd5, encryptedWithIv);
        message.file = hash;
      }
      const wrapperMessage = Buffer.from(JSON.stringify(message), this.encodingUnencrypted);
      if ((global as any).crypto && (global as any).crypto.subtle) {
        encryptedWrapperMessage = await this.encryptBrowser(
          this.webCryptoAlgo,
          Buffer.from(wrapperMessage),
          Buffer.from(options.key, 'hex'),
          initialVector
        );
      } else {
        const wrapperDecipher = crypto.createCipheriv(
          this.algorithm,
          Buffer.from(options.key, 'hex'),
          initialVector
        );
        encryptedWrapperMessage = Buffer.concat([
          wrapperDecipher.update(wrapperMessage),
          wrapperDecipher.final()
        ]);
      }
      return Promise.resolve(Buffer.concat([initialVector, encryptedWrapperMessage]));
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
   * @return     {any}     decrypted message
   */
  public async decrypt(message: Buffer, options: any): Promise<any> {
    try {
      if (!options.key) {
        throw new Error('no key given');
      }

      const initialVector = message.slice(0, 16);
      const encrypted = message.slice(16);
      let decrypted;
      if ((global as any).crypto && (global as any).crypto.subtle) {
        decrypted = await this.decryptBrowser(this.webCryptoAlgo, encrypted, Buffer.from(options.key, 'hex'), initialVector);
      } else {
        const decipher = crypto.createDecipheriv(this.algorithm, Buffer.from(options.key, 'hex'), initialVector);
        decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      }

      const wrapper = JSON.parse(decrypted.toString(this.encodingUnencrypted));


      if (Array.isArray(wrapper)) {
        for (const blob of wrapper) {
          const ipfsFile = await this.options.dfs.get(blob.file, true);
          let file = Buffer.from('');
          const initialVectorFile = ipfsFile.slice(0, 16);
          const encryptedFile = ipfsFile.slice(16);
          if ((global as any).crypto && (global as any).crypto.subtle) {
            file = await this.decryptBrowser(this.webCryptoAlgo, encryptedFile, Buffer.from(options.key, 'hex'), initialVectorFile);
          } else {
            const fileDecipher = crypto.createDecipheriv(this.algorithm, Buffer.from(options.key, 'hex'), initialVectorFile);
            const chunks = this.chunkBuffer(encryptedFile, 1024);
            for (const chunk of chunks) {
              file = Buffer.concat([file, fileDecipher.update(chunk)]);
            }
            file = Buffer.concat([file, fileDecipher.final()]);
          }
          blob.file = file;
        }
      } else {
        const ipfsFile = await this.options.dfs.get(wrapper.file, true);
        const initialVectorFile = ipfsFile.slice(0, 16);
        const encryptedFile = ipfsFile.slice(16);
        let file = Buffer.from('');
        if ((global as any).crypto && (global as any).crypto.subtle) {
          file = await this.decryptBrowser(this.webCryptoAlgo, encryptedFile, Buffer.from(options.key, 'hex'), initialVectorFile);
        } else {
          const fileDecipher = crypto.createDecipheriv(this.algorithm, Buffer.from(options.key, 'hex'), initialVectorFile);
          const chunks = this.chunkBuffer(encryptedFile, 1024);
          for (const chunk of chunks) {
            file = Buffer.concat([file, fileDecipher.update(chunk)]);
          }
          file = Buffer.concat([file, fileDecipher.final()]);
        }
        wrapper.file = file;
      }

      return Promise.resolve(wrapper);
    } catch (ex) {
      this.log(`could not decrypt; ${ex.message || ex}`, 'error');
      return Promise.reject(ex);
    }
  }
}
