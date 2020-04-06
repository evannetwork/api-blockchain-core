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

First you need to get blockchain core into your project. This can be done using the following methods:

- npm: ``npm install @evan.network/api-blockchain-core``

After that you need to create a blockchain core runtime with a predefined configuration.

Node.js version >= 10 is supported. The framework has been tested with Node.js 10, 11 and 12.

.. _configuring-and-initializing-blockchain-core:

Configuring and initializing blockchain core
============================================

.. code-block:: javascript

    // require blockchain-core dependencies
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
      const web3 = new Web3(provider, null, { transactionConfirmationBlocks: 1 });
      const dfs = new Ipfs({ dfsConfig: runtimeConfig.ipfs });

      // create runtime
      const runtime = await createDefaultRuntime(web3, dfs, { accountMap: runtimeConfig.accountMap, keyConfig: runtimeConfig.keyConfig });
      console.dir(runtime);
    }

    init();

or you can initialize the api-blockchain-core runtime with your mnemonic and your password previously created on evan.network

.. code-block:: javascript

    // require blockchain-core dependencies
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
      const web3 = new Web3(provider, null, { transactionConfirmationBlocks: 1 });
      const dfs = new Ipfs({ dfsConfig: ipfsConfig });

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

When you want to create profiles programatically via our API, you can use the "Onboarding" class on the api-blockchain-core with the function ``createNewProfile``. To create a new profile you have the following prerequirements:

1. A previously created profile on the testnet (https://dashboard.test.evan.network) or the mainnet (https://dashboard.evan.network)
2. At least 1.01 EVE on this profile when you want to create a new one as the creation process will be initiated with your existing account.


You can also generate your custom mnemonic from the Onboarding class as well.

The only thing that should be defined is a password and an alias for the profile.

.. code-block:: javascript

    const Web3 = require('web3');

    // require blockchain-core
    const { Ipfs, createDefaultRuntime, Onboarding } = require('@evan.network/api-blockchain-core');

    // ipfs configuration for evan.network testnet storage
    const ipfsConfig = {host: 'ipfs.test.evan.network', port: '443', protocol: 'https'};
    // web3 provider config (currently evan.network testcore)
    const web3Provider = 'wss://testcore.evan.network/ws'


    // DEFINED VARIABLES FROM USER
    const existingMnemonic = 'YOUR_MNEMNONIC';
    const existingPassword = 'YOUR_PASSWORD';

    const newProfileAlias = 'CUSTOM_ALIAS';
    const newProfilePassword = 'CUSTOM_PASSWORD';


    async function initRuntime() {
      // initialize dependencies
      const provider = new Web3.providers.WebsocketProvider(
        web3Provider,
        { clientConfig: { keepalive: true, keepaliveInterval: 5000 } });
      const web3 = new Web3(provider, null, { transactionConfirmationBlocks: 1 });
      const dfs = new Ipfs({ dfsConfig: ipfsConfig });

      // create runtime
      const runtime = await createDefaultRuntime(
        web3,
        dfs,
        {
          mnemonic: existingMnemonic,
          password: existingPassword
        }
      );

      return runtime;
    }

    async function createProfile() {
      // initialize existing runtime
      const runtime = await initRuntime();
      // generate a new random mnemnoic
      const mnemonic = Onboarding.createMnemonic();
      // alias for the new profile
      const profileAlias = 'autogenerated profile';
      // create a profile for a mnemonic and a given password
      const profile = await Onboarding.createNewProfile(
        runtime,
        mnemonic,
        newProfilePassword,
        {
          accountDetails: {
            profileType: 'user',
            accountName: newProfileAlias,
          },
        });
      console.log('Profile created successfully!');
      console.dir(profile);
    }

    createProfile();



When all functions have run successfully, a message like the following will be shown and you can then log in with the new mnemonic and password on the respective dashboard:

.. code-block:: javascript

    Profile created successfully
    { mnemonic:
       'penalty end car fit figure spell hero over equip hill found cage',
      password: 'CUSTOM_PASSWORD',
      runtimeConfig:
       { accountMap:
          { '0x5163B751E6C06102B37234fe1c126542375dEa80':
             'b92fe68e7cb5e697596bb979da5608b9b5c37b2062b36ef2219cf64fc52d11f9' },
         keyConfig:
          { '0x82a911d010ef625d05ff9212b599088425ba51adc6b8d383c13db17a029c7982':
             'f312ee3cfd634969910642b3d3686858364bc48740d76b993187a225ce1e967e',
            '0x402ed1f201d74382ad51a5ae45e5d6f0c76d037a1dc4e573bfe032f387d46860':
             'f312ee3cfd634969910642b3d3686858364bc48740d76b993187a225ce1e967e' } } }
