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

import { Mailbox } from '../mailbox';
import { NameResolver } from '../name-resolver';
import { Profile } from '../profile/profile';
import { Did } from '../did/did';
import { Verifications } from '../verifications/verifications';

/**
 * parameters for KeyExchange constructor
 */
export interface IdentityOptions extends LoggerOptions {
  activeIdentity: string;
  config: any;
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
 * and there metadata in the addressbook.
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
 * The KeyExchange module is used to exchange communication keys between two parties, assuming that
 * both have created a profile and public have a public facing partial Diffie Hellman key part (the
 * combination of their own secret and the shared secret)
 *
 * @class      KeyExchange (name)
 */
export class Identity extends Logger {
  options: IdentityOptions;

  constructor(options: IdentityOptions) {
    super(options);
    this.options = options;
  }

  /**
   * Grants access to the current active identity to the passed identity, depending on the passed
   * type (read / readWrite).
   *
   * @param      {string}  identity  identity to give access
   * @param      {string}  type      read / readWrite
   * @param      {string}  note      Optional note that should be saved for this identity. (role in
   *                                 a company, name, ...)
   */
  public async grantAccess(
    identity: string,
    type: string,
    bmailContent: IdentityBMailContent,
    note?: string,
  ) {
    const {
      activeIdentity,
      config,
      mailbox,
      nameResolver,
      profile,
      runtimeConfig,
      web3,
    } = this.options;
    // prevent old profiles and ensure, that only the owner is running this function
    await this.ensureOwnerAndIdentityProfile();

    // prevent wrong sharing types
    if (type !== 'read' && type !== 'readWrite') {
      throw new Error(`Unknown access type passed to "identity.grantAccess(${identity}, ${type}, ${note})"`);
    }

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

    // send a b-mail including the activeIdentity encryptionKey to the target identity
    const ensRoot = nameResolver.getDomainName(config.nameResolver.domains.root);
    promises.push(mailbox.sendMail(
      {
        content: {
          from: activeIdentity,
          fromAlias: bmailContent.fromAlias,
          title: bmailContent.title,
          body: bmailContent.body,
          attachments: [
            {
              fullPath: `/dashboard.vue.${ensRoot}/settings.${ensRoot}`,
              type: 'url',
            },
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

    // grant access to act on behalf of the identity
    if (type === 'readWrite') {
      promises.push(this.grantWriteAccess(identity));
    }

    // wait until everything is saved to the chain
    await Promise.all(promises);
  }

  /**
   * Adds a identity to the did (delegate + authorization) and adds the identity to the current
   * activeIdentities keyholder
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
    } = this.options;

    // get the did for the current activeIdentity
    const activeDidAddress = await did.convertIdentityToDid(activeIdentity);
    const didDocumentToUpdate = await did.getDidDocument(activeDidAddress);
    // add the new identity to the did document
    didDocumentToUpdate.publicKey.push({
      id: `${didDocumentToUpdate.id}#${identity}`,
      type: 'Secp256k1VerificationKey2018',
      controller: didDocumentToUpdate.id,
      ethereumAddress: identity,
    });
    didDocumentToUpdate.authentication.push(`${didDocumentToUpdate.id}#${identity}`);
    await did.setDidDocument(activeIdentity, didDocumentToUpdate);

    // apply the identity as key to the keyHolder contract
    const keyHolderContract = await contractLoader.loadContract('KeyHolder', activeIdentity);
    await executor.executeContractTransaction(
      keyHolderContract,
      'addKey',
      { from: underlyingAccount },
      nameResolver.soliditySha3(identity),
      1,
      1,
    );
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
