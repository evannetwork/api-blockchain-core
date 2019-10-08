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
  DfsCacheInterface
} from '@evan.network/dbcp';

/**
 * in-memory cache for DFS requests,
 * that allows to keep retrieved items once and skip external requests in DFS
 *
 * @class      InMemoryCache (name)
 */
export class InMemoryCache implements DfsCacheInterface {
  private cache;

  constructor() {
    this.cache = {};
  }

  /**
   * add a file to the cache
   *
   * @param      {string}           hash    filename
   * @param      {Buffer}           data    file content as Buffer
   * @return     {Promise<string>}  reference to the file in the DFS, format may differ depending on
   *                                the type of DFS
   */
  async add(hash: string, data: any): Promise<void> {
    this.cache[hash] = data;
  }

  /**
   * get a file from the dfs
   *
   * @param      {string}           hash    reference to the file in the DFS, format may differ
   *                                        depending on the type of DFS
   * @return     {Promise<Buffer>}  file content as buffer
   */
  async get(hash: string): Promise<Buffer> {
    return this.cache[hash];
  }
}
