import { currentSignalLabel } from '@/data/currentRelationship';
import { HARDEST_LABEL, PAST_FACTOR_LABEL } from '@/data/labels';
import { withObjectParticle } from '@/lib/korean';
import type {
  CurrentRelationshipEvidence,
  CurrentSignalAnswer,
  EvidenceStrength,
  MirrorAxisKey,
  MirrorScopeSummary,
  PastFactor,
  RelationshipEvidenceScope,
  RelationshipExperience,
} from '@/types';

import { HARDEST_TO_AXIS } from './mirrorAxisMap';

/**
 * Relationship Me Resolver — 이 축의 근거는 **언제의 나**인가 (v1.41 · §39.8)
 *
 * ══ 이 파일의 단 하나의 규칙 ═══════════════════════════════════════════════
 *
 * ```
 * STAGE가 source를 결정하지 않는다.
 * 실제 evidence의 존재 여부가 source를 결정한다.
 * ```
 *
 * 그래서 이 파일은 `RelationshipStage`·`RelationshipJob`·`RelationshipStatus`를
 * **import하지 않는다.** 타입으로도 받지 않는다. 받을 수 있게 두면 언젠가 누군가
 * `if (stage === 'dating') …`을 여기에 쓰고, 그 순간 v1.41이 고치려던 결함이 정확히
 * 되살아난다 — `dating`이라는 이유만으로 현재 근거를 만들어내는 것.
 *
 * ⚠️ `test:relationship-evidence`의 R1이 이 파일에 stage 관련 import가 0건임을
 * 검사한다. 주석이 아니라 테스트가 지킨다.
 *
 * ══ Stage별 정책이 실제로 어떻게 성립하는가 ═══════════════════════════════
 *
 * §39.8의 stage별 표는 **이 함수의 분기가 아니라 결과**다. 같은 규칙 하나로 전부
 * 설명된다 — "있으면 current, 없으면 past, 둘 다 없으면 none".
 *
 * | STAGE | 실제로 일어나는 일 | 왜 분기가 필요 없나 |
 * |---|---|---|
 * | `none` | S30을 권하지 않으므로 current가 비어 있다 → past 또는 none | 권유 지점이 화면에 있고 판정에는 없다 |
 * | `unknown` | 같음 | 같음 |
 * | `talking` | 권하지 않지만, **넣었으면 쓴다** | 사용자가 실제로 답한 것을 stage 때문에 버리지 않는다 |
 * | `dating` | 권한다 → 있으면 current | 없으면 past를 current라고 부르지 않는다(문구가 scope를 따른다) |
 * | `long_term` | 같음 | 같음 |
 * | `ended` | 권하지 않는다. 종료 전에 넣어둔 값은 **지우지 않는다** | scope는 `'current'`로 남고, 화면이 `그때 이 관계에서`로 부른다(§39.13) |
 *
 * `ended`의 마지막 줄이 이 설계의 시험이다. 관계가 끝났다고 evidence를 지우면
 * **회고의 재료를 없애는 것**이고, scope를 `'past'`로 바꿔치면 **S15~S17에서 답한
 * 것처럼 위장하는 것**이다. 그래서 값도 scope도 그대로 두고 **부르는 이름만** 바꾼다.
 */

/* ─────────────────────────────────────────── current answer → 근거의 강도 */

/**
 * 지금 관계 답변 → `EvidenceStrength`.
 *
 * ⚠️ **점수 환산이 아니다.** `often`을 3점, `rarely`를 1점으로 두고 declared와 빼는
 * 방식은 쓰지 않는다 — 그러면 선택형 답변에서 없던 정밀도를 만들어내는 것이고,
 * `mirror.ts`가 v1.0부터 거부해 온 바로 그 방식이다(파일 상단 주석 참고).
 *
 * 세 값이 각각 무엇을 뜻하는가:
 *
 * ```
 * often      이 축이 지금 뚜렷하게 드러난다        → 'hardest'   가장 강한 관계 근거
 * sometimes  드러나기도 하고 넘어가기도 한다        → 'important' 중간 강도 근거
 * rarely     지금은 거의 드러나지 않는다            → 'absent'    ⚠️ 아래 참고
 * unsure     아직 그런 상황이 없었다                → null        근거를 만들지 않는다
 * ```
 *
 * ⚠️ **`rarely` → `'absent'`가 `unsure`와 같지 않다.** 강도는 둘 다 '없음'이지만
 * `rarely`는 **사용자가 없다고 답한 것**이므로 scope가 `'current'`로 남는다. 그래서
 * 화면은 `지금 관계에서는 크게 드러나지 않는다고 답했어`라고 **근거를 보여줄 수
 * 있고**, evidenceRef도 만들어진다. `unsure`는 근거 자체가 없으므로 과거로 넘어간다.
 *
 * ⚠️ `'hardest'`라는 이름은 S16(`가장 힘들었던 순간`)에서 왔지만, 이 enum이 실제로
 * 뜻하는 것은 **근거의 강도**다(`types/index.ts` 정의 주석). 이름을 바꾸면
 * `crossSourceInsights`의 분기 8곳과 History Snapshot 문자열까지 함께 움직여야 하고,
 * 그건 v1.41의 범위가 아니다 — 대신 **사용자에게 보이는 문장은 scope가 만든다**
 * (`relationshipSignalTextOf`). 이름은 내부에 남고 시점은 화면에서 정확하다.
 */
const CURRENT_ANSWER_STRENGTH: Record<CurrentSignalAnswer, EvidenceStrength | null> = {
  often: 'hardest',
  sometimes: 'important',
  rarely: 'absent',
  unsure: null,
};

/* ────────────────────────────────────────────────────────── 축별 근거 해석 */

export interface AxisEvidenceResolution {
  strength: EvidenceStrength;
  scope: RelationshipEvidenceScope;
  /** `scope === 'current'`일 때 사용자가 실제로 고른 보기. 근거 문장·Snapshot이 쓴다 */
  currentAnswer: CurrentSignalAnswer | null;
}

/** 아직 아무 현재 근거도 없는 상태. 새 세션·legacy 세션·fixture가 공용으로 쓴다 */
export const NO_CURRENT_RELATIONSHIP: CurrentRelationshipEvidence = {
  signals: {},
  askedAt: null,
};

/**
 * 이 근거로 **서로 다른 시점을 비교할 수 있는가** (v1.44 · NEW-003)
 *
 * ══ 왜 필요한가 ═══════════════════════════════════════════════════════════
 *
 * `경험 후`·`예전보다`·`낮아졌어`처럼 Before/After를 주장하는 문장은 **두 시점의 실제
 * 근거가 있을 때만** 성립한다. 그런데 v1.41이 시제 문장을 가를 때 쓴 조건은
 * `scope === 'current'`였고, 그 **else 쪽에 `'none'`이 함께 들어 있었다**:
 *
 * ```
 * scope 'past'     이전 관계에서 이 항목을 꼽았다        → 비교할 두 시점이 있다
 * scope 'current'  지금 관계에 대해 답했다               → v1.41이 갈랐다 (동시점 불일치)
 * scope 'none'     관계 신호를 확인한 적이 없다          → ❌ 과거형 문장으로 떨어졌다
 * ```
 *
 * 그래서 관계 경험을 하나도 답하지 않고 `declared.contact = 5`만 답한 세션에서
 * `연락에 대한 기준이 경험 후 낮아졌어.` · `경험 후에는 우선순위가 옮겨간 사람일지도
 * 몰라.`가 나왔다(v1.44 QA · NEW-003). **같은 행의 근거 칸은 이미 사실을 말하고 있었다**
 * — `이전 관계에서 연락을 특별히 중요한 요소로 꼽지는 않았어`. 근거와 해석이 서로
 * 반대되는 말을 했다.
 *
 * ══ 왜 술어로 빼는가 ══════════════════════════════════════════════════════
 *
 * `scope !== 'current'`는 **blocklist**다 — scope가 하나 늘어날 때마다 조용히 과거형
 * 쪽으로 떨어진다. v1.41에 `'current'`가 추가됐을 때 실제로 그렇게 됐고, 이번에
 * `'none'`에서 같은 일이 드러났다. allowlist로 뒤집으면 새 scope는 **기본이 안전**이다.
 *
 * > v1.41 §39.13의 교훈 그대로다 — 목록을 늘리는 것이 아니라 목록을 만드는 방법을 바꾼다.
 *
 * ⚠️ **판정은 바뀌지 않는다.** `stateFor`·`MIRROR_AXES`·`gapCount`·focus 축 선택은
 * 한 줄도 손대지 않았다. 이 술어는 **문장을 고르는 데만** 쓴다 — v1.41이 CHANGE라는
 * 이름과 계산을 그대로 두고 문장만 가른 것과 같은 이유다(History Snapshot의
 * `SavedState`가 소급해서 달라지면 안 된다).
 */
export function hasTemporalComparison(scope: RelationshipEvidenceScope): boolean {
  return scope === 'past';
}

/**
 * 이 축에 **관계 근거가 하나라도 있는가** (v1.44 · NEW-003)
 *
 * ⚠️ `hasTemporalComparison`과 **다른 질문이다.** 섞으면 조용히 회귀가 난다 —
 * 실제로 이번 수정 중에 한 번 났고 실측으로 잡았다:
 *
 * ```
 * hasTemporalComparison   Before/After를 주장해도 되는가   'past'만
 * hasRelationshipEvidence 관계에서의 반응을 말해도 되는가   'past' + 'current'
 * ```
 *
 * `buildSummary`에 전자를 쓰면 `지금 관계에서 자주 그런다`고 **직접 답한** 사용자의
 * GAP 요약까지 `정보가 조금 더 필요해`로 바뀐다. 사용자가 답한 것을 없는 것으로
 * 취급하는 것이고, v1.41 §39.8이 거부한 방향이다(있으면 쓴다).
 *
 * 문장을 고를 때는 **그 문장이 무엇을 주장하는지**로 술어를 고른다:
 * 시제를 주장하면 전자, 반응의 존재를 주장하면 후자다.
 */
export function hasRelationshipEvidence(scope: RelationshipEvidenceScope): boolean {
  return scope !== 'none';
}

/** 이 세션에 현재 관계 근거가 **하나라도** 있는가 (`unsure`는 근거가 아니다) */
export function hasCurrentEvidence(current: CurrentRelationshipEvidence): boolean {
  return Object.values(current.signals).some(
    (answer) => answer !== undefined && CURRENT_ANSWER_STRENGTH[answer] !== null,
  );
}

/** 사용자가 실제로 답한 축 수 (`unsure` 포함 — '답했다'는 사실은 맞다) */
export function answeredAxisCount(current: CurrentRelationshipEvidence): number {
  return Object.values(current.signals).filter((answer) => answer !== undefined).length;
}

/**
 * 과거 관계 경험에서 이 축의 근거 강도. **v1.40까지의 `evidenceStrengthOf`와 완전히
 * 같은 함수다** — 옮겨 온 것이고 한 줄도 바꾸지 않았다. 현재 근거가 없는 세션에서
 * 판정이 글자 하나도 달라지지 않는 근거가 이것이다(fixture E0).
 */
function pastStrengthOf(axis: MirrorAxisKey, experience: RelationshipExperience): EvidenceStrength {
  if (experience.hardest && HARDEST_TO_AXIS[experience.hardest] === axis) return 'hardest';
  if (experience.important.includes(axis as PastFactor)) return 'important';
  return 'absent';
}

/**
 * **이 파일의 진입점.** 축 하나의 근거를 해석한다.
 *
 * 우선순위는 두 줄뿐이다.
 *
 *  ① 지금 관계에 대해 **답한 것이 있으면** 그것이 근거다 (`unsure`는 답이지만 근거가 아니다)
 *  ② 없으면 과거 경험을 본다 — 그리고 **그것을 현재라고 부르지 않는다**
 *
 * ⚠️ 왜 current가 past보다 먼저인가: 두 답변이 서로 다른 방향을 가리킬 때 하나를
 * 골라야 하는데, Mirror의 오른쪽 칸이 답해야 하는 질문은 `관계 속의 나는 실제로
 * 어떤가`이고 **지금 관계가 더 최신 사실**이다. v1.40이 `none`+`couple`을 `talking`으로
 * 읽은 것과 같은 판단이다 — 사용자가 고른 라벨보다 사용자가 넣은 데이터가, 오래된
 * 데이터보다 최신 데이터가 더 사실에 가깝다.
 *
 * ⚠️ **버려지는 게 아니다.** past 근거는 Premium의 `Current × Past` 연결(§39.18)에서
 * 그대로 쓰인다 — 무료 Mirror가 축마다 한 시점만 보여주는 자리에서, 유료는 **두
 * 시점을 나란히** 놓는다. 그게 무료의 반복이 아닌 이유다.
 */
export function resolveAxisEvidence(input: {
  axis: MirrorAxisKey;
  experience: RelationshipExperience;
  current: CurrentRelationshipEvidence;
}): AxisEvidenceResolution {
  const { axis, experience, current } = input;

  const answer = current.signals[axis];
  if (answer !== undefined) {
    const strength = CURRENT_ANSWER_STRENGTH[answer];
    if (strength !== null) return { strength, scope: 'current', currentAnswer: answer };
    // `unsure` — 답은 했지만 근거는 없다. 과거로 넘어간다.
  }

  // 관계 경험 자체를 건너뛴 사용자(E4)에게 과거 근거를 만들어내지 않는다.
  if (experience.skipped) return { strength: 'absent', scope: 'none', currentAnswer: null };

  const past = pastStrengthOf(axis, experience);
  return past === 'absent'
    ? { strength: 'absent', scope: 'none', currentAnswer: null }
    : { strength: past, scope: 'past', currentAnswer: null };
}

/* ──────────────────────────────────────────────────── 근거 문장 (scope별) */

/**
 * 오른쪽 칸에 실제로 보이는 문장. **scope가 시제를 정한다.**
 *
 * ⚠️ v1.40의 세 문장(`이전 관계에서 …`)은 **한 글자도 바꾸지 않았다.** `scope === 'past'`
 * 분기가 그 문장 그대로다 — 근거의 출처가 과거인 사용자에게는 v1.40.1과 똑같은
 * 화면이 나온다. 새로 생긴 것은 `'current'`·`'none'` 분기뿐이다.
 *
 * @param tense `ended`에서 `'former'` — 값도 scope도 그대로 두고 **부르는 이름만**
 *   바꾼다(`지금 관계에서` → `그때 이 관계에서`). 시제를 고치려고 evidence source를
 *   바꾸지 않는다(§39.13).
 */
export function relationshipSignalTextOf(input: {
  axis: MirrorAxisKey;
  label: string;
  resolution: AxisEvidenceResolution;
  experience: RelationshipExperience;
  tense: RelationshipTense;
}): string {
  const { axis, label, resolution, experience, tense } = input;

  if (resolution.scope === 'current') {
    const answerLabel = resolution.currentAnswer
      ? currentSignalLabel(axis, resolution.currentAnswer)
      : null;
    const prefix = currentPrefix(tense);
    // 사용자가 화면에서 실제로 읽고 고른 보기를 그대로 인용한다 — 우리가 요약하지 않는다.
    return answerLabel
      ? `${prefix} ${quoted(answerLabel)}라고 답함`
      : `${prefix} ${withObjectParticle(label)} 답한 내용이 있어`;
  }

  if (resolution.scope === 'past') {
    if (resolution.strength === 'hardest' && experience.hardest) {
      return `이전 관계에서 ${HARDEST_LABEL[experience.hardest]}으로 선택`;
    }
    return `이전 관계에서 ${withObjectParticle(PAST_FACTOR_LABEL[axis as PastFactor])} 중요했던 요소로 선택`;
  }

  // scope === 'none' — 근거가 없다는 사실을 그대로 말한다.
  return experience.skipped
    ? `아직 관계에서의 신호를 확인한 적이 없어`
    : `이전 관계에서 ${withObjectParticle(label)} 특별히 중요한 요소로 꼽지는 않았어`;
}

function quoted(text: string): string {
  return `"${text}"`;
}

/* ───────────────────────────────────────────── 시제 (framing · 판정 아님) */

/**
 * 이 리포트에서 **지금 관계를 어떻게 부르는가**. (v1.41 · §39.13)
 *
 * ⚠️ **evidence가 아니다.** 이 값은 근거를 만들지도, 고르지도, 강도를 바꾸지도
 * 않는다 — 이미 정해진 근거를 부를 때 쓰는 **호칭**이다. v1.40.1이
 * `DeepReportJobContext`를 framing 전용으로 둔 것과 같은 위계다.
 *
 * ```
 * current   진행 중인 관계          "지금 관계에서"
 * former    끝난 관계 (job=ended)   "그때 이 관계에서"
 * ```
 *
 * ⚠️ 왜 `RelationshipJob`을 그대로 넘기지 않는가: Job은 6종이고 여기서 필요한 구분은
 * **둘**이다. Job을 넘기면 이 파일이 Job별 분기를 갖게 되고, 그러면 위의 '단 하나의
 * 규칙'이 무너진다. 호출부가 `relationshipTenseOf(job)` 한 번으로 좁혀서 넘긴다.
 */
export type RelationshipTense = 'current' | 'former';

/**
 * 지금 관계 근거를 문장에서 부르는 말. **이 문구의 단일 source다.** (v1.42 §41.4)
 *
 * ⚠️ `aiEvidenceResolver`가 이걸 import한다. v1.41까지 그 파일은
 * `지금 관계에서`를 **직접 하드코딩**하고 있었고, 그래서 `ended` 사용자의 Premium 연결
 * 근거 목록(`connection.evidence[].text`)에 현재형이 남았다 — §39.9가 Mirror 캡션에서
 * 배운 것과 **같은 실패 형태**(문자열이 검사할 수 없는 자리에 인라인으로 있었다)다.
 */
export function currentEvidencePrefix(tense: RelationshipTense): string {
  return tense === 'former' ? '그때 이 관계에서' : '지금 관계에서';
}

function currentPrefix(tense: RelationshipTense): string {
  return currentEvidencePrefix(tense);
}

/** 화면·리포트가 공용으로 쓰는 시점 라벨 (annotation 전용 · 카드 추가 없음) */
export const SCOPE_LABEL: Record<RelationshipEvidenceScope, string> = {
  current: '지금 관계',
  past: '이전 관계',
  none: '아직 확인 전',
};

/**
 * 지금 관계 근거의 라벨. **반환 타입이 두 리터럴로 좁다.** (v1.42 §41.4)
 *
 * `aiEvidenceResolver`의 `EvidenceSourceLabel`(리터럴 union)에 그대로 대입되려면
 * `string`이 아니라 리터럴이어야 한다 — 그래서 `scopeLabelOf`를 넓게 두고 이 함수를
 * 따로 뒀다. **문구는 여기 한 곳에만 있다**(`scopeLabelOf`도 이걸 부른다).
 */
export function currentEvidenceLabel(tense: RelationshipTense): '지금 관계' | '그때 이 관계' {
  return tense === 'former' ? '그때 이 관계' : '지금 관계';
}

/** `ended`에서는 `지금 관계`라고 부르지 않는다 */
export function scopeLabelOf(
  scope: RelationshipEvidenceScope,
  tense: RelationshipTense,
): string {
  if (scope === 'current') return currentEvidenceLabel(tense);
  return SCOPE_LABEL[scope];
}

/**
 * Mirror 헤더가 근거의 시점을 말하는 한 줄. (v1.41)
 *
 * ══ 왜 화면이 아니라 여기에 있는가 ═══════════════════════════════════════
 *
 * 처음에는 `app/mirror/page.tsx`에 인라인으로 있었고, `mixed` 분기가
 * `(지금 N · 이전 M)`로 **하드코딩**돼 있었다. 그래서 `ended` 사용자의 화면에서
 * 행 라벨은 `그때 이 관계`인데 캡션만 `지금 2 · 이전 1`이 됐다(브라우저 실측 J7).
 *
 * ⚠️ **fixture가 이걸 잡지 못했다** — 2차 guard의 어휘는 `지금 관계`·`지금 상대`인데
 * 새어 나간 문자열은 `지금 2`였고, 애초에 페이지 인라인 문자열은 dev route의
 * `renderedStrings`에 들어갈 수도 없었다. v1.41이 §39.13에서 배운 것과 **같은 실패
 * 형태가 한 번 더** 나온 것이다.
 *
 * 그래서 문자열만 고치지 않고 **검사할 수 있는 자리로 옮겼다.** dev route가 이 함수의
 * 결과를 내보내므로 fixture가 `ended` 캡션의 시제를 직접 검사한다 —
 * 페이지 인라인으로 두면 브라우저를 열어야만 보인다.
 */
export function scopeCaptionOf(input: {
  summary: MirrorScopeSummary;
  tense: RelationshipTense;
  /** 한 시점으로 부를 수 없을 때 쓰는 Job 문구(`STAGE_JOB_COPY[job].mirrorUse`) */
  fallback: string;
}): string {
  const { summary, tense, fallback } = input;
  const now = tense === 'former' ? '그때' : '지금';

  if (summary.mixed) {
    return `항목마다 근거 시점이 달라 (${now} ${summary.currentCount} · 이전 ${summary.pastCount})`;
  }
  if (summary.dominant === 'current') {
    return `${tense === 'former' ? '그때 이 관계' : '지금 관계'}에서 답한 내용 기준`;
  }
  return fallback;
}

/* ──────────────────────────────────────────────────────── scope 요약 (§39.9) */

/**
 * 판정된 축들의 시점 분포.
 *
 * ⚠️ **`dominant`는 다수결이 아니다.** 섞여 있으면 null이다 — 3:2로 current가
 * 많다고 전체를 `지금 관계 속의 나`라고 부르면 나머지 2축에 대해서는 거짓이 된다.
 * 이름을 붙일 수 있는 경우는 **한 시점만 있을 때**뿐이다.
 */
export function summarizeScopes(
  scopes: readonly RelationshipEvidenceScope[],
): MirrorScopeSummary {
  const currentCount = scopes.filter((scope) => scope === 'current').length;
  const pastCount = scopes.filter((scope) => scope === 'past').length;
  const noneCount = scopes.filter((scope) => scope === 'none').length;
  const mixed = currentCount > 0 && pastCount > 0;

  const dominant: RelationshipEvidenceScope | null = mixed
    ? null
    : currentCount > 0
      ? 'current'
      : pastCount > 0
        ? 'past'
        : null;

  return { currentCount, pastCount, noneCount, mixed, dominant };
}
