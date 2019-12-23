================================================================================
VC
================================================================================

.. list-table::
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - Vc
   * - Extends
     - `Logger <../common/logger.html>`_
   * - Source
     - `vc.ts <https://github.com/evannetwork/api-blockchain-core/blob/master/src/vc/vc.ts>`_
   * - Tests
     - `vc.spec.ts <https://github.com/evannetwork/api-blockchain-core/blob/master/src/vc/vc.spec.ts>`_

The `Vc` module allows to create, store, and retrieve VCs on evan.network.
As development of identities, and DID and VC handling on evan.network is an ongoing process, this document
describes the current interoperability of VCs on evan.network and can be seen as a work-in-progress state
of the current implementation.



--------------------------------------------------------------------------------

.. _vc_constructor:

constructor
================================================================================

.. code-block:: typescript

  new Vc(options, did);

Creates a new `Vc` instance.

----------
Parameters
----------

#. ``options`` - ``DidOptions``: options for Did constructor.
    * ``accountStore`` - |source accountStore|_: |source accountStore|_ instance
    * ``activeAccount`` - ``string``: ID of the active account
    * ``contractLoader`` - |source contractLoader|_: |source contractLoader|_ instance
    * ``dfs`` - |source dfsInterface|_: |source dfsInterface|_ instance
    * ``executor`` - |source executor|_: |source executor|_ instance
    * ``nameResolver`` - |source nameResolver|_: |source nameResolver|_ instance
    * ``signerIdentity`` - |source signerIdentity|_: |source signerIdentity|_ instance
    * ``verifications`` - |source verifications|_: |source verifications|_ instance
    * ``web3`` - |source web3|_: |source web3|_ instance
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``
#. ``did`` - |source Did|_: |source Did|_ instance for resolving and validating

-------
Returns
-------

``Vc`` instance

-------
Example
-------

.. code-block:: typescript

  const vc = new Vc({
    accountStore,
    activeIdentity
    contractLoader,
    dfs,
    executor,
    nameResolver,
    signerIdentity,
    verifications,
    web3,
  }, did);



--------------------------------------------------------------------------------

= Working with VC documents =
==============================

.. _vc_setVc:

setVc
================================================================================

.. code-block:: typescript

  vc.setVc(vcData);

Store a new VC that holds the given data.

----------
Parameters
----------

#. ``vcData`` - ``VcDocumentTemplate``: Collection of mandatory and optional VC properties to store in the VC document

-------
Returns
-------

``Promise`` returns ``VcDocument``: Returns the actual saved VC document.

-------
Example
-------

.. code-block:: typescript

  const minimalVcData = {
      issuer: {
        did: "someDid",
      },
      credentialSubject: {
        did: "someOtherDid",
      },
      validFrom: new Date(Date.now()).toISOString()
  };
  const createdVcDoc = await runtime.vc.setVc(minimalVcData);
  const permanentVcAddress = createdVcDoc.id;



--------------------------------------------------------------------------------

.. _vc_getVc:

getVc
================================================================================

.. code-block:: typescript

  vc.getVc(vcId);

Get VC document for given VC ID.

----------
Parameters
----------

#. ``vcId`` - ``string``: ID to fetch VC document for.

-------
Returns
-------

``Promise`` returns ``VcDocument``: A VC document

-------
Example
-------

.. code-block:: typescript

  const minimalVcData = {
      issuer: {
        did: "someDid",
      },
      credentialSubject: {
        did: "someOtherDid",
      },
      validFrom: new Date(Date.now()).toISOString()
  };
  const createdVcDoc = await vc.setVc(minimalVcData);
  const permanentVcAddress = createdVcDoc.id;

  const storedVcDoc = await vc.getVc(permanentVcAddress);




.. required for building markup

.. |source accountStore| replace:: ``AccountStore``
.. _source accountStore: ../blockchain/account-store.html

.. |source contractLoader| replace:: ``ContractLoader``
.. _source contractLoader: ../contracts/contract-loader.html

.. |source did| replace:: ``Did``
.. _source did: ./did.html

.. |source dfsInterface| replace:: ``DfsInterface``
.. _source dfsInterface: ../dfs/dfs-interface.html

.. |source executor| replace:: ``Executor``
.. _source executor: ../blockchain/executor.html

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: ../common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: ../common/logger.html#logloginterface

.. |source nameResolver| replace:: ``NameResolver``
.. _source nameResolver: ../blockchain/name-resolver.html

.. |source signerIdentity| replace:: ``SignerIdentity``
.. _source signerIdentity: ../blockchain/signer-identity.html

.. |source verifications| replace:: ``Verifications``
.. _source verifications: ./verifications.html

.. |source web3| replace:: ``Web3``
.. _source web3: https://github.com/ethereum/web3.js/
