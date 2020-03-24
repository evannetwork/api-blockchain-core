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
  CryptoProvider,
  Ipld,
  Logger,
  LoggerOptions,
  NameResolver,
} from '../index';


/**
 * parameters for Profile constructor
 */
export interface BusinessCenterProfileOptions extends LoggerOptions {
  bcAddress: string;
  cryptoProvider: CryptoProvider;
  defaultCryptoAlgo: string;
  ipld: Ipld;
  nameResolver: NameResolver;
  ipldData?: any;
}


/**
 * profile helper class, builds profile graphs
 *
 * @class      Profile (name)
 */
export class BusinessCenterProfile extends Logger {
  public bcAddress: string;

  public cryptoProvider: CryptoProvider;

  public defaultCryptoAlgo: string;

  public ipld: Ipld;

  public ipldData: any;

  public nameResolver: NameResolver;

  public constructor(options: BusinessCenterProfileOptions) {
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
  public async storeToIpld(): Promise<string> {
    const stored = await this.ipld.store(this.ipldData);
    return stored;
  }

  /**
   * load profile from ipfs via ipld dag via ipfs file hash
   *
   * @param      {string}   ipldIpfsHash  ipfs file hash that points to a file with ipld a hash
   * @return     {Profile}  this profile
   */
  public async loadFromIpld(ipldIpfsHash: string): Promise<BusinessCenterProfile> {
    let loaded;
    try {
      loaded = await this.ipld.getLinkedGraph(ipldIpfsHash);
    } catch (e) {
      this.log(`Error getting BC Profile ${e}`, 'debug');
      loaded = {
        alias: {},
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
  public async getContactCard(): Promise<string> {
    return this.ipld.getLinkedGraph(this.ipldData, 'contactCard');
  }

  /**
   * set contact card on current profile
   *
   * @param      {any}  contactCard  contact card to store
   * @return     {any}  updated tree
   */
  public async setContactCard(contactCard: any): Promise<any> {
    const cryptor = this.cryptoProvider.getCryptorByCryptoAlgo(this.defaultCryptoAlgo);
    const cryptoInfo = cryptor.getCryptoInfo(this.nameResolver.soliditySha3(this.bcAddress));
    return this.ipld.set(this.ipldData, 'contactCard', contactCard, false, cryptoInfo);
  }

  /**
   * stores profile to business centers profile store
   *
   * @param      {string}   businessCenterDomain  ENS domain name of a business center
   * @param      {string}   account/identity               Ethereum account id
   * @return     {Promise}  resolved when done
   */
  public async storeForBusinessCenter(
    businessCenterDomain: string,
    identity: string,
  ): Promise<void> {
    const [stored, address] = await Promise.all([
      this.storeToIpld(),
      this.nameResolver.getAddress(businessCenterDomain),
    ]);
    const contract = this.nameResolver.contractLoader.loadContract(
      'BusinessCenterInterface', address,
    );
    await this.nameResolver.executor.executeContractTransaction(
      contract,
      'setMyProfile',
      { from: identity, autoGas: 1.1 },
      stored,
    );
  }

  /**
   * load profile for given account/Identity from global profile contract
   *
   * @param      {string}   businessCenterDomain  ENS domain name of a business center
   * @param      {string}   account/Identity               Ethereum account id
   * @return     {Promise}  resolved when done
   */
  // eslint-disable-next-line consistent-return
  public async loadForBusinessCenter(businessCenterDomain: string, identity: string): Promise<any> {
    const address = await this.nameResolver.getAddress(businessCenterDomain);
    const contract = this.nameResolver.contractLoader.loadContract(
      'BusinessCenterInterface', address,
    );
    const hash = await this.nameResolver.executor.executeContractCall(
      contract, 'getProfile', identity,
    );
    if (hash === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      this.ipldData = {
        alias: '',
      };
      return Promise.resolve();
    }
    await this.loadFromIpld(hash);
  }

  /**
   * gets all registered contracts for a specific contract type on a businesscenter
   *
   * @param      {string}  businessCenterDomain  The business center domain
   * @param      {string}  contractType          The contract type
   * @param      {string}  account               current accountId
   * @return     {Array}   Array with all registered bc contracts
   */
  public async getMyBusinessCenterContracts(
    businessCenterDomain: string,
    contractType: string,
    identity: string,
  ): Promise<any> {
    const address = await this.nameResolver.getAddress(businessCenterDomain);
    const contract = this.nameResolver.contractLoader.loadContract(
      'BusinessCenterInterface', address,
    );
    const bcIndex = await this.nameResolver.executor.executeContractCall(
      contract, 'getMyIndex', { from: identity },
    );
    const indexContract = this.nameResolver.contractLoader.loadContract(
      'DataStoreIndexInterface', bcIndex,
    );
    const contracts = await this.nameResolver.getArrayFromIndexContract(
      indexContract, this.nameResolver.soliditySha3(contractType),
    );
    return contracts;
  }
}
