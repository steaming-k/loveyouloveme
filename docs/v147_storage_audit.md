# v1.47 Phase A — 현재 저장 구조 감사 (코드 수정 전)

> 기준: `feat/v147-supabase-persistence` 분기 시점 = `4cbefd8` (v1.46.4 WIP).
> 이 문서는 **코드를 바꾸기 전에** 작성했다. 결론은 맨 아래 "v1.47 결정"에 있다.

## 1. 저장소 목록

| key | 저장소 | 도메인 데이터 | read path | write path | schema/version | 파괴적 reset |
|---|---|---|---|---|---|---|
| `lym.session.v1` | localStorage | SessionAnswers 전체 — status · 사진 메타(원본 X) · observedAnalysis · declared · experience · currentRelationship · **target(4축·MBTI·출생정보·preferences·events)** · savedQuestions · coreVerdict/Correction · mbti · birthProfile · deepAnswers · deepInsightFeedback · currentAnalysisMeta · completed | `SessionProvider` hydrate effect → `deserialize()`(값 sanitize) | `SessionProvider` answers effect(매 변경 직렬화) | key 접미사 v1 · 필드 부재로 구버전 판별(명시 schema_version 없음) | `resetTargetContext()`가 target·currentRelationship·savedQuestions·completed.compatibility를 **덮어씀** · `reset()/deleteAllData()`가 전체 비움 |
| `lym.history.v1` | localStorage | RelationshipHistoryEntry[] (Mirror/Solo 시점 스냅샷) | `historyRepository.getHistory()` ← `HistoryProvider` | `addHistoryEntry`(analysisId 중복 방지) · `updateHistoryEntry` · `deleteHistoryEntry` · `clearHistory` | v1 · optional 필드로 진화 | 사용자가 '기록도 함께 삭제' 체크 시에만 |
| `lym.premium-intent.v1` | localStorage | 결제 의향 클릭 | `premiumIntentStore` | 동일 | v1 | resetTargetContext · 전체 삭제 |
| `lym.ut.deep.v1` | localStorage | Deep Report UT 응답 | `deepReportUtStore` | 동일 | v1 | 전체 삭제 |
| `lym.analytics.v1` | localStorage | 로컬 analytics 로그(외부 전송은 sanitize 후) | `analytics.ts` | 동일 | v1 | — |
| `lym.consent.v1` | localStorage | GA4 동의 상태 | `analyticsConsent.ts` | 동일 | v1 | — |
| `lym.premium-preview-unlock.v1` | sessionStorage | Preview unlock (`feature × funnelAnalysisId`) | `premiumAccess.ts` | 동일 | v1 | resetTargetContext · 전체 삭제 · 탭 종료 |
| `lym.premium.variant` | sessionStorage | 가격 variant 고정 | `premiumVariant.ts` | 동일 | — | 탭 종료 |
| `lym.nav.v1` / `lym.scroll.v1:*` / `lym.open.v1:*` | sessionStorage | 네비 경로 · 스크롤 · 펼침 상태 | 각 lib | 동일 | v1 | 탭 종료 |
| `lym.ai.session` | sessionStorage | AI 요청 세션 토큰(rate limit용) | `aiClient.ts` | 동일 | — | 탭 종료 |
| (메모리) AI 캐시 | 모듈 메모리 | task×fingerprint → AI 결과 | `aiClient.ts` | 동일 | promptVersion이 fingerprint에 포함 | 새로고침 · `clearAiCache()` |

## 2. 결과(analysis)는 어디에 있나

- **Compatibility / Mirror / Premium Deep Report는 저장하지 않는다.** 세션에서 매번 순수 함수로 재계산한다(`buildCompatibility` · `buildMirrorReport` · `buildRelationshipDeepReport`). AI 문장은 메모리 캐시뿐이라 새로고침하면 다시 요청된다.
- 저장되는 "당시 결과"는 `lym.history.v1`의 스냅샷뿐이다. 이 스냅샷은 설계상 자유서술·사진 원문·생년월일을 넣지 않는다.
- 사진 AI 관찰(`observedAnalysis`)만 재계산 불가라 세션에 저장된다.

## 3. 핵심 질문

| 질문 | 답 | 근거 |
|---|---|---|
| 새로운 사람 분석 시 기존 Target을 덮어쓰는가? | **예.** `resetTargetContext()`가 `target: createEmptyTargetProfile()`로 교체한다. 이전 상대의 4축·사건·현재 관계 근거·저장 질문은 어디에도 남지 않는다(History는 self 스냅샷이라 상대 정보를 담지 않음). | `SessionProvider.tsx` resetTargetContext · `home/page.tsx` '새로운 사람과 궁합 보기' |
| Target stable id가 존재하는가? | **아니오.** TargetProfile에 id가 없다. 상대 단위 식별자에 가장 가까운 것은 `currentAnalysisMeta.funnelAnalysisId`(random UUID, reset마다 재발급)이지만 KPI/entitlement 키이지 상대 id가 아니다. | `types/index.ts` TargetProfile · SessionAnswers.currentAnalysisMeta |
| Event가 Target과 안정적으로 연결되는가? | **구조적으로만.** events는 `target.events` 배열 안에 있어 같은 객체와 함께 비워진다(누수는 없음). 그러나 target id가 없으므로 "어느 상대의 사건인가"를 저장소 밖에서 가리킬 수 없다. event id는 `evt-<time36>-<rand36>` 형식(UUID 아님)이고 세션 안에서만 안정적이다. | `addRelationshipEvent` · `createEmptyTargetProfile` |
| analysis result가 overwrite되는가? | 결과를 저장하지 않으므로 "덮어쓰기"라기보다 **입력이 바뀌면 재계산된 결과로 대체**된다. History 스냅샷은 analysisId 기준 중복 저장을 막을 뿐 기존 항목을 덮어쓰지 않는다(`updateHistoryEntry`는 verdict/correction 수정 경로). | `historyRepository.addHistoryEntry` |

## 4. Supabase 연결 여부

- 코드: `@supabase/*` 의존성 없음, `SUPABASE_*`/`NEXT_PUBLIC_SUPABASE_*` env 참조 없음, auth 없음.
- `.env.example` · `.env.local`: Supabase 키 없음.
- `docs/supabase-info.md`: project id `tcltmqertkbbdpqtkola`와 publishable key가 적혀 있다.
- **실측(2026-09-14)**: `tcltmqertkbbdpqtkola.supabase.co` DNS 조회가 **NXDOMAIN**. 프로젝트가 삭제·일시정지됐거나 id가 맞지 않다. dev/staging/production 구분도 문서에 없다.
- 결론: **연결 가능한 Supabase 프로젝트 없음** → §36 경로(scaffold까지, remote migration 없음).

## 5. v1.47 결정

1. **Source of truth**
   - Guest: 지금과 동일하게 localStorage(`lym.session.v1` · `lym.history.v1`)가 유일한 원천이다.
   - Authenticated: Supabase가 영속 원천, localStorage는 앱 상태/캐시로 **계속 유지**한다. 이번 단계에서는 로그인해도 로컬 흐름이 그대로 돌고, 클라우드 쓰기는 사용자가 승인한 migration(명시적 저장)에서만 일어난다.
2. **SessionAnswers 모양은 바꾸지 않는다.** AI fingerprint · fixture가 세션 모양에 묶여 있어 필드 추가가 회귀 위험이다. 상대 id는 별도 로컬 저장소 `lym.targets.v1`(target registry)에 둔다.
3. **새로운 사람 분석은 더 이상 이전 상대를 잃지 않는다.** `resetTargetContext()` 직전에 현재 상대 맥락(target · currentRelationship · savedQuestions · funnelAnalysisId)을 registry에 보관하고 새 activeTargetId를 발급한다. 세션을 비우는 기존 동작은 그대로다(점수·Mirror·화면 동일).
4. **event stable id**: 로컬 event id는 그대로 두고, 클라우드 id는 `(targetId, localEventId)`에서 결정론적 UUID로 만든다 → 재시도·재로그인에도 같은 행.
5. **analysis_runs**: 이번 migration 대상은 History 스냅샷(이미 privacy 경계가 설계된 "당시 결과"). Deep Report 결과는 재계산 구조라 저장 API(원문 금지 guard 포함)만 두고 자동 저장은 하지 않는다.
6. 로컬 데이터 파괴 위험: migration은 로컬을 **읽기만** 한다 → STOP 조건 해당 없음.
