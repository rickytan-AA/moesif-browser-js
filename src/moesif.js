/**
 * Created by Xingheng on 2/1/17.
 */

import { _, console, userAgent, localStorageSupported, JSONStringify } from './utils';
import patchAjaxWithCapture from './capture';
import patchWeb3WithCapture from './web3capture';
import patchFetchWithCapture from './captureFetch';
import getCampaignData from './campaign';
import Config from './config';
import { RequestBatcher } from './request-batcher';

var MOESIF_CONSTANTS = {
  //The base Uri for API calls
  HOST: 'api.moesif.net',
  EVENT_ENDPOINT: '/v1/events',
  EVENT_BATCH_ENDPOINT: '/v1/events/batch',
  ACTION_ENDPOINT: '/v1/actions',
  ACTION_BATCH_ENDPOINT: '/v1/actions/batch',
  USER_ENDPOINT: '/v1/users',
  COMPANY_ENDPOINT: '/v1/companies',
  STORED_USER_ID: 'moesif_stored_user_id',
  STORED_COMPANY_ID: 'moesif_stored_company_id',
  STORED_SESSION_ID: 'moesif_stored_session_id'
};

/*
 * Dynamic... constants? Is that an oxymoron?
 */
// http://hacks.mozilla.org/2009/07/cross-site-xmlhttprequest-with-cors/
// https://developer.mozilla.org/en-US/docs/DOM/XMLHttpRequest#withCredentials
var USE_XHR = (window.XMLHttpRequest && 'withCredentials' in new XMLHttpRequest());

// IE<10 does not support cross-origin XHR's but script tags
// with defer won't block window.onload; ENQUEUE_REQUESTS
// should only be true for Opera<12
var ENQUEUE_REQUESTS = !USE_XHR && (userAgent.indexOf('MSIE') === -1) && (userAgent.indexOf('Mozilla') === -1);

// save reference to navigator.sendBeacon so it can be minified
var sendBeacon = null;
if (navigator['sendBeacon']) {
  sendBeacon = function () {
    // late reference to navigator.sendBeacon to allow patching/spying
    return navigator['sendBeacon'].apply(navigator, arguments);
  };
}


var HTTP_PROTOCOL = (('http:' === (document && document.location.protocol)) ? 'http://' : 'https://');

// http://hacks.mozilla.org/2009/07/cross-site-xmlhttprequest-with-cors/
// https://developer.mozilla.org/en-US/docs/DOM/XMLHttpRequest#withCredentials
// var USE_XHR = (window.XMLHttpRequest && 'withCredentials' in new XMLHttpRequest());

// IE<10 does not support cross-origin XHR's but script tags
// with defer won't block window.onload; ENQUEUE_REQUESTS
// should only be true for Opera<12

function isContentJson(event) {
  try {
    var contentType = event['request']['headers']['Content-Type'] || event['request']['headers']['content-type']
      || event['response']['headers']['Content-Type'] || event['response']['headers']['content-type'];

    return contentType && contentType.toLowerCase().indexOf('json') > 0;
  } catch (err) {
    return false;
  }
}

function isMoesif(event) {
  try {
    return event['request']['headers']['X-Moesif-SDK'];
  } catch(err) {
    return false;
  }
}

function ensureValidOptions(options) {
  if (!options) throw new Error('options are required by moesif-express middleware');
  if (!options['applicationId']) throw new Error('A moesif application id is required. Please obtain it through your settings at www.moesif.com');

  if (options['getTags'] && !_.isFunction(options['getTags'])) {
    throw new Error('getTags should be a function');
  }
  if (options['getMetadata'] && !_.isFunction(options['getMetadata'])) {
    throw new Error('getMetadata should be a function');
  }
  if (options['getApiVersion'] && !_.isFunction(options['getApiVersion'])) {
    throw new Error('identifyUser should be a function');
  }
  if (options['maskContent'] && !_.isFunction(options['maskContent'])) {
    throw new Error('maskContent should be a function');
  }
  if (options['skip'] && !_.isFunction(options['skip'])) {
    throw new Error('skip should be a function');
  }
}

export default function () {
  console.log('moesif object creator is called');

  // function sendEvent(event, token, debug, callback) {
  //   console.log('actually sending to log event ' + _.JSONEncode(event));
  //   var xmlhttp = new XMLHttpRequest();   // new HttpRequest instance
  //   xmlhttp.open('POST', HTTP_PROTOCOL + MOESIF_CONSTANTS.HOST + MOESIF_CONSTANTS.EVENT_ENDPOINT);
  //   xmlhttp.setRequestHeader('Content-Type', 'application/json');
  //   xmlhttp.setRequestHeader('X-Moesif-Application-Id', token);
  //   xmlhttp.setRequestHeader('X-Moesif-SDK', 'moesif-browser-js/' + Config.LIB_VERSION);
  //   xmlhttp.onreadystatechange = function () {
  //     if (xmlhttp.readyState === 4) {
  //       if (xmlhttp.status >= 200 && xmlhttp.status <= 300) {
  //         if (debug) {
  //           console.log('sent to moesif successfully: ' + event['request']['uri']);
  //         }
  //       } else {
  //         console.log('failed to sent to moesif: ' + event['request']['uri']);
  //         if (debug) {
  //           console.error(xmlhttp.statusText);
  //         }
  //         if (callback && _.isFunction(callback)) {
  //           callback(new Error('can not sent to moesif'), event);
  //         }
  //       }
  //     }
  //   };
  //   xmlhttp.send(JSONStringify(event));
  // }

  // function sendAction(action, token, debug, callback) {
  //   console.log('actually sending action to moesif' + _.JSONEncode(action));
  //   var xmlhttp = new XMLHttpRequest();   // new HttpRequest instance
  //   xmlhttp.open('POST', HTTP_PROTOCOL + MOESIF_CONSTANTS.HOST + MOESIF_CONSTANTS.ACTION_ENDPOINT);
  //   xmlhttp.setRequestHeader('Content-Type', 'application/json');
  //   xmlhttp.setRequestHeader('X-Moesif-Application-Id', token);
  //   xmlhttp.setRequestHeader('X-Moesif-SDK', 'moesif-browser-js/' + Config.LIB_VERSION);
  //   xmlhttp.onreadystatechange = function () {
  //     if (xmlhttp.readyState === 4) {
  //       if (xmlhttp.status >= 200 && xmlhttp.status <= 300) {
  //         if (debug) {
  //           console.log('sent action to moesif successfully: ' + (action && action['action_name']));
  //         }
  //       } else {
  //         console.log('failed to sent action to moesif: ' + (action && action['action_name']));
  //         if (debug) {
  //           console.error(xmlhttp.statusText);
  //         }
  //         if (callback && _.isFunction(callback)) {
  //           callback(new Error('can not sent to moesif'), event);
  //         }
  //       }
  //     }
  //   };
  //   xmlhttp.send(JSONStringify(action));
  // }

  // function updateUser(userProfile, token, debug, callback) {
  //   var xmlhttp = new XMLHttpRequest();   // new HttpRequest instance
  //   xmlhttp.open('POST', HTTP_PROTOCOL + MOESIF_CONSTANTS.HOST + MOESIF_CONSTANTS.USER_ENDPOINT);
  //   xmlhttp.setRequestHeader('Content-Type', 'application/json');
  //   xmlhttp.setRequestHeader('X-Moesif-Application-Id', token);
  //   xmlhttp.setRequestHeader('X-Moesif-SDK', 'moesif-browser-js/' + Config.LIB_VERSION);
  //   xmlhttp.onreadystatechange = function () {
  //     if (xmlhttp.readyState === 4) {
  //       if (xmlhttp.status >= 200 && xmlhttp.status <= 300) {
  //         if (debug) {
  //           console.log('update user to moesif successfully: ' + userProfile['user_id']);
  //         }
  //       } else {
  //         console.log('update user to moesif failed ' + userProfile['user_id']);
  //         if (debug) {
  //           console.error(xmlhttp.statusText);
  //         }
  //         if (callback && _.isFunction(callback)) {
  //           callback(new Error('can not update user to moesif'), null, userProfile);
  //         }
  //       }
  //     }
  //   };
  //   xmlhttp.send(JSONStringify(userProfile));
  // }

  // function updateCompany(companyProfile, token, debug, callback) {
  //   var xmlhttp = new XMLHttpRequest();
  //   xmlhttp.open('POST', HTTP_PROTOCOL + MOESIF_CONSTANTS.HOST + MOESIF_CONSTANTS.COMPANY_ENDPOINT);
  //   xmlhttp.setRequestHeader('Content-Type', 'application/json');
  //   xmlhttp.setRequestHeader('X-Moesif-Application-Id', token);
  //   xmlhttp.setRequestHeader('X-Moesif-SDK', 'moesif-browser-js/' + Config.LIB_VERSION);
  //   xmlhttp.onreadystatechange = function () {
  //     if (xmlhttp.readyState === 4) {
  //       if (xmlhttp.status >= 200 && xmlhttp.status <= 300) {
  //           console.log('update company to moesif successfully: ' + companyProfile['company_id']);
  //       } else {
  //         console.log('update company to moesif failed ' + companyProfile['company_id']);
  //         console.error(xmlhttp.statusText);
  //         if (callback && _.isFunction(callback)) {
  //           callback(new Error('can not update company to moesif'), null, companyProfile);
  //         }
  //       }
  //     }
  //   };
  //   xmlhttp.send(JSONStringify(companyProfile));
  // }

  return {
    'init': function (options) {
      if (!window) {
        console.critical('Warning, this library need to be initiated on the client side');
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

      ops.batch = options['batch'] || false;

      ops['batch_size'] = options['batch_size'] || 50,
      ops['batch_flush_interval_ms'] = options['batch_flush_interval_ms'] || 5000;
      ops['batch_request_timeout_ms'] = options['batch_request_timeout_ms'] || 90000;

      this.requestBatchers = {};


      this._options = ops;
      this._userId = localStorage.getItem(MOESIF_CONSTANTS.STORED_USER_ID);
      this._session = localStorage.getItem(MOESIF_CONSTANTS.STORED_SESSION_ID);
      this._companyId = localStorage.getItem(MOESIF_CONSTANTS.STORED_COMPANY_ID);
      this._campaign = getCampaignData(ops);

      if (ops.batch) {
        if (!localStorageSupported || !USE_XHR) {
          ops.batch = false;
          console.log('Turning off batch processing because it needs XHR and localStorage');
        } else {
          this.initBatching();
          if (sendBeacon && window.addEventListener) {
            window.addEventListener('unload', _.bind(function () {
              // Before page closes, attempt to flush any events queued up via navigator.sendBeacon.
              // Since sendBeacon doesn't report success/failure, events will not be removed from
              // the persistent store; if the site is loaded again, the events will be flushed again
              // on startup and deduplicated on the Mixpanel server side.
              this.requestBatchers.events.flush({ sendBeacon: true });
            }, this));
          }
        }
      }

      console.log('moesif initiated');
      return this;
    },
    _executeRequest: function (url, data, options, callback) {
      var token = (options && options.applicationId) || this._options.applicationId;

      // right now we onlu support USE_XHR

      try {
        var xmlhttp = new XMLHttpRequest();   // new HttpRequest instance
        xmlhttp.open('POST', url);
        xmlhttp.setRequestHeader('Content-Type', 'application/json');
        xmlhttp.setRequestHeader('X-Moesif-Application-Id', token);
        xmlhttp.setRequestHeader('X-Moesif-SDK', 'moesif-browser-js/' + Config.LIB_VERSION);
        xmlhttp.onreadystatechange = function () {
          if (xmlhttp.readyState === 4) {
            if (xmlhttp.status >= 200 && xmlhttp.status <= 300) {
              console.log('sent to moesif successfully: ' + data);
            } else {
              console.log('failed to sent to moesif: ' + data);
              console.error(xmlhttp.statusText);
              if (callback && _.isFunction(callback)) {
                callback(new Error('can not sent to moesif'), data);
              }
            }
          }
        };
        xmlhttp.send(JSONStringify(data));
      } catch (err) {
        console.error('failed to send event to moesif' + event['request']['uri']);
        console.error(err);
      }
    },
    initBatching: function () {
      var applicationId = this._options.applicationId;

      if (!this.requestBatchers.events) {
        var batchConfig = {
          libConfig: this._options,
          sendRequestFunc: _.bind(function (endPoint, data, options, cb) {
            this._executeRequest(
              endPoint,
              data,
              options,
              cb
            );
          }, this)
        };

        this.requestBatchers = {
          events: new RequestBatcher('__mf_' + applicationId + '_ev', HTTP_PROTOCOL + MOESIF_CONSTANTS.HOST + MOESIF_CONSTANTS.EVENT_BATCH_ENDPOINT, batchConfig),
          actions: new RequestBatcher('__mf_' + applicationId + '_ac', HTTP_PROTOCOL + MOESIF_CONSTANTS.HOST + MOESIF_CONSTANTS.ACTION_BATCH_ENDPOINT, batchConfig)
        };
      }
      _.each(this.requestBatchers, function (batcher) {
        batcher.start();
      });
    },
    _sendOrBatch: function(data, applicationId, endPoint, batcher, callback) {
      var requestInitiated = true;

      if (this._options.batch && batcher) {
        batcher.enqueue(data);
      } else {
        // execute immediately
        var executeOps = {
          applicationId: applicationId
        };

        requestInitiated = this._executeRequest(endPoint, data, executeOps, callback);
      }
      return requestInitiated;
    },
    'start': function (passedInWeb3) {
      var _self = this;


      if (this._stopRecording || this._stopWeb3Recording) {
        console.log('recording has already started, please call stop first.');
        return false;
      }

      function recorder(event) {
        _self.recordEvent(event);
      }

      console.log('moesif starting');
      this._stopRecording = patchAjaxWithCapture(recorder);

      if (!this._options.disableFetch) {
        console.log('also instrumenting fetch API');
        this._stopFetchRecording = patchFetchWithCapture(recorder);
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
    'useWeb3': function (passedInWeb3) {
      var _self = this;

      function recorder(event) {
        _self.recordEvent(event);
      }

      if (this._stopWeb3Recording) {
        this._stopWeb3Recording();
        this._stopWeb3Recording = null;
      }
      if (passedInWeb3) {
        this._stopWeb3Recording = patchWeb3WithCapture(passedInWeb3, recorder, this._options);
      } else if (window['web3']) {
        // try to patch the global web3
        console.log('found global web3, will capture from it');
        this._stopWeb3Recording = patchWeb3WithCapture(window['web3'], recorder, this._options);
      }
      if (this._stopWeb3Recording) {
        // if function is returned it means we succeeded.
        return true;
      }
      return false;
    },
    updateUser: function(userObject, applicationId, callback) {
      this._executeRequest(
        HTTP_PROTOCOL + MOESIF_CONSTANTS.HOST + MOESIF_CONSTANTS.USER_ENDPOINT,
        userObject,
        { applicationId: applicationId },
        callback
      );
    },
    'identifyUser': function (userId, metadata) {
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
      if (this._companyId) {
        userObject['company_id'] = this._companyId;
      }

      this.updateUser(userObject, this._options.applicationId, this._options.callback);
      try {
        localStorage.setItem(MOESIF_CONSTANTS.STORED_USER_ID, userId);
      } catch (err) {
        console.error('error saving to local storage');
      }
    },
    updateCompany: function(companyObject, applicationId, callback) {
      this._executeRequest(
        HTTP_PROTOCOL + MOESIF_CONSTANTS.HOST + MOESIF_CONSTANTS.companyId,
        companyObject,
        { applicationId: applicationId },
        callback
      );
    },
    'identifyCompany': function (companyId, metadata, companyDomain) {
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

      this.updateCompany(companyObject, this._options.applicationId, this._options.callback);

      try {
        localStorage.setItem(MOESIF_CONSTANTS.STORED_COMPANY_ID, companyId);
      } catch (err) {
        console.error('error saving to local storage');
      }
    },
    'identifySession': function (session) {
      this._session = session;
      localStorage.setItem(MOESIF_CONSTANTS.STORED_SESSION_ID, session);
    },
    'track': function (actionName, metadata) {
      var _self = this;
      if (!actionName) {
        throw new Error('track name must have action Name defined');
      }

      var actionObject = {
        'action_name': actionName
      };

      if (_self._companyId) {
        actionObject['company_id'] = _self._companyId;
      }
      if (_self._userId) {
        actionObject['user_id'] = _self._userId;
      }
      if (this._session) {
        actionObject['session_token'] = this._session;
      }

      actionObject['request'] = {
        'uri': document.location.href,
        'verb': 'GET', // for UI events on a current page, the current page verb is always get
        'user_agent_string': navigator.userAgent
      };

      if (metadata) {
        actionObject['metadata'] = metadata;
      }

      // sendAction(actionObject, this._options.applicationId, this._options.debug, this._options.callback);
      var endPoint = HTTP_PROTOCOL + MOESIF_CONSTANTS.HOST + MOESIF_CONSTANTS.ACTION_ENDPOINT;
      return _self._sendOrBatch(
        actionObject,
        _self._options.applicationId,
        endPoint,
        _self.requestBatchers.events,
        _self._options.callback
      );
    },
    recordEvent: function (event) {
      if (isMoesif(event)) {
        console.log('skipped logging for requests to moesif');
        return;
      }

      var _self = this;
      console.log('determining if should log: ' + event['request']['uri']);
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
        // sendEvent(logData, _self._options.applicationId, _self._options.callback);
        var endPoint = HTTP_PROTOCOL + MOESIF_CONSTANTS.HOST + MOESIF_CONSTANTS.EVENT_ENDPOINT;
        _self._sendOrBatch(
          logData,
          _self._options.applicationId,
          endPoint,
          _self.requestBatchers.events,
          _self._options.callback
        );
      } else {
        console.log('skipped logging for ' + event['request']['uri']);
      }
    },
    _getUserId: function () {
      return this._userId;
    },
    _getCompanyId: function () {
      return this._companyId;
    },
    _getSession: function () {
      return this._session;
    },
    'stop': function () {
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
}
