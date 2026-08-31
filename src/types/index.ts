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
}

/* -------------------------------------------------------- Target Person (S19) */

export type TargetRelation = 'crush' | 'friend' | 'work' | 'intro';

/** l / m / h, x = 잘 모르겠어요 (점수에 반영하지 않음) */
export type TargetLevel = 'l' | 'm' | 'h' | 'x';

export interface TargetProfile {
  relation: TargetRelation | null;
  contact: TargetLevel;
  conflict: TargetLevel;
  alone: TargetLevel;
  affection: TargetLevel;
  talk: TargetLevel;
  rhythm: TargetLevel;
}

export type TargetAxisKey = 'contact' | 'conflict' | 'alone' | 'affection' | 'talk' | 'rhythm';

/* ------------------------------------------------------- Compatibility (S21~S25) */

export type SignalTone = 'good' | 'neutral' | 'watch' | 'unknown';

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

export interface ConversationQuestion {
  id: TargetAxisKey;
  /** 어떤 항목에서 나온 질문인지 */
  tag: string;
  text: string;
  fromFriction: boolean;
}

/* --------------------------------------------- Relationship Mirror (S26~S28) */

export type MirrorState = 'MATCH' | 'GAP' | 'CHANGE';

export type MirrorAxisKey = 'alone' | 'contact' | 'hobby' | 'conflict' | 'affection';

export interface MirrorInsight {
  key: MirrorAxisKey;
  label: string;
  /** 네가 말한 너 1~5 */
  declared: number;
  /** 관계에서 나타난 너 1~5 */
  relationship: number;
  state: MirrorState;
  /** 러비의 해석 한 줄 */
  note: string;
  declaredPhrase: string;
  relationshipPhrase: string;
  diff: number;
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
  insights: MirrorInsight[];
  teaser: MirrorTeaser;
  core: CoreInsight;
  gapCount: number;
  declaredPoints: string;
  relationshipPoints: string;
}

/* --------------------------------------------- Relationship Profile (S18) */

export interface ProfileLayer {
  id: 'observed' | 'declared' | 'relationship';
  title: string;
  caption: string;
  items: string[];
}

export interface RelationshipProfile {
  layers: ProfileLayer[];
  /** 세 관찰을 합친 결과 */
  coreInsight: string;
  evidence: EvidenceItem[];
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
