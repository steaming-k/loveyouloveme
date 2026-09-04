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
import { similarityOf, toMineValues, toTargetValues } from './values';

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
 * ⚠️ MBTI는 이 계산에 들어오지 않는다. score의 분모(comparedCount)와 TARGET_MIN_KNOWN
 * 판단에도 포함하지 않는다 — '동기화율 78'은 오직 관계 행동 신호 기반 결과다.
 * MBTI 비교는 lib/logic/mbtiLens.ts의 별도 Supporting Lens로만 다룬다.
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

export function buildCompatibility(
  declared: DeclaredPreference,
  target: TargetProfile,
): CompatibilityResult {
  const mineValues = toMineValues(declared);
  const targetValues = toTargetValues(target);

  const dimensions: CompatibilityDimension[] = AXIS_DEFINITIONS.map((def) => {
    const mineValue = mineValues[def.key];
    const theirsValue = targetValues[def.key];
    const similarity = similarityOf(mineValue, theirsValue);
    const level = target[def.key];
    const tone = toneOf(similarity);

    return {
      key: def.key,
      label: def.label,
      mineValue,
      minePhrase: minePhraseOf(def.key, declared),
      theirsValue,
      theirsPhrase: level === 'x' ? '모름' : def.theirsPhrase[level],
      // UI 게이지(5칸)용으로만 0~5에 매핑한다. 반올림 특성상 완전 반대(similarity=0)만 0칸이 된다.
      alignment: similarity === null ? null : Math.round(similarity * 5),
      tone,
      /**
       * v1.19 Release Gate §4 — 판정(`tone`)에 맞는 문장을 고른다.
       *
       * 이전에는 `def.evidence`/`def.scene`이 축당 문자열 하나였고 tone과 무관하게 그대로
       * 붙었다. 그래서 '관찰 필요'로 판정된 축에 "…같은 구간이야"/"가능성이 낮아 보여"처럼
       * **판정과 반대되는 문장**이 나갔다(무료 SignalCard·Premium 상세 양쪽 모두).
       *
       * ⚠️ 여기서 바뀌는 건 **표시 문구뿐**이다. `similarityOf`·`toneOf`·`alignment`·
       * 동기화율 계산은 한 줄도 건드리지 않았다 — 같은 입력이면 점수도 판정도 그대로다.
       */
      evidence: def.evidence[tone],
      scene: def.scene[tone],
    };
  });

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

export function buildConversationQuestions(result: CompatibilityResult): ConversationQuestion[] {
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
  return toneOf(alignment === null ? null : alignment / 5);
}
