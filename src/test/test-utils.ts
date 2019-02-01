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

import crypto = require('crypto');

import IpfsApi = require('ipfs-api');
import smartContract = require('@evan.network/smart-contracts-core');
import Web3 = require('web3');

import {
  AccountStore,
  ContractLoader,
  DfsInterface,
  EventHub,
  Executor,
  KeyProvider,
  Logger,
  SignerInternal,
  Unencrypted,
} from '@evan.network/dbcp';

import { accountMap } from './accounts';
import { accounts } from './accounts';
import { Aes } from '../encryption/aes';
import { AesEcb } from '../encryption/aes-ecb';
import { BaseContract } from '../contracts/base-contract/base-contract';
import { Claims } from '../claims/claims';
import { config } from './../config';
import { CryptoProvider } from '../encryption/crypto-provider';
import { DataContract } from '../contracts/data-contract/data-contract';
import { ExecutorWallet } from '../contracts/executor-wallet';
import { Ipld } from '../dfs/ipld';
import { Ipfs } from '../dfs/ipfs';
import { NameResolver } from '../name-resolver';
import { Profile } from '../profile/profile';
import { RightsAndRoles } from '../contracts/rights-and-roles';
import { ServiceContract } from '../contracts/service-contract/service-contract';
import { setTimeout } from 'timers';
import { Description } from '../shared-description';
import { Sharing } from '../contracts/sharing';
import { Votings } from '../votings/votings';
import { Wallet } from '../contracts/wallet';


export const publicMailBoxExchange = 'mailboxKeyExchange';
export const sampleContext = 'context sample';

const web3Provider = <any>process.env.CHAIN_ENDPOINT || 'wss://testcore.evan.network/ws';
const helperWeb3 = new Web3(null);
const sampleKeys = {};
// dataKeys
sampleKeys[helperWeb3.utils.soliditySha3(accounts[0])] =
  '001de828935e8c7e4cb56fe610495cae63fb2612000000000000000000000000';    // plain acc0 key
sampleKeys[helperWeb3.utils.soliditySha3(accounts[1])] =
  '0030c5e7394585400b1fb193ddbcb45a37ab916e000000000000000000000011';    // plain acc1 key
sampleKeys[helperWeb3.utils.soliditySha3(sampleContext)] =
  '00000000000000000000000000000000000000000000000000000000005a3973';
sampleKeys[helperWeb3.utils.soliditySha3(publicMailBoxExchange)] =
  '346c22768f84f3050f5c94cec98349b3c5cbfa0b7315304e13647a4918ffff22';    // accX <--> mailbox edge key
sampleKeys[helperWeb3.utils.soliditySha3('wulfwulf.test')] =
  '00000000000000000000000000000000000000000000000000000000005a3973';
sampleKeys[helperWeb3.utils.soliditySha3(accounts[2])] =
  '00d1267b27c3a80080f9e1b6ba01de313b53ab58000000000000000000000022';

// commKeys
sampleKeys[helperWeb3.utils.soliditySha3.apply(helperWeb3.utils.soliditySha3,
  [helperWeb3.utils.soliditySha3(accounts[0]), helperWeb3.utils.soliditySha3(accounts[0])].sort())] =
    '001de828935e8c7e4cb56fe610495cae63fb2612000000000000000000000000';    // acc0 <--> acc0 edge key
sampleKeys[helperWeb3.utils.soliditySha3.apply(helperWeb3.utils.soliditySha3,
  [helperWeb3.utils.soliditySha3(accounts[0]), helperWeb3.utils.soliditySha3(accounts[1])].sort())] =
    '001de828935e8c7e4cb50030c5e7394585400b1f000000000000000000000001';    // acc0 <--> acc1 edge key
sampleKeys[helperWeb3.utils.soliditySha3.apply(helperWeb3.utils.soliditySha3,
  [helperWeb3.utils.soliditySha3(accounts[0]), helperWeb3.utils.soliditySha3(accounts[2])].sort())] =
    '001de828935e8c7e4cb500d1267b27c3a80080f9000000000000000000000002';    // acc0 <--> acc1 edge key
sampleKeys[helperWeb3.utils.soliditySha3.apply(helperWeb3.utils.soliditySha3,
  [helperWeb3.utils.soliditySha3(accounts[1]), helperWeb3.utils.soliditySha3(accounts[1])].sort())] =
    '0030c5e7394585400b1fb193ddbcb45a37ab916e000000000000000000000011';
sampleKeys[helperWeb3.utils.soliditySha3.apply(helperWeb3.utils.soliditySha3,
  [helperWeb3.utils.soliditySha3(accounts[1]), helperWeb3.utils.soliditySha3(accounts[2])].sort())] =
    '0030c5e7394585400b1f00d1267b27c3a80080f9000000000000000000000012';    // acc1 <--> acc2 edge key
sampleKeys[helperWeb3.utils.soliditySha3.apply(helperWeb3.utils.soliditySha3,
  [helperWeb3.utils.soliditySha3(accounts[2]), helperWeb3.utils.soliditySha3(accounts[2])].sort())] =
    '00d1267b27c3a80080f9e1b6ba01de313b53ab58000000000000000000000022';


export class TestUtils {
  static getAccountStore(options): AccountStore {
    return new AccountStore({ accounts: accountMap, });
  }

  static async getBaseContract(web3): Promise<BaseContract> {
    const eventHub = await this.getEventHub(web3);
    const executor = await this.getExecutor(web3);
    executor.eventHub = eventHub;
    return new BaseContract({
      executor,
      loader: await TestUtils.getContractLoader(web3),
      log: Logger.getDefaultLog(),
      nameResolver: await TestUtils.getNameResolver(web3),
    });
  };

  static async getClaims(web3, dfs): Promise<Claims> {
    const eventHub = await this.getEventHub(web3);
    const executor = await this.getExecutor(web3);
    executor.eventHub = eventHub;
    return new Claims({
      contractLoader: await TestUtils.getContractLoader(web3),
      config,
      description: await TestUtils.getDescription(web3, dfs),
      executor,
      nameResolver: await this.getNameResolver(web3),
      accountStore: this.getAccountStore({}),
      dfs
    });
  }

  static getConfig(): any {
    return config;
  }

  static async getContractLoader(web3): Promise<ContractLoader> {
    const contracts = await this.getContracts();
    return new ContractLoader({
      contracts,
      web3
    });
  }

  static async getContracts() {
    const solc = new smartContract.Solc({
      log: Logger.getDefaultLog(),
      config: { compileContracts: false, },
    });
    await solc.ensureCompiled();
    return solc.getContracts();
  }

  static getCryptoProvider() {
    const cryptor = new Aes();
    const unencryptedCryptor = new Unencrypted();
    const cryptoConfig = {};
    const cryptoInfo = cryptor.getCryptoInfo(helperWeb3.utils.soliditySha3(accounts[0]));
    cryptoConfig['aes'] = cryptor;
    cryptoConfig['aesEcb'] = new AesEcb();
    cryptoConfig['unencrypted'] = unencryptedCryptor;
    return new CryptoProvider(cryptoConfig);
  }

  static async getDataContract(web3, dfs) {
    const sharing = await this.getSharing(web3, dfs);
    const description = await this.getDescription(web3, dfs);
    description.sharing = sharing;
    const eventHub = await this.getEventHub(web3);
    const executor = await this.getExecutor(web3);
    executor.eventHub = eventHub;
    return new DataContract({
      cryptoProvider: this.getCryptoProvider(),
      dfs,
      executor,
      loader: await this.getContractLoader(web3),
      log: TestUtils.getLogger(),
      nameResolver: await this.getNameResolver(web3),
      sharing,
      web3: TestUtils.getWeb3(),
      description: await TestUtils.getDescription(web3, dfs),
    });
  }

  static async getDescription(web3, dfsParam?: DfsInterface): Promise<Description> {
    const executor = await this.getExecutor(web3);
    const contracts = await this.getContracts();
    const contractLoader = await this.getContractLoader(web3);
    const dfs = dfsParam || await this.getIpfs();
    const nameResolver =  await this.getNameResolver(web3);
    const cryptoProvider = this.getCryptoProvider();
    return new Description({
      contractLoader,
      cryptoProvider,
      dfs,
      executor,
      keyProvider: this.getKeyProvider(),
      nameResolver,
      sharing: null,
      web3,
    });
  }

  static async getEventHub(web3): Promise<EventHub> {
    return new EventHub({
      config: config.nameResolver,
      contractLoader: await this.getContractLoader(web3),
      log: this.getLogger(),
      nameResolver: await this.getNameResolver(web3),
    });
  }

  static async getExecutor(web3, isReadonly?): Promise<Executor> {
    if (isReadonly) {
      return new Executor({});
    } else {
      const contracts = await this.getContracts();
      const contractLoader =  new ContractLoader({
        contracts,
        web3,
      });
      const accountStore = this.getAccountStore({});
      const signer = new SignerInternal({
        accountStore,
        contractLoader,
        config: {},
        web3,
      });
      const executor = new Executor({ config, signer, web3, });
      await executor.init({});

      return executor;
    }
  }

  static async getExecutorWallet(web3, wallet, accountId, dfsParam?: DfsInterface): Promise<ExecutorWallet> {
    const contracts = await this.getContracts();
    const contractLoader =  new ContractLoader({
      contracts,
      web3,
    });
    const accountStore = this.getAccountStore({});
    const signer = new SignerInternal({
      accountStore,
      contractLoader,
      config: {},
      web3,
    });
    const executor = new ExecutorWallet({ accountId, config, contractLoader, signer, wallet, web3, });
    await executor.init({});

    return executor;
  }

  static async getIpld(_ipfs?: Ipfs, _keyProvider?: KeyProvider): Promise<Ipld> {
    const cryptor = new Aes();
    const key = await cryptor.generateKey();
    const ipfs = _ipfs ? _ipfs : await this.getIpfs();
    const nameResolver = await this.getNameResolver(await this.getWeb3());
    return new Promise<Ipld>((resolve) => {
      // crypto provider
      const cryptoConfig = {};
      const cryptoInfo = cryptor.getCryptoInfo(helperWeb3.utils.soliditySha3(accounts[0]));
      const cryptoProvider = this.getCryptoProvider();
      // key provider
      const keyProvider = _keyProvider ||  (new KeyProvider({ keys: sampleKeys, }));

      resolve(new Ipld({
        ipfs,
        keyProvider,
        cryptoProvider,
        defaultCryptoAlgo: 'aes',
        originator: nameResolver.soliditySha3(accounts[0]),
        nameResolver,
      }))
    });
  }

  static async getIpfs(): Promise<Ipfs> {
    const pk = await this.getAccountStore(null).getPrivateKey(accounts[0]);
    const ipfs = new Ipfs({
      dfsConfig: {host: 'ipfs.evan.network', port: '443', protocol: 'https'},
      accountId: accounts[0],
      privateKey: `0x${pk}`,
      web3: this.getWeb3()
    });
    return ipfs;
  }

  static getKeyProvider(requestedKeys?: string[]) {
    let keys;
    if (!requestedKeys) {
      keys = sampleKeys;
    } else {
      keys = {};
      requestedKeys.forEach((key) => {
        keys[key] = sampleKeys[key];
      });
    }
    return new KeyProvider({ keys, });
  }

  static getKeys(): any {
    return sampleKeys;
  }

  static getLogger(): Function {
    return Logger.getDefaultLog();
  }

  static async getNameResolver(web3): Promise<NameResolver> {
    const contracts = await this.getContracts();
    const contractLoader =  new ContractLoader({
      contracts,
      web3,
    });
    const executor = await this.getExecutor(web3);
    const nameResolver = new NameResolver({
      config: config.nameResolver,
      executor,
      contractLoader,
      web3,
    });

    return nameResolver;
  }

  static async getProfile(web3, ipfs?, ipld?, accountId?): Promise<Profile> {
    const executor = await TestUtils.getExecutor(web3);
    executor.eventHub = await TestUtils.getEventHub(web3);
    const profile = new Profile({
      accountId: accountId || accounts[0],
      contractLoader: await TestUtils.getContractLoader(web3),
      dataContract: await TestUtils.getDataContract(web3, ipfs),
      defaultCryptoAlgo: 'aes',
      executor,
      ipld: ipld || await TestUtils.getIpld(ipfs),
      nameResolver: await TestUtils.getNameResolver(web3),
    });
    return profile;
  }

  static getRandomAddress(): string {
    return helperWeb3.utils.toChecksumAddress(`0x${crypto.randomBytes(20).toString('hex')}`);
  }

  static getRandomBytes32(): string {
    return `0x${crypto.randomBytes(32).toString('hex')}`;
  }

  static async getRightsAndRoles(web3) {
    return new RightsAndRoles({
      contractLoader: await TestUtils.getContractLoader(web3),
      executor: await TestUtils.getExecutor(web3) ,
      nameResolver: await TestUtils.getNameResolver(web3),
      web3,
    });
  }

  static async getServiceContract(web3, ipfs?: Ipfs, keyProvider?: KeyProvider) {
    const executor = await TestUtils.getExecutor(web3);
    executor.eventHub = await TestUtils.getEventHub(web3);
    const dfs = ipfs || await TestUtils.getIpfs();
    return new ServiceContract({
      cryptoProvider: TestUtils.getCryptoProvider(),
      dfs,
      executor,
      keyProvider: keyProvider || TestUtils.getKeyProvider(),
      loader: await TestUtils.getContractLoader(web3),
      log: TestUtils.getLogger(),
      nameResolver: await TestUtils.getNameResolver(web3),
      sharing: await TestUtils.getSharing(web3, ipfs),
      web3,
    });
  }

  static async getSharing(web3, dfsParam?: DfsInterface): Promise<Sharing> {
    const dfs = dfsParam ? dfsParam : await TestUtils.getIpfs();
    return new Sharing({
      contractLoader: await TestUtils.getContractLoader(web3),
      cryptoProvider: TestUtils.getCryptoProvider(),
      description: await TestUtils.getDescription(web3, dfs),
      executor: await TestUtils.getExecutor(web3),
      dfs,
      keyProvider: TestUtils.getKeyProvider(),
      nameResolver: await TestUtils.getNameResolver(web3),
      defaultCryptoAlgo: 'aes',
    });
  }

  static async getVotings(web3): Promise<Votings> {
    const executor = await TestUtils.getExecutor(web3);
    executor.eventHub = await TestUtils.getEventHub(web3);
    return new Votings({
      contractLoader: await this.getContractLoader(web3),
      executor,
      nameResolver: await this.getNameResolver(web3),
    });
  }

  static async getWallet(web3, dfsParam?: DfsInterface): Promise<Wallet> {
    const dfs = dfsParam ? dfsParam : await TestUtils.getIpfs();
    const executor = await TestUtils.getExecutor(web3);
    executor.eventHub = await TestUtils.getEventHub(web3);
    return new Wallet({
      contractLoader: await TestUtils.getContractLoader(web3),
      description: await TestUtils.getDescription(web3, dfs),
      eventHub: executor.eventHub,
      executor,
      nameResolver: await TestUtils.getNameResolver(web3),
    });
  }

  static getWeb3(provider = web3Provider) {
    // connect to web3
    const wsp = new Web3.providers.WebsocketProvider(
      provider, { clientConfig: { keepalive: true, keepaliveInterval: 5000 } });
    return new Web3(wsp);
  }

  static async nextBlock(executor: Executor, accoutId: string): Promise<void> {
    await executor.executeSend({ from: accoutId, value: 0, to: accoutId });
  };

  static async sleep(ms): Promise<void> {
    await new Promise(s => setTimeout(() => s(), ms));
  }
}
