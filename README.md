# api-blockchain-core

[![Build Status](https://travis-ci.org/evannetwork/api-blockchain-core.svg?branch=develop)](https://travis-ci.org/evannetwork/api-blockchain-core)


## About
The blockchain core is a helper library, that offers helpers for interacting with the blockchain. It is written in TypeScript and offers several (up to a certain degree) stand-alone modules, that can be used for
- creating and updating contracts
- managing user profiles
- en- and decryption
- distributed filesystem file handling
- key exchange and key handling
- ENS domain handling
- sending and receiving bmails


## Documentation
- API documentation can be found here [here](https://api-blockchain-core.readthedocs.io)<sup>[+]</sup>
- if you want to know about where the API is used, you can have a look at our [wiki](https://evannetwork.github.io/)<sup>[+]</sup>
- updates, develop HowTos and more cool stuff about what evan.network is doing can be found on our [Medium channel](https://medium.com/evan-network)<sup>[+]</sup>


## DApp library
This project is bundled using browserify and directly loadable from dapps within the evan.network. The dbcp.json can be found in this [wrapping project](https://github.com/evannetwork/ui-dapps/tree/master/evan-libs/bcc).

It's also available as browserified project within the npm, published with the same original versions: `@evan.network/api-blockchain-core-browserified`.


## Tests
The tests are written with mocha and chai and the files (`*.spec.js`) are located next to the files, they contain tests for.
The tests are in between unit tests and integration tests. They each cover a single class but do not mock external dependencies and use the live blockchain for its contract and transaction related components. They act as a living documentation and examples for using the modules can be found in them.

As the modules depend on each other, most tests require some repeating initialization steps. To speed things up a bit, the [`TestUtils`](./src/test/test-utils.ts) class is used for creating the modules, this class initializes the required modules, but creates multiple instances of the same modules. This pattern can be used for tests, but when writing code intended for productive use, modules should be re-used instead of creating new ones repeatedly.

There are multiple scripts for running tests:
- `npm run test` - runs all tests, only recommended when running during CI, takes really long by now
- `npm run testunit ${PATH_TO_SPEC_FILE}` - runs a single `*.spec.js` file, your best friend when writing new modules or upating them
- `npm run testunitbail ${PATH_TO_SPEC_FILE}` - runs a single `*.spec.js` file, breaks on first error without waiting for all tests in this file to finish
- `npm run testunitbrk ${PATH_TO_SPEC_FILE}` - runs a single `*.spec.js` file, steps into breakpoint on first line, can be used when facing startup issues

All tests are run with the `--inspect` flag for debugging.
