import type { DeepReportUtResponse } from '@/types';

/**
 * Deep Report UT 5문항 저장소 (v1.10 · §20 · §21)
 *
 * `lym.session.v1`(분석 입력)과 **분리된** 저장소다 — UT 응답이 Compatibility/Mirror/History
 * 계산에 영향을 줄 수 없게 구조적으로 떼어놓는다. `analysisId` 기준으로 저장해서, 같은 분석을
 * 다시 봐도(새로고침 · 재방문) 이미 답한 UT를 다시 묻지 않는다(§19).
 */

const STORAGE_KEY = 'lym.ut.deep.v1';

function readAll(): DeepReportUtResponse[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DeepReportUtResponse[]) : [];
  } catch {
    return [];
  }
}

function writeAll(responses: DeepReportUtResponse[]): DeepReportUtResponse[] {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(responses));
  } catch {
    // 저장 실패가 흐름을 막지 않는다.
  }
  return responses;
}

export function getDeepReportUt(analysisId: string): DeepReportUtResponse | null {
  return readAll().find((item) => item.analysisId === analysisId) ?? null;
}

/** v1.12 §38 — UT 결과 내보내기가 전체 응답 목록을 읽을 때 쓴다 */
export function getAllDeepReportUt(): DeepReportUtResponse[] {
  return readAll();
}

export function hasCompletedDeepReportUt(analysisId: string): boolean {
  return Boolean(getDeepReportUt(analysisId)?.completedAt);
}

/**
 * v1.19 §13 — '리포트를 다 봤다'(= `deep_report_complete`)를 이미 기록했는지.
 *
 * `hasCompletedDeepReportUt`(위, UT 5문항 완료)와 **다른 사실**이다. Production에는 UT
 * 5문항이 없어서 그 함수만으로는 완독 여부를 알 수 없고, 그러면 새로고침할 때마다 '다 봤어'
 * 버튼이 다시 열려 Completion Rate 분자가 부풀어 오른다.
 */
export function hasCompletedDeepReport(analysisId: string): boolean {
  return Boolean(getDeepReportUt(analysisId)?.reportCompletedAt);
}

/** 리포트 완독 시각을 남긴다. 이미 있으면 덮어쓰지 않는다 — 첫 완독 시점이 유지돼야 한다. */
export function markDeepReportCompleted(analysisId: string): void {
  if (hasCompletedDeepReport(analysisId)) return;
  saveDeepReportUtAnswer(analysisId, { reportCompletedAt: new Date().toISOString() });
}

/** 질문 하나씩 저장한다 — 중간에 이탈해도 그때까지 답한 것은 남는다. */
export function saveDeepReportUtAnswer(
  analysisId: string,
  patch: Partial<Omit<DeepReportUtResponse, 'analysisId'>>,
): DeepReportUtResponse {
  const rest = readAll().filter((item) => item.analysisId !== analysisId);
  const existing = getDeepReportUt(analysisId);
  const next: DeepReportUtResponse = { ...existing, ...patch, analysisId };
  writeAll([...rest, next]);
  return next;
}

export function completeDeepReportUt(analysisId: string): void {
  saveDeepReportUtAnswer(analysisId, { completedAt: new Date().toISOString() });
}

/** 사용자의 '전체 데이터 삭제'에서 함께 지운다(§57) */
export function clearDeepReportUt(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 무시
  }
}

/** 개발용 — 같은 analysisId로 UT를 다시 테스트할 때만 쓴다(§21) */
export function resetDeepReportUt(analysisId?: string): void {
  if (!analysisId) {
    clearDeepReportUt();
    return;
  }
  writeAll(readAll().filter((item) => item.analysisId !== analysisId));
}
