import type { PremiumFeatureId, PremiumSource } from '@/types';

/**
 * Premium Feature 카탈로그 + 문구
 *
 * 문구 원칙(§41):
 *   ⭕ '조금 더 깊게 볼까?' · '무료 결과보다 상세한 근거와 상황을 볼 수 있어.'
 *      '상세 분석 1회 · ₩3,900' · '현재 상세 분석은 준비 중이야.'
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
  fakeDoorTitle: '상세 분석은 지금 준비 중이에요',
  fakeDoorBody:
    '아직 결제도, 상세 리포트도 연결 전이야. 방금 누른 건 결제가 아니라 관심 표시로만 기록했어.',
  notifyCta: '출시되면 알려줘',
  notifyDoneLabel: '관심 표시했어요',
  notifyNote: '지금은 알림 기능도 연결 전이라 관심 표시만 기록할게. 연락처는 받지 않아.',
  fakeDoorDismiss: '괜찮아요',

  unavailableTitle: '이 상세 렌즈는 아직 준비 중이야',

  /** Demo AI일 때 상세도 규칙 기반이라는 사실을 숨기지 않는다(§22) */
  demoNotice: '상세 분석도 규칙 기반 데모 응답이에요. 실제 AI 개인화 결과가 아니에요.',
} as const;
