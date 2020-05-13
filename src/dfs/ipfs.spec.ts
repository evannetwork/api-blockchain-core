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
import { expect, use } from 'chai';

import { IpfsLib } from './ipfs-lib';
import { Ipfs } from './ipfs';
import { InMemoryCache } from './in-memory-cache';
import { TestUtils } from '../test/test-utils';
import { nullBytes32 } from '../common/utils';
import { useIdentity, accounts } from '../test/accounts';

use(chaiAsPromised);


let ipfs: Ipfs;

describe('IPFS handler', function test() {
  this.timeout(300000);

  before(async () => {
    ipfs = (await TestUtils.getRuntime(accounts[0], null, { useIdentity })).dfs as Ipfs;
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
    await ipfs.pinFileHash({ hash: fileHash });
  });

  it('should be able to unpin a file', async () => {
    const randomContent = Math.random().toString();
    const fileHash = await ipfs.add('test', Buffer.from(randomContent, 'utf-8'));
    expect(fileHash).not.to.be.undefined;
    await ipfs.pinFileHash({ hash: fileHash });
    await ipfs.remove(fileHash);
  });

  it('should throw an error when unpinning unknown hash', async () => {
    const unkownHash = 'QmZYJJTAV8JgVoMggSuQSSdGU4PrZSvuuXckvqpnHfpR75';
    const unpinUnkown = ipfs.remove(unkownHash);
    await expect(unpinUnkown).to.be.rejectedWith('problem with IPFS request: tried to remove hash '
      + `"${unkownHash}" for account "${ipfs.runtime.underlyingAccount}", but no matching `
      + 'entries found in redis');
  });

  it('should be able to add multiple files', async () => {
    const randomContents = [
      Math.random().toString(),
      Math.random().toString(),
      Math.random().toString(),
    ];
    const hashes = await ipfs.addMultiple(randomContents.map((content) => (
      { path: content, content: Buffer.from(content, 'utf-8') }
    )));
    expect(hashes).not.to.be.undefined;
    let hashesToCheck = randomContents.length;
    for (const [, hash] of hashes.entries()) {
      expect(randomContents).to.contain(await ipfs.get(hash));
      hashesToCheck -= 1;
    }
    expect(hashesToCheck).to.eq(0);
  });

  it('should be able to get files', async () => {
    const randomContent = Math.random().toString();
    const randomBufferContent = Buffer.from(randomContent);
    const hash = await ipfs.add('test', Buffer.from(randomContent, 'utf-8'));
    const fileContent = await ipfs.get(hash);
    const fileBufferContent = await ipfs.get(hash, true) as Buffer;
    expect(fileContent).to.eq(randomContent);
    expect(fileBufferContent.equals(randomBufferContent)).to.be.true;
  });

  it('should cache previous added files', async () => {
    // set cache at ipfs object
    ipfs.cache = new InMemoryCache();
    const randomContent = Math.random().toString();
    const hash = await ipfs.add('test', Buffer.from(randomContent, 'utf-8'));
    const cacheResponse = await ipfs.cache.get(Ipfs.bytes32ToIpfsHash(hash));
    expect(Buffer.from(cacheResponse).toString('utf8')).to.eq(randomContent);
    // remove cache after test
    delete ipfs.cache;
  });

  it('should not be able to add a file when misconfigured', async () => {
    const localIpfs = await TestUtils.getIpfs();
    localIpfs.remoteNode = new IpfsLib(
      { host: 'ipfs.test.evan.network', port: '600', protocol: 'https' },
    );
    const randomContent = Math.random().toString();
    const requestPromise = (async () => {
      const request = localIpfs.add('test', Buffer.from(randomContent, 'utf-8'));
      await expect(request).to.be.rejectedWith(
        /^could not add file to ipfs: problem with request/,
      );
    })();
    const timeoutPromise = new Promise((s) => { setTimeout(s, 5_000); });
    // requeset will either receive a network error or timeout (after 120s)
    await Promise.race([requestPromise, timeoutPromise]);
  });

  it('should be able to add a file when ipfs port reconfigured to same port', async () => {
    const localIpfs = await TestUtils.getIpfs();
    localIpfs.remoteNode = new IpfsLib(
      { host: 'ipfs.test.evan.network', port: '443', protocol: 'https' },
    );
    const randomContent = Math.random().toString();
    const hash = await localIpfs.add('test', Buffer.from(randomContent, 'utf-8'));
    expect(hash).not.to.be.undefined;
    const fileContent = await localIpfs.get(hash);
    expect(fileContent).to.eq(randomContent);
  });

  describe('when dealing with special characters', () => {
    it('should be able to add a file with umlauts, that have been encoded as binary', async () => {
      const content = 'öäüßÖÄÜ';
      const encoding = 'binary';
      const hash = await ipfs.add('test', Buffer.from(content, encoding));
      expect(hash).not.to.be.undefined;
      const fileContent = await ipfs.get(hash);
      expect(fileContent.toString(encoding)).to.eq(content);
    });

    it('should be able to add a file with umlauts, that have been encoded as utf8', async () => {
      const content = 'öäüßÖÄÜ';
      const encoding = 'utf8';
      const hash = await ipfs.add('test', Buffer.from(content, encoding));
      expect(hash).not.to.be.undefined;
      const fileContent = await ipfs.get(hash);
      expect(fileContent.toString(encoding)).to.eq(content);
    });

    it('should not be able to add a file with extended unicodes (properly), that have been encoded as binary', async () => {
      const content = '🌂';
      const encoding = 'binary';
      const broken = Buffer.from('🌂', encoding).toString(encoding);
      expect(broken).to.not.eq(content); // Buffer.from binary breaks characters
      const hash = await ipfs.add('test', Buffer.from(content, encoding));
      expect(hash).not.to.be.undefined;
      const fileContent = await ipfs.get(hash);
      expect(fileContent.toString(encoding)).to.eq(broken);
    });

    it('should be able to add a file with extended unicodes, that have been encoded as utf8', async () => {
      const content = '🌂';
      const encoding = 'utf8';
      const hash = await ipfs.add('test', Buffer.from(content, encoding));
      expect(hash).not.to.be.undefined;
      const fileContent = await ipfs.get(hash);
      expect(fileContent.toString(encoding)).to.eq(content);
    });
  });

  describe.only('when using automatic hash removal', () => {
    let lastRemovedHash;
    let oldRemove;
    let removalCount = 0;

    before(async () => {
      oldRemove = ipfs.remove;
      ipfs.remove = async (hash) => { lastRemovedHash = hash; removalCount += 1; };
    });

    after(async () => {
      ipfs.remove = oldRemove;
    });

    describe('when setting the new hash successfully', () => {
      it('should remove old hashes, when successfully setting a new hash', async () => {
        const oldRemovalCount = removalCount;
        const oldHash = `old ${Math.random()}`;
        const newHash = `new ${Math.random()}`;
        await ipfs.handleHashUpdate('running tests', newHash, async () => oldHash, async () => {});
        expect(removalCount).to.eq(oldRemovalCount + 1);
        expect(lastRemovedHash).to.eq(oldHash);
      });

      it('should not old remove any hash, when setting the same hash', async () => {
        const oldRemovalCount = removalCount;
        const oldHash = `old ${Math.random()}`;
        await ipfs.handleHashUpdate('running tests', oldHash, async () => oldHash, async () => {});
        expect(removalCount).to.eq(oldRemovalCount);
        expect(lastRemovedHash).not.to.eq(oldHash);
      });

      it('should not old remove any hash, when old hash is a null hash', async () => {
        const oldRemovalCount = removalCount;
        const oldHash = nullBytes32;
        const newHash = `new ${Math.random()}`;
        await ipfs.handleHashUpdate('running tests', newHash, async () => oldHash, async () => {});
        expect(removalCount).to.eq(oldRemovalCount);
        expect(lastRemovedHash).not.to.eq(oldHash);
      });
    });

    describe('when setting the new hash fails', () => {
      it('should remove new hashes, but keep old hashes', async () => {
        const oldRemovalCount = removalCount;
        const oldHash = `old ${Math.random()}`;
        const newHash = `new ${Math.random()}`;
        await ipfs.handleHashUpdate(
          'running tests',
          newHash,
          async () => oldHash,
          async () => { throw new Error('intended error during tests'); },
        );
        expect(removalCount).to.eq(oldRemovalCount + 1);
        expect(lastRemovedHash).to.eq(newHash);
      });

      it('should not remove any hash when tryinng to set same hash', async () => {
        const oldRemovalCount = removalCount;
        const oldHash = `old ${Math.random()}`;
        await ipfs.handleHashUpdate(
          'running tests',
          oldHash,
          async () => oldHash,
          async () => { throw new Error('intended error during tests'); },
        );
        expect(removalCount).to.eq(oldRemovalCount);
        expect(lastRemovedHash).not.to.eq(oldHash);
      });
    });
  });
});
