(() => {
  "use strict";

  const STORAGE_KEY = "jlpt_n2_study_state_v1";
  const EXAM_DATE = "2026-12-06";

  // 상태 체계: "미학습" | "모름" | "애매함" | "완벽함"
  const DEFAULT_STATE = {
    theme: "light", // "light" | "dark"
    ttsRate: 1.0, // 0.6 ~ 1.4
    maskKana: false,
    maskMeaning: false,
    // [id]: { type: "vocab"|"grammar", status: "미학습"|"모름"|"애매함"|"완벽함", easeLevel, intervalDays, nextReviewDate, lastReviewedAt }
    progress: {},
    favorites: [], // 어휘/문법 ID 배열
    customDecks: [], // { id: string, name: string, wordIds: string[] }
    posNotes: {}, // [id]: 메모 문자열
    wrongStats: {}, // [id]: { count: number, lastWrongAt: string, lastMode: string }
    readingProgress: {} // [readingId]: { completed: boolean, score: number, total: number, updatedAt: string }
  };

  function normalizeId(rawId, fallback = "") {
    if (rawId === undefined || rawId === null) return fallback;
    const str = String(rawId).trim();
    return str || fallback;
  }

  function normalizeStatus(rawStatus) {
    if (rawStatus === "완벽함" || rawStatus === "외움") return "완벽함";
    if (rawStatus === "애매함" || rawStatus === "헷갈림") return "애매함";
    if (rawStatus === "모름") return "모름";
    return "미학습";
  }

  function normalizeExamTag(tag) {
    const raw = String(tag ?? "").trim();
    if (!raw) return "";
    const yearMatch = raw.match(/^(\d{4})(?:년|년도)?$/);
    if (yearMatch) {
      return `${yearMatch[1]}년`;
    }
    return raw;
  }

  function mergeDuplicateEntries(items) {
    const map = new Map();

    (Array.isArray(items) ? items : []).forEach((item, index) => {
      if (!item || typeof item !== "object" || !item.word) return;
      const wordKey = String(item.word).trim();
      const kanaKey = String(item.kana || "").trim();
      if (!wordKey) return;

      const key = `${wordKey}__${kanaKey}`;
      const rawTags =
        Array.isArray(item.examTags) && item.examTags.length
          ? item.examTags
          : item.category
          ? [item.category]
          : [];
      const normalizedTags = rawTags.map(normalizeExamTag).filter(Boolean);

      if (!map.has(key)) {
        map.set(key, {
          ...item,
          id: normalizeId(item.id, `vocab-${index + 1}`),
          type: item.type || "vocab",
          category: item.category || "어휘",
          word: wordKey,
          kana: kanaKey,
          meaning: item.meaning || "",
          pos: item.pos || "",
          examTags: [...new Set(normalizedTags)],
          example: item.example || "",
          exampleKana: item.exampleKana || "",
          exampleMeaning: item.exampleMeaning || "",
          synonyms: Array.isArray(item.synonyms) ? [...new Set(item.synonyms.filter(Boolean))] : [],
          connection: item.connection ?? null,
          compareGrammar: Array.isArray(item.compareGrammar)
            ? [...new Set(item.compareGrammar.filter(Boolean))]
            : []
        });
      } else {
        const existing = map.get(key);
        existing.examTags = [...new Set([...existing.examTags, ...normalizedTags])];
        if (!existing.meaning && item.meaning) existing.meaning = item.meaning;
        if (!existing.pos && item.pos) existing.pos = item.pos;
        if (!existing.example && item.example) {
          existing.example = item.example;
          existing.exampleKana = item.exampleKana || "";
          existing.exampleMeaning = item.exampleMeaning || "";
        }
        if (Array.isArray(item.synonyms) && item.synonyms.length) {
          existing.synonyms = [...new Set([...existing.synonyms, ...item.synonyms.filter(Boolean)])];
        }
        if (Array.isArray(item.compareGrammar) && item.compareGrammar.length) {
          existing.compareGrammar = [
            ...new Set([...existing.compareGrammar, ...item.compareGrammar.filter(Boolean)])
          ];
        }
      }
    });

    return [...map.values()];
  }

  function normalizeGrammarList(rawList) {
    const map = new Map();

    (Array.isArray(rawList) ? rawList : [])
      .filter((g) => g && typeof g === "object" && (g.word || g.pattern))
      .forEach((g, idx) => {
        const id = normalizeId(g.id, `g-${String(idx + 1).padStart(3, "0")}`);
        const normalizedItem = {
          id,
          type: "grammar",
          category: String(g.category || "문법").trim(),
          pattern: String(g.pattern || g.word).trim(),
          word: String(g.word || g.pattern).trim(),
          kana: String(g.kana || g.word || g.pattern).trim(),
          meaning: String(g.meaning || "").trim(),
          connection: String(g.connection || "기타").trim(),
          collocation: String(g.collocation || "").trim(),
          compareGrammar: Array.isArray(g.compareGrammar) ? g.compareGrammar : [],
          example: String(g.example || "").trim(),
          exampleKana: String(g.exampleKana || "").trim(),
          exampleMeaning: String(g.exampleMeaning || "").trim(),
          explanation: String(g.explanation || "").trim(),
          examHistory: Array.isArray(g.examHistory) ? g.examHistory : []
        };
        map.set(id, normalizedItem);
      });

    return [...map.values()].sort((a, b) => {
      const numA = parseInt(a.id.replace(/\D/g, ""), 10);
      const numB = parseInt(b.id.replace(/\D/g, ""), 10);
      if (Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) {
        return numA - numB;
      }
      return a.id.localeCompare(b.id);
    });
  }

  function normalizeReadingList(rawList) {
    return (Array.isArray(rawList) ? rawList : [])
      .filter((r) => r && typeof r === "object" && r.passage)
      .map((r, idx) => ({
        id: normalizeId(r.id, `r-${idx + 1}`),
        type: "reading",
        category: String(r.category || "단문").trim(),
        title: String(r.title || `독해 지문 ${idx + 1}`).trim(),
        passage: String(r.passage).trim(),
        passageKana: String(r.passageKana || "").trim(),
        translation: String(r.translation || "").trim(),
        questions: Array.isArray(r.questions) ? r.questions : [],
        notes: Array.isArray(r.notes) ? r.notes : []
      }));
  }

  const kanjiReadingList = Array.isArray(window.KANJI_READING_DB) ? window.KANJI_READING_DB : [];
  const notationExamList = Array.isArray(window.NOTATION_EXAM_DB) ? window.NOTATION_EXAM_DB : [];
  const wordFormationList = Array.isArray(window.WORD_FORMATION_DB) ? window.WORD_FORMATION_DB : [];
  const contextCompositionList = Array.isArray(window.CONTEXT_COMPOSITION_DB)
    ? window.CONTEXT_COMPOSITION_DB
    : [];
  const synonymExprList = Array.isArray(window.SYNONYM_EXPR_DB) ? window.SYNONYM_EXPR_DB : [];
  const usageExamList = Array.isArray(window.USAGE_EXAM_DB) ? window.USAGE_EXAM_DB : [];
  const extraVocabList = Array.isArray(window.EXTRA_VOCAB_DB) ? window.EXTRA_VOCAB_DB : [];

  const grammarPart1 = Array.isArray(window.GRAMMAR_DB) ? window.GRAMMAR_DB : [];
  const grammarPart2 = Array.isArray(window.GRAMMAR_DB_51_100) ? window.GRAMMAR_DB_51_100 : [];
  const grammarPart3 = Array.isArray(window.GRAMMAR_DB_101_150) ? window.GRAMMAR_DB_101_150 : [];
  const grammarPart4 = Array.isArray(window.GRAMMAR_DB_4) ? window.GRAMMAR_DB_4 : [];

  const VOCAB_DB = mergeDuplicateEntries([
    ...kanjiReadingList,
    ...notationExamList,
    ...wordFormationList,
    ...contextCompositionList,
    ...synonymExprList,
    ...usageExamList,
    ...extraVocabList
  ]);

  const GRAMMAR_DB = normalizeGrammarList([
    ...grammarPart1,
    ...grammarPart2,
    ...grammarPart3,
    ...grammarPart4
  ]);
  const READING_DB = normalizeReadingList(window.READING_DB);

  function formatDuplicateExamLabel(examTags) {
    if (!Array.isArray(examTags) || examTags.length < 2) return "";
    const uniqueTags = [...new Set(examTags.map((t) => String(t).trim()).filter(Boolean))];
    if (uniqueTags.length < 2) return "";

    const years = uniqueTags
      .map((tag) => {
        const match = tag.match(/(\d{4})/);
        return match ? `${match[1]}년` : null;
      })
      .filter(Boolean);

    if (years.length >= 2) {
      return `(${[...new Set(years)].sort().join("·")}도 중복 기출)`;
    }
    return `(${uniqueTags.join("·")} 중복 기출)`;
  }

  function isHiraganaOnly(text) {
    if (!text || typeof text !== "string") return false;
    const trimmed = text.trim();
    if (!trimmed) return false;
    return /^[ぁ-ゟー・\s]+$/u.test(trimmed);
  }

  function extractKanjiChars(word) {
    if (!word || typeof word !== "string") return [];
    const matches = word.match(/[\u4E00-\u9FFF々]/gu) || [];
    return [...new Set(matches)];
  }

  function findWordsByKanji(kanjiChar, excludeId = null) {
    if (!kanjiChar) return [];
    const targetExclude = excludeId !== null && excludeId !== undefined ? String(excludeId) : null;
    return VOCAB_DB.filter(
      (item) =>
        String(item.id) !== targetExclude &&
        typeof item.word === "string" &&
        item.word.includes(kanjiChar)
    );
  }

  function getTodayISO(offsetDays = 0) {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() + offsetDays);
    const yyyy = base.getFullYear();
    const mm = String(base.getMonth() + 1).padStart(2, "0");
    const dd = String(base.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // SRS 4단계 평가 반영: "미학습" | "모름" | "애매함" | "완벽함"
  function calculateNextSrs(prevRecord, ratingOrStatus) {
    const prevInterval =
      prevRecord && typeof prevRecord.intervalDays === "number" ? prevRecord.intervalDays : 0;
    const prevEase = prevRecord && typeof prevRecord.easeLevel === "number" ? prevRecord.easeLevel : 1;

    if (ratingOrStatus === "미학습") {
      return {
        status: "미학습",
        easeLevel: 1,
        intervalDays: 0,
        nextReviewDate: getTodayISO(0),
        lastReviewedAt: new Date().toISOString()
      };
    }

    if (ratingOrStatus === "완벽함" || ratingOrStatus === "외움") {
      const easeLevel = Math.min(5, prevEase + 1);
      let intervalDays = 3;
      if (prevInterval <= 0) intervalDays = 3;
      else if (prevInterval < 7) intervalDays = 7;
      else intervalDays = Math.min(60, Math.round(prevInterval * 2.2));

      return {
        status: "완벽함",
        easeLevel,
        intervalDays,
        nextReviewDate: getTodayISO(intervalDays),
        lastReviewedAt: new Date().toISOString()
      };
    }

    if (ratingOrStatus === "애매함" || ratingOrStatus === "헷갈림") {
      const intervalDays = prevInterval >= 2 ? 2 : 1;
      return {
        status: "애매함",
        easeLevel: Math.max(1, prevEase),
        intervalDays,
        nextReviewDate: getTodayISO(intervalDays),
        lastReviewedAt: new Date().toISOString()
      };
    }

    // "모름"
    return {
      status: "모름",
      easeLevel: 1,
      intervalDays: 1,
      nextReviewDate: getTodayISO(1),
      lastReviewedAt: new Date().toISOString()
    };
  }

  function isDueForReview(itemId, state) {
    const key = normalizeId(itemId);
    const rec = state && state.progress ? state.progress[key] : null;
    if (!rec || !rec.nextReviewDate) return true;
    return rec.nextReviewDate <= getTodayISO(0);
  }

  function cloneDefaultState() {
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  function sanitizeState(raw) {
    const base = cloneDefaultState();
    if (!raw || typeof raw !== "object") return base;

    base.theme = raw.theme === "dark" ? "dark" : "light";

    const parsedRate = Number(raw.ttsRate);
    base.ttsRate =
      Number.isFinite(parsedRate) && parsedRate >= 0.6 && parsedRate <= 1.4 ? parsedRate : 1.0;

    base.maskKana = Boolean(raw.maskKana);
    base.maskMeaning = Boolean(raw.maskMeaning);

    if (raw.progress && typeof raw.progress === "object") {
      Object.entries(raw.progress).forEach(([id, entry]) => {
        if (!entry || typeof entry !== "object") return;
        const key = normalizeId(id);
        if (!key) return;
        base.progress[key] = {
          type: entry.type === "grammar" ? "grammar" : "vocab",
          status: normalizeStatus(entry.status),
          easeLevel: Number.isFinite(Number(entry.easeLevel)) ? Number(entry.easeLevel) : 1,
          intervalDays: Number.isFinite(Number(entry.intervalDays)) ? Number(entry.intervalDays) : 0,
          nextReviewDate:
            typeof entry.nextReviewDate === "string" && entry.nextReviewDate
              ? entry.nextReviewDate
              : getTodayISO(0),
          lastReviewedAt: entry.lastReviewedAt || null
        };
      });
    }

    if (Array.isArray(raw.favorites)) {
      base.favorites = [...new Set(raw.favorites.map((id) => normalizeId(id)).filter(Boolean))];
    }

    if (Array.isArray(raw.customDecks)) {
      base.customDecks = raw.customDecks
        .filter((d) => d && typeof d.name === "string" && d.name.trim())
        .map((d, idx) => ({
          id: typeof d.id === "string" && d.id ? d.id : `deck_${Date.now()}_${idx}`,
          name: d.name.trim(),
          wordIds: Array.isArray(d.wordIds)
            ? [...new Set(d.wordIds.map((id) => normalizeId(id)).filter(Boolean))]
            : []
        }));
    }

    if (raw.posNotes && typeof raw.posNotes === "object") {
      Object.entries(raw.posNotes).forEach(([id, note]) => {
        const key = normalizeId(id);
        if (key && typeof note === "string") {
          base.posNotes[key] = note;
        }
      });
    }

    if (raw.wrongStats && typeof raw.wrongStats === "object") {
      Object.entries(raw.wrongStats).forEach(([id, stat]) => {
        if (!stat || typeof stat !== "object") return;
        const key = normalizeId(id);
        const cnt = Number(stat.count);
        if (key && Number.isFinite(cnt) && cnt > 0) {
          base.wrongStats[key] = {
            count: Math.floor(cnt),
            lastWrongAt:
              typeof stat.lastWrongAt === "string" ? stat.lastWrongAt : new Date().toISOString(),
            lastMode: typeof stat.lastMode === "string" ? stat.lastMode : "quiz"
          };
        }
      });
    }

    if (raw.readingProgress && typeof raw.readingProgress === "object") {
      Object.entries(raw.readingProgress).forEach(([id, rp]) => {
        if (!rp || typeof rp !== "object") return;
        const key = normalizeId(id);
        if (!key) return;
        base.readingProgress[key] = {
          completed: Boolean(rp.completed),
          score: Number.isFinite(Number(rp.score)) ? Number(rp.score) : 0,
          total: Number.isFinite(Number(rp.total)) ? Number(rp.total) : 0,
          updatedAt: typeof rp.updatedAt === "string" ? rp.updatedAt : new Date().toISOString()
        };
      });
    }

    return base;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return cloneDefaultState();
      return sanitizeState(JSON.parse(raw));
    } catch (_) {
      return cloneDefaultState();
    }
  }

  function saveState(state) {
    const clean = sanitizeState(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    return clean;
  }

  function exportStateToJson(state) {
    const payload = {
      app: "JLPT-N2-Study-App",
      version: 2,
      examDate: EXAM_DATE,
      exportedAt: new Date().toISOString(),
      data: sanitizeState(state)
    };
    const jsonText = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonText], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `jlpt-n2-backup-${getTodayISO(0)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return jsonText;
  }

  function importStateFromJson(jsonText) {
    if (typeof jsonText !== "string" || !jsonText.trim()) {
      return { ok: false, error: "JSON 파일 내용이 비어 있습니다." };
    }
    try {
      const parsed = JSON.parse(jsonText);
      const rawData =
        parsed && typeof parsed === "object" && parsed.data && typeof parsed.data === "object"
          ? parsed.data
          : parsed;

      if (!rawData || typeof rawData !== "object") {
        return { ok: false, error: "유효하지 않은 학습 데이터 형식입니다." };
      }

      const sanitized = sanitizeState(rawData);
      saveState(sanitized);
      return { ok: true, state: sanitized };
    } catch (_) {
      return { ok: false, error: "JSON 구문 오류로 불러오기에 실패했습니다." };
    }
  }

  function resetAllData() {
    localStorage.removeItem(STORAGE_KEY);
    return saveState(cloneDefaultState());
  }

  function getVocabStatsSummary(state = loadState()) {
    const clean = sanitizeState(state);
    const total = VOCAB_DB.length;
    let learned = 0; // 완벽함
    let ambiguous = 0; // 애매함
    let unknown = 0; // 모름
    let unlearned = 0; // 미학습
    let due = 0;
    let wrongCount = 0;

    const vocabIdSet = new Set(VOCAB_DB.map((v) => String(v.id)));

    VOCAB_DB.forEach((item) => {
      const idStr = String(item.id);
      const rec = clean.progress[idStr];
      const status = rec ? normalizeStatus(rec.status) : "미학습";

      if (status === "완벽함") learned += 1;
      else if (status === "애매함") ambiguous += 1;
      else if (status === "모름") unknown += 1;
      else unlearned += 1;

      if (isDueForReview(idStr, clean)) {
        due += 1;
      }
    });

    const favoriteCount = clean.favorites.filter((id) => vocabIdSet.has(String(id))).length;

    Object.entries(clean.wrongStats).forEach(([id, stat]) => {
      if (vocabIdSet.has(String(id)) && stat && Number(stat.count) > 0) {
        wrongCount += Number(stat.count);
      }
    });

    return {
      total,
      due,
      learned,
      ambiguous,
      unknown,
      unlearned,
      favorite: favoriteCount,
      wrong: wrongCount
    };
  }

  function getGrammarStatsSummary(state = loadState()) {
    const clean = sanitizeState(state);
    const total = GRAMMAR_DB.length;
    let learned = 0; // 완벽함
    let ambiguous = 0; // 애매함
    let unknown = 0; // 모름
    let unstudied = 0; // 미학습
    let due = 0;

    GRAMMAR_DB.forEach((item) => {
      const idStr = String(item.id);
      const rec = clean.progress[idStr];
      const status = rec ? normalizeStatus(rec.status) : "미학습";

      if (status === "완벽함") learned += 1;
      else if (status === "애매함") ambiguous += 1;
      else if (status === "모름") unknown += 1;
      else unstudied += 1;

      if (isDueForReview(idStr, clean)) due += 1;
    });

    return {
      total,
      due,
      learned,
      ambiguous,
      unknown,
      unstudied,
      rate: total > 0 ? Math.round((learned / total) * 100) : 0
    };
  }

  function getReadingStatsSummary(state = loadState()) {
    const clean = sanitizeState(state);
    const total = READING_DB.length;
    let completed = 0;

    READING_DB.forEach((item) => {
      const rp = clean.readingProgress[String(item.id)];
      if (rp && rp.completed) completed += 1;
    });

    return {
      total,
      completed,
      incomplete: Math.max(0, total - completed),
      rate: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }

  function getOverallStatsSummary(state = loadState()) {
    const clean = sanitizeState(state);
    const vocab = getVocabStatsSummary(clean);
    const grammar = getGrammarStatsSummary(clean);
    const reading = getReadingStatsSummary(clean);

    const vocabRate = vocab.total > 0 ? Math.round((vocab.learned / vocab.total) * 100) : 0;
    const totalUnits = vocab.total + grammar.total + reading.total;
    const completedUnits = vocab.learned + grammar.learned + reading.completed;
    const overallRate = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;

    return {
      overallRate,
      vocab: { ...vocab, rate: vocabRate },
      grammar,
      reading,
      totalDue: vocab.due + grammar.due,
      weak: {
        ambiguousVocab: vocab.ambiguous + vocab.unknown,
        totalWrongRecords: Object.values(clean.wrongStats).reduce(
          (acc, s) => acc + (s && Number(s.count) > 0 ? Number(s.count) : 0),
          0
        ),
        incompleteReading: reading.incomplete
      }
    };
  }

  window.JLPTData = {
    STORAGE_KEY,
    EXAM_DATE,
    DEFAULT_STATE,
    VOCAB_DB,
    GRAMMAR_DB,
    READING_DB,
    normalizeStatus,
    mergeDuplicateEntries,
    formatDuplicateExamLabel,
    isHiraganaOnly,
    extractKanjiChars,
    findWordsByKanji,
    getTodayISO,
    calculateNextSrs,
    isDueForReview,
    sanitizeState,
    loadState,
    saveState,
    exportStateToJson,
    importStateFromJson,
    resetAllData,
    getVocabStatsSummary,
    getGrammarStatsSummary,
    getReadingStatsSummary,
    getOverallStatsSummary
  };
})();
