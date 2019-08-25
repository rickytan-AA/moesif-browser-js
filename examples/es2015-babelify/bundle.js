(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcLoaderModule = require('../../src/loader-module');

var _srcLoaderModule2 = _interopRequireDefault(_srcLoaderModule);

_srcLoaderModule2['default'].init({
  applicationId: 'Your Application ID',
  debug: true
});

_srcLoaderModule2['default'].start();

},{"../../src/loader-module":6}],2:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _utils = require('./utils');

var _referrer = require('./referrer');

var _referrer2 = _interopRequireDefault(_referrer);

var _utm = require('./utm');

var _utm2 = _interopRequireDefault(_utm);

function _getUrlParams() {
  return location && location.search;
}

function getGclid(urlParams) {
  var gclid = _utils._.getQueryParamByName('gclid', urlParams);
  if (_utils._.isEmptyString(gclid)) {
    return;
  }
  return gclid;
}

function getCampaignData(opt) {
  try {
    var result = {};

    if (!opt.disableUtm) {
      result = (0, _utm2['default'])() || {};
    }

    if (!opt.disableReferer) {
      var referrer = (0, _referrer2['default'])();
      if (referrer) {
        result['referrer'] = referrer['referrer'];
        result['referring_domain'] = referrer['referring_domain'];
      }
    }
    if (!opt.disableRGclid) {
      var gclid = getGclid(_getUrlParams());
      if (gclid) {
        result['gclid'] = gclid;
      }
    }

    return result;
  } catch (err) {
    _utils.console.error(err);
  }
}

exports['default'] = getCampaignData;
module.exports = exports['default'];

},{"./referrer":9,"./utils":10,"./utm":11}],3:[function(require,module,exports){
/**
 * Created by Xingheng on 1/31/17.
 */

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _utils = require('./utils');

var HTTP_PROTOCOL = 'http:' === (document && document.location.protocol) ? 'http://' : 'https://';

/**
 * @param recorder
 * @returns {undoPatch}
 *
 * The recorder is a function that takes an Event and records it.
 *
 */
function captureXMLHttpRequest(recorder) {
  var XHR = XMLHttpRequest.prototype;

  var open = XHR.open;
  var send = XHR.send;
  var setRequestHeader = XHR.setRequestHeader;

  // Collect data:
  XHR.open = function (method, url) {
    this._method = method;
    this._url = url;
    this._requestHeaders = {};
    this._startTime = new Date().toISOString();
    return open.apply(this, arguments);
  };

  XHR.setRequestHeader = function (header, value) {
    this._requestHeaders[header] = value;
    return setRequestHeader.apply(this, arguments);
  };

  XHR.send = function (postData) {
    this.addEventListener('load', function () {
      var endTime = new Date().toISOString();

      if (recorder) {
        // avoid apiRequest.io and moesif.com
        var myUrl = this._url ? this._url.toLowerCase() : this._url;
        if (myUrl && myUrl.indexOf('moesif.com') < 0 && myUrl.indexOf('apirequest.io') < 0) {

          var requestModel = {
            'uri': convertToFullUrl(this._url),
            'verb': this._method,
            'time': this._startTime,
            'headers': this._requestHeaders
          };

          if (postData) {
            if (typeof postData === 'string') {
              _utils.console.log('request post data is string');
              _utils.console.log(postData);
              try {
                requestModel['body'] = _utils._.JSONDecode(postData);
              } catch (err) {
                _utils.console.log('JSON decode failed');
                _utils.console.log(err);
                requestModel['transfer_encoding'] = 'base64';
                requestModel['body'] = _utils._.base64Encode(postData);
              }
            } else if (typeof postData === 'object' || Array.isArray(postData) || typeof postData === 'number' || typeof postData === 'boolean') {
              requestModel['body'] = postData;
            }
          }

          var responseHeaders = parseResponseHeaders(this.getAllResponseHeaders());

          var responseModel = {
            'status': this.status,
            'time': endTime,
            'headers': responseHeaders
          };

          if (this.responseText) {
            // responseText is string or null
            try {
              responseModel['body'] = _utils._.JSONDecode(this.responseText);
            } catch (err) {
              responseModel['transfer_encoding'] = 'base64';
              responseModel['body'] = _utils._.base64Encode(this.responseText);
            }

            // if (isJsonHeader(responseHeaders) || isStartJson(this.responseText)) {
            //   responseModel['body'] = parseBody(this.responseText);
            // } else {
            //   responseModel['transfer_encoding'] = 'base64';
            //   responseModel['body'] = _.base64Encode(this.responseText);
            // }
          }

          var event = {
            'request': requestModel,
            'response': responseModel
          };

          recorder(event);
        }
      }
    });
    return send.apply(this, arguments);
  };

  var undoPatch = function undoPatch() {
    XHR.open = open;
    XHR.send = send;
    XHR.setRequestHeader = setRequestHeader;
  };

  return undoPatch;
  // so caller have a handle to undo the patch if needed.
}

function isJsonHeader(headers) {
  if (headers) {
    if (headers['content-type'] && headers['content-type'].indexOf('json') >= 0) {
      return true;
    }
    if (headers['Content-Type'] && headers['Content-Type'].indexOf('json') >= 0) {
      return true;
    }
  }
  return false;
}

function isStartJson(body) {
  if (body && typeof body === 'string') {
    var trimmedBody = _utils._.trim(body);
    if (trimmedBody.indexOf('[') === 0 || trimmedBody.indexOf('{') === 0) {
      return true;
    }
  }
  return false;
}

function parseBody(body) {
  try {
    return _utils._.JSONDecode(body);
  } catch (err) {
    return {
      'moesif_error': {
        'code': 'moesif_parse_err',
        'msg': 'Can not parse body',
        'src': 'moesif-browser-js',
        'args': body
      }
    };
  }
}

function parseResponseHeaders(headerStr) {
  var headers = {};
  if (!headerStr) {
    return headers;
  }
  var headerPairs = headerStr.split('\r\n');
  for (var i = 0; i < headerPairs.length; i++) {
    var headerPair = headerPairs[i];
    var index = headerPair.indexOf(': ');
    if (index > 0) {
      var key = headerPair.substring(0, index);
      headers[key] = headerPair.substring(index + 2);
    }
  }
  return headers;
}

function convertToFullUrl(url) {
  if (url && typeof url === 'string') {
    var trimedUrl = _utils._.trim(url);
    if (trimedUrl.indexOf('http') !== 0) {
      return HTTP_PROTOCOL + window.location.host + '/' + trimedUrl.replace(/^\./, '').replace(/^\//, '');
    } else {
      return url;
    }
  }
  return url;
}

exports['default'] = captureXMLHttpRequest;
module.exports = exports['default'];

},{"./utils":10}],4:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _utils = require('./utils');

/**
 * @param {*} buffer
 * this checks the buffer and
 * returns something to start building the response or request model
 * with body filled in.
 */
function processBodyAndInitializedModel(buffer) {
  if (!buffer) return {};
  _utils.console.log('about to decode buffer');
  _utils.console.log(buffer);
  _utils.console.log(buffer.byteLength);

  if (buffer.byteLength <= 0) {
    // empty body.
    return {};
  }

  try {
    var decoder = new TextDecoder('utf-8');
    var text = decoder.decode(buffer);

    try {
      return { 'body': _utils._.JSONDecode(text) };
    } catch (err) {
      _utils.console.error(err);
      return {
        'transfer_encoding': 'base64',
        'body': _utils._.base64Encode(text)
      };
    }
  } catch (err) {
    _utils.console.error(err);
    _utils.console.log(buffer);
    return {
      'transfer_encoding': 'base64',
      'body': 'can not be decoded'
    };
  }
}

/**
 *
 * @param {*} headers
 * headers must be a Headers object.
 */
function parseHeaders(headers) {
  var result = {};
  _utils.console.log('parseheaders is called');

  var entries = headers.entries();

  var entry = entries.next();
  while (!entry.done) {
    _utils.console.log(entry.value); // 1 3 5 7 9
    result[entry.value[0]] = entry.value[1];

    entry = entries.next();
  }

  // for (var pair of headers.entries()) {
  //   result[pair[0]] = pair[1];
  // }

  return result;
}

function processSavedRequestResponse(savedRequest, savedResponse, startTime, endTime, recorder) {
  try {
    setTimeout(function () {
      _utils.console.log('interception is here.');
      _utils.console.log(savedRequest);
      _utils.console.log(savedResponse);
      if (savedRequest && savedResponse) {
        // try to exract out information:
        // var reqHeaders = {};
        // var resHeaders = {};

        // for (var pair of savedRequest.headers.entries()) {
        //   reqHeaders[pair[0]] = pair[1];
        // }

        // for (var pair2 of savedResponse.headers.entries()) {
        //   resHeaders[pair2[0]] = pair2[1];
        // }
        _utils.console.log('inside if statement.');
        try {
          Promise.all([savedRequest.arrayBuffer(), savedResponse.arrayBuffer()]).then(function (bodies) {
            _utils.console.log('processing bodies');
            var processedBodies = bodies.map(processBodyAndInitializedModel);

            var requestModel = Object.assign(processedBodies[0], {
              'uri': savedRequest.url,
              'verb': savedRequest.method,
              'time': startTime,
              'headers': parseHeaders(savedRequest.headers)
            });

            var responseModel = Object.assign(processedBodies[1], {
              'status': savedResponse.status,
              'time': endTime,
              'headers': parseHeaders(savedResponse.headers)
            });

            _utils.console.log(requestModel);
            _utils.console.log(responseModel);

            var event = {
              'request': requestModel,
              'response': responseModel
            };

            recorder(event);
          });
        } catch (err) {
          _utils.console.log('error processing body');
        }
      } else {
        _utils.console.log('savedRequest');
      }
    }, 50);
  } catch (err) {
    _utils.console.error('error processing saved fetch request and response, but move on anyways.');
    _utils.console.log(err);
  }
}

function interceptor(recorder, fetch, arg1, arg2) {
  _utils.console.log('fetch interceptor is called');

  var savedRequest = null;

  try {
    savedRequest = new Request(arg1, arg2);
  } catch (err) {
    // for internal errors only.
  }
  var startTime = new Date().toISOString();
  var endTime = null;

  var promise = null;
  // promise = Promise.resolve([arg1, arg2]);

  // reigster the fetch call.
  // promise = promise.then(function(ar1, ar2) {
  //   return fetch(ar1, ar2);
  // });

  _utils.console.log('about to perform fetch.');
  promise = fetch(arg1, arg2);

  var savedResponse = null;
  // add handlers for response.
  promise = promise.then(function (response) {
    //
    savedResponse = response.clone();
    endTime = new Date().toISOString();

    processSavedRequestResponse(savedRequest, savedResponse, startTime, endTime, recorder);

    return response;
  });

  return promise;
}

// var ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';

function patch(recorder, env) {
  var myenv = env || window || self;

  if (myenv['fetch']) {
    _utils.console.log('found fetch method.');
    if (!myenv['fetch']['polyfill']) {
      // basically, if it is polyfill, it means
      // that it is using XMLhttpRequest underneath,
      // then no need to patch fetch.
      var oldFetch = myenv['fetch'];

      _utils.console.log('fetch is not polyfilled so instrumenting it');

      myenv['fetch'] = (function (fetch) {
        return function (arg1, arg2) {
          return interceptor(recorder, fetch, arg1, arg2);
        };
      })(myenv['fetch']);

      var unpatch = function unpatch() {
        myenv['fetch'] = oldFetch;
      };

      return unpatch;
    } else {
      // should not patch if it is polyfilled.
      // since it would duplicate the data.
      _utils.console.log('skip patching fetch since it is polyfilled');
      return null;
    }
  } else {
    _utils.console.log('there is no fetch found');
  }
}

exports['default'] = patch;
module.exports = exports['default'];

},{"./utils":10}],5:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});
var Config = {
    DEBUG: false,
    LIB_VERSION: '1.5.1'
};

exports['default'] = Config;
module.exports = exports['default'];

},{}],6:[function(require,module,exports){
/* eslint camelcase: "off" */
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _moesifCore = require('./moesif-core');

var moesif = (0, _moesifCore.init_as_module)();

exports['default'] = moesif;
module.exports = exports['default'];

},{"./moesif-core":7}],7:[function(require,module,exports){
/* eslint camelcase: "off" */
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.init_from_snippet = init_from_snippet;
exports.init_as_module = init_as_module;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _moesif = require('./moesif');

var _moesif2 = _interopRequireDefault(_moesif);

/*
 * Moesif Browser JS Library
 *
 * Copyright 2017, Moesif Inc. All Rights Reserved
 */

// ==ClosureCompiler==
// @compilation_level ADVANCED_OPTIMIZATIONS
// @output_file_name moesif-1.0.min.js
// ==/ClosureCompiler==

/*
SIMPLE STYLE GUIDE:

this.x === public function
this._x === internal - only use within this file
this.__x === private - only use within the class

Globals should be all caps
*/

var init_type; // MODULE or SNIPPET loader
var INIT_MODULE = 0;
var INIT_SNIPPET = 1;

/*
 * Constants
 */
/** @const */var PRIMARY_INSTANCE_NAME = 'moesif';

// var DOM_LOADED = false;

function init_from_snippet() {
  init_type = INIT_SNIPPET;
  window[PRIMARY_INSTANCE_NAME] = (0, _moesif2['default'])();
}

function init_as_module() {
  init_type = INIT_MODULE;
  return (0, _moesif2['default'])();
}

},{"./moesif":8}],8:[function(require,module,exports){
/**
 * Created by Xingheng on 2/1/17.
 */

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _utils = require('./utils');

var _capture = require('./capture');

var _capture2 = _interopRequireDefault(_capture);

var _web3capture = require('./web3capture');

var _web3capture2 = _interopRequireDefault(_web3capture);

var _captureFetch = require('./captureFetch');

var _captureFetch2 = _interopRequireDefault(_captureFetch);

var _campaign = require('./campaign');

var _campaign2 = _interopRequireDefault(_campaign);

var _config = require('./config');

var _config2 = _interopRequireDefault(_config);

var MOESIF_CONSTANTS = {
  //The base Uri for API calls
  HOST: 'api.moesif.net',
  EVENT_ENDPOINT: '/v1/events',
  USER_ENDPOINT: '/v1/users',
  COMPANY_ENDPOINT: '/v1/companies',
  EVENT_BATCH_ENDPOINT: '/v1/events/batch',
  STORED_USER_ID: 'moesif_stored_user_id',
  STORED_COMPANY_ID: 'moesif_stored_company_id',
  STORED_SESSION_ID: 'moesif_stored_session_id'
};

var HTTP_PROTOCOL = 'http:' === (document && document.location.protocol) ? 'http://' : 'https://';

// http://hacks.mozilla.org/2009/07/cross-site-xmlhttprequest-with-cors/
// https://developer.mozilla.org/en-US/docs/DOM/XMLHttpRequest#withCredentials
// var USE_XHR = (window.XMLHttpRequest && 'withCredentials' in new XMLHttpRequest());

// IE<10 does not support cross-origin XHR's but script tags
// with defer won't block window.onload; ENQUEUE_REQUESTS
// should only be true for Opera<12

function isContentJson(event) {
  try {
    var contentType = event['request']['headers']['Content-Type'] || event['request']['headers']['content-type'] || event['response']['headers']['Content-Type'] || event['response']['headers']['content-type'];

    return contentType && contentType.toLowerCase().indexOf('json') > 0;
  } catch (err) {
    return false;
  }
}

function isMoesif(event) {
  return event['request']['headers']['X-Moesif-SDK'];
}

function ensureValidOptions(options) {
  if (!options) throw new Error('options are required by moesif-express middleware');
  if (!options['applicationId']) throw new Error('A moesif application id is required. Please obtain it through your settings at www.moesif.com');

  if (options['getTags'] && !_utils._.isFunction(options['getTags'])) {
    throw new Error('getTags should be a function');
  }
  if (options['getMetadata'] && !_utils._.isFunction(options['getMetadata'])) {
    throw new Error('getMetadata should be a function');
  }
  if (options['getApiVersion'] && !_utils._.isFunction(options['getApiVersion'])) {
    throw new Error('identifyUser should be a function');
  }
  if (options['maskContent'] && !_utils._.isFunction(options['maskContent'])) {
    throw new Error('maskContent should be a function');
  }
  if (options['skip'] && !_utils._.isFunction(options['skip'])) {
    throw new Error('skip should be a function');
  }
}

exports['default'] = function () {

  _utils.console.log('moesif object creator is called');

  function sendEvent(event, token, debug, callback) {
    _utils.console.log('actually sending to log event ' + _utils._.JSONEncode(event));
    var xmlhttp = new XMLHttpRequest(); // new HttpRequest instance
    xmlhttp.open('POST', HTTP_PROTOCOL + MOESIF_CONSTANTS.HOST + MOESIF_CONSTANTS.EVENT_ENDPOINT);
    xmlhttp.setRequestHeader('Content-Type', 'application/json');
    xmlhttp.setRequestHeader('X-Moesif-Application-Id', token);
    xmlhttp.setRequestHeader('X-Moesif-SDK', 'moesif-browser-js/' + _config2['default'].LIB_VERSION);
    xmlhttp.onreadystatechange = function () {
      if (xmlhttp.readyState === 4) {
        if (xmlhttp.status >= 200 && xmlhttp.status <= 300) {
          if (debug) {
            _utils.console.log('sent to moesif successfully: ' + event['request']['uri']);
          }
        } else {
          _utils.console.log('failed to sent to moesif: ' + event['request']['uri']);
          if (debug) {
            _utils.console.error(xmlhttp.statusText);
          }
          if (callback && _utils._.isFunction(callback)) {
            callback(new Error('can not sent to moesif'), event);
          }
        }
      }
    };
    xmlhttp.send(_utils._.JSONEncode(event));
  }

  function updateUser(userProfile, token, debug, callback) {
    var xmlhttp = new XMLHttpRequest(); // new HttpRequest instance
    xmlhttp.open('POST', HTTP_PROTOCOL + MOESIF_CONSTANTS.HOST + MOESIF_CONSTANTS.USER_ENDPOINT);
    xmlhttp.setRequestHeader('Content-Type', 'application/json');
    xmlhttp.setRequestHeader('X-Moesif-Application-Id', token);
    xmlhttp.setRequestHeader('X-Moesif-SDK', 'moesif-browser-js/' + _config2['default'].LIB_VERSION);
    xmlhttp.onreadystatechange = function () {
      if (xmlhttp.readyState === 4) {
        if (xmlhttp.status >= 200 && xmlhttp.status <= 300) {
          if (debug) {
            _utils.console.log('update user to moesif successfully: ' + userProfile['user_id']);
          }
        } else {
          _utils.console.log('update user to moesif failed ' + userProfile['user_id']);
          if (debug) {
            _utils.console.error(xmlhttp.statusText);
          }
          if (callback && _utils._.isFunction(callback)) {
            callback(new Error('can not update user to moesif'), null, userProfile);
          }
        }
      }
    };
    xmlhttp.send(_utils._.JSONEncode(userProfile));
  }

  function updateCompany(companyProfile, token, debug, callback) {
    var xmlhttp = new XMLHttpRequest(); // new HttpRequest instance
    xmlhttp.open('POST', HTTP_PROTOCOL + MOESIF_CONSTANTS.HOST + MOESIF_CONSTANTS.COMPANY_ENDPOINT);
    xmlhttp.setRequestHeader('Content-Type', 'application/json');
    xmlhttp.setRequestHeader('X-Moesif-Application-Id', token);
    xmlhttp.setRequestHeader('X-Moesif-SDK', 'moesif-browser-js/' + _config2['default'].LIB_VERSION);
    xmlhttp.onreadystatechange = function () {
      if (xmlhttp.readyState === 4) {
        if (xmlhttp.status >= 200 && xmlhttp.status <= 300) {
          if (debug) {
            _utils.console.log('update company to moesif successfully: ' + companyProfile['company_id']);
          }
        } else {
          _utils.console.log('update company to moesif failed ' + companyProfile['company_id']);
          if (debug) {
            _utils.console.error(xmlhttp.statusText);
          }
          if (callback && _utils._.isFunction(callback)) {
            callback(new Error('can not update company to moesif'), null, companyProfile);
          }
        }
      }
    };
    xmlhttp.send(_utils._.JSONEncode(companyProfile));
  }

  return {
    'init': function init(options) {

      if (!window) {
        _utils.console.critical('Warning, this library need to be initiated on the client side');
      }

      ensureValidOptions(options);
      var ops = {};

      ops.getTags = options['getTags'] || function () {
        return undefined;
      };
      ops.maskContent = options['maskContent'] || function (eventData) {
        return eventData;
      };

      ops.getMetadata = options['getMetadata'] || function () {
        return undefined;
      };

      ops.skip = options['skip'] || function () {
        return false;
      };

      ops.debug = options['debug'];
      ops.callback = options['callback'];
      ops.applicationId = options['applicationId'];
      ops.apiVersion = options['apiVersion'];
      ops.disableFetch = options['disableFetch'];

      ops.disableReferrer = options['disableReferrer'];
      ops.disableGclid = options['disableGclid'];
      ops.disableUtm = options['disableUtm'];

      this._options = ops;
      this._userId = localStorage.getItem(MOESIF_CONSTANTS.STORED_USER_ID);
      this._session = localStorage.getItem(MOESIF_CONSTANTS.STORED_SESSION_ID);

      this._campaign = (0, _campaign2['default'])(ops);

      _utils.console.log('moesif initiated');
      return this;
    },
    'start': function start(passedInWeb3) {
      var _self = this;

      if (this._stopRecording || this._stopWeb3Recording) {
        _utils.console.log('recording has already started, please call stop first.');
        return false;
      }

      function recorder(event) {
        _self.recordEvent(event);
      }

      _utils.console.log('moesif starting');
      this._stopRecording = (0, _capture2['default'])(recorder);

      if (!this._options.disableFetch) {
        _utils.console.log('also instrumenting fetch API');
        this._stopFetchRecording = (0, _captureFetch2['default'])(recorder);
      }
      this['useWeb3'](passedInWeb3);
      // if (passedInWeb3) {
      //   this._stopWeb3Recording = patchWeb3WithCapture(passedInWeb3, _self.recordEvent, this._options);
      // } else if (window['web3']) {
      //   // try to patch the global web3
      //   console.log('found global web3, will capture from it');
      //   this._stopWeb3Recording = patchWeb3WithCapture(window['web3'], _self.recordEvent, this._options);
      // }
      return true;
    },
    'useWeb3': function useWeb3(passedInWeb3) {
      var _self = this;

      function recorder(event) {
        _self.recordEvent(event);
      }

      if (this._stopWeb3Recording) {
        this._stopWeb3Recording();
        this._stopWeb3Recording = null;
      }
      if (passedInWeb3) {
        this._stopWeb3Recording = (0, _web3capture2['default'])(passedInWeb3, recorder, this._options);
      } else if (window['web3']) {
        // try to patch the global web3
        _utils.console.log('found global web3, will capture from it');
        this._stopWeb3Recording = (0, _web3capture2['default'])(window['web3'], recorder, this._options);
      }
      if (this._stopWeb3Recording) {
        // if function is returned it means we succeeded.
        return true;
      }
      return false;
    },
    'identifyUser': function identifyUser(userId, metadata) {
      this._userId = userId;
      if (!(this._options && this._options.applicationId)) {
        throw new Error('Init needs to be called with a valid application Id before calling identify User.');
      }
      var userObject = {
        'user_id': userId
      };

      if (metadata) {
        userObject['metadata'] = metadata;
      }
      if (this._session) {
        userObject['session_token'] = this._session;
      }
      if (this._campaign) {
        userObject['campaign'] = this._campaign;
      }

      updateUser(userObject, this._options.applicationId, this._options.debug, this._options.callback);
      localStorage.setItem(MOESIF_CONSTANTS.STORED_USER_ID, userId);
    },
    'identifyCompany': function identifyCompany(companyId, metadata, companyDomain) {
      this._companyId = companyId;
      if (!(this._options && this._options.applicationId)) {
        throw new Error('Init needs to be called with a valid application Id before calling identify User.');
      }
      var companyObject = {
        'company_id': companyId
      };

      if (companyDomain) {
        companyObject['company_domain'] = companyDomain;
      }

      if (metadata) {
        companyObject['metadata'] = metadata;
      }
      if (this._session) {
        companyObject['session_token'] = this._session;
      }
      if (this._campaign) {
        companyObject['campaign'] = this._campaign;
      }

      updateCompany(companyObject, this._options.applicationId, this._options.debug, this._options.callback);
      localStorage.setItem(MOESIF_CONSTANTS.STORED_COMPANY_ID, companyId);
    },
    'identifySession': function identifySession(session) {
      this._session = session;
      localStorage.setItem(MOESIF_CONSTANTS.STORED_SESSION_ID, session);
    },
    recordEvent: function recordEvent(event) {
      var _self = this;
      _utils.console.log('determining if should log: ' + event['request']['uri']);
      var logData = Object.assign({}, event);
      if (_self._getUserId()) {
        logData['user_id'] = _self._getUserId();
      }
      if (_self._getCompanyId()) {
        logData['company_id'] = _self._getCompanyId();
      }
      if (_self._getSession()) {
        logData['session_token'] = _self._getSession();
      }

      logData['tags'] = _self._options.getTags(event) || '';

      if (_self._options.apiVersion) {
        logData['request']['api_version'] = _self._options.apiVersion;
      }

      if (_self._options.maskContent) {
        logData = _self._options.maskContent(logData);
      }

      if (_self._options.getMetadata) {
        if (logData['metadata']) {
          var newMetadata = _self._options.getMetadata(logData);
          logData['metadata'] = Object.assign(logData['metadata'], newMetadata);
        } else {
          logData['metadata'] = _self._options.getMetadata(logData);
        }
      }

      if (!_self._options.skip(event) && !isMoesif(event)) {
        sendEvent(logData, _self._options.applicationId, _self._options.debug, _self._options.callback);
      } else {
        _utils.console.log('skipped logging for ' + event['request']['uri']);
      }
    },
    _getUserId: function _getUserId() {
      return this._userId;
    },
    _getCompanyId: function _getCompanyId() {
      return this._companyId;
    },
    _getSession: function _getSession() {
      return this._session;
    },
    'stop': function stop() {
      if (this._stopRecording) {
        this._stopRecording();
        this._stopRecording = null;
      }
      if (this._stopWeb3Recording) {
        this._stopWeb3Recording();
        this._stopWeb3Recording = null;
      }
      if (this._stopFetchRecording) {
        this._stopFetchRecording();
        this._stopFetchRecording = null;
      }
    }
  };
};

module.exports = exports['default'];

},{"./campaign":2,"./capture":3,"./captureFetch":4,"./config":5,"./utils":10,"./web3capture":12}],9:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _utils = require('./utils');

function _getReferrerStr() {
  return document && document.referrer;
}

function _getReferringDomain(referrer) {
  if (_utils._.isEmptyString(referrer)) {
    return null;
  }
  var parts = referrer.split('/');
  if (parts.length >= 3) {
    return parts[2];
  }
  return null;
}

function getReferrer() {
  var referrer = _getReferrerStr();

  if (_utils._.isEmptyString(referrer)) {
    return;
  }

  var referrerInfo = {
    'referrer': referrer,
    'referring_domain': _getReferringDomain(referrer)
  };

  return referrerInfo;
}

exports['default'] = getReferrer;
module.exports = exports['default'];

},{"./utils":10}],10:[function(require,module,exports){
/* eslint camelcase: "off", eqeqeq: "off" */
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _config = require('./config');

var _config2 = _interopRequireDefault(_config);

// since es6 imports are static and we run unit tests from the console, window won't be defined when importing this file
var win;
if (typeof window === 'undefined') {
    win = {
        navigator: {}
    };
} else {
    win = window;
}

/*
 * Saved references to long variable names, so that closure compiler can
 * minimize file size.
 */

var ArrayProto = Array.prototype,
    FuncProto = Function.prototype,
    ObjProto = Object.prototype,
    slice = ArrayProto.slice,
    toString = ObjProto.toString,
    hasOwnProperty = ObjProto.hasOwnProperty,
    windowConsole = win.console,
    navigator = win.navigator,
    document = win.document,
    userAgent = navigator.userAgent;

var nativeBind = FuncProto.bind,
    nativeForEach = ArrayProto.forEach,
    nativeIndexOf = ArrayProto.indexOf,
    nativeIsArray = Array.isArray,
    breaker = {};

var _ = {
    trim: function trim(str) {
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/Trim#Polyfill
        return str.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
    }
};

// Console override
var console = {
    /** @type {function(...[*])} */
    log: function log() {
        if (_config2['default'].DEBUG && !_.isUndefined(windowConsole) && windowConsole) {
            try {
                windowConsole.log.apply(windowConsole, arguments);
            } catch (err) {
                _.each(arguments, function (arg) {
                    windowConsole.log(arg);
                });
            }
        }
    },
    /** @type {function(...[*])} */
    error: function error() {
        if (_config2['default'].DEBUG && !_.isUndefined(windowConsole) && windowConsole) {
            var args = ['Moesif error:'].concat(_.toArray(arguments));
            try {
                windowConsole.error.apply(windowConsole, args);
            } catch (err) {
                _.each(args, function (arg) {
                    windowConsole.error(arg);
                });
            }
        }
    },
    /** @type {function(...[*])} */
    critical: function critical() {
        if (!_.isUndefined(windowConsole) && windowConsole) {
            var args = ['Moesif error:'].concat(_.toArray(arguments));
            try {
                windowConsole.error.apply(windowConsole, args);
            } catch (err) {
                _.each(args, function (arg) {
                    windowConsole.error(arg);
                });
            }
        }
    }
};

// UNDERSCORE
// Embed part of the Underscore Library
_.bind = function (func, context) {
    var args, bound;
    if (nativeBind && func.bind === nativeBind) {
        return nativeBind.apply(func, slice.call(arguments, 1));
    }
    if (!_.isFunction(func)) {
        throw new TypeError();
    }
    args = slice.call(arguments, 2);
    bound = function () {
        if (!(this instanceof bound)) {
            return func.apply(context, args.concat(slice.call(arguments)));
        }
        var ctor = {};
        ctor.prototype = func.prototype;
        var self = new ctor();
        ctor.prototype = null;
        var result = func.apply(self, args.concat(slice.call(arguments)));
        if (Object(result) === result) {
            return result;
        }
        return self;
    };
    return bound;
};

_.bind_instance_methods = function (obj) {
    for (var func in obj) {
        if (typeof obj[func] === 'function') {
            obj[func] = _.bind(obj[func], obj);
        }
    }
};

_.isEmptyString = function isEmptyString(str) {
    return !str || str.length === 0;
};

/**
 * @param {*=} obj
 * @param {function(...[*])=} iterator
 * @param {Object=} context
 */
_.each = function (obj, iterator, context) {
    if (obj === null || obj === undefined) {
        return;
    }
    if (nativeForEach && obj.forEach === nativeForEach) {
        obj.forEach(iterator, context);
    } else if (obj.length === +obj.length) {
        for (var i = 0, l = obj.length; i < l; i++) {
            if (i in obj && iterator.call(context, obj[i], i, obj) === breaker) {
                return;
            }
        }
    } else {
        for (var key in obj) {
            if (hasOwnProperty.call(obj, key)) {
                if (iterator.call(context, obj[key], key, obj) === breaker) {
                    return;
                }
            }
        }
    }
};

_.escapeHTML = function (s) {
    var escaped = s;
    if (escaped && _.isString(escaped)) {
        escaped = escaped.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }
    return escaped;
};

_.extend = function (obj) {
    _.each(slice.call(arguments, 1), function (source) {
        for (var prop in source) {
            if (source[prop] !== void 0) {
                obj[prop] = source[prop];
            }
        }
    });
    return obj;
};

_.isArray = nativeIsArray || function (obj) {
    return toString.call(obj) === '[object Array]';
};

// from a comment on http://dbj.org/dbj/?p=286
// fails on only one very rare and deliberate custom object:
// var bomb = { toString : undefined, valueOf: function(o) { return "function BOMBA!"; }};
_.isFunction = function (f) {
    try {
        return (/^\s*\bfunction\b/.test(f)
        );
    } catch (x) {
        return false;
    }
};

_.isArguments = function (obj) {
    return !!(obj && hasOwnProperty.call(obj, 'callee'));
};

_.toArray = function (iterable) {
    if (!iterable) {
        return [];
    }
    if (iterable.toArray) {
        return iterable.toArray();
    }
    if (_.isArray(iterable)) {
        return slice.call(iterable);
    }
    if (_.isArguments(iterable)) {
        return slice.call(iterable);
    }
    return _.values(iterable);
};

_.values = function (obj) {
    var results = [];
    if (obj === null) {
        return results;
    }
    _.each(obj, function (value) {
        results[results.length] = value;
    });
    return results;
};

_.identity = function (value) {
    return value;
};

_.include = function (obj, target) {
    var found = false;
    if (obj === null) {
        return found;
    }
    if (nativeIndexOf && obj.indexOf === nativeIndexOf) {
        return obj.indexOf(target) != -1;
    }
    _.each(obj, function (value) {
        if (found || (found = value === target)) {
            return breaker;
        }
    });
    return found;
};

_.includes = function (str, needle) {
    return str.indexOf(needle) !== -1;
};

// Underscore Addons
_.inherit = function (subclass, superclass) {
    subclass.prototype = new superclass();
    subclass.prototype.constructor = subclass;
    subclass.superclass = superclass.prototype;
    return subclass;
};

_.isObject = function (obj) {
    return obj === Object(obj) && !_.isArray(obj);
};

_.isEmptyObject = function (obj) {
    if (_.isObject(obj)) {
        for (var key in obj) {
            if (hasOwnProperty.call(obj, key)) {
                return false;
            }
        }
        return true;
    }
    return false;
};

_.isUndefined = function (obj) {
    return obj === void 0;
};

_.isString = function (obj) {
    return toString.call(obj) == '[object String]';
};

_.isDate = function (obj) {
    return toString.call(obj) == '[object Date]';
};

_.isNumber = function (obj) {
    return toString.call(obj) == '[object Number]';
};

_.isElement = function (obj) {
    return !!(obj && obj.nodeType === 1);
};

_.encodeDates = function (obj) {
    _.each(obj, function (v, k) {
        if (_.isDate(v)) {
            obj[k] = _.formatDate(v);
        } else if (_.isObject(v)) {
            obj[k] = _.encodeDates(v); // recurse
        }
    });
    return obj;
};

_.timestamp = function () {
    Date.now = Date.now || function () {
        return +new Date();
    };
    return Date.now();
};

_.formatDate = function (d) {
    // YYYY-MM-DDTHH:MM:SS in UTC
    function pad(n) {
        return n < 10 ? '0' + n : n;
    }
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds());
};

_.safewrap = function (f) {
    return function () {
        try {
            return f.apply(this, arguments);
        } catch (e) {
            console.critical('Implementation error. Please contact support@moesif.com.');
        }
    };
};

_.safewrap_class = function (klass, functions) {
    for (var i = 0; i < functions.length; i++) {
        klass.prototype[functions[i]] = _.safewrap(klass.prototype[functions[i]]);
    }
};

_.safewrap_instance_methods = function (obj) {
    for (var func in obj) {
        if (typeof obj[func] === 'function') {
            obj[func] = _.safewrap(obj[func]);
        }
    }
};

_.strip_empty_properties = function (p) {
    var ret = {};
    _.each(p, function (v, k) {
        if (_.isString(v) && v.length > 0) {
            ret[k] = v;
        }
    });
    return ret;
};

/*
 * this function returns a copy of object after truncating it.  If
 * passed an Array or Object it will iterate through obj and
 * truncate all the values recursively.
 */
_.truncate = function (obj, length) {
    var ret;

    if (typeof obj === 'string') {
        ret = obj.slice(0, length);
    } else if (_.isArray(obj)) {
        ret = [];
        _.each(obj, function (val) {
            ret.push(_.truncate(val, length));
        });
    } else if (_.isObject(obj)) {
        ret = {};
        _.each(obj, function (val, key) {
            ret[key] = _.truncate(val, length);
        });
    } else {
        ret = obj;
    }

    return ret;
};

_.JSONEncode = (function () {
    return function (mixed_val) {
        var value = mixed_val;
        var quote = function quote(string) {
            var escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
            var meta = { // table of character substitutions
                '\b': '\\b',
                '\t': '\\t',
                '\n': '\\n',
                '\f': '\\f',
                '\r': '\\r',
                '"': '\\"',
                '\\': '\\\\'
            };

            escapable.lastIndex = 0;
            return escapable.test(string) ? '"' + string.replace(escapable, function (a) {
                var c = meta[a];
                return typeof c === 'string' ? c : '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
            }) + '"' : '"' + string + '"';
        };

        var str = function str(key, holder) {
            var gap = '';
            var indent = '    ';
            var i = 0; // The loop counter.
            var k = ''; // The member key.
            var v = ''; // The member value.
            var length = 0;
            var mind = gap;
            var partial = [];
            var value = holder[key];

            // If the value has a toJSON method, call it to obtain a replacement value.
            if (value && typeof value === 'object' && typeof value.toJSON === 'function') {
                value = value.toJSON(key);
            }

            // What happens next depends on the value's type.
            switch (typeof value) {
                case 'string':
                    return quote(value);

                case 'number':
                    // JSON numbers must be finite. Encode non-finite numbers as null.
                    return isFinite(value) ? String(value) : 'null';

                case 'boolean':
                case 'null':
                    // If the value is a boolean or null, convert it to a string. Note:
                    // typeof null does not produce 'null'. The case is included here in
                    // the remote chance that this gets fixed someday.

                    return String(value);

                case 'object':
                    // If the type is 'object', we might be dealing with an object or an array or
                    // null.
                    // Due to a specification blunder in ECMAScript, typeof null is 'object',
                    // so watch out for that case.
                    if (!value) {
                        return 'null';
                    }

                    // Make an array to hold the partial results of stringifying this object value.
                    gap += indent;
                    partial = [];

                    // Is the value an array?
                    if (toString.apply(value) === '[object Array]') {
                        // The value is an array. Stringify every element. Use null as a placeholder
                        // for non-JSON values.

                        length = value.length;
                        for (i = 0; i < length; i += 1) {
                            partial[i] = str(i, value) || 'null';
                        }

                        // Join all of the elements together, separated with commas, and wrap them in
                        // brackets.
                        v = partial.length === 0 ? '[]' : gap ? '[\n' + gap + partial.join(',\n' + gap) + '\n' + mind + ']' : '[' + partial.join(',') + ']';
                        gap = mind;
                        return v;
                    }

                    // Iterate through all of the keys in the object.
                    for (k in value) {
                        if (hasOwnProperty.call(value, k)) {
                            v = str(k, value);
                            if (v) {
                                partial.push(quote(k) + (gap ? ': ' : ':') + v);
                            }
                        }
                    }

                    // Join all of the member texts together, separated with commas,
                    // and wrap them in braces.
                    v = partial.length === 0 ? '{}' : gap ? '{' + partial.join(',') + '' + mind + '}' : '{' + partial.join(',') + '}';
                    gap = mind;
                    return v;
            }
        };

        // Make a fake root object containing our value under the key of ''.
        // Return the result of stringifying the value.
        return str('', {
            '': value
        });
    };
})();

_.JSONDecode = (function () {
    // https://github.com/douglascrockford/JSON-js/blob/master/json_parse.js
    var at,
        // The index of the current character
    ch,
        // The current character
    escapee = {
        '"': '"',
        '\\': '\\',
        '/': '/',
        'b': '\b',
        'f': '\f',
        'n': '\n',
        'r': '\r',
        't': '\t'
    },
        text,
        error = function error(m) {
        throw {
            name: 'SyntaxError',
            message: m,
            at: at,
            text: text
        };
    },
        next = function next(c) {
        // If a c parameter is provided, verify that it matches the current character.
        if (c && c !== ch) {
            error('Expected \'' + c + '\' instead of \'' + ch + '\'');
        }
        // Get the next character. When there are no more characters,
        // return the empty string.
        ch = text.charAt(at);
        at += 1;
        return ch;
    },
        number = function number() {
        // Parse a number value.
        var number,
            string = '';

        if (ch === '-') {
            string = '-';
            next('-');
        }
        while (ch >= '0' && ch <= '9') {
            string += ch;
            next();
        }
        if (ch === '.') {
            string += '.';
            while (next() && ch >= '0' && ch <= '9') {
                string += ch;
            }
        }
        if (ch === 'e' || ch === 'E') {
            string += ch;
            next();
            if (ch === '-' || ch === '+') {
                string += ch;
                next();
            }
            while (ch >= '0' && ch <= '9') {
                string += ch;
                next();
            }
        }
        number = +string;
        if (!isFinite(number)) {
            error('Bad number');
        } else {
            return number;
        }
    },
        string = function string() {
        // Parse a string value.
        var hex,
            i,
            string = '',
            uffff;
        // When parsing for string values, we must look for " and \ characters.
        if (ch === '"') {
            while (next()) {
                if (ch === '"') {
                    next();
                    return string;
                }
                if (ch === '\\') {
                    next();
                    if (ch === 'u') {
                        uffff = 0;
                        for (i = 0; i < 4; i += 1) {
                            hex = parseInt(next(), 16);
                            if (!isFinite(hex)) {
                                break;
                            }
                            uffff = uffff * 16 + hex;
                        }
                        string += String.fromCharCode(uffff);
                    } else if (typeof escapee[ch] === 'string') {
                        string += escapee[ch];
                    } else {
                        break;
                    }
                } else {
                    string += ch;
                }
            }
        }
        error('Bad string');
    },
        white = function white() {
        // Skip whitespace.
        while (ch && ch <= ' ') {
            next();
        }
    },
        word = function word() {
        // true, false, or null.
        switch (ch) {
            case 't':
                next('t');
                next('r');
                next('u');
                next('e');
                return true;
            case 'f':
                next('f');
                next('a');
                next('l');
                next('s');
                next('e');
                return false;
            case 'n':
                next('n');
                next('u');
                next('l');
                next('l');
                return null;
        }
        error('Unexpected "' + ch + '"');
    },
        value,
        // Placeholder for the value function.
    array = function array() {
        // Parse an array value.
        var array = [];

        if (ch === '[') {
            next('[');
            white();
            if (ch === ']') {
                next(']');
                return array; // empty array
            }
            while (ch) {
                array.push(value());
                white();
                if (ch === ']') {
                    next(']');
                    return array;
                }
                next(',');
                white();
            }
        }
        error('Bad array');
    },
        object = function object() {
        // Parse an object value.
        var key,
            object = {};

        if (ch === '{') {
            next('{');
            white();
            if (ch === '}') {
                next('}');
                return object; // empty object
            }
            while (ch) {
                key = string();
                white();
                next(':');
                if (Object.hasOwnProperty.call(object, key)) {
                    error('Duplicate key "' + key + '"');
                }
                object[key] = value();
                white();
                if (ch === '}') {
                    next('}');
                    return object;
                }
                next(',');
                white();
            }
        }
        error('Bad object');
    };

    value = function () {
        // Parse a JSON value. It could be an object, an array, a string,
        // a number, or a word.
        white();
        switch (ch) {
            case '{':
                return object();
            case '[':
                return array();
            case '"':
                return string();
            case '-':
                return number();
            default:
                return ch >= '0' && ch <= '9' ? number() : word();
        }
    };

    // Return the json_parse function. It will have access to all of the
    // above functions and variables.
    return function (source) {
        var result;

        text = source;
        at = 0;
        ch = ' ';
        result = value();
        white();
        if (ch) {
            error('Syntax error');
        }

        return result;
    };
})();

_.base64Encode = function (data) {
    var b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    var o1,
        o2,
        o3,
        h1,
        h2,
        h3,
        h4,
        bits,
        i = 0,
        ac = 0,
        enc = '',
        tmp_arr = [];

    if (!data) {
        return data;
    }

    data = _.utf8Encode(data);

    do {
        // pack three octets into four hexets
        o1 = data.charCodeAt(i++);
        o2 = data.charCodeAt(i++);
        o3 = data.charCodeAt(i++);

        bits = o1 << 16 | o2 << 8 | o3;

        h1 = bits >> 18 & 0x3f;
        h2 = bits >> 12 & 0x3f;
        h3 = bits >> 6 & 0x3f;
        h4 = bits & 0x3f;

        // use hexets to index into b64, and append result to encoded string
        tmp_arr[ac++] = b64.charAt(h1) + b64.charAt(h2) + b64.charAt(h3) + b64.charAt(h4);
    } while (i < data.length);

    enc = tmp_arr.join('');

    switch (data.length % 3) {
        case 1:
            enc = enc.slice(0, -2) + '==';
            break;
        case 2:
            enc = enc.slice(0, -1) + '=';
            break;
    }

    return enc;
};

_.utf8Encode = function (string) {
    string = (string + '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    var utftext = '',
        start,
        end;
    var stringl = 0,
        n;

    start = end = 0;
    stringl = string.length;

    for (n = 0; n < stringl; n++) {
        var c1 = string.charCodeAt(n);
        var enc = null;

        if (c1 < 128) {
            end++;
        } else if (c1 > 127 && c1 < 2048) {
            enc = String.fromCharCode(c1 >> 6 | 192, c1 & 63 | 128);
        } else {
            enc = String.fromCharCode(c1 >> 12 | 224, c1 >> 6 & 63 | 128, c1 & 63 | 128);
        }
        if (enc !== null) {
            if (end > start) {
                utftext += string.substring(start, end);
            }
            utftext += enc;
            start = end = n + 1;
        }
    }

    if (end > start) {
        utftext += string.substring(start, string.length);
    }

    return utftext;
};

_.UUID = (function () {

    // Time/ticks information
    // 1*new Date() is a cross browser version of Date.now()
    var T = function T() {
        var d = 1 * new Date(),
            i = 0;

        // this while loop figures how many browser ticks go by
        // before 1*new Date() returns a new number, ie the amount
        // of ticks that go by per millisecond
        while (d == 1 * new Date()) {
            i++;
        }

        return d.toString(16) + i.toString(16);
    };

    // Math.Random entropy
    var R = function R() {
        return Math.random().toString(16).replace('.', '');
    };

    // User agent entropy
    // This function takes the user agent string, and then xors
    // together each sequence of 8 bytes.  This produces a final
    // sequence of 8 bytes which it returns as hex.
    var UA = function UA() {
        var ua = userAgent,
            i,
            ch,
            buffer = [],
            ret = 0;

        function xor(result, byte_array) {
            var j,
                tmp = 0;
            for (j = 0; j < byte_array.length; j++) {
                tmp |= buffer[j] << j * 8;
            }
            return result ^ tmp;
        }

        for (i = 0; i < ua.length; i++) {
            ch = ua.charCodeAt(i);
            buffer.unshift(ch & 0xFF);
            if (buffer.length >= 4) {
                ret = xor(ret, buffer);
                buffer = [];
            }
        }

        if (buffer.length > 0) {
            ret = xor(ret, buffer);
        }

        return ret.toString(16);
    };

    return function () {
        var se = (screen.height * screen.width).toString(16);
        return T() + '-' + R() + '-' + UA() + '-' + se + '-' + T();
    };
})();

// _.isBlockedUA()
// This is to block various web spiders from executing our JS and
// sending false tracking data
_.isBlockedUA = function (ua) {
    if (/(google web preview|baiduspider|yandexbot|bingbot|googlebot|yahoo! slurp)/i.test(ua)) {
        return true;
    }
    return false;
};

/**
 * @param {Object=} formdata
 * @param {string=} arg_separator
 */
_.HTTPBuildQuery = function (formdata, arg_separator) {
    var use_val,
        use_key,
        tmp_arr = [];

    if (_.isUndefined(arg_separator)) {
        arg_separator = '&';
    }

    _.each(formdata, function (val, key) {
        use_val = encodeURIComponent(val.toString());
        use_key = encodeURIComponent(key);
        tmp_arr[tmp_arr.length] = use_key + '=' + use_val;
    });

    return tmp_arr.join(arg_separator);
};

_.getQueryParamByName = function (name, query) {
    // expects a name
    // and a query string. aka location part.
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(query);
    return results === null ? undefined : decodeURIComponent(results[1].replace(/\+/g, ' '));
};

_.getQueryParam = function (url, param) {
    // Expects a raw URL
    param = param.replace(/[\[]/, '\\\[').replace(/[\]]/, '\\\]');
    var regexS = '[\\?&]' + param + '=([^&#]*)',
        regex = new RegExp(regexS),
        results = regex.exec(url);
    if (results === null || results && typeof results[1] !== 'string' && results[1].length) {
        return '';
    } else {
        return decodeURIComponent(results[1]).replace(/\+/g, ' ');
    }
};

_.getHashParam = function (hash, param) {
    var matches = hash.match(new RegExp(param + '=([^&]*)'));
    return matches ? matches[1] : null;
};

// _.cookie
// Methods partially borrowed from quirksmode.org/js/cookies.html
_.cookie = {
    get: function get(name) {
        var nameEQ = name + '=';
        var ca = document.cookie.split(';');
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) == ' ') {
                c = c.substring(1, c.length);
            }
            if (c.indexOf(nameEQ) === 0) {
                return decodeURIComponent(c.substring(nameEQ.length, c.length));
            }
        }
        return null;
    },

    parse: function parse(name) {
        var cookie;
        try {
            cookie = _.JSONDecode(_.cookie.get(name)) || {};
        } catch (err) {
            // noop
        }
        return cookie;
    },

    set_seconds: function set_seconds(name, value, seconds, cross_subdomain, is_secure) {
        var cdomain = '',
            expires = '',
            secure = '';

        if (cross_subdomain) {
            var matches = document.location.hostname.match(/[a-z0-9][a-z0-9\-]+\.[a-z\.]{2,6}$/i),
                domain = matches ? matches[0] : '';

            cdomain = domain ? '; domain=.' + domain : '';
        }

        if (seconds) {
            var date = new Date();
            date.setTime(date.getTime() + seconds * 1000);
            expires = '; expires=' + date.toGMTString();
        }

        if (is_secure) {
            secure = '; secure';
        }

        document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/' + cdomain + secure;
    },

    set: function set(name, value, days, cross_subdomain, is_secure) {
        var cdomain = '',
            expires = '',
            secure = '';

        if (cross_subdomain) {
            var matches = document.location.hostname.match(/[a-z0-9][a-z0-9\-]+\.[a-z\.]{2,6}$/i),
                domain = matches ? matches[0] : '';

            cdomain = domain ? '; domain=.' + domain : '';
        }

        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
            expires = '; expires=' + date.toGMTString();
        }

        if (is_secure) {
            secure = '; secure';
        }

        var new_cookie_val = name + '=' + encodeURIComponent(value) + expires + '; path=/' + cdomain + secure;
        document.cookie = new_cookie_val;
        return new_cookie_val;
    },

    remove: function remove(name, cross_subdomain) {
        _.cookie.set(name, '', -1, cross_subdomain);
    }
};

// _.localStorage
_.localStorage = {
    error: function error(msg) {
        console.error('localStorage error: ' + msg);
    },

    get: function get(name) {
        try {
            return window.localStorage.getItem(name);
        } catch (err) {
            _.localStorage.error(err);
        }
        return null;
    },

    parse: function parse(name) {
        try {
            return _.JSONDecode(_.localStorage.get(name)) || {};
        } catch (err) {
            // noop
        }
        return null;
    },

    set: function set(name, value) {
        try {
            window.localStorage.setItem(name, value);
        } catch (err) {
            _.localStorage.error(err);
        }
    },

    remove: function remove(name) {
        try {
            window.localStorage.removeItem(name);
        } catch (err) {
            _.localStorage.error(err);
        }
    }
};

_.dom_query = (function () {
    /* document.getElementsBySelector(selector)
    - returns an array of element objects from the current document
    matching the CSS selector. Selectors can contain element names,
    class names and ids and can be nested. For example:
     elements = document.getElementsBySelector('div#main p a.external')
     Will return an array of all 'a' elements with 'external' in their
    class attribute that are contained inside 'p' elements that are
    contained inside the 'div' element which has id="main"
     New in version 0.4: Support for CSS2 and CSS3 attribute selectors:
    See http://www.w3.org/TR/css3-selectors/#attribute-selectors
     Version 0.4 - Simon Willison, March 25th 2003
    -- Works in Phoenix 0.5, Mozilla 1.3, Opera 7, Internet Explorer 6, Internet Explorer 5 on Windows
    -- Opera 7 fails
     Version 0.5 - Carl Sverre, Jan 7th 2013
    -- Now uses jQuery-esque `hasClass` for testing class name
    equality.  This fixes a bug related to '-' characters being
    considered not part of a 'word' in regex.
    */

    function getAllChildren(e) {
        // Returns all children of element. Workaround required for IE5/Windows. Ugh.
        return e.all ? e.all : e.getElementsByTagName('*');
    }

    var bad_whitespace = /[\t\r\n]/g;

    function hasClass(elem, selector) {
        var className = ' ' + selector + ' ';
        return (' ' + elem.className + ' ').replace(bad_whitespace, ' ').indexOf(className) >= 0;
    }

    function getElementsBySelector(selector) {
        // Attempt to fail gracefully in lesser browsers
        if (!document.getElementsByTagName) {
            return [];
        }
        // Split selector in to tokens
        var tokens = selector.split(' ');
        var token, bits, tagName, found, foundCount, i, j, k, elements, currentContextIndex;
        var currentContext = [document];
        for (i = 0; i < tokens.length; i++) {
            token = tokens[i].replace(/^\s+/, '').replace(/\s+$/, '');
            if (token.indexOf('#') > -1) {
                // Token is an ID selector
                bits = token.split('#');
                tagName = bits[0];
                var id = bits[1];
                var element = document.getElementById(id);
                if (!element || tagName && element.nodeName.toLowerCase() != tagName) {
                    // element not found or tag with that ID not found, return false
                    return [];
                }
                // Set currentContext to contain just this element
                currentContext = [element];
                continue; // Skip to next token
            }
            if (token.indexOf('.') > -1) {
                // Token contains a class selector
                bits = token.split('.');
                tagName = bits[0];
                var className = bits[1];
                if (!tagName) {
                    tagName = '*';
                }
                // Get elements matching tag, filter them for class selector
                found = [];
                foundCount = 0;
                for (j = 0; j < currentContext.length; j++) {
                    if (tagName == '*') {
                        elements = getAllChildren(currentContext[j]);
                    } else {
                        elements = currentContext[j].getElementsByTagName(tagName);
                    }
                    for (k = 0; k < elements.length; k++) {
                        found[foundCount++] = elements[k];
                    }
                }
                currentContext = [];
                currentContextIndex = 0;
                for (j = 0; j < found.length; j++) {
                    if (found[j].className && _.isString(found[j].className) && // some SVG elements have classNames which are not strings
                    hasClass(found[j], className)) {
                        currentContext[currentContextIndex++] = found[j];
                    }
                }
                continue; // Skip to next token
            }
            // Code to deal with attribute selectors
            var token_match = token.match(/^(\w*)\[(\w+)([=~\|\^\$\*]?)=?"?([^\]"]*)"?\]$/);
            if (token_match) {
                tagName = token_match[1];
                var attrName = token_match[2];
                var attrOperator = token_match[3];
                var attrValue = token_match[4];
                if (!tagName) {
                    tagName = '*';
                }
                // Grab all of the tagName elements within current context
                found = [];
                foundCount = 0;
                for (j = 0; j < currentContext.length; j++) {
                    if (tagName == '*') {
                        elements = getAllChildren(currentContext[j]);
                    } else {
                        elements = currentContext[j].getElementsByTagName(tagName);
                    }
                    for (k = 0; k < elements.length; k++) {
                        found[foundCount++] = elements[k];
                    }
                }
                currentContext = [];
                currentContextIndex = 0;
                var checkFunction; // This function will be used to filter the elements
                switch (attrOperator) {
                    case '=':
                        // Equality
                        checkFunction = function (e) {
                            return e.getAttribute(attrName) == attrValue;
                        };
                        break;
                    case '~':
                        // Match one of space seperated words
                        checkFunction = function (e) {
                            return e.getAttribute(attrName).match(new RegExp('\\b' + attrValue + '\\b'));
                        };
                        break;
                    case '|':
                        // Match start with value followed by optional hyphen
                        checkFunction = function (e) {
                            return e.getAttribute(attrName).match(new RegExp('^' + attrValue + '-?'));
                        };
                        break;
                    case '^':
                        // Match starts with value
                        checkFunction = function (e) {
                            return e.getAttribute(attrName).indexOf(attrValue) === 0;
                        };
                        break;
                    case '$':
                        // Match ends with value - fails with "Warning" in Opera 7
                        checkFunction = function (e) {
                            return e.getAttribute(attrName).lastIndexOf(attrValue) == e.getAttribute(attrName).length - attrValue.length;
                        };
                        break;
                    case '*':
                        // Match ends with value
                        checkFunction = function (e) {
                            return e.getAttribute(attrName).indexOf(attrValue) > -1;
                        };
                        break;
                    default:
                        // Just test for existence of attribute
                        checkFunction = function (e) {
                            return e.getAttribute(attrName);
                        };
                }
                currentContext = [];
                currentContextIndex = 0;
                for (j = 0; j < found.length; j++) {
                    if (checkFunction(found[j])) {
                        currentContext[currentContextIndex++] = found[j];
                    }
                }
                // alert('Attribute Selector: '+tagName+' '+attrName+' '+attrOperator+' '+attrValue);
                continue; // Skip to next token
            }
            // If we get here, token is JUST an element (not a class or ID selector)
            tagName = token;
            found = [];
            foundCount = 0;
            for (j = 0; j < currentContext.length; j++) {
                elements = currentContext[j].getElementsByTagName(tagName);
                for (k = 0; k < elements.length; k++) {
                    found[foundCount++] = elements[k];
                }
            }
            currentContext = found;
        }
        return currentContext;
    }

    return function (query) {
        if (_.isElement(query)) {
            return [query];
        } else if (_.isObject(query) && !_.isUndefined(query.length)) {
            return query;
        } else {
            return getElementsBySelector.call(this, query);
        }
    };
})();

_.info = {
    campaignParams: function campaignParams() {
        var campaign_keywords = 'utm_source utm_medium utm_campaign utm_content utm_term'.split(' '),
            kw = '',
            params = {};
        _.each(campaign_keywords, function (kwkey) {
            kw = _.getQueryParam(document.URL, kwkey);
            if (kw.length) {
                params[kwkey] = kw;
            }
        });

        return params;
    },

    searchEngine: function searchEngine(referrer) {
        if (referrer.search('https?://(.*)google.([^/?]*)') === 0) {
            return 'google';
        } else if (referrer.search('https?://(.*)bing.com') === 0) {
            return 'bing';
        } else if (referrer.search('https?://(.*)yahoo.com') === 0) {
            return 'yahoo';
        } else if (referrer.search('https?://(.*)duckduckgo.com') === 0) {
            return 'duckduckgo';
        } else {
            return null;
        }
    },

    searchInfo: function searchInfo(referrer) {
        var search = _.info.searchEngine(referrer),
            param = search != 'yahoo' ? 'q' : 'p',
            ret = {};

        if (search !== null) {
            ret['$search_engine'] = search;

            var keyword = _.getQueryParam(referrer, param);
            if (keyword.length) {
                ret['mp_keyword'] = keyword;
            }
        }

        return ret;
    },

    /**
     * This function detects which browser is running this script.
     * The order of the checks are important since many user agents
     * include key words used in later checks.
     */
    browser: function browser(user_agent, vendor, opera) {
        vendor = vendor || ''; // vendor is undefined for at least IE9
        if (opera || _.includes(user_agent, ' OPR/')) {
            if (_.includes(user_agent, 'Mini')) {
                return 'Opera Mini';
            }
            return 'Opera';
        } else if (/(BlackBerry|PlayBook|BB10)/i.test(user_agent)) {
            return 'BlackBerry';
        } else if (_.includes(user_agent, 'IEMobile') || _.includes(user_agent, 'WPDesktop')) {
            return 'Internet Explorer Mobile';
        } else if (_.includes(user_agent, 'Edge')) {
            return 'Microsoft Edge';
        } else if (_.includes(user_agent, 'FBIOS')) {
            return 'Facebook Mobile';
        } else if (_.includes(user_agent, 'Chrome')) {
            return 'Chrome';
        } else if (_.includes(user_agent, 'CriOS')) {
            return 'Chrome iOS';
        } else if (_.includes(user_agent, 'UCWEB') || _.includes(user_agent, 'UCBrowser')) {
            return 'UC Browser';
        } else if (_.includes(user_agent, 'FxiOS')) {
            return 'Firefox iOS';
        } else if (_.includes(vendor, 'Apple')) {
            if (_.includes(user_agent, 'Mobile')) {
                return 'Mobile Safari';
            }
            return 'Safari';
        } else if (_.includes(user_agent, 'Android')) {
            return 'Android Mobile';
        } else if (_.includes(user_agent, 'Konqueror')) {
            return 'Konqueror';
        } else if (_.includes(user_agent, 'Firefox')) {
            return 'Firefox';
        } else if (_.includes(user_agent, 'MSIE') || _.includes(user_agent, 'Trident/')) {
            return 'Internet Explorer';
        } else if (_.includes(user_agent, 'Gecko')) {
            return 'Mozilla';
        } else {
            return '';
        }
    },

    /**
     * This function detects which browser version is running this script,
     * parsing major and minor version (e.g., 42.1). User agent strings from:
     * http://www.useragentstring.com/pages/useragentstring.php
     */
    browserVersion: function browserVersion(userAgent, vendor, opera) {
        var browser = _.info.browser(userAgent, vendor, opera);
        var versionRegexs = {
            'Internet Explorer Mobile': /rv:(\d+(\.\d+)?)/,
            'Microsoft Edge': /Edge\/(\d+(\.\d+)?)/,
            'Chrome': /Chrome\/(\d+(\.\d+)?)/,
            'Chrome iOS': /CriOS\/(\d+(\.\d+)?)/,
            'UC Browser': /(UCBrowser|UCWEB)\/(\d+(\.\d+)?)/,
            'Safari': /Version\/(\d+(\.\d+)?)/,
            'Mobile Safari': /Version\/(\d+(\.\d+)?)/,
            'Opera': /(Opera|OPR)\/(\d+(\.\d+)?)/,
            'Firefox': /Firefox\/(\d+(\.\d+)?)/,
            'Firefox iOS': /FxiOS\/(\d+(\.\d+)?)/,
            'Konqueror': /Konqueror:(\d+(\.\d+)?)/,
            'BlackBerry': /BlackBerry (\d+(\.\d+)?)/,
            'Android Mobile': /android\s(\d+(\.\d+)?)/,
            'Internet Explorer': /(rv:|MSIE )(\d+(\.\d+)?)/,
            'Mozilla': /rv:(\d+(\.\d+)?)/
        };
        var regex = versionRegexs[browser];
        if (regex === undefined) {
            return null;
        }
        var matches = userAgent.match(regex);
        if (!matches) {
            return null;
        }
        return parseFloat(matches[matches.length - 2]);
    },

    os: function os() {
        var a = userAgent;
        if (/Windows/i.test(a)) {
            if (/Phone/.test(a) || /WPDesktop/.test(a)) {
                return 'Windows Phone';
            }
            return 'Windows';
        } else if (/(iPhone|iPad|iPod)/.test(a)) {
            return 'iOS';
        } else if (/Android/.test(a)) {
            return 'Android';
        } else if (/(BlackBerry|PlayBook|BB10)/i.test(a)) {
            return 'BlackBerry';
        } else if (/Mac/i.test(a)) {
            return 'Mac OS X';
        } else if (/Linux/.test(a)) {
            return 'Linux';
        } else {
            return '';
        }
    },

    device: function device(user_agent) {
        if (/Windows Phone/i.test(user_agent) || /WPDesktop/.test(user_agent)) {
            return 'Windows Phone';
        } else if (/iPad/.test(user_agent)) {
            return 'iPad';
        } else if (/iPod/.test(user_agent)) {
            return 'iPod Touch';
        } else if (/iPhone/.test(user_agent)) {
            return 'iPhone';
        } else if (/(BlackBerry|PlayBook|BB10)/i.test(user_agent)) {
            return 'BlackBerry';
        } else if (/Android/.test(user_agent)) {
            return 'Android';
        } else {
            return '';
        }
    },

    referringDomain: function referringDomain(referrer) {
        var split = referrer.split('/');
        if (split.length >= 3) {
            return split[2];
        }
        return '';
    },

    properties: function properties() {
        return _.extend(_.strip_empty_properties({
            '$os': _.info.os(),
            '$browser': _.info.browser(userAgent, navigator.vendor, window.opera),
            '$referrer': document.referrer,
            '$referring_domain': _.info.referringDomain(document.referrer),
            '$device': _.info.device(userAgent)
        }), {
            '$current_url': window.location.href,
            '$browser_version': _.info.browserVersion(userAgent, navigator.vendor, window.opera),
            '$screen_height': screen.height,
            '$screen_width': screen.width,
            'mp_lib': 'web',
            '$lib_version': _config2['default'].LIB_VERSION
        });
    },

    people_properties: function people_properties() {
        return _.extend(_.strip_empty_properties({
            '$os': _.info.os(),
            '$browser': _.info.browser(userAgent, navigator.vendor, window.opera)
        }), {
            '$browser_version': _.info.browserVersion(userAgent, navigator.vendor, window.opera)
        });
    },

    pageviewInfo: function pageviewInfo(page) {
        return _.strip_empty_properties({
            'mp_page': page,
            'mp_referrer': document.referrer,
            'mp_browser': _.info.browser(userAgent, navigator.vendor, window.opera),
            'mp_platform': _.info.os()
        });
    }
};

// EXPORTS (for closure compiler)
_['toArray'] = _.toArray;
_['isObject'] = _.isObject;
_['JSONEncode'] = _.JSONEncode;
_['JSONDecode'] = _.JSONDecode;
_['isBlockedUA'] = _.isBlockedUA;
_['isEmptyObject'] = _.isEmptyObject;
_['isEmptyString'] = _.isEmptyString;
_['each'] = _.each;
_['info'] = _.info;
_['info']['device'] = _.info.device;
_['info']['browser'] = _.info.browser;
_['info']['properties'] = _.info.properties;

exports._ = _;
exports.userAgent = userAgent;
exports.console = console;

},{"./config":5}],11:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _utils = require('./utils');

var Constants = { // UTM Params
  UTM_SOURCE: 'utm_source',
  UTM_MEDIUM: 'utm_medium',
  UTM_CAMPAIGN: 'utm_campaign',
  UTM_TERM: 'utm_term',
  UTM_CONTENT: 'utm_content'
};

function _getUrlParams() {
  return location && location.search;
}

function getUtmData(rawCookie, query) {
  // Translate the utmz cookie format into url query string format.
  var cookie = rawCookie ? '?' + rawCookie.split('.').slice(-1)[0].replace(/\|/g, '&') : '';

  _utils.console.log('cookie');
  _utils.console.log(cookie);

  var fetchParam = function fetchParam(queryName, query, cookieName, cookie) {
    return _utils._.getQueryParamByName(queryName, query) || _utils._.getQueryParamByName(cookieName, cookie);
  };

  var utmSource = fetchParam(Constants.UTM_SOURCE, query, 'utmcsr', cookie);
  var utmMedium = fetchParam(Constants.UTM_MEDIUM, query, 'utmcmd', cookie);
  var utmCampaign = fetchParam(Constants.UTM_CAMPAIGN, query, 'utmccn', cookie);
  var utmTerm = fetchParam(Constants.UTM_TERM, query, 'utmctr', cookie);
  var utmContent = fetchParam(Constants.UTM_CONTENT, query, 'utmcct', cookie);

  var utmData = {};
  var addIfNotNull = function addIfNotNull(key, value) {
    if (!_utils._.isEmptyString(value)) {
      utmData[key] = value;
    }
  };

  addIfNotNull(Constants.UTM_SOURCE, utmSource);
  addIfNotNull(Constants.UTM_MEDIUM, utmMedium);
  addIfNotNull(Constants.UTM_CAMPAIGN, utmCampaign);
  addIfNotNull(Constants.UTM_TERM, utmTerm);
  addIfNotNull(Constants.UTM_CONTENT, utmContent);

  return utmData;
}

function getUtm(queryParams, cookieParams) {
  queryParams = _getUrlParams();
  cookieParams = _utils._.cookie.get('__utmz');
  var utmProperties = getUtmData(cookieParams, queryParams);
  return utmProperties;
}

exports['default'] = getUtm;
module.exports = exports['default'];

},{"./utils":10}],12:[function(require,module,exports){
/**
 * Created by Xingheng on 1/31/17.
 */

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _utils = require('./utils');

function computeUrl(provider) {
  if (provider && provider.host) {
    return provider.host;
  }

  return '/';
}

function createEventModel(provider, startTime, endTime, payload, result, error) {
  // JSONRPC will always be POST.
  var requestModel = {
    'uri': computeUrl(provider),
    'verb': 'POST',
    'time': startTime,
    'headers': {}
  };

  if (provider['headers']) {
    var hdrs = {};

    _utils._['each'](provider['headers'], function (item) {
      hdrs[item['name']] = item['value'];
    });

    requestModel['headers'] = hdrs;
  }

  if (payload) {
    if (typeof payload === 'string') {
      _utils.console.log('request post data is string');
      _utils.console.log(payload);
      try {
        requestModel['body'] = _utils._.JSONDecode(payload);
      } catch (err) {
        _utils.console.log('JSON decode failed');
        _utils.console.log(err);
        requestModel['transfer_encoding'] = 'base64';
        requestModel['body'] = _utils._.base64Encode(payload);
      }
    } else if (typeof payload === 'object' || Array.isArray(payload) || typeof payload === 'number' || typeof postData === 'boolean') {
      requestModel['body'] = payload;
    }
  }

  // var responseHeaders = parseResponseHeaders(this.getAllResponseHeaders());

  var responseModel = {
    'status': 200,
    // it is always 200 for JSON RPC.
    'time': endTime,
    'headers': {}
  };

  if (result) {
    // responseText is string or null
    responseModel['body'] = result;
    // if (isJsonHeader(responseHeaders) || isStartJson(this.responseText)) {
    //   responseModel['body'] = parseBody(this.responseText);
    // } else {
    //   responseModel['transfer_encoding'] = 'base64';
    //   responseModel['body'] = _.base64Encode(this.responseText);
    // }
  } else if (error) {
      responseModel['body'] = {
        'error': error
      };
    }

  var event = {
    'request': requestModel,
    'response': responseModel,
    'metadata': {
      '_web3': {
        'via_web3_provider': true,
        'path': provider['path'],
        'host': provider['host']
      }
    }
  };

  if (provider['isMetaMask']) {
    event['metadata']['_web3']['is_metamask'] = true;
  }

  return event;
}

/**
 * @param recorder
 * @returns {undoPatch}
 *
 * The recorder is a function that takes an Event and records it.
 *
 */
function captureWeb3Requests(myWeb3, recorder, options) {
  if (myWeb3['currentProvider']) {
    _utils.console.log('found my currentProvider, patching it');
    var CPDR = myWeb3['currentProvider'];

    var send = CPDR['send'];
    var sendAsync = CPDR['sendAsync'];

    CPDR['send'] = function (payload) {
      _utils.console.log('patched send is called');
      _utils.console.log(payload);
      var _startTime = new Date().toISOString();
      var result = send.apply(CPDR, arguments);

      _utils.console.log('patch send result is back');
      _utils.console.log(result);
      var _endTime = new Date().toISOString();
      if (recorder) {
        recorder(createEventModel(CPDR, _startTime, _endTime, payload, result));
      }

      return result;
    };

    CPDR['sendAsync'] = function (payload, callback) {
      _utils.console.log('patched sendAsync is called');
      _utils.console.log(payload);
      var _startTime = new Date().toISOString();
      var provider = CPDR;

      var _callback = function _callback(err, result) {
        var _endTime = new Date().toISOString();

        _utils.console.log('inside patched callback');
        _utils.console.log(result);
        if (recorder) {
          _utils.console.log('about to record event');
          recorder(createEventModel(provider, _startTime, _endTime, payload, result, err));
        }

        _utils.console.log('triggering original callback');

        callback(err, result);
      };

      _utils.console.log(payload);
      sendAsync.apply(CPDR, [payload, _callback]);
    };

    var undoPatch = function undoPatch() {
      CPDR.send = send;
      CPDR.sendAsync = sendAsync;
    };
    return undoPatch;
  }
  return null;
  // so caller have a handle to undo the patch if needed.
}

exports['default'] = captureWeb3Requests;
module.exports = exports['default'];

},{"./utils":10}]},{},[1]);
