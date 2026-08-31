import 'server-only';

import { canCallProvider, readAiConfig, type AiServerConfig } from './serverEnv';
import type { AiFailureReason } from '@/types';

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

export interface AiProvider {
  readonly model: string;
  /** 항상 JSON 객체를 돌려준다. 파싱 실패는 INVALID_OUTPUT */
  generateStructured(input: GenerateStructuredInput): Promise<unknown>;
}

/** HTTP status → 사용자에게 보여줄 실패 분류 */
function reasonFromStatus(status: number): AiFailureReason {
  if (status === 429) return 'RATE_LIMIT';
  if (status === 400 || status === 422) return 'INVALID_OUTPUT';
  if (status === 401 || status === 403) return 'CONFIG_ERROR';
  return 'SERVER_ERROR';
}

function createOpenAiCompatibleProvider(config: AiServerConfig, useVision: boolean): AiProvider {
  const model = useVision ? config.visionModel : config.textModel;

  return {
    model,
    async generateStructured(input) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.timeoutMs);

      // 이미지는 user 메시지의 content 배열로만 넣는다.
      const userContent: unknown[] = [{ type: 'text', text: input.userPayload }];
      for (const image of input.images ?? []) {
        userContent.push({ type: 'image_url', image_url: { url: image.dataUrl } });
      }

      try {
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
export function resolveProvider(useVision: boolean): AiProvider | null {
  const config = readAiConfig();
  if (!canCallProvider(config)) return null;
  return createOpenAiCompatibleProvider(config, useVision);
}
