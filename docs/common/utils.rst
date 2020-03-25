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



------------------------------------------------------------------------------

.. _utils_getSmartAgentAuthHeaders:

getSmartAgentAuthHeaders
===================

.. code-block:: javascript

    utils.getSmartAgentAuthHeaders(runtime[, message]);

create auth header data to authenticate with current account or active account of the identity against a smart agent server

----------
Parameters
----------

#. ``runtime`` - ``Runtime``: an initialized runtime
#. ``message`` - ``string`` (optional): message to sign, defaults to current timestamp

-------
Returns
-------

Promise resolves to ``string``: auth header value as string

-------
Example
-------

.. code-block:: javascript

    const authData = await getSmartAgentAuthHeaders(runtime);
    console.log(authData);
    // Output:
    // EvanAuth 0x001De828935e8c7e4cb56Fe610495cAe63fb2612,EvanMessage 1566569193297,EvanSignedMessage 0x4ce5c94b3fb77e6fbd7dcbbedc564058d841c849020f11514b7e525776b033eb6cb54f480b604ae7dccb9858eb116267cfe547fab52679730b5e33ac975dbbab1b
