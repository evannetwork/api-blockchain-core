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

  You can be released from the requirements of the GNU Affero General Public
  License by purchasing a commercial license.
  Buying such a license is mandatory as soon as you use this software or parts
  of it on other blockchains than evan.network.

  For more information, please contact evan GmbH at this address:
  https://evan.network/license/
*/


import {
  AccountStore,
  ContractLoader,
  Logger,
  LoggerOptions,
} from '@evan.network/dbcp';

import * as BigNumber from 'bignumber.js';
import { typedSignatureHash, signTypedDataLegacy, recoverTypedSignatureLegacy } from 'eth-sig-util';

/**
 * parameters for Payments constructor
 */
export interface PaymentOptions extends LoggerOptions {
  executor: any,
  accountStore: AccountStore,
  contractLoader: ContractLoader,
  web3: any,
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
  options: PaymentOptions;
  /**
   * Currently set channel info. May be loaded through [[loadStoredChannel]],
   * [[loadChannelFromBlockchain]], or stored and set manually with [[setChannel]]
   */
  channel: MicroChannel;
  channelManager: any;
  startBlock: any;
  challenge: any;

  constructor(options) {
    super(options);
    this.options = options;
    this.startBlock = 0;
    if (options.channelManager) {
      this.channelManager = this.options.contractLoader.loadContract(
        'RaidenMicroTransferChannels',
        options.channelManager
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
  async closeChannel(closingSig?: string): Promise<void> {
    if (!this.isChannelValid()) {
      throw new Error('No valid channelInfo');
    }
    const info = await this.getChannelInfo();
    if (info.state !== 'opened') {
      throw new Error('Tried closing already closed channel');
    }

    if (this.channel.closing_sig) {
      closingSig = this.channel.closing_sig;
    } else if (closingSig) {
      this.setChannel(Object.assign(
        {},
        this.channel,
        { closing_sig: closingSig },
      ));
    }
    this.log(`Closing channel. Cooperative = ${closingSig}`, 'debug');


    let proof: MicroProof;
    if (closingSig && !this.channel.proof.sig) {
      proof = await this.signNewProof(this.channel.proof);
    } else {
      proof = this.channel.proof;
    }

    closingSig ?
      await this.options.executor.executeContractTransaction(
        this.channelManager,
        'cooperativeClose',
        { from: this.channel.account },
        this.channel.receiver,
        this.channel.block,
        this.options.web3.utils.toHex(proof.balance),
        proof.sig,
        closingSig,
      ) :
      await this.options.executor.executeContractTransaction(
        this.channelManager,
        'uncooperativeClose',
        { from: this.channel.account },
        this.channel.receiver,
        this.channel.block,
        this.options.web3.utils.toHex(proof.balance),
      );
  }

  /**
   * Persists next_proof to proof
   *
   * This method must be used after successful payment request,
   * or right after signNewProof is resolved,
   * if implementation don't care for request status
   */
  confirmPayment(proof: MicroProof): void {
    if (!this.channel.next_proof
      || !this.channel.next_proof.sig
      || this.channel.next_proof.sig !== proof.sig) {
      throw new Error('Invalid provided or stored next signature');
    }
    const channel = Object.assign(
      {},
      this.channel,
      { proof: this.channel.next_proof },
    );
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
  async getChannelInfo(channel?: MicroChannel): Promise<MicroChannelInfo> {
    if (!channel) {
      channel = this.channel;
    }
    if (!this.isChannelValid(channel)) {
      throw new Error('No valid channelInfo');
    }

    const closeEvents = await this.channelManager.getPastEvents('ChannelCloseRequested', {
      filter: {
        _sender_address: channel.account,
        _receiver_address: channel.receiver,
        _open_block_number: channel.block,
      },
      fromBlock: channel.block,
      toBlock: 'latest'
    });

    let closed: number;
    if (!closeEvents || closeEvents.length === 0) {
      closed = 0;
    } else {
      closed = closeEvents[0].blockNumber;
    }

    const settleEvents = await this.channelManager.getPastEvents('ChannelSettled', {
      filter: {
        _sender_address: channel.account,
        _receiver_address: channel.receiver,
        _open_block_number: channel.block,
      },
      fromBlock: closed || channel.block,
      toBlock: 'latest'
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
        'state': 'settled',
        'block': settled,
        'deposit': new BigNumber(0),
        'withdrawn': new BigNumber(0),
      };
    }

    const info = await this.options.executor.executeContractCall(
      this.channelManager,
      'getChannelInfo',
      channel.account,
      channel.receiver,
      channel.block
    );

    if (!(new BigNumber(info[1]).gt(0))) {
      throw new Error('Invalid channel deposit: ' + JSON.stringify(info));
    }
    return {
      'state': closed ? 'closed' : 'opened',
      'block': closed || channel.block,
      'deposit': new BigNumber(info[1]),
      'withdrawn': new BigNumber(info[4]),
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
  async getChallengePeriod(): Promise<number> {
    this.challenge = await this.options.executor.executeContractCall(
      this.channelManager,
      'challenge_period'
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
  async getClosingSig(account: string): Promise<string> {
    if (!this.isChannelValid()) {
      throw new Error('No valid channelInfo');
    }

    const params = this.getClosingProofSignatureParams();
    let sig: string;
    const privKey = await this.options.accountStore.getPrivateKey(account);
    try {
      const result = await signTypedDataLegacy(
        Buffer.from(privKey, 'hex'),
        { data: params }
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
    const recovered = this.options.web3.utils.toChecksumAddress(recoverTypedSignatureLegacy({ data: params, sig }));
    this.log(`signTypedData = ${sig} , ${recovered}`, 'debug');
    if (recovered !== account) {
      throw new Error(`Invalid recovered signature: ${recovered} != ${account}. Do your provider support eth_signTypedData?`);
    }

    return sig;
  }

  /**
   * Health check for currently configured channel info
   *
   * @param channel  Channel to test. Default to channel
   * @returns  True if channel is valid, false otherwise
   */
  isChannelValid(channel?: MicroChannel): boolean {
    if (!channel) {
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
  async incrementBalanceAndSign(amount: BigNumber): Promise<MicroProof> {
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
      err['current'] = info.deposit;
      err['required'] = proof.balance;
      throw err;
    }
    // get hash for new balance proof
    return await this.signNewProof(proof);
  }


  /**
   * Scan the blockchain for an open channel, and load it with 0 balance
   *
   * The 0 balance may be overwritten with setBalance if
   * server replies with a updated balance on first request.
   * It should ask user for signing the zero-balance proof
   * Throws/reject if no open channel was found
   *
   * @param account  Sender/client's account address
   * @param receiver  Receiver/server's account address
   * @returns  Promise to channel info, if a channel was found
   */
  async loadChannelFromBlockchain(account: string, receiver: string): Promise<MicroChannel> {
    const openEvents = await this.channelManager.getPastEvents('ChannelCreated', {
      filter: {
        _sender_address: account,
        _receiver_address: receiver,
      },
      fromBlock: this.startBlock,
      toBlock: 'latest'
    });
    if (!openEvents || openEvents.length === 0) {
      throw new Error('No channel found for this account');
    }

    const minBlock = Math.min.apply(null, openEvents.map((ev) => ev.blockNumber));
    const [ closeEvents, settleEvents, currentBlock, challenge ] = await Promise.all([
      this.channelManager.getPastEvents('ChannelCloseRequested', {
        filter: {
          _sender_address: account,
          _receiver_address: receiver,
        },
        fromBlock: minBlock,
        toBlock: 'latest'
      }),
      this.channelManager.getPastEvents('ChannelSettled', {
        filter: {
          _sender_address: account,
          _receiver_address: receiver,
        },
        fromBlock: minBlock,
        toBlock: 'latest'
      }),
      this.options.web3.eth.getBlockNumber(),
      this.getChallengePeriod(),
    ]);

    const stillOpen = openEvents.filter((ev) => {
      for (let sev of settleEvents) {
        if (sev.args._open_block_number.eq(ev.blockNumber)) {
          return false;
        }
      }
      for (let cev of closeEvents) {
        if (cev.args._open_block_number.eq(ev.blockNumber) &&
            cev.blockNumber + challenge > currentBlock) {}
          return false;
      }
      return true;
    });

    let openChannel: MicroChannel;
    for (let ev of stillOpen) {
      let channel: MicroChannel = {
        account,
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
        continue;
      }
    }
    if (!openChannel) {
      throw new Error('No open and valid channels found from ' + stillOpen.length);
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
   * @param deposit  Tokens to be initially deposited in the channel
   * @returns  Promise to MicroChannel info object
   */
  async openChannel(account: string, receiver: string, deposit: BigNumber): Promise<MicroChannel> {
    if (this.isChannelValid()) {
      this.log(`Already valid channel will be forgotten: ${this.channel}`, 'warning');
    }

    // first, check if there's enough balance

    const balance = await this.options.web3.eth.getBalance(account);
    if (new BigNumber(balance).lt(new BigNumber(deposit))) {
      throw new Error(`Not enough tokens.
        Token balance = ${balance}, required = ${deposit}`);
    }

    // call transfer to make the deposit, automatic support for ERC20/223 token
    let transferTxHash: string;
    const createdBlockNumber = await this.options.executor.executeContractTransaction(
      this.channelManager,
      'createChannel',
      {
        from: account,
        value: deposit,
        // event ChannelCreated(address _sender_address, address  _receiver_address, uint256 _deposit)
        event: { target: 'RaidenMicroTransferChannels', eventName: 'ChannelCreated' },
        getEventResult: (event, args) => event.blockNumber,
      },
      receiver
    );
    // call getChannelInfo to be sure channel was created
    const info = await this.options.executor.executeContractCall(
      this.channelManager,
      'getChannelInfo',
      account,
      receiver,
      createdBlockNumber
    );
    if (!(info[1] > 0)) {
      throw new Error('No deposit found!');
    }
    this.setChannel({
      account,
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
  setChannelManager(channelManager: string) {
    this.channelManager = this.options.contractLoader.loadContract(
      'RaidenMicroTransferChannels',
      channelManager
    );
  }

  /**
   * Set [[channel]] info
   *
   * Can be used to externally [re]store an externally persisted channel info
   *
   * @param channel  Channel info to be set
   */
  setChannel(channel: MicroChannel): void {
    this.channel = channel;
    if (typeof (<any>global).localStorage !== 'undefined') {
      const key = [this.channel.account, this.channel.receiver].join('|');
      (<any>global).localStorage.setItem(key, JSON.stringify(this.channel));
    }
  }


  /**
   * If channel was not cooperatively closed, and after settlement period,
   * this function settles the channel, distributing the tokens to sender and
   * receiver.
   *
   * @returns  Promise resolved when done
   */
  async settleChannel(): Promise<void> {
    if (!this.isChannelValid()) {
      throw new Error('No valid channelInfo');
    }
    const [ info, currentBlock ] = await Promise.all([
      this.getChannelInfo(),
      await this.options.web3.eth.getBlockNumber()
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
  async signNewProof(proof?: MicroProof): Promise<MicroProof> {
    if (!this.isChannelValid()) {
      throw new Error('No valid channelInfo');
    }
    this.log(`signNewProof ${proof}`, 'debug');
    if (!proof) {
      proof = this.channel.proof;
    }
    if (proof.sig) {
      return proof;
    }

    const params = this.getBalanceProofSignatureParams(proof);
    let sig: string;
    const privKey = await this.options.accountStore.getPrivateKey(this.channel.account)
    try {
      const result = await signTypedDataLegacy(
        Buffer.from(privKey, 'hex'),
        { data: params }
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
    const recovered = this.options.web3.utils.toChecksumAddress(recoverTypedSignatureLegacy({ data: params, sig }));
    this.log(`signTypedData = ${sig}, ${recovered}`, 'debug');
    if (recovered !== this.channel.account) {
      throw new Error(`Invalid recovered signature: ${recovered} != ${this.channel.account}. Do your provider support eth_signTypedData?`);
    }

    proof.sig = sig;

    // return signed message
    if (proof.balance.equals(this.channel.proof.balance)) {
      this.setChannel(Object.assign(
        {},
        this.channel,
        { proof, next_proof: proof }
      ));
    } else {
      this.setChannel(Object.assign(
        {},
        this.channel,
        { next_proof: proof }
      ));
    }
    return proof;
  }

  /**
   * Ask user for signing a string with (personal|eth)_sign
   *
   * @param msg  Data to be signed
   * @returns Promise to signature
   */
  async signMessage(msg: string): Promise<string> {
    if (!this.isChannelValid()) {
      throw new Error('No valid channelInfo');
    }
    const hex = msg.startsWith('0x') ? msg : this.options.web3.utils.toHex(msg);
    this.log(`Signing "${msg}" => ${hex}, account: ${this.channel.account}`, 'debug');
    const privKey = await this.options.accountStore.getPrivateKey(this.channel.account)
    let sig = await this.options.web3.eth.accounts.sign(
      hex,
      Buffer.from('0x' + privKey, 'hex')
    );
    return sig;
  }


   /**
   * Top up current channel, by depositing some [more] tokens to it
   *
   * Should work with both ERC20/ERC223 tokens
   *
   * @param deposit  Tokens to be deposited in the channel
   * @returns  Promise to tx hash
   */
  async topUpChannel(deposit: BigNumber): Promise<void> {
    if (!this.isChannelValid()) {
      throw new Error('No valid channelInfo');
    }

    const account = this.channel.account;

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
        value: '' + this.channel.block,
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
        value: '' + this.channel.block,
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
