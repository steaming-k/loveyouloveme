import type { ObservedTrait } from '@/types';

/**
 * Observed Me — **샘플 세션 전용** 고정 관찰 데이터 (S09)
 *
 * ⚠️ v1.22 — 사용자에게 보이는 경로에서 이 배열을 쓰는 곳은 `buildSampleObservedResult()`
 * **한 곳**이다. 그 함수를 타는 경로는 `createSampleAnswers()` 뿐이고, 진입점은 dev 전용
 * `PrototypePanel`과 **S06 `/profile/intro`의 '샘플 답변으로 결과부터 볼게'** 두 곳이다.
 * 후자는 Production에서도 보이므로, 아래 문장은 **사용자가 샘플을 직접 선택하면 보인다**
 * (그때는 `DEMO AI` 배지 + '화면 확인용 샘플 세션' 안내가 함께 붙는다).
 *
 * ⚠️ v1.39 — import는 두 곳이다. 위 함수 외에 `/api/dev/history-test`(Production **404**)가
 * fixture 조립용으로 읽는다. 그 Route는 배포에 노출되지 않으므로 **사용자에게 보이는 경로는
 * 늘지 않았다**(기능명세서 §36.7). "한 곳에서만 쓰인다"고만 적혀 있어 사실과 어긋났던 주석을
 * 고친 것이고, 침투 경로가 생긴 것이 아니다.
 *
 * v1.21까지는 그와 별개로 **자기 사진을 올린 사용자에게도** 이 값이 결과로 나갔다.
 * 그래서 음식 사진만 올려도 '영화관·상영 시간표' 관찰이 보였다. 지금은 사진 내용을
 * 읽지 못하면 아무 관찰도 만들지 않는다(`buildDemoObservedResult`) — 업로드 경로와
 * 샘플 경로가 완전히 분리됐다.
 *
 * ⚠️ v1.37 — 근거 문장이 **샘플 타일 6장과 실제로 맞는지**를 기준으로 다시 썼다.
 * 예전에는 `영화관·상영 시간표가 담긴 사진이 반복적으로 관찰됐어`(영화관 타일은 1장뿐)와
 * `밖에서 찍은 사진이 절반 이상이었어`(2/6장)처럼 **집계·반복을 주장**했다. 고정 더미
 * 문장이라 어떤 사진을 골라도 같은 말이 나왔고, §8.5의 '반복은 실제로 겹칠 때만 말한다'와
 * 충돌했다. 샘플이라고 해서 없는 집계를 말해도 되는 건 아니다 — 사용자가 화면에서 보는
 * 것은 똑같은 러비의 관찰이다.
 *
 * 이제 각 문장은 `DEMO_PHOTO_IDS`(p1~p6: 주말 산책 · 영화관 좌석 · 집 책상 · 친구 2명 ·
 * 카페 혼자 · 등산)에서 **실제로 셀 수 있는 수**만 말하고, 그 수가 뒷받침하지 못하는
 * confidence는 낮췄다. `tests/run-history-fixtures.mjs`의 SO 절이 이 규칙을 고정한다.
 */
export const OBSERVED_TRAITS: readonly ObservedTrait[] = [
  {
    id: 'ob1',
    // 영화관 타일은 p2 하나뿐이다 — 한 장으로 'high'라고 말하지 않는다.
    text: '영화 보는 걸 좋아함',
    confidence: 'low',
    evidence: '영화관 좌석이 찍힌 사진이 1장 있었어. 한 장뿐이라 아직 확실하진 않아.',
  },
  {
    id: 'ob2',
    // p3 집 책상 + p5 카페 혼자 = 2장. 세어서 말할 수 있는 유일한 항목이다.
    text: '혼자 보내는 시간도 즐김',
    confidence: 'medium',
    evidence: '집 책상·카페처럼 혼자 있는 장면이 2장 있었어.',
  },
  {
    id: 'ob3',
    text: '소수의 사람과 깊게 만나는 편',
    confidence: 'low',
    evidence: '사람이 함께 찍힌 사진은 1장이고, 거기 2명이 있었어. 사진만으로는 확신하기 어려워.',
  },
  {
    id: 'ob4',
    // p1 산책 + p6 등산 = 2/6장. '많은 편'도 '절반 이상'도 이 수가 뒷받침하지 못한다.
    text: '밖에서 보내는 시간이 있음',
    confidence: 'medium',
    evidence: '산책·등산처럼 밖에서 찍은 사진이 2장 있었어.',
  },
] as const;

/** Relationship Profile(S18) 의 Observed Me 칩에 쓰는 짧은 라벨 */
export const OBSERVED_SHORT_LABEL: Record<string, string> = {
  ob1: '영화 감상',
  ob2: '혼자 있는 시간',
  ob3: '소수와 깊게',
  ob4: '밖에서 보낸 시간',
};
