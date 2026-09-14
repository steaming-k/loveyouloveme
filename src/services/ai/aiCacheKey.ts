import type { AiTask } from '@/types';

import { DEEP_REPORT_MODEL_ROUTE } from './modelRouting';
import { TASK_CONTRACT } from './taskContract';

/**
 * AI 결과 캐시 키 — **model-aware** (v1.47 Clean Base · Model-Aware Cache)
 *
 * ```
 * key = task :: promptVersion :: model=<resolved model> :: bundle signature(fingerprint)
 * ```
 *
 * ══ 왜 모델이 지문이 아니라 키에 있어야 하나 ═══════════════════════════════
 *
 * v1.46.4 §31은 `deepReportFingerprint`에 **코드 상수**(`DEEP_REPORT_MODEL_ROUTE`)를 넣었다.
 * 클라이언트는 서버 env를 모르므로, `AI_MODEL_DEEP_REPORT` env로만 모델을 바꾸면 지문이 그대로였고
 * 이전 모델이 만든 문장이 캐시에서 계속 나왔다(Remaining Risk로 남아 있던 것).
 *
 * 그래서 모델 칸은 **서버가 실제로 쓴 모델**(응답 `meta.model`)로 채운다:
 *
 * ```
 * 조회   이 탭이 마지막으로 확인한 모델 (없으면 첫 추정치: Deep Report = 라우팅 표 · 나머지 = shared)
 * 저장   응답 meta.model 의 키에 넣고, 이후 조회도 그 모델을 따른다
 * ```
 *
 * ⚠️ 실패 방향이 무해하다. 추정이 틀리면 첫 조회가 비고(요청 1회 더) 응답이 올바른 키로 들어간다 —
 *    다른 모델의 응답이 나오는 방향으로는 틀리지 않는다.
 * ⚠️ 지문(bundle signature)은 **입력만** 담는다. 같은 입력이면 모델이 달라도 지문은 같고, 키가 갈린다.
 * ⚠️ 이 파일은 순수 함수다(window · server-only 없음) — dev fixture 라우트가 같은 함수를 부른다.
 */

/** 서버 응답을 아직 받지 않은 Task의 모델 칸. 공용 `AI_MODEL`을 따르는 Task의 첫 추정치다 */
export const SHARED_MODEL_SEGMENT = 'shared';

/** 키에 넣을 수 있는 모델 값 — 구분자(`::`)나 공백이 섞인 값으로 키 모양이 흔들리지 않게 한다 */
const MODEL_SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._\-/]{0,79}$/;

export function initialModelOf(task: AiTask): string {
  if (task === 'deep-report-narrative' && DEEP_REPORT_MODEL_ROUTE !== 'inherit') return DEEP_REPORT_MODEL_ROUTE;
  return SHARED_MODEL_SEGMENT;
}

export function aiCacheKey(
  task: AiTask,
  model: string,
  fingerprint: string,
  promptVersion: string = TASK_CONTRACT[task].promptVersion,
): string {
  return `${task}::${promptVersion}::model=${model}::${fingerprint}`;
}

/** 응답 `meta.model`. 없거나 형식이 이상하면 null — 추정하지 않는다 */
export function responseModelOf(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const meta = (data as { meta?: unknown }).meta;
  if (typeof meta !== 'object' || meta === null) return null;
  const { model } = meta as { model?: unknown };
  return typeof model === 'string' && MODEL_SEGMENT_PATTERN.test(model) ? model : null;
}

export interface ModelRegistry {
  /** 조회에 쓸 모델 */
  expected(task: AiTask): string;
  /** 응답을 받은 뒤 — 응답이 말하는 모델을 확정하고 그 값을 돌려준다(저장 키에 쓴다) */
  settle(task: AiTask, data: unknown): string;
  reset(): void;
}

export function createModelRegistry(): ModelRegistry {
  const confirmed = new Map<AiTask, string>();
  const expected = (task: AiTask) => confirmed.get(task) ?? initialModelOf(task);
  return {
    expected,
    settle(task, data) {
      const actual = responseModelOf(data);
      /* demo처럼 모델이 없는 응답은 지금 키를 그대로 쓴다 */
      if (!actual) return expected(task);
      confirmed.set(task, actual);
      return actual;
    },
    reset() {
      confirmed.clear();
    },
  };
}
