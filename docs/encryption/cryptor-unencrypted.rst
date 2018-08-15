================================================================================
Cryptor - Unencrypted
================================================================================

.. list-table:: 
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - Unencrypted
   * - Implements
     - `Cryptor <https://github.com/evannetwork/dbcp/tree/master/src/encryption/cryptor.ts>`_
   * - Extends
     - `Logger <../common/logger.html>`_
   * - Source
     - `unencrypted.ts <https://github.com/evannetwork/dbcp/tree/master/src/encryption/unencrypted.ts>`_

The `Unencrypted <https://github.com/evannetwork/dbcp/tree/master/src/encryption/unencrypted.ts>`_ cryptor encodes and decodes content "unencrypted" this means no encryption is applied to the content. So simply the content is public, only HEX encoded.

------------------------------------------------------------------------------

.. _cryptor_unencrypted_constructor:

constructor
================================================================================

.. code-block:: typescript

  new Unencrypted(options);

Creates a new Unencrypted instance.

----------
Parameters
----------

#. ``options`` - ``UnencryptedOptions``: options for Unencrypted constructor.
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``

-------
Returns
-------

``Unencrypted`` instance

-------
Example
-------

.. code-block:: typescript
  
  const unencrypted = new Unencrypted();

------------------------------------------------------------------------------

.. _cryptor_unencrypted_getCryptoInfo:

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

    const cryptor = new Unencrypted();
    const cryptoInfo = cryptor.getCryptoInfo('0x123');

------------------------------------------------------------------------------

.. _cryptor_unencrypted_generateKey:

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

.. _cryptor_unencrypted_encrypt:

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

.. _cryptor_unencrypted_decrypt:

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