================================================================================
Utils
================================================================================

.. list-table:: 
   :widths: auto
   :stub-columns: 1

   * - Source
     - `utils.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/common/utils.ts>`_

Utils contain helper functions which are used across the whole project

------------------------------------------------------------------------------

.. _utils_promisify:

promisify
===================

.. code-block:: javascript

    utils.promisify(funThis, functionName, ...args);

run given function from this, use function(error, result) {...} callback for promise resolve/reject



----------
Parameters
----------

#. ``funThis`` - ``any``: the functions 'this' object
#. ``functionName`` - ``string``: name of the contract function to call
#. ``...args`` - ``any``: any addtional parameters that should be passed to the called function

-------
Returns
-------

Promise resolves to ``any``: the result from the function(error, result) {...} callback.

-------
Example
-------

.. code-block:: javascript

    runtime.utils
      .promisify(fs, 'readFile', 'somefile.txt')
      .then(content => console.log('file content: ' + content))

------------------------------------------------------------------------------

.. _utils_obfuscate:

obfuscate
===================

.. code-block:: javascript

    utils.obfuscate(text);

obfuscates strings by replacing each character but the last two with 'x'


----------
Parameters
----------

#. ``text`` - ``string``: text to obfuscate

-------
Returns
-------

``string``: obfuscated text

-------
Example
-------

.. code-block:: javascript

    const obfuscated = runtime.utils.obfuscate('sample text');
    // returns 'sample texx'