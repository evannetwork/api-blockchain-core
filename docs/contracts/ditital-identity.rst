================================================================================
DigitalIdentity
================================================================================

.. list-table:: 
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - DigitalIdentity
   * - Extends
     - `Logger <../common/logger.html>`_
   * - Source
     - `digital-identity.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/contracts/digital-identity/digital-identity.ts>`_
   * - Examples
     - `digital-identity.spec.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/contracts/digital-identity/digital-identity.spec.ts>`_

This place is reserved for a more detailed explanation about what a digital identity is and what it is used for. Examples offer clear and practical approach on how to interact with it and how someone can embed Digital Identities in ones own code.

Amet sunt velit non dolor dolore culpa occaecat consectetur dolor consequat nisi nisi quis amet culpa laboris ut tempor elit laboris aute mollit in esse voluptate excepteur ea esse sint ut ullamco adipisicing esse irure in id.

Cillum irure eiusmod mollit et cupidatat laboris pariatur dolore in aliqua in dolor aute non do ex do sed amet exercitation culpa proident.

Eiusmod ut mollit sed ea commodo aliqua reprehenderit veniam in dolore ut incididunt labore incididunt.



--------------------------------------------------------------------------------

.. _digital-identity_constructor:

constructor
================================================================================

.. code-block:: typescript

  new DigitalIdentity(options, config);

Create new ``DigitalIdentity`` instance. This will not create a smart contract contract but is used to
load existing digital identities. To create a new contract, use the static :ref:`create <digital-identity_create>` function.

----------
Parameters
----------

#. ``options`` - ``DigitalIdentityOptions``: runtime-like object with required modules
    * ``contractLoader`` - |source contractLoader|_: |source contractLoader|_ instance
    * ``cryptoProvider`` - |source cryptoProvider|_: |source cryptoProvider|_ instance
    * ``dataContract`` - |source dataContract|_: |source dataContract|_ instance
    * ``description`` - |source description|_: |source description|_ instance
    * ``executor`` - |source executor|_: |source executor|_ instance
    * ``nameResolver`` - |source nameResolver|_: |source nameResolver|_ instance
    * ``rightsAndRoles`` - |source rightsAndRoles|_: |source rightsAndRoles|_ instance
    * ``sharing`` - |source sharing|_: |source sharing|_ instance
    * ``verifications`` - |source verifications|_: |source verifications|_ instance
    * ``web3`` - |source web3|_: |source web3|_ instance
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``
#. ``config`` - ``DigitalIdentityConfig``: digital identity related config
    * ``accountId`` - ``string``: account id of user, that interacts with digital identity
    * ``containerConfig`` - ``ContainerConfig``: address of a ``DigitalIdentity`` instance, can be ENS or contract address
    * ``address`` - ``string`` (optional): address of an ``IndexContract`` instance, can be ENS or contract address
    * ``description`` - ``string``: description has to be passed to ``.create`` to apply it to to contract
    * ``factoryAddress`` - ``string`` (optional): factory address can be passed to ``.create`` for customer digital identity factory

-------
Returns
-------

``DigitalIdentity`` instance

-------
Example
-------

.. code-block:: typescript

  const digitalIdentity = new DigitalIdentity(
    runtime,
    {
      accountId: '0x0000000000000000000000000000000000000000',
      address: 'sample-digital-identity.somewhere.evan',
    },
  );



--------------------------------------------------------------------------------

= Creating Digital Identities =
===============================

.. _digital-identity_create:

create
================================================================================

.. code-block:: typescript

  DigitalIdentity.create(runtime, config);

Create digital identity contract.

Note, that this function is static. It is used on the ``DigitalIdentity`` class object and returns a ``DigitalIdentity`` class instance.

The options argument has the same structure as the options object that is passed to the constructor as it is used for the new ``DigitalIdentity`` instance. The ``config`` argument requires a proper value for the property ``description``.

----------
Parameters
----------

#. ``options`` - ``ContainerOptions``: runtime-like object with required modules
    * ``contractLoader`` - |source contractLoader|_: |source contractLoader|_ instance
    * ``cryptoProvider`` - |source cryptoProvider|_: |source cryptoProvider|_ instance
    * ``dataContract`` - |source dataContract|_: |source dataContract|_ instance
    * ``description`` - |source description|_: |source description|_ instance
    * ``executor`` - |source executor|_: |source executor|_ instance
    * ``nameResolver`` - |source nameResolver|_: |source nameResolver|_ instance
    * ``rightsAndRoles`` - |source rightsAndRoles|_: |source rightsAndRoles|_ instance
    * ``sharing`` - |source sharing|_: |source sharing|_ instance
    * ``verifications`` - |source verifications|_: |source verifications|_ instance
    * ``web3`` - |source web3|_: |source web3|_ instance
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``
#. ``config`` - ``DigitalIdentityConfig``: digital identity related config
    * ``accountId`` - ``string``: account id of user, that interacts with digital identity
    * ``containerConfig`` - ``ContainerConfig``: config, that will be used, when containers are created
    * ``address`` - ``string`` (optional): ENS address used for digital identity
    * ``description`` - ``string``: description has to be passed to ``.create`` to apply it to to contract
    * ``factoryAddress`` - ``string`` (optional): factory address can be passed to ``.create`` for customer digital identity factory

-------
Returns
-------

``Promise`` returns ``DigitalIdentity``: new instance bound to new ``IndexContract``

-------
Example
-------

.. code-block:: typescript

  const digitalIdentity = await DigitalIdentity.create(options, config);
  console.log(await digitalIdentity.getContractAddress());
  // Output:
  // 0x0000000000000000000000000000000000001234



.. required for building markup

.. |source contractLoader| replace:: ``ContractLoader``
.. _source contractLoader: ../contracts/contract-loader.html

.. |source dataContract| replace:: ``DataContract``
.. _source dataContract: ../contracts/data-contract.html

.. |source cryptoProvider| replace:: ``CryptoProvider``
.. _source cryptoProvider: /encryption/crypto-provider.html

.. |source description| replace:: ``Description``
.. _source description: ../blockchain/description.html

.. |source executor| replace:: ``Executor``
.. _source executor: ../blockchain/executor.html

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: ../common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: ../common/logger.html#logloginterface

.. |source nameResolver| replace:: ``NameResolver``
.. _source nameResolver: ../blockchain/name-resolver.html

.. |source rightsAndRoles| replace:: ``RightsAndRoles``
.. _source rightsAndRoles: ../contracts/rights-and-roles.html

.. |source sharing| replace:: ``Sharing``
.. _source sharing: ../contracts/sharing.html

.. |source verifications| replace:: ``Verifications``
.. _source verifications: ../profile/verifications.html

.. |source web3| replace:: ``Web3``
.. _source web3: https://github.com/ethereum/web3.js/
