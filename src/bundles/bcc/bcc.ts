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

require('babel-polyfill');

// import to handle bundle from outside
import IpfsRemoteConstructor = require('ipfs-api');
import keystore = require('eth-lightwallet/lib/keystore');
import Mnemonic = require('bitcore-mnemonic');
import Web3 = require('web3');
import prottle = require('prottle');
import crypto = require('crypto');

// used for building bundle
import {
  ContractLoader,
  DfsInterface,
  Envelope,
  EventHub,
  Executor,
  Ipfs,
  KeyProvider,
  KeyProviderInterface,
  Logger,
  LogLevel,
  SignerExternal,
  SignerInternal,
  Unencrypted,
  Validator,
} from '@evan.network/dbcp';

import { Aes } from '../../encryption/aes';
import { AesBlob } from '../../encryption/aes-blob';
import { AesEcb } from '../../encryption/aes-ecb';
import { BusinessCenterProfile } from '../../profile/business-center-profile';
import { CryptoProvider } from '../../encryption/crypto-provider';
import { BaseContract } from '../../contracts/base-contract/base-contract';
import { DataContract } from '../../contracts/data-contract/data-contract';
import { Description } from '../../shared-description';
import { Ipld } from '../../dfs/ipld';
import { KeyExchange } from '../../keyExchange';
import { Mailbox, Mail } from '../../mailbox';
import { NameResolver } from '../../name-resolver';
import { Onboarding } from '../../onboarding';
import { Profile } from '../../profile/profile';
import { RightsAndRoles } from '../../contracts/rights-and-roles';
import { Sharing } from '../../contracts/sharing';
import { ServiceContract } from '../../contracts/service-contract/service-contract';
import { createDefaultRuntime } from '../../runtime';
import { ExecutorAgent } from '../../contracts/executor-agent';

/**************************************************************************************************/

// runtime variables

/**
 * Is used to handle a basic blockchain-core loading without any account specific stuff
 */
let CoreRuntime: CoreInstance;

/**
 * uses the CoreRuntime to enhanche it with account specific stuff
 */
let ProfileRuntime: ProfileInstance;

/**
 * Use a ProfileRuntime to interact with Business centers.
 */
let BCRuntime;

// used for global & shared available logLog
let logLog = [ ];

// push everything into the logLog
let logLogLevel = LogLevel.debug;

// assign to export Buffer;
const buffer = Buffer;

/**************************************************************************************************/
// interfaces

export interface SolcInterface {
  getContracts(): any;
}

export interface CoreBundle {
  createCore: Function,
  createAndSetCore: Function,
  ContractLoader: ContractLoader,
  CryptoProvider: CryptoProvider,
  Description: Description,
  DfsInterface: DfsInterface,
  EventHub: EventHub,
  Executor: Executor,
  Ipfs: Ipfs,
  NameResolver: NameResolver,
  Unencrypted: Unencrypted,
  CoreRuntime: CoreInstance,
  isAccountOnboarded: Function,
  IpfsRemoteConstructor: IpfsRemoteConstructor,
  keystore: keystore,
  Mnemonic: Mnemonic,
  KeyProviderInterface: KeyProviderInterface,
  KeyProvider: KeyProvider,
}

export interface CoreBundleOptions {
  web3: any;
  solc: SolcInterface;
  config: any;
  executor?: Executor;
  contractLoader?: ContractLoader;
  description?: Description;
  dfs?: DfsInterface;
  dfsRemoteNode?: any;
  nameResolver?: NameResolver;
  ipfsCache?: any;
}

export interface CoreInstance {
  web3: any,
  description: Description,
  nameResolver: NameResolver,
  dfs: Ipfs,
  contractLoader: ContractLoader,
  executor: Executor,
  solc: SolcInterface,
  contracts: any,
  config: any
}

export interface ProfileBundle {
  create: Function,
  createAndSet: Function,
  ProfileRuntime: ProfileInstance,
  Aes: Aes,
  Ipld: Ipld,
  KeyExchange: KeyExchange,
  Logger: Logger,
  Mailbox: Mailbox,
  Onboarding: Onboarding,
  Profile: Profile,
  RightsAndRoles: RightsAndRoles,
  Sharing: Sharing,
  SignerExternal: SignerExternal,
  SignerInternal: SignerInternal,
}

export interface ProfileBundleOptions {
  CoreBundle: CoreBundle;
  coreOptions: CoreBundleOptions;

  accountId: string;
  // 'internal' / 'external'
  signer: SignerInternal | SignerExternal;
  keyProvider: KeyProvider;
  executor: Executor;
}

export interface ProfileInstance {
  // profile exports
  dataContract: DataContract,
  ipldInstance: Ipld,
  keyExchange: KeyExchange,
  keyProvider: KeyProvider,
  mailbox: Mailbox,
  profile: Profile,
  serviceContract: ServiceContract,
  sharing: Sharing,

  // core exports
  coreInstance: CoreInstance,
}

export interface BCBundleOptions {
  ensDomain: string,
  ProfileBundle: ProfileBundle
}

export interface BCInstance {
  bcAddress: string,
  bcProfiles: BusinessCenterProfile,
  bcRoles: RightsAndRoles,
  businessCenter: any,
  dataContract: DataContract,
  description: any,
  ensDomain: string,
  ipld: Ipld,
  serviceContract: ServiceContract,
}

/**************************************************************************************************/
// Core stuff

/**
 * Creates a new CoreInstance
 *
 * @param      {CoreBundleOptions}  options  core bundle options
 * @return     {CoreInstance}       new Core instance
 */
const createCore = function(options: CoreBundleOptions): CoreInstance {
  const web3 = options.web3;

  // contract loader
  const solc = options.solc;
  const contracts = solc.getContracts();
  const contractLoader = options.contractLoader || new ContractLoader({
    contracts,
    web3,
    logLog,
    logLogLevel
  });

  // executor
  const executor = options.executor || new Executor({ web3, logLog, logLogLevel });

  // dfs
  let dfs;
  if (options.dfs) {
    dfs = options.dfs;
  } else if (options.dfsRemoteNode) {
    dfs = new Ipfs({remoteNode: options.dfsRemoteNode, cache: options.ipfsCache, logLog, logLogLevel });
    // TODO cleanup after dbcp > 1.0.3 release
    if(options.ipfsCache) {
      dfs.cache = options.ipfsCache;
    }
  } else {
    throw new Error('missing dfsNode or dfs instance in bundle creator');
  }

  // name resolver
  let nameResolver;
  if (options.nameResolver) {
    nameResolver = options.nameResolver;
  } else {
    let nameResolverConfig;
    if (options.config && options.config.nameResolver) {
      nameResolverConfig = options.config.nameResolver;
    } else {
      throw new Error('missing options.config.nameResolver, config.nameResolver ' +
        'and nameResolver instance in bundle creator');
    }
    nameResolver = new NameResolver({
      config: nameResolverConfig,
      executor,
      contractLoader,
      web3,
      logLog,
      logLogLevel
    });
  }

  // description
  let unencrypted = new Unencrypted();
  let description;
  if (options.description) {
    description = options.description;
  } else {
    const cryptoProvider = new CryptoProvider({ unencrypted });

    description = options.description || new Description({
      contractLoader,
      cryptoProvider,
      dfs,
      executor,
      nameResolver,
      sharing: null,
      web3,
      logLog,
      logLogLevel
    });
  }

  const eventHub =  new EventHub({
    config: options.config,
    contractLoader: contractLoader,
    nameResolver: nameResolver,
    logLog,
    logLogLevel
  });

  executor.eventHub = eventHub;

  return {
    web3,
    description,
    nameResolver,
    dfs,
    contractLoader,
    executor,
    solc,
    contracts,
    config: options.config,
  }
}

/**
 * Creates a new CoreInstance and update the CoreInstance export.
 *
 * @param      {CoreBundleOptions}  options  core bundle options
 * @return     {CoreInstance}       new Core instance
 */
let createAndSetCore = function(options: CoreBundleOptions): CoreInstance {
  CoreRuntime = createCore(options);

  return CoreRuntime;
}

/**
 * Overwrite the current CoreInstance
 *
 * @param      {CoreInstance}  coreInstance  CoreInstance to use
 */
let setCore = function(coreInstance: CoreInstance) {
  CoreRuntime = coreInstance;
}

/**************************************************************************************************/
// profile stuff

/**
 * Creates a new ProfileInstance
 *
 * @param      {BundleOptions}  options  core bundle options
 * @return     {ProfileInstance}       new Core instance
 */
const create = function(options: ProfileBundleOptions): ProfileInstance {
  const web3 = options.coreOptions.web3;

  // => correct executor
  const executor = options.executor || new Executor({
    config: options.coreOptions.config,
    web3: web3,
    signer: options.signer,
    logLog,
    logLogLevel
  });

  options.coreOptions.executor = executor;

  const coreInstance = options.CoreBundle.createAndSetCore(options.coreOptions);

  coreInstance.description.cryptoProvider = new CryptoProvider({
    unencrypted: new Unencrypted(),
    aes: new Aes(),
    aesBlob: new AesBlob({
      dfs: coreInstance.dfs
    }),
    'aesEcb': new AesEcb(),
    logLog,
    logLogLevel
  });

  options.coreOptions.executor.init({
    eventHub: executor.eventHub
  });

  coreInstance.description.keyProvider = options.keyProvider;

  // update executor
  coreInstance.description.executor = executor;
  coreInstance.nameResolver.executor = executor;

  const ipldInstance = new Ipld({
    'ipfs': coreInstance.dfs,
    'keyProvider': options.keyProvider,
    'cryptoProvider': coreInstance.description.cryptoProvider,
    defaultCryptoAlgo: 'aes',
    originator: coreInstance.nameResolver.soliditySha3(options.accountId),
    nameResolver: coreInstance.nameResolver,
    logLog,
    logLogLevel
  });

  const sharing = new Sharing({
    contractLoader: coreInstance.contractLoader,
    cryptoProvider: coreInstance.description.cryptoProvider,
    description: coreInstance.description,
    executor: coreInstance.executor,
    dfs: coreInstance.dfs,
    keyProvider: (<any>options.keyProvider),
    nameResolver: coreInstance.nameResolver,
    defaultCryptoAlgo: 'aes',
    logLog,
    logLogLevel
  });

  const mailbox = new Mailbox({
    mailboxOwner: options.accountId,
    nameResolver: coreInstance.nameResolver,
    ipfs: coreInstance.dfs,
    contractLoader: coreInstance.contractLoader,
    cryptoProvider: coreInstance.description.cryptoProvider,
    keyProvider: (<any>options.keyProvider),
    defaultCryptoAlgo: 'aes',
    logLog,
    logLogLevel
  });

  const keyExchange = new KeyExchange({
    mailbox: mailbox,
    cryptoProvider:  coreInstance.description.cryptoProvider,
    defaultCryptoAlgo: 'aes',
    account:  options.accountId,
    keyProvider: (<any>options.keyProvider),
    logLog,
    logLogLevel
  });

  const dataContract = new DataContract({
    cryptoProvider: coreInstance.description.cryptoProvider,
    dfs: coreInstance.dfs,
    executor,
    loader: coreInstance.contractLoader,
    nameResolver: coreInstance.nameResolver,
    sharing: sharing,
    web3: coreInstance.web3,
    description: coreInstance.description,
    logLog,
    logLogLevel
  });

  const serviceContract = new ServiceContract({
    cryptoProvider: coreInstance.description.cryptoProvider,
    dfs: coreInstance.dfs,
    executor,
    keyProvider: (<any>options.keyProvider),
    loader: coreInstance.contractLoader,
    nameResolver: coreInstance.nameResolver,
    sharing: sharing,
    web3: coreInstance.web3,
    logLog,
    logLogLevel
  });

  const profile = new Profile({
    ipld: ipldInstance,
    nameResolver: coreInstance.nameResolver,
    defaultCryptoAlgo: 'aes',
    executor,
    contractLoader: coreInstance.contractLoader,
    accountId: options.accountId,
    dataContract,
    logLog,
    logLogLevel
  });

  (<any>options.keyProvider).origin.init(profile);

  coreInstance.description.sharing = sharing;

  return {
    // profile exports
    dataContract,
    ipldInstance,
    keyExchange,
    keyProvider: options.keyProvider,
    mailbox,
    profile,
    serviceContract,
    sharing,
    // core exports
    coreInstance: coreInstance
  };
}

/**
 * Create a new ProfileInstance and update the ProfileInstance export.
 *
 * @param      {BundleOptions}    options  core bundle options
 * @return     {ProfileInstance}  new Core instance
 */
let createAndSet = function(options: ProfileBundleOptions): ProfileInstance {
  ProfileRuntime = create(options);

  return ProfileRuntime;
}

/**************************************************************************************************/
// bc stuff

/**
 * Create a new BCInstance.
 *
 * @param      {BundleOptions}    options  bundle options
 * @return     {BCInstance}  new BC instance
 */
async function createBC(options: BCBundleOptions) {
  const ensDomain = options.ensDomain;
  const ProfileRuntime = options.ProfileBundle.ProfileRuntime;
  const CoreRuntime = ProfileRuntime.coreInstance;

  // if user entered ens address, resolve it
  let bcAddress = ensDomain;
  if (bcAddress.indexOf('0x') !== 0) {
    bcAddress = await CoreRuntime.nameResolver.getAddress(ensDomain);
  }

  const nameResolverConfig = JSON.parse(JSON.stringify(CoreRuntime.config.nameResolver));
  nameResolverConfig.labels.businessCenterRoot = ensDomain;

  const nameResolver = new NameResolver({
    config: nameResolverConfig,
    executor: CoreRuntime.executor,
    contractLoader: CoreRuntime.contractLoader,
    web3: CoreRuntime.web3,
    logLog,
    logLogLevel
  });

  const businessCenter = CoreRuntime.contractLoader.loadContract('BusinessCenter', bcAddress);
  const bcRoles = new RightsAndRoles({
    contractLoader: CoreRuntime.contractLoader,
    executor: CoreRuntime.executor,
    nameResolver: nameResolver,
    web3: CoreRuntime.web3,
    logLog,
    logLogLevel
  });

  const ipld = new Ipld({
    ipfs: CoreRuntime.dfs,
    keyProvider: ProfileRuntime.keyProvider,
    cryptoProvider: CoreRuntime.description.cryptoProvider,
    defaultCryptoAlgo: 'aes',
    originator: nameResolver.soliditySha3(ensDomain),
    nameResolver,
    logLog,
    logLogLevel
  });

  const bcProfiles = new BusinessCenterProfile({
    ipld: ipld,
    nameResolver: nameResolver,
    defaultCryptoAlgo: 'aes',
    bcAddress: ensDomain,
    cryptoProvider: CoreRuntime.description.cryptoProvider,
    logLog,
    logLogLevel
  });

  const dataContract = new DataContract({
    cryptoProvider: CoreRuntime.description.cryptoProvider,
    dfs: CoreRuntime.dfs,
    executor: CoreRuntime.executor,
    loader: CoreRuntime.contractLoader,
    nameResolver: nameResolver,
    sharing: ProfileRuntime.sharing,
    web3: CoreRuntime.web3,
    description: CoreRuntime.description,
    logLog,
    logLogLevel
  });

  const serviceContract = new ServiceContract({
    cryptoProvider: CoreRuntime.description.cryptoProvider,
    dfs: CoreRuntime.dfs,
    executor: CoreRuntime.executor,
    keyProvider: ProfileRuntime.keyProvider,
    loader: CoreRuntime.contractLoader,
    nameResolver: nameResolver,
    sharing: ProfileRuntime.sharing,
    web3: CoreRuntime.web3,
    logLog,
    logLogLevel
  });

  const description = await CoreRuntime.description.getDescriptionFromEns(ensDomain);

  return {
    ensDomain,
    bcAddress,
    businessCenter,
    bcRoles,
    ipld,
    bcProfiles,
    description: (<any>description),
    dataContract,
    serviceContract,
  };
}

/**
 * Creates and set BCInstance.
 *
 * @param      {BundleOptions}  options  Bundle options
 * @return     {BCInstance}     new BC Instance
 */
let createAndSetBC = function(options: BCBundleOptions): BCInstance {
  BCRuntime = createBC(options);

  return BCRuntime;
}

/**
 * Check if a account is onboarded 
 *
 * @param      {string}   account  account id to test
 * @return     {boolean}  True if account onboarded, False otherwise
 */
const isAccountOnboarded = async function(account: string): Promise<boolean> {
  try {
    const ensName = CoreRuntime.nameResolver.getDomainName(CoreRuntime.nameResolver.config.domains.profile);
    const address = await CoreRuntime.nameResolver.getAddress(ensName);
    const contract = CoreRuntime.nameResolver.contractLoader.loadContract('ProfileIndexInterface', address);
    const hash = await CoreRuntime.nameResolver.executor.executeContractCall(contract, 'getProfile', account, { from: account, });

    if (hash === '0x0000000000000000000000000000000000000000') {
      return false;
    } else {
      return true;
    }
  } catch (ex) {
    return false;
  }
}


export {
  Aes,
  AesEcb,
  BaseContract,
  BCRuntime,
  buffer,
  ContractLoader,
  CoreRuntime,
  create,
  createAndSet,
  createAndSetBC,
  createAndSetCore,
  createBC,
  createCore,
  createDefaultRuntime,
  crypto,
  CryptoProvider,
  DataContract,
  Description,
  DfsInterface,
  Envelope,
  EventHub,
  Executor,
  ExecutorAgent,
  Ipfs,
  IpfsRemoteConstructor,
  Ipld,
  isAccountOnboarded,
  KeyExchange,
  KeyProvider,
  KeyProviderInterface,
  keystore,
  Logger,
  LogLevel,
  logLog,
  logLogLevel,
  Mailbox,
  Mnemonic,
  NameResolver,
  Onboarding,
  Profile,
  ProfileRuntime,
  prottle,
  RightsAndRoles,
  Sharing,
  SignerExternal,
  SignerInternal,
  Unencrypted,
  Validator,
  Web3,
};
