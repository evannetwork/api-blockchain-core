================================================================================
DID
================================================================================

.. list-table::
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - Did
   * - Extends
     - `Logger <../common/logger.html>`_
   * - Source
     - `did.ts <https://github.com/evannetwork/api-blockchain-core/blob/master/src/did/did.ts>`_
   * - Tests
     - `did.spec.ts <https://github.com/evannetwork/api-blockchain-core/blob/master/src/did/did.spec.ts>`_

The `Did` module allows to interact with DIDs on evan.network. As development of identity and DID handling on evan.network is an ongoing process, this document describes the current interoperability of DIDs on evan.network and can be seen as a work-in-progress state of the current implementation.



--------------------------------------------------------------------------------

.. _did_constructor:

constructor
================================================================================

.. code-block:: typescript

  new Did(options);

Creates a new `Did` instance.

----------
Parameters
----------

#. ``options`` - ``DidOptions``: options for Did constructor.
    * ``contractLoader`` - |source contractLoader|_: |source contractLoader|_ instance
    * ``dfs`` - |source dfsInterface|_: |source dfsInterface|_ instance
    * ``executor`` - |source executor|_: |source executor|_ instance
    * ``nameResolver`` - |source nameResolver|_: |source nameResolver|_ instance
    * ``signerIdentity`` - |source signerIdentity|_: |source signerIdentity|_ instance
    * ``web3`` - |source web3|_: |source web3|_ instance
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``
#. ``config`` - ``DidConfig`` (optional): description, defaults to ``123``
    * ``registryAddress`` - ``string`` (optional): contract address or ENS name for `DidRegistry`

-------
Returns
-------

``Did`` instance

-------
Example
-------

.. code-block:: typescript

  const did = new Did({
    contractLoader,
    dfs,
    executor,
    nameResolver,
    signerIdentity,
    web3,
  });



--------------------------------------------------------------------------------

= Working with DID documents =
==============================

.. _did_deactivateDidDocument:

deactivateDidDocument
================================================================================

.. code-block:: typescript

  did.deactivateDidDocument(did);

Unlinks the current DID document from the given DID

----------
Parameters
----------

#. ``did`` - ``string``: DID to unlink the DID document from

-------
Returns
-------

``Promise`` returns ``void``: Resolves when done

-------
Example
-------

.. code-block:: typescript

    const twinIdentity = '0x1234512345123451234512345123451234512345';
    const twinDid = await runtime.did.convertIdentityToDid(twinIdentity);
    await runtime.did.deactivateDidDocument(twinDid);


--------------------------------------------------------------------------------


.. _did_didIsDeactivated:

didIsDeactivated
================================================================================

.. code-block:: typescript

  did.didIsDeactivated(did);

Gets the deactivation status of a DID.

----------
Parameters
----------

#. ``did`` - ``string``: DID to check

-------
Returns
-------

``Promise`` returns ``boolean``: True if the DID has been deactivated

-------
Example
-------

.. code-block:: typescript

    const twinIdentity = '0x1234512345123451234512345123451234512345';
    const twinDid = await runtime.did.convertIdentityToDid(twinIdentity);
    await runtime.did.deactivateDidDocument(twinDid);
    console.log(await runtime.did.didIsDeactivated(twinDid));
    // Output: true


--------------------------------------------------------------------------------


.. _did_getDidDocument:

getDidDocument
================================================================================

.. code-block:: typescript

  did.getDidDocument(did);

Get DID document for given DID.

----------
Parameters
----------

#. ``did`` - ``string``: DID to fetch DID document for.

-------
Returns
-------

``Promise`` returns ``any``: a DID document that MAY resemble `DidDocumentTemplate` format

-------
Example
-------

.. code-block:: typescript

  const identity = await runtime.verifications.getIdentityForAccount(accountsId, true);
  const did = await runtime.did.convertIdentityToDid(identity);
  const document = await runtime.did.getDidDocumentTemplate();
  await runtime.did.setDidDocument(did, document);
  const retrieved = await runtime.did.getDidDocument(did);


--------------------------------------------------------------------------------

.. _did_getService:

getService
================================================================================

.. code-block:: typescript

  did.getService(did);

Get the services from a DID document.

----------
Parameters
----------

#. ``did`` - ``string``: DID to fetch DID service for.

-------
Returns
-------

``Promise`` returns ``DidServiceEntry[] | DidServiceEntry``: Array of services, or a single service entry object.

-------
Example
-------

.. code-block:: typescript

  const document = await runtime.did.getDidDocumentTemplate();
  const identity = await runtime.verifications.getIdentityForAccount(account, true);
  const did = await runtime.did.convertIdentityToDid(identity);
  await runtime.did.setDidDocument(did, document);
  const service = [{
    id: `${did}#randomService`,
    type: `randomService-${random}`,
    serviceEndpoint: `https://openid.example.com/${random}`,
  }];
  await runtime.did.setService(did, service);
  const retrieved = await runtime.did.getService(did);

--------------------------------------------------------------------------------

.. _did_setDidDocument:

setDidDocument
================================================================================

.. code-block:: typescript

  did.setDidDocument(did, document);

Store given DID document for given DID.

----------
Parameters
----------

#. ``did`` - ``string``: DID to store DID document for
#. ``document`` - ``any``: DID document to store, ``getDidDocumentTemplate`` can be used as a starting point for DID documents

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const identity = await runtime.verifications.getIdentityForAccount(accountsId, true);
  const did = await runtime.did.convertIdentityToDid(identity);
  const document = await runtime.did.getDidDocumentTemplate();
  await runtime.did.setDidDocument(did, document);

--------------------------------------------------------------------------------

.. _did_setService:

setService
================================================================================

.. code-block:: typescript

  did.setService(did, service);

Sets service in DID document.

----------
Parameters
----------

#. ``did`` - ``string``: DID name to set service for
#. ``service`` - ``DidServiceEntry[] | DidServiceEntry``: service or array of services to set

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  const document = await runtime.did.getDidDocumentTemplate();
  const identity = await runtime.verifications.getIdentityForAccount(account, true);
  const did = await runtime.did.convertIdentityToDid(identity);
  await runtime.did.setDidDocument(did, document);
  const service = [{
    id: `${did}#randomService`,
    type: `randomService-${random}`,
    serviceEndpoint: `https://openid.example.com/${random}`,
  }];
  await runtime.did.setService(did, service);



--------------------------------------------------------------------------------

= utilities =
==============================

.. _did_convertDidToIdentity:

convertDidToIdentity
================================================================================

.. code-block:: typescript

  did.convertDidToIdentity(did);

Converts given DID to a evan.network identity.

----------
Parameters
----------

#. ``did`` - ``string``: a DID like "did:evan:testcore:0x000000000000000000000000000000000000001234"

-------
Returns
-------

``Promise`` returns ``string``: evan.network identity like "0x000000000000000000000000000000000000001234"

-------
Example
-------

.. code-block:: typescript

  const did = 'did:evan:testcore:0x000000000000000000000000000000000000001234';
  const identity = await did.convertDidToIdentity(did);
  console.log(identity);
  // Output:
  // 0x000000000000000000000000000000000000001234



--------------------------------------------------------------------------------

.. _did_convertIdentityToDid:

convertIdentityToDid
================================================================================

.. code-block:: typescript

  did.convertIdentityToDid(identity);

Converts given evan.network identity hash to DID.

----------
Parameters
----------

#. ``identity`` - ``string``: evan.network identity like "0x000000000000000000000000000000000000001234"

-------
Returns
-------

``Promise`` returns ``string``: a DID like "did:evan:testcore:0x000000000000000000000000000000000000001234"

-------
Example
-------

.. code-block:: typescript

  const identity = '0x000000000000000000000000000000000000001234';
  const did = await did.convertIdentityToDid(identity);
  console.log(did);
  // Output:
  // did:evan:testcore:0x000000000000000000000000000000000000001234

deactivateDidDocument

--------------------------------------------------------------------------------

.. _did_getDidDocumentTemplate:

getDidDocumentTemplate
================================================================================

.. code-block:: typescript

  did.getDidDocumentTemplate([]);

Gets a DID document for currently configured account/identity pair. Notice, that this document may a
complete DID document for currently configured active identity, a part of it or not matching it at
all. You can use the result of this function to build a new DID document but should extend it or an
existing DID document, if your details derive from default format.

All three arguments are optional. When they are used, all of them have to be given and the result
then describes a contracts DID document. If all of them are omitted the result describes an accounts
DID document.

----------
Parameters
----------

#. ``did`` - ``string`` (optional): contract DID
#. ``controllerDid`` - ``string`` (optional): controller of contracts identity (DID)
#. ``authenticationKey`` - ``string`` (optional): authentication key used for contract

-------
Returns
-------

``Promise`` returns ``DidDocumentTemplate``: template for DID document

-------
Example
-------

.. code-block:: typescript

  const document = await runtime.did.getDidDocumentTemplate();
  console.log(JSON.stringify(document, null, 2));
  // Output:
  // {
  //   "@context": "https://w3id.org/did/v1",
  //   "id": "did:evan:testcore:0x126E901F6F408f5E260d95c62E7c73D9B60fd734",
  //   "publicKey": [
  //     {
  //       "id": "did:evan:testcore:0x126E901F6F408f5E260d95c62E7c73D9B60fd734#key-1",
  //       "type": "Secp256k1VerificationKey2018",
  //       "owner": "did:evan:testcore:0x126E901F6F408f5E260d95c62E7c73D9B60fd734",
  //       "ethereumAddress": "0x126E901F6F408f5E260d95c62E7c73D9B60fd734"
  //     }
  //   ],
  //   "authentication": [
  //     "did:evan:testcore:0x126E901F6F408f5E260d95c62E7c73D9B60fd734#key-1"
  //   ]
  // }



.. required for building markup

.. |source contractLoader| replace:: ``ContractLoader``
.. _source contractLoader: ../contracts/contract-loader.html

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

.. |source web3| replace:: ``Web3``
.. _source web3: https://github.com/ethereum/web3.js/
.. _source nameResolver: ../blockchain/name-resolver.html

.. |source signerIdentity| replace:: ``SignerIdentity``
.. _source signerIdentity: ../blockchain/signer-identity.html

.. |source web3| replace:: ``Web3``
.. _source web3: https://github.com/ethereum/web3.js/
