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
let useIdentity = true;
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
        '0x01ca0B000c5830F4472dF87cc9D1c3810Bfd0c50':
          'e75166cfa55946774428d8a7549acadce5ca33d49de8b6015c0bcb0a3328490b',
        '0x5E5b3C43169bE75Ab6F79621009cD6a045B8788c':
          '9119021b0629218551ac85e652143374cb41f95fda97cf62e827c2519334caea',
        '0xE19308Fa5F8d02C74aD01C876Ba457448A255d1F':
            '6b4100af9a28837dfa86802391bc979ef997c3418f59d2dddf3d8a4828fe2b82',
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
console.log(localAccountMap);
const accountMap = localAccountMap;
const accounts = Object.keys(accountMap);

// set up identities
const letIdentities = [];
if (useIdentity) {
  letIdentities.push([
    '0xB5eC0687E24d05Ae0541FfC6699d0a820b98cca6',
    '0xA033E060C2362E877212ac1534BAdEB0c384136B',
    '0x775e5A47Ac9ECDc5696F12d2fcEb55306b3e7728',
    '0x00D1267B27C3A80080f9E1B6Ba01DE313b53Ab58',
    '0x0ab4F29ef71E591e209b1386CaDFc5B7CCB5102A',
  ]);
} else {
  letIdentities.push(Object.keys(accountMap));
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
  dataKeys[sha3(identities[0])] = 'd387345c149bdad709bdb928b89e7037b94f2637b7cbc227fbbcdfa723a6c7ee';
  dataKeys[sha3(identities[1])] = '8e198c1e308cafabaa88926949f9d5aedf793879bb2ea37f427bdb9c29d9ec44';
  dataKeys[sha3(identities[2])] = '1d5faa13c1bbaafb4a27882b2f101f2e6e703fb4b37ff989c03a27df9aada677';
  dataKeys[sha9(identities[0], identities[0])] = 'd387345c149bdad709bdb928b89e7037b94f2637b7cbc227fbbcdfa723a6c7ee';
  dataKeys[sha9(identities[1], identities[1])] = '8e198c1e308cafabaa88926949f9d5aedf793879bb2ea37f427bdb9c29d9ec44';
  dataKeys[sha9(identities[2], identities[2])] = '1d5faa13c1bbaafb4a27882b2f101f2e6e703fb4b37ff989c03a27df9aada677';
}

export {
  accounts,
  accountMap,
  identities,
  dataKeys,
  useIdentity,
};
