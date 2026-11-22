(() => {
  "use strict";

  const STORAGE_KEY = "jlpt_n2_study_state_v1";
  const EXAM_DATE = "2026-12-06";

  const DEFAULT_STATE = {
    theme: "light", // "light" | "dark"
    ttsRate: 1.0, // 0.6 ~ 1.4
    maskKana: false,
    maskMeaning: false,
    // id -> { status: "외움" | "헷갈림" | "미암기", easeLevel: number, intervalDays: number, nextReviewDate: string, lastReviewedAt: string | null }
    progress: {},
    favorites: [], // word id 배열
    customDecks: [], // { id: string, name: string, wordIds: number[] }
    posNotes: {}, // word id -> 메모 문자열
    wrongStats: {} // word id -> { count: number, lastWrongAt: string, lastMode: string }
  };

  // 문법·독해 DB를 나중에 덧붙일 수 있도록 타입별 컬렉션으로 확장 가능하게 구성
  const GRAMMAR_DB = [];
  const READING_DB = [];

  // 1.한자읽기 복원 데이터 기반 JLPT N2 어휘 DB (예문 1개·품사·기출태그·유의어·문법확장 필드 포함)
  const VOCAB_DB = [
    {
      id: 1,
      type: "vocab",
      category: "한자읽기",
      word: "握手",
      kana: "あくしゅ",
      meaning: "악수",
      pos: "명사·자동사(する)",
      examTags: ["2018년", "2022년"],
      example: "交渉がまとまり、二人は固く握手をした。",
      exampleKana: "こうしょうがまとまり、ふたりはかたくあくしゅをした。",
      exampleMeaning: "협상이 타결되어 두 사람은 굳게 악수를 했다.",
      synonyms: ["手をつなぐ"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 2,
      type: "vocab",
      category: "한자읽기",
      word: "鮮やか",
      kana: "あざやか",
      meaning: "선명함, 화려함, 훌륭함",
      pos: "형용동사(な형용사)",
      examTags: ["2019년"],
      example: "秋の紅葉がとても鮮やかで目を引いた。",
      exampleKana: "あきのもみじがとてもあざやかでめをひいた。",
      exampleMeaning: "가을 단풍이 매우 선명해서 시선을 끌었다.",
      synonyms: ["くっきり", "見事"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 3,
      type: "vocab",
      category: "한자읽기",
      word: "焦る",
      kana: "あせる",
      meaning: "초조해하다, 조급해하다",
      pos: "동사(5단·자동사)",
      examTags: ["2020년", "2024년"],
      example: "締め切りが迫っているのに原稿が進まず焦る。",
      exampleKana: "しめきりがせまっているのにげんこうがすすまずあせる。",
      exampleMeaning: "마감이 다가오는데 원고가 진척되지 않아 초조하다.",
      synonyms: ["気が気でない", "急く"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 4,
      type: "vocab",
      category: "한자읽기",
      word: "与える",
      kana: "あたえる",
      meaning: "주다, 끼치다",
      pos: "동사(1단·타동사)",
      examTags: ["2017년"],
      example: "SNSの普及は若者の生活に大きな影響を与えた。",
      exampleKana: "えすえぬえすのふきゅうはわかもののせいかつにおおきなえいきょうをあたえた。",
      exampleMeaning: "SNS의 보급은 젊은이의 생활에 큰 영향을 끼쳤다.",
      synonyms: ["もたらす", "提供する"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 5,
      type: "vocab",
      category: "한자읽기",
      word: "温かい",
      kana: "あたたかい",
      meaning: "따뜻하다, 다정하다",
      pos: "형용사(い형용사)",
      examTags: ["2018년"],
      example: "近所の人たちが温かい言葉をかけてくれた。",
      exampleKana: "きんじょのひとたちがあたたかいことばをかけてくれた。",
      exampleMeaning: "이웃 사람들이 따뜻한 말을 건네주었다.",
      synonyms: ["暖かい", "優しい"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 6,
      type: "vocab",
      category: "한자읽기",
      word: "圧勝",
      kana: "あっしょう",
      meaning: "압승",
      pos: "명사·동사(する)",
      examTags: ["2021년"],
      example: "優勝候補のチームが決勝戦を圧勝した。",
      exampleKana: "ゆうしょうこうほのちーむがけっしょうせんをあっしょうした。",
      exampleMeaning: "우승 후보 팀이 결승전에서 압승했다.",
      synonyms: ["大勝", "完勝"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 7,
      type: "vocab",
      category: "한자읽기",
      word: "圧倒的",
      kana: "あっとうてき",
      meaning: "압도적",
      pos: "형용동사(な형용사)",
      examTags: ["2022년", "2025년"],
      example: "今回の調査では賛成意見が圧倒的多数を占めた。",
      exampleKana: "こんかいのちょうさではさんせいいけんがあっとうてきたすうをしめた。",
      exampleMeaning: "이번 조사에서는 찬성 의견이 압도적 다수를 차지했다.",
      synonyms: ["圧倒", "優勢"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 8,
      type: "vocab",
      category: "한자읽기",
      word: "怪しい",
      kana: "あやしい",
      meaning: "수상하다, 의심스럽다",
      pos: "형용사(い형용사)",
      examTags: ["2019년"],
      example: "夜中に裏口で怪しい物音が聞こえた。",
      exampleKana: "よなかにうらぐちであやしいものおとがきこえた。",
      exampleMeaning: "한밤중에 뒷문에서 수상한 소리가 들렸다.",
      synonyms: ["不審だ", "疑わしい"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 9,
      type: "vocab",
      category: "한자읽기",
      word: "誤り",
      kana: "あやまり",
      meaning: "잘못, 틀림, 실수",
      pos: "명사",
      examTags: ["2020년"],
      example: "資料の数字に誤りがないか確認してほしい。",
      exampleKana: "しりょうのすうじにあやまらないかかくにんしてほしい。",
      exampleMeaning: "자료의 숫자에 잘못이 없는지 확인해 주길 바란다.",
      synonyms: ["間違い", "ミス"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 10,
      type: "vocab",
      category: "한자읽기",
      word: "争う",
      kana: "あらそう",
      meaning: "싸우다, 경쟁하다, 다투다",
      pos: "동사(5단·자동사/타동사)",
      examTags: ["2018년", "2023년"],
      example: "上位の座を争う激しい戦いが続いている。",
      exampleKana: "じょういのざをあらそうはげしいたたかいがつづいている。",
      exampleMeaning: "상위 자리를 다투는 치열한 승부가 이어지고 있다.",
      synonyms: ["競う", "争奪する"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 11,
      type: "vocab",
      category: "한자읽기",
      word: "改めて",
      kana: "あらためて",
      meaning: "다시, 새삼스레",
      pos: "부사",
      examTags: ["2021년", "2024년"],
      example: "この件については改めて連絡いたします。",
      exampleKana: "このけんについてはあらためてれんらくいたします。",
      exampleMeaning: "이 건에 대해서는 다시 연락드리겠습니다.",
      synonyms: ["もう一度", "改めまして"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 12,
      type: "vocab",
      category: "한자읽기",
      word: "案外",
      kana: "あんがい",
      meaning: "뜻밖에, 의외로",
      pos: "부사·형용동사",
      examTags: ["2019년", "2023년"],
      example: "難しそうに見えた問題が、やってみると案外簡単だった。",
      exampleKana: "むずかしそうにみえたもんだいが、やってみるとあんがいかんたんだった。",
      exampleMeaning: "어려워 보이던 문제가 풀어 보니 의외로 간단했다.",
      synonyms: ["意外に", "思いのほか"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 13,
      type: "vocab",
      category: "한자읽기",
      word: "言い難い",
      kana: "いいがたい",
      meaning: "말하기 어렵다",
      pos: "형용사(い형용사)",
      examTags: ["2022년"],
      example: "本人の前では言い難い事情がある。",
      exampleKana: "ほんにんのまえではいいがたいじじょうがある。",
      exampleMeaning: "본인 앞에서는 말하기 어려운 사정이 있다.",
      synonyms: ["口にしづらい", "言いにくい"],
      connection: "[동사 ます형(어간) + がたい]",
      compareGrammar: ["〜にくい", "〜づらい"]
    },
    {
      id: 14,
      type: "vocab",
      category: "한자읽기",
      word: "勇ましい",
      kana: "いさましい",
      meaning: "용감하다, 활기차다, 씩씩하다",
      pos: "형용사(い형용사)",
      examTags: ["2020년"],
      example: "太鼓の勇ましい音が会場に響き渡った。",
      exampleKana: "たいこのいさましいおとがかいじょうにひびきわたった。",
      exampleMeaning: "북소리의 씩씩한 울림이 회장에 울려 퍼졌다.",
      synonyms: ["勇気がある", "威勢がいい"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 15,
      type: "vocab",
      category: "한자읽기",
      word: "衣装",
      kana: "いしょう",
      meaning: "의상",
      pos: "명사",
      examTags: ["2018년"],
      example: "舞台俳優たちが華やかな衣装に着替えた。",
      exampleKana: "ぶたいはいゆうたちがはなやかないしょうにきがえた。",
      exampleMeaning: "무대 배우들이 화려한 의상으로 갈아입었다.",
      synonyms: ["衣裳", "服装"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 16,
      type: "vocab",
      category: "한자읽기",
      word: "異常",
      kana: "いじょう",
      meaning: "이상함, 비정상",
      pos: "명사·형용동사",
      examTags: ["2021년", "2024년"],
      example: "機械に異常がないか毎日点検している。",
      exampleKana: "きかいにいじょうがないかまいにちてんけんしている。",
      exampleMeaning: "기계에 이상이 없는지 매일 점검하고 있다.",
      synonyms: ["異変", "故障"],
      connection: null,
      compareGrammar: ["以上 (〜이상)"]
    },
    {
      id: 17,
      type: "vocab",
      category: "한자읽기",
      word: "傷む",
      kana: "いたむ",
      meaning: "상하다, 훼손되다, 아프다",
      pos: "동사(5단·자동사)",
      examTags: ["2019년"],
      example: "湿気が多いと食べ物が傷みやすい。",
      exampleKana: "しっきがおおいとたべものがいたみやすい。",
      exampleMeaning: "습기가 많으면 음식이 쉽게 상한다.",
      synonyms: ["腐る", "痛む"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 18,
      type: "vocab",
      category: "한자읽기",
      word: "著しい",
      kana: "いちじるしい",
      meaning: "현저하다, 두드러지다",
      pos: "형용사(い형용사)",
      examTags: ["2022년", "2025년"],
      example: "近年、医療技術の進歩は著しい。",
      exampleKana: "きんねん、いりょうぎじゅつのしんぽはいちじるしい。",
      exampleMeaning: "최근 의료 기술의 진보는 현저하다.",
      synonyms: ["顕著だ", "目覚ましい"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 19,
      type: "vocab",
      category: "한자읽기",
      word: "移転",
      kana: "いてん",
      meaning: "이전",
      pos: "명사·동사(する)",
      examTags: ["2020년"],
      example: "本社が来月、新しいビルへ移転する予定だ。",
      exampleKana: "ほんしゃがらいげつ、あたらしいびるへいてんするよていだ。",
      exampleMeaning: "본사가 다음 달 새 건물로 이전할 예정이다.",
      synonyms: ["引っ越し", "移動"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 20,
      type: "vocab",
      category: "한자읽기",
      word: "祈る",
      kana: "いのる",
      meaning: "기도하다, 빌다",
      pos: "동사(5단·자동사/타동사)",
      examTags: ["2017년"],
      example: "みんなの健康と安全を心から祈る。",
      exampleKana: "みんなのけんこうとあんぜんをこころからいのる。",
      exampleMeaning: "모두의 건강과 안전을 진심으로 기원한다.",
      synonyms: ["祈願する", "願う"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 21,
      type: "vocab",
      category: "한자읽기",
      word: "違反",
      kana: "いはん",
      meaning: "위반",
      pos: "명사·동사(する)",
      examTags: ["2021년"],
      example: "交通ルールに違反すると罰則が科される。",
      exampleKana: "こうつうるーるいはんするとばっそくがかされる。",
      exampleMeaning: "교통 규칙을 위반하면 벌칙이 부과된다.",
      synonyms: ["違背", "反則"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 22,
      type: "vocab",
      category: "한자읽기",
      word: "医療",
      kana: "いりょう",
      meaning: "의료",
      pos: "명사",
      examTags: ["2019년", "2023년"],
      example: "地域医療の充実が求められている。",
      exampleKana: "ちいきいりょうのじゅうじつがもとめられている。",
      exampleMeaning: "지역 의료의 충실화가 요구되고 있다.",
      synonyms: ["診療", "医学"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 23,
      type: "vocab",
      category: "한자읽기",
      word: "祝う",
      kana: "いわう",
      meaning: "축하하다",
      pos: "동사(5단·타동사)",
      examTags: ["2018년"],
      example: "卒業を家族みんなで祝った。",
      exampleKana: "そつぎょうをかぞくみんなでいわった。",
      exampleMeaning: "졸업을 가족 모두가 함께 축하했다.",
      synonyms: ["祝福する", "慶祝する"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 24,
      type: "vocab",
      category: "한자읽기",
      word: "印刷",
      kana: "いんさつ",
      meaning: "인쇄",
      pos: "명사·동사(する)",
      examTags: ["2020년"],
      example: "配布資料を五十部印刷しておいてください。",
      exampleKana: "はいふしりょうをごじゅうぶいんさつしておいてください。",
      exampleMeaning: "배포 자료를 50부 인쇄해 두시기 바랍니다.",
      synonyms: ["プリント", "刷る"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 25,
      type: "vocab",
      category: "한자읽기",
      word: "植木",
      kana: "うえき",
      meaning: "정원수, 분재",
      pos: "명사",
      examTags: ["2022년"],
      example: "庭の植木に水をやるのが朝の習慣だ。",
      exampleKana: "にわのうえきにみずをやるのがあさのしゅうかんだ。",
      exampleMeaning: "정원의 나무에 물을 주는 것이 아침 습관이다.",
      synonyms: ["庭木", "鉢植え"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 26,
      type: "vocab",
      category: "한자읽기",
      word: "浮く",
      kana: "うく",
      meaning: "떠오르다, 들뜨다, 남다",
      pos: "동사(5단·자동사)",
      examTags: ["2019년", "2024년"],
      example: "水面に落ち葉が浮かんでいる。",
      exampleKana: "すいめんにおちばがうかんでいる。",
      exampleMeaning: "수면에 낙엽이 떠 있다.",
      synonyms: ["浮かぶ", "浮き上がる"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 27,
      type: "vocab",
      category: "한자읽기",
      word: "疑い",
      kana: "うたがい",
      meaning: "의심",
      pos: "명사",
      examTags: ["2021년"],
      example: "彼の言葉には少しも疑いを持たなかった。",
      exampleKana: "かれのことばにはすこしもいぶかしさを持たなかった。",
      exampleMeaning: "그의 말에는 조금도 의심을 품지 않았다.",
      synonyms: ["疑惑", "不信"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 28,
      type: "vocab",
      category: "한자읽기",
      word: "宇宙",
      kana: "うちゅう",
      meaning: "우주",
      pos: "명사",
      examTags: ["2018년", "2023년"],
      example: "宇宙開発のニュースに子どもたちが興味津々だ。",
      exampleKana: "うちゅうかいはつのにゅーすにこどもたちがきょうみしんしんだ。",
      exampleMeaning: "우주 개발 뉴스에 아이들이 흥미진진해한다.",
      synonyms: ["銀河", "空間"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 29,
      type: "vocab",
      category: "한자읽기",
      word: "映る",
      kana: "うつる",
      meaning: "비치다",
      pos: "동사(5단·자동사)",
      examTags: ["2020년"],
      example: "湖面に青い空がくっきり映っている。",
      exampleKana: "こめんにあおいそらがくっきりうつっている。",
      exampleMeaning: "호수 수면에 푸른 하늘이 선명하게 비치고 있다.",
      synonyms: ["反映される", "見える"],
      connection: null,
      compareGrammar: ["移る (옮기다/전염되다)", "写る (사진에 찍히다)"]
    },
    {
      id: 30,
      type: "vocab",
      category: "한자읽기",
      word: "腕",
      kana: "うで",
      meaning: "팔, 솜씨",
      pos: "명사",
      examTags: ["2021년", "2024년"],
      example: "彼は料理の腕をさらに磨いている。",
      exampleKana: "かれはりょうりのうでをさらにみがいている。",
      exampleMeaning: "그는 요리 실력을 더욱 갈고닦고 있다.",
      synonyms: ["実力", "腕前"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 31,
      type: "vocab",
      category: "한자읽기",
      word: "運送",
      kana: "うんそう",
      meaning: "운송",
      pos: "명사·동사(する)",
      examTags: ["2019년"],
      example: "新鮮な野菜をトラックで運送する。",
      exampleKana: "しんせんなやさいをとらっくでうんそうする。",
      exampleMeaning: "신선한 채소를 트럭으로 운송한다.",
      synonyms: ["輸送", "配送"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 32,
      type: "vocab",
      category: "한자읽기",
      word: "運賃",
      kana: "うんちん",
      meaning: "운임",
      pos: "명사",
      examTags: ["2022년"],
      example: "来月から電車の運賃が改定される。",
      exampleKana: "らいげつからでんしゃのうんちんがかいていされる。",
      exampleMeaning: "다음 달부터 전철 운임이 개정된다.",
      synonyms: ["料金", "運送料"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 33,
      type: "vocab",
      category: "한자읽기",
      word: "偉い",
      kana: "えらい",
      meaning: "훌륭하다, 대단하다, 위대하다",
      pos: "형용사(い형용사)",
      examTags: ["2018년", "2023년"],
      example: "毎日コツコツ続ける人は本当に偉いと思う。",
      exampleKana: "まいにちこつこつつづけるひとはほんとうにえらいとおもう。",
      exampleMeaning: "매일 꾸준히 이어가는 사람은 정말 대단하다고 생각한다.",
      synonyms: ["立派だ", "素晴らしい"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 34,
      type: "vocab",
      category: "한자읽기",
      word: "得る",
      kana: "える",
      meaning: "얻다, 획득하다",
      pos: "동사(1단·타동사)",
      examTags: ["2020년", "2025년"],
      example: "経験を通して多くの学びを得た。",
      exampleKana: "けいけんをとおしておおくのまなびをえた。",
      exampleMeaning: "경험을 통해 많은 배움을 얻었다.",
      synonyms: ["手に入れる", "獲得する"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 35,
      type: "vocab",
      category: "한자읽기",
      word: "延期",
      kana: "えんき",
      meaning: "연기, 미룸",
      pos: "명사·동사(する)",
      examTags: ["2021년"],
      example: "悪天候のため、運動会は来週に延期された。",
      exampleKana: "あくてんこうのため、うんどうかいはらいしゅうにえんきされた。",
      exampleMeaning: "악천후로 인해 운동회가 다음 주로 연기되었다.",
      synonyms: ["先送り", "順延"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 36,
      type: "vocab",
      category: "한자읽기",
      word: "応援",
      kana: "おうえん",
      meaning: "응원",
      pos: "명사·동사(する)",
      examTags: ["2017년"],
      example: "スタンドから熱い応援の声が送られた。",
      exampleKana: "すたんどからあついおうえんのこえがおくられた。",
      exampleMeaning: "관중석에서 뜨거운 응원의 목소리가 전해졌다.",
      synonyms: ["声援", "サポート"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 37,
      type: "vocab",
      category: "한자읽기",
      word: "応対",
      kana: "おうたい",
      meaning: "응대, 접대",
      pos: "명사·동사(する)",
      examTags: ["2022년", "2024년"],
      example: "受付スタッフの丁寧な応対が好評だ。",
      exampleKana: "うけつけすたっふのていねいなおうたいがこうひょうだ。",
      exampleMeaning: "접수 직원의 정중한 응대가 호평을 받고 있다.",
      synonyms: ["対応", "接客"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 38,
      type: "vocab",
      category: "한자읽기",
      word: "欧米",
      kana: "おうべい",
      meaning: "구미, 유럽과 미국",
      pos: "명사",
      examTags: ["2019년"],
      example: "欧米の文化や歴史に関心を持つ人が多い。",
      exampleKana: "おうべいのぶんかやれきしにかんしんをもつひとがおおい。",
      exampleMeaning: "구미의 문화나 역사에 관심을 갖는 사람이 많다.",
      synonyms: ["西洋", "欧米諸国"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 39,
      type: "vocab",
      category: "한자읽기",
      word: "大幅",
      kana: "おおはば",
      meaning: "큰 폭",
      pos: "명사·형용동사",
      examTags: ["2021년", "2024년"],
      example: "今年は売上が大幅に伸びた。",
      exampleKana: "ことしはうりあげがおおはばにのびた。",
      exampleMeaning: "올해는 매출이 큰 폭으로 늘었다.",
      synonyms: ["大きく", "著しく"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 40,
      type: "vocab",
      category: "한자읽기",
      word: "補う",
      kana: "おぎなう",
      meaning: "보충하다, 메우다",
      pos: "동사(5단·타동사)",
      examTags: ["2020년", "2023년"],
      example: "不足している知識を参考書で補う。",
      exampleKana: "ふそくしているちしきをさんこうしょでおぎなう。",
      exampleMeaning: "부족한 지식을 참고서로 보충한다.",
      synonyms: ["補填する", "補完する"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 41,
      type: "vocab",
      category: "한자읽기",
      word: "〜億",
      kana: "〜おく",
      meaning: "〜억",
      pos: "수사·접미사",
      examTags: ["2018년"],
      example: "このプロジェクトには数億円の予算が必要だ。",
      exampleKana: "このぷろじぇくとにはすうおくえんのよさんがひつようだ。",
      exampleMeaning: "이 프로젝트에는 수억 엔의 예산이 필요하다.",
      synonyms: ["〜兆"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 42,
      type: "vocab",
      category: "한자읽기",
      word: "置く",
      kana: "おく",
      meaning: "놓다, 두다",
      pos: "동사(5단·타동사)",
      examTags: ["2019년"],
      example: "荷物をロッカーに置いて会場へ入った。",
      exampleKana: "にもつをろっかーにおいてかいじょうへはいった。",
      exampleMeaning: "짐을 로커에 두고 회장 안으로 들어갔다.",
      synonyms: ["配置する", "しまう"],
      connection: "[동사 て형 + おく (미리 해 두다)]",
      compareGrammar: ["〜ておく", "〜てしまう"]
    },
    {
      id: 43,
      type: "vocab",
      category: "한자읽기",
      word: "怒る",
      kana: "おこる",
      meaning: "화내다, 꾸짖다",
      pos: "동사(5단·자동사/타동사)",
      examTags: ["2021년"],
      example: "約束に遅れても先生は怒らなかった。",
      exampleKana: "やくそくにおくれてもせんせいはおこらなかった。",
      exampleMeaning: "약속에 늦어도 선생님은 화내지 않으셨다.",
      synonyms: ["腹を立てる", "叱る"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 44,
      type: "vocab",
      category: "한자읽기",
      word: "幼い",
      kana: "おさない",
      meaning: "어리다, 유치하다",
      pos: "형용사(い형용사)",
      examTags: ["2020년"],
      example: "幼いころの思い出は今でも鮮明に残っている。",
      exampleKana: "おさないころのおもいではいまでもせんめんにのこっている。",
      exampleMeaning: "어린 시절의 추억은 지금도 선명하게 남아 있다.",
      synonyms: ["幼少だ", "あどけない"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 45,
      type: "vocab",
      category: "한자읽기",
      word: "収まる",
      kana: "おさまる",
      meaning: "가라앉다, 해결되다, 들어가다",
      pos: "동사(5단·자동사)",
      examTags: ["2022년", "2024년"],
      example: "強い雨もようやく収まってきた。",
      exampleKana: "つよいあめもようやくおさまってきた。",
      exampleMeaning: "거센 비도 마침내 잦아들기 시작했다.",
      synonyms: ["治まる", "落ち着く"],
      connection: null,
      compareGrammar: ["収める (거두다/해결하다)", "納める (납입하다)"]
    },
    {
      id: 46,
      type: "vocab",
      category: "한자읽기",
      word: "納める",
      kana: "おさめる",
      meaning: "넣다, 납입하다, 바치다",
      pos: "동사(1단·타동사)",
      examTags: ["2021년"],
      example: "期限までに税金を納める必要がある。",
      exampleKana: "きげんまでにぜいきんをおさめるひつようがある。",
      exampleMeaning: "기한까지 세금을 납부할 필요가 있다.",
      synonyms: ["支払う", "納入する"],
      connection: null,
      compareGrammar: ["収める", "治める"]
    },
    {
      id: 47,
      type: "vocab",
      category: "한자읽기",
      word: "踊り",
      kana: "おどり",
      meaning: "춤",
      pos: "명사",
      examTags: ["2018년"],
      example: "地域の伝統的な踊りを披露した。",
      exampleKana: "ちいきのでんとうてきなおどりをひろうした。",
      exampleMeaning: "지역의 전통적인 춤을 선보였다.",
      synonyms: ["ダンス", "舞踊"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 48,
      type: "vocab",
      category: "한자읽기",
      word: "劣る",
      kana: "おとる",
      meaning: "뒤떨어지다, 못하다",
      pos: "동사(5단·자동사)",
      examTags: ["2022년", "2025년"],
      example: "品質においては他社製品に少しも劣らない。",
      exampleKana: "ひんしつにおいてはたしゃせいひんにすこしもとらない。",
      exampleMeaning: "품질 면에서는 타사 제품에 조금도 뒤지지 않는다.",
      synonyms: ["見劣りする", "劣っている"],
      connection: null,
      compareGrammar: ["優れる (뛰어나다)"]
    },
    {
      id: 49,
      type: "vocab",
      category: "한자읽기",
      word: "主",
      kana: "おも",
      meaning: "주됨, 주요함",
      pos: "형용동사·명사",
      examTags: ["2020년"],
      example: "今回の会議の主な目的は日程調整だ。",
      exampleKana: "こんかいかいぎのおもなもくてきはにっていちょうせいだ。",
      exampleMeaning: "이번 회의의 주된 목적은 일정 조율이다.",
      synonyms: ["主要", "中心"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 50,
      type: "vocab",
      category: "한자읽기",
      word: "介護",
      kana: "かいご",
      meaning: "간호, 간병",
      pos: "명사·동사(する)",
      examTags: ["2021년", "2024년"],
      example: "高齢化に伴い、介護サービスの需要が高まっている。",
      exampleKana: "こうれいかにとこない、かいごさーびすのじゅようがたかまっている。",
      exampleMeaning: "고령화에 따라 간병 서비스의 수요가 높아지고 있다.",
      synonyms: ["看護", "介助"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 51,
      type: "vocab",
      category: "한자읽기",
      word: "改善",
      kana: "かいぜん",
      meaning: "개선",
      pos: "명사·동사(する)",
      examTags: ["2019년", "2023년"],
      example: "作業効率を上げるために手順を改善した。",
      exampleKana: "さぎょうこうりつをあげるためにてじゅんをかいぜんした。",
      exampleMeaning: "작업 효율을 높이기 위해 절차를 개선했다.",
      synonyms: ["改良", "向上"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 52,
      type: "vocab",
      category: "한자읽기",
      word: "会談",
      kana: "かいだん",
      meaning: "회담",
      pos: "명사·동사(する)",
      examTags: ["2020년"],
      example: "両国の首脳が経済協力について会談した。",
      exampleKana: "りょうこくのしゅのうがけいざいきょうりょくについてかいだんした。",
      exampleMeaning: "양국 정상이 경제 협력에 관해 회담했다.",
      synonyms: ["協議", "対談"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 53,
      type: "vocab",
      category: "한자읽기",
      word: "快適",
      kana: "かいてき",
      meaning: "쾌적함",
      pos: "형용동사(な형용사)",
      examTags: ["2018년", "2022년"],
      example: "冷房が効いていて室内はとても快適だ。",
      exampleKana: "れいぼうがきいていてしつないはとてもかいてきだ。",
      exampleMeaning: "냉방이 잘 되어 실내가 매우 쾌적하다.",
      synonyms: ["心地よい", "爽快"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 54,
      type: "vocab",
      category: "한자읽기",
      word: "回復",
      kana: "かいふく",
      meaning: "회복",
      pos: "명사·동사(する)",
      examTags: ["2019년", "2024년"],
      example: "けがも順調に回復して退院できた。",
      exampleKana: "けがもじゅんちょうにかいふくしてたいいんできた。",
      exampleMeaning: "부상도 순조롭게 회복해 퇴원할 수 있었다.",
      synonyms: ["快復", "復調"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 55,
      type: "vocab",
      category: "한자읽기",
      word: "抱える",
      kana: "かかえる",
      meaning: "(껴)안다, (문제를) 떠안다",
      pos: "동사(1단·타동사)",
      examTags: ["2021년", "2025년"],
      example: "多くの悩みを一人で抱え込まないでほしい。",
      exampleKana: "おおくのなやみをひとりでかかえこまないでほしい。",
      exampleMeaning: "많은 고민을 혼자 떠안지 않았으면 한다.",
      synonyms: ["抱きかかえる", "背負う"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 56,
      type: "vocab",
      category: "한자읽기",
      word: "拡充",
      kana: "かくじゅう",
      meaning: "확충",
      pos: "명사·동사(する)",
      examTags: ["2022년"],
      example: "子育て支援制度の拡充が発表された。",
      exampleKana: "こそだてしえんせいどのかくじゅうがはっぴょうされた。",
      exampleMeaning: "육아 지원 제도의 확충이 발표되었다.",
      synonyms: ["拡大", "充実"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 57,
      type: "vocab",
      category: "한자읽기",
      word: "隠す",
      kana: "かくす",
      meaning: "감추다, 숨기다",
      pos: "동사(5단·타동사)",
      examTags: ["2018년"],
      example: "驚いた表情を隠そうとしたが、すぐばれてしまった。",
      exampleKana: "おどろいたひょうじょうをかくそうとしたが、すぐばれてしまった。",
      exampleMeaning: "놀란 표정을 감추려 했지만 곧 들키고 말았다.",
      synonyms: ["隠蔽する", "伏せる"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 58,
      type: "vocab",
      category: "한자읽기",
      word: "下降",
      kana: "かこう",
      meaning: "하강, 추락",
      pos: "명사·동사(する)",
      examTags: ["2020년"],
      example: "夕方になって気温が急に下降した。",
      exampleKana: "ゆうがたになってきおんがきゅうにかこうしった。",
      exampleMeaning: "저녁이 되면서 기온이 갑자기 하강했다.",
      synonyms: ["低下", "下落"],
      connection: null,
      compareGrammar: ["上昇 (상승)"]
    },
    {
      id: 59,
      type: "vocab",
      category: "한자읽기",
      word: "囲む",
      kana: "かこむ",
      meaning: "둘러싸다",
      pos: "동사(5단·타동사)",
      examTags: ["2019년"],
      example: "みんなで食卓を囲んで夕食を楽しんだ。",
      exampleKana: "みんなでしょくたくをかこんでゆうしょくをたのしんだ。",
      exampleMeaning: "모두 함께 식탁을 둘러싸고 저녁 식사를 즐겼다.",
      synonyms: ["取り囲む", "包む"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 60,
      type: "vocab",
      category: "한자읽기",
      word: "重ねる",
      kana: "かさねる",
      meaning: "거듭하다, 겹치다, 쌓다",
      pos: "동사(1단·타동사)",
      examTags: ["2021년", "2024년"],
      example: "話し合いを重ねて、ようやく合意に達した。",
      exampleKana: "はなしあいをかさねて、ようやくごういにたっした。",
      exampleMeaning: "협의를 거듭한 끝에 마침내 합의에 도달했다.",
      synonyms: ["積み重ねる", "繰り返す"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 61,
      type: "vocab",
      category: "한자읽기",
      word: "賢い",
      kana: "かしこい",
      meaning: "현명하다, 영리하다",
      pos: "형용사(い형용사)",
      examTags: ["2020년"],
      example: "状況を見て賢い判断を下すことが大切だ。",
      exampleKana: "じょうきょうをみてかしこいはんだんをくだすことがたいせつだ。",
      exampleMeaning: "상황을 보고 현명한 판단을 내리는 것이 중요하다.",
      synonyms: ["利口だ", "聡明だ"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 62,
      type: "vocab",
      category: "한자읽기",
      word: "傾く",
      kana: "かたむく",
      meaning: "기울다, 치우치다",
      pos: "동사(5단·자동사)",
      examTags: ["2022년"],
      example: "西日が差して、部屋の影が長く傾いている。",
      exampleKana: "にしびがさして、へやのかげがながくかたむいている。",
      exampleMeaning: "석양이 비쳐 방의 그림자가 길게 기울어져 있다.",
      synonyms: ["傾げる", "偏る"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 63,
      type: "vocab",
      category: "한자읽기",
      word: "仮定",
      kana: "かてい",
      meaning: "가정",
      pos: "명사·동사(する)",
      examTags: ["2021년"],
      example: "明日は晴れると仮定して計画を立てよう。",
      exampleKana: "あしたははれるとかていしてけいかくをたてよう。",
      exampleMeaning: "내일은 맑다고 가정하고 계획을 세우자.",
      synonyms: ["想定", "仮説"],
      connection: null,
      compareGrammar: ["家庭 (가정·집안)"]
    },
    {
      id: 64,
      type: "vocab",
      category: "한자읽기",
      word: "可能性",
      kana: "かのうせい",
      meaning: "가능성",
      pos: "명사",
      examTags: ["2019년", "2023년"],
      example: "新しい治療法が確立される可能性が高い。",
      exampleKana: "あたらしいちりょうほうがかくりつされるかのうせいがたかい。",
      exampleMeaning: "새로운 치료법이 확립될 가능성이 높다.",
      synonyms: ["見込み", "潜在力"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 65,
      type: "vocab",
      category: "한자읽기",
      word: "貨物",
      kana: "かもつ",
      meaning: "화물",
      pos: "명사",
      examTags: ["2020년"],
      example: "港から大型の貨物船が出航した。",
      exampleKana: "みなとからおおがたのかもつせんがしゅっこうした。",
      exampleMeaning: "항구에서 대형 화물선이 출항했다.",
      synonyms: ["荷物", "積荷"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 66,
      type: "vocab",
      category: "한자읽기",
      word: "辛い",
      kana: "からい",
      meaning: "맵다",
      pos: "형용사(い형용사)",
      examTags: ["2018년", "2024년"],
      example: "このカレーは思ったより辛いが、とてもおいしい。",
      exampleKana: "このかれーはおもったよりからいが、とてもおいしい。",
      exampleMeaning: "이 카레는 생각보다 맵지만 매우 맛있다.",
      synonyms: ["スパイシーだ", "激辛"],
      connection: null,
      compareGrammar: ["辛い (つらい: 괴롭다/힘들다)"]
    },
    {
      id: 67,
      type: "vocab",
      category: "한자읽기",
      word: "絡まる",
      kana: "からまる",
      meaning: "휘감기다, 얽히다",
      pos: "동사(5단·자동사)",
      examTags: ["2022년"],
      example: "イヤホンのコードがバッグの中で絡まってしまった。",
      exampleKana: "いやほんのこーどがばっぐのなかでからまってしまった。",
      exampleMeaning: "이어폰 줄이 가방 안에서 엉켜 버렸다.",
      synonyms: ["絡みつく", "もつれる"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 68,
      type: "vocab",
      category: "한자읽기",
      word: "観察",
      kana: "かんさつ",
      meaning: "관찰",
      pos: "명사·동사(する)",
      examTags: ["2020년", "2023년"],
      example: "植物の成長過程を毎日観察して記録する。",
      exampleKana: "しょくぶつのせいちょうかていをまいにちかんさつしてきろくする。",
      exampleMeaning: "식물의 성장 과정을 매일 관찰해 기록한다.",
      synonyms: ["注視", "調査"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 69,
      type: "vocab",
      category: "한자읽기",
      word: "乾燥",
      kana: "かんそう",
      meaning: "건조",
      pos: "명사·동사(する)",
      examTags: ["2021년", "2024년"],
      example: "冬は空気が乾燥するので加湿器を使う。",
      exampleKana: "ふゆはくうきがかんそうするのでかしつきをつかう。",
      exampleMeaning: "겨울에는 공기가 건조하므로 가습기를 사용한다.",
      synonyms: ["ドライ", "乾くこと"],
      connection: null,
      compareGrammar: ["感想 (감상)"]
    },
    {
      id: 70,
      type: "vocab",
      category: "한자읽기",
      word: "缶詰",
      kana: "かんづめ",
      meaning: "통조림",
      pos: "명사",
      examTags: ["2019년"],
      example: "非常用に果物や魚の缶詰を備蓄している。",
      exampleKana: "ひじょうようにくだものやさかなのかんづめをびちくしている。",
      exampleMeaning: "비상용으로 과일이나 생선 통조림을 비축하고 있다.",
      synonyms: ["缶物", "保存食"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 71,
      type: "vocab",
      category: "한자읽기",
      word: "願望",
      kana: "がんぼう",
      meaning: "바람, 소원, 염원",
      pos: "명사",
      examTags: ["2022년"],
      example: "世界平和を願う人々の願望は変わらない。",
      exampleKana: "せかいへいわをねがうひとびとのがんぼうはかわらない。",
      exampleMeaning: "세계 평화를 바라는 사람들의 염원은 변하지 않는다.",
      synonyms: ["願い", "念願"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 72,
      type: "vocab",
      category: "한자읽기",
      word: "勧誘",
      kana: "かんゆう",
      meaning: "권유",
      pos: "명사·동사(する)",
      examTags: ["2020년", "2024년"],
      example: "大学のサークル勧誘がキャンパスで行われた。",
      exampleKana: "だいがくのさーくるかんゆうがきゃんぱすでおこなわれた。",
      exampleMeaning: "대학 동아리 권유가 캠퍼스에서 진행되었다.",
      synonyms: ["誘い", "募集"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 73,
      type: "vocab",
      category: "한자읽기",
      word: "完了",
      kana: "かんりょう",
      meaning: "완료",
      pos: "명사·동사(する)",
      examTags: ["2021년"],
      example: "すべての手続きが無事に完了しました。",
      exampleKana: "すべてのてつづきがぶじにかんりょうしました。",
      exampleMeaning: "모든 절차가 무사히 완료되었습니다.",
      synonyms: ["終了", "完結"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 74,
      type: "vocab",
      category: "한자읽기",
      word: "記憶",
      kana: "きおく",
      meaning: "기억",
      pos: "명사·동사(する)",
      examTags: ["2018년", "2023년"],
      example: "子どものころの記憶がふとよみがえった。",
      exampleKana: "こどものころのきおくがふとよみがえった。",
      exampleMeaning: "어린 시절의 기억이 문득 되살아났다.",
      synonyms: ["思い出", "暗記"],
      connection: null,
      compareGrammar: []
    },
    {
      id: 75,
      type: "vocab",
      category: "한자읽기",
      word: "企画",
      kana: "きかく",
      meaning: "기획",
      pos: "명사·동사(する)",
      examTags: ["2020년", "2025년"],
      example: "新しいイベントの企画を立てているところだ。",
      exampleKana: "あたらしいいべんとのきかくをたてているところだ。",
      exampleMeaning: "새로운 이벤트 기획을 세우고 있는 중이다.",
      synonyms: ["計画", "立案"],
      connection: null,
      compareGrammar: []
    }
  ];

  // =========================================================
  // 헬퍼 유틸리티: 중복 기출 표기 / 히라가나 전용 판별 / 한자 역추적
  // =========================================================
  function formatDuplicateExamLabel(examTags) {
    if (!Array.isArray(examTags) || examTags.length < 2) return "";
    const years = examTags
      .map((tag) => {
        const match = String(tag).match(/(\d{4})/);
        return match ? match[1] : String(tag).trim();
      })
      .filter(Boolean);
    if (years.length < 2) return "";
    const formattedYears = years.map((y) => (y.endsWith("년") ? y : `${y}년`));
    return `${formattedYears.join("·")}도 중복 기출`;
  }

  function isHiraganaOnly(text) {
    if (!text || typeof text !== "string") return false;
    const trimmed = text.trim();
    if (!trimmed) return false;
    // 히라가나(U+3040-U+309F), 장음(ー), 중점/공백 허용 여부 체크
    return /^[ぁ-ゟー]+$/u.test(trimmed);
  }

  function extractKanjiChars(word) {
    if (!word || typeof word !== "string") return [];
    const matches = word.match(/[\u4E00-\u9FFF々]/gu) || [];
    return [...new Set(matches)];
  }

  function findWordsByKanji(kanjiChar, excludeId = null) {
    if (!kanjiChar) return [];
    return VOCAB_DB.filter(
      (item) => item.id !== excludeId && typeof item.word === "string" && item.word.includes(kanjiChar)
    );
  }

  // =========================================================
  // SRS (에빙하우스 망각곡선 기반 간격 반복) 계산 로직
  // =========================================================
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
    const today = getTodayISO(0);
    const prevInterval = prevRecord && typeof prevRecord.intervalDays === "number" ? prevRecord.intervalDays : 0;
    const prevEase = prevRecord && typeof prevRecord.easeLevel === "number" ? prevRecord.easeLevel : 1;

    let status = "미암기";
    let intervalDays = 1;
    let easeLevel = prevEase;

    if (ratingOrStatus === "완벽함" || ratingOrStatus === "외움") {
      status = "외움";
      easeLevel = Math.min(5, prevEase + 1);
      if (prevInterval <= 0) intervalDays = 3;
      else if (prevInterval < 7) intervalDays = 7;
      else intervalDays = Math.min(60, Math.round(prevInterval * 2.2));
    } else if (ratingOrStatus === "애매함" || ratingOrStatus === "헷갈림") {
      status = "헷갈림";
      easeLevel = Math.max(1, prevEase);
      intervalDays = prevInterval >= 2 ? 2 : 1;
    } else {
      // "모름" 또는 "미암기"
      status = "미암기";
      easeLevel = 1;
      intervalDays = 1;
    }

    return {
      status,
      easeLevel,
      intervalDays,
      nextReviewDate: getTodayISO(intervalDays),
      lastReviewedAt: new Date().toISOString()
    };
  }

  function isDueForReview(wordId, state) {
    const rec = state && state.progress ? state.progress[wordId] : null;
    if (!rec || !rec.nextReviewDate) return true; // 아직 복습 기록이 없으면 오늘 학습/복습 대상
    return rec.nextReviewDate <= getTodayISO(0);
  }

  // =========================================================
  // localStorage 스토어 & JSON 내보내기 / 가져오기 / 초기화
  // =========================================================
  function cloneDefaultState() {
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return cloneDefaultState();
      const parsed = JSON.parse(raw);
      return sanitizeState(parsed);
    } catch (_) {
      return cloneDefaultState();
    }
  }

  function sanitizeState(raw) {
    const base = cloneDefaultState();
    if (!raw || typeof raw !== "object") return base;

    base.theme = raw.theme === "dark" ? "dark" : "light";
    const parsedRate = Number(raw.ttsRate);
    base.ttsRate = Number.isFinite(parsedRate) && parsedRate >= 0.6 && parsedRate <= 1.4 ? parsedRate : 1.0;
    base.maskKana = Boolean(raw.maskKana);
    base.maskMeaning = Boolean(raw.maskMeaning);

    if (raw.progress && typeof raw.progress === "object") {
      Object.entries(raw.progress).forEach(([id, entry]) => {
        if (!entry || typeof entry !== "object") return;
        const validStatus = ["외움", "헷갈림", "미암기"].includes(entry.status) ? entry.status : "미암기";
        base.progress[id] = {
          status: validStatus,
          easeLevel: Number.isFinite(Number(entry.easeLevel)) ? Number(entry.easeLevel) : 1,
          intervalDays: Number.isFinite(Number(entry.intervalDays)) ? Number(entry.intervalDays) : 1,
          nextReviewDate: typeof entry.nextReviewDate === "string" ? entry.nextReviewDate : getTodayISO(0),
          lastReviewedAt: entry.lastReviewedAt || null
        };
      });
    }

    if (Array.isArray(raw.favorites)) {
      base.favorites = [...new Set(raw.favorites.map(Number).filter(Number.isFinite))];
    }

    if (Array.isArray(raw.customDecks)) {
      base.customDecks = raw.customDecks
        .filter((d) => d && typeof d.name === "string" && d.name.trim())
        .map((d, idx) => ({
          id: typeof d.id === "string" && d.id ? d.id : `deck_${Date.now()}_${idx}`,
          name: d.name.trim(),
          wordIds: Array.isArray(d.wordIds) ? [...new Set(d.wordIds.map(Number).filter(Number.isFinite))] : []
        }));
    }

    if (raw.posNotes && typeof raw.posNotes === "object") {
      Object.entries(raw.posNotes).forEach(([id, note]) => {
        if (typeof note === "string") {
          base.posNotes[id] = note;
        }
      });
    }

    if (raw.wrongStats && typeof raw.wrongStats === "object") {
      Object.entries(raw.wrongStats).forEach(([id, stat]) => {
        if (!stat || typeof stat !== "object") return;
        const cnt = Number(stat.count);
        if (Number.isFinite(cnt) && cnt > 0) {
          base.wrongStats[id] = {
            count: Math.floor(cnt),
            lastWrongAt: typeof stat.lastWrongAt === "string" ? stat.lastWrongAt : new Date().toISOString(),
            lastMode: typeof stat.lastMode === "string" ? stat.lastMode : "quiz"
          };
        }
      });
    }

    return base;
  }

  function saveState(state) {
    const clean = sanitizeState(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    return clean;
  }

  function exportStateToJson(state) {
    const payload = {
      app: "JLPT-N2-Study-App",
      version: 1,
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
      const rawData = parsed && typeof parsed === "object" && parsed.data && typeof parsed.data === "object"
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
    const fresh = cloneDefaultState();
    saveState(fresh);
    return fresh;
  }

  // 전역 네임스페이스 공개 (study.js, quiz.js 및 향후 문법/독해 모듈에서 활용)
  window.JLPTData = {
    STORAGE_KEY,
    EXAM_DATE,
    DEFAULT_STATE,
    VOCAB_DB,
    GRAMMAR_DB,
    READING_DB,
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
  };
})();