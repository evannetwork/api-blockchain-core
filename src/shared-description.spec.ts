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
import { expect, use, } from 'chai';
import chaiAsPromised = require('chai-as-promised');

import {
  ContractLoader,
  Envelope,
  Executor,
  Ipfs,
  KeyProvider,
  NameResolver,
  Unencrypted,
} from '@evan.network/dbcp';

import { accounts } from './test/accounts';
import { Aes } from './encryption/aes';
import { BaseContract } from './contracts/base-contract/base-contract';
import { configTestcore as config } from './config-testcore';
import { CryptoProvider } from './encryption/crypto-provider';
import { DataContract } from './contracts/data-contract/data-contract';
import { Description } from './shared-description';
import { Sharing } from './contracts/sharing';
import { TestUtils } from './test/test-utils';


use(chaiAsPromised);

const testAddressPrefix = 'testDapp';
/* tslint:disable:quotemark */
const sampleDescription = {
  "name": "test description",
  "description": "description used in tests.",
  "author": "description test user",
  "version": "0.0.1",
  "dbcpVersion": 1,
  "dapp": {
    "dependencies": {
      "angular-bc": "^1.0.0",
      "angular-core": "^1.0.0",
      "angular-libs": "^1.0.0"
  },
    "entrypoint": "task.js",
    "files": [
      "task.js",
      "task.css"
    ],
    "origin": "Qm...",
    "primaryColor": "#e87e23",
    "secondaryColor": "#fffaf5",
    "standalone": true,
    "type": "dapp"
  },
};
/* tslint:enable:quotemark */
const sampleKey = '346c22768f84f3050f5c94cec98349b3c5cbfa0b7315304e13647a49181fd1ef';
let description: Description;
let testAddressFoo;
let executor: Executor;
let loader: ContractLoader;
let businessCenterDomain;
let web3;
let cryptoProvider: CryptoProvider;
let sharing: Sharing;
let dfs;
let dc: DataContract;
let nameResolver: NameResolver;

describe('Description handler', function() {
  this.timeout(300000);

  before(async () => {
    web3 = TestUtils.getWeb3();
    description = await TestUtils.getDescription(web3);
    nameResolver = await TestUtils.getNameResolver(web3);
    executor = await TestUtils.getExecutor(web3);
    executor.eventHub = await TestUtils.getEventHub(web3);
    loader = await TestUtils.getContractLoader(web3);
    cryptoProvider = await TestUtils.getCryptoProvider();
    dfs = await TestUtils.getIpfs();
    sharing = new Sharing({
      contractLoader: await TestUtils.getContractLoader(web3),
      cryptoProvider,
      description: description,
      executor: await TestUtils.getExecutor(web3),
      dfs,
      keyProvider: TestUtils.getKeyProvider(),
      nameResolver: await TestUtils.getNameResolver(web3),
      defaultCryptoAlgo: 'aes',
    });
    description.sharing = sharing;
    dc = new DataContract({
      cryptoProvider,
      dfs,
      executor,
      loader,
      log: TestUtils.getLogger(),
      nameResolver,
      sharing,
      web3: TestUtils.getWeb3(),
      description,
    });
    businessCenterDomain = nameResolver.getDomainName(config.nameResolver.domains.businessCenter);
    const businessCenterAddress = await nameResolver.getAddress(businessCenterDomain);
    const businessCenter = await loader.loadContract('BusinessCenter', businessCenterAddress);
    if (!await executor.executeContractCall(businessCenter, 'isMember', accounts[0], { from: accounts[0], })) {
      await executor.executeContractTransaction(businessCenter, 'join', { from: accounts[0], autoGas: 1.1, });
    }

    testAddressFoo = `${testAddressPrefix}.${nameResolver.getDomainName(config.nameResolver.domains.root)}`;
  });

  describe('when validing used description', () => {
    it('should allow valid description', async () => {
      const contract = await executor.createContract('Described', [], {from: accounts[0], gas: 1000000, });
      const descriptionEnvelope = { public: Object.assign({}, sampleDescription), };
      await description.setDescriptionToContract(contract.options.address, descriptionEnvelope, accounts[0]);
    });

    it('should reject invalid description', async () => {
      const contract = await executor.createContract('Described', [], {from: accounts[0], gas: 1000000, });
      let descriptionEnvelope;
      let promise;

      // missing property
      descriptionEnvelope = { public: Object.assign({}, sampleDescription), };
      delete descriptionEnvelope.public.version;
      promise = description.setDescriptionToContract(contract.options.address, descriptionEnvelope, accounts[0]);
      await expect(promise).to.be.rejected;

      // additional property
      descriptionEnvelope = { public: Object.assign({}, sampleDescription), };
      descriptionEnvelope.public.newPropery = 123;
      promise = description.setDescriptionToContract(contract.options.address, descriptionEnvelope, accounts[0]);
      await expect(promise).to.be.rejected;

      // wrong type
      descriptionEnvelope = { public: Object.assign({}, sampleDescription), };
      descriptionEnvelope.public.version = 123;
      promise = description.setDescriptionToContract(contract.options.address, descriptionEnvelope, accounts[0]);
      await expect(promise).to.be.rejected;

      // additional sub property
      descriptionEnvelope = { public: Object.assign({}, sampleDescription), };
      descriptionEnvelope.public.dapp = Object.assign({}, descriptionEnvelope.public.dapp, { newProperty: 123, });
      promise = description.setDescriptionToContract(contract.options.address, descriptionEnvelope, accounts[0]);
      await expect(promise).to.be.rejected;
    });
  });

  describe('when working with ENS descriptions', () => {
    it('should be able to set and get unencrypted content for ENS addresses', async () => {
      await description.setDescriptionToEns(testAddressFoo, { public: sampleDescription, }, accounts[1]);
      const content = await description.getDescriptionFromEns(testAddressFoo);
      expect(content).to.deep.eq({ public: sampleDescription, });
    });

    it('should be able to set and get unencrypted content for ENS addresses including special characters', async () => {
      const sampleDescriptionSpecialCharacters = {
        public: Object.assign({}, sampleDescription, { name: 'Special Characters !"§$%&/()=?ÜÄÖ', }),
      };
      await description.setDescriptionToEns(testAddressFoo, sampleDescriptionSpecialCharacters, accounts[1]);
      const content = await description.getDescriptionFromEns(testAddressFoo);
      expect(content).to.deep.eq(sampleDescriptionSpecialCharacters);
    });

    it('should be able to set and get encrypted content for ENS addresses', async () => {
      const keyConfig = {};
      keyConfig[nameResolver.soliditySha3(accounts[1])] = sampleKey;
      const keyProvider = new KeyProvider({keys: keyConfig});
      description.keyProvider = keyProvider;
      const cryptor = new Aes();
      const cryptoConfig = {};
      const cryptoInfo = cryptor.getCryptoInfo(nameResolver.soliditySha3(accounts[1]));
      cryptoConfig['aes'] = cryptor;
      description.cryptoProvider = new CryptoProvider(cryptoConfig);
      const secureDescription = {
        public: sampleDescription,
        private: {
          name: 'real name',
        },
        cryptoInfo,
      };
      await description.setDescriptionToEns(testAddressFoo, secureDescription, accounts[1]);
      const content = await description.getDescriptionFromEns(testAddressFoo);
      expect(content).to.deep.eq(secureDescription);
    });
  });

  describe('when working with ENS descriptions', () => {
    it('should be able to set a description on a created contract', async () => {
      const contract = await dc.create('testdatacontract', accounts[0], businessCenterDomain);
      const keyConfig = {};
      keyConfig[nameResolver.soliditySha3(contract.options.address)] = sampleKey;
      const keyProvider = new KeyProvider(keyConfig);
      description.keyProvider = keyProvider;
      const cryptor = new Aes();
      const cryptoConfig = {};
      const cryptoInfo = cryptor.getCryptoInfo(nameResolver.soliditySha3(contract.options.address));
      cryptoConfig['aes'] = cryptor;
      description.cryptoProvider = new CryptoProvider(cryptoConfig);
      const envelope = {
        cryptoInfo: cryptoInfo,
        public: sampleDescription,
        private: {
          name: 'real name',
        }
      };
      await description
        .setDescriptionToContract(contract.options.address, envelope, accounts[0]);
    });

    it('should be able to get a description from a created contract', async () => {
      const contract = await dc.create('testdatacontract', accounts[0], businessCenterDomain);
      const keyConfig = {};
      keyConfig[nameResolver.soliditySha3(contract.options.address)] = sampleKey;
      const keyProvider = new KeyProvider(keyConfig);
      description.keyProvider = keyProvider;
      const cryptor = new Aes();
      const cryptoConfig = {};
      const cryptoInfo = cryptor.getCryptoInfo(nameResolver.soliditySha3(contract.options.address));
      cryptoConfig['aes'] = cryptor;
      description.cryptoProvider = new CryptoProvider(cryptoConfig);
      const envelope = {
        cryptoInfo: cryptoInfo,
        public: sampleDescription,
        private: {
          name: 'real name',
        }
      };
      await description
        .setDescriptionToContract(contract.options.address, envelope, accounts[0]);
      const contractDescription = await description
        .getDescriptionFromContract(contract.options.address, accounts[0]);
      expect(contractDescription).to.deep.eq(envelope);
    });
  });
});
