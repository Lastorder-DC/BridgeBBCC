configData = {
  numChatMax        : 20,
  personalColor     : true,
  themeURI          : "https://lastorder.xyz/yeokka/theme/",
  theme             : "splatoon",
  themeName         : "",
  msgExistDuration  : 0,
  msgAniDuration    : 0,
  debugLevel        : 2,
  useDisplayName    : true,
  loadDcCons        : true,
  loadChzzkEmojis   : true,             // 치지직 이모티콘을 이미지로 표시할지
  dcConsURI         : "https://lastorder.xyz/yeokka/dccon/",
  chzzkDonationMsg  : "☆ {!0:{amount}원 }후원 ! ☆",
  chzzkSubMsg       : "☆ {!0:{months} 개월 }구독{0: 시작}! ☆",
  linkReplaceMsg    : "[ 링크 ]",
  chzzkChannelId    : "29b2e3859df5f506a9bad76af7cd21ed",               // [필수] 구독할 치지직 채널 ID (예: "abcdef1234567890")
  chzzkAuthServerUrl: "https://bbcc.lastorder.xyz",
  retryInterval     : 2,
  allMessageHandle  : false,
  muteUser          : [],
  commands          : [
    {exe:"clear", msg:"!!clear"},
    {exe:"theme", msg:"!!theme"},
    {exe:"load", msg:"!!load"},
    {exe:"scale", msg:"!!scale"}
  ],
  replaceMsgs       : [
    {orig:/^!{1,2}[a-zA-Z]+/, to:"{no_display}"}     // 봇 호출 영문 메세지 미표시
  ]
};
