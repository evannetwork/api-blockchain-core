================================================================================
Onboarding
================================================================================

.. list-table::
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - Onboarding
   * - Extends
     - `Logger <../common/logger.html>`_
   * - Source
     - `onboarding.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/onboarding.ts>`_
   * - Examples
     - `onboarding.spec.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/onboarding.spec.ts>`_

The onboarding process is used to enable users to invite other users, where no blockchain account id is known. It allows to send an email to such contacts, that contains a link. This link points to a evan.network ÐApp, that allows accept the invitation by either creating a new account or by accepting it with an existing account.

It uses the `Key Exchange <key-exchange.html>`_ module described in the last section for its underlying key exchange process but moves the process of creating a new communication key to the invited user.

To get in contact with a user via email, a smart agent is used. This smart agent has to be added as a contact and a regular key exchange with the smart agent is performed. The agent accepts the invitation automatically and the inviting user sends a bmail (blockchain mail) with the contact details of the user, that should be invited, and an amount of welcome EVEs to the smart agent.

The onboarding smart creates a session on his end and sends an email to the invited user, that includes the session token, with which the invited user can claim the welcome EVEs.

The invited user now creates or confirms an account and start the key exchange process on his or her end. The rest of the flow is as described in `Key Exchange <key-exchange.html>`_.

To start the process at from the inviting users side, make sure that this user has exchanged keys with the onboarding smart agent.



--------------------------------------------------------------------------------

.. _onboarding_constructor:

constructor
================================================================================

.. code-block:: typescript

  new Onboarding(options);

Creates a new Onboarding instance.

----------
Parameters
----------

#. ``options`` - ``OnboardingOptions``: options for Onboarding constructor
    * ``executor`` - |source executor|_: |source executor|_ instance
    * ``mailbox`` - |source mailbox|_: |source mailbox|_ instance
    * ``smartAgentId`` - ``string``: account id of onboarding smart agent
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``

-------
Returns
-------

``Onboarding`` instance

-------
Example
-------

.. code-block:: typescript

  const onboarding = new Onboarding({
    mailbox,
    smartAgentId: config.smartAgents.onboarding.accountId,
    executor,
  });



--------------------------------------------------------------------------------

.. _onboarding_sendInvitation:

sendInvitation
================================================================================

.. code-block:: typescript

  onboarding.sendInvitation(invitation, weiToSend);

Send invitation to another user via smart agent that sends a mail.

----------
Parameters
----------

#. ``invitation`` - ``invitation``: mail that will be sent to invited person
#. ``weiToSend`` - ``string``: amount of ETC to transfert to new member, can be created with web3.utils.toWei(10, 'ether') [web3 >=1.0] / web.toWei(10, 'ether') [web3 < 1.0]

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await onboarding.sendInvitation({
    fromAlias: 'example inviter',
    to: 'example invitee <example.invitee@evan.network>',
    lang: 'en',
    subject: 'evan.network Onboarding Invitation',
    body: 'I\'d like to welcome you on board.',
  }, web3.utils.toWei('1'));



--------------------------------------------------------------------------------

.. _onboarding_createMnemonic:

createMnemonic
================================================================================

.. code-block:: typescript

  Onboarding.createMnemonic();

(static class function)


Generates a new random Mnemonic

-------
Returns
-------

``string``

-------
Example
-------

To show the difference, without purging:

.. code-block:: typescript

  const mnemnonic = Onboarding.createMnemnonic();
  console.log(mnemnoic);
  // prints out a random 12 word mnemnonic


--------------------------------------------------------------------------------

.. _onboarding_createNewProfile:

createNewProfile
================================================================================

.. code-block:: typescript

  Onboarding.createNewProfile(mnemnonic, password, profileProperties);

(static class function)


Creates a new full blown profile on a given evan network (testcore/core) and returns the mnemonic, password and a configuration for the runtime initalization

----------
Parameters
----------

#. ``mnemnonic`` - ``string``: 12 word mnemnonic as string
#. ``password`` - ``string``: password of the new created profile
#. ``profileProperties`` - ``any``: Properties for the profile to be created

-------
Returns
-------

``Promise`` returns ``any``: object with the mnemonic, password and the config object for the runtime

-------
Example
-------


.. code-block:: typescript

  const originRuntime = await TestUtils.getRuntime(accounts[0]);
  const mnemonic = Onboarding.createMnemonic();
  await Onboarding.createNewProfile(originRuntime, mnemonicNew, 'Test1234', {
      accountDetails: {
          profileType: 'company',
          accountName: 'test account'
      }});

.. required for building markup

.. |source executor| replace:: ``Executor``
.. _source executor: ../blockchain/executor.html

.. |source mailbox| replace:: ``Mailbox``
.. _source mailbox: ../profile/mailbox.html

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: ../common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: ../common/logger.html#logloginterface