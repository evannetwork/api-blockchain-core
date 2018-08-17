================================================================================
Business Center Profile
================================================================================

.. list-table:: 
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - BusinessCenterProfile
   * - Extends
     - `Logger <../common/logger.html>`_
   * - Source
     - `business-center-profile.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/profile/business-center-profile.ts>`_
   * - Examples
     - `business-center-profile.spec.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/profile/business-center-profile.spec.ts>`_

The ``BusinessCenterProfile`` module allows to create profiles in a business center.

These profiles are like business cards for specific contexts and can be used to share data like contact data or certificates under this business centers context.



--------------------------------------------------------------------------------

Basic Usage
================================================================================

.. code-block:: typescript

    // update/set contact card locally
    await profile.setContactCard(JSON.parse(JSON.stringify(sampleProfile)));

    // store to business center
    await profile.storeForBusinessCenter(businessCenterDomain, accounts[0]);

    // load from business center
    await profile.loadForBusinessCenter(businessCenterDomain, accounts[0]);
    const loadedProfile = await profile.getContactCard();



--------------------------------------------------------------------------------

.. _businessCenterProfile_constructor:

constructor
================================================================================

.. code-block:: typescript

  new BusinessCenterProfile(options);

Creates a new BusinessCenterProfile instance.

----------
Parameters
----------

#. ``options`` - ``BusinessCenterProfileOptions``: options for BusinessCenterProfile constructor.
    * ``bcAddress`` - ``string``: ENS address (domain name) of the business center, the module instance is scoped to
    * ``cryptoProvider`` - |source cryptoProvider|_: |source cryptoProvider|_ instance
    * ``defaultCryptoAlgo`` - ``string``: crypto algorith name from |source cryptoProvider|
    * ``ipld`` - |source ipld|_: |source ipld|_ instance
    * ``nameResolver`` - |source nameResolver|_: |source nameResolver|_ instance
    * ``ipldData`` - ``any`` (optional): preloaded profile data
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``

-------
Returns
-------

``BusinessCenterProfile`` instance

-------
Example
-------

.. code-block:: typescript
  
  const businessCenterProfile = new BusinessCenterProfile({
    ipld,
    nameResolver,
    defaultCryptoAlgo: 'aes',
    bcAddress: businessCenterDomain,
    cryptoProvider,
  });;



--------------------------------------------------------------------------------

.. _businessCenterProfile_setContactCard:

setContactCard
================================================================================

.. code-block:: typescript

  businessCenterProfile.setContactCard();

Set contact card on current profile.

----------
Parameters
----------

#. ``contactCard`` - ``any``: contact card to store

-------
Returns
-------

``Promise`` returns ``any``: updated tree

-------
Example
-------

.. code-block:: typescript

  const updated = await businessCenterProfile.setContactCard(contactCard);



--------------------------------------------------------------------------------

.. _businessCenterProfile_getContactCard:

getContactCard
================================================================================

.. code-block:: typescript

  businessCenterProfile.getContactCard();

Get contact card from.

----------
Parameters
----------

(none)

-------
Returns
-------

``Promise`` returns ``any``: contact card

-------
Example
-------

.. code-block:: typescript

  const loadedProfile = await businessCenterProfile.getContactCard();



--------------------------------------------------------------------------------

.. _businessCenterProfile_storeForBusinessCenter:

storeForBusinessCenter
================================================================================

.. code-block:: typescript

  businessCenterProfile.storeForBusinessCenter(businessCenterDomain, account);

Stores profile to business centers profile store.

----------
Parameters
----------

#. ``businessCenerDomain`` - ``string``: ENS domain name of a business center
#. ``account`` - ``string``: Ethereum account id

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await businessCenterProfile.setContactCard(contactCard);
  await businessCenterProfile.storeForBusinessCenter(businessCenterDomain, accounts[0]);



--------------------------------------------------------------------------------

.. _businessCenterProfile_loadForBusinessCenter:

loadForBusinessCenter
================================================================================

.. code-block:: typescript

  businessCenterProfile.loadForBusinessCenter(businessCenterDomain, account);

Function description

----------
Parameters
----------

#. ``businessCenerDomain`` - ``string``: ENS domain name of a business center
#. ``account`` - ``string``: Ethereum account id

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await newProfilebusinessCenterProfile.loadForBusinessCenter(businessCenterDomain, accounts[0]);
  const contactCard = await businessCenterProfile.getContactCard();



------------------------------------------------------------------------------

.. _business-center-profile_storeToIpld:

storeToIpld
================================================================================

.. code-block:: typescript

  businessCenterProfile.storeToIpld();

Store profile in ipfs as an ipfs file that points to a ipld dag.

----------
Parameters
----------

(none)

-------
Returns
-------

``Promise`` returns ``string``: hash of the ipfs file

-------
Example
-------

.. code-block:: typescript

  await businessCenterProfile.storeToIpld();



------------------------------------------------------------------------------

.. _business-center-profile_loadFromIpld:

loadFromIpld
================================================================================

.. code-block:: typescript

  businessCenterProfile.loadFromIpld(tree, ipldIpfsHash);

Load profile from ipfs via ipld dag via ipfs file hash.

----------
Parameters
----------

#. ``ipldIpfsHash`` - ``string``: ipfs file hash that points to a file with ipld a hash

-------
Returns
-------

``Promise`` returns ``BusinessCenterProfile``: this profile

-------
Example
-------

.. code-block:: typescript

  businessCenterProfile.loadFromIpld(ipldIpfsHash);



.. required for building marku

.. |source cryptoProvider| replace:: ``CryptoProvider``
.. _source cryptoProvider: /encryption/crypto-provider.html

.. |source ipld| replace:: ``Ipld``
.. _source ipld: /dfs/ipld.htmlp

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: /common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: /common/logger.html#logloginterface

.. |source nameResolver| replace:: ``NameResolver``
.. _source nameResolver: /blockchain/name-resolver.html