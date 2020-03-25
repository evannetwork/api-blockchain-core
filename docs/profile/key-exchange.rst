================================================================================
Key Exchange
================================================================================

.. list-table::
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - KeyExchange
   * - Extends
     - `Logger <../common/logger.html>`_
   * - Source
     - `keyExchange.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/keyExchange.ts>`_
   * - Examples
     - `keyExchange.spec.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/keyExchange.spec.ts>`_

The ``KeyExchange`` module is used to exchange communication keys between two parties, assuming that both have created a profile and have a public facing partial Diffie Hellman key part (the combination of their own secret and the shared secret). The key exchange consists of three steps:

#. create a new communication key, that will be used by both parties for en- and decryption and store it on the initiators side
#. look up the other parties partial Diffie Hellman key part and combine it with the own private key to create the exchange key
#. use the exchange key to encrypt the communication key and send it via bmail (blockchain mail) to other party



--------------------------------------------------------------------------------

Basic Usage
================================================================================

---------------------------------
Starting the Key Exchange Process
---------------------------------

This example retrieves public facing partial Diffie Hellman key part from a second party and sends an invitation mail to it:

.. code-block:: typescript

  // identity, that initiates the invitation
  const identity1 = '0x0000000000000000000000000000000000000001';
  // identity, that will receive the invitation
  const identity2 = '0x0000000000000000000000000000000000000002';
  // profile from user, that initiates key exchange
  const profile1 = {};
  await profile1.loadForAccount();
  // profile from user, that is going to receive the invitation
  const profile2 = {};
  await profile2.loadForAccount();
  // key exchange instance for identity1
  const keyExchange1 = {};
  // key exchange instance for identity2
  const keyExchange2 = {};

  const foreignPubkey = await profile2.getPublicKey();
  const commKey = await keyExchange1.generateCommKey();
  await keyExchange1.sendInvite(identity2, foreignPubkey, commKey, {
    fromAlias: 'Bob',           // initiating user states, that his name is 'Bob'
  });
  await profile1.addContactKey(identity2, 'commKey', commKey);
  await profile1.storeForAccount(profile1.treeLabels.addressBook);

----------------------------------
Finishing the Key Exchange Process
----------------------------------

Let's assume that the communication key from the last example has been successfully sent to the other party and continue at there end from here. To keep the roles from the last example, the variables profile1, profile2 will belong to the same identites:

.. code-block:: typescript

  const encryptedCommKey = '...';       // key sent by identity1
  const profile1 = await profile1.getPublicKey();
  const commSecret = keyExchange2.computeSecretKey(profile1);
  const commKey = await keyExchange2.decryptCommKey(encryptedCommKey, commSecret.toString('hex'));



--------------------------------------------------------------------------------

.. _keyExchange_constructor:

constructor
================================================================================

.. code-block:: typescript

  new KeyExchange(options);

Creates a new KeyExchange instance.

----------
Parameters
----------

#. ``options`` - ``KeyExchangeOptions``: options for KeyExchange constructor.
    * ``account`` - ``string``: address of identity or account, that will perform actions
    * ``cryptoProvider`` - |source cryptoProvider|_: |source cryptoProvider|_ instance
    * ``defaultCryptoAlgo`` - ``string``: default encryption algorithm
    * ``keyProvider`` - |source keyProviderInterface|_: |source keyProviderInterface|_ instance
    * ``mailbox`` - |source mailbox|_: |source mailbox|_ instance
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``
    * ``privateKey`` - ``object`` (optional): private key for key exchange, if ``privateKey`` or ``publicKey`` is omitted, new keys are generated
    * ``publicKey`` - ``object`` (optional): public key for key exchange, if ``privateKey`` or ``publicKey`` is omitted, new keys are generated

-------
Returns
-------

``KeyExchange`` instance

-------
Example
-------

.. code-block:: typescript

  const keyExchange = new KeyExchange({
    mailbox,
    cryptoProvider,
    defaultCryptoAlgo: 'aes',
    account: identities[0],
    keyProvider,
  });



--------------------------------------------------------------------------------

.. _keyExchange_computeSecretKey:

computeSecretKey
================================================================================

.. code-block:: typescript

  keyExchange.computeSecretKey(partialKey);

Combines given partial key from another profile with own private key.

----------
Parameters
----------

#. ``partialKey`` - ``string``: The options used for calling

-------
Returns
-------

``string`` combined exchange key

-------
Example
-------

.. code-block:: typescript

  // encrypted communication key sent from identity 1 to identity 2
  const encryptedKey = '...'
  // (profile 1 belongs to identity 1, keyExchange 2 to identity 2)
  const publicKeyProfile1 = await profile1.getPublicKey();
  const commSecret = keyExchange2.computeSecretKey(publicKeyProfile1);
  commKey = await keyExchange2.decryptCommKey(encryptedKey, commSecret.toString('hex'));



--------------------------------------------------------------------------------

.. _keyExchange_decryptCommKey:

decryptCommKey
================================================================================

.. code-block:: typescript

  keyExchange.decryptCommKey(encryptedCommKey, exchangeKey);

Decrypts a given communication key with an exchange key.

----------
Parameters
----------

#. ``encryptedCommKey`` - ``string``: encrypted communications key received from another identity (or account)
#. ``exchangeKey`` - ``string``: Diffie Hellman exchange key from computeSecretKey

-------
Returns
-------

``Promise`` returns ``Buffer``: commKey as a buffer

-------
Example
-------

.. code-block:: typescript

  // encrypted communication key sent from identity 1 to identity 2
  const encryptedKey = '...'
  // (profile 1 belongs to identity 1, keyExchange 2 to identity 2)
  const publicKeyProfile1 = await profile1.getPublicKey();
  const commSecret = keyExchange2.computeSecretKey(publicKeyProfile1);
  commKey = await keyExchange2.decryptCommKey(encryptedKey, commSecret.toString('hex'));



--------------------------------------------------------------------------------

.. _keyExchange_getDiffieHellmanKeys:

getDiffieHellmanKeys
================================================================================

.. code-block:: typescript

  keyExchange.getDiffieHellmanKeys();

Returns the public and private key from the diffieHellman.

----------
Parameters
----------

(void)

-------
Returns
-------

``Promise`` returns ``any``: object with public and private keys

-------
Example
-------

.. code-block:: typescript

  console.dir(await keyExchange.getDiffieHellmanKeys());
  // Output:
  // {
  //   private: '...',
  //   public: '...',
  // }



--------------------------------------------------------------------------------

.. _keyExchange_generateCommKey:

generateCommKey
================================================================================

.. code-block:: typescript

  keyExchange.generateCommKey();

Generates a new communication key end returns the hex string.

----------
Parameters
----------

(none)

-------
Returns
-------

``Promise`` returns ``string``: comm key as string

-------
Example
-------

.. code-block:: typescript

  console.dir(await keyExchange.generateCommKey());
  // Output:
  // '1c967697c192235680efbb24b980981b4778c8058b5e0864f1471fc1d941499d'



--------------------------------------------------------------------------------

.. _keyExchange_getExchangeMail:

getExchangeMail
================================================================================

.. code-block:: typescript

  keyExchange.getExchangeMail(from, mailContent[, encryptionCommKey]);

Creates a bmail for exchanging comm keys.

----------
Parameters
----------

#. ``from`` - ``string``: sender address
#. ``mailContent`` - ``any``: bmail metadata
#. ``encryptedCommKey`` - ``string`` (optional): comm key, that should be exchanged

-------
Returns
-------

``Promise`` returns ``Mail``: mail for key exchange

-------
Example
-------

.. code-block:: typescript

  const commKey = '1c967697c192235680efbb24b980981b4778c8058b5e0864f1471fc1d941499d';
  const mail = keyExchange.getExchangeMail(
    '0x0000000000000000000000000000000000000001',
    { fromAlias: 'user 1', fromMail: 'user1@example.com', title:'sample', body:'sample', }
  );
  console.log(mail);
  // Output:
  // { content:
  //    { from: '0x0000000000000000000000000000000000000001',
  //      fromAlias: 'user 1',
  //      fromMail: 'user1@example.com',
  //      title: 'sample',
  //      body: 'sample',
  //      attachments: [ [Object] ] } }



--------------------------------------------------------------------------------

.. _keyExchange_sendInvite:

sendInvite
================================================================================

.. code-block:: typescript

  keyExchange.sendInvite(receiver, receiverPublicKey, commKey, mailContent);

Sends a mailbox mail to the target with the partial key for the key exchange.

----------
Parameters
----------

#. ``string`` - ``receiver``: receiver of the invitation
#. ``string`` - ``receiverPublicKey``: public key of the receiver
#. ``string`` - ``commKey``: communication key between sender and receiver
#. ``any`` - ``mailContent``: mail to send

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const foreignPubkey = await profile2.getPublicKey();
  const commKey = await keyExchange1.generateCommKey();
  await keyExchange1.sendInvite(identities[1], foreignPubkey, commKey, { fromAlias: 'Bob', });
  await profile.addContactKey(identities[1], 'commKey', commKey);
  await profile.storeForAccount(profile.treeLabels.addressBook);



--------------------------------------------------------------------------------

.. _keyExchange_setPublicKey:

setPublicKey
================================================================================

.. code-block:: typescript

  keyExchange.setPublicKey(publicKey, privateKey);

Set the private and public key on the current diffieHellman object.

----------
Parameters
----------

#. ``publicKey`` - ``string``: public Diffie Hellman key
#. ``privateKey`` - ``string``: private Diffie Hellman key

-------
Returns
-------

(no return value)

-------
Example
-------

.. code-block:: typescript

  keyExchange.setPublicKey('...', '...');



.. required for building markup

.. |source cryptoProvider| replace:: ``CryptoProvider``
.. _source cryptoProvider: ../encryption/crypto-provider.html

.. |source keyProviderInterface| replace:: ``KeyProviderInterface``
.. _source keyProviderInterface: ../encryption/key-provider.html

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: ../common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: ../common/logger.html#logloginterface

.. |source mailbox| replace:: ``Mailbox``
.. _source mailbox: ../profile/mailbox.html
