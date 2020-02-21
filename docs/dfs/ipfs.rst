================================================================================
IPFS
================================================================================

.. list-table::
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - Ipfs
   * - Implements
     - `DfsInterface <dfs-interface.html>`_
   * - Extends
     - `Logger <../common/logger.html>`_
   * - Source
     - `ipfs.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/dfs/ipfs.ts>`_
   * - Examples
     - `ipfs.spec.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/dfs/ipfs.spec.ts>`_


This is `DfsInterface <dfs-interface.html>`_ implementation, that relies on the `IPFS <https://ipfs.io/>`_ framework.

.. _ipfs_constructor:

constructor
================================================================================

.. code-block:: typescript

  new Ipfs(options);

Creates a new IPFS instance.

----------
Parameters
----------

#. ``options`` - ``IpfsOptions``: options for IPFS constructor.
    * ``remoteNode`` - ``any``: ipfs-api instance to remote server
    * ``cache`` - |source dfsCache|_ (optional): |source dfsCache|_ instance
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``

-------
Returns
-------

``Ipfs`` instance

-------
Example
-------

.. code-block:: typescript

  const ipfs = new Ipfs({
      remoteNode,
      cache
    });


------------------------------------------------------------------------------

.. _ipfs_ipfsHashToBytes32:

ipfsHashToBytes32
===================

.. code-block:: javascript

    dfs.ipfsHashToBytes32(hash);

convert IPFS hash to bytes 32 see https://www.reddit.com/r/ethdev/comments/6lbmhy/a_practical_guide_to_cheap_ipfs_hash_storage_in

----------
Parameters
----------

#. ``hash`` - ``string``: IPFS hash

-------
Returns
-------

``string``: bytes32 string.

-------
Example
-------

.. code-block:: javascript

    runtime.dfs.ipfsHashToBytes32('QmWmyoMoctfbAaiEs2G46gpeUmhqFRDW6KWo64y5r581Vz')
    // returns 0x7D5A99F603F231D53A4F39D1521F98D2E8BB279CF29BEBFD0687DC98458E7F89

------------------------------------------------------------------------------

.. _ipfs_bytes32ToIpfsHash:

bytes32ToIpfsHash
===================

.. code-block:: javascript

    dfs.bytes32ToIpfsHash(str);

convert bytes32 to IPFS hash see https://www.reddit.com/r/ethdev/comments/6lbmhy/a_practical_guide_to_cheap_ipfs_hash_storage_in

----------
Parameters
----------

#. ``str`` - ``string``: bytes32 string

-------
Returns
-------

``string``: IPFS Hash.

-------
Example
-------

.. code-block:: javascript

    runtime.dfs.ipfsHashToBytes32('0x7D5A99F603F231D53A4F39D1521F98D2E8BB279CF29BEBFD0687DC98458E7F8')
    // returns QmWmyoMoctfbAaiEs2G46gpeUmhqFRDW6KWo64y5r581Vz

------------------------------------------------------------------------------

.. _ipfs_add:

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

.. _ipfs_addMultiple:

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

.. _ipfs_pinFileHash:

pinFileHash
===================

.. code-block:: javascript

    dfs.pinFileHash(hash);

pins file hashes on ipfs cluster

----------
Parameters
----------

#. ``hash`` - ``string``: filehash of the pinned item

-------
Returns
-------

``Promise`` resolves to ``void``: resolved when done.

-------
Example
-------

.. code-block:: javascript

    const fileBuffer = await runtime.dfs.pinFileHash('QmWmyoMoctfbAaiEs2G46gpeUmhqFRDW6KWo64y5r581Vz');

------------------------------------------------------------------------------

.. _ipfs_remove:

remove
===================

.. code-block:: javascript

    dfs.remove(hash);

unpins file hashes on ipfs cluster

----------
Parameters
----------

#. ``hash`` - ``string``: filehash of the pinned item

-------
Returns
-------

``Promise`` resolves to ``void``: resolved when done.

-------
Example
-------

.. code-block:: javascript

  await runtime.dfs.remove('QmWmyoMoctfbAaiEs2G46gpeUmhqFRDW6KWo64y5r581Vz');

------------------------------------------------------------------------------


.. _ipfs_unPinFileHash:

unPinFileHash
===================

.. code-block:: javascript

    dfs.unPinFileHash(hash);

unpins file hashes on ipfs cluster

----------
Parameters
----------

#. ``hash`` - ``string``: filehash of the pinned item

-------
Returns
-------

``Promise`` resolves to ``void``: resolved when done.

-------
Example
-------

.. code-block:: javascript

  await runtime.dfs.unPinFileHash('QmWmyoMoctfbAaiEs2G46gpeUmhqFRDW6KWo64y5r581Vz');

------------------------------------------------------------------------------

.. _ipfs_get:

get
===================

.. code-block:: javascript

    dfs.get(hash, returnBuffer);

get data from ipfs by ipfs hash

----------
Parameters
----------

#. ``hash`` - ``string``: ipfs hash (or bytes32 encoded) of the data
#. ``returnBuffer`` - ``bool``: if true the method will return a raw buffer holding the data (default false)

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
=========================

Interfaces
================

.. _ipfs_FileToAdd:

----------
FileToAdd
----------

#. ``path`` - ``string``: name of the added file
#. ``content`` - ``buffer``: data (as buffer) of the added file

.. required for building markup

.. |source dfsCache| replace:: ``DfsCacheInterface``
.. _source dfsCache: ../dfs/dfs-interface.html

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: ../common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: ../common/logger.html#logloginterface
