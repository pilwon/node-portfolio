/*
 * lib/ofx.js
 */

'use strict';

var assert = require('assert');

var _ = require('lodash'),
    ent = require('ent'),
    moment = require('moment'),
    xml2js = require('xml2js');

var _xmlBuilder = new xml2js.Builder({
  renderOpts: {
    pretty: true
  },
  rootName: 'OFX'
});

var _xmlParser = new xml2js.Parser({
  explicitRoot: false,
  strict: false
});

function _assign(obj, path, val) {
  assert(_.isPlainObject(obj), '"obj" must be a plain object.');
  assert(_.isString(path) && !_.isEmpty(path), '"path" must be a non-empty string.');

  var keys = path.split('.'),
      p;

  if (!_.isUndefined(val)) {
    p = obj;
    keys.slice(0, -1).forEach(function (key) {
      if (!_.has(p, key) || !_.isArray(p[key])) {
        p[key] = [{}];
      }
      p = p[key][0];
    });
    p[_.last(keys)] = val;
  }
}

function _dateFormat(date) {
  return moment(date).format('YYYYMMDDHHmmss.SSS');
}

function _dateParse(date) {
  return moment(date, 'YYYYMMDDHHmmss.SSS').toDate();
}

function _decode(str) {
  if (_.isString(str)) {
    return ent.decode(str);
  }
  return void 0;
}

function _encode(str) {
  if (_.isString(str)) {
    ent.encode(str);
  }
  return void 0;
}

function _formatFI(ofx, fi) {
  if (!_.isPlainObject(fi)) { return; }

  _assign(ofx, 'SIGNONMSGSRSV1.SONRS.FI.ORG', fi.name);
  _assign(ofx, 'SIGNONMSGSRSV1.SONRS.FI.FID', fi.id);
}

function _formatSecurities(ofx, securities) {
  if (!_.isArray(securities)) { return; }

  var stockInfo = [],
      secInfo;

  _.each(securities, function (security) {
    secInfo = {};

    _assign(secInfo, 'SECINFO.SECID.UNIQUEID', security.id);
    _assign(secInfo, 'SECINFO.SECID.UNIQUEIDTYPE', security.idType);
    _assign(secInfo, 'SECINFO.FIID', security.fiid);
    _assign(secInfo, 'SECINFO.SECNAME', security.name);
    _assign(secInfo, 'SECINFO.TICKER', security.ticker);

    stockInfo.push(secInfo);
  });

  _assign(ofx, 'SECLISTMSGSRSV1.SECLIST.STOCKINFO', stockInfo);
}

function _formatTransactions(ofx, transactions, baseCurrency, brokerId, accountId) {
  if (!_.isArray(transactions)) { return; }

  var buyStock = [],
      sellStock = [],
      invBankTran = [],
      t;

  _.each(transactions, function (transaction) {
    switch (transaction.type) {
    case 'BUY':
    case 'BUYTOCOVER':
      t = {};
      _assign(t, 'INVBUY.INVTRAN.FITID', transaction.id);
      _assign(t, 'INVBUY.INVTRAN.DTTRADE', _dateFormat(transaction.date));
      _assign(t, 'INVBUY.INVTRAN.MEMO', _encode(transaction.memo));
      _assign(t, 'INVBUY.SECID.UNIQUEID', transaction.secId);
      _assign(t, 'INVBUY.SECID.UNIQUEIDTYPE', transaction.secIdType);
      _assign(t, 'INVBUY.UNITS', transaction.units);
      _assign(t, 'INVBUY.UNITPRICE', transaction.unitPrice);
      _assign(t, 'INVBUY.COMMISSION', transaction.commission);
      _assign(t, 'INVBUY.TOTAL', transaction.total);
      _assign(t, 'INVBUY.CURRENCY.CURRATE', transaction.currencyRate);
      _assign(t, 'INVBUY.CURRENCY.CURSYM', transaction.currency);
      _assign(t, 'INVBUY.SUBACCTSEC', 'CASH');
      _assign(t, 'INVBUY.SUBACCTFUND', transaction.fund || 'CASH');
      _assign(t, 'BUYTYPE', transaction.type);
      buyStock.push(t);
      break;
    case 'SELL':
    case 'SELLSHORT':
      t = {};
      _assign(t, 'INVSELL.INVTRAN.FITID', transaction.id);
      _assign(t, 'INVSELL.INVTRAN.DTTRADE', _dateFormat(transaction.date));
      _assign(t, 'INVSELL.INVTRAN.MEMO', _encode(transaction.memo));
      _assign(t, 'INVSELL.SECID.UNIQUEID', transaction.secId);
      _assign(t, 'INVSELL.SECID.UNIQUEIDTYPE', transaction.secIdType);
      _assign(t, 'INVSELL.UNITS', transaction.units);
      _assign(t, 'INVSELL.UNITPRICE', transaction.unitPrice);
      _assign(t, 'INVSELL.COMMISSION', transaction.commission);
      _assign(t, 'INVSELL.TOTAL', transaction.total);
      _assign(t, 'INVSELL.CURRENCY.CURRATE', transaction.currencyRate);
      _assign(t, 'INVSELL.CURRENCY.CURSYM', transaction.currency);
      _assign(t, 'INVSELL.SUBACCTSEC', 'CASH');
      _assign(t, 'INVSELL.SUBACCTFUND', transaction.fund || 'CASH');
      _assign(t, 'SELLTYPE', transaction.type);
      sellStock.push(t);
      break;
    case 'BANKCREDIT':
    case 'BANKDEBIT':
    case 'BANKINT':
    case 'BANKDIV':
    case 'BANKFEE':
    case 'BANKSRVCHG':
    case 'BANKDEP':
    case 'BANKATM':
    case 'BANKPOS':
    case 'BANKXFER':
    case 'BANKCHECK':
    case 'BANKPAYMENT':
    case 'BANKCASH':
    case 'BANKDIRECTDEP':
    case 'BANKDIRECTDEBIT':
    case 'BANKREPEATPMT':
    case 'BANKOTHER':
      t = {};
      _assign(t, 'STMTTRN.CURRENCY.CURRATE', transaction.currencyRate);
      _assign(t, 'STMTTRN.CURRENCY.CURSYM', transaction.currency);
      _assign(t, 'STMTTRN.MEMO', _encode(transaction.memo));
      _assign(t, 'STMTTRN.TRNTYPE', transaction.type.replace(/^BANK(.*)$/, '$1'));
      _assign(t, 'STMTTRN.DTPOSTED', _dateFormat(transaction.date));
      _assign(t, 'STMTTRN.TRNAMT', transaction.total);
      _assign(t, 'STMTTRN.FITID', transaction.id);
      _assign(t, 'SUBACCTFUND', transaction.fund);
      invBankTran.push(t);
      break;
    default:
      break;
    }
  });

  if (buyStock.length || sellStock.length || invBankTran.length) {
    _assign(ofx, 'INVSTMTMSGSRSV1.INVSTMTTRNRS.TRNUID', 1001);
    _assign(ofx, 'INVSTMTMSGSRSV1.INVSTMTTRNRS.STATUS.CODE', 0);
    _assign(ofx, 'INVSTMTMSGSRSV1.INVSTMTTRNRS.STATUS.SEVERITY', 'INFO');
    _assign(ofx, 'INVSTMTMSGSRSV1.INVSTMTTRNRS.INVSTMTRS.DTASOF', _dateFormat(new Date()));
    _assign(ofx, 'INVSTMTMSGSRSV1.INVSTMTTRNRS.INVSTMTRS.CURDEF', baseCurrency);
    _assign(ofx, 'INVSTMTMSGSRSV1.INVSTMTTRNRS.INVSTMTRS.INVACCTFROM.BROKERID', brokerId);
    _assign(ofx, 'INVSTMTMSGSRSV1.INVSTMTTRNRS.INVSTMTRS.INVACCTFROM.ACCTID', accountId);
    _assign(ofx, 'INVSTMTMSGSRSV1.INVSTMTTRNRS.INVSTMTRS.INVTRANLIST.DTSTART', _dateFormat(new Date()));
    _assign(ofx, 'INVSTMTMSGSRSV1.INVSTMTTRNRS.INVSTMTRS.INVTRANLIST.DTEND', _dateFormat(new Date()));
  }

  if (buyStock.length) {
    _assign(ofx, 'INVSTMTMSGSRSV1.INVSTMTTRNRS.INVSTMTRS.INVTRANLIST.BUYSTOCK', buyStock);
  }
  if (sellStock.length) {
    _assign(ofx, 'INVSTMTMSGSRSV1.INVSTMTTRNRS.INVSTMTRS.INVTRANLIST.SELLSTOCK', sellStock);
  }
  if (invBankTran.length) {
    _assign(ofx, 'INVSTMTMSGSRSV1.INVSTMTTRNRS.INVSTMTRS.INVTRANLIST.INVBANKTRAN', invBankTran);
  }
}

function _parseFI(ofx) {
  var result = void 0;

  if (_.isPlainObject(ofx) &&
      _.isArray(ofx.SIGNONMSGSRSV1) &&
      _.isPlainObject(ofx.SIGNONMSGSRSV1[0]) &&
      _.isArray(ofx.SIGNONMSGSRSV1[0].SONRS) &&
      _.isPlainObject(ofx.SIGNONMSGSRSV1[0].SONRS[0]) &&
      _.isArray(ofx.SIGNONMSGSRSV1[0].SONRS[0].FI) &&
      _.isPlainObject(ofx.SIGNONMSGSRSV1[0].SONRS[0].FI[0])) {

    result = {};

    _assign(result, 'name', _value(ofx.SIGNONMSGSRSV1[0].SONRS[0].FI[0].ORG));
    _assign(result, 'id', _value(ofx.SIGNONMSGSRSV1[0].SONRS[0].FI[0].FID));
  }

  return result;
}

function _parseSecurities(ofx) {
  var result = [],
      security;

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

        security = {};

        if (_.isArray(stockInfo.SECINFO[0].SECID) &&
            _.isPlainObject(stockInfo.SECINFO[0].SECID[0])) {
          _assign(security, 'id', _value(stockInfo.SECINFO[0].SECID[0].UNIQUEID));
          _assign(security, 'idType', _value(stockInfo.SECINFO[0].SECID[0].UNIQUEIDTYPE));
        }
        _assign(security, 'fiid', _value(stockInfo.SECINFO[0].FIID));
        _assign(security, 'name', _value(stockInfo.SECINFO[0].SECNAME));
        _assign(security, 'ticker', _value(stockInfo.SECINFO[0].TICKER));

        result.push(security);
      }
    });
  }

  return result;
}

function _parseTransactions(ofx) {
  var result = [],
      transaction;

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
          transaction = {};

          if (_.isArray(buyStock.INVBUY) &&
              _.isPlainObject(buyStock.INVBUY[0])) {
            if (_.isArray(buyStock.INVBUY[0].INVTRAN) &&
                _.isPlainObject(buyStock.INVBUY[0].INVTRAN[0])) {
              _assign(transaction, 'id', _value(buyStock.INVBUY[0].INVTRAN[0].FITID));
              _assign(transaction, 'date', _dateParse(_value(buyStock.INVBUY[0].INVTRAN[0].DTTRADE)));
              _assign(transaction, 'memo', _decode(_value(buyStock.INVBUY[0].INVTRAN[0].MEMO)));
            }
            if (_.isArray(buyStock.INVBUY[0].SECID) &&
                _.isPlainObject(buyStock.INVBUY[0].SECID[0])) {
              _assign(transaction, 'secId', _value(buyStock.INVBUY[0].SECID[0].UNIQUEID));
              _assign(transaction, 'secIdType', _value(buyStock.INVBUY[0].SECID[0].UNIQUEIDTYPE));
            }
            if (_.isArray(buyStock.INVBUY[0].CURRENCY) &&
                _.isPlainObject(buyStock.INVBUY[0].CURRENCY[0])) {
              _assign(transaction, 'currency', _value(buyStock.INVBUY[0].CURRENCY[0].CURSYM));
              _assign(transaction, 'currencyRate', _valueNumber(buyStock.INVBUY[0].CURRENCY[0].CURRATE));
            }
            _assign(transaction, 'units', _valueNumber(buyStock.INVBUY[0].UNITS));
            _assign(transaction, 'unitPrice', _valueNumber(buyStock.INVBUY[0].UNITPRICE));
            _assign(transaction, 'commission', _valueNumber(buyStock.INVBUY[0].COMMISSION));
            _assign(transaction, 'total', _valueNumber(buyStock.INVBUY[0].TOTAL));
            _assign(transaction, 'fund', _value(buyStock.INVBUY[0].SUBACCTFUND));
          }
          _assign(transaction, 'type', _value(buyStock.BUYTYPE));

          result.push(transaction);
        }
      });
    }

    // Sell Stock
    if (_.isArray(invTranList.SELLSTOCK)) {
      _.each(invTranList.SELLSTOCK, function (sellStock) {
        if (_.isObject(sellStock)) {
          transaction = {};

          if (_.isArray(sellStock.INVSELL) &&
              _.isPlainObject(sellStock.INVSELL[0])) {
            if (_.isArray(sellStock.INVSELL[0].INVTRAN) &&
                _.isPlainObject(sellStock.INVSELL[0].INVTRAN[0])) {
              _assign(transaction, 'id', _value(sellStock.INVSELL[0].INVTRAN[0].FITID));
              _assign(transaction, 'date', _dateParse(_value(sellStock.INVSELL[0].INVTRAN[0].DTTRADE)));
              _assign(transaction, 'memo', _decode(_value(sellStock.INVSELL[0].INVTRAN[0].MEMO)));
            }
            if (_.isArray(sellStock.INVSELL[0].SECID) &&
                _.isPlainObject(sellStock.INVSELL[0].SECID[0])) {
              _assign(transaction, 'secId', _value(sellStock.INVSELL[0].SECID[0].UNIQUEID));
              _assign(transaction, 'secIdType', _value(sellStock.INVSELL[0].SECID[0].UNIQUEIDTYPE));
            }
            if (_.isArray(sellStock.INVSELL[0].CURRENCY) &&
                _.isPlainObject(sellStock.INVSELL[0].CURRENCY[0])) {
              _assign(transaction, 'currency', _value(sellStock.INVSELL[0].CURRENCY[0].CURSYM));
              _assign(transaction, 'currencyRate', _valueNumber(sellStock.INVSELL[0].CURRENCY[0].CURRATE));
            }
            _assign(transaction, 'units', _valueNumber(sellStock.INVSELL[0].UNITS));
            _assign(transaction, 'unitPrice', _valueNumber(sellStock.INVSELL[0].UNITPRICE));
            _assign(transaction, 'commission', _valueNumber(sellStock.INVSELL[0].COMMISSION));
            _assign(transaction, 'total', _valueNumber(sellStock.INVSELL[0].TOTAL));
            _assign(transaction, 'fund', _value(sellStock.INVSELL[0].SUBACCTFUND));
          }
          _assign(transaction, 'type', _value(sellStock.SELLTYPE));

          result.push(transaction);
        }
      });
    }

    // Bank transactions
    if (_.isArray(invTranList.INVBANKTRAN)) {
      _.each(invTranList.INVBANKTRAN, function (invBankTran) {
        transaction = {};

        if (_.isArray(invBankTran.STMTTRN) &&
            _.isPlainObject(invBankTran.STMTTRN[0])) {
          if (_.isArray(invBankTran.STMTTRN[0].CURRENCY) &&
              _.isPlainObject(invBankTran.STMTTRN[0].CURRENCY[0])) {
            _assign(transaction, 'currency', _value(invBankTran.STMTTRN[0].CURRENCY[0].CURSYM));
            _assign(transaction, 'currencyRate', _valueNumber(invBankTran.STMTTRN[0].CURRENCY[0].CURRATE));
          }
          _assign(transaction, 'id', _value(invBankTran.STMTTRN[0].FITID));
          _assign(transaction, 'date', _dateParse(_value(invBankTran.STMTTRN[0].DTPOSTED)));
          _assign(transaction, 'total', _valueNumber(invBankTran.STMTTRN[0].TRNAMT));
          _assign(transaction, 'type', 'BANK' + _value(invBankTran.STMTTRN[0].TRNTYPE));
          _assign(transaction, 'memo', _decode(_value(invBankTran.STMTTRN[0].MEMO)));
        }
        _assign(transaction, 'fund', _value(invBankTran.SUBACCTFUND));

        result.push(transaction);
      });
    }
  }

  return result;
}

function _value(obj) {
  if (_.isArray(obj)) {
    return obj[0];
  }
  return void 0;
}

function _valueNumber(obj) {
  var result = parseFloat(_value(obj));
  if (_.isNaN(result)) {
    return void 0;
  }
  return result;
}

function format(obj, cb) {
  assert(_.isPlainObject(obj) && !_.isEmpty(obj), '"obj" must be a non-empty string.');
  assert(_.isFunction(cb), '"cb" must be a function.');

  var ofx = {};

  _assign(ofx, 'SIGNONMSGSRSV1.SONRS.STATUS.CODE', 0);
  _assign(ofx, 'SIGNONMSGSRSV1.SONRS.STATUS.SEVERITY', 'INFO');
  _assign(ofx, 'SIGNONMSGSRSV1.SONRS.DTSERVER', _dateFormat(new Date()));
  _assign(ofx, 'SIGNONMSGSRSV1.SONRS.LANGUAGE', 'ENG');

  _formatFI(ofx, obj.fi);
  _formatTransactions(ofx, obj.transactions, obj.baseCurrency, obj.brokerId, obj.accountId);
  _formatSecurities(ofx, obj.securities);

  process.nextTick(function () {
    var xml = _xmlBuilder.buildObject(ofx);

    xml = xml.replace(/^.+\?>/, '');

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

  var xml = ofx
    .slice(ofx.indexOf('<'))
    .replace(/<([^\/>][^>]*)>([^\/<>\n]+)(?=<(?!\/)|\n)/g, '<$1>$2</$1>$3');

  _xmlParser.parseString(xml, function (err, ofx) {
    if (err) { return cb(err); }

    var result = {};

    if (_.isPlainObject(ofx) &&
        _.isArray(ofx.INVSTMTMSGSRSV1) &&
        _.isPlainObject(ofx.INVSTMTMSGSRSV1[0]) &&
        _.isArray(ofx.INVSTMTMSGSRSV1[0].INVSTMTTRNRS) &&
        _.isPlainObject(ofx.INVSTMTMSGSRSV1[0].INVSTMTTRNRS[0]) &&
        _.isArray(ofx.INVSTMTMSGSRSV1[0].INVSTMTTRNRS[0].INVSTMTRS) &&
        _.isPlainObject(ofx.INVSTMTMSGSRSV1[0].INVSTMTTRNRS[0].INVSTMTRS[0])) {
      _assign(result, 'baseCurrency', _value(ofx.INVSTMTMSGSRSV1[0].INVSTMTTRNRS[0].INVSTMTRS[0].CURDEF));
      if (_.isArray(ofx.INVSTMTMSGSRSV1[0].INVSTMTTRNRS[0].INVSTMTRS[0].INVACCTFROM) &&
          _.isPlainObject(ofx.INVSTMTMSGSRSV1[0].INVSTMTTRNRS[0].INVSTMTRS[0].INVACCTFROM[0])) {
        _assign(result, 'brokerId', _value(ofx.INVSTMTMSGSRSV1[0].INVSTMTTRNRS[0].INVSTMTRS[0].INVACCTFROM[0].BROKERID));
        _assign(result, 'accountId', _value(ofx.INVSTMTMSGSRSV1[0].INVSTMTTRNRS[0].INVSTMTRS[0].INVACCTFROM[0].ACCTID));
      }
    }

    _assign(result, 'fi', _parseFI(ofx));
    _assign(result, 'transactions', _parseTransactions(ofx));
    _assign(result, 'securities', _parseSecurities(ofx));

    cb(null, result);
  });
}

// Public API
exports.format = format;
exports.parse = parse;
