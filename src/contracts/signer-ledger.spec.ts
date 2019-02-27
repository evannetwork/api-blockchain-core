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

import 'mocha';
import 'babel-polyfill';
import { expect, use } from 'chai';
import chaiAsPromised = require('chai-as-promised');

import {
  DfsInterface,
  Executor,
  NameResolver,
} from '@evan.network/dbcp';

import { accounts } from '../test/accounts';
import { config } from '../config';
import { SignerLedger } from './signer-ledger';
import { TestUtils } from '../test/test-utils';

use(chaiAsPromised);


describe('SignerLedger handler', function() {
  this.timeout(300000);
  let signerLedger: SignerLedger;
  let web3;

  before(async () => {
    web3 = TestUtils.getWeb3();
    const contractLoader = await TestUtils.getContractLoader(web3);
    signerLedger = new SignerLedger({
      contractLoader,
      config,
      web3,
    });
    await signerLedger.init();
  });

  it('can sign messages', async () => {
    const message = `some random message: ${Math.random()}`
    const account = await signerLedger.getAccount();
    const signature = await signerLedger.signMessage(message);

    const recoveredSigner = await web3.eth.accounts.recover(message, signature);
    expect(recoveredSigner).to.eq(account);
  });

  it('can sign transactions', async () => {
    const account = await signerLedger.getAccount();
    const value = Math.floor(Math.random() * 1e6);
    const inc = 1.1**0
    console.log(`sending ${value}`)
    try {
      const receipt = await new Promise((s, r) => {
        signerLedger.signAndExecuteSend(
          { from: account, to: account, value, gas: '0x7530', gasPrice: Math.floor(20e9 * inc) },
          (err, result) => { err ? r(err) : s(result) },
        );
      });
    } catch (ex) {
      console.error(ex);
      console.log(ex.stack)
      throw new Error(ex);
    }
  });

  it.only('can create contracts', async() => {
    const account = await signerLedger.getAccount();
    try {
      await signerLedger.createContract(
        'Owned',
        [],
        { from: account, to: account, gas: 500000 },
      );
    } catch (ex) {
      console.error(ex);
      console.log(ex.stack)
      throw new Error(ex);
    }
  });
});
