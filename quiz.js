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
        explanation: "「〜からして」: '体格(3) + から(1) + して(4) + 強そうだ(2)' 순서로 배열되며, ★ 자리에는 4번(して)이 들어갑니다."
      }
    ]
  };

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
      Array.isArray(window.GRAMMAR_DB_101_150) ? window.GRAMMAR_DB_101_150 : []
    ];
    const map = new Map();
    for (const list of sources) {
      for (const item of list) {
        if (!item) continue;
        const key = String(item.id || item.pattern || item.word || map.size);
        if (!map.has(key)) map.set(key, { ...item, id: item.id || key });
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

    state.progress[idStr] = {
      type: isGrammar ? "grammar" : "vocab",
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

  function makeQuestionByType(typeKey, item, allVocab) {
    const meta = SIX_TYPES.find((t) => t.key === typeKey) || SIX_TYPES[0];
    const others = shuffleArray(allVocab.filter((v) => String(v.id) !== String(item.id)));

    if (typeKey === "notation") {
      const distractors = shuffleArray(others.filter((v) => v.word && v.word !== item.word))
        .slice(0, 3)
        .map((v) => v.word);
      while (distractors.length < 3) distractors.push(`表記${distractors.length + 1}`);
      const choices = shuffleArray([item.word, ...distractors]);
      return {
        id: `q-not-${item.id}`,
        typeKey,
        typeLabel: meta.label,
        directive: meta.directive,
        promptMain: `${item.kana}（${item.meaning}）`,
        promptSub: item.exampleMeaning ? `힌트: ${item.exampleMeaning}` : "",
        choices,
        correctIndex: choices.indexOf(item.word),
        answerText: `${item.word} [${item.kana}] — ${item.meaning}`,
        explanation: `"${item.meaning}"의 표기는 「${item.word}」(${item.kana})입니다.`,
        item
      };
    }

    const distractors = shuffleArray(others.filter((v) => v.kana && v.kana !== item.kana))
      .slice(0, 3)
      .map((v) => v.kana);
    while (distractors.length < 3) distractors.push(`よみ${distractors.length + 1}`);
    const choices = shuffleArray([item.kana, ...distractors]);

    return {
      id: `q-${typeKey}-${item.id}`,
      typeKey,
      typeLabel: meta.label,
      directive: meta.directive,
      promptMain: item.word,
      promptSub: item.example ? `예문: ${item.example}` : `뜻: ${item.meaning}`,
      choices,
      correctIndex: choices.indexOf(item.kana),
      answerText: `${item.word} [${item.kana}] — ${item.meaning}`,
      explanation: `${item.word}는 「${item.kana}」로 읽으며 뜻은 "${item.meaning}"입니다.`,
      item
    };
  }

  function buildSixTypeQuestions(countsByType = {}, forcedQuestions = null) {
    if (Array.isArray(forcedQuestions) && forcedQuestions.length > 0) {
      return shuffleArray(forcedQuestions.slice());
    }
    const rawVocab = Array.isArray(DATA.VOCAB_DB) ? DATA.VOCAB_DB : [];
    if (!rawVocab.length) return [];

    const generated = [];
    for (const t of SIX_TYPES) {
      const requested = Math.max(0, Number(countsByType[t.key]) || 0);
      if (requested <= 0) continue;

      let pool = rawVocab.slice();
      if (t.key === "kanji_reading" || t.key === "notation") {
        const kanjiOnly = pool.filter((v) => v.kana && hasKanji(v.word));
        if (kanjiOnly.length) pool = kanjiOnly;
      }

      let bag = shuffleArray(pool);
      for (let i = 0; i < requested; i += 1) {
        if (!bag.length) bag = shuffleArray(pool);
        generated.push(makeQuestionByType(t.key, bag.pop(), rawVocab));
      }
    }
    return shuffleArray(generated);
  }

  function readCountsFromInputs(overrideCounts = null) {
    if (overrideCounts && typeof overrideCounts === "object") return { ...overrideCounts };
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

  function startCustomSixTypeQuiz(overrideCounts = null, containerId = "vocab-quiz-runner", forced = null) {
    const runner = document.getElementById(containerId);
    if (!runner) return;

    const counts = readCountsFromInputs(overrideCounts);
    quizSession.sixType.containerId = containerId;
    quizSession.sixType.lastCounts = counts;
    quizSession.sixType.questions = buildSixTypeQuestions(counts, forced);
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
          <h3>퀴즈 완료</h3>
          <p>총 ${total}문항 중 <strong>${quizSession.sixType.score}</strong>개 정답 · 오답 <strong>${wrongCount}</strong>개</p>
          <div style="display:flex;gap:8px;margin-top:12px;">
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
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span class="badge">${escapeHtml(q.typeLabel)} (${quizSession.sixType.index + 1}/${total})</span>
          <span>점수: <strong>${quizSession.sixType.score}</strong></span>
        </div>
        <p style="margin-bottom:8px;">${escapeHtml(q.directive)}</p>
        <div lang="ja" style="font-size:1.2rem;font-weight:700;margin-bottom:6px;">${escapeHtml(q.promptMain)}</div>
        ${q.promptSub ? `<div style="margin-bottom:12px;opacity:0.85;">${escapeHtml(q.promptSub)}</div>` : ""}
        <div id="six-type-choices" style="display:grid;gap:8px;">
          ${q.choices
            .map(
              (c, idx) =>
                `<button type="button" class="btn six-choice-btn" data-six-choice-idx="${idx}" lang="ja">${
                  idx + 1
                }. ${escapeHtml(c)}</button>`
            )
            .join("")}
        </div>
        <div id="six-feedback-box" style="margin-top:12px;padding:10px;border-radius:8px;" hidden></div>
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button type="button" class="btn btn-primary" id="btn-six-next-q" disabled>다음 문제 →</button>
          <button type="button" class="btn" id="btn-exam-close">닫기</button>
        </div>
      </div>
    `;
  }

  function handleSixTypeAnswer(btn) {
    if (quizSession.sixType.answered) return;
    const q = quizSession.sixType.questions[quizSession.sixType.index];
    if (!q) return;

    quizSession.sixType.answered = true;
    const chosen = Number(btn.getAttribute("data-six-choice-idx"));
    const ok = chosen === q.correctIndex;

    document.querySelectorAll("#six-type-choices .six-choice-btn").forEach((b) => {
      b.disabled = true;
    });

    if (ok) {
      quizSession.sixType.score += 1;
    } else {
      quizSession.sixType.wrongQuestions.push(q);
    }

    const fb = document.getElementById("six-feedback-box");
    if (fb) {
      fb.hidden = false;
      fb.innerHTML = `
        <div><strong>${ok ? "✓ 정답" : "✕ 오답"}</strong> — 정답: ${q.correctIndex + 1}번 「${escapeHtml(
        q.choices[q.correctIndex]
      )}」</div>
        <div style="margin-top:4px;">${escapeHtml(q.explanation)}</div>
      `;
    }

    recordResult(q.item, ok, q.typeLabel);
    const nextBtn = document.getElementById("btn-six-next-q");
    if (nextBtn) nextBtn.disabled = false;
  }

  function buildGrammarQuestionsByCounts({ q7Count = 3, q8Count = 2, q9Count = 1 } = {}) {
    const db = getGrammarDbItems();
    const result = [];

    const q7Pool = shuffleArray(db);
    for (let i = 0; i < Math.max(0, Number(q7Count) || 0); i += 1) {
      const item = q7Pool[i % Math.max(1, q7Pool.length)];
      if (!item) break;
      const ans = getDisplayGrammarText(item);
      const dist = shuffleArray(db.filter((g) => g.id !== item.id))
        .slice(0, 3)
        .map(getDisplayGrammarText);
      while (dist.length < 3) dist.push(`〜형${dist.length + 1}`);
      const choices = shuffleArray([ans, ...dist]);
      result.push({
        id: `gq7-${item.id}-${i}`,
        grammarId: item.id,
        type: "q7",
        typeLabel: "問題 7 · 문법형식 판단",
        directive: "次の文の（ ）に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。",
        sentence: item.example
          ? String(item.example).replace(ans.replace(/^〜+/, ""), "（ ）")
          : `${ans} の正しい使い方はどれか。`,
        choices,
        correctIndex: choices.indexOf(ans),
        translation: item.exampleMeaning || item.meaning || "",
        explanation: `${ans} (${item.meaning || ""}) ${item.explanation || ""}`
      });
    }

    const q8Pool = shuffleArray(OFFICIAL_EXAM_BANK.q8);
    for (let i = 0; i < Math.max(0, Number(q8Count) || 0); i += 1) {
      const base = q8Pool[i % q8Pool.length];
      if (base) result.push({ ...base, id: `${base.id}-${i}` });
    }

    const q9Pool = shuffleArray(db);
    for (let i = 0; i < Math.max(0, Number(q9Count) || 0); i += 1) {
      const chunk = q9Pool.slice(i * 2, i * 2 + 2);
      if (!chunk.length) break;
      const blanks = chunk.map((gItem, idx) => {
        const blankNo = 48 + idx;
        const ans = getDisplayGrammarText(gItem);
        const dist = shuffleArray(db.filter((x) => x.id !== gItem.id))
          .slice(0, 3)
          .map(getDisplayGrammarText);
        while (dist.length < 3) dist.push(`〜문형${dist.length + 1}`);
        const choices = shuffleArray([ans, ...dist]);
        return {
          blankNo,
          label: `空欄 [${blankNo}]`,
          choices,
          correctIndex: choices.indexOf(ans),
          explanation: `[${blankNo}] ${ans} (${gItem.meaning || ""})`
        };
      });
      result.push({
        id: `gq9-${i}`,
        grammarId: chunk[0].id,
        type: "q9",
        typeLabel: "問題 9 · 文章の文法",
        directive: "次の文章を読んで、空欄に入る最もよいものを、1・2・3・4から一つ選びなさい。",
        passage: chunk.map((g, idx) => g.example || `[${48 + idx}] 文脈を確認してください。`).join(" "),
        blanks,
        translation: chunk.map((g) => g.exampleMeaning || g.meaning || "").join(" / "),
        explanation: blanks.map((b) => b.explanation).join(" | ")
      });
    }

    return result;
  }

  function renderTypeCountConfigurator(containerId = "grammar-quiz-config") {
    const host = document.getElementById(containerId);
    if (!host) return;
    host.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;padding:12px;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:12px;">
        <label style="display:flex;flex-direction:column;gap:4px;">
          <span>問題 7 개수</span>
          <input type="number" id="gquiz-count-q7" min="0" max="30" value="3" style="width:80px;padding:6px;" />
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;">
          <span>問題 8 개수</span>
          <input type="number" id="gquiz-count-q8" min="0" max="30" value="2" style="width:80px;padding:6px;" />
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;">
          <span>問題 9 지문 수</span>
          <input type="number" id="gquiz-count-q9" min="0" max="15" value="1" style="width:80px;padding:6px;" />
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

    const resolved = counts || {
      q7Count: document.getElementById("gquiz-count-q7")?.value ?? 3,
      q8Count: document.getElementById("gquiz-count-q8")?.value ?? 2,
      q9Count: document.getElementById("gquiz-count-q9")?.value ?? 1
    };

    const questions =
      Array.isArray(forced) && forced.length
        ? shuffleArray(forced.slice())
        : buildGrammarQuestionsByCounts(resolved);

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
          <div style="display:flex;gap:8px;margin-top:12px;">
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
    quizSession.grammarCustom.q9Answers = {};

    if (q.type === "q9") {
      runner.innerHTML = `
        <div class="card">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span class="badge">${escapeHtml(q.typeLabel)} (${
        quizSession.grammarCustom.index + 1
      }/${total})</span>
            <span>점수: <strong>${quizSession.grammarCustom.score}</strong></span>
          </div>
          <p>${escapeHtml(q.directive)}</p>
          <div lang="ja" style="padding:10px;margin:10px 0;border-radius:8px;background:rgba(128,128,128,0.08);">${escapeHtml(
            q.passage
          )}</div>
          ${q.blanks
            .map(
              (b) => `
            <div style="margin-bottom:10px;">
              <div style="font-weight:600;margin-bottom:4px;">${escapeHtml(b.label)}</div>
              <div style="display:flex;flex-wrap:wrap;gap:6px;">
                ${b.choices
                  .map(
                    (c, idx) =>
                      `<button type="button" class="btn gquiz-q9-choice" data-blank-no="${
                        b.blankNo
                      }" data-c-idx="${idx}" lang="ja">${idx + 1}. ${escapeHtml(c)}</button>`
                  )
                  .join("")}
              </div>
            </div>
          `
            )
            .join("")}
          <div id="gquiz-feedback" style="margin-top:10px;" hidden></div>
          <div style="display:flex;gap:8px;margin-top:12px;">
            <button type="button" class="btn btn-primary" id="btn-gquiz-q9-check">빈칸 전체 채점</button>
            <button type="button" class="btn btn-primary" id="btn-gquiz-next" disabled>다음 문항 →</button>
            <button type="button" class="btn" id="btn-gquiz-close">닫기</button>
          </div>
        </div>
      `;
      return;
    }

    if (q.type === "q8") {
      runner.innerHTML = `
        <div class="card">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span class="badge">${escapeHtml(q.typeLabel)} (${
        quizSession.grammarCustom.index + 1
      }/${total})</span>
            <span>점수: <strong>${quizSession.grammarCustom.score}</strong></span>
          </div>
          <p>${escapeHtml(q.directive)}</p>
          <div lang="ja" style="font-size:1.1rem;font-weight:600;margin:10px 0;">${escapeHtml(
            q.prefix || ""
          )} [ ★ ] ${escapeHtml(q.suffix || "")}</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
            ${q.fragments
              .map(
                (frag, idx) =>
                  `<button type="button" class="btn gquiz-star-btn" data-star-num="${
                    idx + 1
                  }" lang="ja">${idx + 1}. ${escapeHtml(frag)}</button>`
              )
              .join("")}
          </div>
          <div id="gquiz-feedback" style="margin-top:10px;" hidden></div>
          <div style="display:flex;gap:8px;margin-top:12px;">
            <button type="button" class="btn btn-primary" id="btn-gquiz-next" disabled>다음 문항 →</button>
            <button type="button" class="btn" id="btn-gquiz-close">닫기</button>
          </div>
        </div>
      `;
      return;
    }

    runner.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span class="badge">${escapeHtml(q.typeLabel)} (${
      quizSession.grammarCustom.index + 1
    }/${total})</span>
          <span>점수: <strong>${quizSession.grammarCustom.score}</strong></span>
        </div>
        <p>${escapeHtml(q.directive)}</p>
        <div lang="ja" style="font-size:1.15rem;font-weight:600;margin:10px 0;">${escapeHtml(
          q.sentence
        )}</div>
        <div style="display:grid;gap:8px;">
          ${q.choices
            .map(
              (c, idx) =>
                `<button type="button" class="btn gquiz-q7-btn" data-q7-idx="${idx}" lang="ja">${
                  idx + 1
                }. ${escapeHtml(c)}</button>`
            )
            .join("")}
        </div>
        <div id="gquiz-feedback" style="margin-top:10px;" hidden></div>
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button type="button" class="btn btn-primary" id="btn-gquiz-next" disabled>다음 문항 →</button>
          <button type="button" class="btn" id="btn-gquiz-close">닫기</button>
        </div>
      </div>
    `;
  }

  function finishGrammarItem(q, ok, summaryHtml) {
    quizSession.grammarCustom.answered = true;
    if (ok) {
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
        <div><strong>${ok ? "✓ 정답" : "✕ 오답"}</strong> — ${summaryHtml}</div>
        ${q.explanation ? `<div style="margin-top:4px;">${escapeHtml(q.explanation)}</div>` : ""}
      `;
    }

    recordResult(q, ok, q.typeLabel || "문법 퀴즈");
    const nextBtn = document.getElementById("btn-gquiz-next");
    if (nextBtn) nextBtn.disabled = false;
  }

  function startConfiguredQuiz() {
    const counts = readCountsFromInputs();
    if (hasAnySixTypeCount(counts)) {
      startCustomSixTypeQuiz(counts, "vocab-quiz-runner");
      return;
    }
    const n = Math.max(1, Number(document.getElementById("vocab-quiz-count")?.value) || 10);
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
  }

  let bound = false;
  function bindEvents() {
    if (bound) return;
    bound = true;

    document
      .getElementById("btn-start-six-type-quiz")
      ?.addEventListener("click", () => startCustomSixTypeQuiz(null, "vocab-quiz-runner"));

    document
      .getElementById("btn-start-vocab-quiz")
      ?.addEventListener("click", () => startConfiguredQuiz());

    document.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      if (target.id === "btn-run-grammar-quiz-10") {
        startGrammarCustomQuiz({ q7Count: 5, q8Count: 3, q9Count: 2 }, "grammar-quiz-runner");
        return;
      }

      if (target.id === "btn-run-grammar-quiz-all") {
        startGrammarCustomQuiz({ q7Count: 8, q8Count: 4, q9Count: 3 }, "grammar-quiz-runner");
        return;
      }

      if (target.id === "btn-start-custom-grammar-quiz") {
        startGrammarCustomQuiz();
        return;
      }

      if (target.id === "btn-exam-close" || target.id === "btn-quiz-back-setup") {
        const vr = document.getElementById("vocab-quiz-runner");
        if (vr) {
          vr.hidden = true;
          vr.innerHTML = "";
        }
        return;
      }

      if (target.id === "btn-gquiz-close" || target.id === "btn-gquiz-clear") {
        const gr = document.getElementById("grammar-quiz-runner");
        if (gr) {
          gr.hidden = true;
          gr.innerHTML = "";
        }
        return;
      }

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

      if (target.id === "btn-six-retry-wrong" && quizSession.sixType.wrongQuestions.length) {
        startCustomSixTypeQuiz(
          quizSession.sixType.lastCounts,
          quizSession.sixType.containerId,
          quizSession.sixType.wrongQuestions.slice()
        );
        return;
      }

      const gq7Btn = target.closest(".gquiz-q7-btn");
      if (gq7Btn && !quizSession.grammarCustom.answered) {
        const q = quizSession.grammarCustom.questions[quizSession.grammarCustom.index];
        const picked = Number(gq7Btn.getAttribute("data-q7-idx"));
        document.querySelectorAll(".gquiz-q7-btn").forEach((b) => (b.disabled = true));
        finishGrammarItem(
          q,
          picked === q.correctIndex,
          `정답: ${q.correctIndex + 1}번 「${escapeHtml(q.choices[q.correctIndex])}」`
        );
        return;
      }

      const gStarBtn = target.closest(".gquiz-star-btn");
      if (gStarBtn && !quizSession.grammarCustom.answered) {
        const q = quizSession.grammarCustom.questions[quizSession.grammarCustom.index];
        const chosen = Number(gStarBtn.getAttribute("data-star-num"));
        document.querySelectorAll(".gquiz-star-btn").forEach((b) => (b.disabled = true));
        finishGrammarItem(
          q,
          chosen === Number(q.correctChoice),
          `정답: ${q.correctChoice}번 「${escapeHtml(q.fragments[q.correctChoice - 1])}」`
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
        const done = q.blanks.every((b) => quizSession.grammarCustom.q9Answers[b.blankNo] != null);
        if (!done) return;
        const allOk = q.blanks.every(
          (b) => Number(quizSession.grammarCustom.q9Answers[b.blankNo]) === Number(b.correctIndex)
        );
        document.querySelectorAll(".gquiz-q9-choice").forEach((b) => (b.disabled = true));
        target.setAttribute("disabled", "true");
        finishGrammarItem(
          q,
          allOk,
          q.blanks
            .map((b) => `[${b.blankNo}] ${b.correctIndex + 1}번(${escapeHtml(b.choices[b.correctIndex])})`)
            .join(", ")
        );
        return;
      }

      if (target.id === "btn-gquiz-next") {
        quizSession.grammarCustom.index += 1;
        renderCurrentGrammarQuestion();
        return;
      }

      if (target.id === "btn-gquiz-retry-wrong" && quizSession.grammarCustom.wrongQuestions.length) {
        startGrammarCustomQuiz(
          null,
          quizSession.grammarCustom.containerId,
          quizSession.grammarCustom.wrongQuestions.slice()
        );
      }
    });
  }

  function init() {
    renderTypeCountConfigurator();
    bindEvents();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.JLPTQuiz = {
    ...(window.JLPTQuiz || {}),
    onEnterQuizTab: () => renderTypeCountConfigurator(),
    startConfiguredQuiz,
    startCustomSixTypeQuiz,
    startGrammarQuiz: (count = 10, containerId = "grammar-quiz-runner") =>
      startGrammarCustomQuiz(
        { q7Count: Math.ceil(count / 2), q8Count: Math.floor(count / 2), q9Count: 1 },
        containerId
      ),
    startGrammarCustomQuiz,
    buildGrammarQuestionsByCounts,
    SIX_TYPES,
    OFFICIAL_EXAM_BANK
  };
})();
