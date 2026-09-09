import type { AiMode } from '@/types';

/**
 * AI 결과 `meta`의 **런타임 방어** (v1.44 · BUG-003)
 *
 * ══ 왜 필요한가 ═══════════════════════════════════════════════════════════
 *
 * 타입상 `meta`는 필수이고 서버는 언제나 `buildMeta()`로 채운다. 그런데 **타입은
 * 런타임 계약이 아니다.** 이 값이 지나가는 길에는 타입 검사를 받지 않는 지점이 두
 * 군데 있다 — **네트워크 응답**과 **세션 스토리지 복원**이다. v1.43 QA(ERR-005)에서
 * `meta:null` 응답 하나가 `cached.meta.mode`에서 unhandled promise rejection을
 * 만들었고, 손상된 세션의 `observedAnalysis`는 `meta` 없이 복원될 수 있다.
 *
 * ══ 무엇을 바꾸지 않는가 ══════════════════════════════════════════════════
 *
 * **계약을 느슨하게 만드는 것이 아니다.** 서버는 계속 `meta`를 반드시 보내고, 파싱과
 * Business Validation도 그대로다. 바뀌는 것은 **소비자가 계약 위반에 어떻게
 * 반응하는가** 하나뿐이다 — 화면을 깨뜨리는 대신 '모른다'로 처리한다.
 *
 * ══ 왜 별 파일인가 ═══════════════════════════════════════════════════════
 *
 * 원래는 `useAiNarrative.ts`(`'use client'` 훅)와 `SessionProvider.tsx` 안의 지역
 * 코드였다. 두 곳 모두 **React 밖에서 호출할 수 없어** fixture로 고정할 수 없었다 —
 * v1.44 PostFix에서 BUG-003만 자동 회귀가 비어 있던 이유가 그것이다. 순수 함수 두 개를
 * 여기로 옮기면 `/api/dev/trust-test`가 화면과 **같은 함수**를 호출할 수 있다.
 * 테스트를 위해 훅 내부를 export하지 않는다 — 옮기는 것은 판정이 없는 helper뿐이다.
 */

/**
 * AI 응답의 `meta.mode`를 읽는다. 읽을 수 없으면 `null`('모드를 모른다')이다.
 *
 * `mode`는 배지 표시에만 쓰이고 판정은 deterministic 결과가 이미 갖고 있으므로,
 * 모드를 모르는 것과 화면이 깨지는 것 사이에서 앞을 고른다.
 */
export function aiModeOf(data: unknown): AiMode | null {
  if (typeof data !== 'object' || data === null) return null;
  const meta = (data as { meta?: unknown }).meta;
  if (typeof meta !== 'object' || meta === null) return null;
  const { mode } = meta as { mode?: unknown };
  return typeof mode === 'string' ? (mode as AiMode) : null;
}

/**
 * 두 Observed 분석이 **같은 입력에서 나왔는가** — 관찰 피드백을 유지할지 정한다.
 *
 * ⚠️ 지문을 읽을 수 없으면 **다르다고 답한다.** 예전 코드는
 * `prev?.meta.inputFingerprint === result?.meta.inputFingerprint`였는데, 둘 다 `meta`가
 * 없으면 `undefined === undefined`가 `true`가 되어 **'같은 분석'으로 오판**했다.
 * 그러면 이전 trait에 달린 피드백이 새 trait id에 잘못 붙는다. 확신할 수 없을 때는
 * 피드백을 비우는 쪽이 안전하다 — 사용자는 다시 답할 수 있지만, 잘못 붙은 답은
 * 사용자가 하지 않은 말이 된다.
 */
export function sameAnalysisFingerprint(prev: unknown, next: unknown): boolean {
  const a = fingerprintOf(prev);
  const b = fingerprintOf(next);
  return a !== null && a === b;
}

function fingerprintOf(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const meta = (data as { meta?: unknown }).meta;
  if (typeof meta !== 'object' || meta === null) return null;
  const { inputFingerprint } = meta as { inputFingerprint?: unknown };
  return typeof inputFingerprint === 'string' ? inputFingerprint : null;
}
