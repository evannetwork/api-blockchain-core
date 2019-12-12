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

var fs = require('fs');
var path = require('path');


// check if raw mode is enabled, do not check message if it is on
if (process.env.EVAN_COMMIT_RAW) {
  let rawCommit = false;
  try {
    rawCommit = JSON.parse(process.env.EVAN_COMMIT_RAW);
  } catch (_) {
    // thread parsing erros as false
  }
  if (rawCommit) {
    return true;
  }
}

const commitMessage = fs.readFileSync(path.join(__dirname, '../.git/COMMIT_EDITMSG'), 'utf8');
const trimmed = commitMessage.replace(/#.*\n+/g, '').replace(/^\s*\n/gm, '');

// accept simple merge messages
if (trimmed.toLowerCase() === 'merge') {
  return true;
}

// check env for pattern or use default
console.log(process.env.EVAN_COMMIT_PATTERN)
let messagePattern = process.env.EVAN_COMMIT_PATTERN ||
  // '(?:add|fix|remove|update|refactor|document|merge)\\s.+[\\r\\n]+- \\[CORE-\\d+\\]';
  '(?:add|fix|remove|update|refactor|document|merge)\\s.+';
let messageRegEx = new RegExp(messagePattern, 'i');

// check trimmed commit message with pattern
if (!messageRegEx.test(trimmed)) {
  throw new Error([
    'commit Message',
    commitMessage,
    'does not match commit message pattern',
    messageRegEx.toString(),
  ].join('\n'));
}
