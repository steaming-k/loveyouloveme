# Supabase 연결 정보

> ⚠️ **이 파일에는 실제 연결값을 적지 않는다.** publishable/anon key라도 적지 않는다.
> 이 파일은 git에 추적된다. 값을 적으면 그대로 커밋된다.

## 실제 연결값은 `.env.local`에서만 관리한다

`.env.local`은 `.gitignore`(`.env*.local`) 대상이다.

필수:

- `NEXT_PUBLIC_SUPABASE_URL` — `https://<project-ref>.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon / publishable key

금지:

- service_role · secret key를 브라우저 · 클라이언트 코드 · 이 저장소 어디에도 두지 않는다
  (`src/lib/supabase/config.ts`가 secret · service_role 형태의 키를 거부한다).
- Supabase Storage bucket을 쓰지 않는다. 사진 · 바이너리는 Supabase에 저장하지 않는다.

## 환경 구분

| 환경 | migration | 비고 |
|---|---|---|
| dev / staging | 개발 중 적용 허용 | **dev/staging이라는 명시(프로젝트 이름 · 사용자 확인)가 있을 때만** |
| production | **별도 사용자 승인 필요** | 이 저장소 작업에서 적용하지 않는다 |

환경 표기가 없거나 production 가능성이 있으면 migration을 적용하지 않는다.

## 연결 절차

1. dev/staging 프로젝트를 준비하고 환경을 확인한다.
2. `.env.local`에 위 두 값을 넣는다(출력 · 공유하지 않는다).
3. `docs/v147_supabase_persistence.md` §11 Setup 순서로 migration · Auth 설정 · RLS 검증을 진행한다.

## 이력

- 2026-09-14 v1.47 Cleanup — 이전에 이 파일에 있던 project ref · publishable key는 DNS NXDOMAIN
  (로컬 · Google · Cloudflare resolver 모두)이고 환경 표기가 없어 **연결 source-of-truth에서 제외했다.**
  secret · service_role 값은 git 이력에 없다(감사 결과). 이력 재작성은 하지 않았다.
