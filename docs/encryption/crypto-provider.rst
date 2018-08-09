================================================================================
Crypto Provider
================================================================================

.. list-table:: 
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - CryptoProvider
   * - Extends
     - `CryptoProvider <https://github.com/evannetwork/dbcp/tree/master/src/encryption/crypto-provider.ts>`_
   * - Source
     - `crypto-provider.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/encryption/crypto-provider.ts>`_

The `CryptoProvider <https://github.com/evannetwork/dbcp/tree/master/src/encryption/crypto-provider.ts>`_ is a container for supported `Cryptors <#cryptors>`_ and is able to determine, which `Cryptor <#cryptors>`_ to use for encryption / decryption.

------------------------------------------------------------------------------

.. _crypto_provider_constructor:

constructor
================================================================================

.. code-block:: typescript

  new CryptoProvider(cryptors);

Creates a new CryptoProvider instance.

----------
Parameters
----------

#. ``cryptors`` - ``any``: object with available |source cryptors|_.

-------
Returns
-------

``CryptoProvider`` instance

-------
Example
-------

.. code-block:: typescript
  
  const serviceContract = new CryptoProvider({
      cryptors: {
        aes: new Aes(),
        unencrypted: new Unencrypted()
      }
    });



--------------------------------------------------------------------------------

.. _crypto_provider_getCryptorByCryptoAlgo:

getCryptorByCryptoAlgo
=======================

.. code-block:: javascript

    cryptoProvider.getCryptorByCryptoAlgo(cryptoAlgo);

get a Cryptor matching the crypto algorithm

----------
Parameters
----------

#. ``cryptoAlgo`` - ``string``: crypto algorithm

-------
Returns
-------

``Cryptor``: matching cryptor.

-------
Example
-------

.. code-block:: javascript

    const cryptor = runtime.cryptoProvider.getCryptorByCryptoAlgo('aes');

------------------------------------------------------------------------------

.. _crypto_provider_getCryptorByCryptoInfo:

getCryptorByCryptoInfo
=======================

.. code-block:: javascript

    cryptoProvider.getCryptorByCryptoInfo(info);

get a Cryptor matching the provided CryptoInfo

----------
Parameters
----------

#. ``info`` - ``CryptoInfo``: details about en-/decryption

-------
Returns
-------

``Cryptor``: matching cryptor.

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
    const cryptor = runtime.cryptoProvider.getCryptorByCryptoInfo(cryptoInfo);

------------------------------------------------------------------------------

= Additional Components =
==========================

Interfaces
================

.. _crypto_provider_cryptor:

----------
Cryptor
----------

#. ``options`` - ``any``: options which will passed to the cryptor to work (like key for encryption)
#. ``generateKey`` - ``function``: generates a random key for encryption/decryption
#. ``getCryptoInfo`` - ``function``: returns a empty CryptoInfo object for the current Cryptor
#. ``encrypt`` - ``function``: function to encrypt a given message
#. ``decrypt`` - ``function``: function to decrypt a given message

.. _crypto_provider_envelope:

----------
Envelope
----------

#. ``algorithm`` - ``string``: algorithm used for encryption
#. ``block`` - ``number`` (optional): block number for which related item is encrypted
#. ``cryptorVersion`` - ``number`` (optional): version of the cryptor used. describes the implementation applied during decryption and not the algorithm version.
#. ``originator`` - ``string`` (optional): context for encryption, this can be

   - a context known to all parties (e.g. key exchange)

   - a key exchanged between two accounts (e.g. bmails)

   - a key from a sharings info from a contract (e.g. DataContract)

   defaults to 0

#. ``keyLength`` - ``number`` (optional): length of the key used in encryption

.. _crypto_provider_cryptoinfo:

----------
CryptoInfo
----------

#. ``public`` - ``any`` (optional): unencrypted part of the data; will stay as is during encryption
#. ``private`` - ``any`` (optional): encrypted part of the data. If encrypting, this part will be encrypted, depending on the encryption. If already encrypted, this will be the encrypted value
#. ``cryptoInfo`` - ``CryptoInfo``: describes used encryption


.. required for building markup

.. |source cryptors| replace:: ``Cryptors``
.. _source cryptors: /encryption/crypto-provider.html#cryptors