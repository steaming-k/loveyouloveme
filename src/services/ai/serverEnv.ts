import 'server-only';

/**
 * AI Provider 설정 — **서버 전용**
 *
 * ⚠️ `NEXT_PUBLIC_` prefix를 쓰지 않는다. API Key가 클라이언트 번들에 들어가면 안 된다.
 * 이 파일은 `server-only`를 import하므로 클라이언트에서 import하면 빌드가 실패한다.
 */

/**
 * `mock`은 v1.7에서 추가한 **개발 전용** 모드다(§5).
 *
 * 실제 Provider Key가 없는 환경에서 Narrative 배선·Evidence Resolver·규칙 덮어쓰기·
 * 화면 렌더까지를 실제 코드 경로로 검증하기 위한 것이다. Provider를 부르지 않고,
 * 검증 단계를 **건너뛰지도 않는다** — 파싱·Business Validation·Safety Scan을 모두 통과한다.
 *
 * ⚠️ Production에서는 강제로 무시된다. 그리고 결과 `meta.mode`는 `'mock'`이므로
 * 화면·Analytics·History 어디에서도 real인 척하지 않는다.
 */
export type ServerAiMode = 'demo' | 'real' | 'mock';

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

function resolveMode(): ServerAiMode {
  const requested = process.env.AI_MODE;
  if (requested === 'real') return 'real';
  // mock은 개발 환경에서만 허용한다. Production에서 실수로 켜지면 조용히 demo로 내려간다.
  if (requested === 'mock' && process.env.NODE_ENV !== 'production') return 'mock';
  return 'demo';
}

export function readAiConfig(): AiServerConfig {
  const apiKey = process.env.AI_API_KEY?.trim() || null;

  return {
    // real을 요청했지만 키가 없으면 real이라고 우기지 않는다 — 호출 지점에서 CONFIG_ERROR로 처리한다.
    mode: resolveMode(),
    provider: process.env.AI_PROVIDER?.trim() || 'openai-compatible',
    apiKey,
    baseUrl: process.env.AI_BASE_URL?.trim() || 'https://api.openai.com/v1',
    textModel: process.env.AI_MODEL?.trim() || 'gpt-4o-mini',
    visionModel: process.env.AI_VISION_MODEL?.trim() || 'gpt-4o-mini',
    timeoutMs: intFrom(process.env.AI_TIMEOUT_MS, 45_000),
    maxRequestBytes: intFrom(process.env.AI_MAX_REQUEST_BYTES, 12 * 1024 * 1024),
  };
}

/**
 * Provider(또는 mock)를 호출할 수 있는지.
 * real은 키가 있어야 한다 — 키가 없으면 real로 부르지 않는다.
 */
export function canCallProvider(config: AiServerConfig): boolean {
  if (config.mode === 'mock') return true;
  return config.mode === 'real' && Boolean(config.apiKey);
}
