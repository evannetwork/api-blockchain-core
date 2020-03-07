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

import { configTestcore as config } from '../config-testcore';
import {
  AccountStore,
  Aes,
  AesBlob,
  AesEcb,
  BaseContract,
  ContractLoader,
  CryptoProvider,
  DataContract,
  Description,
  DfsInterface,
  Did,
  EncryptionWrapper,
  EventHub,
  Executor,
  ExecutorWallet,
  Ipfs,
  Ipld,
  KeyProvider,
  Logger,
  NameResolver,
  Payments,
  Profile,
  RightsAndRoles,
  ServiceContract,
  Sharing,
  SignerIdentity,
  SignerInternal,
  Unencrypted,
  Verifications,
  Votings,
  Wallet,
} from '../index';
import {
  Runtime,
  createDefaultRuntime,
} from '../runtime';
import {
  accountMap,
  accounts,
  dataKeys,
  identities,
} from './accounts';

import crypto = require('crypto');
import smartContract = require('@evan.network/smart-contracts-core');


export const publicMailBoxExchange = 'mailboxKeyExchange';
export const sampleContext = 'context sample';

const web3Provider = (process.env.CHAIN_ENDPOINT as any) || 'wss://testcore.evan.network/ws';
// due to issues with typings in web3 remove type from Web3
const localWeb3 = new (Web3 as any)(web3Provider, null, { transactionConfirmationBlocks: 1 });


export class TestUtils {
  public static getAccountStore(): AccountStore {
    return new AccountStore({ accounts: accountMap });
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
      web3,
    });
  }

  public static async getContracts() {
    const solc = new smartContract.Solc({
      log: Logger.getDefaultLog(),
      config: { compileContracts: false },
    });
    await solc.ensureCompiled();
    const contracts = solc.getContracts();

    return contracts;
  }

  public static getCryptoProvider(dfs?: any) {
    const cryptor = new Aes();
    const unencryptedCryptor = new Unencrypted();
    const cryptoConfig = {};
    (cryptoConfig as any).aes = cryptor;
    (cryptoConfig as any).aesEcb = new AesEcb();
    (cryptoConfig as any).unencrypted = unencryptedCryptor;
    if (dfs) {
      (cryptoConfig as any).aesBlob = new AesBlob({ dfs });
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

  public static async getDescription(
    web3,
    dfsParam?: DfsInterface,
    requestedKeys?: string[],
    useIdentity = false,
    accountId?: string,
  ): Promise<Description> {
    const executor = await this.getExecutor(web3, false, useIdentity, accountId);
    const contractLoader = await this.getContractLoader(web3);
    const dfs = dfsParam || await this.getIpfs(useIdentity);
    const nameResolver = await this.getNameResolver(web3);
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

  public static async getDid(web3: any, accountId?: string, dfs?: any): Promise<Did> {
    const signerIdentity = await this.getSignerIdentity(web3, accountId);
    const executor = new Executor(
      { config: { alwaysAutoGasLimit: 1.1 }, signer: signerIdentity, web3 },
    );
    await executor.init({ eventHub: await TestUtils.getEventHub(web3) });

    return new Did({
      accountStore: this.getAccountStore(),
      contractLoader: await this.getContractLoader(web3),
      dfs: dfs || (await this.getIpfs()),
      executor,
      nameResolver: await this.getNameResolver(web3),
      signerIdentity,
      verifications: await this.getVerifications(web3, await TestUtils.getIpfs()),
      web3,
    });
  }

  public static async getEncryptionWrapper(
    web3: any,
    dfs: DfsInterface,
    requestedKeys?: string[],
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

  public static async getExecutor(
    web3: any,
    isReadonly = false,
    useIdentity = false,
    accountId?: string,
  ): Promise<Executor> {
    if (isReadonly) {
      return new Executor({});
    }

    let signer;
    if (useIdentity) {
      console.log('Using mah identity!');
      signer = await this.getSignerIdentity(web3, accountId);
    } else {
      signer = await this.getSignerInternal(web3);
    }
    const executor = new Executor({ config, signer, web3 });
    await executor.init({});

    return executor;
  }

  public static async getExecutorWallet(wallet, runtime: Runtime):
  Promise<ExecutorWallet> {
    const contracts = await this.getContracts();
    const contractLoader = new ContractLoader({
      contracts,
      web3: runtime.web3,
    });
    const executor = new ExecutorWallet({
      accountId: runtime.activeAccount,
      config,
      contractLoader,
      signer: runtime.signer,
      wallet,
      web3: runtime.web3,
    });
    await executor.init({});
    executor.eventHub = runtime.eventHub;

    return executor;
  }

  public static async getIpfs(useIdentity = false): Promise<Ipfs> {
    let signer;
    const web3 = this.getWeb3();
    if (useIdentity) {
      signer = await this.getSignerIdentity(web3);
    } else {
      signer = await this.getSignerInternal(web3);
    }
    const ipfs = new Ipfs({
      dfsConfig: { host: 'ipfs.test.evan.network', port: '443', protocol: 'https' },
      disablePin: true,
    });
    ipfs.setRuntime({
      activeIdentity: identities[0],
      signer,
      underlyingAccount: accounts[0],
      web3,
    });
    return ipfs;
  }

  public static async getIpld(_ipfs?: Ipfs, _keyProvider?: KeyProvider): Promise<Ipld> {
    const ipfs = _ipfs || await this.getIpfs();
    const nameResolver = await this.getNameResolver(await this.getWeb3());
    return new Promise<Ipld>((resolve) => {
      // crypto provider
      const cryptoProvider = this.getCryptoProvider();
      // key provider
      const keyProvider = _keyProvider || (new KeyProvider({ keys: dataKeys }));

      resolve(new Ipld({
        ipfs,
        keyProvider,
        cryptoProvider,
        defaultCryptoAlgo: 'aes',
        originator: nameResolver.soliditySha3(identities[0]),
        nameResolver,
      }));
    });
  }

  public static getKeyProvider(requestedKeys?: string[]) {
    let keys;
    if (!requestedKeys) {
      keys = dataKeys;
    } else {
      keys = {};
      requestedKeys.forEach((key) => {
        keys[key] = dataKeys[key];
      });
    }
    return new KeyProvider({ keys });
  }

  public static getKeys(): any {
    return dataKeys;
  }

  public static getLogger(): Function {
    return Logger.getDefaultLog();
  }

  public static async getNameResolver(web3): Promise<NameResolver> {
    const contracts = await this.getContracts();
    const contractLoader = new ContractLoader({
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
      accountId: accountId || identities[0],
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
      executor: await TestUtils.getExecutor(web3),
      nameResolver: await TestUtils.getNameResolver(web3),
      web3,
    });
  }

  public static async getRuntime(accountId, requestedKeys?, customConfig = {}): Promise<Runtime> {
    let keys;
    if (!requestedKeys) {
      keys = dataKeys;
    } else {
      keys = {};
      requestedKeys.forEach((key) => {
        keys[key] = dataKeys[key];
      });
    }
    return createDefaultRuntime(
      await TestUtils.getWeb3(),
      await TestUtils.getIpfs((customConfig as any).useIdentity),
      {
        accountMap: { [accountId]: accountMap[accountId] },
        keyConfig: keys,
        ...customConfig,
      },
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

  public static async getSharing(
    web3,
    dfsParam?: DfsInterface,
    requestedKeys?: string[],
  ): Promise<Sharing> {
    const dfs = dfsParam || await TestUtils.getIpfs();
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

  public static async getSignerInternal(web3: any) {
    const contracts = await this.getContracts();
    const contractLoader = new ContractLoader({
      contracts,
      web3,
    });
    const accountStore = this.getAccountStore();
    return new SignerInternal({
      accountStore,
      contractLoader,
      config: {},
      web3,
    });
  }

  public static async getSignerIdentity(
    web3: any,
    accountId = accounts[0],
  ): Promise<SignerIdentity> {
    const contracts = await TestUtils.getContracts();
    const contractLoader = new ContractLoader({
      contracts,
      web3,
    });
    const verifications = await TestUtils.getVerifications(web3, await TestUtils.getIpfs());
    const underlyingSigner = await this.getSignerInternal(web3);
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

  public static async getVerifications(
    web3,
    dfs?,
    requestedKeys?: string[],
  ): Promise<Verifications> {
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
      dfs: dfs || (await this.getIpfs()),
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

  public static async getWallet(
    runtime: Runtime,
  ): Promise<Wallet> {
    return new Wallet({
      ...(runtime as any),
    });
  }

  public static getWeb3() {
    // connect to web3
    return localWeb3;
  }

  public static async sleep(ms): Promise<void> {
    await new Promise((s) => setTimeout(() => s(), ms));
  }
}
