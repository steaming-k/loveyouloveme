import 'server-only';

import type { AiTask } from '@/types';

/**
 * AI Task 필터 관측 로그 (v1.43 · §44)
 *
 * ══ 왜 Task마다 손으로 쓰지 않는가 ═══════════════════════════════════════
 *
 * v1.42가 `relationship`에 raw/parsed/safe 로그를 넣고 `raw=1[연락] allowed=[contact]`로
 * 진짜 원인을 찾았다(§41.14). 그런데 그 로그는 **그 Task의 핸들러 안에 인라인**으로
 * 있었고, 나머지 Task는 각자 다른 모양이거나(deep-report) 아예 없었다(compatibility ·
 * history).
 *
 * v1.43 Audit에서 실측한 상태:
 *
 * ```
 * [ai] relationship filter tense=former outwardQ=off raw=4[…] parsed=4 safe=4 …   ✅
 * [ai] deep-report filter parsed=3 refChecked=3 safe=2 novel=2 …                   부분
 * [ai] compatibility-narrative ok 4791ms                                            ❌ 라우트 로그뿐
 * [ai] history-insight ok 2185ms                                                    ❌ 같음
 * ```
 *
 * 그래서 `parsed=0`이 나와도 compatibility·history에서는 **원인을 고를 수 없다.** v1.43은
 * subset 검사를 새로 켜므로 이 상태에서 enforcement를 켜면 과필터를 발견할 방법이 없다 —
 * **로그가 enforcement보다 먼저다**(§19 rollout).
 *
 * ══ 절대 로그에 넣지 않는 것 ══════════════════════════════════════════════
 *
 * ⚠️ **문장 원문·필드값·사용자 자유서술을 넣지 않는다**(§34 Privacy). 세는 것은
 * **개수와 우리 enum**뿐이다:
 *
 * ```
 * ⭕ 개수(raw/parsed/safe/rejected) · 축 키(contact) · source 이름(relationship)
 *    · 위반 라벨(ongoing_relation) · 정책 값(tense=former · outwardQ=off)
 * ❌ headline/explanation/question 원문 · field 값 · entryId · traitId · 사용자 메모
 * ```
 *
 * `entryId`·`traitId`를 제외하는 이유: 둘은 우리 enum이 아니라 **세션 데이터에 붙은
 * 식별자**다. 축 키(`contact`)는 5개 중 하나라 사용자를 식별할 수 없지만 id는 다르다.
 *
 * ⚠️ **Production에서는 아무것도 남기지 않는다.**
 */

/**
 * `rawIdentifiers`에 찍을 문자열 상한. 축 키는 최대 9자(`affection`)이고 한국어 label도
 * 6자 안쪽이라 진단에는 충분하다 — 그보다 긴 값은 식별자가 아니라 문장이다.
 */
const MAX_IDENTIFIER_LOG_LENGTH = 24;

export interface AiFilterLog {
  task: AiTask;
  /** 정책 값 — 계약이 실제로 적용됐는지 보여준다. 없으면 그 Task에 해당 없음 */
  policy?: Record<string, string | number | boolean>;
  /** Provider가 만든 항목 수 */
  raw: number;
  /** 모델이 쓴 식별자 그대로 — 한국어 label이 왔는지 여기서 보인다(v1.42 §41.14) */
  rawIdentifiers?: readonly string[];
  /** 규칙이 허용한 식별자 */
  allowedIdentifiers?: readonly string[];
  /** 스키마·식별자 검사를 통과한 항목 수 */
  parsed: number;
  /** 근거 귀속 검사를 통과한 항목 수. 검사가 없는 Task는 생략 */
  refChecked?: number;
  /**
   * 근거 검사에서 거부된 ref의 **source 이름만**. v1.43 rollout의 핵심 관측치다 —
   * 정상 근거가 subset 밖으로 떨어지고 있는지 여기서 보인다.
   */
  rejectedRefSources?: readonly string[];
  /** 안전 검사를 통과한 항목 수 */
  safe: number;
  /** 안전 검사 위반 라벨 */
  violations?: readonly string[];
  /** 그 외 Task별 카운터 (`questionsStripped` · `novel` · `core` 등) */
  extra?: Record<string, string | number>;
}

function segment(label: string, value: string | number | boolean | undefined): string | null {
  if (value === undefined) return null;
  return `${label}=${value}`;
}

/**
 * 한 줄로 찍는다. **`console.info` 하나만 쓴다** — 여러 줄로 나누면 동시 요청에서
 * 서로 섞여 어느 Task의 숫자인지 알 수 없게 된다.
 */
export function logAiFilter(log: AiFilterLog): void {
  if (process.env.NODE_ENV === 'production') return;

  const parts: (string | null)[] = [`[ai] ${log.task} filter`];

  for (const [key, value] of Object.entries(log.policy ?? {})) {
    parts.push(segment(key, value));
  }

  parts.push(
    log.rawIdentifiers
      ? `raw=${log.raw}[${log.rawIdentifiers.join('|')}]`
      : `raw=${log.raw}`,
  );
  if (log.allowedIdentifiers) parts.push(`allowed=[${log.allowedIdentifiers.join('|')}]`);
  parts.push(`parsed=${log.parsed}`);
  parts.push(segment('refChecked', log.refChecked));
  if (log.rejectedRefSources && log.rejectedRefSources.length > 0) {
    parts.push(`rejectedRefs=[${log.rejectedRefSources.join('|')}]`);
  }
  parts.push(`safe=${log.safe}`);

  for (const [key, value] of Object.entries(log.extra ?? {})) {
    parts.push(segment(key, value));
  }

  if (log.violations && log.violations.length > 0) {
    parts.push(`violations=${log.violations.join(',')}`);
  }

  console.info(parts.filter((part): part is string => part !== null).join(' '));
}

/**
 * Provider raw 응답에서 `narratives[]`의 식별자만 뽑는다.
 *
 * ⚠️ **파싱 전 단계다.** `oneOf`가 거른 값(한국어 label 등)을 보려면 파서를 통과하기
 * 전에 읽어야 한다 — 그게 v1.42 §41.14가 raw 층을 추가한 이유다.
 *
 * ⚠️ 문자열을 그대로 찍으므로 **식별자 필드에만** 쓴다(`axis` · `dimensionKey` ·
 * `insightId`). `field`·`traitId`·`entryId`에는 쓰지 않는다.
 */
export function rawNarrativeIdentifiers(raw: unknown, key: string): string[] {
  if (raw === null || typeof raw !== 'object') return [];
  const list = (raw as { narratives?: unknown }).narratives;
  if (!Array.isArray(list)) return [];

  return list.map((item) => {
    if (item === null || typeof item !== 'object') return '?';
    const value = (item as Record<string, unknown>)[key];
    if (typeof value !== 'string') return '?';
    /**
     * ⚠️ **길이 상한.** 이 값은 우리 enum이 **아니라 모델이 쓴 문자열**이다. v1.42는
     * 그걸 그대로 찍기로 했고 그 판단이 v6의 원인(`raw=1[연락]`)을 찾아줬다 — 계약 위반은
     * 값을 봐야 진단할 수 있다.
     *
     * 그래도 상한 없이 두면 모델이 그 자리에 긴 문장을 넣었을 때 **로그에 사용자 문맥이
     * 섞일 수 있다.** 축 키는 최대 9자(`affection`)이고 한국어 label도 6자 안쪽이므로
     * 24자에서 자르면 진단에는 충분하고 문장은 통과하지 못한다.
     */
    return value.length > MAX_IDENTIFIER_LOG_LENGTH
      ? `${value.slice(0, MAX_IDENTIFIER_LOG_LENGTH)}…`
      : value;
  });
}

/** raw `narratives[]` 길이 — 모델이 아무것도 만들지 않은 것과 파서가 버린 것을 가른다 */
export function rawNarrativeCount(raw: unknown): number {
  if (raw === null || typeof raw !== 'object') return 0;
  const list = (raw as { narratives?: unknown }).narratives;
  return Array.isArray(list) ? list.length : 0;
}
