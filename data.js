(() => {
  "use strict";

  const STORAGE_KEY = "jlpt_n2_study_state_v1";
  const EXAM_DATE = "2026-12-06";

  const DEFAULT_STATE = {
    theme: "light", // "light" | "dark"
    ttsRate: 1.0, // 0.6 ~ 1.4
    maskKana: false,
    maskMeaning: false,
    // id -> { type, status: "미학습" | "모름" | "애매함" | "완벽함", easeLevel, intervalDays, nextReviewDate, lastReviewedAt }
    progress: {},
    favorites: [], // item id 배열
    customDecks: [], // { id, name, wordIds }
    posNotes: {}, // item id -> 메모 문자열
    wrongStats: {}, // item id -> { count, lastWrongAt, lastMode }
    // readingId -> { completed: boolean, solvedQuestions: { [qId]: selectedIndex }, completedAt: string | null }
    readingProgress: {}
  };

  function normalizeId(rawId) {
    if (rawId === undefined || rawId === null) return "";
    return String(rawId).trim();
  }

  function normalizeStatus(rawStatus) {
    if (rawStatus === "완벽함" || rawStatus === "외움") return "완벽함";
    if (rawStatus === "애매함" || rawStatus === "헷갈림") return "애매함";
    if (rawStatus === "모름") return "모름";
    if (rawStatus === "미학습" || rawStatus === "미암기") return "미학습";
    return "미학습";
  }

  function normalizeExamTag(tag) {
    if (!tag) return "";
    const raw = String(tag).trim();
    const match = raw.match(/(\d{4})/);
    if (match) return `${match[1]}년`;
    return raw;
  }

  function mergeDuplicateEntries(items) {
    const map = new Map();
    (items || []).forEach((item, idx) => {
      if (!item || typeof item !== "object") return;
      const key = `${String(item.word || "").trim()}__${String(item.kana || "").trim()}`;
      if (!key || key === "__") {
        map.set(`__unique_${idx}`, { ...item });
        return;
      }

      if (!map.has(key)) {
        const normalizedTags = Array.isArray(item.examTags)
          ? [...new Set(item.examTags.map(normalizeExamTag).filter(Boolean))]
          : [];
        map.set(key, {
          ...item,
          examTags: normalizedTags
        });
      } else {
        const existing = map.get(key);
        const existingTags = Array.isArray(existing.examTags) ? existing.examTags : [];
        const incomingTags = Array.isArray(item.examTags) ? item.examTags : [];
        existing.examTags = [
          ...new Set([...existingTags, ...incomingTags].map(normalizeExamTag).filter(Boolean))
        ];

        if (!existing.example && item.example) existing.example = item.example;
        if (!existing.exampleKana && item.exampleKana) existing.exampleKana = item.exampleKana;
        if (!existing.exampleMeaning && item.exampleMeaning) existing.exampleMeaning = item.exampleMeaning;
        if (!existing.meaning && item.meaning) existing.meaning = item.meaning;
        if ((!existing.synonyms || !existing.synonyms.length) && Array.isArray(item.synonyms)) {
          existing.synonyms = [...item.synonyms];
        }
        if (!existing.connection && item.connection) existing.connection = item.connection;
        if ((!existing.compareGrammar || !existing.compareGrammar.length) && Array.isArray(item.compareGrammar)) {
          existing.compareGrammar = [...item.compareGrammar];
        }
      }
    });
    return Array.from(map.values());
  }

  function normalizeGrammarList(rawList) {
    if (!Array.isArray(rawList)) return [];
    const seen = new Set();
    const normalized = [];
    rawList.forEach((item, idx) => {
      if (!item || typeof item !== "object") return;
      const id = normalizeId(item.id || `g-${idx + 1}`);
      if (!id || seen.has(id)) return;
      seen.add(id);
      normalized.push({
        ...item,
        id,
        type: "grammar",
        pattern: item.pattern || item.word || "",
        kana: item.kana || item.pattern || item.word || "",
        meaning: item.meaning || "",
        connection: item.connection || "",
        explanation: item.explanation || "",
        example: item.example || "",
        exampleKana: item.exampleKana || "",
        exampleMeaning: item.exampleMeaning || "",
        compareGrammar: Array.isArray(item.compareGrammar) ? item.compareGrammar : []
      });
    });
    return normalized;
  }

  function normalizeReadingList(rawList) {
    if (!Array.isArray(rawList)) return [];
    const seen = new Set();
    const normalized = [];

    rawList.forEach((item, idx) => {
      if (!item || typeof item !== "object") return;
      const id = normalizeId(item.id || `r-${idx + 1}`);
      if (!id || seen.has(id)) return;
      seen.add(id);

      const questions = Array.isArray(item.questions)
        ? item.questions.map((q, qIdx) => ({
            qId: normalizeId(q?.qId || `${id}-q${qIdx + 1}`),
            question: String(q?.question || ""),
            choices: Array.isArray(q?.choices) ? q.choices.map(String) : [],
            answerIndex: Number.isFinite(Number(q?.answerIndex)) ? Number(q.answerIndex) : 0,
            clueSentence: String(q?.clueSentence || ""),
            explanation: String(q?.explanation || ""),
            wrongReasons:
              q && q.wrongReasons && typeof q.wrongReasons === "object" ? { ...q.wrongReasons } : {}
          }))
        : [];

      const relatedVocabGrammar = Array.isArray(item.relatedVocabGrammar)
        ? item.relatedVocabGrammar.map((entry) => ({
            term: String(entry?.term || ""),
            reading: String(entry?.reading || ""),
            meaning: String(entry?.meaning || ""),
            note: String(entry?.note || "")
          }))
        : [];

      normalized.push({
        ...item,
        id,
        type: "reading",
        category: String(item.category || "단문"),
        examTypeLabel: String(item.examTypeLabel || item.category || "독해"),
        title: String(item.title || `독해 지문 ${idx + 1}`),
        estimatedMinutes: Number.isFinite(Number(item.estimatedMinutes))
          ? Number(item.estimatedMinutes)
          : 3,
        passage: String(item.passage || ""),
        passageA: String(item.passageA || ""),
        passageB: String(item.passageB || ""),
        footnotes: Array.isArray(item.footnotes) ? item.footnotes.map(String) : [],
        translation: String(item.translation || ""),
        translationA: String(item.translationA || ""),
        translationB: String(item.translationB || ""),
        questions,
        relatedVocabGrammar
      });
    });

    return normalized;
  }

  // 개별 어휘·문법·독해 DB 안전 병합
  const kanjiReadingList = Array.isArray(window.KANJI_READING_DB) ? window.KANJI_READING_DB : [];
  const notationExamList = Array.isArray(window.NOTATION_EXAM_DB) ? window.NOTATION_EXAM_DB : [];
  const wordFormationList = Array.isArray(window.WORD_FORMATION_DB) ? window.WORD_FORMATION_DB : [];
  const contextCompList = Array.isArray(window.CONTEXT_COMPOSITION_DB)
    ? window.CONTEXT_COMPOSITION_DB
    : [];
  const synonymExprList = Array.isArray(window.SYNONYM_EXPR_DB) ? window.SYNONYM_EXPR_DB : [];
  const usageExamList = Array.isArray(window.USAGE_EXAM_DB) ? window.USAGE_EXAM_DB : [];

  const mergedFromParts = mergeDuplicateEntries([
    ...kanjiReadingList,
    ...notationExamList,
    ...wordFormationList,
    ...contextCompList,
    ...synonymExprList,
    ...usageExamList
  ]);

  const VOCAB_DB = mergedFromParts.length > 0 ? mergedFromParts : [];

  const grammarPart1 = Array.isArray(window.GRAMMAR_DB) ? window.GRAMMAR_DB : [];
  const grammarPart2 = Array.isArray(window.GRAMMAR_DB_51_100) ? window.GRAMMAR_DB_51_100 : [];
  const grammarPart3 = Array.isArray(window.GRAMMAR_DB_101_150) ? window.GRAMMAR_DB_101_150 : [];
  const grammarPart4 = Array.isArray(window.GRAMMAR_DB_4) ? window.GRAMMAR_DB_4 : [];

  const GRAMMAR_DB = normalizeGrammarList([
    ...grammarPart1,
    ...grammarPart2,
    ...grammarPart3,
    ...grammarPart4
  ]);

  const rawReadingSource = Array.isArray(window.JLPT_READING_DB)
    ? window.JLPT_READING_DB
    : Array.isArray(window.READING_DB)
    ? window.READING_DB
    : [];

  const READING_DB = normalizeReadingList(rawReadingSource);

  function formatDuplicateExamLabel(examTags) {
    if (!Array.isArray(examTags) || examTags.length < 2) return "";
    const years = examTags
      .map((tag) => {
        const match = String(tag).match(/(\d{4})/);
        return match ? match[1] : String(tag).trim();
      })
      .filter(Boolean);
    if (years.length < 2) return "";
    return `${years.map((y) => (y.endsWith("년") ? y : `${y}년`)).join("·")}도 중복 기출`;
  }

  function isHiraganaOnly(text) {
    if (!text || typeof text !== "string") return false;
    const trimmed = text.trim();
    if (!trimmed) return false;
    return /^[ぁ-ゟー]+$/u.test(trimmed);
  }

  function extractKanjiChars(word) {
    if (!word || typeof word !== "string") return [];
    const matches = word.match(/[\u4E00-\u9FFF々]/gu) || [];
    return [...new Set(matches)];
  }

  function findWordsByKanji(kanjiChar, excludeId = null) {
    if (!kanjiChar) return [];
    const targetExclude =
      excludeId !== null && excludeId !== undefined ? String(excludeId) : null;
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

  function calculateNextSrs(prevRecord, ratingOrStatus) {
    const prevInterval =
      prevRecord && typeof prevRecord.intervalDays === "number" ? prevRecord.intervalDays : 0;
    const prevEase =
      prevRecord && typeof prevRecord.easeLevel === "number" ? prevRecord.easeLevel : 1;
    const normalized = normalizeStatus(ratingOrStatus);

    if (normalized === "미학습") {
      return {
        status: "미학습",
        easeLevel: 1,
        intervalDays: 0,
        nextReviewDate: getTodayISO(0),
        lastReviewedAt: new Date().toISOString()
      };
    }

    if (normalized === "완벽함") {
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

    if (normalized === "애매함") {
      const intervalDays = prevInterval >= 2 ? 2 : 1;
      return {
        status: "애매함",
        easeLevel: Math.max(1, prevEase),
        intervalDays,
        nextReviewDate: getTodayISO(intervalDays),
        lastReviewedAt: new Date().toISOString()
      };
    }

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

  function sanitizeReadingProgressEntry(rp) {
    if (!rp || typeof rp !== "object") {
      return {
        completed: false,
        solvedQuestions: {},
        completedAt: null
      };
    }

    const solvedQuestions = {};
    if (rp.solvedQuestions && typeof rp.solvedQuestions === "object") {
      Object.entries(rp.solvedQuestions).forEach(([qId, selIdx]) => {
        const qKey = normalizeId(qId);
        const parsedIdx = Number(selIdx);
        if (qKey && Number.isInteger(parsedIdx) && parsedIdx >= 0) {
          solvedQuestions[qKey] = parsedIdx;
        }
      });
    }

    const completed = Boolean(rp.completed);
    const completedAt =
      typeof rp.completedAt === "string" && rp.completedAt
        ? rp.completedAt
        : completed && typeof rp.updatedAt === "string"
        ? rp.updatedAt
        : completed
        ? new Date().toISOString()
        : null;

    return {
      completed,
      solvedQuestions,
      completedAt
    };
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
        const key = normalizeId(id);
        if (!key) return;
        base.readingProgress[key] = sanitizeReadingProgressEntry(rp);
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

  function updateReadingAnswer(readingId, qId, selectedIndex, state = null) {
    const rKey = normalizeId(readingId);
    const qKey = normalizeId(qId);
    const idx = Number(selectedIndex);
    if (!rKey || !qKey || !Number.isInteger(idx) || idx < 0) {
      return state || loadState();
    }

    const current = sanitizeState(state || loadState());
    current.readingProgress = current.readingProgress || {};
    const prev = sanitizeReadingProgressEntry(current.readingProgress[rKey]);

    const passageObj = READING_DB.find((item) => String(item.id) === rKey);
    const totalQuestions = Array.isArray(passageObj?.questions) ? passageObj.questions.length : 0;

    const nextSolved = {
      ...prev.solvedQuestions,
      [qKey]: idx
    };

    const allSolved =
      totalQuestions > 0 &&
      passageObj.questions.every((q) => nextSolved[normalizeId(q.qId)] !== undefined);

    const completed = prev.completed || allSolved;
    const completedAt = completed
      ? prev.completedAt || new Date().toISOString()
      : null;

    current.readingProgress[rKey] = {
      completed,
      solvedQuestions: nextSolved,
      completedAt
    };

    return saveState(current);
  }

  function toggleReadingCompleted(readingId, forceCompleted = null, state = null) {
    const rKey = normalizeId(readingId);
    if (!rKey) return state || loadState();

    const current = sanitizeState(state || loadState());
    current.readingProgress = current.readingProgress || {};
    const prev = sanitizeReadingProgressEntry(current.readingProgress[rKey]);

    const nextCompleted =
      typeof forceCompleted === "boolean" ? forceCompleted : !prev.completed;

    current.readingProgress[rKey] = {
      completed: nextCompleted,
      solvedQuestions: { ...prev.solvedQuestions },
      completedAt: nextCompleted ? prev.completedAt || new Date().toISOString() : null
    };

    return saveState(current);
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
    let learned = 0;
    let ambiguous = 0;
    let unknown = 0;
    let unlearned = 0;
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
    let learned = 0;
    let ambiguous = 0;
    let unknown = 0;
    let unstudied = 0;
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
    const readingTotal = READING_DB.length;
    let readingDone = 0;
    let solvedQuestionCount = 0;
    let totalQuestionCount = 0;

    READING_DB.forEach((item) => {
      const idStr = String(item.id);
      const rp = sanitizeReadingProgressEntry(clean.readingProgress[idStr]);
      if (rp.completed) readingDone += 1;

      const qList = Array.isArray(item.questions) ? item.questions : [];
      totalQuestionCount += qList.length;
      qList.forEach((q) => {
        if (rp.solvedQuestions[normalizeId(q.qId)] !== undefined) {
          solvedQuestionCount += 1;
        }
      });
    });

    const weakReading = Math.max(0, readingTotal - readingDone);

    return {
      total: readingTotal,
      completed: readingDone,
      incomplete: weakReading,
      readingTotal,
      readingDone,
      weakReading,
      solvedQuestionCount,
      totalQuestionCount,
      rate: readingTotal > 0 ? Math.round((readingDone / readingTotal) * 100) : 0
    };
  }

  function getOverallStatsSummary(state = loadState()) {
    const clean = sanitizeState(state);
    const vocab = getVocabStatsSummary(clean);
    const grammar = getGrammarStatsSummary(clean);
    const reading = getReadingStatsSummary(clean);

    const vocabRate = vocab.total > 0 ? Math.round((vocab.learned / vocab.total) * 100) : 0;
    const totalUnits = vocab.total + grammar.total + reading.readingTotal;
    const completedUnits = vocab.learned + grammar.learned + reading.readingDone;
    const overallRate = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;

    return {
      overallRate,
      readingTotal: reading.readingTotal,
      readingDone: reading.readingDone,
      weakReading: reading.weakReading,
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
        incompleteReading: reading.weakReading
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
    sanitizeReadingProgressEntry,
    sanitizeState,
    loadState,
    saveState,
    updateReadingAnswer,
    toggleReadingCompleted,
    exportStateToJson,
    importStateFromJson,
    resetAllData,
    getVocabStatsSummary,
    getGrammarStatsSummary,
    getReadingStatsSummary,
    getOverallStatsSummary
  };
})();
