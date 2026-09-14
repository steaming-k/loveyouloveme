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
  other: '예) 기억에 남는 일을 짧게 적어줘',
};

/**
 * ══ 상한의 세 종류를 갈라둔다 (v1.46.4 PRE-RELEASE HARDENING · PHASE 1) ═════
 *
 * v1.46.4 Candidate는 `RELATIONSHIP_EVENT_MAX = 3`을 `RELATIONSHIP_EVENT_SAFETY_MAX
 * = 100`으로 바꿨다. 이름은 `SAFETY`였지만 **성격은 여전히 제품 상한이었다**:
 * 그 값이 입력 화면(`full`)·추가 핸들러·복원 파서 세 곳을 동시에 막았고, 길이 상한
 * 500/300도 textarea의 `maxLength`로 내려와 사용자가 **더 못 쓰게** 만들고 있었다.
 *
 * 이 파일은 이제 세 가지를 이름부터 구분한다.
 *
 * ```
 * A  PRODUCT LIMIT           제거했다. 정상 입력을 막는 숫자는 없다
 * B  STORAGE BUDGET          직렬화 바이트 기준. 한계에 가까워질 때만 말한다
 * C  PARSER SAFETY GUARD     조작·손상된 저장 데이터 방어. UI로는 도달할 수 없다
 * ```
 *
 * ⚠️ **B와 C는 상수를 공유하지 않는다.** 공유하면 한쪽을 조정할 때 다른 쪽이 따라
 * 움직이고, 그러면 '저장소를 지키는 선'과 '제품이 정한 선'이 다시 한 몸이 된다 —
 * 이번에 푼 문제가 정확히 그것이다.
 *
 * ⚠️ **A를 되살리지 마라.** 정상 입력을 `slice`로 조용히 자르거나 개수로 막는 코드가
 * 생기면 `tests/run-event-fixtures.mjs`의 EVENT-LIMIT-01 · 04 · 12가 실패한다.
 */

/* ── B. STORAGE BUDGET ─────────────────────────────────────────────────── */

/**
 * 세션 직렬화 결과가 이 바이트를 넘으면 **처음으로** 사용자에게 말한다.
 *
 * 3MB인 근거: 가장 보수적인 localStorage 할당량이 오리진당 5MB이고, 그 60%를 넘으면
 * 남은 여유가 사진 관찰·기록 몇 건 분량이다. 그 아래에서는 아무 말도 하지 않는다 —
 * 평소에 상한을 보여주면 그게 곧 제품 상한이다(A).
 *
 * ⚠️ **UTF-8 바이트로 잰다.** Candidate에서는 `payload.length`(UTF-16 코드 유닛)를
 * 썼는데, 한글은 UTF-8에서 글자당 3바이트라 실제 사용량을 3배 과소평가했다.
 */
export const SESSION_STORAGE_NEAR_LIMIT_BYTES = 3_000_000;

/* ── C. PARSER SAFETY GUARD ────────────────────────────────────────────── */

/**
 * 저장된 세션에서 **복원할 사건의 최대 개수.**
 *
 * ⚠️ 이것은 제품 한계가 아니다. 정상 UI로 1,000개를 입력하려면 한 건당 5초로 잡아도
 * 1시간 20분이 걸리고, 그전에 `SESSION_STORAGE_NEAR_LIMIT_BYTES` 안내가 먼저 뜬다.
 * 이 선에 닿는 데이터는 사실상 조작되었거나 손상된 것이다.
 *
 * ⚠️ **넘친 항목은 버리되 조용히 버리지 않는다.** `sanitizeRelationshipEvents`가
 * 버린 개수를 함께 돌려주고, 화면이 그 사실을 말한다(PHASE 1-1).
 */
export const RELATIONSHIP_EVENT_PARSER_SAFETY_MAX = 1000;

/**
 * 저장된 사건 한 건의 자유 입력 필드가 이보다 길면 **그 항목을 버린다.**
 *
 * ⚠️ **자르지 않는다.** 20,000자짜리 문장을 앞에서 잘라 저장하면 사용자가 쓰지 않은
 * 문장이 근거로 인용된다 — 의미 왜곡이고, 이번 hardening이 없애기로 한 silent
 * truncation의 가장 나쁜 형태다. 버리고 말하는 쪽이 정직하다.
 *
 * 20,000자는 A4 약 10장이다. 한 장면을 그만큼 적는 사람은 없다.
 */
export const RELATIONSHIP_EVENT_PARSER_FIELD_SAFETY_MAX = 20_000;

/* ── 표현 계층 ─────────────────────────────────────────────────────────── */

/**
 * 한 화면에 한꺼번에 펼쳐 그리는 사건 수 (§40).
 *
 * ⚠️ **저장·입력 상한이 아니다.** 목록을 접는 표현 규칙일 뿐이고, 접힌 장면도
 * 근거 후보로 그대로 살아 있다. 393×852에서 사건 20개를 전부 펼치면 입력 폼이
 * 화면 밖으로 밀려나므로(PHASE 2 실측) 최근 것부터 이만큼만 펼친다.
 */
export const RELATIONSHIP_EVENT_VISIBLE_DEFAULT = 5;
