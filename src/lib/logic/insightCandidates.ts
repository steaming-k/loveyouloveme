import { MIRROR_AXES } from '@/data/axes';
import {
  withCompanionParticle,
  withObjectParticle,
  withSubjectParticle,
} from '@/lib/korean';
import { RELATIONSHIP_EVENT_LABEL } from '@/data/relationshipEvents';
import type { SelfLevel } from '@/data/firstContact';
import { chapterSoWhatOf } from '@/lib/premiumSoWhat';
import type {
  CrossSourceInsight,
  EvidenceRef,
  InsightCandidate,
  InsightConfidence,
  InsightVerdict,
  MirrorAxisKey,
  MirrorInsight,
  PremiumChapter,
  PremiumLensKind,
  RelationshipEvent,
  RelationshipEventType,
  RelationshipTense,
  TargetLevel,
  TargetProfile,
  UserFitQuestion,
} from '@/types';
import { repeatedWithinAnalysis, selectRelevantEvents } from './eventRelevance';
import { buildUserFitQuestions } from './userFitQuestions';

/**
 * Insight Candidate Engine — **INSIGHT-FIRST의 생성 계층** (v1.46.4 · §12 ~ §16 · §23)
 *
 * ══ 무엇이 바뀌었나 ═══════════════════════════════════════════════════════
 *
 * v1.46.3까지 유료 결과의 문장은 두 곳에서 왔다:
 *
 * ```
 * ① Chapter 규칙 문장    kind → 고정 요약/강조         (logic/premiumChapters.ts)
 * ② kind별 고정 SO WHAT  kind → 고정 두 문장           (lib/premiumSoWhat.ts)
 * ```
 *
 * 둘 다 입력이 **`kind` 하나**였다. 그래서 근거가 8종인 사용자와 2종인 사용자가
 * 같은 kind면 **한 글자도 다르지 않은 문장**을 받았다. UT에서 나온
 * "AI까지 썼는데 왜 내 얘기가 아닌가"의 구조적 원인이 여기다 — AI 문장은 위에 덧붙는
 * 장식이었고, 결론은 언제나 표에서 나왔다.
 *
 * 이 파일은 결론을 **표에서 꺼내지 않고 조립한다**:
 *
 * ```
 * [축 × 판정 핵심절]   무엇이 보이는가
 * + [근거 조합절]       그게 어떤 자료들이 겹쳐서 보이는가   ← 사용자마다 다르다
 * + [장면 연결절]       네가 알려준 어떤 장면이 같은 자리인가 ← 사용자마다 다르다
 * ```
 *
 * 뒤의 두 절이 evidence 조합에서 직접 나오므로, **같은 축·같은 판정이어도 근거가
 * 다르면 문장이 다르다**(§23 · VALUE-03이 값으로 검사한다).
 *
 * ══ 이 파일이 바꾸지 않는 것 (§13) ════════════════════════════════════════
 *
 * ```
 * Compatibility score       읽기만 한다
 * Mirror MATCH/GAP/CHANGE   읽기만 한다
 * History state             건드리지 않는다
 * Premium eligibility       `available` 판정은 여전히 Chapter가 정한다
 * ```
 *
 * ⚠️ **입력은 전부 이미 만들어진 값이다.** 이 파일에 새 판정 함수가 생기면 그건
 * presentation layer의 경계를 넘은 것이고, `lib/resultPriority.ts`가 순서를 판정
 * 파일 밖에 둔 이유와 같은 이유로 금지다.
 *
 * ══ AI와의 관계 (§16) ═════════════════════════════════════════════════════
 *
 * ```
 * 이 파일       근거 조합 → SO WHAT / WHY / VERIFY 를 **결정론으로** 만든다
 * AI           같은 근거를 더 자연스러운 말로 옮긴다. 실패하면 위 문장이 그대로 남는다
 * ```
 *
 * 순서가 중요하다. v1.45까지는 AI 실패 시 '규칙 요약'으로 떨어졌고 그 문장은 입력
 * 재진술이었다. 이제 fallback 자체가 SO WHAT이다 — **AI가 죽어도 결론이 남는다**
 * (VALUE-12).
 */

/* ═══════════════════════════════════════════════════════ 어휘 · 표 */

function axisLabel(key: MirrorAxisKey): string {
  return MIRROR_AXES.find((axis) => axis.key === key)?.label ?? key;
}

/**
 * §15 — **축 × 판정의 핵심절.** 조립의 첫 조각이다.
 *
 * ⚠️ 이 표가 '고정 SO WHAT'으로 되돌아간 것이 아니다. 차이는 입력이다:
 *
 * ```
 * 예전   kind(Chapter 주제) → 문장 전체
 * 지금   축 × 판정 → 문장의 **첫 절만**. 나머지는 evidence에서 조립된다
 * ```
 *
 * 축과 판정은 사용자의 실제 답에서 나온 값이므로, 이 조각까지 없애면 SO WHAT이
 * 무엇에 대한 말인지 사라진다. 조립에는 고정된 뼈대가 필요하고, 여기까지가 그 뼈대다.
 *
 * ⚠️ **인과를 주장하지 않는다.** 전부 '보인다 / 가리킨다'까지이고 '~때문이다'는 없다.
 * ⚠️ **상대의 마음을 말하지 않는다.** 주어는 '두 기준' 또는 '너'다.
 */
const AXIS_VERDICT: Record<MirrorAxisKey, Partial<Record<InsightVerdict, string>>> = {
  contact: {
    GAP: '연락에서는 네가 말한 기준보다 실제로 더 크게 반응한 자리가 있어.',
    CONTRADICTION: '연락에 대해 서로 반대 방향을 가리키는 답이 같이 있어.',
    CHANGE: '연락에 대한 답이 두 시점에서 다르게 남아 있어.',
    MATCH: '연락은 네가 말한 기준과 같은 방향으로 나왔어.',
    UNRESOLVED: '연락은 아직 어느 쪽이라고 말할 근거가 모자라.',
  },
  alone: {
    GAP: '혼자 있는 시간에 대해 말한 기준과, 실제로 신경 쓰인 자리가 서로 달라.',
    CONTRADICTION: '혼자 있고 싶은 마음과 가까이 있고 싶은 마음이 같이 나왔어.',
    CHANGE: '개인 시간에 대한 답이 두 시점에서 다르게 남아 있어.',
    MATCH: '개인 시간은 네가 말한 기준과 같은 방향으로 나왔어.',
    UNRESOLVED: '개인 시간은 아직 어느 쪽이라고 말할 근거가 모자라.',
  },
  conflict: {
    GAP: '갈등에서 갈리는 건 무슨 말을 하느냐가 아니라 언제 이야기하고 싶으냐야.',
    CONTRADICTION: '갈등 상황에 대해 서로 다른 방향의 답이 같이 있어.',
    CHANGE: '갈등을 푸는 방식에 대한 답이 두 시점에서 다르게 남아 있어.',
    MATCH: '갈등을 푸는 방식은 네가 말한 기준과 같은 방향으로 나왔어.',
    UNRESOLVED: '갈등은 아직 어느 쪽이라고 말할 근거가 모자라.',
  },
  affection: {
    GAP: '애정 표현에서 갈리는 건 양이 아니라 방식이야.',
    CONTRADICTION: '표현에 대해 서로 다른 방향을 가리키는 답이 같이 있어.',
    CHANGE: '표현에 대한 답이 두 시점에서 다르게 남아 있어.',
    MATCH: '애정 표현은 네가 말한 기준과 같은 방향으로 나왔어.',
    UNRESOLVED: '애정 표현은 아직 어느 쪽이라고 말할 근거가 모자라.',
  },
  hobby: {
    GAP: '같이 보내는 시간에 대해 말한 기준과 실제 반응이 서로 다른 곳을 가리켜.',
    CONTRADICTION: '같이 하는 시간에 대해 서로 다른 방향의 답이 같이 있어.',
    CHANGE: '같이 보내는 시간에 대한 답이 두 시점에서 다르게 남아 있어.',
    MATCH: '같이 보내는 시간은 네가 말한 기준과 같은 방향으로 나왔어.',
    UNRESOLVED: '같이 보내는 시간은 아직 어느 쪽이라고 말할 근거가 모자라.',
  },
};

/**
 * §15 — **근거 조합절의 재료.** 여기가 개인화의 실제 출처다.
 *
 * ⚠️ 라벨은 사용자가 **어디서 그 답을 했는지**를 가리킨다. 답의 내용(값)은 넣지
 * 않는다 — 그건 근거 토글 안에 있다(§36 · VALUE-01). "연락 4/5"는 여기 오지 않고
 * "네가 말한 기준"만 온다.
 */
const SOURCE_PHRASE: Record<EvidenceRef['source'], string> = {
  declared: '네가 말한 기준',
  relationship: '이전 관계에서 크게 남았던 것',
  current_relationship: '지금 관계에 대해 답한 것',
  adaptive: '추가로 답한 축',
  observed: '사진에서 반복해 보인 것',
  history: '저장된 관찰 기록',
  target: '상대에 대해 알려준 것',
  user_reported_event: '네가 알려준 장면',
  deep_followup: '심화 질문에 답한 것',
  compatibility: '동기화율에서 갈린 축',
  mbti_lens: 'MBTI 축 비교',
};

/**
 * `ended`(former) 전용 교체분 (v1.45 LOVY-09와 같은 규칙).
 *
 * ⚠️ **브라우저 실측에서 잡힌 결함이다.** 끝난 관계 세션의 두 번째 카드가 이렇게 나왔다:
 *
 * ```
 * 갈등을 푸는 방식에 대한 답이 두 시점에서 다르게 남아 있어.
 * 지금 관계에 대해 답한 것과 …가 같은 자리를 가리켜.       ← '지금 관계'가 없다
 * ```
 *
 * 이 사용자에게 `지금 관계`는 존재하지 않는다. `current_relationship`이라는 **출처
 * 이름**은 여전히 맞지만(S30에서 답한 값이다), 그걸 부르는 **말**은 시제를 따라야 한다.
 *
 * ⚠️ 부인 문장으로 피하지 않고 문장 자체를 갈아 끼운다 — v1.45가 배운 방식 그대로다.
 * ⚠️ 나머지 출처는 시제와 무관해서 여기 없다(`이전 관계에서 크게 남았던 것`은 어느
 * 시제에서도 과거이고, `네가 말한 기준`은 시점을 말하지 않는다).
 */
const SOURCE_PHRASE_FORMER: Partial<Record<EvidenceRef['source'], string>> = {
  current_relationship: '그 관계에 대해 답한 것',
};

function sourcePhraseOf(source: EvidenceRef['source'], tense: RelationshipTense): string {
  return (tense === 'former' ? SOURCE_PHRASE_FORMER[source] : undefined) ?? SOURCE_PHRASE[source];
}

/**
 * §21 — **무료 화면이 이미 보여주는 출처.**
 *
 * 이 집합 **밖**의 근거가 하나라도 있어야 Paywall에서 "여기까지는 무료로 보여,
 * 그런데 …"라고 말할 자격이 생긴다. 없는데 tease하면 가짜 mystery다(§21 첫 줄).
 *
 * ⚠️ 목록을 늘릴 때는 무료 화면이 **실제로** 그 출처를 그리는지 먼저 확인해야 한다.
 * 여기에 잘못 넣으면 Premium이 팔 게 있는데도 tease를 못 하고, 빼먹으면 무료에서
 * 이미 본 것을 유료라고 판다.
 */
const FREE_VISIBLE_SOURCES = new Set<EvidenceRef['source']>([
  /* /mirror 비교 행 */
  'declared',
  'relationship',
  'current_relationship',
  /* /compatibility 동기화율 4축 */
  'target',
  'compatibility',
]);

/* ═════════════════════════════════════════════════ 판정 → 표현 어휘 */

/**
 * ⚠️ **판정을 다시 하지 않는다.** 이미 계산된 `CrossSourceInsightType`을 표현 어휘로
 * 옮기기만 한다. `REPEATED_SIGNAL`이 `MATCH`로 오는 것은 '같은 신호가 반복됐다'가
 * 표현 계층에서는 일치 계열이기 때문이고, 판정 자체는 그대로 남아 있다.
 */
const TYPE_TO_VERDICT: Record<CrossSourceInsight['type'], InsightVerdict> = {
  CONTRADICTION: 'CONTRADICTION',
  GAP: 'GAP',
  CHANGE: 'CHANGE',
  MATCH: 'MATCH',
  REPEATED_SIGNAL: 'MATCH',
  UNKNOWN: 'UNRESOLVED',
};

/** 판정 하나를 고를 때의 강함 순서 — 더 새로 알게 되는 것이 이긴다 */
const VERDICT_WEIGHT: Record<InsightVerdict, number> = {
  CONTRADICTION: 5,
  GAP: 4,
  CHANGE: 3,
  UNRESOLVED: 2,
  MATCH: 1,
};

/** §14 — 이 판정이 '어긋남 계열'인가. Event relevance의 방향 질의에 쓴다 */
function directionOf(verdict: InsightVerdict): 'divergent' | 'convergent' | 'unknown' {
  if (verdict === 'GAP' || verdict === 'CONTRADICTION' || verdict === 'CHANGE') return 'divergent';
  if (verdict === 'MATCH') return 'convergent';
  return 'unknown';
}

/* ═══════════════════════════════════════════════════════════ 조립 */

/**
 * 근거 조합절. **두 종류 이상일 때만 만든다** — 한 종류는 '조합'이 아니다.
 *
 * ⚠️ **조사를 하드코딩하지 않는다.** 처음 구현은 `${a}과 ${b}가`였고, 브라우저 실측에서
 * 바로 드러났다:
 *
 * ```
 * 네가 말한 기준과 지금 관계에 대해 답한 것가 같은 자리를 가리켜   ← 것'가'
 * ```
 *
 * `SOURCE_PHRASE`의 라벨에 받침 있는 것과 없는 것이 섞여 있어서, 이 자리는 반드시
 * `lib/korean.ts`를 거쳐야 한다 — v1.46 PremiumLens가 `화과 금이`로 같은 실패를
 * 겪고 `withCompanionParticle`을 만든 자리와 정확히 같은 종류다.
 */
function sourceClause(
  sources: readonly EvidenceRef['source'][],
  tense: RelationshipTense,
): string {
  const phrases = sources.map((source) => sourcePhraseOf(source, tense)).filter(Boolean);
  if (phrases.length < 2) return '';
  if (phrases.length === 2) {
    return ` ${withCompanionParticle(phrases[0]!)} ${withSubjectParticle(phrases[1]!)} 같은 자리를 가리켜.`;
  }
  /*
    3종 이상은 전부 나열하지 않는다. 나열은 '많다'만 말하고 '무엇이 겹쳤는가'는
    흐린다 — 앞의 둘을 이름으로 말하고 나머지는 수로 말한다.
  */
  return ` ${withCompanionParticle(phrases[0]!)} ${withObjectParticle(phrases[1]!)} 비롯해 ${phrases.length}가지가 같은 자리를 가리켜.`;
}

/**
 * 장면 연결절 (§17 · §24).
 *
 * ⚠️ **본문을 인용하지 않는다.** 인용은 근거 토글의 몫이고(§36), 여기서는 종류만
 * 말한다. 본문을 결론 문장에 끼워 넣으면 그 순간 SO WHAT이 다시 입력 재진술이 된다.
 *
 * ⚠️ §24 — 반복을 말할 때 **`너는 원래 이런 패턴이야`라고 하지 않는다.** 주어를
 * '이번에 알려준 장면들'로 묶어둔다. History의 시계열 stable pattern(3관찰 규칙)과
 * 이 문장이 섞이면, 한 번의 분석 안에서 본 것을 사람의 성질로 말하게 된다.
 */
function eventClause(
  linked: readonly RelationshipEvent[],
  repeated: ReturnType<typeof repeatedWithinAnalysis>,
): string {
  if (linked.length === 0) return '';

  if (repeated && linked.some((event) => event.type === repeated.type)) {
    return ` 한 번의 장면이 아니라, 이번에 알려준 ${repeated.label} 장면 ${repeated.count}개에서 같은 지점이 반복됐어.`;
  }
  if (linked.length >= 2) {
    const labels = [...new Set(linked.map((event) => RELATIONSHIP_EVENT_LABEL[event.type]))];
    return labels.length >= 2
      ? ` 네가 알려준 ${labels[0]} 장면과 ${labels[1]} 장면이 같은 자리에 놓여 있어.`
      : ` 네가 알려준 ${labels[0]} 장면 ${linked.length}개가 같은 자리에 놓여 있어.`;
  }
  return ` 네가 알려준 ${RELATIONSHIP_EVENT_LABEL[linked[0]!.type]} 장면도 같은 자리에 있어.`;
}

/**
 * §22 — WHY IT MATTERS. **판정이 아니라 '그래서 뭐가 문제인가'**를 말한다.
 *
 * ⚠️ 시제를 따른다. `former`에서는 다음 행동을 권하지 않고 '무엇을 알게 됐는가'까지다
 * (v1.40 Lifecycle Trust Boundary · v1.46.4 §15 former 규칙과 같다).
 */
const WHY: Record<InsightVerdict, { current: string; former: string }> = {
  GAP: {
    current:
      '기준과 반응이 어긋난 자리는 스스로도 왜 불편한지 설명하기 어려워서, 상대에게는 "그냥 좀 그래"로 전달되기 쉬워.',
    former:
      '그 어긋남은 상대가 만든 것도 네가 잘못한 것도 아니야. 다음에 더 일찍 알아차릴 수 있는 신호로 남길 수 있어.',
  },
  CONTRADICTION: {
    current:
      '둘 다 진짜여서, 상황마다 어느 쪽을 먼저 챙길지 정해두지 않으면 스스로도 일관되지 않다고 느끼기 쉬워.',
    former: '원하는 것과 실제 반응이 달랐던 건 모순이 아니라 두 가지가 동시에 있었다는 뜻이야.',
  },
  CHANGE: {
    current:
      '어느 쪽이 진짜 너인지보다, 어떤 상황에서 다르게 나왔는지가 다음에 확인할 것이 돼.',
    former: '기준이 흔들린 게 아니라 옮겨갔을 수 있어 — 그 이동을 알아차리는 게 남는 것이야.',
  },
  UNRESOLVED: {
    current:
      '근거가 부족한 자리를 결론처럼 다루면, 근거가 충분한 나머지 결과까지 같이 믿기 어려워져.',
    former: '모른다고 말할 수 있는 자리를 남겨두는 것도 하나의 정리야.',
  },
  MATCH: {
    current:
      '비슷한 축은 편한 만큼 확인을 건너뛰기 쉬워서, 어긋나는 순간에 오히려 더 크게 느껴질 수 있어.',
    former: '잘 맞았던 자리는 다음 관계에서 네가 무엇을 편하게 느끼는지의 기준이 돼.',
  },
};

/** 이 Candidate가 말할 수 없는 것. **항상 붙는다** */
function limitationFor(input: {
  confidence: InsightConfidence;
  hasEvent: boolean;
  tense: RelationshipTense;
}): string {
  if (input.hasEvent) {
    return input.tense === 'former'
      ? '장면은 네가 기억하는 것이야. 그때 상대가 무슨 마음이었는지는 여기서 알 수 없어.'
      : '장면은 네가 기억하는 것이야. 상대가 무슨 마음이었는지는 여기서 알 수 없어.';
  }
  if (input.confidence === 'limited') {
    return '근거가 한 종류뿐이라 여기서는 가능성까지만 말할 수 있어.';
  }
  return '이건 네가 입력한 자료를 이어본 관찰이야. 진단이나 확정이 아니야.';
}

/* ═════════════════════════════════════════════════════ 우선순위 (§14) */

/**
 * §14 — 낮을수록 먼저 온다.
 *
 * ```
 * 0  모순 · 의미 있는 GAP        이번에 새로 보이는 것
 * 1  아직 확인되지 않은 중요한 점
 * 2  여러 출처가 겹친 연결
 * 3  네가 알려준 장면과 이어진 것
 * 4  CHANGE
 * 5  MATCH                       이미 알고 있던 것
 * ```
 *
 * ⚠️ §14 마지막 줄 — **장면이 붙었다는 이유만으로 없는 문제를 크게 만들지 않는다.**
 * 그래서 `hasUserReportedEvent`는 등급 3에서만 작동하고, MATCH를 GAP 위로 올리지
 * 못한다. 장면은 이야기를 **선명하게** 하지 **심각하게** 하지 않는다.
 */
function rankOf(candidate: InsightCandidate): number {
  if (candidate.hasContradiction) return 0;
  if (candidate.verdict === 'GAP' && candidate.evidenceSourceCount >= 2) return 0;
  if (candidate.hasUnresolvedPoint) return 1;
  if (candidate.evidenceSourceCount >= 2) return 2;
  if (candidate.hasUserReportedEvent) return 3;
  if (candidate.verdict === 'CHANGE') return 4;
  return 5;
}

/* ═══════════════════════════════════════════════════════════ 입력 */

export interface InsightCandidateInput {
  /** 이미 만들어진 Chapter. **여기서 다시 만들지 않는다** */
  chapters: readonly PremiumChapter[];
  /** Chapter가 근거로 삼은 결정론 Insight. id로 찾는다 */
  insights: readonly CrossSourceInsight[];
  target: TargetProfile;
  /** 축별 declared 단계. `selfLevelOf`가 이미 계산한 값을 받는다 */
  declaredLevels: ReadonlyMap<MirrorAxisKey, SelfLevel>;
  tense: RelationshipTense;
  allowsOutwardQuestions: boolean;
  /** §31 — FREE·Mirror가 이미 쓴 질문 fingerprint */
  usedFingerprints: ReadonlySet<string>;
  /** §10 — Candidate 하나에 붙일 장면 수. FREE와 Premium이 서로 다른 예산을 쓴다 */
  eventsPerCandidate?: number;
}

/* ═══════════════════════════════════════════════════════════ 본체 */

export function buildInsightCandidates(input: InsightCandidateInput): InsightCandidate[] {
  const {
    chapters,
    insights,
    target,
    declaredLevels,
    tense,
    allowsOutwardQuestions,
    usedFingerprints,
    eventsPerCandidate = 3,
  } = input;

  const byId = new Map(insights.map((insight) => [insight.id, insight]));
  const events = target.events ?? [];
  const repeated = repeatedWithinAnalysis(events);

  /*
    ⚠️ fingerprint 집합은 **Candidate를 만들어 가며 자란다.** 처음에는 FREE에서 쓴
    것만 들어 있고, 첫 Candidate가 질문을 만들면 그 fingerprint가 추가되어 다음
    Candidate가 같은 질문을 만들지 못한다(§31 · QUESTION-FIT-05).
  */
  const used = new Set(usedFingerprints);
  const candidates: InsightCandidate[] = [];

  for (const chapter of chapters) {
    const linkedInsights = chapter.insightIds
      .map((id) => byId.get(id))
      .filter((item): item is CrossSourceInsight => Boolean(item));

    /*
      ══ 파생 Chapter는 Candidate가 되지 않는다 ═════════════════════════════

      ⚠️ 이 게이트가 없으면 **빈 Candidate가 상위에 뜬다.** 실제로 처음 구현에서
      그랬다: `next_check`(앞 Chapter에서 파생된 행동·질문)와 `closing`(앞 Chapter의
      마무리)은 자기 Insight가 없어서 `evidenceSourceCount = 0` · `axis = null`이
      되고, 판정이 `UNRESOLVED`로 떨어진다. 그런데 `rankOf`의 등급 1이
      `hasUnresolvedPoint`라서 **근거 5종을 이은 GAP Candidate보다 앞에 놓였다.**

      원인은 우선순위 표가 아니라 입력이다. 그 둘은 '말할 거리'가 아니라 앞에서 한
      말의 **파생물**이고, 그래서 `chapterSoWhatOf`도 처음부터 그 둘에 null을
      돌려줬다. 같은 판단을 여기서도 한다 — 두 곳이 다른 답을 내면 화면에 근거 없는
      결론이 선다.

      ⚠️ `uncertainty`는 조건부다. 실제로 이어붙인 Insight가 있으면 그건 §14 등급 1의
      '아직 확인되지 않은 중요한 점'이 맞고, 없으면 내용 없는 안내문이다.
    */
    if (chapter.kind === 'next_check' || chapter.kind === 'closing') continue;
    if (chapter.kind === 'uncertainty' && linkedInsights.length === 0) continue;

    /* ── 판정: 가장 강한 것 하나 ─────────────────────────────────── */
    const verdict: InsightVerdict =
      chapter.kind === 'uncertainty'
        ? 'UNRESOLVED'
        : linkedInsights
            .map((insight) => TYPE_TO_VERDICT[insight.type])
            .sort((a, b) => VERDICT_WEIGHT[b] - VERDICT_WEIGHT[a])[0] ?? 'UNRESOLVED';

    /* ── 축: Insight가 이미 들고 있는 값 ─────────────────────────── */
    const primaryAxis = linkedInsights.find((insight) => insight.axis)?.axis ?? null;

    /* ── 근거 ────────────────────────────────────────────────────── */
    const evidenceRefs: EvidenceRef[] = linkedInsights.flatMap((insight) => insight.evidenceRefs);
    const sources = [...new Set(evidenceRefs.map((ref) => ref.source))];
    const hasOutsideFreeEvidence = sources.some((source) => !FREE_VISIBLE_SOURCES.has(source));

    /* ── 장면: 이 이야기와 관련 있는 것만 (§9 · §10) ─────────────── */
    const relevance = selectRelevantEvents(
      events,
      {
        axis: primaryAxis,
        direction: directionOf(verdict),
        tense,
        unresolved: verdict === 'UNRESOLVED',
      },
      eventsPerCandidate,
    );
    const linkedEvents = relevance
      .map((item) => events.find((event) => event.id === item.eventId))
      .filter((event): event is RelationshipEvent => Boolean(event));

    /*
      ── 질문은 여기서 만들지 않는다 (§31 · 정렬 순서 문제) ───────────────────

      ⚠️ 처음에는 이 자리에서 만들었고, 브라우저 실측에서 바로 드러났다: 화면의
      **첫 번째** Candidate에 질문이 하나도 없고 두 번째에 두 개가 붙었다.

      원인은 순서였다. 질문은 Chapter 순서로 만들어지고 `used` 집합이 그 순서대로
      자라는데, 목록은 그 **뒤에** 우선순위로 다시 정렬된다. 그래서 '먼저 질문을
      가져간 Candidate'와 '화면에서 먼저 보이는 Candidate'가 서로 달랐다.

      dedup 집합이 자라는 순서는 **사용자가 읽는 순서와 같아야 한다.** 그래서 질문
      조립을 정렬 뒤로 옮겼다(아래 `assignQuestions`).
    */

    /* ── 문장: 조립 or fallback (§15 · §48) ──────────────────────── */
    const core = primaryAxis ? AXIS_VERDICT[primaryAxis][verdict] : undefined;
    const composed = Boolean(core);
    const fallback = chapterSoWhatOf(chapter, { tense });

    const soWhat = core
      ? `${core}${sourceClause(sources, tense)}${eventClause(linkedEvents, repeated)}`
      : /*
          §48 — 축이 없는 Chapter(self_profile · self_tension 등)에는 조립의 뼈대가
          없다. 그때만 예전 kind 고정문이 남는다. 없으면 Chapter가 이미 들고 있는
          규칙 요약이 그 자리를 지킨다 — 문장이 사라지는 자리는 만들지 않는다.
        */
        (fallback?.soWhat ?? chapter.deterministicTakeaway);

    const whyItMatters =
      (tense === 'former' ? WHY[verdict].former : WHY[verdict].current) ||
      (fallback?.whyItMatters ?? '');

    const confidence: InsightConfidence =
      sources.length >= 3 ? 'high' : sources.length === 2 ? 'medium' : 'limited';

    const candidate: InsightCandidate = {
      id: `cand_${chapter.id}`,
      chapterId: chapter.id,
      primaryAxis,
      verdict,
      evidenceRefs,
      evidenceSourceCount: sources.length,
      hasOutsideFreeEvidence,
      hasCrossSourceConnection: sources.length >= 2,
      hasContradiction: linkedInsights.some((insight) => insight.type === 'CONTRADICTION'),
      hasUnresolvedPoint: verdict === 'UNRESOLVED',
      hasUserReportedEvent: linkedEvents.length > 0,
      relevantEventIds: linkedEvents.map((event) => event.id),
      noveltyScore: noveltyOf(verdict, hasOutsideFreeEvidence, linkedEvents.length > 0),
      /* 질문이 아직 없으므로 잠정값이다 — `assignQuestions`가 확정한다 */
      actionabilityScore: actionabilityOf(0, linkedEvents.length > 0),
      confidenceLevel: confidence,
      headline: primaryAxis ? headlineOf(primaryAxis, verdict) : chapter.title,
      soWhat,
      whyItMatters,
      questions: [],
      limitation: limitationFor({
        confidence,
        hasEvent: linkedEvents.length > 0,
        tense,
      }),
      composed,
    };

    candidates.push(candidate);
  }

  /*
    §14 — 정렬. **같은 등급 안에서는 novelty가, 그 다음은 원래 순서가 정한다.**
    원래 순서를 마지막 tie-break로 남기는 이유는 결정론이다 — 같은 세션을 두 번
    열었을 때 순서가 달라 보이면 안 된다(`lib/resultPriority.ts`와 같은 규칙).
  */
  const ordered = candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((a, b) => {
      const rank = rankOf(a.candidate) - rankOf(b.candidate);
      if (rank !== 0) return rank;
      const novelty = b.candidate.noveltyScore - a.candidate.noveltyScore;
      if (novelty !== 0) return novelty;
      return a.index - b.index;
    })
    .map((item) => item.candidate);

  return assignQuestions(dedupeByConclusion(ordered), {
    target,
    declaredLevels,
    tense,
    allowsOutwardQuestions,
    used,
  });
}

/**
 * §31 — **같은 결론을 두 번 팔지 않는다.**
 *
 * ⚠️ 브라우저 실측에서 첫 화면 01과 02가 **제목까지 같았다**:
 *
 * ```
 * 01  연락 — 말한 기준보다 크게 반응한 자리
 * 02  연락 — 말한 기준보다 크게 반응한 자리     ← 근거 조합만 다르다
 * ```
 *
 * Chapter 계층에서는 둘이 다른 단위가 맞다(`declared_vs_shown`과
 * `closeness_distance`는 서로 다른 주제이고 `noveltyKey`도 다르다). 그런데 Candidate는
 * 주제가 아니라 **말할 거리**이고, 축과 판정이 같으면 사용자에게는 같은 말이다.
 *
 * ⚠️ **정보를 지우는 게 아니다.** 밀려난 Chapter는 아래 Chapter 목록에 그대로 남는다 —
 * 첫 화면의 주인공 자리에서만 빠진다(§36이 근거를 지우지 않고 접은 것과 같은 판단).
 *
 * ⚠️ 축이 없는 Candidate(self-only 계열)는 묶지 않는다. 그쪽은 `axis:verdict`가
 * 전부 같아져서 서로 다른 이야기가 하나로 접힌다.
 */
function dedupeByConclusion(candidates: readonly InsightCandidate[]): InsightCandidate[] {
  const seen = new Set<string>();
  const kept: InsightCandidate[] = [];
  for (const candidate of candidates) {
    if (!candidate.primaryAxis) {
      kept.push(candidate);
      continue;
    }
    const key = `${candidate.primaryAxis}:${candidate.verdict}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(candidate);
  }
  return kept;
}

/**
 * 질문을 **화면 순서대로** 붙인다 (§26 · §31 · §32).
 *
 * 위 `buildInsightCandidates`의 주석 참고 — dedup 집합이 자라는 순서가 사용자가 읽는
 * 순서와 같아야 한다. 그래서 정렬·중복 제거가 끝난 목록에 마지막으로 얹는다.
 */
function assignQuestions(
  candidates: readonly InsightCandidate[],
  context: {
    target: TargetProfile;
    declaredLevels: ReadonlyMap<MirrorAxisKey, SelfLevel>;
    tense: RelationshipTense;
    allowsOutwardQuestions: boolean;
    used: Set<string>;
  },
): InsightCandidate[] {
  const events = context.target.events ?? [];

  return candidates.map((candidate) => {
    const eventTypes = candidate.relevantEventIds
      .map((id) => events.find((event) => event.id === id)?.type)
      .filter((type): type is RelationshipEventType => Boolean(type));

    const questions: UserFitQuestion[] = buildUserFitQuestions({
      axis: candidate.primaryAxis,
      verdict: candidate.verdict,
      declared: candidate.primaryAxis
        ? (context.declaredLevels.get(candidate.primaryAxis) ?? null)
        : null,
      targetLevel: targetLevelOf(candidate.primaryAxis, context.target),
      eventTypes,
      tense: context.tense,
      allowsOutwardQuestions: context.allowsOutwardQuestions,
      usedFingerprints: context.used,
    });
    for (const question of questions) context.used.add(question.fingerprint);

    return {
      ...candidate,
      questions,
      actionabilityScore: actionabilityOf(questions.length, candidate.hasUserReportedEvent),
    };
  });
}

/* ═══════════════════════════════════════════════════════════ 보조 */

function targetLevelOf(axis: MirrorAxisKey | null, target: TargetProfile): TargetLevel | null {
  /*
    ⚠️ `hobby`는 상대 4축에 없다(`TargetAxisKey`). 없는 값을 'x'(모름)로 바꾸지
    않는다 — '모른다고 답했다'와 '물어본 적이 없다'는 다른 상태다. null이면
    질문 조립이 `direct`를 만들지 않는 것으로 충분하다.
  */
  if (!axis || axis === 'hobby') return null;
  return target[axis] ?? null;
}

function headlineOf(axis: MirrorAxisKey, verdict: InsightVerdict): string {
  const label = axisLabel(axis);
  switch (verdict) {
    case 'CONTRADICTION':
      return `${label} — 반대 방향이 같이 나온 자리`;
    case 'GAP':
      return `${label} — 말한 기준보다 크게 반응한 자리`;
    case 'CHANGE':
      return `${label} — 두 시점이 다르게 남은 자리`;
    case 'UNRESOLVED':
      return `${label} — 아직 결론을 낼 수 없는 자리`;
    default:
      return `${label} — 말한 기준과 같은 방향`;
  }
}

function noveltyOf(verdict: InsightVerdict, outsideFree: boolean, hasEvent: boolean): number {
  const base: Record<InsightVerdict, number> = {
    CONTRADICTION: 0.95,
    GAP: 0.8,
    CHANGE: 0.65,
    UNRESOLVED: 0.45,
    MATCH: 0.2,
  };
  return Math.min(1, base[verdict] + (outsideFree ? 0.1 : 0) + (hasEvent ? 0.05 : 0));
}

function actionabilityOf(questionCount: number, hasEvent: boolean): number {
  if (questionCount === 0) return hasEvent ? 0.2 : 0.1;
  return Math.min(1, 0.5 + questionCount * 0.15 + (hasEvent ? 0.1 : 0));
}

/* ══════════════════════════════════════════ FREE Candidate (§18 ~ §21) */

/**
 * §18 · §19 — **무료가 보여줄 Insight.**
 *
 * ══ 왜 Premium과 같은 엔진을 쓰지 않는가 ═══════════════════════════════════
 *
 * Premium Candidate의 입력은 `PremiumChapter`다. Chapter는 cross-source 연결이 있어야
 * 만들어지고, 그건 **유료의 재료**다. 무료 화면에서 그 엔진을 부르면 두 가지가 깨진다:
 *
 * ```
 * ① 무료가 유료 재료를 쓴다  → 유료에서 팔 것이 사라진다(§20)
 * ② Chapter가 없는 세션      → 무료 Insight도 0개가 된다. 무료는 거의 모든 세션에서 있어야 한다
 * ```
 *
 * 그래서 입력이 다르다 — **무료 Mirror 행 하나**다. 대신 **문장 조립 방식은 같다**:
 * 축 × 판정 핵심절 + 근거 조합절 + 장면 연결절. 같은 조립기를 쓰므로 "무료는 규칙문,
 * 유료는 조립문" 같은 두 계층이 생기지 않는다.
 *
 * ⚠️ **무료에서 cross-source 연결을 말하지 않는다**(§20). Mirror 행 하나의 근거는
 * 정의상 `declared` + 관계 근거 한 종류이고, 여기에 장면이 붙어도 그건 '연결 전체'가
 * 아니다. 그래서 `hasOutsideFreeEvidence`는 언제나 false다 — 무료 Candidate는
 * Paywall tease의 자격을 스스로 만들 수 없다.
 */
export function buildFreeCandidates(input: {
  /** 이미 표시 순서로 정렬된 Mirror 행(`orderMirrorInsightsForDisplay`) */
  mirrorInsights: readonly MirrorInsight[];
  target: TargetProfile;
  declaredLevels: ReadonlyMap<MirrorAxisKey, SelfLevel>;
  tense: RelationshipTense;
  allowsOutwardQuestions: boolean;
  usedFingerprints: ReadonlySet<string>;
}): InsightCandidate[] {
  const { mirrorInsights, target, declaredLevels, tense, allowsOutwardQuestions } = input;
  const events = target.events ?? [];
  const used = new Set(input.usedFingerprints);

  /*
    §19 — 최대 2개. **UNKNOWN 행은 쓰지 않는다** — 판정이 없는 축에서 SO WHAT을 만들면
    그게 정확히 '없는 것을 파는' 문장이 된다(`buildMirrorReport`가 UNKNOWN을 이미
    `insights`에서 빼지만, 다른 호출부가 생길 수 있어 여기서도 확인한다).
  */
  const rows = mirrorInsights
    .filter((insight) => insight.state !== 'UNKNOWN')
    .slice(0, FREE_CANDIDATE_COUNT);

  return rows.map((row): InsightCandidate => {
    const verdict: InsightVerdict = row.state === 'GAP' ? 'GAP' : row.state === 'CHANGE' ? 'CHANGE' : 'MATCH';

    /*
      무료 Mirror 행의 근거는 두 종류다: 네가 말한 기준(declared)과 그 축의 관계 근거.
      `evidenceScope`가 그 관계 근거가 **언제의 나**인지 이미 판정해뒀다(v1.41 §39.8) —
      여기서 다시 정하지 않고 그 값을 그대로 옮긴다.
    */
    const sources: EvidenceRef['source'][] = ['declared'];
    if (row.evidenceStrength !== 'absent') {
      sources.push(row.evidenceScope === 'current' ? 'current_relationship' : 'relationship');
    }

    const relevance = selectRelevantEvents(
      events,
      { axis: row.key, direction: directionOf(verdict), tense, unresolved: false },
      /* §19 — 무료는 장면 1개까지. 여러 장면의 반복 패턴은 유료에서만 말한다(§20) */
      1,
    );
    const linkedEvents = relevance
      .map((item) => events.find((event) => event.id === item.eventId))
      .filter((event): event is RelationshipEvent => Boolean(event));

    const questions = buildUserFitQuestions({
      axis: row.key,
      verdict,
      declared: declaredLevels.get(row.key) ?? null,
      targetLevel: targetLevelOf(row.key, target),
      eventTypes: linkedEvents.map((event) => event.type),
      tense,
      allowsOutwardQuestions,
      usedFingerprints: used,
    })
      /* §19 — 무료는 질문 1개까지. 나머지 register는 유료의 몫이다 */
      .slice(0, 1);
    for (const question of questions) used.add(question.fingerprint);

    const core = AXIS_VERDICT[row.key][verdict];
    const confidence: InsightConfidence = sources.length >= 2 ? 'medium' : 'limited';

    return {
      id: `free_${row.key}`,
      chapterId: null,
      primaryAxis: row.key,
      verdict,
      evidenceRefs: [],
      evidenceSourceCount: sources.length,
      /* 위 주석 참고 — 무료 Candidate는 정의상 무료 화면 안의 근거만 쓴다 */
      hasOutsideFreeEvidence: false,
      hasCrossSourceConnection: false,
      hasContradiction: false,
      hasUnresolvedPoint: false,
      hasUserReportedEvent: linkedEvents.length > 0,
      relevantEventIds: linkedEvents.map((event) => event.id),
      noveltyScore: noveltyOf(verdict, false, linkedEvents.length > 0),
      actionabilityScore: actionabilityOf(questions.length, linkedEvents.length > 0),
      confidenceLevel: confidence,
      headline: headlineOf(row.key, verdict),
      soWhat: core
        ? `${core}${sourceClause(sources, tense)}${eventClause(linkedEvents, null)}`
        : /* 축 표에 없는 판정은 없다(5축 × 5판정이 모두 채워져 있다). 그래도 문장이
             사라지는 자리는 만들지 않는다 — 판정 엔진이 이미 만든 러비 한 줄이 남는다 */
          row.note,
      whyItMatters: tense === 'former' ? WHY[verdict].former : WHY[verdict].current,
      questions,
      limitation: limitationFor({
        confidence,
        hasEvent: linkedEvents.length > 0,
        tense,
      }),
      composed: Boolean(core),
    };
  });
}

/**
 * §19 — 무료 마지막의 **열린 질문 하나.**
 *
 * ⚠️ 상대에게 보내는 질문이 아니다. 사용자가 자기에게 묻는 질문이고, 그래서
 * `allowsOutwardQuestions`와 무관하게 `ended`에서도 안전하다 — 주어가 '나'다.
 */
export function openQuestionFor(candidate: InsightCandidate | undefined): string | null {
  if (!candidate) return null;
  switch (candidate.verdict) {
    case 'GAP':
      return '말한 기준보다 크게 반응한 자리 — 그게 언제부터 그랬는지는 기억나?';
    case 'CONTRADICTION':
      return '두 가지가 동시에 중요할 때, 너는 보통 어느 쪽을 먼저 챙기는 편이야?';
    case 'CHANGE':
      return '답이 달라진 게 상황 때문이었을까, 아니면 기준이 옮겨간 걸까?';
    case 'UNRESOLVED':
      return '아직 모르는 자리를 그대로 두는 건, 너한테 편한 쪽이야 불편한 쪽이야?';
    default:
      return '잘 맞는 자리에 대해서는 왜 서로 이야기를 덜 하게 될까?';
  }
}

/* ═══════════════════════════════════ FREE / Premium 분배 (§19 · §22) */

/** §19 — 무료가 보여줄 것. **1~2개** */
export const FREE_CANDIDATE_COUNT = 2;
/** §22 — 유료 첫 화면의 주인공. **3가지** */
export const PREMIUM_CANDIDATE_COUNT = 3;

/**
 * §21 — Paywall에서 tease할 자격이 있는 Candidate.
 *
 * ⚠️ **실제로 무료 밖 근거가 있을 때만.** 없으면 null이고, 그때 Paywall은 가치
 * 카피만 쓰고 "하나 더 보여"라고 말하지 않는다(§21 첫 줄 · VALUE-15).
 */
export function selectPaywallTease(
  candidates: readonly InsightCandidate[],
): InsightCandidate | null {
  const free = candidates.slice(0, FREE_CANDIDATE_COUNT);
  const freeIds = new Set(free.map((candidate) => candidate.id));
  return (
    candidates.find(
      (candidate) => !freeIds.has(candidate.id) && candidate.hasOutsideFreeEvidence,
    ) ?? null
  );
}

/**
 * §20 — 무료에서 숨기는 것을 **문장으로** 만든다. 가짜 mystery가 아니라 실제로
 * 유료에만 있는 것을 가리킨다.
 */
export function paywallTeaseText(
  tease: InsightCandidate | null,
  eventCount: number,
): string | null {
  if (!tease) return null;
  if (tease.hasUserReportedEvent && eventCount >= 2) {
    return '여기까지도 차이는 보여. 그런데 네가 알려준 장면들을 같이 놓으면, 이 차이보다 먼저 봐야 할 지점이 하나 더 나와.';
  }
  if (tease.hasContradiction) {
    return '여기까지는 한 방향으로만 보여. 그런데 반대 방향을 가리키는 답이 하나 더 있어 — 그 둘을 같이 놓아야 보이는 게 있어.';
  }
  return '여기까지는 무료로 볼 수 있는 자료만 쓴 거야. 무료 화면에 없는 자료를 하나 더 이으면 다른 지점이 보여.';
}

/**
 * §33 · §34 — 이 축의 이야기와 **겹치는 렌즈 하나.**
 *
 * ⚠️ 표는 `contextBuilders.ts`의 `LENS_EVENT_TYPES`와 같은 근거에서 나왔다 — 각 렌즈가
 * 실제로 말하는 주제다. 두 표가 서로 다른 방향을 가리키면 화면에서 "이 결과를 다른
 * 관점에서 보면"이라고 이은 렌즈가 정작 그 주제를 다루지 않게 된다.
 *
 * ⚠️ **렌즈는 근거가 아니다**(§34). 이 함수가 돌려주는 것은 '같이 읽어볼 프레임'이지
 * '이 결론을 뒷받침하는 세 번째 자료'가 아니다. 그래서 `evidenceSourceCount`에
 * 들어가지 않고, `confidenceLevel`을 올리지도 않는다.
 *
 * ⚠️ 축 하나에 렌즈 하나뿐이다. 세 렌즈를 전부 이으면 그건 연결이 아니라 부록 목록이고,
 * §33이 없애려던 '하단 독립 부록'이 Insight 아래로 자리만 옮긴 꼴이 된다.
 */
export function lensForAxis(axis: MirrorAxisKey | null): PremiumLensKind | null {
  switch (axis) {
    /* 정보 처리와 결정 방식이 실제로 부딪히는 자리 */
    case 'conflict':
    case 'contact':
      return 'mbti';
    /* 가까워짐·거리 — 관계 리듬 */
    case 'alone':
    case 'hobby':
      return 'saju';
    /* 표현 방식 */
    case 'affection':
      return 'zodiac';
    default:
      return null;
  }
}

/** 여러 Candidate에서 실제로 인용된 장면 id. 근거 토글이 이 목록만 보여준다 */
export function citedEventIds(candidates: readonly InsightCandidate[]): string[] {
  return [...new Set(candidates.flatMap((candidate) => candidate.relevantEventIds))];
}

/** §41 EVENT-LIMIT-10 — AI에 실제로 보낼 장면 id. **Candidate당 2개까지** */
export function eventIdsForAi(candidates: readonly InsightCandidate[], perCandidate = 2): string[] {
  return [
    ...new Set(
      candidates.flatMap((candidate) => candidate.relevantEventIds.slice(0, perCandidate)),
    ),
  ];
}

/** fixture가 종류 분포를 값으로 볼 수 있게 — 본문은 절대 나가지 않는다 */
export function eventTypeHistogram(
  events: readonly RelationshipEvent[],
): Partial<Record<RelationshipEventType, number>> {
  const histogram: Partial<Record<RelationshipEventType, number>> = {};
  for (const event of events) {
    histogram[event.type] = (histogram[event.type] ?? 0) + 1;
  }
  return histogram;
}
