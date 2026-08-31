import { OBSERVED_TRAITS } from '@/data/observations';
import { PHOTO_MIN_COUNT } from '@/data/samplePhotos';
import { ANALYSIS_VERSION, PROMPT_VERSIONS } from './promptVersions';
import type {
  AiAnalysisMeta,
  AiMode,
  AiObservedTrait,
  EvidenceCoverageLevel,
  ObservedProfileResult,
} from '@/types';

/**
 * Fallback / Demo 결과 (§39 · §40)
 *
 * ⚠️ AI 실패를 실제 AI 결과인 것처럼 조용히 보여주지 않는다. 이 결과의 `meta.mode`는
 * `demo` 또는 `fallback`이고, 화면은 그 값을 보고 사용자에게 상태를 알린다.
 *
 * Demo Mode는 삭제하지 않는다 — API key 없는 로컬 개발·포트폴리오 시연에서 앱이 정상 동작해야 한다.
 */

export function buildMeta(input: {
  mode: AiMode;
  promptVersion: string;
  inputFingerprint: string;
  model?: string;
  generatedAt?: string;
}): AiAnalysisMeta {
  return {
    mode: input.mode,
    analysisVersion: ANALYSIS_VERSION,
    promptVersion: input.promptVersion,
    model: input.model,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    inputFingerprint: input.inputFingerprint,
  };
}

/**
 * Evidence Coverage는 **코드가** 판정한다 — AI가 '충분하다'고 말하게 하지 않는다(§11).
 * 사진 장수가 아니라 실제로 쓸 만한 근거 수를 기준으로 본다.
 */
export function evidenceCoverageLevel(
  usableImageCount: number,
  traitCount: number,
): EvidenceCoverageLevel {
  if (usableImageCount >= 5 && traitCount >= 3) return 'high';
  if (usableImageCount >= 3 && traitCount >= 2) return 'medium';
  return 'low';
}

/**
 * Demo 관찰 결과.
 *
 * 실제 이미지를 분석하지 않는다 — 사진 수만 보고 고정 관찰을 돌려준다. 그래서
 * 이미지 단위 evidence를 **만들어내지 않고**(§84: 임의 evidence 생성 금지),
 * 원래 문장형 근거를 `evidenceText`로 유지한다.
 */
export function buildDemoObservedResult(input: {
  photoCount: number;
  inputFingerprint: string;
  mode: Extract<AiMode, 'demo' | 'fallback' | 'legacy-demo'>;
}): ObservedProfileResult {
  const { photoCount, inputFingerprint, mode } = input;

  const source =
    photoCount < PHOTO_MIN_COUNT
      ? []
      : photoCount >= 5
        ? OBSERVED_TRAITS
        : OBSERVED_TRAITS.filter((trait) => trait.confidence !== 'low');

  const traits: AiObservedTrait[] = source.map((trait) => ({
    id: trait.id,
    // Demo 데이터에는 category가 없었다 — 표시용으로 lifestyle로 둔다.
    category: 'lifestyle',
    label: trait.text,
    observation: trait.text,
    evidence: [],
    evidenceText: trait.evidence,
    confidence: trait.confidence,
  }));

  const limitations =
    mode === 'fallback'
      ? ['실제 사진 분석에 실패해서 규칙 기반 결과로 대체했어. 사진 내용을 읽은 결과가 아니야.']
      : ['이 결과는 규칙 기반 데모야. 실제 사진 내용을 분석하지 않았어.'];

  return {
    version: ANALYSIS_VERSION,
    traits,
    limitations,
    evidenceCoverage: {
      imageCount: photoCount,
      // Demo는 이미지를 실제로 읽지 않았으므로 usable을 0으로 둔다 — 과장하지 않는다.
      usableImageCount: 0,
      level: 'low',
    },
    meta: buildMeta({
      mode,
      promptVersion: PROMPT_VERSIONS.observed,
      inputFingerprint,
    }),
  };
}

/** 빈 결과 — 실패가 아니라 '근거를 못 찾았다'는 정상 상태다(§62) */
export function buildEmptyObservedResult(input: {
  photoCount: number;
  usableImageCount: number;
  inputFingerprint: string;
  mode: AiMode;
  model?: string;
  limitations?: string[];
}): ObservedProfileResult {
  return {
    version: ANALYSIS_VERSION,
    traits: [],
    limitations: input.limitations ?? [
      '사진은 봤는데, 생활 패턴이라고 부를 만큼 반복되는 신호는 아직 못 찾았어.',
    ],
    evidenceCoverage: {
      imageCount: input.photoCount,
      usableImageCount: input.usableImageCount,
      level: 'low',
    },
    meta: buildMeta({
      mode: input.mode,
      promptVersion: PROMPT_VERSIONS.observed,
      inputFingerprint: input.inputFingerprint,
      model: input.model,
    }),
  };
}
