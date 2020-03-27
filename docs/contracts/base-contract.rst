================================================================================
Base Contract
================================================================================

.. list-table::
   :widths: auto
   :stub-columns: 1
   
   * - Class Name
     - BaseContract
   * - Extends
     - `Logger <../common/logger.html>`_
   * - Source
     - `base-contract.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/contracts/base-contract/base-contract.ts>`_
   * - Examples
     - `base-contract.spec.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/contracts/base-contract/base-contract.spec.ts>`_

The `BaseContract <https://github.com/evannetwork/api-blockchain-core/tree/master/src/contracts/base-contract/base-contract.ts>`_ is the base contract class used for

*  :doc:`DataContracts <data-contract>`
* `ServiceContracts <#servicecontract>`_

Contracts, that inherit from ``BaseContracts``, are able to:

* manage a list of contract participants (called "members")
* manage the own state (a flag, that indicate its own life cycle status)
* manage members state (a flag, that indicate the members state in the contract)

What members can do, what non-members cannot do depends of the implementatin of the inheriting contracts.


--------------------------------------------------------------------------------

.. _base-contract_constructor:

constructor
================================================================================

.. code-block:: typescript

  new BaseContract(options);

Creates a new BaseContract instance.

----------
Parameters
----------

#. ``options`` - ``BaseContractOptions``: options for BaseContract constructor.
    * ``executor`` - |source executor|_: |source executor|_ instance
    * ``loader`` - |source contractLoader|_: |source contractLoader|_ instance
    * ``nameResolver`` - |source nameResolver|_: |source nameResolver|_ instance
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``

-------
Returns
-------

``BaseContract`` instance

-------
Example
-------

.. code-block:: typescript
  
  const baseContract = new BaseContract({
    executor,
    loader,
    nameResolver,
  });


.. _base-contract_createUninitialized:

createUninitialized
================================================================================

.. code-block:: typescript

    baseContract.createUninitialized(factoryName, accountId[, businessCenterDomain, descriptionDfsHash]);

Create new contract but do not initialize it yet.

The API supports creating contracts, that inhert from ``BaseContract``. This is done by calling the respective factory. The factory calls are done via a function with this interface:

.. code-block:: typescript

  /// @notice create new contract instance
  /// @param businessCenter address of the BusinessCenter to use or 0x0
  /// @param provider future owner of the contract
  /// @param _contractDescription DBCP definition of the contract
  /// @param ensAddress address of the ENS contract
  function createContract(
      address businessCenter,
      address provider,
      bytes32 contractDescription,
      address ensAddress) public returns (address);

The API supports creating contracts with this function. Contracts created this way may not be ready to use and require an additional function at the contract to be called before usage. This function is usually called ``init`` and its arguments and implementation depends of the specific contract.

The ``createUninitialized`` function performs a lookup for the respective factory contract and calls the ``createContract`` function at it.

----------
Parameters
----------

#. ``factoryName`` - ``string``: contract factory name, used for ENS lookup; if the factory name contains periods, it is threaded as an absolute ENS domain and used as such, if not it will be used as ``${factoryName}.factory.${businessCenterDomain}``
#. ``accountId`` - ``string``: identity or account to create contract with
#. ``businessCenterDomain`` - ``string`` (optional): business center in which the contract will be created; use ``null`` when working without business center
#. ``descriptionDfsHash`` - ``string`` (optional): bytes32 hash for description in dfs

-------
Returns
-------

``Promise`` returns ``string``: Ethereum id of new contract

-------
Example
-------

.. code-block:: typescript

  const contractOwner = '0x...';
  const businessCenterDomain = 'testbc.evan';
  const contractId = await baseContract.createUninitialized(
    'testdatacontract',                   // factory name
    contractOwner,                        // account, that will be owner of the new contract
    businessCenterDomain,                 // business center, where the new contract will be created
  );


--------------------------------------------------------------------------------

.. _base-contract_inviteToContract:

inviteToContract
================================================================================

.. code-block:: javascript

    baseContract.inviteToContract(businessCenterDomain, contract, inviterId, inviteeId);

Invite user to contract.
To allow accounts to work with contract resources, they have to be added as members to the contract. This function does exactly that.


----------
Parameters
----------

#. ``businessCenterDomain`` - ``string`` : ENS domain name of the business center the contract was created in; use null when working without business center
#. ``contract`` - ``string`` : Ethereum id of the contract
#. ``inviterId`` - ``string`` : identity or account id of inviting user
#. ``inviteeId`` - ``string`` : identity or account id of invited user

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: javascript

  const contractOwner = '0x0000000000000000000000000000000000000001';
  const invitee = '0x0000000000000000000000000000000000000002';
  const businessCenterDomain = 'testbc.evan';
  const contract = loader.loadContract('BaseContractInterface', contractId);
  await baseContract.inviteToContract(
    businessCenterDomain,
    contractId,
    contractOwner,
    invitee,
  );


To check if an account is a member of a contract, the contract function ``isMember`` can be used:

.. code-block:: typescript

  const isMember = await executor.executeContractCall(contract, 'isConsumer', invitee);
  console.log(isMember);
  // Output:
  // true


--------------------------------------------------------------------------------

.. _base-contract_removeFromContract:

removeFromContract
================================================================================

.. code-block:: javascript

    baseContract.removeFromContract(businessCenterDomain, contract, accountId, idToBeRemoved);

Remove user from contract.
To deny previously invited accounts to work with contract resources, they have to be removed as members from the contract. This function does exactly that.


----------
Parameters
----------

#. ``businessCenterDomain`` - ``string`` : ENS domain name of the business center the contract was created in; use null when working without business center
#. ``contract`` - ``string`` : Ethereum id of the contract
#. ``accountId`` - ``string`` : identity or account id of executing user
#. ``idToBeRemoved`` - ``string`` : identity or account id which should be removed

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: javascript

  const contractOwner = '0x0000000000000000000000000000000000000001';
  const idToBeRemoved = '0x0000000000000000000000000000000000000002';
  const businessCenterDomain = 'testbc.evan';
  const contract = loader.loadContract('BaseContractInterface', contractId);
  await baseContract.removeFromContract(
    businessCenterDomain,
    contractId,
    contractOwner,
    idToBeRemoved,
  );


To check if an account is a member of a contract, the contract function ``isMember`` can be used:

.. code-block:: typescript

  const isMember = await executor.executeContractCall(contract, 'isConsumer', idToBeRemoved);
  console.log(isMember);
  // Output:
  // false


--------------------------------------------------------------------------------

.. _base-contract_changeConsumerState:

changeConsumerState
===================

.. code-block:: javascript

    baseContract.changeContractState(contract, accountId, consumerId, state);

set state of a consumer.
A members state reflects this members status in the contract. These status values can for example be be Active, Draft or Terminated.

----------
Parameters
----------

#. ``contract`` - ``string|any``: contract instance or contract id
#. ``accountId`` - ``string``: identity or account which will change state
#. ``consumerId`` - ``string``: identity or account whose state will change
#. ``state`` - |source consumerState|_: new state

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: javascript

  await baseContract.changeConsumerState(contractId, accountId, consumerId, ConsumerState.Active);

|source consumerState|_ is an enum in the BaseContract class, that holds the same state values as the `BaseContract.sol <https://github.com/evannetwork/smart-contracts/blob/master/contracts/BaseContract.sol>`_. Alternatively integer values matching the enum in `BaseContractInterface.sol <https://github.com/evannetwork/smart-contracts/blob/master/contracts/BaseContractInterface.sol>`_ can be used.



--------------------------------------------------------------------------------

.. _base-contract_changeContractState:

changeContractState
=====================

.. code-block:: javascript

    baseContract.changeContractState(contract, accountId, state);

Set state of the contract.
The contracts state reflects the current state and how other members may be able to interact with it. So for example, a contract for tasks cannot have its tasks resolved, when the contract is still in Draft state. State transitions are limited to configured roles and allow going from one state to another only if configured for this role.

----------
Parameters
----------

#. ``contract`` - ``string|any``: contract instance or contract id
#. ``accountId`` - ``string``: identity or account which will change state
#. ``state`` - |source contractState|_: new state

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await baseContract.changeContractState(contractId, contractOwner, ContractState.Active);


|source contractState|_ is an enum in the BaseContract class, that holds the same state values as the `BaseContract.sol <https://github.com/evannetwork/smart-contracts/blob/master/contracts/BaseContract.sol>`_. Alternatively integer values matching the enum in `BaseContractInterface.sol <https://github.com/evannetwork/smart-contracts/blob/master/contracts/BaseContractInterface.sol>`_ can be used.



------------------------------------------------------------------------------

Additional Components
======================

-----
Enums
-----

.. _base-contract_ContractState:

ContractState
^^^^^^^^^^^^^

Describes contracts overall state.

In most cases, this property can only be set by the contract owner.

.. code-block:: typescript

  export enum ContractState {
    Initial,
    Error,
    Draft,
    PendingApproval,
    Approved,
    Active,
    VerifyTerminated,
    Terminated,
  };

.. _base-contract_ConsumerState:

ConsumerState
^^^^^^^^^^^^^

Describes the state of a consumer or owner in a contract.

In most cases, this can be set the the member, thats status is updated or by a more privileged role, like a contract owner.

.. code-block:: typescript

  export enum ConsumerState {
    Initial,
    Error,
    Draft,
    Rejected,
    Active,
    Terminated
  };



.. required for building markup

.. |source consumerState| replace:: ``ConsumerState``
.. _source consumerState: ../contracts/base-contract.html#base-contract-consumerstate

.. |source contractLoader| replace:: ``ContractLoader``
.. _source contractLoader: ../contracts/contract-loader.html

.. |source contractState| replace:: ``ContractState``
.. _source contractState: ../contracts/base-contract.html#base-contract-contractstate

.. |source executor| replace:: ``Executor``
.. _source executor: ../blockchain/executor.html

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: ../common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: ../common/logger.html#logloginterface

.. |source nameResolver| replace:: ``NameResolver``
.. _source nameResolver: ../blockchain/name-resolver.html
