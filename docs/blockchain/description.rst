================================================================================
Description
================================================================================

.. list-table:: 
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - Description
   * - Extends
     - `Description <https://github.com/evannetwork/dbcp/tree/master/src/description.ts>`_
   * - Source
     - `description.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/shared-description.ts>`_
   * - Examples
     - `description.spec.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/shared-description.spec.ts>`_

The Description module is the main entry point for interacting with contract descriptions. It allows you to:

- get and set descriptions
- work with contracts and ENS descriptions
- create web3.js contract instances directly from an Ethereum address and its description
- The main use cases for interacting with a contracts descriptin in your application will most probably be reading a contracts description and loading contracts via their description.

The examples folder folder contains some samples for getting started. With consuming or setting contract descriptions.



.. _description_constructor:

constructor
================================================================================

.. code-block:: typescript

  new Description(options);

Creates a new Description instance.

----------
Parameters
----------

#. ``options`` - ``DescriptionOptions``: options for Description constructor.
    * ``cryptoProvider`` - |source cryptoProvider|_: |source cryptoProvider|_ instance
    * ``dfs`` - |source dfsInterface|_: |source dfsInterface|_ instance
    * ``executor`` - |source executor|_: |source executor|_ instance
    * ``keyProvider`` - |source keyProvider|_: |source keyProvider|_ instance
    * ``nameResolver`` - |source nameResolver|_: |source nameResolver|_ instance
    * ``contractLoader`` - |source contractLoader|_: |source contractLoader|_ instance
    * ``web3`` - |source web3|_: |source web3|_ instance
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``

-------
Returns
-------

``Description`` instance

-------
Example
-------

.. code-block:: typescript
  
  const description = new Description({
      cryptoProvider,
      dfs,
      executor,
      keyProvider,
      nameResolver,
      contractLoader,
      web3,
    });



--------------------------------------------------------------------------------

.. _description_getDescription:

getDescription
===================

.. code-block:: javascript

    description.getDescription(address, accountId);

loads description envelope from ens or contract if an ENS address has a contract set as well and this contract has a defintion, the contract definition is preferred over the ENS definition and therefore returned

----------
Parameters
----------

#. ``address`` - ``string``: The ens address or contract address where the description is stored
#. ``accountId`` - ``string``: Account id to load the contract address for

-------
Returns
-------

``Promise`` returns ``Envelope``: description as an Envelope.

-------
Example
-------

.. code-block:: javascript

    const address = '0x9c0Aaa728Daa085Dfe85D3C72eE1c1AdF425be49';
    const accountId = '0x000000000000000000000000000000000000beef';
    const description = await runtime.description.getDescription(address, accountId);
    console.dir(description);
    // Output:
    // { public: 
    //    { name: 'DBCP sample greeter',
    //      description: 'smart contract with a greeting message and a data property',
    //      author: 'dbcp test',
    //      tags: [ 'example', 'greeter' ],
    //      version: '0.1.0',
    //      abis: { own: [Array] } } }

------------------------------------------------------------------------------

.. _description_setDescription:

setDescription
===================

.. code-block:: javascript

    description.setDescription(address, envelope, accountId);

set description, can be used for contract addresses and ENS addresses

----------
Parameters
----------

#. ``address`` - ``string``: contract address or ENS address
#. ``envelope`` - ``Envelope``: description as an envelope
#. ``accountId`` - ``string``: ETH account id

-------
Returns
-------

``Promise`` returns ``void``: resolved when done.

-------
Example
-------

.. code-block:: javascript

    const address = '0x...'; // or 'test.evan' as ens name
    const accountId = '0x...';
    const description = {
      "public": {
        "name": "DBCP sample contract",
        "description": "DBCP sample contract description",
        "author": "dbcp test",
        "tags": [
          "example",
          "greeter"
        ],
        "version": "0.1.0"
      }
    };
    await runtime.description.setDescription(address, description, accountId);

------------------------------------------------------------------------------

.. _description_validateDescription:

validateDescription
===================

Descriptions are validated when setting them. A list of known DBCP definition schemas is maintained in `description.schema.ts <https://github.com/evannetwork/dbcp/blob/master/src/description.schemas.ts>`_ . If a description is set, its property `dbcpVersion` will be used for validating the description, if `dbcpVersion` is not provided, the latest version known to the API is used.

Descriptions can be checked against the validator before setting them.


.. code-block:: javascript

    description.validateDescription(envelope);

try to validate description envelope; throw Error if validation fails

----------
Parameters
----------

#. ``envelope`` - ``Envelope``: envelop with description data; private has to be unencrypted

-------
Returns
-------

``Promise`` returns ``boolean|any[]``:  true if valid or array of issues.

-------
Example
-------

.. code-block:: javascript

    const brokenDescription = {
      "public": {
        "name": "DBCP sample contract with way to few properties",
      }
    };
    console.log(runtime.description.validateDescription(brokenDescription));
    // Output:
    // [ { keyword: 'required',
    //     dataPath: '',
    //     schemaPath: '#/required',
    //     params: { missingProperty: 'description' },
    //     message: 'should have required property \'description\'' },
    //   { keyword: 'required',
    //     dataPath: '',
    //     schemaPath: '#/required',
    //     params: { missingProperty: 'author' },
    //     message: 'should have required property \'author\'' },
    //   { keyword: 'required',
    //     dataPath: '',
    //     schemaPath: '#/required',
    //     params: { missingProperty: 'version' },
    //     message: 'should have required property \'version\'' } ]

.. code-block:: javascript

    const workingDescription = {
      "public": {
        "name": "DBCP sample contract",
        "description": "DBCP sample contract description",
        "author": "dbcp test",
        "tags": [
          "example",
          "greeter"
        ],
        "version": "0.1.0"
      }
    };
    console.log(runtime.description.validateDescription(workingDescription));
    // Output:
    // true

------------------------------------------------------------------------------



= Contract =
============

.. _description_getDescriptionFromContract:

getDescriptionFromContract
==========================

.. code-block:: javascript

    description.getDescriptionFromContract(address, accountId);

loads description envelope from contract

----------
Parameters
----------

#. ``address`` - ``string``: The ens address or contract address where the description is stored
#. ``accountId`` - ``string``: Account id to load the contract address for

-------
Returns
-------

``Promise`` returns ``Envelope``: description as an Envelope.

-------
Example
-------

.. code-block:: javascript

    const address = '0x9c0Aaa728Daa085Dfe85D3C72eE1c1AdF425be49';
    const accountId = '0x000000000000000000000000000000000000beef';
    const description = await runtime.description.getDescriptionFromContract(address, accountId);
    console.dir(description);
    // Output:
    // { public: 
    //    { name: 'DBCP sample greeter',
    //      description: 'smart contract with a greeting message and a data property',
    //      author: 'dbcp test',
    //      tags: [ 'example', 'greeter' ],
    //      version: '0.1.0',
    //      abis: { own: [Array] } } }

------------------------------------------------------------------------------

.. _description_setDescriptionToContract:

setDescriptionToContract
========================

.. code-block:: javascript

    description.setDescriptionToContract(contractAddress, envelope, accountId);

store description at contract

----------
Parameters
----------

#. ``contractAddress`` - ``string``: The contract address where description will be stored
#. ``envelope`` - ``Envelope``: description as an envelope
#. ``accountId`` - ``string``: ETH account id

-------
Returns
-------

``Promise`` returns ``void``: resolved when done.

-------
Example
-------

.. code-block:: javascript

    const address = '0x...';
    const accountId = '0x...';
    const description = {
      "public": {
        "name": "DBCP sample contract",
        "description": "DBCP sample contract description",
        "author": "dbcp test",
        "tags": [
          "example",
          "greeter"
        ],
        "version": "0.1.0"
      }
    };
    await runtime.description.setDescriptionToContract(address, description, accountId);

------------------------------------------------------------------------------

= ENS =
=========

ENS addresses are able to hold multiple values at once. So they may be holding a contract address and a description. If this is the case and the contract at the ENS address has another description, the contracts description is preferred over the ENS description. If you explicitly intend to retrieve an ENS endpoints description and want to ignore the contracts description, use the function `getDescriptionFromEns`.

------------------------------------------------------------------------------


.. _description_getDescriptionFromEns:

getDescriptionFromEns
=====================

.. code-block:: javascript

    description.getDescriptionFromEns(address);

loads description envelope from ens

----------
Parameters
----------

#. ``ensAddress`` - ``string``: The ens address where the description is stored

-------
Returns
-------

``Promise`` returns ``Envelope``: description as an Envelope.

-------
Example
-------

.. code-block:: javascript

    const address = '0x9c0Aaa728Daa085Dfe85D3C72eE1c1AdF425be49';
    const accountId = '0x000000000000000000000000000000000000beef';
    const description = await runtime.description.getDescriptionFromContract(address, accountId);
    console.dir(description);
    // Output:
    // { public: 
    //    { name: 'DBCP sample greeter',
    //      description: 'smart contract with a greeting message and a data property',
    //      author: 'dbcp test',
    //      tags: [ 'example', 'greeter' ],
    //      version: '0.1.0',
    //      abis: { own: [Array] } } }

------------------------------------------------------------------------------

.. _description_setDescriptionToEns:

setDescriptionToEns
===================

.. code-block:: javascript

    description.setDescriptionToEns(ensAddress, envelope, accountId);

store description at contract

----------
Parameters
----------

#. ``contractAddress`` - ``string``: The ens address where description will be stored
#. ``envelope`` - ``Envelope``: description as an envelope
#. ``accountId`` - ``string``: ETH account id

-------
Returns
-------

``Promise`` returns ``void``: resolved when done.

-------
Example
-------

.. code-block:: javascript

    const address = '0x...';
    const accountId = '0x...';
    const description = {
      "public": {
        "name": "DBCP sample contract",
        "description": "DBCP sample contract description",
        "author": "dbcp test",
        "tags": [
          "example",
          "greeter"
        ],
        "version": "0.1.0"
      }
    };
    await runtime.description.setDescriptionToEns(address, description, accountId);

.. required for building markup

.. |source executor| replace:: ``Executor``
.. _source executor: /blockchain/executor.html

.. |source contractLoader| replace:: ``ContractLoader``
.. _source contractLoader: /contracts/contract-loader.html

.. |source cryptoProvider| replace:: ``CryptoProvider``
.. _source cryptoProvider: /encryption/crypto-provider.html

.. |source dfsInterface| replace:: ``DfsInterface``
.. _source dfsInterface: /dfs/dfs-interface.html

.. |source keyProvider| replace:: ``KeyProvider``
.. _source keyProvider: /key-provider

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: /common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: /common/logger.html#logloginterface

.. |source nameResolver| replace:: ``NameResolver``
.. _source nameResolver: /blockchain/name-resolver.html

.. |source web3| replace:: ``Web3``
.. _source web3: https://github.com/ethereum/web3.js/