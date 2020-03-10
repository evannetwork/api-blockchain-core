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
  ContractLoader,
  Executor,
  KeyProvider,
  NameResolver,
} from '@evan.network/dbcp';

import { accounts, useIdentity } from './test/accounts';
import { Aes } from './encryption/aes';
import { configTestcore as config } from './config-testcore';
import { CryptoProvider } from './encryption/crypto-provider';
import { DataContract } from './contracts/data-contract/data-contract';
import { Description } from './shared-description';
import { TestUtils } from './test/test-utils';
import { Runtime } from './runtime';


use(chaiAsPromised);

const testAddressPrefix = 'testDapp';
const sampleDescription = {
  name: 'test description',
  description: 'description used in tests.',
  author: 'description test user',
  version: '0.0.1',
  dbcpVersion: 1,
  dapp: {
    dependencies: {
      'angular-bc': '^1.0.0',
      'angular-core': '^1.0.0',
      'angular-libs': '^1.0.0',
    },
    entrypoint: 'task.js',
    files: [
      'task.js',
      'task.css',
    ],
    origin: 'Qm...',
    primaryColor: '#e87e23',
    secondaryColor: '#fffaf5',
    standalone: true,
    type: 'dapp',
  },
};
const sampleKey = '346c22768f84f3050f5c94cec98349b3c5cbfa0b7315304e13647a49181fd1ef';
let businessCenterDomain;
let dc: DataContract;
let identity0: string;
let identity1: string;
let runtimes: Runtime[];
let contractLoader: ContractLoader;
let description: Description;
let executor: Executor;
let nameResolver: NameResolver;
let testAddressFoo: string;

describe('Description handler', function test() {
  this.timeout(300000);

  before(async () => {
    runtimes = await Promise.all(
      accounts.slice(0, 2).map(
        (account) => TestUtils.getRuntime(account, null, { useIdentity }),
      ),
    );
    [{
      activeIdentity: identity0,
      description,
      executor,
      nameResolver,
      contractLoader,
      dataContract: dc,
    }, {
      activeIdentity: identity1,
    }] = runtimes;
    businessCenterDomain = nameResolver.getDomainName(
      config.nameResolver.domains.businessCenter,
    );
    const businessCenterAddress = await nameResolver.getAddress(businessCenterDomain);
    const businessCenter = await contractLoader.loadContract('BusinessCenter', businessCenterAddress);
    if (!await executor.executeContractCall(businessCenter, 'isMember', identity0, { from: identity0 })) {
      await executor.executeContractTransaction(businessCenter, 'join', { from: identity0, autoGas: 1.1 });
    }

    testAddressFoo = `${testAddressPrefix}.${nameResolver.getDomainName(config.nameResolver.domains.root)}`;
  });

  describe('when validing used description', () => {
    it('should allow valid description', async () => {
      const contract = await executor.createContract('Described', [], { from: identity0, gas: 1000000 });
      const descriptionEnvelope = { public: { ...sampleDescription } };
      await description.setDescriptionToContract(
        contract.options.address, descriptionEnvelope, identity0,
      );
    });

    it('should reject invalid description', async () => {
      const contract = await executor.createContract('Described', [], { from: identity0, gas: 1000000 });
      let descriptionEnvelope;
      let promise;

      // missing property
      descriptionEnvelope = { public: { ...sampleDescription } };
      delete descriptionEnvelope.public.version;
      promise = description.setDescriptionToContract(
        contract.options.address, descriptionEnvelope, identity0,
      );
      await expect(promise).to.be.rejected;

      // additional property
      descriptionEnvelope = { public: { ...sampleDescription } };
      descriptionEnvelope.public.newPropery = 123;
      promise = description.setDescriptionToContract(
        contract.options.address, descriptionEnvelope, identity0,
      );
      await expect(promise).to.be.rejected;

      // wrong type
      descriptionEnvelope = { public: { ...sampleDescription } };
      descriptionEnvelope.public.version = 123;
      promise = description.setDescriptionToContract(
        contract.options.address, descriptionEnvelope, identity0,
      );
      await expect(promise).to.be.rejected;

      // additional sub property
      descriptionEnvelope = { public: { ...sampleDescription } };
      descriptionEnvelope.public.dapp = { ...descriptionEnvelope.public.dapp, newProperty: 123 };
      promise = description.setDescriptionToContract(
        contract.options.address, descriptionEnvelope, identity0,
      );
      await expect(promise).to.be.rejected;
    });
  });

  describe('when working with ENS descriptions', () => {
    it('should be able to set and get unencrypted content for ENS addresses', async () => {
      await runtimes[1].description.setDescriptionToEns(
        testAddressFoo, { public: sampleDescription }, identity1,
      );
      const content = await description.getDescriptionFromEns(testAddressFoo);
      expect(content).to.deep.eq({ public: sampleDescription });
    });

    it('should be able to set and get unencrypted content for ENS addresses including special characters', async () => {
      const sampleDescriptionSpecialCharacters = {
        public: { ...sampleDescription, name: 'Special Characters !"§$%&/()=?ÜÄÖ' },
      };
      await runtimes[1].description.setDescriptionToEns(
        testAddressFoo, sampleDescriptionSpecialCharacters, identity1,
      );
      const content = await description.getDescriptionFromEns(testAddressFoo);
      expect(content).to.deep.eq(sampleDescriptionSpecialCharacters);
    });

    it('should be able to set and get encrypted content for ENS addresses', async () => {
      const keyConfig = {};
      keyConfig[nameResolver.soliditySha3(identity1)] = sampleKey;
      const keyProvider = new KeyProvider({ keys: keyConfig });
      // eslint-disable-next-line no-param-reassign
      (description as any).keyProvider = keyProvider;
      const cryptor = new Aes();
      const cryptoConfig = {};
      const cryptoInfo = cryptor.getCryptoInfo(nameResolver.soliditySha3(identity1));
      // eslint-disable-next-line no-param-reassign
      (cryptoConfig as any).aes = cryptor;
      // eslint-disable-next-line no-param-reassign
      (description as any).cryptoProvider = new CryptoProvider(cryptoConfig);
      const secureDescription = {
        public: sampleDescription,
        private: {
          name: 'real name',
        },
        cryptoInfo,
      };
      await runtimes[1].description.setDescriptionToEns(
        testAddressFoo,
        secureDescription,
        identity1,
      );
      const content = await runtimes[1].description.getDescriptionFromEns(testAddressFoo);
      expect(content).to.deep.eq(secureDescription);
    });
  });

  describe('when working with ENS descriptions', () => {
    it('should be able to set a description on a created contract', async () => {
      const contract = await dc.create('testdatacontract', identity0, businessCenterDomain);
      const keyConfig = {};
      keyConfig[nameResolver.soliditySha3(contract.options.address)] = sampleKey;
      const keyProvider = new KeyProvider(keyConfig);
      (description as any).keyProvider = keyProvider;
      const cryptor = new Aes();
      const cryptoConfig = {};
      const cryptoInfo = cryptor.getCryptoInfo(nameResolver.soliditySha3(contract.options.address));
      (cryptoConfig as any).aes = cryptor;
      (description as any).cryptoProvider = new CryptoProvider(cryptoConfig);
      const envelope = {
        cryptoInfo,
        public: sampleDescription,
        private: {
          name: 'real name',
        },
      };
      await description
        .setDescriptionToContract(contract.options.address, envelope, identity0);
    });

    it('should be able to get a description from a created contract', async () => {
      const contract = await dc.create('testdatacontract', identity0, businessCenterDomain);
      const keyConfig = {};
      keyConfig[nameResolver.soliditySha3(contract.options.address)] = sampleKey;
      const keyProvider = new KeyProvider(keyConfig);
      (description as any).keyProvider = keyProvider;
      const cryptor = new Aes();
      const cryptoConfig = {};
      const cryptoInfo = cryptor.getCryptoInfo(nameResolver.soliditySha3(contract.options.address));
      (cryptoConfig as any).aes = cryptor;
      (description as any).cryptoProvider = new CryptoProvider(cryptoConfig);
      const envelope = {
        cryptoInfo,
        public: sampleDescription,
        private: {
          name: 'real name',
        },
      };
      await description
        .setDescriptionToContract(contract.options.address, envelope, identity0);
      const contractDescription = await description
        .getDescriptionFromContract(contract.options.address, identity0);
      expect(contractDescription).to.deep.eq(envelope);
    });
  });
});
