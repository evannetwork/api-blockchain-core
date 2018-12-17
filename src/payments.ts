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
  ContractLoader,
  Logger,
  LoggerOptions,
} from '@evan.network/dbcp';

import * as BigNumber from 'bignumber.js';

/**
 * parameters for Onboarding constructor
 */
export interface PaymentOptions extends LoggerOptions {
  executor: any,
  contractLoader: ContractLoader,
  web3: any,
}

/**
 * Paymentchannel proof data type
 */
export interface MicroProof {
  /**
   * Balance value, shifted by token decimals
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
   * Next balance proof, persisted with [[MicroRaiden.confirmPayment]]
   */
  next_proof?: MicroProof;
  /**
   * Cooperative close signature from receiver
   */
  closing_sig?: string;
}


/**
 * class for instantiating/managing/settling payment channels to/from a given accountId
 *
 * @class      Mailbox (name)
 */
export class Payments extends Logger {
  options: PaymentOptions;
  /**
   * Currently set channel info. May be loaded through [[loadStoredChannel]],
   * [[loadChannelFromBlockchain]], or stored and set manually with [[setChannel]]
   */
  channel: MicroChannel;
  channelManager: any;


  constructor(options) {
    super(options);
    this.options = options;
    if(options.channelManager) {
      this.channelManager = this.options.contractLoader.loadContract(
        'RaidenMicroTransferChannels',
        options.channelManager
      );
    }
  }

  /**
   * Open a channel for account to receiver, depositing some tokens on it
   *
   * Should work with both ERC20/ERC223 tokens.
   * Replaces current [[channel]] data
   *
   * @param account  Sender/client's account address
   * @param receiver  Receiver/server's account address
   * @param deposit  Tokens to be initially deposited in the channel
   * @returns  Promise to [[MicroChannel]] info object
   */
  async openChannel(account: string, receiver: string, deposit: BigNumber): Promise<MicroChannel> {
    if (this.isChannelValid()) {
      console.warn('Already valid channel will be forgotten:', this.channel);
    }

    // first, check if there's enough balance

    const balance = await this.options.web3.eth.getBalance(account);
    if (!(balance >= deposit)) {
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
        //event ChannelCreated(address _sender_address, address  _receiver_address, uint256 _deposit)
        event: { target: 'RaidenMicroTransferChannels', eventName: 'ChannelCreated' },
        getEventResult: (event, args) => event.blockNumber,
      },
      receiver
    );
    console.dir(createdBlockNumber);
    console.log('transferTxHash', transferTxHash);
    debugger;
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
      proof: { balance: new BigNumber(deposit) },
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
   * Health check for currently configured channel info
   *
   * @param channel  Channel to test. Default to [[channel]]
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
}