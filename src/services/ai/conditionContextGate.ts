import { conditionSignatureOf } from '@/lib/logic/actionAlignment';
import type { RelationshipTense } from '@/lib/logic/relationshipEvidence';
import type { ConditionContext } from '@/types';
import { scanDeepNarrativeWithTense } from './safety';

/**
 * v1.46.4 Core Value Closure §11 ~ §13 — **conditionContext 검증.**
 *
 * ══ 무엇을 막는가 ══════════════════════════════════════════════════════════
 *
 * ```
 * 근거 없는 칸     허용된 장면·근거 문장에 없는 상황을 지어낸 trigger/state/uncertainty
 * 위험한 칸       상대 의도·감정·진단('일부러 피함' · '마음이 식음' · '회피형')
 * 형식이 틀린 칸   '모름'이 아닌 uncertainty · trigger와 같은 state
 * ```
 *
 * ⚠️ **칸 단위로 지운다.** 카드 문장(soWhat · whyItMatters)은 이 검사로 버려지지 않는다 — context는
 *    Action을 위한 구조일 뿐이고, 없으면 기존 규칙(narrowedCondition → unresolved → 장면)으로 돌아간다(§23).
 *    단, 위험한 칸이 하나라도 있으면 context 전체를 버린다(부분적으로 믿을 수 없다).
 * ⚠️ 근거 판정은 조건 개념 서명(`conditionSignatureOf`)이 겹치거나, 글자 bigram이 충분히 겹칠 때다.
 *    문자열 완전 일치를 요구하지 않는다(모델은 장면을 요약한다).
 */

const UNKNOWN_MARKER = /모르|모름|모른|몰라|불명확|알\s*수\s*없|확인되지\s*않|정해지지\s*않|안\s*보이/;
/** 기존 intent 스캐너 위에 context 칸에서 특히 나오는 상대 추정 표현 */
const CONTEXT_INTENT = /피하|피했|피해서|식었|식은|회피|관심\s*(이\s*)?없|일부러|싫어|귀찮아|질렸/;
const MIN_SHARED_BIGRAMS = 3;

function compact(text: string): string {
  return text.replace(/[^0-9A-Za-z가-힣]/g, '');
}

function bigramsOf(text: string): Set<string> {
  const value = compact(text);
  const grams = new Set<string>();
  for (let i = 0; i + 2 <= value.length; i += 1) grams.add(value.slice(i, i + 2));
  return grams;
}

function isGrounded(text: string, sources: readonly string[]): boolean {
  const signature = conditionSignatureOf(text);
  const sourceSignature = conditionSignatureOf(sources.join(' '));
  for (const concept of signature) if (sourceSignature.has(concept)) return true;
  const sourceGrams = new Set(sources.flatMap((source) => [...bigramsOf(source)]));
  let shared = 0;
  for (const gram of bigramsOf(text)) if (sourceGrams.has(gram)) shared += 1;
  return shared >= MIN_SHARED_BIGRAMS;
}

export function validateConditionContext(input: {
  context: ConditionContext | null;
  /** 이 카드에 실어 보낸 장면 원문 · 근거 문장 · 사용자가 이미 아는 기준 */
  sources: readonly string[];
  unresolvedPoints: readonly string[];
  narrowedCondition: string | null;
  tense: RelationshipTense;
}): { context: ConditionContext | null; violations: string[] } {
  const violations: string[] = [];
  const raw = input.context;
  if (!raw) return { context: null, violations };

  const filled = [raw.trigger, raw.state, raw.uncertainty].filter((text): text is string => Boolean(text));
  if (filled.length === 0) return { context: null, violations };

  /* §12 — 상대 의도·감정·진단·예측이 한 칸이라도 있으면 context 전체를 믿지 않는다 */
  const joined = filled.join(' ');
  if (CONTEXT_INTENT.test(joined) || !scanDeepNarrativeWithTense(joined, input.tense).safe) {
    violations.push('context_unsafe');
    return { context: null, violations };
  }

  let trigger = raw.trigger;
  let state = raw.state;
  let uncertainty = raw.uncertainty;

  if (trigger && !isGrounded(trigger, input.sources)) {
    violations.push('context_ungrounded_trigger');
    trigger = null;
  }
  if (state && !isGrounded(state, input.sources)) {
    violations.push('context_ungrounded_state');
    state = null;
  }
  if (state && trigger && compact(state) === compact(trigger)) {
    violations.push('context_duplicate_field');
    state = null;
  }
  if (uncertainty) {
    if (!UNKNOWN_MARKER.test(uncertainty)) {
      violations.push('context_uncertainty_not_unknown');
      uncertainty = null;
    } else if (!isGrounded(uncertainty, [...input.sources, ...input.unresolvedPoints, trigger ?? '', state ?? ''])) {
      violations.push('context_ungrounded_uncertainty');
      uncertainty = null;
    }
  }

  if (!trigger && !state && !uncertainty) return { context: null, violations };
  const context: ConditionContext = { trigger, state, uncertainty };

  /* §24 — narrowedCondition이 이 context의 요약인가(기록만 한다 · 카드 문장을 버리지 않는다) */
  if (input.narrowedCondition) {
    const narrowed = conditionSignatureOf(input.narrowedCondition);
    const fields = conditionSignatureOf([trigger, state, uncertainty].filter(Boolean).join(' '));
    if (fields.size > 0 && ![...fields].some((concept) => narrowed.has(concept))) {
      violations.push('context_narrowed_inconsistent');
    }
  }
  return { context, violations };
}
