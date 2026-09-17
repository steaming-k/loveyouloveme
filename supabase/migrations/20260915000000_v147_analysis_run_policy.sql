-- ============================================================================
-- 럽유럽미 v1.47 — analysis_runs 저장 정책 (Clean Base)
-- ============================================================================
--
-- 20260914000000_v147_persistence_foundation.sql 위에 얹는 additive migration.
-- ⚠️ production 프로젝트에는 사용자 승인 없이 적용하지 않는다.
--
-- 저장하는 것 (docs/v147_supabase_persistence.md §9-3)
--   id · target_id · analysis_type · result_snapshot(renderedResult · candidateIds ·
--   usedEvidenceRefs · usedEventIds) · source_fingerprint · prompt_version · model ·
--   app_version · created_at
--
-- 저장하지 않는 것
--   Target/Profile 전체 JSON · 사건 본문 복제 · 사진 · Provider raw 응답 · prompt · debug payload
--
-- 멱등 (retry 중복 방지)
--   idempotency_key = sha256(user_id | target_id | analysis_type | source_fingerprint | generation_request_id)
--   같은 생성 결과의 재시도는 같은 키 → UNIQUE(user_id, idempotency_key)로 두 번째 INSERT가 막힌다.
--   사용자가 다시 분석하면 generation_request_id가 새것이라 새 행이 된다.
--   History 스냅샷처럼 id 자체가 결정론인 행은 키가 null이다(NULL은 UNIQUE에서 서로 다르다).
-- ============================================================================

alter table public.analysis_runs
  add column prompt_version  text,
  add column model           text,
  add column idempotency_key text;

alter table public.analysis_runs
  add constraint analysis_runs_prompt_version_len
    check (prompt_version is null or char_length(prompt_version) between 1 and 80),
  add constraint analysis_runs_model_len
    check (model is null or char_length(model) between 1 and 80),
  add constraint analysis_runs_idempotency_key_format
    check (idempotency_key is null or idempotency_key ~ '^[0-9a-f]{64}$'),
  add constraint analysis_runs_user_idempotency unique (user_id, idempotency_key);

-- model_meta(jsonb)는 prompt_version · model 두 컬럼으로 대체한다 — 작은 스칼라 값을 JSONB로 두지 않는다
alter table public.analysis_runs drop column model_meta;
