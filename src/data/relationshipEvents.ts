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
 * ══ v1.46.4 §5 · §6 — **사용자-facing 상한을 없앴다** ═══════════════════════
 *
 * v1.46은 `RELATIONSHIP_EVENT_MAX = 3`이었고 그 이유를 세 줄로 적어뒀다: 입력 피로,
 * 집중, 관계 일지/CRM 확장 차단. 그 셋 중 **두 개는 상한이 아니라 UI가 푸는 문제**다.
 *
 * ```
 * 입력 피로   → 접기/펼치기와 '선택 입력' 카피가 푼다. 3개로 막는 것은 피로가 아니라
 *               쓰고 싶은 사람을 막는 것이다
 * 집중        → 결과가 모든 장면을 나열하지 않으면 된다. 실제로 이번 버전의
 *               `eventRelevance`는 Insight마다 상위 2~4개만 고른다
 * 일지/CRM    → 이건 여전히 유효하다. 그래서 **날짜·장소·상대 이름은 계속 받지 않는다**
 *               (§8). 막아야 하는 것은 개수가 아니라 필드였다
 * ```
 *
 * 그래서 상한의 **성격**이 바뀌었다:
 *
 * ```
 * 예전   UX hard cap      "3개까지만 받을게"          ← 제품이 정한 숫자
 * 지금   technical guard  브라우저 저장소를 지키는 선  ← 사용자가 만날 일이 거의 없는 숫자
 * ```
 *
 * ⚠️ **이 숫자를 화면에 미리 알리지 않는다**(§6). `N개까지만`이라고 먼저 말하는 순간
 * 그건 다시 UX cap이 된다. 임계에 실제로 닿았을 때만 말한다.
 */

/**
 * 저장 개수의 **기술적** 상한.
 *
 * 100인 근거는 실측이다. 이 서비스의 세션은 `lym.session.v1` 키 하나에 통째로
 * 직렬화된다(`state/SessionProvider.ts` · `serialize`). 고데이터 세션(기록 3건 ·
 * 사진 관찰 · deep answers 포함)의 직렬화 길이가 30~60KB 수준이고, 사건 하나는
 * 아래 길이 상한을 꽉 채워도 JSON에서 ~1.8KB다. 100개 = 약 180KB이고, 가장 보수적인
 * localStorage 할당량(5MB)의 4% 미만이다.
 *
 * ⚠️ **이 값이 quota 보호의 전부가 아니다.** 실제 보호는 저장 시점의
 * `QuotaExceededError`를 삼키지 않는 것이다(§6 마지막 줄) — `SessionProvider`의
 * `storageStatus`를 보라. 이 상수는 '한 세션이 비정상적으로 커지는 것'만 막는다.
 */
export const RELATIONSHIP_EVENT_SAFETY_MAX = 100;

/**
 * 저장소가 실제로 빠듯해지기 시작하는 선. 이 길이를 넘으면 화면이 **처음으로**
 * 사용자에게 말한다(그전에는 아무 말도 하지 않는다).
 *
 * 1.5MB는 5MB 할당량의 30%다. 남은 70%는 사진 관찰·기록이 더 쌓일 자리다.
 */
export const SESSION_STORAGE_SOFT_LIMIT_BYTES = 1_500_000;

/**
 * 무슨 일이 있었어? — **기술 guard일 뿐이다.**
 *
 * 80자였던 예전 값은 "한 줄로 기억되는 길이"라는 제품 판단이었다. 그런데 실제 UT에서
 * 사람들이 적고 싶어 한 것은 한 줄이 아니라 **장면**이었고("연락이 줄어서 마음이 식은
 * 줄 알았는데 알고 보니 시험기간이었어"는 80자를 넘는다), 80자에서 잘리면 근거로
 * 되짚을 때 의미가 왜곡된다(§10 마지막 줄).
 *
 * 500자는 '비정상적으로 큰 단일 입력'의 선이지 권장 길이가 아니다. 화면은 이 숫자를
 * 카운터로 보여주지 않는다 — 남은 글자를 세게 하면 그게 곧 UX cap이다.
 */
export const RELATIONSHIP_EVENT_DESCRIPTION_MAX_LENGTH = 500;

/** 그때 나는 어떻게 반응했어? — 선택 입력. 같은 성격의 technical guard다 */
export const RELATIONSHIP_EVENT_REACTION_MAX_LENGTH = 300;

/**
 * 한 화면에 한꺼번에 펼쳐 그리는 사건 수 (§40).
 *
 * 393×852에서 사건 20개를 전부 펼치면 스크롤이 그 섹션 하나로 가득 찬다. 목록은
 * **최근 것부터** 이만큼만 펼치고 나머지는 '더 보기'로 접는다 — 저장은 전부 하되
 * 화면 피로는 만들지 않는다.
 */
export const RELATIONSHIP_EVENT_VISIBLE_DEFAULT = 5;
