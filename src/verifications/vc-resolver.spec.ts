import { expect } from 'chai';
import { accounts } from '../test/accounts';
import { TestUtils } from '../test/test-utils';
import { Runtime } from '../index';
import { Verifications } from './verifications';
import { DidResolver, DidResolverDocumentTemplate } from '../did/did-resolver';

/**
 * What to test:
 *  - Setting a verification and creating a VC from it
 *  - Creating a VC from someone else's verification
 *  - Proof validity
 *  - Encrypted payload data VC valid
 *  - VC Storage
 */

describe('DID Resolver', function() {
  this.timeout(600000);
  let runtime: Runtime;
  let verifications: Verifications;
  const issuer = accounts[0];
  const subject = accounts[1];

  before(async () => {
    runtime = await TestUtils.getRuntime(accounts[0], null, { useIdentity: true });
    verifications = await TestUtils.getVerifications(runtime.web3, await TestUtils.getIpfs());
  });

  describe('When creating verifications', async () => {
    it('allows to export them as VCs', async () => {
      const topic = '/company'

      const newVerification = await verifications.setVerification(issuer, subject, topic);
      const verification = (await verifications.getVerifications(subject, topic))
        .filter((ver) => ver.id === newVerification)[0];
      const vc = await runtime.vcResolver.createVCFromVerification(verification);

      expect(runtime.didResolver.convertDidToIdentity(vc.issuer.id)).to.eq(issuer);
      expect(runtime.didResolver.convertDidToIdentity(vc.credentialSubject.id)).to.eq(subject);
      expect(vc.credentialSubject.credential).to.eq(topic);
    });
  });
});
