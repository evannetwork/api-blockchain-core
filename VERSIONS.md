# blockchain-core

## Next Version
### Features
- add support for contract creation to `executor-wallet`
- add support for handling multiple confirmations to `executor-wallet` and `wallet`

### Fixes
### Deprecations


## Version 1.7.1
### Fixes
- add ignoring of missing keys when decrypting unencrypted data


## Version 1.7.0
### Features
- update `setClaims` to use issuers identity for setting claims on subject
- add linking and checks for contract identities
- add missing dbcpVersion to dbcp files
- add licenses to dbcp files

### Fixes
- remove `OriginIdentity`, as `ClaimHolder` is used for identities 

### Deprecations

## Version 1.6.1
### Fixes
- remove web3 initialization within the `ServiceContract`
- use 1.0.0-beta.33, beta.37 will cause Websocket errors in Edge browser

## Version 1.6.0
### Features
- add own ipfs handler
- add ipfs identification header to enable future ipfs payments
- add `defaultClaims` to `Profile` `loadActiveClaims`
- add `Votings` helper for holding votes on-chain
- add support for `PayableRegistrar`, that allows to by domain names with EVEs
- add support for ENS registries with time limited nodes
- add support for permanent ENS address on payable registrar
- add support for retrieving proposals paged
- add support for setting claims on contracts

## Version 1.5.0
### Features
- add description to claims
- add `addClaimWithMetadata` function to claims for setting claim and metadata at the same time
- add creation block data to claim information
- claims are not overwritten anymore, but a new claim is created per set call
- add description setting (on central claims ENS domain)
- add description resolval to get function

### Deprecations
- claims are no longer updateable, a new claim is created for every `setClaim` transaction


## Version 1.4.0
### Features
- adjust claims service to be ERC725/ERC735 compliant
- add `loadActiveClaims` and `setActiveClaims` function to profile to handle users active claims


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
