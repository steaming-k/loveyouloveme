# 럽유럽미 — 전체 분기 QA 체크리스트 · 테스트케이스

> **이 문서는 '무엇이 갈리는가'를 기준으로 만든 QA 목록이다.**
>
> 화면 수가 아니라 **분기 수**로 센다. 같은 Route라도 상대가 있는지 · 근거가 있는지 ·
> 기록이 몇 개인지에 따라 다른 화면이 나오고, 사고는 거의 항상 그 갈림길에서 난다.

| 항목 | 내용 |
|---|---|
| 문서 종류 | QA 체크리스트 + 테스트케이스 (실행 가능) |
| 대상 버전 | **v1.46.2** (구현 `dc29d64` · 동결 `90e680d`) |
| 최근 실행 | 2026-09-11 · dev(localhost:3000) 393×852 · Production(loveyouloveme.vercel.app) |
| 관련 문서 | [기능명세_현행](./기능명세_현행.md) · [versions/README](./versions/README.md) |
| 실행 결과 | [§4 요약](#4-이번-실행-결과-2026-09-11) · [§5 결함](#5-발견된-결함) |

---

## 0. 이 문서를 쓰는 법

QA는 세 겹이고, **위에서 걸리면 아래로 내려가지 않는다.**

```
①  자동 회귀      명령 9개 · 약 3분      → 계산·계약·안전 경계
②  분기 스모크    수동 12건 · 약 20분    → 화면이 실제로 그 상태를 보여주는가
③  릴리스 게이트  문서·동결·배포·재확인   → 내보낼 수 있는 상태인가
```

- **PR 단위**면 ①만 돌린다.
- **릴리스 전**이면 ①②③ 전부.
- **특정 영역만 고쳤으면** ① 전체 + 그 영역의 §3 테스트케이스만.

⚠️ **자동이 덮는 것을 수동으로 다시 하지 않는다.** §3의 `방식` 칸이 `자동`이면 그건
스크립트가 매번 검사한다 — 수동 QA 시간은 `수동` 칸에만 쓴다.

---

## 1. 릴리스 체크리스트

### 1.1 자동 회귀 (터미널 A `npm run dev` · 터미널 B에서 실행)

- [ ] `npm run typecheck` → 0
- [ ] `npx eslint src tests --ext .ts,.tsx,.mjs` → 0 (⚠️ `npm run lint`는 종료 코드가 0이 아니다)
- [ ] `npm run test:ai` → **577**
- [ ] `npm run test:lens` → **197**
- [ ] `npm run test:premium` → **233**
- [ ] `npm run test:relationship-evidence` → **286**
- [ ] `npm run test:trust` → **205**
- [ ] `npm run test:lifecycle` → **144**
- [ ] `npm run test:history` → **100**
- [ ] `npm run test:observed` → **10**
- [ ] `npm run test:nav` → **40**
- [ ] `npm run test:ai:e2e` → **10/10** (실제 Provider · Key 없으면 SKIPPED로 보고된다)
- [ ] `npm run build` → **64/64** (⚠️ dev 서버를 끄고 돌린다 — `.next`를 공유한다)

> 숫자가 **줄면 실패**다. 늘어난 경우에도 어떤 검사가 늘었는지 확인하고 이 표를 갱신한다.

### 1.2 분기 스모크 (수동 · 393×852)

각 항목은 §3의 테스트케이스 ID를 가리킨다. 12건이면 주요 갈림길을 한 번씩 지난다.

- [ ] **B-01** 궁합 결과가 점수·근거와 함께 나온다
- [ ] **B-02** 상대 정보가 없으면 점수를 만들지 않고 `?`로 말한다
- [ ] **B-05 / B-06** Mirror 정상 · 관측 부족 상태
- [ ] **B-03** 상대가 없으면 First Contact 리포트로 간다
- [ ] **D-01 / D-02** Premium 자격 O에는 가격이, X에는 '신호 부족' 안내가 나온다
- [ ] **D-05** 상대는 있고 값만 모를 때 `상대가 없어서` 카피가 **0**이고 안내는 1회
- [ ] **D-07 / D-08** 상대 없음 + 근거 충분 = 자격 O · 근거 소비됨 = 자격 X
- [ ] **E-03** 기록 2건 이상에서 변화 리포트가 비교를 보여준다
- [ ] **F-01 / F-03** 뒤로가기가 **진입한 화면**으로 간다(고정 부모 아님)
- [ ] **F-02 / F-04** 돌아온 화면이 읽던 위치다(±50px)
- [ ] **G-04** 360px에서 가로 스크롤 0
- [ ] **G-02 / H-01** 없는 주소는 404 화면 · dev 라우트는 Production에서 404

### 1.3 릴리스 게이트

- [ ] `docs/기능명세_현행.md` 헤더 버전·회귀 기준표 갱신
- [ ] 동결본을 **구현 커밋의 blob에서** 추출 → `diff 0` · 줄수 · bytes · blob · SHA-256 기록
- [ ] 이전 동결본 **무수정** 확인 (`git status`에 안 뜨면 통과)
- [ ] `git push origin main` → `git rev-list --left-right --count HEAD...origin/main` = `0 0`
- [ ] 배포 반영 확인(변경된 코드의 표식이 Production 번들에 있는가)
- [ ] Production 스모크: §1.2에서 **최소 4건**(B-01 · D-05 · F-01 · G-02)
- [ ] dev 라우트 Production 404 재확인 (**H-01**)

---

## 2. 테스트 픽스처

세션은 `localStorage`의 `lym.session.v1`, 기록은 `lym.history.v1`에 있다. 개발자 도구
콘솔에서 아래처럼 갈아끼우면 **분기마다 퍼널을 다시 걷지 않아도 된다.**

| ID | 이름 | 정의 | 무엇을 보려고 |
|---|---|---|---|
| **F0** | 빈 세션 | `localStorage.removeItem('lym.session.v1')` | 첫 진입 · 결과 화면의 무근거 방어 |
| **F1** | 저데이터 | declared 4/5 · experience 비움 | 관측 부족(E1·E3) |
| **F2** | 상대 없음 · 근거 소비 | target 비움 · experience 있음 | Premium 자격 **X** |
| **F3** | 상대 없음 · 근거 충분 | target 비움 · `experience.skipped=true` · declared 5축 | Premium 자격 **O** (No Target 불변식) |
| **F4** | 상대 부분정보 | target 축만 · `mbti=null` · 생년월일 없음 | 렌즈 3종 `나만` + 안내 1회 |
| **F5** | 상대 MBTI만 | F4 + `target.mbti='ENFP'` | MBTI만 `둘이 함께` |
| **F6** | 전체 데이터 | 내 MBTI·생년월일 + 상대 MBTI·생년월일 + 기록 2건 | pair 렌즈 · 변화 리포트 |

**시드 방법** (데스크톱 폭에서 좌측 패널 `한사랑 샘플 세션 불러오기`로 기본형을 만든 뒤):

```js
// 기본형 보관
localStorage.setItem('qa.base', localStorage.getItem('lym.session.v1'));

// 예) F4 — 상대는 있는데 MBTI·생년월일을 모른다
const s = JSON.parse(localStorage.getItem('qa.base'));
s.target.mbti = null;
s.target.birthProfile = { date: null, time: null, timeUnknown: false, calendarType: 'solar', location: null };
localStorage.setItem('lym.session.v1', JSON.stringify(s));
location.reload();
```

⚠️ **Premium 열람 기록**은 `lym.premium-preview-unlock.v1`에 분석 id로 남는다. 자격
화면(Paywall)을 다시 보려면 이 키를 지운다.

⚠️ 스크롤 위치(`lym.scroll.v1:*`) · 방문 경로(`lym.nav.v1`) · 펼침 상태(`lym.open.v1:*`)는
**sessionStorage**다. 탭을 닫으면 사라진다 — 복원 테스트는 같은 탭에서 한다.

---

## 3. 테스트케이스

`방식` — **자동**: 스크립트가 매번 검사(§1.1) · **수동**: 사람이 화면에서 확인 ·
**혼합**: 판정은 자동, 화면 문구는 수동.

### A. 진입 · 입력 퍼널

| ID | 분기 | 전제 | 절차 | 기대 | 방식 |
|---|---|---|---|---|---|
| A-01 | 첫 진입 | F0 | `/` 열기 | 스플래시(관찰 시퀀스) → 탭하면 온보딩 | 수동 |
| A-02 | 온보딩 | F0 | `/onboarding` | 4장 · `건너뛰기` 노출 | 수동 |
| A-03 | 관계 상태 4분기 | F0 | `/status` | 솔로(경험 무/유) · 연애 중 · 기타 선택지가 모두 보이고, **판정이 아니라 쓰임이 달라진다**는 안내 | 수동 |
| A-04 | 사진 0장 | F0 | `/profile/photos` | 사진 없이도 진행 가능 안내 | 수동 |
| A-05 | Observed 결과 | F6 | `/profile/observed` | 근거 문장 + 확신 낮은 항목에 `관측 정보 부족` 칩 | 혼합 |
| A-06 | 질문 스텝 이동 | F6 | `/profile/declared/1` → 값 선택 → `다음` → 뒤로 | 직전 스텝 + **고른 값 유지** | 수동 |
| A-07 | Adaptive 추가 질문(대기) | F6에서 `experience.adaptive` 삭제 | `/profile/past/2` → `다음` | 모순 축에 대한 추가 질문 1개 | 수동 |
| A-08 | Adaptive 직접 진입 | 〃 | 주소창으로 `/profile/past/adaptive` | 질문이 떠야 한다 | 수동 · **[DEF-02](#5-발견된-결함)** |
| A-09 | 프로필 결과 | F6 | `/profile/result` | 관측/답변/경험 근거가 각각 어디서 왔는지 보인다 | 수동 |
| A-10 | 상대 입력 | F6 | `/target` | 모르는 항목을 비워둘 수 있다(강제 입력 0) | 수동 |
| A-11 | 경험 없음 경로 | F3 | `/profile/past/none` | 경험이 없어도 다음 단계가 막히지 않는다 | 자동(`test:lifecycle`) |

### B. 결과 화면

| ID | 분기 | 전제 | 절차 | 기대 | 방식 |
|---|---|---|---|---|---|
| B-01 | 궁합 정상 | F6 | `/compatibility` | 동기화율 + 비교한 신호 수 + 근거. `연애 성공확률이 아니야` 고지 | 혼합 |
| B-02 | 관측 정보 부족(E3) | F0/F1 | `/compatibility` | 점수 `?` · `입력 0/4` · **비교하지 못한 항목**을 이름으로 말한다 | 수동 |
| B-03 | 상대 없음 | F2/F3 | `/first-contact` | `상대가 없어도 관찰할 수 있는 것` 리포트 | 수동 |
| B-04 | 상대 있음인데 First Contact | F6 | `/first-contact` | `/compatibility`로 조용히 이동 | 수동 |
| B-05 | Mirror 정상 | F6 | `/mirror` | 차이/일치 수 + 항목별 대조 + 가장 중요한 관찰 | 혼합 |
| B-06 | Mirror 관측 부족(E1) | F1 | `/mirror` | `아직 관측 기록이 부족해` + 채울 항목 CTA. **판정을 만들지 않는다** | 수동 |
| B-07 | Mirror 불가 | declared 전부 없음 | `/mirror` | `/home`으로 이동(빈 화면 방치 0) | 수동 |
| B-08 | Mirror Teaser 불가(E5) | F1 | `/mirror/teaser` | `비교하긴 어려워` + 기준은 기록해둔다는 안내 | 수동 |
| B-09 | 궁합 공유 카드 | F6 | `/share/compatibility` | 카드 렌더 · 상대 정보 포함 여부는 **사용자가 켠다** | 수동 |
| B-10 | Mirror 공유 카드 | F6 | `/mirror` → `공유` | 카드 렌더 · 상대 정보/답변 원문 없음 | 수동 |
| B-11 | Mirror 공유 카드 새로고침 | F6 | `/share/mirror`에서 새로고침 | 카드가 유지돼야 한다 | 수동 · **[DEF-01](#5-발견된-결함)** |
| B-12 | 근거 없는 단정 차단 | 다수 | — | 근거가 없으면 시간적 변화·확신 문구를 쓰지 않는다 | 자동(`test:trust`) |

### C. 렌즈 (Add-on)

| ID | 분기 | 전제 | 절차 | 기대 | 방식 |
|---|---|---|---|---|---|
| C-01 | 렌즈 목록 | F6 | `/lens` | CORE > SUPPORTING > ENTERTAINMENT 위계가 화면에 보인다 | 수동 |
| C-02 | MBTI 둘 다 있음 | F6 | `/lens/mbti` | `나 INFJ × 상대 ENFP` 비교 + **동기화율 미반영** 고지 | 수동 |
| C-03 | MBTI 내 것만/없음 | F4 / F0 | `/lens/mbti` | self 전용 화면 / 입력 유도(없는 유형을 정하지 않는다) | 혼합 |
| C-04 | 사주 단독 화면 | F6 | `/lens/saju` | **엔진 미연결 안내**(설계상 — 일주 계산은 Premium 렌즈에 있다) | 수동 |
| C-05 | 별자리 | F6 | `/lens/astrology` | 태양궁 + 관계에서 이야기해볼 주제 | 수동 |
| C-06 | 출생정보 입력 | F4 | `/lens/birth` | 나/상대 각각 입력 · 시간 모름 허용 | 수동 |
| C-07 | 렌즈 허브 | F6 | `/compatibility/lenses` | CORE 점수를 먼저 보여주고 렌즈는 참고로 | 수동 |
| C-08 | 별자리 legacy | — | `/lens/zodiac` | `/lens/astrology`로 redirect | 수동 |

### D. Premium

| ID | 분기 | 전제 | 절차 | 기대 | 방식 |
|---|---|---|---|---|---|
| D-01 | 자격 O · Paywall | F6 (unlock 키 삭제) | `/premium?source=compatibility` | 가격 1회 + CTA + 닫기 경로 | 수동 |
| D-02 | 자격 X | F2 | `/premium?source=first_contact` | `아직 연결할 수 있는 신호가 부족해` · **가격·CTA 0** | 수동 |
| D-03 | 열람 → 리포트 | F6 | CTA → success → preparing → report | 챕터가 실제 근거로 채워진다(filler 0) · `결제가 완료` 문구 0 | 혼합 |
| D-04 | 렌즈 pair | F6 | 리포트 하단 | MBTI·사주·별자리 `둘이 함께` + Cross-Lens | 수동 |
| D-05 | 상대 부분정보 | F4 | 리포트 하단 | 렌즈 3종 `나만` · `상대가 없어서` **0** · 안내 **1회** | 수동 |
| D-06 | 상대 MBTI만 | F5 | 리포트 하단 | MBTI만 `둘이 함께`, 사주·별자리 `나만` | 수동 |
| D-07 | 상대 없음 + 근거 충분 | F3 | `/home` | Premium 번들 카드 노출 = 자격 O | 수동 |
| D-08 | 상대 없음 + 근거 소비 | F2 | `/home` | 번들 없음. **막은 이유는 상대가 아니라 근거** | 혼합(`PARTIAL-09/10`) |
| D-09 | 출생시간 미입력 | F6에서 `timeUnknown=true` | 리포트 | 사주·별자리 pair가 **막히지 않는다** | 자동(`PARTIAL-05`) |
| D-10 | AI 실패 | — | 렌즈 AI 500/파싱 실패 | 결정론 렌즈 본문은 그대로 · 카드 완결 | 자동(`test:premium`·`test:ai`) |
| D-11 | 내부 용어 노출 | — | 리포트 전체 | `planning`·`pair`·`self` 같은 내부 코드 **0** | 자동(`AI-LENS-ENUM`·`STYLE`) |
| D-12 | 가격 표기 | F6 | Paywall | 번들 기준 **한 번만** 보인다 | 자동(`LENS-02`) |

### E. Relationship History

| ID | 분기 | 전제 | 절차 | 기대 | 방식 |
|---|---|---|---|---|---|
| E-01 | 기록 0건 | `lym.history.v1 = []` | `/history` | `아직 너를 오래 관찰하진 못했어` + 저장 유도 | 수동 |
| E-02 | 기록 1건 | 1건 | `/history/report` | `아직 비교할 기록이 부족해` — **가짜 변화 0** | 수동 |
| E-03 | 기록 2건+ | 2건 | `/history` · `/history/report` · `/history/{id}` | 변화 요약 · PAST↔NOW 비교 · `이때와 지금의 차이` | 수동 |
| E-04 | Solo/Couple 혼재 | mixed | `/history/{id}` | **같은 audience끼리만** 비교(솔로 기록에 커플 자리 0) | 자동(`test:history`) |
| E-05 | 저장 직후 | F6 | Mirror → `내 관찰 기록에 저장` | Change Moment 화면 · 중복 저장 시 안내 | 수동 |

### F. Navigation (v1.46.2)

| ID | 분기 | 전제 | 절차 | 기대 | 방식 |
|---|---|---|---|---|---|
| F-01 | 결과 → 상세 → 뒤로 | F6 | 궁합 → 렌즈 허브 → 사주 → 뒤로 | **렌즈 허브**(부모 `/lens` 아님) | 수동 + 자동(NAV-01b) |
| F-02 | 스크롤 복원 | F6 | 궁합 1200 → Premium → 뒤로 | ±50px 이내 · 같은 내용이 화면 위 | 수동 |
| F-03 | Premium 닫기 | F6 | Home 번들 → 리포트 → 뒤로 | **Home**(고정 `/compatibility` 아님) | 수동 + 자동(NAV-03) |
| F-04 | 리포트 위치 · 펼침 | F6 | 별자리 펼치고 스크롤 → 나갔다 재진입 | 위치 + 펼침 유지 | 수동 + 자동(NAV-15) |
| F-05 | 기록 상세 → 목록 | 2건 | `/history` → 상세 → 뒤로 | 목록 · 읽던 위치 | 수동 + 자동(NAV-05) |
| F-06 | 입력 스텝 뒤로 | F6 | 질문 2 → 뒤로 | 질문 1 + 값 유지 | 수동 + 자동(NAV-06) |
| F-07 | 직접 진입 fallback | 새 탭 | `/lens/saju` 직접 열고 뒤로 | `/lens`로 가고 **history가 늘지 않는다** | 수동 + 자동(NAV-07) |
| F-08 | 가드 redirect | — | `/mirror` 직접 진입(데이터 없음) | 깊이가 부풀지 않아 뒤로가 앱 밖으로 나가지 않는다 | 자동(NAV-08) |
| F-09 | 로딩 화면 | F6 | 상대 입력 → 관찰 → 결과 → 뒤로 | 로딩이 아니라 **입력 화면** | 자동(NAV-08b) |
| F-10 | 브라우저 back | F6 | 앱 back과 같은 흐름을 브라우저 back으로 | 결과가 같다 | 수동 |
| F-11 | back/forward 왕복 | F6 | back↔forward 4회 | 루프 0 · 방문 깊이 안정 | 수동 + 자동(NAV-10) |
| F-12 | reduced motion | OS 설정 ON | F-02 반복 | 복원 동작 동일 · 불필요한 전환 0 | 수동 |
| F-13 | 새 상대 격리 | F6 → 새 상대 | 새 분석 후 결과 | 이전 분석의 스크롤/펼침이 넘어오지 않는다 | 자동(NAV-12) |

### G. 엣지 · 환경

| ID | 분기 | 전제 | 절차 | 기대 | 방식 |
|---|---|---|---|---|---|
| G-01 | Legacy Route | — | `/compatibility/good` · `/mirror/insight` · `/lens/zodiac` | 각각 `#good` · `#core-insight` · `/lens/astrology` | 수동 |
| G-02 | 없는 주소 | — | `/nope-this-page` | 404 화면 + 홈으로 가기 | 수동 |
| G-03 | AI 오류(E2) | — | `/profile/analyzing?error=1` | 재시도 안내 · **고른 사진은 그대로** | 수동 |
| G-04 | 360px | F6 | 주요 4화면 | 가로 스크롤 **0** | 수동 |
| G-05 | reduced motion | 설정 ON | 결과 화면 | 애니메이션 없이도 본문이 전부 보인다(투명 0) | 수동 |
| G-06 | 데스크톱 | — | 임의 화면 | 393×852 프레임 + 개발 패널(프로덕션 미노출) | 수동 |
| G-07 | sessionStorage 차단 | 프라이빗 모드 | 결과 → 상세 → 뒤로 | 복원만 안 될 뿐 **앱이 죽지 않는다** | 혼합(코드상 try/catch) |

### H. 안전 · 프라이버시

| ID | 분기 | 전제 | 절차 | 기대 | 방식 |
|---|---|---|---|---|---|
| H-01 | dev 라우트 | Production | `/api/dev/*` · `/api/ai/contract-test` | 전부 **404** | 수동(curl) |
| H-02 | 개발 패널 | Production | 데스크톱 폭 | 계산값·화면 점프·초기화 버튼 **미노출** | 수동 |
| H-03 | 저장소 내용 | — | `lym.nav.v1` · `lym.scroll.v1:*` · `lym.open.v1:*` | 경로·숫자·항목 id만. 답변·상대 정보 0 | 자동(NAV-14b) + 수동 |
| H-04 | Analytics | — | 이벤트 payload | MBTI 원문·생년월일·이름·자유서술 0 | 자동(`test:lifecycle` enum guard) |
| H-05 | 공유 카드 | F6 | 두 공유 카드 | 상대 정보는 **사용자가 켤 때만** 들어간다 | 수동 |

---

## 4. 이번 실행 결과 (2026-09-11)

**대상**: v1.46.2 `dc29d64` · dev 393×852(일부 360×780) · Production 스모크 포함.

### 4.1 자동 회귀 — 전부 PASS

| suite | 결과 | suite | 결과 |
|---|---|---|---|
| `test:ai` | 577 | `test:trust` | 205 |
| `test:lens` | 197 | `test:lifecycle` | 144 |
| `test:premium` | 233 | `test:history` | 100 |
| `test:relationship-evidence` | 286 | `test:observed` | 10 |
| `test:nav` | 40 | `test:ai:e2e` | 10/10 |
| `tsc` / `eslint` | 0 / 0 | `build` | 64/64 |

### 4.2 분기 스모크 — 실측

| 그룹 | 실행 | PASS | 비고 |
|---|---|---|---|
| A 진입·입력 | 10 | 9 | A-08 실패 → DEF-02 |
| B 결과 | 11 | 10 | B-11 실패 → DEF-01 |
| C 렌즈 | 8 | 8 | C-04는 '엔진 미연결'이 **현재 사양** |
| D Premium | 8 | 8 | 자격 O/X · 부분정보 · MBTI만 전부 기대대로 |
| E History | 5 | 5 | 0건 / 1건 / 2건 분기 |
| F Navigation | 13 | 13 | 복원 오차 0~8px |
| G 엣지·환경 | 7 | 7 | 360px 가로 오버플로 0 |
| H 안전 | 5 | 5 | dev 라우트 6종 Production 404 |
| **합계** | **67** | **65** | 실패 2건은 §5 |

**주요 실측값**

```
궁합 결과(정상)        동기화율 55 · 비교 4/4
궁합 결과(정보 부족)   ? · 입력 0/4 · 비교하지 못한 항목 4개를 이름으로
Mirror                 차이 2 · 일치 2      Mirror(부족)  판정 0 · 채울 항목 CTA
Premium 자격 O         번들 카드 노출       자격 X        '신호 부족' · 가격 0
상대 부분정보          렌즈 3종 '나만' · 안내 1회 · 잘못된 상태 카피 0
상대 MBTI만            MBTI '둘이 함께' + 사주·별자리 '나만'
기록 0 / 1 / 2건       빈 화면 / '비교 부족' / PAST↔NOW 비교
스크롤 복원            1200→1208 · 1000→1007 · 600→600 · 2411→2411 · (reduced) 1100→1108
360px                  가로 오버플로 0 (궁합 · Mirror · 변화 리포트 · Premium)
```

### 4.3 Production 스모크 — PASS

`/home` → 궁합(Revisit) → Mirror → 뒤로(위치 복원) · Home 번들 → 리포트 → 뒤로(=Home) →
재진입(위치·펼침 유지) · `/lens/saju` 직접 진입 → fallback · 브라우저 back 일치 ·
dev 라우트 6종 404 · 개발 패널 미노출.

---

## 5. 발견된 결함

두 건 모두 **원인이 하나**다: 가드가 `localStorage` 복원(hydration) **전에** 돌아서,
아직 비어 있는 세션을 '데이터가 없다'로 읽고 다른 화면으로 보낸다. 앱 안에서 이동할
때는 리로드가 없어 드러나지 않고, **새로고침·주소창 직접 진입**에서만 나타난다.

| ID | 심각도 | 화면 | 증상 | 재현 |
|---|---|---|---|---|
| **DEF-01** | P2 | `/share/mirror` | 직접 진입·새로고침이 **항상** `/mirror`로 튕긴다(카드 볼 수 있는 상태여도) | F6 → `/mirror` → `공유`(정상) → **F5** → `/mirror` |
| **DEF-02** | P2 | `/profile/past/adaptive` | 추가 질문이 대기 중인데 직접 진입하면 `/profile/past/3`으로 넘어간다 | F6에서 `experience.adaptive` 삭제 → 주소창으로 `/profile/past/adaptive` |

**같은 성질의 코드** (가드 + `HydrationGate` 없음): `share/mirror` · `profile/past/adaptive` ·
`first-contact`(현재는 pre-hydration 값이 `couple`이 아니라 잘못 튕기지 않는다).

**제안 수정** — 판정식은 건드리지 않는다. 세션 복원이 끝난 뒤에만 가드를 돌린다:
`SessionProvider`의 `hydrated`를 조건에 넣거나(`if (!hydrated) return;`), 다른 화면들처럼
`HydrationGate`로 감싼다. 회귀 검사는 각 화면 **직접 진입 → 화면 유지**로 고정한다.

⚠️ 이번 릴리스(v1.46.2)의 변경으로 **생긴** 결함이 아니다. `router.replace` → `useNavReplace`
치환은 이동 수단만 바꿨고, 가드가 도는 시점은 그대로다.

---

## 6. 미검증 · 한계 (NOT VALIDATED)

- **렌즈 AI의 사용자 가치** — UT 미실시. 문체·밀도는 계약과 필터로만 고정돼 있다.
- **별자리 pair의 AI unit 수 변동** — 회차에 따라 6→2까지 줄어든다. 안전 필터는 낮추지
  않았고 결정론 본문은 유지되므로 릴리스 블로커로 보지 않는다.
- **실기기 QA** — 전부 데스크톱 브라우저의 393×852 / 360×780 에뮬레이션이다. iOS Safari의
  주소창 높이 변화(100dvh)·안전영역은 실기기에서 한 번 봐야 한다.
- **스크린리더** — 정적 A11y 검사(Accordion·heading 순서)는 자동이지만, 실제 낭독 흐름은
  수동 검증 이력이 없다.
- **다중 탭 동시 사용** — 같은 브라우저의 두 탭에서 서로 다른 분석을 동시에 진행하는
  경우는 테스트하지 않았다(세션은 localStorage 공유, 내비·스크롤은 탭별).
- **사주 단독 화면(`/lens/saju`)** — '엔진 미연결' 안내가 현재 사양이다. Premium 렌즈의
  일주 계산과 **다른 화면**이라는 점이 사용자에게 혼동될 수 있다(제품 판단 필요).
