================================================================================
DFS Interface
================================================================================

.. list-table:: 
   :widths: auto
   :stub-columns: 1

   * - Interface Name
     - DfsInterface
   * - Source
     - `dfs-interface.ts <https://github.com/evannetwork/dbcp/tree/master/src/dfs/dfs-interface.ts>`_

The `DfsInterface <https://github.com/evannetwork/api-blockchain-core/tree/master/src/dfs/dfs-interface.ts>`_ is used to add or get files from the distributed file system. It is the only class, that has to be used before having access to a runtime, when using the `createDefaultRuntime`.

Internally the modules use the `DfsInterface <https://github.com/evannetwork/api-blockchain-core/tree/master/src/dfs/dfs-interface.ts>`_ to access data as well. As the actual implementation of the file access may vary, an instance of the interface has to be created beforehand and passed to the `createDefaultRuntime` function. An implementation called `Ipfs <ipfs.html>`_, that relies on the `IPFS framework <https://ipfs.io/>`_ is included as in the package.

------------------------------------------------------------------------------

.. _dfs_add:

add
===================

.. code-block:: javascript

    dfs.add(name, data);

add content to ipfs
file content is converted to Buffer (in NodeJS) or an equivalent "polyfill" (in browsers)

----------
Parameters
----------

#. ``name`` - ``string``: name of the added file
#. ``data`` - ``buffer``: data (as buffer) of the added file

-------
Returns
-------

``string``: ipfs hash of the data.

-------
Example
-------

.. code-block:: javascript

    const fileHash = await runtime.dfs.add(
      'about-maika-1.txt',
      Buffer.from('we have a cat called "Maika"', 'utf-8'),
    );
    console.log(fileHash);
    // Output:
    // 0x695adc2137f1f069ff697aa287d0eae486521925a23482f180b3ae4e6dbf8d70

------------------------------------------------------------------------------

.. _dfs_addMultiple:

addMultiple
===================

.. code-block:: javascript

    dfs.addMultiple(files);

Multiple files can be added at once. This way of adding should be preferred for performance reasons, when adding files, as requests are combined.

----------
Parameters
----------

#. ``files`` - ``FileToAdd[]``: array with files to add

-------
Returns
-------

``Promise`` resolves to ``string[]``: ipfs hash array of the data.

-------
Example
-------

.. code-block:: javascript

    const fileHashes = await runtime.dfs.addMultiple([{
        path: 'about-maika-1.txt',
        content: Buffer.from('we have a cat called "Maika"', 'utf-8'),
      }, {
        path: 'about-maika-2.txt',
        content: Buffer.from('she can be grumpy from time to time"', 'utf-8'),
      }
    ]);
    console.dir(fileHashes);
    // Output:
    // [ '0x695adc2137f1f069ff697aa287d0eae486521925a23482f180b3ae4e6dbf8d70',
    //   '0x6b85c8b24b59b12a630141143c05bbf40a8adc56a8753af4aa41ebacf108b2e7' ]

------------------------------------------------------------------------------


.. _dfs_get:

get
===================

.. code-block:: javascript

    dfs.get(hash, returnBuffer);

get data from ipfs by ipfs hash

----------
Parameters
----------

#. ``hash`` - ``string``: ipfs hash (or bytes32 encoded) of the data
#. ``returnBuffer`` - ``bool``: should the function return the plain buffer, defaults to ``false``

-------
Returns
-------

``Promise`` resolves to ``string | buffer``: data as text or buffer.

-------
Example
-------

.. code-block:: javascript

    const fileBuffer = await runtime.dfs.get('0x695adc2137f1f069ff697aa287d0eae486521925a23482f180b3ae4e6dbf8d70');
    console.log(fileBuffer.toString('utf-8'));
    // Output:
    // we have a cat called "Maika"

------------------------------------------------------------------------------

= Additional Components =
==========================

Interfaces
================

.. _dfs_FileToAdd:

----------
FileToAdd
----------

#. ``path`` - ``string``: name of the added file
#. ``content`` - ``buffer``: data (as buffer) of the added file