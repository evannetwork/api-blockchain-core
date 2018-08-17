================================================================================
Service Contract
================================================================================

.. list-table:: 
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - ServiceContract
   * - Extends
     - `Logger <../common/logger.html>`_
   * - Source
     - `service-contract.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/contracts/service-contract/service-contract.ts>`_
   * - Examples
     - `service-contract.spec.ts <https://github.com/evannetwork/api-blockchain-core/tree/master/src/contracts/service-contract/service-contract.spec.ts>`_



.. _serviceContract_constructor:

constructor
================================================================================

.. code-block:: typescript

  new ServiceContract(options);

Creates a new ServiceContract instance.

----------
Parameters
----------

#. ``options`` - ``ServiceContractOptions``: options for ServiceContract constructor.
    * ``cryptoProvider`` - |source cryptoProvider|_: |source cryptoProvider|_ instance
    * ``dfs`` - |source dfsInterface|_: |source dfsInterface|_ instance
    * ``keyProvider`` - |source keyProvider|_: |source keyProvider|_ instance
    * ``sharing`` - |source sharing|_: |source sharing|_ instance
    * ``web3`` - |source web3|_: |source web3|_ instance
    * ``defaultCryptoAlgo`` - ``string`` (optional): crypto algorith name from |source cryptoProvider|, defaults to ``aes`` 
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``

-------
Returns
-------

``ServiceContract`` instance

-------
Example
-------

.. code-block:: typescript
  
  const serviceContract = new ServiceContract({
      cryptoProvide,
      dfs,
      executor,
      keyProvider,
      loader,
      nameResolver,
      sharing,
      web3,
    });



--------------------------------------------------------------------------------

.. _service-contract_create:

create
================================================================================

.. code-block:: typescript

  serviceContract.create(accountId, businessCenterDomain, service[, descriptionDfsHash]);

create and initialize new contract

----------
Parameters
----------

#. ``accountId`` - ``string``: owner of the new contract and transaction executor
#. ``businessCenterDomain`` - ``string``: ENS domain name of the business center
#. ``service`` - ``any``: service definition
#. ``descriptionHash`` - ``string`` (optional): bytes2 hash of DBCP description, defaults to ``0x0000000000000000000000000000000000000000000000000000000000000000``

-------
Returns
-------

``Promise`` returns ``any``: contract instance

-------
Example
-------

.. code-block:: typescript

  const serviceContract = await serviceContract.create(accounts[0], businessCenterDomain, sampleService);



--------------------------------------------------------------------------------

.. _service-contract_service:

= Service =
===========

The service is the communication pattern definition for the ``ServiceContract``. A single service contract can only have one service definition and all calls and answers must follow its defition.

To create calls and answers with different patterns, create a new ``ServiceContract`` and use an updated service definition there.



--------------------------------------------------------------------------------

.. _serviceContract_setService:

setService
================================================================================

.. code-block:: typescript

  serviceContract.setService(contract, accountId, service, businessCenterDomain[, skipValidation]);

Set service description.

----------
Parameters
----------

#. ``contract`` - ``any|string``: smart contract instance or contract ID
#. ``accountId`` - ``string``: Ethereum account ID
#. ``service`` - ``any``: service to set
#. ``businessCenterDomain`` - ``string``: domain of the business the service contract belongs to
#. ``skipValidation`` - ``bool`` (optional): skip validation of service definition, validation is enabled by default

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  await serviceContract.setService(contract, accounts[0], sampleService, businessCenterDomain);



.. _serviceContract_getService:

getService
================================================================================

.. code-block:: typescript

  serviceContract.getService(contract, accountId);

Gets the service of a service contract.

----------
Parameters
----------

#. ``contract`` - ``any|string``: smart contract instance or contract ID
#. ``accountId`` - ``string``: Ethereum account ID

-------
Returns
-------

``Promise`` returns ``string``: service description as JSON string

-------
Example
-------

.. code-block:: typescript

  const service = await sc.getService(contract, accounts[0]);



--------------------------------------------------------------------------------

.. _service-contract_calls:

= Calls =
===========

Calls are the requests done by authors, that initiate a service conversation. They are basically the first part of conversations and allow answers to be added to them. Calls are usually broadcasted or multicasted.

Samples for calls are:

- capacity requests
- information requests
- information broadcasts



.. _service-contract_sendCall:

sendCall
================================================================================

.. code-block:: typescript

  serviceContract.sendCall(contract, accountId, call);

Send a call to a service.

----------
Parameters
----------

#. ``contract`` - ``any|string``: smart contract instance or contract ID
#. ``accountId`` - ``string``: Ethereum account ID
#. ``call`` - ``any``: call to send

-------
Returns
-------

``Promise`` returns ``number``: id of new call

-------
Example
-------

.. code-block:: typescript

  const callId = await serviceContract.sendCall(contract, accounts[0], sampleCall);



--------------------------------------------------------------------------------

.. _service-contract_getCalls:

getCalls
================================================================================

.. code-block:: typescript

  serviceContract.getCalls(contract, accountId[, count, offset, reverse]);

Get all calls from a contract.

----------
Parameters
----------

#. ``contract`` - ``any|string``: smart contract instance or contract ID
#. ``accountId`` - ``string``: Ethereum account ID
#. ``count`` - ``number`` (optional): number of elments to retrieve, defaults to ``10``
#. ``offset`` - ``number`` (optional): skip this many elements, defaults to ``0``
#. ``reverse`` - ``boolean`` (optional): retrieve last elements first, defaults to ``false``


-------
Returns
-------

``Promise`` returns ``any[]``: the calls

-------
Example
-------

.. code-block:: typescript

  const calls = await serviceContract.getCalls(contract, accounts[0]);



--------------------------------------------------------------------------------

.. _service-contract_getCall:

getCall
================================================================================

.. code-block:: typescript

  serviceContract.getCall(contract, accountId, callId);

Get a call from a contract.

----------
Parameters
----------

#. ``contract`` - ``any|string``: smart contract instance or contract ID
#. ``accountId`` - ``string``: Ethereum account ID
#. ``callId`` - ``number``: index of the call to retrieve

-------
Returns
-------

``Promise`` returns ``any``: a single call

-------
Example
-------

.. code-block:: typescript

  const call = await serviceContract.getCall(contract, accounts[0], 12);



--------------------------------------------------------------------------------

.. _service-contract_getCallCount:

getCallCount
================================================================================

.. code-block:: typescript

  serviceContract.getCallCount(contract);

Get number of calls of a contract.

----------
Parameters
----------

#. ``contract`` - ``any|string``: smart contract instance or contract ID

-------
Returns
-------

``Promise`` returns ``number``: number of calls

-------
Example
-------

.. code-block:: typescript

  let callCount = await serviceContract.getCallCount(contract);
  console.log(callCount);
  // Output:
  // 2
  await serviceContract.sendCall(contract, accounts[0], sampleCall);
  callCount = await serviceContract.getCallCount(contract);
  console.log(callCount);
  // Output:
  // 3



--------------------------------------------------------------------------------

.. _service-contract_getCallOwner:

getCallOwner
================================================================================

.. code-block:: typescript

  serviceContract.getCallOwner(contract, callId);

Gets the owner/creator of a call.

----------
Parameters
----------

#. ``contract`` - ``any|string``: smart contract instance or contract ID
#. ``callId`` - ``number``: index of the call to retrieve owner for

-------
Returns
-------

``Promise`` returns ``string``: account id of call owner

-------
Example
-------

.. code-block:: typescript

  console.log(await serviceContract.getCallOwner(contract, 2));
  // Output:
  0x0000000000000000000000000000000000000001



--------------------------------------------------------------------------------

.. _servicecontract_addToCallSharing:

addToCallSharing
================================================================================

.. code-block:: typescript

  serviceContract.addToCallSharing(contract, accountId, callId, to[, hashKey, contentKey, section]);

Adds list of accounts to a calls sharings list.

----------
Parameters
----------

#. ``contract`` - ``any|string``: smart contract instance or contract ID
#. ``accountId`` - ``string``: Ethereum account ID
#. ``callId`` - ``number``: id of the call to retrieve
#. ``to`` - ``string[]``: accountIds, to add sharings for
#. ``hashKey`` - ``string`` (optional): hash key to share, if omitted, key is retrieved with ``accountId``
#. ``contentKey`` - ``string`` (optional): content key to share, if omitted, key is retrieved with ``accountId``
#. ``section`` - ``string`` (optional): section to share key for, defaults to '*'

-------
Returns
-------

``Promise`` returns ``void``: resolved when done

-------
Example
-------

.. code-block:: typescript

  // account[0] adds accounts[2] to a sharing
  await serviceContract.addToCallSharing(contract, accounts[0], callId, [accounts[2]]);



--------------------------------------------------------------------------------


.. _servicecontract_answers:

= Answers =
===========

Answers are replies to calls. Answers can only be created as answers to calls. Answers are usually directed to the author of a call.

Examples are

- capacity replies
- information responses



--------------------------------------------------------------------------------

.. _service-contract_sendAnswer:

sendAnswer
================================================================================

.. code-block:: typescript

  serviceContract.sendAnswer(contract, accountId, answer, callId, callAuthor);

Send answer to service contract call.

----------
Parameters
----------

#. ``contract`` - ``any|string``: smart contract instance or contract ID
#. ``accountId`` - ``string``: Ethereum account ID
#. ``answer`` - ``any``: answer to send
#. ``callId`` - ``number``: index of the call to which the answer was created
#. ``callAuthor`` - ``string``: Ethereum account ID of the creator of the initial call

-------
Returns
-------

``Promise`` returns ``number``: id of new answer

-------
Example
-------

.. code-block:: typescript

  await serviceContract.inviteToContract(businessCenterDomain, contract.options.address, accounts[0], accounts[2]);
  const contentKey = await sharing.getKey(contract.options.address, accounts[0], '*', 0);
  await sharing.addSharing(contract.options.address, accounts[0], accounts[2], '*', 0, contentKey);
  await serviceContract.sendCall(contract, accounts[0], sampleCall);
  const call = await serviceContract.getCall(contract, accounts[0], 0);
  const answerId = await serviceContract.sendAnswer(contract, accounts[2], sampleAnswer, 0, call.metadata.author);



--------------------------------------------------------------------------------

.. _service-contract_getAnswers:

getAnswers
================================================================================

.. code-block:: typescript

  serviceContract.getAnswers(contract, accountId, callid[, count, offset, reverse]);

Retrieves answers for a given call.

----------
Parameters
----------

#. ``contract`` - ``any|string``: smart contract instance or contract ID
#. ``accountId`` - ``string``: Ethereum account ID
#. ``callId`` - ``number``: index of the call to which the answers were created
#. ``count`` - ``number`` (optional): number of elements to retrieve, defaults to ``10``
#. ``offset`` - ``number`` (optional): skip this many elements, defaults to ``0``
#. ``reverse`` - ``boolean`` (optional): retrieve last elements first, defaults to ``false``

-------
Returns
-------

``Promise`` returns ``any[]``: the answers

-------
Example
-------

.. code-block:: typescript

  const answers = await serviceContract.getAnswers(contract, accounts[0], 12);



--------------------------------------------------------------------------------

.. _service-contract_getAnswer:

getAnswer
================================================================================

.. code-block:: typescript

  serviceContract.getAnswer(contract, accountId, answerIndex);

Get a answer from a contract.

----------
Parameters
----------

#. ``contract`` - ``any|string``: smart contract instance or contract ID
#. ``accountId`` - ``string``: Ethereum account ID
#. ``callId`` - ``number``: index of the call to which the answer was created
#. ``answerIndex`` - ``number``: index of the answer to retrieve

-------
Returns
-------

``Promise`` returns ``any``: a single answer

-------
Example
-------

.. code-block:: typescript

  const answer = await serviceContract.getAnswer(contract, accounts[0], 12, 2);



--------------------------------------------------------------------------------

.. _service-contract_getAnswerCount:

getAnswerCount
================================================================================

.. code-block:: typescript

  serviceContract.getAnswerCount(contract, callId);

Retrieves number of answers for a given call.

----------
Parameters
----------

#. ``contract`` - ``any|string``: smart contract instance or contract ID
#. ``callId`` - ``number``: index of the call to which the answer was created

-------
Returns
-------

``Promise`` returns ``number``: number of answers

-------
Example
-------

.. code-block:: typescript

  const sampleCallId = 3;
  let answerCount = await serviceContract.getAnswerCount(contract, sampleCallId);
  console.log(answerCount);
  // Output:
  // 2
  await serviceContract.sendAnswer(contract, accounts[0], sampleAnswer, sampleCallId, accounts[1]);
  answerCount = await serviceContract.getAnswerCount(contract, sampleCallId);
  console.log(answerCount);
  // Output:
  // 3



.. required for building markup

.. |source cryptoProvider| replace:: ``CryptoProvider``
.. _source cryptoProvider: /encryption/crypto-provider.html

.. |source dfsInterface| replace:: ``DfsInterface``
.. _source dfsInterface: /dfs/dfs-interface.html

.. |source keyProvider| replace:: ``KeyProvider``
.. _source keyProvider: /key-provider

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: /common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: /common/logger.html#logloginterface

.. |source sharing| replace:: ``Sharing``
.. _source sharing: /contracts/sharing.html

.. |source web3| replace:: ``Web3``
.. _source web3: https://github.com/ethereum/web3.js/