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

import {
  Logger,
  LoggerOptions,
  NameResolver,
} from '@evan.network/dbcp';

import { CryptoProvider } from '../encryption/crypto-provider';
import { Ipld } from '../dfs/ipld';

function saveGet(root, labels) {
  const split = labels.split('/');
  let pointer = root;
  for (let i = 0; i < split.length; i++) {
    let sublabel = split[i];
    if (pointer.hasOwnProperty(sublabel)) {
      pointer = pointer[sublabel];
    } else {
      pointer = undefined;
      break;
    }
  }
  return pointer;
}


function saveSet(root, labels, child) {
  const split = labels.split('/');
  let pointer = root;
  for (let i = 0; i < split.length; i++) {
    let sublabel = split[i];
    if (i === split.length - 1) {
      pointer[sublabel] = child;
    } else if (!pointer[sublabel]) {
      pointer[sublabel] = {};
    }
    pointer = pointer[sublabel];
  }
}


/**
 * parameters for Profile constructor
 */
export interface ProfileOptions extends LoggerOptions {
  ipld: Ipld;
  nameResolver: NameResolver;
  defaultCryptoAlgo: string;
  cryptoProvider: CryptoProvider
  bcAddress: string;
  ipldData?: any;
}


export interface DappBookmark {
  title: string;
  description: string;
  img: string;
  primaryColor: string;
  secondaryColor?: string;
}


/**
 * profile helper class, builds profile graphs
 *
 * @class      Profile (name)
 */
export class BusinessCenterProfile extends Logger {
  ipldData: any;
  ipld: Ipld;
  nameResolver: NameResolver;
  defaultCryptoAlgo: string;
  cryptoProvider: CryptoProvider;
  bcAddress: string;

  constructor(options: ProfileOptions) {
    super(options);
    this.ipld = options.ipld;
    this.ipldData = options.ipldData || {};
    this.nameResolver = options.nameResolver;
    this.bcAddress = options.bcAddress;
    this.cryptoProvider = options.cryptoProvider;
    this.defaultCryptoAlgo = options.defaultCryptoAlgo;
  }

  /**
   * store profile in ipfs as an ipfs file that points to a ipld dag
   *
   * @return     {string}  hash of the ipfs file
   */
  async storeToIpld(): Promise<string> {
    const stored = await this.ipld.store(this.ipldData);
    return stored;
  }

  /**
   * load profile from ipfs via ipld dag via ipfs file hash
   *
   * @param      {string}   ipldIpfsHash  ipfs file hash that points to a file with ipld a hash
   * @return     {Profile}  this profile
   */
  async loadFromIpld(ipldIpfsHash: string): Promise<BusinessCenterProfile> {
    let loaded;
    try {
     loaded = await this.ipld.getLinkedGraph(ipldIpfsHash);
    } catch (e) {
      this.log(`Error getting BC Profile ${e}`, 'debug');
      loaded = {
        alias: {}
      };
    }
    this.ipldData = loaded;
    return this;
  }

  /**
   * get contact card from
   *
   * @return     {any}     contact card
   */
  async getContactCard(): Promise<string> {
    return this.ipld.getLinkedGraph(this.ipldData, 'contactCard');
  }

  /**
   * set contact card on current profile
   *
   * @param      {any}  contactCard  contact card to store
   * @return     {any}  updated tree
   */
  async setContactCard(contactCard: any): Promise<any> {
    const cryptor = this.cryptoProvider.getCryptorByCryptoAlgo(this.defaultCryptoAlgo);
    const cryptoInfo = cryptor.getCryptoInfo(this.nameResolver.soliditySha3(this.bcAddress));
    return this.ipld.set(this.ipldData, 'contactCard', contactCard, false, cryptoInfo);
  }

  /**
   * stores profile to business centers profile store
   *
   * @param      {string}   businessCenterDomain  ENS domain name of a business center
   * @param      {string}   account               Ethereum account id
   * @return     {Promise}  resolved when done
   */
  async storeForBusinessCenter(businessCenterDomain: string, account: string): Promise<void> {
    const [stored, address] = await Promise.all([
      this.storeToIpld(),
      this.nameResolver.getAddress(businessCenterDomain),
    ]);
    const contract = this.nameResolver.contractLoader.loadContract('BusinessCenterInterface', address);
    await this.nameResolver.executor.executeContractTransaction(
      contract,
      'setMyProfile',
      { from: account, autoGas: 1.1, },
      stored,
    );
  }

  /**
   * load profile for given account from global profile contract
   *
   * @param      {string}   businessCenterDomain  ENS domain name of a business center
   * @param      {string}   account               Ethereum account id
   * @return     {Promise}  resolved when done
   */
  async loadForBusinessCenter(businessCenterDomain: string, account: string): Promise<any> {
    const address = await this.nameResolver.getAddress(businessCenterDomain);
    const contract = this.nameResolver.contractLoader.loadContract('BusinessCenterInterface', address);
    const hash = await this.nameResolver.executor.executeContractCall(contract, 'getProfile', account);
    if (hash === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      this.ipldData = {
        alias: '',
      };
      return Promise.resolve();
    } else {
      await this.loadFromIpld(hash);
    }
  }
}
