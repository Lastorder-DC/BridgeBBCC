/* 기본 설정 */
configDefault = {
  numChatMax        : 20,               // html에 한꺼번에 표시될 수 있는 메세지의 최대 갯수
  personalColor     : false,            /* 이름 색깔을 채팅 이름색과 일치시킬지
                                           theme에서 제한 가능                        */
  themeURI          : "",               /* 불러올 테마 Uri.
                                           로컬 테마를 이용할 경우 공백으로 둔다.     */
  theme             : "default",        // 사용할 테마. theme\테마\*의 파일을 사용
  themeName         : "",               /* 테마의 이름
                                           theme로부터 import                         */
  msgExistDuration  : 0,                // 메세지가 애니메이션을 빼면 얼마나 오래 표시될 지
  msgAniDuration    : 0,                /* 메세지 표시 애니메이션의 소요시간
                                           theme로부터 import                         */
  debugLevel        : 2,                // 0:미표시, 1:console.log, 2:addChatMessage
  useDisplayName    : true,             // 닉네임으로 이름을 표시할지
  loadDcCons        : true,             // 디씨콘을 불러올지
  loadChzzkEmojis   : true,             // 치지직 이모티콘을 이미지로 표시할지
  dcConsURI         : "",               /* 불러올 디씨콘 Uri.
                                           로컬 디씨콘을 이용할 경우 공백으로 둔다.   */
  chzzkDonationMsg  : "☆ {!0:{amount}원 }후원 ! ☆",
                                        // 치지직 후원을 받았을 때 추가로 출력할 텍스트
  chzzkSubMsg       : "☆ {!0:{months} 개월 }구독{0: 시작}! ☆",
                                        // 치지직 구독 메세지를 받았을 때 추가로 출력할 텍스트
  linkReplaceMsg    : "[링크]",         // (일반) 링크의 대체 텍스트
  chzzkChannelId    : "",               // 구독할 치지직 채널 ID
  chzzkAuthServerUrl: "http://localhost:3000",
                                        // chzzk-chat-server 주소
  retryInterval     : 3,                // 접속에 끊겼을 때 재접속 시도 간격(초)
  allMessageHandle  : false,            /* 처리되지 않은 메세지를 html에 표시          */
  muteUser          : [],               /* html에 표시하지 않을 유저 nickname          */
  commands          : [
    {exe:"clear", msg:"!!clear"},
    {exe:"theme", msg:"!!theme"},
    {exe:"load", msg:"!!load"},
    {exe:"scale", msg:"!!scale"}
  ],                                    // 활성화시킬 명령어
  replaceMsgs       : []                /* 봇 메세지 등을 대체
                                           {
                                             orig: 원문(문자열 또는 정규표현식),
                                             to: 대체할 문자열("{no_display}"로 미표시)
                                            }                                         */
};



/* 메세지 출력 함수 정의 */
var numChat = 0;
var replaceMsgFormat = function(message, amount) {
  if (typeof amount != "number") { amount = 0; }

  var retMessage = message
    .replace("{months}", amount)
    .replace("{amount}", amount);
  if (amount == 0) {
    retMessage = retMessage.replace(/\{0:([^\}]*)}/g, "$1").replace(/\{!0:([^\}]*)}/g, "");
  }
  else {
    retMessage = retMessage.replace(/\{!0:([^\}]*)}/g, "$1").replace(/\{0:([^\}]*)}/g, "");
  }
  return retMessage;
}
var getRemoveTimeout = function(box) {
  return function() {
    if ((box||{}).parentElement != null) {
      box.remove();
      --numChat;
    }
  };
}
var timeToMs = function(time) {
  var num = time.split(/[a-z]/i)[0];
  try { num = Number(num); }
  catch(e) { return 0; }

  var isMs = /ms/.test(time);
  return num * (isMs? 1: 1000);
}
var applyMessageRemove = function(box) {
  // 기존 타이머를 정리
  if (box.timeout) { clearTimeout(box.timeout); }
  if (!box.nodeType) { return; }

  // CSS 애니메이션 적용
  if (configData.msgAniDuration) {
    var computedStyle = getComputedStyle(box);
    var origName = computedStyle.animationName;
    var origDuration = computedStyle.animationDuration;
    var origAnimation = computedStyle.animation;
    var origDirection = computedStyle.animationDirection;

    box.classList.add("remove");
    var newName = computedStyle.animationName;
    var newDuration = computedStyle.animationDuration;

    var condOrig = (origName != "none");
    var condNew = (newName != "none");
    var condSame = (origName == newName);

    if (!condNew && !condOrig) {
    // 애니메이션이 하나도 없을 경우 그냥 삭제
      (getRemoveTimeout(box))();
      return;
    }

    if (condOrig && (condNew == condSame)) {
    // 메세지 삭제 애니메이션만 없을 경우 생성 애니메이션을 반전
      box.style.animation = origAnimation;
      box.style.animationDirection = {
        "normal": "reverse", "alternate": "alternate-reverse",
        "reverse": "normal", "alternate-reverse": "alternate"
      }[origDirection] || "reverse";
    }

    if (configData.msgAniDuration > 0) {
    // 애니메이션 시간을 적용
      newDuration = configData.msgAniDuration + "s";
      box.style.animationDuration = newDuration;
    }


    box.timeout = setTimeout(
      getRemoveTimeout(box),
      timeToMs(newDuration) || timeToMs(origDuration)
    );
  } else {
  // 메세지 삭제 애니메이션 무시
    (getRemoveTimeout(box))();
    return;
  }
}
addChatMessage = function(nick, message, data) {

  // DOM Element 생성
  var chatNicknameBox = document.createElement("div");
  chatNicknameBox.classList.add("chat_nickname_box");
  var chatBadgeBox = document.createElement("div");
  chatBadgeBox.classList.add("chat_badge_box");
  var chatUpperBox = document.createElement("div");
  chatUpperBox.classList.add("chat_upper_box");
  var chatMessageBox = document.createElement("div");
  chatMessageBox.classList.add("chat_msg_box");
  var chatLowerBox = document.createElement("div");
  chatLowerBox.classList.add("chat_lower_box");
  var chatOuterBox = document.createElement("div");
  chatOuterBox.classList.add("chat_outer_box");
  if (data.nick) { chatOuterBox.classList.add("user_"+data.nick); }


  // Element에 내용 추가
  chatNicknameBox.innerHTML = nick;
  message = message.replace(/\\\"/g, '"').replace(/\\\\/g, "\\");
  if (typeof applyMessage != "undefined") {
    chatMessageBox.innerHTML = applyMessage(message, data);
    if (data.noDisplay) { return null; }
  }
  else { chatMessageBox.innerHTML = message; }

  if (data) {
    if (data.color && configData.personalColor) {
      chatNicknameBox.style.color = data.color;
    }

    // 뱃지: 추후 구현을 위해 badges 데이터를 콘솔에 로깅
    // TODO: CHZZK badges 구조 파악 후 이미지 표시 구현
    if (data.badges && data.badges.length > 0) {
      console.log("[BridgeBBCC] CHZZK badges data (추후 구현 참고):", JSON.stringify(data.badges));
      chatBadgeBox.classList.add("empty");
    } else {
      chatBadgeBox.classList.add("empty");
    }

    if (data.subMonths != undefined) {
    // 구독 메세지 추가
      chatLowerBox.innerHTML =
        '<div class="chat_subscribe_box">' +
        replaceMsgFormat(configData.chzzkSubMsg, data.subMonths) +
        "</div>" + chatLowerBox.innerHTML;
    }
    if (data.donation != undefined) {
    // 후원 메세지 추가
      chatLowerBox.innerHTML =
        '<div class="chat_cheer_box">' +
        replaceMsgFormat(configData.chzzkDonationMsg, data.donation) +
        "</div>" + chatLowerBox.innerHTML;
    }
  }
  if ( chatMessageBox.innerHTML.replace(/(<[^>]*>)|\s/g,"").length == 0) {
    chatMessageBox.classList.add("image_only");
  }


  // 페이지에 Element 연결
  chatUpperBox.appendChild(chatBadgeBox);
  chatUpperBox.appendChild(chatNicknameBox);
  chatOuterBox.appendChild(chatUpperBox);
  chatOuterBox.upper = chatUpperBox;
  chatOuterBox.appendChild(chatLowerBox);
  chatOuterBox.lower = chatLowerBox;
  chatLowerBox.appendChild(chatMessageBox);
  chatLowerBox.msg = chatMessageBox;
  document.getElementById("chat_wrapper").appendChild(chatOuterBox);


  // 메세지 타임아웃 설정
  if (configData.msgExistDuration > 0) {
    setTimeout(
      function() { applyMessageRemove(chatOuterBox); },
      configData.msgExistDuration*1000
    );
  }

  // 넘치는 메세지를 삭제
  if((++numChat > configData.numChatMax)) {
    var first = document.getElementsByClassName("chat_outer_box")[0];
    document.getElementById("chat_wrapper").removeChild(first);
    --numChat;
  }

  return chatOuterBox;
}

var concatChatMessage = function(nick, message, data) {
  var lChild = document.getElementById("chat_wrapper").lastChild;
  if (lChild && lChild.getElementsByClassName("chat_nickname_box")[0].innerHTML == nick) {
    if (typeof applyMessage != "undefined") { message = applyMessage(message, data); }
    with (lChild.lower.msg) {
      innerHTML += "\n" + message;
      style.maxHeight = "none";
      style.whiteSpace = "pre-line";
      style.lineHeight = "1.5";
    }
  }
  else { addChatMessage.apply(this, arguments); }
}

var applyReplace = function(message, data){ return message; };
var applyChzzkEmoji = function(message, data){ return message; };
var applyDcCon = function(message, data){ return message; };
var applyMessage = function(message, data) {
  // HTML 이스케이핑
  if ((data.escape == undefined) || (data.escape == true)) {
    message = message.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  message = applyReplace(message, data);
  message = applyChzzkEmoji(message, data);
  message = applyDcCon(message, data);

  return message;
}

/* URL에서 설정값을 가져와 덮어쓰기 */
if (window.location.href.indexOf("?") != -1) {
  var queries = window.location.search;
  if (queries||"".length > 0) {
    queries.slice(1).split("&").forEach( function(queryData) {
      var value = queryData.split("=");
      var key = value.shift();
      value = value[0];

      if (value == undefined) { return; }

      if (key == "scale") {
        if (!isNaN(value)) { window.localStorage.setItem("scale", value); }
      }
      else if (configDefault.hasOwnProperty(key)) {
        switch (key) {
          case "muteUser":
            configData.muteUser = (value==="")? []: value.split(",");
            return;

          default:
            break;
        }

        switch (typeof(configDefault[key])) {
          case "object":
            return;

          case "boolean":
            configData[key] = (value === "true");
            return;

          case "number":
            var numberValue = Number(value);
            if (!isNaN(numberValue)) { configData[key] = numberValue; }
            return;

          case "string":
          default:
            break;
        }

        configData[key] = value;
      }
    } );
  }
}



/* 배율 설정 적용 */
var setScale = function() {
  var scale = window.localStorage.getItem("scale");
  if (!scale) { return; }

  with (document.body.style) {
    width = (10000 / scale) + "%";
    transformOrigin = "left bottom";
    transform = "scale(" + scale/100 + ")";
  }
}
setScale();



/* 설정 파일 확인 및 디버그 내용 출력 함수 정의 */
var completeCount = 0;
var checkComplete = function() {
  /* CSS, 디씨콘, 치지직 이모티콘, 설정 = 4개 */
  var num = 4;
  if (++completeCount == num) {
    var width = Number(getComputedStyle(document.body).width.slice(0,-2));
    width = Math.max(12, parseInt(width/20))+"px";
    var chat = addChatMessage("",
      '<center style="line-height:1em; box-sizing:border-box;">' +

      '<div style="display:inline-block; font-size:' + width + ";" +
                  'padding:0.45em; background:black">' +

      '<div style="padding:0.45em; border:0.1em solid white; ' +
                  "display:inline-block !important; white-space:pre !important;" +
                  "font-size:" + width + "; line-height:1em; color:white !important;" +
                  "font-family:'굴림체' !important; font-weight:normal; " +
                  'text-shadow:.05em .05em dodgerblue;">' +
        "   Ｂ ｒ ｉ ｄ ｇ ｅ    \n ■■□□     □□■■  \n" +
        " ■  □  □ □  ■      \n ■■□□   □  ■      \n" +
        " ■  □  □ □  ■      \n ■■□□□   □□■■。"   +
      "</div></div></center>",
      { escape:false }
    )
    if (chat != null) {
      chat.upper.style.display = "none";
      chat.lower.msg.style.maxHeight = "none";
    }
    checkComplete = function(){};
    initChzzk();
  }
}
if (typeof configData == "undefined") { configData = {}; }
debugLog = function(dat) {};
{
  var configLoadMessage = "";
  var configDataLength = Object.keys(configData).length;

  if (configDataLength == 0) {
    configLoadMessage = "설정 파일(lib/config.js)을 로드하는 데 문제가 생겨 기본 설정을 사용합니다.<br />";
    Object.assign(configData, configDefault);
  }
  else {
    var unloadedConfigs = Object.keys(configDefault).reduce( function(acc, cur) {
      if (configData[cur] === undefined) {
        configData[cur] = JSON.parse(JSON.stringify(configDefault[cur]));
        return (++acc);
      }
      return acc;
    }, 0 );

    if (unloadedConfigs > 0) {
      configLoadMessage = "일부 설정값을 찾을 수 없어 기본값을 사용합니다.<br />";
    }
  }

  if (configData.debugLevel != 0) {
    if (configData.debugLevel == 1) { debugLog = function(dat) { console.log(dat); }; }
    else {
      debugLog = function(dat, unConcat) {
        if (unConcat) {
          addChatMessage("DEBUG", dat,
            { color:"red", escape:false });
        }
        else {
          concatChatMessage("DEBUG", dat,
            { color:"red", escape:false });
        }
      };
    }
  }

  debugLog(configLoadMessage + "설정을 불러왔습니다.");
  checkComplete();
}



/* 지정 메세지 대체 */
if ((configData.replaceMsgs) && (configData.replaceMsgs.length>0)) {
  applyReplace = function(message, data) {
    for(var index in configData.replaceMsgs) {
      var msg = configData.replaceMsgs[index];
      if ( (!msg.nick) || (msg.nick == data.nick) ) {
        if ((msg.to=="{no_display}") && (message.match(msg.orig)!=null)) {
          data.noDisplay = true;
          return message;
        }

        message = message.replace(msg.orig, msg.to);
      }
    }
    return message;
  };
}


/* CSS 로드 */
var loadCss = function(isRetrying) {
  // 재 로드를 위해 기존 css를 제거
  var existings = document.getElementsByClassName("chat_theme");
  for(var index=0; index<existings.length; ++index) {
    existings[index].remove();
  }

  document.head.appendChild( function() {
    if (configData.themeURI == "") { configData.themeURI = "./theme/"; }
    else if (configData.themeURI[configData.themeURI.length-1] != "/") {
      configData.themeURI += "/";
    }

    var ret = document.createElement("link");
    ret.onload = function() {
        debugLog(configData.themeName + " 테마를 적용했습니다.");
        checkComplete();
    };
    ret.onerror = function() {
        debugLog("테마 적용에 실패했습니다.");
        if (isRetrying != true) {
          debugLog("기본 설정으로 테마 설정을 재시도합니다.");
          configData.theme = configDefault.theme;
          loadCss(true);
        }
    };

    ret.rel = "stylesheet";
    ret.href = configData.themeURI + configData.theme + "/theme.css";
    ret.classList.add("chat_theme");

    return ret;
  }() );
};
loadCss();



/* 디씨콘 및 로드 및 적용 */
dcConsData = [];
var loadDcCon = function() {};
if (configData.loadDcCons) {
  loadDcCon = function() {
    var dcConsSubURI = "images/";
    var dcConsMainURI = "";
    if (configData.dcConsURI == "" || configData.dcConsURI == "./") {
      configData.dcConsURI = "./";
      dcConsSubURI = "images/dccon/";
      dcConsMainURI = "lib/";
    }
    else if (configData.dcConsURI[configData.dcConsURI.length-1] != "/") {
      configData.dcConsURI += "/";
    }

    var dcConScript = document.createElement("script");
    dcConScript.type = "text/javascript";
    dcConScript.charset = "utf-8";
    dcConScript.src = configData.dcConsURI + dcConsMainURI + "dccon_list.js?ts=" + new Date().getTime();
    document.body.appendChild(dcConScript);

    dcConScript.onload = function() {
      if (dcConsData.length === 0) { debugLog("디씨콘을 불러오는 데 실패했습니다."); }
      else {
        let keywordsWithIndex = dcConsData.reduce((prev, cur, idx) => {
          const keywords = cur.keywords.map(k => {
            const obj = {};
            obj.dcconIndex = idx;
            obj.keyword = k;
            return obj;
          });
          return [...prev, ...keywords];
        }, []);
        keywordsWithIndex.sort(function(a,b) { return b.keyword.length - a.keyword.length; } );

        applyDcCon = function(message, data) {

          for (const idx in keywordsWithIndex) {
            const keywordData = keywordsWithIndex[idx];
            const keyword = keywordData.keyword;
            if(message.indexOf(`~${keyword}`) !== -1)
            {
              const dccon = dcConsData[keywordData.dcconIndex];

              if(dccon.url !== undefined && typeof(dccon.url) === "string" && dccon.url.startsWith('http'))
              {
                message = message.split(`~${keyword}`).join(`<img class="dccon" src="${dccon.url}" />`);
              }
              else if(dccon.uri !== undefined && typeof(dccon.uri) === "string" && dccon.uri.startsWith('http'))
              {
                message = message.split(`~${keyword}`).join(`<img class="dccon" src="${dccon.uri}" />`);
              }
              else {
                message = message.split(`~${keyword}`).join(`<img class="dccon" src="${configData.dcConsURI + dcConsSubURI + dccon.name}" />`);
              }

            }
          }

          return message;
        };
        debugLog("디씨콘을 적용했습니다.");
        checkComplete();
      }
    };
  };
  loadDcCon();
}
else {
  debugLog("설정에 따라 디씨콘을 적용하지 않았습니다.");
  checkComplete();
}



/* 치지직 이모티콘 적용 활성화
 * CHZZK 채팅 이벤트의 emojis 필드는 { "이모티콘코드": "이미지URL", ... } 형태의 맵.
 * 메시지 내 {: 이모티콘코드 :} 패턴을 이미지 태그로 치환한다.
 */
if (configData.loadChzzkEmojis) {
  applyChzzkEmoji = function(message, data) {
    if (!data.emojis || typeof data.emojis !== "object") { return message; }
    var regex = /\{:([^:]+):\}/g;
    return message.replace(regex, function(match, code) {
      var url = data.emojis[code];
      if (!url) { return ""; }
      return '<img class="chzzk_emoji" src="' + url + '" alt="' + code + '" />';
    });
  };
  debugLog("치지직 이모티콘을 적용했습니다.");
  checkComplete();
}
else {
  debugLog("설정에 따라 치지직 이모티콘을 적용하지 않았습니다.");
  checkComplete();
}



/* 명령어 정의 */
var commandExecute = function(exe, arg) {
  switch (exe) {
  case "clear" :
    document.getElementById("chat_wrapper").innerHTML = "";
    numChat = 0;
    return true;

  case "theme" :
    arg = arg.match(/[a-zA-Z0-9_-]+/)[0];
    if (arg != null) {
      configData.theme = arg.toLowerCase();
      loadCss();
      return true;
    }
    else {
      debugLog("잘못된 테마가 입력되었습니다.");
      return false;
    }

  case "load" :
    if (arg == "" || arg == "디씨콘" || arg == "디시콘" || arg == "dccon") {
      loadDcCon();
      return true;
    }
    break;

  case "scale":
    if (arg == "") {
      debugLog("현재 배율 : " + (window.localStorage.getItem("scale")||100) + "%");
      return true;
    }
    if (!isNaN(arg)) {
      window.localStorage.setItem("scale", Number(arg));
      setScale();
      return true;
    }
    break;

  default:
    break;
  }
  debugLog("잘못된 명령어입니다.");
  return false;
}



/* 로그아웃 버튼 (OBS 마우스 상호작용 이용) */
var logoutBtn = null;
var logoutBtnTimer = null;
var initLogoutButton = function() {
  logoutBtn = document.createElement("button");
  logoutBtn.id = "chzzk_logout_btn";
  logoutBtn.textContent = "로그아웃";
  logoutBtn.style.cssText =
    "position:fixed;top:12px;right:12px;z-index:10000;" +
    "background:rgba(0,0,0,0.6);color:#fff;border:1px solid rgba(255,255,255,0.4);" +
    "padding:6px 14px;border-radius:5px;font-size:13px;cursor:pointer;" +
    "opacity:0;transition:opacity 0.3s;pointer-events:none;";

  logoutBtn.addEventListener("click", function() {
    var chzzkAuth = require("./chzzkAuth");
    chzzkAuth.logout().then(function() {
      window.localStorage.clear();
      location.reload();
    });
  });

  document.body.appendChild(logoutBtn);

  document.addEventListener("mousemove", function() {
    if (logoutBtn) {
      logoutBtn.style.opacity = "0.85";
      logoutBtn.style.pointerEvents = "auto";
      if (logoutBtnTimer) { clearTimeout(logoutBtnTimer); }
      logoutBtnTimer = setTimeout(function() {
        if (logoutBtn) {
          logoutBtn.style.opacity = "0";
          logoutBtn.style.pointerEvents = "none";
        }
      }, 3000);
    }
  });
};
initLogoutButton();



/* 기본 사용자 색상 */
defaultColors = [
  "#FF0000", "#0000FF", "#00FF00", "#B22222", "#FF7F50",
  "#9ACD32", "#FF4500", "#2E8B57", "#DAA520", "#D2691E",
  "#5F9EA0", "#1E90FF", "#FF69B4", "#8A2BE2", "#00FF7F"];

/**
 * 닉네임 기반으로 색상을 자동 배정합니다.
 * @param {string} nick
 * @returns {string} 색상 코드
 */
function getDefaultColorForNick(nick) {
  var n = nick.charCodeAt(0) + (nick.charCodeAt(1) || 0) * new Date().getDate();
  return defaultColors[n % defaultColors.length];
}



/* CHZZK 채팅 연동 초기화 */
var chzzkAuth = require("./chzzkAuth");
var chzzkChat = require("./chzzkChat");

/**
 * CHZZK 채팅 메시지를 처리합니다.
 * @param {object} data - CHZZK 채팅 이벤트 데이터
 */
function handleChzzkChat(data) {
  if (!data) { return; }

  var nick = (data.profile && data.profile.nickname) ? data.profile.nickname : "unknown";
  var displayNick = nick;
  var realNick = configData.useDisplayName ? displayNick : nick;
  var message = data.content || "";

  var chatData = {
    nick: nick,
    message: message,
    escape: true,
    emojis: data.emojis || null,   // { "이모티콘코드": "이미지URL", ... } 맵
    badges: data.profile.badges || null    // 추후 뱃지 표시 구현 시 사용
  };

  // muteUser 적용
  if (configData.muteUser && configData.muteUser.length > 0) {
    var muted = configData.muteUser.find(function(u) {
      return u === nick || u === displayNick;
    });
    if (muted !== undefined) { return; }
  }

  // 개인 색상 (치지직은 별도 색상 정보가 없으므로 닉네임 기반 자동 배정)
  chatData.color = getDefaultColorForNick(realNick);

  // 링크 파싱
  if ((configData.linkReplaceMsg||"").length > 0) {
    var linkRegExp = /^(https?:\/\/)?([A-Za-z0-9#%\-_=+]+\.)+[a-z]{2,}(\/[0-9A-Za-z#%&()+/\-\.:=?@_~]*)?/;
    message.split(/\s/).forEach(function(phrase) {
      if (phrase.match(linkRegExp)) {
        message = message.replace(phrase, configData.linkReplaceMsg);
      }
    });
  }

  // 명령어 파싱 (채팅 서버 권한 구분이 없으므로 CHZZK에서는 메시지 기반으로만 처리)
  if (configData.commands && configData.commands.length > 0) {
    for (var index in configData.commands) {
      var cmd = configData.commands[index];
      if (message.search(cmd.msg) === 0) {
        var cmdText = cmd.exe;
        var cmdArgument = message.split(cmd.msg + " ");
        cmdArgument.shift();
        cmdArgument = cmdArgument.join(cmd.msg + " ");
        commandExecute(cmdText, cmdArgument);
        return;
      }
    }
  }

  addChatMessage(realNick, message, chatData);
}

/**
 * CHZZK 후원 메시지를 처리합니다.
 * @param {object} data - CHZZK 후원 이벤트 데이터
 */
function handleChzzkDonation(data) {
  if (!data) { return; }

  var nick = data.donatorNickname ? data.donatorNickname : "unknown";
  var displayNick = nick;
  var realNick = configData.useDisplayName ? displayNick : nick;
  var message = data.donationText || "";
  var amount = data.payAmount ? Number(data.payAmount) : 0;

  addChatMessage(realNick, message, {
    nick: nick,
    donation: amount,
    color: getDefaultColorForNick(realNick),
    escape: true
  });
}

/**
 * CHZZK 구독 메시지를 처리합니다.
 * @param {object} data - CHZZK 구독 이벤트 데이터
 */
function handleChzzkSubscription(data) {
  if (!data) { return; }

  var nick = data.subscriberNickname ? data.subscriberNickname : "unknown";
  var displayNick = nick;
  var realNick = configData.useDisplayName ? displayNick : nick;
  var months = data.month ? Number(data.month) : 0;
  var tierName = data.tierName ? data.tierName : "";
  var message = `${nick}님이 ${tierName} ${months}개월 구독을 시작했습니다!`;

  addChatMessage(realNick, message, {
    nick: nick,
    subMonths: months,
    color: getDefaultColorForNick(realNick),
    escape: true
  });
}

/**
 * CHZZK 연동을 초기화합니다.
 * 저장된 토큰이 없으면 로그인 오버레이를 표시합니다.
 */
function initChzzk() {
  chzzkAuth.setAuthServerUrl(configData.chzzkAuthServerUrl);
  chzzkChat.setAuthServerUrl(configData.chzzkAuthServerUrl);
  chzzkChat.setChannelId(configData.chzzkChannelId);
  chzzkChat.setRetryInterval(configData.retryInterval);

  debugLog("치지직 채팅 연결을 시도합니다.");

  function doConnect() {
    chzzkAuth.getAccessToken()
      .then(function(accessToken) {
        debugLog("치지직 액세스 토큰을 확인했습니다.");
        return chzzkChat.connect(
          handleChzzkChat,
          handleChzzkDonation,
          handleChzzkSubscription
        );
      })
      .then(function() {
        debugLog("치지직 채팅에 연결했습니다.");
      })
      .catch(function(err) {
        // 토큰이 없거나 만료된 경우 로그인 오버레이 표시
        debugLog("치지직 로그인이 필요합니다.", true);
        chzzkAuth.login()
          .then(function() {
            debugLog("치지직 로그인 완료. 채팅 연결 중...", true);
            return chzzkChat.connect(
              handleChzzkChat,
              handleChzzkDonation,
              handleChzzkSubscription
            );
          })
          .then(function() {
            debugLog("치지직 채팅에 연결했습니다.");
          })
          .catch(function(e) {
            debugLog("치지직 채팅 연결 실패: " + e.message, true);
            // 일정 시간 후 재시도
            setTimeout(doConnect, configData.retryInterval * 1000);
          });
      });
  }

  doConnect();

  // 주기적 토큰 갱신 (백그라운드, 10분마다 확인)
  setInterval(function() {
    if (chzzkAuth.hasStoredToken()) {
      chzzkAuth.getAccessToken().catch(function() {
        // 갱신 실패 시 재로그인 필요 → 다음 doConnect 호출 시 처리됨
      });
    }
  }, 10 * 60 * 1000);
}
