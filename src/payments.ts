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
  AccountStore,
  ContractLoader,
  Logger,
  LoggerOptions,
} from '@evan.network/dbcp';

import * as BigNumber from 'bignumber.js';
import {
  recoverTypedSignatureLegacy,
  signTypedDataLegacy,
  typedSignatureHash,
} from 'eth-sig-util';

/**
 * parameters for Payments constructor
 */
export interface PaymentOptions extends LoggerOptions {
  executor: any;
  accountStore: AccountStore;
  contractLoader: ContractLoader;
  web3: any;
}

/**
 * Paymentchannel proof data type
 */
export interface MicroProof {
  /**
   * Balance value
   */
  balance: BigNumber;
  /**
   * Balance signature
   */
  sig?: string;
}

/**
 * Payment channel state data blueprint
 */
export interface MicroChannel {
  /**
   * Sender/client's account address
   */
  account: string;
  /**
   * Receiver/server's account address
   */
  receiver: string;
  /**
   * Open channel block number
   */
  block: number;
  /**
   * Current balance proof
   */
  proof: MicroProof;
  /**
   * Next balance proof, persisted with confirmPayment
   */
  next_proof?: MicroProof;
  /**
   * Cooperative close signature from receiver
   */
  closing_sig?: string;
}


/**
 * getChannelInfo result
 */
export interface MicroChannelInfo {
  /**
   * Current channel state, one of 'opened', 'closed' or 'settled'
   */
  state: string;
  /**
   * Block of current state (opened=open block number,
   * closed=channel close requested block number, settled=settlement block number)
   */
  block: number;
  /**
   * Current channel deposited sum
   */
  deposit: BigNumber;
  /**
   * Value already taken from the channel
   */
  withdrawn: BigNumber;
}


/**
 * Array member type to be sent to eth_signTypedData
 */
interface MsgParam {
  type: string;
  name: string;
  value: string;
}

/**
 * class for instantiating/managing/settling payment channels to/from a given accountId
 *
 * @class      Payments (name)
 */
export class Payments extends Logger {
  public options: PaymentOptions;

  /**
   * Currently set channel info. May be loaded through [[loadStoredChannel]],
   * [[loadChannelFromBlockchain]], or stored and set manually with [[setChannel]]
   */
  public channel: MicroChannel;

  public channelManager: any;

  public startBlock: any;

  public challenge: any;

  public constructor(options) {
    super(options);
    this.options = options;
    if (options.channelManager) {
      this.channelManager = this.options.contractLoader.loadContract(
        'RaidenMicroTransferChannels',
        options.channelManager,
      );
    }
  }

  /**
   * Close current channel
   *
   * Optional parameter is signed cooperative close from receiver, if available.
   * If cooperative close was successful, channel is already settled after this
   * method is resolved.
   * Else, it enters 'closed' state, and should be settled after settlement
   * period, configured in contract.
   *
   * @param closingSig  Cooperative-close signature from receiver
   * @returns  Promise to closing tx hash
   */
  public async closeChannel(closingSig?: string): Promise<void> {
    if (!this.isChannelValid()) {
      throw new Error('No valid channelInfo');
    }
    const info = await this.getChannelInfo();
    if (info.state !== 'opened') {
      throw new Error('Tried closing already closed channel');
    }

    if (this.channel.closing_sig) {
      // eslint-disable-next-line no-param-reassign
      closingSig = this.channel.closing_sig;
    } else if (closingSig) {
      this.setChannel({

        ...this.channel,
        closing_sig: closingSig, // eslint-disable-line @typescript-eslint/camelcase
      });
    }
    this.log(`Closing channel. Cooperative = ${closingSig}`, 'debug');


    let proof: MicroProof;
    if (closingSig && !this.channel.proof.sig) {
      proof = await this.signNewProof(this.channel.proof);
    } else {
      proof = this.channel.proof;
    }

    if (closingSig) {
      await this.options.executor.executeContractTransaction(
        this.channelManager,
        'cooperativeClose',
        { from: this.channel.account },
        this.channel.receiver,
        this.channel.block,
        this.options.web3.utils.toHex(proof.balance),
        proof.sig,
        closingSig,
      );
    } else {
      await this.options.executor.executeContractTransaction(
        this.channelManager,
        'uncooperativeClose',
        { from: this.channel.account },
        this.channel.receiver,
        this.channel.block,
        this.options.web3.utils.toHex(proof.balance),
      );
    }
  }

  /**
   * Persists next_proof to proof
   *
   * This method must be used after successful payment request,
   * or right after signNewProof is resolved,
   * if implementation don't care for request status
   */
  public confirmPayment(proof: MicroProof): void {
    if (!this.channel.next_proof
      || !this.channel.next_proof.sig
      || this.channel.next_proof.sig !== proof.sig) {
      throw new Error('Invalid provided or stored next signature');
    }
    const channel = {

      ...this.channel,
      proof: this.channel.next_proof,
    };
    delete channel.next_proof;
    this.setChannel(channel);
  }

  /**
   * Get channel details such as current state (one of opened, closed or
   * settled), block in which it was set and current deposited amount
   *
   * @param channel  Channel to get info from. Default to channel
   * @returns Promise to MicroChannelInfo data
   */
  public async getChannelInfo(channel?: MicroChannel): Promise<MicroChannelInfo> {
    if (!channel) {
      // eslint-disable-next-line no-param-reassign
      channel = this.channel;
    }
    if (!this.isChannelValid(channel)) {
      throw new Error('No valid channelInfo');
    }

    const closeEvents = await this.channelManager.getPastEvents('ChannelCloseRequested', {
      filter: {
        _sender_address: channel.account, // eslint-disable-line @typescript-eslint/camelcase
        _receiver_address: channel.receiver, // eslint-disable-line @typescript-eslint/camelcase
        _open_block_number: channel.block, // eslint-disable-line @typescript-eslint/camelcase
      },
      fromBlock: channel.block,
      toBlock: 'latest',
    });

    let closed: number;
    if (!closeEvents || closeEvents.length === 0) {
      closed = 0;
    } else {
      closed = closeEvents[0].blockNumber;
    }

    const settleEvents = await this.channelManager.getPastEvents('ChannelSettled', {
      filter: {
        _sender_address: channel.account, // eslint-disable-line @typescript-eslint/camelcase
        _receiver_address: channel.receiver, // eslint-disable-line @typescript-eslint/camelcase
        _open_block_number: channel.block, // eslint-disable-line @typescript-eslint/camelcase
      },
      fromBlock: closed || channel.block,
      toBlock: 'latest',
    });

    let settled: number;
    if (!settleEvents || settleEvents.length === 0) {
      settled = 0;
    } else {
      settled = settleEvents[0].blockNumber;
    }
    // for settled channel, getChannelInfo call will fail, so we return before
    if (settled) {
      return {
        state: 'settled',
        block: settled,
        deposit: new BigNumber(0),
        withdrawn: new BigNumber(0),
      };
    }

    const info = await this.options.executor.executeContractCall(
      this.channelManager,
      'getChannelInfo',
      channel.account,
      channel.receiver,
      channel.block,
    );

    if (!(new BigNumber(info[1]).gt(0))) {
      throw new Error(`Invalid channel deposit: ${JSON.stringify(info)}`);
    }
    return {
      state: closed ? 'closed' : 'opened',
      block: closed || channel.block,
      deposit: new BigNumber(info[1]),
      withdrawn: new BigNumber(info[4]),
    };
  }

  /**
   * Get contract's configured challenge's period
   *
   * As it calls the contract method, can be used for validating that
   * contract's address has code in current network
   *
   * @returns  Promise to challenge period number, in blocks
   */
  public async getChallengePeriod(): Promise<number> {
    this.challenge = await this.options.executor.executeContractCall(
      this.channelManager,
      'challenge_period',
    );
    if (!(this.challenge > 0)) {
      throw new Error('Invalid challenge');
    }
    return this.challenge;
  }

  /**
   * Ask user for signing a channel balance
   *
   * Notice it's the final balance, not the increment, and that the new
   * balance is set in next_proof, requiring a
   * confirmPayment call to persist it, after successful
   * request.
   * Implementation can choose to call confirmPayment right after this call
   * resolves, assuming request will be successful after payment is signed.
   * Tries to use eth_signTypedData (from EIP712), tries to use personal sign
   * if it fails.
   *
   * @param proof  Balance proof to be signed
   * @returns  Promise to signature
   */
  public async getClosingSig(account: string): Promise<string> {
    if (!this.isChannelValid()) {
      throw new Error('No valid channelInfo');
    }

    const params = this.getClosingProofSignatureParams();
    let sig: string;
    let signAccount = account;
    if (signAccount === this.options.executor.signer.activeIdentity) {
      signAccount = this.options.executor.signer.underlyingAccount;
    }
    const privKey = await this.options.accountStore.getPrivateKey(signAccount);
    try {
      const result = await signTypedDataLegacy(
        Buffer.from(privKey, 'hex'),
        { data: params },
      );

      if (result.error) {
        throw result.error;
      }
      sig = result;
    } catch (err) {
      if (err.message && err.message.includes('User denied')) {
        throw err;
      }
    }
    const recovered = this.options.web3.utils.toChecksumAddress(
      recoverTypedSignatureLegacy({ data: params, sig }),
    );
    this.log(`signTypedData = ${sig} , ${recovered}`, 'debug');
    if (recovered !== signAccount) {
      throw new Error(`Invalid recovered signature: ${recovered} != ${signAccount}. Do your provider support eth_signTypedData?`);
    }

    return sig;
  }

  /**
   * Health check for currently configured channel info
   *
   * @param channel  Channel to test. Default to channel
   * @returns  True if channel is valid, false otherwise
   */
  public isChannelValid(channel?: MicroChannel): boolean {
    if (!channel) {
      // eslint-disable-next-line no-param-reassign
      channel = this.channel;
    }
    if (!channel || !channel.receiver || !channel.block
      || !channel.proof || !channel.account) {
      return false;
    }
    return true;
  }

  /**
   * Ask user for signing a payment, which is previous balance incremented of
   * amount.
   *
   * Warnings from signNewProof applies
   *
   * @param amount  Amount to increment in current balance
   * @returns  Promise to signature
   */
  public async incrementBalanceAndSign(amount: BigNumber|string): Promise<MicroProof> {
    if (!(amount instanceof BigNumber)) {
      // eslint-disable-next-line no-param-reassign
      amount = new BigNumber(amount);
    }
    if (!this.isChannelValid()) {
      throw new Error('No valid channelInfo');
    }
    const proof: MicroProof = { balance: this.channel.proof.balance.plus(amount) };
    // get current deposit
    const info = await this.getChannelInfo();
    if (info.state !== 'opened') {
      throw new Error('Tried signing on closed channel');
    } else if (proof.balance.gt(info.deposit)) {
      const err = new Error(`Insuficient funds: current = ${info.deposit} , required = ${proof.balance}`);
      (err as any).current = info.deposit;
      (err as any).required = proof.balance;
      throw err;
    }
    // get hash for new balance proof
    return this.signNewProof(proof);
  }


  /**
   * Scan the blockchain for an open channel, and load it with 0 balance
   *
   * The 0 balance may be overwritten with setBalance if the server replies with an updated balance on
   * first request. It should ask the user for signing the zero-balance proof. If no open
   * channel was found an error is thrown. Additionally, a starting block can be provided to avoid starting from block 0
   * when looking for payment channels.
   *
   * @param      {string}  account     Sender/client's account address
   * @param      {string}  receiver    Receiver/server's account address
   * @param      {Number}  startBlock  block to start scanning for transactions, defaults to 0
   * @return     {Promise<MicroChannel>}  channel info, if a channel was found
   */
  public async loadChannelFromBlockchain(
    account: string,
    receiver: string,
    startBlock = 0,
  ): Promise<MicroChannel> {
    let channelAccount;
    if (account === this.options.executor.signer.activeIdentity) {
      channelAccount = this.options.executor.signer.underlyingAccount;
    } else {
      channelAccount = account;
    }

    const openEvents = await this.channelManager.getPastEvents('ChannelCreated', {
      filter: {
        _sender_address: channelAccount, // eslint-disable-line @typescript-eslint/camelcase
        _receiver_address: receiver, // eslint-disable-line @typescript-eslint/camelcase
      },
      fromBlock: startBlock,
      toBlock: 'latest',
    });
    if (!openEvents || openEvents.length === 0) {
      throw new Error('No channel found for this account');
    }

    const minBlock = Math.min.apply(null, openEvents.map((ev) => ev.blockNumber));
    const [closeEvents, settleEvents, currentBlock, challenge] = await Promise.all([
      this.channelManager.getPastEvents('ChannelCloseRequested', {
        filter: {
          _sender_address: channelAccount, // eslint-disable-line @typescript-eslint/camelcase
          _receiver_address: receiver, // eslint-disable-line @typescript-eslint/camelcase
        },
        fromBlock: minBlock,
        toBlock: 'latest',
      }),
      this.channelManager.getPastEvents('ChannelSettled', {
        filter: {
          _sender_address: channelAccount, // eslint-disable-line @typescript-eslint/camelcase
          _receiver_address: receiver, // eslint-disable-line @typescript-eslint/camelcase
        },
        fromBlock: minBlock,
        toBlock: 'latest',
      }),
      this.options.web3.eth.getBlockNumber(),
      this.getChallengePeriod(),
    ]);

    const stillOpen = openEvents.filter((ev) => {
      for (const sev of settleEvents) {
        // eslint-disable-next-line
        if (sev.args._open_block_number.eq(ev.blockNumber)) {
          return false;
        }
      }
      for (const cev of closeEvents) {
        // eslint-disable-next-line
        if (cev.args._open_block_number.eq(ev.blockNumber)
            && cev.blockNumber + challenge > currentBlock) {
          return false;
        }
      }
      return true;
    });

    let openChannel: MicroChannel;
    for (const ev of stillOpen) {
      const channel: MicroChannel = {
        account: channelAccount,
        receiver,
        block: ev.blockNumber,
        proof: { balance: new BigNumber(0) },
      };
      try {
        await this.getChannelInfo(channel);
        openChannel = channel;
        break;
      } catch (err) {
        this.log(`Invalid channel ${channel}, ${err}`, 'error');
        // eslint-disable-next-line
        continue;
      }
    }
    if (!openChannel) {
      throw new Error(`No open and valid channels found from ${stillOpen.length}`);
    }
    this.setChannel(openChannel);
    return this.channel;
  }

  /**
   * Open a channel for account to receiver, depositing some eve on it
   *
   * Replaces current channel data
   *
   * @param account  Sender/client's account address
   * @param receiver  Receiver/server's account address
   * @param deposit  Tokens to be initially deposited in the channel (in Wei)
   * @returns  Promise to MicroChannel info object
   */
  public async openChannel(
    account: string,
    receiver: string,
    deposit: BigNumber|string,
  ): Promise<MicroChannel> {
    if (!(deposit instanceof BigNumber)) {
      // eslint-disable-next-line no-param-reassign
      deposit = new BigNumber(deposit);
    }
    if (this.isChannelValid()) {
      this.log(`Already valid channel will be forgotten: ${this.channel}`, 'warning');
    }

    let channelAccount;
    if (account === this.options.executor.signer.activeIdentity) {
      channelAccount = this.options.executor.signer.underlyingAccount;
    } else {
      channelAccount = account;
    }


    // first, check if there's enough balance

    const balance = await this.options.web3.eth.getBalance(channelAccount);
    if (new BigNumber(balance).lt(new BigNumber(deposit))) {
      throw new Error(`Not enough tokens.
        Token balance = ${balance}, required = ${deposit}`);
    }

    // call transfer to make the deposit, automatic support for ERC20/223 token
    const createdBlockNumber = await this.options.executor.executeContractTransaction(
      this.channelManager,
      'createChannel',
      {
        from: channelAccount,
        value: deposit,
        // event ChannelCreated(address _sender_address,
        // address  _receiver_address, uint256 _deposit)
        event: { target: 'RaidenMicroTransferChannels', eventName: 'ChannelCreated' },
        getEventResult: (event) => event.blockNumber,
      },
      receiver,
    );
    // call getChannelInfo to be sure channel was created
    const info = await this.options.executor.executeContractCall(
      this.channelManager,
      'getChannelInfo',
      channelAccount,
      receiver,
      createdBlockNumber,
    );
    if (!(info[1] > 0)) {
      throw new Error('No deposit found!');
    }
    this.setChannel({
      account: channelAccount,
      receiver,
      block: createdBlockNumber,
      proof: { balance: new BigNumber(0) },
    });

    // return channel
    return this.channel;
  }

  /**
   * sets a new channelmanager contract to the current instanct
   *
   * @param      {string}  channelManager  the new channelmanager address
   */
  public setChannelManager(channelManager: string) {
    this.channelManager = this.options.contractLoader.loadContract(
      'RaidenMicroTransferChannels',
      channelManager,
    );
  }

  /**
   * Set [[channel]] info
   *
   * Can be used to externally [re]store an externally persisted channel info
   *
   * @param channel  Channel info to be set
   */
  public setChannel(channel: MicroChannel): void {
    this.channel = channel;
    if (typeof (global as any).localStorage !== 'undefined') {
      const key = [this.channel.account, this.channel.receiver].join('|');
      (global as any).localStorage.setItem(key, JSON.stringify(this.channel));
    }
  }


  /**
   * If channel was not cooperatively closed, and after settlement period,
   * this function settles the channel, distributing the tokens to sender and
   * receiver.
   *
   * @returns  Promise resolved when done
   */
  public async settleChannel(): Promise<void> {
    if (!this.isChannelValid()) {
      throw new Error('No valid channelInfo');
    }
    const [info, currentBlock] = await Promise.all([
      this.getChannelInfo(),
      await this.options.web3.eth.getBlockNumber(),
    ]);
    if (info.state !== 'closed') {
      throw new Error(`Tried settling opened or settled channel: ${info.state}`);
    } else if (this.challenge && currentBlock < info.block + this.challenge) {
      throw new Error(`Tried settling inside challenge period: ${currentBlock} < ${info.block} + ${this.challenge}`);
    }
    await this.options.executor.executeContractTransaction(
      this.channelManager,
      'settle',
      { from: this.channel.account },
      this.channel.receiver,
      this.channel.block,
    );
  }

  /**
   * Ask user for signing a channel balance
   *
   * Notice it's the final balance, not the increment, and that the new
   * balance is set in [[MicroChannel.next_proof]], requiring a
   * [[confirmPayment]] call to persist it, after successful
   * request.
   * Implementation can choose to call confirmPayment right after this call
   * resolves, assuming request will be successful after payment is signed.
   * Tries to use eth_signTypedData (from EIP712), tries to use personal sign
   * if it fails.
   *
   * @param proof  Balance proof to be signed
   * @returns  Promise to signature
   */
  public async signNewProof(proof?: MicroProof): Promise<MicroProof> {
    if (!this.isChannelValid()) {
      throw new Error('No valid channelInfo');
    }
    this.log(`signNewProof, balance: ${proof.balance.toString()}, sig: ${proof.sig}`, 'debug');
    if (!proof) {
      // eslint-disable-next-line no-param-reassign
      proof = this.channel.proof;
    }
    if (proof.sig) {
      return proof;
    }

    const params = this.getBalanceProofSignatureParams(proof);
    let sig: string;

    let channelAccount: string;
    if (this.channel.account === this.options.executor.signer.activeIdentity) {
      channelAccount = this.options.executor.signer.underlyingAccount;
    } else {
      channelAccount = this.channel.account;
    }
    const privKey = await this.options.accountStore.getPrivateKey(channelAccount);
    try {
      const result = await signTypedDataLegacy(
        Buffer.from(privKey, 'hex'),
        { data: params },
      );

      if (result.error) {
        throw result.error;
      }
      sig = result;
    } catch (err) {
      if (err.message && err.message.includes('User denied')) {
        throw err;
      }
      this.log(`Error on signTypedData ${err}`, 'error');
      const hash = typedSignatureHash(params);
      // ask for signing of the hash
      sig = await this.signMessage(hash);
    }
    const recovered = this.options.web3.utils.toChecksumAddress(recoverTypedSignatureLegacy(
      { data: params, sig },
    ));
    this.log(`signTypedData = ${sig}, ${recovered}`, 'debug');
    if (recovered !== channelAccount) {
      throw new Error(`Invalid recovered signature: ${recovered} != ${channelAccount}. `
        + 'Does your provider support eth_signTypedData?');
    }
    // eslint-disable-next-line no-param-reassign
    proof.sig = sig;

    // return signed message
    if (proof.balance.equals(this.channel.proof.balance)) {
      this.setChannel({

        ...this.channel,
        proof,
        next_proof: proof, // eslint-disable-line @typescript-eslint/camelcase
      });
    } else {
      this.setChannel({

        ...this.channel,
        next_proof: proof, // eslint-disable-line @typescript-eslint/camelcase
      });
    }
    return proof;
  }

  /**
   * Ask user for signing a string with (personal|eth)_sign
   *
   * @param msg  Data to be signed
   * @returns Promise to signature
   */
  public async signMessage(msg: string): Promise<string> {
    if (!this.isChannelValid()) {
      throw new Error('No valid channelInfo');
    }
    const hex = msg.startsWith('0x') ? msg : this.options.web3.utils.toHex(msg);
    this.log(`Signing "${msg}" => ${hex}, account: ${this.channel.account}`, 'debug');
    const privKey = await this.options.accountStore.getPrivateKey(this.channel.account);
    const sig = await this.options.web3.eth.accounts.sign(
      hex,
      Buffer.from(`0x${privKey}`, 'hex'),
    );
    return sig;
  }

  /**
   * Top up current channel, by depositing some [more] EVE to it
   *
   * @param      {BigNumber|string}  deposit  amount  to topup channel
   * @return     {Promise<void>}  resolved when done
   */
  public async topUpChannel(deposit: BigNumber|string): Promise<void> {
    if (!(deposit instanceof BigNumber)) {
      // eslint-disable-next-line no-param-reassign
      deposit = new BigNumber(deposit);
    }

    if (!this.isChannelValid()) {
      throw new Error('No valid channelInfo');
    }

    const { account } = this.channel;

    // first, check if there's enough balance
    const balance = new BigNumber(await this.options.web3.eth.getBalance(account));
    if (!(balance.gte(deposit))) {
      throw new Error(`Not enough EVE.
        EVE balance = ${balance}, required = ${deposit}`);
    }

    // automatically support both ERC20 and ERC223 tokens
    // ERC20, approve channel manager contract to handle our tokens, then topUp
    // send 'approve' transaction to token contract
    await this.options.executor.executeContractTransaction(
      this.channelManager,
      'topUp',
      {
        from: account,
        value: deposit,
      },
      this.channel.receiver,
      this.channel.block,
    );
  }

  /**
   * converts a input string to a bigNumber.js object
   *
   * @param      {string}  input  to converted string
   */
  public toBigNumber(input: string) {
    return new BigNumber(input);
  }

  private getClosingProofSignatureParams(): MsgParam[] {
    return [
      {
        type: 'string',
        name: 'message_id',
        value: 'Receiver closing signature',
      },
      {
        type: 'address',
        name: 'sender',
        value: this.channel.account,
      },
      {
        type: 'uint32',
        name: 'block_created',
        value: `${this.channel.block}`,
      },
      {
        type: 'uint256',
        name: 'balance',
        value: this.channel.proof.balance.toString(),
      },
      {
        type: 'address',
        name: 'contract',
        value: this.channelManager.options.address,
      },
    ];
  }

  private getBalanceProofSignatureParams(proof: MicroProof): MsgParam[] {
    return [
      {
        type: 'string',
        name: 'message_id',
        value: 'Sender balance proof signature',
      },
      {
        type: 'address',
        name: 'receiver',
        value: this.channel.receiver,
      },
      {
        type: 'uint32',
        name: 'block_created',
        value: `${this.channel.block}`,
      },
      {
        type: 'uint256',
        name: 'balance',
        value: proof.balance.toString(),
      },
      {
        type: 'address',
        name: 'contract',
        value: this.channelManager.options.address,
      },
    ];
  }
}
