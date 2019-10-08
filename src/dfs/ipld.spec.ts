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
import { expect } from 'chai';
import bs58 = require('bs58');
import Web3 = require('web3');

import {
  Envelope,
  KeyProvider,
} from '@evan.network/dbcp';

import { accounts } from '../test/accounts';
import { Aes } from '../encryption/aes';
import { configTestcore as config } from '../config-testcore';
import { CryptoProvider } from '../encryption/crypto-provider';
import { Ipld } from './ipld'
import { TestUtils } from '../test/test-utils'

const sampleKey = '346c22768f84f3050f5c94cec98349b3c5cbfa0b7315304e13647a49181fd1ef';
let keyProvider;

describe('IPLD handler', function() {
  this.timeout(300000);
  let node;
  let ipld: Ipld;
  let ipfs;
  let cryptoProvider: CryptoProvider;
  let helperWeb3 = TestUtils.getWeb3();

  before(async () => {
    // create new ipld handler on ipfs node
    ipfs = await TestUtils.getIpfs();
    cryptoProvider = TestUtils.getCryptoProvider();
  });

  beforeEach(async () => {
    // create new ipld handler on ipfs node
    ipld = await TestUtils.getIpld(ipfs);
  });

  after(async () => {
    // create new ipld handler on ipfs node
    await ipfs.stop();
  });

  describe('when creating a graph', () => {
    it('should return an IPFS file hash with 32 bytes length when storing', async() => {
      const sampleObject = {
        personalInfo: {
          firstName: 'eris',
        },
      };

      const stored = await ipld.store(Object.assign({}, sampleObject));
      expect(stored).to.match(/0x[0-9a-f]{64}/);
    });

    it('should be able to create a simple graph, retrieve and check the entire graph', async () => {
      const sampleObject = {
        personalInfo: {
          firstName: 'eris',
        },
      };

      const stored = await ipld.store(Object.assign({}, sampleObject));
      const loaded = await ipld.getLinkedGraph(stored, '');
      expect(loaded).not.to.be.undefined;
      Ipld.purgeCryptoInfo(loaded);
      expect(JSON.stringify(loaded)).to.eq(JSON.stringify(sampleObject));
    });

    it('should be able to handle special characters', async () => {
      const sampleObject = {
        personalInfo: {
          firstName: 'Snörre',
        },
      };

      const stored = await ipld.store(Object.assign({}, sampleObject));
      const loaded = await ipld.getLinkedGraph(stored, '');
      expect(loaded).not.to.be.undefined;
      Ipld.purgeCryptoInfo(loaded);
      expect(JSON.stringify(loaded)).to.eq(JSON.stringify(sampleObject));
    });
  });

  describe('when attaching nodes', () => {
    it('should be able to attach a subtree to a simple tree', async () => {
      const sampleObject = {
        personalInfo: {
          firstName: 'eris',
        },
      };
      const sub = {
        contracts: ['0x01', '0x02', '0x03']
      };

      const extended = await ipld.set(sampleObject, 'dapps', sub);
      const extendedstored = await ipld.store(Object.assign({}, extended));
      const loaded = await ipld.getLinkedGraph(extendedstored, '');

      // unlinked (root data)
      expect(loaded).not.to.be.undefined;
      expect(loaded).to.haveOwnProperty('personalInfo');
      expect(loaded.personalInfo).to.haveOwnProperty('firstName');
      expect(loaded.personalInfo.firstName).to.eq('eris');
      // unlinked (root data) structure
      expect(loaded.dapps).not.to.be.undefined;
      expect(loaded.dapps).to.haveOwnProperty('/');
      expect(Buffer.isBuffer(loaded.dapps['/'])).to.be.true;
      // linked (root data) access
      const subLoaded = await ipld.getLinkedGraph(extendedstored, 'dapps');
      expect(subLoaded).not.to.be.undefined;
      expect(Array.isArray(subLoaded.contracts)).to.be.true;
      expect(subLoaded.contracts.length).to.eq(sub.contracts.length);
    });

    it('should be able to attach a subtree to a nested tree', async () => {
      const sampleObject = {
        personalInfo: {
          firstName: 'eris',
        },
      };
      const sub = {
        contracts: ['0x01', '0x02', '0x03']
      };
      const subSub = {
        contracts: '0x02',
      };
      const stored = await ipld.store(Object.assign({}, sampleObject));
      const loadedStored = await ipld.getLinkedGraph(stored, '');

      // add lv1
      const plusSub = await ipld.set(sampleObject, 'dapps', sub);
      const plusSubstored = await ipld.store(Object.assign({}, plusSub));
      const loadedSub = await ipld.getLinkedGraph(plusSubstored, '');

      // add lv2
      const plusSubSub = await ipld.set(loadedSub, 'dapps/favorites', subSub);
      const plusSubSubstored = await ipld.store(Object.assign({}, plusSubSub));
      const loadedFull = await ipld.getLinkedGraph(plusSubSubstored, '');

      // unlinked (root data)
      expect(loadedFull).not.to.be.undefined;
      expect(loadedFull).to.haveOwnProperty('personalInfo');
      expect(loadedFull.personalInfo).to.haveOwnProperty('firstName');
      expect(loadedFull.personalInfo.firstName).to.eq('eris');
      // unlinked (root data) acces
      const subLoaded = await ipld.getLinkedGraph(plusSubSubstored, 'dapps');
      expect(subLoaded).not.to.be.undefined;
      expect(Array.isArray(subLoaded.contracts)).to.be.true;
      expect(subLoaded.contracts.length).to.eq(sub.contracts.length);
      // unlinked (root data) access
      const subSubLoaded = await ipld.getLinkedGraph(plusSubSubstored, 'dapps/favorites');
      expect(subSubLoaded).not.to.be.undefined;
      expect(subSubLoaded).to.haveOwnProperty('contracts');
      expect(subSubLoaded.contracts).to.eq('0x02');
    });

    it('should be able to attach a subtree with a different encryption than the main branch', async () => {
      const sampleObject = {
        personalInfo: {
          firstName: 'eris',
        },
      };
      const sub = {
        contracts: ['0x01', '0x02', '0x03']
      };

      const cryptor = cryptoProvider.getCryptorByCryptoAlgo('aes');
      const cryptoInfo = cryptor.getCryptoInfo(helperWeb3.utils.soliditySha3('context sample'));
      const extended = await ipld.set(sampleObject, 'dapps', sub, false, cryptoInfo);
      const extendedstored = await ipld.store(Object.assign({}, extended));
      const loaded = await ipld.getLinkedGraph(extendedstored, '');

      // unlinked (root data)
      expect(loaded).not.to.be.undefined;
      expect(loaded).to.haveOwnProperty('personalInfo');
      expect(loaded.personalInfo).to.haveOwnProperty('firstName');
      expect(loaded.personalInfo.firstName).to.eq('eris');
      // unlinked (root data) structure
      expect(loaded.dapps).not.to.be.undefined;
      expect(loaded.dapps).to.haveOwnProperty('/');
      expect(Buffer.isBuffer(loaded.dapps['/'])).to.be.true;
      // linked (root data) access
      const subLoaded = await ipld.getLinkedGraph(extendedstored, 'dapps');
      expect(subLoaded).not.to.be.undefined;
      expect(Array.isArray(subLoaded.contracts)).to.be.true;
      expect(subLoaded.contracts.length).to.eq(sub.contracts.length);
    });
  });

  describe('when loading a graph', () => {
    it('should be able to load a linked graph for a nested tree', async () => {
      const sampleObject = {
        personalInfo: {
          firstName: 'eris',
        },
      };
      const sub = {
        contracts: ['0x01', '0x02', '0x03']
      };
      const subSub = {
        contracts: '0x02',
      };
      const stored = await ipld.store(Object.assign({}, sampleObject));
      const loadedStored = await ipld.getLinkedGraph(stored, '');

      // add lv1
      const plusSub = await ipld.set(sampleObject, 'dapps', sub);
      const plusSubstored = await ipld.store(Object.assign({}, plusSub));
      const loadedSub = await ipld.getLinkedGraph(plusSubstored, '');

      // add lv2
      const plusSubSub = await ipld.set(loadedSub, 'dapps/favorites', subSub);
      const plusSubSubstored = await ipld.store(Object.assign({}, plusSubSub));
      const loadedFull = await ipld.getLinkedGraph(plusSubSubstored, '');

      // lv1 is linked
      expect(loadedFull).to.haveOwnProperty('dapps');
      expect(loadedFull.dapps).to.haveOwnProperty('/');
      expect(Buffer.isBuffer(loadedFull.dapps['/'])).to.be.true;

      // lv2 is linked
      const loadedLv1 = await ipld.getLinkedGraph(plusSubSubstored, 'dapps');
      expect(loadedLv1).to.haveOwnProperty('favorites');
      expect(loadedLv1.favorites).to.haveOwnProperty('/');
      expect(Buffer.isBuffer(loadedLv1.favorites['/'])).to.be.true;
      // though lv2s own property is plain
      expect(loadedLv1).to.haveOwnProperty('contracts');
      expect(Array.isArray(loadedLv1.contracts)).to.be.true;
      expect(loadedLv1.contracts.length).to.eq(sub.contracts.length);
    });

    it('should be able to load a plain graph for a nested tree', async () => {
      const sampleObject = {
        personalInfo: {
          firstName: 'eris',
        },
      };
      const sub = {
        contracts: ['0x01', '0x02', '0x03']
      };
      const subSub = {
        contracts: '0x02',
      };
      const stored = await ipld.store(Object.assign({}, sampleObject));
      const loadedStored = await ipld.getLinkedGraph(stored, '');

      // add lv1
      const plusSub = await ipld.set(sampleObject, 'dapps', sub);
      const plusSubstored = await ipld.store(Object.assign({}, plusSub));
      const loadedSub = await ipld.getLinkedGraph(plusSubstored, '');

      // add lv2
      const plusSubSub = await ipld.set(loadedSub, 'dapps/favorites', subSub);
      const plusSubSubstored = await ipld.store(Object.assign({}, plusSubSub));
      const loadedFull = await ipld.getResolvedGraph(plusSubSubstored, '');

      const resolved = await ipld.getResolvedGraph(plusSubSubstored, '');

      // lv1 is not linked
      expect(loadedFull).to.haveOwnProperty('dapps');
      expect(loadedFull.dapps).to.haveOwnProperty('/');
      expect(Buffer.isBuffer(loadedFull.dapps['/'])).not.to.be.true;
      expect(loadedFull.dapps['/']).to.haveOwnProperty('contracts');
      expect(loadedFull.dapps['/']).to.haveOwnProperty('favorites');

      // lv2 is not linked
      const loadedLv1 = await ipld.getResolvedGraph(plusSubSubstored, 'dapps');
      expect(loadedLv1).to.haveOwnProperty('favorites');
      expect(loadedLv1.favorites).to.haveOwnProperty('/');
      expect(Buffer.isBuffer(loadedLv1.favorites['/'])).not.to.be.true;
      expect(loadedLv1.favorites['/']).to.haveOwnProperty('contracts');
    });

    it('can work on graph instances the same way as on hashes/Buffers', async () => {
      const sampleObject = {
        personalInfo: {
          firstName: 'eris',
          titles: ['eris']
        },
      };
      const sub = {
        contracts: ['0x01', '0x02', '0x03']
      };
      const stored = await ipld.store(Object.assign({}, sampleObject));
      const graph = await ipld.getLinkedGraph(stored);
      await ipld.set(graph, 'dapps', sub);

      // queries on linked graph
      expect(await ipld.getLinkedGraph(graph, 'personalInfo/firstName')).to.eq('eris');
      expect(await ipld.getLinkedGraph(graph, 'personalInfo/titles')).to.deep.eq(['eris']);
      expect(await ipld.getLinkedGraph(graph, 'dapps/contracts')).to.deep.eq(['0x01', '0x02', '0x03']);

      // expand full graph
      const expected = {
        personalInfo: {
          firstName: 'eris',
          titles: ['eris']
        },
        dapps: {
          '/': {
            contracts: ['0x01', '0x02', '0x03'],
          },
        },
      };
      const resolved = await ipld.getResolvedGraph(graph, '');
      Ipld.purgeCryptoInfo(resolved);
      expect(resolved).to.deep.eq(expected);
    });
  });

  describe('when updating values', () => {
    it('should be able to update values in a nested tree', async () => {
      const sampleObject = {
        personalInfo: {
          firstName: 'eris',
          titles: ['eris']
        },
      };
      const sub = {
        contracts: ['0x01', '0x02', '0x03']
      };

      const stored = await ipld.store(Object.assign({}, sampleObject));
      const extended = await ipld.set(sampleObject, 'dapps', sub);
      const extendedstored = await ipld.store(Object.assign({}, extended));
      const loaded = await ipld.getLinkedGraph(extendedstored, '');


      const subModified = Object.assign({}, sub);
      subModified.contracts.push('0x04');
      const updated = await ipld.set(loaded, 'dapps', subModified);
      const updatedstored = await ipld.store(Object.assign({}, updated));
      const updatedloaded = await ipld.getLinkedGraph(updatedstored, '');

      const updatedStored = await ipld.store(Object.assign({}, updated));
      const loadedUpdated = await ipld.getResolvedGraph(updatedStored, '');

      // linked (root data) access
      expect(loadedUpdated).not.to.be.undefined;
      expect(Array.isArray(loadedUpdated.dapps['/'].contracts)).to.be.true;
      expect(loadedUpdated.dapps['/'].contracts.length).to.eq(subModified.contracts.length);
    });

    it('should be able to update different ipld graphs with different keys at the same time',
    async () => {
      let lastKey;
      async function updateGraph() {
        // shadow ipld with a new one with another key
        const defaultCryptoAlgo = 'aes';
        const localIpld = await TestUtils.getIpld(ipfs);
        const sampleObject = {
          personalInfo: {
            firstName: 'eris',
            titles: ['eris']
          },
        };
        const sub = {
          contracts: ['0x01', '0x02', '0x03']
        };

        const stored = await localIpld.store(Object.assign({}, sampleObject));
        const extended = await localIpld.set(sampleObject, 'dapps', sub);
        const extendedstored = await localIpld.store(Object.assign({}, extended));
        const loaded = await localIpld.getLinkedGraph(extendedstored, '');


        const subModified = Object.assign({}, sub);
        subModified.contracts.push('0x04');
        const updated = await localIpld.set(loaded, 'dapps', subModified);
        const updatedstored = await localIpld.store(Object.assign({}, updated));
        const updatedloaded = await localIpld.getLinkedGraph(updatedstored, '');

        const updatedStored = await localIpld.store(Object.assign({}, updated));
        const loadedUpdated = await localIpld.getResolvedGraph(updatedStored, '');

        // linked (root data) access
        expect(loadedUpdated).not.to.be.undefined;
        expect(Array.isArray(loadedUpdated.dapps['/'].contracts)).to.be.true;
        expect(loadedUpdated.dapps['/'].contracts.length).to.eq(subModified.contracts.length);
      }

      await Promise.all([...new Array(10)].map(() => updateGraph()));
    });
  });

  describe('when deleting nodes', () => {
    const createSampleGraph = async () => {
      const initialTree = {
        gods: {},
        humans: {
          helena: {
            origin: 'troja',
          },
        },
      };
      const eris = {
        name: 'eris',
        latinName: 'discordia',
      };
      const erisDetails = {
        occupation: 'goddess of chaos',
        origin: 'greek',
      };
      const expectedTree = {
        gods: {
          eris: {
            '/': {
              name: 'eris',
              latinName: 'discordia',
              details: {
                '/': {
                  occupation: 'goddess of chaos',
                  origin: 'greek',
                },
              },
            },
          },
        },
        humans: {
          helena: {
            origin: 'troja',
          },
        },
      };
      let stored;
      let loaded;
      let updated;

      // store initial
      stored = await ipld.store(Object.assign({}, initialTree));
      loaded = await ipld.getLinkedGraph(stored, '');

      // add subtree
      updated = await ipld.set(loaded, 'gods/eris', eris);
      stored = await ipld.store(Object.assign({}, updated));
      loaded = await ipld.getLinkedGraph(stored, '');
      updated = await ipld.set(loaded, 'gods/eris/details', erisDetails);
      stored = await ipld.store(Object.assign({}, updated));
      loaded = await ipld.getLinkedGraph(stored, '');

      // check loaded
      loaded = await ipld.getResolvedGraph(stored, '');
      Ipld.purgeCryptoInfo(loaded);
      expect(loaded).to.deep.eq(expectedTree);
      return loaded;
    };

    it('can create the sample graph', async () => {
      await createSampleGraph();
    });

    it('can delete plain object properties in a simple tree', async () => {
      const expectedGraph = {
        gods: {
          eris: {
            '/': {
              name: 'eris',
              latinName: 'discordia',
              details: {
                '/': {
                  occupation: 'goddess of chaos',
                  origin: 'greek',
                },
              },
            },
          },
        },
        humans: {},
      };

      const sampleGraph = await createSampleGraph();
      const updated = await ipld.remove(sampleGraph, 'humans/helena');
      const loaded = await ipld.getResolvedGraph(updated, '');
      expect(loaded).not.to.be.undefined;
      Ipld.purgeCryptoInfo(loaded);
      expect(loaded).to.deep.eq(expectedGraph);
    });

    it('can delete linked subtrees', async () => {
      const expectedGraph1 = {
        gods: {},
        humans: {
          helena: {
            origin: 'troja',
          },
        },
      };
      const expectedGraph2 = {
        gods: {
          eris: {
            '/': {
              name: 'eris',
              latinName: 'discordia',
            },
          },
        },
        humans: {
          helena: {
            origin: 'troja',
          },
        },
      };
      let loaded;
      let updated;
      let sampleGraph;
      let stored;

      // delete topmost link
      sampleGraph = await createSampleGraph();
      updated = await ipld.remove(sampleGraph, 'gods/eris');
      stored = await ipld.store(Object.assign({}, updated));
      loaded = await ipld.getResolvedGraph(stored, '');
      expect(loaded).not.to.be.undefined;
      Ipld.purgeCryptoInfo(loaded);
      expect(loaded).to.deep.eq(expectedGraph1);

      // delete topmost link
      sampleGraph = await createSampleGraph();
      updated = await ipld.remove(sampleGraph, 'gods/eris/details');
      stored = await ipld.store(Object.assign({}, updated));
      loaded = await ipld.getResolvedGraph(stored, '');
      expect(loaded).not.to.be.undefined;
      Ipld.purgeCryptoInfo(loaded);
      expect(loaded).to.deep.eq(expectedGraph2);
    });

    it('can delete properties inside of a linked subtree', async () => {
      const deletion = 'gods/eris/details/origin';
      const expectedGraph = {
        gods: {
          eris: {
            '/': {
              name: 'eris',
              latinName: 'discordia',
              details: {
                '/': {
                  occupation: 'goddess of chaos',
                },
              },
            },
          },
        },
        humans: {
          helena: {
            origin: 'troja',
          },
        },
      };
      let stored;
      let loaded;
      let updated;

      const sampleGraph = await createSampleGraph();
      updated = await ipld.remove(sampleGraph, deletion);
      stored = await ipld.store(Object.assign({}, updated));
      loaded = await ipld.getResolvedGraph(stored, '');
      expect(loaded).not.to.be.undefined;
      Ipld.purgeCryptoInfo(loaded);
      expect(loaded).to.deep.eq(expectedGraph);
    });

    it('can delete different properties inside subtrees', async () => {
      const deletion = 'gods/eris/details/origin';
      const expectedGraph = {
        gods: {
          eris: {
            '/': {
              name: 'eris',
              latinName: 'discordia',
              details: {
                '/': {
                  occupation: 'goddess of chaos',
                },
              },
            },
          },
        },
        humans: {
          helena: {
            origin: 'troja',
          },
        },
        titans: {
          '/': {},
        },
      };
      let stored;
      let loaded;
      let updated;

      const sampleGraph = await createSampleGraph();
      updated = await ipld.remove(sampleGraph, deletion);
      stored = await ipld.store(Object.assign({}, updated));
      loaded = await ipld.getResolvedGraph(stored, '');

      // add lv2
      let plusSub = await ipld.set(sampleGraph, 'titans', {});
      plusSub = await ipld.set(sampleGraph, 'titans/prometeus', { origin: 'none' });
      const loadedSub = await ipld.getLinkedGraph(plusSub, '');
      updated = await ipld.remove(loadedSub, 'titans/prometeus');

      stored = await ipld.store(Object.assign({}, updated));
      loaded = await ipld.getResolvedGraph(stored, '');
      Ipld.purgeCryptoInfo(loaded);
      expect(loaded).to.deep.eq(expectedGraph);
    });

    it('can delete different properties inside subtrees', async () => {
      const deletion = 'gods/eris/details/origin';
      const expectedGraph = {
        gods: {
          eris: {
            '/': {
              name: 'eris',
              latinName: 'discordia',
              details: {
                '/': {
                  occupation: 'goddess of chaos',
                },
              },
            },
          },
        },
        humans: {
          helena: {
            origin: 'troja',
          },
        },
        titans: {
          '/': {
            prometeus: {
              '/': {},
            },
          },
        },
      };
      let stored;
      let loaded;
      let updated;

      const sampleGraph = await createSampleGraph();
      updated = await ipld.remove(sampleGraph, deletion);
      stored = await ipld.store(Object.assign({}, updated));
      loaded = await ipld.getResolvedGraph(stored, '');

      // add lv3
      let plusSub = await ipld.set(sampleGraph, 'titans', {});
      plusSub = await ipld.set(sampleGraph, 'titans/prometeus', { });
      plusSub = await ipld.set(sampleGraph, 'titans/prometeus/punishment', { animal: 'raven' });
      const loadedSub = await ipld.getLinkedGraph(plusSub, '');
      updated = await ipld.remove(loadedSub, 'titans/prometeus/punishment');

      stored = await ipld.store(Object.assign({}, updated));
      loaded = await ipld.getResolvedGraph(stored, '');
      Ipld.purgeCryptoInfo(loaded);
      expect(loaded).to.deep.eq(expectedGraph);
    });

    it('can delete different properties inside subtrees', async () => {
      const deletion = 'gods/eris/details/origin';
      const expectedGraph = {
        gods: {
          eris: {
            '/': {
              name: 'eris',
              latinName: 'discordia',
              details: {
                '/': {
                  occupation: 'goddess of chaos',
                },
              },
            },
          },
        },
        humans: {
          helena: {
            origin: 'troja',
          },
        },
        titans: {
          prometeus: {
            '/': {},
          },
        },
      };
      let stored;
      let loaded;
      let updated;

      const sampleGraph = await createSampleGraph();
      updated = await ipld.remove(sampleGraph, deletion);
      stored = await ipld.store(Object.assign({}, updated));
      loaded = await ipld.getResolvedGraph(stored, '');

      // add lv3
      let plusSub = await ipld.set(sampleGraph, 'titans/prometeus', { punishment: { animal: 'raven' } });
      const loadedSub = await ipld.getLinkedGraph(plusSub, '');
      updated = await ipld.remove(loadedSub, 'titans/prometeus/punishment');

      stored = await ipld.store(Object.assign({}, updated));
      loaded = await ipld.getResolvedGraph(stored, '');
      Ipld.purgeCryptoInfo(loaded);
      expect(loaded).to.deep.eq(expectedGraph);
    });

    it('can delete different properties inside subtrees', async () => {
      const deletion = 'gods/eris/details/origin';
      const expectedGraph = {
        gods: {
          eris: {
            '/': {
              name: 'eris',
              latinName: 'discordia',
            },
          },
        },
        humans: {
          helena: {
            origin: 'troja',
          },
        },
        titans: {
          prometeus: {
            '/': {
              'punishment': {
                animal: 'raven',
              },
            },
          },
        },
      };
      let stored;
      let loaded;
      let updated;

      const sampleGraph = await createSampleGraph();
      updated = await ipld.remove(sampleGraph, deletion);
      stored = await ipld.store(Object.assign({}, updated));
      loaded = await ipld.getResolvedGraph(stored, '');

      // add lv3
      let plusSub = await ipld.set(sampleGraph, 'titans/prometeus', { punishment: { animal: 'raven' } });
      const loadedSub = await ipld.getLinkedGraph(plusSub, '');
      updated = await ipld.remove(loadedSub, 'gods/eris/details');

      stored = await ipld.store(Object.assign({}, updated));
      loaded = await ipld.getResolvedGraph(stored, '');
      Ipld.purgeCryptoInfo(loaded);
      expect(loaded).to.deep.eq(expectedGraph);
    });
  });
});
