/*
 * lib/ofx.js
 */

'use strict';

var assert = require('assert');

var _ = require('lodash'),
    xml2js = require('xml2js');

var _xmlBuilder = new xml2js.Builder({
  rootName: 'OFX'
});

var _xmlParser = new xml2js.Parser({
  explicitRoot: false,
  strict: false
});

function _formatFI(ofx, fi) {
  if (!_.isPlainObject(fi)) { return; }

  ofx.SIGNONMSGSRSV1 = {
    SONRS: {}
  };
  ofx.SIGNONMSGSRSV1.SONRS.FI = {
    FID: fi.id,
    ORG: fi.name
  };
}

function _formatSecurities(ofx, securities) {
  if (!_.isArray(securities)) { return; }

  var stockInfo = [];

  _.each(securities, function (security) {
    stockInfo.push({
      SECINFO: {
        SECID: {
          UNIQUEID: security.id,
          UNIQUEIDTYPE: security.idType
        },
        FIID: security.fiid,
        SECNAME: security.name,
        TICKER: security.ticker
      }
    });
  });

  ofx.SECLISTMSGSRSV1 = {
    SECLIST: {
      STOCKINFO: stockInfo
    }
  };
}

function _formatTransactions(ofx, transactions) {
  if (!_.isArray(transactions)) { return; }

  var invTranList = [];

  _.each(transactions, function (transaction) {
    switch (transaction.type) {
    case 'BUY':
      invTranList.push({
        BUYSTOCK: {
          BUYTYPE: transaction.type,
          INVBUY: {
            INVTRAN: {
              DTTRADE: transaction.date,
              FITID: transaction.id
            },
            SECID: {
              UNIQUEID: transaction.secId,
              UNIQUEIDTYPE: transaction.secIdType
            },
            UNITS: transaction.units,
            UNITPRICE: transaction.unitPrice,
            COMMISSION: transaction.commission,
            TOTAL: transaction.total,
            CURRENCY: {
              CURSYM: transaction.currency,
              CURRATE: transaction.currencyRate
            }
          }
        }
      });
      break;
    case 'SELL':
      invTranList.push({
        SELLSTOCK: {
          SELLTYPE: transaction.type,
          INVSELL: {
            INVTRAN: {
              DTTRADE: transaction.date,
              FITID: transaction.id
            },
            SECID: {
              UNIQUEID: transaction.secId,
              UNIQUEIDTYPE: transaction.secIdType
            },
            UNITS: transaction.units,
            UNITPRICE: transaction.unitPrice,
            COMMISSION: transaction.commission,
            TOTAL: transaction.total,
            CURRENCY: {
              CURSYM: transaction.currency,
              CURRATE: transaction.currencyRate
            }
          }
        }
      });
      break;
    default:
      break;
    }
  });

  ofx.INVSTMTMSGSRSV1 = {
    INVSTMTTRNRS: {
      INVSTMTRS: {
        INVTRANLIST: invTranList
      }
    }
  };
}

function _parseFI(ofx) {
  if (_.isPlainObject(ofx) &&
      _.isArray(ofx.SIGNONMSGSRSV1) &&
      _.isPlainObject(ofx.SIGNONMSGSRSV1[0]) &&
      _.isArray(ofx.SIGNONMSGSRSV1[0].SONRS) &&
      _.isPlainObject(ofx.SIGNONMSGSRSV1[0].SONRS[0]) &&
      _.isArray(ofx.SIGNONMSGSRSV1[0].SONRS[0].FI) &&
      _.isPlainObject(ofx.SIGNONMSGSRSV1[0].SONRS[0].FI[0])) {

    return {
      id: _value(ofx.SIGNONMSGSRSV1[0].SONRS[0].FI[0].FID),
      name: _value(ofx.SIGNONMSGSRSV1[0].SONRS[0].FI[0].ORG)
    };
  }

  return null;
}

function _parseSecurities(ofx) {
  var result = [];

  if (_.isPlainObject(ofx) &&
      _.isArray(ofx.SECLISTMSGSRSV1) &&
      _.isPlainObject(ofx.SECLISTMSGSRSV1[0]) &&
      _.isArray(ofx.SECLISTMSGSRSV1[0].SECLIST) &&
      _.isPlainObject(ofx.SECLISTMSGSRSV1[0].SECLIST[0]) &&
      _.isArray(ofx.SECLISTMSGSRSV1[0].SECLIST[0].STOCKINFO)) {

    _.each(ofx.SECLISTMSGSRSV1[0].SECLIST[0].STOCKINFO, function (stockInfo) {
      if (_.isPlainObject(stockInfo) &&
          _.isArray(stockInfo.SECINFO) &&
          _.isPlainObject(stockInfo.SECINFO[0])) {

        var security = {};

        if (_.isArray(stockInfo.SECINFO[0].SECID) &&
            _.isPlainObject(stockInfo.SECINFO[0].SECID[0])) {
          security.id = _value(stockInfo.SECINFO[0].SECID[0].UNIQUEID);
          security.idType = _value(stockInfo.SECINFO[0].SECID[0].UNIQUEIDTYPE);
        }
        security.fiid = _value(stockInfo.SECINFO[0].FIID);
        security.name = _value(stockInfo.SECINFO[0].SECNAME);
        security.ticker = _value(stockInfo.SECINFO[0].TICKER);

        result.push(security);
      }
    });
  }

  return result;
}

function _parseTransactions(ofx) {
  var result = [];

  if (_.isPlainObject(ofx) &&
      _.isArray(ofx.INVSTMTMSGSRSV1) &&
      _.isPlainObject(ofx.INVSTMTMSGSRSV1[0]) &&
      _.isArray(ofx.INVSTMTMSGSRSV1[0].INVSTMTTRNRS) &&
      _.isPlainObject(ofx.INVSTMTMSGSRSV1[0].INVSTMTTRNRS[0]) &&
      _.isArray(ofx.INVSTMTMSGSRSV1[0].INVSTMTTRNRS[0].INVSTMTRS) &&
      _.isPlainObject(ofx.INVSTMTMSGSRSV1[0].INVSTMTTRNRS[0].INVSTMTRS[0]) &&
      _.isArray(ofx.INVSTMTMSGSRSV1[0].INVSTMTTRNRS[0].INVSTMTRS[0].INVTRANLIST) &&
      _.isPlainObject(ofx.INVSTMTMSGSRSV1[0].INVSTMTTRNRS[0].INVSTMTRS[0].INVTRANLIST[0])) {

    var invTranList = ofx.INVSTMTMSGSRSV1[0].INVSTMTTRNRS[0].INVSTMTRS[0].INVTRANLIST[0];

    // Buy Stock
    if (_.isArray(invTranList.BUYSTOCK)) {
      _.each(invTranList.BUYSTOCK, function (buyStock) {
        if (_.isObject(buyStock)) {
          result.push({
            id: _value(buyStock.INVBUY[0].INVTRAN[0].FITID),
            date: _value(buyStock.INVBUY[0].INVTRAN[0].DTTRADE),
            secId: _value(buyStock.INVBUY[0].SECID[0].UNIQUEID),
            secIdType: _value(buyStock.INVBUY[0].SECID[0].UNIQUEIDTYPE),
            units: _valueFloat(buyStock.INVBUY[0].UNITS),
            unitPrice: _valueFloat(buyStock.INVBUY[0].UNITPRICE),
            commission: _valueFloat(buyStock.INVBUY[0].COMMISSION),
            total: _valueFloat(buyStock.INVBUY[0].TOTAL),
            currency: _value(buyStock.INVBUY[0].CURRENCY[0].CURSYM),
            currencyRate: _valueFloat(buyStock.INVBUY[0].CURRENCY[0].CURRATE),
            type: _value(buyStock.BUYTYPE)
          });
        }
      });
    }

    // Sell Stock
    if (_.isArray(invTranList.SELLSTOCK)) {
      _.each(invTranList.SELLSTOCK, function (sellStock) {
        if (_.isObject(sellStock)) {
          result.push({
            id: _value(sellStock.INVSELL[0].INVTRAN[0].FITID),
            date: _value(sellStock.INVSELL[0].INVTRAN[0].DTTRADE),
            secId: _value(sellStock.INVSELL[0].SECID[0].UNIQUEID),
            secIdType: _value(sellStock.INVSELL[0].SECID[0].UNIQUEIDTYPE),
            units: _valueFloat(sellStock.INVSELL[0].UNITS),
            unitPrice: _valueFloat(sellStock.INVSELL[0].UNITPRICE),
            commission: _valueFloat(sellStock.INVSELL[0].COMMISSION),
            total: _valueFloat(sellStock.INVSELL[0].TOTAL),
            currency: _value(sellStock.INVSELL[0].CURRENCY[0].CURSYM),
            currencyRate: _value(sellStock.INVSELL[0].CURRENCY[0].CURRATE),
            type: _value(sellStock.SELLTYPE)
          });
        }
      });
    }

    // Bank transactions
    if (_.isArray(invTranList.INVBANKTRAN)) {
      _.each(invTranList.INVBANKTRAN, function (invBankTran) {
        result.push({
          id: _value(invBankTran.STMTTRN[0].FITID),
          date: _value(invBankTran.STMTTRN[0].DTPOSTED),
          amount: _valueFloat(invBankTran.STMTTRN[0].TRNAMT),
          memo: _value(invBankTran.STMTTRN[0].MEMO),
          currency: _value(invBankTran.STMTTRN[0].CURRENCY[0].CURSYM),
          currencyRate: _valueFloat(invBankTran.STMTTRN[0].CURRENCY[0].CURRATE),
          type: _value(invBankTran.STMTTRN[0].TRNTYPE)
        });
      });
    }
  }

  return result;
}

function _value(obj) {
  if (_.isArray(obj)) {
    return obj[0];
  }
  return null;
}

function _valueFloat(obj) {
  var result = parseFloat(_value(obj));
  if (!_.isNumber(result)) {
    return null;
  }
  return result;
}

function _valueFloat(obj) {
  var result = parseInt(_value(obj), 10);
  if (!_.isNumber(result)) {
    return null;
  }
  return result;
}

function format(obj, cb) {
  assert(_.isPlainObject(obj) && !_.isEmpty(obj), '"obj" must be a non-empty string.');
  assert(_.isFunction(cb), '"cb" must be a function.');

  var ofx = {};

  _formatFI(ofx, obj.fi);
  _formatSecurities(ofx, obj.securities);
  _formatTransactions(ofx, obj.transactions);

  process.nextTick(function () {
    var xml = _xmlBuilder.buildObject(ofx);

    xml = xml.slice(xml.indexOf('\n'));

    cb(null, [
      'OFXHEADER:100',
      'DATA:OFXSGML',
      'VERSION:102',
      'SECURITY:NONE',
      'ENCODING:USASCII',
      'CHARSET:1252',
      'COMPRESSION:NONE',
      'OLDFILEUID:NONE',
      'NEWFILEUID:NONE',
      xml
    ].join('\n'));
  });
}

function parse(ofx, cb) {
  assert(_.isString(ofx) && !_.isEmpty(ofx), '"ofx" must be a non-empty string.');
  assert(_.isFunction(cb), '"cb" must be a function.');

  var xml = ofx.slice(ofx.indexOf('<'));

  _xmlParser.parseString(xml, function (err, ofx) {
    if (err) { return cb(err); }

    var result = {
      fi: _parseFI(ofx),
      securities: _parseSecurities(ofx),
      transactions: _parseTransactions(ofx)
    };

    cb(null, result);
  });
}

// Public API
exports.format = format;
exports.parse = parse;
