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
import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import {
  DfsInterface,
  NameResolver,
} from '@evan.network/dbcp';

import { CryptoProvider } from '../encryption/crypto-provider';
import { Runtime } from '../runtime';
import { accounts } from '../test/accounts';
import { sampleContext, TestUtils } from '../test/test-utils';


use(chaiAsPromised);
let useIdentity = false;
try {
  useIdentity = JSON.parse(process.env.USE_IDENTITY);
} catch (_) {
  // silently continue
}

describe('Sharing handler', function test() {
  this.timeout(300000);
  let runtimes: Runtime[];
  let dfs: DfsInterface;
  let nameResolver: NameResolver;
  let web3;
  let cryptoProvider: CryptoProvider;

  before(async () => {
    runtimes = await Promise.all(
      accounts.slice(0, 2).map(
        (account) => TestUtils.getRuntime(account, null, { useIdentity }),
      ),
    );
    ([{
      cryptoProvider,
      dfs,
      nameResolver,
      web3,
    }] = runtimes);
  });

  function runContractTests(isMultiShared) {
    const contractName = !isMultiShared ? 'Shared' : 'MultiSharedTest';
    const sharingId = !isMultiShared
      ? null : `0x${Math.floor(Math.random() * 255 * 255 * 255).toString(16).padStart(64, '0')}`;

    it('should be able to add a sharing', async () => {
      const randomSecret = `super secret; ${Math.random()}`;
      const contract = await runtimes[0].executor.createContract(
        contractName, [], { from: runtimes[0].activeIdentity, gas: 1e6 },
      );
      await runtimes[0].sharing.addSharing(
        contract.options.address,
        runtimes[0].activeIdentity,
        runtimes[1].activeIdentity,
        '*',
        0,
        randomSecret,
        null,
        false,
        sharingId,
      );
    });

    it('should be able to get a sharing key', async () => {
      const randomSecret = `super secret; ${Math.random()}`;
      const contract = await runtimes[0].executor.createContract(
        contractName, [], { from: runtimes[0].activeIdentity, gas: 500000 },
      );
      await runtimes[0].sharing.addSharing(
        contract.options.address,
        runtimes[0].activeIdentity,
        runtimes[1].activeIdentity,
        '*',
        0,
        randomSecret,
        null,
        false,
        sharingId,
      );
      const key = await runtimes[0].sharing.getKey(contract.options.address, runtimes[1].activeIdentity, '*', 0, sharingId);
      expect(key).to.eq(randomSecret);
    });

    it('should be able to list all sharings', async () => {
      const randomSecret = `super secret; ${Math.random()}`;
      const contract = await runtimes[0].executor.createContract(
        contractName, [], { from: runtimes[0].activeIdentity, gas: 500000 },
      );
      await runtimes[0].sharing.addSharing(contract.options.address,
        runtimes[0].activeIdentity,
        runtimes[1].activeIdentity,
        '*',
        0,
        randomSecret,
        null,
        false,
        sharingId);
      const sharings = await runtimes[0].sharing.getSharings(
        contract.options.address, null, null, null, sharingId,
      );
      expect(sharings).not.to.be.undefined;
    });

    it('should be able to remove a sharing', async () => {
      const randomSecret = `super secret; ${Math.random()}`;
      const contract = await runtimes[0].executor.createContract(
        contractName, [], { from: runtimes[0].activeIdentity, gas: 500000 },
      );
      await runtimes[0].sharing.addSharing(
        contract.options.address,
        runtimes[0].activeIdentity,
        runtimes[1].activeIdentity,
        '*',
        0,
        randomSecret,
        null,
        false,
        sharingId,
      );
      let sharings = await runtimes[0].sharing.getSharings(
        contract.options.address, null, null, null, sharingId,
      );
      expect(Object.keys(sharings).length).to.eq(1);
      expect(Object.keys(sharings[nameResolver.soliditySha3(runtimes[1].activeIdentity)]).length)
        .to.eq(1);
      expect(
        Object.keys(
          sharings[nameResolver.soliditySha3(runtimes[1].activeIdentity)][nameResolver.soliditySha3('*')],
        ).length,
      )
        .to.eq(1);
      expect(sharings[nameResolver.soliditySha3(runtimes[1].activeIdentity)][nameResolver.soliditySha3('*')][0])
        .to.eq(randomSecret);

      await runtimes[0].sharing.removeSharing(
        contract.options.address, runtimes[0].activeIdentity, runtimes[1].activeIdentity, '*', sharingId,
      );
      sharings = await runtimes[0].sharing.getSharings(
        contract.options.address, null, null, null, sharingId,
      );
      expect(Object.keys(sharings).length).to.eq(0);
      const key1 = await runtimes[1].sharing.getKey(contract.options.address, runtimes[1].activeIdentity, '*', 0, sharingId);
      expect(key1).to.be.undefined;
    });

    it('should be able to store sharings under a given context', async () => {
      const randomSecret = `super secret; ${Math.random()}`;
      const contract = await runtimes[0].executor.createContract(
        contractName, [], { from: runtimes[0].activeIdentity, gas: 500000 },
      );
      await runtimes[0].sharing.addSharing(
        contract.options.address,
        runtimes[0].activeIdentity,
        runtimes[1].activeIdentity,
        '*',
        0,
        randomSecret,
        sampleContext,
        false,
        sharingId,
      );
      const key = await runtimes[1].sharing.getKey(contract.options.address, runtimes[1].activeIdentity, '*', 0, sharingId);
      expect(key).to.eq(randomSecret);

      const contract2 = await runtimes[0].executor.createContract(
        contractName, [], { from: runtimes[0].activeIdentity, gas: 500000 },
      );
      const unknownContext = 'I have not been added to any config';
      let err;
      try {
        await runtimes[1].sharing.addSharing(
          contract2.options.address,
          runtimes[0].activeIdentity,
          runtimes[1].activeIdentity,
          '*',
          0,
          randomSecret,
          unknownContext,
          false,
          sharingId,
        );
        await runtimes[1].sharing.getKey(
          contract2.options.address, runtimes[1].activeIdentity, '*', 0, sharingId,
        );
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
      const contract = await runtimes[0].executor.createContract(
        contractName, [], { from: runtimes[0].activeIdentity, gas: 500000 },
      );
      await runtimes[0].sharing.addSharing(
        contract.options.address,
        runtimes[0].activeIdentity,
        runtimes[1].activeIdentity,
        'sectionOne',
        0,
        randomSecret[0],
        null,
        false,
        sharingId,
      );
      await runtimes[0].sharing.addSharing(
        contract.options.address,
        runtimes[0].activeIdentity,
        runtimes[1].activeIdentity,
        'sectionTwo',
        0,
        randomSecret[1],
        null,
        false,
        sharingId,
      );
      await runtimes[0].sharing.addSharing(
        contract.options.address,
        runtimes[0].activeIdentity,
        runtimes[1].activeIdentity,
        'sectionThree',
        0,
        randomSecret[2],
        null,
        false,
        sharingId,
      );
      const sharings = await runtimes[0].sharing.getSharings(
        contract.options.address, null, null, null, sharingId,
      );
      // object checks
      expect(Object.keys(sharings))
        .to.deep.eq([nameResolver.soliditySha3(runtimes[1].activeIdentity)]);
      expect(
        sharings[nameResolver.soliditySha3(runtimes[1].activeIdentity)][nameResolver.soliditySha3('sectionOne')],
      )
        .to.deep.eq({ 0: randomSecret[0] });
      expect(
        sharings[nameResolver.soliditySha3(runtimes[1].activeIdentity)][nameResolver.soliditySha3('sectionTwo')],
      )
        .to.deep.eq({ 0: randomSecret[1] });
      expect(
        sharings[nameResolver.soliditySha3(runtimes[1].activeIdentity)][nameResolver.soliditySha3('sectionThree')],
      )
        .to.deep.eq({ 0: randomSecret[2] });
      // getKey checks
      expect(
        await runtimes[1].sharing.getKey(contract.options.address, runtimes[1].activeIdentity, 'sectionOne', 1000, sharingId),
      )
        .to.eq(randomSecret[0]);
      expect(
        await runtimes[1].sharing.getKey(contract.options.address, runtimes[1].activeIdentity, 'sectionTwo', 1000, sharingId),
      )
        .to.eq(randomSecret[1]);
      expect(
        await runtimes[1].sharing.getKey(contract.options.address, runtimes[1].activeIdentity, 'sectionThree', 1000, sharingId),
      )
        .to.eq(randomSecret[2]);
    });

    it('should be able to set different keys for different block numbers', async () => {
      const randomSecret = [
        `super secret; ${Math.random()}`,
        `super secret; ${Math.random()}`,
      ];
      const contract = await runtimes[0].executor.createContract(
        contractName, [], { from: runtimes[0].activeIdentity, gas: 500000 },
      );
      await runtimes[0].sharing.addSharing(
        contract.options.address,
        runtimes[0].activeIdentity,
        runtimes[1].activeIdentity,
        'sectionOne',
        100,
        randomSecret[0],
        null,
        false,
        sharingId,
      );
      await runtimes[0].sharing.addSharing(
        contract.options.address,
        runtimes[0].activeIdentity,
        runtimes[1].activeIdentity,
        'sectionOne',
        200,
        randomSecret[1],
        null,
        false,
        sharingId,
      );
      const sharings = await runtimes[0].sharing.getSharings(
        contract.options.address, null, null, null, sharingId,
      );
      // object checks
      expect(Object.keys(sharings))
        .to.deep.eq([nameResolver.soliditySha3(runtimes[1].activeIdentity)]);
      expect(
        sharings[nameResolver.soliditySha3(runtimes[1].activeIdentity)][nameResolver.soliditySha3('sectionOne')]['100'],
      )
        .to.eq(randomSecret[0]);
      expect(
        sharings[nameResolver.soliditySha3(runtimes[1].activeIdentity)][nameResolver.soliditySha3('sectionOne')]['200'],
      )
        .to.eq(randomSecret[1]);
      // getKey checks
      // exactly in block 0
      expect(
        await runtimes[1].sharing.getKey(contract.options.address, runtimes[1].activeIdentity, 'sectionOne', 0, sharingId),
      )
        .to.eq(undefined);
      // between before block 100
      expect(
        await runtimes[1].sharing.getKey(contract.options.address, runtimes[1].activeIdentity, 'sectionOne', 12, sharingId),
      )
        .to.eq(undefined);
      // exactly in block 100
      expect(
        await runtimes[1].sharing.getKey(contract.options.address, runtimes[1].activeIdentity, 'sectionOne', 100, sharingId),
      )
        .to.eq(randomSecret[0]);
      // between block 100 and block 200
      expect(
        await runtimes[1].sharing.getKey(contract.options.address, runtimes[1].activeIdentity, 'sectionOne', 123, sharingId),
      )
        .to.eq(randomSecret[0]);
      // exactly in block 200
      expect(
        await runtimes[1].sharing.getKey(contract.options.address, runtimes[1].activeIdentity, 'sectionOne', 200, sharingId),
      )
        .to.eq(randomSecret[1]);
      // after block 200
      expect(
        await runtimes[1].sharing.getKey(contract.options.address, runtimes[1].activeIdentity, 'sectionOne', 234, sharingId),
      )
        .to.eq(randomSecret[1]);
    });

    it('should not be possible to get keys of another user', async () => {
      const randomSecret = [
        `super secret; ${Math.random()}`,
        `super secret; ${Math.random()}`,
      ];
      const contract = await runtimes[0].executor.createContract(
        contractName, [], { from: runtimes[0].activeIdentity, gas: 500000 },
      );
      await runtimes[0].sharing.addSharing(
        contract.options.address,
        runtimes[0].activeIdentity,
        runtimes[1].activeIdentity,
        'sectionOne',
        0,
        randomSecret[0],
        null,
        false,
        sharingId,
      );
      await runtimes[0].sharing.addSharing(
        contract.options.address,
        runtimes[0].activeIdentity,
        runtimes[0].activeIdentity,
        'sectionOne',
        0,
        randomSecret[1],
        null,
        false,
        sharingId,
      );
      const sharings = await runtimes[0].sharing.getSharings(
        contract.options.address, null, null, null, sharingId,
      );
      // object checks
      expect(Object.keys(sharings).sort())
        .to.deep.eq(
          [
            nameResolver.soliditySha3(runtimes[1].activeIdentity),
            nameResolver.soliditySha3(runtimes[0].activeIdentity),
          ].sort(),
        );
      expect(
        sharings[nameResolver.soliditySha3(runtimes[1].activeIdentity)][nameResolver.soliditySha3('sectionOne')],
      )
        .to.deep.eq(
          { 0: randomSecret[0] },
        );
      expect(
        sharings[nameResolver.soliditySha3(runtimes[0].activeIdentity)][nameResolver.soliditySha3('sectionOne')],
      )
        .to.deep.eq({ 0: randomSecret[1] });
      // getKey checks
      expect(
        await runtimes[1].sharing.getKey(contract.options.address, runtimes[1].activeIdentity, 'sectionOne', 0, sharingId),
      )
        .to.eq(randomSecret[0]);
      expect(
        await runtimes[0].sharing.getKey(contract.options.address, runtimes[0].activeIdentity, 'sectionOne', 0, sharingId),
      )
        .to.eq(randomSecret[1]);
    });

    it('should be able to change keys for a section', async () => {
      const randomSecret = [
        `super secret; ${Math.random()}`,
        `super secret; ${Math.random()}`,
      ];
      const contract = await runtimes[0].executor.createContract(
        contractName, [], { from: runtimes[0].activeIdentity, gas: 500000 },
      );
      await runtimes[0].sharing.addSharing(
        contract.options.address,
        runtimes[0].activeIdentity,
        runtimes[1].activeIdentity,
        'sectionOne',
        100,
        randomSecret[0],
        null,
        false,
        sharingId,
      );
      runtimes[1].sharing.clearCache();
      let sharings = await runtimes[1].sharing.getSharings(
        contract.options.address, null, null, null, sharingId,
      );
      // object checks
      expect(Object.keys(sharings))
        .to.deep.eq([nameResolver.soliditySha3(runtimes[1].activeIdentity)]);
      expect(
        sharings[nameResolver.soliditySha3(runtimes[1].activeIdentity)][nameResolver.soliditySha3('sectionOne')]['100'],
      )
        .to.eq(randomSecret[0]);
      expect(
        sharings[nameResolver.soliditySha3(runtimes[1].activeIdentity)][nameResolver.soliditySha3('sectionOne')]['200'],
      )
        .to.eq(undefined);
      // initial keys setup
      // exactly in block 0
      expect(
        await runtimes[1].sharing.getKey(contract.options.address, runtimes[1].activeIdentity, 'sectionOne', 0, sharingId),
      )
        .to.eq(undefined);
      // between before block 100
      expect(
        await runtimes[1].sharing.getKey(contract.options.address, runtimes[1].activeIdentity, 'sectionOne', 12, sharingId),
      )
        .to.eq(undefined);
      // exactly in block 100
      expect(
        await runtimes[1].sharing.getKey(contract.options.address, runtimes[1].activeIdentity, 'sectionOne', 100, sharingId),
      )
        .to.eq(randomSecret[0]);
      // between block 100 and block 200
      expect(
        await runtimes[1].sharing.getKey(contract.options.address, runtimes[1].activeIdentity, 'sectionOne', 123, sharingId),
      )
        .to.eq(randomSecret[0]);
      // exactly in block 200
      expect(
        await runtimes[1].sharing.getKey(contract.options.address, runtimes[1].activeIdentity, 'sectionOne', 200, sharingId),
      )
        .to.eq(randomSecret[0]);
      // after block 200
      expect(
        await runtimes[1].sharing.getKey(contract.options.address, runtimes[1].activeIdentity, 'sectionOne', 234, sharingId),
      )
        .to.eq(randomSecret[0]);

      // add new key, valid in and after block 200
      await runtimes[0].sharing.addSharing(
        contract.options.address,
        runtimes[0].activeIdentity,
        runtimes[1].activeIdentity,
        'sectionOne',
        200,
        randomSecret[1],
        null,
        false,
        sharingId,
      );
      runtimes[1].sharing.clearCache();
      sharings = await runtimes[1].sharing.getSharings(
        contract.options.address, null, null, null, sharingId,
      );
      expect(Object.keys(sharings))
        .to.deep.eq([nameResolver.soliditySha3(runtimes[1].activeIdentity)]);
      expect(
        sharings[nameResolver.soliditySha3(runtimes[1].activeIdentity)][nameResolver.soliditySha3('sectionOne')]['100'],
      )
        .to.eq(randomSecret[0]);
      expect(
        sharings[nameResolver.soliditySha3(runtimes[1].activeIdentity)][nameResolver.soliditySha3('sectionOne')]['200'],
      )
        .to.eq(randomSecret[1]);
      // exactly in block 0
      expect(
        await runtimes[1].sharing.getKey(contract.options.address, runtimes[1].activeIdentity, 'sectionOne', 0, sharingId),
      )
        .to.eq(undefined);
      // between before block 100
      expect(
        await runtimes[1].sharing.getKey(contract.options.address, runtimes[1].activeIdentity, 'sectionOne', 12, sharingId),
      )
        .to.eq(undefined);
      // exactly in block 100
      expect(
        await runtimes[1].sharing.getKey(contract.options.address, runtimes[1].activeIdentity, 'sectionOne', 100, sharingId),
      )
        .to.eq(randomSecret[0]);
      // between block 100 and block 200
      expect(
        await runtimes[1].sharing.getKey(contract.options.address, runtimes[1].activeIdentity, 'sectionOne', 123, sharingId),
      )
        .to.eq(randomSecret[0]);
      // exactly in block 200
      expect(
        await runtimes[1].sharing.getKey(contract.options.address, runtimes[1].activeIdentity, 'sectionOne', 200, sharingId),
      )
        .to.eq(randomSecret[1]);
      // after block 200
      expect(
        await runtimes[1].sharing.getKey(contract.options.address, runtimes[1].activeIdentity, 'sectionOne', 234, sharingId),
      )
        .to.eq(randomSecret[1]);
    });

    it('should be able to get lates key if omitting block argument', async () => {
      const randomSecret = [
        `super secret; ${Math.random()}`,
        `super secret; ${Math.random()}`,
        `super secret; ${Math.random()}`,
      ];
      const contract = await runtimes[0].executor.createContract(
        contractName, [], { from: runtimes[0].activeIdentity, gas: 500000 },
      );
      // if no sharings added, key is undefined
      expect(
        await runtimes[1].sharing.getKey(
          contract.options.address, runtimes[1].activeIdentity, 'sectionOne', Number.MAX_SAFE_INTEGER, sharingId,
        ),
      )
        .to.eq(undefined);
      // add a key, this will be the latest key
      await runtimes[0].sharing.addSharing(
        contract.options.address,
        runtimes[0].activeIdentity,
        runtimes[1].activeIdentity,
        'sectionOne',
        100,
        randomSecret[0],
        null,
        false,
        sharingId,
      );
      runtimes[1].sharing.clearCache();
      expect(
        await runtimes[1].sharing.getKey(
          contract.options.address, runtimes[1].activeIdentity, 'sectionOne', Number.MAX_SAFE_INTEGER, sharingId,
        ),
      )
        .to.eq(randomSecret[0]);
      // add a key before the first one --> latest key should not change
      await runtimes[0].sharing.addSharing(
        contract.options.address,
        runtimes[0].activeIdentity,
        runtimes[1].activeIdentity,
        'sectionOne',
        50,
        randomSecret[1],
        null,
        false,
        sharingId,
      );
      expect(
        await runtimes[1].sharing.getKey(
          contract.options.address, runtimes[1].activeIdentity, 'sectionOne', Number.MAX_SAFE_INTEGER, sharingId,
        ),
      )
        .to.eq(randomSecret[0]);
      // add a key after the first one --> latest key should change
      await runtimes[0].sharing.addSharing(
        contract.options.address,
        runtimes[0].activeIdentity,
        runtimes[1].activeIdentity,
        'sectionOne',
        150,
        randomSecret[2],
        null,
        false,
        sharingId,
      );
      runtimes[1].sharing.clearCache();
      expect(
        await runtimes[1].sharing.getKey(
          contract.options.address, runtimes[1].activeIdentity, 'sectionOne', Number.MAX_SAFE_INTEGER, sharingId,
        ),
      )
        .to.eq(randomSecret[2]);
    });

    it('should be able to share hash keys', async () => {
      const contract = await runtimes[0].executor.createContract(
        contractName, [], { from: runtimes[0].activeIdentity, gas: 500000 },
      );
      const hashCryptor = cryptoProvider.getCryptorByCryptoAlgo('aesEcb');
      const hashKey = await hashCryptor.generateKey();
      await runtimes[0].sharing.ensureHashKey(
        contract.options.address,
        runtimes[0].activeIdentity,
        runtimes[0].activeIdentity,
        hashKey,
        null,
        sharingId,
      );
      await runtimes[0].sharing.ensureHashKey(
        contract.options.address,
        runtimes[0].activeIdentity,
        runtimes[1].activeIdentity,
        hashKey,
        null,
        sharingId,
      );
      const key = await runtimes[1].sharing.getHashKey(
        contract.options.address, runtimes[1].activeIdentity, sharingId,
      );
      expect(key).to.eq(hashKey);
    });

    it('should be able to share hash implicitely when sharing other keys', async () => {
      const contract = await runtimes[0].executor.createContract(
        contractName, [], { from: runtimes[0].activeIdentity, gas: 500000 },
      );
      const hashCryptor = cryptoProvider.getCryptorByCryptoAlgo('aesEcb');
      const hashKey = await hashCryptor.generateKey();
      await runtimes[0].sharing.ensureHashKey(
        contract.options.address,
        runtimes[0].activeIdentity,
        runtimes[0].activeIdentity,
        hashKey,
        null,
        sharingId,
      );
      const randomSecret = `super secret; ${Math.random()}`;
      await runtimes[0].sharing.addSharing(
        contract.options.address,
        runtimes[0].activeIdentity,
        runtimes[1].activeIdentity,
        '*',
        0,
        randomSecret,
        null,
        false,
        sharingId,
      );
      // check shared key
      const sharedKey = await runtimes[1].sharing.getKey(
        contract.options.address, runtimes[1].activeIdentity, '*', 0, sharingId,
      );
      expect(sharedKey).to.eq(randomSecret);
      // check hash key
      const hashKeyRetrieved = await runtimes[1].sharing.getHashKey(
        contract.options.address, runtimes[1].activeIdentity, sharingId,
      );
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
      const contract = await runtimes[0].executor.createContract(
        contractName, [], { from: runtimes[0].activeIdentity, gas: 500000 },
      );
      await runtimes[0].sharing.addSharing(
        contract.options.address,
        runtimes[0].activeIdentity,
        runtimes[1].activeIdentity,
        'sectionOne',
        100,
        randomSecret[0],
        null,
        false,
        sharingId,
      );
      await runtimes[0].sharing.addSharing(
        contract.options.address,
        runtimes[0].activeIdentity,
        runtimes[1].activeIdentity,
        'sectionOne',
        200,
        randomSecret[1],
        null,
        false,
        sharingId,
      );
      const history = await runtimes[1].sharing.getKeyHistory(
        contract.options.address, runtimes[1].activeIdentity, 'sectionOne', sharingId,
      );

      expect(history).to.deep.eq(target);
    });

    describe('when adding preloaded sharing hashes', () => {
      it('should be able to work with correct added to the hash cache', async () => {
        const randomSecret = `super secret; ${Math.random()}`;
        // create a contract with a sharing
        const contract = await runtimes[0].executor.createContract(
          contractName, [], { from: runtimes[0].activeIdentity, gas: 500000 },
        );
        await runtimes[0].sharing.addSharing(
          contract.options.address,
          runtimes[0].activeIdentity,
          runtimes[1].activeIdentity,
          '*',
          0,
          randomSecret,
          null,
          false,
          sharingId,
        );

        // add sharing key
        const sharingHash = await (sharingId
          ? runtimes[0].executor.executeContractCall(contract, 'multiSharings', sharingId)
          : runtimes[0].executor.executeContractCall(contract, 'sharing')
        );
        const sharings = await dfs.get(sharingHash);
        runtimes[1].sharing.addHashToCache(
          contract.options.address, JSON.parse(sharings.toString()), sharingId,
        );
        const key = await runtimes[1].sharing.getKey(
          contract.options.address, runtimes[1].activeIdentity, '*', 0, sharingId,
        );
        expect(key).to.eq(randomSecret);
      });
    });
  }

  describe('for contracts that inherit from "Shared"', () => {
    runContractTests(false);

    it('should be able to bump keys (add a new key for given section to all given accounts',
      async () => {
        const randomSecret = [
          `super secret; ${Math.random()}`,
          `super secret; ${Math.random()}`,
        ];
        const contract = await runtimes[0].executor.createContract(
          'Shared', [], { from: runtimes[0].activeIdentity, gas: 500000 },
        );
        await runtimes[0].sharing.addSharing(
          contract.options.address,
          runtimes[0].activeIdentity,
          runtimes[1].activeIdentity,
          'sectionOne',
          100,
          randomSecret[0],
          null,
          false,
        );
        await runtimes[0].sharing.addSharing(
          contract.options.address,
          runtimes[0].activeIdentity,
          runtimes[1].activeIdentity,
          'sectionOne',
          200,
          randomSecret[1],
          null,
          false,
        );

        const bumpKey = `bump bump bump ${Math.random()}`;
        let block = await web3.eth.getBlockNumber();
        await runtimes[0].sharing.bumpSharings(
          contract.options.address,
          runtimes[0].activeIdentity,
          [runtimes[1].activeIdentity],
          'sectionOne',
          block,
          bumpKey,
        );
        runtimes[1].sharing.clearCache();
        block = await web3.eth.getBlockNumber();
        const key = await runtimes[1].sharing.getKey(contract.options.address, runtimes[1].activeIdentity, 'sectionOne', block);
        expect(key).to.eq(bumpKey);
      });
  });

  describe('for contracts that inherit from "MultiShared"', () => {
    runContractTests(true);

    it('can manage multiple sharings autonomously', async () => {
      const count = 3;
      const sharingIds = [...Array(count)].map(
        () => `0x${Math.floor(Math.random() * 255 * 255 * 255).toString(16).padStart(64, '0')}`,
      );
      const randomSecrets = [...Array(count)].map(() => `super secret; ${Math.random()}`);
      const contract = await runtimes[0].executor.createContract(
        'MultiSharedTest', [], { from: runtimes[0].activeIdentity, gas: 500000 },
      );
      for (let i = 0; i < count; i += 1) {
        await runtimes[0].sharing.addSharing(
          contract.options.address,
          runtimes[0].activeIdentity,
          runtimes[1].activeIdentity,
          '*',
          0,
          randomSecrets[i],
          null,
          false,
          sharingIds[i],
        );
      }
      for (let i = 0; i < count; i += 1) {
        const key = await runtimes[1].sharing.getKey(
          contract.options.address, runtimes[1].activeIdentity, '*', 0, sharingIds[i],
        );
        expect(key).to.eq(randomSecrets[i]);
      }
    });
  });
});
