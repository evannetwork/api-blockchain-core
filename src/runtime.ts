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

import smartContract = require('@evan.network/smart-contracts-core');

import {
  AccountStore,
  ContractLoader,
  DfsInterface,
  EventHub,
  Executor,
  Ipfs,
  KeyProvider,
  Logger,
  SignerInterface,
  SignerInternal,
  Unencrypted,
} from '@evan.network/dbcp';

import { Aes } from './encryption/aes';
import { AesEcb } from './encryption/aes-ecb';
import { BaseContract } from './contracts/base-contract/base-contract';
import { config } from './config';
import { CryptoProvider } from './encryption/crypto-provider';
import { DataContract } from './contracts/data-contract/data-contract';
import { Description } from './shared-description';
import { Ipld } from './dfs/ipld';
import { KeyExchange } from './keyExchange';
import { Mailbox } from './mailbox';
import { NameResolver } from './name-resolver';
import { Onboarding } from './onboarding';
import { Profile } from './profile/profile';
import { RightsAndRoles } from './contracts/rights-and-roles';
import { ServiceContract } from './contracts/service-contract/service-contract';
import { Sharing } from './contracts/sharing';


/**
 * runtime for interacting with dbcp, including helpers for transactions & co
 */
export interface Runtime {
  accountStore: AccountStore,
  activeAccount: string,
  baseContract: BaseContract,
  contractLoader: ContractLoader,
  cryptoProvider: CryptoProvider,
  description: Description,
  dataContract: DataContract,
  dfs: DfsInterface,
  eventHub: EventHub,
  executor: Executor,
  ipld: Ipld,
  keyExchange: KeyExchange,
  keyProvider: KeyProvider,
  mailbox: Mailbox,
  nameResolver: NameResolver,
  onboarding: Onboarding,
  profile: Profile,
  rightsAndRoles: RightsAndRoles,
  serviceContract: ServiceContract,
  sharing: Sharing,
  signer: SignerInterface,
  web3: any,
};

/**
 * create new runtime instance
 *
 * @param      {any}               web3           connected web3 instance
 * @param      {DfsInterface}      dfs            interface for retrieving file from dfs
 * @param      {any}               runtimeConfig  configuration values
 * @return     {Promise<Runtime>}  runtime instance
 */
export async function createDefaultRuntime(web3: any, dfs: DfsInterface, runtimeConfig: any): Promise<Runtime> {
  // get default logger
  const log = (new Logger()).logFunction;
  // get/compile smart contracts
  // It is possible to load contracts from non-default locations
  const solcCfg = { compileContracts: false, }
  if (runtimeConfig.contractsLoadPath) solcCfg['destinationPath'] = runtimeConfig.contractsLoadPath
  const solc = new smartContract.Solc({ config: solcCfg, log, });
  await solc.ensureCompiled(runtimeConfig.additionalContractsPaths || [], solcCfg['destinationPath']);
  const contracts = solc.getContracts();

  // web3 contract interfaces
  const contractLoader = new ContractLoader({ contracts, web3, });

  // executor
  const accountStore = new AccountStore({ accounts: runtimeConfig.accountMap, });
  const signer = new SignerInternal({ accountStore, contractLoader, config: {}, web3, });
  const executor = new Executor({ config, signer, web3, });
  await executor.init({});
  const nameResolver = new NameResolver({
    config: runtimeConfig.nameResolver || config.nameResolver,
    executor,
    contractLoader,
    web3,
  });
  const eventHub = new EventHub({
    config: runtimeConfig.nameResolver || config.nameResolver,
    contractLoader,
    nameResolver,
  });
  executor.eventHub = eventHub;

  // encryption
  const cryptoConfig = {};
  cryptoConfig['aes'] = new Aes();
  cryptoConfig['unencrypted'] = new Unencrypted();
  cryptoConfig['aesEcb'] = new AesEcb();
  const cryptoProvider = new CryptoProvider(cryptoConfig);
  const keyProvider = new KeyProvider({ keys: runtimeConfig.keyConfig, });

  // description
  const description = new Description({
    contractLoader,
    cryptoProvider,
    dfs,
    executor,
    keyProvider,
    nameResolver,
    sharing: null,
    web3,
  });
  const sharing = new Sharing({
    contractLoader,
    cryptoProvider,
    description,
    executor,
    dfs,
    keyProvider,
    nameResolver,
    defaultCryptoAlgo: 'aes',
  });
  description.sharing = sharing;

  const baseContract = new BaseContract({
    executor,
    loader: contractLoader,
    nameResolver,
  });

  const dataContract = new DataContract({
    cryptoProvider,
    dfs,
    executor,
    loader: contractLoader,
    nameResolver,
    sharing,
    web3,
    description,
  });

  const activeAccount = Object.keys(runtimeConfig.accountMap)[0];
  const ipld = new Ipld({
    ipfs: dfs as Ipfs,
    keyProvider,
    cryptoProvider,
    defaultCryptoAlgo: 'aes',
    originator: nameResolver.soliditySha3(activeAccount),
    nameResolver,
  });

  // 'own' key provider, that won't be linked to profile and used in 'own' ipld
  // this prevents key lookup infinite loops
  const keyProviderOwn = new KeyProvider({ keys: runtimeConfig.keyConfig, });
  const ipldOwn = new Ipld({
    ipfs: dfs as Ipfs,
    keyProvider: keyProviderOwn,
    cryptoProvider,
    defaultCryptoAlgo: 'aes',
    originator: nameResolver.soliditySha3(activeAccount),
    nameResolver,
  });
  const sharingOwn = new Sharing({
    contractLoader,
    cryptoProvider,
    description,
    executor,
    dfs,
    keyProvider: keyProviderOwn,
    nameResolver,
    defaultCryptoAlgo: 'aes',
  });
  const dataContractOwn = new DataContract({
    cryptoProvider,
    dfs,
    executor,
    loader: contractLoader,
    nameResolver,
    sharing: sharingOwn,
    web3,
    description,
  });
  let profile = new Profile({
    accountId: activeAccount,
    contractLoader,
    dataContract: dataContractOwn,
    defaultCryptoAlgo: 'aes',
    executor,
    ipld: ipldOwn,
    nameResolver,
  });
  // this key provider is linked to profile for key retrieval
  // keyProviderOwn is not liked to profile to prevent profile key lookups
  keyProvider.init(profile);

  const rightsAndRoles = new RightsAndRoles({
    contractLoader,
    executor,
    nameResolver,
    web3,
  });

  const serviceContract = new ServiceContract({
    cryptoProvider,
    dfs,
    executor,
    keyProvider,
    loader: contractLoader,
    nameResolver,
    sharing,
    web3,
  });

  const mailbox = new Mailbox({
    mailboxOwner: activeAccount,
    nameResolver,
    ipfs: dfs as Ipfs,
    contractLoader,
    cryptoProvider,
    keyProvider,
    defaultCryptoAlgo: 'aes',
  });

  const keyExchange = new KeyExchange({
    mailbox,
    cryptoProvider,
    defaultCryptoAlgo: 'aes',
    account: activeAccount,
    keyProvider,
  });
  if (await profile.exists()) {
    log(`profile for ${activeAccount} exists, fetching keys`, 'debug');
    try {
      keyExchange.setPublicKey(
        await profile.getPublicKey(),
        await profile.getContactKey(activeAccount, 'dataKey'),
      );
    } catch (ex) {
      log(`fetching keys for ${activeAccount} failed with "${ex.msg || ex}", removing profile from runtime`, 'warning');
      profile = null;
      keyProvider.profile = null;
    }
  } else {
    log(`profile for ${activeAccount} doesn't exist`)
  }

  const onboarding = new Onboarding({
    mailbox,
    smartAgentId: '0x063fB42cCe4CA5448D69b4418cb89E663E71A139',
    executor,
  });

  // return runtime object
  return {
    accountStore,
    activeAccount,
    baseContract,
    contractLoader,
    cryptoProvider,
    dataContract,
    description,
    dfs,
    eventHub,
    executor,
    ipld,
    keyExchange,
    keyProvider,
    mailbox,
    nameResolver,
    onboarding,
    profile,
    rightsAndRoles,
    serviceContract,
    sharing,
    signer,
    web3,
  };
};
