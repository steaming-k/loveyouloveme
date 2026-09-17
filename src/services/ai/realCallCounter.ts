/**
 * P0 Real AI Guard — **실제 Provider fetch 횟수** (프로세스 메모리)
 *
 * `provider.ts`가 실제 `/chat/completions` 요청 직전에 1을 더한다. mock · demo는 세지 않는다.
 * `tests/run-ai-guard-fixtures.mjs`가 `/api/dev/ai-guard`로 읽어 "일반 테스트 = 실제 호출 0"을 확인한다.
 *
 * ⚠️ globalThis에 둔다 — dev 서버는 라우트마다 모듈을 따로 번들할 수 있어서, 모듈 변수면
 *    라우트끼리 다른 카운터를 보게 된다. 사용자 데이터는 없다(숫자 하나).
 */

const KEY = '__lymRealProviderCalls';

type CounterHost = typeof globalThis & { [KEY]?: number };

export function recordRealProviderCall(): void {
  const host = globalThis as CounterHost;
  host[KEY] = (host[KEY] ?? 0) + 1;
}

export function realProviderCallCount(): number {
  return (globalThis as CounterHost)[KEY] ?? 0;
}
