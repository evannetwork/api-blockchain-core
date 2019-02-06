/*
  Copyright (c) 2018-present evan GmbH.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
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
      base: '/api/v0' }, provider || {});
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
          if(res.statusCode >= 200 && res.statusCode < 400) {
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
      const header = `--${boundary}\r\nContent-Disposition: form-data; name="${file.path}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
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
    console.dir(ipfsHash)
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
