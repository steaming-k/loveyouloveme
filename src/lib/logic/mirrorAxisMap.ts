import type { MirrorAxisKey } from '@/types';

/**
 * S16 `hardest` → Mirror 축 매핑.
 *
 * v1.41에서 `mirror.ts`에서 **이 파일로 옮겼다.** 이유는 하나뿐이다:
 * `relationshipEvidence.ts`(Resolver)가 이 표를 읽어야 하고 `mirror.ts`가 Resolver를
 * 읽으므로, 표가 `mirror.ts`에 남아 있으면 순환 import가 된다. 표 자체는 **한 글자도
 * 바뀌지 않았고**, `mirror.ts`가 그대로 re-export하므로 기존 import 경로
 * (`from './mirror'`)도 전부 그대로 동작한다.
 *
 * ⚠️ **`value_gap`이 없는 것은 실수가 아니다** (v1.40.1 §38.8 Audit · v1.41 §39.3에서
 * 재확인). `MIRROR_AXES`는 개인 시간·연락·취미 공유·갈등 해결·애정 표현 5개이고,
 * S16의 `기준이 다르다고 느낄 때`(돈·미래·생활 방식)는 그중 어디에도 해당하지 않는다.
 *
 * `conflict`나 `alone`에 억지로 매핑하면 사용자가 '돈·미래' 때문에 힘들었다고 답한
 * 것을 '갈등 해결' 근거로 바꿔 쓰는 것이다 — 비대칭을 없애는 게 아니라 **근거를
 * 왜곡하는 것**이고 §1.5 규칙 1을 어긴다. v1.41도 매핑하지 않는다.
 *
 * 다만 v1.41에서 **결과 하나가 달라졌다**: `value_gap`을 고른 사용자도 S30에서 그
 * 축들에 답하면 `scope: 'current'` 근거를 갖는다. `value_gap` 자체가 축을 얻은 게
 * 아니고, **다른 시점의 다른 질문이 그 축을 덮은 것**이다(§39.3).
 */
export const HARDEST_TO_AXIS: Partial<Record<string, MirrorAxisKey>> = {
  contact_drop: 'contact',
  fight_silence: 'conflict',
  no_time: 'alone',
};
