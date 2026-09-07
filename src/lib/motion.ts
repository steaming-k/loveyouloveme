/**
 * Motion 공통 값 (vNext)
 *
 * CSS 쪽 토큰(`--motion-fast/normal/slow`, `--ease-observe`)과 **같은 값**을 JS에서도
 * 쓰기 위한 한 곳이다. 화면마다 setTimeout에 매직 넘버를 흩뿌리지 않는다.
 *
 * ⚠️ 여기 있는 값은 **presentation layer 전용**이다. 분석·결제 같은 실제 처리를 이 시간만큼
 * 늦추는 데 쓰지 않는다 — 이미 확정된 상태 변화를 사용자가 인지하게 만드는 용도다.
 */
export const MOTION = {
  /** 버튼 press 등 즉각 피드백 */
  fast: 150,
  /** 화면 안 상태 전환 */
  normal: 300,
  /** 큰 표면(Report 등) 등장 */
  slow: 400,
} as const;

/**
 * 관찰 시퀀스(`LovyObservation`) 타이밍 — **한 곳에서만 관리한다** (v1.38)
 *
 * v1.37까지 `OBSERVATION_STAGE_MS = 1400`이 `data/copy.ts`(카피 파일)에 있었다. 시간은
 * 카피가 아니라 모션이므로 여기로 옮겼다. 화면별 setTimeout에 매직 넘버를 두지 않는다.
 *
 * **왜 1400 → 520인가.** v1.22가 1100 → 1400으로 올린 이유는 *"각 단계 문구가 읽히기 전에
 * 다음 단계로 넘어간다"* 였다. 그건 단계가 **교체**(앞 문장이 사라짐)됐기 때문이고, 그러면
 * 한 줄을 읽는 데 필요한 시간이 그대로 대기 시간이 된다. v1.38은 문장을 **쌓는다** —
 * 앞 줄이 사라지지 않으므로 사용자가 자기 속도로 읽으면 되고, 단계 간격이 '읽는 시간'을
 * 책임질 필요가 없다. 그래서 간격을 줄여도 v1.22가 고친 문제가 돌아오지 않는다.
 *
 * ⚠️ 이 값은 **결과를 늦추는 데 쓰지 않는다.** 궁합은 순수 계산이라 이 시간이 그대로
 * 사용자 대기가 되므로(§S20) 짧게 유지하고, 사진 분석은 실제 응답이 더 늦으면 호출부가
 * 마지막 단계에서 기다린다 — 그때 화면은 '완성됐어'가 아니라 아직 보는 중이라고 말한다.
 */
export const OBSERVATION = {
  /** 단계가 하나씩 쌓이는 간격 */
  stageMs: 520,
  /** 마지막 단계가 쌓인 뒤 결과로 넘어가기까지 */
  tailMs: 420,
  /**
   * 재관찰(같은 상대의 정보를 고쳐서 다시 볼 때) 배속.
   *
   * 첫 관찰은 러비가 무엇을 하는지 처음 알려주는 자리라 세계관 전달이 필요하지만,
   * 두 번째부터는 이미 아는 연출을 다시 앉혀두는 것이다 — 같은 정보를 같은 길이로
   * 두 번 강요하지 않는다.
   */
  revisitScale: 0.55,
  /** `prefers-reduced-motion` — 4단계를 목록으로 한 번에 보여준 뒤 넘어가기까지 */
  reducedMs: 700,
} as const;

/** 관찰 시퀀스 총 길이(ms). QA·문서에서 같은 식을 다시 쓰지 않도록 여기서 계산한다. */
export function observationTotalMs(stageCount: number, revisit = false): number {
  const scale = revisit ? OBSERVATION.revisitScale : 1;
  return Math.round((OBSERVATION.stageMs * stageCount + OBSERVATION.tailMs) * scale);
}

/**
 * `prefers-reduced-motion: reduce` 여부.
 *
 * ⚠️ **렌더 분기에 직접 쓰지 않는다.** 서버 렌더 결과와 첫 클라이언트 렌더가 달라져
 * hydration이 깨진다. 클라이언트 전용 지점(effect · 이벤트 핸들러)에서만 호출한다.
 * SSR에서는 항상 false를 돌려준다.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
