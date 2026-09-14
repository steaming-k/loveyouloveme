import type { AiTask } from '@/types';

/**
 * Task-level Model Routing — **Deep Report Semantic Task만** (v1.46.4 Model A/B · v1.47 Integration)
 *
 * ══ 왜 이 파일이 생겼나 ═══════════════════════════════════════════════════
 *
 * 모든 텍스트 Task는 `serverEnv.textModel`(AI_MODEL) 하나를 공유한다:
 *
 * ```
 * deep-report · mbti-lens · saju-lens · zodiac-lens · cross-lens · compatibility · …
 *   └─ 전부 AI_MODEL (미설정 시 gpt-4o-mini)
 * ```
 *
 * `AI_MODEL`을 바꾸면 여섯 Task가 한꺼번에 바뀐다. 그래서 deep-report에만 override 자리를 둔다.
 *
 * ══ v1.47 Integration — 모델 값은 env가 정한다 ════════════════════════════
 *
 * 코드는 **"Deep Report가 별도 모델을 받을 수 있는 자리"만** 갖는다. 구체 모델 id를 코드에 두지
 * 않는다 — 두면 main 병합 순간 production이 설정과 무관하게 그 모델을 쓴다.
 *
 * ```
 * local/dev · preview/staging   AI_MODEL_DEEP_REPORT=gpt-5.4
 * production                    명시적으로 설정할 때만 (없으면 공용 AI_MODEL)
 * ```
 *
 * 캐시는 서버 응답의 `meta.model`(실제로 쓴 모델)을 따른다(`aiCacheKey.ts`) — env만 바꿔도 키가 갈린다.
 */

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
 * ① devOverride           개발 환경 + 명시 요청일 때만 (A/B 하네스 전용 · §9)
 * ② AI_MODEL_DEEP_REPORT   env — 이 Task만 바꿀 때
 * ③ textModel             공용 AI_MODEL (그것도 없으면 serverEnv의 기본값)
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
  return input.textModel;
}

/**
 * Task가 **실제로 부를** 텍스트 모델 (v1.47 — routing fixture · 감사용).
 *
 * ```
 * deep-report-narrative   deepReportModelFor (env → 공용)
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
