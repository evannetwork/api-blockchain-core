/*
  Copyright (C) 2018-present evan GmbH. 
  
  This program is free software: you can redistribute it and/or modify it
  under the terms of the GNU Affero General Public License, version 3, 
  as published by the Free Software Foundation. 
  
  This program is distributed in the hope that it will be useful, 
  but WITHOUT ANY WARRANTY; without even the implied warranty of 
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
  See the GNU Affero General Public License for more details. 
  
  You should have received a copy of the GNU Affero General Public License along with this program.
  If not, see http://www.gnu.org/licenses/ or write to the
  
  Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA, 02110-1301 USA,
  
  or download the license from the following URL: https://evan.network/license/ 
  
  You can be released from the requirements of the GNU Affero General Public License
  by purchasing a commercial license.
  Buying such a license is mandatory as soon as you use this software or parts of it
  on other blockchains than evan.network. 
  
  For more information, please contact evan GmbH at this address: https://evan.network/license/ 
*/

import 'mocha';
import { expect, use } from 'chai';
import chaiAsPromised = require('chai-as-promised');

import {
  ContractLoader,
  EventHub,
  Executor,
  Ipfs,
  KeyProvider,
  NameResolver,
} from '@evan.network/dbcp';

import { accounts } from '../../test/accounts';
import { ContractState } from '../base-contract/base-contract';
import { ServiceContract } from './service-contract';
import { config } from '../../config';
import { TestUtils } from '../../test/test-utils';

use(chaiAsPromised);


describe('ServiceContract', function() {
  this.timeout(60000);
  let sc0: ServiceContract;
  let sc2: ServiceContract;
  let contractFactory: any;
  let executor: Executor;
  let loader: ContractLoader;
  let businessCenterDomain;
  let ipfs: Ipfs;
  let nameResolver: NameResolver;
  let sharing;
  let web3;
  const sampleService1 = {
    serviceName: 'serviceContractService1',
    endPoint: 'serviceContractService1',
    requestParameters: {
      required: [
        'callName',
      ],
      properties: {
        callName: {
          type: 'string',
        },
        tags: {
          type: 'string',
        },
        endDate: {
          type: 'integer',
        },
        allowMultipleAnswers: {
          type: 'boolean',
        },
        amount: {
          type: 'integer',
        },
        articleNumber: {
          type: 'string',
        },
        possibleWeek: {
          type: 'integer',
        },
        note: {
          type: 'string',
        },
      },
    },
    responseParameters: {
      properties: {
        possibleAmount: {
          type: 'integer',
        },
        price: {
          type: 'integer',
        },
        possibleDeliveryWeek: {
          type: 'integer',
        },
        note: {
          type: 'string',
        },
      },
    },
    updateService: true,
  };
  const sampleService2 = {
    serviceName: 'serviceContractService2',
    endPoint: 'serviceContractService2',
    requestParameters: {
      required: [
        'callName',
      ],
      properties: {
        callName: {
          type: 'string',
        },
        tags: {
          type: 'string',
        },
        endDate: {
          type: 'integer',
        },
        allowMultipleAnswers: {
          type: 'boolean',
        },
        amount: {
          type: 'integer',
        },
        articleNumber: {
          type: 'string',
        },
        possibleWeek: {
          type: 'integer',
        },
        note: {
          type: 'string',
        },
      },
    },
    responseParameters: {
      properties: {
        possibleAmount: {
          type: 'integer',
        },
        price: {
          type: 'integer',
        },
        possibleDeliveryWeek: {
          type: 'integer',
        },
        note: {
          type: 'string',
        },
      },
    },
    updateService: true,
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
    await ipfs.stop();
    web3.currentProvider.connection.close();
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
    expect(call).to.deep.eq(sampleCall);
  });

  it('can send an answer to a service message', async() => {
    const contract = await sc0.create(accounts[0], businessCenterDomain, sampleService1);
    await sc0.inviteToContract(businessCenterDomain, contract.options.address, accounts[0], accounts[2]);
    const contentKey = await sharing.getKey(contract.options.address, accounts[0], '*', 0);
    await sharing.addSharing(contract.options.address, accounts[0], accounts[2], '*', 0, contentKey);
    const callId = await sc0.sendCall(contract, accounts[0], sampleCall, [accounts[2]]);
    const call = await sc2.getCall(contract, accounts[0], callId);
    const answerId = await sc2.sendAnswer(contract, accounts[2], sampleAnswer, callId, call.metadata.author);
    const answer = await sc2.getAnswer(contract, accounts[2], callId, answerId);
    expect(answer).to.deep.eq(sampleAnswer);
  });

  it('can hold multiple calls', async() => {
    const sampleCalls = [Math.random(), Math.random(), Math.random()].map((rand) => {
      const currentSample = JSON.parse(JSON.stringify(sampleCall));
      currentSample.payload.note += rand;
      return currentSample;
    });
    const contract = await sc0.create(accounts[0], businessCenterDomain, sampleService1);
    for (let currentSample of sampleCalls) {
      await sc0.sendCall(contract, accounts[0], currentSample);
    }
    expect(await sc0.getCall(contract, accounts[0], 0)).to.deep.eq(sampleCalls[0]);
    expect(await sc0.getCall(contract, accounts[0], 1)).to.deep.eq(sampleCalls[1]);
    expect(await sc0.getCall(contract, accounts[0], 2)).to.deep.eq(sampleCalls[2]);
  });

  it('does not allow calls to be read by every contract member without extending the sharing', async() => {
    const blockNr = await web3.eth.getBlockNumber();
    const contract = await sc0.create(accounts[0], businessCenterDomain, sampleService1);
    await sc0.inviteToContract(businessCenterDomain, contract.options.address, accounts[0], accounts[2]);
    const contentKey = await sharing.getKey(contract.options.address, accounts[0], '*', blockNr);
    await sharing.addSharing(contract.options.address, accounts[0], accounts[2], '*', blockNr, contentKey);
    await sc0.sendCall(contract, accounts[0], sampleCall);
    const callPromise = sc2.getCall(contract, accounts[2], 0);
    await expect(callPromise).to.be.rejected;
  });

  it('allows calls to be read, when added to a calls sharing', async() => {
    const blockNr = await web3.eth.getBlockNumber();
    const contract = await sc0.create(accounts[0], businessCenterDomain, sampleService1);
    await sc0.inviteToContract(businessCenterDomain, contract.options.address, accounts[0], accounts[2]);
    const contentKey = await sharing.getKey(contract.options.address, accounts[0], '*', blockNr);
    await sharing.addSharing(contract.options.address, accounts[0], accounts[2], '*', blockNr, contentKey);
    const callId = await sc0.sendCall(contract, accounts[0], sampleCall);
    await sc0.addToCallSharing(contract, accounts[0], callId, [accounts[2]]);
    const call = await sc2.getCall(contract, accounts[2], 0);
    expect(call).to.deep.eq(sampleCall);
  });

  it('does not allow answers to be read by other members than the original caller', async() => {
    const contract = await sc0.create(accounts[0], businessCenterDomain, sampleService1);
    const contentKey = await sharing.getKey(contract.options.address, accounts[0], '*', 0);
    await sc0.inviteToContract(businessCenterDomain, contract.options.address, accounts[0], accounts[1]);
    await sharing.addSharing(contract.options.address, accounts[0], accounts[1], '*', 0, contentKey);
    await sc0.inviteToContract(businessCenterDomain, contract.options.address, accounts[0], accounts[2]);
    await sharing.addSharing(contract.options.address, accounts[0], accounts[2], '*', 0, contentKey);
    await sc0.sendCall(contract, accounts[0], sampleCall, [accounts[2]]);
    const call = await sc2.getCall(contract, accounts[0], 0);
    await sc2.sendAnswer(contract, accounts[2], sampleAnswer, 0, call.metadata.author);

    // create second service contract helper with fewer keys
    const limitedKeyProvider = TestUtils.getKeyProvider([
      nameResolver.soliditySha3.apply(nameResolver,
        [nameResolver.soliditySha3(accounts[0]), nameResolver.soliditySha3(accounts[1])].sort()),
    ]);
    const limitedSc = await TestUtils.getServiceContract(web3, ipfs, limitedKeyProvider);
    const answerPromise = limitedSc.getAnswer(contract, accounts[1], 0, 0);
    await expect(answerPromise).to.be.rejected;
  });

  it('can retrieve the count for calls', async() => {
    const sampleCalls = [Math.random(), Math.random(), Math.random()].map((rand) => {
      const currentSample = JSON.parse(JSON.stringify(sampleCall));
      currentSample.payload.note += rand;
      return currentSample;
    });
    const contract = await sc0.create(accounts[0], businessCenterDomain, sampleService1);
    for (let currentSample of sampleCalls) {
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
    await sc0.inviteToContract(businessCenterDomain, contract.options.address, accounts[0], accounts[2]);
    const contentKey = await sharing.getKey(contract.options.address, accounts[0], '*', 0);
    await sharing.addSharing(contract.options.address, accounts[0], accounts[2], '*', 0, contentKey);
    await sc0.sendCall(contract, accounts[0], sampleCall, [accounts[2]]);
    const call = await sc2.getCall(contract, accounts[2], 0);
    for (let currentSample of sampleAnswers) {
      await sc2.sendAnswer(contract, accounts[2], currentSample, 0, call.metadata.author);
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
    await sc0.inviteToContract(businessCenterDomain, contract.options.address, accounts[0], accounts[2]);
    const contentKey = await sharing.getKey(contract.options.address, accounts[0], '*', 0);
    await sharing.addSharing(contract.options.address, accounts[0], accounts[2], '*', 0, contentKey);
    await sc0.sendCall(contract, accounts[0], sampleCall, [accounts[2]]);
    const call = await sc2.getCall(contract, accounts[0], 0);
    for (let currentSample of sampleAnswers) {
      await sc2.sendAnswer(contract, accounts[2], currentSample, 0, call.metadata.author);
    }
    const answers = await sc0.getAnswers(contract, accounts[0], 0);
    expect(answers.length).to.eq(3);
    const reversed = answers.reverse();
    expect(answers[0]).to.deep.eq(reversed[0]);
    expect(answers[1]).to.deep.eq(reversed[1]);
    expect(answers[2]).to.deep.eq(reversed[2]);
  });

  it('can create answers and read and answer them with another user', async() => {
    const contract = await sc0.create(accounts[0], businessCenterDomain, sampleService1);
    await sc0.inviteToContract(businessCenterDomain, contract.options.address, accounts[0], accounts[2]);
    const contentKey = await sharing.getKey(contract.options.address, accounts[0], '*', 0);
    await sharing.addSharing(contract.options.address, accounts[0], accounts[2], '*', 0, contentKey);
    const callId = await sc0.sendCall(contract, accounts[0], sampleCall, [accounts[2]]);

    // retrieve call with other account, create answer
    const call = await sc2.getCall(contract, accounts[2], callId);
    expect(call).to.deep.eq(sampleCall);
    const answerId = await sc2.sendAnswer(contract, accounts[2], sampleAnswer, callId, call.metadata.author);

    // retrieve answer with first account
    const answer = await sc2.getAnswer(contract, accounts[0], callId, answerId);
    expect(answer).to.deep.eq(sampleAnswer);
  });

  describe('when paging through answers and answers', () => {
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
      contract = loader.loadContract('ServiceContractInterface', '0xdeDca22030f95488E7db80A3aF26A1C122aeCa17');

      // // if creating new contract
      // contract = await sc0.create(accounts[0], businessCenterDomain, sampleService1);
      // await sc0.inviteToContract(businessCenterDomain, contract.options.address, accounts[0], accounts[2]);
      // const contentKey = await sharing.getKey(contract.options.address, accounts[0], '*', 0);
      // await sharing.addSharing(contract.options.address, accounts[0], accounts[2], '*', 0, contentKey);
      // let callIndex = 0;
      // for (let currentSample of sampleAnswers) {
      //   console.log(`send test call ${callIndex++}`);
      //   await sc0.sendCall(contract, accounts[0], currentSample, [accounts[2]]);
      // }
      // let answerIndex = 0;
      // for (let answer of sampleAnswers) {
      //   console.log(`send test answer ${answerIndex++}`);
      //   await sc2.sendAnswer(contract, accounts[2], answer, anweredCallId, accounts[0])
      // }
      // console.log(contract.options.address);
    });

    describe('when retrieving calls', () => {
      it('can retrieve calls', async() => {
        const calls = await sc0.getCalls(contract, accounts[0]);
        expect(calls.length).to.eq(Math.min(sampleCalls.length, 10));
        expect(calls.length).to.eq(10);
        for (let i = 0; i < calls.length; i++) {
          expect(calls[i]).to.deep.eq(sampleCalls[i]);
        }
      });

      it('can retrieve calls with a limited page size', async() => {
        const count = 2;
        const calls = await sc0.getCalls(contract, accounts[0], count);
        expect(calls.length).to.eq(Math.min(sampleCalls.length, count));
        for (let i = 0; i < calls.length; i++) {
          expect(calls[i]).to.deep.eq(sampleCalls[i]);
        }
      });

      it('can retrieve calls with offset that results in a in a full page', async() => {
        const offset = 7;
        const calls = await sc0.getCalls(contract, accounts[0], 10, offset);
        expect(calls.length).to.eq(Math.min(sampleCalls.length - offset, 10));
        for (let i = 0; i < calls.length; i++) {
          expect(calls[i]).to.deep.eq(sampleCalls[i + offset]);
        }
      });

      it('can retrieve calls with offset that doesn\'t result not full page', async() => {
        const offset = 17;
        const calls = await sc0.getCalls(contract, accounts[0], 10, offset);
        expect(calls.length).to.eq(Math.min(sampleCalls.length - offset, 10));
        for (let i = 0; i < calls.length; i++) {
          expect(calls[i]).to.deep.eq(sampleCalls[i + offset]);
        }
      });

      it('can retrieve calls with limited page size and offset', async() => {
        const count = 2;
        const offset = 17;
        const calls = await sc0.getCalls(contract, accounts[0], 2, offset);
        expect(calls.length).to.eq(Math.min(sampleCalls.length - offset, count));
        for (let i = 0; i < calls.length; i++) {
          expect(calls[i]).to.deep.eq(sampleCalls[i + offset]);
        }
      });

      it('can retrieve calls in reverse order', async() => {
        const calls = await sc0.getCalls(contract, accounts[0], 10, 0, true);
        expect(calls.length).to.eq(10);
        for (let i = 0; i < calls.length; i++) {
          expect(calls[i]).to.deep.eq(sampleCalls[sampleCalls.length - 1 - i]);
        }
      });

      it('can retrieve calls in reverse order with a limited page size', async() => {
        const count = 2;
        const calls = await sc0.getCalls(contract, accounts[0], count, 0, true);
        expect(calls.length).to.eq(Math.min(sampleCalls.length, count));
        for (let i = 0; i < calls.length; i++) {
          expect(calls[i]).to.deep.eq(sampleCalls[sampleCalls.length - 1 - i]);
        }
      });

      it('can retrieve calls in reverse order with offset that results in a full page', async() => {
        const offset = 7;
        const calls = await sc0.getCalls(contract, accounts[0], 10, offset, true);
        expect(calls.length).to.eq(Math.min(sampleCalls.length - offset, 10));
        for (let i = 0; i < calls.length; i++) {
          expect(calls[i]).to.deep.eq(sampleCalls[sampleCalls.length - 1 - i - offset]);
        }
      });

      it('can retrieve calls with offset that doesn\'t result not full page', async() => {
        const offset = 17;
        const calls = await sc0.getCalls(contract, accounts[0], 10, offset, true);
        expect(calls.length).to.eq(Math.min(sampleCalls.length - offset, 10));
        for (let i = 0; i < calls.length; i++) {
          expect(calls[i]).to.deep.eq(sampleCalls[sampleCalls.length - 1 - i - offset]);
        }
      });

      it('can retrieve calls with limited page size and offset', async() => {
        const count = 2;
        const offset = 17;
        const calls = await sc0.getCalls(contract, accounts[0], 2, offset, true);
        expect(calls.length).to.eq(Math.min(sampleCalls.length - offset, count));
        for (let i = 0; i < calls.length; i++) {
          expect(calls[i]).to.deep.eq(sampleCalls[sampleCalls.length - 1 - i - offset]);
        }
      });
    });

    describe('when retrieving answers', () => {
      it('can retrieve answers', async() => {
        const answers = await sc0.getAnswers(contract, accounts[0], anweredCallId);
        expect(answers.length).to.eq(Math.min(sampleAnswers.length, 10));
        for (let i = 0; i < answers.length; i++) {
          expect(answers[i]).to.deep.eq(sampleAnswers[i]);
        }
      });

      it('can retrieve answers with a limited page size', async() => {
        const count = 2;
        const answers = await sc0.getAnswers(contract, accounts[0], anweredCallId, count);
        expect(answers.length).to.eq(Math.min(sampleAnswers.length, count));
        for (let i = 0; i < answers.length; i++) {
          expect(answers[i]).to.deep.eq(sampleAnswers[i]);
        }
      });

      it('can retrieve answers with offset that results in a in a full page', async() => {
        const offset = 7;
        const answers = await sc0.getAnswers(contract, accounts[0], anweredCallId, 10, offset);
        expect(answers.length).to.eq(Math.min(sampleAnswers.length - offset, 10));
        for (let i = 0; i < answers.length; i++) {
          expect(answers[i]).to.deep.eq(sampleAnswers[i + offset]);
        }
      });

      it('can retrieve answers with offset that doesn\'t result not full page', async() => {
        const offset = 17;
        const answers = await sc0.getAnswers(contract, accounts[0], anweredCallId, 10, offset);
        expect(answers.length).to.eq(Math.min(sampleAnswers.length - offset, 10));
        for (let i = 0; i < answers.length; i++) {
          expect(answers[i]).to.deep.eq(sampleAnswers[i + offset]);
        }
      });

      it('can retrieve answers with limited page size and offset', async() => {
        const count = 2;
        const offset = 17;
        const answers = await sc0.getAnswers(contract, accounts[0], anweredCallId, 2, offset);
        expect(answers.length).to.eq(Math.min(sampleAnswers.length - offset, count));
        for (let i = 0; i < answers.length; i++) {
          expect(answers[i]).to.deep.eq(sampleAnswers[i + offset]);
        }
      });

      it('can retrieve answers in reverse order', async() => {
        const answers = await sc0.getAnswers(contract, accounts[0], anweredCallId, 10, 0, true);
        expect(answers.length).to.eq(10);
        for (let i = 0; i < answers.length; i++) {
          expect(answers[i]).to.deep.eq(sampleAnswers[sampleAnswers.length - 1 - i]);
        }
      });

      it('can retrieve answers in reverse order with a limited page size', async() => {
        const count = 2;
        const answers = await sc0.getAnswers(contract, accounts[0], anweredCallId, count, 0, true);
        expect(answers.length).to.eq(Math.min(sampleAnswers.length, count));
        for (let i = 0; i < answers.length; i++) {
          expect(answers[i]).to.deep.eq(sampleAnswers[sampleAnswers.length - 1 - i]);
        }
      });

      it('can retrieve answers in reverse order with offset that results in a full page', async() => {
        const offset = 7;
        const answers = await sc0.getAnswers(contract, accounts[0], anweredCallId, 10, offset, true);
        expect(answers.length).to.eq(Math.min(sampleAnswers.length - offset, 10));
        for (let i = 0; i < answers.length; i++) {
          expect(answers[i]).to.deep.eq(sampleAnswers[sampleAnswers.length - 1 - i - offset]);
        }
      });

      it('can retrieve answers with offset that doesn\'t result not full page', async() => {
        const offset = 17;
        const answers = await sc0.getAnswers(contract, accounts[0], anweredCallId, 10, offset, true);
        expect(answers.length).to.eq(Math.min(sampleAnswers.length - offset, 10));
        for (let i = 0; i < answers.length; i++) {
          expect(answers[i]).to.deep.eq(sampleAnswers[sampleAnswers.length - 1 - i - offset]);
        }
      });

      it('can retrieve answers with limited page size and offset', async() => {
        const count = 2;
        const offset = 17;
        const answers = await sc0.getAnswers(contract, accounts[0], anweredCallId, 2, offset, true);
        expect(answers.length).to.eq(Math.min(sampleAnswers.length - offset, count));
        for (let i = 0; i < answers.length; i++) {
          expect(answers[i]).to.deep.eq(sampleAnswers[sampleAnswers.length - 1 - i - offset]);
        }
      });
    });
  });

  it('can send and read service message with nested encryption', async () => {
    // create call with a custom property, that contains cryptoInfo and private
    const contract = await sc0.create(accounts[0], businessCenterDomain, sampleService1);
    const callForNesting = JSON.parse(JSON.stringify(sampleCall));

    // get cryptor for annotating encryption of properties
    const cryptor = sc0.options.cryptoProvider.getCryptorByCryptoAlgo(sc0.options.defaultCryptoAlgo);
    callForNesting.payload.privateData = {
      private: {
        someNumber: Math.random(),
        someText: `I like randomNumbers in payload, for example: ${Math.random()}`,
      },
      cryptoInfo: cryptor.getCryptoInfo(sc0.options.nameResolver.soliditySha3(contract.options.address)),
    };
    callForNesting.metadata.privateData = {
      private: `I like randomNumbers in metadata, for example: ${Math.random()}`,
      cryptoInfo: cryptor.getCryptoInfo(sc0.options.nameResolver.soliditySha3(contract.options.address)),
    };
    // send it as usual (to-encrypt properties are encrypted automatically); invite participant
    const callId = await sc0.sendCall(contract, accounts[0], callForNesting, [accounts[2]]);

    // fetch with creator
    let call = await sc0.getCall(contract, accounts[0], callId);
    expect(call).to.deep.eq(callForNesting);

    // fetch with participant
    call = await sc2.getCall(contract, accounts[2], callId);
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
    await sc0.addToCallSharing(contract, accounts[0], callId, [accounts[2]], null, null, 'privateData');
    // fetch again
    sc2.options.sharing.clearCache();
    call = await sc2.getCall(contract, accounts[2], callId);
    expect(call).to.deep.eq(callForNesting);
  });
});
