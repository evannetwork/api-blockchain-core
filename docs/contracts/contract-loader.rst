================================================================================
Contract Loader
================================================================================

.. list-table:: 
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - ContractLoader
   * - Extends
     - `Logger </common/logger.html>`_
   * - Source
     - `contract-loader.ts <https://github.com/evannetwork/dbcp/tree/master/src/contracts/contract-loader.ts>`_
   * - Tests
     - `contract-loader.spec.ts <https://github.com/evannetwork/dbcp/tree/master/src/contracts/contract-loader.spec.ts>`_

The `ContractLoader <https://github.com/evannetwork/dbcp/blob/master/src/contracts/contract-loader.ts>`_ is used when loading contracts without a DBCP description or when creating new contracts via bytecode. In both cases additional information has to be passed to the `ContractLoader <https://github.com/evannetwork/dbcp/blob/master/src/contracts/contract-loader.ts>`_ constructor.

Loading contracts requires an abi interface as a JSON string and creating new contracts requires the bytecode as hex string. Compiling Ethereum smart contracts with  `solc <https://github.com/ethereum/solidity>`_ provides these.

Abis, that are included by default are:

- AbstractENS
- Described
- EventHub
- Owned
- PublicResolver

Bytecode for these contracts is included by default:

- Described
- Owned 

Following is an example for loading a contract with a custom abi. The contract is a `Greeter Contract <https://github.com/evannetwork/dbcp/blob/master/contracts/Greeter.sol>`_ and a shortened interface containing only the `greet` function is used here.

They can be side-loaded into an existing contract loader instance, e.g. into a runtime:

.. code-block:: javascript

    runtime.contractLoader.contracts['Greeter'] = {
      "interface": "[{\"constant\":true,\"inputs\":[],\"name\":\"greet\",\"outputs\":[{\"name\":\"\",\"type\":\"string\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"}]",
    };


.. _contract_loader_getCompiledContractn:

getCompiledContract
===================

.. code-block:: javascript

    contractLoader.getCompiledContract(name);

gets contract from a solc compilation

----------
Parameters
----------

#. ``name`` - ``string``: Contract name

-------
Returns
-------

``any``: The compiled contract.

-------
Example
-------

.. code-block:: javascript

    const address = '0x9c0Aaa728Daa085Dfe85D3C72eE1c1AdF425be49';
    const accountId = '0x000000000000000000000000000000000000beef';
    const description = await runtime.description.getDescription(address, accountId);
    console.dir(description);
    // Output:
    // { public: 
    //    { name: 'DBCP sample greeter',
    //      description: 'smart contract with a greeting message and a data property',
    //      author: 'dbcp test',
    //      tags: [ 'example', 'greeter' ],
    //      version: '0.1.0',
    //      abis: { own: [Array] } } }

------------------------------------------------------------------------------

.. _contract_loader_loadContract:

loadContract
===================

.. code-block:: javascript

    contractLoader.loadContract(name, address);

creates a contract instance that handles a smart contract at a given address

----------
Parameters
----------

#. ``name`` - ``string``: Contract name
#. ``address`` - ``string``: Contract address

-------
Returns
-------

``any``: contract instance.

-------
Example
-------

.. code-block:: javascript

    const greeter = runtime.contractLoader.loadContract('Greeter', '0x9c0Aaa728Daa085Dfe85D3C72eE1c1AdF425be49');
