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
const gulp = require('gulp');
const path = require('path');
const sourcemaps = require('gulp-sourcemaps');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const commonShake = require('common-shakeify');
const gulpReplace = require('gulp-replace');
const bundles = require('./bundles.js');

const checkFolder = function(folder) {
  try {
    fs.mkdirSync(folder);
  } catch (err) { }
};

const parseEnsName = function(ens) {
  return ens.replace(/-/g, '');
};

const browserifyFile = async function(bundleName) {
  const srcFolder = `../src/bundles/${bundleName}`;
  const distFolder = `../dist/bundles/${bundleName}`;
  const bundleFolder = `../bundles/${parseEnsName(bundleName)}`;

  checkFolder(bundleFolder);
  const ethjsUtils = require('../node_modules/ethjs-util/package.json');

  await new Promise((resolve, reject) =>
    browserify(`../dist/bundles/bcc/bcc.js`, {
      standalone: 'bcc',
      debug: true,
    })
    .exclude('bcc')
    .transform("babelify", {
      //parse all sub node_modules es5 to es6 
      global: true,
  
      //important! 
      //  underscore gets broken when we try to parse it
      ignore: /underscore/,
  
      //use babel to transform es6 to es5 babel to transform es6 to es5
      presets: [
        "babel-preset-es2015",
        "babel-preset-stage-0",
        "babel-preset-env"
      ].map(require.resolve),

      plugins: [
        "babel-plugin-transform-es2015-template-literals",
        "babel-plugin-transform-es2015-literals",
        "babel-plugin-transform-es2015-function-name",
        "babel-plugin-transform-es2015-arrow-functions",
        "babel-plugin-transform-es2015-block-scoped-functions",
        "babel-plugin-transform-es2015-classes",
        "babel-plugin-transform-es2015-object-super",
        "babel-plugin-transform-es2015-shorthand-properties",
        "babel-plugin-transform-es2015-computed-properties",
        "babel-plugin-transform-es2015-for-of",
        "babel-plugin-transform-es2015-sticky-regex",
        "babel-plugin-transform-es2015-unicode-regex",
        "babel-plugin-check-es2015-constants",
        "babel-plugin-transform-es2015-spread",
        "babel-plugin-transform-es2015-parameters",
        "babel-plugin-transform-es2015-destructuring",
        "babel-plugin-transform-es2015-block-scoping",
        "babel-plugin-transform-object-rest-spread",
        "babel-plugin-transform-es3-member-expression-literals",
        "babel-plugin-transform-es3-property-literals",
        "babel-plugin-remove-comments"
      ].map(require.resolve)
    })
    .plugin(commonShake, { /* options */ })
    .bundle()
    .pipe(source(`bcc.js`))
    .pipe(buffer())
    .pipe(sourcemaps.init({loadMaps: true}))
    .pipe(sourcemaps.write('./', {
      sourceMappingURL: function(file) {
        return 'http://localhost:3000/external/dbcpread/' + file.relative + '.map';
      }
    }))
    .pipe(gulp.dest(`${bundleFolder}`))
    .on('end', () => {
      const dbcpPath = path.resolve(`${srcFolder}/dbcp.json`);

      gulp.src([ dbcpPath ]).pipe(gulp.dest(bundleFolder));
      gulp.src([ `../dist/config.js` ]).pipe(gulp.dest(bundleFolder));

      const dbcp = {
        dbcpPath: `${dbcpPath}`
      };
      fs.writeFileSync(
        `${bundleFolder}/dbcpPath.json`,
        JSON.stringify(dbcp)
      );
      resolve();
    })
  )
  
  await new Promise((resolve, reject) => gulp
    .src(`${bundleFolder}/${bundleName}.js`)
    .pipe(gulpReplace('if (global._babelPolyfill) {', 'if (false) {'))
    .pipe(gulpReplace('bitcore.versionGuard(global._bitcore)', 'bitcore.versionGuard()'))
    .pipe(gulpReplace('/* common-shake removed: exports.createDecipher = */ void createDecipher', 'exports.createDecipher = createDecipher'))
    .pipe(gulpReplace('/* common-shake removed: exports.createDecipheriv = */ void createDecipheriv', 'exports.createDecipheriv = createDecipheriv'))
    .pipe(gulpReplace('/* common-shake removed: exports.createCipheriv = */ void createCipheriv', 'exports.createCipheriv = createCipheriv'))
    .pipe(gulpReplace('/* common-shake removed: exports.createCipher = */ void createCipher', 'exports.createCipher = createCipher'))
    .pipe(gulpReplace('exports.randomBytes = /* common-shake removed: exports.rng = */ void 0, /* common-shake removed: exports.pseudoRandomBytes = */ void 0, /* common-shake removed: exports.prng = */ require(\'randombytes\');', 'exports.randomBytes = require(\'randombytes\');'))
    .pipe(gulpReplace('require("babel-polyfill");', ''))
    .pipe(gulpReplace('var createBC = function () {', 'require("babel-polyfill");\nvar createBC = function () {'))
    .pipe(gulp.dest(`${bundleFolder}`))
    .on('end', () => resolve())
  )
}

gulp.task('build-bundles', function(callback) {
  checkFolder('../bundles');
  browserifyFile('bcc')
      .then(() => callback());

});

gulp.task('default', ['build-bundles']);