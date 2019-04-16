================================================================================
Rights and Roles
================================================================================

.. list-table:: 
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - RightsAndRoles
   * - Extends
     - `Logger <../common/logger.html>`_
   * - Source
     - `rights-and-roles.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/contracts/rights-and-roles.ts>`_
   * - Examples
     - `rights-and-roles.spec.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/contracts/rights-and-roles.spec.ts>`_

The `RightsAndRoles <https://github.com/evannetwork/api-blockchain-core/tree/master/src/contracts/rights-and-roles.ts>`_ module follows the approach described in the evan.network wik at:

- `Function Permissions <https://evannetwork.github.io/dev/security#function-permissions>`_
- `Operation Permissions <https://evannetwork.github.io/dev/security#operations-permissions>`_

It allows to manage permissions for contracts, that use the authority `DSRolesPerContract.sol <https://github.com/evannetwork/smart-contracts/blob/master/contracts/DSRolesPerContract.sol>`_ for as its permission approach. 

Contracts, that use `DSRolesPerContract <https://github.com/evannetwork/smart-contracts/blob/master/contracts/DSRolesPerContract.sol>`_ and therefore allow to configure its permissions with the ``RightsAndRoles`` module are:

- `BaseContract <https://github.com/evannetwork/smart-contracts/blob/master/contracts/BaseContract.sol>`_
- `DataContract <https://github.com/evannetwork/smart-contracts/blob/master/contracts/DataContract.sol>`_
- `ServiceContract <https://github.com/evannetwork/smart-contracts/blob/master/contracts/ServiceContract.sol>`_
- `Shared <https://github.com/evannetwork/smart-contracts/blob/master/contracts/Shared.sol>`_
- `Described <https://github.com/evannetwork/smart-contracts/blob/master/contracts/Described.sol>`_
- `BusinessCenter <https://github.com/evannetwork/smart-contracts/blob/master/contracts/BusinessCenter.sol>`_

Also have a look at the  `Smart Contract Permissioning <https://evannetwork.github.io/docs/developers/concepts/contract_permissioning.html>`_ section in the evan.network wiki.

------------------------------------------------------------------------------

.. _rights-and-roles_constructor:

constructor
================================================================================

.. code-block:: typescript

  new RightsAndRole(options);

Creates new RightsAndRole instance.

----------
Parameters
----------

#. ``options`` - ``RightsAndRolesOptions``: options for RightsAndRole constructor.
    * ``contractLoader`` - |source contractLoader|_: |source contractLoader|_ instance
    * ``executor`` - |source executor|_: |source executor|_ instance
    * ``nameResolver`` - |source nameResolver|_: |source nameResolver|_ instance
    * ``web3`` - |source web3|_: |source web3|_ instance
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``

-------
Returns
-------

``RightsAndRoles`` instance

-------
Example
-------

.. code-block:: typescript
  
  const rightsAndRoles = new RightsAndRoles({
    contractLoader,
    executor,
    nameResolver,
    web3,
  });


--------------------------------------------------------------------------------

.. _rights-and-roles_addAccountToRole:

addAccountToRole
================================================================================

.. code-block:: typescript

  rightsAndRoles.addAccountToRole(contract, accountId, targetAccountId, role);

Adds the traget account to a specific role.

The main principle is that accounts can be assigned to roles and those roles can be granted capabilities. :ref:`Function Permissions <rights-and-roles_setFunctionPermission>` are basically the capability to call specific functions if the calling account belongs to a certain role. To add an account to the role 'member'.

----------
Parameters
----------

#. ``contract`` - ``string|any``: contractId or contract instance
#. ``accountId`` - ``string``: executing accountId
#. ``targetAccountId`` - ``string``: target accountId
#. ``role`` - ``number``: roleId

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const contractOwner = '0x0000000000000000000000000000000000000001';
  const newMember = '0x0000000000000000000000000000000000000002';
  const memberRole = 1;
  await rightsAndRoles.addAccountToRole(
    contract,                   // contract to be updated
    contractOwner,              // account, that can change permissions
    newMember,                  // add this account to role
    memberRole,                 // role id, uint8 value
  );


--------------------------------------------------------------------------------

.. _rights-and-roles_removeAccountFromRole:

removeAccountFromRole
================================================================================

.. code-block:: typescript

  rightsAndRoles.removeAccountFromRole(contract, accountId, targetAccountId, role);

Removes target account from a specific role.

----------
Parameters
----------

#. ``contract`` - ``string|any``: contractId or contract instance
#. ``accountId`` - ``string``: executing accountId
#. ``targetAccountId`` - ``string``: target accountId
#. ``role`` - ``number``: roleId

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const contractOwner = '0x0000000000000000000000000000000000000001';
  const newMember = '0x0000000000000000000000000000000000000002';
  const memberRole = 1;
  await rightsAndRoles.removeAccountFromRole(
    contract,                   // contract to be updated
    contractOwner,              // account, that can change permissions
    newMember,                  // remove this account from role
    memberRole,                 // role id, uint8 value
  );


------------------------------------------------------------------------------

.. _rights-and-roles_getMembers:

getMembers
================================================================================

.. code-block:: typescript

  rightsAndRoles.getMembers(contract);

Returns all roles with all members.

The `DSRolesPerContract <https://github.com/evannetwork/smart-contracts/blob/master/contracts/DSRolesPerContract.sol>`_ authority tracks used roles and their members and allows to retrieve an overview with all roles and their members. To get this information, you can use the ``getMembes`` function.

----------
Parameters
----------

#. ``contract`` - ``string|any``: contractId or contract instance

-------
Returns
-------

``Promise`` returns ``any``: Object with mapping roleId -> [accountId, accountId,...]

-------
Example
-------

.. code-block:: typescript

  const members = await rightsAndRoles.getMembers(contract);
  console.log(members);
  // Output:
  // {
  //   "0": [
  //     "0x0000000000000000000000000000000000000001"
  //   ],
  //   "1": [
  //     "0x0000000000000000000000000000000000000001",
  //     "0x0000000000000000000000000000000000000002"
  //   ]
  // }

The contract from this example has an owner (``0x0000000000000000000000000000000000000001``) and a member (``0x0000000000000000000000000000000000000002``). As the owner account has the member role as well, it is listed among the members.


------------------------------------------------------------------------------

.. _rights-and-roles_setFunctionPermission:

setFunctionPermission
================================================================================

.. code-block:: typescript

  rightsAndRoles.setFunctionPermission(contract, accountId, role, functionSignature, allow);

Allows or denies contract function for the accountId.

"Function permissions" are granted or denying by allowing a certain role to execute a specific function. The function is specified as the unhashed `function selector <http://solidity.readthedocs.io/en/latest/abi-spec.html#function-selector>`_ and must follow its guidelines (no spaces, property typenames, etc.) for the function to be able to generate valid hashes for later validations. E.g. to grant the role "member" the permission to use the function `addListEntries`, that has two arguments (a ``bytes32`` array and a ``bytes32`` value), the function permission for ``addListEntries(bytes32[],bytes32[])`` has to be granted.

----------
Parameters
----------

#. ``contract`` - ``string|any``: contractId or contract instance
#. ``accountId`` - ``string``: executing accountId
#. ``role`` - ``number``: roleid
#. ``functionSignature`` - ``string``: 4 Bytes function signature
#. ``allow`` - ``boolean``: allow or deny function

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const contractOwner = '0x0000000000000000000000000000000000000001';
  const memberRole = 1;
  await rightsAndRoles.setFunctionPermission(
    contract,                                 // contract to be updated
    contractOwner,                            // account, that can change permissions
    memberRole,                               // role id, uint8 value
    'addListEntries(bytes32[],bytes32[])',    // (unhashed) function selector
    true,                                     // grant this capability
  );


------------------------------------------------------------------------------

.. _rights-and-roles_setOperationPermission:

setOperationPermission
================================================================================

.. code-block:: typescript

  rightsAndRoles.setOperationPermission(contract, accountId, role, propertyName, propertyType, modificationType, allow);

Allows or denies setting properties on a contract.

"Operation Permissions" are capabilities granted per contract logic. They have a ``bytes32`` key, that represents the capability, e.g. in a `DataContract <https://github.com/evannetwork/smart-contracts/blob/master/contracts/DataContract.sol>`_ a capability to add values to a certain list can be granted.

The way, those capability hashes are build, depends on the contract logic and differs from contract to contract. For example a capability check for validation if a member is allowed to add an item to the list "example" in a `DataContract <https://github.com/evannetwork/smart-contracts/blob/master/contracts/DataContract.sol>`_ has four arguments, in this case:

- which role is allowed to do? (e.g. a member)
- what type of element is modified? (--> a list)
- which element is modified? (name of the list --> "example")
- type of the modification (--> "set an item" (== "add an item"))

These four values are combined into one ``bytes32`` value, that is used when granting or checking permissions, the ``setOperationPermission`` function takes care of that.

----------
Parameters
----------

#. ``contract`` - ``string|any``: contractId or contract instance
#. ``accountId`` - ``string``: executing accountId
#. ``role`` - ``number``: roleId
#. ``propertyName`` - ``string``: target property name
#. ``propertyType`` - ``PropertyType``: list or entry
#. ``modificationType`` - ``ModificationType``: set or remove
#. ``allow`` - ``boolean``: allow or deny

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  // make sure, you have required the enums from rights-and-roles.ts
  import { ModificationType, PropertyType } from 'blockchain-core';
  const contractOwner = '0x0000000000000000000000000000000000000001';
  const memberRole = 1;
  await rightsAndRoles.setOperationPermission(
    contract,                   // contract to be updated
    contractOwner,              // account, that can change permissions
    memberRole,                 // role id, uint8 value
    'example',                  // name of the object
    PropertyType.ListEntry,     // what type of element is modified
    ModificationType.Set,       // type of the modification
    true,                       // grant this capability
  );


------------------------------------------------------------------------------

.. _rights-and-roles_hasUserRole:

hasUserRole
================================================================================

.. code-block:: typescript

  rightsAndRoles.hasUserRole(contract, accountId, targetAccountId, role);

Returns true or false, depending on if the account has the specific role.

----------
Parameters
----------

#. ``contract`` - ``string|any``: contractId or contract instance
#. ``accountId`` - ``string``: executing accountId
#. ``targetAccountId`` - ``string``: to be checked accountId
#. ``role`` - ``number``: roleId

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript
  
  const accountToCheck = '0x0000000000000000000000000000000000000002';
  const memberRole = 1;
  const hasRole = await rightsAndRoles.hashUserRole(contract, null, accountToCheck, memberRole);
  console.log(hasRole);
  // Output:
  // true



--------------------------------------------------------------------------------

.. _rights-and-roles_transferOwnership:

transferOwnership
================================================================================

.. code-block:: typescript

  rightsAndRoles.transferOwnership();

Function description

----------
Parameters
----------

#. ``contract`` - ``string|any``: contractId or contract instance
#. ``accountId`` - ``string``: executing accountId
#. ``targetAccountId`` - ``string``: target accountId

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const contractOwner = '0x0000000000000000000000000000000000000001';
  const newOwner = '0x0000000000000000000000000000000000000002';
  await rightsAndRoles.transferOwnership(
    contract,                   // contract to be updated
    contractOwner,              // current owner
    newOwner,                   // this account becomes new owner
  );



.. required for building markup
.. |source contractLoader| replace:: ``ContractLoader``
.. _source contractLoader: ../contracts/contract-loader.html

.. |source executor| replace:: ``Executor``
.. _source executor: ../blockchain/executor.html

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: ../common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: ../common/logger.html#logloginterface

.. |source nameResolver| replace:: ``NameResolver``
.. _source nameResolver: ../blockchain/name-resolver.html

.. |source web3| replace:: ``Web3``
.. _source web3: https://github.com/ethereum/web3.js/