/**
 * 럽유럽미 도메인 타입
 *
 * 데이터 개념은 기획서 §5.2 AI Profile Building 구조를 그대로 따른다.
 *   Observed Me      사진에서 관찰된 취향·라이프스타일
 *   Declared Me      사용자가 직접 답한 관계 기준·자기인식
 *   Relationship Me  과거 관계 경험에서 드러난 실제 행동·중요 기준
 *   Target Person    사용자가 알고 있는 상대 정보
 *   Compatibility    두 사람의 공통점 / 차이
 *   Relationship Mirror  Declared Me vs Relationship Me
 */

/* ------------------------------------------------------------------ 공통 */

export type ScaleValue = 1 | 2 | 3 | 4 | 5;

/* -------------------------------------------------------------- MBTI Lens */

/**
 * MBTI는 Supporting Compatibility Lens다 — 관계 행동 신호(contact/conflict/alone/affection)와
 * 다른 종류의 데이터이므로, 동기화율 계산에는 절대 들어가지 않는다(§6.1.1).
 * 사용자가 스스로 알고 있는 Personality Preference를 '대화 출발점'으로만 쓴다.
 */
export type MbtiType =
  | 'INTJ'
  | 'INTP'
  | 'ENTJ'
  | 'ENTP'
  | 'INFJ'
  | 'INFP'
  | 'ENFJ'
  | 'ENFP'
  | 'ISTJ'
  | 'ISFJ'
  | 'ESTJ'
  | 'ESFJ'
  | 'ISTP'
  | 'ISFP'
  | 'ESTP'
  | 'ESFP';

/** MBTI 4개 선호 지표. 각 축을 독립적으로 비교한다 — 합산해서 점수로 만들지 않는다. */
export type MbtiAxisKey = 'energy' | 'information' | 'decision' | 'lifestyle';

export interface MbtiAxisComparison {
  key: MbtiAxisKey;
  /** ENERGY · INFORMATION · DECISION · LIFESTYLE */
  eyebrow: string;
  label: string;
  mineLetter: string;
  theirsLetter: string;
  /** 같은 선호인지. '같음=좋음'이 아니라 '비슷한 성향/다르게 나타날 수 있는 성향'으로만 표현한다 */
  same: boolean;
  /** '~할 수 있어' 톤의 관찰 문장. MBTI 이론상의 단정이 아니다 */
  note: string;
}

/**
 * 두 사람의 MBTI가 모두 있을 때만 만들어지는 참고용 렌즈.
 * 점수(similarity)를 만들지 않는다 — 축별 '대화 포인트'만 제공한다.
 */
export interface MbtiLensReport {
  mine: MbtiType;
  theirs: MbtiType;
  axes: MbtiAxisComparison[];
  /** 비슷한 성향 축 수 */
  sameCount: number;
  /** 다르게 나타날 수 있는 성향 축 수 */
  differentCount: number;
}

/** 한 사람의 MBTI만으로 보는 Self Lens — Couple 여부와 무관하게 항상 만들 수 있다(Self First) */
export interface MbtiSelfAxis {
  key: MbtiAxisKey;
  eyebrow: string;
  label: string;
  letter: string;
}

export interface MbtiSelfLens {
  type: MbtiType;
  axes: MbtiSelfAxis[];
  /** 자기탐색용 한 줄 — MBTI_SELF_NOTE */
  note: string;
}

/* -------------------------------- MBTI 조합 패턴 (v1.25 · P3-2) */

/**
 * 두 사람의 4축 같음/다름이 만드는 **구조**의 이름.
 *
 * ⚠️ 유형쌍(INFP × ESTJ)마다 문장을 두지 않는다 — 그건 궁합 사전이다.
 * 256개 조합 전부가 아래 5개 중 정확히 하나에 들어간다.
 *   INNER  정보를 받아들이고(S/N) 판단하는(T/F) 과정
 *   OUTER  에너지를 회복하고(E/I) 생활을 조직하는(J/P) 리듬
 */
export type MbtiPatternKey =
  | 'all-same'
  | 'all-different'
  | 'inner-same'
  | 'outer-same'
  | 'mixed';

/**
 * 무료 MBTI Lens가 보장하는 세 가지 (P3-2):
 *   1. 조합에서 눈여겨볼 성향 패턴   → label · body · watchFor
 *   2. 러비의 심리/철학적 관찰 1개    → observation
 *   3. 실제로 확인해볼 질문 1개       → check
 *
 * ⚠️ 전부 **MBTI 데이터만으로** 만든다. 관계 답변을 여기에 끌어오지 않는다 —
 * 관계 신호와의 대조는 별도 블록(`MbtiBridgeReport`)의 일이다.
 */
export interface MbtiPatternCheck {
  axisKey: MbtiAxisKey;
  axisEyebrow: string;
  axisLabel: string;
  /** 이 축에서 두 사람이 같은 쪽인지. 질문을 왜 고른지 설명이 갈린다 */
  same: boolean;
  question: string;
  /** 이 질문을 고른 이유 한 줄 */
  why: string;
}

export interface MbtiPatternReport {
  key: MbtiPatternKey;
  label: string;
  body: string;
  watchFor: string;
  /** 러비의 심리/철학적 관찰. 진단이 아니라 인간 일반에 대한 관찰이다 */
  observation: string;
  check: MbtiPatternCheck;
}

/* ------------------------- MBTI × Relationship Signal Bridge (v1.24 · P3-1) */

/**
 * MBTI 렌즈와 **실제 관계 답변**을 나란히 놓았을 때 두 관점이 같은 방향을 가리키는지.
 *
 * ⚠️ 이것은 **궁합 판정이 아니다.** 'ALIGNS = 잘 맞음'도, 'DIFFERS = 안 맞음'도 아니다.
 * 오직 '성향 렌즈에서 보이는 그림'과 '사용자가 직접 답한 관계 신호'가 같은 방향인지만
 * 말한다. 그래서 새 점수를 만들지 않고, 이미 계산된 두 결과의 **판정값만** 읽는다.
 *
 * UNKNOWN은 실패가 아니다 — 비교할 관계 답변이 없거나 판정이 뚜렷하지 않은 상태이며,
 * 억지로 연결하는 것보다 UNKNOWN이 낫다.
 */
export type MbtiBridgeState = 'aligns' | 'differs' | 'unknown';

/** UNKNOWN이 나온 이유. 문구가 정직하게 갈리도록 상태와 함께 남긴다. */
export type MbtiBridgeUnknownReason =
  /** 이 축과 비교할 관계 답변 자체가 없다(한쪽이 '모름') */
  | 'no-signal'
  /** 비교는 했지만 비슷하다고도 다르다고도 판정되지 않았다(neutral) */
  | 'inconclusive';

/**
 * 한 MBTI 축 ↔ 한 관계 신호 축의 비교. 항상 3개 층으로 읽힌다:
 *   MBTI LENS → RELATIONSHIP SIGNAL → INTERPRETATION
 */
export interface MbtiAxisBridge {
  mbtiAxisKey: MbtiAxisKey;
  mbtiEyebrow: string;
  mbtiLabel: string;
  /** MBTI LENS 층 — '둘 다 I' / 'I × E' */
  lensLine: string;
  /** 두 사람의 이 축 글자가 같은지 */
  lensSame: boolean;
  /** 비교 대상이 된 실제 관계 축 */
  signalAxisKey: TargetAxisKey;
  signalAxisLabel: string;
  /** RELATIONSHIP SIGNAL 층 — 이미 계산된 tone 판정을 그대로 읽은 문장 */
  signalLine: string;
  /** 실제 저장된 answer label. 자유서술 원문이 아니다 */
  signalMinePhrase: string;
  signalTheirsPhrase: string;
  state: MbtiBridgeState;
  unknownReason: MbtiBridgeUnknownReason | null;
  /** INTERPRETATION 층 */
  interpretation: string;
}

/** 비교할 관계 답변이 없어 Bridge를 만들지 못한 MBTI 축 */
export interface MbtiUnmappedAxis {
  key: MbtiAxisKey;
  eyebrow: string;
  label: string;
}

/**
 * 축 단위가 아니라 **전체 그림**의 비교.
 * "MBTI는 세 축이 다른데, 실제 관계 답변에서는 비슷한 축이 더 많았어" 같은 관찰을 만든다.
 *
 * ⚠️ 두 개의 이미 계산된 개수를 나란히 읽을 뿐, 둘을 더하거나 평균 내지 않는다.
 */
export interface MbtiPatternBridge {
  mbtiSameCount: number;
  mbtiDifferentCount: number;
  /** 관계 신호에서 '비슷'으로 판정된 축 수 = goodSignals.length */
  signalSimilarCount: number;
  /** 관계 신호에서 '차이'로 판정된 축 수 = frictionSignals.length */
  signalDifferentCount: number;
  signalComparedCount: number;
  state: MbtiBridgeState;
  lensLine: string;
  signalLine: string;
  interpretation: string;
}

/** MATCH / DIFFERENCE 화면에 쓰는 가장 강한 관찰 하나 */
export interface MbtiBridgeSurprise {
  /** Analytics로 보내는 opaque 상태값. 문구·MBTI 원문은 보내지 않는다 */
  state: MbtiBridgeState;
  /**
   * 이 관찰이 어느 블록에서 나왔는지. 화면은 이 값으로 **근거 블록을 관찰 바로 아래에**
   * 배치한다 — 같은 근거가 관찰 옆과 상세 블록에 두 번 적히지 않게 하기 위해서다
   * (실측에서 '둘 다 I / 나: 혼자 있는 시간 5/5 · 상대: 거의 안 챙김'이 두 번 나왔다).
   */
  source: 'axis' | 'pattern';
  /** 러비의 짧은 혼잣말 */
  hook: string;
  /** 근거 — 어느 축에서 나왔는지 */
  evidenceLabel: string;
  evidenceLensLine: string;
  evidenceSignalLine: string;
}

export interface MbtiBridgeReport {
  /**
   * 관계 답변이 아직 비교 가능한 수준이 아닐 때 false.
   * 이때도 MBTI Lens 자체는 그대로 보여주고, Bridge만 정직하게 제한한다.
   */
  available: boolean;
  axisBridges: MbtiAxisBridge[];
  unmappedAxes: MbtiUnmappedAxis[];
  pattern: MbtiPatternBridge | null;
  surprise: MbtiBridgeSurprise | null;
}

/* ------------------------------------------- Birth Profile (v1.4, 공용) */

/**
 * 사주·Astrology **두 Entertainment Lens가 공용으로 쓰는** 출생정보.
 *
 * ⚠️ CORE 분석(동기화율·Mirror·History)에는 어디에도 쓰이지 않는다. Main Funnel의 필수 질문도
 * 아니다 — Entertainment 기능 때문에 전체 입력 부담을 늘리지 않기 위해 Lens Context에서만 받는다.
 *
 * 같은 정보를 사주에서 또, Astrology에서 또 묻지 않는다.
 */
export type CalendarType = 'solar' | 'lunar';

export interface BirthLocation {
  country?: string;
  city?: string;
  timezone?: string;
}

export interface BirthProfile {
  /** `YYYY-MM-DD`. 없으면 어떤 Lens도 계산하지 않는다 */
  date: string | null;
  /** `HH:MM`. 없어도 Sun Sign은 가능하고, Natal/시주는 불가능하다 */
  time: string | null;
  /** 사용자가 '태어난 시간을 몰라'를 명시적으로 선택했는지 (미입력과 구분) */
  timeUnknown: boolean;
  calendarType: CalendarType;
  location: BirthLocation | null;
}

/** Lens가 지금 어디까지 계산할 수 있는지 */
export interface LensAvailability {
  /** 나 혼자 보는 Lens가 가능한지 */
  self: boolean;
  /** 두 사람 Lens가 가능한지 */
  couple: boolean;
  /** 무엇이 없어서 막혔는지 — 화면 안내 분기에 쓴다 */
  missing: 'none' | 'self' | 'target' | 'both';
}

export type EntertainmentLensType = 'saju' | 'astrology';

/** Lens가 만들어내는 '이야기해볼 주제'. 점수가 아니라 대화 소재다 */
export interface ConversationPrompt {
  id: string;
  text: string;
}

/* --------------------------------------------------- 사주 Lens (v1.4) */

/**
 * ⚠️ 사주 명식 계산은 날짜 변환만으로 끝나는 문제가 아니다. 검증된 계산 엔진이 없는 동안에는
 * `available: false`로 두고 **실제 명식을 계산한 것처럼 보여주지 않는다**(§8~§10).
 * 숫자 더하기·띠·랜덤 테이블로 명식을 만들어내지 않는다.
 */
export interface SajuInterpretation {
  /** 전통 해석에서 보는 주요 성향 */
  traits: string[];
  /** 관계에서 참고해볼 주제 */
  relationshipTopics: string[];
  /** 주의해서 볼 해석 */
  cautions: string[];
}

export interface SajuObservation {
  /** '비슷하게 읽히는 부분' / '다르게 읽힐 수 있는 부분' */
  kind: 'similar' | 'different';
  label: string;
  text: string;
}

export interface SajuProfileResult {
  available: boolean;
  pillars?: {
    year: string;
    month: string;
    day: string;
    /** 출생시간이 없으면 시주를 만들지 않는다 */
    hour?: string;
  };
  interpretation?: SajuInterpretation;
  /** 지금 이 결과가 못 하는 것 — 항상 사용자에게 보여준다 */
  limitations: string[];
}

export interface SajuCompatibilityResult {
  available: boolean;
  observations: SajuObservation[];
  prompts: ConversationPrompt[];
  limitations: string[];
}

/* ----------------------------------------------- Astrology Lens (v1.4) */

/**
 * v1.4 범위는 **Simple Sun Sign**이다(생년월일 → 태양궁, Month/Day 경계 규칙).
 * Full Natal Chart(Moon/Rising/Aspect/House/Synastry)는 출생시각·지역·연도에 따른 태양·행성
 * 위치 계산이 필요하므로 이번 버전에서 만들지 않는다 — 가짜로 구현하지 않는다(§17/§18).
 */
export interface AstrologyProfileResult {
  available: boolean;
  sunSign: ZodiacSign | null;
  sunSignLabel: string | null;
  trait: string | null;
  prompts: ConversationPrompt[];
  /** Moon/Rising 등은 v1.4에서 계산하지 않는다는 사실을 담는다 */
  limitations: string[];
}

export interface AstrologyCompatibilityResult {
  available: boolean;
  mine: { sign: ZodiacSign; label: string } | null;
  theirs: { sign: ZodiacSign; label: string } | null;
  similar: string[];
  different: string[];
  prompts: ConversationPrompt[];
  limitations: string[];
}

/* --------------------------------------------------------- Astrology Lens */

export type ZodiacSign =
  | 'aries'
  | 'taurus'
  | 'gemini'
  | 'cancer'
  | 'leo'
  | 'virgo'
  | 'libra'
  | 'scorpio'
  | 'sagittarius'
  | 'capricorn'
  | 'aquarius'
  | 'pisces';

/** 사용자 확인 응답. null = 아직 확인하지 않음 */
export type Verdict = 'ok' | 'no' | null;

export type Confidence = 'high' | 'medium' | 'low';

/* -------------------------------------------------------- 관계 상태 (S05) */

export type RelationshipStatus =
  | 'solo_none'
  | 'solo_exp'
  | 'crush'
  | 'dating'
  | 'married'
  | 'ended';

/* --------------------------------- Relationship Lifecycle (v1.40 · §37) */

/**
 * 사용자가 **선택한** 관계 단계. `RelationshipStatus`에서 도출된다
 * (`resolveRelationshipStage()`), **저장되지 않는다.**
 *
 * `married`가 별도 값이 아닌 이유 — 결혼 여부 자체로 다른 해석을 만들려면 가사·재정·
 * 주거·양육 같은 데이터가 필요한데 이 제품은 그걸 **받지 않는다.** 없는 데이터로
 * 개인화를 흉내내지 않기 위해, 사용자 선택지는 `기혼 / 오래 함께하는 중`으로 남기고
 * 내부 단계는 `long_term`을 공유한다(§37.3).
 *
 * `unknown`이 여기 없는 이유 — 그건 관계 단계가 아니라 **데이터 상태**다.
 * `RelationshipJob`을 본다.
 */
export type RelationshipStage = 'none' | 'talking' | 'dating' | 'long_term' | 'ended';

/**
 * 지금 이 사용자에게 **필요한 일**. `(RelationshipStage × SoloMode)`에서 도출된다
 * (`resolveRelationshipJob()`), **저장되지 않는다.**
 *
 * `unknown` = 단계는 무엇이든 비교할 상대 근거가 아직 모자란 상태. 이때 Job은
 * '비교'가 아니라 '알아가기'다.
 */
export type RelationshipJob = 'none' | 'unknown' | 'talking' | 'dating' | 'long_term' | 'ended';

/**
 * 제안 가능한 행동의 종류. Job이 허용하는 종류만 화면에 오른다
 * (`JOB_ACTION_KINDS`).
 *
 * ⚠️ 새 판정이 아니다 — 이미 만들어진 문장을 **어느 Job에서 보여줄지**만 가른다.
 */
export type RelationshipActionKind = 'ask' | 'try' | 'notice' | 'align' | 'reflect';

/* ------------------------------------------------------ Observed Me (S07~S09) */

export interface PhotoAsset {
  id: string;
  /** 샘플은 와이어프레임의 라벨, 업로드는 파일명 */
  label: string;
  source: 'sample' | 'upload';
  /** 샘플 타일의 배경 톤 (실제 이미지가 없는 데모용) */
  tone?: string;
  /** 업로드 사진의 object URL */
  objectUrl?: string;
}

export interface ObservedTrait {
  id: string;
  /** 러비의 관찰 문장 */
  text: string;
  confidence: Confidence;
  /** 이 관찰이 어디서 나왔는지 */
  evidence: string;
}

/** 관찰 결과에 대한 사용자 피드백 (수정·제외 포함) */
export interface ObservationFeedback {
  verdict: Verdict;
  /** '조금 달라요' 후 사용자가 직접 고쳐 쓴 문장 */
  correctedText?: string;
  /** 분석에서 제외 */
  excluded?: boolean;
}

/* ------------------------------------------------------ Declared Me (S10~S13) */

export type ConflictStyle = 'now' | 'soon' | 'space';
export type AffectionStyle = 'a1' | 'a2' | 'a3';
export type HobbyStyle = 'h1' | 'h2' | 'h3';

export interface DeclaredPreference {
  /** 연락 중요도 1~5 */
  contact: ScaleValue | null;
  /** 갈등 해결 속도 */
  conflict: ConflictStyle | null;
  /** 개인 시간 필요도 1~5 */
  alone: ScaleValue | null;
  /** 애정 표현 */
  affection: AffectionStyle | null;
  /** 취미 공유 */
  hobby: HobbyStyle | null;
}

/* -------------------------------------------------- Relationship Me (S15~S17) */

export type PastFactor =
  | 'talk'
  | 'contact'
  | 'conflict'
  | 'affection'
  | 'alone'
  | 'rhythm'
  | 'money'
  | 'hobby'
  | 'touch'
  | 'future'
  | 'care'
  | 'stable';

export type HardestMoment = 'contact_drop' | 'fight_silence' | 'no_time' | 'value_gap';

export type SelfGapAnswer = 'yes' | 'some' | 'no';

/** Adaptive Follow-up (Progressive Profiling) — Declared와 Relationship 사이 모순 후보가
 * 발견된 축에 대해서만 1개 추가 질문을 던진다. 모든 사용자에게 묻지 않는다. */
export interface AdaptiveAnswer {
  axis: MirrorAxisKey;
  /** 선택한 보기의 id. ADAPTIVE_FOLLOWUP 데이터의 option id를 그대로 쓴다. */
  optionId: string;
}

export interface RelationshipExperience {
  /** 생각보다 중요했던 요소 (최대 4개) */
  important: PastFactor[];
  hardest: HardestMoment | null;
  /** 연애 전 생각한 나 vs 실제 연애 속 나 */
  selfGap: SelfGapAnswer | null;
  /** 선택 서술 */
  note: string;
  /** 연애 경험 없음 경로(E4)를 선택했는지 */
  skipped: boolean;
  /** 모순 후보 축에 대한 추가 질문 응답. 물어보지 않았거나 아직 답하지 않았으면 null */
  adaptive: AdaptiveAnswer | null;
}

/* ============ Relationship Evidence Time Model (v1.41 · §39) ============ */

/**
 * 이 근거는 **언제의 나**인가. (v1.41 · §39.2)
 *
 * ══ 왜 이 타입이 필요한가 ═══════════════════════════════════════════════
 *
 * v1.40이 Relationship Stage를 만들고 v1.40.1이 stage별 ACTION SAFETY를 닫았는데,
 * **Core Evidence는 그대로 비대칭이었다.** `dating`의 Job은 `지금 관계에서 기대를
 * 조율한다`까지 확장됐지만 Mirror가 읽는 `RelationshipExperience`는 S15~S17
 * (`이전 관계에서 …`) 하나뿐이었다. 즉 제품은 **한 번도 물어본 적 없는 관계**에 대해
 * `지금 이 관계에서 조율할 기준`이라고 말하고 있었다.
 *
 * 고치는 방법은 두 가지였다.
 *
 * | | 무엇을 하나 | 왜 아닌가 / 왜 맞나 |
 * |---|---|---|
 * | A | `dating`이면 과거 근거를 현재형으로 말한다 | **금지.** 시제만 바꾸면 근거의 출처가 거짓이 된다(§37.20이 이미 정한 규칙) |
 * | B | 현재 관계 근거를 **따로 수집**하고, 근거의 시점을 타입으로 들고 다닌다 | **채택** |
 *
 * ⚠️ **핵심 원칙: RELATIONSHIP STAGE ≠ RELATIONSHIP EVIDENCE TIMEFRAME.**
 * 사용자가 `dating`을 골랐다는 사실은 현재 관계 근거를 **만들어주지 않는다.**
 * scope를 정하는 것은 오직 **사용자가 실제로 답한 것이 무엇인가**다.
 *
 * ══ 왜 값이 세 개뿐인가 ═════════════════════════════════════════════════
 *
 * 처음 후보는 `current | past | general | legacy | insufficient` 다섯이었다. 셋으로
 * 줄인 이유는 나머지 둘이 **이미 다른 축이 말하고 있는 것**이기 때문이다.
 *
 *   general      = Declared Me. 이미 `EvidenceRef.source === 'declared'`가 말한다.
 *                  Mirror의 왼쪽 칸이 통째로 general이므로 축별 scope로 둘 필요가 없다.
 *   legacy       = History Snapshot에 이 필드가 **없는 상태**로 표현한다
 *                  (`HistoryMirrorInsightSnapshot.evidenceScope?`). 없는 것을
 *                  `'legacy'`로 채우면 그건 소급 추정이다(§39.14).
 *   insufficient = `'none'`과 같은 말이다. 두 이름을 두면 호출부가 갈린다.
 *
 * **enum을 늘리는 것이 정직해지는 것은 아니다.** 늘어난 값마다 분기가 생기고, 분기가
 * 늘면 한 곳을 빼먹는다 — 그게 v1.40.1이 닫은 결함의 형태였다.
 */
export type RelationshipEvidenceScope =
  /** 사용자가 **지금 관계**에 대해 직접 답했다 (S30) */
  | 'current'
  /** 사용자가 **이전 관계 경험**에 대해 답했다 (S15~S17) */
  | 'past'
  /** 이 축에는 관계 근거가 없다. 없는 것을 중립값으로 채우지 않는다 */
  | 'none';

/* -------------------------------------- Current Relationship Me (S30) */

/**
 * 지금 관계에서 이 축이 **실제로 얼마나 드러나는가**. (v1.41 · §39.4)
 *
 * ⚠️ 네 값 전부가 **사용자가 직접 고른 답**이다. `unsure`는 미응답이 아니라
 * **"아직 그런 상황이 없었어"라고 답한 것**이고, 미응답은 키가 아예 없는 상태다.
 * 둘을 하나로 묶으면 '물어봤는데 모른다고 답한 사용자'와 '아직 안 물어본 사용자'를
 * 구분할 수 없어진다 — v1.29가 `no_target`/`unknown_target`을 나눈 것과 같은 이유다.
 *
 * ⚠️ **점수가 아니다.** 1/2/3점으로 환산하지 않는다. 이 값이 하는 일은
 * `EvidenceStrength`(근거의 종류)를 고르는 것뿐이고, 동기화율·`comparedCount`에는
 * 어디에도 들어가지 않는다.
 */
export type CurrentSignalAnswer =
  /** 이 축이 지금 관계에서 뚜렷하게 드러난다 */
  | 'often'
  /** 드러나기도 하고 넘어가기도 한다 */
  | 'sometimes'
  /** 지금 관계에서는 거의 드러나지 않는다 — **근거 없음이 아니라 '없다는 근거'다** */
  | 'rarely'
  /** 아직 그런 상황이 없었다 — 답은 했지만 근거는 만들 수 없다 */
  | 'unsure';

/**
 * 지금 관계 속의 나 (S30 · `/profile/current`).
 *
 * ⚠️ **Optional이다. Core Funnel을 막지 않는다**(§39.5). 이 값이 하나도 없어도
 * v1.40.1까지의 모든 화면·판정이 글자 하나 다르지 않게 동작한다 — Mirror는
 * `experience`(과거)로 판정하고 scope는 `'past'`가 된다.
 *
 * ⚠️ **상대에 대한 관찰이 아니다.** 전부 주어가 나인 행동/반응이고, `상대는 회피형이야?`
 * · `이 관계는 건강해?` 같은 질문은 만들지 않는다(§39.7 금지 목록).
 *
 * ⚠️ **자유서술을 받지 않는다.** History Snapshot에 얼려야 하는 값이고, 자유서술을
 * 넣으면 기록이 사람 CRM으로 변한다(§39.14).
 */
export interface CurrentRelationshipEvidence {
  /**
   * 축 → 사용자가 고른 답. **키가 없으면 아직 답하지 않은 것**이다.
   * 4축이 아니라 Mirror 5축 전부를 받는다 — Mirror가 5축이므로.
   */
  signals: Partial<Record<MirrorAxisKey, CurrentSignalAnswer>>;
  /**
   * 이 화면을 실제로 열어본 시점. 한 번 본 사용자에게 같은 권유를 반복하지 않기 위한
   * 표시값이고, **판정에는 쓰지 않는다.** null이면 아직 권유 단계다.
   */
  askedAt: string | null;
}

/* -------------------------------------------------------- Target Person (S19) */

/**
 * 상대와의 관계 맥락 (S19).
 *
 * ⚠️ **계산 근거가 아니다.** 동기화율·4축 similarity·comparedCount·Mirror·History 판정에
 * 이 값이 들어가는 곳은 없다. 화면 맥락과 History 기록(`targetRelation`)에만 남는다 —
 * 그래서 옵션을 늘려도 점수가 바뀌지 않는다.
 *
 * v1.22 §5 — `talking`(썸 타는 중) · `unsure`(잘 모름)를 추가했다.
 *   `unsure` = '이 사람과 나의 **관계 이름**을 모르겠다'는 뜻이다. 상대의 관계 행동을
 *   모른다는 뜻이 아니다 — 그건 4축의 `x`(모름)가 따로 담당하고, 그것만 점수에서 빠진다.
 */
export type TargetRelation = 'crush' | 'talking' | 'friend' | 'work' | 'intro' | 'unsure';

/** l / m / h, x = 잘 모르겠어요 (점수에 반영하지 않음) */
export type TargetLevel = 'l' | 'm' | 'h' | 'x';

/**
 * ⚠️ contact/conflict/alone/affection 4축만 다룬다.
 * talk(대화 방식)/rhythm(생활 리듬)은 예전에 '나의 값'을 사진 관찰 고정값(talk=4, rhythm=3)으로
 * 하드코딩해서 계산했었다 — 사용자가 준 데이터가 아니므로 축 자체를 제거했다.
 * (수집하지 않은 데이터를 계산에 쓰지 않는다는 원칙)
 */
export interface TargetProfile {
  relation: TargetRelation | null;
  contact: TargetLevel;
  conflict: TargetLevel;
  alone: TargetLevel;
  affection: TargetLevel;
  /**
   * 선택 입력. 동기화율·comparedCount·TARGET_MIN_KNOWN 판단에 절대 포함하지 않는다.
   * 나(answers.mbti)와 둘 다 있을 때만 참고용 MbtiLensReport를 만든다.
   */
  mbti: MbtiType | null;
  /**
   * 상대의 출생정보 — **사용자가 알고 있는 만큼만** 입력한 값이다(§34).
   * 상대가 직접 입력한 것처럼 표현하지 않고, 결과에도 '네가 입력한 정보 기준'을 고지한다.
   */
  birthProfile: BirthProfile;
  /**
   * v1.13 — '다가가는 힌트'(Approach Hints)의 재료. **선택 입력**이고 동기화율(Compatibility
   * Score)·Mirror MATCH/GAP/CHANGE 어디에도 절대 들어가지 않는다(§11/§12) — 취향 일치는
   * 연애 성공 예측 근거가 아니다. 출처는 항상 'USER-REPORTED TARGET INFO'다 — AI가 사진이나
   * 다른 데이터에서 상대 취향을 추론해 채우지 않는다(§10/§51).
   */
  preferences: TargetPreferences;
  /**
   * v1.46 §5 — **사용자가 보고한 관계 사건.** 선택 입력이고 최대 3개다
   * (`RELATIONSHIP_EVENT_MAX`).
   *
   * ⚠️ 동기화율(4축 similarity · comparedCount · TARGET_MIN_KNOWN)·Mirror
   * MATCH/GAP/CHANGE·History 변화 판정에 **절대 들어가지 않는다**(§11 · §12).
   * `preferences`(v1.13)가 세운 경계와 같고, 이유도 같다 — 사용자가 기억하는 장면은
   * 관계의 성공 확률이나 상대의 의도에 대한 근거가 아니다.
   *
   * ⚠️ `TargetProfile` 안에 있으므로 `createEmptyTargetProfile()` 하나로 New Target에서
   * 함께 비워진다(§14 — Target A의 사건이 Target B로 넘어가면 P1). 별도 초기화 코드를
   * 만들지 않는다.
   */
  events: RelationshipEvent[];
}

export type TargetAxisKey = 'contact' | 'conflict' | 'alone' | 'affection';

/* --------------------------------------------- Target Preference (v1.13) */

export type TargetInterestCategory =
  | 'food'
  | 'cafe'
  | 'exhibition'
  | 'movie_show'
  | 'music'
  | 'exercise'
  | 'walk'
  | 'travel'
  | 'game'
  | 'reading'
  | 'pet'
  | 'photo'
  | 'shopping'
  | 'drink'
  | 'home'
  | 'custom';

/** 최대 5개(§5). `category==='custom'`이면 `label`이 사용자가 직접 적은 문장이다(§6) */
export interface TargetInterest {
  id: string;
  category: TargetInterestCategory;
  label: string;
}

export interface TargetPreferences {
  interests: TargetInterest[];
}

/* ------------------------- User-reported Relationship Event (v1.46) */

/**
 * 사용자가 **직접 기억해서 알려준** 관계 사건의 종류 (v1.46 §7)
 *
 * ⚠️ **결론을 고르게 하지 않는다.** `상대가 나를 좋아한다`·`상대가 밀당한다` 같은
 * 항목은 없고, 앞으로도 만들지 않는다. 모든 값은 `호감이 느껴졌던 순간`처럼
 * **사용자의 관찰·해석임이 이름에서 드러나는 표현**이다(§7).
 *
 * ⚠️ 이 값은 **판정에 쓰지 않는다.** 동기화율 4축·Mirror MATCH/GAP/CHANGE·History
 * 변화 어디에도 분기를 만들지 않는다(§11 · §12). 그래서 종류를 늘려도 점수가
 * 바뀌지 않는다 — `TargetRelation`이 v1.22부터 지켜온 것과 같은 성질이다.
 */
export type RelationshipEventType =
  | 'affection_felt'
  | 'conflict'
  | 'contact_change'
  | 'closer'
  | 'distance'
  | 'care_received'
  | 'meeting'
  | 'other';

/**
 * 관계 사건 하나 (v1.46 §8)
 *
 * ⚠️ **날짜·장소·상대 이름을 받지 않는다**(§8). 그 세 개를 받는 순간 History가
 * 관계 일지/사람 CRM이 되고, 이 제품이 v1.0부터 거부해 온 방향이다.
 *
 * ⚠️ `description`은 **자유 입력**이다. 자유 입력이 갈 수 있는 곳의 경계는
 * `lib/logic/relationshipEvents.ts` 상단에 적혀 있다 — 요약하면 화면과
 * localStorage뿐이고, 외부 Analytics와 AI Provider로는 나가지 않는다.
 */
export interface RelationshipEvent {
  id: string;
  type: RelationshipEventType;
  /** 무슨 일이 있었어? — 짧은 자유 입력 */
  description: string;
  /** 그때 나는 어떻게 반응했어? — 선택 */
  myReaction?: string;
}

/**
 * '다가가는 힌트'가 실제로 참조한 근거. AI가 새로운 상대 사실을 만들어내지 못하게
 * 이 유니온에 없는 값은 evidence로 쓸 수 없다(§17).
 */
export type TargetEvidenceRef =
  | { type: 'interest'; id: string }
  | { type: 'contact'; value: TargetLevel }
  | { type: 'alone'; value: TargetLevel }
  | { type: 'affection'; value: TargetLevel }
  | { type: 'conflict'; value: TargetLevel };

export type ApproachHintKind = 'activity' | 'communication' | 'pace' | 'affection' | 'conversation';

/**
 * '다가가는 힌트' 카드 하나 (v1.13 §16).
 *
 * ⚠️ 이건 호감도 예측이나 공략법이 아니다 — 사용자가 알려준 상대 정보를 존중해서 다가가는
 * 방법일 뿐이다(§53). `kind: 'conversation'`은 근거가 부족해 조언 대신 질문을 제안하는
 * 경우다(§29~§31, "KNOW → Suggest / UNKNOWN → Ask").
 */
export interface ApproachHint {
  id: string;
  kind: ApproachHintKind;
  title: string;
  rationale: string;
  evidenceRefs: TargetEvidenceRef[];
  /** 'direct' = 사용자가 직접 입력한 값 그대로. 'contextual' = 두 근거를 조합했거나 질문 제안 */
  confidence: 'direct' | 'contextual';
  caution?: string;
}

/* ------------------------------------------------------- Compatibility (S21~S25) */

export type SignalTone = 'good' | 'neutral' | 'watch' | 'unknown';

/**
 * ⚠️ 실제 관계 행동 신호(contact/conflict/alone/affection)만 여기 들어온다.
 * MBTI는 이 타입에 들어오지 않는다 — 동기화율 계산과 완전히 분리된 MbtiLensReport로 다룬다.
 */
export interface CompatibilityDimension {
  key: TargetAxisKey;
  label: string;
  /** 나의 값 1~5. 미응답이면 null */
  mineValue: number | null;
  minePhrase: string;
  /** 상대의 값 1~5. '모름'이면 null */
  theirsValue: number | null;
  theirsPhrase: string;
  /** 0~5. null = 비교 불가 */
  alignment: number | null;
  tone: SignalTone;
  evidence: string;
  /** 실제 관계에서 나타날 수 있는 상황 */
  scene: string;
}

export interface CompatibilityResult {
  /** 동기화율. 비교 가능한 항목이 부족하면 null (E3) */
  score: number | null;
  dimensions: CompatibilityDimension[];
  goodSignals: CompatibilityDimension[];
  frictionSignals: CompatibilityDimension[];
  /** '모름'으로 남아 비교하지 못한 항목 */
  unknownLabels: string[];
  comparedCount: number;
  totalCount: number;
  confidence: Confidence;
}

/**
 * 관계 신호 기반 질문은 축 key를, MBTI 기반 보조 질문은 `mbti_` 접두사를 쓴다.
 *
 * v1.26 P3-3 — Premium 연결 질문은 `conn_` 접두사를 쓴다. **무료 질문 id와 겹치면 안
 * 된다** — `savedQuestions`가 id로만 참조하므로, 겹치면 무료 질문을 저장했는지 유료 질문을
 * 저장했는지 구분할 수 없고 한쪽이 다른 쪽을 조용히 덮어쓴다.
 */
export type ConversationQuestionId =
  | TargetAxisKey
  | `mbti_${MbtiAxisKey}`
  | `conn_${MirrorAxisKey}`;

export interface ConversationQuestion {
  id: ConversationQuestionId;
  /** 어떤 항목에서 나온 질문인지 */
  tag: string;
  text: string;
  fromFriction: boolean;
  /**
   * MBTI 선호 차이에서 만든 보조 질문인지. 관계 신호 질문을 대체하지 않고 뒤에 덧붙기만 한다 —
   * 'MBTI 궁합이 안 맞으니 확인'이 아니라 '서로 실제 선호를 확인하는 대화'다.
   */
  fromMbti?: boolean;
}

/* --------------------------------------------- Relationship Mirror (S26~S28) */

/**
 * ⚠️ Prototype Demo Logic
 * MATCH / GAP / CHANGE 는 두 개의 숫자를 빼서 나온 값이 아니라, '관계 경험에서 이 축에 대한
 * 근거가 있었는가'를 기준으로 판정하는 카테고리 규칙이다. UNKNOWN은 그 근거 자체가 없어서
 * 어느 쪽으로도 판정하지 않는 상태 — Missing data를 중립값으로 채우지 않기 위해 존재한다.
 */
export type MirrorState = 'MATCH' | 'GAP' | 'CHANGE' | 'UNKNOWN';

export type MirrorAxisKey = 'alone' | 'contact' | 'hobby' | 'conflict' | 'affection';

/** 이 축에 대한 관계 경험 근거가 얼마나 강한지. 숫자로 위장하지 않고 근거의 종류로만 말한다. */
export type EvidenceStrength = 'hardest' | 'important' | 'absent';

export interface MirrorInsight {
  key: MirrorAxisKey;
  label: string;
  /** 네가 말한 너 — Declared Me에서 실제로 수집한 값. 1~5 */
  declared: number;
  /** Declared 축이 실제 1~5 스케일 질문이었는지. false면 화면에 'N/5'를 붙이지 않는다 */
  declaredHasScale: boolean;
  declaredPhrase: string;
  /** 관계 경험에서 발견한 신호 — 숫자가 아니라 문장이다 */
  relationshipSignal: string;
  evidenceStrength: EvidenceStrength;
  /**
   * v1.41 §39.8 — 이 축의 `relationshipSignal`이 **언제의 나**에서 나왔는가.
   *
   * `evidenceStrength`(근거가 얼마나 강한가)와 **직교한다.** 두 값을 한 enum으로
   * 합치면 `absent + current`(지금 관계에서는 드러나지 않는다고 **답했다**)와
   * `absent + none`(아무 근거가 없다)을 구분할 수 없어진다 — 전자는 근거가 있는
   * 상태이고 후자는 없는 상태다. 화면 문구도, evidenceRef 생성 여부도 갈린다.
   */
  evidenceScope: RelationshipEvidenceScope;
  state: MirrorState;
  /** 러비의 해석 한 줄 */
  note: string;
}

export interface MirrorTeaser {
  axisKey: MirrorAxisKey;
  axisLabel: string;
  declaredPhrase: string;
  relationshipPhrase: string;
}

export interface EvidenceItem {
  n: string;
  text: string;
}

export interface CoreInsight {
  headline: string;
  evidence: EvidenceItem[];
  /** 홈·프로필에서 재사용하는 한 줄 요약 */
  summary: string;
}

export interface MirrorReport {
  /** experience.skipped 면 false. 이때 insights/teaser/core는 비어 있다 — 가짜 비교를 만들지 않는다 */
  available: boolean;
  /** MATCH/GAP/CHANGE로 판정된 축만. UNKNOWN(근거 없음) 축은 여기 포함하지 않는다 */
  insights: MirrorInsight[];
  /** 비교를 시도한 전체 축 수 (판정 여부와 무관) */
  totalAxisCount: number;
  teaser: MirrorTeaser | null;
  core: CoreInsight | null;
  gapCount: number;
  /**
   * v1.41 §39.9 — 판정된 축들의 근거가 **어느 시점에서 왔는지**의 요약.
   *
   * 축별로 source가 섞일 수 있다(contact는 지금 관계, conflict는 이전 관계). 그때
   * 화면이 전체를 `지금 관계 속의 나`라고 부르면 **거짓**이므로, 섞였다는 사실을
   * 화면이 읽을 수 있어야 한다. 카드를 추가하지 않고 캡션·행 annotation으로만 쓴다.
   */
  scopeSummary: MirrorScopeSummary;
}

/** v1.41 — Mirror 근거의 시점 분포. 판정에는 쓰지 않는다(표시 전용) */
export interface MirrorScopeSummary {
  /** 근거가 지금 관계에서 온 축 수 */
  currentCount: number;
  /** 근거가 이전 관계 경험에서 온 축 수 */
  pastCount: number;
  /** 관계 근거 없이 declared만으로 판정된 축 수 (CHANGE) */
  noneCount: number;
  /** `currentCount > 0 && pastCount > 0` — 섞였으면 전체를 한 시점으로 부르지 않는다 */
  mixed: boolean;
  /**
   * 이 Mirror를 **한 시점의 이름으로 부를 수 있는가**. 부를 수 있으면 그 시점.
   * 섞였거나 근거가 없으면 null이고, 화면은 시점 이름을 쓰지 않는다.
   */
  dominant: RelationshipEvidenceScope | null;
}

/* --------------------------------------------- Relationship Profile (S18) */

export interface ProfileLayer {
  id: 'observed' | 'declared' | 'relationship';
  title: string;
  caption: string;
  items: string[];
}

/**
 * S18은 Observed/Declared/Relationship 세 Source를 나열해서 보여줄 뿐,
 * 그 사이의 모순이나 Gap을 판정하지 않는다 (그건 S26 Mirror Teaser부터 처음 등장한다).
 * 그래서 coreInsight는 'Profile Summary'이지 비교 문장이 아니다 — 근거 추적은 layers의
 * 항목이 어느 Source(칩 그룹)에서 왔는지로 이미 충분하다.
 */
export interface RelationshipProfile {
  layers: ProfileLayer[];
  /** 세 Source를 종합한 요약 문장. '~라고 했지만 실제로는' 같은 비교 표현을 쓰지 않는다 */
  coreInsight: string;
  confidence: Confidence;
}

/* ------------------------------------- Relationship History (F1/F2, Retention) */

/**
 * Relationship History는 '누구와 언제 만났는지'를 기록하지 않는다.
 * 관계를 거치며 **내 기준·반응·Gap·Core Insight가 어떻게 변해왔는지**만 축적한다.
 * (Relationship Diary ❌ / Personal Relationship Memory ⭕)
 *
 * SessionAnswers(현재 진행 중인 분석)와 완전히 분리된 영구 데이터다 —
 * 저장소도 `lym.history.v1`로 따로 쓴다.
 */

/** 축별 변화 판정. '성장'이나 '좋아짐'을 판정하지 않는다 — 변화의 유무와 방향만 말한다. */
export type HistoryChangeState =
  /** 과거에도 같은 상태로 나타났다 */
  | 'STABLE'
  /** 과거와 다른 상태로 나타났다 */
  | 'SHIFT'
  /** 이번에 처음 나타난 축이다 */
  | 'NEW'
  /** 비교할 기록이 부족하다 (판정하지 않는다) */
  | 'INSUFFICIENT';

export interface HistoryMirrorInsightSnapshot {
  axis: MirrorAxisKey;
  /** UNKNOWN은 애초에 MirrorReport.insights에 없으므로 저장 대상도 아니다 */
  state: Exclude<MirrorState, 'UNKNOWN'>;
  declaredText: string;
  relationshipSignal: string;
  /**
   * v1.41 §39.14 — 이 판정의 근거가 **언제의 나**였는지 함께 얼린다.
   *
   * ⚠️ **optional이고, 없는 값을 소급 추정하지 않는다.** v1.40까지 저장된 기록에는
   * 이 필드가 없고, 그 기록들이 전부 과거 경험 근거였다는 것은 **사실이지만 우리가
   * 그때 그렇게 기록하지 않았다.** `undefined`를 `'past'`로 읽으면 '그때 그렇게
   * 기록했다'는 거짓이 되므로, 화면은 이 값이 없으면 **시점을 말하지 않는다**
   * (`legacy` 취급). 새 enum 값을 만들지 않고 **필드의 부재**로 표현한다.
   */
  evidenceScope?: RelationshipEvidenceScope;
}

export interface RelationshipHistoryEntry {
  id: string;
  /**
   * 이 기록이 **누구에 대한 관찰인가** (v1.34 · P4-B).
   *
   * ⚠️ **optional이다.** v1.33 이전에 저장된 기록에는 이 필드가 없고, 그건 전부
   * 커플 관찰이므로 `undefined`를 `'couple'`로 읽는다(`historyAudienceOf`).
   * 파괴적 migration을 하지 않는다 — 사용자의 기존 기록을 다시 쓰지 않는다.
   *
   * ⚠️ 이 구분이 없으면 **커플 변화 리포트가 Solo 기록과 비교된다.**
   * `buildHistoryReport`는 마지막 두 항목을 보고, `findRepeatedRelationshipSignals`는
   * 모든 항목을 훑는다 — 둘 다 audience를 몰랐다.
   */
  audience?: 'couple' | 'solo';
  /**
   * Solo 관찰의 self signal 스냅샷 (v1.34 · P4-B).
   *
   * 커플 기록에는 없다. Mirror가 만들어지지 않는 사용자(관계 경험 없음)도 자기
   * 기준은 답했으므로, 그 기준을 **그때의 값 그대로** 얼려둔다.
   *
   * ⚠️ 자유서술·사진 원문·생년월일은 넣지 않는다(기존 History privacy 정책 유지).
   */
  soloSnapshot?: {
    /** 그때 답한 관계 기준 — `declaredSnapshot`과 같은 값이지만 Solo 비교의 주어다 */
    signals: { axis: MirrorAxisKey; level: string }[];
    /** 그때 화면에 보인 핵심 한 문장 */
    headline: string;
    /** 그때 함께 나타난 두 신호의 id 목록 — 문장이 아니라 규칙 id만 */
    pairIds: string[];
    /** 그때 쓸 수 있던 정보 종류 — 사진/MBTI 유무 등 categorical만 */
    sources: ('declared' | 'mbti' | 'observed' | 'experience')[];
    /**
     * 그때 사진에서 보였던 **활동 범주만** (v1.35 · P4-B §5).
     *
     * ⚠️ 사진 원본·base64·AI 서술 원문은 넣지 않는다. 시간축 비교에 필요한 최소값
     * (범주 · 장면 수 · 반복 강도)만 남기고, 그 값들은 모두 이미 계산돼 있던
     * `ObservedSignal`에서 그대로 옮긴다 — 새 판정을 만들지 않는다.
     *
     * ⚠️ **`undefined`와 `[]`는 다르다.** `undefined`는 '그때는 이 값을 저장하지
     * 않았다'(v1.34 이전 기록)이고, `[]`는 '사진 근거가 없는 관찰이었다'다.
     * 비교는 전자를 `INSUFFICIENT`로, 후자를 '없었다'로 읽는다.
     */
    observed?: {
      category: ObservedSignalCategory;
      /** 서로 다른 장면 수 — 사진 장수가 아니다(§5 과대계산 금지) */
      occurrences: number;
      strength: ObservedSignalStrength;
    }[];
  };
  /**
   * 분석 입력(status + declared + experience)에서 파생한 지문.
   * 같은 분석을 두 번 저장하면 새 항목이 쌓이지 않고 갱신된다 — 저장 반복이
   * '관계 횟수'처럼 부풀려지는 것을 막기 위해서다.
   */
  analysisId: string;
  createdAt: string;

  context: {
    relationshipStatus: RelationshipStatus | null;
    targetRelation: TargetRelation | null;
  };

  /**
   * ⚠️ MBTI는 저장하지만 **변화를 해석하지 않는다.**
   * INFP → ENFP가 되어도 '관계를 통해 외향적으로 변했다' 같은 Insight를 만들지 않는다.
   * 순수 Profile Snapshot metadata다.
   */
  profileSnapshot: {
    mbti: MbtiType | null;
  };

  declaredSnapshot: DeclaredPreference;

  relationshipEvidence: {
    important: PastFactor[];
    hardest: HardestMoment | null;
    selfGap: SelfGapAnswer | null;
    adaptive: AdaptiveAnswer | null;
  };

  mirrorSnapshot: {
    insights: HistoryMirrorInsightSnapshot[];
    focusAxis: MirrorAxisKey | null;
  };

  coreInsight: {
    /** 그 당시 화면에 보인 핵심 문장 (AI headline이면 그 문장) */
    original: string;
    userCorrection: string | null;
    verdict: Verdict;
    /**
     * v1.7 §25 — 이 문장이 어떤 모드·프롬프트에서 나왔는지.
     *
     * ⚠️ **History Change Logic에서 절대 읽지 않는다.** 변화 판정은 Declared·Relationship
     * Evidence·Mirror state만으로 한다 — AI 모드가 바뀌었다고 '변화'가 생기면 안 된다.
     */
    aiMeta?: {
      mode: AiMode;
      promptVersion: string;
      generatedAt: string;
    };
  };

  /** 기존 Confidence와 같은 의미 — 'AI의 확신'이 아니라 '확보된 입력 근거량' */
  evidenceCoverage: Confidence;
}

/* ---------------------------------- History 비교 결과 (F2 변화 리포트 / S27 반복 신호) */

export interface HistoryAxisChange {
  axis: MirrorAxisKey;
  label: string;
  state: HistoryChangeState;
  /** PAST — 이전 기록에서의 Mirror 상태 */
  previousState: Exclude<MirrorState, 'UNKNOWN'> | null;
  /** NOW — 현재(또는 최신) 기록에서의 Mirror 상태 */
  currentState: Exclude<MirrorState, 'UNKNOWN'> | null;
  /** PAST 쪽 표현. Relationship Evidence는 숫자로 만들지 않는다 — 문장으로만 */
  previousText: string | null;
  currentText: string | null;
  /**
   * 직접 1~5로 수집한 축(contact/alone)만 값 비교가 가능하다.
   * 나머지 축은 null — 선택형 답변을 증감으로 말하지 않기 위해서다.
   */
  declaredDelta: { past: number; now: number } | null;
  /** 러비의 관찰 한 줄. '성장했다'류 판정을 만들지 않는다 */
  note: string;
}

/** §21 — 같은 축에서 GAP/CHANGE 신호가 되풀이된 기록. MATCH는 반복 신호로 보지 않는다. */
export interface RepeatedRelationshipSignal {
  axis: MirrorAxisKey;
  label: string;
  occurrences: number;
  entryIds: string[];
  states: Array<'GAP' | 'CHANGE'>;
}

export interface HistoryReport {
  entryCount: number;
  /** 변화 비교가 가능한지 — 기록 2개 이상이어야 한다 (1개로 가짜 변화를 만들지 않는다) */
  comparable: boolean;
  changes: HistoryAxisChange[];
  /** 가장 의미 있는 변화 1개 (SHIFT 우선 → NEW) */
  headline: HistoryAxisChange | null;
  shiftCount: number;
  stableCount: number;
  newCount: number;
  /** 러비 한 줄 요약 */
  summary: string;
  /**
   * 이 비교에 **실제로 참여한 커플 기록** (v1.35 · P4-B §10).
   *
   * ⚠️ 화면과 Cross-source Engine이 `useHistory().latest`/`previous`를 대신 쓰면 안 된다.
   * 그 값은 audience를 가리지 않아서, Solo 관찰이 마지막에 저장되면 **비교한 기록과
   * 화면에 적힌 날짜가 서로 다른 기록을 가리킨다**(실측으로 확인한 Mixed History 버그).
   */
  compared: {
    previousId: string | null;
    latestId: string | null;
    previousCreatedAt: string | null;
    latestCreatedAt: string | null;
  };
}

/* ============================ AI Analysis Pipeline (v1.6) ============================ */

/**
 * ⚠️ **역할 분리가 이 파이프라인의 핵심이다.**
 *
 *   Rule Logic (deterministic) = 점수 · 상태 판정 · 데이터 비교
 *   AI                          = 관찰 · 정리 · 설명 · 개인화 문장 · 질문 생성
 *
 * AI는 동기화율·Mirror State·History State를 만들거나 바꾸지 못한다.
 * 순서: Evidence → Rule → AI Explanation → User Verification
 */

export type AiMode =
  /** 실제 Provider 호출 결과 */
  | 'real'
  /**
   * 개발 전용 Mock Provider 결과 (v1.7 · §5).
   * 파이프라인·검증·화면 배선을 실제 코드 경로로 확인하기 위한 것이고,
   * **실제 Provider 검증이 아니다.** Production에서는 발생하지 않는다.
   */
  | 'mock'
  /** 규칙 기반 데모 (Provider 미연결 / 로컬 개발 / 포트폴리오) */
  | 'demo'
  /** real을 시도했지만 실패해서 규칙 결과로 대체 — 사용자에게 표시한다 */
  | 'fallback'
  /** v1.5 이전 세션에서 복원된 결과 (당시 데모) */
  | 'legacy-demo';

export type AiTask =
  | 'observed-profile'
  | 'relationship-insight'
  | 'compatibility-narrative'
  | 'history-insight'
  /** v1.9 — Cross-source Insight Narrative (§24).판정은 규칙이 이미 끝냈다. */
  | 'deep-report-narrative'
  /**
   * v1.46 AI Lens §3 — **관계 렌즈 3종을 각각 따로 부른다.**
   *
   * 하나의 `premium-lens` Task에 `kind`를 실어 보내는 방법도 있었지만 그렇게 하지
   * 않았다. Task는 이 코드베이스에서 **계약의 단위**다 — `TASK_CONTRACT` 한 줄,
   * `PROMPT_VERSIONS` 한 개, 캐시 키 한 개가 Task마다 붙는다(§28 렌즈별 fingerprint).
   * kind를 payload로 넘기면 세 렌즈가 **같은 promptVersion과 같은 캐시 네임스페이스**를
   * 쓰게 되고, MBTI 프롬프트만 고쳐도 사주·별자리 캐시가 함께 죽는다.
   */
  | 'premium-mbti-lens'
  | 'premium-saju-lens'
  | 'premium-zodiac-lens'
  /** v1.46 AI Lens §21 — 세 렌즈 결과를 다시 연결한다. 렌즈 3개 이후에만 호출된다 */
  | 'premium-cross-lens';

/**
 * Provider에게 실제로 나가는 작업 단위 (v1.10).
 *
 * `AiTask`는 **화면이 부르는 내부 API 1개**에 대응한다. 그런데 사진 분석은 한 번의 화면
 * 요청(`observed-profile`) 안에서 **사진 장수만큼** Provider를 부른다 — 사진 한 장씩
 * 따로 봐야 Provider가 '여러 장에서 반복됐다'를 스스로 주장할 수 없기 때문이다(§3).
 * 그래서 Provider/mock 쪽에서만 쓰는 작업 id를 따로 둔다.
 *
 * ⚠️ 이 값은 `aiClient`의 ENDPOINT 표에 들어가지 않는다 — 대응하는 라우트가 없다.
 */
export type AiProviderTask = AiTask | 'observed-photo-analysis';

/** 결과 재현·QA를 위한 내부 metadata. 사용자에게 그대로 노출하지 않는다 */
export interface AiAnalysisMeta {
  mode: AiMode;
  analysisVersion: string;
  promptVersion: string;
  model?: string;
  generatedAt: string;
  /** 입력 지문 — 입력이 바뀌면 stale 응답을 버리는 기준(§55) */
  inputFingerprint: string;
}

export type AiFailureReason =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'INVALID_OUTPUT'
  | 'POLICY_BLOCK'
  | 'NO_USABLE_IMAGE'
  | 'RATE_LIMIT'
  | 'SERVER_ERROR'
  | 'CONFIG_ERROR';

/* ------------------------------------------------- Evidence Grounding */

/**
 * AI 설명이 어떤 데이터에서 나왔는지 추적하는 참조(§17).
 * EvidenceRef가 없는 **강한 해석은 버린다** — uncertainty를 명시한 경우만 예외다.
 */
export type EvidenceRef =
  | { source: 'declared'; field: string }
  | { source: 'relationship'; field: string }
  /**
   * v1.41 §39.8 — **지금 관계**에 대해 사용자가 직접 답한 값(S30). `field`는
   * `MirrorAxisKey`다.
   *
   * ⚠️ `relationship`(과거 경험)과 **절대 같은 ref로 쓰지 않는다.** v1.40까지
   * `relationshipRefFor()`는 강도만 보고 `{source:'relationship', field:'hardest'}`를
   * 만들었는데, 근거가 현재 관계에서 온 경우에 그 ref를 붙이면 resolver가
   * `이전 관계에서 …` 문장을 돌려준다 — **근거를 지목하는 곳에서 시점을 거짓으로
   * 만드는 것**이다.
   */
  | { source: 'current_relationship'; field: string }
  | { source: 'adaptive'; field: string }
  | { source: 'observed'; traitId: string }
  | { source: 'history'; entryId: string; axis: string }
  /** v1.9 — 상대에 대해 사용자가 입력한 값(Target Person) */
  | { source: 'target'; field: string }
  /**
   * v1.46 §10 — 사용자가 직접 알려준 **관계 사건**(`RelationshipEvent`).
   *
   * ⚠️ `target`(상대에 대해 입력한 값)과 **같은 ref로 쓰지 않는다.** `target`은
   * 사용자가 고른 4축 선택지이고 이쪽은 사용자가 기억해서 적은 장면이다 — 근거
   * 목록에서 둘이 한 출처로 보이면 `자료 N종`이 거짓이 된다(v1.41 §39.9가 `relationship`
   * 과 `current_relationship`을 가른 것과 같은 이유).
   *
   * ⚠️ **resolver가 돌려주는 것은 사용자가 입력한 문장 그대로다.** 상대의 의도·감정·
   * 호감 확률로 번역하지 않는다(§10 NOT FACT 목록).
   */
  | { source: 'user_reported_event'; eventId: string }
  /** v1.9 — Premium Adaptive Deep Question 답변(§11) */
  | { source: 'deep_followup'; questionId: string }
  /**
   * v1.26 — 이미 계산된 동기화율 축 판정. `field`는 `TargetAxisKey`다.
   * resolver가 '나: … · 상대: …' 형태의 **저장된 answer label**로만 풀어낸다.
   */
  | { source: 'compatibility'; field: string }
  /** v1.26 — MBTI 성향 렌즈의 한 축. `field`는 `MbtiAxisKey`다 */
  | { source: 'mbti_lens'; field: string };

/* --------------------------------------------- Observed Me (사진 분석) */

export type ObservedCategory = 'interest' | 'activity' | 'social' | 'lifestyle';

export interface ImageEvidence {
  /** 세션 내부 임의 id. 사용자 원본 파일명을 AI에 보내지 않는다(§29) */
  imageId: string;
  description: string;
}

/* ------------------------------- Photo Vision 4계층 (v1.10 §2) */

/** LEVEL 1 Observation — 사진 한 장에서 직접 보이는 것 하나 */
export interface ObservedLabel {
  label: string;
  /** Provider가 준 값. 반복 판정에는 쓰지 않는다 — 그건 규칙이 한다(§3) */
  confidence?: number;
}

/**
 * LEVEL 1 — 사진 **한 장**의 관찰 결과.
 *
 * ⚠️ 이 구조에는 '몇 장에서 반복됐는가'가 **없다.** Provider는 자기가 본 사진 한 장만
 * 알고 있고, 반복 여부는 애플리케이션 로직이 판정한다(§3 · §4).
 */
export interface PhotoObservation {
  photoId: string;
  scenes: ObservedLabel[];
  activities: ObservedLabel[];
  objects: ObservedLabel[];
  environment?: ObservedLabel[];
  evidenceSummary: string;
  /** 흐리거나 판단 불가라 관찰을 만들 수 없었던 사진 */
  usable: boolean;
}

/** LEVEL 2 Activity Signal — 관찰 사실을 정규화한 활동 범주 */
export type ObservedSignalCategory =
  | 'sports'
  | 'outdoor'
  | 'travel'
  | 'food'
  | 'cafe'
  | 'culture'
  | 'reading'
  | 'pet'
  | 'social'
  | 'other';

/**
 * LEVEL 3 판정 결과 (§5).
 * - `single`: 사진 1장 — 단일 관찰. '평소 생활'이라고 부르지 않는다.
 * - `repeated`: 2장 — 반복 가능성
 * - `strong_repeated`: 3장 이상 — 반복 신호
 */
export type ObservedSignalStrength = 'single' | 'repeated' | 'strong_repeated';

/**
 * LEVEL 3 — 사진들을 가로질러 집계한 활동 신호.
 *
 * ⚠️ `occurrenceCount`는 **사진 장수가 아니라 서로 다른 장면 그룹의 수**다(§5).
 * 같은 날 같은 장소에서 연속 촬영한 것으로 보이는 사진들은 한 그룹으로 묶여 1회로 센다 —
 * 사진을 많이 올렸다는 이유로 생활 근거가 부풀지 않게 한다.
 */
export interface ObservedSignal {
  id: string;
  category: ObservedSignalCategory;
  label: string;
  /** §17 Evidence Provenance — 어떤 사진에서 나왔는지 항상 추적 가능해야 한다 */
  photoIds: string[];
  occurrenceCount: number;
  /** 이 신호를 만든 관찰 라벨들 ('야구장' · '유니폼 착용' 같은) */
  evidence: string[];
  strength: ObservedSignalStrength;
  /** 중복처럼 보여 한 그룹으로 묶인 사진이 있었는지 — 화면에서 과대계산을 설명할 때 쓴다 */
  hasDuplicateLikePhotos: boolean;
}

/**
 * 사진에서 관찰된 생활 신호.
 *
 * ⚠️ `confidence`는 '이 사람이 진짜 이런 사람일 확률'이 아니라
 * **'이미지에서 이 관찰을 뒷받침하는 신호가 얼마나 명확한가'**다(§6).
 */
export interface AiObservedTrait {
  id: string;
  category: ObservedCategory;
  label: string;
  observation: string;
  /** real mode에서는 최소 1개가 필수다. 비면 UI에 노출하지 않는다(§10) */
  evidence: ImageEvidence[];
  /** demo·legacy 결과의 문장형 근거 (이미지 단위 evidence가 없던 시절) */
  evidenceText?: string;
  confidence: Confidence;
  /**
   * v1.10 — 이 trait을 만든 집계 신호. **실제 사진 분석 결과에만 있다.**
   * demo/fallback 결과에는 없다 — 없는 반복 근거를 있는 것처럼 만들지 않는다.
   * `signal.id === trait.id`라서 사용자 수정(§16)이 그대로 신호에 매핑된다.
   */
  signal?: ObservedSignal;
}

/** 사진 수가 아니라 **쓸 만한 근거의 양**으로 판정한다. AI가 스스로 판정하지 않는다(§11) */
export type EvidenceCoverageLevel = 'low' | 'medium' | 'high';

/**
 * 화면·Analytics가 구분해야 하는 관찰 상태 (v1.10 §8).
 *
 * ⚠️ '분석 실패'와 '반복 없음'을 **절대 같은 상태로 처리하지 않는다.**
 * 반복이 없다는 건 정상적인 관찰 결과이고, 실패는 우리가 못 한 일이다.
 */
export type ObservedAnalysisState =
  /** A. Vision 성공 + 반복 신호 있음 */
  | 'repeated_found'
  /** A'. Vision 성공 + 단일 관찰만 있음 — No Pattern ≠ No Information(§7) */
  | 'single_only'
  /** Vision 성공했지만 쓸 만한 관찰 자체가 안 나옴 */
  | 'no_observation'
  /** B. Provider 실패 → 규칙 결과로 대체 */
  | 'provider_failed'
  /** C. 개발용 mock */
  | 'mock'
  /** C. Provider 미연결 데모 */
  | 'demo'
  /** D. 분석에 쓸 사진이 부족 */
  | 'insufficient_photos';

export interface ObservedProfileResult {
  version: string;
  traits: AiObservedTrait[];
  limitations: string[];
  evidenceCoverage: {
    imageCount: number;
    usableImageCount: number;
    level: EvidenceCoverageLevel;
  };
  /**
   * v1.10 — 예전 세션에 저장된 결과에는 없다(optional). 없으면 화면이 `meta.mode`로
   * 예전처럼 판단한다 — 저장된 결과를 마이그레이션한다고 지어내지 않는다.
   */
  observedState?: ObservedAnalysisState;
  meta: AiAnalysisMeta;
}

/**
 * 사용자 검증 결과(§13).
 * **AI Original을 덮어쓰지 않는다** — 원본과 사용자 수정을 분리 보관한다.
 */
export interface ValidatedObservation {
  original: AiObservedTrait;
  status: 'unverified' | 'confirmed' | 'corrected' | 'excluded';
  userCorrection?: string;
}

/* --------------------------------------- Narrative (설명 생성 결과물) */

/**
 * Mirror 판정은 **규칙이 정한다.** AI는 그 판정을 근거와 함께 설명만 한다(§18).
 * AI가 `state`를 바꿔 보내면 검증 단계에서 버린다.
 */
export interface RelationshipNarrative {
  axis: MirrorAxisKey;
  state: MirrorState;
  headline: string;
  explanation: string;
  evidenceRefs: EvidenceRef[];
  question?: string;
  /** 근거가 약할 때 반드시 채운다 */
  uncertainty?: string;
}

export interface CoreInsightNarrative {
  /** 규칙이 고른 focus 축. AI가 선택하지 않는다(§19) */
  axis: MirrorAxisKey;
  headline: string;
  summary: string;
  evidenceRefs: EvidenceRef[];
  limitations: string[];
}

export interface CompatibilityNarrative {
  dimensionKey: TargetAxisKey;
  /** 규칙이 정한 판정. AI가 good ↔ friction을 뒤집지 못한다 */
  kind: 'good' | 'friction';
  explanation: string;
  scenario: string;
  conversationQuestion?: string;
  evidenceRefs: EvidenceRef[];
  /** 근거가 약할 때 반드시 채운다 — evidenceRefs가 비면 이 값이 필수다(§13) */
  uncertainty?: string;
}

export interface HistoryNarrative {
  axis: MirrorAxisKey;
  /** 규칙이 판정한 변화 상태 */
  state: HistoryChangeState;
  explanation: string;
  evidenceRefs: EvidenceRef[];
  /** '~일 수도 있어' 수준을 지키기 위한 한계 문장(§29) */
  uncertainty?: string;
}

/* ================== Narrative 공통 구조 (v1.7 · §6) ================== */

/**
 * Task마다 서로 다른 임의 형태로 흩어지지 않도록 Narrative 결과의 공통 봉투를 둔다.
 *
 * ⚠️ `meta`가 **무엇을 보고 있는지에 대한 진실**이다. 화면은 `meta.mode`로만
 * 'AI 설명'과 '규칙 기반 대체'를 구분하고, 자기 나름대로 추측하지 않는다.
 */
export interface AiNarrativeMeta extends AiAnalysisMeta {
  /** 서버 requestId — QA·로그 대조용. 사용자에게 보여주지 않는다 */
  requestId?: string;
}

/** 모든 Narrative가 공유하는 최소 형태 — 근거 없는 강한 결론을 만들 수 없게 한다 */
export interface GroundedNarrative {
  explanation: string;
  evidenceRefs: EvidenceRef[];
  uncertainty?: string;
}

export interface CompatibilityNarrativeBundle {
  narratives: CompatibilityNarrative[];
  meta: AiNarrativeMeta;
}

export interface RelationshipNarrativeBundle {
  narratives: RelationshipNarrative[];
  core: CoreInsightNarrative | null;
  meta: AiNarrativeMeta;
}

export interface HistoryNarrativeBundle {
  narratives: HistoryNarrative[];
  meta: AiNarrativeMeta;
}

/**
 * 화면이 읽는 Narrative 상태.
 *
 * `unavailable`은 실패가 아니라 **'AI 설명 없이 규칙 결과만 보여주는 정상 상태'**다.
 * Core Result는 어느 상태에서도 렌더된다 — AI Narrative는 enhancement다(§15).
 */
export type AiNarrativeStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

export interface AiNarrativeState<T> {
  status: AiNarrativeStatus;
  data: T | null;
  /** 'unavailable'일 때만 값이 있다 */
  reason: AiFailureReason | null;
  mode: AiMode | null;
  /** 캐시된 실패를 지우고 같은 지문으로 다시 요청한다. Core Result는 이미 보이고 있으므로 재시도는 enhancement 재시도일 뿐이다 */
  retry: () => void;
}

/* ==================== Cross-source Insight Engine (v1.9) ==================== */

/**
 * ⚠️ 이 타입들은 **판정을 새로 만들지 않는다.** MATCH/GAP/CHANGE는 이미 있는 Mirror/History
 * 판정을 재표현한 것이고, CONTRADICTION은 그 위에 관찰(Observed) 근거가 같은 방향으로 겹칠 때만
 * 붙는 라벨이다(§4). REPEATED_SIGNAL도 이미 있는 `findRepeatedRelationshipSignals` 결과를
 * 옮긴 것이다. **새 계산이 아니라 기존 계산 결과들을 서로 연결해 보여주는 것**이 이 엔진의 역할이다.
 */
export type CrossSourceInsightType =
  | 'MATCH'
  | 'GAP'
  | 'CONTRADICTION'
  | 'CHANGE'
  | 'REPEATED_SIGNAL'
  | 'UNKNOWN';

/** 이 Insight가 어떤 데이터 Source들을 연결했는지. MBTI/Birth는 절대 들어오지 않는다(§18/§44) */
export type CrossSourceEvidenceSource =
  | 'observed'
  | 'declared'
  | 'relationship'
  /**
   * v1.41 §39.8 — 지금 관계 속의 나(S30). `relationship`(과거 경험)과 **다른
   * source로 센다** — 같은 축에 대해 서로 다른 시점에, 서로를 참조하지 않고 입력된
   * 두 답이므로 `hasDeepConnection`의 관점에서 실제로 독립적인 2종이다(§39.18).
   */
  | 'current_relationship'
  | 'target'
  | 'history'
  | 'adaptive'
  | 'deep_followup'
  | 'user_correction'
  /**
   * v1.26 P3-3 — **이미 계산된 동기화율 판정**(`CompatibilityDimension.tone`).
   *
   * v1.25까지 Cross-source Engine은 Compatibility를 입력으로 받지도 않았다. 그래서 사용자가
   * 무료에서 방금 읽은 '차이가 보이는 신호'가 Premium의 어떤 연결에도 등장하지 않았고,
   * Premium은 Mirror·History·Target만 이어 붙였다 — 정작 사용자가 걱정하는 축과 이어지지
   * 않은 것이다. 이 source가 그 빈 자리를 채운다.
   */
  | 'compatibility'
  /**
   * v1.26 P3-3 — MBTI 성향 렌즈. 무료(v1.24 Bridge)에서 이미 축 단위로 비교했으므로
   * Premium에서는 **4축 설명을 다시 출력하지 않고** 'DIFFERS로 나온 축이 관계 신호·과거
   * 경험과 같은 축을 가리키는가'만 연결에 쓴다.
   */
  | 'mbti_lens';

export type InsightStrength = 'strong' | 'medium' | 'weak';

export interface CrossSourceInsight {
  id: string;
  type: CrossSourceInsightType;
  axis?: MirrorAxisKey;
  /** 2개 이상이어야 '연결한' 것이다. 1개짜리는 이 엔진이 만들지 않는다 */
  sources: CrossSourceEvidenceSource[];
  evidenceRefs: EvidenceRef[];
  strength: InsightStrength;
  /** 왜 이 강도로 판정했는지 — QA/디버그용, 사용자에게 노출하지 않는다 */
  confidenceReason?: string;
  /**
   * **AI 없이도 항상 존재하는 규칙 기반 설명.** AI Narrative가 Quality Gate를 통과하지
   * 못하거나 아예 없을 때 화면에 그대로 쓰는 문장이다 — 이것이 §27의 Fallback이다.
   */
  ruleSummary: string;
  /** AI에게 설명을 맡길 만한 근거인지. weak인데 evidence가 1개뿐이면 false */
  eligibleForNarrative: boolean;
  relatedHistoryIds?: string[];
}

/* -------------------------------------- Deep Narrative (AI, v1.9 · §24) */

/**
 * AI는 headline/interpretation/situation/question **문장만** 쓴다.
 * type·axis·strength·evidenceRefs는 CrossSourceInsight에서 그대로 가져오고,
 * AI가 다른 evidenceRefs를 보내면 버린다(§26-E).
 */
export interface DeepNarrative {
  insightId: string;
  headline: string;
  interpretation: string;
  situation?: string;
  uncertainty?: string;
  conversationQuestion?: string;
  evidenceRefs: EvidenceRef[];
}

export interface DeepNarrativeBundle {
  narratives: DeepNarrative[];
  meta: AiNarrativeMeta;
}

/* --------------------------------- Adaptive Deep Question (v1.9 · §8~§11) */

export type DeepAnswerType = 'single' | 'multi' | 'scale' | 'text';

export interface DeepQuestionOption {
  id: string;
  label: string;
}

export interface DeepQuestion {
  id: string;
  /** 이 질문이 어떤 Insight에서 나왔는지 — 답변의 evidenceRef 근거가 된다 */
  insightId: string;
  axis: MirrorAxisKey;
  prompt: string;
  /** '아까 네가 말한 기준과 실제 경험에서 조금 다른 신호가 보여서 물어볼게' 같은 짧은 이유 */
  reason?: string;
  answerType: DeepAnswerType;
  options?: readonly DeepQuestionOption[];
  /** 선택지 + 직접 입력 구조일 때 true */
  allowCustomText?: boolean;
}

/**
 * v1.9 §11 — 기존 Adaptive Follow-up(`AdaptiveAnswer`, S16a)과 별도 모델이다.
 * 원래 답을 덮어쓰지 않고 **새 Evidence Source(`deep_followup`)로 추가한다.**
 */
export interface DeepAnalysisAnswer {
  questionId: string;
  insightId: string;
  axis?: MirrorAxisKey;
  answerType: DeepAnswerType;
  value: string | string[] | number;
  createdAt: string;
}

/** Deep Insight 카드에 대한 사용자 확인(§16/§33). 기존 Verdict 재사용 + 짧은 Correction */
export interface DeepInsightFeedback {
  verdict: Verdict;
  correctedText?: string;
}

/**
 * Deep Report UT 5문항 (v1.10 · §20). `SessionAnswers`에 넣지 않는다 — 이 응답이
 * Compatibility/Mirror/History 계산에 영향을 줄 수 없게 별도 저장소(`lym.ut.deep.v1`)에
 * `analysisId` 기준으로 저장한다.
 */
export interface DeepReportUtResponse {
  analysisId: string;
  /** '새롭게 알게 된 내용이 있었어?' 1~5 */
  newInsight?: number;
  /** '다른 사람에게도 비슷하게 나올 것 같아?' 1~5 — ⚠️ 낮을수록 개인화 인식이 높다는 뜻(역방향) */
  genericness?: number;
  /** '여러 정보를 연결해서 분석했다고 느꼈어?' 1~5 */
  crossSourceValue?: number;
  wtp?: 'yes' | 'maybe' | 'no';
  /** 최대 500자. Analytics로는 원문을 보내지 않고 로컬에만 남긴다(§36) */
  missingValue?: string;
  /**
   * v1.19 §10 Q1 — '무료 결과보다 더 깊게 이해하는 데 도움이 됐어?' 1~5.
   * 위 `newInsight`(UT_MODE 전용, '새로 알게 된 게 있었나')와 다른 질문이다 — 이건
   * **무료 대비 추가 가치**를 묻고 Production에서도 수집된다(§25).
   */
  valueRating?: number;
  /**
   * v1.19 §10 Q2 / §11 — 리포트를 **다 본 뒤**의 지불 의향.
   * 위 `wtp`(UT_MODE 5문항의 '다시 볼 의향')와도, Paywall의 `premium_purchase_intent`
   * (보기 **전** 기대)와도 섞지 않는다. 셋 다 실제 결제가 아니라 '의향'이다.
   */
  wtpAfterView?: 'yes' | 'maybe' | 'no';
  /**
   * v1.19 §13 — 사용자가 '다 봤어'를 누른 시각. 아래 `completedAt`(UT 5문항 완료)과 다르다 —
   * Production에는 UT 5문항이 없으므로 Completion Rate(§14 C)의 분자를 이 필드로 따로 잡는다.
   * 이 값이 있으면 `deep_report_complete`를 다시 발생시키지 않는다(새로고침 중복 방지).
   */
  reportCompletedAt?: string;
  completedAt?: string;
}

/* ---------------------------------- Relationship Deep Report (v1.9 · §13) */

export interface DeepReportInsightCard {
  insight: CrossSourceInsight;
  narrative: DeepNarrative | null;
}

export interface DeepSituation {
  id: string;
  axis: MirrorAxisKey;
  /** 상황 */
  situation: string;
  /** 나에게 나타날 수 있는 반응 */
  myReaction: string;
  /** 상대에게 나타날 수 있는 반응 — 반드시 '~할 수 있어' 톤 (§19) */
  theirPossibleReaction: string;
  /** 어디서 오해가 생길 수 있는지 */
  misunderstanding: string;
  /** 확인할 질문 */
  question: string;
}

export interface DeepConversationQuestion {
  question: ConversationQuestion;
  /** 이 질문을 왜 추천했는지 — 근거 연결 문장(§20) */
  why: string;
  /**
   * v1.40.1 — 이 질문을 **누구에게** 던지는가(`DeepAudience`).
   *
   * 지금 생성되는 연결 질문은 전부 `outward`다(설계상 '연결을 상대에게 검증하는 질문').
   * 그래서 `ended`·`none`에서는 이 목록이 비어 있고, 필드는 남은 항목이 실제로
   * outward인지 테스트가 **문장을 읽지 않고** 확인하기 위해 있다.
   */
  audience: DeepAudience;
}

export interface DeepFinalObservation {
  strongestSignalSummary: string;
  evidence: string[];
  unknown: string;
  nextTip: string;
}

export interface RelationshipDeepReportOverview {
  headline: string;
  subcopy: string;
  /** 최대 3개. Report Navigation 역할만 한다(§14) */
  topSummaries: string[];
}

/* ------------------- User-reported Scene (v1.46 · §10 · §12) */

/**
 * 리포트에 그려지는 **사용자가 알려준 장면 한 줄.**
 *
 * ⚠️ 세 필드의 경계가 이 기능의 전부다(§10):
 *
 * ```
 * FACT            사용자가 '연락 간격이 길어졌다'고 입력함        → fact
 * INTERPRETATION  사용자는 그 변화를 중요한 신호로 기억하고 있음   → interpretation
 * NOT FACT        상대가 마음이 식었다 / 밀당했다 / 호감을 숨겼다  → 어디에도 없다
 * ```
 *
 * `fact`는 사용자가 입력한 문장 **그대로**다. 다듬거나 요약하거나 상대의 의도로
 * 번역하지 않는다 — 그 순간 이 블록은 사용자의 기억이 아니라 서비스의 주장이 된다.
 */
export interface DeepReportedScene {
  /** `RelationshipEvent.id`. `{source:'user_reported_event'}` ref가 이 값을 가리킨다 */
  id: string;
  typeLabel: string;
  /** 사용자가 입력한 문장 그대로 */
  fact: string;
  /** 그때 나는 어떻게 반응했는가 — 사용자가 적지 않았으면 null */
  myReaction: string | null;
  /** 이 장면에 대해 **말할 수 있는 것까지**. 상대의 의도로 넘어가지 않는다 */
  interpretation: string;
}

/**
 * v1.46 §12 — Premium Deep Report의 **관계 맥락 블록.** 사건이 하나도 없으면 null이고,
 * 그때 이 섹션은 화면에 존재하지 않는다(빈 상태 카피를 만들지 않는다).
 *
 * ⚠️ **Chapter가 아니다.** `approachInsight`(v1.15)와 같은 위계의 보조 블록이고,
 * `chapters.length`·`available`·`omissions` 어디에도 세지 않는다. 이유도 같다 — 이건
 * 서로 독립적인 자료 2종을 이은 **연결**이 아니라 사용자가 알려준 맥락 그 자체다.
 * Chapter로 올리면 근거 2종 규칙을 만족하지 못한 것을 Chapter라고 부르게 된다(§8).
 */
export interface DeepReportedScenes {
  title: string;
  /** 러비 체크포인트 한 줄 (§12 우선순위 3) */
  lovyNote: string;
  /** 이 블록이 말할 수 없는 것. **항상 존재한다** */
  limitation: string;
  scenes: DeepReportedScene[];
}

/**
 * v1.15 §5 — Target Preference × Target Relationship Axis × User Relationship Style을
 * 연결한 Premium 전용 문장. 무료 Approach Hint(`ApproachHint`)를 대체하지 않는다 — 무료
 * 힌트는 항상 그대로 보이고, 이건 거기에 사용자 자신의 축까지 한 겹 더 연결했을 때만 만든다.
 * 조건이 안 맞으면(연결할 게 없으면) null이다 — 억지로 만들지 않는다.
 */
export interface DeepApproachInsight {
  title: string;
  text: string;
}

/* ------------------------- Premium Connection Architecture (v1.26 · P3-3) */

/**
 * 하나의 **연결**. Premium이 파는 것은 이것 하나다.
 *
 * ⚠️ 무료와의 차이는 분량이 아니라 층수다:
 *   FREE     한 Signal을 깊게 이해한다 (무엇이 보이는가)
 *   PREMIUM  서로 다른 Signal 사이의 연결을 이해한다 (왜 함께 나타나는가)
 *
 * ⚠️ **인과가 아니라 연관이다.** `interpretation`은 늘 '같은 축을 가리킨다' /
 * '같은 방향으로 보인다'까지만 말하고, 'A 때문에 B'로 넘어가지 않는다.
 * 그래서 모든 연결은 `limitation`을 하나 갖는다 — 없으면 만들지 않는다.
 */
export interface DeepConnection {
  id: string;
  axis: MirrorAxisKey | null;
  /** 이 연결이 몇 종의 source를 이었는지. 1이면 연결이 아니라 단일 관찰이다 */
  sourceCount: number;
  /** 화면에 작은 metadata로만 보여주는 출처 라벨들. badge 남발 금지 */
  sourceLabels: string[];
  /** 규칙이 만든 연결 요약. AI가 이 문장을 바꾸지 못한다 */
  ruleSummary: string;
  /**
   * AI가 붙인 맥락 설명. 없으면(실패·미연결) `ruleSummary`만으로 완결된다 —
   * **AI가 없어도 리포트가 사라지지 않는다.**
   */
  narrativeText: string | null;
  /** 이 연결이 말할 수 없는 것. 항상 존재한다 */
  limitation: string;
  /** 근거 — 저장된 label/summary 기반. 자유서술 원문을 그대로 노출하지 않는다 */
  /**
   * ⚠️ v1.30 — `key`를 함께 들고 다닌다.
   *
   * 예전에는 `{ sourceLabel, text }`만 남겨서 `resolveEvidenceRefs`가 만든 canonical
   * 식별자를 버렸다. 그래서 화면이 React key로 쓸 수 있는 게 **문장뿐**이었고,
   * 서로 다른 근거 두 개가 같은 문장으로 풀리면 duplicate key 경고가 났다.
   *
   * 실제로 그런 조합이 있다 — `declared:contact`와 `declared:contactImportance`는
   * key가 달라 dedup에서 살아남지만 **문장은 완전히 같다.** 같은 날 저장된 History
   * 기록 두 건도 날짜 접두어까지 같아진다.
   *
   * key는 `source:id:axis` 형태라 stable·unique하고 **자유서술을 담지 않는다**
   * (React key에 사용자 원문·생년월일·MBTI·사진 내용을 넣지 않는다).
   */
  evidence: { key: string; sourceLabel: string; text: string }[];
}

/**
 * 첫 viewport에서 ₩1,900의 값을 즉시 체감시키는 블록.
 * '무료 결과 다시 보기'처럼 보이면 실패이므로, **연결된 정보 종류 수**와
 * **가장 중요한 연결 하나**를 먼저 보여준다.
 */
export interface DeepCorePattern {
  connection: DeepConnection;
  /** 이 리포트가 이은 서로 다른 정보 종류 수 */
  connectedSourceCount: number;
  /** source가 2개 이상인 연결 수 */
  connectionCount: number;
}

/**
 * 처방이 아니다 — 확인해볼 것만 준다(§33)
 *
 * v1.40.1 — `REFLECT`를 추가했다. `JOB_ACTION_KINDS`(`RelationshipActionKind`)에는
 * v1.40부터 `reflect`가 있었는데 Deep Report의 종류에는 없어서, `ended`에서 허용되는
 * 유일한 행동 두 개(`reflect`·`notice`) 중 하나를 **유료 리포트가 표현할 수 없었다.**
 * 그래서 `ended`에서도 `TRY`/`CHECK`가 나왔다(§38.2).
 */
export type DeepActionKind = 'TRY' | 'CHECK' | 'NOTICE' | 'REFLECT';

/**
 * 이 행동·질문이 **누구를 향하는가** (v1.40.1 · §38.2)
 *
 * ⚠️ **이 필드가 v1.40.1의 핵심이다.** v1.40의 Ended Safety는 금지 어휘 목록으로
 * 검증됐는데, 실제로 새어 나간 문장들은 금지 어휘를 하나도 쓰지 않았다:
 *
 * ```
 * 서로 원하는 기준을 한 번 이야기해보기       ← '다가가'·'고백' 없음. 그런데 outward다
 * 각자 어떤 의미로 받아들이는지 확인해보기     ← 같음
 * 연락이 줄었을 때, 너한테는 … 어떻게 달라?    ← 상대에게 던지는 질문인데 어휘는 무해하다
 * ```
 *
 * 어휘가 아니라 **행동의 대상**이 문제였으므로, 대상을 문장에서 추론하지 않고
 * 생성 시점에 구조로 못박는다. 그래야 테스트가 문장을 읽지 않고 셀 수 있다.
 *
 * `outward` 상대를 향한다 (물어보기·같이 해보기·맞춰보기)
 * `self`    주어가 나다 (돌아보기·알아두기·내 기록에서 확인하기)
 */
export type DeepAudience = 'outward' | 'self';

export interface DeepAction {
  kind: DeepActionKind;
  text: string;
  /** v1.40.1 — 이 행동이 상대를 향하는가. `ended`·`none`에서는 `self`만 나온다 */
  audience: DeepAudience;
}

/**
 * 러비의 깊은 관찰 + 관계 철학 질문 하나.
 * 무료 Observation보다 한 단계 깊지만, **실제 연결 데이터에서만** 나온다 —
 * 뜬금없는 명언을 붙이지 않는다.
 */
export interface DeepLovyObservation {
  /** 연결을 보고 러비가 떠올린 관찰 */
  observation: string;
  /** 그 관찰에서 이어지는 관계 철학 질문 */
  question: string;
}

/**
 * Premium의 핵심 상품. **새 점수를 만들지 않는다** — Compatibility/Mirror/History는
 * 이미 계산된 결과를 그대로 조합한다(§17 compatibilityDeepDive, §21 historyDeep이
 * `PremiumDetailReport`를 그대로 재사용하는 이유다).
 */
export interface RelationshipDeepReport {
  available: boolean;
  overview: RelationshipDeepReportOverview;
  /*
   * v1.26 P3-3에서 제거한 필드 5개
   *   relationshipSelf / crossSourceInsights → corePattern · connections · singleSourceNotes
   *   compatibilityDeepDive → 삭제. 무료 evidence/scene을 그대로 다시 보여주고 있었다
   *     (`buildCompatibilityDetail`은 standalone `compatibility_detail` 상세에서 계속 쓴다)
   *   situations → 삭제. 무료 `scene.watch`를 글자 그대로 재출력했다
   *   conversationQuestions → connectionQuestions (무료 질문 반복 대신 연결 검증 질문)
   */
  /** §21 — 기존 buildHistoryDetail() 재사용. History Entry < 2면 null(섹션 숨김) */
  historyDeep: PremiumDetailReport | null;
  /*
   * v1.26 P3-3에서 제거: finalObservation
   *   맨 위 corePattern의 문장을 리포트 맨 아래에 다시 적고 있었다.
   *   마무리는 lovyObservation이 맡는다.
   */
  /** v1.15 §5 — Target Preference를 사용자 자신의 축과 연결한 Premium 전용 통찰. 없으면 null */
  approachInsight: DeepApproachInsight | null;
  /**
   * v1.46 §12 — 사용자가 알려준 관계 사건을 **그대로 되짚는** 맥락 블록. 사건이
   * 없으면 null이다.
   *
   * ⚠️ `available`·`chapters`·`omissions`에 영향을 주지 않는다. 사건만 있고 연결이
   * 하나도 없는 세션은 여전히 `available: false`다 — 사건은 연결의 대체물이 아니다.
   */
  /**
   * v1.46 PremiumLens §2 — **같은 결제로 함께 열리는 관계 렌즈 3종.**
   *
   * ⚠️ `available`에 영향을 주지 않는다. 리포트가 열리는 조건은 여전히
   * `builtChapters.some(isContentChapter)` 하나다 — MBTI만 있고 연결이 하나도
   * 없는 세션이 Lens 때문에 열리면, 사용자는 정밀 관찰 리포트를 사고 렌즈만
   * 받는다. 렌즈는 리포트의 대체물이 아니라 동봉물이다.
   *
   * ⚠️ 이 값은 Compatibility score·Mirror state·History 판정 어디에도 들어가지
   * 않는다(§45). 그 사실을 LENS-11/LENS-12가 정적으로 고정한다.
   */
  lensBundle: PremiumLensBundle;
  reportedScenes: DeepReportedScenes | null;
  /**
   * v1.26 P3-3 — 첫 viewport용. 연결이 하나도 없으면 null이고, 그때는 리포트가
   * 억지로 만들어지지 않는다(`available: false`).
   */
  corePattern: DeepCorePattern | null;
  /** v1.26 — source 2개 이상인 나머지 연결. corePattern은 제외 */
  connections: DeepConnection[];
  /**
   * v1.26 — source가 1개뿐인 관찰. 연결이 아니므로 **연결 섹션과 섞지 않고**
   * 더 낮은 위계로 따로 둔다(cross-source 우선 §17).
   */
  singleSourceNotes: DeepConnection[];
  /** v1.26 §33 — TRY / CHECK / NOTICE / REFLECT. 처방이 아니다 */
  actions: DeepAction[];
  /**
   * v1.26 §32 — Premium 전용 질문. **무료 질문을 반복하지 않는다** —
   * cross-source 연결을 상대에게 검증하는 질문이다.
   *
   * v1.40.1 — 그래서 `ended`·`none`에서는 **빈 배열**이다(§38.2). 회고 질문으로
   * 바꿔 채우지 않는다: 무료 화면이 이미 `REFLECTION_QUESTIONS`로 같은 역할을 하고 있어
   * 유료에서 또 주면 §22(같은 역할을 두 번 보여주지 않는다)를 어기고, §37.13이 금지한
   * 반추 루프가 된다.
   */
  connectionQuestions: DeepConversationQuestion[];
  /**
   * v1.40.1 — `05` 행동·질문 섹션의 제목. `STAGE_JOB_COPY[job].nowWhatTitle`을 그대로
   * 쓴다(§38.2).
   *
   * ⚠️ 새 copy source를 만들지 않았다. v1.40까지 이 자리는 화면에 하드코딩된
   * `그래서 무엇을 확인할까` 하나였고, 무료 화면이 같은 자리를 Job별로 갈라 쓰는 동안
   * 유료 리포트만 `ended` 사용자에게 `확인할까`라고 말했다.
   */
  actionSectionTitle: string;
  /** v1.26 §25/§26 — 러비의 깊은 관찰 + 철학 질문. 연결이 없으면 null */
  lovyObservation: DeepLovyObservation | null;
  /** 이 리포트가 못 하는 것 — 항상 사용자에게 보여준다 */
  limitations: string[];
  /**
   * v1.45 — **이 리포트의 렌더 단위.** 화면은 이 배열만 그린다.
   *
   * v1.44까지 화면은 `corePattern` + `connections` + `singleSourceNotes`를 **평면 목록**
   * 으로 그렸다. 실측(고데이터 세션)에서 12개 유닛이 제목 없이 나열됐고 같은 축이
   * 최대 4번 반복됐다 — 리포트가 아니라 카드 더미였다. Chapter는 같은 주제의 Insight를
   * 하나로 묶어 그 반복을 없앤다(`logic/premiumChapters.ts`).
   *
   * ⚠️ **Chapter는 판정을 만들지 않는다.** 이미 만들어진 Insight를 고르고 묶을 뿐이고,
   * 근거가 없으면 Chapter도 없다 — 분량을 위해 빈 Chapter를 만들지 않는다.
   */
  chapters: PremiumChapter[];
  /**
   * v1.45 — **아직 만들지 않은 연결.** Chapter 수에 포함하지 않는다.
   *
   * Sparse 세션에서 근거 없는 Chapter를 만드는 대신 무엇이 부족한지 정직하게 적는다.
   * locked teaser가 아니다 — 유료 결제로 열리는 것이 아니라 **데이터가 쌓이면** 열린다.
   */
  omissions: PremiumOmission[];
  /**
   * v1.45 — 이 리포트가 **현재 관계**를 보고 있는지 **끝난 관계**를 보고 있는지.
   *
   * ⚠️ 새 판정이 아니다. `deepReportJobContext(job).tense`가 이미 정한 값을 리포트에
   * 그대로 실어 두는 것이고, 화면이 시제를 **다시 계산하지 않게** 하기 위한 자리다.
   * 이 값이 없던 동안 화면은 시제를 알 수 없었고, 그래서 러비 한마디 같은 표현
   * 문구를 `ended` 안전 카피로 바꿀 방법이 없었다(§18).
   */
  tense: RelationshipTense;
  /**
   * v1.45 PostReview — 이 리포트가 **상대를 향한 행동을 제안할 수 있는가**.
   *
   * ⚠️ 새 판정이 아니다. `deepReportJobContext(job).allowsOutwardAction`이 이미 정한
   * 값을 그대로 실어 두는 것이고, 화면이 Job을 다시 해석하지 않게 하기 위한 자리다.
   *
   * ⚠️ **`tense`로 대체할 수 없다.** `job=none`(상대 없음)은 `tense: 'current'`인데도
   * outward 제안이 금지된다 — 시제와 행동 허용은 서로 다른 축이다. 러비의 체크포인트가
   * '상대와 맞춰봐' 문장을 붙일지 결정할 때 이 값을 본다.
   */
  allowsOutwardAction: boolean;
}

/**
 * 관계를 **어느 시제로 부를 것인가** (v1.42 §41.4)
 *
 * ```
 * current   진행 중인 관계 (job != ended)   "지금 이 관계에서"
 * former    끝난 관계 (job=ended)           "그때 이 관계에서"
 * ```
 *
 * ⚠️ v1.45 — 정의가 `lib/logic/relationshipEvidence.ts`에 있었는데, 이 파일의
 * `RelationshipDeepReport.tense`가 그 값을 담게 되면서 여기로 옮겼다. `types`는
 * import가 하나도 없는 최하위 계층이라, 반대 방향(types → lib)으로 참조하면 순환이
 * 된다. `relationshipEvidence`는 이 이름을 **그대로 re-export**하므로 기존 20개
 * 파일의 import 경로는 하나도 바뀌지 않는다.
 *
 * ⚠️ `RelationshipJob`(6종)을 시제로 쓰지 않는 이유는 그쪽 주석에 그대로 있다 —
 * 문장 생성에 필요한 구분은 둘뿐이고, Job을 넘기면 문장 파일이 Job별 분기를 갖는다.
 */
export type RelationshipTense = 'current' | 'former';

/* ---------------------------------------- Premium Deep Report v2 (v1.45) */

/**
 * 근거의 **출처 묶음.** `CrossSourceEvidenceSource`(11종)를 사용자가 구분할 수 있는
 * 단위로 좁힌 것이다.
 *
 * ⚠️ 새 판정이 아니다. Chapter가 "서로 독립적인 자료 2개 이상을 이었는가"를 셀 때
 * 같은 곳을 두 번 세지 않기 위한 것뿐이다 — `declared`와 `adaptive`는 둘 다
 * '내가 답한 기준'이므로 두 종류로 세면 안 된다.
 */
export type PremiumSourceGroup =
  | 'declared_me'
  | 'observed_me'
  | 'past_relationship'
  | 'current_relationship'
  | 'target'
  | 'compatibility'
  | 'history'
  /**
   * ⚠️ MBTI는 **동기화율에 들어가지 않는다**(v1.2에서 5번째 축으로 넣었다가 철회했다).
   * 그래서 `observed_me`에 합치지 않고 별도 그룹으로 둔다 — 합치면 '관찰된 나'의
   * 근거 수가 성향 렌즈 때문에 부풀어 보인다.
   */
  | 'lens';

/**
 * Chapter의 종류. **화면 순서가 아니라 정체성**이다(순서는 `index`가 갖는다).
 *
 * ⚠️ 이 목록을 늘려서 리포트를 길게 만들지 않는다. 각 종류는 서로 다른 **근거 조합**을
 * 요구하고, 그 조합이 없으면 그 Chapter는 생성되지 않는다.
 */
export type PremiumChapterKind =
  /** 말한 기준 × 관계에서 나타난 신호 */
  | 'declared_vs_shown'
  /** 과거에 가장 힘들었던/중요했던 지점 × 말한 기준 */
  | 'hidden_priority'
  /** 가까워지는 방식 × 거리를 두는 방식 (두 축) */
  | 'closeness_distance'
  /** 갈등 축 */
  | 'conflict_needs'
  /** 애정 표현 축 */
  | 'affection_exchange'
  /** 상대 정보·동기화율과 이어지는 지점 */
  | 'tune_with_target'
  /** 아직 확신하면 안 되는 지점 — 서비스가 모르는 것 */
  | 'uncertainty'
  /** 앞 Chapter에서 파생된 행동·질문 */
  | 'next_check'
  /** 두 시점 비교 (History 또는 지금 × 이전) */
  | 'past_and_now'
  /** 앞 Chapter를 압축한 마무리 */
  | 'closing'
  /* ── Self-only 계열 (v1.45 PostReview §2) ─────────────────────────────
     ⚠️ 관계 경험도 상대도 없는 사용자를 위한 것이다. cross-source 연결이 아니라
     **cross-axis synthesis**다 — 따로 답한 기준 여러 개를 한 프로필로 묶는다.
     그래서 '관계에서 ~했다'가 아니라 '지금 답에서는 ~을 중요하게 보고 있어'까지만
     말한다(§2-3). */
  /** 내가 관계에서 중요하다고 말한 기준들을 한 프로필로 */
  | 'self_profile'
  /** 동시에 중요하다고 답해서 서로 당길 수 있는 기준 조합 */
  | 'self_tension';

/** Chapter 하나가 보여주는 근거 한 줄 */
export interface PremiumChapterEvidence {
  key: string;
  sourceLabel: string;
  text: string;
}

/**
 * Premium Deep Report의 **한 챕터** (v1.45)
 *
 * ⚠️ **AI 결과를 source of truth로 쓰지 않는다.** 존재 여부·제목·근거·순서는 전부
 * 결정론이고, AI가 채우는 것은 `narrativeText` 하나뿐이다. 그 값이 null이어도
 * `deterministicSummary` · `deterministicTakeaway` · `evidence` · `limitation`으로
 * 챕터가 완결된다(§11.3 AI Failure).
 */
export interface PremiumChapter {
  id: string;
  kind: PremiumChapterKind;
  /** 1-based 렌더 순서. 화면의 `02 / 8` 표시가 이 값을 쓴다 */
  index: number;
  title: string;
  /** 제목 위 짧은 라벨 — 이 챕터가 다루는 축/주제 */
  eyebrow: string;
  /** 이 챕터가 근거로 삼은 결정론 Insight id. AI 문장을 붙일 때도 이 목록으로만 붙인다 */
  insightIds: string[];
  sourceGroups: PremiumSourceGroup[];
  evidence: PremiumChapterEvidence[];
  /** AI 없이도 항상 존재하는 본문 */
  deterministicSummary: string;
  /** 이 챕터의 핵심 문장 하나 (§12.3 highlight) */
  deterministicTakeaway: string;
  /**
   * AI가 붙인 해석. **없으면 그냥 없다** — 챕터가 사라지지 않는다.
   * ⚠️ 이 챕터의 `insightIds`에 속한 narrative만 들어온다(다른 챕터 근거 유입 불가).
   */
  narrativeText: string | null;
  /** 확인해볼 질문. Job이 허용하지 않으면 null */
  question: string | null;
  /** 이 챕터가 말할 수 없는 것. 항상 존재한다 */
  limitation: string;
  /** 이 챕터가 누구를 향하는가 — `outward`는 상대를 향한 것이 하나라도 있을 때만 */
  audience: 'self' | 'outward';
  /**
   * FREE 중복 방지용 결정론 키. `kind:axes:sourceGroups` — 같은 키가 두 번 나오면
   * 두 번째는 만들지 않는다.
   */
  noveltyKey: string;
}

/**
 * 이번 관찰에서 **만들지 않은 연결** (§14.1)
 *
 * ⚠️ Chapter 수에 포함하지 않는다. 그리고 '결제하면 열린다'가 아니다 —
 * 어떤 데이터가 더 쌓여야 하는지를 결정론으로 적는다.
 */
export interface PremiumOmission {
  id: string;
  text: string;
}

/* ============ Premium Relationship Lens (v1.46 PremiumLens · §2~§20) ======= */

/**
 * ══ Premium Bundle의 두 번째 절반 ══════════════════════════════════════════
 *
 * ₩1,900은 기능 하나가 아니라 **묶음 하나**의 가격이다(§2):
 *
 * ```
 * ① 정밀 관찰 리포트   RelationshipDeepReport   ← Core Value
 * ② MBTI 관계 렌즈  ┐
 * ③ 사주 관계 렌즈  ├ PremiumLensBundle        ← 보조 해석 프레임
 * ④ 별자리 관계 렌즈 ┘
 * ```
 *
 * ⚠️ **Lens는 Core를 대체하지 않는다**(§3). 정밀 관찰 리포트는 사용자가 실제로
 * 입력한 근거를 연결한 결과이고, Lens는 **같은 관계를 다른 프레임으로 다시
 * 생각해보게 하는 장치**다. 그래서 화면에서 Lens가 리포트보다 위에 오지 않고
 * (§36), 어떤 Lens 결과도 판정·점수에 들어가지 않는다(§45).
 *
 * ⚠️ **Lens 결과는 Evidence가 아니다**(§20). 세 렌즈가 같은 말을 해도 그것은
 * '독립적인 근거 3개'가 아니라 '서로 다른 해석 프레임에서 반복된 테마'다.
 */

export type PremiumLensKind = 'mbti' | 'saju' | 'zodiac';

/**
 * Lens 하나의 가용 상태. **렌즈마다 독립적으로 판정한다**(§6).
 *
 * `Target 있음`이 곧 `pair`가 아니다 — 상대가 있어도 그 렌즈의 상대 데이터가
 * 없으면 `self`다. 예: 상대 정보는 있는데 상대 MBTI를 모르면 MBTI는 `self`,
 * 상대 생년월일은 알면 별자리는 `pair`가 된다. 세 렌즈가 서로 다른 mode를
 * 갖는 상태가 **정상**이다.
 */
export type PremiumLensMode = 'pair' | 'self' | 'unavailable';

/**
 * `self`로 내려간 **이유** (v1.46.1)
 *
 * ══ 상대가 있다 ≠ 이 렌즈의 상대 데이터가 있다 ═══════════════════════════
 *
 * 두 상태는 결과가 똑같이 `self`지만 **사용자에게 할 말이 다르다.**
 *
 * ```
 * no_target            대상 자체가 없다        '상대가 생기면 둘을 나란히 볼 수 있어'
 * target_data_missing  대상은 있는데 모른다    '상대는 있지만 MBTI는 아직 모르네'
 * ```
 *
 * ⚠️ 사용자가 이미 '상대가 있다'고 입력했는데 화면이 `상대가 없어서`라고 말하면,
 * 그건 방금 자기가 입력한 것을 제품이 못 봤다는 뜻으로 읽힌다. mode 하나로는 그
 * 구분이 안 되므로 이유를 따로 들고 다닌다 — AI context에도 이 값이 간다(그러지
 * 않으면 모델이 '상대가 아직 없으니'로 쓴다).
 */
export type PremiumLensSelfReason = 'no_target' | 'target_data_missing';

/**
 * 여러 렌즈에 걸쳐 반복될 수 있는 **관계 테마.**
 *
 * ⚠️ 새 판정 축이 아니다. Cross-Lens(§19)가 "서로 다른 프레임에서 같은 주제가
 * 반복됐는가"를 세려면 비교 가능한 이름이 필요한데, 각 렌즈가 자기 문장으로만
 * 말하면 셀 수가 없다. 그래서 **닫힌 목록**을 둔다.
 *
 * ⚠️ 각 렌즈는 **자기 데이터가 실제로 말하는 테마만** 낸다. 억지로 6개를 다
 * 채우지 않는다 — 그러면 모든 렌즈가 모든 테마를 갖게 되어 '반복'이 무의미해진다.
 */
export type PremiumLensTheme =
  | 'pace'
  | 'alone_time'
  | 'expression'
  | 'planning'
  | 'closeness'
  | 'standard';

/**
 * '왜 이렇게 봤어?'에 들어가는 한 줄 (§30).
 *
 * ⚠️ 내부 debug JSON을 노출하지 않는다 — 사람이 읽는 라벨과 값만 담는다.
 */
export interface PremiumLensBasisRow {
  label: string;
  value: string;
}

export interface PremiumLensSectionUnit {
  /** `mbti_rhythm` 처럼 렌즈별로 고유. 화면 key이자 중복 검사 단위다 */
  id: string;
  title: string;
  body: string;
  /**
   * 이 섹션이 **사용자가 알려준 장면**을 근거로 쓸 때만 채워진다(§46).
   *
   * ⚠️ 값이 있으면 화면은 반드시 `네가 알려준 장면` 출처를 함께 그린다. AI가 아닌
   * 결정론 생성기가 채우므로, 여기 들어가는 id는 항상 실제 `RelationshipEvent.id`다.
   */
  reportedEventId?: string;
  /**
   * 화면에 그대로 그리는 인용 문장. `reportedEventId`가 있으면 항상 같이 있다.
   *
   * ⚠️ 화면이 사건 문장을 조립하지 않게 하기 위해 여기에 넣는다. 사용자 원문을
   * 다루는 문장이 두 곳에서 만들어지면 한쪽이 `네가 알려준 장면` 출처를 빼먹을 수 있고,
   * 그 순간 사용자 보고가 마치 관찰 결과처럼 읽힐다(§46).
   */
  reportedEventLine?: string;
}

/** 결과가 만들어진 Lens */
export interface PremiumLensReport {
  kind: PremiumLensKind;
  /** `MBTI 관계 렌즈` */
  label: string;
  mode: 'pair' | 'self';
  /** `self`일 때만 있다. 왜 pair가 아닌지 — 카피와 AI context가 이 값으로 갈린다 */
  selfReason?: PremiumLensSelfReason;
  headline: string;
  overview: string;
  /** §29 — pair는 4개 이상, self는 4개 이상(자기 3 + 불확실성 1) */
  sections: PremiumLensSectionUnit[];
  /** §29 — 항상 1개. 실제로 해볼 수 있는 동사가 들어간다(VALUE-06) */
  checkpoint: string;
  /** §30 — 접힘 영역 */
  basis: PremiumLensBasisRow[];
  /** 이 렌즈가 못 하는 것. 항상 1개 이상 */
  limitations: string[];
  /** §31 — 짧게 한 줄. 경고문처럼 만들지 않는다 */
  disclaimer: string;
  /** §19 — Cross-Lens가 세는 테마 */
  themes: PremiumLensTheme[];
}

/** 만들 수 없는 Lens — 이유를 그대로 보여준다(§29 정직한 제한) */
/**
 * `unavailable`을 **풀 수 있는 방법** (v1.46.3)
 *
 * 이유 문장(`reason`)은 사람에게 하는 말이고, 이 값은 화면이 **어디로 보낼지**를
 * 정하는 근거다. 화면이 문구를 읽어 목적지를 추측하면(‘생년월일’이라는 단어가
 * 들어 있으면 출생정보로) 문구를 고칠 때마다 이동이 조용히 깨진다.
 */
export type PremiumLensFix = 'birth' | 'mbti';

export interface PremiumLensUnavailable {
  kind: PremiumLensKind;
  label: string;
  mode: 'unavailable';
  /** 무엇이 있으면 볼 수 있는지까지 말한다 */
  reason: string;
  /** 그 값을 채우러 갈 곳 */
  fix: PremiumLensFix;
}

export type PremiumLensEntry = PremiumLensReport | PremiumLensUnavailable;

/**
 * §18~§20 — 두 개 이상의 Lens가 있을 때만 만들어진다.
 *
 * ⚠️ `repeatedThemes`를 '근거가 일치했다'로 표현하지 않는다(§20). 그래서 이
 * 타입에는 `note`가 **필수**다 — 화면이 주의 문구를 빼먹을 수 없게 데이터에
 * 넣었다.
 */
export interface PremiumCrossLens {
  /** 몇 개 렌즈를 겹쳤는지 (2 또는 3) */
  lensCount: number;
  /** A. 서로 다른 프레임에서 반복된 테마 */
  repeatedThemes: string[];
  /** B. 렌즈마다 다르게 말하는 부분 — 이것도 가치다 */
  differences: string[];
  /** C. 실제 관계에서 확인할 것 2~3개 */
  verificationQuestions: string[];
  /** ⚠️ 필수. '3개 근거'가 아니라는 사실을 말한다 */
  note: string;
}

export interface PremiumLensBundle {
  /** 항상 3개 · mbti → saju → zodiac 순. `unavailable`도 자리를 지킨다 */
  lenses: PremiumLensEntry[];
  /** 결과가 만들어진 렌즈 수 (0~3) */
  availableCount: number;
  crossLens: PremiumCrossLens | null;
}

/* ------------- Premium Lens AI Narrative (v1.46 AI Lens · §3~§32) --------- */

/**
 * ══ 결정론 결과 **위에** 얹는다 ═══════════════════════════════════════════
 *
 * ```
 * 계산 / 타입 판정      deterministic   PremiumLensReport      ← 이미 있다
 * 관계 해석             AI              PremiumLensNarrative   ← 여기
 * 최종 판단             사용자
 * ```
 *
 * ⚠️ **AI가 실패해도 렌즈는 그대로 보인다**(§32). 그래서 이 타입은 `PremiumLensReport`
 * 안이 아니라 **밖에** 있다 — 리포트 조립(`buildPremiumLensBundle`)은 AI를 기다리지
 * 않고, 화면이 나중에 도착한 narrative를 같은 카드 안에 덧붙인다.
 *
 * ⚠️ **AI가 판정을 바꾸지 않는다**(§7). mode(pair/self) · themes · basis · limitations는
 * 전부 결정론 엔진의 값이고 AI 응답에는 그 필드가 아예 없다. AI가 만들 수 있는 것은
 * 문장뿐이다.
 */
export interface PremiumLensNarrativeUnit {
  /**
   * `mbti_pair_rhythm` 처럼 **닫힌 목록**에서만 온다(`data/premiumLensAi.ts`).
   *
   * ⚠️ v1.42 §41.14가 남긴 규칙이다 — 모델이 식별자를 자유롭게 짓게 두면 파서가
   * 걸러 항목이 전멸하거나(그때는 한국어 label이었다) 화면 key가 충돌한다. 허용값을
   * 프롬프트에 명시하고 파서가 같은 상수를 쓴다.
   */
  id: string;
  title: string;
  body: string;
}

export interface PremiumLensNarrative {
  kind: PremiumLensKind;
  mode: 'pair' | 'self';
  /** 한 문단. 이 렌즈를 관계 맥락에서 어떻게 읽는지 */
  summary: string;
  /** §27 — 4~6개. 개수를 채우려고 만들지 않는다(§27 filler 금지) */
  units: PremiumLensNarrativeUnit[];
  /** §9-6 러비의 체크포인트. 없을 수 있다 */
  checkpoint?: string;
  /**
   * §21 — Cross-Lens 호출에 넘기는 **한 줄 요약.**
   *
   * ⚠️ 화면에 그리지 않는다. Cross-Lens에 각 렌즈의 긴 body를 그대로 다시 넣지 않기
   * 위한 필드이고(§21 토큰 절약), 그래서 짧다.
   */
  crossTheme?: string;
}

export interface PremiumLensNarrativeBundle {
  narrative: PremiumLensNarrative | null;
  meta: AiNarrativeMeta;
}

/**
 * §22 — 단순 요약이 아니다. 세 가지를 찾는다:
 * 반복된 테마 / 렌즈마다 다르게 읽히는 지점 / 실제 관계에서 확인할 질문.
 *
 * ⚠️ 결정론 `PremiumCrossLens`와 **필드 이름이 비슷하지만 다른 타입**이다. 결정론
 * 쪽은 테마 코드를 세어 만든 것이고 이쪽은 AI 문장이다. 화면은 둘을 같은 카드 안에
 * 위아래로 놓되 어느 쪽이 무엇인지 라벨로 구분한다(§30).
 */
export interface CrossLensNarrative {
  /** §25 — 2~3개 */
  repeatedThemes: string[];
  /** §25 — 1~2개. '어느 쪽이 맞다'로 결론내지 않는다(§24) */
  differences: string[];
  /** §25 — 2~3개 */
  verificationQuestions: string[];
  /** §25 — 러비 한 문장 요약 */
  closing?: string;
}

export interface CrossLensNarrativeBundle {
  narrative: CrossLensNarrative | null;
  meta: AiNarrativeMeta;
}

/* ------------------------------------------ Premium (v1.5, Fake Door) */

/**
 * Premium은 무료 결과를 잘라내는 기능이 **아니다.**
 * 무료에서도 동기화율 · 대표 Good/Friction Signal · Relationship Mirror · Core Insight까지
 * 핵심 가치가 완성돼야 하고, Premium은 '더 깊게 보고 싶은 사용자'에게 추가 해상도를 준다.
 *
 * ⚠️ v1.5는 실제 결제를 붙이지 않는다(Fake Door). 구매 시도 직후 '준비 중'을 명확히 알린다.
 * ⚠️ Premium에서도 **수집하지 않은 데이터를 새로 추론하지 않는다.** 새 점수를 만들지 않는다.
 */
export type ResultLevel = 'summary' | 'detail';

export type PremiumFeatureId =
  | 'compatibility_detail'
  | 'mirror_detail'
  | 'history_detail'
  | 'mbti_detail'
  | 'astrology_detail'
  | 'saju_detail'
  /**
   * v1.9 — Premium의 새 핵심 상품. compatibility_detail/mirror_detail/history_detail이
   * 각자 만들던 개별 상세를 하나의 리포트로 통합한다(§12). 그 세 파일이 만든 계산 결과는
   * 이 리포트 안에서 그대로 재사용한다 — 점수·판정을 다시 계산하지 않는다.
   */
  | 'relationship_deep_report';

/** Premium 진입 지점 — 무엇에 돈을 내고 싶어하는지 판단하는 핵심 데이터(§31) */
export type PremiumSource =
  | 'compatibility'
  | 'mirror'
  | 'history'
  /**
   * v1.29 P4 — First Contact Report에서 들어온 진입. 같은 flagship
   * `relationship_deep_report`로 모이지만, **어디서 지불 의향이 생겼는지**는
   * 구분해서 봐야 한다 — Solo는 별도 secondary funnel이다(§53).
   */
  | 'first_contact'
  | 'mbti'
  | 'astrology'
  | 'saju'
  | 'preview';

export type PremiumFeatureStatus =
  /** 실제 결제·제공이 가능한 상태 (v1.5에는 없음) */
  | 'available'
  /** 가치 안내 → 구매 시도 → '준비 중' 안내까지만 (v1.5 기본) */
  | 'fake-door'
  /** 상세 결과를 만들 근거가 없어 Paywall 자체를 띄우지 않는다 (예: 사주 엔진 미연결) */
  | 'unavailable';

export interface PremiumFeature {
  id: PremiumFeatureId;
  source: PremiumSource;
  title: string;
  description: string;
  /** 상세에서 추가로 보게 되는 것 — 사용자가 무엇을 사는지 모르면 CTA 클릭도 의미가 없다 */
  additions: readonly string[];
  price: number | null;
  status: PremiumFeatureStatus;
  /** unavailable일 때 이유를 사용자에게 그대로 보여준다 */
  unavailableReason?: string;
}

export interface PremiumAvailability {
  available: boolean;
  reason?: string;
}

/**
 * 결제 의향 기록. SessionAnswers(분석 입력)와 섞지 않고 별도 저장소를 쓴다 —
 * 결제 상태가 분석 결과에 영향을 줄 수 없게 구조적으로 분리한다.
 *
 * ⚠️ 이메일·전화번호·카드번호를 수집하지 않는다. 관심 표시만 남긴다.
 */
export interface PremiumIntent {
  feature: PremiumFeatureId;
  source: PremiumSource;
  price: number;
  variant: PremiumPriceVariant;
  clickedAt: string;
  notifyIntent: boolean;
}

export type PremiumPriceVariant = 'A' | 'B';

/* -------------------------------------------- Premium Detail 결과 계약 */

/**
 * 상세 결과는 **이미 계산된 값**을 더 풍부하게 보여주는 것이다.
 * 새 점수·새 추론을 만들지 않으므로, 여기에는 기존 결과에서 파생한 표현만 담는다.
 */
/**
 * v1.26 History 실측에서 발견 — `mine`/`theirs`를 화면이 **나 / 상대**로 고정 렌더하는데,
 * `buildHistoryDetail`은 그 두 칸에 `previousText`/`currentText`(과거/현재)를 담고 있었다.
 * 그래서 History 상세가 "나: 개인 시간이 꾸준히 중요했음 · 상대: 개인 시간이 꾸준히
 * 중요했음"처럼 **사실이 아닌 라벨**로 나갔다(실측 확인).
 *
 * 두 칸의 의미를 호출부가 정할 수 있게 라벨을 옵션으로 뺀다. 넘기지 않으면 기존
 * 동작(나/상대)이라 다른 상세 4종(궁합·Mirror·MBTI·Astrology)은 그대로다.
 */
export interface PremiumDetailSection {
  /** 축 라벨 등 소제목 */
  label: string;
  /** 두 값 대조 (있을 때만) */
  mine?: string;
  theirs?: string;
  /** 왼쪽 칸의 라벨. 넘기지 않으면 '나' */
  mineLabel?: string;
  /** 오른쪽 칸의 라벨. 넘기지 않으면 '상대' */
  theirsLabel?: string;
  /** 이 판정을 본 근거 */
  evidence?: string;
  /** 실제 관계에서 나타날 수 있는 상황 */
  scene?: string;
  /** 상태 뱃지 (MATCH/GAP 등) */
  badge?: string;
}

export interface PremiumDetailReport {
  feature: PremiumFeatureId;
  available: boolean;
  /** 무료에서 이미 본 것 — Paywall에서 '무료로 본 내용'으로 되짚어준다 */
  freeRecap: readonly string[];
  sections: PremiumDetailSection[];
  prompts: readonly string[];
  /** 러비의 한 줄 정리 */
  closing: string | null;
  /** 이 상세가 못 하는 것 */
  limitations: readonly string[];
}

/* ------------------------------------------------------------------ 세션 */

export interface SessionAnswers {
  status: RelationshipStatus | null;
  photos: PhotoAsset[];
  /** ObservedTrait.id → 사용자 피드백 */
  observations: Record<string, ObservationFeedback>;
  /**
   * 사진 AI 분석 결과 (v1.6).
   *
   * Demo 시절에는 사진 개수만 보고 매 렌더마다 다시 계산했지만, 실제 AI 결과는 재계산할 수
   * 없으므로 **세션에 저장한다.** null이면 아직 분석하지 않은 상태다.
   * `meta.mode`로 real / demo / fallback / legacy-demo를 구분한다.
   */
  observedAnalysis: ObservedProfileResult | null;
  declared: DeclaredPreference;
  experience: RelationshipExperience;
  /**
   * v1.41 §39.4 — **지금 관계 속의 나** (S30 · Optional).
   *
   * `experience`(S15~S17)와 나란히 놓이는 **별도의 evidence source**다. 같은 필드에
   * 덮어쓰지 않는다 — 덮어쓰면 과거 근거가 사라지고, 그러면 Premium의
   * `Current × Past` 연결(§39.18)이 애초에 만들어질 수 없다.
   *
   * ⚠️ v1.40 이전 세션에는 없다. 없으면 빈 값으로 복원되고, 그 상태의 모든 판정은
   * v1.40.1과 **글자 하나 다르지 않다**(fixture E0가 확인한다).
   */
  currentRelationship: CurrentRelationshipEvidence;
  target: TargetProfile;
  /** 저장한 대화 질문 id */
  savedQuestions: ConversationQuestionId[];
  /** Core Insight 확인 응답 */
  coreVerdict: Verdict;
  coreCorrection: string;
  /**
   * 내 MBTI — S13(Declared Me 마지막)에서 선택 입력한다.
   * DeclaredPreference 안에 넣지 않는다: Declared Me는 사용자가 직접 표현한 '관계 기준'이고,
   * MBTI는 별도의 Self-described Personality Lens이기 때문이다.
   * 동기화율·Relationship Mirror 계산에는 관여하지 않는다.
   */
  mbti: MbtiType | null;
  /**
   * Entertainment Lens(사주·Astrology) 공용 출생정보. Optional이며 Main Funnel을 막지 않는다.
   * 동기화율·Mirror·History 계산에 어디에도 쓰이지 않는다.
   */
  birthProfile: BirthProfile;
  /**
   * v1.3 이전에 사용자가 직접 고른 별자리. v1.4에서 생년월일 기반 계산으로 바뀌었으므로
   * 새로 쓰지는 않지만, 기존 세션이 깨지지 않게 읽기 전용으로 남겨둔다 —
   * 이 값으로 생년월일을 **임의로 만들어내지 않는다**(§42 Migration).
   */
  legacyZodiac: ZodiacSign | null;
  share: {
    includeTargetInfo: boolean;
    includeDimensionScores: boolean;
  };
  /**
   * v1.9 — Premium Adaptive Deep Question 답변.
   * 기존 답변을 덮어쓰지 않는 별도 Evidence Source다(§11). insightId 기준으로 누적된다.
   */
  deepAnswers: DeepAnalysisAnswer[];
  /** v1.9 — Deep Insight 카드별 사용자 확인(§33). insight.id → feedback */
  deepInsightFeedback: Record<string, DeepInsightFeedback>;
  /**
   * v1.11 — Result Revisit UX용 최소 타임스탬프(§42).
   *
   * ⚠️ 결과 자체(점수·Mirror 판정)는 여기 저장하지 않는다 — Compatibility/Mirror는
   * `useCompatibility()`/`useMirror()`가 세션에서 매번 다시 계산하는 순수 함수라
   * 중복 저장할 이유가 없다. 이 필드는 Home의 '최근 궁합' / '최근 Mirror' 카드에
   * '언제 봤는지'를 보여주기 위한 표시용 값일 뿐이다. optional — 구 세션에는 없다.
   */
  currentAnalysisMeta?: {
    compatibilityViewedAt?: string;
    mirrorViewedAt?: string;
    updatedAt: string;
    /**
     * v1.12 — Analysis-level KPI dedup 키(§18~§23). `RelationshipHistoryEntry.analysisId`
     * (declared/experience 기반 deterministic fingerprint)와 **의도적으로 다른 개념**이라
     * 이름을 분리했다 — 이건 그냥 random UUID이고, 상대 개인정보를 담지 않으며,
     * `resetTargetContext()`가 새 상대마다 새로 발급한다.
     */
    funnelAnalysisId?: string;
  };
  /** 진행 상황 플래그 */
  completed: {
    onboarding: boolean;
    observed: boolean;
    declared: boolean;
    experience: boolean;
    profile: boolean;
    compatibility: boolean;
    mirror: boolean;
  };
}

/* ==================== Solo / First Contact (v1.29 · P4) ==================== */

/**
 * 상대 정보량에 따른 리포트 분기 (§32~§34).
 *
 * `no_target`과 `unknown_target`을 **하나로 묶지 않는다.** 전자는 "지금 특정 상대가
 * 없다"이고 후자는 "사람은 있는데 아직 모른다"라서, 같은 문장을 쓰면 둘 중 하나에는
 * 반드시 거짓말이 된다. 후자에게는 상대를 추론해 주는 대신 **알아갈 질문**을 준다.
 */
export type SoloMode = 'no_target' | 'unknown_target' | 'couple';

/** First Contact가 다루는 축 — Mirror 4축 + 취미 */
export type SelfSignalKey = MirrorAxisKey;

/**
 * 내가 답한 기준 하나.
 *
 * ⚠️ 점수가 아니다. `emphasis`는 **문장을 고르는 순서**에만 쓰고 화면에 숫자로
 * 노출하지 않는다 — '연애 준비도' 같은 지표를 만들지 않기 위해서다(§29).
 */
export interface SelfSignal {
  key: SelfSignalKey;
  label: string;
  /** 사용자가 실제로 고른 값을 그대로 옮긴 문장 */
  valueText: string;
  /** 관계를 시작할 때 이 기준이 어떻게 드러나는지 — 관찰이지 진단이 아니다 */
  approachText: string;
  /** 중앙(보통)에서 얼마나 떨어졌는가. 0~2. 정렬 전용 */
  emphasis: 0 | 1 | 2;
}

/**
 * **내 답변 안에서 함께 나타난 두 신호** (§23-03)
 *
 * COUPLE에서 파는 것이 '나와 상대 사이의 차이'라면, SOLO에서 파는 것은
 * '나 안에서 함께 나타나는 기준'이다. 둘 다 사용자가 직접 답한 것이고,
 * 그 둘이 같이 있다는 사실만 말한다 — **왜 그런지는 말하지 않는다.**
 */
export interface SelfSignalPair {
  id: string;
  axes: [SelfSignalKey, SelfSignalKey];
  labels: [string, string];
  /** 두 답이 함께 나타났다는 관찰 */
  observation: string;
  /** 이 관찰이 말할 수 없는 것. Premium의 limitation과 같은 규칙 */
  limitation: string;
  /** 화면에 그대로 보여줄 근거 두 줄(사용자가 고른 값) */
  evidence: [string, string];
}

/**
 * 실제로 해볼 수 있는 것 (§30 · §31).
 *
 * ⚠️ **연애 성공 공식이 아니다.** 반드시 `signal → why → action` 세 칸을 갖는다 —
 * 일반 연애 팁 목록과 구조로 구분된다. 근거 없는 행동은 만들지 않는다.
 */
export interface FirstContactAction {
  kind: 'TRY' | 'ASK' | 'NOTICE';
  /** 이 행동의 출처가 된 내 답변 */
  signal: string;
  /** 그 답이 관계 시작 시점에 무엇으로 보이는지 */
  why: string;
  /** 해볼 것 */
  action: string;
}

/** 러비의 관찰 — 질문이지 진단이 아니다(§27) */
export interface FirstContactObservation {
  body: string;
  question: string;
}

export interface FirstContactReport {
  /** 내 기준이 충분히 모이지 않으면 false. 억지로 만들지 않는다 */
  available: boolean;
  mode: SoloMode;
  /** 연애 경험 기록이 없는 사용자인가 — 카피 분기에만 쓴다(§28) */
  noExperience: boolean;
  /** 첫 5초에 읽는 한 문장 (§24) */
  headline: string;
  signals: SelfSignal[];
  pairs: SelfSignalPair[];
  observation: FirstContactObservation | null;
  /**
   * `unknown_target`일 때만 채운다 — 상대를 추론하는 대신
   * **알아보기 위해 물어볼 것**을 준다(§32).
   */
  gettingToKnow: string[];
  actions: FirstContactAction[];
}
