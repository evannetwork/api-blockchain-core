================================================================================
Signer Identity
================================================================================

.. list-table:: 
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - SignerIdentity
   * - Implements
     - `SignerInterface <https://github.com/evannetwork/dbcp/tree/master/src/contracts/signer-interface.ts>`_
   * - Extends
     - `Logger <../common/logger.html>`_
   * - Source
     - `signer-idenitity.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/contracts/signer-idenitity.ts>`_

The signers are used to create contract transactions and are used internally by the `Executor <../blockchain/executor.html>`_. The default runtime uses the `SignerInternal <https://github.com/evannetwork/dbcp/blob/master/src/contracts/signer-internal.ts>`_ helper to sign transaction.

In most cases, you won't have to use the Signer objects directly yourself, as the `Executor <../blockchain/executor.html>`_ is your entry point for performing contract transactions. `SignerIdentity` may be an exception to this rule, as it can be used to check currently used identity and account.

Note, that this signer supports using accounts and identities. If the `.from` property in the options is given as configured `activeIdentity`, transaction will be made via this identity, which requires the `underlyingAccount` to be in control of this identity. If `.from` is given as `underlyingAcccount`, transactions will be made directly from this account. Also keep in mind, that in both cases `underlyingAccount` needs to have enough funds to pay for the transactions, as this account is used to pay for them.



------------------------------------------------------------------------------

.. _signerIdentity_publicProperties:

Public Properties
================================================================================

#. ``activeIdentity`` - ``string``: identity used for transactions, usually controlled by `underlyingAccount`
#. ``underlyingAccount`` - ``string``: account, that pays for transactions used for transactions, usually controlling `activeIdentity`



------------------------------------------------------------------------------

.. _signerIdentity_constructor:

constructor
================================================================================

.. code-block:: typescript

  new SignerIdentity(options, config);

Creates a new `SignerInternal` instance. `config` can be set up later on with `updateConfig`, if required (e.g. when initializing a circular structure).

----------
Parameters
----------

#. ``options`` - ``SignerIdentityOptions``: options for SignerIdentity constructor (runtime like object)
    * ``contractLoader`` - |source contractLoader|_: |source contractLoader|_ instance
    * ``verifications`` - |source verifications|_: |source verifications|_ instance
    * ``web3`` - |source web3|_: |source web3|_ instance
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``
#. ``config`` - ``SignerIdentityConfig`` (optional): custom config for `SignerIdentity` instance
    * ``activeIdentity`` - ``string``: identity used for transactions, usually controlled by `underlyingAccount`
    * ``underlyingAccount`` - ``string``: account, that pays for transactions used for transactions, usually controlled by `underlyingAccount`
    * ``underlyingSigner`` - |source signerInterface|_: an instance of a |source signerInterface|_ implementation; usually a |source signerInternal|_ instance

-------
Returns
-------

``SignerIdentity`` instance

-------
Example
-------

.. code-block:: typescript

    const signer = new SignerIdentity(
      {
        contractLoader,
        verifications,
        web3,
      },
      {
        activeIdentity: await verifications.getIdentityForAccount(accounts[0], true),
        underlyingAccount: accounts[0],
        underlyingSigner,
      },
    );



------------------------------------------------------------------------------

.. _signerIdentity_signAndExecuteSend:

signAndExecuteSend
===================

.. code-block:: javascript

    signer.signAndExecuteSend(options, handleTxResult);

Performs a value transfer transaction. This will send specified funds to identity, which will send it to target. Funds are returned if transaction fails.

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
      from: '0x...',                          // send from this identity/account
      to: '0x...',                            // receiving account
      value: web3.utils.toWei('1'),           // amount to send in Wei
    }, (err, receipt) => {
      console.dir(arguments);
    });



------------------------------------------------------------------------------

.. _signerIdentity_signAndExecuteTransaction:

signAndExecuteTransaction
=========================

.. code-block:: javascript

    signer.signAndExecuteTransaction(contract, functionName, functionArguments, options, handleTxResult);

Create, sign and submit a contract transaction.

----------
Parameters
----------

#. ``contract`` - ``any``: contract instance from api.eth.loadContract(...)
#. ``functionName`` - ``string``: function name
#. ``functionArguments`` - ``any[]``: arguments for contract creation, pass empty Array if no arguments
#. ``options`` - ``any``: 
    * ``from`` - ``string``: The address (identity/account) the call "transaction" should be made from.
    * ``gas`` - ``number``: Amount of gas to attach to the transaction
    * ``to`` - ``string`` (optional): The address where the eve's should be send to.
    * ``value`` - ``number`` (optional): Amount to send in Wei
#. ``handleTxResult`` - ``function(error, receipt)``: callback when transaction receipt is available or error



------------------------------------------------------------------------------

.. _signerIdentity_createContract:

createContract
===================

.. code-block:: javascript

    signer.createContract(contractName, functionArguments, options);

Creates a smart contract.

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

``Promise`` resolves to ``any``: web3 instance of new contract.



------------------------------------------------------------------------------

.. _signerIdentity_signMessage:

signMessage
===================

.. code-block:: javascript

    signer.signMessage(accountId, message);

Sign given message with accounts private key, does not work for identity.

----------
Parameters
----------

#. ``accountId`` - ``string``: accountId to sign with, **cannot be done with activeIdentity**
#. ``message`` - ``string``: message to sign

-------
Returns
-------

``Promise`` resolves to ``string``: signature

-------
Example
-------

.. code-block:: javascript

      const signature = await signer.signMessage(accountId, messageToSign);



--------------------------------------------------------------------------------

.. _signerIdentity_updateConfig:

updateConfig
================================================================================

.. code-block:: typescript

  signer.updateConfig(partialOptions, config);

Update config of `SignerIdentity` can also be used to setup verifications and accounts after initial setup and linking with other modules.

----------
Parameters
----------

#. ``partialOptions`` - ``{ verifications: Verifications }``: object with `verifications` property, e.g. a runtime
#. ``config`` - ``SignerIdentityConfig``: custom config for `SignerIdentity` instance
    * ``activeIdentity`` - ``string``: identity used for transactions, usually controlled by `underlyingAccount`
    * ``underlyingAccount`` - ``string``: account, that pays for transactions used for transactions, usually controlled by `underlyingAccount`
    * ``underlyingSigner`` - |source signerInterface|_: an instance of a |source signerInterface|_ implementation; usually a |source signerInternal|_ instance

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

    // create new instance
    const signer = new SignerIdentity(
      {
        contractLoader,
        verifications,
        web3,
      },
    );

    // use instance, e.g. reference it in other components like `verifications`
    // ...

    // now set verfications instance and account in signer
    signer.updateConfig(
      { verifications },
      {
        activeIdentity,
        underlyingAccount,
        underlyingSigner: signerInternal,
      },
    );



.. required for building markup

.. |source contractLoader| replace:: ``ContractLoader``
.. _source contractLoader: ../contracts/contract-loader.html

.. |source keyStoreinterface| replace:: ``KeyStoreInterface``
.. _source keyStoreinterface: ../blockchain/account-store.html

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: ../common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: ../common/logger.html#logloginterface

.. |source signerInterface| replace:: ``SignerInterface``
.. _source signerInterface: https://github.com/evannetwork/dbcp/tree/master/src/contracts/signer-interface.ts

.. |source signerInternal| replace:: ``SignerInternal``
.. _source signerInternal: ../blockchain/signer-internal.html

.. |source verifications| replace:: ``Verifications``
.. _source verifications: ../profile/verifications.html

.. |source web3| replace:: ``Web3``
.. _source web3: https://github.com/ethereum/web3.js/
