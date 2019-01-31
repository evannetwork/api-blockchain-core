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

const fs = require('fs');
const browserify = require('browserify');
const disc = require('disc');
const gulp = require('gulp');
const open = require('gulp-open');
const os = require('os');
const path = require('path');
const sourcemaps = require('gulp-sourcemaps');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');

const bundles = require('./bundles.js');

const checkFolder = function(folder) {
  try {
    fs.mkdirSync(folder);
  } catch (err) { }
};

const parseEnsName = function(ens) {
  return ens.replace(/-/g, '');
};

const browserifyFile = function(bundleName) {
  const srcFolder = `../src/bundles/${bundleName}`;
  const distFolder = `../dist/bundles/${bundleName}`;
  const bundleFolder = `../bundles/${parseEnsName(bundleName)}`;

  checkFolder(bundleFolder);

  return new Promise(function(resolve, reject) {
    const ethjsUtils = require('../node_modules/ethjs-util/package.json');

    return browserify(`${distFolder}/${bundleName}.js`, { 
        standalone: bundleName,
        debug: true,
        fullPaths: true,
        ignore: '../core/core'
      })
      .exclude('bcc-core')
      .exclude('bcc-profile')
      .exclude('bcc-bc')
      .transform("babelify", {
        // compact everything
        compact: true,
        // remove comments
        comments: false,
        //parse all sub node_modules es5 to es6 
        global: true,
        // important! 
        ignore: [
          // underscore gets broken when we try to parse it
          /underscore/

          // remove core-js and babel runtime,
          // https://github.com/babel/babel/issues/8731#issuecomment-426522500
          /[\/\\]core-js/,
          /@babel[\/\\]runtime/,
        ],
        presets: [
          '@babel/env',
        ],
        plugins: [
          '@babel/plugin-transform-runtime'
        ],
    })
      .bundle()
      .pipe(disc())
      .pipe(fs.createWriteStream(`../discify/${bundleName}.html`))
  });
}
gulp.task('discify-bundles', function(callback) {
  checkFolder('../discify');
  
  Promise
    .all(
      bundles.map(bundleName => browserifyFile(bundleName))
    )
    .then(() => callback());
});

gulp.task('open-discify-bundle', [ 'discify-bundles' ], function() {
  var browser = os.platform() === 'linux' ? 'google-chrome' : (
    os.platform() === 'darwin' ? 'google chrome' : (
    os.platform() === 'win32' ? 'chrome' : 'firefox'));

  return bundles.map(bundleName => 
    gulp
      .src(`../discify/${bundleName}.html`)
      .pipe(open({app: browser}))
  )
});

gulp.task('default', [
  'discify-bundles', 
  'open-discify-bundle'
]);