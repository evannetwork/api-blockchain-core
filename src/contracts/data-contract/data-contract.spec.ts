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
import * as chaiAsPromised from 'chai-as-promised';
import { expect, use } from 'chai';
import {
  Envelope,
} from '@evan.network/dbcp';
import { accounts, useIdentity } from '../../test/accounts';
import { ConsumerState, ContractState } from '../base-contract/base-contract';
import { sampleContext, TestUtils } from '../../test/test-utils';
import { Runtime } from '../../runtime';
import { DataContract } from './data-contract';

use(chaiAsPromised);


describe('DataContract', function test() {
  this.timeout(60000);
  let businessCenterDomain;
  let dataContract: DataContract;
  let identity0: string;
  let identity1: string;
  let runtimes: Runtime[];

  const sampleValues = [
    '0x0000000000000000000000000000000000000000000000000000000000001234',
    '0x0000000000000000000000000000000000000000000000000000000000011234',
    '0x0000000000000000000000000000000000000000000000000000000000021234',
    '0x0000000000000000000000000000000000000000000000000000000000031234',
    '0x0000000000000000000000000000000000000000000000000000000000041234',
    '0x0000000000000000000000000000000000000000000000000000000000051234',
  ];
  const sampleDescription: Envelope = {
    public: {
      name: 'Data Contract Sample',
      description: 'reiterance oxynitrate sat alternize acurative',
      version: '0.1.0',
      author: 'evan GmbH',
    },
  };

  before(async () => {
    runtimes = await Promise.all(
      accounts.slice(0, 2).map((account) => TestUtils.getRuntime(account, null, { useIdentity })),
    );
    identity0 = runtimes[0].activeIdentity;
    identity1 = runtimes[1].activeIdentity;
    sampleDescription.cryptoInfo = runtimes[0].cryptoProvider
      .getCryptorByCryptoAlgo('aes').getCryptoInfo(runtimes[0].nameResolver.soliditySha3(identity0));
    businessCenterDomain = null;
    dataContract = runtimes[0].dataContract;
  });

  async function createContract(addSharing = false, schema?) {
    let description;
    if (schema) {
      description = JSON.parse(JSON.stringify(sampleDescription));
      description.public.dataSchema = schema;
      description.cryptoInfo = runtimes[0].cryptoProvider
        .getCryptorByCryptoAlgo('aes').getCryptoInfo(runtimes[0].nameResolver.soliditySha3(identity0));
    }
    const contract = await dataContract.create(
      'testdatacontract', identity0, businessCenterDomain, description,
    );
    await dataContract.inviteToContract(
      businessCenterDomain, contract.options.address, identity0, identity1,
    );
    if (addSharing) {
      const blockNr = await runtimes[0].web3.eth.getBlockNumber();
      const contentKey = await runtimes[0].sharing.getKey(contract.options.address, identity0, '*', blockNr);
      await runtimes[0].sharing.addSharing(
        contract.options.address, identity0, identity1, '*', blockNr, contentKey,
      );
    }
    return contract;
  }

  async function runTestSubset(useClassicRawMode) {
    const [storeInDfs, encryptHashes] = [...Array(2)].map(() => !useClassicRawMode);
    describe('when working with entries', async () => {
      describe('that can only be set by the owner', async () => {
        it('allows the owner to add and get entries', async () => {
          const contract = await createContract(storeInDfs);
          await dataContract.setEntry(
            contract,
            'entry_settable_by_owner',
            sampleValues[0],
            identity0,
            storeInDfs,
            encryptHashes,
          );
          const retrieved = await dataContract.getEntry(
            contract, 'entry_settable_by_owner', identity0, storeInDfs, encryptHashes,
          );
          expect(retrieved).to.eq(sampleValues[0]);
        });
        it('does not allow the member to add and get entries', async () => {
          const contract = await createContract(storeInDfs);
          const promise = runtimes[1].dataContract.setEntry(
            contract,
            'entry_settable_by_owner',
            sampleValues[0],
            identity1,
            storeInDfs,
            encryptHashes,
          );
          await expect(promise).to.be.rejected;
        });
        it('can retrieve a schema from its description', async () => {
          const contract = await createContract(storeInDfs);
          await dataContract.setEntry(
            contract,
            'entry_settable_by_owner',
            sampleValues[0],
            identity0,
            storeInDfs,
            encryptHashes,
          );
        });
        it('can use different crypto algorithms for encryption', async () => {
          const contract = await createContract(storeInDfs);
          await dataContract.setEntry(
            contract,
            'entry_settable_by_owner',
            sampleValues[0],
            identity0,
            storeInDfs,
            encryptHashes,
          );
          const encryptedHash = await runtimes[0].executor.executeContractCall(
            contract, 'getEntry', runtimes[0].nameResolver.sha3('entry_settable_by_owner'),
          );
          if (!storeInDfs) {
            expect(encryptedHash).to.eq(sampleValues[0]);
          } else {
            const unencryptedHash = await dataContract.decryptHash(
              encryptedHash,
              contract,
              identity0,
            );
            const envelope = JSON.parse((await runtimes[0].dfs.get(unencryptedHash)).toString());
            expect(envelope.cryptoInfo.algorithm).to.eq('aes-256-cbc');
            const data = Buffer.from(envelope.private, 'hex').toString('utf-8');
            expect(data).to.not.eq(sampleValues[0]);
          }

          await dataContract.setEntry(
            contract,
            'entry_settable_by_owner',
            sampleValues[0],
            identity0,
            storeInDfs,
            encryptHashes,
            'aes',
          );
          const hashAes = await runtimes[0].executor.executeContractCall(
            contract, 'getEntry', runtimes[0].nameResolver.sha3('entry_settable_by_owner'),
          );
          if (!storeInDfs) {
            expect(hashAes).to.eq(sampleValues[0]);
          } else {
            const unencryptedHash = await dataContract.decryptHash(
              hashAes,
              contract,
              identity0,
            );
            const envelope = JSON.parse((await runtimes[0].dfs.get(unencryptedHash)).toString());
            expect(envelope.cryptoInfo.algorithm).to.eq('aes-256-cbc');
            const data = Buffer.from(envelope.private, 'hex').toString('utf-8');
            expect(data).to.not.eq(sampleValues[0]);
          }

          await dataContract.setEntry(
            contract,
            'entry_settable_by_owner',
            sampleValues[0],
            identity0,
            storeInDfs,
            encryptHashes,
            'unencrypted',
          );
          const hashRaw = await runtimes[0].executor.executeContractCall(
            contract, 'getEntry', runtimes[0].nameResolver.sha3('entry_settable_by_owner'),
          );
          if (!storeInDfs) {
            expect(hashRaw).to.eq(sampleValues[0]);
          } else {
            const unencryptedHash = await dataContract.decryptHash(
              hashRaw,
              contract,
              identity0,
            );
            const envelope = JSON.parse((await runtimes[0].dfs.get(unencryptedHash)).toString());
            expect(envelope.cryptoInfo.algorithm).to.eq('unencrypted');
            const data = JSON.parse(Buffer.from(envelope.private, 'hex').toString('utf-8'));
            expect(data).to.eq(sampleValues[0]);
          }
        });
        it('allows content to be shared via contexts', async () => {
          // create contract, set value
          const contract = await dataContract.create('testdatacontract', identity0);
          await dataContract.setEntry(
            contract,
            'entry_settable_by_owner',
            sampleValues[0],
            identity0,
            storeInDfs,
            encryptHashes,
          );

          // account 1 is invited, but has no sharing
          await dataContract.inviteToContract(
            null,
            contract.options.address,
            identity0,
            identity1,
          );

          // get key to share
          const blockNr = await runtimes[0].web3.eth.getBlockNumber();
          const contentKey = await runtimes[0].sharing.getKey(
            contract.options.address, identity0, '*', blockNr,
          );

          // add context based sharing key
          await runtimes[0].sharing.addSharing(
            contract.options.address,
            identity0,
            sampleContext,
            '*',
            0,
            contentKey,
            sampleContext,
          );
          const retrieved = await dataContract.getEntry(
            contract, 'entry_settable_by_owner', sampleContext, storeInDfs, encryptHashes,
          );
          expect(retrieved).to.eq(sampleValues[0]);
        });
      });
      describe('that can be set by owner and member', async () => {
        it('allows the owner to add and get entries', async () => {
          const contract = await createContract(storeInDfs);
          await dataContract.setEntry(
            contract,
            'entry_settable_by_member',
            sampleValues[0],
            identity0,
            storeInDfs,
            encryptHashes,
          );
          const retrieved = await dataContract.getEntry(
            contract, 'entry_settable_by_member', identity0, storeInDfs, encryptHashes,
          );
          expect(retrieved).to.eq(sampleValues[0]);
        });
        it('allows the member to add and get entries', async () => {
          const contract = await createContract(storeInDfs);
          await runtimes[1].dataContract.setEntry(
            contract,
            'entry_settable_by_member',
            sampleValues[0],
            identity1,
            storeInDfs,
            encryptHashes,
          );
          const retrieved = await runtimes[1].dataContract.getEntry(
            contract, 'entry_settable_by_member', identity1, storeInDfs, encryptHashes,
          );
          expect(retrieved).to.eq(sampleValues[0]);
        });
      });
    });
    describe('when working with lists', async () => {
      describe('that allows only the owner to add items', async () => {
        it('allows the owner to add and get entries', async () => {
          const contract = await createContract(storeInDfs);
          await dataContract.addListEntries(
            contract,
            'list_settable_by_owner',
            sampleValues,
            identity0,
            storeInDfs,
            encryptHashes,
          );
          const retrieved = await dataContract.getListEntries(
            contract, 'list_settable_by_owner', identity0, storeInDfs, encryptHashes,
          );
          for (let i = 0; i < sampleValues.length; i += 1) {
            expect(retrieved[i]).to.eq(sampleValues[i]);
          }
        });
        it('does not allow the member to add entries', async () => {
          const contract = await createContract(storeInDfs);
          const promise = runtimes[1].dataContract.addListEntries(
            contract,
            'list_settable_by_owner',
            sampleValues,
            identity1,
            storeInDfs,
            encryptHashes,
          );
          await expect(promise).to.be.rejected;
        });
        it('allows to retrieve the items with an item limit', async () => {
          const contract = await createContract(storeInDfs);
          await dataContract.addListEntries(
            contract,
            'list_settable_by_owner',
            sampleValues,
            identity0,
            storeInDfs,
            encryptHashes,
          );
          const retrieved = await dataContract.getListEntries(
            contract,
            'list_settable_by_owner',
            identity0,
            storeInDfs,
            encryptHashes,
            2,
          );
          expect(retrieved.length).to.eq(2);
          for (let i = 0; i < 2; i += 1) {
            expect(retrieved[i]).to.eq(sampleValues[i]);
          }
        });
        it('allows to retrieve the items with an offset', async () => {
          const contract = await createContract(storeInDfs);
          await dataContract.addListEntries(
            contract,
            'list_settable_by_owner',
            sampleValues,
            identity0,
            storeInDfs,
            encryptHashes,
          );
          const retrieved = await dataContract.getListEntries(
            contract, 'list_settable_by_owner', identity0, storeInDfs, encryptHashes, 10, 2,
          );
          expect(retrieved.length).to.eq(sampleValues.length - 2);
          for (let i = 0; i < retrieved.length; i += 1) {
            expect(retrieved[i]).to.eq(sampleValues[i + 2]);
          }
        });
        it('allows to retrieve the items in reverse order', async () => {
          const contract = await createContract(storeInDfs);
          await dataContract.addListEntries(
            contract,
            'list_settable_by_owner',
            sampleValues,
            identity0,
            storeInDfs,
            encryptHashes,
          );
          const retrieved = await dataContract.getListEntries(
            contract,
            'list_settable_by_owner',
            identity0,
            storeInDfs,
            encryptHashes,
            10,
            0,
            true,
          );
          const reverseSamples = sampleValues.reverse();
          for (let i = 0; i < retrieved.length; i += 1) {
            expect(retrieved[i]).to.eq(reverseSamples[i]);
          }
        });
        it('allows to retrieve the items with a combination of paging arguments', async () => {
          const contract = await createContract(storeInDfs);
          await dataContract.addListEntries(
            contract,
            'list_settable_by_owner',
            sampleValues,
            identity0,
            storeInDfs,
            encryptHashes,
          );
          const retrieved = await dataContract.getListEntries(
            contract,
            'list_settable_by_owner',
            identity0,
            storeInDfs,
            encryptHashes,
            2,
            1,
            true,
          );
          const reverseSamples = sampleValues.reverse();
          for (let i = 0; i < 2; i += 1) {
            expect(retrieved[i]).to.eq(reverseSamples[i + 1]);
          }
        });
      });
      describe('that allows owner and member to add items', async () => {
        it('allows the owner to add and get entries', async () => {
          const contract = await createContract(storeInDfs);
          await dataContract.addListEntries(
            contract,
            'list_settable_by_member',
            sampleValues,
            identity0,
            storeInDfs,
            encryptHashes,
          );
          const retrieved = await dataContract.getListEntries(
            contract,
            'list_settable_by_member',
            identity0,
            storeInDfs,
            encryptHashes,
          );
          for (let i = 0; i < sampleValues.length; i += 1) {
            expect(retrieved[i]).to.eq(sampleValues[i]);
          }
        });
        it('does allow the member to add entries', async () => {
          const contract = await createContract(storeInDfs);
          await runtimes[1].dataContract.addListEntries(
            contract,
            'list_settable_by_member',
            sampleValues,
            identity1,
            storeInDfs,
            encryptHashes,
          );
          const retrieved = await dataContract.getListEntries(
            contract,
            'list_settable_by_member',
            identity0,
            storeInDfs,
            encryptHashes,
          );
          for (let i = 0; i < sampleValues.length; i += 1) {
            expect(retrieved[i]).to.eq(sampleValues[i]);
          }
        });
      });
      describe('allows the owner to remove list entries', async () => {
        it('allows the owner to remove list entries', async () => {
          const contract = await createContract(storeInDfs);
          await dataContract.addListEntries(
            contract,
            'list_removable_by_owner',
            sampleValues,
            identity0,
            storeInDfs,
            encryptHashes,
          );
          let retrieved = await dataContract.getListEntries(
            contract, 'list_removable_by_owner', identity0, storeInDfs, encryptHashes,
          );
          for (let i = 0; i < sampleValues.length; i += 1) {
            expect(retrieved[i]).to.eq(sampleValues[i]);
          }
          await dataContract.removeListEntry(contract, 'list_removable_by_owner', 2, identity0);
          retrieved = await dataContract.getListEntries(
            contract, 'list_removable_by_owner', identity0, storeInDfs, encryptHashes,
          );
          // handle array values like the datacontract
          const modifiedSampleValues = sampleValues.slice(0);
          modifiedSampleValues[2] = modifiedSampleValues[modifiedSampleValues.length - 1];
          for (let i = 0; i < (modifiedSampleValues.length - 1); i += 1) {
            expect(retrieved[i]).to.eq(modifiedSampleValues[i]);
          }
        });
        it('does not allow the member to remove list entries', async () => {
          const contract = await createContract(storeInDfs);
          await dataContract.addListEntries(
            contract,
            'list_removable_by_owner',
            sampleValues,
            identity0,
            storeInDfs,
            encryptHashes,
          );
          const retrieved = await dataContract.getListEntries(
            contract, 'list_removable_by_owner', identity0, storeInDfs, encryptHashes,
          );
          for (let i = 0; i < sampleValues.length; i += 1) {
            expect(retrieved[i]).to.eq(sampleValues[i]);
          }
          const promise = dataContract.removeListEntry(contract, 'list_removable_by_owner', 2, identity1);
          await expect(promise).to.be.rejected;
        });
      });
      describe('when working with descriptions', async () => {
        const testSchema = {
          list_settable_by_member: {
            $id: 'list_settable_by_member_schema',
            type: 'object',
            additionalProperties: false,
            properties: {
              foo: { type: 'string' },
              bar: { type: 'integer' },
            },
          },
          entry_settable_by_member: {
            $id: 'entry_settable_by_member_schema',
            type: 'integer',
          },
        };
        it('allows adding entries matching the field schema', async () => {
          const contract = await createContract(!storeInDfs, testSchema);
          const values = [!storeInDfs ? sampleValues[0] : {
            foo: 'sample',
            bar: 123,
          }];
          const promise = dataContract.addListEntries(
            contract, 'list_settable_by_member', values, identity0, storeInDfs, encryptHashes,
          );
          await expect(promise).to.be.fulfilled;
        });
        it('forbids adding entries not matching the field schema', async () => {
          const contract = await createContract(!storeInDfs, testSchema);
          const values = [!storeInDfs ? sampleValues[0] : {
            foo: 'sample',
            bar: 'totally not a number',
            barz: 123,
          }];
          const promise = dataContract.addListEntries(
            contract, 'list_settable_by_member', values, identity0, storeInDfs, encryptHashes,
          );
          if (!storeInDfs) {
            await expect(promise).to.be.fulfilled;
          } else {
            await expect(promise).to.be.rejected;
          }
        });
        it('forbids adding entries not matching their type', async () => {
          const contract = await createContract(!storeInDfs, testSchema);
          const values = [!storeInDfs ? sampleValues[0] : {
            foo: 'sample',
            bar: '123',
          }];
          const promise = dataContract.addListEntries(
            contract, 'list_settable_by_member', values, identity0, storeInDfs, encryptHashes,
          );
          if (!storeInDfs) {
            await expect(promise).to.be.fulfilled;
          } else {
            await expect(promise).to.be.rejected;
          }
        });
        it('forbids adding entries with more properties than defined', async () => {
          const contract = await createContract(!storeInDfs, testSchema);
          const values = [!storeInDfs ? sampleValues[0] : {
            foo: 'sample',
            bar: 123,
            barz: 123,
          }];
          const promise = dataContract.addListEntries(
            contract, 'list_settable_by_member', values, identity0, storeInDfs, encryptHashes,
          );
          if (!storeInDfs) {
            await expect(promise).to.be.fulfilled;
          } else {
            await expect(promise).to.be.rejected;
          }
        });
        it('fallbacks to accept any if no schema was found', async () => {
          const contract = await createContract(storeInDfs);
          const values = [!storeInDfs ? sampleValues[0] : {
            foo: 'sample',
            barz: 123,
          }];
          const promise = dataContract.addListEntries(
            contract, 'list_settable_by_member', values, identity0, storeInDfs, encryptHashes,
          );
          await expect(promise).to.be.fulfilled;
        });
        it('allows setting entries matching the field schema', async () => {
          const contract = await createContract(!storeInDfs, testSchema);
          const value = !storeInDfs ? sampleValues[0] : 123;
          const promise = dataContract.setEntry(
            contract, 'entry_settable_by_member', value, identity0, storeInDfs, encryptHashes,
          );
          await expect(promise).to.be.fulfilled;
        });
        it('forbids setting entries not matching the field schema', async () => {
          const contract = await createContract(!storeInDfs, testSchema);
          const value = !storeInDfs ? sampleValues[0] : 'totally not an integer';
          const promise = dataContract.setEntry(
            contract, 'entry_settable_by_member', value, identity0, storeInDfs, encryptHashes,
          );
          if (!storeInDfs) {
            await expect(promise).to.be.fulfilled;
          } else {
            await expect(promise).to.be.rejected;
          }
        });

        it('allows specifying item based schemata', async () => {
          const contract = await createContract(!storeInDfs, testSchema);
          const values = [!storeInDfs ? sampleValues[0] : {
            foo: 'sample',
            bar: 123,
          }];
          const promise = dataContract.addListEntries(
            contract, 'list_settable_by_member', values, identity0, storeInDfs, encryptHashes,
          );
          await expect(promise).to.be.fulfilled;
        });
        it('allows specifying list based schemata', async () => {
          const customSchema = JSON.parse(JSON.stringify(testSchema));
          customSchema.list_settable_by_member = {
            $id: 'list_settable_by_member_schema',
            $comment: '{"entryType": "list"}',
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                foo: { type: 'string' },
                bar: { type: 'integer' },
              },
            },
          };
          const contract = await createContract(!storeInDfs, customSchema);
          const values = [!storeInDfs ? sampleValues[0] : {
            foo: 'sample',
            bar: 123,
          }];
          const promise = dataContract.addListEntries(
            contract, 'list_settable_by_member', values, identity0, storeInDfs, encryptHashes,
          );
          await expect(promise).to.be.fulfilled;
        });
      });
      describe('when working with multiple lists at a time', async () => {
        it('allows to add entries to multiple lists', async () => {
          const contract = await createContract(storeInDfs);
          await dataContract.addListEntries(
            contract,
            ['list_settable_by_owner', 'list_settable_by_member'],
            sampleValues,
            identity0,
            storeInDfs,
            encryptHashes,
          );
          let retrieved = await dataContract.getListEntries(
            contract, 'list_settable_by_owner', identity0, storeInDfs, encryptHashes,
          );
          for (let i = 0; i < sampleValues.length; i += 1) {
            expect(retrieved[i]).to.eq(sampleValues[i]);
          }
          retrieved = await dataContract.getListEntries(
            contract, 'list_settable_by_member', identity0, storeInDfs, encryptHashes,
          );
          for (let i = 0; i < sampleValues.length; i += 1) {
            expect(retrieved[i]).to.eq(sampleValues[i]);
          }
        });
        it('does not allow the member to add entries in all lists '
          + 'if not permitted to access one of them',
        async () => {
          const contract = await createContract(storeInDfs);
          const promise = dataContract.addListEntries(
            contract,
            ['list_settable_by_owner', 'list_settable_by_member'],
            sampleValues,
            identity1,
            storeInDfs,
            encryptHashes,
          );
          await expect(promise).to.be.rejected;
        });
        it('allows to move an entry from one list to another', async () => {
          const contract = await createContract(storeInDfs);
          await dataContract.addListEntries(
            contract,
            ['list_removable_by_owner'],
            sampleValues, identity0,
            storeInDfs,
            encryptHashes,
          );
          expect(await dataContract.getListEntryCount(
            contract, 'list_removable_by_owner',
          )).to.eq(sampleValues.length);
          expect(await dataContract.getListEntryCount(contract, 'list_settable_by_member')).to.eq(0);
          expect(await dataContract.getListEntry(
            contract,
            'list_removable_by_owner',
            1,
            identity0,
            storeInDfs,
            encryptHashes,
          )).to.eq(sampleValues[1]);
          // move item
          await dataContract.moveListEntry(
            contract, 'list_removable_by_owner', 1, ['list_settable_by_member'], identity0,
          );
          expect(await dataContract.getListEntryCount(contract, 'list_removable_by_owner'))
            .to.eq(sampleValues.length - 1);
          expect(await dataContract.getListEntryCount(contract, 'list_settable_by_member')).to.eq(1);
          // former last elements should have been moved to removed position
          expect(await dataContract.getListEntry(
            contract,
            'list_removable_by_owner',
            1,
            identity0,
            storeInDfs,
            encryptHashes,
          )).to.eq(sampleValues[sampleValues.length - 1]);
          // new entry should have been added
          expect(await dataContract.getListEntry(
            contract,
            'list_settable_by_member',
            0,
            identity0,
            storeInDfs,
            encryptHashes,
          )).to.eq(sampleValues[1]);
        });
      });
    });
    describe('when working with mappings', async () => {
      // key types are basically irrelevant, will be hashed anyway
      const sampleMappingKeys = [...accounts];
      describe('that can only be set by the owner', async () => {
        it('allows the owner to add and get entries', async () => {
          const contract = await createContract(storeInDfs);
          await dataContract.setMappingValue(
            contract,
            'mapping_settable_by_owner',
            sampleMappingKeys[0],
            sampleValues[0],
            identity0,
            storeInDfs,
            encryptHashes,
          );
          await dataContract.setMappingValue(
            contract,
            'mapping_settable_by_owner',
            sampleMappingKeys[1],
            sampleValues[1],
            identity0,
            storeInDfs,
            encryptHashes,
          );
          await dataContract.setMappingValue(
            contract,
            'mapping_settable_by_owner',
            sampleMappingKeys[2],
            sampleValues[2],
            identity0,
            storeInDfs,
            encryptHashes,
          );
          expect(await dataContract.getMappingValue(
            contract,
            'mapping_settable_by_owner',
            sampleMappingKeys[0],
            identity0,
            storeInDfs,
            encryptHashes,
          )).to.eq(sampleValues[0]);
          expect(await dataContract.getMappingValue(
            contract,
            'mapping_settable_by_owner',
            sampleMappingKeys[1],
            identity0,
            storeInDfs,
            encryptHashes,
          )).to.eq(sampleValues[1]);
          expect(await dataContract.getMappingValue(
            contract,
            'mapping_settable_by_owner',
            sampleMappingKeys[2],
            identity0,
            storeInDfs,
            encryptHashes,
          )).to.eq(sampleValues[2]);
        });
        it('does not allow the member to add and get entries', async () => {
          const contract = await createContract(storeInDfs);
          const promise = runtimes[1].dataContract.setMappingValue(
            contract,
            'mapping_settable_by_owner',
            sampleMappingKeys[0],
            sampleValues[0],
            identity1,
            storeInDfs,
            encryptHashes,
          );
          await expect(promise).to.be.rejected;
        });
      });
      describe('that can be set by owner and member', async () => {
        it('allows the owner to add and get entries', async () => {
          const contract = await createContract(storeInDfs);
          await dataContract.setMappingValue(
            contract,
            'mapping_settable_by_member',
            sampleMappingKeys[0],
            sampleValues[0],
            identity0,
            storeInDfs,
            encryptHashes,
          );
          await dataContract.setMappingValue(
            contract,
            'mapping_settable_by_member',
            sampleMappingKeys[1],
            sampleValues[1],
            identity0,
            storeInDfs,
            encryptHashes,
          );
          await dataContract.setMappingValue(
            contract,
            'mapping_settable_by_member',
            sampleMappingKeys[2],
            sampleValues[2],
            identity0,
            storeInDfs,
            encryptHashes,
          );
          expect(await dataContract.getMappingValue(
            contract,
            'mapping_settable_by_member',
            sampleMappingKeys[0],
            identity0,
            storeInDfs,
            encryptHashes,
          )).to.eq(sampleValues[0]);
          expect(await dataContract.getMappingValue(
            contract,
            'mapping_settable_by_member',
            sampleMappingKeys[1],
            identity0,
            storeInDfs,
            encryptHashes,
          )).to.eq(sampleValues[1]);
          expect(await dataContract.getMappingValue(
            contract,
            'mapping_settable_by_member',
            sampleMappingKeys[2],
            identity0,
            storeInDfs,
            encryptHashes,
          )).to.eq(sampleValues[2]);
        });
        it('allows the member to add and get entries', async () => {
          const contract = await createContract(storeInDfs);
          await runtimes[1].dataContract.setMappingValue(
            contract,
            'mapping_settable_by_member',
            sampleMappingKeys[0],
            sampleValues[0],
            identity1,
            storeInDfs,
            encryptHashes,
          );
          await runtimes[1].dataContract.setMappingValue(
            contract,
            'mapping_settable_by_member',
            sampleMappingKeys[1],
            sampleValues[1],
            identity1,
            storeInDfs,
            encryptHashes,
          );
          await runtimes[1].dataContract.setMappingValue(
            contract,
            'mapping_settable_by_member',
            sampleMappingKeys[2],
            sampleValues[2],
            identity1,
            storeInDfs,
            encryptHashes,
          );
          expect(await runtimes[1].dataContract.getMappingValue(
            contract,
            'mapping_settable_by_member',
            sampleMappingKeys[0],
            identity1,
            storeInDfs,
            encryptHashes,
          )).to.eq(sampleValues[0]);
          expect(await runtimes[1].dataContract.getMappingValue(
            contract,
            'mapping_settable_by_member',
            sampleMappingKeys[1],
            identity1,
            storeInDfs,
            encryptHashes,
          )).to.eq(sampleValues[1]);
          expect(await runtimes[1].dataContract.getMappingValue(
            contract,
            'mapping_settable_by_member',
            sampleMappingKeys[2],
            identity1,
            storeInDfs,
            encryptHashes,
          )).to.eq(sampleValues[2]);
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
      await dataContract.setEntry(contract, 'entry_settable_by_owner', sampleValues[0], identity0);
      const retrieved = await dataContract.getEntry(contract, 'entry_settable_by_owner', identity0);
      expect(retrieved).to.eq(sampleValues[0]);
    });
    it('allows an invited user to decrypt values', async () => {
      const contract = await createContract(true);
      await dataContract.setEntry(contract, 'entry_settable_by_owner', sampleValues[0], identity0);
      const retrieved = await dataContract.getEntry(contract, 'entry_settable_by_owner', identity1);
      expect(retrieved).to.eq(sampleValues[0]);
    });
    it('does not allow an uninvited user to decrypt values', async () => {
      const contract = await createContract(true);
      await dataContract.setEntry(contract, 'entry_settable_by_owner', sampleValues[0], identity0);
      const promise = dataContract.getEntry(contract, 'entry_settable_by_owner', accounts[2]);
      await expect(promise).to.be.rejected;
    });
  });
  describe('when working with raw values', async () => {
    runTestSubset(true);
    it('can store dfs data unencrypted and another account can read this unencrypted data', async () => {
      const contract = await dataContract.create('testdatacontract', identity0, businessCenterDomain);
      await dataContract.inviteToContract(
        businessCenterDomain, contract.options.address, identity0, identity1,
      );
      await dataContract.setEntry(
        contract,
        'entry_settable_by_owner',
        sampleValues[0],
        identity0,
        true,
        false,
        'unencrypted',
      );
      dataContract.clearSharingCache();
      await expect(dataContract.getEntry(
        contract,
        'entry_settable_by_owner',
        identity1,
        true,
        false,
      )).to.eventually.eq(sampleValues[0]);
    });
    it('can invite accounts and let them write data to a contract without sharing keys', async () => {
      const contract = await dataContract.create('testdatacontract', identity0, businessCenterDomain);
      await dataContract.inviteToContract(
        businessCenterDomain, contract.options.address, identity0, identity1,
      );
      await TestUtils.nextBlock(runtimes[0].executor, identity0);
      dataContract.clearSharingCache();

      await expect(runtimes[1].dataContract.setEntry(
        contract,
        'entry_settable_by_member',
        sampleValues[0],
        identity1,
        true,
        false,
        'unencrypted',
      )).not.to.be.rejected;
      await expect(dataContract.getEntry(
        contract,
        'entry_settable_by_member',
        identity0,
        true,
        false,
      )).to.eventually.eq(sampleValues[0]);
    });
  });
  describe('when changing the contract state', async () => {
    it('allows to change the state with a configured transition', async () => {
      const contract = await createContract(true);
      // contract is created and then set to Draft during creation logic,
      // and updating from Draf to to PendingApproval is allowed
      await dataContract.changeContractState(
        contract,
        identity0,
        ContractState.PendingApproval,
      );
    });
    it('does not allow to change the state with not a configured transition', async () => {
      const contract = await createContract(true);
      const promise = dataContract.changeContractState(
        contract,
        identity0,
        ContractState.Approved,
      );
      await expect(promise).to.be.rejected;
    });
    it('does not allow to change the state '
      + 'with a user without contract state update permission',
    async () => {
      const contract = await createContract(true);
      const promise = dataContract.changeContractState(
        contract,
        identity1,
        ContractState.PendingApproval,
      );
      await expect(promise).to.be.rejected;
    });
  });
  describe('when changing own member state', async () => {
    it('allows to change the member state with a configured transition', async () => {
      const contract = await createContract(true);
      // owners current state is 'Draft', so going to 'Active' is allowed
      await dataContract.changeConsumerState(
        contract,
        identity0,
        identity0,
        ConsumerState.Active,
      );
    });
    it('does not allow to change the member state with not a configured transition', async () => {
      const contract = await createContract(true);
      // owners current state is 'Draft', so going to 'Terminated' is not allowed
      const promise = dataContract.changeConsumerState(
        contract, identity0, identity0, ConsumerState.Terminated,
      );
      await expect(promise).to.be.rejected;
    });
  });
  describe('when changing other members states', async () => {
    it('allows to change the member state with a configured transition', async () => {
      const contract = await createContract(true);
      // members current state is 'Draft', owner can set its state to 'Terminated'
      await dataContract.changeConsumerState(
        contract,
        identity0,
        identity1,
        ConsumerState.Terminated,
      );
    });
    it('does not allow to change the member state with not a configured transition', async () => {
      const contract = await createContract(true);
      // members current state is 'Draft', owner can set its state 'Active'
      const promise = dataContract.changeConsumerState(
        contract, identity0, identity1, ConsumerState.Active,
      );
      await expect(promise).to.be.rejected;
    });
  });
});
