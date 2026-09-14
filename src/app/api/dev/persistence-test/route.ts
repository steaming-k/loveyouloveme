import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createClient } from '@supabase/supabase-js';

import { createAnalysisRunRepository } from '@/lib/persistence/analysisRunRepository';
import { CLOUD_WRITE_BUDGET, estimateUtf8Bytes, inspectCloudPayload } from '@/lib/persistence/cloudWriteBudget';
import type { PersistenceGateway } from '@/lib/persistence/gateway';
import { cloudTargetIdOf, isUuid, newUuid } from '@/lib/persistence/ids';
import { migrateLocalData, planLocalMigration, type LocalDataSnapshot } from '@/lib/persistence/localMigration';
import {
  eventRowOf,
  profileRowOf,
  runRowOf,
  selfProfileFromSession,
  sessionWithCloudContext,
  targetContextFromSession,
  targetRowOf,
} from '@/lib/persistence/mappers';
import { createMemoryDatabase, createMemoryGateway, type MemoryDatabase } from '@/lib/persistence/memoryGateway';
import { createProfileRepository } from '@/lib/persistence/profileRepository';
import { createRelationshipEventRepository } from '@/lib/persistence/relationshipEventRepository';
import { createRelationshipTargetRepository } from '@/lib/persistence/relationshipTargetRepository';
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
    default:
      return Response.json({ ok: false, reason: 'UNKNOWN_SCENARIO' }, { status: 400 });
  }
}
