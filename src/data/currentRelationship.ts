import type { CurrentSignalAnswer, MirrorAxisKey } from '@/types';

/**
 * Current Relationship Me — 지금 관계 질문 (S30 · v1.41 · §39.6~§39.7)
 *
 * ══ 이 파일이 지키는 규칙 ═══════════════════════════════════════════════════
 *
 * **① 관찰 가능한 행동/반응만 묻는다.** 주어가 전부 나다.
 *
 * ```
 * 가능   서운한 일이 생겼을 때 실제로 어떻게 해?
 * 가능   혼자 있고 싶은 순간이 생기면 어떻게 하는 편이야?
 * 금지   이 관계는 건강해?
 * 금지   상대는 회피형이야?
 * 금지   상대가 너를 사랑한다고 느껴?
 * ```
 *
 * 금지 쪽 세 문장은 전부 **상대의 마음이나 관계의 등급**을 묻는다. 이 제품은 상대의
 * 행동도 마음도 받지 않으므로(상대에 대해 받는 것은 S19의 4축 = 사용자가 아는 만큼
 * 알려준 값뿐), 그걸 물으면 대답을 근거로 쓸 수 없거나 근거 없는 진단이 된다.
 *
 * **② 다섯 질문이 모두 같은 것을 묻는다 — `이 축이 지금 실제로 얼마나 드러나는가`.**
 *
 * 이게 이 파일에서 가장 중요한 결정이다. 축마다 다른 차원을 물으면(연락은 빈도,
 * 갈등은 방향, 개인 시간은 확보량) 답을 하나의 `EvidenceStrength`로 옮길 수 없고,
 * 옮기는 순간 **매핑 방향을 사람이 직관으로 정하게 된다** — 예를 들어 `싸우면 바로
 * 말한다`가 갈등 축의 근거가 강하다는 뜻인지 약하다는 뜻인지 정할 근거가 없다.
 * Mirror가 이미 쓰는 축(`말한 기준보다 실제로 더 크게 반응하는가`)과 **같은 차원**을
 * 물으면 매핑이 자동으로 결정된다.
 *
 * **③ 자유서술을 받지 않는다.** History Snapshot에 얼려야 하는 값이고(§39.14),
 * 자유서술을 넣으면 기록이 사람에 대한 메모가 된다.
 *
 * **④ 4지선다이고, 마지막은 항상 `아직 그런 상황이 없었어`다.** '모르겠어'를 넣지
 * 않으면 사용자가 없던 장면을 골라야 하고, 그건 우리가 만든 거짓 근거다.
 */

export interface CurrentSignalOption {
  readonly value: CurrentSignalAnswer;
  readonly label: string;
}

export interface CurrentSignalQuestion {
  readonly axis: MirrorAxisKey;
  /** 화면 라벨 — Mirror 축 라벨과 같은 단어를 쓴다 */
  readonly label: string;
  readonly question: string;
  readonly options: readonly CurrentSignalOption[];
}

/** 마지막 보기는 다섯 축이 같은 문장을 쓴다 — 같은 뜻이므로 다르게 쓰지 않는다 */
const NO_SITUATION: CurrentSignalOption = { value: 'unsure', label: '아직 그런 상황이 없었어' };

/**
 * 축 순서는 `MIRROR_AXES`와 다르다 — S30은 사용자가 **가장 자주 겪는 장면**부터
 * 묻는다(연락 → 갈등 → 개인 시간 → 애정 표현 → 취미). Mirror 표시 순서는 그대로다.
 */
export const CURRENT_SIGNAL_QUESTIONS: readonly CurrentSignalQuestion[] = [
  {
    axis: 'contact',
    label: '연락',
    question: '연락이 뜸해지면 지금은 실제로 어떤 편이야?',
    options: [
      { value: 'often', label: '바로 알아차리고 마음이 쓰여' },
      { value: 'sometimes', label: '알아차리긴 하는데 그냥 넘어가기도 해' },
      { value: 'rarely', label: '거의 신경 쓰이지 않아' },
      NO_SITUATION,
    ],
  },
  {
    axis: 'conflict',
    label: '갈등 해결',
    question: '서운한 일이 생겼을 때 지금은 실제로 어떻게 해?',
    options: [
      { value: 'often', label: '그냥 넘기지 못하고 꼭 이야기하게 돼' },
      { value: 'sometimes', label: '이야기하기도 하고 넘어가기도 해' },
      { value: 'rarely', label: '대체로 그냥 넘어가' },
      NO_SITUATION,
    ],
  },
  {
    axis: 'alone',
    label: '개인 시간',
    question: '혼자 있고 싶은 순간이 생기면 지금은 어떻게 하는 편이야?',
    options: [
      { value: 'often', label: '시간을 만들어서라도 꼭 확보해' },
      { value: 'sometimes', label: '가능하면 챙기지만 못 챙기기도 해' },
      { value: 'rarely', label: '따로 챙기지는 않아' },
      NO_SITUATION,
    ],
  },
  {
    axis: 'affection',
    label: '애정 표현',
    question: '애정 표현에 대해 지금은 실제로 어떤 편이야?',
    options: [
      { value: 'often', label: '표현이 없으면 금방 허전해져' },
      { value: 'sometimes', label: '있으면 좋고 없어도 지낼 만해' },
      { value: 'rarely', label: '표현 자체를 크게 의식하지 않아' },
      NO_SITUATION,
    ],
  },
  {
    axis: 'hobby',
    label: '취미 공유',
    question: '좋아하는 걸 같이 하는 것에 대해 지금은 어떤 편이야?',
    options: [
      { value: 'often', label: '같이 하고 싶어서 먼저 제안하는 편' },
      { value: 'sometimes', label: '같이 하면 좋고 따로도 괜찮아' },
      { value: 'rarely', label: '각자 하는 게 편해' },
      NO_SITUATION,
    ],
  },
];

/**
 * 사용자가 고른 보기 라벨. 근거 문장·History Snapshot이 **사용자가 실제로 본 문장**을
 * 그대로 쓰기 위해 필요하다 — v1.36이 `DECLARED_PHRASE` 고정값에서 배운 것이다.
 */
export function currentSignalLabel(
  axis: MirrorAxisKey,
  answer: CurrentSignalAnswer,
): string | null {
  const question = CURRENT_SIGNAL_QUESTIONS.find((item) => item.axis === axis);
  return question?.options.find((option) => option.value === answer)?.label ?? null;
}

export function currentSignalQuestionOf(axis: MirrorAxisKey): CurrentSignalQuestion | null {
  return CURRENT_SIGNAL_QUESTIONS.find((item) => item.axis === axis) ?? null;
}

/** dev fixture Route가 허용값을 **화면과 같은 모듈에서** 읽게 한다 (v1.40.1 §38.5) */
export const CURRENT_SIGNAL_VALUES: readonly CurrentSignalAnswer[] = [
  'often',
  'sometimes',
  'rarely',
  'unsure',
];
