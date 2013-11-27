/*
 * examples/ofx.js
 */

'use strict';

var fs = require('fs'),
    path = require('path'),
    util = require('util');

require('colors');

var _ = require('lodash'),
    portfolio = require('..');

function usage() {
  console.error(
    'Usage: node %s %s',
    path.basename(process.argv[1]),
    '<ofxPath> [<outFilePath>]'
  );
  process.exit(1);
}

if (_.isEmpty(process.argv[2])) { usage(); }

var OFX_PATH = process.argv[2],
    OUT_FILE_PATH = process.argv[3];

fs.readFile(OFX_PATH, function (err, data) {
  var ofx = data.toString();
  portfolio.ofx.parse(ofx, function (err, result) {
    if (err) { throw err; }
    // console.log('=== ofx -> js ==='.cyan);
    // console.log(util.inspect(result, { colors: true, depth: null }));

    portfolio.ofx.format(result, function (err, ofx) {
      if (err) { throw err; }
      // console.log('=== js -> ofx ==='.cyan);
      // console.log(ofx);

      if (OUT_FILE_PATH) {
        fs.writeFile(OUT_FILE_PATH, ofx, function (err) {
          if (err) { return console.error(err); }
          console.log(util.format('*** Saved: %s ***', OUT_FILE_PATH).cyan);
        });
      }

      portfolio.ofx.parse(ofx, function (err, result) {
        if (err) { throw err; }
        console.log('=== js -> ofx -> js ==='.cyan);
        console.log(util.inspect(result, { colors: true, depth: null }));
      });
    });
  });
});
