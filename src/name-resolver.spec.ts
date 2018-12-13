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
import 'mocha';
import { BigNumber } from 'bignumber.js';
import { ContractLoader, Executor } from '@evan.network/dbcp';
import { expect, use } from 'chai';
import chaiAsPromised = require('chai-as-promised');

import { accounts } from './test/accounts';
import { config } from './config';
import { NameResolver } from './name-resolver';
import { TestUtils } from './test/test-utils';

const [ domainOwner, domainNonOwner, ensOwner, registrarOwner ] = accounts;


use(chaiAsPromised);

const fifsRegistrarDomain = 'fifs.registrar.test.evan';
const payableRegistrarDomain = 'payable';

describe('NameResolver class', function() {
  this.timeout(600000);
  let contractLoader: ContractLoader;
  let executor: Executor;
  let fifsRegistrar: any;
  let nameResolver: NameResolver;
  let web3;

  const getPrice = () => web3.utils.toWei('5', 'wei');
  const getWrongPrice = () => web3.utils.toWei('4', 'wei');
  function prepareData(registrarDomain) {
    const randomAccount = web3.utils.toChecksumAddress(
      `0x${[...Array(40)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`);
    const randomNode = Math.random().toString(32).substr(2);
    const domain = `${randomNode}.${registrarDomain}`;
    const domainHash = nameResolver.namehash(domain);
    const ens = contractLoader.loadContract('AbstractENS', config.nameResolver.ensAddress);
    return {
      domain,
      domainHash,
      ens,
      randomAccount,
      randomNode,
    };
  }

  before(async () => {
    web3 = TestUtils.getWeb3();
    contractLoader = await TestUtils.getContractLoader(web3);
    executor = await TestUtils.getExecutor(web3);
    nameResolver = await TestUtils.getNameResolver(web3);
    // create fifs registrar for testing and give it ownership over 'registrar.test.evan'
    const ens = contractLoader.loadContract('AbstractENS', config.nameResolver.ensAddress);
    // fifsRegistrar = await executor.createContract(
    //   'FIFSRegistrar',
    //   [config.nameResolver.ensAddress, nameResolver.namehash('fifs.registrar.test.evan')],
    //   { from: registrarOwner, gas: 1000000, },
    // );
    // await nameResolver.setAddress(
    //   fifsRegistrarDomain,
    //   fifsRegistrar.options.address,
    //   registrarOwner,
    //   fifsRegistrar.options.address,
    // );
  });

  after(() => {
    web3.currentProvider.connection.close();
  });

  describe('when working with the fifs registrar', () => {
    it('should be able to claim a new domain from a FIFS registrar', async () => {
      const data = prepareData(fifsRegistrarDomain);
      // check owner at ens
      const oldOwner = await executor.executeContractCall(data.ens, 'owner', data.domainHash);
      expect(oldOwner).not.to.eq(data.randomAccount);
      // claim domain
      await nameResolver.claimAddress(data.domain, domainOwner, data.randomAccount);
      // check again
      expect(await executor.executeContractCall(
        data.ens, 'owner', data.domainHash)).to.eq(data.randomAccount);
    });

    it('should not allow to take a fifs claimed domain from another account', async () => {
      const data = prepareData(fifsRegistrarDomain);
      // check owner at ens
      const oldOwner = await executor.executeContractCall(data.ens, 'owner', data.domainHash);
      expect(oldOwner).not.to.eq(data.randomAccount);
      // claim domain
      await nameResolver.claimAddress(data.domain, domainNonOwner, data.randomAccount);
      // check again
      expect(await executor.executeContractCall(
        data.ens, 'owner', data.domainHash)).to.eq(data.randomAccount);
      // try to claim address, that is already onwed by data.randomAccount
      const addressTakeover = nameResolver.claimAddress(data.domain, domainNonOwner);
      await expect(addressTakeover).to.be.rejected;
    });
  });

  describe('when buying domains', async() => {
    let payableRegistrar: any;
    let nameResolverTimed: NameResolver;
    let timedEns: any;
    // use modified validity durations
    let timeValidMs = 60000;
    let timeValidPreExpireWindowMs = -20000;
    let timeValidPostExpireWindowMs = 20000;

    const createStructure = async () => {
      // create new ens and register test tld
      timedEns = await executor.createContract('TimedENS', [], { from: ensOwner, gas: 1000000 });
      const [ resolver ] = await Promise.all([
        // create new resolver, tied to custom ens
        executor.createContract(
          'PublicResolver',
          [ timedEns.options.address ],
          { from: ensOwner, gas: 2000000 },
        ),
        // set duration, that an owner still has excluse claim permission after validity expired
        executor.executeContractTransaction(
          timedEns,
          'setValidPostExpireWindow',
          { from: ensOwner },
          Math.floor(timeValidPostExpireWindowMs / 1000),
        ),
        // register test domain
        executor.executeContractTransaction(
          timedEns,
          'setSubnodeOwner',
          { from: ensOwner },
          nameResolver.namehash(''),
          nameResolver.soliditySha3('ownedbyensowner'),
          ensOwner,
        ),
      ]);

      const nameResolverConfig = JSON.parse(JSON.stringify(config.nameResolver));
      nameResolverConfig.ensAddress = timedEns.options.address;
      nameResolverConfig.ensResolver = resolver.options.address;
      nameResolverTimed = new NameResolver({
        config: nameResolverConfig,
        executor,
        contractLoader,
        web3,
      });
      nameResolverTimed.ensContract = timedEns;

      payableRegistrar = await executor.createContract(
        'PayableRegistrar',
        [
          nameResolverConfig.ensAddress,
          nameResolverTimed.namehash('payable'),
          getPrice(),
        ],
        { from: ensOwner, gas: 1000000, },
      );
      // set duration and pre expiration window
      await Promise.all([
        // register tld
        executor.executeContractTransaction(
          timedEns,
          'setSubnodeOwner',
          { from: ensOwner },
          nameResolver.namehash(''),
          nameResolver.soliditySha3('payable'),
          payableRegistrar.options.address,
        ),
        executor.executeContractTransaction(
          payableRegistrar,
          'setValidDuration',
          { from: ensOwner },
          Math.floor(timeValidMs / 1000),
        ),
        executor.executeContractTransaction(
          payableRegistrar,
          'setValidPreExipireWindow',
          { from: ensOwner },
          Math.floor(timeValidPreExpireWindowMs / 1000),
        ),
      ]);
    };

    before(async () => {
      await createStructure();
    });

    describe('when working with the payable registrar', () => {
      it('should be able to claim a new domain from a payable registrar', async() => {
        const data = prepareData(payableRegistrarDomain);
        // check owner at ens
        const oldOwner = await executor.executeContractCall(nameResolverTimed.ensContract, 'owner', data.domainHash);
        expect(oldOwner).not.to.eq(data.randomAccount);
        // claim domain
        await nameResolverTimed.claimAddress(data.domain, domainOwner, data.randomAccount, getPrice());
        // check again
        expect(await executor.executeContractCall(
          nameResolverTimed.ensContract, 'owner', data.domainHash)).to.eq(data.randomAccount);
      });

      it('should not allow to take a payable claimed domain when giving wrong funds', async() => {
        const data = prepareData(payableRegistrarDomain);
        // check owner at ens
        const oldOwner = await executor.executeContractCall(nameResolverTimed.ensContract, 'owner', data.domainHash);
        expect(oldOwner).not.to.eq(data.randomAccount);
        // try to claim domain
        await expect(
          nameResolverTimed.claimAddress(data.domain, domainOwner, data.randomAccount, getWrongPrice()),
        ).to.be.rejected;
      });

      it('should not allow to take a payable claimed domain from another account', async() => {
        const data = prepareData(payableRegistrarDomain);
        // check owner at ens
        const oldOwner = await executor.executeContractCall(nameResolverTimed.ensContract, 'owner', data.domainHash);
        expect(oldOwner).not.to.eq(data.randomAccount);
        // claim domain
        await nameResolverTimed.claimAddress(data.domain, domainNonOwner, data.randomAccount, getPrice());
        // check again
        expect(await executor.executeContractCall(
          nameResolverTimed.ensContract, 'owner', data.domainHash)).to.eq(data.randomAccount);
        // try to claim address, that is already onwed by data.randomAccount
        const addressTakeover = nameResolverTimed.claimAddress(data.domain, domainNonOwner, domainNonOwner, getPrice());
        await expect(addressTakeover).to.be.rejected;
      });

      describe('when using ens owner account', () => {
        it('should allow to take a payable claimed domain from another account as registrar owner', async() => {
          const data = prepareData(payableRegistrarDomain);
          // check owner at ens
          const oldOwner = await executor.executeContractCall(nameResolverTimed.ensContract, 'owner', data.domainHash);
          expect(oldOwner).not.to.eq(data.randomAccount);
          // claim domain
          await nameResolverTimed.claimAddress(data.domain, domainNonOwner, data.randomAccount, getPrice());
          // check again
          expect(await executor.executeContractCall(
            nameResolverTimed.ensContract, 'owner', data.domainHash)).to.eq(data.randomAccount);
          // try to claim address, that is already onwed by data.randomAccount
          await nameResolverTimed.claimAddress(data.domain, ensOwner, ensOwner, getPrice());
        });

        it('should allow to change the price', async() => {
          const data = prepareData(payableRegistrarDomain);
          expect(await nameResolverTimed.getPrice(data.domain)).to.eq(getPrice());
          const newPrice = Math.floor(Math.random() * 10000).toString();
          await nameResolverTimed.setPrice(payableRegistrarDomain, ensOwner, newPrice);
          expect(await nameResolverTimed.getPrice(data.domain)).to.eq(newPrice);
          // restore price
          await nameResolverTimed.setPrice(payableRegistrarDomain, ensOwner, getPrice());
        });

        it('should allow to claim existing funds from registrar contract', async() => {
          const data = prepareData(payableRegistrarDomain);
          // claim domain to ensure funds on contract
          await nameResolverTimed.claimAddress(data.domain, domainOwner, data.randomAccount, getPrice());
          const registrarAddress = await executor.executeContractCall(
            nameResolverTimed.ensContract, 'owner', nameResolverTimed.namehash(payableRegistrarDomain));
          expect(await web3.eth.getBalance(registrarAddress)).not.to.eq('0');
          const registrar = contractLoader.loadContract('PayableRegistrar', registrarAddress);
          await nameResolverTimed.claimFunds(payableRegistrarDomain, ensOwner);
          expect(await web3.eth.getBalance(registrarAddress)).to.eq('0');
        });

        it('should not allow to claim existing funds from non registrar owner contract', async() => {
          const data = prepareData(payableRegistrarDomain);
          // claim domain to ensure funds on contract
          await nameResolverTimed.claimAddress(data.domain, domainOwner, data.randomAccount, getPrice());
          const registrarAddress = await executor.executeContractCall(
            nameResolverTimed.ensContract, 'owner', nameResolverTimed.namehash(payableRegistrarDomain));
          expect(await web3.eth.getBalance(registrarAddress)).not.to.eq('0');
          const registrar = contractLoader.loadContract('PayableRegistrar', registrarAddress);
          await expect(nameResolverTimed.claimFunds(domainOwner, ensOwner)).to.be.rejected;
        });
      });
    });

    describe('when using an ENS with a time limited validity for nodes', async() => {
      it('allows setting and getting addresses', async () => {
        const domain = `sample_${Math.random().toString(36).substr(2)}.ownedbyensowner`;
        const randomAddress = TestUtils.getRandomAddress();
        await nameResolverTimed.setAddress(domain, randomAddress, ensOwner, domainOwner);
        expect(await nameResolverTimed.getAddress(domain)).to.eq(randomAddress);
      });

      it('allows setting a time limit for resolval as parent domain owner', async () => {
        const domain = `sample_${Math.random().toString(36).substr(2)}.ownedbyensowner`;
        const randomAddress = TestUtils.getRandomAddress();
        await nameResolverTimed.setAddress(domain, randomAddress, ensOwner, domainOwner);

        // address still up, should resolve
        expect(await nameResolverTimed.getAddress(domain)).to.eq(randomAddress);

        // set valid time
        const setValidUntilP = nameResolverTimed.setValidUntil(domain, ensOwner, Date.now() + timeValidMs);
        await expect(setValidUntilP).not.to.be.rejected;
      });

      it('does not allow setting a time limit for resolval as (only) domain owner', async () => {
        const domain = `sample_${Math.random().toString(36).substr(2)}.ownedbyensowner`;
        const randomAddress = TestUtils.getRandomAddress();
        await nameResolverTimed.setAddress(domain, randomAddress, ensOwner, domainOwner);

        // address still up, should resolve
        expect(await nameResolverTimed.getAddress(domain)).to.eq(randomAddress);

        // set valid time
        const setValidUntilP = nameResolverTimed.setValidUntil(domain, domainNonOwner, Date.now() + timeValidMs);
        await expect(setValidUntilP).to.be.rejected;
      });

      it('stops resolving subdomains when time limit reached', async () => {
        const domain = `sample_${Math.random().toString(36).substr(2)}.ownedbyensowner`;
        const randomAddress = TestUtils.getRandomAddress();
        await nameResolverTimed.setAddress(domain, randomAddress, ensOwner, domainOwner);

        // address still up, should resolve
        expect(await nameResolverTimed.getAddress(domain)).to.eq(randomAddress);

        // set valid time
        await nameResolverTimed.setValidUntil(domain, ensOwner, Date.now() + timeValidMs);

        // check directly after setting
        await TestUtils.nextBlock(executor, domainOwner);
        expect(await nameResolverTimed.getAddress(domain)).to.eq(randomAddress);

        // wait for timeout
        await TestUtils.sleep(timeValidMs);
        await TestUtils.nextBlock(executor, domainOwner);

        // check again
        expect(await nameResolverTimed.getAddress(domain)).to.eq(null);
      });

      it('does not re-enable subdomain resolval, ' +
          'when refreshing domains between domain to resolve and an expired upper domain', async () => {
        const domain = `sample_${Math.random().toString(36).substr(2)}.ownedbyensowner`;
        const subdomain = `sub.${domain}`;

        const randomAddress1 = TestUtils.getRandomAddress();
        await nameResolverTimed.setAddress(domain, randomAddress1, ensOwner, domainOwner);
        const randomAddress2 = TestUtils.getRandomAddress();
        await nameResolverTimed.setAddress(subdomain, randomAddress2, domainOwner);

        // address still up, should resolve
        expect(await nameResolverTimed.getAddress(domain)).to.eq(randomAddress1);
        expect(await nameResolverTimed.getAddress(subdomain)).to.eq(randomAddress2);

        // set valid time
        await nameResolverTimed.setValidUntil(domain, ensOwner, Date.now() + timeValidMs);
        await nameResolverTimed.setValidUntil(subdomain, domainOwner, Date.now() + timeValidMs);

        // check directly after setting
        await TestUtils.nextBlock(executor, domainOwner);
        expect(await nameResolverTimed.getAddress(domain)).to.eq(randomAddress1);
        expect(await nameResolverTimed.getAddress(subdomain)).to.eq(randomAddress2);

        // wait for timeout
        await TestUtils.sleep(timeValidMs);
        await TestUtils.nextBlock(executor, domainOwner);

        // check again
        expect(await nameResolverTimed.getAddress(domain)).to.eq(null);
        expect(await nameResolverTimed.getAddress(subdomain)).to.eq(null);

        // now refresh upper domain
        await nameResolverTimed.setValidUntil(domain, ensOwner, Date.now() + timeValidMs);
        await TestUtils.nextBlock(executor, domainOwner);

        // check again
        expect(await nameResolverTimed.getAddress(domain)).to.eq(randomAddress1);
        expect(await nameResolverTimed.getAddress(subdomain)).to.eq(null);
      });
    });

    describe('when using payable registrar for a top level domain', async () => {
      describe('as an domain owner', async () => {
        it('can buy an address from the registrar', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const domainHash = nameResolverTimed.namehash(domain);
          const randomAccount = TestUtils.getRandomAddress();
          // check owner at ens
          const oldOwner = await executor.executeContractCall(timedEns, 'owner', domainHash);
          expect(oldOwner).not.to.eq(randomAccount);
          // claim domain
          await nameResolverTimed.claimAddress(domain, domainOwner, randomAccount, getPrice());
          // check again
          expect(await executor.executeContractCall(
            timedEns, 'owner', domainHash)).to.eq(randomAccount);
        });

        it('has expiring durations as set up', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const domainHash = nameResolverTimed.namehash(domain);
          const randomAddress = TestUtils.getRandomAddress();

          // claim domain
          await nameResolverTimed.claimAddress(domain, domainOwner, domainOwner, getPrice());
          // set address to domain
          await nameResolverTimed.setAddress(domain, randomAddress, domainOwner);

          // check address
          expect(await nameResolverTimed.getAddress(domain)).to.eq(randomAddress);

          // wait for resolval to stop
          await TestUtils.sleep(timeValidMs);
          await TestUtils.nextBlock(executor, domainOwner);

          // check again, resolver should have stopped
          expect(await nameResolverTimed.getAddress(domain)).to.eq(null);
        });

        it.only('cannot extend valid duration via registrar before expiration (and before extension timeframe)', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const domainHash = nameResolverTimed.namehash(domain);
          const randomAddress = TestUtils.getRandomAddress();

          // claim domain
          await nameResolverTimed.claimAddress(domain, domainOwner, domainOwner, getPrice());
          // set address to domain
          await nameResolverTimed.setAddress(domain, randomAddress, domainOwner);

          // check address
          expect(await nameResolverTimed.getAddress(domain)).to.eq(randomAddress);

          // fetch old valid duration
          const oldValidUntil = await executor.executeContractCall(timedEns, 'validUntil', domainHash);

          // wait for 1s (must be before timeValidMs + timeValidPreExpireWindowMs)
          await TestUtils.sleep(1000);
          await TestUtils.nextBlock(executor, domainOwner);

          // address is still up
          expect(await nameResolverTimed.getAddress(domain)).to.eq(randomAddress);
          // extend uptime
          const extendP = nameResolverTimed.claimAddress(domain, domainOwner, domainOwner, getPrice());
          await expect(extendP).to.be.rejected;
        });

        it('can extend valid duration via registrar before expiration (and in extension timeframe)', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const domainHash = nameResolverTimed.namehash(domain);
          const randomAddress = TestUtils.getRandomAddress();

          // claim domain
          await nameResolverTimed.claimAddress(domain, domainOwner, domainOwner, getPrice());
          // set address to domain
          await nameResolverTimed.setAddress(domain, randomAddress, domainOwner);

          // check address
          expect(await nameResolverTimed.getAddress(domain)).to.eq(randomAddress);

          // fetch old valid duration
          const oldValidUntil = await executor.executeContractCall(timedEns, 'validUntil', domainHash);

          // wait for resolval to be available
          await TestUtils.sleep(timeValidMs + timeValidPreExpireWindowMs);
          await TestUtils.nextBlock(executor, domainOwner);

          // address is still up
          expect(await nameResolverTimed.getAddress(domain)).to.eq(randomAddress);

          // extend uptime
          await nameResolverTimed.claimAddress(domain, domainOwner, domainOwner, getPrice());

          // updtime should have been extended
          const newValidUntil = await executor.executeContractCall(timedEns, 'validUntil', domainHash);
          expect(parseInt(newValidUntil, 10)).to.be.gt(parseInt(oldValidUntil, 10));
        });

        it('can extend valid duration via registrar after expiration (and before everyone can buy it)', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const domainHash = nameResolverTimed.namehash(domain);
          const randomAddress = TestUtils.getRandomAddress();

          // claim domain
          await nameResolverTimed.claimAddress(domain, domainOwner, domainOwner, getPrice());
          // set address to domain
          await nameResolverTimed.setAddress(domain, randomAddress, domainOwner);

          // check address
          expect(await nameResolverTimed.getAddress(domain)).to.eq(randomAddress);

          // fetch old valid duration
          const oldValidUntil = await executor.executeContractCall(timedEns, 'validUntil', domainHash);

          // wait for resolval to be available and extra owner lock has passed
          await TestUtils.sleep(timeValidMs);
          await TestUtils.nextBlock(executor, domainOwner);

          // address is not up anymore
          expect(await nameResolverTimed.getAddress(domain)).to.eq(null);

          // extend uptime
          await nameResolverTimed.claimAddress(domain, domainOwner, domainOwner, getPrice());

          // updtime should have been extended
          const newValidUntil = await executor.executeContractCall(timedEns, 'validUntil', domainHash);
          expect(parseInt(newValidUntil, 10)).to.be.gt(parseInt(oldValidUntil, 10));
        });

        it('can extend valid duration via registrar after expiration (and when everyone can buy it)', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const domainHash = nameResolverTimed.namehash(domain);
          const randomAddress = TestUtils.getRandomAddress();

          // claim domain
          await nameResolverTimed.claimAddress(domain, domainOwner, domainOwner, getPrice());
          // set address to domain
          await nameResolverTimed.setAddress(domain, randomAddress, domainOwner);

          // check address
          expect(await nameResolverTimed.getAddress(domain)).to.eq(randomAddress);

          // fetch old valid duration
          const oldValidUntil = await executor.executeContractCall(timedEns, 'validUntil', domainHash);

          // wait for resolval to be available (plus 1s to be sure, that we surpassed validity)
          await TestUtils.sleep(timeValidMs + timeValidPostExpireWindowMs);
          await TestUtils.nextBlock(executor, domainOwner);

          // address is not up anymore
          expect(await nameResolverTimed.getAddress(domain)).to.eq(null);

          // extend uptime
          await nameResolverTimed.claimAddress(domain, domainOwner, domainOwner, getPrice());

          // updtime should have been extended
          const newValidUntil = await executor.executeContractCall(timedEns, 'validUntil', domainHash);
          expect(parseInt(newValidUntil, 10)).to.be.gt(parseInt(oldValidUntil, 10));
        });

        it('can have its addresses lookup expire after valid duration', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const domainHash = nameResolverTimed.namehash(domain);
          const randomAddress = TestUtils.getRandomAddress();

          // claim domain
          await nameResolverTimed.claimAddress(domain, domainOwner, domainOwner, getPrice());
          // set address to domain
          await nameResolverTimed.setAddress(domain, randomAddress, domainOwner);

          // check address
          expect(await nameResolverTimed.getAddress(domain)).to.eq(randomAddress);

          // fetch old valid duration
          const oldValidUntil = await executor.executeContractCall(timedEns, 'validUntil', domainHash);

          // wait for resolval to be available (plus 1s to be sure, that we surpassed validity)
          await TestUtils.sleep(timeValidMs);
          await TestUtils.nextBlock(executor, domainOwner);

          // address is not up anymore
          expect(await nameResolverTimed.getAddress(domain)).to.eq(null);
        });

        it('can have its owner lookup still work after valid duration', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const domainHash = nameResolverTimed.namehash(domain);
          const randomAddress = TestUtils.getRandomAddress();

          // claim domain
          await nameResolverTimed.claimAddress(domain, domainOwner, domainOwner, getPrice());
          // set address to domain
          await nameResolverTimed.setAddress(domain, randomAddress, domainOwner);

          // check address
          expect(await nameResolverTimed.getAddress(domain)).to.eq(randomAddress);

          // fetch old valid duration
          const oldValidUntil = await executor.executeContractCall(timedEns, 'validUntil', domainHash);

          // wait for resolval to be available (plus 1s to be sure, that we surpassed validity)
          await TestUtils.sleep(timeValidMs);
          await TestUtils.nextBlock(executor, domainOwner);

          // owner is still up
          const owner = await executor.executeContractCall(timedEns, 'owner', domainHash);
          expect(owner).to.eq(domainOwner);
        });

        it('can have its owner lookup expire after valid duration and extension timeframe', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const domainHash = nameResolverTimed.namehash(domain);
          const randomAddress = TestUtils.getRandomAddress();

          // claim domain
          await nameResolverTimed.claimAddress(domain, domainOwner, domainOwner, getPrice());
          // set address to domain
          await nameResolverTimed.setAddress(domain, randomAddress, domainOwner);

          // check address
          expect(await nameResolverTimed.getAddress(domain)).to.eq(randomAddress);

          // fetch old valid duration
          const oldValidUntil = await executor.executeContractCall(timedEns, 'validUntil', domainHash);

          // wait for resolval to be available (plus 1s to be sure, that we surpassed validity)
          await TestUtils.sleep(timeValidMs + timeValidPostExpireWindowMs);
          await TestUtils.nextBlock(executor, domainOwner);

          // owner is still up
          const owner = await executor.executeContractCall(timedEns, 'owner', domainHash);
          expect(owner).to.eq('0x0000000000000000000000000000000000000000');
        });

        it('cannot register a permant domain', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const domainHash = nameResolverTimed.namehash(domain);
          const randomAccount = TestUtils.getRandomAddress();
          // check owner at ens
          const oldOwner = await executor.executeContractCall(timedEns, 'owner', domainHash);
          expect(oldOwner).not.to.eq(randomAccount);
          // claim domain
          const claimPermantP = nameResolverTimed.claimPermanentAddress(
            domain, domainOwner, randomAccount);

          await expect(claimPermantP).to.be.rejected;
        });

        it('can set validUntil for a subdomain of an owned domain', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const subDomain = `sub.${domain}`;
          const randomAddress = TestUtils.getRandomAddress();

          // get domain and subdomain
          await nameResolverTimed.claimAddress(domain, domainOwner, domainOwner, getPrice());
          await nameResolverTimed.setAddress(subDomain, randomAddress, domainOwner);

          // set validUntil
          await nameResolverTimed.setValidUntil(subDomain, domainOwner, '123000');

          // check validUntil
          expect(await nameResolverTimed.getValidUntil(subDomain)).to.eq(123000);
        });

        it('cannot set validUntil for a domain bought directly from registrar', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const randomAddress = TestUtils.getRandomAddress();

          // get domain and subdomain
          await nameResolverTimed.claimAddress(domain, domainOwner, domainOwner, getPrice());

          // set validUntil
          const setValidP = nameResolverTimed.setValidUntil(domain, domainOwner, '123000');
          await expect(setValidP).to.be.rejected;
        });
      });

      describe('as an domain non owner', async () => {
        it('cannot buy an address from the registrar from another account', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const domainHash = nameResolverTimed.namehash(domain);
          // check owner at ens
          const oldOwner = await executor.executeContractCall(timedEns, 'owner', domainHash);
          // claim domain
          await nameResolverTimed.claimAddress(domain, domainOwner, domainOwner, getPrice());
          // check again
          expect(await executor.executeContractCall(
            timedEns, 'owner', domainHash)).to.eq(domainOwner);

          // try to claim with other account
          const claimAddressP = nameResolverTimed.claimAddress(domain, domainNonOwner, domainNonOwner, getPrice());
          await expect(claimAddressP).to.be.rejected;
        });

        it('cannot extend valid duration via registrar before expiration (and in extension timeframe) from another account', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const domainHash = nameResolverTimed.namehash(domain);
          const randomAddress = TestUtils.getRandomAddress();

          // claim domain
          await nameResolverTimed.claimAddress(domain, domainOwner, domainOwner, getPrice());
          // set address to domain
          await nameResolverTimed.setAddress(domain, randomAddress, domainOwner);

          // check address
          expect(await nameResolverTimed.getAddress(domain)).to.eq(randomAddress);

          // fetch old valid duration
          const oldValidUntil = await executor.executeContractCall(timedEns, 'validUntil', domainHash);

          // wait for resolval to be available
          await TestUtils.sleep(timeValidMs + timeValidPreExpireWindowMs);
          await TestUtils.nextBlock(executor, domainOwner);

          // address is still up
          expect(await nameResolverTimed.getAddress(domain)).to.eq(randomAddress);

          // extend uptime
          const claimAddressP = nameResolverTimed.claimAddress(domain, domainNonOwner, domainNonOwner, getPrice());
          await expect(claimAddressP).to.be.rejected;
        });

        it('cannot extend valid duration via registrar after expiration (and before everyone can buy it) from another account', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const domainHash = nameResolverTimed.namehash(domain);
          const randomAddress = TestUtils.getRandomAddress();

          // claim domain
          await nameResolverTimed.claimAddress(domain, domainOwner, domainOwner, getPrice());
          // set address to domain
          await nameResolverTimed.setAddress(domain, randomAddress, domainOwner);

          // check address
          expect(await nameResolverTimed.getAddress(domain)).to.eq(randomAddress);

          // fetch old valid duration
          const oldValidUntil = await executor.executeContractCall(timedEns, 'validUntil', domainHash);

          // wait for resolval to be available and extra owner lock has passed
          await TestUtils.sleep(timeValidMs);
          await TestUtils.nextBlock(executor, domainOwner);

          // address is not up anymore
          expect(await nameResolverTimed.getAddress(domain)).to.eq(null);

          // extend uptime
          const claimAddressP = nameResolverTimed.claimAddress(domain, domainNonOwner, domainNonOwner, getPrice());
          await expect(claimAddressP).to.be.rejected;
        });

        it('can extend valid duration via registrar after expiration (and when everyone can buy it) from another account', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const domainHash = nameResolverTimed.namehash(domain);
          const randomAddress = TestUtils.getRandomAddress();

          // claim domain
          await nameResolverTimed.claimAddress(domain, domainOwner, domainOwner, getPrice());
          // set address to domain
          await nameResolverTimed.setAddress(domain, randomAddress, domainOwner);

          // check address
          expect(await nameResolverTimed.getAddress(domain)).to.eq(randomAddress);

          // fetch old valid duration
          const oldValidUntil = await executor.executeContractCall(timedEns, 'validUntil', domainHash);

          // wait for resolval to be available (plus 1s to be sure, that we surpassed validity)
          await TestUtils.sleep(timeValidMs + timeValidPostExpireWindowMs);
          await TestUtils.nextBlock(executor, domainOwner);

          // address is not up anymore
          expect(await nameResolverTimed.getAddress(domain)).to.eq(null);

          // extend uptime
          await nameResolverTimed.claimAddress(domain, domainNonOwner, domainNonOwner, getPrice());

          // updtime should have been extended
          const newValidUntil = await executor.executeContractCall(timedEns, 'validUntil', domainHash);
          expect(parseInt(newValidUntil, 10)).to.be.gt(parseInt(oldValidUntil, 10));
        });

        it('cannot register a permant domain', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const domainHash = nameResolverTimed.namehash(domain);
          const randomAccount = TestUtils.getRandomAddress();
          // check owner at ens
          const oldOwner = await executor.executeContractCall(timedEns, 'owner', domainHash);
          expect(oldOwner).not.to.eq(randomAccount);
          // claim domain
          const claimPermantP = nameResolverTimed.claimPermanentAddress(
            domain, domainNonOwner, randomAccount);

          await expect(claimPermantP).to.be.rejected;
        });

        it('cannot set validUntil for a subdomain of an owned domain', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const subDomain = `sub.${domain}`;
          const randomAddress = TestUtils.getRandomAddress();

          // get domain and subdomain
          await nameResolverTimed.claimAddress(domain, domainOwner, domainOwner, getPrice());
          await nameResolverTimed.setAddress(subDomain, randomAddress, domainOwner);

          // set validUntil
          const setValidP = nameResolverTimed.setValidUntil(subDomain, domainNonOwner, '123000');

          // check validUntil
          await expect(setValidP).to.be.rejected;
        });

        it('cannot set validUntil for a domain bought directly from registrar', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const randomAddress = TestUtils.getRandomAddress();

          // get domain and subdomain
          await nameResolverTimed.claimAddress(domain, domainOwner, domainOwner, getPrice());

          // set validUntil
          const setValidP = nameResolverTimed.setValidUntil(domain, domainNonOwner, '123000');
          await expect(setValidP).to.be.rejected;
        });
      });

      describe('as an ens owner', async () => {
        it('can register a permant domain', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const domainHash = nameResolverTimed.namehash(domain);
          const randomAccount = TestUtils.getRandomAddress();
          // check owner at ens
          const oldOwner = await executor.executeContractCall(timedEns, 'owner', domainHash);
          expect(oldOwner).not.to.eq(randomAccount);
          // claim domain
          await nameResolverTimed.claimPermanentAddress(domain, ensOwner, randomAccount);
          // check again
          expect(await executor.executeContractCall(
            timedEns, 'owner', domainHash)).to.eq(randomAccount);
        });

        it('can set validUntil for a subdomain of an owned domain', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const subDomain = `sub.${domain}`;
          const randomAddress = TestUtils.getRandomAddress();

          // get domain and subdomain
          await nameResolverTimed.claimAddress(domain, domainOwner, domainOwner, getPrice());
          await nameResolverTimed.setAddress(subDomain, randomAddress, domainOwner);

          // set validUntil
          const setValidP = nameResolverTimed.setValidUntil(subDomain, ensOwner, '123000');
          await expect(setValidP).to.be.rejected;
        });

        it('cannot set validUntil for a domain bought directly from registrar', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const randomAddress = TestUtils.getRandomAddress();

          // get domain and subdomain
          await nameResolverTimed.claimAddress(domain, domainOwner, domainOwner, getPrice());

          // set validUntil
          const setValidP = nameResolverTimed.setValidUntil(domain, ensOwner, '123000');
          await expect(setValidP).to.be.rejected;
        });
      });
    });
  });
});
