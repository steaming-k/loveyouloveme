# UT-2 운영 Runbook

> 대상: UT 진행자 · 운영자. 참가자에게는 이 문서도, `/ut` 화면도 보여주지 않는다.
> 기준 브랜치: `feat/v147-supabase-persistence-clean` (v1.47). 관계 저장 · 재방문(Supabase)은 **UT-2 범위 밖**이다.

---

## 0. 1분 체크리스트 (참가자마다)

```
[ ] UT Preview 배포 주소인가 (Production 주소 아님)
[ ] /ut 열기 → UT READY
[ ]   UT mode           ✓ (UT 배포 — 새 탭에서도 유지)
[ ]   Premium CTA · Paywall 노출 ✓
[ ]   Deep Report 통로   ✓
[ ]   feature flag가 꺼져도 UT에서 열림 ✓
[ ]   실제 결제 불가     ✓
[ ]   필수 화면 8개 응답 ✓
[ ]   AI 모드            ✓ real  (! demo면 AI 문장 없이 규칙 리포트만 — 의도한 게 아니면 env 확인)
[ ]   참가자 화면에 개발 도구 없음 ✓
[ ] 이전 참가자 결과를 'UT 결과 내보내기'로 받았는가
[ ] '다음 참가자 준비 (초기화)' → 온보딩이 열렸는가
[ ] 참가자 시작 URL로 새 탭을 열어 건넨다
```

---

## 1. Preview URL

- UT 전용 **Vercel Preview 배포**를 쓴다(이 브랜치의 Preview). 주소는 배포 후 여기에 적는다:
  `UT Preview URL: ______________________`
- Production(`loveyouloveme.vercel.app`)으로 UT를 진행하지 않는다 — 운영자 화면(`/ut`)이 404이고, 새 탭에서 UT가 유지되지 않는다.

## 2. UT env 확인

값 자체(키)는 출력 · 공유하지 않는다. **있는지 / 무슨 모드인지만** 본다.

| 설정 | UT Preview | Production (일반 사용자) | 비고 |
|---|---|---|---|
| `NEXT_PUBLIC_UT_MODE` | **`true`** | `false` / 없음 | UT 판정 1순위. 새 탭 · 새로고침 · 직접 URL에서도 UT |
| `NEXT_PUBLIC_PREMIUM_FAKE_DOOR` | 아무 값 (권장 `true`) | `true` | UT에서는 꺼져 있어도 Premium이 열린다 |
| `NEXT_PUBLIC_PREMIUM_PREVIEW` | `false` 권장 | `false` | UT에서는 꺼져 있어도 Deep Report 통로가 열린다 |
| `NEXT_PUBLIC_AI_DEBUG` | **`false`** | `false` | `true`면 참가자 화면에 AI 버튼이 보인다(Health ! 경고) |
| `AI_MODE` / `NEXT_PUBLIC_AI_MODE` | `real` / `real` | 기존 값 유지 | demo면 AI 문장 없이 규칙 리포트만 |
| `AI_MODEL_DEEP_REPORT` | `gpt-5.4` | **설정하지 않음(UT-2까지 보류)** | 없으면 공용 `AI_MODEL` |
| OpenAI API key | 있음 | 기존 | 값 출력 금지 |
| `NEXT_PUBLIC_SUPABASE_*` | 없어도 됨 | 없음 | UT-2는 Supabase 없이 진행 |
| 실제 결제(PG) | 없음 | 없음 | 코드에 결제 실행 경로 자체가 없다 |

⚠️ Vercel env는 **Preview 스코프에만** 넣는다. Production 스코프에 `NEXT_PUBLIC_UT_MODE=true`를 넣지 않는다.
⚠️ `NEXT_PUBLIC_*`는 **빌드 시점에 고정**된다. env를 바꾸면 Preview를 다시 배포해야 반영된다.

UT 판정 우선순위(`src/lib/utMode.ts`):

```
1. NEXT_PUBLIC_UT_MODE=true      배포 전체가 UT (권장)
2. ?mode=ut                      fallback — 그 탭에서 한 번 들어오면 탭을 닫기 전까지 유지
3. 탭 기억(sessionStorage)        새로고침 · 뒤로가기 · 쿼리 없는 이동
```

## 3. Health Check

- `https://<UT Preview URL>/ut` 를 연다. 열리자마자 점검한다(약 3~10초).
- **UT READY** 여야 시작한다. `✗`가 하나라도 있으면 **UT BLOCKED** — 시작하지 않는다.
- `!` 경고는 시작은 가능하지만 확인한다:
  - `UT mode !` — 쿼리로만 UT다. UT 배포가 아니면 새 탭에서 풀린다 → UT Preview 주소인지 확인.
  - `AI 모드 !` — demo. 의도가 아니면 env(`AI_MODE`) 확인 후 재배포.
  - `참가자 화면에 개발 도구 !` — `NEXT_PUBLIC_AI_DEBUG=false`로 재배포.
  - `저장된 세션 읽기 !` — 초기화한다.
- `/ut`는 개발 서버 또는 `NEXT_PUBLIC_UT_MODE=true` 배포에서만 열린다. Production은 404.

## 4. Reset (참가자 초기화)

1. `/ut` → **UT 결과 내보내기** (이전 참가자 결과 JSON 저장 — 초기화하면 되돌릴 수 없다)
2. **다음 참가자 준비 (초기화)** → 확인
3. 자동으로 새로고침되며 `/onboarding`이 열린다

지우는 것 / 남기는 것(`src/lib/utReset.ts`):

| 지운다 (이 브라우저의 `lym.*`) | 남긴다 |
|---|---|
| 답변 · 상대 정보 · 관계 사건 · 기록(History) · 상대 목록 | UT 탭 기억(`lym.ut-mode.v1`) |
| Premium unlock · 결제 의향 · 자동 복귀 주소 | Supabase 연결 목록(로컬 링크) |
| UT 응답 · AI 캐시 · 스크롤/펼침 · 분석 동의 · analytics 큐 | `lym.*`가 아닌 키(Supabase 로그인 등) |

⚠️ Supabase에 실제로 저장된 데이터는 지우지 않는다(서버 호출 없음).

## 5. 참가자 시작 URL

- **기본:** `https://<UT Preview URL>/onboarding`
- **fallback** (UT 배포가 아닐 때만): `https://<UT Preview URL>/onboarding?mode=ut` — 이때는 **같은 탭**에서만 진행한다.
- 진행자 기기에서 초기화 직후 같은 브라우저로 연다. 다른 브라우저 프로필은 이전 상태가 남아 있을 수 있다 → 그 브라우저에서도 `/ut` 초기화.

## 6. 테스트 중 문제 발생 시 복구

| 증상 | 조치 |
|---|---|
| Premium 진입이 안 보인다 | `/ut` Health Check → BLOCKED 항목 확인 → 초기화 → Preview URL로 재진입 |
| Premium에서 '정밀 분석을 위해 몇 가지 정보가 더 필요해' | **정상 동작.** 참가자가 '정보 채우기' → 입력 완료 → 결과 화면에 도착하면 Premium으로 자동 복귀 |
| AI 문장 자리에 '다시 시도' | '다시 시도'를 누른다. 규칙 리포트는 그대로 보이고, 같은 요청 id로 다시 시도한다 |
| Deep Report가 15~25초 걸린다 | 정상. '답변과 기록을 연결해서 보고 있어. 조금만 기다려줘.'가 보인다. 연타 · 새로고침을 막을 필요는 없다(중복 요청이 생기지 않는다) |
| 화면이 이상하게 꼬였다(이전 답변이 보임 등) | `/ut` 초기화 → `/onboarding`부터 재시작 |
| 새 탭에서 UT가 풀렸다 | UT Preview 배포가 아니다(쿼리 fallback 사용 중) → UT 배포 주소로 다시 시작 |

## 7. 참가자 종료 후

1. `/ut` → UT 결과 내보내기
2. 다음 참가자 준비 (초기화)
3. 체크리스트 0번부터 다시

## 8. 금지사항

- 참가자에게 `/ut` · 이 문서 · Health 결과를 보여주지 않는다.
- Production 주소로 UT를 진행하지 않는다. Production env에 UT 설정을 넣지 않는다.
- 실제 결제를 시도하지 않는다(경로도 없다). 참가자에게 결제가 된 것처럼 말하지 않는다 — '이번 테스트에서는 실제 결제가 진행되지 않아'는 결제 의향 질문에서 한 번만 나온다.
- 근거가 부족한 참가자에게 빈 리포트를 억지로 보여주지 않는다 — 입력 보완 화면이 정상이다.
- 진행 중 real AI를 반복 호출하는 별도 QA를 하지 않는다.
- 관계 저장 · 재방문(Supabase) 기능은 UT-2에서 다루지 않는다.
- Core Value · Premium 문장을 UT 도중 수정하지 않는다.
