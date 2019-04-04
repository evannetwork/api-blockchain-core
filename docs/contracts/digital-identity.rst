================================================================================
DigitalIdentity
================================================================================

.. list-table:: 
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - DigitalIdentity
   * - Extends
     - `Logger <../common/logger.html>`_
   * - Source
     - `digital-identity.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/contracts/digital-identity/digital-identity.ts>`_
   * - Examples
     - `digital-identity.spec.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/contracts/digital-identity/digital-identity.spec.ts>`_

This place is reserved for a more detailed explanation about what a digital identity is and what it is used for. Examples offer clear and practical approach on how to interact with it and how someone can embed Digital Identities in ones own code.

Amet sunt velit non dolor dolore culpa occaecat consectetur dolor consequat nisi nisi quis amet culpa laboris ut tempor elit laboris aute mollit in esse voluptate excepteur ea esse sint ut ullamco adipisicing esse irure in id.

Cillum irure eiusmod mollit et cupidatat laboris pariatur dolore in aliqua in dolor aute non do ex do sed amet exercitation culpa proident.

Eiusmod ut mollit sed ea commodo aliqua reprehenderit veniam in dolore ut incididunt labore incididunt.



--------------------------------------------------------------------------------

.. _digital-identity_constructor:

constructor
================================================================================

.. code-block:: typescript

  new DigitalIdentity(options, config);

Create new ``DigitalIdentity`` instance. This will not create a smart contract contract but is used to
load existing digital identities. To create a new contract, use the static :ref:`create <digital-identity_create>` function.

----------
Parameters
----------

#. ``options`` - ``DigitalIdentityOptions``: runtime-like object with required modules
    * ``contractLoader`` - |source contractLoader|_: |source contractLoader|_ instance
    * ``cryptoProvider`` - |source cryptoProvider|_: |source cryptoProvider|_ instance
    * ``dataContract`` - |source dataContract|_: |source dataContract|_ instance
    * ``description`` - |source description|_: |source description|_ instance
    * ``executor`` - |source executor|_: |source executor|_ instance
    * ``nameResolver`` - |source nameResolver|_: |source nameResolver|_ instance
    * ``rightsAndRoles`` - |source rightsAndRoles|_: |source rightsAndRoles|_ instance
    * ``sharing`` - |source sharing|_: |source sharing|_ instance
    * ``verifications`` - |source verifications|_: |source verifications|_ instance
    * ``web3`` - |source web3|_: |source web3|_ instance
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``
#. ``config`` - ``DigitalIdentityConfig``: digital identity related config
    * ``accountId`` - ``string``: account id of user, that interacts with digital identity
    * ``containerConfig`` - ``ContainerConfig``: address of a ``DigitalIdentity`` instance, can be ENS or contract address
    * ``address`` - ``string`` (optional): address of an ``IndexContract`` instance, can be ENS or contract address
    * ``description`` - ``string``: description has to be passed to ``.create`` to apply it to to contract
    * ``factoryAddress`` - ``string`` (optional): factory address can be passed to ``.create`` for customer digital identity factory

-------
Returns
-------

``DigitalIdentity`` instance

-------
Example
-------

.. code-block:: typescript

  const digitalIdentity = new DigitalIdentity(
    runtime,
    {
      accountId: '0x0000000000000000000000000000000000000000',
      address: 'sample-digital-identity.somewhere.evan',
    },
  );



--------------------------------------------------------------------------------

= Creating Digital Identities =
===============================

.. _digital-identity_create:

create
================================================================================

.. code-block:: typescript

  DigitalIdentity.create(runtime, config);

Create digital identity contract.

Note, that this function is static. It is used on the ``DigitalIdentity`` class object and returns a ``DigitalIdentity`` class instance.

The options argument has the same structure as the options object that is passed to the constructor as it is used for the new ``DigitalIdentity`` instance. The ``config`` argument requires a proper value for the property ``description``.

----------
Parameters
----------

#. ``options`` - ``ContainerOptions``: runtime-like object with required modules
    * ``contractLoader`` - |source contractLoader|_: |source contractLoader|_ instance
    * ``cryptoProvider`` - |source cryptoProvider|_: |source cryptoProvider|_ instance
    * ``dataContract`` - |source dataContract|_: |source dataContract|_ instance
    * ``description`` - |source description|_: |source description|_ instance
    * ``executor`` - |source executor|_: |source executor|_ instance
    * ``nameResolver`` - |source nameResolver|_: |source nameResolver|_ instance
    * ``rightsAndRoles`` - |source rightsAndRoles|_: |source rightsAndRoles|_ instance
    * ``sharing`` - |source sharing|_: |source sharing|_ instance
    * ``verifications`` - |source verifications|_: |source verifications|_ instance
    * ``web3`` - |source web3|_: |source web3|_ instance
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``
#. ``config`` - ``DigitalIdentityConfig``: digital identity related config
    * ``accountId`` - ``string``: account id of user, that interacts with digital identity
    * ``containerConfig`` - ``ContainerConfig``: config, that will be used, when containers are created
    * ``address`` - ``string`` (optional): ENS address used for digital identity
    * ``description`` - ``string``: description has to be passed to ``.create`` to apply it to to contract
    * ``factoryAddress`` - ``string`` (optional): factory address can be passed to ``.create`` for customer digital identity factory

-------
Returns
-------

``Promise`` returns ``DigitalIdentity``: new instance bound to new ``IndexContract``

-------
Example
-------

.. code-block:: typescript

  const digitalIdentity = await DigitalIdentity.create(options, config);
  console.log(await digitalIdentity.getContractAddress());
  // Output:
  // 0x0000000000000000000000000000000000001234



--------------------------------------------------------------------------------

= Container =
=============

.. _digital-identity_createContainers:

createContainers
================================================================================

.. code-block:: typescript

  digitalIdentity.createContainers(containers);

Create new `Container` instances and add them as entry to identity.

When a container entry fetched with :ref:`getEntry <digital-identity_getEntry>` or :ref:`getEntry <digital-identity_getEntries>`, the value will become a ``Container`` instance and can be used as such.

----------
Parameters
----------

#. ``containers`` - ``{ [id: string]: Partial<ContainerConfig> }``: object with containers to create, name is used as entry name in identity

-------
Returns
-------

``Promise`` returns ``{ [id: string]: Container }``: map with ``Container`` instances

-------
Example
-------

.. code-block:: typescript

  const containers = await identity.createContainers({
    entry1: { template: 'metadata' },
    entry2: { template: 'metadata' },
  });



--------------------------------------------------------------------------------

= Entries =
===========

.. _digital-identity_setEntry:

setEntry
================================================================================

.. code-block:: typescript

  digitalIdentity.setEntry(name, value, entryType);

Set entry in index contract; entries are unique, setting the same name a second time will overwrite the first value.

----------
Parameters
----------

#. ``name`` - ``string``: entry name
#. ``value`` - ``string``: value to set
#. ``entryType`` - ``DigitalIdentityType``: type of given value

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await digitalIdentity.setEntry('myId', accountId, DigitalIdentityEntryType.AccountId);
  console.log((await digitalIdentity.getEntry('myId')).value);
  // Output:
  // 0x0000000000000000000000000000000000000001



--------------------------------------------------------------------------------

.. _digital-identity_setEntries:

setEntries
================================================================================

.. code-block:: typescript

  digitalIdentity.setEntries(arguments);

Set multiple entries at index contract.

----------
Parameters
----------

#. ``entries`` - ``{[id: string]: DigitalIdentityIndexEntry}``: entries to set

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const sampleContractId = '0x00000000000000000000000000000000c0274ac7';
  await digitalIdentity.setEntries({
    'account':  { value: accountId, entryType: DigitalIdentityEntryType.AccountId },
    'contract':  { value: sampleContractId, entryType: DigitalIdentityEntryType.GenericContract },
  });

  const result = (await digitalIdentity.getEntries()).map(entry => value);
  console.log(result.account.value);
  // Output:
  // 0x0000000000000000000000000000000000000001
  console.log(result.contract.value);
  // Output:
  // 0x00000000000000000000000000000000c0274ac7



--------------------------------------------------------------------------------

.. _digital-identity_getEntry:

getEntry
================================================================================

.. code-block:: typescript

  digitalIdentity.getEntry(name);

Get single entry from index contract.

----------
Parameters
----------

#. ``name`` - ``string``: entry name

-------
Returns
-------

``Promise`` returns ``DigitalIdentityIndexEntry``: entry object

-------
Example
-------

.. code-block:: typescript

  await digitalIdentity.setEntry('myId', accountId, DigitalIdentityEntryType.AccountId);
  console.log((await digitalIdentity.getEntry('myId')).value);
  // Output:
  // 0x0000000000000000000000000000000000000001



--------------------------------------------------------------------------------

.. _digital-identity_getEntries:

getEntries
================================================================================

.. code-block:: typescript

  digitalIdentity.getEntries();

Get all entries from index contract.

-------
Returns
-------

``Promise`` returns ``{[id: string]: DigitalIdentityIndexEntry}``: key-value map with all entries

-------
Example
-------

.. code-block:: typescript

  const sampleContractId = '0x00000000000000000000000000000000c0274ac7';
  await digitalIdentity.setEntries({
    'account':  { value: accountId, entryType: DigitalIdentityEntryType.AccountId },
    'contract':  { value: sampleContractId, entryType: DigitalIdentityEntryType.GenericContract },
  });

  const result = (await digitalIdentity.getEntries()).map(entry => value);
  console.log(result.account.value);
  // Output:
  // 0x0000000000000000000000000000000000000001
  console.log(result.contract.value);
  // Output:
  // 0x00000000000000000000000000000000c0274ac7



--------------------------------------------------------------------------------

= Verifications =
=================

.. _digital-identity_addVerification:

addVerification
================================================================================

.. code-block:: typescript

  digitalIdentity.addVerification(verifications);

Add verifications to this identity; this will also add verifications to contract description.

Due to the automatic expansion of the contract description, this function can only be called by the container owner.

See interface ``DigitalIdentityVerificationEntry`` for input data format.

----------
Parameters
----------

#. ``verifications`` - ``DigitalIdentityVerificationEntry[]``: list of verifications to add

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await digitalIdentity.addVerifications([{ topic: 'exampleVerification' }]);



--------------------------------------------------------------------------------

.. _digital-identity_getVerifications:

getVerifications
================================================================================

.. code-block:: typescript

  digitalIdentity.getVerifications();

Gets verifications from description and fetches list of verifications for each of them.

See |source verifications|_ documentation for details on output data format.

-------
Returns
-------

``Promise`` returns ``any``: list of verification lists from |source verifications|_, ``getVerifications`` 

-------
Example
-------

.. code-block:: typescript

  await digitalIdentity.addVerifications([{ topic: 'exampleVerification' }]);
  const verifications = await digitalIdentity.getVerifications());



--------------------------------------------------------------------------------

= Working with Digital Identity Descriptions =
==============================================

.. _digital-identity_getDescription:

getDescription
================================================================================

.. code-block:: typescript

  digitalIdentity.getDescription();

Returns description from digital identity.

-------
Returns
-------

``Promise`` returns ``any``: public part of the description

-------
Example
-------

.. code-block:: typescript

  const description = await container.getDescription();
  console.dir(description);
  // Output:
  // 2DO



--------------------------------------------------------------------------------

.. _digital-identity_setDescription:

setDescription
================================================================================

.. code-block:: typescript

  digitalIdentity.setDescription(description);

Write given description to digital identities DBCP.

----------
Parameters
----------

#. ``description`` - ``any``: description (public part)

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  // get current description
  const description = await digitalIdentity.getDescription();
  console.dir(description);
  // Output:
  // 2DO

  // update description
  description.title = 'I have been changed';
  await digitalIdentity.setDescription(description);

  // fetch again
  console.dir(await digitalIdentity.getDescription());
  // Output:
  // 2DO



--------------------------------------------------------------------------------

= Profile =
===========

.. _digital-identity_addAsFavorite:

addAsFavorite
================================================================================

.. code-block:: typescript

  digitalIdentity.addAsFavorite();

Add the digital identity with given address to profile.

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const digitalIdentity = new DigitalIdentity(options.config);
  if (await digitalIdentity.isFavorite()) {
    console.log('I know this digital identity!');
  } else {
    await digitalIdentity.addToFavorites();
    console.log('bookmarked digital identity');
  }



--------------------------------------------------------------------------------
.. _digital-identity_getFavorites:

getFavorites
================================================================================

.. code-block:: typescript

  DigitalIdentity.getFavorites();

Gets bookmarked identities from profile.

----------
Parameters
----------

#. ``options`` - ``ContainerOptions``: runtime-like object with required modules
    * ``contractLoader`` - |source contractLoader|_: |source contractLoader|_ instance
    * ``cryptoProvider`` - |source cryptoProvider|_: |source cryptoProvider|_ instance
    * ``dataContract`` - |source dataContract|_: |source dataContract|_ instance
    * ``description`` - |source description|_: |source description|_ instance
    * ``executor`` - |source executor|_: |source executor|_ instance
    * ``nameResolver`` - |source nameResolver|_: |source nameResolver|_ instance
    * ``rightsAndRoles`` - |source rightsAndRoles|_: |source rightsAndRoles|_ instance
    * ``sharing`` - |source sharing|_: |source sharing|_ instance
    * ``verifications`` - |source verifications|_: |source verifications|_ instance
    * ``web3`` - |source web3|_: |source web3|_ instance
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const favorites = await DigitalIdentity.getFavorites(options);
  console.dir(favorites);
  // Output:
  // [
  //  'example.somewhere.evan',
  //  'another.example.somewhere.else.evan',
  //  '0x0000000000000000000000000000000000001234'
  // ]



--------------------------------------------------------------------------------

.. _digitalIdentity_isFavorite:

isFavorite
================================================================================

.. code-block:: typescript

  digitalIdentity.isFavorite();

Check if this digital identity is bookmarked in profile.

-------
Returns
-------

``Promise`` returns ``boolean``: true if bookmarked

-------
Example
-------

.. code-block:: typescript

  const digitalIdentity = new DigitalIdentity(options.config);
  if (await digitalIdentity.isFavorite()) {
    console.log('I know this digital identity!');
  } else {
    await digitalIdentity.addToFavorites();
    console.log('bookmarked digital identity');
  }



--------------------------------------------------------------------------------

.. _digitalIdentity_removeFromFavorites:

removeFromFavorites
================================================================================

.. code-block:: typescript

  digitalIdentity.removeFromFavorites();

Removes the current identity from the favorites in profile.

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const digitalIdentity = new DigitalIdentity(options.config);
  if (await digitalIdentity.isFavorite()) {
    await digitalIdentity.removeFromFavorites();
    console.log('removed digital identity from favorites');
  }



--------------------------------------------------------------------------------

= Tools =
=========

.. _digital-identity_getValidity:

getValidity
================================================================================

.. code-block:: typescript

  DigitalIdentity.getValidity(options, ensAddress);

Check if a valid contract is located under the specified address, which allows to check for identities before actually loading them.

Return value properties have the following meaning:

- ``valid``: ``true`` if contract could not be found or if it doesn't have the tag "evan-digital-identity"
- ``exists``: ``true`` if a contract address could be found at given ENS address
- ``error``: an error object, if one of the other properties is ``false``

**Note, that this function is called on the Class ``DigitalIdentity`` and not on an instance of it.**

----------
Parameters
----------

#. ``options`` - ``DigitalIdentityOptions``: identity runtime options
    * ``contractLoader`` - |source contractLoader|_: |source contractLoader|_ instance
    * ``cryptoProvider`` - |source cryptoProvider|_: |source cryptoProvider|_ instance
    * ``dataContract`` - |source dataContract|_: |source dataContract|_ instance
    * ``description`` - |source description|_: |source description|_ instance
    * ``executor`` - |source executor|_: |source executor|_ instance
    * ``nameResolver`` - |source nameResolver|_: |source nameResolver|_ instance
    * ``rightsAndRoles`` - |source rightsAndRoles|_: |source rightsAndRoles|_ instance
    * ``sharing`` - |source sharing|_: |source sharing|_ instance
    * ``verifications`` - |source verifications|_: |source verifications|_ instance
    * ``web3`` - |source web3|_: |source web3|_ instance
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``
#. ``ensAddress`` - ``string``: ens address that should be checked

-------
Returns
-------

``Promise`` returns ``{ valid: boolean, exists: boolean, error: Error }``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const { valid } = await DigitalIdentity.getValidity(runtime, address);
  if (!valid) {
    throw new Error(`no valid digital identity found at "${address}"`);
  }



--------------------------------------------------------------------------------

.. _digital-identity_ensureContract:

ensureContract
================================================================================

.. code-block:: typescript

  digitalIdentity.ensureContract();

Check if digital identity contract already has been loaded, load from address / ENS if required.
Throws if contract could not be loaded.

This function is more commonly used for internal checks in the ``DigitalIdentity`` module. For checking, if a given address can be used, it is recommended to use :ref:`getValidity <digital-identity_getValidity>`.

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  let digitalIdentity;
  try {
    digitalIdentity = new DigitalIdentity(options, config);
    await digitalIdentity.ensureContract();
    // use digital identity
  } catch (ex) {
    console.error(`could use digital identity; ${ex.message || ex}`);
  }



--------------------------------------------------------------------------------

.. _digital-identity_getContractAddress:

getContractAddress
================================================================================

.. code-block:: typescript

  digitalIdentity.getContractAddress();

Get contract address of underlying IndexContract.

-------
Returns
-------

``Promise`` returns ``string``: contract address

-------
Example
-------

.. code-block:: typescript

  const digitalIdentity = new DigitalIdentity(options, config);
  console.log(await digitalIdentity.getContractAddress());
  // Output:
  // 0x000000000000000000000000000000001d327171



--------------------------------------------------------------------------------

Additional Components
======================

Enums
=====

.. _digital-identity_DigitalIdentityEntryType:

------------------------
DigitalIdentityEntryType
------------------------

possible entry types for entries in index

#. ``AccountId``
#. ``ContainerContract``
#. ``FileHash``
#. ``GenericContract``
#. ``Hash``
#. ``IndexContract``



Interfaces
==========

.. _digital-identity_ContainerConfig:

---------------------
DigitalIdentityConfig
---------------------

config for digital identity

#. ``accountId`` - ``string``: account id of user, that interacts with digital identity
#. ``containerConfig`` - ``ContainerConfig``: address of a ``DigitalIdentity`` instance, can be ENS or contract address
#. ``address`` - ``string`` (optional): address of an ``IndexContract`` instance, can be ENS or contract address
#. ``description`` - ``string`` (optional): description has to be passed to ``.create`` to apply it to to contract
#. ``factoryAddress`` - ``string`` (optional): factory address can be passed to ``.create`` for customer digital identity factory



.. _digital-identity_DigitalIdentityIndexEntry:

-------------------------
DigitalIdentityIndexEntry
-------------------------

container for digital identity entry values

#. ``entryType`` - ``DigitalIdentityEntryType`` (optional): type of entry in index
#. ``raw`` - ``any`` (optional): raw value (``bytes32`` hash)
#. ``value`` - ``any`` (optional): decrypted/loaded value



.. _digital-identity_DigitalIdentityVerificationEntry:

--------------------------------
DigitalIdentityVerificationEntry
--------------------------------

data for verifications for digital identities

#. ``topic`` - ``string``: name of the verification (full path)
#. ``descriptionDomain`` - ``string`` (optional): domain of the verification, this is a subdomain under 'verifications.evan', so passing 'example' will link verifications
#. ``disableSubVerifications`` - ``boolean`` (optional): if true, verifications created under  this path are invalid, defaults to ``false``
#. ``expirationDate`` - ``number`` (optional): expiration date, for the verification, defaults to `0` (does not expire)
#. ``verificationValue`` - ``any`` (optional): json object which will be stored in the verification



.. required for building markup

.. |source contractLoader| replace:: ``ContractLoader``
.. _source contractLoader: ../contracts/contract-loader.html

.. |source dataContract| replace:: ``DataContract``
.. _source dataContract: ../contracts/data-contract.html

.. |source cryptoProvider| replace:: ``CryptoProvider``
.. _source cryptoProvider: /encryption/crypto-provider.html

.. |source description| replace:: ``Description``
.. _source description: ../blockchain/description.html

.. |source executor| replace:: ``Executor``
.. _source executor: ../blockchain/executor.html

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: ../common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: ../common/logger.html#logloginterface

.. |source nameResolver| replace:: ``NameResolver``
.. _source nameResolver: ../blockchain/name-resolver.html

.. |source rightsAndRoles| replace:: ``RightsAndRoles``
.. _source rightsAndRoles: ../contracts/rights-and-roles.html

.. |source sharing| replace:: ``Sharing``
.. _source sharing: ../contracts/sharing.html

.. |source verifications| replace:: ``Verifications``
.. _source verifications: ../profile/verifications.html

.. |source web3| replace:: ``Web3``
.. _source web3: https://github.com/ethereum/web3.js/
