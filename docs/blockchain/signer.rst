================================================================================
Signer
================================================================================

.. list-table:: 
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - SignerInternal
   * - Implements
     - `SignerInterface <https://github.com/evannetwork/dbcp/tree/master/src/contracts/signer-interface.ts>`_
   * - Extends
     - `Logger </common/logger.html>`_
   * - Source
     - `signer-internal.ts <https://github.com/evannetwork/dbcp/tree/master/src/contracts/signer-internal.ts>`_

The signers are used to create contract transactions and are used internally by the `Executor </blockchain/executor.html>`_. The default runtime uses the `SignerInternal <https://github.com/evannetwork/dbcp/blob/master/src/contracts/signer-internal.ts>`_ helper to sign transaction.

In most cases, you won't have to use the Signer objects directly yourself, as the `Executor </blockchain/executor.html>`_ is your entry point for performing contract transactions.

------------------------------------------------------------------------------

.. _signer_constructor:

constructor
================================================================================

.. code-block:: typescript

  new SignerInternal(options);

Creates a new SignerInternal instance.

----------
Parameters
----------

#. ``options`` - ``SignerInternalOptions``: options for SignerInternal constructor.
    * ``accountStore`` - |source keyStoreinterface|_: |source keyStoreinterface|_ instance
    * ``config`` - ``any``: signer internal configuration
    * ``contractLoader`` - |source contractLoader|_: |source contractLoader|_ instance
    * ``web3`` - |source web3|_: |source web3|_ instance
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``

-------
Returns
-------

``SignerInternal`` instance

-------
Example
-------

.. code-block:: typescript
  
  const signer = new SignerInternal({
      accountStore,
      config,
      contractLoader,
      web3
    });

------------------------------------------------------------------------------

.. _signer_getPrivateKey:

getPrivateKey
===================

.. code-block:: javascript

    signer.getPrivateKey(accountId);

retrieve private key for given account

----------
Parameters
----------

#. ``accountId`` - ``string``: eth accountId

-------
Returns
-------

``Promise`` resolves to ``string``: private key of given account.

-------
Example
-------

.. code-block:: javascript

    const privateKey = await runtime.signer.getPrivateKey('0x00000000000000000000000000000000deadbeef');

------------------------------------------------------------------------------

.. _signer_ensureHashWithPrefix:

ensureHashWithPrefix
====================

.. code-block:: javascript

    signer.ensureHashWithPrefix(input);

patch '0x' prefix to input if not already added, also casts numbers to hex string

----------
Parameters
----------

#. ``input`` - ``string``: input to prefix with '0x'

-------
Returns
-------

``string``: patched input.

-------
Example
-------

.. code-block:: javascript

    const patchedInput = runtime.signer.ensureHashWithPrefix('00000000000000000000000000000000deadbeef');
    // returns 0x00000000000000000000000000000000deadbeef

------------------------------------------------------------------------------

.. _signer_getGasPricex:

getGasPrice
===================

.. code-block:: javascript

    signer.getGasPrice();

get gas price (either from config or from api.eth.web3.eth.gasPrice (gas price median of last blocks) or api.config.eth.gasPrice; unset config value or set it to falsy for median gas price

-------
Returns
-------

``string``: hex string with gas price.

-------
Example
-------

.. code-block:: javascript

    const gasPrice = await runtime.signer.getGasPrice();
    // returns 0x4A817C800

------------------------------------------------------------------------------

.. _signer_getNonce:

getNonce
===================

.. code-block:: javascript

    signer.getNonce(accountId);

gets nonce for current user, looks into actions submitted by current user in current block for this as well

----------
Parameters
----------

#. ``accountId`` - ``string``: Ethereum account ID

-------
Returns
-------

``number``: nonce of given user.

-------
Example
-------

.. code-block:: javascript

    const patchedInput = runtime.signer.getNonce('00000000000000000000000000000000deadbeef');
    // returns 10

------------------------------------------------------------------------------

.. _signer_signAndExecuteSend:

signAndExecuteSend
===================

.. code-block:: javascript

    signer.signAndExecuteSend(options, handleTxResult);

signs the transaction from  `executor.executeSend </blockchain/executor.html#executesend>`_ and publishes to the network

----------
Parameters
----------

#. ``options`` - ``any``: 
    * ``from`` - ``string``: The address the call "transaction" should be made from.
    * ``to`` - ``string``: The address where the eve's should be send to.
    * ``value`` - ``number``: Amount to send in Wei
#. ``handleTxResult`` - ``function(error, receipt)``: callback when transaction receipt is available or error

-------
Example
-------

.. code-block:: javascript

    const patchedInput = runtime.signer.signAndExecuteSend({
      from: '0x...',                          // send from this account
      to: '0x...',                            // receiving account
      value: web3.utils.toWei('1'),           // amount to send in Wei
    }, (err, receipt) => {
      console.dir(arguments);
    });

------------------------------------------------------------------------------

.. _signer_signAndExecuteTransaction:

signAndExecuteTransaction
=========================

.. code-block:: javascript

    signer.signAndExecuteTransaction(contract, functionName, functionArguments, options, handleTxResult);

signs the transaction from `executor.executeContractTransaction </blockchain/executor.html#executecontracttransaction>`_ and publishes to the network

----------
Parameters
----------

#. ``contract`` - ``any``: contract instance from api.eth.loadContract(...)
#. ``functionName`` - ``string``: function name
#. ``functionArguments`` - ``any[]``: arguments for contract creation, pass empty Array if no arguments
#. ``options`` - ``any``: 
    * ``from`` - ``string``: The address the call "transaction" should be made from.
    * ``gas`` - ``number``: Amount of gas to attach to the transaction
    * ``to`` - ``string`` (optional): The address where the eve's should be send to.
    * ``value`` - ``number`` (optional): Amount to send in Wei
#. ``handleTxResult`` - ``function(error, receipt)``: callback when transaction receipt is available or error


------------------------------------------------------------------------------

.. _signer_createContract:

createContract
===================

.. code-block:: javascript

    signer.createContract(contractName, functionArguments, options);

signs the transaction from `executor.createContract </blockchain/executor.html#createcontract>`_ and publishes to the network

----------
Parameters
----------

#. ``contractName`` - ``any``: contractName from contractLoader
#. ``functionArguments`` - ``any[]``: arguments for contract creation, pass empty Array if no arguments
#. ``options`` - ``any``: 
    * ``from`` - ``string``: The address the call "transaction" should be made from.
    * ``gas`` - ``number``: Amount of gas to attach to the transaction

-------
Returns
-------

``Promise`` resolves to ``void``: resolved when done.


.. required for building markup


.. |source contractLoader| replace:: ``ContractLoader``
.. _source contractLoader: /contracts/contract-loader

.. |source keyStoreinterface| replace:: ``KeyStoreInterface``
.. _source keyStoreinterface: /blockchain/account-store.html

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: /common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: /common/logger.html#logloginterface

.. |source web3| replace:: ``Web3``
.. _source web3: https://github.com/ethereum/web3.js/