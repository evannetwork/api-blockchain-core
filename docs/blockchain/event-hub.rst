================================================================================
Event Hub
================================================================================

.. list-table:: 
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - EventHub
   * - Extends
     - `Logger <../common/logger.html>`_
   * - Source
     - `event-hub.ts <https://github.com/evannetwork/dbcp/tree/master/src/event-hub.ts>`_

The `EventHub <https://github.com/evannetwork/dbcp/blob/master/src/event-hub.ts>`_  helper is wrapper for using contract events. These include
- contract events (e.g. contract factory may trigger an event, announcing the address of the new contract)
- global events (some contracts in the `evan.network <https://evan.network/>`_ economy, like the `MailBox` use such global events)

------------------------------------------------------------------------------

.. _eventhub_constructor:

constructor
================================================================================

.. code-block:: typescript

  new EventHub(options);

Creates a new EventHub instance.

----------
Parameters
----------

#. ``options`` - ``EventHubOptions``: options for EventHub constructor.
    * ``config`` - ``any``: configuration object for the eventhub module
    * ``nameResolver`` - |source nameResolver|_: |source nameResolver|_ instance
    * ``contractLoader`` - |source contractLoader|_: |source contractLoader|_ instance
    * ``eventWeb3`` - |source web3|_ (optional): |source web3|_ instance used for event handling (metamask web3 can't handle events correct)
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``

-------
Returns
-------

``EventHub`` instance

-------
Example
-------

.. code-block:: typescript
  
  const eventHub = new EventHub({
      config,
      nameResolver,
      contractLoader,
    });



--------------------------------------------------------------------------------

.. _eventhub_subscribe:

subscribe
===================

.. code-block:: javascript

    eventHub.subscribe(contractName, contractAddress, eventName, filterFunction, onEvent, fromBlock);

subscribe to a contract event or a global EventHub event

----------
Parameters
----------

#. ``contractName`` - ``string``: target contract name (must be available within |source contractLoader|_ )
#. ``contractAddress`` - ``string``: target contract address
#. ``eventName`` - ``string``: name of the event to subscribe to
#. ``filterFunction`` - ``function``: a function that returns true or a Promise that resolves to true if onEvent function should be applied
#. ``onEvent`` - ``function``: executed when event was fired and the filter matches, gets the event as its parameter
#. ``fromBlock`` - ``string`` (optional): get all events from this block, defaults to ``latest``

-------
Returns
-------

``Promise`` resolves to ``string``: event subscription.

-------
Example
-------

.. code-block:: javascript

    // subscribe to the 'ContractEvent' at the EventHub located at '00000000000000000000000000000000deadbeef'
    runtime.eventHub
              .subscribe(
                'EventHub',
                '00000000000000000000000000000000deadbeef',
                'ContractEvent',
                (event) => true,
                (event) => {
                  console.dir(event)
                }
              )
              .then((result) => { subscription = result; })

------------------------------------------------------------------------------


.. _eventhub_once:

once
===================

.. code-block:: javascript

    eventHub.once(contractName, contractAddress, eventName, filterFunction, onEvent, fromBlock);

subscribe to a contract event or a global EventHub event, remove subscription when filterFunction matched

----------
Parameters
----------

#. ``toRemove`` - ``any``: 
#. ``contractAddress`` - ``string``: target contract address
#. ``eventName`` - ``string``: name of the event to subscribe to
#. ``filterFunction`` - ``function``: a function that returns true or a Promise that resolves to true if onEvent function should be applied
#. ``onEvent`` - ``function``: executed when event was fired and the filter matches, gets the event as its parameter
#. ``fromBlock`` - ``string`` (optional): get all events from this block, defaults to ``latest``

-------
Returns
-------

``Promise`` resolves to ``string``: event subscription.

-------
Example
-------

.. code-block:: javascript

    // subscribe to the 'ContractEvent' at the EventHub located at '00000000000000000000000000000000deadbeef'
    runtime.eventHub
              .once(
                'EventHub',
                '00000000000000000000000000000000deadbeef',
                'ContractEvent',
                (event) => true,
                (event) => {
                  console.dir(event)
                }
              )
              .then((result) => { subscription = result; })

------------------------------------------------------------------------------


.. _eventhub_unsubscribe:

unsubscribe
===================

.. code-block:: javascript

    eventHub.unsubscribe(toRemove);

unsubscribe an event subscription

----------
Parameters
----------

#. ``contractName`` - ``string``: target contract name (must be available within |source contractLoader|_ )
    * ``subscription`` - ``string``: target guid for the subscription that should be removed
    * ``contractId`` - ``string``: target contractId where all subscriptions should be removed (can be 'all')

-------
Returns
-------

``Promise`` resolves to ``void``: resolved when done.

-------
Example
-------

.. code-block:: javascript

    // subscribe to the 'ContractEvent' at the EventHub located at '00000000000000000000000000000000deadbeef'
    runtime.eventHub
              .unsubscribe({
                subscription: 'f0315d39-5e03-4e82-b765-df1c03037b3a'
              })


.. required for building markup

.. |source contractLoader| replace:: ``ContractLoader``
.. _source contractLoader: /contracts/contract-loader.html

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: /common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: /common/logger.html#logloginterface

.. |source nameResolver| replace:: ``NameResolver``
.. _source nameResolver: /blockchain/name-resolver.html

.. |source web3| replace:: ``Web3``
.. _source web3: https://github.com/ethereum/web3.js/
