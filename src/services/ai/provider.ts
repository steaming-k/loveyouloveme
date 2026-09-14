import 'server-only';

import { createMockProvider } from './mockProvider';
import { recordRealProviderCall } from './realCallCounter';
import { canCallProvider, isRealProviderBlocked, readAiConfig, type AiServerConfig } from './serverEnv';
import type { AiFailureReason, AiProviderTask } from '@/types';

/**
 * Provider Abstraction (§5)
 *
 * 화면·서비스 코드가 특정 AI Vendor에 결합되지 않도록 이 인터페이스만 노출한다.
 * 구현은 OpenAI 호환 Chat Completions(JSON mode)를 `fetch`로 직접 호출한다 —
 * SDK 의존성을 추가하지 않고, Provider를 바꿀 때 이 파일만 교체하면 된다.
 */

export interface ProviderImage {
  imageId: string;
  /** `data:image/jpeg;base64,...` */
  dataUrl: string;
}

export interface GenerateStructuredInput {
  /**
   * 어떤 Task의 요청인지. 실제 Provider 구현은 쓰지 않지만, mock provider가
   * **프롬프트 문자열을 추측하지 않도록** 명시적으로 넘긴다(v1.7).
   */
  task: AiProviderTask;
  systemPrompt: string;
  /** 사용자 데이터는 여기에만 담는다 — system instruction과 섞지 않는다(§69) */
  userPayload: string;
  images?: ProviderImage[];
  /** 응답 스키마 설명 (프롬프트에 포함해 JSON 형태를 고정한다) */
  useVisionModel?: boolean;
}

export class AiProviderError extends Error {
  constructor(
    readonly reason: AiFailureReason,
    message: string,
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}

export interface AiProviderUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  cachedTokens: number | null;
  reasoningTokens: number | null;
}

export interface AiProvider {
  readonly model: string;
  /** 항상 JSON 객체를 돌려준다. 파싱 실패는 INVALID_OUTPUT */
  generateStructured(input: GenerateStructuredInput): Promise<unknown>;
  /**
   * v1.46.4 Model A/B §26 — **마지막 호출의 토큰 사용량.** Provider가 주지 않았으면 null.
   *
   * ⚠️ 반환값에 섞지 않고 옆자리에 둔다. `generateStructured`의 계약은 "JSON 객체 하나"이고
   * 모든 파서가 그 전제로 짜여 있다 — 사용량을 반환값에 넣으면 여섯 핸들러가 전부
   * 바뀐다. Provider 인스턴스는 핸들러 호출마다 새로 만들어지므로(`resolveProvider`)
   * 동시 요청 사이에 값이 섞이지 않는다.
   *
   * ⚠️ 토큰 수는 사용자 데이터가 아니다 — 로그에 남겨도 된다(§34 Privacy).
   */
  readonly lastUsage: AiProviderUsage | null;
}

/** HTTP status → 사용자에게 보여줄 실패 분류 */
function reasonFromStatus(status: number): AiFailureReason {
  if (status === 429) return 'RATE_LIMIT';
  if (status === 400 || status === 422) return 'INVALID_OUTPUT';
  if (status === 401 || status === 403) return 'CONFIG_ERROR';
  return 'SERVER_ERROR';
}

function createOpenAiCompatibleProvider(
  config: AiServerConfig,
  useVision: boolean,
  modelOverride?: string,
): AiProvider {
  const model = modelOverride ?? (useVision ? config.visionModel : config.textModel);
  let lastUsage: AiProviderUsage | null = null;

  return {
    model,
    get lastUsage() {
      return lastUsage;
    },
    async generateStructured(input) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.timeoutMs);

      // 이미지는 user 메시지의 content 배열로만 넣는다.
      const userContent: unknown[] = [{ type: 'text', text: input.userPayload }];
      for (const image of input.images ?? []) {
        userContent.push({ type: 'image_url', image_url: { url: image.dataUrl } });
      }

      try {
        /* P0 — 두 번째 방어선. 모드 강등을 거치지 않은 경로가 생겨도 opt-in 없는 테스트 요청은 여기서 멈춘다 */
        if (isRealProviderBlocked()) {
          throw new AiProviderError('CONFIG_ERROR', 'real provider blocked for test run without opt-in');
        }
        recordRealProviderCall();
        const response = await fetch(`${config.baseUrl}/chat/completions`, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model,
            temperature: 0.4,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: input.systemPrompt },
              { role: 'user', content: userContent },
            ],
          }),
        });

        if (!response.ok) {
          // Provider 원문 에러를 클라이언트로 흘리지 않는다(§68) — 분류만 올린다.
          throw new AiProviderError(
            reasonFromStatus(response.status),
            `provider responded ${response.status}`,
          );
        }

        const json: unknown = await response.json();
        lastUsage = extractUsage(json);
        const content = extractContent(json);

        if (content === null) throw new AiProviderError('INVALID_OUTPUT', 'no content');
        // Provider가 안전 정책으로 막으면 보통 refusal 텍스트가 온다.
        if (looksLikeRefusal(content)) {
          throw new AiProviderError('POLICY_BLOCK', 'provider refused');
        }

        try {
          return JSON.parse(content);
        } catch {
          throw new AiProviderError('INVALID_OUTPUT', 'content is not JSON');
        }
      } catch (error) {
        if (error instanceof AiProviderError) throw error;
        if (error instanceof Error && error.name === 'AbortError') {
          throw new AiProviderError('TIMEOUT', 'provider timeout');
        }
        throw new AiProviderError('NETWORK_ERROR', 'provider unreachable');
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/** OpenAI 호환 `usage` 블록. 필드가 없으면 null — 추정하지 않는다(§26) */
function extractUsage(json: unknown): AiProviderUsage | null {
  if (typeof json !== 'object' || json === null) return null;
  const usage = (json as { usage?: Record<string, unknown> }).usage;
  if (!usage || typeof usage !== 'object') return null;
  const num = (value: unknown) => (typeof value === 'number' ? value : null);
  const details = (key: string) =>
    (usage[key] && typeof usage[key] === 'object' ? usage[key] : {}) as Record<string, unknown>;
  return {
    inputTokens: num(usage.prompt_tokens),
    outputTokens: num(usage.completion_tokens),
    cachedTokens: num(details('prompt_tokens_details').cached_tokens),
    reasoningTokens: num(details('completion_tokens_details').reasoning_tokens),
  };
}

function extractContent(json: unknown): string | null {
  if (typeof json !== 'object' || json === null) return null;
  const choices = (json as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = (choices[0] as { message?: { content?: unknown; refusal?: unknown } }).message;
  if (typeof message?.refusal === 'string' && message.refusal.length > 0) return message.refusal;
  return typeof message?.content === 'string' ? message.content : null;
}

function looksLikeRefusal(content: string): boolean {
  const trimmed = content.trim();
  // JSON이 아니고 거절 문구처럼 보이면 정책 차단으로 본다.
  return !trimmed.startsWith('{') && /cannot|unable|sorry|policy|거절|불가/i.test(trimmed);
}

/**
 * 현재 설정으로 Provider를 만든다. real이 아니거나 키가 없으면 null —
 * 호출 지점이 demo/fallback으로 처리한다.
 */
export function resolveProvider(
  useVision: boolean,
  /**
   * v1.46.4 Model A/B §8 — **Task 단위 모델.** 생략하면 기존과 같다(`textModel`).
   *
   * ⚠️ 지금 이 인자를 넘기는 곳은 `runDeepReportTask` 하나다. 렌즈·Cross-Lens·
   * compatibility는 인자 없이 부르므로 이 변경의 영향이 구조적으로 없다(§44).
   */
  modelOverride?: string,
): AiProvider | null {
  const config = readAiConfig();
  if (!canCallProvider(config)) return null;
  // 개발 전용 mock — 실제 Provider를 부르지 않지만 검증 단계는 그대로 통과한다(§5).
  if (config.mode === 'mock') return createMockProvider();
  return createOpenAiCompatibleProvider(config, useVision, modelOverride);
}
