import type { LovyPose } from '@/data/lovy';
import type { PremiumChapter, PremiumChapterKind, RelationshipTense } from '@/types';

/**
 * Premium Deep Report — 러비의 진행자 역할 (v1.45 · §13 · §17 · §18 · §19 · §22)
 *
 * ══ 이 파일이 무엇인가 ═════════════════════════════════════════════════════
 *
 * v1.45 Chapter Engine 실측 후에 남은 문제는 분량도 구조도 아니었다:
 *
 * ```
 * 헤더           '러비가 이번 관찰에서 연결한 이야기 8개'   ← 러비는 글자로만 있었다
 * Chapter 8개    캐릭터 0개
 * 강조 문장       '결국 이번 연결에서 중요한 건 X이야 — 따로 답한 자료 N종이 …' ×5
 * Closing        접힌 아코디언 한 줄
 * ```
 *
 * 즉 **'잘 만든 관계 분석 리포트'로는 읽히는데 '러비가 관찰해서 만든 것'으로는 읽히지
 * 않았다.** 이 파일은 그 간극만 메운다 — 리포트가 말하는 **내용은 바꾸지 않고**,
 * 누가 이 관찰을 진행했는지를 화면에 되돌려 놓는다.
 *
 * ══ ⚠️ 이 파일이 절대 하지 않는 것 ═════════════════════════════════════════
 *
 * ⚠️ **분석하지 않는다.** 입력은 `PremiumChapter.kind` · `sourceGroups` · `tense`
 * 뿐이다 — `evidence`·`insightIds`·`narrativeText`의 **내용을 읽지 않는다.** 그래서
 * 여기서 나오는 문장은 사용자의 답에 따라 달라질 수 없고, 새 근거·새 해석·새 판정이
 * 만들어질 방법이 구조적으로 없다(LOVY-04 · LOVY-05가 이것을 고정한다).
 *
 * ⚠️ **AI input도 output도 아니다.** Provider 호출은 리포트 전체에 1회 그대로이고
 * (`deep-report-v4-tense`), 이 파일의 어떤 문장도 프롬프트에 들어가지 않는다.
 *
 * ⚠️ **결론을 만들지 않는다.** 러비 한마디는 '관찰자의 반응'이고 분석의 결론이 아니다.
 * 그래서 전부 `같이 놓고 봤어` · `여긴 아직 모르겠어` 계열이고, `알고 있어` 계열은
 * 하나도 없다(§35). 상대 속마음·미래·성격 단정은 재료가 없어서 나올 수 없다.
 */

/* ═══════════════════════════════════════════════════ 캐릭터 배치 (§13 · §24) */

/**
 * Chapter 종류별 러비 포즈 — **exhaustive Record다.**
 *
 * ⚠️ `Record<PremiumChapterKind, …>`로 둔 것은 의도다. 새 Chapter 종류가 생기면
 * 여기서 타입 에러가 나서 배치를 잊을 수 없다(LOVY-01이 런타임에서도 고정한다).
 *
 * ⚠️ **새 에셋을 10개 만들지는 않았다**(§6). 기존 앱이 이미 쓰고 있는 포즈 7종
 * (`observe`·`mug`·`chart`·`question`·`book`·`record`·`laptop`)을 그대로 재사용하고,
 * 그 14종으로 표현되지 않는 자리에만 새 에셋 5종(`connect`·`ponder`·`notice`·
 * `together`·`note`)을 넣었다 — 무료 화면과 유료 화면의 러비가 서로 다른 캐릭터로
 * 보이지 않는 게 새 파일 수보다 중요하다.
 *
 * ⚠️ 그래도 **kind 10개에는 서로 다른 포즈 10개**를 줬다. 처음에는 두 kind가 포즈를
 * 공유했는데(`chart`), Chapter 번호가 세션마다 밀리기 때문에 실측에서 그 둘이 연달아
 * 붙었다(아래 `next_check` 주석). 순서에 의존하지 않는 배치가 더 싸다.
 *
 * ⚠️ 한 포즈를 두 자리에서 쓰는 곳은 `record` 하나뿐이다 — 중간 메모와 Closing header다.
 * 그 둘은 리포트 양 끝이라(메모는 절반 지점, Closing은 마지막) 최소 3행 떨어진다.
 *
 * ⚠️ 축하·엄지척·컨페티 계열(`docs/캐릭터`의 C9·C13·C21)은 **한 자리도 쓰지 않았다.**
 * 이 리포트에는 축하할 결과가 없다 — 특히 `ended`와 Sparse에서 그건 조롱이 된다
 * (§28 · §29). 점·운세 계열(`crystal`·`wand`)도 쓰지 않는다(§1).
 */
const CHAPTER_POSE: Record<PremiumChapterKind, LovyPose> = {
  /** 말한 것과 나타난 것을 나란히 들여다보는 자리 */
  declared_vs_shown: 'observe',
  /** 따로 물어본 두 기준을 같이 놓고 생각하는 자리 */
  closeness_distance: 'ponder',
  /** 먼저 꼽은 기준과 실제 경험이 만난 것을 알아챈 자리 */
  hidden_priority: 'notice',
  /** 누가 맞았는지가 아니라 방식을 보는 자리 — 감정을 얹지 않는다 */
  conflict_needs: 'mug',
  /** 표현을 '기록'으로 든 모습. 하트를 껴안은 포즈(`heart`)는 쓰지 않는다 — 이 자리는
      애정을 응원하는 자리가 아니라 방식을 관찰하는 자리다 */
  affection_exchange: 'together',
  /** 점수가 아니라 어디가 다른지를 보는 자리 */
  tune_with_target: 'chart',
  /** 물음표. 빈칸을 빈칸으로 남겨두는 자리 */
  uncertainty: 'question',
  /**
   * §6 — Next Check는 관찰·돋보기·그래프 계열. `laptop`(관측 장비를 다루는 모습)이다.
   *
   * ⚠️ 처음에는 `chart`였다. 브라우저 실측에서 이렇게 나왔다:
   *
   * ```
   * 05/8 이 사람과 특히 맞춰봐야 하는 지점   chart.png   ← tune_with_target
   * 06/8 그래서 뭘 맞춰볼까                  chart.png   ← next_check · 같은 그림이 연달아
   * ```
   *
   * **Chapter 번호는 어떤 Chapter가 실제로 만들어지느냐에 따라 밀린다.** 이 세션에는
   * `hidden_priority`와 `uncertainty`가 없어서 둘이 붙어버렸다 — '사이에 CH07이 있으니
   * 안 붙는다'는 계산은 특정 세션에만 맞는 계산이었다.
   *
   * 그래서 지금은 **10개 kind에 10개 포즈를 전부 다르게** 줬다. 어느 Chapter가 빠져도
   * 인접 중복이 생길 수 없다 — 순서에 의존하지 않는 배치가 더 싸다.
   */
  next_check: 'laptop',
  /** 기록끼리 비교하는 자리 */
  past_and_now: 'book',
  /**
   * Closing의 **접힌 header**용. 큰 이미지는 아래 `LOVY_CLOSING_BODY_POSE`가 따로 있다.
   *
   * ⚠️ 두 자리에 **다른 포즈**를 쓴 것은 §25 때문이다. Closing을 펼치면 header(44px)와
   * 본문(96px)이 동시에 보이는데, 같은 파일을 두 번 그리면 §25가 금지한 '같은 이미지
   * 재출력'이 된다. 둘 다 기록 계열이라 §6('Closing에는 기록/클립보드 계열 우선')은
   * 그대로 지킨다 — 접힌 자리는 클립보드, 펼친 자리는 수첩에 적는 모습이다.
   */
  closing: 'record',
  /*
    Self-only 계열 (PostReview §2). 여기도 인접 중복이 없어야 한다 —
    두 Chapter는 항상 리포트 맨 앞 두 자리이므로 서로 달라야 하고, 뒤에 오는
    `uncertainty`(question)·`next_check`(laptop)와도 겹치지 않는다.
  */
  /** 답한 기준을 한 장에 모아 든 모습 — cross-axis synthesis 자체 */
  self_profile: 'connect',
  /** 두 기준을 같이 놓고 갸웃하는 모습 */
  self_tension: 'ponder',
};

export function lovyPoseFor(kind: PremiumChapterKind): LovyPose {
  return CHAPTER_POSE[kind];
}

/**
 * 리포트 헤더 — 흩어진 자료를 모으는 모습. Premium이 파는 행동 자체다 (§11 · §12)
 *
 * ⚠️ `self_profile` Chapter도 같은 포즈를 쓴다. 그 Chapter가 하는 일이 정확히 헤더와
 * 같은 것(흩어진 기준을 모으는 것)이라 다른 그림을 쓰면 오히려 어긋난다. 헤더는 84px,
 * Chapter header는 40px이고 §25가 금지한 것은 **한 화면의 큰 캐릭터 반복**이다.
 */
export const LOVY_REPORT_POSE: LovyPose = 'connect';

/**
 * 겹칠 때 **대신 쓸 포즈**. 순서대로 시도한다.
 *
 * ⚠️ 점·운세(`crystal`·`wand`) · 축하(`cool`·`movie`) · 하트 계열(`heart`·`calendar`)은
 * 넣지 않았다 — 대체 포즈라고 해서 쓰면 안 되는 그림을 쓰게 되면 §28·§29가 무의미해진다.
 */
const POSE_FALLBACKS: readonly LovyPose[] = [
  'record',
  'book',
  'laptop',
  'observe',
  'mug',
  'chart',
  'notice',
  'question',
  'ponder',
];

/**
 * 리포트 **한 편의 포즈 순서**를 정한다 (v1.45 PostReview §3).
 *
 * ══ 왜 kind → 포즈 표만으로는 부족한가 ═════════════════════════════════════
 *
 * 표만 두고 '이 두 kind는 같이 안 나오니까 포즈를 공유해도 된다'고 계산했는데, 그 계산이
 * **두 번 틀렸다.**
 *
 * ```
 * ① 05/8 tune_with_target  chart      ← Chapter 번호가 세션마다 밀려서 붙었다
 *    06/8 next_check        chart
 *
 * ② 리포트 헤더            connect    ← Self-only에서 헤더 바로 아래가 self_profile 이다
 *    01/3 self_profile      connect
 * ```
 *
 * 두 번 모두 '어떤 Chapter가 실제로 만들어지는가'에 의존하는 추론이었고, 그건 데이터마다
 * 달라진다. 그래서 **추론을 버리고 실제 목록에서 계산한다** — 이 함수는 붙어 있는 두
 * 자리가 같은 그림이 되는 것을 구조적으로 불가능하게 만든다.
 *
 * ⚠️ 헤더도 이웃으로 센다. 헤더(84px)는 첫 Chapter(40px) 바로 위에 있어서 사실상 인접이다.
 */
export function resolveLovyPoses(
  chapters: readonly { kind: PremiumChapterKind }[],
  headerPose: LovyPose = LOVY_REPORT_POSE,
): LovyPose[] {
  const resolved: LovyPose[] = [];

  for (const [index, chapter] of chapters.entries()) {
    const preferred = CHAPTER_POSE[chapter.kind];
    /** 위쪽 이웃 — 첫 Chapter의 이웃은 리포트 헤더다 */
    const previous = index === 0 ? headerPose : resolved[index - 1];

    if (preferred !== previous) {
      resolved.push(preferred);
      continue;
    }

    /**
     * 겹쳤다. 위 이웃과 다르고 **아직 이 리포트에서 쓰지 않은** 포즈를 고른다 —
     * 이미 쓴 것을 다시 쓰면 한 리포트 안에 같은 그림이 두 번 나온다.
     */
    const used = new Set<LovyPose>([...resolved, headerPose]);
    const substitute =
      POSE_FALLBACKS.find((pose) => pose !== previous && !used.has(pose)) ??
      POSE_FALLBACKS.find((pose) => pose !== previous);

    /** fallback이 전부 막히는 경우는 없지만, 그때는 선호 포즈를 그대로 둔다 */
    resolved.push(substitute ?? preferred);
  }

  return resolved;
}

/** §23 · §24 — Closing을 펼쳤을 때 본문에 크게 놓는 포즈(88~120px) */
export const LOVY_CLOSING_BODY_POSE: LovyPose = 'note';


/**
 * 중간 관찰 메모 (§22) — 기록 계열.
 *
 * ⚠️ `ponder`를 쓰지 않았다. 메모는 Chapter 절반 뒤에 놓이는데 그 근처(`closeness_distance`
 * ·`conflict_needs`)가 이미 생각 계열이라, 한 viewport에 같은 그림이 두 번 들어온다.
 * Closing header와 같은 포즈지만 그 둘은 리포트 양 끝이라 같이 보이지 않는다.
 */
export const LOVY_MID_NOTE_POSE: LovyPose = 'record';

/**
 * ══ Paywall은 **바꾸지 않았다** (§27) ═════════════════════════════════════
 *
 * `/premium`의 Paywall에는 이미 러비가 **정확히 하나** 있다:
 *
 * ```
 * <LovyMessage pose="chart" size={52}>여기부터는 조금 더 깊게 관찰한 내용이야 …
 * ```
 *
 * `chart`는 §27이 요구한 관찰·기록·발견 계열이고, 개수도 이미 1개다. 그래서 이 파일에
 * Paywall용 포즈 상수를 두지 않았다 — 안 쓰는 export를 남기면 '여기서 정한다'고
 * 잘못 읽힌다.
 *
 * ⚠️ 리포트 헤더의 `connect`를 Paywall로 가져오지 않은 것도 의도다. §27이 요구하는
 * '결제 후가 더 풍부해야 한다'는 조건은 **Paywall 1개 vs 리포트(헤더 + Chapter마다 +
 * 중간 메모 + Closing 큰 이미지)**로 이미 성립하는데, 헤더 그림을 미리 보여주면 그
 * 대비가 사라진다.
 *
 * ⚠️ 자물쇠·왕관·상장 계열(`docs/캐릭터`의 C2·C4·C1)은 어느 자리에도 쓰지 않았다.
 * 이 화면은 Fake Door다 — 결제로 열린다는 약속을 그림으로 하면 실제 결제가 없다는
 * 사실과 화면이 어긋나고(§15 '가짜 teaser 금지'), 상장은 이 리포트가 갖고 있지 않은
 * '검증된 판정'이라는 인상을 준다.
 */

/**
 * §24 — 393×852 기준 표시 폭(px). 한 viewport에 큰 캐릭터가 겹치지 않게 둔다.
 *
 * ⚠️ **`Lovy`는 이 숫자에 `LOVY_VISUAL_SCALE`을 곱해서 그린다**(포즈마다 1.0~1.16).
 * 그래서 여기 적은 값이 화면 픽셀이 아니다 — 실측으로 맞췄다:
 *
 * ```
 * chapterHeader 44 → 실제 44~52px   ← §14가 정한 40~48을 넘었다
 * chapterHeader 40 → 실제 40~47px   ← 지금 값
 * reportHeader  84 → 실제 81px      (§12 72~96)
 * midNote       64 → 실제 68px      (§24 56~72)
 * closing       96 → 실제 96px      (§24 88~120)
 * ```
 */
export const LOVY_SIZE = {
  reportHeader: 84,
  chapterHeader: 40,
  midNote: 64,
  closing: 96,
  /** PostReview §4-3 — 결제 후 준비 화면. Closing보다 작고 헤더보다 크다 */
  preparing: 88,
} as const;

/* ═════════════════════════════════════════ §17 러비가 연결해본 이유 */

/**
 * 이 Chapter가 **왜 두 자료를 같이 볼 수 있는 자리인지**를 설명한다.
 *
 * ⚠️ **새 분석이 아니다.** 문장은 `kind` 하나로 결정되고, 사용자의 답을 읽지 않는다.
 * 말하는 것은 딱 하나다 — 이 조합이 왜 나란히 놓을 수 있는 조합인가(구조적 이유).
 * '그래서 무엇이 보이는가'는 여전히 `deterministicSummary`·`deterministicTakeaway`가
 * 말하고, 이 파일은 그 자리를 건드리지 않는다.
 *
 * ⚠️ 파생 Chapter(`uncertainty`·`next_check`·`closing`)는 **null이다.** 그 셋은 연결이
 * 아니라 앞 Chapter에서 파생된 것이라, '연결해본 이유'를 쓰면 없는 연결을 있다고 말하게
 * 된다. 화면은 null이면 그 블록을 그리지 않는다.
 */
const CONNECTION_REASON: Record<PremiumChapterKind, string | null> = {
  declared_vs_shown:
    '네가 직접 말한 기준과, 관계에서 따로 관찰된 신호를 같이 놓고 봤어. 한쪽만 보면 기준인지 습관인지 구분이 안 돼서 둘이 다 있어야 볼 수 있는 자리야.',
  closeness_distance:
    '연락과 개인 시간은 따로 보면 다른 기준인데, 관계에서의 거리라는 점에서는 같이 볼 수 있어. 그래서 두 축을 하나로 묶어봤어.',
  hidden_priority:
    '네가 중요하다고 말한 것과, 실제 관계에서 힘들었다고 적은 지점이 같은 방향인지 같이 봤어.',
  conflict_needs:
    '갈등은 한 자료만으로는 방식이 안 보여. 네가 답한 기준과 실제로 겪은 걸 같이 놓아야 어떤 방식을 원했는지가 드러나는 자리야.',
  affection_exchange:
    '표현은 얼마나 자주였는지보다 어떤 방식이었는지에서 갈려. 그걸 보려면 서로 다른 자리에서 답한 내용이 같이 있어야 해.',
  tune_with_target:
    '상대 정보만으로는 맞춰볼 지점이 나오지 않아. 네 기준과 같이 놓아야 어디에서 기대가 다른지가 보여.',
  past_and_now:
    '서로 다른 시점에 따로 저장된 관찰이야. 두 기록이 같은 축을 가리킬 때만 나란히 놓을 수 있어서, 그때만 이 자리를 만들어.',
  uncertainty: null,
  next_check: null,
  closing: null,
  self_profile:
    '따로 물어본 기준들을 한 자리에 모아봤어. 하나씩 보면 취향인데, 같이 놓으면 네가 관계에서 무엇을 먼저 보는지가 드러나는 자리야.',
  self_tension:
    '둘 다 중요하다고 답한 기준이야. 각각은 자연스러운데 같이 놓으면 서로 당길 수 있어서, 그 조합만 따로 봤어.',
};

export function lovyConnectionReasonOf(chapter: PremiumChapter): string | null {
  return CONNECTION_REASON[chapter.kind];
}

/* ══════════════════════════════════════ 러비의 체크포인트 (PostReview §1) */

/**
 * Chapter 하단의 **다음 확인 포인트.**
 *
 * ══ 왜 '한마디'에서 '체크포인트'로 바꿨나 ═══════════════════════════════════
 *
 * v1.45 첫 구현은 관찰자의 감상이었다(`따로 보면 지나칠 수 있는데, 같이 놓으니까
 * 어디가 같은지 보였어.`). 사용자 검토에서 나온 지적은 정확했다 — 유료 리포트를 보는
 * 사람은 그 자리에서 자연스럽게 이걸 기대한다:
 *
 * > '그래서 나는 뭘 확인하거나 바꿔보면 되지?'
 *
 * 그래서 문장 구조를 바꿨다. **감상으로 끝내지 않고 확인 행동까지 간다:**
 *
 * ```
 * 현재 근거에서 확인된 것  →  다음에 확인하거나 조정해볼 행동
 * ```
 *
 * ══ ⚠️ 그래도 처방이 아니다 ════════════════════════════════════════════════
 *
 * ⚠️ **새 판단을 만들지 않는다.** 입력은 여전히 `kind` + Job 맥락뿐이고
 * `evidence`·`insightIds`·`narrativeText`의 **내용을 읽지 않는다.** 그래서 이 문장은
 * 사용자의 답에 따라 달라질 수 없고, 새 근거·새 진단·성공 확률이 나올 방법이 없다.
 *
 * ⚠️ 전부 **'확인해봐' · '구분해봐' · '정리해봐'**다 — `이렇게 하면 좋아진다`가 아니다.
 * 금지 목록(상대 속마음 · 재회/연락 유도 · 성공 확률 · 조종법 · 호감도 높이기 ·
 * `너는 사실 ~한 사람이야` · 근거 없는 진단 · 치유 보장 · 미래 예측)에 걸리는 어휘가
 * 하나도 없고, fixture가 그것을 검사한다(POSTREV-01·02·03).
 */

/** 1문장 — **항상 나온다.** 나 자신에 대한 확인이라 Job과 무관하게 안전하다 */
const CHECK_SELF: Record<PremiumChapterKind, string> = {
  declared_vs_shown:
    '네가 말한 기준과 실제로 크게 반응한 자리가 어긋난 지점 하나만 골라서, 무엇이 달랐는지 확인해봐.',
  closeness_distance:
    '내가 필요한 게 실제로 혼자 있는 시간인지, 관계가 괜찮다는 확인인지 구분해봐.',
  hidden_priority:
    '먼저 꼽은 기준보다 실제로 힘들었던 자리가 더 중요할 수 있어. 어느 쪽을 기준으로 삼을지 정리해봐.',
  conflict_needs:
    '갈등이 생겼을 때 바로 해결하려는 편인지, 감정을 먼저 정리해야 하는 편인지 내 순서를 확인해봐.',
  affection_exchange:
    "표현의 양보다 내가 '사랑받고 있다'고 느끼는 방식이 무엇인지 먼저 정리해봐.",
  tune_with_target: '점수를 높이려 하기보다 기대가 다른 축 하나를 먼저 확인해봐.',
  uncertainty:
    '여긴 아직 빈칸이야. 억지로 채우지 말고, 어떤 답이 쌓이면 채워지는지만 기억해둬.',
  next_check: '여기 있는 건 결론이 아니야. 하나만 골라서 다음에 확인해봐.',
  past_and_now:
    '두 기록을 나란히 놓을 수 있을 때만 변화라고 부를게. 다음 기록에서 같은 축을 한 번 더 확인해봐.',
  closing: '이 문장이 다음 관찰에서도 그대로인지 확인해봐. 달라지면 그게 변화야.',
  self_profile:
    '지금 답만 보고 정리한 기준이야. 이 중에서 실제로 양보하기 어려운 것 하나를 골라봐.',
  self_tension:
    '두 기준이 동시에 중요하다는 건 문제가 아니야. 어느 쪽을 먼저 지킬지만 미리 정해둬.',
};

/**
 * 2문장 — **상대를 향한 조정.** `allowsOutwardAction`이 true일 때만 붙인다.
 *
 * ⚠️ `tense`로 판단하면 안 된다. `job=none`(상대 없음)은 `tense: 'current'`인데도
 * outward가 금지된다 — 없는 상대에게 맞춰보라고 말하는 것이 된다(v1.40 Lifecycle).
 *
 * ⚠️ 전부 **'무엇을 먼저 맞춰볼지'**까지다. 어떻게 말하면 상대가 어떻게 반응한다는
 * 예측은 없다 — 상대의 반응은 이 서비스가 가진 데이터가 아니다.
 */
const CHECK_OUTWARD: Partial<Record<PremiumChapterKind, string>> = {
  declared_vs_shown:
    "상대와는 '누가 맞았는지'보다 '어떤 기준을 서로 다르게 보고 있는지'부터 맞춰보는 게 안전할 수 있어.",
  closeness_distance:
    "'얼마나 자주'보다 '거리가 생겼을 때 서로 어떻게 받아들이는지'를 먼저 맞춰보는 게 도움이 될 수 있어.",
  hidden_priority:
    '조건을 설명하기 전에, 네가 실제로 힘들었던 지점 하나를 먼저 이야기해보는 편이 나을 수 있어.',
  conflict_needs:
    "상대와는 '무슨 말을 할지'보다 '언제 이야기할지'부터 맞추는 편이 안전할 수 있어.",
  affection_exchange:
    '방식이 다를 때는 부족하다고 판단하기 전에 서로의 표현 방식을 확인하는 게 좋겠어.',
  tune_with_target: '특히 실제 생활에서 자주 부딪힐 수 있는 기준부터 맞춰보는 게 좋아.',
};

/**
 * 2문장 — **끝난 관계 전용** (PostReview §1 Ended).
 *
 * ⚠️ **상대에게 다시 확인하라고 말하지 않는다.** 다음 관계에서 가져갈 기준 · 내 선택
 * 기준 · 경계만 제안한다(v1.40 Lifecycle Trust Boundary · §2.4).
 *
 * ⚠️ `지금`이라는 단어를 쓰지 않는다 — `ended` 금지 어휘 스캔이 부인 문장까지 오탐으로
 * 올린다. 검사를 무디게 만들지 않고 문장 쪽을 맞춘다(v1.45 LOVY-09에서 배운 것).
 */
const CHECK_FORMER: Partial<Record<PremiumChapterKind, string>> = {
  declared_vs_shown:
    "그 어긋남을 '상대의 문제'로만 남기지 말고, 다음에는 어떤 신호를 더 일찍 확인할지 한 문장으로 정리해봐.",
  closeness_distance:
    '혼자 있는 시간이 필요했던 것과 거리감이 느껴졌던 걸 같은 문제로 묶지 말고, 다음에는 어느 쪽인지 먼저 구분해봐.',
  hidden_priority:
    '그때 힘들었던 지점을, 다음에 먼저 확인할 기준으로 한 줄만 남겨둬.',
  conflict_needs:
    '그때 필요했던 게 빠른 해결이었는지 정리할 시간이었는지, 다음을 위해 정리해둬.',
  affection_exchange:
    '표현이 부족하다고 느꼈던 순간이 방식의 차이였는지, 다음에는 그것부터 구분해봐.',
  tune_with_target:
    '그때 기대가 달랐던 축 하나를, 다음에 더 일찍 확인할 목록에 올려둬.',
  next_check: '여기 있는 건 뭘 해보라는 게 아니라, 네가 다시 읽어볼 수 있는 자리야.',
};

/** 화면에 붙는 라벨 (PostReview §1 — `러비 한마디` → `러비의 체크포인트`) */
export const LOVY_CHECKPOINT_LABEL = '러비의 체크포인트';

export interface LovyCheckpointContext {
  tense: RelationshipTense;
  /** 상대를 향한 조정 문장을 붙일 수 있는가. `job=none`·`ended`에서 false다 */
  allowsOutwardAction: boolean;
}

export function lovyCheckpointOf(
  chapter: PremiumChapter,
  context: LovyCheckpointContext,
): string {
  const first = CHECK_SELF[chapter.kind];
  const second =
    context.tense === 'former'
      ? CHECK_FORMER[chapter.kind]
      : context.allowsOutwardAction
        ? CHECK_OUTWARD[chapter.kind]
        : undefined;

  return second ? `${first} ${second}` : first;
}

/* ═════════════════════════════════════════════ §22 중간 관찰 메모 */

/**
 * Chapter가 6개 이상일 때만 중간에 한 번 끼운다.
 *
 * ⚠️ **Chapter 수에 포함하지 않는다.** 헤더의 `전체 N개`와 각 header의 `03/8`은
 * 전부 `chapters.length`를 쓰고, 이 메모는 그 배열에 들어가지 않는다 — v1.45가 고치려던
 * '헤더 숫자와 화면 개수가 다르다'를 여기서 되살리지 않는다(LOVY-06이 고정한다).
 *
 * ⚠️ Sparse에는 나오지 않는다 — Chapter가 6개가 안 되기 때문이다(§28). 결과가 적은데
 * 중간 정리를 넣으면 분량이 있는 것처럼 보인다.
 *
 * @returns 이 개수의 Chapter **뒤에** 메모를 놓는다. 조건이 안 되면 null.
 */
export function lovyMidNoteAfter(total: number): number | null {
  if (total < 6) return null;
  return Math.floor(total / 2);
}

/**
 * ⚠️ **고정 문구다.** 사용자별 새 해석을 쓰지 않는다(§22) — 그래서 인자가 없다.
 * '여기까지 무엇을 했는지'와 '아직 결론을 내지 않았다'만 말한다.
 */
export const LOVY_MID_NOTE = {
  label: '러비의 중간 메모',
  body: '여기까지는 네 답에서 실제로 연결할 수 있는 근거만 보고 있어. 아직 결론은 안 낼게 — 남은 연결도 같이 볼게.',
} as const;
