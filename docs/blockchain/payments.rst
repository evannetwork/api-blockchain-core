================================================================================
Payments
================================================================================

.. list-table::
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - Payments
   * - Extends
     - `Logger <../common/logger.html>`_
   * - Source
     - `payments.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/payments.ts>`_
   * - Examples
     - `payments.spec.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/payments.spec.ts>`_

Payments are a Service to open unidirectional payment channels to other accounts. You can open a payment channel to another account and do some micropayments offchain.

The heart of the system lies in its sender -> receiver off-chain transactions. They offer a secure way to keep track of the last verified channel balance. The channel balance is calculated each time the sender pays for a resource. He is prompted to sign a so-called balance proof, i.e., a message that provably confirms the total amount of transferred tokens. This balance proof is then sent to the receiver’s server. If the balance proof checks out after comparing it with the last received balance and verifying the sender’s signature, the receiver replaces the old balance value with the new one.


--------------------------------------------------------------------------------

.. _payments_constructor:

constructor
================================================================================

.. code-block:: typescript

  new Payments(options);

Creates a new Payments instance.

----------
Parameters
----------

#. ``options`` - ``PaymentOptions``: options for Votings constructor.
    * ``accountStore`` - |source accountStore|_: |source accountStore|_ instance
    * ``contractLoader`` - |source contractLoader|_: |source contractLoader|_ instance
    * ``executor`` - |source executor|_: |source executor|_ instance
    * ``web3`` - |source web3|_: |source web3|_ instance


-------
Returns
-------

``Payments`` instance

-------
Example
-------

.. code-block:: typescript

  const payments = new Payments({
    accountStore,
    contractLoader,
    executor,
    web3,
  });



.. _payments_closeChannel:

closeChannel
================================================================================

.. code-block:: typescript

  payments.closeChannel(closingSig);

Closes a given payment channel, when a closing signature is available, the channel will be closed cooperately, otherwise the the channel will be close uncooperately and the sender or receiver has to wait a given amount of blocks (500) to get the funds out of the payment channel

----------
Parameters
----------

#. ``closingSig`` - ``string`` (optional): Cooperative-close signature from receiver

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await payments.closeChannel('0x00000000000000000000000000000000c0274ac7');



--------------------------------------------------------------------------------

.. _payments_confirmPayment:

confirmPayment
================================================================================

.. code-block:: typescript

  payments.confirmPayment(proof);

Persists next_proof to proof. This method must be used after successful payment request, or right after signNewProof is resolved, if implementation don't care for request status

----------
Parameters
----------

#. ``proof`` - |source microproof|_: given microproof object after calling incrementBalanceAndSign

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  payments.confirmPayment({
    balance: 1,
    sig: '0x1234567899'
  });



--------------------------------------------------------------------------------

.. _payments_getChannelInfo:

getChannelInfo
================================================================================

.. code-block:: typescript

  payments.getChannelInfo(channel);

Get channel details such as current state (one of opened, closed or settled), block in which it was set and current deposited amount

----------
Parameters
----------

#. ``channel`` - |source microchannel|_: Channel to get info from. Default to channel

-------
Returns
-------

``Promise`` returns |source microchannelinfo|_: member info

-------
Example
-------

.. code-block:: typescript

  await payments.getChannelInfo();



--------------------------------------------------------------------------------

.. _payments_getChallengePeriod:

getChallengePeriod
================================================================================

.. code-block:: typescript

  payments.getChallengePeriod();

Get contract's configured challenge's period. As it calls the contract method, can be used for validating that contract's address has code in current network

----------
Parameters
----------

-------
Returns
-------

``Promise`` returns ``number``: challenge period number, in blocks

-------
Example
-------

.. code-block:: typescript

  console.dir(await payments.getChallengePeriod());
  // Output:
  // 500



--------------------------------------------------------------------------------

.. _payments_getClosingSig:

getClosingSig
================================================================================

.. code-block:: typescript

  payments.getClosingSig(signerId);

Get the closing balance signature signed from the defined account. This signature can be used to transfer it from the recevier to the sender when the sender wants to close the payment channel. Otherwise when the receiver wants to close the channel cooperative he uses the closign signature to close th channel directly.

----------
Parameters
----------

#. ``signerId`` - ``string``: identity or account which should sign the closing signature (mostly the current active identity/account)

-------
Returns
-------

``Promise`` returns ``string``: signed closing signature

-------
Example
-------

.. code-block:: typescript

  console.dir(await payments.getClosingSig(account));
  // Output:
  // 0x1234567890ABCDEF


--------------------------------------------------------------------------------

.. _payments_isChannelValid:

isChannelValid
================================================================================

.. code-block:: typescript

  payments.isChannelValid(channel);

Health check for currently configured channel info

----------
Parameters
----------

#. ``channel`` - |source microchannel|_: Channel to get info from. Default to channel

-------
Returns
-------

``boolean``: True if channel is valid, false otherwise

-------
Example
-------

.. code-block:: typescript

  console.dir(payments.isChannelValid(channel));
  // Output:
  // True


--------------------------------------------------------------------------------

.. _payments_incrementBalanceAndSign:

incrementBalanceAndSign
================================================================================

.. code-block:: typescript

  payments.incrementBalanceAndSign(amount);

Ask user for signing a payment, which is previous balance incremented of amount. Warnings from signNewProof applies.

----------
Parameters
----------

#. ``amount`` - ``BigNumber|string``: Amount to increment in current balance

-------
Returns
-------

``Promise`` returns ``string``: signed signature

-------
Example
-------

.. code-block:: typescript

  console.dir(await payments.incrementBalanceAndSign(new BigNumber(1)));
  // Output:
  // 0x1234567890ABCDEF


--------------------------------------------------------------------------------

.. _payments_loadChannelFromBlockchain:

loadChannelFromBlockchain
================================================================================

.. code-block:: typescript

  payments.loadChannelFromBlockchain(sender, receiver);

Scan the blockchain for an open channel, and load it with 0 balance. The 0 balance may be overwritten with setBalance if server replies with a updated balance on first request. It should ask user for signing the zero-balance proof. Throws/reject if no open channel was found. Additionally a starting block can be provided to avoid starting from block 0 when looking for payment channels.

----------
Parameters
----------

#. ``sender`` - ``string``: identity or account of sender/client
#. ``receiver`` - ``string``: Receiver/server's account address
#. ``startBlock`` - ``number`` (optional): block to start scanning for transactions, defaults to ``0``

-------
Returns
-------

``Promise`` returns |source microchannel|_: channel info, if a channel was found

-------
Example
-------

.. code-block:: typescript

  await payments.loadChannelFromBlockchain('0x2222222222222222222222222222222222222222', '0x2222222222222222222222222222222222222223');


--------------------------------------------------------------------------------

.. _payments_openChannel:

openChannel
================================================================================

.. code-block:: typescript

  payments.openChannel(account, receiver, deposit);

Open a channel for account to receiver, depositing some EVE on it. Replaces current channel data

----------
Parameters
----------

#. ``account`` - ``string``: Sender/client's identity or account
#. ``receiver`` - ``string``: Receiver/server's account address
#. ``deposit`` - ``BigNumber|string``: deposit in WEI

-------
Returns
-------

``Promise`` returns |source microchannel|_: channel info

-------
Example
-------

.. code-block:: typescript

  await payments.openChannel('0x2222222222222222222222222222222222222222', '0x2222222222222222222222222222222222222223', new BigNumber(5));


--------------------------------------------------------------------------------

.. _payments_setChannelManager:

setChannelManager
================================================================================

.. code-block:: typescript

  payments.setChannelManager(channelManager);

sets a new channelmanager contract to the current instance

----------
Parameters
----------

#. ``channelManager`` - ``string``: the new channelmanager address

-------
Returns
-------

void

-------
Example
-------

.. code-block:: typescript

  payments.setChannelManager('0x2222222222222222222222222222222222222222');


--------------------------------------------------------------------------------

.. _payments_setChannel:

setChannel
================================================================================

.. code-block:: typescript

  payments.setChannel(channel);

Set channel info. Can be used to externally [re]store an externally persisted channel info

----------
Parameters
----------

#. ``channelManager`` - |source microchannel|_: Channel info to be set

-------
Returns
-------

void

-------
Example
-------

.. code-block:: typescript

  payments.setChannel({
    account: '0x1234',
    receiver: '0x1234'
    block: 12346,
    proof: {
      balance: 1,
      sig: '0x12345677899'
    }
  });


--------------------------------------------------------------------------------

.. _payments_signNewProof:

signNewProof
================================================================================

.. code-block:: typescript

  payments.signNewProof(proof);

Ask user for signing a channel balance. Notice it's the final balance, not the increment, and that the new balance is set in next_proof, requiring a confirmPayment call to persist it, after successful request.

Implementation can choose to call confirmPayment right after this call resolves, assuming request will be successful after payment is signed.

----------
Parameters
----------

#. ``proof`` - |source microproof|_ (optional): Balance proof to be signed

-------
Returns
-------

``Promise`` returns |source microproof|_: signature

-------
Example
-------

.. code-block:: typescript

  payments.signNewProof({
    balance: 1,
    sig: '0x12345677899'
  });


--------------------------------------------------------------------------------


.. _payments_signMessage:

signMessage
================================================================================

.. code-block:: typescript

  payments.signMessage(msg);

Ask user for signing a string with eth_accounts_sign

----------
Parameters
----------

#. ``msg`` - ``string``: Data to be signed

-------
Returns
-------

``Promise`` returns ``string``: signed data

-------
Example
-------

.. code-block:: typescript

  await payments.signMessage('This is a message');


--------------------------------------------------------------------------------

.. _payments_topUpChannel:

topUpChannel
================================================================================

.. code-block:: typescript

  payments.topUpChannel(deposit);

Top up current channel, by depositing some [more] EVE to it

----------
Parameters
----------

#. ``deposit`` - ``BigNumber|string``: EVE (in wei) to be deposited in the channel

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await payments.topUpChannel(new BigNumber(5));

------------------------------------------------------------------------------

= Additional Components =
=========================

Interfaces
==========

.. _payments_MicroProof:

----------
MicroProof
----------

#. ``balance`` - ``BigNumber``: balance value
#. ``sig`` - ``string`` (optional): balance signature


.. _payments_MicroChannel:

------------
MicroChannel
------------

#. ``account`` - ``string``: Sender/client's account address
#. ``receiver`` - ``string``: Receiver/server's account address
#. ``block`` - ``number``: Open channel block number
#. ``proof`` - |source microproof|_: Current balance proof
#. ``next_proof`` - |source microproof|_ (optional): Next balance proof, persisted with confirmPayment
#. ``closing_sig`` - ``string`` (optional): Cooperative close signature from receiver


.. _payments_MicroChannelInfo:

----------------
MicroChannelInfo
----------------

#. ``state`` - ``string``: Current channel state, one of 'opened', 'closed' or 'settled'
#. ``block`` - ``number``: Block of current state (opened=open block number, closed=channel close requested block number, settled=settlement block number)
#. ``deposit`` - ``BigNumber``: Current channel deposited sum
#. ``withdrawn`` - ``BigNumber``: Value already taken from the channel



.. required for building markup

.. |source contractLoader| replace:: ``ContractLoader``
.. _source contractLoader: ../contracts/contract-loader.html

.. |source executor| replace:: ``Executor``
.. _source executor: ../blockchain/executor.html

.. |source accountStore| replace:: ``AccountStore``
.. _source accountStore: ../blockchain/account-store.html

.. |source microproof| replace:: ``MicroProof``
.. _source microproof: #microproof

.. |source microchannel| replace:: ``MicroChannel``
.. _source microchannel: #microchannel

.. |source microchannelinfo| replace:: ``MicroChannelInfo``
.. _source microchannelinfo: #microchannelinfo

.. |source web3| replace:: ``Web3``
.. _source web3: https://github.com/ethereum/web3.js/
