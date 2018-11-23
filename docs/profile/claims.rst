================================================================================
Claims
================================================================================

.. list-table:: 
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - Claims
   * - Extends
     - `Logger </common/logger.html>`_
   * - Source
     - `claims.ts <https://github.com/evannetwork/api-blockchain-core/blob/master/src/claims/claims.ts>`_
   * - Tests
     - `claims.spec.ts <https://github.com/evannetwork/api-blockchain-core/blob/master/src/claims/claims.spec.ts>`_

The ``Claims`` module allows to

- issue claims about oneself or about other parties
- confirm or delete claims about oneself

Claims have a pattern similar to file paths, a claim for an account called "foo" being an employee of a company called "bar" may look like this:

``/company/bar/employee``

Under this "path" a set of values can be found. These value describe the claim, the subject of the claim and optional its response to it. Basically an ``issuer`` creates a ``claim`` about a ``subject`` The values are:

- ``claim (name)``
  full path to a claim, for example ``/company/bar/employee/foo``,
  settable by the ``subject`` of the parent claim ``/company/bar/employee``
- ``subject``
  an account, a claim has been issued for, can be a group/wallet or an externally owned account
  being the ``subject`` of a ``claim`` basically means to be the owner of the claim and allows to create subclaims below the own claim path
- ``issuer``
  an account (group/wallet or externally owned) that creates a claim,
  to be able to issue a claim, the ``issuer`` has to be the ``subject`` of the parent claim ``/company/bar/employee``
- ``data``
  The hash of the claim data, sitting in another location, a bit-mask, call data, or actual data based on the claim scheme.
- ``uri``
  The location of the claim, this can be HTTP links, swarm hashes, IPFS hashes, and such.
- ``status``
  this represents a ``claims`` status,
  values are ``uint8`` range from 0 to 255, the currently used values are:
  - 0: Issued
  - 1: Confirmed
- ``signature``
  Signature which is the proof that the claim issuer issued a claim of topic for this identity. 
  It MUST be a signed message of the following structure: keccak256(address identityHolder_address, uint256 _ topic, bytes data)
- ``creationDate``
  creationDate of the claim
- ``id``
  id of the current claim
- ``valid``
  check if the claim has a valid signature


--------------------------------------------------------------------------------

.. _claims_constructor:

constructor
================================================================================

.. code-block:: typescript

  new Claims(options);

Creates a new Claims instance.

Note, that the option properties ``registry`` and ``resolver`` are optional but should be provided
in most cases. As the module allows to create an own ENS structure, that includes an own ENS
registry and an own default resolver for it, setting them beforehand is optional.

----------
Parameters
----------

#. ``options`` - ``ClaimsOptions``: options for Claims constructor.
    * ``contractLoader`` - |source contractLoader|_: |source contractLoader|_ instance
    * ``executor`` - |source executor|_: |source executor|_ instance
    * ``nameResolver`` - |source nameResolver|_: |source nameResolver|_ instance
    * ``accountStore`` - |source accountStore|_: |source accountStore|_ instance
    * ``dfs`` - |source dfs|_: |source dfs|_ instance
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``
    * ``storage`` - ``string`` (optional): contract address of the identity storage registry

-------
Returns
-------

``Claims`` instance

-------
Example
-------

.. code-block:: typescript
  
  const claims = new Claims({
    contractLoader,
    executor,
    nameResolver,
    accountStore
    storage: '0x0000000000000000000000000000000000000001',
  });



--------------------------------------------------------------------------------



= Issuers =
==========================

.. _claims_createIdentity:

createIdentity
================================================================================

.. code-block:: typescript

  claims.createIdentity(accountId);

Creates a new identity for Account and registers them on the storage

----------
Parameters
----------

#. ``accountId`` - ``string``: the account identifier

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await claims.createIdentity(accounts[0]);



--------------------------------------------------------------------------------

.. _claims_setClaim:

setClaim
================================================================================

.. code-block:: typescript

  claims.setClaim(issuer, subject, claimName[, claimValue]);

Sets or creates a claim; this requires the issuer to have permissions for the parent claim (if claim
name seen as a path, the parent 'folder').

----------
Parameters
----------

#. ``issuer`` - ``string``: issuer of the claim
#. ``subject`` - ``string``: subject of the claim and the owner of the claim node
#. ``claimName`` - ``string``: name of the claim (full path)
#. ``claimValue`` - ``string`` (optional): bytes32 hash of the claims value, will not be set if omitted

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await claims.setClaim(accounts[0], accounts[1], '/company');



--------------------------------------------------------------------------------

.. _claims_getClaims:

getClaims
================================================================================

.. code-block:: typescript

  claims.getClaims(claimName, subject, isIdentity);

gets claim informations for a claim name from a given account

----------
Parameters
----------

#. ``claimName`` - ``string``: name (/path) of a claim
#. ``subject`` - ``string``: subject of the claims
#. ``isIdentity`` - ``string``(optional): indicates if the subject is already a identity address

-------
Returns
-------

``Promise`` returns ``any``: claim info array, contains: issuer, name, status, subject, data, uri, signature, creatioonDate

-------
Example
-------

.. code-block:: typescript

  await claims.setClaim(accounts[0], accounts[1], '/company');
  console.dir(await claims.getClaims('/company', accounts[1]));
  // Output:
  [{ issuer: '0x0000000000000000000000000000000000000001',
    name: '/company',
    status: 1
    subject: '0x0000000000000000000000000000000000000002',
    data: '0x0000000000000000000000000000000000000000000000000000000000000000',
    uri: '',
    signature: '0x0000000000000000000000000000000000000000000000000000000000000000',
    creationDate: 1234567890,
    id: '0x0000000000000000000000000000000000000000000000000000000000000000',
    valid: true }]



--------------------------------------------------------------------------------

.. _claims_identityAvailable:

identityAvailable
================================================================================

.. code-block:: typescript

  claims.identityAvailable(subject);

checks if a account has already a identity contract

----------
Parameters
----------

#. ``subject`` - ``string``: subject of the claims

-------
Returns
-------

``Promise`` returns ``any``: true if identity exists, otherwise false

-------
Example
-------

.. code-block:: typescript

  console.dir(await claims.identityAvailable(accounts[1]));
  // Output:
  true



--------------------------------------------------------------------------------


.. _claims_validateClaim:

validateClaim
================================================================================

.. code-block:: typescript

  claims.validateClaim(claimId, subject);

validates a given claimId in case of integrity

----------
Parameters
----------

#. ``claimId`` - ``string``: The claim identifier
#. ``subject`` - ``string``: subject of the claims

-------
Returns
-------

``Promise`` returns ``any``: resolves with true if the claim is valid, otherwise false

-------
Example
-------

.. code-block:: typescript

  console.dir(await claims.validateClaim('0x0000000000000000000000000000000000000000000000000000000000000000', accounts[1]));
  // Output:
  true



--------------------------------------------------------------------------------

.. _claims_validateClaimTree:

validateClaimTree
================================================================================

.. code-block:: typescript

  claims.validateClaimTree(claimLabel, subject, treeArr);

validates a whole claim tree if the path is valid (called recursive)

----------
Parameters
----------

#. ``claimLabel`` - ``string``: The full claim label
#. ``subject`` - ``string``: subject of the claims
#. ``treeArr`` - ``array``: the result tree array, defaults to []
-------
Returns
-------

``Promise`` returns ``any``: Array with all resolved claims for the tree

-------
Example
-------

.. code-block:: typescript

  console.dir(await claims.validateClaimTree('/company/test/foo', accounts[1]));
  // Output:
  [{ issuer: '0x0000000000000000000000000000000000000001',
    name: '/company/test/foo',
    status: 1
    subject: '0x0000000000000000000000000000000000000002',
    data: '0x0000000000000000000000000000000000000000000000000000000000000000',
    uri: '',
    signature: '0x0000000000000000000000000000000000000000000000000000000000000000',
    creationDate: 1234567890,
    id: '0x0000000000000000000000000000000000000000000000000000000000000000',
    valid: true },
    { issuer: '0x0000000000000000000000000000000000000001',
    name: '/company/test',
    status: 1
    subject: '0x0000000000000000000000000000000000000002',
    data: '0x0000000000000000000000000000000000000000000000000000000000000000',
    uri: '',
    signature: '0x0000000000000000000000000000000000000000000000000000000000000000',
    creationDate: 1234567890,
    id: '0x0000000000000000000000000000000000000000000000000000000000000000',
    valid: true }]


--------------------------------------------------------------------------------

.. _claims_deleteClaim:

deleteClaim
================================================================================

.. code-block:: typescript

  claims.deleteClaim(subject, claimName, issuer);

Delete a claim. This requires the **issuer** to have permissions for the parent claim (if claim name seen as a path, the parent 'folder'). Subjects of a claim may only delete it, if they are the issuer as well. If not, they can only react to it by confirming or rejecting the claim.

----------
Parameters
----------

#. ``subject`` - ``string``: the subject of the claim
#. ``claimName`` - ``string``: name of the claim (full path)
#. ``issuer`` - ``string``: issuer of the claim

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await claims.setClaim(accounts[0], accounts[1], '/company');
  await claims.deleteClaim(accounts[0], '/company', accounts[1]);



--------------------------------------------------------------------------------



= Subjects =
==========================



.. _claims_confirmClaim:

confirmClaim
================================================================================

.. code-block:: typescript

  claims.confirmClaim(subject, claimName[, claimValue]);

Confirms a claim; this can be done, it a claim has been issued for a subject and the subject wants to confirms it.

----------
Parameters
----------

#. ``subject`` - ``string``: account, that approves the claim
#. ``claimName`` - ``string``: name of the claim (full path)
#. ``issuer`` - ``string``: The issuer which has signed the claim

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await claims.setClaim(accounts[0], accounts[1], '/company');
  await claims.confirmClaim(accounts[1], '/company', accounts[0]);



--------------------------------------------------------------------------------


= Deployment =
==========================



.. _claims_createStructure:

createStructure
================================================================================

.. code-block:: typescript

  claims.createStructure(accountId);

Create a new claims structure; this includes a userregistry and the associated libraries. This
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

  const claimsStructure = await claims.createStructure(accountId);
  console.log(claimsStructure.storage.options.address);
  // Output:
  // 0x000000000000000000000000000000000000000a



.. required for building markup

.. |source contractLoader| replace:: ``ContractLoader``
.. _source contractLoader: /contracts/contract-loader.html

.. |source executor| replace:: ``Executor``
.. _source executor: /blockchain/executor.html

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: /common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: /common/logger.html#logloginterface

.. |source nameResolver| replace:: ``NameResolver``
.. _source nameResolver: /blockchain/name-resolver.html

.. |source accountStore| replace:: ``AccountStore``
.. _source accountStore: /blockchain/account-store.html