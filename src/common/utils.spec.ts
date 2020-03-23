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

import 'mocha';
import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import { accounts, useIdentity } from '../test/accounts';
import { getSmartAgentAuthHeaders } from './utils';
import { Runtime } from '../index';
import { TestUtils } from '../test/test-utils';

use(chaiAsPromised);

function parseAuthData(authData) {
  const splitAuthHeader = authData.split(',');
  const authComponents = {} as any;
  splitAuthHeader.forEach((authHeader) => {
    const splitHeader = authHeader.split(' ');
    [, authComponents[splitHeader[0]]] = splitHeader;
  });
  return authComponents;
}
function ensureAuth(web3, authData, customMessage) {
  const authComponents = parseAuthData(authData);
  const signedTime = parseInt(authComponents.EvanMessage, 16);
  const maxAge = 1000 * 60 * 5; // max age of signed message is 5m
  if (!customMessage && (signedTime + maxAge) < Date.now()) {
    throw new Error('signed message has expired');
  }

  const authId = web3.eth.accounts.recover(
    authComponents.EvanMessage,
    authComponents.EvanSignedMessage,
  );
  if (authId !== authComponents.EvanAuth) {
    throw new Error('No verified Account.');
  }
  return authComponents;
}


describe('utils', function test() {
  this.timeout(60000);
  let runtime: Runtime;

  before(async () => {
    runtime = await TestUtils.getRuntime(accounts[0], null, { useIdentity });
  });

  it('can sign with default message syntax', async () => {
    const authData = await getSmartAgentAuthHeaders(runtime);
    const parsed = parseAuthData(authData);
    expect(parsed.EvanAuth).to.eq(runtime.activeAccount);
    expect(ensureAuth.bind(null, runtime.web3, authData)).not.to.throw();
  });

  it('can sign with custom message', async () => {
    const message = 'abc';
    const authData = await getSmartAgentAuthHeaders(runtime, message);
    const parsed = parseAuthData(authData);
    expect(parsed.EvanAuth).to.eq(runtime.activeAccount);
    expect(runtime.web3.utils.hexToUtf8(parsed.EvanMessage)).to.eq(message);
    expect(ensureAuth.bind(null, runtime.web3, authData, true)).not.to.throw();
  });
});
