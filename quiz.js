(() => {
  "use strict";

  const DATA = window.JLPTData;
  if (!DATA) {
    console.error("window.JLPTData가 로드되지 않았습니다. data.js 로드 순서를 확인하세요.");
    return;
  }

  // =========================================================
  // 1. 소스 교재 기반 실전 문법 기출 문항 은행 (問題 7 & 問題 8)
  // 소스: 확인문제 01~02 및 제1회 실전모의테스트
  // =========================================================
  const OFFICIAL_EXAM_BANK = {
    // 問題 7: 문법 형식 판단 (빈칸 ( ) 채우기)
    q7: [
      {
        id: "ex-q7-01",
        grammarId: "g-002",
        type: "q7",
        typeLabel: "問題 7 (文法形式の判断)",
        directive: "次の文の ( ) に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。",
        sentence: "彼女は悲しみの ( )、声が出なくなってしまった。",
        choices: ["まで", "わけ", "あまり", "ばかり"],
        correctIndex: 2, // 3번 (あまり)
        answerWord: "〜あまり",
        translation: "그녀는 너무 슬픈 나머지 목소리가 나오지 않게 되었다.",
        explanation: "「명사 + の + あまり」: 극도의 감정이나 상태로 인해 비정상적인 결과가 초래됨을 나타냅니다."
      },
      {
        id: "ex-q7-02",
        grammarId: "g-005",
        type: "q7",
        typeLabel: "問題 7 (文法形式の判断)",
        directive: "次の文の ( ) に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。",
        sentence: "彼女は頭がいい ( ) 実行力もあるから、みんなに信頼されている。",
        choices: ["ために", "うえに", "ものの", "ほどの"],
        correctIndex: 1, // 2번 (うえに)
        answerWord: "〜上に",
        translation: "그녀는 머리가 좋은 데다가 실행력도 있어서 모두에게 신뢰받고 있다.",
        explanation: "「い형용사 + 上に」: 좋은 점이나 나쁜 점을 덧붙여 나열할 때 씁니다 (~한 데다가)."
      },
      {
        id: "ex-q7-03",
        grammarId: "g-007",
        type: "q7",
        typeLabel: "問題 7 (文法形式の判断)",
        directive: "次の文の ( ) に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。",
        sentence: "両親が元気な ( )、色んなところへ旅行に行きたいと思っている。",
        choices: ["ところに", "うちに", "なかに", "あとに"],
        correctIndex: 1, // 2번 (うちに)
        answerWord: "〜うちに",
        translation: "부모님이 건강하실 때 여러 곳으로 여행을 가고 싶다고 생각하고 있다.",
        explanation: "「な형용사 + な + うちに」: 특정 상태가 유지되고 있는 동안에 기회를 놓치지 않고 동작을 함을 뜻합니다."
      },
      {
        id: "ex-q7-04",
        grammarId: "g-003",
        type: "q7",
        typeLabel: "問題 7 (文法形式の判断)",
        directive: "次の文の ( ) に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。",
        sentence: "ここ数年、冷夏が続き、野菜の値段が ( ) 一方だ。",
        choices: ["あがる", "あがり", "あがった", "あがるの"],
        correctIndex: 0, // 1번 (あがる)
        answerWord: "〜一方だ",
        translation: "최근 몇 년간 냉하가 지속되어 채소 가격이 오르기만 한다.",
        explanation: "「동사 사전형 + 一方だ」: 특정 변화가 한 방향으로만 계속 진행됨을 나타냅니다."
      },
      {
        id: "ex-q7-05",
        grammarId: "g-014",
        type: "q7",
        typeLabel: "問題 7 (文法形式の判断)",
        directive: "次の文の ( ) に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。",
        sentence: "5年前に大病をしてから、すっかり病気 ( ) になった。",
        choices: ["ぐせ", "ふう", "だけ", "がち"],
        correctIndex: 3, // 4번 (がち)
        answerWord: "〜がち",
        translation: "5년 전에 큰 병을 앓고 나서 완전히 병치레가 잦아졌다.",
        explanation: "「명사 + がち」: 부정적인 상태나 경향을 띠기 쉬움을 나타냅니다 (病気がち: 병치레가 잦음)."
      },
      {
        id: "ex-q7-06",
        grammarId: "g-009",
        type: "q7",
        typeLabel: "問題 7 (文法形式の判断)",
        directive: "次の文の ( ) に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。",
        sentence: "彼はコーヒーに口をつけるか ( ) かのうちにあわてて店を出ていった。",
        choices: ["つける", "つけない", "つけている", "つけていない"],
        correctIndex: 1, // 2번 (つけない)
        answerWord: "〜か〜ないかのうちに",
        translation: "그는 커피에 입을 대자마자 허둥지둥 가게를 나갔다.",
        explanation: "「동사 사전형 + か + 동사 ない형 + かのうちに」: 앞 동작이 끝나기가 무섭게 다음 사태가 일어남."
      },
      {
        id: "ex-q7-07",
        grammarId: "g-006",
        type: "q7",
        typeLabel: "問題 7 (文法形式の判断)",
        directive: "次の文の ( ) に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。",
        sentence: "受験すると決めた ( ) は、全力をつくすつもりです。",
        choices: ["まで", "わけ", "うえ", "ほど"],
        correctIndex: 2, // 3번 (うえ)
        answerWord: "〜上は",
        translation: "수험을 치르기로 결정한 이상은 전력을 다할 생각입니다.",
        explanation: "「동사 た형 + 上は」: ~한 이상은 (당연한 각오나 의무 표현과 호응)."
      },
      {
        id: "ex-q7-08",
        grammarId: "g-022",
        type: "q7",
        typeLabel: "問題 7 (文法形式の判断)",
        directive: "次の文の ( ) に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。",
        sentence: "経験がない ( )、失敗するとはかぎらない。",
        choices: ["からして", "からには", "からすると", "からといって"],
        correctIndex: 3, // 4번 (からといって)
        answerWord: "〜からといって",
        translation: "경험이 없다고 해서 반드시 실패하는 것은 아니다.",
        explanation: "「보통형 + からといって」: ~라고 해서 (뒤에 〜とは限らない 등 부분 부정과 호응)."
      },
      {
        id: "ex-q7-09",
        grammarId: "g-023",
        type: "q7",
        typeLabel: "問題 7 (文法形式の判断)",
        directive: "次の文の ( ) に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。",
        sentence: "いったん引き受けた ( )、最後までやり通すべきです。",
        choices: ["ためには", "わけには", "からには", "うちには"],
        correctIndex: 2, // 3번 (からには)
        answerWord: "〜からには",
        translation: "일단 맡은 이상은 끝까지 완수해야 마땅합니다.",
        explanation: "「동사 た형 + からには」: ~한 이상은 (강한 의무·의지 표현 〜べきだ 호응)."
      },
      {
        id: "ex-q7-10",
        grammarId: "g-010",
        type: "q7",
        typeLabel: "問題 7 (文法形式の判断)",
        directive: "次の文の ( ) に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。",
        sentence: "一生懸命、看病した ( ) があって、子供の熱は下がりました。",
        choices: ["から", "がち", "かい", "こそ"],
        correctIndex: 2, // 3번 (かい)
        answerWord: "〜かいがある",
        translation: "열심히 간호한 보람이 있어서 아이의 열이 내렸습니다.",
        explanation: "「동사 た형 + かいがあって」: 노력이나 고생 끝에 보람찬 결과를 얻었음을 뜻합니다."
      },
      {
        id: "ex-q7-11",
        grammarId: "g-004",
        type: "q7",
        typeLabel: "問題 7 (文法形式の判断)",
        directive: "次の文の ( ) に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。",
        sentence: "両親と話し合った ( )、進学先を決めました。",
        choices: ["うえで", "あまり", "かぎり", "かというと"],
        correctIndex: 0, // 1번 (うえで)
        answerWord: "〜上で",
        translation: "부모님과 상의한 후에 진학할 곳을 결정했습니다.",
        explanation: "「동사 た형 + 上で」: 앞선 행동을 전제 또는 심사숙고한 후 다음 단계로 나아감을 뜻합니다."
      },
      {
        id: "ex-q7-12",
        grammarId: "g-008",
        type: "q7",
        typeLabel: "問題 7 (文法形式の判断)",
        directive: "次の文の ( ) に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。",
        sentence: "生まれて3か月未満の赤ちゃんには3時間 ( ) ミルクをあげなければなりません。",
        choices: ["がら", "こそ", "おきに", "からして"],
        correctIndex: 2, // 3번 (おきに)
        answerWord: "〜おきに",
        translation: "생후 3개월 미만의 아기에게는 3시간 간격으로 분유를 주어야 합니다.",
        explanation: "「수사/시간 단위 + おきに」: 일정한 시간적·공간적 간격을 두고 되풀이됨을 뜻합니다."
      },
      {
        id: "ex-q7-13",
        grammarId: "g-011",
        type: "q7",
        typeLabel: "問題 7 (文法形式の判断)",
        directive: "次の文の ( ) に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。",
        sentence: "ゆうべ私が調べた ( )、工場の機械に問題はなかったのです。",
        choices: ["かぎりでは", "次第では", "うえでは", "ようでは"],
        correctIndex: 0, // 1번 (かぎりでは)
        answerWord: "〜かぎりでは",
        translation: "어젯밤 제가 조사한 바로는 공장 기계에 문제는 없었습니다.",
        explanation: "「동사 た형 + かぎりでは」: 자신이 조사하거나 파악한 정보 범위 내에서는."
      },
      {
        id: "ex-q7-14",
        grammarId: "g-012",
        type: "q7",
        typeLabel: "問題 7 (文法形式の判断)",
        directive: "次の文の ( ) に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。",
        sentence: "テーブルの上に ( ) ケーキが置いてあります。",
        choices: ["食べぬいた", "食べかけの", "食べきった", "食べはじめの"],
        correctIndex: 1, // 2번 (食べかけの)
        answerWord: "〜かけの",
        translation: "식탁 위에 먹다 만 케이크가 놓여 있습니다.",
        explanation: "「동사 ます형 + かけの + 명사」: 어떤 동작을 하다가 도중에 중단한 상태를 뜻합니다."
      },
      {
        id: "ex-q7-15",
        grammarId: "g-020",
        type: "q7",
        typeLabel: "問題 7 (文法形式の判断)",
        directive: "次の文の ( ) に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。",
        sentence: "森田さんのお父さんは、声 ( ) やさしそうですね。",
        choices: ["をして", "からは", "をもって", "からして"],
        correctIndex: 3, // 4번 (からして)
        answerWord: "〜からして",
        translation: "모리타 씨의 아버지는 목소리부터가 다정해 보이시네요.",
        explanation: "「명사 + からして」: 하나의 뚜렷한 특징이나 극단적 예를 들어 전체를 짐작함."
      },
      {
        id: "ex-q7-16",
        grammarId: "g-025",
        type: "q7",
        typeLabel: "問題 7 (文法形式の判断)",
        directive: "次の文の ( ) に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。",
        sentence: "あの人とは卒業式の時別れた ( )。",
        choices: ["ことだ", "きりだ", "ほどだ", "ばかりだ"],
        correctIndex: 1, // 2번 (きりだ)
        answerWord: "〜きりだ",
        translation: "그 사람과는 졸업식 때 헤어진 이래로 만난 적이 없다.",
        explanation: "「동사 た형 + きりだ」: 과거의 한 사건 이후 후속 행동이나 만남이 단절됨을 뜻합니다."
      },
      {
        id: "ex-q7-17",
        grammarId: "g-018",
        type: "q7",
        typeLabel: "問題 7 (文法形式の判断)",
        directive: "次の文の ( ) に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。",
        sentence: "昨日、3時から4時に ( ) 停電があった。",
        choices: ["おいて", "そって", "かけて", "わたって"],
        correctIndex: 2, // 3번 (かけて)
        answerWord: "〜にかけて",
        translation: "어제 3시부터 4시에 걸쳐 정전이 있었다.",
        explanation: "「〜から〜にかけて」: 대략적인 시간·공간적 범위에 걸쳐 현상이 이어짐을 뜻합니다."
      },
      {
        id: "ex-q7-18",
        grammarId: "g-016",
        type: "q7",
        typeLabel: "問題 7 (文法形式の判断)",
        directive: "次の文の ( ) に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。",
        sentence: "お酒ばかり飲んでいると病気に ( )、やめた方がいいですよ。",
        choices: ["なるからこそ", "なるからといって", "なりかねないので", "なるかいがあって"],
        correctIndex: 2, // 3번 (なりかねないので)
        answerWord: "〜かねない",
        translation: "술만 마시다가는 병에 걸릴 수도 있으니 그만두는 편이 좋습니다.",
        explanation: "「동사 ます형 + かねない」: 부정적이고 위험한 사태가 일어날 가능성이 충분히 있음을 경고."
      }
    ],

    // 問題 8: 문장의 조립 (★ 별표 문장 배열 문제)
    q8: [
      {
        id: "ex-q8-01",
        grammarId: "g-020",
        type: "q8",
        typeLabel: "問題 8 (文の組み立て)",
        directive: "次の文の ★ に入る最もよいものを、1・2・3・4から一つ選びなさい。",
        prefix: "あのチームの選手は",
        suffix: "",
        fragments: ["から", "強そうだ", "体格", "して"], // 1: から, 2: 強そうだ, 3: 体格, 4: して
        correctOrder: [3, 1, 4, 2], // 体格(3) から(1) して(4) 強そうだ(2)
        starSlotIndex: 2,
        correctChoice: 4,
        fullSentence: "あのチームの選手は体格からして強そうだ。",
        translation: "저 팀 선수는 체격부터가 강해 보인다.",
        explanation: "「〜からして」: '体格(3) + から(1) + して(4) + 強そうだ(2)' 순서로 배열되어, ★ 자리에는 4번(して)이 들어갑니다."
      },
      {
        id: "ex-q8-02",
        grammarId: "g-022",
        type: "q8",
        typeLabel: "問題 8 (文の組み立て)",
        directive: "次の文の ★ に入る最もよいものを、1・2・3・4から一つ選びなさい。",
        prefix: "",
        suffix: "のは、かえって失礼になることもあります。",
        fragments: ["遠慮する", "物だから", "高価な", "といって"], // 1: 遠慮する, 2: 物だから, 3: 高価な, 4: といって
        correctOrder: [3, 2, 4, 1], // 高価な(3) 物だから(2) といって(4) 遠慮する(1)
        starSlotIndex: 2,
        correctChoice: 4,
        fullSentence: "高価な物だからといって遠慮するのは、かえって失礼になることもあります。",
        translation: "비싼 물건이라고 해서 사양하는 것은 오히려 실례가 될 수도 있습니다.",
        explanation: "「〜からといって」: '高価な(3) + 物だから(2) + といって(4) + 遠慮する(1)' 순서로 배열되어, ★ 자리에는 4번(といって)이 들어갑니다."
      },
      {
        id: "ex-q8-03",
        grammarId: "g-005",
        type: "q8",
        typeLabel: "問題 8 (文の組み立て)",
        directive: "次の文の ★ に入る最もよいものを、1・2・3・4から一つ選びなさい。",
        prefix: "庭に咲いている",
        suffix: "すごくいい。",
        fragments: ["香りも", "花は", "うえに", "きれいな"], // 1: 香りも, 2: 花は, 3: うえに, 4: きれいな
        correctOrder: [2, 4, 3, 1], // 花は(2) きれいな(4) うえに(3) 香りも(1)
        starSlotIndex: 2,
        correctChoice: 3,
        fullSentence: "庭に咲いている花はきれいなうえに香りもすごくいい。",
        translation: "마당에 핀 꽃은 예쁜 데다가 향기도 대단히 좋다.",
        explanation: "「〜上に」: '花は(2) + きれいな(4) + うえに(3) + 香りも(1)' 순서로 배열되어, ★ 자리에는 3번(うえに)이 들어갑니다."
      },
      {
        id: "ex-q8-04",
        grammarId: "g-017",
        type: "q8",
        typeLabel: "問題 8 (文の組み立て)",
        directive: "次の文の ★ に入る最もよいものを、1・2・3・4から一つ選びなさい。",
        prefix: "申し訳ございません。個人情報に関する質問",
        suffix: "ます。",
        fragments: ["いたし", "お答え", "かね", "には"], // 1: いたし, 2: お答え, 3: かね, 4: には
        correctOrder: [4, 2, 3, 1], // には(4) お答え(2) かね(3) いたし(1)
        starSlotIndex: 2,
        correctChoice: 3,
        fullSentence: "申し訳ございません。個人情報に関する質問にはお答えしかねいたします。",
        translation: "죄송합니다. 개인정보에 관한 질문에는 답변해 드리기 어렵습니다.",
        explanation: "「〜かねる」: 'には(4) + お答え(2) + かね(3) + いたし(1)' 순서로 호응하여, ★ 자리에는 3번(かね)이 들어갑니다."
      },
      {
        id: "ex-q8-05",
        grammarId: "g-001",
        type: "q8",
        typeLabel: "問題 8 (文の組み立て)",
        directive: "次の文の ★ に入る最もよいものを、1・2・3・4から一つ選びなさい。",
        prefix: "メニューが",
        suffix: "いつも食べているうどんを頼むことにした。",
        fragments: ["あげく", "結局", "迷った", "多くて"], // 1: あげく, 2: 結局, 3: 迷った, 4: 多くて
        correctOrder: [4, 3, 1, 2], // 多くて(4) 迷った(3) あげく(1) 結局(2)
        starSlotIndex: 2,
        correctChoice: 1,
        fullSentence: "メニューが多くて迷ったあげく結局いつも食べているうどんを頼むことにした。",
        translation: "메뉴가 많아서 고민한 끝에 결국 언제나 먹던 우동을 주문하기로 했다.",
        explanation: "「〜あげく」: '多くて(4) + 迷った(3) + あげく(1) + 結局(2)' 순서로 배열되어, ★ 자리에는 1번(あげく)이 들어갑니다."
      },
      {
        id: "ex-q8-06",
        grammarId: "g-024",
        type: "q8",
        typeLabel: "問題 8 (文の組み立て)",
        directive: "次の文の ★ に入る最もよいものを、1・2・3・4から一つ選びなさい。",
        prefix: "愛犬のマメが動物病院で、",
        suffix: "ので、一緒にダイエットを始めました。",
        fragments: ["太り", "だと", "言われた", "気味"], // 1: 太り, 2: だと, 3: 言われた, 4: 気味
        correctOrder: [1, 4, 2, 3], // 太り(1) 気味(4) だと(2) 言われた(3)
        starSlotIndex: 2,
        correctChoice: 2,
        fullSentence: "愛犬のマメが動物病院で、太り気味だと言われたので、一緒にダイエットを始めました。",
        translation: "반려견 마메가 동물병원에서 비만 기운이 있다는 말을 들어서 함께 다이어트를 시작했습니다.",
        explanation: "「〜気味」: '太り(1) + 気味(4) + だと(2) + 言われた(3)' 순서로 배열되어, ★ 자리에는 2번(だと)이 들어갑니다."
      }
    ]
  };

  // =========================================================
  // 2. 퀴즈 세션 상태 관리
  // =========================================================
  const quizSession = {
    exam: {
      questions: [],
      index: 0,
      score: 0,
      answered: false,
      wrongQuestions: [],
      arrangedSlots: [null, null, null, null], // 문제 8 슬롯별 조각 번호(1~4)
      usedFragments: [false, false, false, false],
      containerId: "vocab-quiz-runner"
    },
    mcq: {
      questions: [],
      index: 0,
      score: 0,
      answered: false,
      wrongIds: []
    },
    input: {
      questions: [],
      index: 0,
      score: 0,
      answered: false,
      wrongIds: [],
      tileSequence: [],
      tiles: []
    }
  };

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function shuffleArray(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function notifyViewsUpdated() {
    document.dispatchEvent(new CustomEvent("jlpt:state-updated"));
    if (typeof window.JLPTStudy?.refreshAllViews === "function") {
      window.JLPTStudy.refreshAllViews();
    }
  }

  function filterByScope(items, scopeValue, state) {
    if (!scopeValue || scopeValue === "ALL") return items.slice();
    if (scopeValue === "DUE" && typeof DATA.isDueForReview === "function") {
      return items.filter((item) => DATA.isDueForReview(item.id, state));
    }
    if (scopeValue === "FAVORITE") {
      const favSet = new Set((state.favorites || []).map(String));
      return items.filter((item) => favSet.has(String(item.id)));
    }
    if (["미학습", "모름", "애매함", "완벽함"].includes(scopeValue)) {
      return items.filter((item) => {
        const rec = state.progress?.[String(item.id)];
        const norm =
          rec && typeof DATA.normalizeStatus === "function"
            ? DATA.normalizeStatus(rec.status)
            : rec?.status || "미학습";
        return norm === scopeValue;
      });
    }
    if (scopeValue.startsWith("DECK:")) {
      const deckId = scopeValue.slice("DECK:".length);
      const deck = (state.customDecks || []).find((d) => String(d.id) === String(deckId));
      const idSet = new Set((deck?.wordIds || []).map(String));
      return items.filter((item) => idSet.has(String(item.id)));
    }
    return items.slice();
  }

  function recordExamResult(questionObj, isCorrect, modeName) {
    const state = DATA.loadState();
    state.progress = state.progress || {};
    state.wrongStats = state.wrongStats || {};

    const targetId = questionObj.grammarId || questionObj.id;
    const prevProg = state.progress[String(targetId)] || null;
    const itemType =
      questionObj._domain === "grammar" ||
      questionObj.type === "grammar" ||
      questionObj.type === "q7" ||
      questionObj.type === "q8" ||
      Boolean(questionObj.grammarId)
        ? "grammar"
        : "vocab";

    if (isCorrect) {
      state.progress[String(targetId)] = {
        type: itemType,
        ...DATA.calculateNextSrs(prevProg, "완벽함")
      };
    } else {
      state.progress[String(targetId)] = {
        type: itemType,
        ...DATA.calculateNextSrs(prevProg, "모름")
      };
      const prevWrong = state.wrongStats[String(targetId)] || { count: 0 };
      state.wrongStats[String(targetId)] = {
        count: (Number(prevWrong.count) || 0) + 1,
        lastWrongAt: new Date().toISOString(),
        lastMode: modeName
      };
    }

    DATA.saveState(state);
    notifyViewsUpdated();
  }

  // =========================================================
  // 3. 실전 문제 풀 구성 (기출 은행 + GRAMMAR_DB 동적 연동)
  // =========================================================
  function createDynamicQ7FromGrammar(gItem) {
    const gPool = (DATA.GRAMMAR_DB || []).filter((g) => String(g.id) !== String(gItem.id));
    const distractors = shuffleArray(gPool).slice(0, 3).map((g) => g.word);
    const choices = shuffleArray([gItem.word, ...distractors]);
    const correctIndex = choices.indexOf(gItem.word);

    const blankedSentence = gItem.example
      ? String(gItem.example).replace(gItem.word, " ( ) ")
      : "次の文の ( ) に入る適切な文法を選びなさい。";

    return {
      id: `dyn-q7-${gItem.id}`,
      grammarId: gItem.id,
      type: "q7",
      typeLabel: "問題 7 (文法形式の判断)",
      directive: "次の文の ( ) に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。",
      sentence: blankedSentence,
      choices,
      correctIndex,
      answerWord: gItem.word,
      translation: gItem.exampleMeaning || gItem.meaning,
      explanation: `${gItem.word} (${gItem.meaning}) - 접속: ${gItem.connection || "기본 접속"}`
    };
  }

  function buildExamQuestionPool(
    examType = "all_grammar",
    countValue = 10,
    forcedQuestions = null
  ) {
    if (Array.isArray(forcedQuestions) && forcedQuestions.length > 0) {
      return shuffleArray(forcedQuestions.slice());
    }

    let rawPool = [];
    if (examType === "q7_only") {
      rawPool = OFFICIAL_EXAM_BANK.q7.slice();
    } else if (examType === "q8_only") {
      rawPool = OFFICIAL_EXAM_BANK.q8.slice();
    } else {
      rawPool = [...OFFICIAL_EXAM_BANK.q7, ...OFFICIAL_EXAM_BANK.q8];
    }

    if (rawPool.length < countValue && examType !== "q8_only") {
      const existingGIds = new Set(rawPool.map((q) => q.grammarId));
      const remainingG = (DATA.GRAMMAR_DB || []).filter((g) => !existingGIds.has(g.id));
      const dynamicQ7s = remainingG.map(createDynamicQ7FromGrammar);
      rawPool = [...rawPool, ...dynamicQ7s];
    }

    const shuffled = shuffleArray(rawPool);
    if (countValue === "ALL") return shuffled;
    return shuffled.slice(0, Math.max(1, Number(countValue) || 10));
  }

  // =========================================================
  // 4. 실전 시험 러너 UI (問題 7 & 問題 8 렌더링)
  // =========================================================
  function startExamQuiz(
    examType = "all_grammar",
    countValue = 10,
    containerId = "vocab-quiz-runner",
    forcedQuestions = null
  ) {
    const runner = document.getElementById(containerId);
    if (!runner) return;

    quizSession.exam.containerId = containerId;
    quizSession.exam.questions = buildExamQuestionPool(examType, countValue, forcedQuestions);
    quizSession.exam.index = 0;
    quizSession.exam.score = 0;
    quizSession.exam.answered = false;
    quizSession.exam.wrongQuestions = [];
    quizSession.exam.arrangedSlots = [null, null, null, null];
    quizSession.exam.usedFragments = [false, false, false, false];

    runner.hidden = false;
    renderExamQuestion();
  }

  function renderExamQuestion() {
    const runner = document.getElementById(quizSession.exam.containerId);
    if (!runner) return;

    const q = quizSession.exam.questions[quizSession.exam.index];
    const total = quizSession.exam.questions.length;

    if (!q) {
      const wrongCount = quizSession.exam.wrongQuestions.length;
      runner.innerHTML = `
        <div class="quiz-result-box">
          <h3>🎉 JLPT N2 실전 문법 테스트 완료</h3>
          <p>총 ${total}문항 중 <strong>${quizSession.exam.score}</strong>개 정답 · 오답 <strong>${wrongCount}</strong>개</p>
          <div class="quick-action-row" style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="btn btn-primary" id="btn-exam-retry-wrong" ${
              wrongCount > 0 ? "" : "disabled"
            }>틀린 문제 다시 풀기 (${wrongCount})</button>
            <button type="button" class="btn" id="btn-exam-close">닫기</button>
          </div>
        </div>
      `;
      return;
    }

    quizSession.exam.answered = false;
    quizSession.exam.arrangedSlots = [null, null, null, null];
    quizSession.exam.usedFragments = [false, false, false, false];

    if (q.type === "q8") {
      renderExamQ8(runner, q, total);
    } else {
      renderExamQ7(runner, q, total);
    }
  }

  // [문제 7] 문법 빈칸 채우기 뷰
  function renderExamQ7(runner, q, total) {
    runner.innerHTML = `
      <div class="exam-card">
        <div class="exam-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div>
            <span class="badge">${escapeHtml(q.typeLabel)}</span>
            <span style="margin-left:8px;">${quizSession.exam.index + 1} / ${total}</span>
          </div>
          <span>점수: <strong>${quizSession.exam.score}</strong></span>
        </div>
        <div class="exam-directive" style="margin-bottom:10px;">${escapeHtml(q.directive)}</div>
        <div class="exam-sentence-box" style="margin-bottom:14px;">
          <div lang="ja" style="font-size:1.15rem; font-weight:600;">${escapeHtml(q.sentence)}</div>
        </div>
        <div id="exam-q7-choices" style="display:grid; gap:8px;">
          ${q.choices
            .map(
              (choiceText, idx) => `
            <button type="button" class="btn exam-choice-btn" data-choice-idx="${idx}" lang="ja">
              ${idx + 1}. ${escapeHtml(choiceText)}
            </button>
          `
            )
            .join("")}
        </div>
        <div id="exam-feedback-box" style="margin-top:14px; padding:12px; border-radius:8px;" hidden></div>
        <div class="quick-action-row" style="margin-top:14px; display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" class="btn btn-primary" id="btn-exam-next-q" disabled>다음 문제 →</button>
          <button type="button" class="btn" id="btn-exam-close">닫기</button>
        </div>
      </div>
    `;
  }

  // [문제 8] 문장의 조립 (★ 별표 배열) 뷰
  function renderExamQ8(runner, q, total) {
    const starIdx = q.starSlotIndex ?? 2;
    const slotHtml = [0, 1, 2, 3]
      .map((sIdx) => {
        const isStar = sIdx === starIdx;
        return `<span class="slot-underline" data-slot="${sIdx}" style="display:inline-block; min-width:44px; text-align:center; border-bottom:2px solid currentColor; padding:0 4px; margin:0 2px; font-weight:${
          isStar ? "700" : "500"
        };">${isStar ? "★" : "＿＿＿"}</span>`;
      })
      .join("");

    runner.innerHTML = `
      <div class="exam-card">
        <div class="exam-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div>
            <span class="badge">${escapeHtml(q.typeLabel)}</span>
            <span style="margin-left:8px;">${quizSession.exam.index + 1} / ${total}</span>
          </div>
          <span>점수: <strong>${quizSession.exam.score}</strong></span>
        </div>
        <div class="exam-directive" style="margin-bottom:10px;">${escapeHtml(q.directive)}</div>
        <div class="exam-sentence-box" style="margin-bottom:14px;">
          <div lang="ja" style="font-size:1.15rem; font-weight:600; line-height:1.8;">
            ${q.prefix ? `<span>${escapeHtml(q.prefix)}</span>` : ""}${slotHtml}${
      q.suffix ? `<span>${escapeHtml(q.suffix)}</span>` : ""
    }
          </div>
          <div class="helper-text" style="margin-top:6px;">💡 아래 4개 조각을 순서대로 눌러 문장을 배열해 보거나, 바로 ★에 들어갈 번호를 선택하세요.</div>
        </div>
        <div style="margin-bottom:12px;">
          <div style="margin-bottom:6px; font-weight:600;">[ 문장 조각 (클릭 시 슬롯에 자동 배치) ]</div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            ${q.fragments
              .map(
                (frag, idx) => `
              <button type="button" class="btn q8-frag-btn" data-frag-idx="${idx}" lang="ja">
                ${idx + 1}. ${escapeHtml(frag)}
              </button>
            `
              )
              .join("")}
            <button type="button" class="btn" id="btn-q8-reset-slots">초기화</button>
          </div>
        </div>
        <div style="margin-bottom:12px;">
          <div style="margin-bottom:6px; font-weight:600;">★ 에 들어갈 번호(1~4)를 선택하세요:</div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            ${[1, 2, 3, 4]
              .map(
                (num) => `
              <button type="button" class="btn q8-choice-num-btn" data-choice-num="${num}">
                ${num}번
              </button>
            `
              )
              .join("")}
          </div>
        </div>
        <div id="exam-feedback-box" style="margin-top:14px; padding:12px; border-radius:8px;" hidden></div>
        <div class="quick-action-row" style="margin-top:14px; display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" class="btn btn-primary" id="btn-exam-next-q" disabled>다음 문제 →</button>
          <button type="button" class="btn" id="btn-exam-close">닫기</button>
        </div>
      </div>
    `;
  }

  // [문제 8] 인터랙티브 조각 탭 동작
  function handleQ8FragmentClick(fragIdx) {
    if (quizSession.exam.answered) return;
    const q = quizSession.exam.questions[quizSession.exam.index];
    if (!q || q.type !== "q8") return;

    if (quizSession.exam.usedFragments[fragIdx]) return;
    const emptySlotIdx = quizSession.exam.arrangedSlots.indexOf(null);
    if (emptySlotIdx === -1) return;

    const choiceNum = fragIdx + 1;
    quizSession.exam.arrangedSlots[emptySlotIdx] = choiceNum;
    quizSession.exam.usedFragments[fragIdx] = true;
    updateQ8SlotsUI(q);
  }

  function resetQ8Slots(q) {
    if (quizSession.exam.answered) return;
    quizSession.exam.arrangedSlots = [null, null, null, null];
    quizSession.exam.usedFragments = [false, false, false, false];
    updateQ8SlotsUI(q);
  }

  function updateQ8SlotsUI(q) {
    const slotEls = document.querySelectorAll(".slot-underline");
    slotEls.forEach((el) => {
      const slotIndex = Number(el.getAttribute("data-slot"));
      const choiceNum = quizSession.exam.arrangedSlots[slotIndex];
      const isStar = slotIndex === (q.starSlotIndex ?? 2);

      if (choiceNum != null) {
        const fragText = q.fragments[choiceNum - 1];
        el.textContent = `${isStar ? "★ " : ""}${choiceNum}. ${fragText}`;
        el.style.padding = "0 8px";
      } else {
        el.textContent = isStar ? "★" : "＿＿＿";
        el.style.padding = "0 4px";
      }
    });

    const fragBtns = document.querySelectorAll(".q8-frag-btn");
    fragBtns.forEach((btn) => {
      const idx = Number(btn.getAttribute("data-frag-idx"));
      btn.disabled = Boolean(quizSession.exam.usedFragments[idx]);
    });
  }

  // [문제 7] 채점
  function handleQ7Answer(choiceBtn) {
    if (quizSession.exam.answered) return;
    const q = quizSession.exam.questions[quizSession.exam.index];
    if (!q) return;

    quizSession.exam.answered = true;
    const chosenIdx = Number(choiceBtn.getAttribute("data-choice-idx"));
    const isCorrect = chosenIdx === q.correctIndex;

    document.querySelectorAll("#exam-q7-choices .exam-choice-btn").forEach((btn) => {
      btn.disabled = true;
      const idx = Number(btn.getAttribute("data-choice-idx"));
      if (idx === q.correctIndex) {
        btn.classList.add("btn-secondary");
        btn.style.border = "2px solid #10b981";
      } else if (btn === choiceBtn && !isCorrect) {
        btn.classList.add("btn-danger");
      }
    });

    showExamFeedback(
      q,
      isCorrect,
      `정답: <strong>${q.correctIndex + 1}번 「${escapeHtml(q.choices[q.correctIndex])}」</strong>`
    );
    recordExamResult(q, isCorrect, "問題 7 (文法形式)");
  }

  // [문제 8] 채점
  function handleQ8Answer(selectedChoiceNum) {
    if (quizSession.exam.answered) return;
    const q = quizSession.exam.questions[quizSession.exam.index];
    if (!q || q.type !== "q8") return;

    quizSession.exam.answered = true;
    const isCorrect = Number(selectedChoiceNum) === Number(q.correctChoice);

    document.querySelectorAll(".q8-choice-num-btn").forEach((btn) => {
      btn.disabled = true;
      const num = Number(btn.getAttribute("data-choice-num"));
      if (num === q.correctChoice) {
        btn.classList.add("btn-secondary");
        btn.style.border = "2px solid #10b981";
      } else if (num === selectedChoiceNum && !isCorrect) {
        btn.classList.add("btn-danger");
      }
    });

    quizSession.exam.arrangedSlots = q.correctOrder.slice();
    updateQ8SlotsUI(q);

    const detailText = `정답: <strong>${q.correctChoice}번 「${escapeHtml(
      q.fragments[q.correctChoice - 1]
    )}」</strong><br />• 올바른 문장: <span lang="ja">${escapeHtml(
      q.fullSentence
    )}</span><br />• 어순: ${q.correctOrder
      .map((c) => `${c}(${escapeHtml(q.fragments[c - 1])})`)
      .join(" → ")}`;
    showExamFeedback(q, isCorrect, detailText);
    recordExamResult(q, isCorrect, "問題 8 (文の組み立て)");
  }

  function showExamFeedback(q, isCorrect, answerSummaryHtml) {
    const fb = document.getElementById("exam-feedback-box");
    if (!fb) return;

    fb.hidden = false;
    if (isCorrect) {
      quizSession.exam.score += 1;
      fb.style.background = "rgba(16, 185, 129, 0.12)";
      fb.style.border = "1px solid #10b981";
      fb.innerHTML = `
        <div style="font-weight:700; margin-bottom:6px;">✓ 正解 (정답입니다!)</div>
        <div style="margin-bottom:6px;">${answerSummaryHtml}</div>
        <div><strong>[해석]</strong> ${escapeHtml(q.translation)}<br /><strong>[해설]</strong> ${escapeHtml(
        q.explanation
      )}</div>
      `;
    } else {
      quizSession.exam.wrongQuestions.push(q);
      fb.style.background = "rgba(239, 68, 68, 0.12)";
      fb.style.border = "1px solid #ef4444";
      fb.innerHTML = `
        <div style="font-weight:700; margin-bottom:6px;">✕ 不正解 (오답입니다)</div>
        <div style="margin-bottom:6px;">${answerSummaryHtml}</div>
        <div><strong>[해석]</strong> ${escapeHtml(q.translation)}<br /><strong>[해설]</strong> ${escapeHtml(
        q.explanation
      )}</div>
      `;
    }

    const nextBtn = document.getElementById("btn-exam-next-q");
    if (nextBtn) nextBtn.disabled = false;
  }

  // =========================================================
  // 5. 어휘 4지선다 & 주관식 테스트
  // =========================================================
  function buildMcqQuestion(targetItem) {
    if (targetItem._domain === "grammar" || targetItem.type === "grammar") {
      return createDynamicQ7FromGrammar(targetItem);
    }

    const vPool = (DATA.VOCAB_DB || []).filter((v) => String(v.id) !== String(targetItem.id));
    const distractors = shuffleArray(vPool).slice(0, 3);
    const options = shuffleArray([targetItem, ...distractors]).map((v) => ({
      label: v.meaning,
      isCorrect: String(v.id) === String(targetItem.id)
    }));

    return {
      item: targetItem,
      typeLabel: "問題 4 (語彙・意味判断)",
      directive: "次の言葉の意味として最もよいものを、1・2・3・4から一つ選びなさい。",
      promptMain: targetItem.word,
      promptSub: targetItem.kana ? `読み: ${targetItem.kana}` : "",
      correctValue: `${targetItem.word} [${targetItem.kana}] — ${targetItem.meaning}`,
      options
    };
  }

  function startMcqQuiz(forcedIds = null, overrideOptions = null) {
    const runner = document.getElementById("vocab-quiz-runner");
    if (!runner) return;

    const domain =
      overrideOptions?.domain || document.getElementById("vocab-quiz-domain")?.value || "vocab";
    const scope =
      overrideOptions?.scope || document.getElementById("vocab-quiz-scope")?.value || "ALL";
    const countVal =
      overrideOptions?.count || document.getElementById("vocab-quiz-count")?.value || "10";

    if (domain === "grammar" && !forcedIds) {
      startExamQuiz("all_grammar", countVal, "vocab-quiz-runner");
      return;
    }

    const state = DATA.loadState();
    let pool = [];

    if (Array.isArray(forcedIds) && forcedIds.length > 0) {
      const idSet = new Set(forcedIds.map(String));
      const allItems = [
        ...(DATA.VOCAB_DB || []).map((v) => ({ ...v, _domain: "vocab" })),
        ...(DATA.GRAMMAR_DB || []).map((g) => ({ ...g, _domain: "grammar" }))
      ];
      pool = allItems.filter((item) => idSet.has(String(item.id)));
      if (!pool.length) pool = (DATA.VOCAB_DB || []).slice();
      pool = shuffleArray(pool);
    } else {
      const basePool =
        domain === "all"
          ? [
              ...(DATA.VOCAB_DB || []).map((v) => ({ ...v, _domain: "vocab" })),
              ...(DATA.GRAMMAR_DB || []).map((g) => ({ ...g, _domain: "grammar" }))
            ]
          : (DATA.VOCAB_DB || []).map((v) => ({ ...v, _domain: "vocab" }));

      const scoped = filterByScope(basePool, scope, state);
      pool = shuffleArray(scoped.length ? scoped : basePool);
    }

    const sliced = countVal === "ALL" ? pool : pool.slice(0, Math.max(1, Number(countVal) || 10));

    quizSession.mcq.questions = sliced.map(buildMcqQuestion);
    quizSession.mcq.index = 0;
    quizSession.mcq.score = 0;
    quizSession.mcq.answered = false;
    quizSession.mcq.wrongIds = [];

    runner.hidden = false;
    renderMcqQuestion();
  }

  function renderMcqQuestion() {
    const runner = document.getElementById("vocab-quiz-runner");
    if (!runner) return;

    const q = quizSession.mcq.questions[quizSession.mcq.index];
    const total = quizSession.mcq.questions.length;

    if (!q) {
      const wrongCount = quizSession.mcq.wrongIds.length;
      runner.innerHTML = `
        <div class="quiz-result-box">
          <h3>어휘 퀴즈 결과</h3>
          <p>총 ${total}문항 중 <strong>${quizSession.mcq.score}</strong>문항 정답 · 오답 <strong>${wrongCount}</strong>개</p>
          <div class="quick-action-row" style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="btn btn-primary" id="btn-mcq-retry-wrong" ${
              wrongCount > 0 ? "" : "disabled"
            }>틀린 문제 다시 풀기 (${wrongCount})</button>
            <button type="button" class="btn" id="btn-exam-close">닫기</button>
          </div>
        </div>
      `;
      return;
    }

    quizSession.mcq.answered = false;
    runner.innerHTML = `
      <div class="exam-card">
        <div class="exam-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div>
            <span class="badge">${escapeHtml(q.typeLabel)}</span>
            <span style="margin-left:8px;">${quizSession.mcq.index + 1} / ${total}</span>
          </div>
          <span>점수: <strong>${quizSession.mcq.score}</strong></span>
        </div>
        <div class="exam-directive" style="margin-bottom:10px;">${escapeHtml(
          q.directive || "次の言葉の意味として最もよいものを、1・2・3・4から一つ選びなさい。"
        )}</div>
        <div class="exam-sentence-box" style="margin-bottom:14px;">
          <div id="mcq-question-text" lang="ja" style="font-size:1.25rem; font-weight:700;">${escapeHtml(
            q.promptMain
          )}</div>
          ${
            q.promptSub
              ? `<div id="mcq-question-sub" class="maskable mask-kana is-masked" lang="ja" style="margin-top:4px; opacity:0.85; cursor:pointer;">${escapeHtml(
                  q.promptSub
                )}</div>`
              : ""
          }
        </div>
        <div id="mcq-choices-list" style="display:grid; gap:8px;">
          ${q.options
            .map(
              (opt, idx) => `
            <button type="button" class="btn quiz-choice-btn" data-mcq-choice-idx="${idx}" data-correct="${
                opt.isCorrect
              }">
              ${idx + 1}. ${escapeHtml(opt.label)}
            </button>
          `
            )
            .join("")}
        </div>
        <div id="mcq-feedback-box" style="margin-top:14px; padding:12px; border-radius:8px;" hidden></div>
        <div class="quick-action-row" style="margin-top:14px; display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" class="btn btn-primary" id="btn-mcq-next-q" disabled>다음 문제 →</button>
          <button type="button" class="btn" id="btn-exam-close">닫기</button>
        </div>
      </div>
    `;
  }

  function handleMcqAnswer(btnEl) {
    if (quizSession.mcq.answered) return;
    const q = quizSession.mcq.questions[quizSession.mcq.index];
    if (!q) return;

    quizSession.mcq.answered = true;
    const isCorrect = btnEl.getAttribute("data-correct") === "true";

    document.getElementById("mcq-question-sub")?.classList.add("is-revealed");

    document.querySelectorAll("#mcq-choices-list .quiz-choice-btn").forEach((b) => {
      b.disabled = true;
      if (b.getAttribute("data-correct") === "true") {
        b.classList.add("btn-secondary");
        b.style.border = "2px solid #10b981";
      } else if (b === btnEl && !isCorrect) {
        b.classList.add("btn-danger");
      }
    });

    const feedback = document.getElementById("mcq-feedback-box");
    if (feedback) {
      feedback.hidden = false;
      if (isCorrect) {
        quizSession.mcq.score += 1;
        feedback.style.background = "rgba(16, 185, 129, 0.12)";
        feedback.style.border = "1px solid #10b981";
        feedback.innerHTML = `<strong>✓ 정답!</strong> ${escapeHtml(q.correctValue)}`;
      } else {
        quizSession.mcq.wrongIds.push(q.item.id);
        feedback.style.background = "rgba(239, 68, 68, 0.12)";
        feedback.style.border = "1px solid #ef4444";
        feedback.innerHTML = `<strong>✕ 오답</strong> — 정답: ${escapeHtml(q.correctValue)}`;
      }
    }

    recordExamResult(q.item, isCorrect, "어휘 4지선다");
    const nextBtn = document.getElementById("btn-mcq-next-q");
    if (nextBtn) nextBtn.disabled = false;
  }

  // 주관식 히라가나 타일 생성 및 테스트 로직
  function generateKanaTiles(answerKana) {
    const targetChars = [...String(answerKana || "")].filter((ch) => ch.trim() !== "");
    const distractorPool = [
      "あ", "い", "う", "え", "お",
      "か", "き", "く", "け", "こ",
      "さ", "し", "す", "せ", "そ",
      "た", "ち", "つ", "て", "と",
      "な", "に", "ぬ", "ね", "の",
      "は", "ひ", "ふ", "へ", "ほ",
      "ま", "み", "む", "め", "も",
      "や", "ゆ", "よ",
      "ら", "り", "る", "れ", "ろ",
      "わ", "を", "ん", "っ", "ゃ", "ゅ", "ょ"
    ].filter((ch) => !targetChars.includes(ch));

    const extraCount = Math.max(4, Math.min(8, targetChars.length + 2));
    const extras = shuffleArray(distractorPool).slice(0, extraCount);
    return shuffleArray([...targetChars, ...extras]).map((char) => ({ char, used: false }));
  }

  function startSubjectiveQuiz(forcedIds = null, overrideOptions = null) {
    const runner = document.getElementById("vocab-quiz-runner");
    if (!runner) return;

    const countVal =
      overrideOptions?.count || document.getElementById("vocab-quiz-count")?.value || "10";
    const scopeVal =
      overrideOptions?.scope || document.getElementById("vocab-quiz-scope")?.value || "ALL";
    const state = DATA.loadState();

    let rawPool = (DATA.VOCAB_DB || []).filter((item) => {
      const targetReading =
        typeof DATA.isHiraganaOnly === "function" && DATA.isHiraganaOnly(item.word)
          ? item.word
          : item.kana;
      return Boolean(targetReading && String(targetReading).trim());
    });

    if (Array.isArray(forcedIds) && forcedIds.length) {
      const idSet = new Set(forcedIds.map(String));
      rawPool = rawPool.filter((v) => idSet.has(String(v.id)));
    } else {
      const scoped = filterByScope(rawPool, scopeVal, state);
      if (scoped.length) rawPool = scoped;
    }

    const picked =
      countVal === "ALL"
        ? shuffleArray(rawPool)
        : shuffleArray(rawPool).slice(0, Math.max(1, Number(countVal) || 10));

    quizSession.input.questions = picked.map((item) => {
      const hiraganaOnly =
        typeof DATA.isHiraganaOnly === "function" ? DATA.isHiraganaOnly(item.word) : false;
      const expectedAnswer = hiraganaOnly
        ? String(item.word).trim()
        : String(item.kana || "").trim();
      return { item, hiraganaOnly, expectedAnswer };
    });

    quizSession.input.index = 0;
    quizSession.input.score = 0;
    quizSession.input.answered = false;
    quizSession.input.wrongIds = [];
    quizSession.input.tileSequence = [];
    quizSession.input.tiles = [];

    runner.hidden = false;
    renderInputQuestion();
  }

  function renderInputQuestion() {
    const runner = document.getElementById("vocab-quiz-runner");
    if (!runner) return;

    const q = quizSession.input.questions[quizSession.input.index];
    const total = quizSession.input.questions.length;

    if (!q) {
      const wrongCount = quizSession.input.wrongIds.length;
      runner.innerHTML = `
        <div class="quiz-result-box">
          <h3>주관식 히라가나 테스트 결과</h3>
          <p>총 ${total}문항 중 <strong>${quizSession.input.score}</strong>문항 정답 · 오답 <strong>${wrongCount}</strong>개</p>
          <div class="quick-action-row" style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="btn btn-primary" id="btn-subj-retry-wrong" ${
              wrongCount > 0 ? "" : "disabled"
            }>틀린 문제 다시 풀기 (${wrongCount})</button>
            <button type="button" class="btn" id="btn-exam-close">닫기</button>
          </div>
        </div>
      `;
      return;
    }

    const inputMode = document.getElementById("subj-input-method")?.value || "direct";
    const hideMeaning = Boolean(document.getElementById("subj-hide-meaning")?.checked);
    const showFirstHint = Boolean(document.getElementById("subj-first-hint")?.checked);

    quizSession.input.answered = false;
    quizSession.input.tileSequence = [];
    quizSession.input.tiles = generateKanaTiles(q.expectedAnswer);

    const promptText = q.hiraganaOnly ? q.item.meaning : q.item.word;
    const subText = q.hiraganaOnly ? "(히라가나 전용 단어)" : `뜻: ${q.item.meaning}`;
    const firstChar = [...q.expectedAnswer][0] || "";

    runner.innerHTML = `
      <div class="exam-card">
        <div class="exam-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div>
            <span class="badge">問題 1 (漢字読み・筆記)</span>
            <span style="margin-left:8px;">${quizSession.input.index + 1} / ${total}</span>
          </div>
          <span>점수: <strong>${quizSession.input.score}</strong></span>
        </div>
        <div class="exam-directive" style="margin-bottom:10px;">次の言葉の読み方(ひらがな)を書きなさい。</div>
        <div class="exam-sentence-box" style="margin-bottom:14px;">
          <div ${
            q.hiraganaOnly ? "" : 'lang="ja"'
          } style="font-size:1.25rem; font-weight:700;">${escapeHtml(promptText)}</div>
          ${hideMeaning ? "" : `<div style="margin-top:4px; opacity:0.85;">${escapeHtml(subText)}</div>`}
          ${
            showFirstHint && firstChar
              ? `<div style="margin-top:6px;">첫 글자 힌트: <strong lang="ja">${escapeHtml(
                  firstChar
                )}</strong> (총 ${[...q.expectedAnswer].length}자)</div>`
              : ""
          }
        </div>
        ${
          inputMode === "tiles"
            ? `
          <div style="margin-bottom:12px;">
            <div id="tile-selected-display" lang="ja" style="padding:8px 12px; border:1px solid #cbd5e1; border-radius:6px; margin-bottom:8px; min-height:36px;">타일을 순서대로 선택하세요</div>
            <div id="kana-tile-grid" style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px;">
              ${quizSession.input.tiles
                .map(
                  (t, i) => `
                <button type="button" class="btn" data-tile-idx="${i}" lang="ja">${escapeHtml(
                    t.char
                  )}</button>
              `
                )
                .join("")}
            </div>
            <div style="display:flex; gap:8px;">
              <button type="button" class="btn" id="btn-tile-backspace">한 글자 지우기</button>
              <button type="button" class="btn" id="btn-tile-clear">초기화</button>
            </div>
          </div>
        `
            : `
          <div style="margin-bottom:12px;">
            <input type="text" id="kana-direct-input" class="search-input" lang="ja" placeholder="히라가나를 입력하세요" autocomplete="off" style="width:100%; max-width:320px; padding:8px 12px;" />
          </div>
        `
        }
        <div id="input-quiz-feedback" style="margin-top:14px; padding:12px; border-radius:8px;" hidden></div>
        <div class="quick-action-row" style="margin-top:14px; display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" class="btn btn-primary" id="btn-input-quiz-submit">정답 확인</button>
          <button type="button" class="btn btn-secondary" id="btn-input-quiz-next" disabled>다음 문항 →</button>
          <button type="button" class="btn" id="btn-exam-close">닫기</button>
        </div>
      </div>
    `;

    if (inputMode !== "tiles") {
      document.getElementById("kana-direct-input")?.focus();
    }
  }

  function renderKanaTiles() {
    const displayEl = document.getElementById("tile-selected-display");
    const gridEl = document.getElementById("kana-tile-grid");
    if (!displayEl || !gridEl) return;

    const currentStr = quizSession.input.tileSequence.map((t) => t.char).join("");
    displayEl.textContent = currentStr || "타일을 순서대로 선택하세요";

    gridEl.innerHTML = quizSession.input.tiles
      .map(
        (tile, idx) => `
        <button type="button" class="btn ${tile.used ? "is-used" : ""}" data-tile-idx="${idx}" ${
          tile.used || quizSession.input.answered ? "disabled" : ""
        } lang="ja">${escapeHtml(tile.char)}</button>
      `
      )
      .join("");
  }

  function submitInputAnswer() {
    if (quizSession.input.answered) return;
    const q = quizSession.input.questions[quizSession.input.index];
    if (!q) return;

    const inputMode = document.getElementById("subj-input-method")?.value || "direct";
    const userAnswer =
      inputMode === "tiles"
        ? quizSession.input.tileSequence.map((t) => t.char).join("").trim()
        : (document.getElementById("kana-direct-input")?.value || "").trim();

    if (!userAnswer) return;

    quizSession.input.answered = true;
    const isCorrect = userAnswer === q.expectedAnswer;
    const feedbackEl = document.getElementById("input-quiz-feedback");

    if (isCorrect) {
      quizSession.input.score += 1;
      if (feedbackEl) {
        feedbackEl.hidden = false;
        feedbackEl.style.background = "rgba(16, 185, 129, 0.12)";
        feedbackEl.style.border = "1px solid #10b981";
        feedbackEl.innerHTML = `<strong>✓ 정답!</strong> ${escapeHtml(
          q.item.word
        )} [${escapeHtml(q.expectedAnswer)}] — ${escapeHtml(q.item.meaning)}`;
      }
    } else {
      quizSession.input.wrongIds.push(q.item.id);
      if (feedbackEl) {
        feedbackEl.hidden = false;
        feedbackEl.style.background = "rgba(239, 68, 68, 0.12)";
        feedbackEl.style.border = "1px solid #ef4444";
        feedbackEl.innerHTML = `<strong>✕ 오답</strong> — 입력: <span lang="ja">${escapeHtml(
          userAnswer
        )}</span> / 정답: <strong lang="ja">${escapeHtml(q.expectedAnswer)}</strong> (${escapeHtml(
          q.item.meaning
        )})`;
      }
    }

    const directInput = document.getElementById("kana-direct-input");
    if (directInput) directInput.disabled = true;
    renderKanaTiles();

    recordExamResult(q.item, isCorrect, "주관식 히라가나");
    document.getElementById("btn-input-quiz-submit")?.setAttribute("disabled", "true");
    const nextBtn = document.getElementById("btn-input-quiz-next");
    if (nextBtn) nextBtn.disabled = false;
  }

  // =========================================================
  // 6. 이벤트 통합 바인딩
  // =========================================================
  function startConfiguredQuiz(forcedIds = null) {
    const domain = document.getElementById("vocab-quiz-domain")?.value || "vocab";
    const mode = document.getElementById("vocab-quiz-mode")?.value || "exam_all";
    const countVal = document.getElementById("vocab-quiz-count")?.value || "10";

    if (domain === "grammar" || mode === "exam_q7" || mode === "exam_q8" || mode === "exam_all") {
      let examType = "all_grammar";
      if (mode === "exam_q7") examType = "q7_only";
      else if (mode === "exam_q8") examType = "q8_only";
      startExamQuiz(examType, countVal, "vocab-quiz-runner");
    } else if (mode === "subjective") {
      startSubjectiveQuiz(forcedIds);
    } else {
      startMcqQuiz(forcedIds);
    }
  }

  function bindQuizEvents() {
    document.getElementById("vocab-quiz-mode")?.addEventListener("change", (e) => {
      const mode = e.target.value;
      const subOpts = document.getElementById("subjective-extra-options");
      if (subOpts) subOpts.hidden = mode !== "subjective";
    });

    document.getElementById("btn-start-vocab-quiz")?.addEventListener("click", () => {
      startConfiguredQuiz(null);
    });

    document.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      // 읽기 가림 클릭 임시 공개
      const maskedSub = target.closest("#mcq-question-sub.maskable");
      if (maskedSub) {
        maskedSub.classList.toggle("is-revealed");
        return;
      }

      // 퀴즈 닫기
      if (
        target.id === "btn-exam-close" ||
        target.id === "btn-quiz-back-setup" ||
        target.id === "btn-gquiz-clear"
      ) {
        const vRunner = document.getElementById("vocab-quiz-runner");
        if (vRunner) {
          vRunner.hidden = true;
          vRunner.innerHTML = "";
        }
        const gRunner = document.getElementById("grammar-quiz-runner");
        if (gRunner) {
          gRunner.innerHTML = "";
        }
        return;
      }

      // [문제 7] 보기 클릭
      const q7Btn = target.closest(".exam-choice-btn");
      if (q7Btn && !quizSession.exam.answered) {
        handleQ7Answer(q7Btn);
        return;
      }

      // [문제 8] 어구 조각 클릭 (슬롯 자동 배열)
      const q8FragBtn = target.closest(".q8-frag-btn");
      if (q8FragBtn && !quizSession.exam.answered) {
        const fragIdx = Number(q8FragBtn.getAttribute("data-frag-idx"));
        handleQ8FragmentClick(fragIdx);
        return;
      }

      // [문제 8] 슬롯 배열 초기화
      if (target.id === "btn-q8-reset-slots") {
        const q = quizSession.exam.questions[quizSession.exam.index];
        if (q && q.type === "q8") resetQ8Slots(q);
        return;
      }

      // [문제 8] ★ 답안 번호(1~4) 선택
      const q8ChoiceNumBtn = target.closest(".q8-choice-num-btn");
      if (q8ChoiceNumBtn && !quizSession.exam.answered) {
        const choiceNum = Number(q8ChoiceNumBtn.getAttribute("data-choice-num"));
        handleQ8Answer(choiceNum);
        return;
      }

      // [실전 퀴즈] 다음 문제
      if (target.id === "btn-exam-next-q") {
        quizSession.exam.index += 1;
        renderExamQuestion();
        return;
      }

      // [실전 퀴즈] 오답 재도전
      if (target.id === "btn-exam-retry-wrong") {
        if (quizSession.exam.wrongQuestions.length) {
          const wrongs = quizSession.exam.wrongQuestions.slice();
          startExamQuiz("all_grammar", "ALL", quizSession.exam.containerId, wrongs);
        }
        return;
      }

      // [어휘 4지선다]
      const mcqBtn = target.closest("[data-mcq-choice-idx]");
      if (mcqBtn && !quizSession.mcq.answered) {
        handleMcqAnswer(mcqBtn);
        return;
      }

      if (target.id === "btn-mcq-next-q") {
        quizSession.mcq.index += 1;
        renderMcqQuestion();
        return;
      }

      if (target.id === "btn-mcq-retry-wrong") {
        if (quizSession.mcq.wrongIds.length) {
          startMcqQuiz(quizSession.mcq.wrongIds);
        }
        return;
      }

      // [주관식 타일]
      const tileBtn = target.closest("[data-tile-idx]");
      if (tileBtn && !quizSession.input.answered) {
        const idx = Number(tileBtn.getAttribute("data-tile-idx"));
        const tile = quizSession.input.tiles[idx];
        if (tile && !tile.used) {
          tile.used = true;
          quizSession.input.tileSequence.push({ char: tile.char, tileIndex: idx });
          renderKanaTiles();
        }
        return;
      }

      if (target.id === "btn-tile-backspace" && !quizSession.input.answered) {
        const popped = quizSession.input.tileSequence.pop();
        if (popped && quizSession.input.tiles[popped.tileIndex]) {
          quizSession.input.tiles[popped.tileIndex].used = false;
        }
        renderKanaTiles();
        return;
      }

      if (target.id === "btn-tile-clear" && !quizSession.input.answered) {
        quizSession.input.tileSequence = [];
        quizSession.input.tiles.forEach((t) => {
          t.used = false;
        });
        renderKanaTiles();
        return;
      }

      if (target.id === "btn-input-quiz-submit") {
        submitInputAnswer();
        return;
      }

      if (target.id === "btn-input-quiz-next") {
        quizSession.input.index += 1;
        renderInputQuestion();
        return;
      }

      if (target.id === "btn-subj-retry-wrong") {
        if (quizSession.input.wrongIds.length) {
          startSubjectiveQuiz(quizSession.input.wrongIds);
        }
      }
    });

    document.addEventListener("keydown", (e) => {
      if (
        e.target instanceof HTMLInputElement &&
        e.target.id === "kana-direct-input" &&
        e.key === "Enter"
      ) {
        e.preventDefault();
        submitInputAnswer();
      }
    });
  }

  function onEnterQuizTab() {
    const mode = document.getElementById("vocab-quiz-mode")?.value || "mcq";
    const subOpts = document.getElementById("subjective-extra-options");
    if (subOpts) subOpts.hidden = mode !== "subjective";
  }

  // 문법 탭 전용 실전 퀴즈 트리거
  function startGrammarQuiz(countValue = 10, containerId = "grammar-quiz-runner") {
    startExamQuiz("all_grammar", countValue, containerId);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindQuizEvents);
  } else {
    bindQuizEvents();
  }

  window.JLPTQuiz = {
    onEnterQuizTab,
    startConfiguredQuiz,
    startMcqQuiz,
    startSubjectiveQuiz,
    startGrammarQuiz,
    startExamQuiz,
    OFFICIAL_EXAM_BANK
  };
})();
