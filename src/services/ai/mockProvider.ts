import 'server-only';

import type { AiProvider, GenerateStructuredInput } from './provider';

/**
 * Mock Provider — **개발 전용** (v1.7 · §5)
 *
 * Provider Key가 없는 환경에서 다음을 실제 코드 경로로 검증하기 위한 장치다:
 *   - Narrative 화면 배선 (S22/S23/S24/S25/S27/S28/F2)
 *   - EvidenceRef Resolver가 실제 세션 데이터로 근거 문장을 만드는지
 *   - 규칙 값 덮어쓰기(state/kind)가 실제로 동작하는지
 *   - Cache · stale 폐기 · prefetch
 *
 * ⚠️ 검증 단계를 **건너뛰지 않는다.** 이 응답도 파싱 → Business Validation →
 * Safety Scan을 그대로 통과해야 화면에 도달한다. 그래서 '검증을 우회한 가짜 통과'가 아니다.
 *
 * ⚠️ 이것은 **실제 Provider 검증이 아니다.** 실제 응답의 형식 편차·거절·지연·토큰 한계는
 * 여기서 재현되지 않는다. 문서에 `Real Provider E2E = Not Verified`로 남긴 이유다(§93).
 *
 * ⚠️ 사진 내용을 보지 않는다. Observed mock은 '사진에서 봤다'고 주장하는 문장을 만들지
 * 않고, 입력으로 받은 imageId를 참조하는 **형식만** 재현한다.
 */

const MOCK_MODEL = 'mock-provider';

/** `<user_data>` 블록에서 payload를 되읽는다. mock이 실제 입력을 반영하게 하기 위한 것 */
function readPayload(userPayload: string): Record<string, unknown> {
  const match = userPayload.match(/<user_data>\s*([\s\S]*?)\s*<\/user_data>/);
  if (!match?.[1]) return {};
  try {
    const parsed: unknown = JSON.parse(match[1]);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function observedResponse(payload: Record<string, unknown>): unknown {
  const imageIds = Array.isArray(payload.imageIds) ? (payload.imageIds as string[]) : [];
  if (imageIds.length === 0) return { traits: [], usableImageCount: 0, limitations: [] };

  const first = imageIds[0]!;
  const second = imageIds[1];

  return {
    traits: [
      {
        category: 'activity',
        label: '실외 활동',
        observation: '바깥에서 찍은 사진이 여러 장 보여',
        evidence: second
          ? [
              { imageId: first, description: '야외로 보이는 배경' },
              { imageId: second, description: '또 다른 야외 장면' },
            ]
          : [{ imageId: first, description: '야외로 보이는 배경' }],
        confidence: 'high',
      },
      {
        category: 'social',
        label: '함께 있는 장면',
        observation: '다른 사람과 함께 찍은 사진이 있어',
        evidence: [{ imageId: first, description: '두 명 이상이 함께 있는 구도' }],
        confidence: 'medium',
      },
    ],
    usableImageCount: imageIds.length,
    limitations: ['mock 응답이라 실제 사진 내용을 본 결과가 아니야'],
  };
}

function relationshipResponse(payload: Record<string, unknown>): unknown {
  const judgements = Array.isArray(payload.judgements)
    ? (payload.judgements as { axis: string; state: string }[])
    : [];
  const focusAxis = typeof payload.focusAxis === 'string' ? payload.focusAxis : null;

  /**
   * 검증된 관찰이 있으면 observed ref를 하나 섞는다.
   * Evidence Resolver의 observed 경로(사용자 수정 우선 · §75)까지 실제로 지나가게 하려는 것이다.
   */
  const context = (typeof payload.context === 'object' && payload.context !== null
    ? payload.context
    : {}) as { observedValidated?: { traitId: string }[] };
  const firstTraitId = context.observedValidated?.[0]?.traitId ?? null;
  const observedRef = firstTraitId
    ? [{ source: 'observed', traitId: firstTraitId }]
    : [];

  return {
    narratives: judgements.map((judgement) => ({
      axis: judgement.axis,
      // 일부러 규칙과 다른 state를 보낸다 — 서버가 규칙 값으로 덮어쓰는지 확인하기 위해서다.
      state: judgement.state === 'GAP' ? 'MATCH' : 'GAP',
      headline: '말한 기준과 실제 신호가 이 축에서 갈렸어',
      explanation:
        '직접 답한 기준과 관계 경험에서 고른 항목이 같은 방향은 아니었어. 어느 쪽이 맞다기보다 상황에 따라 달랐을 수도 있어.',
      evidenceRefs: [
        { source: 'declared', field: judgement.axis },
        { source: 'relationship', field: 'hardest' },
      ],
      question: '이 부분은 실제로 어떤 상황에서 가장 크게 느꼈어?',
    })),
    core: focusAxis
      ? {
          headline: '말한 기준보다 실제 반응이 컸던 축이 있어',
          summary:
            '네가 직접 답한 기준과, 관계 경험에서 가장 힘들었다고 고른 순간이 같은 축을 가리키지 않았어. 이건 판정이 아니라 관찰이야.',
          evidenceRefs: [
            { source: 'relationship', field: 'hardest' },
            { source: 'declared', field: focusAxis },
            ...observedRef,
          ],
          limitations: ['기록이 아직 적어서 반복되는 경향인지는 알 수 없어'],
        }
      : null,
  };
}

function compatibilityResponse(payload: Record<string, unknown>): unknown {
  const allowed = Array.isArray(payload.allowed)
    ? (payload.allowed as { key: string; kind: string }[])
    : [];

  return {
    narratives: allowed.map((item) => ({
      dimensionKey: item.key,
      // kind도 일부러 뒤집어 보낸다 — 규칙 값이 이기는지 확인한다.
      kind: item.kind === 'good' ? 'friction' : 'good',
      explanation:
        '이 축에서 두 사람의 입력이 서로 다른 구간에 있어. 애정의 크기 차이가 아니라 기준의 차이로 볼 수 있어.',
      scenario:
        '같은 상황을 서로 다른 의미로 읽을 수 있어. 한쪽은 충분하다고 느끼는데 다른 쪽은 아쉽다고 느끼는 순간이 생길 수 있어.',
      conversationQuestion: '이 부분은 어떤 방식이 제일 편해?',
      evidenceRefs: [{ source: 'declared', field: item.key }],
    })),
  };
}

function historyResponse(payload: Record<string, unknown>): unknown {
  const allowed = Array.isArray(payload.allowed)
    ? (payload.allowed as { axis: string; state: string }[])
    : [];

  // 규칙 state에 맞는 문장을 만든다 — STABLE 행에 '달라졌어'가 붙으면 QA 결과를 읽을 수 없다.
  const explanationFor: Record<string, string> = {
    SHIFT:
      '이전 기록과 이번 기록에서 이 축의 답이 달라졌어. 기준 자체가 바뀐 걸 수도 있고, 그때 상황이 달랐던 걸 수도 있어.',
    STABLE:
      '이 축은 이전 기록에서도 비슷하게 나타났어. 상황이 바뀌어도 이 기준은 비교적 일관됐던 걸 수도 있어.',
    NEW: '이번 기록에서 처음 판정된 축이야. 이전에는 비교할 근거가 없었어.',
  };

  return {
    narratives: allowed.map((item) => ({
      axis: item.axis,
      // state는 일부러 뒤집어 보낸다 — 규칙 값이 이기는지 확인하기 위해서다.
      state: item.state === 'SHIFT' ? 'STABLE' : 'SHIFT',
      explanation: explanationFor[item.state] ?? explanationFor.SHIFT,
      evidenceRefs: [{ source: 'declared', field: item.axis }],
      uncertainty: '이유는 네가 실제 상황을 떠올려보면 더 잘 알 수 있어',
    })),
  };
}

function deepReportResponse(payload: Record<string, unknown>): unknown {
  const context = (typeof payload.context === 'object' && payload.context !== null
    ? payload.context
    : {}) as {
    insights?: Array<{
      id: string;
      type: string;
      evidence: Array<{ ref: unknown; text: string }>;
    }>;
  };
  const insights = context.insights ?? [];

  return {
    narratives: insights.map((insight) => ({
      insightId: insight.id,
      headline: '따로 보면 안 보이던 게 겹쳐 보여',
      interpretation:
        `${insight.evidence[0]?.text ?? ''} 그리고 ${insight.evidence[1]?.text ?? ''} — 이 둘을 같이 보면 하나만 볼 때와는 다른 신호로 읽혀.`,
      situation: '이 두 신호가 같이 나타나는 순간에 한 번 더 확인해볼 수 있어.',
      conversationQuestion: '이 부분은 실제로 어떻게 느꼈어?',
      // ref를 그대로 복사한다 — mock도 실제 evidenceRefsAreSubsetOf 검증을 통과해야 한다.
      evidenceRefs: insight.evidence.slice(0, 2).map((item) => item.ref),
    })),
  };
}

export function createMockProvider(): AiProvider {
  return {
    model: MOCK_MODEL,
    async generateStructured(input: GenerateStructuredInput): Promise<unknown> {
      const payload = readPayload(input.userPayload);

      switch (input.task) {
        case 'observed-profile':
          return observedResponse(payload);
        case 'relationship-insight':
          return relationshipResponse(payload);
        case 'compatibility-narrative':
          return compatibilityResponse(payload);
        case 'history-insight':
          return historyResponse(payload);
        case 'deep-report-narrative':
          return deepReportResponse(payload);
      }
    },
  };
}
