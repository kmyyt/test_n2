(() => {
  "use strict";

  const DATA = window.JLPTData;
  if (!DATA) {
    console.error("window.JLPTData가 로드되지 않았습니다.");
    return;
  }

  const quizState = {
    mcq: {
      questions: [],
      index: 0,
      score: 0,
      answered: false,
      wrongIds: []
    },
    subjective: {
      questions: [],
      index: 0,
      score: 0,
      answered: false,
      wrongIds: [],
      tiles: [],
      sequence: []
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
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function getUnifiedPool(domain = "vocab", scope = "ALL", state = DATA.loadState()) {
    const vocabItems = DATA.VOCAB_DB.map((v) => ({ ...v, _domain: "vocab" }));
    const grammarItems = DATA.GRAMMAR_DB.map((g) => ({ ...g, _domain: "grammar" }));

    let pool = [];
    if (domain === "grammar") {
      pool = grammarItems;
    } else if (domain === "all") {
      pool = [...vocabItems, ...grammarItems];
    } else {
      pool = vocabItems;
    }

    const favSet = new Set((state.favorites || []).map(String));

    return pool.filter((item) => {
      const idStr = String(item.id);
      const status = state.progress?.[idStr]?.status || "미암기";
      if (scope === "DUE") return DATA.isDueForReview(idStr, state);
      if (scope === "FAVORITE") return favSet.has(idStr);
      if (["외움", "헷갈림", "미암기"].includes(scope)) return status === scope;
      return true;
    });
  }

  function pickQuestions(pool, countValue, shouldShuffle = true, forcedIds = null) {
    let base = [...pool];
    if (Array.isArray(forcedIds) && forcedIds.length) {
      const idSet = new Set(forcedIds.map(String));
      const allCombined = [
        ...DATA.VOCAB_DB.map((v) => ({ ...v, _domain: "vocab" })),
        ...DATA.GRAMMAR_DB.map((g) => ({ ...g, _domain: "grammar" }))
      ];
      base = allCombined.filter((item) => idSet.has(String(item.id)));
    }
    if (!base.length) {
      base = DATA.VOCAB_DB.map((v) => ({ ...v, _domain: "vocab" }));
    }
    const ordered = shouldShuffle ? shuffleArray(base) : base;
    if (countValue === "ALL") return ordered;
    const n = Math.max(1, Number(countValue) || 10);
    return ordered.slice(0, n);
  }

  function applyQuizResultToState(item, isCorrect, modeLabel) {
    const idStr = String(item.id);
    const state = DATA.loadState();
    const prev = state.progress?.[idStr] || null;

    if (isCorrect) {
      state.progress[idStr] = {
        type: item._domain === "grammar" ? "grammar" : "vocab",
        ...DATA.calculateNextSrs(prev, "완벽함")
      };
    } else {
      state.progress[idStr] = {
        type: item._domain === "grammar" ? "grammar" : "vocab",
        ...DATA.calculateNextSrs(prev, "모름")
      };
      const prevWrong = state.wrongStats?.[idStr] || { count: 0 };
      state.wrongStats[idStr] = {
        count: (Number(prevWrong.count) || 0) + 1,
        lastWrongAt: new Date().toISOString(),
        lastMode: modeLabel
      };
    }

    DATA.saveState(state);
    document.dispatchEvent(new CustomEvent("jlpt:state-updated"));
  }

  // =========================================================
  // 4지선다 퀴즈 생성 및 채점 (어휘 + 문법 공란 패턴 지원)
  // =========================================================
  function buildMcqItem(target) {
    if (target._domain === "grammar") {
      const pool = DATA.GRAMMAR_DB.filter((g) => String(g.id) !== String(target.id));
      const distractors = shuffleArray(pool).slice(0, 3);
      const options = shuffleArray([target, ...distractors]).map((g) => ({
        label: `${g.word} (${g.meaning})`,
        isCorrect: String(g.id) === String(target.id)
      }));

      const blankedExample = target.example
        ? target.example.replace(target.word, "＿＿＿")
        : `접속: ${target.connection || ""}`;

      return {
        item: target,
        tag: "문법 패턴 퀴즈",
        prompt: blankedExample,
        sub: target.exampleMeaning || `접속 형태: ${target.connection || "문법"}`,
        correctText: `${target.word} — ${target.meaning}`,
        options
      };
    }

    const pool = DATA.VOCAB_DB.filter((v) => String(v.id) !== String(target.id));
    const distractors = shuffleArray(pool).slice(0, 3);
    const options = shuffleArray([target, ...distractors]).map((v) => ({
      label: v.meaning,
      isCorrect: String(v.id) === String(target.id)
    }));

    return {
      item: target,
      tag: "어휘 뜻 맞히기",
      prompt: target.word,
      sub: target.kana ? `읽기: ${target.kana}` : "",
      correctText: `${target.word} [${target.kana}] — ${target.meaning}`,
      options
    };
  }

  function startMcqQuiz(forcedIds = null, options = {}) {
    const domain = options.domain || document.getElementById("vocab-quiz-domain")?.value || "vocab";
    const scope = options.scope || document.getElementById("vocab-quiz-scope")?.value || "ALL";
    const countVal = options.count || document.getElementById("vocab-quiz-count")?.value || "10";

    const rawPool = getUnifiedPool(domain, scope);
    const picked = pickQuestions(rawPool, countVal, true, forcedIds);

    quizState.mcq.questions = picked.map(buildMcqItem);
    quizState.mcq.index = 0;
    quizState.mcq.score = 0;
    quizState.mcq.answered = false;
    quizState.mcq.wrongIds = [];

    renderMcqRunner();
  }

  function renderMcqRunner() {
    const runner = document.getElementById("vocab-quiz-runner");
    if (!runner) return;
    runner.hidden = false;

    const q = quizState.mcq.questions[quizState.mcq.index];
    const total = quizState.mcq.questions.length;

    if (!q) {
      const hasWrong = quizState.mcq.wrongIds.length > 0;
      runner.innerHTML = `
        <div class="card-header"><span>4지선다 퀴즈 결과</span></div>
        <p class="result-summary">
          총 ${total}문제 중 <strong>${quizState.mcq.score}</strong>문제 정답 · 오답 <strong>${quizState.mcq.wrongIds.length}</strong>개
        </p>
        <div class="quick-action-row">
          <button type="button" class="btn btn-primary" id="btn-mcq-retry-wrong" ${
            hasWrong ? "" : "disabled"
          }>틀린 문제만 다시 풀기</button>
          <button type="button" class="btn" id="btn-quiz-back-setup">설정으로 돌아가기</button>
        </div>
      `;
      return;
    }

    quizState.mcq.answered = false;
    const isKanaOnlyWord = q.item._domain === "vocab" && DATA.isHiraganaOnly(q.item.word);

    runner.innerHTML = `
      <div class="card-header">
        <span>${escapeHtml(q.tag)} (${quizState.mcq.index + 1} / ${total})</span>
        <span class="badge">점수: ${quizState.mcq.score}</span>
      </div>
      <div class="quiz-question-box">
        <div class="quiz-prompt-main" lang="ja">${escapeHtml(q.prompt)}</div>
        ${
          q.sub
            ? `<div class="quiz-prompt-sub maskable-kana ${
                isKanaOnlyWord ? "is-kana-only-headword" : ""
              }" lang="ja">${escapeHtml(q.sub)}</div>`
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
        <button type="button" class="btn" id="btn-quiz-back-setup">설정으로</button>
      </div>
    `;
  }

  function handleMcqAnswer(btnEl) {
    if (quizState.mcq.answered) return;
    const q = quizState.mcq.questions[quizState.mcq.index];
    if (!q) return;

    quizState.mcq.answered = true;
    const isCorrect = btnEl.getAttribute("data-correct") === "true";

    document.querySelectorAll("#mcq-choices-list .quiz-choice-btn").forEach((b) => {
      b.disabled = true;
      if (b.getAttribute("data-correct") === "true") {
        b.classList.add("btn-secondary");
      } else if (b === btnEl && !isCorrect) {
        b.classList.add("btn-danger");
      }
    });

    const feedback = document.getElementById("mcq-feedback-box");
    if (feedback) {
      feedback.hidden = false;
      if (isCorrect) {
        quizState.mcq.score += 1;
        feedback.innerHTML = `<strong class="feedback-ok">정답!</strong> ${escapeHtml(q.correctText)}`;
      } else {
        quizState.mcq.wrongIds.push(q.item.id);
        feedback.innerHTML = `<strong class="feedback-err">오답</strong> — 정답: ${escapeHtml(q.correctText)}`;
      }
    }

    applyQuizResultToState(q.item, isCorrect, "4지선다 퀴즈");
    const nextBtn = document.getElementById("btn-mcq-next-q");
    if (nextBtn) nextBtn.disabled = false;
  }
  // =========================================================
  // 주관식 히라가나 테스트 (직접 입력 / 타일 순서 / 히라가나 전용 예외)
  // =========================================================
  function buildKanaTiles(answerKana) {
    const chars = [...String(answerKana || "")].filter((ch) => ch.trim() !== "");
    const distractors = [
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
    ].filter((ch) => !chars.includes(ch));

    const extraCount = Math.max(4, Math.min(8, chars.length + 2));
    const pool = shuffleArray([...chars, ...shuffleArray(distractors).slice(0, extraCount)]);
    return pool.map((char) => ({ char, used: false }));
  }

  function startSubjectiveQuiz(forcedIds = null, options = {}) {
    const domain = options.domain || document.getElementById("vocab-quiz-domain")?.value || "vocab";
    const scope = options.scope || document.getElementById("vocab-quiz-scope")?.value || "ALL";
    const countVal = options.count || document.getElementById("vocab-quiz-count")?.value || "10";

    const rawPool = getUnifiedPool(domain, scope).filter((item) => {
      const targetReading = DATA.isHiraganaOnly(item.word) ? item.word : item.kana;
      return Boolean(targetReading && targetReading.trim());
    });

    const picked = pickQuestions(rawPool, countVal, true, forcedIds);
    quizState.subjective.questions = picked.map((item) => {
      const kanaOnly = DATA.isHiraganaOnly(item.word);
      const expected = kanaOnly ? String(item.word).trim() : String(item.kana || item.word).trim();
      return {
        item,
        kanaOnly,
        expected
      };
    });

    quizState.subjective.index = 0;
    quizState.subjective.score = 0;
    quizState.subjective.answered = false;
    quizState.subjective.wrongIds = [];
    quizState.subjective.sequence = [];
    quizState.subjective.tiles = [];

    renderSubjectiveRunner();
  }

  function renderSubjectiveRunner() {
    const runner = document.getElementById("vocab-quiz-runner");
    if (!runner) return;
    runner.hidden = false;

    const q = quizState.subjective.questions[quizState.subjective.index];
    const total = quizState.subjective.questions.length;

    if (!q) {
      const hasWrong = quizState.subjective.wrongIds.length > 0;
      runner.innerHTML = `
        <div class="card-header"><span>주관식 히라가나 테스트 결과</span></div>
        <p class="result-summary">
          총 ${total}문제 중 <strong>${quizState.subjective.score}</strong>문제 정답 · 오답 <strong>${quizState.subjective.wrongIds.length}</strong>개
        </p>
        <div class="quick-action-row">
          <button type="button" class="btn btn-primary" id="btn-subj-retry-wrong" ${
            hasWrong ? "" : "disabled"
          }>틀린 문제만 다시 풀기</button>
          <button type="button" class="btn" id="btn-quiz-back-setup">설정으로 돌아가기</button>
        </div>
      `;
      return;
    }

    const hideMeaning = Boolean(document.getElementById("subj-hide-meaning")?.checked);
    const firstHint = Boolean(document.getElementById("subj-first-hint")?.checked);
    const inputMethod = document.getElementById("subj-input-method")?.value || "direct";

    quizState.subjective.answered = false;
    quizState.subjective.sequence = [];
    quizState.subjective.tiles = buildKanaTiles(q.expected);

    // 히라가나 전용 단어 예외 규칙: 표기 대신 뜻을 제시하고 히라가나 입력/타일 테스트
    const promptText = q.kanaOnly ? q.item.meaning : q.item.word;
    const subMeaning = q.kanaOnly ? "(히라가나 전용 단어)" : `뜻: ${q.item.meaning}`;
    const firstChar = [...q.expected][0] || "";

    runner.innerHTML = `
      <div class="card-header">
        <span>주관식 히라가나 (${quizState.subjective.index + 1} / ${total})</span>
        <span class="badge">점수: ${quizState.subjective.score}</span>
      </div>
      <div class="quiz-question-box">
        <div class="quiz-prompt-main" ${q.kanaOnly ? "" : 'lang="ja"'}>${escapeHtml(promptText)}</div>
        ${hideMeaning ? "" : `<div class="quiz-prompt-sub">${escapeHtml(subMeaning)}</div>`}
        ${
          firstHint && firstChar
            ? `<div class="quiz-hint-text">첫글자 힌트: <strong lang="ja">${escapeHtml(
                firstChar
              )}</strong> (${[...q.expected].length}자)</div>`
            : ""
        }
      </div>

      ${
        inputMethod === "tiles"
          ? `
        <div class="tile-answer-box">
          <div class="tile-selected-view" id="subj-tile-output" lang="ja">타일을 순서대로 누르세요</div>
          <div class="tile-grid" id="subj-tile-grid">
            ${quizState.subjective.tiles
              .map(
                (t, i) =>
                  `<button type="button" class="kana-tile-btn" data-tile-idx="${i}" lang="ja">${escapeHtml(
                    t.char
                  )}</button>`
              )
              .join("")}
          </div>
          <div class="quick-action-row" style="margin-top: 8px;">
            <button type="button" class="chip-btn" id="btn-subj-tile-back">한 글자 지우기</button>
            <button type="button" class="chip-btn" id="btn-subj-tile-clear">초기화</button>
          </div>
        </div>
      `
          : `
        <div class="direct-input-box">
          <input
            type="text"
            id="subj-direct-input"
            class="search-input"
            lang="ja"
            placeholder="히라가나를 입력하세요..."
            autocomplete="off"
          />
        </div>
      `
      }

      <div class="quiz-feedback-box" id="subj-feedback-box" hidden></div>
      <div class="quick-action-row" style="margin-top: 14px;">
        <button type="button" class="btn btn-primary" id="btn-subj-submit">정답 확인</button>
        <button type="button" class="btn btn-secondary" id="btn-subj-next-q" disabled>다음 문제 →</button>
        <button type="button" class="btn" id="btn-quiz-back-setup">설정으로</button>
      </div>
    `;

    if (inputMethod !== "tiles") {
      document.getElementById("subj-direct-input")?.focus();
    }
  }

  function updateTileDisplay() {
    const outEl = document.getElementById("subj-tile-output");
    if (outEl) {
      const text = quizState.subjective.sequence.map((s) => s.char).join("");
      outEl.textContent = text || "타일을 순서대로 누르세요";
    }
    document.querySelectorAll("#subj-tile-grid .kana-tile-btn").forEach((btn) => {
      const idx = Number(btn.getAttribute("data-tile-idx"));
      const tile = quizState.subjective.tiles[idx];
      if (!tile) return;
      btn.disabled = Boolean(tile.used) || quizState.subjective.answered;
      btn.classList.toggle("is-used", Boolean(tile.used));
    });
  }

  function submitSubjectiveAnswer() {
    if (quizState.subjective.answered) return;
    const q = quizState.subjective.questions[quizState.subjective.index];
    if (!q) return;

    const inputMethod = document.getElementById("subj-input-method")?.value || "direct";
    const rawInput =
      inputMethod === "tiles"
        ? quizState.subjective.sequence.map((s) => s.char).join("")
        : document.getElementById("subj-direct-input")?.value || "";

    const userAns = rawInput.trim();
    if (!userAns) return;

    quizState.subjective.answered = true;
    const isCorrect = userAns === q.expected;

    if (inputMethod === "tiles") {
      updateTileDisplay();
    } else {
      const inp = document.getElementById("subj-direct-input");
      if (inp) inp.disabled = true;
    }

    const feedback = document.getElementById("subj-feedback-box");
    if (feedback) {
      feedback.hidden = false;
      if (isCorrect) {
        quizState.subjective.score += 1;
        feedback.innerHTML = `<strong class="feedback-ok">정답!</strong> 정답: <span lang="ja">${escapeHtml(
          q.expected
        )}</span> (${escapeHtml(q.item.meaning)})`;
      } else {
        quizState.subjective.wrongIds.push(q.item.id);
        feedback.innerHTML = `<strong class="feedback-err">오답</strong> — 입력: <span lang="ja">${escapeHtml(
          userAns
        )}</span> / 정답: <strong lang="ja">${escapeHtml(q.expected)}</strong> (${escapeHtml(
          q.item.meaning
        )})`;
      }
    }

    applyQuizResultToState(q.item, isCorrect, "주관식 히라가나");
    document.getElementById("btn-subj-submit")?.setAttribute("disabled", "true");
    const nextBtn = document.getElementById("btn-subj-next-q");
    if (nextBtn) nextBtn.disabled = false;
  }

  // =========================================================
  // 퀴즈 설정 도메인 셀렉트 보완 & 이벤트 바인딩
  // =========================================================
  function ensureDomainSelectInSetup() {
    const setupCard = document.getElementById("vocab-quiz-setup");
    const grid = setupCard?.querySelector(".quiz-options-grid");
    if (!grid || document.getElementById("vocab-quiz-domain")) return;

    const wrap = document.createElement("label");
    wrap.innerHTML = `
      <span>출제 영역</span>
      <select id="vocab-quiz-domain">
        <option value="vocab" selected>문자·어휘</option>
        <option value="grammar">핵심 문법</option>
        <option value="all">통합 (어휘 + 문법)</option>
      </select>
    `;
    grid.prepend(wrap);
  }

  function startConfiguredQuiz(forcedIds = null) {
    ensureDomainSelectInSetup();
    const mode = document.getElementById("vocab-quiz-mode")?.value || "mcq";
    const domain = document.getElementById("vocab-quiz-domain")?.value || "vocab";
    const scope = document.getElementById("vocab-quiz-scope")?.value || "ALL";
    const count = document.getElementById("vocab-quiz-count")?.value || "10";

    if (mode === "subjective") {
      startSubjectiveQuiz(forcedIds, { domain, scope, count });
    } else {
      startMcqQuiz(forcedIds, { domain, scope, count });
    }
  }

  function bindQuizEvents() {
    ensureDomainSelectInSetup();

    document.getElementById("vocab-quiz-mode")?.addEventListener("change", (e) => {
      const subOpts = document.getElementById("subjective-extra-options");
      if (subOpts) {
        subOpts.hidden = e.target.value !== "subjective";
      }
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
      startConfiguredQuiz(wrongIds);
    });

    document.getElementById("vocab-quiz-runner")?.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      const choiceBtn = target.closest("[data-mcq-choice-idx]");
      if (choiceBtn) {
        handleMcqAnswer(choiceBtn);
        return;
      }

      if (target.id === "btn-mcq-next-q") {
        quizState.mcq.index += 1;
        renderMcqRunner();
        return;
      }

      if (target.id === "btn-mcq-retry-wrong") {
        if (quizState.mcq.wrongIds.length) {
          startMcqQuiz(quizState.mcq.wrongIds);
        }
        return;
      }

      const tileBtn = target.closest("[data-tile-idx]");
      if (tileBtn && !quizState.subjective.answered) {
        const idx = Number(tileBtn.getAttribute("data-tile-idx"));
        const tile = quizState.subjective.tiles[idx];
        if (tile && !tile.used) {
          tile.used = true;
          quizState.subjective.sequence.push({ char: tile.char, idx });
          updateTileDisplay();
        }
        return;
      }

      if (target.id === "btn-subj-tile-back" && !quizState.subjective.answered) {
        const popped = quizState.subjective.sequence.pop();
        if (popped && quizState.subjective.tiles[popped.idx]) {
          quizState.subjective.tiles[popped.idx].used = false;
        }
        updateTileDisplay();
        return;
      }

      if (target.id === "btn-subj-tile-clear" && !quizState.subjective.answered) {
        quizState.subjective.sequence = [];
        quizState.subjective.tiles.forEach((t) => {
          t.used = false;
        });
        updateTileDisplay();
        return;
      }

      if (target.id === "btn-subj-submit") {
        submitSubjectiveAnswer();
        return;
      }

      if (target.id === "btn-subj-next-q") {
        quizState.subjective.index += 1;
        renderSubjectiveRunner();
        return;
      }

      if (target.id === "btn-subj-retry-wrong") {
        if (quizState.subjective.wrongIds.length) {
          startSubjectiveQuiz(quizState.subjective.wrongIds);
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
      if (e.target instanceof HTMLInputElement && e.target.id === "subj-direct-input" && e.key === "Enter") {
        e.preventDefault();
        submitSubjectiveAnswer();
      }
    });
  }

  function onEnterQuizTab() {
    ensureDomainSelectInSetup();
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
    startSubjectiveQuiz
  };
})();