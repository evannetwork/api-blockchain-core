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

export {
  AccountStore,
  ContractLoader,
  DfsInterface,
  Envelope,
  EventHub,
  Executor,
  KeyProvider,
  KeyProviderInterface,
  Logger,
  LogLevel,
  SignerExternal,
  SignerInternal,
  Unencrypted,
  Validator,
} from '@evan.network/dbcp'

export { Aes } from './encryption/aes';
export { AesBlob } from './encryption/aes-blob';
export { AesEcb } from './encryption/aes-ecb';
export { BusinessCenterProfile } from './profile/business-center-profile';
export { BaseContract, ContractState } from './contracts/base-contract/base-contract';
export { createDefaultRuntime, Runtime } from './runtime';
export { CryptoProvider } from './encryption/crypto-provider';
export { DataContract } from './contracts/data-contract/data-contract';
export { Description } from './shared-description';
export { ExecutorAgent } from './contracts/executor-agent';
export { ExecutorWallet } from './contracts/executor-wallet';
export { Ipfs } from './dfs/ipfs';
export { Ipld } from './dfs/ipld';
export { KeyExchange } from './keyExchange';
export { Mailbox, Mail } from './mailbox';
export { NameResolver } from './name-resolver';
export { Onboarding } from './onboarding';
export { Payments } from './payments';
export { Profile } from './profile/profile';
export { RightsAndRoles, ModificationType, PropertyType } from './contracts/rights-and-roles';
export { ServiceContract, Answer, AnswerResult, Call, CallResult } from './contracts/service-contract/service-contract';
export { Sharing } from './contracts/sharing';
export {
  Verifications,
  VerificationsDelegationInfo,
  VerificationsQueryOptions,
  VerificationsResultV2,
  VerificationsStatus,
  VerificationsStatusComputer,
  VerificationsStatusFlagsV2,
  VerificationsStatusV2,
  VerificationsValidationOptions,
  VerificationsVerificationEntry,
  VerificationsVerificationEntryStatusComputer,
} from './verifications/verifications';
export { Votings, MemberOptions, ProposalInfo, ProposalInfos, ProposalOptions, VotingsContractOptions } from './votings/votings';
export { Wallet } from './contracts/wallet';
export { Container, ContainerConfig, ContainerFile, ContainerTemplate, ContainerPlugin, ContainerTemplateProperty,
  ContainerShareConfig, ContainerOptions, } from './contracts/digital-twin/container';
export { DigitalTwin, DigitalTwinEntryType, DigitalTwinConfig, DigitalTwinIndexEntry,
  DigitalTwinVerificationEntry, } from './contracts/digital-twin/digital-twin';
import { getSmartAgentAuthHeaders } from './common/utils';
const utils = { getSmartAgentAuthHeaders };
export { utils };

/******** export these libraries to be able to build the blockchain-core into an umd bundle ********/
import Web3 = require('web3');
import prottle = require('prottle');
import crypto = require('crypto');
import lodash = require('lodash');
import keystore = require('../libs/eth-lightwallet/keystore.js');
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

export { Web3, prottle, crypto, keystore, Mnemonic, instanceId, logLog, logLogLevel, buffer, lodash }
