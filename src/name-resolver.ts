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
import * as Dbcp from '@evan.network/dbcp';
import prottle = require('prottle');


export class NameResolver extends Dbcp.NameResolver {
  constructor(options: any) {
    super(options);
  }

  /**
   * tries to claim node ownership from parent nodes owner, this assumes, that the parent node owner
   * is a registar, that supports claiming address from it (FIFS registrar or PayableRegistrar)
   *
   * @param      {string}         name           domain name to set (plain text)
   * @param      {string}         accountId      account, that executes the transaction
   * @param      {string}         domainOwnerId  owner of the new domain, fallbacks to accountId
   * @param      {string|number}  value          (optional) value to send (if registrar is payable)
   * @return     {Promise<void>}  resolved when done
   */
  public async claimAddress(
      name: string, accountId: string, domainOwnerId = accountId, value = '0'): Promise<void> {
    // check ownership
    const namehash = this.namehash(name);
    const nodeOwner = await this.executor.executeContractCall(this.ensContract, 'owner', namehash);
    if (nodeOwner !== domainOwnerId &&
        nodeOwner !== '0x0000000000000000000000000000000000000000' &&
        value === '0' ) {
      // if node is owned and we don't try a payable registrar node ownership overwrite/renew
      const msg = `cannot claim address "${name}", it\'s' already claimed by "${nodeOwner}"`;
      this.log(msg, 'error');
      throw new Error(msg);
    }

    const [ , node, parentName  ] = /^([^.]+)\.(.*)$/.exec(name);
    const parentOnwer = await this.executor.executeContractCall(
      this.ensContract, 'owner', this.namehash(parentName));
    if (parentOnwer === '0x0000000000000000000000000000000000000000') {
      const msg = `cannot claim address "${name}", parent node is not owned`;
      this.log(msg, 'error');
      throw new Error(msg);
    }
    if ((await this.web3.eth.getCode(parentOnwer)) === '0x') {
      const msg = `cannot claim address "${name}", ` +
        `parent node owner "${parentOnwer}" does not seem to be a contract`;
      this.log(msg, 'error');
      throw new Error(msg);
    }
    const registrar = this.contractLoader.loadContract(
      value ? 'PayableRegistrar' : 'FIFSRegistrar', parentOnwer);
    await this.executor.executeContractTransaction(
      registrar,
      'register',
      { from: accountId, value },
      this.web3.utils.sha3(`${node}`),
      domainOwnerId,
    );
  }

  /**
   * registers a permanent domain via registrar, can only be done by registrar owner
   *
   * @param      {string}         name           domain name to set (plain text)
   * @param      {string}         accountId      account, that executes the transaction, has to be
   *                                             registrar owner
   * @param      {string}         domainOwnerId  owner of the new domain, fallbacks to accountId
   * @return     {Promise<void>}  resolved when done
   */
  public async claimPermanentAddress(
      name: string, accountId: string, domainOwnerId = accountId): Promise<void> {
    const [ , node, parentName  ] = /^([^.]+)\.(.*)$/.exec(name);
    const parentOnwer = await this.executor.executeContractCall(
      this.ensContract, 'owner', this.namehash(parentName));
    if (parentOnwer === '0x0000000000000000000000000000000000000000') {
      const msg = `cannot claim address "${name}", parent node is not owned`;
      this.log(msg, 'error');
      throw new Error(msg);
    }
    if ((await this.web3.eth.getCode(parentOnwer)) === '0x') {
      const msg = `cannot claim address "${name}", ` +
        `parent node owner "${parentOnwer}" does not seem to be a contract`;
      this.log(msg, 'error');
      throw new Error(msg);
    }
    const registrar = this.contractLoader.loadContract('PayableRegistrar', parentOnwer);
    await this.executor.executeContractTransaction(
      registrar, 'registerPermanent', { from: accountId }, this.soliditySha3(node), domainOwnerId);
  }

  /**
   * claim funds for domain
   *
   * @param      {string}         name       ENS address of a domain owned by a registrar (e.g.
   *                                         'sample.payable.test.evan')
   * @param      {string}         accountId  account that performs the action (needs proper
   *                                         permisions for registrar)
   * @return     {Promise<void>}  resolved when done
   */
  public async claimFunds(name: string, accountId: string): Promise<void> {
    const parentOnwer = await this.executor.executeContractCall(
      this.ensContract, 'owner', this.namehash(name));
    if (parentOnwer === '0x0000000000000000000000000000000000000000') {
      const msg = `cannot claim funds for "${name}", node is not owned`;
      this.log(msg, 'error');
      throw new Error(msg);
    }
    if ((await this.web3.eth.getCode(parentOnwer)) === '0x') {
      const msg = `cannot claim funds for "${name}", ` +
        `node owner "${parentOnwer}" does not seem to be a contract`;
      this.log(msg, 'error');
      throw new Error(msg);
    }
    const registrar = this.contractLoader.loadContract('PayableRegistrar', parentOnwer);
    await this.executor.executeContractTransaction(registrar, 'claimFunds', { from: accountId });
  }

  /**
   * get price for domain (if domain is payable)
   *
   * @param      {string}           name    a domain to check price for (e.g.
   *                                        'sample.payable.test.evan')
   * @return     {Promise<string>}  price in Wei
   */
  public async getPrice(name: string): Promise<string> {
    const [ , , parentName  ] = /^([^.]+)\.(.*)$/.exec(name);
    const parentOnwer = await this.executor.executeContractCall(
      this.ensContract, 'owner', this.namehash(parentName));
    if (parentOnwer === '0x0000000000000000000000000000000000000000') {
      const msg = `cannot get price for "${name}", parent node is not owned`;
      this.log(msg, 'error');
      throw new Error(msg);
    }
    if ((await this.web3.eth.getCode(parentOnwer)) === '0x') {
      const msg = `cannot get price for "${name}", ` +
        `parent node owner "${parentOnwer}" does not seem to be a contract`;
      this.log(msg, 'error');
      throw new Error(msg);
    }
    const registrar = this.contractLoader.loadContract('PayableRegistrar', parentOnwer);
    return this.executor.executeContractCall(registrar, 'price');
  }

  /**
   * get timestamp, when domain will stop resolval
   *
   * @param      {string}           name        domain to get valid until for
   * @return     {Promise<number>}  js timestamp, when resolver lookup will expire
   */
  public async getValidUntil(name: string): Promise<number> {
    const solTimestamp = await this.executor.executeContractCall(
      this.ensContract,
      'validUntil',
      this.namehash(name),
    );
    return parseInt(`${solTimestamp.toString()}000`, 10);
  }

  /**
   * set price for a registrar at a domain
   *
   * @param      {string}         name       ENS address of a domain owned by a registrar (e.g.
   *                                         'sample.payable.test.evan')
   * @param      {string}         accountId  account that performs the action (needs proper
   *                                         permisions for registrar)
   * @param      {number|string}  newPrice   new price in Wei
   * @return     {Promise<void>}  resolved when done
   */
  public async setPrice(name: string, accountId: string, newPrice: number|string): Promise<void> {
    const parentOnwer = await this.executor.executeContractCall(
      this.ensContract, 'owner', this.namehash(name));
    if (parentOnwer === '0x0000000000000000000000000000000000000000') {
      const msg = `cannot set price for "${name}", node is not owned`;
      this.log(msg, 'error');
      throw new Error(msg);
    }
    if ((await this.web3.eth.getCode(parentOnwer)) === '0x') {
      const msg = `cannot set price for "${name}", ` +
        `node owner "${parentOnwer}" does not seem to be a contract`;
      this.log(msg, 'error');
      throw new Error(msg);
    }
    const registrar = this.contractLoader.loadContract('PayableRegistrar', parentOnwer);
    await this.executor.executeContractTransaction(
      registrar,
      'setPrice',
      { from: accountId },
      newPrice,
    );
  }

  /**
   * set duration, that an address is valid; resolval stops after this, depending on configuration
   * of the ENS an extra period, where owner is still available, can be granted; notice that this
   * can only be done by parent owner of given domain
   *
   * @param      {string}         name        domain to set valid until for
   * @param      {string}         accountId   account that performs the action; must be parent owner
   *                                          of given domain
   * @param      {number|string}  validUntil  js timestamp, when name resolution stops
   * @return     {Promise<void>}  resolved when done
   */
  public async setValidUntil(
      name: string, accountId: string, validUntil: number|string): Promise<void> {
    const numberString = `${validUntil}`;
    await this.executor.executeContractTransaction(
      this.ensContract,
      'setValidUntil',
      { from: accountId },
      this.namehash(name),
      numberString.substr(0, numberString.length - 3),
    );
  }
}
