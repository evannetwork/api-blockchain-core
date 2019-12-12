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
  CryptoInfo,
  Cryptor,
} from '@evan.network/dbcp';

import * as Dbcp from '@evan.network/dbcp';


/**
 * wrapper for supported cryptors
 *
 * @class      CryptoProvider (name)
 */
export class CryptoProvider extends Dbcp.CryptoProvider {
  public constructor(cryptors) {
    super(cryptors);
  }

  /**
   * get a Cryptor matching the provided CryptoInfo
   *
   * @param      {CryptoInfo}  info    details about en-/decryption
   * @return     {Cryptor}     matching cryptor
   */
  public getCryptorByCryptoInfo(info: CryptoInfo): Cryptor {
    switch (info.algorithm) {
      case 'aes-256-cbc': return this.cryptors.aes;
      case 'unencrypted': return this.cryptors.unencrypted;
      case 'aes-blob': return this.cryptors.aesBlob;
      default: throw new Error(`algorithm unsupported ${info.algorithm}`);
    }
  }
}
