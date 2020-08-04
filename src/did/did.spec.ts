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

import * as didJWT from 'did-jwt';
import 'mocha';
import * as chaiAsPromised from 'chai-as-promised';
import * as _ from 'lodash';
import { expect, use } from 'chai';
import { Did, DidProofType } from './did';
import { SignerIdentity } from '../contracts/signer-identity';
import { TestUtils } from '../test/test-utils';
import {
  accounts,
  accountMap,
  identities,
  useIdentity,
} from '../test/accounts';
import {
  DigitalTwin,
  DigitalTwinOptions,
  Runtime,
} from '../index';

import { Vade } from '../../libs/vade';

use(chaiAsPromised);

let useVade = false;
try {
  useVade = JSON.parse(process.env.USE_VADE);
} catch (_ex) {
  // silently continue
}

(useIdentity ? describe : describe.skip)('DID Resolver', function test() {
  this.timeout(60_000);
  let accounts0Identity: string;
  let accounts0Did: string;
  let runtimes: Runtime[];
  let vade: Vade;
  const vadeConfig = {}; // use default config but enable vade
  const runtimeConfig = {
    useIdentity: true,
    ...(useVade && { vade: vadeConfig }),
  };

  before(async () => {
    runtimes = await Promise.all([
      TestUtils.getRuntime(accounts[0], null, runtimeConfig),
      TestUtils.getRuntime(accounts[1], null, runtimeConfig),
      TestUtils.getRuntime(accounts[2], null, runtimeConfig),
    ]);
    accounts0Identity = await runtimes[0].activeIdentity;
    accounts0Did = await runtimes[0].did.convertIdentityToDid(accounts0Identity);
    // create new registry and update runtimes 0 and 1
    const registry = await runtimes[2].executor.createContract(
      'DidRegistry', [], { from: runtimes[2].activeIdentity, gas: 1_000_000 },
    );
    const options0 = (({
      accountStore,
      contractLoader,
      dfs,
      executor,
      nameResolver,
      signer,
      vade: innerVade,
      verifications,
      web3,
    }) => ({
      accountStore,
      contractLoader,
      dfs,
      executor,
      nameResolver,
      signerIdentity: signer as SignerIdentity,
      vade: innerVade,
      verifications,
      web3,
    }))(runtimes[0]);
    runtimes[0].did = new Did(options0, { registryAddress: registry.options.address });
    const options1 = (({
      accountStore,
      contractLoader,
      dfs,
      executor,
      nameResolver,
      signer,
      vade: innerVade,
      verifications,
      web3,
    }) => ({
      accountStore,
      contractLoader,
      dfs,
      executor,
      nameResolver,
      signerIdentity: signer as SignerIdentity,
      vade: innerVade,
      verifications,
      web3,
    }))(runtimes[1]);
    runtimes[1].did = new Did(options1, { registryAddress: registry.options.address });
    vade = runtimes[0].vade;
  });

  describe('when using general did functionality', async () => {
    it('returns a checksum ethereum address when converting dids to identities', async () => {
      const identityChecksumCase = '0xc1912fEE45d61C87Cc5EA59DaE31190FFFFf232d';
      const identityLowerCase = identityChecksumCase.toLowerCase();
      const didMixed = await runtimes[0].did.convertIdentityToDid(identityChecksumCase);
      const didLower = await runtimes[0].did.convertIdentityToDid(identityLowerCase);
      const identityAfter = await runtimes[0].did.convertDidToIdentity(didMixed);
      const identityLowerCaseAfter = await runtimes[0].did.convertDidToIdentity(didLower);

      expect(identityAfter).to.eq(identityChecksumCase);
      expect(identityLowerCaseAfter).to.eq(identityChecksumCase);
    });
  });

  describe('when storing did documents for account identities', async () => {
    it('allows to store a DID document for the own identity', async () => {
      const document = await runtimes[0].did.getDidDocumentTemplate();
      const promise = runtimes[0].did.setDidDocument(accounts0Did, document);
      await expect(promise).not.to.be.rejected;
    });

    it('can get retrieve an account identities DID document', async () => {
      const document = await runtimes[0].did.getDidDocumentTemplate();
      await runtimes[0].did.setDidDocument(accounts0Did, document);
      const retrieved = await runtimes[0].did.getDidDocument(accounts0Did);
      expect(retrieved.authentication).to.deep.eq(document.authentication);
      expect(retrieved.id).to.eq(document.id);
      expect(retrieved.publicKey).to.deep.eq(document.publicKey);
    });

    it('allows to get a DID document of another identity', async () => {
      const document = await runtimes[0].did.getDidDocumentTemplate();
      await runtimes[0].did.setDidDocument(accounts0Did, document);
      const retrieved = await runtimes[1].did.getDidDocument(accounts0Did);
      expect(retrieved.authentication).to.deep.eq(document.authentication);
      expect(retrieved.id).to.eq(document.id);
      expect(retrieved.publicKey).to.deep.eq(document.publicKey);
    });

    // eslint-disable-next-line func-names, consistent-return
    (useVade ? it.skip : it)('does not allow to store a DID document for another identity', async () => {
      const document = await runtimes[0].did.getDidDocumentTemplate();
      const accounts1Identity = await runtimes[0].verifications.getIdentityForAccount(
        runtimes[1].underlyingAccount,
        true,
      );
      const accounts1Did = await runtimes[0].did.convertIdentityToDid(accounts1Identity);
      const promise = runtimes[0].did.setDidDocument(accounts1Did, document);
      await expect(promise).to.be.rejectedWith(/^could not estimate gas usage for setDidDocument/);
    });

    it('allows to define services in a DID document', async () => {
      const template = await runtimes[0].did.getDidDocumentTemplate();
      await runtimes[0].did.setDidDocument(accounts0Did, template);
      const servicelessDocument = await runtimes[0].did.getDidDocument(accounts0Did);

      // set new service
      const random = Math.floor(Math.random() * 1e9);
      const service = [{
        id: `${accounts0Did}#randomService`,
        type: `randomService-${random}`,
        serviceEndpoint: `https://openid.example.com/${random}`,
      }];
      await runtimes[0].did.setService(accounts0Did, service);
      const serviceDocument = await runtimes[0].did.getDidDocument(accounts0Did);
      expect(await runtimes[0].did.getService(accounts0Did))
        .to.deep.eq(service);
      expect(serviceDocument.created).to.eq(servicelessDocument.created);
      expect(serviceDocument.id).to.eq(servicelessDocument.id);
      expect(serviceDocument.publicKey).to.deep.eq(servicelessDocument.publicKey);
    });

    it('does not allow me to fetch a default did document for accounts that have no identity set', async () => {
      const randomIdentity = TestUtils.getRandomAddress();
      const did = await runtimes[0].did.convertIdentityToDid(randomIdentity);
      const identityDidDocP = runtimes[0].did.getDidDocument(did);
      await expect(identityDidDocP).to.be.rejectedWith(
        new RegExp(`^Unable to resolve: Invalid DID ${did}`, 'i'),
      );
    });

    it('automatically sets created, proof, and updated properties', async () => {
      const document = await runtimes[0].did.getDidDocumentTemplate();
      await runtimes[0].did.setDidDocument(accounts0Did, document);
      const didDoc = await runtimes[0].did.getDidDocument(accounts0Did);
      expect(didDoc).to.have.property('created');
      expect(didDoc).to.have.property('updated');
      expect(didDoc).to.have.property('proof');
    });

    it('throws if a DID document has an invalid proof', async () => {
      const didContract = await (runtimes[0].did as any).getRegistryContract();

      // Create scenario where a document carries a proof that has been
      //   created over a differing document
      const documentToSave = await runtimes[0].did.getDidDocumentTemplate();
      const documentToCreateProofOver = _.cloneDeep(documentToSave);
      documentToCreateProofOver.updated = new Date(Date.now()).toISOString();

      const invalidProof = await (runtimes[0].did as any).createJwtForDid(
        documentToCreateProofOver,
        accounts0Did,
        DidProofType.EcdsaPublicKeySecp256k1,
      );
      documentToSave.proof = {
        type: DidProofType.EcdsaPublicKeySecp256k1,
        created: new Date(Date.now()).toISOString(),
        proofPurpose: 'assertionMethod',
        verificationMethod: documentToSave.publicKey[0].id,
        jws: invalidProof,
      };

      // Set did document with invalid proof manually (the api wouldn't allow this)
      const identity = await runtimes[0].did.convertDidToIdentity(accounts0Did);
      const targetHash = await (runtimes[0].did as any).padIdentity(identity);

      if (vade) {
        await vade.didUpdate(
          accounts0Did,
          JSON.stringify({
            privateKey: accountMap[accounts[0]],
            identity: accounts0Did,
            operation: 'setDidDocument',
          }),
          JSON.stringify(documentToSave),
        );
      } else {
        const documentHash = await runtimes[0].dfs.add('did', Buffer.from(JSON.stringify(documentToSave)));
        await runtimes[0].executor.executeContractTransaction(
          didContract,
          'setDidDocument',
          { from: runtimes[0].activeIdentity },
          targetHash,
          documentHash,
        );
      }

      // Try to retrieve it
      await expect(runtimes[0].did.getDidDocument(accounts0Did)).to.be.rejectedWith('Invalid proof');
    });

    it('does not sign the proof of a signed document', async () => {
      const document = await runtimes[0].did.getDidDocumentTemplate();
      await runtimes[0].did.setDidDocument(accounts0Did, document);
      let savedDidDocument = await runtimes[0].did.getDidDocument(accounts0Did);
      await runtimes[0].did.setDidDocument(accounts0Did, savedDidDocument);
      savedDidDocument = await runtimes[0].did.getDidDocument(accounts0Did);
      const getResolver = () => ({
        async resolve() {
          return document as any;
        },
      });

      const verifiedSignature = await didJWT.verifyJWT(
        savedDidDocument.proof.jws,
        { resolver: getResolver() },
      );

      // fails if signed payload and the DID document differ
      const payload = {
        ...verifiedSignature.payload.didDocument,
      };
      expect(payload).not.to.have.property('proof');
    });
  });

  describe('when storing did documents for contract identities', () => {
    const twinDescription = {
      name: 'test twin',
      description: 'twin from test run',
      author: 'evan GmbH',
      version: '0.1.0',
      dbcpVersion: 2,
    };
    before(async () => {
      // Set DID document of testaccount back to normal, or else these tests will fail ( :( )
      const document = await runtimes[0].did.getDidDocumentTemplate();
      await runtimes[0].did.setDidDocument(accounts0Did, document);
    });

    it('allows to store a DID document for the identity of an own contract', async () => {
      const twin = await DigitalTwin.create(
        runtimes[0] as DigitalTwinOptions,
        {
          accountId: runtimes[0].activeAccount,
          containerConfig: null,
          description: twinDescription,
        },
      );
      const twinIdentity = await runtimes[0].verifications.getIdentityForAccount(
        await twin.getContractAddress(), true,
      );
      const twinDid = await runtimes[0].did.convertIdentityToDid(twinIdentity);

      const controllerDid = await runtimes[0].did.convertIdentityToDid(
        runtimes[0].activeIdentity,
      );
      const controllerDidDocument = await runtimes[0].did.getDidDocument(accounts0Did);
      const document = await runtimes[0].did.getDidDocumentTemplate(
        twinDid, controllerDid, [controllerDidDocument.authentication[0]],
      );
      const promise = runtimes[0].did.setDidDocument(twinDid, document);
      await expect(promise).not.to.be.rejected;
    });

    it('can retrieve a contract identities DID document', async () => {
      const twin = await DigitalTwin.create(
        runtimes[0] as DigitalTwinOptions,
        {
          accountId: runtimes[0].activeAccount,
          containerConfig: null,
          description: twinDescription,
        },
      );
      const twinIdentity = await runtimes[0].verifications.getIdentityForAccount(
        await twin.getContractAddress(), true,
      );
      const twinDid = await runtimes[0].did.convertIdentityToDid(twinIdentity);

      const controllerDid = await runtimes[0].did.convertIdentityToDid(
        runtimes[0].activeIdentity,
      );
      const controllerDidDocument = await runtimes[0].did.getDidDocument(accounts0Did);
      const document = await runtimes[0].did.getDidDocumentTemplate(
        twinDid, controllerDid, [controllerDidDocument.authentication[0]],
      );
      await runtimes[0].did.setDidDocument(twinDid, document);
      const retrieved = await runtimes[0].did.getDidDocument(twinDid);

      expect(retrieved.authentication).to.deep.eq(document.authentication);
      expect(retrieved.id).to.eq(document.id);
      expect(retrieved.publicKey).to.deep.eq(document.publicKey);
      expect(retrieved.controller).to.eq(document.controller);
      expect(retrieved).to.have.property('created');
      expect(retrieved).to.have.property('updated');
      expect(retrieved).to.have.property('proof');
    });

    it('allows to get a DID document of another identity', async () => {
      const twin = await DigitalTwin.create(
        runtimes[0] as DigitalTwinOptions,
        {
          accountId: runtimes[0].activeAccount,
          containerConfig: null,
          description: twinDescription,
        },
      );
      const twinIdentity = await runtimes[0].verifications.getIdentityForAccount(
        await twin.getContractAddress(), true,
      );
      const twinDid = await runtimes[0].did.convertIdentityToDid(twinIdentity);

      const controllerDid = await runtimes[0].did.convertIdentityToDid(
        runtimes[0].activeIdentity,
      );
      const controllerDidDocument = await runtimes[0].did.getDidDocument(accounts0Did);
      const document = await runtimes[0].did.getDidDocumentTemplate(
        twinDid, controllerDid, [controllerDidDocument.authentication[0]],
      );
      await runtimes[0].did.setDidDocument(twinDid, document);

      const retrieved = await runtimes[1].did.getDidDocument(twinDid);

      expect(retrieved.authentication).to.deep.eq(document.authentication);
      expect(retrieved.id).to.eq(document.id);
      expect(retrieved.publicKey).to.deep.eq(document.publicKey);
      expect(retrieved.controller).to.eq(document.controller);
    });

    it('does not allow to store a DID document for the identity of a contract I do not own', async () => {
      const twin = await DigitalTwin.create(
        runtimes[0] as DigitalTwinOptions,
        {
          accountId: runtimes[0].activeAccount,
          containerConfig: null,
          description: twinDescription,
        },
      );
      const twinIdentity = await runtimes[0].verifications.getIdentityForAccount(
        await twin.getContractAddress(),
        true,
      );

      const twinDid = await runtimes[0].did.convertIdentityToDid(twinIdentity);

      const controllerDid = await runtimes[0].did.convertIdentityToDid(
        runtimes[0].activeIdentity,
      );
      const controllerDidDocument = await runtimes[0].did.getDidDocument(accounts0Did);
      const document = await runtimes[0].did.getDidDocumentTemplate(
        twinDid, controllerDid, [controllerDidDocument.authentication[0]],
      );
      const runtime1 = runtimes[1];
      const promise = runtime1.did.setDidDocument(twinDid, document);
      await expect(promise).to.be.rejectedWith(/^You are not authorized to issue this Did/);
    });

    // eslint-disable-next-line func-names, consistent-return
    (useVade ? it.skip : it)('allows to fetch a default DID document for newly created contract identities', async () => {
      const accountRuntime = await TestUtils.getRuntime(
        runtimes[0].underlyingAccount, null, runtimeConfig,
      );
      delete accountRuntime.did; // Do not create DID document

      const twin = await DigitalTwin.create(
        accountRuntime as DigitalTwinOptions,
        {
          accountId: accountRuntime.activeAccount,
          containerConfig: null,
          description: twinDescription,
        },
      );
      const twinIdentity = await runtimes[0].verifications.getIdentityForAccount(
        await twin.getContractAddress(), true,
      );
      const did = await runtimes[0].did.convertIdentityToDid(twinIdentity);
      const controllerDid = await runtimes[0].did.convertIdentityToDid(runtimes[0].activeIdentity);
      const controllerDidDoc = await runtimes[0].did.getDidDocument(controllerDid);
      const authKeyIds = controllerDidDoc.publicKey.map((key) => key.id);

      const expectedDefaultDid = {
        '@context': 'https://w3id.org/did/v1',
        id: did,
        controller: controllerDidDoc.id,
        authentication: authKeyIds,
      };
      const defaultDidDoc = await runtimes[0].did.getDidDocument(did);
      await expect(defaultDidDoc).to.deep.eq(expectedDefaultDid);
    });

    (useVade ? describe.skip : describe)('when deactivating DIDs', () => {
      it('allows to deactivate a DID', async () => {
        const twin = await DigitalTwin.create(
          runtimes[0] as DigitalTwinOptions,
          {
            accountId: runtimes[0].activeAccount,
            containerConfig: null,
            description: twinDescription,
          },
        );

        const twinIdentity = await runtimes[0].verifications.getIdentityForAccount(
          await twin.getContractAddress(),
          true,
        );
        const twinDid = await runtimes[0].did.convertIdentityToDid(twinIdentity);
        await runtimes[0].did.deactivateDidDocument(twinDid);

        const deactivated = await runtimes[0].did.didIsDeactivated(twinDid);
        expect(deactivated).to.be.true;
      });

      it('does not allow to deactivate someone else\'s DID', async () => {
        const twin = await DigitalTwin.create(
          runtimes[1] as DigitalTwinOptions,
          {
            accountId: runtimes[1].activeAccount,
            containerConfig: null,
            description: twinDescription,
          },
        );

        const twinIdentity = await runtimes[0].verifications.getIdentityForAccount(
          await twin.getContractAddress(),
          true,
        );
        const twinDid = await runtimes[0].did.convertIdentityToDid(twinIdentity);
        expect(
          runtimes[0].did.deactivateDidDocument(twinDid),
        ).to.eventually.be.rejectedWith('Deactivation failed');
      });

      it('does not allow to deactivate a DID twice', async () => {
        const twin = await DigitalTwin.create(
          runtimes[0] as DigitalTwinOptions,
          {
            accountId: runtimes[0].activeAccount,
            containerConfig: null,
            description: twinDescription,
          },
        );

        const twinIdentity = await runtimes[0].verifications.getIdentityForAccount(
          await twin.getContractAddress(),
          true,
        );
        const twinDid = await runtimes[0].did.convertIdentityToDid(twinIdentity);
        await runtimes[0].did.deactivateDidDocument(twinDid);
        expect(
          runtimes[0].did.deactivateDidDocument(twinDid),
        ).to.eventually.be.rejectedWith('Deactivation failed');
      });

      it('does not allow to set a DID after deactivating it', async () => {
        const twin = await DigitalTwin.create(
          runtimes[0] as DigitalTwinOptions,
          {
            accountId: runtimes[0].activeAccount,
            containerConfig: null,
            description: twinDescription,
          },
        );

        const twinIdentity = await runtimes[0].verifications.getIdentityForAccount(
          await twin.getContractAddress(),
          true,
        );

        const twinDid = await runtimes[0].did.convertIdentityToDid(twinIdentity);
        await runtimes[0].did.deactivateDidDocument(twinDid);
        const dummyDocument = await runtimes[0].did.getDidDocumentTemplate();

        const promise = runtimes[0].did.setDidDocument(twinDid, dummyDocument);
        expect(promise).to.eventually.be.rejectedWith('Cannot set document for deactivated DID');

        // Also check on smart contract level
        const didRegistryContract = await (runtimes[0].did as any).getRegistryContract();

        const contractPromise = runtimes[0].executor.executeContractTransaction(
          didRegistryContract,
          'setDidDocument',
          { from: runtimes[0].activeIdentity },
          twinIdentity,
          TestUtils.getRandomBytes32(),
        );
        expect(contractPromise).to.eventually.be.rejected;
      });
    });
  });

  describe('when storing did documents for alias identities', () => {
    before(async () => {
      // Set DID document of testaccount back to normal, or else these tests will fail ( :( )
      const document = await runtimes[0].did.getDidDocumentTemplate();
      await runtimes[0].did.setDidDocument(accounts0Did, document);
    });

    it('can create did documents for alias identities', async () => {
      const aliasHash = TestUtils.getRandomBytes32();
      const aliasIdentity = await runtimes[0].verifications.createIdentity(
        runtimes[0].underlyingAccount, aliasHash, false,
      );

      const did = await runtimes[0].did.convertIdentityToDid(aliasIdentity);
      const controllerDid = await runtimes[0].did.convertIdentityToDid(
        runtimes[0].activeIdentity,
      );
      const controllerDidDocument = await runtimes[0].did.getDidDocument(accounts0Did);
      const document = await runtimes[0].did.getDidDocumentTemplate(
        did, controllerDid, [controllerDidDocument.authentication[0]],
      );
      const promise = runtimes[0].did.setDidDocument(did, document);

      await expect(promise).not.to.be.rejected;
    });

    it('can create did documents for alias identities without backlinking to given hash', async () => {
      const aliasHash = TestUtils.getRandomBytes32();
      const aliasIdentity = await runtimes[0].verifications.createIdentity(
        runtimes[0].underlyingAccount, aliasHash, false, false,
      );

      const did = await runtimes[0].did.convertIdentityToDid(aliasIdentity);
      const controllerDid = await runtimes[0].did.convertIdentityToDid(
        runtimes[0].activeIdentity,
      );
      const controllerDidDocument = await runtimes[0].did.getDidDocument(accounts0Did);
      const document = await runtimes[0].did.getDidDocumentTemplate(
        did, controllerDid, [controllerDidDocument.authentication[0]],
      );
      const promise = runtimes[0].did.setDidDocument(did, document);

      await expect(promise).not.to.be.rejected;
    });

    it('can fetch did documents for alias identities', async () => {
      const aliasHash = TestUtils.getRandomBytes32();
      const aliasIdentity = await runtimes[0].verifications.createIdentity(
        runtimes[0].underlyingAccount, aliasHash, false,
      );

      const did = await runtimes[0].did.convertIdentityToDid(aliasIdentity);
      const controllerDid = await runtimes[0].did.convertIdentityToDid(
        runtimes[0].activeIdentity,
      );
      const controllerDidDocument = await runtimes[0].did.getDidDocument(accounts0Did);
      const documentTemplate = await runtimes[0].did.getDidDocumentTemplate(
        did, controllerDid, [controllerDidDocument.authentication[0]],
      );
      await runtimes[0].did.setDidDocument(did, documentTemplate);
      const actualDocument = await runtimes[0].did.getDidDocument(did);
      expect(actualDocument.authentication).to.deep.eq(documentTemplate.authentication);
      expect(actualDocument.controller).to.eq(documentTemplate.controller);
      expect(actualDocument.id).to.eq(documentTemplate.id);
      expect(actualDocument).to.have.property('created');
      expect(actualDocument).to.have.property('updated');
      expect(actualDocument).to.have.property('proof');
    });

    // eslint-disable-next-line func-names, consistent-return
    (useVade ? it.skip : it)('can fetch did documents for alias identities that have not set a doc themselves yet', async () => {
      const aliasHash = TestUtils.getRandomBytes32();
      const aliasIdentity = await runtimes[0].verifications.createIdentity(
        runtimes[0].underlyingAccount, aliasHash, false,
      );

      const ownerIdentity = await runtimes[0].verifications
        .getIdentityForAccount(runtimes[0].underlyingAccount, true);
      const controllerDid = await runtimes[0].did.convertIdentityToDid(ownerIdentity);
      const controllerDidDoc = await runtimes[0].did.getDidDocument(controllerDid);
      const did = await runtimes[0].did.convertIdentityToDid(aliasIdentity);
      const authKeyIds = controllerDidDoc.publicKey.map((key) => key.id);

      const expectedDefaultDid = {
        '@context': 'https://w3id.org/did/v1',
        id: did,
        controller: controllerDidDoc.id,
        authentication: authKeyIds,
      };

      const aliasIdentityDid = await runtimes[0].did.getDidDocument(did);
      expect(aliasIdentityDid).to.deep.eq(expectedDefaultDid);
    });
  });

  describe('when testing vade calls directly', async () => {
    const signerIdentity = identities[0].replace('0x', 'did:evan:testcore:0x');
    const signerPrivateKey = accountMap[accounts[0]];
    const didToResolve = signerIdentity;
    const didToWhitelist = signerIdentity;
    let runtime0WithoutVade: Runtime;

    function getOptions(additionalOptions = {}) {
      return JSON.stringify({
        privateKey: signerPrivateKey,
        identity: signerIdentity,
        ...additionalOptions,
      });
    }

    before(async () => {
      runtime0WithoutVade = await TestUtils.getRuntime(accounts[0], null, { useIdentity: true });
      vade = new Vade(vadeConfig);
    });

    it('can whitelist identities', async () => {
      const whitelistPromise = vade.whitelistIdentity(
        didToWhitelist,
        signerPrivateKey,
        signerIdentity,
      );
      await expect(whitelistPromise).not.to.be.rejected;
    });

    it('can properly handling multiple requests with one of them failing', async () => {
      const whitelists = [];

      // fire first request, that will fail
      whitelists.push(vade.whitelistIdentity(
        identities[1].replace('0x', 'did:evan:testcore:0x'), // booom!
        // didToWhitelist,
        signerPrivateKey,
        signerIdentity,
      ));

      // let's wait while we vade
      await new Promise((s) => { setTimeout(s, 1_000); });

      // fire a request, that will succeed
      whitelists.push(vade.whitelistIdentity(
        didToWhitelist,
        signerPrivateKey,
        signerIdentity,
      ));

      let lastFailed;
      let lastSuccess;

      await Promise.all(whitelists.map(async (promise, i) => {
        try {
          await promise;
          lastSuccess = i;
        } catch (_ex) {
          lastFailed = i;
        }
      }));

      expect(lastFailed).to.eq(0);
      expect(lastSuccess).to.eq(1);
    });

    it('can ensure identity whitelisting', async () => {
      const ensureWhitelistedPromise = vade.ensureWhitelisted(
        didToWhitelist,
        signerPrivateKey,
        signerIdentity,
      );
      await expect(ensureWhitelistedPromise).not.to.be.rejected;
    });

    it('can set DID documents', async () => {
      const didDocumentFromChain = await runtime0WithoutVade.did.getDidDocument(accounts0Did);
      const updatePromise = vade.didUpdate(
        didToResolve,
        getOptions({ operation: 'setDidDocument' }),
        JSON.stringify(didDocumentFromChain),
      );

      await expect(updatePromise).not.to.be.rejected;
    });

    it('can get DID documents', async () => {
      const didDocument = await vade.didResolve(didToResolve);
      expect(didDocument).not.to.be.undefined;
      expect(didDocument).not.to.be.empty;
    });

    it('can update DID documents', async () => {
      const newPropertyName = `newPropery-${Math.random()}`;

      const initialDidDocument = await vade.didResolve(didToResolve);
      const didDocumentToSetWithProperty = JSON.parse(initialDidDocument);
      didDocumentToSetWithProperty[newPropertyName] = 'test value';
      await vade.didUpdate(
        didToResolve,
        getOptions({ operation: 'setDidDocument' }),
        JSON.stringify(didDocumentToSetWithProperty),
      );
      const modifiedDidDocument = await vade.didResolve(didToResolve);
      expect(didDocumentToSetWithProperty).to.deep.eq(JSON.parse(modifiedDidDocument));

      const didDocumentToSetWithoutProperty = JSON.parse(modifiedDidDocument);
      delete didDocumentToSetWithoutProperty[newPropertyName];
      await vade.didUpdate(
        didToResolve,
        getOptions({ operation: 'setDidDocument' }),
        JSON.stringify(didDocumentToSetWithoutProperty),
      );

      const restoredDidDocument = await vade.didResolve(didToResolve);
      expect(didDocumentToSetWithoutProperty).to.deep.eq(JSON.parse(restoredDidDocument));
      expect(didDocumentToSetWithoutProperty).to.deep.eq(JSON.parse(initialDidDocument));
    });

    it('can create new DIDs', async () => {
      const didCreatePromise = vade.didCreate('did:evan:testcore', getOptions(), '');
      await expect(didCreatePromise).not.to.be.rejected;

      const newDid = await didCreatePromise;
      expect(newDid).to.match(/^did:evan:testcore:0x[0-9a-f]{64}$/);
    });

    it('can write documents to new DIDs', async () => {
      const newDid = await vade.didCreate('did:evan:testcore', getOptions(), '');

      const initialResponsePromise = vade.didResolve(newDid);
      await expect(initialResponsePromise).to.be.rejected;

      const exampleDidDocument = `{ "id": "${newDid}"}`;
      await vade.didUpdate(
        newDid,
        getOptions({ operation: 'setDidDocument' }),
        exampleDidDocument,
      );
      const updatedDocument = await vade.didResolve(newDid);
      expect(updatedDocument).to.eq(exampleDidDocument);
    });

    it('retrieves the same DID document with vade as with `getDidDocument`', async () => {
      const didDocumentFromApi = await runtimes[0].did.getDidDocument(accounts0Did);
      const didDocumentFromVade = await vade.didResolve(didDocumentFromApi.id);
      expect(didDocumentFromApi).to.deep.eq(JSON.parse(didDocumentFromVade));
    });

    it('can update DID documents with API and get them with vade', async () => {
      const didDocumentFromApi1 = await runtimes[0].did.getDidDocument(accounts0Did);
      await runtimes[0].did.setDidDocument(accounts0Did, didDocumentFromApi1);

      const didDocumentFromApi2 = await runtimes[0].did.getDidDocument(accounts0Did);
      expect(didDocumentFromApi2.updated).to.not.eq(didDocumentFromApi1.updated);

      const didDocumentFromVade = JSON.parse(await vade.didResolve(accounts0Did));

      expect(didDocumentFromVade).to.deep.eq(didDocumentFromApi2);

      // restore DID document
      didDocumentFromApi1.updated = '2022-22-22T22:22:22.222Z';
      delete didDocumentFromApi1.proof;
      await runtimes[0].did.setDidDocument(accounts0Did, didDocumentFromApi1);
    });
  });
});
