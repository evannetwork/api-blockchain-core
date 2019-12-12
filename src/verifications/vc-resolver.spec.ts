import { expect } from 'chai';
import { accounts } from '../test/accounts';
import { TestUtils } from '../test/test-utils';
import { Runtime } from '../index';
import { VCResolver } from './vc-resolver'
import { Verifications } from './verifications';
import { DidResolver } from '../did/did-resolver';

/**
 * What to test:
 *  - Setting a verification and creating a VC from it
 *  - Creating a VC from someone else's verification
 *  - Proof validity
 *  - Encrypted payload data VC valid
 *  - VC Storage
 */

describe('VC Resolver', function() {
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
      const newVerification = await verifications.setVerification(issuer, subject, '/company');
      const verification = (await verifications.getVerifications(subject, '/company'))
        .filter((ver) => ver.id === newVerification)[0];
      const vc = await runtime.vcResolver.createVCFromVerification(verification);

      // Create verification
      // Create VC for verification
    });
  });
});
