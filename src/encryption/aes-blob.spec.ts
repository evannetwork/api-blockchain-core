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

import 'mocha';
import { expect } from 'chai';

const fs = require('fs');
const { promisify } = require('util');

import { AesBlob } from './aes-blob'
import { TestUtils } from '../test/test-utils'

let sampleFile;
let fileDescription;
let fileValidation;
let ipfs;
const sampleKey = '346c22768f84f3050f5c94cec98349b3c5cbfa0b7315304e13647a49181fd1ef';
let encryptedFile;

describe('Blob Encryption', function() {
  this.timeout(300000);

  before(async () => {
    sampleFile = await promisify(fs.readFile)('./src/encryption/testfile.spec.jpg');
    fileDescription = {
      name: 'testfile.spec.jpg',
      fileType: 'image/jpeg',
      file: sampleFile
    };   
    fileValidation = {
      name: 'testfile.spec.jpg',
      fileType: 'image/jpeg',
      file: sampleFile
    };   
    ipfs = await TestUtils.getIpfs();
  });

  after(async () => {
    await ipfs.stop();
  });


  it('should be able to be created', () => {
    const aes = new AesBlob({dfs: ipfs});
    expect(aes).not.to.be.undefined;
  });

  it('should be able to generate keys', async () => {
    const aes = new AesBlob({dfs: ipfs});
    const key = await aes.generateKey();
    expect(key).not.to.be.undefined;
  });

  it('should be able to encrypt a sample message', async () => {
    const aes = new AesBlob({dfs: ipfs});
    encryptedFile = await aes.encrypt(fileDescription, { key: sampleKey, });
    expect(encryptedFile.toString('hex')).not.to.be.undefined;
  });

  it('should be able to decrypt a sample message', async () => {
    const aes = new AesBlob({dfs: ipfs});
    const decrypted = await aes.decrypt(Buffer.from(encryptedFile, 'hex'), { key: sampleKey, });
    expect(decrypted).to.deep.equal(fileValidation);
  });
});