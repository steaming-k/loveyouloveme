import { OBSERVED_TRAITS } from '@/data/observations';
import { ANALYSIS_VERSION, PROMPT_VERSIONS } from './promptVersions';
import type {
  AiAnalysisMeta,
  AiMode,
  AiObservedTrait,
  EvidenceCoverageLevel,
  ObservedAnalysisState,
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
 * Demo / Fallback 관찰 결과 — **관찰을 만들어내지 않는다** (v1.22 §1 · §2)
 *
 * ⚠️ v1.21까지 이 함수는 `OBSERVED_TRAITS`(ob1~ob4)를 그대로 돌려줬다. 그래서 Provider가
 * 붙지 않은 배포에서 사용자가 **음식 사진만** 올려도 "영화관·상영 시간표가 담긴 사진이
 * 반복적으로 관찰됐어"가 현재 관찰인 것처럼 나왔다. DEMO 배지를 붙였다고 해도, 실제 사진과
 * 무관한 문장을 사용자 관찰로 보여준 것 자체가 제품 신뢰 문제다.
 *
 * 이제는 사진 내용을 읽지 못한 상태에서 **어떤 trait도 만들지 않는다.** 화면은
 * `observedState`(`demo` / `provider_failed`)를 보고 지금 상태를 사실대로 말한다 —
 * 원래 그 문구("실제 사진 내용을 분석하지 않았어. 그래서 관찰 결과도 만들지 않았어.")가
 * 이미 화면에 있었고, 코드만 그 약속을 어기고 있었다.
 *
 * 실제 사진 분석 결과를 보려면 서버에 `AI_MODE=real` + `AI_API_KEY`가 있어야 한다.
 */
export function buildDemoObservedResult(input: {
  photoCount: number;
  inputFingerprint: string;
  mode: Extract<AiMode, 'demo' | 'fallback' | 'legacy-demo'>;
}): ObservedProfileResult {
  const { photoCount, inputFingerprint, mode } = input;

  const limitations =
    mode === 'fallback'
      ? ['사진 분석을 완료하지 못했어. 사진 내용을 읽지 못했으니 관찰도 만들지 않았어.']
      : ['실제 사진 내용을 분석하지 않았어. 그래서 관찰 결과도 만들지 않았어.'];

  return {
    version: ANALYSIS_VERSION,
    traits: [],
    limitations,
    evidenceCoverage: {
      imageCount: photoCount,
      // 이미지를 실제로 읽지 않았으므로 usable은 0이다 — 과장하지 않는다.
      usableImageCount: 0,
      level: 'low',
    },
    // §8 — B(Provider 실패)와 C(Demo)를 같은 상태로 만들지 않는다.
    observedState: mode === 'fallback' ? 'provider_failed' : 'demo',
    meta: buildMeta({
      mode,
      promptVersion: PROMPT_VERSIONS.observed,
      inputFingerprint,
    }),
  };
}

/**
 * **샘플 세션** 전용 관찰 결과 (v1.22)
 *
 * `createSampleAnswers()`만 이 함수를 쓴다. 그 함수의 진입점은 두 곳이다:
 *   1. 데스크톱 `PrototypePanel` '샘플 답변 채우기' — dev 전용(`NODE_ENV=production`에서 미렌더)
 *   2. **S06 `/profile/intro`의 '샘플 답변으로 결과부터 볼게'** — 일반 사용자에게도 보이며,
 *      게이팅이 없다(v1.0부터의 sample tour 기능).
 *
 * ⚠️ 즉 이 고정 문장은 **Production에서도 2번을 통해 도달할 수 있다.** 다만 사용자가 그
 * 버튼을 직접 눌러 '샘플로 보겠다'고 선택한 경우뿐이고, 결과 mode는 `demo`이며 화면에
 * `DEMO AI` 배지와 아래 limitation이 함께 붙는다.
 *
 * **사용자가 자기 사진을 올린 경로에는 절대 섞이지 않는다** — 그 경로는
 * `buildDemoObservedResult`를 타고, 거기서는 아무 관찰도 만들지 않는다. v1.22가 고친
 * 문제(음식 사진에 영화 관찰)는 그 경로였다.
 */
export function buildSampleObservedResult(input: {
  photoCount: number;
  inputFingerprint: string;
}): ObservedProfileResult {
  const traits: AiObservedTrait[] = OBSERVED_TRAITS.map((trait) => ({
    id: trait.id,
    // 샘플 데이터에는 category가 없다 — 표시용으로 lifestyle로 둔다.
    category: 'lifestyle',
    label: trait.text,
    observation: trait.text,
    // 이미지 단위 evidence를 만들어내지 않는다(§84) — 문장형 근거만 유지한다.
    evidence: [],
    evidenceText: trait.evidence,
    confidence: trait.confidence,
  }));

  return {
    version: ANALYSIS_VERSION,
    traits,
    limitations: ['이건 화면 확인용 샘플 세션이야. 실제 사진 내용을 분석한 결과가 아니야.'],
    evidenceCoverage: {
      imageCount: input.photoCount,
      usableImageCount: 0,
      level: 'low',
    },
    observedState: 'demo',
    meta: buildMeta({
      mode: 'demo',
      promptVersion: PROMPT_VERSIONS.observed,
      inputFingerprint: input.inputFingerprint,
    }),
  };
}

/**
 * 빈 결과 — 실패가 아니라 '근거를 못 찾았다'는 정상 상태다(§62).
 *
 * ⚠️ v1.10 — 문구에서 '생활 패턴'을 뺐다(§6). 사진 몇 장으로 생활 패턴을 판정했다고
 * 말하는 순간, 없다는 결론조차 과한 주장이 된다.
 */
export function buildEmptyObservedResult(input: {
  photoCount: number;
  usableImageCount: number;
  inputFingerprint: string;
  mode: AiMode;
  model?: string;
  observedState?: ObservedAnalysisState;
  limitations?: string[];
}): ObservedProfileResult {
  return {
    version: ANALYSIS_VERSION,
    traits: [],
    limitations: input.limitations ?? ['사진은 봤는데, 관찰로 쓸 만한 장면을 찾지 못했어.'],
    evidenceCoverage: {
      imageCount: input.photoCount,
      usableImageCount: input.usableImageCount,
      level: 'low',
    },
    observedState: input.observedState ?? 'no_observation',
    meta: buildMeta({
      mode: input.mode,
      promptVersion: PROMPT_VERSIONS.observed,
      inputFingerprint: input.inputFingerprint,
      model: input.model,
    }),
  };
}
