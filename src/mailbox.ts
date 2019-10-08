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
  Logger,
  LoggerOptions,
  NameResolver,
  KeyProvider,
} from '@evan.network/dbcp';

import { CryptoProvider } from './encryption/crypto-provider';
import { Ipld } from './dfs/ipld';
import { Ipfs } from './dfs/ipfs';

/**
 * mail object
 */
export interface Mail {
  content: {
    attachments?: any[],
    body?: string,
    from?: string,
    fromAlias?: string,
    fromMail?: string,
    sent?: number,
    title?: string,
    to?: string,
  },
  answers?: MailboxResult,
  parentId?: string,
}

/**
 * collection of mails
 */
export interface MailboxResult {
  mails: { [index: string]: Mail },
  totalResultCount: number;
}

/**
 * parameters for Mailbox constructor
 */
export interface MailboxOptions extends LoggerOptions {
  mailboxOwner: string;
  nameResolver: NameResolver;
  ipfs: Ipfs;
  contractLoader: ContractLoader;
  cryptoProvider: CryptoProvider;
  keyProvider: KeyProvider;
  defaultCryptoAlgo: string;
}

/**
 * mailbox helper class for sending and retrieving mails and answers
 *
 * @class      Mailbox (name)
 */
export class Mailbox extends Logger {
  mailboxOwner: string;
  nameResolver: NameResolver;
  contractLoader: ContractLoader;
  mailboxContract: any;
  ipfs: Ipfs;
  cryptoProvider: CryptoProvider;
  keyProvider: KeyProvider;
  defaultCryptoAlgo: string;
  initialized: boolean;

  constructor(options: MailboxOptions) {
    super(options);
    this.mailboxOwner = options.mailboxOwner;
    this.nameResolver = options.nameResolver;
    this.contractLoader = options.contractLoader;
    this.ipfs = options.ipfs;
    this.keyProvider = options.keyProvider;
    this.cryptoProvider = options.cryptoProvider;
    this.defaultCryptoAlgo = options.defaultCryptoAlgo;
  }

  /**
   * initialize mailbox module
   *
   * @return     {Promise<void>}  resolved when done
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    } else {
      const domain = this.nameResolver.getDomainName(this.nameResolver.config.domains.mailbox);
      const address = await this.nameResolver.getAddress(domain);
      this.mailboxContract = this.contractLoader.loadContract('MailBoxInterface', address);
      this.initialized = true;
    }
  }

  async getSentMails(count = 10, offset = 0) {
    return await this.getMails(count, offset, 'Sent');
  }

  /**
   * gets received from mailboxOwner
   *
   * @param      {number}                  count   number of mails to retrieve (default 10)
   * @param      {number}                  offset  mail offset (default 0)
   * @return     {Promise<MailboxResult>}  The received mails.
   */
  async getReceivedMails(count = 10, offset = 0) {
    return await this.getMails(count, offset, 'Received');
  }

  /**
   * Gets the last n mails, resolved contents
   *
   * @param      {number}        count   retrieve up to this many answers (for paging)
   * @param      {number}        offset  skip this many answers (for paging)
   * @param      {string}        type    retrieve sent or received mails
   * @return     {Promise<any>}  resolved mails
   */
  async getMails(count = 10, offset = 0, type = 'Received'): Promise<MailboxResult> {
    await this.init();
    const results: MailboxResult = {
      mails: {},
      totalResultCount: 0,
    };

    const executor = this.nameResolver.executor;
    const listAddressHash = await executor.executeContractCall(
      this.mailboxContract, `getMy${type}Mails`, { from: this.mailboxOwner, });
    if (listAddressHash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      const listAddress = this.nameResolver.bytes32ToAddress(listAddressHash);
      const listContract = this.contractLoader.loadContract('DataStoreList', listAddress);
      const listLength = await executor.executeContractCall(listContract, 'length');
      results.totalResultCount = parseInt(listLength.toString(), 10);
      if (results.totalResultCount) {
        let ipld: Ipld;
        const mailIds = await this.nameResolver.getArrayFromListContract(listContract, count, offset, true);
        const originator = this.nameResolver.soliditySha3.apply(this.nameResolver, [
          this.nameResolver.soliditySha3(this.mailboxOwner), this.nameResolver.soliditySha3(this.mailboxOwner), ].sort());
        ipld = new Ipld({
          ipfs: this.ipfs,
          keyProvider: this.keyProvider,
          cryptoProvider: this.cryptoProvider,
          defaultCryptoAlgo: this.defaultCryptoAlgo,
          originator,
          nameResolver: this.nameResolver,
        });
        for (let mailId of mailIds) {
          try {
            const mailResult = await executor.executeContractCall(this.mailboxContract, 'getMail', mailId);
            const mail = await ipld.getLinkedGraph(mailResult.data);
            const hashedSender = this.nameResolver.soliditySha3(mail.content.from);
            if (hashedSender !== mailResult.sender) {
              throw new Error(`mail claims to be sent from ${hashedSender}, but was sent from ${mailResult.sender}`);
            } else {
              results.mails[mailId] = mail;
            }
          } catch (ex) {
            this.log(`could not unpack mail: "${mailId}"; ${ex.message || ex}`, 'warning');
            results.mails[mailId] = null;
          }
        }
      }
    }
    return results;
  }

  /**
   * Gets one single mail directly
   *
   * @param      {string}         mail  mail to resolve (mailId or hash)
   * @return     {Promise<Mail>}  The mail.
   */
  async getMail(mail: string): Promise<Mail> {
    await this.init();
    const executor = this.nameResolver.executor;
    let ipld: Ipld;
    const originator = this.nameResolver.soliditySha3.apply(this.nameResolver, [
      this.nameResolver.soliditySha3(this.mailboxOwner), this.nameResolver.soliditySha3(this.mailboxOwner), ].sort());
    ipld = new Ipld({
      ipfs: this.ipfs,
      keyProvider: this.keyProvider,
      cryptoProvider: this.cryptoProvider,
      defaultCryptoAlgo: this.defaultCryptoAlgo,
      originator,
      nameResolver: this.nameResolver,
    });

    try {
      if (mail.startsWith('Qm')) {
        return await ipld.getLinkedGraph(mail);
      } else {
        const mailResult = await executor.executeContractCall(this.mailboxContract, 'getMail', mail);
        const mailItem = await ipld.getLinkedGraph(mailResult.data);
        const hashedSender = this.nameResolver.soliditySha3(mailItem.content.from);
        if (hashedSender !== mailResult.sender) {
          throw new Error(`mail claims to be sent from ${hashedSender}, but was sent from ${mailResult.sender}`);
        } else {
          return mailItem;
        }
      }
    } catch (ex) {
      this.log(`could not decrypt mail: "${mail}"; ${ex.message || ex}`, 'warning');
      return null;
    }
  }

  /**
   * Gets answer tree for mail, traverses subanswers as well
   *
   * @param      {string}         mailId  mail to resolve
   * @param      {number}         count   retrieve up to this many answers (for paging)
   * @param      {number}         offset  skip this many answers (for paging)
   * @return     {Promise<any>}  answer tree for mail
   */
  async getAnswersForMail(mailId: string, count = 5, offset = 0): Promise<any> {
    await this.init();
    const results: MailboxResult = {
      mails: {},
      totalResultCount: 0,
    };

    const executor = this.nameResolver.executor;
    const listAddressHash = await executor.executeContractCall(
      this.mailboxContract, 'getAnswersForMail', mailId, { from: this.mailboxOwner, });
    if (listAddressHash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      const listAddress = this.nameResolver.bytes32ToAddress(listAddressHash);
      const listContract = this.contractLoader.loadContract('DataStoreList', listAddress);
      const listLength = await executor.executeContractCall(listContract, 'length');
      results.totalResultCount = parseInt(listLength, 10);
      if (results.totalResultCount) {
        let ipld: Ipld;
        const mailIds = await this.nameResolver.getArrayFromListContract(listContract, count, offset, true);
        const originator = this.nameResolver.soliditySha3.apply(this.nameResolver, [
          this.nameResolver.soliditySha3(this.mailboxOwner), this.nameResolver.soliditySha3(this.mailboxOwner), ].sort());
        ipld = new Ipld({
          ipfs: this.ipfs,
          keyProvider: this.keyProvider,
          cryptoProvider: this.cryptoProvider,
          defaultCryptoAlgo: this.defaultCryptoAlgo,
          originator,
          nameResolver: this.nameResolver,
        });
        for (let answerId of mailIds) {
          try {
            const mailResult = await executor.executeContractCall(this.mailboxContract, 'getMail', answerId);
            const mail = await ipld.getLinkedGraph(mailResult.data);
            const hashedSender = this.nameResolver.soliditySha3(mail.content.from);
            if (hashedSender !== mailResult.sender) {
              throw new Error(`mail claims to be sent from ${hashedSender}, but was sent from ${mailResult.sender}`);
            } else {
              results.mails[answerId] = mail;
            }
          } catch (ex) {
            this.log(`could not unpack answer: "${answerId}"; ${ex.message || ex}`, 'warning');
            results.mails[answerId] = null;
          }
        }
      }
    }

    return results;
  }

  /**
   * sends a mail to given target
   *
   * @param      {Mail}           mail     a mail to send
   * @param      {string}         from     account id to send mail from
   * @param      {string}         to       account id to send mail to
   * @param      {string}         value    (optional) UTC amount to send with mail in Wei can be
   *                                       created with web3[.utils].toWei(...)
   * @param      {string}         context  encrypt mail with different context
   * @return     {Promise<void>}  resolved when done
   */
  async sendMail(mail: Mail, from: string, to: string, value = '0', context?: string): Promise<void> {
    await this.init();
    mail.content.from = from;
    mail.content.sent = new Date().getTime();
    mail.content.to = to;
    const combinedHash = this.nameResolver.soliditySha3.apply(this.nameResolver,
      [this.nameResolver.soliditySha3(to), this.nameResolver.soliditySha3(this.mailboxOwner)].sort());
    const ipld: Ipld = new Ipld({
      ipfs: this.ipfs,
      keyProvider: this.keyProvider,
      cryptoProvider: this.cryptoProvider,
      originator: context ? this.nameResolver.soliditySha3(context) : combinedHash,
      defaultCryptoAlgo: this.defaultCryptoAlgo,
      nameResolver: this.nameResolver,
    });
    const hash = await ipld.store(mail);
    await this.nameResolver.executor.executeContractTransaction(
      this.mailboxContract,
      'sendMail',
      { from, autoGas: 1.1, value, },
      [ to ],
      hash,
    );
  }

  /**
   * send answer to a mail
   *
   * @param      {Mail}           mail    mail to send as a reply
   * @param      {string}         from    sender address
   * @param      {string}         to      receiver address
   * @param      {string}         value   (optional) UTC amount to send with mail in Wei can be
   *                                       created with web3[.utils].toWei(...)
   * @return     {Promise<void>}  resolved when done
   */
  async sendAnswer(mail: Mail, from: string, to: string, value = '0'): Promise<void> {
    await this.init();
    mail.content.sent = new Date().getTime();
    const combinedHash = this.nameResolver.soliditySha3.apply(this.nameResolver,
      [this.nameResolver.soliditySha3(to), this.nameResolver.soliditySha3(this.mailboxOwner)].sort());
    const ipld: Ipld = new Ipld({
      ipfs: this.ipfs,
      keyProvider: this.keyProvider,
      cryptoProvider: this.cryptoProvider,
      originator: combinedHash,
      defaultCryptoAlgo: this.defaultCryptoAlgo,
      nameResolver: this.nameResolver,
    });
    const parentId = mail.parentId;
    const hash = await ipld.store(mail);
    await this.nameResolver.executor.executeContractTransaction(
      this.mailboxContract,
      'sendAnswer',
      { from, autoGas: 1.1, value, },
      [ to ],
      hash,
      parentId,
    );
  }

  /**
   * returns amount of UTC deposited for a mail
   *
   * @param      {string}           mailId  mail to resolve
   * @return     {Promise<string>}  balance of the mail in Wei  can be converted with
   *                                web3[.utils].fromWei(...)
   */
  async getBalanceFromMail(mailId: string): Promise<string> {
    await this.init();
    // mailboxOwner
    return this.nameResolver.executor.executeContractCall(
      this.mailboxContract,
      'getBalanceFromMail',
      mailId,
      { from: this.mailboxOwner, },
    );
  }

  /**
   * transfers mails deposited UTC tokens to target account
   *
   * @param      {string}         mailId     mail to resolve
   * @param      {string}         recipient  account, that receives the EVEs
   * @return     {Promise<void>}  resolved when done
   */
  async withdrawFromMail(mailId: string, recipient: string): Promise<void> {
    await this.init();
    // mailboxOwner
    await this.nameResolver.executor.executeContractTransaction(
      this.mailboxContract,
      'withdrawFromMail',
      { from: this.mailboxOwner, autoGas: 1.1, },
      mailId,
      recipient,
    );
  }
}
