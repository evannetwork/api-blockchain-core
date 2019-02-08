================================================================================
Profile
================================================================================

.. list-table:: 
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - Profile
   * - Extends
     - `Logger <../common/logger.html>`_
   * - Source
     - `profile.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/profile/profile.ts>`_
   * - Examples
     - `profile.spec.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/profile/profile.spec.ts>`_

A users profile is its personal storage for
- contacts
- encryption keys exchanged with contacts
- an own public key for exchanging keys with new contacts
- bookmarked ÐAPPs
- created contracts

This data is stored as an `IPLD Graphs <https://github.com/ipld/ipld>`_ per type and stored in a users profile contract. These graphs are independant from each other and have to be saved separately.

This contract is a `DataContract <https://github.com/evannetwork/api-blockchain-core/tree/master/src/contracts/database-contract/data-contract.ts>`_ and can be created via the factory at `profile.factory.evan` and looked up at the global profile index `profile.evan`. The creation process and landmap looks like this:

.. image:: https://user-images.githubusercontent.com/1394421/38298221-1938d006-37f7-11e8-9a84-abfd311c97f0.png



--------------------------------------------------------------------------------

Basic Usage
================================================================================

.. code-block:: typescript

  // the bookmark we want to store
  const sampleDesc = {
    title: 'sampleTest',
    description: 'desc',
    img: 'img',
    primaryColor: '#FFFFFF',
  };

  // create new profile, set private key and keyexchange partial key
  await profile.createProfile(keyExchange.getDiffieHellmanKeys());

  // add a bookmark
  await profile.addDappBookmark('sample1.test', sampleDesc);

  // store tree to contract
  await profile.storeForAccount(profile.treeLabels.bookmarkedDapps);



--------------------------------------------------------------------------------

.. _profile_constructor:

constructor
================================================================================

.. code-block:: typescript

  new Profile(options);

Creates a new Profile instance.

----------
Parameters
----------

#. ``options`` - ``ProfileOptions``: options for Profile constructor
    * ``accountId`` - ``string``: account, that is the profile owner
    * ``contractLoader`` - |source contractLoader|_: |source contractLoader|_ instance
    * ``dataContract`` - |source dataContract|_: |source dataContract|_ instance
    * ``executor`` - |source executor|_: |source executor|_ instance
    * ``ipld`` - |source ipld|_: |source ipld|_ instance
    * ``nameResolver`` - |source nameResolver|_: |source nameResolver|_ instance
    * ``defaultCryptoAlgo`` - ``string`` (optional): crypto algorith name from |source cryptoProvider|, defaults to ``aes``
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``
    * ``trees`` - ``object`` (optional): precached profile data, defaults to ``{}``

-------
Returns
-------

``Profile`` instance

-------
Example
-------

.. code-block:: typescript
  
  const profile = new Profile({
    accountId: accounts[0],
    contractLoader,
    dataContract,
    executor,
    ipld,
    nameResolver,
  });



------------------------------------------------------------------------------



.. _profile_createProfile:

createProfile
================================================================================

.. code-block:: typescript

  profile.createProfile(keys)

Create new profile, store it to profile index initialize addressBook and publicKey.

----------
Parameters
----------

#. ``keys`` - ``any``: diffie hell man keys for account, created by |source keyExchange_getDiffieHellmanKeys|_
    * ``privateKey`` - ``Buffer``: private key for key exchange
    * ``publicKey`` - ``Buffer``: combination of shared secret and own private key

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await profile.createProfile(keyExchange.getDiffieHellmanKeys());



------------------------------------------------------------------------------

.. _profile_exists:

exists
================================================================================

.. code-block:: typescript

  profile.exists();

Check if a profile has been stored for current account.

----------
Parameters
----------

#. ``options`` - ``object``: The options used for calling

-------
Returns
-------

``Promise`` returns ``void``: true if a contract was registered, false if not

-------
Example
-------

.. code-block:: typescript

  console.log(await profile.exists());
  // Output:
  // true



------------------------------------------------------------------------------

.. _profile_getContactKnownState:

getContactKnownState
================================================================================

.. code-block:: typescript

  profile.getContactKnownState(accountId);

Check, known state for given account.

----------
Parameters
----------

#. ``accountId`` - ``string``: account id of a contact

-------
Returns
-------

``Promise`` returns ``void``: true if known account

-------
Example
-------

.. code-block:: typescript

    console.log(await profile.getContactKnownState(accountId));
  // Output:
  // true



------------------------------------------------------------------------------

.. _profile_setContactKnownState:

setContactKnownState
================================================================================

.. code-block:: typescript

  profile.setContactKnownState(accountId, contactKnown);

Store given state for this account.

----------
Parameters
----------

#. ``accountId`` - ``string``: account id of a contact
#. ``contactKnown`` - ``boolean``: true if known, false if not

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  // mark accountId as a known contact
  profile.setContactKnownState(accountId, true);



------------------------------------------------------------------------------

.. _profile_loadForAccount:

loadForAccount
================================================================================

.. code-block:: typescript

  profile.loadForAccount([tree]);

Load profile for given account from global profile contract, if a tree is given, load that tree from ipld as well.

----------
Parameters
----------

#. ``tree`` - ``string`` (optional): tree to load ('bookmarkedDapps', 'contracts', ...), profile.treeLabels properties can be passed as arguments

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await profile.loadForAccount(profile.treeLabels.contracts);



------------------------------------------------------------------------------

.. _profile_storeForAccount:

storeForAccount
================================================================================

.. code-block:: typescript

  profile.storeForAccount(tree);

Stores profile tree or given hash to global profile contract.

----------
Parameters
----------

#. ``tree`` - ``string``: tree to store ('bookmarkedDapps', 'contracts', ...)
#. ``ipldHash`` - ``string`` (optional): store this hash instead of the current tree for account

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await profile.storeForAccount(profile.treeLabels.contracts);



------------------------------------------------------------------------------

.. _profile_loadFromIpld:

loadFromIpld
================================================================================

.. code-block:: typescript

  profile.loadFromIpld(tree, ipldIpfsHash);

Load profile from ipfs via ipld dag via ipfs file hash.

----------
Parameters
----------

#. ``tree`` - ``string``: tree to load ('bookmarkedDapps', 'contracts', ...)
#. ``ipldIpfsHash`` - ``string``: ipfs file hash that points to a file with ipld a hash

-------
Returns
-------

``Promise`` returns ``Profile``: this profile

-------
Example
-------

.. code-block:: typescript

  await profile.loadFromIpld(profile.treeLabels.contracts, ipldIpfsHash);



------------------------------------------------------------------------------

.. _profile_storeToIpld:

storeToIpld
================================================================================

.. code-block:: typescript

  profile.storeToIpld(tree);

Store profile in ipfs as an ipfs file that points to a ipld dag.

----------
Parameters
----------

#. ``tree`` - ``string``: tree to store ('bookmarkedDapps', 'contracts', ...)

-------
Returns
-------

``Promise`` returns ``string``: hash of the ipfs file

-------
Example
-------

.. code-block:: typescript

  const storedHash = await profile.storeToIpld(profile.treeLabels.contracts);



= addressBook =
==============================================================================

.. _profile_addContactKey:

addContactKey
================================================================================

.. code-block:: typescript

  profile.addContactKey(address, context, key);

Add a key for a contact to bookmarks.

----------
Parameters
----------

#. ``address`` - ``string``: account key of the contact
#. ``context`` - ``string``: store key for this context, can be a contract, bc, etc.
#. ``key`` - ``string``: communication key to store

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await profile.addContactKey(accounts[0], 'context a', 'key 0x01_a');



------------------------------------------------------------------------------

.. _profile_addProfileKey:

addProfileKey
================================================================================

.. code-block:: typescript

  profile.addProfileKey(address, key, value);

Add a profile value to an account.

----------
Parameters
----------

#. ``address`` - ``string``: account key of the contact
#. ``key`` - ``string``: store key for the account like alias, etc.
#. ``value`` - ``string``: value of the profile key

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await profile.addProfileKey(accounts[0], 'email', 'sample@example.org');
  await profile.addProfileKey(accounts[0], 'alias', 'Sample Example');



------------------------------------------------------------------------------

.. _profile_getAddressBookAddress:

getAddressBookAddress
================================================================================

.. code-block:: typescript

  profile.getAddressBookAddress(address);

Function description

----------
Parameters
----------

#. ``address`` - ``string``: contact address

-------
Returns
-------

``Promise`` returns ``any``: bookmark info

-------
Example
-------

.. code-block:: typescript

  await profile.getAddressBookAddress(accounts[0]);



------------------------------------------------------------------------------

.. _profile_getAddressBook:

getAddressBook
================================================================================

.. code-block:: typescript

  profile.getAddressBook();

Get the whole addressBook.

----------
Parameters
----------

(none)

-------
Returns
-------

``any``: entire address book

-------
Example
-------

.. code-block:: typescript

  await profile.getAddressBook();



------------------------------------------------------------------------------


.. _profile_getContactKey:

getContactKey
================================================================================

.. code-block:: typescript

  profile.getContactKey(address, context);

Get a communication key for a contact from bookmarks.

----------
Parameters
----------

#. ``address`` - ``string```: account key of the contact
#. ``context`` - ``string```: store key for this context, can be a contract, bc, etc.

-------
Returns
-------

``Promise`` returns ``void``: matching key

-------
Example
-------

.. code-block:: typescript

  await profile.getContactKey(accounts[0], 'exampleContext');



------------------------------------------------------------------------------


.. _profile_getProfileKey:

getProfileKey
================================================================================

.. code-block:: typescript

  profile.getProfileKey(address, key);

Get a key from an address in the address book.

----------
Parameters
----------

#. ``address`` - ``string``: address to look up
#. ``key`` - ``string``: type of key to get

-------
Returns
-------

``Promise`` returns ``any``: key

-------
Example
-------

.. code-block:: typescript

  const alias = await profile.getProfileKey(accountId, 'alias');



------------------------------------------------------------------------------

.. _profile_removeContact:

removeContact
================================================================================

.. code-block:: typescript

  profile.removeContact(address);

Remove a contact from bookmarkedDapps.

----------
Parameters
----------

#. ``address`` - ``string``: account key of the contact

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await profile.removeContact(address);



------------------------------------------------------------------------------

= bookmarkedDapps =
==============================================================================



.. _profile_addDappBookmark:

addDappBookmark
================================================================================

.. code-block:: typescript

  profile.addDappBookmark(address, description);

Add a bookmark for a dapp.

----------
Parameters
----------

#. ``address`` - ``string``: ENS name or contract address (if no ENS name is set)
#. ``description`` - ``DappBookmark``: description for bookmark

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const bookmark = {
    "name": "taskboard",
    "description": "Create todos and manage updates.",
    "i18n": {
      "description": {
        "de": "Erstelle Aufgaben und überwache Änderungen",
        "en": "Create todos and manage updates"
      },
      "name": {
        "de": "Task Board",
        "en": "Task Board"
      }
    },
    "imgSquare": "...",
    "standalone": true,
    "primaryColor": "#e87e23",
    "secondaryColor": "#fffaf5",
  };
  await profile.addDappBookmark('sampletaskboard.evan', bookmark);



------------------------------------------------------------------------------

.. _profile_getDappBookmark:

getDappBookmark
================================================================================

.. code-block:: typescript

  profile.getDappBookmark(address);

Get a bookmark for a given address if any.

----------
Parameters
----------

#. ``address`` - ``string``: ENS name or contract address (if no ENS name is set)

-------
Returns
-------

``Promise`` returns ``any``: bookmark info

-------
Example
-------

.. code-block:: typescript

  await profile.getDappBookmark('sample1.evan');



--------------------------------------------------------------------------------

.. _profile_getBookmarkDefinition:

getBookmarkDefinition
================================================================================

.. code-block:: typescript

  profile.getBookmarkDefinition();

Get all bookmarks for profile.

----------
Parameters
----------

(none)

-------
Returns
-------

``Promise`` returns ``any``: all bookmarks for profile

-------
Example
-------

.. code-block:: typescript

  await profile.getBookmarkDefinitions();



------------------------------------------------------------------------------

.. _profile_removeDappBookmark:

removeDappBookmark
================================================================================

.. code-block:: typescript

  profile.removeDappBookmark(address);

Remove a dapp bookmark from the bookmarkedDapps.

----------
Parameters
----------

#. ``address`` - ``string``: address of the bookmark to remove

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await profile.removeDappBookmark(address);



------------------------------------------------------------------------------

.. _profile_setDappBookmarks:

setDappBookmarks
================================================================================

.. code-block:: typescript

  profile.setDappBookmarks(bookmarks);

Set bookmarks with given value.

----------
Parameters
----------

#. ``bookmarks`` - ``any``: The options used for calling

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const bookmarks = await profile.getBookmarkDefinitions();
  // update bookmarks
  // ...
  await profile.setDappBookmarks(bookmarks);



------------------------------------------------------------------------------

= contracts =
==============================================================================



.. _profile_addContract:

addContract
================================================================================

.. code-block:: typescript

  profile.addContract(bc, address, data);

Add a contract to the current profile.

----------
Parameters
----------

#. ``bc`` - ``string``: business center ens address or contract address
#. ``address`` - ``string``: contact address
#. ``data`` - ``any``: bookmark metadata

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await profile.addBcContract('testbc.evan', '0x', contractDescription);



------------------------------------------------------------------------------



.. _profile_removeContract:

removeContract
================================================================================

.. code-block:: typescript

  profile.removeContract(address, data);

removes a contract (task contract etc. ) from a business center scope of the current profile

----------
Parameters
----------

#. ``bc`` - ``string``: business center ens address or contract address
#. ``address`` - ``any``: contact address

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await profile.removeBcContract('testbc.evan', '0x');



------------------------------------------------------------------------------


.. _profile_getContracts:

getContracts
================================================================================

.. code-block:: typescript

  profile.getContracts();

Get all contracts for the current profile.

----------
Parameters
----------

(none)

-------
Returns
-------

``Promise`` returns ``any``: contracts info

-------
Example
-------

.. code-block:: typescript

  await profile.getContracts();



------------------------------------------------------------------------------

.. _profile_getContract:

getContract
================================================================================

.. code-block:: typescript

  profile.getContract(address);

Get a specific contract entry for a given address.

----------
Parameters
----------

#. ``address`` - ``string``: contact address

-------
Returns
-------

``Promise`` returns ``any``: bookmark info

-------
Example
-------

.. code-block:: typescript

  await profile.getContract('testbc.evan');



--------------------------------------------------------------------------------

.. _profile_addBcContract:

addBcContract
================================================================================

.. code-block:: typescript

  profile.addBcContract(bc, address, data)

Add a contract (task contract etc. ) to a business center scope of the current profile

----------
Parameters
----------

#. ``bc`` - ``string``: business center ens address or contract address
#. ``address`` - ``string``: contact address
#. ``data`` - ``any``: bookmark metadata

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await profile.addBcContract('testbc.evan', '0x...', contractDescription);



------------------------------------------------------------------------------

.. _profile_getBcContract:

getBcContract
================================================================================

.. code-block:: typescript

  profile.getBcContract(bc, address);

Get a specific contract entry for a given address.

----------
Parameters
----------

#. ``bcc`` - ``string``: business center ens address or contract address
#. ``address`` - ``string``: contact address

-------
Returns
-------

``Promise`` returns ``any``: bookmark info

-------
Example
-------

.. code-block:: typescript

  await profile.getBcContract('testbc.evan', '0x...');



------------------------------------------------------------------------------

.. _profile_getBcContracts:

getBcContracts
================================================================================

.. code-block:: typescript

  profile.getBcContracts(bc, address);

Get all contracts grouped under a business center.

----------
Parameters
----------

#. ``bcc`` - ``string``: business center ens address or contract address

-------
Returns
-------

``Promise`` returns ``any``: bookmark info

-------
Example
-------

.. code-block:: typescript

  await profile.getBcContracts('testbc.evan');



------------------------------------------------------------------------------

= publicKey =
==============================================================================



.. _profile_addPublicKey:

addPublicKey
================================================================================

.. code-block:: typescript

  profile.addPublicKey(key);

Add a key for a contact to bookmarks.

----------
Parameters
----------

#. ``key`` - ``string``: public Diffie Hellman key part to store

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await profile.addPublicKey('...');



------------------------------------------------------------------------------

.. _profile_getPublicKey:

getPublicKey
================================================================================

.. code-block:: typescript

  profile.getPublicKey();

Get public key of profiles.

----------
Parameters
----------

(none)

-------
Returns
-------

``Promise`` returns ``any``: public key

-------
Example
-------

.. code-block:: typescript

  const key = await profile.getPublicKey();

------------------------------------------------------------------------------

.. _profile_loadActiveVerifications:

loadActiveVerifications
================================================================================

.. code-block:: typescript

  profile.loadActiveVerifications();

Load all verificationss that should be displayed for this profile within the ui.

----------
Parameters
----------

(none)

-------
Returns
-------

``Promise`` returns ``Array<string>``: array of topics of verificationss that should be displayed (e.g. [ '/company/tuev', '/test/1234' ] )

-------
Example
-------

.. code-block:: typescript

  const topics = await bcc.profile.loadActiveVerifications();

------------------------------------------------------------------------------

.. _profile_setActiveVerifications:

setActiveVerifications
================================================================================

.. code-block:: typescript

  profile.setActiveVerifications(bookmarks);

Save an array of active verificationss to the profile.

----------
Parameters
----------

#. ``bookmarks`` - ``Array<string>``: bookmarks to set

-------
Returns
-------

``Promise`` returns ``void``: resolved when saving is done

-------
Example
-------

.. code-block:: typescript

  await bcc.profile.setActiveVerifications([ '/company/tuev', '/test/1234' ]);


.. required for building markup

.. |source contractLoader| replace:: ``ContractLoader``
.. _source contractLoader: /contracts/contract-loader.html

.. |source cryptoProvider| replace:: ``CryptoProvider``
.. _source cryptoProvider: /encryption/crypto-provider.html

.. |source dataContract| replace:: ``DataContract``
.. _source dataContract: /contracts/data-contract.html

.. |source executor| replace:: ``Executor``
.. _source executor: /blockchain/executor.html

.. |source ipld| replace:: ``Ipld``
.. _source ipld: /dfs/ipld.html

.. |source keyExchange_getDiffieHellmanKeys| replace:: ``KeyExchange``
.. _source keyExchange_getDiffieHellmanKeys: /profile/key-exchange.html#getdiffiehellmankeys

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: /common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: /common/logger.html#logloginterface

.. |source nameResolver| replace:: ``NameResolver``
.. _source nameResolver: /blockchain/name-resolver.html
