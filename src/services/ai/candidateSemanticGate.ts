import { refsWithinAllowed } from '@/lib/logic/allowedEvidence';
import type { RelationshipTense } from '@/lib/logic/relationshipEvidence';
import { isSendableQuestion } from '@/lib/logic/userFitQuestions';
import type { CandidateSemanticAllowance, CandidateSemanticNarrative } from '@/types';
import { dropTemplateRepeats, scanSemanticNarrative } from './safety';

/**
 * Quality Gate (G) — **Top 3 카드 semantic** (v1.46.4 SEMANTIC DECOMPOSITION · A5 · A11)
 *
 * ══ 왜 별도 파일인가 ══════════════════════════════════════════════════════
 *
 * 이 게이트를 부르는 곳이 둘이다: 제품 핸들러(`runDeepReportTask`)와 dev 검증기
 * (`/api/ai/contract-test`). 직전 구조에서는 두 곳이 **같은 사슬을 복사**해 들고 있었고,
 * 주석으로 "같은 순서·같은 함수"를 약속했다. 약속은 한쪽만 고쳐질 때 조용히 깨진다 —
 * 그래서 사슬 자체를 한 함수로 옮겼다.
 *
 * ══ 무엇이 바뀌지 않았나 ═══════════════════════════════════════════════════
 *
 * 안전·문체 판정은 **직전과 같은 스캐너**다(`scanSemanticNarrative` · `dropTemplateRepeats`).
 * 임계값·패턴·라벨 하나도 바꾸지 않았다. 달라진 것은 검증의 **단위**(insightId →
 * candidateId)와, A11이 요구한 VERIFY 형식 검사 하나가 **추가**된 것뿐이다.
 */

/** 파서가 넘기는 항목 — 허용집합 밖이라 지운 장면 id를 함께 싣는다 */
export interface ParsedCandidateSemantic extends CandidateSemanticNarrative {
  rejectedEventIds: string[];
}

export interface CandidateSemanticGateResult {
  kept: CandidateSemanticNarrative[];
  /** 위반 라벨. **문장 원문이 아니다**(§34 Privacy) */
  violations: string[];
  stages: {
    parsed: number;
    grounded: number;
    safetyPassed: number;
    stylePassed: number;
    accepted: number;
  };
  /** A11 — 질문 형식이 아니라서 verification만 뺀 수. 문장 자체는 남는다 */
  verificationDropped: number;
}

/** 문체 계층 위반인가 — 위험한 주장이 아니라 '첫 화면에 쓸 수 없는 문장'인가 */
export function isStyleViolation(label: string): boolean {
  return label.startsWith('meta_') || label.startsWith('semantic_') || label === 'scene_recitation';
}

export function gateCandidateSemantics(
  parsed: readonly ParsedCandidateSemantic[],
  allowances: readonly CandidateSemanticAllowance[],
  tense: RelationshipTense,
): CandidateSemanticGateResult {
  const allowanceById = new Map(allowances.map((allowance) => [allowance.candidateId, allowance]));
  const violations: string[] = [];
  let grounded = 0;
  let safetyPassed = 0;
  let verificationDropped = 0;
  const survivors: CandidateSemanticNarrative[] = [];

  for (const item of parsed) {
    const allowance = allowanceById.get(item.candidateId);
    if (!allowance) continue;

    /*
      §9 — **근거 귀속.** 이 카드에 보내지 않은 장면·근거를 들고 오면 그것만으로 버린다.
      부분 통과시키지 않는다 — 어떤 근거가 진짜인지 화면이 구분할 방법이 없다.
    */
    if (item.rejectedEventIds.length > 0) {
      violations.push('semantic_event_id_outside_allowed');
      continue;
    }
    if (!refsWithinAllowed(item.usedEvidenceRefs, allowance.evidenceRefs)) {
      violations.push('semantic_evidence_ref_outside_allowed');
      continue;
    }
    grounded += 1;

    const narrative: CandidateSemanticNarrative = {
      candidateId: item.candidateId,
      semanticMode: item.semanticMode,
      soWhat: item.soWhat,
      whyItMatters: item.whyItMatters,
      ...(item.verification ? { verification: item.verification } : {}),
      usedEvidenceRefs: item.usedEvidenceRefs,
      usedEventIds: item.usedEventIds,
    };
    let candidate = narrative;

    /*
      ══ A10 · A11 — **current의 VERIFY는 상대에게 실제로 물을 수 있는 질문이다** ══

      직전 A/B에서 gpt-5.4의 VERIFY가 `적어봐` · `구분해봐` 같은 혼자 하는 행동으로
      수렴했고, 그게 Actionability 미달의 원인이었다. 질문 형식이 아닌 VERIFY는
      **그 한 칸만 뺀다** — soWhat·whyItMatters는 형식 문제가 아니라서 남는다.

      ⚠️ 이건 완화가 아니라 추가 검사다. 직전에는 이 문장이 VERIFY 줄로 그대로 나갔다.
      ⚠️ 판정은 질문 칸이 쓰는 것과 **같은 술어**다(`isSendableQuestion`). 두 벌이면
      여기서 통과한 문장이 질문 칸에서 떨어진다.
      ⚠️ former에서는 이 검사를 하지 않는다. 그쪽 VERIFY는 상대에게 보내는 말이 아니라
      회고 질문이고, outward 여부는 아래 시제 스캐너가 본다.
    */
    if (
      tense === 'current' &&
      candidate.verification &&
      !isSendableQuestion(candidate.verification, allowance.sceneTexts)
    ) {
      violations.push('semantic_verify_not_question');
      verificationDropped += 1;
      candidate = {
        candidateId: narrative.candidateId,
        semanticMode: narrative.semanticMode,
        soWhat: narrative.soWhat,
        whyItMatters: narrative.whyItMatters,
        usedEvidenceRefs: narrative.usedEvidenceRefs,
        usedEventIds: narrative.usedEventIds,
      };
    }

    const scan = scanSemanticNarrative(candidate, tense, allowance.sceneTexts);
    if (!scan.safe) {
      violations.push(...scan.violations);
      /* 안전 위반이 하나라도 있으면 안전 탈락으로 센다 — 문체보다 우선한다 */
      if (scan.violations.some((label) => !isStyleViolation(label))) continue;
      safetyPassed += 1;
      continue;
    }
    safetyPassed += 1;
    survivors.push(candidate);
  }

  /*
    §17 — 세 카드가 **같은 틀로 수렴했는지**는 항목 하나만 봐서는 알 수 없다. 앞의 것을
    남기고 뒤를 버린다(표시 순서가 곧 우선순위다). 버려진 카드는 결정론 조립문을 쓴다.
  */
  const templateCheck = dropTemplateRepeats(
    survivors,
    (item) => `${item.soWhat} ${item.whyItMatters}`,
  );
  if (templateCheck.dropped > 0) violations.push('semantic_template_repeat');

  return {
    kept: templateCheck.kept,
    violations,
    stages: {
      parsed: parsed.length,
      grounded,
      safetyPassed,
      stylePassed: survivors.length,
      accepted: templateCheck.kept.length,
    },
    verificationDropped,
  };
}
