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
| `analysis_runs` | `id` · `user_id` · `target_id?` · `analysis_type` · `result_snapshot` · `source_fingerprint` · `app_version` · `model_meta` | **UPDATE 불가**(정책 없음 + 트리거) |

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
| 멱등 | target id = registry의 stable UUID · event id = `uuidv5(targetId:localEventId)`(이미 UUID면 그대로) · run id = History id(UUID면 그대로, 아니면 uuidv5) · 전부 insert-if-absent |
| 이미 다른 값 | 덮어쓰지 않고 `conflicts`(entity + id만) · 충돌한 상대에는 사건을 섞지 않음 |
| 중간 실패 | offline/unauthorized에서 멈춤 → `partial` · 재시도하면 남은 것만 |

결과 status: `consent_required · nothing_to_migrate · unauthorized · offline · completed · completed_with_conflicts · partial · failed`.

## 6. Multi-target · Analysis snapshot

- **새로운 사람과 궁합 보기**: `resetTargetContext()`가 세션을 비우기 직전 `preserveActiveTarget()`으로 이전 상대 맥락(상대 정보 · 사건 · 현재 관계 근거 · 저장 질문 · funnelAnalysisId)을 `lym.targets.v1`에 보관하고 새 activeTargetId를 발급한다. 세션 초기화 자체와 점수 · 화면은 그대로다.
- `switchToSavedTarget()` · `localRelationshipSummaries()` · `targetRepository.listSummaries()`(별칭 · 관계 상태 · 마지막 분석 시각)는 **domain/service 수준까지** 구현했다. 목록/전환 UI는 붙이지 않았다(내비게이션 재설계 금지).
- analysis_runs: 새 실행 = 새 행. 같은 id 재기록은 덮어쓰지 않고 `differs`로 알린다. `validateSnapshot()`이 raw Provider 응답 · 추론 · 프롬프트 · AI payload · 사건 본문 · 생년월일 · 사진 키를 거부한다.
- 동일 input 재실행 정책: 현재 Deep Report는 저장하지 않고 재계산하며 AI 결과는 메모리 캐시뿐이다(감사 §2). 그래서 이번 단계는 **자동 저장을 붙이지 않았다** — Deep Report 저장 시점(렌더 확정 · entitlement)과 id 규칙은 결정이 필요하다.

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

## 10. Known limitations

1. **실제 Supabase에 적용 · 검증되지 않음.** `docs/supabase-info.md`의 project(`tcltmqertkbbdpqtkola`)는 DNS NXDOMAIN(2026-09-14) — 삭제/일시정지/오기 가능성. dev/staging 여부도 미확인.
2. RLS 교차 사용자 · auth smoke는 메모리 gateway + 정적 SQL 검사까지다.
3. 로그인 후에도 **지속 동기화는 없다.** 저장은 사용자가 누른 시점의 스냅샷 migration이고, 이후 로컬 수정은 다시 저장해야 올라간다(같은 내용은 중복되지 않지만, 바뀐 내용은 conflict로 보고되고 덮어쓰지 않는다). revision 기반 update API는 있으나 UI에 연결하지 않았다.
4. 클라우드 → 기기 불러오기(다른 기기에서 이어보기) UI 없음. `sessionWithCloudContext()`와 parity fixture까지만.
5. 저장된 관계 목록 · 전환 UI 없음(service 수준까지).
6. 같은 기기 데이터를 **두 번째 계정**에 저장하면 stable id가 첫 계정 행과 겹쳐 conflict로 남는다(첫 계정 데이터는 보호됨). 계정 전환 시 id 재발급 정책은 미결정.
7. Deep Report 결과 자동 저장 없음(§6).
8. Magic Link는 Supabase 대시보드의 Site URL / Redirect URL(`/auth/callback`) 설정이 필요하다. OTP 코드 입력은 이메일 템플릿에 `{{ .Token }}`이 있어야 한다.
9. middleware 기반 세션 갱신은 넣지 않았다(서버 렌더에서 사용자 데이터를 읽는 곳이 아직 없다).

## 11. Setup (dev/staging 전용)

1. Supabase에서 **dev/staging** 프로젝트를 준비한다. production에는 사용자 승인 없이 적용하지 않는다.
2. SQL Editor 또는 `supabase db push`로 `supabase/migrations/20260914000000_v147_persistence_foundation.sql` 적용.
3. Authentication → Email 활성화 · Site URL · Redirect URL(`http://localhost:3000/auth/callback`) 추가 · (OTP 입력을 쓰려면) 이메일 템플릿에 `{{ .Token }}`.
4. `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY`(anon/publishable) — **secret/service_role 금지**(코드도 거부한다).
5. dev 서버 재시작 → Privacy에 "계정에 저장 (선택)"이 보이는지 확인.
6. §7 RLS 절차 수행 → 결과를 이 문서에 기록.
7. `npm run test:persistence` (dev 서버 필요).
