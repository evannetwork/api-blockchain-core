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
import { Verifications, VerificationsStatus, } from './verifications';
import { configTestcore as config } from '../config-testcore';
import { Description } from '../shared-description';
import { TestUtils } from '../test/test-utils';

const linker = require('solc/linker');

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

use(chaiAsPromised);

describe('Verifications handler', function() {
  this.timeout(600000);
  let baseContract: BaseContract;
  let verifications: Verifications;
  let verificationsContracts;
  let contractLoader: ContractLoader;
  let description: Description;
  let dfs: any;
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
  });

  it('can deploy a new structure', async () => {
    const libs = {};
    const deploy = async (contractAndPath) => {
      console.log(contractAndPath);
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
    expect(verificationsForAccount[oldLength]).to.have.property('status', VerificationsStatus.Issued);
  });

  describe('when using external account based identities', () => {
    it('can add a verification', async () => {
      const oldLength = (await verifications.getVerifications(accounts[1], '/company')).length;
      await timeout(5000);
      const verificationId = await verifications.setVerification(accounts[0], accounts[1], '/company');
      await timeout(5000);
      expect(verificationId).to.be.ok;
      const verificationsForAccount = await verifications.getVerifications(accounts[1], '/company');
      expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
      expect(verificationsForAccount[oldLength]).to.have.property('status', VerificationsStatus.Issued);
    });

    it('can add a verification with specific data', async () => {
      const oldLength = (await verifications.getVerifications(accounts[1], '/company')).length;
      await verifications.setVerification(accounts[0], accounts[1], '/company', null, {foo: 'bar'});
      const verificationsForAccount = await verifications.getVerifications(accounts[1], '/company');
      expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
      expect(verificationsForAccount[oldLength]).to.have.property(
        'uri',
        'https://ipfs.test.evan.network/ipfs/Qmbjig3cZbUUufWqCEFzyCppqdnmQj3RoDjJWomnqYGy1f',
      );
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
      expect(verificationsForAccount[oldLength]).to.have.property('status', VerificationsStatus.Issued);
    });

    it('can add subverification paths', async () => {
      const oldLength = (await verifications.getVerifications(accounts[1], '/company/b-s-s/employee/swo3')).length;
      await verifications.setVerification(accounts[0], accounts[0], '/company');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s/employee');
      await verifications.setVerification(accounts[0], accounts[1], '/company/b-s-s/employee/swo3');
      const verificationsForAccount = await verifications.getVerifications(accounts[1], '/company/b-s-s/employee/swo3');
      expect(verificationsForAccount).to.have.lengthOf(1);
      expect(verificationsForAccount[oldLength]).to.have.property('status', VerificationsStatus.Issued);
    });

    it('can confirm a subverification paths with the subject user', async () => {
      const oldLength = (await verifications.getVerifications(accounts[1], '/company/b-s-s/employee/swo4')).length;
      await verifications.setVerification(accounts[0], accounts[0], '/company');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s/employee');
      const verificationId = await verifications.setVerification(accounts[0], accounts[1], '/company/b-s-s/employee/swo4');
      await verifications.confirmVerification(accounts[1], accounts[1], verificationId);
      const verificationsForAccount = await verifications.getVerifications(accounts[1], '/company/b-s-s/employee/swo4');
      expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
      expect(verificationsForAccount[oldLength]).to.have.property('status', VerificationsStatus.Confirmed);
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

    it('can reject a subverification paths with the subject user', async () => {
      await verifications.setVerification(accounts[0], accounts[0], '/company');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s/employee');
      await timeout(5000);
      const verificationId = await verifications.setVerification(accounts[0], accounts[1], '/company/b-s-s/employee/swo6');
      await timeout(5000);
      await verifications.deleteVerification(accounts[1], accounts[1], verificationId);
      const verificationsForAccount = await verifications.getVerifications(accounts[1], '/company/b-s-s/employee/swo6');
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
      await verifications.setVerificationDescription(accounts[0], sampleVerificationTopic, sampleVerificationsDomain, sampleDescription);
      await verifications.setVerification(accounts[0], accounts[1], sampleVerificationTopic, null, null, sampleVerificationsDomain);
      const verificationsForAccount = await verifications.getVerifications(accounts[1], sampleVerificationTopic);
      const last = verificationsForAccount.length - 1;
      expect(verificationsForAccount[last]).to.have.property('status', VerificationsStatus.Issued);
      expect(verificationsForAccount[last]).to.have.property('creationBlock');
      expect(verificationsForAccount[last].description).to.deep.eq(sampleDescription);
    });

    it('can reject a verification', async () => {
      const oldLength = (await verifications.getVerifications(accounts[1], '/company/b-s-s/employee/swo4')).length;
      await verifications.setVerification(accounts[0], accounts[0], '/company');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s/employee');
      const verificationId = await verifications.setVerification(accounts[0], accounts[1], '/company/b-s-s/employee/swo4');
      await verifications.rejectVerification(accounts[1], accounts[1], verificationId);
      const verificationsForAccount = await verifications.getVerifications(accounts[1], '/company/b-s-s/employee/swo4');
      expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
      expect(verificationsForAccount[oldLength]).to.have.property('status', VerificationsStatus.Rejected);
    });

    it('can reject a verification with a reason', async () => {
      const oldLength = (await verifications.getVerifications(accounts[1], '/company/b-s-s/employee/swo4')).length;
      await verifications.setVerification(accounts[0], accounts[0], '/company');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s/employee');
      await timeout(5000);
      const verificationId = await verifications.setVerification(accounts[0], accounts[1], '/company/b-s-s/employee/swo4');
      await timeout(5000);
      await verifications.rejectVerification(accounts[1], accounts[1], verificationId, { reason: 'denied' });
      await timeout(5000);
      const verificationsForAccount = await verifications.getVerifications(accounts[1], '/company/b-s-s/employee/swo4');
      expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
      expect(verificationsForAccount[oldLength]).to.have.property('status', VerificationsStatus.Rejected);
      expect(verificationsForAccount[oldLength]).to.have.deep.property('rejectReason', { reason: 'denied' });
    });

    it('can reject a verification with a reason from the issuer side', async () => {
      const oldLength = (await verifications.getVerifications(accounts[1], '/company/b-s-s/employee/swo4')).length;
      await verifications.setVerification(accounts[0], accounts[0], '/company');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s/employee');
      const verificationId = await verifications.setVerification(accounts[0], accounts[1], '/company/b-s-s/employee/swo4');
      await verifications.rejectVerification(accounts[0], accounts[1], verificationId, { reason: 'denied' });
      const verificationsForAccount = await verifications.getVerifications(accounts[1], '/company/b-s-s/employee/swo4');
      expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
      expect(verificationsForAccount[oldLength]).to.have.property('status', VerificationsStatus.Rejected);
      expect(verificationsForAccount[oldLength]).to.have.deep.property('rejectReason', { reason: 'denied' });
    });

    it('can not re accept a rejected verification', async () => {
      const oldLength = (await verifications.getVerifications(accounts[1], '/company/b-s-s/employee/swo4')).length;
      await verifications.setVerification(accounts[0], accounts[0], '/company');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s/employee');
      const verificationId = await verifications.setVerification(accounts[0], accounts[1], '/company/b-s-s/employee/swo4');
      await verifications.rejectVerification(accounts[1], accounts[1], verificationId);
      const reacceptedP = verifications.confirmVerification(accounts[1], accounts[1], verificationId);
      await expect(reacceptedP).to.be.rejected;
    });

    describe('when validating nested verifications', () => {
      function getRandomTopic(prefix: string) {
        return `${ prefix }/${ Date.now().toString() + Math.random().toString().slice(2, 20) }`;
      }

      it('verifications for a subject that has no identity should include the warning "noIdentity"', async () => {
        let topic = getRandomTopic('/evan'), computed;

        // check missing state
        computed = await verifications.getComputedVerification(accounts[2], topic);
        await expect(computed.status).to.be.eq(-1);
        await expect(computed.warnings).to.include('noIdentity');
        await expect(computed.verifications[0].subjectType).to.be.eq('account');
      });

      it('non existing verifications include the warning "missing" and status should be -1', async () => {
        let topic = getRandomTopic('/evan'), computed;

        // check missing state
        computed = await verifications.getComputedVerification(accounts[0], topic);
        await expect(computed.status).to.be.eq(-1);
        await expect(computed.warnings).to.include('missing');

        // check missing state is missing after set
        await verifications.setVerification(accounts[0], accounts[0], topic);
        computed = await verifications.getComputedVerification(accounts[0], topic);
        await expect(computed.status).to.be.eq(0);
        await expect(computed.warnings).to.not.include('missing');
      });

      it('verifications with status 0 should have warning "issued"', async () => {
        let topic = getRandomTopic('/evan'), computed;

        // check issued case
        await verifications.setVerification(accounts[0], accounts[1], topic);
        computed = await verifications.getComputedVerification(accounts[1], topic);
        await expect(computed.status).to.be.eq(0);
        await expect(computed.warnings).to.include('issued');

        // test issued is missing after confirm
        await verifications.confirmVerification(accounts[1], accounts[1],
          computed.verifications[0].id);
        computed = await verifications.getComputedVerification(accounts[1], topic);
        await expect(computed.warnings).to.not.include('issued');
      });

      it('expired verifications should have warning "expired"', async () => {
        const topic = getRandomTopic('/evan');
        const before = Math.floor(Date.now() / 1000);
        await verifications.setVerification(accounts[0], accounts[1], topic, before);
        const computed = await verifications.getComputedVerification(accounts[1], topic);
        await expect(computed.status).to.be.eq(0);
        await expect(computed.warnings).to.include('expired');
      });

      it('verifications that are created by the same user should have warning "selfIssued"', async () => {
        let topic = getRandomTopic('/evan'), computed;

        // check issued case
        await verifications.setVerification(accounts[0], accounts[0], topic);
        computed = await verifications.getComputedVerification(accounts[0], topic);
        await expect(computed.status).to.be.eq(0);
        await expect(computed.warnings).to.include('selfIssued');
      });

      it('verifications with an missing parent should have the warning "parentMissing"', async () => {
        let computed;
        let topicParent = getRandomTopic('');
        let topic = getRandomTopic(topicParent);

        // check issued case
        await verifications.setVerification(accounts[0], accounts[1], topic);
        computed = await verifications.getComputedVerification(accounts[1], topic);
        await expect(computed.warnings).to.include('parentMissing');

        await verifications.setVerification(accounts[0], accounts[0], topicParent);
        computed = await verifications.getComputedVerification(accounts[1], topic);
        await expect(computed.warnings).to.not.include('parentMissing');
      });

      it('verifications with an untrusted parent should have the warning "parentUntrusted"', async () => {
        let computed;
        let topicParent = getRandomTopic('/evan');
        let topic = getRandomTopic(topicParent);

        // check issued case
        await verifications.setVerification(accounts[0], accounts[1], topic);
        await verifications.setVerification(accounts[0], accounts[0], topicParent);
        computed = await verifications.getComputedVerification(accounts[1], topic);
        await expect(computed.warnings).to.include('parentUntrusted');
      });

      it('verifications with the base "/evan" should be issued by the evan root account', async () => {
        let computed;
        let topic = '/evan';

        // check issued case
        await verifications.setVerification(accounts[0], accounts[1], topic);
        computed = await verifications.getComputedVerification(accounts[1], topic);
        await expect(computed.warnings).to.include('notEnsRootOwner');
      });

      it('sub verifications, where the parent verifications has the property has ' +
        '"disableSubVerifications" should be not valid',
      async () => {
        let parentTopic = getRandomTopic('');
        let topic = getRandomTopic(parentTopic);

        // check issued case
        await verifications.setVerification(accounts[0], accounts[0], parentTopic, null, null, null, true);
        await verifications.setVerification(accounts[0], accounts[1], topic);

        // load parent verifications and computed from child
        const parentComputed = await verifications.getComputedVerification(accounts[0], parentTopic);
        const computed = await verifications.getComputedVerification(accounts[1], topic);

        await expect(parentComputed.disableSubVerifications).to.be.eq(true);
        await expect(computed.warnings).to.include('disableSubVerifications');
      });
    });
  });

  describe('when using identities for contracts', () => {
    let verificationsRegistry;
    let contractId;

    before(async () => {
      verificationsRegistry = await executor.createContract(
        'VerificationsRegistry', [], { from: accounts[2], gas: 8000000 });
      verifications.contracts.registry = verificationsRegistry;
    });

    it('can create a new identity for a contract', async() => {
      const businessCenterDomain = nameResolver.getDomainName(config.nameResolver.domains.businessCenter);
      contractId = await baseContract.createUninitialized(
        'testdatacontract',
        accounts[0],
        businessCenterDomain,
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
      const identity = await verifications.createIdentity(accounts[0], contractId);
      expect(identity).to.match(/0x[0-9-a-f]{64}/i);
    });

    it('can add a verification', async () => {
      const oldLength = (await verifications.getVerifications(contractId, '/company')).length;
      await verifications.setVerification(accounts[0], contractId, '/company');
      const verificationsForAccount = await verifications.getVerifications(contractId, '/company');
      expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
      expect(verificationsForAccount[oldLength]).to.have.property('status', VerificationsStatus.Issued);
    });

    it('can add a verification from an account that is not the owner of the contract', async () => {
      const oldLength = (await verifications.getVerifications(contractId, '/company')).length;
      await verifications.setVerification(accounts[1], contractId, '/company');
      const verificationsForAccount = await verifications.getVerifications(contractId, '/company');
      expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
      expect(verificationsForAccount[oldLength]).to.have.property('status', VerificationsStatus.Issued);
    });

    it('can add a verification with specific data', async () => {
      const oldLength = (await verifications.getVerifications(contractId, '/company')).length;
      await verifications.setVerification(accounts[0], contractId, '/company', null, {foo: 'bar'});
      await timeout(5000);
      const verificationsForAccount = await verifications.getVerifications(contractId, '/company');
      expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
      expect(verificationsForAccount[oldLength]).to.have.property(
        'uri',
        'https://ipfs.test.evan.network/ipfs/Qmbjig3cZbUUufWqCEFzyCppqdnmQj3RoDjJWomnqYGy1f',
      );
    });

    it('can add a verification with specific expirationDate', async () => {
      const oldLength = (await verifications.getVerifications(contractId, '/company')).length;
      const now = Math.floor(Date.now() / 1000);
      await verifications.setVerification(accounts[0], contractId, '/company', now);
      const verificationsForAccount = await verifications.getVerifications(contractId, '/company');
      expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
      expect(verificationsForAccount[oldLength]).to.have.property('expirationDate', now.toString());
    });

    it('can add a verification and validate the integrity', async () => {
      const oldLength = (await verifications.getVerifications(contractId, '/company')).length;
      await timeout(5000);
      await verifications.setVerification(accounts[0], contractId, '/company');
      await timeout(5000);
      const verificationsForAccount = await verifications.getVerifications(contractId, '/company');
      expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
      await verifications.validateVerification(contractId, verificationsForAccount[oldLength].id);
      expect(verificationsForAccount[oldLength]).to.have.property('status', VerificationsStatus.Issued);
    });

    it('can add subverification paths', async () => {
      const oldLength = (await verifications.getVerifications(contractId, '/company/b-s-s/employee/swo3')).length;
      await verifications.setVerification(accounts[0], accounts[0], '/company');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s/employee');
      await verifications.setVerification(accounts[0], contractId, '/company/b-s-s/employee/swo3');
      const verificationsForAccount = await verifications.getVerifications(contractId, '/company/b-s-s/employee/swo3');
      expect(verificationsForAccount).to.have.lengthOf(1);
      expect(verificationsForAccount[oldLength]).to.have.property('status', VerificationsStatus.Issued);
    });

    it('can confirm a subverification paths with the subject user', async () => {
      const oldLength = (await verifications.getVerifications(contractId, '/company/b-s-s/employee/swo4')).length;
      await verifications.setVerification(accounts[0], accounts[0], '/company');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s/employee');
      const verificationId = await verifications.setVerification(accounts[0], contractId, '/company/b-s-s/employee/swo4');
      await verifications.confirmVerification(accounts[0], contractId, verificationId);
      const verificationsForAccount = await verifications.getVerifications(contractId, '/company/b-s-s/employee/swo4');
      expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
      expect(verificationsForAccount[oldLength]).to.have.property('status', VerificationsStatus.Confirmed);
    });

    it('can reject a subverification paths with the subject user', async () => {
      await verifications.setVerification(accounts[0], accounts[0], '/company');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s/employee');
      const verificationId = await verifications.setVerification(accounts[0], contractId, '/company/b-s-s/employee/swo6');
      await verifications.deleteVerification(accounts[0], contractId, verificationId);
      const verificationsForAccount = await verifications.getVerifications(contractId, '/company/b-s-s/employee/swo6');
      expect(verificationsForAccount).to.have.lengthOf(0);
    });

    it('can track the creation date', async() => {
      const before = Math.floor(Date.now() / 1000);
      await verifications.setVerification(accounts[0], contractId, '/company');
      const after = Math.floor(Date.now() / 1000);
      const verificationsForAccount = await verifications.getVerifications(contractId, '/company');
      const last = verificationsForAccount.length - 1;
      expect(verificationsForAccount[last]).to.have.property('status', VerificationsStatus.Issued);
      expect(verificationsForAccount[last]).to.have.property('creationDate');
      expect(parseInt(verificationsForAccount[last].creationDate, 10)).to.be.gte(before);
      expect(parseInt(verificationsForAccount[last].creationDate, 10)).to.be.lte(after);
    });

    it('can track the expiration date and the expired flag is set correctly', async() => {
      const before = Math.floor(Date.now() / 1000);
      await verifications.setVerification(accounts[0], contractId, '/company', before);
      const after = Math.floor(Date.now() / 1000);
      const verificationsForAccount = await verifications.getVerifications(contractId, '/company');
      const last = verificationsForAccount.length - 1;
      expect(verificationsForAccount[last]).to.have.property('status', VerificationsStatus.Issued);
      expect(verificationsForAccount[last]).to.have.property('expirationDate');
      expect(parseInt(verificationsForAccount[last].expirationDate, 10)).to.be.eq(before);
      expect(parseInt(verificationsForAccount[last].expirationDate, 10)).to.be.lte(after);
      expect(verificationsForAccount[last].expired).to.be.eq(true);
    });

    it('can track the creation block', async() => {
      const before = await web3.eth.getBlockNumber();
      await verifications.setVerification(accounts[0], contractId, '/company');
      const after = await web3.eth.getBlockNumber();
      const verificationsForAccount = await verifications.getVerifications(contractId, '/company');
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
      await verifications.setVerificationDescription(accounts[0], sampleVerificationTopic, sampleVerificationsDomain, sampleDescription);
      await verifications.setVerification(accounts[0], contractId, sampleVerificationTopic, null, null, sampleVerificationsDomain);
      const verificationsForAccount = await verifications.getVerifications(contractId, sampleVerificationTopic);
      const last = verificationsForAccount.length - 1;
      expect(verificationsForAccount[last]).to.have.property('status', VerificationsStatus.Issued);
      expect(verificationsForAccount[last]).to.have.property('creationBlock');
      expect(verificationsForAccount[last].description).to.deep.eq(sampleDescription);
    });

    it('can reject a verification', async () => {
      const oldLength = (await verifications.getVerifications(contractId, '/company/b-s-s/employee/swo4')).length;
      await verifications.setVerification(accounts[0], accounts[0], '/company');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s/employee');
      const verificationId = await verifications.setVerification(accounts[0], contractId, '/company/b-s-s/employee/swo4');
      await verifications.rejectVerification(accounts[0], contractId, verificationId);
      const verificationsForAccount = await verifications.getVerifications(contractId, '/company/b-s-s/employee/swo4');
      expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
      expect(verificationsForAccount[oldLength]).to.have.property('status', VerificationsStatus.Rejected);
    });

    it('can reject a verification with a reason', async () => {
      const oldLength = (await verifications.getVerifications(contractId, '/company/b-s-s/employee/swo4')).length;
      await verifications.setVerification(accounts[0], accounts[0], '/company');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s/employee');
      await timeout(5000);
      const verificationId = await verifications.setVerification(accounts[0], contractId, '/company/b-s-s/employee/swo4');
      await timeout(5000);
      await verifications.rejectVerification(accounts[0], contractId, verificationId, { reason: 'denied' });
      await timeout(5000);
      const verificationsForAccount = await verifications.getVerifications(contractId, '/company/b-s-s/employee/swo4');
      expect(verificationsForAccount).to.have.lengthOf(oldLength + 1);
      expect(verificationsForAccount[oldLength]).to.have.property('status', VerificationsStatus.Rejected);
      expect(verificationsForAccount[oldLength]).to.have.deep.property('rejectReason', { reason: 'denied' });
    });

    it('can not re accept a rejected verification', async () => {
      const oldLength = (await verifications.getVerifications(contractId, '/company/b-s-s/employee/swo4')).length;
      await verifications.setVerification(accounts[0], accounts[0], '/company');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s/employee');
      const verificationId = await verifications.setVerification(accounts[0], contractId, '/company/b-s-s/employee/swo4');
      await verifications.rejectVerification(accounts[0], contractId, verificationId);
      const reacceptedP = verifications.confirmVerification(accounts[0], contractId, verificationId);
      await expect(reacceptedP).to.be.rejected;
    });

    it('cannot have other users approve verifications of a contract of another user', async () => {
      const oldLength = (await verifications.getVerifications(contractId, '/company/b-s-s/employee/swo4')).length;
      await verifications.setVerification(accounts[0], accounts[0], '/company');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s');
      await verifications.setVerification(accounts[0], accounts[0], '/company/b-s-s/employee');
      const verificationId = await verifications.setVerification(accounts[0], contractId, '/company/b-s-s/employee/swo4');
      await expect(verifications.confirmVerification(accounts[1], contractId, verificationId)).to.be.rejected;
    });

    it('does not return verification data, when identity and contract id mismatch', async () => {
      const businessCenterDomain = nameResolver.getDomainName(config.nameResolver.domains.businessCenter);
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
        const contractVerifications = await verifications.getVerifications(localContractId, '/company');
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

    describe('when validating nested verifications', () => {
      function getRandomTopic(prefix: string) {
        return `${ prefix }/${ Date.now().toString() + Math.random().toString().slice(2, 20) }`;
      }

      it('verifications for a subject that has no identity should include the warning "noIdentity"', async () => {
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
        computed = await verifications.getComputedVerification(contractIdWithoutIdentity, topic);
        await expect(computed.status).to.be.eq(-1);
        await expect(computed.warnings).to.include('noIdentity');
        await expect(computed.verifications[0].subjectType).to.be.eq('contract');
      });

      it('non existing verifications include the warning "missing" and status should be -1', async () => {
        let topic = getRandomTopic('/evan'), computed;

        // check missing state
        computed = await verifications.getComputedVerification(contractId, topic);
        await expect(computed.status).to.be.eq(-1);
        await expect(computed.warnings).to.include('missing');

        // check missing state is missing after set
        await verifications.setVerification(accounts[0], contractId, topic);
        computed = await verifications.getComputedVerification(contractId, topic);
        await expect(computed.status).to.be.eq(0);
        await expect(computed.warnings).to.not.include('missing');
      });

      it('verifications with status 0 should have warning "issued"', async () => {
        let topic = getRandomTopic('/evan'), computed;

        // check issued case
        await verifications.setVerification(accounts[0], contractId, topic);
        computed = await verifications.getComputedVerification(contractId, topic);
        await expect(computed.status).to.be.eq(0);
        await expect(computed.warnings).to.include('issued');

        // test issued is missing after confirm
        await verifications.confirmVerification(accounts[0], contractId,
          computed.verifications[0].id);
        computed = await verifications.getComputedVerification(contractId, topic);
        await expect(computed.warnings).to.not.include('issued');
      });

      it('expired verifications should have warning "expired"', async () => {
        const topic = getRandomTopic('/evan');
        const before = Math.floor(Date.now() / 1000);
        await verifications.setVerification(accounts[0], contractId, topic, before);
        const computed = await verifications.getComputedVerification(contractId, topic);
        await expect(computed.status).to.be.eq(0);
        await expect(computed.warnings).to.include('expired');
      });

      it('verifications with an missing parent should have the warning "parentMissing"', async () => {
        let computed;
        let topicParent = getRandomTopic('');
        let topic = getRandomTopic(topicParent);

        // check issued case
        await verifications.setVerification(accounts[0], contractId, topic);
        computed = await verifications.getComputedVerification(contractId, topic);
        await expect(computed.warnings).to.include('parentMissing');

        await verifications.setVerification(accounts[0], accounts[0], topicParent);
        computed = await verifications.getComputedVerification(contractId, topic);
        await expect(computed.warnings).to.not.include('parentMissing');
      });

      it('verifications with an untrusted parent should have the warning "parentUntrusted"', async () => {
        let computed;
        let topicParent = getRandomTopic('/evan');
        let topic = getRandomTopic(topicParent);

        // check issued case
        await verifications.setVerification(accounts[0], contractId, topic);
        await verifications.setVerification(accounts[0], accounts[0], topicParent);
        computed = await verifications.getComputedVerification(contractId, topic);
        await expect(computed.warnings).to.include('parentUntrusted');
      });

      it('verifications with the base "/evan" should be issued by the evan root account', async () => {
        let computed;
        let topic = '/evan';

        // check issued case
        await verifications.setVerification(accounts[0], contractId, topic);
        computed = await verifications.getComputedVerification(contractId, topic);
        await expect(computed.warnings).to.include('notEnsRootOwner');
      });

      it('sub verifications, where the parent verifications has the property has ' +
        '"disableSubVerifications" should be not valid',
      async () => {
        let parentTopic = getRandomTopic('');
        let topic = getRandomTopic(parentTopic);

        // check issued case
        await verifications.setVerification(accounts[0], accounts[0], parentTopic, null, null, null, true);
        await verifications.setVerification(accounts[0], contractId, topic);

        // load parent verifications and computed from child
        const parentComputed = await verifications.getComputedVerification(accounts[0], parentTopic);
        const computed = await verifications.getComputedVerification(contractId, topic);

        await expect(parentComputed.disableSubVerifications).to.be.eq(true);
        await expect(computed.warnings).to.include('disableSubVerifications');
      });
    });
  });
});

