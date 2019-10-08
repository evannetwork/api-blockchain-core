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

import * as http from 'http';
import * as https from 'https';

import {
  FileToAdd,
} from '@evan.network/dbcp'


/**
 * @brief      IPFS library for add/pin
 */
export class IpfsLib {

  /**
   * compatible IPFS files api
   */
  files: any;
  /**
   * compatible IPFS pin api
   */
  pin: any;
  /**
   * holds the provider
   */
  provider: any;

  constructor(provider: any) {
    this.setProvider(provider || {});
  }

  /**
   * sets the ipfs provider based on dfsConfig
   *
   * @param      {any}  provider  The provider
   */
  setProvider(provider: any): void {
    const data = Object.assign({
      host: '127.0.0.1',
      pinning: true,
      port: '5001',
      protocol: 'http',
      base: '/api/v0',
      headers: {},
    }, provider || {});
    this.provider = data;
    this.files = {
      add: this.add.bind(this),
      cat: this.cat.bind(this)
    };
    this.pin = {
      add: this.pinAdd.bind(this),
      rm: this.pinRm.bind(this)
    };
  };


  /**
   * Sends an asynchronous request to ipfs
   *
   * @param      {object}  opts    The options for the request
   */
  async sendAsync(opts) {

    return new Promise((resolve, reject) => {
      const requestLib: any = this.provider.protocol === 'http' ? http : https;
      const reqOptions: http.RequestOptions = {};
      reqOptions.hostname = this.provider.host;
      reqOptions.path = `${this.provider.base}${opts.uri}`;
      reqOptions.headers = Object.assign({}, this.provider.headers);
      if (opts.payload) {
        reqOptions.method = 'POST';
        reqOptions.headers['Content-Type'] = `multipart/form-data; boundary=${opts.boundary}`;
      } else {
        reqOptions.method = 'GET';
      }

      if (opts.accept) {
        reqOptions.headers['accept'] = opts.accept;
      }
      const req: http.ClientRequest = requestLib.request(reqOptions, (res: http.IncomingMessage) => {
        const data  = [];
        res.on('data', (chunk) => {
          data.push(chunk);
        });
        res.on('end', () => {
          const binary = Buffer.concat(data);
          if (res.statusCode >= 200 && res.statusCode < 400) {
            try {
              resolve((opts.jsonParse ? JSON.parse(binary.toString()) : binary));
            } catch (jsonError) {
              reject(new Error(`error while parsing ipfs binary data: '${String(binary)}', error: ${String(jsonError)}'`));
            }
          } else {
            reject(new Error(`problem with IPFS request: ${String(binary)}'`));
          }
        });
      });

      req.on('error', (e) => {
        reject(new Error(`problem with request: ${e.message}`));
      });

      // write data to request body
      if (opts.payload && opts.boundary) {
        req.write(opts.payload);
      }
      req.end();
    });
  };

  /**
   * adds files to ipfs
   *
   * @param      {FileToAdd}  input   Array with to be pushed files
   */
  async add(input: FileToAdd[]) {
    let files = input;
    if (!Array.isArray(files)) {
      files = [].concat(files)
    }
    const response = [];
    for (let file of files) {
      const boundary = this.createBoundary();
      const header = [
        `--${boundary}`,
        `Content-Disposition: form-data; name="${file.path}"`,
        'Content-Type: application/octet-stream',
        '',
        ''
      ].join('\r\n');

      const data = file.content;
      const footer = `\r\n--${boundary}--`;

      const payload = Buffer.concat([
        Buffer.from(header),
        file.content,
        Buffer.from(footer)
      ])

      response.push(await this.sendAsync({
        jsonParse: true,
        accept: 'application/json',
        uri: '/add',
        takeHash: true,
        payload,
        boundary,
      }));
    }
    return response;

  };

  /**
   * creates a boundary that isn't part of the payload
   */
  createBoundary() {
    const boundary = `----EVANipfs${Math.random() * 100000}.${Math.random() * 100000}`;
    return boundary;
  }

  /**
   * resolves a ipfs hash
   *
   * @param      {string}  ipfsHash  The ipfs hash
   */
  async cat(ipfsHash: string) {
    return this.sendAsync({ uri: `/cat?arg=${ipfsHash}` });
  };

  /**
   * adds a pin to IPFS
   *
   * @param      {string}  ipfsHash  The ipfs hash
   */
  async pinAdd(ipfsHash: string) {
    return this.sendAsync({ uri: `/pin/add?arg=${ipfsHash}`, jsonParse: true });
  };

  /**
   * removes a pin from IPFS
   *
   * @param      {string}  ipfsHash  The ipfs hash
   */
  async pinRm(ipfsHash: string) {
    return this.sendAsync({ uri: `/pin/rm?arg=${ipfsHash}`, jsonParse: true });
  };
}
