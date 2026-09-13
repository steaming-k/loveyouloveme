import { sanitizeRelationshipEvents } from '@/lib/logic/relationshipEvents';
import { sanitizeStatus } from '@/lib/sessionSanitize';
import { createEmptyTargetProfile } from '@/state/defaultAnswers';
import type { RelationshipEvent, RelationshipStatus, SessionAnswers } from '@/types';

import { isUuid, newUuid } from './ids';
import { sanitizeLabel, sanitizeTargetContext, targetContextFromSession } from './mappers';
import type { SavedRelationshipSummary, TargetContextData } from './types';

/**
 * v1.47 — **로컬 관계 목록** (`lym.targets.v1`) · stable activeTargetId
 *
 * ══ 왜 SessionAnswers에 id를 넣지 않았나 ═══════════════════════════════════
 *
 * 세션 모양은 AI fingerprint와 여러 fixture에 묶여 있다. 필드 하나를 더하면 캐시 키와 기준선이
 * 흔들린다. 그래서 **상대의 정체성(id)과 보관된 맥락은 별도 저장소**에 두고, 세션은 지금처럼
 * '지금 보고 있는 상대의 입력'만 갖는다.
 *
 * ══ 무엇이 바뀌나 ════════════════════════════════════════════════════════
 *
 * ```
 * 전   새로운 사람과 궁합 보기 → 이전 상대 입력 · 사건이 사라짐
 * 후   같은 버튼 → 이전 상대 맥락을 이 목록에 보관 → 새 activeTargetId로 빈 상대 시작
 * ```
 *
 * 세션을 비우는 동작은 **그대로**다. 점수 · Mirror · 화면은 바뀌지 않는다.
 *
 * ⚠️ 이 목록도 이 기기에만 있다. 계정 저장은 사용자가 승인한 migration에서만 일어난다.
 */

export const TARGET_REGISTRY_KEY = 'lym.targets.v1';

export interface TargetContextSnapshot {
  id: string;
  label: string | null;
  status: RelationshipStatus | null;
  context: TargetContextData;
  events: RelationshipEvent[];
  /** Premium preview unlock은 이 키에 묶인다 — 돌아왔을 때 이어지게 함께 보관한다 */
  funnelAnalysisId: string | null;
  savedAt: string;
}

export interface TargetRegistryState {
  version: 1;
  activeTargetId: string;
  activeLabel: string | null;
  /** 지금 보고 있지 않은 상대들. **active는 여기 없다** */
  saved: TargetContextSnapshot[];
}

export function createTargetRegistry(activeTargetId: string = newUuid()): TargetRegistryState {
  return { version: 1, activeTargetId, activeLabel: null, saved: [] };
}

/** 보관할 가치가 있는 상대 입력이 있는가 — 빈 상대를 목록에 쌓지 않는다 */
export function hasTargetContext(answers: SessionAnswers): boolean {
  const { target } = answers;
  return (
    target.relation !== null ||
    target.contact !== 'x' ||
    target.conflict !== 'x' ||
    target.alone !== 'x' ||
    target.affection !== 'x' ||
    target.mbti !== null ||
    target.events.length > 0 ||
    target.preferences.interests.length > 0 ||
    Boolean(target.birthProfile.date) ||
    Object.keys(answers.currentRelationship.signals).length > 0 ||
    answers.savedQuestions.length > 0
  );
}

export function captureActiveTarget(state: TargetRegistryState, answers: SessionAnswers, now: string): TargetContextSnapshot {
  return {
    id: state.activeTargetId,
    label: state.activeLabel,
    status: answers.status,
    context: targetContextFromSession(answers),
    events: sanitizeRelationshipEvents(answers.target.events).events,
    funnelAnalysisId: answers.currentAnalysisMeta?.funnelAnalysisId ?? null,
    savedAt: now,
  };
}

function upsertSnapshot(saved: readonly TargetContextSnapshot[], snapshot: TargetContextSnapshot): TargetContextSnapshot[] {
  return [...saved.filter((item) => item.id !== snapshot.id), snapshot];
}

/** '새로운 사람' 직전 — 지금 상대를 보관하고 새 id로 시작한다 */
export function preserveActiveTarget(
  state: TargetRegistryState,
  answers: SessionAnswers,
  nextActiveId: string,
  now: string,
): TargetRegistryState {
  const saved = hasTargetContext(answers) ? upsertSnapshot(state.saved, captureActiveTarget(state, answers, now)) : state.saved;
  return { version: 1, activeTargetId: nextActiveId, activeLabel: null, saved };
}

/** 보관된 맥락을 세션에 올린다. **사건은 그 스냅샷의 것만** 쓴다 */
export function applyTargetContext(answers: SessionAnswers, snapshot: TargetContextSnapshot, now: string): SessionAnswers {
  return {
    ...answers,
    status: snapshot.status ?? answers.status,
    target: { ...createEmptyTargetProfile(), ...snapshot.context.profile, events: snapshot.events },
    currentRelationship: snapshot.context.currentRelationship,
    savedQuestions: snapshot.context.savedQuestions,
    completed: { ...answers.completed, compatibility: false },
    currentAnalysisMeta: {
      mirrorViewedAt: answers.currentAnalysisMeta?.mirrorViewedAt,
      updatedAt: now,
      funnelAnalysisId: snapshot.funnelAnalysisId ?? newUuid(),
    },
  };
}

/** A → B → A. 지금 상대는 보관되고, 고른 상대가 active가 된다 */
export function switchToSavedTarget(
  state: TargetRegistryState,
  answers: SessionAnswers,
  targetId: string,
  now: string,
): { state: TargetRegistryState; answers: SessionAnswers } | null {
  if (targetId === state.activeTargetId) return { state, answers };
  const snapshot = state.saved.find((item) => item.id === targetId);
  if (!snapshot) return null;
  const withCurrent = hasTargetContext(answers)
    ? upsertSnapshot(state.saved, captureActiveTarget(state, answers, now))
    : state.saved;
  return {
    state: {
      version: 1,
      activeTargetId: snapshot.id,
      activeLabel: snapshot.label,
      saved: withCurrent.filter((item) => item.id !== snapshot.id),
    },
    answers: applyTargetContext(answers, snapshot, now),
  };
}

export function localRelationshipSummaries(
  state: TargetRegistryState,
  answers: SessionAnswers,
  lastAnalysisAtByTarget: Readonly<Record<string, string>> = {},
): SavedRelationshipSummary[] {
  const active: SavedRelationshipSummary[] = hasTargetContext(answers)
    ? [
        {
          id: state.activeTargetId,
          label: state.activeLabel,
          relationStatus: answers.status,
          lastAnalysisAt: lastAnalysisAtByTarget[state.activeTargetId] ?? null,
          archived: false,
        },
      ]
    : [];
  return [
    ...active,
    ...[...state.saved]
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
      .map((item) => ({
        id: item.id,
        label: item.label,
        relationStatus: item.status,
        lastAnalysisAt: lastAnalysisAtByTarget[item.id] ?? null,
        archived: false,
      })),
  ];
}

export function sanitizeTargetRegistry(raw: unknown): TargetRegistryState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const value = raw as Record<string, unknown>;
  if (value.version !== 1 || !isUuid(value.activeTargetId)) return null;
  const saved: TargetContextSnapshot[] = [];
  const seen = new Set<string>([value.activeTargetId]);
  for (const item of Array.isArray(value.saved) ? value.saved : []) {
    if (typeof item !== 'object' || item === null) continue;
    const snapshot = item as Record<string, unknown>;
    if (!isUuid(snapshot.id) || seen.has(snapshot.id)) continue;
    seen.add(snapshot.id);
    saved.push({
      id: snapshot.id,
      label: sanitizeLabel(snapshot.label),
      status: sanitizeStatus(snapshot.status),
      context: sanitizeTargetContext(snapshot.context),
      events: sanitizeRelationshipEvents(snapshot.events).events,
      funnelAnalysisId: typeof snapshot.funnelAnalysisId === 'string' ? snapshot.funnelAnalysisId : null,
      savedAt: typeof snapshot.savedAt === 'string' ? snapshot.savedAt : new Date(0).toISOString(),
    });
  }
  return { version: 1, activeTargetId: value.activeTargetId, activeLabel: sanitizeLabel(value.activeLabel), saved };
}

/* ───────────────────────────────────────────────────── 브라우저 저장 */

export function readTargetRegistry(): TargetRegistryState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(TARGET_REGISTRY_KEY);
    return raw ? sanitizeTargetRegistry(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** 저장 실패는 흐름을 막지 않는다(세션 저장과 같은 정책). 성공 여부만 돌려준다 */
export function writeTargetRegistry(state: TargetRegistryState): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(TARGET_REGISTRY_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function ensureTargetRegistry(): TargetRegistryState {
  const existing = readTargetRegistry();
  if (existing) return existing;
  const created = createTargetRegistry();
  writeTargetRegistry(created);
  return created;
}

export function clearTargetRegistry(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(TARGET_REGISTRY_KEY);
  } catch {
    // 무시
  }
}
