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
- confirm or reject claims about oneself

Claims have a pattern similar to file paths or DNS/ENS domains, a claim for an account called "foo" being an employee of a company called "bar" may look like this:

``/company/bar/employee/foo``

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
- ``content``
  extra data attached to a ``claim``, the value is of type ``bytes32``,
  binary data like files, etc. can be encrypted (if desired) and uploaded to a ``DFS`` and then references as a ``bytes32`` hash
- ``self issued content``
  this represents a ``subjects`` value for a certificate,
  ``subjects`` can attach an own value to a claim to show approval or disapproval of a claims value,
  for the content to be seen as valid, ``issuers`` content value and ``subjects`` content value must equal
- ``self issed state``
  this represents a ``subjects`` "opinion" about a claim,
  values are ``uint8`` range from 0 to 255, the currently used values are:
  - 0: unset / no response from ``subject``
  - 1: rejection of claim
  - 2: approval of claim


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
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``
    * ``registry`` - ``string`` (optional): contract address of the claims registry
    * ``resolver`` - ``string`` (optional): contract address of the claims default resolver

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
    registry: '0x0000000000000000000000000000000000000001',
    resolver: '0x0000000000000000000000000000000000000002',
  });
  await mailbox.init();



--------------------------------------------------------------------------------



= Issuers =
==========================



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

.. _claims_getClaim:

getClaim
================================================================================

.. code-block:: typescript

  claims.getClaim(claimName);

Gets claim information for a claim name.

----------
Parameters
----------

#. ``claimName`` - ``string``: name (/path) of a claim

-------
Returns
-------

``Promise`` returns ``any``: claim info, contains: issuer, name, selfIssuedState, selfIssuedValue, status,
subject, value

-------
Example
-------

.. code-block:: typescript

  await claims.setClaim(accounts[0], accounts[1], '/company');
  console.dir(await claims.getClaim('/company'));
  // Output:
  { issuer: '0x0000000000000000000000000000000000000001',
    name: '/company',
    selfIssuedState: '0',
    selfIssuedValue: '0x0000000000000000000000000000000000000000000000000000000000000000',
    status: 3,
    subject: '0x0000000000000000000000000000000000000002',
    value: '0x0000000000000000000000000000000000000000000000000000000000000000' }





--------------------------------------------------------------------------------

.. _claims_deleteClaim:

deleteClaim
================================================================================

.. code-block:: typescript

  claims.deleteClaim(issuer, claimName);

Delete a claim. This requires the **issuer** to have permissions for the parent claim (if claim name seen as a path, the parent 'folder'). Subjects of a claim may only delete it, if they are the issuer as well. If not, they can only react to it by confirming or rejecting the claim.

----------
Parameters
----------

#. ``issuer`` - ``string``: issuer of the claim
#. ``claimName`` - ``string``: name of the claim (full path)

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await claims.setClaim(accounts[0], accounts[1], '/company');
  await claims.deleteClaim(accounts[0], '/company');



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
#. ``claimValue`` - ``string`` (optional): bytes32 hash of the claim value; this is the subjects value for the claim and has to be the as the issuers value for the claim, will not be set if omitted

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await claims.setClaim(accounts[0], accounts[1], '/company');
  await claims.confirmClaim(accounts[1], '/company');



--------------------------------------------------------------------------------

.. _claims_rejectClaim:

rejectClaim
================================================================================

.. code-block:: typescript

  claims.rejectClaim(subject, claimName[, claimValue]);

Rejects a claim; this can be done, it a claim has been issued for a subject and the subject wants to
reject it.

----------
Parameters
----------

#. ``subject`` - ``string``: account, that approves the claim
#. ``claimName`` - ``string``: name of the claim (full path)
#. ``claimValue`` - ``string`` (optional): bytes32 hash of the claim value; this is the subjects value for the claim and may differ from the issuers value for the claim

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await claims.setClaim(accounts[0], accounts[1], '/company');
  await claims.rejectClaim(accounts[1], '/company');



--------------------------------------------------------------------------------



= Deployment =
==========================



.. _claims_createStructure:

createStructure
================================================================================

.. code-block:: typescript

  claims.createStructure(accountId);

Create a new claims structure; this includes a new registry and a default resolver for it. This
isn't required for creating a module instance, its is solely used for creating new structures on the
blockchain.

----------
Parameters
----------

#. ``accountId`` - ``string``: account, that execute the transaction and owner of the new registry

-------
Returns
-------

``Promise`` returns ``any``: object with properties 'registry' and 'resolver', that are web3js
contract instances

-------
Example
-------

.. code-block:: typescript

  const claimsStructure = await claims.createStructure(accountId);
  console.log(claimsStructure.registry.options.address);
  // Output:
  // 0x000000000000000000000000000000000000000a
  console.log(claimsStructure.resolver.options.address);
  // Output:
  // 0x000000000000000000000000000000000000000b



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