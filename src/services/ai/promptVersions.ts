/**
 * Prompt / Analysis 버전 상수 (v1.7에서 분리)
 *
 * ⚠️ **프롬프트 본문과 일부러 분리했다.**
 *
 * 이 상수들은 결과 `meta`에 들어가므로 클라이언트 쪽 fallback 생성에서도 필요하다.
 * 그런데 `promptTemplates.ts`에서 함께 export하고 있었더니, `fallback.ts` →
 * `aiService.ts`(클라이언트) 경로로 **System Prompt 전문 4개가 클라이언트 번들에 실렸다.**
 *
 * 프롬프트는 비밀은 아니지만 브라우저로 내려보낼 이유가 없다 —
 * 번들만 커지고, 안전 규칙 문구가 그대로 공개되면 injection을 설계하기 쉬워진다.
 * 그래서 버전 문자열만 여기 두고, 프롬프트 본문은 서버 쪽에만 남긴다.
 */

export const PROMPT_VERSIONS = {
  /**
   * v1.10 — 사진 1장씩 관찰만 받고(반복 판정 없음), 집계는 규칙이 한다.
   * v1(`observed-v1`)은 사진 전체를 한 번에 보내 trait을 바로 받던 방식이었다.
   */
  observed: 'observed-v2-photo',
  /** @deprecated Contract Test fixture 회귀 검증용으로만 남아 있다 */
  observedLegacy: 'observed-v1',
  /**
   * v1.7 — 길이 제한 · 관련성 필터 · userCorrection 표현 규칙 추가
   *
   * v1.42 — **v3으로 올렸다.** 모델이 받는 것이 두 군데 달라졌다(§40.11).
   *
   * ```
   * 제거   context.status  RelationshipStatus enum 원문 6종
   * 추가   context.tense   'current' | 'former'
   * 추가   프롬프트 [시제] 블록 — former 금지 표현 + 이별 원인 추론 금지
   * ```
   *
   * ⚠️ **버전을 올리지 않으면 v2 프롬프트로 만든 응답이 캐시에서 그대로 나온다.**
   * v1.27이 `deepReport`를 v2로 올릴 때와 같은 판단이다 — 같은 입력이라도 모델이
   * 받는 것이 달라졌으면 이전 응답은 다른 계약의 산물이다.
   *
   * ⚠️ v1.42부터 `promptVersion`이 **캐시 키에 실제로 들어간다**(`aiClient.cacheKey`).
   * v1.27이 "캐시 키에 promptVersion이 함께 들어가는지가 관건"이라고 적어 둔 리스크를
   * 이 버전에서 닫았다 — 아래 `deepReport` 주석 참고.
   */
  /**
   * v1.42 Blocker Closure — **v4로 다시 올렸다** (§41.6).
   *
   * v3(`relationship-v3-tense`)은 같은 v1.42 안에서 만들어졌지만 **모델이 받는 것이
   * 또 달라졌으므로** 다시 올린다. 같은 버전 문자열로 두면 v3 계약(근거 source 5종)에서
   * 만든 응답이 v4 계약(6종)의 결과인 것처럼 캐시에서 나온다 — 버전을 아끼는 것이
   * 이득이 되는 경우는 없다.
   *
   * ```
   * 추가   evidenceRefs source enum에 current_relationship
   * 추가   [근거 source] 블록 — relationship(과거) vs current_relationship(이 관계)
   * ```
   *
   * ⚠️ **v5로 한 번 더 올렸다.** v4의 [근거 source] 블록은 source 판별을
   * `relationshipSignal`의 접두어 매칭으로만 설명했는데, **어느 쪽도 아닐 때의 규칙이
   * 없었다.** 실제 Provider E2E에서 그 상태가 재현됐다 — 모델이 판단을 못 하고
   * `evidenceRefs`를 비웠고, 근거 0개인 항목은 `parseRelationshipResponse`가 버리므로
   * `parsed=0`(narrative 전멸)이 됐다. v3에서는 `parsed=1`이었다.
   *
   * v5는 안전한 기본값(`relationship`)과 "모르겠다고 refs를 비우지 마라"를 명시한다.
   * **규칙에 빈 칸을 두면 모델이 그 칸을 침묵으로 채운다.**
   *
   * ⚠️ **v6 — 진짜 원인은 source가 아니라 `axis`였다.** v5에서도 `parsed=0`이 계속됐고,
   * 관측 로그를 한 층 더 내리자(§41.14) 원인이 보였다.
   *
   * ```
   * raw=1[연락] allowed=[contact] parsed=0
   * ```
   *
   * 모델이 `axis`에 **한국어 label**(`연락`)을 넣고 있었다 — `oneOf`가 걸러 narrative가
   * 전멸했다. 프롬프트는 `"주어진 axis 그대로"`라고만 했고, 같은 객체에 `label: '연락'`이
   * 함께 들어 있어서 그 지시가 모호했다. v1.42의 긴 한국어 규칙 블록이 그 모호함을
   * 실제 오답으로 바꿨을 가능성이 높다(v3에서는 `contact`가 나왔다).
   *
   * 고치는 방향은 v1.30이 이미 정해뒀다: **파서에 별칭을 늘리지 않고 모델이 받는 어휘를
   * canonical key로 맞춘다.** 그래서 `[축 식별자]` 블록으로 허용값 5개를 명시하고 label
   * 금지를 예시로 박았다.
   *
   * ⚠️ 이 사건이 §41.14(관측 로그 확장)의 존재 이유다. `parsed`까지만 있었을 때는 원인을
   * 세 가지(모델이 안 만듦 / axis 불일치 / 근거 0개) 중에서 고를 수 없었다.
   */
  /**
   * v1.43 §46.2 — **v7로 올렸다.** 모델이 받는 것이 하나 늘었다.
   *
   * ```
   * 추가   allowedEvidenceRefs[axis]      축별 허용 근거 목록
   * 추가   프롬프트 [근거는 축마다 정해져 있다] 블록
   * ```
   *
   * v1.42까지 이 Task에는 근거 귀속 검사가 **아예 없었다.** 검사를 켜면서 목록도 함께
   * 주므로(v1.30이 정한 방향 — 파서에 별칭을 늘리지 않고 모델이 받는 어휘를 맞춘다)
   * v6 프롬프트로 만든 응답은 다른 계약의 산물이다. 캐시 키가
   * `task::promptVersion::fingerprint`(v1.42 §40.12)이므로 자동으로 무효화된다.
   */
  relationship: 'relationship-v7-evidence',
  /** v1.7 — 길이 제한 · 상대 마음 읽기 예시 강화 · uncertainty 필수 조건 명시 */
  /**
   * v1.30 — context가 dimension마다 canonical `ref`를 주고 모델은 그것을 복사한다.
   * v2까지는 `"field": "필드명"` 자유 서술이라 모델이 매번 이름을 지어냈고, 그 근거는
   * resolver가 풀지 못해 **무료 AI 설명이 화면에 한 문장도 닿지 않았다**(실측).
   */
  /**
   * v1.43 §47.1~§47.4 — **v4로 올렸다.** 모델이 받는 것이 세 군데 달라졌다.
   *
   * ```
   * 추가   context.tense                  'current' | 'former'
   * 추가   프롬프트 [시제] 블록             TENSE_CONTRACT 공유 상수
   * 추가   프롬프트 [축 식별자] 블록         canonical key 4종 + label 금지
   * 추가   allowedEvidenceRefs[dimension] dimension별 허용 근거
   * 제거   context.targetRelation         항상 null이던 죽은 필드(§47.6)
   * ```
   *
   * ⚠️ **v3 캐시를 반드시 버려야 한다.** v3으로 만든 응답에는 `ended` 사용자에게
   * 그대로 나가던 `conversationQuestion`이 들어 있다 — 서버 게이트는 새 응답에만
   * 적용되고 캐시 히트에는 응답이 없다(v1.42 §8.13).
   */
  compatibility: 'compatibility-v4-tense',
  /** v1.7 — 길이 제한 · '~수도 있어' 톤 강제 · 반복 신호 확정 금지 */
  /**
   * v1.43 §45.3 · §46.4 — **v3으로 올렸다.**
   *
   * ```
   * 추가   context.comparedEntries        비교한 두 기록의 id — history ref를 성립시킨다
   * 추가   프롬프트 [축 식별자] 블록        canonical key 5종 + label 금지
   * 변경   프롬프트 [근거] 블록             entryId+axis 형식 명시
   * 제거   evidenceRefs enum의 relationship 변화의 근거가 될 수 없다(§46.4)
   * ```
   *
   * ⚠️ v2의 `"axis": "주어진 axis 그대로"`는 v1.42가 relationship v3에서 `parsed=0`을
   * 만든 문구와 **글자 그대로 같았다.** 같은 실패가 이 Task에서 재현되고 있었는지는
   * 로그가 없어서 알 수 없었다 — v1.43이 로그를 먼저 넣은 이유다(§44).
   */
  history: 'history-v3-axis',
  /**
   * v1.9 — Cross-source Insight 설명. headline/interpretation/situation/question만 쓴다.
   *
   * v1.27 — **v2로 올렸다.** Prompt Contract를 구조화했고(OBSERVED FACTS /
   * ALLOWED CONNECTION / LIMITATION) context에 `allowedConnection`·`limitation` 두
   * 필드가 새로 들어간다. 같은 입력이라도 **모델이 받는 것이 달라졌으므로** 버전을
   * 올려야 한다 — 안 올리면 v1 프롬프트로 만든 응답이 캐시에서 그대로 나온다.
   *
   * ⚠️ `deepReportFingerprint`는 insights/declared/target/validated/deepAnswers만
   * 해싱하므로 **프롬프트 변경을 감지하지 못한다.** 캐시 키에 promptVersion이 함께
   * 들어가는지가 관건이고, 이 상수는 결과 `meta.promptVersion`으로도 나가서
   * QA에서 어느 프롬프트로 만든 문장인지 구분하게 해준다.
   */
  /**
   * v1.42 Blocker Closure — **v3으로 올렸다** (§41.6).
   *
   * `EVIDENCE_SOURCES`는 모든 Task가 공유하는 파서이므로, `current_relationship`을
   * 추가하면 deep-report의 허용 집합도 함께 넓어진다. 그런데 이 Task의 프롬프트
   * enum에는 그 값이 없었다 — **모델은 `buildDeepReportContext`가 보내는 evidence의
   * `ref`에서 그 source를 이미 눈으로 보고 있는데**(⑨ Current × Past 연결) 목록에는
   * 없으니 복사하면 안 되는 값처럼 읽혔다.
   *
   * enum을 맞춰 계약을 일치시켰다. `evidenceRefsAreSubsetOf`가 원래 Insight의 ref
   * 집합으로 계속 제한하므로 AI가 만들 수 있는 근거가 늘어나는 것은 아니다.
   */
  /**
   * v1.43 §47.5 — **v4로 올렸다.**
   *
   * ```
   * 추가   context.tense          'current' | 'former' (v1.41부터 builder 인자였지만
   *                               limitationFor를 부르는 데만 쓰였다)
   * 추가   프롬프트 [시제] 블록     TENSE_CONTRACT 공유 상수
   * ```
   *
   * ⚠️ 출력에 `scanDeepNarrativeWithTense`가 붙는다. v3 캐시를 그대로 쓰면 `ended`
   * 사용자가 **검사받지 않은 현재형 본문**을 유료 리포트에서 계속 받는다.
   */
  deepReport: 'deep-report-v4-tense',
  /**
   * v1.46 AI Lens §6 — **렌즈별 프롬프트 4개.**
   *
   * ⚠️ 세 렌즈가 하나의 버전 문자열을 공유하지 않는다. 캐시 키는
   * `task::promptVersion::fingerprint`(v1.42 §40.12)라 버전을 공유하면 MBTI 프롬프트만
   * 고쳐도 사주·별자리 캐시가 함께 죽는다 — §28이 요구하는 '변하지 않은 Lens는
   * 재호출하지 않는다'가 프롬프트 수정 한 번으로 무너진다.
   *
   * ⚠️ `deep-report-v4-tense`는 이번에 한 글자도 건드리지 않는다(§6). 새 Task가
   * 늘어난 것이지 기존 Task의 계약이 바뀐 것이 아니다.
   */
  /**
   * v2 — 출력 JSON 예시의 **필드 설명을 값 자리에서 뺐다.**
   *
   * 브라우저 실측에서 MBTI 렌즈 summary가 `이 렌즈를 관계 맥락에서 어떻게 읽는지
   * 3문장 이내`로 나왔다. 예시의 설명문을 그대로 옮겨 적은 것이고, 금지 어휘가 없어서
   * 스캐너 네 개를 전부 통과했다. 자리 표시를 꺾쇠로 바꾸고 설명은 JSON 밖 표로 옮겼다.
   *
   * ⚠️ 버전을 올리는 이유는 **캐시다.** 키가 `task::promptVersion::fingerprint`라서
   * 버전을 그대로 두면 이미 그 문장을 받은 세션이 새 프롬프트의 결과를 영영 보지
   * 못한다(v1.42 §40.12).
   */
  /**
   * v3 (v1.46.1) — **문체 계약 + 상대 상태 계약.**
   *
   * ① `targetExists` / `selfReason`을 읽는 법을 명시했다. 상대가 있는데 그 렌즈의
   *    값만 모르는 사용자에게 '상대가 없어서'라고 쓰던 문장을 막는다.
   * ② 한 칸을 쓰는 순서(확인된 것 → 장면 → 확인할 것) · 추상어 대신 장면 ·
   *    같은 틀 반복 제한 · 문장 길이 · 내부 용어 금지 · 체크포인트만 말하듯.
   *
   * ⚠️ 버전을 올리는 이유는 캐시다(v1.42 §40.12). 그대로 두면 v2 문체를 받은 세션이
   * 새 문체를 영영 보지 못한다.
   */
  premiumMbtiLens: 'premium-mbti-v3',
  premiumSajuLens: 'premium-saju-v3',
  premiumZodiacLens: 'premium-zodiac-v3',
  premiumCrossLens: 'premium-cross-lens-v3',
} as const;

export const ANALYSIS_VERSION = '1.0';
