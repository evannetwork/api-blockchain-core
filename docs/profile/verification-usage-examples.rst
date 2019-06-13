===============================
Verifications Examples
===============================

This sections aims to help getting started with the verifications service. Herein are shown a few examples on

- how to set verifications
- how to get verifications
- how to handle verifications for externally owned accounts and contracts
- how to check verifications for validity

`Verifications <https://evannetwork.github.io/docs/how_it_works/services/verificationmanagement.html>`_ can be issued with the :doc:`Verification API <verifications>`. Their smart contract implementation follow the principles outlined in `ERC-725 <https://github.com/ethereum/EIPs/issues/725>`_ and `ERC-735 <https://github.com/ethereum/EIPs/issues/735>`_.


-----------------------
About the Code Examples
-----------------------

Many code examples are taken from the `verification tests <https://github.com/evannetwork/api-blockchain-core/blob/master/src/verifications/verifications.spec.ts>`_. You can a look at those for more examples or to have a look at in which context the test are run in.

Code examples on this page use an initialized module called ``verifications``, which is an instance of the verification module :doc:`Verification API <verifications>`. When using a :ref:`runtime <configuring-and-initializing-blockchain-core>` this module is available as ``runtime.verifications``.

Many code examples here use variable naming from the tests. So there are a few assumptions about variables used here:

- ``accounts`` is an array with addresses of externally owned accounts, of which private keys are known to the runtime/executor/signer instance to make transaction with them
- ``accounts[0]`` usually takes the role of issuing verifications
- ``accounts[1]`` is usually an account that responds to actions from ``accounts[0]``
- ``contractId`` refers to the address of a contract, that is owned by ``accounts[0]``, this contract usually has a `DBCP <https://github.com/evannetwork/dbcp>`_ `description <https://api-blockchain-core.readthedocs.io/en/latest/blockchain/description.html>`_


--------------------------------------------------------------------------------

.. _different-types-of-identities:

Different Types of Identities
=============================

Okay, this page is about berifications, so why does the first heading talk about some kind of identities? |br|
The answer for this is pretty simple simple: Verifications are issued by identities.

So what exactly is an identity? |br|
An identity is an instance, that is able to issue and hold verifications (therefore the technical name `VerificationHolder <https://github.com/evannetwork/smart-contracts-core/blob/master/contracts/verifications/VerificationHolder.sol>`_.

Technically speaking, identities are like Wallet Contracts, that have a certificate store attached to them. Identities can be traced back to an externally owned account, that owns this wallet contract and vice versa the matching identity (wallet) contract can be looked up for any given externally owned account, if this account has created and registered an identity contract.

Because of their wallet-like behavior, `identity contracts <https://github.com/evannetwork/smart-contracts-core/blob/master/contracts/verifications/VerificationHolder.sol>`_ require a calling instance, for example an externally owned account or another wallet to call them for managing their verifications. For example to issue a verification for another identity, a user makes a transaction against its own identity contract, which itself makes a transaction to create a verification in the other identity.

This works pretty well and comes with useful features like preparing "outgoing" transactions to be made from ones own identity, that can be paid by another party, but has some implications when applied as "smart contract identities" instead of "account identities". These smart contracts would need to be owner of their own identities and working with verifications would require the contracts to have functions for issuing, rejecting, etc. verification or offer wallet like functionalities themselves, which would make it often pretty hard to introduce verifications in an existing smart contract infrastructure and it would often have an impact on these contracts costs as these extra functionalities have to be added to the contract.

To allow for a more easy integration, contract identities have been added as a 32 Bytes identities or pseudonyms, which can be created with a registry contract. These 32 Bytes identities are IDs in a central `registry <https://github.com/evannetwork/smart-contracts-core/blob/master/contracts/verifications/VerificationsRegistry.sol>`_, that offers basically the same functionalities as the single `identity contracts <https://github.com/evannetwork/smart-contracts-core/blob/master/contracts/verifications/VerificationHolder.sol>`_. Identities at the registry are owned by the account, that created them (ownership can be transfered) and ownership over such an identity grants the permission to make transactions for it the same way as for the own account identity.

So let's get to the code examples.


------------------
Account Identities
------------------

Note that the creation example can be omitted when using an account creating during the `visual onboarding flow <https://evannetwork.github.io/docs/first_steps/create-identity.html>`_, as this includes creating an identity.

If you want to check if your account already has an identity, you can try to get its identity contracts address with :ref:`identityAvailable <verifications_identityAvailable>`:

.. code-block:: typescript

  if (await verifications.identityAvailable(accounts[0])) {
    console.log(`account "${accounts[0]}" has an identity`);
  } else {
    console.log(`account "${accounts[0]}" does not have an identity`);
  }

Account identities can be created straight forward by calling :ref:`createIdentity <verifications_createIdentity>` and passing the account to it, an identity should be created for.

.. code-block:: typescript

  const identity = await verifications.createIdentity(accounts[0]);
  console.log(identity);
  // Output:
  // 0x1fE5F7235f1989621135466Ff8882287C63A5bae

This returns the 40Bytes contract address of the accounts identity contract.

The given account now has an identity attached to it, which is a requirement for interacting with the rest of the :doc:`verifications API <verifications>` and only has to be done once per externally owned account.


------------------------------------------
Contract Identities / Pseudonym Identities
------------------------------------------

Contract identities are created "on behalf of" a contract. An externally owned account, often the owner of the contract, usually does the following:

- creating an identity for the contract
- linking contract and identity
- providing the information of which identity belongs to a contract to other parties

Creating a contract identity registers a new contract identity at the `registry <https://github.com/evannetwork/smart-contracts-core/blob/master/contracts/verifications/VerificationsRegistry.sol>`_, this identity is then owned by the executing accountId.

Linking is done by registering the contract address as the receiver of the identity, this is done at the `registry <https://github.com/evannetwork/smart-contracts-core/blob/master/contracts/verifications/VerificationsRegistry.sol>`_ as well.

When third parties want to check verifications of a contract, they need a way to get the identity for a contract. This can be done by adding an extra function to the contract, by setting up a lookup mechanism, etc. `DBCP <https://github.com/evannetwork/dbcp>`_ is a description language used throughout evan.network, which provides a way to add meta information to smart contracts. The contract identity is usually added to this DBCP `description <https://api-blockchain-core.readthedocs.io/en/latest/blockchain/description.html>`_ of a contract.

The aforementioned three steps are covered by the :ref:`createIdentity <verifications_createIdentity>` function, which can be called with:

.. code-block:: typescript

  const contractIdentity = await verifications.createIdentity(accounts[0], contractId);
  console.log(idencontractIdentitytity);
  // Output:
  // 0x4732281e708aadbae13f0bf4dd616de86df3d3edb3ead21604a354101de45316

When using contracts without descriptions or when handling the relation between contracts and an identity elsewhere, the process of updating the description can be omitted. For this set the ``updateDescription`` argument to ``false``:

.. _contract-identity-undescribed:

.. code-block:: typescript

  const contractIdentity = await verifications.createIdentity(accounts[0], contractId, false);
  console.log(idencontractIdentitytity);
  // Output:
  // 0x4732281e708aadbae13f0bf4dd616de86df3d3edb3ead21604a354101de45316

Pseudonyms can be handled the same way. Just set the flag to link given identity to false:

.. _contract-identity-undescribed:

.. code-block:: typescript

  const contractIdentity = await verifications.createIdentity(accounts[0], null, false, false);
  console.log(idencontractIdentitytity);
  // Output:
  // 0x4732281e708aadbae13f0bf4dd616de86df3d3edb3ead21604a354101de45316

This returns an identity, that is owned by ``accountId`` and can be used to issue verifications for.



--------------------------------------------------------------------------------

.. _issue-verifications:

Issue verifications
=============================

Verifications are statements, issued by an account called ``issuer``, towards target, called ``subject``. This basically means something like "The person ``issuer`` says, a statement applies to ``subject``". The subject may or may not react to it by confirming or rejecting it. Technically speaking, the ``issuer`` identity issues the verification with the statement to ``subject``\`s identity and the ``subjects``\`s identity may react to it.


----------------------------------
Issue verifications for an account
----------------------------------

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

Have a look at :ref:`getVerifications <verifications_getVerifications>` or the section on :ref:`this page <get-verifications>` for the meaning of the returned values, for how to find out, if the returned verification is trustworthy, have a look at :ref:`Validating Verifications <validating-verifications>`.


-----------------------------------------------------
Issue verifications for a contract with a description
-----------------------------------------------------

.. code-block:: typescript

  const verificationId = await verifications.setVerification(
    accounts[0], contractId, '/example2');
  console.log(verificationId);
  // Output:
  // 0x2bc6d5fdb937f6808252b837437220d8e16b92a974367f224260d028413e7c6e

  const issued = await verifications.getVerifications(contractId, '/example2');
  console.dir(issued);
  // [ {
  //   creationBlock: '187823',
  //   creationDate: '1558621998',
  //   data: '0x0000000000000000000000000000000000000000000000000000000000000000',
  //   description: null,
  //   disableSubVerifications: false,
  //   expirationDate: null,
  //   expired: false,
  //   id: '0x2bc6d5fdb937f6808252b837437220d8e16b92a974367f224260d028413e7c6e',
  //   issuer: '0xe560eF0954A2d61D6006E8547EC769fAc322bbCE',
  //   name: '/example2',
  //   rejectReason: undefined,
  //   signature: '0x0f4f19a369645a0ec2795bd2836fad0857ef82169c7e5800d7a06fb162583c9c14a731f4e942cf30d67fb10a551d9060f71642d25bb6c2c226bae47b3acb13581b',
  //   status: 0,
  //   subject: '0x005C5FF57D4d6Bf105Bf3bF16ffCd8Ac143B3Ef0',
  //   topic: '107276559880603231420598591656057035604273757486333915273364042567965107775848',
  //   uri: '',
  //   valid: true
  // } ]

Have a look at :ref:`getVerifications <verifications_getVerifications>` or the section on :ref:`this page <get-verifications>` for the meaning of the returned values, for how to find out, if the returned verification trustworthy, have a look at :ref:`Validating Verifications <validating-verifications>`.

Note that for contracts with descriptions the contractId can be given to ``setVerification`` and ``getVerifications``. The contract identity is fetched from the contract description automatically.



--------------------------------------------------------------
Issue verifications for a contract without using a description
--------------------------------------------------------------

.. code-block:: typescript

  // assume, we have created an identity for our contract and stored this identity as the variable ``contractIdentity``
  const verificationId = await verifications.setVerification(
    accounts[0], contractIdentity, '/example3', 0, null, null, false, true));
  console.log(verificationId);
  // Output:
  // 0x2bc6d5fdb937f6808252b837437220d8e16b92a974367f224260d028413e7c6e

  const issued = await verifications.getVerifications(contractIdentity, '/example3', true);
  console.dir(issued);
  // [ {
  //   creationBlock: '187823',
  //   creationDate: '1558621998',
  //   data: '0x0000000000000000000000000000000000000000000000000000000000000000',
  //   description: null,
  //   disableSubVerifications: false,
  //   expirationDate: null,
  //   expired: false,
  //   id: '0x2bc6d5fdb937f6808252b837437220d8e16b92a974367f224260d028413e7c6e',
  //   issuer: '0xe560eF0954A2d61D6006E8547EC769fAc322bbCE',
  //   name: '/example2',
  //   rejectReason: undefined,
  //   signature: '0x0f4f19a369645a0ec2795bd2836fad0857ef82169c7e5800d7a06fb162583c9c14a731f4e942cf30d67fb10a551d9060f71642d25bb6c2c226bae47b3acb13581b',
  //   status: 0,
  //   subject: '0x005C5FF57D4d6Bf105Bf3bF16ffCd8Ac143B3Ef0',
  //   topic: '107276559880603231420598591656057035604273757486333915273364042567965107775848',
  //   uri: '',
  //   valid: true
  // } ]

In case you're wondering: ``contractIdentity`` is the same identity as returned in our :ref:`example <contract-identity-undescribed>`.

Have a look at :ref:`getVerifications <verifications_getVerifications>` for the meaning of the returned values, for how to find out, if the returned verification trustworthy, have a look at :ref:`Validating Verifications <validating-verifications>`.

Note that for contracts without descriptions ``contractIdentity`` is given and the last argument (``isIdentity``) is set to true. The functions ``setVerification`` and ``getVerifications`` support passing a contract identity to them as well and they also have the argument ``isIdentity``, which is set to true, when passing contract identities to them.



--------------------------------------------------------------------------------

.. _validating-verifications:

Validating Verifications
=============================

Verifications can be retrieved with two different functions:

- :ref:`getVerifications <verifications_getVerifications>`: simple "fetch all" verifications for a topic, returns all validations and detailed validity checks have to be made by hand
- :ref:`getNestedVerification <verifications_getNestedVerifications>`: return verifications with default checks and inspects parent verifications as well, used for verifications, that should be traced back to a trusted root verifier


.. _get-verifications:

-----------------------------------------------------
getVerifications
-----------------------------------------------------

The example for :ref:`getVerifications <verifications_getVerifications>` is the same we used when creating a verification for and account:

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

As stated above, only basic validations have been made on the data of the verifications, so conclusions have to be drawn by based on the data returned here. For a full list of explanations to the properties have a look at the :ref:`API documentation <verifications_getVerifications>`, but the ones you will be most probably using the most are:

- ``status`` and ``rejectReason``:

    - ``status`` - ``number``:
    - 0 (Issued) || 1 (Confirmed) || 2 (Rejected)
    - reflects how the subject responded (1|2) to the verification or if no response has been made (0)
    - ``rejectReason`` - ``any``: object with information from subject about rejection

- ``valid`` - ``boolean``:

    - ``true`` if issuer has been correctly confirmed as the signer of ``signature``
    -  also checks if provided ``signature`` has been correctly built as checksum over ``subject``, ``topic`` and ``data``

- ``expired`` and ``expirationDate``:

    - ``expired`` - ``boolean``: ticket expiration state
    - ``expirationDate`` - ``string``: UNIX timestamp (in seconds), null if verification does not expire

- ``issuer`` - ``string``:

    - account address of issuers identity contract, can be used to check if the issuer is an account, that you trust

- ``data`` and ``uri``:

    - ``data`` - ``string``: 32Bytes hash of data stored in DFS
    - ``uri`` - ``string``: link to ipfs file of data
    - these two properties point to data, that has been attached to your verification (attaching data is optional)
    - the data referred here is the data provided as ``verificationValue`` in :ref:`setVerification <verifications_setVerification>`
    - data content handling, especially encryption and key management has be be handled in custom logic and is not covered in here

A sample, on how these properties can be used to determine the trustworthiness of a verification can be found at `hem workshop project <https://github.com/evannetwork/workshop-hem/blob/0ac855e3812cfbccf05421008bc3b95c234ea59d/smart-agent-workshop-hem/initializers/smart-agent-workshop-hem-initializers.js#L90>`_.


.. get-nested-verifications:

-----------------------------------------------------
getNestedVerifications
-----------------------------------------------------

For this section we take the last example and issue two subverifications. We add ``/example1/example1_child`` as the direct child of it and ``/example1/example1_child/example1_grandchild`` as a subverification below the first this child.

.. code-block:: typescript

  const verificationId = await verifications.setVerification(
    accounts[0], accounts[0], '/example4');
  const verificationId = await verifications.setVerification(
    accounts[0], accounts[0], '/example4/child');
  const verificationId = await verifications.setVerification(
    accounts[0], accounts[0], '/example4/child/grandchild');

  const issued = await verifications.getNestedVerifications(accounts[0], '/example1/example1_child/example1_grandchild');
  console.dir(issued);
  // Output:
  // [ {
  //     name: '/example4/child/grandchild',
  //     parent: '/example4/child',
  //     warnings: [ 'issued', 'selfIssued', 'parentUntrusted' ],
  //     id: '0x1adef760f5a8d153aeeeda7a6e4f8c950fa93b0cb5d3218c6a9389cd05f5f7f6',
  //     issuer: '0xe560eF0954A2d61D6006E8547EC769fAc322bbCE',
  //     status: 0,
  //     subject: '0x001De828935e8c7e4cb56Fe610495cAe63fb2612',
  //     subjectIdentity: '0xe560eF0954A2d61D6006E8547EC769fAc322bbCE',
  //     subjectType: 'account',
  //     issuerAccount: '0x001De828935e8c7e4cb56Fe610495cAe63fb2612',
  //     parents:
  //      [ {
  //          name: '/example4/child',
  //          parent: '/example4',
  //          warnings: [ 'issued', 'selfIssued', 'parentUntrusted' ],
  //          id: '0x28e1df758883bb3d4d5e7e0fa978ff673bc749ade0a3d78ad952a30d0a0e2a01',
  //          issuer: '0xe560eF0954A2d61D6006E8547EC769fAc322bbCE',
  //          status: 0,
  //          subject: '0x001De828935e8c7e4cb56Fe610495cAe63fb2612',
  //          subjectIdentity: '0xe560eF0954A2d61D6006E8547EC769fAc322bbCE',
  //          subjectType: 'account',
  //          issuerAccount: '0x001De828935e8c7e4cb56Fe610495cAe63fb2612',
  //          parents:
  //           [ {
  //               name: '/example4',
  //               parent: '',
  //               warnings: [ 'issued' ],
  //               id: '0x18fb0ef05d96cba2a57c6de6d8cfd031e16367f6484f20797a39d25a3e76e20a',
  //               issuer: '0xe560eF0954A2d61D6006E8547EC769fAc322bbCE',
  //               status: 0,
  //               subject: '0x001De828935e8c7e4cb56Fe610495cAe63fb2612',
  //               subjectIdentity: '0xe560eF0954A2d61D6006E8547EC769fAc322bbCE',
  //               subjectType: 'account',
  //               issuerAccount: '0x001De828935e8c7e4cb56Fe610495cAe63fb2612',
  //               parents: [],
  //          } ],
  //     } ],
  // } ]

The output above has been heavily trimmed down to show differences between both functions and highlight parent to child relations and warnings. To view full output have a look at the :doc:`full output <verification-usage-examples-full-output>`.

To create a simple chain of verifications, we have used the following structure:
- ``accounts[0]`` creates a verification for itself, called ``/example4``
- then creates a subverification under called ``/example4/child`` for itself under this
- then creates another subverification (under the first subverification) called ``/example4/child/grandchild`` for itself

The call ``verifications.getNestedVerifications(accounts[0], '/example1/example1_child/example1_grandchild')`` now inspects what verifications and possible relations to parent verifications exits and it finds the following possible issues:

- ``/example4/child/grandchild``: ``warnings: [ 'issued', 'selfIssued', 'parentUntrusted' ]``

    - ``issued`` means, that is is only issued and not confirmed, we can see its status is ``0``, so yes, it is unconfirmed (and if we look above, we actually didn't confirm the verification)
    - ``selfIssued``, yes, ``issuer`` equals ``subjectIndentity``, therefore ``selfIssued`` and thinking back, we did issue this verification to ourself
    - ``parentUntrusted``, this means that the parent verification hasn't been accepted, its status is ``0``, so yes, only issued and not confirmed

- following the parent verifications, we find basically the same on the next level

    - ``/example4/child```: ``warnings: [ 'issued', 'selfIssued', 'parentUntrusted' ]``
    - the same reasons and explanations apply here, so let's continue to the last on in the verification path

- ``/example4``: ``warnings: [ 'issued' ]``

    - ``issued``: yep, status is ``0`` therefore it is only issued and not confirmed
    - no ``parentUntrusted``? as this verification is a root verification, there is not parent
    - no ``selfIssued``?

        - the path is ``/example4``, which makes this verification a root verification
        - root verifications can be issued by any party without being flagged as ``selfIssued``, to allow building own verification chains
        - to narrow this down to a limited set of trusts, there are basically two solutions:

            - own checks can be made, e.g. check if the issuer of the root verification is a well known and trusted account
            - use ``/evan`` derived verification paths, the root verification ``/evan`` is only trusted, if it is issued by a trusted root issuer, get in contact with us via info@evan.team for details on how to obtain a subverification like ``/evan/myOwnTrustedVerification``, that can be used for building widely accepted verification paths



--------------------------------------------------------------------------------

.. _warnings-in-verifications:

Warnings in Verifications
=========================

:ref:`getNestedVerification <verifications_getNestedVerifications>` returns a set of different warnings, that can be used to decide if a certification is valid or not. Those warnings are stored in the ``.warnings`` property, warnings, that can be returned are:

- ``disableSubVerifications``: parent verification does not allow subverifications
- ``expired``: verification has expired
- ``invalid``: signature does not match requirements, this could be because it hasn't been signed by correct account or underlying checksum does not match ``subject``, ``topic`` and ``data``
- ``issued``: verification has been issued, but not accepted or rejected by subject
- ``missing``: verification has not been issued
- ``noIdentity``: given subject has no identity
- ``notEnsRootOwner``: verification path has a trusted root verification topic, but this verification is not signed by a trusted instance
- ``parentMissing``: parent verification is missing in path
- ``parentUntrusted``: verification path cannot be traced back to a trusted root verification
- ``rejected``: verification has been issued and then rejected by subject
- ``selfIssued``: verification issuer is the same account as the subject



--------------------------------------------------------------------------------

.. _data-in-verifications:

Data in Verifications
=============================

-----------------------------------------------------
Unencrypted Data in Verifications
-----------------------------------------------------

Additional data can be given when creating a verification. For this pass an object, that can be serialized to JSON as the ``verificationValue`` argument to ``setVerification``. As this argument is placed after the ``expirationDate`` argument, we set this argument as well.

.. code-block:: typescript

  const verificationId = await verifications.setVerification(
    accounts[0], accounts[1], '/example1', 0, { foo: 'bar' });
  console.log(verificationId);
  // Output:
  // 0x5ea689a7ed1d56d948dc8223dcd60866746bc7bea47617c19b63df75d63c9194

  const issued = await verifications.getVerifications(accounts[1], '/example1');
  console.dir(issued);
  // Output:
  // [ { creationBlock: '198673',
  //     creationDate: '1559913567',
  //     data:
  //      '0xc710c57357d3862f351c00ff77a5ef90bb4491851f11c3e8ea010c16745c468e',
  //     description: null,
  //     disableSubVerifications: false,
  //     expirationDate: null,
  //     expired: false,
  //     id:
  //      '0x5ea689a7ed1d56d948dc8223dcd60866746bc7bea47617c19b63df75d63c9194',
  //     issuer: '0x6d2b20d6bf2B848D64dFE0B386636CDbFC521d4f',
  //     name: '/example1',
  //     rejectReason: undefined,
  //     signature:
  //      '0xf7ce3cc2f50ef62783ef293f8f45814b3ae868e614042cc05154853d00a694c176f8bdd94700736a137f92ff9a87639aade3f31724bb1eb7fe7f143df4c62c571c',
  //     status: 0,
  //     subject: '0x0030C5e7394585400B1FB193DdbCb45a37Ab916E',
  //     topic:
  //      '34884897835812838038558016063403566909277437558805531399344559176587016933548',
  //     uri:
  //      'https://ipfs.test.evan.network/ipfs/Qmbjig3cZbUUufWqCEFzyCppqdnmQj3RoDjJWomnqYGy1f',
  //     valid: true } ]

  const data = JSON.parse(await dfs.get(issued[0].data));
  console.dir(data);
  // Output:
  // { foo: 'bar' }



-----------------------------------------------------
Encrypted Data in Verifications
-----------------------------------------------------

Data added to the verification can be encrypted as well. Encryption is done outside of the verification service and has to be done before settin a verification and after getting the verification.

As key handling, storage and encryption itself is handled outside of the verification service, there are different ways for doing this. The suggested way to do this though, is using the :doc:`EncryptionWrapper <../encryption/encryption-wrapper>`. See the example below and its documentation for how it can be used.

.. code-block:: typescript

  const unencrypted = {foo: 'bar'};
  const cryptoInfo = await encryptionWrapper.getCryptoInfo('test', EncryptionWrapperKeyType.Custom);
  const key = await encryptionWrapper.generateKey(cryptoInfo);
  const encrypted = await encryptionWrapper.encrypt(unencrypted, cryptoInfo, { key });

  const verificationId = await verifications.setVerification(
    accounts[0], accounts[1], '/example1', 0, encrypted);
  console.log(verificationId);
  // Output:
  // 0xdaa700acd52af1690c394445cc7908d01bef9a6c0c209dd4590cf869aa801586

  const issued = await verifications.getVerifications(accounts[1], '/example1');
  console.dir(issued);
  // Output:
  // [ { creationBlock: '198706',
  //     creationDate: '1559915070',
  //     data:
  //      '0xb2eca508b635094d642950d3715783d744eac6771ff665303196040c6778cbc3',
  //     description: null,
  //     disableSubVerifications: false,
  //     expirationDate: null,
  //     expired: false,
  //     id:
  //      '0xdaa700acd52af1690c394445cc7908d01bef9a6c0c209dd4590cf869aa801586',
  //     issuer: '0x6d2b20d6bf2B848D64dFE0B386636CDbFC521d4f',
  //     name: '/example1',
  //     rejectReason: undefined,
  //     signature:
  //      '0x8ce1f239b254f2a4453e704cf5bd50f1aef215c5843408dc94ba3d128bba75d346a0b7945dd49f78b16cfd312ba51f68d10cee0e6fa17de66efb1b0d583925911b',
  //     status: 0,
  //     subject: '0x0030C5e7394585400B1FB193DdbCb45a37Ab916E',
  //     topic:
  //      '34884897835812838038558016063403566909277437558805531399344559176587016933548',
  //     uri:
  //      'https://ipfs.test.evan.network/ipfs/QmaP6Zyz2Mw4uBX1veuxQJSnvZnG3MLFxLGrPxbc2Y4pnn',
  //     valid: true } ]

  const retrieved = JSON.parse(await dfs.get(issued[0].data));
  console.dir(retrieved);
  // Output:
  // { private:
  //    '017b0c07256180a69457f5c9a4e52431424532f698deaf401b754414bb070649',
  //   cryptoInfo:
  //    { algorithm: 'aes-256-cbc',
  //      block: 198705,
  //      originator: 'custom:test' } }

  const decrypted = await encryptionWrapper.decrypt(retrieved, { key });
  console.dir(decrypt);
  // Output:
  // { foo: 'bar' }



--------------------------------------------------------------------------------

.. required for building markup


.. |br| raw:: html

   <br />
