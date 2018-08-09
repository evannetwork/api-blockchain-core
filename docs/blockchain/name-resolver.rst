================================================================================
Name Resolver
================================================================================

.. list-table:: 
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - NameResolver
   * - Extends
     - `Logger </common/logger.html>`_
   * - Source
     - `name-resolver.ts <https://github.com/evannetwork/dbcp/tree/master/src/name-resolver.ts>`_
   * - Tests
     - `name-resolver.spec.ts <https://github.com/evannetwork/dbcp/tree/master/src/name-resolver.spec.ts>`_

The `NameResolver <https://github.com/evannetwork/dbcp/tree/master/src/name-resolver.ts>`_ is a collection of helper functions, that can be used for ENS interaction. These include: 

- setting and getting ENS addresses
- setting and getting ENS content flags, which is used when setting data in distributed file system, especially in case of setting a description for an `ENS` address

.. _name_resolver_constructor:

constructor
================================================================================

.. code-block:: typescript

  new NameResolver(options);

Creates a new NameResolver instance.

----------
Parameters
----------

#. ``options`` - ``NameResolverOptions``: options for NameResolver constructor.
    * ``config`` - ``any``: configuration object for the NameResolver instance
    * ``executor`` - |source executor|_: |source executor|_ instance
    * ``contractLoader`` - |source contractLoader|_: |source contractLoader|_ instance
    * ``web3`` - |source web3|_: |source web3|_ instance
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``

-------
Returns
-------

``NameResolver`` instance

-------
Example
-------

.. code-block:: typescript
  
  const nameResolver = new NameResolver({
      cryptoProvider,
      dfs,
      executor,
      keyProvider,
      nameResolver,
      contractLoader,
      web3,
    });



--------------------------------------------------------------------------------

.. _name_resolver_getAddressOrContent:

getAddressOrContent
===================

.. code-block:: javascript

    nameResolver.getAddressOrContent(name, type);

get address or content of an ens entry

----------
Parameters
----------

#. ``name`` - ``string``: ens domain name (plain text)
#. ``type`` - ``string``: content type to get (address or content)

-------
Returns
-------

``Promise`` resolves to ``string``: address, returns null if not available

-------
Example
-------

.. code-block:: javascript

    const testEvanAddress = await runtime.nameResolver.getAddressOrContent('test.evan', 'address');
    // returns 0x9c0Aaa728Daa085Dfe85D3C72eE1c1AdF425be49

------------------------------------------------------------------------------

.. _name_resolver_getAddress:

getAddress
===================

.. code-block:: javascript

    nameResolver.getAddress(name);

get address of an ens entry

----------
Parameters
----------

#. ``name`` - ``string``: ens domain name (plain text)

-------
Returns
-------

``Promise`` resolves to ``string``: address, returns null if not available

-------
Example
-------

.. code-block:: javascript

    const testEvanAddress = await runtime.nameResolver.getAddress('test.evan');
    // returns 0x9c0Aaa728Daa085Dfe85D3C72eE1c1AdF425be49

------------------------------------------------------------------------------

.. _name_resolver_getContent:

getContent
===================

.. code-block:: javascript

    nameResolver.getContent(name);

get content of an ens entry

----------
Parameters
----------

#. ``name`` - ``string``: ens domain name (plain text)

-------
Returns
-------

``Promise`` resolves to ``string``: content, returns null if not available

-------
Example
-------

.. code-block:: javascript

    const testEvanAddress = await runtime.nameResolver.getContent('test.evan');
    // returns  (encoded ipfs hash) 0x9c0Aaa728Daa085Dfe85D3C72eE1c1AdF425be49

------------------------------------------------------------------------------

.. _name_resolver_setAddressOrContent:

setAddressOrContent
===================

.. code-block:: javascript

    nameResolver.setAddressOrContent(name, value, accountId, domainOwnerId, type);

set ens name. this can be a root level domain domain.test or a subdomain sub.domain.test

----------
Parameters
----------

#. ``name`` - ``string``: ens domain name (plain text)
#. ``value`` - ``string``: ethereum address
#. ``accountId`` - ``string``: owner of the parent domain
#. ``domainOwnerId`` - ``string``: owner of the address to set
#. ``type`` - ``string``: content type to set

-------
Returns
-------

``Promise`` resolves to ``void``: resolves when done

-------
Example
-------

.. code-block:: javascript

    const testEvanAddress = await runtime.nameResolver
      .setAddressOrContent(
        'test.evan',
        '0x9c0Aaa728Daa085Dfe85D3C72eE1c1AdF425be49',
        '0x000000000000000000000000000000000000beef',
        '0x000000000000000000000000000000000000beef',
        'address'
      );
    // returns  (encoded ipfs hash) 0x9c0Aaa728Daa085Dfe85D3C72eE1c1AdF425be49

------------------------------------------------------------------------------

.. _name_resolver_setAddress:

setAddress
===================

.. code-block:: javascript

    nameResolver.setAddress(name, address, accountId, domainOwnerId);

set address for ens name. this can be a root level domain domain.test or a subdomain sub.domain.test

----------
Parameters
----------

#. ``name`` - ``string``: ens domain name (plain text)
#. ``address`` - ``string``: ethereum address
#. ``accountId`` - ``string``: owner of the parent domain
#. ``domainOwnerId`` - ``string``: owner of the address to set

-------
Returns
-------

``Promise`` resolves to ``void``: resolves when done

-------
Example
-------

.. code-block:: javascript

    const testEvanAddress = await runtime.nameResolver
      .setAddress(
        'test.evan',
        '0x9c0Aaa728Daa085Dfe85D3C72eE1c1AdF425be49',
        '0x000000000000000000000000000000000000beef',
        '0x000000000000000000000000000000000000beef'
      );

------------------------------------------------------------------------------


.. _name_resolver_setContent:

setContent
===================

.. code-block:: javascript

    nameResolver.setContent(name, content, accountId, domainOwnerId);

set content for ens name. this can be a root level domain domain.test or a subdomain sub.domain.test

----------
Parameters
----------

#. ``name`` - ``string``: ens domain name (plain text)
#. ``content`` - ``string``: ethereum address
#. ``accountId`` - ``string``: owner of the parent domain
#. ``domainOwnerId`` - ``string``: owner of the address to set

-------
Returns
-------

``Promise`` resolves to ``void``: resolves when done

-------
Example
-------

.. code-block:: javascript

    const testEvanAddress = await runtime.nameResolver
      .setContent(
        'test.evan',
        '0x9c0Aaa728Daa085Dfe85D3C72eE1c1AdF425be49',
        '0x000000000000000000000000000000000000beef',
        '0x000000000000000000000000000000000000beef'
      );

------------------------------------------------------------------------------

.. _name_resolver_getFactory:

getFactory
===================

.. code-block:: javascript

    nameResolver.getFactory(contractName);

helper function for retrieving a factory address (e.g. 'tasks.factory.evan')

----------
Parameters
----------

#. ``contractName`` - ``string``: name of the contract that is created by the factory

-------
Returns
-------

``string``:  address of the contract factory

-------
Example
-------

.. code-block:: javascript

    const taskFactory = await runtime.nameResolver.getFactory('tasks');
    // returns '0x9c0Aaa728Daa085Dfe85D3C72eE1c1AdF425be49';

------------------------------------------------------------------------------

.. _name_resolver_getDomainName:

getDomainName
===================

.. code-block:: javascript

    nameResolver.getDomainName(domainConfig, ...subLabels);

builds full domain name based on the provided domain config a module initalization.

----------
Parameters
----------

#. ``domainConfig`` - ``string[] | string``: The domain configuration 
#. ``...subLabels`` - ``string[]``: array of domain elements to be looked up and added at the lefthand

-------
Returns
-------

``string``:  the domain name

-------
Example
-------

.. code-block:: javascript

    const domain = runtime.nameResolver.getDomainName(['factory', 'root'], 'task');
    // returns 'task.factory.evan';

------------------------------------------------------------------------------

.. _name_resolver_getArrayFromIndexContract:

getArrayFromIndexContract
=========================

.. code-block:: javascript

    nameResolver.getArrayFromIndexContract(indexContract, listHash, retrievers, chain, triesLeft);

retrieve an array with all values of a list from an index contract.

----------
Parameters
----------

#. ``indexContract`` - ``any``: Ethereum contract address (DataStoreIndex)
#. ``listHash`` - ``string``: bytes32 namehash like api.nameResolver.sha3('ServiceContract')
#. ``retrievers`` - ``any`` (optional): overwrites for index or index like contract property retrievals defaults to:

.. code-block:: javascript

  {
    listEntryGet: 'listEntryGet',
    listLastModified: 'listLastModified',
    listLength: 'listLength',
  }

#. ``chain`` - ``Promise``: Promise, for chaining multiple requests (should be omitted when called 'from outside', defaults to Promise.resolve())
#. ``triesLeft`` - ``number``: tries left before quitting defaults to ``10``

-------
Returns
-------

``Promise`` resolves to ``string[]``:  list of addresses

------------------------------------------------------------------------------

.. _name_resolver_getArrayFromListContract:

getArrayFromListContract
========================

.. code-block:: javascript

    nameResolver.getArrayFromListContract(indexContract, count, offset, reverse, chain, triesLeft);

retrieve an array with all values of a list from an index contract.

----------
Parameters
----------

#. ``indexContract`` - ``any``: Ethereum contract address (DataStoreIndex)
#. ``count`` - ``number`` (optional): how many items should be returned, defaults to ``10``
#. ``offset`` - ``number`` (optional): how many items should be skipped, defaults to ``0``
#. ``reverse`` - ``boolean`` (optional): should the list be iterated reverse, defaults to ``false``
#. ``chain`` - ``Promise`` (optional): Promise, for chaining multiple requests (should be omitted when called 'from outside', defaults to Promise.resolve())
#. ``triesLeft`` - ``number`` (optional): tries left before quitting defaults to ``10``

-------
Returns
-------

``Promise`` resolves to ``string[]``:  list of addresses

------------------------------------------------------------------------------

.. _name_resolver_getArrayFromUintMapping:

getArrayFromUintMapping
=======================

.. code-block:: javascript

    nameResolver.getArrayFromUintMapping(contract, countRetriever, elementRetriever[, count, offset, reverse]);

retrieve elements from a contract using a count and element retriever function.

----------
Parameters
----------

#. ``contract`` - ``any``: Ethereum contract address (DataStoreIndex)
#. ``countRetriever`` - ``Function`` : function which returns the count of the retrieved elements
#. ``elementRetriever`` - ``Function`` : function which returns the element of the retrieved elements
#. ``count`` - ``number`` (optional): number of elements to retrieve, defaults to ``10``
#. ``offset`` - ``number`` (optional): skip this many items when retrieving, defaults to ``0``
#. ``reverse`` - ``boolean`` (optional): retrieve items in reverse order, defaults to ``false``

-------
Returns
-------

``Promise`` resolves to ``string[]``:  list of addresses

------------------------------------------------------------------------------

.. _name_resolver_sha3:

sha3
===================

.. code-block:: javascript

    nameResolver.sha3(input);

sha3 hashes an input, substitutes web3.utils.sha3 from geth console

----------
Parameters
----------

#. ``input`` - ``string | buffer``: input text or buffer to hash

-------
Returns
-------

``string``:  hashed output

------------------------------------------------------------------------------

.. _name_resolver_soliditySha3:

soliditySha3
===================

.. code-block:: javascript

    nameResolver.soliditySha3(...args);

Will calculate the sha3 of given input parameters in the same way solidity would. This means arguments will be ABI converted and tightly packed before being hashed.

----------
Parameters
----------

#. ``args`` - ``string | buffer``: arguments for hashing

-------
Returns
-------

``string``:  hashed output

------------------------------------------------------------------------------

.. _name_resolver_namehash:

namehash
===================

.. code-block:: javascript

    nameResolver.namehash(inputName);

hash ens name for usage in contracts

----------
Parameters
----------

#. ``inputName`` - ``string``: inputName  ens name to hash

-------
Returns
-------

``string``:  name hash

------------------------------------------------------------------------------

.. _name_resolver_bytes32ToAddress:

bytes32ToAddress
===================

.. code-block:: javascript

    nameResolver.bytes32ToAddress(hash);

converts a bytes32 hash to address

----------
Parameters
----------

#. ``hash`` - ``string``: bytes32 hash

-------
Returns
-------

``string``:  converted address


.. required for building markup

.. |source executor| replace:: ``Executor``
.. _source executor: /blockchain/executor.html

.. |source contractLoader| replace:: ``ContractLoader``
.. _source contractLoader: /contracts/contract-loader.html

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: /common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: /common/logger.html#logloginterface

.. |source web3| replace:: ``Web3``
.. _source web3: https://github.com/ethereum/web3.js/