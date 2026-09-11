import { MIRROR_AXES } from '@/data/axes';
import type { RelationshipTense } from '@/lib/logic/relationshipEvidence';
import type {
  CompatibilityResult,
  CrossSourceInsight,
  CurrentRelationshipEvidence,
  DeclaredPreference,
  DeepAnalysisAnswer,
  HistoryAxisChange,
  MirrorAxisKey,
  RelationshipExperience,
  RelationshipHistoryEntry,
  TargetProfile,
  ValidatedObservation,
} from '@/types';

/**
 * AI Narrative 입력 지문 (v1.7 · §8 · §42)
 *
 * 각 Narrative는 **자기 입력이 바뀔 때만** 다시 생성된다. 지문이 같으면 캐시를 쓰고,
 * 지문이 달라지면 이전 응답은 stale로 버린다(§41).
 *
 * ⚠️ 여기에 절대 넣지 않는 것 — 넣으면 위계가 무너진다:
 *   - MBTI          (Supporting Lens · Core 설명을 무효화시키지 않는다)
 *   - Birth Profile (Entertainment Lens)
 *   - Premium Intent / 가격 variant (결제 의향이 분석을 흔들지 않는다)
 *   - 사진 원본 (Observed Task의 지문은 `imagePrep.photoFingerprint`가 따로 만든다)
 *
 * 즉 MBTI를 입력하거나 Premium을 눌러도 Core AI 설명은 재호출되지 않는다.
 */

/** 값 목록을 안정적인 짧은 문자열로 만든다. 원문을 그대로 남기지 않는다 */
function digest(parts: readonly (string | number | null | undefined)[]): string {
  const joined = parts.map((part) => (part === null || part === undefined ? '-' : part)).join('|');

  // 문자열 해시(FNV-1a 변형). 암호학적 용도가 아니라 '같은 입력인가'만 판단한다.
  let hash = 0x811c9dc5;
  for (let i = 0; i < joined.length; i += 1) {
    hash ^= joined.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function declaredParts(declared: DeclaredPreference): (string | number | null)[] {
  return [declared.contact, declared.conflict, declared.alone, declared.affection, declared.hobby];
}

/**
 * Compatibility Narrative — Declared + Target + **계산된 dimensions**가 기준이다.
 * 계산 결과를 넣는 이유: 같은 입력이라도 규칙이 바뀌면 설명도 다시 만들어야 한다.
 *
 * ══ v1.43 — policy input 2개 추가 · dead input 1개 제거 (§47.4) ═══════════════
 *
 * ```
 * 추가   tense                   AI가 받고(§47.1) 서버 스캐너가 읽는다
 * 추가   allowsOutwardQuestions  서버가 응답에서 conversationQuestion을 지운다(§47.2)
 * 제거   target.relation         AI context에서 **항상 null**이었다(§47.6)
 * ```
 *
 * ⚠️ **v1.42 §8.13과 같은 결함이 여기 있었다.** 캐시가 저장하는 것은 provider raw가
 * 아니라 **후처리까지 끝난 최종 응답**이고(`aiClient`의 `cache.set(key, json.data)`),
 * 캐시 히트에는 응답이 없다 — 히트의 정의가 '서버에 가지 않는 것'이다. 그래서 게이트
 * 입력이 다르면 재사용해도 되는 응답이 아니다.
 *
 * 겹치던 조합:
 *
 * ```
 * ① dating  + 상대 4축   job dating   tense current  allow true    fp X
 * ② ended   + 상대 4축   job ended    tense former   allow FALSE   → tense가 이미 갈랐다
 * ③ solo_exp+ 상대 4축   job talking  tense current  allow true    fp X (①과 같다 · 정당)
 * ```
 *
 * `ended`는 `tense`가 갈라주므로 이 Task의 실제 위험은 relationship보다 작았다. 그래도
 * 넣는 이유는 **게이트가 있는 Task는 게이트 입력이 캐시 identity의 일부**라는 계약을
 * Task별 예외 없이 세우는 것이 v1.43의 목적이기 때문이다(TC6이 강제한다).
 *
 * ⚠️ **`target.relation`을 뺀 것은 정리가 아니라 계약이다.** v1.42 §40.5가 `status`를
 * 뺀 근거(`AI가 받지 않는 값은 캐시 키도 아니다`)를 그대로 적용했다. 그 값은
 * `buildCompatibilityContext`에서 항상 `null`로 나갔고 프롬프트는 한 번도 언급하지
 * 않았다. 부수 효과는 `crush` ↔ `friend`처럼 **relation만 다른 세션이 같은 지문**이
 * 되는 것이고, 그게 맞다 — 모델이 받는 것도 최종 응답도 같다.
 *
 * ⚠️ `relation`이 `null` ↔ 값 있음으로 바뀌는 경우는 `hasTargetSignal`을 통해
 * SUFFICIENCY → JOB을 바꿀 수 있는데, 그 영향은 **`allowsOutwardQuestions`가 이미
 * 표현한다**(`job none`↔`unknown`은 둘 다 질문 금지/허용이 갈리는 경계다). 즉 정책
 * 영향은 boolean으로 남고 raw 값만 빠진다.
 */
export function compatibilityNarrativeFingerprint(input: {
  tense: RelationshipTense;
  allowsOutwardQuestions: boolean;
  declared: DeclaredPreference;
  target: TargetProfile;
  result: CompatibilityResult;
}): string {
  const { tense, allowsOutwardQuestions, declared, target, result } = input;

  return `cmp_${digest([
    tense,
    // 문자열로 고정한다 — boolean이 `digest`의 `-`(null 표기)와 섞이지 않게 한다
    allowsOutwardQuestions ? 'q:on' : 'q:off',
    ...declaredParts(declared),
    target.contact,
    target.conflict,
    target.alone,
    target.affection,
    result.score,
    result.comparedCount,
    ...result.dimensions.map((dimension) => `${dimension.key}:${dimension.alignment ?? '-'}`),
  ])}`;
}

/**
 * 지금 관계 근거(S30)를 **축 순서를 고정해서** 지문 조각으로 만든다. (v1.42 · §40.4)
 *
 * ══ 왜 `Object.entries`를 쓰지 않는가 ═════════════════════════════════════
 *
 * `signals`는 `Partial<Record<MirrorAxisKey, CurrentSignalAnswer>>`이고, 객체 키 순서는
 * **사용자가 S30에서 답한 순서**다. 연락 → 갈등 순으로 답한 사용자와 갈등 → 연락 순으로
 * 답한 사용자는 **같은 답을 갖고도 다른 지문**을 받게 되고, 그러면 같은 근거에 대해 AI를
 * 두 번 부른다. 판정은 `MIRROR_AXES`만 조회하므로 순서에 무관한데 지문만 순서에 민감한
 * 상태는 그냥 버그다.
 *
 * 그래서 `MIRROR_AXES` 순서로 훑는다 — Mirror가 축을 조회하는 것과 **같은 순서**다.
 *
 * ⚠️ `askedAt`은 넣지 않는다. 같은 답을 다시 저장하면 timestamp만 달라지는데, 그걸
 * 지문에 넣으면 **답이 같아도 AI를 다시 부른다**(F2가 검사한다). 지문은 '무엇을
 * 답했는가'만 본다.
 *
 * ⚠️ 답하지 않은 축은 `-`다. `unsure`(아직 그런 상황이 없었어)와 **구분된다** —
 * `unsure`는 사용자가 고른 보기이고 `resolveAxisEvidence`가 과거로 넘길지 결정하는
 * 입력이므로, 지문에서도 '답하지 않음'과 같은 값으로 뭉개지 않는다.
 */
function currentParts(current: CurrentRelationshipEvidence): (string | null)[] {
  return MIRROR_AXES.map(({ key }) => {
    const answer = current.signals[key];
    return answer === undefined ? null : `${key}:${answer}`;
  });
}

/**
 * Relationship Narrative — Declared + Experience + Adaptive + focusAxis +
 * **사용자가 검증한 관찰**이 기준이다.
 *
 * S09에서 관찰을 고치거나 제외하면 지문이 바뀌어 설명이 다시 만들어진다(§42).
 *
 * ══ v1.42 — 지문은 **AI 요청과 같은 것**을 담는다 (§40.3~§40.5) ═══════════════
 *
 * 두 가지가 바뀌었고, 둘 다 같은 규칙에서 나온다: **AI 응답을 결정하는 값이 지문에
 * 없으면 캐시가 틀린 답을 돌려준다.**
 *
 * ```
 * 추가   current                 S30 답변이 판정·근거 문장을 바꾼다    → 있어야 한다
 * 제거   status                  AI context에서 없어졌다(§40.7)        → 있을 이유가 없다
 * 추가   tense                   status 대신 AI가 받는 값               → 있어야 한다
 * 추가   allowsOutwardQuestions  서버가 응답에서 question을 지운다(§42) → 있어야 한다
 * ```
 *
 * ⚠️ **`current`가 없던 것이 v1.41의 실제 결함이었다.** `/mirror`에서 AI 설명을 만든 뒤
 * `/profile/current`로 가서 S30을 답하고 돌아오면, Mirror의 오른쪽 칸은 `지금 관계에서
 * "…"라고 답함`으로 바뀌는데 지문은 그대로였다 — `focusAxis`가 우연히 바뀌지 않으면
 * (`pickFocus`는 `MIRROR_AXES` 순서의 첫 매치를 고르므로 앞선 축이 이미 GAP이면 뒤쪽
 * 축을 답해도 안 바뀐다) 모듈 스코프 캐시가 **이전 관계 근거를 설명하던 문장**을 그대로
 * 돌려줬다. 행과 AI 설명이 서로 다른 시점을 말하는 화면이 된다.
 *
 * ⚠️ **`status` 6종을 `tense` 2종으로 좁힌 것은 우연한 정리가 아니다.** 지문은 AI가 받는
 * 것을 담아야 하고, v1.42부터 AI는 `status`를 받지 않는다(§40.7). 그래서 부수 효과가
 * 하나 생기는데 그게 **의도한 것**이다: `talking` → `dating`처럼 근거가 그대로이고 tense도
 * 같은 단계 변경은 이제 **같은 지문**이다. 같은 근거·같은 시제에 대해 같은 설명을 두 번
 * 만들지 않는다 — v1.41의 `stage ≠ evidence`가 캐시 층에서도 성립한다(F5).
 *
 * 반대로 `dating` → `ended`는 tense가 `current` → `former`로 바뀌므로 **반드시** 지문이
 * 달라진다. 그게 없으면 관계가 끝난 사용자가 현재형으로 쓰인 캐시 문장을 받는다.
 */
export function relationshipNarrativeFingerprint(input: {
  /**
   * v1.42 — `status: RelationshipStatus | null`을 대체했다. 이 지문에 raw stage가
   * 들어갈 자리는 없다 — AI가 받지 않는 값은 캐시 키도 아니다(§40.5).
   */
  tense: RelationshipTense;
  /**
   * v1.42 Final Cache Safety — **RESPONSE SAFETY POLICY CONTEXT.** (§42)
   *
   * ══ 왜 지문에 들어가야 하는가 ═══════════════════════════════════════════
   *
   * 이 값은 stage도 job도 evidence도 아니다. AI가 **생성할 사실**을 바꾸지 않는다 —
   * 프롬프트에 들어가지도 않는다(§41.8). 그런데 **서버가 저장 전에 응답에서
   * `question`을 지운다**(`applyOutwardQuestionGate`).
   *
   * 그리고 클라이언트 캐시가 저장하는 것은 provider raw가 아니라 **그 후처리까지 끝난
   * 최종 응답**이다(`aiClient.callAiTask`의 `cache.set(key, json.data)`).
   *
   * ```
   * 최종 응답이 이 boolean에 따라 달라진다  →  캐시 identity에 포함해야 한다
   * ```
   *
   * ⚠️ **실측으로 재현된 결함이다.** `target`과 `status`는 **둘 다** 이 지문에 없다
   * (`target`은 v1.0부터, `status`는 §40.5에서 뺐다). 그래서 그 두 값만 달라지는
   * 세션들이 같은 지문을 갖는데 `job`은 갈린다.
   *
   * ```
   * dating + 상대 3축         job dating   allow true    fp X
   * 새로운 사람과 궁합 보기    job unknown  allow true    fp X   (target은 지문에 없다)
   * S05에서 '솔로' 선택       job none     allow FALSE   fp X   ← 여기서 겹쳤다
   * ```
   *
   * tense는 세 줄 모두 `current`이고 declared·experience·current·focusAxis·validated가
   * 전부 그대로다. 그러면 캐시 히트로 **질문이 붙은 이전 응답이 job=`none`
   * 사용자에게 그대로 나온다.**
   *
   * ⚠️ **S30에 답한 세션에서는 이 경로가 성립하지 않는다** — `resetTargetContext()`가
   * §39.20에 따라 `currentRelationship`도 비우므로 지문이 그것 때문에 이미 달라진다.
   * 즉 결함은 **S30을 답하지 않은 세션**에서만 도달 가능하고, S30이 선택 입력이므로
   * 그쪽이 다수다.
   *
   * ⚠️ **boolean 하나만 넣는다.** `job`·`stage`·`status` 문자열을 넣으면 §40.5가 뺀
   * 것을 되돌리는 셈이다. boolean 1개면 `crush`↔`dating`(둘 다 허용)은 여전히 같은
   * 지문이고, `none`↔`dating`(금지↔허용)만 갈라진다 — 정확히 필요한 만큼만 나눈다.
   *
   * ⚠️ 이 필드가 지문의 역할을 다시 정의한다: 지문은 '사실 근거의 집합'이 아니라
   * **'같은 최종 응답을 재사용해도 되는 입력 집합'**이다. `tense`가 이미 그 성격이었다
   * (시제도 evidence가 아니다).
   */
  allowsOutwardQuestions: boolean;
  declared: DeclaredPreference;
  experience: RelationshipExperience;
  /** v1.42 — S30. 이것이 빠져 있던 것이 stale narrative 결함의 원인이다 */
  current: CurrentRelationshipEvidence;
  focusAxis: MirrorAxisKey | null;
  validated: readonly ValidatedObservation[];
}): string {
  const { tense, allowsOutwardQuestions, declared, experience, current, focusAxis, validated } =
    input;

  return `rel_${digest([
    tense,
    // 문자열로 고정한다 — boolean이 `digest`의 `-`(null 표기)와 섞이지 않게 한다
    allowsOutwardQuestions ? 'q:on' : 'q:off',
    ...declaredParts(declared),
    ...currentParts(current),
    ...experience.important,
    experience.hardest,
    experience.selfGap,
    // 자유서술은 원문이 아니라 길이만 — 지문에 사용자 문장을 남기지 않는다.
    experience.note.trim().length,
    experience.skipped ? 'skip' : 'kept',
    experience.adaptive ? `${experience.adaptive.axis}:${experience.adaptive.optionId}` : null,
    focusAxis,
    // 관찰은 id + 상태 + 수정 여부까지. 수정 원문은 넣지 않는다.
    ...validated.map(
      (item) => `${item.original.id}:${item.status}:${item.userCorrection ? 'c' : '-'}`,
    ),
  ])}`;
}

/**
 * History Narrative — 비교 대상 Entry id + **규칙이 판정한 변화 상태**가 기준이다.
 *
 * MBTI snapshot만 바뀐 경우에는 changes가 그대로이므로 지문도 바뀌지 않는다(§79 CASE Q).
 */
export function historyNarrativeFingerprint(
  entries: readonly RelationshipHistoryEntry[],
  changes: readonly HistoryAxisChange[],
): string {
  return `his_${digest([
    entries.length,
    ...entries.slice(-2).map((entry) => entry.id),
    ...changes.map((change) => `${change.axis}:${change.state}`),
  ])}`;
}

/**
 * Deep Report Narrative — Cross-source Insight 목록 자체(id·type·strength)와,
 * 그 근거의 **실제 내용**이 바뀌는 지점(관찰 수정, 상대 정보, Deep Followup 답변)이 기준이다.
 *
 * ⚠️ evidenceRefs는 '어디를 봤는지'일 뿐 텍스트를 담지 않는다. 그래서 예를 들어 사용자가
 * observed trait을 수정해도 ref 자체는 안 바뀐다 — validated의 correction 여부를 별도로
 * 넣어야 "같은 근거인데 내용이 달라졌다"를 지문이 알 수 있다(§40 Evidence Revision).
 */
export function deepReportFingerprint(input: {
  /**
   * v1.43 §47.5 — **최종 응답을 바꾸므로 지문에 들어간다.**
   *
   * `tense`는 v1.41부터 이 Task에 전달됐지만(`buildDeepReportContext`) 지문에는 없었다.
   * v1.43부터 두 가지가 그 값에 달라진다:
   *   ① 프롬프트 `[시제]` 블록이 모델이 쓸 시제를 지시한다
   *   ② `scanDeepNarrativeWithTense`가 `former`에서 현재형 항목을 버린다
   *
   * ⚠️ `tense`가 없으면 `dating` → `ended`로 바뀐 사용자가 **현재형으로 쓰인 캐시 문장**을
   * 그대로 받는다. `insights`가 함께 바뀔 가능성이 높지만 그건 우연이고, 우연에
   * 의존하는 것이 v1.42 §8.13이 닫은 실패 형태다.
   */
  tense: RelationshipTense;
  insights: readonly CrossSourceInsight[];
  declared: DeclaredPreference;
  target: TargetProfile;
  validated: readonly ValidatedObservation[];
  deepAnswers: readonly DeepAnalysisAnswer[];
}): string {
  const { tense, insights, declared, target, validated, deepAnswers } = input;

  return `dr_${digest([
    tense,
    ...insights.map((insight) => `${insight.id}:${insight.type}:${insight.strength}`),
    ...declaredParts(declared),
    target.contact,
    target.conflict,
    target.alone,
    target.affection,
    ...validated.map(
      (item) => `${item.original.id}:${item.status}:${item.userCorrection ? 'c' : '-'}`,
    ),
    ...deepAnswers.map(
      (answer) => `${answer.questionId}:${Array.isArray(answer.value) ? answer.value.join(',') : answer.value}`,
    ),
  ])}`;
}

/* -------------------- Premium Lens AI (v1.46 AI Lens · §28 · §29) -------- */

/**
 * 렌즈 하나의 지문. **렌즈마다 따로 만든다** (§28).
 *
 * ══ 왜 렌즈별인가 ════════════════════════════════════════════════════════
 *
 * ```
 * 상대 MBTI만 수정
 *   → MBTI 지문 변경     → 재호출
 *   → Cross-Lens 지문 변경 → 재호출 (MBTI 테마가 입력이므로)
 *   → 사주·별자리 지문 그대로 → 캐시 유지 ✅
 * ```
 *
 * 세 렌즈가 지문 하나를 공유하면 위 줄의 마지막이 성립하지 않는다. Task도 캐시 키도
 * 따로인 이유가 이것이다(`aiClient.cacheKey`).
 *
 * ══ 무엇을 넣는가 ════════════════════════════════════════════════════════
 *
 * ⚠️ 이 파일 상단이 "MBTI·Birth Profile을 절대 넣지 않는다"고 적어둔 것은 **Core
 * Narrative 지문**에 대한 규칙이다. 그 이유는 위계다 — MBTI를 입력했다고 Core 설명이
 * 다시 만들어지면 보조 렌즈가 Core를 흔드는 것이 된다.
 *
 * 이 지문은 그 반대쪽이다. **MBTI가 바로 이 Task의 입력**이고, 넣지 않으면 상대
 * 유형을 바꿔도 같은 문장이 캐시에서 나온다. 그래도 원본은 넣지 않는다 — 넣는 것은
 * 결정론 엔진이 이미 만든 `basis` 라벨과 `themes`다(생년월일은 지문에도 없다).
 *
 * ⚠️ `tense`·`allowsOutwardQuestions`는 **최종 응답을 바꾸는 policy input**이므로
 * 반드시 들어간다(v1.42 §8.13 · TC6).
 */
export function premiumLensFingerprint(input: {
  kind: string;
  mode: 'pair' | 'self';
  tense: RelationshipTense;
  allowsOutwardQuestions: boolean;
  basis: readonly { label: string; value: string }[];
  themes: readonly string[];
  declared: DeclaredPreference;
  /**
   * §19 — 이 렌즈에 실제로 전달되는 사건만. **원문을 넣지 않는다** — 길이와 종류만
   * 넣어도 "사건이 바뀌었다"를 감지하기에 충분하고, 지문 문자열에 자유 입력이 남지
   * 않는다(§34 Privacy).
   */
  eventSignature: readonly string[];
}): string {
  const { kind, mode, tense, allowsOutwardQuestions, basis, themes, declared, eventSignature } =
    input;

  return `lens_${kind}_${digest([
    mode,
    tense,
    allowsOutwardQuestions ? 'q1' : 'q0',
    ...basis.map((row) => `${row.label}=${row.value}`),
    ...themes,
    ...declaredParts(declared),
    ...eventSignature,
  ])}`;
}

/**
 * Cross-Lens 지문 (§28 · §29).
 *
 * ⚠️ **입력이 세 렌즈의 지문 그 자체다.** 렌즈 하나가 바뀌면 그 지문이 바뀌고,
 * 따라서 Cross-Lens도 자동으로 무효화된다 — 어떤 값을 넣어야 하는지 손으로 다시
 * 세지 않아도 된다(빠뜨릴 자리가 없다).
 *
 * ⚠️ `aiThemes`도 들어간다. 같은 렌즈 입력이라도 AI가 실패해 테마가 없으면 Cross-Lens가
 * 받는 것이 다르고(§5 부분 실패), 그건 다른 응답을 만든다.
 */
export function crossLensFingerprint(input: {
  tense: RelationshipTense;
  allowsOutwardQuestions: boolean;
  lensFingerprints: readonly string[];
  aiThemes: readonly (string | null)[];
}): string {
  const { tense, allowsOutwardQuestions, lensFingerprints, aiThemes } = input;

  return `xlens_${digest([
    tense,
    allowsOutwardQuestions ? 'q1' : 'q0',
    ...lensFingerprints,
    ...aiThemes.map((theme) => (theme ? `t${theme.length}` : '-')),
  ])}`;
}
