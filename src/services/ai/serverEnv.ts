import 'server-only';

/**
 * AI Provider 설정 — **서버 전용**
 *
 * ⚠️ `NEXT_PUBLIC_` prefix를 쓰지 않는다. API Key가 클라이언트 번들에 들어가면 안 된다.
 * 이 파일은 `server-only`를 import하므로 클라이언트에서 import하면 빌드가 실패한다.
 */

export type ServerAiMode = 'demo' | 'real';

export interface AiServerConfig {
  mode: ServerAiMode;
  provider: string;
  apiKey: string | null;
  baseUrl: string;
  textModel: string;
  visionModel: string;
  timeoutMs: number;
  /** 요청 본문 상한 — Vision 이미지가 커질 수 있으므로 명시적으로 막는다(§68) */
  maxRequestBytes: number;
}

function intFrom(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function readAiConfig(): AiServerConfig {
  const apiKey = process.env.AI_API_KEY?.trim() || null;
  const requestedReal = process.env.AI_MODE === 'real';

  return {
    // real을 요청했지만 키가 없으면 real이라고 우기지 않는다 — 호출 지점에서 CONFIG_ERROR로 처리한다.
    mode: requestedReal ? 'real' : 'demo',
    provider: process.env.AI_PROVIDER?.trim() || 'openai-compatible',
    apiKey,
    baseUrl: process.env.AI_BASE_URL?.trim() || 'https://api.openai.com/v1',
    textModel: process.env.AI_MODEL?.trim() || 'gpt-4o-mini',
    visionModel: process.env.AI_VISION_MODEL?.trim() || 'gpt-4o-mini',
    timeoutMs: intFrom(process.env.AI_TIMEOUT_MS, 45_000),
    maxRequestBytes: intFrom(process.env.AI_MAX_REQUEST_BYTES, 12 * 1024 * 1024),
  };
}

/** real 모드로 동작 가능한지. 키가 없으면 real로 부르지 않는다 */
export function canCallProvider(config: AiServerConfig): boolean {
  return config.mode === 'real' && Boolean(config.apiKey);
}
