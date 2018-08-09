================================================================================
Cryptor - AES ECB
================================================================================

.. list-table:: 
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - AesEcb
   * - Implements
     - `Cryptor <https://github.com/evannetwork/dbcp/tree/master/src/encryption/cryptor.ts>`_
   * - Extends
     - `Logger </common/logger.html>`_
   * - Source
     - `aes-ecb.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/encryption/aes-ecb.ts>`_
   * - Tests
     - `aes-ecb.spec.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/encryption/aes-ecb.spec.ts>`_

The `AES ECB <https://github.com/evannetwork/api-blockchain-core/tree/master/src/encryption/aes-ecb.ts>`_ cryptor encodes and decodes content with aes-ecb.

------------------------------------------------------------------------------

.. _cryptor_aes_ecb_constructor:

constructor
================================================================================

.. code-block:: typescript

  new AesEcb(options);

Creates a new AesEcb instance.

----------
Parameters
----------

#. ``options`` - ``AesEcbOptions``: options for AesEcb constructor.
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``

-------
Returns
-------

``AesEcb`` instance

-------
Example
-------

.. code-block:: typescript
  
  const aesEcb = new AesEcb();


------------------------------------------------------------------------------

.. _cryptor_aes_ecb_getCryptoInfo:

getCryptoInfo
===================

.. code-block:: javascript

    cryptor.getCryptoInfo(originator);

create new crypto info for this cryptor

----------
Parameters
----------

#. ``originator`` - ``string``: originator or context of the encryption

-------
Returns
-------

``CryptoInfo``: details about encryption for originator with this cryptor.

-------
Example
-------

.. code-block:: javascript

    const cryptor = new AesEcb();
    const cryptoInfo = cryptor.getCryptoInfo('0x123');

------------------------------------------------------------------------------

.. _cryptor_aes_ecb_generateKey:

generateKey
===================

.. code-block:: javascript

    cryptor.generateKey();

generate key for cryptor/decryption

-------
Returns
-------

Promise resolves to ``string``: key used for encryption.

-------
Example
-------

.. code-block:: javascript

    const cryptor = new Unencrypted();
    const cryptoInfo = cryptor.generateKey();

------------------------------------------------------------------------------

.. _cryptor_aes_ecb_encrypt:

encrypt
===================

.. code-block:: javascript

    cryptor.encrypt(message, options);

'encrypt' a message (serializes message)

----------
Parameters
----------

#. ``message`` - ``string``: message which should be encrypted
#. ``options`` - ``any``: cryptor options
    * ``key``  - ``string``: key used for encryption

-------
Returns
-------

Promise resolves to ``string``: encrypted message.

-------
Example
-------

.. code-block:: javascript

    const cryptor = new Unencrypted();
    const cryptoInfo = cryptor.encrypt('Hello World', { key: '0x12345' });

------------------------------------------------------------------------------

.. _cryptor_aes_ecb_decrypt:

decrypt
===================

.. code-block:: javascript

    cryptor.decrypt(message, options);

'decrypt' a message (deserializes message)

----------
Parameters
----------

#. ``message`` - ``Buffer``: message which should be decrypted
#. ``options`` - ``any``: cryptor options
    * ``key``  - ``string``: key used for encryption

-------
Returns
-------

Promise resolves to ``any``: decrypted message.

-------
Example
-------

.. code-block:: javascript

    const cryptor = new Unencrypted();
    const cryptoInfo = cryptor.decrypt('afeweq41f1e61e3f', { key: '0x12345' });

.. required for building markup

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: /common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: /common/logger.html#logloginterface