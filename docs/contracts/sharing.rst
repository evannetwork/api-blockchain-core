================================================================================
Sharing
================================================================================

.. list-table::
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - Sharing
   * - Extends
     - `Logger <../common/logger.html>`_
   * - Source
     - `sharing.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/contracts/sharing.ts>`_
   * - Examples
     - `sharing.spec.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/contracts/sharing.spec.ts>`_

.. _Sharing_example:


For getting a better understanding about how Sharings and Multikeys work, have a look at `Security <https://evannetwork.github.io/docs/developers/concepts/sharings.html>`_ in the evan.network wiki.

Following is a sample for a sharing info with these properties:

- three users

  * ``0x01`` - owner of a contract
  * ``0x02`` - member of a contract
  * ``0x03`` - another member with differing permissions

- two timestamps

  * block 82745 - first sharing
  * block 90000 - splitting data, update sharings

- three sections

  * ``*`` generic "catch all" used in first sharing
  * ``secret area`` - available for all members
  * ``super secret area`` - available for ``0x03``

Keep in mind, that an actual sharings object only stores the sha3-hashes of every property. For example, sharings for the user `0x01` were actually to be found
at the property `"0x5fe7f977e71dba2ea1a68e21057beebb9be2ac30c6410aa38d4f3fbe41dcffd2"`.
For the sake of understanding, the following sample uses clear text properties. For an example of an actual sharings object, please refer to the :ref:`getSharings <sharing_getSharings>`
example section.

.. code-block:: typescript

  {
    "0x01": {
      "*": {
        "82745": {
          "private": "secret for 0x01, starting from block 82745 for all data",
          "cryptoInfo": {
            "originator": "0x01,0x01",
            "keyLength": 256,
            "algorithm": "aes-256-cbc"
          }
        }
      },
      "secret area": {
        "90000": {
          "private": "secret for 0x01, starting from block 90000 for 'secret area'",
          "cryptoInfo": {
            "originator": "0x01,0x01",
            "keyLength": 256,
            "algorithm": "aes-256-cbc"
          }
        }
      },
      "super secret area": {
        "90000": {
          "private": "secret for 0x01, starting from block 90000 for 'super secret area'",
          "cryptoInfo": {
            "originator": "0x01,0x01",
            "keyLength": 256,
            "algorithm": "aes-256-cbc"
          }
        }
      }
    },
    "0x02": {
      "*": {
        "82745": {
          "private": "secret for 0x02, starting from block 82745 for all data",
          "cryptoInfo": {
            "originator": "0x01,0x02",
            "keyLength": 256,
            "algorithm": "aes-256-cbc"
          }
        }
      },
      "secret area": {
        "90000": {
          "private": "secret for 0x02, starting from block 90000 for 'secret area'",
          "cryptoInfo": {
            "originator": "0x01,0x02",
            "keyLength": 256,
            "algorithm": "aes-256-cbc"
          }
        }
      },
      "super secret area": {
        "90000": {
          "private": "secret for 0x02, starting from block 90000 for 'super secret area'",
          "cryptoInfo": {
            "originator": "0x01,0x02",
            "keyLength": 256,
            "algorithm": "aes-256-cbc"
          }
        }
      }
    },
    "0x03": {
      "secret area": {
        "90000": {
          "private": "secret for 0x03, starting from block 90000 for 'secret area'",
          "cryptoInfo": {
            "originator": "0x01,0x03",
            "keyLength": 256,
            "algorithm": "aes-256-cbc"
          }
        }
      }
    }
  }

More information about sharings can be found at the `evan.network wiki <https://evannetwork.github.io/docs/developers/concepts/sharings.html>`_.

There are two functions to share keys with another user:

- :ref:`addSharing <sharing_addSharing>` is used for easily sharing keys to another user. There is no need to explicitly share hash keys to this other user as this is automatically covered here. This approach make up to two transaction (1 for hash key and 1 for the content key), which may sum up to a whole bunch of transactions when sharing multiple keys to multiple users.

- :ref:`extendSharing <sharing_extendSharing>` is used to edit a sharings configuration that has been pulled or "checked out" with :ref:`getSharingsFromContract <sharing_getSharingsFromContract>`. Hash keys have to be shared manually, if required. :ref:`extendSharing <sharing_extendSharing>` make no transaction, so the contract isn't updated - this has to be done with :ref:`saveSharingsToContract <sharing_saveSharingsToContract>`. See function documentation :ref:`below <sharing_extendSharing>` for an example with hash key and storing updates.

Be careful when performing multiple updates to sharings synchronously. As sharings are retrieved as a single file from a smart contract, updated and then saved back to it, doing two or more updates in parallel may overwrite each other and lead to unexpected and most probably undesired results.

Perform sharing updates for the same contracts **one after another**, this goes for :ref:`addSharing <sharing_addSharing>` **and** for :ref:`extendSharing <sharing_extendSharing>`. When wishing to speed things up, :ref:`extendSharing <sharing_extendSharing>` can be used, but its updates need to be performed synchronously as well. Keep in mind, that single updates will be made off-chain and therefore be performed much faster than multiple updates with :ref:`addSharing <sharing_addSharing>`.



--------------------------------------------------------------------------------

.. _sharing_constructor:

constructor
================================================================================

.. code-block:: typescript

  new Sharing(options);

Creates a new Sharing instance.

----------
Parameters
----------

#. ``options`` - ``SharingOptions``: options for Sharing constructor.
    * ``contractLoader`` - |source contractLoader|_: |source contractLoader|_ instance
    * ``cryptoProvider`` - |source cryptoProvider|_: |source cryptoProvider|_ instance
    * ``description`` - |source description|_: |source description|_ instance
    * ``dfs`` - |source dfsInterface|_: |source dfsInterface|_ instance
    * ``executor`` - |source executor|_: |source executor|_ instance
    * ``keyProvider`` - |source keyProvider|_: |source keyProvider|_ instance
    * ``nameResolver`` - |source nameResolver|_: |source nameResolver|_ instance
    * ``defaultCryptoAlgo`` - ``string`` (optional): crypto algorith name from |source cryptoProvider|, defaults to ``aes``
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``

-------
Returns
-------

``Sharing`` instance

-------
Example
-------

.. code-block:: typescript

  const sharing = new Sharing({
    contractLoader,
    cryptoProvider,
    description,
    executor,
    dfs,
    keyProvider,
    nameResolver,
    defaultCryptoAlgo: 'aes',
  });



--------------------------------------------------------------------------------

.. _sharing_addSharing:

addSharing
================================================================================

.. code-block:: typescript

  sharing.addSharing(address, originator, partner, section, block, sharingKey[, context, isHashKey, sharingId]);

Add a sharing to a contract or an ENS address.

This function is primarily used for sharing single keys with one other users, when sharing multiple keys and/or sharing with multiple users, have a look at :ref:`extendSharing
<sharing_extendSharing>`.

----------
Parameters
----------

#. ``address`` - ``string``: contract address or ENS address
#. ``originator`` - ``string``: Ethereum account id of the sharing user
#. ``partner`` - ``string``: Ethereum account ID or identity for which key shall be added
#. ``section`` - ``string``: data section the key is intended for or '*'
#. ``block`` - ``number|string``: starting with this block, the key is valid
#. ``sharingKey`` - ``string``: key to share
#. ``context`` - ``string`` (optional): context to share key in
#. ``isHashKey`` - ``bool`` (optional): indicates if given key already is a hash key, defaults to ``false``
#. ``sharingId`` - ``string`` (optional): id of a sharing (when multi-sharings is used)

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  // two sample users, user1 wants to share a key with user2
  const user1 = '0x0000000000000000000000000000000000000001';
  const user2 = '0x0000000000000000000000000000000000000002';
  // create a sample contract
  // usually you would have an existing contract, for which you want to manage the sharings
  const contract = await executor.createContract('Shared', [], { from: user1, gas: 500000, });
  // user1 shares the given key with user2
  // this key is shared for all contexts ('*') and valid starting with block 0
  await sharing.addSharing(contract.options.address, user1, user2, '*', 0, 'i am the secred that will be shared');



--------------------------------------------------------------------------------

.. _sharing_extendSharing:

extendSharing
================================================================================

.. code-block:: typescript

  sharing.extendSharing(address, originator, partner, section, block, sharingKey[, context, isHashKey]);

Extend an existing sharing info with given key.

This is done on a sharings object and does not
perform a transaction on its own. This function extends a sharing object retrieved from
:ref:`getSharingsFromContract <sharing_getSharingsFromContract>` and does not update sharings at the
smart contract. For updating smart contracts sharing use :ref:`saveSharingsToContract
<sharing_saveSharingsToContract>`.

This function is primarily used to prepare updates for multiple keys and/or multiple users and
submitting the result in one single transaction. For simpler sharing scenarios have a look at
:ref:`addSharing <sharing_addSharing>`.

----------
Parameters
----------

#. ``sharings`` - ``any``: object with sharings info
#. ``originator`` - ``string``: Ethereum account ID or identity of the sharing user
#. ``partner`` - ``string``: Ethereum account ID or identity for which key shall be added
#. ``section`` - ``string``: data section the key is intended for or '*'
#. ``block`` - ``number|string``: starting with this block, the key is valid
#. ``sharingKey`` - ``string``: key to share
#. ``context`` - ``string`` (optional): context to share key in

-------
Returns
-------

``Promise`` returns ``any``: updated sharings info

-------
Example
-------

.. code-block:: typescript

  // two sample users, user1 wants to share a key with user2
  const user1 = '0x0000000000000000000000000000000000000001';
  const user2 = '0x0000000000000000000000000000000000000002';

  // get current sharings
  const sharings = await sharing.getSharingsFromContract(contract);

  // if receiver of sharing hasn't been added to the contract yet, share hash key as well
  const hashKeyToShare = await sharing.getHashKey(contract.options.address, user1);
  await sharing.extendSharings(sharings, user1, user2, '*', 'hashKey', hashKeyToShare, null);

  // get current block number, keys will be available starting from this block
  const blockNr = await web3.eth.getBlockNumber();

  // get current key for field or in this case fallback '*'
  const contentKey = sharing.getKey(contract.options.address, user1, '*', blockNr);

  // share this key
  await sharing.extendSharings(sharings, user1, user2, '*', blockNr, contentKey);

  // finally store to contract
  await sharing.saveSharingsToContract(contract.options.address, sharings, user1);



--------------------------------------------------------------------------------

.. _sharing_trimSharings:

trimSharings
================================================================================

.. code-block:: typescript

  sharing.trimSharings(sharings, partner[, partner, section, block);

Removes properties from given sharing. If a block is given, the specific blocks key is removed, if
no block is given, all keys for this section are removed. The same goes for section and partner.
Note that only the last properties can be omitted and not properties in between can be set to null.
So for example it is not possible to remove the same field for all accounts or identities by just setting partner
to null.

----------
Parameters
----------

#. ``sharings`` - ``any``: sharings to trim
#. ``partner`` - ``string``: Ethereum account ID or identity to remove keys for
#. ``section`` - ``string``: data section the key is intended for or '*'
#. ``block`` - ``number|string``: block to remove keys for

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  // this sample will undo undo the changes from the last example (extendSharings)
  // two sample users, user1 wants to share a key with user2
  const user1 = '0x0000000000000000000000000000000000000001';
  const user2 = '0x0000000000000000000000000000000000000002';

  // get current sharings
  const sharings = await sharing.getSharingsFromContract(contract);

  // remove key from last time
  await sharing.trim(sharings, user2, '*', blockNr);

  // finally store to contract
  await sharing.saveSharingsToContract(contract.options.address, sharings, user1);



--------------------------------------------------------------------------------

.. _sharing_bumpSharings:

bumpSharings
================================================================================

.. code-block:: typescript

  sharing.bumpSharings(address, originator, partners, section, block, sharingKey);

Bump keys for given accounts or identities by adding given key to their sharings. This is basically a shorthand
version for adding the new key for every account or identity in the ``partners`` array in a single transaction.

``context``, ``hashKeys`` and ``sharingId`` are currently not supported.

----------
Parameters
----------

#. ``address`` - ``string``: contract address or ENS address
#. ``originator`` - ``string``: Ethereum account ID or identity of the sharing user
#. ``partner`` - ``string``: Ethereum account ID or identity for which key shall be added
#. ``section`` - ``string``: data section the key is intended for or '*'
#. ``block`` - ``number|string``: starting with this block, the key is valid
#. ``sharingKey`` - ``string``: key to share

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  // two sample users, user1 wants to bump keys for user2 and user3
  const user1 = '0x0000000000000000000000000000000000000001';
  const user2 = '0x0000000000000000000000000000000000000002';
  const user3 = '0x0000000000000000000000000000000000000003';
  // assume we have a contract with sharings for those accounts
  const contractId = '0x00000000000000000000000000000000c027rac7';
  await sharing.bumpSharings(contractId, user1, [ user2, user3 ], '*', 0, 'i am a bump key');



--------------------------------------------------------------------------------

.. _sharing_getKey:

getKey
================================================================================

.. code-block:: typescript

  sharing.getKey(address, partner, section[, block, sharingId]);

Get a content key from the sharing of a contract.

----------
Parameters
----------

#. ``address`` - ``string``: contract address or ENS address
#. ``partner`` - ``string``: Ethereum account ID or identityfor which key shall be retrieved
#. ``section`` - ``string``: data section the key is intended for or '*'
#. ``block`` - ``number|string`` (optional): starting with this block, the key is valid, defaults to ``Number.MAX_SAFE_INTEGER``
#. ``sharingId`` - ``string`` (optional): id of a sharing (when multi-sharings is used), defaults to ``null``

-------
Returns
-------

``Promise`` returns ``string``: matching key

-------
Example
-------

.. code-block:: typescript

  // a sample user
  const user2 = '0x0000000000000000000000000000000000000002';
  // user2 wants to read a key after receiving a sharing
  // the key requested should be valid for all contexts ('*') and valid up to and including block 100
  const key = await sharing.getKey(contract.options.address, user2, '*', 100);



--------------------------------------------------------------------------------

.. _sharing_getKeyHistory:

getKeyHistory
================================================================================

.. code-block:: typescript

  sharing.getKeyHistory(address, partner, section[, sharingId]);

Get history of keys for an account or identity and a section.

----------
Parameters
----------

#. ``address`` - ``string``: contract address or ENS address
#. ``partner`` - ``string``: Ethereum account id for which key shall be retrieved
#. ``section`` - ``string``: data section the key is intended for or '*'
#. ``sharingId`` - ``string`` (optional): id of a sharing (when multi-sharings is used), defaults to ``null``

-------
Returns
-------

``Promise`` returns ``any``: object with key: blockNr, value: key

-------
Example
-------

.. code-block:: typescript

  // a sample user
  const user2 = '0x0000000000000000000000000000000000000002';
  // user2 wants to retrieve all keys for '*'
  const keyHistory = await sharing.getKeyHistory(contract.options.address, user2, '*');



--------------------------------------------------------------------------------

.. _sharing_ensureHashKey:

ensureHashKey
================================================================================

.. code-block:: typescript

  sharing.ensureHashKey(address, originator, partner, hashKey[, context, sharingId]);

Give hash key "hashKey" to account or identity "partner", if this account or identity does not have a hash key already.

----------
Parameters
----------

#. ``address`` - ``string``: contract address or ENS address
#. ``originator`` - ``string``: Ethereum account ID or identity of the sharing user
#. ``partner`` - ``string``: Ethereum account ID or identity for which key shall be added
#. ``hashKey`` - ``string``: key for DFS hashes
#. ``context`` - ``string`` (optional): context to share key in
#. ``sharingId`` - ``string`` (optional): id of a sharing (when multi-sharings is used)

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const hashCryptor = cryptoProvider.getCryptorByCryptoAlgo('aesEcb');
  const hashKey = await hashCryptor.generateKey();
  await sharing.ensureHashKey(contract.options.address, accounts[0], accounts[1], hashKey);



--------------------------------------------------------------------------------

.. _sharing_getHashKey:

getHashKey
================================================================================

.. code-block:: typescript

  sharing.getHashKey(address, partner[, sharingid]);

Function description

----------
Parameters
----------

#. ``address`` - ``string``: contract address or ENS address
#. ``partner`` - ``string``: Ethereum account ID or identity for which key shall be retrieved
#. ``sharingId`` - ``string`` (optional): id of a sharing (when multi-sharings is used)

-------
Returns
-------

``Promise`` returns ``string``: matching key

-------
Example
-------

.. code-block:: typescript

    const hashCryptor = cryptoProvider.getCryptorByCryptoAlgo('aesEcb');
    const hashKey = await hashCryptor.generateKey();
    await sharing.ensureHashKey(contract.options.address, accounts[0], accounts[1], hashKey);
    const retrieved = sharing.getHashKey(contract.options.address, accounts[1]);
    console.log(hashKey === retrieved);
    // Output:
    // true



--------------------------------------------------------------------------------

.. _sharing_getSharings:

getSharings
================================================================================

.. code-block:: typescript

  sharing.getSharings(address[, _partner, _section, _block, sharingId]);

Get sharing from a contract, if _partner, _section, _block matches.

Sharings can also be retrieved using ENS address.

----------
Parameters
----------

#. ``address`` - ``string``: contract address or ENS address
#. ``_partner`` - ``string`` (optional): Ethereum account ID or identity for which key shall be retrieved
#. ``_section`` - ``string`` (optional): data section the key is intended for or '*'
#. ``_block`` - ``number`` (optional): starting with this block, the key is valid
#. ``sharingId`` - ``string`` (optional): id of a sharing (when multi-sharings is used)

-------
Returns
-------

``Promise`` returns ``any``: sharings as an object. For more details, refer to the :ref:`example at the top of the page <Sharing_example>`.

-------
Example
-------

.. code-block:: typescript

  const randomSecret = `super secret; ${Math.random()}`;
  await sharing.addSharing(testAddress, accounts[1], accounts[0], '*', 0, randomSecret);
  await sharing.addSharing(testAddress, accounts[1], accounts[0], 'test', 100, randomSecret);
  const sharings = await sharing.getSharings(contract.options.address, null, null, null, sharingId);
  /* Output:
  {
  '0x2260228fd705cd9420a07827b8e64e808daba1b6675c3956783cc09fcc56a327': { // sha3(contract owner)
    '0x04994f67dc55b09e814ab7ffc8df3686b4afb2bb53e60eae97ef043fe03fb829': { hashKey: [Object] },
    '0x9c22ff5f21f0b81b113e63f7db6da94fedef11b2119b4088b89664fb9a3cb658': { '0': [Object] }, // sha3('test')
    '0x02016836a56b71f0d02689e69e326f4f4c1b9057164ef592671cf0d37c8040c0': { '0': [Object] } // additional unshared field
  },
  '0xb45ce1cd2e464ce53a8102a5f855c112a2a384c36923fe5c6e249c2a9286369e': { // sha3(accounts[1])
    '0x04994f67dc55b09e814ab7ffc8df3686b4afb2bb53e60eae97ef043fe03fb829': { hashKey: [Object] }, // '*'
    '0x9c22ff5f21f0b81b113e63f7db6da94fedef11b2119b4088b89664fb9a3cb658': { // sha3('test')
        '100': [Object] // Valid from block 100
    }
  }
  */



--------------------------------------------------------------------------------

.. _sharing_removeSharing:

removeSharing
================================================================================

.. code-block:: typescript

  sharing.removeSharing(address, originator, partner, section[, sharingId]);

Remove a sharing key from a contract with sharing info.

----------
Parameters
----------

#. ``address`` - ``string``: contract address or ENS address
#. ``originator`` - ``string``: Ethereum account ID or identity of the sharing user
#. ``partner`` - ``string``: Ethereum account ID or identity for which key shall be removed
#. ``section`` - ``string``: data section of the key
#. ``sharingId`` - ``string`` (optional): id of a sharing (when multi-sharings is used), defaults to ``null``

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await sharing.addSharing(contract.options.address, accounts[0], accounts[1], '*', 0, randomSecret);

  let sharings = await sharing.getSharings(contract.options.address);
  console.log(Object.keys(sharings[nameResolver.soliditySha3(accounts[1])]).length);
  // Output:
  // 1

  await sharing.removeSharing(contract.options.address, accounts[0], accounts[1], '*');

  let sharings = await sharing.getSharings(contract.options.address);
  console.log(Object.keys(sharings[nameResolver.soliditySha3(accounts[1])]).length);
  // Output:
  // 0



--------------------------------------------------------------------------------

.. _sharing_getSharingsFromContract:

getSharingsFromContract
================================================================================

.. code-block:: typescript

  sharing.getSharingsFromContract(contract[, sharingId]);

Get encrypted sharings from smart contract.

The encrypted sharings are usually used in combination with other functions for purposes of adding, removing, extending sharings etc.
For Example:
This can be used in combination with :ref:`saveSharingsToContract<sharing_saveSharingsToContract>` to bulk editing sharing info.

----------
Parameters
----------

#. ``contact`` - ``any``: contract with sharing info
#. ``sharingId`` - ``string`` (optional): id of a sharing in mutlisharings, defaults to ``null``

-------
Returns
-------

``Promise`` returns ``any``: sharings as an object

-------
Example
-------

.. code-block:: typescript

  // get sharings (encrypted)
  const sharings = await sharing.getSharingsFromContract(serviceContract, callIdHash);
  // Output:
  { '0x6760305476495b089868ae42c2293d5e8c1c7bf9bfe51a9ad85b36d85f4113cb':
   { '0x04994f67dc55b09e814ab7ffc8df3686b4afb2bb53e60eae97ef043fe03fb829': { hashKey: [Object] } }

  // make changes to sharing
  await sharing.extendSharings(sharings, accountId, target, section, 0, contentKeyToShare, null);
  await sharing.extendSharings(sharings, accountId, target, '*', 'hashKey', hashKeyToShare, null);

  // commit changes
  await sharing.saveSharingsToContract(serviceContract.options.address, sharings, accountId, callIdHash);



--------------------------------------------------------------------------------

.. _sharing_saveSharingsToContract:

saveSharingsToContract
================================================================================

.. code-block:: typescript

  sharing.saveSharingsToContract(contract, sharings, originator[, sharingId]);

Save sharings object with encrypted keys to contract.

This can be used to pull sharings, edit them offline and commit changes in a bulk. See example section for usage.

----------
Parameters
----------

#. ``contract`` - ``string|any``: contract address or instance
#. ``sharings`` - ``any``: sharings object with encrypted keys
#. ``originator`` - ``string``: Ethereum account ID or identity of the sharing user
#. ``sharingId`` - ``string`` (optional): id of a sharing (when multi-sharings is used)

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  // get sharings (encrypted)
  const sharings = await sharing.getSharingsFromContract(serviceContract, callIdHash);

  // make changes to sharing
  await sharing.extendSharings(sharings, accountId, target, section, 0, contentKeyToShare, null);
  await sharing.extendSharings(sharings, accountId, target, '*', 'hashKey', hashKeyToShare, null);

  // commit changes
  await sharing.saveSharingsToContract(serviceContract.options.address, sharings, accountId, callIdHash);



--------------------------------------------------------------------------------

.. _sharing_addHashToCache:

addHashToCache
================================================================================

.. code-block:: typescript

  sharing.addHashToCache(address, sharingHash[, sharingId]);

Add a hash to to cache, can be used to speed up sharing key retrieval, when sharings hash is already known.

----------
Parameters
----------

#. ``address`` - ``string``: contract address
#. ``sharingHash`` - ``string``: bytes32 hash of a sharing
#. ``sharingId`` - ``string`` (optional): id of a multisharing, defaults to ``null``

-------
Example
-------

.. code-block:: typescript

  sharing.addHashToCache(contract.options.address, sharingHash, sharingId);



--------------------------------------------------------------------------------

.. _sharing_clearCache:

clearCache
================================================================================

.. code-block:: typescript

  sharing.clearCache();

Clear caches and fetch new hashes and sharing on next request.

When sharings are fetched and not all results could be read, the result would stay the same in
following requests due to the internal caching mechanism, even if a proper key has been shared with
the user later on. To prevent such old values from showing up, the cache can be cleared.

-------
Example
-------

.. code-block:: typescript

  sharing.clearCache();


.. required for building markup

.. |source contractLoader| replace:: ``ContractLoader``
.. _source contractLoader: ../contracts/contract-loader.html

.. |source cryptoProvider| replace:: ``CryptoProvider``
.. _source cryptoProvider: ../encryption/crypto-provider.html

.. |source description| replace:: ``Description``
.. _source description: ../blockchain/description.html

.. |source dfsInterface| replace:: ``DfsInterface``
.. _source dfsInterface: ../dfs/dfs-interface.html

.. |source executor| replace:: ``Executor``
.. _source executor: ../blockchain/executor.html

.. |source keyProvider| replace:: ``KeyProvider``
.. _source keyProvider: ../encryption/key-provider.html

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: ../common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: ../common/logger.html#logloginterface

.. |source nameResolver| replace:: ``NameResolver``
.. _source nameResolver: ../blockchain/name-resolver.html
