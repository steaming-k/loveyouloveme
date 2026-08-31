/**
 * Analytics 추상화
 *
 * 실제 GA4 / Amplitude SDK는 붙이지 않았지만, 나중에 sink 하나만 교체하면 되도록
 * trackEvent(name, properties) 형태로 통일한다.
 *
 * Primary KPI
 *   relationship_mirror_entry_click / compatibility_complete
 *   = '궁합 때문에 들어왔지만 결국 나에 대한 분석까지 보는가'
 */

export const ANALYTICS_EVENTS = [
  'onboarding_complete',
  'relationship_status_select',
  'profile_building_start',
  'photo_input_complete',
  'observed_profile_complete',
  'observed_result_edit',
  'declared_me_complete',
  'relationship_experience_complete',
  'relationship_experience_skip',
  'profile_complete',
  'profile_feedback_positive',
  'profile_feedback_edit',
  'target_profile_complete',
  'compatibility_complete',
  'compatibility_low_confidence',
  'compatibility_reason_view',
  'compatibility_dimension_expand',
  'good_signal_view',
  'friction_signal_view',
  'conversation_question_save',
  'conversation_question_share',
  'relationship_mirror_teaser_view',
  'relationship_mirror_entry_click',
  'relationship_mirror_postpone',
  'relationship_mirror_complete',
  'mirror_feedback_positive',
  'mirror_feedback_edit',
  'share_card_open',
  'share_card_action',
  'observation_excluded',
  'session_reset',
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

/** Primary KPI 스냅샷 — 궁합 결과 → Relationship Mirror 진입률 */
export function getPrimaryKpi(): {
  compatibilityComplete: number;
  mirrorEntryClick: number;
  mirrorComplete: number;
  entryRate: number | null;
} {
  const counts = readStore().counts;
  const compatibilityComplete = counts.compatibility_complete ?? 0;
  const mirrorEntryClick = counts.relationship_mirror_entry_click ?? 0;

  return {
    compatibilityComplete,
    mirrorEntryClick,
    mirrorComplete: counts.relationship_mirror_complete ?? 0,
    entryRate:
      compatibilityComplete === 0
        ? null
        : Math.round((mirrorEntryClick / compatibilityComplete) * 100),
  };
}

export function resetAnalytics(): void {
  writeStore(emptyStore());
}
