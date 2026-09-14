/**
 * Persistence Fixture Test (v1.47 · Supabase Persistence Foundation)
 *
 * 섹션(§31): supabase-schema · rls · repositories · local-migration · saved-target ·
 * target-switch · cloud-event · analysis-run · sync-conflict · failure/offline · auth-session
 * + guest local flow · analytics · deterministic parity(§33)
 *
 * 계산은 `/api/dev/persistence-test`가 **제품 코드 그대로** 수행하고(메모리 gateway = SQL 규칙 흉내),
 * 이 스크립트는 fixture를 넘기고 결과를 확인한다. parity는 `/api/dev/premium-test`를 로컬 입력과
 * 클라우드 왕복 입력으로 두 번 불러 비교한다.
 *
 * ⚠️ 실제 Supabase RLS 검증이 아니다 — 연결 가능한 dev 프로젝트가 없어 BLOCKED다(보고서 참고).
 * ⚠️ Provider를 호출하지 않는다. 외부 네트워크를 쓰지 않는다.
 *
 * 사용법:
 *   1) npm run dev
 *   2) node tests/run-persistence-fixtures.mjs
 */

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = process.env.LYM_BASE_URL ?? 'http://localhost:3000';

const failures = [];
let passed = 0;

function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
    return;
  }
  const suffix = detail === undefined ? '' : ` — ${JSON.stringify(detail).slice(0, 600)}`;
  failures.push(`${label}${suffix}`);
  console.log(`  ✗ ${label}${suffix}`);
}

async function post(path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${path} ${response.status} — dev 서버가 떠 있는지 확인할 것`);
  return response.json();
}

/* ── fixture (run-premium-fixtures.mjs의 고데이터 세션과 같은 값 + 사건 · 출생정보 · 사진) ── */

const EVENTS = [
  {
    id: 'evt-fixture-1',
    type: 'contact_change',
    description: '얘기가 엇갈린 다음에 한동안 답이 없던 날이 있었어',
    myReaction: '먼저 연락하지 못하고 기다렸어',
  },
  { id: 'evt-fixture-2', type: 'conflict', description: '약속 시간을 두고 말이 엇갈렸어' },
  { id: 'evt-fixture-3', type: 'closer', description: '같이 산책하면서 오래 이야기했어', myReaction: '편했어' },
];

const ANSWERS = {
  status: 'dating',
  declared: { contact: 5, conflict: 'soon', alone: 4, affection: 'a2', hobby: 'h2' },
  experience: {
    important: ['contact', 'alone', 'conflict'],
    hardest: 'contact_drop',
    selfGap: 'yes',
    note: '',
    skipped: false,
    adaptive: { axis: 'contact', optionId: 'disconnect' },
  },
  currentRelationship: {
    signals: { contact: 'often', conflict: 'rarely', alone: 'sometimes', affection: 'often' },
    askedAt: '2026-09-08T00:00:00.000Z',
  },
  target: {
    relation: 'crush',
    contact: 'l',
    conflict: 'h',
    alone: 'h',
    affection: 'm',
    mbti: 'ENFP',
    birthProfile: { date: '1995-03-02', time: null, timeUnknown: true, calendarType: 'solar', location: null },
    preferences: {
      interests: [
        { id: 'i-movie', category: 'movie_show', label: '영화 · 공연' },
        { id: 'i-walk', category: 'walk', label: '산책 · 자연' },
      ],
    },
    events: EVENTS,
  },
  savedQuestions: ['contact'],
  mbti: 'INFP',
  birthProfile: {
    date: '1994-11-20',
    time: '10:30',
    timeUnknown: false,
    calendarType: 'solar',
    location: { country: 'KR', city: 'Seoul' },
  },
  /* 계정에 올라가면 안 되는 것 — migration이 제외하는지 본다 */
  photos: [{ id: 'photo-1', label: 'fixture', source: 'upload', objectUrl: 'blob:fixture' }],
  observedAnalysis: { version: '1.0', traits: [], limitations: [], meta: { mode: 'demo' } },
};

function coupleEntry({ id, createdAt, states, declared }) {
  return {
    id,
    analysisId: `couple-${id}`,
    createdAt,
    audience: 'couple',
    context: { relationshipStatus: 'dating', targetRelation: 'crush' },
    profileSnapshot: { mbti: 'INFP' },
    declaredSnapshot: { contact: null, conflict: null, alone: null, affection: null, hobby: null, ...declared },
    relationshipEvidence: { important: [], hardest: null, selfGap: null, adaptive: null },
    mirrorSnapshot: {
      insights: Object.entries(states).map(([axis, state]) => ({
        axis,
        state,
        declaredText: `${axis} declared`,
        relationshipSignal: '말한 기준보다 크게 반응한 신호가 있었음',
      })),
      focusAxis: null,
    },
    coreInsight: {
      original: `${id} core`,
      userCorrection: null,
      verdict: null,
      aiMeta: { mode: 'demo', promptVersion: 'relationship-v8-ended-action', generatedAt: createdAt },
    },
    evidenceCoverage: 'medium',
  };
}

const HISTORY = [
  coupleEntry({
    id: 'h1',
    createdAt: '2026-06-01T00:00:00.000Z',
    states: { contact: 'GAP', alone: 'MATCH', conflict: 'GAP' },
    declared: { contact: 2, alone: 4 },
  }),
  coupleEntry({
    id: '5b0f4c8e-2f3a-4d1b-9c7e-6a5b4c3d2e1f',
    createdAt: '2026-08-01T00:00:00.000Z',
    states: { contact: 'GAP', alone: 'GAP', conflict: 'MATCH' },
    declared: { contact: 5, alone: 4 },
  }),
];

/* ══════════════════════════════════════════════════════════════════ 1. supabase-schema (정적) */

async function listFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listFiles(full)));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const rel = (file) => relative(ROOT, file).replace(/\\/g, '/');

/** 주석을 뺀 코드만 — 설명 주석에 나오는 단어로 검사가 흔들리지 않게 한다 */
function codeOnly(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

async function schemaChecks() {
  console.log('\n■ supabase-schema');
  const migrations = (await readdir(join(ROOT, 'supabase', 'migrations'))).filter((name) => name.endsWith('.sql'));
  check('migration 파일이 저장소 안에 있다', migrations.length >= 1, migrations);
  const sql = (
    await Promise.all(migrations.map((name) => readFile(join(ROOT, 'supabase', 'migrations', name), 'utf8')))
  )
    .join('\n')
    .replace(/\r\n/g, '\n')
    .replace(/--.*$/gm, '');

  const tables = ['user_profiles', 'relationship_targets', 'relationship_events', 'analysis_runs'];
  for (const table of tables) {
    check(`table ${table}`, new RegExp(`create table public\\.${table}\\s*\\(`).test(sql));
    check(`RLS enabled · ${table}`, new RegExp(`alter table public\\.${table}\\s+enable row level security`).test(sql));
    const ops = ['select', 'insert', 'update', 'delete'].filter((op) =>
      new RegExp(`create policy \\w+ on public\\.${table}\\s+for ${op}\\b`).test(sql),
    );
    if (table === 'analysis_runs') {
      check('analysis_runs — select/insert/delete 정책만(UPDATE 정책 없음)', ops.join(',') === 'select,insert,delete', ops);
    } else {
      check(`policies SELECT/INSERT/UPDATE/DELETE · ${table}`, ops.join(',') === 'select,insert,update,delete', ops);
    }
    check(`anon 권한 회수 · ${table}`, new RegExp(`revoke all on table public\\.${table}\\s+from anon`).test(sql));
  }
  const policies = sql.split(/create policy/).slice(1);
  check(
    '모든 정책이 auth.uid() = user_id 하나로만 판정',
    policies.length === 15 && policies.every((body) => /\(select auth\.uid\(\)\) = user_id/.test(body.split(';')[0])),
    policies.length,
  );
  check(
    'events · runs → targets 복합 FK(같은 소유자) · ON DELETE CASCADE',
    (sql.match(/foreign key \(target_id, user_id\)\s+references public\.relationship_targets \(id, user_id\)\s+on delete cascade/g) ?? []).length === 2,
  );
  check('user_id → auth.users ON DELETE CASCADE(4 테이블)', (sql.match(/references auth\.users \(id\) on delete cascade/g) ?? []).length === 4);
  check('index — user_id · target_id · created_at', /\(user_id, updated_at desc\)/.test(sql) && /\(target_id, created_at\)/.test(sql) && /\(user_id, created_at desc\)/.test(sql) && /\(target_id, created_at desc\)/.test(sql));
  check('revision 트리거(+1만 허용) 3 테이블', (sql.match(/execute function public\.lym_enforce_revision\(\)/g) ?? []).length === 3);
  check('analysis_runs 불변 트리거', /analysis_runs_immutable before update on public\.analysis_runs/.test(sql));
  check('label은 선택 · 실명 요구 없음', /label\s+text check \(label is null or/.test(sql) && !/label\s+text\s+not null/.test(sql));
  check('사건은 target_json 배열이 아니라 테이블', /create table public\.relationship_events/.test(sql));
  check('analysis_runs — raw 응답 컬럼 없음', !/raw_response|provider_response|reasoning/.test(sql));
  check('SQL에 service_role 사용 없음', !/service_role/.test(sql));
  check('Supabase Storage bucket · storage 스키마를 쓰지 않는다', !/storage\./i.test(sql));

  const env = await readFile(join(ROOT, '.env.example'), 'utf8');
  check('.env.example — NEXT_PUBLIC_SUPABASE_URL / ANON_KEY 빈 값', /^NEXT_PUBLIC_SUPABASE_URL=$/m.test(env) && /^NEXT_PUBLIC_SUPABASE_ANON_KEY=$/m.test(env));
  check('.env.example — service role 키 항목 없음', !/^[A-Z_]*SERVICE_ROLE[A-Z_]*=/m.test(env));
  check('.gitignore — .env*.local', (await readFile(join(ROOT, '.gitignore'), 'utf8')).includes('.env*.local'));
}

/* ══════════════════════════════════════════════════════════════════ guest · analytics · auth (정적) */

async function sourceChecks() {
  const files = await listFiles(join(ROOT, 'src'));
  /* 줄바꿈을 LF로 맞춘다 — Windows checkout(core.autocrlf)이면 작업본이 CRLF가 되어 '\n'이 든 검사가 흔들린다 */
  const sources = new Map(
    await Promise.all(files.map(async (file) => [rel(file), (await readFile(file, 'utf8')).replace(/\r\n/g, '\n')])),
  );
  const read = (path) => sources.get(path) ?? '';
  const codes = new Map([...sources].map(([path, text]) => [path, codeOnly(text)]));

  console.log('\n■ auth-session (정적)');
  const serviceRole = [...codes].filter(([, text]) => /service_role|SERVICE_ROLE/.test(text)).map(([path]) => path).sort();
  check(
    'service_role 키를 쓰는 코드 없음(거부 로직 · 거부 fixture만 언급)',
    serviceRole.every((path) => path === 'src/lib/supabase/config.ts' || path === 'src/app/api/dev/persistence-test/route.ts') &&
      [...codes].every(([, text]) => !/process\.env\.[A-Z_]*SERVICE_ROLE/.test(text)),
    serviceRole,
  );
  const supabaseImports = [...sources].filter(([, text]) => /from '@supabase\//.test(text)).map(([path]) => path).sort();
  check(
    '@supabase import는 lib/supabase · supabaseGateway · dev 테스트 라우트뿐',
    supabaseImports.every((path) => path.startsWith('src/lib/supabase/') || path === 'src/lib/persistence/supabaseGateway.ts' || path === 'src/app/api/dev/persistence-test/route.ts'),
    supabaseImports,
  );
  const directFrom = [...sources].filter(([, text]) => /\.from\((table|'|")/.test(text)).map(([path]) => path);
  check('UI에서 .from() 직접 호출 없음 — gateway 한 곳', directFrom.length === 1 && directFrom[0] === 'src/lib/persistence/supabaseGateway.ts', directFrom);
  check('deprecated auth-helpers 미사용', [...sources].every(([, text]) => !/auth-helpers/.test(text)));
  check('Supabase Storage(bucket) API를 쓰지 않는다 — 사진 · 바이너리 저장 없음', [...codes].every(([, text]) => !/\.storage\s*\./.test(text)));
  check(
    '모든 cloud write 경로가 같은 guard를 먼저 부른다(insert · update)',
    ['src/lib/persistence/supabaseGateway.ts', 'src/lib/persistence/memoryGateway.ts'].every(
      (path) => (codes.get(path)?.match(/rejectCloudPayload\(table, (row|patch)\)/g) ?? []).length === 2,
    ),
  );
  check('persistence mapper에 slice() 절단이 없다', !/\.slice\(/.test(codes.get('src/lib/persistence/mappers.ts') ?? ''));
  const provider = read('src/state/AccountProvider.tsx');
  const providerCode = codes.get('src/state/AccountProvider.tsx') ?? '';
  const providerRender = '  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;';
  const providerBody = providerCode.slice(providerCode.indexOf('export function AccountProvider'), providerCode.indexOf('export function useAccount'));
  check(
    'AccountProvider — children을 항상 렌더(최상위 early return 없음)',
    providerBody.includes(providerRender) && !/^  (?:if \([^\n]*\) )?return\b/m.test(providerBody.replace(providerRender, '')),
  );
  check('AccountProvider — 설정 없으면 disabled', provider.includes("isSupabaseConfigured() ? 'loading' : 'disabled'"));
  check('session restore — getSession + onAuthStateChange', provider.includes('auth\n      .getSession()') && provider.includes('onAuthStateChange'));
  check('sign in(Email OTP · Magic Link) · sign out', provider.includes('signInWithOtp') && provider.includes('verifyOtp') && provider.includes('auth.signOut()'));
  check('Social OAuth 없음 · 결제 연결 없음', [...sources].every(([, text]) => !/signInWithOAuth/.test(text)) && !/premium|payment/i.test(provider));
  const callback = read('src/app/auth/callback/route.ts');
  check('/auth/callback — code 교환만 · 업로드 없음', callback.includes('exchangeCodeForSession') && !callback.includes('migrate'));

  console.log('\n■ guest local flow (정적)');
  const saveCallers = [...codes].filter(([, text]) => /saveDeviceData\(\)/.test(text)).map(([path]) => path).sort();
  check('기기 → 계정 저장은 버튼 클릭에서만 호출(자동 upload 없음)', saveCallers.join(',') === 'src/components/account/AccountSection.tsx', saveCallers);
  const migrateCallers = [...codes].filter(([, text]) => /migrateLocalData\(\{/.test(text)).map(([path]) => path).sort();
  check('migrateLocalData 호출부 = AccountProvider(동의 후) · dev 라우트', migrateCallers.join(',') === 'src/app/api/dev/persistence-test/route.ts,src/state/AccountProvider.tsx', migrateCallers);
  check('AccountSection — 설정 없으면 아무것도 그리지 않음', read('src/components/account/AccountSection.tsx').includes("if (account.status === 'disabled') return null;"));
  const coreImports = [...sources].filter(
    ([path, text]) =>
      /^src\/(lib\/logic|services|hooks|app\/(compatibility|mirror|premium|target|home|profile))\//.test(path) &&
      /@\/lib\/(supabase|persistence)|@\/state\/AccountProvider/.test(text),
  );
  check('분석 경로(logic · services · hooks · 결과 화면)는 Supabase/persistence에 의존하지 않음', coreImports.length === 0, coreImports.map(([path]) => path));
  const session = read('src/state/SessionProvider.tsx');
  const resetBody = session.slice(session.indexOf('const resetTargetContext = useCallback'), session.indexOf('const loadSampleSession'));
  check(
    '새로운 사람 — 세션 초기화 전에 이전 상대를 보관(preserveActiveTarget)',
    resetBody.indexOf('preserveActiveTarget(') > 0 && resetBody.indexOf('preserveActiveTarget(') < resetBody.indexOf('target: createEmptyTargetProfile()'),
  );
  check('세션 초기화 자체는 그대로(createEmptyTargetProfile · savedQuestions [] · compatibility false)', resetBody.includes('target: createEmptyTargetProfile()') && resetBody.includes('savedQuestions: []') && resetBody.includes('compatibility: false'));
  check('전체 삭제는 보관된 상대도 지움', session.slice(session.indexOf('const clearSession'), session.indexOf('const reset =')).includes('clearTargetRegistry()'));
  check('세션 저장 key 불변(lym.session.v1)', session.includes("const STORAGE_KEY = 'lym.session.v1';"));
  const layout = read('src/app/layout.tsx');
  check('AccountProvider는 Session · History 안쪽', layout.indexOf('<SessionProvider>') < layout.indexOf('<AccountProvider>') && layout.indexOf('<HistoryProvider>') < layout.indexOf('<AccountProvider>'));
  const privacy = read('src/app/privacy/page.tsx');
  check('Privacy — 연결 전 문장은 그대로 유지', privacy.includes('계정도 서버 DB도 없어서 다른 기기에서는 볼 수 없어.'));
  check('Privacy — 클라우드 저장과 AI Provider 처리를 구분', privacy.includes('계정 저장과 AI 분석은 별개야') && privacy.includes('Provider로 보내는'));
  check('Privacy — 상대 정보는 사용자가 입력한 정보', privacy.includes('상대가 직접 확인한 정보가 아니'));

  console.log('\n■ analytics (정적)');
  const analytics = read('src/lib/analytics.ts');
  const forbiddenBlock = analytics.slice(analytics.indexOf('const EXTERNAL_FORBIDDEN_KEYS'), analytics.indexOf(']);', analytics.indexOf('const EXTERNAL_FORBIDDEN_KEYS')));
  check(
    '외부 전송 금지 키 — 상대 별칭 · 생년월일 · 자유서술 · 이메일',
    ["'target_label'", "'birth_date'", "'birth_time'", "'note'", "'text'", "'email'"].every((key) => forbiddenBlock.includes(key)),
  );
  check('analytics.ts에는 사건 본문 · 반응 필드명 자체가 없다(SEM-06과 같은 보장)', !/description|myReaction|my_reaction/.test(codeOnly(analytics)));
  const trackCalls = [...sources].flatMap(([path, text]) =>
    [...text.matchAll(/track(?:Event|Once|FunnelOnce)?\(\s*'[^']+'\s*,\s*\{([\s\S]*?)\}\s*\)/g)].map((match) => [path, match[1]]),
  );
  const leaking = trackCalls.filter(([, props]) => /\b(description|myReaction|my_reaction|label|email|birthProfile|note)\s*[:,}]/.test(props));
  check('trackEvent 호출에 사건 본문 · 반응 · 별칭 · 이메일 · 생년월일 · 서술 property 없음', leaking.length === 0, leaking.map(([path]) => path));
  const persistenceFiles = [...sources].filter(([path]) => path.startsWith('src/lib/persistence/') || path === 'src/state/AccountProvider.tsx' || path === 'src/components/account/AccountSection.tsx');
  check('persistence · 계정 코드는 analytics · console 로그를 쓰지 않음', persistenceFiles.every(([, text]) => !/trackEvent|trackOnce|console\./.test(text)));
}

/* ══════════════════════════════════════════════════════════════════ 2~11. 라우트 시나리오 */

const SCENARIOS = [
  ['rls', 'rls (메모리 gateway — SQL 규칙 재현)'],
  ['repositories', 'repositories · cloud-event · saved-target'],
  ['migration', 'local-migration'],
  ['migration_conflict', 'local-migration · 계정에 이미 다른 값'],
  ['target_switch', 'saved-target · target-switch (0 / 1 / 3 / 10)'],
  ['analysis_run', 'analysis-run'],
  ['sync_conflict', 'sync-conflict'],
  ['migration_offline', 'failure/offline · migration'],
  ['failure_offline', 'failure/offline · supabase gateway'],
  ['auth_config', 'auth-session · config'],
  ['storage', 'storage capacity guard · STORAGE-01~10 · payload bytes'],
  ['storage_scale', 'storage capacity guard · 10 / 100 / 500 events'],
];

async function routeChecks() {
  for (const [scenario, title] of SCENARIOS) {
    console.log(`\n■ ${title}`);
    const json = await post('/api/dev/persistence-test', { scenario, answers: ANSWERS, history: HISTORY });
    check(`${scenario} — 라우트 응답`, json.ok === true && Array.isArray(json.checks) && json.checks.length > 0, json);
    for (const item of json.checks ?? []) check(item.label, item.pass, item.detail);
    if (json.info) console.log(`  ℹ️  ${JSON.stringify(json.info)}`);
  }
}

/* ══════════════════════════════════════════════════════════════════ 12. deterministic parity */

function collectEventIds(value, out = []) {
  if (Array.isArray(value)) value.forEach((item) => collectEventIds(item, out));
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key === 'eventId' && typeof item === 'string') out.push(item);
      else if (key === 'eventIds' && Array.isArray(item)) out.push(...item.filter((id) => typeof id === 'string'));
      else collectEventIds(item, out);
    }
  }
  return out;
}

/** 사건 id만 입력 순번으로 바꾼다 — 로컬 id(evt-…)와 클라우드 id(UUID)는 달라도 되는 값이다 */
function normalizeEventIds(value, events) {
  let text = JSON.stringify(value);
  events.forEach((event, index) => {
    text = text.split(event.id).join(`EVENT#${index}`);
  });
  return text;
}

async function parityChecks() {
  console.log('\n■ deterministic parity (로컬 입력 vs 클라우드 왕복 입력)');
  const parity = await post('/api/dev/persistence-test', { scenario: 'parity', answers: ANSWERS });
  for (const item of parity.checks ?? []) check(item.label, item.pass, item.detail);
  if (!parity.rebuilt) {
    check('parity — 재구성 세션', false);
    return;
  }
  const bodyOf = (answers) => ({
    status: answers.status,
    declared: answers.declared,
    experience: answers.experience,
    currentRelationship: answers.currentRelationship,
    target: answers.target,
    mbti: answers.mbti,
    birthProfile: answers.birthProfile,
    entries: HISTORY,
  });
  const local = await post('/api/dev/premium-test?withAiContext=1', bodyOf(ANSWERS));
  const cloud = await post('/api/dev/premium-test?withAiContext=1', bodyOf(parity.rebuilt));
  const localEvents = ANSWERS.target.events;
  const cloudEvents = parity.rebuilt.target.events;

  check('PARITY 사건 순서 · 내용 보존', JSON.stringify(cloudEvents.map((e) => [e.type, e.description, e.myReaction])) === JSON.stringify(localEvents.map((e) => [e.type, e.description, e.myReaction])));
  check('PARITY Compatibility score', local.compatibility?.score !== undefined && JSON.stringify(local.compatibility) === JSON.stringify(cloud.compatibility), { local: local.compatibility, cloud: cloud.compatibility });
  check('PARITY Mirror verdict', Array.isArray(local.mirrorStates) && local.mirrorStates.length > 0 && JSON.stringify(local.mirrorStates) === JSON.stringify(cloud.mirrorStates), { local: local.mirrorStates, cloud: cloud.mirrorStates });
  check(
    'PARITY Top 3 Candidate ordering',
    Array.isArray(local.semanticTopCandidateIds) &&
      local.semanticTopCandidateIds.length > 0 &&
      normalizeEventIds(local.semanticTopCandidateIds, localEvents) === normalizeEventIds(cloud.semanticTopCandidateIds, cloudEvents),
    { local: local.semanticTopCandidateIds, cloud: cloud.semanticTopCandidateIds },
  );
  const localSelected = collectEventIds(local).map((id) => localEvents.findIndex((event) => event.id === id));
  const cloudSelected = collectEventIds(cloud).map((id) => cloudEvents.findIndex((event) => event.id === id));
  check(
    'PARITY Event selection (선택된 사건 · 순서)',
    localSelected.length > 0 && !localSelected.includes(-1) && JSON.stringify(localSelected) === JSON.stringify(cloudSelected),
    { local: localSelected, cloud: cloudSelected },
  );
}

/* ══════════════════════════════════════════════════════════════════ */

await schemaChecks();
await sourceChecks();
await routeChecks();
await parityChecks();

console.log(`\n${'─'.repeat(72)}`);
if (failures.length === 0) {
  console.log(`✅ Persistence Fixture — ${passed} checks passed`);
  console.log('ℹ️  Real Supabase RLS / auth smoke = BLOCKED (연결 가능한 dev/staging 프로젝트 없음)');
  process.exit(0);
}
console.log(`❌ ${failures.length} failed / ${passed} passed`);
for (const failure of failures) console.log(`  · ${failure}`);
process.exit(1);
