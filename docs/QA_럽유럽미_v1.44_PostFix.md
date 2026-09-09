# 럽유럽미 v1.44 Post-QA Fix Verification

> 이 문서는 **Post-Fix 검증 기록**이다. `docs/QA_럽유럽미_v1.43.md`(Pre-Fix 실행 기록)를
> 대체하지 않는다. 원본의 개별 TC 실제결과·상태는 하나도 덮어쓰지 않았고, **집계 산술
> 오류와 사실오류만** 정정한 뒤 그 자리에 정정 주석을 남겼다(§9).
>
> commit / push 하지 않았다. Frozen Snapshot 0건 수정.
>
> **2026-09-09 Final Closure 추가.** 이 문서의 초판은 NEW-002를 '미수정'으로 닫았다.
> 그 뒤 Final Closure에서 NEW-002를 수정하고 BUG-002/003/NEW-002를 자동 회귀로 옮겼다.
> **초판의 실측 기록은 하나도 덮어쓰지 않았다** — 달라진 항목에는 Final Closure 결과를
> 그 자리에 덧붙였다(§2 · §5 · §8 · §11 · §12 · 신설 §13).
>
> **2026-09-09 R-12 Closure 추가 (Final Release Closure).** 축별 AI 서술의 소비 게이트를
> 추가했다. 검증 중 **Core AI 서술 본문**(`core.summary`)이 R-11의 headline 게이트를
> 우회하는 것을 실측해 같은 게이트로 함께 닫았다 → 신설 §17.
>
> **2026-09-09 R-11 Closure 추가.** R-9 검증 중 실측한 AI headline 위반을 닫았다.
> `aiHeadline` **소비 게이트** 하나로 화면·History·`/home`이 함께 해소된다 — AI 요청·
> 프롬프트·promptVersion·스캐너·캐시·내부 state 변경 **0** → 신설 §16.
>
> **2026-09-09 R-9 Closure 추가.** NEW-003이 의도적으로 남긴 R-9(상태 배지 어휘)를
> 닫았다. 추적해 보니 배지 하나가 아니라 **5개 표시 소비처**였고, 공유 카드는 근거를
> 반박하는 문장을 그대로 밖으로 내보내고 있었다 → 신설 §15. 그 과정에서 **AI 생성
> headline**의 같은 위반을 실측했고, AI contract 변경은 범위 밖이라 **미수정**으로
> 보고한다(§15.6 · R-11).
>
> **2026-09-09 Final Trust Closure 추가.** §13.3이 별건으로 남겨둔 관찰
> (`경험 후 기준이 낮아짐`)을 **NEW-003으로 정식 기록하고 수정**했다. 추적해 보니 Home 칩
> 하나가 아니라 **8개 소비처**의 같은 결함이었고, 그 중 하나는 NEW-002가 세운 Home Hero의
> neutral 상태를 우회하고 있었다 → 신설 §14.

---

## 1. 기준

| 항목 | 내용 |
|---|---|
| Base Production | v1.43 |
| Base Commit | `52f5601` (= `origin/main`, divergence 0/0) |
| Candidate | **v1.44** (uncommitted working tree) |
| QA 유형 | Targeted Retest + Regression |
| Production 변경 | **없음** (아직 미배포 — 이 문서의 모든 실측은 LOCAL dev) |
| QA 일자 | 2026-09-09 |
| 환경 | Chromium (Claude Code Browser pane) / Windows 11 / Node v22.15.0 / viewport 360·393·430 |

---

## 2. 수정 항목

| ID | 유형 | Before | Fix | Priority | 관련 TC |
|---|---|---|---|---|---|
| **S07 Sample Removal** | 제품 변경 | 선택 가능한 색 타일 8개가 격자에 함께 있었고, 분석에는 들어가지 않아 배지·`N개는 분석 제외`·전용 에러로 설명했다 | 선택 기능 자체를 제거. S07의 선택지는 업로드 사진뿐. `SAMPLE_PHOTOS` 데이터는 데모 세션·dev fixture용으로 유지 | – | PHOTO-04~08 |
| **BUG-001** | 상태 모순 | 수정 저장 후 `맞는 것 같아` → `coreVerdict:'ok'`인데 화면은 사용자 수정문 + `네가 고친 문장이야` 유지, Core AI 숨김 | `setCoreVerdict('ok')`가 `coreCorrection`을 함께 비운다. 불변식을 setter 한 곳에 둬 호출 순서 의존 제거 | P2 | CORE-006 · CORE-008 · CORE-009 |
| **BUG-002** | 입력 방어 | `deserialize()`가 모양만 보고 `...parsed`로 펼쳐 `conflict:99` → `갈등 잠깐 뒤 대화 선호`, `important:'notanarray'` → `관계 경험 11` | `@/lib/sessionSanitize` 신설. 유효하지 않은 값을 **추정하지 않고 미입력으로 강등**. 검사 목록은 기존 exhaustive 라벨 맵 재사용 | P3 | SESSION-INVALID-01 외 4건 |
| **BUG-003** | Null 안전 | `cached.meta.mode` 직접 접근 → `meta:null`에서 unhandled rejection | defensive accessor. `SessionProvider`의 `observedAnalysis?.meta.inputFingerprint`도 같은 노출이라 함께 방어. **Final Closure에서 두 순수 helper를 `@/lib/aiMeta`로 옮겼다**(`aiModeOf`·`sameAnalysisFingerprint`) — React 안에 있으면 fixture가 부를 수 없었다 | P3 | AI-META-NULL/MISSING/NORMAL-01 · T7~T9 |
| **BUG-004** | ~~UX~~ **결함 아님** | "S15 5번째 선택 시 피드백 없음"으로 기록됐다 | **코드 수정 없음.** 재검증 결과 토스트가 정상 동작한다 — 원 QA의 관측 방법 오류였다(§8) | ~~P3~~ – | PAST-LIMIT-01~05 |
| **NEW-001** | A11y / 터치 | 사진 제거 X 버튼 hit area `h-7`(28px) — QA 기준 ≥44px 미달 | 보이는 원(28px)은 그대로, hit area만 44×44. **바깥이 아니라 안쪽으로** 확장해 gutter(7px)를 넘지 않게 함 | P3 | PHOTO-HIT-01~04 |
| **R-12** | 잔여 항목 · **수정 완료** | `scope 'none'` 축 행에서 결정론 노트는 `비교는 하지 않을게`인데 바로 아래 AI 서술이 `이 부분에서 변화가 있을 수 있어.` — **한 행이 스스로를 반박**했다. 검증 중 Core AI 서술 본문도 같은 위반임을 실측 | `canUseAiAxisNarrative(insight)` 소비 게이트. 축 서술 렌더 자리 + Core 서술 본문 2곳. **결정론 노트는 그대로 유지** · R-11과 술어 공유(`aiMayClaimChange`) · AI 계약 변경 0 | P2 | TEMP-AI-AXIS-01~06 |
| **R-11** | 잔여 항목 · **수정 완료** | focus 축이 `CHANGE`·`scope 'none'`인데 real AI headline이 우선 렌더돼 `연락의 중요성이 가장 두드러진 변화로 보여`를 만들고, 그 문장이 History `coreInsightOriginal`로 저장돼 `/home`에 재노출 | `canUseAiHeadline(focus)` 소비 게이트 1개. 시간 비교 근거가 없는 `CHANGE` focus면 **AI 문장을 쓰지 않고** NEW-003의 결정론 headline으로 폴백. AI 요청·프롬프트·promptVersion·스캐너·캐시·내부 state **변경 0** | P2 | TEMP-AI-01~06 |
| **R-9** | 잔여 항목 · **수정 완료** | NEW-003이 시제 문장을 닫은 뒤에도 상태 이름 `CHANGE`가 배지·카드·스냅샷·공유 카드에 그대로 노출. 배지가 **같은 행의 근거와 스크린리더 문구를 반박**했다 | 표시 정책 `displayStateOf(state, scope)` 1개로 `CHANGE + none` → 기존 멤버 `UNKNOWN`. 공유 카드 헤드라인은 시제 술어로 게이트. **내부 state·저장 데이터·새 enum 0** | P2 | TEMP-DISPLAY-01~06 |
| **NEW-003** | 신규 발견 · **수정 완료** | 관계 경험 0 + `declared.contact=5`인데 `/home`·`/mirror`가 `경험 후 기준이 낮아짐`·`경험 후에는 우선순위가 옮겨간` 등 **시간적 변화**를 주장. `mirror.core`를 통해 NEW-002의 Hero neutral 상태까지 우회 | 술어 2개(`hasTemporalComparison`·`hasRelationshipEvidence`)로 시제 gate를 **blocklist → allowlist**로 뒤집고 8개 소비처에 적용. 판정·계산 변경 0 | P2 | TEMP-01~06 |
| **NEW-002** | ~~신규 발견~~ **수정 완료** | 빈 세션에서도 `/home`이 근거 없는 확정 문구 2건을 보여준다 | ~~수정하지 않음~~ → **Final Closure에서 수정.** `HOME_COPY.fallbackProfile` 삭제 + `homeHeroSummary()` 신설 · 갈등 축에 `soon`을 명시하고 나머지는 `NO_EVIDENCE_COPY.axis`. **새 카피를 만들지 않고 기존 중립 문구를 재사용**했다(§13) | P2 | HOME-EMPTY-01 · T10~T13 |

---

## 3. Targeted Retest

| TC ID | 사전조건 | 입력값 | 실행절차 | 예상결과 | 실제결과 | 상태 | 우선순위 | 근거 |
|---|---|---|---|---|---|---|---|---|
| CORE-006 | dating 세션, Mirror AI Core 렌더됨 | `'연락보다 대화의 밀도가 더 중요했어'` | 1. 조금 달라 2. 입력 3. 이렇게 고칠게 4. **맞는 것 같아** | verdict `ok` · correction `''` · 원래 headline · Core AI 복원 · edited 배지 제거 | 수정 직후 `verdict:'no' / correction:'연락보다…' / headline=수정문 / aiSummary=false / edited=true` → 동의 후 **`verdict:'ok' / correction:"" / headline:'연락과 갈등 해결에서 일치하는 신호가 보여' / aiSummary=true / edited=false`** | PASS | - | localStorage + DOM |
| CORE-008 | 위 상태 | – | 1. `location.reload()` | 동일 상태 유지 | `verdict:'ok' / correction:"" / aiSummary=true / edited=false` (headline은 AI 재생성으로 문구만 다름) | PASS | - | 〃 |
| CORE-009 | 위 상태 | – | 1. `내 관찰 기록에 저장` | snapshot `verdict:'ok'` · `userCorrection:null` | `{verdict:'ok', userCorrection:null, original:'연락과 갈등 해결이 잘 맞아가는 관계'}` | PASS | - | `lym.history.v1` |
| CORE-002 (회귀) | dating 세션 | 수정문 | 1. 조금 달라 2. 저장 | 사용자 headline · AI 숨김 · edited 배지 | 그대로 재현 | PASS | - | 〃 |
| CORE-005 (회귀) | 수정 저장 상태 | – | 1. 조금 달라 2. **원래 관찰로 되돌리기** | verdict `null` · correction `''` · AI 복원 | `verdict:null / correction:"" / aiSummary=true / edited=false` — **`ok`와 구분 유지** | PASS | - | Journey B |
| PD-001 (미변경 확인) | dating 세션 | 빈 문자열 | 1. 조금 달라 2. 빈 상태로 제출 | 자동 저장 없음 · 새 상태 없음 | 토스트 `한 줄만 적어줘`, 저장 없음. **정책 변경 0** | PASS | - | 명시적 미구현 |
| SESSION-INVALID-01 | – | `status:'NOT_A_STATUS'`, `declared.contact:'abc'`, `conflict:99`, `important:'notanarray'`, `hardest:'bogus'`, `selfGap:12`, `target.relation:'zzz'`, `contact:'BAD'`, `alone:7`, `signals:{contact:'BOGUS', notanaxis:'often', conflict:'sometimes'}` | 1. 주입 2. `/home` | invalid만 미입력 강등 · crash 0 | `status:null` · declared 5개 전부 `null` · `important:[]` · `hardest:null` · `selfGap:null` · `relation:null` · 4축 `x/h/x/x`(유효한 `h`만 보존) · `signals:{conflict:'sometimes'}`(무효 축·무효 답 제거) · **`관계 경험 0`**(이전 11) · **`질문 0개`**(이전 2) · crash 0 | PASS | - | localStorage + DOM |
| SESSION-VALID-LEGACY-01 | – | 유효한 legacy 값 | 1. 주입 2. `/home` | 핵심 데이터 보존 | 위 케이스의 `conflict:'h'`·`signals.conflict:'sometimes'`가 **그대로 보존** — 강등이 유효값을 건드리지 않음 | PASS | - | 〃 |
| SESSION-PARTIAL-01 | – | `declared:{contact:5,conflict:'space'}`, `important:['contact']`, `target:{relation:'crush',contact:'m'}` (나머지 누락) | 1. 주입 2. `/home` | 정상 필드 유지 · 누락만 default | `status:'dating'` · `contact:5` · `conflict:'space'` · `alone/affection/hobby:null` · `important:['contact']` · `relation:'crush'` · `target.contact:'m'`, 나머지 `'x'` · crash 0 | PASS | - | 〃 |
| SESSION-HISTORY-INVALID-01 | – | `lym.history.v1 = '{{{not json'` | 1. 주입 2. `/home` | 기존 안전 처리 유지 | `아직 저장된 관찰이 없어.` 렌더, crash 0 | PASS | - | 〃 |
| SESSION-DEMO-01 | – | – | 1. `/profile/intro` 2. `샘플 답변으로 결과부터 볼게` 3. reload | 데모 세션 정상 · sanitizer로 깨지지 않음 | reload 전후 모두 `photos:6 · traits:4 · status:'solo_exp' · declared{2,now,5,a2,h3} · OBSERVED ME 섹션 렌더` — **동일** | PASS | - | 〃 |
| AI-META-NULL-01 | dating 세션 | `{ok:true,data:{narratives:[],core:null,meta:null}}` | 1. fetch 스텁 2. SPA로 `/mirror` | unhandled 0 · deterministic 유지 | `unhandledrejection 0` · crash 0 · `근거 시점:` 2행 · MATCH×2 · AI narrative 없음 | PASS | - | window error 리스너 |
| AI-META-NULL-01 (cache) | 위 상태 | – | 1. `/home` 2. `/mirror` 재진입(캐시 경로) | 동일 | `unhandled 0` · 2행 유지 · crash 0 — **BUG-003 원래 재현 지점** | PASS | - | 〃 |
| AI-META-MISSING-01 | 위 | `{ok:true,data:{narratives:[],core:null}}` (meta 키 없음) | 1. 지문 변경으로 캐시 미스 2. `/mirror` | 동일 | `unhandled 0` · crash 0 · 2행 유지 | PASS | - | 〃 |
| AI-META-NORMAL-01 | dating 세션 (스텁 없음) | – | 1. `/mirror` 2. `/home` 3. `/mirror` | AI 정상 · 캐시 동작 불변 | 최초 `relationship-insight: 1` · AI narrative 렌더 · 재방문 후에도 **`1` 유지(캐시 히트)** | PASS | - | fetch 카운터 |
| PAST-LIMIT-01 | S15, 0개 선택 | `대화` | 1. 클릭 | 1개 · 토스트 없음 | `n:1`, 토스트 `""` | PASS | - | `[role=status]` 직접 조회 |
| PAST-LIMIT-02 | 3개 선택 | `애정 표현` | 1. 클릭 | 4개 · 토스트 없음 | `n:4`, 토스트 `""` | PASS | - | 〃 |
| PAST-LIMIT-03 | 4개 선택 | `개인 시간` | 1. 클릭 2. 즉시 조회 | 4개 유지 · 토스트 1회 | `n:4`, **`최대 4개까지 고를 수 있어` 1회**, 약 2.6초 뒤 자동 소멸 | PASS | - | 〃 |
| PAST-LIMIT-04 | 4개 선택 | `대화` 해제 | 1. 클릭 | 3개 | `n:3` `[contact,conflict,affection]` | PASS | - | 〃 |
| PAST-LIMIT-05 | 3개 선택 | `개인 시간` | 1. 클릭 | 4개 | `n:4` `[contact,conflict,affection,alone]` | PASS | - | 〃 |
| PHOTO-HIT-01 | S07, 업로드 9장 | – | 1. 제거 버튼 rect 측정 | 전부 ≥44×44 | `minW:44 minH:44 under44:0` (9개) | PASS | - | `getBoundingClientRect` |
| PHOTO-HIT-02 | 위 | – | 1. 버튼 간 교차 검사 | 겹침 0 | `btnOverlap:0` | PASS | - | 〃 |
| PHOTO-HIT-03 | 위 | – | 1. 다른 셀 썸네일 침범 검사 | 침범 0 | `thumbInvade:0` — gutter(7px) 안에 머무름 | PASS | - | 〃 |
| PHOTO-HIT-04 | 위 | – | 1. 제거 클릭 | 실제 삭제 · 앨범 버튼 복귀 | `9→8장`, img 9→8, `앨범` 버튼 재노출 | PASS | - | DOM |
| PHOTO-04~06 (S07 회귀) | S07 진입 | – | 1. DOM 스캔 | sample UI 0 | `[role=checkbox] 0` · 샘플 라벨 0 · `샘플 타일 채우기` 0 · `분석 제외` 0 · `샘플` 문자열 0 | PASS | - | DOM |
| PHOTO-07~08 (S07 회귀) | S07 | 업로드 9장 | 1. 업로드 2. 카운트 | upload 기준 표시 | `0 → 9 / 9장 선택`, skip CTA는 0장에서만 노출 | PASS | - | DOM |
| **HOME-EMPTY-01** | **`localStorage.clear()` (신규 사용자)** | – | 1. `/home` | 근거 없는 확정 문구 0 | **`독립적인 시간을 중요하게 여기지만 관계의 연결 신호에는 민감한 편`** + 갈등 칩 **`잠깐 뒤 대화 선호`** 노출 | **FAIL** | **P2** | **NEW-002** |

**Targeted Retest 합계: 27건 — PASS 26 · FAIL 1**

---

## 4. Browser Journey

| Journey | 실제 결과 | Console | Network | 상태 |
|---|---|---|---|---|
| A — Core Correction | 수정 저장 → `맞는 것 같아`에서 `verdict:'ok' / correction:'' / 원래 headline / Core AI 복원 / edited 제거`. reload 후 동일 | error 0 | 정상 | PASS |
| B — Undo | `원래 관찰로 되돌리기` → `verdict:null / correction:''`. `ok`와 **구분 유지** | error 0 | 정상 | PASS |
| C — S15 | 4개 선택 후 5번째 시도 → 4개 유지 + 토스트 **1회** | error 0 | – | PASS |
| D — S07 | 0장: sample UI 0 · upload CTA · skip CTA · privacy 2건 정상 / 9장: remove hit area 44×44 · overflow 0 · 겹침 0 · 삭제 정상 | error 0 | 정상 | PASS |
| E — Invalid Session | 손상 값 전량 강등, crash 0, 유효값 보존. **단** `/home`의 확정 문구 2건은 빈 세션에서도 나옴 → NEW-002 | error 0 | – | 부분 PASS |
| F — AI meta null | null·missing 두 형태 모두 unhandled rejection 0 · deterministic 유지 · 정상 meta는 캐시 동작 불변 | error 0 | 스텁 200 | PASS |

---

## 5. Regression

| Suite | v1.43 Baseline | v1.44 Candidate | 상태 |
|---|---:|---:|---|
| `npx tsc --noEmit` | exit 0 | **exit 0** | PASS |
| `npx eslint src tests` | exit 0 | **exit 0** | PASS |
| `test:ai` (AI Contract) | 508 | **508** | PASS |
| `test:observed` | 10 | **10** | PASS |
| `test:history` | 100 | **100** | PASS |
| `test:lifecycle` | 144 | **144** | PASS |
| `test:relationship-evidence` | 280 | **280** | PASS |
| `test:ai:e2e` (Provider) | 6/6 | **6/6** | PASS |
| `npm run build` | 성공 | **성공** | PASS |

~~**새 fixture 추가 0건 → 건수 증감 0.**~~ **초판 기준이었다.**

**Final Closure 재실행 (2026-09-09):**

| Suite | v1.43 Baseline | Final Closure | 상태 |
|---|---:|---:|---|
| `npx tsc --noEmit` | exit 0 | **exit 0** | PASS |
| `npx eslint src tests` | exit 0 | **exit 0** | PASS |
| `test:ai` (AI Contract) | 508 | **508** | 불변 |
| `test:observed` | 10 | **10** | 불변 |
| `test:history` | 100 | **100** | 불변 |
| `test:lifecycle` | 144 | **144** | 불변 |
| `test:relationship-evidence` | 280 | **280** | 불변 |
| `test:ai:e2e` (Provider) | 6/6 | **6/6** | 불변 |
| **`test:trust` (신규)** | – | **88** | 신규 |
| `npm run build` | 성공 | **성공** | PASS |

**Final Trust Closure 재실행 (NEW-003 · 2026-09-09):** 기존 8종 전부 baseline 불변
(`tsc` 0 · `eslint` 0 · `test:ai` 508 · `test:observed` 10 · `test:history` 100 ·
`test:lifecycle` 144 · `test:relationship-evidence` 280 · `test:ai:e2e` 6/6 ·
`build` 성공). `test:trust` **88 → 135** (+47: TEMP-01~06 46건 + resolver 정합 guard 1건).
증가 이유는 §14.8에 TC별로 적었다.

**R-9 Closure 재실행 (2026-09-09):** 기존 8종 전부 baseline 불변
(`tsc` 0 · `eslint` 0 · `test:ai` 508 · `test:observed` 10 · `test:history` 100 ·
`test:lifecycle` 144 · `test:relationship-evidence` 280 · `test:ai:e2e` 6/6 ·
`build` 성공). `test:trust` **135 → 162** (+27: TEMP-DISPLAY-01~06). `test:history` 100이
불변인 것이 **legacy 스냅샷 무영향의 증거**다 — 표시 정책은 `evidenceScope`가 없는
기록을 통과시킨다.

**R-11 Closure 재실행 (2026-09-09):** 기존 8종 전부 baseline 불변
(`tsc` 0 · `eslint` 0 · `test:ai` 508 · `test:observed` 10 · `test:history` 100 ·
`test:lifecycle` 144 · `test:relationship-evidence` 280 · `test:ai:e2e` 6/6 ·
`build` 성공). `test:trust` **162 → 183** (+21: TEMP-AI-01~06). `test:ai` 508과
`test:ai:e2e` 6/6이 불변인 것이 **AI 계약 무영향의 증거**다 — 게이트는 요청·파싱·검증이
아니라 **소비**만 막는다.

**R-12 Closure 재실행 (2026-09-09):** 기존 8종 전부 baseline 불변 · `test:trust`
**183 → 205** (+22: TEMP-AI-AXIS-01~06 + Core 본문 게이트 guard 1).

⚠️ **`test:relationship-evidence`에서 CC7이 한 번 깨졌고 assertion을 고쳐 280을 복구했다.**
v1.43 CC7은 `core={narrative.data?.core}`를 **리터럴로** 고정했는데, R-12가 그 자리에 게이트를
붙이면서 리터럴이 깨졌다. **불변식(넘기는 자리가 한 곳)은 유지**되므로 패턴을
`core={…narrative.data?.core…}`로 넓혔다 — 건수는 280 그대로이고, 게이트 자체는
`test:trust`가 별도로 고정한다. 리터럴을 지키려고 게이트를 되돌리는 것은 순서가 거꾸로다.

**기존 건수 감소 0.** 증가분은 신규 suite 하나(`test:trust` 88건)이고 **기존 suite에는
한 건도 추가하지 않았다** — 손상 입력 fixture를 정상 판정 fixture에 섞으면 기존 baseline의
의미가 흐려진다. 무엇이 늘었는지는 §13.4에 항목별로 적었다.

초판이 자동 고정을 미룬 이유(새 dev 엔드포인트 표면)는 Final Closure에서 뒤집었다 —
`/api/dev/trust-test`는 Production 404이고 기존 두 dev 라우트와 같은 게이트를 쓴다. R-5 해소.

---

## 6. Deferred Product Decisions

v1.43 QA의 **PD-001 ~ PD-004 전부 그대로 유지**한다. 이번 배치에서 하나도 구현하지 않았다.

| ID | 상태 | 이번 배치에서의 취급 |
|---|---|---|
| PD-001 (빈 correction 정책) | 유지 | BUG-001 수정이 `조금 달라` 단독 상태를 **건드리지 않음**을 명시적으로 검증(§3 PD-001 행). 빈 correction 자동 저장 없음 · 새 verdict 상태 없음 · 새 배지 없음 |
| PD-002 (Deep Report `conversationQuestion` 존폐) | 유지 | 미변경 |
| PD-003 (Fake Door 재접촉 수단) | 유지 | 미변경 |
| PD-004 (S30 재권유 로직) | 유지 | 미변경 |

---

## 7. NOT VALIDATED

v1.43 QA의 **NV-001 ~ NV-008 전부 그대로 유지**한다. 이번 배치는 결함 수정과 집계 정정이고
제품 가치 검증이 아니다.

NV-001 ₩1,900 WTP · NV-002 Mirror Core Value · NV-003 History Retention ·
NV-004 S30 가치 · NV-005 selfGap 인지 · NV-006 TargetRelation 충분성 ·
NV-007 Premium Connection 가치 · NV-008 점수 오독 여부.

---

## 8. 신규 발견

### NEW-002 — 빈 세션에서 `/home`이 근거 없는 확정 문구를 보여준다 [P2 · ~~미수정~~ **FIXED · verified**]

> **아래는 발견 시점(Pre-Fix) 기록 그대로다.** 수정 내용과 검증 결과는 [§13](#13-new-002-final-closure-2026-09-09)에 있다.

**재현:** `localStorage.clear()` → `/home`. 아무것도 답하지 않은 신규 사용자 상태다.

**실제:**

```
현재 러비가 알고 있는 나
독립적인 시간을 중요하게 여기지만 관계의 연결 신호에는 민감한 편   ← 근거 0

최근 관찰
연락   아직 뚜렷한 신호 없음      ← 올바른 빈 상태
갈등   잠깐 뒤 대화 선호          ← 근거 0
취미   아직 뚜렷한 신호 없음      ← 올바른 빈 상태
```

**원인 (특정 완료):**

| # | 위치 | 내용 |
|---|---|---|
| a | `src/data/copy.ts:271` `HOME_COPY.fallbackProfile` | 하드코딩된 성격 단정문. `src/app/home/page.tsx:172`가 계산된 summary가 없을 때 **무조건** 이 문장을 쓴다 — '답변이 없다'와 '이런 사람이다'를 같은 자리에 놓았다 |
| b | `src/lib/logic/profile.ts:274` | 갈등 칩의 마지막 `else`가 `'잠깐 뒤 대화 선호'`를 반환한다. 연락·취미 칩은 같은 자리에서 `'아직 뚜렷한 신호 없음'`을 쓴다 — **세 축 중 갈등만 빠졌다** |

**왜 P2인가:** 정상 경로다(신규 사용자 전원이 본다). 데이터 손실·플로우 차단은 없지만,
"근거 없이 판정하지 않는다"는 이 제품의 1순위 원칙을 기본 화면에서 위반한다. BUG-002가
tampering 경로였던 것과 달리 이건 **기본값 경로**다.

**왜 이번에 고치지 않았나:** 이 배치의 범위는 "S07 보존 + 재현 Bug 4건 + QA 정합성 +
삭제 버튼 hit-area"로 명시돼 있다. 수정 자체는 두 곳의 fallback 문구 교체로 작아 보이지만,
`fallbackProfile`을 무엇으로 바꿀지는 **카피 결정**이라 임의로 정하지 않는다.

**수정 권장 범위:** (a) `home/page.tsx:172`에서 profile 미완료 시 빈 상태 카피로 분기
(b) `profile.ts:274`의 `else`를 `'아직 뚜렷한 신호 없음'`으로 — 다른 두 축과 동일하게.

> **Final Closure 결과 (2026-09-09):** 두 권장 범위대로 수정했다. **카피 결정은
> 발생하지 않았다** — 새 문장을 만드는 대신 repo에 이미 있던 중립 문구 두 개를
> `NO_EVIDENCE_COPY`로 모아 재사용했다. 상세 §13.

### BUG-004 — 재현되지 않음 (원 QA 측정 오류)

`PastStepView.tsx:148-151`은 v1.43 시점에도 `togglePastFactor()`가 `false`를 반환하면
`최대 4개까지 고를 수 있어` 토스트를 띄우고 있었다. **코드는 처음부터 정상이었다.**

원 QA가 놓친 이유는 관측 방법이다 — 5번째 클릭 후 토스트를 같은 호출 안에서 읽지 않고
다음 tool call에서 `document.body.innerText`로 읽었는데, 그때는 이미 자동 소멸한 뒤였고
매칭된 `최대 4개`는 상시 헬퍼 문구였다. (이 환경의 Browser pane은 탭이 `document.hidden`
이라 타이머가 clamp된다 — 타이밍 의존 관측이 특히 취약하다.)

**교훈:** 자동 소멸하는 UI는 **클릭과 같은 실행 단위 안에서** 전용 셀렉터
(`[role="status"]`)로 읽어야 한다. 본문 전체 텍스트 매칭은 상시 문구와 구분되지 않는다.

**조치:** 코드 수정 없음(중복 토스트를 만들지 않기 위해). 원 QA 문서의 재현율·상태에
취소선 정정 + 주석 추가, 실제결과·상태 원문은 보존.

---

## 9. 원본 QA 정정 내역

`docs/QA_럽유럽미_v1.43.md`에 가한 변경은 **집계 산술과 사실오류 정정뿐**이다.
개별 TC의 `실제 결과`·`상태` 텍스트는 하나도 바꾸지 않았다.

| 위치 | Before | After | 근거 |
|---|---|---|---|
| §5 끝 합계 | `테스트케이스 합계: 100건` | `148건` | 문서의 TC 행을 스크립트로 카운트 |
| §10 화면별 표 | 손집계 19행 · 합계 `138 / 5 / 0 / 7` | TC 섹션(5.1~5.15) 기준 15행 · 합계 `148 / 138 / 4 / 0 / 6` | `FAIL 5`는 ERR-007을 `Past`·`Error` 두 행에 이중 계상, `NOT TESTED 7`은 행 합(6)과 불일치 |
| §10 각주 | "체크리스트(84) + 테스트케이스(100) 중복 집계" | "테스트케이스 단독 집계 / 체크리스트는 별도" | 두 집계를 합산하지 않음을 명시 |
| §12.1 | `Total 100 / PASS 92 / FAIL 5 / NOT TESTED 7` | `148 / 138 / 4 / 6` | 〃 |
| §12.1 각주 | "BUG-003→ERR-004·ERR-005" · "BUG-003이 TC 2건에 걸침" | "BUG-003→ERR-005" · FAIL 4건 ↔ Bug 4건 **1:1** | **ERR-004는 PASS다**(문서 원문 확인) |
| §12.1 P3 | `P3 4` | `P3 3` | FAIL 우선순위 분포 실측 `P2:1, P3:3` |
| §6 ERR-007 / BUG-004 행 | 재현율 `100%` · `OPEN` | 취소선 + `0% (재현 안 됨)` · `NOT REPRODUCIBLE` + 정정 주석 | §8 재검증 |

**체크리스트(§4) 집계는 건드리지 않았다** — 스크립트 재계산 결과 `84 / PASS 78 /
FAIL 2 / NOT TESTED 4`로 원문과 일치했다.

---

## 10. Privacy / Secret

| 항목 | 결과 |
|---|---|
| AI payload에 새 raw `status`/`job`/`stage` | **없음** — 이번 수정은 `deserialize`·setter·cache consumer 계층이고 AI context builder를 건드리지 않았다 |
| `coreCorrection` Provider 전송 | **없음** — `aiEvidenceResolver.ts:782`의 기존 정책(correction이 있으면 core를 AI에 보내지 않음) 그대로. BUG-001 수정은 correction을 **비우는** 방향이라 전송량이 늘 수 없다 |
| free text analytics 추가 | **없음** — 새 이벤트 0, 새 property 0 |
| photo raw data History 저장 | **없음** — `serialize()`는 여전히 `{id,label,source,tone}`만 저장 |
| 새 시크릿/키 | **없음** — 새 환경변수 0 |
| `sessionSanitize.ts` 로깅 | **없음** — 강등된 값을 console에 찍지 않는다(원문이 로그로 새지 않도록) |

값 출력 없이 확인했다.

---

## 11. Remaining Risks

| ID | 내용 | 상태 |
|---|---|---|
| R-1 | **legacy sample photo가 `answers.photos`에 남는다.** §5.3 결정에 따라 이번 deserialize 수정에서 `photos` source migration을 **명시적으로 제외**했다 — `loadSampleSession()` 데모가 같은 구조를 쓰므로 자동 삭제하면 데모 세션 reload semantics가 바뀐다 | 유지 (의도적) |
| R-2 | **`/home`의 `사진 {answers.photos.length}장`** 이 legacy 세션에서 실제보다 크게 표시될 수 있다. S07의 개수·상한·분석 대상은 이미 upload only라 판정에는 영향 없음 | 유지 |
| R-3 | ~~**NEW-002** — 빈 세션 `/home` 확정 문구 2건 (§8)~~ | **해소.** Final Closure에서 수정 + Browser 실측 + `test:trust` T10~T13으로 고정 (§13) |
| R-4 | **Vision 실제 콘텐츠 인식 품질** — 합성 PNG만 사용. v1.43 QA의 NOT VERIFIED 그대로 | 유지 |
| R-5 | ~~**BUG-002/003이 자동 테스트로 고정되지 않았다.**~~ | **해소.** `test:trust` 88건 신설(T1~T6 강등 · T7~T9 `meta` 부재 · T14 정적 배선). 권고대로 dev fixture 라우트(`/api/dev/trust-test`, Production 404)를 추가했다 |
| R-9 | ~~**`/home` '최근 분석' 카드의 상태 배지가 여전히 `CHANGE`다.**~~ | **해소.** 표시 정책 `displayStateOf`로 5개 소비처를 닫았다(§15). 내부 state·`SavedState`·저장된 스냅샷은 **그대로**이므로 v1.41의 판단(이름을 바꾸지 않는다)도 지켜졌다 — 바뀐 것은 **부르는 이름**뿐이다. `test:trust` TEMP-DISPLAY-01~06 |
| R-11 | ~~**AI 생성 Core headline이 비교 근거 없는 축에 `변화` 어휘를 쓴다.**~~ | **해소.** `canUseAiHeadline(focus)` 소비 게이트로 닫았다(§16). 게이트를 `aiHeadline` memo **한 곳**에 두어 화면·History 저장·`/home` 재노출이 함께 해소된다. AI 요청·프롬프트·promptVersion·스캐너·캐시·내부 state 변경 **0** · `MATCH`/`GAP` focus의 AI headline **회귀 0**(TEMP-AI-03 + 실측) |
| R-12 | ~~**축별 AI narrative(`러비가 이렇게 봤어`)는 여전히 시제 어휘를 쓴다.**~~ | **해소.** `canUseAiAxisNarrative(insight)` 소비 게이트로 닫았다(§17). 검증 중 **Core AI 서술 본문**(`core.summary`)이 R-11의 headline 게이트를 우회하는 것을 실측해 같은 게이트로 함께 닫았다. **결정론 노트는 그대로 유지** · `MATCH`/`GAP` AI 서술 **회귀 0** · R-11과 술어 공유 |
| ~~R-12 (원문)~~ | ~~**축별 AI narrative는 여전히 시제 어휘를 쓴다.**~~ R-11 실측 중 확인: `scope 'none'` 행의 축 서술에 `이 부분에서 변화가 있을 수 있어.` · `연락의 중요성에 대한 인식이 이전과 달라졌을 가능성이 있어.`가 남는다. **R-11의 대상은 Core headline(`aiHeadline`)이었고 이건 다른 소비처**(`narrative.data.narratives`)다. 같은 방식의 소비 게이트로 닫을 수 있지만 이번 배치의 범위가 아니다 — 상세 §16.5 | **신규 (R-11 Closure) · 미수정** |
| ~~R-11 (원문)~~ | ~~**AI 생성 Core headline이 비교 근거 없는 축에 `변화` 어휘를 쓴다.**~~ 실측: focus 축 `contact`(`CHANGE`·`scope 'none'`)에서 `연락의 중요성이 가장 두드러진 변화로 보여`(`mode: real`). `/mirror`는 `aiHeadline`을 결정론 headline보다 **먼저** 쓰므로 NEW-003의 수정이 AI 성공 시 가려지고, 그 문장이 History에 저장돼 `/home` 카드에 다시 나온다. 프롬프트·안전 스캐너 수정은 **AI contract 변경**이라 이번 display-only 범위 밖 — 상세와 두 가지 해결 옵션은 §15.6 | **신규 (R-9 Closure) · 미수정** |
| R-10 | **`TEMPORAL_PHRASES` 목록은 2차 guard다.** 1차는 `evidenceScope × state` 구조 검사이고, 문자열 목록에 없는 새 시제 표현이 생기면 TEMP-01~03은 통과한다. 목록을 늘리는 대신 술어(allowlist)를 통과하게 만드는 것이 방어의 본체이고, TEMP-05가 그 구조를 고정한다 — 그래도 새 소비처가 술어를 우회하면 잡지 못한다 | **신규 (Final Trust Closure)** |
| R-8 | **`test:trust`가 `sessionSanitize`를 부르지만 `deserialize()`를 부르지는 않는다.** T1~T6이 검사하는 것은 강등 **규칙**이고, 그 규칙이 실제 복원 경로에서 불린다는 증거는 T14의 소스 문자열 검사뿐이다 — 호출 형태를 바꾸면 T14는 조용히 통과한다. 근본 해결은 `deserialize()`를 `'use client'` 밖의 순수 모듈로 옮기는 것이지만, BUG-002 수정 자체를 다시 여는 변경이라 이번 범위 밖 | **신규 (Final Closure)** |
| R-6 | 기존 미검증 영역(S09 · S16a · History 삭제 · Share · Lens 상세 · Onboarding · 포커스 트랩 · 크로스 브라우저) | 유지 |
| R-7 | **Production 미배포.** 이 문서의 모든 실측은 LOCAL dev 기준이다. Production(v1.43)은 이 수정을 아직 포함하지 않는다 | 유지 |

---

## 12. 판정

| 항목 | 값 (초판) | 값 (Final Closure) |
|---|---|---|
| Targeted Retest | 27건 — PASS 26 · FAIL 1(NEW-002) | **27건 PASS 27 · FAIL 0** (+ Fresh/Partial/Valid/Correction 4 Journey) |
| Regression | 8종 baseline 유지 · build 성공 | **8종 baseline 불변 + `test:trust` 88 신규** · build 성공 |
| 수정으로 인한 신규 회귀 | 0건 | **0건** |
| P0 / P1 | 0 / 0 | **0 / 0** |
| 잔여 P2 | 1건 (NEW-002 · 미수정) | **0건** |
| 자동 회귀 미고정 | BUG-002 · BUG-003 · NEW-002 | **0건** (R-8은 배선 검사 방식의 잔여 한계) |
| Final Trust Closure (NEW-003) | – | **PASS** · `test:trust` 88 → **135** · 기존 baseline 8종 불변 |
| R-9 Closure | – | **PASS** · `test:trust` 135 → **162** · 기존 baseline 8종 불변 |
| R-11 Closure | – | **PASS** · `test:trust` 162 → **183** · 기존 baseline 8종 불변 (`test:ai` 508 · E2E 6/6 = AI 계약 무영향) |
| R-12 Closure (Final Release) | – | **PASS** · `test:trust` 183 → **205** · 기존 baseline 8종 불변 (CC7 assertion 1건 갱신 · 건수 280 유지) |

**Candidate 판정: PASS.**

BUG-001·BUG-002·BUG-003·NEW-001은 전부 의도한 대로 동작하고 회귀를 만들지 않았다.
BUG-004는 결함이 아니었고 코드를 바꾸지 않았다. **NEW-002는 Final Closure에서 수정하고
실측·자동 회귀 양쪽으로 검증했다** — 초판이 배포 판단에 남겨둔 P2가 이제 없다.

⚠️ 남은 것은 **검증 방식의 한계**(R-8·R-10)와 **범위 밖 항목**(R-1·R-2·R-4·R-6·R-7 ·
PD-001~004 · NV-001~008)이다. 다섯 배치 전부에서 하나도 섞지 않았다.

**Mirror 경로의 근거 없는 시제 주장은 0이다** — 결정론과 AI 양쪽, headline·summary·축 노트·
축 서술·Core 서술 본문·배지·아이콘·스크린리더·Home Hero·Home 칩·최근 분석 카드·History
스냅샷·공유 카드 전부. **P0/P1/P2 잔여 0.**

---

*v1.44 Post-Fix 검증 · 2026-09-09 · base `52f5601` · uncommitted · commit/push 없음*

---

## 13. NEW-002 Final Closure (2026-09-09)

### 13.1 항목 요약

| 항목 | 내용 |
|---|---|
| 발견 | BUG-002 검증 중 fresh session에서 별도 발견 (초판 §8) |
| Priority | **P2** — 정상 경로다. 신규 사용자 전원이 본다 |
| Root Cause | ⓐ `HOME_COPY.fallbackProfile`(하드코딩 성격 단정문) + ⓑ `buildHomeHighlights()` 갈등 축 마지막 `else`가 유효 답 `soon`과 미입력 `null`을 한 갈래에 묶었다 |
| Fix | ⓐ `fallbackProfile` 삭제 → `homeHeroSummary()` 순수 함수 · ⓑ `soon`을 명시하고 나머지는 `NO_EVIDENCE_COPY.axis`. **중립 문구는 repo의 기존 문장 재사용 — 새 카피 0** |
| Browser | fresh / partial / valid / correction 4 Journey 실측 |
| Automated Regression | `test:trust` T10~T13 (신규 fixture) |
| 상태 | **PASS** |

### 13.2 수정 정책 — 새 성격 카피를 만들지 않았다

초판이 수정을 미룬 이유는 "`fallbackProfile`을 무엇으로 바꿀지는 카피 결정"이었다.
**그 결정은 발생하지 않았다** — 근거가 없다는 사실을 그대로 말하는 문장이 이미 코드에
두 개 있었고, 그것이 정답이었다.

| 자리 | 재사용한 기존 문구 | 원래 어디에 있었나 |
|---|---|---|
| 요약 한 줄 `NO_EVIDENCE_COPY.summary` | `아직 뚜렷한 특징을 관찰하기엔 정보가 조금 더 필요해.` | `buildProfileSummary()`의 마지막 줄 (`profile.ts:181`) |
| 축 칩 `NO_EVIDENCE_COPY.axis` | `아직 뚜렷한 신호 없음` | Home 연락·취미 축 (`profile.ts:263, 285`) |

세 곳이 각자 리터럴을 들고 있으면 이번처럼 **한 축만 조용히 빠지므로** 한 곳에서
정의하고 나눠 쓴다.

### 13.3 Fresh / Partial / Valid Matrix — 실측

`localStorage`/`sessionStorage` 정리 후 세션을 직접 주입해 `/home` DOM을 읽었다.

| TC | 입력 | 기대 | 실측 | 상태 |
|---|---|---|---|---|
| **HOME-EMPTY-01** | `localStorage.clear()` | Hero neutral · 연락/갈등/취미 확정형 단정 0 | Hero `아직 뚜렷한 특징을 관찰하기엔 정보가 조금 더 필요해.` · 세 축 **전부** `아직 뚜렷한 신호 없음` · `잠깐 뒤 대화 선호` **0건** · 삭제된 성격 단정문 **0건** · console error **0** | **PASS** |
| **HOME-PARTIAL-01** | `declared.contact:5`만 | contact는 실제 입력 기반 · conflict/hobby는 중립 | 연락 `경험 후 기준이 낮아짐`(contact=5 유래 판정) · 갈등 `아직 뚜렷한 신호 없음` · 취미 `아직 뚜렷한 신호 없음` · `질문 1개` | **PASS** |
| **HOME-CONFLICT-NOW-01** | `conflict:'now'` | `빠른 해결 선호` 유지 | `빠른 해결 선호` | **PASS** |
| **HOME-CONFLICT-SPACE-01** | `conflict:'space'` | `혼자 정리할 시간 필요` 유지 | `혼자 정리할 시간 필요` | **PASS** |
| **HOME-CONFLICT-SOON-01** (신설) | `conflict:'soon'` | `잠깐 뒤 대화 선호` 유지 — **유효 입력이다** | `잠깐 뒤 대화 선호` · DECLARED 칩 `잠깐 뒤 이야기` | **PASS** |
| **HOME-VALID-PROFILE-01** | 정상 완료 세션 (declared 5종 + experience 3+hardest+selfGap+note, `completed.profile/mirror`) | 기존 profile/mirror summary 유지 | Hero = 실제 Mirror 요약 `혼자 있는 시간을 좋아하지만, 관계에서 연결이 끊기는 신호에는 생각보다 민감한 편일 수 있어.` · 연락 `생각보다 중요한 신호`(GAP) · 갈등 `빠른 해결 선호` · 최근 분석 카드 정상 | **PASS** |
| **HOME-CORRECTION-01** | 위 + `coreCorrection` | 사용자 correction 우선 | Hero = `연락보다 연결감이 중요한 것 같아.` (Mirror 요약을 밀어냈다) | **PASS** |

> ⚠️ **HOME-CONFLICT-SOON-01을 새로 세운 이유.** 프롬프트의 원 matrix에는 `now`·`space`만
> 있었다. 그런데 결함의 실제 구조는 `soon`과 `null`이 **같은 갈래에 묶여 있던 것**이었고,
> `soon`을 검사하지 않으면 "미입력에 말을 붙이지 않는다"를 만족시키면서 **유효 답 하나를
> 조용히 잃는** 수정도 통과한다. 고정해야 하는 것은 두 방향 모두다.

> ⚠️ **HOME-PARTIAL-01에서 관찰한 별건.** 연락 축 문구 `경험 후 기준이 낮아짐`은 관계
> 경험을 하나도 답하지 않은 세션에서도 나온다 — `declared.contact:5`는 실제 입력이므로
> NEW-002(근거 없는 단정)에 해당하지 않지만, `경험 후`라는 **시간적 변화 서술**은 v1.41
> §39.11이 headline에서 정리한 것과 같은 성질이다. ~~이번 범위에서 고치지 않았다.~~
>
> → **NEW-003으로 정식 기록하고 수정했다([§14](#14-new-003-unsupported-temporal-change-claim-2026-09-09)).**
> 추적 결과 Home 칩 하나가 아니라 **8개 소비처**의 같은 결함이었고, 그 중 Core summary는
> `mirror.core`를 통해 **NEW-002가 세운 Hero neutral 상태를 우회**하고 있었다.

### 13.4 BUG-002 / BUG-003 / NEW-002 자동 회귀 — `test:trust` 88건

기존 테스트 체계 안에 넣었다. `/api/dev/trust-test`(Production **404**)가 화면과 같은
함수를 호출하고 `tests/run-trust-fixtures.mjs`는 fixture 조립·검증만 한다 —
`run-lifecycle-fixtures.mjs`와 같은 방식이고 **새 프레임워크를 도입하지 않았다.**

| 구간 | 대상 | 고정하는 것 | 건수 |
|---|---|---|---:|
| T1 | BUG-002 | invalid status → `null` · 크래시 0 · 확정형 관찰 0 | 3 |
| T2 | BUG-002 | invalid declared scalar/enum 5종 → 전부 `null` · DECLARED 칩 0개 · 갈등 축 중립 | 8 |
| T3 | BUG-002 | invalid experience collection/enum → `'notanarray'`가 `[]`(문자열 `.length` 11이던 자리) · RELATIONSHIP 칩 0개 | 6 |
| T4 | BUG-002 | invalid target relation · 4축 `'x'` 강등 · 지금 관계 근거의 알 수 없는 축/답 제거 · 유효값 보존 | 8 |
| T5 | BUG-002 | valid+invalid 혼합 — **유효 값만 살아남고 invalid만 강등** · 중복 factor 제거 | 9 |
| T6 | BUG-002 | valid legacy fixture — 정상 세션은 글자 하나 달라지지 않는다 · Mirror 열림 · 요약이 중립 문구가 아니다 | 5 |
| T7 | BUG-003 | `meta=null` → mode `null` · 지문 오판 0 | 2 |
| T8 | BUG-003 | `meta` 없음 · `data=null` · `mode`/지문이 문자열 아님 → 전부 안전 | 6 |
| T9 | BUG-003 | `meta` 정상 — `real`/`mock` 그대로 읽고, 같은 지문은 같은 분석으로 유지 | 4 |
| T10 | NEW-002 | 빈 세션 — Hero 2종 · 세 축 중립 · **세 축이 같은 문구인지**(한 축만 빠지는 것이 결함이었다) · 확정형 0 | 7 |
| T11 | NEW-002 | 부분 입력 — contact는 입력 기반, 나머지는 채우지 않는다 | 4 |
| T12 | NEW-002 | `now`·`space`·`soon` 문구 보존 (+ `soon`의 DECLARED 칩) | 4 |
| T13 | NEW-002 | Hero 우선순위 4종 — Mirror 요약 · 미완료 차단 · correction 우선 · 공백 요약 | 4 |
| T14 | 배선 | `deserialize()`가 강등 함수 12개를 부르는지 · `homeHeroSummary()` 사용 · `fallbackProfile` 잔존 0 (**정적**) | 18 |
| | | **합계** | **88** |

**기존 suite 건수는 한 건도 늘리거나 줄이지 않았다.** 손상 입력 fixture를 정상 판정
fixture에 섞으면 기존 baseline의 의미가 흐려진다.

#### 테스트를 위해 production code를 과도하게 export하지 않았다

| 옮긴 것 | 어디서 → 어디로 | 왜 |
|---|---|---|
| `aiModeOf` | `useAiNarrative.ts`의 지역 `modeOf` → `@/lib/aiMeta` | `'use client'` 훅 안에 있어 React 밖에서 부를 수 없었다 — BUG-003만 자동 회귀가 비어 있던 이유 |
| `sameAnalysisFingerprint` | `SessionProvider.tsx`의 인라인 비교 → `@/lib/aiMeta` | 같은 이유. 함수로 빼면서 "지문을 못 읽으면 다른 분석으로 취급한다"는 규칙이 이름을 얻었다 |
| `homeHeroSummary` | `home/page.tsx`의 삼항 한 줄 → `@/lib/logic/profile` | Hero 우선순위를 검사 가능한 한 곳에 세웠다 |

셋 다 **판정이 없는 순수 helper**다. 훅 내부·컴포넌트 내부는 export하지 않았다.

#### `deserialize()`를 직접 부르지 않는 것의 한계

`deserialize()`는 `'use client'` 모듈의 지역 함수다. 옮기면 BUG-002 수정 자체를 다시
여는 변경이라 **이번 범위 밖**으로 뒀다. 대신 두 겹으로 검사한다:

```text
T1~T6   강등 규칙 자체        런타임 · 화면과 같은 함수
T14     그 규칙의 배선 여부    정적 · 소스 문자열
```

⚠️ **T14는 호출 형태를 바꾸면 조용히 통과한다**(예: 중간 변수로 빼면). 정직한 잔여
위험으로 §11 R-8에 적었다. 두 검사를 **함께 두어야** 의미가 있다.

### 13.5 이번 Final Closure에서 섞지 않은 것

| 항목 | 취급 |
|---|---|
| S07 / BUG-001~003 재구현 | 하지 않았다. 기존 candidate 변경 그대로 |
| BUG-004 중복 토스트 | 추가하지 않았다 |
| Frozen Snapshot | 0건 수정 |
| Compatibility / Mirror 계산 | 변경 0 |
| Lifecycle / AI contract | 변경 0 |
| PD-001~004 · NV-001~008 | 구현·검증 0 |
| legacy sample photo migration (R-1 · R-2) | 하지 않았다 |
| `/home` redesign | 하지 않았다 |
| `경험 후 기준이 낮아짐` 시제 서술 (§13.3 별건) | 판정 문구 변경이라 하지 않았다 |

---

## 14. NEW-003 Unsupported Temporal Change Claim (2026-09-09)

### 14.1 항목 요약

| 항목 | 내용 |
|---|---|
| 발견 | NEW-002 수정 후 HOME-PARTIAL-01 실측 중 별건으로 관찰 (§13.3) |
| Priority | **P2** — 정상 경로다. 관계 경험을 답하지 않고 성향 질문만 답한 사용자 전원이 본다 |
| Root Cause | v1.41이 시제 문장을 `scope === 'current'`로 갈랐고, **그 else 쪽에 `'none'`이 함께 있었다.** blocklist였기 때문에 scope가 하나 늘 때 조용히 과거형으로 떨어졌다 |
| Fix | 술어 2개(`hasTemporalComparison` = `'past'`만 · `hasRelationshipEvidence` = `'none'` 제외)로 **allowlist로 뒤집고** 8개 소비처에 적용 |
| Browser | Journey A(부분 입력) · Journey B(과거 근거) · console error 0 |
| Automated Regression | `test:trust` TEMP-01~06 (신규 47건) |
| 상태 | **PASS** |

### 14.2 Trust Invariant

> **TEMPORAL CHANGE CLAIM → TEMPORAL COMPARISON EVIDENCE REQUIRED**
>
> **시간적 변화 표현은 서로 다른 시점의 실제 비교 근거가 있을 때만 사용한다.**

`경험 후` · `예전보다` · `이전보다` · `낮아짐` · `높아짐` · `변했어` · `달라졌어` 같은
Before/After 의미는 **`evidenceScope === 'past'`일 때만** 허용한다. Declared 단일 시점
입력만으로 시간적 변화 서사를 만들지 않는다.

⚠️ **두 술어를 구분한다.** 섞으면 조용히 회귀가 난다 — 실제로 이번 수정 중에 한 번 났고
실측으로 잡았다(§14.6).

| 술어 | 질문 | 참인 scope |
|---|---|---|
| `hasTemporalComparison` | Before/After를 **주장**해도 되는가 | `'past'` |
| `hasRelationshipEvidence` | 관계에서의 **반응을 말**해도 되는가 | `'past'` · `'current'` |

### 14.3 재현 — 근거와 해석이 서로 반대되는 말을 했다

`declared.contact = 5` · 관계 경험 0 · 지금 관계 근거 0 (`/api/dev/trust-test` 실측):

```text
Home 최근 관찰   연락 · 경험 후 기준이 낮아짐                            ← 근거 0
Mirror 노트      연락에 대한 기준이 경험 후 낮아졌어.                     ← 근거 0
Core headline    너는 연락을 중요하게 여긴다고 말했지만,
                 경험 후에는 우선순위가 옮겨간 사람일지도 몰라.           ← 근거 0
Core summary     연락에 대해 말한 기준과 실제 관계에서의 반응이 조금 달랐어. ← 반응 0
Home Hero        (= Core summary)                                        ← NEW-002 우회
```

**같은 행의 근거 칸은 이미 사실을 말하고 있었다** —
`이전 관계에서 연락을 특별히 중요한 요소로 꼽지는 않았어`.
근거와 해석이 한 행에서 서로 반대되는 말을 했다.

⚠️ **Core summary가 Home Hero로 나가는 것이 가장 나쁜 결과였다.** `mirror.core`가
non-null이 되면서 NEW-002가 세운 Hero의 neutral 상태를 **우회했다** — 방금 닫은 결함이
다른 경로로 되살아나 있었다.

### 14.4 계산 경로 (dirty tree 재추적 · 추측 없음)

```text
resolveAxisEvidence({ axis:'contact', experience: 비어 있음, current: 비어 있음 })
  current.signals.contact === undefined       → 넘어감
  experience.skipped === false                → 넘어감
  pastStrengthOf('contact', experience)        → 'absent'
  ⇒ { strength: 'absent', scope: 'none' }

stateFor(5, 'absent', 'none')
  declaredHigh (5 >= 4)                        → 'CHANGE'      ← 판정은 v1.0부터 그대로

buildInsights: state !== 'UNKNOWN'             → insight 생성
buildHomeHighlights: state === 'CHANGE'        → '경험 후 기준이 낮아짐'
```

#### 도달 가능한 state × scope 조합 — 전수 측정

225개 세션 조합(declared 1~5 × current 5종 × past 3종 × hardest 3종)을 라우트로 돌려
실제로 생성되는 조합만 뽑았다.

| state | scope | 도달 | 시제 주장 | 판단 |
|---|---|---|---|---|
| MATCH | `past` | ✅ | `경험 전후가 비슷했어` | **정당** — 두 시점 근거 존재 |
| MATCH | `current` | ✅ | 없음 | 안전 |
| GAP | `past` | ✅ | 없음 | 안전 |
| GAP | `current` | ✅ | 없음 | 안전 |
| CHANGE | `current` | ✅ | 없음 (v1.41이 갈랐다) | 안전 |
| CHANGE | `none` | ✅ | **`경험 후 …`** | ❌ **NEW-003** |
| CHANGE | `past` | ❌ **도달 불가** | `경험 후 …` | 아래 참고 |

> ⚠️ **`CHANGE × past`는 도달할 수 없다.** CHANGE는 `strength === 'absent'`에서만 나오고,
> `scope === 'past'`는 `strength`가 `important`/`hardest`일 때만 붙는다. 즉 **모든 도달
> 가능한 CHANGE는 `'current'`(v1.41이 닫음) 아니면 `'none'`(이번에 닫음)이었다** —
> `경험 후 …` CHANGE 문구 계열은 **참인 경로로는 한 번도 도달한 적이 없다.**
>
> 그래도 **지우지 않았다.** `stateFor`에 경로가 생기면 그때 맞는 문장이고, 지우면 그
> 판단 근거가 코드에서 사라진다. 도달 불가라는 사실을 여기 적어 두는 것으로 대신한다.

### 14.5 Temporal Evidence Audit — 전수

`경험 후`·`경험 전후`·`예전보다`·`이전보다`·`낮아짐/낮아졌`·`높아짐/높아졌`·`달라졌`·
`옮겨간/옮겨짐/옮겨졌`·`중요해졌`·`연애 전에는` 전수 grep(`src/**`) 결과에서 **판정
문구를 만드는 소비처**만 추린 표다.

| FILE | SYMBOL | 문구 | 필요 Evidence | 실제 Gate (before) | before | 조치 |
|---|---|---|---|---|---|---|
| `logic/profile.ts` | `buildHomeHighlights` 연락 CHANGE | `경험 후 기준이 낮아짐` | `past` | **없음** | ❌ | `changeChipOf` |
| `logic/profile.ts` | `buildHomeHighlights` 취미 CHANGE | `관계의 핵심 기준은 아님` | 관계 근거 | **없음** | ❌ | `changeChipOf` |
| `data/axes.ts` + `logic/mirror.ts` | `MIRROR_NOTE[*].CHANGE` (5종) via `noteFor` | `경험 후 필요도가 낮아졌어` 등 | `past` | `scope === 'current'`만 | ❌ | `hasTemporalComparison` |
| `logic/mirror.ts` | `buildHeadline` CHANGE | `경험 후에는 우선순위가 옮겨간` | `past` | `scope === 'current'`만 | ❌ | `hasTemporalComparison` |
| `logic/mirror.ts` | `buildSummary` (CHANGE 낙하) | `실제 관계에서의 반응이 조금 달랐어` | 관계 근거 | **없음** | ❌ | `hasRelationshipEvidence` |
| `mirror/MirrorComparisonRow.tsx` | `STATE_TEXT.CHANGE` (스크린리더) | `경험 후 낮아짐` | `past` | `scope === 'current'`만 | ❌ | `hasTemporalComparison` |
| `logic/crossSourceInsights.ts` | mirror CHANGE `ruleSummary` | `경험 후 우선순위가 옮겨간 축이야` | 관계 근거 | `'current' && ref`만 | ❌ | `hasRelationshipEvidence` |
| `logic/history.ts` | `STATE_PHRASE.CHANGE` (스냅샷) | `경험 후 우선순위가 옮겨짐` | `past` | 스냅샷 `'current'`만 | ❌ | `'none'` 갈래 추가 |
| `lib/aiEvidenceResolver.ts` | `HISTORY_STATE_PHRASE.CHANGE` | `경험 후 우선순위가 옮겨짐` | `past` | **없음** | ❌ | `historyStatePhraseOf` |
| `data/axes.ts` | `MIRROR_NOTE[*].MATCH` (`경험 전후가 비슷했어`) | `past` | `MATCH × past`만 도달 | ✅ | **변경 0** |
| `logic/history.ts` | `이전에는 "X"였고, 이번에는 "Y"로 기록됐어` | 스냅샷 2건 | 두 기록 존재가 전제 | ✅ | **변경 0** |
| `ai/promptTemplates.ts` | CHANGE 정의 (모델 지시문) | – | 사용자 문구 아님 | ✅ | **변경 0** |
| `ai/mockProvider.ts` | mock CHANGE 문구 | – | mock 전용 | ✅ | **변경 0** |
| `first-contact/page.tsx` · `history/page.tsx` · `copy.ts` | `무엇이 달라졌는지 볼 수 있어` 등 | – | **미래형 안내** (재관찰 권유) | ✅ | **변경 0** |
| `services/premiumConnections.ts` | `무엇 때문에 달라졌는지도 정하지 않아` | – | 판정을 **거부**하는 문장 | ✅ | **변경 0** |

**같은 root cause인 9개 소비처만 고쳤다.** 정상 History/CHANGE 문구는 일괄 삭제하지
않았고, TEMP-04d가 **정당한 시제 문구가 살아 있는지를 적극적으로** 검사한다.

⚠️ `aiEvidenceResolver`는 원래 gate가 없었지만 함께 고쳤다 — 그 파일의 주석이
`history.ts`의 `STATE_PHRASE`와 **같은 문장이어야 한다**고 명시한다("같은 것을 두 어휘로
부르면 사용자가 두 개의 다른 판정으로 읽는다"). 한쪽만 고치면 History 화면과 Premium
근거 목록이 같은 스냅샷을 다르게 부른다.

### 14.6 수정 정책 — 새 카피를 최소로

| 자리 | 문구 | 출처 |
|---|---|---|
| Home 연락·취미 칩 (`scope 'none'`) | `아직 뚜렷한 신호 없음` | **재사용** — NEW-002가 세 축에 세운 중립 문구 |
| Home 칩 (`scope 'current'`) | `지금은 크게 드러나지 않음` | **재사용** — v1.41 `CURRENT_STATE_TEXT` |
| Core summary (`scope 'none'`) | `아직 뚜렷한 특징을 관찰하기엔 정보가 조금 더 필요해.` | **재사용** — `NO_EVIDENCE_COPY.summary` |
| Mirror 노트 | `{축}을 중요하게 여긴다고 답했어. 이 항목에서는 관계 신호를 아직 확인하지 못했으니, 비교는 하지 않을게.` | 신규 · 최소 factual |
| Core headline | `너는 {축}을 중요하게 여긴다고 답했어. 그게 관계에서 어떻게 나타나는지는 아직 비교할 근거가 없어.` | 신규 · 최소 factual |
| 스크린리더 · 스냅샷 라벨 | `비교할 관계 근거 없음` | 신규 · 최소 factual |
| `crossSource ruleSummary` | `{축}은 중요하다고 말했는데, 이 항목에서는 관계 신호를 아직 확인하지 못했어.` | 신규 · 최소 factual |

신규 4종은 전부 **입력값과 근거 부재만** 말한다 — 새 심리 해석을 넣지 않았다.

> ⚠️ **검사기를 예외로 무르게 만들지 않았다.** 처음 쓴 노트 문구는
> `기준이 달라졌는지는 비교하지 않을게`였는데, `달라졌`이 금지 토큰이라 TEMP-01이
> 실패했다. 검사기에 예외를 넣는 대신 **문구를 고쳤다**(`비교는 하지 않을게`) —
> 예외가 하나 생기면 다음 사람이 그 예외를 근거로 진짜 위반을 통과시킨다.

> ⚠️ **수정 중에 회귀를 한 번 만들었고 실측으로 잡았다.** `buildSummary`에
> `hasTemporalComparison`(= `'past'`만)을 썼더니 `지금 관계에서 자주 그런다`고 **직접
> 답한** 사용자의 GAP 요약까지 `정보가 조금 더 필요해`로 바뀌었다. 그 문장이 주장하는
> 것은 시제가 아니라 **반응의 존재**이므로 술어가 틀렸다. `hasRelationshipEvidence`로
> 고쳤고, TEMP-04b가 그 자리를 고정한다.

### 14.7 판정과 계산은 바꾸지 않았다

| 항목 | 변경 |
|---|---|
| `stateFor` · `resolveAxisEvidence` · `pastStrengthOf` | **0** |
| `MIRROR_AXES` · `gapCount` · `pickFocus`(focus 축) | **0** |
| `SavedState` · History `changeStateOf`(STABLE/SHIFT/NEW) | **0** |
| 동기화율 · `comparedCount` · Premium eligibility | **0** |
| AI 지문 · context · promptVersion | **0** |

v1.41이 CHANGE라는 **이름과 계산을 그대로 두고 문장만 가른** 것과 같은 이유다 — 이름을
바꾸면 저장된 History Snapshot의 의미가 소급해서 달라진다.

⚠️ 그래서 `/home` '최근 분석' 카드의 상태 배지는 여전히 `CHANGE`다. 판정 이름이고
시제 문장이 아니므로 이번 범위에서 건드리지 않았다 → §11 R-9.

### 14.8 TEMP-01~06 — 실측

| TC | 입력 | 기대 | 실측 | 상태 |
|---|---|---|---|---|
| **TEMP-01** | 관계 경험 0 + `contact=5` | 시간 변화 문구 0 | 판정은 `contact:CHANGE:none` 유지 · 시제 문구 **0** · 연락 칩 중립 · Core summary/headline factual · **Home Hero neutral 복귀** · 근거 칸과 노트가 같은 말 | **PASS** |
| **TEMP-02** | 관계 경험 0 + `contact=1` | 시간 변화 문구 0 | 낮은 declared는 애초에 UNKNOWN → insight 0 · 세 축 중립 | **PASS** |
| **TEMP-03** | 비교 근거 0 + declared 5축 전부 높게 | 시제 어휘 전수 0 | 모든 판정 `scope 'none'` · 판정 자체는 생성됨(지우지 않는다) · 시제 문구 **0** · 모든 노트가 비교 불가 명시 · 갈등 칩은 답한 사실(`빠른 해결 선호`) 유지 | **PASS** |
| **TEMP-04** | 과거 근거 존재(`important`+`hardest`) | 기존 시간 변화 표현 유지 | `혼자 있는 시간은 실제 관계에서도 꾸준히 중요했어.` · `중요하지 않다고 생각했지만 관계에서는 생각보다 크게 반응했어.` **글자 그대로** · 같은 세션의 `'none'` 축만 새 문구 | **PASS** |
| **TEMP-04b** | `alone=1` + `often` (scope `'current'`) | 직접 답한 근거의 요약 유지 | `개인 시간에 대해 말한 기준과 실제 관계에서의 반응이 조금 달랐어.` 유지 | **PASS** |
| **TEMP-04c** | `contact=5` + `rarely` (scope `'current'`) | v1.41 문구 재사용 | 연락 칩 `지금은 크게 드러나지 않음` | **PASS** |
| **TEMP-04d** | `contact=4` + `important:['contact']` | **정당한 시제 문구는 살아 있어야** | `연락에 대한 기준은 경험 전후가 비슷했어.` 유지 · 칩 `기준이 비슷하게 유지됨` | **PASS** |
| **TEMP-05** | 소스 정적 검사 | allowlist 구조 유지 | 술어 2종 정의 · 8개 소비처 배선 · legacy 스냅샷 무영향 | **PASS** |
| **TEMP-06** | Fresh Home | NEW-002 neutral 유지 | 시제 0 · 확정형 0 · Hero 중립 · 세 축 중립 | **PASS** |

> ⚠️ **TEMP-04d가 없으면 이 fixture는 위험하다.** "시제 어휘 0건"만 검사하면 **모든 시제
> 문장을 지우는 것**이 가장 쉬운 통과 방법이 된다 — 그건 NEW-003 수정이 아니라 기능
> 삭제다. 정당한 문구가 **살아 있는지**를 함께 고정해야 검사가 의미를 갖는다.

### 14.9 Browser Journey — 실측

| Journey | 입력 | 실측 | 상태 |
|---|---|---|---|
| **A** | fresh → `contact=5`만 → `/home` (profile 완료) | Hero `아직 뚜렷한 특징을 관찰하기엔 정보가 조금 더 필요해.` · 세 축 전부 중립 · '최근 분석' Mirror 카드 요약도 중립 · **시제 어휘 0** | **PASS** |
| **B** | 과거 근거 있는 완료 세션 → `/mirror` | 시제 어휘 0 · 과거 근거 행 2개 **글자 그대로 유지** · `'none'` 축 2개는 새 factual 노트 · DOM에 `경험 후 낮아짐` **0건** / `비교할 관계 근거 없음` 존재 | **PASS** |
| **B** | 같은 세션 → `/home` | Hero 실제 Mirror 요약 유지 · 연락 GAP 칩 유지 · 갈등 declared 기반 유지 | **PASS** |

**console error 0** (양 Journey).

---

## 15. R-9 Closure — Internal State vs Display Name (2026-09-09)

### 15.1 항목 요약

| 항목 | 내용 |
|---|---|
| 출처 | NEW-003 수정 시 **의도적으로 남긴** 잔여 항목(§11 R-9) |
| Priority | **P2** — 정상 경로. 관계 경험을 답하지 않은 사용자 전원이 본다 |
| Root Cause | NEW-003은 시제 **문장**을 닫았지만, 화면에는 상태 **이름 자체**(`CHANGE`)가 찍히는 자리가 5곳 있었다. `CHANGE`라는 단어가 그대로 temporal change claim이다 |
| Fix | 표시 정책 함수 `displayStateOf(state, scope)` 1개 + 시제 술어 1개 적용. **내부 state·저장 데이터 변경 0** |
| Browser | Mirror 행 배지 · Home 최근 분석 카드 · History 스냅샷 배지 · 공유 카드 — console error 0 |
| Automated Regression | `test:trust` TEMP-DISPLAY-01~06 (신규 27건) |
| 상태 | **PASS** |

### 15.2 Invariant

> **내부 state는 언제나 `CHANGE`다. 바뀌는 것은 그것을 부르는 이름뿐이다.**

```text
내부 (변경 금지)          표시 (scope가 정한다)
stateFor()                past     → CHANGE      비교할 두 시점이 있다
MirrorInsight.state       current  → CHANGE      v1.41 비시간 문장 유지 (정책)
History SavedState        none     → UNKNOWN     '관측 정보 부족'
저장된 스냅샷 데이터       (필드 없음) → 그대로     legacy 회귀 0
```

내부 이름을 바꾸면 History Snapshot의 `SavedState`·`STATE_PHRASE`·비교 판정
(`changeStateOf`)이 함께 움직이고 **저장된 기록의 의미가 소급해서 달라진다** —
v1.41이 이름을 유지한 이유가 그것이고, 이번에도 지켰다.

**새 enum을 만들지 않았다.** 돌려주는 값은 이미 있는 `MirrorState` 멤버 `'UNKNOWN'`이고
`STATE_TAG`·`STATE_DOT`·`STATE_TEXT`에 이미 자리가 있다. `STATE_TEXT.UNKNOWN`은
`관측 정보 부족`으로, **`/history/[id]`가 이미 화면에서 쓰는 어휘**다.

### 15.3 Audit — CHANGE state가 사용자 화면에 노출되는 전수

| FILE | SYMBOL | internal state | scope | visible label (before) | temporal claim | 조치 |
|---|---|---|---|---|---|---|
| `mirror/MirrorComparisonRow.tsx` | 행 배지 `{insight.state}` | CHANGE | `none` | **`CHANGE`** | ✅ 있음 | `displayStateOf` → `UNKNOWN` |
| `mirror/MirrorComparisonRow.tsx` | `STATE_DOT` + `ChevronDown` | CHANGE | `none` | **▼ (낮아짐 방향)** | ✅ 있음 | 아이콘 제거(표시 이름 따라감) |
| `app/home/page.tsx` | `최근 Relationship Mirror · {state}` | CHANGE | `none` | **`CHANGE`** | ✅ 있음 | 기존 fallback `'관찰'`로 |
| `app/history/[id]/page.tsx` | 스냅샷 `Tag` | CHANGE | `none` | **`CHANGE`** | ✅ 있음 | `displayStateOf` → `UNKNOWN`·`neutral` tone |
| `app/share/mirror/page.tsx` | 카드 헤드라인 | CHANGE | `none`·`current` | **`달라진 사람이었다.`** | ✅ 있음 | `hasTemporalComparison` 게이트 |
| `mirror/MirrorComparisonRow.tsx` | `stateTextOf` (스크린리더) | CHANGE | `none` | `비교할 관계 근거 없음` | ❌ 없음 | NEW-003에서 이미 처리 |
| `app/mirror/page.tsx` | `차이 N개 / 일치 N개` | CHANGE | 전부 | `차이 4개` | ❌ 없음 — 동시점 '차이'이고 개수다 | **변경 0** |
| `components/history/HistoryChangeRow.tsx` | `HISTORY_STATE_LABEL[SHIFT]` = `변화` | (다른 enum) | – | `변화` | ❌ 없음 — **스냅샷 2건 비교** | **변경 0** |
| `app/first-contact/page.tsx` | `change.state === 'CHANGE' ? '달라짐'` | (다른 enum) | – | `달라짐` | ❌ 없음 — `comparable` 게이트(관찰 2건 이상) | **변경 0** |
| `app/home/page.tsx` | `soloReport.changes` 개수 | (다른 enum) | – | 개수 | ❌ 없음 — 같은 게이트 | **변경 0** |
| `app/history/report/page.tsx` | `CHANGE REPORT` 태그 | – | – | 화면 제목 | ❌ 없음 — 기록 2건 이상에서만 도달 | **변경 0** |
| `components/lens/MbtiBridgeSection.tsx` | `StateChip` | `MbtiBridgeState` | – | – | ❌ 무관한 enum | **변경 0** |

**5개 소비처만 고쳤다.** 정당한 History/Solo 비교 문구(실제 기록 2건 근거)는 손대지 않았고,
TEMP-DISPLAY-02가 정당한 표시가 **살아 있는지**를 적극적으로 검사한다.

### 15.4 재현 — 배지가 같은 행의 근거를 반박했다

`declared` 5축 높음 · 과거 근거 1축(`alone`)만 있는 세션 `/mirror` 실측:

```text
연락  [CHANGE]  ▼                                        ← 배지 + 낮아짐 화살표
      아직 확인 전                                        ← scope 라벨
      이전 관계에서 연락을 특별히 중요한 요소로 꼽지는 않았어  ← 근거
      연락: 말한 나 5점. 비교할 관계 근거 없음.              ← 스크린리더(NEW-003)
      연락을 중요하게 여긴다고 답했어. … 비교는 하지 않을게.   ← 노트(NEW-003)
```

**한 행 안에서 배지·화살표만 반대 방향을 말했다.** NEW-003이 문장을 고친 뒤에는
그 불일치가 오히려 더 선명해졌다.

공유 카드가 가장 나빴다 — 이 표면은 **밖으로 나간다**:

```text
나는 관계를 지나며 / 연락의 기준이 / 달라진 사람이었다.     ← 헤드라인
관계 경험에서는 연락을 특별히 중요한 요소로 꼽지는 않았어    ← 바로 아래 근거
```

> ⚠️ **공유 카드에는 v1.41의 scope 분기가 아예 없었다.** CHANGE면 무조건 저 문장이었다.
> 그래서 이 자리에는 `'current'`용 비시간 표현이 **존재하지 않았고**, 없는 것을 유지할
> 수는 없다. `달라진`은 근거가 `'current'`여도 관찰하지 않은 변화를 주장하므로
> (v1.41 §39.11이 본문 문장을 가른 바로 그 이유) 이 한 자리는 `hasTemporalComparison`
> (= `'past'`만)으로 막았다. **정책의 `'current'` 항목을 규정대로 유지할 수 없는 유일한
> 자리**여서 그렇게 판단했고, 되돌리려면 이 한 줄만 되돌리면 된다.

대체 문구도 새로 만들지 않았다 — `declaredHighlight()`가 이미 쓰는 관형형
(`개인 시간을 중요하게 여기는`)을 그대로 썼다:

```text
나는 / 연락을 중요하게 / 여기는 사람이다.
```

### 15.5 TEMP-DISPLAY-01~06 — 실측

| TC | 기대 | 실측 | 상태 |
|---|---|---|---|
| **TEMP-DISPLAY-01** | CHANGE + none → visible CHANGE/변화 claim 0 | 5축 전부 `displayState: 'UNKNOWN'` · 표시 이름·렌더 문자열에 변화 어휘 **0** | **PASS** |
| **TEMP-DISPLAY-02** | CHANGE + past → legitimate temporal wording 유지 | `CHANGE + past` → `CHANGE` 유지 · 과거 근거 축은 표시 = 판정 | **PASS** |
| **TEMP-DISPLAY-03** | CHANGE + current → v1.41 wording 유지 | 표시 `CHANGE` 유지(정책) · 노트 `지금 관계에서는 …` 유지 · Home 칩 `지금은 크게 드러나지 않음` 유지 | **PASS** |
| **TEMP-DISPLAY-04** | 내부 state / SavedState → CHANGE 유지 | 내부 `state: 'CHANGE'` · 표시만 `UNKNOWN` · 축이 목록에서 빠지지 않음 | **PASS** |
| **TEMP-DISPLAY-05** | legacy 스냅샷 → 회귀 0 | `scope` 필드 없음/`null` 전부 판정 그대로 · `test:history` 100건 불변 | **PASS** |
| **TEMP-DISPLAY-06** | 표시 정책 배선 (정적) | 5개 소비처 통과 · 내부 state를 배지에 직접 찍는 코드 **0** · 새 enum **0** | **PASS** |

**Browser 실측:** Mirror 행 배지 `UNKNOWN`·화살표 없음 · Home `최근 Relationship Mirror ·
관찰 · 연락` · History 스냅샷 `UNKNOWN`(저장 데이터는 `CHANGE` 그대로) · 공유 카드
`나는 / 연락을 중요하게 / 여기는 사람이다.` · **console error 0**.

### 15.6 함께 발견한 것 — AI 생성 headline (범위 밖 · 미수정)

R-9를 검증하던 중 **표시 라벨이 아닌** 경로에서 같은 위반을 실측했다.

`/mirror`의 Core headline 우선순위는 `coreCorrection || aiHeadline || mirror.core.headline`
이다(`mirror/page.tsx:220`). 즉 **AI가 성공하면 NEW-003이 고친 결정론 headline은 가려진다.**
실측된 저장 기록:

```json
{ "original": "연락의 중요성이 가장 두드러진 변화로 보여",
  "aiMeta": { "mode": "real", "promptVersion": "relationship-v7-evidence" } }
```

focus 축은 `contact`(`state: CHANGE` · `scope: 'none'`)였다. **모델이 비교 근거가 없는
축에 대해 `변화`를 썼고, 그 문장이 History에 저장되고 `/home`의 RELATIONSHIP HISTORY
카드에 미리보기로 다시 나온다.**

| 항목 | 내용 |
|---|---|
| 왜 이번에 고치지 않았나 | 이 배치는 **display policy 전용**이고 "새 기능/계산 변경 금지"다. 프롬프트·안전 스캐너 수정은 **AI contract 변경**이라 범위 밖이다 |
| 범위 안에 있는 대안 | `mirror/page.tsx:220`에서 **focus 축에 비교 근거가 없으면 `aiHeadline`을 쓰지 않는다**(결정론 headline으로 폴백). 프롬프트·스캐너·지문·promptVersion을 건드리지 않는 표시 선택 변경이다. 다만 저장되는 `coreInsightOriginal`이 함께 달라지므로 **한 줄이지만 display를 넘는다** — 판단이 필요하다 |
| 근본 해결 | `TENSE_CONTRACT`/`scanRelationshipTense`에 '비교 근거 없는 축에 변화 어휘 금지'를 추가 → promptVersion 상향. **별도 배치** |

⚠️ 이것은 억지로 만든 리스크가 아니라 **실측된 사용자-visible 위반**이다. R-9는 닫혔지만
같은 원칙의 위반이 AI 경로에 남아 있으므로, Release 판단에 함께 올린다 → §11 **R-11**.

---

## 16. R-11 Closure — AI Headline Consumption Gate (2026-09-09)

### 16.1 항목 요약

| 항목 | 내용 |
|---|---|
| 출처 | R-9 Closure 검증 중 실측(§15.6) |
| Priority | **P2** — 정상 경로. AI가 성공한 화면 전부 |
| Root Cause | `/mirror`의 headline 우선순위가 `coreCorrection \|\| aiHeadline \|\| core.headline`이라 **AI가 성공하면 NEW-003이 고친 결정론 headline이 가려진다** |
| Fix | `canUseAiHeadline(focus)` 소비 게이트 1개 — 시간 비교 근거 없는 `CHANGE` focus면 AI 문장을 쓰지 않고 결정론 headline으로 폴백 |
| Browser | real AI 응답이 있는 상태에서 화면·History 저장·`/home` 재노출 3단 실측 · console error 0 |
| Automated Regression | `test:trust` TEMP-AI-01~06 (신규 21건) |
| 상태 | **PASS** |

### 16.2 정책

> **AI_OUTPUT은 deterministic evidence boundary를 넘을 수 없다.**

v1.27이 세운 `AI_OUTPUT ⊆ DETERMINISTIC_EVIDENCE`는 '모델이 지목한 근거가 실재하는가'를
검사했고, 그 검사는 이 memo에 **이미 있었다**(`evidenceRefs`가 하나도 resolve되지 않으면
문장을 버린다). R-11이 드러낸 것은 **그 경계에 시제 축이 빠져 있었다**는 것이다:

> 근거를 정확히 지목해도, **그 근거로 시간적 변화를 주장할 수 없으면** 그 문장은 경계 밖이다.

### 16.3 무엇을 바꾸고 무엇을 안 바꿨는가

| 항목 | 변경 |
|---|---|
| AI 요청 (`useRelationshipNarrative`) | **0** — 조건부로 만들지 않았다 |
| 프롬프트 · `promptVersion` | **0** — `relationship-v7-evidence` 그대로 |
| 안전 스캐너 (`scanRelationshipTense` 등) | **0** |
| AI 캐시 · 지문 | **0** |
| 내부 `CHANGE` state · `SavedState` | **0** |
| 기존 `evidenceRefs` 경계 검사 | **0** — 그대로 남아 있고, 그 뒤에 시제 검사가 붙는다 |
| headline 우선순위 | **0** — `coreCorrection`이 여전히 첫 번째 |
| **소비 여부** | ← 이것만 바뀐다 |

**모델은 계속 같은 요청을 받고 같은 답을 만든다.** 바뀌는 것은 **소비자가 그 답을
쓸지**뿐이다 — v1.44 BUG-003이 `meta` 계약 위반에 대해 내린 것과 같은 종류의 판단이다.

`test:ai` 508과 `test:ai:e2e` 6/6이 불변인 것이 **AI 계약 무영향의 증거**다.

### 16.4 게이트를 한 곳에 둔 이유

`aiHeadline` **memo 안**에 두었다. 그 변수 하나를 세 곳이 읽기 때문이다:

```text
headline               = coreCorrection || aiHeadline || core.headline   ← 화면
coreInsightOriginal    = aiHeadline ?? core.headline                     ← History 저장
coreInsightAiMeta      = aiHeadline && aiMeta ? {...} : undefined        ← 저장 메타
```

게이트를 렌더 자리에만 두면 **화면은 안전한데 기록에는 unsafe 문장이 남는다.** 한 지점에
두면 그 갈림이 구조적으로 불가능하다. `coreInsightAiMeta`가 같은 변수에 매여 있으므로
**headline 없이 AI meta만 남는 상태**도 생기지 않는다.

순수 술어는 `canUseAiHeadline()`으로 `logic/mirror.ts`에 뺐다 — `'use client'` memo 안에만
있으면 fixture가 그 분기를 호출할 수 없다(BUG-003에서 `aiModeOf`를 옮긴 것과 같은 이유).

```ts
canUseAiHeadline(focus) = !focus || focus.state !== 'CHANGE' || hasTemporalComparison(focus.evidenceScope)
```

⚠️ **`MATCH`·`GAP`은 상태만으로 통과시킨다.** 그 판정의 문장은 시제를 주장하지 않으므로
시간 비교 근거를 요구할 이유가 없다 — 게이트를 상태와 무관하게 걸면 **기능 삭제**가 된다.

⚠️ **`'current'`도 막힌다.** `hasTemporalComparison`이 참인 scope는 `'past'`뿐이고,
프롬프트가 CHANGE를 `경험에서는 우선순위가 옮겨감`으로 정의해 **모델을 시제 해석으로
유도**한다 — v1.41 §39.11이 `'current'`에 대해 결정론 문장을 가른 것과 같은 이유다.

### 16.5 확인 항목 6개 — 실측

`declared` 5축 높음 · 과거 근거 `alone`만 → focus 축 `contact`(`CHANGE`·`scope 'none'`),
`AI_MODE=real` 응답 존재 상태에서 측정.

| # | 확인 | 실측 | 상태 |
|---|---|---|---|
| 1 | CHANGE + none → aiHeadline 미사용 · temporal claim 0 | Core 카드가 결정론 문장 `너는 연락을 중요하게 여긴다고 답했어. 그게 관계에서 어떻게 나타나는지는 아직 비교할 근거가 없어.`를 렌더. **before: `연락의 중요성이 가장 두드러진 변화로 보여`**(`mode: real`) | **PASS** |
| 2 | CHANGE + valid temporal evidence → 사용 가능 | `CHANGE × past`는 술어가 통과시킨다(도달 불가 경로라 술어를 직접 고정 · TEMP-AI-02) | **PASS** |
| 3 | 일반 MATCH/GAP → 회귀 없음 | GAP focus 세션 실측: headline이 **AI 문장** `연락에 대한 인식의 차이가 보이는 관계` — 결정론 문장이 아니다. `scope 'current'`의 GAP도 통과 | **PASS** |
| 4 | coreCorrection 최우선 | 우선순위 코드 무변경(정적) + `homeHeroSummary` 우선순위 유지 | **PASS** |
| 5 | History 저장 | `coreInsight.original` = 결정론 문장 · **`aiMeta` 키 자체가 없다**(게이트로 `undefined`) · 스냅샷 내부 state `contact:CHANGE:none` 그대로 | **PASS** |
| 6 | `/home` 재노출 | RELATIONSHIP HISTORY 카드 미리보기가 결정론 문장 · 최근 분석 카드 `최근 Relationship Mirror · 관찰 · 연락` · 시제 어휘·`CHANGE` **전수 0** | **PASS** |

**console error 0.**

### 16.6 함께 실측한 것 — 축별 AI narrative (범위 밖 · 미수정)

R-11의 대상은 **Core headline(`aiHeadline`)** 이었다. 같은 화면에서 축 행의 보조 서술
(`러비가 이렇게 봤어` = `narrative.data.narratives`)에는 시제 어휘가 남아 있다.
`scope 'none'` 행 실측:

```text
연락  [UNKNOWN]  아직 확인 전
      연락을 중요하게 여긴다고 답했어. … 비교는 하지 않을게.        ← 결정론(NEW-003) ✅
      러비가 이렇게 봤어
      연락을 중요하게 생각한다고 했지만, 이전 관계에서는 …
      이 부분에서 변화가 있을 수 있어.                              ← AI ❌
      연락의 중요성에 대한 인식 변화가 있을 수 있어.                ← AI ❌
```

| 항목 | 내용 |
|---|---|
| 왜 이번에 고치지 않았나 | R-11의 지정 범위는 `aiHeadline` 한 소비처였고, 이번 배치는 "다른 리스크 탐색/기능 변경 금지"였다 |
| 닫는 방법 | **같은 방식이다** — 축 narrative를 소비하는 자리에서 `canUseAiHeadline`과 같은 술어로 걸러낸다. 프롬프트·스캐너·캐시 무관 |
| 성질 | Core 결론이 아니라 **행의 보조 서술**이다. 같은 행의 결정론 노트가 이미 `비교는 하지 않을게`라고 말하고 있어 **한 행 안에서 두 문장이 어긋난다** — R-9가 배지에서 닫은 것과 같은 형태의 불일치 |

→ **R-12**로 기록했다. 억지로 만든 리스크가 아니라 R-11 검증 과정에서 실측된 것이고,
지정 범위 밖이라 손대지 않았다.

---

## 17. R-12 Closure — Axis AI Narrative Gate (2026-09-09 · Final Release Closure)

### 17.1 항목 요약

| 항목 | 내용 |
|---|---|
| 출처 | R-11 Closure 검증 중 실측(§16.6) |
| Priority | **P2** — 정상 경로. AI가 성공한 화면 전부 |
| Root Cause | R-9(배지)·R-11(Core headline)을 닫은 뒤에도 **같은 행의 축별 AI 서술**이 시제 주장을 만들었다. 검증 중 **Core AI 서술 본문**(`core.summary`)도 R-11의 headline 게이트를 우회하는 것을 실측 |
| Fix | `canUseAiAxisNarrative(insight)` 소비 게이트 — 축 서술 렌더 자리 + Core 서술 본문 2곳. **결정론 노트는 그대로 유지** |
| Browser | 재현 세션에서 UNKNOWN 배지 · 결정론 노트 유지 · unsafe 서술 0 · console error 0 |
| Automated Regression | `test:trust` TEMP-AI-AXIS-01~06 (신규 22건) |
| 상태 | **PASS** |

### 17.2 재현 — 한 행이 스스로를 반박했다

```text
연락  [UNKNOWN]  아직 확인 전                                  ← R-9가 닫았다
      이전 관계에서 연락을 특별히 중요한 요소로 꼽지는 않았어      ← 결정론 근거
      연락: 말한 나 5점. 비교할 관계 근거 없음.                  ← 결정론 a11y (NEW-003)
      연락을 중요하게 여긴다고 답했어. … 비교는 하지 않을게.       ← 결정론 노트 (NEW-003)
      러비가 이렇게 봤어
      이 부분에서 변화가 있을 수 있어.                           ← ❌ AI 축 서술
      연락의 중요성에 대한 인식 변화가 있을 수 있어.              ← ❌
```

결정론 층 네 줄이 '비교하지 않는다'고 말하는데 AI 한 줄이 변화가 있을 수 있다고 말했다.
**R-9가 배지에서 닫은 것과 같은 형태의 불일치**다.

#### 함께 실측한 두 번째 자리 — Core 서술 본문

축 서술을 막은 뒤 브라우저 확인에서 Core 카드에 시제 문장이 **하나 남았다**:

```text
러비가 이렇게 봤어
연락에 대한 중요성이 이전 관계와 비교해 변화한 것으로 나타나.
```

R-11은 `aiHeadline`(= `core.headline`)을 닫았지만, `CoreInsightNarrativeView`가 렌더하는
것은 **같은 객체의 다른 필드**(`core.summary`)이고 게이트를 받지 않았다 — R-11의 미완이다.
R-12의 브라우저 수용 기준(`'러비가 이렇게 봤어' unsafe narrative 0`)이 이 자리를 잡아냈고,
같은 게이트로 함께 닫았다.

### 17.3 정책 — 규칙은 하나다

> **TEMPORAL CHANGE CLAIM → TEMPORAL COMPARISON EVIDENCE REQUIRED**
> **AI_OUTPUT ⊆ DETERMINISTIC_EVIDENCE**

```ts
aiMayClaimChange(insight) = !insight || insight.state !== 'CHANGE' || hasTemporalComparison(insight.evidenceScope)

canUseAiHeadline(focus)        → aiMayClaimChange(focus)      // R-11
canUseAiAxisNarrative(insight) → aiMayClaimChange(insight)    // R-12
```

**두 게이트가 술어 하나에 위임한다.** 조건을 두 곳에 적으면 언젠가 한쪽만 고쳐지고,
그때 같은 화면이 두 기준으로 판단한다 — v1.44가 반복해서 만난 실패 형태다(NEW-002의 세 축
중 하나, NEW-003의 scope 하나, R-9의 배지 하나, R-11의 `summary` 하나).

### 17.4 범위 — 금지 항목 전부 변경 0

| 항목 | 변경 |
|---|---|
| AI request · prompt · promptVersion · scanner · cache/fingerprint | **0** |
| internal `CHANGE` state · `displayStateOf()` | **0** |
| `SavedState` / History schema | **0** |
| **deterministic note** | **0** — 지우는 것은 AI 문장뿐이다 |
| `MATCH`/`GAP` AI narrative | **0** |
| `CHANGE` + valid past evidence narrative | **0** |

`test:ai` 508 · `test:ai:e2e` 6/6 불변이 **AI 계약 무영향의 증거**다.

### 17.5 소비처 확인 (요구 4)

| 소비처 | 대상 | 조치 |
|---|---|---|
| `mirror/page.tsx` → `MirrorAxisNarrative` | Mirror 축 행 `러비가 이렇게 봤어` | **게이트 적용** |
| `mirror/page.tsx` → `CoreInsightNarrativeView` | Core 서술 본문(`core.summary`) | **게이트 적용** (검증 중 발견) |
| `mirror/teaser/page.tsx` → `useRelationshipNarrative()` | **호출만 하고 렌더 0** — 주석에 명시(`§88-6`) | 불필요 |
| `compatibility/page.tsx` · `history/report/page.tsx` · `premium-preview` | **다른 AI Task**(`compatibility-narrative`·`history-insight`·`deep-report-narrative`)의 서술이고 축 타입도 다르다 | 대상 아님 |

`MirrorAxisNarrative`의 소비처는 `mirror/page.tsx` **한 곳**이다(전수 grep).

### 17.6 TEMP-AI-AXIS-01~06 — 실측

| TC | 기대 | 실측 | 상태 |
|---|---|---|---|
| **01** | CHANGE + none → AI 축 서술 0 · 결정론 노트 유지 | 5축 전부 `canUseAiAxisNarrative: false` · 노트 `비교는 하지 않을게` **유지** · 배지 `UNKNOWN` 유지 | **PASS** |
| **02** | CHANGE + current → 서술 0 | `canUseAiAxisNarrative: false` · v1.41 결정론 노트 유지 | **PASS** |
| **03** | CHANGE + valid past → 사용 가능 | 술어가 통과시킨다(도달 불가 경로라 직접 고정) | **PASS** |
| **04** | MATCH → 유지 | `past`·`current` 양쪽 `true` | **PASS** |
| **05** | GAP → 유지 | `past`·`current` 양쪽 `true` | **PASS** |
| **06** | R-11 Core headline 게이트 유지 | 동작 유지 · 두 게이트가 같은 술어에 위임 · 결정론 노트가 게이트 밖 · 프롬프트 버전 불변 (정적) | **PASS** |

**Browser (재현 세션 · `AI_MODE=real`):**

| 확인 | 실측 |
|---|---|
| UNKNOWN badge | 4개 `scope 'none'` 축 전부 |
| deterministic neutral note | 모든 행에서 유지 |
| `러비가 이렇게 봤어` unsafe narrative | **0** — 남은 1건은 `개인 시간`(MATCH·past)의 정당한 서술 |
| Core 카드 | 결정론 headline + 결정론 근거 목록 |
| 시제 어휘 전수 (10종) | **0** |
| `CHANGE` 배지 | **0** |
| console error | **0** |

### 17.7 CC7 assertion 갱신 (기존 fixture 1건)

`test:relationship-evidence`의 CC7이 한 번 실패했다. v1.43이 그 검사를 **리터럴**
`core={narrative.data?.core}`로 고정했는데, R-12가 그 자리에 게이트를 붙이면서 리터럴이
깨졌다.

**불변식은 유지된다** — `narrative.data.core`를 렌더 컴포넌트로 넘기는 자리는 여전히
한 곳이다. 그래서 패턴을 `core={…narrative.data?.core…}`로 넓혀 **게이트 래퍼를
허용**했다. 건수는 **280 그대로**이고, 게이트 자체는 `test:trust` TEMP-AI-AXIS-06이
별도로 고정한다.

⚠️ 리터럴을 지키려고 게이트를 되돌리는 것은 순서가 거꾸로다 — 검사는 불변식을 지켜야 하고,
불변식은 '한 지점에서만 넘긴다'이지 '문자열이 이 모양이다'가 아니다.
