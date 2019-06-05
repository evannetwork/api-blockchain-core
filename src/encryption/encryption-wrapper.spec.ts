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
import { promisify } from 'util';
import { readFile } from 'fs';
import {
  Envelope,
} from '@evan.network/dbcp';

import { accounts } from '../test/accounts';
import { TestUtils } from '../test/test-utils';
import {
  EncryptionWrapper,
  EncryptionWrapperCryptorType,
  EncryptionWrapperKeyType,
} from './encryption-wrapper';


describe('Encryption Wrapper', function() {
  this.timeout(300000);
  let encryptionWrapper: EncryptionWrapper;

  before(async () => {
    const web3 = TestUtils.getWeb3();
    const dfs = await TestUtils.getIpfs();
    encryptionWrapper = new EncryptionWrapper({
      cryptoProvider: TestUtils.getCryptoProvider(dfs),
      nameResolver: await TestUtils.getNameResolver(web3),
      profile: await TestUtils.getProfile(web3, dfs),
      web3,
    });
  });

  after(async () => {
  });

  it('should be able to be created', async () => {
    const testInstance = new EncryptionWrapper();
    expect(testInstance).not.to.be.undefined;
  });

  it('should be able to encrypt and decrypt files with a new key from profile', async () => {
    const file = await promisify(readFile)(
      `${__dirname}/testfile.spec.jpg`);
    const sampleFile = [{
      name: 'testfile.spec.jpg',
      fileType: 'image/jpeg',
      file,
    }];
    const sampleFileBackup = [{
      name: 'testfile.spec.jpg',
      fileType: 'image/jpeg',
      file,
    }];

    // use 32B for test, can be any string
    const keyContext = TestUtils.getRandomBytes32();
    const cryptoInfo = await encryptionWrapper.getCryptoInfo(
      keyContext, EncryptionWrapperKeyType.Profile, EncryptionWrapperCryptorType.File);

    // generate and store new key for crypto info
    const key = await encryptionWrapper.generateKey(cryptoInfo);
    await encryptionWrapper.storeKey(cryptoInfo, key);

    // encrypt files (key is pulled from profile)
    const encrypted = await encryptionWrapper.encrypt(sampleFile, cryptoInfo);

    expect(encrypted).to.haveOwnProperty('cryptoInfo');
    expect(encrypted).to.haveOwnProperty('private');

    expect(await encryptionWrapper.decrypt(encrypted)).to.deep.eq(sampleFileBackup);
  });

  it('should be able to encrypt and decrypt data with new key from profile', async () => {
    const file = await promisify(readFile)(
      `${__dirname}/testfile.spec.jpg`);
    const sampleData = {
      foo: TestUtils.getRandomBytes32(),
      bar: Math.random(),
    };

    // use 32B for test, can be any string
    const keyContext = TestUtils.getRandomBytes32();
    const cryptoInfo = await encryptionWrapper.getCryptoInfo(
      keyContext, EncryptionWrapperKeyType.Profile, EncryptionWrapperCryptorType.Content);

    // generate and store new key for crypto info
    const key = await encryptionWrapper.generateKey(cryptoInfo);
    await encryptionWrapper.storeKey(cryptoInfo, key);

    // encrypt files (key is pulled from profile)
    const encrypted = await encryptionWrapper.encrypt(sampleData, cryptoInfo);

    expect(encrypted).to.haveOwnProperty('cryptoInfo');
    expect(encrypted).to.haveOwnProperty('private');

    expect(await encryptionWrapper.decrypt(encrypted)).to.deep.eq(sampleData);
  });
});
