# blockchain-core

## Next Version
### Features
- adjust claims service to be ERC725/ERC735 compliant
- add `loadActiveClaims` and `setActiveClaims` function to profile to handle users active claims

### Fixes
### Deprecations

## Version 1.3.1
### Fixes
- fix `Profile.exists` check, that threw if profile contract cannot be found

## Version 1.3.0
### Features
- add `getKeyHistory` to `sharings` to retrieve all keys for an account and a section
- add `bumpSharings` to `sharings`, that adds a new key for all given accounts for given section
- add `removeBcContract` to `profile` to remove profile entries that were writte using `addBcContract`
- export `crypto` library, `DBCP Vaildator`, `DBCP Envelop`
- export `createDefaultRuntime` within the `bcc frontend bundle` + adjust it for frontend smartcontracts usage

### Fixes
- fix `ipld` deleting issue, that occurred when deleting linked nodes in linked subtrees

## Version 1.2.2
### Fixes
- move require(`@evan.network/smart-contracts-core`) within `createDefaultRuntime` to capsuled scope, to be able to require it only in backend scope
- fix window checks on node environments
- fix initailization of aesblob with dfs
- fix rights and roles 0x0 encoding

## Version 1.2.1
### Fixes
- replace `interruptStep = 200` with `interruptStep = 2000` to fix old / mobile browser breaking by calling to many setTimeouts
- add `AesBlob` to index export and runtime

## Version 1.2.0
### Features
- add `NameResolver` class, that extends DBCPs version with `claimAddress` that allows to claim domains from a fifs registrar node
- add functions for editing sharings with `Sharings` module in bulk
- improve `ServiceContract` call creation performance
- add encryptioncontext to dataContract

### Fixes
- fix contract references in service contract calls
- fix decryption issues in service contracts

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
- `ServiceContracts`s getter for calls and answers now return null, if unable to decrypt to allow retrieving multiple calls/answers and ignore unrelated ones

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
