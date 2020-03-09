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
import { Executor } from '@evan.network/dbcp';
import { expect } from 'chai';
import { promisify } from 'util';
import { readFile } from 'fs';

import { accounts, useIdentity, identities } from '../test/accounts';
import { CryptoProvider } from './crypto-provider';
import { TestUtils } from '../test/test-utils';
import {
  EncryptionWrapper,
  EncryptionWrapperCryptorType,
  EncryptionWrapperKeyType,
} from './encryption-wrapper';


describe('Encryption Wrapper', function test() {
  this.timeout(300000);
  let cryptoProvider: CryptoProvider;
  let encryptionWrapper: EncryptionWrapper;
  let executor: Executor;
  let identity: string;

  before(async () => {
    const web3 = TestUtils.getWeb3();
    // data sharing sha3 self key and edges to self and other accounts
    const sha3 = (...args) => web3.utils.soliditySha3(...args);
    const sha9 = (accountId1, accountId2) => sha3(...[sha3(accountId1), sha3(accountId2)].sort());
    const getKeys = (
      ownAccount, partnerAccount,
    ) => [sha3(ownAccount), ...[ownAccount, partnerAccount].map(
      (partner) => sha9(ownAccount, partner),
    )];
    const runtime = await TestUtils.getRuntime(accounts[0], null, { useIdentity });
    const sharing0 = await TestUtils.getSharing(
      runtime.web3,
      runtime.dfs,
      getKeys(identities[0], identities[1]),
    );
    identity = runtime.activeIdentity;
    ({ cryptoProvider, executor } = runtime);
    encryptionWrapper = new EncryptionWrapper({
      ...(runtime as any),
      sharing: sharing0,
    });
  });

  it('should be able to be created', async () => {
    const testInstance = new EncryptionWrapper();
    expect(testInstance).not.to.be.undefined;
  });

  describe('when using keys stored in profile', () => {
    it('should be able to encrypt and decrypt files with a new key from profile', async () => {
      const file = await promisify(readFile)(
        `${__dirname}/testfile.spec.jpg`,
      );
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

      // use 32B for test, can be any string (but must not have colons)
      const keyContext = TestUtils.getRandomBytes32();
      const cryptoInfo = await encryptionWrapper.getCryptoInfo(
        keyContext,
        EncryptionWrapperKeyType.Profile,
        EncryptionWrapperCryptorType.File,
      );

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
      const sampleData = {
        foo: TestUtils.getRandomBytes32(),
        bar: Math.random(),
      };

      // use 32B for test, can be any string
      const keyContext = TestUtils.getRandomBytes32();
      const cryptoInfo = await encryptionWrapper.getCryptoInfo(
        keyContext,
        EncryptionWrapperKeyType.Profile,
        EncryptionWrapperCryptorType.Content,
      );

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

  describe('when using keys stored in Multisharings', () => {
    let multiSharingAddress: string;
    const sharingId = TestUtils.getRandomBytes32();

    before(async () => {
      const contract = await executor.createContract(
        'MultiShared', [], { from: identity, gas: 500000 },
      );
      multiSharingAddress = contract.options.address;
    });

    it('should be able to encrypt and decrypt files with a new key from profile', async () => {
      const file = await promisify(readFile)(
        `${__dirname}/testfile.spec.jpg`,
      );
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

      // use 32B for test, can be any string, usually the contract the multisharings is created for
      const keyContext = TestUtils.getRandomBytes32();
      const cryptoInfo = await encryptionWrapper.getCryptoInfo(
        keyContext,
        EncryptionWrapperKeyType.Sharing,
        EncryptionWrapperCryptorType.File,
        { sharingContractId: multiSharingAddress, sharingId },
      );

      // generate and store new key for crypto info
      const encryptionArtifacts = {
        accountId: identity,
        propertyName: '*',
      };
      const key = await encryptionWrapper.generateKey(cryptoInfo);
      await encryptionWrapper.storeKey(cryptoInfo, key, encryptionArtifacts);

      // encrypt files (key is pulled from profile)
      const encrypted = await encryptionWrapper.encrypt(
        sampleFile, cryptoInfo, encryptionArtifacts,
      );

      expect(encrypted).to.haveOwnProperty('cryptoInfo');
      expect(encrypted).to.haveOwnProperty('private');
      expect(await encryptionWrapper.decrypt(encrypted, encryptionArtifacts))
        .to.deep.eq(sampleFileBackup);
    });

    it('should be able to encrypt and decrypt data with new key from profile', async () => {
      const sampleData = {
        foo: TestUtils.getRandomBytes32(),
        bar: Math.random(),
      };

      // use 32B for test, can be any string, usually the contract the multisharings is created for
      const keyContext = TestUtils.getRandomBytes32();
      const cryptoInfo = await encryptionWrapper.getCryptoInfo(
        keyContext,
        EncryptionWrapperKeyType.Sharing,
        EncryptionWrapperCryptorType.Content,
        { sharingContractId: multiSharingAddress, sharingId },
      );

      // generate and store new key for crypto info
      const encryptionArtifacts = {
        accountId: identity,
        propertyName: '*',
      };
      const key = await encryptionWrapper.generateKey(cryptoInfo);
      await encryptionWrapper.storeKey(cryptoInfo, key, encryptionArtifacts);

      // encrypt files (key is pulled from profile)
      const encrypted = await encryptionWrapper.encrypt(
        sampleData, cryptoInfo, encryptionArtifacts,
      );

      expect(encrypted).to.haveOwnProperty('cryptoInfo');
      expect(encrypted).to.haveOwnProperty('private');
      expect(await encryptionWrapper.decrypt(encrypted, encryptionArtifacts))
        .to.deep.eq(sampleData);
    });
  });

  describe('when using keys stored in Sharings', () => {
    let sharingAddress: string;

    before(async () => {
      const contract = await executor.createContract(
        'Shared', [], { from: identity, gas: 500000 },
      );
      sharingAddress = contract.options.address;
    });

    it('should be able to encrypt and decrypt files with a new key from profile', async () => {
      const file = await promisify(readFile)(
        `${__dirname}/testfile.spec.jpg`,
      );
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

      // use 32B for test, can be any string, usually the contract the multisharings is created for
      const keyContext = TestUtils.getRandomBytes32();
      const cryptoInfo = await encryptionWrapper.getCryptoInfo(
        keyContext,
        EncryptionWrapperKeyType.Sharing,
        EncryptionWrapperCryptorType.File,
        { sharingContractId: sharingAddress },
      );

      // generate and store new key for crypto info
      const encryptionArtifacts = {
        accountId: identity,
        propertyName: '*',
      };
      const key = await encryptionWrapper.generateKey(cryptoInfo);
      await encryptionWrapper.storeKey(cryptoInfo, key, encryptionArtifacts);

      // encrypt files (key is pulled from profile)
      const encrypted = await encryptionWrapper.encrypt(
        sampleFile, cryptoInfo, encryptionArtifacts,
      );

      expect(encrypted).to.haveOwnProperty('cryptoInfo');
      expect(encrypted).to.haveOwnProperty('private');
      expect(await encryptionWrapper.decrypt(encrypted, encryptionArtifacts))
        .to.deep.eq(sampleFileBackup);
    });

    it('should be able to encrypt and decrypt data with new key from profile', async () => {
      const sampleData = {
        foo: TestUtils.getRandomBytes32(),
        bar: Math.random(),
      };

      // use 32B for test, can be any string, usually the contract the multisharings is created for
      const keyContext = TestUtils.getRandomBytes32();
      const cryptoInfo = await encryptionWrapper.getCryptoInfo(
        keyContext,
        EncryptionWrapperKeyType.Sharing,
        EncryptionWrapperCryptorType.Content,
        { sharingContractId: sharingAddress },
      );

      // generate and store new key for crypto info
      const encryptionArtifacts = {
        accountId: identity,
        propertyName: '*',
      };
      const key = await encryptionWrapper.generateKey(cryptoInfo);
      await encryptionWrapper.storeKey(cryptoInfo, key, encryptionArtifacts);

      // encrypt files (key is pulled from profile)
      const encrypted = await encryptionWrapper.encrypt(
        sampleData, cryptoInfo, encryptionArtifacts,
      );

      expect(encrypted).to.haveOwnProperty('cryptoInfo');
      expect(encrypted).to.haveOwnProperty('private');
      expect(await encryptionWrapper.decrypt(encrypted, encryptionArtifacts))
        .to.deep.eq(sampleData);
    });
  });

  describe('when using keys stored separately', () => {
    it('should be able to encrypt and decrypt files with a new key from profile', async () => {
      const file = await promisify(readFile)(
        `${__dirname}/testfile.spec.jpg`,
      );
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
        keyContext,
        EncryptionWrapperKeyType.Custom,
        EncryptionWrapperCryptorType.File,
      );

      // generate with custom logic, e.g. with the aes cryptor
      const cryptor = cryptoProvider.getCryptorByCryptoAlgo('aes');
      const key = await cryptor.generateKey();

      // encrypt files (key is pulled from profile)
      const encrypted = await encryptionWrapper.encrypt(sampleFile, cryptoInfo, { key });

      expect(encrypted).to.haveOwnProperty('cryptoInfo');
      expect(encrypted).to.haveOwnProperty('private');
      expect(await encryptionWrapper.decrypt(encrypted, { key })).to.deep.eq(sampleFileBackup);
    });

    it('should be able to encrypt and decrypt data with new key from profile', async () => {
      const sampleData = {
        foo: TestUtils.getRandomBytes32(),
        bar: Math.random(),
      };

      // use 32B for test, can be any string
      const keyContext = TestUtils.getRandomBytes32();
      const cryptoInfo = await encryptionWrapper.getCryptoInfo(
        keyContext,
        EncryptionWrapperKeyType.Custom,
        EncryptionWrapperCryptorType.Content,
      );

      // generate with custom logic, e.g. with the aes cryptor
      const cryptor = cryptoProvider.getCryptorByCryptoAlgo('aes');
      const key = await cryptor.generateKey();

      // encrypt files (key is pulled from profile)
      const encrypted = await encryptionWrapper.encrypt(sampleData, cryptoInfo, { key });

      expect(encrypted).to.haveOwnProperty('cryptoInfo');
      expect(encrypted).to.haveOwnProperty('private');
      expect(await encryptionWrapper.decrypt(encrypted, { key })).to.deep.eq(sampleData);
    });
  });
});
