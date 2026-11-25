(() => {
  "use strict";

  const DATA = window.JLPTData || {};
  const loadState =
    typeof DATA.loadState === "function"
      ? DATA.loadState
      : () => ({ progress: {}, wrongStats: {}, favorites: [], customDecks: [] });
  const saveState = typeof DATA.saveState === "function" ? DATA.saveState : () => {};
  const calculateNextSrs =
    typeof DATA.calculateNextSrs === "function"
      ? DATA.calculateNextSrs
      : (prev) => ({ ...(prev || {}), lastReviewedAt: new Date().toISOString() });

  const SIX_TYPES = [
    {
      key: "kanji_reading",
      label: "問題 1 한자읽기",
      directive: "次の言葉の読み方として最もよいものを、1・2・3・4から一つ選びなさい。"
    },
    {
      key: "notation",
      label: "問題 2 표기",
      directive: "次の言葉を漢字で書くとき、最もよいものを、1・2・3・4から一つ選びなさい。"
    },
    {
      key: "word_formation",
      label: "問題 3 단어형성",
      directive: "次の文の ( ) に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。"
    },
    {
      key: "context_fill",
      label: "問題 4 문맥구성",
      directive: "次の文の ( ) に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。"
    },
    {
      key: "paraphrase",
      label: "問題 5 유의표현",
      directive: "次の言葉に意味が最も近いものを、1・2・3・4から一つ選びなさい。"
    },
    {
      key: "usage",
      label: "問題 6 용법",
      directive: "次の言葉の使い方として最もよいものを、1・2・3・4から一つ選びなさい。"
    }
  ];

  // =========================================================
  // 1. 기출 및 예시 시드 데이터
  // =========================================================
  const OFFICIAL_EXAM_BANK = {
    q7: [
      {
        id: "ex-q7-01",
        grammarId: "g-002",
        type: "q7",
        typeLabel: "問題 7 (文法形式の判断)",
        directive: "次の文の ( ) に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。",
        sentence: "彼女は悲しみの ( )、声が出なくなってしまった。",
        choices: ["まで", "わけ", "あまり", "ばかり"],
        correctIndex: 2,
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
        correctIndex: 1,
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
        correctIndex: 1,
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
        correctIndex: 0,
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
        correctIndex: 3,
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
        correctIndex: 1,
        answerWord: "〜か〜ないかのうちに",
        translation: "그는 커피에 입을 대자마자 허둥지둥 가게를 나갔다.",
        explanation: "「동사 사전형 + か + 동사 ない형 + かのうちに」: 앞 동작이 끝나기가 무섭게 다음 사태가 일어남."
      }
    ],
    q8: [
      {
        id: "ex-q8-01",
        grammarId: "g-020",
        type: "q8",
        typeLabel: "問題 8 (文の組み立て)",
        directive: "次の文の ★ に入る最もよいものを、1・2・3・4から一つ選びなさい。",
        prefix: "あのチームの選手は",
        suffix: "",
        fragments: ["から", "強そうだ", "体格", "して"],
        correctOrder: [3, 1, 4, 2],
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
        fragments: ["遠慮する", "物だから", "高価な", "といって"],
        correctOrder: [3, 2, 4, 1],
        starSlotIndex: 2,
        correctChoice: 4,
        fullSentence: "高価な物だからといって遠慮するのは、かえって失礼になることもあります。",
        translation: "비싼 물건이라고 해서 사양하는 것은 오히려 실례가 될 수도 있습니다.",
        explanation: "「〜からといって」: '高価な(3) + 物だから(2) + といって(4) + 遠慮する(1)' 순서로 배열되어, ★ 자리에는 4번(といって)이 들어갑니다."
      }
    ]
  };

  const PHOTO_SEED_BANK = {
    q7: [
      {
        id: "photo-q7-31",
        grammarId: "g-kara-suru-to",
        type: "q7",
        typeLabel: "問題 7 · 文法形式の判断",
        directive: "次の文の（ ）に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。",
        sentence: "あの様子（ ）、彼は試合に負けたらしい。",
        choices: ["からには", "かというと", "からすると", "からといって"],
        correctIndex: 2,
        translation: "그 모습으로 보아 그는 시합에 진 것 같다.",
        explanation:
          "「〜からすると」는 어떤 단서나 상태를 근거로 판단·추측할 때 씁니다 (~로 보아). 「からには」(~한 이상), 「かというと」(~인가 하면), 「からといって」(~라고 해서)와 구분하세요."
      }
    ],
    q8: [
      {
        id: "photo-q8-43",
        grammarId: "g-ni-suginai",
        type: "q8",
        typeLabel: "問題 8 · 文の組み立て",
        directive: "次の文の ★ に入る最もよいものを、1・2・3・4から一つ選びなさい。",
        prefix: "私は",
        suffix: "ことは社員の方に聞いてください。",
        fragments: ["にすぎない", "アルバイト", "ので", "詳しい"],
        correctOrder: [2, 1, 3, 4],
        starSlotIndex: 2,
        correctChoice: 3,
        fullSentence: "私はアルバイトにすぎないので詳しいことは社員の方に聞いてください。",
        translation: "저는 아르바이트에 지나지 않기 때문에 자세한 것은 직원 분께 물어 보세요.",
        explanation:
          "명사(アルバイト) + にすぎない + ので(이유) + 詳しい(こと) 순으로 연결되며, ★ 자리에는 3번(ので)이 옵니다."
      }
    ],
    q9: [
      {
        id: "photo-q9-48-49",
        grammarId: "g-wake-dewa-nai",
        type: "q9",
        typeLabel: "問題 9 · 文章の文法",
        directive:
          "次の文章を読んで、文章全体の内容を考えて、＿＿＿ の中に入る最もよいものを、1・2・3・4から一つ選びなさい。",
        passage:
          "世の中には、人の目につきたくてうずうずしている人もいない [48]。しかし、大半の人は、大声を出して人に見られるのをはずかしいと思う。あぶないなあと思っても、声を出して注意を発するまでに至らないことが多いのではなかろうか。電車の事故や、火事などというような、直接的な問題ばかりではない。考えてみると、世の中には、めいめいが早めにさわぎたてれば、それで大事に至らずに済むということが少なくないのだ。[49]、自分の身に直接の影響がないと、たいていのことは、ひとごとに見える。（後略）",
        blanks: [
          {
            blankNo: 48,
            label: "空欄 [48]",
            choices: ["ものだ", "ものではない", "わけだ", "わけではない"],
            correctIndex: 3,
            explanation:
              "뒤에 「しかし、大半の人は〜」라는 역접·대조가 이어지므로, 전면 부정이 아닌 부분 부정 「〜わけではない」(~라고 할 수는 없다)가 자연스럽습니다."
          },
          {
            blankNo: 49,
            label: "空欄 [49]",
            choices: ["そこで", "ところが", "さて", "それとも"],
            correctIndex: 1,
            explanation:
              "앞 문장의 「미리 소란을 피우면 큰일이 안 될 수도 있다」는 가능성과 뒷 문장의 「직접 영향이 없으면 남의 일처럼 보인다」는 현실을 대조하므로 역접 접속사 「ところが」(그런데/하지만)가 적절합니다."
          }
        ],
        translation:
          "세상에는 남의 눈에 띄고 싶어 안달하는 사람도 없는 것은 아니다. 하지만 대부분의 사람은 큰소리를 내서 주목받는 것을 부끄럽게 생각한다. 위험하다고 알아차려도 소리 내어 주의를 주기까지 이르지 못하는 경우가 많지 않은가. 전철 사고나 화재 같은 직접적인 문제만은 아니다. 생각해 보면 세상에는 각자가 일찌감치 소란을 피우면 큰일이 되지 않고 끝날 수 있는 일이 적지 않다. 그런데 자기 몸에 직접적인 영향이 없으면 대부분 남의 일처럼 보인다.",
        explanation:
          "문맥상 앞뒤 문장의 논리 관계(부분 부정 호응, 역접 접속)와 문장 성분을 함께 확인해야 합니다."
      }
    ]
  };

  // =========================================================
  // 2. 세션 상태 관리
  // =========================================================
  const quizSession = {
    sixType: {
      questions: [],
      index: 0,
      score: 0,
      answered: false,
      wrongQuestions: [],
      containerId: "vocab-quiz-runner",
      lastCounts: null
    },
    exam: {
      questions: [],
      index: 0,
      score: 0,
      answered: false,
      wrongQuestions: [],
      arrangedSlots: [null, null, null, null],
      usedFragments: [false, false, false, false],
      containerId: "vocab-quiz-runner"
    },
    grammarCustom: {
      questions: [],
      index: 0,
      score: 0,
      answered: false,
      wrongQuestions: [],
      arrangedSlots: [null, null, null, null],
      usedFragments: [false, false, false, false],
      q9Answers: {},
      containerId: "grammar-quiz-runner"
    }
  };

  // =========================================================
  // 3. 유틸리티 & 상태/SRS 기록
  // =========================================================
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

  function hasKanji(str) {
    return /[\u4E00-\u9FFF\u3400-\u4DBF々]/.test(String(str || ""));
  }

  function getDisplayGrammarText(item) {
    return item.pattern || item.word || item.kana || "";
  }

  function getGrammarDbItems() {
    const sources = [
      Array.isArray(DATA.GRAMMAR_DB) ? DATA.GRAMMAR_DB : [],
      Array.isArray(window.GRAMMAR_DB) ? window.GRAMMAR_DB : [],
      Array.isArray(window.GRAMMAR_DB_101_150) ? window.GRAMMAR_DB_101_150 : [],
      Array.isArray(DATA.GRAMMAR_PASSAGE_DB) ? DATA.GRAMMAR_PASSAGE_DB : []
    ];

    const map = new Map();
    for (const list of sources) {
      for (const item of list) {
        if (!item) continue;
        const key = String(item.id || item.pattern || item.word || map.size);
        if (!map.has(key)) {
          map.set(key, { ...item, id: item.id || key });
        }
      }
    }
    return Array.from(map.values());
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
    if (["미학습", "모름", "애매함", "완벽함", "외움", "헷갈림", "미암기"].includes(scopeValue)) {
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

  function recordResult(itemOrQuestion, isCorrect, modeName) {
    const state = loadState();
    state.progress = state.progress || {};
    state.wrongStats = state.wrongStats || {};

    const targetId = itemOrQuestion?.item?.id || itemOrQuestion?.grammarId || itemOrQuestion?.id;
    if (!targetId) return;

    const idStr = String(targetId);
    const prevProg = state.progress[idStr] || null;
    const isGrammar =
      itemOrQuestion?._domain === "grammar" ||
      itemOrQuestion?.type === "grammar" ||
      itemOrQuestion?.type === "q7" ||
      itemOrQuestion?.type === "q8" ||
      itemOrQuestion?.type === "q9" ||
      Boolean(itemOrQuestion?.grammarId);
    const itemType = isGrammar ? "grammar" : "vocab";

    state.progress[idStr] = {
      type: itemType,
      ...calculateNextSrs(prevProg, isCorrect ? "완벽함" : "모름")
    };

    if (!isCorrect) {
      const prevWrong = state.wrongStats[idStr] || { count: 0 };
      state.wrongStats[idStr] = {
        count: (Number(prevWrong.count) || 0) + 1,
        lastWrongAt: new Date().toISOString(),
        lastMode: modeName
      };
    }

    saveState(state);
    notifyViewsUpdated();
  }

  // =========================================================
  // 4. DB 기반 6가지 어휘 문제 유형 출제 엔진
  // =========================================================
  const DAKUTEN_MAP = {
    か: "が", き: "ぎ", く: "ぐ", け: "げ", こ: "ご",
    さ: "ざ", し: "じ", す: "ず", せ: "ぜ", そ: "ぞ",
    た: "だ", ち: "ぢ", つ: "づ", て: "で", と: "ど",
    は: "ば", ひ: "び", ふ: "ぶ", へ: "べ", ほ: "ぼ",
    が: "か", ぎ: "き", ぐ: "く", げ: "け", ご: "こ",
    ざ: "さ", じ: "し", ず: "す", ぜ: "せ", ぞ: "そ",
    だ: "た", ぢ: "ち", づ: "つ", で: "て", ど: "と",
    ば: "は", び: "ひ", ぶ: "ふ", べ: "へ", ぼ: "ほ",
    ぱ: "は", ぴ: "ひ", ぷ: "ふ", ぺ: "へ", ぽ: "ほ"
  };

  function buildConfusingKanaDistractors(targetItem, allVocab) {
    const correctKana = String(targetItem.kana || "").trim();
    const candidates = new Set();

    const chars = [...correctKana];
    for (let i = 0; i < chars.length; i += 1) {
      if (DAKUTEN_MAP[chars[i]]) {
        const copy = chars.slice();
        copy[i] = DAKUTEN_MAP[chars[i]];
        candidates.add(copy.join(""));
      }
    }

    if (correctKana.endsWith("う") || correctKana.endsWith("ー")) {
      candidates.add(correctKana.slice(0, -1));
    }
    if (correctKana.length >= 2) {
      const last = correctKana.slice(-1);
      if (
        ["か", "き", "く", "け", "こ", "さ", "し", "す", "せ", "そ", "た", "ち", "つ", "て", "と", "る"].includes(
          last
        )
      ) {
        candidates.add(correctKana.slice(0, -1));
        candidates.add(`${correctKana}う`);
      }
    }

    const similarItems = shuffleArray(
      allVocab.filter(
        (v) =>
          String(v.id) !== String(targetItem.id) &&
          v.kana &&
          v.kana !== correctKana &&
          Math.abs([...v.kana].length - [...correctKana].length) <= 2
      )
    );
    for (const sim of similarItems) {
      candidates.add(String(sim.kana).trim());
      if (candidates.size >= 8) break;
    }

    const fallbackPool = shuffleArray(
      allVocab.filter((v) => String(v.id) !== String(targetItem.id) && v.kana && v.kana !== correctKana)
    );
    for (const fb of fallbackPool) {
      candidates.add(String(fb.kana).trim());
      if (candidates.size >= 10) break;
    }

    candidates.delete(correctKana);
    return shuffleArray([...candidates]).slice(0, 3);
  }

  function buildConfusingKanjiDistractors(targetItem, allVocab) {
    const correctWord = String(targetItem.word || "").trim();
    const correctKana = String(targetItem.kana || "").trim();
    const candidates = new Set();

    const homophones = shuffleArray(
      allVocab.filter(
        (v) =>
          String(v.id) !== String(targetItem.id) &&
          v.word &&
          v.word !== correctWord &&
          hasKanji(v.word) &&
          (v.kana === correctKana ||
            (correctKana &&
              v.kana &&
              (v.kana.startsWith(correctKana.slice(0, 2)) ||
                correctKana.startsWith(v.kana.slice(0, 2)))))
      )
    );
    for (const h of homophones) {
      candidates.add(String(h.word).trim());
      if (candidates.size >= 3) break;
    }

    const targetLen = [...correctWord].length;
    const similarShape = shuffleArray(
      allVocab.filter(
        (v) =>
          String(v.id) !== String(targetItem.id) &&
          v.word &&
          v.word !== correctWord &&
          hasKanji(v.word) &&
          Math.abs([...v.word].length - targetLen) <= 1
      )
    );
    for (const s of similarShape) {
      candidates.add(String(s.word).trim());
      if (candidates.size >= 6) break;
    }

    const fallback = shuffleArray(
      allVocab.filter((v) => String(v.id) !== String(targetItem.id) && v.word && v.word !== correctWord)
    );
    for (const f of fallback) {
      candidates.add(String(f.word).trim());
      if (candidates.size >= 8) break;
    }

    candidates.delete(correctWord);
    return shuffleArray([...candidates]).slice(0, 3);
  }

  function makeQuestionByType(typeKey, item, allVocab) {
    const meta = SIX_TYPES.find((t) => t.key === typeKey) || SIX_TYPES[0];
    const others = shuffleArray(allVocab.filter((v) => String(v.id) !== String(item.id)));

    if (typeKey === "kanji_reading") {
      const distractors = buildConfusingKanaDistractors(item, allVocab);
      const choices = shuffleArray([item.kana, ...distractors]);
      return {
        id: `q-read-${item.id}`,
        typeKey,
        typeLabel: meta.label,
        directive: meta.directive,
        promptMain: item.example ? `${item.word}（${item.meaning}）` : item.word,
        promptSub: item.example ? `예문: ${item.example}` : `뜻: ${item.meaning}`,
        choices,
        correctIndex: choices.indexOf(item.kana),
        answerText: `${item.word} [${item.kana}] — ${item.meaning}`,
        explanation: `${item.word}는 「${item.kana}」로 읽으며, 뜻은 "${item.meaning}"입니다.${
          item.exampleMeaning ? ` (${item.exampleMeaning})` : ""
        }`,
        item
      };
    }

    if (typeKey === "notation") {
      const distractors = buildConfusingKanjiDistractors(item, allVocab);
      const choices = shuffleArray([item.word, ...distractors]);
      return {
        id: `q-not-${item.id}`,
        typeKey,
        typeLabel: meta.label,
        directive: meta.directive,
        promptMain: `${item.kana}（${item.meaning}）`,
        promptSub: item.example ? `문맥 힌트: ${item.exampleMeaning || item.meaning}` : "",
        choices,
        correctIndex: choices.indexOf(item.word),
        answerText: `${item.word} [${item.kana}] — ${item.meaning}`,
        explanation: `"${item.meaning}"(${item.kana})의 올바른 표기는 「${item.word}」입니다.${
          item.example ? ` 예문: ${item.example}` : ""
        }`,
        item
      };
    }

    if (typeKey === "word_formation") {
      const samePos = others.filter((v) => v.pos && item.pos && v.pos === item.pos);
      const distractors = shuffleArray([...samePos, ...others])
        .map((v) => v.word)
        .filter((w, idx, arr) => w && w !== item.word && arr.indexOf(w) === idx)
        .slice(0, 3);
      const choices = shuffleArray([item.word, ...distractors]);
      const sentence = item.example
        ? String(item.example).replace(item.word, " (   ) ")
        : `この言葉の正しい形を (   ) に入れなさい [${item.meaning}]。`;
      return {
        id: `q-wf-${item.id}`,
        typeKey,
        typeLabel: meta.label,
        directive: meta.directive,
        promptMain: sentence,
        promptSub: `품사: ${item.pos || "어휘"} · 뜻: ${item.meaning}`,
        choices,
        correctIndex: choices.indexOf(item.word),
        answerText: `${item.word} [${item.kana}] — ${item.meaning}`,
        explanation: `정답은 「${item.word}」(${item.kana})입니다.${
          item.exampleMeaning ? ` 해석: ${item.exampleMeaning}` : ""
        }`,
        item
      };
    }

    if (typeKey === "context_fill") {
      const samePos = others.filter((v) => v.pos && item.pos && v.pos === item.pos);
      const distractors = shuffleArray([...samePos, ...others])
        .map((v) => v.word)
        .filter((w, idx, arr) => w && w !== item.word && arr.indexOf(w) === idx)
        .slice(0, 3);
      const choices = shuffleArray([item.word, ...distractors]);
      const sentence = item.example
        ? String(item.example).replace(item.word, " (   ) ")
        : `文脈に合う言葉を選びなさい（${item.meaning}）。`;
      return {
        id: `q-ctx-${item.id}`,
        typeKey,
        typeLabel: meta.label,
        directive: meta.directive,
        promptMain: sentence,
        promptSub: item.exampleMeaning ? `문맥 힌트: ${item.exampleMeaning}` : `뜻: ${item.meaning}`,
        choices,
        correctIndex: choices.indexOf(item.word),
        answerText: `${item.word} [${item.kana}] — ${item.meaning}`,
        explanation: `문맥상 알맞은 단어는 「${item.word}」(${item.kana}, ${item.meaning})입니다.`,
        item
      };
    }

    if (typeKey === "paraphrase") {
      const synList = Array.isArray(item.synonyms) ? item.synonyms.filter(Boolean) : [];
      const correctChoice = synList.length ? synList[0] : item.meaning;
      const forbidden = new Set([correctChoice, item.word, item.meaning]);

      const distractorPool = synList.length
        ? shuffleArray(others)
            .map((v) => v.word)
            .filter((w) => w && !forbidden.has(w))
        : shuffleArray(others)
            .map((v) => v.meaning)
            .filter((m) => m && !forbidden.has(m));

      const distractors = [...new Set(distractorPool)].slice(0, 3);
      const choices = shuffleArray([correctChoice, ...distractors]);

      return {
        id: `q-par-${item.id}`,
        typeKey,
        typeLabel: meta.label,
        directive: meta.directive,
        promptMain: item.example
          ? item.example.replace(item.word, `【${item.word}】`)
          : `【${item.word}】 (${item.kana})`,
        promptSub: `원래 뜻: ${item.meaning}`,
        choices,
        correctIndex: choices.indexOf(correctChoice),
        answerText: `${item.word} → ${correctChoice} (뜻: ${item.meaning})`,
        explanation: `「${item.word}」(${item.meaning})와 가장 가까운 표현은 「${correctChoice}」입니다.${
          item.exampleMeaning ? ` 예문 해석: ${item.exampleMeaning}` : ""
        }`,
        item
      };
    }

    const targetExample = item.example || `${item.word}（${item.meaning}）を使った正しい文。`;
    const otherExamples = shuffleArray(
      others
        .filter((v) => v.example && v.example !== targetExample)
        .map((v) => v.example)
    ).slice(0, 3);

    while (otherExamples.length < 3) {
      otherExamples.push(`この言葉（${item.meaning}）の使い方を確かめよう。`);
    }

    const choices = shuffleArray([targetExample, ...otherExamples]);
    return {
      id: `q-usg-${item.id}`,
      typeKey: "usage",
      typeLabel: meta.label,
      directive: meta.directive,
      promptMain: `${item.word}（${item.kana}）`,
      promptSub: `뜻: ${item.meaning} (${item.pos || "어휘"})`,
      choices,
      correctIndex: choices.indexOf(targetExample),
      answerText: `${item.word} [${item.kana}] — ${item.meaning}`,
      explanation: `「${item.word}」(${item.meaning})가 올바르게 쓰인 문장은 「${targetExample}」입니다.${
        item.exampleMeaning ? ` (${item.exampleMeaning})` : ""
      }`,
      item
    };
  }

  function buildSixTypeQuestions(countsByType = {}, scopeValue = "ALL", forcedQuestions = null) {
    if (Array.isArray(forcedQuestions) && forcedQuestions.length > 0) {
      return shuffleArray(forcedQuestions.slice());
    }

    const state = loadState();
    const rawVocab = Array.isArray(DATA.VOCAB_DB) ? DATA.VOCAB_DB : [];
    const scopedPool = filterByScope(rawVocab, scopeValue, state);
    const basePool = scopedPool.length ? scopedPool : rawVocab.slice();
    if (!basePool.length) return [];

    const generated = [];

    for (const t of SIX_TYPES) {
      const requestedCount = Math.max(0, Number(countsByType[t.key]) || 0);
      if (requestedCount <= 0) continue;

      let typeCandidates = basePool.slice();
      if (t.key === "kanji_reading" || t.key === "notation") {
        const kanjiItems = typeCandidates.filter((v) => v.kana && hasKanji(v.word));
        if (kanjiItems.length) typeCandidates = kanjiItems;
      } else if (t.key === "word_formation" || t.key === "context_fill" || t.key === "usage") {
        const withExample = typeCandidates.filter((v) => v.example);
        if (withExample.length) typeCandidates = withExample;
      }

      const picked = [];
      let bag = shuffleArray(typeCandidates);
      while (picked.length < requestedCount) {
        if (!bag.length) {
          bag = shuffleArray(typeCandidates.length ? typeCandidates : basePool);
        }
        picked.push(bag.pop());
      }

      for (const item of picked) {
        generated.push(makeQuestionByType(t.key, item, rawVocab));
      }
    }

    return shuffleArray(generated);
  }

  function readCountsFromInputs(overrideCounts = null) {
    if (overrideCounts && typeof overrideCounts === "object") {
      return { ...overrideCounts };
    }
    const counts = {};
    for (const t of SIX_TYPES) {
      const el = document.getElementById(`quiz-count-${t.key}`);
      counts[t.key] = el ? Math.max(0, Number(el.value) || 0) : 0;
    }
    return counts;
  }

  function hasAnySixTypeCount(counts) {
    return SIX_TYPES.some((t) => (Number(counts[t.key]) || 0) > 0);
  }

  function startCustomSixTypeQuiz(
    overrideCounts = null,
    containerId = "vocab-quiz-runner",
    forcedQuestions = null,
    overrideScope = null
  ) {
    const runner = document.getElementById(containerId);
    if (!runner) return;

    const counts = readCountsFromInputs(overrideCounts);
    const scope = overrideScope || document.getElementById("vocab-quiz-scope")?.value || "ALL";

    quizSession.sixType.containerId = containerId;
    quizSession.sixType.lastCounts = counts;
    quizSession.sixType.questions = buildSixTypeQuestions(counts, scope, forcedQuestions);
    quizSession.sixType.index = 0;
    quizSession.sixType.score = 0;
    quizSession.sixType.answered = false;
    quizSession.sixType.wrongQuestions = [];

    runner.hidden = false;
    renderSixTypeQuestion();
  }

  function renderSixTypeQuestion() {
    const runner = document.getElementById(quizSession.sixType.containerId);
    if (!runner) return;

    const q = quizSession.sixType.questions[quizSession.sixType.index];
    const total = quizSession.sixType.questions.length;

    if (!q) {
      const wrongCount = quizSession.sixType.wrongQuestions.length;
      runner.innerHTML = `
        <div class="quiz-result-box">
          <h3>🎯 6가지 문제 유형 퀴즈 완료</h3>
          <p>총 ${total}문항 중 <strong>${quizSession.sixType.score}</strong>개 정답 · 오답 <strong>${wrongCount}</strong>개</p>
          <div class="quick-action-row" style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="btn btn-primary" id="btn-six-retry-wrong" ${
              wrongCount > 0 ? "" : "disabled"
            }>틀린 문제 다시 풀기 (${wrongCount})</button>
            <button type="button" class="btn" id="btn-exam-close">닫기</button>
          </div>
        </div>
      `;
      return;
    }

    quizSession.sixType.answered = false;
    runner.innerHTML = `
      <div class="exam-card">
        <div class="exam-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div>
            <span class="badge">${escapeHtml(q.typeLabel)}</span>
            <span style="margin-left:8px;">${quizSession.sixType.index + 1} / ${total}</span>
          </div>
          <span>점수: <strong>${quizSession.sixType.score}</strong></span>
        </div>
        <div class="exam-directive" style="margin-bottom:10px;">${escapeHtml(q.directive)}</div>
        <div class="exam-sentence-box" style="margin-bottom:14px;">
          <div lang="ja" style="font-size:1.2rem; font-weight:700;">${escapeHtml(q.promptMain)}</div>
          ${
            q.promptSub
              ? `<div style="margin-top:6px; opacity:0.85;">${escapeHtml(q.promptSub)}</div>`
              : ""
          }
        </div>
        <div id="six-type-choices" style="display:grid; gap:8px;">
          ${q.choices
            .map(
              (choiceText, idx) => `
            <button type="button" class="btn six-choice-btn" data-six-choice-idx="${idx}" lang="ja">
              ${idx + 1}. ${escapeHtml(choiceText)}
            </button>
          `
            )
            .join("")}
        </div>
        <div id="six-feedback-box" style="margin-top:14px; padding:12px; border-radius:8px;" hidden></div>
        <div class="quick-action-row" style="margin-top:14px; display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" class="btn btn-primary" id="btn-six-next-q" disabled>다음 문제 →</button>
          <button type="button" class="btn" id="btn-exam-close">닫기</button>
        </div>
      </div>
    `;
  }

  function handleSixTypeAnswer(choiceBtn) {
    if (quizSession.sixType.answered) return;
    const q = quizSession.sixType.questions[quizSession.sixType.index];
    if (!q) return;

    quizSession.sixType.answered = true;
    const chosenIdx = Number(choiceBtn.getAttribute("data-six-choice-idx"));
    const isCorrect = chosenIdx === q.correctIndex;

    document.querySelectorAll("#six-type-choices .six-choice-btn").forEach((btn) => {
      btn.disabled = true;
      const idx = Number(btn.getAttribute("data-six-choice-idx"));
      if (idx === q.correctIndex) {
        btn.classList.add("btn-secondary");
        btn.style.border = "2px solid #10b981";
      } else if (btn === choiceBtn && !isCorrect) {
        btn.classList.add("btn-danger");
      }
    });

    const fb = document.getElementById("six-feedback-box");
    if (fb) {
      fb.hidden = false;
      if (isCorrect) {
        quizSession.sixType.score += 1;
        fb.style.background = "rgba(16, 185, 129, 0.12)";
        fb.style.border = "1px solid #10b981";
      } else {
        quizSession.sixType.wrongQuestions.push(q);
        fb.style.background = "rgba(239, 68, 68, 0.12)";
        fb.style.border = "1px solid #ef4444";
      }
      fb.innerHTML = `
        <div style="font-weight:700; margin-bottom:6px;">${
          isCorrect ? "✓ 정답입니다!" : "✕ 오답입니다"
        }</div>
        <div style="margin-bottom:6px;">정답: <strong>${q.correctIndex + 1}번 「${escapeHtml(
        q.choices[q.correctIndex]
      )}」</strong> (${escapeHtml(q.answerText)})</div>
        <div><strong>[해설]</strong> ${escapeHtml(q.explanation)}</div>
      `;
    }

    recordResult(q.item, isCorrect, q.typeLabel);
    const nextBtn = document.getElementById("btn-six-next-q");
    if (nextBtn) nextBtn.disabled = false;
  }

  // =========================================================
  // 5. 실전 문법(Q7/Q8) 생성기 및 실행기
  // =========================================================
  function createDynamicQ7FromGrammar(gItem) {
    const gPool = getGrammarDbItems().filter((g) => String(g.id) !== String(gItem.id));
    const distractors = shuffleArray(gPool)
      .slice(0, 3)
      .map((g) => getDisplayGrammarText(g));
    while (distractors.length < 3) {
      distractors.push(`〜문형${distractors.length + 1}`);
    }
    const answerText = getDisplayGrammarText(gItem);
    const choices = shuffleArray([answerText, ...distractors]);
    const correctIndex = choices.indexOf(answerText);

    const blankedSentence = gItem.example
      ? String(gItem.example).replace(answerText.replace(/^〜+/, ""), " ( ) ")
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
      answerWord: answerText,
      translation: gItem.exampleMeaning || gItem.meaning || "",
      explanation: `${answerText} (${gItem.meaning || ""}) - 접속: ${gItem.connection || "기본 접속"}`
    };
  }

  function buildExamQuestionPool(examType = "all_grammar", countValue = 10, forcedQuestions = null) {
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
      const existingGIds = new Set(rawPool.map((q) => String(q.grammarId)));
      const remainingG = getGrammarDbItems().filter((g) => !existingGIds.has(String(g.id)));
      rawPool = [...rawPool, ...remainingG.map(createDynamicQ7FromGrammar)];
    }

    const shuffled = shuffleArray(rawPool);
    if (countValue === "ALL") return shuffled;
    return shuffled.slice(0, Math.max(1, Number(countValue) || 10));
  }

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
        </div>
        <div style="margin-bottom:12px;">
          <div style="margin-bottom:6px; font-weight:600;">[ 문장 조각 ]</div>
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
          <div style="margin-bottom:6px; font-weight:600;">★ 에 들어갈 번호(1~4) 선택:</div>
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

  function handleQ8FragmentClick(fragIdx) {
    if (quizSession.exam.answered) return;
    const q = quizSession.exam.questions[quizSession.exam.index];
    if (!q || q.type !== "q8" || quizSession.exam.usedFragments[fragIdx]) return;
    const emptySlotIdx = quizSession.exam.arrangedSlots.indexOf(null);
    if (emptySlotIdx === -1) return;

    quizSession.exam.arrangedSlots[emptySlotIdx] = fragIdx + 1;
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
    document.querySelectorAll(".slot-underline").forEach((el) => {
      const slotIndex = Number(el.getAttribute("data-slot"));
      const choiceNum = quizSession.exam.arrangedSlots[slotIndex];
      const isStar = slotIndex === (q.starSlotIndex ?? 2);
      el.textContent =
        choiceNum != null
          ? `${isStar ? "★ " : ""}${choiceNum}. ${q.fragments[choiceNum - 1]}`
          : isStar
          ? "★"
          : "＿＿＿";
    });
    document.querySelectorAll(".q8-frag-btn").forEach((btn) => {
      const idx = Number(btn.getAttribute("data-frag-idx"));
      btn.disabled = Boolean(quizSession.exam.usedFragments[idx]);
    });
  }

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
    recordResult(q, isCorrect, "問題 7 (文法形式)");
  }

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
    )}」</strong><br />• 올바른 문장: <span lang="ja">${escapeHtml(q.fullSentence)}</span>`;
    showExamFeedback(q, isCorrect, detailText);
    recordResult(q, isCorrect, "問題 8 (文の組み立て)");
  }

  function showExamFeedback(q, isCorrect, answerSummaryHtml) {
    const fb = document.getElementById("exam-feedback-box");
    if (!fb) return;

    fb.hidden = false;
    if (isCorrect) {
      quizSession.exam.score += 1;
      fb.style.background = "rgba(16, 185, 129, 0.12)";
      fb.style.border = "1px solid #10b981";
    } else {
      quizSession.exam.wrongQuestions.push(q);
      fb.style.background = "rgba(239, 68, 68, 0.12)";
      fb.style.border = "1px solid #ef4444";
    }

    fb.innerHTML = `<div style="font-weight:700; margin-bottom:6px;">${
      isCorrect ? "✓ 정답입니다!" : "✕ 오답입니다"
    }</div><div style="margin-bottom:6px;">${answerSummaryHtml}</div><div><strong>[해석]</strong> ${escapeHtml(
      q.translation
    )}<br /><strong>[해설]</strong> ${escapeHtml(q.explanation)}</div>`;

    const nextBtn = document.getElementById("btn-exam-next-q");
    if (nextBtn) nextBtn.disabled = false;
  }

  // =========================================================
  // 6. DB 기반 문법 7·8·9 유형별 개수 설정 & 생성기
  // =========================================================
  function generateQ7FromDb(item, allGrammar) {
    const targetText = getDisplayGrammarText(item);
    const distractors = shuffleArray(
      allGrammar.filter((g) => String(g.id) !== String(item.id) && getDisplayGrammarText(g))
    )
      .slice(0, 3)
      .map(getDisplayGrammarText);

    while (distractors.length < 3) {
      distractors.push(`〜${distractors.length + 1}형`);
    }

    const choices = shuffleArray([targetText, ...distractors]);
    const correctIndex = choices.indexOf(targetText);

    const rawExample = String(item.example || "");
    const cleanTarget = targetText.replace(/^〜+/, "").trim();
    let sentence = `${targetText}（${item.connection || "接続確認"}）の正しい使い方はどれか。`;

    if (rawExample) {
      if (cleanTarget && rawExample.includes(cleanTarget)) {
        sentence = rawExample.replace(cleanTarget, "（ ）");
      } else if (rawExample.includes("（") || rawExample.includes("(")) {
        sentence = rawExample.replace(/[（(][^）)]*[）)]/, "（ ）");
      } else {
        sentence = `${rawExample} — 空欄に入る「${targetText}」の用法を選べ。`;
      }
    }

    return {
      id: `db-q7-${item.id}-${Math.random().toString(36).slice(2, 6)}`,
      grammarId: item.id,
      type: "q7",
      typeLabel: "問題 7 · 文法形式の判断",
      directive: "次の文の（ ）に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。",
      sentence,
      choices,
      correctIndex,
      translation: item.exampleMeaning || item.meaning || "",
      explanation: `${targetText} (${item.meaning || ""})${
        item.connection ? ` / 접속: ${item.connection}` : ""
      }${item.explanation ? ` — ${item.explanation}` : ""}`
    };
  }

  function generateQ8FromDb(item, allGrammar) {
    const targetText = getDisplayGrammarText(item);
    const coreGrammar = targetText.replace(/^〜+/, "").trim() || targetText;
    const connPart = item.connection
      ? String(item.connection).split("/")[0].replace(/〜/g, "").trim()
      : "接続";

    const rawFragments = [
      connPart || "表現",
      coreGrammar,
      item.meaning ? String(item.meaning).split(",")[0].trim() : "意味",
      "文脈"
    ];

    const fragments = shuffleArray(rawFragments);
    const correctOrder = [1, 2, 3, 4];
    const starIdx = 2;
    const answerFragIdx = Math.max(
      0,
      fragments.findIndex((f) => f === coreGrammar)
    );
    const correctChoice = answerFragIdx + 1;

    return {
      id: `db-q8-${item.id}-${Math.random().toString(36).slice(2, 6)}`,
      grammarId: item.id,
      type: "q8",
      typeLabel: "問題 8 · 文の組み立て",
      directive: "次の文の ★ に入る最もよいものを、1・2・3・4から一つ選びなさい。",
      prefix: item.example ? "" : `「${targetText}」を使った文：`,
      suffix: item.example ? `（参考例文: ${item.example}）` : "の形を完成させよう。",
      fragments,
      correctOrder,
      starSlotIndex: starIdx,
      correctChoice,
      fullSentence: item.example || `${connPart} + ${coreGrammar}`,
      translation: item.exampleMeaning || item.meaning || "",
      explanation: `핵심 문형 「${targetText}」(${item.meaning || ""})의 ★ 선택지는 ${correctChoice}번 「${
        fragments[answerFragIdx]
      }」입니다. ${item.explanation || ""}`
    };
  }

  function generateQ9FromDb(itemsChunk, allGrammar) {
    const validChunk = itemsChunk.filter(Boolean).slice(0, 2);
    if (!validChunk.length) return null;

    const passageParts = [];
    const blanks = [];

    validChunk.forEach((item, idx) => {
      const blankNo = 48 + idx;
      const targetText = getDisplayGrammarText(item);
      const distractors = shuffleArray(
        allGrammar.filter((g) => String(g.id) !== String(item.id) && getDisplayGrammarText(g))
      )
        .slice(0, 3)
        .map(getDisplayGrammarText);

      while (distractors.length < 3) {
        distractors.push(`〜別表現${distractors.length + 1}`);
      }

      const choices = shuffleArray([targetText, ...distractors]);
      const correctIndex = choices.indexOf(targetText);

      const sentenceWithBlank = item.example
        ? String(item.example).replace(targetText.replace(/^〜+/, ""), ` [${blankNo}] `)
        : `文脈に合わせて [${blankNo}] に適切な表現を入れる。`;

      passageParts.push(sentenceWithBlank);
      blanks.push({
        blankNo,
        label: `空欄 [${blankNo}]`,
        choices,
        correctIndex,
        explanation: `[${blankNo}] 정답: ${correctIndex + 1}번 「${targetText}」 — ${
          item.meaning || ""
        } (${item.explanation || item.connection || ""})`
      });
    });

    return {
      id: `db-q9-${validChunk.map((x) => x.id).join("-")}-${Math.random().toString(36).slice(2, 6)}`,
      grammarId: validChunk[0].id,
      type: "q9",
      typeLabel: "問題 9 · 文章の文法",
      directive:
        "次の文章を読んで、文章全体の内容を考えて、空欄に入る最もよいものを、1・2・3・4から一つ選びなさい。",
      passage: passageParts.join(" "),
      blanks,
      translation: validChunk
        .map((x) => x.exampleMeaning || x.meaning || "")
        .filter(Boolean)
        .join(" / "),
      explanation: blanks.map((b) => b.explanation).join(" | ")
    };
  }

  function buildGrammarQuestionsByCounts({ q7Count = 3, q8Count = 2, q9Count = 1 } = {}) {
    const db = getGrammarDbItems();
    const n7 = Math.max(0, Number(q7Count) || 0);
    const n8 = Math.max(0, Number(q8Count) || 0);
    const n9 = Math.max(0, Number(q9Count) || 0);

    const result = [];

    const q7Pool = shuffleArray(db);
    for (let i = 0; i < n7; i += 1) {
      if (i < q7Pool.length) {
        result.push(generateQ7FromDb(q7Pool[i], db));
      } else {
        const seed = PHOTO_SEED_BANK.q7[i % PHOTO_SEED_BANK.q7.length];
        result.push({ ...seed, id: `${seed.id}-${i}` });
      }
    }

    const q8Pool = shuffleArray(db);
    for (let i = 0; i < n8; i += 1) {
      if (i < q8Pool.length) {
        result.push(generateQ8FromDb(q8Pool[i], db));
      } else {
        const seed = PHOTO_SEED_BANK.q8[i % PHOTO_SEED_BANK.q8.length];
        result.push({ ...seed, id: `${seed.id}-${i}` });
      }
    }

    const q9Pool = shuffleArray(db);
    for (let i = 0; i < n9; i += 1) {
      const slice = q9Pool.slice(i * 2, i * 2 + 2);
      const q9Obj = slice.length ? generateQ9FromDb(slice, db) : null;
      if (q9Obj) {
        result.push(q9Obj);
      } else {
        const seed = PHOTO_SEED_BANK.q9[i % PHOTO_SEED_BANK.q9.length];
        result.push({ ...seed, id: `${seed.id}-${i}` });
      }
    }

    return result;
  }

  function renderTypeCountConfigurator(containerId = "grammar-quiz-config") {
    const host = document.getElementById(containerId);
    if (!host) return;

    host.innerHTML = `
      <div class="grammar-type-config-box" style="display:flex; flex-wrap:wrap; gap:10px; align-items:flex-end; padding:12px; border:1px solid #cbd5e1; border-radius:8px; margin-bottom:12px;">
        <label style="display:flex; flex-direction:column; gap:4px; font-size:0.9rem;">
          <span>問題 7 (문법형식) 개수</span>
          <input type="number" id="gquiz-count-q7" min="0" max="30" value="3" style="width:84px; padding:6px 8px;" />
        </label>
        <label style="display:flex; flex-direction:column; gap:4px; font-size:0.9rem;">
          <span>問題 8 (문장만들기 ★) 개수</span>
          <input type="number" id="gquiz-count-q8" min="0" max="30" value="2" style="width:84px; padding:6px 8px;" />
        </label>
        <label style="display:flex; flex-direction:column; gap:4px; font-size:0.9rem;">
          <span>問題 9 (글의 문법) 지문 수</span>
          <input type="number" id="gquiz-count-q9" min="0" max="15" value="1" style="width:84px; padding:6px 8px;" />
        </label>
        <button type="button" class="btn btn-primary" id="btn-start-custom-grammar-quiz">
          설정대로 문법 문제 생성·시작
        </button>
      </div>
    `;
  }

  function startGrammarCustomQuiz(counts = null, containerId = "grammar-quiz-runner", forced = null) {
    const runner = document.getElementById(containerId);
    if (!runner) return;

    const resolvedCounts = counts || {
      q7Count: document.getElementById("gquiz-count-q7")?.value ?? 3,
      q8Count: document.getElementById("gquiz-count-q8")?.value ?? 2,
      q9Count: document.getElementById("gquiz-count-q9")?.value ?? 1
    };

    const questions =
      Array.isArray(forced) && forced.length
        ? shuffleArray(forced.slice())
        : buildGrammarQuestionsByCounts(resolvedCounts);

    if (!questions.length) {
      runner.hidden = false;
      runner.innerHTML = `<div class="card"><p>선택된 문항 수가 0개입니다. 문제 7·8·9 개수를 1 이상으로 설정해 주세요.</p></div>`;
      return;
    }

    quizSession.grammarCustom.containerId = containerId;
    quizSession.grammarCustom.questions = questions;
    quizSession.grammarCustom.index = 0;
    quizSession.grammarCustom.score = 0;
    quizSession.grammarCustom.answered = false;
    quizSession.grammarCustom.wrongQuestions = [];
    quizSession.grammarCustom.q9Answers = {};

    runner.hidden = false;
    renderCurrentGrammarQuestion();
  }

  function renderCurrentGrammarQuestion() {
    const runner = document.getElementById(quizSession.grammarCustom.containerId);
    if (!runner) return;

    const q = quizSession.grammarCustom.questions[quizSession.grammarCustom.index];
    const total = quizSession.grammarCustom.questions.length;

    if (!q) {
      const wrongCount = quizSession.grammarCustom.wrongQuestions.length;
      runner.innerHTML = `
        <div class="card">
          <h3>문법 퀴즈 완료</h3>
          <p>총 ${total}문항 중 <strong>${quizSession.grammarCustom.score}</strong>점 · 오답 <strong>${wrongCount}</strong>개</p>
          <div style="display:flex; gap:8px; margin-top:12px;">
            <button type="button" class="btn btn-primary" id="btn-gquiz-retry-wrong" ${
              wrongCount > 0 ? "" : "disabled"
            }>틀린 문제 다시 풀기 (${wrongCount})</button>
            <button type="button" class="btn" id="btn-gquiz-close">닫기</button>
          </div>
        </div>
      `;
      return;
    }

    quizSession.grammarCustom.answered = false;
    quizSession.grammarCustom.arrangedSlots = [null, null, null, null];
    quizSession.grammarCustom.usedFragments = [false, false, false, false];
    quizSession.grammarCustom.q9Answers = {};

    if (q.type === "q8") {
      renderQ8View(runner, q, total);
    } else if (q.type === "q9") {
      renderQ9View(runner, q, total);
    } else {
      renderQ7View(runner, q, total);
    }
  }

  function renderQ7View(runner, q, total) {
    runner.innerHTML = `
      <div class="card">
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <span class="badge">${escapeHtml(q.typeLabel)} (${
      quizSession.grammarCustom.index + 1
    }/${total})</span>
          <span>점수: <strong>${quizSession.grammarCustom.score}</strong></span>
        </div>
        <p style="margin-bottom:8px;">${escapeHtml(q.directive)}</p>
        <div lang="ja" style="font-size:1.15rem; font-weight:600; margin-bottom:12px;">${escapeHtml(
          q.sentence
        )}</div>
        <div id="gquiz-q7-choices" style="display:grid; gap:8px;">
          ${q.choices
            .map(
              (c, i) => `
            <button type="button" class="btn gquiz-q7-btn" data-q7-idx="${i}" lang="ja">
              ${i + 1}. ${escapeHtml(c)}
            </button>
          `
            )
            .join("")}
        </div>
        <div id="gquiz-feedback" style="margin-top:12px; padding:10px; border-radius:8px;" hidden></div>
        <div style="display:flex; gap:8px; margin-top:12px;">
          <button type="button" class="btn btn-primary" id="btn-gquiz-next" disabled>다음 문항 →</button>
          <button type="button" class="btn" id="btn-gquiz-close">닫기</button>
        </div>
      </div>
    `;
  }

  function renderQ8View(runner, q, total) {
    const starIdx = q.starSlotIndex ?? 2;
    const slotsHtml = [0, 1, 2, 3]
      .map((sIdx) => {
        const isStar = sIdx === starIdx;
        return `<span class="gquiz-slot" data-slot="${sIdx}" style="display:inline-block; min-width:48px; text-align:center; border-bottom:2px solid currentColor; margin:0 3px; padding:0 4px; font-weight:${
          isStar ? "700" : "500"
        };">${isStar ? "★" : "＿＿＿"}</span>`;
      })
      .join("");

    runner.innerHTML = `
      <div class="card">
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <span class="badge">${escapeHtml(q.typeLabel)} (${
      quizSession.grammarCustom.index + 1
    }/${total})</span>
          <span>점수: <strong>${quizSession.grammarCustom.score}</strong></span>
        </div>
        <p style="margin-bottom:8px;">${escapeHtml(q.directive)}</p>
        <div lang="ja" style="font-size:1.12rem; font-weight:600; line-height:1.8; margin-bottom:12px;">
          ${escapeHtml(q.prefix || "")}${slotsHtml}${escapeHtml(q.suffix || "")}
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
          ${q.fragments
            .map(
              (frag, idx) => `
            <button type="button" class="btn gquiz-frag-btn" data-frag-idx="${idx}" lang="ja">
              ${idx + 1}. ${escapeHtml(frag)}
            </button>
          `
            )
            .join("")}
          <button type="button" class="btn" id="btn-gquiz-q8-reset">초기화</button>
        </div>
        <div style="margin-bottom:10px; font-weight:600;">★ 에 들어갈 번호 선택:</div>
        <div style="display:flex; gap:8px;">
          ${[1, 2, 3, 4]
            .map(
              (num) => `
            <button type="button" class="btn gquiz-star-btn" data-star-num="${num}">${num}번</button>
          `
            )
            .join("")}
        </div>
        <div id="gquiz-feedback" style="margin-top:12px; padding:10px; border-radius:8px;" hidden></div>
        <div style="display:flex; gap:8px; margin-top:12px;">
          <button type="button" class="btn btn-primary" id="btn-gquiz-next" disabled>다음 문항 →</button>
          <button type="button" class="btn" id="btn-gquiz-close">닫기</button>
        </div>
      </div>
    `;
  }

  function renderQ9View(runner, q, total) {
    runner.innerHTML = `
      <div class="card">
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <span class="badge">${escapeHtml(q.typeLabel)} (${
      quizSession.grammarCustom.index + 1
    }/${total})</span>
          <span>점수: <strong>${quizSession.grammarCustom.score}</strong></span>
        </div>
        <p style="margin-bottom:8px;">${escapeHtml(q.directive)}</p>
        <div lang="ja" style="padding:12px; border-radius:8px; background:rgba(128,128,128,0.08); line-height:1.8; margin-bottom:12px;">
          ${escapeHtml(q.passage)}
        </div>
        <div style="display:grid; gap:12px;">
          ${q.blanks
            .map(
              (b) => `
            <div class="gquiz-blank-group" data-blank-no="${b.blankNo}" style="border:1px solid #cbd5e1; border-radius:8px; padding:10px;">
              <div style="font-weight:600; margin-bottom:6px;">${escapeHtml(b.label)}</div>
              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:6px;">
                ${b.choices
                  .map(
                    (c, cIdx) => `
                  <button type="button" class="btn gquiz-q9-choice" data-blank-no="${
                    b.blankNo
                  }" data-c-idx="${cIdx}" lang="ja">
                    ${cIdx + 1}. ${escapeHtml(c)}
                  </button>
                `
                  )
                  .join("")}
              </div>
            </div>
          `
            )
            .join("")}
        </div>
        <div id="gquiz-feedback" style="margin-top:12px; padding:10px; border-radius:8px;" hidden></div>
        <div style="display:flex; gap:8px; margin-top:12px;">
          <button type="button" class="btn btn-primary" id="btn-gquiz-q9-check">빈칸 전체 채점</button>
          <button type="button" class="btn btn-primary" id="btn-gquiz-next" disabled>다음 문항 →</button>
          <button type="button" class="btn" id="btn-gquiz-close">닫기</button>
        </div>
      </div>
    `;
  }

  function finishGrammarItem(q, isCorrect, summaryHtml) {
    quizSession.grammarCustom.answered = true;
    if (isCorrect) {
      quizSession.grammarCustom.score += 1;
      quizSession.grammarCustom.wrongQuestions = quizSession.grammarCustom.wrongQuestions.filter(
        (x) => x.id !== q.id
      );
    } else {
      quizSession.grammarCustom.wrongQuestions.push(q);
    }

    const fb = document.getElementById("gquiz-feedback");
    if (fb) {
      fb.hidden = false;
      fb.innerHTML = `
        <div><strong>${isCorrect ? "✓ 정답" : "✕ 오답"}</strong> — ${summaryHtml}</div>
        ${
          q.translation
            ? `<div style="margin-top:4px;"><strong>해석:</strong> ${escapeHtml(q.translation)}</div>`
            : ""
        }
        ${
          q.explanation
            ? `<div style="margin-top:4px;"><strong>해설:</strong> ${escapeHtml(q.explanation)}</div>`
            : ""
        }
      `;
    }

    recordResult(q, isCorrect, q.typeLabel || "문법 7·8·9 퀴즈");
    const nextBtn = document.getElementById("btn-gquiz-next");
    if (nextBtn) nextBtn.disabled = false;
  }

  // =========================================================
  // 7. 통합 이벤트 바인딩 & 초기화
  // =========================================================
  function startConfiguredQuiz() {
    const customCounts = readCountsFromInputs();
    if (hasAnySixTypeCount(customCounts)) {
      startCustomSixTypeQuiz(customCounts, "vocab-quiz-runner");
      return;
    }

    const domain = document.getElementById("vocab-quiz-domain")?.value || "vocab";
    const mode = document.getElementById("vocab-quiz-mode")?.value || "six_all";
    const countVal = document.getElementById("vocab-quiz-count")?.value || "10";

    if (mode === "six_all") {
      const n = Math.max(1, Number(countVal) || 10);
      startCustomSixTypeQuiz(
        {
          kanji_reading: n,
          notation: n,
          word_formation: n,
          context_fill: n,
          paraphrase: n,
          usage: n
        },
        "vocab-quiz-runner"
      );
      return;
    }

    if (domain === "grammar" || mode === "exam_q7" || mode === "exam_q8" || mode === "exam_all") {
      let examType = "all_grammar";
      if (mode === "exam_q7") examType = "q7_only";
      else if (mode === "exam_q8") examType = "q8_only";
      startExamQuiz(examType, countVal, "vocab-quiz-runner");
      return;
    }

    if (SIX_TYPES.some((t) => t.key === mode)) {
      startCustomSixTypeQuiz({ [mode]: Math.max(1, Number(countVal) || 10) }, "vocab-quiz-runner");
    }
  }

  let eventsBound = false;

  function bindAllQuizEvents() {
    if (eventsBound) return;
    eventsBound = true;

    document
      .getElementById("btn-start-six-type-quiz")
      ?.addEventListener("click", () => startCustomSixTypeQuiz(null, "vocab-quiz-runner"));

    document
      .getElementById("btn-start-vocab-quiz")
      ?.addEventListener("click", () => startConfiguredQuiz());

    document.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      // 커스텀 문법 퀴즈 시작
      if (target.id === "btn-start-custom-grammar-quiz") {
        startGrammarCustomQuiz();
        return;
      }

      // 닫기 / 초기화 버튼
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
        if (gRunner) gRunner.innerHTML = "";
        return;
      }

      if (target.id === "btn-gquiz-close") {
        const runner = document.getElementById(quizSession.grammarCustom.containerId);
        if (runner) {
          runner.hidden = true;
          runner.innerHTML = "";
        }
        return;
      }

      // [6가지 어휘 유형]
      const sixBtn = target.closest(".six-choice-btn");
      if (sixBtn && !quizSession.sixType.answered) {
        handleSixTypeAnswer(sixBtn);
        return;
      }

      if (target.id === "btn-six-next-q") {
        quizSession.sixType.index += 1;
        renderSixTypeQuestion();
        return;
      }

      if (target.id === "btn-six-retry-wrong") {
        if (quizSession.sixType.wrongQuestions.length) {
          startCustomSixTypeQuiz(
            quizSession.sixType.lastCounts,
            quizSession.sixType.containerId,
            quizSession.sixType.wrongQuestions.slice()
          );
        }
        return;
      }

      // [실전 문법 Q7 / Q8]
      const q7Btn = target.closest(".exam-choice-btn");
      if (q7Btn && !quizSession.exam.answered) {
        handleQ7Answer(q7Btn);
        return;
      }

      const q8FragBtn = target.closest(".q8-frag-btn");
      if (q8FragBtn && !quizSession.exam.answered) {
        handleQ8FragmentClick(Number(q8FragBtn.getAttribute("data-frag-idx")));
        return;
      }

      if (target.id === "btn-q8-reset-slots") {
        const q = quizSession.exam.questions[quizSession.exam.index];
        if (q && q.type === "q8") resetQ8Slots(q);
        return;
      }

      const q8ChoiceNumBtn = target.closest(".q8-choice-num-btn");
      if (q8ChoiceNumBtn && !quizSession.exam.answered) {
        handleQ8Answer(Number(q8ChoiceNumBtn.getAttribute("data-choice-num")));
        return;
      }

      if (target.id === "btn-exam-next-q") {
        quizSession.exam.index += 1;
        renderExamQuestion();
        return;
      }

      if (target.id === "btn-exam-retry-wrong") {
        if (quizSession.exam.wrongQuestions.length) {
          startExamQuiz(
            "all_grammar",
            "ALL",
            quizSession.exam.containerId,
            quizSession.exam.wrongQuestions.slice()
          );
        }
        return;
      }

      // [문법 7·8·9 커스텀 생성기]
      const gq7Btn = target.closest(".gquiz-q7-btn");
      if (gq7Btn && !quizSession.grammarCustom.answered) {
        const q = quizSession.grammarCustom.questions[quizSession.grammarCustom.index];
        const picked = Number(gq7Btn.getAttribute("data-q7-idx"));
        const ok = picked === q.correctIndex;
        document.querySelectorAll(".gquiz-q7-btn").forEach((b) => (b.disabled = true));
        finishGrammarItem(
          q,
          ok,
          `정답: ${q.correctIndex + 1}번 「${escapeHtml(q.choices[q.correctIndex])}」`
        );
        return;
      }

      const gFragBtn = target.closest(".gquiz-frag-btn");
      if (gFragBtn && !quizSession.grammarCustom.answered) {
        const q = quizSession.grammarCustom.questions[quizSession.grammarCustom.index];
        const fIdx = Number(gFragBtn.getAttribute("data-frag-idx"));
        const emptySlot = quizSession.grammarCustom.arrangedSlots.indexOf(null);
        if (!quizSession.grammarCustom.usedFragments[fIdx] && emptySlot !== -1) {
          quizSession.grammarCustom.usedFragments[fIdx] = true;
          quizSession.grammarCustom.arrangedSlots[emptySlot] = fIdx + 1;
          gFragBtn.disabled = true;
          const slotEl = document.querySelector(`.gquiz-slot[data-slot="${emptySlot}"]`);
          if (slotEl) slotEl.textContent = `${fIdx + 1}. ${q.fragments[fIdx]}`;
        }
        return;
      }

      if (target.id === "btn-gquiz-q8-reset" && !quizSession.grammarCustom.answered) {
        const q = quizSession.grammarCustom.questions[quizSession.grammarCustom.index];
        quizSession.grammarCustom.arrangedSlots = [null, null, null, null];
        quizSession.grammarCustom.usedFragments = [false, false, false, false];
        document.querySelectorAll(".gquiz-frag-btn").forEach((b) => (b.disabled = false));
        document.querySelectorAll(".gquiz-slot").forEach((el) => {
          const s = Number(el.getAttribute("data-slot"));
          el.textContent = s === (q.starSlotIndex ?? 2) ? "★" : "＿＿＿";
        });
        return;
      }

      const gStarBtn = target.closest(".gquiz-star-btn");
      if (gStarBtn && !quizSession.grammarCustom.answered) {
        const q = quizSession.grammarCustom.questions[quizSession.grammarCustom.index];
        const chosenNum = Number(gStarBtn.getAttribute("data-star-num"));
        const ok = chosenNum === Number(q.correctChoice);
        document
          .querySelectorAll(".gquiz-star-btn, .gquiz-frag-btn")
          .forEach((b) => (b.disabled = true));
        finishGrammarItem(
          q,
          ok,
          `★ 정답: ${q.correctChoice}번 「${escapeHtml(q.fragments[q.correctChoice - 1])}」`
        );
        return;
      }

      const gq9Choice = target.closest(".gquiz-q9-choice");
      if (gq9Choice && !quizSession.grammarCustom.answered) {
        const blankNo = Number(gq9Choice.getAttribute("data-blank-no"));
        const cIdx = Number(gq9Choice.getAttribute("data-c-idx"));
        quizSession.grammarCustom.q9Answers[blankNo] = cIdx;
        document
          .querySelectorAll(`.gquiz-q9-choice[data-blank-no="${blankNo}"]`)
          .forEach((b) => b.classList.remove("btn-secondary"));
        gq9Choice.classList.add("btn-secondary");
        return;
      }

      if (target.id === "btn-gquiz-q9-check" && !quizSession.grammarCustom.answered) {
        const q = quizSession.grammarCustom.questions[quizSession.grammarCustom.index];
        if (!q || !Array.isArray(q.blanks)) return;
        const allPicked = q.blanks.every(
          (b) => quizSession.grammarCustom.q9Answers[b.blankNo] != null
        );
        if (!allPicked) return;

        const allCorrect = q.blanks.every(
          (b) => Number(quizSession.grammarCustom.q9Answers[b.blankNo]) === Number(b.correctIndex)
        );
        document.querySelectorAll(".gquiz-q9-choice").forEach((b) => (b.disabled = true));
        target.setAttribute("disabled", "true");
        const summary = q.blanks
          .map(
            (b) =>
              `[${b.blankNo}] ${b.correctIndex + 1}번(${escapeHtml(b.choices[b.correctIndex])})`
          )
          .join(", ");
        finishGrammarItem(q, allCorrect, summary);
        return;
      }

      if (target.id === "btn-gquiz-next") {
        quizSession.grammarCustom.index += 1;
        renderCurrentGrammarQuestion();
        return;
      }

      if (target.id === "btn-gquiz-retry-wrong") {
        if (quizSession.grammarCustom.wrongQuestions.length) {
          startGrammarCustomQuiz(
            null,
            quizSession.grammarCustom.containerId,
            quizSession.grammarCustom.wrongQuestions.slice()
          );
        }
      }
    });
  }

  function onEnterQuizTab() {
    renderTypeCountConfigurator();
  }

  function startGrammarQuiz(countValue = 10, containerId = "grammar-quiz-runner") {
    startExamQuiz("all_grammar", countValue, containerId);
  }

  function initQuizModule() {
    renderTypeCountConfigurator();
    bindAllQuizEvents();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initQuizModule);
  } else {
    initQuizModule();
  }

  window.JLPTQuiz = {
    ...(window.JLPTQuiz || {}),
    onEnterQuizTab,
    startConfiguredQuiz,
    startCustomSixTypeQuiz,
    startGrammarQuiz,
    startExamQuiz,
    renderTypeCountConfigurator,
    startGrammarCustomQuiz,
    buildGrammarQuestionsByCounts,
    SIX_TYPES,
    OFFICIAL_EXAM_BANK,
    PHOTO_SEED_BANK
  };
})();
```[cite: 1, 2]

실행해 보신 뒤 `#grammar-quiz-config`, `#grammar-quiz-runner`, `#vocab-quiz-runner` 등 HTML 요소 ID가 실제 마크업과 다른 부분이 있다면 알려주세요!
