import type { PremiumIntent } from '@/types';

/**
 * 결제 의향 기록 저장소
 *
 * `lym.session.v1`(분석 입력)과 **분리된** 저장소다 — 결제 상태가 분석 결과에 영향을 줄 수
 * 없게 구조적으로 떼어놓는다. Compatibility·Mirror·History 로직은 이 파일을 import하지 않는다.
 *
 * ⚠️ 이메일·전화번호·카드번호를 수집하지 않는다(§39). 어떤 기능에 관심을 보였는지만 남긴다.
 * Analytics가 주 데이터고, 이 저장소는 화면이 '이미 관심 표시했음'을 다시 보여주기 위한 것이다.
 */

const STORAGE_KEY = 'lym.premium-intent.v1';

function readAll(): PremiumIntent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PremiumIntent[]) : [];
  } catch {
    return [];
  }
}

function writeAll(intents: PremiumIntent[]): PremiumIntent[] {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(intents));
  } catch {
    // 저장 실패가 흐름을 막지 않는다.
  }
  return intents;
}

export function getPremiumIntents(): PremiumIntent[] {
  return readAll();
}

/** 같은 기능에 대한 최신 의향 하나만 남긴다 — 클릭 횟수를 세는 건 analytics의 일이다 */
export function recordPremiumIntent(intent: PremiumIntent): PremiumIntent[] {
  const rest = readAll().filter((item) => item.feature !== intent.feature);
  return writeAll([...rest, intent]);
}

export function markNotifyIntent(feature: PremiumIntent['feature']): PremiumIntent[] {
  return writeAll(
    readAll().map((item) => (item.feature === feature ? { ...item, notifyIntent: true } : item)),
  );
}

export function hasNotifyIntent(feature: PremiumIntent['feature']): boolean {
  return readAll().some((item) => item.feature === feature && item.notifyIntent);
}

/** 사용자의 '전체 데이터 삭제'에서 함께 지운다 */
export function clearPremiumIntents(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 무시
  }
}
