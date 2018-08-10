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

import 'mocha';
import { expect } from 'chai';

import { AesEcb } from './aes-ecb'
import { TestUtils } from '../test/test-utils'

const sampleUnencrypted = 'Id commodo nulla ut eiusmod.';
const sampleKey = '346c22768f84f3050f5c94cec98349b3c5cbfa0b7315304e13647a49181fd1ef';

describe('aes (ecb) handler', function() {
  this.timeout(300000);

  it('should be able to be created', () => {
    const aes = new AesEcb();
    expect(aes).not.to.be.undefined;
  });

  it('should be able to generate keys', async () => {
    const aes = new AesEcb();
    const key = await aes.generateKey();
    expect(key).not.to.be.undefined;
  });

  it('should be able to encrypt and decrypt a random message', async () => {
    const aes = new AesEcb();
    const key = await aes.generateKey();
    const message = Buffer.from(Math.random().toString(), 'utf-8');
    const encrypted = await aes.encrypt(message, { key: key, });
    const decrypted = await aes.decrypt(encrypted, { key: key, });
    expect(decrypted.toString('utf-8')).to.eq(message.toString('utf-8'));
  });

  it('should be able to encrypt and decrypt a random number', async () => {
    const aes = new AesEcb();
    const key = await aes.generateKey();
    const message = Buffer.from(Math.random().toString(), 'utf-8');
    const encrypted = await aes.encrypt(message, { key: key, });
    const decrypted = await aes.decrypt(encrypted, { key: key, });
    expect(decrypted).to.deep.eq(message);
  });
});
