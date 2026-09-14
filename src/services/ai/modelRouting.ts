import type { AiTask } from '@/types';

/**
 * Task-level Model Routing — **Deep Report Semantic Task만** (v1.46.4 Model A/B · §8 · §31)
 *
 * ══ 왜 이 파일이 생겼나 ═══════════════════════════════════════════════════
 *
 * v1.46.4 SEMANTIC의 실제 Provider QA에서 semantic 24건이 게이트를 전부 통과하지 못했다.
 * 저장·선별·호출 수·게이트·UI는 전부 동작했고, 남은 병목은 **모델 출력 품질**이었다.
 * 그걸 확정하려면 **변수를 하나만** 바꿔야 한다 — 프롬프트·fixture·게이트는 그대로 두고
 * deep-report 한 Task의 모델만.
 *
 * 그전까지 모든 텍스트 Task는 `serverEnv.textModel` 하나를 공유했다:
 *
 * ```
 * deep-report · mbti-lens · saju-lens · zodiac-lens · cross-lens · compatibility · …
 *   └─ 전부 AI_MODEL (미설정 시 gpt-4o-mini)
 * ```
 *
 * `AI_MODEL`을 바꾸면 여섯 Task가 한꺼번에 바뀌어서 A/B가 성립하지 않는다(§44 — 실험
 * 변수를 하나로 유지). 그래서 deep-report에만 override 자리를 만든다.
 *
 * ══ 이 파일이 비밀이 아닌 이유 ═════════════════════════════════════════════
 *
 * 모델 id는 API Key가 아니다. 이 파일은 `server-only`를 import하지 않는다 — **클라이언트
 * 캐시 키(`aiCacheKey.ts`)도 이 값을 첫 추정치로 읽는다.** 실제 키는 서버 응답의 모델로
 * 확정된다(v1.47 Model-Aware Cache).
 */

/**
 * Deep Report Semantic Task의 **제품 라우팅.**
 *
 * `'inherit'` = 다른 Task와 같은 `AI_MODEL`을 따른다. v1.46.4 HARDENING까지의 동작과
 * 글자 그대로 같다.
 *
 * ⚠️ A/B winner가 확정되고 **사용자가 승인한 뒤에만** 구체 모델 id로 바꾼다(§30 · §46).
 *
 * v1.47 — **gpt-5.4 채택.** v1.46.4 R3 D Provider QA ×3 PASS 뒤 디렉팅으로 승인됐고 **Deep Report만**
 * 바뀐다. 공용 `AI_MODEL`은 그대로다 — 렌즈 · Cross-Lens · 그 밖의 Task는 기존 모델을 쓴다.
 * 캐시는 이 상수가 아니라 서버 응답의 `meta.model`을 따른다(`aiCacheKey.ts`).
 */
export const DEEP_REPORT_MODEL_ROUTE: 'inherit' | string = 'gpt-5.4';

/**
 * 모델 id 형식 검사. dev override·env 값이 **프롬프트 인젝션 통로가 되지 않게** 좁힌다.
 *
 * ⚠️ 목록(allowlist)이 아니라 형식이다 — Provider가 새 모델을 내놓을 때마다 이 파일을
 * 고치지 않기 위해서다. 실제 사용 가능 여부는 Provider가 400으로 알려준다.
 */
export function isPlausibleModelId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9.\-]{2,48}$/.test(value);
}

/**
 * 서버에서 deep-report가 실제로 부를 모델.
 *
 * 우선순위:
 * ```
 * ① devOverride          개발 환경 + 명시 요청일 때만 (A/B 하네스 전용 · §9)
 * ② AI_MODEL_DEEP_REPORT  환경 변수 — 배포 환경에서 이 Task만 바꿀 때
 * ③ DEEP_REPORT_MODEL_ROUTE가 구체 id면 그 값
 * ④ textModel            다른 Task와 공유하는 기본값 (inherit)
 * ```
 *
 * ⚠️ ①은 호출부(라우트)가 이미 `NODE_ENV !== 'production'`을 확인한 값만 넘긴다.
 * 이 함수는 한 번 더 확인한다 — 두 곳 중 한 곳만 확인하면 새 호출부가 빼먹는다.
 */
export function deepReportModelFor(input: {
  textModel: string;
  envOverride: string | undefined;
  devOverride: string | undefined;
  nodeEnv: string | undefined;
}): string {
  if (input.nodeEnv !== 'production' && isPlausibleModelId(input.devOverride)) {
    return input.devOverride;
  }
  const fromEnv = input.envOverride?.trim();
  if (isPlausibleModelId(fromEnv)) return fromEnv;
  if (DEEP_REPORT_MODEL_ROUTE !== 'inherit' && isPlausibleModelId(DEEP_REPORT_MODEL_ROUTE)) {
    return DEEP_REPORT_MODEL_ROUTE;
  }
  return input.textModel;
}

/**
 * Task가 **실제로 부를** 텍스트 모델 (v1.47 — routing fixture · 감사용).
 *
 * ```
 * deep-report-narrative   deepReportModelFor (env → 라우팅 표 → 공용)
 * 그 밖의 텍스트 Task      공용 textModel(AI_MODEL) — resolveProvider(false)를 인자 없이 부른다
 * ```
 *
 * ⚠️ dev override는 넣지 않는다 — A/B 하네스 요청 단위 값이라 '배포가 쓰는 모델'이 아니다.
 */
export function plannedTextModelFor(
  task: AiTask,
  input: { textModel: string; envOverride: string | undefined; nodeEnv: string | undefined },
): string {
  if (task !== 'deep-report-narrative') return input.textModel;
  return deepReportModelFor({ ...input, devOverride: undefined });
}
