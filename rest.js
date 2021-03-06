var crypto, qs, request;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

request = require('request');

crypto = require('crypto');

qs = require('querystring');


function rest(key, secret, nonceGenerator) {
    this.url = "https://api.bitfinex.com";
    this.version = 'v1';
    this.key = key;
    this.secret = secret;
    this.nonce = new Date().getTime();
    this._nonce = typeof nonceGenerator === "function" ? nonceGenerator : function () {
        //noinspection JSPotentiallyInvalidUsageOfThis
        return ++this.nonce;
    };
}

rest.prototype.make_request = function (sub_path, params, cb) {
    var headers, key, nonce, path, payload, signature, url, value;
    if (!this.key || !this.secret) {
        return cb(new Error("missing api key or secret"));
    }
    path = '/' + this.version + '/' + sub_path;
    url = this.url + path;
    nonce = JSON.stringify(this._nonce());
    payload = {
        request: path,
        nonce: nonce
    };
    for (key in params) {
        value = params[key];
        payload[key] = value;
    }
    payload = new Buffer(JSON.stringify(payload)).toString('base64');
    signature = crypto.createHmac("sha384", this.secret).update(payload).digest('hex');
    headers = {
        'X-BFX-APIKEY': this.key,
        'X-BFX-PAYLOAD': payload,
        'X-BFX-SIGNATURE': signature
    };
    return request({
        url: url,
        method: "POST",
        headers: headers,
        timeout: 15000
    }, function (err, response, body) {
        var error, error1, result;
        if (err || (response.statusCode !== 200 && response.statusCode !== 400)) {
            return cb(new Error(err != null ? err : response.statusCode));
        }
        try {
            result = JSON.parse(body);
        } catch (error1) {
            error = error1;
            return cb(null, {
                message: body.toString()
            });
        }
        if (result.message != null) {
            return cb(new Error(result.message));
        }
        return cb(null, result);
    });
};

rest.prototype.make_public_request = function (path, cb) {
    var url;
    url = this.url + '/v1/' + path;
    return request({
        url: url,
        method: "GET",
        timeout: 15000
    }, function (err, response, body) {
        var error, error1, result;
        if (err || (response.statusCode !== 200 && response.statusCode !== 400)) {
            return cb(new Error(err != null ? err : response.statusCode));
        }
        try {
            result = JSON.parse(body);
        } catch (error1) {
            error = error1;
            return cb(null, {
                message: body.toString()
            });
        }
        if (result.message != null) {
            return cb(new Error(result.message));
        }
        return cb(null, result);
    });
};

rest.prototype.ticker = function (symbol, cb) {
    if (arguments.length == 0){
        symbol = "BTCUSD";
        cb = function(error, data){console.log(data)}
    }
    return this.make_public_request('pubticker/' + symbol, cb);
};

rest.prototype.today = function (symbol, cb) {
    return this.make_public_request('today/' + symbol, cb);
};

rest.prototype.stats = function (symbol, cb) {
    return this.make_public_request('stats/' + symbol, cb);
};

//rest.prototype.candles = function (symbol, cb) {
//    return this.make_public_request('candles/' + symbol, cb);
//};

rest.prototype.fundingbook = function (currency, options, cb) {
    var err, error1, index, option, query_string, uri, value;
    index = 0;
    uri = 'lendbook/' + currency;
    if (typeof options === 'function') {
        cb = options;
    } else {
        try {
            for (option in options) {
                value = options[option];
                if (index++ > 0) {
                    query_string += '&' + option + '=' + value;
                } else {
                    query_string = '/?' + option + '=' + value;
                }
            }
            if (index > 0) {
                uri += query_string;
            }
        } catch (error1) {
            err = error1;
            return cb(err);
        }
    }
    return this.make_public_request(uri, cb);
};

rest.prototype.orderbook = function (symbol, options, cb) {
    var err, error1, index, option, query_string, uri, value;
    index = 0;
    uri = 'book/' + symbol;
    if (typeof options === 'function') {
        cb = options;
    } else {
        try {
            for (option in options) {
                value = options[option];
                if (index++ > 0) {
                    query_string += '&' + option + '=' + value;
                } else {
                    query_string = '/?' + option + '=' + value;
                }
            }
            if (index > 0) {
                uri += query_string;
            }
        } catch (error1) {
            err = error1;
            return cb(err);
        }
    }
    return this.make_public_request(uri, cb);
};
rest.prototype.trades = function (symbol, cb) {
    return this.make_public_request('trades/' + symbol, cb);
};

rest.prototype.lends = function (currency, cb) {
    return this.make_public_request('lends/' + currency, cb);
};

rest.prototype.get_symbols = function (cb) {
    return this.make_public_request('symbols', cb);
};

rest.prototype.symbols_details = function (cb) {
    return this.make_public_request('symbols_details', cb);
};

rest.prototype.new_order = function (symbol, amount, price, exchange, side, type, is_hidden, cb) {
    var params;
    if (typeof is_hidden === 'function') {
        cb = is_hidden;
        is_hidden = false;
    }
    params = {
        symbol: symbol,
        amount: amount,
        price: price,
        exchange: exchange,
        side: side,
        type: type
    };
    if (is_hidden) {
        params['is_hidden'] = true;
    }
    return this.make_request('order/new', params, cb);
};

rest.prototype.multiple_new_orders = function (orders, cb) {
    var params;
    params = {
        orders: orders
    };
    return this.make_request('order/new/multi', params, cb);
};

rest.prototype.cancel_order = function (order_id, cb) {
    var params;
    params = {
        order_id: parseInt(order_id)
    };
    return this.make_request('order/cancel', params, cb);
};

rest.prototype.cancel_all_orders = function (cb) {
    return this.make_request('order/cancel/all', {}, cb);
};

rest.prototype.cancel_multiple_orders = function (order_ids, cb) {
    var params;
    params = {
        order_ids: order_ids.map(function (id) {
            return parseInt(id);
        })
    };
    return this.make_request('order/cancel/multi', params, cb);
};

rest.prototype.replace_order = function (order_id, symbol, amount, price, exchange, side, type, cb) {
    var params;
    params = {
        order_id: parseInt(order_id),
        symbol: symbol,
        amount: amount,
        price: price,
        exchange: exchange,
        side: side,
        type: type
    };
    return this.make_request('order/cancel/replace', params, cb);
};

rest.prototype.order_status = function (order_id, cb) {
    var params;
    params = {
        order_id: order_id
    };
    return this.make_request('order/status', params, cb);
};

rest.prototype.active_orders = function (cb) {
    return this.make_request('orders', {}, cb);
};

rest.prototype.active_positions = function (cb) {
    return this.make_request('positions', {}, cb);
};

rest.prototype.claim_position = function (position_id, cb) {
    var params;
    params = {
        position_id: parseInt(position_id)
    };
    return this.make_request('position/claim', params, cb);
};

rest.prototype.balance_history = function (currency, options, cb) {
    var err, error1, option, params, value;
    params = {
        currency: currency
    };
    if (typeof options === 'function') {
        cb = options;
    } else {
        try {
            for (option in options) {
                value = options[option];
                params[option] = value;
            }
        } catch (error1) {
            err = error1;
            return cb(err);
        }
    }
    return this.make_request('history', params, cb);
};

rest.prototype.movements = function (currency, options, cb) {
    var err, error1, option, params, value;
    params = {
        currency: currency
    };
    if (typeof options === 'function') {
        cb = options;
    } else {
        try {
            for (option in options) {
                value = options[option];
                params[option] = value;
            }
        } catch (error1) {
            err = error1;
            return cb(err);
        }
    }
    return this.make_request('history/movements', params, cb);
};

rest.prototype.past_trades = function (symbol, options, cb) {
    var err, error1, option, params, value;
    params = {
        symbol: symbol
    };
    if (typeof options === 'function') {
        cb = options;
    } else {
        try {
            for (option in options) {
                value = options[option];
                params[option] = value;
            }
        } catch (error1) {
            err = error1;
            return cb(err);
        }
    }
    return this.make_request('mytrades', params, cb);
};

rest.prototype.new_deposit = function (currency, method, wallet_name, cb) {
    var params;
    params = {
        currency: currency,
        method: method,
        wallet_name: wallet_name
    };
    return this.make_request('deposit/new', params, cb);
};

rest.prototype.new_offer = function (currency, amount, rate, period, direction, cb) {
    var params;
    params = {
        currency: currency,
        amount: amount,
        rate: rate,
        period: period,
        direction: direction
    };
    return this.make_request('offer/new', params, cb);
};

rest.prototype.cancel_offer = function (offer_id, cb) {
    var params;
    params = {
        offer_id: offer_id
    };
    return this.make_request('offer/cancel', params, cb);
};

rest.prototype.offer_status = function (offer_id, cb) {
    var params;
    params = {
        offer_id: offer_id
    };
    return this.make_request('offer/status', params, cb);
};

rest.prototype.active_offers = function (cb) {
    return this.make_request('offers', {}, cb);
};

rest.prototype.active_credits = function (cb) {
    return this.make_request('credits', {}, cb);
};

rest.prototype.wallet_balances = function (cb) {
    return this.make_request('balances', {}, cb);
};

rest.prototype.taken_swaps = function (cb) {
    return this.make_request('taken_funds', {}, cb);
};

rest.prototype.total_taken_swaps = function (cb) {
    return this.make_request('total_taken_funds', {}, cb);
};

rest.prototype.close_swap = function (swap_id, cb) {
    return this.make_request('swap/close', {
        swap_id: swap_id
    }, cb);
};

rest.prototype.account_infos = function (cb) {
    return this.make_request('account_infos', {}, cb);
};

rest.prototype.margin_infos = function (cb) {
    return this.make_request('margin_infos', {}, cb);
};


/*
 POST /v1/withdraw

 Parameters:
 'withdraw_type' :string (can be "bitcoin", "litecoin" or "darkcoin" or "mastercoin")
 'walletselected' :string (the origin of the wallet to withdraw from, can be "trading", "exchange", or "deposit")
 'amount' :decimal (amount to withdraw)
 'address' :address (destination address for withdrawal)
 */

rest.prototype.withdraw = function (withdraw_type, walletselected, amount, address, cb) {
    var params;
    params = {
        withdraw_type: withdraw_type,
        walletselected: walletselected,
        amount: amount,
        address: address
    };
    return this.make_request('withdraw', params, cb);
};


/*
 POST /v1/transfer

 Parameters:
 ‘amount’: decimal (amount to transfer)
 ‘currency’: string, currency of funds to transfer
 ‘walletfrom’: string. Wallet to transfer from
 ‘walletto’: string. Wallet to transfer to
 */

rest.prototype.transfer = function (amount, currency, walletfrom, walletto, cb) {
    var params;
    params = {
        amount: amount,
        currency: currency,
        walletfrom: walletfrom,
        walletto: walletto
    };
    return this.make_request('transfer', params, cb);
};

module.exports = rest