# v1.47 Supabase Persistence Foundation

> 브랜치: `feat/v147-supabase-persistence` (base `4cbefd8` = v1.46.4 WIP, Core Value 미완료)
> 상태: **Foundation — 연결 전.** 실제 Supabase 프로젝트에 적용 · 검증되지 않았다(아래 BLOCKED).
> 사전 감사: [`v147_storage_audit.md`](./v147_storage_audit.md)

Supabase는 '로그인 기능'이 아니라 **관계 맥락을 저장하고 다시 이어보는 기반**이다.
Guest의 첫 가치 경험을 로그인으로 막지 않고, localStorage를 없애지 않는다.

---

## 1. Architecture

```
화면 (Privacy · AccountSection)
  └ AccountProvider (state/)         ← children을 막지 않음 · 설정 없으면 disabled
      └ localMigration                ← 동의(consent:true) 후에만
          └ repositories              ← profile · relationshipTarget · relationshipEvent · analysisRun
              └ PersistenceGateway    ← 포트
                  ├ supabaseGateway   ← 실제 Supabase (사용자 세션 + RLS)
                  └ memoryGateway     ← SQL 규칙을 흉내 낸 메모리 구현 (fixture · 오프라인 검증)
          └ mappers                   ← DB row ↔ 도메인 (JSONB는 여기서 끝난다)

SessionProvider ─ resetTargetContext() ─→ targetRegistry (lym.targets.v1, 로컬 관계 목록)
```

| 경로 | 역할 |
|---|---|
| `supabase/migrations/20260914000000_v147_persistence_foundation.sql` | 스키마 · FK · index · 트리거 · RLS |
| `src/lib/supabase/config.ts` | 공개 설정 판정. **secret/service_role 키는 거부** |
| `src/lib/supabase/client.ts` · `server.ts` | 공식 `@supabase/ssr` client (브라우저 · Route Handler) |
| `src/lib/supabase/types.ts` | DB row 타입 (persistence 밖으로 나가지 않음) |
| `src/lib/persistence/*` | 도메인 타입 · stable id · gateway · repository · mapper · snapshot guard · registry · migration |
| `src/state/AccountProvider.tsx` | 세션 복원 · Email OTP/Magic Link · 로그아웃 · 기기→계정 저장 · 계정 저장분 삭제 |
| `src/components/account/AccountSection.tsx` | Privacy 안의 작은 섹션. 설정 없으면 렌더하지 않음 |
| `src/app/auth/callback/route.ts` | Magic Link code → 세션 쿠키 |
| `src/app/api/dev/persistence-test/route.ts` · `tests/run-persistence-fixtures.mjs` | fixture (`npm run test:persistence`) |

의존성 추가: `@supabase/supabase-js@2.116.0`, `@supabase/ssr@0.12.7` (deprecated auth-helpers 미사용).

---

## 2. Schema

| 테이블 | 핵심 | 비고 |
|---|---|---|
| `user_profiles` | `user_id` PK → auth.users · `profile_json` · `schema_version` · `revision` | 나(status · declared · experience · mbti · 출생정보) |
| `relationship_targets` | `id` · `user_id` · `label`(선택 별칭, ≤40) · `relation_status` · `target_json` · `revision` · `archived_at` | `unique(id, user_id)` = 복합 FK 대상. 실명 요구 없음 |
| `relationship_events` | `id` · `user_id` · `target_id` · `type`(8종 CHECK) · `description` · `my_reaction` · `revision` | **target_json 배열이 아니라 행** |
| `analysis_runs` | `id` · `user_id` · `target_id?` · `analysis_type` · `result_snapshot` · `source_fingerprint` · `prompt_version` · `model` · `idempotency_key` · `app_version` | **UPDATE 불가**(정책 없음 + 트리거) · `UNIQUE(user_id, idempotency_key)` · `model_meta` jsonb는 `20260915000000`에서 제거 |

- FK: `relationship_events.(target_id, user_id)` · `analysis_runs.(target_id, user_id)` → `relationship_targets.(id, user_id)` — **같은 소유자의 상대에만** 붙는다.
- Index: `targets(user_id, updated_at desc)` · `events(target_id, created_at)` · `events(user_id)` · `runs(user_id, created_at desc)` · `runs(target_id, created_at desc)`.
- 삭제 정책: auth.users 삭제 → 전부 CASCADE / 상대 삭제 → 그 상대의 사건 · 분석 CASCADE / 숨김은 `archived_at`.
- 트리거: `lym_enforce_revision`(UPDATE는 revision +1만, 소유자 변경 금지) · `lym_touch_updated_at` · `lym_forbid_update`(analysis_runs).
- JSON 크기 CHECK: profile/target 256KB, snapshot 512KB.

## 3. Source of truth

| 사용자 | 원천 | 캐시/상태 |
|---|---|---|
| Guest | localStorage (`lym.session.v1` · `lym.history.v1` · `lym.targets.v1`) | React state |
| Authenticated | Supabase(사용자가 저장한 것) | localStorage는 **그대로 유지**. 이번 단계에서 화면 계산은 여전히 로컬 세션에서 한다 |

`SessionAnswers` 모양은 바꾸지 않았다(AI fingerprint · fixture 안정성). 상대 id는 `lym.targets.v1`에 둔다.

## 4. Guest / Auth flow

```
Guest ─ 궁합 · Mirror · 사건 · Premium (전부 로컬, 변화 없음)
  └ Privacy › 계정에 저장(선택)          ← NEXT_PUBLIC_SUPABASE_* 가 있을 때만 보임
      └ 이메일 → 로그인 코드(OTP) 또는 메일 링크(/auth/callback)
          └ 로그인됨 — 자동 업로드 없음
              └ "이 기기에 입력한 정보를 계정에 저장할까?"  [나중에] [계정에 저장하기]
                  └ migration 결과 안내
      └ 로그아웃 (기기 데이터 그대로) · 계정 저장분 삭제 (기기 데이터 그대로)
```

- 첫 가치 전에 로그인을 요구하지 않는다. Social OAuth · 결제 연결 없음.
- 세션 복원: `getSession()` + `onAuthStateChange`.

## 5. Migration (기기 → 계정)

| 항목 | 내용 |
|---|---|
| 대상 | 나(profile) · 지금 상대 · 로컬에 보관된 이전 상대들 · 상대별 사건 · History 스냅샷(→ analysis_runs `mirror_history`) |
| 제외 | 사진 · 사진 관찰 결과(observedAnalysis) · AI 캐시 · analytics |
| 동의 | `consent !== true`면 요청 0건(`consent_required`) |
| 로컬 | **읽기만** 한다 |
| 멱등 | cloud target id = `uuidv5(userId:localTargetId)`(이 사용자가 이미 저장한 관계면 link의 id) · event id = `uuidv5(cloudTargetId:localEventId)`(이미 UUID면 그대로) · History run id = `uuidv5(history:userId:entryId)` · 전부 insert-if-absent |
| 이미 다른 값 | 덮어쓰지 않고 `conflicts`(entity + id만) · 충돌한 상대에는 사건을 섞지 않음 |
| 중간 실패 | offline/unauthorized에서 멈춤 → `partial` · 재시도하면 남은 것만 |

결과 status: `consent_required · nothing_to_migrate · unauthorized · offline · completed · completed_with_conflicts · partial · failed`.

## 6. Multi-target · Analysis snapshot

- **새로운 사람과 궁합 보기**: `resetTargetContext()`가 세션을 비우기 직전 `preserveActiveTarget()`으로 이전 상대 맥락(상대 정보 · 사건 · 현재 관계 근거 · 저장 질문 · funnelAnalysisId)을 `lym.targets.v1`에 보관하고 새 activeTargetId를 발급한다. 세션 초기화 자체와 점수 · 화면은 그대로다.
- `switchToSavedTarget()` · `localRelationshipSummaries()` · `targetRepository.listSummaries()`(별칭 · 관계 상태 · 마지막 분석 시각)는 **domain/service 수준까지** 구현했다. 목록/전환 UI는 붙이지 않았다(내비게이션 재설계 금지).
- analysis_runs: 새 분석 = 새 random UUID 행(`recordGenerated`). 같은 생성 결과의 retry는 idempotency key로 막는다(§9-3). id가 결정론인 History 스냅샷은 `record` — 같은 id 재기록은 덮어쓰지 않고 `differs`로 알린다. `validateSnapshot()`이 raw Provider 응답 · 추론 · 프롬프트 · AI payload · 사건 본문 · 생년월일 · 사진 키를 거부한다.
- 저장 정책(§9-4): Guest는 분석 결과를 로컬에만 둔다. 로그인 + '이 관계 저장하기' 동의가 있는 관계만 cloud에 저장하고, 그 관계의 성공한 분석은 다시 묻지 않고 snapshot한다(`analysisSaveDecision` · `recordAnalysisForRelationship`). **화면 흐름(Deep Report 렌더 확정 시점)에는 아직 연결하지 않았다.**

## 7. RLS

모든 테이블: `(select auth.uid()) = user_id` 하나로 SELECT/INSERT/UPDATE/DELETE(analysis_runs는 UPDATE 없음). `anon` 권한 회수. service_role은 앱 어디에서도 쓰지 않는다.

### 실제 프로젝트에서의 교차 사용자 검증 절차 (BLOCKED — 연결 후 수행)

dev/staging 프로젝트 SQL Editor에서, 테스트 사용자 A/B(대시보드에서 생성)의 uuid로:

```sql
-- A로 행 만들기
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<A>","role":"authenticated"}';
insert into public.relationship_targets (id, user_id, target_json, schema_version)
  values ('00000000-0000-4000-8000-00000000000a', '<A>', '{}', 1);
commit;

-- B로 시도 — 전부 0행 또는 에러여야 한다
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<B>","role":"authenticated"}';
select count(*) from public.relationship_targets;                                   -- 0
insert into public.relationship_targets (user_id, target_json, schema_version)
  values ('<A>', '{}', 1);                                                            -- 42501
update public.relationship_targets set label = 'x'
  where id = '00000000-0000-4000-8000-00000000000a';                                 -- UPDATE 0
delete from public.relationship_targets
  where id = '00000000-0000-4000-8000-00000000000a';                                 -- DELETE 0
insert into public.relationship_events (id, user_id, target_id, type, description)
  values (gen_random_uuid(), '<B>', '00000000-0000-4000-8000-00000000000a', 'other', 'x'); -- 23503
rollback;

-- analysis_runs 불변 · revision
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<A>","role":"authenticated"}';
update public.relationship_targets set label = 'y', revision = revision + 2
  where id = '00000000-0000-4000-8000-00000000000a';                                 -- 40001
rollback;
```

같은 검사를 4개 테이블에 반복한다. 앱 코드 쪽 동작은 `npm run test:persistence`의 `rls` 섹션(메모리 gateway)이 고정한다.

## 8. Failure handling

| 상황 | 동작 |
|---|---|
| env 없음 | `disabled` — 요청 0건 · 계정 UI 없음 · 로컬 흐름 그대로 |
| Supabase 장애 / 오프라인 | gateway가 예외 대신 `offline` 결과. migration은 멈추고 로컬 불변 |
| 세션 만료 | `unauthorized` → "다시 로그인" 안내 |
| 다른 기기에서 먼저 수정 | revision 불일치 → `conflict` + 원격 최신값. 덮어쓰지 않음. UX 문구: `다른 곳에서 정보가 바뀌었어. [최신 정보 불러오기]`(`SYNC_CONFLICT_COPY`) |
| 손상된 클라우드 JSON | 로컬 복원과 같은 sanitize를 통과(유효하지 않은 값은 미입력으로 강등, 사건은 버림) |
| registry 저장 실패(quota) | 흐름은 막지 않음(세션 저장 정책과 동일) |

## 9. Privacy

- Privacy 화면: 연결 전 빌드는 **기존 문장 그대로** + "상대 정보는 네가 입력한 정보(상대가 확인한 정보 아님)" 한 섹션 추가. 연결된 빌드에서만 클라우드 저장 · "계정 저장과 AI 분석은 별개" · 계정 저장분 삭제 안내가 보인다.
- 클라우드 저장 ≠ AI Provider 처리. 계정 저장은 Provider 전송을 늘리지 않는다.
- analytics 외부 전송 금지 키에 `target_label · targetLabel · email` 추가. 사건 본문 · 반응은 analytics.ts에 필드명 자체가 없고(SEM-06), 어떤 `trackEvent` 호출도 본문 · 반응 · 별칭 · 이메일 · 생년월일 property를 싣지 않는다(persistence fixture 정적 검사). persistence · 계정 코드는 analytics · console 로그를 쓰지 않는다. gateway 에러 메시지에 행 내용이 없다.

## 9-1. Storage Capacity Guard (NextStep §1~§10 · §29~§32)

**Supabase는 사진 저장소가 아니다.** 이번 버전은 Supabase Storage bucket을 쓰지 않고, 테이블에도 텍스트와 최소 메타데이터만 둔다.

| 규칙 | 구현 |
|---|---|
| 모든 cloud write 직전 검사 | `src/lib/persistence/cloudWriteBudget.ts` — `rejectCloudPayload()`를 supabaseGateway · memoryGateway의 insert · update **맨 앞**에서 부른다(요청을 만들기 전) |
| 상수는 한 파일 | `CLOUD_WRITE_BUDGET` — 행 바이트(profile 32KB · target 32KB · event 16KB · analysis 128KB) · 문자열 12KB · 사건 본문 4000자 · 별칭 40자 · 배열 200 · 깊이 12. SQL CHECK와 같거나 더 엄격(fixture가 SQL 숫자와 비교) |
| 사진 · 바이너리 차단 | 필드 이름(photo · image · thumbnail · screenshot · objectUrl · dataUrl · base64 · blob · file · audio · video) · 값(`data:image/` · `;base64,` · `blob:` · 긴 base64 문자열 · ArrayBuffer/typed array) → `payload_rejected` |
| Provider 원문 차단 | raw · choices · completion · reasoning · prompt · messages · aiContext · debug · trace 키 → 거부 |
| 원문 한 곳에만 | 사건 본문 · 반응은 `relationship_events` 행에만. JSON 칸 안의 `events` · `description` · `myReaction` → 거부. `target_json`은 mapper가 도메인 칸만 옮긴다 |
| 분석 스냅샷 | `deepReportRunInput()` — `renderedResult`(카드 · actionPlan 화면 문장 + 판정 · id · ref) · `candidateIds` · `usedEvidenceRefs` · `usedEventIds`. 모델 · 프롬프트 버전은 칸(column). `reportedScenes`(원문) 없음. 저장 시 `forbiddenTexts`(사건 본문)가 스냅샷에 다시 들어가면 거부 |
| 몰래 자르지 않는다 | mapper의 `slice()` 절단 제거. 너무 크면 **write 실패 + 로컬 원본 유지 + 어떤 칸이 왜 문제인지(path · reason, 값 없음) 반환** |
| 기존 행 보호 | 거부는 gateway 앞에서 멈춘다 — 기존 cloud row의 본문 · revision 그대로 |
| migration | repository 단위 작은 write. 거부된 항목만 `rejected`(entity · id · issues)로 모으고 나머지는 계속 → `completed_with_rejections`. 상대가 거부되면 그 상대의 사건은 올리지 않는다. `bytes`(profile · targets · events · analysisRuns · total) 측정 |

실측(`npm run test:persistence`, fixture 세션 기준):

| payload | bytes |
|---|---|
| profile 행 | 518 |
| target 행 | 736 |
| event 행(사건 1개) | 315 |
| deep report analysis 행 | 1,951 |
| migration batch(나 · 상대 1 · 사건 3 · History 2) | 5,174 |

| 사건 수 | 사건 행 합계 | Deep Report 스냅샷 | migration 합계 |
|---|---|---|---|
| 10 | 3,690 | 1,660 | 7,803 |
| 100 | 37,080 | 1,660 | 41,193 |
| 500 | 186,280 | 1,660 | 190,393 |

→ 사건이 늘면 사건 행만 늘고, 분석 스냅샷은 커지지 않는다.

## 9-2. 테스트는 실제 AI Provider를 부르지 않는다 (P0)

`.env.local`이 `AI_MODE=real`이어도 `tests/run-*.mjs`는 모두 `tests/_aiTestGuard.mjs`를 import해 테스트 헤더를 붙이고, 서버는 그 요청을 mock으로 처리한다. 실제 호출은 `ALLOW_REAL_AI_TESTS=1`일 때만(`test:ai:real` · semantic provider QA). `npm run test:ai-guard`가 고정하고, `GET /api/dev/ai-guard`로 실제 호출 수를 본다.

## 9-3. Analysis run 정책 · idempotency (Clean Base §7 · §11)

| 칸 | 값 |
|---|---|
| `id` | 새 분석마다 `crypto.randomUUID()` |
| `target_id` | **cloud** target id (로컬 슬롯 id 아님) |
| `analysis_type` | `deep_report` · `mirror_history` |
| `result_snapshot` | `renderedResult` · `candidateIds` · `usedEvidenceRefs` · `usedEventIds` — 이 네 칸뿐(`DEEP_REPORT_SNAPSHOT_KEYS`) |
| `source_fingerprint` · `prompt_version` · `model` · `app_version` · `created_at` | 스칼라 칸. 작은 값을 JSONB로 두지 않는다 |
| `idempotency_key` | `sha256(userId \| targetId \| analysisType \| sourceFingerprint \| generationRequestId)` hex · `UNIQUE(user_id, idempotency_key)` |

- 같은 retry(같은 `generationRequestId`) → 기존 행을 돌려준다(`created:false`). 동시에 두 번 들어가면 두 번째 INSERT가 23505 → 기존 행을 다시 읽는다.
- 사용자가 다시 분석 → 새 `generationRequestId` → 새 행. 입력 지문이 바뀌어도 새 행.
- 금지: Target/Profile 전체 JSON · 사건 본문 복제 · 사진 · Provider raw · prompt · debug payload(키 · 원문 검사 둘 다).
- fixture: `analysis_policy` — ANALYSIS-01~05 · IDEMP-01~06.

## 9-4. Local/cloud id · 관계 저장 동의 · 계정 전환 (Clean Base §10 · §12)

```
Guest                     분석 결과 = 로컬만. cloud 요청 0
로그인                    그것만으로는 업로드 없음
'이 관계 저장하기' 동의   (userId, localTargetId) → cloudTargetId link  (lym.cloudLinks.v1, 사용자별)
저장한 관계의 분석        성공할 때마다 그 관계에 snapshot — 매번 다시 묻지 않음
계정 전환                 다른 사용자의 link는 보지 않음 → 자동 공유 · 자동 복사 없음
                          B가 동의하면 B용 새 cloud id (A 행과 겹치지 않음)
계정 저장분 삭제          그 사용자의 link만 지움
```

- `cloudLinks.ts`: `grantRelationshipSave` · `analysisSaveDecision` · `saveRelationshipToCloud`(기기 전체 저장과 같은 `migratePlan` 경로 · 세션 사용자 불일치면 멈춤) · `recordAnalysisForRelationship` · `loadSavedRelationship`.
- 기기 전체 저장(동의 버튼)도 같은 매핑을 쓰고, 계정에 들어간 상대마다 link를 남긴다(`AccountProvider`).
- fixture: `cross_account`(ACCOUNT-01~05) · `saved_relationship`(SAVE-01~10: Guest → login → 동의 → 저장 → 분석 snapshot → logout → login → 상대 · 사건 · 최근 분석 복원) · `account_switch`(A → B → A).
- ⚠️ 전부 **메모리 gateway** 검증이다. 실제 Supabase RLS · Auth는 연결 후 §7 절차로 확인해야 한다.

## 9-5. Model-aware cache · Deep Report routing

- 캐시 키: `task::promptVersion::model=<resolved model>::bundleSignature` (`src/services/ai/aiCacheKey.ts`). 모델 칸은 코드 상수가 아니라 **서버 응답 `meta.model`**로 확정된다 — env로만 모델을 바꿔도 이전 모델 결과가 캐시에서 나오지 않는다. 지문(bundle signature)은 입력만 담는다.
- 라우팅(v1.47 Integration): **코드에 모델 id가 없다.** Deep Report = dev override(non-production) → `AI_MODEL_DEEP_REPORT` → 공용 `AI_MODEL`. local/dev · preview/staging은 `AI_MODEL_DEEP_REPORT=gpt-5.4`, production은 명시 설정할 때만. 렌즈 · Cross-Lens · 그 밖의 Task는 공용 `AI_MODEL`. 호출 수 불변(Deep Report 1 · 렌즈 3 · Cross-Lens 1).
- fixture: `npm run test:model-routing` — CACHE-01~05 · ROUTE-ENV-01~07 · ROUTE-06 · 실제 Provider 호출 0.
- real smoke(유료 · opt-in): `ALLOW_REAL_AI_TESTS=1 npm run test:ai:deep-report-smoke` — resolved model · 호출 1 · 캐시 키 모델 · 렌더. 2026-09-14 1회 PASS(gpt-5.4 · 27.6s · Top 3 semantic_ai 3/3 · actionPlan plan).

## 9-6. Integration pass — logical run · 관계 저장 UI · 분석 snapshot 저장

**generationRequestId = 한 번의 분석 행위** (`src/lib/logicalRun.ts`)

```
분석 시작          deepReportRuns.begin(fingerprint) → 새 UUID
실패 뒤 retry      같은 UUID (닫히지 않았다)
결과 확정          close → 다음 분석은 새 UUID
서버               형식만 확인하고 결과 data.generationRequestId로 돌려준다 · requestId는 로그용
```

**'이 관계 저장하기'** — 궁합 결과에서 점수 · 잘 맞는/확인할 신호를 **본 뒤**, Premium 진입 앞(`SaveRelationshipCard`).

```
offer → (Guest) InlineAuth(이메일 코드 · 메일 링크, Privacy와 같은 폼) → consent → 저장 → 저장됨
      → (로그인됨) consent → 저장 → 저장됨
```

- 단계 판정: `saveRelationshipStage`(순수). Supabase 설정 없음이면 hidden — Guest 화면 불변.
- 저장: `saveActiveRelationshipWith` — 나 최소값 · 지금 상대 · 사건 · link. 실패하면 link를 남기지 않는다.
- link 복구: 로그인 뒤 link가 없으면 결정론 cloud id로 **읽기만** 해서 다시 잇는다(`recoverCloudLink`).

**Deep Report analysis_run 저장** (`lib/persistence/deepReportSnapshot.ts` · `DeepReportSnapshotSaver`)

| 저장 | 저장 안 함 |
|---|---|
| 로그인 · 이 사용자가 저장한 관계 · status ready · real/mock · 리포트 available · Top 3 semantic_ai ≥1 또는 AI plan · generationRequestId 있음 · **렌더 커밋 뒤(useEffect)** | Guest · 저장 안 한 관계 · Provider 실패 · demo · 게이트 거부 · verify_only fallback만 · 렌더 전 · id 없음 |

- 스냅샷의 사건 id는 **cloud 사건 id**로 바꿔 저장한다. 원문 복제 검사 · idempotency key(§9-3) 그대로.
- fixture: `logical_run`(GEN-01~06) · `save_relationship_ui`(SAVE-UI-01~07) · `analysis_run_flow`(RUN-01~07) · `link_recovery`(LINK-01~04) + 정적 배치 검사.

## 9-7. 저장한 관계 (최소 UI)

- 위치: **Home › '최근 분석' 바로 아래** `저장한 관계` 섹션(`SavedRelationshipsSection`). 새 화면 · 내비게이션 없음.
  Profile 전용 화면이 없고, Home이 이미 '다시 보기' 맥락(최근 궁합 · Mirror)을 갖고 있어 같은 자리에 둔다.
- 로그인한 사용자에게만 그린다. Guest · Supabase 미설정이면 Home 불변.
- 행: `별칭 · 관계 상태` / `최근 분석 M월 D일`(Asia/Seoul). 별칭이 없으면 '이름 없는 관계'. 긴 별칭은 CSS 말줄임만(자르지 않음).
  분석이 최근인 관계가 위. 지금 보는 관계는 '보는 중'.
- 빈 상태: "아직 저장한 관계가 없어. / 관계를 저장하면 다음에 다시 볼 수 있어."
- 목록 읽기는 `listSummaries()` select만 — 로그인만으로 cloud write 0.
- 열기(`hydrateSavedRelationship` → `applySavedRelationship`):
  cloud 상대 · 사건 → 세션. 지금 상대는 기기 목록에 보관. 현재 관계 근거 · 저장 질문 · 사건은 그 관계의 cloud 값으로 바뀌고,
  Premium intent · preview unlock은 `resetTargetContext`와 같이 비운다. 이미 보는 관계를 다시 열면 세션을 바꾸지 않는다.
  다른 기기에서 저장한 관계는 cloud id를 기기 슬롯 이름으로 쓰고 link를 남긴다 — 다시 저장해도 중복 없음.
- fixture: `saved_relationships`(SAVED-01~08: 0 · 1 · 3 · 10개 · 클릭 hydrate · A→B→A · logout/login · 새 기기 · 다른 계정) + 정적 검사.
- 레이아웃 미리보기(개발 전용 · 합성 데이터 · 네트워크 없음): `/dev/saved-relationships?count=0|1|3|10`. production 404.

## 10. Known limitations

1. **실제 Supabase에 적용 · 검증되지 않음.** `docs/supabase-info.md`(project id · publishable key 있음 · 환경 표기 없음)의 host는 2026-09-14 재검증에서 로컬 ISP · Google(8.8.8.8) · Cloudflare(1.1.1.1) 세 resolver 모두 NXDOMAIN이고 `supabase.co` 자체는 해석된다 — 네트워크 문제가 아니라 **프로젝트가 없거나(삭제) project id가 다르다.** 일시정지 프로젝트는 보통 DNS가 남는다. dev/staging 표기도 없어 연결되더라도 migration 전에 확인이 필요하다. `.env.local`에는 반영하지 않았다(없는 host를 가리키면 계정 UI만 실패한다).
2. RLS 교차 사용자 · auth smoke는 메모리 gateway + 정적 SQL 검사까지다.
3. 로그인 후에도 **지속 동기화는 없다.** 저장은 사용자가 누른 시점의 스냅샷 migration이고, 이후 로컬 수정은 다시 저장해야 올라간다(같은 내용은 중복되지 않지만, 바뀐 내용은 conflict로 보고되고 덮어쓰지 않는다). revision 기반 update API는 있으나 UI에 연결하지 않았다.
4. 클라우드 → 기기 불러오기(다른 기기에서 이어보기) UI 없음. `sessionWithCloudContext()`와 parity fixture까지만.
5. 저장된 관계 목록 · 전환 UI 없음(service 수준까지).
6. ~~두 번째 계정 id 충돌~~ → 해결(§9-4). 같은 로컬 슬롯이라도 계정마다 cloud id가 다르다. link가 localStorage에서 사라져도 로그인 뒤 결정론 id로 읽기만 해서 복구한다(§9-6). 단 기기 상대 목록(`lym.targets.v1`)까지 사라지면 localTargetId가 바뀌어 복구할 수 없다 — 다시 저장하면 새 관계 행이 생긴다.
7. '이 관계 저장하기' · 렌더 뒤 snapshot 저장 · 저장한 관계 목록/열기를 연결했다(§9-6 · §9-7). CTA · 목록은 Supabase 설정 + 로그인이 있어야 보이므로 **실제 저장 → 로그아웃 → 로그인 → 복원 화면 확인은 dev 프로젝트 연결 후**다(지금은 메모리 gateway fixture와 레이아웃 미리보기까지).
10. `feat/v147-supabase-persistence-clean`은 안정 base `b6f2a2d`(Core Value Final Fix) 위에 다시 쌓았다. 이전 `feat/v147-supabase-persistence`는 참고용으로 남겨 두었다(force push 없음).
8. Magic Link는 Supabase 대시보드의 Site URL / Redirect URL(`/auth/callback`) 설정이 필요하다. OTP 코드 입력은 이메일 템플릿에 `{{ .Token }}`이 있어야 한다.
9. middleware 기반 세션 갱신은 넣지 않았다(서버 렌더에서 사용자 데이터를 읽는 곳이 아직 없다).

## 11. Setup (dev/staging 전용)

1. Supabase에서 **dev/staging** 프로젝트를 준비한다. production에는 사용자 승인 없이 적용하지 않는다.
2. SQL Editor 또는 `supabase db push`로 `supabase/migrations/20260914000000_v147_persistence_foundation.sql` → `20260915000000_v147_analysis_run_policy.sql` 순서로 적용.
3. Authentication → Email 활성화 · Site URL · Redirect URL(`http://localhost:3000/auth/callback`) 추가 · (OTP 입력을 쓰려면) 이메일 템플릿에 `{{ .Token }}`.
4. `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY`(anon/publishable) — **secret/service_role 금지**(코드도 거부한다).
5. dev 서버 재시작 → Privacy에 "계정에 저장 (선택)"이 보이는지 확인.
6. §7 RLS 절차 수행 → 결과를 이 문서에 기록.
7. `npm run test:persistence` (dev 서버 필요).
