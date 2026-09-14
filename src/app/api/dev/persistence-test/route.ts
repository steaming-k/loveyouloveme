import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createClient } from '@supabase/supabase-js';

import { createLogicalRunRegistry } from '@/lib/logicalRun';
import { createAnalysisRunRepository } from '@/lib/persistence/analysisRunRepository';
import {
  analysisSaveDecision,
  applyMigrationLinks,
  cloudIdsForUser,
  createCloudLinks,
  forgetUser,
  grantRelationshipSave,
  linkOf,
  loadSavedRelationship,
  recordAnalysisForRelationship,
  recoverCloudLink,
  sanitizeCloudLinks,
  saveActiveRelationshipWith,
  saveRelationshipToCloud,
  type SavedRelationship,
} from '@/lib/persistence/cloudLinks';
import { CLOUD_WRITE_BUDGET, estimateUtf8Bytes, inspectCloudPayload } from '@/lib/persistence/cloudWriteBudget';
import { persistDeepReportSnapshot } from '@/lib/persistence/deepReportSnapshot';
import type { PersistenceGateway } from '@/lib/persistence/gateway';
import { analysisIdempotencyKeyOf, cloudTargetIdOf, isUuid, newUuid } from '@/lib/persistence/ids';
import {
  migrateLocalData,
  planLocalMigration,
  type LocalDataSnapshot,
  type PlannedTarget,
} from '@/lib/persistence/localMigration';
import {
  eventRowOf,
  profileRowOf,
  runRowOf,
  sameContent,
  selfProfileFromSession,
  sessionWithCloudContext,
  targetContextFromSession,
  targetRowOf,
} from '@/lib/persistence/mappers';
import { createMemoryDatabase, createMemoryGateway, type MemoryDatabase } from '@/lib/persistence/memoryGateway';
import { createProfileRepository } from '@/lib/persistence/profileRepository';
import { createRelationshipEventRepository } from '@/lib/persistence/relationshipEventRepository';
import { createRelationshipTargetRepository } from '@/lib/persistence/relationshipTargetRepository';
import { SAVE_RELATIONSHIP_COPY, saveRelationshipStage } from '@/lib/persistence/saveRelationshipFlow';
import { DEEP_REPORT_SNAPSHOT_KEYS, deepReportRunInput, validateSnapshot } from '@/lib/persistence/snapshotGuard';
import { createSupabaseGateway } from '@/lib/persistence/supabaseGateway';
import {
  createTargetRegistry,
  localRelationshipSummaries,
  preserveActiveTarget,
  switchToSavedTarget,
  type TargetRegistryState,
} from '@/lib/persistence/targetRegistry';
import { SYNC_CONFLICT_COPY, type PersistenceError, type TargetContextData } from '@/lib/persistence/types';
import { isSupabaseConfigured, supabaseConfigFrom } from '@/lib/supabase/config';
import type { Json, PersistenceTable } from '@/lib/supabase/types';
import { createEmptyAnswers, createEmptyTargetProfile } from '@/state/defaultAnswers';
import type {
  DeepNarrativeBundle,
  RelationshipDeepReport,
  RelationshipEvent,
  RelationshipHistoryEntry,
  SessionAnswers,
  TargetLevel,
} from '@/types';

/**
 * POST /api/dev/persistence-test — **개발 전용** v1.47 Persistence Fixture 실행기
 *
 * `tests/run-persistence-fixtures.mjs`가 부른다. 제품 코드(repository · migration · registry ·
 * mapper · gateway)를 **그대로** 부르고, DB는 migration SQL 규칙을 흉내 내는 메모리 gateway를 쓴다.
 *
 * ⚠️ 실제 Supabase RLS 검증이 아니다(연결 가능한 dev 프로젝트 없음 → BLOCKED). 여기서 고정하는
 *    것은 **앱 코드가 그 규칙 위에서 올바르게 동작하는가**다.
 * ⚠️ Production에서는 404. 외부 네트워크를 쓰지 않는다(오프라인 검증은 127.0.0.1:9로 실패시킨다).
 */
export const runtime = 'nodejs';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const TABLES: PersistenceTable[] = ['user_profiles', 'relationship_targets', 'relationship_events', 'analysis_runs'];
const NOW = '2026-09-14T00:00:00.000Z';

interface Check {
  label: string;
  pass: boolean;
  detail?: unknown;
}

function checker() {
  const checks: Check[] = [];
  return {
    checks,
    check(label: string, pass: boolean, detail?: unknown) {
      checks.push(pass ? { label, pass } : { label, pass, detail });
    },
  };
}

interface PersistenceTestRequest {
  scenario?: string;
  answers?: Partial<SessionAnswers>;
  history?: RelationshipHistoryEntry[];
}

function answersFrom(partial: Partial<SessionAnswers> | undefined): SessionAnswers {
  const base = createEmptyAnswers();
  if (!partial) return base;
  return {
    ...base,
    ...partial,
    declared: { ...base.declared, ...partial.declared },
    experience: { ...base.experience, ...partial.experience },
    currentRelationship: { ...base.currentRelationship, ...partial.currentRelationship },
    target: { ...base.target, ...partial.target },
    birthProfile: { ...base.birthProfile, ...partial.birthProfile },
  };
}

/**
 * `SessionProvider.resetTargetContext()`가 **세션에** 하는 일. 보관(registry)은 제품 함수
 * `preserveActiveTarget`를 그대로 부르고, 세션 초기화 모양만 여기서 재현한다.
 */
function afterTargetReset(answers: SessionAnswers): SessionAnswers {
  return {
    ...answers,
    target: createEmptyTargetProfile(),
    currentRelationship: { signals: {}, askedAt: null },
    savedQuestions: [],
    completed: { ...answers.completed, compatibility: false },
  };
}

function rowCounts(db: MemoryDatabase): Record<PersistenceTable, number> {
  return {
    user_profiles: db.tables.user_profiles.length,
    relationship_targets: db.tables.relationship_targets.length,
    relationship_events: db.tables.relationship_events.length,
    analysis_runs: db.tables.analysis_runs.length,
  };
}

function totalRows(db: MemoryDatabase): number {
  return Object.values(rowCounts(db)).reduce((sum, count) => sum + count, 0);
}

function uniqueIds(db: MemoryDatabase): boolean {
  return TABLES.every((table) => {
    const ids = (db.tables[table] as unknown as Record<string, unknown>[]).map((row) =>
      String(row[table === 'user_profiles' ? 'user_id' : 'id']),
    );
    return new Set(ids).size === ids.length;
  });
}

/** 이전 상대 한 명을 보관한 registry — migration이 '보관된 상대'까지 옮기는지 본다 */
function registryWithPreviousTarget(answers: SessionAnswers): TargetRegistryState {
  const previous = answersFrom({
    ...answers,
    target: {
      ...createEmptyTargetProfile(),
      relation: 'ex',
      contact: 'l',
      events: [{ id: 'evt-prev-1', type: 'distance', description: 'PREV target scene' }],
    },
  });
  return preserveActiveTarget(createTargetRegistry(), previous, newUuid(), NOW);
}

/* ══════════════════════════════════════════════════════════════════ RLS */

async function scenarioRls() {
  const c = checker();
  const db = createMemoryDatabase();
  const a = createMemoryGateway(db, USER_A);
  const b = createMemoryGateway(db, USER_B);

  const created = await createRelationshipTargetRepository(a).createIfAbsent({
    label: null,
    relationStatus: 'dating',
    data: targetContextFromSession(createEmptyAnswers()),
  });
  if (!created.ok) {
    c.check('A가 자기 상대를 만든다', false, created.error);
    return c.checks;
  }
  const targetId = created.value.target.id;
  const event = await createRelationshipEventRepository(a).createIfAbsent(targetId, { type: 'conflict', description: 'A scene' });
  const run = await createAnalysisRunRepository(a).record({
    id: newUuid(),
    targetId,
    type: 'deep_report',
    snapshot: { title: 'A' },
    sourceFingerprint: null,
  });
  const profile = await createProfileRepository(a).createIfAbsent(selfProfileFromSession(createEmptyAnswers()));
  c.check('A가 자기 profile · target · event · run을 만든다', profile.ok && event.ok && run.ok);
  if (!event.ok || !run.ok) return c.checks;

  for (const table of TABLES) {
    const rows = await b.select(table, {});
    c.check(`A cannot be SELECTed by B · ${table}`, rows.ok && rows.value.length === 0, rows);
  }
  const peek = await createRelationshipTargetRepository(b).get(targetId);
  c.check('B가 A의 target id로 get해도 null', peek.ok && peek.value === null);

  const insertTarget = await b.insertIfAbsent('relationship_targets', {
    id: newUuid(),
    user_id: USER_A,
    label: null,
    relation_status: null,
    target_json: {},
    schema_version: 1,
    archived_at: null,
  });
  c.check('B cannot INSERT as A · relationship_targets', !insertTarget.ok && insertTarget.error.kind === 'forbidden');
  const insertProfile = await b.insertIfAbsent('user_profiles', { user_id: USER_A, profile_json: {}, schema_version: 1 });
  c.check('B cannot INSERT as A · user_profiles', !insertProfile.ok && insertProfile.error.kind === 'forbidden');
  const insertEvent = await b.insertIfAbsent('relationship_events', {
    id: newUuid(),
    user_id: USER_A,
    target_id: targetId,
    type: 'other',
    description: 'x',
    my_reaction: null,
  });
  c.check('B cannot INSERT as A · relationship_events', !insertEvent.ok && insertEvent.error.kind === 'forbidden');
  const insertRun = await b.insertIfAbsent('analysis_runs', {
    id: newUuid(),
    user_id: USER_A,
    target_id: null,
    analysis_type: 'deep_report',
    result_snapshot: {},
    source_fingerprint: null,
    app_version: null,
    prompt_version: null,
    model: null,
    idempotency_key: null,
  });
  c.check('B cannot INSERT as A · analysis_runs', !insertRun.ok && insertRun.error.kind === 'forbidden');

  const crossEvent = await b.insertIfAbsent('relationship_events', {
    id: newUuid(),
    user_id: USER_B,
    target_id: targetId,
    type: 'other',
    description: 'B into A',
    my_reaction: null,
  });
  c.check('B는 자기 소유로도 A의 상대에 사건을 붙일 수 없다(복합 FK)', !crossEvent.ok && crossEvent.error.kind === 'invalid');

  const collide = await createRelationshipTargetRepository(b).createIfAbsent({
    id: targetId,
    label: '가로채기',
    relationStatus: null,
    data: targetContextFromSession(createEmptyAnswers()),
  });
  const aTarget = db.tables.relationship_targets.find((row) => row.id === targetId);
  c.check(
    'B가 A의 target id로 만들려 해도 A 행은 그대로(conflict)',
    !collide.ok && collide.error.kind === 'conflict' && aTarget?.user_id === USER_A && aTarget.label === null,
  );

  const updateTarget = await b.updateAtRevision('relationship_targets', targetId, 1, { label: 'hijack' });
  const updateEvent = await b.updateAtRevision('relationship_events', event.value.event.id, 1, { description: 'hijack' });
  const updateProfile = await b.updateAtRevision('user_profiles', USER_A, 1, { profile_json: { hijack: true } });
  c.check(
    'B cannot UPDATE A (target · event · profile 0행)',
    updateTarget.ok && updateTarget.value === null && updateEvent.ok && updateEvent.value === null && updateProfile.ok && updateProfile.value === null,
  );
  c.check(
    'B의 UPDATE 시도 뒤에도 A 행 내용 · revision 불변',
    db.tables.relationship_targets[0]?.revision === 1 &&
      db.tables.relationship_events[0]?.description === 'A scene' &&
      JSON.stringify(db.tables.user_profiles[0]?.profile_json).includes('hijack') === false,
  );

  const deleteTarget = await b.remove('relationship_targets', targetId);
  const deleteRun = await b.remove('analysis_runs', run.value.run.id);
  const deleteEvent = await b.remove('relationship_events', event.value.event.id);
  c.check(
    'B cannot DELETE A',
    deleteTarget.ok && !deleteTarget.value.removed && deleteRun.ok && !deleteRun.value.removed && deleteEvent.ok && !deleteEvent.value.removed && totalRows(db) === 4,
  );

  const anon = createMemoryGateway(db, null);
  const anonSelect = await anon.select('relationship_targets', {});
  const anonInsert = await createProfileRepository(anon).createIfAbsent(selfProfileFromSession(createEmptyAnswers()));
  c.check(
    '로그인하지 않은 요청은 unauthorized',
    !anonSelect.ok && anonSelect.error.kind === 'unauthorized' && !anonInsert.ok && anonInsert.error.kind === 'unauthorized',
  );
  return c.checks;
}

/* ══════════════════════════════════════════════════════════════════ repositories */

async function scenarioRepositories() {
  const c = checker();
  const db = createMemoryDatabase();
  const gw = createMemoryGateway(db, USER_A);
  const profiles = createProfileRepository(gw);
  const targets = createRelationshipTargetRepository(gw);
  const events = createRelationshipEventRepository(gw);
  const runs = createAnalysisRunRepository(gw);

  const none = await profiles.get();
  c.check('profile.get — 없으면 null', none.ok && none.value === null);
  const data1 = selfProfileFromSession(
    answersFrom({ status: 'dating', declared: { contact: 5, conflict: 'now', alone: 2, affection: 'a3', hobby: 'h1' } }),
  );
  const p1 = await profiles.createIfAbsent(data1);
  const p2 = await profiles.createIfAbsent(selfProfileFromSession(createEmptyAnswers()));
  c.check('profile.createIfAbsent — 처음 created · revision 1', p1.ok && p1.value.created && p1.value.profile.revision === 1);
  c.check(
    'profile.createIfAbsent — 두 번째는 덮어쓰지 않는다',
    p2.ok && !p2.value.created && p2.value.profile.data.declared.contact === 5,
  );
  const pu = await profiles.update({ ...data1, mbti: 'INFP' }, 1);
  c.check('profile.update — revision 2', pu.status === 'saved' && pu.value.revision === 2 && pu.value.data.mbti === 'INFP');

  const t1 = await targets.createIfAbsent({ label: '  민트 \n 초코 ', relationStatus: 'dating', data: targetContextFromSession(createEmptyAnswers()) });
  const t2 = await targets.createIfAbsent({ label: null, relationStatus: 'ended', data: targetContextFromSession(createEmptyAnswers()) });
  if (!t1.ok || !t2.ok) {
    c.check('target.createIfAbsent', false, { t1, t2 });
    return c.checks;
  }
  const id1 = t1.value.target.id;
  const id2 = t2.value.target.id;
  c.check('target.create — 별칭은 정리되고 실명을 요구하지 않는다(null 허용)', t1.value.target.label === '민트 초코' && t2.value.target.label === null);
  const tooLong = await targets.createIfAbsent({ label: '가'.repeat(80), relationStatus: null, data: targetContextFromSession(createEmptyAnswers()) });
  c.check(
    'target.create — 40자를 넘는 별칭은 자르지 않고 거부(payload_rejected · label)',
    !tooLong.ok && tooLong.error.kind === 'payload_rejected' && (tooLong.error.issues ?? []).some((issue) => issue.path === 'label'),
    tooLong,
  );

  const listed = await targets.list();
  c.check('target.list — 2개', listed.ok && listed.value.length === 2);
  const tu = await targets.update(id1, { label: '새 별칭' }, 1);
  c.check('target.update — revision 2', tu.status === 'saved' && tu.value.label === '새 별칭' && tu.value.revision === 2);
  const archived = await targets.archive(id2, 1, NOW);
  c.check('target.archive — archived_at 기록', archived.status === 'saved' && archived.value.archivedAt === NOW);
  const active = await targets.list();
  const all = await targets.list({ includeArchived: true });
  c.check('target.list — 보관된 상대는 기본 목록에서 빠진다', active.ok && active.value.length === 1 && all.ok && all.value.length === 2);

  const e1 = await events.createIfAbsent(id1, { type: 'conflict', description: 'first scene', myReaction: '  조용히 기다렸어 ' });
  const e2 = await events.createIfAbsent(id1, { type: 'meeting', description: 'second scene' });
  const empty = await events.createIfAbsent(id1, { type: 'other', description: '   ' });
  c.check('event.create — 빈 본문은 invalid', !empty.ok && empty.error.kind === 'invalid');
  const listE1 = await events.listByTarget(id1);
  const listE2 = await events.listByTarget(id2);
  c.check(
    'cloud-event — 상대별 목록 · 입력 순서 보존 · 반응 trim',
    listE1.ok &&
      listE1.value.map((item) => item.event.description).join('|') === 'first scene|second scene' &&
      listE1.value[0]?.event.myReaction === '조용히 기다렸어' &&
      listE2.ok &&
      listE2.value.length === 0,
  );
  if (e1.ok && e2.ok) {
    const eu = await events.update(e1.value.event.id, { description: 'first scene (edited)', myReaction: null }, 1);
    c.check('cloud-event — update revision 2 · 반응 제거', eu.status === 'saved' && eu.value.revision === 2 && eu.value.event.myReaction === undefined);
    const bad = await events.update(e1.value.event.id, { description: '' }, 2);
    c.check('cloud-event — 빈 본문으로 수정 거부', bad.status === 'failed' && bad.error.kind === 'invalid');
    const removed = await events.remove(e2.value.event.id);
    const after = await events.listByTarget(id1);
    c.check('cloud-event — remove', removed.ok && removed.value.removed && after.ok && after.value.length === 1);
  }

  const r1 = await runs.record({ id: newUuid(), targetId: id1, type: 'deep_report', snapshot: { title: 'run-1' }, sourceFingerprint: 'fp', promptVersion: 'v' });
  const r2 = await runs.record({ id: newUuid(), targetId: id1, type: 'deep_report', snapshot: { title: 'run-2' }, sourceFingerprint: 'fp' });
  const r3 = await runs.record({ id: newUuid(), targetId: null, type: 'mirror_history', snapshot: { title: 'self' }, sourceFingerprint: null });
  c.check('analysisRun.record — 새 실행은 새 행', r1.ok && r2.ok && r3.ok && db.tables.analysis_runs.length === 3);
  const latest = await runs.latestForTarget(id1);
  c.check('analysisRun.latestForTarget — 가장 최근 실행', latest.ok && latest.value?.snapshot.title === 'run-2');
  const byTarget = await runs.list({ targetId: id1 });
  const selfRuns = await runs.list({ targetId: null });
  c.check('analysisRun.list — target 필터 · self(null) 필터', byTarget.ok && byTarget.value.length === 2 && selfRuns.ok && selfRuns.value.length === 1);

  const summaries = await targets.listSummaries({ includeArchived: true });
  const s1 = summaries.ok ? summaries.value.find((item) => item.id === id1) : undefined;
  const s2 = summaries.ok ? summaries.value.find((item) => item.id === id2) : undefined;
  c.check(
    'saved-target — 목록 요약(별칭 · 관계 상태 · 마지막 분석 시각 · 보관)',
    Boolean(s1 && s1.label === '새 별칭' && s1.relationStatus === 'dating' && r2.ok && s1.lastAnalysisAt === r2.value.run.createdAt) &&
      Boolean(s2 && s2.lastAnalysisAt === null && s2.archived && s2.relationStatus === 'ended'),
    summaries,
  );

  const removeTarget = await targets.remove(id1);
  c.check(
    'target.remove — 그 상대의 사건 · 분석이 함께 지워진다(CASCADE) · 다른 기록은 남는다',
    removeTarget.ok &&
      db.tables.relationship_events.length === 0 &&
      db.tables.analysis_runs.length === 1 &&
      db.tables.analysis_runs[0]?.target_id === null,
  );
  return c.checks;
}

/* ══════════════════════════════════════════════════════════════════ local migration */

async function scenarioMigration(body: PersistenceTestRequest) {
  const c = checker();
  const answers = answersFrom(body.answers);
  const history = body.history ?? [];
  const registry = registryWithPreviousTarget(answers);
  const snapshot: LocalDataSnapshot = { answers, history, registry };
  const before = JSON.stringify(snapshot);
  const db = createMemoryDatabase();
  const gw = createMemoryGateway(db, USER_A);

  const plan = planLocalMigration(snapshot);
  c.check('plan — 사진 · 사진 관찰 · AI 캐시 · analytics 제외를 명시', ['photos', 'observedAnalysis', 'aiCache', 'analytics'].every((item) => plan.excluded.includes(item as never)));
  c.check('plan — 지금 상대 + 보관된 상대', plan.targets.length === 2 && plan.targets.filter((item) => item.active).length === 1);

  const noConsent = await migrateLocalData({ gateway: gw, snapshot, consent: false });
  c.check('동의 없으면 아무것도 올리지 않는다(consent_required · 0행)', noConsent.status === 'consent_required' && totalRows(db) === 0);

  const first = await migrateLocalData({ gateway: gw, snapshot, consent: true });
  const expectedEvents = answers.target.events.length + 1;
  c.check(
    '첫 migration — profile 1 · targets 2 · events · history runs',
    first.status === 'completed' &&
      first.created.profile === 1 &&
      first.created.targets === 2 &&
      first.created.events === expectedEvents &&
      first.created.analysisRuns === history.length,
    first,
  );
  const counts = rowCounts(db);

  const retry = await migrateLocalData({ gateway: gw, snapshot, consent: true });
  c.check(
    'retry — 중복 없음(created 0 · unchanged = 첫 결과)',
    retry.status === 'completed' &&
      Object.values(retry.created).every((count) => count === 0) &&
      JSON.stringify(retry.unchanged) === JSON.stringify(first.created) &&
      JSON.stringify(rowCounts(db)) === JSON.stringify(counts),
    retry,
  );
  const relogin = createMemoryGateway(db, USER_A);
  const afterRelogin = await migrateLocalData({ gateway: relogin, snapshot: JSON.parse(before) as LocalDataSnapshot, consent: true });
  c.check(
    'logout → login · refresh(스냅샷 재직렬화) — 중복 없음',
    afterRelogin.status === 'completed' && JSON.stringify(rowCounts(db)) === JSON.stringify(counts) && uniqueIds(db),
  );
  c.check('로컬 데이터는 읽기만 한다(스냅샷 불변)', JSON.stringify(snapshot) === before);

  const stored = JSON.stringify(db.tables);
  c.check(
    '사진 · 사진 관찰 결과가 계정에 올라가지 않는다',
    !stored.includes('objectUrl') && !stored.includes('"photos"') && !stored.includes('observedAnalysis'),
  );
  const cloudIdOf = (localId: string | undefined) => first.links.find((link) => link.localTargetId === localId)?.cloudTargetId;
  c.check(
    'local/cloud id 분리 — 로컬 상대 id를 cloud id로 쓰지 않는다(link로만 잇는다)',
    first.links.length === 2 &&
      first.links.every((link) => link.cloudTargetId !== link.localTargetId) &&
      db.tables.relationship_targets.every((row) => row.id !== registry.activeTargetId && row.id !== registry.saved[0]?.id),
    first.links,
  );
  const activeRow = db.tables.relationship_targets.find((row) => row.id === cloudIdOf(registry.activeTargetId));
  c.check(
    '사건은 target_json 배열이 아니라 행이다',
    Boolean(activeRow) && !JSON.stringify(activeRow?.target_json).includes('"events"'),
  );
  const activeEvents = db.tables.relationship_events.filter((row) => row.target_id === cloudIdOf(registry.activeTargetId));
  const prevId = registry.saved[0]?.id;
  const prevEvents = db.tables.relationship_events.filter((row) => row.target_id === cloudIdOf(prevId));
  c.check(
    '사건이 자기 상대에만 붙는다(지금 상대 ↔ 보관된 상대)',
    activeEvents.length === answers.target.events.length &&
      activeEvents.every((row) => !row.description.includes('PREV')) &&
      prevEvents.length === 1 &&
      prevEvents[0]?.description === 'PREV target scene',
  );

  const otherUser = createMemoryGateway(db, USER_B);
  const otherMigration = await migrateLocalData({ gateway: otherUser, snapshot, consent: true });
  c.check(
    '같은 기기 데이터를 다른 계정이 동의해 저장하면 새 cloud id — 충돌 없음 · A 행 불변 · 섞임 없음',
    otherMigration.status === 'completed' &&
      otherMigration.created.targets === 2 &&
      otherMigration.links.every((link) => !first.links.some((mine) => mine.cloudTargetId === link.cloudTargetId)) &&
      db.tables.relationship_targets.filter((row) => row.user_id === USER_A).length === 2 &&
      db.tables.relationship_events.filter((row) => row.user_id === USER_A).length === expectedEvents &&
      db.tables.relationship_events.every((row) =>
        db.tables.relationship_targets.some((target) => target.id === row.target_id && target.user_id === row.user_id),
      ),
    otherMigration,
  );

  const emptyReport = await migrateLocalData({
    gateway: createMemoryGateway(createMemoryDatabase(), USER_A),
    snapshot: { answers: createEmptyAnswers(), history: [], registry: createTargetRegistry() },
    consent: true,
  });
  c.check('옮길 것이 없으면 nothing_to_migrate', emptyReport.status === 'nothing_to_migrate');
  return c.checks;
}

async function scenarioMigrationConflict(body: PersistenceTestRequest) {
  const c = checker();
  const answers = answersFrom(body.answers);
  const registry = createTargetRegistry();
  const db = createMemoryDatabase();
  const gw = createMemoryGateway(db, USER_A);

  /* 계정에 이미 **다른** 나 · 같은 id의 다른 상대가 있다(다른 기기에서 먼저 저장) */
  await createProfileRepository(gw).createIfAbsent(selfProfileFromSession(answersFrom({ mbti: 'ESTJ' })));
  await createRelationshipTargetRepository(gw).createIfAbsent({
    id: await cloudTargetIdOf(USER_A, registry.activeTargetId),
    label: '다른 기기',
    relationStatus: 'dating',
    data: targetContextFromSession(answersFrom({ target: { ...createEmptyTargetProfile(), relation: 'friend' } })),
  });

  const result = await migrateLocalData({ gateway: gw, snapshot: { answers, history: [], registry }, consent: true });
  const remoteTarget = db.tables.relationship_targets[0];
  c.check('계정에 다른 값이 있으면 completed_with_conflicts', result.status === 'completed_with_conflicts', result);
  c.check(
    'conflict는 id만 담는다(본문 없음)',
    result.conflicts.every((item) => Object.keys(item).sort().join(',') === 'entity,id'),
  );
  c.check(
    '덮어쓰지 않는다 — 계정의 나 · 상대 그대로',
    JSON.stringify(db.tables.user_profiles[0]?.profile_json).includes('ESTJ') &&
      remoteTarget?.label === '다른 기기' &&
      JSON.stringify(remoteTarget?.target_json).includes('friend'),
  );
  c.check('충돌한 상대에는 이 기기 사건을 섞지 않는다', db.tables.relationship_events.length === 0);
  return c.checks;
}

/* ══════════════════════════════════════════════════════════════════ failure / offline */

function flakyGateway(inner: PersistenceGateway, db: MemoryDatabase, failAfterInserts: number): PersistenceGateway {
  let inserts = 0;
  return {
    currentUserId: () => inner.currentUserId(),
    select: (table, filter, options) => inner.select(table, filter, options),
    insertIfAbsent: (table, row) => {
      inserts += 1;
      if (inserts > failAfterInserts) db.offline = true;
      return inner.insertIfAbsent(table, row);
    },
    updateAtRevision: (table, key, expected, patch) => inner.updateAtRevision(table, key, expected, patch),
    remove: (table, key) => inner.remove(table, key),
  };
}

async function scenarioMigrationOffline(body: PersistenceTestRequest) {
  const c = checker();
  const answers = answersFrom(body.answers);
  const snapshot: LocalDataSnapshot = { answers, history: body.history ?? [], registry: registryWithPreviousTarget(answers) };
  const before = JSON.stringify(snapshot);

  const reference = createMemoryDatabase();
  await migrateLocalData({ gateway: createMemoryGateway(reference, USER_A), snapshot, consent: true });

  const db = createMemoryDatabase();
  db.offline = true;
  const offline = await migrateLocalData({ gateway: createMemoryGateway(db, USER_A), snapshot, consent: true });
  c.check('Supabase unavailable — offline · 0행 · 예외 없음', offline.status === 'offline' && totalRows(db) === 0, offline);

  db.offline = false;
  const partial = await migrateLocalData({ gateway: flakyGateway(createMemoryGateway(db, USER_A), db, 3), snapshot, consent: true });
  c.check(
    '중간에 끊기면 partial로 멈춘다',
    partial.status === 'partial' && totalRows(db) > 0 && totalRows(db) < totalRows(reference),
    { status: partial.status, rows: totalRows(db), reference: totalRows(reference) },
  );

  db.offline = false;
  const resumed = await migrateLocalData({ gateway: createMemoryGateway(db, USER_A), snapshot, consent: true });
  c.check(
    '다시 시도하면 남은 것만 들어가고 중복이 없다',
    resumed.status === 'completed' &&
      JSON.stringify(rowCounts(db)) === JSON.stringify(rowCounts(reference)) &&
      uniqueIds(db),
    { resumed, rows: rowCounts(db), reference: rowCounts(reference) },
  );
  c.check('실패 · 재시도 동안 로컬 데이터 불변', JSON.stringify(snapshot) === before);
  return c.checks;
}

async function scenarioFailureOffline() {
  const c = checker();
  const client = createClient('http://127.0.0.1:9', 'sb_publishable_offline_fixture', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const gw = createSupabaseGateway(client);
  const who = await gw.currentUserId();
  c.check('supabaseGateway — 세션 없음은 unauthorized(throw 없음)', !who.ok && (who.error.kind === 'unauthorized' || who.error.kind === 'offline'), who);
  const select = await gw.select('relationship_targets', {});
  c.check('supabaseGateway — 연결 불가 SELECT는 offline', !select.ok && select.error.kind === 'offline', select);
  const insert = await gw.insertIfAbsent('analysis_runs', {
    id: newUuid(),
    user_id: USER_A,
    target_id: null,
    analysis_type: 'deep_report',
    result_snapshot: {},
    source_fingerprint: null,
    app_version: null,
    prompt_version: null,
    model: null,
    idempotency_key: null,
  });
  const update = await gw.updateAtRevision('relationship_targets', newUuid(), 1, { label: null });
  const remove = await gw.remove('relationship_events', newUuid());
  c.check(
    'supabaseGateway — INSERT · UPDATE · DELETE도 offline으로 돌려준다',
    [insert, update, remove].every((item) => !item.ok && item.error.kind === 'offline'),
    { insert, update, remove },
  );
  c.check(
    '에러 메시지에 행 내용이 없다',
    [select, insert, update, remove].every((item) => !item.ok && !/scene|description/i.test(item.error.message)),
  );

  const db = createMemoryDatabase();
  db.offline = true;
  const repoGet = await createProfileRepository(createMemoryGateway(db, USER_A)).get();
  c.check('repository — offline을 값으로 돌려준다', !repoGet.ok && repoGet.error.kind === 'offline');
  return c.checks;
}

/* ══════════════════════════════════════════════════════════════════ sync conflict */

async function scenarioSyncConflict() {
  const c = checker();
  const db = createMemoryDatabase();
  const deviceA = createMemoryGateway(db, USER_A);
  const deviceB = createMemoryGateway(db, USER_A);

  const base = selfProfileFromSession(answersFrom({ mbti: 'INFP' }));
  await createProfileRepository(deviceA).createIfAbsent(base);
  const savedA = await createProfileRepository(deviceA).update({ ...base, mbti: 'ENFP' }, 1);
  const staleB = await createProfileRepository(deviceB).update({ ...base, mbti: 'ISTJ' }, 1);
  c.check('profile — 최신 revision으로는 저장', savedA.status === 'saved' && savedA.value.revision === 2);
  c.check(
    'profile — 오래된 revision은 conflict + 원격 최신값(덮어쓰기 없음)',
    staleB.status === 'conflict' && staleB.remote?.revision === 2 && staleB.remote.data.mbti === 'ENFP' && db.tables.user_profiles[0]?.revision === 2,
    staleB,
  );

  const target = await createRelationshipTargetRepository(deviceA).createIfAbsent({ label: 'A', relationStatus: 'dating', data: targetContextFromSession(createEmptyAnswers()) });
  if (target.ok) {
    const id = target.value.target.id;
    await createRelationshipTargetRepository(deviceA).update(id, { label: 'A2' }, 1);
    const stale = await createRelationshipTargetRepository(deviceB).update(id, { label: 'B2' }, 1);
    c.check('target — stale update conflict', stale.status === 'conflict' && stale.remote?.label === 'A2');
    const staleArchive = await createRelationshipTargetRepository(deviceB).archive(id, 1);
    c.check('target — stale archive도 conflict(보관 상태를 조용히 바꾸지 않음)', staleArchive.status === 'conflict' && db.tables.relationship_targets[0]?.archived_at === null);

    const event = await createRelationshipEventRepository(deviceA).createIfAbsent(id, { type: 'closer', description: 'scene' });
    if (event.ok) {
      await createRelationshipEventRepository(deviceA).update(event.value.event.id, { description: 'scene A' }, 1);
      const staleEvent = await createRelationshipEventRepository(deviceB).update(event.value.event.id, { description: 'scene B' }, 1);
      c.check('event — stale update conflict', staleEvent.status === 'conflict' && staleEvent.remote?.event.description === 'scene A');
    }
  }
  const missing = await createRelationshipTargetRepository(deviceA).update(newUuid(), { label: 'x' }, 1);
  c.check('없는 행 수정은 not_found', missing.status === 'not_found');
  const offline = createMemoryDatabase();
  offline.offline = true;
  const failed = await createProfileRepository(createMemoryGateway(offline, USER_A)).update(base, 1);
  c.check('전송 실패는 failed(conflict로 오인하지 않음)', failed.status === 'failed' && failed.error.kind === 'offline');
  c.check(
    'UX contract 문구',
    SYNC_CONFLICT_COPY.message === '다른 곳에서 정보가 바뀌었어.' && SYNC_CONFLICT_COPY.action === '최신 정보 불러오기',
  );
  return c.checks;
}

/* ══════════════════════════════════════════════════════════════════ target switch */

const LEVELS: TargetLevel[] = ['l', 'm', 'h'];

function targetAnswers(answers: SessionAnswers, index: number): SessionAnswers {
  const events: RelationshipEvent[] = [
    { id: `evt-${index}-a`, type: 'conflict', description: `T${index} scene a` },
    { id: `evt-${index}-b`, type: 'meeting', description: `T${index} scene b`, myReaction: `T${index} reaction` },
  ];
  return {
    ...answers,
    status: 'dating',
    target: { ...createEmptyTargetProfile(), relation: 'talking', contact: LEVELS[index % 3]!, events },
  };
}

function eventsBelongTo(events: readonly RelationshipEvent[], index: number): boolean {
  return events.length === 2 && events.every((event) => event.description.startsWith(`T${index} `));
}

async function scenarioTargetSwitch() {
  const c = checker();
  for (const count of [0, 1, 3, 10]) {
    let registry = createTargetRegistry();
    let answers = createEmptyAnswers();
    const ids: string[] = [];
    for (let index = 0; index < count; index += 1) {
      ids.push(registry.activeTargetId);
      answers = targetAnswers(answers, index);
      registry = preserveActiveTarget(registry, answers, newUuid(), new Date(Date.parse(NOW) + index * 1000).toISOString());
      answers = afterTargetReset(answers);
    }
    const summaries = localRelationshipSummaries(registry, answers);
    c.check(
      `[${count} targets] 새로운 사람은 이전 사람을 지우지 않는다 — 목록 ${count}개 · id 고유`,
      summaries.length === count && new Set(registry.saved.map((item) => item.id)).size === count && ids.every((id) => registry.saved.some((item) => item.id === id)),
    );
    c.check(
      `[${count} targets] 보관된 상대마다 자기 사건만`,
      registry.saved.every((item) => eventsBelongTo(item.events, ids.indexOf(item.id))),
    );

    if (count === 0) {
      c.check('[0 targets] 없는 상대로 전환하면 null', switchToSavedTarget(registry, answers, newUuid(), NOW) === null);
      continue;
    }

    const toA = switchToSavedTarget(registry, answers, ids[0]!, NOW);
    c.check(`[${count} targets] → A: A의 상대 · 사건`, Boolean(toA && toA.state.activeTargetId === ids[0] && eventsBelongTo(toA.answers.target.events, 0) && toA.answers.target.contact === 'l'));
    if (!toA) continue;
    if (count >= 2) {
      const toB = switchToSavedTarget(toA.state, toA.answers, ids[1]!, NOW);
      const backToA = toB ? switchToSavedTarget(toB.state, toB.answers, ids[0]!, NOW) : null;
      c.check(
        `[${count} targets] A → B → A: 상대 · 사건이 섞이지 않는다`,
        Boolean(
          toB &&
            eventsBelongTo(toB.answers.target.events, 1) &&
            toB.state.saved.some((item) => item.id === ids[0] && eventsBelongTo(item.events, 0)) &&
            backToA &&
            JSON.stringify(backToA.answers.target.events) === JSON.stringify(toA.answers.target.events) &&
            backToA.state.saved.length === count - 1 &&
            backToA.state.saved.every((item) => eventsBelongTo(item.events, ids.indexOf(item.id))),
        ),
      );
    }

    /* cloud — 모든 상대를 계정에 올린 뒤 상대별로 읽는다 */
    const db = createMemoryDatabase();
    const gw = createMemoryGateway(db, USER_A);
    const migrated = await migrateLocalData({ gateway: gw, snapshot: { answers: toA.answers, history: [], registry: toA.state }, consent: true });
    const runs = createAnalysisRunRepository(gw);
    const cloudIds = ids.map((id) => migrated.links.find((link) => link.localTargetId === id)?.cloudTargetId ?? id);
    for (const [index, id] of cloudIds.entries()) {
      await runs.record({ id: newUuid(), targetId: id, type: 'deep_report', snapshot: { title: `T${index} old` }, sourceFingerprint: null });
      await runs.record({ id: newUuid(), targetId: id, type: 'deep_report', snapshot: { title: `T${index}` }, sourceFingerprint: null });
    }
    const eventRepo = createRelationshipEventRepository(gw);
    let isolated = true;
    let latestOk = true;
    for (const [index, id] of cloudIds.entries()) {
      const list = await eventRepo.listByTarget(id);
      if (!list.ok || !eventsBelongTo(list.value.map((item) => item.event), index)) isolated = false;
      const latest = await runs.latestForTarget(id);
      if (!latest.ok || latest.value?.snapshot.title !== `T${index}`) latestOk = false;
    }
    const cloudSummaries = await createRelationshipTargetRepository(gw).listSummaries();
    c.check(`[${count} targets] cloud: migration ${count}명 · 사건 ${count * 2}`, migrated.created.targets === count && migrated.created.events === count * 2, migrated);
    c.check(`[${count} targets] cloud: 상대별 사건 격리`, isolated);
    c.check(`[${count} targets] cloud: 상대별 latest analysis`, latestOk);
    c.check(
      `[${count} targets] cloud: 저장된 관계 목록 ${count}개 · 마지막 분석 시각 채워짐`,
      cloudSummaries.ok && cloudSummaries.value.length === count && cloudSummaries.value.every((item) => item.lastAnalysisAt !== null),
    );
  }
  return c.checks;
}

/* ══════════════════════════════════════════════════════════════════ analysis run */

async function scenarioAnalysisRun() {
  const c = checker();
  const db = createMemoryDatabase();
  const gw = createMemoryGateway(db, USER_A);
  const runs = createAnalysisRunRepository(gw);
  const id = newUuid();
  const accepted = { promptVersion: 'deep-report-v12', candidates: [{ id: 'c1', title: '연락이 멈춘 뒤' }] };

  const first = await runs.record({ id, targetId: null, type: 'deep_report', snapshot: accepted, sourceFingerprint: 'fp-1', promptVersion: 'deep-report-v13-uncertainty-move', model: 'gpt-5.4' });
  c.check('accepted/rendered output 저장', first.ok && first.value.created && first.value.run.appVersion !== null);
  const again = await runs.record({ id, targetId: null, type: 'deep_report', snapshot: { promptVersion: 'x', candidates: [] }, sourceFingerprint: 'fp-2' });
  const stored = await runs.get(id);
  c.check(
    '같은 id 재기록 — 덮어쓰지 않고 differs로 알린다(당시 결과 불변)',
    again.ok && !again.value.created && again.value.differs && stored.ok && JSON.stringify(stored.value?.snapshot) === JSON.stringify(accepted) && stored.value?.sourceFingerprint === 'fp-1',
  );
  const raw = await (gw as ReturnType<typeof createMemoryGateway>).attemptRawUpdate('analysis_runs', id, { result_snapshot: {} });
  c.check('analysis_runs UPDATE 경로 자체가 거부된다', !raw.ok && raw.error.kind === 'forbidden');
  const second = await runs.record({ id: newUuid(), targetId: null, type: 'deep_report', snapshot: { promptVersion: 'deep-report-v12', candidates: [] }, sourceFingerprint: 'fp-1' });
  const listed = await runs.list();
  c.check('새 실행 = 새 analysis_run (이전 결과와 함께 남는다)', second.ok && listed.ok && listed.value.length === 2);

  const forbidden: Record<string, unknown>[] = [
    { raw: '{"choices":[]}' },
    { report: { providerResponse: {} } },
    { reasoning: 'hidden chain' },
    { candidates: [{ title: 't', thinking: '...' }] },
    { scenes: [{ description: '사건 본문', myReaction: '반응' }] },
    { target: { birthProfile: { date: '1990-01-01' } } },
    { aiContext: { candidates: [] } },
    { photos: [{ objectUrl: 'blob:' }] },
  ];
  const results = forbidden.map((snapshot) => validateSnapshot(snapshot));
  c.check(
    'raw Provider 응답 · 숨은 추론 · 사건 본문 · 생년월일 · AI payload · 사진은 거부',
    results.every((item) => !item.ok && item.error.kind === 'invalid'),
    results.map((item) => (item.ok ? 'accepted' : item.error.message)),
  );
  const blocked = await runs.record({ id: newUuid(), targetId: null, type: 'deep_report', snapshot: forbidden[4]!, sourceFingerprint: null });
  c.check('repository도 거부된 스냅샷은 저장하지 않는다', !blocked.ok && db.tables.analysis_runs.length === 2);
  const big = validateSnapshot({ text: 'x'.repeat(600 * 1024) });
  c.check('스냅샷 크기 상한', !big.ok && big.error.message === 'snapshot_too_large');
  return c.checks;
}

/* ══════════════════════════════════════════════════════════════════ auth / config */

async function scenarioAuthConfig() {
  const c = checker();
  const payload = Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url');
  c.check('설정 없음 → null(Guest)', supabaseConfigFrom(undefined, undefined) === null && supabaseConfigFrom('', ' ') === null);
  c.check('https가 아닌 원격 URL 거부', supabaseConfigFrom('http://example.supabase.co', 'sb_publishable_x') === null);
  c.check('secret key 거부', supabaseConfigFrom('https://example.supabase.co', 'sb_secret_abc') === null);
  c.check('service_role JWT 거부', supabaseConfigFrom('https://example.supabase.co', `eyJhbGciOiJIUzI1NiJ9.${payload}.sig`) === null);
  c.check('URL 오타 거부', supabaseConfigFrom('not a url', 'sb_publishable_x') === null);
  const valid = supabaseConfigFrom('https://example.supabase.co/', 'sb_publishable_x');
  c.check('정상 공개 설정 허용 · 끝 슬래시 정리', valid?.url === 'https://example.supabase.co' && valid.anonKey === 'sb_publishable_x');
  c.check(
    '이 dev 서버의 연결 상태가 env와 일치',
    isSupabaseConfigured() === Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()),
    { configured: isSupabaseConfigured() },
  );
  return c.checks;
}

/* ══════════════════════════════════════════════════════════════════ parity */

async function scenarioParity(body: PersistenceTestRequest) {
  const c = checker();
  const answers = answersFrom(body.answers);
  const registry = createTargetRegistry();
  const db = createMemoryDatabase();
  const gw = createMemoryGateway(db, USER_A);
  const migrated = await migrateLocalData({ gateway: gw, snapshot: { answers, history: [], registry }, consent: true });
  const profile = await createProfileRepository(gw).get();
  const cloudTargetId = migrated.links[0]?.cloudTargetId ?? '';
  const target = await createRelationshipTargetRepository(gw).get(cloudTargetId);
  const events = await createRelationshipEventRepository(gw).listByTarget(cloudTargetId);
  c.check('parity — 저장 후 다시 읽기 성공', migrated.status === 'completed' && profile.ok && target.ok && events.ok, migrated);
  if (!profile.ok || !target.ok || !events.ok) return { checks: c.checks, rebuilt: null };

  const rebuilt = sessionWithCloudContext(createEmptyAnswers(), {
    profile: profile.value?.data ?? null,
    target: target.value?.data ?? null,
    events: events.value.map((item) => item.event),
  });
  const shape = (value: SessionAnswers) => ({
    status: value.status,
    declared: value.declared,
    experience: value.experience,
    currentRelationship: value.currentRelationship,
    mbti: value.mbti,
    birthProfile: value.birthProfile,
    target: { ...value.target, events: value.target.events.map(({ type, description, myReaction }) => ({ type, description, myReaction })) },
  });
  c.check('parity — 입력 값이 로컬과 같다(사건 id만 클라우드 id)', JSON.stringify(shape(rebuilt)) === JSON.stringify(shape(answers)), {
    local: shape(answers),
    cloud: shape(rebuilt),
  });
  return {
    checks: c.checks,
    rebuilt: {
      status: rebuilt.status,
      declared: rebuilt.declared,
      experience: rebuilt.experience,
      currentRelationship: rebuilt.currentRelationship,
      target: rebuilt.target,
      mbti: rebuilt.mbti,
      birthProfile: rebuilt.birthProfile,
    },
  };
}

/* ══════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════════ storage capacity guard */

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const BASE64_BLOB = 'iVBORw0KGgo'.repeat(40);

function reasonsOf(error: PersistenceError | undefined): string[] {
  return (error?.issues ?? []).map((issue) => issue.reason);
}

/** 제품 리포트 중 스냅샷 builder가 읽는 칸만 채운 합성 리포트 — reportedScenes에 원문을 넣어 새는지 본다 */
function syntheticDeepReport(eventIds: readonly string[], sceneTexts: readonly string[]): RelationshipDeepReport {
  return {
    available: true,
    candidates: [
      {
        id: 'cand_ch_declared_vs_shown',
        verdict: 'GAP',
        primaryAxis: 'contact',
        headline: '연락 — 생각보다 크게 걸리는 자리',
        soWhat: '연락이 적은 것보다, 흐름이 멈춘 채 다음을 모르는 순간이 더 걸릴 수 있어.',
        whyItMatters: '같은 몇 시간이라도 다음이 안 보이면 더 길게 느껴질 수 있어.',
        limitation: '네가 알려준 장면과 답만으로 본 거라 상대의 이유까지는 알 수 없어.',
        soWhatSource: 'semantic_ai',
        insightOperator: 'CONDITION_NARROWING',
        evidenceRefs: [{ source: 'declared', field: 'contact' }],
        relevantEventIds: [...eventIds],
        semanticEventIds: eventIds.slice(0, 1),
      },
    ],
    actionPlan: {
      sourceCandidateId: 'cand_ch_declared_vs_shown',
      title: '연락 — 생각보다 크게 걸리는 자리',
      topic: '연락',
      mode: 'plan',
      source: 'semantic_ai',
      lifecycle: 'current',
      priorityReason: null,
      sourceRank: 1,
      nextMove: '말이 엇갈려 시간을 둘 때, 언제 다시 이야기할지도 같이 정해봐',
      verificationQuestion: null,
      verificationFrom: 'card',
      observeSignal: '정한 때에 대화가 실제로 다시 이어지는지 봐',
      decisionSignals: [],
      unresolved: null,
      usedEvidenceRefs: [{ source: 'declared', field: 'contact' }],
      usedEventIds: [...eventIds],
    },
    reportedScenes: { scenes: sceneTexts.map((scene, index) => ({ id: eventIds[index] ?? `scene-${index}`, scene })) },
  } as unknown as RelationshipDeepReport;
}

async function scenarioStorage(body: PersistenceTestRequest) {
  const c = checker();
  const db = createMemoryDatabase();
  const gw = createMemoryGateway(db, USER_A);
  const targets = createRelationshipTargetRepository(gw);
  const events = createRelationshipEventRepository(gw);
  const runs = createAnalysisRunRepository(gw);
  const emptyContext = targetContextFromSession(createEmptyAnswers());
  const base = await targets.createIfAbsent({ label: null, relationStatus: 'dating', data: emptyContext });
  if (!base.ok) {
    c.check('storage — 기준 상대 생성', false, base.error);
    return { checks: c.checks };
  }
  const targetId = base.value.target.id;
  const targetRow = (json: Record<string, unknown>) => ({
    id: newUuid(),
    user_id: USER_A,
    label: null,
    relation_status: null,
    target_json: json as unknown as Json,
    schema_version: 1,
    archived_at: null,
  });

  /* STORAGE-01 */
  const photoPayload = await gw.insertIfAbsent(
    'relationship_targets',
    targetRow({ profile: {}, photos: [{ id: 'p1' }], imageBase64: BASE64_BLOB }),
  );
  c.check(
    'STORAGE-01 · 사진 · base64 필드가 든 payload는 cloud write 거부(payload_rejected · binary_field)',
    !photoPayload.ok && photoPayload.error.kind === 'payload_rejected' && reasonsOf(photoPayload.error).includes('binary_field'),
    photoPayload,
  );
  const base64Text = await gw.insertIfAbsent('relationship_targets', targetRow({ profile: { memo: BASE64_BLOB } }));
  c.check(
    'STORAGE-01 · 키 이름이 평범해도 긴 base64 문자열은 거부',
    !base64Text.ok && reasonsOf(base64Text.error).includes('base64_like'),
    base64Text,
  );
  const binary = inspectCloudPayload('relationship_targets', targetRow({ profile: { bytes: new Uint8Array(4) } }));
  c.check('STORAGE-01 · ArrayBuffer/typed array 값은 거부', binary.some((issue) => issue.reason === 'binary_value'), binary);
  c.check('STORAGE-01 · 거부된 write는 행을 만들지 않는다', db.tables.relationship_targets.length === 1);

  /* STORAGE-02 */
  const dataUrlEvent = await events.createIfAbsent(targetId, { type: 'other', description: TINY_PNG });
  c.check(
    'STORAGE-02 · data:image URL 거부',
    !dataUrlEvent.ok && dataUrlEvent.error.kind === 'payload_rejected' && reasonsOf(dataUrlEvent.error).includes('data_url'),
    dataUrlEvent,
  );
  const blobInterest = await gw.insertIfAbsent(
    'relationship_targets',
    targetRow({ profile: { preferences: { interests: [{ id: 'i1', category: 'custom', label: 'blob:http://localhost/abc' }] } } }),
  );
  c.check('STORAGE-02 · blob: URL 거부', !blobInterest.ok && reasonsOf(blobInterest.error).includes('blob_url'), blobInterest);
  c.check('STORAGE-02 · 사건 행 0', db.tables.relationship_events.length === 0);

  /* STORAGE-03 · 10 */
  const scenes = ['얘기가 엇갈린 다음에 아무 답이 없던 날이 힘들었어', '같이 산책하면서 오래 이야기했어'];
  const reaction = '먼저 연락하지 못하고 기다렸어';
  const eventIds: string[] = [];
  for (const scene of scenes) {
    const saved = await events.createIfAbsent(targetId, { type: 'conflict', description: scene, myReaction: reaction });
    if (saved.ok) eventIds.push(saved.value.event.id);
  }
  const duplicated = await runs.record({
    id: newUuid(),
    targetId,
    type: 'deep_report',
    snapshot: { candidates: [{ id: 'c1', soWhat: `네가 적은 "${scenes[0]}" 장면이 걸려` }] },
    sourceFingerprint: null,
    forbiddenTexts: [...scenes, reaction],
  });
  c.check(
    'STORAGE-03 · 사건 원문을 다시 담은 analysis snapshot은 거부',
    !duplicated.ok && duplicated.error.message.startsWith('snapshot_duplicates_source_text'),
    duplicated,
  );
  const deepRun = deepReportRunInput({
    targetId,
    report: syntheticDeepReport(eventIds, scenes),
    promptVersion: 'deep-report-v13-uncertainty-move',
    model: 'gpt-5.4',
    sourceFingerprint: 'fp',
    generationRequestId: 'gen-storage-1',
  });
  const deepJson = JSON.stringify(deepRun.snapshot);
  c.check(
    'STORAGE-10 · deep report snapshot = candidate id · refs · event id · 화면 문장. 장면 원문 · reportedScenes 없음',
    scenes.every((scene) => !deepJson.includes(scene)) &&
      !deepJson.includes(reaction) &&
      !deepJson.includes('reportedScenes') &&
      eventIds.every((id) => deepJson.includes(id)) &&
      deepJson.includes('candidateIds'),
    deepRun.snapshot,
  );
  const recorded = await runs.recordGenerated({ ...deepRun, forbiddenTexts: [...scenes, reaction] });
  c.check('STORAGE-10 · 그 snapshot은 원문 금지 목록을 통과해 저장된다', recorded.ok && recorded.value.created, recorded);
  c.check(
    'STORAGE-03 · analysis_runs 전체에 사건 원문 0',
    scenes.every((scene) => !JSON.stringify(db.tables.analysis_runs).includes(scene)),
  );

  /* STORAGE-04 */
  const leakedEvents = targetRowOf(USER_A, {
    id: newUuid(),
    label: null,
    relationStatus: null,
    data: {
      ...emptyContext,
      profile: { ...emptyContext.profile, events: [{ id: 'e', type: 'other', description: '장면' }] },
    } as unknown as TargetContextData,
  });
  c.check(
    'STORAGE-04 · target_json에는 사건 배열이 들어가지 않는다(mapper가 도메인 칸만 옮김)',
    !JSON.stringify(leakedEvents.target_json).includes('"events"'),
  );
  const nested = await gw.insertIfAbsent('relationship_targets', targetRow({ profile: { events: [{ description: '장면' }] } }));
  c.check('STORAGE-04 · 직접 넣어도 gateway가 거부(nested_events)', !nested.ok && reasonsOf(nested.error).includes('nested_events'), nested);

  /* STORAGE-05 */
  const rawTarget = await gw.insertIfAbsent('relationship_targets', targetRow({ profile: {}, rawResponse: { choices: [] } }));
  const rawRun = await runs.record({
    id: newUuid(),
    targetId,
    type: 'deep_report',
    snapshot: { choices: [{ message: { content: '{}' } }] },
    sourceFingerprint: null,
  });
  const rawGatewayRun = await gw.insertIfAbsent('analysis_runs', {
    id: newUuid(),
    user_id: USER_A,
    target_id: null,
    analysis_type: 'deep_report',
    result_snapshot: { prompt: 'system prompt' },
    source_fingerprint: null,
    app_version: null,
    prompt_version: null,
    model: null,
    idempotency_key: null,
  });
  c.check(
    'STORAGE-05 · Provider raw response는 target에도 analysis에도 저장 거부',
    !rawTarget.ok && reasonsOf(rawTarget.error).includes('forbidden_key') && !rawRun.ok,
    { rawTarget, rawRun },
  );
  c.check(
    'STORAGE-05 · repository를 우회한 raw prompt도 gateway가 거부',
    !rawGatewayRun.ok && rawGatewayRun.error.kind === 'payload_rejected',
    rawGatewayRun,
  );

  /* STORAGE-06 */
  const huge = '가'.repeat(CLOUD_WRITE_BUDGET.maxTextChars.eventText + 1000);
  const localEvent: RelationshipEvent = { id: 'evt-huge', type: 'other', description: huge };
  const localBefore = JSON.stringify(localEvent);
  const hugeWrite = await events.createIfAbsent(targetId, localEvent);
  c.check(
    'STORAGE-06 · oversize 사건 → cloud write 실패 · 어떤 칸이 큰지 반환(값 없음)',
    !hugeWrite.ok &&
      hugeWrite.error.kind === 'payload_rejected' &&
      (hugeWrite.error.issues ?? []).some((issue) => issue.path === 'description') &&
      !JSON.stringify(hugeWrite.error).includes('가가가'),
    hugeWrite.ok ? null : hugeWrite.error.issues,
  );
  c.check(
    'STORAGE-06 · 잘라서 저장하지 않는다(행 없음) · 로컬 원본 그대로',
    !db.tables.relationship_events.some((row) => row.description.startsWith('가가가')) && JSON.stringify(localEvent) === localBefore,
  );
  const migrationAnswers = answersFrom({
    status: 'dating',
    target: {
      ...createEmptyTargetProfile(),
      relation: 'talking',
      events: [
        { id: 'evt-ok-1', type: 'closer', description: '같이 산책하면서 오래 이야기했어' },
        localEvent,
        { id: 'evt-ok-2', type: 'meeting', description: '처음 만난 날 많이 긴장했어' },
      ],
    },
  });
  const migrationSnapshot: LocalDataSnapshot = { answers: migrationAnswers, history: [], registry: createTargetRegistry() };
  const migrationBefore = JSON.stringify(migrationSnapshot);
  const migrationDb = createMemoryDatabase();
  const migrationGateway = createMemoryGateway(migrationDb, USER_A);
  const migration = await migrateLocalData({ gateway: migrationGateway, snapshot: migrationSnapshot, consent: true });
  c.check(
    'STORAGE-06 · migration — 큰 사건 하나만 거부 · 나머지 저장 · completed_with_rejections',
    migration.status === 'completed_with_rejections' &&
      migration.rejected.length === 1 &&
      migration.rejected[0]?.entity === 'event' &&
      migration.created.events === 2,
    migration,
  );
  c.check('STORAGE-06 · migration 뒤 로컬 데이터 불변', JSON.stringify(migrationSnapshot) === migrationBefore);
  const migrationRetry = await migrateLocalData({ gateway: migrationGateway, snapshot: migrationSnapshot, consent: true });
  c.check(
    'STORAGE-06 · 재시도 — 같은 항목만 다시 거부 · 중복 없음',
    migrationRetry.rejected.length === 1 && migrationDb.tables.relationship_events.length === 2,
    migrationRetry,
  );

  /* STORAGE-07 */
  const normal = await events.createIfAbsent(targetId, { type: 'closer', description: '보통 길이의 장면이야' });
  if (normal.ok) {
    const oversizeUpdate = await events.update(normal.value.event.id, { description: huge }, 1);
    const row = db.tables.relationship_events.find((item) => item.id === normal.value.event.id);
    c.check(
      'STORAGE-07 · oversize 수정은 실패 · 기존 cloud row(본문 · revision) 손상 없음',
      oversizeUpdate.status === 'failed' &&
        oversizeUpdate.error.kind === 'payload_rejected' &&
        row?.description === '보통 길이의 장면이야' &&
        row.revision === 1,
      oversizeUpdate,
    );
  } else {
    c.check('STORAGE-07 · 기준 사건 생성', false, normal.error);
  }
  const bloated = await targets.update(
    targetId,
    {
      data: {
        ...emptyContext,
        savedQuestions: Array.from({ length: 500 }, (_, index) => `contact_${index}`) as unknown as TargetContextData['savedQuestions'],
      },
    },
    1,
  );
  const targetAfter = db.tables.relationship_targets.find((row) => row.id === targetId);
  c.check(
    'STORAGE-07 · 비정상적으로 큰 상대 수정도 실패 · 기존 target row 그대로',
    bloated.status === 'failed' &&
      bloated.error.kind === 'payload_rejected' &&
      targetAfter?.revision === 1 &&
      !JSON.stringify(targetAfter.target_json).includes('contact_499'),
    bloated,
  );

  /* STORAGE-08 */
  const longNormal = '오늘 있었던 일을 차근차근 길게 적어봤어. '.repeat(90).trim();
  const normalWrite = await events.createIfAbsent(targetId, {
    type: 'other',
    description: longNormal,
    myReaction: '적고 나니 조금 정리됐어',
  });
  const labelWrite = await targets.createIfAbsent({ label: '민트초코', relationStatus: 'dating', data: emptyContext });
  c.check(
    `STORAGE-08 · 정상 텍스트 write 통과(긴 사건 ${[...longNormal].length}자 포함)`,
    normalWrite.ok && normalWrite.value.created && labelWrite.ok && labelWrite.value.created,
    { normalWrite, labelWrite },
  );

  /* STORAGE-09 */
  const photoAnswers = answersFrom({
    status: 'dating',
    photos: [{ id: 'photo-1', label: 'fixture', source: 'upload', objectUrl: 'blob:http://localhost/1' }] as unknown as SessionAnswers['photos'],
    observedAnalysis: {
      meta: { mode: 'real' },
      traits: [{ id: 't1', evidence: [{ imageId: 'photo-1', description: 'x' }] }],
    } as unknown as SessionAnswers['observedAnalysis'],
    target: {
      ...createEmptyTargetProfile(),
      relation: 'talking',
      photoUrl: TINY_PNG,
      thumbnail: TINY_PNG,
      events: [{ id: 'evt-photo', type: 'other', description: '사진을 같이 찍었던 날' }],
    } as unknown as SessionAnswers['target'],
  });
  const photoDb = createMemoryDatabase();
  const photoMigration = await migrateLocalData({
    gateway: createMemoryGateway(photoDb, USER_A),
    snapshot: { answers: photoAnswers, history: [], registry: createTargetRegistry() },
    consent: true,
  });
  const photoStored = JSON.stringify(photoDb.tables);
  c.check(
    'STORAGE-09 · migration에서 사진 · 이미지 필드 제거(계정 행 어디에도 없음)',
    photoMigration.status === 'completed' &&
      !/data:image|blob:|base64|objectUrl|photoUrl|thumbnail|"photos"|observedAnalysis|imageId/i.test(photoStored) &&
      photoDb.tables.relationship_events.length === 1,
    { status: photoMigration.status, rejected: photoMigration.rejected },
  );

  /* 예산 ↔ SQL CHECK */
  const sql = await readFile(
    join(process.cwd(), 'supabase', 'migrations', '20260914000000_v147_persistence_foundation.sql'),
    'utf8',
  );
  const sqlLimits = {
    eventText: Number(/char_length\(description\) between 1 and (\d+)/.exec(sql)?.[1]),
    label: Number(/char_length\(label\) between 1 and (\d+)/.exec(sql)?.[1]),
    profileJson: Number(/pg_column_size\(profile_json\) <= (\d+)/.exec(sql)?.[1]),
    targetJson: Number(/pg_column_size\(target_json\) <= (\d+)/.exec(sql)?.[1]),
    snapshot: Number(/pg_column_size\(result_snapshot\) <= (\d+)/.exec(sql)?.[1]),
  };
  c.check(
    'CLOUD_WRITE_BUDGET이 DB CHECK와 같거나 더 엄격하다(앱이 먼저 멈춰 이유를 말한다)',
    CLOUD_WRITE_BUDGET.maxTextChars.eventText <= sqlLimits.eventText &&
      CLOUD_WRITE_BUDGET.maxTextChars.label <= sqlLimits.label &&
      CLOUD_WRITE_BUDGET.maxRowBytes.user_profiles <= sqlLimits.profileJson &&
      CLOUD_WRITE_BUDGET.maxRowBytes.relationship_targets <= sqlLimits.targetJson &&
      CLOUD_WRITE_BUDGET.maxRowBytes.analysis_runs <= sqlLimits.snapshot,
    sqlLimits,
  );

  const sample = answersFrom(body.answers);
  const sampleTargetId = newUuid();
  const sampleEvent: RelationshipEvent = sample.target.events[0] ?? { id: 'evt-sample', type: 'other', description: scenes[0]! };
  const bytesMigration = await migrateLocalData({
    gateway: createMemoryGateway(createMemoryDatabase(), USER_A),
    snapshot: { answers: sample, history: body.history ?? [], registry: createTargetRegistry(sampleTargetId) },
    consent: true,
  });
  const info = {
    profilePayloadBytes: estimateUtf8Bytes(profileRowOf(USER_A, selfProfileFromSession(sample))),
    targetPayloadBytes: estimateUtf8Bytes(
      targetRowOf(USER_A, { id: sampleTargetId, label: null, relationStatus: sample.status, data: targetContextFromSession(sample) }),
    ),
    eventPayloadBytes: estimateUtf8Bytes(eventRowOf(USER_A, sampleTargetId, newUuid(), sampleEvent)),
    analysisPayloadBytes: estimateUtf8Bytes(runRowOf(USER_A, { id: newUuid(), ...deepRun, idempotencyKey: '0'.repeat(64) })),
    migrationBatchBytes: bytesMigration.bytes,
  };
  c.check(
    'bytes — 측정값이 채워지고 모두 행 예산 안이다',
    info.profilePayloadBytes > 0 &&
      info.profilePayloadBytes <= CLOUD_WRITE_BUDGET.maxRowBytes.user_profiles &&
      info.targetPayloadBytes <= CLOUD_WRITE_BUDGET.maxRowBytes.relationship_targets &&
      info.eventPayloadBytes <= CLOUD_WRITE_BUDGET.maxRowBytes.relationship_events &&
      info.analysisPayloadBytes <= CLOUD_WRITE_BUDGET.maxRowBytes.analysis_runs &&
      bytesMigration.bytes.total > 0,
    info,
  );
  return { checks: c.checks, info };
}

async function scenarioStorageScale(body: PersistenceTestRequest) {
  const c = checker();
  const info: Record<string, Record<string, unknown>> = {};
  const snapshotBytes: number[] = [];
  const eventBytes: number[] = [];
  for (const count of [10, 100, 500]) {
    const scaled: RelationshipEvent[] = Array.from({ length: count }, (_, index) => ({
      id: `evt-scale-${index}`,
      type: 'conflict',
      description: `장면 ${index}: 얘기가 엇갈린 다음에 한동안 답이 없던 날이 있었어`,
      myReaction: `반응 ${index}: 먼저 연락하지 못하고 기다렸어`,
    }));
    const answers = answersFrom({ ...body.answers, target: { ...createEmptyTargetProfile(), relation: 'talking', events: scaled } });
    const registry = createTargetRegistry();
    const db = createMemoryDatabase();
    const gw = createMemoryGateway(db, USER_A);
    const migration = await migrateLocalData({
      gateway: gw,
      snapshot: { answers, history: body.history ?? [], registry },
      consent: true,
    });
    const storedIds = db.tables.relationship_events.map((row) => row.id);
    const run = deepReportRunInput({
      targetId: migration.links[0]?.cloudTargetId ?? null,
      report: syntheticDeepReport(storedIds.slice(0, 3), scaled.map((event) => event.description)),
      promptVersion: 'deep-report-v13-uncertainty-move',
      model: 'gpt-5.4',
      sourceFingerprint: null,
      generationRequestId: `gen-scale-${count}`,
    });
    const recorded = await createAnalysisRunRepository(gw).recordGenerated({
      ...run,
      forbiddenTexts: scaled.flatMap((event) => [event.description, event.myReaction ?? '']),
    });
    const runsJson = JSON.stringify(db.tables.analysis_runs);
    const deepBytes = estimateUtf8Bytes(db.tables.analysis_runs.find((row) => recorded.ok && row.id === recorded.value.run.id)?.result_snapshot);
    snapshotBytes.push(deepBytes);
    eventBytes.push(migration.bytes.events);
    c.check(
      `[${count} events] 사건 행 ${count} · migration completed`,
      migration.status === 'completed' && db.tables.relationship_events.length === count,
      migration.status,
    );
    c.check(
      `[${count} events] analysis_runs에 사건 원문 · 반응 0`,
      recorded.ok &&
        scaled.every((event) => !runsJson.includes(event.description) && !runsJson.includes(event.myReaction ?? '∅')),
      recorded.ok ? null : recorded.error,
    );
    info[`events_${count}`] = {
      eventRowsBytes: migration.bytes.events,
      historyRunsBytes: migration.bytes.analysisRuns,
      deepReportSnapshotBytes: deepBytes,
      migrationBatchBytes: migration.bytes.total,
    };
  }
  c.check(
    'analysis snapshot 크기는 사건 수에 비례해 늘지 않는다(10 → 500 증가 < 1KB)',
    snapshotBytes[2]! - snapshotBytes[0]! < 1024,
    snapshotBytes,
  );
  c.check('사건 저장량은 사건 행에서만 늘어난다(10 < 100 < 500)', eventBytes[0]! < eventBytes[1]! && eventBytes[1]! < eventBytes[2]!, eventBytes);
  return { checks: c.checks, info };
}

/* ══════════════════════════════════════════════════════════════════ analysis run policy · idempotency */

const POLICY_SCENES = ['얘기가 엇갈린 다음에 아무 답이 없던 날이 힘들었어', '같이 산책하면서 오래 이야기했어'];
const POLICY_REACTION = '먼저 연락하지 못하고 기다렸어';

async function seedRelationship(gw: PersistenceGateway, scenes: readonly string[]) {
  const target = await createRelationshipTargetRepository(gw).createIfAbsent({
    label: null,
    relationStatus: 'dating',
    data: targetContextFromSession(createEmptyAnswers()),
  });
  if (!target.ok) return null;
  const eventIds: string[] = [];
  for (const scene of scenes) {
    const saved = await createRelationshipEventRepository(gw).createIfAbsent(target.value.target.id, {
      type: 'conflict',
      description: scene,
      myReaction: POLICY_REACTION,
    });
    if (saved.ok) eventIds.push(saved.value.event.id);
  }
  return { targetId: target.value.target.id, eventIds };
}

async function scenarioAnalysisPolicy() {
  const c = checker();
  const db = createMemoryDatabase();
  const gw = createMemoryGateway(db, USER_A);
  const seeded = await seedRelationship(gw, POLICY_SCENES);
  if (!seeded) {
    c.check('analysis policy — 기준 관계 생성', false);
    return c.checks;
  }
  const runs = createAnalysisRunRepository(gw);
  const forbiddenTexts = [...POLICY_SCENES, POLICY_REACTION];
  const input = deepReportRunInput({
    targetId: seeded.targetId,
    report: syntheticDeepReport(seeded.eventIds, POLICY_SCENES),
    promptVersion: 'deep-report-v13-uncertainty-move',
    model: 'gpt-5.4',
    sourceFingerprint: 'dr_fixture',
    generationRequestId: 'gen-1',
  });
  c.check(
    'ANALYSIS-01 · snapshot 최상위 = renderedResult · candidateIds · usedEvidenceRefs · usedEventIds',
    Object.keys(input.snapshot).sort().join(',') === [...DEEP_REPORT_SNAPSHOT_KEYS].sort().join(',') &&
      Object.keys(input.snapshot).sort().join(',') === 'candidateIds,renderedResult,usedEventIds,usedEvidenceRefs',
    Object.keys(input.snapshot),
  );
  const first = await runs.recordGenerated({ ...input, forbiddenTexts });
  if (!first.ok) {
    c.check('ANALYSIS-02 · 저장', false, first.error);
    return c.checks;
  }
  const row = db.tables.analysis_runs[0];
  c.check(
    'ANALYSIS-02 · 행 칸 = id · target · type · snapshot · fingerprint · prompt_version · model · app_version · created_at (+ user_id · idempotency_key)',
    Boolean(row) &&
      Object.keys(row!).sort().join(',') ===
        'analysis_type,app_version,created_at,id,idempotency_key,model,prompt_version,result_snapshot,source_fingerprint,target_id,user_id' &&
      row!.model === 'gpt-5.4' &&
      row!.prompt_version === 'deep-report-v13-uncertainty-move' &&
      row!.source_fingerprint === 'dr_fixture' &&
      row!.app_version !== null,
    row,
  );
  const stored = JSON.stringify(db.tables.analysis_runs);
  c.check(
    'ANALYSIS-03 · Target/Profile 전체 JSON · 사건 본문 · 반응 · prompt · raw · 사진 · debug 없음 (사건은 id로만)',
    !/target_json|profile_json|"prompt"|"raw|choices|photos|data:image|"debug/.test(stored) &&
      forbiddenTexts.every((text) => !stored.includes(text)) &&
      seeded.eventIds.every((id) => stored.includes(id)),
  );
  c.check(
    'ANALYSIS-04 · 새 분석 id = 새 random UUID(v4)',
    first.value.created && isUuid(first.value.run.id) && first.value.run.id[14] === '4',
    first.value.run.id,
  );
  const key = first.value.run.idempotencyKey ?? '';
  c.check(
    'ANALYSIS-05 · idempotency_key = sha256 hex · 요청 id 원문이 행에 남지 않는다',
    /^[0-9a-f]{64}$/.test(key) && !stored.includes('gen-1'),
    key,
  );

  const retry = await runs.recordGenerated({ ...input, forbiddenTexts });
  c.check(
    'IDEMP-01 · 같은 retry(같은 generationRequestId) → 새 행 없음 · 같은 run',
    retry.ok && !retry.value.created && retry.value.run.id === first.value.run.id && db.tables.analysis_runs.length === 1,
    retry,
  );
  const again = await runs.recordGenerated({ ...input, generationRequestId: 'gen-2', forbiddenTexts });
  c.check(
    'IDEMP-02 · 사용자가 다시 분석(new generationRequestId) → 새 UUID · 새 행',
    again.ok && again.value.created && again.value.run.id !== first.value.run.id && db.tables.analysis_runs.length === 2,
    again,
  );
  const changed = await runs.recordGenerated({ ...input, sourceFingerprint: 'dr_changed', forbiddenTexts });
  c.check(
    'IDEMP-03 · 입력 지문이 바뀌면 같은 요청 id라도 다른 키 → 새 행',
    changed.ok && changed.value.created && db.tables.analysis_runs.length === 3,
    changed,
  );
  const race = await gw.insertIfAbsent(
    'analysis_runs',
    runRowOf(USER_A, {
      id: newUuid(),
      targetId: seeded.targetId,
      type: 'deep_report',
      snapshot: { candidateIds: [] },
      sourceFingerprint: 'dr_fixture',
      promptVersion: null,
      model: null,
      idempotencyKey: key,
    }),
  );
  c.check(
    'IDEMP-04 · UNIQUE(user_id, idempotency_key) — 같은 키의 두 번째 INSERT는 conflict · 행 수 그대로',
    !race.ok && race.error.kind === 'conflict' && db.tables.analysis_runs.length === 3,
    race,
  );
  const gwB = createMemoryGateway(db, USER_B);
  const seededB = await seedRelationship(gwB, ['B가 적어둔 장면 하나가 있어']);
  const otherUser = seededB
    ? await createAnalysisRunRepository(gwB).recordGenerated(
        deepReportRunInput({
          targetId: seededB.targetId,
          report: syntheticDeepReport(seededB.eventIds, []),
          promptVersion: 'deep-report-v13-uncertainty-move',
          model: 'gpt-5.4',
          sourceFingerprint: 'dr_fixture',
          generationRequestId: 'gen-1',
        }),
      )
    : null;
  c.check(
    'IDEMP-05 · 다른 사용자의 같은 요청 id는 키가 달라 서로 막지 않는다',
    Boolean(otherUser?.ok && otherUser.value.created && otherUser.value.run.idempotencyKey !== key),
    otherUser,
  );
  const missing = await runs.recordGenerated({ ...input, generationRequestId: '  ', forbiddenTexts });
  c.check('IDEMP-06 · generationRequestId가 없으면 저장하지 않는다(invalid)', !missing.ok && missing.error.kind === 'invalid', missing);
  const promptLeak = await runs.recordGenerated({
    ...input,
    generationRequestId: 'gen-leak',
    snapshot: { ...input.snapshot, prompt: 'system prompt' },
  });
  c.check('ANALYSIS-03 · prompt를 섞은 snapshot은 저장 거부', !promptLeak.ok, promptLeak);
  return c.checks;
}

/* ══════════════════════════════════════════════════════════════════ cross-account · local/cloud id (§12) */

function activeTargetOf(snapshot: LocalDataSnapshot): PlannedTarget | null {
  return planLocalMigration(snapshot).targets.find((item) => item.active) ?? null;
}

async function scenarioCrossAccount(body: PersistenceTestRequest) {
  const c = checker();
  const answers = answersFrom(body.answers);
  const registry = createTargetRegistry();
  const snapshot: LocalDataSnapshot = { answers, history: body.history ?? [], registry };
  const localTargetId = registry.activeTargetId;
  const localTarget = activeTargetOf(snapshot);
  if (!localTarget) {
    c.check('cross-account — 로컬 상대 준비', false);
    return c.checks;
  }
  const db = createMemoryDatabase();
  const gwA = createMemoryGateway(db, USER_A);
  const gwB = createMemoryGateway(db, USER_B);
  let links = createCloudLinks();

  const guest = analysisSaveDecision({ userId: null, localTargetId, links });
  c.check('Guest — 분석 결과는 local only(cloud 저장 결정 없음)', !guest.save && guest.reason === 'guest');
  const beforeConsent = analysisSaveDecision({ userId: USER_A, localTargetId, links });
  c.check(
    '로그인만으로는 저장하지 않는다(관계 저장 동의 전 · 0행)',
    !beforeConsent.save && beforeConsent.reason === 'relationship_not_saved' && totalRows(db) === 0,
  );

  const a = await migrateLocalData({
    gateway: gwA,
    snapshot,
    consent: true,
    existingCloudIds: cloudIdsForUser(links, USER_A),
    expectedUserId: USER_A,
  });
  links = applyMigrationLinks(links, USER_A, a.links, NOW);
  const linkA = linkOf(links, USER_A, localTargetId);
  c.check(
    'ACCOUNT-01 · User A — 동의 후 저장 · (userId, localTargetId) → cloudTargetId link 기록',
    a.status === 'completed' && a.created.targets === 1 && linkA !== null && linkA.cloudTargetId !== localTargetId,
    { status: a.status, links: a.links },
  );
  const rowsAfterA = JSON.stringify(rowCounts(db));

  const decisionB = analysisSaveDecision({ userId: USER_B, localTargetId, links });
  const noConsentB = await saveRelationshipToCloud({ gateway: gwB, userId: USER_B, links, target: localTarget });
  c.check(
    'ACCOUNT-05 · 같은 기기에서 User B 로그인 — A의 link를 쓰지 않고 자동 복사 · 자동 저장하지 않는다',
    !decisionB.save &&
      decisionB.reason === 'relationship_not_saved' &&
      noConsentB.status === 'consent_required' &&
      JSON.stringify(rowCounts(db)) === rowsAfterA,
    { decisionB, status: noConsentB.status },
  );
  const wrongSession = await saveRelationshipToCloud({
    gateway: gwA,
    userId: USER_B,
    links: (await grantRelationshipSave(links, USER_B, localTargetId, NOW)).state,
    target: localTarget,
  });
  c.check(
    'ACCOUNT-05 · B의 동의로 A 세션에 저장하려 하면 멈춘다(세션 사용자 불일치)',
    wrongSession.status === 'unauthorized' && JSON.stringify(rowCounts(db)) === rowsAfterA,
    wrongSession.status,
  );

  const granted = await grantRelationshipSave(links, USER_B, localTargetId, NOW);
  links = granted.state;
  const b = await saveRelationshipToCloud({ gateway: gwB, userId: USER_B, links, target: localTarget });
  const linkB = linkOf(links, USER_B, localTargetId);
  c.check(
    'ACCOUNT-02 · User B — 명시 동의 뒤에만 새 cloud id로 저장',
    granted.created && b.status === 'completed' && b.created.targets === 1 && b.created.events === localTarget.events.length,
    { status: b.status, created: b.created },
  );
  c.check(
    'ACCOUNT-03 · 같은 localTargetId라도 A · B cloud id가 다르다(사건 id도 겹치지 않는다)',
    linkA !== null &&
      linkB !== null &&
      linkA.cloudTargetId !== linkB.cloudTargetId &&
      db.tables.relationship_targets.find((row) => row.id === linkA.cloudTargetId)?.user_id === USER_A &&
      db.tables.relationship_targets.find((row) => row.id === linkB.cloudTargetId)?.user_id === USER_B &&
      new Set(db.tables.relationship_events.map((row) => row.id)).size === db.tables.relationship_events.length,
    { linkA, linkB },
  );

  const bSees = await Promise.all(TABLES.map((table) => gwB.select(table, {})));
  const aCloudId = linkA?.cloudTargetId ?? '';
  const bLoadsA = await loadSavedRelationship(gwB, aCloudId);
  const bRemovesA = await createRelationshipTargetRepository(gwB).remove(aCloudId);
  const bUpdatesA = await gwB.updateAtRevision('relationship_targets', aCloudId, 1, { label: 'hijack' });
  const aTargetRow = db.tables.relationship_targets.find((row) => row.id === aCloudId);
  c.check(
    'ACCOUNT-04 · A 데이터는 B에게 보이지 않고(SELECT · load) 수정 · 삭제도 되지 않는다',
    bSees.every((rows) => rows.ok && (rows.value as { user_id: string }[]).every((row) => row.user_id === USER_B)) &&
      bLoadsA.ok &&
      bLoadsA.value === null &&
      bRemovesA.ok &&
      !bRemovesA.value.removed &&
      bUpdatesA.ok &&
      bUpdatesA.value === null &&
      aTargetRow?.user_id === USER_A &&
      aTargetRow.revision === 1 &&
      aTargetRow.label !== 'hijack',
    { bLoadsA, bRemovesA, bUpdatesA },
  );

  const forgotten = forgetUser(links, USER_B);
  c.check(
    '계정 저장분 삭제 뒤 — 그 사용자의 link만 지운다(A link 유지)',
    linkOf(forgotten, USER_B, localTargetId) === null && linkOf(forgotten, USER_A, localTargetId) !== null,
  );
  const restored = sanitizeCloudLinks(JSON.parse(JSON.stringify(links)));
  const corrupted = sanitizeCloudLinks({
    version: 1,
    byUser: { 'not-a-uuid': { x: { cloudTargetId: 'y', consentedAt: NOW } }, [USER_A]: { [localTargetId]: { cloudTargetId: 'bad' } } },
  });
  c.check(
    'link 저장 형태 — 새로고침(직렬화) 뒤에도 같고, 손상된 값은 버린다',
    JSON.stringify(restored) === JSON.stringify(links) && Object.keys(corrupted.byUser).length === 0,
  );
  return c.checks;
}

/* ══════════════════════════════════════════════════════════════════ saved relationship smoke (§15) */

async function scenarioSavedRelationship(body: PersistenceTestRequest) {
  const c = checker();
  const answers = answersFrom(body.answers);
  const registry = createTargetRegistry();
  const snapshot: LocalDataSnapshot = { answers, history: [], registry };
  const localBefore = JSON.stringify(snapshot);
  const localTarget = activeTargetOf(snapshot);
  if (!localTarget) {
    c.check('saved relationship — 로컬 상대 준비', false);
    return c.checks;
  }
  const events = localTarget.events;
  const sceneTexts = events.flatMap((event) => [event.description, event.myReaction ?? '']);
  const db = createMemoryDatabase();
  const gw = createMemoryGateway(db, null);
  let links = createCloudLinks();

  c.check(
    'SAVE-01 · Guest local data — 로그인 전에는 저장 결정도 요청도 없다',
    !analysisSaveDecision({ userId: null, localTargetId: localTarget.id, links }).save && totalRows(db) === 0,
  );

  gw.setUser(USER_A);
  const noConsent = await saveRelationshipToCloud({ gateway: gw, userId: USER_A, links, target: localTarget });
  c.check('SAVE-02 · login만으로는 저장하지 않는다(consent_required · 0행)', noConsent.status === 'consent_required' && totalRows(db) === 0);

  links = (await grantRelationshipSave(links, USER_A, localTarget.id, NOW)).state;
  const saved = await saveRelationshipToCloud({ gateway: gw, userId: USER_A, links, target: localTarget });
  const cloudTargetId = linkOf(links, USER_A, localTarget.id)?.cloudTargetId ?? '';
  c.check(
    'SAVE-03 · 명시 동의 → cloud save(상대 1 · 사건 전부)',
    saved.status === 'completed' && saved.created.targets === 1 && saved.created.events === events.length,
    saved,
  );

  const storedEventIds = db.tables.relationship_events.filter((row) => row.target_id === cloudTargetId).map((row) => row.id);
  const decision = analysisSaveDecision({ userId: USER_A, localTargetId: localTarget.id, links });
  const runOf = (generationRequestId: string) =>
    deepReportRunInput({
      targetId: null,
      report: syntheticDeepReport(storedEventIds.slice(0, 2), events.map((event) => event.description)),
      promptVersion: 'deep-report-v13-uncertainty-move',
      model: 'gpt-5.4',
      sourceFingerprint: 'dr_saved',
      generationRequestId,
    });
  const firstRun = await recordAnalysisForRelationship({ gateway: gw, decision, run: runOf('gen-a'), forbiddenTexts: sceneTexts });
  const secondRun = await recordAnalysisForRelationship({ gateway: gw, decision, run: runOf('gen-b'), forbiddenTexts: sceneTexts });
  c.check(
    'SAVE-04 · 저장한 관계의 성공한 분석은 다시 묻지 않고 그 관계에 snapshot(분석마다 새 행)',
    decision.save &&
      firstRun.status === 'recorded' &&
      secondRun.status === 'recorded' &&
      firstRun.run.id !== secondRun.run.id &&
      db.tables.analysis_runs.length === 2 &&
      db.tables.analysis_runs.every((row) => row.target_id === cloudTargetId),
    { firstRun, secondRun },
  );

  gw.setUser(null);
  const whileOut = await loadSavedRelationship(gw, cloudTargetId);
  c.check(
    'SAVE-05 · logout — 계정 데이터를 읽을 수 없다(unauthorized) · 로컬 데이터 불변',
    !whileOut.ok && whileOut.error.kind === 'unauthorized' && JSON.stringify(snapshot) === localBefore,
  );

  gw.setUser(USER_A);
  const listed = await createRelationshipTargetRepository(gw).listSummaries();
  const loaded = await loadSavedRelationship(gw, cloudTargetId);
  const value = loaded.ok ? loaded.value : null;
  c.check(
    'SAVE-06 · login → 저장한 관계가 목록에 보인다(마지막 분석 시각 포함)',
    listed.ok && listed.value.length === 1 && listed.value[0]?.id === cloudTargetId && listed.value[0]?.lastAnalysisAt !== null,
    listed,
  );
  c.check('SAVE-07 · load saved target — 상대 정보가 같다', value !== null && sameContent(value.target.data, localTarget.data), value?.target);
  c.check(
    'SAVE-08 · events preserved — 순서 · 종류 · 본문 · 반응',
    value !== null &&
      JSON.stringify(value.events.map((item) => [item.event.type, item.event.description, item.event.myReaction ?? null])) ===
        JSON.stringify(events.map((event) => [event.type, event.description.trim(), event.myReaction?.trim() || null])),
    value?.events.length,
  );
  const latest = value?.latestAnalysis ?? null;
  c.check(
    'SAVE-09 · analysis snapshot preserved — 최근 분석 = 마지막 저장 · 참조 event id가 저장된 사건',
    latest !== null &&
      secondRun.status === 'recorded' &&
      latest.id === secondRun.run.id &&
      sameContent(latest.snapshot, secondRun.run.snapshot) &&
      (latest.snapshot.usedEventIds as string[]).every((id) => value?.events.some((item) => item.id === id)),
    latest,
  );
  const rebuilt = value
    ? sessionWithCloudContext(createEmptyAnswers(), { profile: null, target: value.target.data, events: value.events.map((item) => item.event) })
    : null;
  c.check('SAVE-10 · 불러온 관계로 세션을 다시 만들 수 있다(사건 수 동일)', rebuilt !== null && rebuilt.target.events.length === events.length);
  return c.checks;
}

/* ══════════════════════════════════════════════════════════════════ A → B → A isolation (§16) */

async function scenarioAccountSwitch(body: PersistenceTestRequest) {
  const c = checker();
  const db = createMemoryDatabase();
  const gw = createMemoryGateway(db, USER_A);
  /* 같은 기기 · 같은 로컬 상대 슬롯을 두 계정이 번갈아 쓴다 */
  const registry = createTargetRegistry();
  const base = answersFrom(body.answers);
  let links = createCloudLinks();

  const saveAs = async (userId: string, index: number) => {
    gw.setUser(userId);
    const target = activeTargetOf({ answers: targetAnswers(base, index), history: [], registry });
    if (!target) return null;
    links = (await grantRelationshipSave(links, userId, target.id, NOW)).state;
    const saved = await saveRelationshipToCloud({ gateway: gw, userId, links, target });
    const cloudTargetId = linkOf(links, userId, target.id)?.cloudTargetId ?? '';
    const eventIds = db.tables.relationship_events.filter((row) => row.target_id === cloudTargetId).map((row) => row.id);
    const run = await recordAnalysisForRelationship({
      gateway: gw,
      decision: analysisSaveDecision({ userId, localTargetId: target.id, links }),
      run: deepReportRunInput({
        targetId: null,
        report: syntheticDeepReport(eventIds, []),
        promptVersion: 'deep-report-v13-uncertainty-move',
        model: 'gpt-5.4',
        sourceFingerprint: `dr_${index}`,
        generationRequestId: `gen-${index}`,
      }),
      forbiddenTexts: target.events.flatMap((event) => [event.description, event.myReaction ?? '']),
    });
    return { saved, cloudTargetId, runId: run.status === 'recorded' ? run.run.id : null };
  };

  const view = async (userId: string): Promise<(SavedRelationship | null)[]> => {
    gw.setUser(userId);
    const targets = await createRelationshipTargetRepository(gw).list();
    const loaded = await Promise.all((targets.ok ? targets.value : []).map((target) => loadSavedRelationship(gw, target.id)));
    return loaded.map((item) => (item.ok ? item.value : null));
  };

  const isolated = (relationships: readonly (SavedRelationship | null)[], index: number, runId: string | null, fingerprint: string) => {
    const [only] = relationships;
    return (
      relationships.length === 1 &&
      only !== null &&
      only !== undefined &&
      eventsBelongTo(only.events.map((item) => item.event), index) &&
      runId !== null &&
      only.latestAnalysis?.id === runId &&
      only.latestAnalysis.sourceFingerprint === fingerprint
    );
  };

  const a = await saveAs(USER_A, 0);
  const aFirst = await view(USER_A);
  const b = await saveAs(USER_B, 1);
  const bView = await view(USER_B);
  const aAgain = await view(USER_A);

  c.check(
    'A — Target · Events · Latest analysis가 A 것',
    a !== null && a.saved.status === 'completed' && isolated(aFirst, 0, a.runId, 'dr_0'),
    aFirst,
  );
  c.check(
    'A → B — B는 자기 Target · Events · Latest analysis만 본다',
    b !== null && b.saved.status === 'completed' && isolated(bView, 1, b.runId, 'dr_1'),
    bView,
  );
  c.check(
    'A → B → A — A의 Target · Events · Latest analysis가 처음과 같다(B 기록 섞임 0)',
    a !== null && isolated(aAgain, 0, a.runId, 'dr_0') && JSON.stringify(aAgain) === JSON.stringify(aFirst),
  );
  c.check('같은 로컬 슬롯이라도 계정별 cloud id가 다르다', a !== null && b !== null && a.cloudTargetId !== b.cloudTargetId);
  const aEvents = JSON.stringify(db.tables.relationship_events.filter((row) => row.user_id === USER_A));
  const bEvents = JSON.stringify(db.tables.relationship_events.filter((row) => row.user_id === USER_B));
  c.check('A 사건 행에 B 본문 없음 · B 사건 행에 A 본문 없음', !aEvents.includes('T1 ') && !bEvents.includes('T0 '));
  return c.checks;
}

/* ══════════════════════════════════════════════════════════════════ v1.47 Integration — logical run (GEN) */

const FLOW_FORBIDDEN = [...POLICY_SCENES, POLICY_REACTION];

async function scenarioLogicalRun() {
  const c = checker();
  let counter = 0;
  const runs = createLogicalRunRegistry(() => `00000000-0000-4000-8000-${String((counter += 1)).padStart(12, '0')}`);
  const fingerprint = 'dr_logical';
  const initial = runs.begin(fingerprint);
  const retry1 = runs.begin(fingerprint);
  const retry2 = runs.begin(fingerprint);
  c.check('GEN-01 · initial + retry 1 + retry 2 → 같은 generationRequestId', initial === retry1 && retry1 === retry2, {
    initial,
    retry1,
    retry2,
  });

  const db = createMemoryDatabase();
  const gw = createMemoryGateway(db, USER_A);
  const seeded = await seedRelationship(gw, POLICY_SCENES);
  if (!seeded) {
    c.check('GEN — 기준 관계 생성', false);
    return c.checks;
  }
  const keyOf = (generationRequestId: string) =>
    analysisIdempotencyKeyOf({
      userId: USER_A,
      targetId: seeded.targetId,
      analysisType: 'deep_report',
      sourceFingerprint: fingerprint,
      generationRequestId,
    });
  c.check('GEN-02 · 같은 logical run → 같은 idempotencyKey', (await keyOf(initial)) === (await keyOf(retry2)));

  const repo = createAnalysisRunRepository(gw);
  const inputFor = (generationRequestId: string) =>
    deepReportRunInput({
      targetId: seeded.targetId,
      report: syntheticDeepReport(seeded.eventIds, POLICY_SCENES),
      promptVersion: 'deep-report-v13-uncertainty-move',
      model: 'gpt-5.4',
      sourceFingerprint: fingerprint,
      generationRequestId,
    });
  /* 네트워크 retry — 서버 requestId는 요청마다 다르다. 저장 입력에는 logical run id만 들어간다 */
  const attempts: { serverRequestId: string; created: boolean }[] = [];
  for (const serverRequestId of ['req_first', 'req_retry_1', 'req_retry_2']) {
    const saved = await repo.recordGenerated({ ...inputFor(runs.begin(fingerprint)), forbiddenTexts: FLOW_FORBIDDEN });
    attempts.push({ serverRequestId, created: saved.ok && saved.value.created });
  }
  c.check(
    'GEN-03 · 같은 logical run의 retry → analysis_run 1개',
    attempts.filter((item) => item.created).length === 1 && db.tables.analysis_runs.length === 1,
    attempts,
  );
  c.check(
    'GEN-06 · 서버 requestId가 달라도 duplicate 아님 · 행에 서버 requestId가 남지 않는다',
    new Set(attempts.map((item) => item.serverRequestId)).size === 3 &&
      db.tables.analysis_runs.length === 1 &&
      !JSON.stringify(db.tables.analysis_runs).includes('req_'),
  );

  runs.close(fingerprint);
  const rerun = runs.begin(fingerprint);
  c.check('GEN-04 · 결과가 확정된 뒤 사용자가 다시 분석 → 새 generationRequestId', rerun !== initial, { initial, rerun });
  const rerunSaved = await repo.recordGenerated({ ...inputFor(rerun), forbiddenTexts: FLOW_FORBIDDEN });
  c.check(
    'GEN-05 · 다시 분석 → 새 analysis_run',
    rerunSaved.ok && rerunSaved.value.created && db.tables.analysis_runs.length === 2,
    rerunSaved,
  );
  c.check('GEN · 입력(지문)이 다르면 다른 logical run', runs.begin('dr_other_input') !== rerun && runs.peek(fingerprint) === rerun);
  return c.checks;
}

/* ══════════════════════════════════════════════════════════════════ v1.47 Integration — save relationship UI (SAVE-UI) */

async function scenarioSaveRelationshipUi(body: PersistenceTestRequest) {
  const c = checker();
  const answers = answersFrom(body.answers);
  const registry = createTargetRegistry();
  const base = {
    hasValue: true,
    hasTargetContext: true,
    linked: false,
    intent: 'none' as const,
    saving: false,
    failed: false,
  };
  c.check(
    'SAVE-UI-01 · 결과를 보기 전 · Supabase 없음 → CTA 없음 / 결과를 본 Guest → CTA',
    saveRelationshipStage({ ...base, accountStatus: 'signed_out', hasValue: false }) === 'hidden' &&
      saveRelationshipStage({ ...base, accountStatus: 'disabled' }) === 'hidden' &&
      saveRelationshipStage({ ...base, accountStatus: 'signed_out' }) === 'offer' &&
      SAVE_RELATIONSHIP_COPY.offerTitle === '이 관계를 저장해둘까?' &&
      SAVE_RELATIONSHIP_COPY.cta === '이 관계 저장하기',
  );
  c.check(
    'SAVE-UI-02 · Guest가 저장을 누르면 → 인라인 로그인',
    saveRelationshipStage({ ...base, accountStatus: 'signed_out', intent: 'requested' }) === 'auth',
  );
  const db = createMemoryDatabase();
  const gw = createMemoryGateway(db, USER_A);
  c.check(
    'SAVE-UI-03 · 로그인만 → 동의 질문 · 업로드 0행',
    saveRelationshipStage({ ...base, accountStatus: 'signed_in', intent: 'requested' }) === 'consent' &&
      totalRows(db) === 0 &&
      SAVE_RELATIONSHIP_COPY.consentQuestion === '이 기기에 입력한 정보를 이 계정에 저장할까?',
  );
  const localBefore = JSON.stringify({ answers, registry });
  const saved = await saveActiveRelationshipWith({
    gateway: gw,
    userId: USER_A,
    answers,
    registry,
    links: createCloudLinks(),
    now: NOW,
  });
  const link = linkOf(saved.links, USER_A, registry.activeTargetId);
  c.check(
    'SAVE-UI-04 · 동의 → cloud save(나 최소값 · 현재 상대 · 사건 · link)',
    saved.saved &&
      link !== null &&
      db.tables.user_profiles.length === 1 &&
      db.tables.relationship_targets.length === 1 &&
      db.tables.relationship_targets[0]?.id === link.cloudTargetId &&
      db.tables.relationship_events.length === answers.target.events.length,
    saved.report,
  );
  c.check(
    'SAVE-UI-05 · 저장된 관계 → "저장됨"',
    saveRelationshipStage({ ...base, accountStatus: 'signed_in', linked: true }) === 'saved' &&
      saveRelationshipStage({ ...base, accountStatus: 'signed_in', linked: true, intent: 'requested' }) === 'saved' &&
      SAVE_RELATIONSHIP_COPY.saved === '저장됨',
  );
  const offline = createMemoryDatabase();
  offline.offline = true;
  const failedSave = await saveActiveRelationshipWith({
    gateway: createMemoryGateway(offline, USER_A),
    userId: USER_A,
    answers,
    registry,
    links: createCloudLinks(),
    now: NOW,
  });
  c.check(
    'SAVE-UI-06 · cloud save 실패 → 저장됨 아님 · link 없음 · 로컬 데이터 그대로',
    !failedSave.saved &&
      linkOf(failedSave.links, USER_A, registry.activeTargetId) === null &&
      JSON.stringify({ answers, registry }) === localBefore &&
      saveRelationshipStage({ ...base, accountStatus: 'signed_in', intent: 'requested', failed: true }) === 'failed',
    failedSave.report.status,
  );
  const photoAnswers = answersFrom({
    ...body.answers,
    photos: [{ id: 'photo-1', label: 'fixture', source: 'upload', objectUrl: 'blob:http://localhost/1' }] as unknown as SessionAnswers['photos'],
    target: { ...answers.target, photoUrl: TINY_PNG, thumbnail: TINY_PNG } as unknown as SessionAnswers['target'],
  });
  const photoDb = createMemoryDatabase();
  const photoSave = await saveActiveRelationshipWith({
    gateway: createMemoryGateway(photoDb, USER_A),
    userId: USER_A,
    answers: photoAnswers,
    registry: createTargetRegistry(),
    links: createCloudLinks(),
    now: NOW,
  });
  c.check(
    'SAVE-UI-07 · 사진 · 이미지는 절대 포함되지 않는다',
    photoSave.saved &&
      !/data:image|blob:|base64|objectUrl|photoUrl|thumbnail|"photos"|observedAnalysis/i.test(JSON.stringify(photoDb.tables)),
    photoSave.report.status,
  );
  return c.checks;
}

/* ══════════════════════════════════════════════════════════════════ v1.47 Integration — analysis_run 저장 조건 (RUN) */

function syntheticNarrativeBundle(generationRequestId: string | null, mode: 'real' | 'mock' | 'demo' = 'real'): DeepNarrativeBundle {
  return {
    narratives: [],
    candidateSemantics: [],
    actionPlan: null,
    meta: {
      mode,
      analysisVersion: 'fixture',
      promptVersion: 'deep-report-v13-uncertainty-move',
      model: 'gpt-5.4',
      generatedAt: NOW,
      inputFingerprint: 'dr_flow',
    },
    ...(generationRequestId ? { generationRequestId } : {}),
  } as unknown as DeepNarrativeBundle;
}

const RUN_IDS = [
  'aaaaaaaa-1111-4111-8111-000000000001',
  'aaaaaaaa-1111-4111-8111-000000000002',
  'aaaaaaaa-1111-4111-8111-000000000003',
  'aaaaaaaa-1111-4111-8111-000000000004',
] as const;

async function scenarioAnalysisRunFlow(body: PersistenceTestRequest) {
  const c = checker();
  const answers = answersFrom(body.answers);
  const registry = createTargetRegistry();
  const db = createMemoryDatabase();
  const gw = createMemoryGateway(db, USER_A);
  const saved = await saveActiveRelationshipWith({ gateway: gw, userId: USER_A, answers, registry, links: createCloudLinks(), now: NOW });
  const links = saved.links;
  const cloudTargetId = linkOf(links, USER_A, registry.activeTargetId)?.cloudTargetId ?? '';
  const events = answers.target.events;
  const accepted = syntheticDeepReport(events.map((event) => event.id), []);
  const gateRejected = {
    ...accepted,
    candidates: accepted.candidates.map((card) => ({ ...card, soWhatSource: 'deterministic_composed' })),
    actionPlan: accepted.actionPlan ? { ...accepted.actionPlan, source: 'deterministic', mode: 'unresolved' } : null,
  } as unknown as RelationshipDeepReport;
  const verifyOnly = {
    ...gateRejected,
    actionPlan: accepted.actionPlan ? { ...accepted.actionPlan, source: 'deterministic', mode: 'verify_only' } : null,
  } as unknown as RelationshipDeepReport;

  type PersistInput = Parameters<typeof persistDeepReportSnapshot>[0];
  const persist = (overrides: Partial<PersistInput> = {}) =>
    persistDeepReportSnapshot({
      gateway: gw,
      userId: USER_A,
      links,
      localTargetId: registry.activeTargetId,
      rendered: true,
      status: 'ready',
      mode: 'real',
      bundle: syntheticNarrativeBundle(RUN_IDS[0]),
      report: accepted,
      events,
      ...overrides,
    });
  const reasonOf = (outcome: Awaited<ReturnType<typeof persistDeepReportSnapshot>>): string =>
    outcome.status === 'skipped' ? outcome.reason : outcome.status;

  const first = await persist();
  const row = db.tables.analysis_runs[0];
  const usedEventIds = ((row?.result_snapshot ?? {}) as { usedEventIds?: string[] }).usedEventIds ?? [];
  const runsJson = JSON.stringify(db.tables.analysis_runs);
  c.check(
    'RUN-01 · 렌더된 성공 결과 → 저장 · 저장한 그 관계에 · 사건은 cloud id로만 참조',
    saved.saved &&
      first.status === 'recorded' &&
      first.created &&
      row?.target_id === cloudTargetId &&
      usedEventIds.length > 0 &&
      usedEventIds.every((id) => db.tables.relationship_events.some((event) => event.id === id)) &&
      !runsJson.includes('evt-fixture') &&
      events.every((event) => !runsJson.includes(event.description)),
    first,
  );
  const providerFail = await persist({ status: 'unavailable', mode: null, bundle: null });
  const notRendered = await persist({ rendered: false, bundle: syntheticNarrativeBundle(RUN_IDS[1]) });
  const demo = await persist({ mode: 'demo', bundle: syntheticNarrativeBundle(RUN_IDS[1], 'demo') });
  c.check(
    'RUN-02 · Provider 실패 · 렌더 전(cancel) · demo → 저장 안 함',
    reasonOf(providerFail) === 'provider_failed' &&
      reasonOf(notRendered) === 'not_rendered' &&
      reasonOf(demo) === 'not_ai_mode' &&
      db.tables.analysis_runs.length === 1,
    [providerFail, notRendered, demo].map(reasonOf),
  );
  const gate = await persist({ report: gateRejected, bundle: syntheticNarrativeBundle(RUN_IDS[2]) });
  const verify = await persist({ report: verifyOnly, bundle: syntheticNarrativeBundle(RUN_IDS[2]) });
  c.check(
    'RUN-03 · 게이트 거부(AI 문장 0) · verify_only fallback만 → 저장 안 함',
    reasonOf(gate) === 'gate_rejected' && reasonOf(verify) === 'verify_only_fallback' && db.tables.analysis_runs.length === 1,
    [reasonOf(gate), reasonOf(verify)],
  );
  const guest = await persist({ gateway: null, userId: null });
  c.check('RUN-04 · Guest → cloud 저장 없음', reasonOf(guest) === 'guest' && db.tables.analysis_runs.length === 1, reasonOf(guest));
  const otherTarget = await persist({ localTargetId: newUuid() });
  const otherUser = await persist({ gateway: createMemoryGateway(db, USER_B), userId: USER_B });
  c.check(
    'RUN-05 · 저장하지 않은 관계(다른 상대 · 다른 계정) → 분석 저장 안 함',
    reasonOf(otherTarget) === 'relationship_not_saved' &&
      reasonOf(otherUser) === 'relationship_not_saved' &&
      db.tables.analysis_runs.length === 1,
  );
  const retry = await persist();
  c.check(
    'RUN-06 · 같은 logical run retry → duplicate 0',
    retry.status === 'recorded' && !retry.created && db.tables.analysis_runs.length === 1,
    retry,
  );
  const rerun = await persist({ bundle: syntheticNarrativeBundle(RUN_IDS[3]) });
  c.check(
    'RUN-07 · 다시 분석(새 generationRequestId) → 새 analysis row',
    rerun.status === 'recorded' && rerun.created && db.tables.analysis_runs.length === 2,
    rerun,
  );
  const missingId = await persist({ bundle: syntheticNarrativeBundle(null) });
  c.check(
    'RUN · generationRequestId가 없는 결과는 저장하지 않는다',
    reasonOf(missingId) === 'missing_generation_id' && db.tables.analysis_runs.length === 2,
  );
  return c.checks;
}

/* ══════════════════════════════════════════════════════════════════ v1.47 Integration — link 복구 audit */

async function scenarioLinkRecovery(body: PersistenceTestRequest) {
  const c = checker();
  const answers = answersFrom(body.answers);
  const registry = createTargetRegistry();
  const db = createMemoryDatabase();
  const gw = createMemoryGateway(db, USER_A);
  const first = await saveActiveRelationshipWith({ gateway: gw, userId: USER_A, answers, registry, links: createCloudLinks(), now: NOW });
  const original = linkOf(first.links, USER_A, registry.activeTargetId);
  const rowsBefore = JSON.stringify(rowCounts(db));

  const recovered = await recoverCloudLink({
    gateway: gw,
    userId: USER_A,
    localTargetId: registry.activeTargetId,
    links: createCloudLinks(),
    now: NOW,
  });
  c.check(
    'LINK-01 · localStorage link가 사라져도 결정론 id로 같은 cloud 관계를 다시 찾는다(읽기만 · 행 변화 0)',
    first.saved && recovered.recovered && recovered.link?.cloudTargetId === original?.cloudTargetId && JSON.stringify(rowCounts(db)) === rowsBefore,
    { recovered, original },
  );
  const resave = await saveActiveRelationshipWith({ gateway: gw, userId: USER_A, answers, registry, links: createCloudLinks(), now: NOW });
  c.check(
    'LINK-02 · link 없이 다시 저장해도 중복 행이 생기지 않는다',
    resave.saved &&
      db.tables.relationship_targets.length === 1 &&
      db.tables.relationship_events.length === answers.target.events.length,
    resave.report.status,
  );
  const other = await recoverCloudLink({
    gateway: createMemoryGateway(db, USER_B),
    userId: USER_B,
    localTargetId: registry.activeTargetId,
    links: createCloudLinks(),
    now: NOW,
  });
  c.check('LINK-03 · 다른 계정은 복구되지 않는다(자동 공유 없음)', !other.recovered && other.link === null);
  const lostRegistry = await recoverCloudLink({ gateway: gw, userId: USER_A, localTargetId: newUuid(), links: createCloudLinks(), now: NOW });
  c.check('LINK-04 · 기기 상대 목록(lym.targets.v1)까지 사라지면 복구되지 않는다 — 알려진 한계', !lostRegistry.recovered);
  return c.checks;
}

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ ok: false, reason: 'NOT_FOUND' }, { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as PersistenceTestRequest | null;
  if (!body?.scenario) return Response.json({ ok: false, reason: 'INVALID_INPUT' }, { status: 400 });

  switch (body.scenario) {
    case 'rls':
      return Response.json({ ok: true, checks: await scenarioRls() });
    case 'repositories':
      return Response.json({ ok: true, checks: await scenarioRepositories() });
    case 'migration':
      return Response.json({ ok: true, checks: await scenarioMigration(body) });
    case 'migration_conflict':
      return Response.json({ ok: true, checks: await scenarioMigrationConflict(body) });
    case 'migration_offline':
      return Response.json({ ok: true, checks: await scenarioMigrationOffline(body) });
    case 'failure_offline':
      return Response.json({ ok: true, checks: await scenarioFailureOffline() });
    case 'sync_conflict':
      return Response.json({ ok: true, checks: await scenarioSyncConflict() });
    case 'target_switch':
      return Response.json({ ok: true, checks: await scenarioTargetSwitch() });
    case 'analysis_run':
      return Response.json({ ok: true, checks: await scenarioAnalysisRun() });
    case 'auth_config':
      return Response.json({ ok: true, checks: await scenarioAuthConfig() });
    case 'parity':
      return Response.json({ ok: true, ...(await scenarioParity(body)) });
    case 'storage':
      return Response.json({ ok: true, ...(await scenarioStorage(body)) });
    case 'storage_scale':
      return Response.json({ ok: true, ...(await scenarioStorageScale(body)) });
    case 'analysis_policy':
      return Response.json({ ok: true, checks: await scenarioAnalysisPolicy() });
    case 'cross_account':
      return Response.json({ ok: true, checks: await scenarioCrossAccount(body) });
    case 'saved_relationship':
      return Response.json({ ok: true, checks: await scenarioSavedRelationship(body) });
    case 'account_switch':
      return Response.json({ ok: true, checks: await scenarioAccountSwitch(body) });
    case 'logical_run':
      return Response.json({ ok: true, checks: await scenarioLogicalRun() });
    case 'save_relationship_ui':
      return Response.json({ ok: true, checks: await scenarioSaveRelationshipUi(body) });
    case 'analysis_run_flow':
      return Response.json({ ok: true, checks: await scenarioAnalysisRunFlow(body) });
    case 'link_recovery':
      return Response.json({ ok: true, checks: await scenarioLinkRecovery(body) });
    default:
      return Response.json({ ok: false, reason: 'UNKNOWN_SCENARIO' }, { status: 400 });
  }
}
