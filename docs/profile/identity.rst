================================================================================
Identity
================================================================================

.. list-table::
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - Identity
   * - Extends
     - `Logger <../common/logger.html>`_
   * - Source
     - `identity.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/identity/identity.ts>`_
   * - Examples
     - `identity.spec.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/identity/identity.spec.ts>`_

Each account that is registered on the evan.network has an identity with an assigned profile contract. Each identity can be permitted to act on behalf of another identity. This identity library helps to grant / remove read or write permissions to act on behalf of an identity and also to manage identities an identity was invitited to.



--------------------------------------------------------------------------------

.. _identity_constructor:

constructor
================================================================================

.. code-block:: typescript

  new Identity(options);

Creates a new identity instance with a specific identity / underlying address context.

----------
Parameters
----------

#. ``options`` - ``IdentityOptions``: options for Identity constructor.
    * ``activeIdentity`` - ``string``: identity address to manage
    * ``contractLoader`` - |source contractLoader|_: |source contractLoader|_ instance
    * ``did`` - |source did|_: |source did|_ instance
    * ``executor`` - |source executor|_: |source executor|_ instance
    * ``mailbox`` - |source mailbox|_: |source mailbox|_ instance
    * ``nameResolver`` - |source nameResolver|_: |source nameResolver|_ instance
    * ``profile`` - |source profile|_: |source profile|_ instance
    * ``runtimeConfig`` - ``any``: runtime configuration with a keyConfig
    * ``underlyingAccount`` - ``string``: account that controls the active identity
    * ``verifications`` - |source verifications|_: |source verifications|_ instance
    * ``web3`` - |source web3|_: |source web3|_ instance
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``

-------
Returns
-------

``Identity`` instance

-------
Example
-------

.. code-block:: typescript

  const identity = new Identity({
    activeIdentity,
    config,
    contractLoader,
    did,
    executor,
    mailbox,
    nameResolver,
    profile,
    runtimeConfig,
    underlyingAccount,
    verifications,
    web3,
  });

--------------------------------------------------------------------------------

.. _identity_grantAccess:

grantAccess
================================================================================

.. code-block:: typescript

  identity.grantAccess(identity, type, bmailContent, ?note);

Grants the current active identity access to the passed identity, depending on the passed type (read / readWrite). Sends the identities encryption key via bmail and uses ``grantWriteAccess`` internally to grant ``write`` permission.

----------
Parameters
----------

#. ``identity`` - ``string``: identity to give access
#. ``type`` - ``string``: read / readWrite
#. ``bmailContent`` - ``Bmail.content``: content that should be passed as bmail.content 
    * ``body`` - ``string``: bmail body
    * ``fromAlias`` - ``string``: alias that should sent with the bmail
    * ``title`` - ``string``: title of the bmail
#. ``note`` - ``string`` (optional): note that can be added for the identity access (e.g. role / short name in the company)

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await runtime.identity.grantAccess(
    '0x000...2',
    'readWrite',
    {
      body: 'Hi adminstrator of company XYZ. I invite you to act on behalf of my company identity.',
      fromAlias: 'Company XYZ',
      title: `Identity access`,
    },
    'administrator'
  );


--------------------
Accept Access B-Mail
--------------------
The invited user receives a b-mail with a ``identityAccess`` attachment that can be saved in the identities profile, so it can be loaded via ``runtime.profile.getIdentityAccessList``.

.. code-block:: typescript

  const { mails } = await runtime1.mailbox.getReceivedMails(5, 0);
  const { encryptionKey } = Object.keys(mails).find((mailAddress: string) => {
    const attachment = mails[mailAddress]?.content?.attachments[0];
    if (attachment && attachment.type === 'identityAccess') {
      return attachment.encryption;
    }
  });

  await runtime1.profile.loadForAccount();
  await runtime1.profile.setIdentityAccess('0x000...1', encryptionKey);
  await runtime1.profile.storeForAccount(runtime1.profile.treeLabels.addressBook);


--------------------------
Check permitted identities
--------------------------
While using the ``grantAccess`` function, several profile keys are saved for this indetity to keep some information about the permitted user. Simply load your profile and check for the following properties:

#. ``hasIdentityAccess`` - ``string``: read / readWrite
#. ``identityAccessGranted`` - ``string``: last save date (Date.now())
#. ``identityAccessNote`` - ``string``: optional note that is saved for this identity

Use the following function to get all contacts that have access to your current identity:

.. code-block:: typescript

  const { profile } = await runtime.profile.getAddressBook();

  const identitiesWithAccess = await Promise.all(Object.keys(profile)
    .filter((address) => address.startsWith('0x')
      && address !== runtime.activeAccount
      && address !== runtime.activeIdentity)
    .map(async (contactAddress: string) => {
      const contact = profile[contactAddress];
      return {
        grantedAt: contact.identityAccessGranted
          ? new Date(parseInt(contact.identityAccessGranted, 10)) : '',
        hasIdentityAccess: contact.hasIdentityAccess || false,
        note: contact.identityAccessNote || '',
      }
    }));

--------------------------------------------------------------------------------


.. _identity_grantWriteAccess:

grantWriteAccess
================================================================================

.. code-block:: typescript

  identity.grantWriteAccess(identity);

Adds a identity to the identity did document (pubKey + authorization) and adds the identity to the
current activeIdentities keyholder.

**Note**: It just adds the identity to the did document / the keyHolder and don't send any bmail with any information about the invitation. Please use ``grantAccess`` for this.

----------
Parameters
----------

#. ``identity`` - ``string``: identity to give write access to

-------
Returns
-------

``Promise`` returns ``void`` - resolved when done

-------
Example
-------

.. code-block:: typescript

  await runtime.identity.grantWriteAccess('0x000...2');

--------------------------------------------------------------------------------


.. _identity_removeAccess:

removeAccess
================================================================================

.. code-block:: typescript

  identity.removeAccess(identity, type, bmailContent);

Removes the access, to act on behalf of the activeIdentity, for another identity. When removing read access, a bmail is sent, so the identity gets a notification with a attachment, with a ``identityAccessRemove`` attachment. Besides the sent b-mail it uses ``removeWriteAccess`` internally to remove the access for the did document and keyholder. 

----------
Parameters
----------

#. ``identity`` - ``string``: identity to remove the access for
#. ``type`` - ``string``: read, write, readWrite
#. ``bmailContent`` - ``string`` (optional): optional bmail content to inform the identity
    * ``body`` - ``string``: bmail body
    * ``fromAlias`` - ``string``: alias that should sent with the bmail
    * ``title`` - ``string``: title of the bmail

-------
Returns
-------

``Promise`` returns ``void`` - resolved when done

-------
Example
-------

.. code-block:: typescript

  await runtime.identity.removeAccess(
    '0x000...2',
    'readWrite',
    {
      body: 'Hi adminstrator of company XYZ. You was kicked out of the company. Please remove the encryptionKey reference in your profile',
      fromAlias: 'Company XYZ',
      title: `Identity removal`,
    },
  );


--------------------
Accept remove access B-Mail
--------------------
The removed user receives a b-mail with a ``identityAccessRemove`` attachment, so the encryptionKey reference can be removed from the profile.

.. code-block:: typescript

  const { mails } = await runtime1.mailbox.getReceivedMails(5, 0);
  const { from } = Object.keys(mails).find((mailAddress: string) => {
    const attachment = mails[mailAddress]?.content?.attachments[0];
    if (attachment && attachment.type === 'identityAccess') {
      return mails[mailAddress];
    }
  });

  await runtime1.profile.loadForAccount();
  await runtime1.profile.removeIdentityAccess(from);
  await runtime1.profile.storeForAccount(runtime1.profile.treeLabels.addressBook);

--------------------------------------------------------------------------------


.. _identity_removeWriteAccess:

removeWriteAccess
================================================================================

.. code-block:: typescript

  identity.removeWriteAccess(identity);

Remove a identity from the activeIdentity did (pubKey + authenticiaton) and removes the identity key from the keyholder.

**Note**: It just removes the identity from the did document / the keyHolder and don't send any bmail with any information about the removal. Please use ``removeAccess`` for this.

----------
Parameters
----------

#. ``identity`` - ``string``: identity to remove write access for

-------
Returns
-------

``Promise`` returns ``void`` - resolved when done

-------
Example
-------

.. code-block:: typescript

  await runtime.identity.removeWriteAccess('0x000...2');


.. required for building markup

.. |source contractLoader| replace:: ``ContractLoader``
.. _source contractLoader: ../contracts/contract-loader.html

.. |source did| replace:: ``Did``
.. _source did: ../profile/did.html

.. |source executor| replace:: ``Executor``
.. _source executor: ../blockchain/executor.html

.. |source mailbox| replace:: ``Mailbox``
.. _source mailbox: ../profile/mailbox.html

.. |source nameResolver| replace:: ``NameResolver``
.. _source nameResolver: ../blockchain/name-resolver.html

.. |source profile| replace:: ``profile``
.. _source profile: ../profile/profile.html

.. |source profile| replace:: ``profile``
.. _source profile: ../profile/verifications.html

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: ../common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: ../common/logger.html#logloginterface

.. |source web3| replace:: ``Web3``
.. _source web3: https://github.com/ethereum/web3.js/
