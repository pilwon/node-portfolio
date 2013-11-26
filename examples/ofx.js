/*
 * examples/ofx.js
 */

'use strict';

var fs = require('fs'),
    path = require('path'),
    util = require('util');

var _ = require('lodash'),
    portfolio = require('..');

function usage() {
  console.error(
    'Usage: node %s %s',
    path.basename(process.argv[1]),
    '<ofxPath>'
  );
  process.exit(1);
}

if (_.isEmpty(process.argv[2])) { usage(); }

var OFX_PATH = process.argv[2];

fs.readFile(OFX_PATH, function (err, data) {
  var ofx = data.toString();
  portfolio.ofx.parse(ofx, function (err, result) {
    if (err) { throw err; }
    console.log('=== ofx -> js ===');
    console.log(util.inspect(result, { colors: true, depth: null }));

    portfolio.ofx.format(result, function (err, ofx) {
      if (err) { throw err; }
      console.log('=== js -> ofx ===');
      console.log(ofx);

      portfolio.ofx.parse(ofx, function (err, result) {
        if (err) { throw err; }
        console.log('=== js -> ofx -> js ===');
        console.log(util.inspect(result, { colors: true, depth: null }));
      });
    });
  });
});
