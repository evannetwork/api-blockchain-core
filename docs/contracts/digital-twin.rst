================================================================================
Digital Twin
================================================================================

.. list-table:: 
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - DigitalTwin
   * - Extends
     - `Logger <../common/logger.html>`_
   * - Source
     - `digital-twin.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/contracts/digital-twin/digital-twin.ts>`_
   * - Examples
     - `digital-twin.spec.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/contracts/digital-twin/digital-twin.spec.ts>`_

TL;DR: usage examples and a data flow can be found :doc:`here <./digital-twin-usage-examples>`.

A ``DigitalTwin`` is a wrapper, that holds data or references to data. This data can be

- a |source Container|_ - This is the most common use case, actual data is stored in the container and the ``DigitalTwin`` merely holds a reference to the container.
- an ``DigitalTwin`` - DigitalTwins can be linked together, so an entry can be another ``DigitalTwin``, which allows to navigate through twins to retrieve data properties from linked twins, see :ref:`getEntry <digital-twin_getEntry>`
- an identity/account address / a contract address
- ``bytes32`` hashes (e.g. file hashes)



--------------------------------------------------------------------------------

.. _digital-twin_constructor:

constructor
================================================================================

.. code-block:: typescript

  new DigitalTwin(options, config);

Create new ``DigitalTwin`` instance. This will not create a smart contract contract but is used to
load existing digital twins. To create a new contract, use the static :ref:`create <digital-twin_create>` function.

----------
Parameters
----------

#. ``options`` - ``DigitalTwinOptions``: runtime-like object with required modules
    * ``contractLoader`` - |source contractLoader|_: |source contractLoader|_ instance
    * ``cryptoProvider`` - |source cryptoProvider|_: |source cryptoProvider|_ instance
    * ``dataContract`` - |source dataContract|_: |source dataContract|_ instance
    * ``description`` - |source description|_: |source description|_ instance
    * ``executor`` - |source executor|_: |source executor|_ instance
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``
    * ``nameResolver`` - |source nameResolver|_: |source nameResolver|_ instance
    * ``profile`` - |source profile|_: |source profile|_ instance
    * ``rightsAndRoles`` - |source rightsAndRoles|_: |source rightsAndRoles|_ instance
    * ``sharing`` - |source sharing|_: |source sharing|_ instance
    * ``verifications`` - |source verifications|_: |source verifications|_ instance
    * ``web3`` - |source web3|_: |source web3|_ instance
#. ``config`` - ``DigitalTwinConfig``: digital twin related config
    * ``accountId`` - ``string``: identity or account of user, that interacts with digital twin
    * ``containerConfig`` - ``ContainerConfig``: address of a ``DigitalTwin`` instance, can be ENS or contract address
    * ``address`` - ``string`` (optional): address of an ``DigitalTwin`` instance, can be ENS or contract address
    * ``description`` - ``string``: description has to be passed to ``.create`` to apply it to to contract
    * ``factoryAddress`` - ``string`` (optional): factory address can be passed to ``.create`` for customer digital twin factory

-------
Returns
-------

``DigitalTwin`` instance

-------
Example
-------

.. code-block:: typescript

  const digitalTwin = new DigitalTwin(
    runtime,
    {
      accountId: '0x0000000000000000000000000000000000000000',
      address: 'sample-digital-twin.somewhere.evan',
    },
  );



--------------------------------------------------------------------------------

= Creating Digital Identities =
===============================

.. _digital-twin_create:

create
================================================================================

.. code-block:: typescript

  DigitalTwin.create(runtime, config);

Create digital twin contract.

Note, that this function is static. It is used on the ``DigitalTwin`` class object and returns a ``DigitalTwin`` class instance.

The options argument has the same structure as the options object that is passed to the constructor as it is used for the new ``DigitalTwin`` instance. The ``config`` argument requires a proper value for the property ``description``.

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
#. ``config`` - ``DigitalTwinConfig``: digital twin related config
    * ``accountId`` - ``string``: identity or account of user, that interacts with digital twin
    * ``containerConfig`` - ``ContainerConfig``: config, that will be used, when containers are created
    * ``address`` - ``string`` (optional): ENS address used for digital twin
    * ``description`` - ``string``: description has to be passed to ``.create`` to apply it to to contract
    * ``factoryAddress`` - ``string`` (optional): factory address can be passed to ``.create`` for customer digital twin factory
    * ``plugins`` - ``{ [pluginName: string]: ContainerPlugin }`` (optional): set of container plugins that should be applied to the twin directly with the creationg (will be passed to the `createContainers` function)

-------
Returns
-------

``Promise`` returns ``DigitalTwin``: new instance bound to new ``DigitalTwin``

-------
Example
-------

.. code-block:: typescript

  const digitalTwin = await DigitalTwin.create(options, config);
  console.log(await digitalTwin.getContractAddress());
  // Output:
  // 0x0000000000000000000000000000000000001234



--------------------------------------------------------------------------------

= Container =
=============

.. _digital-twin_createContainers:

createContainers
================================================================================

.. code-block:: typescript

  digitalTwin.createContainers(containers);

Create new `Container` instances and add them as entry to twin.

When a container entry fetched with :ref:`getEntry <digital-twin_getEntry>` or :ref:`getEntry <digital-twin_getEntries>`, the value will become a ``Container`` instance and can be used as such.

----------
Parameters
----------

#. ``containers`` - ``{ [id: string]: Partial<ContainerConfig> }``: object with containers to create, name is used as entry name in twin

-------
Returns
-------

``Promise`` returns ``{ [id: string]: Container }``: map with ``Container`` instances

-------
Example
-------

.. code-block:: typescript

  const containers = await twin.createContainers({
    entry1: { template: 'metadata' },
    entry2: { template: 'metadata' },
  });



--------------------------------------------------------------------------------

= Entries =
===========

.. _digital-twin_setEntry:

setEntry
================================================================================

.. code-block:: typescript

  digitalTwin.setEntry(name, value, entryType);

Set entry in index contract; entries are unique, setting the same name a second time will overwrite the first value.

----------
Parameters
----------

#. ``name`` - ``string``: entry name
#. ``value`` - ``string``: value to set
#. ``entryType`` - ``DigitalTwinType``: type of given value

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await digitalTwin.setEntry('myId', accountId, DigitalTwinEntryType.AccountId);
  console.log((await digitalTwin.getEntry('myId')).value);
  // Output:
  // 0x0000000000000000000000000000000000000001



--------------------------------------------------------------------------------

.. _digital-twin_setEntries:

setEntries
================================================================================

.. code-block:: typescript

  digitalTwin.setEntries(arguments);

Set multiple entries at index contract.

----------
Parameters
----------

#. ``entries`` - ``{[id: string]: DigitalTwinIndexEntry}``: entries to set

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const sampleContractId = '0x00000000000000000000000000000000c0274ac7';
  await digitalTwin.setEntries({
    'account':  { value: accountId, entryType: DigitalTwinEntryType.AccountId },
    'contract':  { value: sampleContractId, entryType: DigitalTwinEntryType.GenericContract },
  });

  const result = (await digitalTwin.getEntries()).map(entry => value);
  console.log(result.account.value);
  // Output:
  // 0x0000000000000000000000000000000000000001
  console.log(result.contract.value);
  // Output:
  // 0x00000000000000000000000000000000c0274ac7



--------------------------------------------------------------------------------

.. _digital-twin_getEntry:

getEntry
================================================================================

.. code-block:: typescript

  digitalTwin.getEntry(name);

Get single entry from index contract.

When this twin has other twins as its entries, properties from those can be selected by building a path of properties.

For example a twin called ``car`` may have a link to another twin under the name ``tire``. The twin ``tire`` has an entry called ``metadata``. It is possible to retrieve this entry from the twin ``car`` with:

.. code-block:: typescript

  const tireMetadata = await car.getEntry('tire/metadata');

----------
Parameters
----------

#. ``name`` - ``string``: entry name or path to data in linked twin

-------
Returns
-------

``Promise`` returns ``DigitalTwinIndexEntry``: entry object

-------
Example
-------

.. code-block:: typescript

  await digitalTwin.setEntry('myId', accountId, DigitalTwinEntryType.AccountId);
  console.log((await digitalTwin.getEntry('myId')).value);
  // Output:
  // 0x0000000000000000000000000000000000000001



--------------------------------------------------------------------------------

.. _digital-twin_getEntries:

getEntries
================================================================================

.. code-block:: typescript

  digitalTwin.getEntries();

Get all entries from index contract.

-------
Returns
-------

``Promise`` returns ``{[id: string]: DigitalTwinIndexEntry}``: key-value map with all entries

-------
Example
-------

.. code-block:: typescript

  const sampleContractId = '0x00000000000000000000000000000000c0274ac7';
  await digitalTwin.setEntries({
    'account':  { value: accountId, entryType: DigitalTwinEntryType.AccountId },
    'contract':  { value: sampleContractId, entryType: DigitalTwinEntryType.GenericContract },
  });

  const result = (await digitalTwin.getEntries()).map(entry => value);
  console.log(result.account.value);
  // Output:
  // 0x0000000000000000000000000000000000000001
  console.log(result.contract.value);
  // Output:
  // 0x00000000000000000000000000000000c0274ac7



--------------------------------------------------------------------------------

= Verifications =
=================

.. _digital-twin_addVerifications:

addVerifications
================================================================================

.. code-block:: typescript

  digitalTwin.addVerifications(verifications);

Add verifications to this twin; this will also add verifications to contract description.

If the calling account is the owner of the identity of the digital twin

- the description will is automatically updated with tags for verifications
- verifications issued with this function will be accepted automatically

See interface ``DigitalTwinVerificationEntry`` for input data format.

----------
Parameters
----------

#. ``verifications`` - ``DigitalTwinVerificationEntry[]``: list of verifications to add

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await digitalTwin.addVerifications([{ topic: 'exampleVerification' }]);



--------------------------------------------------------------------------------

.. _digital-twin_getVerifications:

getVerifications
================================================================================

.. code-block:: typescript

  digitalTwin.getVerifications();

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

  await digitalTwin.addVerifications([{ topic: 'exampleVerification' }]);
  const verifications = await digitalTwin.getVerifications());



--------------------------------------------------------------------------------

= Descriptions =
================

.. _digital-twin_getDescription:

getDescription
================================================================================

.. code-block:: typescript

  digitalTwin.getDescription();

Returns description from digital twin.

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
  // { name: 'test twin',
  //   description: 'twin from test run',
  //   author: 'evan GmbH',
  //   version: '0.1.0',
  //   dbcpVersion: 2,
  //   tags: [ 'evan-digital-twin' ],
  //   identity:
  //    '0x1a496043385fec8d52f61e2b700413f8e12eb6e7e11649f80c8f4716c1063d06' }



--------------------------------------------------------------------------------

.. _digital-twin_setDescription:

setDescription
================================================================================

.. code-block:: typescript

  digitalTwin.setDescription(description);

Write given description to digital twins DBCP.

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
  const description = await digitalTwin.getDescription();
  console.dir(description);
  // Output:
  // { name: 'test twin',
  //   description: 'twin from test run',
  //   author: 'evan GmbH',
  //   version: '0.1.0',
  //   dbcpVersion: 2,
  //   tags: [ 'evan-digital-twin' ],
  //   identity:
  //    '0x1a496043385fec8d52f61e2b700413f8e12eb6e7e11649f80c8f4716c1063d06' }

  // update description
  description.version = '0.1.1';
  await digitalTwin.setDescription(description);

  // fetch again
  console.dir(await digitalTwin.getDescription());
  // Output:
  // { name: 'test twin',
  //   description: 'twin from test run',
  //   author: 'evan GmbH',
  //   version: '0.1.1',
  //   dbcpVersion: 2,
  //   tags: [ 'evan-digital-twin' ],
  //   identity:
  //    '0x1a496043385fec8d52f61e2b700413f8e12eb6e7e11649f80c8f4716c1063d06' }



--------------------------------------------------------------------------------

= Profile =
===========

.. _digital-twin_addAsFavorite:

addAsFavorite
================================================================================

.. code-block:: typescript

  digitalTwin.addAsFavorite();

Add the digital twin with given address to profile.

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const digitalTwin = new DigitalTwin(options.config);
  if (await digitalTwin.isFavorite()) {
    console.log('I know this digital twin!');
  } else {
    await digitalTwin.addToFavorites();
    console.log('bookmarked digital twin');
  }



--------------------------------------------------------------------------------
.. _digital-twin_getFavorites:

getFavorites
================================================================================

.. code-block:: typescript

  DigitalTwin.getFavorites();

Gets bookmarked twins from profile.

**Note, that this function is called on the Class DigitalTwin and not on an instance of it.**

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

  const favorites = await DigitalTwin.getFavorites(options);
  console.dir(favorites);
  // Output:
  // [
  //  'example.somewhere.evan',
  //  'another.example.somewhere.else.evan',
  //  '0x0000000000000000000000000000000000001234'
  // ]



--------------------------------------------------------------------------------

.. _digital-twin_isFavorite:

isFavorite
================================================================================

.. code-block:: typescript

  digitalTwin.isFavorite();

Check if this digital twin is bookmarked in profile.

-------
Returns
-------

``Promise`` returns ``boolean``: true if bookmarked

-------
Example
-------

.. code-block:: typescript

  const digitalTwin = new DigitalTwin(options.config);
  if (await digitalTwin.isFavorite()) {
    console.log('I know this digital twin!');
  } else {
    await digitalTwin.addToFavorites();
    console.log('bookmarked digital twin');
  }



--------------------------------------------------------------------------------

.. _digital-twin_removeFromFavorites:

removeFromFavorites
================================================================================

.. code-block:: typescript

  digitalTwin.removeFromFavorites();

Removes the current twin from the favorites in profile.

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const digitalTwin = new DigitalTwin(options.config);
  if (await digitalTwin.isFavorite()) {
    await digitalTwin.removeFromFavorites();
    console.log('removed digital twin from favorites');
  }



--------------------------------------------------------------------------------

= Utilities =
=============

.. _digital-twin_getValidity:

getValidity
================================================================================

.. code-block:: typescript

  DigitalTwin.getValidity(options, ensAddress);

Check if a valid contract is located under the specified address, which allows to check for twins before actually loading them.

Return value properties have the following meaning:

- ``valid``: ``true`` if contract could not be found or if it doesn't have the tag "evan-digital-twin"
- ``exists``: ``true`` if a contract address could be found at given ENS address
- ``error``: an error object, if one of the other properties is ``false``

**Note, that this function is called on the Class DigitalTwin and not on an instance of it.**

----------
Parameters
----------

#. ``options`` - ``DigitalTwinOptions``: twin runtime options
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

  const { valid } = await DigitalTwin.getValidity(runtime, address);
  if (!valid) {
    throw new Error(`no valid digital twin found at "${address}"`);
  }



--------------------------------------------------------------------------------

.. _digital-twin_ensureContract:

ensureContract
================================================================================

.. code-block:: typescript

  digitalTwin.ensureContract();

Check if digital twin contract already has been loaded, load from address / ENS if required.
Throws if contract could not be loaded.

This function is more commonly used for internal checks in the ``DigitalTwin`` module. For checking, if a given address can be used, it is recommended to use :ref:`getValidity <digital-twin_getValidity>`.

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  let digitalTwin;
  try {
    digitalTwin = new DigitalTwin(options, config);
    await digitalTwin.ensureContract();
    // use digital twin
  } catch (ex) {
    console.error(`could use digital twin; ${ex.message || ex}`);
  }



--------------------------------------------------------------------------------

.. _digital-twin_exportAsTemplate:

exportAsTemplate
================================================================================

.. code-block:: typescript

  digitalTwin.exportAsTemplate();

Exports the twin template definition for this twin. Includes the twins dbcp descriptions and all plugins, created out of the twin containers definitions. Can also export container values within the plugin definitions.

You can find a sample twin template here: |source twinTemplate|_

-------
Returns
-------

``Promise`` returns ``DigitalTwinTemplate``: digital twin template definition
  * ``descriptions`` - ``any``: digital twin description
  * ``plugins`` - `` { [pluginName: string]: ContainerPlugin }``: plugins for all containers

-------
Example
-------

.. code-block:: typescript

  const configWithTemplate = {
    ...defaultConfig,
    ...twinTemplate,
  };
  const twin = await DigitalTwin.create(runtime, configWithTemplate);
  const template = await twin.exportAsTemplate();

  console.log(template);
  // {
  //   "description": { ... },
  //   "plugins": {
  //     "plugin1": {
  //       "description": {
  //         ...
  //       },
  //       "template": {
  //         ...
  //       }
  //     },
  //     "pluginX": {
  //       ...
  //     }
  //   }
  // }


--------------------------------------------------------------------------------

.. _digital-twin_getContractAddress:

getContractAddress
================================================================================

.. code-block:: typescript

  digitalTwin.getContractAddress();

Get contract address of underlying DigitalTwin.

-------
Returns
-------

``Promise`` returns ``string``: contract address

-------
Example
-------

.. code-block:: typescript

  const digitalTwin = new DigitalTwin(options, config);
  console.log(await digitalTwin.getContractAddress());
  // Output:
  // 0x000000000000000000000000000000001d327171



--------------------------------------------------------------------------------

Additional Components
=====================

Public Properties
=================

.. _digital-twin_defaultDescription:

---------------------------
defaultDescription (static)
---------------------------

Default description used when no specific description is given to :ref:`.create <digital-twin_create>`.


.. code-block:: typescript

  console.dir(DigitalTwin.defaultDescription);
  // Output:
  // {
  //   name: 'Digital Identity',
  //   description: 'Digital Identity Contract',
  //   author: '',
  //   version: '0.1.0',
  //   dbcpVersion: 2
  // }



--------------------------------------------------------------------------------

Enums
=====

.. _digital-twin_DigitalTwinEntryType:

------------------------
DigitalTwinEntryType
------------------------

possible entry types for entries in index

#. ``AccountId``
#. ``Container``
#. ``FileHash``
#. ``GenericContract``
#. ``Hash``
#. ``DigitalTwin``



Interfaces
==========

.. _digital-twin_ContainerConfig:

---------------------
DigitalTwinConfig
---------------------

config for digital twin

#. ``accountId`` - ``string``: account id of user, that interacts with digital twin
#. ``containerConfig`` - ``ContainerConfig``: address of a ``DigitalTwin`` instance, can be ENS or contract address
#. ``address`` - ``string`` (optional): address of an ``DigitalTwin`` instance, can be ENS or contract address
#. ``description`` - ``string`` (optional): description has to be passed to ``.create`` to apply it to to contract
#. ``factoryAddress`` - ``string`` (optional): factory address can be passed to ``.create`` for customer digital twin factory



.. _digital-twin_DigitalTwinIndexEntry:

-------------------------
DigitalTwinIndexEntry
-------------------------

container for digital twin entry values

#. ``entryType`` - ``DigitalTwinEntryType`` (optional): type of entry in index
#. ``raw`` - ``any`` (optional): raw value (``bytes32`` hash)
#. ``value`` - ``any`` (optional): decrypted/loaded value



.. _digital-twin_DigitalTwinVerificationEntry:

--------------------------------
DigitalTwinVerificationEntry
--------------------------------

data for verifications for digital twins

#. ``topic`` - ``string``: name of the verification (full path)
#. ``descriptionDomain`` - ``string`` (optional): domain of the verification, this is a subdomain under 'verifications.evan', so passing 'example' will link verifications
#. ``disableSubVerifications`` - ``boolean`` (optional): if true, verifications created under  this path are invalid, defaults to ``false``
#. ``expirationDate`` - ``number`` (optional): expiration date, for the verification, defaults to `0` (does not expire)
#. ``verificationValue`` - ``any`` (optional): json object which will be stored in the verification



.. required for building markup

.. |source container| replace:: ``Container``
.. _source container: ../contracts/container.html

.. |source contractLoader| replace:: ``ContractLoader``
.. _source contractLoader: ../contracts/contract-loader.html

.. |source cryptoProvider| replace:: ``CryptoProvider``
.. _source cryptoProvider: ../encryption/crypto-provider.html

.. |source dataContract| replace:: ``DataContract``
.. _source dataContract: ../contracts/data-contract.html

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

.. |source profile| replace:: ``Profile``
.. _source profile: ../profile/profile.html

.. |source rightsAndRoles| replace:: ``RightsAndRoles``
.. _source rightsAndRoles: ../contracts/rights-and-roles.html

.. |source sharing| replace:: ``Sharing``
.. _source sharing: ../contracts/sharing.html

.. |source twinTemplate| replace:: ``TwinTemplate``
.. _source twinTemplate: https://github.com/evannetwork/twin-templates/blob/master/test.json

.. |source verifications| replace:: ``Verifications``
.. _source verifications: ../profile/verifications.html

.. |source web3| replace:: ``Web3``
.. _source web3: https://github.com/ethereum/web3.js/
