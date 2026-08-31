/**
 * Analytics 추상화
 *
 * 실제 GA4 / Amplitude SDK는 붙이지 않았지만, 나중에 sink 하나만 교체하면 되도록
 * trackEvent(name, properties) 형태로 통일한다.
 *
 * Primary KPI
 *   relationship_mirror_entry_click / compatibility_result_view
 *   = '궁합 결과를 본 사용자 중 Relationship Mirror에 진입한 비율'
 *
 * compatibility_result_view는 S21(정상 결과)과 E3(확신 낮음) 둘 다에서 발생한다 —
 * 확신 낮은 사용자도 궁합 결과 화면을 본 것은 맞으므로 분모에서 빠지면 안 된다.
 * compatibility_complete는 '정상적으로 계산 가능한 궁합 분석 완료' 운영 지표로 별도 유지한다.
 */

export const ANALYTICS_EVENTS = [
  'onboarding_complete',
  'relationship_status_select',
  'profile_building_start',
  'photo_input_complete',
  'observed_profile_complete',
  'observed_result_edit',
  'declared_me_complete',
  'relationship_adaptive_answer',
  'relationship_experience_complete',
  'relationship_experience_skip',
  'profile_complete',
  'profile_feedback_positive',
  'profile_feedback_edit',
  'target_profile_complete',
  'compatibility_complete',
  'compatibility_low_confidence',
  'compatibility_result_view',
  'compatibility_reason_view',
  'compatibility_dimension_expand',
  'good_signal_view',
  'friction_signal_view',
  'conversation_question_save',
  'conversation_question_share',
  'relationship_mirror_teaser_view',
  'relationship_mirror_entry_click',
  'relationship_mirror_postpone',
  'relationship_mirror_view',
  'relationship_mirror_complete',
  'mirror_feedback_positive',
  'mirror_feedback_edit',
  'share_card_open',
  'share_card_action',
  'observation_excluded',
  'session_data_deleted',
  'session_reset',
  // MBTI (Supporting Lens) — Optional이므로 Primary Funnel KPI에는 넣지 않는다.
  // Supporting: MBTI 입력률 = both_mbti_available / compatibility_result_view
  //             Lens 조회율 = mbti_lens_view / both_mbti_available
  'self_mbti_select',
  'target_mbti_select',
  'both_mbti_available',
  'mbti_lens_view',
  'mbti_conversation_question_view',
  // Entertainment Lens (사주 · Astrology) — Primary KPI에는 넣지 않는다(§38).
  // Supporting: Birth Info Completion Rate · Entertainment Lens View Rate ·
  //             Lens → Conversation Question Save Rate
  'birth_profile_edit',
  'birth_profile_complete',
  'saju_lens_view',
  'astrology_lens_view',
  'entertainment_lens_entry_click',
  'entertainment_lens_birth_missing',
  'lens_conversation_question_save',
  /** @deprecated v1.4 — 별자리 직접 선택이 생년월일 기반 계산으로 대체됐다 */
  'lens_zodiac_set',
  // Relationship History (Retention) — Primary KPI에는 넣지 않는다(§33).
  // Retention 지표: History Save Rate  = relationship_history_entry_created
  //                                     / relationship_mirror_complete
  //                 Repeat Analysis Rate = 두 번째 Mirror 생성 / 첫 Mirror 완료
  'relationship_history_entry_created',
  'relationship_history_view',
  'relationship_history_entry_view',
  'relationship_history_change_report_view',
  'relationship_history_repeated_signal_view',
  'relationship_history_entry_delete',
  'history_based_insight_view',
  // Premium Fake Door (BM 검증) — Primary KPI에는 넣지 않는다(§29).
  // BM Funnel: entry_view → entry_click → paywall_view → purchase_intent
  //            → fake_door_reveal → notify_intent
  // 지표: Premium CTR = entry_click / entry_view
  //       Paywall Intent Rate = purchase_intent / paywall_view
  //       Notify Intent Rate = notify_intent / fake_door_reveal
  'premium_entry_view',
  'premium_entry_click',
  'premium_paywall_view',
  'premium_purchase_intent',
  'premium_fake_door_reveal',
  'premium_notify_intent',
  'premium_dismiss',
  'premium_preview_view',
  // AI Analysis Pipeline (v1.6) — Primary KPI에는 넣지 않는다.
  // ⚠️ property에 자유서술·AI 문장·사진 description을 넣지 않는다(§79). 개수·분류·소요시간만.
  // 품질 지표: Observed Confirmation/Correction/Exclusion Rate · AI Failure Rate · Fallback Rate
  'ai_analysis_request',
  'ai_analysis_success',
  'ai_analysis_failure',
  'ai_fallback_used',
  'ai_evidence_correction',
  // UT Mode 전용 (NEXT_PUBLIC_UT_MODE=true일 때만 발생)
  'ut_analysis_similarity_rate',
  'ut_evidence_clarity_rate',
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

export type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

interface LoggedEvent {
  name: AnalyticsEvent;
  properties: AnalyticsProperties;
  at: number;
}

const STORAGE_KEY = 'lym.analytics.v1';
const MAX_LOG = 200;

interface AnalyticsStore {
  counts: Partial<Record<AnalyticsEvent, number>>;
  log: LoggedEvent[];
}

function emptyStore(): AnalyticsStore {
  return { counts: {}, log: [] };
}

function readStore(): AnalyticsStore {
  if (typeof window === 'undefined') return emptyStore();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as AnalyticsStore;
    return { counts: parsed.counts ?? {}, log: parsed.log ?? [] };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: AnalyticsStore): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // 저장 실패는 제품 흐름을 막지 않는다.
  }
}

/** 이벤트 1건 기록. 실제 SDK를 붙일 때 이 함수 안에서 window.gtag 등을 호출하면 된다. */
export function trackEvent(name: AnalyticsEvent, properties: AnalyticsProperties = {}): void {
  const store = readStore();
  store.counts[name] = (store.counts[name] ?? 0) + 1;
  store.log = [...store.log, { name, properties, at: Date.now() }].slice(-MAX_LOG);
  writeStore(store);

  if (process.env.NODE_ENV !== 'production') {
    console.info(`[analytics] ${name}`, properties);
  }
}

export function getEventCount(name: AnalyticsEvent): number {
  return readStore().counts[name] ?? 0;
}

export function getEventLog(): LoggedEvent[] {
  return readStore().log;
}

const SESSION_DEDUP_PREFIX = 'lym.session_fired.';

/**
 * 세션(브라우저 탭) 안에서 딱 한 번만 발생해야 하는 이벤트용.
 * 뒤로가기·새로고침으로 같은 결과 화면을 다시 봐도 KPI 분모가 중복 집계되지 않게 한다.
 * sessionStorage를 쓰므로 탭을 닫으면 dedup 상태도 함께 사라진다 — 그게 맞는 의미다.
 */
export function trackOnce(name: AnalyticsEvent, properties: AnalyticsProperties = {}): void {
  if (typeof window === 'undefined') return;
  const key = SESSION_DEDUP_PREFIX + name;
  try {
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, '1');
  } catch {
    // sessionStorage를 못 쓰면 dedup 없이라도 이벤트는 기록한다.
  }
  trackEvent(name, properties);
}

/** Primary KPI 스냅샷 — 궁합 결과를 본 사용자 중 Relationship Mirror에 진입한 비율 */
export function getPrimaryKpi(): {
  compatibilityResultView: number;
  mirrorEntryClick: number;
  mirrorComplete: number;
  entryRate: number | null;
} {
  const counts = readStore().counts;
  const compatibilityResultView = counts.compatibility_result_view ?? 0;
  const mirrorEntryClick = counts.relationship_mirror_entry_click ?? 0;

  return {
    compatibilityResultView,
    mirrorEntryClick,
    mirrorComplete: counts.relationship_mirror_complete ?? 0,
    entryRate:
      compatibilityResultView === 0
        ? null
        : Math.round((mirrorEntryClick / compatibilityResultView) * 100),
  };
}

export function resetAnalytics(): void {
  writeStore(emptyStore());
}

/** 세션 dedup 가드를 지운다 — '답변 초기화'로 처음부터 다시 돌 때 KPI 이벤트가 다시 발생하게 한다. */
export function clearSessionDedup(): void {
  if (typeof window === 'undefined') return;
  try {
    for (const name of ANALYTICS_EVENTS) {
      window.sessionStorage.removeItem(SESSION_DEDUP_PREFIX + name);
    }
  } catch {
    // 무시 — dedup 가드가 안 지워져도 치명적이지 않다.
  }
}
