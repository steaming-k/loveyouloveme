# UT-2 Release Candidate

> 이 문서는 **동결 기록**이다. UT-2를 진행하는 절차는 [`UT2_RUNBOOK.md`](./UT2_RUNBOOK.md)에 있고,
> 여기에는 "무엇이 어떤 상태로 얼어붙었는가"와 "무엇을 확인했고 무엇을 확인하지 못했는가"만 적는다.
>
> 참가자에게는 이 문서도, `/ut` 화면도 보여주지 않는다.

---

## 1. RC 식별자

| 항목 | 값 |
|---|---|
| Branch | `feat/v147-supabase-persistence-clean` |
| Preflight 시작 HEAD | `63d89a4` |
| RC HEAD | *(아래 §11에 최종 commit 기록)* |
| 기준 버전 | v1.47 |
| 동결일 | 2026-09-15 |
| main merge | **금지** |
| production deploy | **금지** |
| tag | **만들지 않음** |

---

## 2. UT-2 대상 기능 (IN SCOPE)

```
Onboarding
Profile input (사진 있음 / 없음 두 갈래)
Relationship Experience (관계 경험)
Target (부분 정보 허용 · 기억나는 사건 · MBTI 선택)
Compatibility (동기화율)
Mirror (Relationship Mirror)
Premium (Paywall · 결제 의향)
Deep Report (정밀 관찰 리포트)
Lens (MBTI · 사주 · 별자리)
Recommended Question / Next Move
```

## 3. 이번 UT에서 제외 (OUT OF SCOPE)

Supabase dev 연결이 **없어서** 아래는 검증하지 못했고, UT-2 범위에서 제외한다.

```
관계 저장
로그인 후 cloud restore
A/B 관계 switching
History persistence (재방문 복원)
```

로컬(`localStorage`) 기준의 세션 복원 · 새로고침 복원은 범위 **안**이고 검증했다(§6).

---

## 4. 필요한 env (이름만 — 값은 적지 않는다)

### UT Preview 배포

| 이름 | 값 | 이유 |
|---|---|---|
| `NEXT_PUBLIC_UT_MODE` | `true` | UT 판정 1순위. 새 탭 · 새로고침 · 직접 URL에서도 UT가 유지된다 |
| `NEXT_PUBLIC_AI_DEBUG` | **`false`** | `true`면 참가자 화면에 AI Debug 버튼이 뜬다. `/ut` Health가 경고로 잡는다 |
| `AI_MODE` | `real` | 앞뒤 공백이 붙으면 **조용히 demo로 내려간다**. 붙여넣기 주의 |
| `NEXT_PUBLIC_AI_MODE` | `real` | 서버와 같은 값. 어긋나면 사진 화면 안내 문구만 어긋난다 |
| `AI_API_KEY` | (있어야 함) | 없으면 `CONFIG_ERROR` — 규칙 리포트만 나온다(앱은 죽지 않는다) |
| `AI_MODEL_DEEP_REPORT` | `gpt-5.4` | Deep Report 전용 모델 |
| `NEXT_PUBLIC_PREMIUM_FAKE_DOOR` | `true` | (UT에서는 꺼져 있어도 열린다 — UT-PREM-09) |
| `NEXT_PUBLIC_SUPABASE_URL` / `..._ANON_KEY` | **없음** | 그래서 §3이 범위 밖이다 |

### Production (일반 사용자) — 이번에 건드리지 않는다

`NEXT_PUBLIC_UT_MODE=false` · `NEXT_PUBLIC_AI_DEBUG=false` · `NEXT_PUBLIC_PREMIUM_PREVIEW=false`.
이 조합에서 `/ut` · `/dev/*` · dev API가 전부 404인 것을 빌드로 확인했다(§7).

---

## 5. Health Check

UT Preview 주소에서 `/ut`를 연다. 아래 9개가 모두 `✓`여야 시작한다.

```
✓ UT mode                      UT 배포(NEXT_PUBLIC_UT_MODE) — 새 탭에서도 유지
✓ Premium CTA · Paywall 노출
✓ Deep Report 통로
✓ feature flag가 꺼져도 UT에서 열림
✓ 실제 결제 불가               access mode beta_ut
✓ 필수 화면 8개 응답
✓ AI 모드                      real
✓ 참가자 화면에 개발 도구 없음
✓ 저장된 세션 읽기
```

하나라도 `!`/`✗`면 **UT START = BLOCKED**. 특히:

- `AI 모드 = demo` → `AI_MODE` 값 뒤 공백을 의심한다. 그대로 진행하면 AI 문장 없이 규칙 리포트만 나온다.
- `참가자 화면에 개발 도구 없음` 경고 → `NEXT_PUBLIC_AI_DEBUG=false`로 재배포한다.

## 6. Reset 절차

`/ut` → `다음 참가자 준비 (초기화)` → 확인 dialog에서 `초기화`.

```
지운다   lym.* 전부 (세션 · 기록 · 상대 · 사건 · Premium unlock/의향/복귀 · UT 응답 · AI 캐시 · 동의)
남긴다   lym.ut-mode.v1 · lym.cloudLinks.v1 · lym.* 가 아닌 키
```

**Supabase 서버 데이터는 자동 삭제하지 않는다**(서버 호출 없음).
초기화 직후 `/onboarding`이 열리고 동의 dialog가 다시 뜨면 정상이다.

## 7. 참가자 시작 URL

```
UT Participant Start URL: ______________________________________
                          (UT Preview 주소 + /onboarding)
```

진행자는 **새 탭**을 열어 이 주소를 띄운 뒤 기기를 건넨다. `?mode=ut`는 붙이지 않아도 된다 —
env 배포라 새 탭에서도 UT가 유지된다.

## 8. Provider 정책

```
이 preflight의 실제 Provider 호출   0회 (baseline 0 → 종료 0)
자동 테스트                          x-lym-test-run 헤더로 real을 mock으로 강등 — 구조적으로 0회
브라우저 QA                          AI_MODE=demo · mock · (real + 키 없음) 세 모드로만 진행
```

**실제 gpt-5.4 smoke는 이 문서 범위 밖이다.** Preview 배포 후 사용자가 명시적으로 진행한다
(`ALLOW_REAL_AI_TESTS=1 npm run test:ai:deep-report-smoke`). 비용이 발생한다.

## 9. Supabase 상태

```
NEXT_PUBLIC_SUPABASE_URL        없음
NEXT_PUBLIC_SUPABASE_ANON_KEY   없음
→ BLOCKED: VALID DEV SUPABASE CONNECTION REQUIRED
```

migration · RLS · Auth · save · logout/login · restore · A↔B 는 **하나도 실검증하지 않았다.**
production DB로는 어떤 검증도 하지 않는다.

---

## 10. 이번 preflight에서 고친 것

blocker와 참가자 화면 메타 문구만 손댔다. 새 기능 · 새 scoring · 새 Lens logic · 대규모 카피 수정 없음.

### (1) `/profile/intro`의 `샘플 답변으로 결과부터 볼게` 제거 — **BLOCKER**

참가자 플로우 한가운데(S06)에 게이팅 없이 있던 버튼이다. 두 가지가 동시에 문제였다.

- 메타 문구 — 참가자에게 제품이 **샘플/체험판**으로 읽힌다.
- 플로우 오염 — 누르면 입력 전 과정을 건너뛰고 **미리 만들어 둔 고정 세션의 결과**를 자기 결과처럼 본다.
  UT-2가 관찰하려는 것이 바로 그 입력 과정이다.

`loadSampleSession()` 자체는 남는다 — dev 전용 `/dev/latency-session`과 `PrototypePanel`이 쓰고,
둘 다 production에서 렌더되지 않는다.

### (2) 참가자 화면의 내부 모드 이름 제거

사실은 그대로 말하고, **모드 이름만** 뺐다.

| 화면 | 전 | 후 |
|---|---|---|
| S09 Observed | `지금은 데모 분석을 사용 중이야.` / `지금은 개발용 MOCK 분석이야.` | `지금은 사진 내용을 읽지 않는 상태야.` |
| S09 배지 | `DEMO AI` · `MOCK AI` | `규칙 기반` |
| S09 고지 | `개발용 MOCK 모드야. …` | (demo와 같은 사실 고지로 통합) |
| S07 사진 | `지금은 데모 모드라 사진을 전송하지 않아` | `지금은 사진을 전송하지 않아` |
| AI 출처 라벨 | `MOCK AI` | `규칙 기반` |
| Premium unlock(preview) | `미리보기로 리포트를 열었어` | `정밀 관찰 리포트를 열었어` |

UT 배포는 `AI_MODE=real`이라 위 분기 대부분이 애초에 렌더되지 않는다. 그래도 바꾼 이유는
**설정 한 줄(`AI_MODE` 뒤 공백)로 demo로 내려가면 그대로 노출되는 상태**였기 때문이다.

### (3) Guard 강화

- `tests/run-meta-copy-fixtures.mjs` **신규** — META-01~10 + META-04b. 렌더되는 텍스트(한글 리터럴 + JSX 텍스트 노드)만 보고, 내부 식별자(`mode === 'mock'` · `'beta_ut'` · `'fake-door'`)는 보지 않는다. `npm run test:meta-copy`
- `tests/run-ui-asset-copy-fixtures.mjs` — **allowlist를 비웠다.** 예전에 '기능상 의미가 있다'는 이유로 통과시키던 6개 문구(`미리보기로 리포트를 열었어` · `샘플 답변으로 결과부터 볼게` · `데모 모드라…` 등)와 mock 전용 예외(`개발용 MOCK`)를 전부 없앴다.

### (4) 남긴 예외 1건 — 판단이 필요한 곳

```
src/data/premium.ts  previewLabel: '미리 보기 — 3가지만 살짝'
```

Paywall에서 유료 리포트 중 3개를 먼저 보여주는 **상품 설명**이고, 제품이 미완성 빌드라는 뜻이 아니다.
UT-2가 관찰하려는 결제 의향 화면 자체라 RC 동결 중에 바꾸지 않았다.
META-04가 이 한 줄만 예외로 두고 다른 `미리 보기`는 전부 잡는다.

---

## 11. 검증 결과

### 참가자 flow 리허설 (393×852 · 시나리오마다 초기화 후 독립 진행)

| | 시나리오 | 결과 | 확인한 것 |
|---|---|---|---|
| A | 솔로 · 연애 경험 없음 | PASS | 결핍/부정 표현 0 · `상대가 없어도 관찰할 수 있는 것` · Premium CTA · Deep Report · Lens 정상 |
| B | 관심 가는 사람이 있음 | PASS | 상대/나 비교 자연스러움 · relation option · score-first · Premium CTA |
| C | 연애 중 | PASS | `연인 · 배우자` 선택 · 현재 관계 tense(`지금 관계에서 맞춰볼 것`) · `지금 관계 속의 나` accordion · 사건 입력 |
| D | 기혼 / 오래 함께하는 중 | PASS | **과거형 오노출 0** · 상위 기능명 `이전 관계` 오노출 0 · 현재 관계 분석 정상 |
| E | 최근 관계가 끝남 | PASS | relation status `이전 관계` 유지 · past tense · **현재 관계용 CTA/Action 오노출 0** (`그래서 뭐가 남았을까` / `돌아볼 것`) |

사진 두 갈래 — 사진 있음(3장 업로드 → Observed → **평가 카드 없이** → `질문으로 계속하기`) · 사진 없이 질문부터 시작, 둘 다 PASS.

### 안정성

```
dead-end 0 · disabled CTA 0 · unexpected redirect 0 · blank screen 0 · infinite loading 0 · state loss 0
Premium disappear 0
```

- **Reset ×3** (참가자 A → B → C): profile · target · event · unlock · returnTo · analysis temp · relationship state · UT flags **누수 0**. 초기화 후 세션은 `status: null` · declared 전부 `null` · target 전부 `x` · completed 전부 `false`.
- **새로고침 / 직접 URL / back·forward / 새 탭**: `/compatibility` `/mirror` `/premium` `/lens` `/compatibility/questions` `/compatibility/lenses` `/home` `/history` 전부 200 · blank 0. `/premium` 새로고침에서 Deep Report와 unlock이 복원됐다. **세션이 전혀 없는 새 탭에서 `/premium` 직접 진입** → 리다이렉트 없이 Premium shell(`정밀 분석을 위해 몇 가지 정보가 더 필요해` + 채우러 가는 경로 + 자동 복귀)이 떴다.
- **깨진 로컬 상태**: `lym.session.v1`에 잘린 JSON, `photos`에 문자열, unlock에 `{{{not json`, consent에 제어문자를 넣고 진입 → crash 0 · blank 0 · 세션 전체 폭파 없이 `관측 정보 부족 · 입력 0/4` 안전 화면 + 복구 경로.

### 결과 경험 회귀

- **Compatibility** — score first(`동기화율 73`이 첫 화면을 지배) → takeaway → FIRST SURPRISE → 긴 근거는 접힘(`이 점수는 어떻게 나왔어? +`) → Premium unresolved question. 첫 viewport 장문 회귀 없음.
- **Mirror** — 핵심 takeaway(`러비가 가장 눈여겨본 부분`)가 `항목별 대조`보다 먼저. ScaleHearts 숫자 일치(`말한 나 4/5` ↔ `말한 나 4점`). `지금 관계 속의 나` accordion 정상.
- **Premium Deep Report** — `이번 관계에서 먼저 볼 것` → 핵심 3개(01/3 · 02/3 · 03/3, chapters 접힘) → Lens → Action Layer(`러비의 체크포인트`) → Next Move(`아직 만들지 않은 연결`). FREE보다 글만 긴 화면으로 회귀하지 않았다.
- **Lens** — CORE(실제 관계 신호, 동기화율은 이것만) / SUPPORTING(MBTI) / ENTERTAINMENT(사주 · 별자리) 구분 유지. **사주 DEMO 회귀 0** — 출생정보를 넣으면 실제 일주를 계산한다(1995-08-12 → 을해(乙亥), 1993-03-04 → 갑신(甲申), 둘 다 육십갑자 검산 일치). 계산하지 않은 기둥은 이유를 밝힌다.
- **Generic advice** — 근거 없는 `같이 해볼 것`이 핵심 Action 위로 올라오지 않았다. 끝난 관계에서는 아예 조언을 접는다(`이 관계에서 뭘 해볼지는 이제 내가 말할 자리가 아닌 것 같아`).

### 언어 회귀

`이전 관계` · `관계 경험` · `장면` · `사건` · `연인` · `배우자` 전수 확인.

- relation status로서 `이전 관계` → 허용 범위 안
- 실제 과거 근거 문장(`네가 이전 관계에서 답한 내용을 기준으로 했어`) → 허용 범위 안
- **상위 기능명으로서 `이전 관계` 오노출 0** — 상위 용어는 `관계 경험`으로 통일돼 있다
- 사용자 event는 전부 `사건`(`기억나는 사건` · `이 사건 추가하기`). 사진 scene 의미의 `장면`만 남아 있다
- 연애 중 사용자에게는 `지금 만나는 사람 이야기는 결과 화면의 '지금 관계 속의 나'에서 따로 알려줄 수 있어`가 붙어 과거/현재 혼동을 막는다

내부 key 무변경: `TargetRelation ex` · `/profile/past/*` · `relationship_experience_*` · `relation_status` · ended/current tense state · persisted storage keys 전부 그대로다.

### Premium / 결제 안전

```
UT mode          Compatibility CTA · Mirror CTA · Home Premium · Premium route · Deep Report · Lens 전부 열림
access mode      beta_ut          (payment 아님 · paymentExecuted false)
unlock 문구      '정밀 관찰 리포트를 열었어 / 모아둔 신호를 연결해서 보여줄게'
                 → '결제가 완료됐어' · '미리보기로 리포트를 열었어' 아님
결제 고지        '실제 결제가 아니라 의향을 묻는 질문이야' — 결제 의향 질문 바로 앞 1회만
근거 부족        Premium shell 유지 → 입력 보완 → auto return
```

참가자 UI에 `BETA TEST` · `PREVIEW` · `개발용` · `테스트용` · `MOCK` · `fake door` 노출 **0**.

### loading / AI 실패 / 연타

`AI_MODE=real` + 키 없음(→ `CONFIG_ERROR`, Provider 호출 0)으로 실제 실패를 재현했다.

```
loading      '관찰한 내용을 연결하고 있어 / 네가 말한 기준과 관계에서 보인 신호를 같이 놓는 중이야'
             관찰 › 연결 › 리포트   — 진행률 위조 없음
실패         빈 화면 0 · 무한 loading 0 · 규칙 리포트 5,732자 정상 렌더
             '확인된 신호만 보여주고 있어' + '다시 시도' 5개(Deep Report · 렌즈별)
             서버 로그에 gen=<generationRequestId> 유지
연타         Premium CTA 3회 연타 → deep-report-narrative 요청 1회
금지 메타    실패 상태에서도 0
```

### 자동 회귀 + 빌드

23개 스위트 전부 통과, `AI_MODE=real` 환경에서 **실제 Provider 누적 0 → 0**.

```
action · semantic · premium(279) · value · ended · question · lens(206) · event ·
relationship-evidence(286) · nav(54) · lifecycle(166) · history(100) · persistence(323) ·
ut-premium(24) · ut-stability(31) · ui-assets(8) · meta-copy(11) · ai-guard(15) ·
ut-followup(52) · trust(205) · observed(16) · ai(585) · model-routing(30)

tsc --noEmit   통과
eslint         통과 (--max-warnings=0)
next build     통과
```

### production-like 빌드 (`UT_MODE=false` · `AI_DEBUG=false` · `PREMIUM_PREVIEW=false`)

```
/ut                       404
/dev/latency-session      404
/dev/saved-relationships  404
/api/dev/*  (POST)        404  (ai-guard · ut-stability · premium · nav · history · lifecycle · trust · persistence · model-routing · ut-premium)
/api/ai/contract-test     404
/onboarding /home /premium /status /compatibility /mirror /lens /target /privacy   200
참가자 화면               AI Debug 버튼 없음 · PrototypePanel 없음 · 금지 메타 0
```

### UT-preview-like 빌드 (`UT_MODE=true` · `AI_DEBUG=false`)

```
/ut                       200 · UT READY (9개 중 8개 ✓, AI 모드만 ! — 빌드를 demo로 해서 Provider를 부르지 않기 위함)
participant routes        전부 200
/dev/*                    404
/api/dev/*  (POST)        404
참가자 화면               AI Debug 없음 · PrototypePanel 없음
전 화면 금지 메타          0  (onboarding → status → intro → photos → declared 1~4 → past 1~3 → target →
                             compatibility → mirror/teaser → mirror → premium → deep report(전부 펼침) → lens)
```

---

## 12. Known risks

1. **`AI_MODE` 뒤 공백** — 배포 UI에 붙여넣을 때 공백/개행이 따라오면 조용히 demo로 내려간다. 앱은 정상 동작하고 화면도 정직해서 원인을 찾기 어렵다. `/ut` Health의 `AI 모드` 줄이 유일한 신호다. **참가자를 앉히기 전에 반드시 확인한다.**
2. **`NEXT_PUBLIC_AI_DEBUG`** — `true`로 배포되면 참가자 화면에 AI Debug 버튼이 뜬다. Health가 경고로 잡지만, 경고를 무시하면 그대로 UT가 진행된다.
3. **Supabase 미검증** — §3의 기능은 코드에는 있지만 이번에 한 줄도 실행해보지 않았다. UT 중에 참가자가 `내 관찰 기록에 저장`을 누를 수 있다. 저장 실패가 참가자 flow를 막지는 않지만, 그 경로의 동작은 **보증 범위 밖**이다.
4. **실제 gpt-5.4 응답 미검증** — 이 preflight의 Deep Report는 전부 규칙/mock 경로다. 실제 모델이 만든 문장의 길이 · 대기 시간(15~25초 예상) · Quality Gate 통과율은 Preview 배포 후 smoke로만 알 수 있다.
5. **`/ut` 운영자 화면이 UT 배포에서 200** — 참가자가 주소창에 `/ut`를 직접 치면 열린다. UT 성격상 필요한 노출이지만, 참가자에게 주소를 보여주지 않는 운영으로만 막힌다.
6. (minor) demo/mock 모드의 S09 빈 상태에서 `실제 사진 내용을 분석하지 않았어…` 문장이 본문과 한계 목록에 **두 번** 나온다. UT 배포(real)에서는 도달하지 않는 상태라 고치지 않았다.
7. (minor) `declared_me_complete` analytics 호출이 답변 값을 property로 넘기고, sanitizer가 매번 걸러내며 콘솔 error를 남긴다. **데이터는 나가지 않는다**(guard가 동작하고 있다). 호출부를 정리하는 건 UT 이후 과제.

## 13. 이번에 기록만 하고 고치지 않은 개선 아이디어

- S06 `/profile/intro`에서 샘플 경로를 없앴으므로, 결과를 먼저 보고 싶어 하는 사용자를 위한 **정직한** 대안(예: 입력 2개만으로 미완성 결과 보기)이 필요한지 UT-2에서 관찰한다.
- Paywall 티저 라벨(`미리 보기 — 3가지만 살짝`)이 참가자에게 '제품이 미완성'으로 읽히는지 UT-2에서 확인한다. 읽힌다면 그때 바꾼다.
- 상위 기능 용어 `관계 경험`의 실제 이해도는 다음 UT에서 UT2-H5로 검증한다([`UT2_followup_hypotheses.md`](./UT2_followup_hypotheses.md)).

---

## 14. GO / NO-GO

```
Core / Premium UT           GO
Persistence / Retention UT  NOT IN SCOPE   (Supabase dev 연결 없음)
```

GO 조건 점검:

```
✓ participant A–E flow complete
✓ UT Stability Gate PASS
✓ dead-end / blank / redirect loop 0
✓ score-first 유지
✓ Value Density 회귀 없음
✓ Premium 항상 접근 가능
✓ Deep Report / Lens 정상
✓ participant user-facing 개발용·테스트용·데모·PREVIEW·mock·debug·fake-door 문구 0
✓ Saju / Lens DEMO 회귀 0
✓ loading / error / fallback 상태에서도 forbidden meta copy 0
✓ actual payment 0
✓ state leakage 0
✓ Reset 정상 (×3)
✓ Health READY
✓ loading / retry 정상
✓ Provider QA delta 0
✓ production gating 정상
✓ UT-preview gating 정상
✓ full regression / build PASS
```

**단, 배포 직후 `/ut` Health에서 `AI 모드 = real`과 `참가자 화면에 개발 도구 없음`을 눈으로 확인하기 전까지는 GO가 아니다.** 이 둘은 코드가 아니라 배포 env가 정한다.

---

## 15. UT2 RC FROZEN

이 문서의 모든 Gate가 통과했다. 기능 변경을 멈추고 실제 사용자 검증으로 넘어간다.

```
UT2 RC FROZEN
```

이후 이 브랜치에서는 **UT를 막는 blocker만** 고친다. 새 기능 · 새 타깃 · 새 BM · 새 scoring ·
새 Lens logic · 대규모 카피 수정은 UT-2가 끝난 뒤에 다시 연다.
`main` merge와 production deploy는 하지 않는다. tag도 만들지 않는다.
