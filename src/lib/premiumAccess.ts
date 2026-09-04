import type { PremiumFeatureId } from '@/types';

/**
 * Premium Access 경계 (vNext)
 *
 * '어떤 자격으로 상세 리포트를 보고 있는가'를 한 곳에서 정의한다.
 *
 *   payment   실제 PG 결제가 확정된 뒤 — **아직 도달 경로가 없다.** PG가 붙으면 성공
 *             callback에서 이 값으로 같은 화면을 재사용한다.
 *   preview   `NEXT_PUBLIC_PREMIUM_PREVIEW=true` 개발·QA 통로
 *   beta_ut   Preview 중 `?mode=ut` — UT 참여자 체험
 *
 * ⚠️ **Fake Door를 실제 결제처럼 보이게 하지 않는다.** `preview`/`beta_ut`에서는 화면 문구가
 * '결제가 완료됐어'라고 말하지 않는다(`UNLOCK_COPY`). Production 사용자는 `PREMIUM_PREVIEW`가
 * 꺼져 있어 이 경로 자체에 도달하지 못하고, 기존 Fake Door(준비 중 안내)를 그대로 본다.
 */
export type PremiumAccessMode = 'payment' | 'preview' | 'beta_ut';

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
