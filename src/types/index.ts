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
  /** 선택 입력. 나(mbti)와 상대(target.mbti)가 둘 다 있을 때만 동기화율에 별도 축으로 반영한다. */
  mbti: MbtiType | null;
}

export type TargetAxisKey = 'contact' | 'conflict' | 'alone' | 'affection';

/* ------------------------------------------------------- Compatibility (S21~S25) */

export type SignalTone = 'good' | 'neutral' | 'watch' | 'unknown';

export interface CompatibilityDimension {
  /** 'mbti'는 4축 시스템(TargetAxisKey) 밖의 선택적 추가 신호 — 둘 다 입력했을 때만 나타난다 */
  key: TargetAxisKey | 'mbti';
  label: string;
  /** 나의 값 1~5. 미응답이면 null. MBTI처럼 척도가 아닌 값은 항상 null이고 minePhrase만 쓴다 */
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

export interface ConversationQuestion {
  id: TargetAxisKey;
  /** 어떤 항목에서 나온 질문인지 */
  tag: string;
  text: string;
  fromFriction: boolean;
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
  savedQuestions: TargetAxisKey[];
  /** Core Insight 확인 응답 */
  coreVerdict: Verdict;
  coreCorrection: string;
  /** X1-a MBTI Lens — 궁합·Mirror 계산에는 쓰지 않는 참고용 값 */
  mbti: MbtiType | null;
  /** X1-b Astrology Lens — 궁합·Mirror 계산에는 쓰지 않는 참고용 값 */
  zodiac: ZodiacSign | null;
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
