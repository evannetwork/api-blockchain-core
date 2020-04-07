================================================================================
Votings
================================================================================

.. list-table::
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - Wallet
   * - Extends
     - `Logger <../common/logger.html>`_
   * - Source
     - `votings.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/votings/votings.ts>`_
   * - Examples
     - `votings.spec.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/votings/votings.spec.ts>`_

The votings helper allows to hold votes over decisions and execute them, if enough votes have been submitted.

The usual flow for proposals has the following steps:

0. if not already created, create a voting contract with :ref:`createContract <votings_createContract>` (this doesn't have to be done when using a central voting contract (e.g. from a well known ENS address))
1. create a proposal for a change with :ref:`createProposal <votings_createProposal>`
2. let participants vote with :ref:`vote <votings_vote>`
3. if enough time has passed and you have enough votes, you can finally execute your proposal with :ref:`execute <votings_execute>`



--------------------------------------------------------------------------------

.. _votings_constructor:

constructor
================================================================================

.. code-block:: typescript

  new Votings(options);

Creates a new Votings instance.

----------
Parameters
----------

#. ``options`` - ``VotingsOptions``: options for Votings constructor.
    * ``contractLoader`` - |source contractLoader|_: |source contractLoader|_ instance
    * ``executor`` - |source executor|_: |source executor|_ instance

-------
Returns
-------

``Votings`` instance

-------
Example
-------

.. code-block:: typescript

  const votings = new Votings({
    contractLoader,
    executor,
  });



--------------------------------------------------------------------------------

= Contract =
============

.. _votings_createContract:

createContract
================================================================================

.. code-block:: typescript

  votings.createContract(creator, votingsContractOptions);

Create new voting contract instance.

----------
Parameters
----------

#. ``creator`` - ``string``: identity or account that should create and own the contract
#. ``votingsContractOptions`` - |source votingscontractoptions|_: additional options for votings contract

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const votingsContract = await votings.createContract(
    '0x1111111111111111111111111111111111111111',
    {
      minimumQuorumForProposals: 2,
      minutesForDebate: 1,
      marginOfVotesForMajority: 0,
    },
  );



--------------------------------------------------------------------------------

= Members =
===========

.. _votings_addMember:

addMember
================================================================================

.. code-block:: typescript

  votings.addMember(votingsContract, votingsOwner, toInvite, memberOptions);

Add member to voting contract.

----------
Parameters
----------

#. ``contract`` - ``string|any``: web3 voting contract instance or contract address
#. ``executingAddress`` - ``string``: identity or account that performs the action (usually the voting owner)
#. ``invitee`` - ``string``: identity or account to add to votings contract
#. ``memberOptions`` - |source memberoptions|_: options for new member

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await votings.addMember(
    '0x00000000000000000000000000000000c0274ac7',
    '0x1111111111111111111111111111111111111111',
    '0x2222222222222222222222222222222222222222',
    { name: 'Member Number 2' },
  );



--------------------------------------------------------------------------------

.. _votings_removeMember:

removeMember
================================================================================

.. code-block:: typescript

  votings.removeMember(votingsContract, votingsOwner, toRemove);

Remove member from votings contract.

----------
Parameters
----------

#. ``contract`` - ``string|any``: web3 voting contract instance or contract address
#. ``remover`` - ``string``: identity or account that performs the action
#. ``removee`` - ``string``: identity or account to remove from votings contract

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await votings.removeMember(
    '0x00000000000000000000000000000000c0274ac7',
    '0x1111111111111111111111111111111111111111',
    '0x2222222222222222222222222222222222222222',
  );



--------------------------------------------------------------------------------

.. _votings_getMemberInfo:

getMemberInfo
================================================================================

.. code-block:: typescript

  votings.getMemberInfo(votingsContract, target);

Get info of a member.

----------
Parameters
----------

#. ``contract`` - ``string|any``: web3 voting contract instance or contract address
#. ``target`` - ``string``: identity or account to get info for

-------
Returns
-------

``Promise`` returns |source memberinfo|_: member info

-------
Example
-------

.. code-block:: typescript

  console.dir(await votings.getMemberInfo(
    '0x00000000000000000000000000000000c0274ac7',
    '0x2222222222222222222222222222222222222222',
  ));
  // Output:
  // {
  //   address: '0x2222222222222222222222222222222222222222',
  //   name: 'Member Number 2',
  //   memberSince: 1544092270556
  // }



--------------------------------------------------------------------------------

.. _votings_isMember:

isMember
================================================================================

.. code-block:: typescript

  votings.isMember(votingsContract, target);

Checks if a given identity or account is member in voting contract.

----------
Parameters
----------

#. ``contract`` - ``string|any``: web3 voting contract instance or contract address
#. ``target`` - ``string``: identity or account to get info for

-------
Returns
-------

``Promise`` returns ``bool``: true if member

-------
Example
-------

.. code-block:: typescript

  console.dir(await votings.isMember(
    '0x00000000000000000000000000000000c0274ac7',
    '0x2222222222222222222222222222222222222222',
  ));
  // Output:
  // true



--------------------------------------------------------------------------------

= Proposals =
=============

.. _votings_createProposal:

createProposal
================================================================================

.. code-block:: typescript

  votings.createProposal(votingsContract, proposalCreator, proposalOptions);

Create a new proposal in votings contract.

----------
Parameters
----------

#. ``contract`` - ``string|any``: web3 voting contract instance or contract address
#. ``proposalCreator`` - ``string``: identity or account to create the proposal
#. ``proposalOptions`` - |source proposaloptions|_: options for proposal

-------
Returns
-------

``Promise`` returns ``string``: id of new proposal

-------
Example
-------

.. code-block:: typescript

  // make a proposal about a suggestion (text only)
  const textProposal = await votings.createProposal(
    '0x00000000000000000000000000000000c0274ac7',
    '0x1111111111111111111111111111111111111111',
    { description: 'Change voting time to 2 hours.' },
  );

  // propose a transaction
  const txProposal = await votings.createProposal(
    '0x00000000000000000000000000000000c0274ac7',
    '0x1111111111111111111111111111111111111111',
    {
      description: 'set data of this contract to "def"',
      data: '0x47064d6a' +
        '0000000000000000000000000000000000000000000000000000000000000020' +
        '0000000000000000000000000000000000000000000000000000000000000003' +
        '6465660000000000000000000000000000000000000000000000000000000000',
      to: '0x000000000000000000000000a2074340c0274ac7',
    },
  );



--------------------------------------------------------------------------------

.. _votings_getProposalCount:

getProposalCount
================================================================================

.. code-block:: typescript

  votings.getProposalCount(contract);

Get number of proposals in votings contract.

----------
Parameters
----------

#. ``contract`` - ``string|any``: web3 voting contract instance or contract address

-------
Returns
-------

``Promise`` returns ``number``: number of proposals

-------
Example
-------

.. code-block:: typescript

  await votings.createProposal(
    '0x00000000000000000000000000000000c0274ac7',
    '0x1111111111111111111111111111111111111111',
    {
      description: 'set data of this contract to "def"',
      data: '0x47064d6a' +
        '0000000000000000000000000000000000000000000000000000000000000020' +
        '0000000000000000000000000000000000000000000000000000000000000003' +
        '6465660000000000000000000000000000000000000000000000000000000000',
      to: '0x000000000000000000000000a2074340c0274ac7',
    },
  );
  const count = await votings.getProposalCount('0x00000000000000000000000000000000c0274ac7');
  console.log(count);
  // Output:
  // 1



--------------------------------------------------------------------------------

.. _votings_getProposalInfo:

getProposalInfo
================================================================================

.. code-block:: typescript

  votings.getProposalInfo(votingsContract, proposalId);

Gets info about a given proposal in contract.

----------
Parameters
----------

#. ``contract`` - ``string|any``: web3 voting contract instance or contract address
#. ``proposalId`` - ``string``: id of proposal to retrieve info for

-------
Returns
-------

``Promise`` returns |source proposalinfo|_: info about proposal

-------
Example
-------

.. code-block:: typescript

  console.dir(await votings.getProposalInfo(
    '0x00000000000000000000000000000000c0274ac7',
    '0',
  ));
  // Output:
  // {
  //   currentResult: '0',
  //   description: 'Change voting time to 2 hours.',
  //   executed: false,
  //   minExecutionDate: 1544093505000,
  //   numberOfVotes: '0',
  //   proposalHash: '0xa86d54e9aab41ae5e520ff0062ff1b4cbd0b2192bb01080a058bb170d84e6457',
  //   proposalPassed: false,
  //   to: '0x0000000000000000000000000000000000000000',
  //   value: '0'
  // }



--------------------------------------------------------------------------------

.. _votings_getProposalInfos:

getProposalInfos
================================================================================

.. code-block:: typescript

  votings.getProposalInfos(contract[, count, offset, reverse]);

Get multiple proposals from votings contract.

----------
Parameters
----------

#. ``contract`` - ``string|any``: web3 voting contract instance or contract address
#. ``count`` - ``number`` (optional): number of items to retrieve, defaults to ``10``
#. ``offset`` - ``number`` (optional): skip this many entries, defaults to ``0``
#. ``reverse`` - ``boolean`` (optional): fetch entries, starting with last entry, defaults to ``true``

-------
Returns
-------

``Promise`` returns |source proposalinfos|_: proposals listing

-------
Example
-------

.. code-block:: typescript

    await votings.createProposal(
    '0x00000000000000000000000000000000c0274ac7',
    '0x1111111111111111111111111111111111111111',
    {
      description: 'set data of this contract to "def"',
      data: '0x47064d6a' +
        '0000000000000000000000000000000000000000000000000000000000000020' +
        '0000000000000000000000000000000000000000000000000000000000000003' +
        '6465660000000000000000000000000000000000000000000000000000000000',
      to: '0x000000000000000000000000a2074340c0274ac7',
    },
  );
  const proposals = await votings.getProposalInfos('0x00000000000000000000000000000000c0274ac7');
  console.log(proposals.results.length);
  // Output:
  // 1



--------------------------------------------------------------------------------

.. _votings_vote:

vote
================================================================================

.. code-block:: typescript

  votings.vote(votingsContract, voter, proposal, accept[, comment]);

Vote for a proposal.

----------
Parameters
----------

#. ``contract`` - ``string|any``: web3 voting contract instance or contract address
#. ``voter`` - ``string``: identity or account that performs the action
#. ``proposal`` - ``string``: id of proposal to vote for
#. ``accept`` - ``boolean``: accept proposal or not
#. ``comment`` - ``string`` (optional): comment for vote, left empty if omitted

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await votings.vote(
    '0x00000000000000000000000000000000c0274ac7',
    '0x2222222222222222222222222222222222222222',
    '1',
    true,
  );



--------------------------------------------------------------------------------

.. _votings_execute:

execute
================================================================================

.. code-block:: typescript

  votings.execute(votingsContract, proposalExecutor, proposal[, data]);

Execute a proposal.

----------
Parameters
----------

#. ``contract`` - ``string|any``: web3 voting contract instance or contract address
#. ``proposalExecutor`` - ``string``: identity or account to execute the proposal
#. ``proposal`` - ``string``: id of proposal to vote for
#. ``data`` - ``string`` (optional): transaction input bytes as string (`0x${functionhash}${argumentsData}`), defaults to ``0x``

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  // execute proposal about a suggestion (text only)
  await votings.execute(
    '0x00000000000000000000000000000000c0274ac7',
    '0x1111111111111111111111111111111111111111',
    '0',
  );

  // execute proposal about a transaction
  await votings.execute(
    '0x00000000000000000000000000000000c0274ac7',
    '0x1111111111111111111111111111111111111111',
    '1',
    '0x47064d6a' +
      '0000000000000000000000000000000000000000000000000000000000000020' +
      '0000000000000000000000000000000000000000000000000000000000000003' +
      '6465660000000000000000000000000000000000000000000000000000000000',
  );

------------------------------------------------------------------------------

= Additional Components =
=========================

Interfaces
==========

.. _votings_MemberInfo:

----------
MemberInfo
----------

#. ``address`` - ``string``: member's identity or account
#. ``name`` - ``string``: description text of member
#. ``memberSince`` - ``string``: date of joining votings contract



.. _votings_MemberOptions:

-------------
MemberOptions
-------------

#. ``name`` - ``string``: description text of member



.. _votings_ProposalInfo:

------------
ProposalInfo
------------

#. ``currentResult`` - ``number``: current number of positive votes
#. ``description`` - ``string``: description text
#. ``executed`` - ``boolean``: true if already executed
#. ``minExecutionData`` - ``number``: earliest day of execution
#. ``numberOfVotes`` - ``number``: number of submitted votes
#. ``proposalHash`` - ``string``: checksum of proposal: keccak256(beneficiary, weiAmount, transactionBytecode)
#. ``proposalPassed`` - ``boolean``: true if executed and proposal passed
#. ``to`` - ``string``: target of proposal (contract/identity/account to send transaction to)
#. ``value`` - ``string``: amount of Wei to send to target



.. _votings_ProposalInfos:

-------------
ProposalInfos
-------------

#. ``results`` - |source proposalinfo_array|_: proposals of current page (length is 10)
#. ``totalCount`` - ``number``: total number of results



.. _votings_ProposalOptions:

---------------
ProposalOptions
---------------

#. ``description`` - ``string``: description text
#. ``data`` - ``string`` (optional): input data for proposal, defaults to ``0x``
#. ``to`` - ``string`` (optional): target of proposal (contract/account to send transaction to),  defaults to ``0x0000000000000000000000000000000000000000``
#. ``value`` - ``string`` (optional): amount of Wei to send to target, defaults to ``0``



.. _votings_VotingsContractOptions:

----------------------
VotingsContractOptions
----------------------

#. ``minimumQuorumForProposals`` - ``number``: votes that must have been given before any proposal is accepted; updates to this may affect running proposals
#. ``minutesForDebate`` - ``number``: time to have passed before a proposal can be accepted; updates to this do not affect running proposals
#. ``marginOfVotesForMajority`` - ``number``: accepting votes that must have been given before any proposal is accepted; updates to this may affect running proposals



.. required for building markup
.. |source contractLoader| replace:: ``ContractLoader``
.. _source contractLoader: ../contracts/contract-loader.html

.. |source executor| replace:: ``Executor``
.. _source executor: ../blockchain/executor.html

.. |source memberinfo| replace:: ``MemberInfo``
.. _source memberinfo: #memberinfo

.. |source memberoptions| replace:: ``MemberOptions``
.. _source memberoptions: #memberoptions

.. |source proposalinfo| replace:: ``ProposalInfo``
.. _source proposalinfo: #proposalinfo

.. |source proposalinfo_array| replace:: ``ProposalInfo[]``
.. _source proposalinfo_array: #proposalinfo

.. |source proposalinfos| replace:: ``ProposalInfos``
.. _source proposalinfos: #proposalinfos

.. |source proposaloptions| replace:: ``ProposalOptions``
.. _source proposaloptions: #proposaloptions

.. |source votingscontractoptions| replace:: ``VotingsContractOptions``
.. _source votingscontractoptions: #votingscontractoptions
