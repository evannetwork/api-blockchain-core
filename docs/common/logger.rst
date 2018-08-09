================================================================================
Logger
================================================================================

.. list-table:: 
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - Logger
   * - Source
     - `logger.ts <https://github.com/evannetwork/dbcp/tree/master/src/common/logger.ts>`_

The `Logger <https://github.com/evannetwork/dbcp/tree/master/src/common/logger.ts>`_ class is used throughout the package for logging events, updates and errors. Logs can be written by classes, that inherit from the `Logger <https://github.com/evannetwork/dbcp/tree/master/src/common/logger.ts>`_ class, by using the `this.log` function. A log level can be set by its second parameter:

.. code-block:: javascript

    this.log('hello log', 'debug');

 All log messages without a level default to level 'info'. If not configured otherwise, the following behavior is used:

- drop all log messages but errors
- log errors to console.error

It can be useful for analyzing issues to increase the log level. You can do this in two ways:

- Set the environment variable `DBCP_LOGLEVEL` to a level matching your needs, which increases the log level for all modules and works with the default runtime. For example:

.. code-block:: sh

    export DBCP_LOGLEVEL=info


- When creating a custom runtime, set the `logLevel` property to a value matching your needs, when creating any module instance. This allows you to change log level for single modules, but requires you to create a custom runtime, e.g.:

.. code-block:: javascript

    const { ContractLoader } = require('@evan.network/dbcp');
    const Web3 = require('web3');

    // web3 instance for ContractLoader
    const web3 = new Web3();
    web3.setProvider(new web3.providers.WebsocketProvider('...'));

    // custom log level 'info'
    const contractLoader = new ContractLoader({ web3, logLevel: 'info', });

All loggers can have a custom LogLog storage where all logmessages with a given level will be stored. You can access the storage for the current logger module at the property ``logLog``. All messages are stored with the following markup:

.. code-block:: javascript

    {
      timestamp, // current date in millis
      level, // loglevel of the message
      message // log message
    }

You can configure the current LogLogLevel at the property ``logLogLevel`` at instantiation of your module.

------------------------------------------------------------------------------

.. _logger_constructor:

constructor
================================================================================

.. code-block:: typescript

  new Logger(options);

Creates a new Logger instance.

----------
Parameters
----------

#. ``options`` - ``LoggerOptions``: options for Logger constructor.
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``

-------
Returns
-------

``Logger`` instance

-------
Example
-------

.. code-block:: typescript
  
  const logger = new Logger();



--------------------------------------------------------------------------------

.. _logger_log:

log
===================

.. code-block:: javascript

    logger.log(message, level);

log message with given level



----------
Parameters
----------

#. ``message`` - ``string``: log message
#. ``level`` - ``string``: log level as string, defaults to 'info'

-------
Example
-------

.. code-block:: javascript

    runtime.executor.log('test', 'error');

------------------------------------------------------------------------------

= Additional Components =
=========================

-----------
Interfaces
-----------



.. _logger_logLogInterface:


LogLogInterface
^^^^^^^^^^^^^^^

A different LogLog storage can be attached to the logger instance of the module. The storage must implement the following functions (default array like instance)

.. code-block:: typescript

    export interface LogLogInterface {
      push: Function;
      map: Function;
      filter: Function;
    };

-----
Enums
-----

.. _logger_LogLevel:

LogLevel
^^^^^^^^^^^^^

Available LogLevels for the logger instance, free definable between error and gasLog

.. code-block:: typescript

    export enum LogLevel {
      debug,
      info,
      notice,
      warning,
      error,

      gasLog = 100,
      disabled = 999,
    };


.. required for building markup

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: /common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: /common/logger.html#logloginterface 