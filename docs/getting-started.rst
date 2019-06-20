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

- npm: ``npm install @evan.network/api-blockchain-core ipfs-api web3@1.0.0-beta.37``

**NOTE THE WEB3 CUSTOM VERSION!**

After that you need to create a blockchain core runtime with a predefined configuration.


.. _configuring-and-initializing-blockchain-core:

Configuring and initializing blockchain core
============================================

.. code-block:: javascript

    // require blockchain-core dependencies
    const IpfsApi = require('ipfs-api');
    const Web3 = require('web3');

    // require blockchain-core
    const { Ipfs, createDefaultRuntime } = require('@evan.network/api-blockchain-core');

    const runtimeConfig = {
      // account map to blockchain accounts with their private key
      accountMap: {
        'ACCOUNTID':
          'PRIVATE KEY',
      },
      // key configuration for private data handling
      keyConfig: {
        'ACCOUNTID': 'PASSWORD',
      },
      // ipfs configuration for evan.network storage
      ipfs: {host: 'ipfs.test.evan.network', port: '443', protocol: 'https'},
      // web3 provider config (currently evan.network testcore)
      web3Provider: 'wss://testcore.evan.network/ws',
    };


    async function init() {
      // initialize dependencies
      const provider = new Web3.providers.WebsocketProvider(
        runtimeConfig.web3Provider,
        { clientConfig: { keepalive: true, keepaliveInterval: 5000 } });
      const web3 = new Web3(provider, { transactionConfirmationBlocks: 1 });
      const dfs = new Ipfs({ remoteNode: new IpfsApi(runtimeConfig.ipfs), });

      // create runtime
      const runtime = await createDefaultRuntime(web3, dfs, { accountMap: runtimeConfig.accountMap, keyConfig: runtimeConfig.keyConfig });
      console.dir(runtime);
    }

    init();

or you can initialize the api-blockchain-core runtime with your mnemonic and your password previously created on evan.network

.. code-block:: javascript

    // require blockchain-core dependencies
    const IpfsApi = require('ipfs-api');
    const Web3 = require('web3');

    // require blockchain-core
    const { Ipfs, createDefaultRuntime } = require('@evan.network/api-blockchain-core');

    // ipfs configuration for evan.network testnet storage
    const ipfsConfig = {host: 'ipfs.test.evan.network', port: '443', protocol: 'https'};
    // web3 provider config (currently evan.network testcore)
    const web3Provider = 'wss://testcore.evan.network/ws'

    async function init() {
      // initialize dependencies
      const provider = new Web3.providers.WebsocketProvider(
        web3Provider,
        { clientConfig: { keepalive: true, keepaliveInterval: 5000 } });
      const web3 = new Web3(provider, { transactionConfirmationBlocks: 1 });
      const dfs = new Ipfs({ remoteNode: new IpfsApi(ipfsConfig), });

      // create runtime
      const runtime = await createDefaultRuntime(
        web3,
        dfs,
        {
          mnemonic: 'YOUR_MNEMNONIC',
          password: 'YOUR_PASSWORD'
        }
      );
      console.dir(runtime);
    }

    init();


That's it! Now you can use the ``runtime`` object and interact with the evan.network blockchain.

The blockchain-core api is a set of modules which can be plugged in individually. So the above ``runtime`` is a full blown entry point to the api. You can also plug your own runtime with needed modules together.

Create a new profile on evan.network via API
============================================

When you want to create profiles programatically via our API, you can use the "Onboarding" class on the api-blockchain-core with the function ``createNewProfile``. You can also generate your custom mnemonic from the Onboarding class as well. The only thing that should be defined is a password for the profile

.. code-block:: javascript

    // require blockchain-core
    const { Onboarding } = require('@evan.network/api-blockchain-core');

    async function createProfile() {
      // generate a new random mnemnoic
      const mnemonic = Onboarding.createMnemonic();
      // create a profile for a mnemonic and a given password
      const profile = await Onboarding.createNewProfile(mnemonic, 'CUSTOM_PASSWORD');

      console.dir(profile);
    }

    createProfile();

