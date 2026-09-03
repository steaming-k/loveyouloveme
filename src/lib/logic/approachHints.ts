import { TARGET_FIELDS } from '@/data/targetFields';
import type {
  ApproachHint,
  ApproachHintKind,
  CompatibilityResult,
  TargetEvidenceRef,
  TargetProfile,
} from '@/types';

const FIELD_LABEL = new Map(TARGET_FIELDS.map((field) => [field.key, field]));

/** 근거 1개를 화면에 보여줄 짧은 문장으로(§28). 기존 TARGET_FIELDS 라벨을 그대로 재사용한다 */
export function describeTargetEvidence(ref: TargetEvidenceRef, target: TargetProfile): string {
  if (ref.type === 'interest') {
    const interest = target.preferences.interests.find((item) => item.id === ref.id);
    return interest ? `${interest.label} 좋아함` : '';
  }
  const field = FIELD_LABEL.get(ref.type);
  if (!field || ref.value === 'x') return '';
  const optionLabel = field.options.find((option) => option.value === ref.value)?.label ?? '';
  return `${field.label} ${optionLabel}`;
}

/** 카드 상단 카테고리 라벨(§20/§27) */
export const APPROACH_HINT_KIND_LABEL: Record<ApproachHintKind, string> = {
  activity: '같이 해볼 것',
  communication: '대화할 때 참고할 것',
  pace: '관계 속도를 맞출 때 참고할 것',
  affection: '관계 속도를 맞출 때 참고할 것',
  conversation: '먼저 물어볼 것',
};

/**
 * 다가가는 힌트 — Approach Hint Engine (v1.13 · §14~§24)
 *
 * ⚠️ 이건 호감도 예측·공략법이 아니다(§2/§46). '네가 알려준 상대의 모습'을 기준으로,
 * 그 정보를 조금 더 존중해서 다가가는 방법을 제안한다.
 *
 * 구조: User-provided Target Evidence → Deterministic Context Builder(이 파일) →
 * User interprets. 이번 버전에서는 여기서 만든 문장을 그대로 화면에 쓴다 — AI 재작성
 * 단계는 연결하지 않았다(§32, 판단 근거는 완료 보고 참고). 그래서 이 파일이 곧 최종
 * 사용자 문구다 — Safety Guardrail(§19/§33/§52)을 프롬프트가 아니라 코드 리뷰로 지킨다.
 *
 * 우선순위(§18): ① 직접 입력한 좋아하는 것 ② 관계 행동 방식 ③ 두 정보의 조합.
 * 근거가 부족하면 조언 대신 질문을 만든다(§29~§31, "KNOW → Suggest / UNKNOWN → Ask").
 * 최대 3개(§20).
 */

const MAX_HINTS = 3;

/** id는 이 함수 호출 하나 안에서만 유일하면 된다 — kind 자체가 이미 사실상 유일하다 */
function hintId(kind: ApproachHint['kind']): string {
  return kind;
}

/** 카페처럼 '가벼운 제안'이 자연스러운 관심사에는 조금 더 구체적인 문장을 붙인다(§21) */
function activityHint(target: TargetProfile): ApproachHint | null {
  const interests = target.preferences.interests;
  if (interests.length === 0) return null;

  const primary = interests[0]!;
  const evidenceRefs: TargetEvidenceRef[] = [{ type: 'interest', id: primary.id }];

  let rationale = `${primary.label}을(를) 좋아한다고 알려줬어. '언제 한번 보자'보다, 관심 있어 보이는 걸 하나 구체적으로 제안해보는 건 어때?`;

  // 조합(§18-③): 개인 시간을 중요하게 여기는 편이면 '자주 연락해 일정 채우기'보다
  // '하나를 구체적으로 제안하기'가 더 어울린다는 맥락을 붙인다(§18 예시).
  if (target.alone === 'h') {
    evidenceRefs.push({ type: 'alone', value: target.alone });
    rationale = `${primary.label}을(를) 좋아한다고 알려줬고, 개인 시간도 중요하게 보는 편이야. 자주 연락해 일정을 채우기보다, 관심 있어 보이는 ${primary.label} 하나를 구체적으로 제안해보는 건 어때?`;
  }

  return {
    id: hintId('activity'),
    kind: 'activity',
    title: `${primary.label}, 하나 구체적으로 제안해봐`,
    rationale,
    evidenceRefs,
    confidence: 'direct',
  };
}

/** 연락 빈도·개인 시간을 조합해 '연락 리듬' 힌트를 만든다(§22) */
function paceHint(target: TargetProfile): ApproachHint | null {
  const { contact, alone } = target;
  if (contact === 'x' && alone === 'x') return null;

  const evidenceRefs: TargetEvidenceRef[] = [
    ...(contact !== 'x' ? [{ type: 'contact', value: contact } as const] : []),
    ...(alone !== 'x' ? [{ type: 'alone', value: alone } as const] : []),
  ];

  if (contact === 'l' && alone === 'h') {
    return {
      id: hintId('pace'),
      kind: 'pace',
      title: '연락 리듬을 먼저 확인해봐',
      rationale:
        '연락을 많이 주고받는 것보다 각자 시간을 갖는 쪽에 가깝다고 알려줬어. 답장이 늦다는 이유만으로 연속해서 확인하기보다는, 상대의 연락 리듬을 먼저 물어보는 편이 자연스러울 수 있어.',
      evidenceRefs,
      confidence: 'direct',
    };
  }

  if (contact === 'h') {
    return {
      id: hintId('pace'),
      kind: 'pace',
      title: '연락은 편하게 이어가도 괜찮아',
      rationale:
        '연락을 자주 주고받는 걸 편하게 느끼는 편이라고 알려줬어. 답장을 조심스러워하기보다는, 가벼운 연락을 먼저 이어가는 게 자연스러울 수 있어.',
      evidenceRefs,
      confidence: 'direct',
    };
  }

  if (alone === 'h') {
    return {
      id: hintId('pace'),
      kind: 'pace',
      title: '각자 시간을 존중해줘',
      rationale:
        '개인 시간을 중요하게 여기는 편이라고 알려줬어. 연락이 뜸하다고 무리해서 확인하기보다는, 여유를 두고 기다려보는 편이 자연스러울 수 있어.',
      evidenceRefs,
      confidence: 'direct',
    };
  }

  // l/m 조합 등 나머지는 조금 더 절제된 일반 문구로.
  return {
    id: hintId('pace'),
    kind: 'pace',
    title: '연락 리듬을 참고해봐',
    rationale:
      '네가 알려준 연락·개인 시간 기준을 보면, 서로 기대하는 리듬이 다를 수 있어. 횟수를 맞추려 하기보다 편한 리듬을 먼저 물어보는 게 자연스러울 수 있어.',
    evidenceRefs,
    confidence: 'contextual',
  };
}

/** 애정 표현 방식 힌트(§23). 실제 target schema 의미(l=담백/m=보통/h=표현 많음) 안에서만 말한다 */
function affectionHint(target: TargetProfile): ApproachHint | null {
  if (target.affection === 'x') return null;

  const evidenceRefs: TargetEvidenceRef[] = [{ type: 'affection', value: target.affection }];

  if (target.affection === 'l') {
    return {
      id: hintId('affection'),
      kind: 'affection',
      title: '작은 행동으로 챙겨봐',
      rationale:
        '네가 알려준 정보에서는 애정 표현이 담백한 편에 가까워 보여. 말을 많이 하기보다, 작게 약속을 기억하거나 상대가 좋아한다고 했던 걸 챙기는 행동이 대화의 출발점이 될 수 있어.',
      evidenceRefs,
      confidence: 'direct',
    };
  }

  if (target.affection === 'h') {
    return {
      id: hintId('affection'),
      kind: 'affection',
      title: '표현을 편하게 주고받아도 괜찮아',
      rationale:
        '애정 표현이 많은 편이라고 알려줬어. 너무 조심스럽게 아끼기보다는, 편하게 표현을 주고받는 쪽이 자연스러울 수 있어.',
      evidenceRefs,
      confidence: 'direct',
    };
  }

  return {
    id: hintId('affection'),
    kind: 'affection',
    title: '표현 방식을 조금씩 맞춰봐',
    rationale: '애정 표현은 보통 정도라고 알려줬어. 처음부터 크게 하기보다 조금씩 맞춰가는 편이 자연스러울 수 있어.',
    evidenceRefs,
    confidence: 'direct',
  };
}

/**
 * 갈등 힌트(§24) — 실제 friction이 있을 때만 만든다. '호감 전략'처럼 보이면 안 되므로
 * 항상 '나중에 참고할 부분'으로만 표현한다.
 */
function conflictHint(target: TargetProfile, compatibility: CompatibilityResult | null): ApproachHint | null {
  if (target.conflict === 'x' || !compatibility) return null;
  const isFriction = compatibility.frictionSignals.some((signal) => signal.key === 'conflict');
  if (!isFriction) return null;

  return {
    id: hintId('communication'),
    kind: 'communication',
    title: '나중에 의견이 다를 때 참고할 부분',
    rationale:
      '갈등 상황에서 반응하는 방식이 너와는 조금 달라 보여. 지금 당장 맞출 일은 아니지만, 나중에 의견이 다를 때는 이 차이를 먼저 떠올려보는 게 도움이 될 수 있어.',
    evidenceRefs: [{ type: 'conflict', value: target.conflict }],
    confidence: 'contextual',
    caution: '지금 관계 단계에서 미리 걱정할 필요는 없어 — 참고만 해둬.',
  };
}

/** 근거가 부족할 때 조언 대신 질문을 제안한다(§29~§31) */
function askInterestHint(): ApproachHint {
  return {
    id: hintId('conversation'),
    kind: 'conversation',
    title: '좋아하는 걸 먼저 물어봐',
    rationale:
      '아직 이 사람이 좋아하는 걸 많이 알진 못하네. "요즘 쉬는 날엔 뭐 하는 게 제일 좋아?" 정도로 가볍게 물어보면, 다음에 더 구체적인 힌트를 만들 수 있어.',
    evidenceRefs: [],
    confidence: 'contextual',
  };
}

/**
 * '다가가는 힌트' 최대 3개를 만든다.
 *
 * @param compatibility 갈등 힌트(§24)가 실제 friction 여부를 판단하는 데만 쓴다 —
 *   Compatibility Score 자체는 여기서 절대 다시 계산하거나 바꾸지 않는다(§11).
 */
export function buildApproachHints(
  target: TargetProfile,
  compatibility: CompatibilityResult | null,
): ApproachHint[] {
  const direct = [activityHint(target), paceHint(target), affectionHint(target)].filter(
    (hint): hint is ApproachHint => hint !== null,
  );
  const friction = conflictHint(target, compatibility);

  const hints = [...direct, ...(friction ? [friction] : [])];

  // §30 — 정보가 적을수록 질문으로 바꾼다. 좋아하는 것을 하나도 모르면, 자리가 남는 한
  // 맨 앞에 '물어봐' 힌트를 끼워 넣는다(조언보다 질문이 우선이라는 원칙).
  if (target.preferences.interests.length === 0 && hints.length < MAX_HINTS) {
    hints.unshift(askInterestHint());
  }

  // 위 규칙상 interests가 0개면 항상 '물어볼 것' 힌트가 최소 1개 들어간다(§29~§31) —
  // 그래서 이 함수는 사실상 빈 배열을 반환하지 않는다. 그래도 화면(§29 "숨기거나
  // 안내 문구")은 빈 배열 케이스를 여전히 방어적으로 처리한다 — 이 불변조건이 나중에
  // 깨지더라도 화면이 조용히 깨지지 않게.
  return hints.slice(0, MAX_HINTS);
}
