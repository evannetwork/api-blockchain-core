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

import { setTimeout, clearTimeout } from 'timers';

import {
  FileToAdd,
  DfsInterface,
  DfsCacheInterface,
  Logger,
  LoggerOptions,
} from '@evan.network/dbcp';

import { Runtime } from '../runtime';

import { Payments } from '../payments';

import { IpfsLib } from './ipfs-lib';

import bs58 = require('bs58');
import prottle = require('prottle');
import utils = require('./../common/utils');


const IPFS_TIMEOUT = 120000;
const requestWindowSize = 10;


/**
 * ipfs instance options
 */
export interface IpfsOptions extends LoggerOptions {
  remoteNode: any;
  cache: any;
  dfsConfig: any;
  accountId: string;
  payments: Payments;
  privateKey: string;
  disablePin?: boolean;
  web3: any;
}

/**
 * @brief      IPFS add/get data handler
 */
export class Ipfs extends Logger implements DfsInterface {
  public remoteNode: any;

  public dfsConfig: any;

  public disablePin: boolean;

  public cache: DfsCacheInterface;

  public runtime: Runtime;

  public constructor(options) {
    super(options);
    this.disablePin = options.disablePin || false;
    if (options.cache) {
      this.cache = options.cache;
    }
    if (options.remoteNode) {
      this.remoteNode = options.remoteNode;
    } else if (options.dfsConfig) {
      this.dfsConfig = options.dfsConfig;
      this.remoteNode = new IpfsLib(options.dfsConfig);
    } else {
      this.log('No IPFS config of ipfs remotenode are given', 'error');
    }
  }

  /**
   * convert IPFS hash to bytes 32 see
   * https://www.reddit.com/r/ethdev/comments/6lbmhy/a_practical_guide_to_cheap_ipfs_hash_storage_in
   *
   * @param      hash  IPFS hash
   *
   * @return     bytes32 string
   */
  public static ipfsHashToBytes32(hash: string): string {
    const bytes = bs58.decode(hash);
    const multiHashId = 2;
    // remove the multihash hash id
    return `0x${bytes.slice(multiHashId, bytes.length).toString('hex')}`;
  }

  /**
   * convert bytes32 string to IPFS hash see
   * https://www.reddit.com/r/ethdev/comments/6lbmhy/a_practical_guide_to_cheap_ipfs_hash_storage_in
   *
   * @param      str   bytes32 string
   *
   * @return     IPFS string
   */
  public static bytes32ToIpfsHash(str: string): string {
    // remove leading 0x
    const remove0x = str.slice(2, str.length);
    // add back the multihash id
    const bytes = Buffer.from(`1220${remove0x}`, 'hex');
    const hash = bs58.encode(bytes);
    return hash;
  }

  /**
   * @brief      add content to ipfs
   *
   * @param      name  The name
   * @param      data  The data
   *
   * @return     ipfs hash of the data
   */
  public async add(name: string, data: Buffer): Promise<string> {
    const files: FileToAdd[] = [{
      path: name,
      content: data,
    }];
    return (await this.addMultiple(files))[0];
  }

  /**
   * @brief      add multiple files to ipfs
   *
   * @param      files  array with files to add
   *
   * @return     ipfs hash array of the data
   */
  public async addMultiple(files: FileToAdd[]): Promise<string[]> {
    let remoteFiles = [];
    try {
      await this.checkAuthHeader();

      remoteFiles = await this.remoteNode.files.add(files);
      if (!remoteFiles.length) {
        throw new Error('no hash was returned');
      }
      remoteFiles = remoteFiles.map((fileHash) => {
        const remoteFile = fileHash;
        if (!remoteFile.hash) {
          remoteFile.hash = remoteFile.Hash;
        }
        return remoteFile;
      });
    } catch (ex) {
      const msg = `could not add file to ipfs: ${ex.message || ex}`;
      this.log(msg);
      throw new Error(msg);
    }
    if (this.cache) {
      await Promise.all(
        remoteFiles.map((remoteFile, i) => this.cache.add(remoteFile.hash, files[i].content)),
      );
    }
    if (!this.disablePin) {
      await prottle(
        requestWindowSize,
        remoteFiles.map((fileHash) => () => this.pinFileHash(fileHash)),
      );
    }
    return remoteFiles.map((remoteFile) => Ipfs.ipfsHashToBytes32(remoteFile.hash));
  }

  /**
   * @brief      get data from ipfs by ipfs hash
   *
   * @param      hash  ipfs hash of the data
   * @param      returnBuffer  should the function return the plain buffer (default false)
   *
   * @return     data as text
   */
  public async get(hash: string, returnBuffer = false): Promise<string | Buffer> {
    const ipfsHash = hash.startsWith('Qm') ? hash : Ipfs.bytes32ToIpfsHash(hash);

    // check if the hash equals 0x000000000000000000000000000000000
    if (ipfsHash === 'QmNLei78zWmzUdbeRB3CiUfAizWUrbeeZh5K1rhAQKCh51') {
      return Buffer.from('{}');
    }

    this.log(`Getting IPFS Hash ${ipfsHash}`, 'debug');

    if (this.cache) {
      const buffer = await this.cache.get(ipfsHash);
      if (buffer) {
        if (returnBuffer) {
          return Buffer.from(buffer);
        }
        return this.decodeBuffer(Buffer.from(buffer));
      }
    }
    let wait;
    const timeout = new Promise((resolve, reject) => {
      wait = setTimeout(() => {
        clearTimeout(wait);

        reject(new Error(`error while getting ipfs hash ${ipfsHash}: rejected after ${IPFS_TIMEOUT}ms`));
      }, IPFS_TIMEOUT);
    });

    const getRemoteHash = this.remoteNode.files.cat(ipfsHash)
      .then((buffer: any) => {
        const fileBuffer = buffer;
        const ret = this.decodeBuffer(buffer);
        if (this.cache) {
          this.cache.add(ipfsHash, fileBuffer);
        }
        if (returnBuffer) {
          return fileBuffer;
        }
        clearTimeout(wait);
        return ret;
      })
      .catch(() => {
        clearTimeout(wait);
        throw new Error(`error while getting ipfs hash ${ipfsHash}`);
      });
    return Promise.race([
      getRemoteHash,
      timeout,
    ]);
  }

  /**
   * @brief      pins file hashes on ipfs cluster
   *
   * @param      hash  filehash of the pinned item
   */
  public async pinFileHash(file: any): Promise<any> {
    await this.checkAuthHeader();
    const ipfsHash = file.hash.startsWith('Qm') ? file.hash : Ipfs.bytes32ToIpfsHash(file.hash);
    await this.remoteNode.pin.add(ipfsHash);
  }

  /**
   * removes a hash from the IPFS
   *
   * @param      {any}  hash    filehash of the pinned item
   */
  public async remove(hash: any) {
    await this.unPinFileHash(hash);
  }

  /**
   * Sets the account identifier and accountstore, also generates a new ipfs instance.
   *
   * @param      {string}        accountId     The account identifier
   * @param      {any}           privateKey    The account private
   * @return     {Promise<any>}  resolved when done
   */
  public async setAccountAndPrivateKey() {
    // deprecated
  }

  /**
   * Sets the runtime.
   *
   * @param      {Runtime}  runtime  The runtime
   */
  public setRuntime(runtime: Runtime) {
    this.runtime = runtime;
  }

  /**
   * unpins file hashes on ipfs cluster
   *
   * @param      {any}  hash    filehash of the pinned item
   */
  public async unPinFileHash(hash: any): Promise<any> {
    await this.checkAuthHeader();
    const ipfsHash = hash.startsWith('Qm') ? hash : Ipfs.bytes32ToIpfsHash(hash);
    await this.remoteNode.pin.rm(ipfsHash);
  }

  /**
   * checks/generates the auth header for ipfs is set and clears it every 60 seconds
   */
  private async checkAuthHeader() {
    if (!this.remoteNode.provider.headers.authorization) {
      const ipfsAuthHeader = await utils.getSmartAgentAuthHeaders(this.runtime);
      this.remoteNode.provider.headers.authorization = ipfsAuthHeader;
      setTimeout(() => {
        delete this.remoteNode.provider.headers.authorization;
      }, 60 * 1000);
    }
  }

  /**
   * Tries to decode given Buffer to UTF-8, if this leads to invalid characters, decode to Latin-1.
   *
   * @param      {Buffer}  buffer  buffer to decrypt, may be UTF-8 or Latin-1 encoded.
   * @return     {string}  decoded string
   */
  private decodeBuffer(buffer: Buffer): string {
    const decodedToUtf8 = buffer.toString('utf8');
    return decodedToUtf8.indexOf('�') === -1
      ? decodedToUtf8
      : buffer.toString('binary');
  }
}
