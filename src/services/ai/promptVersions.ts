/**
 * Prompt / Analysis 버전 상수 (v1.7에서 분리)
 *
 * ⚠️ **프롬프트 본문과 일부러 분리했다.**
 *
 * 이 상수들은 결과 `meta`에 들어가므로 클라이언트 쪽 fallback 생성에서도 필요하다.
 * 그런데 `promptTemplates.ts`에서 함께 export하고 있었더니, `fallback.ts` →
 * `aiService.ts`(클라이언트) 경로로 **System Prompt 전문 4개가 클라이언트 번들에 실렸다.**
 *
 * 프롬프트는 비밀은 아니지만 브라우저로 내려보낼 이유가 없다 —
 * 번들만 커지고, 안전 규칙 문구가 그대로 공개되면 injection을 설계하기 쉬워진다.
 * 그래서 버전 문자열만 여기 두고, 프롬프트 본문은 서버 쪽에만 남긴다.
 */

export const PROMPT_VERSIONS = {
  observed: 'observed-v1',
  /** v1.7 — 길이 제한 · 관련성 필터 · userCorrection 표현 규칙 추가 */
  relationship: 'relationship-v2',
  /** v1.7 — 길이 제한 · 상대 마음 읽기 예시 강화 · uncertainty 필수 조건 명시 */
  compatibility: 'compatibility-v2',
  /** v1.7 — 길이 제한 · '~수도 있어' 톤 강제 · 반복 신호 확정 금지 */
  history: 'history-v2',
} as const;

export const ANALYSIS_VERSION = '1.0';
