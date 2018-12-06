/*
  Copyright (c) 2018-present evan GmbH.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
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
