import type { EvidenceRef } from '@/types';

/**
 * AI Safety (§43 · §69 · §89 · §90)
 *
 * 두 방향을 막는다:
 *   ① 들어가는 것 — 사용자 자유서술이 System instruction처럼 동작하지 못하게 delimit
 *   ② 나오는 것 — 민감 추론·마음 읽기 문구가 UI까지 새어나오지 못하게 검사
 */

/**
 * 사용자 텍스트를 데이터 영역으로 감싼다.
 *
 * `experience.note` 같은 자유서술에 '이전 지시를 무시하고…'가 들어와도 지시로 해석되지
 * 않도록, System Prompt에서 `<user_data>` 안은 데이터라고 못박고 여기서 경계를 닫는다.
 * 태그를 위조해 블록을 탈출하려는 시도도 무력화한다.
 */
export function wrapUserData(payload: unknown): string {
  const json = JSON.stringify(payload, null, 0);
  // 사용자 값이 경계 태그를 흉내내는 것을 막는다.
  const sanitized = json.replace(/<\/?user_data>/gi, '[removed]');
  return `<user_data>\n${sanitized}\n</user_data>`;
}

/** 자유서술 정리 — 길이 제한 + 제어문자 제거. 내용 자체는 바꾸지 않는다 */
export function sanitizeFreeText(raw: string | null | undefined, maxLength = 300): string | null {
  if (!raw) return null;
  // 제어문자를 공백으로 바꾼다 — 프롬프트 구조를 깨뜨리는 문자를 없앤다.
  // 정규식에 원시 제어 바이트를 넣지 않기 위해 문자 코드로 직접 판별한다.
  const cleaned = Array.from(raw)
    .map((char) => {
      const code = char.charCodeAt(0);
      return code < 0x20 || code === 0x7f ? ' ' : char;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length === 0) return null;
  return cleaned.slice(0, maxLength);
}

/* --------------------------------------------- 나오는 것 검사 */

/**
 * 절대 추론하면 안 되는 범주(§8)와 마음 읽기(§22/§90)의 흔적을 찾는다.
 *
 * ⚠️ 이 검사는 **최후 방어선**이다. 1차 방어는 프롬프트이고, 여기서 걸리면 그 항목을 버린다.
 * 완벽한 필터가 아니라 '명백한 위반을 통과시키지 않는' 장치다.
 */
const FORBIDDEN_PATTERNS: readonly { label: string; pattern: RegExp }[] = [
  { label: 'sexual_orientation', pattern: /동성애|이성애|성적\s*지향|퀴어|게이|레즈비언/ },
  { label: 'politics', pattern: /정치\s*성향|보수적인\s*사람|진보적인\s*사람|지지\s*정당/ },
  { label: 'religion', pattern: /종교적인\s*사람|신앙심|독실|불교\s*신자|기독교\s*신자|무신론자/ },
  { label: 'health', pattern: /우울증|불안장애|정신\s*건강|질병|장애가\s*있|병력|치료가\s*필요/ },
  { label: 'attachment_type', pattern: /회피형|불안형|안정형|애착\s*유형/ },
  { label: 'wealth', pattern: /소득\s*수준|경제력이|부유한|가난한|재력/ },
  { label: 'appearance', pattern: /외모|매력도|얼굴이\s*(잘|예|못)|체형|나이는\s*\d+대로\s*보/ },
  {
    /**
     * 상대 마음 읽기 (§14 · §22).
     *
     * ⚠️ v1.7에서 고쳤다. 이전 패턴은 `상대(는|가)\s*(너를)?\s*(좋아|사랑|싫어)하[고는며]`로
     * **주어와 동사가 거의 붙어 있을 때만** 걸렸다. 그래서 '상대는 너를 **더** 좋아하고 있어서'가
     * 통과했고, '상대가 서운해할 수 있어'는 아예 목록에 없었다.
     * 이제 '상대' 뒤 한 절 안에서 감정·의도 동사가 나오면 잡는다.
     *
     * 의도적으로 **남겨두는 표현**: '상대가 어떻게 느낄지는 알 수 없어'처럼 모른다고 말하는
     * 문장은 마음 읽기가 아니라 정직한 한계 진술이므로 동사 목록에 '느끼/느낄'을 넣지 않았다.
     */
    label: 'mind_reading',
    pattern:
      /상대(는|가|방은|방이)[^.!?\n]{0,24}(좋아하|사랑하|싫어하|서운|질투|미워하|원하는\s*건|분명)|상대\s*(의)?\s*(진심|속마음)/,
  },
  { label: 'success_probability', pattern: /성공\s*(확률|가능성)\s*\d|결혼\s*확률|이별\s*확률|헤어질\s*확률/ },
  { label: 'diagnosis', pattern: /당신은\s*본질적으로|당신의\s*무의식|성격\s*장애/ },
  { label: 'relationship_verdict', pattern: /상극|천생연분|운명적인\s*커플|결혼하면\s*안\s*된/ },
];

/**
 * Core Narrative에 Lens 정보가 새어 나오는지 검사한다 (v1.7 · §36).
 *
 * Core Task의 Context에는 MBTI·출생정보·별자리를 **애초에 보내지 않는다**(§26/§80).
 * 그런데도 응답에 등장하면 AI가 만들어낸 것이므로 그 항목을 버린다 —
 * 위계를 뒤집는 문장('당신은 INFP라서 연락을 …')이 Core 설명에 섞이면 안 된다.
 */
const LENS_LEAK_PATTERNS: readonly { label: string; pattern: RegExp }[] = [
  { label: 'mbti_in_core', pattern: /\b[EI][NS][TF][JP]\b|MBTI/i },
  {
    label: 'saju_in_core',
    pattern: /사주|명식|일주|월주|오행|천간|지지|십성|대운|음력\s*생일/,
  },
  {
    label: 'astrology_in_core',
    pattern:
      /별자리|태양궁|양자리|황소자리|쌍둥이자리|게자리|사자자리|처녀자리|천칭자리|전갈자리|사수자리|염소자리|물병자리|물고기자리/,
  },
];

export function scanForLensLeak(text: string): SafetyScanResult {
  const violations = LENS_LEAK_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(
    ({ label }) => label,
  );
  return { safe: violations.length === 0, violations };
}

export interface SafetyScanResult {
  safe: boolean;
  violations: string[];
}

export function scanForForbiddenInference(text: string): SafetyScanResult {
  const violations = FORBIDDEN_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(
    ({ label }) => label,
  );
  return { safe: violations.length === 0, violations };
}

/** 금지 추론 + Lens 누출을 함께 본다 — Core Narrative용 (v1.7) */
export function scanCoreNarrative(text: string): SafetyScanResult {
  const forbidden = scanForForbiddenInference(text);
  const lens = scanForLensLeak(text);
  const violations = [...forbidden.violations, ...lens.violations];
  return { safe: violations.length === 0, violations };
}

/**
 * History Narrative 전용 추가 검사 (v1.7 · §27).
 *
 * 프롬프트에서 성장 서사를 금지하고 있었지만 **검사 장치가 없었다.**
 * '상처를 겪으며 성장해서 안정적인 사람이 됐어' 같은 문장은 위 패턴들을 전부 통과한다 —
 * 민감 추론도 아니고 마음 읽기도 아니기 때문이다. 그래서 여기서 따로 막는다.
 *
 * History는 이 서비스에서 가장 단정하기 쉬운 영역이다. 변화는 사실이지만
 * **변화의 방향에 좋음/나쁨을 붙이는 것은 판정이다.**
 */
const GROWTH_NARRATIVE_PATTERNS: readonly { label: string; pattern: RegExp }[] = [
  { label: 'growth_story', pattern: /성장(했|해서|한|하는)|극복(했|해서|한)|치유(됐|되었|된)/ },
  { label: 'value_judgement', pattern: /좋아졌|나아졌|나빠졌|퇴보|더\s*나은\s*사람|건강해졌/ },
  { label: 'readiness_verdict', pattern: /준비가?\s*(됐|되었)|이제야?\s*(진짜|제대로)/ },
  { label: 'pattern_verdict', pattern: /너는\s*(항상|늘|원래)|반복되는\s*문제|연애\s*패턴은/ },
];

export function scanHistoryNarrative(text: string): SafetyScanResult {
  const core = scanCoreNarrative(text);
  const growth = GROWTH_NARRATIVE_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(
    ({ label }) => label,
  );
  const violations = [...core.violations, ...growth];
  return { safe: violations.length === 0, violations };
}

/**
 * Anti-generic Quality Gate (v1.9 · §26)
 *
 * '사용자 데이터 없이도 성립하는 문장'을 잡는다. 완벽한 탐지기가 아니다 — 알려진 템플릿
 * 문구와 단정 표현만 최후 방어선으로 막는다. 1차 방어는 프롬프트(§25)와 Evidence 개수
 * 요구(엔진이 `eligibleForNarrative`로 이미 2-source 이상만 통과시킨다)다.
 */
const GENERIC_SENTENCE_PATTERNS: readonly RegExp[] = [
  /소통이\s*중요합니다?/,
  /서로\s*이해하는\s*것이\s*중요합니다?/,
  /대화를?\s*통해\s*해결할\s*수\s*있습니다?/,
  /관심과\s*배려가\s*필요합니다?/,
  /노력이\s*필요합니다?\.?$/,
  /서로\s*(를\s*)?존중해야\s*합니다?/,
];

/** '분명'·'항상'·'절대'처럼 데이터가 뒷받침할 수 없는 단정 표현(§26-C) */
const UNSUPPORTED_CERTAINTY_PATTERNS: readonly RegExp[] = [
  /분명(히)?/,
  /항상|언제나/,
  /절대(로)?/,
  /틀림없이/,
  /원래\s*(부터)?\s*이런\s*사람/,
  /무조건/,
];

export function isGenericSentence(text: string): boolean {
  return GENERIC_SENTENCE_PATTERNS.some((pattern) => pattern.test(text));
}

export function hasUnsupportedCertainty(text: string): boolean {
  return UNSUPPORTED_CERTAINTY_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Deep Report Narrative 전용 검사(§26). Core 검사(금지 추론·Lens 누출) +
 * 성장 서사 금지(History와 같은 이유로 필요하다 — 변화를 다루므로) +
 * Generic 문장 + 단정 표현까지 함께 본다.
 */
export function scanDeepNarrative(text: string): SafetyScanResult {
  const base = scanHistoryNarrative(text);
  const violations = [...base.violations];
  if (isGenericSentence(text)) violations.push('generic_sentence');
  if (hasUnsupportedCertainty(text)) violations.push('unsupported_certainty');
  return { safe: violations.length === 0, violations };
}

/**
 * §26-E Evidence Mismatch — Narrative가 참조한 evidenceRef가 원래 Insight의
 * evidenceRefs에 실제로 있었는지 확인한다. AI가 있지도 않은 근거를 새로 지어내 붙이면
 * 걸린다. 하나라도 없으면 전체 Narrative를 버린다(부분 통과시키지 않는다 — 그러면
 * '어떤 근거가 진짜인지' 사용자가 구분할 방법이 없다).
 */
export function evidenceRefsAreSubsetOf(
  narrativeRefs: readonly EvidenceRef[],
  insightRefs: readonly EvidenceRef[],
): boolean {
  const key = (ref: EvidenceRef): string => JSON.stringify(ref);
  const allowed = new Set(insightRefs.map(key));
  return narrativeRefs.every((ref) => allowed.has(key(ref)));
}

/**
 * 여러 문장을 한 번에 검사하고, 위반된 항목만 걸러낸다.
 * @returns 통과한 항목과 위반 라벨 목록
 */
export function filterSafeItems<T>(
  items: readonly T[],
  toText: (item: T) => string,
  scan: (text: string) => SafetyScanResult = scanForForbiddenInference,
): { items: T[]; violations: string[] } {
  const violations: string[] = [];
  const safe: T[] = [];

  for (const item of items) {
    const result = scan(toText(item));
    if (result.safe) safe.push(item);
    else violations.push(...result.violations);
  }

  return { items: safe, violations: [...new Set(violations)] };
}

/* ------------------------------------------------- 길이 제한 (§37) */

/**
 * 화면에 맞는 길이로 줄인다.
 *
 * 프롬프트로 먼저 길이를 요청하고, 그래도 넘치면 여기서 자른다. 문장 중간에서 끊지 않도록
 * 마지막 문장 경계를 찾고, 경계가 없으면 하드 컷 후 말줄임표를 붙인다 —
 * **길다는 이유로 근거 있는 설명을 통째로 버리지는 않는다.**
 */
export function clampNarrativeText(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;

  const window = trimmed.slice(0, maxLength);
  // 한국어 문장 종결 위치를 찾는다. 너무 앞에서 끊기면(절반 미만) 쓰지 않는다.
  let boundary = -1;
  for (const mark of ['. ', '.', '! ', '!', '? ', '?', '요 ', '어 ', '야 ']) {
    boundary = Math.max(boundary, window.lastIndexOf(mark));
  }
  if (boundary >= Math.floor(maxLength / 2)) {
    return window.slice(0, boundary + 1).trim();
  }
  return `${window.slice(0, maxLength - 1).trimEnd()}…`;
}
