================================================================================
Key Provider
================================================================================

.. list-table:: 
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - KeyProvider
   * - Implements
     - `KeyProviderInterface <https://github.com/evannetwork/dbcp/tree/master/src/encryption/key-provider-interface.ts>`_
   * - Extends
     - `Logger <../common/logger.html>`_
   * - Source
     - `key-provider.ts <https://github.com/evannetwork/dbcp/tree/master/src/encryption/key-provider.ts>`_

The `KeyProvider <https://github.com/evannetwork/dbcp/tree/master/src/encryption/key-provider.ts>`_ returns given decryption/encryption keys for a given CryptoInfo. They use a given evan.network profile to retrieve the needed keys to encrypt/decrypt the envelope

------------------------------------------------------------------------------

.. _key_provider_constructor:

constructor
================================================================================

.. code-block:: typescript

  new KeyProvider(options);

Creates a new KeyProvider instance.

----------
Parameters
----------

#. ``options`` - ``KeyProviderOptions``: options for KeyProvider constructor.
    * ``keys`` - ``any`` (optional): object with key mappings of accounts
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``

-------
Returns
-------

``KeyProvider`` instance

-------
Example
-------

.. code-block:: typescript
  
  const keyProvider = new KeyProvider({
      keys: {
        '0x123': 'abcdeF9043'
      }
    });


--------------------------------------------------------------------------------

.. _key_provider_init:

init
===================

.. code-block:: javascript

    keyProvider.init(_profile);

initialize a new KeyProvider with a given evan.network Profile

----------
Parameters
----------

#. ``_profile`` - ``Profile``: initialized evan.network profile

-------
Example
-------

.. code-block:: javascript

    runtime.keyProvider.init(runtime.profile);

------------------------------------------------------------------------------

.. _key_provider_getKey:

getKey
===================

.. code-block:: javascript

    keyProvider.getKey(info);

get a encryption/decryption key for a specific CryptoInfo from the associated AccountStore or the loaded evan.network profile

----------
Parameters
----------

#. ``cryptoAlgo`` - ``string``: crypto algorithm

-------
Returns
-------

Promise resolves to ``string``: the found key for the cryptoinfo.

-------
Example
-------

.. code-block:: javascript

    const cryptoInfo = {
      "public": {
        "name": "envelope example"
      },
      "private": "...",
      "cryptoInfo": {
        "algorithm": "unencrypted",
        "keyLength": 256,
        "originator": "0x0000000000000000000000000000000000000001,0x0000000000000000000000000000000000000002",
        "block": 123
      }
    };
    const key = runtime.keyProvider.getKey(info);

.. required for building markup

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: ../common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: ../common/logger.html#logloginterface
