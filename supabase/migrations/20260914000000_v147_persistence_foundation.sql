-- ============================================================================
-- 럽유럽미 v1.47 — Relationship Persistence Foundation
-- ============================================================================
--
-- 목적: '로그인 기능'이 아니라 **관계 맥락을 저장하고 다시 이어보는 기반**.
--
-- ⚠️ 이 파일은 저장소 안의 migration이다. Dashboard에서 손으로 만든 설정에 의존하지 않는다.
-- ⚠️ production 프로젝트에는 사용자 승인 없이 적용하지 않는다(docs/v147_supabase_persistence.md).
--
-- 원칙
--   · 모든 행은 user_id 소유다. RLS 기준은 auth.uid() = user_id 하나뿐이다.
--   · 실명을 요구하지 않는다. label은 선택 별칭이다.
--   · 사건은 target_json 안의 배열이 아니라 relationship_events 행이다.
--   · analysis_runs는 '당시 결과'다 — UPDATE 정책이 없고 트리거가 수정을 막는다.
--   · revision은 낙관적 동시성 키다. UPDATE는 revision을 정확히 +1 해야 한다
--     (조용한 last-write-wins 금지).
--
-- 삭제 정책
--   · auth.users 삭제 → 해당 사용자의 모든 행 CASCADE 삭제
--   · relationship_targets 삭제 → 그 상대의 events · analysis_runs CASCADE 삭제
--     (상대를 지운다는 것은 그 관계의 기록을 지운다는 뜻이다)
--   · 보관(숨김)은 삭제가 아니라 archived_at 으로 한다
-- ============================================================================

-- ─────────────────────────────────────────────────────────── 공용 트리거 함수

create or replace function public.lym_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- revision은 정확히 +1만 허용한다. 오래된 revision으로 덮어쓰려는 시도는
-- 클라이언트에서 `.eq('revision', expected)`로 0행이 되고, 여기서 한 번 더 막힌다.
create or replace function public.lym_enforce_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.revision is distinct from old.revision + 1 then
    raise exception 'revision_conflict: expected %, got %', old.revision + 1, new.revision
      using errcode = '40001';
  end if;
  if new.user_id is distinct from old.user_id then
    raise exception 'owner_change_forbidden' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.lym_forbid_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'analysis_run_immutable' using errcode = '42501';
end;
$$;

-- ─────────────────────────────────────────────────────────── user_profiles

create table public.user_profiles (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  profile_json   jsonb not null,
  schema_version int   not null check (schema_version >= 1),
  revision       int   not null default 1 check (revision >= 1),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint user_profiles_json_object check (jsonb_typeof(profile_json) = 'object'),
  constraint user_profiles_json_size check (pg_column_size(profile_json) <= 262144)
);

-- ─────────────────────────────────────────────────────────── relationship_targets

create table public.relationship_targets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  label           text check (label is null or char_length(label) between 1 and 40),
  relation_status text,
  target_json     jsonb not null,
  schema_version  int   not null check (schema_version >= 1),
  revision        int   not null default 1 check (revision >= 1),
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- 복합 FK의 대상: 사건·분석이 **같은 소유자의** 상대에만 붙게 한다
  constraint relationship_targets_id_user unique (id, user_id),
  constraint relationship_targets_json_object check (jsonb_typeof(target_json) = 'object'),
  constraint relationship_targets_json_size check (pg_column_size(target_json) <= 262144)
);

create index relationship_targets_user_updated_idx
  on public.relationship_targets (user_id, updated_at desc);

-- ─────────────────────────────────────────────────────────── relationship_events

create table public.relationship_events (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  target_id   uuid not null,
  type        text not null check (type in (
                'affection_felt', 'conflict', 'contact_change', 'closer',
                'distance', 'care_received', 'meeting', 'other')),
  description text not null check (char_length(description) between 1 and 4000),
  my_reaction text check (my_reaction is null or char_length(my_reaction) <= 4000),
  revision    int  not null default 1 check (revision >= 1),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint relationship_events_target_owner
    foreign key (target_id, user_id)
    references public.relationship_targets (id, user_id)
    on delete cascade
);

create index relationship_events_target_created_idx
  on public.relationship_events (target_id, created_at);
create index relationship_events_user_idx
  on public.relationship_events (user_id);

-- ─────────────────────────────────────────────────────────── analysis_runs

create table public.analysis_runs (
  id                 uuid primary key,
  user_id            uuid not null references auth.users (id) on delete cascade,
  target_id          uuid,
  analysis_type      text not null check (analysis_type in ('mirror_history', 'deep_report')),
  -- accepted/rendered output만. raw Provider 응답 · 숨은 추론 · 원본 사건 전체 복제 금지
  result_snapshot    jsonb not null,
  source_fingerprint text,
  app_version        text,
  model_meta         jsonb,
  created_at         timestamptz not null default now(),
  constraint analysis_runs_snapshot_object check (jsonb_typeof(result_snapshot) = 'object'),
  constraint analysis_runs_snapshot_size check (pg_column_size(result_snapshot) <= 524288),
  -- target_id가 null이면(MATCH SIMPLE) 검사하지 않는다 — self 스냅샷
  constraint analysis_runs_target_owner
    foreign key (target_id, user_id)
    references public.relationship_targets (id, user_id)
    on delete cascade
);

create index analysis_runs_user_created_idx
  on public.analysis_runs (user_id, created_at desc);
create index analysis_runs_target_created_idx
  on public.analysis_runs (target_id, created_at desc);

-- ─────────────────────────────────────────────────────────── 트리거

create trigger user_profiles_revision before update on public.user_profiles
  for each row execute function public.lym_enforce_revision();
create trigger user_profiles_touch before update on public.user_profiles
  for each row execute function public.lym_touch_updated_at();

create trigger relationship_targets_revision before update on public.relationship_targets
  for each row execute function public.lym_enforce_revision();
create trigger relationship_targets_touch before update on public.relationship_targets
  for each row execute function public.lym_touch_updated_at();

create trigger relationship_events_revision before update on public.relationship_events
  for each row execute function public.lym_enforce_revision();
create trigger relationship_events_touch before update on public.relationship_events
  for each row execute function public.lym_touch_updated_at();

create trigger analysis_runs_immutable before update on public.analysis_runs
  for each row execute function public.lym_forbid_update();

-- ─────────────────────────────────────────────────────────── 권한 · RLS

revoke all on table public.user_profiles        from anon;
revoke all on table public.relationship_targets from anon;
revoke all on table public.relationship_events  from anon;
revoke all on table public.analysis_runs        from anon;

grant select, insert, update, delete on table public.user_profiles        to authenticated;
grant select, insert, update, delete on table public.relationship_targets to authenticated;
grant select, insert, update, delete on table public.relationship_events  to authenticated;
grant select, insert, delete         on table public.analysis_runs        to authenticated;

alter table public.user_profiles        enable row level security;
alter table public.relationship_targets enable row level security;
alter table public.relationship_events  enable row level security;
alter table public.analysis_runs        enable row level security;

-- user_profiles
create policy user_profiles_select on public.user_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy user_profiles_insert on public.user_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy user_profiles_update on public.user_profiles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy user_profiles_delete on public.user_profiles
  for delete to authenticated using ((select auth.uid()) = user_id);

-- relationship_targets
create policy relationship_targets_select on public.relationship_targets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy relationship_targets_insert on public.relationship_targets
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy relationship_targets_update on public.relationship_targets
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy relationship_targets_delete on public.relationship_targets
  for delete to authenticated using ((select auth.uid()) = user_id);

-- relationship_events
create policy relationship_events_select on public.relationship_events
  for select to authenticated using ((select auth.uid()) = user_id);
create policy relationship_events_insert on public.relationship_events
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy relationship_events_update on public.relationship_events
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy relationship_events_delete on public.relationship_events
  for delete to authenticated using ((select auth.uid()) = user_id);

-- analysis_runs — UPDATE 정책 없음(당시 결과는 수정하지 않는다)
create policy analysis_runs_select on public.analysis_runs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy analysis_runs_insert on public.analysis_runs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy analysis_runs_delete on public.analysis_runs
  for delete to authenticated using ((select auth.uid()) = user_id);
