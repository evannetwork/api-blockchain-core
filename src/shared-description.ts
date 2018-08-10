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

import { Envelope } from '@evan.network/dbcp';

import * as Dbcp from '@evan.network/dbcp';

import { Sharing } from './contracts/sharing';

export interface DescriptionOptions extends Dbcp.DescriptionOptions {
  sharing: Sharing,
}

export class Description extends Dbcp.Description {
  sharing: Sharing;

  constructor(options: DescriptionOptions) {
    super(options);
    this.sharing = options.sharing;
  }

  /**
   * loads description envelope from contract
   *
   * @param      {string}    ensAddress  The ens address where the description is stored
   * @return     {Envelope}  description as an Envelope
   */
  async getDescriptionFromContract(contractAddress: string, accountId: string): Promise<Envelope> {
    let result = null;
    const contract = this.contractLoader.loadContract('Described', contractAddress);
    const hash = await this.executor.executeContractCall(contract, 'contractDescription');
    if (hash && hash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      const content = (await this.dfs.get(hash)).toString(this.encodingEnvelope);
      result = JSON.parse(content);
      if (result.private && result.cryptoInfo) {
        if (this.sharing) {
          try {
            const cryptor = this.cryptoProvider.getCryptorByCryptoInfo(result.cryptoInfo);
            const sharingKey = await this.sharing.getKey(contractAddress, accountId, '*', result.cryptoInfo.block);
            const key = sharingKey;
            const privateData = await cryptor.decrypt(
              Buffer.from(result.private, this.encodingEncrypted), { key, });
              result.private = privateData;
          } catch (e) {
            result.private = new Error('wrong_key');
          }
        } else {
          result.private = new Error('profile_sharing_missing');
        }
      }
    }
    return result;
  };


  /**
   * store description at contract
   *
   * @param      {string}           contractAddress  The contract address where description will be
   *                                                 stored
   * @param      {Envelope|string}  envelope         description as an envelope or a presaved description hash
   * @param      {string}           accountId        ETH account id
   * @return     {Promise}          resolved when done
   */
  async setDescriptionToContract(contractAddress: string, envelope: Envelope|string, accountId: string):
      Promise<void> {
    let hash;
    if (typeof envelope === 'string') {
      hash = envelope;
    } else {
      const content: Envelope = Object.assign({}, envelope);
      // add dbcp version
      content.public.dbcpVersion = content.public.dbcpVersion || this.dbcpVersion;
      const validation = this.validateDescription(content);
      if (validation !== true) {
        throw new Error(`description invalid: ${JSON.stringify(validation)}`);
      }
      if (content.private && content.cryptoInfo) {
        const cryptor = this.cryptoProvider.getCryptorByCryptoInfo(content.cryptoInfo);
        const blockNr = await this.web3.eth.getBlockNumber();
        const sharingKey = await this.sharing.getKey(contractAddress, accountId, '*', blockNr);
        const key = sharingKey;
        const encrypted = await cryptor.encrypt(content.private, { key, });
        content.private = encrypted.toString(this.encodingEncrypted);
        content.cryptoInfo.block = blockNr;
      }
      hash = await this.dfs.add(
        'description', Buffer.from(JSON.stringify(content), this.encodingEnvelope));
    }
    const contract = this.contractLoader.loadContract('Described', contractAddress);
    await this.executor.executeContractTransaction(contract, 'setContractDescription', {from: accountId, gas: 200000}, hash);
  };
}
