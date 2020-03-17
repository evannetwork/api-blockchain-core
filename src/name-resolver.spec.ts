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
import { ContractLoader } from '@evan.network/dbcp';
import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import { accounts, useIdentity } from './test/accounts';
import { configTestcore as config } from './config-testcore';
import { NameResolver } from './name-resolver';
import { TestUtils } from './test/test-utils';
import { Runtime } from './runtime';


use(chaiAsPromised);

const fifsRegistrarDomain = 'fifs.registrar.test.evan';
const payableRegistrarDomain = 'payable';

describe('NameResolver class', function test() {
  this.timeout(600000);
  let ensOwnerRt: Runtime;
  let domainOwnerRt: Runtime;
  let domainNonOwnerRt: Runtime;
  let contractLoader: ContractLoader;
  let ensOwner: string;
  let domainOwner: string;
  let domainNonOwner: string;
  let web3;

  const getPrice = () => web3.utils.toWei('5', 'wei');
  const getWrongPrice = () => web3.utils.toWei('4', 'wei');
  function prepareData(registrarDomain) {
    const randomAccount = web3.utils.toChecksumAddress(
      `0x${[...Array(40)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`,
    );
    const randomNode = Math.random().toString(32).substr(2);
    const domain = `${randomNode}.${registrarDomain}`;
    const domainHash = ensOwnerRt.nameResolver.namehash(domain);
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
    const runtimes = await Promise.all(
      accounts.slice(0, 3).map(
        (account) => TestUtils.getRuntime(account, null, { useIdentity }),
      ),
    );
    ([{ activeIdentity: ensOwner, contractLoader, web3 },
      { activeIdentity: domainOwner },
      { activeIdentity: domainNonOwner }] = runtimes);
    [ensOwnerRt, domainOwnerRt, domainNonOwnerRt] = runtimes;
  });

  describe('when working with the fifs registrar', () => {
    it('should be able to claim a new domain from a FIFS registrar', async () => {
      const data = prepareData(fifsRegistrarDomain);
      // check owner at ens
      const oldOwner = await domainOwnerRt.executor.executeContractCall(data.ens, 'owner', data.domainHash);
      expect(oldOwner).not.to.eq(data.randomAccount);
      // claim domain
      await domainOwnerRt.nameResolver.claimAddress(data.domain, domainOwner, data.randomAccount);
      // check again
      expect(await domainOwnerRt.executor.executeContractCall(
        data.ens, 'owner', data.domainHash,
      )).to.eq(data.randomAccount);
    });

    it('should not allow to take a fifs claimed domain from another account', async () => {
      const data = prepareData(fifsRegistrarDomain);
      // check owner at ens
      const oldOwner = await domainNonOwnerRt.executor.executeContractCall(data.ens, 'owner', data.domainHash);
      expect(oldOwner).not.to.eq(data.randomAccount);
      // claim domain
      await domainNonOwnerRt.nameResolver.claimAddress(
        data.domain,
        domainNonOwner,
        data.randomAccount,
      );
      // check again
      expect(await domainNonOwnerRt.executor.executeContractCall(
        data.ens, 'owner', data.domainHash,
      )).to.eq(data.randomAccount);
      // try to claim address, that is already onwed by data.randomAccount
      const addressTakeover = domainNonOwnerRt.nameResolver.claimAddress(
        data.domain,
        domainNonOwner,
      );
      await expect(addressTakeover).to.be.rejected;
    });
  });

  describe('when buying domains', async () => {
    let payableRegistrar: any;
    let nameResolverTimedDO: NameResolver;
    let nameResolverTimedDNO: NameResolver;
    let nameResolverTimedEO: NameResolver;
    let timedEns: any;
    // use modified validity durations
    const timeValidMs = 45000;
    const timeValidPreExpireWindowMs = -22500;
    const timeValidPostExpireWindowMs = 22500;

    const createStructure = async () => {
      // create new ens and register test tld
      timedEns = await ensOwnerRt.executor.createContract('TimedENS', [], { from: ensOwner, gas: 1000000 });
      const [resolver] = await Promise.all([
        // create new resolver, tied to custom ens
        ensOwnerRt.executor.createContract(
          'PublicResolver',
          [timedEns.options.address],
          { from: ensOwner, gas: 2000000 },
        ),
        // set duration, that an owner still has excluse claim permission after validity expired
        ensOwnerRt.executor.executeContractTransaction(
          timedEns,
          'setValidPostExpireWindow',
          { from: ensOwner },
          Math.floor(timeValidPostExpireWindowMs / 1000),
        ),
        // register test domain
        ensOwnerRt.executor.executeContractTransaction(
          timedEns,
          'setSubnodeOwner',
          { from: ensOwner },
          ensOwnerRt.nameResolver.namehash(''),
          ensOwnerRt.nameResolver.soliditySha3('ownedbyensowner'),
          ensOwner,
        ),
      ]);

      const nameResolverConfig = JSON.parse(JSON.stringify(config.nameResolver));
      nameResolverConfig.ensAddress = timedEns.options.address;
      nameResolverConfig.ensResolver = resolver.options.address;
      nameResolverTimedDO = new NameResolver({
        config: nameResolverConfig,
        executor: domainOwnerRt.executor,
        contractLoader,
        web3,
      });
      nameResolverTimedDO.ensContract = timedEns;
      nameResolverTimedDNO = new NameResolver({
        config: nameResolverConfig,
        executor: domainNonOwnerRt.executor,
        contractLoader,
        web3,
      });
      nameResolverTimedDNO.ensContract = timedEns;
      nameResolverTimedEO = new NameResolver({
        config: nameResolverConfig,
        executor: ensOwnerRt.executor,
        contractLoader,
        web3,
      });
      nameResolverTimedEO.ensContract = timedEns;

      payableRegistrar = await ensOwnerRt.executor.createContract(
        'PayableRegistrar',
        [
          nameResolverConfig.ensAddress,
          nameResolverTimedDO.namehash('payable'),
          getPrice(),
        ],
        { from: ensOwner, gas: 1000000 },
      );
      // set duration and pre expiration window
      await Promise.all([
        // register tld
        ensOwnerRt.executor.executeContractTransaction(
          timedEns,
          'setSubnodeOwner',
          { from: ensOwner },
          ensOwnerRt.nameResolver.namehash(''),
          ensOwnerRt.nameResolver.soliditySha3('payable'),
          payableRegistrar.options.address,
        ),
        ensOwnerRt.executor.executeContractTransaction(
          payableRegistrar,
          'setValidDuration',
          { from: ensOwner },
          Math.floor(timeValidMs / 1000),
        ),
        ensOwnerRt.executor.executeContractTransaction(
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
      it('should be able to claim a new domain from a payable registrar', async () => {
        const data = prepareData(payableRegistrarDomain);
        // check owner at ens
        const oldOwner = await domainOwnerRt.executor.executeContractCall(
          nameResolverTimedDO.ensContract,
          'owner',
          data.domainHash,
        );
        expect(oldOwner).not.to.eq(data.randomAccount);
        // claim domain
        await nameResolverTimedDO.claimAddress(
          data.domain, domainOwner, data.randomAccount, getPrice(),
        );
        // check again
        expect(await domainOwnerRt.executor.executeContractCall(
          nameResolverTimedDO.ensContract,
          'owner',
          data.domainHash,
        )).to.eq(data.randomAccount);
      });

      it('should not allow to take a payable claimed domain when giving wrong funds', async () => {
        const data = prepareData(payableRegistrarDomain);
        // check owner at ens
        const oldOwner = await domainOwnerRt.executor.executeContractCall(
          nameResolverTimedDO.ensContract,
          'owner',
          data.domainHash,
        );
        expect(oldOwner).not.to.eq(data.randomAccount);
        // try to claim domain
        await expect(
          nameResolverTimedDO.claimAddress(
            data.domain,
            domainOwner,
            data.randomAccount,
            getWrongPrice(),
          ),
        ).to.be.rejected;
      });

      it('should not allow to take a payable claimed domain from another account', async () => {
        const data = prepareData(payableRegistrarDomain);
        // check owner at ens
        const oldOwner = await domainNonOwnerRt.executor.executeContractCall(
          nameResolverTimedDO.ensContract,
          'owner',
          data.domainHash,
        );
        expect(oldOwner).not.to.eq(data.randomAccount);
        // claim domain
        await nameResolverTimedDNO.claimAddress(
          data.domain, domainNonOwner, data.randomAccount, getPrice(),
        );
        // check again
        expect(
          await domainNonOwnerRt.executor.executeContractCall(
            nameResolverTimedDO.ensContract,
            'owner',
            data.domainHash,
          ),
        ).to.eq(data.randomAccount);
        // try to claim address, that is already onwed by data.randomAccount
        const addressTakeover = nameResolverTimedDO.claimAddress(
          data.domain, domainNonOwner, domainNonOwner, getPrice(),
        );
        await expect(addressTakeover).to.be.rejected;
      });

      describe('when using ens owner account', () => {
        it('should allow to take a payable claimed domain from another account as registrar owner', async () => {
          const data = prepareData(payableRegistrarDomain);
          // check owner at ens
          const oldOwner = await domainNonOwnerRt.executor.executeContractCall(
            nameResolverTimedDO.ensContract,
            'owner',
            data.domainHash,
          );
          expect(oldOwner).not.to.eq(data.randomAccount);
          // claim domain
          await nameResolverTimedDNO.claimAddress(
            data.domain,
            domainNonOwner,
            data.randomAccount,
            getPrice(),
          );
          // check again
          expect(
            await domainNonOwnerRt.executor.executeContractCall(
              nameResolverTimedDO.ensContract,
              'owner',
              data.domainHash,
            ),
          ).to.eq(data.randomAccount);
          // try to claim address, that is already onwed by data.randomAccount
          await nameResolverTimedEO.claimAddress(data.domain, ensOwner, ensOwner, getPrice());
        });

        it('should allow to change the price', async () => {
          const data = prepareData(payableRegistrarDomain);
          expect(await nameResolverTimedEO.getPrice(data.domain)).to.eq(getPrice());
          const newPrice = Math.floor(Math.random() * 10000).toString();
          await nameResolverTimedEO.setPrice(payableRegistrarDomain, ensOwner, newPrice);
          expect(await nameResolverTimedDO.getPrice(data.domain)).to.eq(newPrice);
          // restore price
          await nameResolverTimedEO.setPrice(payableRegistrarDomain, ensOwner, getPrice());
        });

        it('should allow to claim existing funds from registrar contract', async () => {
          const data = prepareData(payableRegistrarDomain);
          // claim domain to ensure funds on contract
          await nameResolverTimedDO.claimAddress(
            data.domain, domainOwner, data.randomAccount, getPrice(),
          );
          const registrarAddress = await domainOwnerRt.executor.executeContractCall(
            nameResolverTimedDO.ensContract, 'owner', nameResolverTimedDO.namehash(payableRegistrarDomain),
          );
          expect(await web3.eth.getBalance(registrarAddress)).not.to.eq('0');
          await nameResolverTimedEO.claimFunds(payableRegistrarDomain, ensOwner);
          expect(await web3.eth.getBalance(registrarAddress)).to.eq('0');
        });

        it('should not allow to claim existing funds from non registrar owner contract', async () => {
          const data = prepareData(payableRegistrarDomain);
          // claim domain to ensure funds on contract
          await nameResolverTimedDO.claimAddress(
            data.domain, domainOwner, data.randomAccount, getPrice(),
          );
          const registrarAddress = await domainOwnerRt.executor.executeContractCall(
            nameResolverTimedDO.ensContract, 'owner', nameResolverTimedDO.namehash(payableRegistrarDomain),
          );
          expect(await web3.eth.getBalance(registrarAddress)).not.to.eq('0');
          await expect(nameResolverTimedEO.claimFunds(domainOwner, ensOwner)).to.be.rejected;
        });
      });
    });

    describe('when using an ENS with a time limited validity for nodes', async () => {
      it('allows setting and getting addresses', async () => {
        const domain = `sample_${Math.random().toString(36).substr(2)}.ownedbyensowner`;
        const randomAddress = TestUtils.getRandomAddress();
        await nameResolverTimedEO.setAddress(domain, randomAddress, ensOwner, domainOwner);
        expect(await nameResolverTimedEO.getAddress(domain)).to.eq(randomAddress);
      });

      it('allows setting a time limit for resolval as parent domain owner', async () => {
        const domain = `sample_${Math.random().toString(36).substr(2)}.ownedbyensowner`;
        const randomAddress = TestUtils.getRandomAddress();
        await nameResolverTimedEO.setAddress(domain, randomAddress, ensOwner, domainOwner);

        // address still up, should resolve
        expect(await nameResolverTimedEO.getAddress(domain)).to.eq(randomAddress);

        // set valid time
        const setValidUntilP = nameResolverTimedEO.setValidUntil(
          domain, ensOwner, Date.now() + timeValidMs,
        );
        await expect(setValidUntilP).not.to.be.rejected;
      });

      it('does not allow setting a time limit for resolval as (only) domain owner', async () => {
        const domain = `sample_${Math.random().toString(36).substr(2)}.ownedbyensowner`;
        const randomAddress = TestUtils.getRandomAddress();
        await nameResolverTimedEO.setAddress(domain, randomAddress, ensOwner, domainOwner);

        // address still up, should resolve
        expect(await nameResolverTimedEO.getAddress(domain)).to.eq(randomAddress);

        // set valid time
        const setValidUntilP = nameResolverTimedDO.setValidUntil(
          domain, domainNonOwner, Date.now() + timeValidMs,
        );
        await expect(setValidUntilP).to.be.rejected;
      });

      it('stops resolving subdomains when time limit reached', async () => {
        const domain = `sample_${Math.random().toString(36).substr(2)}.ownedbyensowner`;
        const randomAddress = TestUtils.getRandomAddress();
        await nameResolverTimedEO.setAddress(domain, randomAddress, ensOwner, domainOwner);

        // address still up, should resolve
        expect(await nameResolverTimedEO.getAddress(domain)).to.eq(randomAddress);

        // set valid time
        await nameResolverTimedEO.setValidUntil(domain, ensOwner, Date.now() + timeValidMs);

        // check directly after setting
        await TestUtils.nextBlock(domainOwnerRt.executor, domainOwner);
        expect(await nameResolverTimedEO.getAddress(domain)).to.eq(randomAddress);

        // wait for timeout
        await TestUtils.sleep(timeValidMs);
        await TestUtils.sleep(2000);
        await TestUtils.nextBlock(domainOwnerRt.executor, domainOwner);
        // check again
        expect(await nameResolverTimedEO.getAddress(domain)).to.eq(null);
      });

      it('does not re-enable subdomain resolval, '
          + 'when refreshing domains between domain to resolve and an expired upper domain', async () => {
        const domain = `sample_${Math.random().toString(36).substr(2)}.ownedbyensowner`;
        const subdomain = `sub.${domain}`;

        const randomAddress1 = TestUtils.getRandomAddress();
        await nameResolverTimedEO.setAddress(domain, randomAddress1, ensOwner, domainOwner);
        const randomAddress2 = TestUtils.getRandomAddress();
        await nameResolverTimedDO.setAddress(subdomain, randomAddress2, domainOwner);

        // address still up, should resolve
        expect(await nameResolverTimedDO.getAddress(domain)).to.eq(randomAddress1);
        expect(await nameResolverTimedDO.getAddress(subdomain)).to.eq(randomAddress2);

        // set valid time
        await nameResolverTimedEO.setValidUntil(domain, ensOwner, Date.now() + timeValidMs);
        await nameResolverTimedDO.setValidUntil(subdomain, domainOwner, Date.now() + timeValidMs);

        // check directly after setting
        await TestUtils.nextBlock(domainOwnerRt.executor, domainOwner);
        expect(await nameResolverTimedDO.getAddress(domain)).to.eq(randomAddress1);
        expect(await nameResolverTimedDO.getAddress(subdomain)).to.eq(randomAddress2);

        // wait for timeout
        await TestUtils.sleep(timeValidMs);
        await TestUtils.sleep(2000);
        await TestUtils.nextBlock(domainOwnerRt.executor, domainOwner);

        // check again
        expect(await nameResolverTimedDO.getAddress(domain)).to.eq(null);
        expect(await nameResolverTimedDO.getAddress(subdomain)).to.eq(null);

        // now refresh upper domain
        await nameResolverTimedEO.setValidUntil(domain, ensOwner, Date.now() + timeValidMs);
        await TestUtils.nextBlock(domainOwnerRt.executor, domainOwner);

        // check again
        expect(await nameResolverTimedDO.getAddress(domain)).to.eq(randomAddress1);
        expect(await nameResolverTimedDO.getAddress(subdomain)).to.eq(null);
      });
    });

    describe('when using payable registrar for a top level domain', async () => {
      describe('as an domain owner', async () => {
        it('can buy an address from the registrar', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const domainHash = nameResolverTimedDO.namehash(domain);
          const randomAccount = TestUtils.getRandomAddress();
          // check owner at ens
          const oldOwner = await domainOwnerRt.executor.executeContractCall(timedEns, 'owner', domainHash);
          expect(oldOwner).not.to.eq(randomAccount);
          // claim domain
          await nameResolverTimedDO.claimAddress(domain, domainOwner, randomAccount, getPrice());
          // check again
          expect(await domainOwnerRt.executor.executeContractCall(
            timedEns, 'owner', domainHash,
          )).to.eq(randomAccount);
        });

        it('has expiring durations as set up', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const randomAddress = TestUtils.getRandomAddress();

          // claim domain
          await nameResolverTimedDO.claimAddress(domain, domainOwner, domainOwner, getPrice());
          // set address to domain
          await nameResolverTimedDO.setAddress(domain, randomAddress, domainOwner);

          // check address
          expect(await nameResolverTimedDO.getAddress(domain)).to.eq(randomAddress);

          // wait for resolval to stop
          await TestUtils.sleep(timeValidMs);
          await TestUtils.sleep(2000);
          await TestUtils.nextBlock(domainOwnerRt.executor, domainOwner);

          // check again, resolver should have stopped
          expect(await nameResolverTimedDO.getAddress(domain)).to.eq(null);
        });

        it('cannot extend valid duration via registrar before expiration (and before extension timeframe)', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const randomAddress = TestUtils.getRandomAddress();

          // claim domain
          await nameResolverTimedDO.claimAddress(domain, domainOwner, domainOwner, getPrice());
          // set address to domain
          await nameResolverTimedDO.setAddress(domain, randomAddress, domainOwner);

          // check address
          expect(await nameResolverTimedDO.getAddress(domain)).to.eq(randomAddress);

          // wait for 1s (must be before timeValidMs + timeValidPreExpireWindowMs)
          await TestUtils.sleep(1000);
          await TestUtils.nextBlock(domainOwnerRt.executor, domainOwner);

          // address is still up
          expect(await nameResolverTimedDO.getAddress(domain)).to.eq(randomAddress);
          // extend uptime
          const extendP = nameResolverTimedDO.claimAddress(
            domain, domainOwner, domainOwner, getPrice(),
          );
          await expect(extendP).to.be.rejected;
        });

        it('can extend valid duration via registrar before expiration (and in extension timeframe)', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const domainHash = nameResolverTimedDO.namehash(domain);
          const randomAddress = TestUtils.getRandomAddress();

          // claim domain
          await nameResolverTimedDO.claimAddress(domain, domainOwner, domainOwner, getPrice());
          // set address to domain
          await nameResolverTimedDO.setAddress(domain, randomAddress, domainOwner);

          // check address
          expect(await nameResolverTimedDO.getAddress(domain)).to.eq(randomAddress);

          // fetch old valid duration
          const oldValidUntil = await domainOwnerRt.executor.executeContractCall(timedEns, 'validUntil', domainHash);

          // wait for resolval to be available
          await TestUtils.sleep(timeValidMs + timeValidPreExpireWindowMs);
          await TestUtils.sleep(2000);
          await TestUtils.nextBlock(domainOwnerRt.executor, domainOwner);

          // address is still up
          expect(await nameResolverTimedDO.getAddress(domain)).to.eq(randomAddress);

          // extend uptime
          await nameResolverTimedDO.claimAddress(domain, domainOwner, domainOwner, getPrice());

          // updtime should have been extended
          const newValidUntil = await domainOwnerRt.executor.executeContractCall(timedEns, 'validUntil', domainHash);
          expect(parseInt(newValidUntil, 10)).to.be.gt(parseInt(oldValidUntil, 10));
        });

        it('can extend valid duration via registrar after expiration (and before everyone can buy it)', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const domainHash = nameResolverTimedDO.namehash(domain);
          const randomAddress = TestUtils.getRandomAddress();

          // claim domain
          await nameResolverTimedDO.claimAddress(domain, domainOwner, domainOwner, getPrice());
          // set address to domain
          await nameResolverTimedDO.setAddress(domain, randomAddress, domainOwner);

          // check address
          expect(await nameResolverTimedDO.getAddress(domain)).to.eq(randomAddress);

          // fetch old valid duration
          const oldValidUntil = await domainOwnerRt.executor.executeContractCall(timedEns, 'validUntil', domainHash);

          // wait for resolval to be available and extra owner lock has passed
          await TestUtils.sleep(timeValidMs);
          await TestUtils.sleep(2000);
          await TestUtils.nextBlock(domainOwnerRt.executor, domainOwner);

          // address is not up anymore
          expect(await nameResolverTimedDO.getAddress(domain)).to.eq(null);

          // extend uptime
          await nameResolverTimedDO.claimAddress(domain, domainOwner, domainOwner, getPrice());

          // updtime should have been extended
          const newValidUntil = await domainOwnerRt.executor.executeContractCall(timedEns, 'validUntil', domainHash);
          expect(parseInt(newValidUntil, 10)).to.be.gt(parseInt(oldValidUntil, 10));
        });

        it('can extend valid duration via registrar after expiration (and when everyone can buy it)', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const domainHash = nameResolverTimedDO.namehash(domain);
          const randomAddress = TestUtils.getRandomAddress();

          // claim domain
          await nameResolverTimedDO.claimAddress(domain, domainOwner, domainOwner, getPrice());
          // set address to domain
          await nameResolverTimedDO.setAddress(domain, randomAddress, domainOwner);

          // check address
          expect(await nameResolverTimedDO.getAddress(domain)).to.eq(randomAddress);

          // fetch old valid duration
          const oldValidUntil = await domainOwnerRt.executor.executeContractCall(timedEns, 'validUntil', domainHash);

          // wait for resolval to be available (plus 1s to be sure, that we surpassed validity)
          await TestUtils.sleep(timeValidMs + timeValidPostExpireWindowMs);
          await TestUtils.nextBlock(domainOwnerRt.executor, domainOwner);

          // address is not up anymore
          expect(await nameResolverTimedDO.getAddress(domain)).to.eq(null);

          // extend uptime
          await nameResolverTimedDO.claimAddress(domain, domainOwner, domainOwner, getPrice());

          // updtime should have been extended
          const newValidUntil = await domainOwnerRt.executor.executeContractCall(timedEns, 'validUntil', domainHash);
          expect(parseInt(newValidUntil, 10)).to.be.gt(parseInt(oldValidUntil, 10));
        });

        it('can have its addresses lookup expire after valid duration', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const randomAddress = TestUtils.getRandomAddress();

          // claim domain
          await nameResolverTimedDO.claimAddress(domain, domainOwner, domainOwner, getPrice());
          // set address to domain
          await nameResolverTimedDO.setAddress(domain, randomAddress, domainOwner);

          // check address
          expect(await nameResolverTimedDO.getAddress(domain)).to.eq(randomAddress);

          // wait for resolval to be available (plus 1s to be sure, that we surpassed validity)
          await TestUtils.sleep(timeValidMs);
          await TestUtils.sleep(2000);
          await TestUtils.nextBlock(domainOwnerRt.executor, domainOwner);

          // address is not up anymore
          expect(await nameResolverTimedDO.getAddress(domain)).to.eq(null);
        });

        it('can have its owner lookup still work after valid duration', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const domainHash = nameResolverTimedDO.namehash(domain);
          const randomAddress = TestUtils.getRandomAddress();

          // claim domain
          await nameResolverTimedDO.claimAddress(domain, domainOwner, domainOwner, getPrice());
          // set address to domain
          await nameResolverTimedDO.setAddress(domain, randomAddress, domainOwner);

          // check address
          expect(await nameResolverTimedDO.getAddress(domain)).to.eq(randomAddress);

          // wait for resolval to be available (plus 1s to be sure, that we surpassed validity)
          await TestUtils.sleep(timeValidMs);
          await TestUtils.nextBlock(domainOwnerRt.executor, domainOwner);

          // owner is still up
          const owner = await domainOwnerRt.executor.executeContractCall(timedEns, 'owner', domainHash);
          expect(owner).to.eq(domainOwner);
        });

        it('can have its owner lookup expire after valid duration and extension timeframe', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const domainHash = nameResolverTimedDO.namehash(domain);
          const randomAddress = TestUtils.getRandomAddress();

          // claim domain
          await nameResolverTimedDO.claimAddress(domain, domainOwner, domainOwner, getPrice());
          // set address to domain
          await nameResolverTimedDO.setAddress(domain, randomAddress, domainOwner);

          // check address
          expect(await nameResolverTimedDO.getAddress(domain)).to.eq(randomAddress);

          // wait for resolval to be available (plus 1s to be sure, that we surpassed validity)
          await TestUtils.sleep(timeValidMs + timeValidPostExpireWindowMs);
          await TestUtils.sleep(2000);
          await TestUtils.nextBlock(domainOwnerRt.executor, domainOwner);

          // owner is still up
          const owner = await domainOwnerRt.executor.executeContractCall(timedEns, 'owner', domainHash);
          expect(owner).to.eq('0x0000000000000000000000000000000000000000');
        });

        it('cannot register a permant domain', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const domainHash = nameResolverTimedDO.namehash(domain);
          const randomAccount = TestUtils.getRandomAddress();
          // check owner at ens
          const oldOwner = await domainOwnerRt.executor.executeContractCall(timedEns, 'owner', domainHash);
          expect(oldOwner).not.to.eq(randomAccount);
          // claim domain
          const claimPermantP = nameResolverTimedDO.claimPermanentAddress(
            domain, domainOwner, randomAccount,
          );

          await expect(claimPermantP).to.be.rejected;
        });

        it('can set validUntil for a subdomain of an owned domain', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const subDomain = `sub.${domain}`;
          const randomAddress = TestUtils.getRandomAddress();

          // get domain and subdomain
          await nameResolverTimedDO.claimAddress(domain, domainOwner, domainOwner, getPrice());
          await nameResolverTimedDO.setAddress(subDomain, randomAddress, domainOwner);

          // set validUntil
          await nameResolverTimedDO.setValidUntil(subDomain, domainOwner, '123000');

          // check validUntil
          expect(await nameResolverTimedDO.getValidUntil(subDomain)).to.eq(123000);
        });

        it('cannot set validUntil for a domain bought directly from registrar', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;

          // get domain and subdomain
          await nameResolverTimedDO.claimAddress(domain, domainOwner, domainOwner, getPrice());

          // set validUntil
          const setValidP = nameResolverTimedDO.setValidUntil(domain, domainOwner, '123000');
          await expect(setValidP).to.be.rejected;
        });
      });

      describe('as an domain non owner', async () => {
        it('cannot buy an address from the registrar from another account', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const domainHash = nameResolverTimedDO.namehash(domain);
          // claim domain
          await nameResolverTimedDO.claimAddress(domain, domainOwner, domainOwner, getPrice());
          // check again
          expect(await domainOwnerRt.executor.executeContractCall(
            timedEns, 'owner', domainHash,
          )).to.eq(domainOwner);

          // try to claim with other account
          const claimAddressP = nameResolverTimedDNO.claimAddress(
            domain, domainNonOwner, domainNonOwner, getPrice(),
          );
          await expect(claimAddressP).to.be.rejected;
        });

        it('cannot extend valid duration via registrar before expiration (and in extension timeframe) from another account', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const randomAddress = TestUtils.getRandomAddress();

          // claim domain
          await nameResolverTimedDO.claimAddress(domain, domainOwner, domainOwner, getPrice());
          // set address to domain
          await nameResolverTimedDO.setAddress(domain, randomAddress, domainOwner);

          // check address
          expect(await nameResolverTimedDO.getAddress(domain)).to.eq(randomAddress);

          // wait for resolval to be available
          await TestUtils.sleep(timeValidMs + timeValidPreExpireWindowMs);
          await TestUtils.nextBlock(domainOwnerRt.executor, domainOwner);

          // address is still up
          expect(await nameResolverTimedDO.getAddress(domain)).to.eq(randomAddress);

          // extend uptime
          const claimAddressP = nameResolverTimedDNO.claimAddress(
            domain, domainNonOwner, domainNonOwner, getPrice(),
          );
          await expect(claimAddressP).to.be.rejected;
        });

        it('cannot extend valid duration via registrar after expiration '
          + '(and before everyone can buy it) from another account',
        async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const randomAddress = TestUtils.getRandomAddress();

          // claim domain
          await nameResolverTimedDO.claimAddress(domain, domainOwner, domainOwner, getPrice());
          // set address to domain
          await nameResolverTimedDO.setAddress(domain, randomAddress, domainOwner);

          // check address
          expect(await nameResolverTimedDO.getAddress(domain)).to.eq(randomAddress);

          // wait for resolval to be available and extra owner lock has passed
          await TestUtils.sleep(timeValidMs);
          await TestUtils.sleep(2000);
          await TestUtils.nextBlock(domainOwnerRt.executor, domainOwner);

          // address is not up anymore
          expect(await nameResolverTimedDO.getAddress(domain)).to.eq(null);

          // extend uptime
          const claimAddressP = nameResolverTimedDNO.claimAddress(
            domain, domainNonOwner, domainNonOwner, getPrice(),
          );
          await expect(claimAddressP).to.be.rejected;
        });

        it('can extend valid duration via registrar after expiration (and when everyone can buy it) from another account', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const domainHash = nameResolverTimedDO.namehash(domain);
          const randomAddress = TestUtils.getRandomAddress();

          // claim domain
          await nameResolverTimedDO.claimAddress(domain, domainOwner, domainOwner, getPrice());
          // set address to domain
          await nameResolverTimedDO.setAddress(domain, randomAddress, domainOwner);

          // check address
          expect(await nameResolverTimedDO.getAddress(domain)).to.eq(randomAddress);

          // fetch old valid duration
          const oldValidUntil = await domainOwnerRt.executor.executeContractCall(timedEns, 'validUntil', domainHash);

          // wait for resolval to be available (plus 1s to be sure, that we surpassed validity)
          await TestUtils.sleep(timeValidMs + timeValidPostExpireWindowMs);
          await TestUtils.sleep(2000);
          await TestUtils.nextBlock(domainOwnerRt.executor, domainOwner);

          // address is not up anymore
          expect(await nameResolverTimedDO.getAddress(domain)).to.eq(null);

          // extend uptime
          await nameResolverTimedDNO.claimAddress(
            domain,
            domainNonOwner,
            domainNonOwner,
            getPrice(),
          );

          // updtime should have been extended
          const newValidUntil = await domainOwnerRt.executor.executeContractCall(timedEns, 'validUntil', domainHash);
          expect(parseInt(newValidUntil, 10)).to.be.gt(parseInt(oldValidUntil, 10));
        });

        it('cannot register a permant domain', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const domainHash = nameResolverTimedDO.namehash(domain);
          const randomAccount = TestUtils.getRandomAddress();
          // check owner at ens
          const oldOwner = await domainOwnerRt.executor.executeContractCall(timedEns, 'owner', domainHash);
          expect(oldOwner).not.to.eq(randomAccount);
          // claim domain
          const claimPermantP = nameResolverTimedDNO.claimPermanentAddress(
            domain, domainNonOwner, randomAccount,
          );

          await expect(claimPermantP).to.be.rejected;
        });

        it('cannot set validUntil for a subdomain of an owned domain', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const subDomain = `sub.${domain}`;
          const randomAddress = TestUtils.getRandomAddress();

          // get domain and subdomain
          await nameResolverTimedDO.claimAddress(domain, domainOwner, domainOwner, getPrice());
          await nameResolverTimedDO.setAddress(subDomain, randomAddress, domainOwner);

          // set validUntil
          const setValidP = nameResolverTimedDNO.setValidUntil(subDomain, domainNonOwner, '123000');

          // check validUntil
          await expect(setValidP).to.be.rejected;
        });

        it('cannot set validUntil for a domain bought directly from registrar', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;

          // get domain and subdomain
          await nameResolverTimedDO.claimAddress(domain, domainOwner, domainOwner, getPrice());

          // set validUntil
          const setValidP = nameResolverTimedDNO.setValidUntil(domain, domainNonOwner, '123000');
          await expect(setValidP).to.be.rejected;
        });
      });

      describe('as an ens owner', async () => {
        it('can register a permant domain', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const domainHash = nameResolverTimedDO.namehash(domain);
          const randomAccount = TestUtils.getRandomAddress();
          // check owner at ens
          const oldOwner = await ensOwnerRt.executor.executeContractCall(timedEns, 'owner', domainHash);
          expect(oldOwner).not.to.eq(randomAccount);
          // claim domain
          await nameResolverTimedEO.claimPermanentAddress(domain, ensOwner, randomAccount);
          // check again
          expect(await ensOwnerRt.executor.executeContractCall(
            timedEns, 'owner', domainHash,
          )).to.eq(randomAccount);
        });

        it('can set validUntil for a subdomain of an owned domain', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;
          const subDomain = `sub.${domain}`;
          const randomAddress = TestUtils.getRandomAddress();

          // get domain and subdomain
          await nameResolverTimedDO.claimAddress(domain, domainOwner, domainOwner, getPrice());
          await nameResolverTimedDO.setAddress(subDomain, randomAddress, domainOwner);

          // set validUntil
          const setValidP = nameResolverTimedEO.setValidUntil(subDomain, ensOwner, '123000');
          await expect(setValidP).to.be.rejected;
        });

        it('cannot set validUntil for a domain bought directly from registrar', async () => {
          const domain = `sample_${Math.random().toString(36).substr(2)}.payable`;

          // get domain and subdomain
          await nameResolverTimedDO.claimAddress(domain, domainOwner, domainOwner, getPrice());

          // set validUntil
          const setValidP = nameResolverTimedEO.setValidUntil(domain, ensOwner, '123000');
          await expect(setValidP).to.be.rejected;
        });
      });
    });
  });
});
