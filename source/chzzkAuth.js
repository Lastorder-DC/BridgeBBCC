/* CHZZK 인증 모듈
 * chzzk-chat-server를 통해 액세스 토큰을 관리합니다.
 * OBS 브라우저 소스에서는 팝업을 열 수 없으므로 세션 기반 폴링 방식을 사용합니다.
 */

'use strict';

var STORAGE_KEYS = {
  ACCESS_TOKEN:  'chzzkAccessToken',
  REFRESH_TOKEN: 'chzzkRefreshToken',
  EXPIRES_AT:    'chzzkTokenExpiresAt'
};

var AUTH_SERVER_URL = '';

function setAuthServerUrl(url) {
  AUTH_SERVER_URL = url;
}

/**
 * 저장된 토큰을 불러옵니다.
 */
function loadStoredTokens() {
  return {
    accessToken:  localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
    refreshToken: localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN),
    expiresAt:    parseInt(localStorage.getItem(STORAGE_KEYS.EXPIRES_AT) || '0', 10)
  };
}

/**
 * 토큰을 로컬 스토리지에 저장합니다.
 */
function saveTokens(accessToken, refreshToken, expiresIn) {
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN,  accessToken);
  localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
  localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, String(Date.now() + expiresIn * 1000));
}

/**
 * 로컬 스토리지에서 토큰을 삭제합니다.
 */
function clearTokens() {
  [STORAGE_KEYS.ACCESS_TOKEN, STORAGE_KEYS.REFRESH_TOKEN, STORAGE_KEYS.EXPIRES_AT]
    .forEach(function(k) { localStorage.removeItem(k); });
}

/**
 * 화면 중앙에 로그인 링크를 크게 표시합니다. (OBS에서 팝업 불가 대응)
 * @returns {{ sessionId: string, overlay: HTMLElement }} 세션ID와 오버레이 요소
 */
function showLoginOverlay() {
  var sessionId = 'bbcc-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  var loginUrl = AUTH_SERVER_URL + '/auth/login?session=' + encodeURIComponent(sessionId);

  var overlay = document.createElement('div');
  overlay.id = 'chzzk_login_overlay';
  overlay.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;' +
    'background:rgba(0,0,0,0.85);z-index:9999;' +
    'display:flex;flex-direction:column;align-items:center;justify-content:center;';

  overlay.innerHTML =
    '<div style="color:#fff;font-family:\'굴림체\',sans-serif;text-align:center;padding:20px;">' +
      '<div style="font-size:1.6em;margin-bottom:0.6em;">&#x1F513; 치지직(CHZZK) 로그인 필요</div>' +
      '<div style="font-size:1em;margin-bottom:1.2em;opacity:0.8;">' +
        '아래 링크를 <strong>일반 브라우저</strong>에서 열어 로그인해 주세요.' +
      '</div>' +
      '<a href="' + loginUrl + '" target="_blank" ' +
         'style="display:inline-block;background:#03c75a;color:#fff;text-decoration:none;' +
                'font-size:1.3em;padding:0.6em 1.4em;border-radius:6px;font-weight:bold;' +
                'word-break:break-all;">' +
        '치지직 로그인하기' +
      '</a>' +
      '<div style="margin-top:1em;font-size:0.85em;opacity:0.7;">' +
        loginUrl +
      '</div>' +
      '<div style="margin-top:1.4em;font-size:0.9em;opacity:0.6;">' +
        '로그인 완료 후 자동으로 연결됩니다...' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);
  return { sessionId: sessionId, overlay: overlay };
}

/**
 * 로그인 오버레이를 제거합니다.
 */
function removeLoginOverlay() {
  var overlay = document.getElementById('chzzk_login_overlay');
  if (overlay) { overlay.parentElement.removeChild(overlay); }
}

/**
 * 세션 기반 폴링으로 토큰을 가져옵니다.
 * OBS에서는 팝업을 열 수 없으므로 사용자가 일반 브라우저에서 링크를 열어야 합니다.
 * @param {string} sessionId
 * @returns {Promise<{accessToken:string, refreshToken:string, expiresIn:number}>}
 */
function pollForToken(sessionId) {
  return new Promise(function(resolve, reject) {
    var tokenUrl = AUTH_SERVER_URL + '/auth/token/' + encodeURIComponent(sessionId);
    var elapsed = 0;
    var TIMEOUT_MS = 5 * 60 * 1000; // 5분
    var POLL_INTERVAL_MS = 2000;     // 2초마다 폴링

    var interval = setInterval(function() {
      elapsed += POLL_INTERVAL_MS;
      if (elapsed >= TIMEOUT_MS) {
        clearInterval(interval);
        reject(new Error('로그인 대기 시간이 초과되었습니다.'));
        return;
      }

      fetch(tokenUrl)
        .then(function(res) {
          if (res.status === 200) {
            clearInterval(interval);
            return res.json().then(resolve);
          }
          if (res.status === 404) {
            clearInterval(interval);
            reject(new Error('세션이 만료되었습니다.'));
          }
          // 202: 아직 로그인 미완료 → 계속 폴링
        })
        .catch(function(err) {
          // 네트워크 오류는 무시하고 재시도
          console.warn('[ChzzkAuth] 폴링 오류 (재시도 중):', err.message);
        });
    }, POLL_INTERVAL_MS);
  });
}

/**
 * 로그인이 필요할 때 오버레이를 표시하고 토큰을 폴링합니다.
 * @returns {Promise<string>} 유효한 Access Token
 */
function login() {
  var result = showLoginOverlay();
  return pollForToken(result.sessionId)
    .then(function(data) {
      removeLoginOverlay();
      saveTokens(data.accessToken, data.refreshToken, data.expiresIn);
      return data.accessToken;
    })
    .catch(function(err) {
      removeLoginOverlay();
      return Promise.reject(err);
    });
}

/**
 * 백그라운드에서 Ajax로 토큰을 자동 갱신합니다.
 * @param {string} refreshToken
 * @returns {Promise<string>} 새 Access Token
 */
function refreshAccessToken(refreshToken) {
  return fetch(AUTH_SERVER_URL + '/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refreshToken })
  })
  .then(function(res) {
    if (!res.ok) {
      clearTokens();
      return Promise.reject(new Error('토큰 갱신 실패. 재로그인이 필요합니다.'));
    }
    return res.json();
  })
  .then(function(data) {
    saveTokens(data.accessToken, data.refreshToken, data.expiresIn);
    return data.accessToken;
  });
}

/**
 * 유효한 Access Token을 반환합니다.
 * 만료 임박(5분 이내) 시 백그라운드에서 자동 갱신합니다.
 * 토큰이 없으면 오류를 반환합니다.
 * @returns {Promise<string>}
 */
function getAccessToken() {
  var stored = loadStoredTokens();

  if (!stored.accessToken) {
    return Promise.reject(new Error('저장된 토큰 없음'));
  }

  // 만료까지 5분 미만이면 갱신
  if (Date.now() > stored.expiresAt - 5 * 60 * 1000) {
    if (!stored.refreshToken) {
      clearTokens();
      return Promise.reject(new Error('리프레시 토큰 없음'));
    }
    return refreshAccessToken(stored.refreshToken);
  }

  return Promise.resolve(stored.accessToken);
}

/**
 * 로그아웃: 서버에서 토큰을 폐기하고 로컬 스토리지를 초기화합니다.
 * @returns {Promise<void>}
 */
function logout() {
  var stored = loadStoredTokens();
  var revokePromise = stored.accessToken
    ? fetch(AUTH_SERVER_URL + '/auth/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: stored.accessToken })
      }).catch(function() {})
    : Promise.resolve();

  return revokePromise.then(function() {
    clearTokens();
  });
}

/**
 * 저장된 토큰이 있는지 확인합니다.
 */
function hasStoredToken() {
  return !!localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

module.exports = {
  setAuthServerUrl: setAuthServerUrl,
  login: login,
  logout: logout,
  getAccessToken: getAccessToken,
  hasStoredToken: hasStoredToken,
  clearTokens: clearTokens
};
