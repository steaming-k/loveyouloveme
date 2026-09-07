import { MIRROR_AXES } from '@/data/axes';
import { SELF_PAIR_RULES, SELF_VALUE_TEXT, type SelfLevel } from '@/data/firstContact';
import { OBSERVED_CATEGORY_LABEL } from './observedSignals';
import type {
  FirstContactReport,
  MirrorAxisKey,
  ObservedSignalCategory,
  RelationshipHistoryEntry,
  SessionAnswers,
} from '@/types';

/**
 * Solo Observation History — **시간이 지나며 달라지는 기준을 관찰한다** (v1.34 · P4-B)
 *
 *   CURRENT   지금 답으로 매번 다시 계산하는 해석      (`/first-contact`)
 *   HISTORY   그때의 값을 그대로 얼려둔 관찰           (저장된 snapshot)
 *   CHANGE    두 snapshot **사이**의 비교
 *
 * 이 파일은 세 번째만 담당한다. **History 화면이 현재 answers로 다시 계산하지 않는다** —
 * 그러면 과거가 지금에 맞춰 바뀌어버리고, 그건 기록이 아니다.
 *
 * ⚠️ History는 '누구와 몇 번 만났는지'를 남기는 곳이 아니다. 서비스 카피가 이미
 * "네 기준이 어떻게 움직였는지만 남겨"라고 정의했고, Solo는 그 정의에 정확히 맞는다.
 * 그래서 저장 대상은 상대 identity도 만남 횟수도 아니라 **SELF SIGNAL SNAPSHOT**이다.
 */

/* ------------------------------------------------------------- audience */

/**
 * 이 기록이 누구에 대한 관찰인가.
 *
 * ⚠️ v1.33 이전 기록에는 `audience`가 없다. 그건 전부 커플 관찰이므로 `couple`로 읽는다 —
 * **기존 기록을 다시 쓰지 않는다**(자동 backfill 금지, §31/§70과 같은 원칙).
 */
export function historyAudienceOf(entry: RelationshipHistoryEntry): 'couple' | 'solo' {
  return entry.audience === 'solo' ? 'solo' : 'couple';
}

/**
 * 같은 audience의 기록만 남긴다.
 *
 * ⚠️ 이 필터가 없으면 **커플 변화 리포트가 Solo 기록과 비교된다.**
 * `buildHistoryReport`는 마지막 두 항목을 보고 `findRepeatedRelationshipSignals`는
 * 모든 항목을 훑는데, 둘 다 audience를 몰랐다(P4-B Audit).
 */
export function filterHistoryByAudience(
  entries: readonly RelationshipHistoryEntry[],
  audience: 'couple' | 'solo',
): RelationshipHistoryEntry[] {
  return entries.filter((entry) => historyAudienceOf(entry) === audience);
}

/* ------------------------------------------------------------- snapshot */

const AXIS_LABEL = new Map(MIRROR_AXES.map((axis) => [axis.key, axis.label]));

/**
 * 지금의 First Contact 결과를 **얼려둘 형태**로 옮긴다.
 *
 * ⚠️ 해석 문장을 통째로 저장하지 않는다. 값(`level`)과 규칙 id(`pairIds`)만 남기고,
 * 문장은 나중에 그때의 값으로 다시 만든다 — 그래야 문구를 고쳐도 과거 기록이
 * 깨지지 않고, 저장소에 자유서술이 쌓이지 않는다(Privacy).
 */
export function buildSoloSnapshot(input: {
  report: FirstContactReport;
  answers: SessionAnswers;
}): NonNullable<RelationshipHistoryEntry['soloSnapshot']> {
  const { report, answers } = input;

  const sources: NonNullable<RelationshipHistoryEntry['soloSnapshot']>['sources'] = ['declared'];
  if (answers.mbti) sources.push('mbti');
  if (answers.photos.length > 0 && answers.observedAnalysis) sources.push('observed');
  if (!answers.experience.skipped) sources.push('experience');

  return {
    signals: report.signals.map((signal) => ({
      axis: signal.key,
      // 값의 '단계'만 얼려둔다 — 문장은 표시할 때 다시 만든다
      level: levelKeyOf(signal.key, signal.valueText),
    })),
    headline: report.headline,
    pairIds: report.pairs.map((pair) => pair.id),
    sources,
    observed: currentObservedSnapshot(answers),
  };
}

/* ------------------------------------------------------------- observed */

/**
 * 지금 사진에서 보이는 활동 범주를 **얼려둘 최소 형태**로 옮긴다 (§5).
 *
 * ⚠️ 사진·base64·AI 서술 원문은 옮기지 않는다. 이미 계산돼 있던 `ObservedSignal`의
 * `category`/`occurrenceCount`/`strength`만 읽는다 — 여기서 새 판정을 만들지 않는다.
 *
 * ⚠️ 사용자가 제외(`excluded`)한 관찰은 넣지 않는다. 화면에서 지운 근거가 기록에
 * 남아 다음 관찰과 비교되면, 사용자가 취소한 관찰이 되살아난다.
 *
 * @returns 사진 근거가 없으면 `[]` — `undefined`(그때는 저장하지 않았음)와 구분한다.
 */
function currentObservedSnapshot(
  answers: SessionAnswers,
): NonNullable<NonNullable<RelationshipHistoryEntry['soloSnapshot']>['observed']> {
  if (answers.photos.length === 0 || !answers.observedAnalysis) return [];

  const seen = new Set<ObservedSignalCategory>();
  const items: NonNullable<
    NonNullable<RelationshipHistoryEntry['soloSnapshot']>['observed']
  > = [];

  for (const trait of answers.observedAnalysis.traits) {
    const signal = trait.signal;
    if (!signal) continue;
    if (answers.observations[trait.id]?.excluded) continue;
    if (seen.has(signal.category)) continue;
    seen.add(signal.category);
    items.push({
      category: signal.category,
      occurrences: signal.occurrenceCount,
      strength: signal.strength,
    });
  }

  return items;
}

/**
 * 지금 사진에서 보이는 활동 범주 (비교의 NOW 쪽).
 *
 * @returns 사진 근거가 아예 없으면 `null`. `[]`(사진은 있는데 집계 신호가 없음)와
 *   구분해야 한다 — 전자는 '비교할 수 없다'이고 후자는 '이번엔 장면이 없었다'다(§29).
 */
export function currentObservedCategories(
  answers: SessionAnswers,
): { category: ObservedSignalCategory }[] | null {
  if (answers.photos.length === 0 || !answers.observedAnalysis) return null;
  return currentObservedSnapshot(answers).map((item) => ({ category: item.category }));
}

/**
 * 한 활동 범주가 시간축에서 어떻게 나타났는가 (§7).
 *
 * ⚠️ 네 번째 상태 `INSUFFICIENT`는 **범주 단위가 아니라 리포트 단위**다
 * (`ObservedHistoryReport.comparable === false`). 비교할 과거 사진 스냅샷이 없거나
 * 지금 사진 근거가 없는 것은 특정 범주의 성질이 아니라 비교 자체의 상태이기 때문이다 —
 * 범주별로 `INSUFFICIENT`를 붙이면 '이 활동만 정보가 부족하다'로 잘못 읽힌다.
 */
export type ObservedChangeState = 'NEW' | 'STABLE' | 'ABSENT';

export interface ObservedHistoryChange {
  category: ObservedSignalCategory;
  label: string;
  state: ObservedChangeState;
  /** 이 범주가 보인 관찰 횟수(과거 + 현재) */
  observationCount: number;
  /** 반복 어휘를 써도 되는가 — `SOLO_REPEAT_MIN_OBSERVATIONS`와 **같은 기준**이다(§8) */
  repeatable: boolean;
  /** 화면에 그대로 쓰는 한 문장 */
  note: string;
}

export interface ObservedHistoryReport {
  /** `observed`를 저장한 과거 기록 수 */
  snapshotCount: number;
  comparable: boolean;
  changes: ObservedHistoryChange[];
}

/**
 * 과거 사진 관찰과 지금 사진 관찰을 비교한다 (§5 ~ §8).
 *
 * ⚠️ **장면 관찰이지 취향·성격 진단이 아니다.** 그래서 이 함수가 만드는 문장은
 * '있었다 / 없었다 / 새로 나타났다'까지다:
 *
 *   허용   `지난 관찰에는 카페 장면이 있었고, 이번 관찰에서는 보이지 않았어.`
 *   금지   `카페를 덜 좋아하게 됐어.` · `취향이 바뀌었어.` · `독립적인 성향이 강해졌어.`
 *
 * ⚠️ **1회 → 1회 없음을 '사라졌다'로 과장하지 않는다**(§7). `ABSENT` 문구는
 * "이번 관찰에서는 보이지 않았어"까지고, 그 이상은 말하지 않는다.
 *
 * ⚠️ **사진이 없어졌을 때 전부 ABSENT로 만들지 않는다**(§29). 지금 사진 근거가
 * 아예 없으면 그건 '장면이 사라졌다'가 아니라 '이번엔 비교할 사진이 없다'다.
 */
export function buildObservedHistoryReport(input: {
  entries: readonly RelationshipHistoryEntry[];
  /** 지금 사진에서 보이는 범주. 사진이 없으면 null — `[]`(사진은 있는데 신호 없음)과 다르다 */
  current: readonly { category: ObservedSignalCategory }[] | null;
}): ObservedHistoryReport {
  const snapshots = filterHistoryByAudience(input.entries, 'solo')
    .map((entry) => entry.soloSnapshot?.observed)
    .filter((observed): observed is NonNullable<typeof observed> => observed !== undefined);

  if (snapshots.length === 0 || input.current === null) {
    return { snapshotCount: snapshots.length, comparable: false, changes: [] };
  }

  const latest = snapshots[snapshots.length - 1]!;
  const pastLatest = new Set(latest.map((item) => item.category));
  const currentSet = new Set(input.current.map((item) => item.category));

  /** 표시 순서는 `OBSERVED_CATEGORY_LABEL`(= `CATEGORY_RULES`) 순서를 그대로 따른다 */
  const order = Object.keys(OBSERVED_CATEGORY_LABEL) as ObservedSignalCategory[];
  const changes: ObservedHistoryChange[] = [];

  for (const category of order) {
    const inPast = pastLatest.has(category);
    const inNow = currentSet.has(category);
    if (!inPast && !inNow) continue;

    const label = OBSERVED_CATEGORY_LABEL[category];
    const pastHits = snapshots.filter((snapshot) =>
      snapshot.some((item) => item.category === category),
    ).length;
    const observationCount = pastHits + (inNow ? 1 : 0);
    const repeatable = inNow && inPast && observationCount >= SOLO_REPEAT_MIN_OBSERVATIONS;

    if (inNow && !inPast) {
      changes.push({
        category,
        label,
        state: 'NEW',
        observationCount,
        repeatable: false,
        note: `${label} 장면이 이번 관찰에 새로 나타났어.`,
      });
      continue;
    }

    if (inNow && inPast) {
      changes.push({
        category,
        label,
        state: 'STABLE',
        observationCount,
        repeatable,
        note: repeatable
          ? `${observationCount}번의 관찰에서 ${label} 장면이 있었어.`
          : `지난 관찰에도, 이번 관찰에도 ${label} 장면이 있었어.`,
      });
      continue;
    }

    changes.push({
      category,
      label,
      state: 'ABSENT',
      observationCount,
      repeatable: false,
      // ⚠️ '사라졌다'가 아니다 — 이번 관찰에서 보이지 않았다는 사실까지만 말한다(§7).
      note: `지난 관찰에는 ${label} 장면이 있었고, 이번 관찰에서는 보이지 않았어.`,
    });
  }

  return { snapshotCount: snapshots.length, comparable: changes.length > 0, changes };
}

/**
 * 저장된 `valueText`에서 단계 키를 되찾는다.
 *
 * `SELF_VALUE_TEXT`가 단계별 문장의 유일한 출처라서, 역방향 조회로 단계를 복원할 수 있다.
 * 문구를 고치면 과거 기록의 단계를 못 찾을 수 있는데, 그때는 `unknown`으로 두고
 * **비교에서 조용히 빠진다** — 없는 비교를 지어내지 않는다.
 */
function levelKeyOf(axis: MirrorAxisKey, valueText: string): string {
  const table = SELF_VALUE_TEXT[axis];
  const found = (Object.keys(table) as SelfLevel[]).find((level) => table[level] === valueText);
  return found ?? 'unknown';
}

/* ----------------------------------------------------------- entry */

/**
 * Solo 관찰을 History Entry로 만든다.
 *
 * ⚠️ 기존 `buildHistoryEntry`를 쓰지 않는다. 그 함수는 첫 줄에서
 * `!mirror.available`이면 `null`을 돌려주는데, 관계 경험이 없는 사용자는 Mirror가
 * 통째로 비어 있어 **영원히 기록을 남길 수 없었다**(P4-B Audit).
 *
 * ⚠️ `analysisId`는 기존 지문을 그대로 쓴다(`status + declared + experience`).
 * 같은 답으로 새로고침하며 반복 저장해도 새 항목이 쌓이지 않고, **답이 실제로
 * 달라지면** 새 항목이 된다 — 저장 반복이 관찰 횟수처럼 부풀지 않게 하는 기존 정책이다.
 *
 * ⚠️ `mirrorSnapshot.insights`는 비어 있을 수 있다. 저장소 검증(`isEntry`)은 배열이기만
 * 하면 통과하고, 커플 계산은 `audience` 필터가 이 항목을 아예 보지 않는다.
 */
export function buildSoloHistoryEntry(input: {
  answers: SessionAnswers;
  report: FirstContactReport;
  id: string;
  createdAt: string;
  analysisId: string;
}): RelationshipHistoryEntry | null {
  const { answers, report, id, createdAt, analysisId } = input;

  // 관찰할 기준이 모이지 않았으면 기록도 만들지 않는다 — 빈 기록을 남기지 않는다.
  if (!report.available) return null;

  return {
    id,
    analysisId,
    createdAt,
    audience: 'solo',
    context: {
      relationshipStatus: answers.status,
      // Solo에는 상대가 없다 — 없는 값을 지어내지 않는다.
      targetRelation: null,
    },
    profileSnapshot: { mbti: answers.mbti },
    declaredSnapshot: { ...answers.declared },
    relationshipEvidence: {
      important: [...answers.experience.important],
      hardest: answers.experience.hardest,
      selfGap: answers.experience.selfGap,
      adaptive: answers.experience.adaptive,
    },
    /**
     * Solo에는 Mirror 판정이 없다. 빈 배열로 두고 **없는 판정을 지어내지 않는다** —
     * 커플 계산은 audience 필터가 이 항목을 보지 않으므로 개수도 오염되지 않는다.
     */
    mirrorSnapshot: { insights: [], focusAxis: null },
    coreInsight: {
      // 그때 화면 맨 위에 보인 한 문장. 규칙으로 만든 문장이라 AI meta가 없다.
      original: report.headline,
      userCorrection: null,
      verdict: null,
    },
    evidenceCoverage: report.pairs.length > 0 ? 'medium' : 'low',
    soloSnapshot: buildSoloSnapshot({ report, answers }),
  };
}

/* -------------------------------------------------------------- compare */

/** 한 축이 시간축에서 어떻게 움직였는가 */
export type SoloAxisChangeState = 'STABLE' | 'CHANGE' | 'NEW';

export interface SoloAxisChange {
  axis: MirrorAxisKey;
  label: string;
  state: SoloAxisChangeState;
  /** 과거 기록에서의 값(가장 최근 과거) */
  previousText: string | null;
  /** 지금 값 */
  currentText: string;
  /**
   * 이 판정을 뒷받침하는 **관찰 횟수**(과거 + 현재).
   * `repeatable`이 false면 화면이 '반복/계속' 어휘를 쓰지 않는다(§18).
   */
  observationCount: number;
  /**
   * 반복 어휘를 써도 되는가.
   *
   * ⚠️ **2시점은 반복의 증거가 아니다.** 과거 1개 + 현재로는 '한 번 더 같았다'까지고,
   * '꾸준히/계속/여전히'는 과거 2개 이상 + 현재(= 관찰 3회)부터 쓴다.
   */
  repeatable: boolean;
}

/** 반복 어휘를 허용하는 최소 관찰 횟수 (과거 2 + 현재 1) */
export const SOLO_REPEAT_MIN_OBSERVATIONS = 3;

export interface SoloHistoryReport {
  /** 이 사용자에게 저장된 Solo 기록 수 */
  entryCount: number;
  /** 비교할 과거가 하나라도 있는가 */
  comparable: boolean;
  changes: SoloAxisChange[];
  /** 화면 맨 위 한 줄. 비교할 게 없으면 null */
  headline: string | null;
  /**
   * 비교의 PAST 쪽으로 **실제로 쓴** 기록 id (v1.35).
   *
   * ⚠️ 화면·엔진이 `useHistory().latest`를 대신 쓰면 안 된다 — 그 값은 audience를
   * 가리지 않아서, 커플 기록이 마지막에 저장돼 있으면 Solo 비교와 다른 기록을 가리킨다.
   * 근거(evidenceRef)는 **비교에 참여한 기록**을 가리켜야 한다.
   */
  baselineEntryId: string | null;
}

const LEVEL_TEXT = (axis: MirrorAxisKey, level: string): string | null => {
  const table = SELF_VALUE_TEXT[axis];
  return level in table ? table[level as SelfLevel] : null;
};

/**
 * 과거 Solo 기록들과 지금 결과를 비교한다.
 *
 * ⚠️ **'너는 변했어'라고 말하지 않는다.** 값이 달라진 것은 그때의 답과 지금의 답이
 * 다르다는 사실까지다 — 성향이 변했다는 판정이 아니다(§19).
 */
export function buildSoloHistoryReport(input: {
  entries: readonly RelationshipHistoryEntry[];
  /**
   * 지금 결과. **`null`을 그대로 받는다** — 커플 사용자는 First Contact Report가
   * 만들어지지 않아서 `useFirstContact()`가 null을 준다. 예전 호출부는
   * `report ?? { available: false } as never`로 타입을 우회하고 있었다.
   */
  current: FirstContactReport | null;
}): SoloHistoryReport {
  const soloEntries = filterHistoryByAudience(input.entries, 'solo').filter(
    (entry) => entry.soloSnapshot !== undefined,
  );

  const current = input.current;
  if (soloEntries.length === 0 || !current?.available) {
    return {
      entryCount: soloEntries.length,
      comparable: false,
      changes: [],
      headline: null,
      baselineEntryId: null,
    };
  }

  /** 가장 최근 과거가 비교의 기준선이다 */
  const latest = soloEntries[soloEntries.length - 1]!;
  const changes: SoloAxisChange[] = [];

  for (const signal of current.signals) {
    const currentLevel = levelKeyOf(signal.key, signal.valueText);
    const past = soloEntries
      .map((entry) => entry.soloSnapshot?.signals.find((item) => item.axis === signal.key)?.level)
      .filter((level): level is string => Boolean(level) && level !== 'unknown');

    if (past.length === 0) {
      changes.push({
        axis: signal.key,
        label: AXIS_LABEL.get(signal.key) ?? signal.key,
        state: 'NEW',
        previousText: null,
        currentText: signal.valueText,
        observationCount: 1,
        repeatable: false,
      });
      continue;
    }

    const previousLevel =
      latest.soloSnapshot?.signals.find((item) => item.axis === signal.key)?.level ??
      past[past.length - 1]!;
    const same = previousLevel === currentLevel;
    /**
     * 반복 판정은 **같은 값이 이어진 경우에만** 센다. 값이 바뀌었으면 그 자체가
     * '이번엔 달라졌다'이므로 반복 횟수를 자랑할 자리가 아니다.
     */
    const streak = same ? past.filter((level) => level === currentLevel).length + 1 : 1;

    changes.push({
      axis: signal.key,
      label: AXIS_LABEL.get(signal.key) ?? signal.key,
      state: same ? 'STABLE' : 'CHANGE',
      previousText: LEVEL_TEXT(signal.key, previousLevel),
      currentText: signal.valueText,
      observationCount: streak,
      repeatable: streak >= SOLO_REPEAT_MIN_OBSERVATIONS,
    });
  }

  return {
    entryCount: soloEntries.length,
    comparable: true,
    changes,
    headline: buildHeadline(changes),
    baselineEntryId: latest.id,
  };
}

/**
 * 비교 결과 한 줄.
 *
 * ⚠️ 변화가 없으면 '변화 없음'으로 끝내지 않는다 — 같았다는 것도 관찰이다.
 */
function buildHeadline(changes: readonly SoloAxisChange[]): string {
  const changed = changes.filter((change) => change.state === 'CHANGE');
  const isNew = changes.filter((change) => change.state === 'NEW');

  if (changed.length > 0) {
    /**
     * v1.35 — **축 이름을 다 나열하지 않는다.** 5축이 모두 달라진 세션에서
     * "개인 시간 · 연락 · 취미 공유 · 갈등 해결 · 애정 표현에서 …"가 되어 한 문장이
     * 목록처럼 읽혔다(360px 실측). 앞의 세 개까지만 부르고 나머지는 개수로 말한다 —
     * 축별 상세는 바로 아래 목록에 전부 있으므로 정보가 사라지지 않는다.
     */
    const MAX_LABELS = 3;
    const shown = changed.slice(0, MAX_LABELS).map((change) => change.label).join(' · ');
    const rest = changed.length - MAX_LABELS;
    const labels = rest > 0 ? `${shown} 외 ${rest}개` : shown;
    return `${labels}에서 지난 관찰과 다르게 답했어.`;
  }
  if (isNew.length === changes.length) {
    return '이번에 처음 답한 기준들이야.';
  }
  return '지난 관찰과 같은 방향으로 답했어.';
}

/* --------------------------------------------------- snapshot 표시 (§11) */

/**
 * 저장된 단계 키를 그때의 문장으로 되돌린다.
 *
 * ⚠️ 문장을 저장하지 않았기 때문에 **표시할 때 다시 만든다**(§5 Privacy). 문구를 고쳐서
 * 단계를 못 찾으면 `null`이고, 화면은 그 줄을 아예 그리지 않는다 — 없는 값을 지어내지 않는다.
 */
export function soloSnapshotSignalText(axis: MirrorAxisKey, level: string): string | null {
  return LEVEL_TEXT(axis, level);
}

/**
 * 그때 함께 나타난 두 신호의 관찰 문장 (§11).
 *
 * 저장된 것은 규칙 id뿐이라 여기서 `SELF_PAIR_RULES`를 다시 읽는다. 규칙이 삭제·개명되면
 * 그 항목은 조용히 빠진다 — 과거 기록을 새 규칙으로 다시 쓰지 않는다.
 */
export function soloSnapshotPairs(
  pairIds: readonly string[],
): { id: string; labels: string; observation: string }[] {
  return pairIds
    .map((id) => SELF_PAIR_RULES.find((rule) => rule.id === id))
    .filter((rule): rule is (typeof SELF_PAIR_RULES)[number] => rule !== undefined)
    .map((rule) => ({
      id: rule.id,
      labels: rule.axes.map((axis) => AXIS_LABEL.get(axis) ?? axis).join(' · '),
      observation: rule.observation,
    }));
}

/** 그때 쓸 수 있던 정보 종류의 표시 이름 (§11 '당시 source') */
export const SOLO_SOURCE_LABEL: Record<
  NonNullable<RelationshipHistoryEntry['soloSnapshot']>['sources'][number],
  string
> = {
  declared: '내가 답한 기준',
  mbti: '성향 렌즈',
  observed: '사진 관찰',
  experience: '관계 경험',
};
