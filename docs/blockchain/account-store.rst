================================================================================
Account Store
================================================================================

.. list-table:: 
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - AccountStore
   * - Implements
     - `KeyStoreInterface <https://github.com/evannetwork/dbcp/tree/master/src/account-store.ts>`__
   * - Extends
     - `Logger </common/logger.html>`_
   * - Source
     - `account-store.ts <https://github.com/evannetwork/dbcp/tree/master/src/account-store.ts>`__

The `AccountStore <https://github.com/evannetwork/dbcp/tree/master/src/account-store.ts>`_ implements the `KeyStoreInterface <https://github.com/evannetwork/dbcp/tree/master/src/account-store.ts>`_ and is a wrapper for a storage, where evan.network account ids are stored. The default `AccountStore <https://github.com/evannetwork/dbcp/tree/master/src/account-store.ts>`_ takes an account --> private key mapping as a pojo as its arguments and uses this to perform lookups, when the :ref:`getPrivateKey <accountstore_getPrivateKey>` function is called. This lookup needs to be done, when transactions are signed by the `InternalSigner <https://github.com/evannetwork/dbcp/tree/master/src/contracts/signer-internal.ts>`_ (see `Signer </blockchain/signer.html>`_).

Note that the return value of the :ref:`getPrivateKey <accountstore_getPrivateKey>` function is a promise. This may not be required in the default `AccountStore <https://github.com/evannetwork/dbcp/tree/master/src/account-store.ts>`_, but this allows you to implement own implementations of the `KeyStoreInterface <https://github.com/evannetwork/dbcp/tree/master/src/account-store.ts>`_, which may enforce a more strict security behavior or are able to access other sources for private keys.



------------------------------------------------------------------------------

.. _accountstore_constructor:

constructor
================================================================================

.. code-block:: typescript

  new AccountStore(options);

Creates a new AccountStore instance.

----------
Parameters
----------

#. ``options`` - ``AccountStoreOptions``: options for AccountStore constructor.
    * ``accounts`` - ``any``: object with accountid/privatekey mapping
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``

-------
Returns
-------

``AccountStore`` instance

-------
Example
-------

.. code-block:: typescript
  
  const accountStore = new AccountStore({
      accounts: {
      	'0x1234': '12479abc3df'
      }
    });



--------------------------------------------------------------------------------

.. _accountstore_getPrivateKey:

getPrivateKey
===================

.. code-block:: javascript

    accountStore.getPrivateKey(accountId);

get private key for given account



----------
Parameters
----------

#. ``accountId`` - ``string``: eth accountId

-------
Returns
-------

Promise resolves to ``string``: private key for this account

-------
Example
-------

.. code-block:: javascript

    const privateKey = await runtime.accountStore.getPrivateKey('0x0000000000000000000000000000000000000002');

.. required for building markup

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: /common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: /common/logger.html#logloginterface
