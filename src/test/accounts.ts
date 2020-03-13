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
import * as Web3 from 'web3';

// eslint-disable-next-line import/no-mutable-exports
let useIdentity = false;
try {
  useIdentity = JSON.parse(process.env.USE_IDENTITY);
} catch (_) {
  // silently continue
}

const localWeb3 = new (Web3 as any)();

let localAccountMap;
if (process.env.ACCOUNT_MAP) {
  localAccountMap = JSON.parse(process.env.ACCOUNT_MAP);
} else {
  localAccountMap = {
    ...(useIdentity
      // accounts with identity based profiles
      ? {
        '0xcd5e1dBb5552C2bAa1943E6B5f66D22107E9C05c':
          'dfcdcb6d5d09411ae9cbe1b0fd9751ba8803dd4b276d5bf9488ae4ede2669106',
        '0x0F491D449EAAb6b40273eDBdFd01DB7EBD81B464':
          '16bd56948ba09a626551b3f39093da305b347ef4ef2182b2e667dfa5aaa0d4cd',
        '0xd2787429c2a5D88662a8c4af690A4479E0199C5E':
            '30d446cc76b19c6eacad89237d021eb2c85144b61d63cb852aee09179f460920',
      }
      // accounts without identity based profiles
      : {
        '0x001De828935e8c7e4cb56Fe610495cAe63fb2612':
          '01734663843202e2245e5796cb120510506343c67915eb4f9348ac0d8c2cf22a',
        '0x0030C5e7394585400B1FB193DdbCb45a37Ab916E':
          '7d09c0873e3f8dc0c7282bb7c2ba76bfd432bff53c38ace06193d1e4faa977e7',
      }
    ),
    '0x00D1267B27C3A80080f9E1B6Ba01DE313b53Ab58':
      'a76a2b068fb715830d042ca40b1a4dab8d088b217d11af91d15b972a7afaf202',
    '0x0ab4F29ef71E591e209b1386CaDFc5B7CCB5102A':
      '70adb5e0424148e2b490776143a6a93662d3f40c3d9597690bdd3472863b7625',
  };
}
const accountMap = localAccountMap;
const accounts = Object.keys(accountMap);

// set up identities
let letIdentities;
if (useIdentity) {
  letIdentities = [
    '0x0d87204C3957D73b68AE28d0AF961d3c72403906',
    '0xC88D707c2436FA3ce4A1e52D751469ACAe689FDB',
    '0x6240CEdFc840579B7FDcD686Bdc65A9A8c42dea6',
    '0x00D1267B27C3A80080f9E1B6Ba01DE313b53Ab58',
    '0x0ab4F29ef71E591e209b1386CaDFc5B7CCB5102A',
  ];
} else {
  letIdentities = Object.keys(accountMap);
}
const identities = letIdentities;

// set up data encryption keys
const sha3 = localWeb3.utils.soliditySha3;
const sha9 = (a, b) => sha3(...[sha3(a), sha3(b)].sort());
const dataKeys = {
  // contexts
  [sha3('context sample')]: '00000000000000000000000000000000000000000000000000000000005a3973',
  [sha3('mailboxKeyExchange')]: '346c22768f84f3050f5c94cec98349b3c5cbfa0b7315304e13647a4918ffff22',
  [sha3('wulfwulf.test')]: '00000000000000000000000000000000000000000000000000000000005a3973',

  // node keys (self targeted)
  [sha3(identities[0])]: '001de828935e8c7e4cb56fe610495cae63fb2612000000000000000000000000',
  [sha3(identities[1])]: '0030c5e7394585400b1fb193ddbcb45a37ab916e000000000000000000000011',
  [sha3(identities[2])]: '00d1267b27c3a80080f9e1b6ba01de313b53ab58000000000000000000000022',
  [sha3(identities[3])]: '483257531bc9456ea783e44d325f8a384a4b89da81dac00e589409431692f218',

  // edge keys (comm keys)
  [sha9(identities[0], identities[0])]: '001de828935e8c7e4cb56fe610495cae63fb2612000000000000000000000000',
  [sha9(identities[0], identities[1])]: '001de828935e8c7e4cb50030c5e7394585400b1f000000000000000000000001',
  [sha9(identities[0], identities[2])]: '001de828935e8c7e4cb500d1267b27c3a80080f9000000000000000000000002',
  [sha9(identities[1], identities[1])]: '0030c5e7394585400b1fb193ddbcb45a37ab916e000000000000000000000011',
  [sha9(identities[1], identities[2])]: '0030c5e7394585400b1f00d1267b27c3a80080f9000000000000000000000012',
  [sha9(identities[2], identities[2])]: '00d1267b27c3a80080f9e1b6ba01de313b53ab58000000000000000000000022',
  [sha9(identities[3], identities[3])]: '483257531bc9456ea783e44d325f8a384a4b89da81dac00e589409431692f218',
};
// current identity tests use different keys
if (useIdentity) {
  dataKeys[sha3(identities[0])] = 'a809051c9c6bfce42453364182d9768df31be44d4ead178a7621a00ebb0bdeca';
  dataKeys[sha3(identities[1])] = 'dabb3d3ddd277f4a699ff608b10135c01efa1df766db4798a4d8bf6e8ba76ac3';
  dataKeys[sha3(identities[2])] = '3d4803b18ef1c900a45f64d420d0ed03f7252eb290ed8db8ced8791710ee090f';
  dataKeys[sha9(identities[0], identities[0])] = 'a809051c9c6bfce42453364182d9768df31be44d4ead178a7621a00ebb0bdeca';
  dataKeys[sha9(identities[1], identities[1])] = 'dabb3d3ddd277f4a699ff608b10135c01efa1df766db4798a4d8bf6e8ba76ac3';
  dataKeys[sha9(identities[2], identities[2])] = '3d4803b18ef1c900a45f64d420d0ed03f7252eb290ed8db8ced8791710ee090f';
}

export {
  accounts,
  accountMap,
  identities,
  dataKeys,
  useIdentity,
};
