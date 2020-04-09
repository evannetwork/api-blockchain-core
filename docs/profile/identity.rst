================================================================================
Identity
================================================================================

.. list-table::
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - Identity
   * - Extends
     - `Logger <../common/logger.html>`_
   * - Source
     - `identity.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/identity/identity.ts>`_
   * - Examples
     - `identity.spec.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/identity/identity.spec.ts>`_

Each account that is registered on the evan.network, has a identity with a assigned profile contract. Each identity can be permitted to act on behalf of another identity. This identity library helps to grant / remove read or write permissions to act on behalf of a identity and also to manage identities where a identity was invitited to.



--------------------------------------------------------------------------------

.. _mailbox_constructor:

constructor
================================================================================

.. code-block:: typescript

  new Identity(options);

Creates a new identity instance with a specific identity / underlying address context.

----------
Parameters
----------

#. ``options`` - ``MailboxOptions``: options for Mailbox constructor.
    * ``activeIdentity`` - |source activeIdentity|_: identity address to manage
    * ``contractLoader`` - |source contractLoader|_: |source contractLoader|_ instance
    * ``did`` - |source did|_: |source did|_ instance
    * ``executor`` - |source executor|_: |source executor|_ instance
    * ``mailbox`` - |source mailbox|_: |source mailbox|_ instance
    * ``nameResolver`` - |source nameResolver|_: |source nameResolver|_ instance
    * ``profile`` - |source profile|_: |source profile|_ instance
    * ``runtimeConfig`` - |source runtimeConfig|_: runtime configuration with a keyConfig
    * ``underlyingAccount`` - |source underlyingAccount|_:
    * ``verifications`` - |source verifications|_: |source verifications|_ instance
    * ``web3`` - |source web3|_: |source web3|_ instance
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``

-------
Returns
-------

``Identity`` instance

-------
Example
-------

.. code-block:: typescript

  const identity = new Identity({
    activeIdentity,
    config,
    contractLoader,
    did,
    executor,
    mailbox,
    nameResolver,
    profile,
    runtimeConfig,
    underlyingAccount,
    verifications,
    web3,
  });

.. required for building markup

.. |source contractLoader| replace:: ``ContractLoader``
.. _source contractLoader: ../contracts/contract-loader.html

.. |source cryptoProvider| replace:: ``CryptoProvider``
.. _source cryptoProvider: ../encryption/crypto-provider.html

.. |source executor| replace:: ``Executor``
.. _source executor: ../blockchain/executor.html

.. |source ipfs| replace:: ``Ipfs``
.. _source ipfs: ../dfs/ipfs.html

.. |source keyProviderInterface| replace:: ``KeyProviderInterface``
.. _source keyProviderInterface: ../encryption/key-provider.html

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: ../common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: ../common/logger.html#logloginterface

.. |source nameResolver| replace:: ``NameResolver``
.. _source nameResolver: ../blockchain/name-resolver.html