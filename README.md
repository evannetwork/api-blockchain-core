# blockchain-core

## Table of Contents
<!-- MarkdownTOC autolink="true" -->

- [About](#about)
- [Tests](#tests)
- [Module Initialization](#module-initialization)
- [Handling Profiles](#handling-profiles)
  - [Structure](#structure)
  - [Example](#example)
- [BaseContract](#basecontract)
  - [Create Contracts](#create-contracts)
  - [Managing Contract Members](#managing-contract-members)
  - [Change Contract State](#change-contract-state)
  - [Updating a Members State](#updating-a-members-state)
- [DataContract](#datacontract)
  - [Creating DataContracts](#creating-datacontracts)
  - [Entries](#entries)
  - [List Entries](#list-entries)
- [Encryption](#encryption)
  - [Usage](#usage)
  - [Examples](#examples)
- [Sharings / Multikeys](#sharings--multikeys)
  - [The Sharing Concept](#the-sharing-concept)
  - [How to use](#how-to-use)
  - [Example](#example-1)
- [Rights and Roles](#rights-and-roles)
  - [Add Accounts to Role](#add-accounts-to-role)
  - [Get Members of Roles a Contract](#get-members-of-roles-a-contract)
  - [Setting Function Permissions](#setting-function-permissions)
  - [Setting Operation Permissions](#setting-operation-permissions)
- [IPLD](#ipld)
  - [Adding Trees to IPLD](#adding-trees-to-ipld)
  - [Retrieving Trees from IPLD](#retrieving-trees-from-ipld)
  - [Subtrees](#subtrees)
    - [Extending trees](#extending-trees)
    - [Getting Values from Subtrees](#getting-values-from-subtrees)
  - [About Encryption in IPLD Trees](#about-encryption-in-ipld-trees)
- [Mailbox](#mailbox)
  - [Send a Mail](#send-a-mail)
  - [Retrieving bmails](#retrieving-bmails)
  - [Answering to a bmail](#answering-to-a-bmail)
  - [Bmails and EVEs](#bmails-and-eves)
    - [Checking a bmails balance](#checking-a-bmails-balance)
    - [Withdrawing funds from bmails](#withdrawing-funds-from-bmails)
- [Key Exchange](#key-exchange)
  - [Start the Key Exchange Process](#start-the-key-exchange-process)
  - [Finishing the Key Exchange Process](#finishing-the-key-exchange-process)
- [Onboarding](#onboarding)

<!-- /MarkdownTOC -->


## About
The blockchain core is a helper library, that offers helpers for interacting with the blockchain. It is written in TypeScript and offers several (up to a certain degree) stand-alone modules, that can be used for
- creating and updating contracts
- managing user profiles
- en- and decryption
- distributed filesystem file handling
- key exchange and key handling
- ENS domain handling
- sending and receiving bmails


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


## Module Initialization
The modules take 1 argument in their constructor, that is (in most modules) an interface with the required dependencies, for example in the [`BaseContract`](./src/contracts/base-contract/base-contract.ts) class:

```typescript
// ...

/**
 * options for BaseContract constructor
 */
export interface BaseContractOptions {
  executor: Executor,
  loader: ContractLoader,
  log?: Function,
  nameResolver: NameResolver,
}


/**
 * wrapper for BaseContract interactions
 *
 * @class      BaseContract (name)
 */
export class BaseContract extends Logger {
  protected options: BaseContractOptions;

  constructor(optionsInput: BaseContractOptions) {
    super(optionsInput);
    this.options = optionsInput;
  }

  // ...
}
```

Some of the modules have circular depenencies, as many modules require basic modules like the `Executor` or the `NameResolver` (from [DBCP](https://github.com/evannetwork/dbcp)<sup>[+]</sup>) and in reverse those two modules need functionalities from their dependents. For example the `Executor` from the sample above needs the `EventHub` (which requires the `Executor` itself) for transactions, that use an events for returning results. These modules 
need further initialization steps before they can be used, which are described in their constructors comment and can be seen in their tests.


## Handling Profiles
### Structure
A users profile is its personal storage for
- contacts
- encryption keys exchanged with contacts
- an own public key for exchanging keys with new contacts
- bookmarked ÐAPPs
- created contracts

This data is stored as an [IPLD Graphs](https://github.com/ipld/ipld)<sup>[+]</sup> per type and stored in a users profile contract. These graphs are independant from each other and have to be saved separately.

This contract is a [`DataContract`](./src/contracts/database-contract/data-contract.ts) and can be created via the factory at `profile.factory.evan` and looked up at the global profile index `profile.evan`. The creation process and landmap looks like this:

![profile landmap](https://user-images.githubusercontent.com/1394421/38298221-1938d006-37f7-11e8-9a84-abfd311c97f0.png)

### Example
This example shows how to create a profile and store a bookmark in it. For abbreviation the creation of the profile helper has been omitted and an existing instance called `profile` is used.
```typescript
// the bookmark we want to store
const sampleDesc = {
  title: 'sampleTest',
  description: 'desc',
  img: 'img',
  primaryColor: '#FFFFFF',
};

// create new profile, set private key and keyexchange partial key
await profile.createProfile(keyExchange.getDiffieHellmanKeys());

// add a bookmark
await profile.addDappBookmark('sample1.test', sampleDesc);

// store tree to contract
await profile.storeForAccount(profile.treeLabels.bookmarkedDapps);
```


## BaseContract
The [`BaseContract`](./src/contracts/base-contract/base-contract.ts) is the base contract class used for
- [DataContracts](#datacontract)
- [ServiceContractss](#servicecontract)

Contracts, that inherit from `BaseContracts`, are able to:
- manage a list of contract participants (called "members")
- manage the own state (a flag, that indicate its own life cycle status)
- manage members state (a flag, that indicate the members state in the contract)

What members can do, what non-members cannot do depends of the 


### Create Contracts
The API supports creating contracts, that inhering from `BaseContract`. This is done by calling the respective factory. The factory calls are done via a function with this interface:
```solidity
/// @notice create new contract instance
/// @param businessCenter address of the BusinessCenter to use or 0x0
/// @param provider future owner of the contract
/// @param _contractDescription DBCP definition of the contract
/// @param ensAddress address of the ENS contract
function createContract(
    address businessCenter,
    address provider,
    bytes32 _contractDescription,
    address ensAddress) public returns (address);
```

The API supports creating contracts with this function. Contracts created this way may not be ready to use and require an additional function at the contract to be called before usage. This function is usually called `init` and its arguments and implementation depends of the specific contract.

The `createUninitialized` function performs a lookup for the respective factory contract and calls the `createContract` function at it.

```typescript
const contractOwner = '0x...';
const businessCenterDomain = 'testbc.evan';
const contractId = await baseContract.createUninitialized(
  'testdatacontract',                   // factory name
  contractOwner,                        // account, that will be owner of the new contract
  businessCenterDomain,                 // business center, where the new contract will be created
);
```


### Managing Contract Members
To allow accounts to work with contract resources, they have to be added as members to the contract. This can be can be done with:
```typescript
const contractOwner = '0x0000000000000000000000000000000000000001';
const invitee = '0x0000000000000000000000000000000000000002';
const businessCenterDomain = 'testbc.evan';
const contract = loader.loadContract('BaseContractInterface', contractId);
await baseContract.inviteToContract(
  businessCenterDomain,
  contractId,
  contractOwner,
  invitee,
);
```

To check if an account is a member of a contract, the contract function `isMember` can be used:
```typescript
const isMember = await executor.executeContractCall(contract, 'isConsumer', invitee);
console.log(isMember);
// Output:
// true
```


### Change Contract State
The contracts state reflects the current state and how other members may be able to interact with it. So for example, a contract for tasks cannot have its tasks resolved, when the contract is still in Draft state. State transitions are limited to configured roles and allow going from one state to another only if configured for this role.

The contract state can be set via: `function changeContractState(ContractState newState);`.
```typescript
await baseContract.changeContractState(contractId, contractOwner, ContractState.Active);
```

`ContractState` is an enum in the BaseContract class, that holds the same state values as the `[BaseContract.sol`](https://github.com/evannetwork/smart-contracts/blob/master/contracts/BaseContract.sol). Alternatively integer values matching the enums in [`BaseContractInterface.sol`](https://github.com/evannetwork/smart-contracts/blob/master/contracts/BaseContractInterface.sol) can be used.


### Updating a Members State
A members state reflects this members status in the contract. These status values can for example be be Active, Draft or Terminated.

Consumer state can be set via:
```solidity
function changeConsumerState(address consumer, ConsumerState state);
```

`ConsumerState` is an enum in the BaseContract class, that holds the same state values as the [`BaseContract.sol`](https://github.com/evannetwork/smart-contracts/blob/master/contracts/BaseContract.sol). Alternatively integer values matching the enums in [`BaseContractInterface.sol`](https://github.com/evannetwork/smart-contracts/blob/master/contracts/BaseContractInterface.sol) can be used.


## DataContract
The DataContract is a secured data storage contract for single properties and lists. If created on its own, DataContracts cannot do very much. They rely on their authority to check which entries or lists can be used.

For more information about DataContracts purpose and their authorities see [Data Contract](https://evannetwork.github.io/dev/data-contract)<sup>[+]</sup> in the evan.network wiki.

For abbreviation the creation of the data contract helper has been omitted and an existing instance called `dc` is used.

### Creating DataContracts
Let's say, we want to create a DataContract for a business center at the domain "samplebc.evan" and this business center has a DataContractFactory named "testdatacontract". We want to have two users working in our DataContract, so we get these sample values:
```typescript
const factoryName = 'testdatacontract';
const businessCenterDomain = 'samplebc.evan';
const accounts = [
  '0x0000000000000000000000000000000000000001',
  '0x0000000000000000000000000000000000000002',
];
```

Now create a contract with:
```typescript
const contract = await dc.create(factoryName, accounts[0], businessCenterDomain);
```

Okay, that was pretty anticlimatic. And boring. And does not provide a description for the contract. Let's add a description to the process. The definition is a [DBCP](https://github.com/evannetwork/dbcp/wiki)<sup>[+]</sup> contract definition and is stored in an `Envelope` (see section "Encryption"):
```typescript
const definition: Envelope = {
  "public": {
    "name": "Data Contract Sample",
    "description": "reiterance oxynitrate sat alternize acurative",
    "version": "0.1.0",
    "author": "contractus",
    "dataSchema": {
      "list_settable_by_member": {
        "$id": "list_settable_by_member_schema",
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "foo": { "type": "string" },
          "bar": { "type": "integer" }
        }
      },
      "entry_settable_by_member": {
        "$id": "entry_settable_by_member_schema",
        "type": "integer",
      }
    }
  }
};
definition.cryptoInfo = cryptoProvider.getCryptorByCryptoAlgo('aes').getCryptoInfo(accounts[0]);
const contract = await dc.create('testdatacontract', accounts[0], businessCenterDomain, definition);
```

Now we have a nice little DataContract with a description. This contract is now able to be understood by other components, that understand the dbcp. And on top of that, we provided data schemas for the two properties `list_settable_by_member` and `entry_settable_by_member` (written for [ajv](https://github.com/epoberezkin/ajv)<sup>[+]</sup>). This means, that when someone adds or sets entries to or in those properties, the incoming data is validated before actually encrypting and storing it.

To allow other users to work on the contract, they have to be invited with:
```typescript
await dc.inviteToContract(businessCenterDomain, contract.options.address, accounts[0], accounts[1]);
```

Now the user `accounts[1]` can use functions from the contract, but to actually store data, the user needs access to the data key for the DataContract. This can be done via updating the contracts sharing:
```typescript
const blockNr = await web3.eth.getBlockNumber();
const contentKey = await sharing.getKey(contract.options.address, accounts[0], '*', blockNr);
await sharing.addSharing(contract.options.address, accounts[0], accounts[1], '*', blockNr, contentKey);
```

This function, used in `data-contract.spec.js` test file, combines the last steps and will be used in later examples in this section.
```typescript
async function createContract(addSharing = false, schema?) {
  let definition;
  if (schema) {
    definition = JSON.parse(JSON.stringify(sampleDefinition));
    definition.public.dataSchema = schema;
    definition.cryptoInfo = cryptoProvider.getCryptorByCryptoAlgo('aes').getCryptoInfo(accounts[0]);
  }
  const contract = await dc.create('testdatacontract', accounts[0], businessCenterDomain, definition);
  await dc.inviteToContract(businessCenterDomain, contract.options.address, accounts[0], accounts[1]);
  if (addSharing) {
    const blockNr = await web3.eth.getBlockNumber();
    const contentKey = await sharing.getKey(contract.options.address, accounts[0], '*', blockNr);
    await sharing.addSharing(contract.options.address, accounts[0], accounts[1], '*', blockNr, contentKey);
  }
  return contract;
}
```


### Entries
Entries can be set with:
```typescript
const sampleValue = 123;
await dc.setEntry(contract, 'entry_settable_by_owner', sampleValue, accounts[0]);
```

Entries are automatically encrypted before setting it in the contract. If you want to use values as is, without encrypting them, you can add them in raw mode, which sets them as `bytes32` values:
```typescript
const sampleValue = '0x000000000000000000000000000000000000007b';
await dc.setEntry(contract, 'entry_settable_by_owner', sampleValue, accounts[0], true);
```

Entries can be retrieved with:
```typescript
const retrieved = await dc.getEntry(contract, 'entry_settable_by_owner', accounts[0]);
```

Raw values can be retrieved in the same way:
```typescript
const retrieved = await dc.getEntry(contract, 'entry_settable_by_owner', accounts[0], true);
```


### List Entries
List entries support the raw mode as well. To use raw values, pass `true` in the same way as wehn using the entries functions.

List entries can be added in bulk, so the value argument is an array with values. This array can be arbitrarily large **up to a certain degree**. Values are inserted on the blockchain side and adding very large arrays this way may take more gas during the contract transaction, than may fit into a single transaction. If this is the case, values can be added in chunks (multiple transactions). Values can be added with: 
```typescript
const sampleValue = {
  foo: 'sample',
  bar: 123,
};
await dc.addListEntries(contract, 'list_settable_by_member', [sampleValue], accounts[0]);
```

When using lists similar to tagging list entries with metadata, entries can be added in multiple lists at once by passing an array of list names:
```typescript
const sampleValue = {
  foo: 'sample',
  bar: 123,
};
await dc.addListEntries(contract, ['list_1', 'list_2'], [sampleValue], accounts[0]);
```

List entries can be retrieved one at a time:
```typescript
const itemIndex = 0;
await dc.getListEntry(contract, 'list_settable_by_member', itemIndex, accounts[0]));
```

Or all at once:
```typescript
await dc.getListEntries(contract, 'list_settable_by_member', accounts[0]));
```
In the current implementation, this function retrieves the entries one at a time and may take a longer time when querying large lists, so be aware of that, when you retrieve lists with many entries.


## Encryption
### Usage
Data, that is going to be encrypted, is put into `Envelopes`, which are objects, that implement the `Envelope` interface and are containers for encrypted or soon to encrypted data. The interface looks like this:
```typescript
/**
 * container for encrypting data
 */
export interface Envelope {
  /**
   * unencrypted part of the data; will stay as is during encryption
   */
  public?: any;
  /**
   * encrypted part of the data
   * if encrypting, this part will be encrypted, depending on the encryption
   * if already encrypted, this will be the encrypted value
   */
  private?: any;
  /**
   * describes used encryption
   */
  cryptoInfo?: CryptoInfo;
}
```

Data in an envelop can be split in two sections `public` and `private`.
`public` is the data, that is visible before decrypting anything and is intended be seen by users, that have no address to secured data in the envelope. This may a public contract description, a short introduction for a ÐAPP, etc.
`private` is data, that can only be accessed, when the `CryptoInfo` has been used to decrypt its contents.

`CryptoInfo` is an annotation for the data that specifies, with which algorithm the data will be encrypted and where to look for the key. The `CryptoInfo` interface looks like this:
```typescript
/**
 * describes used encryption
 */
export interface CryptoInfo {
  /**
   * algorith used for encryption
   */
  algorithm: string;
  /**
   * block number for which related item is encrypted
   */
  block?: number;
  /**
   * version of the cryptor used;
   * describes the implementation applied during decryption and not the algorithm version
   */
  cryptorVersion?: number;
  /**
   * context for encryption, this can be
   *  - a context known to all parties (e.g. key exchange)
   *  - a key exchanged between two accounts (e.g. bmails)
   *  - a key from a sharings info from a contract (e.g. DataContract)
   * defaults to 0
   */
  originator?: string;
  /**
   * length of the key used in encryption
   */
  keyLength?: number;
}
```

For info about the  `algorithm`s used see [Crypto Algorithms](https://evannetwork.github.io/dev/security#crypto-algorithms)<sup>[+]</sup>. Each `algorithm` has a Class, that implements the `Cryptor` interface, which is used for en- and decrypting the `private` data. Theses cryptors are usually bundled in a `CryptoProvider`, which maps algorithms to instances of cryptors. The mapping is as following:

| algorithm | cryptor | usage |
| --------- | ------- | ----- |
| aes-256-cbc | Aes | default encryption |
| aes-blob | AesBlob | encryption for files |
| unencrypted | Unencrypted | used for public parts [IPLD Graphs](https://github.com/ipld/ipld)<sup>[+]</sup>, for example public keys in profiles |

### Examples
Encrypting data:
```typescript
// sample data
const toEncrypt: Envelope = {
  public: 'this will stay as is',
  private: 'Id commodo nulla ut eiusmod.',    // will be encrypted
};

// encrypted data is stored as 'hex' in envelopes
const encodingEncrypted = 'hex';
// encryption in this sample
const algorithm = 'aes-256-cbc';
// context for encryption
const context = 'context known to all parties';

// encrypt private section
const cryptor = cryptoProvider.getCryptorByCryptoAlgo(algorithm);
// use static key in sample
// random key can be generated with:
//   const key = await cryptor.generateKey();
const key = '346c22768f84f3050f5c94cec98349b3c5cbfa0b7315304e13647a49181fd1ef';
const encryptedBuffer = await cryptor.encrypt(toEncrypt.private, { key, });
const encrypted = encryptedBuffer.toString(this.encodingEncrypted);

// build encrypted envelope
const envelope: Envelope = {
  private: encrypted,
  cryptoInfo: cryptor.getCryptoInfo(dataContract.options.address),
};
if (toEncrypt.public) {
  envelope.public = toEncrypt;
}
```

Decrypting data:
```typescript
// sample data
const envelope: Envelope = {
  public: 'this will stay as is',
  private: 'fececfb235919647feb26af368e1fcfe3f3335c02e9aec6700b16d7634286d6b',
};

// decrypt private section from envelope
const cryptor = cryptoProvider.getCryptorByCryptoInfo(envelope.cryptoInfo);
// key has been has been stored / tranferred beforehand
const key = '346c22768f84f3050f5c94cec98349b3c5cbfa0b7315304e13647a49181fd1ef';
const decryptedBuffer = await cryptor.decrypt(
  Buffer.from(envelope.private, this.encodingEncrypted), { key, });
envelope.private = decryptedBuffer;
```


## Sharings / Multikeys

### The Sharing Concept
For getting a better understanding about how Sharings and Multikeys work, have a look at [Security](https://evannetwork.github.io/dev/security#sharings)<sup>[+]</sup> in the evan.network wiki.

### How to use
For abbreviation the creation of the sharing helper has been omitted and an existing instance called `sharing` is used.

Add a sharing to a contract:
```typescript
// two sample users, user1 wants to share a key with user2
const user1 = '0x0000000000000000000000000000000000000001';
const user2 = '0x0000000000000000000000000000000000000002';
// create a sample contract
// usually you would have an existing contract, for which you want to manage the sharings
const contract = await executor.createContract('Shared', [], { from: user1, gas: 500000, });
// user1 shares the given key with user2
// this key is shared for all contexts ('*') and valid starting with block 0
await sharing.addSharing(contract.options.address, user1, user2, '*', 0, 'i am the secred that will be shared');
```

Get keys from sharing with:
```typescript
// a sample user
const user2 = '0x0000000000000000000000000000000000000002';
// user2 wants to read a key after receiving a sharing
// the key requested should be valid for all contexts ('*') and valid up to and including block 100
const key = await sharing.getKey(contract.options.address, user2, '*', 100);
```

### Example
This is an example for a sharing info of a contract. This example has
- three users
  * 0x01 - owner of a contract
  * 0x02 - member of a contract
  * 0x03 - another member with differing permissions
- two timestamps
  * block 82745 - first sharing
  * block 90000 - splitting data, update sharings
- three sections
  * "\*" generic "catch all"used in first sharing
  * "secret area" - available for all members
  * "super secret area" - available 0x03
```json
{
  "0x01": {
    "82745": {
      "*": {
        "private": "secret for 0x01, starting from block 82745 for all data",
        "cryptoInfo": {
          "originator": "0x01,0x01",
          "keyLength": 256,
          "algorithm": "aes-256-cbc"
        }
      }
    },
    "90000": {
      "secret area": {
        "private": "secret for 0x01, starting from block 90000 for 'secret area'",
        "cryptoInfo": {
          "originator": "0x01,0x01",
          "keyLength": 256,
          "algorithm": "aes-256-cbc"
        }
      },
      "super secret area": {
        "private": "secret for 0x01, starting from block 90000 for 'super secret area'",
        "cryptoInfo": {
          "originator": "0x01,0x01",
          "keyLength": 256,
          "algorithm": "aes-256-cbc"
        }
      }
    }
  },
  "0x02": {
    "82745": {
      "*": {
        "private": "secret for 0x02, starting from block 82745 for all data",
        "cryptoInfo": {
          "originator": "0x01,0x02",
          "keyLength": 256,
          "algorithm": "aes-256-cbc"
        }
      }
    },
    "90000": {
      "secret area": {
        "private": "secret for 0x02, starting from block 90000 for 'secret area'",
        "cryptoInfo": {
          "originator": "0x01,0x02",
          "keyLength": 256,
          "algorithm": "aes-256-cbc"
        }
      },
      "super secret area": {
        "private": "secret for 0x02, starting from block 90000 for 'super secret area'",
        "cryptoInfo": {
          "originator": "0x01,0x02",
          "keyLength": 256,
          "algorithm": "aes-256-cbc"
        }
      }
    },
  },
  "0x03": {
    "90000": {
      "secret area": {
        "private": "secret for 0x03, starting from block 90000 for 'secret area'",
        "cryptoInfo": {
          "originator": "0x01,0x03",
          "keyLength": 256,
          "algorithm": "aes-256-cbc"
        }
      }
    }
  }
}
```

## Rights and Roles
The [`RightsAndRoles`](./src/contracts/rights-and-roles.ts) module follows the approach described in the evan.network wik at:
- [Function Permissions](https://evannetwork.github.io/dev/security#function-permissions)
- [Operation Permissions](https://evannetwork.github.io/dev/security#operations-permissions)

It allows to manage permissions for contracts, that use the authority [`DSRolesPerContract.sol`](https://github.com/evannetwork/smart-contracts/blob/master/contracts/DSRolesPerContract.sol) for as its permission approach. 

Contracts, that use [`DSRolesPerContract.sol`](https://github.com/evannetwork/smart-contracts/blob/master/contracts/DSRolesPerContract.sol) and therefore allow to configure with the `RightsAndRoles` are:
- [`BaseContract`](https://github.com/evannetwork/smart-contracts/blob/master/contracts/BaseContract.sol)
- [`DataContract`](https://github.com/evannetwork/smart-contracts/blob/master/contracts/DataContract.sol)
- [`ServiceContract`](https://github.com/evannetwork/smart-contracts/blob/master/contracts/ServiceContract.sol)
- [`Shared.sol`](https://github.com/evannetwork/smart-contracts/blob/master/contracts/Shared.sol)
- [`Described.sol`](https://github.com/evannetwork/smart-contracts/blob/master/contracts/Described.sol)
- [`BusinessCenter.sol`](https://github.com/evannetwork/smart-contracts/blob/master/contracts/BusinessCenter.sol)


### Add Accounts to Role
The main principle is that accounts can be assigned to roles and those roles can be granted capabilities. "Function Permissions" are basically the capability to call specific functions if the calling account belongs to a certain role. To add an account to the role 'member', for example use:
```typescript
const contractOwner = '0x0000000000000000000000000000000000000001';
const newMember = '0x0000000000000000000000000000000000000002';
const memberRole = 1;
await rightsAndRoles.addAccountToRole(
  contract,                   // contract to be updated
  contractOwner,              // account, that can change permissions
  newMember,                  // add this account to role
  memberRole,                 // role id, uint8 value
);
```


### Get Members of Roles a Contract
The [`DSRolesPerContract.sol`](https://github.com/evannetwork/smart-contracts/blob/master/contracts/DSRolesPerContract.sol) authority tracks used roles and their members and allows to retrieve an overview with all roles and their members. To get this information use:
```typescript
const members = await rightsAndRoles.getMembers(contract);
console.log(members);
// Output:
// {
//   "0": [
//     "0x0000000000000000000000000000000000000001"
//   ],
//   "1": [
//     "0x0000000000000000000000000000000000000001",
//     "0x0000000000000000000000000000000000000002"
//   ]
// }
```
The contract from this example has an owner (`0x0000000000000000000000000000000000000001`) and a member (`0x0000000000000000000000000000000000000002`). As the owner account has the member role as well, it is listed among the members.


### Setting Function Permissions
"Function permissions" are granted or denying by allowing a certain role to execute a specific function. E.g. to grant the role "member" the permission to use the function `addListEntries`, that has two arguments (a `bytes32` array and a `bytes32` value) use:
```typescript
const contractOwner = '0x0000000000000000000000000000000000000001';
const memberRole = 1;
await rightsAndRoles.setFunctionPermission(
  contract,                                 // contract to be updated
  contractOwner,                            // account, that can change permissions
  memberRole,                               // role id, uint8 value
  'addListEntries(bytes32[],bytes32[])',    // (unhashed) function selector
  true,                                     // grant this capability
);
```
The function is specified as the unhashed [function selector](http://solidity.readthedocs.io/en/latest/abi-spec.html#function-selector)<sup>[+]</sup> and must follow its guidelines (no spaces, property typenames, etc.) for the function to be able to generate valid hashes for later validations.


### Setting Operation Permissions
"Operation Permissions" are capabilities granted per contract logic. They have a `bytes32` key, that represents the capability, e.g. in a [`DataContract`](https://github.com/evannetwork/smart-contracts/blob/master/contracts/DataContract.sol) a capability to add values to a certain list can be granted.

The way, those capability hashes are build depends on the contract logic and differs from contract to contract. For example a capability check for validation if a member is allowed to add an item to the list "example" in a [`DataContract`](https://github.com/evannetwork/smart-contracts/blob/master/contracts/DataContract.sol) has four arguments, in this case:
- which role is allowed to do? (e.g. a member)
- what type of element is modified? (--> a list)
- which element is modified? (name of the list --> "example")
- type of the modification (--> "set an item" (== "add an item"))
These four values are combined into one `bytes32` value, that is used when granting or checking permissions, the `setOperationPermission` function takes care of that:
```typescript
// make sure, you have required the enums from rights-and-roles.ts
import { ModificationType, PropertyType } from 'blockchain-core';
const contractOwner = '0x0000000000000000000000000000000000000001';
const memberRole = 1;
await rightsAndRoles.setFunctionPermission(
  contract,                   // contract to be updated
  contractOwner,              // account, that can change permissions
  memberRole,                 // role id, uint8 value
  'example',                  // name of the object
  PropertyType.ListEntry,     // what type of element is modified
  ModificationType.Set,       // type of the modification
  true,                       // grant this capability
);
```


## IPLD
[IPLD](https://github.com/ipld/ipld)<sup>[+]</sup> is a way to store data as trees. The used implementation relies on [js-ipld-graph-builder](https://github.com/ipld/js-ipld-graph-builder)<sup>[+]</sup> for iterating over tree nodes and setting new subtrees, but uses a few modifications to the standard:
- nodes are not stored as [IPFS DAGs](https://github.com/ipfs/interface-ipfs-core/blob/master/SPEC/DAG.md)<sup>[+]</sup>, but stored as play JSON IPFS files
- nodes, that are encrypted, contain the property `cryptoInfo` for decryption (see [Encryption](#encryption))

### Adding Trees to IPLD
To add data to IPLD use the store function. The result is the hash for the root as a `bytes32` hash, that can be stored at smart contracts and used to retrieve the value later on:
```typescript
const sampleObject = {
  personalInfo: {
    firstName: 'eris',
  },
};
const stored = await ipld.store(Object.assign({}, sampleObject));
console.log(stored);
// Output:
// 0x12f6526dbe223eddd6c6a0fb7df118c87c56d34bf0c845b54bdca2fec0f3017d
```

### Retrieving Trees from IPLD
To retrieve data from IPLD trees, use the `bytes32` hash from storing the data:
```typescript
const stored = '0x12f6526dbe223eddd6c6a0fb7df118c87c56d34bf0c845b54bdca2fec0f3017d';
const loaded = await ipld.getLinkedGraph(stored, '');
console.dir(Ipld.purgeCryptoInfo(loaded));
// Output:
// { personalInfo: { firstName: 'eris' } }
```
For info about the `Ipld.purgeCryptoInfo` part see [Encryption in IPLD Trees](#encryption-in-ipld-trees).

The second argument is the path inside the tree. Passing '' means "retrieve data from root level". To get more specifc data, provide a path:
```typescript
const stored = '0x12f6526dbe223eddd6c6a0fb7df118c87c56d34bf0c845b54bdca2fec0f3017d';
const loaded = await ipld.getLinkedGraph(stored, 'personalInfo');
console.dir(Ipld.purgeCryptoInfo(loaded));
// Output:
// { firstName: 'eris' }
```

```typescript
const stored = '0x12f6526dbe223eddd6c6a0fb7df118c87c56d34bf0c845b54bdca2fec0f3017d';
const loaded = await ipld.getLinkedGraph(stored, 'personalInfo/firstName');
console.dir(Ipld.purgeCryptoInfo(loaded));
// Output:
// 'eris'
```

### Subtrees
What's pretty useful about IPLD graphs is, that not only plain JSON trees can be stored, but that those trees can be linked to other graphs, which makes it possible to build very powerful tree structures, that consist of multiple separate trees, that can be used on their own or in a tree, that combines all of those. The resulting hash is again `bytes32` hash and this can be stored in smart contracts like any other IPFS hash.

#### Extending trees
To combine separate IPLD trees, one tree has to be extended with the other one:
```typescript
const sampleObject = {
  personalInfo: {
    firstName: 'eris',
  },
};
const sub = {
  contracts: ['0x01', '0x02', '0x03']
};
const extended = await ipld.set(
  sampleObject,               // extend this graph
  'dapps',                    // attach the subgraph under the path "dapps"
  sub,                        // attach this graph as a subgraph
);
console.log(JSON.stringify(extended, null, 2));
// Output:
// {
//   "personalInfo": {
//     "firstName": "eris"
//   },
//   "dapps": {
//     "/": {
//       "contracts": [
//         "0x01",
//         "0x02",
//         "0x03"
//       ]
//     }
//   }
// }
```

Not too fancy and still not stored in IPFS, but note the `"/"` key. This is the junction point, that connects the two trees. Subtrees under such a junction point will be stored as a separate IPLD graph and only the reference to this graph is stored as the value of `"/"`.
```typescript
console.log(JSON.stringify(extended, null, 2));
const extendedstored = await ipld.store(Object.assign({}, extended));
// Output:
// "0xc74f6946aacbbd1418ddd7dec83a5bcd3710b384de767d529e624f9f08cbf9b4"
const loaded = await ipld.getLinkedGraph(extendedstored, '');
console.log(JSON.stringify(Ipld.purgeCryptoInfo(loaded), null, 2));
// Output:
// 
//  "personalInfo": {
//    "firstName": "eris"
//  },
//  "dapps": {
//    "/": {
//      "type": "Buffer",
//      "data": [ 18, 32, 246, 21, 166, 135, 236, 212, 70, 130, 94, 47, 81, 135, 153, 154, 201, 69, 109, 249, 97, 84, 252, 56, 214, 195, 149, 133, 116, 253, 19, 87, 217, 66 ]
//    }
//  }
// 
```

As you can see, the subgraph is added as a serialized Buffer. This Buffer represents the hash for the root hash of the subtree.


#### Getting Values from Subtrees
The path argument from the getLinkedGraph is able to resolve values in subtrees as well:
```typescript
const loaded = await ipld.getLinkedGraph(extendedstored, 'dapps/contracts');
console.log(JSON.stringify(loaded, null, 2));
// Output:
// [
//   "0x01",
//   "0x02",
//   "0x03"
// ]
```

The `getLinkedGraph` function resolves subgraphs only when required, which means, that if the path argument does not query into a subgraph, this tree is returned as a Buffer, like in the previous example.

A second function to retrieve values from IPLD graphs called `getResolvedGraph`, which resolves all subgraphs, but this function is intended for debugging and analysis purposes and should not be used in production environment.


### About Encryption in IPLD Trees
The last examples used `Ipld.purgeCryptoInfo` to cleanup the objects before logging them. This was done, because IPLD graphs are encrypted by default, which has a few impact on the data stored:
- The root node of a tree is "encrypted" with the encryption algorithm "unencrypted", resulting in the root node having its data stored as a Buffer. This is done to keep the root node in the same format as the other nodes, as:
- Nodes in the Tree are encrypted. This encryption is specified in the constructor as `defaultCryptoAlgo`.
- All nodes are en- or decrypted with the same account or "originator". The originator, that is used, is specified in the constructor as "originator". This means, that the IPLD instance is account bound and a new instance has to be created if another account should be used.

Going back to the first example and logging the result without purging the properties, we get:
```typescript
const stored = '0x12f6526dbe223eddd6c6a0fb7df118c87c56d34bf0c845b54bdca2fec0f3017d';
const loaded = await ipld.getLinkedGraph(stored, '');
console.dir(loaded);
// Output:
// { personalInfo: { firstName: 'eris' },
//   cryptoInfo: 
//    { originator: '0xd7c759941fa3962e4833707f2f44f8cb11b471916fb6f9f0facb03119628234e',
//      keyLength: 256,
//      algorithm: 'aes-256-cbc' } }
// 
```


## Mailbox
The [`Mailbox`](src/mailbox.ts) module is used for sending and retrieving bmails (blockchain mails) to other even.network members. Sending regular bmails between to parties requires them to have completed a [Key Exchange](#key-exchange) before being able to send encrypted messages. When exchanging the keys, bmails are encrypted with a commonly known key, that is only valid is this case and the underlying messages, that contain the actual keys are encrypted with Diffie Hellman keys, to ensure, that keys are exchanged in a safe manner (see [Key Exchange](#key-exchange) for details).

The mailbox is a [smart contract](https://github.com/evannetwork/smart-contracts/blob/master/contracts/MailBox.sol), that holds
- `bytes32` hashes, that are the encrypted contents of the mails
- basic metadata about the mails, like
  + recipient of a mail
  + sender of a mail
  + amount of EVEs, that belongs to the bmail
- if the mail is an answer to another mail, the reference to the original mail

### Send a Mail
Mails can be sent with:
```typescript
// account, that sends the mail
const account1 = '0x0000000000000000000000000000000000000001';
// account, that receives the mail
const account2 = '0x0000000000000000000000000000000000000002';
// mailbox of the sender
const mailbox1 = {};
// mailbox of the receiver
const mailbox2 = {};

const bmail = {
  content: {
    from: account1,
    to,
    title: 'Example bmail',
    body: 'This is a little example to demonstrate sending a bmail.',
    attachments: [ ]
  }
};
await mailbox1.sendMail(bmail, account1, account2);
```

### Retrieving bmails
To get received mails use:
```typescript
const received = await mailbox2.getMails();
console.dir(JSON.stringify(received[0], null, 2));
// Output:
// {
//   "mails": {
//     "0x000000000000000000000000000000000000000e": {
//       "content": {
//         "from": "0x0000000000000000000000000000000000000001",
//         "to": "0x0000000000000000000000000000000000000002",
//         "title": "Example bmail",
//         "body": "This is a little example to demonstrate sending a bmail.",
//         "attachments": [ ],
//         "sent": 1527083983148
//       },
//       "cryptoInfo": {
//         "originator": "0x549704d235e1fe5cd7326a1eb0c44c1e0a5434799ba6ff2370c2955730b66e2b",
//         "keyLength": 256,
//         "algorithm": "aes-256-cbc"
//       }
//     }
//   },
//   "totalResultCount": 9
// }
```

Results can be paged with passing arguments for page size and offsetto the `getMails` function:
```typescript
const received = await mailbox2.getMails(3, 0);
console.dir(JSON.stringify(received[0], null, 2));
// Output:
// { mails: 
//    { '0x000000000000000000000000000000000000000e': { content: [Object], cryptoInfo: [Object] },
//      '0x000000000000000000000000000000000000000d': { content: [Object], cryptoInfo: [Object] },
//      '0x000000000000000000000000000000000000000c': { content: [Object], cryptoInfo: [Object] } },
//   totalResultCount: 9 }
```

To get bmails *sent* by an account, use (the example account hasn't sent any bmail yet):
```typescript
const received = await mailbox2.getMails(3, 0, 'Sent');
console.dir(JSON.stringify(received[0], null, 2));
// Output:
// { mails: {}, totalResultCount: 0 }
```

### Answering to a bmail
Answering to a bmail works similar to sending a bmail, the only difference is, that the id of the original bmail has to be appended to the mail as well:
```typescript
const answer = {
  content: {
    from: account1,
    to,
    title: 'Example answer',
    body: 'This is a little example to demonstrate sending an answer.',
    attachments: [ ],
    parentId: '0x000000000000000000000000000000000000000e',
  }
};
await mailbox1.sendMail(answer, account2, account1);
```

### Bmails and EVEs
Bmails can contain EVEs for the recipient as well. Because retrieving bmails is a reading operation, funds send with a bmail have to be retrieved separately.

#### Checking a bmails balance
Funds can be checked with:
```typescript
const bmail = {
  content: {
    from: account1,
    to,
    title: 'Example bmail',
    body: 'This is a little example to demonstrate sending a bmail.',
    attachments: [ ]
  }
};
await mailbox1.sendMail(bmail, account1, account2, web3.utils.toWei('0.1', 'Ether'));
const received = await mailbox2.getMails(1, 0);
const mailBalance = await mailbox2.getBalanceFromMail(Object.keys(received)[0]);
console.log(mailBalance);
// Output:
// 100000000000000000
```

#### Withdrawing funds from bmails
Funds from bmails can be claimed with the account, that received the bmail. Funds are transferred to a specified account, which can be the claiming account or another account of choice.
```typescript
const received = await mailbox2.getMails(1, 0);
const mailBalance = await mailbox2.getBalanceFromMail(Object.keys(received)[0]);
console.log(mailBalance);
// Output:
// 100000000000000000
await mailbox2.withdrawFromMail(received)[0], accounts2);
const mailBalance = await mailbox2.getBalanceFromMail(Object.keys(received)[0]);
console.log(mailBalance);
// Output:
// 0
```


## Key Exchange
The `KeyExchange` module is used to exchange communication keys between two parties, assuming that both have created a profile and have a public facing partial Diffie Hellman key part (the combination of their own secret and the shared secret). The key exchange consists of three steps:
1. create a new communication key, that will be used by both parties for en- and decryption and store it on the initiators side
2. look up the other parties partial Diffie Hellman key part and combine it with the own private key to create the exchange key
3. use the exchange key to encrypt the communication key and send it via bmail (blockchain mail) to other party

### Start the Key Exchange Process
This example retrieves public facing partial Diffie Hellman key part from a second party and sends an invitation mail to it:
```typescript
// 
// account, that initiates the invitation
const account1 = '0x0000000000000000000000000000000000000001';
// account, that will receive the invitation
const account2 = '0x0000000000000000000000000000000000000002';
// profile from user, that initiates key exchange
const profile1 = {};
// profile from user, that is going to receive the invitation
const profile2 = {};
// key exchange instance for account1
const keyExchange1 = {};
// key exchange instance for account2
const keyExchange2 = {};

const foreignPubkey = await profile2.getPublicKey();
const commKey = await keyExchange.generateCommKey();
await keyExchange.sendInvite(account2, foreignPubkey, commKey, {
  fromAlias: 'Bob',           // initiating user states, that his name is 'Bob'
});
await profile1.addContactKey(account2, 'commKey', commKey);
await profile1.storeForAccount(profile1.treeLabels.addressBook);
```

### Finishing the Key Exchange Process
Let's assume that the communication key from the last example has been successfully sent to the other party and continue at there end from here. To keep the roles from the last example, the variables profile1, profile2 will belong to the same accounts:
```typescript
const encryptedCommKey = '...';       // key sent by account1
const profile1 = await profile1.getPublicKey();
const commSecret = keyExchange2.computeSecretKey(profile1);
const commKey = await keyExchange2.decryptCommKey(encryptedCommKey, commSecret.toString('hex'));
```


## Onboarding
The onboarding process is used to enable users to invite other users, where no blockchain account id is known. It allows to send an email to such contacts, that contains a link. This link points to a evan.network ÐApp, that allows accept the invitation by either creating a new account or by accepting it with an existing account.

It uses the [Key Exchange](#key-exchange) module described in the last section for its underlying key exchange process but moves the process of creating a new communication key to the invited user.

To get in contact with a user via email, a smart agent is used. This smart agent has to be added as a contact and a regular key exchange with the smart agent is performed. The agent accepts the invitation automatically and the inviting user sends a bmail (blockchain mail) with the contact details of the user, that should be invited, and an amount of welcome EVEs to the smart agent.

The onboarding smart creates a session on his end and sends an email to the invited user, that includes the session token, with which the invited user can claim the welcome EVEs.

The invited user now creates or confirms an account and start the key exchange process on his or her end. The rest of the flow is as described in [Key Exchange](#key-exchange).

To start the process at from the inviting users side, make sure that this user has exchanged keys with the onboarding smart agent. Then you can use:
```typescript
await onboarding.sendInvitation({
  fromAlias: 'example inviter',
  to: 'example invitee <example.invitee@evan.network>',
  lang: 'en',
  subject: 'evan.network Onboarding Invitation',
  body: 'I\'d like to welcome you on board.',
}, web3.utils.toWei('1'));
```
