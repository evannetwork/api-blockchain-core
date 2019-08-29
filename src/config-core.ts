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

const configCore = {
  nameResolver: {
    ensAddress: process.env.ENS_ADDRESS || '0xc913ac6522344187bc9C88C9f9302b005500FfF9',
    ensResolver: process.env.ENS_RESOLVER || '0xa4cfA55769dc770F33402e3d669dc96c0e46c6c4',
    labels: {
      admin: 'admin',
      businessCenterRoot: process.env.BC_ROOT || 'testbc.evan',
      container: 'container',
      ensRoot: process.env.ENS_ROOT || 'evan',
      eventhub: 'eventhub',
      factory: 'factory',
      index: 'index',
      mailbox: 'mailbox',
      profile: 'profile',
      wallet: 'wallet',
    },
    domains: {
      adminFactory: ['admin', 'factory', 'ensRoot'],
      businessCenter: ['businessCenterRoot'],
      containerFactory: ['container', 'factory', 'ensRoot'],
      eventhub: process.env.ENS_EVENTS || ['eventhub', 'ensRoot'],
      factory: ['factory', 'businessCenterRoot'],
      indexFactory: ['index', 'factory', 'ensRoot'],
      mailbox: process.env.ENS_MAILBOX || ['mailbox', 'ensRoot'],
      profile: process.env.ENS_PROFILES || ['profile', 'ensRoot'],
      profileFactory: ['profile', 'factory', 'ensRoot'],
      root: ['ensRoot'],
    },
  },
  smartAgents: {
    onboarding: {
      accountId: '0x063fB42cCe4CA5448D69b4418cb89E663E71A139',
    },
  },
  alwaysAutoGasLimit: 10,
  // owner of the evan root verification domain
  ensRootOwner: '0xBa5384267A175542CB0E98a37875C106decDc3C3',
  ipfsConfig: {host: 'ipfs.evan.network', port: '443', protocol: 'https'},
}

export { configCore }
