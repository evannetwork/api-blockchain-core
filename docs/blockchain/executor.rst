================================================================================
Executor
================================================================================

.. list-table:: 
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - Executor
   * - Extends
     - `Logger </common/logger.html>`_
   * - Source
     - `executor.ts <https://github.com/evannetwork/dbcp/tree/master/src/contracts/executor.ts>`_
   * - Tests
     - `executor.spec.ts <https://github.com/evannetwork/dbcp/tree/master/src/contracts/executor.spec.ts>`_

The executor is used for

- making contract calls
- executing contract transactions
- creating contracts
- send EVEs to another account or contract

The signer requires you to have a contract instance, either by

- loading the contract via `Description </blockchain/description.html>`_ helper (if the contract has an abi at its description)
- loading the contract via `ContractLoader </contracts/contract-loader.html>`_ helper (if the contract has not abi at its description)
- directly via `web3.js <https://github.com/ethereum/web3.js>`_.



.. _executor_constructor:

constructor
================================================================================

.. code-block:: typescript

  new Executor(options);

Creates a new Executor instance.

The Executor allows to pass the ``defaultOptions`` property to its constructor. This property contains options for transactions and calls, that will be used if no other properties are provided in calls/transactions. Explicitly passed options always overwrite default options.

----------
Parameters
----------

#. ``options`` - ``ExecutorOptions``: options for ServiceContract constructor.
    * ``config`` - ``any``: configuration object for the executor instance
    * ``defaultOptions`` - ``any`` (optional): default options for web3 transactions/calls
    * ``eventHub`` - |source eventHub|_: |source eventHub|_ instance
    * ``signer`` - |source signerInterface|_: |source signerInterface|_ instance
    * ``web3`` - |source web3|_: |source web3|_ instance
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``

-------
Returns
-------

``Executor`` instance

-------
Example
-------

.. code-block:: typescript
  
  const executor = new Executor({
      config,
      eventHub,
      signer,
      web3
    });



--------------------------------------------------------------------------------

.. _executor_init:

init
===================

.. code-block:: javascript

    executor.init(name);

initialize executor

----------
Parameters
----------

#. ``options`` - ``any``: object with the property "eventHub" (of the type EventHub)
    * ``eventHub`` - ``EventHub``: The initialized EventHub Module.

-------
Returns
-------

``void``.

-------
Example
-------

.. code-block:: javascript

    runtime.executor.init({eventHub: runtime.eventHub})

------------------------------------------------------------------------------

.. _executor_executeContractCall:

executeContractCall
===================

.. code-block:: javascript

    executor.executeContractCall(contract, functionName, ...args);

gets contract from a solc compilation

----------
Parameters
----------

#. ``contract`` - ``any``: the target contract
#. ``functionName`` - ``string``: name of the contract function to call
#. ``...args`` - ``any[]``: optional array of arguments for contract call. if last arguments is {Object}, it is used as the options parameter

-------
Returns
-------

``Promise`` resolves to ``any``: contract calls result.

-------
Example
-------

.. code-block:: javascript

    const greetingMessage = await runtime.executor.executeContractCall(
      contract,                               // web3.js contract instance
      'greet'                                 // function name
    );

------------------------------------------------------------------------------

.. _executor_executeContractTransaction:

executeContractTransaction
==========================

.. code-block:: javascript

    executor.executeContractTransaction(contract, functionName, inputOptions, ...functionArguments);

execute a transaction against the blockchain, handle gas exceeded and return values from contract function

----------
Parameters
----------

#. ``contract`` - ``any``: contract instance
#. ``functionName`` - ``string``: name of the contract function to call
#. ``inputOptions`` - ``any``: options object
    * ``from`` - ``string`` (optional): The address the call "transaction" should be made from.
    * ``gas`` - ``number`` (optional): The amount of gas provided with the transaction.
    * ``event`` - ``string`` (optional): The event to wait for a result of the transaction, 
    * ``getEventResult`` - ``function`` (optional): callback function which will be called when the event is triggered.
    * ``eventTimeout`` - ``number`` (optional): timeout (in ms) to wait for a event result before the transaction is marked as error
    * ``estimate`` - ``boolean`` (optional): Should the amount of gas be estimated for the transaction (overwrites ``gas`` parameter)
    * ``force`` - ``string`` (optional): Forces the transaction to be executed. Ignores estimation errors
    * ``autoGas`` - ``number`` (optional): enables autoGas 1.1 ==> adds 10% to estimated gas costs. value capped to current block.
#. ``...functionArguments`` - ``any[]``: optional arguments to pass to contract transaction

-------
Returns
-------

``Promise`` resolves to: ``no result`` (if no event to watch was given), ``the event`` (if event but no getEventResult was given), ``the`` value returned by getEventResult(eventObject).

Because an estimation is performed, even if a fixed gas cost has been set, failing transactions are rejected before being executed. This protects users from executing transactions, that consume all provided gas and fail, which is usually not intended, especially if a large amount of gas has been provided. To prevent this behavior for any reason, add a ``force: true`` to the options, though it is **not advised to do so**.

To allow to retrieve the result of a transaction, events can be used to receive values from a transaction. If an event is provided, the transaction will only be fulfilled, if the event is triggered. To use this option, the executor needs to have the ``eventHub`` property has to be set. Transactions, that contain event related options and are passed to an executor without an ``eventHub`` will be rejected immediately.

-------
Example
-------

.. code-block:: javascript

    const accountId = '0x...';
    const greetingMessage = await runtime.executor.executeContractTransaction(
      contract,                               // web3.js contract instance
      'setData',                              // function name
      { from: accountId, },                   // perform transaction with this account
      123,                                    // arguments after the options are passed to the contract
    );

Provided gas is estimated automatically with a fault tolerance of 10% and then used as `gas` limit in the transaction. For a different behavior, set `autoGas` in the transaction options:

.. code-block:: javascript

    const greetingMessage = await runtime.executor.executeContractTransaction(
      contract,                               // web3.js contract instance
      'setData',                              // function name
      { from: accountId, autoGas: 1.05, },    // 5% fault tolerance
      123,                                    // arguments after the options are passed to the contract
    );

or set a fixed gas limit:

.. code-block:: javascript

    const greetingMessage = await runtime.executor.executeContractTransaction(
      contract,                               // web3.js contract instance
      'setData',                              // function name
      { from: accountId, gas: 100000, },      // fixed gas limit
      123,                                    // arguments after the options are passed to the contract
    );

Using events for getting return values:

.. code-block:: javascript

    const contractId = await runtime.executor.executeContractTransaction(
      factory,
      'createContract', {
        from: accountId,
        autoGas: 1.1,
        event: { target: 'FactoryInterface', eventName: 'ContractCreated', },
        getEventResult: (event, args) => args.newAddress,
      },
    );


------------------------------------------------------------------------------



.. _executor_executeSend:

executeSend
===================

.. code-block:: javascript

    executor.executeSend(options);

send EVEs to target account

----------
Parameters
----------

#. ``options`` - ``any``: the target contract
    * ``from`` - ``string``: The address the call "transaction" should be made from.
    * ``to`` - ``string``: The address where the eve's should be send to.
    * ``value`` - ``number``: Amount to send in Wei

-------
Returns
-------

``Promise`` resolves to ``void``: resolved when done.

-------
Example
-------

.. code-block:: javascript

    await runtime.executor.executeSend({
      from: '0x...',                          // send from this account
      to: '0x...',                            // receiving account
      value: web3.utils.toWei('1'),           // amount to send in Wei
    });

------------------------------------------------------------------------------


.. _executor_createContract:

createContract
===================

.. code-block:: javascript

    executor.createContract(contractName, functionArguments, options);

creates a contract by contstructing creation transaction and signing it with private key of options.from

----------
Parameters
----------

#. ``contractName`` - ``string``: contract name (must be available withing contract loader module)
#. ``functionArguments`` - ``any[]``: arguments for contract creation, pass empty Array if no arguments
#. ``options`` - ``any``: options object
    * ``from`` - ``string``: The address the call "transaction" should be made from.
    * ``gas`` - ``number``: Provided gas amout for contract creation.

-------
Returns
-------

``Promise`` resolves to ``any``: new contract.

-------
Example
-------

.. code-block:: javascript

    const newContractAddress = await runtime.executor.createContract(
      'Greeter',                              // contract name
      ['I am a demo greeter! :3'],            // constructor arguments
      { from: '0x...', gas: 100000, },        // gas has to be provided with a fixed value
    );



.. required for building markup


.. |source signerInterface| replace:: ``SignerInterface``
.. _source signerInterface: /blockchain/signer.html

.. |source eventHub| replace:: ``EventHub``
.. _source eventHub: /blockchain/event-hub.html

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: /common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: /common/logger.html#logloginterface

.. |source web3| replace:: ``Web3``
.. _source web3: https://github.com/ethereum/web3.js/