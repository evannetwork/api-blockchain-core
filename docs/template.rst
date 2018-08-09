
.. _base-contract_changeContractStateSample:

changeContractState
================================================================================

.. code-block:: typescript

  myContract.methods.myMethod([param1[, param2[, ...]]]).call(options[, callback])

Will call a "constant" method and execute its smart contract method in the EVM without sending any transaction. Note calling can not alter the smart contract state.

----------
Parameters
----------

#. ``options`` - ``object``: The options used for calling.
    * ``from`` - ``string`` (optional): The address the call "transaction" should be made from.
#. ``callback`` - ``Function`` (optional): This callback will be fired..
#. ``somethingElse`` - ``string`` (optional): this can be set if required, defaults to ``"latest"``.

-------
Returns
-------

``Promise`` returns ``any``: The return value(s) of the smart contract method.
If it returns a single value, it's returned as is. If it has multiple return values they are returned as an object with properties and indices:

-------
Example
-------

.. code-block:: typescript

  // ...


------------------------------------------------------------------------------