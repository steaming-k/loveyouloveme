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
  DeclaredPreference,
  HardestMoment,
  ObservationFeedback,
  ProfileLayer,
  RelationshipExperience,
  RelationshipProfile,
} from '@/types';
import { buildMirrorReport } from './mirror';

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

/** Declared 답변에서 가장 두드러지는 특징 하나 (우선순위 순서로 첫 매치) */
function declaredHighlight(declared: DeclaredPreference): string | null {
  if (declared.alone !== null && declared.alone >= 4) return '개인 시간을 중요하게 여기고,';
  if (declared.contact !== null && declared.contact >= 4) return '연락을 자주 주고받는 걸 좋아하고,';
  if (declared.conflict === 'now') return '갈등은 바로 풀고 싶어 하고,';
  if (declared.affection === 'a3') return '애정 표현을 자주 하고 싶어 하고,';
  if (declared.hobby === 'h3') return '연인과 많은 걸 함께 하고 싶어 하고,';
  if (declared.contact !== null && declared.contact <= 2) return '연락에는 크게 얽매이지 않으려 하고,';
  if (declared.alone !== null && declared.alone <= 2) return '혼자보다는 함께 있는 시간을 편하게 느끼고,';
  if (declared.conflict === 'space') return '갈등 후에는 혼자 정리할 시간이 필요하고,';
  if (declared.affection === 'a1') return '애정 표현은 담백한 편을 좋아하고,';
  if (declared.hobby === 'h1') return '취미는 각자 즐기는 편을 편하게 느끼고,';
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

  if (d && r) return `${d} ${r}`;
  if (d) return `${d.replace(/,$/, '')} 모습이 보여.`;
  if (r) return r;
  return '아직 뚜렷한 특징을 관찰하기엔 정보가 조금 더 필요해.';
}

export function buildRelationshipProfile(
  traits: readonly AiObservedTrait[],
  observations: Record<string, ObservationFeedback>,
  declared: DeclaredPreference,
  experience: RelationshipExperience,
): RelationshipProfile {
  const layers: ProfileLayer[] = [
    {
      id: 'observed',
      title: 'OBSERVED ME',
      caption: '사진 관찰',
      items: observedItems(traits, observations).map((item) => item.label),
    },
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

/** 홈(S29)의 '최근 관찰' 3줄 — Mirror 판정(S26 이후)을 그대로 재사용한다 */
export function buildHomeHighlights(
  declared: DeclaredPreference,
  experience: RelationshipExperience,
): { key: string; value: string }[] {
  const report = buildMirrorReport(declared, experience);
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
            ? '경험 후 기준이 낮아짐'
            : contact?.state === 'MATCH'
              ? '기준이 비슷하게 유지됨'
              : '아직 뚜렷한 신호 없음',
    },
    {
      key: '갈등',
      value:
        declared.conflict === 'now'
          ? '빠른 해결 선호'
          : declared.conflict === 'space'
            ? '혼자 정리할 시간 필요'
            : conflict?.state === 'GAP'
              ? '멈춘 대화에 민감'
              : '잠깐 뒤 대화 선호',
    },
    {
      key: '취미',
      value:
        hobby?.state === 'CHANGE'
          ? '관계의 핵심 기준은 아님'
          : hobby?.state === 'GAP'
            ? '함께하는 시간이 중요'
            : hobby?.state === 'MATCH'
              ? '기준이 그대로 유지됨'
              : '아직 뚜렷한 신호 없음',
    },
  ];
}
