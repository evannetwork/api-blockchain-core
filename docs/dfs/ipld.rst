================================================================================
IPLD
================================================================================

.. list-table:: 
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - Ipld
   * - Extends
     - `Logger </common/logger.html>`_
   * - Source
     - `ipld.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/dfs/ipld.ts>`_
   * - Tests
     - `ipld.spec.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/dfs/ipld.spec.ts>`_


`IPLD <https://github.com/ipld/ipld>`_ is a way to store data as trees. The used implementation relies on `js-ipld-graph-builder <https://github.com/ipld/js-ipld-graph-builder>`_ for iterating over tree nodes and setting new subtrees, but uses a few modifications to the standard:
- nodes are not stored as `IPFS DAGs <https://github.com/ipfs/interface-ipfs-core/blob/master/SPEC/DAG.md>`_, but stored as play JSON IPFS files
- nodes, that are encrypted, contain the property `cryptoInfo` for decryption (see `Encryption <encryption>`_)



--------------------------------------------------------------------------------

.. _ipld_constructor:

constructor
================================================================================

.. code-block:: typescript

  new IPLD(options);

Creates a new Ipld instance.

Requires

----------
Parameters
----------

#. ``options`` - ``IpldOptions``: The options used for calling
    * ``cryptoProvider`` - |source cryptoProvider|_: |source cryptoProvider|_ instance
    * ``defaultCryptoAlgo`` - ``string``: default encryption algorithm
    * ``ipfs`` - |source ipfs|_: |source ipfs|_ instance
    * ``keyProvider`` - |source keyProviderInterface|_: |source keyProviderInterface|_ instance
    * ``originator`` - ``string``: originator of tree (default encryption context)
    * ``nameResolver`` - |source nameResolver|_: |source nameResolver|_ instance
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``

-------
Returns
-------

``IpldOptions`` instance

-------
Example
-------

.. code-block:: typescript

  const ipld = new IPLD(options);



--------------------------------------------------------------------------------

.. _ipld_store:

store
================================================================================

.. code-block:: typescript

  ipld.store(toSet);

Store tree, if tree contains merklefied links, stores tree with multiple linked subtrees.
Hashes returned from this function represent the the final tree, that can be stored as bytes32 hashes in smart contracts, etc.

----------
Parameters
----------

#. ``toSet`` - ``any``: tree to store

-------
Returns
-------

``Promise`` returns ``string``: hash reference to a tree with with merklefied links

-------
Example
-------

.. code-block:: typescript

  const sampleObject = {
    personalInfo: {
      firstName: 'eris',
    },
  };
  const stored = await ipld.store(Object.assign({}, sampleObject));
  console.log(stored);
  // Output:
  // 0x12f6526dbe223eddd6c6a0fb7df118c87c56d34bf0c845b54bdca2fec0f3017d

When storing nested trees created with _ipld_set_, subtrees at junction points are stored as separate trees, then converted to serialized buffers, which are automatically deserialized and cast back when calling ipld_getLinkedGraph_.

.. code-block:: typescript

  console.log(JSON.stringify(extended, null, 2));
  const extendedstored = await ipld.store(Object.assign({}, extended));
  // Output:
  // "0xc74f6946aacbbd1418ddd7dec83a5bcd3710b384de767d529e624f9f08cbf9b4"
  const loaded = await ipld.getLinkedGraph(extendedstored, '');
  console.log(JSON.stringify(Ipld.purgeCryptoInfo(loaded), null, 2));
  // Output:
  // 
  //  "personalInfo": {
  //    "firstName": "eris"
  //  },
  //  "dapps": {
  //    "/": {
  //      "type": "Buffer",
  //      "data": [ 18, 32, 246, 21, 166, 135, 236, 212, 70, 130, 94, 47, 81, 135, 153, 154, 201, 69, 109, 249, 97, 84, 252, 56, 214, 195, 149, 133, 116, 253, 19, 87, 217, 66 ]
  //    }
  //  }
  // 



--------------------------------------------------------------------------------

.. _ipld_getLinkedGraph:

getLinkedGraph
================================================================================

.. code-block:: typescript

  ipld.getLinkedGraph(graphReference[, path]);

Get a path from a tree; resolve subtrees only if required (depends on requested path).

----------
Parameters
----------

#. ``graphReference`` - ``string | Buffer | any``: hash/buffer to look up or a graph object
#. ``path`` - ``string`` (optional): path in the tree, defaults to ``''``

-------
Returns
-------

``Promise`` returns ``any``: linked graph

-------
Example
-------

To retrieve data from IPLD trees, use the `bytes32` hash from storing the data:

.. code-block:: typescript

  const stored = '0x12f6526dbe223eddd6c6a0fb7df118c87c56d34bf0c845b54bdca2fec0f3017d';
  const loaded = await ipld.getLinkedGraph(stored, '');
  console.dir(Ipld.purgeCryptoInfo(loaded));
  // Output:
  // { personalInfo: { firstName: 'eris' } }

For info about the ``Ipld.purgeCryptoInfo`` part see :doc:`Encryption </encryption/index>`.

The second argument is the path inside the tree. Passing '' means "retrieve data from root level". To get more specifc data, provide a path:

.. code-block:: typescript

  const stored = '0x12f6526dbe223eddd6c6a0fb7df118c87c56d34bf0c845b54bdca2fec0f3017d';
  const loaded = await ipld.getLinkedGraph(stored, 'personalInfo');
  console.dir(Ipld.purgeCryptoInfo(loaded));
  // Output:
  // { firstName: 'eris' }


.. code-block:: typescript

  const stored = '0x12f6526dbe223eddd6c6a0fb7df118c87c56d34bf0c845b54bdca2fec0f3017d';
  const loaded = await ipld.getLinkedGraph(stored, 'personalInfo/firstName');
  console.dir(Ipld.purgeCryptoInfo(loaded));
  // Output:
  // 'eris'



--------------------------------------------------------------------------------

.. _ipld_getResolvedGraph:

getResolvedGraph
================================================================================

.. code-block:: typescript

  ipld.getResolvedGraph(graphReference[, path, depth]);

Get a path from a tree; resolve links in paths up to depth (default is 10).

This function is for **debugging and analysis purposes only**, it tries to resolve the entire graph, which would be too much requests in most scenarios. If resolving graphs, prefer using ipld_getLinkedGraph_, with specific queries into the tree, that limit the resolve requests.

----------
Parameters
----------

#. ``graphReference`` - ``string | Buffer | any``: hash/buffer to look up or a graph object
#. ``path`` - ``string`` (optional): path in the tree, defaults to ``''``
#. ``depth`` - ``number`` (optional): resolve up do this many levels of depth, defaults to ``10``

-------
Returns
-------

``Promise`` returns ``any``: resolved graph

-------
Example
-------

.. code-block:: typescript

  const treeHash = '0xc74f6946aacbbd1418ddd7dec83a5bcd3710b384de767d529e624f9f08cbf9b4';
  console.dir(await ipld.getResolvedGraph(treeHash, ''));
  // Output:
  // { personalInfo: { firstName: 'eris' },
  // dapps: { '/': { contracts: [Array], cryptoInfo: [Object] } },
  // cryptoInfo: 
  //  { originator: '0xd7c759941fa3962e4833707f2f44f8cb11b471916fb6f9f0facb03119628234e',
  //    keyLength: 256,
  //    algorithm: 'aes-256-cbc' } }

Compared to ipld_getLinkedGraph_:

.. code-block:: typescript

  const treeHash = '0xc74f6946aacbbd1418ddd7dec83a5bcd3710b384de767d529e624f9f08cbf9b4';
  console.dir(await ipld.getLinkGraph(treeHash, ''));
  // Output:
  // { personalInfo: { firstName: 'eris' },
  // dapps: 
  //  { '/': 
  //     Buffer [18, 32, 246, 21, 166, 135, 236, 212, 70, 130, 94, 47, 81, 135, 153, 154, 201, 69, 109, 249, 97, 84, 252,  56, 214, 195, 149, 133, 116, 253, 19, 87, 217, 66] },
  // cryptoInfo: 
  //  { originator: '0xd7c759941fa3962e4833707f2f44f8cb11b471916fb6f9f0facb03119628234e',
  //    keyLength: 256,
  //    algorithm: 'aes-256-cbc' } }



--------------------------------------------------------------------------------

.. _ipld_set:

set
================================================================================

.. code-block:: typescript

  ipld.set(tree, path, subtree[, plainObject, cryptoInfo]);

Set a value to a tree node; inserts new element as a linked subtree by default.

What's pretty useful about IPLD graphs is, that not only plain JSON trees can be stored, but that those trees can be linked to other graphs, which makes it possible to build very powerful tree structures, that consist of multiple separate trees, that can be used on their own or in a tree, that combines all of those. The resulting hash is again ``bytes32`` hash and this can be stored in smart contracts like any other IPFS hash.

This function adds the given subtree under a path in the existing tree. Different subtrees can be added by using this function multiple times. The final tree can then be stored to IPFS with ipld_store_.

----------
Parameters
----------

#. ``tree`` - ``any``: tree to extend
#. ``path`` - ``string``: path of inserted element
#. ``subtree`` - ``any``: element that will be added
#. ``plainObject`` - ``boolean`` (optional): do not link values as new subtree, defaults to ``false``
#. ``cryptoInfo`` - ``CryptoInfo`` (optional): crypto info for encrypting subtree

-------
Returns
-------

``Promise`` returns ``any``: tree with merklefied links

-------
Example
-------

.. code-block:: typescript

  const sampleObject = {
    personalInfo: {
      firstName: 'eris',
    },
  };
  const sub = {
    contracts: ['0x01', '0x02', '0x03']
  };
  const extended = await ipld.set(
    sampleObject,               // extend this graph
    'dapps',                    // attach the subgraph under the path "dapps"
    sub,                        // attach this graph as a subgraph
  );
  console.log(JSON.stringify(extended, null, 2));
  // Output:
  // {
  //   "personalInfo": {
  //     "firstName": "eris"
  //   },
  //   "dapps": {
  //     "/": {
  //       "contracts": [
  //         "0x01",
  //         "0x02",
  //         "0x03"
  //       ]
  //     }
  //   }
  // }



--------------------------------------------------------------------------------

.. _ipld_remove:

remove
================================================================================

.. code-block:: typescript

  ipld.remove(tree, path);

Delete a value from a tree node.

----------
Parameters
----------

#. ``tree`` - ``any``: tree to extend
#. ``string`` - ``string``: path of inserted element

-------
Returns
-------

``Promise`` returns ``any``: tree with merklefied links

-------
Example
-------

.. code-block:: typescript

  const treeHash = '0xc74f6946aacbbd1418ddd7dec83a5bcd3710b384de767d529e624f9f08cbf9b4';
  const loaded = await ipld.getLinkedGraph(treeHash, '');
  console.log(loaded);
  // Output:
  // { personalInfo: { firstName: 'eris' },
  //   dapps: 
  //    { '/': <Buffer 12 20 f6 15 a6 87 ec d4 46 82 5e 2f 51 87 99 9a c9 45 6d f9 61 54 fc 38 d6 c3 95 85 74 fd 13 57 d9 42> },
  //   cryptoInfo: 
  //    { originator: '0xd7c759941fa3962e4833707f2f44f8cb11b471916fb6f9f0facb03119628234e',
  //      keyLength: 256,
  //      algorithm: 'aes-256-cbc' } }

  const updated = await ipld.remove(loaded, 'dapps');
  console.log(updated);
  // Output:
  // { personalInfo: { firstName: 'eris' },
  //   cryptoInfo: 
  //    { originator: '0xd7c759941fa3962e4833707f2f44f8cb11b471916fb6f9f0facb03119628234e',
  //      keyLength: 256,
  //      algorithm: 'aes-256-cbc' } }



--------------------------------------------------------------------------------

.. _ipld_purgeCryptoInfo:

purgeCryptoInfo
================================================================================

.. code-block:: typescript

  Ipld.purgeCryptoInfo(toPurge);

(static class function)

Remove all cryptoInfos from tree.

Some example here use ``Ipld.purgeCryptoInfo`` to cleanup the objects before logging them. This is done, because IPLD graphs are encrypted by default, which has a few impact on the data stored:

  - The root node of a tree is "encrypted" with the encryption algorithm "unencrypted", resulting in the root node having its data stored as a Buffer. This is done to keep the root node in the same format as the other nodes, as:
  - Nodes in the Tree are encrypted. This encryption is specified in the constructor as `defaultCryptoAlgo`.
  - All nodes are en- or decrypted with the same account or "originator". The originator, that is used, is specified in the constructor as "originator". This means, that the IPLD instance is account bound and a new instance has to be created if another account should be used.

----------
Parameters
----------

#. ``toPurge`` - ``any``: The options used for calling

-------
Returns
-------

``void``

-------
Example
-------

To show the difference, without purging:

.. code-block:: typescript

  const stored = '0x12f6526dbe223eddd6c6a0fb7df118c87c56d34bf0c845b54bdca2fec0f3017d';
  const loaded = await ipld.getLinkedGraph(stored, '');
  console.dir(loaded);
  // Output:
  // { personalInfo: { firstName: 'eris' },
  //   cryptoInfo: 
  //    { originator: '0xd7c759941fa3962e4833707f2f44f8cb11b471916fb6f9f0facb03119628234e',
  //      keyLength: 256,
  //      algorithm: 'aes-256-cbc' } }
  //

With purging:

.. code-block:: typescript

  const stored = '0x12f6526dbe223eddd6c6a0fb7df118c87c56d34bf0c845b54bdca2fec0f3017d';
  const loaded = await ipld.getLinkedGraph(stored, '');
  console.dir(Ipld.purgeCryptoInfo(loaded));
  // Output:
  // { personalInfo: { firstName: 'eris' } }



.. required for building markup

.. |source cryptoProvider| replace:: ``CryptoProvider``
.. _source cryptoProvider: /encryption/crypto-provider.html

.. |source ipfs| replace:: ``Ipfs``
.. _source ipfs: /dfs/ipfs.html

.. |source keyProviderInterface| replace:: ``KeyProviderInterface``
.. _source keyProviderInterface: /encryption/key-provider.html

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: /common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: /common/logger.html#logloginterface

.. |source nameResolver| replace:: ``NameResolver``
.. _source nameResolver: /blockchain/name-resolver.html