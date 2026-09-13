import type { SelfLevel } from '@/data/firstContact';
import type {
  InsightVerdict,
  MirrorAxisKey,
  QuestionRegister,
  RelationshipEventType,
  RelationshipTense,
  TargetLevel,
  UserFitQuestion,
} from '@/types';

/**
 * User-Fit Question — **실제로 보낼 수 있는 질문을 조립한다** (v1.46.4 · §25 ~ §32)
 *
 * ══ 왜 variant bank로 부족했나 ════════════════════════════════════════════
 *
 * UT-1 P1-B가 `QUESTION_BY_AXIS`(축당 문자열 하나)를 `QUESTION_VARIANTS`(축당 5~6개)로
 * 바꿨다. 그건 옳은 방향이었지만 **한 단계 모자랐다**: variant는 여전히 *미리 쓴 문장*
 * 중에서 고르는 것이라, 조건 조합이 같으면 서로 다른 사용자에게 한 글자도 다르지 않은
 * 문장이 나간다. 사건을 20개 알려준 사람과 0개 알려준 사람이 같은 질문을 받는다.
 *
 * 이 파일은 문장을 **고르지 않고 조립한다**:
 *
 * ```
 * [내 기준 절]        declared 값이 있을 때만
 * + [상황 절]          사건이 붙었을 때만
 * + [묻는 절]          축 × 판정 방향
 * ```
 *
 * 세 조각 중 앞의 둘이 사용자마다 다르므로, 같은 축·같은 판정이어도 결과 문장이 다르다
 * (QUESTION-FIT-01 · 02가 이것을 값으로 검사한다).
 *
 * ══ 이 파일이 절대 만들지 않는 것 (§29) ═══════════════════════════════════
 *
 * ```
 * 상대를 시험하는 질문       '나 어떻게 생각해?' 류
 * 답을 유도하는 질문         '~한 게 맞지?'
 * 죄책감 유도               '나는 계속 기다렸는데'
 * 고백 성공 전략 · 재회 유도
 * 상대 마음 추정            '상대는 왜 그랬을까?'  ← 주어가 상대인 질문은 없다
 * ```
 *
 * ⚠️ 모든 묻는 절의 주어는 **`너`(=상대에게 직접 묻는 말)** 아니면 **`우리`**다.
 * `상대는`으로 시작하는 문장이 이 파일에 생기면 그건 §29 위반이고, 조립이 아니라
 * 추정이다.
 *
 * ══ 문체 (§28) ═══════════════════════════════════════════════════════════
 *
 * 목표는 '친구가 실제로 메시지로 보낼 수 있는 수준'이다. 그래서:
 *
 * ```
 * X  '갈등 해결 방식은 무엇인가요?'          심리검사 말투
 * X  '싸웠을 때 어느 정도 시간이 필요해?'     전제를 깔고 양을 묻는다
 * O  '서로 예민해졌을 때, 바로 얘기하는 게 편해 아니면 좀 있다가가 편해?'
 * ```
 *
 * ⚠️ 조립 결과에 `~인가요` · `~습니까` · `어느 정도` 같은 조각이 들어갈 자리를
 * 만들지 않았다. 검사는 QUESTION-FIT-09가 금지 어휘 스캔으로 한다.
 */

/* ═════════════════════════════════════════════ ① 내 기준 절 (self clause) */

/**
 * 사용자가 자기 답으로 이미 말한 것을 **그대로** 앞에 붙인다.
 *
 * ⚠️ §27 — 이 절은 declared 값이 있을 때만 붙는다. 없는데 붙이면 서비스가 사용자
 * 대신 자기 취향을 선언하는 것이고, 그건 사용자가 상대에게 거짓말하게 만드는 것이다.
 *
 * ⚠️ `mid`는 없다. '보통이다'를 앞세운 질문("나는 보통인 편인데")은 정보가 없어서
 * 질문을 길게만 만든다 — 그때는 절 자체를 만들지 않는다.
 */
const SELF_CLAUSE: Record<MirrorAxisKey, Partial<Record<SelfLevel, string>>> = {
  contact: {
    high: '나는 연락이 자주 오가는 쪽이 마음이 편한 편인데',
    low: '나는 연락 간격에 크게 신경 쓰는 편은 아닌데',
  },
  alone: {
    high: '나는 혼자 있는 시간이 좀 있어야 충전되는 편인데',
    low: '나는 같이 있는 시간이 많아도 괜찮은 편인데',
  },
  conflict: {
    high: '나는 마음에 걸리는 건 그날 안에 얘기하는 게 편한 편인데',
    low: '나는 좀 정리한 다음에 얘기하는 게 편한 편인데',
  },
  affection: {
    high: '나는 표현을 자주 하는 편인데',
    low: '나는 표현이 담백한 편인데',
  },
  hobby: {
    high: '나는 같이 하는 시간이 많은 게 좋은 편인데',
    low: '나는 각자 취향대로 지내는 것도 좋아하는 편인데',
  },
};

/* ═══════════════════════════════════════ ② 상황 절 (event situation clause) */

/**
 * §17 · §27 — 사건을 질문에 넣는 **유일한 방법**.
 *
 * ⚠️ **본문을 인용하지 않는다.** 사용자가 쓴 문장을 상대에게 보내는 메시지에 그대로
 * 끼워 넣으면, 사용자가 서비스에 한 말이 상대에게 하는 말이 된다 — 두 개는 다른
 * 발화다. 대신 **종류가 가리키는 상황**만 문장으로 만든다.
 *
 * ⚠️ 전부 사용자가 관찰할 수 있는 사실까지다. `상대가 일부러` · `마음이 식어서`처럼
 * 의도를 넣은 조각은 여기 없고 앞으로도 만들지 않는다(§17).
 *
 * ⚠️ `other`는 없다 — 종류를 모르는 장면으로 상황을 만들 수 없다. 그 사건은 상황 절
 * 없이 다른 두 조각으로만 질문이 된다.
 */
const EVENT_SITUATION: Partial<Record<RelationshipEventType, string>> = {
  contact_change: '답장 간격이 평소랑 달라지는 날에는',
  conflict: '얘기가 서로 엇갈렸던 날에는',
  distance: '괜히 거리감이 느껴지는 날에는',
  closer: '오랜만에 얘기가 잘 통한 날에는',
  care_received: '누가 챙겨준다고 느껴지는 순간에',
  affection_felt: '괜히 기분 좋았던 순간에',
  meeting: '만나기로 하고 일정을 맞출 때',
};

/* ══════════════════════════════════ ③ 묻는 절 (ask clause) — 축 × 방향 */

/**
 * 축마다 **무엇을 묻는가**. `light`는 취향을, `direct`는 경계를 묻는다.
 *
 * ⚠️ 두 register를 나눈 이유는 세기가 아니라 **묻는 대상**이다. `light`는 상대의
 * 평소를 묻고(부담 없음), `direct`는 두 사람 사이의 규칙을 묻는다(합의가 필요함).
 * 세기로만 나누면 같은 질문에 어미만 바뀐 두 문장이 생긴다 — §31이 막는 paraphrase
 * 중복이 바로 그 형태다.
 */
/**
 * ⚠️ v1.46.4 — `semantic`은 **이 표에 없다.** 표에서 나오는 질문이 아니기 때문이다
 * (`INTENT.semantic` 주석 참고). `Exclude`로 빼두면 새 register를 표에 넣어야 한다고
 * tsc가 잘못 요구하지 않고, 반대로 표에서 나오는 세 register를 빠뜨리면 여전히 막는다.
 */
const ASK: Record<
  MirrorAxisKey,
  Record<Exclude<QuestionRegister, 'semantic'>, string>
> = {
  contact: {
    light: '너는 연락 간격이 어느 쪽일 때 편해?',
    direct: '연락이 뜸해질 때 미리 한마디 있는 게 편해, 아니면 그냥 두는 게 편해?',
    situational: '나한테 어떻게 알려주는 게 너한테 제일 덜 번거로워?',
  },
  alone: {
    light: '너는 혼자 보내는 시간이 어느 정도일 때 편해?',
    direct: '각자 쉬고 싶은 날에 서로 어떻게 알려주면 제일 편할까?',
    situational: '내가 먼저 말 걸어주는 게 나아, 아니면 좀 두는 게 나아?',
  },
  conflict: {
    light: '너는 마음에 걸리는 게 생기면 보통 어떻게 푸는 편이야?',
    direct: '서로 예민해졌을 때, 바로 얘기하는 게 편해 아니면 좀 있다가가 편해?',
    situational: '내가 어떤 식으로 말해주면 네가 덜 답답할 것 같아?',
  },
  affection: {
    light: '너는 표현을 말로 들을 때랑 행동으로 느낄 때 중에 뭐가 더 와닿아?',
    direct: '표현이 줄어드는 시기에 네가 편한 방식은 어느 쪽이야?',
    situational: '어떤 게 너한테 제일 크게 남아?',
  },
  hobby: {
    light: '너는 같이 하는 것 중에 뭐가 제일 좋았어?',
    direct: '같이 하는 시간이랑 각자 시간이 어느 정도로 섞이면 좋을 것 같아?',
    situational: '다음엔 뭘 같이 해보면 좋을까?',
  },
};

/**
 * §30 — 이 질문이 **무엇 때문에 나왔는가**. 화면의 작은 캡션 한 줄이 된다.
 *
 * ⚠️ 판정 이름을 그대로 노출하지 않는다(`GAP`·`CONTRADICTION`은 내부 어휘다).
 */
const BASIS: Record<InsightVerdict, string> = {
  GAP: '말한 기준과 실제 반응이 갈린 자리라서',
  CONTRADICTION: '서로 다른 방향을 가리키는 근거가 같이 있어서',
  CHANGE: '두 시점의 답이 달라서',
  UNRESOLVED: '아직 확인되지 않은 자리라서',
  MATCH: '비슷하게 나온 기준이라 오히려 확인을 건너뛰기 쉬워서',
};

/* ══════════════════════════════════════════════════════════ fingerprint */

/**
 * §31 — 의미가 같은 질문이 두 번 나가지 않게 하는 키.
 *
 * `축:의도` 두 조각이다. **register 이름을 그대로 쓰지 않고 의도로 한 번 옮기는** 이유:
 * register는 '얼마나 세게 묻는가'로 읽히기 쉬운데, 중복 판정에 필요한 것은 세기가
 * 아니라 **무엇을 묻는가**다. 같은 것을 부드럽게/세게 묻는 두 문장은 한 질문이고,
 * 다른 것을 같은 세기로 묻는 두 문장은 두 질문이다.
 *
 * ⚠️ FREE의 `buildConversationQuestions`도 같은 규칙으로 fingerprint를 만든다
 * (`freeQuestionFingerprint`). 두 곳이 다른 규칙을 쓰면 dedup이 무의미해진다.
 */
const INTENT: Record<QuestionRegister, string> = {
  /** 상대의 평소를 묻는다 — 합의가 필요 없다 */
  light: 'habit',
  /** 두 사람의 규칙을 묻는다 — 합의가 필요하다 */
  direct: 'rule',
  /** 특정 장면에서 내가 어떻게 하면 되는지를 묻는다 — 행동이 필요하다 */
  situational: 'moment',
  /**
   * v1.46.4 §25 — **아직 확인되지 않은 것을 묻는다.** 의도가 셋과 다르다.
   *
   * 앞의 셋은 축이 정해지면 무엇을 물을지도 정해진다(표에서 나온다). 이건 반대다 —
   * 이 사용자의 장면에서 **무엇이 아직 확인되지 않았는가**가 질문을 정하므로, 같은
   * 축에서도 사용자마다 다른 것을 묻는다. 그래서 `light`/`direct`와 같은 자리를
   * 다투지 않고 함께 나갈 수 있다.
   */
  semantic: 'unverified',
};

function fingerprintOf(axis: MirrorAxisKey, register: QuestionRegister): string {
  return `${axis}:${INTENT[register]}`;
}

/** FREE 화면이 이미 쓴 축 질문의 fingerprint. Premium이 같은 것을 만들지 않게 한다 */
export function freeQuestionFingerprint(axis: MirrorAxisKey): string {
  return `${axis}:habit`;
}

/* ══════════════════════════════════════════════════════════════ 조립 */

export interface UserFitQuestionContext {
  axis: MirrorAxisKey | null;
  verdict: InsightVerdict;
  /** 사용자가 이 축에 답한 단계. 없으면 내 기준 절을 만들지 않는다 */
  declared: SelfLevel | null;
  /** 상대에 대해 이 축을 아는가. `'x'`(모름)면 규칙을 합의하자는 질문을 만들지 않는다 */
  targetLevel: TargetLevel | null;
  /** 이 Candidate에 붙은 사건 종류(관련성 순). 상황 절의 재료 */
  eventTypes: readonly RelationshipEventType[];
  tense: RelationshipTense;
  /** §29 — `ended`·`none`에서는 **아무것도 만들지 않는다** */
  allowsOutwardQuestions: boolean;
  /** §31 — 이미 사용자에게 보여준 fingerprint. 여기 있는 것은 만들지 않는다 */
  usedFingerprints: ReadonlySet<string>;
  /**
   * v1.46.4 §23 ~ §26 — **Deep Report AI가 쓴 확인 질문.** 없으면 undefined다.
   *
   * ⚠️ 이 값은 이미 서버 안전 게이트를 통과했다(`scanSemanticNarrative`). 여기서
   * 다시 안전 검사를 하지 않고, 이 파일이 하는 검사는 **질문으로 쓸 수 있는
   * 문장인가**(§26)뿐이다 — 안전과 형식은 다른 판정이다.
   */
  semanticAsk?: string;
  /**
   * §26 — 이 질문이 **사용자가 이미 아는 것을 묻지 않는지** 대조할 원문.
   *
   * ⚠️ 장면 원문이다. 모델이 장면을 질문으로 되돌려 놓는 실패
   * (`바빠서 연락이 없는 건 괜찮았는데` → `연락이 없으면 괜찮아?`)를 막는다.
   */
  sceneTexts?: readonly string[];
}

/**
 * 이 Candidate에 붙일 질문 최대 3개.
 *
 * ⚠️ **개수를 채우지 않는다**(§26 마지막 줄). 재료가 없으면 0개다. 특히:
 *
 * ```
 * 축이 없다             → 0개. 무엇에 대해 물을지가 없다
 * ended · none          → 0개. 상대에게 던지는 질문 자체를 만들지 않는다(QUESTION-FIT-04)
 * 상대를 전혀 모른다      → `direct` 없음. 아직 합의할 규칙을 꺼낼 단계가 아니다
 * 사건 없음              → `situational` 없음. 없는 장면으로 상황을 만들지 않는다(QUESTION-FIT-03)
 * 이미 쓴 fingerprint    → 그 register 통째로 빠진다(QUESTION-FIT-05)
 * ```
 */
export function buildUserFitQuestions(context: UserFitQuestionContext): UserFitQuestion[] {
  const { axis, verdict, declared, targetLevel, eventTypes, allowsOutwardQuestions } = context;

  /*
    §29 — 가장 바깥 게이트. `buildConnectionQuestions`가 v1.40.1에서 배운 것 그대로:
    **생성기 자체가 빈 배열을 돌려준다.** 화면에서만 막으면 새 화면이 생길 때 샌다.
  */
  if (!allowsOutwardQuestions) return [];
  if (!axis) return [];

  const self = declared ? SELF_CLAUSE[axis][declared] : undefined;
  const basis = BASIS[verdict];
  const questions: UserFitQuestion[] = [];

  const push = (register: QuestionRegister, text: string) => {
    const fingerprint = fingerprintOf(axis, register);
    if (context.usedFingerprints.has(fingerprint)) return;
    if (questions.some((item) => item.fingerprint === fingerprint)) return;
    questions.push({ id: `q_${axis}_${register}`, register, text, fingerprint, basis });
  };

  /*
    ══ ⓪ v1.46.4 §25 — **아직 확인되지 않은 것이 먼저다** ════════════════════

    §25의 우선순위는 `semantic unresolved point > event-linked issue > GAP > generic`
    이다. 표에서 나온 질문(①②③)은 축이 정해지면 내용도 정해지므로, 이 사용자의
    맥락에서 나온 질문이 있으면 그것이 먼저 와야 한다.

    ⚠️ **순서만 바꾼다. 표를 지우지 않는다.** AI가 없으면 ①②③이 그대로 남고, 그때
    질문이 0개가 되는 세션은 없다(QUESTION-07 — AI 없이도 질문이 만들어진다).

    ⚠️ 검사를 통과하지 못하면 **조용히 빠진다.** 고쳐 쓰지 않는다 — 모델이 쓴 문장을
    코드가 다듬으면 그 문장이 어느 계층의 것인지 알 수 없게 되고, §26의 검사 기준이
    '고치기 전'인지 '고친 뒤'인지도 흐려진다.
  */
  if (context.semanticAsk && isSendableQuestion(context.semanticAsk, context.sceneTexts ?? [])) {
    push('semantic', context.semanticAsk);
  }
  /*
    Operator Pass §25 — **같은 카드에서 같은 뜻의 질문을 두 번 보여주지 않는다.**

    Decomposition QA 실측에서 AI 확인 질문과 표 질문이 나란히 나왔다:

    ```
    Q(semantic)  연락이 평소랑 달라질 땐, 짧게라도 상황을 알려주는 게 너한텐 괜찮아?
    Q(direct)    …연락이 뜸해질 때 미리 한마디 있는 게 편해, 아니면 그냥 두는 게 편해?
    ```

    `direct`(두 사람의 규칙을 묻는다)와 `situational`(상황이 생겼을 때 어떻게 할지 묻는다)은
    AI 확인 질문이 묻는 것과 같은 자리다. usable한 semantic 질문이 붙었으면 그 둘을 빼고,
    가볍게 묻는 `light`만 남긴다.

    ⚠️ 문장 유사도를 계산하지 않는다. 한국어 paraphrase에 문자열 비교는 무력하고, register가
    '무엇을 묻는 자리인가'를 이미 값으로 들고 있다(`INTENT` 표).
  */
  const semanticAsked = questions.some((item) => item.register === 'semantic');

  /*
    ① 가볍게 — 내 기준 절을 붙이면 "나는 이런데 너는?"이 되어 상대가 답하기 쉬워진다.
    내 기준이 없으면 묻는 절만으로도 완결된 질문이다.
  */
  push('light', self ? `${self}, ${ASK[axis].light}` : ASK[axis].light);

  /*
    ② 조금 더 직접적으로 — **상대를 아는 경우에만.** `'x'`(모름)에서 두 사람의 규칙을
    합의하자고 물으면, 아직 그 단계가 아닌 관계에 규칙 협상을 들이미는 것이 된다.
  */
  if (!semanticAsked && targetLevel && targetLevel !== 'x') {
    push('direct', self ? `${self}, ${ASK[axis].direct}` : ASK[axis].direct);
  }

  /*
    ③ 상황이 생겼을 때 — 사용자가 실제로 알려준 장면의 **종류**가 있을 때만.
    가장 관련성 높은 사건 하나만 쓴다. 두 개를 겹치면 문장이 길어지고, 길어진 질문은
    실제로 보내지 않는다.
  */
  const situation = eventTypes.map((type) => EVENT_SITUATION[type]).find(Boolean);
  if (situation && !semanticAsked) {
    /*
      ⚠️ `situational`은 **자기 묻는 절을 따로 가진다.** 처음에는 상황 절 + `direct`로
      조립했는데, 그러면 `direct`와 뒷문장이 글자 그대로 같아서 한 화면에 같은 질문이
      두 번 나간다 — §31이 막는 paraphrase 중복의 교과서적 형태다. 세 register가
      서로 다른 것을 묻는다는 사실이 `INTENT` 표에 값으로 적혀 있는 이유이기도 하다.

      ⚠️ **묻는 절이 상황을 다시 가리키지 않는다**(HARDENING PHASE 6). 처음에는
      `그럴 때 …`로 시작했고, 조립 결과가 이렇게 나왔다:

      ```
      답장 간격이 평소랑 달라지는 날에는 그럴 때 나한테 어떻게 알려주는 게 …
                                    ^^^^^ 앞 절이 이미 그 때를 가리킨다
      ```

      실제로 보낼 수 없는 문장이다. 상황은 앞 절이 정하고, 묻는 절은 **묻기만** 한다.
    */
    push('situational', `${situation} ${ASK[axis].situational}`);
  }

  return questions.slice(0, 3);
}

/* ══════════════════════════════ §26 — 질문 검증 (AI 문장 전용) ══════════════ */

/**
 * §26 — AI가 쓴 문장을 **질문으로 쓸 수 있는가.**
 *
 * ══ 무엇을 검사하고 무엇을 검사하지 않는가 ════════════════════════════════
 *
 * ```
 * 검사한다    상대에게 실제로 보낼 수 있는 말인가 (형식)
 * 검사한다    답을 유도하지 않는가 · 상대 마음을 전제하지 않는가
 * 검사한다    사용자가 쓴 장면을 그대로 되돌려 놓지 않았는가
 * 검사하지 않는다  위험한 주장 — 서버 `scanSemanticNarrative`가 이미 걸렀다
 * ```
 *
 * 두 계층을 나누는 이유는 **실패 모드가 다르기 때문**이다. 안전 위반은 '말하면 안 되는
 * 것'이고, 여기서 걸리는 것은 '말해도 되지만 질문이 아닌 것'이다 — 후자는 화면에서
 * 질문 칸이 설명 문장으로 채워지는 형태로 나타난다(따옴표 안에 설명이 들어간다).
 */
/**
 * v1.46.4 Final Minimal Fix — **이 질문에 누가 답하는가.**
 *
 * ```
 * TARGET     상대가 답한다     current VERIFY로 쓸 수 있다 · ended에서는 쓰면 안 된다
 * SELF       사용자 자신이 답한다 ended 회고 질문으로 쓸 수 있다 · current에서는 쓰면 안 된다
 * AMBIGUOUS  판별할 표지가 없다  current에서는 쓰지 않는다(상대에게 보낼 말이라는 보장이 없다)
 * ```
 *
 * ⚠️ 이전 검사는 '물음표 + 1인칭 주어'만 봤고, Operator Pass QA에서
 * `…다시 꺼내는 편이었는지, 그냥 끝난 일이 더 많았는지 떠오르니?`가 통과해 상대 질문 칸에
 * 올라갔다. 문장형이 아니라 **답하는 사람**을 판별해야 하는 문제다.
 *
 * 판별 순서 (앞이 이긴다):
 *   ① 기억·회고 어미(떠오르니? · 생각나? · ~했을까? · 왜 ~을까?) → SELF
 *   ② 상대를 부르는 토큰(너는 · 너한테 · 네가 …) 또는 상대에게 부탁(알려줄 수 있어?) → TARGET
 *   ③ 1인칭 주어(나는 · 내가 · 난) → SELF
 *   ④ 상대 선호를 묻는 어미(편해? · 괜찮아? · 어때? · 편이야? · 달라? …) → TARGET
 *   ⑤ 나머지 → AMBIGUOUS
 *
 * ⚠️ '너'는 **토큰 단위**로만 본다 — `너무`의 `너`는 상대를 부르는 말이 아니다.
 */
export type VerificationRole = 'TARGET' | 'SELF' | 'AMBIGUOUS';

/** 받침이 ㅆ인 글자인가 — `했을까 · 걸렸을까 · 됐을까`의 회고 어미를 어간과 무관하게 잡는다 */
function hasSsangSiotBatchim(char: string | undefined): boolean {
  if (!char) return false;
  const code = char.charCodeAt(0) - 0xac00;
  return code >= 0 && code < 11172 && code % 28 === 20;
}

export function detectVerificationRole(text: string): VerificationRole {
  const trimmed = text.trim();

  const recallEnding = /(떠오르|생각나|기억나)(니|나|지|요)?\?$/.test(trimmed);
  const retroEnding =
    trimmed.endsWith('을까?') && hasSsangSiotBatchim(trimmed.charAt(trimmed.length - 4));
  const whyRetro = /(^|[\s,])왜[^?]{0,40}(을까|ㄹ까|았지|었지|했지)\?$/.test(trimmed);
  if (recallEnding || retroEnding || whyRetro) return 'SELF';

  const partnerToken = /(^|[\s,])(너|넌|너는|너도|너한테|너한텐|너랑|너의|네가|네게)(?=[\s,?.!]|$)/.test(trimmed);
  const partnerRequest = /(알려|말해|해|정해|기다려|챙겨|맞춰)\s*줄\s*(수\s*있어|래)|줄\s*수\s*있어\?|(물어볼|얘기할|말할)\s*수\s*있어\?/.test(trimmed);
  if (partnerToken || partnerRequest) return 'TARGET';

  if (/(^|[\s,])(나는|내가|난)\s/.test(trimmed)) return 'SELF';

  if (/(편해|괜찮아|어때|좋아|가능해|편이야|자연스러워|달라)\?/.test(trimmed)) return 'TARGET';

  return 'AMBIGUOUS';
}

export function isSendableQuestion(text: string, sceneTexts: readonly string[]): boolean {
  const trimmed = text.trim();

  /* ① 질문이어야 한다. 물음표가 없으면 그건 설명이다 */
  if (!trimmed.endsWith('?')) return false;
  /* ② 길면 실제로 보내지 않는다(§28 — 친구가 메시지로 보낼 수 있는 수준) */
  if (trimmed.length > 90) return false;

  /*
    ③ 심리검사 말투 — §28의 금지 조각. `buildUserFitQuestions`의 조립 결과에는 이
    자리가 없지만, AI 문장에는 들어올 수 있다.
  */
  if (/인가요|습니까|하십니까|어떠신가요|말씀해|기술하|서술하/.test(trimmed)) return false;

  /*
    ④ 주어가 **상대**인 질문을 만들지 않는다(§26 · §29).

    ```
    ❌ 상대는 왜 그랬을까?          상대 마음을 추정하게 만든다
    ❌ 상대가 어떻게 생각하는지 물어봐  질문이 아니라 지시다
    ```

    ⚠️ '너는'은 허용이다 — 그게 상대에게 직접 묻는 말이다. 금지되는 것은 3인칭으로
    상대를 **대상화**하는 문장이다.
  */
  if (/상대(는|가|방은|방이|의)/.test(trimmed)) return false;

  /*
    ④-b **자기에게 묻는 회고 질문은 상대에게 보내는 질문이 아니다** (v1.46.4 SEMANTIC
    DECOMPOSITION Final QA · A10).

    gpt-5.4 실측에서 current 관계의 VERIFY가 이렇게 나왔고, 물음표로 끝나서 이 검사를
    통과해 '상대에게 물어볼 질문' 칸에 올라갔다:

    ```
    ❌ 서운한 일이 지나간 뒤, 나는 말할 타이밍을 놓친 쪽이 더 걸렸을까?
    ❌ 혼자 있는 시간을 못 챙긴 날에도 괜찮았을까, 아니면 계속 남았을까?
    ```

    주어가 '나'이거나 과거 회고 어미(~했을까?)인데 **상대를 부르는 표지가 없으면** 자기
    점검이다. ended의 회고 질문으로는 맞지만, 상대에게 보낼 말은 아니다.

    ⚠️ '나는'이 들어간 정상 질문은 막지 않는다 — 내 기준을 먼저 말하고 상대에게 묻는 형태
    (`나는 좀 초조해지는데, 짧게라도 알려줄 수 있어?`)는 상대를 부르는 표지가 있다.
  */
  if (detectVerificationRole(trimmed) !== 'TARGET') return false;

  /*
    ⑤ 답을 유도하지 않는다(§26). `~한 게 맞지?` · `~지 않아?` 계열.

    ⚠️ `~아니면`은 허용이다. 두 선택지를 나란히 주는 것은 유도가 아니라 선택지 제시고,
    이 파일의 `direct` 질문들이 전부 그 형태다.
  */
  if (/맞지\?|맞잖아|그렇지\?|않아\?|아니야\?/.test(trimmed)) return false;

  /*
    ⑥ 죄책감 유도 — §29의 금지 목록. 주어가 '나'인데 상대의 부채를 말하는 형태다.
  */
  if (/기다렸는데|서운했는데|나만|참았는데/.test(trimmed)) return false;

  /*
    ⑦ §26 마지막 줄 — **장면 원문을 그대로 노출하지 않는다.**

    ⚠️ 사용자가 서비스에 한 말과 상대에게 하는 말은 다른 발화다(§24). 장면 문장을
    질문에 끼워 넣으면, 사용자가 5분 전에 적은 사적인 기록이 상대에게 보내는
    메시지가 된다.

    ⚠️ 판정은 **긴 부분 문자열**로 한다. 어휘가 겹치는 것은 정상이다(장면이 '연락'
    이야기면 질문에도 '연락'이 나온다) — 막아야 하는 것은 문장 조각을 옮겨온 것이다.
  */
  const compact = trimmed.replace(/[^0-9A-Za-z가-힣]/g, '');
  for (const scene of sceneTexts) {
    const sceneCompact = scene.replace(/[^0-9A-Za-z가-힣]/g, '');
    for (let i = 0; i + 12 <= sceneCompact.length; i += 1) {
      if (compact.includes(sceneCompact.slice(i, i + 12))) return false;
    }
  }

  return true;
}
