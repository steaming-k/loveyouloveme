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

/* -------------------------------------------------------- Target Person (S19) */

export type TargetRelation = 'crush' | 'friend' | 'work' | 'intro';

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
}

export type TargetAxisKey = 'contact' | 'conflict' | 'alone' | 'affection';

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

/** 관계 신호 기반 질문은 축 key를, MBTI 기반 보조 질문은 `mbti_` 접두사를 쓴다 */
export type ConversationQuestionId = TargetAxisKey | `mbti_${MbtiAxisKey}`;

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
}

export interface RelationshipHistoryEntry {
  id: string;
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
  | 'deep-report-narrative';

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
  | { source: 'adaptive'; field: string }
  | { source: 'observed'; traitId: string }
  | { source: 'history'; entryId: string; axis: string }
  /** v1.9 — 상대에 대해 사용자가 입력한 값(Target Person) */
  | { source: 'target'; field: string }
  /** v1.9 — Premium Adaptive Deep Question 답변(§11) */
  | { source: 'deep_followup'; questionId: string };

/* --------------------------------------------- Observed Me (사진 분석) */

export type ObservedCategory = 'interest' | 'activity' | 'social' | 'lifestyle';

export interface ImageEvidence {
  /** 세션 내부 임의 id. 사용자 원본 파일명을 AI에 보내지 않는다(§29) */
  imageId: string;
  description: string;
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
}

/** 사진 수가 아니라 **쓸 만한 근거의 양**으로 판정한다. AI가 스스로 판정하지 않는다(§11) */
export type EvidenceCoverageLevel = 'low' | 'medium' | 'high';

export interface ObservedProfileResult {
  version: string;
  traits: AiObservedTrait[];
  limitations: string[];
  evidenceCoverage: {
    imageCount: number;
    usableImageCount: number;
    level: EvidenceCoverageLevel;
  };
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
  | 'target'
  | 'history'
  | 'adaptive'
  | 'deep_followup'
  | 'user_correction';

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

/**
 * Premium의 핵심 상품. **새 점수를 만들지 않는다** — Compatibility/Mirror/History는
 * 이미 계산된 결과를 그대로 조합한다(§17 compatibilityDeepDive, §21 historyDeep이
 * `PremiumDetailReport`를 그대로 재사용하는 이유다).
 */
export interface RelationshipDeepReport {
  available: boolean;
  overview: RelationshipDeepReportOverview;
  /** §15 Relationship Self — Observed/Declared/Relationship을 연결한 카드들 */
  relationshipSelf: DeepReportInsightCard[];
  /** §16 Cross-source Insights — Premium의 핵심. 우선순위대로 정렬됨(§6) */
  crossSourceInsights: DeepReportInsightCard[];
  /** §17 — 기존 buildCompatibilityDetail() 결과를 그대로 재사용 */
  compatibilityDeepDive: PremiumDetailReport;
  /** §19 — 관련 Insight가 있는 것만 존재 */
  situations: DeepSituation[];
  /** §20 — 기존 대화 질문 재사용 + Deep 질문 추가 */
  conversationQuestions: DeepConversationQuestion[];
  /** §21 — 기존 buildHistoryDetail() 재사용. History Entry < 2면 null(섹션 숨김) */
  historyDeep: PremiumDetailReport | null;
  /** §23 Lovy Final Observation. Insight가 하나도 없으면 null */
  finalObservation: DeepFinalObservation | null;
  /** 이 리포트가 못 하는 것 — 항상 사용자에게 보여준다 */
  limitations: string[];
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
export interface PremiumDetailSection {
  /** 축 라벨 등 소제목 */
  label: string;
  /** 나 / 상대 대조 (있을 때만) */
  mine?: string;
  theirs?: string;
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
