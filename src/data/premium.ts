import type { PremiumFeatureId, PremiumSource } from '@/types';

/**
 * Premium Feature 카탈로그 + 문구
 *
 * 문구 원칙(§41):
 *   ⭕ '조금 더 깊게 볼까?' · '무료 결과보다 상세한 근거와 상황을 볼 수 있어.'
 *      '상세 분석 1회 · ₩1,900' · '현재 상세 분석은 준비 중이야.'
 *   ❌ '지금 안 보면 놓쳐' · '반드시 필요한 분석' · '관계 성공률을 높여줘'
 *      '90% 정확' · 'Premium이면 더 정확' · 정가/할인/이번 주만
 *
 * Premium은 '더 정확한 분석'이 아니라 **같은 데이터의 더 깊은 해상도**다.
 */

interface PremiumFeatureDefinition {
  id: PremiumFeatureId;
  source: PremiumSource;
  title: string;
  description: string;
  /** 무료에서 이미 본 것 */
  freeRecap: readonly string[];
  /** 상세에서 추가되는 것 */
  additions: readonly string[];
}

export const PREMIUM_FEATURES: Record<PremiumFeatureId, PremiumFeatureDefinition> = {
  compatibility_detail: {
    id: 'compatibility_detail',
    source: 'compatibility',
    title: '궁합 상세 분석',
    description: '둘 사이의 차이를 실제 관계 상황까지 조금 더 깊게 볼 수 있어.',
    freeRecap: ['동기화율', '대표 잘 맞는 신호 1개', '대표 관찰 필요한 신호 1개'],
    additions: [
      '4개 관계 신호 축별 상세 차이',
      '실제 갈등·대화 상황 예시',
      '상대와 확인해볼 질문',
      '과거 관찰 기록과 연결한 관찰 포인트',
      '러비의 상세 해석',
    ],
  },
  mirror_detail: {
    id: 'mirror_detail',
    source: 'mirror',
    title: 'Relationship Mirror 상세',
    description: '판정된 축을 하나씩, 근거까지 펼쳐서 볼 수 있어.',
    freeRecap: ['핵심 GAP/MATCH/CHANGE', 'Core Insight', '기본 근거'],
    additions: [
      '판정된 모든 축의 상세 해석',
      '추가 질문(Adaptive) 응답까지 포함한 심화 근거',
      '과거 기록과 연결한 반복·변화 해석',
      '축별로 관찰해볼 포인트',
    ],
  },
  history_detail: {
    id: 'history_detail',
    source: 'history',
    title: '변화 리포트 상세',
    description: '기록 사이의 변화를 더 길게, 반복 신호까지 펼쳐서 볼 수 있어.',
    freeRecap: ['관찰 기록 저장·타임라인', '기본 변화 요약', '반복 신호 목록'],
    additions: [
      '축별 변화 상세 해석',
      '반복 신호가 나타난 기록 간 연결 설명',
      '다음 관계에서 확인할 기준',
    ],
  },
  mbti_detail: {
    id: 'mbti_detail',
    source: 'mbti',
    title: 'MBTI 렌즈 상세',
    description: '4개 선호 축을 실제 관계 신호와 나란히 놓고 볼 수 있어.',
    freeRecap: ['4축 비교 요약', '비슷/다른 성향 라벨'],
    additions: [
      '4축 상세 설명',
      '실제 관계 신호와 함께 비교할 질문',
      '대화 주제 확장',
    ],
  },
  astrology_detail: {
    id: 'astrology_detail',
    source: 'astrology',
    title: '별자리 렌즈 상세',
    description: '태양궁 해석과 두 사람의 원소 비교를 조금 더 길게 볼 수 있어.',
    freeRecap: ['태양궁 기본 해석', '비슷/다르게 읽힐 수 있는 부분'],
    additions: ['태양궁 상세 해석', '두 사람 원소 비교 확장', '대화 주제 확장'],
  },
  /**
   * ⚠️ 사주 상세는 계산 엔진이 없어 항상 `unavailable`이다(§21/§40).
   * 유료 CTA를 붙이지 않는다 — 돈을 내면 사주 상세가 나올 것처럼 보이면 안 된다.
   * additions를 비워둔 것도 의도적이다: 팔 수 있는 것이 아직 없다.
   */
  saju_detail: {
    id: 'saju_detail',
    source: 'saju',
    title: '사주 렌즈 상세',
    description: '사주 명식 기반 해석.',
    freeRecap: [],
    additions: [],
  },
  /**
   * v1.9 — 궁합/Mirror/변화 리포트 진입점을 하나로 모은 flagship Premium.
   * ⚠️ '더 긴 AI 설명'이 아니다 — 따로 있던 데이터를 연결했을 때만 보이는 신호를 판다(§55).
   */
  relationship_deep_report: {
    id: 'relationship_deep_report',
    source: 'compatibility',
    title: '정밀 관찰 리포트',
    description: '따로 답했던 것들을 연결해서 보면, 너 혼자서는 못 봤을 신호가 보여.',
    freeRecap: [
      '동기화율',
      '대표 잘 맞는 신호 1개',
      'Relationship Mirror 핵심 판정',
      '기본 변화 요약',
    ],
    additions: [
      '서로 다른 데이터를 연결해서만 보이는 Cross-source Insight',
      'Relationship Self 심화 해석',
      '4축 궁합 심화 비교',
      '실제 벌어질 수 있는 상황 시뮬레이션',
      '상대 취향과 내 관계 방식을 연결한 다가가는 힌트',
      '너에게 맞춰 고른 추가 질문',
      '과거 기록과 지금을 나란히 놓은 비교',
      '러비의 최종 관찰',
    ],
  },
};

export const PREMIUM_COPY = {
  badge: 'DETAIL REPORT',
  entryLabel: 'PREMIUM DETAIL',
  entryCta: '상세 분석 보기',

  paywallTitle: ['여기부터는', '조금 더 깊게'],
  paywallLovy: '여기부터는 조금 더 깊게 관찰한 내용이야. 무료로 본 결과가 사라지는 건 아니야.',
  freeRecapLabel: '무료로 본 내용',
  additionsLabel: '상세 분석에서 추가되는 내용',
  purchaseCta: '상세 분석 열기',
  dismissCta: '지금은 괜찮아',
  /** 1회 결제 후보임을 명확히 — 구독으로 오해되면 안 된다(§25) */
  priceNote: '상세 분석 1회 · 구독 아님',

  /** Fake Door reveal — 결제가 가능한 것처럼 표시하지 않는다(§2/§13) */
  fakeDoorTitle: '상세 분석은 지금 준비 중이야',
  fakeDoorBody:
    '아직 결제도, 상세 리포트도 연결 전이야. 방금 누른 건 결제가 아니라 관심 표시로만 기록했어.',
  notifyCta: '출시되면 알려줘',
  notifyDoneLabel: '관심 표시했어',
  notifyNote: '지금은 알림 기능도 연결 전이라 관심 표시만 기록할게. 연락처는 받지 않아.',
  fakeDoorDismiss: '괜찮아',

  unavailableTitle: '이 상세 렌즈는 아직 준비 중이야',

  /** Demo AI일 때 상세도 규칙 기반이라는 사실을 숨기지 않는다(§22) */
  demoNotice: '상세 분석도 규칙 기반 데모 응답이야. 실제 AI 개인화 결과가 아니야.',
} as const;

/**
 * v1.9 §29 — Relationship Deep Report 전용 문구.
 * 기존 PREMIUM_COPY(궁합/Mirror/History 개별 상세)는 그대로 두고, 이 리포트만 따로 둔다 —
 * "더 긴 설명을 판다"가 아니라 "더 연결해서 본다"는 차이를 문구에서부터 지킨다.
 */
export const DEEP_REPORT_COPY = {
  entryLabel: 'PRECISION REPORT',
  entryCta: '정밀 관찰 리포트 보기',

  paywallTitle: ['러비가 조금 더', '연결해서 본 게 있어'],
  paywallLovy:
    '네가 따로 답했던 것들을 겹쳐보니까, 하나씩 볼 때는 안 보이던 게 보여. 무료로 본 결과가 없어지는 건 아니야.',
  freeRecapLabel: '무료로 본 내용',
  additionsLabel: '정밀 관찰 리포트에서 더 보이는 것',
  purchaseCta: '정밀 관찰 리포트 보기',
  dismissCta: '지금은 괜찮아',
  priceNote: '정밀 관찰 리포트 1회 · 구독 아님',

  previewLabel: '미리 보기 — 3가지만 살짝',
  previewLocked: '나머지는 정밀 관찰 리포트에서 이어서 볼 수 있어',

  fakeDoorTitle: '정밀 관찰 리포트는 지금 준비 중이야',
  fakeDoorBody:
    '아직 결제도, 리포트 연결도 전이야. 방금 누른 건 결제가 아니라 관심 표시로만 기록했어.',
  notifyCta: '출시되면 알려줘',
  notifyDoneLabel: '관심 표시했어',
  notifyNote: '지금은 알림 기능도 연결 전이라 관심 표시만 기록할게. 연락처는 받지 않아.',
  fakeDoorDismiss: '괜찮아',

  unavailableTitle: '아직 연결할 수 있는 신호가 부족해',
  demoNotice: '이 리포트도 규칙 기반 데모 응답이야. 실제 AI 개인화 결과가 아니야.',
} as const;

/**
 * v1.15 §4 — Contextual Premium Hook.
 *
 * '결과 화면 하단에 Premium Entry 하나'가 아니라, 궁금증이 생기는 순간마다(최대 3곳)
 * 실제 데이터로 개인화한 설명을 보여준다. 여기 있는 title/cta는 화면 문구의 고정 부분이고,
 * description은 호출부(각 결과 화면)가 실제 사용자 데이터로 채운다 — 이 파일은 정적 카피만
 * 갖고 있고, 개인화 문장을 만들지 않는다(§41 원칙 그대로).
 */
export const PREMIUM_HOOK_COPY = {
  /** A. Compatibility — Friction Signal 다음 */
  friction_why: {
    title: '이 차이가 실제 연애에서는 어떻게 나타날까?',
    cta: 'Deep Report에서 관계 상황 보기',
  },
  /** B. Relationship Mirror — Core Insight 다음. 럽유럽미 Product Identity와 가장 가깝다 */
  mirror_why: {
    title: '왜 나는 생각했던 나와 다르게 행동했을까?',
    cta: '내 관계를 더 깊게 보기',
  },
  /** C. History — 비교 가능한 과거 기록이 있을 때만 */
  history_change: {
    title: '이 모습, 이번 관계에서만 나타난 걸까?',
    cta: '관계를 거치며 달라진 나 보기',
  },
} as const;
