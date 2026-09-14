/**
 * P0 Real AI Guard — **모든 테스트 스크립트가 맨 위에서 import한다.**
 *
 * ```
 * 기본            이 프로세스의 모든 fetch에 x-lym-test-run: 1 을 붙인다
 *                 → 서버가 AI_MODE=real이어도 mock으로 응답한다 · 실제 Provider 0회
 * opt-in          ALLOW_REAL_AI_TESTS=1 일 때만 x-lym-allow-real-ai: 1 을 함께 붙인다
 * 유료 스크립트    assertRealAiTestAllowed()를 요청 전에 부른다 — opt-in 없으면 exit 2
 * ```
 *
 * ⚠️ 헤더는 호출을 줄이기만 한다. opt-in이어도 서버 env가 real이 아니면 real이 되지 않는다.
 * ⚠️ 새 테스트 파일도 반드시 이 파일을 import한다 — `run-ai-guard-fixtures.mjs`가 전 파일을 검사한다.
 */

export const REAL_AI_OPT_IN = process.env.ALLOW_REAL_AI_TESTS === '1';

const INSTALLED = Symbol.for('lym.aiTestGuard.installed');

if (!globalThis[INSTALLED]) {
  globalThis[INSTALLED] = true;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init = {}) => {
    const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set('x-lym-test-run', '1');
    if (REAL_AI_OPT_IN) headers.set('x-lym-allow-real-ai', '1');
    else headers.delete('x-lym-allow-real-ai');
    return originalFetch(input, { ...init, headers });
  };
}

export function assertRealAiTestAllowed(label) {
  if (REAL_AI_OPT_IN) {
    console.log(`⚠️  ${label} — ALLOW_REAL_AI_TESTS=1 · 실제 Provider를 호출한다(비용 발생)`);
    return;
  }
  console.error(
    `⛔ ${label} — 실제 AI Provider를 부르는 유료 테스트다. ` +
      'ALLOW_REAL_AI_TESTS=1 을 명시한 경우에만 실행한다. 요청을 보내지 않고 종료한다.',
  );
  process.exit(2);
}
