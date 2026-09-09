import { NO_EVIDENCE_COPY } from '@/data/copy';
import { OBSERVED_SHORT_LABEL } from '@/data/observations';
import {
  AFFECTION_LABEL,
  CONFLICT_LABEL,
  HARDEST_LABEL,
  HOBBY_LABEL,
  NO_EXPERIENCE_LABEL,
  PAST_FACTOR_LABEL,
} from '@/data/labels';
import type {
  AiObservedTrait,
  Confidence,
  CurrentRelationshipEvidence,
  DeclaredPreference,
  HardestMoment,
  MirrorInsight,
  ObservationFeedback,
  ProfileLayer,
  RelationshipExperience,
  RelationshipProfile,
} from '@/types';
import { buildMirrorReport } from './mirror';
import { hasTemporalComparison, type RelationshipTense } from './relationshipEvidence';

/**
 * Relationship Profile (S18)
 *
 * ⚠️ 이 화면은 Declared Me와 Relationship Me 사이의 모순이나 Gap을 판정하지 않는다.
 * 그건 S26 Mirror Teaser부터 처음 등장해야 하는 Aha Moment다. S18에서 미리 그 결론을
 * 말해버리면 이후 Mirror가 '이미 본 내용의 반복'이 된다.
 *
 * 그래서 이 파일은 buildMirrorReport()를 호출하지 않는다 — Observed/Declared/Relationship
 * 세 Source를 그냥 나열하고, '세 관찰을 합친 결과'는 GAP 여부를 말하지 않는 순수 요약(Profile
 * Summary)이다. 근거 추적은 layers의 칩이 OBSERVED/DECLARED/RELATIONSHIP 중 어디서 왔는지로
 * 이미 충분하므로 별도의 Evidence 목록도 두지 않는다.
 */

/** 관찰 확신도 — '얼마나 많은 입력 근거가 확보됐는가'를 뜻한다. AI가 얼마나 확신하는가가 아니다. */
function confidenceOf(experience: RelationshipExperience): Confidence {
  if (experience.skipped) return 'low';

  const hasStructure = experience.important.length >= 3 && experience.selfGap !== null;
  if (!hasStructure) return 'low';

  return experience.note.trim().length > 0 ? 'high' : 'medium';
}

/**
 * v1.16 — 이 화면(S18)의 OBSERVED ME 칩은 **실제 분석 결과**(`answers.observedAnalysis.traits`)를
 * 근거로 삼는다. 예전에는 고정된 데모 목록(`OBSERVED_TRAITS`, ob1~ob4)만 봤는데, real/mock
 * 모드의 실제 trait id는 사진 신호 기반으로 동적으로 생성되어 그 목록과 전혀 겹치지 않았다 —
 * 그래서 사진을 다시 분석해도 이 칩은 절대 바뀌지 않았다(Photo Revisit §12 위반).
 */
export function observedItems(
  traits: readonly AiObservedTrait[],
  observations: Record<string, ObservationFeedback>,
): { id: string; label: string; corrected: boolean }[] {
  return traits.filter((trait) => {
    const feedback = observations[trait.id];
    if (feedback?.excluded) return false;
    // '조금 달라요'만 누른 항목은 빼고, 사용자가 직접 고쳐 쓴 항목은 고친 문장으로 남긴다.
    if (feedback?.verdict === 'no') return Boolean(feedback.correctedText?.trim());
    return true;
  }).map((trait) => {
    const corrected = observations[trait.id]?.correctedText?.trim();
    return {
      id: trait.id,
      // demo/legacy-demo는 짧은 라벨이 따로 있었다 — 있으면 그대로 쓰고, 없으면(real/mock)
      // trait.label을 쓴다(스키마상 이미 짧은 명사구다, services/ai/schemas.ts 참고).
      label: corrected || OBSERVED_SHORT_LABEL[trait.id] || trait.label,
      corrected: Boolean(corrected),
    };
  });
}

export function declaredItems(declared: DeclaredPreference): string[] {
  const items: string[] = [];
  if (declared.contact !== null) items.push(`연락 ${declared.contact}/5`);
  if (declared.conflict !== null) items.push(CONFLICT_LABEL[declared.conflict]);
  if (declared.alone !== null) items.push(`개인 시간 ${declared.alone}/5`);
  if (declared.affection !== null) items.push(AFFECTION_LABEL[declared.affection]);
  if (declared.hobby !== null) items.push(`취미 ${HOBBY_LABEL[declared.hobby]}`);
  return items;
}

export function relationshipItems(experience: RelationshipExperience): string[] {
  if (experience.skipped) return [NO_EXPERIENCE_LABEL];

  const items = experience.important.map((factor) => PAST_FACTOR_LABEL[factor]);
  if (experience.hardest) items.push(HARDEST_LABEL[experience.hardest]);
  return items;
}

/**
 * Declared 답변에서 가장 두드러지는 특징 하나 (우선순위 순서로 첫 매치)
 *
 * ⚠️ v1.36 — **두 어미를 함께 둔다.**
 *
 * v1.35까지는 `-하고,` 연결형 **하나만** 있었고, 관계 경험이 없어 뒤에 붙일 절이
 * 없으면 쉼표만 떼고 `모습이 보여.`를 붙였다. 그 결과 연애 경험이 없는 모든
 * 사용자의 Relationship Profile 첫 문장이
 * **"개인 시간을 중요하게 여기고 모습이 보여."** 처럼 깨졌다(실측).
 *
 *   chain   뒤에 관계 경험 문장이 이어질 때
 *   alone   그 문장 하나로 끝날 때 (관형형)
 */
function declaredHighlight(
  declared: DeclaredPreference,
): { chain: string; alone: string } | null {
  const pick = (stem: string, attributive: string) => ({
    chain: `${stem},`,
    alone: `${attributive} 모습이 보여.`,
  });

  if (declared.alone !== null && declared.alone >= 4) {
    return pick('개인 시간을 중요하게 여기고', '개인 시간을 중요하게 여기는');
  }
  if (declared.contact !== null && declared.contact >= 4) {
    return pick('연락을 자주 주고받는 걸 좋아하고', '연락을 자주 주고받는 걸 좋아하는');
  }
  if (declared.conflict === 'now') {
    return pick('갈등은 바로 풀고 싶어 하고', '갈등은 바로 풀고 싶어 하는');
  }
  if (declared.affection === 'a3') {
    return pick('애정 표현을 자주 하고 싶어 하고', '애정 표현을 자주 하고 싶어 하는');
  }
  if (declared.hobby === 'h3') {
    return pick('연인과 많은 걸 함께 하고 싶어 하고', '연인과 많은 걸 함께 하고 싶어 하는');
  }
  if (declared.contact !== null && declared.contact <= 2) {
    return pick('연락에는 크게 얽매이지 않으려 하고', '연락에는 크게 얽매이지 않으려 하는');
  }
  if (declared.alone !== null && declared.alone <= 2) {
    return pick(
      '혼자보다는 함께 있는 시간을 편하게 느끼고',
      '혼자보다는 함께 있는 시간을 편하게 느끼는',
    );
  }
  if (declared.conflict === 'space') {
    return pick('갈등 후에는 혼자 정리할 시간이 필요하고', '갈등 후에는 혼자 정리할 시간이 필요한');
  }
  if (declared.affection === 'a1') {
    return pick('애정 표현은 담백한 편을 좋아하고', '애정 표현은 담백한 편을 좋아하는');
  }
  if (declared.hobby === 'h1') {
    return pick('취미는 각자 즐기는 편을 편하게 느끼고', '취미는 각자 즐기는 편을 편하게 느끼는');
  }
  return null;
}

const HARDEST_HIGHLIGHT: Record<HardestMoment, string> = {
  contact_drop: '관계에서는 연락이 줄어드는 순간에 민감하게 반응했어.',
  fight_silence: '관계에서는 갈등 후 대화가 멈추는 상황에 민감하게 반응했어.',
  no_time: '관계에서는 개인 시간이 줄어드는 상황에 민감하게 반응했어.',
  value_gap: '관계에서는 기준 차이가 드러나는 순간에 민감하게 반응했어.',
};

/** 관계 경험에서 가장 두드러지는 신호 하나 */
function relationshipHighlight(experience: RelationshipExperience): string | null {
  if (experience.skipped) return null;
  if (experience.hardest) return HARDEST_HIGHLIGHT[experience.hardest];
  if (experience.important.length > 0) {
    return `관계에서는 ${PAST_FACTOR_LABEL[experience.important[0]!]}에 특히 신경 쓰는 모습을 보였어.`;
  }
  return null;
}

/**
 * '세 관찰을 합친 결과' 한 줄 — Declared와 Relationship을 나란히 놓을 뿐,
 * '말했지만 실제로는' 같은 비교·판정 표현은 쓰지 않는다.
 */
export function buildProfileSummary(
  declared: DeclaredPreference,
  experience: RelationshipExperience,
): string {
  const d = declaredHighlight(declared);
  const r = relationshipHighlight(experience);

  if (d && r) return `${d.chain} ${r}`;
  if (d) return d.alone;
  if (r) return r;
  return NO_EVIDENCE_COPY.summary;
}

/**
 * Home(S29) Hero 한 줄 — v1.44 NEW-002
 *
 * ══ 왜 함수로 빼는가 ══════════════════════════════════════════════════════
 *
 * 예전에는 `home/page.tsx` 안의 삼항 한 줄이었다:
 *
 * ```
 * answers.coreCorrection.trim() ||
 *   (completed.profile ? (mirror.core?.summary ?? fallbackProfile) : fallbackProfile)
 * ```
 *
 * 두 갈래가 **같은 문장으로 수렴**하는데도 서로 다른 조건 아래 있어서, 그 문장이
 * 근거 없는 성격 단정이라는 사실이 읽히지 않았다. 우선순위를 한 곳에 세워 두면
 * 마지막 줄이 '근거가 없을 때 무엇을 말하는가'라는 질문 그 자체가 된다.
 *
 * ══ 우선순위 ══════════════════════════════════════════════════════════════
 *
 * ```
 * ① 사용자 수정문(coreCorrection)   — 사용자가 직접 고친 문장이 언제나 이긴다
 * ② Mirror Core 요약                — 단, 프로필을 완료해 그 화면에 도달했을 때만
 * ③ 근거 없음                       — 관찰을 발명하지 않는다
 * ```
 *
 * ⚠️ ②의 `completed.profile` 조건은 v1.44에서도 그대로다. 프로필을 완료하지 않은
 * 사용자에게 Mirror 요약을 앞당겨 보여주지 않는다.
 */
export function homeHeroSummary(input: {
  coreCorrection: string;
  profileCompleted: boolean;
  mirrorSummary: string | null;
}): string {
  const correction = input.coreCorrection.trim();
  if (correction) return correction;
  // 빈 문자열도 '근거 없음'이다 — `?? fallback`은 `''`를 통과시켰다
  if (input.profileCompleted && input.mirrorSummary?.trim()) return input.mirrorSummary;
  return NO_EVIDENCE_COPY.summary;
}

export function buildRelationshipProfile(
  traits: readonly AiObservedTrait[],
  observations: Record<string, ObservationFeedback>,
  declared: DeclaredPreference,
  experience: RelationshipExperience,
): RelationshipProfile {
  const observed = observedItems(traits, observations).map((item) => item.label);

  /**
   * ⚠️ v1.37 — **관찰이 없으면 OBSERVED 레이어 자체가 없다.**
   *
   * §0: '사진은 입장권이 아니다. Observed는 보강 근거이고, 없으면 그 섹션만 없다' ·
   * '없는 것은 자리도 만들지 않는다 — 빈 섹션·빈 카드·정보 없음 자리를 두지 않는다.'
   * 예전에는 사진이 0장이어도 레이어가 남아 `OBSERVED ME · 사진 관찰 / 아직 기록이 없어`가
   * 결과 화면 맨 위에 떴다. S07 게이트가 열린 v1.37부터는 그게 흔한 상태가 되므로,
   * 빈 자리를 남기는 대신 지운다.
   */
  const layers: ProfileLayer[] = [
    ...(observed.length > 0
      ? [
          {
            id: 'observed' as const,
            title: 'OBSERVED ME',
            caption: '사진 관찰',
            items: observed,
          },
        ]
      : []),
    {
      id: 'declared',
      title: 'DECLARED ME',
      caption: '네 답변',
      items: declaredItems(declared),
    },
    {
      id: 'relationship',
      title: 'RELATIONSHIP ME',
      caption: '이전 관계',
      items: relationshipItems(experience),
    },
  ];

  return {
    layers,
    coreInsight: buildProfileSummary(declared, experience),
    confidence: confidenceOf(experience),
  };
}

/**
 * 홈(S29)의 '최근 관찰' 3줄 — Mirror 판정(S26 이후)을 그대로 재사용한다
 *
 * ⚠️ v1.41 — Mirror와 **같은 입력**을 받는다. 여기만 현재 근거를 빼면 Home 카드가
 * `/mirror` 본문과 다른 판정을 보여준다 — v1.36이 Teaser에서 고친 것과 같은 종류의
 * 결함(같은 데이터에 두 화면이 다른 말을 하는 것)이다.
 */
/**
 * CHANGE 판정의 축 칩 한 칸 — v1.44 NEW-003
 *
 * ══ 무엇이 문제였나 ═══════════════════════════════════════════════════════
 *
 * 연락 칩의 CHANGE 문구는 `경험 후 기준이 낮아짐`이었다. `stateFor`는
 * `declared >= 4` + 근거 없음도 CHANGE로 판정하므로(계산은 v1.0부터 그대로),
 * **관계 경험을 하나도 답하지 않은 사용자에게 시간적 변화를 주장했다** —
 * `declared.contact=5`만 답한 세션에서 실측됐다(NEW-003).
 *
 * v1.41은 이 문장 계열을 `scope`별로 갈랐지만 **Home 칩은 그 작업에서 빠져 있었다.**
 * 그래서 이 칩은 `'past'`가 아닌 두 scope에서 모두 틀린 말을 하고 있었다.
 *
 * ══ 세 갈래 ═══════════════════════════════════════════════════════════════
 *
 * ```
 * scope 'past'     비교할 두 시점이 실제로 있다   → 기존 문구 그대로 (변경 0)
 * scope 'current'  지금은 안 드러난다고 답했다     → v1.41이 이미 쓰던 문구 재사용
 * scope 'none'     관계 신호를 확인한 적이 없다   → NO_EVIDENCE_COPY.axis (NEW-002와 같은 규칙)
 * ```
 *
 * ⚠️ **새 카피를 만들지 않았다.** `'current'` 문구는 v1.41이 같은 상태·같은 scope에
 * 이미 쓰고 있는 것(`MirrorComparisonRow`의 `CURRENT_STATE_TEXT`)이고, `'none'`은
 * NEW-002가 이 세 축에 세운 중립 문구다.
 *
 * ⚠️ **Mirror 본문에서는 이 판정이 그대로 남는다.** 거기에는 근거 칸과 노트가 있어
 * '무엇을 답했고 왜 비교할 수 없는지'를 말할 수 있다. 칩은 한 칸이라 그 말을 담을
 * 자리가 없으므로, **담을 수 없는 말을 하지 않는 것**이다 — 판정을 지우는 것이 아니다.
 */
function changeChipOf(insight: MirrorInsight, pastText: string): string {
  if (hasTemporalComparison(insight.evidenceScope)) return pastText;
  if (insight.evidenceScope === 'current') return '지금은 크게 드러나지 않음';
  return NO_EVIDENCE_COPY.axis;
}

export function buildHomeHighlights(
  declared: DeclaredPreference,
  experience: RelationshipExperience,
  current: CurrentRelationshipEvidence,
  tense: RelationshipTense,
): { key: string; value: string }[] {
  const report = buildMirrorReport(declared, experience, current, tense);
  const byKey = new Map(report.insights.map((insight) => [insight.key, insight]));

  const contact = byKey.get('contact');
  const conflict = byKey.get('conflict');
  const hobby = byKey.get('hobby');

  return [
    {
      key: '연락',
      value:
        contact?.state === 'GAP'
          ? '생각보다 중요한 신호'
          : contact?.state === 'CHANGE'
            ? changeChipOf(contact, '경험 후 기준이 낮아짐')
            : contact?.state === 'MATCH'
              ? '기준이 비슷하게 유지됨'
              : NO_EVIDENCE_COPY.axis,
    },
    /**
     * ⚠️ v1.44 NEW-002 — **마지막 갈래가 답을 발명하고 있었다.**
     *
     * `ConflictStyle`은 `now`·`soon`·`space` 셋이고 미입력은 `null`이다. 예전 코드는
     * `now`·`space`·GAP만 열거하고 **나머지 전부**에 `잠깐 뒤 대화 선호`를 붙였다.
     * 그 '나머지'에는 실제 답인 `soon`과 **답이 없는 `null`이 같이** 들어 있었다.
     * 그래서 아무것도 답하지 않은 신규 사용자의 Home에 `갈등 · 잠깐 뒤 대화 선호`가
     * 떴고(HOME-EMPTY-01), 손상 세션의 `conflict:99`도 같은 문장을 만들었다(BUG-002).
     *
     * `soon`을 **명시적으로** 적어 원래 의미를 지키고, 남은 자리는 연락·취미 축과
     * 같은 중립 문구로 돌린다 — 세 축 중 갈등만 빠져 있었던 것이 결함의 전부다.
     *
     * ⚠️ GAP 검사가 `soon`보다 **앞**인 순서는 그대로다. `soon`이면서 GAP인 사용자는
     * v1.43과 같이 `멈춘 대화에 민감`을 본다.
     */
    {
      key: '갈등',
      value:
        declared.conflict === 'now'
          ? '빠른 해결 선호'
          : declared.conflict === 'space'
            ? '혼자 정리할 시간 필요'
            : conflict?.state === 'GAP'
              ? '멈춘 대화에 민감'
              : declared.conflict === 'soon'
                ? '잠깐 뒤 대화 선호'
                : NO_EVIDENCE_COPY.axis,
    },
    {
      key: '취미',
      value:
        hobby?.state === 'CHANGE'
          ? changeChipOf(hobby, '관계의 핵심 기준은 아님')
          : hobby?.state === 'GAP'
            ? '함께하는 시간이 중요'
            : hobby?.state === 'MATCH'
              ? '기준이 그대로 유지됨'
              : NO_EVIDENCE_COPY.axis,
    },
  ];
}
