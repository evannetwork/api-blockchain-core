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

// expose dbcp modules
export {
  AccountStore,
  AccountStoreOptions,
  ContractLoader,
  ContractLoaderOptions,
  CryptoInfo,
  Cryptor,
  DfsInterface,
  Envelope,
  EventHub,
  EventHubOptions,
  Executor,
  ExecutorOptions,
  KeyProvider,
  KeyProviderInterface,
  KeyProviderOptions,
  KeyStoreInterface,
  LogLevel,
  LogLogInterface,
  Logger,
  LoggerOptions,
  SignerExternal,
  SignerInterface,
  SignerInternal,
  SignerInternalOptions,
  Unencrypted,
  Validator,
  ValidatorOptions,
} from '@evan.network/dbcp'


// expose modules from here
export * from './contracts/base-contract/base-contract';
export * from './contracts/data-contract/data-contract';
export * from './contracts/digital-twin/container';
export * from './contracts/digital-twin/digital-twin';
export * from './contracts/executor-agent';
export * from './contracts/executor-wallet';
export * from './contracts/rights-and-roles';
export * from './contracts/service-contract/service-contract';
export * from './contracts/sharing';
export * from './contracts/signer-identity';
export * from './contracts/wallet';
export * from './dfs/ipfs';
export * from './dfs/ipld';
export * from './did/did-resolver';
export * from './encryption/aes';
export * from './encryption/aes-blob';
export * from './encryption/aes-ecb';
export * from './encryption/crypto-provider';
export * from './encryption/encryption-wrapper';
export * from './keyExchange';
export * from './mailbox';
export * from './name-resolver';
export * from './onboarding';
export * from './payments';
export * from './profile/business-center-profile';
export * from './profile/profile';
export * from './runtime';
export * from './shared-description';
export * from './verifications/verifications';
export * from './votings/votings';

// partial and custom exports
import { getSmartAgentAuthHeaders } from './common/utils';
const utils = { getSmartAgentAuthHeaders };
export { utils };

/******** export these libraries to be able to build the blockchain-core into a umd bundle ********/
import * as AccountType from './profile/types/types';
import Web3 = require('web3');
import crypto = require('crypto');
import keystore = require('../libs/eth-lightwallet/keystore.js');
import lodash = require('lodash');
import prottle = require('prottle');
// assign to export Buffer;
const buffer = Buffer;
// load adjusted bitcore mnemonic lib and do not load the full API specification to reduce bundle size
// be careful when used adjusted components!
import Mnemonic = require('../libs/bitcore-mnemonic/mnemonic.js');
let instanceId = Date.now() + Math.random();
// used for global & shared available logLog
let logLog = [ ];
// push everything into the logLog
let logLogLevel = 0;

export {
  AccountType,
  Mnemonic,
  Web3,
  buffer,
  crypto,
  instanceId,
  keystore,
  lodash,
  logLog,
  logLogLevel,
  prottle,
}
