# api-blockchain-core

## Next Version
### Features

### Fixes
- export missing `unshareProperties` from `index.ts`
- fix handling of empty values in mappings of data contracts

### Deprecations


## Version 2.14.0
### Features
- use container logic for profile management
- update onboarding logic to fit current profile setup
- add more clearnup and hardening to `unshareProperties` for `Container` API
- add support to remove sharings to `Sharings` API
- improve support for working with profiles of other users via `Profile` API

### Fixes
- fix race conditions in sharings update, which could occur when sharings are updated in parallel


## Version 2.13.0
### Features
- add `setProfileProperties` and `getProfileProperties`

### Fixes
- remove custom agpl appendix


## Version 2.12.0
### Features
- add generic support for preparing and executing transactions via identity

### Fixes
- fix `notEnsRootOwner` check to allow each account that gets the `/evan` account from the ens root owner
- fix typos in variable naming


## Version 2.11.0
### Features
- update versions of dependencies
- improve performance of (digital twin) container reation process
- add helper for creating smart agent auth headers

### Fixes
- add `node-scrypt` as dependency to fix browserify build
- fix `executor-agent`, `executeContractCall` to return correctly received `BigNumber` from `smart-agent-executor`


## Version 2.10.0
### Features
- update versions of dependencies

### Fixes
- remove unnecessary dependencies


## Version 2.9.0
### Features
- add support for `timeout` (adjusts transaction timeout) option to `Wallet` and `ExecutorWallet`

### Fixes
- fix executor agent to be compatible with web3 1.2 and 2.0


## Version 2.8.4
### Fixes
- add `toString` to return correct value for `verification.raw.topic` BigNumber result returned by `web3` `1.0.0-beta.55`


## Version 2.8.3
### Fixes
- fix verification v2 status compute and statusComputer


## Version 2.8.2
### Fixes
- fix dataKey generation with sha3


## Version 2.8.1
### Fixes
- add support for `web3` `1.0.0-beta.55`


## Version 2.8.0
### Features
- add support for delegated issuing of verifications
- add ``getNestedVerificationsV2`` with updated interfaces and return values for clearer identity status
- add evan light docs design


## Version 2.7.1
### Fixes
- allow empty description for `Container.create` so it will fallback to default description
- add empty check for recursive `Container` `applyIfEncrypted` calls


## Version 2.7.0
### Features
- add default `boolean` `defaultSchemas` to `DataContainer`


## Version 2.6.0
### Features
- add left padding for contract link setting and checking in ``Verifications`` as contract identity links are now stored as 32B

### Fixes
- reload `DataContainer` plugin definition before saving / deleting tree


## Version 2.5.0
### Features
- add `encryption-wrapper` as a wrapper for encryption, that realizes a uniform way to en- and decrypt different types of data with different key storages

### Fixes
- add correct loadForAccount logic to `DataContainer` plugins
- move `DataContainer` plugin saving to seperated profile space


## Version 2.4.1
### Fixes
- fix `linkIdentity` handling in `verifications` module during identity creation


## Version 2.4.0
### Features
- add `gasPrice` option to runtime config
- add support for contracts without description
  + add `updateDescription` flag to `createIdentity` to skip automatic description updates
  + add `isIdentity` flag to
    * `executeOnIdentity`
    * `confirmVerification`
    * `deleteVerification`
    * `getVerifications`
    * `rejectVerification`
    * `executeOnIdentity` (private)

### Fixes
- fix empty accountStore by initializing runtime with mnemonic and password
- update docu for verifications
- fix handling of properties with schemas without properties
- replace null with empty string for `aes-ecb` createCipheriv

### Deprecations
- rename `container` `template` handling to `plugin`
  - ContainerTemplate to ContainerPlugin
  - defaultTemplate => defaultPlugin
  - profilePluginsKey => profilePluginsKey
  - templates => plugins
  - toTemplate => toPlugin
  - deleteContainerTemplate => deleteContainerPlugin
  - getContainerTemplate => getContainerPlugin
  - getContainerTemplates => getContainerPlugins
  - saveContainerTemplate => saveContainerPlugin
  - applyTemplate => applyPlugin


## Version 2.3.1
### Fixes
- fix hashing of passwords for generated profiles


## Version 2.3.0
### Features
- add profile creation in one line of code to Onboarding
- add the ability to initialize the runtime with a mnemnoic and password

### Fixes
- use lodash for cloning `Container` templates
- export lodash from index.ts for ui libraries
- use object dataSchema for `DataContainer` - `ContainerFile`
- fix deprecation warnings on node 11+


## Version 2.2.0
### Features
- add the ability to parse accountid + password in key config for runtime
- add static functions to `Container` to save, get and delete templates on users profile
- add `ensureProperty`, that allows to add entries or lists to containers without setting values
- add default schemas for property types
- add `getContainerShareConfigs` to retrieve all share configs
- add file handling to `Container` module

### Fixes
- fix `getMembers` user fetching (now returns all accounts and not only the first 10)


## Version 2.1.1
### Fixes
- allow remove spaces and special characters from `ajv` schema `$id` in `DigitalTwin DataContainer`
- fix relative loaded `ethereumjs-tx/index.js` from `libs/eth-lightwallet/keystore.js`


## Version 2.1.0
### Features
- add support for `MultiSigWalletSG` wallets to wallet `wallet` module
- add tracking for  file hashes saved with `ipld` module
- fix `ensureVerificationDescription` to match `getFullDescriptionDomainWithHash` ens paths
- use correct defaultVerifications topics `loadActiveVerifications`
- add support for passing `Logger` instance to `createDefaultRuntime`
- return `Logger` instance from `createDefaultRuntime`
- add `digital-twin` module (wrapper for `DigitalTwin` contracts)
- add `container` module (`DataContract` wrapper)
- add support for type `array` in `data-contract` (if type is array, subproperty `.items` is used for list entry validation)
- add support for templates to profile
- add support to automatically add property to profile when storing properties
- add support to check if an account can perform an operation to `RightsAndRoles`

### Fixes
- fix `DataContract` `getEntry` to load unencrypted data, when no profile for the requesting account exists
- fix empty verification missing subjectIdentity
- verifications from the root evan user are never self issued

### Deprecations
- remove build scripts for browserify bundle
- remove `bcc/bundles/bcc.ts` file and switch to generalized `index.ts` for both, node and ui bundle (ui build job was moved to [ui-core/dapps/bcc](https://github.com/evannetwork/ui-core/tree/master/dapps/bcc))
- add dependency to `RightsAndRoles` to `Profile`


## Version 2.0.0
### Features
- add support for contract creation to `executor-wallet`
- add support for handling multiple confirmations to `executor-wallet` and `wallet`
- use root level wallet factory (`wallet.factory.evan`) instead of a business center scoped wallet factory
- add support for sending funds with transactions in `wallet`
- `executor-wallet` now needs `accountId` option in constructor, which is used to execute internal transactions
- add `disableSubVerifications` flags to verifications

### Fixes
- add `keepaliveInterval` to `web3` in `test-utils`
- remove `request` from `ExecutorAgent` and replace it with a build in https / http request

### Deprecations
- add accountId argument to `ClaimHolder` constructor
- rename `Claims` to `Verifications`
- add nested verification functions and deep validity checks


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
