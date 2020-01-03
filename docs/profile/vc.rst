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
    * ``credentialStatusEndpoint`` - ``string``: URL of the credential status endpoint
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
    credentialStatusEndpoint,
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

.. _vc_createId:

createId
================================================================================

Claim a new ID in the VC registry which can be used later to store a VC **on-chain**.

.. code-block:: typescript

  vc.createId();


-------
Returns
-------

``Promise`` returns ``string``: A new ID string

-------
Example
-------

.. code-block:: typescript

  const newRegisteredId = await runtime.vc.createId();
  const myVcDocument = {
    // Data here,
    id: newRegisteredId
  };
  await runtime.vc.storeVc(myVcDocument);

--------------------------------------------------------------------------------

.. _vc_createVc:

createVc
================================================================================

Create a signed **off-chain** VC document

.. code-block:: typescript

  vc.createVc(vcData);

----------
Parameters
----------

#. ``vcData`` - ``VcDocumentTemplate``: Collection of mandatory and optional VC properties to store in the VC document

-------
Returns
-------

``Promise`` returns ``VcDocument``: The final VC document

-------
Example
-------

.. code-block:: typescript

  const minimalVcData = {
      issuer: {
        did: 'someDid',
      },
      credentialSubject: {
        did: 'someOtherDid',
      },
      validFrom: new Date(Date.now()).toISOString()
  };
  const offchainVc = await runtime.vc.createVc(minimalVcData);

--------------------------------------------------------------------------------

.. _vc_getVc:

getVc
================================================================================

Get VC document for given VC ID.

.. code-block:: typescript

  vc.getVc(vcId);

----------
Parameters
----------

#. ``vcId`` - ``string``: ID to fetch VC document for. Can be either a full VC URI (starting with ``vc:evan:``) or just the VC ID (starting with ``0x``)

-------
Returns
-------

``Promise`` returns ``VcDocument``: A VC document

-------
Example
-------

.. code-block:: typescript

  const storedVcDoc = await vc.getVc('0x2a838a6961be98f6a182f375bb9158848ee9760ca97a379939ccdf03fc442a23');
  const otherStoredVcDoc = await vc.getVc('vc:evan:testcore:0x2a838a6961be98f6a182f375bb9158848ee9760ca97a379939ccdf03fc442a23');

--------------------------------------------------------------------------------


.. _vc_storeVc:

storeVc
================================================================================

.. code-block:: typescript

  vc.storeVc(vcData, shouldRegisterNewId);

Create a new VC that holds the given data and **store it on the chain**.

----------
Parameters
----------

#. ``vcData`` - ``VcDocumentTemplate``: Collection of mandatory and optional VC properties to store in the VC document
#. ``shouldRegisterNewId`` - ``boolean``: Whether a new ID should be registered with the VC registry or the given ID in the document should be used (default: false). If true, the method calls ``createId()``.

-------
Returns
-------

``Promise`` returns ``VcDocument``: Returns the VC document as stored on the chain.

-------
Example
-------

.. code-block:: typescript

  const minimalVcData = {
      issuer: {
        did: 'someDid',
      },
      credentialSubject: {
        did: 'someOtherDid',
      },
      validFrom: new Date(Date.now()).toISOString()
  };
  const createdVcDoc = await runtime.vc.storeVc(minimalVcData, true);
  const permanentVcAddress = createdVcDoc.id;

.. code-block:: typescript
  const myRegisteredId = await runtime.vc.createId();
  const minimalVcData = {
      issuer: {
        did: 'someDid',
      },
      credentialSubject: {
        did: 'someOtherDid'
      },
      validFrom: new Date(Date.now()).toISOString()
  };
  minimalVcData.id = myRegisteredId;
  const createdVcDoc = await runtime.vc.storeVc(minimalVcData);
  const permanentVcAddress = createdVcDoc.id;




--------------------------------------------------------------------------------

.. _vc_revokeVc:

revokeVc
================================================================================

.. code-block:: typescript

  vc.revokeVc(vcId);

Sets a revoke status flag for the VC.

----------
Parameters
----------

#. ``vcId`` - ``string``: ID for VC document to be revoked.

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const storedVcDoc = await vc.getVc(permanentVcAddress);
  const vcId = storedVcDoc.id;

  const revokeProcessed = await vc.revokeVc(vcId);



--------------------------------------------------------------------------------

.. _vc_getRevokeVcStatus:

getRevokeVcStatus
================================================================================

.. code-block:: typescript

  vc.getRevokeVcStatus(vcId);

Gets the revoke status flag for the VC.

----------
Parameters
----------

#. ``vcId`` - ``string``: ID for VC document whose status needs to be retrieved.

-------
Returns
-------

``Promise`` returns ``revokationStatus``: A boolean true or false

-------
Example
-------

.. code-block:: typescript

  const storedVcDoc = await vc.getVc(permanentVcAddress);
  const vcId = storedVcDoc.id;

  const vcRevokeStatus = await vc.getRevokeVcStatus(vcId);




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
