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
- adding verifications adds the verification topic to the contract description to allow listing of all verifications of this container
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
    * ``plugin`` - ``string|ContainerPlugin`` (optional): plugin to be used in ``.create``, can be string with name or a ``ContainerPlugin``

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

Clone ``Container`` instance into plugin and creates new ``Container`` with it.

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

- does not copy verifications
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
    * ``plugin`` - ``string|ContainerPlugin`` (optional): plugin to be used in ``.create``, can be string with name or a ``ContainerPlugin``
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

.. _container_deleteContainerPlugin:

deleteContainerPlugin
================================================================================

.. code-block:: typescript

  container.deleteContainerPlugin(profile);

Remove a container plugin from a users profile.

----------
Parameters
----------

#. ``Profile`` - |source profile|_: profile instance
#. ``name`` - ``string``: plugin name

-------
Returns
-------

``Promise`` returns ``void``

-------
Example
-------

.. code-block:: typescript

  await Container.deleteContainerPlugin(profile, 'awesomeplugin');


--------------------------------------------------------------------------------



.. _container_getContainerPlugin:

getContainerPlugin
================================================================================

.. code-block:: typescript

  container.getContainerPlugin(profile, name);

Get one container plugin for a users profile by name.

----------
Parameters
----------

#. ``Profile`` - |source profile|_: profile instance
#. ``name`` - ``string``: plugin name

-------
Returns
-------

``Promise`` returns ``ContainerPlugin``

-------
Example
-------

.. code-block:: typescript

  const accountId1 = '0x0000000000000000000000000000000000000001';
  const plugin = await Container.getContainerPlugin(profile, 'awesomeplugin');

  // create container with accountId1
  const container = await Container.create(options, {
    ...config,
    accountId: accountId1,
    description: plugin.description,
    plugin: plugin,
  });



--------------------------------------------------------------------------------


.. _container_getContainerPlugins:

getContainerPlugins
================================================================================

.. code-block:: typescript

  container.getContainerPlugins(profile);

Get all container plugins for a users profile

----------
Parameters
----------

#. ``Profile`` - |source profile|_: profile instance
#. ``loadContracts`` - boolean (default = true): run loadBcContract directly for all saved entries (if false, unresolved ipld tree will be returned as value)

-------
Returns
-------

``Promise`` returns ``Array<ContainerPlugin>``

-------
Example
-------

.. code-block:: typescript

  const accountId1 = '0x0000000000000000000000000000000000000001';
  const plugins = await Container.getContainerPlugins(profile);

  // create container with accountId1
  const container = await Container.create(options, {
    ...config,
    accountId: accountId1,
    description: plugins['awesomeplugin'].description,
    plugin: plugins['awesomeplugin'],
  });


--------------------------------------------------------------------------------


.. _container_saveContainerPlugin:

saveContainerPlugin
================================================================================

.. code-block:: typescript

  container.saveContainerPlugin(profile, name, plugin);

Persists a plugin including an dbcp description to the users profile.

----------
Parameters
----------

#. ``Profile`` - |source profile|_: profile instance
#. ``name`` - ``string``: plugin name
#. ``plugin`` - ``ContainerPlugin``: container plugin object
#. ``beforeName`` - ``strinf``: remove previous plugin instance when it was renamed

-------
Returns
-------

``Promise`` returns ``void``

-------
Example
-------

.. code-block:: typescript

  const plugins = await Container.saveContainerPlugin(
    profile,
    'awesomeplugin',
    { ... }
  );




--------------------------------------------------------------------------------


.. _container_toPlugin:

toPlugin
================================================================================

.. code-block:: typescript

  container.toPlugin([getValues]);

Export current container state as plugin. If ``getValues`` is ``true``, exports entry values as
well.

This plugin can be passed to :ref:`create <container_create>` and used to create new containers.

----------
Parameters
----------

#. ``getValues`` - ``boolean``: export entry values or not (list entries are always excluded)

-------
Returns
-------

``Promise`` returns ``ContainerPlugin``: plugin build from current container

-------
Example
-------

.. code-block:: typescript

  const sampleValue = 123;
  await container.setEntry('numberField', sampleValue);

  console.dir(await container.toPlugin(true));



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


--------------------------------------------------------------------------------


.. _container_removeEntries:

removeEntries
================================================================================

.. code-block:: typescript

  container.removeEntries(entries);

Remove multiple entries from the container, including data keys and sharings. Can also pass a single property instead of an array. Retrieves dynamically all sharings for the passed entries and runs `unshareProperties` for them.

----------
Parameters
----------

#. ``entries`` - ``string`` / ``string[]``: name / list of entries, that should be removed

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

  // open container with accountId1
  const container = new Container(options, { ...config, accountId: accountId1 });

  // assuming, that entry 'myField' has been shared with accountId2
  // remove the whole property from the container
  await container.removeEntries(['myField']);

  // fetch value with accountId2 and with accountId1
  const accountId2Container = new Container(options, { ...config, accountId: accountId2 });
  let value;
  try {
    value = await accountId2Container.getEntry('myField');
    console.log(value);
  } catch (ex) {
    console.error('could not get entry');
  }

  // also the owner cannot get this entry anymore
  try {
    value = await container.getEntry('myField');
    console.log(value);
  } catch (ex) {
    console.error('could not get entry');
  }
  // Output:
  // could not get entry


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

= Store multiple properties =
=============================

.. _container_storeData:

storeData
================================================================================

.. code-block:: typescript

  container.storeData(data);

Store data to a container. This allows to
   * - store data into already existing entries and/or list entries
   * - implicitely create new entries and/or list entries (the same logic for deciding on their type is applied as in `setEntry`/`addListEntries` is applied here)
   * - in case of entries, their value is overwritten
   * - in case of list entries, given values are added to the list

----------
Parameters
----------

#. ``data`` - ``object``: object with keys, that are names of lists or entries and values, that are the values to store to them

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const sampleValue = 123;
  await container.storeData({
    'numberField': sampleValue,
  });
  console.log(await container.getEntry('numberField'));
  // Output:
  // 123



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

- ``removeListEntries``:

    - properties listed here will be threaded the same way as those in the field ``read``
    - additionally the following applies:

      - if not already done so, a role, that has ``Remove`` permissions will be added for this field
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


--------------------------------------------------------------------------------

.. _container_unshareProperties:

unshareProperties
================================================================================

.. code-block:: typescript

  container.unshareProperties(unshareConfigs);

Remove keys and/or permissions for a user; this also handles role permissions, role memberships.

**Please note: To prevent `dead` and inaccessible container entries, the API will throw an error by trying to unshare properties for an owner of a container. If you are sure and really want remove the owner from a property, you need to set the `force` attribute of the** :ref:`container_ContainerUnShareConfig` **for the owner to true. If you want to remove a property for all invited users, please use the** :ref:`container_removeEntries` **function.**

----------
Parameters
----------

#. ``unshareConfigs`` - :ref:`container_ContainerUnShareConfig`: list of account-field setups to remove permissions/keys for

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

  // open container with accountId1
  const container = new Container(options, { ...config, accountId: accountId1 });

  // assuming, that entry 'myField' has been shared with accountId2
  // unshare field from accountId1 to accountId2
  await container.unshareProperties([{
    accountId: accountId2,
    read: ['myField'],
  }]);

  // fetch value with accountId2
  const accountId2Container = new Container(options, { ...config, accountId: accountId2 });
  let value;
  try {
    value = await accountId2Container.getEntry('myField');
    console.log(value);
  } catch (ex) {
    console.error('could not get entry');
  }
  // Output:
  // could not get entry

--------------------------------------------------------------------------------

.. _container_getContainerShareConfigForAccount:

getContainerShareConfigForAccount
================================================================================

.. code-block:: typescript

  container.getContainerShareConfigForAccount(accountId);

Check permissions for given account and return them as ContainerShareConfig object.

----------
Parameters
----------

#. ``accountId`` - ``string``: account to check permissions for

-------
Returns
-------

``Promise`` returns ``ContainerShareConfig``: resolved when done

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

  const shareConfig = await container.getContainerShareConfigForAccount(accountId2);
  console.dir(shareConfig);
  // Output:
  // {
  //   accountId: '0x0000000000000000000000000000000000000002',
  //   read: ['myField']
  // }



--------------------------------------------------------------------------------

.. _container_getContainerShareConfigs:

getContainerShareConfigs
================================================================================

.. code-block:: typescript

  container.getContainerShareConfigs();

Check permissions for given account and return them as ContainerShareConfig object.

-------
Returns
-------

``Promise`` returns ``ContainerShareConfig[]``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const accountId1 = '0x0000000000000000000000000000000000000001';  // account in runtime
  const accountId2 = '0x0000000000000000000000000000000000000002';  // account to invite

  const container = await Container.create(runtime, defaultConfig);
  const randomString1 = Math.floor(Math.random() * 1e12).toString(36);
  await container.setEntry('testField1', randomString1);
  const randomString2 = Math.floor(Math.random() * 1e12).toString(36);
  await container.setEntry('testField2', randomString2);

  await container.shareProperties([
    { accountId: accountId2, readWrite: ['testField1'], read: ['testField2'] },
  ]);

  console.dir(await container.getContainerShareConfigs());
  // Output:
  // [ { accountId: '0x0000000000000000000000000000000000000001',
  //   readWrite: [ 'testField1', 'testField2' ] },
  // { accountId: '0x0000000000000000000000000000000000000002',
  //   read: [ 'testField2' ],
  //   readWrite: [ 'testField1' ] } ]


--------------------------------------------------------------------------------

.. _container_setContainerShareConfigs:

setContainerShareConfigs
================================================================================

.. code-block:: typescript

  container.setContainerShareConfigs(newConfigs, originalConfigs);

Takes a full share configuration for an accountId (or a list of them), share newly added properties and unshare removed properties from the container. Also accepts a list or instance of the original sharing configurations so that duplicated loading can be avoided.

----------
Parameters
----------

#. ``newConfigs`` - :ref:`container_ContainerShareConfig` / :ref:`container_ContainerShareConfig` []: sharing configurations that should be persisted
#. ``originalConfigs`` - :ref:`container_ContainerShareConfig` / :ref:`container_ContainerShareConfig` []: pass original share configurations, for that the sharing delta should be built (reduces load time)

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

  // open container with accountId1
  const container = new Container(options, { ...config, accountId: accountId1 });

  await container.shareProperties([{
    accountId: '0x0000000000000000000000000000000000000002',
    read: [ 'testField', ],
    readWrite: [ 'testField2', ]
  }]);

  console.dir(await container.getContainerShareConfigForAccount(accountId2))
  // {
  //   accountId: '0x0030C5e7394585400B1FB193DdbCb45a37Ab916E',
  //   read: [ 'testField' ],
  //   readWrite: [ 'testField2' ]
  // }

  shareConfig.readWrite = [ 'testField3' ];
  await container.setContainerShareConfigs(shareConfig);

  console.dir(await container.getContainerShareConfigForAccount(accountId2))
  // {
  //   accountId: '0x0030C5e7394585400B1FB193DdbCb45a37Ab916E',
  //   read: [ 'testField' ],
  //   readWrite: [ 'testField3' ]
  // }


--------------------------------------------------------------------------------


= Verifying Containers =
=========================

.. _container_addVerifications:

addVerifications
================================================================================

.. code-block:: typescript

  container.addVerifications(verifications);

Add verifications to this container; this will also add verifications to contract description.

If the calling account is the owner of the identity of the container

- the description will is automatically updated with tags for verifications
- verifications issued with this function will be accepted automatically

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

.. _container_getOwner:

getOwner
================================================================================

.. code-block:: typescript

  container.getOwner();

Gets the owner account id for the container.

-------
Returns
-------

``Promise`` returns ``string``: owner account id

-------
Example
-------

.. code-block:: typescript

  const isOwner = (await container.getOwner()) === runtime.activeAccount;


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

.. _container_ensureProperty:

ensureProperty
================================================================================

.. code-block:: typescript

  container.ensureProperty(propertyName, dataSchema[, propertyType]);

Ensure that container supports given property.

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await container.ensureProperty('testField', Container.defaultSchemas.stringEntry);



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
#. ``plugin`` - ``string|ContainerPlugin`` (optional): plugin to be used in ``.create``, can be string with name or a ``ContainerPlugin``



.. _container_ContainerFile:

-------------
ContainerFile
-------------

description and content of a single file, usually used in arrays (add/get/set operations)

#. ``name`` - ``string``: filename, e.g. ``animal-animal-photography-cat-96938.jpg``
#. ``fileType`` - ``string``: mime type of the file, e.g. ``image/jpeg``
#. ``file`` - ``Buffer``: file data as Buffer



.. _container_ContainerShareConfig:

--------------------
ContainerShareConfig
--------------------

config for sharing multiple fields to one account (read and/or readWrite access)

#. ``accountId`` - ``string``: account, that gets properties shared
#. ``read`` - ``string[]`` (optional): list of properties, that are shared read-only
#. ``readWrite`` - ``string[]`` (optional): list of properties, that are shared readable and writable

.. _container_ContainerUnShareConfig:

----------------------
ContainerUnshareConfig
----------------------

config for unsharing multiple fields from one account (write and/or readWrite access)

#. ``accountId`` - ``string``: account, that gets properties unshared
#. ``readWrite`` - ``string[]`` (optional): list of properties, that are unshared (read and write permissions)
#. ``removeListEntries`` - ``string[]`` (optional): list of properties, that are losing the rights to remove listentries
#. ``write`` - ``string[]`` (optional): list of properties, for which write permissions should be removed
#. ``force`` - ``boolean`` (optional): Without force flag, removal of the owner will throw an error. By setting to true, force will even remove the owner. **Important: By removing the owner from a property, the encryptions keys get lost and cannot be recovered. As the result of this, the data isn't readable anymore and must be overwritten by creating new encryption keys to encrypt future content.**

.. _container_ContainerPlugin:

---------------
ContainerPlugin
---------------

base definition of a container instance, covers properties setup and permissions

#. ``description`` - ``any``: type of the template (equals name of the template)
#. ``template`` - ``ContainerTemplate``: template for container instances, covers properties setup and permissions


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

#. ``topic`` - ``string``: verification path
#. ``descriptionDomain`` - ``string`` (optional): domain, where the description of this verification is stored
#. ``disableSubverifications`` - ``boolean`` (optional): if set, verification created in a sub-path are invalid by default, defaults to ``false``
#. ``expirationDate`` - ``number`` (optional): expiration date, verifications do not expire if omitted, defaults to ``0``
#. ``verificationValue`` - ``string`` (optional): reference to additional verification details



--------------------------------------------------------------------------------

Public Properties
=================

.. _container_defaultDescription:

---------------------------
defaultDescription (static)
---------------------------

Default description used when no specific description is given to :ref:`.create <container_create>`.



.. _container_defaultSchemas:

-----------------------
defaultSchemas (static)
-----------------------

Predefined simple schemas, contains basic schemas for files, number, object, string entries and their list variants.



.. _container_defaultTemplate:

------------------------
defaultTemplate (static)
------------------------

Default template used when no specific description is given to :ref:`.create <container_create>`. Default template is ``metadata``.



.. _container_profileTemplatesKey:

----------------------------
profileTemplatesKey (static)
----------------------------

Key that is used in user profile to store templates, default is ``templates.datacontainer.digitaltwin.evan``



.. _container_templates:

------------------
templates (static)
------------------

Predefined templates for containers, currently only contains the ``metadata`` template.



--------------------------------------------------------------------------------

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

.. |source profile| replace:: ``Profile``
.. _source profile: ../profile/profile.html

.. |source rightsAndRoles| replace:: ``RightsAndRoles``
.. _source rightsAndRoles: ../contracts/rights-and-roles.html

.. |source sharing| replace:: ``Sharing``
.. _source sharing: ../contracts/sharing.html

.. |source verifications| replace:: ``Verifications``
.. _source verifications: ../profile/verifications.html

.. |source web3| replace:: ``Web3``
.. _source web3: https://github.com/ethereum/web3.js/
