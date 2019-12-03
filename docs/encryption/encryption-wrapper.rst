================================================================================
Encryption Wrapper
================================================================================

.. list-table:: 
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - EncryptionWrapper
   * - Extends
     - `Logger <../common/logger.html>`_
   * - Source
     - `encryption-wrapper.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/encryption/encryption-wrapper.ts>`_
   * - Examples
     - `encryption-wrapper.spec.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/encryption/encryption-wrapper.spec.ts>`_

Encryption processes othen deal with the following questions:

- Where to get a key from?
- Do I need to generate a new key? How can I store this?
- How to fetch a matching crypto?
- How to encrypt data?

``EncryptionWrapper`` handles these topcis and offers a fast way to work with encryption.



--------------------------------------------------------------------------------

.. _encryption-wrapper_constructor:

constructor
================================================================================

.. code-block:: typescript

  new EncryptionWrapper(options);

Create new ``EncryptionWrapper`` instance.

----------
Parameters
----------

#. ``options`` - ``DigitalTwinOptions``: runtime-like object with required modules
    * ``cryptoProvider`` - |source cryptoProvider|_: |source cryptoProvider|_ instance
    * ``nameResolver`` - |source nameResolver|_: |source nameResolver|_ instance
    * ``profile`` - |source profile|_: |source profile|_ instance
    * ``sharing`` - |source sharing|_: |source sharing|_ instance
    * ``web3`` - |source web3|_: |source web3|_ instance
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog`` factory

-------
Returns
-------

``EncryptionWrapper`` instance

-------
Example
-------

.. code-block:: typescript

  const encryptionWrapper = new EncryptionWrapper(runtime);



--------------------------------------------------------------------------------

= CryptoInfos =
===============================

.. _encryption-wrapper_getCryptoInfo:

getCryptoInfo
================================================================================

.. code-block:: typescript

  encryptionWrapper.getCryptoInfo(keyContext, keyType, cryptorType[, artifacts])

|source cryptoInfo|_ s are descriptors for encrypted documents. They are stored alongside the encrypted data and provide a hint about the context of the data and how to decrypt them. In the ``EncryptionWrapper`` they are also used as an option parameter for the ``encrypt`` function.

----------
Parameters
----------

#. ``keyContext`` - ``any``: used to identify key, can be any string (but must not have colons)
#. ``keyType`` - ``EncryptionWrapperKeyType``: defines where keys are stored
#. ``cryptorType`` - ``EncryptionWrapperCryptorType``: cryptor to use
#. ``artifacts`` - ``any``: (optional) additional information for encryption may be required, depends on ``keyType``, see section below for details

artifacts
---------
Depending on ``keyType`` different properties are required. ``artifacts`` can be omitted, if used ``keyType`` is not listed below.

* ``EncryptionWrapperKeyType.Sharing``:

    * ``sharingContractId`` - ``string``: contract address of ``Shared`` or ``MultiShared`` contract
    * ``sharingId`` - ``string`` (optional): id in a ``MultiShared`` contract and only used for them, defaults to ``null``

-------
Returns
-------

``Promise`` returns |source cryptoInfo|_: crypto info built out of input arguments

-------
Example
-------

.. code-block:: typescript

  const keyContext = 'my key 15';
  const cryptoInfo = await encryptionWrapper.getCryptoInfo(
    keyContext,
    EncryptionWrapperKeyType.Profile,
    EncryptionWrapperCryptorType.Content,
  );
  console.dir(cryptoInfo);
  // Output:
  // { algorithm: 'aes-256-cbc',
  // block: 198543,
  // originator: 'profile:my key 15' }



--------------------------------------------------------------------------------

= Key Handling =
================

.. _encryption-wrapper_generateKey:

generateKey
================================================================================

.. code-block:: typescript

  encryptionWrapper.generateKey(cryptoInfo);

Generates a new encryption key. Crypto algorithm in ``cryptoInfo`` is used to decide on which ``Cryptor`` to pick for this.

----------
Parameters
----------

#. ``cryptoInfo`` - |source cryptoInfo|_: details for encryption, can be created with :ref:`getCryptoInfo <encryption-wrapper_getCryptoInfo>`

-------
Returns
-------

``Promise`` returns ``any``: key to encrypt/decrypt data

-------
Example
-------

.. code-block:: typescript

  const key = await encryptionWrapper.generateKey(cryptoInfo);
  console.dir(key);
  // Output:
  // 'd387d41011a2f04f18930e982ad30c537d29bc12588164cb978d0f70a5d11b3f'



--------------------------------------------------------------------------------

.. _encryption-wrapper_storeKey:

storeKey
================================================================================

.. code-block:: typescript

  encryptionWrapper.storeKey(cryptoInf[, artifacts]);

Store key in respective storage location, depending on given cryptoInfo, additional information may be required, which can be given via ``artifacts``.

----------
Parameters
----------

#. ``cryptoInfo`` - |source cryptoInfo|_: details for encryption, can be created with :ref:`getCryptoInfo <encryption-wrapper_getCryptoInfo>`
#. ``key`` - ``any``: key to store
#. ``artifacts`` - ``any``: (optional) additional information for encryption may be required, depends on ``cryptoInfo.originator``, see section below for details

artifacts
---------
Depending on ``cryptoInfo.originator`` different properties are required. ``artifacts`` can be omitted, if used ``cryptoInfo.originator`` schema is not listed below. Note, that ``cryptoInfo.originator`` schema depends on with which ``EncryptionWrapperKeyType`` :ref:`getCryptoInfo <encryption-wrapper_getCryptoInfo>` was called.

* ``sharing:.*``:
    * ``accountId`` - ``string``: accountId, that is used to share keys from, executes the internal transaction
    * ``receiver`` - ``string`` (optional): accountId, that receives the key, defaults to ``accountId``

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const key = await encryptionWrapper.generateKey(cryptoInfo);
  await encryptionWrapper.storeKey(cryptoInfo, key);



--------------------------------------------------------------------------------

.. _encryption-wrapper_getKey:

getKey
================================================================================

.. code-block:: typescript

  encryptionWrapper.getKey(cryptoInf[, artifacts]);

Get key for given ``cryptoInfo``. Can when storing keys in custom storage locations.

----------
Parameters
----------

#. ``cryptoInfo`` - |source cryptoInfo|_: details for encryption, can be created with :ref:`getCryptoInfo <encryption-wrapper_getCryptoInfo>`
#. ``artifacts`` - ``any``: (optional) additional information for encryption may be required, depends on ``cryptoInfo.originator``, see section below for details

artifacts
---------
Depending on ``cryptoInfo.originator`` different properties are required. ``artifacts`` can be omitted, if used ``cryptoInfo.originator`` schema is not listed below. Note, that ``cryptoInfo.originator`` schema depends on with which ``EncryptionWrapperKeyType`` :ref:`getCryptoInfo <encryption-wrapper_getCryptoInfo>` was called.

* ``sharing:.*``:

    * ``accountId`` - ``string``: accountId, that accesses data, is used to get shared keys with
    * ``propertyName`` - ``string`` (optional): property, that is decrypted, defaults to ``'*'``

* ``custom:.*``:

    * ``key`` - ``string``: accountId, that accesses data, is used to get shared keys with

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const keyContext = 'my key 15';
  const cryptoInfo = await encryptionWrapper.getCryptoInfo(
    keyContext,
    EncryptionWrapperKeyType.Profile,
    EncryptionWrapperCryptorType.Content,
  );
  console.dir(await encryptionWrapper.getKey(cryptoInfo));
  // Output:
  // '08bca9594ebaa7812f030f299fa30b51c5a7c3e7b2b66cd0a18c5cf46314aab7'



--------------------------------------------------------------------------------

= Encryption =
==============

.. _encryption-wrapper_encrypt:

encrypt
================================================================================

.. code-block:: typescript

  encryptionHandler.encrypt(toEncrypt, cryptoInfo[, artifacts]);

Encrypt given object, depending on given ``cryptoInfo``, additional information may be required, which can be given via ``artifacts``

----------
Parameters
----------

#. ``toEncrypt`` - ``any``: object to encrypt
#. ``cryptoInfo`` - ``CryptoInfo``: details for encryption, can be created with ``getCryptoInfos``
#. ``artifacts`` - ``any``: (optional) additional information for encryption may be required, depends on ``cryptoInfo.originator``, see section below for details

artifacts
---------
Depending on ``cryptoInfo.originator`` different properties are required. ``artifacts`` can be omitted, if used ``cryptoInfo.originator`` schema is not listed below. Note, that ``cryptoInfo.originator`` schema depends on with which ``EncryptionWrapperKeyType`` :ref:`getCryptoInfo <encryption-wrapper_getCryptoInfo>` was called.

* ``sharing:.*``:

    * ``accountId`` - ``string``: accountId, that accesses data, is used to get shared keys with
    * ``propertyName`` - ``string`` (optional): property, that is encrypted, defaults to ``'*'``

* ``custom:.*``:

    * ``key`` - ``string``: accountId, that accesses data, is used to get shared keys with

-------
Returns
-------

``Promise`` returns ``Envelope``: envelope with encrypted data

-------
Example
-------

.. code-block:: typescript

  const sampleData = {
    foo: TestUtils.getRandomBytes32(),
    bar: Math.random(),
  };
  const keyContext = 'my key 15';
  const cryptoInfo = await encryptionWrapper.getCryptoInfo(
    keyContext,
    EncryptionWrapperKeyType.Profile,
    EncryptionWrapperCryptorType.Content,
  );
  const encrypted = await encryptionWrapper.encrypt(sampleData, cryptoInfo);
  // Output:
  // { private:
  //    'ec6a2e0401e6270c50a88db31d0a22b677516162925a87bb7ec11a80613275817b883e75ee4bc8f82fe681d3462cf8ad49fce9d08797045b0c4bf6e3407b507f610a6c9678b6d3525c3b951189e4fec5bcbe2e71d5e471c43e6a9b69bbfc2144b59bb56ef57267c3a31c575afc1dcb4cad6aaccd4f71db8e7e40c08910710ea0',
  //   cryptoInfo:
  //    { algorithm: 'aes-256-cbc',
  //      block: 198573,
  //      originator:
  //       'profile:0xb1c492ee6085679497c73008100c3b3136a75a8519c2a0016fec686a05f1c7f0' } }



--------------------------------------------------------------------------------

.. _encryption-wrapper_decrypt:

decrypt
================================================================================

.. code-block:: typescript

  encryptionHandler.decrypt(toDecrypt[, artifacts]);

Decrypt given ``Envelope``.

----------
Parameters
----------

#. ``toDecrypt`` - ``any``: encrypted envelop
#. ``artifacts`` - ``any``: (optional) additional information for decrypting

artifacts
---------
Depending on ``cryptoInfo.originator`` different properties are required. ``artifacts`` can be omitted, if used ``cryptoInfo.originator`` schema is not listed below. Note, that ``cryptoInfo.originator`` schema depends on with which ``EncryptionWrapperKeyType`` :ref:`getCryptoInfo <encryption-wrapper_getCryptoInfo>` was called.

* ``sharing:.*``:

    * ``accountId`` - ``string``: accountId, that accesses data, is used to get shared keys with
    * ``propertyName`` - ``string`` (optional): property, that is decrypted, defaults to ``'*'``

* ``custom:.*``:
    * ``key`` - ``string``: accountId, that accesses data, is used to get shared keys with

-------
Returns
-------

``Promise`` returns ``Envelope``: envelope with encrypted data

-------
Example
-------

.. code-block:: typescript

  const sampleData = {
    foo: TestUtils.getRandomBytes32(),
    bar: Math.random(),
  };
  const keyContext = 'my key 15';
  const cryptoInfo = await encryptionWrapper.getCryptoInfo(
    keyContext,
    EncryptionWrapperKeyType.Profile,
    EncryptionWrapperCryptorType.Content,
  );
  const encrypted = await encryptionWrapper.encrypt(sampleData, cryptoInfo);
  const decrypted = await encryptionWrapper.decrypt(encrypted);
  console.dir(decrypt);
  // Output:
  // { foo:
  //  '0x746dccef8a185d9e34a2778af51e8ee7e513e4035f7a5e2c2d122904a21f32e6',
  // bar: 0.618861426409717 }



--------------------------------------------------------------------------------

Additional Components
=====================

Enums
=====

.. _encryption-wrapper_EncryptionWrapperCryptorType:

--------------------
DigitalTwinEntryType
--------------------

* ``Content``: content encryption is used for generic data (strings, in memory objects)
* ``File``: file encryption is used for binary file data
* ``Unencrypted``: unencrypted data encryption can be used to embed unencrypted data in encryption containers



.. _encryption-wrapper_EncryptionWrapperKeyType:

------------------------
EncryptionWrapperKeyType
------------------------

* ``Custom``: custom key handling means that the key is handled elsewhere and has to be given to profile
* ``Profile``: key is stored in profile, usually in property "encryptionKeys"
* ``Sharing``: key is stored in Shared or MultiShared contract



.. required for building markup

.. |source cryptoInfo| replace:: ``CryptoInfo``
.. _source cryptoInfo: ../encryption/crypto-provider.html#cryptoinfo

.. |source cryptoProvider| replace:: ``CryptoProvider``
.. _source cryptoProvider: ../encryption/crypto-provider.html

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: ../common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: ../common/logger.html#logloginterface

.. |source nameResolver| replace:: ``NameResolver``
.. _source nameResolver: ../blockchain/name-resolver.html

.. |source profile| replace:: ``Profile``
.. _source profile: ../profile/profile.html

.. |source sharing| replace:: ``Sharing``
.. _source sharing: ../contracts/sharing.html

.. |source web3| replace:: ``Web3``
.. _source web3: https://github.com/ethereum/web3.js/
