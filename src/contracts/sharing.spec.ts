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
import { expect, use } from 'chai';
import chaiAsPromised = require('chai-as-promised');

import {
  DfsInterface,
  Executor,
  Ipfs,
  NameResolver,
} from '@evan.network/dbcp';

import { accounts } from '../test/accounts';
import { config } from '../config';
import { CryptoProvider } from '../encryption/crypto-provider';
import { Sharing } from './sharing';
import { sampleContext, TestUtils } from '../test/test-utils';

use(chaiAsPromised);


describe('Sharing handler', function() {
  this.timeout(300000);
  let executor: Executor;
  let dfs: DfsInterface;
  let nameResolver: NameResolver;
  let sharing: Sharing;
  let testAddress: string;
  let web3;
  let description;
  let cryptoProvider: CryptoProvider;

  before(async () => {
    web3 = TestUtils.getWeb3();
    executor = await TestUtils.getExecutor(web3);
    dfs = await TestUtils.getIpfs();
    nameResolver = await TestUtils.getNameResolver(web3);
    cryptoProvider = TestUtils.getCryptoProvider();
    description = await TestUtils.getDescription(web3, dfs);
    sharing = new Sharing({
      contractLoader: await TestUtils.getContractLoader(web3),
      cryptoProvider,
      description,
      executor,
      dfs,
      keyProvider: TestUtils.getKeyProvider(),
      nameResolver: nameResolver,
      defaultCryptoAlgo: 'aes',
    });
    testAddress = `barfoo.${nameResolver.getDomainName(config.nameResolver.domains.root)}`;
  });

  after(async () => {
    await dfs.stop();
    web3.currentProvider.connection.close();
  });


  function runContractTests(isMultiShared) {
    const contractName = !isMultiShared ? 'Shared' : 'MultiSharedTest';
    const sharingId = !isMultiShared ? null : `0x${Math.floor(Math.random() * 255 * 255 * 255).toString(16).padStart(64, '0')}`;

    it('should be able to add a sharing', async () => {
      const randomSecret = `super secret; ${Math.random()}`;
      const contract = await executor.createContract(
        contractName, [], { from: accounts[0], gas: 500000, });
      await sharing.addSharing(contract.options.address, accounts[0], accounts[1], '*', 0, randomSecret, null, false, sharingId);
    });

    it('should be able to get a sharing key', async () => {
      const randomSecret = `super secret; ${Math.random()}`;
      const contract = await executor.createContract(
        contractName, [], { from: accounts[0], gas: 500000, });
      await sharing.addSharing(contract.options.address, accounts[0], accounts[1], '*', 0, randomSecret, null, false, sharingId);
      const key = await sharing.getKey(contract.options.address, accounts[1], '*', 0, sharingId);
      expect(key).to.eq(randomSecret);
    });

    it('should be able to list all sharings', async () => {
      const randomSecret = `super secret; ${Math.random()}`;
      const contract = await executor.createContract(
        contractName, [], { from: accounts[0], gas: 500000, });
      await sharing.addSharing(contract.options.address, accounts[0], accounts[1], '*', 0, randomSecret, null, false, sharingId);
      const sharings = await sharing.getSharings(contract.options.address, null, null, null, sharingId);
      expect(sharings).not.to.be.undefined;
    });

    it('should be able to remove a sharing', async () => {
      const randomSecret = `super secret; ${Math.random()}`;
      const contract = await executor.createContract(
        contractName, [], { from: accounts[0], gas: 500000, });
      await sharing.addSharing(contract.options.address, accounts[0], accounts[1], '*', 0, randomSecret, null, false, sharingId);
      let sharings = await sharing.getSharings(contract.options.address, null, null, null, sharingId);
      expect(Object.keys(sharings).length).to.eq(1);
      expect(Object.keys(sharings[nameResolver.soliditySha3(accounts[1])]).length).to.eq(1);
      expect(Object.keys(sharings[nameResolver.soliditySha3(accounts[1])][nameResolver.soliditySha3('*')]).length).to.eq(1);
      expect(sharings[nameResolver.soliditySha3(accounts[1])][nameResolver.soliditySha3('*')][0]).to.eq(randomSecret);

      await sharing.removeSharing(contract.options.address, accounts[0], accounts[1], '*', sharingId);
      sharings = await sharing.getSharings(contract.options.address, null, null, null, sharingId);
      expect(Object.keys(sharings).length).to.eq(0);
      const key1 = await sharing.getKey(contract.options.address, accounts[1], '*', 0, sharingId);
      expect(key1).to.be.undefined;
    });

    it('should be able to store sharings under a given context', async () => {
      const randomSecret = `super secret; ${Math.random()}`;
      const contract = await executor.createContract(
        contractName, [], { from: accounts[0], gas: 500000, });
      await sharing.addSharing(contract.options.address, accounts[0], accounts[1], '*', 0, randomSecret, sampleContext, false, sharingId);
      const key = await sharing.getKey(contract.options.address, accounts[1], '*', 0, sharingId);
      expect(key).to.eq(randomSecret);

      const contract2 = await executor.createContract(
        contractName, [], { from: accounts[0], gas: 500000, });
      const unknownContext = 'I have not been added to any config';
      let err;
      try {
        await sharing.addSharing(contract2.options.address, accounts[0], accounts[1], '*', 0, randomSecret, unknownContext, false, sharingId);
        const notWorkingKey = await sharing.getKey(contract2.options.address, accounts[1], '*', 0, sharingId);
      } catch (ex) {
        err = ex;
      }
      expect(err).to.be.an('error');
    });

    it('should be able to set different keys for different properties', async () => {
      const randomSecret = [
        `super secret; ${Math.random()}`,
        `super secret; ${Math.random()}`,
        `super secret; ${Math.random()}`,
      ];
      const contract = await executor.createContract(contractName, [], { from: accounts[0], gas: 500000, });
      await sharing.addSharing(contract.options.address, accounts[0], accounts[1], 'sectionOne', 0, randomSecret[0], null, false, sharingId);
      await sharing.addSharing(contract.options.address, accounts[0], accounts[1], 'sectionTwo', 0, randomSecret[1], null, false, sharingId);
      await sharing.addSharing(contract.options.address, accounts[0], accounts[1], 'sectionThree', 0, randomSecret[2], null, false, sharingId);
      let sharings = await sharing.getSharings(contract.options.address, null, null, null, sharingId);
      // object checks
      expect(Object.keys(sharings)).to.deep.eq([nameResolver.soliditySha3(accounts[1])]);
      expect(sharings[nameResolver.soliditySha3(accounts[1])][nameResolver.soliditySha3('sectionOne')]).to.deep.eq({ '0': randomSecret[0], });
      expect(sharings[nameResolver.soliditySha3(accounts[1])][nameResolver.soliditySha3('sectionTwo')]).to.deep.eq({ '0': randomSecret[1], });
      expect(sharings[nameResolver.soliditySha3(accounts[1])][nameResolver.soliditySha3('sectionThree')]).to.deep.eq({ '0': randomSecret[2], });
      // getKey checks
      expect(await sharing.getKey(contract.options.address, accounts[1], 'sectionOne', 1000, sharingId)).to.eq(randomSecret[0]);
      expect(await sharing.getKey(contract.options.address, accounts[1], 'sectionTwo', 1000, sharingId)).to.eq(randomSecret[1]);
      expect(await sharing.getKey(contract.options.address, accounts[1], 'sectionThree', 1000, sharingId)).to.eq(randomSecret[2]);
    });

    it('should be able to set different keys for different block numbers', async () => {
      const randomSecret = [
        `super secret; ${Math.random()}`,
        `super secret; ${Math.random()}`,
      ];
      const contract = await executor.createContract(contractName, [], { from: accounts[0], gas: 500000, });
      await sharing.addSharing(contract.options.address, accounts[0], accounts[1], 'sectionOne', 100, randomSecret[0], null, false, sharingId);
      await sharing.addSharing(contract.options.address, accounts[0], accounts[1], 'sectionOne', 200, randomSecret[1], null, false, sharingId);
      let sharings = await sharing.getSharings(contract.options.address, null, null, null, sharingId);
      // object checks
      expect(Object.keys(sharings)).to.deep.eq([nameResolver.soliditySha3(accounts[1])]);
      expect(sharings[nameResolver.soliditySha3(accounts[1])][nameResolver.soliditySha3('sectionOne')]['100']).to.eq(randomSecret[0]);
      expect(sharings[nameResolver.soliditySha3(accounts[1])][nameResolver.soliditySha3('sectionOne')]['200']).to.eq(randomSecret[1]);
      // getKey checks
      // exactly in block 0
      expect(await sharing.getKey(contract.options.address, accounts[1], 'sectionOne', 0, sharingId)).to.eq(undefined);
      // between before block 100
      expect(await sharing.getKey(contract.options.address, accounts[1], 'sectionOne', 12, sharingId)).to.eq(undefined);
      // exactly in block 100
      expect(await sharing.getKey(contract.options.address, accounts[1], 'sectionOne', 100, sharingId)).to.eq(randomSecret[0]);
      // between block 100 and block 200
      expect(await sharing.getKey(contract.options.address, accounts[1], 'sectionOne', 123, sharingId)).to.eq(randomSecret[0]);
      // exactly in block 200
      expect(await sharing.getKey(contract.options.address, accounts[1], 'sectionOne', 200, sharingId)).to.eq(randomSecret[1]);
      // after block 200
      expect(await sharing.getKey(contract.options.address, accounts[1], 'sectionOne', 234, sharingId)).to.eq(randomSecret[1]);
    });

    it('should not be possible to get keys of another user', async () => {
      const randomSecret = [
        `super secret; ${Math.random()}`,
        `super secret; ${Math.random()}`,
      ];
      const contract = await executor.createContract(contractName, [], { from: accounts[0], gas: 500000, });
      await sharing.addSharing(contract.options.address, accounts[0], accounts[1], 'sectionOne', 0, randomSecret[0], null, false, sharingId);
      await sharing.addSharing(contract.options.address, accounts[0], accounts[0], 'sectionOne', 0, randomSecret[1], null, false, sharingId);
      let sharings = await sharing.getSharings(contract.options.address, null, null, null, sharingId);
      // object checks
      expect(Object.keys(sharings).sort()).to.deep.eq([nameResolver.soliditySha3(accounts[1]), nameResolver.soliditySha3(accounts[0])].sort());
      expect(sharings[nameResolver.soliditySha3(accounts[1])][nameResolver.soliditySha3('sectionOne')]).to.deep.eq({ '0': randomSecret[0], });
      expect(sharings[nameResolver.soliditySha3(accounts[0])][nameResolver.soliditySha3('sectionOne')]).to.deep.eq({ '0': randomSecret[1], });
      // getKey checks
      expect(await sharing.getKey(contract.options.address, accounts[1], 'sectionOne', 0, sharingId)).to.eq(randomSecret[0]);
      expect(await sharing.getKey(contract.options.address, accounts[0], 'sectionOne', 0, sharingId)).to.eq(randomSecret[1]);
    });

    it('should be able to change keys for a section', async () => {
      const randomSecret = [
        `super secret; ${Math.random()}`,
        `super secret; ${Math.random()}`,
      ];
      const contract = await executor.createContract(contractName, [], { from: accounts[0], gas: 500000, });
      await sharing.addSharing(contract.options.address, accounts[0], accounts[1], 'sectionOne', 100, randomSecret[0], null, false, sharingId);
      let sharings = await sharing.getSharings(contract.options.address, null, null, null, sharingId);
      // object checks
      expect(Object.keys(sharings)).to.deep.eq([nameResolver.soliditySha3(accounts[1])]);
      expect(sharings[nameResolver.soliditySha3(accounts[1])][nameResolver.soliditySha3('sectionOne')]['100']).to.eq(randomSecret[0]);
      expect(sharings[nameResolver.soliditySha3(accounts[1])][nameResolver.soliditySha3('sectionOne')]['200']).to.eq(undefined);
      // initial keys setup
      // exactly in block 0
      expect(await sharing.getKey(contract.options.address, accounts[1], 'sectionOne', 0, sharingId)).to.eq(undefined);
      // between before block 100
      expect(await sharing.getKey(contract.options.address, accounts[1], 'sectionOne', 12, sharingId)).to.eq(undefined);
      // exactly in block 100
      expect(await sharing.getKey(contract.options.address, accounts[1], 'sectionOne', 100, sharingId)).to.eq(randomSecret[0]);
      // between block 100 and block 200
      expect(await sharing.getKey(contract.options.address, accounts[1], 'sectionOne', 123, sharingId)).to.eq(randomSecret[0]);
      // exactly in block 200
      expect(await sharing.getKey(contract.options.address, accounts[1], 'sectionOne', 200, sharingId)).to.eq(randomSecret[0]);
      // after block 200
      expect(await sharing.getKey(contract.options.address, accounts[1], 'sectionOne', 234, sharingId)).to.eq(randomSecret[0]);

      // add new key, valid in and after block 200
      await sharing.addSharing(contract.options.address, accounts[0], accounts[1], 'sectionOne', 200, randomSecret[1], null, false, sharingId);
      // sharing.sharingCache = {};
      sharings = await sharing.getSharings(contract.options.address, null, null, null, sharingId);
      expect(Object.keys(sharings)).to.deep.eq([nameResolver.soliditySha3(accounts[1])]);
      expect(sharings[nameResolver.soliditySha3(accounts[1])][nameResolver.soliditySha3('sectionOne')]['100']).to.eq(randomSecret[0]);
      expect(sharings[nameResolver.soliditySha3(accounts[1])][nameResolver.soliditySha3('sectionOne')]['200']).to.eq(randomSecret[1]);
      // exactly in block 0
      expect(await sharing.getKey(contract.options.address, accounts[1], 'sectionOne', 0, sharingId)).to.eq(undefined);
      // between before block 100
      expect(await sharing.getKey(contract.options.address, accounts[1], 'sectionOne', 12, sharingId)).to.eq(undefined);
      // exactly in block 100
      expect(await sharing.getKey(contract.options.address, accounts[1], 'sectionOne', 100, sharingId)).to.eq(randomSecret[0]);
      // between block 100 and block 200
      expect(await sharing.getKey(contract.options.address, accounts[1], 'sectionOne', 123, sharingId)).to.eq(randomSecret[0]);
      // exactly in block 200
      expect(await sharing.getKey(contract.options.address, accounts[1], 'sectionOne', 200, sharingId)).to.eq(randomSecret[1]);
      // after block 200
      expect(await sharing.getKey(contract.options.address, accounts[1], 'sectionOne', 234, sharingId)).to.eq(randomSecret[1]);
    });

    it('should be able to get lates key if omitting block argument', async () => {
      const randomSecret = [
        `super secret; ${Math.random()}`,
        `super secret; ${Math.random()}`,
        `super secret; ${Math.random()}`,
      ];
      const contract = await executor.createContract(contractName, [], { from: accounts[0], gas: 500000, });
      // if no sharings added, key is undefined
      expect(await sharing.getKey(contract.options.address, accounts[1], 'sectionOne', Number.MAX_SAFE_INTEGER, sharingId)).to.eq(undefined);
      // add a key, this will be the latest key
      await sharing.addSharing(contract.options.address, accounts[0], accounts[1], 'sectionOne', 100, randomSecret[0], null, false, sharingId);
      expect(await sharing.getKey(contract.options.address, accounts[1], 'sectionOne', Number.MAX_SAFE_INTEGER, sharingId)).to.eq(randomSecret[0]);
      // add a key before the first one --> latest key should not change
      await sharing.addSharing(contract.options.address, accounts[0], accounts[1], 'sectionOne', 50, randomSecret[1], null, false, sharingId);
      expect(await sharing.getKey(contract.options.address, accounts[1], 'sectionOne', Number.MAX_SAFE_INTEGER, sharingId)).to.eq(randomSecret[0]);
      // add a key after the first one --> latest key should change
      await sharing.addSharing(contract.options.address, accounts[0], accounts[1], 'sectionOne', 150, randomSecret[2], null, false, sharingId);
      expect(await sharing.getKey(contract.options.address, accounts[1], 'sectionOne', Number.MAX_SAFE_INTEGER, sharingId)).to.eq(randomSecret[2]);
    });

    it('should be able to share hash keys', async () => {
      const contract = await executor.createContract(
        contractName, [], { from: accounts[0], gas: 500000, });
      const hashCryptor = cryptoProvider.getCryptorByCryptoAlgo('aesEcb');
      const hashKey = await hashCryptor.generateKey();
      await sharing.ensureHashKey(contract.options.address, accounts[0], accounts[0], hashKey, null, sharingId);
      await sharing.ensureHashKey(contract.options.address, accounts[0], accounts[1], hashKey, null, sharingId);
      const key = await sharing.getHashKey(contract.options.address, accounts[1], sharingId);
      expect(key).to.eq(hashKey);
    });

    it('should be able to share hash implicitely when sharing other keys', async () => {
      const contract = await executor.createContract(
        contractName, [], { from: accounts[0], gas: 500000, });
      const hashCryptor = cryptoProvider.getCryptorByCryptoAlgo('aesEcb');
      const hashKey = await hashCryptor.generateKey();
      await sharing.ensureHashKey(contract.options.address, accounts[0], accounts[0], hashKey, null, sharingId);
      // await sharing.ensureHashKey(contract.options.address, accounts[0], accounts[1], hashKey);
      const randomSecret = `super secret; ${Math.random()}`;
      await sharing.addSharing(contract.options.address, accounts[0], accounts[1], '*', 0, randomSecret, null, false, sharingId);
      // check shared key
      const sharedKey = await sharing.getKey(contract.options.address, accounts[1], '*', 0, sharingId);
      expect(sharedKey).to.eq(randomSecret);
      // check hash key
      const hashKeyRetrieved = await sharing.getHashKey(contract.options.address, accounts[1], sharingId);
      expect(hashKeyRetrieved).to.eq(hashKey);
    });

    it('should be able to retrieve a history of keys for an account and a section', async () => {
      const randomSecret = [
        `super secret; ${Math.random()}`,
        `super secret; ${Math.random()}`,
      ];
      const target = {
        100: randomSecret[0],
        200: randomSecret[1],
      };
      const contract = await executor.createContract(contractName, [], { from: accounts[0], gas: 500000, });
      await sharing.addSharing(contract.options.address, accounts[0], accounts[1], 'sectionOne', 100, randomSecret[0], null, false, sharingId);
      await sharing.addSharing(contract.options.address, accounts[0], accounts[1], 'sectionOne', 200, randomSecret[1], null, false, sharingId);
      const history = await sharing.getKeyHistory(contract.options.address, accounts[1], 'sectionOne', sharingId);

      expect(history).to.deep.eq(target);
    });

    describe('when adding preloaded sharing hashes', () => {
      it('should be able to work with correct added to the hash cache', async () => {
        const randomSecret = `super secret; ${Math.random()}`;
        // create a contract with a sharing
        const contract = await executor.createContract(
          contractName, [], { from: accounts[0], gas: 500000, });
        await sharing.addSharing(contract.options.address, accounts[0], accounts[1], '*', 0, randomSecret, null, false, sharingId);

        // create new sharing with empty cache
        const newSharing = new Sharing({
          contractLoader: await TestUtils.getContractLoader(web3),
          cryptoProvider,
          description,
          executor,
          dfs,
          keyProvider: TestUtils.getKeyProvider(),
          nameResolver: nameResolver,
          defaultCryptoAlgo: 'aes',
        });

        // add sharing key
        const sharingHash = await (sharingId ?
          executor.executeContractCall(contract, 'multiSharings', sharingId) :
          executor.executeContractCall(contract, 'sharing')
        );
        const sharings = await dfs.get('sharingHash');
        newSharing.addHashToCache(contract.options.address, sharings, sharingId);
        const key = await newSharing.getKey(contract.options.address, accounts[1], '*', 0, sharingId);
        expect(key).to.eq(randomSecret);
      });
    });
  }

  describe('for contracts that inherit from "Shared"', function() {
    runContractTests(false);

    it('should be able to bump keys (add a new key for given section to all given accounts', async () => {
      const randomSecret = [
        `super secret; ${Math.random()}`,
        `super secret; ${Math.random()}`,
      ];
      const target = {
        100: randomSecret[0],
        200: randomSecret[1],
      };
      const contract = await executor.createContract('Shared', [], { from: accounts[0], gas: 500000, });
      await sharing.addSharing(contract.options.address, accounts[0], accounts[1], 'sectionOne', 100, randomSecret[0], null, false);
      await sharing.addSharing(contract.options.address, accounts[0], accounts[1], 'sectionOne', 200, randomSecret[1], null, false);
      const history = await sharing.getKeyHistory(contract.options.address, accounts[1], 'sectionOne');

      const bumpKey = `bump bump bump ${Math.random()}`;
      let block = await web3.eth.getBlockNumber();
      await sharing.bumpSharings(
        contract.options.address,
        accounts[0],
        [ accounts[1] ],
        'sectionOne',
        block,
        bumpKey,
      );
      sharing.clearCache();
      block = await web3.eth.getBlockNumber();
      const key = await sharing.getKey(contract.options.address, accounts[1], 'sectionOne', block);
      expect(key).to.eq(bumpKey);
    });
  });

  describe('for contracts that inherit from "MultiShared"', function() {
    runContractTests(true);

    it('can manage multiple sharings autonomously', async () => {
      const count = 3;
      const sharingIds = [...Array(count)].map(() => `0x${Math.floor(Math.random() * 255 * 255 * 255).toString(16).padStart(64, '0')}`);
      const randomSecrets = [...Array(count)].map(() => `super secret; ${Math.random()}`);
      const contract = await executor.createContract('MultiSharedTest', [], { from: accounts[0], gas: 500000, });
      for (let i = 0; i < count; i++) {
        await sharing.addSharing(contract.options.address, accounts[0], accounts[1], '*', 0, randomSecrets[i], null, false, sharingIds[i]);
      }
      for (let i = 0; i < count; i++) {
        const key = await sharing.getKey(contract.options.address, accounts[1], '*', 0, sharingIds[i]);
        expect(key).to.eq(randomSecrets[i]);
      }
    });
  });

  describe('for ENS descriptions', function() {
    beforeEach(async () => {
      // empty description
      await description.setDescriptionToEns(
        testAddress, {
          public: {
            name: 'sharing test',
            description: 'sharing test',
            author: 'sharing author',
            version: '0.0.1',
          },
        },
        accounts[1]
      );
    });

    it('should be able to add a sharing', async () => {
      const randomSecret = `super secret; ${Math.random()}`;
      await sharing.addSharing(testAddress, accounts[1], accounts[0], '*', 0, randomSecret);
    });

    it('should be able to get a sharing key', async () => {
      const randomSecret = `super secret; ${Math.random()}`;
      await sharing.addSharing(testAddress, accounts[1], accounts[0], '*', 0, randomSecret);
      const key = await sharing.getKey(testAddress, accounts[0], '*', 0);
      expect(key).to.eq(randomSecret);
    });

    it('should be able to list all sharings', async () => {
      const randomSecret = `super secret; ${Math.random()}`;
      await sharing.addSharing(testAddress, accounts[1], accounts[0], '*', 0, randomSecret);
      const sharings = await sharing.getSharings(testAddress);
      expect(sharings).not.to.be.undefined;
    });

    it('should be able to remove a sharing', async () => {
      const randomSecret = `super secret; ${Math.random()}`;
      await sharing.addSharing(testAddress, accounts[1], accounts[0], '*', 0, randomSecret);
      let sharings = await sharing.getSharings(testAddress);
      expect(Object.keys(sharings).length).to.eq(1);
      expect(sharings[nameResolver.soliditySha3(accounts[0])][nameResolver.soliditySha3('*')][0]).to.eq(randomSecret);
      await sharing.removeSharing(testAddress, accounts[1], accounts[0], '*');
      sharings = await sharing.getSharings(testAddress);
      expect(Object.keys(sharings).length).to.eq(0);
      const key1 = await sharing.getKey(testAddress, accounts[0], '*', 0);
      expect(key1).to.be.undefined;
    });

    it('should be able to store sharings under a given context', async () => {
      const randomSecret = `super secret; ${Math.random()}`;
      await sharing.addSharing(testAddress, accounts[1], accounts[0], '*', 0, randomSecret, sampleContext);
      const key = await sharing.getKey(testAddress, accounts[0], '*', 0);
      expect(key).to.eq(randomSecret);

      const unknownContext = 'I have not been added to any config';
      let err;
      try {
        await sharing.addSharing(`foo${testAddress}`, accounts[1], accounts[0], '*', 0, randomSecret, unknownContext);
        const notWorkingKey = await sharing.getKey(`foo${testAddress}`, accounts[0], '*', 0);
      } catch (ex) {
        err = ex;
      }
      expect(err).to.be.an('error');
    });
  });
});
