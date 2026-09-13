import type {
  CompatibilityResult,
  ExecutiveItem,
  ExecutiveSlot,
  ExecutiveSoWhat,
  PremiumChapter,
  PremiumChapterKind,
  RelationshipTense,
} from '@/types';

/**
 * Result Value Layer — **SO WHAT을 먼저 말하는 표현 계층** (v1.46.4 · §3 · §6 · §7)
 *
 * ══ 왜 이 파일이 생겼나 ═══════════════════════════════════════════════════
 *
 * UT-1과 사후 검토에서 같은 말이 반복해서 나왔다.
 *
 * > "AI API까지 썼는데 내가 입력한 걸 다시 말해주는 수준이면 1,900원을 낼 이유가 없다."
 *
 * v1.46.3 리포트를 고데이터 fixture로 실측해보면 그 지적이 정확했다. Chapter 본문의
 * 순서가 이랬다:
 *
 * ```
 * 연결한 근거(펼쳐짐) → 러비가 연결해본 이유 → 규칙 요약 → 강조 → 확인해볼 것
 * ```
 *
 * 첫 세 블록이 전부 **사용자가 입력한 값과 그 값을 어떻게 골랐는지**였다. 즉 리포트가
 * `근거 → 결론` 순서였는데, 사용자는 `결론 → (필요하면) 근거`를 원했다.
 *
 * ⚠️ 그래서 이 파일이 하는 일은 **순서를 바꿀 수 있게 문장을 하나 더 만드는 것**이다.
 * 판정·점수·근거는 하나도 건드리지 않는다.
 *
 * ══ 이 파일이 만들지 않는 것 ══════════════════════════════════════════════
 *
 * ⚠️ **새 판정을 만들지 않는다.** 입력은 이미 만들어진 `PremiumChapter`의 `kind`와
 * 리포트 시제뿐이다. 사용자의 답 값(점수·선택지·자유서술)을 읽지 않으므로 **어떤
 * 사용자에게도 같은 kind면 같은 문장**이 나온다 — `premiumLovy.ts`의 체크포인트와
 * 정확히 같은 성질이고, 같은 이유로 fixture가 값으로 고정할 수 있다.
 *
 * ⚠️ **인과를 주장하지 않는다.** 전부 `~수 있어` 조건문이다. SO WHAT은 사실이 아니라
 * **지금 근거로 확인해볼 가치가 있는 의미**다(§16).
 *
 * ⚠️ **상대의 마음을 추정하지 않는다.** 주어는 언제나 '두 사람의 기준' 또는 '너'이고,
 * '상대는 ~게 느낀다'는 문장은 여기에 없다.
 *
 * ⚠️ **`ended`에서 `지금`을 쓰지 않는다.** `FORMER_FORBIDDEN` 스캔이 `'지금 '`을
 * 통째로 잡는다. 부인 문장으로 피하지 않고 문장 자체를 former 전용으로 갈아 끼운다
 * (v1.45 LOVY-09에서 배운 것).
 */

/* ═══════════════════════════════════════════════════ 화면 라벨 */

/** §7 — Chapter 본문의 네 블록 라벨. 화면 세 곳이 같은 값을 쓴다 */
export const SO_WHAT_LABEL = '그래서 이게 무슨 의미야';
export const WHY_LABEL = '왜 중요해';
export const VERIFY_LABEL = '확인해볼 것';
/** §7 · §8 — 근거는 지우는 게 아니라 **펼치는 것**이다 */
export const EVIDENCE_TOGGLE_LABEL = '왜 이렇게 봤어?';

/* ═══════════════════════════════════════════════ Chapter SO WHAT */

export interface ChapterSoWhat {
  /** ① 이 연결이 관계에서 무슨 의미인가 */
  soWhat: string;
  /** ② 왜 그게 지금 중요한가 */
  whyItMatters: string;
}

/**
 * ⚠️ 파생 Chapter(`next_check` · `closing`)는 여기 없다 — **의도적이다.**
 * 그 둘은 앞 Chapter에서 나온 것이라 자기 SO WHAT을 가질 수 없다. 억지로 채우면
 * 같은 의미가 리포트에 두 번 적힌다(v1.26이 `finalObservation`으로 겪은 실패).
 */
const SO_WHAT: Partial<Record<PremiumChapterKind, ChapterSoWhat>> = {
  declared_vs_shown: {
    soWhat:
      '말로 정한 기준과, 실제로 크게 반응한 자리가 서로 다른 곳을 가리키고 있어. 신경 쓰이는 건 기준 쪽이 아니라 어긋난 그 자리야.',
    whyItMatters:
      '기준과 반응이 어긋난 자리는 스스로도 왜 불편한지 설명하기 어려워서, 상대에게도 "그냥 좀 그래"로 전달되기 쉬워.',
  },
  closeness_distance: {
    soWhat:
      '가까워지는 방식과 거리를 두는 방식이 따로 움직이고 있어. 한쪽만 맞춰도 다른 쪽에서 어긋날 수 있는 자리야.',
    whyItMatters:
      '거리를 두고 싶은 순간이 관계에 대한 신호로 읽히면, 실제로 필요한 건 시간인데 마음의 문제로 번질 수 있어.',
  },
  hidden_priority: {
    soWhat:
      '한 번 크게 힘들었던 지점이, 이 사람에게서 네가 이미 알아챈 것과 겹쳐 있어.',
    whyItMatters:
      '한 번 크게 겪은 자리는 비슷한 장면이 오면 실제 크기보다 먼저 반응하게 될 수 있어 — 그래서 미리 알아두면 반응과 상황을 분리하기 쉬워져.',
  },
  conflict_needs: {
    soWhat:
      '갈등에서 갈리는 건 무슨 말을 하느냐가 아니라, 언제 이야기하고 싶으냐야.',
    whyItMatters:
      '정리할 시간이 필요한 쪽과 바로 풀고 싶은 쪽이 만나면, 내용이 맞아도 한쪽은 회피로 다른 쪽은 몰아세우는 걸로 느낄 수 있어.',
  },
  affection_exchange: {
    soWhat: '애정 표현에서 갈리는 건 양이 아니라 방식이야.',
    whyItMatters:
      '방식이 다르면 충분히 주고받고 있는데도 한쪽은 계속 부족하다고 느낄 수 있어 — 더 많이 한다고 해결되지 않는 종류야.',
  },
  tune_with_target: {
    soWhat:
      '점수가 비슷하게 나와도, 실제 생활에서 매번 맞춰야 하는 자리가 하나 남아 있어.',
    whyItMatters:
      '비슷하게 답한 축이라도 기대의 모양이 다르면, 큰 문제가 아니라 사소한 장면에서 매번 조율해야 하는 자리가 돼.',
  },
  past_and_now: {
    soWhat: '같은 주제인데 두 시점의 기록이 서로 다르게 남아 있어.',
    whyItMatters:
      '어느 쪽이 진짜 너인지보다, 어떤 상황에서 다르게 나왔는지가 다음 관찰에서 확인할 것이 돼.',
  },
  uncertainty: {
    soWhat: '여기는 아직 확인되지 않은 자리야. 결론을 내지 않고 남겨둘게.',
    whyItMatters:
      '근거가 부족한 자리를 결론처럼 다루면, 근거가 충분한 나머지 결과까지 같이 믿기 어려워져.',
  },
  self_profile: {
    soWhat:
      '따로 답한 기준들이 한 방향으로 모여 있어. 관계에서 네가 먼저 보는 게 무엇인지가 보이는 자리야.',
    whyItMatters:
      '기준이 모여 있으면 편한 관계는 빨리 알아보지만, 그 기준 밖의 방식은 늦게 알아차릴 수 있어.',
  },
  self_tension: {
    soWhat: '동시에 중요하다고 답한 기준 두 개가 서로 당기고 있어.',
    whyItMatters:
      '둘 다 중요하면 상황마다 어느 쪽을 먼저 챙길지 정해야 해서, 스스로도 일관되지 않다고 느끼기 쉬워.',
  },
};

/**
 * `ended`(former) 전용 교체분.
 *
 * ⚠️ `지금`을 쓰지 않는다(위 주석 참고). 그리고 **다음 행동을 권하지 않는다** —
 * 끝난 관계에서 SO WHAT은 '무엇을 알게 됐는가'까지다(v1.40 Lifecycle Trust Boundary).
 */
const SO_WHAT_FORMER: Partial<Record<PremiumChapterKind, ChapterSoWhat>> = {
  declared_vs_shown: {
    soWhat:
      '말로 정한 기준과 실제로 크게 반응한 자리가 서로 다른 곳을 가리키고 있었어.',
    whyItMatters:
      '그 어긋남은 상대가 만든 것도, 네가 잘못한 것도 아니야. 다음에 더 일찍 알아차릴 수 있는 신호로 남겨둘 수 있어.',
  },
  closeness_distance: {
    soWhat: '가까워지는 방식과 거리를 두는 방식이 따로 움직이고 있었어.',
    whyItMatters:
      '혼자 있고 싶었던 것과 거리감이 느껴졌던 건 다른 일인데, 같은 문제로 묶이면 둘 다 설명하기 어려워져.',
  },
  conflict_needs: {
    soWhat: '갈등에서 갈린 건 무슨 말을 했느냐가 아니라 언제 이야기했느냐였어.',
    whyItMatters:
      '필요했던 게 빠른 해결이었는지 정리할 시간이었는지는, 돌아보고 나서야 구분되는 경우가 많아.',
  },
  tune_with_target: {
    soWhat: '숫자로는 안 보였는데 실제 생활에서 자주 맞춰야 했던 자리가 있었어.',
    whyItMatters:
      '기대의 모양이 달랐던 자리는 큰 사건이 아니라 사소한 장면에서 반복됐을 수 있어.',
  },
};

/**
 * 이 Chapter의 SO WHAT / WHY IT MATTERS.
 *
 * @returns 파생 Chapter(`next_check` · `closing`)에서는 `null` — 화면은 그 자리에
 *          기존 규칙 문장을 그대로 쓴다.
 */
export function chapterSoWhatOf(
  chapter: PremiumChapter,
  context: { tense: RelationshipTense },
): ChapterSoWhat | null {
  if (context.tense === 'former') {
    const former = SO_WHAT_FORMER[chapter.kind];
    if (former) return former;
    /*
      former 교체분이 없는 kind는 **현재형 문장을 그대로 쓰지 않는다.** 위 SO_WHAT의
      문장 중 일부에 `지금`이 들어 있어서 ended 금지 어휘 스캔에 걸린다. 교체분이
      없다는 건 그 kind가 ended에서 나올 일이 드물다는 뜻이므로, 없는 문장을 만들기보다
      SO WHAT 블록 자체를 비우고 기존 규칙 문장에 맡긴다.
    */
    return SO_WHAT_FORMER_SAFE.has(chapter.kind) ? (SO_WHAT[chapter.kind] ?? null) : null;
  }
  return SO_WHAT[chapter.kind] ?? null;
}

/** 현재형 문장에 `지금`이 없어서 former에서도 그대로 쓸 수 있는 kind */
const SO_WHAT_FORMER_SAFE = new Set<PremiumChapterKind>([
  'affection_exchange',
  'hidden_priority',
  'past_and_now',
  'uncertainty',
  'self_profile',
  'self_tension',
]);

/* ═════════════════════════════════════════ Executive SO WHAT (§6) */

/**
 * 첫 viewport의 `watch` 한 줄 — **Chapter의 SO WHAT을 그대로 옮기지 않는다.**
 *
 * 처음 구현은 `chapterSoWhatOf(첫 Chapter).soWhat`을 그대로 썼는데, 브라우저 실측에서
 * 같은 문장이 한 화면 안에 **두 번** 나왔다(요약 02 · Chapter 01은 기본 열림이다).
 * UT-1이 지적한 '아까 본 것 같다'를 이번 개편이 새로 만드는 꼴이라 역할을 갈랐다:
 *
 *   요약     어디를 먼저 볼지            (여기)
 *   Chapter  그게 관계에서 무슨 의미인지  (`SO_WHAT`)
 *
 * ⚠️ 그래서 이 문장들은 **더 짧고, 결론을 말하지 않는다.**
 */
const EXEC_WATCH: Partial<Record<PremiumChapterKind, string>> = {
  declared_vs_shown: '말한 기준보다 실제 반응이 더 컸던 자리가 어디인지.',
  closeness_distance: '가까워지는 방식과 거리를 두는 방식이 서로 어긋나는 지점.',
  hidden_priority: '한 번 힘들었던 지점이 이번에도 다시 걸리는지.',
  conflict_needs: '갈등에서 필요한 게 빠른 해결인지 정리할 시간인지.',
  affection_exchange: '애정 표현에서 갈리는 게 양인지 방식인지.',
  tune_with_target: '점수로는 안 보이는데 생활에서 매번 맞춰야 하는 자리.',
  past_and_now: '같은 주제에서 두 시점의 기록이 어떻게 다르게 남았는지.',
  uncertainty: '아직 확인되지 않아 결론을 낼 수 없는 자리.',
  self_profile: '네 기준들이 한 방향으로 모여 있는 자리.',
  self_tension: '동시에 중요하다고 답한 기준 두 개가 서로 당기는 자리.',
};


/** §6 — 첫 viewport의 고정 제목. 리포트 규모(개수)를 말하지 않는다 */
export const EXECUTIVE_TITLE = '이번 관계에서 먼저 볼 것';

const EXECUTIVE_LABEL: Record<ExecutiveSlot, string> = {
  strength: '잘 맞는다고 느끼기 쉬운 지점',
  watch: '가장 확인이 필요한 지점',
  ask: '다음에 확인할 것',
};

/**
 * `ended`에서는 '맞는 지점'을 강점으로 팔지 않는다 — 이미 끝난 관계에서 그건
 * 아쉬움을 키우는 문장이 된다(§2.4와 같은 판단).
 */
const STRENGTH_LABEL_FORMER = '서로 비슷했던 지점';

/**
 * 첫 viewport에 놓을 3줄.
 *
 * ══ 이 함수가 지키는 것 ═══════════════════════════════════════════════════
 *
 * ⚠️ **없는 항목을 만들지 않는다.** 맞는 축이 없으면 `strength`가 없고, 질문이 없으면
 * (`ended`·`none`은 연결 질문이 빈 배열이다) `ask`가 없다. 3개를 채우려고 문장을
 * 지어내면 첫 화면부터 근거 없는 리포트가 된다.
 *
 * ⚠️ **사용자 입력값을 적지 않는다.** 축 라벨(`개인 시간`)은 서비스의 어휘이고,
 * `혼자 있는 시간 4/5` 같은 **답 값은 근거 토글 안에만** 있는다(§8 · VALUE-01).
 *
 * ⚠️ **새 판정을 하지 않는다.** `strength`는 이미 계산된 `compatibility.dimensions`의
 * alignment를, `watch`는 이미 선정된 Chapter 순서를, `ask`는 이미 만들어진 연결 질문을
 * 그대로 읽는다.
 */
export function buildExecutiveSoWhat(input: {
  chapters: readonly PremiumChapter[];
  compatibility: CompatibilityResult;
  /** 이미 만들어진 Premium 연결 질문. `ended`·`none`에서는 빈 배열이다 */
  questions: readonly string[];
  tense: RelationshipTense;
}): ExecutiveSoWhat | null {
  const { chapters, compatibility, questions, tense } = input;
  const items: ExecutiveItem[] = [];

  /*
    ① 잘 맞는 지점 — **여기서 다시 분류하지 않는다.** `goodSignals`는 이미
    `buildCompatibility`가 `tone === 'good'`으로 골라둔 배열이고, 그 안에서 alignment가
    가장 높은 축 하나만 쓴다(무료 화면의 `topGood`과 같은 기준).
  */
  const aligned = [...compatibility.goodSignals].sort(
    (a, b) => (b.alignment ?? 0) - (a.alignment ?? 0),
  )[0];

  if (aligned) {
    items.push({
      slot: 'strength',
      label: tense === 'former' ? STRENGTH_LABEL_FORMER : EXECUTIVE_LABEL.strength,
      text:
        tense === 'former'
          ? `${aligned.label}에서는 두 사람의 기대가 비슷한 쪽으로 나왔어.`
          : `${aligned.label}에서는 두 사람의 기대가 비슷한 쪽으로 나왔어. 여기서는 길게 설명하지 않아도 통하는 구간이 생길 수 있어.`,
      whyItMatters:
        '비슷한 축은 편한 만큼 확인을 건너뛰기 쉬워서, 어긋나는 순간에 더 크게 느껴질 수 있어.',
    });
  }

  /* ② 가장 확인이 필요한 지점 — 이미 선정된 Chapter 순서의 첫 내용 Chapter */
  const watchChapter = chapters.find((chapter) => {
    const soWhat = chapterSoWhatOf(chapter, { tense });
    return soWhat !== null;
  });
  const watchSoWhat = watchChapter ? chapterSoWhatOf(watchChapter, { tense }) : null;

  if (watchChapter && watchSoWhat) {
    items.push({
      slot: 'watch',
      label: EXECUTIVE_LABEL.watch,
      /*
        ⚠️ Chapter의 SO WHAT을 그대로 쓰지 않는다(EXEC_WATCH 주석 참고). 전용 문장이
        없는 kind에서는 이 줄을 만들지 않는다 — 같은 말을 두 번 하느니 한 줄이 없는
        편이 낫다.
      */
      text: EXEC_WATCH[watchChapter.kind] ?? '',
      whyItMatters: watchSoWhat.whyItMatters,
    });
  }

  /* ③ 다음에 확인할 것 — 이미 만들어진 질문. 없으면 이 줄이 없다 */
  const question = questions[0];
  if (question) {
    items.push({
      slot: 'ask',
      label: EXECUTIVE_LABEL.ask,
      text: question,
      whyItMatters: null,
    });
  }

  /** 문장이 없는 슬롯은 내보내지 않는다 — 빈 카드가 첫 화면에 서면 안 된다 */
  const filled = items.filter((item) => item.text.length > 0);
  if (filled.length === 0) return null;
  return { title: EXECUTIVE_TITLE, items: filled };
}
