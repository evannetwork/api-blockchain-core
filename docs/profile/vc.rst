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

The `Vc` module allows to create, store, retrieve and revoke VCs on evan.network.
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

#. ``options`` - ``DidOptions``: options for Vc constructor.
    * ``accountStore`` - |source accountStore|_: |source accountStore|_ instance
    * ``activeAccount`` - ``string``: ID of the active account
    * ``contractLoader`` - |source contractLoader|_: |source contractLoader|_ instance
    * ``dfs`` - |source dfsInterface|_: |source dfsInterface|_ instance
    * ``did`` - |source Did|_: |source Did|_ instance for resolving and validating
    * ``executor`` - |source executor|_: |source executor|_ instance
    * ``nameResolver`` - |source nameResolver|_: |source nameResolver|_ instance
    * ``signerIdentity`` - |source signerIdentity|_: |source signerIdentity|_ instance
    * ``verifications`` - |source verifications|_: |source verifications|_ instance
    * ``web3`` - |source web3|_: |source web3|_ instance
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``
#. ``config`` - ``VcConfig``: custom configuration for Vc constructor.
    * ``credentialStatusEndpoint`` - ``string``: URL of the credential status endpoint

-------
Returns
-------

``Vc`` instance

-------
Example
-------

.. code-block:: typescript

  const vc = new Vc(
    {
      accountStore,
      activeIdentity
      contractLoader,
      dfs,
      did,
      executor,
      nameResolver,
      signerIdentity,
      verifications,
      web3,
    },
    { credentialStatusEndpoint },
  );



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

#. ``vcData`` - :ref:`VcDocumentTemplate`: Collection of mandatory and optional VC properties to store in the VC document

-------
Returns
-------

``Promise`` returns ``VcDocument``: The final VC document

-------
Example
-------

.. code-block:: typescript

  const minimalVcData = {
      id: 'randomCustomId',
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

.. _vc_getVc_VcEncryptionInfo:

getVc
================================================================================

Get VC document for given VC ID.

.. code-block:: typescript

  vc.getVc(vcId, encryptionInfo);

----------
Parameters
----------

#. ``vcId`` - ``string``: ID to fetch VC document for. Can be either a full VC URI (starting with ``vc:evan:``) or just the VC ID (starting with ``0x``)
#. ``encryptionInfo`` - :ref:`VcEncryptionInfo`: (optional): Information required for decryption

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

  // using encryption
  encryptionInfo = { key: vcKey };
  const EncryptedVcDoc = await vc.getVc( 'vc:evan:testcore:0x5f7514378963d3a1211a3b015c51dd9fbd1e52d66a2fbb411fcdf80fdfd7bbd4', encryptionInfo);

--------------------------------------------------------------------------------


.. _vc_storeVc_VcEncryptionInfo:
.. _vc_storeVc_VcDocumentTemplate:
.. _vc_storeVc_Vc:

storeVc
================================================================================

.. code-block:: typescript

  vc.storeVc(vcData, encryptionInfo);

Create a new VC that holds the given data and **store it on the chain**.
Whether a new ID should be registered with the VC registry or the given ID in the document should be used depends of if ``vcData.id`` is set. If set, the method calls ``createId()`` to generate a new ID.

----------
Parameters
----------

#. ``vcData`` - :ref:`VcDocumentTemplate`: Collection of mandatory and optional VC properties to store in the VC document
#. ``encryptionInfo`` - :ref:`VcEncryptionInfo`: (optional): Information required for encryption

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
  const createdVcDoc = await runtime.vc.storeVc(minimalVcData);
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

``Promise`` returns ``bool``: true for revoked, false for not revoked

-------
Example
-------

.. code-block:: typescript

  const storedVcDoc = await vc.getVc(permanentVcAddress);
  const vcId = storedVcDoc.id;

  const vcRevokeStatus = await vc.getRevokeVcStatus(vcId);



--------------------------------------------------------------------------------

Additional Components
======================


Interfaces
==========

.. _VcEncryptionInfo:

--------------
EncryptionInfo
--------------

configuration settings required for the encryption and decryption

#. ``key``-``string``: the encryption key required for encrypting and decrypting the VC



.. _VcDocumentTemplate:

----------------
DocumentTemplate
----------------

Template for the VC document containing the relevant data

#. ``id``-``string``: the id of the VC
#. ``type``-``string``: set of unordered URIs
#. ``issuer``- :ref:`VcIssuer`: VC issuer details
#. ``validFrom``-``string``: date from which the VC is valid
#. ``validUntil``-``string`` (optional): date until which the VC is valid
#. ``credentialSubject``- :ref:`VcCredentialSubject`: subject details of VC
#. ``credentialStatus``- :ref:`VcCredentialStatus` (optional): details regarding the status of VC
#. ``proof``- :ref:`VcProof` (optional): proof of the respective VC



.. _VcIssuer:

--------
VcIssuer
--------

Template for the VC Issuer containing the relevant data

#. ``id``-``string``: the id of the issuer
#. ``name``-``string`` (optional): name of the issuer



.. _VcCredentialSubject:

-------------------
VcCredentialSubject
-------------------

Template for the VC credential subject containing the relevant data

#. ``id``-``string``: the id of the subject
#. ``data``-``VcCredentialSubjectPayload`` (optional): data payload for subject
#. ``description``-``string`` (optional): description about subject
#. ``uri``-``string`` (optional): uri of subject 



.. _VcCredentialStatus:

------------------
VcCredentialStatus
------------------

Template for the VC credential status containing the status data

#. ``id``-``string``: the id of the VC
#. ``type``-``string``: VC status type 



.. _VcProof:

-------
VcProof
-------

proof for VC, contains JWS and metadata

#. ``type``-``string``: VC status type
#. ``created``-``string``: date when the proof was created
#. ``proofPurpose``-``string``: purpose of the proof
#. ``verificationmethod``-``string``: method used for verification
#. ``jws``-``string``: JSON Web Signature



--------------------------------------------------------------------------------

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
