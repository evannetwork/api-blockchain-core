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

const accountMap1 = {
  '0xb27E38D4E7efd5Cc159A56Ec079a1D4c752f1CD3':
    '0779e628fd129d0f94ce00e9338efbfb3029e8f18805f983325ed6ec385b93cb',
  '0xfc9bd8990c8487d7853616fb1130E89DF46935D1':
    '5a21dab9672ff720f4500822e2db308f2314d1dd0d1949780abc855ae48e2cc5',
  '0x001De828935e8c7e4cb56Fe610495cAe63fb2612':
    '01734663843202e2245e5796cb120510506343c67915eb4f9348ac0d8c2cf22a',
  '0x0030C5e7394585400B1FB193DdbCb45a37Ab916E':
    '7d09c0873e3f8dc0c7282bb7c2ba76bfd432bff53c38ace06193d1e4faa977e7',
  '0x00D1267B27C3A80080f9E1B6Ba01DE313b53Ab58':
    'a76a2b068fb715830d042ca40b1a4dab8d088b217d11af91d15b972a7afaf202',
  '0x0ab4F29ef71E591e209b1386CaDFc5B7CCB5102A':
    '70adb5e0424148e2b490776143a6a93662d3f40c3d9597690bdd3472863b7625',
};

const accountMap2 = {
  '0x0e10fa0aa2273F074F51a09F2eC95890816FD6d6':
    '4943D3A1D1457E627537D5C1DD6846B718807D11431283B659AED9F2988F3694',
  '0xb0646ee7b728B72bc9F73D0f9DDAf00D1a981fa0':
    'D9734AFE9168C37481A977C91FE25B9C7D814789F515D78DC084A27BD2137E14',
  '0x04B1Ee1b9D5283B2694B739DA5b49DBC88199750':
    '68475374AC69364D64F94A47D66410936F63971FE5EEAEFDF85913D153799EE5',
};

const accountMap3 = {
  '0xC2ee94f6cf046B02D530cf1cd16A2b32b8A4340d':
    'EF7012DD4D5DD6A78765C511F452F8CA641378F0DF071F9C32D506F45F31B22C',
  '0xac46D762f0aB316105C5Cf4375bb8e380Be88658':
    'E29C1E4A683CC629E39CE219CFB1F35BBA898605E1B197162F0EECF0F1139630',
  '0x35f8220bC83577458aEa4a1085A8b832DEa79b7a':
    '340BA316637FD01A1AFD54D4491A899F6D8EA0FB89A1D7BA94682F7D68B21B20',
};
// eslint-disable-next-line
let accountMap;
if (process.env && process.env.ACCOUNT_MAP) {
  accountMap = JSON.parse(process.env.ACCOUNT_MAP);
} else if (process.env && process.env.TESTSPEC === 'contracts') {
  accountMap = accountMap1;
} else if (process.env && process.env.TESTSPEC === 'datacontract') {
  accountMap = accountMap2;
} else if (process.env && process.env.TESTSPEC === 'services') {
  accountMap = accountMap3;
} else {
  accountMap = accountMap1;
}
const accounts = Object.keys(accountMap);

export { accounts, accountMap };
