(() => {
  "use strict";

  const DATA = window.JLPTData;
  if (!DATA) {
    console.error("window.JLPTData가 로드되지 않았습니다. data.js 로드 순서를 확인하세요.");
    return;
  }

  const VOCAB_PAGE_SIZE = 50;

  // =========================================================
  // Google Cloud TTS (ja-JP) 설정 및 재생 상태
  // =========================================================
  const GOOGLE_TTS_CONFIG = {
    // 개인 학습용으로 쓰실 때만 넣으시고, Google Cloud Console에서
    // 'HTTP 리퍼러(웹사이트)' 제한과 '사용량 한도'를 꼭 설정하세요.
    apiKey: "YOUR_GOOGLE_CLOUD_TTS_API_KEY",
    languageCode: "AIzaSyBLH3EVqlHYvNLxHB7q9HYTrfV1uOzvAU4",
    voiceName: "ja-JP-Neural2-B", // 여성 내레이션/아나운서 톤 (남성 톤: "ja-JP-Neural2-C" / "ja-JP-Neural2-D")
    audioEncoding: "MP3",
    enableCache: true,
    maxCacheSize: 200
  };

  let currentGoogleAudio = null;
  let googlePlayToken = 0;
  const googleAudioCache = new Map(); // key -> blobUrl

  let appState = DATA.loadState();

  // 메인 탭 및 서브 탭 상태
  let activeMainTab = "main-dashboard";
  let activeVocabSubTab = "vocab-dashboard";
  let activeGrammarSubTab = "grammar-dashboard";
  let activeReadingCategory = "ALL"; // "ALL" | "단문" | "중문" | "장문" | "통합이해" | "정보검색" | "TIPS"
  let selectedReadingId = DATA.READING_DB?.[0]?.id ?? null;
  let readingShowTranslation = false;

  // 단어장 지연 렌더링 & 다중 선택 상태
  let vocabRenderedCount = VOCAB_PAGE_SIZE;
  let vocabInitialized = false;
  let selectedVocabIds = new Set();

  // 어휘 플래시카드 상태
  let fcScope = "ALL";
  let fcDeck = [];
  let fcIndex = 0;
  let fcFlipped = false;
  let fcShowExKana = false;
  let fcShowExMeaning = false;
  let fcActiveKanji = null;

  // 문법 플래시카드 상태
  let gfcScope = "ALL";
  let gfcDeck = [];
  let gfcIndex = 0;
  let gfcFlipped = false;

  // =========================================================
  // 1. 공통 유틸리티 (이스케이프, Google Cloud TTS, D-Day, 테마, 전역 가림)
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

  function highlightKeywordInHtml(text, keyword) {
    const safeText = escapeHtml(text || "");
    const kw = String(keyword || "").trim();
    if (!kw) return safeText;
    try {
      const regex = new RegExp(`(${escapeRegExp(kw)})`, "g");
      return safeText.replace(regex, '<mark class="kw-highlight" lang="ja">$1</mark>');
    } catch (_) {
      return safeText;
    }
  }

  function stopGoogleOrBrowserTts() {
    if (currentGoogleAudio) {
      try {
        currentGoogleAudio.pause();
        currentGoogleAudio.currentTime = 0;
      } catch (_) {}
      currentGoogleAudio = null;
    }
    if (typeof window.speechSynthesis !== "undefined") {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }
  }

  function fallbackBrowserSpeak(text, rate = 1.0) {
    if (typeof window.speechSynthesis === "undefined") return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "ja-JP";
      utter.rate = Number.isFinite(Number(rate)) ? Number(rate) : 1.0;
      const voices = window.speechSynthesis.getVoices();
      const jaVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("ja"));
      if (jaVoice) utter.voice = jaVoice;
      window.speechSynthesis.speak(utter);
    } catch (_) {
      // TTS 미지원 환경 무시
    }
  }

  function cacheGoogleAudioUrl(key, blobUrl) {
    if (!GOOGLE_TTS_CONFIG.enableCache) return;
    if (googleAudioCache.has(key)) {
      const oldUrl = googleAudioCache.get(key);
      googleAudioCache.delete(key);
      googleAudioCache.set(key, oldUrl);
      return;
    }
    if (googleAudioCache.size >= GOOGLE_TTS_CONFIG.maxCacheSize) {
      const oldestKey = googleAudioCache.keys().next().value;
      const oldestUrl = googleAudioCache.get(oldestKey);
      googleAudioCache.delete(oldestKey);
      if (oldestUrl) {
        setTimeout(() => URL.revokeObjectURL(oldestUrl), 1000);
      }
    }
    googleAudioCache.set(key, blobUrl);
  }

  async function fetchGoogleJapaneseTtsBlob(text, speakingRate = 1.0) {
    const apiKey = String(GOOGLE_TTS_CONFIG.apiKey || "").trim();
    if (!apiKey || apiKey === "YOUR_GOOGLE_CLOUD_TTS_API_KEY") {
      throw new Error("Google Cloud TTS API 키가 설정되지 않았습니다.");
    }

    const clampedRate = Math.max(0.25, Math.min(4.0, Number(speakingRate) || 1.0));
    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(
      apiKey
    )}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode: GOOGLE_TTS_CONFIG.languageCode,
          name: GOOGLE_TTS_CONFIG.voiceName
        },
        audioConfig: {
          audioEncoding: GOOGLE_TTS_CONFIG.audioEncoding,
          speakingRate: clampedRate
        }
      })
    });

    if (!res.ok) {
      throw new Error(`Google TTS 요청 실패 (HTTP ${res.status})`);
    }

    const data = await res.json();
    if (!data || !data.audioContent) {
      throw new Error("Google TTS 응답에 audioContent가 없습니다.");
    }

    const binaryStr = atob(data.audioContent);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i += 1) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    return new Blob([bytes], { type: "audio/mpeg" });
  }

  function playGoogleBlobUrl(blobUrl, token) {
    if (token !== googlePlayToken) return;
    const audio = new Audio(blobUrl);
    currentGoogleAudio = audio;
    audio.play().catch(() => {
      // 브라우저 자동재생 제한 등 예외 무시
    });
  }

  async function speakJapanese(text, rate = appState.ttsRate) {
    const cleanText = String(text || "").replace(/〜/g, "").trim();
    if (!cleanText) return;

    const token = ++googlePlayToken;
    stopGoogleOrBrowserTts();

    const numericRate = Number.isFinite(Number(rate)) ? Number(rate) : 1.0;
    const cacheKey = `${GOOGLE_TTS_CONFIG.voiceName}::${numericRate}::${cleanText}`;

    if (GOOGLE_TTS_CONFIG.enableCache && googleAudioCache.has(cacheKey)) {
      const cachedUrl = googleAudioCache.get(cacheKey);
      cacheGoogleAudioUrl(cacheKey, cachedUrl);
      playGoogleBlobUrl(cachedUrl, token);
      return;
    }

    try {
      const blob = await fetchGoogleJapaneseTtsBlob(cleanText, numericRate);
      if (token !== googlePlayToken) return;

      const blobUrl = URL.createObjectURL(blob);
      cacheGoogleAudioUrl(cacheKey, blobUrl);
      playGoogleBlobUrl(blobUrl, token);
    } catch (err) {
      console.warn("Google TTS 재생 실패, 브라우저 기본 TTS로 폴백합니다:", err);
      if (token === googlePlayToken) {
        fallbackBrowserSpeak(cleanText, numericRate);
      }
    }
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(val);
  }

  function setBarWidth(id, pct) {
    const el = document.getElementById(id);
    if (el) el.style.width = `${Math.max(0, Math.min(100, Number(pct) || 0))}%`;
  }

  function getItemStatus(itemId) {
    const rec = appState.progress[String(itemId)];
    return rec ? DATA.normalizeStatus(rec.status) : "미학습";
  }

  function updateDdayBadge() {
    const badge = document.getElementById("dday-badge");
    if (!badge) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exam = new Date(`${DATA.EXAM_DATE}T00:00:00`);
    const diffDays = Math.ceil((exam.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 0) badge.textContent = `D-${diffDays}`;
    else if (diffDays === 0) badge.textContent = "D-Day";
    else badge.textContent = `D+${Math.abs(diffDays)}`;
  }

  function applyThemeAndGlobalMasks() {
    const isDark = appState.theme === "dark";
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    document.body.classList.toggle("dark-mode", isDark);
    document.body.classList.toggle("mask-kana-active", Boolean(appState.maskKana));
    document.body.classList.toggle("mask-meaning-active", Boolean(appState.maskMeaning));

    const themeBtn = document.getElementById("theme-toggle-btn");
    if (themeBtn) {
      themeBtn.setAttribute("aria-pressed", String(isDark));
      themeBtn.textContent = isDark ? "☀️ 라이트 모드" : "🌙 다크 모드";
    }

    const kanaBtn = document.getElementById("mask-kana-btn");
    if (kanaBtn) {
      kanaBtn.setAttribute("aria-pressed", String(Boolean(appState.maskKana)));
      kanaBtn.textContent = appState.maskKana ? "👀 히라가나 보이기" : "🙈 히라가나 가림";
    }

    const meaningBtn = document.getElementById("mask-meaning-btn");
    if (meaningBtn) {
      meaningBtn.setAttribute("aria-pressed", String(Boolean(appState.maskMeaning)));
      meaningBtn.textContent = appState.maskMeaning ? "👀 뜻 보이기" : "👁️ 뜻 가림";
    }

    const rateSelect = document.getElementById("tts-rate-select");
    if (rateSelect) {
      rateSelect.value = String(appState.ttsRate);
    }
  }

  function persistState() {
    appState = DATA.saveState(appState);
    applyThemeAndGlobalMasks();
    renderMainDashboard();
  }

  function refreshAllViews() {
    appState = DATA.loadState();
    applyThemeAndGlobalMasks();
    renderMainDashboard();
    if (activeMainTab === "vocab-section") {
      if (activeVocabSubTab === "vocab-dashboard") renderVocabDashboard();
      else if (activeVocabSubTab === "vocab-list") renderVocabList();
      else if (activeVocabSubTab === "vocab-flashcard") renderFlashcard();
      else if (activeVocabSubTab === "vocab-wrong") renderWrongNotes();
    } else if (activeMainTab === "grammar-section") {
      if (activeGrammarSubTab === "grammar-dashboard") renderGrammarDashboard();
      else if (activeGrammarSubTab === "grammar-list") renderGrammarList();
      else if (activeGrammarSubTab === "grammar-flashcard") renderGrammarFlashcard();
    } else if (activeMainTab === "reading-section") {
      renderReadingSection();
    }
  }

  // =========================================================
  // 2. 탭 전환 (메인 5대 탭 / 문자·어휘 서브탭 / 문법 서브탭)
  // =========================================================
  function switchMainTab(tabName, options = {}) {
    const validTabs = [
      "main-dashboard",
      "vocab-section",
      "grammar-section",
      "reading-section",
      "guide-section"
    ];
    if (!validTabs.includes(tabName)) return;

    activeMainTab = tabName;

    document.querySelectorAll(".nav-item[data-main-tab]").forEach((btn) => {
      const isActive = btn.getAttribute("data-main-tab") === tabName;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
    });

    document.querySelectorAll(".main-panel").forEach((panel) => {
      const isTarget = panel.id === `panel-${tabName}`;
      panel.classList.toggle("active", isTarget);
      panel.hidden = !isTarget;
    });

    if (tabName === "main-dashboard") {
      renderMainDashboard();
    } else if (tabName === "vocab-section") {
      switchVocabSubTab(options.vocabSubTab || "vocab-dashboard", options);
    } else if (tabName === "grammar-section") {
      switchGrammarSubTab(options.grammarSubTab || "grammar-dashboard", options);
    } else if (tabName === "reading-section") {
      if (options.readingCategory) {
        switchReadingCategory(options.readingCategory);
      } else {
        renderReadingSection();
      }
    }

    document.dispatchEvent(
      new CustomEvent("jlpt:main-tab-changed", { detail: { tabId: tabName } })
    );

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function switchVocabSubTab(subTabName, options = {}) {
    const validSubTabs = [
      "vocab-dashboard",
      "vocab-list",
      "vocab-flashcard",
      "vocab-quiz",
      "vocab-wrong"
    ];
    if (!validSubTabs.includes(subTabName)) subTabName = "vocab-dashboard";

    activeVocabSubTab = subTabName;

    document.querySelectorAll(".sub-tab-item[data-vocab-subtab]").forEach((btn) => {
      const isActive = btn.getAttribute("data-vocab-subtab") === subTabName;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
    });

    document.querySelectorAll(".vocab-subpanel").forEach((panel) => {
      const isTarget = panel.id === `subpanel-${subTabName}`;
      panel.classList.toggle("active", isTarget);
      panel.hidden = !isTarget;
    });

    if (subTabName === "vocab-dashboard") {
      renderVocabDashboard();
    } else if (subTabName === "vocab-list") {
      if (!vocabInitialized) {
        populateVocabFilterOptions();
        vocabInitialized = true;
      }
      if (options.resetPage !== false) {
        vocabRenderedCount = VOCAB_PAGE_SIZE;
      }
      renderVocabList();
    } else if (subTabName === "vocab-flashcard") {
      if (options.scope) {
        fcScope = options.scope;
        const scopeEl = document.getElementById("fc-scope-select");
        if (scopeEl) scopeEl.value = fcScope;
      }
      buildFlashcardDeck(Boolean(options.shuffle));
      renderFlashcard();
    } else if (subTabName === "vocab-wrong") {
      renderWrongNotes();
    } else if (subTabName === "vocab-quiz" && typeof window.JLPTQuiz?.onEnterQuizTab === "function") {
      window.JLPTQuiz.onEnterQuizTab();
    }
  }

  function switchGrammarSubTab(subTabName, options = {}) {
    const validSubTabs = [
      "grammar-dashboard",
      "grammar-list",
      "grammar-flashcard",
      "grammar-quiz"
    ];
    if (!validSubTabs.includes(subTabName)) subTabName = "grammar-dashboard";

    activeGrammarSubTab = subTabName;

    document.querySelectorAll(".sub-tab-item[data-grammar-subtab]").forEach((btn) => {
      const isActive = btn.getAttribute("data-grammar-subtab") === subTabName;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
    });

    document.querySelectorAll(".grammar-subpanel").forEach((panel) => {
      const isTarget = panel.id === `subpanel-${subTabName}`;
      panel.classList.toggle("active", isTarget);
      panel.hidden = !isTarget;
    });

    if (subTabName === "grammar-dashboard") {
      renderGrammarDashboard();
    } else if (subTabName === "grammar-list") {
      renderGrammarList();
    } else if (subTabName === "grammar-flashcard") {
      if (options.scope) {
        gfcScope = options.scope;
        const sel = document.getElementById("gfc-scope-select");
        if (sel) sel.value = gfcScope;
      }
      buildGrammarFlashcardDeck(Boolean(options.shuffle));
      renderGrammarFlashcard();
    } else if (subTabName === "grammar-quiz") {
      if (options.autoStartCount && typeof window.JLPTQuiz?.startGrammarQuiz === "function") {
        window.JLPTQuiz.startGrammarQuiz(options.autoStartCount, "grammar-quiz-runner");
      }
    }
  }

  function switchTab(legacyOrMainTab) {
    if (legacyOrMainTab === "quiz-mcq" || legacyOrMainTab === "quiz-input") {
      switchMainTab("vocab-section", { vocabSubTab: "vocab-quiz" });
      return;
    }
    if (legacyOrMainTab === "wrong-note") {
      switchMainTab("vocab-section", { vocabSubTab: "vocab-wrong" });
      return;
    }
    if (legacyOrMainTab === "flashcard") {
      switchMainTab("vocab-section", { vocabSubTab: "vocab-flashcard" });
      return;
    }
    if (legacyOrMainTab === "vocab") {
      switchMainTab("vocab-section", { vocabSubTab: "vocab-list" });
      return;
    }
    if (legacyOrMainTab === "grammar") {
      switchMainTab("grammar-section", { grammarSubTab: "grammar-dashboard" });
      return;
    }
    if (legacyOrMainTab === "reading") {
      switchMainTab("reading-section");
      return;
    }
    if (legacyOrMainTab === "guide") {
      switchMainTab("guide-section");
      return;
    }
    switchMainTab("main-dashboard");
  }

  // =========================================================
  // 3. 통합 대시보드 & 어휘 대시보드 렌더링
  // =========================================================
  function renderMainDashboard() {
    const summary = DATA.getOverallStatsSummary(appState);

    setText("overall-progress-text", `${summary.overallRate}%`);
    setBarWidth("overall-progress-fill", summary.overallRate);

    setText("dash-vocab-rate", `${summary.vocab.rate}%`);
    setText("dash-vocab-learned", summary.vocab.learned);
    setText("dash-vocab-total", summary.vocab.total);
    setBarWidth("dash-vocab-bar", summary.vocab.rate);

    setText("dash-grammar-rate", `${summary.grammar.rate}%`);
    setText("dash-grammar-learned", summary.grammar.learned);
    setText("dash-grammar-total", summary.grammar.total);
    setBarWidth("dash-grammar-bar", summary.grammar.rate);

    const readingDone =
      summary.readingDone !== undefined ? summary.readingDone : summary.reading.completed;
    const readingTotal =
      summary.readingTotal !== undefined ? summary.readingTotal : summary.reading.total;
    const weakReading =
      summary.weakReading !== undefined ? summary.weakReading : summary.reading.incomplete;

    setText("dash-reading-rate", `${summary.reading.rate}%`);
    setText("dash-reading-done", readingDone);
    setText("dash-reading-total", readingTotal);
    setBarWidth("dash-reading-bar", summary.reading.rate);

    setText("dash-due-total", `${summary.totalDue}개`);
    setText("dash-due-vocab", summary.vocab.due);
    setText("dash-due-grammar", summary.grammar.due);

    setText("dash-weak-ambiguous", summary.weak.ambiguousVocab);
    setText("dash-weak-wrong", summary.weak.totalWrongRecords);
    setText("dash-weak-reading", weakReading);
  }

  function renderVocabDashboard() {
    const stats = DATA.getVocabStatsSummary(appState);
    setText("stat-vocab-total", stats.total);
    setText("stat-vocab-due", stats.due);
    setText("stat-vocab-learned", stats.learned);
    setText("stat-vocab-ambiguous", stats.ambiguous);
    setText("stat-vocab-unknown", stats.unknown);
    setText("stat-vocab-unlearned", stats.unlearned);
    setText("stat-vocab-favorite", stats.favorite);
    setText("stat-vocab-wrong", stats.wrong);

    renderCustomDecksList();
    syncDeckSelectOptions();
  }

  function renderCustomDecksList() {
    const ul = document.getElementById("custom-deck-list");
    if (!ul) return;
    if (!appState.customDecks.length) {
      ul.innerHTML = '<li class="helper-text">아직 생성된 커스텀 단어장이 없습니다.</li>';
      return;
    }

    ul.innerHTML = appState.customDecks
      .map(
        (deck) => `
      <li class="custom-deck-item">
        <span><strong>${escapeHtml(deck.name)}</strong> (${deck.wordIds.length}단어)</span>
        <div class="quick-action-row">
          <button type="button" class="chip-btn" data-open-deck="${escapeHtml(deck.id)}">단어장에서 보기</button>
          <button type="button" class="chip-btn" data-delete-deck="${escapeHtml(deck.id)}">삭제</button>
        </div>
      </li>
    `
      )
      .join("");
  }

  function syncDeckSelectOptions() {
    const filterSel = document.getElementById("vocab-deck-filter");
    const batchSel = document.getElementById("batch-target-deck-select");

    if (filterSel) {
      const prev = filterSel.value;
      filterSel.innerHTML =
        '<option value="ALL">전체 단어장</option>' +
        appState.customDecks
          .map((d) => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.name)}</option>`)
          .join("");
      if ([...filterSel.options].some((o) => o.value === prev)) filterSel.value = prev;
    }

    if (batchSel) {
      batchSel.innerHTML =
        '<option value="">커스텀 단어장 선택...</option>' +
        appState.customDecks
          .map((d) => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.name)}</option>`)
          .join("");
    }
  }

  // =========================================================
  // 4. 단어장 렌더링 (50개 단위 '더 보기' 지연 렌더링)
  // =========================================================
  function populateVocabFilterOptions() {
    const catSel = document.getElementById("vocab-category-filter");
    if (!catSel) return;
    const tagSet = new Set();
    DATA.VOCAB_DB.forEach((item) => {
      if (item.category) tagSet.add(item.category);
      if (Array.isArray(item.examTags)) {
        item.examTags.forEach((t) => tagSet.add(t));
      }
    });
    const sorted = [...tagSet].sort();
    catSel.innerHTML =
      '<option value="ALL">전체 분류/기출</option>' +
      sorted.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
  }

  function getFilteredAndSortedVocab() {
    const q = (document.getElementById("vocab-search-input")?.value || "").trim().toLowerCase();
    const cat = document.getElementById("vocab-category-filter")?.value || "ALL";
    const status = document.getElementById("vocab-status-filter")?.value || "ALL";
    const deckId = document.getElementById("vocab-deck-filter")?.value || "ALL";
    const sortBy = document.getElementById("vocab-sort-select")?.value || "default";

    const deckObj =
      deckId !== "ALL" ? appState.customDecks.find((d) => String(d.id) === String(deckId)) : null;
    const deckIdSet = deckObj ? new Set(deckObj.wordIds.map(String)) : null;
    const favSet = new Set(appState.favorites.map(String));

    let list = DATA.VOCAB_DB.filter((item) => {
      const idStr = String(item.id);
      const curStatus = getItemStatus(idStr);

      if (cat !== "ALL") {
        const matchCat = item.category === cat;
        const matchTag = Array.isArray(item.examTags) && item.examTags.includes(cat);
        if (!matchCat && !matchTag) return false;
      }

      if (status === "DUE" && !DATA.isDueForReview(idStr, appState)) return false;
      if (status === "FAVORITE" && !favSet.has(idStr)) return false;
      if (["미학습", "모름", "애매함", "완벽함"].includes(status) && curStatus !== status) {
        return false;
      }

      if (deckIdSet && !deckIdSet.has(idStr)) return false;

      if (q) {
        const memo = (appState.posNotes[idStr] || "").toLowerCase();
        const hay = `${item.word || ""} ${item.kana || ""} ${item.meaning || ""} ${memo}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });

    const statusRank = { 모름: 0, 애매함: 1, 미학습: 2, 완벽함: 3 };
    if (sortBy === "kana") {
      list = [...list].sort((a, b) => String(a.kana || "").localeCompare(String(b.kana || ""), "ja"));
    } else if (sortBy === "status") {
      list = [...list].sort((a, b) => {
        const sa = statusRank[getItemStatus(a.id)] ?? 2;
        const sb = statusRank[getItemStatus(b.id)] ?? 2;
        return sa - sb;
      });
    } else if (sortBy === "wrong") {
      list = [...list].sort((a, b) => {
        const wa = appState.wrongStats[String(a.id)]?.count || 0;
        const wb = appState.wrongStats[String(b.id)]?.count || 0;
        return wb - wa;
      });
    }

    return list;
  }

  function renderVocabList() {
    const container = document.getElementById("vocab-list-container");
    const infoEl = document.getElementById("vocab-pagination-info");
    const moreBtn = document.getElementById("btn-load-more-vocab");
    if (!container) return;

    const filtered = getFilteredAndSortedVocab();
    const visibleItems = filtered.slice(0, vocabRenderedCount);

    if (!visibleItems.length) {
      container.innerHTML = '<div class="card helper-text">조건에 맞는 단어가 없습니다.</div>';
      if (infoEl) infoEl.textContent = "0 / 0개 표시 중";
      if (moreBtn) moreBtn.hidden = true;
      updateBatchSelectionUI();
      return;
    }

    container.innerHTML = visibleItems
      .map((item) => {
        const idStr = String(item.id);
        const status = getItemStatus(idStr);
        const isFav = appState.favorites.map(String).includes(idStr);
        const isChecked = selectedVocabIds.has(idStr);
        const dupLabel = DATA.formatDuplicateExamLabel(item.examTags);
        const kanaOnly = DATA.isHiraganaOnly(item.word);
        const memo = appState.posNotes[idStr] || "";

        return `
        <article class="vocab-row-card" data-vocab-id="${escapeHtml(idStr)}">
          <div class="vocab-row-main">
            <input type="checkbox" class="vocab-row-check" value="${escapeHtml(idStr)}" ${
          isChecked ? "checked" : ""
        } aria-label="${escapeHtml(item.word)} 선택" />
            <div>
              <div class="vocab-word-line">
                <span class="vocab-word-jp maskable-target" lang="ja">${escapeHtml(item.word)}</span>
                <span class="vocab-kana-jp maskable-kana ${
                  kanaOnly ? "is-kana-only-headword" : ""
                }" lang="ja">${escapeHtml(item.kana)}</span>
                <span class="badge">${escapeHtml(item.category || "어휘")}</span>
                ${dupLabel ? `<span class="dup-badge">${escapeHtml(dupLabel)}</span>` : ""}
              </div>
              <div class="vocab-meaning-ko maskable-meaning">${escapeHtml(item.meaning)}</div>
              <div class="vocab-memo-row">
                <input type="text" class="vocab-memo-input" data-memo-id="${escapeHtml(
                  idStr
                )}" value="${escapeHtml(memo)}" placeholder="품사/암기 메모..." />
              </div>
            </div>
          </div>

          <div class="vocab-row-actions">
            <button type="button" class="chip-btn" data-speak-word="${escapeHtml(
              item.word || item.kana
            )}">🔊</button>
            <button type="button" class="icon-btn" data-toggle-fav="${escapeHtml(
              idStr
            )}" aria-pressed="${isFav}">${isFav ? "★" : "☆"}</button>
            <select class="vocab-status-select" data-status-id="${escapeHtml(
              idStr
            )}" aria-label="학습 상태 변경">
              <option value="미학습" ${status === "미학습" ? "selected" : ""}>미학습</option>
              <option value="모름" ${status === "모름" ? "selected" : ""}>모름</option>
              <option value="애매함" ${status === "애매함" ? "selected" : ""}>애매함</option>
              <option value="완벽함" ${status === "완벽함" ? "selected" : ""}>완벽함</option>
            </select>
          </div>
        </article>
      `;
      })
      .join("");

    if (infoEl) {
      infoEl.textContent = `${visibleItems.length} / ${filtered.length}개 표시 중`;
    }
    if (moreBtn) {
      const remaining = filtered.length - visibleItems.length;
      if (remaining > 0) {
        moreBtn.hidden = false;
        moreBtn.textContent = `더 보기 (+${Math.min(VOCAB_PAGE_SIZE, remaining)}개)`;
      } else {
        moreBtn.hidden = true;
      }
    }

    updateBatchSelectionUI();
  }

  function updateBatchSelectionUI() {
    const countEl = document.getElementById("vocab-selected-count");
    if (countEl) countEl.textContent = String(selectedVocabIds.size);
  }

  // =========================================================
  // 5. 어휘 플래시카드 & SRS 4단계 평가
  // =========================================================
  function getVocabByScope(scope) {
    const favSet = new Set(appState.favorites.map(String));
    return DATA.VOCAB_DB.filter((item) => {
      const idStr = String(item.id);
      const status = getItemStatus(idStr);
      if (scope === "DUE") return DATA.isDueForReview(idStr, appState);
      if (scope === "FAVORITE") return favSet.has(idStr);
      if (["미학습", "모름", "애매함", "완벽함"].includes(scope)) return status === scope;
      return true;
    });
  }

  function buildFlashcardDeck(shuffle = false) {
    const list = getVocabByScope(fcScope);
    fcDeck = list.length ? [...list] : [...DATA.VOCAB_DB];
    if (shuffle) {
      for (let i = fcDeck.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [fcDeck[i], fcDeck[j]] = [fcDeck[j], fcDeck[i]];
      }
    }
    fcIndex = 0;
    fcFlipped = false;
    fcShowExKana = false;
    fcShowExMeaning = false;
    fcActiveKanji = null;
  }

  function renderFlashcard() {
    if (!fcDeck.length) return;
    const item = fcDeck[fcIndex % fcDeck.length];
    const idStr = String(item.id);
    const status = getItemStatus(idStr);
    const isFav = appState.favorites.map(String).includes(idStr);
    const dupLabel = DATA.formatDuplicateExamLabel(item.examTags);
    const kanaOnly = DATA.isHiraganaOnly(item.word);

    setText("fc-counter", `${fcIndex + 1} / ${fcDeck.length}`);
    setText("fc-status-badge", status);
    setText("fc-category-badge", item.category || "어휘");

    const dupBadge = document.getElementById("fc-dup-badge");
    if (dupBadge) {
      if (dupLabel) {
        dupBadge.textContent = dupLabel;
        dupBadge.hidden = false;
      } else {
        dupBadge.hidden = true;
      }
    }

    const favBtn = document.getElementById("btn-fc-favorite");
    if (favBtn) {
      favBtn.textContent = isFav ? "★" : "☆";
      favBtn.setAttribute("aria-pressed", String(isFav));
    }

    const wordEl = document.getElementById("fc-word");
    if (wordEl) wordEl.textContent = item.word || "";

    const kanaEl = document.getElementById("fc-kana");
    if (kanaEl) {
      kanaEl.textContent = item.kana || "";
      kanaEl.classList.toggle("is-kana-only-headword", kanaOnly);
      kanaEl.classList.remove("is-revealed");
    }

    const memoInput = document.getElementById("fc-simple-memo");
    if (memoInput) {
      memoInput.value = appState.posNotes[idStr] || "";
    }

    const frontEl = document.getElementById("fc-front");
    const backEl = document.getElementById("fc-back");
    if (frontEl) frontEl.hidden = fcFlipped;
    if (backEl) backEl.hidden = !fcFlipped;

    const meaningEl = document.getElementById("fc-meaning");
    if (meaningEl) {
      meaningEl.textContent = item.meaning || "";
      meaningEl.classList.remove("is-revealed");
    }

    setText("fc-pos", item.pos || "품사 미표기");

    const exEl = document.getElementById("fc-example");
    const exKanaEl = document.getElementById("fc-example-kana");
    const exMeaningEl = document.getElementById("fc-example-meaning");
    if (exEl) exEl.innerHTML = highlightKeywordInHtml(item.example || "예문 없음", item.word);
    if (exKanaEl) {
      exKanaEl.textContent = item.exampleKana || "";
      exKanaEl.hidden = !fcShowExKana || !item.exampleKana;
    }
    if (exMeaningEl) {
      exMeaningEl.textContent = item.exampleMeaning || "";
      exMeaningEl.hidden = !fcShowExMeaning || !item.exampleMeaning;
    }

    const kanjiChars = DATA.extractKanjiChars(item.word);
    const chipsWrap = document.getElementById("fc-kanji-chips");
    const relatedBox = document.getElementById("fc-kanji-related");
    if (chipsWrap) {
      chipsWrap.innerHTML = kanjiChars.length
        ? kanjiChars
            .map(
              (ch) =>
                `<button type="button" class="kanji-chip ${
                  fcActiveKanji === ch ? "active" : ""
                }" data-kanji-char="${escapeHtml(ch)}" lang="ja">${escapeHtml(ch)}</button>`
            )
            .join("")
        : '<span class="helper-text">추출할 한자가 없습니다.</span>';
    }
    if (relatedBox) {
      if (fcActiveKanji) {
        const matches = DATA.findWordsByKanji(fcActiveKanji, idStr).slice(0, 8);
        relatedBox.hidden = false;
        relatedBox.innerHTML = matches.length
          ? `<strong>「${escapeHtml(fcActiveKanji)}」 포함 어휘:</strong> ` +
            matches
              .map(
                (m) =>
                  `<span class="badge" lang="ja">${escapeHtml(m.word)} (${escapeHtml(
                    m.kana
                  )}) · ${escapeHtml(m.meaning)}</span>`
              )
              .join(" ")
          : `「${escapeHtml(fcActiveKanji)}」를 포함한 다른 등록 어휘가 없습니다.`;
      } else {
        relatedBox.hidden = true;
        relatedBox.innerHTML = "";
      }
    }

    const gramTagsBox = document.getElementById("fc-grammar-tags");
    const connBadge = document.getElementById("fc-connection-badge");
    const compChips = document.getElementById("fc-compare-chips");
    if (gramTagsBox) {
      const hasConn = Boolean(item.connection);
      const compList = Array.isArray(item.compareGrammar) ? item.compareGrammar : [];
      gramTagsBox.hidden = !hasConn && !compList.length;
      if (connBadge) {
        connBadge.hidden = !hasConn;
        connBadge.textContent = hasConn ? `접속: ${item.connection}` : "";
      }
      if (compChips) {
        compChips.innerHTML = compList
          .map(
            (cg) =>
              `<button type="button" class="compare-chip" data-compare-target="${escapeHtml(
                cg
              )}" lang="ja">비교: ${escapeHtml(cg)}</button>`
          )
          .join("");
      }
    }
  }

  function flipFlashcard(forceState = null) {
    fcFlipped = typeof forceState === "boolean" ? forceState : !fcFlipped;
    renderFlashcard();
  }

  function moveFlashcard(delta) {
    if (!fcDeck.length) return;
    fcIndex = (fcIndex + delta + fcDeck.length) % fcDeck.length;
    fcFlipped = false;
    fcShowExKana = false;
    fcShowExMeaning = false;
    fcActiveKanji = null;
    renderFlashcard();
  }

  function rateCurrentFlashcard(rating) {
    if (!fcDeck.length) return;
    const item = fcDeck[fcIndex % fcDeck.length];
    const idStr = String(item.id);
    const prev = appState.progress[idStr] || null;
    appState.progress[idStr] = {
      type: "vocab",
      ...DATA.calculateNextSrs(prev, rating)
    };
    persistState();
    moveFlashcard(1);
  }

  // =========================================================
  // 6. 문법 대시보드 / 문법 목록 / 문법 플래시카드 / 독해 / 오답노트
  // =========================================================
  function renderGrammarDashboard() {
    const stats = DATA.getGrammarStatsSummary(appState);
    setText("stat-grammar-total", stats.total);
    setText("stat-grammar-due", stats.due);
    setText("stat-grammar-learned", stats.learned);
    setText("stat-grammar-ambiguous", stats.ambiguous);
    setText("stat-grammar-unknown", stats.unknown);
    setText("stat-grammar-unstudied", stats.unstudied);
  }

  function renderGrammarList() {
    renderGrammarDashboard();
    const container = document.getElementById("grammar-card-list");
    if (!container) return;

    const q = (document.getElementById("grammar-search-input")?.value || "").trim().toLowerCase();
    const connFilter = document.getElementById("grammar-connection-filter")?.value || "ALL";
    const statusFilter = document.getElementById("grammar-status-filter")?.value || "ALL";

    const filtered = DATA.GRAMMAR_DB.filter((g) => {
      const idStr = String(g.id);
      const curStatus = getItemStatus(idStr);

      if (connFilter !== "ALL" && !String(g.connection || "").includes(connFilter)) return false;
      if (statusFilter === "DUE" && !DATA.isDueForReview(idStr, appState)) return false;
      if (
        ["미학습", "모름", "애매함", "완벽함"].includes(statusFilter) &&
        curStatus !== statusFilter
      ) {
        return false;
      }
      if (q) {
        const hay = `${g.word} ${g.kana} ${g.meaning} ${g.connection} ${g.example} ${g.explanation}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (!filtered.length) {
      container.innerHTML =
        '<div class="card helper-text">등록된 문법 항목이 없거나 필터 조건에 맞는 문법이 없습니다.</div>';
      return;
    }

    container.innerHTML = filtered
      .map((g) => {
        const idStr = String(g.id);
        const status = getItemStatus(idStr);
        const compares = Array.isArray(g.compareGrammar) ? g.compareGrammar : [];
        return `
        <article class="card grammar-card">
          <div class="card-header">
            <span class="grammar-pattern-title" lang="ja">${escapeHtml(g.word)}</span>
            <span class="badge badge-conn">${escapeHtml(g.connection || "문법")}</span>
          </div>
          <p class="grammar-meaning maskable-meaning"><strong>${escapeHtml(g.meaning)}</strong></p>
          ${g.explanation ? `<p class="helper-text">${escapeHtml(g.explanation)}</p>` : ""}
          ${
            g.example
              ? `<p class="fc-example-jp" lang="ja">${escapeHtml(g.example)}</p><p class="helper-text maskable-meaning">${escapeHtml(
                  g.exampleMeaning || ""
                )}</p>`
              : ""
          }
          <div class="quick-action-row">
            ${compares
              .map(
                (cg) =>
                  `<button type="button" class="compare-chip" data-open-grammar-compare="${escapeHtml(
                    idStr
                  )}" data-compare-item="${escapeHtml(cg)}" lang="ja">유사 비교: ${escapeHtml(cg)}</button>`
              )
              .join("")}
            <select class="vocab-status-select" data-grammar-status-id="${escapeHtml(idStr)}">
              <option value="미학습" ${status === "미학습" ? "selected" : ""}>미학습</option>
              <option value="모름" ${status === "모름" ? "selected" : ""}>모름</option>
              <option value="애매함" ${status === "애매함" ? "selected" : ""}>애매함</option>
              <option value="완벽함" ${status === "완벽함" ? "selected" : ""}>완벽함</option>
            </select>
          </div>
        </article>
      `;
      })
      .join("");
  }

  function getGrammarByScope(scope) {
    return DATA.GRAMMAR_DB.filter((g) => {
      const idStr = String(g.id);
      const status = getItemStatus(idStr);
      if (scope === "DUE") return DATA.isDueForReview(idStr, appState);
      if (["미학습", "모름", "애매함", "완벽함"].includes(scope)) return status === scope;
      return true;
    });
  }

  function buildGrammarFlashcardDeck(shuffle = false) {
    const list = getGrammarByScope(gfcScope);
    gfcDeck = list.length ? [...list] : [...DATA.GRAMMAR_DB];
    if (shuffle) {
      for (let i = gfcDeck.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [gfcDeck[i], gfcDeck[j]] = [gfcDeck[j], gfcDeck[i]];
      }
    }
    gfcIndex = 0;
    gfcFlipped = false;
  }

  function renderGrammarFlashcard() {
    if (!gfcDeck.length) return;
    const item = gfcDeck[gfcIndex % gfcDeck.length];
    const idStr = String(item.id);
    const status = getItemStatus(idStr);

    setText("gfc-counter", `${gfcIndex + 1} / ${gfcDeck.length}`);
    setText("gfc-status-badge", status);
    setText("gfc-connection-badge", item.connection || "접속");
    setText("gfc-category-badge", item.category || "문법");

    const patEl = document.getElementById("gfc-pattern");
    if (patEl) patEl.textContent = item.word || "";

    const kanaEl = document.getElementById("gfc-kana");
    if (kanaEl) {
      kanaEl.textContent = item.kana || item.word || "";
      kanaEl.classList.remove("is-revealed");
    }

    const memoEl = document.getElementById("gfc-simple-memo");
    if (memoEl) memoEl.value = appState.posNotes[idStr] || "";

    const frontEl = document.getElementById("gfc-front");
    const backEl = document.getElementById("gfc-back");
    if (frontEl) frontEl.hidden = gfcFlipped;
    if (backEl) backEl.hidden = !gfcFlipped;

    const meaningEl = document.getElementById("gfc-meaning");
    if (meaningEl) {
      meaningEl.textContent = item.meaning || "";
      meaningEl.classList.remove("is-revealed");
    }

    setText("gfc-back-connection", item.connection || "접속");
    setText("gfc-explanation", item.explanation || "");
    setText("gfc-example", item.example || "");
    setText("gfc-example-kana", item.exampleKana || "");
    setText("gfc-example-meaning", item.exampleMeaning || "");

    const compBox = document.getElementById("gfc-compare-chips");
    if (compBox) {
      const comps = Array.isArray(item.compareGrammar) ? item.compareGrammar : [];
      compBox.innerHTML = comps
        .map(
          (cg) =>
            `<button type="button" class="compare-chip" data-open-grammar-compare="${escapeHtml(
              idStr
            )}" data-compare-item="${escapeHtml(cg)}" lang="ja">비교: ${escapeHtml(cg)}</button>`
        )
        .join("");
    }
  }

  function flipGrammarFlashcard(forceState = null) {
    gfcFlipped = typeof forceState === "boolean" ? forceState : !gfcFlipped;
    renderGrammarFlashcard();
  }

  function moveGrammarFlashcard(delta) {
    if (!gfcDeck.length) return;
    gfcIndex = (gfcIndex + delta + gfcDeck.length) % gfcDeck.length;
    gfcFlipped = false;
    renderGrammarFlashcard();
  }

  function rateCurrentGrammarCard(rating) {
    if (!gfcDeck.length) return;
    const item = gfcDeck[gfcIndex % gfcDeck.length];
    const idStr = String(item.id);
    appState.progress[idStr] = {
      type: "grammar",
      ...DATA.calculateNextSrs(appState.progress[idStr], rating)
    };
    persistState();
    renderGrammarDashboard();
    moveGrammarFlashcard(1);
  }

  function openGrammarCompareModal(grammarId, compareText = "") {
    const modal = document.getElementById("grammar-compare-modal");
    const body = document.getElementById("grammar-compare-body");
    if (!modal || !body) return;

    const baseItem = DATA.GRAMMAR_DB.find((g) => String(g.id) === String(grammarId));
    if (!baseItem) return;

    body.innerHTML = `
      <div class="compare-grid">
        <div class="card">
          <strong lang="ja">${escapeHtml(baseItem.word)}</strong>
          <p class="helper-text">접속: ${escapeHtml(baseItem.connection)}</p>
          <p>${escapeHtml(baseItem.meaning)}</p>
          ${baseItem.explanation ? `<p class="helper-text">${escapeHtml(baseItem.explanation)}</p>` : ""}
        </div>
        <div class="card">
          <strong lang="ja">${escapeHtml(compareText || "비교 대상 문형")}</strong>
          <p class="helper-text">접속 조건 및 실제 문맥에서의 뉘앙스 차이를 비교하세요.</p>
          <p>${escapeHtml(baseItem.explanation || "시제·접속·화자의 의도 차이를 대조해 보세요.")}</p>
        </div>
      </div>
    `;
    modal.hidden = false;
  }

  function renderWrongNotes() {
    const listEl = document.getElementById("vocab-wrong-list");
    if (!listEl) return;

    const wrongEntries = Object.entries(appState.wrongStats)
      .filter(([, s]) => s && Number(s.count) > 0)
      .sort((a, b) => Number(b[1].count) - Number(a[1].count));

    if (!wrongEntries.length) {
      listEl.innerHTML = '<p class="helper-text">기록된 오답이 없습니다. 퀴즈를 풀면 자동 누적됩니다.</p>';
      return;
    }

    const combinedMap = new Map([
      ...DATA.VOCAB_DB.map((v) => [String(v.id), v]),
      ...DATA.GRAMMAR_DB.map((g) => [String(g.id), g])
    ]);

    listEl.innerHTML = wrongEntries
      .map(([id, stat]) => {
        const item = combinedMap.get(String(id));
        const label = item
          ? `<strong lang="ja">${escapeHtml(item.word)}</strong> <span lang="ja">(${escapeHtml(
              item.kana || ""
            )})</span> — ${escapeHtml(item.meaning)}`
          : `항목 ID: ${escapeHtml(id)}`;
        return `
        <div class="vocab-row-card">
          <div>${label}</div>
          <div class="quick-action-row">
            <span class="badge badge-alert">오답 ${Number(stat.count)}회</span>
            <button type="button" class="chip-btn" data-remove-wrong="${escapeHtml(id)}">제거</button>
          </div>
        </div>
      `;
      })
      .join("");
  }

  // =========================================================
  // 6-B. 독해 섹션 (#panel-reading-section) & 유형별 풀이 팁 서브 탭
  // =========================================================
  function getReadingDbList() {
    return Array.isArray(DATA.READING_DB) ? DATA.READING_DB : [];
  }

  function getFilteredReadingPassages(category = activeReadingCategory) {
    const db = getReadingDbList();
    if (!category || category === "ALL" || category === "TIPS") {
      return db.slice();
    }
    return db.filter((item) => String(item.category) === String(category));
  }

  function getReadingProgressEntry(readingId) {
    const key = String(readingId || "");
    appState.readingProgress = appState.readingProgress || {};
    const raw = appState.readingProgress[key];
    if (typeof DATA.sanitizeReadingProgressEntry === "function") {
      return DATA.sanitizeReadingProgressEntry(raw);
    }
    return {
      completed: Boolean(raw?.completed),
      solvedQuestions:
        raw && typeof raw.solvedQuestions === "object" ? { ...raw.solvedQuestions } : {},
      completedAt: raw?.completedAt || null
    };
  }

  function formatReadingPassageHtml(rawText) {
    const escaped = escapeHtml(rawText || "");
    const withUnderline = escaped.replace(
      /\[\[u\]\]([\s\S]*?)\[\[\/u\]\]/g,
      '<span class="reading-underline" lang="ja">$1</span>'
    );
    const withBlank = withUnderline.replace(
      /\[\[blank\]\]([\s\S]*?)\[\[\/blank\]\]/g,
      '<span class="reading-blank" lang="ja">$1</span>'
    );
    const paragraphs = withBlank
      .split(/\n{2,}|\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    if (!paragraphs.length) return `<p lang="ja"></p>`;
    return paragraphs.map((p) => `<p lang="ja">${p.replace(/\n/g, "<br />")}</p>`).join("");
  }

  function renderReadingSubTabsState() {
    document.querySelectorAll("#panel-reading-section [data-reading-category]").forEach((btn) => {
      const cat = btn.getAttribute("data-reading-category");
      const isMatch = cat === activeReadingCategory;
      btn.classList.toggle("active", isMatch);
      btn.setAttribute("aria-selected", String(isMatch));
    });

    const practiceView = document.getElementById("reading-practice-view");
    const tipsView = document.getElementById("reading-tips-view");
    const isTips = activeReadingCategory === "TIPS";

    if (practiceView) practiceView.hidden = isTips;
    if (tipsView) tipsView.hidden = !isTips;
  }

  function renderReadingPassageListView(passages) {
    const listCol = document.getElementById("reading-passage-list");
    if (!listCol) return;

    const headingText =
      activeReadingCategory === "ALL" ? "전체 지문 목록" : `${activeReadingCategory} 지문 목록`;

    if (!passages.length) {
      listCol.innerHTML = `
        <div class="card-header">
          <span>${escapeHtml(headingText)}</span>
          <span class="badge">0편</span>
        </div>
        <div class="reading-empty-state">
          <p class="helper-text">선택한 <strong>${escapeHtml(activeReadingCategory)}</strong> 유형에 등록된 지문이 없습니다.</p>
          <p class="helper-text">다른 유형 탭을 선택하거나 <strong>💡 유형별 문제 풀이 팁</strong>에서 출제 요령을 먼저 확인해 보세요.</p>
        </div>
      `;
      return;
    }

    const cardsHtml = passages
      .map((item) => {
        const idStr = String(item.id);
        const entry = getReadingProgressEntry(idStr);
        const isActive = idStr === String(selectedReadingId);
        const qCount = Array.isArray(item.questions) ? item.questions.length : 0;
        const estMin = Number(item.estimatedMinutes) || 3;
        const statusClass = entry.completed ? "reading-status-done" : "reading-status-todo";
        const statusText = entry.completed ? "완료" : "미완료";

        return `
          <button
            type="button"
            class="reading-list-btn ${isActive ? "active" : ""}"
            data-select-reading="${escapeHtml(idStr)}"
            aria-pressed="${String(isActive)}"
          >
            <div class="reading-item-top">
              <span class="badge">${escapeHtml(item.category || "독해")}</span>
              <span class="badge ${statusClass}">${statusText}</span>
            </div>
            <div class="reading-item-title">${escapeHtml(item.title || "")}</div>
            <div class="reading-item-meta">
              <span>${escapeHtml(item.examTypeLabel || item.category || "")}</span>
              <span>⏱ ${estMin}분 · ${qCount}문항</span>
            </div>
          </button>
        `;
      })
      .join("");

    listCol.innerHTML = `
      <div class="card-header">
        <span>${escapeHtml(headingText)}</span>
        <span class="badge">${passages.length}편</span>
      </div>
      <div>${cardsHtml}</div>
    `;
  }

  function renderReadingPassageBody(passageObj) {
    const isAb =
      passageObj.category === "통합이해" ||
      Boolean(passageObj.passageA) ||
      Boolean(passageObj.passageB);

    if (isAb && (passageObj.passageA || passageObj.passageB)) {
      return `
        <div class="reading-ab-grid">
          <div class="reading-ab-card">
            <span class="reading-ab-label">文章 A</span>
            <div class="reading-passage-body">${formatReadingPassageHtml(passageObj.passageA)}</div>
          </div>
          <div class="reading-ab-card">
            <span class="reading-ab-label">文章 B</span>
            <div class="reading-passage-body">${formatReadingPassageHtml(passageObj.passageB)}</div>
          </div>
        </div>
      `;
    }

    if (passageObj.category === "정보검색") {
      return `
        <div class="reading-info-box">
          ${formatReadingPassageHtml(passageObj.passage)}
        </div>
      `;
    }

    return `
      <div class="reading-passage-body">
        ${formatReadingPassageHtml(passageObj.passage)}
      </div>
    `;
  }

  function renderReadingTranslationBlock(passageObj) {
    if (!readingShowTranslation) return "";

    const isAb =
      passageObj.category === "통합이해" ||
      Boolean(passageObj.translationA) ||
      Boolean(passageObj.translationB);

    if (isAb && (passageObj.translationA || passageObj.translationB)) {
      return `
        <div class="reading-translation-box maskable-meaning">
          <div class="label-sm">전체 한국어 해석 (A / B)</div>
          <p><strong>[文章 A 해석]</strong> ${escapeHtml(passageObj.translationA || "")}</p>
          <p style="margin-bottom:0;"><strong>[文章 B 해석]</strong> ${escapeHtml(passageObj.translationB || "")}</p>
        </div>
      `;
    }

    return `
      <div class="reading-translation-box maskable-meaning">
        <div class="label-sm">전체 한국어 해석</div>
        <p style="margin-bottom:0;">${escapeHtml(passageObj.translation || "해석 내용이 없습니다.")}</p>
      </div>
    `;
  }

  function renderReadingRelatedChips(passageObj) {
    const list = Array.isArray(passageObj.relatedVocabGrammar)
      ? passageObj.relatedVocabGrammar
      : [];
    if (!list.length) return "";

    const chipsHtml = list
      .map((entry) => {
        const term = escapeHtml(entry.term || "");
        const reading = entry.reading ? ` (${escapeHtml(entry.reading)})` : "";
        const meaning = escapeHtml(entry.meaning || "");
        const note = entry.note ? ` · ${escapeHtml(entry.note)}` : "";

        return `
          <div class="reading-link-chip">
            <strong lang="ja">${term}</strong>
            <span lang="ja">${reading}</span>
            <span class="maskable-meaning">— ${meaning}</span>
            ${note ? `<span class="helper-text" style="margin:0;">${note}</span>` : ""}
          </div>
        `;
      })
      .join("");

    return `
      <div style="margin-top:4px;">
        <div class="label-sm" style="margin-bottom:6px;">핵심 어휘·문법 연계 포인트</div>
        <div class="reading-link-chips">${chipsHtml}</div>
      </div>
    `;
  }

  function renderReadingQuestionExplanation(passageObj, qObj, selectedIdx) {
    if (selectedIdx === undefined || selectedIdx === null) return "";

    const answerIdx = Number(qObj.answerIndex);
    const isCorrect = Number(selectedIdx) === answerIdx;
    const wrongMap =
      qObj.wrongReasons && typeof qObj.wrongReasons === "object" ? qObj.wrongReasons : {};
    const wrongReason = !isCorrect
      ? wrongMap[String(selectedIdx)] ?? wrongMap[selectedIdx] ?? ""
      : "";

    return `
      <div class="reading-explanation-box">
        <div class="${isCorrect ? "feedback-ok" : "feedback-err"}">
          <strong>${isCorrect ? "✓ 정답입니다!" : `✕ 오답입니다. (정답: ${answerIdx + 1}번)`}</strong>
        </div>

        ${
          qObj.clueSentence
            ? `
          <div class="reading-clue-box">
            <div class="label-sm">정답 근거 문장</div>
            <div lang="ja" style="margin-top:4px;">${escapeHtml(qObj.clueSentence)}</div>
          </div>
        `
            : ""
        }

        ${
          wrongReason
            ? `
          <div class="helper-text" style="margin:0;">
            <strong>오답 소거 포인트 (${Number(selectedIdx) + 1}번 선택):</strong> ${escapeHtml(wrongReason)}
          </div>
        `
            : ""
        }

        <div style="font-size:0.9rem;">
          <strong>해설 및 문맥 흐름:</strong> ${escapeHtml(qObj.explanation || "")}
        </div>

        ${renderReadingRelatedChips(passageObj)}
      </div>
    `;
  }

  function renderReadingDetailView(passages) {
    const detailCol = document.getElementById("reading-detail-view");
    if (!detailCol) return;

    if (!passages.length) {
      detailCol.innerHTML = `
        <div class="reading-empty-state">
          <p class="helper-text">표시할 독해 지문이 없습니다. 다른 유형 탭을 선택해 주세요.</p>
        </div>
      `;
      return;
    }

    const current =
      passages.find((r) => String(r.id) === String(selectedReadingId)) || passages[0];
    selectedReadingId = String(current.id);

    const entry = getReadingProgressEntry(current.id);
    const footnotesHtml =
      Array.isArray(current.footnotes) && current.footnotes.length
        ? `
          <div class="reading-footnote" lang="ja">
            ${current.footnotes.map((fn) => `<div>${escapeHtml(fn)}</div>`).join("")}
          </div>
        `
        : "";

    const questions = Array.isArray(current.questions) ? current.questions : [];
    const questionsHtml = questions
      .map((q, qIdx) => {
        const qKey = String(q.qId || `${current.id}-q${qIdx + 1}`);
        const selectedIdx = entry.solvedQuestions[qKey];
        const hasAnswered = selectedIdx !== undefined && selectedIdx !== null;
        const answerIdx = Number(q.answerIndex);

        const choicesHtml = (Array.isArray(q.choices) ? q.choices : [])
          .map((choiceText, cIdx) => {
            let stateClass = "";
            if (hasAnswered) {
              if (cIdx === answerIdx) stateClass = "is-correct";
              else if (cIdx === Number(selectedIdx)) stateClass = "is-wrong";
            } else if (cIdx === Number(selectedIdx)) {
              stateClass = "is-selected";
            }

            return `
              <button
                type="button"
                class="reading-choice-btn ${stateClass}"
                data-reading-id="${escapeHtml(current.id)}"
                data-question-id="${escapeHtml(qKey)}"
                data-choice-index="${cIdx}"
              >
                <span lang="ja">${escapeHtml(choiceText)}</span>
              </button>
            `;
          })
          .join("");

        return `
          <div class="reading-question-block" data-question-id="${escapeHtml(qKey)}">
            <p class="reading-question-stem" lang="ja">
              Q${qIdx + 1}. ${escapeHtml(q.question || "")}
            </p>
            <div class="reading-choices-list">${choicesHtml}</div>
            ${renderReadingQuestionExplanation(current, q, selectedIdx)}
          </div>
        `;
      })
      .join("");

    detailCol.innerHTML = `
      <div>
        <div class="reading-passage-header">
          <div>
            <div style="display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin-bottom:6px;">
              <span class="badge">${escapeHtml(current.category || "독해")}</span>
              <span class="badge badge-conn">${escapeHtml(current.examTypeLabel || "")}</span>
              <span class="badge ${entry.completed ? "reading-status-done" : "reading-status-todo"}">
                ${entry.completed ? "✓ 완료" : "미완료"}
              </span>
            </div>
            <h2 class="reading-passage-title" lang="ja">${escapeHtml(current.title || "")}</h2>
          </div>

          <div class="reading-toolbar-actions">
            <button
              type="button"
              class="btn"
              id="btn-reading-tts"
              data-reading-id="${escapeHtml(current.id)}"
            >
              🔊 지문 듣기
            </button>
            <button
              type="button"
              class="btn ${readingShowTranslation ? "btn-secondary" : ""}"
              id="btn-reading-toggle-translation"
            >
              ${readingShowTranslation ? "전체 해석 숨기기" : "전체 해석 보기"}
            </button>
            <button
              type="button"
              class="btn ${entry.completed ? "btn-secondary" : "btn-primary"}"
              id="btn-complete-reading"
              data-reading-id="${escapeHtml(current.id)}"
            >
              ${entry.completed ? "✓ 학습 완료됨 (취소)" : "지문 학습 완료 표시"}
            </button>
          </div>
        </div>

        ${renderReadingPassageBody(current)}
        ${footnotesHtml}
        ${renderReadingTranslationBlock(current)}
      </div>

      <div>
        <div class="card-header">
          <span>문항 풀이 및 해설 (${questions.length}문항)</span>
        </div>
        ${questionsHtml || '<p class="helper-text">등록된 문항이 없습니다.</p>'}
      </div>
    `;
  }

  function renderReadingSection() {
    renderReadingSubTabsState();
    if (activeReadingCategory === "TIPS") {
      return;
    }
    const passages = getFilteredReadingPassages(activeReadingCategory);
    renderReadingPassageListView(passages);
    renderReadingDetailView(passages);
  }

  function switchReadingCategory(category, options = {}) {
    const allowed = new Set(["ALL", "단문", "중문", "장문", "통합이해", "정보검색", "TIPS"]);
    const nextCategory = allowed.has(category) ? category : "ALL";
    activeReadingCategory = nextCategory;

    if (nextCategory !== "TIPS") {
      const candidates = getFilteredReadingPassages(nextCategory);
      if (
        candidates.length > 0 &&
        !candidates.some((r) => String(r.id) === String(selectedReadingId))
      ) {
        selectedReadingId = String(candidates[0].id);
      }
    }

    renderReadingSection();

    if (options.scrollDetailOnMobile && window.innerWidth < 860 && nextCategory !== "TIPS") {
      document
        .getElementById("reading-detail-view")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function handleReadingSelectPassage(readingId) {
    if (!readingId) return;
    selectedReadingId = String(readingId);
    renderReadingSection();

    if (window.innerWidth < 860) {
      document
        .getElementById("reading-detail-view")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function handleReadingSelectChoice(readingId, qId, choiceIndex) {
    const rKey = String(readingId || "");
    const qKey = String(qId || "");
    const cIdx = Number(choiceIndex);
    if (!rKey || !qKey || !Number.isInteger(cIdx) || cIdx < 0) return;

    if (typeof DATA.updateReadingAnswer === "function") {
      appState = DATA.updateReadingAnswer(rKey, qKey, cIdx, appState);
      applyThemeAndGlobalMasks();
      renderMainDashboard();
      renderReadingSection();
      return;
    }

    appState.readingProgress = appState.readingProgress || {};
    const prev = getReadingProgressEntry(rKey);
    const passageObj = getReadingDbList().find((r) => String(r.id) === rKey);
    const totalQ = Array.isArray(passageObj?.questions) ? passageObj.questions.length : 0;
    const nextSolved = { ...prev.solvedQuestions, [qKey]: cIdx };
    const allSolved =
      totalQ > 0 && passageObj.questions.every((q) => nextSolved[String(q.qId)] !== undefined);
    const completed = prev.completed || allSolved;

    appState.readingProgress[rKey] = {
      completed,
      solvedQuestions: nextSolved,
      completedAt: completed ? prev.completedAt || new Date().toISOString() : null
    };
    persistState();
    renderReadingSection();
  }

  function handleReadingToggleComplete(readingId) {
    const rKey = String(readingId || selectedReadingId || "");
    if (!rKey) return;

    if (typeof DATA.toggleReadingCompleted === "function") {
      appState = DATA.toggleReadingCompleted(rKey, null, appState);
      applyThemeAndGlobalMasks();
      renderMainDashboard();
      renderReadingSection();
      return;
    }

    appState.readingProgress = appState.readingProgress || {};
    const prev = getReadingProgressEntry(rKey);
    const nextCompleted = !prev.completed;

    appState.readingProgress[rKey] = {
      completed: nextCompleted,
      solvedQuestions: { ...prev.solvedQuestions },
      completedAt: nextCompleted ? prev.completedAt || new Date().toISOString() : null
    };
    persistState();
    renderReadingSection();
  }

  function handleReadingSpeak(readingId) {
    const target =
      getReadingDbList().find((r) => String(r.id) === String(readingId || selectedReadingId)) ||
      null;
    if (!target) return;

    const text =
      target.passage || [target.passageA, target.passageB].filter(Boolean).join(" ");
    speakJapanese(text);
  }

  // =========================================================
  // 7. 이벤트 바인딩 & 전역 단축키 & 초기화
  // =========================================================
  function bindEvents() {
    document.addEventListener("jlpt:state-updated", () => {
      refreshAllViews();
    });

    // 타이틀 클릭 시 홈(대시보드) 이동
    document.getElementById("brand-home-btn")?.addEventListener("click", () => {
      switchMainTab("main-dashboard");
    });

    // 메인 5대 탭
    document.querySelectorAll(".nav-item[data-main-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        switchMainTab(btn.getAttribute("data-main-tab"));
      });
    });

    // 통합 대시보드 영역 카드 점프
    document.querySelectorAll(".domain-card[data-jump-main]").forEach((card) => {
      card.addEventListener("click", () => {
        switchMainTab(card.getAttribute("data-jump-main"));
      });
    });

    // 통합 대시보드 빠른 시작
    document.getElementById("btn-quick-start-vocab")?.addEventListener("click", () => {
      switchMainTab("vocab-section", { vocabSubTab: "vocab-flashcard", scope: "DUE" });
    });
    document.getElementById("btn-quick-start-flashcard")?.addEventListener("click", () => {
      switchMainTab("vocab-section", { vocabSubTab: "vocab-flashcard", scope: "ALL" });
    });
    document.getElementById("btn-quick-start-grammar")?.addEventListener("click", () => {
      switchMainTab("grammar-section", { grammarSubTab: "grammar-dashboard" });
    });

    // 백업/복원/초기화
    document.getElementById("jump-backup-btn")?.addEventListener("click", () => {
      switchMainTab("main-dashboard");
      setTimeout(() => {
        document.getElementById("backup-restore-section")?.scrollIntoView({ behavior: "smooth" });
      }, 60);
    });

    document.getElementById("btn-export-json")?.addEventListener("click", () => {
      DATA.exportStateToJson(appState);
      setText("backup-status-msg", "JSON 백업 파일을 내보냈습니다.");
    });

    document.getElementById("input-import-json")?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const res = DATA.importStateFromJson(String(reader.result || ""));
        if (res.ok) {
          appState = res.state;
          applyThemeAndGlobalMasks();
          renderMainDashboard();
          renderVocabDashboard();
          renderGrammarDashboard();
          renderReadingSection();
          setText("backup-status-msg", "학습 데이터를 성공적으로 복원했습니다.");
        } else {
          setText("backup-status-msg", res.error || "복원에 실패했습니다.");
        }
      };
      reader.readAsText(file, "utf-8");
      e.target.value = "";
    });

    document.getElementById("btn-reset-all-data")?.addEventListener("click", () => {
      if (!window.confirm("모든 학습 진도, SRS 일정, 오답노트, 커스텀 단어장을 초기화할까요?")) return;
      appState = DATA.resetAllData();
      selectedVocabIds.clear();
      applyThemeAndGlobalMasks();
      renderMainDashboard();
      renderVocabDashboard();
      renderGrammarDashboard();
      renderReadingSection();
      setText("backup-status-msg", "전체 학습 데이터가 초기화되었습니다.");
    });

    // 전역 툴바
    document.getElementById("theme-toggle-btn")?.addEventListener("click", () => {
      appState.theme = appState.theme === "dark" ? "light" : "dark";
      persistState();
    });
    document.getElementById("mask-kana-btn")?.addEventListener("click", () => {
      appState.maskKana = !appState.maskKana;
      persistState();
    });
    document.getElementById("mask-meaning-btn")?.addEventListener("click", () => {
      appState.maskMeaning = !appState.maskMeaning;
      persistState();
    });
    document.getElementById("tts-rate-select")?.addEventListener("change", (e) => {
      appState.ttsRate = Number(e.target.value) || 1.0;
      persistState();
    });

    // 단축키 모달
    const shortcutsModal = document.getElementById("shortcuts-modal");
    document.getElementById("open-shortcuts-btn")?.addEventListener("click", () => {
      if (shortcutsModal) shortcutsModal.hidden = false;
    });
    document.getElementById("btn-close-shortcuts-modal")?.addEventListener("click", () => {
      if (shortcutsModal) shortcutsModal.hidden = true;
    });
    shortcutsModal?.addEventListener("click", (e) => {
      if (e.target === shortcutsModal) shortcutsModal.hidden = true;
    });

    // 문자·어휘 서브탭
    document.querySelectorAll(".sub-tab-item[data-vocab-subtab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        switchVocabSubTab(btn.getAttribute("data-vocab-subtab"));
      });
    });

    // 어휘 통계 카드 클릭
    document.querySelectorAll("#vocab-stats-grid .stat-card[data-stat-filter]").forEach((card) => {
      card.addEventListener("click", () => {
        const key = card.getAttribute("data-stat-filter");
        if (key === "wrong") {
          switchVocabSubTab("vocab-wrong");
          return;
        }
        switchVocabSubTab("vocab-list");
        const statusSel = document.getElementById("vocab-status-filter");
        if (statusSel) {
          if (key === "due") statusSel.value = "DUE";
          else if (key === "favorite") statusSel.value = "FAVORITE";
          else if (["미학습", "모름", "애매함", "완벽함"].includes(key)) statusSel.value = key;
          else statusSel.value = "ALL";
        }
        vocabRenderedCount = VOCAB_PAGE_SIZE;
        renderVocabList();
      });
    });

    // 어휘 대시보드 빠른 버튼 & 커스텀 단어장
    document.getElementById("btn-vocab-start-due")?.addEventListener("click", () => {
      switchVocabSubTab("vocab-flashcard", { scope: "DUE" });
    });
    document.getElementById("btn-vocab-start-list")?.addEventListener("click", () => {
      switchVocabSubTab("vocab-list");
    });
    document.getElementById("btn-vocab-start-quiz")?.addEventListener("click", () => {
      switchVocabSubTab("vocab-quiz");
    });

    document.getElementById("custom-deck-create-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.getElementById("new-deck-name-input");
      const name = (input?.value || "").trim();
      if (!name) return;
      appState.customDecks.push({
        id: `deck_${Date.now()}`,
        name,
        wordIds: []
      });
      if (input) input.value = "";
      persistState();
      renderVocabDashboard();
    });

    document.getElementById("custom-deck-list")?.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const openId = target.getAttribute("data-open-deck");
      if (openId) {
        switchVocabSubTab("vocab-list");
        const deckSel = document.getElementById("vocab-deck-filter");
        if (deckSel) deckSel.value = openId;
        vocabRenderedCount = VOCAB_PAGE_SIZE;
        renderVocabList();
        return;
      }
      const delId = target.getAttribute("data-delete-deck");
      if (delId) {
        appState.customDecks = appState.customDecks.filter((d) => String(d.id) !== String(delId));
        persistState();
        renderVocabDashboard();
      }
    });

    // 단어장 필터·더 보기·일괄 작업
    [
      "vocab-search-input",
      "vocab-category-filter",
      "vocab-status-filter",
      "vocab-deck-filter",
      "vocab-sort-select"
    ].forEach((id) => {
      const el = document.getElementById(id);
      const evt = id === "vocab-search-input" ? "input" : "change";
      el?.addEventListener(evt, () => {
        vocabRenderedCount = VOCAB_PAGE_SIZE;
        renderVocabList();
      });
    });

    document.getElementById("btn-load-more-vocab")?.addEventListener("click", () => {
      vocabRenderedCount += VOCAB_PAGE_SIZE;
      renderVocabList();
    });

    document.getElementById("vocab-select-all")?.addEventListener("change", (e) => {
      const checked = e.target.checked;
      const visible = getFilteredAndSortedVocab().slice(0, vocabRenderedCount);
      if (checked) {
        visible.forEach((v) => selectedVocabIds.add(String(v.id)));
      } else {
        visible.forEach((v) => selectedVocabIds.delete(String(v.id)));
      }
      renderVocabList();
    });

    document.getElementById("btn-batch-add-deck")?.addEventListener("click", () => {
      const deckId = document.getElementById("batch-target-deck-select")?.value || "";
      if (!deckId || !selectedVocabIds.size) return;
      const deck = appState.customDecks.find((d) => String(d.id) === String(deckId));
      if (!deck) return;
      deck.wordIds = [...new Set([...deck.wordIds.map(String), ...selectedVocabIds])];
      persistState();
      renderVocabDashboard();
      renderVocabList();
    });

    document.getElementById("btn-batch-mark-learned")?.addEventListener("click", () => {
      if (!selectedVocabIds.size) return;
      selectedVocabIds.forEach((id) => {
        appState.progress[id] = {
          type: "vocab",
          ...DATA.calculateNextSrs(appState.progress[id], "완벽함")
        };
      });
      persistState();
      renderVocabList();
    });

    document.getElementById("vocab-list-container")?.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      if (target.matches(".vocab-row-check")) {
        if (target.checked) selectedVocabIds.add(target.value);
        else selectedVocabIds.delete(target.value);
        updateBatchSelectionUI();
        return;
      }

      const speakWord = target.getAttribute("data-speak-word");
      if (speakWord) {
        speakJapanese(speakWord);
        return;
      }

      const favId = target.getAttribute("data-toggle-fav");
      if (favId) {
        const set = new Set(appState.favorites.map(String));
        if (set.has(favId)) set.delete(favId);
        else set.add(favId);
        appState.favorites = [...set];
        persistState();
        renderVocabList();
        return;
      }

      if (target.classList.contains("maskable-kana") || target.classList.contains("maskable-meaning")) {
        target.classList.toggle("is-revealed");
      }
    });

    document.getElementById("vocab-list-container")?.addEventListener("change", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLSelectElement)) return;
      const stId = target.getAttribute("data-status-id");
      if (stId) {
        appState.progress[stId] = {
          type: "vocab",
          ...DATA.calculateNextSrs(appState.progress[stId], target.value)
        };
        persistState();
      }
    });

    document.getElementById("vocab-list-container")?.addEventListener("input", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;
      const memoId = target.getAttribute("data-memo-id");
      if (memoId) {
        appState.posNotes[memoId] = target.value;
        DATA.saveState(appState);
      }
    });

    // 어휘 플래시카드 이벤트
    document.getElementById("fc-scope-select")?.addEventListener("change", (e) => {
      fcScope = e.target.value;
      buildFlashcardDeck(false);
      renderFlashcard();
    });
    document.getElementById("btn-fc-shuffle")?.addEventListener("click", () => {
      buildFlashcardDeck(true);
      renderFlashcard();
    });
    document.getElementById("btn-fc-speak-word")?.addEventListener("click", () => {
      const cur = fcDeck[fcIndex % fcDeck.length];
      if (cur) speakJapanese(cur.word || cur.kana);
    });
    document.getElementById("btn-fc-speak-example")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const cur = fcDeck[fcIndex % fcDeck.length];
      if (cur?.example) speakJapanese(cur.example);
    });
    document.getElementById("btn-fc-toggle-ex-kana")?.addEventListener("click", (e) => {
      e.stopPropagation();
      fcShowExKana = !fcShowExKana;
      renderFlashcard();
    });
    document.getElementById("btn-fc-toggle-ex-meaning")?.addEventListener("click", (e) => {
      e.stopPropagation();
      fcShowExMeaning = !fcShowExMeaning;
      renderFlashcard();
    });
    document.getElementById("btn-fc-favorite")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const cur = fcDeck[fcIndex % fcDeck.length];
      if (!cur) return;
      const idStr = String(cur.id);
      const set = new Set(appState.favorites.map(String));
      if (set.has(idStr)) set.delete(idStr);
      else set.add(idStr);
      appState.favorites = [...set];
      persistState();
      renderFlashcard();
    });
    document.getElementById("fc-simple-memo")?.addEventListener("click", (e) => e.stopPropagation());
    document.getElementById("fc-simple-memo")?.addEventListener("input", (e) => {
      const cur = fcDeck[fcIndex % fcDeck.length];
      if (!cur) return;
      appState.posNotes[String(cur.id)] = e.target.value;
      DATA.saveState(appState);
    });
    document.getElementById("flashcard-card")?.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest("button, input, select, textarea")) return;
      if (target.classList.contains("maskable-kana") || target.classList.contains("maskable-meaning")) {
        target.classList.toggle("is-revealed");
        return;
      }
      flipFlashcard();
    });
    document.getElementById("fc-kanji-chips")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const chip = e.target.closest("[data-kanji-char]");
      if (!chip) return;
      const ch = chip.getAttribute("data-kanji-char");
      fcActiveKanji = fcActiveKanji === ch ? null : ch;
      renderFlashcard();
    });
    document.getElementById("btn-fc-prev")?.addEventListener("click", () => moveFlashcard(-1));
    document.getElementById("btn-fc-next")?.addEventListener("click", () => moveFlashcard(1));
    document.querySelectorAll("[data-srs-rating]").forEach((btn) => {
      btn.addEventListener("click", () => {
        rateCurrentFlashcard(btn.getAttribute("data-srs-rating"));
      });
    });

    // 오답노트 액션
    document.getElementById("btn-clear-wrong-vocab")?.addEventListener("click", () => {
      appState.wrongStats = {};
      persistState();
      renderWrongNotes();
    });
    document.getElementById("vocab-wrong-list")?.addEventListener("click", (e) => {
      const remId = e.target.getAttribute("data-remove-wrong");
      if (!remId) return;
      delete appState.wrongStats[remId];
      persistState();
      renderWrongNotes();
    });

    // 문법 서브탭 & 대시보드 & 목록 & 플래시카드 & 퀴즈
    document.querySelectorAll(".sub-tab-item[data-grammar-subtab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        switchGrammarSubTab(btn.getAttribute("data-grammar-subtab"));
      });
    });

    document.querySelectorAll("#grammar-stats-grid .stat-card[data-grammar-stat]").forEach((card) => {
      card.addEventListener("click", () => {
        const key = card.getAttribute("data-grammar-stat");
        switchGrammarSubTab("grammar-list");
        const stSel = document.getElementById("grammar-status-filter");
        if (stSel) {
          if (key === "due") stSel.value = "DUE";
          else if (["미학습", "모름", "애매함", "완벽함"].includes(key)) stSel.value = key;
          else stSel.value = "ALL";
        }
        renderGrammarList();
      });
    });

    document.getElementById("btn-grammar-start-due-fc")?.addEventListener("click", () => {
      switchGrammarSubTab("grammar-flashcard", { scope: "DUE" });
    });
    document.getElementById("btn-grammar-start-all-fc")?.addEventListener("click", () => {
      switchGrammarSubTab("grammar-flashcard", { scope: "ALL" });
    });
    document.getElementById("btn-grammar-start-quiz")?.addEventListener("click", () => {
      switchGrammarSubTab("grammar-quiz", { autoStartCount: 10 });
    });
    document.getElementById("btn-grammar-go-list")?.addEventListener("click", () => {
      switchGrammarSubTab("grammar-list");
    });

    document.getElementById("grammar-search-input")?.addEventListener("input", renderGrammarList);
    document.getElementById("grammar-connection-filter")?.addEventListener("change", renderGrammarList);
    document.getElementById("grammar-status-filter")?.addEventListener("change", renderGrammarList);

    document.getElementById("grammar-card-list")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-open-grammar-compare]");
      if (!btn) return;
      openGrammarCompareModal(
        btn.getAttribute("data-open-grammar-compare"),
        btn.getAttribute("data-compare-item") || ""
      );
    });

    document.getElementById("grammar-card-list")?.addEventListener("change", (e) => {
      const sel = e.target.closest("[data-grammar-status-id]");
      if (!(sel instanceof HTMLSelectElement)) return;
      const gId = sel.getAttribute("data-grammar-status-id");
      appState.progress[gId] = {
        type: "grammar",
        ...DATA.calculateNextSrs(appState.progress[gId], sel.value)
      };
      persistState();
      renderGrammarDashboard();
    });

    // 문법 플래시카드 이벤트
    document.getElementById("gfc-scope-select")?.addEventListener("change", (e) => {
      gfcScope = e.target.value;
      buildGrammarFlashcardDeck(false);
      renderGrammarFlashcard();
    });
    document.getElementById("btn-gfc-shuffle")?.addEventListener("click", () => {
      buildGrammarFlashcardDeck(true);
      renderGrammarFlashcard();
    });
    document.getElementById("btn-gfc-speak")?.addEventListener("click", () => {
      const cur = gfcDeck[gfcIndex % gfcDeck.length];
      if (cur?.example || cur?.word) speakJapanese(cur.example || cur.word);
    });
    document.getElementById("gfc-simple-memo")?.addEventListener("click", (e) => e.stopPropagation());
    document.getElementById("gfc-simple-memo")?.addEventListener("input", (e) => {
      const cur = gfcDeck[gfcIndex % gfcDeck.length];
      if (!cur) return;
      appState.posNotes[String(cur.id)] = e.target.value;
      DATA.saveState(appState);
    });
    document.getElementById("grammar-flashcard-card")?.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest("button, input, select, textarea")) return;
      const compBtn = target.closest("[data-open-grammar-compare]");
      if (compBtn) {
        openGrammarCompareModal(
          compBtn.getAttribute("data-open-grammar-compare"),
          compBtn.getAttribute("data-compare-item") || ""
        );
        return;
      }
      if (target.classList.contains("maskable-kana") || target.classList.contains("maskable-meaning")) {
        target.classList.toggle("is-revealed");
        return;
      }
      flipGrammarFlashcard();
    });
    document.getElementById("btn-gfc-prev")?.addEventListener("click", () => moveGrammarFlashcard(-1));
    document.getElementById("btn-gfc-next")?.addEventListener("click", () => moveGrammarFlashcard(1));
    document.querySelectorAll("[data-grammar-srs]").forEach((btn) => {
      btn.addEventListener("click", () => {
        rateCurrentGrammarCard(btn.getAttribute("data-grammar-srs"));
      });
    });

    // 문법 퀴즈 시작 버튼
    document.getElementById("btn-run-grammar-quiz-10")?.addEventListener("click", () => {
      window.JLPTQuiz?.startGrammarQuiz(10, "grammar-quiz-runner");
    });
    document.getElementById("btn-run-grammar-quiz-all")?.addEventListener("click", () => {
      window.JLPTQuiz?.startGrammarQuiz("ALL", "grammar-quiz-runner");
    });

    // 유사 문법 비교 모달 닫기
    document.getElementById("btn-close-compare-modal")?.addEventListener("click", () => {
      const modal = document.getElementById("grammar-compare-modal");
      if (modal) modal.hidden = true;
    });

    // 독해 섹션 이벤트 (#panel-reading-section)
    const readingSectionEl = document.getElementById("panel-reading-section");
    readingSectionEl?.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      const catBtn = target.closest("[data-reading-category]");
      if (catBtn) {
        switchReadingCategory(catBtn.getAttribute("data-reading-category") || "ALL");
        return;
      }

      const listBtn = target.closest("[data-select-reading]");
      if (listBtn) {
        handleReadingSelectPassage(listBtn.getAttribute("data-select-reading"));
        return;
      }

      if (target.closest("#btn-reading-tts")) {
        const btn = target.closest("#btn-reading-tts");
        handleReadingSpeak(btn.getAttribute("data-reading-id"));
        return;
      }

      if (target.closest("#btn-reading-toggle-translation")) {
        readingShowTranslation = !readingShowTranslation;
        renderReadingSection();
        return;
      }

      const completeBtn = target.closest("#btn-complete-reading");
      if (completeBtn) {
        handleReadingToggleComplete(completeBtn.getAttribute("data-reading-id"));
        return;
      }

      const choiceBtn = target.closest(".reading-choice-btn");
      if (choiceBtn) {
        handleReadingSelectChoice(
          choiceBtn.getAttribute("data-reading-id"),
          choiceBtn.getAttribute("data-question-id"),
          choiceBtn.getAttribute("data-choice-index")
        );
        return;
      }

      if (target.classList.contains("maskable-meaning")) {
        target.classList.toggle("is-revealed");
      }
    });

    // 전역 단축키 (입력창/셀렉트/텍스트에어리어 포커스 시 충돌 방지)
    document.addEventListener("keydown", (e) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase() || "";
      const isEditable =
        activeTag === "input" ||
        activeTag === "textarea" ||
        activeTag === "select" ||
        Boolean(document.activeElement?.isContentEditable);

      if (e.key === "?") {
        if (isEditable) return;
        e.preventDefault();
        if (shortcutsModal) shortcutsModal.hidden = !shortcutsModal.hidden;
        return;
      }

      if (e.key === "Escape") {
        if (shortcutsModal && !shortcutsModal.hidden) shortcutsModal.hidden = true;
        const compModal = document.getElementById("grammar-compare-modal");
        if (compModal && !compModal.hidden) compModal.hidden = true;
        return;
      }

      if (isEditable) return;

      const lower = e.key.toLowerCase();
      if (lower === "k") {
        e.preventDefault();
        appState.maskKana = !appState.maskKana;
        persistState();
        return;
      }
      if (lower === "m") {
        e.preventDefault();
        appState.maskMeaning = !appState.maskMeaning;
        persistState();
        return;
      }

      if (activeMainTab === "vocab-section" && activeVocabSubTab === "vocab-flashcard") {
        if (e.code === "Space") {
          e.preventDefault();
          flipFlashcard();
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          moveFlashcard(-1);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          moveFlashcard(1);
        } else if (lower === "r") {
          e.preventDefault();
          const cur = fcDeck[fcIndex % fcDeck.length];
          if (cur) speakJapanese(cur.word || cur.kana);
        } else if (e.key === "0") {
          e.preventDefault();
          rateCurrentFlashcard("미학습");
        } else if (e.key === "1") {
          e.preventDefault();
          rateCurrentFlashcard("모름");
        } else if (e.key === "2") {
          e.preventDefault();
          rateCurrentFlashcard("애매함");
        } else if (e.key === "3") {
          e.preventDefault();
          rateCurrentFlashcard("완벽함");
        }
      } else if (activeMainTab === "grammar-section" && activeGrammarSubTab === "grammar-flashcard") {
        if (e.code === "Space") {
          e.preventDefault();
          flipGrammarFlashcard();
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          moveGrammarFlashcard(-1);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          moveGrammarFlashcard(1);
        } else if (lower === "r") {
          e.preventDefault();
          const cur = gfcDeck[gfcIndex % gfcDeck.length];
          if (cur?.example || cur?.word) speakJapanese(cur.example || cur.word);
        } else if (e.key === "0") {
          e.preventDefault();
          rateCurrentGrammarCard("미학습");
        } else if (e.key === "1") {
          e.preventDefault();
          rateCurrentGrammarCard("모름");
        } else if (e.key === "2") {
          e.preventDefault();
          rateCurrentGrammarCard("애매함");
        } else if (e.key === "3") {
          e.preventDefault();
          rateCurrentGrammarCard("완벽함");
        }
      }
    });
  }

  function init() {
    updateDdayBadge();
    applyThemeAndGlobalMasks();
    bindEvents();
    // 초기 진입 시 통합 대시보드만 우선 렌더링 (대량 단어장 DOM 지연 렌더링 유지)
    renderMainDashboard();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.JLPTStudy = {
    getState: () => appState,
    reloadState: () => {
      appState = DATA.loadState();
      return appState;
    },
    switchMainTab,
    switchVocabSubTab,
    switchGrammarSubTab,
    switchReadingCategory,
    switchTab,
    renderReadingSection,
    refreshAllViews,
    speakJapanese
  };
})();
