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
  NameResolver,
  KeyProvider,
} from '@evan.network/dbcp';

import {
  CryptoProvider,
  Ipld,
  Ipfs,
} from './index';

/**
 * mail object
 */
export interface Mail {
  content: {
    attachments?: any[];
    body?: string;
    from?: string;
    fromAlias?: string;
    fromMail?: string;
    sent?: number;
    title?: string;
    to?: string;
  };
  answers?: MailboxResult;
  parentId?: string;
}

/**
 * collection of mails
 */
export interface MailboxResult {
  mails: { [index: string]: Mail };
  totalResultCount: number;
}

/**
 * parameters for Mailbox constructor
 */
export interface MailboxOptions extends LoggerOptions {
  contractLoader: ContractLoader;
  cryptoProvider: CryptoProvider;
  defaultCryptoAlgo: string;
  ipfs: Ipfs;
  keyProvider: KeyProvider;
  mailboxOwner: string;
  nameResolver: NameResolver;
  executor?: Executor;
}

/**
 * mailbox helper class for sending and retrieving mails and answers
 *
 * @class      Mailbox (name)
 */
export class Mailbox extends Logger {
  public contractLoader: ContractLoader;

  public cryptoProvider: CryptoProvider;

  public defaultCryptoAlgo: string;

  public executor: Executor;

  public initialized: boolean;

  public ipfs: Ipfs;

  public keyProvider: KeyProvider;

  public mailboxContract: any;

  public mailboxOwner: string;

  public nameResolver: NameResolver;

  public constructor(options: MailboxOptions) {
    super(options);
    this.contractLoader = options.contractLoader;
    this.cryptoProvider = options.cryptoProvider;
    this.defaultCryptoAlgo = options.defaultCryptoAlgo;
    this.ipfs = options.ipfs;
    this.keyProvider = options.keyProvider;
    this.mailboxOwner = options.mailboxOwner;
    this.nameResolver = options.nameResolver;
    this.executor = options.executor || options.nameResolver.executor;
  }

  /**
   * Gets answer tree for mail, traverses subanswers as well
   *
   * @param      {string}         mailId  mail to resolve
   * @param      {number}         count   retrieve up to this many answers (for paging)
   * @param      {number}         offset  skip this many answers (for paging)
   * @return     {Promise<any>}  answer tree for mail
   */
  public async getAnswersForMail(mailId: string, count = 5, offset = 0): Promise<any> {
    await this.init();
    const results: MailboxResult = {
      mails: {},
      totalResultCount: 0,
    };

    const listAddressHash = await this.executor.executeContractCall(
      this.mailboxContract, 'getAnswersForMail', mailId, { from: this.mailboxOwner },
    );
    if (listAddressHash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      const listAddress = this.nameResolver.bytes32ToAddress(listAddressHash);
      const listContract = this.contractLoader.loadContract('DataStoreList', listAddress);
      const listLength = await this.executor.executeContractCall(listContract, 'length');
      results.totalResultCount = parseInt(listLength, 10);
      if (results.totalResultCount) {
        const mailIds = await this.nameResolver.getArrayFromListContract(
          listContract, count, offset, true,
        );
        const originator = this.nameResolver.soliditySha3(
          ...[
            this.nameResolver.soliditySha3(this.mailboxOwner),
            this.nameResolver.soliditySha3(this.mailboxOwner),
          ].sort(),
        );
        const ipld = new Ipld({
          ipfs: this.ipfs,
          keyProvider: this.keyProvider,
          cryptoProvider: this.cryptoProvider,
          defaultCryptoAlgo: this.defaultCryptoAlgo,
          originator,
          nameResolver: this.nameResolver,
        });
        for (const answerId of mailIds) {
          try {
            const mailResult = await this.executor.executeContractCall(
              this.mailboxContract, 'getMail', answerId,
            );
            const mail = await ipld.getLinkedGraph(mailResult.data);
            const hashedSender = this.nameResolver.soliditySha3(mail.content.from);
            if (hashedSender !== mailResult.sender) {
              throw new Error(`mail claims to be sent from ${hashedSender}, `
                + `but was sent from ${mailResult.sender}`);
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
   * returns amount of UTC deposited for a mail
   *
   * @param      {string}           mailId  mail to resolve
   * @return     {Promise<string>}  balance of the mail in Wei  can be converted with
   *                                web3[.utils].fromWei(...)
   */
  public async getBalanceFromMail(mailId: string): Promise<string> {
    await this.init();
    // mailboxOwner
    return this.executor.executeContractCall(
      this.mailboxContract,
      'getBalanceFromMail',
      mailId,
      { from: this.mailboxOwner },
    );
  }

  /**
   * Gets one single mail directly
   *
   * @param      {string}         mail  mail to resolve (mailId or hash)
   * @return     {Promise<Mail>}  The mail.
   */
  public async getMail(mail: string): Promise<Mail> {
    await this.init();
    const originator = this.nameResolver.soliditySha3(
      ...[
        this.nameResolver.soliditySha3(this.mailboxOwner),
        this.nameResolver.soliditySha3(this.mailboxOwner),
      ].sort(),
    );
    const ipld = new Ipld({
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
      }
      const mailResult = await this.executor.executeContractCall(this.mailboxContract, 'getMail', mail);
      const mailItem = await ipld.getLinkedGraph(mailResult.data);
      const hashedSender = this.nameResolver.soliditySha3(mailItem.content.from);
      if (hashedSender !== mailResult.sender) {
        throw new Error(`mail claims to be sent from ${hashedSender}, but was sent from ${mailResult.sender}`);
      } else {
        return mailItem;
      }
    } catch (ex) {
      this.log(`could not decrypt mail: "${mail}"; ${ex.message || ex}`, 'warning');
      return null;
    }
  }

  /**
   * Gets the last n mails, resolved contents
   *
   * @param      {number}        count   retrieve up to this many answers (for paging)
   * @param      {number}        offset  skip this many answers (for paging)
   * @param      {string}        type    retrieve sent or received mails
   * @return     {Promise<any>}  resolved mails
   */
  public async getMails(count = 10, offset = 0, type = 'Received'): Promise<MailboxResult> {
    await this.init();
    const results: MailboxResult = {
      mails: {},
      totalResultCount: 0,
    };

    const listAddressHash = await this.executor.executeContractCall(
      this.mailboxContract, `getMy${type}Mails`, { from: this.mailboxOwner },
    );
    if (listAddressHash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      const listAddress = this.nameResolver.bytes32ToAddress(listAddressHash);
      const listContract = this.contractLoader.loadContract('DataStoreList', listAddress);
      const listLength = await this.executor.executeContractCall(listContract, 'length');
      results.totalResultCount = parseInt(listLength.toString(), 10);
      if (results.totalResultCount) {
        const mailIds = await this.nameResolver.getArrayFromListContract(
          listContract, count, offset, true,
        );
        const originator = this.nameResolver.soliditySha3(
          ...[
            this.nameResolver.soliditySha3(this.mailboxOwner),
            this.nameResolver.soliditySha3(this.mailboxOwner),
          ].sort(),
        );
        const ipld = new Ipld({
          ipfs: this.ipfs,
          keyProvider: this.keyProvider,
          cryptoProvider: this.cryptoProvider,
          defaultCryptoAlgo: this.defaultCryptoAlgo,
          originator,
          nameResolver: this.nameResolver,
        });
        for (const mailId of mailIds) {
          try {
            const mailResult = await this.executor.executeContractCall(this.mailboxContract, 'getMail', mailId);
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
   * gets received from mailboxOwner
   *
   * @param      {number}                  count   number of mails to retrieve (default 10)
   * @param      {number}                  offset  mail offset (default 0)
   * @return     {Promise<MailboxResult>}  The received mails.
   */
  public async getReceivedMails(count = 10, offset = 0) {
    return this.getMails(count, offset, 'Received');
  }

  public async getSentMails(count = 10, offset = 0) {
    return this.getMails(count, offset, 'Sent');
  }

  /**
   * initialize mailbox module
   *
   * @return     {Promise<void>}  resolved when done
   */
  public async init(): Promise<void> {
    if (!this.initialized) {
      const domain = this.nameResolver.getDomainName(this.nameResolver.config.domains.mailbox);
      const address = await this.nameResolver.getAddress(domain);
      this.mailboxContract = this.contractLoader.loadContract('MailBoxInterface', address);
      this.initialized = true;
    }
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
  public async sendAnswer(mail: Mail, from: string, to: string, value = '0'): Promise<void> {
    await this.init();
    // eslint-disable-next-line no-param-reassign
    mail.content.sent = new Date().getTime();
    const combinedHash = this.nameResolver.soliditySha3(
      ...[
        this.nameResolver.soliditySha3(to),
        this.nameResolver.soliditySha3(this.mailboxOwner),
      ].sort(),
    );
    const ipld: Ipld = new Ipld({
      ipfs: this.ipfs,
      keyProvider: this.keyProvider,
      cryptoProvider: this.cryptoProvider,
      originator: combinedHash,
      defaultCryptoAlgo: this.defaultCryptoAlgo,
      nameResolver: this.nameResolver,
    });
    const { parentId } = mail;
    const hash = await ipld.store(mail);
    await this.executor.executeContractTransaction(
      this.mailboxContract,
      'sendAnswer',
      { from, autoGas: 1.1, value },
      [to],
      hash,
      parentId,
    );
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
  public async sendMail(mail: Mail, from: string, to: string, value = '0', context?: string): Promise<void> {
    await this.init();
    // eslint-disable-next-line no-param-reassign
    mail.content.from = from;
    // eslint-disable-next-line no-param-reassign
    mail.content.sent = new Date().getTime();
    // eslint-disable-next-line no-param-reassign
    mail.content.to = to;
    const combinedHash = this.nameResolver.soliditySha3(
      ...[
        this.nameResolver.soliditySha3(to),
        this.nameResolver.soliditySha3(this.mailboxOwner),
      ].sort(),
    );
    const ipld: Ipld = new Ipld({
      ipfs: this.ipfs,
      keyProvider: this.keyProvider,
      cryptoProvider: this.cryptoProvider,
      originator: context ? this.nameResolver.soliditySha3(context) : combinedHash,
      defaultCryptoAlgo: this.defaultCryptoAlgo,
      nameResolver: this.nameResolver,
    });
    const hash = await ipld.store(mail);
    await this.executor.executeContractTransaction(
      this.mailboxContract,
      'sendMail',
      { from, autoGas: 1.1, value },
      [to],
      hash,
    );
  }

  /**
   * transfers mails deposited UTC tokens to target account
   *
   * @param      {string}         mailId     mail to resolve
   * @param      {string}         recipient  account, that receives the EVEs
   * @return     {Promise<void>}  resolved when done
   */
  public async withdrawFromMail(mailId: string, recipient: string): Promise<void> {
    await this.init();
    // mailboxOwner
    await this.executor.executeContractTransaction(
      this.mailboxContract,
      'withdrawFromMail',
      { from: this.mailboxOwner, autoGas: 1.1 },
      mailId,
      recipient,
    );
  }
}
