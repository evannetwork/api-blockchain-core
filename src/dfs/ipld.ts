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

import Graph = require('ipld-graph-builder');
import bs58 = require('bs58');
import * as https from 'https';
import _ = require('lodash');

import {
  CryptoInfo,
  Cryptor,
  Envelope,
  KeyProviderInterface,
  Logger,
  LoggerOptions,
  NameResolver,
} from '@evan.network/dbcp';

import { Ipfs } from '../dfs/ipfs';

import { CryptoProvider } from '../encryption/crypto-provider';

const IPLD_TIMEOUT = 120000;

function rebuffer(toBuffer) {
  Object.keys(toBuffer).forEach((key) => {
    if (key === '/') {
      toBuffer[key] = Buffer.from(toBuffer[key].data);
    } else if (typeof toBuffer[key] === 'object' && toBuffer[key] !== null) {
      rebuffer(toBuffer[key]);
    }
  });
}


export interface IpldOptions extends LoggerOptions {
  ipfs: Ipfs;
  keyProvider: KeyProviderInterface;
  cryptoProvider: CryptoProvider;
  originator: string;
  defaultCryptoAlgo: string;
  nameResolver: NameResolver;
}


/**
 * IPLD helper class, a single instance has to be created for each cryptor configuration.
 *
 * @class      Ipld IPFS helper class
 */
export class Ipld extends Logger {
  graph: Graph;
  ipfs: Ipfs;
  keyProvider: KeyProviderInterface;
  cryptoProvider: CryptoProvider;
  originator: string;
  defaultCryptoAlgo: string;
  nameResolver: NameResolver;
  hashLog: string[] = [];

  private readonly dagOptions = { format: 'dag-pb', };
  private readonly encodingUnencrypted = 'utf-8';
  private readonly encodingEncrypted = 'hex';

  /**
   * remove all cryptoInfos from tree
   *
   * @param      {any}     toPurge  tree to purge
   */
  public static purgeCryptoInfo(toPurge: any): void {
    Object.keys(toPurge).forEach((key) => {
      if (key === 'cryptoInfo') {
        delete toPurge.cryptoInfo;
      } else if (typeof toPurge[key] === 'object' && toPurge[key] !== null) {
        this.purgeCryptoInfo(toPurge[key]);
      }
    });
  }

  constructor(options: IpldOptions) {
    super(options);
    this.ipfs = options.ipfs;
    this.graph = new Graph({ get: null, put: null, });
    this.keyProvider = options.keyProvider;
    this.cryptoProvider = options.cryptoProvider;
    this.originator = options.originator;
    this.defaultCryptoAlgo = options.defaultCryptoAlgo;
    this.nameResolver = options.nameResolver;

    // overwrite dag.put and dag.get if cryptor was provided
    const originalDagPut = this.graph._dag.put;
    this.graph._dag.put = async (...args) => {
      const data = args[0];
      if (data.cryptoInfo || this.defaultCryptoAlgo) {
        let cryptor;
        let cryptoInfo;
        if (data.cryptoInfo) {
          cryptor = this.cryptoProvider.getCryptorByCryptoInfo(data.cryptoInfo);
          cryptoInfo = data.cryptoInfo;
          delete data.cryptoInfo;
        } else {
          cryptor = this.cryptoProvider.getCryptorByCryptoAlgo(this.defaultCryptoAlgo);
          cryptoInfo = cryptor.getCryptoInfo(this.originator);
        }
        const key = await this.keyProvider.getKey(cryptoInfo);
        const encrypted = await cryptor.encrypt(args[0], { key, })
        args[0] = encrypted.toString(this.encodingEncrypted);
        const envelope: Envelope = {
          private: encrypted,
          cryptoInfo,
        };
        args[0] = Buffer.from(JSON.stringify(envelope));
      }
      // add file to ipfs instead of dag put because js-ipfs-api don't supports dag at the moment
      return this.ipfs.add('dag', args[0])
        .then((hash) => {
          this.hashLog.push(hash);
          const bufferHash = bs58.decode(Ipfs.bytes32ToIpfsHash(hash));
          const dagHash = bs58.encode(bufferHash);
          return bufferHash;
        });
    };

    const originalDagGet = this.graph._dag.get;
    this.graph._dag.get = (...args) => {
      const timeout = new Promise((resolve, reject) => {
        let wait = setTimeout(() => {
          clearTimeout(wait);
          reject(new Error('timeout reached'));
        }, IPLD_TIMEOUT)
      })
      this.log(`Getting IPLD Hash ${bs58.encode(args[0])}`, 'debug');
      // add file to ipfs instead of dag put because js-ipfs-api don't supports dag at the moment
      const getHash = this.ipfs.get(bs58.encode(args[0]))
        .then(async (dag) => {
          if (this.defaultCryptoAlgo) {
            const envelope: Envelope = JSON.parse(dag.toString('utf-8'));
            const cryptor = this.cryptoProvider.getCryptorByCryptoInfo(envelope.cryptoInfo);
            const key = await this.keyProvider.getKey(envelope.cryptoInfo);
            if (!key) {
              return {};
            } else {

              const decryptedObject = await cryptor.decrypt(
                Buffer.from(envelope.private, this.encodingEncrypted), { key, });
              rebuffer(decryptedObject);
              if(typeof decryptedObject === 'object') {
                // keep crypto info for later re-encryption
                decryptedObject.cryptoInfo = envelope.cryptoInfo;
              }
              return  decryptedObject;
            }
          }
        })
      ;
      return Promise.race([
        getHash,
        timeout
      ])
    };
  }

  /**
   * Get a path from a tree; resolve only if required (depends on requested path)
   *
   * @param      {string | Buffer | any}  graphReference  hash/buffer to look up or a graph object
   * @param      {string}                 path            path in the tree
   * @return     {Promise<any>}           linked graph.
   */
  async getLinkedGraph(graphReference: string | Buffer | any, path = ''): Promise<any> {
    let graphObject;
    if (typeof graphReference === 'string') {
      // fetch ipfs file
      const ipfsFile = (await this.ipfs.get(graphReference)).toString(this.encodingUnencrypted);

      // decrypt content
      const envelope: Envelope = JSON.parse(ipfsFile);
      if (envelope.cryptoInfo) {
        const cryptor = this.cryptoProvider.getCryptorByCryptoInfo(envelope.cryptoInfo);
        const key = await this.keyProvider.getKey(envelope.cryptoInfo);
        const decryptedObject = await cryptor.decrypt(
          Buffer.from(envelope.private, this.encodingEncrypted), { key, });
        rebuffer(decryptedObject);
        graphObject = decryptedObject;
      } else {
        graphObject = { '/': Buffer.from(ipfsFile, this.encodingUnencrypted), };
      }
    } else if (Buffer.isBuffer(graphReference)) {
      graphObject = { '/': graphReference, };
    } else {
      graphObject = graphReference;
    }
    if (!path) {
      const tree = await this.graph.tree(graphObject, 0);
      return tree['/'] || tree;
    } else {
      const element = await this.graph.get(graphObject, path)
      if (element) {
        this.log(`Got Linked Graph Path -> ${path} Element`, 'debug');
      } else {
        this.log(`Could not get Linked Graph Path -> ${path} Element`, 'debug');
      }

      return element;
    }
  }

  /**
   * Get a path from a tree; resolve links in paths up to depth (default is 10)
   *
   * @param      {string | Buffer | any}  graphReference  hash/buffer to look up or a graph object
   * @param      {string}                 path            path in the tree
   * @param      {number}                 depth           resolve up do this many levels of depth
   *                                                      (default: 10)
   * @return     {Promise<any>}           resolved graph
   */
  async getResolvedGraph(graphReference: string | Buffer | any, path = '', depth = 10): Promise<any> {
    const treeNode = await this.getLinkedGraph(graphReference, path);
    return await this.graph.tree(treeNode, depth, true);
  }

  /**
   * store tree, if tree contains merklefied links, stores tree with multiple linked subtrees
   *
   * @param      {any}              toSet   tree to store
   * @return     {Promise<string>}  hash reference to a tree with with merklefied links
   */
  async store(toSet: any): Promise<string> {
    const cryptoInfo = {
      algorithm: 'unencrypted'
    }
    const treeToStore = _.cloneDeep(toSet);
    const [rootObject, key] = await Promise.all([
      // get final tree
      this.graph.flush(treeToStore, Object.assign({}, this.dagOptions, { cryptoInfo, })),
      // encrypt dag and put in envelope
      this.keyProvider.getKey(cryptoInfo),
    ]);
    const envelope: Envelope = {
      private: Buffer.from(JSON.stringify(rootObject), this.encodingUnencrypted).toString(this.encodingEncrypted),
      cryptoInfo,
    };

    // store to ipfs
    const fileHash = await this.ipfs.add('dag', Buffer.from(JSON.stringify(envelope)));
    this.hashLog.push(fileHash);
    return fileHash;
  }

  /**
   * set a value to a tree node; inserts new element as a linked subtree by default
   *
   * @param      {any}           tree         tree to extend
   * @param      {string}        path         path of inserted element
   * @param      {any}           subtree      element that will be added
   * @param      {boolean}       plainObject  do not link value as new subtree
   * @param      {CryptoInfo}    cryptoInfo   crypto info for encrypting subtree
   * @return     {Promise<any>}  tree with merklefied links
   */
  async set(tree: any, path: string, subtree: any, plainObject = false, cryptoInfo?: CryptoInfo): Promise<any> {
    if (cryptoInfo && typeof subtree === 'object') {
      subtree.cryptoInfo = cryptoInfo;
    }
    const graphTree =  await this.graph.set(tree, path, subtree, plainObject);
    return graphTree;
  }

  /**
   * delete a value from a tree node
   *
   * @param      {any}           tree    tree to extend
   * @param      {string}        path    path of inserted element
   * @return     {Promise<any>}  tree with merklefied links
   */
  async remove(tree: any, path: string): Promise<any> {
    const splitPath = path.split('/');
    const node = splitPath[splitPath.length - 1];
    const toTraverse = splitPath.slice(0, -1);
    let currentNode;
    let currentTree
    let linkedParent = tree;

    // find next linked node
    while (currentNode = toTraverse.pop()) {
      currentTree = await this.getLinkedGraph(tree, toTraverse.join('/'));
      if (currentTree[currentNode]['/']) {
        if (toTraverse.length) {
          linkedParent = await this.getLinkedGraph(tree, `${toTraverse.join('/')}/${currentNode}`);
        } else {
          linkedParent = await this.getLinkedGraph(tree, currentNode);
        }
        break;
      }
    }

    // find and delete in linked node
    let pathInParent;
    let splitPathInParent;
    if (toTraverse.length) {
      pathInParent = path.replace(`${toTraverse.join('/')}/`, '');
      splitPathInParent = pathInParent.split('/').slice(1, -1);  // skip parent prop, skip last
    } else {
      pathInParent = path;
      if (linkedParent === tree) {
        // entire graph is plain object, current linkedParent is entire tree
        splitPathInParent = path.split('/').slice(0, -1);  // skip last
      } else {
        // linkedParent points to found node, node name is still in path
        splitPathInParent = path.split('/').slice(1, -1);  // skip parent prop, skip last
      }
    }
    let nodeInParentPath = linkedParent;
    let nodeNameInParentPath;
    while (nodeNameInParentPath = splitPathInParent.pop()) {
      nodeInParentPath = nodeInParentPath[nodeNameInParentPath];
    }
    delete nodeInParentPath[node];

    if (toTraverse.length) {
      // set updated linked node in entire graph
      return await this.graph.set(tree, `${toTraverse.join('/')}/${currentNode}`, linkedParent);
    } else {
      // flush graph, return linked graph object
      const cryptor = this.cryptoProvider.getCryptorByCryptoAlgo(this.defaultCryptoAlgo);
      const cryptoInfo = cryptor.getCryptoInfo(this.originator);
      const flushed = await this.graph.flush(tree, this.dagOptions, this.dagOptions, { cryptoInfo, });
      return this.getLinkedGraph(flushed);
    }
  }
}
