================================================================================
Data Contract
================================================================================

.. list-table::
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - DataContract
   * - Extends
     - `BaseContract <../contracts/base-contract.html>`_
   * - Source
     - `data-contract.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/contracts/data-contract/data-contract.ts>`_
   * - Examples
     - `data-contract.spec.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/contracts/data-contract/data-contract.spec.ts>`_

The `DataContract <https://github.com/evannetwork/api-blockchain-core/tree/master/src/contracts/data-contract/data-contract.ts>`_ is a secured data storage contract for single properties and lists. If created on its own, DataContracts cannot do very much. They rely on their authority to check which entries or lists can be used.

The following functions support the ``encryptionContext`` argument:

- :ref:`addListEntries <data-contract_addListEntries>`
- :ref:`setEntry <data-contract_setEntry>`
- :ref:`setMappingValue <data-contract_setMappingValue>`

If this argument is set, the data key in the data contracts sharing is encrypted by using a context key instead of the communication key between owner and contract member. This allows to omit key exchanges between contract owner and members and therefore enables the owner to write content to the smart contract, that can be used by a group of accounts, which only needs to hold the context key. So the ``encryptionContext`` can be used to address a group of accounts instead of single accounts.

For more information about DataContracts purpose and their authorities see `Data Contract <https://evannetwork.github.io/docs/developers/concepts/data-contract.html>`_ in the evan.network wiki.



--------------------------------------------------------------------------------

.. _data-contract_constructor:

constructor
================================================================================

.. code-block:: typescript

  new DataContract(options);

Creates a new DataContract instance.

----------
Parameters
----------

#. ``options`` - ``DataContractOptions``: options for DataContract constructor.
    * ``cryptoProvider`` - |source cryptoProvider|_: |source cryptoProvider|_ instance
    * ``defaultCryptoAlgo`` - ``string`` (optional): crypto algorith name from |source cryptoProvider|, defaults to ``aes``
    * ``dfs`` - |source dfsInterface|_: |source dfsInterface|_ instance
    * ``executor`` - |source executor|_: |source executor|_ instance
    * ``loader`` - |source contractLoader|_: |source contractLoader|_ instance
    * ``nameResolver`` - |source nameResolver|_: |source nameResolver|_ instance
    * ``sharing`` - |source sharing|_: |source sharing|_ instance
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``

-------
Returns
-------

``DataContract`` instance

-------
Example
-------

.. code-block:: typescript

  const dataContract = new DataContract({
    cryptoProvider,
    description,
    dfs,
    executor,
    loader,
    nameResolver,
    sharing,
    web3,
  });



.. _data-contract_create:

create
===================

.. code-block:: javascript

    dataContract.create(factoryName, accountId[, businessCenterDomain, contractDescription, allowConsumerInvite, sharingsHash]);

Create and initialize new contract.

----------
Parameters
----------

#. ``factoryName`` - ``string``: contract factory name, used for ENS lookup; if the factory name contains periods, it is threaded as an absolute ENS domain and used as such, if not it will be used as ``${factoryName}.factory.${businessCenterDomain}``
#. ``accountId`` - ``string``:  owner of the new contract and transaction executor
#. ``businessCenterDomain`` - ``string`` (optional): ENS domain name of the business center
#. ``contractDescription`` - ``string|any`` (optional): bytes32 hash of DBCP description or a schema object
#. ``allowConsumerInvite`` - ``bool`` (optional): true if consumers are allowed to invite other consumer
#. ``sharingsHash`` - ``string`` (optional): existing sharing to add, defaults to ``null``

-------
Returns
-------

``Promise`` returns ``any``: contract instance

-------
Example
-------

Let's say, we want to create a DataContract for a business center at the domain "samplebc.evan" and this business center has a DataContractFactory named "testdatacontract". We want to have two users working in our DataContract, so we get these sample values:

.. code-block:: typescript

  const factoryName = 'testdatacontract';
  const businessCenterDomain = 'samplebc.evan';
  const accounts = [
    '0x0000000000000000000000000000000000000001',
    '0x0000000000000000000000000000000000000002',
  ];

Now create a contract with:

.. code-block:: typescript

  const contract = await dataContract.create(factoryName, accounts[0], businessCenterDomain);

Okay, that does not provide a description for the contract. Let's add a description to the process. The definition is a `DBCP <https://github.com/evannetwork/dbcp/wiki)>`_ contract definition and is stored in an ``Envelope`` (see :doc:`Encryption <../encryption/index>`):

.. code-block:: typescript

  const definition: Envelope = {
    "public": {
      "name": "Data Contract Sample",
      "description": "reiterance oxynitrate sat alternize acurative",
      "version": "0.1.0",
      "author": "evan GmbH",
      "dataSchema": {
        "list_settable_by_member": {
          "$id": "list_settable_by_member_schema",
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "foo": { "type": "string" },
            "bar": { "type": "integer" }
          }
        },
        "entry_settable_by_member": {
          "$id": "entry_settable_by_member_schema",
          "type": "integer",
        }
      }
    }
  };
  definition.cryptoInfo = cryptoProvider.getCryptorByCryptoAlgo('aes').getCryptoInfo(accounts[0]);
  const contract = await dataContract.create('testdatacontract', accounts[0], businessCenterDomain, definition);


Now we have a DataContract with a description. This contract is now able to be understood by other components, that understand the dbcp. And on top of that, we provided data schemas for the two properties ``list_settable_by_member`` and ``entry_settable_by_member`` (written for `ajv <https://github.com/epoberezkin/ajv>`_). This means, that when someone adds or sets entries to or in those properties, the incoming data is validated before actually encrypting and storing it.

To allow other users to work on the contract, they have to be invited with:

.. code-block:: typescript

  await dataContract.inviteToContract(businessCenterDomain, contract.options.address, accounts[0], accounts[1]);

Now the user ``accounts[1]`` can use functions from the contract, but to actually store data, the user needs access to the data key for the DataContract. This can be done via updating the contracts sharing:

.. code-block:: typescript

  const blockNr = await web3.eth.getBlockNumber();
  const contentKey = await sharing.getKey(contract.options.address, accounts[0], '*', blockNr);
  await sharing.addSharing(contract.options.address, accounts[0], accounts[1], '*', blockNr, contentKey);

Now the contract has been created, has a sharing and another user has been granted access to it. Variable names from this section will be used in the rest of the document as example values.

------------------------------------------------------------------------------



.. _data-contract_createSharing:

createSharing
================================================================================

.. code-block:: typescript

  dataContract.createSharing(accountId);

Create initial sharing for contract.

----------
Parameters
----------

#. ``accountId`` - ``string``: owner of the new contract

-------
Returns
-------

``Promise`` returns ``any``: sharing info with { contentKey, hashKey, sharings, sharingsHash, }

-------
Example
-------

.. code-block:: typescript

  const sharing = await dataContract.createSharing(profileReceiver);

--------------------------------------------------------------------------------



= Entries =
===========


.. _data-contract_setEntry:

setEntry
===================

.. code-block:: javascript

    dataContract.setEntry(contract, entryName, value, accountId[, dfsStorage, encryptedHashes, encryption);

Set entry for a key.


----------
Parameters
----------

#. ``contract`` - ``any|string``: contract or contractId
#. ``entryName`` - ``string``: entry name
#. ``value`` - ``any``: value to set
#. ``accountId`` - ``string``: Ethereum account id
#. ``dfsStorage`` - ``Function`` (optional): store values in dfs, defaults to ``true``
#. ``encryptedHashes`` - ``boolean`` (optional): encrypt hashes from values, defaults to ``true``
#. ``encryption`` - ``string`` (optional): encryption algorithm to use, defaults to ``defaultCryptoAlgo`` (set in constructor)
#. ``encryptionContext`` - ``string`` (optional): plain text name of an encryption context, defaults to ``accountId``

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const sampleValue = 123;
  await dataContract.setEntry(contract, 'entry_settable_by_owner', sampleValue, accounts[0]);


Entries are automatically encrypted before setting it in the contract. If you want to use values as is, without encrypting them, you can add them in raw mode, which sets them as ``bytes32`` values:

.. code-block:: typescript

  const sampleValue = '0x000000000000000000000000000000000000007b';
  await dataContract.setEntry(contract, 'entry_settable_by_owner', sampleValue, accounts[0], true);


------------------------------------------------------------------------------

.. _data-contract_getEntry:

getEntry
===================

.. code-block:: javascript

    dataContract.getEntry(contract, entryName, accountId[, dfsStorage, encryptedHashes]);

Return entry from contract.


----------
Parameters
----------

#. ``contract`` - ``any|string``: contract or contractId
#. ``entryName`` - ``string``: entry name
#. ``accountId`` - ``string``: Ethereum account id
#. ``dfsStorage`` - ``Function`` (optional): store values in dfs, defaults to ``true``
#. ``encryptedHashes`` - ``boolean`` (optional): decrypt hashes from values, defaults to ``true``

-------
Returns
-------

``Promise`` returns ``any``: entry

-------
Example
-------

Entries can be retrieved with:

.. code-block:: typescript

  const retrieved = await dataContract.getEntry(contract, 'entry_settable_by_owner', accounts[0]);


Raw values can be retrieved in the same way:

.. code-block:: typescript

  const retrieved = await dataContract.getEntry(contract, 'entry_settable_by_owner', accounts[0], true);



------------------------------------------------------------------------------



= List Entries =
================


.. _data-contract_addListEntries:

addListEntries
===================

.. code-block:: typescript

    dataContract.addListEntries(contract, listName, values, accountId[, dfsStorage, encryptedHashes, encryption]);

Add list entries to lists.

List entries support the raw mode as well. To use raw values, pass ``true`` in the same way as wehn using the entries functions.

List entries can be added in bulk, so the value argument is an array with values. This array can be arbitrarily large **up to a certain degree**. Values are inserted on the blockchain side and adding very large arrays this way may take more gas during the contract transaction, than may fit into a single transaction. If this is the case, values can be added in chunks (multiple transactions).

----------
Parameters
----------

#. ``contract`` - ``any|string``: contract or contractId
#. ``listName`` - ``string``: name of the list in the data contract
#. ``values`` - ``any[]``: values to add
#. ``accountId`` - ``string``: Ethereum account id
#. ``dfsStorage`` - ``string`` (optional): store values in dfs, defaults to ``true``
#. ``encryptedHashes`` - ``boolean`` (optional): encrypt hashes from values, defaults to ``true``
#. ``encryption`` - ``string`` (optional): encryption algorithm to use, defaults to ``defaultCryptoAlgo`` (set in constructor)
#. ``encryptionContext`` - ``string`` (optional): plain text name of an encryption context, defaults to ``accountId``

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const sampleValue = {
    foo: 'sample',
    bar: 123,
  };
  await dataContract.addListEntries(contract, 'list_settable_by_member', [sampleValue], accounts[0]);

When using lists similar to tagging list entries with metadata, entries can be added in multiple lists at once by passing an array of list names:

.. code-block:: typescript

  const sampleValue = {
    foo: 'sample',
    bar: 123,
  };
  await dataContract.addListEntries(contract, ['list_1', 'list_2'], [sampleValue], accounts[0]);



------------------------------------------------------------------------------


.. _data-contract_getListEntryCount:

getListEntryCount
===================

.. code-block:: typescript

    dataContract.getListEntryCount(contract, listName, index, accountId[, dfsStorage, encryptedHashes]);

Return number of entries in the list.
Does not try to actually fetch and decrypt values, but just returns the count.

----------
Parameters
----------

#. ``contract`` - ``any|string``: contract or contractId
#. ``listName`` - ``string``: name of the list in the data contract

-------
Returns
-------

``Promise`` returns ``number``: list entry count

-------
Example
-------

.. code-block:: typescript

  await dataContract.getListEntryCount(contract, 'list_settable_by_member');



------------------------------------------------------------------------------


.. _data-contract_getListEntries:

getListEntries
===================

.. code-block:: typescript

    dataContract.getListEntries(contract, listName, accountId[, dfsStorage, encryptedHashes, count, offset, reverse]);

Return list entries from contract.
Note, that in the current implementation, this function retrieves the entries one at a time and may take a longer time when querying large lists, so be aware of that, when you retrieve lists with many entries.

----------
Parameters
----------

#. ``contract`` - ``any|string``: contract or contractId
#. ``listName`` - ``string``: name of the list in the data contract
#. ``accountId`` - ``string``: Ethereum account id
#. ``dfsStorage`` - ``string`` (optional): store values in dfs, defaults to ``true``
#. ``encryptedHashes`` - ``boolean`` (optional): decrypt hashes from values, defaults to ``true``
#. ``count`` - ``number`` (optional): number of elements to retrieve, defaults to ``10``
#. ``offset`` - ``number`` (optional): skip this many items when retrieving, defaults to ``0``
#. ``reverse`` - ``boolean`` (optional): retrieve items in reverse order, defaults to ``false``

-------
Returns
-------

``Promise`` returns ``any[]``: list entries

-------
Example
-------

.. code-block:: typescript

  await dataContract.getListEntries(contract, 'list_settable_by_member', accounts[0]));



------------------------------------------------------------------------------


.. _data-contract_getListEntry:

getListEntry
===================

.. code-block:: typescript

    dataContract.getListEntry(contract, listName, index, accountId[, dfsStorage, encryptedHashes]);

Return a single list entry from contract.

----------
Parameters
----------

#. ``contract`` - ``any|string``: contract or contractId
#. ``listName`` - ``string``: name of the list in the data contract
#. ``index`` - ``number``: list entry id to retrieve
#. ``accountId`` - ``string``: Ethereum account id
#. ``dfsStorage`` - ``string`` (optional): store values in dfs, defaults to ``true``
#. ``encryptedHashes`` - ``boolean`` (optional): decrypt hashes from values, defaults to ``true``

-------
Returns
-------

``Promise`` returns ``any``: list entry

-------
Example
-------

.. code-block:: typescript

  const itemIndex = 0;
  await dataContract.getListEntry(contract, 'list_settable_by_member', itemIndex, accounts[0]));


------------------------------------------------------------------------------


.. _data-contract_removeListEntry:

removeListEntry
===================

.. code-block:: typescript

    redataContract.moveListEntry(contract, listName, entryIndex, accountId);

Remove list entry from list.

This will reposition last list entry into emptied slot.

----------
Parameters
----------

#. ``contract`` - ``any|string``: contract or contractId
#. ``listName`` - ``string``: name of the list in the data contract
#. ``index`` - ``number``: index of the entry to remove from list
#. ``accountId`` - ``string``: Ethereum account id

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const listName = 'list_removable_by_owner'
  const itemIndexInList = 1;
  await dataContract.removeListEntry(contract, listNameF, itemIndexInList, accounts[0]);


------------------------------------------------------------------------------


.. _data-contract_moveListEntry:

moveListEntry
===================

.. code-block:: typescript

    dataContract.moveListEntry(contract, listNameFrom, entryIndex, listNamesTo, accountId);

Move one list entry to one or more lists.

Note, that moving items requires the executing account to have ``remove`` permissions on the list ``listNameFrom``. If this isn't the case, the transaction will not be exetured and not updates will be made.

----------
Parameters
----------

#. ``contract`` - ``any|string``: contract or contractId
#. ``listNameFrom`` - ``string``: origin list
#. ``index`` - ``number``: index of the entry to move in the origin list
#. ``listNamesTo`` - ``string``: lists to move data into
#. ``accountId`` - ``string``: Ethereum account id

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const listNameFrom = 'list_removable_by_owner';
  const listNameTo = 'list_settable_by_member';
  const itemIndexInFromList = 1;
  await dataContract.moveListEntry(contract, listNameFrom, itemIndexInFromList, [listNameTo], accounts[0]);


------------------------------------------------------------------------------


= Mappings =
================


.. _data-contract_setMappingValue:

setMappingValue
===================

.. code-block:: typescript

  dataContract.setMappingValue(contract, mappingName, entryName, value, accountId[, dfsStorage, encryptedHashes, encryption]);

Set entry for a key in a mapping.
Mappings are basically dictionaries in data contracts. They are a single permittable entry, that allows to set any keys to it. This can be used for properties, that should be extended during the contracts life as needed, but without the need to update its permission settings.

----------
Parameters
----------

#. ``contract`` - ``any|string``: contract or contractId
#. ``mappingName`` - ``string``: name of a data contracts mapping property
#. ``entryName`` - ``string``: entry name (property in the mapping)
#. ``value`` - ``any``: value to add
#. ``accountId`` - ``string``: Ethereum account id
#. ``dfsStorage`` - ``string`` (optional): store values in dfs, defaults to ``true``
#. ``encryptedHashes`` - ``boolean`` (optional): encrypt hashes from values, defaults to ``true``
#. ``encryption`` - ``string`` (optional): encryption algorithm to use, defaults to ``defaultCryptoAlgo`` (set in constructor)
#. ``encryptionContext`` - ``string`` (optional): plain text name of an encryption context, defaults to ``accountId``

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await dataContract.setMappingValue(
    contract,
    'mapping_settable_by_owner',
    'sampleKey',
    'sampleValue',
    accounts[0],
    storeInDfs,
  );


------------------------------------------------------------------------------


.. _data-contract_getMappingValue:

getMappingValue
===================

.. code-block:: typescript

    dataContract.getMappingValue(contract, listName, index, accountId[, dfsStorage, encryptedHashes]);

Return a value from a mapping.
Looks up a single key from a mapping and returns its value.

----------
Parameters
----------

#. ``contract`` - ``any|string``: contract or contractId
#. ``mappingName`` - ``string``: name of a data contracts mapping property
#. ``entryName`` - ``string``: entry name (property in the mapping)
#. ``accountId`` - ``string``: Ethereum account id
#. ``dfsStorage`` - ``string`` (optional): store values in dfs, defaults to ``true``
#. ``encryptedHashes`` - ``boolean`` (optional): encrypt hashes from values, defaults to ``true``
#. ``encryption`` - ``string`` (optional): encryption algorithm to use, defaults to ``defaultCryptoAlgo`` (set in constructor)

-------
Returns
-------

``Promise`` returns ``any``: mappings value for given key

-------
Example
-------

.. code-block:: typescript

  const value = await dataContract.getMappingValue(
    contract,
    'mapping_settable_by_owner',
    'sampleKey',
    accounts[0],
    storeInDfs,
  );



------------------------------------------------------------------------------


= Encryption =
================


.. data-contract_encrypt:

encrypt
===================

.. code-block:: typescript

  dataContract.encrypt(toEncrypt, contract, accountId, propertyName, block[, encryption]);

Encrypt incoming envelope.

----------
Parameters
----------

#. ``toEncrypt`` - ``Envelope``: envelope with data to encrypt
#. ``contract`` - ``any``: contract instance or contract id
#. ``accountId`` - ``string``: encrypting account
#. ``propertyName`` - ``string``: property in contract, the data is encrypted for
#. ``block`` - ``block``: block the data belongs to
#. ``encryption`` - ``string``: encryption name, defaults to ``defaultCryptoAlgo`` (set in constructor)

-------
Returns
-------

``Promise`` returns ``string``: encrypted envelope or hash as string

-------
Example
-------

.. code-block:: typescript

  const data = {
    public: {
      foo: 'example',
    },
    private: {
      bar: 123,
    },
    cryptoInfo: cryptor.getCryptoInfo(nameResolver.soliditySha3(accounts[0])),
  };
  const encrypted = await dataContract.encrypt(data, contract, accounts[0], 'list_settable_by_member', 12345);


------------------------------------------------------------------------------

.. data-contract_decrypt:

decrypt
===================

.. code-block:: typescript

  dataContract.decrypt(toDecrypt, contract, accountId, propertyName, block[, encryption]);

Decrypt input envelope return decrypted envelope.

----------
Parameters
----------

#. ``toDecrypt`` - ``string``: data to decrypt
#. ``contract`` - ``any``: contract instance or contract id
#. ``accountId`` - ``string``: account id that decrypts the data
#. ``propertyName`` - ``string``: property in contract that is decrypted

-------
Returns
-------

``Promise`` returns ``Envelope``: decrypted envelope

-------
Example
-------

.. code-block:: typescript

  const encrypted = await dataContract.decrypt(encrypted, contract, accounts[0], 'list_settable_by_member');


------------------------------------------------------------------------------

.. data-contract_encryptHash:

encryptHash
===================

.. code-block:: typescript

  dataContract.encryptHash(toEncrypt, contract, accountId);

Encrypt incoming hash.
This function is used to encrypt DFS file hashes, uses AES ECB for encryption.

----------
Parameters
----------

#. ``toEncrypt`` - ``Envelope``: hash to encrypt
#. ``contract`` - ``any``: contract instance or contract id
#. ``accountId`` - ``string``: encrypting account

-------
Returns
-------

``Promise`` returns ``string``: hash as string

-------
Example
-------

.. code-block:: typescript

  const hash = '0x1111111111111111111111111111111111111111111111111111111111111111';
  const encrypted = await dataContract.encryptHash(hash, contract, accounts[0]);


------------------------------------------------------------------------------

.. data-contract_decryptHash:

decryptHash
===================

.. code-block:: typescript

  dataContract.encrypt(toEncrypttoDecrypt, contract, accountId, propertyName, block[, encryption]);

Decrypt input hash, return decrypted hash.
This function is used to decrypt encrypted DFS file hashes, uses AES ECB for decryption.

----------
Parameters
----------

#. ``toDecrypt`` - ``Envelope``: hash to decrypt
#. ``contract`` - ``any``: contract instance or contract id
#. ``accountId`` - ``string``: encrypting account

-------
Returns
-------

``Promise`` returns ``string``: decrypted hash

-------
Example
-------

.. code-block:: typescript

  const encryptedHash = '0x2222222222222222222222222222222222222222222222222222222222222222';
  const encrypted = await dataContract.decryptHash(encryptedHash, contract, accounts[0]);



.. required for building markup

.. |source contractLoader| replace:: ``ContractLoader``
.. _source contractLoader: ../contracts/contract-loader.html

.. |source cryptoProvider| replace:: ``CryptoProvider``
.. _source cryptoProvider: ../encryption/crypto-provider.html

.. |source dfsInterface| replace:: ``DfsInterface``
.. _source dfsInterface: ../dfs/dfs-interface.html

.. |source executor| replace:: ``Executor``
.. _source executor: ../blockchain/executor.html

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: ../common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: ../common/logger.html#logloginterface

.. |source nameResolver| replace:: ``NameResolver``
.. _source nameResolver: ../blockchain/name-resolver.html

.. |source sharing| replace:: ``Sharing``
.. _source sharing: ../contracts/sharing.html
