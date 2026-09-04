import type { AffectionStyle, ConflictStyle, HobbyStyle } from '@/types';
import type { LovyPose } from '@/data/lovy';

/**
 * Declared Me — Progressive Question Flow (S10~S13)
 * 한 화면에 하나(마지막만 두 개)의 질문만 둔다.
 */

export type DeclaredStep = 1 | 2 | 3 | 4;
export const DECLARED_STEPS: DeclaredStep[] = [1, 2, 3, 4];
export const DECLARED_TOTAL = 4;

interface ScaleQuestion {
  kind: 'scale';
  field: 'contact' | 'alone';
  title: readonly string[];
  description?: string;
  minLabel: string;
  maxLabel: string;
}

interface RowQuestion {
  kind: 'rows';
  field: 'conflict';
  title: readonly string[];
  options: readonly { value: ConflictStyle; label: string; description: string }[];
}

interface ChipQuestion {
  kind: 'chips';
  field: 'affection' | 'hobby';
  title: readonly string[];
  options: readonly { value: string; label: string }[];
}

export interface LovyNote {
  pose: LovyPose;
  size: number;
  message: string;
}

export interface DeclaredStepConfig {
  step: DeclaredStep;
  /** 상단 progress 라벨 */
  counter: string;
  /** 전체 프로필 빌딩 진행률 (%) — 와이어프레임 헤더 bar 값 */
  progress: number;
  questions: readonly (ScaleQuestion | RowQuestion | ChipQuestion)[];
  lovyNote?: LovyNote;
  /** 사진 관찰 기록과 비교해서 보여주는 보조 카드 */
  observedCompare?: { title: string; body: readonly string[] };
  /**
   * 내 MBTI 선택 섹션(Optional)을 이 화면에 붙일지.
   * Declared 질문과 같은 화면에 두지만 **필수 응답이 아니다** — 미선택이어도 '다음'을 막지 않는다.
   * 화면을 새로 늘리지 않기 위해 S13 안쪽 Optional Section으로 넣었다.
   */
  personalityLens?: { eyebrow: string; title: string; caption: string; skipLabel: string };
}

export const AFFECTION_OPTIONS: readonly { value: AffectionStyle; label: string }[] = [
  { value: 'a1', label: '담백한 편이 편해' },
  { value: 'a2', label: '적당히 주고받는 정도' },
  { value: 'a3', label: '자주 표현하는 게 좋아' },
];

export const HOBBY_OPTIONS: readonly { value: HobbyStyle; label: string }[] = [
  { value: 'h1', label: '각자 해도 괜찮아' },
  { value: 'h2', label: '가끔 같이 하면 좋아' },
  { value: 'h3', label: '거의 같이 하고 싶어' },
];

export const DECLARED_QUESTIONS: Record<DeclaredStep, DeclaredStepConfig> = {
  1: {
    step: 1,
    counter: '질문 1/4',
    progress: 36,
    questions: [
      {
        kind: 'scale',
        field: 'contact',
        title: ['연락은 너한테', '얼마나 중요해?'],
        description: '사진으로는 알 수 없는 부분이야.',
        minLabel: '거의 신경 안 씀',
        maxLabel: '매우 중요',
      },
    ],
    lovyNote: {
      pose: 'mug',
      size: 38,
      message: '지금 생각하는 기준으로 답해도 괜찮아. 나중에 실제 경험이랑 비교해볼 거니까.',
    },
  },
  2: {
    step: 2,
    counter: '질문 2/4',
    progress: 42,
    questions: [
      {
        kind: 'rows',
        field: 'conflict',
        title: ['싸우면 바로', '이야기하고 싶은 편이야?'],
        options: [
          { value: 'now', label: '오늘 안에 이야기하고 싶어', description: '해결되지 않은 상태가 불편한 편' },
          { value: 'soon', label: '잠깐 진정되면 이야기해', description: '몇 시간 정도는 필요' },
          { value: 'space', label: '혼자 정리한 뒤에 이야기해', description: '하루 이상 걸릴 수도 있음' },
        ],
      },
    ],
  },
  3: {
    step: 3,
    counter: '질문 3/4',
    progress: 48,
    questions: [
      {
        kind: 'scale',
        field: 'alone',
        title: ['혼자 있는 시간은', '얼마나 필요해?'],
        minLabel: '거의 필요 없음',
        maxLabel: '매일 필요',
      },
    ],
    observedCompare: {
      title: '러비의 관찰 기록과 비교',
      body: ['사진에서도 ', '혼자 보내는 시간', '이 관찰됐어. 지금 답변과 방향이 비슷해.'],
    },
  },
  4: {
    step: 4,
    counter: '질문 4/4',
    progress: 54,
    questions: [
      {
        kind: 'chips',
        field: 'affection',
        title: ['애정 표현은', '어느 정도가 편해?'],
        options: AFFECTION_OPTIONS,
      },
      {
        kind: 'chips',
        field: 'hobby',
        title: ['연인과 취미를', '같이 하는 건 중요해?'],
        options: HOBBY_OPTIONS,
      },
    ],
    personalityLens: {
      eyebrow: 'PERSONALITY LENS · 선택',
      title: '네 MBTI를 안다면 알려줘',
      caption:
        'MBTI는 관계를 판단하는 기준은 아니지만, 서로 다른 성향을 이야기해보는 참고 정보로 사용할게.',
      skipLabel: '잘 모르겠어',
    },
  },
};
