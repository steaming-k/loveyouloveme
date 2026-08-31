import { AXIS_DEFINITIONS, QUESTION_BY_AXIS } from '@/data/axes';
import { AFFECTION_LABEL, CONFLICT_LABEL } from '@/data/labels';
import { TARGET_MIN_KNOWN } from '@/data/targetFields';
import type {
  CompatibilityDimension,
  CompatibilityResult,
  Confidence,
  ConversationQuestion,
  DeclaredPreference,
  MbtiType,
  SignalTone,
  TargetAxisKey,
  TargetProfile,
} from '@/types';
import { mbtiMatchCount, mbtiSimilarity, similarityOf, toMineValues, toTargetValues } from './values';

/**
 * 동기화율 계산 — Rule Based Demo Logic
 *
 * ⚠️ 이 값은 '연애 성공 확률'이 아니다.
 * 현재 입력된 두 사람의 정보를 기준으로 4개 축(연락/갈등/개인 시간/애정 표현)의
 * 공통점·차이를 직관화한 지표다. 코드에서도 success / prediction 같은 표현을 쓰지 않는다.
 *
 * 계산 (인위적인 하한선을 두지 않는다 — 낮으면 낮게 보인다):
 *   축별 similarity = max(0, 1 - |나 - 상대| / 4)     // 완전 동일=1, 완전 반대=0
 *   score = round(mean(비교 가능한 축의 similarity) × 100)
 *
 * 예: 완전히 동일 → 100 · 1단계 차이 → 75 · 2단계 차이 → 50 · 3단계 차이 → 25 · 완전 반대 → 0
 *
 * MBTI는 5번째 축이 아니라 선택적 추가 축이다. 나(mbti)와 상대(target.mbti)를 둘 다
 * 입력했을 때만 dimensions에 추가되고 score 평균에 들어간다 — 둘 중 하나라도 없으면
 * 이 축 자체가 없는 것처럼 계산한다(다른 축의 '모름'과 같은 원칙).
 */
export function scoreFrom(similarities: readonly number[]): number {
  const mean = similarities.reduce((sum, value) => sum + value, 0) / similarities.length;
  return Math.round(mean * 100);
}

/** 나의 값을 사람이 읽는 문장으로 */
function minePhraseOf(key: TargetAxisKey, declared: DeclaredPreference): string {
  switch (key) {
    case 'alone':
      return declared.alone === null ? '아직 답하지 않음' : `혼자 있는 시간 ${declared.alone}/5`;
    case 'contact':
      return declared.contact === null ? '아직 답하지 않음' : `연락 중요도 ${declared.contact}/5`;
    case 'affection':
      return declared.affection === null ? '아직 답하지 않음' : AFFECTION_LABEL[declared.affection];
    case 'conflict':
      return declared.conflict === null ? '아직 답하지 않음' : CONFLICT_LABEL[declared.conflict];
    default:
      return '아직 답하지 않음';
  }
}

function toneOf(similarity: number | null): SignalTone {
  if (similarity === null) return 'unknown';
  if (similarity >= 0.75) return 'good';
  if (similarity <= 0.25) return 'watch';
  return 'neutral';
}

function confidenceOf(comparedCount: number, totalCount: number): Confidence {
  if (comparedCount >= totalCount - 1) return 'high';
  if (comparedCount >= TARGET_MIN_KNOWN) return 'medium';
  return 'low';
}

/**
 * MBTI 축은 척도(1~5) 비교가 아니라 4글자 일치 개수 기반이라 AXIS_DEFINITIONS 파이프라인에
 * 억지로 끼워 넣지 않는다. 둘 다 입력했을 때만 만들어지는 독립적인 dimension이다.
 */
function buildMbtiDimension(mine: MbtiType | null, theirs: MbtiType | null): CompatibilityDimension | null {
  if (!mine || !theirs) return null;

  const similarity = mbtiSimilarity(mine, theirs);
  const matches = mbtiMatchCount(mine, theirs);

  return {
    key: 'mbti',
    label: 'MBTI',
    mineValue: null,
    minePhrase: mine,
    theirsValue: null,
    theirsPhrase: theirs,
    alignment: Math.round(similarity * 5),
    tone: toneOf(similarity),
    evidence: `MBTI 4개 지표 중 ${matches}개가 같아요. 성향 궁합 이론이 아니라 겹치는 글자 수만 참고하는 값이에요.`,
    scene: '성향이 다른 지표에서는 서로 다른 방식으로 반응할 수 있어요.',
  };
}

export function buildCompatibility(
  declared: DeclaredPreference,
  target: TargetProfile,
  mineMbti: MbtiType | null = null,
): CompatibilityResult {
  const mineValues = toMineValues(declared);
  const targetValues = toTargetValues(target);

  const baseDimensions: CompatibilityDimension[] = AXIS_DEFINITIONS.map((def) => {
    const mineValue = mineValues[def.key];
    const theirsValue = targetValues[def.key];
    const similarity = similarityOf(mineValue, theirsValue);
    const level = target[def.key];

    return {
      key: def.key,
      label: def.label,
      mineValue,
      minePhrase: minePhraseOf(def.key, declared),
      theirsValue,
      theirsPhrase: level === 'x' ? '모름' : def.theirsPhrase[level],
      // UI 게이지(5칸)용으로만 0~5에 매핑한다. 반올림 특성상 완전 반대(similarity=0)만 0칸이 된다.
      alignment: similarity === null ? null : Math.round(similarity * 5),
      tone: toneOf(similarity),
      evidence: def.evidence,
      scene: def.scene,
    };
  });

  const mbtiDimension = buildMbtiDimension(mineMbti, target.mbti);
  const dimensions: CompatibilityDimension[] = mbtiDimension
    ? [...baseDimensions, mbtiDimension]
    : baseDimensions;

  const compared = dimensions.filter((d) => d.alignment !== null);
  const similarities = compared
    .map((d) => (d.alignment === null ? null : d.alignment / 5))
    .filter((value): value is number => value !== null);

  const score = compared.length < TARGET_MIN_KNOWN ? null : scoreFrom(similarities);

  return {
    score,
    dimensions,
    goodSignals: dimensions.filter((d) => d.tone === 'good'),
    frictionSignals: dimensions.filter((d) => d.tone === 'watch'),
    unknownLabels: dimensions.filter((d) => d.alignment === null).map((d) => d.label),
    comparedCount: compared.length,
    totalCount: dimensions.length,
    confidence: confidenceOf(compared.length, dimensions.length),
  };
}

/**
 * 대화 질문 (S25)
 * 차이가 보이는 항목을 먼저 넣고, 부족하면 관계에서 자주 부딪히는 축으로 채운다.
 */
const QUESTION_FALLBACK_ORDER: TargetAxisKey[] = ['contact', 'conflict', 'alone'];
export const CONVERSATION_QUESTION_COUNT = 3;

/** MBTI는 QUESTION_BY_AXIS에 없는 축이라 대화 질문 후보에서는 제외한다. */
function isTargetAxisKey(key: TargetAxisKey | 'mbti'): key is TargetAxisKey {
  return key !== 'mbti';
}

export function buildConversationQuestions(result: CompatibilityResult): ConversationQuestion[] {
  const frictionKeys = result.frictionSignals.map((f) => f.key).filter(isTargetAxisKey);
  const keys: TargetAxisKey[] = [...frictionKeys];

  for (const key of QUESTION_FALLBACK_ORDER) {
    if (!keys.includes(key)) keys.push(key);
  }

  return keys.slice(0, CONVERSATION_QUESTION_COUNT).map((key) => {
    const dimension = result.dimensions.find((d) => d.key === key);
    const label = dimension?.label ?? key;
    const fromFriction = frictionKeys.includes(key);

    return {
      id: key,
      tag: `${label} · ${fromFriction ? '차이가 보이는 항목' : '확인해보면 좋은 항목'}`,
      text: QUESTION_BY_AXIS[key],
      fromFriction,
    };
  });
}

/** 게이지 세그먼트 색 — 색만으로 구분하지 않도록 UI에서 라벨을 함께 노출한다 */
export function segmentTone(alignment: number | null): SignalTone {
  return toneOf(alignment === null ? null : alignment / 5);
}
