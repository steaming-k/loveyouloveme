import { createGa4Adapter, NoopAnalyticsAdapter, type AnalyticsAdapter } from './analyticsAdapter';
import { getAnalyticsConsent } from './analyticsConsent';
import { GA_MEASUREMENT_ID } from './env';

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
  // Target Preference + Approach Hints (v1.13 §42~§43) — Primary KPI에는 넣지 않는다.
  // Secondary: Approach Hint View Rate = approach_hint_view / compatibility_result_view
  // ⚠️ raw interest 텍스트·힌트 문장 원문은 절대 property로 보내지 않는다(§40).
  'target_preference_add',
  'approach_hint_view',
  'approach_hint_expand',
  'approach_hint_question_click',
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
  // v1.15 — 새 이벤트를 늘리지 않고 아래 6개 property를 확장했다: `hook_variant`
  // (friction_why/mirror_why/history_change — Contextual Hook에서 온 경우만),
  // `price`는 이제 항상 1900.
  'premium_entry_view',
  'premium_entry_click',
  'premium_paywall_view',
  'premium_purchase_intent',
  'premium_fake_door_reveal',
  'premium_notify_intent',
  'premium_dismiss',
  'premium_preview_view',
  // v1.15 §10 — Paywall에서만 묻는 가격/가치 UT. 이미 보고 있던 Deep Report 전체를
  // 다시 볼 의향(`ut_deep_report_wtp`, Preview/UT 전용 화면)과는 다른 질문이다 — 이건
  // 무료 결과 + Paywall Preview만 본 상태에서, 그 이상을 결제할 의향이 있는지를 묻는다.
  // 지불 의향은 실제 WTP FACT가 아니라 '의향'으로만 기록한다.
  'ut_premium_value_diff_rate',
  'ut_premium_price_wtp',
  // AI Analysis Pipeline (v1.6) — Primary KPI에는 넣지 않는다.
  // ⚠️ property에 자유서술·AI 문장·사진 description을 넣지 않는다(§79). 개수·분류·소요시간만.
  // 품질 지표: Observed Confirmation/Correction/Exclusion Rate · AI Failure Rate · Fallback Rate
  'ai_analysis_request',
  'ai_analysis_success',
  'ai_analysis_failure',
  'ai_fallback_used',
  'ai_evidence_correction',
  // 실제 사진 Vision (v1.10 §22) — 사진 기능의 성공을 '업로드율' 하나로 보지 않기 위해
  // 업로드 이후 단계를 각각 센다: 분석 성공률 → 관찰 생성률 → 반복 신호 생성률 → 확인/수정률.
  // ⚠️ property에 raw image · raw caption · 관찰 문장을 절대 넣지 않는다(§22). 개수·분류만.
  'photo_analysis_start',
  'photo_analysis_complete',
  'photo_analysis_fail',
  'photo_observation_generated',
  'photo_repeated_signal_generated',
  'photo_observation_confirm',
  'photo_observation_correct',
  // AI Narrative 배선 (v1.7) — task × mode로 나눠 보면 AI 품질을 추적할 수 있다(§87).
  // task: observed | compatibility | relationship | history
  // mode: real | demo | fallback
  'ai_narrative_view',
  'ai_narrative_fallback_view',
  'ai_evidence_expand',
  // UT Mode 전용 (NEXT_PUBLIC_UT_MODE=true일 때만 발생)
  // ⚠️ UT 점수는 분석 로직에 쓰지 않는다. 측정 전용이다(§44).
  'ut_analysis_similarity_rate',
  'ut_evidence_clarity_rate',
  'ut_self_understanding_helpfulness',
  'ut_photo_value_rate',
  // Relationship Deep Report (v1.9 · §34~§36) — Primary KPI(Mirror Entry Rate)는 바꾸지 않는다.
  // 이 지표들은 'AI 설명 품질'이 아니라 'Cross-source 분석이라는 제품이 가치 있는가'를 본다.
  'deep_report_view',
  'deep_report_complete',
  /** v1.10 §49 — 50/100 두 단계만. 과도한 스크롤 이벤트를 피한다 */
  'deep_report_scroll',
  'deep_insight_evidence_expand',
  'deep_insight_feedback',
  'deep_insight_correction_submit',
  'deep_question_start',
  'deep_question_complete',
  'history_deep_insight_view',
  // UT Mode 전용 — Deep Analysis Product Value(§35). 기존 ut_* 지표(AI 문장 품질)와는
  // 다른 것을 측정한다 — '더 상세히 말해줬냐'가 아니라 '연결해서 보여준 게 새로웠냐'.
  'ut_new_insight_rate',
  'ut_genericness_rate',
  'ut_cross_source_value_rate',
  'ut_deep_report_wtp',
  'ut_deep_report_missing_value',
  // Result Experience Consolidation (v1.11 §47) — Compatibility(S21~S25)와 Mirror(S27~S28)를
  // 각각 한 Route로 합치면서 생긴 '다시 보기' 전용 지표. Primary KPI(§48)를 오염시키지 않기
  // 위해 기존 trackOnce 이벤트(compatibility_result_view 등)와는 별도 이름을 쓴다.
  'compatibility_result_revisit',
  'mirror_result_revisit',
  'profile_result_revisit',
  /** Compatibility Result의 아코디언('N개 더 보기')을 열었을 때. properties: section */
  'result_section_expand',
  /** Legacy Route redirect 또는 #hash 직접 진입 후 실제로 해당 섹션까지 스크롤했을 때 */
  'result_anchor_navigation',
  /** Profile Revisit에서 '수정' 진입점을 눌렀을 때. properties: section */
  'result_edit_entry',
  /**
   * @deprecated v1.11 — 이번 버전에서는 발생시키지 않는다. Compatibility/Mirror 결과는
   * 세션에서 매번 다시 계산되는 순수 함수라 '재분석'이 버튼→로딩을 거치는 별도 프로세스가
   * 아니다(다음 렌더에 바로 반영된다). 향후 실제 비동기 재분석이 생기면 그때 발생시킨다.
   */
  'result_reanalysis_start',
  /** @deprecated v1.11 — 위와 동일한 이유로 이번 버전에서는 발생시키지 않는다 */
  'result_reanalysis_complete',
  // Analysis-level Funnel (v1.12 §18~§23) — 기존 Session KPI(trackOnce, §17.1)는 그대로
  // 둔 채 별도로 추가한 지표. sessionStorage[event명] 하나로만 dedup하는 기존 방식은
  // 같은 탭에서 두 번째 상대를 분석해도 재발생하지 않는 한계가 있었다 — 이 두 이벤트는
  // `funnelAnalysisId`(상대가 바뀔 때마다 새로 발급되는 랜덤 UUID) 기준으로 dedup한다
  // (`trackOncePerAnalysis`). Primary KPI 정의 자체는 바꾸지 않는다(§19) — 이건 별도의
  // Analysis Funnel Conversion 지표다.
  'compatibility_analysis_result_view',
  'relationship_mirror_analysis_entry',
  // v1.12 §9~§11 AI latency/failure metrics — 새 이벤트를 추가하지 않는다. v1.6부터 있던
  // `ai_analysis_request`/`ai_analysis_success`/`ai_analysis_failure`(아래, aiClient.ts)가
  // 이미 task·duration_ms·mode·evidence_count(result_items)·failure reason을 전부 갖고
  // 있다 — 이름만 다른 이벤트를 새로 만들면 같은 사실을 두 이름으로 중복 기록하게 된다.
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

/**
 * v1.10 §26~§28, v1.12 §12~§16 — 외부(GA4) 전송 어댑터. `readStore`/`writeStore`(위)는
 * 이 파일 고유의 local store이고(dedup·getEventCount·getPrimaryKpi가 직접 읽는다), 이
 * 어댑터는 **그 위에 추가로** 같은 이벤트를 외부로도 보낼지 결정하는 선택적 레이어다.
 *
 * 매 호출마다 다시 판단한다(모듈 로드 시점에 한 번 고정하지 않는다) — Consent는 세션
 * 중간에 바뀔 수 있기 때문이다.
 *   - Development: 항상 Noop. Local store(위 `writeStore`)만 쌓인다 — GA4로 개발 중
 *     이벤트가 새 나가지 않는다(§16).
 *   - Production + GA Measurement ID 없음: Noop — GA4 = NOT CONNECTED.
 *   - Production + Measurement ID 있음 + Consent 'granted': GA4.
 *   - Production + Measurement ID 있음 + Consent 'unknown'/'denied': Noop — 동의 전에는
 *     외부로 아무 것도 나가지 않는다(§14).
 */
function resolveExternalAdapter(): AnalyticsAdapter {
  if (process.env.NODE_ENV !== 'production') return NoopAnalyticsAdapter;
  if (!GA_MEASUREMENT_ID) return NoopAnalyticsAdapter;
  if (getAnalyticsConsent() !== 'granted') return NoopAnalyticsAdapter;
  return createGa4Adapter(GA_MEASUREMENT_ID);
}

/** 이벤트 1건 기록. local store에 남기고, GA4 전송 조건(§16)을 만족하면 그쪽에도 보낸다. */
export function trackEvent(name: AnalyticsEvent, properties: AnalyticsProperties = {}): void {
  const store = readStore();
  store.counts[name] = (store.counts[name] ?? 0) + 1;
  store.log = [...store.log, { name, properties, at: Date.now() }].slice(-MAX_LOG);
  writeStore(store);

  if (process.env.NODE_ENV !== 'production') {
    console.info(`[analytics] ${name}`, properties);
  }

  // §29 — 외부 전송 실패가 Product UX에 영향을 주면 안 된다. console.error도 내지 않는다.
  try {
    resolveExternalAdapter().track(name, properties);
  } catch {
    // 무시
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

const ANALYSIS_DEDUP_PREFIX = 'lym.analysis_fired.';

/**
 * v1.12 §18~§23 — Analysis 단위로 딱 한 번만 발생해야 하는 이벤트용.
 *
 * `trackOnce`(세션/탭 단위)와 별개다. 같은 탭에서 두 번째 상대를 분석하면 `trackOnce`는
 * 이미 쐈던 이벤트를 다시 쏘지 않지만, 이건 `funnelAnalysisId`가 바뀌었으므로 다시 쏜다.
 * 같은 분석을 새로고침하거나 Revisit으로 다시 봐도(§23) `funnelAnalysisId`가 그대로라
 * 재발생하지 않는다. 값이 아직 없으면(hydration 이전 등) 조용히 아무 것도 하지 않는다 —
 * 나중에 값이 생겨도 그 시점에 놓친 이벤트를 소급해서 쏘지 않는다.
 *
 * ⚠️ property 이름을 `analysis_id`가 아니라 `funnel_analysis_id`로 보낸다 — 기존
 * `*_result_revisit` 이벤트들은 `analysis_id`를 **declared/experience 기반 deterministic
 * fingerprint**(History의 `analysisId`와 같은 개념) 의미로 이미 쓰고 있다(§20). 같은
 * property 이름에 두 가지 다른 값을 섞으면 로그를 해석할 때 혼동된다.
 */
export function trackOncePerAnalysis(
  name: AnalyticsEvent,
  funnelAnalysisId: string | null | undefined,
  properties: AnalyticsProperties = {},
): void {
  if (typeof window === 'undefined' || !funnelAnalysisId) return;
  const key = `${ANALYSIS_DEDUP_PREFIX}${funnelAnalysisId}.${name}`;
  try {
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, '1');
  } catch {
    // sessionStorage를 못 쓰면 dedup 없이라도 이벤트는 기록한다.
  }
  trackEvent(name, { ...properties, funnel_analysis_id: funnelAnalysisId });
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

/**
 * v1.12 §19 — Analysis Funnel Conversion. 기존 `getPrimaryKpi()`(세션/탭 단위)를
 * 대체하지 않는다 — '분석 단위로 보면 얼마나 다른가'를 보여주는 별도 지표다.
 */
export function getAnalysisPrimaryKpi(): {
  analysisResultView: number;
  analysisMirrorEntry: number;
  entryRate: number | null;
} {
  const counts = readStore().counts;
  const analysisResultView = counts.compatibility_analysis_result_view ?? 0;
  const analysisMirrorEntry = counts.relationship_mirror_analysis_entry ?? 0;

  return {
    analysisResultView,
    analysisMirrorEntry,
    entryRate:
      analysisResultView === 0
        ? null
        : Math.round((analysisMirrorEntry / analysisResultView) * 100),
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
