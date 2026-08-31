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
  { label: 'mind_reading', pattern: /상대(는|가)\s*(너를|당신을)?\s*(좋아|사랑|싫어)하[고는며]|상대(의)?\s*진심은|상대는\s*분명/ },
  { label: 'success_probability', pattern: /성공\s*(확률|가능성)\s*\d|결혼\s*확률|이별\s*확률|헤어질\s*확률/ },
  { label: 'diagnosis', pattern: /당신은\s*본질적으로|당신의\s*무의식|성격\s*장애/ },
  { label: 'relationship_verdict', pattern: /상극|천생연분|운명적인\s*커플|결혼하면\s*안\s*된/ },
];

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

/**
 * 여러 문장을 한 번에 검사하고, 위반된 항목만 걸러낸다.
 * @returns 통과한 항목과 위반 라벨 목록
 */
export function filterSafeItems<T>(
  items: readonly T[],
  toText: (item: T) => string,
): { items: T[]; violations: string[] } {
  const violations: string[] = [];
  const safe: T[] = [];

  for (const item of items) {
    const result = scanForForbiddenInference(toText(item));
    if (result.safe) safe.push(item);
    else violations.push(...result.violations);
  }

  return { items: safe, violations: [...new Set(violations)] };
}
