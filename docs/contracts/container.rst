================================================================================
Container
================================================================================

.. list-table::
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - Container
   * - Extends
     - `Logger <../common/logger.html>`_
   * - Source
     - `container.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/contracts/digital-twin/container.ts>`_
   * - Examples
     - `container.spec.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/contracts/digital-twin/container.spec.ts>`_

TL;DR: usage examples and a data flow can be found :doc:`here <./digital-twin-usage-examples>`.

The ``Container`` is an API layer over :doc:`DataContract <./data-contract>` and combines its functionalities into a more use case oriented straight forward interface.

To reduce complexity the most common usage patterns from :doc:`DataContract <./data-contract>` have been set as fixed in the ``Container`` implementation. Therefore the ``Container`` follows these principles:

- data is always encrypted
- each entry gets an own key for encryption
- each entry get an own role for granting write permissions
- an identity always is created for the container
- adding validations adds the validation topic to the contract description to allow listing of all validations
- a property called ``type`` is added to the ``Container`` at creation type and marks its template type



--------------------------------------------------------------------------------

.. _container_constructor:

constructor
================================================================================

.. code-block:: typescript

  new Container(options, config);

Create new ``Container`` instance. This will not create a smart contract contract but is used to
load existing containers. To create a new contract, use the static :ref:`create <container_create>` function.

----------
Parameters
----------

#. ``options`` - ``ContainerOptions``: runtime for new container
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
#. ``config`` - ``DigitalTwinconfIg``: config for new container
    * ``accountId`` - ``string``: account id of user, that interacts with container
    * ``address`` - ``string``: address of a ``DataContract`` instance, can be ENS or contract address

-------
Returns
-------

``Container`` instance

-------
Example
-------

.. code-block:: typescript

  const container = new Container(
    runtime,
    {
      accountId: '0x0000000000000000000000000000000000000000',
      address: 'samplecontainer.somewhere.evan',
    },
  );



--------------------------------------------------------------------------------

= Creating Containers =
=======================

.. _container_create:

create
================================================================================

.. code-block:: typescript

  Container.create(runtime, config);

Creates a new digital container contract on the blockchain.

Note, that this function is static. It is used on the ``Container`` class object and returns a ``Container`` class instance.

The options argument has the same structure as the options object that is passed to the constructor as it is used for the new ``Container`` instance. The ``config`` argument requires a proper value for the property ``description``.

----------
Parameters
----------

#. ``options`` - ``ContainerOptions``: runtime for new container
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
#. ``config`` - ``DigitalTwinconfIg``: config for new container
    * ``accountId`` - ``string``: account id of user, that interacts with container
    * ``address`` - ``string``: ENS address used for container
    * ``description`` - ``string``: description has to be passed to ``.create`` to apply it to to contract
    * ``factoryAddress`` - ``string`` (optional): factory address can be passed to ``.create`` for customer container factory
    * ``template`` - ``string|ContainerTemplate`` (optional): template to be used in ``.create``, can be string with name or a ``ContainerTemplate``

-------
Returns
-------

``Promise`` returns ``Container``: new instance bound to new ``DataContract``

-------
Example
-------

.. code-block:: typescript

  const container = await Container.create(options, config);
  console.log(await container.getContractAddress());
  // Output:
  // 0x0000000000000000000000000000000000001234



--------------------------------------------------------------------------------

.. _container_clone:

clone
================================================================================

.. code-block:: typescript

  Container.clone(options, config, source[, copyValues]);

Clone ``Container`` instance into template and creates new ``Container`` with it.

Cloning containers:

- is done with account from ``config.accountId``, this account will be owner of the new contract
- copies all fields from source container to new container (including roles, that have permissions on them)
- copies values for entry-fields (no lists) to new container, if ``copyValues`` is set
- does not copy role membership

    - ``config.accountId`` is the owner of the new contract and also a member of the contract (role 0 and 1)
    - other roles receive permissions on fields, but do not get members added to them

- does not copy sharings

    - a new sharing with new keys is generated for this container
    - only the owner of the container receives keys shared to it for this container

- does not copy validations
- does not copy the description

    - ``config.description`` is used for the cloned contract
    - fields are dynamically added to the description when generating the clone

----------
Parameters
----------

#. ``options`` - ``ContainerOptions``: runtime for new container
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
#. ``config`` - ``DigitalTwinconfIg``: config for new container
    * ``accountId`` - ``string``: account id of user, that interacts with container
    * ``address`` - ``string``: ENS address used for container
    * ``description`` - ``string``: description has to be passed to ``.create`` to apply it to to contract
    * ``factoryAddress`` - ``string`` (optional): factory address can be passed to ``.create`` for customer container factory
    * ``template`` - ``string|ContainerTemplate`` (optional): template to be used in ``.create``, can be string with name or a ``ContainerTemplate``
#. ``source`` - ``Container``: container to clone
#. ``copyValues`` - ``boolean``: copy entry values from source contract to new contract

-------
Returns
-------

``Promise`` returns ``Container``: new instance bound to new ``DataContract`` and a copy of ``source``

-------
Example
-------

.. code-block:: typescript

  const container = await Container.create(options, config);
  console.log(await container.getContractAddress());
  // Output:
  // 0x0000000000000000000000000000000000001234

  const clone = await Container.clone(options, config, container);
  console.log(await container.getContractAddress());
  // Output:
  // 0x0000000000000000000000000000000000005678



--------------------------------------------------------------------------------

.. _container_toTemplate:

toTemplate
================================================================================

.. code-block:: typescript

  container.toTemplate([getValues]);

Export current container state as template. If ``getValues`` is ``true``, exports entry values as
well.

This template can be passed to :ref:`create <container_create>` and used to create new containers.

----------
Parameters
----------

#. ``getValues`` - ``boolean``: export entry values or not (list entries are always excluded)

-------
Returns
-------

``Promise`` returns ``ContainerTemplate``: template build from current container

-------
Example
-------

.. code-block:: typescript

  const sampleValue = 123;
  await container.setEntry('numberField', sampleValue);

  console.dir(await container.toTemplate(true));



--------------------------------------------------------------------------------

= Entries =
===========

.. _container_setEntry:

setEntry
===================

.. code-block:: typescript

    container.setEntry(entryName, value);

Set a value for an entry.

----------
Parameters
----------

#. ``entryName`` - ``string``: name of an entry in the container
#. ``value`` - ``any``: value to set

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const sampleValue = 123;
  await container.setEntry('numberField', sampleValue);
  console.log(await container.getEntry('numberField'));
  // Output:
  // 123



------------------------------------------------------------------------------

.. _container_getEntry:

getEntry
===================

.. code-block:: typescript

    container.getEntry(entryName);

Return entry from contract.

----------
Parameters
----------

#. ``entryName`` - ``string``: entry name

-------
Returns
-------

``Promise`` returns ``any``: entry value

-------
Example
-------

Entries can be retrieved with:

.. code-block:: typescript

  const sampleValue = 123;
  await container.setEntry('numberField', sampleValue);
  console.log(await container.getEntry('numberField'));
  // Output:
  // 123



------------------------------------------------------------------------------

= List Entries =
================

.. _container_addListEntries:

addListEntries
===================

.. code-block:: typescript

    container.addListEntries(listName, values);

Add list entries to a list list property.

List entries can be added in bulk, so the value argument is an array with values. This array can be arbitrarily large **up to a certain degree**. Values are inserted on the blockchain side and adding very large arrays this way may take more gas during the contract transaction, than may fit into a single transaction. If this is the case, values can be added in chunks (multiple transactions).

----------
Parameters
----------

#. ``listName`` - ``string``: name of the list in the container
#. ``values`` - ``any[]``: values to add

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const listName = 'exampleList';
  console.log(await container.getListEntryCount(listName));
  // Output:
  // 0

  const sampleValue = {
    foo: 'sample',
    bar: 123,
  };
  await container.addListEntries(listName, [sampleValue]);
  console.log(await container.getListEntryCount(listName));
  // Output:
  // 1

  console.dir(await container.getListEntries(listName));
  // Output:
  // [{
  //   foo: 'sample',
  //   bar: 123,
  // }]



------------------------------------------------------------------------------

.. _container_getListEntryCount:

getListEntryCount
===================

.. code-block:: typescript

    container.getListEntryCount(listName);

Return number of entries in the list.
Does not try to actually fetch and decrypt values, but just returns the count.

----------
Parameters
----------

#. ``listName`` - ``string``: name of a list in the container

-------
Returns
-------

``Promise`` returns ``number``: list entry count

-------
Example
-------

.. code-block:: typescript

  const listName = 'exampleList';
  console.log(await container.getListEntryCount(listName));
  // Output:
  // 0

  const sampleValue = {
    foo: 'sample',
    bar: 123,
  };
  await container.addListEntries(listName, [sampleValue]);
  console.log(await container.getListEntryCount(listName));
  // Output:
  // 1

  console.dir(await container.getListEntries(listName));
  // Output:
  // [{
  //   foo: 'sample',
  //   bar: 123,
  // }]



------------------------------------------------------------------------------

.. _container_getListEntries:

getListEntries
===================

.. code-block:: typescript

    container.getListEntries(contract, listName, accountId[, dfsStorage, encryptedHashes, count, offset, reverse]);

Return list entries from contract.
Note, that in the current implementation, this function retrieves the entries one at a time and may take a longer time when querying large lists, so be aware of that, when you retrieve lists with many entries.

----------
Parameters
----------

#. ``listName`` - ``string``: name of the list in the container
#. ``count`` - ``number`` (optional): number of elements to retrieve, defaults to ``10``
#. ``offset`` - ``number`` (optional): skip this many items when retrieving, defaults to ``0``
#. ``reverse`` - ``boolean`` (optional): retrieve items in reverse order, defaults to ``false``

-------
Returns
-------

``Promise`` returns ``any[]``: list entries

-------
Example
-------

.. code-block:: typescript

  const listName = 'exampleList';
  console.log(await container.getListEntryCount(listName));
  // Output:
  // 0

  const sampleValue = {
    foo: 'sample',
    bar: 123,
  };
  await container.addListEntries(listName, [sampleValue]);
  console.log(await container.getListEntryCount(listName));
  // Output:
  // 1

  console.dir(await container.getListEntries(listName));
  // Output:
  // [{
  //   foo: 'sample',
  //   bar: 123,
  // }]



------------------------------------------------------------------------------

.. _container_getListEntry:

getListEntry
===================

.. code-block:: typescript

    container.getListEntry(listName, index);

Return a single list entry from contract.

----------
Parameters
----------

#. ``listName`` - ``string``: name of the list in the container
#. ``index`` - ``number``: list entry id to retrieve

-------
Returns
-------

``Promise`` returns ``any``: list entry

-------
Example
-------

.. code-block:: typescript

  const listName = 'exampleList';
  console.log(await container.getListEntryCount(listName));
  // Output:
  // 0

  const sampleValue = {
    foo: 'sample',
    bar: 123,
  };
  await container.addListEntries(listName, [sampleValue]);
  const count = await container.getListEntryCount(listName);
  console.log(count);
  // Output:
  // 1

  console.dir(await container.getListEntry(listName, count - 1));
  // Output:
  // {
  //   foo: 'sample',
  //   bar: 123,
  // }



------------------------------------------------------------------------------

= Share Container Data =
========================

.. _container_shareProperties:

shareProperties
================================================================================

.. code-block:: typescript

  container.shareProperties(shareConfigs);

Share entry/list to another user; this handles role permissions, role memberships.

Share configurations are given per user, that receives gets data shared with. The properties have the following meaning

- ``accountId``:

    - account, that gets properties shared
    - this user will be invited to the contract as a consumer (role 1)

- ``read``:

    - list of properties, that are shared read-only
    - for each property here, a key sharing for the user will be added if not already done so
    - this field will always be expanded by the field ``type``, which is read only accessible for every member by default, even if ``read`` is omitted
    - if not already done so, a hash key sharing will be added for given user

- ``readWrite``:

    - properties listed here will be threaded the same way as those in the field ``read``
    - additionally the following applies:

      - if not already done so, a role, that has ``Set`` permissions will be added for this field
      - given ``accountId`` will be added to the group responsible for this field
      - aforementioned roles roles start at role 64, the first 64 roles are system reserved for smart contract custom logic or in-detail role configurations
      - possible roles can go up to 255, so it is possible to add up to 192 properties to a container

----------
Parameters
----------

#. ``shareConfigs`` - ``ContainerShareConfig[]``: list of share configs

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const accountId1 = '0x0000000000000000000000000000000000000001';
  const accountId2 = '0x0000000000000000000000000000000000000002';

  // create container with accountId1
  const container = await Container.create(options, { ...config, accountId: accountId1 });
  await container.setEntry('myField', 123);
  console.log(await container.getEntry('myField'));
  // Output:
  // 123

  // share field from accountId1 to accountId2
  await container.shareProperties([{
    accountId: accountId2,
    read: ['myField'],
  }]);

  // fetch value with accountId2
  const accountId2Container = new Container(options, { ...config, accountId: accountId2 });
  console.log(await accountId2Container.getEntry('myField'));
  // Output:
  // 123



= Validating Containers =
=========================

.. _container_addVerifications:

addVerifications
================================================================================

.. code-block:: typescript

  container.addVerifications(verifications);

Add verifications to this container; this will also add verifications to contract description.

Due to the automatic expansion of the contract description, this function can only be called by the container owner.

See interface ``ContainerVerificationEntry`` for input data format.

----------
Parameters
----------

#. ``verifications`` - ``ContainerVerificationEntry[]``: list of verifications to add

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await container.addVerifications([{ topic: 'exampleVerification' }]);



--------------------------------------------------------------------------------

.. _container_getVerifications:

getVerifications
================================================================================

.. code-block:: typescript

  container.getVerifications();

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

  await container.addVerifications([{ topic: 'exampleVerification' }]);
  const verifications = await container.getVerifications());



--------------------------------------------------------------------------------

= Working with Container Descriptions =
=======================================

.. _container_getDescription:

getDescription
================================================================================

.. code-block:: typescript

  container.getDescription();

Get description from container contract.

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
  // { name: 'test container',
  //   description: 'container from test run',
  //   author: 'evan GmbH',
  //   version: '0.1.0',
  //   dbcpVersion: 2,
  //   identity:
  //    '0x70c969a64e880fc904110ce9ab72ba5f95f706a252ac085ae0525bd7a284337c',
  //   dataSchema: { type: { type: 'string', '$id': 'type_schema' } } }



--------------------------------------------------------------------------------

.. _container_setDescription:

setDescription
================================================================================

.. code-block:: typescript

  container.setDescription(description);

Write given description to containers DBCP.

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
  const description = await container.getDescription();
  console.dir(description);
  // Output:
  // { name: 'test container',
  //   description: 'container from test run',
  //   author: 'evan GmbH',
  //   version: '0.1.0',
  //   dbcpVersion: 2,
  //   identity:
  //    '0x70c969a64e880fc904110ce9ab72ba5f95f706a252ac085ae0525bd7a284337c',
  //   dataSchema: { type: { type: 'string', '$id': 'type_schema' } } }

  // update description
  description.version = '0.1.1';
  await container.setDescription(description);

  // fetch again
  console.dir(await container.getDescription());
  // Output:
  // { name: 'test container',
  //   description: 'container from test run',
  //   author: 'evan GmbH',
  //   version: '0.1.1',
  //   dbcpVersion: 2,
  //   identity:
  //    '0x70c969a64e880fc904110ce9ab72ba5f95f706a252ac085ae0525bd7a284337c',
  //   dataSchema: { type: { type: 'string', '$id': 'type_schema' } } }



--------------------------------------------------------------------------------

= Utilities =
=======================

.. _container_getContractAddress:

getContractAddress
================================================================================

.. code-block:: typescript

  container.getContractAddress();

Get contract address of underlying ``DataContract``.

-------
Returns
-------

``Promise`` returns ``string``: address of the ``DataContract``

-------
Example
-------

.. code-block:: typescript

  const container = await Container.create(options, config);
  console.log(await container.getContractAddress());
  // Output:
  // 0x0000000000000000000000000000000000001234



--------------------------------------------------------------------------------

Additional Components
======================


Interfaces
==========

.. _container_ContainerConfig:

---------------
ContainerConfig
---------------

config properties, specific to `Container` instances

#. ``accountId`` - ``string``: account id of user, that interacts with container
#. ``address`` - ``string`` (optional): address of a ``DataContract`` instance, can be ENS or contract address
#. ``description`` - ``string`` (optional): description has to be passed to ``.create`` to apply it to to contract
#. ``factoryAddress`` - ``string`` (optional): factory address can be passed to ``.create`` for customer container factory
#. ``template`` - ``string|ContainerTemplate`` (optional): template to be used in ``.create``, can be string with name or a ``ContainerTemplate``



.. _container_ContainerShareConfig:

--------------------
ContainerShareConfig
--------------------

config for sharing multiple fields to one account (read and/or readWrite access)

#. ``accountId`` - ``string``: account, that gets properties shared
#. ``read`` - ``string[]`` (optional): list of properties, that are shared read-only
#. ``readWrite`` - ``string[]`` (optional): list of properties, that are shared readable and writable



.. _container_ContainerTemplate:

-----------------
ContainerTemplate
-----------------

template for container instances, covers properties setup and permissions

#. ``type`` - ``string``: type of the template (equals name of the template)
#. ``properties`` - ``{ [id: string]: ContainerTemplateProperty; }`` (optional): list of properties included in this template, key is field name, value is property setup



.. _container_ContainerTemplateProperty:

-------------------------
ContainerTemplateProperty
-------------------------

config for sharing multiple fields to one account (read and/or readWrite access)

#. ``dataSchema`` - ``any``: `Ajv <https://github.com/epoberezkin/ajv>`_ data schema for field
#. ``permissions`` - ``{ [id: number]: string[] }``: permissions for this template, key is role id, value is array with 'set' and/or 'remove'
#. ``type`` - ``string``: type of property (entry/list)
#. ``value`` - ``any`` (optional): value of property



.. _container_ContainerVerificationEntry:

--------------------------
ContainerVerificationEntry
--------------------------

data for verifications for containers

#. ``topic`` - ``string``: validation path
#. ``descriptionDomain`` - ``string`` (optional): domain, where the description of this validation is stored
#. ``disableSubverifications`` - ``boolean`` (optional): if set, validations created in a sub-path are invalid by default, defaults to ``false``
#. ``expirationDate`` - ``number`` (optional): expiration date, validations do not expire if omitted, defaults to ``0``
#. ``verificationValue`` - ``string`` (optional): reference to additional validation details



.. required for building markup

.. |source contractLoader| replace:: ``ContractLoader``
.. _source contractLoader: ../contracts/contract-loader.html

.. |source dataContract| replace:: ``DataContract``
.. _source dataContract: ../contracts/data-contract.html

.. |source cryptoProvider| replace:: ``CryptoProvider``
.. _source cryptoProvider: ../encryption/crypto-provider.html

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
