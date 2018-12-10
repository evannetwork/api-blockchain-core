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
const payableRegistrarDomain = 'payable.registrar.test.evan';

describe('NameResolver class', function() {
  this.timeout(600000);
  let contractLoader: ContractLoader;
  let executor: Executor;
  let fifsRegistrar;
  let nameResolver: NameResolver;
  let web3;

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

  describe('when working with the payable registrar', () => {
    const getPrice = () => web3.utils.toWei('5', 'wei');
    const getWrongPrice = () => web3.utils.toWei('4', 'wei');

    // disabled by default, only required when deploying new registrars
    if (registrarOwner) {
      it('can be set up', async() => {
        const payableRegistrar = await executor.createContract(
          'PayableRegistrar',
          [
            config.nameResolver.ensAddress,
            nameResolver.namehash('payable.registrar.test.evan'),
            getPrice(),
          ],
          { from: registrarOwner, gas: 1000000, },
        );
        await nameResolver.setAddress(
          payableRegistrarDomain,
          payableRegistrar.options.address,
          registrarOwner,
          payableRegistrar.options.address,
        );
      });
    }

    describe('when using another account than the registrar owner', () => {
      it('should be able to claim a new domain from a payable registrar', async() => {
        const data = prepareData(payableRegistrarDomain);
        // check owner at ens
        const oldOwner = await executor.executeContractCall(data.ens, 'owner', data.domainHash);
        expect(oldOwner).not.to.eq(data.randomAccount);
        // claim domain
        await nameResolver.claimAddress(data.domain, domainOwner, data.randomAccount, getPrice());
        // check again
        expect(await executor.executeContractCall(
          data.ens, 'owner', data.domainHash)).to.eq(data.randomAccount);
      });

      it('should not allow to take a payable claimed domain when giving wrong funds', async() => {
        const data = prepareData(payableRegistrarDomain);
        // check owner at ens
        const oldOwner = await executor.executeContractCall(data.ens, 'owner', data.domainHash);
        expect(oldOwner).not.to.eq(data.randomAccount);
        // try to claim domain
        await expect(
          nameResolver.claimAddress(data.domain, domainOwner, data.randomAccount, getWrongPrice()),
        ).to.be.rejected;
      });

      it('should not allow to take a payable claimed domain from another account', async() => {
        const data = prepareData(payableRegistrarDomain);
        // check owner at ens
        const oldOwner = await executor.executeContractCall(data.ens, 'owner', data.domainHash);
        expect(oldOwner).not.to.eq(data.randomAccount);
        // claim domain
        await nameResolver.claimAddress(data.domain, domainNonOwner, data.randomAccount, getPrice());
        // check again
        expect(await executor.executeContractCall(
          data.ens, 'owner', data.domainHash)).to.eq(data.randomAccount);
        // try to claim address, that is already onwed by data.randomAccount
        const addressTakeover = nameResolver.claimAddress(data.domain, domainNonOwner, domainNonOwner, getPrice());
        await expect(addressTakeover).to.be.rejected;
      });
    });

    if (registrarOwner) {
      describe('when using registrar owner account', () => {
        it('should allow to take a payable claimed domain from another account as registrar owner', async() => {
          const data = prepareData(payableRegistrarDomain);
          // check owner at ens
          const oldOwner = await executor.executeContractCall(data.ens, 'owner', data.domainHash);
          expect(oldOwner).not.to.eq(data.randomAccount);
          // claim domain
          await nameResolver.claimAddress(data.domain, domainNonOwner, data.randomAccount, getPrice());
          // check again
          expect(await executor.executeContractCall(
            data.ens, 'owner', data.domainHash)).to.eq(data.randomAccount);
          // try to claim address, that is already onwed by data.randomAccount
          await nameResolver.claimAddress(data.domain, registrarOwner, registrarOwner, getPrice());
        });

        it('should allow to change the price', async() => {
          const data = prepareData(payableRegistrarDomain);
          expect(await nameResolver.getPrice(data.domain)).to.eq(getPrice());
          const newPrice = Math.floor(Math.random() * 10000).toString();
          await nameResolver.setPrice(payableRegistrarDomain, registrarOwner, newPrice);
          expect(await nameResolver.getPrice(data.domain)).to.eq(newPrice);
          // restore price
          await nameResolver.setPrice(payableRegistrarDomain, registrarOwner, getPrice());
        });

        it('should allow to claim existing funds from registrar contract', async() => {
          const data = prepareData(payableRegistrarDomain);
          // claim domain to ensure funds on contract
          await nameResolver.claimAddress(data.domain, domainOwner, data.randomAccount, getPrice());
          const registrarAddress = await executor.executeContractCall(
            data.ens, 'owner', nameResolver.namehash(payableRegistrarDomain));
          expect(await web3.eth.getBalance(registrarAddress)).not.to.eq('0');
          const registrar = contractLoader.loadContract('PayableRegistrar', registrarAddress);
          await nameResolver.claimFunds(payableRegistrarDomain, registrarOwner);
          expect(await web3.eth.getBalance(registrarAddress)).to.eq('0');
        });

        it('should not allow to claim existing funds from non registrar owner contract', async() => {
          const data = prepareData(payableRegistrarDomain);
          // claim domain to ensure funds on contract
          await nameResolver.claimAddress(data.domain, domainOwner, data.randomAccount, getPrice());
          const registrarAddress = await executor.executeContractCall(
            data.ens, 'owner', nameResolver.namehash(payableRegistrarDomain));
          expect(await web3.eth.getBalance(registrarAddress)).not.to.eq('0');
          const registrar = contractLoader.loadContract('PayableRegistrar', registrarAddress);
          await expect(nameResolver.claimFunds(domainOwner, registrarOwner)).to.be.rejected;
        });
      });
    }
  });

  describe('when using an ENS with a time limited validity for nodes', async() => {
    let resolverWithTimedEns: NameResolver;
    let timedEns;

    before(async () => {
      // create new ens and register test tld
      timedEns = await executor.createContract('TimedENS', [], { from: ensOwner, gas: 1000000 });
      await executor.executeContractTransaction(
        timedEns,
        'setSubnodeOwner',
        { from: ensOwner },
        nameResolver.namehash(''),
        nameResolver.soliditySha3('test'),
        ensOwner,
      );
      // create new resolver, tied to custom ens
      const resolver = await executor.createContract(
        'PublicResolver',
        [ timedEns.options.address ],
        { from: ensOwner, gas: 2000000 },
      );

      const nameResolverConfig = JSON.parse(JSON.stringify(config.nameResolver));
      nameResolverConfig.ensAddress = timedEns.options.address;
      nameResolverConfig.ensResolver = resolver.options.address;
      resolverWithTimedEns = new NameResolver({
        config: nameResolverConfig,
        executor,
        contractLoader,
        web3,
      });
      resolverWithTimedEns.ensContract = timedEns;
    });

    it('allows setting and getting addresses', async () => {
      const domain = `sample_${Math.random().toString(36).substr(2)}.test`;
      const randomAddress = TestUtils.getRandomAddress();
      await resolverWithTimedEns.setAddress(domain, randomAddress, ensOwner, domainOwner);
      expect(await resolverWithTimedEns.getAddress(domain)).to.eq(randomAddress);
    });

    it('allows setting a time limit for resolval as parent domain owner', async () => {
      const domain = `sample_${Math.random().toString(36).substr(2)}.test`;
      const randomAddress = TestUtils.getRandomAddress();
      await resolverWithTimedEns.setAddress(domain, randomAddress, ensOwner, domainOwner);

      // address still up, should resolve
      expect(await resolverWithTimedEns.getAddress(domain)).to.eq(randomAddress);

      // set valid time
      const setValidUntilP = resolverWithTimedEns.setValidUntil(domain, ensOwner, Date.now() + 10000);
      await expect(setValidUntilP).not.to.be.rejected;
    });

    it('does not allow setting a time limit for resolval as (only) domain owner', async () => {
      const domain = `sample_${Math.random().toString(36).substr(2)}.test`;
      const randomAddress = TestUtils.getRandomAddress();
      await resolverWithTimedEns.setAddress(domain, randomAddress, ensOwner, domainOwner);

      // address still up, should resolve
      expect(await resolverWithTimedEns.getAddress(domain)).to.eq(randomAddress);

      // set valid time
      const setValidUntilP = resolverWithTimedEns.setValidUntil(domain, domainNonOwner, Date.now() + 10000);
      await expect(setValidUntilP).to.be.rejected;
    });

    it('stops resolving subdomains when time limit reached', async () => {
      const domain = `sample_${Math.random().toString(36).substr(2)}.test`;
      const randomAddress = TestUtils.getRandomAddress();
      await resolverWithTimedEns.setAddress(domain, randomAddress, ensOwner, domainOwner);

      // address still up, should resolve
      expect(await resolverWithTimedEns.getAddress(domain)).to.eq(randomAddress);

      // set valid time
      await resolverWithTimedEns.setValidUntil(domain, ensOwner, Date.now() + 10000);

      // check directly after setting
      await TestUtils.nextBlock(executor, domainOwner);
      expect(await resolverWithTimedEns.getAddress(domain)).to.eq(randomAddress);

      // wait for timeout
      await TestUtils.sleep(10000);
      await TestUtils.nextBlock(executor, domainOwner);

      // check again
      expect(await resolverWithTimedEns.getAddress(domain)).to.eq(null);
    });

    it('does not re-enable subdomain resolval, ' +
        'when refreshing domains between domain to resolve and an expired upper domain', async () => {
      const domain = `sample_${Math.random().toString(36).substr(2)}.test`;
      const subdomain = `sub.${domain}`;
      const randomAddress1 = TestUtils.getRandomAddress();
      await resolverWithTimedEns.setAddress(domain, randomAddress1, ensOwner, domainOwner);
      const randomAddress2 = TestUtils.getRandomAddress();
      await resolverWithTimedEns.setAddress(subdomain, randomAddress2, domainOwner);

      // address still up, should resolve
      expect(await resolverWithTimedEns.getAddress(domain)).to.eq(randomAddress1);
      expect(await resolverWithTimedEns.getAddress(subdomain)).to.eq(randomAddress2);

      // set valid time
      await resolverWithTimedEns.setValidUntil(domain, ensOwner, Date.now() + 60000);
      await resolverWithTimedEns.setValidUntil(subdomain, domainOwner, Date.now() + 60000);

      // check directly after setting
      await TestUtils.nextBlock(executor, domainOwner);
      expect(await resolverWithTimedEns.getAddress(domain)).to.eq(randomAddress1);
      expect(await resolverWithTimedEns.getAddress(subdomain)).to.eq(randomAddress2);

      // wait for timeout
      await TestUtils.sleep(60000);
      await TestUtils.nextBlock(executor, domainOwner);

      // check again
      expect(await resolverWithTimedEns.getAddress(domain)).to.eq(null);
      expect(await resolverWithTimedEns.getAddress(subdomain)).to.eq(null);

      // now refresh upper domain
      await resolverWithTimedEns.setValidUntil(domain, ensOwner, Date.now() + 60000);
      await TestUtils.nextBlock(executor, domainOwner);

      // check again
      expect(await resolverWithTimedEns.getAddress(domain)).to.eq(randomAddress1);
      expect(await resolverWithTimedEns.getAddress(subdomain)).to.eq(null);
    });
  });
});
