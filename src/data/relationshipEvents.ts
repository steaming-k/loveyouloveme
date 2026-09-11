import type { RelationshipEventType } from '@/types';

/**
 * User-reported Relationship Event 선택지 (v1.46 · §6~§9)
 *
 * ══ 이 목록이 지키는 규칙 ═══════════════════════════════════════════════════
 *
 * > **결론을 고르게 하지 않는다.**
 *
 * `상대가 나를 좋아한다` · `밀당 중이다` · `상대가 회피형이다` 같은 항목은 없고
 * 앞으로도 만들지 않는다(§7 · §35). 모든 라벨의 주어는 **사용자의 기억**이다 —
 * `호감이 느껴졌던 순간`은 사용자가 그렇게 느꼈다는 뜻이고, 상대가 호감을 가졌다는
 * 뜻이 아니다. 그 구분이 라벨에서 사라지면 아래 `lib/logic/relationshipEvents.ts`의
 * FACT/INTERPRETATION 경계도 함께 무너진다.
 *
 * ⚠️ 이 파일은 순수 데이터만 담는다. 판정·문장 생성은 `lib/logic/relationshipEvents.ts`.
 */

/**
 * 종류 → 라벨. **exhaustive `Record`다** — 타입에 멤버가 추가되면 `tsc`가 여기를
 * 채우라고 막고, `sessionSanitize`의 복원 검사 범위도 자동으로 함께 넓어진다
 * (v1.44 BUG-002가 세운 방식 그대로: enum 배열을 복사해두지 않는다).
 */
export const RELATIONSHIP_EVENT_LABEL: Record<RelationshipEventType, string> = {
  affection_felt: '호감이 느껴졌던 순간',
  conflict: '갈등 · 서운했던 일',
  contact_change: '연락의 변화',
  closer: '가까워졌다고 느낀 순간',
  distance: '거리감이 느껴진 순간',
  care_received: '배려 · 도움을 받은 일',
  meeting: '약속 · 만남과 관련된 일',
  other: '기타',
};

/** 화면에 보이는 순서. `RELATIONSHIP_EVENT_LABEL`의 키 순서와 같다 */
export const RELATIONSHIP_EVENT_OPTIONS: readonly {
  value: RelationshipEventType;
  label: string;
}[] = (Object.keys(RELATIONSHIP_EVENT_LABEL) as RelationshipEventType[]).map((value) => ({
  value,
  label: RELATIONSHIP_EVENT_LABEL[value],
}));

/**
 * 종류별 입력 도움말. **예시를 사건으로 확정하지 않는다** — placeholder일 뿐이다.
 *
 * ⚠️ 도움말에도 상대의 의도를 넣지 않는다. `상대가 일부러 답을 늦게 했어`가 아니라
 * `답장이 하루 정도 늦어졌어`다 — 사용자가 관찰한 것까지가 예시의 범위다.
 */
export const RELATIONSHIP_EVENT_PLACEHOLDER: Record<RelationshipEventType, string> = {
  affection_felt: '예) 먼저 안부를 물어봐 줬어',
  conflict: '예) 약속 시간 얘기로 서운했던 일이 있었어',
  contact_change: '예) 답장 간격이 하루 정도 길어졌어',
  closer: '예) 처음으로 오래 통화했어',
  distance: '예) 주말 약속을 미루게 됐어',
  care_received: '예) 아플 때 챙겨줬어',
  meeting: '예) 먼저 만나자고 제안했어',
  other: '예) 기억에 남는 장면을 짧게 적어줘',
};

/**
 * 최대 개수 (§9).
 *
 * 3개인 이유는 분량이 아니라 **성격**이다: 입력 피로를 막고, 가장 기억나는 장면에
 * 집중하게 하고, 관계 일지/CRM으로 확장되는 문을 닫아둔다. 상한을 늘리는 변경은
 * 그 세 이유를 먼저 뒤집어야 한다.
 */
export const RELATIONSHIP_EVENT_MAX = 3;

/** 무슨 일이 있었어? — 한 줄로 기억되는 길이까지만 */
export const RELATIONSHIP_EVENT_DESCRIPTION_MAX_LENGTH = 80;

/** 그때 나는 어떻게 반응했어? — 선택 입력 */
export const RELATIONSHIP_EVENT_REACTION_MAX_LENGTH = 60;
