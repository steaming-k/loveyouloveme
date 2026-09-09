# 럽유럽미 v1.43 QA Report

> 이 문서는 **QA 실행 기록**이다. 기능명세(`기능명세_현행.md` · `기능명세서.md`)나
> 기획서를 대체하거나 수정하지 않는다. 이번 QA에서는 **코드를 한 줄도 수정하지 않았고**,
> commit / push도 하지 않았다. 발견된 문제는 고치지 않고 재현 조건·원인 추정·수정 권장
> 범위만 기록했다.

---

## 1. QA 개요

| 항목 | 내용 |
|---|---|
| 제품 | 럽유럽미 (Love U Love Me) |
| 버전 | v1.43 |
| QA 일자 | 2026-09-09 |
| 기준 Commit | `52f5601` (= `origin/main`, working tree clean, divergence 0/0) · 구현 커밋 `f56c5f2` |
| Production | https://loveyouloveme.vercel.app |
| QA 환경 | Chromium (Claude Code Browser pane) / Windows 11 / Node v22.15.0 · viewport 360·375·393·430·768·1280 · **LOCAL(dev `localhost:3000`) + PRODUCTION 분리 기록** |
| QA 목적 | Core Flow · Lifecycle Safety · AI Contract(Evidence/Tense/Question) · Cache · Regression · Production Guard 검증 |
| 테스트 범위 | 자동 테스트 6종 전량 · Browser Journey 6종 · 관계 상태 6종 전수 · 반응형 6해상도 · 접근성 기본 · AI 실패/파싱실패/빈상태/손상세션 · Production Guard/Privacy |
| 제외 범위 | 실제 사진 업로드 및 Vision 콘텐츠 인식 품질 · Observed Me 화면(S09) · Adaptive Follow-up(S16a) · History 삭제/개별 항목 상세 · Share 화면 · Lens 상세(MBTI/사주/별자리) · Onboarding(S02) · 키보드 포커스 트랩 정밀 검증 · 실제 PG 결제(미구현) · 크로스 브라우저(Safari/Firefox) · WCAG 정식 감사 |
| 최종 판정 | **PASS** (P0 = 0 · P1 = 0 · Core Flow blocker = 0) |

### 1.1 배포 동일성 근거

프로덕션이 실제로 이 커밋에서 빌드됐는지를 두 가지로 교차 검증했다.

1. **번들 바이트 일치** — HEAD(`52f5601`)에서 `npm run build`한 공유 청크가 프로덕션이 서빙하는 파일과 SHA-256 기준 완전 동일.
   - `chunks/1255-fc6c00ab2f765339.js` → local `e21be50b85d04ad3` = prod `e21be50b85d04ad3`
   - `chunks/4bd1b696-f785427dddbba9fb.js` → local `51a7146e32f6a18a` = prod `51a7146e32f6a18a`
   - (`webpack-*`, `main-app-*`는 빌드 메타데이터를 품으므로 해시가 다른 것이 정상이다.)
2. **v1.43 promptVersion marker 4종** — 실제 Production endpoint 응답 `meta.promptVersion`에서 확인(§7 참고).

---

## 2. 상태 · 우선순위 정의

상태: `PASS` / `FAIL` / `BLOCKED` / `NOT TESTED` / `NOT APPLICABLE` (빈칸 없음)
우선순위: `P0` Critical / `P1` High / `P2` Medium / `P3` Low / PASS는 `-`

---

## 3. 자동 테스트 결과

| 항목 | 명령 | Baseline | 실측 | 결과 | 비고 |
|---|---|---:|---:|---|---|
| Typecheck | `npx tsc --noEmit` | – | exit 0 | PASS | 에러 0 |
| Lint | `npx eslint src tests --ext .ts,.tsx,.mjs` | – | exit 0 | PASS | `npm run lint`는 이 환경의 SWC DLL 문제로 exit code가 부정확 — 직접 실행함 |
| AI Contract | `npm run test:ai` | 508 | **508** | PASS | 변동 0 |
| Observed E2E | `npm run test:observed` | 10 | **10** | PASS | 변동 0 |
| History Fixtures | `npm run test:history` | 100 | **100** | PASS | 변동 0 |
| Lifecycle Fixtures | `npm run test:lifecycle` | 144 | **144** | PASS | 변동 0 |
| Relationship Evidence | `npm run test:relationship-evidence` | 280 | **280** | PASS | 변동 0 |
| Real Provider E2E | `npm run test:ai:e2e` | 6/6 | **6/6** | PASS | PASS 6 · SKIPPED 0 · FAIL 0 |
| Production Build | `npm run build` | – | 성공 | PASS | 전 라우트 프리렌더 정상 |

**증감 분석:** 6종 스위트 전부 baseline과 정확히 일치. 증가·감소·실패 없음.

Provider E2E 실측 로그(요약):

```
observed-profile          mode real · observed-v2-photo         · evidence-less 0
relationship-insight (A)  mode real · relationship-v7-evidence  · tense current · outwardQ on  · tense-leak 0 · questions 1
relationship-insight (B)  mode real · relationship-v7-evidence  · tense former  · outwardQ off · tense-leak 0 · questions 0
compatibility-narrative   mode real · compatibility-v4-tense    · tense former  · outwardQ off · questions 0 · score-leak false
history-insight           mode real · history-v3-axis           · history-ref 1
deep-report-narrative     mode real · deep-report-v4-tense      · evidence-subset-ok true
```

> ⚠️ 위 스위트 6종은 전부 **dev 서버(:3000)가 떠 있어야** 동작한다(`contract-test`·`dev/*` 라우트 사용).
> 서버 없이 실행하면 전부 `ECONNREFUSED`로 실패한다 — 실패로 오인하기 쉬우니 기록해 둔다.

---

## 4. QA 체크리스트

| ID | 영역 | 체크 항목 | 확인 기준 | 결과 | 우선순위 | 비고 |
|---|---|---|---|---|---|---|
| QA-CHK-001 | A Home/Nav | 최초 진입 | `/` 200, 스플래시 렌더 | PASS | - | LOCAL·PROD 모두 |
| QA-CHK-002 | A Home/Nav | Core 라우트 응답 | 11개 라우트 200 | PASS | - | `/ /home /status /mirror /compatibility /privacy /history /target /premium /first-contact /lens` |
| QA-CHK-003 | A Home/Nav | 잘못된 route | 404 | PASS | - | `/nonexistent-xyz` → 404 |
| QA-CHK-004 | A Home/Nav | 브라우저 back/forward | 이력 정상, 세션 유지 | PASS | - | back→`/compatibility`, forward→`/first-contact`, 세션 intact |
| QA-CHK-005 | A Home/Nav | 새로고침 | 세션 복원 | PASS | - | Core Correction 상태까지 복원 |
| QA-CHK-006 | A Home/Nav | 새 사람과 궁합 보기 | reset 매트릭스 정확 | PASS | - | TC TRANS-003 |
| QA-CHK-007 | B Status | 6개 상태 렌더/선택/저장 | 라디오 6개, 저장 반영 | PASS | - | solo_none·solo_exp·crush·dating·married·ended |
| QA-CHK-008 | B Status | Lifecycle Job 결정 | 상태별 섹션 타이틀/질문 정책 분기 | PASS | - | TC LIFE-001~006 |
| QA-CHK-009 | B Status | 상태 변경 시 기존 데이터 | 무단 삭제 없음 | PASS | - | dating→ended에서 전 항목 유지 |
| QA-CHK-010 | C Photo | 사진 0장 Core Flow | 끝까지 진행 가능 | PASS | - | TC PHOTO-001 |
| QA-CHK-011 | C Photo | 사진 없이 시작 안내 | 정직한 한계 고지 | PASS | - | "사진에서 나오는 관찰 한 가지만 빠져" |
| QA-CHK-012 | C Photo | 전송/보관 고지 | 서버 전송·미저장 명시 | PASS | - | 화면 하단 고지 2곳 |
| QA-CHK-013 | C Photo | demo/sample 혼동 | demo 문구 미노출 | PASS | - | `test:observed` 10건 + PROD 스캔 0건 |
| QA-CHK-014 | C Photo | 실제 업로드/Vision 품질 | – | NOT TESTED | - | 실사진 미사용(프라이버시) — 범위 제외 |
| QA-CHK-015 | D Declared | 5개 필드 입력/저장 | 값 정확 저장 | PASS | - | `{contact:4,conflict:'now',alone:2,affection:'a2',hobby:'h2'}` |
| QA-CHK-016 | D Declared | 값 변경 후 재계산 | 결과 반영 | PASS | - | contact 4→2에서 MATCH→GAP, 점수 87→67 |
| QA-CHK-017 | D Declared | MBTI Optional | 점수 미반영 명시 | PASS | - | "점수에는 넣지 않지만" 문구 + AI payload에 MBTI 없음 |
| QA-CHK-018 | E Past | S15 최대 4개 | 5번째 거부 | PASS | - | BUG-004(피드백 부재)는 별건 |
| QA-CHK-019 | E Past | S16 hardest 4종 | 선택/저장 | PASS | - | `contact_drop` 실측 |
| QA-CHK-020 | E Past | S17 selfGap 3종 | 선택/저장 | PASS | - | `some` 실측 |
| QA-CHK-021 | E Past | 자유서술 Optional | 미입력 시 확신도 하향 고지 | PASS | - | "안 적어도 괜찮아. 대신 내 관찰의 확신은 조금 낮아져" |
| QA-CHK-022 | E Past | Adaptive Follow-up | – | NOT TESTED | - | 이번 입력 조합에서 미발동 |
| QA-CHK-023 | F Current(S30) | Optional·Core Flow 미차단 | 미입력에도 전 화면 동작 | PASS | - | TC CURR-001 |
| QA-CHK-024 | F Current(S30) | 부분 입력 → mixed scope | 축 단위 scope 전환 | PASS | - | TC CURR-003 |
| QA-CHK-025 | F Current(S30) | 답 지우기 | 키 자체 제거 | PASS | - | `signals:{}`, `askedAt` 유지 |
| QA-CHK-026 | F Current(S30) | 점수 미반영 고지 | 명시 | PASS | - | "이 답은 동기화율에 들어가지 않아" |
| QA-CHK-027 | G Target | relation/4축/MBTI/관심사 | 입력·저장 | PASS | - | relation·contact·conflict·alone 실측 |
| QA-CHK-028 | G Target | 모름(x) 처리 | 점수 제외 + 명시 | PASS | - | "모름은 점수에서 제외돼" |
| QA-CHK-029 | H Compatibility | comparedCount 0/2 → null | `?` 표시 | PASS | - | TC COMP-001·002 |
| QA-CHK-030 | H Compatibility | comparedCount 3/4 → 점수 | 정상 범위 | PASS | - | 87 / 67 실측 |
| QA-CHK-031 | H Compatibility | 성공확률 표현 금지 | 금지어 0 | PASS | - | 유일 매치는 부인 문구 "연애 성공확률이 아니야" |
| QA-CHK-032 | H Compatibility | 제외 축 고지 | 어떤 축이 빠졌는지 명시 | PASS | - | "모름으로 남긴 1개(애정 표현)는 계산에서 빼뒀어" |
| QA-CHK-033 | I Mirror | MATCH/GAP 상태 | 규칙 판정 렌더 | PASS | - | MATCH·GAP 실측 (CHANGE/UNKNOWN은 fixture 커버) |
| QA-CHK-034 | I Mirror | scope current/past/mixed | 축별 근거 시점 칩 | PASS | - | TC MIRROR-002·003 |
| QA-CHK-035 | I Mirror | Core Insight + 근거 | 근거 번호 목록 | PASS | - | 01·02 렌더 |
| QA-CHK-036 | I Mirror | AI fallback | AI 없어도 결과 유지 | PASS | - | TC ERR-003·004 |
| QA-CHK-037 | J Core Correction | 수정 > AI | 사용자 문장 우선 | PASS | - | TC CORE-002 |
| QA-CHK-038 | J Core Correction | 근거·섹션 유지 | evidence 그대로 | PASS | - | 01·02 유지 |
| QA-CHK-039 | J Core Correction | 되돌리기 | AI 요약 복원 | PASS | - | TC CORE-005 |
| QA-CHK-040 | J Core Correction | '맞는 것 같아' 일관성 | verdict와 화면 일치 | **FAIL** | **P2** | **BUG-001** |
| QA-CHK-041 | K History | snapshot 저장 | 메타 포함 저장 | PASS | - | `evidenceScope`·`promptVersion` 포함 |
| QA-CHK-042 | K History | 2개 비교 리포트 | SHIFT/STABLE/INSUFFICIENT | PASS | - | TC HIST-003 |
| QA-CHK-043 | K History | CRM화 방지 | 사람이 아닌 '내 기준' 비교 | PASS | - | 상대 식별정보 없음, `targetRelation` 범주만 |
| QA-CHK-044 | K History | 삭제 | – | NOT TESTED | - | 범위 제외 |
| QA-CHK-045 | L Premium | Fake Door 정직성(PROD) | 결제 오인 0 | PASS | - | TC PREM-002 |
| QA-CHK-046 | L Premium | Preview 게이트(PROD) | 비활성 | PASS | - | 3개 경로 전부 차단 |
| QA-CHK-047 | L Premium | Deep Report 시제 | former 누수 0 | PASS | - | TC PREM-003 |
| QA-CHK-048 | M Lifecycle | 6개 상태 copy/action/tense | 상태별 분기 | PASS | - | TC LIFE-001~006 |
| QA-CHK-049 | N Transition | dating→ended 유지 | 데이터 보존 | PASS | - | TC TRANS-001 |
| QA-CHK-050 | N Transition | New Target reset 매트릭스 | 유지/초기화 정확 | PASS | - | TC TRANS-003 |
| QA-CHK-051 | O AI | 5 Task promptVersion | v1.43 marker | PASS | - | TC AI-001~005 |
| QA-CHK-052 | O AI | provider error/parse fail | deterministic 유지 | PASS | - | TC ERR-003·004 |
| QA-CHK-053 | P Evidence | 축별 허용집합 | 축 단위 제한 | PASS | - | 실제 payload 캡처 |
| QA-CHK-054 | P Evidence | 비축 ref 거부 | value_gap·selfGap·cross-dim 거부 | PASS | - | `test:ai` R1~R7 + payload 검증 |
| QA-CHK-055 | Q Safety | former 금지 표현 | 6종 0건 | PASS | - | LOCAL·PROD 모두 0 |
| QA-CHK-056 | Q Safety | ended outward question 0 | AI·결정론 모두 0 | PASS | - | TC SAFE-001·002 |
| QA-CHK-057 | Q Safety | dating/married question 유지 | 정상 노출 | PASS | - | detQ 3 · aiQ 있음 |
| QA-CHK-058 | R Cache | 동일 입력 재사용 | 요청 증가 없음 | PASS | - | TC CACHE-001 |
| QA-CHK-059 | R Cache | tense/allowsOutward 변경 | miss | PASS | - | TC CACHE-002 |
| QA-CHK-060 | R Cache | S30 변경 | miss | PASS | - | TC CACHE-004 |
| QA-CHK-061 | R Cache | promptVersion 포함 | 키에 포함 | PASS | - | 정적 검증 (`aiClient.ts:116`) |
| QA-CHK-062 | S Error | 빈 localStorage | 안내 화면 | PASS | - | TC ERR-001 |
| QA-CHK-063 | S Error | 손상 세션 | 크래시 없음 | PASS | - | 단, 값 검증 없음 → BUG-002 |
| QA-CHK-064 | S Error | API 500 / parse fail | deterministic 유지 | PASS | - | TC ERR-003·004 |
| QA-CHK-065 | T Responsive | 6해상도 가로 overflow | 0 | PASS | - | 360·375·393·430·768·1280 전부 `scrollWidth == clientWidth` |
| QA-CHK-066 | T Responsive | 터치 타깃 | ≥40px | PASS | - | 전 화면 위반 0 |
| QA-CHK-067 | U A11y | 입력 라벨 | 100% | PASS | - | 미라벨 입력 0 |
| QA-CHK-068 | U A11y | heading 위계 | h1 1개, skip 0 | PASS | - | 4개 화면 검사 |
| QA-CHK-069 | U A11y | 버튼 접근명 / img alt / clickable div | 위반 0 | PASS | - | 4개 화면 검사 |
| QA-CHK-070 | U A11y | 키보드 포커스 트랩 | – | NOT TESTED | - | 범위 제외 |
| QA-CHK-071 | V Prod Guard | dev route POST | 404 | PASS | - | 3개 경로 |
| QA-CHK-072 | V Prod Guard | AI Debug Panel | 미노출 | PASS | - | 번들에 문자열 자체 없음(tree-shake) |
| QA-CHK-073 | V Prod Guard | PrototypePanel/화면인덱스 | 미노출 | PASS | - | `NOW SHOWING` 0, `S01~` 링크 0 |
| QA-CHK-074 | V Prod Guard | Premium Preview | 비활성 | PASS | - | 3개 경로 게이트 |
| QA-CHK-075 | V Prod Guard | UT Mode | 미노출 | PASS | - | UT 블록 0 (LOCAL은 노출 — 의도된 차이) |
| QA-CHK-076 | V Prod Guard | demo 문구 | 미노출 | PASS | - | 4종 문구 0건 |
| QA-CHK-077 | W Privacy | API key/시크릿 | 번들 노출 0 | PASS | - | `sk-*`·`AI_API_KEY`·`api.openai.com`·`Bearer` 0건 |
| QA-CHK-078 | W Privacy | raw status/job/stage | AI 미전송 | PASS | - | 실제 payload 캡처로 확인 |
| QA-CHK-079 | W Privacy | 사진 base64 저장 | 미저장 | PASS | - | `serialize()`가 `{id,label,source,tone}`만 저장 |
| QA-CHK-080 | W Privacy | History 원문/사진 | 미저장 | PASS | - | snapshot에 note·photo 필드 없음 |
| QA-CHK-081 | W Privacy | Analytics 자유서술/답변원본 | 외부 전송 차단 | PASS | - | `EXTERNAL_FORBIDDEN_KEYS`가 6개 키 차단 |
| QA-CHK-082 | W Privacy | System Prompt 클라이언트 노출 | 0 | PASS | - | 번들에 프롬프트 본문 없음 |
| QA-CHK-083 | S Error | 콘솔 에러 (PROD) | 0 | PASS | - | 전 여정 0건 |
| QA-CHK-084 | S Error | 콘솔 에러 (LOCAL) | – | **FAIL** | **P3** | **BUG-003** (합성 오류 응답 조건) |

---

## 5. 테스트케이스

### 5.1 Home / Navigation

| TC ID | 기능/화면 | 테스트 목적 | 사전조건 | 입력값 | 실행 절차 | 예상 결과 | 실제 결과 | 상태 | 우선순위 | 비고/근거 |
|---|---|---|---|---|---|---|---|---|---|---|
| HOME-001 | `/` 스플래시 | 최초 진입 | localStorage 완전 비움 | – | 1. `/` 접속 | 200, 스플래시 렌더 | LOCAL·PROD 모두 HTTP 200, 스플래시 렌더 | PASS | - | curl + 브라우저 |
| HOME-002 | 라우트 가드 | 존재하지 않는 경로 | – | `/nonexistent-xyz` | 1. 접속 | 404 | HTTP 404 | PASS | - | PROD |
| HOME-003 | Core 라우트 | 주요 라우트 가용성 | – | 11개 경로 | 1. 각 경로 GET | 전부 200 | 11/11 = 200 | PASS | - | PROD |
| HOME-004 | 브라우저 back | 이력 이동 | `/compatibility`→`/first-contact` 방문 | – | 1. back | 이전 화면 복귀, 세션 유지 | `/compatibility` 복귀, 세션 intact | PASS | - | PROD |
| HOME-005 | 브라우저 forward | 이력 전진 | 위 상태 | – | 1. forward | 다음 화면 | `/first-contact` 복귀, 세션 intact | PASS | - | PROD |
| HOME-006 | 새로고침 | 세션 지속 | Core Correction 활성 상태 | – | 1. `location.reload()` | 상태 그대로 복원 | 수정문장·AI숨김·scope칩 3개 모두 복원 | PASS | - | LOCAL |
| HOME-007 | Home 카드 | 최근 분석 요약 | dating 세션 완료 | – | 1. `/home` | 동기화율·Mirror·History 카드 | "동기화율 67"·"GAP · 연락"·History 변화 카드 렌더 | PASS | - | LOCAL |
| HOME-008 | New Target CTA | 사전 고지 | 위 상태 | – | 1. `/home` 문구 확인 | 무엇이 유지/변경되는지 명시 | "최근 궁합 결과가 새 결과로 바뀌어. History는 그대로 남아." | PASS | - | LOCAL |

### 5.2 Relationship Status / Lifecycle

| TC ID | 기능/화면 | 테스트 목적 | 사전조건 | 입력값 | 실행 절차 | 예상 결과 | 실제 결과 | 상태 | 우선순위 | 비고/근거 |
|---|---|---|---|---|---|---|---|---|---|---|
| STATUS-001 | S05 | 6개 옵션 렌더 | 빈 세션 | – | 1. `/status` | radio 6개 | `solo_none/solo_exp/crush/dating/married/ended` 6개 | PASS | - | `read_page` |
| STATUS-002 | S05 | 선택·저장 | 위 | `dating` | 1. 선택 2. 다음 | 저장 후 `/profile/intro` | `status:"dating"` 저장, 라우팅 정상 | PASS | - | localStorage 확인 |
| STATUS-003 | S05 | 상태 변경 | dating 완료 세션 | `ended` | 1. `/status` 2. ended 선택 | 기존 데이터 유지 | declared·experience·target·currentRelationship 전부 유지 | PASS | - | TRANS-001과 동일 근거 |
| LIFE-001 | 궁합 §04 | solo_none Job | target 3축 known | `status=solo_none` | 1. `/compatibility` | outward 허용 · 시제 누수 0 | 타이틀 "그래서 뭘 확인해볼까" · AI질문 O · 결정론질문 3 · 누수 0 | PASS | - | PROD |
| LIFE-002 | 궁합 §04 | solo_exp Job | 〃 | `status=solo_exp` | 〃 | 〃 | "그래서 뭘 확인해볼까" · AI질문 O · 3 · 누수 0 | PASS | - | PROD |
| LIFE-003 | 궁합 §04 | crush Job | 〃 | `status=crush` | 〃 | 〃 | "그래서 뭘 확인해볼까" · AI질문 O · 3 · 누수 0 | PASS | - | PROD |
| LIFE-004 | 궁합 §04 | dating Job | 〃 | `status=dating` | 〃 | 〃 | "그래서 뭘 맞춰볼까" · AI질문 3개 · 결정론질문 3 · 누수 0 | PASS | - | LOCAL+PROD |
| LIFE-005 | 궁합 §04 | married Job | 〃 | `status=married` | 〃 | 반복 지점 프레이밍 | "그래서 반복되는 지점을 어떻게 다룰까" · AI질문 O · 3 · 누수 0 | PASS | - | PROD |
| LIFE-006 | 궁합 §04 | ended Job | 〃 | `status=ended` | 〃 | outward 전면 차단 | "그래서 뭐가 남았을까" · **AI질문 0 · 결정론질문 0** · 누수 0 · 질문이 inward("나에게 물어볼 질문")로 전환 | PASS | - | LOCAL+PROD |
| LIFE-007 | 궁합 §04 | ended 자기제한 문구 | 위 | – | 1. §04 본문 확인 | 행동 지시 회피 명시 | "이 관계에서 뭘 해볼지는 이제 내가 말할 자리가 아닌 것 같아" | PASS | - | LOCAL |

### 5.3 Photos / Declared / Past

| TC ID | 기능/화면 | 테스트 목적 | 사전조건 | 입력값 | 실행 절차 | 예상 결과 | 실제 결과 | 상태 | 우선순위 | 비고/근거 |
|---|---|---|---|---|---|---|---|---|---|---|
| PHOTO-001 | S07→S18 | **사진 0장 Core Flow 완주** | `status=dating`, 사진 0 | 사진 미선택 | 1. `/profile/photos` 2. "사진 없이 질문부터 시작" 3. Declared 4문항 4. Past 3문항 | 프로필 결과 도달 | `/profile/declared/1`로 진행 → 전 단계 통과 → `/profile/result` 도달, "관측 정보 보통" 표기 | PASS | - | Journey 1 |
| PHOTO-002 | S07 | 사진 없음 한계 고지 | 위 | – | 1. 화면 문구 확인 | 무엇이 빠지는지 명시 | "사진에서 나오는 관찰 한 가지만 빠져. 나중에 언제든 추가할 수 있어." | PASS | - | 정직성 |
| PHOTO-003 | S07 | 추론 금지 범위 고지 | 위 | – | 1. 문구 확인 | 민감 추론 배제 명시 | "성적 지향·정치·종교·건강·경제 상태는 추론하지 않아" | PASS | - | – |
| PHOTO-004 | S07 | 전송·보관 고지 | 위 | – | 1. 문구 확인 | 서버 전송/미저장/제3자 한계 | 3가지 모두 명시 (AI 제공사 정책 통제 불가까지 고지) | PASS | - | – |
| PHOTO-005 | API | 사진 0장 분류 | – | `images:[]` | 1. `POST /api/ai/observed-profile` | `NO_USABLE_IMAGE` | LOCAL·PROD 모두 `{"ok":false,"reason":"NO_USABLE_IMAGE"}` HTTP 200 | PASS | - | demo fallback 아님 |
| PHOTO-006 | S07 | 실제 업로드 | – | – | – | – | 미수행 | NOT TESTED | - | 실사진 미사용 |
| DECL-001 | S10 | contact 스케일 | dating 세션 | `4` | 1. 4 선택 2. 다음 | 저장 후 S11 | `declared.contact=4` | PASS | - | – |
| DECL-002 | S11 | conflict 선택지 | 위 | 오늘 안에 이야기 | 1. 선택 2. 다음 | `now` 저장 | `declared.conflict="now"` | PASS | - | – |
| DECL-003 | S12 | alone 스케일 | 위 | `2` | 1. 선택 2. 다음 | 저장 | `declared.alone=2` | PASS | - | – |
| DECL-004 | S13 | affection+hobby+MBTI | 위 | a2 / h2 / INFP | 1. 3개 선택 2. 다음 | 저장 후 Past | `affection:"a2" hobby:"h2" mbti:"INFP"` | PASS | - | – |
| DECL-005 | S13 | MBTI 점수 미반영 고지 | 위 | – | 1. 문구 확인 | 판단 기준 아님 명시 | "MBTI는 관계를 판단하는 기준은 아니지만... 참고 정보로 사용할게" | PASS | - | 기획 원칙 준수 |
| DECL-006 | S10 | 값 변경 → 재계산 | 스냅샷 1 저장 후 | contact `4→2` | 1. `/profile/declared/1` 2. 2 선택 3. `/mirror` | 판정 변화 | contact `MATCH→GAP`, 동기화율 `87→67` | PASS | - | 회귀 검증 |
| PAST-001 | S15 | 최대 4개 경계 | dating 세션 | 대화·연락·갈등·애정·개인시간(5개) | 1. 순서대로 5개 클릭 | 4개까지만 저장 | 5번째 무시, `important` 4개 유지, 버튼 "다음 · 4개 선택" | PASS | - | BUG-004는 피드백 부재 별건 |
| PAST-002 | S16 | hardest 선택 | 위 | 연락이 줄어들 때 | 1. 선택 2. 다음 | `contact_drop` | `hardest:"contact_drop"` | PASS | - | – |
| PAST-003 | S17 | selfGap 선택 | 위 | 조금 달랐어 | 1. 선택 2. 관찰 기록 만들기 | `some` + S18 이동 | `selfGap:"some"`, `/profile/result` | PASS | - | – |
| PAST-004 | S17 | 자유서술 Optional | 위 | 빈 값 | 1. 미입력 진행 | 진행 가능 + 확신 하향 고지 | 진행됨, "확신은 조금 낮아져" 문구 | PASS | - | – |
| PAST-005 | S16a | Adaptive Follow-up | – | – | – | – | 이번 조합에서 미발동 (`adaptive:null`) | NOT TESTED | - | 트리거 조건 미충족 |

### 5.4 Current Relationship (S30)

| TC ID | 기능/화면 | 테스트 목적 | 사전조건 | 입력값 | 실행 절차 | 예상 결과 | 실제 결과 | 상태 | 우선순위 | 비고/근거 |
|---|---|---|---|---|---|---|---|---|---|---|
| CURR-001 | Mirror | **S30 미입력 → 과거 근거** | dating, S30 미응답 | – | 1. `/mirror` | 전 축 past scope + 고지 | scope칩 3개 전부 "이전 관계", 상단 "지금 이 비교의 오른쪽 칸은 전부 이전 관계에서 답한 내용이야" | PASS | - | Journey 1 |
| CURR-002 | S30 | **1축 응답 → current 전환** | 위 | `contact=often` | 1. `/profile/current` 2. 연락 응답 3. `/mirror` | contact만 current | scope칩 `["지금 관계","이전 관계","이전 관계"]` | PASS | - | Journey 2 |
| CURR-003 | Mirror | **mixed scope 요약** | 2축 응답, ended 전환 후 | contact·conflict | 1. `/mirror` | 혼합 명시 | "항목마다 근거 시점이 달라 (그때 2 · 이전 1)" | PASS | - | – |
| CURR-004 | S30 | **답 지우기** | contact 응답됨 | – | 1. "답 지우기" 클릭 | 키 제거, askedAt 유지 | `signals:{}`, `askedAt` 보존 | PASS | - | 판정 입력 아닌 표시값 구분 정확 |
| CURR-005 | S30 | Optional 고지 | – | – | 1. 문구 확인 | 점수·상대판단 미반영 명시 | "이 답은 동기화율에 들어가지 않아. 상대에 대한 판단도 만들지 않아" | PASS | - | – |
| CURR-006 | S30 | 부분 응답 UI | contact만 응답 | – | 1. 화면 확인 | 응답 축에만 지우기 노출 | "답 지우기"가 응답 축에만 표시, 전체 "답변 초기화" 별도 | PASS | - | – |
| CURR-007 | Mirror | ended에서 S30 유도 링크 | `status=ended` | – | 1. `/mirror` | 링크 미노출 | `/profile/current` 링크 0개 | PASS | - | 끝난 관계에 "지금 관계" 안 물음 |

### 5.5 Target / Compatibility

| TC ID | 기능/화면 | 테스트 목적 | 사전조건 | 입력값 | 실행 절차 | 예상 결과 | 실제 결과 | 상태 | 우선순위 | 비고/근거 |
|---|---|---|---|---|---|---|---|---|---|---|
| TARGET-001 | S19 | relation 저장 | 프로필 완료 | 썸 타는 중 | 1. 선택 | `talking` | `target.relation="talking"` | PASS | - | – |
| TARGET-002 | S19 | 4축 known 카운트 | 위 | contact=h, conflict=h | 1. 라디오 선택 | "아는 항목 2 / 4" | 정확히 2/4 표시 | PASS | - | – |
| TARGET-003 | S19 | 모름 제외 고지 | 위 | – | 1. 문구 확인 | 명시 | "모름은 점수에서 제외돼" | PASS | - | – |
| TARGET-004 | S19 | MBTI 렌즈 분리 | 위 | – | 1. 문구 확인 | 점수 미반영 명시 | "점수에는 넣지 않지만, 둘 사이의 성향 차이를 보는 참고 렌즈" | PASS | - | – |
| COMP-001 | S21 | **comparedCount 0 → null** | target 4축 전부 x | – | 1. `/compatibility` | `?` + 안내 | `?` · "관측 정보 부족 · 입력 0/4" · 미비교 4축 열거 · "3개 이상 더 알려주면" | PASS | - | PROD |
| COMP-002 | S21 | **comparedCount 2 → null** | target 2축 known | contact=h, conflict=h | 1. `/compatibility` | `?` + 안내 | `?` · "입력 2/4" · 미비교 2축 열거 · "1개 이상 더 알려주면" | PASS | - | 산술 정확 |
| COMP-003 | S21 | **comparedCount 3 → 점수** | +alone=m | – | 1. `/compatibility` | 숫자 산출 | **87** · "비교 가능한 3개 관계 신호로 계산했어" · 제외 축(애정 표현) 명시 | PASS | - | 경계값 |
| COMP-004 | S21 | 성공확률 표현 금지 | 위 | – | 1. 금지어 정규식 스캔 | 부인 문구 외 0건 | 매치 1건 = "연애 성공확률이 아니야"(부인 문구) | PASS | - | 스캔어: 성공확률/성공률/천생연분/최고의 궁합/상극/찰떡/운명 |
| COMP-005 | S21 | 점수 상대화 카피 | 위 | – | 1. 문구 확인 | 숫자 절대화 방지 | "이 숫자보다, 지금 실제로 어디에서 기대가 다른지 보는 게 더 쓸모 있어" | PASS | - | – |
| COMP-006 | S21→Mirror | 궁합 → Mirror 진입 | 위 | – | 1. Mirror 이동 | Mirror 정상 렌더 | 3축 대조 + Core Insight 렌더 | PASS | - | Journey 1 |
| COMP-007 | S21 | GOOD/FRICTION 행 | 위 | – | 1. §02·§03 확인 | 결정론 행 유지 | "잘 맞는 신호" 렌더, 차이 없을 때 "차이가 없다는 결론은 아니야" 고지 | PASS | - | 무증거 단정 회피 |
| COMP-008 | `/first-contact` | 상대 없음 리포트 | target 전부 미입력 | – | 1. `/first-contact` | 내 기준만으로 리포트 | "내 기준 5개" 신호 4종 렌더, "여기에 해석을 섞지 않았어" | PASS | - | PROD |

### 5.6 Mirror / Core Correction

| TC ID | 기능/화면 | 테스트 목적 | 사전조건 | 입력값 | 실행 절차 | 예상 결과 | 실제 결과 | 상태 | 우선순위 | 비고/근거 |
|---|---|---|---|---|---|---|---|---|---|---|
| MIRROR-001 | S27 | MATCH 렌더 | dating, past scope | – | 1. `/mirror` | 축별 상태+근거 | 연락·갈등해결·애정표현 3축 MATCH, 각 "근거 시점: 이전 관계" | PASS | - | – |
| MIRROR-002 | S27 | GAP 렌더 | declared contact=2, S30 contact=often | – | 1. `/mirror` | GAP 판정 | contact `GAP` | PASS | - | – |
| MIRROR-003 | S27 | current scope 근거 문장 | S30 contact 응답 | – | 1. 축 카드 확인 | S30 답 인용 | `지금 관계에서 "바로 알아차리고 마음이 쓰여"라고 답함` | PASS | - | – |
| MIRROR-004 | S27 | **ended 재라벨** | S30 응답 후 ended 전환 | – | 1. `/mirror` | 그때 시제로 전환 | 칩이 "지금 관계"→**"그때 이 관계"**, 금지어 6종 0건 | PASS | - | 핵심 안전 계약 |
| MIRROR-005 | S28 | Core Insight 근거 | dating 세션 | – | 1. `/mirror` | 근거 번호 목록 | `01 연락 중요도를 4/5로 답함` / `02 …` | PASS | - | – |
| MIRROR-006 | S27 | CHANGE/UNKNOWN 상태 | – | – | – | – | UI 미재현 (fixture 커버) | NOT TESTED | - | `test:relationship-evidence` 280건이 로직 커버 |
| CORE-001 | S28 | '조금 달라' + 빈 입력 | AI Core 표시 중 | 빈 문자열 | 1. 조금 달라 2. 빈 상태로 "이렇게 고칠게" | 정책 미확정 | 토스트 "한 줄만 적어줘", 저장 없음, AI 요약 유지 | PASS | - | Product Decision PD-001 참조 |
| CORE-002 | S28 | **수정 > AI** | 위 | "연락보다 대화의 밀도가 더 중요했어" | 1. 조금 달라 2. 입력 3. 이렇게 고칠게 | 사용자 문장이 headline, AI 요약 숨김 | headline 교체 + "네가 고친 문장이야. 러비의 원래 관찰도 기록에 함께 저장할게" + AI 요약 숨김 | PASS | - | – |
| CORE-003 | S28 | 근거·섹션 유지 | 위 | – | 1. 화면 확인 | evidence 유지 | 근거 01·02 그대로, Core 섹션 유지, 축 AI narrative 유지 | PASS | - | – |
| CORE-004 | S28 | 수정 상태 새로고침 | 위 | – | 1. reload | 상태 복원 | 수정문장 복원 · AI Core 숨김 유지 · scope칩 3개 정상 | PASS | - | – |
| CORE-005 | S28 | **원래 관찰로 되돌리기** | 위 | – | 1. 조금 달라 2. "원래 관찰로 되돌리기" | 원복 | `coreCorrection:""`, `coreVerdict:null`, AI 요약 복원(새 headline 생성) | PASS | - | 정상 undo 경로 |
| CORE-006 | S28 | **'맞는 것 같아' 일관성** | 수정 저장된 상태 | – | 1. "맞는 것 같아" 클릭 | verdict와 화면 일치 | `coreVerdict:"ok"`인데 **화면은 수정문장 + "네가 고친 문장이야" 유지, AI 요약 계속 숨김** | **FAIL** | **P2** | **BUG-001** |
| CORE-007 | S28 | 수정 History 반영 | 수정 없는 상태 저장 | – | 1. 저장 | `userCorrection:null` | snapshot `coreInsight.userCorrection: null`, `original` 보존 | PASS | - | – |

### 5.7 History

| TC ID | 기능/화면 | 테스트 목적 | 사전조건 | 입력값 | 실행 절차 | 예상 결과 | 실제 결과 | 상태 | 우선순위 | 비고/근거 |
|---|---|---|---|---|---|---|---|---|---|---|
| HIST-001 | S28 | snapshot 0→1 저장 | ended 세션 | – | 1. "내 관찰 기록에 저장" | 1건 저장 | 1건, `analysisId` 생성 | PASS | - | – |
| HIST-002 | 저장 스키마 | scope·AI 메타 보존 | 위 | – | 1. localStorage 확인 | 축별 scope + promptVersion | 축별 `evidenceScope:"current"/"past"`, `coreInsight.aiMeta.promptVersion:"relationship-v7-evidence"` | PASS | - | v1.43 marker가 기록에도 남음 |
| HIST-003 | `/history/report` | **2건 비교** | declared contact 4→2 후 2건 저장 | – | 1. `/history/report` | SHIFT/STABLE/INSUFFICIENT 구분 | 연락 **변화**(4/5→2/5), 갈등해결·애정표현 **유지**, 개인시간·취미공유 "아직 비교하기 어려운 기준" | PASS | - | – |
| HIST-004 | `/history/report` | AI 변화 설명 | 위 | – | 1. AI 블록 확인 | 성장 서사 없이 사실 기술 | "연락의 중요도가 예전보다 낮아진 걸로 보여. 이전에는 4였던 점수가 지금은 2로 줄어들었어." | PASS | - | 극복/성장 서사 없음 |
| HIST-005 | `/history/report` | CRM화 방지 | 위 | – | 1. 전체 스캔 | 사람 추적 아님 | 상대 식별정보 0, `targetRelation` 범주값만, 비교 대상은 '내 기준' | PASS | - | – |
| HIST-006 | 저장 스키마 | 자유서술·사진 미저장 | 위 | – | 1. snapshot 필드 확인 | note·photo 없음 | `relationshipEvidence`에 `important/hardest/selfGap/adaptive`만, 사진 필드 없음 | PASS | - | – |
| HIST-007 | `/history` | snapshot 0건 상태 | 빈 히스토리 | – | 1. `/home` | 안내 문구 | "아직 저장된 관찰이 없어. Relationship Mirror를 저장하면 여기에 쌓여." | PASS | - | – |
| HIST-008 | `/history` | 삭제 | – | – | – | – | 미수행 | NOT TESTED | - | 범위 제외 |

### 5.8 Premium

| TC ID | 기능/화면 | 테스트 목적 | 사전조건 | 입력값 | 실행 절차 | 예상 결과 | 실제 결과 | 상태 | 우선순위 | 비고/근거 |
|---|---|---|---|---|---|---|---|---|---|---|
| PREM-001 | `/premium` | Fake Door 프리뷰 시제 | ended 세션 | – | 1. `/premium?source=mirror` | 과거 시제 | "그때 상대와…", "그때 이 관계에서 신호가 있는 축" | PASS | - | LOCAL |
| PREM-002 | `/premium` | **PROD 결제 오인 방지** | dating 세션 (PROD) | – | 1. "정밀 관찰 리포트 보기" 클릭 | 리포트 미개방 + 준비중 고지 | 리포트 열리지 않음. "정밀 관찰 리포트는 지금 준비 중이야. 아직 결제도, 리포트 연결도 전이야. 방금 누른 건 결제가 아니라 관심 표시로만 기록했어." · 연락처 미수집 명시 | PASS | - | 결제 성공 문구 0건 |
| PREM-003 | Deep Report | **ended 시제 누수 0** | ended 세션 (LOCAL preview) | – | 1. 리포트 진입 2. 전체 스캔 | 금지어 0 | 금지어 6종 0건 · 결제완료 문구 0건 · outward 명령문 0건 · 액션이 REFLECT/NOTICE(inward) | PASS | - | – |
| PREM-004 | Deep Report | 데이터 부족 고지 | 히스토리 1건 | – | 1. 리포트 하단 | 없는 것을 없다고 | "저장된 관찰 기록이 2개 미만이라 과거와 지금을 비교하는 부분은 만들지 않았어" | PASS | - | – |
| PREM-005 | `/premium-preview/*` | **PROD 게이트** | – | 3개 경로 | 1. 각 경로 접속 | 비활성 | `relationship_deep_report`·`?mode=ut`·`deep-questions` 전부 "개발용이라 지금은 열려 있지 않아" | PASS | - | PROD |
| PREM-006 | Deep Report API | outward question 정책 | – | `tense=former` | 1. `POST /api/ai/deep-report-narrative` | 응답에 question 포함 가능(화면 미사용) | `conversationQuestion` 반환됨 — 단 `taskContract.ts:249`가 `outwardQuestions:'deterministic-only'`로 **의도적 설계**임을 명시(화면 미렌더) | PASS | - | 설계 의도 확인, 결함 아님 |

### 5.9 Transition (상태 전환)

| TC ID | 기능/화면 | 테스트 목적 | 사전조건 | 입력값 | 실행 절차 | 예상 결과 | 실제 결과 | 상태 | 우선순위 | 비고/근거 |
|---|---|---|---|---|---|---|---|---|---|---|
| TRANS-001 | S05 | **dating → ended** | dating 완료 세션(S30 2축) | `ended` | 1. `/status` 2. ended | 데이터 전부 유지 | `currentRelationship`(2축)·`target`(4필드)·`declared`(5필드)·`experience` 전부 유지 | PASS | - | – |
| TRANS-002 | S05 | ended → dating 복귀 | 위 | `dating` | 1. dating 재선택 | 데이터 유지 + 캐시 재사용 | 유지됨, AI 요청 증가 0 (동일 정책 캐시 히트) | PASS | - | CACHE-003 |
| TRANS-003 | `/home` | **New Target reset 매트릭스** | ended 세션 + History 2건 | – | 1. "새로운 사람과 궁합 보기" | target/S30/질문/verdict 초기화, 나머지 유지 | **초기화**: target 전 필드(relation null, 4축 x, mbti null, birthProfile, interests), `currentRelationship{signals:{},askedAt:null}`, savedQuestions, coreVerdict, coreCorrection / **유지**: status, declared, experience, 내 MBTI, History 2건 | PASS | - | 화면 고지와 정확히 일치 |
| TRANS-004 | – | talking→dating, dating→long_term 등 | – | – | – | – | UI 미재현 | NOT TESTED | - | `test:lifecycle` 144건이 로직 커버(L9~L12 포함) |

### 5.10 AI Task / Evidence / Safety

| TC ID | 기능/화면 | 테스트 목적 | 사전조건 | 입력값 | 실행 절차 | 예상 결과 | 실제 결과 | 상태 | 우선순위 | 비고/근거 |
|---|---|---|---|---|---|---|---|---|---|---|
| AI-001 | observed API | promptVersion | PROD | `images:[]` | 1. POST | 설정 정상 | `NO_USABLE_IMAGE` (config 게이트 통과 증명) · E2E에서 `observed-v2-photo` | PASS | - | – |
| AI-002 | relationship API | **v7 marker** | PROD | 최소 payload | 1. POST | `relationship-v7-evidence` | `mode:"real"`, `promptVersion:"relationship-v7-evidence"`, `model:"gpt-4o-mini"` | PASS | - | 실제 Production 응답 |
| AI-003 | compatibility API | **v4 marker** | PROD | 최소 payload | 1. POST | `compatibility-v4-tense` | 동일 형식으로 확인 | PASS | - | – |
| AI-004 | history API | **v3 marker** | PROD | `allowed:[]` | 1. POST | `history-v3-axis` | `mode:"real"`, `history-v3-axis` (provider 호출 0 · 무비용 경로) | PASS | - | – |
| AI-005 | deep-report API | **v4 marker** | PROD | `insights:[]` | 1. POST | `deep-report-v4-tense` | `mode:"real"`, `deep-report-v4-tense` (무비용 경로) | PASS | - | – |
| AI-006 | Production 모드 | demo/CONFIG_ERROR 아님 | PROD | – | 1. 4개 응답 `meta.mode` | `real` | 4/4 전부 `"mode":"real"` | PASS | - | – |
| EVID-001 | relationship payload | **축별 허용집합** | dating, S30 contact·conflict 응답 | – | 1. fetch 인터셉트로 요청 본문 캡처 | 축마다 다른 허용 ref | `contact:[declared,current_relationship]`, `conflict:[declared,current_relationship]`, `affection:[declared, relationship:important]` | PASS | - | 실제 payload |
| EVID-002 | relationship payload | contact에 value_gap 없음 | 위 | – | 1. 허용집합 검사 | 비축 ref 부재 | contact 허용집합에 `value_gap` 계열 없음 | PASS | - | `test:ai` R2 동일 계약 |
| EVID-003 | relationship payload | contact에 selfGap 없음 | 위 | – | 1. 허용집합 검사 | 부재 | selfGap 계열 ref 없음(어느 축에도) | PASS | - | `test:ai` R3 |
| EVID-004 | relationship payload | scope별 current_relationship | 위 | – | 1. 허용집합 검사 | 응답 축만 허용 | S30 응답한 contact·conflict만 `current_relationship` 보유, affection은 없음 | PASS | - | `test:ai` R4와 실동작 일치 |
| EVID-005 | compatibility | cross-dimension 거부 | – | – | 1. `test:ai` | 거부 | 508건 스위트에 포함, ALL PASS | PASS | - | 스위트 근거 |
| EVID-006 | history 응답 | **canonical axis** | PROD | `allowed:[{axis:contact,state:SHIFT}]` | 1. POST | 영문 key | `"axis":"contact"` (한글 label 아님) | PASS | - | – |
| EVID-007 | history 응답 | **history ref + entryId** | 위 | allowedRefs에 entryId 2종 | 1. POST | entryId 포함 ref | `[{source:history,entryId:e1,axis:contact},{…e2…}]` | PASS | - | v1.43 §45.3 계약 성립 |
| EVID-008 | deep-report | evidence subset | – | – | 1. `test:ai:e2e` | subset 유지 | `evidence-subset-ok: true` | PASS | - | – |
| SAFE-001 | 궁합(ended) | **AI question 0** | ended, target 3축 | – | 1. `/compatibility` | 질문 섹션 부재 | "러비가 덧붙인 질문" 섹션 자체 없음, 결정론 질문도 0 | PASS | - | LOCAL+PROD 동일 |
| SAFE-002 | 궁합(dating) | question 유지 | dating | – | 1. `/compatibility` | 질문 정상 | AI 질문 3개(개인시간·갈등해결·연락방식) + 결정론 질문 3개 | PASS | - | – |
| SAFE-003 | Mirror(ended) | 금지 표현 0 | ended + current evidence | – | 1. 전체 텍스트 스캔 | 6종 0건 | `지금 이 관계/지금 상대/현재 관계/현재 상대/앞으로 둘이/계속 만나면서` 전부 0 | PASS | - | – |
| SAFE-004 | Deep Report(ended) | 현재 시제 0 | ended | – | 1. 전체 스캔 | 0건 | 금지어 0, 본문 전부 과거형 | PASS | - | – |
| SAFE-005 | 궁합(ended) | 원인 단정 회피 | ended | – | 1. 부인 문구 확인 | 인과 단정 금지 | "이 숫자는 관계가 왜 끝났는지 설명하지 않아. 당시 어떤 기대가 달랐는지 보는 참고값이야." | PASS | - | – |
| SAFE-006 | 궁합(ended) | 질문 방향 전환 | ended | – | 1. §04 확인 | outward→inward | "나에게 물어볼 질문" 3개, 전부 과거 회고형 | PASS | - | – |
| SAFE-007 | 전 상태 | 시제 누수 회귀 | 6개 상태 | – | 1. 각 상태 `/compatibility` 스캔 | 전부 0 | 6/6 상태에서 금지어 0건 | PASS | - | PROD |

### 5.11 Cache / Fingerprint

| TC ID | 기능/화면 | 테스트 목적 | 사전조건 | 입력값 | 실행 절차 | 예상 결과 | 실제 결과 | 상태 | 우선순위 | 비고/근거 |
|---|---|---|---|---|---|---|---|---|---|---|
| CACHE-001 | relationship | **동일 입력 재사용** | dating 세션, SPA 유지 | – | 1. `/mirror` 2. `/home` 3. `/mirror` | 요청 1회 | `relationship-insight: 1` 유지 (재방문에도 증가 없음) | PASS | - | fetch 카운터 |
| CACHE-002 | relationship | **tense+allowsOutward 변경 → miss** | 위 | dating→ended | 1. `/status` ended 2. `/mirror` | 요청 2회 | `relationship-insight: 2` | PASS | - | – |
| CACHE-003 | relationship | 정책 복귀 → hit | 위 | ended→dating | 1. dating 2. `/mirror` | 증가 없음 | `2` 유지 | PASS | - | 지문 재사용 정당성 확인 |
| CACHE-004 | relationship | **S30 변경 → miss** | dating | `current-contact=rarely` | 1. S30 응답 2. 결과 반영 | 요청 3회 | `relationship-insight: 3` | PASS | - | – |
| CACHE-005 | 전 Task | promptVersion 포함 | – | – | 1. 코드 검증 | 키에 포함 | `cacheKey = task::promptVersion::fingerprint` (`src/services/ai/aiClient.ts:116`) | PASS | - | 정적 검증 — 런타임 재현은 코드 수정 필요(금지) |
| CACHE-006 | 전 Task | Core correction 지문 영향 | – | – | 1. 코드 검증 | 자유서술 미포함 | `aiEvidenceResolver.ts:782` — correction 존재 시 core를 AI에 보내지 않고 null 처리 | PASS | - | 프라이버시 겸용 |

### 5.12 Error / Empty / Boundary

| TC ID | 기능/화면 | 테스트 목적 | 사전조건 | 입력값 | 실행 절차 | 예상 결과 | 실제 결과 | 상태 | 우선순위 | 비고/근거 |
|---|---|---|---|---|---|---|---|---|---|---|
| ERR-001 | `/mirror` | **빈 localStorage 직접 접근** | 완전 초기화 | – | 1. `/mirror` | 안내 + CTA | "아직 관측 기록이 부족해. 이 상태에서 결론 내리면 내가 인간을 또 오해할 것 같아." + 질문 CTA 2개 | PASS | - | 조작된 결과 없음 |
| ERR-002 | `/home` | **손상 세션 복원** | invalid enum·타입 주입 | `status:'NOT_A_STATUS'`, `declared.contact:'abc'`, `experience.important:'notanarray'`, history JSON 손상 | 1. `/home` | 크래시 없음 | 크래시 없음, 손상 history는 빈 상태 처리. **단** 쓰레기 값에서 "관계 경험 11", "갈등 잠깐 뒤 대화 선호" 같은 확정형 관찰이 생성됨 | **FAIL** | **P3** | **BUG-002** |
| ERR-003 | `/mirror` | **AI 500 → deterministic 유지** | dating 세션 | `/api/ai/*` → HTTP 500 | 1. fetch 스텁 2. SPA로 `/mirror` | 결과 유지 + 정직 고지 | 결정론 2축·MATCH 유지, AI narrative 0, "러비가 설명을 정리하지 못해서 확인된 신호만 보여주고 있어." 크래시 0 | PASS | - | Enhancement 계약 준수 |
| ERR-004 | `/mirror` | **AI parse fail → 유지** | 위 | 200 + `narratives:'GARBAGE'` | 1. 스텁 2. `/mirror` | 결과 유지 | 결정론 2축 유지, AI 0, 크래시 0 | PASS | - | 단 BUG-003 동반 발생 |
| ERR-005 | 콘솔 | AI 실패 시 예외 | 위 | `meta:null` 포함 응답 | 1. 콘솔 확인 | unhandled rejection 없음 | `Uncaught (in promise) TypeError: Cannot read properties of null (reading 'mode')` @ `useAiNarrative.ts:100` | **FAIL** | **P3** | **BUG-003** |
| ERR-006 | 콘솔 | 정상 여정 에러 (PROD) | – | – | 1. 전 여정 후 콘솔 | 0건 | 0건 | PASS | - | – |
| ERR-007 | S15 | 최대치 초과 피드백 | S15 4개 선택됨 | 5번째 클릭 | 1. 클릭 | 거부 사유 전달 | 무시되지만 토스트/사유 없음 (상시 헬퍼 "최대 4개"만 존재) | **FAIL** | **P3** | **BUG-004** — ⚠️ **2026-09-09 재검증 결과 재현되지 않음.** 아래 BUG-004 주석 참고 |

### 5.13 Responsive

| TC ID | 기능/화면 | 테스트 목적 | 사전조건 | 입력값 | 실행 절차 | 예상 결과 | 실제 결과 | 상태 | 우선순위 | 비고/근거 |
|---|---|---|---|---|---|---|---|---|---|---|
| RESP-001 | 5개 화면 | 360×800 | dating 세션 | – | 1. 각 화면 overflow 측정 | overflow 0 | `/mirror /compatibility /home /history /premium` 전부 `scrollWidth=360=clientWidth`, 초과 요소 0, 터치타깃<40px 0 | PASS | - | – |
| RESP-002 | 5개 화면 | 375×812 | 〃 | – | 〃 | 0 | 5/5 클린 | PASS | - | – |
| RESP-003 | 4개 화면 | 393×852 | 〃 | – | 〃 | 0 | 4/4 클린 | PASS | - | 스크린샷 근거 확보 |
| RESP-004 | 4개 화면 | 430×932 | 〃 | – | 〃 | 0 | 4/4 클린 | PASS | - | – |
| RESP-005 | 3개 화면 | 768×1024 | 〃 | – | 〃 | 0 | 3/3 클린 | PASS | - | – |
| RESP-006 | 3개 화면 | 1280×800 | 〃 | – | 〃 | 0 | 3/3 클린 | PASS | - | 데스크톱에서도 본문 overflow 0 |

### 5.14 Accessibility (제품 QA 수준)

| TC ID | 기능/화면 | 테스트 목적 | 사전조건 | 입력값 | 실행 절차 | 예상 결과 | 실제 결과 | 상태 | 우선순위 | 비고/근거 |
|---|---|---|---|---|---|---|---|---|---|---|
| A11Y-001 | 4개 화면 | 폼 라벨 | – | – | 1. label/aria 검사 | 미라벨 0 | `/mirror /compatibility /profile/declared/1 /target` 전부 0 | PASS | - | textarea `aria-label="핵심 관찰 수정"` 확인 |
| A11Y-002 | 4개 화면 | heading 위계 | – | – | 1. h1~h6 순서 | h1 1개·skip 0 | 4/4 화면 h1=1, skip 0 | PASS | - | – |
| A11Y-003 | 4개 화면 | 버튼 접근명 | – | – | 1. 텍스트/aria 검사 | 무명 0 | 0건 | PASS | - | – |
| A11Y-004 | 4개 화면 | img alt / clickable div | – | – | 1. 검사 | 위반 0 | alt 누락 0, `div[onclick]` 0 | PASS | - | 시맨틱 요소 사용 |
| A11Y-005 | S19 | 그룹 시맨틱 | – | – | 1. DOM 확인 | fieldset/legend | 4축 전부 `<fieldset><legend>` + `sr-only` radio + `min-h-11` | PASS | - | 터치 타깃 44px |
| A11Y-006 | BottomSheet | 포커스 트랩 | – | – | – | – | 미검증 | NOT TESTED | - | 범위 제외 |

### 5.15 Production Guard / Privacy

| TC ID | 기능/화면 | 테스트 목적 | 사전조건 | 입력값 | 실행 절차 | 예상 결과 | 실제 결과 | 상태 | 우선순위 | 비고/근거 |
|---|---|---|---|---|---|---|---|---|---|---|
| PROD-001 | dev routes | **POST 차단** | PROD | `{}` | 1. 3개 경로 POST | 404 | `contract-test`·`dev/history-test`·`dev/lifecycle-test` 전부 **404** | PASS | - | GET은 405(본문 비어 있음) — 정상 라우트 `observed-profile`도 GET 405로 동일. Next 기본 메서드 처리이며 dev 핸들러는 실행 불가 |
| PROD-002 | AI Debug Panel | 미노출 | PROD | – | 1. 번들 문자열 스캔 + 화면 | 0 | `AI DEBUG`·`dev only`·`AI Debug Panel` 번들에서 **완전 제거**(이중 가드로 tree-shake), 화면 버튼 0 | PASS | - | LOCAL은 노출(의도) |
| PROD-003 | PrototypePanel | 미노출 | PROD | – | 1. 화면 검사 | 0 | `NOW SHOWING` 0, 화면인덱스 링크(S01~) 0, 개발 리셋 버튼 0 | PASS | - | `NODE_ENV==='production'` 가드 |
| PROD-004 | Premium Preview | 비활성 | PROD | 3개 경로 | 1. 접속 | 게이트 | 전부 "개발용이라 지금은 열려 있지 않아" | PASS | - | `.env.local` 값 무관 — 실제 배포만 근거 |
| PROD-005 | UT Mode | 미노출 | PROD | – | 1. 4개 화면 스캔 | 0 | UT 블록 0 (LOCAL은 노출) | PASS | - | – |
| PROD-006 | demo 문구 | 미노출 | PROD | – | 1. 4종 문구 스캔 | 0 | `규칙 기반 데모`·`DEMO AI`·`실제 사진 내용을 분석하지 않았어`·`샘플 결과` 0건 | PASS | - | – |
| PROD-007 | 번들 시크릿 | 노출 0 | PROD | 26개 청크(916KB) | 1. 전량 다운로드 후 스캔 | 0 | `sk-*`·`AI_API_KEY`·`api.openai.com`·`Bearer *`·`SHARED_RATE_LIMIT_URL` 전부 0건 | PASS | - | – |
| PROD-008 | 번들 프롬프트 | System Prompt 미노출 | PROD | – | 1. 스캔 | 0 | 프롬프트 본문 0건 (`너는 관계` 매치는 Lovy 사용자 카피) | PASS | - | v1.7 분리 설계 유효 |
| PRIV-001 | AI 요청 | **raw status 미전송** | ended 세션 | – | 1. payload 캡처 | status 없음 | 최상위 키 `[inputFingerprint, context, judgements, focusAxis, allowedEvidenceRefs, allowsOutwardQuestions, tense]` — `ended` 문자열 payload 전체에 **0회** | PASS | - | – |
| PRIV-002 | AI 요청 | job/stage 미전송 | 위 | – | 1. 정규식 검사 | 0 | `"job"/"stage"/"lifecycle"` 0건 | PASS | - | – |
| PRIV-003 | AI 요청 | context 필드 경계 | 위 | – | 1. contextKeys 확인 | tense만 시제 표현 | `[tense, declared, relationship, adaptive, observedValidated, ruleJudgements, pastObservations]` — `allowsOutwardQuestions`는 context 밖 | PASS | - | 후처리 전용 유지 |
| PRIV-004 | AI 요청 | MBTI 미전송 | 내 MBTI=INFP | – | 1. payload 검사 | 없음 | `INFP` 0건 | PASS | - | Supporting Lens 격리 |
| PRIV-005 | AI 요청 | 자유서술 미전송 | Core correction 저장됨 | – | 1. payload 검사 | 없음 | 수정 문장 0건 | PASS | - | – |
| PRIV-006 | localStorage | 사진 원본 미저장 | – | – | 1. `serialize()` + 저장값 | base64 없음 | `{id,label,source,tone}`만 저장, `dataUrl`/`objectUrl` 없음 | PASS | - | – |
| PRIV-007 | History | 원문·사진 미저장 | – | – | 1. snapshot 필드 | 없음 | note/photo 필드 부재 | PASS | - | – |
| PRIV-008 | Analytics | 답변 원본 외부 차단 | – | – | 1. 콘솔·가드 코드 | 차단 | `EXTERNAL_FORBIDDEN_KEYS`가 `contact/alone/conflict/affection/hobby/mbti` 차단, 로컬 store에만 잔류. 경고 로그는 `NODE_ENV!=='production'` 한정 | PASS | - | 방어 정상 동작 |
| PRIV-009 | Privacy 화면 | 접근성 | PROD | – | 1. `/privacy` | 200 | 200 | PASS | - | – |

**테스트케이스 합계: 148건**

---

## 6. Bug Report

| Bug ID | 관련 TC | 화면/기능 | 문제 요약 | 재현 조건 | 재현 절차 | 예상 결과 | 실제 결과 | 영향 | Priority | 재현율 | 상태 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BUG-001 | CORE-006 / QA-CHK-040 | S28 Mirror Core Insight | Core Correction이 저장된 상태에서 "맞는 것 같아"를 누르면 `coreVerdict='ok'`가 되지만 `coreCorrection`이 그대로 남아 화면·상태가 모순된다 | Core Correction 1회 이상 저장된 세션 | 1. `/mirror` 2. "조금 달라" → 문장 입력 → "이렇게 고칠게" 3. "맞는 것 같아" 클릭 | AI 원래 관찰이 복원되거나, 최소한 "네가 고친 문장이야" 표기가 사라짐 | `coreVerdict:"ok"`인데 headline은 여전히 사용자 수정문, "네가 고친 문장이야" 유지, AI Core 요약 계속 숨김. 빈 값 재제출도 무시됨(`draft.trim().length===0` 가드) | 사용자의 최신 의사가 화면에 반영되지 않음. History 저장 시 `userCorrection`이 남아 verdict='ok'와 불일치 기록 가능 | **P2** | 100% | OPEN |
| BUG-002 | ERR-002 / QA-CHK-063 | SessionProvider `deserialize()` | 복원 시 enum·스칼라 값 검증이 없어, 손상/비정상 세션에서 쓰레기 값이 그대로 판정에 흘러들어 확정형 관찰 문장을 만든다 | localStorage 수동 편집 또는 향후 스키마 변경으로 구버전 enum이 남은 경우 | 1. `lym.session.v1`에 `status:'NOT_A_STATUS'`, `declared.contact:'abc'`, `declared.conflict:99`, `experience.important:'notanarray'` 주입 2. `/home` | 잘못된 값은 미입력으로 처리하고 판정에 쓰지 않음 | 크래시는 없으나 "관계 경험 11"(문자열 `.length`), "갈등 잠깐 뒤 대화 선호"(conflict=99 유래) 등 근거 없는 확정 문구 생성 | 정상 사용 경로로는 도달 불가. 다만 '근거 없이 판정하지 않는다' 원칙과 충돌하고, 레거시 세션 마이그레이션 시 잠재 위험 | **P3** | 100% (주입 시) | OPEN |
| BUG-003 | ERR-004·ERR-005 / QA-CHK-084 | `src/hooks/useAiNarrative.ts:100` 부근 | 캐시된 AI 결과의 `meta`가 없을 때 `cached.meta.mode` 접근이 방어되지 않아 unhandled promise rejection 발생 | AI 응답이 `ok:true`인데 `meta`가 null/누락인 경우 | 1. `/api/ai/*`를 `{ok:true,data:{narratives:'GARBAGE',meta:null}}`로 스텁 2. SPA로 `/mirror` 진입 | 방어적으로 무시하고 fallback | `Uncaught (in promise) TypeError: Cannot read properties of null (reading 'mode')` (화면 자체는 deterministic 유지) | 현재 서버는 항상 `buildMeta()`로 meta를 채우므로 **실서비스 경로에서는 도달 불가**. 계약 위반 응답에 대한 방어 부재 | **P3** | 100% (스텁 시) | OPEN |
| BUG-004 | ERR-007 / QA-CHK-018 | S15 (`/profile/past/1`) | 최대 4개 초과 선택 시 아무 피드백이 없어 '클릭이 먹지 않는' 것처럼 보인다 | S15에서 이미 4개 선택된 상태 | 1. `/profile/past/1` 2. 4개 선택 3. 5번째 항목 클릭 | 토스트 등으로 상한 도달 안내 | 무시만 되고 토스트/시각 피드백 없음. 상시 헬퍼 문구 "최대 4개"만 존재 | 경미한 UX 혼란. 기능 영향 없음 | **P3** | ~~100%~~ **0% (재현 안 됨)** | ~~OPEN~~ **NOT REPRODUCIBLE** |

> **v1.44 후속 QA 주석 (2026-09-09) — 위 행의 판정·실제결과는 그대로다.**
>
> BUG-001·BUG-002·BUG-003은 v1.44 candidate에서 수정됐고, v1.44 Final Closure에서
> `test:trust` 자동 회귀로 고정됐다 — 상세는
> [`QA_럽유럽미_v1.44_PostFix.md`](./QA_%EB%9F%BD%EC%9C%A0%EB%9F%BD%EB%AF%B8_v1.44_PostFix.md) §2 · §13.
>
> BUG-002를 검증하던 중 **이 QA에서는 발견되지 않은** 별건이 나왔다 — 빈 세션의
> `/home`이 근거 없는 성격 단정을 보여주는 문제(NEW-002 · P2)다. 같은 문장
> (`갈등 잠깐 뒤 대화 선호`)이 화면에 나오지만 **경로가 다르다**: BUG-002는
> `conflict:99`가 그 문장에 도달한 tampering 경로, NEW-002는 `conflict:null`이 도달한
> 기본값 경로다. 이 문서의 TC에는 **소급 FAIL을 추가하지 않는다** — 당시 실행 범위에
> 그 케이스가 없었다. 후속 발견 기록은 PostFix 문서 §8 · §13에 있다.

> 이번 QA에서는 버그를 수정하지 않으므로 `FIXED` 상태를 사용하지 않았다.

> ⚠️ **2026-09-09 정정 — BUG-004는 결함이 아니었다(측정 오류).**
>
> v1.44 후속 작업에서 재검증한 결과, S15의 5번째 선택 시도에는 **토스트가 정상적으로
> 뜬다** — `PastStepView.tsx`가 `togglePastFactor()`의 반환값이 `false`일 때
> `최대 4개까지 고를 수 있어`를 이미 띄우고 있었고, 코드는 v1.43 시점에도 같았다.
>
> 초판이 놓친 이유는 **관측 방법**에 있다. 5번째 클릭 뒤 토스트를 같은 tool call 안에서
> 읽지 않고 다음 호출에서 `document.body.innerText`로 읽었는데, 그때는 토스트가 이미
> 자동 소멸한 뒤였고 매칭된 `최대 4개`는 화면에 상시 표시되는 헬퍼 문구였다.
> (이 환경의 Browser pane은 탭이 `document.hidden`이라 타이머가 clamp된다.)
>
> 재검증 실측 — 클릭 직후 `[role="status"]` 직접 조회:
> `4→5 시도` 시 `최대 4개까지 고를 수 있어` **1회 노출**, `important`는 4개 유지,
> 약 2.6초 뒤 자동 소멸. `PAST-LIMIT-01~05` 전부 PASS(`QA_럽유럽미_v1.44_PostFix.md` §3).
>
> **위 행의 `실제 결과`·`상태`는 당시 기록 그대로 남긴다** — 이 문서는 Pre-Fix 실행
> 기록이고, 잘못 본 것도 그때 무엇을 봤는지의 기록이기 때문이다. 재현율과 상태에만
> 취소선으로 정정을 표시했다. **BUG-004에 대한 코드 수정은 하지 않았다**(중복 토스트를
> 만들지 않기 위해서다).

---

## 7. Product Decision Needed

| ID | 영역 | 현재 동작 | 결정되지 않은 점 | 사용자 영향 | 권장 검증 방법 |
|---|---|---|---|---|---|
| PD-001 | Core Correction | `coreVerdict='no'`(조금 달라)를 누른 뒤 문장을 안 쓰고 제출하면 토스트 "한 줄만 적어줘"만 뜨고 저장되지 않으며, AI 요약은 그대로 남는다 | "AI 관찰이 틀렸다"는 신호는 줬는데 대안 문장이 없을 때, AI 요약을 계속 보여주는 게 맞는가 / '이 관찰은 사용자가 동의하지 않음' 표식을 붙일 것인가 | 사용자는 부정 의사를 표시했는데 화면은 변하지 않아 "내 피드백이 반영 안 됐다"고 느낄 수 있음 | UT에서 '조금 달라'만 누르고 이탈한 비율 측정 + 사후 인터뷰. 대안: 문장 없이도 verdict만 기록하고 배지 표시하는 안 A/B |
| PD-002 | Deep Report | AI가 만든 `conversationQuestion`이 응답에는 있으나 화면에 렌더되지 않고, `applyOutwardQuestionGate`도 적용하지 않는다(`outwardQuestions:'deterministic-only'`) | 이 필드를 계속 생성할 것인가(토큰 비용) / 언젠가 화면에 쓸 것인가. 쓴다면 게이트를 붙여야 함 | 현재 사용자 영향 0. 다만 향후 이 필드를 렌더하면 ended 사용자에게 outward 질문이 노출될 위험이 잠복 | 스키마에서 필드를 제거하거나, 유지 시 게이트를 선제 적용하고 회귀 fixture 추가 |
| PD-003 | Premium | Fake Door에서 "관심 표시"만 기록하고 연락처를 받지 않는다 | 알림 수요를 어떻게 회수할 것인가 (연락처 없이 재방문 유도가 가능한가) | 출시 시 재접촉 수단 없음 | 관심 표시 → 재방문 전환율 관측, 또는 익명 알림(Web Push) 도입 여부 결정 |
| PD-004 | S30 | `askedAt`은 답을 지워도 유지된다 | 전부 지운 사용자에게 S30 권유를 다시 띄울 것인가 | 마음이 바뀐 사용자에게 재진입 경로가 약할 수 있음 | 권유 카드 노출 로직 정의 후 UT |

---

## 8. NOT VALIDATED (제품 검증 필요 — QA PASS와 다름)

QA에서 "동작이 명세대로다"를 확인한 것이지, "사용자에게 가치가 있다"를 확인한 것이 아니다.

| ID | 항목 | 현재 상태 | 검증 필요 이유 |
|---|---|---|---|
| NV-001 | ₩1,900 WTP | Fake Door + 의향 설문만 존재. 실제 결제 0건 | 가격 가설이 실측된 적 없음 |
| NV-002 | Mirror Core Value | 기능 정상 동작 | '말한 나 vs 나타난 나' 대조가 실제로 유용한지 미검증 |
| NV-003 | History Retention Value | 2건 비교 리포트 정상 | 재방문·재저장 동기가 있는지 미검증 |
| NV-004 | S30 추가 질문 가치 | scope 전환 정상 | 추가 5문항을 답할 만한 인센티브인지 미검증 |
| NV-005 | selfGap(S17) 역할 인지 | 어느 축 근거로도 쓰지 않음(설계) | 사용자가 이 질문의 목적을 이해하는지 미검증 |
| NV-006 | TargetRelation 선택지 충분성 | 6종 제공 | 실제 관계 유형을 포괄하는지 미검증 |
| NV-007 | Premium Connection 가치 | 연결 2~3개 생성 | 연결이 무료 결과와 다른 값으로 읽히는지 미검증 |
| NV-008 | Compatibility 점수 해석 | 87/67 산출 + 다층 부인 문구 | 부인 문구에도 사용자가 점수를 '성공률'로 읽는지 미검증 |

---

## 9. Regression Matrix

| 영역 | 변경 영향 (v1.43) | Regression 수행 | 결과 | 관련 TC |
|---|---|---|---|---|
| Compatibility | `compatibility-v4-tense` — tense 블록·축 식별자·dimension별 허용근거 추가, `targetRelation` 제거 | comparedCount 0/2/3 경계, 6개 상태 전수, 성공확률 금지어 스캔, AI question 게이트 | PASS | COMP-001~008, SAFE-001·002·007 |
| Mirror | `relationship-v7-evidence` — 축별 허용근거 검사 신규 도입 | 3축 렌더, scope 전환, ended 재라벨, payload 허용집합 실측 | PASS | MIRROR-001~005, EVID-001~004 |
| History | `history-v3-axis` — `comparedEntries` 추가, canonical axis, relationship ref 제거 | 2건 비교, canonical axis 확인, entryId ref 성립 확인 | PASS | HIST-001~007, EVID-006·007 |
| Lifecycle | tense/allowsOutwardQuestions 필수화(400) | 6개 상태 전수 · 섹션 타이틀·질문 정책 분기 | PASS | LIFE-001~007 |
| Current Relationship | current 근거의 ended 재라벨 | S30 미입력/부분/전체·삭제·ended 전환 | PASS | CURR-001~007, MIRROR-004 |
| Premium | `deep-report-v4-tense` — tense 스캐너 추가 | ended 시제 스캔, PROD Fake Door, Preview 게이트 | PASS | PREM-001~006 |
| Observed | 변경 없음 | `test:observed` 10건 + 사진 0장 플로우 | PASS | PHOTO-001~005 |
| AI Contract | 4 Task 계약 통일 | `test:ai` 508 + E2E 6/6 + PROD marker 4종 | PASS | AI-001~006, EVID-001~008 |
| Core Correction | 변경 없음 | 추가·수정·되돌리기·새로고침·verdict 상호작용 | **부분 FAIL** | CORE-001~007 (BUG-001) |
| New Target | 변경 없음 | reset 매트릭스 전수 | PASS | TRANS-003 |
| Cache/Fingerprint | 지문에 tense·allowsOutwardQuestions 추가 | hit/miss 4케이스 실측 | PASS | CACHE-001~006 |
| Production Guard | 변경 없음 | dev route·debug·preview·UT·시크릿 | PASS | PROD-001~008 |

---

## 10. 화면별 QA 결과 요약

| 영역 (TC 섹션) | 계 | PASS | FAIL | BLOCKED | NOT TESTED | P0 | P1 | P2 | P3 | 주요 이슈 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 5.1 Home / Navigation | 8 | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | – |
| 5.2 Relationship Status / Lifecycle | 10 | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 6개 상태 전수 통과 |
| 5.3 Photos / Declared / Past | 17 | 15 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | PHOTO-006(실사진 업로드) · PAST-005(Adaptive) 미검증 |
| 5.4 Current Relationship (S30) | 7 | 7 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | – |
| 5.5 Target / Compatibility | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 점수 null 경계 정확 |
| 5.6 Mirror / Core Correction | 13 | 11 | 1 | 0 | 1 | 0 | 0 | 1 | 0 | **BUG-001**(CORE-006) · MIRROR-006 미검증 |
| 5.7 History | 8 | 7 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | HIST-008(삭제) 미검증 |
| 5.8 Premium | 6 | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | PROD Fake Door 정직 |
| 5.9 Transition | 4 | 3 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | TRANS-004 미검증 |
| 5.10 AI Task / Evidence / Safety | 21 | 21 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 계약 전부 준수 |
| 5.11 Cache / Fingerprint | 6 | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | – |
| 5.12 Error / Empty / Boundary | 7 | 4 | 3 | 0 | 0 | 0 | 0 | 0 | 3 | **BUG-002**(ERR-002) · **BUG-003**(ERR-005) · **BUG-004**(ERR-007) |
| 5.13 Responsive | 6 | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 6해상도 클린 |
| 5.14 Accessibility | 6 | 5 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | A11Y-006(포커스 트랩) 미검증 |
| 5.15 Production Guard / Privacy | 17 | 17 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 노출 0건 |
| **합계** | **148** | **138** | **4** | **0** | **6** | **0** | **0** | **1** | **3** | – |

> 이 표는 **테스트케이스(§5) 단독 집계**다. 체크리스트(§4, 84항목 — PASS 78 · FAIL 2 ·
> NOT TESTED 4)는 별도 집계이고 두 표를 합산하지 않는다.
>
> ⚠️ **2026-09-09 정정.** 초판은 화면 단위로 손집계해 `합계 138 / FAIL 5 / NOT TESTED 7`을
> 적었는데, `FAIL 5`는 ERR-007(BUG-004)을 `Past`와 `Error` 두 행에 **이중 계상**한 값이었고
> `NOT TESTED 7`은 행 합(6)과도 맞지 않았다. 개별 TC의 실제결과·상태는 하나도 바뀌지
> 않았고 **집계만** 다시 세었다(§12.1 정정 주석 참고).

---

## 11. Priority Summary

| Priority | 건수 | Release 영향 | Bug IDs |
|---|---:|---|---|
| P0 | 0 | 없음 | – |
| P1 | 0 | 없음 | – |
| P2 | 1 | Release 차단 아님. 우회 경로("원래 관찰로 되돌리기")가 같은 시트 안에 존재 | BUG-001 |
| P3 | 3 | 없음. 전부 정상 사용 경로 밖이거나 경미한 UX | BUG-002, BUG-003, BUG-004 |

---

## 12. QA Summary

### 12.1 전체 결과 (테스트케이스 기준)

```
Total TC        148
PASS            138
FAIL              4
BLOCKED           0
NOT TESTED        6
NOT APPLICABLE    0
```

> FAIL 4건이 Bug 4건과 **1:1로 대응**한다 — BUG-001→CORE-006 · BUG-002→ERR-002 ·
> BUG-003→ERR-005 · BUG-004→ERR-007.
>
> ⚠️ **2026-09-09 정정.** 초판은 `Total 100 / PASS 92 / FAIL 5 / NOT TESTED 7`로 적었고
> "BUG-003이 TC 2건에 걸침"이라고 덧붙였다. 셋 다 틀렸다: 총계는 손집계 착오였고,
> **ERR-004는 PASS이므로** BUG-003에 대응하는 FAIL은 ERR-005 하나뿐이다.
> 문서의 TC 행을 스크립트로 다시 세어 위 값을 얻었다. **개별 TC의 실제결과·상태는
> 하나도 바꾸지 않았다** — 이 문서는 Pre-Fix 실행 기록이다.

```
P0  0
P1  0
P2  1   (BUG-001)
P3  3   (BUG-002 · BUG-003 · BUG-004)
```

### 12.2 Release Verdict

**PASS**

판정 근거: `P0 = 0`, `P1 = 0`, Core Flow blocker = 0, 데이터 손실 없음,
Lifecycle/AI Safety 위반 0건. 자동 테스트 6종 baseline 완전 일치, Production Guard 전항목 통과.

단, **BUG-001(P2)은 다음 릴리스 전 처리를 권장**한다. 기능이 막히지는 않지만
"사용자 수정이 최우선"이라는 이 제품의 핵심 원칙이 걸린 자리에서 상태가 모순되기 때문이다.

### 12.3 가장 중요한 발견 TOP 5

1. **Lifecycle Safety가 실제 Production에서 완전히 작동한다.** `ended` 상태에서 AI 질문 0개, 결정론 질문 0개, 금지 표현 6종 0건이고, §04 섹션이 "그래서 뭘 맞춰볼까"→"그래서 뭐가 남았을까"로 바뀌며 질문이 outward에서 inward로 전환된다. "이 관계에서 뭘 해볼지는 이제 내가 말할 자리가 아닌 것 같아"까지 명시한다. LOCAL·PROD 동일 확인.

2. **current 근거의 ended 재라벨이 정확하다.** S30에 답한 뒤 관계가 끝나면 근거 칩이 "지금 관계"→"그때 이 관계"로 바뀌고, 혼합 상태를 "항목마다 근거 시점이 달라 (그때 2 · 이전 1)"로 정확히 요약한다. v1.42가 정의한 TENSE SAFETY ≠ JOB SAFETY가 화면에서 성립한다.

3. **AI 요청 payload에 raw status·job·stage·MBTI·자유서술이 하나도 없다.** 실제 요청 본문을 캡처해 확인했고, `ended` 문자열조차 payload 전체에 0회 등장한다. 축별 허용 근거집합도 축마다 다르게(응답한 축만 `current_relationship` 허용) 정확히 구성된다.

4. **AI가 죽어도 제품이 죽지 않는다.** `/api/ai/*`를 HTTP 500으로 막아도 결정론 Mirror 결과가 그대로 유지되고 "러비가 설명을 정리하지 못해서 확인된 신호만 보여주고 있어."로 정직하게 고지한다. 파싱 실패 시에도 동일.

5. **BUG-001 — Core Correction 상태 모순.** 수정을 저장한 뒤 "맞는 것 같아"를 누르면 `coreVerdict='ok'`가 되지만 화면은 계속 사용자 수정문과 "네가 고친 문장이야"를 보여준다. 표시 로직이 `coreCorrection`만 보고 `coreVerdict`를 보지 않기 때문이다(`src/app/mirror/page.tsx:220-221`).

### 12.4 수정이 필요한 항목

| 우선순위 | Bug | 수정 필요 이유 | 권장 범위 |
|---|---|---|---|
| P2 | BUG-001 | 사용자의 최신 의사와 화면이 모순된다. History에도 불일치가 기록될 수 있다 | `src/app/mirror/page.tsx:441` — "맞는 것 같아" 핸들러에서 `coreCorrection`이 있으면 함께 정리할지 결정(PD-001과 함께 판단). 또는 `edited` 판정을 `coreCorrection && coreVerdict!=='ok'`로 좁힘. **UI 문구만 바꾸는 미봉책은 피할 것** — 두 상태 중 무엇이 진실인지 먼저 정의해야 한다 |
| P3 | BUG-002 | 레거시 세션 마이그레이션 시 잠재 위험. `currentRelationship.signals`에는 이미 같은 방어가 있어 패턴이 확립돼 있다 | `src/state/SessionProvider.tsx` `deserialize()` — `status`/`declared.*`/`experience.important`/`experience.hardest`/`target.relation`에 enum·타입 화이트리스트 검증 추가. 잘못된 값은 미입력으로 강등 |
| P3 | BUG-003 | 계약 위반 응답에 대한 방어 부재. 실서비스 경로에서는 도달 불가 | `src/hooks/useAiNarrative.ts:100` 부근 — `cached.meta?.mode ?? null` 형태의 옵셔널 접근 |
| P3 | BUG-004 | 경미한 UX 혼란 | `src/app/profile/past/[step]` — `togglePastFactor()`가 이미 boolean을 반환하므로, false일 때 토스트 표시 |
| P3(선택) | – | 결함 아님 | dev route가 GET에 405를 반환한다(정상 라우트도 동일한 Next 기본 동작이고 본문은 비어 있다). 경로 존재 자체를 숨기려면 production 빌드에서 dev route를 제외하는 방안 검토 |

### 12.5 Product Decision Needed

§7 참조 — PD-001(빈 correction 정책), PD-002(Deep Report question 필드 존폐), PD-003(Fake Door 재접촉 수단), PD-004(S30 재권유 로직).

### 12.6 NOT VALIDATED

§8 참조 — NV-001~008. **QA PASS는 "명세대로 동작한다"이고, 제품 가치 검증이 아니다.**

### 12.7 NOT VERIFIED / 한계

정직하게 남긴다.

- **실사진 업로드 및 Vision 콘텐츠 인식 품질**: 합성 이미지만 사용했다. `test:observed`도 "실제 사진 콘텐츠 인식 품질은 이 스크립트의 검증 범위가 아니다"라고 스스로 명시한다.
- **Observed Me(S09) 화면**: 사진 0장 경로로만 진행해 방문하지 않았다.
- **Adaptive Follow-up(S16a)**: 이번 입력 조합에서 트리거되지 않았다.
- **History 삭제 / 개별 항목 상세 / Share / Lens 상세 / Onboarding**: 미검증.
- **CHANGE·UNKNOWN Mirror 상태**: UI에서 재현하지 못했다(로직은 fixture 280건이 커버).
- **키보드 포커스 트랩·명도 대비 정밀 측정**: 미검증. WCAG 정식 감사가 아니다.
- **크로스 브라우저**: Chromium만. Safari/Firefox 미검증.
- **CACHE-005(promptVersion → miss)**: 코드 정적 검증만 했다. 런타임 재현은 promptVersion 변경 = 코드 수정이 필요해 이번 범위에서 금지됐다.
- **Rate Limit 분산 정확성**: `SHARED_RATE_LIMIT_URL` 미설정으로 서버리스 다중 인스턴스에서 부정확하다(코드가 스스로 경고 로그를 남긴다). 제품 코드가 이미 `NOT VERIFIED`로 표기한 항목이며 이번 QA에서도 검증하지 않았다.
- **LOCAL ≠ PRODUCTION**: 로컬 `.env.local`에는 `NEXT_PUBLIC_PREMIUM_PREVIEW=true`, `NEXT_PUBLIC_AI_DEBUG=true`, `NEXT_PUBLIC_UT_MODE=true`가 설정돼 있어 Preview/Debug/UT가 보인다. **이는 의도된 차이이며, 프로덕션에서는 세 가지 모두 미노출임을 실제 배포에서 확인했다**(PROD-002~005).

---

## 13. 부록 — 재현용 환경 메모

- 자동 테스트 6종은 **dev 서버(:3000)가 떠 있어야** 동작한다. 없으면 전부 `ECONNREFUSED`.
- `npm run dev`와 `npm run build`를 동시에 돌리면 `.next`가 깨진다. build 전 dev 종료 → `rm -rf .next`.
- `npm run lint`는 이 환경의 SWC DLL 문제로 통과해도 exit code가 0이 아니다. `npx eslint src tests --ext .ts,.tsx,.mjs`를 직접 쓴다.
- 무비용 promptVersion 확인 경로: `history-insight`에 `allowed:[]`, `deep-report-narrative`에 `insights:[]`를 보내면 provider를 호출하지 않고 `meta`만 돌아온다.

---

*QA 실행: 2026-09-09 · 기준 commit `52f5601` · 코드/문서 수정 없음 · commit·push 없음*
