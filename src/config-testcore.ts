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

const configTestcore = {
  nameResolver: {
    ensAddress: process.env.ENS_ADDRESS || '0x937bbC1d3874961CA38726E9cD07317ba81eD2e1',
    ensResolver: process.env.ENS_RESOLVER || '0xDC18774FA2E472D26aB91deCC4CDd20D9E82047e',
    labels: {
      admin: 'admin',
      businessCenterRoot: process.env.BC_ROOT || 'testbc.evan',
      container: 'container',
      dids: 'dids',
      ensRoot: process.env.ENS_ROOT || 'evan',
      eventhub: 'eventhub',
      factory: 'factory',
      index: 'index',
      mailbox: 'mailbox',
      profile: 'profile',
      vcs: 'vcs',
      wallet: 'wallet',
    },
    domains: {
      adminFactory: ['admin', 'factory', 'ensRoot'],
      businessCenter: ['businessCenterRoot'],
      containerFactory: ['container', 'factory', 'ensRoot'],
      didRegistry: ['dids', 'ensRoot'],
      eventhub: process.env.ENS_EVENTS || ['eventhub', 'ensRoot'],
      factory: ['factory', 'businessCenterRoot'],
      indexFactory: ['index', 'factory', 'ensRoot'],
      mailbox: process.env.ENS_MAILBOX || ['mailbox', 'ensRoot'],
      profile: process.env.ENS_PROFILES || ['profile', 'ensRoot'],
      profileFactory: ['profile', 'factory', 'ensRoot'],
      root: ['ensRoot'],
      vcRegistry: ['vcs', 'ensRoot'],
    },
  },
  smartAgents: {
    onboarding: {
      accountId: '0x063fB42cCe4CA5448D69b4418cb89E663E71A139',
    },
  },
  alwaysAutoGasLimit: 10,
  // owner of the evan root verification domain
  ensRootOwner: '0x4a6723fC5a926FA150bAeAf04bfD673B056Ba83D',
  ipfsConfig: {host: 'ipfs.test.evan.network', port: '443', protocol: 'https'},
}

export { configTestcore }
