(() => {
  "use strict";

  const DATA = window.JLPTData;
  if (!DATA) {
    console.error("window.JLPTData가 로드되지 않았습니다. data.js 로드 순서를 확인하세요.");
    return;
  }

  const quizSession = {
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
      tileSequence: [], // { char: string, tileIndex: number }[]
      tiles: [] // { char: string, used: boolean }[]
    },
    grammar: {
      questions: [],
      index: 0,
      score: 0,
      answered: false,
      wrongIds: [],
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

  function getItemStatus(itemId, state) {
    const rec = state?.progress?.[String(itemId)];
    if (!rec) return "미학습";
    return typeof DATA.normalizeStatus === "function"
      ? DATA.normalizeStatus(rec.status)
      : rec.status || "미학습";
  }

  function notifyViewsUpdated() {
    document.dispatchEvent(new CustomEvent("jlpt:state-updated"));
    if (typeof window.JLPTStudy?.refreshAllViews === "function") {
      window.JLPTStudy.refreshAllViews();
    }
  }

  // =========================================================
  // 도메인 & 범위 필터링 / SRS & 오답 기록
  // =========================================================
  function getDomainPool(domain = "vocab") {
    const vocabList = (DATA.VOCAB_DB || []).map((v) => ({ ...v, _domain: "vocab" }));
    const grammarList = (DATA.GRAMMAR_DB || []).map((g) => ({ ...g, _domain: "grammar" }));

    if (domain === "grammar") return grammarList;
    if (domain === "all") return [...vocabList, ...grammarList];
    return vocabList;
  }

  function filterItemsByScope(pool, scopeValue, state) {
    if (!scopeValue || scopeValue === "ALL") return pool.slice();
    if (scopeValue === "DUE" && typeof DATA.isDueForReview === "function") {
      return pool.filter((item) => DATA.isDueForReview(item.id, state));
    }
    if (scopeValue === "FAVORITE") {
      const favSet = new Set((state.favorites || []).map(String));
      return pool.filter((item) => favSet.has(String(item.id)));
    }
    if (["미학습", "모름", "애매함", "완벽함", "외움", "헷갈림", "미암기"].includes(scopeValue)) {
      const targetNorm =
        typeof DATA.normalizeStatus === "function"
          ? DATA.normalizeStatus(scopeValue)
          : scopeValue;
      return pool.filter((item) => getItemStatus(item.id, state) === targetNorm);
    }
    if (scopeValue.startsWith("DECK:")) {
      const deckId = scopeValue.slice("DECK:".length);
      const deck = (state.customDecks || []).find((d) => String(d.id) === String(deckId));
      const idSet = new Set((deck?.wordIds || []).map(String));
      return pool.filter((item) => idSet.has(String(item.id)));
    }
    return pool.slice();
  }

  function selectQuestionPool(domain, scopeValue, countValue, shouldShuffle = true, forcedIds = null) {
    const state = DATA.loadState();
    let candidates = [];

    if (Array.isArray(forcedIds) && forcedIds.length > 0) {
      const idSet = new Set(forcedIds.map(String));
      const combined = getDomainPool("all");
      candidates = combined.filter((item) => idSet.has(String(item.id)));
    } else {
      const basePool = getDomainPool(domain);
      candidates = filterItemsByScope(basePool, scopeValue, state);
      if (!candidates.length) {
        candidates = basePool.length ? basePool.slice() : getDomainPool("all");
      }
    }

    const ordered = shouldShuffle ? shuffleArray(candidates) : candidates.slice();
    if (countValue === "ALL") return ordered;
    const limit = Math.max(1, Number(countValue) || 10);
    return ordered.slice(0, limit);
  }

  function recordQuizResult(item, isCorrect, modeName) {
    const idStr = String(item.id);
    const state = DATA.loadState();
    state.progress = state.progress || {};
    state.wrongStats = state.wrongStats || {};

    const prevProg = state.progress[idStr] || null;
    const itemType = item._domain === "grammar" || item.type === "grammar" ? "grammar" : "vocab";

    if (isCorrect) {
      state.progress[idStr] = {
        type: itemType,
        ...DATA.calculateNextSrs(prevProg, "완벽함")
      };
    } else {
      state.progress[idStr] = {
        type: itemType,
        ...DATA.calculateNextSrs(prevProg, "모름")
      };
      const prevWrong = state.wrongStats[idStr] || { count: 0 };
      state.wrongStats[idStr] = {
        count: (Number(prevWrong.count) || 0) + 1,
        lastWrongAt: new Date().toISOString(),
        lastMode: modeName
      };
    }

    DATA.saveState(state);
    notifyViewsUpdated();
  }

  // =========================================================
  // 4지선다 퀴즈 (문자·어휘 / 핵심 문법 / 통합)
  // =========================================================
  function buildMcqQuestion(targetItem) {
    if (targetItem._domain === "grammar" || targetItem.type === "grammar") {
      const gPool = (DATA.GRAMMAR_DB || []).filter((g) => String(g.id) !== String(targetItem.id));
      const fallbackPool = gPool.length >= 3 ? gPool : DATA.VOCAB_DB || [];
      const distractors = shuffleArray(fallbackPool).slice(0, 3);
      const options = shuffleArray([targetItem, ...distractors]).map((g) => ({
        label: g.meaning ? `${g.word} (${g.meaning})` : g.word,
        isCorrect: String(g.id) === String(targetItem.id)
      }));

      const blankedExample = targetItem.example
        ? String(targetItem.example).replace(targetItem.word, "＿＿＿")
        : `접속: ${targetItem.connection || "문법"}`;

      return {
        item: targetItem,
        typeLabel: "문법 패턴 퀴즈",
        promptMain: blankedExample,
        promptSub: targetItem.exampleMeaning || `접속: ${targetItem.connection || ""}`,
        correctValue: `${targetItem.word} — ${targetItem.meaning}`,
        options
      };
    }

    const vPool = (DATA.VOCAB_DB || []).filter((v) => String(v.id) !== String(targetItem.id));
    const distractors = shuffleArray(vPool).slice(0, 3);
    const options = shuffleArray([targetItem, ...distractors]).map((v) => ({
      label: v.meaning,
      isCorrect: String(v.id) === String(targetItem.id)
    }));

    return {
      item: targetItem,
      typeLabel: "어휘 뜻 맞히기",
      promptMain: targetItem.word,
      promptSub: targetItem.kana ? `읽기: ${targetItem.kana}` : "",
      correctValue: `${targetItem.word} [${targetItem.kana}] — ${targetItem.meaning}`,
      options
    };
  }

  function normalizeMcqOptions(qObj) {
    if (Array.isArray(qObj.options) && qObj.options.length) return qObj.options;
    const target = qObj.item;
    const gPool = (DATA.GRAMMAR_DB || []).filter((g) => String(g.id) !== String(target.id));
    const distractors = shuffleArray(gPool).slice(0, 3);
    return shuffleArray([target, ...distractors]).map((g) => ({
      label: g.meaning ? `${g.word} (${g.meaning})` : g.word,
      isCorrect: String(g.id) === String(target.id)
    }));
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

    const pool = selectQuestionPool(domain, scope, countVal, true, forcedIds);
    quizSession.mcq.questions = pool.map((item) => {
      const built = buildMcqQuestion(item);
      return {
        ...built,
        options: normalizeMcqOptions(built)
      };
    });
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
      const hasWrong = quizSession.mcq.wrongIds.length > 0;
      runner.innerHTML = `
        <div class="card-header"><span>4지선다 퀴즈 결과</span></div>
        <p class="helper-text">
          총 ${total}문항 중 <strong>${quizSession.mcq.score}</strong>문항 정답 · 오답 <strong>${quizSession.mcq.wrongIds.length}</strong>개
        </p>
        <div class="quick-action-row">
          <button type="button" class="btn btn-primary" id="btn-mcq-retry-wrong" ${
            hasWrong ? "" : "disabled"
          }>틀린 문제만 다시 풀기</button>
          <button type="button" class="btn" id="btn-quiz-back-setup">퀴즈 닫기</button>
        </div>
      `;
      return;
    }

    quizSession.mcq.answered = false;
    const isKanaOnlyWord =
      q.item._domain === "vocab" &&
      typeof DATA.isHiraganaOnly === "function" &&
      DATA.isHiraganaOnly(q.item.word) &&
      q.promptMain === q.item.word;
    const isKanaSub = Boolean(q.promptSub && q.promptSub.startsWith("읽기:"));

    runner.innerHTML = `
      <div class="card-header">
        <span>${escapeHtml(q.typeLabel)} (${quizSession.mcq.index + 1} / ${total})</span>
        <span class="badge">점수: ${quizSession.mcq.score}</span>
      </div>
      <div class="quiz-question-box">
        <div class="quiz-prompt-main ${isKanaOnlyWord ? "is-kana-only-headword" : ""}" lang="ja">${escapeHtml(
      q.promptMain
    )}</div>
        ${
          q.promptSub
            ? `<div class="quiz-prompt-sub ${
                isKanaSub ? "maskable-kana" : "maskable-meaning"
              }" id="mcq-sub-reveal" lang="ja">${escapeHtml(q.promptSub)}</div>`
            : ""
        }
      </div>
      <div class="quiz-choices-list" id="mcq-choices-list">
        ${q.options
          .map(
            (opt, idx) => `
          <button type="button" class="btn quiz-choice-btn" data-mcq-choice-idx="${idx}" data-correct="${
              opt.isCorrect
            }" lang="ja">
            ${idx + 1}. ${escapeHtml(opt.label)}
          </button>
        `
          )
          .join("")}
      </div>
      <div class="quiz-feedback-box" id="mcq-feedback-box" hidden></div>
      <div class="quick-action-row" style="margin-top: 14px;">
        <button type="button" class="btn btn-primary" id="btn-mcq-next-q" disabled>다음 문제 →</button>
        <button type="button" class="btn" id="btn-quiz-back-setup">퀴즈 닫기</button>
      </div>
    `;
  }

  function handleMcqAnswer(btnEl) {
    if (quizSession.mcq.answered) return;
    const q = quizSession.mcq.questions[quizSession.mcq.index];
    if (!q) return;

    quizSession.mcq.answered = true;
    const isCorrect = btnEl.getAttribute("data-correct") === "true";

    document.querySelectorAll("#mcq-choices-list .quiz-choice-btn").forEach((b) => {
      b.disabled = true;
      if (b.getAttribute("data-correct") === "true") {
        b.classList.add("btn-secondary");
      } else if (b === btnEl && !isCorrect) {
        b.classList.add("btn-danger");
      }
    });

    const subReveal = document.getElementById("mcq-sub-reveal");
    if (subReveal) subReveal.classList.add("is-revealed");

    const feedback = document.getElementById("mcq-feedback-box");
    if (feedback) {
      feedback.hidden = false;
      if (isCorrect) {
        quizSession.mcq.score += 1;
        feedback.innerHTML = `<strong class="feedback-ok">정답!</strong> ${escapeHtml(q.correctValue)}`;
      } else {
        quizSession.mcq.wrongIds.push(q.item.id);
        feedback.innerHTML = `<strong class="feedback-err">오답</strong> — 정답: ${escapeHtml(
          q.correctValue
        )}`;
      }
    }

    recordQuizResult(q.item, isCorrect, "4지선다 퀴즈");
    const nextBtn = document.getElementById("btn-mcq-next-q");
    if (nextBtn) nextBtn.disabled = false;
  }

  // =========================================================
  // 문법 전용 퀴즈 실행기 (#grammar-quiz-runner)
  // =========================================================
  function startGrammarQuiz(countValue = 10, containerId = "grammar-quiz-runner") {
    quizSession.grammar.containerId = containerId;
    const pool = selectQuestionPool("grammar", "ALL", countValue, true, null);
    quizSession.grammar.questions = pool.map((g) => {
      const built = buildMcqQuestion(g);
      return { ...built, options: normalizeMcqOptions(built) };
    });
    quizSession.grammar.index = 0;
    quizSession.grammar.score = 0;
    quizSession.grammar.answered = false;
    quizSession.grammar.wrongIds = [];
    renderGrammarQuiz();
  }

  function renderGrammarQuiz() {
    const runner = document.getElementById(quizSession.grammar.containerId || "grammar-quiz-runner");
    if (!runner) return;

    const q = quizSession.grammar.questions[quizSession.grammar.index];
    const total = quizSession.grammar.questions.length;

    if (!total) {
      runner.innerHTML = '<p class="helper-text">출제할 문법 데이터가 없습니다. data-grammar.js를 확인하세요.</p>';
      return;
    }

    if (!q) {
      runner.innerHTML = `
        <div class="card">
          <p class="helper-text">
            문법 퀴즈 완료: 총 ${total}문항 중 <strong>${quizSession.grammar.score}</strong>문항 정답 (오답 ${
        quizSession.grammar.wrongIds.length
      }개)
          </p>
          <div class="quick-action-row">
            <button type="button" class="btn btn-primary" id="btn-gquiz-retry-wrong" ${
              quizSession.grammar.wrongIds.length ? "" : "disabled"
            }>틀린 문법 다시 풀기</button>
            <button type="button" class="btn" id="btn-gquiz-clear">닫기</button>
          </div>
        </div>
      `;
      return;
    }

    quizSession.grammar.answered = false;
    runner.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span>문법 퀴즈 (${quizSession.grammar.index + 1} / ${total})</span>
          <span class="badge">점수: ${quizSession.grammar.score}</span>
        </div>
        <div class="quiz-question-box">
          <div class="quiz-prompt-main" lang="ja">${escapeHtml(q.promptMain)}</div>
          ${q.promptSub ? `<div class="quiz-prompt-sub">${escapeHtml(q.promptSub)}</div>` : ""}
        </div>
        <div class="quiz-choices-list" id="gquiz-choices-list">
          ${q.options
            .map(
              (opt, idx) => `
            <button type="button" class="btn quiz-choice-btn" data-gquiz-idx="${idx}" data-correct="${
                opt.isCorrect
              }" lang="ja">
              ${idx + 1}. ${escapeHtml(opt.label)}
            </button>
          `
            )
            .join("")}
        </div>
        <div class="quiz-feedback-box" id="gquiz-feedback-box" hidden></div>
        <div class="quick-action-row" style="margin-top: 12px;">
          <button type="button" class="btn btn-primary" id="btn-gquiz-next" disabled>다음 문법 →</button>
          <button type="button" class="btn" id="btn-gquiz-clear">닫기</button>
        </div>
      </div>
    `;
  }

  // =========================================================
  // 주관식 히라가나 테스트 (직접 입력 / 타일 선택 / 히라가나 전용 예외)
  // =========================================================
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
    return shuffleArray([...targetChars, ...extras]).map((char) => ({
      char,
      used: false
    }));
  }

  function startSubjectiveQuiz(forcedIds = null, overrideOptions = null) {
    const runner = document.getElementById("vocab-quiz-runner");
    if (!runner) return;

    const domain =
      overrideOptions?.domain || document.getElementById("vocab-quiz-domain")?.value || "vocab";
    const scope =
      overrideOptions?.scope || document.getElementById("vocab-quiz-scope")?.value || "ALL";
    const countVal =
      overrideOptions?.count || document.getElementById("vocab-quiz-count")?.value || "10";

    const rawPool = selectQuestionPool(domain, scope, "ALL", true, forcedIds).filter((item) => {
      const targetReading =
        typeof DATA.isHiraganaOnly === "function" && DATA.isHiraganaOnly(item.word)
          ? item.word
          : item.kana;
      return Boolean(targetReading && String(targetReading).trim());
    });

    const picked =
      countVal === "ALL" ? rawPool : rawPool.slice(0, Math.max(1, Number(countVal) || 10));

    quizSession.input.questions = picked.map((item) => {
      const hiraganaOnly =
        typeof DATA.isHiraganaOnly === "function" ? DATA.isHiraganaOnly(item.word) : false;
      const expectedAnswer = hiraganaOnly
        ? String(item.word).trim()
        : String(item.kana || "").trim();
      return {
        item,
        hiraganaOnly,
        expectedAnswer
      };
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
      const hasWrong = quizSession.input.wrongIds.length > 0;
      runner.innerHTML = `
        <div class="card-header"><span>주관식 히라가나 테스트 결과</span></div>
        <p class="helper-text">
          총 ${total}문항 중 <strong>${quizSession.input.score}</strong>문항 정답 · 오답 <strong>${quizSession.input.wrongIds.length}</strong>개
        </p>
        <div class="quick-action-row">
          <button type="button" class="btn btn-primary" id="btn-subj-retry-wrong" ${
            hasWrong ? "" : "disabled"
          }>틀린 문제만 다시 풀기</button>
          <button type="button" class="btn" id="btn-quiz-back-setup">퀴즈 닫기</button>
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

    // 히라가나 전용 단어 예외 규칙: 표기 대신 한글 뜻을 제시하고 히라가나 입력/타일 선택
    const promptText = q.hiraganaOnly ? q.item.meaning : q.item.word;
    const subText = q.hiraganaOnly ? "(히라가나 전용 단어)" : `뜻: ${q.item.meaning}`;
    const firstChar = [...q.expectedAnswer][0] || "";

    runner.innerHTML = `
      <div class="card-header">
        <span>주관식 히라가나 (${quizSession.input.index + 1} / ${total})</span>
        <span class="badge">점수: ${quizSession.input.score}</span>
      </div>
      <div class="quiz-question-box">
        <div class="quiz-prompt-main" ${q.hiraganaOnly ? "" : 'lang="ja"'}>${escapeHtml(promptText)}</div>
        ${hideMeaning ? "" : `<div class="quiz-prompt-sub">${escapeHtml(subText)}</div>`}
        ${
          showFirstHint && firstChar
            ? `<div class="quiz-hint-text">첫글자 힌트: <strong lang="ja">${escapeHtml(
                firstChar
              )}</strong> (총 ${[...q.expectedAnswer].length}자)</div>`
            : ""
        }
      </div>

      ${
        inputMode === "tiles"
          ? `
        <div class="tile-answer-box">
          <div class="tile-selected-view" id="tile-selected-display" lang="ja">타일을 순서대로 선택하세요</div>
          <div class="tile-grid" id="kana-tile-grid">
            ${quizSession.input.tiles
              .map(
                (t, i) => `
              <button type="button" class="kana-tile-btn ${t.used ? "is-used" : ""}" data-tile-index="${i}" ${
                  t.used ? "disabled" : ""
                } lang="ja">${escapeHtml(t.char)}</button>
            `
              )
              .join("")}
          </div>
          <div class="quick-action-row" style="margin-top: 8px;">
            <button type="button" class="chip-btn" id="btn-tile-backspace">한 글자 지우기</button>
            <button type="button" class="chip-btn" id="btn-tile-clear">초기화</button>
          </div>
        </div>
      `
          : `
        <div class="direct-input-box">
          <input
            type="text"
            id="kana-direct-input"
            class="search-input"
            lang="ja"
            placeholder="히라가나를 입력하세요..."
            autocomplete="off"
          />
        </div>
      `
      }

      <div class="quiz-feedback-box" id="input-quiz-feedback" hidden></div>
      <div class="quick-action-row" style="margin-top: 14px;">
        <button type="button" class="btn btn-primary" id="btn-input-quiz-submit">정답 확인</button>
        <button type="button" class="btn btn-secondary" id="btn-input-quiz-next" disabled>다음 문항 →</button>
        <button type="button" class="btn" id="btn-quiz-back-setup">퀴즈 닫기</button>
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
        <button
          type="button"
          class="kana-tile-btn ${tile.used ? "is-used" : ""}"
          data-tile-index="${idx}"
          ${tile.used || quizSession.input.answered ? "disabled" : ""}
          lang="ja"
        >
          ${escapeHtml(tile.char)}
        </button>
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
      inputMode === "tile"
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
        feedbackEl.className = "quiz-feedback correct";
        feedbackEl.innerHTML = `<strong class="feedback-ok">정답!</strong> ${escapeHtml(
          q.item.word
        )} [${escapeHtml(q.expectedAnswer)}] — ${escapeHtml(q.item.meaning)}`;
      }
    } else {
      quizSession.input.wrongIds.push(q.item.id);
      if (feedbackEl) {
        feedbackEl.hidden = false;
        feedbackEl.className = "quiz-feedback wrong";
        feedbackEl.innerHTML = `<strong class="feedback-err">오답</strong> — 입력: <span lang="ja">${escapeHtml(
          userAnswer
        )}</span> / 정답: <strong lang="ja">${escapeHtml(q.expectedAnswer)}</strong> (${escapeHtml(
          q.item.meaning
        )})`;
      }
    }

    const directInput = document.getElementById("kana-direct-input");
    if (directInput) directInput.disabled = true;
    renderKanaTiles();

    recordQuizResult(q.item, isCorrect, "주관식 히라가나");
    document.getElementById("btn-input-quiz-submit")?.setAttribute("disabled", "true");
    const nextBtn = document.getElementById("btn-input-quiz-next");
    if (nextBtn) nextBtn.disabled = false;
  }

  // =========================================================
  // 이벤트 바인딩 & 공개 인터페이스
  // =========================================================
  function startConfiguredQuiz(forcedIds = null) {
    const mode = document.getElementById("vocab-quiz-mode")?.value || "mcq";
    if (mode === "subjective") {
      startSubjectiveQuiz(forcedIds);
    } else {
      startMcqQuiz(forcedIds);
    }
  }

  function bindQuizEvents() {
    document.getElementById("vocab-quiz-mode")?.addEventListener("change", (e) => {
      const subOpts = document.getElementById("subjective-extra-options");
      if (subOpts) subOpts.hidden = e.target.value !== "subjective";
    });

    document.getElementById("btn-start-vocab-quiz")?.addEventListener("click", () => {
      startConfiguredQuiz(null);
    });

    document.getElementById("btn-retry-wrong-vocab")?.addEventListener("click", () => {
      const state = DATA.loadState();
      const wrongIds = Object.entries(state.wrongStats || {})
        .filter(([, s]) => s && Number(s.count) > 0)
        .map(([id]) => id);
      if (!wrongIds.length) return;
      window.JLPTStudy?.switchMainTab("vocab-section", { vocabSubTab: "vocab-quiz" });
      startConfiguredQuiz(wrongIds);
    });

    document.getElementById("vocab-quiz-runner")?.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      const subReveal = target.closest("#mcq-sub-reveal");
      if (subReveal) {
        subReveal.classList.toggle("is-revealed");
        return;
      }

      const choiceBtn = target.closest("[data-mcq-choice-idx]");
      if (choiceBtn) {
        handleMcqAnswer(choiceBtn);
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
        return;
      }

      if (target.id === "btn-quiz-back-setup") {
        const runner = document.getElementById("vocab-quiz-runner");
        if (runner) {
          runner.hidden = true;
          runner.innerHTML = "";
        }
      }
    });

    document.getElementById("vocab-quiz-runner")?.addEventListener("keydown", (e) => {
      if (
        e.target instanceof HTMLInputElement &&
        e.target.id === "kana-direct-input" &&
        e.key === "Enter"
      ) {
        e.preventDefault();
        submitInputAnswer();
      }
    });

    // 문법 퀴즈 러너 이벤트 위임
    document.getElementById("grammar-quiz-runner")?.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      const choiceBtn = target.closest("[data-gquiz-idx]");
      if (choiceBtn && !quizSession.grammar.answered) {
        const q = quizSession.grammar.questions[quizSession.grammar.index];
        if (!q) return;
        quizSession.grammar.answered = true;
        const isCorrect = choiceBtn.getAttribute("data-correct") === "true";

        document.querySelectorAll("#gquiz-choices-list .quiz-choice-btn").forEach((b) => {
          b.disabled = true;
          if (b.getAttribute("data-correct") === "true") b.classList.add("btn-secondary");
          else if (b === choiceBtn && !isCorrect) b.classList.add("btn-danger");
        });

        const fb = document.getElementById("gquiz-feedback-box");
        if (fb) {
          fb.hidden = false;
          if (isCorrect) {
            quizSession.grammar.score += 1;
            fb.innerHTML = `<strong class="feedback-ok">정답!</strong> ${escapeHtml(q.correctValue)}`;
          } else {
            quizSession.grammar.wrongIds.push(q.item.id);
            fb.innerHTML = `<strong class="feedback-err">오답</strong> — 정답: ${escapeHtml(
              q.correctValue
            )}`;
          }
        }

        recordQuizResult(q.item, isCorrect, "문법 퀴즈");
        const nextBtn = document.getElementById("btn-gquiz-next");
        if (nextBtn) nextBtn.disabled = false;
        return;
      }

      if (target.id === "btn-gquiz-next") {
        quizSession.grammar.index += 1;
        renderGrammarQuiz();
        return;
      }

      if (target.id === "btn-gquiz-retry-wrong") {
        if (quizSession.grammar.wrongIds.length) {
          const pool = selectQuestionPool("grammar", "ALL", "ALL", true, quizSession.grammar.wrongIds);
          quizSession.grammar.questions = pool.map((g) => {
            const built = buildMcqQuestion(g);
            return { ...built, options: normalizeMcqOptions(built) };
          });
          quizSession.grammar.index = 0;
          quizSession.grammar.score = 0;
          quizSession.grammar.answered = false;
          quizSession.grammar.wrongIds = [];
          renderGrammarQuiz();
        }
        return;
      }

      if (target.id === "btn-gquiz-clear") {
        const runner = document.getElementById(quizSession.grammar.containerId || "grammar-quiz-runner");
        if (runner) runner.innerHTML = "";
      }
    });
  }

  function onEnterQuizTab() {
    const mode = document.getElementById("vocab-quiz-mode")?.value || "mcq";
    const subOpts = document.getElementById("subjective-extra-options");
    if (subOpts) subOpts.hidden = mode !== "subjective";
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
    startGrammarQuiz
  };
})();
