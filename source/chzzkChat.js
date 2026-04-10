/* CHZZK 채팅 연결 모듈
 * CHZZK Open API 세션을 통해 채팅/후원/구독 이벤트를 수신합니다.
 * 연결 절차: 세션 목록 조회 → 활성 세션 없으면 생성 → 채팅/후원/구독 이벤트 구독
 */

'use strict';

var io = require('socket.io-client');
var chzzkAuth = require('./chzzkAuth');

var CHZZK_API_BASE = 'https://openapi.chzzk.naver.com';

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
 * CHZZK Open API 요청 헬퍼
 * @param {string} method
 * @param {string} path
 * @param {string} accessToken
 * @param {object} [body]
 * @returns {Promise<object>}
 */
function chzzkApiRequest(method, path, accessToken, body) {
  var options = {
    method: method,
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    }
  };
  if (body) { options.body = JSON.stringify(body); }
  return fetch(CHZZK_API_BASE + path, options)
    .then(function(res) {
      if (!res.ok) {
        return res.text().then(function(text) {
          return Promise.reject(new Error('CHZZK API 오류 ' + res.status + ': ' + text));
        });
      }
      return res.json();
    });
}

/**
 * 활성 세션을 조회합니다. (유저당 최대 3개이므로 재사용)
 * @param {string} accessToken
 * @returns {Promise<string|null>} 활성 세션 URL, 없으면 null
 */
function getActiveSessionUrl(accessToken) {
  return chzzkApiRequest('GET', '/open/v1/sessions', accessToken)
    .then(function(data) {
      var sessions = (data.content && data.content.sessions) ? data.content.sessions : (data.sessions || []);
      var active = sessions.find(function(s) { return s.status === 'ACTIVE' || s.active; });
      return active ? (active.url || active.socketUrl || null) : null;
    })
    .catch(function() { return null; });
}

/**
 * 새 세션을 생성하고 소켓 URL을 반환합니다.
 * @param {string} accessToken
 * @returns {Promise<string>} 소켓 연결 URL
 */
function createSession(accessToken) {
  return chzzkApiRequest('POST', '/open/v1/sessions', accessToken)
    .then(function(data) {
      var url = (data.content && data.content.url) ? data.content.url : data.url;
      if (!url) { return Promise.reject(new Error('세션 URL을 받지 못했습니다.')); }
      return url;
    });
}

/**
 * 이벤트를 구독합니다.
 * @param {string} eventType - 'chat' | 'donation' | 'subscription'
 * @param {string} sessionKey
 * @param {string} channelId
 * @param {string} accessToken
 */
function subscribeEvent(eventType, sessionKey, channelId, accessToken) {
  var path = '/open/v1/sessions/' + encodeURIComponent(sessionKey) +
             '/events/' + eventType + '/subscribe';
  return chzzkApiRequest('POST', path, accessToken, { channelId: channelId });
}

/**
 * Socket.IO로 CHZZK 세션에 연결하고 이벤트를 구독합니다.
 * @param {string} sessionUrl
 * @param {string} accessToken
 * @param {string} channelId
 */
function connectSocket(sessionUrl, accessToken, channelId) {
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
    if (data.type === 'CONNECTED' || data.sessionKey) {
      var sessionKey = data.sessionKey;
      console.log('[ChzzkChat] 연결 완료, sessionKey:', sessionKey);

      // 이벤트 구독 순서: 채팅 → 후원 → 구독
      subscribeEvent('chat', sessionKey, channelId, accessToken)
        .then(function() {
          return subscribeEvent('donation', sessionKey, channelId, accessToken);
        })
        .then(function() {
          return subscribeEvent('subscription', sessionKey, channelId, accessToken);
        })
        .catch(function(err) {
          console.error('[ChzzkChat] 이벤트 구독 오류:', err.message);
        });
    }
  });

  socket.on('CHAT', function(data) {
    if (data) { _onMessage(data); }
  });

  socket.on('DONATION', function(data) {
    if (data) { _onDonation(data); }
  });

  socket.on('SUBSCRIPTION', function(data) {
    if (data) { _onSubscription(data); }
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
      // 세션 목록 조회 → 활성 세션 재사용 or 신규 생성
      return getActiveSessionUrl(accessToken)
        .then(function(sessionUrl) {
          if (sessionUrl) {
            console.log('[ChzzkChat] 기존 활성 세션 재사용');
            return { url: sessionUrl, token: accessToken };
          }
          console.log('[ChzzkChat] 새 세션 생성');
          return createSession(accessToken).then(function(url) {
            return { url: url, token: accessToken };
          });
        });
    })
    .then(function(session) {
      isConnecting = false;
      connectSocket(session.url, session.token, _channelId);
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
  setChannelId: setChannelId,
  setRetryInterval: setRetryInterval,
  onDisconnect: onDisconnect
};
