import type { RelationshipTense } from '@/lib/logic/relationshipEvidence';

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

/**
 * 사진 관찰 전용 추가 검사 (v1.10 · §9 · §10)
 *
 * ⚠️ 위 `FORBIDDEN_PATTERNS`만으로는 부족하다. 사진에서 특히 새어 나오기 쉬운 것은
 * **민감 추론이 아니라 관계 규정과 성격 변환**이다:
 *   - '친구들과 함께' — 사진 속 사람이 누구인지 우리는 모른다(§9)
 *   - '활발한 성격' / '감성적인 취향' — 여행 사진 → 자유로운 성격 같은 변환(§10)
 *   - '행복해 보이는' — 사진 속 사람의 마음 읽기(§9)
 *
 * 이 검사는 **라벨 단위**로 돈다. 걸린 라벨만 버리고 사진 전체를 버리지 않는다 —
 * '카페 테이블'과 '친구들'이 같은 사진에서 나왔다면 앞의 것은 쓸 수 있는 관찰이다.
 */
const PHOTO_OBSERVATION_PATTERNS: readonly { label: string; pattern: RegExp }[] = [
  {
    /** 사진 속 사람과의 관계를 단정하는 것. '다른 사람과 함께 있는 장면'까지만 허용(§9) */
    label: 'relationship_label',
    pattern:
      /친구|연인|여자친구|남자친구|남친|여친|가족|부부|커플|남매|형제|자매|동료|직장\s*동료|선배|후배|엄마|아빠|어머니|아버지|자녀|아이와/,
  },
  {
    /** 활동 → 성격 변환 금지(§10). Observed는 Behavior/Activity/Environment까지다 */
    label: 'personality_inference',
    pattern:
      /성격|성향|외향적|내향적|사교적|활발한|적극적인|소극적인|감성적|지적인|자유로운\s*영혼|모험심|자기관리|계획적인\s*사람|즉흥적인\s*사람/,
  },
  {
    /** 사진 속 사람의 마음 읽기(§9) */
    label: 'photo_mind_reading',
    pattern: /(행복|즐거|기뻐|슬퍼|외로워|우울|불안|편안|설레)[^.\n]{0,6}\s*보(여|이|인)/,
  },
  { label: 'ethnicity', pattern: /인종|민족|아시아인|백인|흑인|동양인|서양인/ },
  { label: 'photo_wealth', pattern: /명품|고급\s*차|비싼|부유해\s*보|형편/ },
  { label: 'photo_appearance', pattern: /잘생|예쁘|미모|몸매|피부가|동안|나이대?는/ },
];

/**
 * 사진 관찰 라벨/요약 1건 검사. 금지 추론 + 사진 전용 패턴을 함께 본다.
 * 걸리면 그 라벨을 버린다 — 조용히 고쳐 쓰지 않는다(고치면 무엇이 AI 관찰인지 알 수 없다).
 */
export function scanPhotoObservation(text: string): SafetyScanResult {
  const base = scanForForbiddenInference(text);
  const photo = PHOTO_OBSERVATION_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(
    ({ label }) => label,
  );
  const violations = [...base.violations, ...photo];
  return { safe: violations.length === 0, violations };
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

/* ------------------------------------------- Relationship Tense (v1.42 · §40.13) */

/**
 * `tense: 'former'`에서 **관계가 지금도 이어지고 있다고 단정하는** 표현.
 *
 * ══ 왜 이 검사가 필요한가 ═════════════════════════════════════════════════
 *
 * v1.41은 `ended` 사용자의 시제를 결정론 경로에서 전부 맞췄다 — Mirror 행 라벨,
 * `noteFor`, `scopeCaptionOf`, Deep Report의 `limitation`·`sourceLabels`. 그런데
 * **AI 문장에는 아무 방어가 없었다.** `MirrorAxisNarrative`는 결정론 행 바로 아래에
 * 붙으므로, 행이 `그때 이 관계에서 …라고 답함`인데 그 아래 AI 설명이
 * `지금 이 관계에서는 …`으로 시작할 수 있었다.
 *
 * 1차 방어는 프롬프트의 `[시제]` 블록이다. 여기는 **최후 방어선**이고, 다른 스캐너와
 * 같은 원칙으로 만들었다: 완벽한 탐지기가 아니라 **명백한 위반을 통과시키지 않는 장치**.
 *
 * ══ 왜 이렇게 좁은가 ══════════════════════════════════════════════════════
 *
 * `지금`이라는 단어 자체를 막으면 안 된다. `지금 돌아보면` · `지금은 그게 보여` 같은
 * 문장은 **끝난 관계를 회고할 때 오히려 자연스럽다.** 막아야 하는 것은 단어가 아니라
 * **관계가 현재 진행 중이라는 전제**다. 그래서 `지금` 뒤에 `관계`·`상대`가 붙는
 * 형태만 잡는다.
 *
 * `앞으로`도 통째로 막지 않는다. v1.40.1이 `ended`에게 `다음 관계에서 …`를 **허용**했다
 * (금지한 것은 진행 중인 관계에 그 문구를 쓰는 것이었다). 그래서 `앞으로 둘이`처럼
 * **이 쌍이 계속된다는 전제**가 있는 형태만 잡는다.
 */
const FORMER_TENSE_PATTERNS: readonly { label: string; pattern: RegExp }[] = [
  { label: 'ongoing_relation', pattern: /(지금|현재)\s*(이\s*)?관계/ },
  { label: 'present_partner', pattern: /(지금|현재)\s*상대/ },
  { label: 'continuing_pair', pattern: /앞으로\s*둘이|계속\s*만나(면서|며|고|다)/ },
];

/**
 * 관계 시제 위반 검사. (v1.42 · §40.13)
 *
 * ⚠️ **`tense === 'current'`에서는 아무것도 막지 않는다.** 이건 게으름이 아니라 판단이다.
 *
 * `current` 쪽에 '과거형 어휘 금지'를 대칭으로 넣고 싶어지는데, 그러면 **정상 문장을
 * 대량으로 떨어뜨린다.** 진행 중인 관계의 사용자도 축의 절반이 `scope: 'past'`인 것이
 * 정상이고(S30은 선택 입력이다), 그 축의 근거 문장은 `이전 관계에서 …`다. AI가 그
 * 근거를 인용하면 반드시 과거 어휘가 나온다 — 그걸 위반으로 보면 **근거를 인용할수록
 * 문장이 사라진다.**
 *
 * 두 방향의 실패 비용도 다르다. `former`에서 현재형은 **끝난 관계를 진행 중이라고
 * 사용자에게 말하는 것**이고, `current`에서 과거 어휘는 대개 그냥 과거 근거를 정확히
 * 인용한 것이다. 비대칭이 옳다.
 *
 * `current` 쪽 시제 정합성은 프롬프트와 J2 실측이 담당한다(§40.14 · Remaining Risk).
 */
export function scanRelationshipTense(text: string, tense: RelationshipTense): SafetyScanResult {
  if (tense !== 'former') return { safe: true, violations: [] };

  const violations = FORMER_TENSE_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(
    ({ label }) => label,
  );
  return { safe: violations.length === 0, violations };
}

/**
 * Outward Question Gate — AI가 만든 질문에 **결정론 질문과 같은 Job 경계**를 적용한다.
 * (v1.42 · §41.9)
 *
 * ══ TENSE SAFETY ≠ JOB SAFETY ═══════════════════════════════════════════════
 *
 * `scanRelationshipTense`는 **시제**만 본다. 그래서 이런 질문은 통과한다.
 *
 * ```
 * 연락이 줄었을 때 서로 어떤 기준이 있었는지 이야기해볼 수 있을까?
 * ```
 *
 * 현재형 호칭이 하나도 없다 — 그런데 **관계가 끝난 사용자에게 상대와 이야기해보라고
 * 제안하는 문장**이다. 시제는 맞고 **대상**이 틀렸다. 결정론 질문
 * (`buildConversationQuestions`)은 `jobAllowsOutwardQuestions(job)`가 이미 막고
 * 있었는데, AI가 만든 질문에는 그 게이트가 없었다.
 *
 * ⚠️ **항목을 버리지 않고 질문만 지운다.** 질문 하나 때문에 설명까지 사라지면
 * 과필터다(§27 AI는 augmentation) — 그리고 `ended`에서 그 질문은 어차피 화면에 가지
 * 않으므로 버릴 이유가 없다.
 *
 * ⚠️ **호출부는 이 게이트를 안전 검사 *앞*에 둔다.** 지워진 질문이 스캔 문자열에
 * 들어가면, 화면에 가지도 않는 문장 때문에 설명이 떨어질 수 있다.
 *
 * ⚠️ `allows`는 **프롬프트에 들어가지 않는다.** AI에게 Job을 알려주지 않는다는 v1.42의
 * 결정 그대로이고, 이건 응답 후처리 안전 문맥이다.
 */
/**
 * @param questionKey 그 Task에서 **상대를 향한 질문을 담는 필드 이름**.
 *
 * ⚠️ v1.43 — 기본값을 두지 않고 호출부가 명시한다. Task마다 이름이 다르다
 * (`RelationshipNarrative.question` · `CompatibilityNarrative.conversationQuestion`)
 * 이고, 기본값 `'question'`을 두면 compatibility 호출부가 값을 빼먹었을 때
 * **아무 필드도 지우지 않고 조용히 통과한다** — 게이트가 가장 필요한 경우다.
 * v1.40.1 §38.2가 닫은 permissive-default 실패 형태 그대로다.
 */
export function applyOutwardQuestionGate<K extends string, T extends Partial<Record<K, string>>>(
  items: readonly T[],
  allows: boolean,
  questionKey: K,
): T[] {
  if (allows) return [...items];
  return items.map((item) => ({ ...item, [questionKey]: undefined }));
}

/**
 * Relationship Narrative 전용 — 기존 Core 검사 + 시제 검사. (v1.42)
 *
 * `scanHistoryNarrative`가 Core 검사에 성장 서사 검사를 더한 것과 **같은 구조**다.
 * 새 파이프라인을 만들지 않고 기존 `filterSafeItems`에 그대로 들어간다.
 */
export function scanRelationshipNarrative(
  text: string,
  tense: RelationshipTense,
): SafetyScanResult {
  const core = scanCoreNarrative(text);
  const tenseScan = scanRelationshipTense(text, tense);
  const violations = [...core.violations, ...tenseScan.violations];
  return { safe: violations.length === 0, violations };
}

/**
 * Compatibility Narrative 전용 — Core 검사 + **시제 검사**. (v1.43 · §47.3)
 *
 * ══ 왜 v1.43에서 필요해졌는가 ═════════════════════════════════════════════
 *
 * `ended` 사용자도 `/compatibility`를 정상적으로 본다(v1.40에서 지원으로 올렸다).
 * 결정론 문구는 그때 시제를 맞췄다 — `이 숫자는 관계가 왜 끝났는지 설명하지 않아` ·
 * `당시 어떤 기대가 달랐는지 보는 참고값이야`. 그런데 그 아래 축별 AI 설명
 * (`CompatibilityAxisNarrative`)에는 **아무 시제 방어가 없었다.**
 *
 * `scanRelationshipNarrative`와 **같은 조합**이다. 다른 함수로 두는 이유는 Task마다
 * 붙는 Core 검사가 다를 수 있고(history는 성장 서사, deep-report는 claim boundary),
 * 조합을 Task별로 명시해두면 어느 Task에 무엇이 붙었는지 한 줄로 보인다.
 */
export function scanCompatibilityNarrative(
  text: string,
  tense: RelationshipTense,
): SafetyScanResult {
  const core = scanCoreNarrative(text);
  const tenseScan = scanRelationshipTense(text, tense);
  const violations = [...core.violations, ...tenseScan.violations];
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

/* ------------------------------- 인과·예측 주장 (v1.27 · Narrative Integrity) */

/**
 * **AI가 규칙 엔진이 확인한 범위보다 한 발 더 나가는 것을 막는다.**
 *
 * v1.26 실측에서 이 문장이 통과했다:
 *   "이 차이가 관계에서의 소통 방식에 **영향을 미칠 수 있을** 것 같아"
 *
 * 헤지("~수 있을 것 같아")는 있었지만 문제는 확신의 강도가 아니라 **주장의 종류**였다.
 * deterministic layer는 두 관찰이 **같은 축을 가리킨다**는 것만 확인했는데, AI가
 * '영향'이라는 **인과 방향**을 새로 만들었다.
 *
 * 왜 기존 스캐너가 놓쳤나 — `scanDeepNarrative`는 민감 추론·마음 읽기·Lens 누출·성장
 * 서사·일반론·단정 표현을 보는데, **인과/예측 패턴이 하나도 없었다.** 확신을 낮추는
 * 표현만 검사했고 주장의 종류는 검사하지 않았다.
 *
 * ⚠️ 단어만 막으면 안 된다. 다음은 **반드시 통과해야 하는** 정직한 한계 문장이다:
 *   "과거 경험이 현재 선호의 **원인**이라고 단정할 수는 없어."
 *   "한쪽이 다른 쪽에 **영향을 준다**고 말할 수는 없어."
 *   "MBTI가 실제 행동을 **결정한다**는 뜻은 아니야."
 * 그래서 이 검사는 **부정/한계 표지가 같은 문장 안에 있으면 통과시킨다.**
 */

/**
 * 인과 주장 — 강한 것과 약한 것을 함께 막는다.
 * Premium AI에서 기본 허용하는 계층은 **연관**뿐이다
 * ('함께 나타난다' / '같은 방향으로 보인다' / '나란히 놓인다' / '비슷한 장면이 있다').
 */
const CAUSAL_CLAIM_PATTERNS: readonly { label: string; pattern: RegExp }[] = [
  /* 강한 인과 */
  { label: 'causal_because', pattern: /때문에|때문이|탓에|덕분에|(으로|로)\s*인해|인해서/ },
  { label: 'causal_result', pattern: /결과적으로|그\s*결과|원인이\s*(되|됐|된)|(을|를)\s*초래/ },
  { label: 'causal_effect', pattern: /영향(을|이)\s*(주|줬|준|미치|미쳤|미친|받)/ },
  { label: 'causal_make', pattern: /(이|가)\s*만들었|만들어냈|(으로|로)\s*이어졌|생기게\s*(했|된)/ },
  { label: 'causal_determine', pattern: /결정(한다|해|했|짓는)|좌우(한다|해|했)|(이|가)\s*원인/ },
  /**
   * 생성 주장 — v1.27 corpus에서 놓쳤다.
   * '이별이 지금의 기준을 **만들었어**' / '모순이 **만들어졌어**' 같은 형태는 위 패턴이
   * 전부 통과시켰다(목적격·피동형이라 (이|가) 만들었 에 걸리지 않았다).
   */
  { label: 'causal_create', pattern: /만들었|만들어졌|만들어진|만들어내|생겨났|생기게\s*(했|된)/ },
  /**
   * 인과 연결어미 — v1.27 corpus에서 놓쳤다.
   * 'I라서 혼자 있는 시간이 필요한 거야'는 이 서비스가 가장 경계하는 형태다
   * (유형 -> 행동 1:1 대응). 한국어 ~라서는 사실상 인과 전용이라 단독으로 막는다.
   *
   * 주의: ~해서/~아서는 넣지 않는다 — '확인이 필요해서', '같아서'처럼 인과가 아닌
   * 용법이 너무 많아 오탐이 난다. 그 형태는 causal_create 같은 결과 쪽 표현으로 잡는다.
   */
  { label: 'causal_connective', pattern: /[가-힣A-Z]라서(\s|$)/ },
  /* 약한 인과 — 헤지가 붙어도 인과 방향을 새로 만드는 것은 같다 */
  { label: 'causal_weak', pattern: /(으로|로)\s*이어질\s*수|작용할\s*수|영향을?\s*미칠\s*수|영향을?\s*줄\s*수/ },
];

/** 예측 — 아직 일어나지 않은 일을 말한다 */
const PREDICTION_PATTERNS: readonly { label: string; pattern: RegExp }[] = [
  { label: 'prediction_likelihood', pattern: /가능성이\s*(높|커|크)|확률이\s*(높|커)/ },
  { label: 'prediction_future', pattern: /앞으로\s*(는)?\s*[^.!?\n]{0,20}(될|할|겠)|결국(에는)?\s*[^.!?\n]{0,20}(될|할|한다)/ },
  { label: 'prediction_become', pattern: /하게\s*될\s*(거|것|수)|되고\s*말|(을|ㄹ)\s*수밖에\s*없/ },
];

/** 상대의 의도·마음을 단정 (기존 mind_reading이 못 잡는 형태를 보강) */
const INTENT_PATTERNS: readonly { label: string; pattern: RegExp }[] = [
  { label: 'intent_claim', pattern: /마음이\s*(식|떠|멀어졌)|상대가\s*원하는\s*건|상대는\s*너를/ },
];

/** 관계에 좋음/나쁨을 붙이는 판정 */
const VALUE_JUDGMENT_PATTERNS: readonly { label: string; pattern: RegExp }[] = [
  { label: 'value_relationship', pattern: /건강한\s*관계|좋은\s*궁합|나쁜\s*궁합|이상적인\s*(관계|커플)|위험한\s*관계/ },
];

/**
 * **False Positive Protection.**
 *
 * '원인' · '영향을 준다' · '결정한다' 같은 말은 **한계를 말할 때 반드시 필요하다.**
 * 이 서비스의 limitation 문장들이 정확히 그 형태다 — 막으면 정직한 문장이 사라진다.
 *
 * 그래서 같은 문장 안에 부정/한계 표지가 있으면 인과·예측 주장으로 보지 않는다.
 * **문장 단위**로 본다 — 문서 전체에 하나만 있으면 통과시키는 방식은 우회가 너무 쉽다
 * ("A 때문에 B야. 물론 단정할 수는 없어." 가 통과해버린다).
 */
const LIMITATION_MARKERS: readonly RegExp[] = [
  /단정(할|하지|짓지)/,
  /말할\s*수\s*(는)?\s*없/,
  /알\s*수\s*(는)?\s*없/,
  /뜻은?\s*아니/,
  /것은?\s*아니/,
  /(라고|다고)\s*(는)?\s*(볼|보기|하기|말하기)\s*(는)?\s*(어렵|힘들)/,
  /근거(는|가)?\s*(는)?\s*없/,
  /확인(할|해봐야|해야)/,
  /까지(야|다|이다)/,
];

/** 문장 분리 — 한국어 종결부호와 줄바꿈 기준. 완벽한 파서가 아니라 검사 단위다 */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function hasLimitationMarker(sentence: string): boolean {
  return LIMITATION_MARKERS.some((pattern) => pattern.test(sentence));
}

/**
 * @returns 위반 라벨 목록. 한계 문장은 통과시킨다.
 */
export function scanClaimBoundary(text: string): SafetyScanResult {
  const groups = [
    ...CAUSAL_CLAIM_PATTERNS,
    ...PREDICTION_PATTERNS,
    ...INTENT_PATTERNS,
    ...VALUE_JUDGMENT_PATTERNS,
  ];

  const violations = new Set<string>();

  for (const sentence of splitSentences(text)) {
    // 이 문장이 한계를 말하고 있으면 인과 어휘가 있어도 주장이 아니다.
    if (hasLimitationMarker(sentence)) continue;
    for (const { label, pattern } of groups) {
      if (pattern.test(sentence)) violations.add(label);
    }
  }

  return { safe: violations.size === 0, violations: [...violations] };
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
  /**
   * v1.27 — **AI_OUTPUT ⊆ DETERMINISTIC_EVIDENCE.**
   * 규칙 엔진은 두 관찰이 같은 축을 가리킨다는 것까지만 확인했다. 인과·예측·의도·
   * 가치판정은 그 범위 밖이므로 여기서 막는다(한계 문장은 통과).
   */
  violations.push(...scanClaimBoundary(text).violations);
  return { safe: violations.length === 0, violations };
}

/**
 * Deep Report Narrative + **시제 검사**. (v1.43 · §47.5)
 *
 * ══ 왜 v1.43에서 필요해졌는가 ═════════════════════════════════════════════
 *
 * `DeepNarrative.headline`과 `interpretation`은 **실제로 화면에 그려진다**
 * (`overview.topSummaries` · `connection.narrativeText`). v1.41은 그 카드의
 * `limitation`·`sourceLabels`를 `그때 이 관계`로 힘들게 맞췄는데, 그 위에 놓이는 AI
 * 본문에는 계약이 없었다 — 모델이 시제를 맞춘다면 그건 `limitation` 문자열을 눈치챈
 * 결과이고, **우연이지 보증이 아니다.**
 *
 * ⚠️ `scanDeepNarrative`를 대체하지 않고 **감싼다.** 기존 4개 검사(금지 추론 · 성장
 * 서사 · generic · claim boundary)는 한 글자도 바뀌지 않고, `tense === 'current'`에서는
 * 결과가 v1.42와 완전히 같다(`scanRelationshipTense`가 그때 아무것도 막지 않는다).
 */
export function scanDeepNarrativeWithTense(
  text: string,
  tense: RelationshipTense,
): SafetyScanResult {
  const base = scanDeepNarrative(text);
  const tenseScan = scanRelationshipTense(text, tense);
  const violations = [...base.violations, ...tenseScan.violations];
  return { safe: violations.length === 0, violations };
}

/**
 * §26-E Evidence Mismatch — Narrative가 참조한 evidenceRef가 원래 Insight의
 * evidenceRefs에 실제로 있었는지 확인한다. AI가 있지도 않은 근거를 새로 지어내 붙이면
 * 걸린다. 하나라도 없으면 전체 Narrative를 버린다(부분 통과시키지 않는다 — 그러면
 * '어떤 근거가 진짜인지' 사용자가 구분할 방법이 없다).
 *
 * ⚠️ **v1.43에서 `logic/allowedEvidence.ts`의 `refsWithinAllowed`로 대체됐다.**
 *
 * 판정은 같지만 두 가지가 달라졌고, 둘 다 이 함수로는 할 수 없었다:
 *
 * ```
 * ① 키 순서    JSON.stringify는 {source,field}와 {field,source}를 다르게 본다
 * ② field 별칭  모델이 context가 보낸 이름(contactImportance)을 정확히 인용해도
 *              허용집합에는 canonical(contact)이 있어서 떨어졌다 — 과필터
 * ```
 *
 * 그리고 v1.43은 **네 Task가 같은 술어를 쓴다.** 이 함수를 남겨두면 어느 Task는
 * 별칭을 알고 어느 Task는 모르는 상태가 되므로 지운다 — v1.27의 계약
 * (`AI_OUTPUT ⊆ DETERMINISTIC_EVIDENCE`)은 그대로이고 구현 위치만 옮겼다.
 */

/* ------------------------- Quality Gate (F) 중복 (v1.27 · §24) */

/**
 * AI 문장이 **규칙 문장을 그냥 다시 쓴 것인지** 판정한다.
 *
 * v1.26 실측에서 실제로 나온 실패다. 어떤 연결의 규칙 문장이
 *   "… 서로 다른 관찰이 같은 축을 가리키고 있어."
 * 였는데 AI가 붙인 문장이 **마지막 문장을 글자 그대로 반복**했다.
 * 안전 검사는 전부 통과한다 — 위험한 주장이 아니기 때문이다. 그런데 사용자에게는
 * 같은 말이 두 번 보인다. 그러면 Premium이 파는 것이 '연결'이 아니라 '분량'이 된다.
 *
 * ⚠️ 이것은 안전 문제가 아니라 **가치 문제**라서 `scanDeepNarrative`에 넣지 않고 별도
 * 게이트로 둔다. 걸리면 그 narrative만 버리고 화면은 규칙 문장으로 완결된다
 * (`DeepConnection.narrativeText`가 null을 허용한다) — AI가 없어도 리포트는 남는다.
 *
 * ⚠️ 판정은 형태소 분석 없이 **글자 bigram**으로 한다. 한국어는 조사가 붙어
 * '축이/축을/축은'이 모두 다른 어절이 되므로, 어절 비교는 새 정보를 과대평가한다.
 *
 * ⚠️ **임계값은 초기 캘리브레이션 값이다 · NOT VALIDATED.**
 *
 * v1.26 실측 3건으로 잡은 값이다(0.137 버림 / 0.596 · 0.672 통과). 표본이 3건이므로
 * "이 값이 옳다"고 말할 수 없다 — **지금 명백한 되풀이를 막는다**까지가 근거다.
 * 조정은 dev 로그의 `novel=` 관측치를 모은 뒤에 한다(감으로 올리고 내리지 않는다).
 */
const MIN_NARRATIVE_NOVELTY = 0.35;

/** 비교 전 정규화 — 문장부호·공백 차이 때문에 중복을 놓치지 않게 한다 */
function normalizeForCompare(text: string): string {
  return text.replace(/[^0-9A-Za-z가-힣]/g, '');
}

function charBigrams(text: string): Set<string> {
  const compact = normalizeForCompare(text);
  const grams = new Set<string>();
  for (let i = 0; i + 2 <= compact.length; i += 1) grams.add(compact.slice(i, i + 2));
  return grams;
}

/**
 * 규칙 문장에 없는 bigram의 비율. 낮을수록 규칙 문장을 되풀이한 것이다.
 *
 * @returns 0(완전 중복) ~ 1(완전히 새로운 문장)
 */
export function noveltyRatio(text: string, reference: string): number {
  const target = charBigrams(text);
  if (target.size === 0) return 0;
  const base = charBigrams(reference);
  let novel = 0;
  for (const gram of target) if (!base.has(gram)) novel += 1;
  return novel / target.size;
}

/**
 * 규칙 문장의 한 문장을 **글자 그대로** 옮겨왔는지.
 * 짧은 문장(<10자)은 우연히 겹칠 수 있어 세지 않는다.
 */
export function echoesReferenceSentence(text: string, reference: string): boolean {
  const base = normalizeForCompare(reference);
  if (base.length === 0) return false;
  return splitSentences(text).some((sentence) => {
    const compact = normalizeForCompare(sentence);
    return compact.length >= 10 && base.includes(compact);
  });
}

/**
 * @returns 이 narrative가 규칙 문장에 아무것도 더하지 않는지
 */
export function isRedundantNarrative(text: string, reference: string): boolean {
  if (reference.trim().length === 0) return false;
  if (echoesReferenceSentence(text, reference)) return true;
  return noveltyRatio(text, reference) < MIN_NARRATIVE_NOVELTY;
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
