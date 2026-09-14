import {
  PREMIUM_MIN_SELF_AXES,
  answeredDeclaredAxisCount,
  hasPremiumEvidence,
} from '@/lib/logic/premiumChapters';
import { ROUTES } from '@/lib/routes';
import { targetKnownCount } from '@/lib/validation';
import type {
  CrossSourceInsight,
  DeclaredPreference,
  MirrorReport,
  RelationshipExperience,
  TargetProfile,
} from '@/types';

/**
 * Premium 근거 상태 — **왜 아직 정밀 리포트를 만들 수 없는가** (v1.47 UT-2 Stability)
 *
 * ```
 * ready                          hasPremiumEvidence = true — 리포트를 만든다
 * missing_profile                내 관계 기준 답이 3축 미만(Self-only 경로의 최소치)
 * missing_target                 상대가 있는데 상대에 대해 아는 항목이 0개
 * missing_relationship_evidence  이전 관계 경험을 하나도 답하지 않았다(건너뛰기 아님)
 * missing_other                  위 입력은 있지만 아직 서로 이어지는 신호가 없다
 * ```
 *
 * ⚠️ **자격 판정을 새로 만들지 않는다.** `ready`는 `hasPremiumEvidence` 그대로다 — 두 벌이 되면
 * '열렸는데 비어 있는 리포트'가 다시 생긴다. 이 함수는 `ready`가 아닐 때 **채울 수 있는 입력**만 고른다.
 * ⚠️ 여기서 고른 입력을 채워도 반드시 ready가 된다고 약속하지 않는다 — 화면 문구도 '필요할 수 있어' 수준이다.
 * ⚠️ 상대가 없는 사용자(solo)에게 상대 정보를 요구하지 않는다(UT-1 P0-A와 같은 규칙).
 */
export type PremiumEvidenceState =
  | 'ready'
  | 'missing_profile'
  | 'missing_target'
  | 'missing_relationship_evidence'
  | 'missing_other';

export interface PremiumEvidenceFill {
  state: Exclude<PremiumEvidenceState, 'ready'>;
  label: string;
  href: string;
}

export interface PremiumEvidenceGap {
  state: PremiumEvidenceState;
  /** 채울 수 있는 입력 — ready면 빈 배열 */
  fills: PremiumEvidenceFill[];
}

export function resolvePremiumEvidenceState(input: {
  insights: readonly CrossSourceInsight[];
  declared: DeclaredPreference;
  mirror: MirrorReport;
  target: TargetProfile;
  experience: RelationshipExperience;
  solo: boolean;
}): PremiumEvidenceGap {
  if (hasPremiumEvidence({ insights: input.insights, declared: input.declared, mirror: input.mirror })) {
    return { state: 'ready', fills: [] };
  }

  const fills: PremiumEvidenceFill[] = [];
  if (answeredDeclaredAxisCount(input.declared) < PREMIUM_MIN_SELF_AXES) {
    fills.push({ state: 'missing_profile', label: '내 관계 기준 답하기', href: ROUTES.declared(1) });
  }
  if (!input.solo && targetKnownCount(input.target) === 0) {
    fills.push({ state: 'missing_target', label: '상대에 대해 아는 것 채우기', href: ROUTES.target });
  }
  const experience = input.experience;
  const noExperience =
    !experience.skipped &&
    experience.important.length === 0 &&
    experience.hardest === null &&
    experience.selfGap === null;
  if (noExperience) {
    fills.push({
      state: 'missing_relationship_evidence',
      label: '이전 관계 경험 알려주기',
      href: ROUTES.pastIntro,
    });
  }
  if (fills.length === 0) {
    fills.push(
      input.solo
        ? { state: 'missing_other', label: 'MBTI 입력하기', href: ROUTES.declared(4) }
        : { state: 'missing_other', label: '상대에 대해 아는 것 더 채우기', href: ROUTES.target },
    );
  }
  return { state: fills[0]!.state, fills };
}
