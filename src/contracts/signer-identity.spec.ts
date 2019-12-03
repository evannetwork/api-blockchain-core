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
import BigNumber = require('bignumber.js');
import chaiAsPromised = require('chai-as-promised');
import { expect, use } from 'chai';
import {
  ContractLoader,
  CryptoInfo,
  DfsInterface,
  Executor,
  KeyProvider,
  SignerInternal,
} from '@evan.network/dbcp';

import { accounts } from '../test/accounts';
import { TestUtils } from '../test/test-utils';
import {
  CryptoProvider,
  Ipfs,
  Ipld,
  Mailbox,
  NameResolver,
  Profile,
  SignerIdentity,
  Verifications,
} from '../index';


use(chaiAsPromised);

describe('signer-identity (identity based signer)', function() {
  this.timeout(300000);

  let contractLoader: ContractLoader;
  let dfs: DfsInterface;
  let executor: Executor;
  let signer: SignerIdentity;
  let web3: any;

  before(async () => {
    web3 = TestUtils.getWeb3();

    const contracts = await TestUtils.getContracts();
    contractLoader =  new ContractLoader({
      contracts,
      web3,
    });
    const accountStore = TestUtils.getAccountStore({});
    const verifications = await TestUtils.getVerifications(web3, await TestUtils.getIpfs());
    const underlyingSigner = new SignerInternal({
      accountStore,
      contractLoader,
      config: {},
      web3,
    });
    signer = new SignerIdentity(
      {
        contractLoader,
        verifications,
        web3,
      },
      {
        activeIdentity: await verifications.getIdentityForAccount(accounts[3], true),
        underlyingAccount: accounts[3],
        underlyingSigner,
      },
    );
    executor = new Executor(
      { config: { alwaysAutoGasLimit: 1.1 }, signer: signer, web3 });
    await executor.init({ eventHub: await TestUtils.getEventHub(web3) });

  });

  describe('when making transaction with underlying accountId', () => {
    it('can create a new contract', async () => {
      const randomString = Math.floor(Math.random() * 1e12).toString(36);
      const contract = await executor.createContract(
        'TestContract', [randomString], { from: signer.underlyingAccount, gas: 1e6 });
      expect(await executor.executeContractCall(contract, 'data')).to.eq(randomString);
    });

    it('can create expensive contracts', async () => {
      const randomString = Math.floor(Math.random() * 1e12).toString(36);
      const contractPromise = executor.createContract(
        'HugeContract', [randomString], { from: signer.underlyingAccount, gas: 12e6 });
      await expect(contractPromise).not.to.be.rejected;
      expect(await executor.executeContractCall(await contractPromise, 'data')
      ).to.eq(randomString);
    });

    it('can make transactions on contracts', async () => {
      const contract = await executor.createContract(
        'TestContract', [''], { from: signer.underlyingAccount, gas: 1e6 });

      const randomString = Math.floor(Math.random() * 1e12).toString(36);
      await executor.executeContractTransaction(
        contract, 'setData', { from: signer.underlyingAccount }, randomString);
      expect(await executor.executeContractCall(contract, 'data')).to.eq(randomString);
    });

    it('can send funds', async () => {
      const amountToSend = Math.floor(Math.random() * 1e3);
      const balanceBefore = new BigNumber(await web3.eth.getBalance(accounts[1]));
      await executor.executeSend(
        { from: signer.underlyingAccount, to: accounts[1], gas: 10e6, value: amountToSend });
      const balanceAfter = new BigNumber(await web3.eth.getBalance(accounts[1]));
      const diff = balanceAfter.minus(balanceBefore);
      expect(diff.eq(new BigNumber(amountToSend))).to.be.true;
    });

    it('can sign messages', async () => {
      const randomString = Math.floor(Math.random() * 1e12).toString(36);
      const signed = await signer.signMessage(signer.underlyingAccount, randomString);
      const recovered = web3.eth.accounts.recover(randomString, signed);
      expect(recovered).to.eq(signer.underlyingAccount);
    });
  });

  describe('when making transaction with given identity', () => {
    describe('when performing transactions on contract', () => {
      it('can create a new contract', async () => {
        const randomString = Math.floor(Math.random() * 1e12).toString(36);
        const contract = await executor.createContract(
          'TestContract', [randomString], { from: signer.activeIdentity, gas: 1e6 });
        expect(await executor.executeContractCall(contract, 'data')).to.eq(randomString);
      });

      it('can create expensive contracts', async () => {
        const randomString = Math.floor(Math.random() * 1e12).toString(36);
        const contractPromise = executor.createContract(
          'HugeContract', [randomString], { from: signer.activeIdentity, gas: 1e6 });
        await expect(contractPromise).not.to.be.rejected;
        expect(await executor.executeContractCall(await contractPromise, 'data')
        ).to.eq(randomString);
      });

      it('can make transactions on contracts', async () => {
        const contract = await executor.createContract(
          'TestContract', [''], { from: signer.activeIdentity, gas: 1e6 });

        const randomString = Math.floor(Math.random() * 1e12).toString(36);
        await executor.executeContractTransaction(
          contract, 'setData', { from: signer.activeIdentity }, randomString);
        expect(await executor.executeContractCall(contract, 'data')).to.eq(randomString);
      });

      it('can make transactions on multiple contracts', async () => {
        const runOneTest = async () => {
          const contract = await executor.createContract(
            'TestContract', [''], { from: signer.activeIdentity, gas: 1e6 });
          const randomString = Math.floor(Math.random() * 1e12).toString(36);
          await executor.executeContractTransaction(
            contract, 'setData', { from: signer.activeIdentity }, randomString);
          expect(await executor.executeContractCall(contract, 'data')).to.eq(randomString);
        };
        await Promise.all([...Array(10)].map(() => runOneTest()));
      });

      it('can execute multiple transactions in parallel', async () => {
        const runOneTest = async () => {
          const contract = await executor.createContract(
            'TestContract', [''], { from: signer.activeIdentity, gas: 1e6 });
          const randomString = Math.floor(Math.random() * 1e12).toString(36);
          await executor.executeContractTransaction(
            contract, 'setData', { from: signer.activeIdentity }, randomString);
        };
        await Promise.all([...Array(10)].map(() => runOneTest()));
      });

      it('can create multiple contracts in parallel', async () => {
        const runOneTest = async () => {
          const contract = await executor.createContract(
            'TestContract', [''], { from: signer.activeIdentity, gas: 1e6 });
          expect(contract).to.be.an('Object');
          return contract;
        };
        const contractList = await Promise.all([...Array(10)].map(() => runOneTest()));
        expect(contractList).to.be.an('array');
      });
    });

    describe('when handling events', () => {
      it('can handle events in contract transactions', async () => {
        const contract = await executor.createContract(
          'TestContractEvent', [''], { from: signer.activeIdentity, gas: 1e6 });

        const randomString = Math.floor(Math.random() * 1e12).toString(36);
        const eventValue = await executor.executeContractTransaction(
          contract,
          'fireStringEvent',
          {
            from: signer.activeIdentity,
            event: {
              target: 'TestContractEvent',
              eventName: 'StringEvent',
            },
            getEventResult: (_, args) => args.text,
          },
          randomString,
        );
        expect(eventValue).to.eq(randomString);
      });

      it('can handle events in parallel transactions', async () => {
        const runOneTest = async () => {
          const contract = await executor.createContract(
            'TestContractEvent', [''], { from: signer.activeIdentity, gas: 1e6 });

          const randomString = Math.floor(Math.random() * 1e12).toString(36);
          const eventValue = await executor.executeContractTransaction(
            contract,
            'fireStringEvent',
            {
              from: signer.activeIdentity,
              event: {
                target: 'TestContractEvent',
                eventName: 'StringEvent',
              },
              getEventResult: (_, args) => args.text,
            },
            randomString,
          );
          expect(eventValue).to.eq(randomString);
        };
        await expect(Promise.all([...Array(10)].map(() => runOneTest())))
          .not.to.be.rejected;
      });
    });

    describe('when sending funds', () => {
      it('can send funds', async () => {
        const amountToSend = Math.floor(Math.random() * 1e3);
        const balanceBefore = new BigNumber(await web3.eth.getBalance(accounts[1]));
        await executor.executeSend(
          { from: signer.activeIdentity, to: accounts[1], gas: 100e3, value: amountToSend });
        const balanceAfter = new BigNumber(await web3.eth.getBalance(accounts[1]));
        const diff = balanceAfter.minus(balanceBefore);
        expect(diff.eq(new BigNumber(amountToSend))).to.be.true;
      });

      it('should reject transfer and balance of identity should remain same', async () => {
        const randomString = Math.floor(Math.random() * 1e12).toString(36);
        const contract = await executor.createContract(
          'TestContract', [randomString], { from: signer.activeIdentity, gas: 1e6 });
        expect(contract).to.be.a('Object');

        const amountToSend = Math.floor(Math.random() * 1e3);
        const balanceBefore = new BigNumber(await web3.eth.getBalance(signer.activeIdentity));
        await expect( executor.executeSend({
          from: signer.activeIdentity,
          to: contract.options.address,
          gas: 100e3,
          value: amountToSend,
        })).to.rejected;

        const balanceAfter = new BigNumber(await web3.eth.getBalance(signer.activeIdentity));
        expect(balanceAfter.eq(balanceBefore)).to.be.true;
      });

      it('should reject transfer and funds should deduct transfer fee in underlaying account',
        async () => {
          const randomString = Math.floor(Math.random() * 1e12).toString(36);
          const contract = await executor.createContract(
            'TestContract', [randomString], { from: signer.activeIdentity, gas: 1e6 });
          expect(contract).to.be.a('Object');

          const amountToSend = Math.floor(Math.random() * 1e3);

          const balanceBefore = new BigNumber(await web3.eth.getBalance(signer.underlyingAccount));

          await expect(executor.executeSend({
            from: signer.activeIdentity,
            to: contract.options.address,
            gas: 100e3,
            value: amountToSend,
          })).to.be.rejected;

          const balanceAfter = new BigNumber(await web3.eth.getBalance(signer.underlyingAccount));
          expect(balanceAfter.lt(balanceBefore)).to.be.true;
        }
      );

      it('should transfer funds to contract', async () => {
        const amountToSend = Math.floor(Math.random() * 1e3);
        const contract = await executor.createContract(
          'TestContract', [], { from: signer.activeIdentity, gas: 1e6 });
        expect(contract).to.be.a('Object');
        const balanceBefore = new BigNumber(await web3.eth.getBalance(contract.options.address));
        await executor.executeContractTransaction(
          contract, 'chargeFunds', { from: signer.activeIdentity, value: amountToSend });
        const balanceAfter = new BigNumber(await web3.eth.getBalance(contract.options.address));
        const diff = balanceAfter.minus(balanceBefore);
        expect(diff.eq(new BigNumber(amountToSend))).to.be.true;
        expect(balanceAfter.gt(balanceBefore)).to.be.true;
      });

      it('should reject fund transfer to contract without a fallback function', async () => {
        const randomString = Math.floor(Math.random() * 1e12).toString(36);
        const contract = await executor.createContract(
          'TestContract', [randomString], { from: signer.activeIdentity, gas: 1e6 });
        expect(contract).to.be.a('Object');

        const amountToSend = Math.floor(Math.random() * 1e3);
        const balanceBefore = new BigNumber(await web3.eth.getBalance(contract.options.address));
        await expect( executor.executeSend({
          from: signer.activeIdentity,
          to: contract.options.address,
          gas: 100e3,
          value: amountToSend,
        })).to.be.rejected;

        const balanceAfter = new BigNumber(await web3.eth.getBalance(contract.options.address));
        expect(balanceAfter.eq(balanceBefore)).to.be.true;
      });

      it('should perform fund transfer to contract with a fallback function, e.g. identities',
        async () => {
          const amountToSend = Math.floor(Math.random() * 1e3);
          const balanceBefore = new BigNumber(await web3.eth.getBalance(signer.activeIdentity));
          await executor.executeSend({
            from: signer.underlyingAccount,
            to: signer.activeIdentity,
            gas: 100e3,
            value: amountToSend,
          });
          const balanceAfter = new BigNumber(await web3.eth.getBalance(signer.activeIdentity));
          const diff = balanceAfter.minus(balanceBefore);
          expect(diff.eq(new BigNumber(amountToSend))).to.be.true;
        }
      );

      it('should reject fund transfer to new contract and funds should stay with identity ',
        async () => {
          const randomString = Math.floor(Math.random() * 1e12).toString(36);
          const contract = await executor.createContract(
            'TestContract', [randomString], { from: signer.activeIdentity, gas: 1e6 });
          expect(contract).to.be.a('Object');

          const amountToSend = Math.floor(Math.random() * 1e3);
          const balanceBefore = new BigNumber(await web3.eth.getBalance(signer.activeIdentity));
          await expect( executor.executeSend({
            from: signer.activeIdentity,
            to: contract.options.address,
            gas: 100e3,
            value: amountToSend,
          })).to.be.rejected;

          const balanceAfter = new BigNumber(await web3.eth.getBalance(signer.activeIdentity));
          expect(balanceAfter.eq(balanceBefore)).to.be.true;
        }
      );
    });

    describe('when signing messages', () => {
      it('cannot sign messages', async () => {
        const randomString = Math.floor(Math.random() * 1e12).toString(36);
        const signPromise = signer.signMessage(signer.activeIdentity, randomString);
        await expect(signPromise)
          .to.be.rejectedWith('signing messages with identities is not supported');
      });
    });
  });

  describe('when dealing with encryption for identity based accounts', async () => {
    let cryptoProvider: CryptoProvider;
    let identityAddress: string;
    let keyProvider: KeyProvider;
    let nameResolver: NameResolver;
    let profile: Profile;
    let verifications: Verifications;
    let web3: any;

    before(async () => {
      web3 = await TestUtils.getWeb3();
      nameResolver = await TestUtils.getNameResolver(web3);
      dfs = await TestUtils.getIpfs();
      verifications = await TestUtils.getVerifications(web3, dfs);
      cryptoProvider = TestUtils.getCryptoProvider(dfs);

      identityAddress = await verifications.getIdentityForAccount(accounts[3], true);

      const sha9Key = nameResolver.soliditySha3(
        ...(await Promise.all(
          [identityAddress, identityAddress].map(accountId =>
            nameResolver.soliditySha3(accountId))
        )));
      keyProvider = await TestUtils.getKeyProvider();
      (keyProvider as any).keys[sha9Key] = '483257531bc9456ea783e44d325f8a384a4b89da81dac00e589409431692f218';
      (keyProvider as any).keys[nameResolver.soliditySha3(identityAddress)] = '483257531bc9456ea783e44d325f8a384a4b89da81dac00e589409431692f218';
      const ipld = new Ipld({
        ipfs: dfs as Ipfs,
        keyProvider,
        cryptoProvider,
        defaultCryptoAlgo: 'aes',
        originator: nameResolver.soliditySha3(accounts[3]),
        nameResolver,
      });

      // create profile instance, that is bound to identity
      const dataContract = await TestUtils.getDataContract(web3, dfs);
      (dataContract as any).options.executor = executor;
      executor.eventHub = await TestUtils.getEventHub(web3);
      profile = new Profile({
        accountId: identityAddress,
        contractLoader,
        cryptoProvider,
        dataContract,
        defaultCryptoAlgo: 'aes',
        dfs,
        description: await TestUtils.getDescription(web3),
        executor,
        ipld: ipld,
        nameResolver,
        rightsAndRoles: await TestUtils.getRightsAndRoles(web3),
        sharing: await TestUtils.getSharing(web3),
      });

      // keep code here as long as identity based profiles cannot be created in a more easy way...
      // console.log('sharing')
      // const ensName = nameResolver.getDomainName((nameResolver as any).config.domains.profile);
      // const address = await nameResolver.getAddress(ensName);
      // const indexContract =
      //   contractLoader.loadContract('ProfileIndexInterface', address);
      // const profileContractAddress = await executor.executeContractCall(
      //   indexContract, 'getProfile', identityAddress, { from: accounts[3], });
      // const profileDataContract = await contractLoader.loadContract(
      //   'DataContract', profileContractAddress);
      // const sharingsHash = await executor.executeContractCall(profileDataContract, 'sharing');
      // console.dir(sharingsHash);
      // const sharingData = await dfs.get(sharingsHash);
      // console.log(require('util').inspect(sharingData, { colors: true, depth: 16 }));
      // const updatedSharingData = '{"0x2f17103a20c21c65c8f6330761b93af4a72ad7faea76cba6aa8048783e942129":{"0x04994f67dc55b09e814ab7ffc8df3686b4afb2bb53e60eae97ef043fe03fb829":{"hashKey":{"private":"688c841f01db6d2995ea02139bf301cb360362a327294c0e995c2dcf0bf3f530ea04b671b2c4d1f1f289f74dbcade0e3357317a32a89bf5a39f85a70ce81c4c3f4580caf67520bbf99319950f0235b3bcb7a456ee9697f25fc4cc429676c0c48","cryptoInfo":{"originator":"0xd42644616207e5816e2de3ab153837db6148bd036794c06f73763074df41d2b5","keyLength":256,"algorithm":"aes-256-cbc"}}},"0x31c56d8d629ac68792a621f2f85af22618d00b5e5e5f228574590211bde67302":{"335193":{"private":"e5dbbe8f077bd60b7e320e86269e862a8833100bce405a56535350725870cff6dcf00f28a67a45befde886631e09ff722c4060915e6fbe11344e97e433e13b52c7cca0670e0cdfaa47c2cce2d0ac80d16969430c4276f609aa09b9f3dd0eaa67","cryptoInfo":{"originator":"0xd42644616207e5816e2de3ab153837db6148bd036794c06f73763074df41d2b5","keyLength":256,"algorithm":"aes-256-cbc"}}},"0xa05e33768da60583875bb5256189397d790c6a14f448460d366d44805586c6ee":{"335193":{"private":"f027a1585e8c520e4172dd3c9bc7bd92347e633666819fde09ed8483f03be02852c2775a495c32d10374861e8b8781ec3da76bda24264da92c30cf373abb731c238b9f126a0a6193b124be0f55ceb59bad4a78769febd3639dc0bfa7416f71c0","cryptoInfo":{"originator":"0xd42644616207e5816e2de3ab153837db6148bd036794c06f73763074df41d2b5","keyLength":256,"algorithm":"aes-256-cbc"}}}}}';
      // const updatedSharingHash = await dfs.add('sharing', Buffer.from(updatedSharingData, 'utf8'));
      // console.log('/sharing')
      // await executor.executeContractTransaction(
      //   profileDataContract, 'setSharing', { from: signer.activeIdentity }, updatedSharingHash);
    });

    it('should be able to encrypt and decrypt data', async () => {
      const sampleData = {
        foo: TestUtils.getRandomBytes32(),
        bar: Math.random(),
      };

      // build edge key for data shared between identity[0] and identity[1]
      const keyContext = nameResolver.soliditySha3(
        ...(await Promise.all(
          [accounts[3], accounts[1]].map(accountId =>
            verifications.getIdentityForAccount(accountId, true)))
        ).sort()
      );
      const cryptoInfo: CryptoInfo = {
        algorithm: 'aes-256-cbc',
        block: await web3.eth.getBlockNumber(),
        originator: keyContext,
      };

      // generate with custom logic, e.g. with the aes cryptor
      const cryptor = cryptoProvider.getCryptorByCryptoAlgo('aes');
      const encryptKey = await cryptor.generateKey();

      // encrypt files (key is pulled from profile)
      const encryptedData: Buffer = await cryptor.encrypt(sampleData, { key: encryptKey, });
      const encrypted = {
        cryptoInfo,
        private: encryptedData.toString('hex'),
      };

      expect(encrypted).to.haveOwnProperty('cryptoInfo');
      expect(encrypted).to.haveOwnProperty('private');

      const decryptKey = encryptKey;
      const decryptedObject = await cryptor.decrypt(Buffer.from(encrypted.private, 'hex'), { key: decryptKey, });
      expect(decryptedObject).to.deep.eq(sampleData);
    });

    it('should be able to encrypt and bound to a comm key', async () => {
      const sampleData = {
        foo: TestUtils.getRandomBytes32(),
        bar: Math.random(),
      };

      // build edge key for data shared between identity[0] and identity[1]
      const keyContext = nameResolver.soliditySha3(
        ...(await Promise.all(
          [accounts[3], accounts[1]].map(accountId =>
            verifications.getIdentityForAccount(accountId, true)))
        ).sort()
      );
      const cryptoInfo: CryptoInfo = {
        algorithm: 'aes-256-cbc',
        block: await web3.eth.getBlockNumber(),
        originator: keyContext,
      };

      // generate with custom logic, e.g. with the aes cryptor
      const cryptor = cryptoProvider.getCryptorByCryptoAlgo('aes');
      const encryptKey = await cryptor.generateKey();

      // store key in profile
      const contactIdentity = await verifications.getIdentityForAccount(accounts[1], true);
      // profile.activeAccount = accounts[3];
      await profile.loadForAccount(profile.treeLabels.addressBook);
      await profile.addContactKey(contactIdentity, 'commKey', encryptKey);
      // profile.activeAccount = identityAddress;
      await profile.storeForAccount(profile.treeLabels.addressBook);
      await profile.loadForAccount(profile.treeLabels.addressBook);

      // encrypt files (key is pulled from profile)
      const encryptedData: Buffer = await cryptor.encrypt(sampleData, { key: encryptKey, });
      const encrypted = {
        cryptoInfo,
        private: encryptedData.toString('hex'),
      };

      expect(encrypted).to.haveOwnProperty('cryptoInfo');
      expect(encrypted).to.haveOwnProperty('private');

      const decryptKey = await profile.getContactKey(contactIdentity, 'commKey');
      const decryptedObject = await cryptor.decrypt(Buffer.from(encrypted.private, 'hex'), { key: decryptKey, });
      expect(decryptedObject).to.deep.eq(sampleData);
    });

    it('should be to store data in an identity', async () => {
      // generate with custom logic, e.g. with the aes cryptor
      const cryptor = cryptoProvider.getCryptorByCryptoAlgo('aes');
      const encryptKey = await cryptor.generateKey();

      // store key in profile
      const contactIdentity = await verifications.getIdentityForAccount(accounts[1], true);
      await profile.loadForAccount(profile.treeLabels.addressBook);
      await profile.addContactKey(contactIdentity, 'commKey', encryptKey);
      await profile.storeForAccount(profile.treeLabels.addressBook);

      // load from on-chain profile
      await profile.loadForAccount(profile.treeLabels.addressBook);
      const retrieved = await profile.getContactKey(contactIdentity, 'commKey');

      expect(encryptKey).to.eq(retrieved);
    });

    it('should be able to send a mail', async () => {
      const random = Math.random();
      const getTestMail = () =>({
        content: {
          from: signer.activeIdentity,
          to: signer.activeIdentity,
          title: 'talking to myself',
          body: `hi, me. I like random numbers, for example ${random}`,
          attachments: [
            {
              type: 'sharedExchangeKey',
              key: ''
            }
          ]
        },
      });
      const startTime = Date.now();
      const mailbox: Mailbox = new Mailbox({
        contractLoader,
        cryptoProvider,
        defaultCryptoAlgo: 'aes',
        executor,
        ipfs: dfs as Ipfs,
        keyProvider,
        mailboxOwner: signer.activeIdentity,
        nameResolver,
      });
      await mailbox.sendMail(getTestMail(), signer.activeIdentity, signer.activeIdentity);
      const result = await mailbox.getMails(1, 0);
      const keys = Object.keys(result.mails);
      expect(keys.length).to.eq(1);
      expect(result.mails[keys[0]].content.sent).to.be.ok;
      expect(result.mails[keys[0]].content.sent).to.be.gt(startTime);
      expect(result.mails[keys[0]].content.sent).to.be.lt(Date.now());
      delete result.mails[keys[0]].content.sent;
      expect(result.mails[keys[0]].content).to.deep.eq(getTestMail().content);
    });
  });
});
