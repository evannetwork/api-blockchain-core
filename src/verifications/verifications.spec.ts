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
import chaiAsPromised = require('chai-as-promised');
import { expect, use } from 'chai';
import { BigNumber } from 'bignumber.js';
import { ContractLoader, Executor } from '@evan.network/dbcp';

import { accounts } from '../test/accounts';
import { BaseContract } from '../contracts/base-contract/base-contract';
import { configTestcore as config } from '../config-testcore';
import { Description } from '../shared-description';
import { EncryptionWrapper, EncryptionWrapperCryptorType, EncryptionWrapperKeyType } from '../encryption/encryption-wrapper';
import { TestUtils } from '../test/test-utils';
import {
  Verifications,
  VerificationsQueryOptions,
  VerificationsResultV2,
  VerificationsStatus,
  VerificationsStatusV2,
  VerificationsStatusFlagsV2,
  VerificationsValidationOptions,
} from './verifications';

const linker = require('solc/linker');

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

use(chaiAsPromised);

describe('Verifications handler', function() {
  this.timeout(600000);

  function getRandomTopic(prefix: string) {
    return `${ prefix }/${ Date.now().toString() + Math.random().toString().slice(2, 20) }`;
  }

  const singedByAccounts0 = async (pr: Partial<VerificationsResultV2>) => {
    if (pr.verifications.filter(verification => verification.details.issuer === '0x5035aEe29ea566F3296cdD97C29baB2b88C17c25').length) {
      return VerificationsStatusV2.Green;
    }
    return VerificationsStatusV2.Red;
  };

  const validationOptions: VerificationsValidationOptions = {
    disableSubVerifications: VerificationsStatusV2.Red,
    expired:                 VerificationsStatusV2.Red,
    invalid:                 VerificationsStatusV2.Red,
    issued:                  VerificationsStatusV2.Green,
    missing:                 VerificationsStatusV2.Red,
    noIdentity:              VerificationsStatusV2.Red,
    notEnsRootOwner:         VerificationsStatusV2.Red,
    parentMissing:           VerificationsStatusV2.Yellow,
    parentUntrusted:         singedByAccounts0,
    rejected:                VerificationsStatusV2.Red,
    selfIssued:              VerificationsStatusV2.Red,
  };
  const queryOptions: VerificationsQueryOptions = {
    validationOptions,
  };

  let baseContract: BaseContract;
  let verifications: Verifications;
  let verificationsContracts;
  let contractLoader: ContractLoader;
  let description: Description;
  let dfs: any;
  let encryptionWrapper: EncryptionWrapper;
  let executor: Executor;
  let nameResolver;
  let web3: any;

  before(async () => {
    web3 = TestUtils.getWeb3();
    executor = await TestUtils.getExecutor(web3);
    contractLoader = await TestUtils.getContractLoader(web3);
    dfs = await TestUtils.getIpfs();
    verifications = await TestUtils.getVerifications(web3, dfs);
    nameResolver = await TestUtils.getNameResolver(web3);
    baseContract = await TestUtils.getBaseContract(web3);
    description = await TestUtils.getDescription(web3, dfs);
    encryptionWrapper = await TestUtils.getEncryptionWrapper(web3, dfs);
  });

  it('can deploy a new structure', async () => {
    const libs = {};
    const deploy = async (contractAndPath) => {
      const contractName = /^[^:]*:(.*)$/g.exec(contractAndPath)[1];
      const replace = (target, name, address) => {
        contractLoader.contracts[target].bytecode =
          contractLoader.contracts[target].bytecode.replace(
            new RegExp(contractLoader.contracts[name]
              .deployedAt.slice(2), 'g'), address.slice(2));
      };
      const updateBytecode = (librayName, libraryAddress) => {
        Object.keys(contractLoader.contracts).map((contract) => {
          const before = contractLoader.contracts[contract].bytecode;
          replace(contract, librayName, libraryAddress);
          if (before !== contractLoader.contracts[contract].bytecode) {
            console.log(`updated: ${contract}`)
          }
        });
      };
      libs[contractAndPath] = (await executor.createContract(
        contractName, [], { from: accounts[0], gas: 3000000 })).options.address;
      updateBytecode(contractName, libs[contractAndPath]);
    };

    await deploy('verifications/KeyHolderLibrary.sol:KeyHolderLibrary');
    await deploy('verifications/VerificationHolderLibrary.sol:VerificationHolderLibrary');
    await deploy('verifications/VerificationsRegistryLibrary.sol:VerificationsRegistryLibrary');

    for (let key of Object.keys(libs)) {
      console.log(`${/[^:]:(.*)/g.exec(key)[1]}: ${libs[key].slice(2)}`);
    }
  });

  it('can create identities', async () => {
    await verifications.createIdentity(accounts[0]);
    await verifications.createIdentity(accounts[1]);
  });

  it('can add a verification', async () => {
    const oldLength = (await verifications.getVerifications(accounts[1], '/company')).length;
    await timeout(5000);
    await verifications.setVerification(accounts[0], accounts[1], '/company');
    await timeout(5000);
    const verificationsForAccount = await verifications.getVerifications(accounts[1], '/company');
    expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
    expect(verificationsForAccount[oldLength])
      .to.have.property('status', VerificationsStatus.Issued);
  });

  describe('when using external account based identities', () => {
    it('can add a verification', async () => {
      const oldLength = (await verifications.getVerifications(accounts[1], '/company')).length;
      await timeout(5000);
      const verificationId = await verifications.setVerification(
        accounts[0], accounts[1], '/company');
      await timeout(5000);
      expect(verificationId).to.be.ok;
      const verificationsForAccount = await verifications.getVerifications(accounts[1], '/company');
      expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
      expect(verificationsForAccount[oldLength])
        .to.have.property('status', VerificationsStatus.Issued);
    });

    it('can add a verification with data', async () => {
      const oldLength = (await verifications.getVerifications(accounts[1], '/company')).length;
      await verifications.setVerification(accounts[0], accounts[1], '/company', 0, {foo: 'bar'});
      const verificationsForAccount = await verifications.getVerifications(accounts[1], '/company');
      expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
    });

    it('can add a verification with encrypted data', async () => {
      const unencrypted = {foo: 'bar'};
      const cryptoInfo = await encryptionWrapper.getCryptoInfo('test', EncryptionWrapperKeyType.Custom);
      const key = await encryptionWrapper.generateKey(cryptoInfo);
      const encrypted = await encryptionWrapper.encrypt(unencrypted, cryptoInfo, { key });
      const oldLength = (await verifications.getVerifications(accounts[1], '/company')).length;
      await verifications.setVerification(accounts[0], accounts[1], '/company', 0, encrypted);
      const verificationsForAccount = await verifications.getVerifications(accounts[1], '/company');
      const retrieved = JSON.parse(await dfs.get(verificationsForAccount[oldLength].data));
      const decrypted = await encryptionWrapper.decrypt(retrieved, { key });
      expect(decrypted).to.deep.eq(unencrypted);
    });

    it('can add a verification with specific expirationDate', async () => {
      const oldLength = (await verifications.getVerifications(accounts[1], '/company')).length;
      const now = Math.floor(new Date().getTime() / 1000);
      await timeout(5000);
      await verifications.setVerification(accounts[0], accounts[1], '/company', now);
      await timeout(5000);
      const verificationsForAccount = await verifications.getVerifications(accounts[1], '/company');
      expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
      expect(verificationsForAccount[oldLength]).to.have.property('expirationDate', now.toString());
    });

    it('can add a verification and validate the integrity', async () => {
      const oldLength = (await verifications.getVerifications(accounts[1], '/company')).length;
      await timeout(5000);
      await verifications.setVerification(accounts[0], accounts[1], '/company');
      await timeout(5000);
      const verificationsForAccount = await verifications.getVerifications(accounts[1], '/company');
      expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
      await verifications.validateVerification(accounts[1], verificationsForAccount[oldLength].id);
      expect(verificationsForAccount[oldLength])
        .to.have.property('status', VerificationsStatus.Issued);
    });

    it('can add subverification paths', async () => {
      const oldLength = (await verifications.getVerifications(
        accounts[1], '/company/b-s-s/employee/swo3')).length;
      await verifications.setVerification(accounts[0], accounts[0], '/company');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s/employee');
      await verifications.setVerification(accounts[0], accounts[1], '/company/b-s-s/employee/swo3');
      const verificationsForAccount = await verifications
        .getVerifications(accounts[1], '/company/b-s-s/employee/swo3');
      expect(verificationsForAccount).to.have.lengthOf(1);
      expect(verificationsForAccount[oldLength]).to.have.property(
        'status', VerificationsStatus.Issued);
    });

    it('can confirm a subverification paths with the subject user', async () => {
      const oldLength = (await verifications.getVerifications(
        accounts[1], '/company/b-s-s/employee/swo4')).length;
      await verifications.setVerification(accounts[0], accounts[0], '/company');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s/employee');
      const verificationId = await verifications.setVerification(
        accounts[0], accounts[1], '/company/b-s-s/employee/swo4');
      await verifications.confirmVerification(accounts[1], accounts[1], verificationId);
      const verificationsForAccount = await verifications.getVerifications(
        accounts[1], '/company/b-s-s/employee/swo4');
      expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
      expect(verificationsForAccount[oldLength])
        .to.have.property('status', VerificationsStatus.Confirmed);
    });

    it('can track the creation date', async() => {
      const before = Math.floor(Date.now() / 1000);
      await timeout(5000);
      await verifications.setVerification(accounts[0], accounts[1], '/company');
      await timeout(5000);
      const after = Math.floor(Date.now() / 1000);
      const verificationsForAccount = await verifications.getVerifications(accounts[1], '/company');
      const last = verificationsForAccount.length - 1;
      expect(verificationsForAccount[last]).to.have.property('status', VerificationsStatus.Issued);
      expect(verificationsForAccount[last]).to.have.property('creationDate');
      expect(parseInt(verificationsForAccount[last].creationDate, 10)).to.be.gte(before);
      expect(parseInt(verificationsForAccount[last].creationDate, 10)).to.be.lte(after);
    });

    it('can track the expiration date and the expired flag is set correctly', async() => {
      const before = Math.floor(Date.now() / 1000);
      await verifications.setVerification(accounts[0], accounts[1], '/company', before);
      const after = Math.floor(Date.now() / 1000);
      const verificationsForAccount = await verifications.getVerifications(accounts[1], '/company');
      const last = verificationsForAccount.length - 1;
      expect(verificationsForAccount[last]).to.have.property('status', VerificationsStatus.Issued);
      expect(verificationsForAccount[last]).to.have.property('expirationDate');
      expect(parseInt(verificationsForAccount[last].expirationDate, 10)).to.be.eq(before);
      expect(parseInt(verificationsForAccount[last].expirationDate, 10)).to.be.lte(after);
      expect(verificationsForAccount[last].expired).to.be.eq(true);
    });

    it('can delete a subverification path with the subject user', async () => {
      await verifications.setVerification(accounts[0], accounts[0], '/company');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s/employee');
      await timeout(5000);
      const verificationId = await verifications.setVerification(
        accounts[0], accounts[1], '/company/b-s-s/employee/swo6');
      await timeout(5000);
      await verifications.deleteVerification(accounts[1], accounts[1], verificationId);
      const verificationsForAccount = await verifications.getVerifications(
        accounts[1], '/company/b-s-s/employee/swo6');
      expect(verificationsForAccount).to.have.lengthOf(0);
    });

    it('can track the creation block', async() => {
      const before = await web3.eth.getBlockNumber();
      await verifications.setVerification(accounts[0], accounts[1], '/company');
      const after = await web3.eth.getBlockNumber();
      const verificationsForAccount = await verifications.getVerifications(accounts[1], '/company');
      const last = verificationsForAccount.length - 1;
      expect(verificationsForAccount[last]).to.have.property('status', VerificationsStatus.Issued);
      expect(verificationsForAccount[last]).to.have.property('creationBlock');
      expect(parseInt(verificationsForAccount[last].creationBlock, 10)).to.be.gte(before);
      expect(parseInt(verificationsForAccount[last].creationBlock, 10)).to.be.lte(after);
    });

    it('can add a description to a verification', async() => {
      const sampleVerificationsDomain = 'sample';
      const sampleVerificationTopic = '/company';
      const sampleDescription = {
        name: 'sample verification',
        description: 'I\'m a sample verification',
        author: 'evan.network',
        version: '1.0.0',
        dbcpVersion: 1,
      };
      await verifications.setVerificationDescription(
        accounts[0], sampleVerificationTopic, sampleVerificationsDomain, sampleDescription);
      await verifications.setVerification(
        accounts[0], accounts[1], sampleVerificationTopic, 0, null, sampleVerificationsDomain);
      const verificationsForAccount = await verifications.getVerifications(
        accounts[1], sampleVerificationTopic);
      const last = verificationsForAccount.length - 1;
      expect(verificationsForAccount[last]).to.have.property('status', VerificationsStatus.Issued);
      expect(verificationsForAccount[last]).to.have.property('creationBlock');
      expect(verificationsForAccount[last].description).to.deep.eq(sampleDescription);
    });

    it('can reject a verification', async () => {
      const oldLength = (await verifications.getVerifications(
        accounts[1], '/company/b-s-s/employee/swo4')).length;
      await verifications.setVerification(accounts[0], accounts[0], '/company');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s/employee');
      const verificationId = await verifications.setVerification(
        accounts[0], accounts[1], '/company/b-s-s/employee/swo4');
      await verifications.rejectVerification(accounts[1], accounts[1], verificationId);
      const verificationsForAccount = await verifications.getVerifications(
        accounts[1], '/company/b-s-s/employee/swo4');
      expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
      expect(verificationsForAccount[oldLength])
        .to.have.property('status', VerificationsStatus.Rejected);
    });

    it('can reject a verification with a reason', async () => {
      const oldLength = (await verifications.getVerifications(
        accounts[1], '/company/b-s-s/employee/swo4')).length;
      await verifications.setVerification(accounts[0], accounts[0], '/company');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s/employee');
      await timeout(5000);
      const verificationId = await verifications.setVerification(
        accounts[0], accounts[1], '/company/b-s-s/employee/swo4');
      await timeout(5000);
      await verifications.rejectVerification(
        accounts[1], accounts[1], verificationId, { reason: 'denied' });
      await timeout(5000);
      const verificationsForAccount = await verifications.getVerifications(
        accounts[1], '/company/b-s-s/employee/swo4');
      expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
      expect(verificationsForAccount[oldLength])
        .to.have.property('status', VerificationsStatus.Rejected);
      expect(verificationsForAccount[oldLength])
        .to.have.deep.property('rejectReason', { reason: 'denied' });
    });

    it('can reject a verification with a reason from the issuer side', async () => {
      const oldLength = (await verifications.getVerifications(
        accounts[1], '/company/b-s-s/employee/swo4')).length;
      await verifications.setVerification(accounts[0], accounts[0], '/company');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s/employee');
      const verificationId = await verifications.setVerification(
        accounts[0], accounts[1], '/company/b-s-s/employee/swo4');
      await verifications.rejectVerification(
        accounts[0], accounts[1], verificationId, { reason: 'denied' });
      const verificationsForAccount = await verifications.getVerifications(
        accounts[1], '/company/b-s-s/employee/swo4');
      expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
      expect(verificationsForAccount[oldLength])
        .to.have.property('status', VerificationsStatus.Rejected);
      expect(verificationsForAccount[oldLength])
        .to.have.deep.property('rejectReason', { reason: 'denied' });
    });

    it('can not re accept a rejected verification', async () => {
      const oldLength = (await verifications.getVerifications(
        accounts[1], '/company/b-s-s/employee/swo4')).length;
      await verifications.setVerification(accounts[0], accounts[0], '/company');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s/employee');
      const verificationId = await verifications.setVerification(
        accounts[0], accounts[1], '/company/b-s-s/employee/swo4');
      await verifications.rejectVerification(accounts[1], accounts[1], verificationId);
      const reacceptedP = verifications.confirmVerification(
        accounts[1], accounts[1], verificationId);
      await expect(reacceptedP).to.be.rejected;
    });

    describe('when validating nested verifications', () => {
      it('verifications for a subject that has no identity should throw', async () => {
        const randomAccount = TestUtils.getRandomAddress();
        let topic = getRandomTopic('/evan'), computed;

        // check missing state
        const promise = verifications.getComputedVerification(randomAccount, topic);
        await expect(promise).to.be.rejected;

        // V2
        //// check missing state
        const promise2 = verifications.getNestedVerificationsV2(randomAccount, topic);
        await expect(promise2).to.be.rejected;
      });

      it('non existing verifications include the warning "missing" and status should be -1',
      async () => {
        let topic = getRandomTopic('/evan'), computed;

        // check missing state
        computed = await verifications.getComputedVerification(accounts[0], topic);
        await expect(computed.status).to.be.eq(-1);
        await expect(computed.warnings).to.include('missing');

        // V2
        //// check missing state
        const localQueryOptions = { validationOptions: { [VerificationsStatusFlagsV2.missing]: VerificationsStatusV2.Yellow }};
        let v2 = await verifications.getNestedVerificationsV2(accounts[0], topic, false, localQueryOptions);
        await expect(v2.status).to.be.eq(VerificationsStatusV2.Red);

        // check missing state is missing after set
        await verifications.setVerification(accounts[0], accounts[0], topic);
        computed = await verifications.getComputedVerification(accounts[0], topic);
        await expect(computed.status).to.be.eq(0);
        await expect(computed.warnings).to.not.include('missing');

        // V2
        //// check missing state is missing after set
        v2 = await verifications.getNestedVerificationsV2(accounts[0], topic, false, localQueryOptions);
        await expect(v2.status).not.to.be.eq(VerificationsStatusV2.Yellow);
        await expect(v2.levelComputed.statusFlags).not.to.include(VerificationsStatusFlagsV2.missing);
      });

      it('should be able to fetch a netsted parent path', async () => {
        let parentTopic = getRandomTopic('');
        let topic = getRandomTopic(parentTopic);

        // check issued case
        await verifications.setVerification(accounts[0], accounts[0], parentTopic);
        await verifications.setVerification(accounts[0], accounts[1], topic);

        await new Promise(s => setTimeout(s, 5000));

        const nested = await verifications.getNestedVerificationsV2(accounts[1], topic);
        expect(nested).to.haveOwnProperty('verifications');
        expect(nested.verifications).to.have.length(1);
        expect(nested).to.haveOwnProperty('levelComputed');
        expect(nested.levelComputed).to.haveOwnProperty('parents');
        expect(nested.levelComputed.parents).to.haveOwnProperty('verifications');
        expect(nested.levelComputed.parents.verifications).to.have.length(1);
      });

      it('verifications with status 0 should have warning "issued"', async () => {
        let topic = getRandomTopic('/evan'), computed;

        // check issued case
        await verifications.setVerification(accounts[0], accounts[1], topic);
        computed = await verifications.getComputedVerification(accounts[1], topic);
        await expect(computed.status).to.be.eq(0);
        await expect(computed.warnings).to.include('issued');

        // V2
        // check issued case
        const localQueryOptions = { validationOptions: { [VerificationsStatusFlagsV2.issued]: VerificationsStatusV2.Yellow }};
        let v2 = await verifications.getNestedVerificationsV2(accounts[1], topic, false, localQueryOptions);
        await expect(v2.status).to.eq(VerificationsStatusV2.Yellow);
        await expect(v2.levelComputed.statusFlags).to.include(VerificationsStatusFlagsV2.issued);

        // test issued is missing after confirm
        await verifications.confirmVerification(accounts[1], accounts[1],
          computed.verifications[0].id);
        computed = await verifications.getComputedVerification(accounts[1], topic);
        await expect(computed.warnings).to.not.include('issued');

        // V2
        // test issued is missing after confirm
        v2 = await verifications.getNestedVerificationsV2(accounts[1], topic, false, localQueryOptions);
        await expect(v2.status).to.eq(VerificationsStatusV2.Green);
        await expect(v2.levelComputed.statusFlags).to.not.include(VerificationsStatusFlagsV2.issued);
      });

      it('expired verifications should have warning "expired"', async () => {
        const topic = getRandomTopic('/evan');
        const before = Math.floor(Date.now() / 1000);
        await verifications.setVerification(accounts[0], accounts[1], topic, before);
        const computed = await verifications.getComputedVerification(accounts[1], topic);
        await expect(computed.status).to.be.eq(0);
        await expect(computed.warnings).to.include('expired');

        // V2
        const localQueryOptions = { validationOptions: { [VerificationsStatusFlagsV2.expired]: VerificationsStatusV2.Yellow }};
        const v2 = await verifications.getNestedVerificationsV2(accounts[1], topic, false, localQueryOptions);
        await expect(v2.status).to.eq(VerificationsStatusV2.Yellow);
        await expect(v2.levelComputed.statusFlags).to.include(VerificationsStatusFlagsV2.expired);
      });

      it('verifications that are created by the same user should have warning "selfIssued"',
      async () => {
        let topic = getRandomTopic('/evan'), computed;

        // check issued case
        await verifications.setVerification(accounts[0], accounts[0], topic);
        computed = await verifications.getComputedVerification(accounts[0], topic);
        await expect(computed.status).to.be.eq(0);
        await expect(computed.warnings).to.include('selfIssued');

        // V2
        const localQueryOptions = { validationOptions: { [VerificationsStatusFlagsV2.selfIssued]: VerificationsStatusV2.Yellow }};
        const v2 = await verifications.getNestedVerificationsV2(accounts[0], topic, false, localQueryOptions);
        await expect(v2.status).to.eq(VerificationsStatusV2.Yellow);
        await expect(v2.levelComputed.statusFlags).to.include(VerificationsStatusFlagsV2.selfIssued);
      });

      it('verifications with an missing parent should have the warning "parentMissing"',
      async () => {
        let computed;
        let topicParent = getRandomTopic('');
        let topic = getRandomTopic(topicParent);

        // check issued case
        await verifications.setVerification(accounts[0], accounts[1], topic);
        computed = await verifications.getComputedVerification(accounts[1], topic);
        await expect(computed.warnings).to.include('parentMissing');

        // V2
        const localQueryOptions = { validationOptions: { [VerificationsStatusFlagsV2.parentMissing]: VerificationsStatusV2.Yellow }};
        let v2 = await verifications.getNestedVerificationsV2(accounts[1], topic, false, localQueryOptions);
        await expect(v2.status).to.eq(VerificationsStatusV2.Yellow);
        await expect(v2.levelComputed.statusFlags).to.include(VerificationsStatusFlagsV2.parentMissing);

        await verifications.setVerification(accounts[0], accounts[0], topicParent);
        computed = await verifications.getComputedVerification(accounts[1], topic);
        await expect(computed.warnings).to.not.include('parentMissing');

        // V2
        v2 = await verifications.getNestedVerificationsV2(accounts[1], topic, false, localQueryOptions);
        await expect(v2.status).to.eq(VerificationsStatusV2.Green);
        await expect(v2.levelComputed.statusFlags).not.to.include(VerificationsStatusFlagsV2.parentMissing);
      });

      it('verifications with an untrusted parent should have the warning "parentUntrusted"',
      async () => {
        let computed;
        let topicParent = getRandomTopic('/evan');
        let topic = getRandomTopic(topicParent);

        // check issued case
        await verifications.setVerification(accounts[0], accounts[1], topic);
        await verifications.setVerification(accounts[0], accounts[0], topicParent);
        computed = await verifications.getComputedVerification(accounts[1], topic);
        await expect(computed.warnings).to.include('parentUntrusted');

        // V2
        const localQueryOptions = { validationOptions: { [VerificationsStatusFlagsV2.parentUntrusted]: VerificationsStatusV2.Yellow }};
        const v2 = await verifications.getNestedVerificationsV2(accounts[1], topic, false, localQueryOptions);
        await expect(v2.status).to.eq(VerificationsStatusV2.Yellow);
        await expect(v2.levelComputed.statusFlags).to.include(VerificationsStatusFlagsV2.parentUntrusted);
      });

      it('verifications with the base "/evan" should be issued by the evan root account',
      async () => {
        let computed;
        let topic = '/evan';

        // check issued case
        await verifications.setVerification(accounts[0], accounts[1], topic);
        computed = await verifications.getComputedVerification(accounts[1], topic);
        await expect(computed.warnings).to.include('notEnsRootOwner');

        // V2
        const localQueryOptions = { validationOptions: { [VerificationsStatusFlagsV2.notEnsRootOwner]: VerificationsStatusV2.Yellow }};
        const v2 = await verifications.getNestedVerificationsV2(accounts[1], topic, false, localQueryOptions);
        await expect(v2.status).to.eq(VerificationsStatusV2.Yellow);
        await expect(v2.levelComputed.statusFlags).to.include(VerificationsStatusFlagsV2.notEnsRootOwner);
      });

      it('sub verifications, where the parent verifications has the property has ' +
        '"disableSubVerifications" should be not valid',
      async () => {
        let parentTopic = getRandomTopic('');
        let topic = getRandomTopic(parentTopic);

        // check issued case
        await verifications.setVerification(
          accounts[0], accounts[0], parentTopic, 0, null, null, true);
        await verifications.setVerification(accounts[0], accounts[1], topic);

        // load parent verifications and computed from child
        const parentComputed = await verifications.getComputedVerification(
          accounts[0], parentTopic);
        const computed = await verifications.getComputedVerification(accounts[1], topic);

        await expect(parentComputed.disableSubVerifications).to.be.eq(true);
        await expect(computed.warnings).to.include('disableSubVerifications');

        // V2
        const localQueryOptions = { validationOptions: { [VerificationsStatusFlagsV2.disableSubVerifications]: VerificationsStatusV2.Yellow }};
        const parentV2 = await verifications.getNestedVerificationsV2(accounts[0], parentTopic, false, localQueryOptions);
        await expect(parentV2.verifications[0].raw.disableSubVerifications).to.be.eq(true);

        const computedV2 = await verifications.getNestedVerificationsV2(accounts[1], topic, false, localQueryOptions);
        await expect(computedV2.status).to.eq(VerificationsStatusV2.Yellow);
        await expect(computedV2.levelComputed.statusFlags).to.include(VerificationsStatusFlagsV2.disableSubVerifications);
      });
    });
  });

  describe('when using identities for contracts', () => {
    function runGenericContractTests(context) {
      let isIdentity: boolean;
      let extraArgs: any[];
      let subject;

      before(() => {
        ({ subject } = context);
        isIdentity = subject.length === 66;
        extraArgs = isIdentity ? [0, null, null, false, true] : [];
      });

      it('can add a verification', async () => {
        const oldLength = (await verifications.getVerifications(
          subject, '/company', isIdentity)).length;
        await verifications.setVerification(accounts[0], subject, '/company', ...extraArgs);
        const verificationsForAccount = await verifications.getVerifications(
          subject, '/company', isIdentity);
        expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
        expect(verificationsForAccount[oldLength])
          .to.have.property('status', VerificationsStatus.Issued);
      });

      it('can add a verification from an account that is not the owner of the contract',
      async () => {
        const oldLength = (await verifications.getVerifications(
          subject, '/company', isIdentity)).length;
        await verifications.setVerification(accounts[1], subject, '/company', ...extraArgs);
        const verificationsForAccount = await verifications.getVerifications(
          subject, '/company', isIdentity);
        expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
        expect(verificationsForAccount[oldLength])
          .to.have.property('status', VerificationsStatus.Issued);
      });

      it('can add a verification with data', async () => {
        const oldLength = (await verifications.getVerifications(
          subject, '/company', isIdentity)).length;
        await verifications.setVerification(
          accounts[0], subject, '/company', 0, {foo: 'bar'}, ...extraArgs.slice(2));
        await timeout(5000);
        const verificationsForAccount = await verifications.getVerifications(
          subject, '/company', isIdentity);
        expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
      });

      it('can add a verification with encrypted data', async () => {
        const unencrypted = {foo: 'bar'};
        const cryptoInfo = await encryptionWrapper.getCryptoInfo('test', EncryptionWrapperKeyType.Custom);
        const key = await encryptionWrapper.generateKey(cryptoInfo);
        const encrypted = await encryptionWrapper.encrypt(unencrypted, cryptoInfo, { key });
        const oldLength = (await verifications.getVerifications(accounts[1], '/company')).length;
        await verifications.setVerification(accounts[0], accounts[1], '/company', 0, encrypted);
        const verificationsForAccount = await verifications.getVerifications(accounts[1], '/company');
        const retrieved = JSON.parse(await dfs.get(verificationsForAccount[oldLength].data));
        const decrypted = await encryptionWrapper.decrypt(retrieved, { key });
        expect(decrypted).to.deep.eq(unencrypted);
      });

      it('can add a verification with specific expirationDate', async () => {
        const oldLength = (await verifications.getVerifications(
          subject, '/company', isIdentity)).length;
        const now = Math.floor(Date.now() / 1000);
        await verifications.setVerification(
          accounts[0], subject, '/company', now, ...extraArgs.slice(1));
        const verificationsForAccount = await verifications.getVerifications(
          subject, '/company', isIdentity);
        expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
        expect(verificationsForAccount[oldLength])
          .to.have.property('expirationDate', now.toString());
      });

      it('can add a verification and validate the integrity', async () => {
        const oldLength = (await verifications.getVerifications(
          subject, '/company', isIdentity)).length;
        await timeout(5000);
        await verifications.setVerification(accounts[0], subject, '/company', ...extraArgs);
        await timeout(5000);
        const verificationsForAccount = await verifications.getVerifications(
          subject, '/company', isIdentity);
        expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
        await verifications.validateVerification(
          subject, verificationsForAccount[oldLength].id, isIdentity);
        expect(verificationsForAccount[oldLength])
          .to.have.property('status', VerificationsStatus.Issued);
      });

      it('can add subverification paths', async () => {
        const oldLength = (await verifications.getVerifications(
          subject, '/company/b-s-s/employee/swo3', isIdentity)).length;
        await verifications.setVerification(accounts[0], accounts[0], '/company', ...extraArgs);
        await verifications.setVerification(
          accounts[0], accounts[0], '/company/b-s-s', ...extraArgs);
        await verifications.setVerification(
          accounts[0], accounts[0], '/company/b-s-s/employee', ...extraArgs);
        await verifications.setVerification(
          accounts[0], subject, '/company/b-s-s/employee/swo3', ...extraArgs);
        const verificationsForAccount = await verifications.getVerifications(
          subject, '/company/b-s-s/employee/swo3', isIdentity);
        expect(verificationsForAccount).to.have.lengthOf(1);
        expect(verificationsForAccount[oldLength])
          .to.have.property('status', VerificationsStatus.Issued);
      });

      it('can confirm a subverification paths with the subject user', async () => {
        const oldLength = (await verifications.getVerifications(
          subject, '/company/b-s-s/employee/swo4', isIdentity)).length;
        await verifications.setVerification(accounts[0], accounts[0], '/company', ...extraArgs);
        await verifications.setVerification(
          accounts[0], accounts[0], '/company/b-s-s', ...extraArgs);
        await verifications.setVerification(
          accounts[0], accounts[0], '/company/b-s-s/employee', ...extraArgs);
        const verificationId = await verifications.setVerification(
          accounts[0], subject, '/company/b-s-s/employee/swo4', ...extraArgs);
        await verifications.confirmVerification(accounts[0], subject, verificationId, isIdentity);
        const verificationsForAccount = await verifications.getVerifications(
          subject, '/company/b-s-s/employee/swo4', isIdentity);
        expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
        expect(verificationsForAccount[oldLength])
          .to.have.property('status', VerificationsStatus.Confirmed);
      });

      it('can delete a subverification path with the subject user', async () => {
        await verifications.setVerification(accounts[0], accounts[0], '/company', ...extraArgs);
        await verifications.setVerification(
          accounts[0], accounts[0], '/company/b-s-s', ...extraArgs);
        await verifications.setVerification(
          accounts[0], accounts[0], '/company/b-s-s/employee', ...extraArgs);
        const verificationId = await verifications.setVerification(
          accounts[0], subject, '/company/b-s-s/employee/swo6', ...extraArgs);
        await verifications.deleteVerification(accounts[0], subject, verificationId, isIdentity);
        const verificationsForAccount = await verifications.getVerifications(
          subject, '/company/b-s-s/employee/swo6', isIdentity);
        expect(verificationsForAccount).to.have.lengthOf(0);
      });

      it('can track the creation date', async() => {
        const before = Math.floor(Date.now() / 1000);
        await verifications.setVerification(accounts[0], subject, '/company', ...extraArgs);
        const after = Math.floor(Date.now() / 1000);
        const verificationsForAccount = await verifications.getVerifications(
          subject, '/company', isIdentity);
        const last = verificationsForAccount.length - 1;
        expect(verificationsForAccount[last])
          .to.have.property('status', VerificationsStatus.Issued);
        expect(verificationsForAccount[last]).to.have.property('creationDate');
        expect(parseInt(verificationsForAccount[last].creationDate, 10)).to.be.gte(before);
        expect(parseInt(verificationsForAccount[last].creationDate, 10)).to.be.lte(after);
      });

      it('can track the expiration date and the expired flag is set correctly', async() => {
        const before = Math.floor(Date.now() / 1000);
        await verifications.setVerification(
          accounts[0], subject, '/company', before, ...extraArgs.slice(1));
        const after = Math.floor(Date.now() / 1000);
        const verificationsForAccount = await verifications.getVerifications(
          subject, '/company', isIdentity);
        const last = verificationsForAccount.length - 1;
        expect(verificationsForAccount[last]).to.have.property(
          'status', VerificationsStatus.Issued);
        expect(verificationsForAccount[last]).to.have.property('expirationDate');
        expect(parseInt(verificationsForAccount[last].expirationDate, 10)).to.be.eq(before);
        expect(parseInt(verificationsForAccount[last].expirationDate, 10)).to.be.lte(after);
        expect(verificationsForAccount[last].expired).to.be.eq(true);
      });

      it('can track the creation block', async() => {
        const before = await web3.eth.getBlockNumber();
        await verifications.setVerification(accounts[0], subject, '/company', ...extraArgs);
        const after = await web3.eth.getBlockNumber();
        const verificationsForAccount = await verifications.getVerifications(
          subject, '/company', isIdentity);
        const last = verificationsForAccount.length - 1;
        expect(verificationsForAccount[last]).to.have.property(
          'status', VerificationsStatus.Issued);
        expect(verificationsForAccount[last]).to.have.property('creationBlock');
        expect(parseInt(verificationsForAccount[last].creationBlock, 10)).to.be.gte(before);
        expect(parseInt(verificationsForAccount[last].creationBlock, 10)).to.be.lte(after);
      });

      it('can add a description to a verification', async() => {
        const sampleVerificationsDomain = 'sample';
        const sampleVerificationTopic = '/company';
        const sampleDescription = {
          name: 'sample verification',
          description: 'I\'m a sample verification',
          author: 'evan.network',
          version: '1.0.0',
          dbcpVersion: 1,
        };
        await verifications.setVerificationDescription(
          accounts[0], sampleVerificationTopic, sampleVerificationsDomain, sampleDescription);
        await verifications.setVerification(
          accounts[0],
          subject,
          sampleVerificationTopic,
          0,
          null,
          sampleVerificationsDomain,
          ...extraArgs.slice(3),
        );
        const verificationsForAccount = await verifications.getVerifications(
          subject, sampleVerificationTopic, isIdentity);
        const last = verificationsForAccount.length - 1;
        expect(verificationsForAccount[last]).to.have.property(
          'status', VerificationsStatus.Issued);
        expect(verificationsForAccount[last]).to.have.property('creationBlock');
        expect(verificationsForAccount[last].description).to.deep.eq(sampleDescription);
      });

      it('can reject a verification', async () => {
        const oldLength = (await verifications.getVerifications(
          subject, '/company/b-s-s/employee/swo4', isIdentity)).length;
        await verifications.setVerification(accounts[0], accounts[0], '/company', ...extraArgs);
        await verifications.setVerification(
          accounts[0], accounts[0], '/company/b-s-s', ...extraArgs);
        await verifications.setVerification(
          accounts[0], accounts[0], '/company/b-s-s/employee', ...extraArgs);
        const verificationId = await verifications.setVerification(
          accounts[0], subject, '/company/b-s-s/employee/swo4', ...extraArgs);
        await verifications.rejectVerification(
          accounts[0], subject, verificationId, 0, isIdentity);
        const verificationsForAccount = await verifications.getVerifications(
          subject, '/company/b-s-s/employee/swo4', isIdentity);
        expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
        expect(verificationsForAccount[oldLength])
          .to.have.property('status', VerificationsStatus.Rejected);
      });

      it('can reject a verification with a reason', async () => {
        const oldLength = (await verifications.getVerifications(
          subject, '/company/b-s-s/employee/swo4', isIdentity)).length;
        await verifications.setVerification(accounts[0], accounts[0], '/company', ...extraArgs);
        await verifications.setVerification(
          accounts[0], accounts[0], '/company/b-s-s', ...extraArgs);
        await verifications.setVerification(
          accounts[0], accounts[0], '/company/b-s-s/employee', ...extraArgs);
        await timeout(5000);
        const verificationId = await verifications.setVerification(
          accounts[0], subject, '/company/b-s-s/employee/swo4', ...extraArgs);
        await timeout(5000);
        await verifications.rejectVerification(
          accounts[0], subject, verificationId, { reason: 'denied' }, isIdentity);
        await timeout(5000);
        const verificationsForAccount = await verifications.getVerifications(
          subject, '/company/b-s-s/employee/swo4', isIdentity);
        expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
        expect(verificationsForAccount[oldLength])
          .to.have.property('status', VerificationsStatus.Rejected);
        expect(verificationsForAccount[oldLength])
          .to.have.deep.property('rejectReason', { reason: 'denied' });
      });

      it('can not re accept a rejected verification', async () => {
        const oldLength = (await verifications.getVerifications(
          subject, '/company/b-s-s/employee/swo4', isIdentity)).length;
        await verifications.setVerification(accounts[0], accounts[0], '/company', ...extraArgs);
        await verifications.setVerification(
          accounts[0], accounts[0], '/company/b-s-s', ...extraArgs);
        await verifications.setVerification(
          accounts[0], accounts[0], '/company/b-s-s/employee', ...extraArgs);
        const verificationId = await verifications.setVerification(
          accounts[0], subject, '/company/b-s-s/employee/swo4', ...extraArgs);
        await verifications.rejectVerification(
          accounts[0], subject, verificationId, 0, isIdentity);
        const reacceptedP = verifications.confirmVerification(accounts[0], subject, verificationId);
        await expect(reacceptedP).to.be.rejected;
      });

      it('cannot have other users approve verifications of a contract of another user',
      async () => {
        const oldLength = (await verifications.getVerifications(
          subject, '/company/b-s-s/employee/swo4', isIdentity)).length;
        await verifications.setVerification(accounts[0], accounts[0], '/company', ...extraArgs);
        await verifications.setVerification(
          accounts[0], accounts[0], '/company/b-s-s', ...extraArgs);
        await verifications.setVerification(
          accounts[0], accounts[0], '/company/b-s-s/employee', ...extraArgs);
        const verificationId = await verifications.setVerification(
          accounts[0], subject, '/company/b-s-s/employee/swo4', ...extraArgs);
        await expect(verifications.confirmVerification(accounts[1], subject, verificationId))
          .to.be.rejected;
      });

      describe('when validating nested verifications', () => {
        it('non existing verifications include the warning "missing" and status should be -1',
        async () => {
          let topic = getRandomTopic('/evan'), computed;

          // check missing state
          computed = await verifications.getComputedVerification(subject, topic, isIdentity);
          await expect(computed.status).to.be.eq(-1);
          await expect(computed.warnings).to.include('missing');

          // check missing state is missing after set
          await verifications.setVerification(accounts[0], subject, topic, ...extraArgs);
          const vava = await verifications.getVerifications(subject, topic, isIdentity);
          computed = await verifications.getComputedVerification(subject, topic, isIdentity);
          await expect(computed.status).to.be.eq(0);
          await expect(computed.warnings).to.not.include('missing');
        });

        it('should parent', async () => {
          let parentTopic = getRandomTopic('');
          let topic = getRandomTopic(parentTopic);

          // check missing state
          let computed;
          let parentComputed;
          computed = await verifications.getComputedVerification(subject, topic, isIdentity);
          await expect(computed.status).to.be.eq(-1);
          await expect(computed.warnings).to.include('missing');

          // check issued case
          await verifications.setVerification(accounts[0], subject, parentTopic, ...extraArgs);
          await verifications.setVerification(accounts[0], subject, topic, ...extraArgs);

          await new Promise(s => setTimeout(s, 10000));

          // load parent verifications and computed from child
          parentComputed = await verifications.getComputedVerification(subject, parentTopic, isIdentity);
          computed = await verifications.getComputedVerification(subject, topic, isIdentity);

          const nested = await verifications.getNestedVerifications(subject, topic, isIdentity);
        });

        it('verifications with status 0 should have warning "issued"', async () => {
          let topic = getRandomTopic('/evan'), computed;

          // check issued case
          await verifications.setVerification(accounts[0], subject, topic, ...extraArgs);
          computed = await verifications.getComputedVerification(subject, topic, isIdentity);
          await expect(computed.status).to.be.eq(0);
          await expect(computed.warnings).to.include('issued');

          // test issued is missing after confirm
          await verifications.confirmVerification(accounts[0], subject,
            computed.verifications[0].id, isIdentity);
          computed = await verifications.getComputedVerification(subject, topic, isIdentity);
          await expect(computed.warnings).to.not.include('issued');
        });

        it('expired verifications should have warning "expired"', async () => {
          const topic = getRandomTopic('/evan');
          const before = Math.floor(Date.now() / 1000);
          await verifications.setVerification(
            accounts[0], subject, topic, before, ...extraArgs.slice(1));
          const computed = await verifications.getComputedVerification(subject, topic, isIdentity);
          await expect(computed.status).to.be.eq(0);
          await expect(computed.warnings).to.include('expired');
        });

        it('verifications with a missing parent should have the warning "parentMissing"',
        async () => {
          let computed;
          let topicParent = getRandomTopic('');
          let topic = getRandomTopic(topicParent);

          // check issued case
          await verifications.setVerification(accounts[0], subject, topic, ...extraArgs);
          computed = await verifications.getComputedVerification(subject, topic, isIdentity);
          await expect(computed.warnings).to.include('parentMissing');

          await verifications.setVerification(accounts[0], accounts[0], topicParent);
          computed = await verifications.getComputedVerification(subject, topic, isIdentity);
          await expect(computed.warnings).to.not.include('parentMissing');
        });

        it('verifications with an untrusted parent should have the warning "parentUntrusted"',
        async () => {
          let computed;
          let topicParent = getRandomTopic('/evan');
          let topic = getRandomTopic(topicParent);

          // check issued case
          await verifications.setVerification(accounts[0], subject, topic, ...extraArgs);
          await verifications.setVerification(accounts[0], accounts[0], topicParent);
          computed = await verifications.getComputedVerification(subject, topic, isIdentity);
          await expect(computed.warnings).to.include('parentUntrusted');
        });

        it('verifications with the base "/evan" should be issued by the evan root account',
        async () => {
          let computed;
          let topic = '/evan';

          // check issued case
          await verifications.setVerification(accounts[0], subject, topic, ...extraArgs);
          computed = await verifications.getComputedVerification(subject, topic, isIdentity);
          await expect(computed.warnings).to.include('notEnsRootOwner');
        });

        it('sub verifications, where the parent verifications has the property has ' +
          '"disableSubVerifications" should be not valid',
        async () => {
          let parentTopic = getRandomTopic('');
          let topic = getRandomTopic(parentTopic);

          // check issued case
          await verifications.setVerification(
            accounts[0], accounts[0], parentTopic, 0, null, null, true);
          await verifications.setVerification(accounts[0], subject, topic, ...extraArgs);

          // load parent verifications and computed from child
          const parentComputed = await verifications.getComputedVerification(
            accounts[0], parentTopic);
          const computed = await verifications.getComputedVerification(subject, topic, isIdentity);

          await expect(parentComputed.disableSubVerifications).to.be.eq(true);
          await expect(computed.warnings).to.include('disableSubVerifications');
        });
      });
    }

    describe('that have a description', async () => {
      let verificationsRegistry;
      let contractId;
      const context: any = {};

      before(async () => {
        verificationsRegistry = await executor.createContract(
          'VerificationsRegistry', [], { from: accounts[2], gas: 8000000 });
        verifications.contracts.registry = verificationsRegistry;

        const businessCenterDomain = nameResolver.getDomainName(
          config.nameResolver.domains.businessCenter);
        contractId = await baseContract.createUninitialized(
          'testdatacontract',
          accounts[0],
          null,
        );
        await description.setDescriptionToContract(
          contractId,
          {
            public: {
              name: 'sample verification',
              description: 'I\'m a sample verification',
              author: 'evan.network',
              version: '1.0.0',
              dbcpVersion: 2,
            },
          },
          accounts[0],
        );
        context.subject = contractId;
      });

      it('can create a new identity for a contract', async() => {
        const identity = await verifications.createIdentity(accounts[0], contractId);
        expect(identity).to.match(/0x[0-9-a-f]{64}/i);
      });

      runGenericContractTests(context);

      it('does not return verification data, when identity and contract id mismatch', async () => {
        const businessCenterDomain = nameResolver.getDomainName(
          config.nameResolver.domains.businessCenter);
        // create two contracts with a verification
        const [ contractId1, contractId2 ] = await Promise.all([...Array(2)].map(async () => {
          const localContractId = await baseContract.createUninitialized(
          'testdatacontract',
          accounts[0],
          businessCenterDomain,
          );
          await description.setDescriptionToContract(
            localContractId,
            {
              public: {
                name: 'sample verification',
                description: 'I\'m a sample verification',
                author: 'evan.network',
                version: '1.0.0',
                dbcpVersion: 2,
              },
            },
            accounts[0],
          );
          const identity = await verifications.createIdentity(accounts[0], localContractId);
          await verifications.setVerification(accounts[0], localContractId, '/company');

          // each contract should have one verification
          const contractVerifications = await verifications.getVerifications(
            localContractId, '/company');
          expect(contractVerifications).to.have.lengthOf(1);
          expect(contractVerifications[0]).to.have.property('status', VerificationsStatus.Issued);

          return localContractId;
        }));

        // point contract1s description to contract2s identity
        const description1 = await description.getDescription(contractId1, accounts[0]);
        const description2 = await description.getDescription(contractId2, accounts[0]);
        description1.public.identity = description2.public.identity;
        await description.setDescriptionToContract(contractId1, description1, accounts[0]);

        verifications.cachedIdentities = {};
        verifications.subjectTypes = {};
        await expect(verifications.getVerifications(contractId1, '/company')).to.be.rejected;
      });

      it('verifications for a subject that has no identity should throw', async () => {
        let topic = getRandomTopic('/evan'), computed;
        const businessCenterDomain = nameResolver.getDomainName(
          config.nameResolver.domains.businessCenter);

        const contractIdWithoutIdentity = await baseContract.createUninitialized(
          'testdatacontract',
          accounts[0],
          businessCenterDomain,
        );

         await description.setDescriptionToContract(
          contractIdWithoutIdentity,
          {
            public: {
              name: 'sample verification',
              description: 'I\'m a sample verification',
              author: 'evan.network',
              version: '1.0.0',
              dbcpVersion: 2,
            },
          },
          accounts[0],
        );

        // check missing state
        const promise = verifications.getComputedVerification(contractIdWithoutIdentity, topic);
        await expect(promise).to.be.rejected;
      });
    });

    describe('that do not have a description', async () => {
      let undescribedContract;
      let undescribedIdentity;
      const context: any = {};

      before(async () => {
        const businessCenterDomain = nameResolver.getDomainName(
          config.nameResolver.domains.businessCenter);
        undescribedContract = await executor.createContract(
          'TestContract',
          ['test'],
          { from: accounts[0], gas: 500000 },
        );
        undescribedIdentity = await verifications.createIdentity(
          accounts[0], undescribedContract.options.address, false);
        context.subject = undescribedIdentity;
      });

      runGenericContractTests(context);

      it('throws an error when trying to set an identity on a contractId ', async () => {
        const setPromise = verifications.setVerification(
          accounts[0], undescribedContract.options.address, '/company', 0, null, null, false, true);
        await expect(setPromise).to.be.rejected;
      });
    });
  });

  describe('when using "cold" verifications and submitting them with an unrelated account', () => {
    it('allows to submit a "cold" transaction from another account to an account identity',
    async () => {
      const oldLength = (await verifications.getVerifications(accounts[1], '/company')).length;
      await timeout(5000);

      const topic = '/company';

      // on account[0]s side
      // accounts[0] wants to issue a verification for accounts[1] via delegation
      const txInfo = await verifications.signSetVerificationTransaction(
        accounts[0], accounts[1], topic);

      // on account[2]s side
      // accounts[2] submits transaction, that actually issues verification
      const verificationId = await verifications.executeVerification(accounts[2], txInfo);

      await timeout(5000);
      expect(verificationId).to.be.ok;
      const verificationsForAccount = await verifications.getVerifications(accounts[1], '/company');
      expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
      expect(verificationsForAccount[oldLength])
        .to.have.property('status', VerificationsStatus.Issued);
    });

    it('allows to submit a "cold" transaction from another account to an account identity',
    async () => {
      const oldLength = (await verifications.getVerifications(accounts[1], '/company')).length;
      await timeout(5000);

      const topic = '/company';

      // on account[0]s side
      const txInfo = await verifications.signSetVerificationTransaction(
        accounts[0], accounts[1], topic);

      // on account[2]s side
      const verificationId = await verifications.executeVerification(accounts[2], txInfo);

      await timeout(5000);
      expect(verificationId).to.be.ok;
      const verificationsForAccount = await verifications.getVerifications(accounts[1], '/company');
      expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
      expect(verificationsForAccount[oldLength])
        .to.have.property('status', VerificationsStatus.Issued);
    });

    it('allows to get execution nonce for a given identity', async () => {
      const nonce1 = await verifications.getExecutionNonce(accounts[0]);
      expect(nonce1).to.be.ok;
      expect(JSON.parse(nonce1)).to.be.gte(0);

      await verifications.setVerification(accounts[0], accounts[1], '/company');

      const nonce2 = await verifications.getExecutionNonce(accounts[0]);
      expect(nonce2).to.be.ok;
      expect(JSON.parse(nonce2)).to.be.gte(0);

      expect(JSON.parse(nonce2)).to.be.eq(JSON.parse(nonce1) + 1);
    });

    it('allows to submit multiple "cold" transactions from another account', async () => {
      const paths = ['/verfication1', '/verfication2', '/verfication3'];
      const oldLengths =
        (await Promise.all(paths.map(path => verifications.getVerifications(accounts[1], path))))
          .map(veris => veris.length);
      await timeout(5000);

      // on account[0]s side
      let nonce = JSON.parse(await verifications.getExecutionNonce(accounts[0]));
      let txInfos = [];
      for (let path of paths) {
        txInfos.push(await verifications.signSetVerificationTransaction(
          accounts[0], accounts[1], path, 0, null, null, false, false, nonce++));
      }

      // on account[2]s side
      for (let i of txInfos.keys()) {
        const verificationId = await verifications.executeVerification(accounts[2], txInfos[i]);
        await timeout(5000);
        expect(verificationId).to.be.ok;
        const verificationsForAccount = await verifications.getVerifications(
          accounts[1], `/verfication${i + 1}`);
        expect(verificationsForAccount).to.have.lengthOf(oldLengths[i] + 1);
        expect(verificationsForAccount[oldLengths[i]])
          .to.have.property('status', VerificationsStatus.Issued);
      }
    });
  });
});
