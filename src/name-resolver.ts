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
   * tries to claim node ownership from parent nodes owner,
   * this assumes, that the parent node owner is a FIFS registar
   *
   * @param      name           domain name to set (plain text)
   * @param      accountId      account, that executes the transaction
   * @param      domainOwnerId  owner of the new domain, fallbacks to accountId
   * @return     {Promise<void>}   resolved when done
   */
  public async claimAddress(
      name: string, accountId: string, domainOwnerId = accountId, value = '0'): Promise<void> {
    // check ownership
    const namehash = this.namehash(name);
    const nodeOwner = await this.executor.executeContractCall(this.ensContract, 'owner', namehash);
    if (nodeOwner === domainOwnerId) {
      // node is already owned by account
      return;
    } else if (nodeOwner !== '0x0000000000000000000000000000000000000000' && value === '0' ) {
      // if node is owned and we don't try a payable registrar node ownership overwrite
      const msg = `cannot claim address "${name}", address "${name}" already claimed by "${nodeOwner}"`;
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
      this.soliditySha3(node),
      domainOwnerId,
    );
  }

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

  public async setPrice(parentName: string, accountId: string, newPrice: number|string): Promise<string> {
    const parentOnwer = await this.executor.executeContractCall(
      this.ensContract, 'owner', this.namehash(parentName));
    if (parentOnwer === '0x0000000000000000000000000000000000000000') {
      const msg = `cannot set price for "${parentName}", node is not owned`;
      this.log(msg, 'error');
      throw new Error(msg);
    }
    if ((await this.web3.eth.getCode(parentOnwer)) === '0x') {
      const msg = `cannot set price for "${parentName}", ` +
        `node owner "${parentOnwer}" does not seem to be a contract`;
      this.log(msg, 'error');
      throw new Error(msg);
    }
    const registrar = this.contractLoader.loadContract('PayableRegistrar', parentOnwer);
    return this.executor.executeContractTransaction(
      registrar,
      'setPrice',
      { from: accountId },
      newPrice,
    );
  }
}
