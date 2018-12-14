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
  ContractLoader,
  Description,
  DfsInterface,
  Envelope,
  EventHub,
  Executor,
  NameResolver,
} from '@evan.network/dbcp';

import { accounts } from '../../test/accounts';
import { ConsumerState, ContractState } from '../base-contract/base-contract';
import { config } from '../../config';
import { CryptoProvider } from '../../encryption/crypto-provider';
import { DataContract } from './data-contract';
import { Sharing } from '../../contracts/sharing';
import { sampleContext, TestUtils } from '../../test/test-utils';

use(chaiAsPromised);


describe('DataContract', function() {
  this.timeout(60000);
  let dc: DataContract;
  let contractFactory: any;
  let executor: Executor;
  let loader: ContractLoader;
  let businessCenterDomain;
  let sharing: Sharing;
  let dfs: DfsInterface;
  let web3;
  let cryptoProvider: CryptoProvider;
  let nameResolver: NameResolver;

  const sampleValues = [
    '0x0000000000000000000000000000000000000000000000000000000000001234',
    '0x0000000000000000000000000000000000000000000000000000000000011234',
    '0x0000000000000000000000000000000000000000000000000000000000021234',
    '0x0000000000000000000000000000000000000000000000000000000000031234',
    '0x0000000000000000000000000000000000000000000000000000000000041234',
    '0x0000000000000000000000000000000000000000000000000000000000051234',
  ];
  /* tslint:disable:quotemark */
  const sampleDescription: Envelope = {
    "public": {
      "name": "Data Contract Sample",
      "description": "reiterance oxynitrate sat alternize acurative",
      "version": "0.1.0",
      "author": "evan GmbH",
    }
  };
  /* tslint:enable:quotemark */

  before(async () => {
    web3 = TestUtils.getWeb3();
    nameResolver = await TestUtils.getNameResolver(web3);
    executor = await TestUtils.getExecutor(web3);
    executor.eventHub = await TestUtils.getEventHub(web3);
    loader = await TestUtils.getContractLoader(web3);
    dfs = await TestUtils.getIpfs();
    sharing = await TestUtils.getSharing(web3, dfs);
    cryptoProvider = TestUtils.getCryptoProvider();
    sampleDescription.cryptoInfo = cryptoProvider.getCryptorByCryptoAlgo('aes').getCryptoInfo(nameResolver.soliditySha3(accounts[0]));
    dc = new DataContract({
      cryptoProvider,
      dfs,
      executor,
      loader,
      log: TestUtils.getLogger(),
      nameResolver,
      sharing,
      web3: TestUtils.getWeb3(),
      description: await TestUtils.getDescription(web3, dfs),
    });
    businessCenterDomain = nameResolver.getDomainName(config.nameResolver.domains.businessCenter);

    const businessCenterAddress = await nameResolver.getAddress(businessCenterDomain);
    const businessCenter = await loader.loadContract('BusinessCenter', businessCenterAddress);
    if (!await executor.executeContractCall(businessCenter, 'isMember', accounts[0], { from: accounts[0], })) {
      await executor.executeContractTransaction(businessCenter, 'join', { from: accounts[0], autoGas: 1.1, });
    }
    if (!await executor.executeContractCall(businessCenter, 'isMember', accounts[1], { from: accounts[1], })) {
      await executor.executeContractTransaction(businessCenter, 'join', { from: accounts[1], autoGas: 1.1, });
    }
    if (!await executor.executeContractCall(businessCenter, 'isMember', accounts[2], { from: accounts[2], })) {
      await executor.executeContractTransaction(businessCenter, 'join', { from: accounts[2], autoGas: 1.1, });
    }
  });

  after(async () => {
    await dfs.stop();
  });

  async function createContract(addSharing = false, schema?) {
    let description;
    if (schema) {
      description = JSON.parse(JSON.stringify(sampleDescription));
      description.public.dataSchema = schema;
      description.cryptoInfo = cryptoProvider.getCryptorByCryptoAlgo('aes').getCryptoInfo(nameResolver.soliditySha3(accounts[0]));
    }
    const contract = await dc.create('testdatacontract', accounts[0], businessCenterDomain, description);
    await dc.inviteToContract(businessCenterDomain, contract.options.address, accounts[0], accounts[1]);
    if (addSharing) {
      const blockNr = await web3.eth.getBlockNumber();
      const contentKey = await sharing.getKey(contract.options.address, accounts[0], '*', blockNr);
      await sharing.addSharing(contract.options.address, accounts[0], accounts[1], '*', blockNr, contentKey);
    }
    return contract;
  }

  async function runTestSubset(useClassicRawMode) {
    const [ storeInDfs, encryptHashes ] = [...Array(2)].map(() => !useClassicRawMode);
    describe('when working with entries', async () => {
      describe('that can only be set by the owner', async () => {
        it('allows the owner to add and get entries', async () => {
          const contract = await createContract(storeInDfs);
          await dc.setEntry(contract, 'entry_settable_by_owner', sampleValues[0], accounts[0], storeInDfs, encryptHashes);
          const retrieved = await dc.getEntry(contract, 'entry_settable_by_owner', accounts[0], storeInDfs, encryptHashes);
          expect(retrieved).to.eq(sampleValues[0]);
        });
        it('does not allow the member to add and get entries', async () => {
          const contract = await createContract(storeInDfs);
          const promise = dc.setEntry(contract, 'entry_settable_by_owner', sampleValues[0], accounts[1], storeInDfs, encryptHashes);
          await expect(promise).to.be.rejected;
        });
        it('can retrieve a schema from its description', async () => {
          const contract = await createContract(storeInDfs);
          await dc.setEntry(contract, 'entry_settable_by_owner', sampleValues[0], accounts[0], storeInDfs, encryptHashes);
        });
        it('can use different crypto algorithms for encryption', async () => {
          const contract = await createContract(storeInDfs);
          await dc.setEntry(contract, 'entry_settable_by_owner', sampleValues[0], accounts[0], storeInDfs, encryptHashes);
          const retrievedDefaultAlgo = await dc.getEntry(contract, 'entry_settable_by_owner', accounts[0], storeInDfs, encryptHashes);
          const encryptedHash = await executor.executeContractCall(contract, 'getEntry', nameResolver.sha3('entry_settable_by_owner'));
          if (!storeInDfs) {
            expect(encryptedHash).to.eq(sampleValues[0]);
          } else {
            const unencryptedHash = await dc.decryptHash(encryptedHash, contract, accounts[0]);
            const envelope = JSON.parse((await dfs.get(unencryptedHash)).toString());
            expect(envelope.cryptoInfo.algorithm).to.eq('aes-256-cbc');
            const data = Buffer.from(envelope.private, 'hex').toString('utf-8');
            expect(data).to.not.eq(sampleValues[0]);
          }

          await dc.setEntry(contract, 'entry_settable_by_owner', sampleValues[0], accounts[0], storeInDfs, encryptHashes, 'aes');
          const retrievedAes = await dc.getEntry(contract, 'entry_settable_by_owner', accounts[0], storeInDfs, encryptHashes);
          const hashAes = await executor.executeContractCall(contract, 'getEntry', nameResolver.sha3('entry_settable_by_owner'));
          if (!storeInDfs) {
            expect(hashAes).to.eq(sampleValues[0]);
          } else {
            const unencryptedHash = await dc.decryptHash(hashAes, contract, accounts[0]);
            const envelope = JSON.parse((await dfs.get(unencryptedHash)).toString());
            expect(envelope.cryptoInfo.algorithm).to.eq('aes-256-cbc');
            const data = Buffer.from(envelope.private, 'hex').toString('utf-8');
            expect(data).to.not.eq(sampleValues[0]);
          }

          await dc.setEntry(contract, 'entry_settable_by_owner', sampleValues[0], accounts[0], storeInDfs, encryptHashes, 'unencrypted');
          const retrievedUnencrypted = await dc.getEntry(contract, 'entry_settable_by_owner', accounts[0], storeInDfs, encryptHashes);
          const hashRaw = await executor.executeContractCall(contract, 'getEntry', nameResolver.sha3('entry_settable_by_owner'));
          if (!storeInDfs) {
            expect(hashRaw).to.eq(sampleValues[0]);
          } else {
            const unencryptedHash = await dc.decryptHash(hashRaw, contract, accounts[0]);
            const envelope = JSON.parse((await dfs.get(unencryptedHash)).toString());
            expect(envelope.cryptoInfo.algorithm).to.eq('unencrypted');
            const data = JSON.parse(Buffer.from(envelope.private, 'hex').toString('utf-8'));
            expect(data).to.eq(sampleValues[0]);
          }
        });
        it('allows content to be shared via contexts', async () => {
          // create contract, set value
          const contract = await dc.create('testdatacontract', accounts[0]);
          await dc.setEntry(contract, 'entry_settable_by_owner', sampleValues[0], accounts[0], storeInDfs, encryptHashes);

          // account 1 is invited, but has no sharing
          await dc.inviteToContract(null, contract.options.address, accounts[0], accounts[1]);

          // get key to share
          const blockNr = await web3.eth.getBlockNumber();
          const contentKey = await sharing.getKey(contract.options.address, accounts[0], '*', blockNr);

          // add context based sharing key
          await sharing.addSharing(contract.options.address, accounts[0], sampleContext, '*', 0, contentKey, sampleContext);
          const retrieved = await dc.getEntry(contract, 'entry_settable_by_owner', sampleContext, storeInDfs, encryptHashes);
          expect(retrieved).to.eq(sampleValues[0]);
        })
      });
      describe('that can be set by owner and member', async () => {
        it('allows the owner to add and get entries', async () => {
          const contract = await createContract(storeInDfs);
          await dc.setEntry(contract, 'entry_settable_by_member', sampleValues[0], accounts[0], storeInDfs, encryptHashes);
          const retrieved = await dc.getEntry(contract, 'entry_settable_by_member', accounts[0], storeInDfs, encryptHashes);
          expect(retrieved).to.eq(sampleValues[0]);
        });
        it('allows the member to add and get entries', async () => {
          const contract = await createContract(storeInDfs);
          await dc.setEntry(contract, 'entry_settable_by_member', sampleValues[0], accounts[1], storeInDfs, encryptHashes);
          const retrieved = await dc.getEntry(contract, 'entry_settable_by_member', accounts[1], storeInDfs, encryptHashes);
          expect(retrieved).to.eq(sampleValues[0]);
        });
      });
    });
    describe('when working with lists', async () => {
      describe('that allows only the owner to add items', async () => {
        it('allows the owner to add and get entries', async () => {
          const contract = await createContract(storeInDfs);
          await dc.addListEntries(contract, 'list_settable_by_owner', sampleValues, accounts[0], storeInDfs, encryptHashes);
          const retrieved = await dc.getListEntries(contract, 'list_settable_by_owner', accounts[0], storeInDfs, encryptHashes);
          for (let i = 0; i < sampleValues.length; i++) {
            expect(retrieved[i]).to.eq(sampleValues[i]);
          }
        });
        it('does not allow the member to add entries', async () => {
          const contract = await createContract(storeInDfs);
          const promise = dc.addListEntries(contract, 'list_settable_by_owner', sampleValues, accounts[1], storeInDfs, encryptHashes);
          await expect(promise).to.be.rejected;
        });
        it('allows to retrieve the items with an item limit', async () => {
          const contract = await createContract(storeInDfs);
          await dc.addListEntries(contract, 'list_settable_by_owner', sampleValues, accounts[0], storeInDfs, encryptHashes);
          const retrieved = await dc.getListEntries(contract, 'list_settable_by_owner', accounts[0], storeInDfs, encryptHashes, 2);
          expect(retrieved.length).to.eq(2);
          for (let i = 0; i < 2; i++) {
            expect(retrieved[i]).to.eq(sampleValues[i]);
          }
        });
        it('allows to retrieve the items with an offset', async () => {
          const contract = await createContract(storeInDfs);
          await dc.addListEntries(contract, 'list_settable_by_owner', sampleValues, accounts[0], storeInDfs, encryptHashes);
          const retrieved = await dc.getListEntries(contract, 'list_settable_by_owner', accounts[0], storeInDfs, encryptHashes, 10, 2);
          expect(retrieved.length).to.eq(sampleValues.length - 2);
          for (let i = 0; i < retrieved.length; i++) {
            expect(retrieved[i]).to.eq(sampleValues[i + 2]);
          }
        });
        it('allows to retrieve the items in reverse order', async () => {
          const contract = await createContract(storeInDfs);
          await dc.addListEntries(contract, 'list_settable_by_owner', sampleValues, accounts[0], storeInDfs, encryptHashes);
          const retrieved = await dc.getListEntries(contract, 'list_settable_by_owner', accounts[0], storeInDfs, encryptHashes, 10, 0, true);
          const reverseSamples = sampleValues.reverse();
          for (let i = 0; i < retrieved.length; i++) {
            expect(retrieved[i]).to.eq(reverseSamples[i]);
          }
        });
        it('allows to retrieve the items with a combination of paging arguments', async () => {
          const contract = await createContract(storeInDfs);
          await dc.addListEntries(contract, 'list_settable_by_owner', sampleValues, accounts[0], storeInDfs, encryptHashes);
          const retrieved = await dc.getListEntries(contract, 'list_settable_by_owner', accounts[0], storeInDfs, encryptHashes, 2, 1, true);
          const reverseSamples = sampleValues.reverse();
          for (let i = 0; i < 2; i++) {
            expect(retrieved[i]).to.eq(reverseSamples[i + 1]);
          }
        });
      });
      describe('that allows owner and member to add items', async () => {
        it('allows the owner to add and get entries', async () => {
          const contract = await createContract(storeInDfs);
          await dc.addListEntries(contract, 'list_settable_by_member', sampleValues, accounts[0], storeInDfs, encryptHashes);
          const retrieved = await dc.getListEntries(contract, 'list_settable_by_member', accounts[0], storeInDfs, encryptHashes);
          for (let i = 0; i < sampleValues.length; i++) {
            expect(retrieved[i]).to.eq(sampleValues[i]);
          }
        });
        it('does allow the member to add entries', async () => {
          const contract = await createContract(storeInDfs);
          await dc.addListEntries(contract, 'list_settable_by_member', sampleValues, accounts[1], storeInDfs, encryptHashes);
          const retrieved = await dc.getListEntries(contract, 'list_settable_by_member', accounts[1], storeInDfs, encryptHashes);
          for (let i = 0; i < sampleValues.length; i++) {
            expect(retrieved[i]).to.eq(sampleValues[i]);
          }
        });
      });
      describe('allows the owner to remove list entries', async () => {
        it('allows the owner to remove list entries', async () => {
          const contract = await createContract(storeInDfs);
          await dc.addListEntries(contract, 'list_removable_by_owner', sampleValues, accounts[0], storeInDfs, encryptHashes);
          let retrieved = await dc.getListEntries(contract, 'list_removable_by_owner', accounts[0], storeInDfs, encryptHashes);
          for (let i = 0; i < sampleValues.length; i++) {
            expect(retrieved[i]).to.eq(sampleValues[i]);
          }
          await dc.removeListEntry(contract, 'list_removable_by_owner', 2, accounts[0]);
          retrieved = await dc.getListEntries(contract, 'list_removable_by_owner', accounts[0], storeInDfs, encryptHashes);
          // handle array values like the datacontract
          const modifiedSampleValues = sampleValues.slice(0);
          modifiedSampleValues[2] = modifiedSampleValues[modifiedSampleValues.length - 1];
          for (let i = 0; i < (modifiedSampleValues.length - 1) ; i++) {
            expect(retrieved[i]).to.eq(modifiedSampleValues[i]);
          }
        });
        it('does not allow the member to remove list entries', async () => {
          const contract = await createContract(storeInDfs);
          await dc.addListEntries(contract, 'list_removable_by_owner', sampleValues, accounts[0], storeInDfs, encryptHashes);
          let retrieved = await dc.getListEntries(contract, 'list_removable_by_owner', accounts[0], storeInDfs, encryptHashes);
          for (let i = 0; i < sampleValues.length; i++) {
            expect(retrieved[i]).to.eq(sampleValues[i]);
          }
          const promise = dc.removeListEntry(contract, 'list_removable_by_owner', 2, accounts[1]);
          await expect(promise).to.be.rejected;
        });
      });
      describe('when working with descriptions', async () => {
        /* tslint:disable:quotemark */
        const testSchema = {
          list_settable_by_member: {
            "$id": "list_settable_by_member_schema",
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "foo": { "type": "string" },
              "bar": { "type": "integer" }
            }
          },
          entry_settable_by_member: {
            "$id": "entry_settable_by_member_schema",
            "type": "integer",
          }
        };
        /* tslint:enable:quotemark */
        it('allows adding entries matching the field schema', async () => {
          const contract = await createContract(!storeInDfs, testSchema);
          const values = [ !storeInDfs ? sampleValues[0] : {
            foo: 'sample',
            bar: 123,
          }];
          const promise = dc.addListEntries(contract, 'list_settable_by_member', values, accounts[0], storeInDfs, encryptHashes);
          await expect(promise).to.be.fulfilled;
        });
        it('forbids adding entries not matching the field schema', async () => {
          const contract = await createContract(!storeInDfs, testSchema);
          const values = [ !storeInDfs ? sampleValues[0] : {
            foo: 'sample',
            bar: 'totally not a number',
            barz: 123,
          }];
          const promise = dc.addListEntries(contract, 'list_settable_by_member', values, accounts[0], storeInDfs, encryptHashes);
          if (!storeInDfs) {
            await expect(promise).to.be.fulfilled;
          } else {
            await expect(promise).to.be.rejected;
          }
        });
        it('forbids adding entries not matching their type', async () => {
          const contract = await createContract(!storeInDfs, testSchema);
          const values = [ !storeInDfs ? sampleValues[0] : {
            foo: 'sample',
            bar: '123',
          }];
          const promise = dc.addListEntries(contract, 'list_settable_by_member', values, accounts[0], storeInDfs, encryptHashes);
          if (!storeInDfs) {
            await expect(promise).to.be.fulfilled;
          } else {
            await expect(promise).to.be.rejected;
          }
        });
        it('forbids adding entries with more properties than defined', async () => {
          const contract = await createContract(!storeInDfs, testSchema);
          const values = [ !storeInDfs ? sampleValues[0] : {
            foo: 'sample',
            bar: 123,
            barz: 123,
          }];
          const promise = dc.addListEntries(contract, 'list_settable_by_member', values, accounts[0], storeInDfs, encryptHashes);
          if (!storeInDfs) {
            await expect(promise).to.be.fulfilled;
          } else {
            await expect(promise).to.be.rejected;
          }
        });
        it('fallbacks to accept any if no schema was found', async () => {
          const contract = await createContract(storeInDfs);
          const values = [ !storeInDfs ? sampleValues[0] : {
            foo: 'sample',
            barz: 123,
          }];
          const promise = dc.addListEntries(contract, 'list_settable_by_member', values, accounts[0], storeInDfs, encryptHashes);
          await expect(promise).to.be.fulfilled;
        });
        it('allows setting entries matching the field schema', async () => {
          const contract = await createContract(!storeInDfs, testSchema);
          const value = !storeInDfs ? sampleValues[0] : 123;
          const promise = dc.setEntry(contract, 'entry_settable_by_member', value, accounts[0], storeInDfs, encryptHashes);
          await expect(promise).to.be.fulfilled;
        });
        it('forbids setting entries not matching the field schema', async () => {
          const contract = await createContract(!storeInDfs, testSchema);
          const value = !storeInDfs ? sampleValues[0] : 'totally not an integer';
          const promise = dc.setEntry(contract, 'entry_settable_by_member', value, accounts[0], storeInDfs, encryptHashes);
          if (!storeInDfs) {
            await expect(promise).to.be.fulfilled;
          } else {
            await expect(promise).to.be.rejected;
          }
        });
      });
      describe('when working with multiple lists at a time', async () => {
        it('allows to add entries to multiple lists', async () => {
          const contract = await createContract(storeInDfs);
          await dc.addListEntries(contract, ['list_settable_by_owner', 'list_settable_by_member'], sampleValues, accounts[0], storeInDfs, encryptHashes);
          let retrieved = await dc.getListEntries(contract, 'list_settable_by_owner', accounts[0], storeInDfs, encryptHashes);
          for (let i = 0; i < sampleValues.length; i++) {
            expect(retrieved[i]).to.eq(sampleValues[i]);
          }
          retrieved = await dc.getListEntries(contract, 'list_settable_by_member', accounts[0], storeInDfs, encryptHashes);
          for (let i = 0; i < sampleValues.length; i++) {
            expect(retrieved[i]).to.eq(sampleValues[i]);
          }
        });
        it('does not allow the member to add entries in all lists if not permitted to access one of them', async () => {
          const contract = await createContract(storeInDfs);
          const promise = dc.addListEntries(contract, ['list_settable_by_owner', 'list_settable_by_member'], sampleValues, accounts[1], storeInDfs, encryptHashes);
          await expect(promise).to.be.rejected;
        });
        it('allows to move an entry from one list to another', async () => {
          const contract = await createContract(storeInDfs);
          await dc.addListEntries(contract, ['list_removable_by_owner'], sampleValues, accounts[0], storeInDfs, encryptHashes);
          expect(await dc.getListEntryCount(contract, 'list_removable_by_owner')).to.eq(sampleValues.length);
          expect(await dc.getListEntryCount(contract, 'list_settable_by_member')).to.eq(0);
          expect(await dc.getListEntry(contract, 'list_removable_by_owner', 1, accounts[0], storeInDfs, encryptHashes)).to.eq(sampleValues[1]);
          // move item
          await dc.moveListEntry(contract, 'list_removable_by_owner', 1, ['list_settable_by_member'], accounts[0]);
          expect(await dc.getListEntryCount(contract, 'list_removable_by_owner')).to.eq(sampleValues.length -1);
          expect(await dc.getListEntryCount(contract, 'list_settable_by_member')).to.eq(1);
          // former last elements should have been moved to removed position
          expect(await dc.getListEntry(contract, 'list_removable_by_owner', 1, accounts[0], storeInDfs, encryptHashes)).to.eq(sampleValues[sampleValues.length - 1]);
          // new entry should have been added
          expect(await dc.getListEntry(contract, 'list_settable_by_member', 0, accounts[0], storeInDfs, encryptHashes)).to.eq(sampleValues[1]);
        });
        it('allows to move an entry from one list to multiple lists', async () => {});
      });
    });
    describe('when working with mappings', async() => {
      // key types are basically irrelevant, will be hashed anyway
      const sampleMappingKeys = [...accounts];
      describe('that can only be set by the owner', async () => {
        it('allows the owner to add and get entries', async () => {
          const contract = await createContract(storeInDfs);
          await dc.setMappingValue(contract, 'mapping_settable_by_owner', sampleMappingKeys[0], sampleValues[0], accounts[0], storeInDfs, encryptHashes);
          await dc.setMappingValue(contract, 'mapping_settable_by_owner', sampleMappingKeys[1], sampleValues[1], accounts[0], storeInDfs, encryptHashes);
          await dc.setMappingValue(contract, 'mapping_settable_by_owner', sampleMappingKeys[2], sampleValues[2], accounts[0], storeInDfs, encryptHashes);
          expect(await dc.getMappingValue(contract, 'mapping_settable_by_owner', sampleMappingKeys[0], accounts[0], storeInDfs, encryptHashes)).to.eq(sampleValues[0]);
          expect(await dc.getMappingValue(contract, 'mapping_settable_by_owner', sampleMappingKeys[1], accounts[0], storeInDfs, encryptHashes)).to.eq(sampleValues[1]);
          expect(await dc.getMappingValue(contract, 'mapping_settable_by_owner', sampleMappingKeys[2], accounts[0], storeInDfs, encryptHashes)).to.eq(sampleValues[2]);
        });
        it('does not allow the member to add and get entries', async () => {
          const contract = await createContract(storeInDfs);
          const promise = dc.setMappingValue(contract, 'mapping_settable_by_owner', sampleMappingKeys[0], sampleValues[0], accounts[1], storeInDfs, encryptHashes);
          await expect(promise).to.be.rejected;
        });
      });
      describe('that can be set by owner and member', async () => {
        it('allows the owner to add and get entries', async () => {
          const contract = await createContract(storeInDfs);
          await dc.setMappingValue(contract, 'mapping_settable_by_member', sampleMappingKeys[0], sampleValues[0], accounts[0], storeInDfs, encryptHashes);
          await dc.setMappingValue(contract, 'mapping_settable_by_member', sampleMappingKeys[1], sampleValues[1], accounts[0], storeInDfs, encryptHashes);
          await dc.setMappingValue(contract, 'mapping_settable_by_member', sampleMappingKeys[2], sampleValues[2], accounts[0], storeInDfs, encryptHashes);
          expect(await dc.getMappingValue(contract, 'mapping_settable_by_member', sampleMappingKeys[0], accounts[0], storeInDfs, encryptHashes)).to.eq(sampleValues[0]);
          expect(await dc.getMappingValue(contract, 'mapping_settable_by_member', sampleMappingKeys[1], accounts[0], storeInDfs, encryptHashes)).to.eq(sampleValues[1]);
          expect(await dc.getMappingValue(contract, 'mapping_settable_by_member', sampleMappingKeys[2], accounts[0], storeInDfs, encryptHashes)).to.eq(sampleValues[2]);
        });
        it('allows the member to add and get entries', async () => {
          const contract = await createContract(storeInDfs);
          await dc.setMappingValue(contract, 'mapping_settable_by_member', sampleMappingKeys[0], sampleValues[0], accounts[1], storeInDfs, encryptHashes);
          await dc.setMappingValue(contract, 'mapping_settable_by_member', sampleMappingKeys[1], sampleValues[1], accounts[1], storeInDfs, encryptHashes);
          await dc.setMappingValue(contract, 'mapping_settable_by_member', sampleMappingKeys[2], sampleValues[2], accounts[1], storeInDfs, encryptHashes);
          expect(await dc.getMappingValue(contract, 'mapping_settable_by_member', sampleMappingKeys[0], accounts[1], storeInDfs, encryptHashes)).to.eq(sampleValues[0]);
          expect(await dc.getMappingValue(contract, 'mapping_settable_by_member', sampleMappingKeys[1], accounts[1], storeInDfs, encryptHashes)).to.eq(sampleValues[1]);
          expect(await dc.getMappingValue(contract, 'mapping_settable_by_member', sampleMappingKeys[2], accounts[1], storeInDfs, encryptHashes)).to.eq(sampleValues[2]);
        });
      });
    });
  }

  it('can be created', async () => {
    const contract = await createContract();
    expect(contract).to.be.ok;
  });
  describe('when working encrypted DFS files', async () => {
    runTestSubset(false);
    it('allows the item creator to decrypt values', async () => {
      const contract = await createContract(true);
      await dc.setEntry(contract, 'entry_settable_by_owner', sampleValues[0], accounts[0]);
      const retrieved = await dc.getEntry(contract, 'entry_settable_by_owner', accounts[0]);
      expect(retrieved).to.eq(sampleValues[0]);
    });
    it('allows an invited user to decrypt values', async () => {
      const contract = await createContract(true);
      await dc.setEntry(contract, 'entry_settable_by_owner', sampleValues[0], accounts[0]);
      const retrieved = await dc.getEntry(contract, 'entry_settable_by_owner', accounts[1]);
      expect(retrieved).to.eq(sampleValues[0]);
    });
    it('does not allow an uninvited user to decrypt values', async () => {
      const contract = await createContract(true);
      await dc.setEntry(contract, 'entry_settable_by_owner', sampleValues[0], accounts[0]);
      const promise = dc.getEntry(contract, 'entry_settable_by_owner', accounts[2]);
      await expect(promise).to.be.rejected;
    });
  });
  describe('when working with raw values', async () => {
    runTestSubset(true);
  });
  describe('when changing the contract state', async () => {
    it('allows to change the state with a configured transition', async () => {
      const contract = await createContract(true);
      // contract is created and then set to Draft during creation logic,
      // and updating from Draf to to PendingApproval is allowed
      await dc.changeContractState(contract, accounts[0], ContractState.PendingApproval);
    });
    it('does not allow to change the state with not a configured transition', async () => {
      const contract = await createContract(true);
      const promise = dc.changeContractState(contract, accounts[0], ContractState.Approved);
      await expect(promise).to.be.rejected;
    });
    it('does not allow to change the state with a user without contract state update permission', async () => {
      const contract = await createContract(true);
      const promise = dc.changeContractState(contract, accounts[1], ContractState.PendingApproval);
      await expect(promise).to.be.rejected;
    });
  });
  describe('when changing own member state', async () => {
    it('allows to change the member state with a configured transition', async () => {
      const contract = await createContract(true);
      // owners current state is 'Draft', so going to 'Active' is allowed
      await dc.changeConsumerState(contract, accounts[0], accounts[0], ConsumerState.Active);
    });
    it('does not allow to change the member state with not a configured transition', async () => {
      const contract = await createContract(true);
      // owners current state is 'Draft', so going to 'Terminated' is not allowed
      const promise = dc.changeConsumerState(contract, accounts[0], accounts[0], ConsumerState.Terminated);
      await expect(promise).to.be.rejected;
    });
  });
  describe('when changing other members states', async () => {
    it('allows to change the member state with a configured transition', async () => {
      const contract = await createContract(true);
      // members current state is 'Draft', owner can set its state to 'Terminated'
      await dc.changeConsumerState(contract, accounts[0], accounts[1], ConsumerState.Terminated);
    });
    it('does not allow to change the member state with not a configured transition', async () => {
      const contract = await createContract(true);
      // members current state is 'Draft', owner can set its state 'Active'
      const promise = dc.changeConsumerState(contract, accounts[0], accounts[1], ConsumerState.Active);
      await expect(promise).to.be.rejected;
    });
  });
});
