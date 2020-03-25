================================================================================
Name Resolver
================================================================================

.. list-table::
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - NameResolver
   * - Extends
     - `Logger <../common/logger.html>`_
   * - Source
     - `name-resolver.ts <https://github.com/evannetwork/dbcp/tree/master/src/name-resolver.ts>`_
   * - Examples
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

    nameResolver.setAddressOrContent(name, value, parentDomainOwner, domainOwnerId, type);

set ens name. this can be a root level domain domain.test or a subdomain sub.domain.test

----------
Parameters
----------

#. ``name`` - ``string``: ens domain name (plain text)
#. ``value`` - ``string``: ethereum address
#. ``parentDomainOwner`` - ``string``: owner of the parent domain
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

    nameResolver.setAddress(name, address, ownerAddress, domainOwnerId);

set address for ens name. this can be a root level domain domain.test or a subdomain sub.domain.test

----------
Parameters
----------

#. ``name`` - ``string``: ens domain name (plain text)
#. ``address`` - ``string``: ethereum address
#. ``ownerAddress`` - ``string``: owner of the parent domain
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

    nameResolver.setContent(name, content, parentDomainOwner, domainOwnerId);

set content for ens name. this can be a root level domain domain.test or a subdomain sub.domain.test

----------
Parameters
----------

#. ``name`` - ``string``: ens domain name (plain text)
#. ``content`` - ``string``: ethereum address
#. ``parentDomainOwner`` - ``string``: owner of the parent domain
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



--------------------------------------------------------------------------------

.. _name_resolver_claimAddress:

claimAddress
================================================================================

.. code-block:: typescript

  nameResolver.claimAddress(name, executingAddress[, domainOwnerId, price]);

Tries to claim node ownership from parent nodes owner, this assumes, that the parent node owner is a registar, that supports claiming address from it (FIFS registrar or PayableRegistrar).

----------
Parameters
----------

#. ``name`` - ``string``: domain name to set (plain text)
#. ``executingAddress`` - ``string``: ID of the account or identity executing the transaction
#. ``domainOwnerId`` - ``string`` (optional): owner of the new domain, defaults to ``executingAddress``
#. ``value`` - ``string|number`` (optional): value to send (if registrar is payable)

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  // claim '123test.fifs.registrar.test.evan' with identities[0] for identities[1] from FIFS registrar
  const domain = '123test.fifs.registrar.test.evan';
  await nameResolver.claimAddress(domain, identities[0], identities[1]);

  // claim '123test.payable.registrar.test.evan' with identities[0] for identities[1] from payable registrar
  const domain = '123test.fifs.registrar.test.evan';
  const price = await nameResolver.getPrice(domain);
  await nameResolver.claimAddress(domain, identities[0], identities[1], price);



--------------------------------------------------------------------------------

.. _name_resolver_claimPermanentAddress:

claimPermanentAddress
================================================================================

.. code-block:: typescript

  nameResolver.claimPermanentAddress(name, executingAddress[, domainOwnerId]);

Registers a permanent domain via registrar, can only be done by registrar owner.

----------
Parameters
----------

#. ``name`` - ``string``: domain name to set (plain text)
#. ``executingAddress`` - ``string``: account or identity, that executes the transaction, has to be registrar owner
#. ``domainOwnerId`` - ``string`` (optional): owner of the new domain, defaults to ``executingAddress``

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  // claim '123sample.evan' with identities[0] for identities[1] from registrar
  const domain = '123sample.evan';
  await nameResolver.claimPermanentAddress(domain, identities[0], identities[1]);



--------------------------------------------------------------------------------

.. _name_resolver_setPrice:

setPrice
================================================================================

.. code-block:: typescript

  nameResolver.setPrice(name, executingAddress, newPrice);

Set price for a registrar at a domain.

----------
Parameters
----------

#. ``name`` - ``string``: ENS address of a domain owned by a registrar (e.g. 'sample.payable.test.evan')
#. ``executingAddress`` - ``string``: account or identity that performs the action (needs proper permisions for registrar)
#. ``newPrice`` - ``number|string`` (optional): new price in Wei

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await nameResolver.setPrice(
    'payable.registrar.test.evan',
    '0x1111111111111111111111111111111111111111',
    web3.utils.toWei('5', 'ether'),
  );



--------------------------------------------------------------------------------

.. _name_resolver_getPrice:

getPrice
================================================================================

.. code-block:: typescript

  nameResolver.getPrice(name);

Get price for domain (if domain is payable).

----------
Parameters
----------

#. ``name`` - ``string``: a domain to check price for (e.g. 'sample.payable.test.evan')

-------
Returns
-------

``Promise`` returns ``string``: price in Wei

-------
Example
-------

.. code-block:: typescript

  console.log(await nameResolver.getPrice('payable.registrar.test.evan'));
  // Output:
  // 5000000000000000000



--------------------------------------------------------------------------------

.. _name_resolver_setValidUntil:

setValidUntil
================================================================================

.. code-block:: typescript

  nameResolver.setValidUntil(name, executingAddress, newPrice);

Set duration, that an address is valid; resolval stops after this, depending on configuration of the ENS an extra period, where owner is still available, can be granted; notice that this can only be done by parent owner of given domain.

----------
Parameters
----------

#. ``name`` - ``string``: ENS address of a domain owned by a registrar (e.g. 'sample.payable.test.evan')
#. ``executingAddress`` - ``string``: account or identity that performs the action; must be parent owner of given domain
#. ``validUntil`` - ``number|string``: js timestamp, when name resolution stops

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await nameResolver.setValidUntil(
    'payable.registrar.test.evan',
    '0x1111111111111111111111111111111111111111',
    Date.now() + 60000,
  );



--------------------------------------------------------------------------------

.. _name_resolver_getValidUntil:

getValidUntil
================================================================================

.. code-block:: typescript

  nameResolver.getValidUntil(name);

Get timestamp, when domain will stop resolval.

----------
Parameters
----------

#. ``name`` - ``string``: domain to get valid until for

-------
Returns
-------

``Promise`` returns ``string``: js timestamp, when resolver lookup will expire

-------
Example
-------

.. code-block:: typescript

  console.log(await nameResolver.getValidUntil('payable.registrar.test.evan'));
  // Output:
  // 1544630375417



--------------------------------------------------------------------------------

.. _name_resolver_claimFunds:

claimFunds
================================================================================

.. code-block:: typescript

  namerResolver.claimFunds(name, executingAddress);

Verification funds for domain.

----------
Parameters
----------

#. ``name`` - ``string``: ENS address of a domain owned by a registrar (e.g. 'sample.payable.test.evan')
#. ``executingAddress`` - ``string``: account or identity that performs the action (needs proper permisions for registrar)

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await nameResolver.claimFunds(
    'payable.registrar.test.evan',
    '0x1111111111111111111111111111111111111111',
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
.. _source executor: ../blockchain/executor.html

.. |source contractLoader| replace:: ``ContractLoader``
.. _source contractLoader: ../contracts/contract-loader.html

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: ../common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: ../common/logger.html#logloginterface

.. |source web3| replace:: ``Web3``
.. _source web3: https://github.com/ethereum/web3.js/
