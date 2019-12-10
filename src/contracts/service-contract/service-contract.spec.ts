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

import { accounts } from '../../test/accounts';
import { Ipfs } from '../../dfs/ipfs';
import { ServiceContract } from './service-contract';
import { configTestcore as config } from '../../config-testcore';
import { TestUtils } from '../../test/test-utils';

use(chaiAsPromised);


describe('ServiceContract', function() {
  this.timeout(600000);
  let sc0: ServiceContract;
  let sc1: ServiceContract;
  let sc2: ServiceContract;
  let executor: Executor;
  let loader: ContractLoader;
  let businessCenterDomain;
  let ipfs: Ipfs;
  let nameResolver: NameResolver;
  let sharing;
  let web3;
  const sampleService1 = {
    serviceName: 'serviceContractService1',
    requestParameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        metadata: {
          type: 'object',
          additionalProperties: false,
          properties: {
            author: { type: 'string', },
            privateData: { type: 'object', },
          },
        },
        payload: {
          type: 'object',
          additionalProperties: false,
          required: [ 'callName', ],
          properties: {
            callName: { type: 'string', },
            tags: { type: 'string', },
            endDate: { type: 'integer', },
            allowMultipleAnswers: { type: 'boolean', },
            amount: { type: 'integer', },
            articleNumber: { type: 'string', },
            possibleWeek: { type: 'integer', },
            note: { type: 'string', },
            privateData: { type: 'object', },
          },
        },
      },
    },
    responseParameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        metadata: {
          type: 'object',
          additionalProperties: false,
          properties: {
            author: { type: 'string', },
          },
        },
        payload: {
          type: 'object',
          additionalProperties: false,
          properties: {
            possibleAmount: { type: 'integer', },
            price: { type: 'integer', },
            possibleDeliveryWeek: { type: 'integer', },
            note: { type: 'string', },
          },
        },
      },
    },
  };
  const sampleService2 = {
    serviceName: 'serviceContractService2',
    requestParameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        metadata: {
          type: 'object',
          additionalProperties: false,
          properties: {
            author: { type: 'string', },
          },
        },
        payload: {
          type: 'object',
          additionalProperties: false,
          required: [ 'callName', ],
          properties: {
            callName: { type: 'string', },
            tags: { type: 'string', },
            endDate: { type: 'integer', },
            allowMultipleAnswers: { type: 'boolean', },
            amount: { type: 'integer', },
            articleNumber: { type: 'string', },
            possibleWeek: { type: 'integer', },
            note: { type: 'string', },
          },
        }
      },
    },
    responseParameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        metadata: {
          type: 'object',
          additionalProperties: false,
          properties: {
            author: { type: 'string', },
          },
        },
        payload: {
          type: 'object',
          additionalProperties: false,
          properties: {
            possibleAmount: { type: 'integer', },
            price: { type: 'integer', },
            possibleDeliveryWeek: { type: 'integer', },
            note: { type: 'string', },
          },
        },
      },
    },
  }
  const sampleCall = {
    metadata: {
      author: accounts[0],
    },
    payload: {
      callName: 'sampleCall',
      tags: 'sample, call',
      endDate: 0,
      allowMultipleAnswers: true,
      amount: 1,
      articleNumber: 'ABC-123-456',
      possibleWeek: 5,
      note: 'this is a sample call',
    },
  };
  const sampleAnswer = {
    metadata: {
      author: accounts[2],
    },
    payload: {
      possibleAmount: 1,
      price: 300,
      possibleDeliveryWeek: 5,
      note: 'this is an answer to a sample call',
    },
  };

  before(async () => {
    web3 = TestUtils.getWeb3();
    nameResolver = await TestUtils.getNameResolver(web3);
    executor = await TestUtils.getExecutor(web3);
    executor.eventHub = await TestUtils.getEventHub(web3);
    loader = await TestUtils.getContractLoader(web3);
    ipfs = await TestUtils.getIpfs();
    const defaultKeys = TestUtils.getKeys();
    const keys0 = {};
    const requiredKeys0 = [
      // own 'self' key
      web3.utils.soliditySha3(accounts[0]),
      // own edge key
      web3.utils.soliditySha3.apply(web3.utils.soliditySha3,
        [web3.utils.soliditySha3(accounts[0]), web3.utils.soliditySha3(accounts[0])].sort()),
      // key with account 0
      web3.utils.soliditySha3.apply(web3.utils.soliditySha3,
        [web3.utils.soliditySha3(accounts[0]), web3.utils.soliditySha3(accounts[2])].sort()),
    ];
    requiredKeys0.forEach((key) => { keys0[key] = defaultKeys[key]; });
    // sc = await TestUtils.getServiceContract(web3, ipfs);
    sc0 = new ServiceContract({
      cryptoProvider: TestUtils.getCryptoProvider(),
      dfs: ipfs,
      executor,
      keyProvider: new KeyProvider({ keys: keys0, }),
      loader,
      nameResolver,
      sharing: await TestUtils.getSharing(web3, ipfs),
      web3,
    });
    const keys1 = {};
    const requiredKeys1 = [
      // own 'self' key
      web3.utils.soliditySha3(accounts[1]),
      // own edge key
      web3.utils.soliditySha3.apply(web3.utils.soliditySha3,
        [web3.utils.soliditySha3(accounts[1]), web3.utils.soliditySha3(accounts[1])].sort()),
    ];
    requiredKeys1.forEach((key) => { keys1[key] = defaultKeys[key]; });
    sc1 = new ServiceContract({
      cryptoProvider: TestUtils.getCryptoProvider(),
      dfs: ipfs,
      executor,
      keyProvider: new KeyProvider({ keys: keys1, }),
      loader,
      nameResolver,
      sharing: await TestUtils.getSharing(web3, ipfs),
      web3,
    });
    const keys2 = {};
    const requiredKeys2 = [
      // own 'self' key
      web3.utils.soliditySha3(accounts[2]),
      // own edge key
      web3.utils.soliditySha3.apply(web3.utils.soliditySha3,
        [web3.utils.soliditySha3(accounts[2]), web3.utils.soliditySha3(accounts[2])].sort()),
      // key with account 0
      web3.utils.soliditySha3.apply(web3.utils.soliditySha3,
        [web3.utils.soliditySha3(accounts[0]), web3.utils.soliditySha3(accounts[2])].sort()),
    ];
    requiredKeys2.forEach((key) => { keys2[key] = defaultKeys[key]; });
    sc2 = new ServiceContract({
      cryptoProvider: TestUtils.getCryptoProvider(),
      dfs: ipfs,
      executor,
      keyProvider: new KeyProvider({ keys: keys2, }),
      loader,
      nameResolver,
      sharing: await TestUtils.getSharing(web3, ipfs),
      web3,
    });
    businessCenterDomain = nameResolver.getDomainName(config.nameResolver.domains.businessCenter);
    sharing = await TestUtils.getSharing(web3, ipfs);

    const businessCenterAddress = await nameResolver.getAddress(businessCenterDomain);
    const businessCenter = await loader.loadContract('BusinessCenter', businessCenterAddress);
    if (!await executor.executeContractCall(
      businessCenter, 'isMember', accounts[0], { from: accounts[0] })
    ) {
      await executor.executeContractTransaction(
        businessCenter, 'join', { from: accounts[0], autoGas: 1.1, });
    }
    if (!await executor.executeContractCall(
      businessCenter, 'isMember', accounts[1], { from: accounts[1], })
    ) {
      await executor.executeContractTransaction(
        businessCenter, 'join', { from: accounts[1], autoGas: 1.1, });
    }
    if (!await executor.executeContractCall(
      businessCenter, 'isMember', accounts[2], { from: accounts[2], })
    ) {
      await executor.executeContractTransaction(
        businessCenter, 'join', { from: accounts[2], autoGas: 1.1, });
    }
  });

  it('can be created', async () => {
    const contract = await sc0.create(accounts[0], businessCenterDomain, sampleService1);
    expect(contract).to.be.ok;
  });

  it('can store a service', async() => {
    const contract = await sc0.create(accounts[0], businessCenterDomain, sampleService1);
    const service = await sc0.getService(contract, accounts[0]);
    expect(service).to.deep.eq(sampleService1);
  });

  it('can update a service', async() => {
    const contract = await sc0.create(accounts[0], businessCenterDomain, sampleService1);
    await sc0.setService(contract, accounts[0], sampleService2, businessCenterDomain);
    const service = await sc0.getService(contract, accounts[0]);
    expect(service).to.deep.eq(sampleService2);
  });

  it('can send a service message', async() => {
    const contract = await sc0.create(accounts[0], businessCenterDomain, sampleService1);
    const callId = await sc0.sendCall(contract, accounts[0], sampleCall);
    const call = await sc0.getCall(contract, accounts[0], callId);
    expect(call.data).to.deep.eq(sampleCall);
  });

  it('cannot send a service message, that doesn\'t match the definition', async() => {
    const contract = await sc0.create(accounts[0], businessCenterDomain, sampleService1);
    const brokenCall = JSON.parse(JSON.stringify(sampleCall));
    brokenCall.payload.someBogus = 123;
    const sendCallPromise = sc0.sendCall(contract, accounts[0], brokenCall);
    await expect(sendCallPromise).to.be.rejected;
  });

  it('can send an answer to a service message', async() => {
    const contract = await sc0.create(accounts[0], businessCenterDomain, sampleService1);
    await sc0.inviteToContract(
      businessCenterDomain, contract.options.address, accounts[0], accounts[2]);
    const contentKey = await sharing.getKey(contract.options.address, accounts[0], '*', 0);
    await sharing.addSharing(
      contract.options.address, accounts[0], accounts[2], '*', 0, contentKey);
    const callId = await sc0.sendCall(
      contract, accounts[0], sampleCall, [accounts[2]]);
    const call = await sc2.getCall(contract, accounts[0], callId);
    const answerId = await sc2.sendAnswer(
      contract, accounts[2], sampleAnswer, callId, call.data.metadata.author);
    const answer = await sc2.getAnswer(contract, accounts[2], callId, answerId);
    expect(answer.data).to.deep.eq(sampleAnswer);
  });

  it('cannot send an answer to a service message, that doesn\'t match the definition', async() => {
    const contract = await sc0.create(accounts[0], businessCenterDomain, sampleService1);
    await sc0.inviteToContract(
      businessCenterDomain, contract.options.address, accounts[0], accounts[2]);
    const contentKey = await sharing.getKey(contract.options.address, accounts[0], '*', 0);
    await sharing.addSharing(
      contract.options.address, accounts[0], accounts[2], '*', 0, contentKey);
    const callId = await sc0.sendCall(contract, accounts[0], sampleCall, [accounts[2]]);
    const call = await sc2.getCall(contract, accounts[0], callId);
    const brokenAnswer = JSON.parse(JSON.stringify(sampleAnswer));
    brokenAnswer.payload.someBogus = 123;
    const sendAnswerPromise = sc2.sendAnswer(
      contract, accounts[2], brokenAnswer, callId, call.data.metadata.author);
    await expect(sendAnswerPromise).to.be.rejected;
  });

  it('can hold multiple calls', async() => {
    const sampleCalls = [Math.random(), Math.random(), Math.random()].map((rand) => {
      const currentSample = JSON.parse(JSON.stringify(sampleCall));
      currentSample.payload.note += rand;
      return currentSample;
    });
    const contract = await sc0.create(accounts[0], businessCenterDomain, sampleService1);
    for (const currentSample of sampleCalls) {
      await sc0.sendCall(contract, accounts[0], currentSample);
    }
    expect((await sc0.getCall(contract, accounts[0], 0)).data).to.deep.eq(sampleCalls[0]);
    expect((await sc0.getCall(contract, accounts[0], 1)).data).to.deep.eq(sampleCalls[1]);
    expect((await sc0.getCall(contract, accounts[0], 2)).data).to.deep.eq(sampleCalls[2]);
  });

  it('allows to retrieve the call owner', async () => {
    const sampleCalls = [Math.random(), Math.random(), Math.random()].map((rand) => {
      const currentSample = JSON.parse(JSON.stringify(sampleCall));
      currentSample.payload.note += rand;
      return currentSample;
    });
    const contract = await sc0.create(accounts[0], businessCenterDomain, sampleService1);
    for (const currentSample of sampleCalls) {
      await sc0.sendCall(contract, accounts[0], currentSample);
    }
    await sc0.sendCall(contract, accounts[1], sampleCalls[0]);
    expect(await sc0.getCallOwner(contract, 0)).to.deep.eq(accounts[0]);
    expect(await sc0.getCallOwner(contract, 1)).to.deep.eq(accounts[0]);
    expect(await sc0.getCallOwner(contract, 2)).to.deep.eq(accounts[0]);
    expect(await sc0.getCallOwner(contract, 3)).to.deep.eq(accounts[1]);
  });

  it('does not allow calls to be read by every contract member without extending the sharing',
    async() => {
      const blockNr = await web3.eth.getBlockNumber();
      const contract = await sc0.create(accounts[0], businessCenterDomain, sampleService1);
      await sc0.inviteToContract(
        businessCenterDomain, contract.options.address, accounts[0], accounts[2]);
      const contentKey = await sharing.getKey(contract.options.address, accounts[0], '*', blockNr);
      await sharing.addSharing(
        contract.options.address, accounts[0], accounts[2], '*', blockNr, contentKey);
      const callId = await sc0.sendCall(contract, accounts[0], sampleCall);
      const call = await sc2.getCall(contract, accounts[2], callId);
      expect(call.data).to.be.undefined;
    });

  it('allows calls to be read, when added to a calls sharing', async() => {
    const blockNr = await web3.eth.getBlockNumber();
    const contract = await sc0.create(accounts[0], businessCenterDomain, sampleService1);
    await sc0.inviteToContract(
      businessCenterDomain, contract.options.address, accounts[0], accounts[2]);
    const contentKey = await sharing.getKey(contract.options.address, accounts[0], '*', blockNr);
    await sharing.addSharing(
      contract.options.address, accounts[0], accounts[2], '*', blockNr, contentKey);
    const callId = await sc0.sendCall(contract, accounts[0], sampleCall);
    await sc0.addToCallSharing(contract, accounts[0], callId, [accounts[2]]);
    const call = await sc2.getCall(contract, accounts[2], 0);
    expect(call.data).to.deep.eq(sampleCall);
  });

  it('does not allow answers to be read by other members than the original caller', async() => {
    const contract = await sc0.create(accounts[0], businessCenterDomain, sampleService1);
    const contentKey = await sharing.getKey(contract.options.address, accounts[0], '*', 0);
    await sc0.inviteToContract(
      businessCenterDomain, contract.options.address, accounts[0], accounts[1]);
    await sharing.addSharing(
      contract.options.address, accounts[0], accounts[1], '*', 0, contentKey);
    await sc0.inviteToContract(
      businessCenterDomain, contract.options.address, accounts[0], accounts[2]);
    await sharing.addSharing(
      contract.options.address, accounts[0], accounts[2], '*', 0, contentKey);
    await sc0.sendCall(contract, accounts[0], sampleCall, [accounts[2]]);
    const call = await sc2.getCall(contract, accounts[0], 0);
    await sc2.sendAnswer(contract, accounts[2], sampleAnswer, 0, call.data.metadata.author);

    // create second service contract helper with fewer keys
    const limitedKeyProvider = TestUtils.getKeyProvider([
      nameResolver.soliditySha3(
        ...[
          nameResolver.soliditySha3(accounts[0]),
          nameResolver.soliditySha3(accounts[1]),
        ].sort()
      ),
    ]);
    const limitedSc = await TestUtils.getServiceContract(web3, ipfs, limitedKeyProvider);
    const answer = await limitedSc.getAnswer(contract, accounts[1], 0, 0);
    await expect(answer.data).to.be.undefined;
  });

  it('can retrieve the count for calls', async() => {
    const sampleCalls = [Math.random(), Math.random(), Math.random()].map((rand) => {
      const currentSample = JSON.parse(JSON.stringify(sampleCall));
      currentSample.payload.note += rand;
      return currentSample;
    });
    const contract = await sc0.create(accounts[0], businessCenterDomain, sampleService1);
    for (const currentSample of sampleCalls) {
      await sc0.sendCall(contract, accounts[0], currentSample);
    }
    expect(await sc0.getCallCount(contract)).to.eq(sampleCalls.length);
  });

  it('can retrieve the count for answers', async() => {
    const sampleAnswers = [Math.random(), Math.random(), Math.random()].map((rand) => {
      const currentSample = JSON.parse(JSON.stringify(sampleAnswer));
      currentSample.payload.note += rand;
      return currentSample;
    });
    const contract = await sc0.create(accounts[0], businessCenterDomain, sampleService1);
    await sc0.inviteToContract(
      businessCenterDomain, contract.options.address, accounts[0], accounts[2]);
    const contentKey = await sharing.getKey(contract.options.address, accounts[0], '*', 0);
    await sharing.addSharing(
      contract.options.address, accounts[0], accounts[2], '*', 0, contentKey);
    await sc0.sendCall(contract, accounts[0], sampleCall, [accounts[2]]);
    const call = await sc2.getCall(contract, accounts[2], 0);
    for (const currentSample of sampleAnswers) {
      await sc2.sendAnswer(contract, accounts[2], currentSample, 0, call.data.metadata.author);
    }
    const answerCount = await sc0.getAnswerCount(contract, 0);
    expect(answerCount).to.eq(sampleAnswers.length);
  });

  it('can retrieve all answers', async() => {
    const sampleAnswers = [Math.random(), Math.random(), Math.random()].map((rand) => {
      const currentSample = JSON.parse(JSON.stringify(sampleAnswer));
      currentSample.payload.note += rand;
      return currentSample;
    });
    const contract = await sc0.create(accounts[0], businessCenterDomain, sampleService1);
    await sc0.inviteToContract(
      businessCenterDomain, contract.options.address, accounts[0], accounts[2]);
    const contentKey = await sharing.getKey(contract.options.address, accounts[0], '*', 0);
    await sharing.addSharing(
      contract.options.address, accounts[0], accounts[2], '*', 0, contentKey);
    await sc0.sendCall(contract, accounts[0], sampleCall, [accounts[2]]);
    const call = await sc2.getCall(contract, accounts[0], 0);
    for (const currentSample of sampleAnswers) {
      await sc2.sendAnswer(contract, accounts[2], currentSample, 0, call.data.metadata.author);
    }
    const answers = await sc0.getAnswers(contract, accounts[0], 0);
    expect(Object.keys(answers).length).to.eq(3);
    Object.keys(answers).reverse().forEach((answerId, i) => {
      expect(answers[answerId].data).to.deep.eq(sampleAnswers[sampleAnswers.length - 1 - i]);
    });
  });

  it('can create answers and read and answer them with another user', async() => {
    const contract = await sc0.create(accounts[0], businessCenterDomain, sampleService1);
    await sc0.inviteToContract(
      businessCenterDomain, contract.options.address, accounts[0], accounts[2]);
    const contentKey = await sharing.getKey(contract.options.address, accounts[0], '*', 0);
    await sharing.addSharing(
      contract.options.address, accounts[0], accounts[2], '*', 0, contentKey);
    const callId = await sc0.sendCall(contract, accounts[0], sampleCall, [accounts[2]]);

    // retrieve call with other account, create answer
    const call = await sc2.getCall(contract, accounts[2], callId);
    expect(call.data).to.deep.eq(sampleCall);
    const answerId = await sc2.sendAnswer(
      contract, accounts[2], sampleAnswer, callId, call.data.metadata.author);

    // retrieve answer with first account
    const answer = await sc2.getAnswer(contract, accounts[0], callId, answerId);
    expect(answer.data).to.deep.eq(sampleAnswer);
  });

  it('can create answers and gets only basic answer information if unable to decrypt', async() => {
    const contract = await sc0.create(accounts[0], businessCenterDomain, sampleService1);
    await sc0.inviteToContract(
      businessCenterDomain, contract.options.address, accounts[0], accounts[2]);
    const contentKey = await sharing.getKey(contract.options.address, accounts[0], '*', 0);
    await sharing.addSharing(
      contract.options.address, accounts[0], accounts[2], '*', 0, contentKey);
    const callId = await sc0.sendCall(contract, accounts[0], sampleCall, [accounts[2]]);

    // retrieve call with other account, create answer
    const call = await sc2.getCall(contract, accounts[2], callId);
    expect(call.data).to.deep.eq(sampleCall);
    const answerId = await sc2.sendAnswer(
      contract, accounts[2], sampleAnswer, callId, call.data.metadata.author);

    // retrieve answer with first account
    const answer0 = await sc0.getAnswer(contract, accounts[0], callId, answerId);
    expect(answer0.data).to.deep.eq(sampleAnswer)
    const answers0 = await sc0.getAnswers(contract, accounts[2], callId);
    expect(answers0[answerId].data).to.deep.eq(sampleAnswer);

    // retrieve answer with random account
    const answer1 = await sc1.getAnswer(contract, accounts[2], callId, answerId);
    expect(answer1.data).to.deep.eq(null);
    const answers1 = await sc1.getAnswers(contract, accounts[2], callId);
    expect(answers1[answerId].data).to.deep.eq(null);
  });

  describe('when paging through calls and answers', () => {
    let contract;
    let sampleCalls;
    let sampleAnswers;
    const anweredCallId = 6;
    const anwersCount = 27;
    const callCount = 23;

    before(async () => {
      sampleCalls = [...Array(callCount)].map(() => Math.random()).map((rand, i) => {;
        const currentSample = JSON.parse(JSON.stringify(sampleCall));
        currentSample.payload.note += i;
        return currentSample;
      });
      sampleAnswers = [];
      for (let i = 0; i < anwersCount; i++) {
        const answer = JSON.parse(JSON.stringify(sampleAnswer));
        answer.payload.note += i;
        sampleAnswers.push(answer);
      }

      // if using existing contract
      // contract = loader.loadContract(
      //  'ServiceContractInterface', '0x665339F534618a84B917C0Fc54700F690FC54A4A');

      // if creating new contract
      contract = await sc0.create(accounts[0], businessCenterDomain, sampleService1);
      await sc0.inviteToContract(
        businessCenterDomain, contract.options.address, accounts[0], accounts[2]);
      const contentKey = await sharing.getKey(contract.options.address, accounts[0], '*', 0);
      await sharing.addSharing(
        contract.options.address, accounts[0], accounts[2], '*', 0, contentKey);
      let callIndex = 0;
      for (const currentSample of sampleCalls) {
        console.log(`send test call ${callIndex++}`);
        await sc0.sendCall(contract, accounts[0], currentSample, [accounts[2]]);
      }
      let answerIndex = 0;
      for (const answer of sampleAnswers) {
        console.log(`send test answer ${answerIndex++}`);
        await sc2.sendAnswer(contract, accounts[2], answer, anweredCallId, accounts[0])
      }
      console.log(contract.options.address);
    });

    describe('when retrieving calls', () => {
      it('can retrieve calls', async() => {
        const calls = await sc0.getCalls(contract, accounts[0]);
        expect(Object.keys(calls).length).to.eq(Math.min(sampleCalls.length, 10));
        Object.keys(calls).forEach((callId, i) => {
          expect(calls[callId].data).to.deep.eq(sampleCalls[i]);
        });
      });

      it('can retrieve calls with a limited page size', async() => {
        const count = 2;
        const calls = await sc0.getCalls(contract, accounts[0], count);
        expect(Object.keys(calls).length).to.eq(Math.min(sampleCalls.length, count));
        Object.keys(calls).forEach((callId, i) => {
          expect(calls[callId].data).to.deep.eq(sampleCalls[i]);
        });
      });

      it('can retrieve calls with offset that results in a in a full page', async() => {
        const offset = 7;
        const calls = await sc0.getCalls(contract, accounts[0], 10, offset);
        expect(Object.keys(calls).length).to.eq(Math.min(sampleCalls.length - offset, 10));
        Object.keys(calls).forEach((callId, i) => {
          expect(calls[callId].data).to.deep.eq(sampleCalls[i + offset]);
        });
      });

      it('can retrieve calls with offset that doesn\'t result not full page', async() => {
        const offset = 17;
        const calls = await sc0.getCalls(contract, accounts[0], 10, offset);
        expect(Object.keys(calls).length).to.eq(Math.min(sampleCalls.length - offset, 10));
        Object.keys(calls).forEach((callId, i) => {
          expect(calls[callId].data).to.deep.eq(sampleCalls[i + offset]);
        });
      });

      it('can retrieve calls with limited page size and offset', async() => {
        const count = 2;
        const offset = 17;
        const calls = await sc0.getCalls(contract, accounts[0], 2, offset);
        expect(Object.keys(calls).length).to.eq(Math.min(sampleCalls.length - offset, count));
        Object.keys(calls).forEach((callId, i) => {
          expect(calls[callId].data).to.deep.eq(sampleCalls[i + offset]);
        });
      });

      it('can retrieve calls in reverse order', async() => {
        const calls = await sc0.getCalls(contract, accounts[0], 10, 0, true);
        expect(Object.keys(calls).length).to.eq(10);
        Object.keys(calls).reverse().forEach((callId, i) => {
          expect(calls[callId].data).to.deep.eq(sampleCalls[sampleCalls.length - 1 - i]);
        });
      });

      it('can retrieve calls in reverse order with a limited page size', async() => {
        const count = 2;
        const calls = await sc0.getCalls(contract, accounts[0], count, 0, true);
        expect(Object.keys(calls).length).to.eq(Math.min(sampleCalls.length, count));
        Object.keys(calls).reverse().forEach((callId, i) => {
          expect(calls[callId].data).to.deep.eq(sampleCalls[sampleCalls.length - 1 - i]);
        });
      });

      it('can retrieve calls in reverse order with offset that results in a full page', async() => {
        const offset = 7;
        const calls = await sc0.getCalls(contract, accounts[0], 10, offset, true);
        expect(Object.keys(calls).length).to.eq(Math.min(sampleCalls.length - offset, 10));
        Object.keys(calls).reverse().forEach((callId, i) => {
          expect(calls[callId].data).to.deep.eq(sampleCalls[sampleCalls.length - 1 - i - offset]);
        });
      });

      it('can retrieve calls in reverse order with offset that doesn\'t result not full page',
        async() => {
          const offset = 17;
          const calls = await sc0.getCalls(contract, accounts[0], 10, offset, true);
          expect(Object.keys(calls).length).to.eq(Math.min(sampleCalls.length - offset, 10));
          Object.keys(calls).reverse().forEach((callId, i) => {
            expect(calls[callId].data).to.deep.eq(sampleCalls[sampleCalls.length - 1 - i - offset]);
          });
        });

      it('can retrieve calls in reverse order with limited page size and offset', async() => {
        const count = 2;
        const offset = 17;
        const calls = await sc0.getCalls(contract, accounts[0], 2, offset, true);
        expect(Object.keys(calls).length).to.eq(Math.min(sampleCalls.length - offset, count));
        Object.keys(calls).reverse().forEach((callId, i) => {
          expect(calls[callId].data).to.deep.eq(sampleCalls[sampleCalls.length - 1 - i - offset]);
        });
      });
    });

    describe('when retrieving answers', () => {
      it('can retrieve answers', async() => {
        const answers = await sc0.getAnswers(contract, accounts[0], anweredCallId);
        expect(Object.keys(answers).length).to.eq(Math.min(sampleAnswers.length, 10));
        Object.keys(answers).forEach((answerId, i) => {
          expect(answers[answerId].data).to.deep.eq(sampleAnswers[i]);
        });
      });

      it('can retrieve answers with a limited page size', async() => {
        const count = 2;
        const answers = await sc0.getAnswers(contract, accounts[0], anweredCallId, count);
        expect(Object.keys(answers).length).to.eq(Math.min(sampleAnswers.length, count));
        Object.keys(answers).forEach((answerId, i) => {
          expect(answers[answerId].data).to.deep.eq(sampleAnswers[i]);
        });
      });

      it('can retrieve answers with offset that results in a in a full page', async() => {
        const offset = 7;
        const answers = await sc0.getAnswers(contract, accounts[0], anweredCallId, 10, offset);
        expect(Object.keys(answers).length).to.eq(Math.min(sampleAnswers.length - offset, 10));
        Object.keys(answers).forEach((answerId, i) => {
          expect(answers[answerId].data).to.deep.eq(sampleAnswers[i + offset]);
        });
      });

      it('can retrieve answers with offset that doesn\'t result not full page', async() => {
        const offset = 17;
        const answers = await sc0.getAnswers(contract, accounts[0], anweredCallId, 10, offset);
        expect(Object.keys(answers).length).to.eq(Math.min(sampleAnswers.length - offset, 10));
        Object.keys(answers).forEach((answerId, i) => {
          expect(answers[answerId].data).to.deep.eq(sampleAnswers[i + offset]);
        });
      });

      it('can retrieve answers with limited page size and offset', async() => {
        const count = 2;
        const offset = 17;
        const answers = await sc0.getAnswers(contract, accounts[0], anweredCallId, 2, offset);
        expect(Object.keys(answers).length).to.eq(Math.min(sampleAnswers.length - offset, count));
        Object.keys(answers).forEach((answerId, i) => {
          expect(answers[answerId].data).to.deep.eq(sampleAnswers[i + offset]);
        });
      });

      it('can retrieve answers in reverse order', async() => {
        const answers = await sc0.getAnswers(contract, accounts[0], anweredCallId, 10, 0, true);
        expect(Object.keys(answers).length).to.eq(10);
        Object.keys(answers).reverse().forEach((answerId, i) => {
          expect(answers[answerId].data).to.deep.eq(sampleAnswers[sampleAnswers.length - 1 - i]);
        });
      });

      it('can retrieve answers in reverse order with a limited page size', async() => {
        const count = 2;
        const answers = await sc0.getAnswers(contract, accounts[0], anweredCallId, count, 0, true);
        expect(Object.keys(answers).length).to.eq(Math.min(sampleAnswers.length, count));
        Object.keys(answers).reverse().forEach((answerId, i) => {
          expect(answers[answerId].data).to.deep.eq(sampleAnswers[sampleAnswers.length - 1 - i]);
        });
      });

      it('can retrieve answers in reverse order with offset that results in a full page',
        async() => {
          const offset = 7;
          const answers = await sc0.getAnswers(
            contract, accounts[0], anweredCallId, 10, offset, true);
          expect(Object.keys(answers).length).to.eq(Math.min(sampleAnswers.length - offset, 10));
          Object.keys(answers).reverse().forEach((answerId, i) => {
            expect(answers[answerId].data).to.deep.eq(
              sampleAnswers[sampleAnswers.length - 1 - i - offset]);
          });
        });

      it('can retrieve answers in reverse with offset that doesn\'t result not full page',
        async() => {
          const offset = 17;
          const answers = await sc0.getAnswers(
            contract, accounts[0], anweredCallId, 10, offset, true);
          expect(Object.keys(answers).length).to.eq(Math.min(sampleAnswers.length - offset, 10));
          Object.keys(answers).reverse().forEach((answerId, i) => {
            expect(answers[answerId].data).to.deep.eq(
              sampleAnswers[sampleAnswers.length - 1 - i - offset]);
          });
        });

      it('can retrieve answers in reverse with limited page size and offset', async() => {
        const count = 2;
        const offset = 17;
        const answers = await sc0.getAnswers(contract, accounts[0], anweredCallId, 2, offset, true);
        expect(Object.keys(answers).length).to.eq(Math.min(sampleAnswers.length - offset, count));
        Object.keys(answers).reverse().forEach((answerId, i) => {
          expect(answers[answerId].data).to.deep.eq(
            sampleAnswers[sampleAnswers.length - 1 - i - offset]);
        });
      });
    });
  });

  it('can send and read service message with nested encryption', async () => {
    // create call with a custom property, that contains cryptoInfo and private
    const contract = await sc0.create(accounts[0], businessCenterDomain, sampleService1);
    const callForNesting = JSON.parse(JSON.stringify(sampleCall));

    // get cryptor for annotating encryption of properties
    const cryptor = sc0.options.cryptoProvider.getCryptorByCryptoAlgo(
      sc0.options.defaultCryptoAlgo);
    const secretPayload = {
      someNumber: Math.random(),
      someText: `I like randomNumbers in payload, for example: ${Math.random()}`,
    };
    const secretMetadata = `I like randomNumbers in metadata, for example: ${Math.random()}`;
    callForNesting.payload.privateData = {
      private: secretPayload,
      cryptoInfo: cryptor.getCryptoInfo(
        sc0.options.nameResolver.soliditySha3(contract.options.address)),
    };
    callForNesting.metadata.privateData = {
      private: secretMetadata,
      cryptoInfo: cryptor.getCryptoInfo(
        sc0.options.nameResolver.soliditySha3(contract.options.address)),
    };
    // send it as usual (to-encrypt properties are encrypted automatically); invite participant
    const callId = await sc0.sendCall(contract, accounts[0], callForNesting, [accounts[2]]);

    // fetch with creator
    const fullyDecrypedCall = JSON.parse(JSON.stringify(callForNesting));
    fullyDecrypedCall.payload.privateData = {
      someNumber: Math.random(),
      someText: `I like randomNumbers in payload, for example: ${Math.random()}`,
    };
    fullyDecrypedCall.payload.privateData = secretPayload;
    fullyDecrypedCall.metadata.privateData = secretMetadata;
    let call = (await sc0.getCall(contract, accounts[0], callId)).data;
    expect(call).to.deep.eq(fullyDecrypedCall);

    // fetch with participant
    call = (await await sc2.getCall(contract, accounts[2], callId)).data;
    // participant can read 'outer' properties
    expect(call.metadata.author).to.eq(callForNesting.metadata.author);
    expect(call.payload.callName).to.eq(callForNesting.payload.callName);
    expect(call.payload.tags).to.eq(callForNesting.payload.tags);
    expect(call.payload.endDate).to.eq(callForNesting.payload.endDate);
    expect(call.payload.allowMultipleAnswers).to.eq(callForNesting.payload.allowMultipleAnswers);
    expect(call.payload.amount).to.eq(callForNesting.payload.amount);
    expect(call.payload.articleNumber).to.eq(callForNesting.payload.articleNumber);
    expect(call.payload.possibleWeek).to.eq(callForNesting.payload.possibleWeek);
    expect(call.payload.note).to.eq(callForNesting.payload.note);

    // participant cannot read 'inner' properties
    expect(call.metadata.privateData).not.to.eq(callForNesting.metadata.privateData);
    expect(call.payload.privateData).not.to.eq(callForNesting.payload.privateData);

    // add sharing for participent
    await sc0.addToCallSharing(
      contract, accounts[0], callId, [accounts[2]], null, null, 'privateData');
    // fetch again
    sc2.options.sharing.clearCache();
    call = (await sc2.getCall(contract, accounts[2], callId)).data;
    expect(call).to.deep.eq(fullyDecrypedCall);
  });
});
