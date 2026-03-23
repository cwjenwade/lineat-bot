const storyFolder = 'public/story/01';

function image(name) {
  return `${storyFolder}/${name}`;
}

const storyNodes = [
  {
    id: 'pic1',
    blocks: [
      {
        type: 'gallery',
        cards: [
          { image: image('image01.png'), title: '熊熊', body: '「又是一個新的早晨。」' },
          { image: image('image01.png'), title: '旁白', body: '晨光透過薄紗窗簾灑進小屋。熊熊醒來時，眼神卻空洞而迷茫。' },
          { image: image('image01.png'), title: '熊熊的內心', body: '「每天重複相同的模式，是否我真的滿足於此？」' },
          { image: image('image01.png'), title: '早餐時刻', body: '他煮了蜂蜜咖啡、抹好吐司，卻只是靜靜望著窗外。至少，咖啡和吐司從不讓他失望。' }
        ]
      }
    ],
    choice: {
      prompt: '疲憊的你會如何選擇？',
      image: image('image01.png'),
      correct: '今天還是請假好了',
      wrong: '還是乖乖去上班吧',
      wrongReply: '甚麼事都沒發生，一天就這樣過去了。邀請你試試另一個回答。',
      successReply: '熊熊決定停下來，不再假裝自己只是普通的累。',
      next: 'pic2'
    }
  },
  {
    id: 'pic2',
    blocks: [
      {
        type: 'gallery',
        cards: [
          { image: image('image02.png'), title: '旁白', body: '熊熊沿著樹影婆娑的小徑前行，其他動物都匆匆趕往各自的目的地。' },
          { image: image('image02.png'), title: '莉莉', body: '「早安，熊熊！新的一天又開始了！」' },
          { image: image('image02.png'), title: '熊熊', body: '「早安，朋友。」' },
          { image: image('image02.png'), title: '旁白', body: '他的聲音很平靜，但眼裡沒有生機。' }
        ]
      },
      { type: 'text', text: '彩蛋：天賜良機-親密關係' }
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
          { image: image('image03.png'), title: '旁白', body: '電腦螢幕閃著未完成的報表。熊熊試圖集中精神，心思卻不斷飄遠。' },
          { image: image('image03.png'), title: '熊熊', body: '「如果我不是這裡的一份子，我又該在哪裡呢？」' }
        ]
      }
    ],
    choice: {
      prompt: '熊熊總覺得哪裡不對勁，這時他會怎麼做？',
      image: image('image03.png'),
      correct: '熊熊總覺得哪裡不對勁，決定回家再想想',
      wrong: '眼前的工作比較重要，上班本來就這麼折磨',
      wrongReply: '熊熊繼續了日復一日的社畜生活，沒有任何改變。請你再重新選擇一次吧！',
      successReply: '熊熊終於承認，問題不是一時情緒，而是這條路從來都不像他的路。',
      next: 'pic4'
    }
  },
  {
    id: 'pic4',
    blocks: [
      {
        type: 'gallery',
        cards: [
          { image: image('image04.png'), title: '熊媽媽', body: '「熊熊，我們一直為你感到光榮。你是我們家的驕傲。」' },
          { image: image('image04.png'), title: '熊爸爸', body: '「我們已經為你的未來規劃好了一切，你只需要照著走就好。」' },
          { image: image('image04.png'), title: '熊熊', body: '「但是我……」' },
          { image: image('image04.png'), title: '旁白', body: '熊熊欲言又止，最後還是沉默了。眼前明明是家，心裡卻像隔著一道很遠的牆。' }
        ]
      }
    ],
    choice: {
      prompt: '面對家人的期待，熊熊的心會更靠近哪一句話？',
      image: image('image04.png'),
      correct: '熊熊難過地想：總覺得爸媽沒有理解我',
      wrong: '熊熊嘆了一口氣：既然他們都這麼說了，那就這樣吧',
      wrongReply: '熊熊繼續過著朝九晚五的上班人生。請你試試看其他選項吧！',
      successReply: '熊熊第一次清楚感受到，真正讓他痛的，是不被理解。',
      next: 'pic5'
    }
  },
  {
    id: 'pic5',
    blocks: [
      {
        type: 'gallery',
        cards: [
          { image: image('image05.png'), title: '熊熊的內心', body: '「這條為我鋪設的路，真的是我想要的嗎？」' },
          { image: image('image05.png'), title: '熊熊的內心', body: '「我是在為自己活，還是在滿足他人的期待？」' },
          { image: image('image05.png'), title: '熊熊', body: '「也許，是時候找到屬於自己的路了。」' }
        ]
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
          { image: image('image06.png'), title: '夢境', body: '熊熊穿上閃亮鎧甲，站在村莊中央，像他一直夢想成為的勇者。' },
          { image: image('image06.png'), title: '熊爸爸', body: '「去吧，我的兒子，成為你夢想中的勇者！」' },
          { image: image('image06.png'), title: '熊媽媽', body: '「無論你去到哪裡，我們的愛和祝福都與你同在。」' },
          { image: image('image06.png'), title: '好友們', body: '「熊熊，你是我們的英雄，你的勇氣將照亮你的道路！」' },
          { image: image('image06.png'), title: '村民', body: '「祝你一路平安，真正的勇者！」' }
        ]
      },
      { type: 'text', text: '彩蛋：人見人愛-流體熊' }
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
          { image: image('image07.png'), title: '旁白', body: '熊熊從夢中驚醒，望著窗外皎潔月光，淚水不自覺滑落。' },
          { image: image('image07.png'), title: '熊熊', body: '「那感覺，如此真實，如此強烈……我何時遺失了這種激情？」' }
        ]
      }
    ],
    choice: {
      prompt: '從這樣的夢境中醒來，你覺得：',
      image: image('image07.png'),
      correct: '我不能再這樣生活下去，我需要找到我的道路，我自己的冒險。',
      wrong: '這個夢好不真實，好難相信這是真的',
      wrongReply: '還在為冒險猶豫嗎？試試看做點什麼不一樣的吧！',
      successReply: '熊熊決定不再壓抑那股甦醒的力量。',
      next: 'pic8'
    }
  },
  {
    id: 'pic8',
    blocks: [
      {
        type: 'gallery',
        cards: [
          { image: image('image08.png'), title: '旁白', body: '隔天清晨，熊熊帶著筆記本走進客廳，準備第一次為自己發聲。' },
          { image: image('image08.png'), title: '熊熊', body: '「爸爸，媽媽，我有自己的夢想和目標。我想去探索世界，尋找屬於我的意義。」' },
          { image: image('image08.png'), title: '熊爸爸', body: '「這些夢想聽起來像是逃避現實，你真的考慮清楚了嗎？」' },
          { image: image('image08.png'), title: '熊媽媽', body: '「你現在的生活已經很好了，為什麼要去做這種事？」' },
          { image: image('image08.png'), title: '熊熊的內心', body: '好不容易鼓起勇氣說了，結果又被反對。接下來該怎麼辦？' }
        ]
      }
    ],
    choice: {
      prompt: '和家人發生衝突，讓你覺得：',
      image: image('image08.png'),
      correct: '即使他們這麼說，我也要努力試試看！',
      wrong: '也許這麼做真的太衝動了',
      wrongReply: '一直以來總是努力達成家人期待的你真是辛苦了。相信自己，試著冒險一次吧！',
      successReply: '熊熊雖然難受，卻沒有再把夢收回去。',
      next: 'pic9'
    }
  },
  {
    id: 'pic9',
    blocks: [
      {
        type: 'gallery',
        cards: [
          { image: image('image09.png'), title: '旁白', body: '晦暗天空像他此刻的心情。突然，一顆流星劃過夜空。' },
          { image: image('image09.png'), title: '熊熊', body: '「如果這顆流星能實現我的願望，那就是讓我找到屬於自己的路。」' }
        ]
      }
    ],
    choice: {
      prompt: '看到流星的你，會想到什麼？',
      image: image('image09.png'),
      correct: '即使面對阻力，我也會勇敢地走自己的路',
      wrong: '這也許是吉兆，代表之後會越來越順利的',
      wrongReply: '熊熊知道，真正能改變人生的，不是吉兆，而是自己跨出去的勇氣。',
      successReply: '他把願望收進心裡，也把勇氣慢慢點亮了。',
      next: 'pic10'
    }
  },
  {
    id: 'pic10',
    blocks: [
      {
        type: 'gallery',
        cards: [
          { image: image('image10.png'), title: '熊熊', body: '「嗨，河狸，我正在尋找自己的人生方向，你能給我一些建議嗎？」' },
          { image: image('image10.png'), title: '河狸', body: '「當你感到迷茫時，可以試著做一些自己熱愛的事物。」' },
          { image: image('image10.png'), title: '河狸', body: '「像我小時候總是喜歡建造東西，後來才發現那就是我真正的熱情。」' },
          { image: image('image10.png'), title: '熊熊', body: '「原來如此。也許我也該去做一些我喜歡的事情。」' }
        ]
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
          { image: image('image11.png'), title: '鹿', body: '「放慢腳步，靜靜觀察和思考，可以幫助你找到自己的方向。」' },
          { image: image('image11.png'), title: '貓頭鷹', body: '「探索自己內心的聲音非常重要。從不同的經驗中，去找到自己真正想要的。」' },
          { image: image('image11.png'), title: '貓頭鷹', body: '「你可以每天記錄感受和想法，久了就會知道什麼讓你最充實。」' },
          { image: image('image11.png'), title: '熊熊', body: '「我明白了，我會開始記錄自己的感受。」' }
        ]
      }
    ],
    continue: {
      label: '看看蜜蜂又提醒了什麼',
      next: 'pic12'
    }
  },
  {
    id: 'pic12',
    blocks: [
      {
        type: 'gallery',
        cards: [
          { image: image('image12.png'), title: '蜜蜂', body: '「不要害怕失敗，因為每一次嘗試都是向成功邁進的一步。」' },
          { image: image('image12.png'), title: '蜜蜂', body: '「當你發現此路不通的時候，代表下一次嘗試會讓你更接近目標。」' },
          { image: image('image12.png'), title: '熊熊的內心', body: '每個動物的建議都很有啟發性，也許我需要把這些方法結合起來。' }
        ]
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
          { image: image('image13.png'), title: '熊爸爸', body: '「兒子，你真的決定了嗎？外面的世界很複雜。」' },
          { image: image('image13.png'), title: '熊媽媽', body: '「熊熊，不管你去哪裡，記得，家永遠是你的避風港。」' },
          { image: image('image13.png'), title: '旁白', body: '熊熊拖著行李站在門口。害怕還在，但他的心已經準備出發。' }
        ]
      }
    ],
    choice: {
      prompt: '對於未知的冒險感到焦慮與擔心嗎？',
      image: image('image13.png'),
      correct: '謝謝你們，我會記得的。我必須這麼做，為了自己找到真正的快樂和意義。',
      wrong: '謝謝你們，記得幫我留一塊蜂蜜蛋糕。',
      wrongReply: '踏出那一步需要很大的勇氣。試著和熊熊一起重新出發吧！',
      successReply: '熊熊轉身上路。這一步，也許最難，卻最真實。',
      next: 'pic14'
    }
  },
  {
    id: 'pic14',
    blocks: [
      {
        type: 'gallery',
        cards: [
          { image: image('image14.png'), title: '旁白', body: '夜幕降臨，熊熊和新朋友們圍著篝火聊天，火光映在臉上。' },
          { image: image('image14.png'), title: '熊熊', body: '「我從沒想過，出發的這一步會讓我感到如此的自由和快樂。」' }
        ]
      }
    ],
    choice: {
      prompt: '圍著篝火的此刻，你更靠近哪一句心聲？',
      image: image('image14.png'),
      correct: '我從沒想過，出發的這一步會讓我感到如此的自由和快樂',
      wrong: '在森林裡總覺得多少有點不安，開始有點想家了',
      wrongReply: '旅程才剛開始，在這裡放棄有點可惜。想邀請你一起繼續這趟旅程吧！',
      successReply: '熊熊第一次感覺到，自由並不是遠方，而是在走上自己的路之後。 ',
      next: 'pic15'
    }
  },
  {
    id: 'pic15',
    blocks: [
      {
        type: 'gallery',
        cards: [
          { image: image('image15.png'), title: '旁白', body: '山崖陡峭、倒木擋路，真正的挑戰終於來了。' },
          { image: image('image15.png'), title: '熊熊', body: '「我不會讓這些小障礙阻止我的。」' }
        ]
      },
      { type: 'text', text: '彩蛋：天助自助-人生意義' }
    ],
    choice: {
      prompt: '遇到障礙的你覺得：',
      image: image('image15.png'),
      correct: '我不會讓這些小障礙阻止我的。',
      wrong: '早知道應該先做好準備再出門的',
      wrongReply: '旅程中處處充滿挑戰，雖然遇到阻礙總讓人氣餒，但我相信你可以的！',
      successReply: '熊熊用盡全力清理前路，也清出了新的信心。',
      next: 'pic16'
    }
  },
  {
    id: 'pic16',
    blocks: [
      {
        type: 'gallery',
        cards: [
          { image: image('image16.png'), title: '熊熊的內心', body: '「今天的挑戰讓我更加堅信，我有能力克服任何困難。」' },
          { image: image('image16.png'), title: '熊熊的內心', body: '「我的道路也許不易，但我知道這是通往我夢想的路。」' }
        ]
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
          { image: image('image17.png'), title: '旁白', body: '長途跋涉後，熊熊終於抵達高山之巔，整片森林都在腳下展開。' },
          { image: image('image17.png'), title: '熊熊', body: '「這是我一生中從未見過的美景。」' }
        ]
      },
      { type: 'text', text: '彩蛋：自我提升-職涯' }
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
          { image: image('image18.png'), title: '洞穴入口', body: '山頂上藏著一個神秘洞穴，洞口被奇花異草與柔光包圍。' },
          { image: image('image18-2.png'), title: '熊熊', body: '「這裡一定藏著什麼秘密。」' }
        ]
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
          { image: image('image19.png'), title: '旁白', body: '洞穴最深處沒有金銀財寶，只有一面鏡子。鏡中的熊熊成熟、自信而堅定。' },
          { image: image('image19.png'), title: '熊熊', body: '「這是……我？！」' }
        ]
      }
    ],
    choice: {
      prompt: '望著鏡中的自己，熊熊第一個反應是：',
      image: image('image19.png'),
      correct: '這是...我？！',
      wrong: '這是...寶藏？！',
      wrongReply: '熊熊先愣住，以為自己找到了寶藏。但很快他明白，真正發亮的不是財寶，而是一路走來長出的心。',
      successReply: '熊熊終於懂了：真正的寶藏不是金銀財寶，而是自己的心、自由意志、自我和勇氣。',
      next: 'pic20'
    }
  },
  {
    id: 'pic20',
    blocks: [
      {
        type: 'gallery',
        cards: [
          { image: image('image20.png'), title: '熊熊', body: '帶著這份理解回到生活裡，熊熊終於知道，自己可以按照意志去活。' },
          { image: image('image20.png'), title: '熊熊', body: '「真正的旅程，是對內心的探索，找到自己的本質。」' }
        ]
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
