===============
Getting Started
===============

The blockchain core is a helper library, that offers helpers for interacting with the evan.network blockchain. It is written in TypeScript and offers several (up to a certain degree) stand-alone modules, that can be used for

- creating and updating contracts
- managing user profiles
- en- and decryption
- distributed filesystem file handling
- key exchange and key handling
- ENS domain handling
- sending and receiving bmails

.. _adding-blockchain-core:

Adding blockchain core
======================

First you need to get blockchain core and its dependencies into your project. This can be done using the following methods:

- npm: ``npm install @evan.network/api-blockchain-core ipfs-api web3``

After that you need to create a blockchain core runtime with a predefined configuration.

Configuring and initializing blockchain core
============================================

.. code-block:: javascript

    // require blockchain-core dependencies
    const IpfsApi = require('ipfs-api');
    const Web3 = require('web3');

    // require blockchain-core
    const { Ipfs, createDefaultRuntime } = require('blockchain-core');

    const runtimeConfig = {
      // account map to blockchain accounts with their private key
      accountMap: {
        'ACCOUNTID':
          'PRIVATE KEY',
      },
      // ipfs configuration for evan.network storage
      ipfs: {host: 'ipfs.test.evan.network', port: '443', protocol: 'https'},
      // web3 provider config (currently evan.network testcore)
      web3Provider: 'wss://testcore.evan.network/ws',
    };

    // initialize dependencies
    const web3 = new Web3();
    web3.setProvider(new web3.providers.WebsocketProvider(runtimeConfig.web3Provider));
    const dfs = new Ipfs({ remoteNode: new IpfsApi(runtimeConfig.ipfs), });

    // create runtime
    const runtime = await createDefaultRuntime(web3, dfs, { accountMap: runtimeConfig.accountMap, });

That's it! now you can use the ``runtime`` object and interact with the evan.network blockchain.

The blockchain-core api is a set of modules which can be plugged in individually. So the above ``runtime`` is a full blown entry point to the api. You can also plug your own runtime with needed modules together.