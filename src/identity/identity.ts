/*
  Copyright (C) 2018-present evan GmbH.

  This program is free software: you can redistribute it and/or modify it
  under the terms of the GNU Affero General Public License, version 3,
  as published by the Free Software Foundation.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
  See the GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program. If not, see http://www.gnu.org/licenses/ or
  write to the Free Software Foundation, Inc., 51 Franklin Street,
  Fifth Floor, Boston, MA, 02110-1301 USA, or download the license from
  the following URL: https://evan.network/license/
*/

import {
  ContractLoader,
  Executor,
  Logger,
  LoggerOptions,
} from '@evan.network/dbcp';

import { Did } from '../did/did';
import { Mailbox } from '../mailbox';
import { NameResolver } from '../name-resolver';
import { Profile } from '../profile/profile';
import { Verifications } from '../verifications/verifications';
import { nullAddress } from '../common/utils';

/**
 * purpose of a key in an identity
 */
export enum IdentityKeyPurpose {
  /**
   * Management key holder are allowed to add an remove members of an identity.verifications.
   * Identities with a version <1 they also are allowed to perform transactions on behalf
   * of this identity.
   */
  Management = 1,
  /** Action key holder allowed to perform transactions on behalf of this identity. */
  Action = 2,
  /**
   * Recovery keys are available for identities with a version >= 1.
   * Recovery key holder can't be removed by other users and every identity can only have up to
   * one recovery key holder.
   */
  Recovery = 3,
}

/**
 * parameters for Identity constructor
 */
export interface IdentityOptions extends LoggerOptions {
  activeIdentity: string;
  contractLoader: ContractLoader;
  did: Did;
  executor: Executor;
  mailbox: Mailbox;
  nameResolver: NameResolver;
  profile: Profile;
  runtimeConfig: any;
  underlyingAccount: string;
  verifications: Verifications;
  web3: any;
}


/**
 * Options that can be passed to the `grantAccess` function, so the logic can track permitted users
 * and their metadata in the addressbook.
 */
export interface IdentityAccessPayload {
  hasIdentityAccess: string;
  identityAccessGranted: string;
  identityAccessNote: string;
}

/**
 * Content of the bmail that should be sent to the user.
 */
export interface IdentityBMailContent {
  body: string;
  fromAlias: string;
  title: string;
}

/**
 * Each identity can be permitted to act on behalf of another identity. This identity
 * library helps to grant / remove read or write permissions to act on behalf of an identity and
 * also to manage identities an identity was invitited to.
 *
 * @class      Identity (name)
 */
export class Identity extends Logger {
  options: IdentityOptions;

  constructor(options: IdentityOptions) {
    super(options);
    this.options = options;
  }

  /**
   * Grants the current active identity access to the passed identity, depending on the passed type
   * (read / readWrite). Sends the identities encryption key via bmail and uses ``grantWriteAccess``
   * internally to grant ``write`` permission.
   *
   * @param      {string}                identity      identity to give access
   * @param      {string}                type          read / readWrite
   * @param      {IdentityBMailContent}  bmailContent  content that should be passed as
   *                                                   bmail.content
   * @param      {string}                note          Optional note that should be saved for this
   *                                                   identity. (role in a company, name, ...)
   */
  public async grantAccess(
    identity: string,
    type: string,
    bmailContent: IdentityBMailContent,
    note?: string,
  ): Promise<void> {
    const {
      activeIdentity,
      mailbox,
      profile,
      runtimeConfig,
      web3,
    } = this.options;
    this.log(`granting identity "${identity}" ${type} access to "${activeIdentity}"`, 'debug');
    // prevent old profiles and ensure, that only the owner is running this function
    await this.ensureOwnerAndIdentityProfile();

    // prevent wrong sharing types
    if (type !== 'read' && type !== 'readWrite') {
      throw new Error(`Unknown access type passed to "identity.grantAccess(${identity}, ${type}, ${note})"`);
    }

    // load addressbook to check for changes
    const addressbook = await profile.getAddressBook();
    const originContact = { ...addressbook.profile[identity] };

    // save information into the current profile about the grant status
    await Promise.all([
      profile.addProfileKey(identity, 'hasIdentityAccess', type),
      profile.addProfileKey(identity, 'identityAccessGranted', Date.now().toString()),
      profile.addProfileKey(identity, 'identityAccessNote', note),
    ]);

    // stack the promises, so we can Promise.all them at the end
    const promises = [
      // store the newly added / updated profile keys
      profile.storeForAccount(profile.treeLabels.addressBook),
    ];

    // only send bmail, if the permissions have changed
    if (!originContact || originContact.hasIdentityAccess !== type) {
      // send a b-mail including the activeIdentity encryptionKey to the target identity
      promises.push(mailbox.sendMail(
        {
          content: {
            from: activeIdentity,
            fromAlias: bmailContent.fromAlias,
            title: bmailContent.title,
            body: bmailContent.body,
            attachments: [
              {
                encryptionKey: runtimeConfig.keyConfig[web3.utils.soliditySha3(activeIdentity)],
                permission: type,
                type: 'identityAccess',
              },
            ],
          },
        },
        activeIdentity,
        identity,
      ));
    }

    // grant access to act on behalf of the identity (only if the permission wasn't added before)
    if (type === 'readWrite' && originContact.hasIdentityAccess !== type) {
      promises.push(this.grantWriteAccess(identity));
    }

    // wait until everything is saved to the chain
    await Promise.all(promises);
  }

  /**
   * Adds a identity to the identity did document (pubKey + authorization) and adds the identity to
   * the current activeIdentities keyholder.
   *
   * @param      {string}  identity  identity to give write access to.
   */
  public async grantWriteAccess(identity: string): Promise<void> {
    await this.ensureOwnerAndIdentityProfile();

    const {
      activeIdentity,
      contractLoader,
      did,
      executor,
      nameResolver,
      underlyingAccount,
      verifications,
    } = this.options;

    const accountId = await verifications.getOwnerAddressForIdentity(identity);
    if (accountId === nullAddress) {
      throw new Error(
        'identity does not seem to be a user identity, '
          + 'granting write access is currently only supported for user identities',
      );
    }
    this.log(`granting identity "${identity}", account "${accountId}", write access to "${activeIdentity}"`, 'debug');

    // get the did for the current activeIdentity
    const activeDidAddress = await did.convertIdentityToDid(activeIdentity);
    const didDocumentToUpdate = await did.getDidDocument(activeDidAddress);
    // add the new identity to the did document
    const hasPublicKey = didDocumentToUpdate.publicKey.some(
      (pubKey: any) => pubKey.ethereumAddress === accountId,
    );
    if (!hasPublicKey) {
      // find last key id, increase by 1 for new id
      const defaultKeyPattern = new RegExp(`${didDocumentToUpdate.id}#key-\\d+`);
      const publicKeysMatchingPattern = didDocumentToUpdate.publicKey.filter(
        (publicKey) => defaultKeyPattern.test(publicKey.id),
      );
      const oldNumberSuffix = publicKeysMatchingPattern.length
        ? parseInt(
          publicKeysMatchingPattern[publicKeysMatchingPattern.length - 1].id.split('-')[1],
          10,
        )
        : 0;
      const newId = `${didDocumentToUpdate.id}#key-${oldNumberSuffix + 1}`;
      didDocumentToUpdate.publicKey.push({
        id: newId,
        type: 'Secp256k1VerificationKey2018',
        controller: await did.convertIdentityToDid(identity),
        ethereumAddress: accountId.toLowerCase(),
      });
      didDocumentToUpdate.authentication.push(newId);
      await did.setDidDocument(activeDidAddress, didDocumentToUpdate);
    }

    // apply the identity as key to the keyHolder contract
    const keyHolderContract = await contractLoader.loadContract('KeyHolder', activeIdentity);
    const version = await this.options.executor.executeContractCall(keyHolderContract, 'VERSION_ID');
    if (version === null) {
      // older identities only use purose 1 for granting access
      await executor.executeContractTransaction(
        keyHolderContract,
        'addKey',
        { from: underlyingAccount },
        nameResolver.soliditySha3(accountId),
        IdentityKeyPurpose.Management,
        1,
      );
    } else if (version.eq('1')) {
      // new identities have split permissions into different purposes
      await executor.executeContractTransaction(
        keyHolderContract,
        'addMultiPurposeKey',
        { from: underlyingAccount },
        nameResolver.soliditySha3(accountId),
        [IdentityKeyPurpose.Management, IdentityKeyPurpose.Action],
        1,
      );
    } else {
      throw new Error(`invalid identity version: ${version}`);
    }
  }

  /**
   * Removes the access, to act on behalf of the activeIdentity, for another identity. When removing
   * read access, a bmail is sent, so the identity gets a notification with a attachment, with a
   * ``identityAccessRemove`` attachment.
   *
   * @param      {string}                identity      identity to remove the access for
   * @param      {string}                type          read, write, readWrite
   * @param      {IdentityBMailContent}  bmailContent  optional bmail content to inform the identity
   */
  public async removeAccess(
    identity: string,
    type: string,
    bmailContent?: IdentityBMailContent,
  ): Promise<void> {
    const {
      activeIdentity,
      mailbox,
      profile,
    } = this.options;
    this.log(`revoking ${type} access on "${activeIdentity}" for account "${identity}"`, 'debug');
    // prevent old profiles and ensure, that only the owner is running this function
    await this.ensureOwnerAndIdentityProfile();

    // prevent wrong sharing types
    if (type !== 'read' && type !== 'write' && type !== 'readWrite') {
      throw new Error(`Unknown access type passed to "identity.removeAccess(${identity}, ${type})"`);
    }

    if (type.startsWith('read')) {
      // save information into the current profile about the grant status
      const addressBook = await profile.getAddressBook();
      if (addressBook.profile[identity]) {
        delete addressBook.profile[identity].hasIdentityAccess;
        delete addressBook.profile[identity].identityAccessGranted;
        delete addressBook.profile[identity].identityAccessNote;
      }
    } else {
      // save information into the current profile about the grant status
      await Promise.all([
        profile.addProfileKey(identity, 'hasIdentityAccess', 'read'),
        profile.addProfileKey(identity, 'identityAccessGranted', Date.now().toString()),
      ]);
    }

    // stack the promises, so we can Promise.all them at the end
    const promises = [
      // store the newly added / updated profile keys
      profile.storeForAccount(profile.treeLabels.addressBook),
    ];

    if (bmailContent) {
      // only send bmail, if the permissions have changed
      promises.push(mailbox.sendMail(
        {
          content: {
            from: activeIdentity,
            fromAlias: bmailContent.fromAlias,
            title: bmailContent.title,
            body: bmailContent.body,
            attachments: [
              {
                permission: type,
                type: 'identityAccessRemove',
              },
            ],
          },
        },
        activeIdentity,
        identity,
      ));
    }

    // remove access to act on behalf of the identity (only if the permission wasn't added before)
    if (type === 'readWrite' || type === 'write') {
      promises.push(this.removeWriteAccess(identity));
    }

    // wait until everything is saved to the chain
    await Promise.all(promises);
  }

  /**
   * Remove a identity from the activeIdentity did (pubKey + authenticiaton) and removes the
   * identity key from the keyholder.
   *
   * @param      {string}  identity  identity to remove write access for
   */
  public async removeWriteAccess(identity: string) {
    await this.ensureOwnerAndIdentityProfile();

    const {
      activeIdentity,
      contractLoader,
      did,
      executor,
      nameResolver,
      underlyingAccount,
    } = this.options;

    const accountId = await this.options.verifications.getOwnerAddressForIdentity(identity);
    if (accountId === nullAddress) {
      throw new Error(
        'identity does not seem to be a user identity, '
          + 'revoking write access is currently only supported for user identities',
      );
    }
    this.log(`revoking write access on "${activeIdentity}" for account "${identity}"`, 'debug');

    // get the did for the current activeIdentity
    const activeDidAddress = await did.convertIdentityToDid(activeIdentity);
    const didDocumentToUpdate = await did.getDidDocument(activeDidAddress);
    // remove public key from DID document
    const accountIdLowerCase = accountId.toLowerCase();
    let removedKey;
    didDocumentToUpdate.publicKey = didDocumentToUpdate.publicKey.filter(
      (pubKey: any) => {
        if (pubKey.ethereumAddress === accountIdLowerCase) {
          removedKey = pubKey.id;
          return false;
        }
        return true;
      },
    );
    didDocumentToUpdate.authentication = didDocumentToUpdate.authentication.filter(
      (authKey) => {
        if (authKey === removedKey) {
          return false;
        }
        return true;
      },
    );
    if (removedKey) {
      await did.setDidDocument(activeDidAddress, didDocumentToUpdate);
    }

    // apply the identity as key to the keyHolder contract
    const sha3Identity = nameResolver.soliditySha3(accountId);
    const keyHolderContract = await contractLoader.loadContract('KeyHolder', activeIdentity);
    const purposes = await executor.executeContractCall(
      keyHolderContract,
      'getKeyPurposes',
      sha3Identity,
    );
    if (purposes.length) {
      const version = await this.options.executor.executeContractCall(
        keyHolderContract,
        'VERSION_ID',
      );

      if (version === null) {
        await executor.executeContractTransaction(
          keyHolderContract,
          'removeKey',
          { from: underlyingAccount },
          sha3Identity,
          IdentityKeyPurpose.Management,
        );
      } else if (version.eq('1')) {
        await executor.executeContractTransaction(
          keyHolderContract,
          'removeMultiPurposeKey',
          { from: underlyingAccount },
          sha3Identity,
          purposes,
        );
      } else {
        throw new Error(`invalid identity version: ${version}`);
      }
    }
  }

  /**
   * Check if the underlyingAccount is rly. the owner of the activeIdentity. If not, throw an error
   * and exit the functions.
   */
  private async ensureOwnerAndIdentityProfile() {
    const { activeIdentity, underlyingAccount, verifications } = this.options;

    if (underlyingAccount === activeIdentity) {
      throw new Error('"grantAccess" is only supported for identity based profiles.');
    }

    const owner = await verifications.getOwnerAddressForIdentity(activeIdentity);
    if (underlyingAccount !== owner) {
      throw new Error('Granting write permissions to identity is only allowed by the identity owner.');
    }
  }
}
