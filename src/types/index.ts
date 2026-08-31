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
    original: string;
    userCorrection: string | null;
    verdict: Verdict;
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

/* ------------------------------------------------------------------ 세션 */

export interface SessionAnswers {
  status: RelationshipStatus | null;
  photos: PhotoAsset[];
  /** ObservedTrait.id → 사용자 피드백 */
  observations: Record<string, ObservationFeedback>;
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
