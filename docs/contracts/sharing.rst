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

.. code-block:: typescript

  {
    "0x01": {
      "82745": {
        "*": {
          "private": "secret for 0x01, starting from block 82745 for all data",
          "cryptoInfo": {
            "originator": "0x01,0x01",
            "keyLength": 256,
            "algorithm": "aes-256-cbc"
          }
        }
      },
      "90000": {
        "secret area": {
          "private": "secret for 0x01, starting from block 90000 for 'secret area'",
          "cryptoInfo": {
            "originator": "0x01,0x01",
            "keyLength": 256,
            "algorithm": "aes-256-cbc"
          }
        },
        "super secret area": {
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
      "82745": {
        "*": {
          "private": "secret for 0x02, starting from block 82745 for all data",
          "cryptoInfo": {
            "originator": "0x01,0x02",
            "keyLength": 256,
            "algorithm": "aes-256-cbc"
          }
        }
      },
      "90000": {
        "secret area": {
          "private": "secret for 0x02, starting from block 90000 for 'secret area'",
          "cryptoInfo": {
            "originator": "0x01,0x02",
            "keyLength": 256,
            "algorithm": "aes-256-cbc"
          }
        },
        "super secret area": {
          "private": "secret for 0x02, starting from block 90000 for 'super secret area'",
          "cryptoInfo": {
            "originator": "0x01,0x02",
            "keyLength": 256,
            "algorithm": "aes-256-cbc"
          }
        }
      },
    },
    "0x03": {
      "90000": {
        "secret area": {
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

More information about sharings can be fout at the `evan.network wiki <https://evannetwork.github.io/docs/developers/concepts/sharings.html>`_.


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

----------
Parameters
----------

#. ``address`` - ``string``: contract address or ENS address
#. ``originator`` - ``string``: Ethereum account id of the sharing user
#. ``partner`` - ``string``: Ethereum account id for which key shall be added
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

Extend an existing sharing info with given key; this is done on a sharings object and does not perform a transaction on its own.

----------
Parameters
----------

#. ``sharings`` - ``any``: object with sharings info
#. ``originator`` - ``string``: Ethereum account id of the sharing user
#. ``partner`` - ``string``: Ethereum account id for which key shall be added
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

  const sharings =  {};
  await this.options.sharing.extendSharings(sharings, accountId, accountId, '*', blockNr, contentKey);
  await this.options.sharing.extendSharings(sharings, accountId, accountId, '*', 'hashKey', hashKey);



--------------------------------------------------------------------------------

.. _sharing_bumpSharings:

bumpSharings
================================================================================

.. code-block:: typescript

  sharing.bumpSharings(address, originator, partners, section, block, sharingKey);

Bump keys for given accounts by adding given key to their sharings. This is basically a shorthand
version for adding the new key for every account in the ``partners`` array in a single transaction.

``context``, ``hashKeys`` and ``sharingId`` are currently not supported.

----------
Parameters
----------

#. ``address`` - ``string``: contract address or ENS address
#. ``originator`` - ``string``: Ethereum account id of the sharing user
#. ``partner`` - ``string``: Ethereum account id for which key shall be added
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
#. ``partner`` - ``string``: Ethereum account id for which key shall be retrieved
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

Get history of keys for an account and a section.

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

Give hash key "hashKey" to account "partner", if this account does not have a hash key already.

----------
Parameters
----------

#. ``address`` - ``string``: contract address or ENS address
#. ``originator`` - ``string``: Ethereum account id of the sharing user
#. ``partner`` - ``string``: Ethereum account id for which key shall be added
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
#. ``partner`` - ``string``: Ethereum account id for which key shall be retrieved
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

----------
Parameters
----------

#. ``address`` - ``string``: contract address or ENS address
#. ``_partner`` - ``string`` (optional): Ethereum account id for which key shall be retrieved
#. ``_section`` - ``string`` (optional): data section the key is intended for or '*'
#. ``_block`` - ``number`` (optional): starting with this block, the key is valid
#. ``sharingId`` - ``string`` (optional): id of a sharing (when multi-sharings is used)

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const randomSecret = `super secret; ${Math.random()}`;
  await sharing.addSharing(testAddress, accounts[1], accounts[0], '*', 0, randomSecret);
  const sharings = await sharing.getSharings(testAddress);



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
#. ``originator`` - ``string``: Ethereum account id of the sharing user
#. ``partner`` - ``string``: Ethereum account id for which key shall be removed
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

This can be used in combination with :ref:`getSharingsFromContract<sharing_saveSharingsToContract>` to bulk editing sharing info.

----------
Parameters
----------

#. ``contact`` - ``any``: contract with sharing info
#. ``sharingId`` - ``string`` (optional): id of a sharing in mutlisharings, defaults to ``null``

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
#. ``originator`` - ``string``: Ethereum account id of the sharing user
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
.. _source keyProvider: ../key-provider

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: ../common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: ../common/logger.html#logloginterface

.. |source nameResolver| replace:: ``NameResolver``
.. _source nameResolver: ../blockchain/name-resolver.html