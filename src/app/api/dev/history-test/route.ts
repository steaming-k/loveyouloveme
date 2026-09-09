import { MIRROR_AXES } from '@/data/axes';
import { resolveEvidenceRefs } from '@/lib/aiEvidenceResolver';
import { buildHistoryReport, findRepeatedRelationshipSignals } from '@/lib/logic/history';
import { buildCrossSourceInsights } from '@/lib/logic/crossSourceInsights';
import { buildFirstContactReport } from '@/lib/logic/firstContact';
import { buildMirrorReport, declaredPhraseOf } from '@/lib/logic/mirror';
import { NO_CURRENT_RELATIONSHIP } from '@/lib/logic/relationshipEvidence';
import { selfLevelOf } from '@/lib/logic/firstContact';
import { buildProfileSummary } from '@/lib/logic/profile';
import { hasDeepConnection, limitationFor } from '@/services/premiumConnections';
import { soloModeOfTarget } from '@/lib/logic/soloMode';
import {
  buildObservedHistoryReport,
  buildSoloHistoryReport,
  filterHistoryByAudience,
  historyAudienceOf,
} from '@/lib/logic/soloHistory';
import { OBSERVED_TRAITS } from '@/data/observations';
import { DEMO_PHOTO_IDS, SAMPLE_PHOTOS } from '@/data/samplePhotos';
import { OBSERVATION, observationTotalMs } from '@/lib/motion';
import { isPhotoSelectionValid, usablePhotoCount } from '@/lib/validation';
import { createEmptyAnswers, createEmptyTargetProfile } from '@/state/defaultAnswers';
import type {
  DeclaredPreference,
  EvidenceRef,
  ObservedSignalCategory,
  RelationshipExperience,
  RelationshipHistoryEntry,
} from '@/types';

/**
 * POST /api/dev/history-test — **개발 전용** History Fixture 실행기 (v1.35 · §39)
 *
 * `tests/run-history-fixtures.mjs`가 부른다. 목적은 하나다: **History 판정 로직을
 * 테스트용으로 복제하지 않는 것.** 화면이 쓰는 것과 완전히 같은 함수
 * (`buildHistoryReport` · `buildSoloHistoryReport` · `buildObservedHistoryReport` ·
 * `findRepeatedRelationshipSignals` · `resolveEvidenceRefs`)를 그대로 호출하고 결과만
 * 돌려준다 — 로직을 두 벌 만들면 테스트가 실제 동작을 보증하지 못한다.
 *
 * ⚠️ 새 테스트 프레임워크를 도입하지 않는다(§39). 기존 `api/ai/contract-test` +
 * `tests/*.mjs` 방식을 그대로 따른다.
 *
 * ⚠️ Production에서는 404다. Provider를 호출하지 않고 Key도 읽지 않는다.
 */
export const runtime = 'nodejs';

interface HistoryTestRequest {
  /** 저장돼 있다고 가정할 기록 목록 (오래된 것 → 최신) */
  entries?: RelationshipHistoryEntry[];
  /** 지금 세션의 답 — Solo 비교의 NOW 쪽 */
  declared?: Partial<DeclaredPreference>;
  experience?: Partial<RelationshipExperience>;
  /** 지금 사진에서 보이는 활동 범주. 생략하면 '사진 근거 없음'(null)이다 */
  observedCategories?: ObservedSignalCategory[] | null;
  /** 근거 묶음 검증용 (§13) */
  evidenceRefs?: EvidenceRef[];
}

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ ok: false, reason: 'NOT_FOUND' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as HistoryTestRequest | null;
  if (!body) return Response.json({ ok: false, reason: 'INVALID_INPUT' }, { status: 400 });

  const base = createEmptyAnswers();
  const entries = Array.isArray(body.entries) ? body.entries : [];
  const declared: DeclaredPreference = { ...base.declared, ...body.declared };
  const experience: RelationshipExperience = { ...base.experience, ...body.experience };
  const target = createEmptyTargetProfile();

  const current = buildFirstContactReport({
    declared,
    experience,
    target,
    mode: soloModeOfTarget(target),
  });

  const coupleReport = buildHistoryReport(entries);
  const soloReport = buildSoloHistoryReport({ entries, current });
  const observedReport = buildObservedHistoryReport({
    entries,
    current:
      body.observedCategories === undefined || body.observedCategories === null
        ? null
        : body.observedCategories.map((category) => ({ category })),
  });

  /**
   * 근거 목록은 화면과 **같은 resolver**를 통과시킨다. 여기서 확인하는 것은
   * "같은 문장이 여러 줄 나오지 않는가"와 "개수 정보가 남는가"다(§13).
   */
  const answers = { ...base, declared, experience, target };
  const evidence = resolveEvidenceRefs(body.evidenceRefs ?? [], {
    answers,
    validated: [],
    historyEntries: entries,
    // v1.42 — 이 fixture는 현재 근거를 다루지 않으므로 진행 중 시제를 명시한다.
    tense: 'current',
  }).map((item) => ({ key: item.key, sourceLabel: item.sourceLabel, text: item.text }));

  /**
   * ⑧ Solo History 연결과 Premium 게이트 (§19 · §22).
   *
   * ⚠️ 화면과 **같은 함수**를 통과시킨다 — `buildCrossSourceInsights`가 만들고
   * `hasDeepConnection`이 판정한다. 게이트 기준을 테스트용으로 복제하지 않는다.
   */
  const insights = buildCrossSourceInsights({
    declared,
    experience,
    /**
     * v1.41 — 이 fixture는 History/Solo 비교를 검사하는 것이고 **현재 관계 근거를
     * 다루지 않는다.** `NO_CURRENT_RELATIONSHIP`을 명시적으로 넘겨서, 이 Route의
     * 모든 판정이 v1.40.1과 동일함을 코드에서 읽을 수 있게 한다(`test:history` 100건
     * 전부가 회귀 기준이 된다). 현재 근거는 `test:relationship-evidence`가 다룬다.
     */
    current: NO_CURRENT_RELATIONSHIP,
    tense: 'current',
    target,
    mirror: buildMirrorReport(declared, experience, NO_CURRENT_RELATIONSHIP, 'current'),
    validated: [],
    historyChanges: coupleReport.changes,
    repeatedSignals: findRepeatedRelationshipSignals(entries),
    latestHistoryEntry: entries.length > 0 ? entries[entries.length - 1]! : null,
    previousHistoryEntry: entries.length >= 2 ? entries[entries.length - 2]! : null,
    soloHistory: soloReport,
  });

  /**
   * v1.36 — **'네가 말한 너' 문구가 실제 답을 따라가는가** (Release Gate).
   *
   * v1.35까지 이 문구는 축마다 고정값이라 사용자가 하지 않은 답을 사용자의 답이라고
   * 표시했다. 회귀를 코드로 막는다 — 같은 축의 문구는 답이 달라지면 반드시 달라져야 한다.
   */
  const mirrorForPhrase = buildMirrorReport(
    declared,
    experience,
    NO_CURRENT_RELATIONSHIP,
    'current',
  );

  return Response.json({
    ok: true,
    declaredPhrases: MIRROR_AXES.map((axis) => ({
      axis: axis.key,
      level: selfLevelOf(axis.key, declared),
      phrase: declaredPhraseOf(axis.key, declared),
    })),
    mirrorInsights: mirrorForPhrase.insights.map((insight) => ({
      axis: insight.key,
      state: insight.state,
      declared: insight.declared,
      declaredPhrase: insight.declaredPhrase,
      relationshipSignal: insight.relationshipSignal,
    })),
    mirrorTeaser: mirrorForPhrase.teaser
      ? {
          axis: mirrorForPhrase.teaser.axisKey,
          declaredPhrase: mirrorForPhrase.teaser.declaredPhrase,
          relationshipPhrase: mirrorForPhrase.teaser.relationshipPhrase,
        }
      : null,
    profileSummary: buildProfileSummary(declared, experience),
    insights: insights.map((insight) => ({
      id: insight.id,
      type: insight.type,
      sources: [...new Set(insight.sources)],
      evidenceCount: insight.evidenceRefs.length,
      /** 화면에 도달하는 근거만 센다 — 풀리지 않는 ref는 표시되지 않는다 */
      resolvedEvidenceCount: resolveEvidenceRefs(insight.evidenceRefs, {
        answers,
        validated: [],
        historyEntries: entries,
        tense: 'current',
      }).length,
      ruleSummary: insight.ruleSummary,
      // v1.41 — 이 fixture는 현재 근거를 다루지 않으므로 진행 중 시제를 명시한다.
      limitation: limitationFor([...new Set(insight.sources)], 'current'),
    })),
    deepReportAvailable: hasDeepConnection(insights),
    audiences: entries.map((entry) => historyAudienceOf(entry)),
    soloEntryCount: filterHistoryByAudience(entries, 'solo').length,
    coupleEntryCount: filterHistoryByAudience(entries, 'couple').length,
    couple: {
      entryCount: coupleReport.entryCount,
      comparable: coupleReport.comparable,
      summary: coupleReport.summary,
      shiftCount: coupleReport.shiftCount,
      stableCount: coupleReport.stableCount,
      newCount: coupleReport.newCount,
      compared: coupleReport.compared,
      states: coupleReport.changes.map((change) => `${change.axis}:${change.state}`),
    },
    repeated: findRepeatedRelationshipSignals(entries).map((signal) => ({
      axis: signal.axis,
      occurrences: signal.occurrences,
    })),
    solo: {
      entryCount: soloReport.entryCount,
      comparable: soloReport.comparable,
      headline: soloReport.headline,
      baselineEntryId: soloReport.baselineEntryId,
      changes: soloReport.changes.map((change) => ({
        axis: change.axis,
        state: change.state,
        observationCount: change.observationCount,
        repeatable: change.repeatable,
        previousText: change.previousText,
        currentText: change.currentText,
      })),
    },
    observed: {
      snapshotCount: observedReport.snapshotCount,
      comparable: observedReport.comparable,
      changes: observedReport.changes.map((change) => ({
        category: change.category,
        state: change.state,
        observationCount: change.observationCount,
        repeatable: change.repeatable,
        note: change.note,
      })),
    },
    evidence,
    axisOrder: MIRROR_AXES.map((axis) => axis.key),
    currentAvailable: current.available,

    /**
     * v1.37 — 퍼널 입구(S07)와 샘플 세션 근거를 화면과 **같은 함수·같은 데이터**로 노출한다.
     * `tests/run-history-fixtures.mjs`의 SO 절이 이걸 읽는다. 테스트가 상수를 베껴 쓰면
     * 데이터가 바뀔 때 조용히 무의미해지므로 여기서 원본을 그대로 돌려준다.
     */
    samplePhotos: {
      /** 샘플 세션이 실제로 들고 있는 타일 — 근거 문장이 주장할 수 있는 상한이다 */
      demoTileCount: DEMO_PHOTO_IDS.length,
      demoTileLabels: SAMPLE_PHOTOS.filter((photo) =>
        (DEMO_PHOTO_IDS as readonly string[]).includes(photo.id),
      ).map((photo) => photo.label),
      traits: OBSERVED_TRAITS.map((trait) => ({
        id: trait.id,
        text: trait.text,
        confidence: trait.confidence,
        evidence: trait.evidence,
      })),
    },
    /**
     * 분석 게이트 — 비-upload 사진이 분석 조건을 대신 채우지 못한다.
     *
     * v1.44에서 S07의 샘플 타일 선택 UI는 사라졌지만, 이 조합은 여전히 만들어진다
     * (데모 세션 · 이 변경 이전에 저장된 세션). 화면에서 고를 수 없게 된 뒤로는
     * 조용히만 들어오므로 fixture로 고정해 둔다.
     */
    photoGate: photoGateCases(),

    /**
     * v1.38 — 관찰 시퀀스 타이밍. 궁합은 Provider를 기다리는 화면이 아니라
     * deterministic 계산이므로, 이 값이 그대로 사용자 대기가 된다(§S20).
     * 값이 조용히 되돌아가는 것을 `tests/run-history-fixtures.mjs`의 OB 절이 막는다.
     */
    observation: {
      stageMs: OBSERVATION.stageMs,
      tailMs: OBSERVATION.tailMs,
      revisitScale: OBSERVATION.revisitScale,
      reducedMs: OBSERVATION.reducedMs,
      firstMs: observationTotalMs(4),
      revisitMs: observationTotalMs(4, true),
    },
  });
}

/**
 * `isPhotoSelectionValid()`를 화면과 같은 함수로 통과시킨다.
 * upload N장 + sample M장 조합이 분석을 열 수 있는지만 본다.
 */
function photoGateCases() {
  const base = createEmptyAnswers();
  const make = (uploads: number, samples: number) => ({
    ...base,
    photos: [
      ...Array.from({ length: uploads }, (_, index) => ({
        id: `up-${index}`,
        label: `upload-${index}`,
        source: 'upload' as const,
        objectUrl: `blob:test-${index}`,
      })),
      ...SAMPLE_PHOTOS.slice(0, samples).map((photo) => ({ ...photo })),
    ],
  });

  return [
    { uploads: 0, samples: 0 },
    { uploads: 0, samples: 6 },
    { uploads: 2, samples: 4 },
    { uploads: 3, samples: 0 },
    { uploads: 3, samples: 3 },
  ].map((testCase) => {
    const answers = make(testCase.uploads, testCase.samples);
    return {
      ...testCase,
      selected: answers.photos.length,
      usable: usablePhotoCount(answers),
      canAnalyze: isPhotoSelectionValid(answers),
    };
  });
}
