import { aiModeOf, sameAnalysisFingerprint } from '@/lib/aiMeta';
import {
  buildHomeHighlights,
  buildProfileSummary,
  declaredItems,
  homeHeroSummary,
  relationshipItems,
} from '@/lib/logic/profile';
import {
  buildMirrorReport,
  canUseAiAxisNarrative,
  canUseAiHeadline,
  displayStateOf,
} from '@/lib/logic/mirror';
import { relationshipTenseOf, resolveRelationshipContext } from '@/lib/logic/relationshipStage';
import {
  sanitizeAffection,
  sanitizeConflict,
  sanitizeCurrentSignals,
  sanitizeHardest,
  sanitizeHobby,
  sanitizePastFactors,
  sanitizeScale,
  sanitizeSelfGap,
  sanitizeStatus,
  sanitizeTargetLevels,
  sanitizeTargetRelation,
} from '@/lib/sessionSanitize';
import { createEmptyAnswers } from '@/state/defaultAnswers';
import type {
  CurrentRelationshipEvidence,
  DeclaredPreference,
  MirrorState,
  RelationshipEvidenceScope,
  RelationshipExperience,
  SessionAnswers,
} from '@/types';

/**
 * POST /api/dev/trust-test — **개발 전용** Trust Boundary Fixture 실행기
 * (v1.44 · Final Closure)
 *
 * `tests/run-trust-fixtures.mjs`가 부른다. v1.44에서 닫은 세 결함이 **다시 열리지 않는지**
 * 고정한다.
 *
 * ```
 * BUG-002  손상 세션의 값이 판정 경로로 흘러 확정형 관찰을 만들던 것
 * BUG-003  AI 결과의 meta가 없을 때 화면이 터지던 것
 * NEW-002  입력이 없는데 Home이 성격을 단정하던 것
 * ```
 *
 * ══ 왜 새 라우트인가 ══════════════════════════════════════════════════════
 *
 * 세 결함은 모두 **입력을 신뢰할 수 없을 때 무엇을 말하는가**에 관한 것이고, 기존 두
 * 라우트(`history-test`·`lifecycle-test`)는 **정상 입력에서의 판정**을 고정한다. 그
 * fixture들에 손상 입력을 섞으면 기존 baseline의 의미가 흐려지므로 축을 분리한다.
 * 방식은 완전히 같다 — 새 테스트 프레임워크를 도입하지 않는다.
 *
 * ⚠️ **판정 로직을 여기서 복제하지 않는다.** 화면이 쓰는 것과 같은 함수
 * (`sanitize*` · `buildHomeHighlights` · `homeHeroSummary` · `buildMirrorReport` ·
 * `aiModeOf` · `sameAnalysisFingerprint`)를 그대로 호출하고 결과만 돌려준다.
 *
 * ⚠️ Production에서는 404다.
 */
export const runtime = 'nodejs';

interface TrustTestRequest {
  /** BUG-002 — `localStorage`에서 갓 파싱된 모양의 **검증 전** 객체 */
  session?: Record<string, unknown>;
  /** BUG-003 — `meta`가 있을 수도 없을 수도 있는 AI 결과 */
  ai?: { data?: unknown; prev?: unknown; next?: unknown };
  /** NEW-002 — Home Hero 한 줄의 입력 */
  hero?: { coreCorrection?: unknown; profileCompleted?: unknown; mirrorSummary?: unknown };
  /** R-9 — (state, scope) → 표시 이름. legacy 스냅샷(scope 없음)까지 직접 확인한다 */
  display?: { state?: unknown; scope?: unknown }[];
}

/**
 * `deserialize()`가 `declared`·`experience`·`currentRelationship`·`target`에 적용하는
 * 강등을 **같은 함수들로** 재현한다.
 *
 * ⚠️ `SessionProvider.deserialize()` 자체를 부르지 않는 이유: 그 함수는 `'use client'`
 * 모듈의 지역 함수이고, 테스트를 위해 export하지 않는다는 것이 v1.44의 방침이다. 대신
 * **강등 규칙 자체**(`@/lib/sessionSanitize`)를 화면과 같은 코드로 검사하고, 그 규칙이
 * `deserialize()`에 실제로 배선돼 있는지는 runner의 정적 guard가 본다.
 */
function sanitizeSession(raw: Record<string, unknown>): SessionAnswers {
  const base = createEmptyAnswers();
  const declaredRaw = (raw.declared ?? {}) as Record<string, unknown>;
  const experienceRaw = (raw.experience ?? {}) as Record<string, unknown>;
  const currentRaw = (raw.currentRelationship ?? {}) as Record<string, unknown>;
  const targetRaw = (raw.target ?? {}) as Record<string, unknown>;

  return {
    ...base,
    status: sanitizeStatus(raw.status),
    declared: {
      contact: sanitizeScale(declaredRaw.contact),
      conflict: sanitizeConflict(declaredRaw.conflict),
      alone: sanitizeScale(declaredRaw.alone),
      affection: sanitizeAffection(declaredRaw.affection),
      hobby: sanitizeHobby(declaredRaw.hobby),
    },
    experience: {
      ...base.experience,
      important: sanitizePastFactors(experienceRaw.important),
      hardest: sanitizeHardest(experienceRaw.hardest),
      selfGap: sanitizeSelfGap(experienceRaw.selfGap),
      note: typeof experienceRaw.note === 'string' ? experienceRaw.note : '',
      skipped: experienceRaw.skipped === true,
    },
    currentRelationship: {
      signals: sanitizeCurrentSignals(currentRaw.signals),
      askedAt: typeof currentRaw.askedAt === 'string' ? currentRaw.askedAt : null,
    },
    target: {
      ...base.target,
      relation: sanitizeTargetRelation(targetRaw.relation),
      ...sanitizeTargetLevels(targetRaw),
    },
  };
}

/**
 * 강등된 세션이 실제로 화면에 무엇을 말하게 되는지 — **렌더되는 문자열 전부**를 낸다.
 *
 * v1.41 §39.24의 교훈을 그대로 쓴다: 화면이 렌더하는 값 전부를 배열에 넣는다. 금지어
 * 검사는 배열에 없는 문장을 막지 못한다.
 */
function renderedStrings(answers: SessionAnswers) {
  const declared: DeclaredPreference = answers.declared;
  const experience: RelationshipExperience = answers.experience;
  const current: CurrentRelationshipEvidence = answers.currentRelationship;
  const tense = relationshipTenseOf(resolveRelationshipContext(answers).job);

  const mirror = buildMirrorReport(declared, experience, current, tense);
  const highlights = buildHomeHighlights(declared, experience, current, tense);
  const profileSummary = buildProfileSummary(declared, experience);

  return {
    highlights,
    profileSummary,
    declaredChips: declaredItems(declared),
    relationshipChips: relationshipItems(experience),
    mirror: {
      available: mirror.available,
      insightCount: mirror.insights.length,
      /** v1.44 NEW-003 — fixture가 시제 문장을 scope와 함께 봐야 한다 */
      states: mirror.insights.map((insight) => ({
        key: insight.key,
        /** 내부 판정 — R-9에서도 절대 바뀌지 않는다 */
        state: insight.state,
        /** v1.44 R-9 — 사용자에게 보여줄 이름 */
        displayState: displayStateOf(insight.state, insight.evidenceScope),
        evidenceScope: insight.evidenceScope,
        /** v1.44 R-12 — 이 축의 AI 서술을 소비해도 되는가 */
        canUseAiAxisNarrative: canUseAiAxisNarrative(insight),
        note: insight.note,
        relationshipSignal: insight.relationshipSignal,
      })),
      coreSummary: mirror.core?.summary ?? null,
      coreHeadline: mirror.core?.headline ?? null,
      /**
       * v1.44 R-11 — focus 축에서 AI headline을 소비해도 되는가.
       * `false`면 화면과 History가 위 결정론 headline으로 폴백한다.
       */
      focus: (() => {
        const focus = mirror.insights.find((i) => i.key === mirror.teaser?.axisKey);
        return focus
          ? {
              key: focus.key,
              state: focus.state,
              evidenceScope: focus.evidenceScope,
              canUseAiHeadline: canUseAiHeadline(focus),
            }
          : null;
      })(),
    },
    /** Home Hero는 프로필 완료 여부를 함께 보므로 두 상태를 다 낸다 */
    hero: {
      incomplete: homeHeroSummary({
        coreCorrection: answers.coreCorrection,
        profileCompleted: false,
        mirrorSummary: mirror.core?.summary ?? null,
      }),
      completed: homeHeroSummary({
        coreCorrection: answers.coreCorrection,
        profileCompleted: true,
        mirrorSummary: mirror.core?.summary ?? null,
      }),
    },
    strings: [
      ...highlights.map((item) => item.value),
      profileSummary,
      ...declaredItems(declared),
      ...relationshipItems(experience),
      ...mirror.insights.map((insight) => insight.note),
      ...mirror.insights.map((insight) => insight.relationshipSignal),
      ...mirror.insights.map((insight) => insight.declaredPhrase),
      ...(mirror.core ? [mirror.core.headline, mirror.core.summary] : []),
    ],
  };
}

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ ok: false, reason: 'NOT_FOUND' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as TrustTestRequest | null;
  if (!body) return Response.json({ ok: false, reason: 'INVALID_INPUT' }, { status: 400 });

  /* ── BUG-002 · 손상 세션 강등 ───────────────────────────────────────────── */
  const session = body.session
    ? (() => {
        const sanitized = sanitizeSession(body.session);
        return {
          sanitized: {
            status: sanitized.status,
            declared: sanitized.declared,
            experience: {
              important: sanitized.experience.important,
              hardest: sanitized.experience.hardest,
              selfGap: sanitized.experience.selfGap,
              note: sanitized.experience.note,
              skipped: sanitized.experience.skipped,
            },
            currentRelationship: sanitized.currentRelationship,
            target: {
              relation: sanitized.target.relation,
              contact: sanitized.target.contact,
              conflict: sanitized.target.conflict,
              alone: sanitized.target.alone,
              affection: sanitized.target.affection,
            },
          },
          rendered: renderedStrings(sanitized),
        };
      })()
    : null;

  /* ── BUG-003 · meta 부재 방어 ──────────────────────────────────────────── */
  const ai = body.ai
    ? {
        mode: aiModeOf(body.ai.data),
        sameFingerprint: sameAnalysisFingerprint(body.ai.prev ?? null, body.ai.next ?? null),
      }
    : null;

  /* ── NEW-002 · Home Hero 한 줄 ─────────────────────────────────────────── */
  const hero = body.hero
    ? {
        summary: homeHeroSummary({
          coreCorrection:
            typeof body.hero.coreCorrection === 'string' ? body.hero.coreCorrection : '',
          profileCompleted: body.hero.profileCompleted === true,
          mirrorSummary:
            typeof body.hero.mirrorSummary === 'string' ? body.hero.mirrorSummary : null,
        }),
      }
    : null;

  /* ── R-9 · 표시 정책 단독 probe ─────────────────────────────────────────── */
  const display = Array.isArray(body.display)
    ? body.display.map((item) => ({
        state: item.state,
        scope: item.scope,
        displayState: displayStateOf(
          item.state as MirrorState,
          item.scope === undefined || item.scope === null
            ? undefined
            : (item.scope as RelationshipEvidenceScope),
        ),
      }))
    : null;

  return Response.json({ ok: true, session, ai, hero, display });
}
