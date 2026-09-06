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
  /**
   * v1.10 — 사진 1장씩 관찰만 받고(반복 판정 없음), 집계는 규칙이 한다.
   * v1(`observed-v1`)은 사진 전체를 한 번에 보내 trait을 바로 받던 방식이었다.
   */
  observed: 'observed-v2-photo',
  /** @deprecated Contract Test fixture 회귀 검증용으로만 남아 있다 */
  observedLegacy: 'observed-v1',
  /** v1.7 — 길이 제한 · 관련성 필터 · userCorrection 표현 규칙 추가 */
  relationship: 'relationship-v2',
  /** v1.7 — 길이 제한 · 상대 마음 읽기 예시 강화 · uncertainty 필수 조건 명시 */
  /**
   * v1.30 — context가 dimension마다 canonical `ref`를 주고 모델은 그것을 복사한다.
   * v2까지는 `"field": "필드명"` 자유 서술이라 모델이 매번 이름을 지어냈고, 그 근거는
   * resolver가 풀지 못해 **무료 AI 설명이 화면에 한 문장도 닿지 않았다**(실측).
   */
  compatibility: 'compatibility-v3-ref',
  /** v1.7 — 길이 제한 · '~수도 있어' 톤 강제 · 반복 신호 확정 금지 */
  history: 'history-v2',
  /**
   * v1.9 — Cross-source Insight 설명. headline/interpretation/situation/question만 쓴다.
   *
   * v1.27 — **v2로 올렸다.** Prompt Contract를 구조화했고(OBSERVED FACTS /
   * ALLOWED CONNECTION / LIMITATION) context에 `allowedConnection`·`limitation` 두
   * 필드가 새로 들어간다. 같은 입력이라도 **모델이 받는 것이 달라졌으므로** 버전을
   * 올려야 한다 — 안 올리면 v1 프롬프트로 만든 응답이 캐시에서 그대로 나온다.
   *
   * ⚠️ `deepReportFingerprint`는 insights/declared/target/validated/deepAnswers만
   * 해싱하므로 **프롬프트 변경을 감지하지 못한다.** 캐시 키에 promptVersion이 함께
   * 들어가는지가 관건이고, 이 상수는 결과 `meta.promptVersion`으로도 나가서
   * QA에서 어느 프롬프트로 만든 문장인지 구분하게 해준다.
   */
  deepReport: 'deep-report-v2-bounded',
} as const;

export const ANALYSIS_VERSION = '1.0';
