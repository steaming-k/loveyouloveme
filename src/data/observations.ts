import type { ObservedTrait } from '@/types';

/**
 * Observed Me — **샘플 세션 전용** 고정 관찰 데이터 (S09)
 *
 * ⚠️ v1.22 — 이 배열은 이제 `buildSampleObservedResult()` **한 곳**에서만 쓰인다.
 * 그 함수를 타는 경로는 `createSampleAnswers()` 뿐이고, 진입점은 dev 전용
 * `PrototypePanel`과 **S06 `/profile/intro`의 '샘플 답변으로 결과부터 볼게'** 두 곳이다.
 * 후자는 Production에서도 보이므로, 아래 문장은 **사용자가 샘플을 직접 선택하면 보인다**
 * (그때는 `DEMO AI` 배지 + '화면 확인용 샘플 세션' 안내가 함께 붙는다).
 *
 * v1.21까지는 그와 별개로 **자기 사진을 올린 사용자에게도** 이 값이 결과로 나갔다.
 * 그래서 음식 사진만 올려도 '영화관·상영 시간표' 관찰이 보였다. 지금은 사진 내용을
 * 읽지 못하면 아무 관찰도 만들지 않는다(`buildDemoObservedResult`) — 업로드 경로와
 * 샘플 경로가 완전히 분리됐다.
 *
 * ⚠️ 아래 '반복적으로 관찰됐어'는 실제 집계 결과가 아닌 **고정 더미 문장**이다. 샘플
 * 경로에서도 반복 주장을 하지 않도록 문구를 다듬을지는 별도 판단이 필요하다(미결).
 */
export const OBSERVED_TRAITS: readonly ObservedTrait[] = [
  {
    id: 'ob1',
    text: '영화 보는 걸 좋아함',
    confidence: 'high',
    evidence: '영화관·상영 시간표가 담긴 사진이 반복적으로 관찰됐어.',
  },
  {
    id: 'ob2',
    text: '혼자 보내는 시간도 즐김',
    confidence: 'high',
    evidence: '카페·책상처럼 혼자 있는 장면이 여러 장에서 나왔어.',
  },
  {
    id: 'ob3',
    text: '소수의 사람과 깊게 만나는 편',
    confidence: 'low',
    evidence: '사진에 등장하는 인물 수가 적었어. 다만 사진만으로는 확신하기 어려워.',
  },
  {
    id: 'ob4',
    text: '주말 외부 활동이 많은 편',
    confidence: 'medium',
    evidence: '산책·등산처럼 밖에서 찍은 사진이 절반 이상이었어.',
  },
] as const;

/** Relationship Profile(S18) 의 Observed Me 칩에 쓰는 짧은 라벨 */
export const OBSERVED_SHORT_LABEL: Record<string, string> = {
  ob1: '영화 감상',
  ob2: '혼자 있는 시간',
  ob3: '소수와 깊게',
  ob4: '주말 외부 활동',
};
