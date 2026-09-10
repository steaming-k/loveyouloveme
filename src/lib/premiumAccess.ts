import type { PremiumFeatureId } from '@/types';

/**
 * Premium Access 경계 (vNext)
 *
 * '어떤 자격으로 상세 리포트를 보고 있는가'를 한 곳에서 정의한다.
 *
 *   payment      실제 PG 결제가 확정된 뒤 — **아직 도달 경로가 없다.** PG가 붙으면 성공
 *                callback에서 이 값으로 같은 화면을 재사용한다.
 *   demo_unlock  vNext — **Production 일반 사용자**가 CTA로 리포트를 여는 경로.
 *                실제 결제는 일어나지 않았고, 화면이 그 사실을 명시한다.
 *   preview      `NEXT_PUBLIC_PREMIUM_PREVIEW=true` 개발·QA 통로
 *   beta_ut      Preview 중 `?mode=ut` — UT 참여자 체험
 *
 * ══ ⚠️ `demo_unlock` ≠ `payment` ══════════════════════════════════════════
 *
 * v1.45까지 Production의 Relationship Deep Report는 Fake Door였다 — CTA를 누르면
 * '준비 중' 안내만 보여줬다. vNext에서 **제품 결정이 바뀌어** 그 리포트는 Production에서도
 * 열린다. 그런데 **PG는 여전히 없다.**
 *
 * 그래서 mode를 하나 더 뒀다. `preview`를 재사용하지 않은 이유는 두 가지다:
 *
 *  ① 의미가 다르다 — `preview`는 '개발/QA 통로'이고, 이 경로의 사용자는 QA가 아니라
 *    자기 리포트를 보는 실제 사용자다.
 *  ② 문구가 거짓이 된다 — `preview` 문구는 `미리보기로 리포트를 열었어`인데, 그 사용자가
 *    보는 것은 미리보기가 아니라 **자기 데이터로 만든 실제 리포트 전체**다.
 *
 * ⚠️ **결제했다고 읽히게 하지 않는다.** `demo_unlock` 문구는 `결제 없이 열었다`는 사실을
 * 명시한다(`UNLOCK_COPY.demoUnlock`) — CTA에 가격이 적혀 있으므로 이 문장이 없으면
 * 사용자가 과금됐다고 오해할 수 있다. `결제가 완료됐어`는 `payment` mode에만 남아 있다.
 *
 * ⚠️ analytics: `access_mode` property에 값이 하나 늘어난다(추가일 뿐 schema 변경 아님).
 * 기존 `deep_report_view`·`deep_report_complete`·`deep_report_value_check`가 이 값을
 * 그대로 실어 보내므로 Production 열람과 QA 열람을 대시보드에서 구분할 수 있다.
 */
export type PremiumAccessMode = 'payment' | 'demo_unlock' | 'preview' | 'beta_ut';

/**
 * Preview Unlock 상태.
 *
 * ⚠️ **결제 기록이 아니다.** '결제 완료 → 리포트 공개' 경험을 QA/UT에서 검증하는 동안,
 * 새로고침이나 뒤로가기로 리포트가 사라지지 않게 하기 위한 **탭 한정** 상태다.
 * 그래서 localStorage가 아니라 sessionStorage를 쓴다 — 탭을 닫으면 사라진다.
 *
 * 실제 PG가 붙으면 접근 권한은 이 파일이 아니라 **서버 검증 결과**가 준다.
 * 분석 로직은 이 파일을 import하지 않는다(`premiumIntentStore`와 같은 격리 원칙).
 */
const STORAGE_KEY = 'lym.premium-preview-unlock.v1';

/** `funnelAnalysisId`가 아직 없는 상태(하이드레이션 직후 등)에서 쓰는 키 */
const NO_ANALYSIS = 'no-analysis';

function entryKey(feature: PremiumFeatureId, analysisKey: string | null | undefined): string {
  return `${feature}:${analysisKey || NO_ANALYSIS}`;
}

function readAll(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * 이 분석(`analysisKey` = `funnelAnalysisId`)에 대해 Preview Unlock을 기록한다.
 * 새 상대를 분석하면 `funnelAnalysisId`가 새로 발급되므로 이전 Unlock이 따라오지 않는다.
 */
export function grantPreviewUnlock(
  feature: PremiumFeatureId,
  analysisKey: string | null | undefined,
): void {
  if (typeof window === 'undefined') return;
  const key = entryKey(feature, analysisKey);
  const next = Array.from(new Set([...readAll(), key]));
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 저장 실패가 흐름을 막지 않는다 — 이번 화면에서는 state로 이미 열려 있다.
  }
}

export function hasPreviewUnlock(
  feature: PremiumFeatureId,
  analysisKey: string | null | undefined,
): boolean {
  return readAll().includes(entryKey(feature, analysisKey));
}

/** 사용자의 '전체 데이터 삭제'·세션 초기화에서 함께 지운다 */
export function clearPreviewUnlocks(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 무시
  }
}
