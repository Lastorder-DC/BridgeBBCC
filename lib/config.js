configData = {
  numChatMax        : 20,
  personalColor     : true,
  themeURI          : "",
  theme             : "default",
  themeName         : "",
  msgExistDuration  : 0,
  msgAniDuration    : 0,
  debugLevel        : 2,
  useDisplayName    : true,
  loadDcCons        : true,
  dcConsURI         : "https://yeokka.kro.kr/dccon/",
  chzzkDonationMsg  : "☆ {!0:{amount}원 }후원 ! ☆",
  chzzkSubMsg       : "☆ {!0:{months} 개월 }구독{0: 시작}! ☆",
  linkReplaceMsg    : "[ 링크 ]",
  chzzkChannelId    : "",
  chzzkAuthServerUrl: "http://localhost:3000",
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
