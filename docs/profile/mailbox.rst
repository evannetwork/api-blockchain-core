================================================================================
Mailbox
================================================================================

.. list-table::
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - Mailbox
   * - Extends
     - `Logger <../common/logger.html>`_
   * - Source
     - `mailbox.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/mailbox.ts>`_
   * - Examples
     - `mailbox.spec.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/mailbox.spec.ts>`_

The `Mailbox <https://github.com/evannetwork/api-blockchain-core/blob/develop/src/mailbox.ts>`_ module is used for sending and retrieving bmails (blockchain mails) to other even.network members. Sending regular bmails between to parties requires them to have completed a `Key Exchange <key-exchange.html>`_ before being able to send encrypted messages. When exchanging the keys, bmails are encrypted with a commonly known key, that is only valid is this case and the underlying messages, that contain the actual keys are encrypted with Diffie Hellman keys, to ensure, that keys are exchanged in a safe manner (see `Key Exchange <key-exchange.html>`_ for details).

The mailbox is a `smart contract <https://github.com/evannetwork/smart-contracts-core/blob/master/contracts/MailBoxInterface.sol>`_, that holds

- ``bytes32`` hashes, that are the encrypted contents of the mails
- basic metadata about the mails, like

  + recipient of a mail
  + sender of a mail
  + amount of EVEs, that belongs to the bmail

- if the mail is an answer to another mail, the reference to the original mail



--------------------------------------------------------------------------------

.. _mailbox_constructor:

constructor
================================================================================

.. code-block:: typescript

  new Mailbox(options);

Creates a new Mailbox instance.

Instances created with the constructor are **not usable** right from the start. They require the :ref:`init() <mailbox_init>` function to be called, before they are ready to use.

----------
Parameters
----------

#. ``options`` - ``MailboxOptions``: options for Mailbox constructor.
    * ``contractLoader`` - |source contractLoader|_: |source contractLoader|_ instance
    * ``cryptoProvider`` - |source cryptoProvider|_: |source cryptoProvider|_ instance
    * ``defaultCryptoAlgo`` - ``string``: crypto algorith name from |source cryptoProvider|_
    * ``ipfs`` - |source ipfs|_: |source ipfs|_ instance
    * ``keyProvider`` - |source keyProviderInterface|_: |source keyProviderInterface|_ instance
    * ``mailboxOwner`` - ``string``: account, that will be used, when working with the mailbox
    * ``nameResolver`` - |source nameResolver|_: |source nameResolver|_ instance
    * ``executor`` - |source executor|_ (optional): |source executor|_ instance
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``

-------
Returns
-------

``Mailbox`` instance

-------
Example
-------

.. code-block:: typescript

  const mailbox = new Mailbox({
    mailboxOwner,
    nameResolver,
    ipfs,
    contractLoader,
    cryptoProvider,
    keyProvider,
    defaultCryptoAlgo: 'aes',
  });
  await mailbox.init();



--------------------------------------------------------------------------------

.. _mailbox_init:

init
================================================================================

.. code-block:: typescript

  mailbox.init();

Initialize mailbox module.

This function needs to be called, before the mailbox module can be used.

----------
Parameters
----------

(none)

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const mailbox = new Mailbox({
    mailboxOwner,
    nameResolver,
    ipfs,
    contractLoader,
    cryptoProvider,
    keyProvider,
    defaultCryptoAlgo: 'aes',
  });
  await mailbox.init();



--------------------------------------------------------------------------------

.. _mailbox_sendMail:

sendMail
================================================================================

.. code-block:: typescript

  mailbox.sendMail(mail, from, to[, value, context]);

Sends a mail to given target.

----------
Parameters
----------

#. ``mail`` - ``Mail``: a mail to send
#. ``from`` - ``string``: sender identity or account
#. ``to`` - ``string``: receiver identity or account
#. ``value`` - ``string`` (optional): amount of EVEs to send with mail in Wei, can be created with ``web3[.utils].toWei(...)``, defaults to ``0``
#. ``context`` - ``string`` (optional): encryption context for bmail, if a special context should be used (e.g. ``keyExchange``)

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  // account, that sends the mail
  const account1 = '0x0000000000000000000000000000000000000001';
  // account, that receives the mail
  const account2 = '0x0000000000000000000000000000000000000002';
  // mailbox of the sender
  const mailbox1 = {};
  // mailbox of the receiver
  const mailbox2 = {};

  const bmail = {
    content: {
      from: account1,
      to,
      title: 'Example bmail',
      body: 'This is a little example to demonstrate sending a bmail.',
      attachments: [ ]
    }
  };
  await mailbox1.sendMail(bmail, account1, account2);



--------------------------------------------------------------------------------

.. _mailbox_sendAnswer:

sendAnswer
================================================================================

.. code-block:: typescript

  mailbox.sendAnswer(mail, from, to[, value, context]);

Send answer to a mail.

----------
Parameters
----------

#. ``mail`` - ``Mail``: a mail to send, ``mail.parentId`` must be set to mailId of mail, that is answered
#. ``from`` - ``string``: account id to send mail from
#. ``to`` - ``string``: account id to send mail to
#. ``value`` - ``string`` (optional): amount of EVEs to send with mail in Wei, can be created with ``web3[.utils].toWei(...)``, defaults to ``0``
#. ``context`` - ``string`` (optional): encryption context for bmail, if a special context should be used (e.g. ``keyExchange``)

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  // account, that sends the answer
  const account1 = '0x0000000000000000000000000000000000000001';
  // account, that receives the answer
  const account2 = '0x0000000000000000000000000000000000000002';
  // mailbox of the sender
  const mailbox1 = {};
  // mailbox of the receiver
  const mailbox2 = {};

  const bmail = {
    content: {
      from: account1,
      to,
      title: 'Example bmail',
      body: 'This is a little example to demonstrate sending a bmail.',
      attachments: [ ]
    },
    parentId: '0x0000000000000000000000000000000000000000000000000000000000000012',
  };
  await mailbox1.sendAnswer(bmail, account1, account2);



--------------------------------------------------------------------------------

.. _mailbox_getMails:

getMails
================================================================================

.. code-block:: typescript

  mailbox.getMails([count, offset, type]);

Gets the last n mails, resolved contents.

----------
Parameters
----------

#. ``count`` - ``number`` (optional): retrieve up to this many answers (for paging), defaults to ``10``
#. ``offset`` - ``number`` (optional): skip this many answers (for paging), defaults to ``0``
#. ``type`` - ``string`` (optional): retrieve sent or received mails, defaults to ``'Received'``

-------
Returns
-------

``Promise`` returns ``any``: resolved mails

-------
Example
-------

.. code-block:: typescript

  const received = await mailbox2.getMails();
  console.dir(JSON.stringify(received[0], null, 2));
  // Output:
  // {
  //   "mails": {
  //     "0x000000000000000000000000000000000000000e": {
  //       "content": {
  //         "from": "0x0000000000000000000000000000000000000001",
  //         "to": "0x0000000000000000000000000000000000000002",
  //         "title": "Example bmail",
  //         "body": "This is a little example to demonstrate sending a bmail.",
  //         "attachments": [ ],
  //         "sent": 1527083983148
  //       },
  //       "cryptoInfo": {
  //         "originator": "0x549704d235e1fe5cd7326a1eb0c44c1e0a5434799ba6ff2370c2955730b66e2b",
  //         "keyLength": 256,
  //         "algorithm": "aes-256-cbc"
  //       }
  //     }
  //   },
  //   "totalResultCount": 9
  // }

Results can be paged with passing arguments for page size and offsetto the ``getMails`` function:

.. code-block:: typescript

  const received = await mailbox2.getMails(3, 0);
  console.dir(JSON.stringify(received[0], null, 2));
  // Output:
  // { mails:
  //    { '0x000000000000000000000000000000000000000e': { content: [Object], cryptoInfo: [Object] },
  //      '0x000000000000000000000000000000000000000d': { content: [Object], cryptoInfo: [Object] },
  //      '0x000000000000000000000000000000000000000c': { content: [Object], cryptoInfo: [Object] } },
  //   totalResultCount: 9 }

To get bmails *sent* by an account, use (the example account hasn't sent any bmail yet):

.. code-block:: typescript

  const received = await mailbox2.getMails(3, 0, 'Sent');
  console.dir(JSON.stringify(received[0], null, 2));
  // Output:
  // { mails: {}, totalResultCount: 0 }



--------------------------------------------------------------------------------

.. _mailbox_getMail:

getMail
================================================================================

.. code-block:: typescript

  mailbox.getMail(mail);

Gets one single mail directly.

----------
Parameters
----------

#. ``mail`` - ``string``: mail to resolve (mailId or hash)

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const mailId = '0x0000000000000000000000000000000000000000000000000000000000000012';
  const bmail = await mailbox.getMail(mailId);



--------------------------------------------------------------------------------

.. _mailbox_getAnswersForMail:

getAnswersForMail
================================================================================

.. code-block:: typescript

  mailbox.getAnswersForMail(mailId[, count, offset]);

Gets answer tree for mail, traverses subanswers as well.

----------
Parameters
----------

#. ``mailId`` - ``string``: mail to resolve
#. ``count`` - ``number`` (optional): retrieve up to this many answers, defaults to ``5``
#. ``offset`` - ``number`` (optional): skip this many answers, defaults to ``0``

-------
Returns
-------

``Promise`` returns ``any``: answer tree for mail

-------
Example
-------

.. code-block:: typescript

  const mailId = '0x0000000000000000000000000000000000000000000000000000000000000012';
  const answers = await mailbox.getAnswersForMail(mailId);



--------------------------------------------------------------------------------

.. _mailbox_getBalanceFromMail:

getBalanceFromMail
================================================================================

.. code-block:: typescript

  mailbox.getBalanceFromMail(mailId);

Returns amount of EVE deposited for a mail.

Bmails can contain EVEs for the recipient as well. Because retrieving bmails is a reading operation, funds send with a bmail have to be retrieved separately.

----------
Parameters
----------

#. ``mailId`` - ``string``: mail to resolve

-------
Returns
-------

``Promise`` returns ``string``: balance of the mail in Wei, can be converted with web3[.utils].fromWei(...)

-------
Example
-------

.. code-block:: typescript

  const bmail = {
    content: {
      from: account1,
      to,
      title: 'Example bmail',
      body: 'This is a little example to demonstrate sending a bmail.',
      attachments: [ ]
    }
  };
  await mailbox1.sendMail(bmail, account1, account2, web3.utils.toWei('0.1', 'Ether'));
  const received = await mailbox2.getMails(1, 0);
  const mailBalance = await mailbox2.getBalanceFromMail(Object.keys(received)[0]);
  console.log(mailBalance);
  // Output:
  // 100000000000000000



--------------------------------------------------------------------------------

.. _mailbox_withdrawFromMail:

withdrawFromMail
================================================================================

.. code-block:: typescript

  mailbox.withdrawFromMail(mailId, recipient);

Funds from bmails can be claimed with the account, that received the bmail. Funds are transferred to a specified account, which can be the claiming account or another account of choice.

----------
Parameters
----------

#. ``mailId`` - ``string``: mail to resolve
#. ``recipient`` - ``string``: account, that receives the EVEs

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const received = await mailbox2.getMails(1, 0);
  const mailBalance = await mailbox2.getBalanceFromMail(Object.keys(received)[0]);
  console.log(mailBalance);
  // Output:
  // 100000000000000000
  await mailbox2.withdrawFromMail(received)[0], accounts2);
  const mailBalance = await mailbox2.getBalanceFromMail(Object.keys(received)[0]);
  console.log(mailBalance);
  // Output:
  // 0



.. required for building markup

.. |source contractLoader| replace:: ``ContractLoader``
.. _source contractLoader: ../contracts/contract-loader.html

.. |source cryptoProvider| replace:: ``CryptoProvider``
.. _source cryptoProvider: ../encryption/crypto-provider.html

.. |source executor| replace:: ``Executor``
.. _source executor: ../blockchain/executor.html

.. |source ipfs| replace:: ``Ipfs``
.. _source ipfs: ../dfs/ipfs.html

.. |source keyProviderInterface| replace:: ``KeyProviderInterface``
.. _source keyProviderInterface: ../encryption/key-provider.html

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: ../common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: ../common/logger.html#logloginterface

.. |source nameResolver| replace:: ``NameResolver``
.. _source nameResolver: ../blockchain/name-resolver.html
