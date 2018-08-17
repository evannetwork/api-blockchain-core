# blockchain-core

## Next Version
### Features
### Fixes
### Deprecations


## Version 1.1.0
### Features
- add support for wallet/proxy contracts (current implementation allows n wallet owner with a required confirmation count of 1, to allow grouping of accounts)
- add `ExecutorWallet`, that wraps calls to `Wallet`, but behaves like the normal `Executor`
- add `ExecutorAgent`, that wraps contract creation and interaction to edge-server actions
- add `Claims` module for issuing and managing claims about other parties
- add `getCallOwner` to get a `ServiceContracts`s call creator

### Fixes
- add validation for service definitions, calls and answers to `ServiceContract`
- remove `@evan.network/smart-contracts-admin` dependency

### Deprecations
- remove endpoint property from service contracts


## Version 1.0.2
### Features
- add support for adding sharing file hashes to cache to avoid duplicate contract calls
- add paging to `getCalls` and `getAnswers` in `ServiceContract` module
- add function to clear sharing caches to `Sharing` module
- add support for nested encryption to `ServiceContract` module
- rename to api-blockchain-core

### Fixes

### Deprecations
- change service call encryption schema to multi-sharings based encryption


## Version 1.0.1
### Features
- add docu for rights-and-roles.ts, ipld.ts
- use @evan.network for package name and dependencies scopes
- add .npmignore
- (deprecation) rights-and-roles.ts:hasUserRole second argument "accountId" will be dropped, as it isnt' required anymore
- rename *contractus* variables to *evan*
- rename bcc-core bundle to bcc
  - rename BCCCore to CoreRuntime
  - rename BCCProfile to ProfileRuntime
  - rename BCCBC to BCRuntime
- allow overwriting runtimes nameResolver with runtimeConfig
- fix unbound entry retrieval in DataContract.getListEntries by adding paging to it
- add `removeAccountFromRole` and `transferOwnership` to `RightsAndRoles` for better permission management
- make `extendSharings` publicly accessible for adding properties to sharings withou saving them
- add `createSharing` to `DataContract` and accept a sharings hash in `createContract` , which allows to decouple sharing creation and contract creation 
- accept ipld hashes in `storeForAccount` in `Profile` to decouple tree encryption and property storing
- add support for multi-sharings to `Sharings` module
- add multi-sharing support to `ServiceContract` module

## Version 1.0.0
- DBCP update
- Fix web3 reconnect
- Add iframe support for dapps

## Version 0.9.0
- initial version and release candidate for 1.0.0