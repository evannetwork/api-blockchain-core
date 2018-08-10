/*
  Copyright (C) 2018-present evan GmbH.

  This program is free software: you can redistribute it and/or modify it
  under the terms of the GNU Affero General Public License, version 3,
  as published by the Free Software Foundation.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
  See the GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License along with this program.
  If not, see http://www.gnu.org/licenses/ or write to the

  Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA, 02110-1301 USA,

  or download the license from the following URL: https://evan.network/license/

  You can be released from the requirements of the GNU Affero General Public License
  by purchasing a commercial license.
  Buying such a license is mandatory as soon as you use this software or parts of it
  on other blockchains than evan.network.

  For more information, please contact evan GmbH at this address: https://evan.network/license/
*/

import coder = require('web3-eth-abi');


const nullBytes32 = '0x0000000000000000000000000000000000000000000000000000000000000000';
const nullAddress = '0x0000000000000000000000000000000000000000';

import {
  ContractLoader,
  Description,
  EventHub,
  Executor,
  Logger,
  LoggerOptions,
  NameResolver,
} from '@evan.network/dbcp';

export enum ClaimsStatus {
  /**
   * empty subject
   */
  None,
  /**
   * self issued state is 1, values may match
   */
  Rejected,
  /**
   * issued by both, self issued state is 2, values match
   */
  Confirmed,
  /**
   * issued by a non-issuer parent claim holder, self issued state is 0
   */
  Issued,
  /**
   * value from issuer and subject (self issued) missmatch
   */
  ValueMissmatch,
  /**
   * subject set, but value and/or states do not fall within expected range
   */
  Unknown,
}


export interface ClaimsOptions extends LoggerOptions {
  contractLoader: ContractLoader;
  executor: Executor;
  nameResolver: NameResolver;
}

/**
 * Claims helper
 *
 * @class      Sharing (name)
 */
export class Claims extends Logger {
  contracts: any;
  options: ClaimsOptions;

  constructor(options: ClaimsOptions) {
    super(options);
    this.options = options;
  }

  public async createStructure(accountId: string): Promise<any> {
    // create ens / claims registry
    const registry = await this.options.executor.createContract(
      'ClaimsENS', [], { from: accountId, gas: 1000000, });

    // create claims resolver and point it to ens
    const resolver = await this.options.executor.createContract(
      'ClaimsPublicResolver', [ registry.options.address ], { from: accountId, gas: 2000000, });

    // should be done in constructor
    // await this.options.executor.executeContractTransaction(
    //   registry, 'setOwner', { from: accountId, }, '0x0000000000000000000000000000000000000000000000000000000000000000', accountId);

    // register resolver as accepted in ens
    await this.options.executor.executeContractTransaction(
      registry, 'setAcceptedResolverState', { from: accountId, }, resolver.options.address, true);

    this.contracts = { registry, resolver, };
    return this.contracts;
  }

  public async confirmClaim(
      subject: string, claimName: string, claimValue?: string): Promise<void> {
    return this.respondToClaim(subject, claimName, 2, claimValue);
  }

  public async deleteClaim(issuer, claimName): Promise<void> {
    // create required hashes, etc
    const [ ensPath, nodeHash ] = this.getClaimProperties(claimName);
    const [_, node, parent] = /([^.]+)\.?(.*)/.exec(ensPath);
    const parentHash = parent ? this.options.nameResolver.namehash(parent) : nullBytes32;
    // get resolver (if any)
    const resolverAddress = await this.options.executor.executeContractCall(
      this.contracts.registry,
      'resolver',
      nodeHash,
    );
    const resolver = resolverAddress !== nullAddress ?
      this.options.contractLoader.loadContract('ClaimsPublicResolver', resolverAddress) : null;

    await Promise.all([
      // remove owner (== subject)
      (await this.options.executor.executeContractCall(this.contracts.registry, 'owner', nodeHash) !== nullAddress ?
        this.options.executor.executeContractTransaction(
          this.contracts.registry,
          'setSubnodeOwner',
          { from: issuer, },
          parentHash,
          this.options.nameResolver.soliditySha3(node),
          nullAddress,
        ) : null
      ),
      // clear resolver for node
      resolver ? this.options.executor.executeContractTransaction(
        this.contracts.registry,
        'setResolver',
        { from: issuer, },
        nodeHash,
        nullAddress,
      ) : null,
      // remove addr (== subject)
      resolver && (await this.options.executor.executeContractCall(resolver, 'addr', nodeHash) !== nullAddress ?
        this.options.executor.executeContractTransaction(
          resolver,
          'setAddr',
          { from: issuer, },
          nodeHash,
          nullAddress,
        ) : null
      ),
      // remov content (== claim value)
      resolver && (await this.options.executor.executeContractCall(resolver, 'content', nodeHash) !== nullBytes32 ?
        this.options.executor.executeContractTransaction(
          resolver,
          'setContent',
          { from: issuer, },
          nodeHash,
          nullBytes32,
        ) : null
      ),
    ])

  }

  public async getClaim(claimName): Promise<any> {
    const [ ensPath, nodeHash ] = this.getClaimProperties(claimName);
    const resolverAddress = await this.options.executor.executeContractCall(
      this.contracts.registry, 'resolver', nodeHash);
    if (resolverAddress === nullAddress) {
      return { status: ClaimsStatus.None, };
    }
    const resolver = this.options.contractLoader.loadContract(
      'ClaimsPublicResolver', resolverAddress);
    const [ value, [ subject, selfIssuedState, selfIssuedValue ]] = await Promise.all([
      this.options.executor.executeContractCall(resolver, 'content', nodeHash),
      (async() => {
        const addr = await this.options.executor.executeContractCall(resolver, 'addr', nodeHash);
        return await Promise.all([
          addr,
          this.options.executor.executeContractCall(resolver, 'selfIssuedState', nodeHash, addr),
          this.options.executor.executeContractCall(resolver, 'selfIssuedContent', nodeHash, addr),
        ]);
      })(),
    ]);
    const claim = { value, subject, selfIssuedState, selfIssuedValue, status: ClaimsStatus.Unknown, };
    if (subject === nullAddress) {
      claim.status = ClaimsStatus.None;
    } else if (selfIssuedState === '1') {
      claim.status = ClaimsStatus.Rejected;
    } else if (selfIssuedState === '0') {
      claim.status = ClaimsStatus.Issued
    } else if (selfIssuedState === '2' && value === selfIssuedValue) {
      claim.status = ClaimsStatus.Confirmed;
    } else if (value !== selfIssuedValue) {
      claim.status = ClaimsStatus.ValueMissmatch;
    }
    return claim;
  }

  public loadContracts(registry, resolver) {
    this.contracts = {
      registry: this.options.contractLoader.loadContract('ENS', registry),
      resolver: this.options.contractLoader.loadContract('ClaimsPublicResolver', resolver),
    };
  }

  public async setClaim(
      issuer: string, subject: string, claimName: string, claimValue?: string): Promise<void> {
    // transform to ens like path (use dots, remove leading '/')
    // /company/b-s-s/employee/aik --> aik.employee.b-s-s.company
    const [ ensPath, nodeHash ] = this.getClaimProperties(claimName);
    // split into node laben and parent path
    // e.g. '/company/b-s-s/employee/aik' --> 'aik' and 'employee.b-s-s.company' (ens like path)
    const [_, node, parent] = /([^.]+)\.?(.*)/.exec(ensPath);
    // check parent owner
    const parentHash = parent ? this.options.nameResolver.namehash(parent) : nullBytes32;
    const owner = await this.options.executor.executeContractCall(
      this.contracts.registry,
      'owner',
      parentHash,
    );
    if (owner !== issuer) {
      const msg = `trying to set claim ${claimName} with account ${issuer}, ` +
        `but parent claim ${parent} not owned by ${issuer}`;
      this.log(msg, 'error');
      throw new Error(msg);
    }
    await Promise.all([
      this.options.executor.executeContractTransaction(
        this.contracts.registry,
        'setSubnodeOwner',  // (bytes32 node, bytes32 label, address owner)
        { from: issuer, },
        parentHash,
        this.options.nameResolver.soliditySha3(node),
        subject,
      ),
      this.options.executor.executeContractTransaction(
        this.contracts.registry,
        'setResolver',
        { from: issuer, },
        nodeHash,
        this.contracts.resolver.options.address,
      ),
      this.options.executor.executeContractTransaction(
        this.contracts.resolver,
        'setAddr',
        { from: issuer, },
        nodeHash,
        subject,
      ),
      claimValue ? this.options.executor.executeContractTransaction(
        this.contracts.resolver,
        'setContent',
        { from: issuer, },
        nodeHash,
        claimValue,
      ) : null,
    ]);
  }

  public async rejectClaim(subject: string, claimName: string, claimValue?: string): Promise<void> {
    return this.respondToClaim(subject, claimName, 1, claimValue);
  }

  private getClaimProperties(claimName: string): string[] {
    const ensPath = claimName.split('/').slice(1).reverse().join('.');
    return [ensPath, this.options.nameResolver.namehash(ensPath)];
  }

  private async respondToClaim(
      subject: string, claimName: string, state: number, claimValue?: string): Promise<void> {
    const [ _, nodeHash ] = this.getClaimProperties(claimName);
    await Promise.all([
      await this.options.executor.executeContractTransaction(
        this.contracts.resolver, 'setSelfIssuedState', { from: subject, }, nodeHash, state),
      claimValue ? this.options.executor.executeContractTransaction(
        this.contracts.resolver, 'setSelfIssuedContent', { from: subject, }, nodeHash, claimValue) : null,
    ]);
  }
}
