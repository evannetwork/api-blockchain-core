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
/**
 * obfuscates strings by replacing each character but the last two with 'x'
 *
 * @param      {string}  text    text to obfuscate
 * @return     {string}  obfuscated text
 */
export function obfuscate(text: string): string {
  return text ? `${[...Array(text.length - 2)].map(() => 'x').join('')}${text.substr(text.length - 2)}` : text;
}

/**
* run given function from this, use function(error, result) {...} callback for promise resolve/reject
* can be used like:
* api.helpers
*   .runFunctionAsPromise(fs, 'readFile', 'somefile.txt')
*   .then(content => console.log('file content: ' + content))
* ;
*
* @param  {Object} funThis      the functions 'this' object
* @param  {string} functionName name of the contract function to call
* @return {Promise}             resolves to: {Object} (the result from the function(error, result) {...} callback)
*/
export async function promisify(funThis, functionName, ...args): Promise<any> {
 let functionArguments = args.slice(0);

 return new Promise(function(resolve, reject) {
   try {
     // add callback function to arguments
     functionArguments.push(function(error, result) {
       if (error) {
         reject(error);
       } else {
         resolve(result);
       }
     });
     // run function
     funThis[functionName].apply(funThis, functionArguments);
   } catch (ex) {
     reject(ex.message);
   }
 });
}
