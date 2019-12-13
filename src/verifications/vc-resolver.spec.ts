import { expect } from 'chai';
import { accounts } from '../test/accounts';
import { TestUtils } from '../test/test-utils';
import { Runtime } from '../index';
import { Verifications } from './verifications';

describe('DID Resolver', function() {
  this.timeout(600000);
  let runtime: Runtime;
  let verifications: Verifications;
  const issuerAccountId = accounts[0];
  const subjectAccountId = accounts[1];
  let issuerIdentityId;
  let subjectIdentityId;

  before(async () => {
    runtime = await TestUtils.getRuntime(accounts[0], null, { useIdentity: true });
    verifications = await TestUtils.getVerifications(runtime.web3, await TestUtils.getIpfs());
    issuerIdentityId = await verifications.getIdentityForAccount(issuerAccountId, true);
    subjectIdentityId = await verifications.getIdentityForAccount(subjectAccountId, true);
  });

  describe('When creating a verification', async () => {
    it('allows to export them as valid VC', async () => {
      const topic = '/company'

      const newVerification = await verifications.setVerification(issuerAccountId, subjectAccountId, topic);

      const verification = (await verifications.getNestedVerificationsV2(subjectAccountId, topic))
        .verifications.filter((ver) => ver.details.id === newVerification)[0];

      const vc = await runtime.vcResolver.createVCFromVerification(verification);

      expect(await runtime.didResolver.convertDidToIdentity(vc.issuer.id)).to.eq(issuerIdentityId);
      expect(await runtime.didResolver.convertDidToIdentity(vc.credentialSubject.id)).to.eq(subjectIdentityId);
      expect(vc.credentialSubject.credential).to.eq(topic);
    });
  });
});
