const storyFolder = 'public/story/01';

function image(name) {
  return `${storyFolder}/${name}`;
}

const storyNodes = [
  {
    id: 'pic1',
    blocks: [
      {
        type: 'text',
        text: '晨光透過薄紗窗簾灑落在小屋裡。熊熊從睡夢中醒來，房間溫暖安靜，卻無法帶給他真正的安定。'
      },
      {
        type: 'gallery',
        cards: [
          { image: image('image01.png'), title: 'PIC1 早晨轉醒' }
        ]
      },
      {
        type: 'text',
        text: '熊熊低聲說：「又是一個新的早晨。」走到窗邊時，他忽然想：每天重複相同的模式，我真的滿足於此嗎？'
      }
    ],
    choice: {
      prompt: '疲憊的你會如何選擇？',
      image: image('image01.png'),
      correct: '今天還是請假好了',
      wrong: '還是乖乖去上班吧',
      wrongReply: '甚麼事都沒發生，一天就這樣過去了。邀請你試試另一個回答。',
      successReply: '熊熊沒有再硬撐，他決定停下來看看自己的生活到底出了什麼問題。',
      next: 'pic2'
    }
  },
  {
    id: 'pic2',
    blocks: [
      {
        type: 'text',
        text: '熊熊沿著樹影婆娑的小徑前行。兔子莉莉匆匆朝他揮手：「早安，熊熊！新的一天又開始了！」熊熊只是輕輕回應，眼裡卻沒有平日的光。'
      },
      {
        type: 'gallery',
        cards: [
          { image: image('image02.png'), title: 'PIC2 與 Lily 相遇' }
        ]
      },
      {
        type: 'text',
        text: '彩蛋：天賜良機-親密關係'
      }
    ],
    continue: {
      label: '看看熊熊在辦公室裡發生什麼事',
      next: 'pic3'
    }
  },
  {
    id: 'pic3',
    blocks: [
      {
        type: 'gallery',
        cards: [
          { image: image('image03.png'), title: 'PIC3 空洞工作日' }
        ]
      },
      {
        type: 'text',
        text: '午後陽光灑在桌面上，熊熊機械地敲著鍵盤，心卻早已飄遠。他望向窗外，忍不住喃喃自語：「如果我不是這裡的一份子，我又該在哪裡呢？」'
      }
    ],
    choice: {
      prompt: '熊熊總覺得哪裡不對勁，這時他會怎麼做？',
      image: image('image03.png'),
      correct: '熊熊總覺得哪裡不對勁，決定回家再想想',
      wrong: '眼前的工作比較重要，上班本來就這麼折磨',
      wrongReply: '熊熊繼續了日復一日的社畜生活，沒有任何改變。請你再重新選擇一次吧！',
      successReply: '熊熊終於承認，問題不只是累，而是這條路從來都不像他的路。',
      next: 'pic4'
    }
  },
  {
    id: 'pic4',
    blocks: [
      {
        type: 'gallery',
        cards: [
          { image: image('image04.png'), title: 'PIC4 家族的框架' }
        ]
      },
      {
        type: 'text',
        text: '客廳裡，父母說著「我們已經為你規劃好了一切」。熊熊坐在他們面前，想開口，卻又被那些熟悉的期待壓了回去。'
      }
    ],
    choice: {
      prompt: '面對家人的期待，熊熊的心會更靠近哪一句話？',
      image: image('image04.png'),
      correct: '熊熊難過地想：總覺得爸媽沒有理解我',
      wrong: '熊熊嘆了一口氣：既然他們都這麼說了，那就這樣吧',
      wrongReply: '熊熊繼續過著朝九晚五的上班人生。請你試試看其他選項吧！',
      successReply: '熊熊第一次清楚感受到，原來讓他痛的，不只是安排，而是不被理解。',
      next: 'pic5'
    }
  },
  {
    id: 'pic5',
    blocks: [
      {
        type: 'gallery',
        cards: [
          { image: image('image05.png'), title: 'PIC5 月下獨白' }
        ]
      },
      {
        type: 'text',
        text: '夜裡，熊熊抱著舊書坐在門廊上，對著星空輕聲問自己：「我是在為自己活，還是在滿足他人的期待？」'
      },
      {
        type: 'text',
        text: '他終於說出那句藏在心裡很久的話：「也許，是時候找到屬於自己的路了。」'
      }
    ],
    continue: {
      label: '看看熊熊夢裡出現了什麼',
      next: 'pic6'
    }
  },
  {
    id: 'pic6',
    blocks: [
      {
        type: 'gallery',
        cards: [
          { image: image('image06.png'), title: 'PIC6 夢中的勇者' }
        ]
      },
      {
        type: 'text',
        text: '夢境裡，熊熊穿上閃亮鎧甲，在父母與朋友的祝福下啟程。那一刻，他真正感覺自己像個英雄。'
      },
      {
        type: 'text',
        text: '彩蛋：人見人愛-流體熊'
      }
    ],
    continue: {
      label: '看看夢醒後的熊熊',
      next: 'pic7'
    }
  },
  {
    id: 'pic7',
    blocks: [
      {
        type: 'gallery',
        cards: [
          { image: image('image07.png'), title: 'PIC7 夢醒流淚' }
        ]
      },
      {
        type: 'text',
        text: '熊熊從夢中驚醒，月光落在床邊，淚水不自覺滑落。他終於意識到，那股熱血與渴望從來都沒有真正消失。'
      }
    ],
    choice: {
      prompt: '從這樣的夢境中醒來，你覺得：',
      image: image('image07.png'),
      correct: '我不能再這樣生活下去，我需要找到我的道路，我自己的冒險。',
      wrong: '這個夢好不真實，好難相信這是真的',
      wrongReply: '還在為冒險猶豫嗎？試試看做點什麼不一樣的吧！',
      successReply: '熊熊終於不再把這份渴望當成幻想，而是當成召喚。',
      next: 'pic8'
    }
  },
  {
    id: 'pic8',
    blocks: [
      {
        type: 'text',
        text: '第二天清晨，熊熊帶著筆記本走進客廳。他深吸一口氣，終於對父母說出自己想探索世界、尋找意義的願望。'
      },
      {
        type: 'gallery',
        cards: [
          { image: image('image08.png'), title: 'PIC8 衝突與爭執' }
        ]
      },
      {
        type: 'text',
        text: '父母的擔憂與否定一股腦壓了下來。熊熊心裡很痛，卻也知道自己好不容易才鼓起勇氣走到這一步。'
      }
    ],
    choice: {
      prompt: '和家人發生衝突，讓你覺得：',
      image: image('image08.png'),
      correct: '即使他們這麼說，我也要努力試試看！',
      wrong: '也許這麼做真的太衝動了',
      wrongReply: '一直以來總是努力達成家人期待的你真是辛苦了。相信自己，試著冒險一次吧！',
      successReply: '熊熊雖然難受，卻沒有再把自己的夢收回去。',
      next: 'pic9'
    }
  },
  {
    id: 'pic9',
    blocks: [
      {
        type: 'gallery',
        cards: [
          { image: image('image09.png'), title: 'PIC9 流星許願' }
        ]
      },
      {
        type: 'text',
        text: '晦暗夜空下，一顆流星突然劃過。熊熊抱著筆記本抬頭，心裡閃過一絲久違的希望。'
      }
    ],
    choice: {
      prompt: '看到流星的你，會想到什麼？',
      image: image('image09.png'),
      correct: '即使面對阻力，我也會勇敢地走自己的路',
      wrong: '這也許是吉兆，代表之後會越來越順利的',
      wrongReply: '熊熊低語：「如果這顆流星能實現我的願望，那就是讓我找到屬於自己的路，追尋我的夢想。」',
      successReply: '他知道，真正能改變人生的，不是吉兆，而是自己跨出去的勇氣。',
      next: 'pic10'
    }
  },
  {
    id: 'pic10',
    blocks: [
      {
        type: 'gallery',
        cards: [
          { image: image('image10.png'), title: 'PIC10 與河狸對話' }
        ]
      },
      {
        type: 'text',
        text: '河狸聽完熊熊的困惑後說：「迷惘的時候，可以先去做自己熱愛的事。熱情常常藏在你最自然的行動裡。」'
      },
      {
        type: 'text',
        text: '熊熊點點頭，第一次覺得答案也許不在遠方，而在日常裡那些被忽略的喜歡。'
      }
    ],
    continue: {
      label: '再去聽聽別的動物怎麼說',
      next: 'pic11'
    }
  },
  {
    id: 'pic11',
    blocks: [
      {
        type: 'gallery',
        cards: [
          { image: image('image11.png'), title: 'PIC11 貓頭鷹的提醒' }
        ]
      },
      {
        type: 'text',
        text: '貓頭鷹慢慢睜開眼睛，對熊熊說：「探索內心的聲音非常重要。你可以每天記錄感受，久了就會知道哪些事讓你真正充實。」'
      },
      {
        type: 'text',
        text: '這句話像一顆小石子，穩穩落進熊熊心裡。'
      }
    ],
    continue: {
      label: '看看後來蜜蜂又說了什麼',
      next: 'pic12'
    }
  },
  {
    id: 'pic12',
    blocks: [
      {
        type: 'gallery',
        cards: [
          { image: image('image12.png'), title: 'PIC12 漫步回家' }
        ]
      },
      {
        type: 'text',
        text: '蜜蜂提醒他：「不要害怕失敗，每一次嘗試都是向成功邁進的一步。」回家的森林路上，熊熊反覆想著大家的建議，心情比昨天輕了一些。'
      },
      {
        type: 'text',
        text: '熊熊心想：也許我需要把這些方法結合起來，探索出屬於自己的道路。'
      }
    ],
    continue: {
      label: '看看熊熊怎麼踏出第一步',
      next: 'pic13'
    }
  },
  {
    id: 'pic13',
    blocks: [
      {
        type: 'gallery',
        cards: [
          { image: image('image13.png'), title: 'PIC13 啟程與送別' }
        ]
      },
      {
        type: 'text',
        text: '熊熊整理好背包，站在門口與父母道別。害怕還在，但他知道，只有出發，才有可能找到自己的答案。'
      }
    ],
    choice: {
      prompt: '對於未知的冒險感到焦慮與擔心嗎？',
      image: image('image13.png'),
      correct: '謝謝你們，我會記得的。我必須這麼做，為了自己找到真正的快樂和意義。',
      wrong: '謝謝你們，記得幫我留一塊蜂蜜蛋糕。',
      wrongReply: '踏出那一步需要很大的勇氣。試著和熊熊一起重新出發吧！',
      successReply: '熊熊擁抱父母後轉身上路。從這一刻起，他的人生開始真正屬於自己。',
      next: 'pic14'
    }
  },
  {
    id: 'pic14',
    blocks: [
      {
        type: 'gallery',
        cards: [
          { image: image('image14.png'), title: 'PIC14 篝火與自由' }
        ]
      },
      {
        type: 'text',
        text: '夜幕降臨，熊熊和旅途中認識的新朋友圍著篝火聊天。火光映在臉上，他第一次感到一種帶著未知的自由。'
      }
    ],
    choice: {
      prompt: '圍著篝火的此刻，你更靠近哪一句心聲？',
      image: image('image14.png'),
      correct: '我從沒想過，出發的這一步會讓我感到如此的自由和快樂',
      wrong: '在森林裡總覺得多少有點不安，開始有點想家了',
      wrongReply: '旅程才剛開始，在這裡放棄有點可惜。想邀請你一起繼續這趟旅程吧！',
      successReply: '熊熊發現，自由不是沒有害怕，而是帶著害怕仍願意往前走。',
      next: 'pic15'
    }
  },
  {
    id: 'pic15',
    blocks: [
      {
        type: 'gallery',
        cards: [
          { image: image('image15.png'), title: 'PIC15 山崖的險峻' }
        ]
      },
      {
        type: 'text',
        text: '前方山崖陡峭，樹木倒下擋住去路。熊熊喘著氣，卻沒有立刻退後。他知道，真正的冒險從來不只靠熱血。'
      }
    ],
    choice: {
      prompt: '遇到障礙的你覺得：',
      image: image('image15.png'),
      correct: '我不會讓這些小障礙阻止我的。',
      wrong: '早知道應該先做好準備再出門的',
      wrongReply: '旅程中處處充滿挑戰，雖然遇到阻礙總讓人氣餒，但我相信你可以的！',
      successReply: '熊熊用盡全力清開障礙，也清出了一條屬於自己的路。',
      next: 'pic16'
    }
  },
  {
    id: 'pic16',
    blocks: [
      {
        type: 'gallery',
        cards: [
          { image: image('image16.png'), title: 'PIC16 信心與力量' }
        ]
      },
      {
        type: 'text',
        text: '篝火旁，熊熊回顧這一天的挑戰，心裡沒有被擊倒，反而更踏實了。他第一次清楚感受到：原來我真的做得到。'
      }
    ],
    continue: {
      label: '陪熊熊走向高山之巔',
      next: 'pic17'
    }
  },
  {
    id: 'pic17',
    blocks: [
      {
        type: 'gallery',
        cards: [
          { image: image('image17.png'), title: 'PIC17 站上高山之巔' }
        ]
      },
      {
        type: 'text',
        text: '清晨，熊熊終於抵達高山之巔。視野在他腳下展開，他深吸一口氣：「這是我一生中從未見過的美景。」'
      },
      {
        type: 'text',
        text: '彩蛋：自我提升-職涯'
      }
    ],
    continue: {
      label: '走進神秘洞穴',
      next: 'pic18'
    }
  },
  {
    id: 'pic18',
    blocks: [
      {
        type: 'gallery',
        cards: [
          { image: image('image18.png'), title: 'PIC18 洞穴入口' },
          { image: image('image18-2.png'), title: 'PIC18 洞穴深處' }
        ]
      },
      {
        type: 'text',
        text: '熊熊發現一個被奇花異草圍繞的洞穴。柔光從洞口流出，他壓低聲音說：「這裡一定藏著什麼秘密。」'
      }
    ],
    continue: {
      label: '看看洞穴最深處有什麼',
      next: 'pic19'
    }
  },
  {
    id: 'pic19',
    blocks: [
      {
        type: 'gallery',
        cards: [
          { image: image('image19.png'), title: 'PIC19 鏡中倒影' }
        ]
      },
      {
        type: 'text',
        text: '洞穴最深處沒有金銀財寶，只有一面鏡子。鏡中的熊熊成熟、自信、眼神堅定，像在靜靜等待他自己看懂這一切。'
      }
    ],
    choice: {
      prompt: '望著鏡中的自己，熊熊第一個反應是：',
      image: image('image19.png'),
      correct: '這是...我？！',
      wrong: '這是...寶藏？！',
      wrongReply: '熊熊先是愣住，以為眼前是寶藏。但很快他發現，真正發亮的不是財寶，而是自己一路走來長出的心。',
      successReply: '熊熊終於明白：真正的寶藏不是金銀財寶，而是自己的心、自由意志、自我和勇氣。',
      next: 'pic20'
    }
  },
  {
    id: 'pic20',
    blocks: [
      {
        type: 'gallery',
        cards: [
          { image: image('image20.png'), title: 'PIC20 自我肯定' }
        ]
      },
      {
        type: 'text',
        text: '熊熊帶著這份理解回到人生裡。世界沒有突然變簡單，但他終於知道，自己可以按照意志去活。'
      }
    ],
    endingText: '《熊熊尋心：一隻熊的旅程》到這裡告一段落。真正的寶藏，是你願意成為自己。輸入「開始故事」可以重新閱讀。'
  }
];

const storyMap = Object.fromEntries(storyNodes.map((node) => [node.id, node]));

module.exports = {
  storyNodes,
  storyMap,
  storyStartId: 'pic1'
};
