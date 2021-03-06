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

import { Runtime } from '../index';


export const nullAddress = '0x0000000000000000000000000000000000000000';
export const nullBytes32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

/**
 * retrieves chain name from web3's connected networks id, testcore is 508674158, core is 49262, if
 * not matching any of both, chain is threaded as testcore
 *
 * @param      {any}  web3    connected web3 instance
 * @return     {Promise<string>}  name of current chain
 */
export async function getEnvironment(web3: any): Promise<string> {
  const chainId = await web3.eth.net.getId();
  return chainId === 49262 ? 'core' : 'testcore';
}

/**
 * create auth header data to authenticate with current account/identity against a smart agent
 * server
 *
 * @param      {Runtime}  runtime   an initialized runtime
 * @param      {string}   message   (optional): message to sign, uses current timestamp by default
 * @param      {string}   identity  identity address that is controlled by the underlying
 *                                  account of the runtime, uses activeIdentity as default
 * @return     {Promise<string>}  auth header value as string
 */
export async function getSmartAgentAuthHeaders(
  runtime: Runtime,
  message?: string,
  identity = runtime.activeIdentity,
): Promise<string> {
  const messageToSign = message || `${new Date().getTime()}`;
  const hexMessage = runtime.web3.utils.toHex(messageToSign);
  const paddedMessage = hexMessage.length % 2 === 1 ? hexMessage.replace('0x', '0x0') : hexMessage;
  const signature = await runtime.signer.signMessage(runtime.underlyingAccount, paddedMessage);
  return [
    `EvanAuth ${runtime.underlyingAccount}`,
    `EvanIdentity ${identity}`,
    `EvanMessage ${paddedMessage}`,
    `EvanSignedMessage ${signature}`,
  ].join(',');
}

/**
 * obfuscates strings by replacing each character but the last two with 'x'
 *
 * @param      {string}  text    text to obfuscate
 * @return     {string}  obfuscated text
 */
export function obfuscate(text: string): string {
  return text
    ? `${[...Array(text.length - 2)].map(() => 'x').join('')}${text.substr(text.length - 2)}`
    : text;
}

/**
* run given function from this, use function(error, result) {..} callback for promise resolve/reject
* can be used like:
* api.helpers
*   .runFunctionAsPromise(fs, 'readFile', 'somefile.txt')
*   .then(content => console.log('file content: ' + content))
* ;
*
* @param  {Object} funThis      the functions 'this' object
* @param  {string} functionName name of the contract function to call
* @return {Promise}             resolves to: {Object}
*/
export async function promisify(funThis, functionName, ...args): Promise<any> {
  const functionArguments = args.slice(0);

  return new Promise(((resolve, reject) => {
    try {
      // add callback function to arguments
      functionArguments.push((error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
      // run function
      funThis[functionName](...functionArguments);
    } catch (ex) {
      reject(ex.message);
    }
  }));
}
