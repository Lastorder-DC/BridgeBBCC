/* CHZZK 채팅 연결 모듈
 * CHZZK Open API 세션을 통해 채팅/후원/구독 이벤트를 수신합니다.
 * 연결 절차: /sessions/auth로 세션 URL 획득 → 소켓 연결 → 채팅/후원/구독 이벤트 구독
 * CORS 우회를 위해 모든 CHZZK API 호출은 chzzk-chat-server 프록시를 통해 수행합니다.
 */

'use strict';

var io = require('socket.io-client');
var chzzkAuth = require('./chzzkAuth');

var AUTH_SERVER_URL = '';

var socket = null;
var retryTimer = null;
var isConnecting = false;

var _onMessage      = function() {};
var _onDonation     = function() {};
var _onSubscription = function() {};
var _onDisconnect   = function() {};
var _channelId      = '';
var _retryInterval  = 3;

/**
 * Auth Server 프록시를 통한 API 요청 헬퍼
 * @param {string} method
 * @param {string} path
 * @param {string} accessToken
 * @param {object} [body]
 * @returns {Promise<object>}
 */
function authServerRequest(method, path, accessToken, body) {
  var options = {
    method: method,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  };
  if (accessToken) { options.headers['Authorization'] = 'Bearer ' + accessToken; }
  if (body) { options.body = new URLSearchParams(body).toString(); }
  return fetch(AUTH_SERVER_URL + path, options)
    .then(function(res) {
      if (!res.ok) {
        return res.text().then(function(text) {
          return Promise.reject(new Error('API 오류 ' + res.status + ': ' + text));
        });
      }
      return res.json();
    });
}

/**
 * Auth Server 프록시를 통해 소켓 연결용 URL을 가져옵니다.
 * @param {string} accessToken
 * @returns {Promise<string>} 소켓 연결 URL
 */
function getSessionUrl(accessToken) {
  return authServerRequest('GET', '/sessions/auth', accessToken)
    .then(function(data) {
      var url = (data.content && data.content.url) ? data.content.url : data.url;
      if (!url) { return Promise.reject(new Error('세션 URL을 받지 못했습니다.')); }
      return url;
    });
}

/**
 * 이벤트를 구독합니다.
 * Auth Server 프록시의 /sessions/events/subscribe/{eventType} 엔드포인트를 사용합니다.
 * @param {string} eventType - 'chat' | 'donation' | 'subscription'
 * @param {string} sessionKey
 * @param {string} accessToken
 */
function subscribeEvent(eventType, sessionKey, accessToken) {
  var path = '/sessions/events/subscribe/' + eventType;
  return authServerRequest('POST', path, accessToken, { sessionKey: sessionKey });
}

/**
 * Socket.IO로 CHZZK 세션에 연결하고 이벤트를 구독합니다.
 * @param {string} sessionUrl
 * @param {string} accessToken
 * @param {string} channelId
 */
function connectSocket(sessionUrl, accessToken) {
  if (socket) {
    try { socket.disconnect(); } catch(e) {}
    socket = null;
  }

  socket = io(sessionUrl, {
    reconnection: false,
    'force new connection': true,
    'connect timeout': 5000,
    transports: ['websocket']
  });

  socket.on('connect', function() {
    console.log('[ChzzkChat] 소켓 연결됨');
  });

  socket.on('SYSTEM', function(data) {
    if (!data) { return; }
    // 연결 완료 메시지: sessionKey 포함
    data = JSON.parse(data);
    if (data.type === 'CONNECTED' || data.data.sessionKey) {
      var sessionKey = data.data.sessionKey;
      console.log('[ChzzkChat] 연결 완료, sessionKey:', sessionKey);

      // 이벤트 구독 순서: 채팅 → 후원 → 구독
      subscribeEvent('chat', sessionKey, accessToken)
        .then(function() {
          return subscribeEvent('donation', sessionKey, accessToken);
        })
        .then(function() {
          return subscribeEvent('subscription', sessionKey, accessToken);
        })
        .catch(function(err) {
          console.error('[ChzzkChat] 이벤트 구독 오류:', err.message);
        });
    }
  });

  socket.on('CHAT', function(data) {
    if (data) { data = JSON.parse(data);console.log(data);_onMessage(data); }
  });

  socket.on('DONATION', function(data) {
    if (data) { data = JSON.parse(data);console.log(data);_onDonation(data); }
  });

  socket.on('SUBSCRIPTION', function(data) {
    if (data) { data = JSON.parse(data);console.log(data);_onSubscription(data); }
  });

  socket.on('disconnect', function(reason) {
    console.log('[ChzzkChat] 연결 종료:', reason);
    _onDisconnect(reason);
    scheduleReconnect();
  });

  socket.on('error', function(err) {
    console.error('[ChzzkChat] 소켓 오류:', err);
  });

  socket.on('connect_error', function(err) {
    console.error('[ChzzkChat] 연결 오류:', err);
    scheduleReconnect();
  });
}

/**
 * Auth Server URL 설정
 */
function setAuthServerUrl(url) {
  AUTH_SERVER_URL = url;
}

/**
 * 재연결 스케줄러
 */
function scheduleReconnect() {
  if (retryTimer) { clearTimeout(retryTimer); }
  retryTimer = setTimeout(function() {
    retryTimer = null;
    if (!isConnecting) { connect(_onMessage, _onDonation, _onSubscription); }
  }, _retryInterval * 1000);
}

/**
 * CHZZK 채팅에 연결합니다.
 * @param {function} onMessage - 채팅 수신 콜백
 * @param {function} onDonation - 후원 수신 콜백
 * @param {function} onSubscription - 구독 수신 콜백
 * @returns {Promise<void>}
 */
function connect(onMessage, onDonation, onSubscription) {
  if (isConnecting) { return Promise.resolve(); }
  isConnecting = true;

  if (onMessage)      { _onMessage      = onMessage; }
  if (onDonation)     { _onDonation     = onDonation; }
  if (onSubscription) { _onSubscription = onSubscription; }

  return chzzkAuth.getAccessToken()
    .then(function(accessToken) {
      return getSessionUrl(accessToken)
        .then(function(sessionUrl) {
          return { url: sessionUrl, token: accessToken };
        });
    })
    .then(function(session) {
      isConnecting = false;
      connectSocket(session.url, session.token);
    })
    .catch(function(err) {
      isConnecting = false;
      console.error('[ChzzkChat] 연결 실패:', err.message);
      scheduleReconnect();
      return Promise.reject(err);
    });
}

/**
 * 채팅 연결을 끊습니다.
 */
function disconnect() {
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  if (socket) {
    try { socket.disconnect(); } catch(e) {}
    socket = null;
  }
}

/**
 * 재연결 간격 설정
 */
function setRetryInterval(seconds) {
  _retryInterval = seconds;
}

/**
 * 구독할 채널 ID 설정
 */
function setChannelId(channelId) {
  _channelId = channelId;
}

/**
 * 연결 끊김 콜백 설정
 */
function onDisconnect(callback) {
  _onDisconnect = callback;
}

module.exports = {
  connect: connect,
  disconnect: disconnect,
  setAuthServerUrl: setAuthServerUrl,
  setChannelId: setChannelId,
  setRetryInterval: setRetryInterval,
  onDisconnect: onDisconnect
};
