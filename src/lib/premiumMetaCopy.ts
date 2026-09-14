import { withCompanionParticle, withObjectParticle } from '@/lib/korean';
import type { PremiumSourceGroup, RelationshipTense } from '@/types';

/**
 * v1.46.4 Meta Copy — Premium 리포트가 **무엇을 같이 봤는지**를 사용자 언어로 부른다.
 *
 * 예전 화면은 개수를 셌다:
 *
 * ```
 * 헤더          이은 자료 7종
 * Chapter 목록  자료 4종
 * ```
 *
 * 숫자는 '많이 봤다'만 말하고 **무엇을** 봤는지는 말하지 않는다. 그리고 `자료`는
 * 분석기의 말이다 — 사용자는 자료를 낸 적이 없고, 기준을 답하고 장면을 적었다.
 *
 * ⚠️ **없는 source를 부르지 않는다.** 입력은 실제 Chapter의 `sourceGroups`와 실제로
 * 그려지는 장면 유무뿐이다. 판정·근거 조합·순서는 여기서 바뀌지 않는다(copy-only).
 */

/*
  ⚠️ `compatibility`(동기화율 비교)도 `상대에 대해 적은 내용`으로 부른다. 사용자에게 그
  비교의 재료는 결국 상대에 대해 자기가 적은 답이고, 두 이름을 나란히 두면 같은 입력을
  두 번 본 것처럼 읽힌다(브라우저 실측). 개수를 세지 않으므로 합쳐도 거짓이 되지 않는다.
*/
const GROUP_LABEL: Record<PremiumSourceGroup, string> = {
  declared_me: '네가 말한 기준',
  observed_me: '사진에서 보인 것',
  past_relationship: '예전 관계 경험',
  current_relationship: '지금 관계에서의 답변',
  target: '상대에 대해 적은 내용',
  compatibility: '상대에 대해 적은 내용',
  history: '예전 기록',
  lens: '성향 렌즈',
};

/** 사용자가 직접 입력했다고 기억하기 쉬운 순서. 접힌 헤더는 앞에서부터 이만큼만 부른다 */
const GROUP_ORDER: readonly PremiumSourceGroup[] = [
  'declared_me',
  'target',
  'compatibility',
  'current_relationship',
  'past_relationship',
  'history',
  'observed_me',
  'lens',
];
const CHAPTER_LINE_MAX = 3;

/** Chapter 헤더의 source 라벨. 시점을 말하는 라벨은 끝난 관계에서 다르게 부른다 */
export function userSourceGroupLabel(group: PremiumSourceGroup, tense: RelationshipTense): string {
  if (group === 'current_relationship' && tense === 'former') return '그때 관계에서의 답변';
  return GROUP_LABEL[group];
}

/**
 * Chapter 하나가 본 것 — 같은 이름은 한 번만, **최대 3개.**
 *
 * ⚠️ 나머지를 `외 N개`로 세지 않는다(개수 강조 금지). 전체 근거는 펼친 뒤 `왜 이렇게
 * 봤어?` 토글 안에 그대로 있다. 접힌 헤더는 393px에서 두 줄 안이어야 목록으로 읽힌다.
 */
export function chapterSourceLine(
  groups: readonly PremiumSourceGroup[],
  tense: RelationshipTense,
): string {
  const ordered = [...new Set(groups)].sort(
    (a, b) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b),
  );
  return [...new Set(ordered.map((group) => userSourceGroupLabel(group, tense)))]
    .slice(0, CHAPTER_LINE_MAX)
    .join(' · ');
}

/**
 * 리포트 헤더 한 문장.
 *
 * ⚠️ 전부 나열하지 않는다. 사용자가 **직접 적었다고 기억하는 것** 네 가지(기준 · 상대 ·
 * 장면 · 예전 기록)만 부르고, Target이 없으면 '지금 관계에서의 답변'으로 대신한다.
 * 393px에서 두 줄을 넘지 않는 길이다(최대 4개).
 */
export function reportLookedAtLine(input: {
  groups: readonly PremiumSourceGroup[];
  hasScenes: boolean;
  tense: RelationshipTense;
}): string | null {
  /* 이어서 본 Chapter가 없으면(Sparse) '같이 봤다'고 말할 것이 없다 — 문장을 내지 않는다 */
  if (input.groups.length === 0) return null;
  const groups = new Set(input.groups);
  const hasTarget = groups.has('target') || groups.has('compatibility');
  const parts: string[] = [];

  if (hasTarget) {
    if (groups.has('declared_me')) parts.push('네 기준');
    parts.push('상대에 대해 적은 내용');
  } else {
    if (groups.has('declared_me')) parts.push('네가 말한 기준');
    if (groups.has('current_relationship')) {
      parts.push(input.tense === 'former' ? '그때 관계에서의 답변' : '지금 관계에서의 답변');
    }
  }
  /* 260914 P2-7 — 입력 화면과 같은 이름('기억나는 사건') */
  if (input.hasScenes) parts.push('기억나는 사건');
  if (groups.has('history')) parts.push('예전 기록');

  if (parts.length === 0) return null;
  if (parts.length === 1) return `${withObjectParticle(parts[0]!)} 중심으로 봤어.`;
  if (parts.length === 2) {
    return `${withCompanionParticle(parts[0]!)} ${withObjectParticle(parts[1]!)} 같이 봤어.`;
  }
  const last = parts[parts.length - 1]!;
  return `${parts.slice(0, -1).join(', ')}, ${withObjectParticle(last)} 같이 봤어.`;
}
