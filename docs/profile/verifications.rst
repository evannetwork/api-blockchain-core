================================================================================
Verifications
================================================================================

.. list-table::
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - Verifications
   * - Extends
     - `Logger <../common/logger.html>`_
   * - Source
     - `verifications.ts <https://github.com/evannetwork/api-blockchain-core/blob/master/src/verifications/verifications.ts>`_
   * - Tests
     - `verifications.spec.ts <https://github.com/evannetwork/api-blockchain-core/blob/master/src/verifications/verifications.spec.ts>`_

The ``Verifications`` module allows to

- issue verifications about oneself or about other parties
- confirm or delete verifications about oneself

Verifications have a pattern similar to file paths, a verification for an account called "foo" being an employee of a company called "bar" may look like this:

``/company/bar/employee``

Under this "path" a set of values can be found. These value describe the verification, the subject of the verification and optional its response to it. Basically an ``issuer`` creates a ``verification`` about a ``subject`` The values are:

- ``verification (name)``
  full path to a verification, for example ``/company/bar/employee/foo``,
  settable by the ``subject`` of the parent verification ``/company/bar/employee``
- ``subject``
  an account, a verification has been issued for, can be a group/wallet or an externally owned account
  being the ``subject`` of a ``verification`` basically means to be the owner of the verification and allows to create subverifications below the own verification path
- ``issuer``
  an account (group/wallet or externally owned) that creates a verification,
  to be able to issue a verification, the ``issuer`` has to be the ``subject`` of the parent verification ``/company/bar/employee``
- ``data``
  The hash of the verification data, sitting in another location, a bit-mask, call data, or actual data based on the verification scheme.
- ``uri``
  The location of the verification, this can be HTTP links, swarm hashes, IPFS hashes, and such.
- ``status``
  this represents a ``verifications`` status,
  values are ``uint8`` range from 0 to 255, the currently used values are:
  - 0: Issued
  - 1: Confirmed
- ``signature``
  Signature which is the proof that the verification issuer issued a verification of topic for this identity.
  It MUST be a signed message of the following structure: keccak256(address identityHolder_address, uint256 _ topic, bytes data)
- ``creationDate``
  creationDate of the verification
- ``id``
  id of the current verification
- ``valid``
  check if the verification has a valid signature

For a explanation on how to use verification API, possible flows and meaning of the results have a look at the :doc:`verifications usage example <verification-usage-examples>`.



--------------------------------------------------------------------------------

.. _verifications_constructor:

constructor
================================================================================

.. code-block:: typescript

  new Verifications(options);

Creates a new Verifications instance.

Note, that the option properties ``registry`` and ``resolver`` are optional but should be provided
in most cases. As the module allows to create an own ENS structure, that includes an own ENS
registry and an own default resolver for it, setting them beforehand is optional.

----------
Parameters
----------

#. ``options`` - ``VerificationsOptions``: options for Verifications constructor.
    * ``accountStore`` - |source accountStore|_: |source accountStore|_ instance
    * ``config`` - ``any``: config object with |source nameResolver|_ config
    * ``contractLoader`` - |source contractLoader|_: |source contractLoader|_ instance
    * ``description`` - |source description|_: |source description|_ instance
    * ``dfs`` - |source dfsInterface|_: |source dfsInterface|_ instance
    * ``executor`` - |source executor|_: |source executor|_ instance
    * ``nameResolver`` - |source nameResolver|_: |source nameResolver|_ instance
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``
    * ``registry`` - ``string`` (optional): contract address of the identity storage registry
    * ``storage`` - ``string`` (optional): contract address of the identity storage registry

-------
Returns
-------

``Verifications`` instance

-------
Example
-------

.. code-block:: typescript

  const verifications = new Verifications({
    accountStore,
    config,
    contractLoader,
    description,
    dfs,
    executor,
    nameResolver,
    storage: '0x0000000000000000000000000000000000000001',
  });



--------------------------------------------------------------------------------

.. _verifications_updateConfig:

updateConfig
================================================================================

.. code-block:: typescript

  verifications.updateConfig([options[, config]]);

Merge given partial options and config into current options and config.

This function is mainly used to decouple the creation process of required libraries by setting at a later point of time.



----------
Parameters
----------

#. ``options`` - ``Partial<VerificationsOptions>`` (optional): updates for options
#. ``config`` - ``Partial<VerificationsConfig>`` (optional): updates for config

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  // create initial instance of `Verifications`, that is missing `Vc` and `Did` instances
  const verifications = new Verifications({
    accountStore,
    config,
    contractLoader,
    description,
    dfs,
    executor,
    nameResolver,
    storage: '0x0000000000000000000000000000000000000001',
  });

  // required libraries and config values are are created by other logic
  const { activeIdentity, did, vc, underlyingAccount } = await someHelper();

  // now update setup
  verifications.updateConfig({ did, vc }, { activeIdentity, underlyingAccount });



--------------------------------------------------------------------------------

= Issuers =
==========================

.. _verifications_createIdentity:

createIdentity
================================================================================

.. code-block:: typescript

  verifications.createIdentity(accountId[, contractId, updateDescription]);

Creates a new identity for account or contract and registers them on the storage. Returned identity is either a 20B contract address (for account identities) or a 32B identity hash contract identities.

----------
Parameters
----------

#. ``accountId`` - ``string``: account that runs transaction, receiver of identity when omitting the other arguments
#. ``contractId`` - ``string``: (optional) contract address to create the identity for, creates account identity for ``accountId`` if omitted
#. ``updateDescription`` - ``boolean`` (optional): update description of contract, defaults to ``true``

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const identity = await verifications.createIdentity(accounts[0]);
  console.log(identity);
  // Output:
  // 0x1fE5F7235f1989621135466Ff8882287C63A5bae



--------------------------------------------------------------------------------

.. _verifications_identityAvailable:

identityAvailable
================================================================================

.. code-block:: typescript

  verifications.identityAvailable(subject);

Checks if a account has already an identity contract.

----------
Parameters
----------

#. ``subject`` - ``string``: target subject to check

-------
Returns
-------

``Promise`` returns ``boolean``: true if identity exists, otherwise false

-------
Example
-------

.. code-block:: typescript

  console.log(await verifications.identityAvailable(accounts[0]);
  // Output:
  // false

  await  await verifications.createIdentity(accounts[0]);

  console.log(await verifications.identityAvailable(accounts[0]);
  // Output:
  // true



--------------------------------------------------------------------------------

.. _verifications_getOwnerAddressForIdentity:

getOwnerAddressForIdentity
================================================================================

.. code-block:: typescript

  verifications.getOwnerAddressForIdentity(identityAddress);

Gets an identity's owner's address. This can be either an account or an identity address.


----------
Parameters
----------

#. ``identityAddress`` - ``string``: The identity address to look up the owner for. Works with both 20 bytes and 32 bytes addresses.

-------
Returns
-------

``Promise`` returns ``string``: address of the owning account

-------
Example
-------

.. code-block:: typescript

  const ownerAddress = await verifications.getOwnerAddressForIdentity('0x16a2e6af9cf78ddf6a170f38fceacca6bfdcd68b');
  console.log(`The owner is ${ownerAddress}`);
  // The owner is 0x001de828935e8c7e4cb56fe610495cae63fb2612



--------------------------------------------------------------------------------

.. _verifications_getIdentityForAccount:

getIdentityForAccount
================================================================================

.. code-block:: typescript

  verifications.getIdentityForAccount(subject);

Gets the identity contract for a given account id or contract.

----------
Parameters
----------

#. ``subject`` - ``string``: target subject to get identity for

-------
Returns
-------

``Promise`` returns ``any``: identity contract instance

-------
Example
-------

.. code-block:: typescript

  const identityContract = await verifications.getIdentityForAccount(accounts[0]);



--------------------------------------------------------------------------------

.. _verifications_setVerification:

setVerification
================================================================================

.. code-block:: typescript

  verifications.setVerification(issuer, subject, topic, expirationDate, verificationValue, descriptionDomain, disableSubVerifications);

Sets or creates a verification; this requires the issuer to have permissions for the parent verification (if verification name seen as a path, the parent 'folder').

The "verificationValue" field can also be set to a custom JSON object with any data. For example DID, VC's, documents or any other custom value you want to attach to the verification.

----------
Parameters
----------

#. ``issuer`` - ``string``: issuer of the verification
#. ``subject`` - ``string``: subject of the verification and the owner of the verification node
#. ``topic`` - ``string``: name of the verification (full path)
#. ``expirationDate`` - ``number`` (optional): expiration date, for the verification, defaults to ``0`` (does not expire)
#. ``verificationValue`` - ``any`` (optional): json object which will be stored in the verification
#. ``descriptionDomain`` - ``string`` (optional): domain of the verification, this is a subdomain under 'verifications.evan', so passing 'example' will link verifications description to 'example.verifications.evan', unset if omitted
#. ``disableSubVerifications`` - ``boolean`` (optional): invalidate all verifications that gets issued as children of this verification (warning will include the disableSubVerifications warning)
#. ``isIdentity`` - ``boolean`` (optional): boolean value if the subject is already a identity address (default false)
#. ``uri`` - ``string`` (optional): adds a specific URI to the verification

-------
Returns
-------

``Promise`` returns ``string``: id of new verification

-------
Example
-------

.. code-block:: typescript

  // accounts[0] issues verification '/company' for accounts[1]
  const firstVerification = await verifications.setVerification(accounts[0], accounts[1], '/company');

  // accounts[0] issues verification '/companyData' for accounts[1] with additional data attached
  const secondVerification = await verifications.setVerification(accounts[0], accounts[1], '/companyData', 0, {
    additionalDocument: <binary buffer>
    vcDid: {
      "@context": [
        "https://www.w3.org/2018/credentials/v1",
        "https://www.w3.org/2018/credentials/examples/v1"
      ],
      "id": "http://example.edu/credentials/3732",
      "type": ["VerifiableCredential", "UniversityDegreeCredential"],
      "credentialSubject": {
        "id": "did:example:ebfeb1f712ebc6f1c276e12ec21",
        "degree": {
          "type": "BachelorDegree",
          "name": "Bachelor of Science and Arts"
        }
      },
      "proof": {  }
    }
  });

  // accounts[0] issues verification '/company' for accounts[1], sets an expiration date
  // and links to description domain 'sample'
  const thirdVerification = await verifications.setVerification(
    accounts[0], accounts[1], '/company', expirationDate, verificationValue, 'example');



--------------------------------------------------------------------------------

.. _verifications_setVerificationAndVc:

setVerification
================================================================================

.. code-block:: typescript

  verifications.setVerificationAndVc(issuer, subject, topic, expirationDate, verificationValue, descriptionDomain, disableSubVerifications);

Sets or creates a verification along with a verifiable credential; the verification creation requires the issuer to have permissions for the parent verification (if verification name seen as a path, the parent 'folder').

The "verificationValue" field can also be set to a custom JSON object with any data. The verificationValue works as same as in the setVerification function however in this function it is also added to the VC document.

----------
Parameters
----------

#. ``issuer`` - ``string``: issuer of the verification
#. ``subject`` - ``string``: subject of the verification and the owner of the verification node
#. ``topic`` - ``string``: name of the verification (full path)
#. ``expirationDate`` - ``number`` (optional): expiration date, for the verification, defaults to ``0`` (does not expire)
#. ``verificationValue`` - ``any`` (optional): json object which will be stored in the verification
#. ``descriptionDomain`` - ``string`` (optional): domain of the verification, this is a subdomain under 'verifications.evan', so passing 'example' will link verifications description to 'example.verifications.evan', unset if omitted
#. ``disableSubVerifications`` - ``boolean`` (optional): invalidate all verifications that gets issued as children of this verification (warning will include the disableSubVerifications warning)
#. ``isIdentity`` - ``boolean`` (optional): boolean value if the subject is already a identity address (default false)
#. ``uri`` - ``string`` (optional): adds a specific URI to the verification

-------
Returns
-------

``Promise`` returns ``string``: verificationId and vcId

-------
Example
-------

.. code-block:: typescript

  // accounts[0] issues verification '/company' for accounts[1]
  const verification = verifications.setVerificationAndVc(accounts[0], accounts[1], '/company');

``{ vcId:
   'vc:evan:testcore:0x9becd31c7e5b6a1fe8ee9e76f1af56bcf84b6718548dbdfd1412f935b515ebe0',
  verificationId:
   '0x5373812c3cba3fdee77730a45e7bd05cf52a5f2195abf1f623a9b22d94cea939' };``




--------------------------------------------------------------------------------

.. _verifications_getVerifications:

getVerifications
================================================================================

.. code-block:: typescript

  verifications.getVerifications(subject, topic, isIdentity]);

Gets verification information for a verification name from a given account; results has the following properties: creationBlock, creationDate, data, description, expirationDate, id, issuer, name, signature, status, subject, topic, uri, valid.

----------
Parameters
----------

#. ``subject`` - ``string``: subject of the verifications
#. ``topic`` - ``string``: name (/path) of a verification
#. ``isIdentity`` - ``string`` (optional): indicates if the subject is already an identity

-------
Returns
-------

``Promise`` returns ``any[]``: verification info array,

Verifications have the following properties:

#. ``creationBlock`` - ``string``: block number at which verification was issued
#. ``creationDate`` - ``string``: UNIX timestamp (in seconds), at which verification was issued
#. ``data`` - ``string``: 32Bytes hash of data stored in DFS
#. ``description`` - ``any``: DBCP description
#. ``disableSubVerifications`` - ``boolean``: ``true`` if this verification does not allow verifications at subtopics
#. ``expirationDate`` - ``string``: ``string``: UNIX timestamp (in seconds), null if verification does not expire
#. ``expired`` - ``boolean``: ticket expiration state
#. ``id`` - ``string``: 32Bytes id of verification
#. ``issuer`` - ``string``: account address of issuers identity contract
#. ``name`` - ``string``: topic of verification
#. ``rejectReason`` - ``any``: object with information from subject about rejection
#. ``signature`` - ``string``: arbitrary length hex string with signature of verification data, signed by issuer
#. ``status`` - ``number``: 0 (Issued) || 1 (Confirmed) || 2 (Rejected)
#. ``subject`` - ``string``: accountId of subject
#. ``topic`` - ``string``: keccak256 hash of the topic name, converted to uint256
#. ``uri`` - ``string``: link to ipfs file of data
#. ``valid`` - ``boolean``: ``true`` if issuer has been correctly confirmed as the signer of ``signature`` and if ``signature`` is related to ``subject``, ``topic`` and ``data``

-------
Example
-------

.. code-block:: typescript

  const verificationId = await verifications.setVerification(
    accounts[0], accounts[1], '/example1');
  console.log(verificationId);
  // Output:
  // 0xb4843ed5177433312dd2c7c4f8065ce84f37bf96c04db2775c16c9455ad96270

  const issued = await verifications.getVerifications(accounts[1], '/example1');
  console.dir(issued);
  // Output:
  // [ {
  //   creationBlock: '186865',
  //   creationDate: '1558599441',
  //   data: '0x0000000000000000000000000000000000000000000000000000000000000000',
  //   description: null,
  //   disableSubVerifications: false,
  //   expirationDate: null,
  //   expired: false,
  //   id: '0xb4843ed5177433312dd2c7c4f8065ce84f37bf96c04db2775c16c9455ad96270',
  //   issuer: '0xe560eF0954A2d61D6006E8547EC769fAc322bbCE',
  //   name: '/example1',
  //   rejectReason: undefined,
  //   signature: '0x6a2b41714c1faac09a5ec06024c8931ad6e3aa902c502e3d1bc5d5c4577288c04e9be136c149b569e0456dfec9d50a2250bf405443ae9bccd460c49a2c4287df1b',
  //   status: 0,
  //   subject: '0x0030C5e7394585400B1FB193DdbCb45a37Ab916E',
  //   topic: '34884897835812838038558016063403566909277437558805531399344559176587016933548',
  //   uri: '',
  //   valid: true
  // } ]



--------------------------------------------------------------------------------

.. _verifications_getNestedVerifications:

getNestedVerifications
================================================================================

.. code-block:: typescript

  getNestedVerifications(subject, topic, isIdentity);

Get all the verifications for a specific subject, including all nested verifications for a deep integrity check.

----------
Parameters
----------

#. ``subject`` - ``string``: subject to load the verifications for.
#. ``topic`` - ``string``: topic to load the verifications for.
#. ``isIdentity`` - ``boolean``: optional indicates if the subject is already a identity

-------
Returns
-------

``Promise`` returns ``Array<any>``: all the verifications with the following properties.

-------
Example
-------

.. code-block:: typescript

  const nestedVerifications = await getNestedVerifications('0x123...', '/test')

  // will return
  [
    {
      // creator of the verification
      issuer: '0x1813587e095cDdfd174DdB595372Cb738AA2753A',
      // topic of the verification
      name: '/company/b-s-s/employee/swo',
      // -1: Not issued => no verification was issued
      // 0: Issued => status = 0, warning.length > 0
      // 1: Confirmed => issued by both, self issued state is 2, values match
      status: 2,
      // verification for account id / contract id
      subject: subject,
      // ???
      value: '',
      // ???
      uri: '',
      // ???
      signature: ''
      // icon for cards display
      icon: 'icon to display',
      // if the verification was rejected, a reject reason could be applied
      rejectReason: '' || { },
      // subjec type
      subjectType: 'account' || 'contract',
      // if it's a contract, it can be an contract
      owner: 'account' || 'contract',: 'account' || 'contract',
      // warnings
      [
        // parent verification does not allow subverifications
        'disableSubVerifications',
        // verification has expired
        'expired',
        // signature does not match requirements, this could be because it hasn't been signed by
        // correct account or underlying checksum does not match
        // ``subject``, ``topic`` and ``data``
        'invalid',
        // verification has been issued, but not accepted or rejected by subject
        'issued',
        // verification has not been issued
        'missing',
        // given subject has no identity
        'noIdentity',
        // verification path has a trusted root verification topic, but this verification is not
        // signed by a trusted instance
        'notEnsRootOwner',
        // parent verification is missing in path
        'parentMissing',
        // verification path cannot be traced back to a trusted root verification
        'parentUntrusted',
        // verification has been issued and then rejected by subject
        'rejected',
        // verification issuer is the same account as the subject
        'selfIssued',
      ],
      parents: [ ... ],
      parentComputed: [ ... ]
    }
  ]




--------------------------------------------------------------------------------

.. _verifications_getNestedVerificationsV2:

getNestedVerificationsV2
================================================================================

.. code-block:: typescript

  getNestedVerificationsV2(subject, topic[, isIdentity, queryOptions]);

Get verifications and their parent paths for a specific subject, then format it to updated result format.

----------
Parameters
----------

#. ``subject`` - ``string``: subject (account/contract or identity)
#. ``topic`` - ``string``: topic (verification name) to check
#. ``isIdentity`` - ``boolean``: true if subject is identity
#. ``queryOptions`` - ``VerificationsQueryOptions``: options for query and status computation

-------
Returns
-------

``Promise`` returns ``VerificationsResultV2``: verification result object with status, verification data and tree

-------
Example
-------

.. code-block:: typescript

  const validationOptions: VerificationsValidationOptions = {
    disableSubVerifications: VerificationsStatusV2.Red,
    expired:                 VerificationsStatusV2.Red,
    invalid:                 VerificationsStatusV2.Red,
    issued:                  VerificationsStatusV2.Yellow,
    missing:                 VerificationsStatusV2.Red,
    noIdentity:              VerificationsStatusV2.Red,
    notEnsRootOwner:         VerificationsStatusV2.Yellow,
    parentMissing:           VerificationsStatusV2.Yellow,
    parentUntrusted:         VerificationsStatusV2.Yellow,
    rejected:                VerificationsStatusV2.Red,
    selfIssued:              VerificationsStatusV2.Yellow,
  };
  const queryOptions: VerificationsQueryOptions = {
    validationOptions: validationOptions,
  };
  const nestedVerificationsV2 = await verifications.getNestedVerificationsV2(
    accounts[1], '/example1', false, queryOptions);
  console.dir(nestedVerificationsV2);
  // Output:
  // { verifications:
  //    [ { details:
  //         { creationDate: 1561722858000,
  //           ensAddress:
  //            '4d2027082fdec4ee253363756eccb1b5492f61fb6329f25d8a7976d7909c10ac.example1.verifications.evan',
  //           id:
  //            '0x855a3c10b9cd6d42da5fd5e9b61e0f98a5af79b1acbfee57a9e4f3c9721f9c5d',
  //           issuer: '0x5035aEe29ea566F3296cdD97C29baB2b88C17c25',
  //           issuerIdentity: '0xD2860FeC7A198A646f9fD1207B59aD42f00c3189',
  //           subject: '0x9aE6533e7a2C732863C0aF792D5EA358518cd757',
  //           subjectIdentity: '0x9F870954c615E4457660D22BE0F38FE0200b1Ed9',
  //           subjectType: '0x9F870954c615E4457660D22BE0F38FE0200b1Ed9',
  //           topic: '/example1',
  //           status: 'green' },
  //        raw:
  //         { creationBlock: '224038',
  //           creationDate: '1561722858',
  //           data:
  //            '0x0000000000000000000000000000000000000000000000000000000000000000',
  //           disableSubVerifications: false,
  //           signature:
  //            '0x941f316d77f5c1dc8b38000ecbb60304554ee2fb36453487ef7822ce6d8c7ce5267bb62396cfb08191028099de2e28d0ffd4012608e8a622e9e7a6a9570a88231b',
  //           status: 1,
  //           topic:
  //            '34884897835812838038558016063403566909277437558805531399344559176587016933548' },
  //        statusFlags: [] } ],
  //   levelComputed:
  //    { subjectIdentity: '0x9F870954c615E4457660D22BE0F38FE0200b1Ed9',
  //      subjectType: 'account',
  //      topic: '/example1',
  //      subject: '0x9aE6533e7a2C732863C0aF792D5EA358518cd757' },
  //   status: 'green' }


--------------------------------------------------------------------------------

.. _verifications_computeVerifications:

computeVerifications
================================================================================

.. code-block:: typescript

  bcService.computeVerifications(topic, verifications);

Takes an array of verifications and combines all the states for one quick view.

----------
Parameters
----------

#. ``topic`` - ``string``: topic of all the verifications
#. ``verifications`` - ``Array<any>``: all verifications of a specific topic

-------
Returns
-------

``any``: computed verification including latest creationDate,  displayName

-------
Example
-------
.. code-block:: typescript

  // load all sub verifications
  verification.parents = await verifications.getNestedVerifications(verification.issuerAccount, verification.parent || '/', false);

  // use all the parents and create a viewable computed tree
  const computed = verifications.computeVerifications(verification.topic, verification.parents)

  // returns =>
  //   const computed:any = {
  //     verifications: verifications,
  //     creationDate: null,
  //     displayName: topic.split('/').pop() || 'evan',
  //     loading: verifications.filter(verification => verification.loading).length > 0,
  //     name: topic,
  //     status: -1,
  //     subjects: [ ],
  //     warnings: [ ],
  //   }



--------------------------------------------------------------------------------

.. _verifications_getComputedVerification:

getComputedVerification
================================================================================

.. code-block:: typescript

  getComputedVerification(subject, topic, isIdentity);

Loads a list of verifications for a topic and a subject and combines to a single view for a simple verification status check, by combining ``getNestedVerifications`` with ``computeVerifications``.

----------
Parameters
----------

#. ``subject`` - ``string``: subject to load the verifications for.
#. ``topic`` - ``string``: topic to load the verifications for.
#. ``isIdentity`` - ``boolean``: optional indicates if the subject is already a identity

-------
Returns
-------

``any``: computed verification including latest creationDate,  displayName

-------
Example
-------
.. code-block:: typescript

  // use all the parents and create a viewable computed tree
  const computed = verifications.getComputedVerification(subject, topic)

  // returns =>
  //   const computed:any = {
  //     verifications: verifications,
  //     creationDate: null,
  //     displayName: topic.split('/').pop() || 'evan',
  //     loading: verifications.filter(verification => verification.loading).length > 0,
  //     name: topic,
  //     status: -1,
  //     subjects: [ ],
  //     warnings: [ ],
  //   }



--------------------------------------------------------------------------------

.. _verifications_validateVerification:

validateVerification
================================================================================

.. code-block:: typescript

  verifications.validateVerification(subject, verificationId, isIdentity]);

validates a given verificationId in case of integrity

----------
Parameters
----------

#. ``subject`` - ``string``: subject of the verifications
#. ``verificationId`` - ``string``: The verification identifier
#. ``isIdentity`` - ``boolean`` (optional): indicates if the subject is already an identity, defaults to ``false``

-------
Returns
-------

``Promise`` returns ``boolean``: resolves with true if the verification is valid, otherwise false

-------
Example
-------

.. code-block:: typescript

  console.dir(await verifications.validateVerification(
    accounts[1]),
    '0x0000000000000000000000000000000000000000000000000000000000000000',
  );
  // Output:
  true



--------------------------------------------------------------------------------

.. _verifications_deleteVerification:

deleteVerification
================================================================================

.. code-block:: typescript

  verifications.deleteVerification(accountId, subject, verificationId[, isIdentity]);

Delete a verification. This requires the **accountId** to have permissions for the parent verification (if verification name seen as a path, the parent 'folder'). Subjects of a verification may only delete it, if they are the issuer as well. If not, they can only react to it by confirming or rejecting the verification.

----------
Parameters
----------

#. ``accountid`` - ``string``: account, that performs the action
#. ``subject`` - ``string``: the subject of the verification
#. ``verificationId`` - ``string``: id of a verification to delete
#. ``isIdentity`` - ``bool`` (optional): ``true`` if given ``subject`` is an identity, defaults to ``false``

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const verificationId = await verifications.setVerification(accounts[0], accounts[1], '/company');
  await verifications.deleteVerification(accounts[0], accounts[1], verificationId);



--------------------------------------------------------------------------------

= Subjects =
==========================

.. _verifications_confirmVerification:

confirmVerification
================================================================================

.. code-block:: typescript

  verifications.confirmVerification(accountId, subject, verificationId[, isIdentity]);

Confirms a verification; this can be done, if a verification has been issued for a subject and the subject wants to confirm it.

----------
Parameters
----------

#. ``accountId`` - ``string``: account, that performs the action
#. ``subject`` - ``string``: verification subject
#. ``verificationId`` - ``string``: id of a verification to confirm
#. ``isIdentity`` - ``bool`` (optional): ``true`` if given ``subject`` is an identity, defaults to ``false``

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const newVerification = await verifications.setVerification(accounts[0], accounts[1], '/company');
  await verifications.confirmVerification(accounts[0], accounts[1], newVerification);



--------------------------------------------------------------------------------

.. _verifications_rejectVerification:

rejectVerification
================================================================================

.. code-block:: typescript

  verifications.rejectVerification(accountId, subject, verificationId[, rejectReason, isIdentity]);

Reject a Verification. This verification will be marked as rejected but not deleted. This is important for tracking reasons. You can also optionally add a reject reason as JSON object to track additional informations about the rejection. Issuer and Subject can reject a special verification.

----------
Parameters
----------

#. ``accountid`` - ``string``: account, that performs the action
#. ``subject`` - ``string``: the subject of the verification
#. ``verificationId`` - ``string``: id of a verification to delete
#. ``rejectReason`` - ``object`` (optional): JSON Object of the rejection reason
#. ``isIdentity`` - ``bool`` (optional): ``true`` if given ``subject`` is an identity, defaults to ``false``

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const verificationId = await verifications.setVerification(accounts[0], accounts[1], '/company');
  await verifications.rejectVerification(accounts[0], accounts[1], verificationId, { rejected: "because not valid anymore"});



--------------------------------------------------------------------------------

= Delegated Verifications =
===========================

.. _verifications_signSetVerificationTransaction:

signSetVerificationTransaction
================================================================================

.. code-block:: typescript

  verifications.signSetVerificationTransaction(issuer, subject, topic[, expirationDate, verificationValue, descriptionDomain, disableSubVerifications, isIdentity, executionNonce]);

Signs a verification (offchain) and returns data, that can be used to submit it later on. Return value can be passed to ``executeVerification``.

Note that, when creating multiple signed verification transactions, the ``nonce`` argument **has to be specified and incremented between calls**, as the nonce is included in transaction data and restricts the order of transactions, that can be made.

----------
Parameters
----------

#. ``issuer`` - ``string``: issuer of the verification
#. ``subject`` - ``string``: subject of the verification and the owner of the verification node
#. ``topic`` - ``string``: name of the verification (full path)
#. ``expirationDate`` - ``number`` (optional): expiration date, for the verification, defaults to ``0`` (does not expire)
#. ``verificationValue`` - ``any`` (optional): json object which will be stored in the verification
#. ``descriptionDomain`` - ``string`` (optional): domain of the verification, this is a subdomain under 'verifications.evan', so passing 'example' will link verifications description to 'example.verifications.evan', unset if omitted
#. ``disableSubVerifications`` - ``boolean`` (optional): invalidate all verifications that gets issued as children of this verification (warning will include the disableSubVerifications warning)
#. ``isIdentity`` - ``boolean`` (optional): true if given subject is identity, defaults to ``false``
#. ``executionNonce`` - ``number`` (optional): current execution nonce of issuer identity contract, defaults to ``-1`` (fetch dynamically)
#. ``uri`` - ``string`` (optional): adds a specific URI to the verification

-------
Returns
-------

``Promise`` returns ``VerificationsDelegationInfo``: data for submitting delegated verifications

-------
Example
-------

.. code-block:: typescript

  // accounts[0] wants to issue a verification for accounts[1] via delegation
  const txInfo = await verifications.signSetVerificationTransaction(
    accounts[0], accounts[1], '/company');



--------------------------------------------------------------------------------

.. _verifications_executeVerification:

executeVerification
================================================================================

.. code-block:: typescript

  verifications.executeVerification(accountId, txInfo);

Executes a pre-signed verification transaction with given account.
This account will be the origin of the transaction and not of the verification.
Second argument is generated with ``signSetVerificationTransaction``.

----------
Parameters
----------

#. ``accountId`` - ``string``: account, that submits the transaction
#. ``txInfo`` - ``VerificationsDelegationInfo``: information with verification tx data

-------
Returns
-------

``Promise`` returns ``string``: id of new verification

-------
Example
-------

.. code-block:: typescript

  // accounts[0] wants to issue a verification for accounts[1] via delegation
  const txInfo = await verifications.signSetVerificationTransaction(
    accounts[0], accounts[1], '/company');

  // accounts[2] submits transaction, that actually issues verification
  const verificationId = await verifications.executeVerification(accounts[2], txInfo);



--------------------------------------------------------------------------------

.. _verifications_getExecutionNonce:

getExecutionNonce
================================================================================

.. code-block:: typescript

  verifications.getExecutionNonce(issuer[, isIdentity]);

Gets current execution nonce for an identity or an accounts identity.

Nonce is returned as ``string``. When using nonces for preparing multiple transactions, small nonces can just be parsed to a number and then incremented as needed. Consider using BigNumber or similar modules to deal with large numbers if required.

----------
Parameters
----------

#. ``issuer`` - ``string``: account or identity to get execution nonce for
#. ``isIdentity`` - ``boolean`` (optional): true if given issuer is an identity, defaults to ``false``

-------
Returns
-------

``Promise`` returns ``string``: execution nonce

-------
Example
-------

.. code-block:: typescript

  // nonce in this example is relatively small, so we can just parse it and use it as a number
  // consider using BigNumber or similar to deal with larger numbers if required
  let nonce = JSON.parse(await verifications.getExecutionNonce(accounts[0]));
  const txInfos = await Promise.all(['/example1', '/example2', '/example3'].map(
    topic => verifications.signSetVerificationTransaction(
      accounts[0], accounts[1], topic, 0, null, null, false, false, nonce++)
  ));


--------------------------------------------------------------------------------

= Delegated Transactions =
==========================

.. _verifications_signTransaction:

signTransaction
================================================================================

.. code-block:: typescript

  verifications.signTransaction(contract, functionName, options[, ...args]);

Signs a transaction from an identity (offchain) and returns data, that can be used to submit it later on. Return value can be passed to ``executeTransaction``.

Note that, when creating multiple signed transactions, the ``nonce`` argument **has to be specified and incremented between calls**, as the nonce is included in transaction data and restricts the order of transactions, that can be made.

----------
Parameters
----------

#. ``contract`` - ``any``: target contract of transcation or ``null`` if just sending funds
#. ``functionName`` - ``string``: function for transaction or ``null`` if just sending funds
#. ``options`` - ``any``: options for transaction, supports from, to, nonce, input, value
#. ``args`` - ``any[]`` (optional): arguments for function transaction

-------
Returns
-------

``Promise`` returns ``VerificationsDelegationInfo``: prepared transaction for ``executeTransaction``

-------
Example
-------

.. code-block:: typescript

  // create test contract
  const testContract = await executor.createContract(
    'TestContract', ['old data'], { from: accounts[0], gas: 500000 });
  let data = await executor.executeContractCall(testContract, 'data');

  // on account[0]s side
  const txInfo = await verifications.signTransaction(
    testContract,
    'setData',
    { from: accounts[0] },
    'new data',
  );

  // on account[2]s side
  await verifications.executeTransaction(accounts[2], txInfo);

  // now check
  data = await executor.executeContractCall(testContract, 'data');



.. _verifications_executeTransaction:

executeTransaction
================================================================================

.. code-block:: typescript

  verifications.executeTransaction(accountId, txInfo);

Executes a pre-signed transaction from ``signTransaction`` of an identity. This can be and usually is a transaction, that has been prepared by the identity owner and is now submitted to the chain and executed by another account.

----------
Parameters
----------

#. ``accountId`` - ``string``: account, that sends transaction to the blockchain and pays for it
#. ``txInfo`` - ``VerificationsDelegationInfo``: details about the transaction
#. ``partialOptions`` - ``any`` (optional): data for handling event triggered by this transaction

-------
Returns
-------

``Promise`` returns ``any``: result of transaction (if received from event)

-------
Example
-------

.. code-block:: typescript

  // create test contract
  const testContract = await executor.createContract(
    'TestContract', ['old data'], { from: accounts[0], gas: 500000 });
  let data = await executor.executeContractCall(testContract, 'data');

  // on account[0]s side
  const txInfo = await verifications.signTransaction(
    testContract,
    'setData',
    { from: accounts[0] },
    'new data',
  );

  // on account[2]s side
  await verifications.executeTransaction(accounts[2], txInfo);

  // now check
  data = await executor.executeContractCall(testContract, 'data');



--------------------------------------------------------------------------------

= Descriptions =
==========================

.. _verifications_setVerificationDescription:

setVerificationDescription
================================================================================

.. code-block:: typescript

  verifications.setVerificationDescription(accountId, topic, domain, description);

Set description for a verification under a domain owned by given account. This sets the description at the ENS endpoint for a verification.

Notice, that this will **not** insert a description at the verification itself. Consider it as setting a global registry with the description for your verifications and not as a label attached to a single verification.

So a setting a description for the verification ``/some/verification`` the subdomain ``example`` registers this at the ENS path `${sha3('/some/verification')}example.verifications.evan``.

When this description has been set, it can be used when setting verifications, e.g. with

.. code-block:: typescript

  verifications.setVerification(accounts[0], accounts[1], '/some/verification', expirationDate, verificationValue, 'example');

A description can be setup even after verifications have been issued. So it is recommended to use the verification domain when setting up verifications, even if the description isn't required at the moment, when verifications are set up.

----------
Parameters
----------

#. ``accountId`` - ``string``: accountId, that performs the description update
#. ``topic`` - ``string``: name of the verification (full path) to set description
#. ``domain`` - ``string``: domain of the verification, this is a subdomain under 'verifications.evan', so passing 'example' will link verifications description to 'example.verifications.evan'
#. ``description`` - ``string``: DBCP description of the verification; can be an Envelope but only public properties are used

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const sampleVerificationsDomain = 'sample';
    const sampleVerificationTopic = '/company';
    const sampleDescription = {
      name: 'sample verification',
      description: 'I\'m a sample verification',
      author: 'evan.network',
      version: '1.0.0',
      dbcpVersion: 1,
    };
  await verifications.setVerificationDescription(accounts[0], sampleVerificationTopic, sampleVerificationsDomain, sampleDescription);
  await verifications.setVerification(accounts[0], accounts[1], sampleVerificationTopic, null, null, sampleVerificationsDomain);
  const verificationsForAccount = await verifications.getVerifications(accounts[1], sampleVerificationTopic);
  const last = verificationsForAccount.length - 1;
  console.dir(verificationsForAccount[last].description);
  // Output:
  // {
  //   name: 'sample verification',
  //   description: 'I\'m a sample verification',
  //   author: 'evan.network',
  //   version: '1.0.0',
  //   dbcpVersion: 1,
  // }



--------------------------------------------------------------------------------

.. _verifications_getVerificationEnsAddress:

getVerificationEnsAddress
================================================================================

.. code-block:: typescript

  verifications.getVerificationEnsAddress(topic);

Map the topic of a verification to it's default ens domain.

----------
Parameters
----------

#. ``topic`` - ``string``: verification topic

-------
Returns
-------

``string``: The verification ens address

-------
Example
-------

.. code-block:: typescript

  const ensAddress = verifications.getVerificationEnsAddress('/evan/test');
  // will return test.verifications.evan



--------------------------------------------------------------------------------

.. _verifications_ensureVerificationDescription:

ensureVerificationDescription
================================================================================

.. code-block:: typescript

  verifications.ensureVerificationDescription(verification);

Gets and sets the default description for a verification if it does not exists.

----------
Parameters
----------

#. ``verification`` - ``any``: verification topic

-------
Example
-------

.. code-block:: typescript

  verifications.ensureVerificationDescription(verification);



--------------------------------------------------------------------------------

= Utilities =
==========================

.. _verifications_createStructure:

createStructure
================================================================================

.. code-block:: typescript

  verifications.createStructure(accountId);

Create a new verifications structure; this includes a userregistry and the associated libraries. This
isn't required for creating a module instance, its is solely used for creating new structures on the
blockchain.

----------
Parameters
----------

#. ``accountId`` - ``string``: account, that execute the transaction and owner of the new registry

-------
Returns
-------

``Promise`` returns ``any``: object with property 'storage', that is a web3js
contract instance

-------
Example
-------

.. code-block:: typescript

  const verificationsStructure = await verifications.createStructure(accountId);
  console.log(verificationsStructure.storage.options.address);
  // Output:
  // 0x000000000000000000000000000000000000000a



.. _verifications_deleteFromVerificationCache:

deleteFromVerificationCache
================================================================================

.. code-block:: typescript

  verifications.deleteFromVerificationCache(subject, topic);

Delete a single entry from the verification cache object using subject and topic

----------
Parameters
----------

#. ``subject`` - ``string``: the subject that should be removed
#. ``topic`` - ``string``: the topic that should be removed

-------
Example
-------

.. code-block:: typescript

  verifications.deleteFromVerificationCache(accounts[1], '/some/verification');



.. _verifications_trimToStatusTree:

trimToStatusTree
================================================================================

.. code-block:: typescript

  verifications.trimToStatusTree(result);

Trim ``VerificationsResultV2`` result down to statusFlags and status values for analysis purposes and debugging.

----------
Parameters
----------

#. ``inputResult`` - ``VerificationsResultV2``: result to trim down

-------
Returns
-------

``Promise`` returns ``any``: trimmed down tree

-------
Example
-------

.. code-block:: typescript

  const validationOptions: VerificationsValidationOptions = {
    disableSubVerifications: VerificationsStatusV2.Red,
    expired:                 VerificationsStatusV2.Red,
    invalid:                 VerificationsStatusV2.Red,
    issued:                  VerificationsStatusV2.Yellow,
    missing:                 VerificationsStatusV2.Red,
    noIdentity:              VerificationsStatusV2.Red,
    notEnsRootOwner:         VerificationsStatusV2.Yellow,
    parentMissing:           VerificationsStatusV2.Yellow,
    parentUntrusted:         VerificationsStatusV2.Yellow,
    rejected:                VerificationsStatusV2.Red,
    selfIssued:              VerificationsStatusV2.Yellow,
  };
  const queryOptions: VerificationsQueryOptions = {
    validationOptions: validationOptions,
  };
  const nestedVerificationsV2 = await verifications.getNestedVerificationsV2(
    accounts[1], '/example1', false, queryOptions);
  console.dir(nestedVerificationsV2);
  // Output:
  // { verifications:
  //    [ { details:
  //         { creationDate: 1561722858000,
  //           ensAddress:
  //            '4d2027082fdec4ee253363756eccb1b5492f61fb6329f25d8a7976d7909c10ac.example1.verifications.evan',
  //           id:
  //            '0x855a3c10b9cd6d42da5fd5e9b61e0f98a5af79b1acbfee57a9e4f3c9721f9c5d',
  //           issuer: '0x5035aEe29ea566F3296cdD97C29baB2b88C17c25',
  //           issuerIdentity: '0xD2860FeC7A198A646f9fD1207B59aD42f00c3189',
  //           subject: '0x9aE6533e7a2C732863C0aF792D5EA358518cd757',
  //           subjectIdentity: '0x9F870954c615E4457660D22BE0F38FE0200b1Ed9',
  //           subjectType: '0x9F870954c615E4457660D22BE0F38FE0200b1Ed9',
  //           topic: '/example1',
  //           status: 'green' },
  //        raw:
  //         { creationBlock: '224038',
  //           creationDate: '1561722858',
  //           data:
  //            '0x0000000000000000000000000000000000000000000000000000000000000000',
  //           disableSubVerifications: false,
  //           signature:
  //            '0x941f316d77f5c1dc8b38000ecbb60304554ee2fb36453487ef7822ce6d8c7ce5267bb62396cfb08191028099de2e28d0ffd4012608e8a622e9e7a6a9570a88231b',
  //           status: 1,
  //           topic:
  //            '34884897835812838038558016063403566909277437558805531399344559176587016933548' },
  //        statusFlags: [] } ],
  //   levelComputed:
  //    { subjectIdentity: '0x9F870954c615E4457660D22BE0F38FE0200b1Ed9',
  //      subjectType: 'account',
  //      topic: '/example1',
  //      subject: '0x9aE6533e7a2C732863C0aF792D5EA358518cd757' },
  //   status: 'green' }

  const trimmed = verifications.trimToStatusTree(nestedVerificationsV2);
  console.dir(trimmed);
  // Output:
  // { status: 'green',
  //   verifications:
  //    [ { details: { status: 'green', topic: '/example1' },
  //        statusFlags: [] } ] }



--------------------------------------------------------------------------------

Enums
=====

.. _verifications_VerificationsStatus:

-------------------
VerificationsStatus
-------------------

verification status from blockchain

#. ``Issued``: issued by a non-issuer parent verification holder, self issued state is 0
#. ``Confirmed``: issued by a non-issuer parent verification holder, self issued state is 0
#. ``Rejected``: verification rejected status



.. _verifications_VerificationsStatusFlagsV2:

--------------------------
VerificationsStatusFlagsV2
--------------------------

status annotations about verification, depending on defined ``VerificationsQueryOptions``, this may lead to the verification to be invalid or less trustworthy

#. ``disableSubVerifications``: parent verification does not allow subverifications
#. ``expired``: verification has expired
#. ``invalid``: signature does not match requirements, this could be because it hasn’t been signed by correct account or underlying checksum does not match subject, topic and data
#. ``issued``: verification has been issued, but not accepted or rejected by subject
#. ``missing``: verification has not been issued
#. ``noIdentity``: given subject has no identity
#. ``notEnsRootOwner``: verification path has a trusted root verification topic, but this verification is not signed by a trusted instance
#. ``parentMissing``: parent verification is missing in path
#. ``parentUntrusted``: verification path cannot be traced back to a trusted root verification
#. ``rejected``: verification has been issued and then rejected by subject
#. ``selfIssued``: verification issuer is the same account as the subject



.. _verifications_VerificationsStatusV2:

---------------------
VerificationsStatusV2
---------------------

represents the status of a requested verification topic after applying rules in ``VerificationsQueryOptions``

#. ``Green``: verification is valid according to ``VerificationsQueryOptions``
#. ``Yellow``: verification may be valid but more checks may be required more for trusting it, see status flags for details
#. ``Red``: verification is invalid, see status flags for details



--------------------------------------------------------------------------------

Interfaces
==========

.. _verifications_VerificationsDelegationInfo:

---------------------------
VerificationsDelegationInfo
---------------------------

information for submitting a delegated transaction, created with ``signSetVerificationTransaction`` consumed by ``executeVerification``

#. ``sourceIdentity`` - ``string``: address of identity contract, that issues verification
#. ``value`` - ``number``: value to transfer, usually 0
#. ``input`` - ``string``: abi encoded input for transaction
#. ``signedTransactionInfo`` - ``string``: signed data from transaction
#. ``nonce`` - ``string``(optional): source identity contract execution nonce for this transaction
#. ``targetIdentity`` - ``string``(optional): address of identity contract, that receives verification, either this or ``to`` has to be given
#. ``to`` - ``string`` (optional): address of target of transaction, either this or `targetIdentity` has to be given



.. _verifications_VerificationsQueryOptions:

-------------------------
VerificationsQueryOptions
-------------------------

options for ``getNestedVerificationsV2``, define how to calculate status of verification

#. ``statusComputer`` - ``VerificationsStatusComputer`` (optional): function for setting verification with custom logic
#. ``validationOptions`` - ``VerificationsValidationOptions`` (optional): specification of how to handle status flags of each single verification



.. _verifications_VerificationsResultV2:

---------------------
VerificationsResultV2
---------------------

result of a verification query

#. ``status`` - ``VerificationsStatusV2``: overall status of verification
#. ``verifications`` - ``VerificationsVerificationEntry[]``: (optional): list of verifications on same topic and subject
#. ``levelComputed`` (optional): consolidated information about verification
    * ``subjectIdentity`` - ``string``: identity contract address or hash of subject
    * ``subjectType`` - ``string``: type of subject (account/contract)
    * ``topic`` - ``string``: topic (name) of verification
    * ``expirationDate`` - ``number`` (optional): timestamp, when verification will expire, js timestamp
    * ``parents`` - ``VerificationsResultV2`` (optional): verifications of parent path, issued for all issuers of verifications on this level
    * ``subject`` - ``number`` (optional): subject accountId/contractId (if query was issued with ``isIdentity`` set to ``false``)



.. _verifications_VerificationsVerificationEntry:

------------------------------
VerificationsVerificationEntry
------------------------------

a single verification; usually used in ``VerificationsResultV2``

#. ``details``: details about verification
    * ``creationDate`` - ``number``: js timestamp of verification creation
    * ``ensAddress`` - ``string``: ens address of description for this verification
    * ``id`` - ``string``: id in verification holder / verifications registry
    * ``issuer`` - ``string``: account id of verification issuer
    * ``issuerIdentity`` - ``string``: issuers identity contract id
    * ``subjectIdentity`` - ``string``: identity (contract or identity hash) of subject
    * ``subjectType`` - ``string``: type of subject (account/contract)
    * ``topic`` - ``string``: topic of identity (name)
    * ``data`` - ``any`` (optional): 32B data hash string of identity
    * ``description`` - ``any`` (optional): only if actually set
    * ``expirationDate`` - ``number`` (optional): expiration date of verification (js timestamp)
    * ``rejectReason`` - ``string`` (optional): if applicable, reason for verification rejection
    * ``status`` - ``VerificationsStatusV2`` (optional): status of verification, is optional during result computation and required when done
    * ``subject`` - ``string`` (optional): subject accountId/contractId (if query was issued with ``isIdentity`` set to ``false``)
#. ``raw`` (optional): raw data about verification from contract
    * ``creationBlock`` - ``string``: block in which verification was issued
    * ``creationDate`` - ``string``: unix timestamp is s when verification was issued
    * ``data`` - ``string``: 32B data hash string of identity, bytes32 zero if unset
    * ``disableSubVerifications`` - ``boolean``: true if subverification are not allowed
    * ``signature`` - ``string``: signature over verification data
    * ``status`` - ``number``: status of verification, (issued, accepted, rejected, etc.)
    * ``topic`` - ``string``: uint string of verification name (topic), is uint representation of sha3 of name
#. ``statusFlags`` - ``string[]`` (optional): all found flags, those may not have impact on status, depends on ``VerificationsStatusFlagsV2``



.. _verifications_VerificationsVerificationEntryStatusComputer:

--------------------------------------------
VerificationsVerificationEntryStatusComputer
--------------------------------------------

Computes status for a single verification. verification, partialResult.

Parameters
----------

#. ``verification`` - ``Partial<VerificationsVerificationEntry>``: current verification result (without status)
#. ``partialResult`` - ``Partial<VerificationsResultV2>``: options for verifications query

Returns
-------

``Promise`` returns ``VerificationsStatusV2``: status for this verification



.. _verifications_VerificationsStatusComputer:

---------------------------
VerificationsStatusComputer
---------------------------

Computes status from overall verifications result.
This function is applied after each verification has received an own computed status.

Parameters
----------

#. ``partialResult`` - ``Partial<VerificationsResultV2>``: current verification result (without status)
#. ``queryOptions`` - ``VerificationsQueryOptions``: options for verifications query
#. ``currentStatus`` - ``VerificationsStatusV2``: current status of verification

Returns
-------

``Promise`` returns ``Promise<VerificationsStatusV2>``: updated status, will be used at verification status



.. _verifications_VerificationsValidationOptions:

------------------------------
VerificationsValidationOptions
------------------------------

Options for verification status computation. Keys are string representations of
``VerificationsStatusFlagsV2``, values can be ``VerificationsStatusV2`` or functions.
If value is ``VerificationsStatusV2``, then finding given status flag sets verification value
to given ``VerificationsStatusV2`` (if not already at a higher trust level).
If value is function, pass verification to this function and set verification status to
return value (if not already at a higher trust level).

#. ``[id: string]`` - ``VerificationsStatusV2 | VerificationsVerificationEntryStatusComputer``: each key is a status flag and usually an enum value from ``VerificationsStatusFlagsV2``, though it is possible to use custom status flags



.. required for building markup

.. |source accountStore| replace:: ``AccountStore``
.. _source accountStore: ../blockchain/account-store.html

.. |source contractLoader| replace:: ``ContractLoader``
.. _source contractLoader: ../contracts/contract-loader.html

.. |source description| replace:: ``Description``
.. _source description: ../blockchain/description.html

.. |source dfsInterface| replace:: ``DfsInterface``
.. _source dfsInterface: ../dfs/dfs-interface.html

.. |source executor| replace:: ``Executor``
.. _source executor: ../blockchain/executor.html

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: ../common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: ../common/logger.html#logloginterface

.. |source nameResolver| replace:: ``NameResolver``
.. _source nameResolver: ../blockchain/name-resolver.html
