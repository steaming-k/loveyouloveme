import { MIRROR_AXES } from '@/data/axes';
import { withTopicParticle } from '@/lib/korean';
import type {
  Confidence,
  DeclaredPreference,
  HistoryAxisChange,
  HistoryChangeState,
  HistoryMirrorInsightSnapshot,
  HistoryReport,
  MirrorAxisKey,
  MirrorReport,
  MirrorState,
  RelationshipExperience,
  RelationshipHistoryEntry,
  RelationshipStatus,
  RepeatedRelationshipSignal,
  SessionAnswers,
} from '@/types';

/**
 * Relationship History — 축적과 비교 (Pure Logic)
 *
 * 목적은 '나는 관계를 거치면서 어떻게 달라지고 있지?'에 답하는 것이다.
 * 그래서 이 파일은 **변화의 유무와 방향만** 말하고, 아래를 절대 만들지 않는다:
 *   ❌ 성장 점수 / 건강한 연애 점수
 *   ❌ '과거보다 좋아졌다'는 자동 판정
 *   ❌ 관계 횟수 카운트 · '몇 번째 연애'
 *   ❌ MBTI 변화 = 성격 변화 해석
 *
 * ⚠️ Mirror State와 History Change State는 완전히 다른 축이다.
 *   Mirror  (MATCH/GAP/CHANGE) : 하나의 Snapshot 안에서 Declared vs Relationship Evidence
 *   History (STABLE/SHIFT/NEW/INSUFFICIENT) : 과거 Snapshot vs 현재 Snapshot
 *
 * UI에서 비교를 계산하지 않는다 — 전부 이 파일을 거친다.
 */

type SavedState = Exclude<MirrorState, 'UNKNOWN'>;

/** 직접 1~5 척도로 수집한 Declared 축만 값 비교가 가능하다 (§14, §36) */
const SCALED_DECLARED_FIELDS = ['contact', 'alone'] as const;
type ScaledField = (typeof SCALED_DECLARED_FIELDS)[number];

const AXIS_TO_SCALED_FIELD: Partial<Record<MirrorAxisKey, ScaledField>> = {
  contact: 'contact',
  alone: 'alone',
};

/* ------------------------------------------------------------------ 저장 */

/**
 * 분석 입력에서 파생한 지문. 같은 분석은 History에 한 번만 저장된다(§7).
 * 저장 버튼을 두 번 눌렀다고 '관계가 2개'가 되면 안 되기 때문이다.
 */
export function analysisFingerprint(
  status: RelationshipStatus | null,
  declared: DeclaredPreference,
  experience: RelationshipExperience,
): string {
  return [
    status ?? '-',
    declared.contact ?? '-',
    declared.conflict ?? '-',
    declared.alone ?? '-',
    declared.affection ?? '-',
    declared.hobby ?? '-',
    [...experience.important].sort().join('+') || '-',
    experience.hardest ?? '-',
    experience.selfGap ?? '-',
    experience.adaptive ? `${experience.adaptive.axis}:${experience.adaptive.optionId}` : '-',
  ].join('|');
}

/**
 * 현재 세션 + Mirror 결과 → 저장할 History 항목.
 *
 * ⚠️ 저장하지 않는 것(§3): 사진 원본·상대 이름·상대 사진·상대 자유서술 원문·민감정보.
 * History의 주체는 '상대'가 아니라 '나'다. 그래서 target에서는 relation(관계 맥락)만 가져온다.
 *
 * @returns Mirror를 만들 수 없으면 null — 가짜 History를 쌓지 않는다 (Edge A/B)
 */
export function buildHistoryEntry(input: {
  answers: SessionAnswers;
  mirror: MirrorReport;
  coverage: Confidence;
  /** 호출 지점에서 주입한다 — 로직 자체는 시간·난수를 알지 않는다 */
  id: string;
  createdAt: string;
}): RelationshipHistoryEntry | null {
  const { answers, mirror, coverage, id, createdAt } = input;

  if (!mirror.available || mirror.insights.length === 0) return null;

  const insights: HistoryMirrorInsightSnapshot[] = mirror.insights.map((insight) => ({
    axis: insight.key,
    state: insight.state as SavedState,
    declaredText: insight.declaredPhrase,
    relationshipSignal: insight.relationshipSignal,
  }));

  return {
    id,
    analysisId: analysisFingerprint(answers.status, answers.declared, answers.experience),
    createdAt,
    context: {
      relationshipStatus: answers.status,
      targetRelation: answers.target.relation,
    },
    // MBTI는 Snapshot metadata로만 저장한다 — 변화 판정에 쓰지 않는다 (§4, §25)
    profileSnapshot: { mbti: answers.mbti },
    declaredSnapshot: { ...answers.declared },
    relationshipEvidence: {
      important: [...answers.experience.important],
      hardest: answers.experience.hardest,
      selfGap: answers.experience.selfGap,
      adaptive: answers.experience.adaptive,
    },
    mirrorSnapshot: { insights, focusAxis: mirror.teaser?.axisKey ?? null },
    coreInsight: {
      original: mirror.core?.headline ?? '',
      userCorrection: answers.coreCorrection.trim() || null,
      verdict: answers.coreVerdict,
    },
    evidenceCoverage: coverage,
  };
}

/* -------------------------------------------------------------- Snapshot 비교 */

/** 직접 수집한 척도 축만 비교한다. 나머지는 '달라졌다/같다'조차 말하지 않는다. */
export function compareDeclaredSnapshots(
  past: DeclaredPreference,
  now: DeclaredPreference,
): Partial<Record<ScaledField, { past: number; now: number; changed: boolean }>> {
  const result: Partial<Record<ScaledField, { past: number; now: number; changed: boolean }>> = {};

  for (const field of SCALED_DECLARED_FIELDS) {
    const pastValue = past[field];
    const nowValue = now[field];
    if (pastValue === null || nowValue === null) continue;
    result[field] = { past: pastValue, now: nowValue, changed: pastValue !== nowValue };
  }

  return result;
}

export function compareMirrorSnapshots(
  past: readonly HistoryMirrorInsightSnapshot[],
  now: readonly HistoryMirrorInsightSnapshot[],
): Map<MirrorAxisKey, { past: SavedState | null; now: SavedState | null }> {
  const map = new Map<MirrorAxisKey, { past: SavedState | null; now: SavedState | null }>();

  for (const { key } of MIRROR_AXES) {
    map.set(key, {
      past: past.find((insight) => insight.axis === key)?.state ?? null,
      now: now.find((insight) => insight.axis === key)?.state ?? null,
    });
  }

  return map;
}

/* -------------------------------------------------------------- Change 판정 */

const STATE_PHRASE: Record<SavedState, string> = {
  MATCH: '말한 기준과 비슷하게 나타남',
  GAP: '말한 기준보다 크게 반응함',
  CHANGE: '경험 후 우선순위가 옮겨짐',
};

function changeStateOf(
  pastState: SavedState | null,
  nowState: SavedState | null,
  declaredChanged: boolean,
): HistoryChangeState {
  // 과거 근거가 아예 없고 이번에 처음 신호가 보였다 (§19)
  if (pastState === null) return nowState ? 'NEW' : 'INSUFFICIENT';
  // 과거엔 있었지만 이번엔 판정되지 않았다 — 사라졌다고 단정하지 않는다 (§20, Edge I)
  if (nowState === null) return 'INSUFFICIENT';
  // Mirror 상태가 옮겨졌거나, 직접 수집한 Declared 값이 실제로 달라졌으면 SHIFT (§18)
  if (pastState !== nowState || declaredChanged) return 'SHIFT';
  return 'STABLE';
}

function noteFor(change: {
  label: string;
  state: HistoryChangeState;
  previousState: SavedState | null;
  currentState: SavedState | null;
  declaredDelta: { past: number; now: number } | null;
}): string {
  const { label, state, previousState, currentState, declaredDelta } = change;

  switch (state) {
    case 'STABLE':
      // '일관된 성격' 같은 Personality 판정을 하지 않는다 (§17)
      return `${withTopicParticle(label)} 이전 관찰과 비슷하게 유지되고 있어.`;

    case 'SHIFT': {
      if (declaredDelta && declaredDelta.past !== declaredDelta.now) {
        const direction = declaredDelta.now > declaredDelta.past ? '더' : '덜';
        // '성장했다'로 표현하지 않는다 (§18)
        return `지난번보다 ${label}에 대한 기준을 ${direction} 중요하게 보고 있어. (${declaredDelta.past}/5 → ${declaredDelta.now}/5)`;
      }
      if (previousState && currentState) {
        return `이전에는 "${STATE_PHRASE[previousState]}"였고, 이번에는 "${STATE_PHRASE[currentState]}"로 기록됐어. 어느 쪽이 맞다고 판단하진 않을게.`;
      }
      return `${label}에 대한 신호가 지난 관찰과 다르게 나타났어.`;
    }

    case 'NEW':
      return `${withTopicParticle(label)} 이번 관찰에서 처음 보였어.`;

    case 'INSUFFICIENT':
      return `아직 ${withTopicParticle(label)} 비교할 정보가 부족해.`;
  }
}

export function buildHistoryChanges(
  previous: RelationshipHistoryEntry,
  current: RelationshipHistoryEntry,
): HistoryAxisChange[] {
  const mirrorDiff = compareMirrorSnapshots(
    previous.mirrorSnapshot.insights,
    current.mirrorSnapshot.insights,
  );
  const declaredDiff = compareDeclaredSnapshots(
    previous.declaredSnapshot,
    current.declaredSnapshot,
  );

  return MIRROR_AXES.map(({ key, label }) => {
    const states = mirrorDiff.get(key) ?? { past: null, now: null };
    const scaledField = AXIS_TO_SCALED_FIELD[key];
    const scaled = scaledField ? declaredDiff[scaledField] : undefined;

    const declaredDelta = scaled ? { past: scaled.past, now: scaled.now } : null;
    const state = changeStateOf(states.past, states.now, scaled?.changed ?? false);

    return {
      axis: key,
      label,
      state,
      previousState: states.past,
      currentState: states.now,
      previousText:
        previous.mirrorSnapshot.insights.find((i) => i.axis === key)?.relationshipSignal ?? null,
      currentText:
        current.mirrorSnapshot.insights.find((i) => i.axis === key)?.relationshipSignal ?? null,
      declaredDelta,
      note: noteFor({ label, state, previousState: states.past, currentState: states.now, declaredDelta }),
    };
  });
}

/** SHIFT 우선, 없으면 NEW. 하나도 없으면 null — 억지로 변화를 만들지 않는다. */
export function getMostMeaningfulChange(changes: HistoryAxisChange[]): HistoryAxisChange | null {
  return (
    changes.find((change) => change.state === 'SHIFT') ??
    changes.find((change) => change.state === 'NEW') ??
    null
  );
}

export function buildHistorySummary(changes: HistoryAxisChange[]): string {
  const shift = changes.filter((c) => c.state === 'SHIFT').length;
  const stable = changes.filter((c) => c.state === 'STABLE').length;
  const fresh = changes.filter((c) => c.state === 'NEW').length;

  if (shift === 0 && fresh === 0) {
    return stable > 0
      ? '지난 관찰과 비교해 크게 달라진 기준은 없었어.'
      : '아직 비교할 정보가 부족해.';
  }

  const parts: string[] = [];
  if (shift > 0) parts.push(`${shift}개의 기준에서 변화가`);
  if (fresh > 0) parts.push(`${fresh}개의 새로운 신호가`);
  return `지난 관찰과 비교해 ${parts.join(', ')} 있었어.`;
}

/**
 * 이전 기록 vs 최신 기록 리포트 (F2).
 * @param entries 오래된 것부터 정렬된 전체 History
 */
export function buildHistoryReport(
  entries: readonly RelationshipHistoryEntry[],
): HistoryReport {
  // 기록 1개로 가짜 변화를 만들지 않는다 (§8, Edge C)
  if (entries.length < 2) {
    return {
      entryCount: entries.length,
      comparable: false,
      changes: [],
      headline: null,
      shiftCount: 0,
      stableCount: 0,
      newCount: 0,
      summary:
        entries.length === 1
          ? '아직 비교할 과거 기록이 하나뿐이야. 다음 관찰이 쌓이면 변화를 알려줄게.'
          : '아직 저장된 관찰이 없어.',
    };
  }

  const previous = entries[entries.length - 2]!;
  const current = entries[entries.length - 1]!;
  const changes = buildHistoryChanges(previous, current);

  return {
    entryCount: entries.length,
    comparable: true,
    changes,
    headline: getMostMeaningfulChange(changes),
    shiftCount: changes.filter((c) => c.state === 'SHIFT').length,
    stableCount: changes.filter((c) => c.state === 'STABLE').length,
    newCount: changes.filter((c) => c.state === 'NEW').length,
    summary: buildHistorySummary(changes),
  };
}

/* ------------------------------------------------------- 반복 신호 (§21) */

/**
 * 같은 축에서 GAP/CHANGE 신호가 되풀이된 기록.
 * MATCH는 반복 신호로 보지 않는다 — '말한 대로 나타났다'가 반복되는 건 발견이 아니다.
 *
 * ⚠️ Mirror Evidence만 기준으로 삼는다. MBTI 변화는 절대 반영하지 않는다 (§25, QA CASE J).
 * 금지 표현: '너는 항상 이래' / '반복되는 문제야' / '너의 연애 패턴은 이거야'
 */
export function findRepeatedRelationshipSignals(
  entries: readonly RelationshipHistoryEntry[],
): RepeatedRelationshipSignal[] {
  if (entries.length < 2) return [];

  const signals: RepeatedRelationshipSignal[] = [];

  for (const { key, label } of MIRROR_AXES) {
    const hits = entries
      .map((entry) => ({
        entryId: entry.id,
        state: entry.mirrorSnapshot.insights.find((i) => i.axis === key)?.state,
      }))
      .filter(
        (hit): hit is { entryId: string; state: 'GAP' | 'CHANGE' } =>
          hit.state === 'GAP' || hit.state === 'CHANGE',
      );

    if (hits.length < 2) continue;

    signals.push({
      axis: key,
      label,
      occurrences: hits.length,
      entryIds: hits.map((hit) => hit.entryId),
      states: hits.map((hit) => hit.state),
    });
  }

  return signals.sort((a, b) => b.occurrences - a.occurrences);
}

/**
 * 현재 Mirror 축에 대한 Past Observation 한 줄 (§22/§23).
 *
 * ⚠️ 이 값은 **현재 Mirror 판정을 바꾸지 않는다.** 현재 판정은 현재 데이터만으로 하고,
 * 이건 Supporting Evidence로만 덧붙는다. 현재 Evidence가 없으면 과거만으로 Gap을 만들지 않는다.
 *
 * @param excludeEntryId 현재 분석이 이미 저장돼 있으면 그 항목은 과거에서 제외한다
 */
export function pastObservationFor(
  entries: readonly RelationshipHistoryEntry[],
  axis: MirrorAxisKey,
  excludeEntryId?: string,
): { occurrences: number; text: string } | null {
  const pool = excludeEntryId ? entries.filter((entry) => entry.id !== excludeEntryId) : entries;

  const hits = pool.filter((entry) => {
    const state = entry.mirrorSnapshot.insights.find((i) => i.axis === axis)?.state;
    return state === 'GAP' || state === 'CHANGE';
  });

  if (hits.length === 0) return null;

  const label = MIRROR_AXES.find((a) => a.key === axis)?.label ?? axis;
  return {
    occurrences: hits.length,
    text:
      hits.length === 1
        ? `이전 관찰에서도 ${label} 관련 신호가 한 번 있었어.`
        : `이전 관찰 ${hits.length}번에서도 ${label} 관련 신호가 있었어.`,
  };
}
