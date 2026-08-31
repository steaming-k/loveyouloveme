import { OBSERVED_SHORT_LABEL, OBSERVED_TRAITS } from '@/data/observations';
import {
  AFFECTION_LABEL,
  CONFLICT_LABEL,
  HARDEST_LABEL,
  HOBBY_LABEL,
  NO_EXPERIENCE_LABEL,
  PAST_FACTOR_LABEL,
} from '@/data/labels';
import type {
  Confidence,
  DeclaredPreference,
  ObservationFeedback,
  ProfileLayer,
  RelationshipExperience,
  RelationshipProfile,
} from '@/types';
import { buildCoreEvidence, buildMirrorReport } from './mirror';

/**
 * Relationship Profile (S18)
 * Observed / Declared / Relationship 세 관찰을 카드 3개로 나열하는 데서 끝내지 않고
 * '세 관찰을 합친 결과' 한 줄로 연결한다.
 */

/** 관찰 확신도 — 근거가 얇으면 숨기지 않고 낮게 표시한다 */
function confidenceOf(experience: RelationshipExperience): Confidence {
  if (experience.skipped) return 'low';

  const hasStructure = experience.important.length >= 3 && experience.selfGap !== null;
  if (!hasStructure) return 'low';

  return experience.note.trim().length > 0 ? 'high' : 'medium';
}

export function observedItems(
  observations: Record<string, ObservationFeedback>,
): { id: string; label: string; corrected: boolean }[] {
  return OBSERVED_TRAITS.filter((trait) => {
    const feedback = observations[trait.id];
    if (feedback?.excluded) return false;
    // '조금 달라요'만 누른 항목은 빼고, 사용자가 직접 고쳐 쓴 항목은 고친 문장으로 남긴다.
    if (feedback?.verdict === 'no') return Boolean(feedback.correctedText?.trim());
    return true;
  }).map((trait) => {
    const corrected = observations[trait.id]?.correctedText?.trim();
    return {
      id: trait.id,
      label: corrected || OBSERVED_SHORT_LABEL[trait.id] || trait.text,
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

export function buildRelationshipProfile(
  observations: Record<string, ObservationFeedback>,
  declared: DeclaredPreference,
  experience: RelationshipExperience,
): RelationshipProfile {
  const report = buildMirrorReport(declared, experience);

  const layers: ProfileLayer[] = [
    {
      id: 'observed',
      title: 'OBSERVED ME',
      caption: '사진 관찰',
      items: observedItems(observations).map((item) => item.label),
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
    coreInsight: report.core.summary,
    evidence: buildCoreEvidence(
      report.insights.find((insight) => insight.key === report.teaser.axisKey) ??
        report.insights[0]!,
      experience,
    ),
    confidence: confidenceOf(experience),
  };
}

/** 홈(S29)의 '최근 관찰' 3줄 */
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
            : '기준이 비슷하게 유지됨',
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
            : '기준이 그대로 유지됨',
    },
  ];
}
