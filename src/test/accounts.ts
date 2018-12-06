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

const accountMap = {
  '0x001De828935e8c7e4cb56Fe610495cAe63fb2612':
    '01734663843202e2245e5796cb120510506343c67915eb4f9348ac0d8c2cf22a',
  '0x0030C5e7394585400B1FB193DdbCb45a37Ab916E':
    '7d09c0873e3f8dc0c7282bb7c2ba76bfd432bff53c38ace06193d1e4faa977e7',
  '0x00D1267B27C3A80080f9E1B6Ba01DE313b53Ab58':
    'a76a2b068fb715830d042ca40b1a4dab8d088b217d11af91d15b972a7afaf202',
};

const accountMap2 = {
  '0x0e10fa0aa2273F074F51a09F2eC95890816FD6d6':
    '4943D3A1D1457E627537D5C1DD6846B718807D11431283B659AED9F2988F3694',
  '0xb0646ee7b728B72bc9F73D0f9DDAf00D1a981fa0':
    'D9734AFE9168C37481A977C91FE25B9C7D814789F515D78DC084A27BD2137E14',
  '0x04B1Ee1b9D5283B2694B739DA5b49DBC88199750':
    '68475374AC69364D64F94A47D66410936F63971FE5EEAEFDF85913D153799EE5'
}
let accounts;
let returnMap;
if (<any>process.env && <any>process.env.TESTSPEC === 'contracts') {
  accounts = Object.keys(accountMap);
  returnMap =  accountMap;
} else if (<any>process.env && <any>process.env.TESTSPEC === 'services') {
  accounts = Object.keys(accountMap2);
  returnMap =  accountMap2;
} else {
  accounts = Object.keys(accountMap);
  returnMap =  accountMap;
}

export { accounts, accountMap }
