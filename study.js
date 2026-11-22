(() => {
  "use strict";

  const {
    EXAM_DATE,
    VOCAB_DB,
    formatDuplicateExamLabel,
    isHiraganaOnly,
    extractKanjiChars,
    findWordsByKanji,
    getTodayISO,
    calculateNextSrs,
    isDueForReview,
    loadState,
    saveState,
    exportStateToJson,
    importStateFromJson,
    resetAllData
  } = window.JLPTData;

  let appState = loadState();

  const studyState = {
    activeTab: "dashboard",
    // 단어장 필터/정렬/선택
    vocabExamFilter: "ALL",
    vocabStatusFilter: "ALL",
    vocabDeckFilter: "ALL",
    vocabSort: "default",
    vocabFavoritesOnly: false,
    vocabDueOnly: false,
    vocabSelectedIds: new Set(),
    // 플래시카드 상태
    flashcardScope: "ALL",
    flashcardDeckId: "",
    flashcardQueue: [],
    flashcardIndex: 0,
    flashcardFlipped: false,
    flashcardSelectedIds: new Set(),
    showExampleKana: false,
    showExampleMeaning: false,
    activeKanjiChar: null
  };

  const TAB_META = {
    dashboard: {
      title: "대시보드",
      subtitle: "JLPT N2 합격을 위한 오늘의 복습 및 학습 현황"
    },
    vocab: {
      title: "단어장",
      subtitle: "기출 필터·정렬, 3단계 암기 상태(SRS), 커스텀 단어장 관리"
    },
    flashcard: {
      title: "플래시카드",
      subtitle: "예문 하이라이트, 한자 네트워크, 간격 반복(SRS) 학습"
    },
    "quiz-mcq": {
      title: "4지선다 퀴즈",
      subtitle: "어휘 자료 기반 객관식 실전 훈련"
    },
    "quiz-input": {
      title: "주관식 테스트",
      subtitle: "히라가나 직접 입력 및 타일 선택 테스트"
    },
    "wrong-note": {
      title: "오답노트",
      subtitle: "누적 오답 기록 확인 및 취약 단어 재도전"
    },
    guide: {
      title: "사용방법",
      subtitle: "기능 안내, 히라가나 전용 단어 예외 규칙 및 단축키"
    }
  };

  // =========================================================
  // 공통 유틸리티 & D-Day / 테마 / 전역 가림 / TTS
  // =========================================================
  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeRegExp(str) {
    return String(str ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function getWordStatus(wordId) {
    const rec = appState.progress[wordId];
    if (rec && ["외움", "헷갈림", "미암기"].includes(rec.status)) {
      return rec.status;
    }
    return "미암기";
  }

  function computeDdayText(examDateStr = EXAM_DATE) {
    const target = new Date(`${examDateStr}T00:00:00`);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    if (diffDays > 0) return `D-${diffDays}`;
    if (diffDays === 0) return "D-Day";
    return `D+${Math.abs(diffDays)}`;
  }

  function applyTheme() {
    const isDark = appState.theme === "dark";
    if (isDark) {
      document.documentElement.setAttribute("data-theme", "dark");
      document.body.classList.add("dark-mode");
    } else {
      document.documentElement.removeAttribute("data-theme");
      document.body.classList.remove("dark-mode");
    }
    const btn = document.getElementById("theme-toggle-btn");
    if (btn) {
      btn.setAttribute("aria-pressed", String(isDark));
      btn.textContent = isDark ? "☀️ 라이트 모드" : "🌙 다크 모드";
    }
  }

  function toggleTheme() {
    appState.theme = appState.theme === "dark" ? "light" : "dark";
    saveState(appState);
    applyTheme();
  }

  function applyGlobalMasks() {
    document.body.classList.toggle("mask-kana-active", Boolean(appState.maskKana));
    document.body.classList.toggle("mask-meaning-active", Boolean(appState.maskMeaning));

    const kanaBtn = document.getElementById("btn-mask-kana");
    if (kanaBtn) {
      kanaBtn.setAttribute("aria-pressed", String(Boolean(appState.maskKana)));
      kanaBtn.classList.toggle("is-active", Boolean(appState.maskKana));
      kanaBtn.textContent = appState.maskKana ? "👁️ 히라가나 가림 해제" : "🙈 전체 히라가나 가림";
    }

    const meaningBtn = document.getElementById("btn-mask-meaning");
    if (meaningBtn) {
      meaningBtn.setAttribute("aria-pressed", String(Boolean(appState.maskMeaning)));
      meaningBtn.classList.toggle("is-active", Boolean(appState.maskMeaning));
      meaningBtn.textContent = appState.maskMeaning ? "👁️ 뜻 가림 해제" : "🙈 전체 뜻 가림";
    }
  }

  function toggleMask(type) {
    if (type === "kana") {
      appState.maskKana = !appState.maskKana;
    } else if (type === "meaning") {
      appState.maskMeaning = !appState.maskMeaning;
    }
    // 전체 가림 토글 시 개별 임시 공개 상태 초기화
    document.querySelectorAll(".is-revealed").forEach((el) => el.classList.remove("is-revealed"));
    saveState(appState);
    applyGlobalMasks();
  }

  function speakJapanese(text) {
    if (!text || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const cleanText = String(text).replace(/〜/g, "");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "ja-JP";
    utterance.rate = Number(appState.ttsRate) || 1.0;

    const voices = window.speechSynthesis.getVoices();
    const jaVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("ja"));
    if (jaVoice) utterance.voice = jaVoice;

    window.speechSynthesis.speak(utterance);
  }

  function highlightKeywordInExample(sentence, targetWord, targetKana) {
    const safeSentence = escapeHtml(sentence || "");
    const candidates = [targetWord, targetKana]
      .map((s) => (s || "").replace(/〜/g, "").trim())
      .filter((s) => s.length >= 1)
      .sort((a, b) => b.length - a.length);

    let result = safeSentence;
    for (const kw of candidates) {
      const escapedKw = escapeRegExp(kw);
      const regex = new RegExp(`(${escapedKw})`, "g");
      if (regex.test(result)) {
        result = result.replace(regex, '<mark class="target-keyword keyword-highlight" lang="ja">$1</mark>');
        break;
      }
    }
    return result;
  }

  // =========================================================
  // 탭 전환 & 외부(quiz.js 등) 연동 이벤트
  // =========================================================
  function switchTab(tabName) {
    if (!TAB_META[tabName]) return;
    studyState.activeTab = tabName;

    document.querySelectorAll(".nav-item").forEach((item) => {
      const isMatch = item.getAttribute("data-tab") === tabName;
      item.classList.toggle("active", isMatch);
      item.setAttribute("aria-selected", String(isMatch));
    });

    document.querySelectorAll(".tab-panel").forEach((panel) => {
      const isMatch = panel.getAttribute("data-tab-panel") === tabName;
      panel.hidden = !isMatch;
      panel.classList.toggle("active", isMatch);
    });

    const meta = TAB_META[tabName];
    const titleEl = document.getElementById("page-title");
    const subEl = document.getElementById("page-subtitle");
    if (titleEl) titleEl.textContent = meta.title;
    if (subEl) subEl.textContent = meta.subtitle;

    if (tabName === "dashboard") renderDashboard();
    if (tabName === "vocab") renderVocabTab();
    if (tabName === "flashcard") renderFlashcard();
    if (tabName === "wrong-note") {
      document.dispatchEvent(new CustomEvent("jlpt:render-wrong-note"));
    }
    if (tabName === "quiz-mcq" || tabName === "quiz-input") {
      document.dispatchEvent(new CustomEvent("jlpt:refresh-quiz-scopes"));
    }
  }

  function refreshAllViews() {
    renderDashboard();
    renderVocabTab();
    renderFlashcard();
    document.dispatchEvent(new CustomEvent("jlpt:refresh-quiz-scopes"));
    document.dispatchEvent(new CustomEvent("jlpt:render-wrong-note"));
  }

  // =========================================================
  // 1) 대시보드 렌더링 & 커스텀 단어장 / JSON 백업·복원·초기화
  // =========================================================
  function getStatsSummary() {
    const total = VOCAB_DB.length;
    let memorized = 0;
    let ambiguous = 0;
    let unmemorized = 0;
    let due = 0;

    VOCAB_DB.forEach((word) => {
      const st = getWordStatus(word.id);
      if (st === "외움") memorized += 1;
      else if (st === "헷갈림") ambiguous += 1;
      else unmemorized += 1;

      if (isDueForReview(word.id, appState)) due += 1;
    });

    const favoriteCount = appState.favorites.length;
    const totalWrongAttempts = Object.values(appState.wrongStats || {}).reduce(
      (acc, cur) => acc + (Number(cur?.count) || 0),
      0
    );
    const ratio = total > 0 ? Math.round((memorized / total) * 100) : 0;

    return {
      total,
      due,
      memorized,
      ambiguous,
      unmemorized,
      favoriteCount,
      totalWrongAttempts,
      ratio
    };
  }

  function renderDashboard() {
    const s = getStatsSummary();

    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(val);
    };

    setText("progress-text", `${s.ratio}%`);
    const fillEl = document.getElementById("progress-fill");
    if (fillEl) fillEl.style.width = `${s.ratio}%`;

    setText("due-review-count", s.due);
    setText("stat-total-count", s.total);
    setText("stat-due-count", s.due);
    setText("stat-memorized-count", s.memorized);
    setText("stat-ambiguous-count", s.ambiguous);
    setText("stat-unmemorized-count", s.unmemorized);
    setText("stat-favorite-count", s.favoriteCount);
    setText("stat-wrong-count", s.totalWrongAttempts);
    setText("custom-deck-count", `${appState.customDecks.length}개 단어장`);

    renderCustomDeckList();
    populateDeckSelects();
  }

  function createCustomDeck(name, wordIds = []) {
    const trimmed = String(name || "").trim();
    if (!trimmed) return null;
    const newDeck = {
      id: `deck_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      wordIds: [...new Set((wordIds || []).map(Number).filter(Number.isFinite))]
    };
    appState.customDecks.push(newDeck);
    saveState(appState);
    renderDashboard();
    renderVocabTab();
    document.dispatchEvent(new CustomEvent("jlpt:refresh-quiz-scopes"));
    return newDeck;
  }

  function renderCustomDeckList() {
    const listEl = document.getElementById("dashboard-deck-list");
    if (!listEl) return;

    if (!appState.customDecks.length) {
      listEl.innerHTML = `<li class="helper-text">아직 생성된 커스텀 단어장이 없습니다.</li>`;
      return;
    }

    listEl.innerHTML = appState.customDecks
      .map(
        (deck) => `
        <li class="custom-deck-item" data-deck-id="${escapeHtml(deck.id)}">
          <div>
            <strong>${escapeHtml(deck.name)}</strong>
            <span class="card-meta">(${deck.wordIds.length}개 단어)</span>
          </div>
          <div style="display:flex; gap:6px;">
            <button type="button" class="mini-btn deck-open-btn" data-deck-id="${escapeHtml(deck.id)}">단어장에서 보기</button>
            <button type="button" class="mini-btn deck-delete-btn" data-deck-id="${escapeHtml(deck.id)}">삭제</button>
          </div>
        </li>
      `
      )
      .join("");
  }

  function populateDeckSelects() {
    const vocabDeckFilter = document.getElementById("vocab-deck-filter");
    const batchDeckSelect = document.getElementById("vocab-batch-deck-select");

    if (vocabDeckFilter) {
      const prev = studyState.vocabDeckFilter;
      vocabDeckFilter.innerHTML =
        `<option value="ALL">전체 단어장</option>` +
        appState.customDecks
          .map((d) => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.name)} (${d.wordIds.length})</option>`)
          .join("");
      vocabDeckFilter.value = appState.customDecks.some((d) => d.id === prev) ? prev : "ALL";
    }

    if (batchDeckSelect) {
      const prevBatch = batchDeckSelect.value;
      batchDeckSelect.innerHTML =
        `<option value="__NEW__">+ 새 단어장 만들기</option>` +
        appState.customDecks
          .map((d) => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.name)}에 추가</option>`)
          .join("");
      if (prevBatch && [...batchDeckSelect.options].some((o) => o.value === prevBatch)) {
        batchDeckSelect.value = prevBatch;
      }
    }
  }

  function populateExamFilterOptions() {
    const select = document.getElementById("vocab-exam-filter");
    if (!select) return;
    const tagSet = new Set();
    VOCAB_DB.forEach((w) => {
      if (Array.isArray(w.examTags)) {
        w.examTags.forEach((t) => tagSet.add(t));
      }
      if (w.category) tagSet.add(w.category);
    });
    const sortedTags = [...tagSet].sort();
    select.innerHTML =
      `<option value="ALL">전체 기출/분류</option>` +
      sortedTags.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
  }

  // =========================================================
  // 2) 단어장 탭 렌더링 및 인터랙션
  // =========================================================
  function getFilteredAndSortedVocab() {
    let items = VOCAB_DB.slice();

    if (studyState.vocabExamFilter !== "ALL") {
      items = items.filter(
        (w) =>
          (Array.isArray(w.examTags) && w.examTags.includes(studyState.vocabExamFilter)) ||
          w.category === studyState.vocabExamFilter
      );
    }

    if (studyState.vocabStatusFilter !== "ALL") {
      items = items.filter((w) => getWordStatus(w.id) === studyState.vocabStatusFilter);
    }

    if (studyState.vocabDeckFilter !== "ALL") {
      const deck = appState.customDecks.find((d) => d.id === studyState.vocabDeckFilter);
      const idSet = new Set(deck ? deck.wordIds : []);
      items = items.filter((w) => idSet.has(w.id));
    }

    if (studyState.vocabFavoritesOnly) {
      const favSet = new Set(appState.favorites);
      items = items.filter((w) => favSet.has(w.id));
    }

    if (studyState.vocabDueOnly) {
      items = items.filter((w) => isDueForReview(w.id, appState));
    }

    const statusOrder = { 미암기: 0, 헷갈림: 1, 외움: 2 };
    if (studyState.vocabSort === "word-asc") {
      items.sort((a, b) => a.kana.localeCompare(b.kana, "ja"));
    } else if (studyState.vocabSort === "status") {
      items.sort((a, b) => statusOrder[getWordStatus(a.id)] - statusOrder[getWordStatus(b.id)]);
    } else if (studyState.vocabSort === "wrong-desc") {
      items.sort((a, b) => (appState.wrongStats[b.id]?.count || 0) - (appState.wrongStats[a.id]?.count || 0));
    }

    return items;
  }

  function renderVocabTab() {
    populateDeckSelects();
    const list = getFilteredAndSortedVocab();
    const container = document.getElementById("vocab-list-container");
    const countLabel = document.getElementById("vocab-result-count");
    const selectedBadge = document.getElementById("vocab-selected-count");
    const selectAllCb = document.getElementById("vocab-select-all");

    if (countLabel) countLabel.textContent = `총 ${list.length}개 단어`;
    if (selectedBadge) selectedBadge.textContent = `${studyState.vocabSelectedIds.size}개 선택됨`;

    if (selectAllCb) {
      selectAllCb.checked = list.length > 0 && list.every((w) => studyState.vocabSelectedIds.has(w.id));
    }

    if (!container) return;

    if (!list.length) {
      container.innerHTML = `<div class="card"><p class="helper-text">조건에 맞는 단어가 없습니다.</p></div>`;
      return;
    }

    container.innerHTML = list
      .map((item) => {
        const status = getWordStatus(item.id);
        const isFav = appState.favorites.includes(item.id);
        const isChecked = studyState.vocabSelectedIds.has(item.id);
        const dupLabel = formatDuplicateExamLabel(item.examTags);
        const hiraganaOnly = isHiraganaOnly(item.word);
        const memoVal = appState.posNotes[item.id] ?? item.pos ?? "";
        const nextDate = appState.progress[item.id]?.nextReviewDate || getTodayISO(0);

        return `
          <article class="vocab-item" data-word-id="${item.id}" data-hiragana-only="${hiraganaOnly}">
            <div>
              <input
                type="checkbox"
                class="vocab-row-checkbox"
                data-word-id="${item.id}"
                ${isChecked ? "checked" : ""}
                aria-label="${escapeHtml(item.word)} 선택"
              />
            </div>

            <div class="vocab-item-main">
              <div class="vocab-word-line">
                <span class="vocab-word ${hiraganaOnly ? "word-hiragana-only" : ""}" lang="ja">${escapeHtml(item.word)}</span>
                <span class="vocab-kana maskable mask-kana" lang="ja">${escapeHtml(item.kana)}</span>
                <span class="status-badge" data-status="${escapeHtml(status)}">${escapeHtml(status)}</span>
                ${dupLabel ? `<span class="dup-badge">${escapeHtml(dupLabel)}</span>` : ""}
              </div>

              <div class="vocab-meaning maskable mask-meaning">${escapeHtml(item.meaning)}</div>

              <div class="vocab-meta-line">
                <span class="pos-tag">${escapeHtml(item.pos || "품사 미지정")}</span>
                <span class="card-meta">다음 복습: ${escapeHtml(nextDate)}</span>
                <input
                  type="text"
                  class="pos-memo-input"
                  data-word-id="${item.id}"
                  value="${escapeHtml(memoVal)}"
                  placeholder="품사/학습 메모 입력"
                  aria-label="품사 및 학습 메모"
                />
                <button type="button" class="mini-btn save-memo-btn" data-word-id="${item.id}">메모 저장</button>
              </div>
            </div>

            <div class="vocab-item-actions">
              <button type="button" class="icon-btn vocab-tts-btn" data-speak="${escapeHtml(item.word)}" title="발음 듣기">🔊</button>
              <button
                type="button"
                class="icon-btn fav-toggle ${isFav ? "is-favorite" : ""}"
                data-word-id="${item.id}"
                aria-pressed="${isFav}"
                title="즐겨찾기"
              >
                ${isFav ? "★" : "☆"}
              </button>
              <select class="select-control vocab-status-select" data-word-id="${item.id}" aria-label="암기 상태 변경">
                <option value="미암기" ${status === "미암기" ? "selected" : ""}>미암기</option>
                <option value="헷갈림" ${status === "헷갈림" ? "selected" : ""}>헷갈림</option>
                <option value="외움" ${status === "외움" ? "selected" : ""}>외움</option>
              </select>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function applySrsUpdate(wordId, ratingOrStatus) {
    const prev = appState.progress[wordId] || null;
    appState.progress[wordId] = calculateNextSrs(prev, ratingOrStatus);
    saveState(appState);
    renderDashboard();
    if (studyState.activeTab === "vocab") renderVocabTab();
    if (studyState.activeTab === "flashcard") renderFlashcard();
  }

  function saveSelectedWordsToDeck(selectedIds, selectEl, newNameInput) {
    const ids = [...selectedIds];
    if (!ids.length) {
      alert("단어장에서 먼저 1개 이상 선택해 주세요.");
      return;
    }

    const chosenVal = selectEl ? selectEl.value : "__NEW__";
    const typedName = newNameInput ? newNameInput.value.trim() : "";

    if (chosenVal === "__NEW__") {
      const deckName = typedName || `선택 단어장 (${getTodayISO(0)})`;
      createCustomDeck(deckName, ids);
      if (newNameInput) newNameInput.value = "";
      alert(`"${deckName}" 단어장에 ${ids.length}개 단어를 저장했습니다.`);
    } else {
      const targetDeck = appState.customDecks.find((d) => d.id === chosenVal);
      if (targetDeck) {
        targetDeck.wordIds = [...new Set([...targetDeck.wordIds, ...ids])];
        saveState(appState);
        renderDashboard();
        renderVocabTab();
        document.dispatchEvent(new CustomEvent("jlpt:refresh-quiz-scopes"));
        alert(`"${targetDeck.name}" 단어장에 ${ids.length}개 단어를 추가했습니다.`);
      }
    }
  }

  // =========================================================
  // 3) 플래시카드 렌더링 (예문 하이라이트 · 한자 역추적 · 문법 · SRS)
  // =========================================================
  function buildFlashcardQueue() {
    let list = VOCAB_DB.slice();
    if (studyState.flashcardScope === "DUE") {
      list = list.filter((w) => isDueForReview(w.id, appState));
    } else if (studyState.flashcardScope === "FAVORITE") {
      const favSet = new Set(appState.favorites);
      list = list.filter((w) => favSet.has(w.id));
    } else if (["외움", "헷갈림", "미암기"].includes(studyState.flashcardScope)) {
      list = list.filter((w) => getWordStatus(w.id) === studyState.flashcardScope);
    }

    if (!list.length) {
      list = VOCAB_DB.slice();
    }

    studyState.flashcardQueue = list.map((w) => w.id);
    studyState.flashcardIndex = 0;
    studyState.flashcardFlipped = false;
    studyState.activeKanjiChar = null;
  }

  function shuffleFlashcardQueue() {
    if (!studyState.flashcardQueue.length) buildFlashcardQueue();
    const arr = studyState.flashcardQueue.slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    studyState.flashcardQueue = arr;
    studyState.flashcardIndex = 0;
    studyState.flashcardFlipped = false;
    studyState.activeKanjiChar = null;
    renderFlashcard();
  }

  function getCurrentFlashcardWord() {
    if (!studyState.flashcardQueue.length) buildFlashcardQueue();
    if (!studyState.flashcardQueue.length) return null;
    const safeIdx =
      ((studyState.flashcardIndex % studyState.flashcardQueue.length) + studyState.flashcardQueue.length) %
      studyState.flashcardQueue.length;
    studyState.flashcardIndex = safeIdx;
    const wordId = studyState.flashcardQueue[safeIdx];
    return VOCAB_DB.find((w) => w.id === wordId) || null;
  }

  function renderKanjiNetwork(wordObj) {
    const chipsEl = document.getElementById("fc-kanji-chips");
    const relatedEl = document.getElementById("fc-kanji-related-list");
    if (!chipsEl || !relatedEl) return;

    const kanjis = extractKanjiChars(wordObj.word);
    if (!kanjis.length) {
      chipsEl.innerHTML = `<span class="helper-text">히라가나 전용 표기로 역추적할 한자가 없습니다.</span>`;
      relatedEl.innerHTML = "";
      return;
    }

    if (!studyState.activeKanjiChar || !kanjis.includes(studyState.activeKanjiChar)) {
      studyState.activeKanjiChar = kanjis[0];
    }

    chipsEl.innerHTML = kanjis
      .map(
        (ch) => `
        <button
          type="button"
          class="kanji-chip ${studyState.activeKanjiChar === ch ? "active" : ""}"
          data-kanji-char="${escapeHtml(ch)}"
          lang="ja"
        >
          ${escapeHtml(ch)}
        </button>
      `
      )
      .join("");

    const related = findWordsByKanji(studyState.activeKanjiChar, wordObj.id);
    if (!related.length) {
      relatedEl.innerHTML = `<li class="helper-text">"${escapeHtml(studyState.activeKanjiChar)}" 포함 다른 등록 단어가 아직 없습니다.</li>`;
    } else {
      relatedEl.innerHTML = related
        .slice(0, 8)
        .map(
          (rw) => `
          <li class="kanji-related-item">
            <strong lang="ja">${escapeHtml(rw.word)}</strong>
            <span lang="ja">(${escapeHtml(rw.kana)})</span> - ${escapeHtml(rw.meaning)}
          </li>
        `
        )
        .join("");
    }
  }

  function renderGrammarExtension(wordObj) {
    const connBadge = document.getElementById("fc-grammar-connection");
    const compareBox = document.getElementById("fc-grammar-compare");
    if (!connBadge || !compareBox) return;

    if (wordObj.connection) {
      connBadge.hidden = false;
      connBadge.textContent = `접속 규칙: ${wordObj.connection}`;
    } else {
      connBadge.hidden = true;
      connBadge.textContent = "";
    }

    const compares = Array.isArray(wordObj.compareGrammar) ? wordObj.compareGrammar : [];
    if (compares.length) {
      compareBox.innerHTML = compares
        .map(
          (g) =>
            `<button type="button" class="grammar-compare-tag" data-compare-target="${escapeHtml(g)}">비교하기: ${escapeHtml(g)}</button>`
        )
        .join("");
    } else {
      compareBox.innerHTML = "";
    }
  }

  function renderFlashcard() {
    const wordObj = getCurrentFlashcardWord();
    const cardEl = document.getElementById("flashcard-card");
    const frontEl = document.getElementById("flashcard-front");
    const backEl = document.getElementById("flashcard-back");
    if (!wordObj || !cardEl || !frontEl || !backEl) return;

    const total = studyState.flashcardQueue.length;
    const idxText = document.getElementById("flashcard-index-label");
    if (idxText) idxText.textContent = `${studyState.flashcardIndex + 1} / ${total}`;

    const prog = appState.progress[wordObj.id];
    const nextReviewLabel = document.getElementById("flashcard-next-review-label");
    if (nextReviewLabel) {
      nextReviewLabel.textContent = `다음 복습: ${prog?.nextReviewDate || getTodayISO(0)} (간격 ${prog?.intervalDays || 1}일)`;
    }

    const hiraganaOnly = isHiraganaOnly(wordObj.word);
    cardEl.setAttribute("data-flipped", String(studyState.flashcardFlipped));
    cardEl.setAttribute("data-hiragana-only", String(hiraganaOnly));
    frontEl.hidden = studyState.flashcardFlipped;
    backEl.hidden = !studyState.flashcardFlipped;

    const dupBadge = document.getElementById("fc-duplicate-badge");
    const dupText = formatDuplicateExamLabel(wordObj.examTags);
    if (dupBadge) {
      dupBadge.hidden = !dupText;
      dupBadge.textContent = dupText || "";
    }

    const status = getWordStatus(wordObj.id);
    const statusBadge = document.getElementById("fc-status-badge");
    if (statusBadge) {
      statusBadge.setAttribute("data-status", status);
      statusBadge.textContent = status;
    }

    const favBtn = document.getElementById("fc-favorite-btn");
    const isFav = appState.favorites.includes(wordObj.id);
    if (favBtn) {
      favBtn.classList.toggle("is-favorite", isFav);
      favBtn.setAttribute("aria-pressed", String(isFav));
      favBtn.textContent = isFav ? "★" : "☆";
    }

    const wordWrap = document.getElementById("fc-word-display");
    if (wordWrap) {
      wordWrap.textContent = wordObj.word;
      wordWrap.classList.toggle("word-hiragana-only", hiraganaOnly);
    }

    const kanaWrap = document.getElementById("fc-kana-display");
    if (kanaWrap) {
      kanaWrap.textContent = wordObj.kana;
      kanaWrap.classList.remove("is-revealed");
    }

    const meaningEl = document.getElementById("fc-meaning-display");
    if (meaningEl) {
      meaningEl.textContent = wordObj.meaning;
      meaningEl.classList.remove("is-revealed");
    }

    const posEl = document.getElementById("fc-pos-display");
    if (posEl) {
      posEl.textContent = appState.posNotes[wordObj.id] || wordObj.pos || "";
    }

    const exSentEl = document.getElementById("fc-example-sentence");
    if (exSentEl) {
      exSentEl.innerHTML = highlightKeywordInExample(wordObj.example, wordObj.word, wordObj.kana);
    }

    const exKanaEl = document.getElementById("fc-example-kana");
    if (exKanaEl) {
      exKanaEl.textContent = wordObj.exampleKana || "";
      exKanaEl.hidden = !studyState.showExampleKana;
      exKanaEl.classList.remove("is-revealed");
    }

    const exMeaningEl = document.getElementById("fc-example-meaning");
    if (exMeaningEl) {
      exMeaningEl.textContent = wordObj.exampleMeaning || "";
      exMeaningEl.hidden = !studyState.showExampleMeaning;
      exMeaningEl.classList.remove("is-revealed");
    }

    const curSelectCb = document.getElementById("flashcard-current-select");
    if (curSelectCb) {
      curSelectCb.setAttribute("data-word-id", String(wordObj.id));
      curSelectCb.checked = studyState.flashcardSelectedIds.has(wordObj.id);
    }
    const selCountEl = document.getElementById("flashcard-selected-count");
    if (selCountEl) {
      selCountEl.textContent = `${studyState.flashcardSelectedIds.size}개 선택됨`;
    }

    renderKanjiNetwork(wordObj);
    renderGrammarExtension(wordObj);
  }

  function flipFlashcard(forceState = null) {
    studyState.flashcardFlipped = typeof forceState === "boolean" ? forceState : !studyState.flashcardFlipped;
    renderFlashcard();
  }

  function moveFlashcard(delta) {
    if (!studyState.flashcardQueue.length) return;
    studyState.flashcardIndex =
      (studyState.flashcardIndex + delta + studyState.flashcardQueue.length) % studyState.flashcardQueue.length;
    studyState.flashcardFlipped = false;
    studyState.activeKanjiChar = null;
    renderFlashcard();
  }

  // =========================================================
  // 전역 단축키 & 모달 & 이벤트 바인딩
  // =========================================================
  function openShortcutModal(forceOpen = null) {
    const modal = document.getElementById("shortcut-modal");
    if (!modal) return;
    const nextOpen = typeof forceOpen === "boolean" ? forceOpen : modal.hidden;
    modal.hidden = !nextOpen;
  }

  function handleGlobalKeydown(e) {
    const tag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : "";
    const isEditable =
      tag === "input" ||
      tag === "textarea" ||
      tag === "select" ||
      (e.target && e.target.isContentEditable);

    if (e.key === "Escape") {
      const modal = document.getElementById("shortcut-modal");
      if (modal && !modal.hidden) {
        e.preventDefault();
        openShortcutModal(false);
      }
      return;
    }

    if (isEditable) return;

    if (e.key === "?") {
      e.preventDefault();
      openShortcutModal();
      return;
    }

    if (e.key === "k" || e.key === "K") {
      e.preventDefault();
      toggleMask("kana");
      return;
    }

    if (e.key === "m" || e.key === "M") {
      e.preventDefault();
      toggleMask("meaning");
      return;
    }

    if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      const wordObj = getCurrentFlashcardWord();
      if (wordObj) speakJapanese(wordObj.word);
      return;
    }

    if (studyState.activeTab === "flashcard") {
      if (e.code === "Space" || e.key === "Enter") {
        e.preventDefault();
        flipFlashcard();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        moveFlashcard(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        moveFlashcard(1);
      } else if (e.key === "1" || e.key === "2" || e.key === "3") {
        const wordObj = getCurrentFlashcardWord();
        if (!wordObj) return;
        e.preventDefault();
        const ratingMap = { "1": "모름", "2": "애매함", "3": "완벽함" };
        applySrsUpdate(wordObj.id, ratingMap[e.key]);
        moveFlashcard(1);
      }
    }
  }

  function bindEvents() {
    // 탭 내비게이션
    document.querySelectorAll(".nav-item[data-tab]").forEach((item) => {
      item.addEventListener("click", () => {
        switchTab(item.getAttribute("data-tab"));
      });
    });

    // 대시보드 stat / 빠른 이동 버튼
    document.addEventListener("click", (e) => {
      const target = e.target.closest("[data-jump-tab]");
      if (!target) return;
      const tab = target.getAttribute("data-jump-tab");
      const statusFilter = target.getAttribute("data-filter-status");
      const favFilter = target.getAttribute("data-filter-favorite");
      const preset = target.getAttribute("data-filter-preset");

      if (tab === "vocab") {
        studyState.vocabStatusFilter = statusFilter || "ALL";
        studyState.vocabFavoritesOnly = favFilter === "true";
        studyState.vocabDueOnly = false;
        const stSel = document.getElementById("vocab-status-filter");
        const favCb = document.getElementById("vocab-favorites-only");
        const dueCb = document.getElementById("vocab-due-only");
        if (stSel) stSel.value = studyState.vocabStatusFilter;
        if (favCb) favCb.checked = studyState.vocabFavoritesOnly;
        if (dueCb) dueCb.checked = false;
      }

      if (tab === "flashcard" && preset === "due") {
        studyState.flashcardScope = "DUE";
        const fcScope = document.getElementById("flashcard-scope-select");
        if (fcScope) fcScope.value = "DUE";
        buildFlashcardQueue();
      }

      switchTab(tab);
    });

    // 상단 오늘 복습 배지 클릭
    document.getElementById("due-review-badge")?.addEventListener("click", () => {
      studyState.flashcardScope = "DUE";
      const fcScope = document.getElementById("flashcard-scope-select");
      if (fcScope) fcScope.value = "DUE";
      buildFlashcardQueue();
      switchTab("flashcard");
    });

    // 상단 툴바: 테마, 가림 토글, TTS 속도, 단축키, 백업 섹션 점프
    document.getElementById("theme-toggle-btn")?.addEventListener("click", toggleTheme);
    document.getElementById("btn-mask-kana")?.addEventListener("click", () => toggleMask("kana"));
    document.getElementById("btn-mask-meaning")?.addEventListener("click", () => toggleMask("meaning"));

    document.getElementById("tts-rate-select")?.addEventListener("change", (e) => {
      const val = Number(e.target.value);
      appState.ttsRate = Number.isFinite(val) ? val : 1.0;
      saveState(appState);
    });

    document.getElementById("btn-open-shortcuts")?.addEventListener("click", () => openShortcutModal(true));
    document.getElementById("btn-close-shortcuts")?.addEventListener("click", () => openShortcutModal(false));
    document.getElementById("shortcut-modal")?.addEventListener("click", (e) => {
      if (e.target.id === "shortcut-modal") openShortcutModal(false);
    });

    document.getElementById("btn-jump-backup")?.addEventListener("click", () => {
      switchTab("dashboard");
      setTimeout(() => {
        document.getElementById("data-management-section")?.scrollIntoView({ behavior: "smooth" });
      }, 60);
    });

    // 가려진 요소 클릭 시 개별 임시 공개
    document.addEventListener("click", (e) => {
      const maskEl = e.target.closest(".maskable");
      if (maskEl && (document.body.classList.contains("mask-kana-active") || document.body.classList.contains("mask-meaning-active"))) {
        maskEl.classList.toggle("is-revealed");
      }
    });

    // 커스텀 단어장 생성 & 목록 액션
    document.getElementById("create-deck-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.getElementById("new-deck-name-input");
      if (!input || !input.value.trim()) return;
      createCustomDeck(input.value.trim(), []);
      input.value = "";
    });

    document.getElementById("dashboard-deck-list")?.addEventListener("click", (e) => {
      const openBtn = e.target.closest(".deck-open-btn");
      if (openBtn) {
        const deckId = openBtn.getAttribute("data-deck-id");
        studyState.vocabDeckFilter = deckId;
        switchTab("vocab");
        const sel = document.getElementById("vocab-deck-filter");
        if (sel) sel.value = deckId;
        return;
      }

      const delBtn = e.target.closest(".deck-delete-btn");
      if (delBtn) {
        const deckId = delBtn.getAttribute("data-deck-id");
        appState.customDecks = appState.customDecks.filter((d) => d.id !== deckId);
        if (studyState.vocabDeckFilter === deckId) studyState.vocabDeckFilter = "ALL";
        saveState(appState);
        renderDashboard();
        renderVocabTab();
        document.dispatchEvent(new CustomEvent("jlpt:refresh-quiz-scopes"));
      }
    });

    // JSON 내보내기 / 가져오기 / 전체 초기화
    const statusMsg = document.getElementById("data-action-status");
    document.getElementById("btn-export-json")?.addEventListener("click", () => {
      exportStateToJson(appState);
      if (statusMsg) statusMsg.textContent = "학습 데이터 JSON 파일이 다운로드되었습니다.";
    });

    document.getElementById("import-json-input")?.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const res = importStateFromJson(String(reader.result || ""));
        if (res.ok) {
          appState = res.state;
          applyTheme();
          applyGlobalMasks();
          const rateSel = document.getElementById("tts-rate-select");
          if (rateSel) rateSel.value = String(appState.ttsRate);
          buildFlashcardQueue();
          refreshAllViews();
          if (statusMsg) statusMsg.textContent = "JSON 백업 데이터를 성공적으로 복원했습니다.";
        } else if (statusMsg) {
          statusMsg.textContent = res.error;
        }
        e.target.value = "";
      };
      reader.readAsText(file, "utf-8");
    });

    document.getElementById("btn-reset-all-data")?.addEventListener("click", () => {
      if (!confirm("모든 학습 진도, 오답 기록, 커스텀 단어장, 메모를 초기화할까요?")) return;
      appState = resetAllData();
      studyState.vocabSelectedIds.clear();
      studyState.flashcardSelectedIds.clear();
      applyTheme();
      applyGlobalMasks();
      const rateSel = document.getElementById("tts-rate-select");
      if (rateSel) rateSel.value = String(appState.ttsRate);
      buildFlashcardQueue();
      refreshAllViews();
      if (statusMsg) statusMsg.textContent = "모든 학습 데이터가 초기화되었습니다.";
    });

    // 단어장 필터·정렬·선택 이벤트
    document.getElementById("vocab-exam-filter")?.addEventListener("change", (e) => {
      studyState.vocabExamFilter = e.target.value;
      renderVocabTab();
    });
    document.getElementById("vocab-status-filter")?.addEventListener("change", (e) => {
      studyState.vocabStatusFilter = e.target.value;
      renderVocabTab();
    });
    document.getElementById("vocab-deck-filter")?.addEventListener("change", (e) => {
      studyState.vocabDeckFilter = e.target.value;
      renderVocabTab();
    });
    document.getElementById("vocab-sort-select")?.addEventListener("change", (e) => {
      studyState.vocabSort = e.target.value;
      renderVocabTab();
    });
    document.getElementById("vocab-favorites-only")?.addEventListener("change", (e) => {
      studyState.vocabFavoritesOnly = e.target.checked;
      renderVocabTab();
    });
    document.getElementById("vocab-due-only")?.addEventListener("change", (e) => {
      studyState.vocabDueOnly = e.target.checked;
      renderVocabTab();
    });

    document.getElementById("vocab-select-all")?.addEventListener("change", (e) => {
      const checked = e.target.checked;
      const currentItems = getFilteredAndSortedVocab();
      if (checked) {
        currentItems.forEach((w) => studyState.vocabSelectedIds.add(w.id));
      } else {
        currentItems.forEach((w) => studyState.vocabSelectedIds.delete(w.id));
      }
      renderVocabTab();
    });

    document.getElementById("vocab-list-container")?.addEventListener("change", (e) => {
      const cb = e.target.closest(".vocab-row-checkbox");
      if (cb) {
        const id = Number(cb.getAttribute("data-word-id"));
        if (cb.checked) studyState.vocabSelectedIds.add(id);
        else studyState.vocabSelectedIds.delete(id);
        const badge = document.getElementById("vocab-selected-count");
        if (badge) badge.textContent = `${studyState.vocabSelectedIds.size}개 선택됨`;
        return;
      }

      const stSel = e.target.closest(".vocab-status-select");
      if (stSel) {
        const id = Number(stSel.getAttribute("data-word-id"));
        applySrsUpdate(id, stSel.value);
      }
    });

    document.getElementById("vocab-list-container")?.addEventListener("click", (e) => {
      const ttsBtn = e.target.closest(".vocab-tts-btn");
      if (ttsBtn) {
        speakJapanese(ttsBtn.getAttribute("data-speak"));
        return;
      }

      const favBtn = e.target.closest(".fav-toggle");
      if (favBtn) {
        const id = Number(favBtn.getAttribute("data-word-id"));
        const idx = appState.favorites.indexOf(id);
        if (idx >= 0) appState.favorites.splice(idx, 1);
        else appState.favorites.push(id);
        saveState(appState);
        renderDashboard();
        renderVocabTab();
        return;
      }

      const memoBtn = e.target.closest(".save-memo-btn");
      if (memoBtn) {
        const id = Number(memoBtn.getAttribute("data-word-id"));
        const input = document.querySelector(`.pos-memo-input[data-word-id="${id}"]`);
        if (input) {
          appState.posNotes[id] = input.value.trim();
          saveState(appState);
          memoBtn.textContent = "저장됨";
          setTimeout(() => {
            memoBtn.textContent = "메모 저장";
          }, 900);
        }
      }
    });

    document.getElementById("btn-vocab-save-to-deck")?.addEventListener("click", () => {
      saveSelectedWordsToDeck(
        studyState.vocabSelectedIds,
        document.getElementById("vocab-batch-deck-select"),
        document.getElementById("vocab-batch-new-deck-name")
      );
    });

    // 플래시카드 이벤트
    document.getElementById("flashcard-scope-select")?.addEventListener("change", (e) => {
      studyState.flashcardScope = e.target.value;
      buildFlashcardQueue();
      renderFlashcard();
    });

    document.getElementById("btn-flashcard-shuffle")?.addEventListener("click", shuffleFlashcardQueue);
    document.getElementById("btn-flashcard-flip")?.addEventListener("click", () => flipFlashcard());
    document.getElementById("flashcard-card")?.addEventListener("click", (e) => {
      if (e.target.closest("button, input, select, .maskable")) return;
      flipFlashcard();
    });

    document.getElementById("btn-flashcard-tts")?.addEventListener("click", () => {
      const w = getCurrentFlashcardWord();
      if (w) speakJapanese(w.word);
    });

    document.getElementById("btn-play-example-tts")?.addEventListener("click", () => {
      const w = getCurrentFlashcardWord();
      if (w) speakJapanese(w.example);
    });

    document.getElementById("btn-toggle-example-kana")?.addEventListener("click", () => {
      studyState.showExampleKana = !studyState.showExampleKana;
      renderFlashcard();
    });

    document.getElementById("btn-toggle-example-meaning")?.addEventListener("click", () => {
      studyState.showExampleMeaning = !studyState.showExampleMeaning;
      renderFlashcard();
    });

    document.getElementById("fc-favorite-btn")?.addEventListener("click", () => {
      const w = getCurrentFlashcardWord();
      if (!w) return;
      const idx = appState.favorites.indexOf(w.id);
      if (idx >= 0) appState.favorites.splice(idx, 1);
      else appState.favorites.push(w.id);
      saveState(appState);
      renderDashboard();
      renderFlashcard();
    });

    document.getElementById("flashcard-current-select")?.addEventListener("change", (e) => {
      const id = Number(e.target.getAttribute("data-word-id"));
      if (!id) return;
      if (e.target.checked) studyState.flashcardSelectedIds.add(id);
      else studyState.flashcardSelectedIds.delete(id);
      const badge = document.getElementById("flashcard-selected-count");
      if (badge) badge.textContent = `${studyState.flashcardSelectedIds.size}개 선택됨`;
    });

    document.getElementById("btn-flashcard-save-deck")?.addEventListener("click", () => {
      const nameInput = document.getElementById("flashcard-new-deck-name");
      saveSelectedWordsToDeck(studyState.flashcardSelectedIds, null, nameInput);
    });

    document.getElementById("fc-kanji-chips")?.addEventListener("click", (e) => {
      const chip = e.target.closest(".kanji-chip");
      if (!chip) return;
      studyState.activeKanjiChar = chip.getAttribute("data-kanji-char");
      const w = getCurrentFlashcardWord();
      if (w) renderKanjiNetwork(w);
    });

    document.getElementById("fc-srs-controls")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".srs-btn");
      if (!btn) return;
      const w = getCurrentFlashcardWord();
      if (!w) return;
      const rating = btn.getAttribute("data-srs");
      applySrsUpdate(w.id, rating);
      moveFlashcard(1);
    });

    document.getElementById("btn-fc-prev")?.addEventListener("click", () => moveFlashcard(-1));
    document.getElementById("btn-fc-next")?.addEventListener("click", () => moveFlashcard(1));

    // 외부(quiz.js 등)에서 상태 저장 요청 수신
    document.addEventListener("jlpt:state-updated", () => {
      appState = loadState();
      renderDashboard();
      if (studyState.activeTab === "vocab") renderVocabTab();
      if (studyState.activeTab === "flashcard") renderFlashcard();
    });

    document.addEventListener("keydown", handleGlobalKeydown);
  }

  function init() {
    const ddayEl = document.getElementById("dday-badge");
    if (ddayEl) ddayEl.textContent = computeDdayText(EXAM_DATE);

    const rateSel = document.getElementById("tts-rate-select");
    if (rateSel) rateSel.value = String(appState.ttsRate);

    applyTheme();
    applyGlobalMasks();
    populateExamFilterOptions();
    buildFlashcardQueue();
    bindEvents();
    refreshAllViews();
  }

  document.addEventListener("DOMContentLoaded", init);

  // quiz.js 및 외부 모듈 연동용 공개 인터페이스
  window.JLPTStudy = {
    getState: () => appState,
    reloadState: () => {
      appState = loadState();
      return appState;
    },
    switchTab,
    refreshAllViews,
    speakJapanese
  };
})();