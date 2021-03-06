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

import 'mocha';
import * as fs from 'fs';
import { expect } from 'chai';
import { promisify } from 'util';

import { AesBlob } from './aes-blob';
import { TestUtils } from '../test/test-utils';
import { accounts, useIdentity } from '../test/accounts';
import { Ipfs } from '../dfs/ipfs';


let sampleFile;
let fileDescription;
let fileValidation;
let ipfs;
const sampleKey = '346c22768f84f3050f5c94cec98349b3c5cbfa0b7315304e13647a49181fd1ef';
let encryptedFile;

describe('Blob Encryption', function test() {
  this.timeout(300000);

  before(async () => {
    sampleFile = await promisify(fs.readFile)('./src/encryption/testfile.spec.jpg');
    fileDescription = {
      name: 'testfile.spec.jpg',
      fileType: 'image/jpeg',
      file: sampleFile,
    };
    fileValidation = {
      name: 'testfile.spec.jpg',
      fileType: 'image/jpeg',
      file: sampleFile,
    };
    ipfs = (await TestUtils.getRuntime(accounts[0], null, { useIdentity })).dfs as Ipfs;
  });


  it('should be able to be created', () => {
    const aes = new AesBlob({ dfs: ipfs });
    expect(aes).not.to.be.undefined;
  });

  it('should be able to generate keys', async () => {
    const aes = new AesBlob({ dfs: ipfs });
    const key = await aes.generateKey();
    expect(key).not.to.be.undefined;
  });

  it('should be able to encrypt a sample message', async () => {
    const aes = new AesBlob({ dfs: ipfs });
    encryptedFile = await aes.encrypt(fileDescription, { key: sampleKey });
    expect(encryptedFile.toString('hex')).not.to.be.undefined;
  });

  it('should be able to decrypt a sample message', async () => {
    const aes = new AesBlob({ dfs: ipfs });
    const decrypted = await aes.decrypt(Buffer.from(encryptedFile, 'hex'), { key: sampleKey });
    expect(decrypted).to.deep.equal(fileValidation);
  });
});
