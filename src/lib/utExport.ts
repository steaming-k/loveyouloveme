/**
 * UT 결과 내보내기 (v1.12 §38~§39)
 *
 * 개발/UT mode 전용. 실제 참가자에게 URL 하나로 UT를 맡길 수 있게 하려면, 개발자 콘솔
 * 없이도 그 결과를 회수할 방법이 있어야 한다.
 *
 * ⚠️ 포함: 정량 평점(ut_* 이벤트) · Deep Report UT 5문항 중 점수/선택지 · analysisId ·
 *   timestamp · mode.
 * ⚠️ 절대 포함하지 않는 것: 사진 원본, 출생 지역, 관계 서술 원문, 사용자 정정 원문,
 *   Deep Report UT의 자유서술(`missingValue`) 원문 — 글자 수만 남긴다.
 */

import { getAllDeepReportUt } from './deepReportUtStore';
import { getEventLog } from './analytics';

/** UT 참가자 평가와 직접 관련된 이벤트만 골라낸다 — 다른 Funnel 이벤트는 섞지 않는다 */
const UT_EVENT_PREFIXES = ['ut_'];
const UT_EVENT_NAMES = new Set(['deep_report_view', 'deep_report_complete']);

export interface UtExportPayload {
  exportedAt: string;
  ratings: Array<{ name: string; properties: Record<string, unknown>; at: number }>;
  deepReportUt: Array<{
    analysisId: string;
    newInsight?: number;
    genericness?: number;
    crossSourceValue?: number;
    wtp?: string;
    missingValueLength: number;
    completedAt?: string;
  }>;
}

export function buildUtExportPayload(): UtExportPayload {
  const ratings = getEventLog()
    .filter(
      (entry) =>
        UT_EVENT_NAMES.has(entry.name) || UT_EVENT_PREFIXES.some((prefix) => entry.name.startsWith(prefix)),
    )
    .map((entry) => ({ name: entry.name, properties: entry.properties, at: entry.at }));

  const deepReportUt = getAllDeepReportUt().map((item) => ({
    analysisId: item.analysisId,
    newInsight: item.newInsight,
    genericness: item.genericness,
    crossSourceValue: item.crossSourceValue,
    wtp: item.wtp,
    missingValueLength: item.missingValue?.length ?? 0,
    completedAt: item.completedAt,
  }));

  return { exportedAt: new Date().toISOString(), ratings, deepReportUt };
}

/** 브라우저에서 JSON 파일로 내려받는다 — 서버로 전송하지 않는다 */
export function downloadUtExport(): void {
  const payload = buildUtExportPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `lym-ut-export-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
