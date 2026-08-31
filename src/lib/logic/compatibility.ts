import { AXIS_DEFINITIONS, QUESTION_BY_AXIS } from '@/data/axes';
import { AFFECTION_LABEL, CONFLICT_LABEL } from '@/data/labels';
import { TARGET_MIN_KNOWN } from '@/data/targetFields';
import type {
  CompatibilityDimension,
  CompatibilityResult,
  Confidence,
  ConversationQuestion,
  DeclaredPreference,
  SignalTone,
  TargetAxisKey,
  TargetProfile,
} from '@/types';
import { alignmentOf, toMineValues, toTargetValues } from './values';

/**
 * 동기화율 계산 — Rule Based Demo Logic
 *
 * ⚠️ 이 값은 '연애 성공 확률'이 아니다.
 * 현재 입력된 두 사람의 정보를 기준으로 6개 축의 공통점·차이를 직관화한 지표다.
 * 코드에서도 success / prediction 같은 표현을 쓰지 않는다.
 *
 * 계산:
 *   축별 alignment = max(0, 5 - |나 - 상대|)
 *   비교 가능한 축의 alignment 평균을 0~1로 정규화한 뒤 40~92 구간에 매핑
 *   → score = 40 + floor(평균비율 × 52)
 *
 * 하한을 40으로 둔 이유: 6개 축 중 일부만 다르다고 해서 '0점'처럼 읽히면
 * 사용자가 관계를 단정적으로 해석하게 되기 때문이다.
 */
export const SCORE_FLOOR = 40;
export const SCORE_RANGE = 52;

/** 나의 값을 사람이 읽는 문장으로 */
function minePhraseOf(
  key: TargetAxisKey,
  declared: DeclaredPreference,
  fixedPhrase: string | null,
): string {
  if (fixedPhrase) return fixedPhrase;

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

function toneOf(alignment: number | null): SignalTone {
  if (alignment === null) return 'unknown';
  if (alignment >= 4) return 'good';
  if (alignment <= 2) return 'watch';
  return 'neutral';
}

function confidenceOf(comparedCount: number, totalCount: number): Confidence {
  if (comparedCount >= totalCount - 1) return 'high';
  if (comparedCount >= TARGET_MIN_KNOWN) return 'medium';
  return 'low';
}

export function buildCompatibility(
  declared: DeclaredPreference,
  target: TargetProfile,
): CompatibilityResult {
  const mineValues = toMineValues(declared);
  const targetValues = toTargetValues(target);

  const dimensions: CompatibilityDimension[] = AXIS_DEFINITIONS.map((def) => {
    const mineValue = def.mineFixed ?? mineValues[def.key];
    const theirsValue = targetValues[def.key];
    const alignment = alignmentOf(mineValue, theirsValue);
    const level = target[def.key];

    return {
      key: def.key,
      label: def.label,
      mineValue,
      minePhrase: minePhraseOf(def.key, declared, def.mineFixedPhrase),
      theirsValue,
      theirsPhrase: level === 'x' ? '모름' : def.theirsPhrase[level],
      alignment,
      tone: toneOf(alignment),
      evidence: def.evidence,
      scene: def.scene,
    };
  });

  const compared = dimensions.filter((d) => d.alignment !== null);
  const sum = compared.reduce((acc, d) => acc + (d.alignment ?? 0), 0);

  const score =
    compared.length < TARGET_MIN_KNOWN
      ? null
      : SCORE_FLOOR + Math.floor((sum / (compared.length * 5)) * SCORE_RANGE);

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

export function buildConversationQuestions(
  result: CompatibilityResult,
): ConversationQuestion[] {
  const frictionKeys = result.frictionSignals.map((f) => f.key);
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
  return toneOf(alignment);
}
