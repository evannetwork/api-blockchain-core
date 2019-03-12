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

import {
  AccountStore,
  ContractLoader,
  DfsInterface,
  EventHub,
  Executor,
  KeyProvider,
  Logger,
  SignerInterface,
  SignerInternal,
  Unencrypted,
} from '@evan.network/dbcp';

import { Aes } from './encryption/aes';
import { AesBlob } from './encryption/aes-blob';
import { AesEcb } from './encryption/aes-ecb';
import { BaseContract } from './contracts/base-contract/base-contract';
import { config } from './config';
import { CryptoProvider } from './encryption/crypto-provider';
import { DataContract } from './contracts/data-contract/data-contract';
import { Description } from './shared-description';
import { Ipfs } from './dfs/ipfs';
import { Ipld } from './dfs/ipld';
import { KeyExchange } from './keyExchange';
import { Mailbox } from './mailbox';
import { NameResolver } from './name-resolver';
import { Onboarding } from './onboarding';
import { Payments } from './payments';
import { Profile } from './profile/profile';
import { RightsAndRoles } from './contracts/rights-and-roles';
import { ServiceContract } from './contracts/service-contract/service-contract';
import { Sharing } from './contracts/sharing';
import { Verifications } from './verifications/verifications';
import { Votings } from './votings/votings';

/**
 * runtime for interacting with dbcp, including helpers for transactions & co
 */
export interface Runtime {
  accountStore?: AccountStore,
  activeAccount?: string,
  baseContract?: BaseContract,
  contractLoader?: ContractLoader,
  contracts?: any,
  cryptoProvider?: CryptoProvider,
  dataContract?: DataContract,
  description?: Description,
  dfs?: DfsInterface,
  eventHub?: EventHub,
  executor?: Executor,
  ipld?: Ipld,
  keyExchange?: KeyExchange,
  keyProvider?: KeyProvider,
  logger?: Logger,
  mailbox?: Mailbox,
  nameResolver?: NameResolver,
  onboarding?: Onboarding,
  payments?: Payments,
  profile?: Profile,
  rightsAndRoles?: RightsAndRoles,
  serviceContract?: ServiceContract,
  sharing?: Sharing,
  signer?: SignerInterface,
  verifications?: Verifications,
  votings?: Votings,
  web3?: any,
};

/**
 * create new runtime instance
 *
 * @param      {any}               web3           connected web3 instance
 * @param      {DfsInterface}      dfs            interface for retrieving file from dfs
 * @param      {any}               runtimeConfig  configuration values
 * @return     {Promise<Runtime>}  runtime instance
 */
export async function createDefaultRuntime(web3: any, dfs: DfsInterface, runtimeConfig: any, options: Runtime = { }): Promise<Runtime> {
  // get default logger
  const log = (options.logger || (new Logger())).logFunction;

  // if this function is used within node and no browser context exists, load the
  // @evan.network/smart-contracts-core normally and use the Solc functionalities to parse and
  // retrieve contracts
  let contracts = options.contracts;
  if (!contracts) {
    if (typeof global === 'undefined' || !(<any>global).localStorage) {
      // get/compile smart contracts
      // It is possible to load contracts from non-default locations
      const solcCfg = { compileContracts: false, }
      if (runtimeConfig.contractsLoadPath) {
        solcCfg['destinationPath'] = runtimeConfig.contractsLoadPath;
      }

      const smartContract = require('@evan.network/smart-contracts-core');
      const solc = new smartContract.Solc({ config: solcCfg, log, });
      await solc.ensureCompiled(runtimeConfig.additionalContractsPaths || [], solcCfg['destinationPath']);

      contracts = solc.getContracts();
    } else {
      // if this lib is used within the browser using browserify, smart-contracts-core needs to be
      // defined externaly (normally defined by @evan.network/ui-dapp-browser) to return the abis
      // directly as json
      const originalContracts = require('@evan.network/smart-contracts-core');
      contracts = { };

      // map the contracts value object correctly
      Object.keys(originalContracts).forEach((key) => {
        const contractKey = (key.indexOf(':') !== -1) ? key.split(':')[1] : key;
        contracts[contractKey] = originalContracts[key];
      });
    }
  }

  // web3 contract interfaces
  const contractLoader = options.contractLoader || new ContractLoader({ contracts, log, web3, });

  // executor
  const accountStore = options.accountStore || new AccountStore({ accounts: runtimeConfig.accountMap, log, });
  const signer = options.signer || new SignerInternal({ accountStore, contractLoader, config: {}, log, web3, });
  const executor = options.executor || new Executor(Object.assign({ config, log, signer, web3, }, runtimeConfig.options ? runtimeConfig.options.Executor : {}));
  await executor.init({});
  const nameResolver = options.nameResolver || new NameResolver({
    config: runtimeConfig.nameResolver || config.nameResolver,
    executor,
    contractLoader,
    log,
    web3,
  });
  const eventHub = options.eventHub || new EventHub({
    config: runtimeConfig.nameResolver || config.nameResolver,
    contractLoader,
    log,
    nameResolver,
  });
  executor.eventHub = eventHub;

  // encryption
  const cryptoConfig = {};
  cryptoConfig['aes'] = new Aes({ log });
  cryptoConfig['unencrypted'] = new Unencrypted({ log });
  cryptoConfig['aesBlob'] = new AesBlob({ dfs, log });
  cryptoConfig['aesEcb'] = new AesEcb({ log });
  const cryptoProvider = new CryptoProvider(cryptoConfig);
  const keyProvider = options.keyProvider || new KeyProvider({ keys: runtimeConfig.keyConfig, log, });

  // description
  const description = options.description || new Description({
    contractLoader,
    cryptoProvider,
    dfs,
    executor,
    keyProvider,
    log,
    nameResolver,
    sharing: null,
    web3,
  });
  const sharing = options.sharing || new Sharing({
    contractLoader,
    cryptoProvider,
    description,
    executor,
    dfs,
    keyProvider,
    log,
    nameResolver,
    defaultCryptoAlgo: 'aes',
  });
  description.sharing = sharing;

  const baseContract = options.baseContract || new BaseContract({
    executor,
    loader: contractLoader,
    log,
    nameResolver,
  });

  const dataContract = options.dataContract || new DataContract({
    cryptoProvider,
    dfs,
    executor,
    loader: contractLoader,
    log,
    nameResolver,
    sharing,
    web3,
    description,
  });

  const activeAccount = Object.keys(runtimeConfig.accountMap)[0];
  const ipld = options.ipld || new Ipld({
    ipfs: dfs as Ipfs,
    keyProvider,
    cryptoProvider,
    defaultCryptoAlgo: 'aes',
    log,
    originator: nameResolver.soliditySha3(activeAccount),
    nameResolver,
  });

  // 'own' key provider, that won't be linked to profile and used in 'own' ipld
  // this prevents key lookup infinite loops
  const keyProviderOwn = new KeyProvider({ keys: runtimeConfig.keyConfig, log, });
  const ipldOwn = new Ipld({
    ipfs: dfs as Ipfs,
    keyProvider: keyProviderOwn,
    cryptoProvider,
    defaultCryptoAlgo: 'aes',
    log,
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
    log,
    nameResolver,
    defaultCryptoAlgo: 'aes',
  });
  const dataContractOwn = new DataContract({
    cryptoProvider,
    dfs,
    executor,
    loader: contractLoader,
    log,
    nameResolver,
    sharing: sharingOwn,
    web3,
    description,
  });
  let profile = options.profile || new Profile({
    accountId: activeAccount,
    contractLoader,
    dataContract: dataContractOwn,
    defaultCryptoAlgo: 'aes',
    executor,
    ipld: ipldOwn,
    log,
    nameResolver,
  });
  // this key provider is linked to profile for key retrieval
  // keyProviderOwn is not liked to profile to prevent profile key lookups
  keyProvider.init(profile);

  const rightsAndRoles = options.rightsAndRoles || new RightsAndRoles({
    contractLoader,
    executor,
    log,
    nameResolver,
    web3,
  });

  const serviceContract = options.serviceContract || new ServiceContract({
    cryptoProvider,
    dfs,
    executor,
    keyProvider,
    loader: contractLoader,
    log,
    nameResolver,
    sharing,
    web3,
  });

  const mailbox = options.mailbox || new Mailbox({
    mailboxOwner: activeAccount,
    nameResolver,
    ipfs: dfs as Ipfs,
    contractLoader,
    cryptoProvider,
    keyProvider,
    log,
    defaultCryptoAlgo: 'aes',
  });

  const keyExchange = options.keyExchange || new KeyExchange({
    mailbox,
    cryptoProvider,
    defaultCryptoAlgo: 'aes',
    account: activeAccount,
    keyProvider,
    log,
  });

  const verifications = options.verifications || new Verifications({
    accountStore: accountStore,
    contractLoader: contractLoader,
    config,
    description,
    dfs: dfs,
    executor: executor,
    log,
    nameResolver: nameResolver,
  })

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

  const onboarding = options.onboarding || new Onboarding({
    mailbox,
    smartAgentId: '0x063fB42cCe4CA5448D69b4418cb89E663E71A139',
    executor,
    log,
  });

  const votings = options.votings || new Votings({
    contractLoader,
    executor,
    log,
    nameResolver,
  });

  const payments = options.payments || new Payments({
    accountStore,
    contractLoader,
    executor,
    log,
    web3
  });

  // return runtime object
  return {
    accountStore,
    activeAccount,
    baseContract,
    contractLoader,
    cryptoProvider,
    dataContract,
    contracts,
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
    payments,
    profile,
    rightsAndRoles,
    serviceContract,
    sharing,
    signer,
    verifications,
    votings,
    web3,
  };
};
