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
import { cloneDeep } from 'lodash';

import { Aes } from './encryption/aes';
import { AesBlob } from './encryption/aes-blob';
import { AesEcb } from './encryption/aes-ecb';
import { BaseContract } from './contracts/base-contract/base-contract';
import { configCore } from './config-core';
import { configTestcore } from './config-testcore';
import { CryptoProvider } from './encryption/crypto-provider';
import { DataContract } from './contracts/data-contract/data-contract';
import { Description } from './shared-description';
import { Did } from './did/did';
import { EncryptionWrapper } from './encryption/encryption-wrapper';
import { getEnvironment, nullAddress } from './common/utils';
import { Identity } from './identity/identity';
import { Ipfs } from './dfs/ipfs';
import { IpfsLib } from './dfs/ipfs-lib';
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
import { SignerIdentity } from './contracts/signer-identity';
import { Vade } from '../libs/vade';
import { Vc } from './vc/vc';
import { Verifications } from './verifications/verifications';
import { Votings } from './votings/votings';

/**
 * runtime for interacting with dbcp, including helpers for transactions & co
 */
export interface Runtime {
  accountStore?: AccountStore;
  activeAccount?: string;
  activeIdentity?: string;
  baseContract?: BaseContract;
  config?: any;
  contractLoader?: ContractLoader;
  contracts?: any;
  cryptoProvider?: CryptoProvider;
  dataContract?: DataContract;
  description?: Description;
  dfs?: DfsInterface;
  did?: Did;
  encryptionWrapper?: EncryptionWrapper;
  environment?: string;
  eventHub?: EventHub;
  executor?: Executor;
  identity?: Identity;
  ipld?: Ipld;
  keyExchange?: KeyExchange;
  keyProvider?: KeyProvider;
  logger?: Logger;
  mailbox?: Mailbox;
  nameResolver?: NameResolver;
  onboarding?: Onboarding;
  payments?: Payments;
  profile?: Profile;
  rightsAndRoles?: RightsAndRoles;
  runtimeConfig?: any;
  serviceContract?: ServiceContract;
  sharing?: Sharing;
  signer?: SignerInterface;
  underlyingAccount?: string;
  vade?: Vade;
  vc?: Vc;
  verifications?: Verifications;
  votings?: Votings;
  web3?: any;
}

/**
 * create new runtime instance
 *
 * @param      {any}               web3           connected web3 instance
 * @param      {DfsInterface}      dfs            interface for retrieving file from dfs
 * @param      {any}               runtimeConfig  configuration values
 * @return     {Promise<Runtime>}  runtime instance
 */
async function createRuntime(
  web3: any, dfs: DfsInterface, runtimeConfig: any, options: Runtime = { },
): Promise<Runtime> {
  // determine chain this runtime is created for
  const environment = await getEnvironment(web3);
  const config = environment === 'core' ? configCore : configTestcore;

  // get default logger
  const logger = options.logger || (new Logger());
  const log = logger.logFunction;

  // if this function is used within node and no browser context exists, load the
  // @evan.network/smart-contracts-core normally and use the Solc functionalities to parse and
  // retrieve contracts
  let { contracts } = options;
  if (!contracts) {
    if (typeof global === 'undefined' || !(global as any).localStorage) {
      // get/compile smart contracts
      // It is possible to load contracts from non-default locations
      const solcCfg = { compileContracts: false };
      if (runtimeConfig.contractsLoadPath) {
        (solcCfg as any).destinationPath = runtimeConfig.contractsLoadPath;
      }

      // eslint-disable-next-line
      const smartContract = require('@evan.network/smart-contracts-core');
      const solc = new smartContract.Solc({ config: solcCfg, log });
      await solc.ensureCompiled(
        runtimeConfig.additionalContractsPaths || [], (solcCfg as any).destinationPath,
      );

      contracts = solc.getContracts();
    } else {
      // if this lib is used within the browser using browserify, smart-contracts-core needs to be
      // defined externaly (normally defined by @evan.network/ui-dapp-browser) to return the abis
      // directly as json
      // eslint-disable-next-line
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
  const contractLoader = options.contractLoader || new ContractLoader({ contracts, log, web3 });

  // executor
  const accountStore = options.accountStore
    || new AccountStore({ accounts: runtimeConfig.accountMap, log });
  const signerConfig = {} as any;
  if (Object.prototype.hasOwnProperty.call(runtimeConfig, 'gasPrice')) {
    signerConfig.gasPrice = runtimeConfig.gasPrice;
  } else {
    signerConfig.gasPrice = `${200e9}`;
  }

  const signerInternal = options.signer
    || new SignerInternal({
      accountStore, contractLoader, config: signerConfig, log, web3,
    });
  let signer;
  if (runtimeConfig.useIdentity) {
    signer = new SignerIdentity(
      {
        contractLoader,
        verifications: null, // filled later on
        web3,
      },
    );
  } else {
    signer = signerInternal;
  }

  const executor = options.executor || new Executor(
    {
      config,
      log,
      signer,
      web3,
      ...(runtimeConfig.options ? runtimeConfig.options.Executor : {}),
    },
  );
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
  // eslint-disable-next-line no-param-reassign
  (cryptoConfig as any).aes = new Aes({ log });
  // (cryptoConfig as any)-disable-next-line no-param-reassign
  (cryptoConfig as any).unencrypted = new Unencrypted({ log });
  // eslint-disable-next-line no-param-reassign
  (cryptoConfig as any).aesBlob = new AesBlob({ dfs, log });
  // eslint-disable-next-line no-param-reassign
  (cryptoConfig as any).aesEcb = new AesEcb({ log });
  const cryptoProvider = new CryptoProvider(cryptoConfig);

  const activeAccount = runtimeConfig.account || Object.keys(runtimeConfig.accountMap)[0];
  const keyProvider = options.keyProvider
    || new KeyProvider({ keys: runtimeConfig.keyConfig, log });
  keyProvider.currentAccountHash = nameResolver.soliditySha3(activeAccount);

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

  const verifications = options.verifications || new Verifications({
    accountStore,
    contractLoader,
    config,
    description,
    dfs,
    executor,
    log,
    nameResolver,
  });

  let activeIdentity: string;
  let underlyingAccount: string;
  if (runtimeConfig.useIdentity) {
    try {
      if (runtimeConfig.identity) {
        const sha3Identity = web3.utils.soliditySha3(runtimeConfig.identity);
        if (!runtimeConfig.keyConfig[sha3Identity]) {
          throw new Error('identity key not set');
        }
        activeIdentity = runtimeConfig.identity;
      } else {
        activeIdentity = await verifications.getIdentityForAccount(activeAccount, true);
      }

      underlyingAccount = activeAccount;
      signer.updateConfig(
        { verifications },
        {
          activeIdentity,
          underlyingAccount,
          underlyingSigner: signerInternal,
        },
      );
    } catch (e) {
      logger.log(`identity for ${activeAccount} doesn't exist, using exisiting account signing`, 'debug');
      activeIdentity = activeAccount;
      underlyingAccount = activeIdentity;
      signer = signerInternal;
      executor.signer = signerInternal;
    }
  } else {
    activeIdentity = activeAccount;
    underlyingAccount = activeIdentity;
  }

  const sha3Identity = web3.utils.soliditySha3(activeIdentity);
  if ((activeIdentity !== underlyingAccount) && !runtimeConfig.keyConfig[sha3Identity]) {
    const sha9Identity = web3.utils.soliditySha3(sha3Identity, sha3Identity);
    const sha3Account = web3.utils.soliditySha3(underlyingAccount);
    const sha9Account = web3.utils.soliditySha3(sha3Account, sha3Account);
    // eslint-disable-next-line no-param-reassign
    runtimeConfig.keyConfig[sha3Identity] = runtimeConfig.keyConfig[sha3Account];
    // eslint-disable-next-line no-param-reassign
    runtimeConfig.keyConfig[sha9Identity] = runtimeConfig.keyConfig[sha9Account];
  }

  // check if the dfs remoteNode matches our ipfslib
  if (!((dfs as Ipfs).remoteNode as any instanceof IpfsLib)) {
    // eslint-disable-next-line no-param-reassign
    (dfs as Ipfs).remoteNode = new IpfsLib(config.ipfsConfig);
  }
  (dfs as Ipfs).setRuntime({
    activeIdentity,
    signer,
    underlyingAccount,
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

  const ipld = options.ipld || new Ipld({
    ipfs: dfs as Ipfs,
    keyProvider,
    cryptoProvider,
    defaultCryptoAlgo: 'aes',
    log,
    originator: nameResolver.soliditySha3(activeIdentity),
    nameResolver,
  });

  const rightsAndRoles = options.rightsAndRoles || new RightsAndRoles({
    contractLoader,
    executor,
    log,
    nameResolver,
    web3,
  });

  // 'own' key provider, that won't be linked to profile and used in 'own' ipld
  // this prevents key lookup infinite loops
  const keyProviderOwn = new KeyProvider({ keys: runtimeConfig.keyConfig, log });
  keyProviderOwn.currentAccountHash = nameResolver.soliditySha3(activeIdentity);
  const ipldOwn = new Ipld({
    ipfs: dfs as Ipfs,
    keyProvider: keyProviderOwn,
    cryptoProvider,
    defaultCryptoAlgo: 'aes',
    log,
    originator: nameResolver.soliditySha3(activeIdentity),
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
    accountId: activeIdentity,
    contractLoader,
    cryptoProvider,
    dataContract: dataContractOwn,
    defaultCryptoAlgo: 'aes',
    description,
    dfs,
    executor,
    ipld: ipldOwn,
    log,
    nameResolver,
    rightsAndRoles,
    sharing,
  });

  // this key provider is linked to profile for key retrieval
  // keyProviderOwn is not linked to profile to prevent profile key lookups
  keyProvider.init(profile);

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
    mailboxOwner: activeIdentity,
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
    account: activeIdentity,
    keyProvider,
    log,
  });

  let vade;
  if (runtimeConfig.vade) {
    vade = new Vade(runtimeConfig.vade);
  }

  let did: Did;
  let vc: Vc;
  let identity;
  if (runtimeConfig.useIdentity) {
    did = new Did({
      accountStore,
      contractLoader,
      dfs,
      executor,
      nameResolver,
      signerIdentity: signer,
      verifications,
      vade,
      web3,
    });
    vc = new Vc(
      {
        accountStore,
        contractLoader,
        dfs,
        did,
        executor,
        nameResolver,
        signerIdentity: signer,
        verifications,
        web3,
        cryptoProvider,
      },
      { credentialStatusEndpoint: config.smartAgents.didAndVc.vcRevokationStatusEndpoint },
    );
    identity = new Identity({
      activeIdentity,
      contractLoader,
      did,
      executor,
      mailbox,
      nameResolver,
      profile,
      runtimeConfig,
      underlyingAccount,
      verifications,
      web3,
    });
    verifications.updateConfig(
      {
        did,
        vade,
        vc,
        ...(runtimeConfig.useIdentity && { signerIdentity: signer }),
      },
      { activeIdentity, underlyingAccount },
    );
  }

  if (await profile.exists()) {
    logger.log(`profile for ${activeIdentity} exists, fetching keys`, 'debug');
    try {
      keyExchange.setPublicKey(
        await profile.getPublicKey(),
        await profile.getContactKey(activeIdentity, 'dataKey'),
      );
    } catch (ex) {
      logger.log(
        `fetching keys for ${activeIdentity} failed with "${ex.msg || ex}", `
        + 'removing profile from runtime', 'warning',
      );
      profile = null;
      keyProvider.profile = null;
    }
  } else {
    logger.log(`profile for ${activeIdentity} doesn't exist`, 'debug');
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
    web3,
  });

  const encryptionWrapper = options.encryptionWrapper || new EncryptionWrapper({
    cryptoProvider,
    nameResolver,
    profile,
    sharing,
    web3,
  });

  // return runtime object
  return {
    accountStore,
    activeAccount,
    baseContract,
    config,
    contractLoader,
    contracts,
    cryptoProvider,
    dataContract,
    description,
    dfs,
    encryptionWrapper,
    environment,
    eventHub,
    executor,
    identity,
    ipld,
    keyExchange,
    keyProvider,
    logger,
    mailbox,
    nameResolver,
    onboarding,
    payments,
    profile,
    rightsAndRoles,
    runtimeConfig,
    serviceContract,
    sharing,
    signer,
    verifications,
    votings,
    web3,
    // optional properties
    ...(activeIdentity && { activeIdentity }),
    ...(did && { did }),
    ...(underlyingAccount && { underlyingAccount }),
    ...(vade && { vade }),
    ...(vc && { vc }),
  };
}

/**
 * create new runtime instance
 *
 * @param      {any}               web3           connected web3 instance
 * @param      {DfsInterface}      dfs            interface for retrieving file from dfs
 * @param      {any}               runtimeConfig  configuration values
 * @return     {Promise<Runtime>}  runtime instance
 */
export async function createDefaultRuntime(
  web3: any, dfs: DfsInterface, orgRuntimeConfig: any, options: Runtime = { },
): Promise<Runtime> {
  const runtimeConfig = cloneDeep(orgRuntimeConfig);
  const logger = options.logger || (new Logger());
  let contextLessRuntime;

  // check if mnemonic and password are given
  if (runtimeConfig.mnemonic && runtimeConfig.password) {
    const tempConfig: any = await Onboarding.generateRuntimeConfig(
      runtimeConfig.mnemonic,
      runtimeConfig.password,
      web3,
    );
    // eslint-disable-next-line prefer-destructuring
    runtimeConfig.account = Object.keys(tempConfig.accountMap)[0];
    if (!runtimeConfig.accountMap) {
      (runtimeConfig as any).accountMap = {};
    }
    if (!runtimeConfig.keyConfig) {
      (runtimeConfig as any).keyConfig = {};
    }
    Object.assign(runtimeConfig.accountMap, tempConfig.accountMap);
    // do not apply the encryption key directly, will be handled by keyConfig account + password
    // handling
    Object.assign(runtimeConfig.keyConfig, {
      [runtimeConfig.account]: runtimeConfig.password,
    });
    // cleanup runtime
    delete runtimeConfig.mnemonic;
    delete runtimeConfig.password;
  } else if (!runtimeConfig.accountMap
       || !(Object.keys(runtimeConfig.accountMap).length)) {
    throw new Error('accountMap invalid');
  }

  // check and modify if any accountid with password is provided
  if (runtimeConfig.keyConfig) {
    const accountIds = Object.keys(runtimeConfig.keyConfig);
    await Promise.all(accountIds.map(async (accountId: string) => {
      // check if the key is a valid accountId
      if (accountId.length !== 42) {
        return;
      }

      let dataKey;
      let useDefaultDatakey = !runtimeConfig.useIdentity;
      const sha3Account = web3.utils.soliditySha3(accountId);
      const sha9Account = web3.utils.soliditySha3(sha3Account, sha3Account);

      // if useIdentity is specified, try to generate dataKeys with identity
      if (runtimeConfig.useIdentity) {
        if (!contextLessRuntime) {
          // create a runtime without account relation, just for accesing some bcc class instances
          contextLessRuntime = createRuntime(
            web3,
            dfs,
            {
              accountMap: {
                [nullAddress]: 'no-private-key-here',
              },
            },
            options,
          );
        }

        // try out several dataKey encryption salting methods and check if, generated dataKeys are
        // correct
        let identity = nullAddress;
        try {
          identity = await (await contextLessRuntime).verifications
            .getIdentityForAccount(accountId, true);
        } catch (ex) {
          // when no identity for a account could be found, it's a uninitialized account, so we
          // should use default data key
          useDefaultDatakey = true;
          logger.log(`Could not find identity for account ${accountId} during keyConfig resolve.`
            + ' Using default data key.', 'warning');
        }

        if (identity !== nullAddress) {
          const encryptionSalts = [identity, accountId];
          // eslint-disable-next-line guard-for-in
          for (const encryptionSalt of encryptionSalts) {
            const saltedDataKey = web3.utils
              .keccak256(encryptionSalt + runtimeConfig.keyConfig[accountId])
              .replace(/^0x/, '');
            const tempRuntime = await createRuntime(web3, dfs, {
              accountMap: {
                [accountId]: runtimeConfig.accountMap[accountId],
              },
              keyConfig: {
                [sha3Account]: saltedDataKey,
                [sha9Account]: saltedDataKey,
              },
              useIdentity: runtimeConfig.useIdentity,
            });

            if (tempRuntime.profile) {
              dataKey = saltedDataKey;
              logger.log(`Using encryptionSalt "${encryptionSalt}" for`
                + ` generating dataKey in keyConfig for account "${accountId}".`, 'debug');
              break;
            }
          }
        }
      }

      if (useDefaultDatakey) {
        dataKey = web3.utils
          .keccak256(accountId + runtimeConfig.keyConfig[accountId])
          .replace(/0x/g, '');
        logger.log('Using default encryptionSalt for generating dataKey'
          + ` in keyConfig for account "${accountId}".`, 'debug');
      } else if (!dataKey) {
        throw new Error(`incorrect password for ${accountId} passed to keyConfig`);
      }

      // now add the different hashed accountids and datakeys to the runtimeconfig, if the
      // dataKey was correct
      runtimeConfig.keyConfig[sha3Account] = dataKey;
      runtimeConfig.keyConfig[sha9Account] = dataKey;
      delete runtimeConfig.keyConfig[accountId];
    }));
  }

  return createRuntime(web3, dfs, runtimeConfig, options);
}

/**
 * Creates and switches to a new runtime for identity.
 *
 * @param      {Runtime}  existingRuntime  existing runtime instance
 * @param      {string}   identity         identity address
 * @return     {Promise<Runtime>}  runtime instance
 */
export async function getRuntimeForIdentity(existingRuntime: Runtime,
  identity: string): Promise<Runtime> {
  const identityList = await existingRuntime.profile.getIdentityAccessList();
  let key = identityList[identity]?.identityAccess;
  // check if identityList contains the idenitity, if not throw an error.
  if (!key) {
    const addressHash = existingRuntime.nameResolver.soliditySha3(
      ...[
        existingRuntime.nameResolver.soliditySha3(identity),
        existingRuntime.nameResolver.soliditySha3(existingRuntime.activeIdentity),
      ].sort(),
    );
    key = identityList[addressHash]?.identityAccess;
    if (!key) {
      throw new Error('Access to identity is not permitted');
    }
  }

  // clone the runtimeConfig from existingRuntime
  const clonedRuntimeConfig = cloneDeep(existingRuntime.runtimeConfig);

  // check if identity is defined in the runtimeConfig
  clonedRuntimeConfig.identity = identity;
  clonedRuntimeConfig.useIdentity = true;

  // hash and add key to clonedRuntimeConfig keyConfig
  const sha3Identity = existingRuntime.web3.utils.soliditySha3(identity);
  const sha9Identity = existingRuntime.web3.utils.soliditySha3(sha3Identity, sha3Identity);
  clonedRuntimeConfig.keyConfig[sha3Identity] = key;
  clonedRuntimeConfig.keyConfig[sha9Identity] = key;
  // create new dfs
  const dfs = new Ipfs({ dfsConfig: (existingRuntime.dfs as any).dfsConfig });

  return createDefaultRuntime(existingRuntime.web3, dfs, clonedRuntimeConfig);
}
