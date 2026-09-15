import type { ObservationFeedback, ValidatedObservation } from '@/types';

/**
 * 사진 관찰의 **수용 판정** — 이 규칙의 유일한 출처 (260915 UT P0-1)
 *
 * ```
 * RAW_OBSERVATION → USER_CONFIRM / USER_EDIT / USER_REJECT → ACCEPTED_EVIDENCE
 * ```
 *
 * ── 왜 파일을 따로 뒀나 ──────────────────────────────────────────────────────
 *
 * 이 판정은 화면(`profile`) · 기록(`soloHistory`) · 근거 해석(`aiEvidenceResolver`) ·
 * AI 인용 허용 목록(`allowedEvidence`) · AI 입력(`contextBuilders`) 다섯 곳에서 쓴다.
 * 그중 하나에 규칙을 두면 나머지가 그 모듈을 import하게 되고, 실제로 그 방향으로
 * 순환 import가 생겼다. 그래서 **타입만 import하는 leaf 모듈**로 분리했다.
 *
 * ⚠️ 여기를 거치지 않고 `observations[id]`나 `status`를 직접 비교하는 곳을 만들지 않는다.
 * 260915 UT 직전까지 화면은 `verdict`까지 봤고 기록은 `excluded`만 봤다 — 같은 근거가
 * 화면마다 다르게 취급되면 어느 쪽이 맞는지 아무도 확인할 수 없다.
 */

/**
 * 이 관찰을 분석에 쓸 수 있는가 (S09 사용자 피드백 기준)
 *
 * ```
 * excluded                        제외 — 분석에서 빼달라고 했다
 * verdict 'no' + 고친 문장 없음     제외 — '아니야'라고만 했다
 * verdict 'no' + 고친 문장 있음     포함 — 고친 문장으로 쓴다
 * 그 외                            포함
 * ```
 */
export function isAcceptedObservation(feedback: ObservationFeedback | undefined): boolean {
  if (feedback?.excluded) return false;
  if (feedback?.verdict === 'no') return Boolean(feedback.correctedText?.trim());
  return true;
}

/**
 * 사용자가 받아들이지 않은 관찰인가 (`ValidatedObservation.status` 기준)
 *
 * `rejected`(아니라고 함)와 `excluded`(빼달라고 함)는 이유가 다르지만 결과는 같다:
 * Compatibility · Mirror · Premium · Lens · History 어디에도 근거로 쓰지 않는다.
 */
export function isUserRefusedObservation(status: ValidatedObservation['status']): boolean {
  return status === 'rejected' || status === 'excluded';
}
