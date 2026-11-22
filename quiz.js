(() => {
  "use strict";

  const {
    VOCAB_DB,
    isHiraganaOnly,
    isDueForReview,
    calculateNextSrs,
    loadState,
    saveState
  } = window.JLPTData;

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

  function getWordStatus(wordId, state) {
    const rec = state?.progress?.[wordId];
    if (rec && ["외움", "헷갈림", "미암기"].includes(rec.status)) {
      return rec.status;
    }
    return "미암기";
  }

  // =========================================================
  // 범위 필터링 & 오답 기록/SRS 동기화
  // =========================================================
  function populateQuizScopeSelects() {
    const state = loadState();
    const selects = document.querySelectorAll("[data-quiz-scope]");
    const deckOptions = (state.customDecks || [])
      .map((d) => `<option value="DECK:${escapeHtml(d.id)}">단어장: ${escapeHtml(d.name)} (${d.wordIds.length})</option>`)
      .join("");

    const html = `
      <option value="ALL">전체 어휘</option>
      <option value="DUE">오늘 복습 대상</option>
      <option value="FAVORITE">즐겨찾기</option>
      <option value="STATUS:미암기">암기 상태: 미암기</option>
      <option value="STATUS:헷갈림">암기 상태: 헷갈림</option>
      <option value="STATUS:외움">암기 상태: 외움</option>
      ${deckOptions}
    `;

    selects.forEach((sel) => {
      const prev = sel.value;
      sel.innerHTML = html;
      if (prev && [...sel.options].some((opt) => opt.value === prev)) {
        sel.value = prev;
      }
    });
  }

  function filterWordsByScope(scopeValue, state) {
    let pool = VOCAB_DB.slice();
    if (!scopeValue || scopeValue === "ALL") {
      return pool;
    }
    if (scopeValue === "DUE") {
      return pool.filter((w) => isDueForReview(w.id, state));
    }
    if (scopeValue === "FAVORITE") {
      const favSet = new Set(state.favorites || []);
      return pool.filter((w) => favSet.has(w.id));
    }
    if (scopeValue.startsWith("STATUS:")) {
      const targetStatus = scopeValue.slice("STATUS:".length);
      return pool.filter((w) => getWordStatus(w.id, state) === targetStatus);
    }
    if (scopeValue.startsWith("DECK:")) {
      const deckId = scopeValue.slice("DECK:".length);
      const deck = (state.customDecks || []).find((d) => d.id === deckId);
      const idSet = new Set(deck ? deck.wordIds : []);
      return pool.filter((w) => idSet.has(w.id));
    }
    return pool;
  }

  function selectQuestionPool(scopeValue, countValue, shouldShuffle, forcedWordIds = null) {
    const state = loadState();
    let candidates = [];

    if (Array.isArray(forcedWordIds) && forcedWordIds.length > 0) {
      const idSet = new Set(forcedWordIds.map(Number));
      candidates = VOCAB_DB.filter((w) => idSet.has(w.id));
    } else {
      candidates = filterWordsByScope(scopeValue, state);
      if (!candidates.length) candidates = VOCAB_DB.slice();
    }

    const ordered = shouldShuffle ? shuffleArray(candidates) : candidates.slice();
    if (countValue === "ALL") return ordered;
    const limit = Math.max(1, Number(countValue) || 10);
    return ordered.slice(0, limit);
  }

  function recordQuizResult(wordId, isCorrect, modeName) {
    const state = loadState();
    const prevProg = state.progress[wordId] || null;

    if (isCorrect) {
      state.progress[wordId] = calculateNextSrs(prevProg, "완벽함");
    } else {
      state.progress[wordId] = calculateNextSrs(prevProg, "모름");
      const prevWrong = state.wrongStats[wordId] || { count: 0 };
      state.wrongStats[wordId] = {
        count: (Number(prevWrong.count) || 0) + 1,
        lastWrongAt: new Date().toISOString(),
        lastMode: modeName
      };
    }

    saveState(state);
    document.dispatchEvent(new CustomEvent("jlpt:state-updated"));
  }

  // =========================================================
  // 4지선다 퀴즈
  // =========================================================
  function buildMcqQuestion(targetWord, qType) {
    const distractors = shuffleArray(VOCAB_DB.filter((w) => w.id !== targetWord.id)).slice(0, 3);
    const allOptions = shuffleArray([targetWord, ...distractors]);

    let typeLabel = "표기/읽기 → 뜻 맞히기";
    let promptMain = targetWord.word;
    let promptSub = `읽기: ${targetWord.kana}`;
    let correctValue = targetWord.meaning;

    if (qType === "word") {
      typeLabel = "뜻 → 단어 표기 맞히기";
      promptMain = targetWord.meaning;
      promptSub = targetWord.pos ? `품사: ${targetWord.pos}` : "";
      correctValue = targetWord.word;
    } else if (qType === "pos") {
      typeLabel = "예문/문맥 → 품사 맞히기";
      promptMain = targetWord.word;
      promptSub = targetWord.example || targetWord.kana;
      correctValue = targetWord.pos || "명사";
    } else if (qType === "synonym") {
      typeLabel = "유의어·관련 표현 맞히기";
      promptMain = targetWord.word;
      promptSub = `뜻: ${targetWord.meaning}`;
      const synText =
        Array.isArray(targetWord.synonyms) && targetWord.synonyms.length
          ? targetWord.synonyms.join(", ")
          : targetWord.meaning;
      correctValue = synText;
    }

    const choices = allOptions.map((opt) => {
      let label = opt.meaning;
      if (qType === "word") label = opt.word;
      else if (qType === "pos") label = opt.pos || "명사";
      else if (qType === "synonym") {
        label =
          Array.isArray(opt.synonyms) && opt.synonyms.length
            ? opt.synonyms.join(", ")
            : opt.meaning;
      }
      return {
        label,
        isCorrect: opt.id === targetWord.id
      };
    });

    // 중복 라벨 방지 보완
    const seen = new Set();
    choices.forEach((c) => {
      if (seen.has(c.label)) {
        c.label = `${c.label} (${targetWord.id === undefined ? "" : ""})`.trim();
      }
      seen.add(c.label);
    });

    return {
      word: targetWord,
      typeLabel,
      promptMain,
      promptSub,
      correctValue,
      choices
    };
  }

  function startMcqQuiz(forcedWordIds = null) {
    const countVal = document.getElementById("mcq-count-select")?.value || "10";
    const scopeVal = document.getElementById("mcq-scope-select")?.value || "ALL";
    const qType = document.getElementById("mcq-type-select")?.value || "meaning";
    const shouldShuffle = Boolean(document.getElementById("mcq-shuffle-toggle")?.checked);

    const pool = selectQuestionPool(scopeVal, countVal, shouldShuffle, forcedWordIds);
    quizSession.mcq.questions = pool.map((w) => buildMcqQuestion(w, qType));
    quizSession.mcq.index = 0;
    quizSession.mcq.score = 0;
    quizSession.mcq.answered = false;
    quizSession.mcq.wrongIds = [];

    document.getElementById("mcq-setup-box").hidden = true;
    document.getElementById("mcq-result-box").hidden = true;
    document.getElementById("mcq-play-box").hidden = false;

    renderMcqQuestion();
  }

  function renderMcqQuestion() {
    const q = quizSession.mcq.questions[quizSession.mcq.index];
    const total = quizSession.mcq.questions.length;
    if (!q) return;

    quizSession.mcq.answered = false;
    document.getElementById("mcq-progress-label").textContent = `문항 ${quizSession.mcq.index + 1} / ${total}`;
    document.getElementById("mcq-score-label").textContent = `점수: ${quizSession.mcq.score}`;
    document.getElementById("mcq-question-type-label").textContent = q.typeLabel;

    const mainEl = document.getElementById("mcq-question-text");
    const subEl = document.getElementById("mcq-question-sub");
    const hiraganaOnly = isHiraganaOnly(q.word.word);

    if (mainEl) {
      mainEl.textContent = q.promptMain;
      mainEl.classList.toggle("word-hiragana-only", hiraganaOnly && q.promptMain === q.word.word);
      mainEl.classList.remove("is-revealed");
    }
    if (subEl) {
      subEl.textContent = q.promptSub;
      subEl.classList.remove("is-revealed");
    }

    const feedbackEl = document.getElementById("mcq-feedback");
    if (feedbackEl) {
      feedbackEl.hidden = true;
      feedbackEl.className = "quiz-feedback";
      feedbackEl.textContent = "";
    }

    const nextBtn = document.getElementById("btn-mcq-next");
    if (nextBtn) nextBtn.disabled = true;

    const choicesContainer = document.getElementById("mcq-choices-container");
    if (choicesContainer) {
      choicesContainer.innerHTML = q.choices
        .map(
          (ch, idx) => `
          <button
            type="button"
            class="choice-btn"
            data-choice-index="${idx}"
            data-correct="${ch.isCorrect}"
            lang="ja"
          >
            ${idx + 1}. ${escapeHtml(ch.label)}
          </button>
        `
        )
        .join("");
    }
  }

  function handleMcqChoice(choiceBtn) {
    if (quizSession.mcq.answered) return;
    const q = quizSession.mcq.questions[quizSession.mcq.index];
    if (!q) return;

    quizSession.mcq.answered = true;
    const isCorrect = choiceBtn.getAttribute("data-correct") === "true";
    const container = document.getElementById("mcq-choices-container");

    container?.querySelectorAll(".choice-btn").forEach((btn) => {
      btn.disabled = true;
      if (btn.getAttribute("data-correct") === "true") {
        btn.classList.add("is-correct");
      } else if (btn === choiceBtn && !isCorrect) {
        btn.classList.add("is-wrong");
      }
    });

    const feedbackEl = document.getElementById("mcq-feedback");
    if (isCorrect) {
      quizSession.mcq.score += 1;
      if (feedbackEl) {
        feedbackEl.hidden = false;
        feedbackEl.className = "quiz-feedback correct";
        feedbackEl.textContent = `정답입니다! (${q.word.word} [${q.word.kana}] — ${q.word.meaning})`;
      }
    } else {
      quizSession.mcq.wrongIds.push(q.word.id);
      if (feedbackEl) {
        feedbackEl.hidden = false;
        feedbackEl.className = "quiz-feedback wrong";
        feedbackEl.textContent = `오답입니다. 정답: ${q.correctValue} (${q.word.word} [${q.word.kana}] — ${q.word.meaning})`;
      }
    }

    recordQuizResult(q.word.id, isCorrect, "4지선다 퀴즈");
    document.getElementById("mcq-score-label").textContent = `점수: ${quizSession.mcq.score}`;
    const nextBtn = document.getElementById("btn-mcq-next");
    if (nextBtn) nextBtn.disabled = false;
  }

  function nextMcqQuestion() {
    if (quizSession.mcq.index + 1 < quizSession.mcq.questions.length) {
      quizSession.mcq.index += 1;
      renderMcqQuestion();
    } else {
      document.getElementById("mcq-play-box").hidden = true;
      document.getElementById("mcq-result-box").hidden = false;
      const total = quizSession.mcq.questions.length;
      document.getElementById("mcq-result-summary").textContent =
        `총 ${total}문항 중 ${quizSession.mcq.score}문항 정답 (오답 ${quizSession.mcq.wrongIds.length}개)`;
      const retryBtn = document.getElementById("btn-mcq-retry-wrong");
      if (retryBtn) retryBtn.disabled = quizSession.mcq.wrongIds.length === 0;
    }
  }

  // =========================================================
  // 주관식 테스트 (히라가나 직접 입력 / 타일 선택 / 히라가나 전용 예외)
  // =========================================================
  function generateKanaTiles(answerKana) {
    const targetChars = [...answerKana];
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
    return shuffleArray([...targetChars, ...extras]).map((ch) => ({
      char: ch,
      used: false
    }));
  }

  function startInputQuiz(forcedWordIds = null) {
    const countVal = document.getElementById("input-quiz-count-select")?.value || "10";
    const scopeVal = document.getElementById("input-quiz-scope-select")?.value || "ALL";
    const shouldShuffle = Boolean(document.getElementById("input-shuffle-toggle")?.checked);

    const pool = selectQuestionPool(scopeVal, countVal, shouldShuffle, forcedWordIds);
    quizSession.input.questions = pool.map((w) => {
      const hiraganaOnly = isHiraganaOnly(w.word);
      const expectedAnswer = hiraganaOnly ? w.word.trim() : w.kana.trim();
      return {
        word: w,
        hiraganaOnly,
        expectedAnswer
      };
    });
    quizSession.input.index = 0;
    quizSession.input.score = 0;
    quizSession.input.answered = false;
    quizSession.input.wrongIds = [];

    document.getElementById("input-quiz-setup-box").hidden = true;
    document.getElementById("input-quiz-result-box").hidden = true;
    document.getElementById("input-quiz-play-box").hidden = false;

    renderInputQuestion();
  }

  function renderInputQuestion() {
    const q = quizSession.input.questions[quizSession.input.index];
    const total = quizSession.input.questions.length;
    if (!q) return;

    const inputMode = document.getElementById("input-mode-select")?.value || "direct";
    const hideMeaning = Boolean(document.getElementById("input-hide-meaning-toggle")?.checked);
    const showFirstHint = Boolean(document.getElementById("input-first-char-hint-toggle")?.checked);

    quizSession.input.answered = false;
    quizSession.input.tileSequence = [];
    quizSession.input.tiles = generateKanaTiles(q.expectedAnswer);

    document.getElementById("input-quiz-progress-label").textContent = `문항 ${quizSession.input.index + 1} / ${total}`;
    document.getElementById("input-quiz-mode-badge").textContent =
      inputMode === "tile" ? "히라가나 타일 선택" : "히라가나 직접 입력";

    const ruleBadge = document.getElementById("input-quiz-rule-badge");
    const promptEl = document.getElementById("input-quiz-prompt");
    const meaningEl = document.getElementById("input-quiz-meaning");
    const hintEl = document.getElementById("input-quiz-hint");

    // 히라가나 전용 단어 예외 규칙: 한글 뜻을 제시하고 히라가나 직접 입력/타일 선택 출제
    if (q.hiraganaOnly) {
      if (ruleBadge) ruleBadge.textContent = "히라가나 전용 단어 규칙: 한글 뜻을 보고 히라가나 입력/선택";
      if (promptEl) {
        promptEl.textContent = q.word.meaning;
        promptEl.removeAttribute("lang");
      }
      if (meaningEl) {
        meaningEl.textContent = "(히라가나 전용 단어)";
        meaningEl.hidden = hideMeaning;
      }
    } else {
      if (ruleBadge) ruleBadge.textContent = "단어 표기를 보고 히라가나 읽기 입력/선택";
      if (promptEl) {
        promptEl.textContent = q.word.word;
        promptEl.setAttribute("lang", "ja");
      }
      if (meaningEl) {
        meaningEl.textContent = `뜻: ${q.word.meaning}`;
        meaningEl.hidden = hideMeaning;
        meaningEl.classList.remove("is-revealed");
      }
    }

    if (hintEl) {
      const firstChar = [...q.expectedAnswer][0] || "";
      hintEl.hidden = !showFirstHint;
      hintEl.textContent = showFirstHint ? `첫글자 힌트: "${firstChar}" (총 ${[...q.expectedAnswer].length}자)` : "";
    }

    const directArea = document.getElementById("direct-input-area");
    const tileArea = document.getElementById("tile-input-area");
    const directInput = document.getElementById("kana-direct-input");

    if (inputMode === "tile") {
      if (directArea) directArea.hidden = true;
      if (tileArea) tileArea.hidden = false;
      renderKanaTiles();
    } else {
      if (directArea) directArea.hidden = false;
      if (tileArea) tileArea.hidden = true;
      if (directInput) {
        directInput.value = "";
        directInput.disabled = false;
        directInput.focus();
      }
    }

    const feedbackEl = document.getElementById("input-quiz-feedback");
    if (feedbackEl) {
      feedbackEl.hidden = true;
      feedbackEl.className = "quiz-feedback";
      feedbackEl.textContent = "";
    }

    document.getElementById("btn-input-quiz-submit").disabled = false;
    document.getElementById("btn-input-quiz-next").disabled = true;
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

  function handleTileClick(tileIndex) {
    if (quizSession.input.answered) return;
    const tile = quizSession.input.tiles[tileIndex];
    if (!tile || tile.used) return;
    tile.used = true;
    quizSession.input.tileSequence.push({ char: tile.char, tileIndex });
    renderKanaTiles();
  }

  function handleTileBackspace() {
    if (quizSession.input.answered) return;
    const last = quizSession.input.tileSequence.pop();
    if (last && quizSession.input.tiles[last.tileIndex]) {
      quizSession.input.tiles[last.tileIndex].used = false;
    }
    renderKanaTiles();
  }

  function handleTileClear() {
    if (quizSession.input.answered) return;
    quizSession.input.tileSequence = [];
    quizSession.input.tiles.forEach((t) => {
      t.used = false;
    });
    renderKanaTiles();
  }

  function submitInputAnswer() {
    if (quizSession.input.answered) return;
    const q = quizSession.input.questions[quizSession.input.index];
    if (!q) return;

    const inputMode = document.getElementById("input-mode-select")?.value || "direct";
    const userAnswer =
      inputMode === "tile"
        ? quizSession.input.tileSequence.map((t) => t.char).join("").trim()
        : (document.getElementById("kana-direct-input")?.value || "").trim();

    if (!userAnswer) {
      alert("히라가나를 입력하거나 타일을 선택해 주세요.");
      return;
    }

    quizSession.input.answered = true;
    const isCorrect = userAnswer === q.expectedAnswer;
    const feedbackEl = document.getElementById("input-quiz-feedback");

    if (isCorrect) {
      quizSession.input.score += 1;
      if (feedbackEl) {
        feedbackEl.hidden = false;
        feedbackEl.className = "quiz-feedback correct";
        feedbackEl.textContent = `정답입니다! (${q.word.word} [${q.word.kana}] — ${q.word.meaning})`;
      }
    } else {
      quizSession.input.wrongIds.push(q.word.id);
      if (feedbackEl) {
        feedbackEl.hidden = false;
        feedbackEl.className = "quiz-feedback wrong";
        feedbackEl.textContent = `입력 "${userAnswer}" — 정답: "${q.expectedAnswer}" (${q.word.word} — ${q.word.meaning})`;
      }
    }

    const directInput = document.getElementById("kana-direct-input");
    if (directInput) directInput.disabled = true;
    renderKanaTiles();

    recordQuizResult(q.word.id, isCorrect, "주관식 테스트");
    document.getElementById("btn-input-quiz-submit").disabled = true;
    document.getElementById("btn-input-quiz-next").disabled = false;
  }

  function nextInputQuestion() {
    if (quizSession.input.index + 1 < quizSession.input.questions.length) {
      quizSession.input.index += 1;
      renderInputQuestion();
    } else {
      document.getElementById("input-quiz-play-box").hidden = true;
      document.getElementById("input-quiz-result-box").hidden = false;
      const total = quizSession.input.questions.length;
      document.getElementById("input-quiz-result-summary").textContent =
        `총 ${total}문항 중 ${quizSession.input.score}문항 정답 (오답 ${quizSession.input.wrongIds.length}개)`;
      const retryBtn = document.getElementById("btn-input-retry-wrong");
      if (retryBtn) retryBtn.disabled = quizSession.input.wrongIds.length === 0;
    }
  }

  // =========================================================
  // 오답노트 렌더링 및 관리
  // =========================================================
  function renderWrongNote() {
    const state = loadState();
    const listEl = document.getElementById("wrong-note-list");
    const itemsCountEl = document.getElementById("wrong-items-count");
    const totalAttemptsEl = document.getElementById("wrong-total-attempts");
    if (!listEl) return;

    const entries = Object.entries(state.wrongStats || {})
      .map(([idStr, stat]) => {
        const word = VOCAB_DB.find((w) => w.id === Number(idStr));
        if (!word || !stat || !(Number(stat.count) > 0)) return null;
        return { word, stat };
      })
      .filter(Boolean)
      .sort((a, b) => Number(b.stat.count) - Number(a.stat.count));

    const totalAttempts = entries.reduce((sum, item) => sum + Number(item.stat.count || 0), 0);
    if (itemsCountEl) itemsCountEl.textContent = String(entries.length);
    if (totalAttemptsEl) totalAttemptsEl.textContent = String(totalAttempts);

    if (!entries.length) {
      listEl.innerHTML = `<div class="card"><p class="helper-text">기록된 오답 단어가 없습니다. 퀴즈나 테스트에서 틀린 단어가 이곳에 자동으로 쌓입니다.</p></div>`;
      return;
    }

    listEl.innerHTML = entries
      .map(({ word, stat }) => {
        const hiraganaOnly = isHiraganaOnly(word.word);
        return `
          <article class="wrong-item" data-word-id="${word.id}">
            <div class="vocab-item-main">
              <div class="vocab-word-line">
                <span class="vocab-word ${hiraganaOnly ? "word-hiragana-only" : ""}" lang="ja">${escapeHtml(word.word)}</span>
                <span class="vocab-kana maskable mask-kana" lang="ja">${escapeHtml(word.kana)}</span>
                <span class="wrong-count-pill">누적 오답 ${Number(stat.count)}회</span>
              </div>
              <div class="vocab-meaning maskable mask-meaning">${escapeHtml(word.meaning)}</div>
              <div class="helper-text">최근 출제: ${escapeHtml(stat.lastMode || "퀴즈")}</div>
            </div>
            <div class="vocab-item-actions">
              <button type="button" class="icon-btn wrong-tts-btn" data-speak="${escapeHtml(word.word)}" title="발음 듣기">🔊</button>
              <button type="button" class="mini-btn btn-secondary wrong-resolve-btn" data-word-id="${word.id}">복습 완료</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function removeWrongEntry(wordId) {
    const state = loadState();
    delete state.wrongStats[wordId];
    saveState(state);
    renderWrongNote();
    document.dispatchEvent(new CustomEvent("jlpt:state-updated"));
  }

  function clearAllWrongEntries() {
    const state = loadState();
    state.wrongStats = {};
    saveState(state);
    renderWrongNote();
    document.dispatchEvent(new CustomEvent("jlpt:state-updated"));
  }

  function getAllWrongWordIds() {
    const state = loadState();
    return Object.entries(state.wrongStats || {})
      .filter(([, stat]) => stat && Number(stat.count) > 0)
      .map(([id]) => Number(id));
  }

  // =========================================================
  // 이벤트 바인딩 & 초기화
  // =========================================================
  function bindQuizEvents() {
    document.addEventListener("jlpt:refresh-quiz-scopes", populateQuizScopeSelects);
    document.addEventListener("jlpt:render-wrong-note", renderWrongNote);

    // 4지선다 퀴즈
    document.getElementById("btn-start-mcq")?.addEventListener("click", () => startMcqQuiz(null));
    document.getElementById("mcq-choices-container")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".choice-btn");
      if (btn) handleMcqChoice(btn);
    });
    document.getElementById("btn-mcq-next")?.addEventListener("click", nextMcqQuestion);
    document.getElementById("btn-mcq-quit")?.addEventListener("click", () => {
      document.getElementById("mcq-play-box").hidden = true;
      document.getElementById("mcq-setup-box").hidden = false;
    });
    document.getElementById("btn-mcq-restart")?.addEventListener("click", () => {
      document.getElementById("mcq-result-box").hidden = true;
      document.getElementById("mcq-setup-box").hidden = false;
    });
    document.getElementById("btn-mcq-retry-wrong")?.addEventListener("click", () => {
      if (quizSession.mcq.wrongIds.length) {
        startMcqQuiz(quizSession.mcq.wrongIds);
      }
    });

    // 주관식 테스트
    document.getElementById("btn-start-input-quiz")?.addEventListener("click", () => startInputQuiz(null));
    document.getElementById("input-mode-select")?.addEventListener("change", () => {
      if (!document.getElementById("input-quiz-play-box")?.hidden) {
        renderInputQuestion();
      }
    });
    document.getElementById("input-hide-meaning-toggle")?.addEventListener("change", () => {
      if (!document.getElementById("input-quiz-play-box")?.hidden) {
        renderInputQuestion();
      }
    });
    document.getElementById("input-first-char-hint-toggle")?.addEventListener("change", () => {
      if (!document.getElementById("input-quiz-play-box")?.hidden) {
        renderInputQuestion();
      }
    });
    document.getElementById("kana-tile-grid")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".kana-tile-btn");
      if (btn) handleTileClick(Number(btn.getAttribute("data-tile-index")));
    });
    document.getElementById("btn-tile-backspace")?.addEventListener("click", handleTileBackspace);
    document.getElementById("btn-tile-clear")?.addEventListener("click", handleTileClear);
    document.getElementById("btn-input-quiz-submit")?.addEventListener("click", submitInputAnswer);
    document.getElementById("kana-direct-input")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !quizSession.input.answered) {
        e.preventDefault();
        submitInputAnswer();
      }
    });
    document.getElementById("btn-input-quiz-next")?.addEventListener("click", nextInputQuestion);
    document.getElementById("btn-input-quiz-quit")?.addEventListener("click", () => {
      document.getElementById("input-quiz-play-box").hidden = true;
      document.getElementById("input-quiz-setup-box").hidden = false;
    });
    document.getElementById("btn-input-restart")?.addEventListener("click", () => {
      document.getElementById("input-quiz-result-box").hidden = true;
      document.getElementById("input-quiz-setup-box").hidden = false;
    });
    document.getElementById("btn-input-retry-wrong")?.addEventListener("click", () => {
      if (quizSession.input.wrongIds.length) {
        startInputQuiz(quizSession.input.wrongIds);
      }
    });

    // 오답노트 액션
    document.getElementById("wrong-note-list")?.addEventListener("click", (e) => {
      const ttsBtn = e.target.closest(".wrong-tts-btn");
      if (ttsBtn) {
        window.JLPTStudy?.speakJapanese(ttsBtn.getAttribute("data-speak"));
        return;
      }
      const resolveBtn = e.target.closest(".wrong-resolve-btn");
      if (resolveBtn) {
        removeWrongEntry(Number(resolveBtn.getAttribute("data-word-id")));
      }
    });

    document.getElementById("btn-wrong-clear-reviewed")?.addEventListener("click", clearAllWrongEntries);

    document.getElementById("btn-wrong-retry-mcq")?.addEventListener("click", () => {
      const wrongIds = getAllWrongWordIds();
      if (!wrongIds.length) return;
      window.JLPTStudy?.switchTab("quiz-mcq");
      startMcqQuiz(wrongIds);
    });

    document.getElementById("btn-wrong-retry-input")?.addEventListener("click", () => {
      const wrongIds = getAllWrongWordIds();
      if (!wrongIds.length) return;
      window.JLPTStudy?.switchTab("quiz-input");
      startInputQuiz(wrongIds);
    });
  }

  function initQuiz() {
    populateQuizScopeSelects();
    renderWrongNote();
    bindQuizEvents();
  }

  document.addEventListener("DOMContentLoaded", initQuiz);
})();