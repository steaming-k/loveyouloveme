import { MBTI_AXES } from '@/data/mbti';
import {
  CROSS_LENS_COPY,
  LENS_DISCLAIMER,
  LENS_LABEL,
  LENS_SELF_COPY,
  LENS_THEME_LABEL,
  LENS_THEME_QUESTION,
  LENS_UNAVAILABLE_REASON,
  MBTI_DECISION_PAIR,
  MBTI_ENERGY_PAIR,
  MBTI_INFORMATION_PAIR,
  MBTI_LIFESTYLE_PAIR,
  MBTI_MISREAD,
  MBTI_MISREAD_ALL_SAME,
  MBTI_SELF_DECISION,
  MBTI_SELF_ENERGY,
  MBTI_SELF_INFORMATION,
  MBTI_SELF_LIFESTYLE,
  MODALITY_LABEL,
  MODALITY_NOTE,
  MODALITY_PAIR,
  ZODIAC_MISREAD,
} from '@/data/premiumLens';
import {
  DAY_BRANCH_ELEMENT_SELF,
  DAY_STEM_ELEMENT_SELF,
  ELEMENT_LABEL_KO,
  ELEMENT_RELATION_NOTE,
  POLARITY_LABEL_KO,
  POLARITY_SELF,
  SAJU_SCOPE_NOTE,
  type SajuElement,
} from '@/data/saju';
import {
  ELEMENT_LABEL,
  ELEMENT_NOTE,
  ELEMENT_PAIR_TOPIC,
  ZODIAC_ELEMENT,
  ZODIAC_MODALITY,
  ZODIAC_NOTES,
  type ZodiacElement,
  type ZodiacModality,
} from '@/data/zodiac';
import {
  subjectParticleOf,
  topicParticleOf,
  withCompanionParticle,
  withCopula,
  withInstrumentParticle,
  withSubjectParticle,
  withTopicParticle,
} from '@/lib/korean';
import { relationshipEventEvidenceText } from '@/lib/logic/relationshipEvents';
import { elementRelation, isLunarBlocked, readSajuDay, type DayPillar } from '@/lib/logic/sajuPillars';
import { getSunSign } from '@/services/astrologyService';
import type {
  BirthProfile,
  DeclaredPreference,
  MbtiType,
  PremiumCrossLens,
  PremiumLensBundle,
  PremiumLensEntry,
  PremiumLensFix,
  PremiumLensKind,
  PremiumLensReport,
  PremiumLensSectionUnit,
  PremiumLensSelfReason,
  PremiumLensTheme,
  RelationshipEvent,
  ZodiacSign,
} from '@/types';

/**
 * Premium 관계 렌즈 엔진 (v1.46 PremiumLens · PHASE A~D)
 *
 * ══ ⚠️ 이 파일이 절대 하지 않는 것 ═════════════════════════════════════════
 *
 * ⚠️ **판정을 만들지 않는다.** 동기화율 · Mirror MATCH/GAP/CHANGE · History
 * 변화 판정 어디에도 이 파일의 결과가 들어가지 않는다(§45). 구조적으로도
 * 불가능하다 — `logic/compatibility.ts` · `logic/mirror.ts` · `logic/history.ts` ·
 * `logic/crossSourceInsights.ts` 가운데 **이 파일을 import하는 것은 하나도 없다.**
 * LENS-11 / LENS-12가 그 사실을 소스 스캔으로 고정한다.
 *
 * ⚠️ **없는 데이터를 만들지 않는다**(§6 · §11 · §15). 세 렌즈의 mode를 각각
 * 독립 판정하고, 재료가 없으면 `unavailable`로 두고 이유를 적는다. 섹션 개수를
 * 맞추려고 filler를 만들지 않는다(§29).
 *
 * ⚠️ **AI를 부르지 않는다.** 이 파일은 provider call을 0개 추가한다.
 * 왜 AI narrative를 얹지 않았는지는 QA 보고서 §16에 적었다 — 요약하면
 * §24(`basisRefs ⊆ allowedEvidence`) · §26(AI 실패 fallback) · §29(밀도 기준) ·
 * §49(VALUE 테스트)가 전부 **결정론일 때만 증명 가능**하기 때문이다.
 *
 * ⚠️ **상대의 의도를 주장하지 않는다**(§46). 사용자가 알려준 사건은 항상
 * `네가 알려준 장면`으로만 인용하고, 그 문장은 `relationshipEventEvidenceText`
 * 하나가 만든다 — 이 파일이 사건 문장을 직접 조립하지 않는다.
 */

/* ══════════════════════════════════════════════════════════ 입력 */

export interface PremiumLensInput {
  selfMbti: MbtiType | null;
  targetMbti: MbtiType | null;
  selfBirth: BirthProfile;
  targetBirth: BirthProfile;
  /**
   * 상대라는 대상 자체가 있는지. **`pair` 판정의 필요조건이지 충분조건이 아니다**(§6) —
   * 상대가 있어도 그 렌즈의 상대 데이터가 없으면 `self`다.
   */
  hasTarget: boolean;
  declared: DeclaredPreference;
  events: readonly RelationshipEvent[];
  today: Date;
}

/* ══════════════════════════════════════════════════ 테마 매핑 (§19) */

/**
 * 오행 → 테마. **일간·일지 문장에서 그대로 읽어낸 것**이고 새 해석이 아니다.
 *
 * ```
 * wood  뻗어나가 먼저 움직임   → pace
 * fire  겉으로 먼저 드러남     → expression
 * earth 자리를 지키고 머무름   → closeness
 * metal 기준을 분명히 둠       → standard
 * water 상황에 맞춰 모양 바꿈  → planning
 * ```
 */
const SAJU_ELEMENT_THEME: Record<SajuElement, PremiumLensTheme> = {
  wood: 'pace',
  fire: 'expression',
  earth: 'closeness',
  metal: 'standard',
  water: 'planning',
};

/** 별자리 원소 → 테마. `ELEMENT_NOTE`의 문장에서 그대로 읽어낸 것이다 */
const ZODIAC_ELEMENT_THEME: Record<ZodiacElement, PremiumLensTheme> = {
  fire: 'pace',
  earth: 'planning',
  air: 'closeness',
  water: 'expression',
};

/** 양태 → 테마. `MODALITY_NOTE`의 문장에서 그대로 읽어낸 것이다 */
const ZODIAC_MODALITY_THEME: Record<ZodiacModality, PremiumLensTheme> = {
  cardinal: 'pace',
  fixed: 'standard',
  mutable: 'planning',
};

function dedupeThemes(themes: readonly PremiumLensTheme[]): PremiumLensTheme[] {
  return Array.from(new Set(themes));
}

/* ══════════════════════════════════════════════════════ MBTI (§7~§9) */

type AxisKey = 'energy' | 'information' | 'decision' | 'lifestyle';

const AXIS_INDEX: Record<AxisKey, 0 | 1 | 2 | 3> = {
  energy: 0,
  information: 1,
  decision: 2,
  lifestyle: 3,
};

function axisLabelOf(key: AxisKey): string {
  return MBTI_AXES.find((axis) => axis.key === key)!.label;
}

function letterOf(type: MbtiType, key: AxisKey): string {
  return type[AXIS_INDEX[key]]!;
}

function sameOn(mine: MbtiType, theirs: MbtiType, key: AxisKey): boolean {
  return letterOf(mine, key) === letterOf(theirs, key);
}

/**
 * §8 MBTI-01 — 두 사람을 한 문장으로.
 *
 * ⚠️ **Generic 문장 금지**(§8). 그래서 이 문장은 실제 같은 축 / 다른 축의
 * **이름**을 담는다 — 어떤 조합에서도 똑같이 읽히는 문장이 나올 수 없다.
 */
function mbtiHeadline(mine: MbtiType, theirs: MbtiType): string {
  const keys: AxisKey[] = ['energy', 'information', 'decision', 'lifestyle'];
  const same = keys.filter((key) => sameOn(mine, theirs, key));
  const differ = keys.filter((key) => !sameOn(mine, theirs, key));

  if (differ.length === 0) {
    return `${mine} × ${theirs} — 네 축이 전부 같은 쪽으로 분류됐어.`;
  }
  if (same.length === 0) {
    return `${mine} × ${theirs} — 네 축이 전부 반대쪽으로 분류됐어.`;
  }
  /**
   * ⚠️ 조사를 하드코딩하지 않는다. 축 라벨에는 `계획과 유연함 사이`처럼 받침 없는
   * 것이 섞여 있어서 `은`을 붙이면 `사이은`이 된다 — 브라우저 실측에서 실제로 그렇게
   * 나왔다. `lib/korean.ts`가 이미 이 문제를 위해 있는 함수다.
   */
  return (
    `${mine} × ${theirs} — ${withTopicParticle(same.map(axisLabelOf).join(' · '))} 같은 쪽이고, ` +
    `${withTopicParticle(differ.map(axisLabelOf).join(' · '))} 다른 쪽으로 분류됐어.`
  );
}

function buildMbtiPair(
  mine: MbtiType,
  theirs: MbtiType,
  events: readonly RelationshipEvent[],
): PremiumLensReport {
  const keys: AxisKey[] = ['energy', 'information', 'decision', 'lifestyle'];
  const differing = keys.filter((key) => !sameOn(mine, theirs, key));

  const energyLetter = letterOf(mine, 'energy');
  const energyKind = sameOn(mine, theirs, 'energy')
    ? energyLetter === 'I'
      ? 'both_i'
      : 'both_e'
    : 'differ';
  const lifestyleKind = sameOn(mine, theirs, 'lifestyle')
    ? letterOf(mine, 'lifestyle') === 'J'
      ? 'both_j'
      : 'both_p'
    : 'differ';
  const informationKind = sameOn(mine, theirs, 'information')
    ? letterOf(mine, 'information') === 'S'
      ? 'both_s'
      : 'both_n'
    : 'differ';
  const decisionKind = sameOn(mine, theirs, 'decision')
    ? letterOf(mine, 'decision') === 'T'
      ? 'both_t'
      : 'both_f'
    : 'differ';

  const sections: PremiumLensSectionUnit[] = [
    {
      id: 'mbti_rhythm',
      title: '함께 지내는 리듬',
      body: `${MBTI_ENERGY_PAIR[energyKind]}\n\n${MBTI_LIFESTYLE_PAIR[lifestyleKind]}`,
    },
    {
      id: 'mbti_understanding',
      title: '대화가 엇갈리는 자리',
      body: `${MBTI_INFORMATION_PAIR[informationKind]}\n\n${MBTI_DECISION_PAIR[decisionKind]}`,
      ...eventTieFor(events),
    },
    {
      id: 'mbti_shared_split',
      title: '닮은 축 · 갈리는 축',
      body: buildSharedSplitBody(mine, theirs, keys),
    },
    {
      id: 'mbti_misread',
      title: '오해가 생기기 쉬운 지점',
      body:
        differing.length === 0
          ? MBTI_MISREAD_ALL_SAME
          : differing.map((key) => MBTI_MISREAD[key]).join('\n\n'),
    },
  ];

  return {
    kind: 'mbti',
    label: LENS_LABEL.mbti,
    mode: 'pair',
    headline: mbtiHeadline(mine, theirs),
    overview:
      '이 렌즈가 보는 건 두 사람이 정보를 받아들이고 결정을 내리고 일상을 정리하는 방식이야. 누가 맞는지가 아니라, 같은 상황을 어디서부터 다르게 보기 시작하는지를 봐.',
    sections,
    checkpoint: mbtiCheckpoint(differing),
    basis: [
      { label: '나', value: mine },
      { label: '상대', value: theirs },
      {
        label: '같은 축',
        value:
          keys.filter((key) => sameOn(mine, theirs, key)).map(axisLabelOf).join(' · ') || '없음',
      },
      { label: '다른 축', value: differing.map(axisLabelOf).join(' · ') || '없음' },
    ],
    limitations: [
      '상대 MBTI는 네가 입력한 값이야. 상대가 직접 검사한 결과인지는 내가 확인할 수 없어.',
      '이 렌즈는 선호를 네 갈래로 나눈 분류일 뿐이라, 실제로 둘이 어떻게 지내는지는 설명하지 못해.',
    ],
    disclaimer: LENS_DISCLAIMER.mbti,
    themes: dedupeThemes([
      energyKind === 'both_e' ? 'closeness' : 'alone_time',
      'planning',
      'expression',
    ]),
  };
}

/**
 * §8 MBTI-04 — 공통 preference와 차이 preference를 **분리**한다.
 * 단순 4글자 비교가 아니라 왜 편할 수 있고 왜 다르게 볼 수 있는지까지 간다.
 */
function buildSharedSplitBody(mine: MbtiType, theirs: MbtiType, keys: readonly AxisKey[]): string {
  const same = keys.filter((key) => sameOn(mine, theirs, key));
  const differ = keys.filter((key) => !sameOn(mine, theirs, key));

  const lines: string[] = [];
  if (same.length > 0) {
    lines.push(
      `설명 없이 통할 수 있는 자리 — ${same.map(axisLabelOf).join(' · ')}. ` +
        '여기서는 서로 왜 그러는지 묻지 않아도 넘어가게 돼. 편한 만큼 확인이 생략되는 자리이기도 해.',
    );
  }
  if (differ.length > 0) {
    lines.push(
      `설명이 필요한 자리 — ${differ.map(axisLabelOf).join(' · ')}. ` +
        '여기서는 같은 상황을 서로 다른 언어로 옮겨 적게 돼. 어렵다는 뜻이 아니라, 말하지 않으면 안 넘어간다는 뜻이야.',
    );
  }
  return lines.join('\n\n');
}

/** §8 MBTI-06 — 구체적인 다음 확인 질문. 다른 축이 있으면 그 축을 지목한다 */
function mbtiCheckpoint(differing: readonly AxisKey[]): string {
  if (differing.includes('lifestyle')) {
    return '다음 약속을 며칠 전에 정해두면 편한지 서로 숫자로 말해봐. 같은 "미리"가 서로 다른 날짜일 수 있어.';
  }
  if (differing.includes('decision')) {
    return '갈등이 생기면 그날 안에 이야기하고 싶은지, 각자 정리할 시간이 먼저 필요한지 지금 맞춰봐.';
  }
  if (differing.includes('energy')) {
    return '혼자 있고 싶은 날 그걸 어떻게 알릴지 신호를 하나 정해봐. 침묵을 서로 다르게 읽지 않게.';
  }
  if (differing.includes('information')) {
    return '무슨 일이 있었는지부터 듣고 싶은지, 그게 무슨 뜻이었는지부터 듣고 싶은지 서로 물어봐.';
  }
  return '비슷하다고 넘어간 것 중에 사실 확인해본 적 없는 걸 하나 골라서 물어봐.';
}

function buildMbtiSelf(
  mine: MbtiType,
  declared: DeclaredPreference,
  selfReason: PremiumLensSelfReason,
): PremiumLensReport {
  const copy = LENS_SELF_COPY.mbti[selfReason];
  const energy = letterOf(mine, 'energy') as 'I' | 'E';
  const information = letterOf(mine, 'information') as 'S' | 'N';
  const decision = letterOf(mine, 'decision') as 'T' | 'F';
  const lifestyle = letterOf(mine, 'lifestyle') as 'J' | 'P';

  const sections: PremiumLensSectionUnit[] = [
    {
      id: 'mbti_self_energy',
      title: '관계에서 에너지를 쓰는 방식',
      body: MBTI_SELF_ENERGY[energy],
    },
    {
      id: 'mbti_self_information',
      title: '관계 신호를 받아들이는 방식',
      body: MBTI_SELF_INFORMATION[information],
    },
    {
      id: 'mbti_self_decision',
      title: '갈등에서 먼저 보는 것',
      body: MBTI_SELF_DECISION[decision],
    },
    {
      id: 'mbti_self_lifestyle',
      title: '약속과 일상의 리듬',
      body: MBTI_SELF_LIFESTYLE[lifestyle],
    },
    {
      id: 'mbti_self_vs_declared',
      title: '이 렌즈와 네가 직접 답한 기준',
      body: mbtiVsDeclaredBody(energy, declared),
    },
  ];

  return {
    kind: 'mbti',
    label: LENS_LABEL.mbti,
    mode: 'self',
    selfReason,
    headline: `${mine} — MBTI로 보는 관계 속의 나.`,
    overview: copy.overview,
    sections,
    checkpoint:
      '위 네 줄 중에 "이건 나랑 다른데" 싶은 게 있으면 그 줄을 기억해둬. 다음에 실제로 그 상황이 왔을 때 어느 쪽이 맞았는지 확인해보는 게 이 렌즈를 쓰는 방법이야.',
    basis: [
      { label: '나', value: mine },
      { label: '상대', value: copy.basis },
      { label: '비교한 내 답', value: declaredAloneLabel(declared) },
    ],
    limitations: [
      copy.limitation,
      'MBTI는 선호를 네 갈래로 나눈 분류라, 네가 실제로 어떻게 행동하는지는 설명하지 못해.',
    ],
    disclaimer: LENS_DISCLAIMER.mbti,
    themes: dedupeThemes([
      energy === 'E' ? 'closeness' : 'alone_time',
      'planning',
      'expression',
    ]),
  };
}

/**
 * §9 — MBTI Lens vs **사용자가 직접 답한 관계 기준.**
 *
 * ⚠️ 비교하는 축은 **E/I ↔ 개인 시간 하나뿐이다.** `logic/mbtiBridge.ts`가
 * v1.24 P3-1에서 나머지 셋(S/N · T/F · J/P)을 근거 없는 대응이라고 기각했고,
 * 그 판단을 여기서 뒤집지 않는다. 축을 늘리면 'T라서 공감 못 함' 류의
 * stereotype이 유료 리포트에서 다시 살아난다.
 *
 * ⚠️ **MBTI가 사용자 답보다 우위에 있지 않다**(§9). 어긋날 때 문장의 주어는
 * 항상 사용자의 답이다 — '너는 사실 I야'라고 말하지 않는다.
 */
function mbtiVsDeclaredBody(energy: 'I' | 'E', declared: DeclaredPreference): string {
  const alone = declared.alone;

  if (alone === null) {
    return 'MBTI에서 본 회복 방식과 나란히 놓을 수 있는 건 네가 답한 개인 시간 필요도야. 아직 답하지 않아서 이번엔 비교하지 않았어.';
  }
  if (alone === 3) {
    return `MBTI에서는 ${energy === 'I' ? '혼자 회복하는' : '함께 활동하며 회복하는'} 쪽으로 분류됐고, 네가 답한 개인 시간 필요도는 가운데였어. 어느 쪽이라고 말하기엔 아직 근거가 부족해.`;
  }

  const wantsAlone = alone >= 4;
  const aligns = (energy === 'I' && wantsAlone) || (energy === 'E' && !wantsAlone);
  const declaredLine = wantsAlone
    ? '개인 시간이 꽤 필요하다고 답했어'
    : '개인 시간은 많이 필요하지 않다고 답했어';
  const lensLine = energy === 'I' ? '혼자 있는 시간으로 회복하는 쪽' : '함께 활동하며 회복하는 쪽';

  return aligns
    ? `너는 ${declaredLine}. MBTI 분류도 ${lensLine}이라 두 관점이 같은 방향을 가리켰어. 같은 방향이라고 같은 이유인지는 아직 모르겠지만.`
    : `너는 ${declaredLine}. 그런데 MBTI 분류는 ${lensLine}이야. 두 관점이 어긋난 자리인데, 여기서 맞는 쪽은 네가 직접 답한 쪽이야 — 이 렌즈는 네 답을 고치지 못해.`;
}

function declaredAloneLabel(declared: DeclaredPreference): string {
  return declared.alone === null ? '개인 시간 — 답 없음' : `개인 시간 필요도 ${declared.alone}/5`;
}

/**
 * §8 MBTI-03 — 사용자가 알려준 사건이 있으면 **그 장면을 명시적으로 인용**한다.
 *
 * ⚠️ 상대 의도로 확정하지 않는다(§8 · §46). 문장은 '이 차이가 더 크게
 * 느껴졌을 가능성을 확인해볼 수 있어'까지만 간다.
 */
function eventTieFor(
  events: readonly RelationshipEvent[],
): Pick<PremiumLensSectionUnit, 'reportedEventId' | 'reportedEventLine'> | Record<string, never> {
  const first = events[0];
  if (!first) return {};
  return { reportedEventId: first.id, reportedEventLine: lensEventLine(first) };
}

/**
 * 사건 인용 문장. **화면이 아니라 여기서 만든다** — 문구가 두 곳에 생기면 한쪽이
 * `네가 알려준 장면` 출처를 빼먹을 수 있다.
 *
 * ⚠️ 상대의 의도로 넘어가지 않는다. 문장은 `확인해볼 수 있어`에서 멈추고,
 * 마지막 절이 이 렌즈가 무엇을 모르는지 직접 말한다(§46).
 */
export function lensEventLine(event: RelationshipEvent): string {
  return `${relationshipEventEvidenceText(event)} — 이 장면에서는 위의 차이가 더 크게 느껴졌을 가능성을 확인해볼 수 있어. 상대가 그때 무슨 마음이었는지는 이 렌즈로 알 수 없어.`;
}

/* ══════════════════════════════════════════════════════ 사주 (§10~§13) */

function pillarLabel(pillar: DayPillar): string {
  return `${pillar.label}(${pillar.hanja})`;
}

function stemSummary(pillar: DayPillar): string {
  return `일간 ${pillar.stem}(${ELEMENT_LABEL_KO[pillar.stemElement]} · ${POLARITY_LABEL_KO[pillar.stemPolarity]})`;
}

function buildSajuPair(
  mine: DayPillar,
  theirs: DayPillar,
  mineLimits: readonly string[],
  events: readonly RelationshipEvent[],
): PremiumLensReport {
  const relation = elementRelation(mine.stemElement, theirs.stemElement);
  const note = ELEMENT_RELATION_NOTE[relation];
  const polarityDiffers = mine.stemPolarity !== theirs.stemPolarity;

  const sections: PremiumLensSectionUnit[] = [
    {
      id: 'saju_pillars',
      title: '두 사람의 일주',
      body:
        `너는 ${pillarLabel(mine)}일, 상대는 ${pillarLabel(theirs)}일에 태어났어.\n\n` +
        `너는 ${stemSummary(mine)}, 상대는 ${stemSummary(theirs)}. ` +
        `명리에서 일간은 '나 자신'을 가리키는 자리라, 이 렌즈는 그 한 글자를 기준으로 봐.`,
    },
    {
      id: 'saju_each',
      title: '일간으로 본 각자',
      body:
        `너 — ${DAY_STEM_ELEMENT_SELF[mine.stemElement]} ${POLARITY_SELF[mine.stemPolarity]}\n\n` +
        `상대 — ${DAY_STEM_ELEMENT_SELF[theirs.stemElement]} ${POLARITY_SELF[theirs.stemPolarity]}` +
        (polarityDiffers
          ? '\n\n표현이 나가는 방향이 서로 다르게 분류됐어. 한쪽이 먼저 꺼낼 때 다른 쪽은 아직 정리 중일 수 있다는 뜻으로 읽혀.'
          : '\n\n표현이 나가는 방향은 같은 쪽으로 분류됐어. 둘 다 먼저 꺼내거나, 둘 다 정리한 뒤에 꺼내는 형태로 읽혀.'),
    },
    {
      id: 'saju_together',
      title: '둘을 같이 놓았을 때',
      body: `${note.reading}\n\n어긋나기 쉽다고 이야기되는 지점 — ${note.watchFor}`,
      ...eventTieFor(events),
    },
    {
      id: 'saju_unknown',
      title: '이 프레임만으로는 알 수 없는 것',
      body:
        `${SAJU_SCOPE_NOTE}\n\n` +
        '그래서 여기서 나온 건 두 사람의 일간 사이의 방향 하나뿐이야. 관계가 어떻게 될지, 서로에게 맞는 사람인지는 이 한 글자로 알 수 없어.',
    },
  ];

  return {
    kind: 'saju',
    label: LENS_LABEL.saju,
    mode: 'pair',
    headline: `${mine.label}일 × ${theirs.label}일 — ${withCompanionParticle(
      ELEMENT_LABEL_KO[mine.stemElement],
    )} ${withSubjectParticle(ELEMENT_LABEL_KO[theirs.stemElement])} 만나는 자리야.`,
    overview:
      '이 렌즈가 보는 건 전통 명리에서 두 사람의 힘이 어느 방향으로 흐르는 것으로 읽히는가야. 좋고 나쁨을 가리지 않고, 누가 먼저 내어주고 누가 기준을 잡는 쪽으로 읽히는지만 봐.',
    sections,
    checkpoint: `${note.question} 이 렌즈에서는 그렇게 보이지만, 실제로 그런지는 네가 알려준 장면과 앞으로의 대화로 확인해봐.`,
    basis: [
      { label: '내 일주', value: `${pillarLabel(mine)} · 일간 ${ELEMENT_LABEL_KO[mine.stemElement]}` },
      {
        label: '상대 일주',
        value: `${pillarLabel(theirs)} · 일간 ${ELEMENT_LABEL_KO[theirs.stemElement]}`,
      },
      {
        label: '두 일간의 관계',
        value: `${ELEMENT_LABEL_KO[mine.stemElement]} → ${ELEMENT_LABEL_KO[theirs.stemElement]} · 전통 용어로 ${note.classicTerm}`,
      },
      { label: '계산한 기둥', value: '일주 1개 (연주·월주·시주 미계산)' },
    ],
    limitations: [
      SAJU_SCOPE_NOTE,
      '상대 생년월일은 네가 알고 있는 값이야. 실제와 다르면 결과도 달라져.',
      ...mineLimits,
    ],
    disclaimer: LENS_DISCLAIMER.saju,
    themes: dedupeThemes([
      relationThemeOf(relation),
      SAJU_ELEMENT_THEME[mine.stemElement],
      SAJU_ELEMENT_THEME[mine.branchElement],
    ]),
  };
}

function relationThemeOf(relation: ReturnType<typeof elementRelation>): PremiumLensTheme {
  if (relation === 'same') return 'pace';
  if (relation === 'i_generate' || relation === 'they_generate') return 'expression';
  return 'standard';
}

function buildSajuSelf(
  mine: DayPillar,
  mineLimits: readonly string[],
  selfReason: PremiumLensSelfReason,
): PremiumLensReport {
  const copy = LENS_SELF_COPY.saju[selfReason];
  const sections: PremiumLensSectionUnit[] = [
    {
      id: 'saju_self_pillar',
      title: '내 일주',
      body:
        `너는 ${pillarLabel(mine)}일에 태어났어. ${stemSummary(mine)}, 일지는 ${mine.branch}(${ELEMENT_LABEL_KO[mine.branchElement]}).\n\n` +
        '명리에서 일간은 나 자신을 가리키는 자리로 읽혀. 이 렌즈는 거기서부터 시작해.',
    },
    {
      id: 'saju_self_stem',
      title: '일간으로 본 관계 속의 나',
      body: `${DAY_STEM_ELEMENT_SELF[mine.stemElement]} ${POLARITY_SELF[mine.stemPolarity]}`,
    },
    {
      id: 'saju_self_branch',
      title: '일지로 본 일상의 리듬',
      body:
        `${DAY_BRANCH_ELEMENT_SELF[mine.branchElement]}\n\n` +
        `일간이 관계에서 드러나는 방식이라면 일지는 하루가 굴러가는 방식이야. 둘이 같은 오행이면 결이 겹치고, 다르면 관계에서의 나와 평소의 내가 다르게 보일 수 있어 — 네 경우엔 ${
          mine.stemElement === mine.branchElement ? '같은 오행이야' : '서로 다른 오행이야'
        }.`,
    },
    {
      id: 'saju_self_unknown',
      title: '이 해석만으로는 알 수 없는 것',
      body:
        `${SAJU_SCOPE_NOTE}\n\n` +
        '그리고 이건 "나는 원래 이런 사람"이라는 결론이 아니야. 한 글자로 사람을 정하지 않아 — 관계에서 나를 다시 생각해보는 각도 하나일 뿐이야.',
    },
  ];

  return {
    kind: 'saju',
    label: LENS_LABEL.saju,
    mode: 'self',
    selfReason,
    headline: `${mine.label}일 — 사주로 보는 관계 기준의 나.`,
    overview: copy.overview,
    sections,
    checkpoint:
      '위에서 읽은 방향이 최근 관계에서도 그랬는지 하나만 떠올려봐. 맞지 않으면 그 프레임이 아니라 네 경험이 맞는 거야.',
    basis: [
      { label: '내 일주', value: pillarLabel(mine) },
      {
        label: '일간 · 일지',
        value: `${mine.stem}(${ELEMENT_LABEL_KO[mine.stemElement]}) · ${mine.branch}(${ELEMENT_LABEL_KO[mine.branchElement]})`,
      },
      { label: '상대 일주', value: copy.basis },
      { label: '계산한 기둥', value: '일주 1개 (연주·월주·시주 미계산)' },
    ],
    limitations: [copy.limitation, SAJU_SCOPE_NOTE, ...mineLimits],
    disclaimer: LENS_DISCLAIMER.saju,
    themes: dedupeThemes([
      SAJU_ELEMENT_THEME[mine.stemElement],
      SAJU_ELEMENT_THEME[mine.branchElement],
    ]),
  };
}

/* ═══════════════════════════════════════════════════ 별자리 (§14~§17) */

function signLabel(sign: ZodiacSign): string {
  return ZODIAC_NOTES[sign].label;
}

function elementPairKey(a: ZodiacElement, b: ZodiacElement): string {
  return [a, b].sort().join('|');
}

function buildZodiacPair(mine: ZodiacSign, theirs: ZodiacSign, cusp: boolean): PremiumLensReport {
  const mineElement = ZODIAC_ELEMENT[mine];
  const theirsElement = ZODIAC_ELEMENT[theirs];
  const mineModality = ZODIAC_MODALITY[mine];
  const theirsModality = ZODIAC_MODALITY[theirs];
  const sameElement = mineElement === theirsElement;
  const sameModality = mineModality === theirsModality;

  const sections: PremiumLensSectionUnit[] = [
    {
      id: 'zodiac_style',
      title: '두 사람의 관계 스타일',
      body:
        `${signLabel(mine)} — ${ZODIAC_NOTES[mine].trait}\n\n` +
        `${signLabel(theirs)} — ${ZODIAC_NOTES[theirs].trait}`,
    },
    {
      id: 'zodiac_element_modality',
      title: '원소와 양태로 본 공통점 · 차이',
      body:
        (sameElement
          ? `둘 다 ${ELEMENT_LABEL[mineElement]} 원소야. ${ELEMENT_NOTE[mineElement]}`
          : `${withCompanionParticle(ELEMENT_LABEL[mineElement])} ${withInstrumentParticle(
              ELEMENT_LABEL[theirsElement],
            )} 원소가 달라. ${ELEMENT_PAIR_TOPIC[elementPairKey(mineElement, theirsElement)] ?? ''}`) +
        `\n\n양태는 ${MODALITY_LABEL[mineModality]} × ${withCopula(MODALITY_LABEL[theirsModality])}. ${
          MODALITY_PAIR[sameModality ? 'same' : 'differ']
        }`,
    },
    {
      id: 'zodiac_expectation',
      title: '가까워질 때 생기는 기대 차이',
      body:
        `${signLabel(mine)}는 ${MODALITY_NOTE[mineModality]} ${signLabel(theirs)}는 ${MODALITY_NOTE[theirsModality]}\n\n` +
        '이 렌즈에서는 가까워지는 속도보다 **누가 먼저 움직이길 기대하는가**에서 차이가 확인될 수 있어.',
    },
    {
      id: 'zodiac_misread',
      title: '오해가 생기기 쉬운 지점',
      body: ZODIAC_MISREAD,
    },
  ];

  return {
    kind: 'zodiac',
    label: LENS_LABEL.zodiac,
    mode: 'pair',
    headline: `${signLabel(mine)} × ${signLabel(theirs)} — ${
      sameElement
        ? `같은 ${ELEMENT_LABEL[mineElement]} 원소야.`
        : `${withCompanionParticle(ELEMENT_LABEL[mineElement])} ${withSubjectParticle(
            ELEMENT_LABEL[theirsElement],
          )} 만나.`
    }`,
    overview:
      '이 렌즈가 보는 건 관계에 대한 기대와 표현을 어떤 상징으로 읽을 수 있는가야. 태양궁 두 개와 거기서 곧바로 따라오는 원소·양태까지만 쓰고, 그 밖은 계산하지 않아.',
    sections,
    checkpoint:
      '표현이 얼마나 자주 오가는지 말고, 상대의 어떤 행동을 애정 표현으로 알아듣는지를 서로 하나씩 말해봐. 이 렌즈가 가장 자주 어긋나는 자리가 거기야.',
    basis: [
      { label: '내 태양궁', value: `${signLabel(mine)} · ${ELEMENT_LABEL[mineElement]} · ${MODALITY_LABEL[mineModality]}` },
      {
        label: '상대 태양궁',
        value: `${signLabel(theirs)} · ${ELEMENT_LABEL[theirsElement]} · ${MODALITY_LABEL[theirsModality]}`,
      },
      { label: '계산 범위', value: '태양궁만 (달·상승궁 미계산)' },
    ],
    limitations: zodiacLimitations(cusp, true),
    disclaimer: LENS_DISCLAIMER.zodiac,
    themes: dedupeThemes([
      ZODIAC_ELEMENT_THEME[mineElement],
      ZODIAC_ELEMENT_THEME[theirsElement],
      ZODIAC_MODALITY_THEME[mineModality],
    ]),
  };
}

function buildZodiacSelf(
  mine: ZodiacSign,
  cusp: boolean,
  declared: DeclaredPreference,
  selfReason: PremiumLensSelfReason,
): PremiumLensReport {
  const copy = LENS_SELF_COPY.zodiac[selfReason];
  const element = ZODIAC_ELEMENT[mine];
  const modality = ZODIAC_MODALITY[mine];

  const sections: PremiumLensSectionUnit[] = [
    {
      id: 'zodiac_self_theme',
      title: '관계에서 중요하게 여길 수 있는 것',
      body: `${signLabel(mine)} — ${ZODIAC_NOTES[mine].trait}\n\n${ELEMENT_LABEL[element]} 원소로 분류돼. ${ELEMENT_NOTE[element]}`,
    },
    {
      id: 'zodiac_self_approach',
      title: '가까워지는 방식',
      body: `양태는 ${withCopula(MODALITY_LABEL[modality])}. ${MODALITY_NOTE[modality]}\n\n원소가 '무엇을 중요하게 보는가'라면 양태는 '어떻게 움직이는가'야. 둘은 다른 층이라 같이 읽어야 해.`,
    },
    {
      id: 'zodiac_self_vs_declared',
      title: '이 렌즈와 네가 직접 답한 기준',
      body: zodiacVsDeclaredBody(element, declared),
    },
    {
      id: 'zodiac_self_unknown',
      title: '이 렌즈로는 알 수 없는 것',
      body:
        '태양궁은 태어난 날짜 하나로 정해져. 같은 날 태어난 모든 사람이 같은 칸에 들어간다는 뜻이라, 네가 실제로 관계에서 어떻게 행동하는지는 이걸로 알 수 없어.\n\n달·상승궁은 출생 시각과 지역이 있어야 계산할 수 있어서 여기서는 만들지 않았어. 없는 걸 있는 것처럼 말하지 않을게.',
    },
  ];

  return {
    kind: 'zodiac',
    label: LENS_LABEL.zodiac,
    mode: 'self',
    selfReason,
    headline: `${signLabel(mine)} — 별자리로 보는 관계 속의 나.`,
    overview: copy.overview,
    sections,
    /**
     * ⚠️ 태양궁 질문(`ZODIAC_NOTES[sign].question`)을 **그대로 체크포인트로 쓰지 않는다.**
     * 그 12개는 전부 물음표로 끝나는 서술형이라, 그대로 두면 체크포인트가 '해볼 것'이
     * 아니라 '읽을 것'이 된다(VALUE-06이 이 자리를 잡았다). 질문은 인용으로 두고,
     * 실제로 해볼 행동을 문장이 직접 말한다.
     */
    checkpoint: `이 렌즈가 던지는 질문은 이거야 — "${ZODIAC_NOTES[mine].question}" 최근에 그랬던 순간을 하나 떠올려봐. 네 기억과 위 설명이 다르면, 맞는 쪽은 네 기억이야.`,
    basis: [
      { label: '내 태양궁', value: `${signLabel(mine)} · ${ELEMENT_LABEL[element]} · ${MODALITY_LABEL[modality]}` },
      { label: '상대 태양궁', value: copy.basis },
      { label: '계산 범위', value: '태양궁만 (달·상승궁 미계산)' },
    ],
    limitations: [copy.limitation, ...zodiacLimitations(cusp, false)],
    disclaimer: LENS_DISCLAIMER.zodiac,
    themes: dedupeThemes([ZODIAC_ELEMENT_THEME[element], ZODIAC_MODALITY_THEME[modality]]),
  };
}

/**
 * §17 항목 04 — 렌즈와 사용자 답을 나란히 놓는다.
 *
 * ⚠️ **원소가 실제로 거리를 말하는 경우에만 비교한다.** `air`(대화와 거리 조절)와
 * `water`(정서적 유대)는 `declared.alone`과 같은 대상을 말하지만, `fire`·`earth`는
 * 아니다. 없는 대응을 만들지 않고 비교하지 않았다고 적는다 — `mbtiBridge`가 축 3개를
 * 기각한 것과 같은 규칙이다.
 */
function zodiacVsDeclaredBody(element: ZodiacElement, declared: DeclaredPreference): string {
  if (element !== 'air' && element !== 'water') {
    return `${ELEMENT_LABEL[element]} 원소는 거리나 개인 시간을 직접 말하는 분류가 아니야. 네가 답한 관계 기준과 나란히 놓을 대응이 없어서 이번엔 비교하지 않았어 — 억지로 이으면 없는 관계를 만드는 거니까.`;
  }
  if (declared.alone === null) {
    return `${ELEMENT_LABEL[element]} 원소는 거리에 대한 감각을 말하는 분류라 네가 답한 개인 시간 필요도와 나란히 놓을 수 있어. 아직 답하지 않아서 이번엔 비교하지 않았어.`;
  }
  if (declared.alone === 3) {
    return `${ELEMENT_LABEL[element]} 원소는 거리에 대한 감각을 말해. 네가 답한 개인 시간 필요도는 가운데라, 어느 쪽이라고 말하기엔 근거가 부족해.`;
  }

  const wantsAlone = declared.alone >= 4;
  const lensWantsDistance = element === 'air';
  const aligns = lensWantsDistance === wantsAlone;
  const declaredLine = wantsAlone
    ? '개인 시간이 꽤 필요하다고 답했어'
    : '개인 시간은 많이 필요하지 않다고 답했어';
  const lensLine =
    element === 'air' ? '거리를 두고 조절하는 쪽으로 이야기돼' : '가까이서 정서적으로 붙어 있는 쪽으로 이야기돼';

  return aligns
    ? `너는 ${declaredLine}. ${ELEMENT_LABEL[element]} 원소도 ${lensLine} — 두 관점이 같은 방향을 가리켰어.`
    : `너는 ${declaredLine}. 그런데 ${ELEMENT_LABEL[element]} 원소는 ${lensLine}. 어긋난 자리인데, 맞는 쪽은 네가 직접 답한 쪽이야.`;
}

function zodiacLimitations(cusp: boolean, pair: boolean): string[] {
  const limits = [
    '지금은 생년월일 기준 태양궁만 봐. 달·상승궁은 출생 시각과 지역까지 필요해서 계산하지 않아.',
  ];
  if (cusp) {
    limits.push(
      '별자리가 바뀌는 경계 날짜에 태어났다면 실제와 다를 수 있어. 연도별 태양 진입 시각은 반영하지 않았어.',
    );
  }
  if (pair) limits.push('상대 생년월일은 네가 알고 있는 값을 기준으로 봤어.');
  return limits;
}

/** 경계일(±1일)에 태어났는지 — `astrologyService`의 비공개 함수와 같은 규칙 */
function nearCusp(date: string | null): boolean {
  if (!date) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return false;
  const month = Number(match[2]);
  const day = Number(match[3]);
  return CUSP_STARTS.some(([m, d]) => m === month && Math.abs(d - day) <= 1);
}

/** `SUN_SIGN_RANGES`의 시작일과 같은 값. 한 곳에서만 읽도록 아래에서 파생시킨다 */
const CUSP_STARTS: readonly [number, number][] = [
  [12, 22], [11, 22], [10, 23], [9, 23], [8, 23], [7, 23],
  [6, 21], [5, 21], [4, 20], [3, 21], [2, 19], [1, 20],
];

/* ══════════════════════════════════════════════════ Cross-Lens (§18~§20) */

/**
 * §19 — 두 개 이상의 렌즈가 있을 때만 만든다(LENS-16).
 *
 * ⚠️ **'3개 근거가 일치했다'로 만들지 않는다**(§20). `note`가 데이터에 필수로
 * 들어가고, 반복 테마 문장도 '몇 개 렌즈에서 나왔다'까지만 말한다.
 */
export function buildCrossLens(reports: readonly PremiumLensReport[]): PremiumCrossLens | null {
  if (reports.length < 2) return null;

  const byTheme = new Map<PremiumLensTheme, PremiumLensReport[]>();
  for (const report of reports) {
    for (const theme of report.themes) {
      byTheme.set(theme, [...(byTheme.get(theme) ?? []), report]);
    }
  }

  const repeated = [...byTheme.entries()]
    .filter(([, owners]) => owners.length >= 2)
    .sort((a, b) => b[1].length - a[1].length);
  const unique = [...byTheme.entries()].filter(([, owners]) => owners.length === 1);

  const repeatedThemes = repeated.map(
    ([theme, owners]) =>
      `'${LENS_THEME_LABEL[theme]}' — ${owners.map((r) => r.label.replace(' 관계 렌즈', '')).join(' · ')} ${owners.length}개 렌즈에서 나왔어.`,
  );

  /**
   * §19 B — 다르게 말하는 부분도 가치다. **어느 렌즈가 맞는지 판단하지 않는다.**
   * 서로 다른 렌즈에 속한 고유 테마를 짝지어 최대 2문장.
   */
  const differences: string[] = [];
  for (let i = 0; i < unique.length && differences.length < 2; i += 1) {
    for (let j = i + 1; j < unique.length && differences.length < 2; j += 1) {
      const [themeA, ownersA] = unique[i]!;
      const [themeB, ownersB] = unique[j]!;
      if (ownersA[0] === ownersB[0]) continue;
      differences.push(
        `${ownersA[0]!.label}에서는 '${LENS_THEME_LABEL[themeA]}'${subjectParticleOf(
          LENS_THEME_LABEL[themeA],
        )} 두드러지는데, ` +
          `${ownersB[0]!.label}에서는 '${LENS_THEME_LABEL[themeB]}'${subjectParticleOf(
            LENS_THEME_LABEL[themeB],
          )} 더 크게 보여. ` +
          '어느 쪽이 맞는지는 이 화면에서 정하지 않아 — 실제 관계에서 확인할 두 지점이 생긴 거야.',
      );
    }
  }

  /**
   * ⚠️ 위 짝짓기는 **서로 다른 렌즈**의 고유 테마가 있어야 성립한다. 브라우저
   * 실측에서 고유 테마 2개가 둘 다 MBTI에서만 나와 이 블록이 통째로 비었다 —
   * '다르게 말하는 부분도 가치다'(§19 B)라고 해놓고 아무것도 주지 않는 상태였다.
   *
   * 짝을 못 만들면 **한 렌즈에서만 나왔다는 사실 자체**를 말한다. 그것도 차이다 —
   * 다른 두 프레임은 그 주제를 아예 보지 않는다는 뜻이니까.
   */
  if (differences.length === 0 && unique.length > 0) {
    for (const [theme, owners] of unique.slice(0, 2)) {
      differences.push(
        `'${LENS_THEME_LABEL[theme]}'${topicParticleOf(LENS_THEME_LABEL[theme])} ${
          owners[0]!.label
        }에서만 나왔어. ` +
          '다른 렌즈는 이 주제를 보지 않는다는 뜻이지, 중요하지 않다는 뜻은 아니야.',
      );
    }
  }

  /** §19 C — 반복 테마 우선, 부족하면 고유 테마로 채운다. 최대 3개 */
  const questionThemes: PremiumLensTheme[] = [
    ...repeated.map(([theme]) => theme),
    ...unique.map(([theme]) => theme),
  ].slice(0, 3);

  return {
    lensCount: reports.length,
    repeatedThemes,
    differences,
    verificationQuestions: questionThemes.map((theme) => LENS_THEME_QUESTION[theme]),
    note: repeatedThemes.length > 0 ? CROSS_LENS_COPY.note : CROSS_LENS_COPY.noRepeatNote,
  };
}

/* ══════════════════════════════════════════════════════════ 조립 */

function unavailable(
  kind: PremiumLensKind,
  reason: string,
  fix: PremiumLensFix,
): PremiumLensEntry {
  return { kind, label: LENS_LABEL[kind], mode: 'unavailable', reason, fix };
}

/**
 * Premium Bundle의 렌즈 3종을 만든다.
 *
 * ⚠️ **렌즈마다 독립적으로 판정한다**(§6). `hasTarget`이 true여도 그 렌즈의
 * 상대 데이터가 없으면 `self`로 내려간다(LENS-10) — 상대가 있다는 이유만으로
 * pair 결과를 만들지 않는다.
 *
 * ⚠️ v1.46.1 — `self`가 된 **이유**를 함께 싣는다. 판정은 그대로다(무엇이 pair가
 * 되는지는 한 글자도 바뀌지 않았다). 바뀐 것은 같은 `self` 안에서 `대상이 없다`와
 * `대상은 있는데 이 렌즈의 값을 모른다`를 구분해 말하는 것뿐이다.
 */
export function buildPremiumLensBundle(input: PremiumLensInput): PremiumLensBundle {
  const { selfMbti, targetMbti, selfBirth, targetBirth, hasTarget, declared, events, today } =
    input;

  /** 상대가 있는데 이 렌즈의 값만 없는 경우와, 상대 자체가 없는 경우를 가른다 */
  const selfReason: PremiumLensSelfReason = hasTarget ? 'target_data_missing' : 'no_target';

  /* ── MBTI ─────────────────────────────────────────────────────────── */
  const mbti: PremiumLensEntry = !selfMbti
    ? unavailable('mbti', LENS_UNAVAILABLE_REASON.mbtiNoSelf, 'mbti')
    : hasTarget && targetMbti
      ? buildMbtiPair(selfMbti, targetMbti, events)
      : buildMbtiSelf(selfMbti, declared, selfReason);

  /* ── 사주 ─────────────────────────────────────────────────────────── */
  const mineSaju = readSajuDay(selfBirth, today);
  const theirsSaju = hasTarget ? readSajuDay(targetBirth, today) : null;
  const saju: PremiumLensEntry = !mineSaju
    ? unavailable(
        'saju',
        isLunarBlocked(selfBirth, today)
          ? LENS_UNAVAILABLE_REASON.sajuLunar
          : LENS_UNAVAILABLE_REASON.sajuNoSelf,
        'birth',
      )
    : theirsSaju
      ? buildSajuPair(mineSaju.pillar, theirsSaju.pillar, mineSaju.limitations, events)
      : buildSajuSelf(mineSaju.pillar, mineSaju.limitations, selfReason);

  /* ── 별자리 ────────────────────────────────────────────────────────── */
  const mineSign = getSunSign(selfBirth.date);
  const theirsSign = hasTarget ? getSunSign(targetBirth.date) : null;
  const cusp = nearCusp(selfBirth.date) || (theirsSign !== null && nearCusp(targetBirth.date));
  const zodiac: PremiumLensEntry = !mineSign
    ? unavailable('zodiac', LENS_UNAVAILABLE_REASON.zodiacNoSelf, 'birth')
    : theirsSign
      ? buildZodiacPair(mineSign, theirsSign, cusp)
      : buildZodiacSelf(mineSign, nearCusp(selfBirth.date), declared, selfReason);

  const lenses: PremiumLensEntry[] = [mbti, saju, zodiac];
  const reports = lenses.filter((lens): lens is PremiumLensReport => lens.mode !== 'unavailable');

  return {
    lenses,
    availableCount: reports.length,
    crossLens: buildCrossLens(reports),
  };
}
