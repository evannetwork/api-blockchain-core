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
import * as chaiAsPromised from 'chai-as-promised';
import IpfsApi = require('ipfs-api');
import { expect, use } from 'chai';

import { Ipfs } from './ipfs'
import { InMemoryCache } from './in-memory-cache'
import { TestUtils } from '../test/test-utils'

use(chaiAsPromised);


let ipfs: Ipfs;

describe('IPFS handler', function() {
  this.timeout(300000);

  before(async () => {
    ipfs = await TestUtils.getIpfs();
  });

  it('should add the auth header for every request', async () => {
    const randomContent = Math.random().toString();
    await ipfs.add('test', Buffer.from(randomContent, 'utf-8'));
    expect(ipfs.remoteNode.provider.headers.authorization).to.be.ok;
  });

  it('should be able to add a file', async () => {
    const randomContent = Math.random().toString();
    const hash = await ipfs.add('test', Buffer.from(randomContent, 'utf-8'));
    expect(hash).not.to.be.undefined;
    const fileContent = await ipfs.get(hash);
    expect(fileContent).to.eq(randomContent);
  });

  it('should be able to pin a file', async () => {
    const randomContent = Math.random().toString();
    const fileHash = await ipfs.add('test', Buffer.from(randomContent, 'utf-8'));
    expect(fileHash).not.to.be.undefined;
    await ipfs.pinFileHash({hash: fileHash});
  });

  it('should be able to unpin a file', async () => {
    const randomContent = Math.random().toString();
    const fileHash = await ipfs.add('test', Buffer.from(randomContent, 'utf-8'));
    expect(fileHash).not.to.be.undefined;
    await ipfs.pinFileHash({hash: fileHash});
    await ipfs.remove(fileHash);
  });

  it('should throw an error when unpinning unknown hash', async () => {
    const unkownHash = 'QmZYJJTAV8JgVoMggSuQSSdGU4PrZSvuuXckvqpnHfpR75';
    const unpinUnkown = ipfs.remove(unkownHash);
    expect(unpinUnkown).to.be.rejectedWith(`could not unpin hash "${ unkownHash }" for account ` +
      `"${ ipfs.runtime.activeAccount }": hash not found`);
  });

  it('should be able to add a file with special characters', async () => {
    const content = 'öäüßÖÄÜ';
    const encoding = 'binary';
    const hash = await ipfs.add('test', Buffer.from(content, encoding));
    expect(hash).not.to.be.undefined;
    const fileContent = await ipfs.get(hash);
    expect(fileContent.toString(encoding)).to.eq(content);
  });

  it('should be able to add multiple files', async () => {
    const randomContents = [
      Math.random().toString(),
      Math.random().toString(),
      Math.random().toString(),
    ];
    const hashes = await ipfs.addMultiple(randomContents.map(content => (
      { path: content, content: Buffer.from(content, 'utf-8')}
     )));
    expect(hashes).not.to.be.undefined;
    let hashesToCheck = randomContents.length;
    for (let [index, hash] of hashes.entries()) {
      expect(randomContents).to.contain(await ipfs.get(hash));
      hashesToCheck--;
    }
    expect(hashesToCheck).to.eq(0);
  });

  it('should be able to get files', async () => {
    const randomContent = Math.random().toString();
    const hash = await ipfs.add('test', Buffer.from(randomContent, 'utf-8'));
    const fileContent = await ipfs.get(hash);
    expect(fileContent).to.eq(randomContent);
  });

  it('should cache previous added files', async () => {
    // set cache at ipfs object
    ipfs.cache = new InMemoryCache();
    const randomContent = Math.random().toString();
    const hash = await ipfs.add('test', Buffer.from(randomContent, 'utf-8'));
    const cacheResponse = await ipfs.cache.get(Ipfs.bytes32ToIpfsHash(hash));
    expect(Buffer.from(cacheResponse).toString('binary')).to.eq(randomContent);
    // remove cache after test
    delete ipfs.cache;
  });

  it('should set the cache when passed via options', async () => {
    const remoteNode = IpfsApi({host: 'ipfs.test.evan.network', port: '443', protocol: 'https'});
    const customIpfs =  new Ipfs({ remoteNode, cache: new InMemoryCache()});
    expect(customIpfs.cache).to.be.ok;
  })
});
