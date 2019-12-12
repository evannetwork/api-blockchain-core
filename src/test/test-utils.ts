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

import * as Web3 from 'web3';
import crypto = require('crypto');
import smartContract = require('@evan.network/smart-contracts-core');

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
import { createDefaultRuntime, Runtime } from '../index';
import { Aes } from '../encryption/aes';
import { AesBlob } from '../encryption/aes-blob';
import { AesEcb } from '../encryption/aes-ecb';
import { BaseContract } from '../contracts/base-contract/base-contract';
import { Verifications } from '../verifications/verifications';
import { configTestcore as config } from './../config-testcore';
import { CryptoProvider } from '../encryption/crypto-provider';
import { DataContract } from '../contracts/data-contract/data-contract';
import { DidResolver } from '../did/did-resolver';
import { EncryptionWrapper } from '../encryption/encryption-wrapper';
import { ExecutorWallet } from '../contracts/executor-wallet';
import { Ipld } from '../dfs/ipld';
import { Ipfs } from '../dfs/ipfs';
import { NameResolver } from '../name-resolver';
import { Payments } from '../payments';
import { Profile } from '../profile/profile';
import { RightsAndRoles } from '../contracts/rights-and-roles';
import { ServiceContract } from '../contracts/service-contract/service-contract';
import { SignerIdentity } from '../contracts/signer-identity';
import { setTimeout } from 'timers';
import { Description } from '../shared-description';
import { Sharing } from '../contracts/sharing';
import { Votings } from '../votings/votings';
import { Wallet } from '../contracts/wallet';


export const publicMailBoxExchange = 'mailboxKeyExchange';
export const sampleContext = 'context sample';

const web3Provider = (process.env.CHAIN_ENDPOINT as any) || 'wss://testcore.evan.network/ws';
// due to issues with typings in web3 remove type from Web3
const localWeb3 = new (Web3 as any)(web3Provider, null, { transactionConfirmationBlocks: 1 });
const sampleKeys = {};
// dataKeys
sampleKeys[localWeb3.utils.soliditySha3(accounts[0])] =
  '001de828935e8c7e4cb56fe610495cae63fb2612000000000000000000000000';    // plain acc0 key
sampleKeys[localWeb3.utils.soliditySha3(accounts[1])] =
  '0030c5e7394585400b1fb193ddbcb45a37ab916e000000000000000000000011';    // plain acc1 key
sampleKeys[localWeb3.utils.soliditySha3(sampleContext)] =
  '00000000000000000000000000000000000000000000000000000000005a3973';
sampleKeys[localWeb3.utils.soliditySha3(publicMailBoxExchange)] =
  '346c22768f84f3050f5c94cec98349b3c5cbfa0b7315304e13647a4918ffff22';    // accX <--> mailbox edge key
sampleKeys[localWeb3.utils.soliditySha3('wulfwulf.test')] =
  '00000000000000000000000000000000000000000000000000000000005a3973';
sampleKeys[localWeb3.utils.soliditySha3(accounts[2])] =
  '00d1267b27c3a80080f9e1b6ba01de313b53ab58000000000000000000000022';
sampleKeys[localWeb3.utils.soliditySha3(accounts[3])] =
  '483257531bc9456ea783e44d325f8a384a4b89da81dac00e589409431692f218';

// commKeys
sampleKeys[localWeb3.utils.soliditySha3.apply(localWeb3.utils.soliditySha3,
  [localWeb3.utils.soliditySha3(accounts[0]), localWeb3.utils.soliditySha3(accounts[0])].sort())] =
    '001de828935e8c7e4cb56fe610495cae63fb2612000000000000000000000000';    // acc0 <--> acc0 edge key
sampleKeys[localWeb3.utils.soliditySha3.apply(localWeb3.utils.soliditySha3,
  [localWeb3.utils.soliditySha3(accounts[0]), localWeb3.utils.soliditySha3(accounts[1])].sort())] =
    '001de828935e8c7e4cb50030c5e7394585400b1f000000000000000000000001';    // acc0 <--> acc1 edge key
sampleKeys[localWeb3.utils.soliditySha3.apply(localWeb3.utils.soliditySha3,
  [localWeb3.utils.soliditySha3(accounts[0]), localWeb3.utils.soliditySha3(accounts[2])].sort())] =
    '001de828935e8c7e4cb500d1267b27c3a80080f9000000000000000000000002';    // acc0 <--> acc1 edge key
sampleKeys[localWeb3.utils.soliditySha3.apply(localWeb3.utils.soliditySha3,
  [localWeb3.utils.soliditySha3(accounts[1]), localWeb3.utils.soliditySha3(accounts[1])].sort())] =
    '0030c5e7394585400b1fb193ddbcb45a37ab916e000000000000000000000011';
sampleKeys[localWeb3.utils.soliditySha3.apply(localWeb3.utils.soliditySha3,
  [localWeb3.utils.soliditySha3(accounts[1]), localWeb3.utils.soliditySha3(accounts[2])].sort())] =
    '0030c5e7394585400b1f00d1267b27c3a80080f9000000000000000000000012';    // acc1 <--> acc2 edge key
sampleKeys[localWeb3.utils.soliditySha3.apply(localWeb3.utils.soliditySha3,
  [localWeb3.utils.soliditySha3(accounts[2]), localWeb3.utils.soliditySha3(accounts[2])].sort())] =
    '00d1267b27c3a80080f9e1b6ba01de313b53ab58000000000000000000000022';
sampleKeys[localWeb3.utils.soliditySha3.apply(localWeb3.utils.soliditySha3,
  [localWeb3.utils.soliditySha3(accounts[3]), localWeb3.utils.soliditySha3(accounts[3])].sort())] =
    '483257531bc9456ea783e44d325f8a384a4b89da81dac00e589409431692f218';


export class TestUtils {
  public static getAccountStore(): AccountStore {
    return new AccountStore({ accounts: accountMap, });
  }

  public static async getBaseContract(web3): Promise<BaseContract> {
    const eventHub = await this.getEventHub(web3);
    const executor = await this.getExecutor(web3);
    executor.eventHub = eventHub;
    return new BaseContract({
      executor,
      loader: await TestUtils.getContractLoader(web3),
      log: Logger.getDefaultLog(),
      nameResolver: await TestUtils.getNameResolver(web3),
    });
  }

  public static getConfig(): any {
    return config;
  }

  public static async getContractLoader(web3): Promise<ContractLoader> {
    const contracts = await this.getContracts();
    return new ContractLoader({
      contracts,
      web3
    });
  }

  public static async getContracts() {
    const solc = new smartContract.Solc({
      log: Logger.getDefaultLog(),
      config: { compileContracts: false, },
    });
    await solc.ensureCompiled();
    const contracts = solc.getContracts();

    return contracts;
  }

  public static getCryptoProvider(dfs?: any) {
    const cryptor = new Aes();
    const unencryptedCryptor = new Unencrypted();
    const cryptoConfig = {};
    cryptoConfig['aes'] = cryptor;
    cryptoConfig['aesEcb'] = new AesEcb();
    cryptoConfig['unencrypted'] = unencryptedCryptor;
    if (dfs) {
      cryptoConfig['aesBlob'] = new AesBlob({ dfs });
    }
    return new CryptoProvider(cryptoConfig);
  }

  public static async getDataContract(web3, dfs, requestedKeys?: string[]) {
    const sharing = await this.getSharing(web3, dfs, requestedKeys);
    const description = await this.getDescription(web3, dfs, requestedKeys);
    description.sharing = sharing;
    const eventHub = await this.getEventHub(web3);
    const executor = await this.getExecutor(web3);
    executor.eventHub = eventHub;
    return new DataContract({
      cryptoProvider: this.getCryptoProvider(dfs),
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

  public static async getDescription(web3, dfsParam?: DfsInterface, requestedKeys?: string[]): Promise<Description> {
    const executor = await this.getExecutor(web3);
    const contractLoader = await this.getContractLoader(web3);
    const dfs = dfsParam || await this.getIpfs();
    const nameResolver =  await this.getNameResolver(web3);
    const cryptoProvider = this.getCryptoProvider();
    return new Description({
      contractLoader,
      cryptoProvider,
      dfs,
      executor,
      keyProvider: this.getKeyProvider(requestedKeys),
      nameResolver,
      sharing: null,
      web3,
    });
  }

  public static async getDidResolver(web3: any, accountId?: string, dfs?: any): Promise<DidResolver> {
    const signerIdentity = await this.getSignerIdentity(web3, accountId);
    const executor = new Executor(
      { config: { alwaysAutoGasLimit: 1.1 }, signer: signerIdentity, web3 });
    await executor.init({ eventHub: await TestUtils.getEventHub(web3) });

    return new DidResolver({
      contractLoader: await this.getContractLoader(web3),
      dfs: dfs || (await this.getIpfs()),
      executor,
      nameResolver: await this.getNameResolver(web3),
      signerIdentity,
      web3,
    });
  }

  public static async getEncryptionWrapper(web3: any, dfs: DfsInterface, requestedKeys?: string[]
  ): Promise<EncryptionWrapper> {
    return new EncryptionWrapper({
      cryptoProvider: this.getCryptoProvider(),
      nameResolver: await this.getNameResolver(web3),
      profile: await this.getProfile(web3, dfs),
      sharing: await this.getSharing(web3, dfs, requestedKeys),
      web3,
    });
  }

  public static async getEventHub(web3): Promise<EventHub> {
    return new EventHub({
      config: config.nameResolver,
      contractLoader: await this.getContractLoader(web3),
      log: this.getLogger(),
      nameResolver: await this.getNameResolver(web3),
    });
  }

  public static async getExecutor(web3: any, isReadonly = false): Promise<Executor> {
    if (isReadonly) {
      return new Executor({});
    } else {
      const contracts = await this.getContracts();
      const contractLoader =  new ContractLoader({
        contracts,
        web3,
      });
      const accountStore = this.getAccountStore();
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

  public static async getExecutorWallet(web3, wallet, accountId): Promise<ExecutorWallet> {
    const contracts = await this.getContracts();
    const contractLoader =  new ContractLoader({
      contracts,
      web3,
    });
    const accountStore = this.getAccountStore();
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

  public static async getIpfs(): Promise<Ipfs> {
    const contracts = await this.getContracts();
    const accountStore = this.getAccountStore();
    const contractLoader =  new ContractLoader({
      contracts,
      web3: this.getWeb3(),
    });
    const signer = new SignerInternal({
      accountStore,
      contractLoader,
      config: {},
      web3: this.getWeb3(),
    });
    const ipfs = new Ipfs({
      dfsConfig: {host: 'ipfs.test.evan.network', port: '443', protocol: 'https'},
      disablePin: true
    });
    ipfs.setRuntime({ signer, activeAccount: accounts[0], web3: this.getWeb3() });
    return ipfs;
  }

  public static async getIpld(_ipfs?: Ipfs, _keyProvider?: KeyProvider): Promise<Ipld> {
    const ipfs = _ipfs ? _ipfs : await this.getIpfs();
    const nameResolver = await this.getNameResolver(await this.getWeb3());
    return new Promise<Ipld>((resolve) => {
      // crypto provider
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

  public static getKeyProvider(requestedKeys?: string[]) {
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

  public static getKeys(): any {
    return sampleKeys;
  }

  public static getLogger(): Function {
    return Logger.getDefaultLog();
  }

  public static async getNameResolver(web3): Promise<NameResolver> {
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

  public static async nextBlock(executor: Executor, accoutId: string): Promise<void> {
    await executor.executeSend({ from: accoutId, value: 0, to: accoutId });
  }

  public static async getPayments(web3): Promise<Payments> {
    const executor = await TestUtils.getExecutor(web3);
    const eventHub = await TestUtils.getEventHub(web3);
    executor.eventHub = eventHub;
    const payments = new Payments({
      web3,
      accountStore: this.getAccountStore(),
      contractLoader: await TestUtils.getContractLoader(web3),
      executor,
    });
    payments.startBlock = await web3.eth.getBlockNumber();
    return payments;
  }

  public static async getProfile(web3, ipfs?, ipld?, accountId?): Promise<Profile> {
    const executor = await TestUtils.getExecutor(web3);
    const dfs = ipfs || await TestUtils.getIpfs();
    executor.eventHub = await TestUtils.getEventHub(web3);

    const profile = new Profile({
      accountId: accountId || accounts[0],
      contractLoader: await TestUtils.getContractLoader(web3),
      cryptoProvider: await TestUtils.getCryptoProvider(),
      dataContract: await TestUtils.getDataContract(web3, dfs),
      defaultCryptoAlgo: 'aes',
      dfs,
      description: await TestUtils.getDescription(web3),
      executor,
      ipld: ipld || await TestUtils.getIpld(dfs),
      nameResolver: await TestUtils.getNameResolver(web3),
      rightsAndRoles: await TestUtils.getRightsAndRoles(web3),
      sharing: await TestUtils.getSharing(web3),
    });

    return profile;
  }

  public static getRandomAddress(): string {
    return localWeb3.utils.toChecksumAddress(`0x${crypto.randomBytes(20).toString('hex')}`);
  }

  public static getRandomBytes32(): string {
    return `0x${crypto.randomBytes(32).toString('hex')}`;
  }

  public static async getRightsAndRoles(web3) {
    return new RightsAndRoles({
      contractLoader: await TestUtils.getContractLoader(web3),
      executor: await TestUtils.getExecutor(web3) ,
      nameResolver: await TestUtils.getNameResolver(web3),
      web3,
    });
  }

  public static async getRuntime(accountId, requestedKeys?, customConfig = {}): Promise<Runtime> {
    let keys;
    if (!requestedKeys) {
      keys = sampleKeys;
    } else {
      keys = {};
      requestedKeys.forEach((key) => {
        keys[key] = sampleKeys[key];
      });
    }
    return createDefaultRuntime(
      await TestUtils.getWeb3(),
      await TestUtils.getIpfs(),
      {
        accountMap: { [accountId]: accountMap[accountId] },
        keyConfig: keys,
        ...customConfig,
      }
    );
  }

  public static async getServiceContract(web3, ipfs?: Ipfs, keyProvider?: KeyProvider) {
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

  public static async getSharing(web3, dfsParam?: DfsInterface, requestedKeys?: string[]): Promise<Sharing> {
    const dfs = dfsParam ? dfsParam : await TestUtils.getIpfs();
    return new Sharing({
      contractLoader: await TestUtils.getContractLoader(web3),
      cryptoProvider: TestUtils.getCryptoProvider(),
      description: await TestUtils.getDescription(web3, dfs, requestedKeys),
      executor: await TestUtils.getExecutor(web3),
      dfs,
      keyProvider: TestUtils.getKeyProvider(requestedKeys),
      nameResolver: await TestUtils.getNameResolver(web3),
      defaultCryptoAlgo: 'aes',
    });
  }

  public static async getSignerIdentity(web3: any, accountId = accounts[0]): Promise<SignerIdentity> {
    const contracts = await TestUtils.getContracts();
    const contractLoader =  new ContractLoader({
      contracts,
      web3,
    });
    const accountStore = TestUtils.getAccountStore();
    const verifications = await TestUtils.getVerifications(web3, await TestUtils.getIpfs());
    const underlyingSigner = new SignerInternal({
      accountStore,
      contractLoader,
      config: {},
      web3,
    });
    return new SignerIdentity(
      {
        contractLoader,
        verifications,
        web3,
      },
      {
        activeIdentity: await verifications.getIdentityForAccount(accountId, true),
        underlyingAccount: accountId,
        underlyingSigner,
      },
    );
  }

  public static async getVerifications(web3, dfs?, requestedKeys?: string[]): Promise<Verifications> {
    const eventHub = await this.getEventHub(web3);
    const executor = await this.getExecutor(web3);
    executor.eventHub = eventHub;
    return new Verifications({
      config,
      contractLoader: await TestUtils.getContractLoader(web3),
      description: await TestUtils.getDescription(web3, dfs, requestedKeys),
      executor,
      nameResolver: await this.getNameResolver(web3),
      accountStore: this.getAccountStore(),
      dfs: dfs || (await this.getIpfs())
    });
  }

  public static async getVotings(web3): Promise<Votings> {
    const executor = await TestUtils.getExecutor(web3);
    executor.eventHub = await TestUtils.getEventHub(web3);
    return new Votings({
      contractLoader: await this.getContractLoader(web3),
      executor,
      nameResolver: await this.getNameResolver(web3),
    });
  }

  public static async getWallet(web3, dfsParam?: DfsInterface): Promise<Wallet> {
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

  public static getWeb3() {
    // connect to web3
    return localWeb3;
  }

  public static async sleep(ms): Promise<void> {
    await new Promise(s => setTimeout(() => s(), ms));
  }
}
