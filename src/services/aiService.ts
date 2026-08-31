import { buildCompatibility, buildConversationQuestions } from '@/lib/logic/compatibility';
import { buildMbtiLens, buildMbtiQuestions } from '@/lib/logic/mbtiLens';
import { buildObservedTraits } from '@/lib/logic/observed';
import { buildMirrorReport } from '@/lib/logic/mirror';
import { buildHomeHighlights, buildRelationshipProfile } from '@/lib/logic/profile';
import type {
  CompatibilityResult,
  ConversationQuestion,
  DeclaredPreference,
  MbtiLensReport,
  MbtiType,
  MirrorReport,
  ObservationFeedback,
  ObservedTrait,
  PhotoAsset,
  RelationshipExperience,
  RelationshipProfile,
  TargetProfile,
} from '@/types';

/**
 * Mock AI Layer
 *
 * UI는 mock 데이터를 직접 import하지 않고 이 서비스만 호출한다.
 * 실제 AI 백엔드가 준비되면 이 파일의 구현만 fetch 호출로 바꾸면 되고,
 * 화면 코드는 손대지 않아도 된다.
 *
 * 현재는 deterministic — 같은 입력이면 항상 같은 결과가 나온다.
 * (랜덤한 AI 결과는 신뢰를 깨뜨리므로 쓰지 않는다.)
 */

/** 실제 API 호출처럼 보이게 하는 최소 지연. 로딩 화면의 러비 시퀀스와 함께 쓰인다. */
const LATENCY_MS = 240;

function withLatency<T>(value: T, ms = LATENCY_MS): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms);
  });
}

/**
 * 사진 기반 관찰 초안.
 *
 * Demo Mode에서는 이미지 픽셀을 분석하지 않는다. 선택한 장수에 따라
 * 관찰 개수와 확신도만 달라지는 고정 mock observation을 돌려준다.
 */
export async function analyzeObservedProfile(photos: PhotoAsset[]): Promise<ObservedTrait[]> {
  return withLatency(buildObservedTraits(photos));
}

export async function generateRelationshipProfile(input: {
  observations: Record<string, ObservationFeedback>;
  declared: DeclaredPreference;
  experience: RelationshipExperience;
}): Promise<RelationshipProfile> {
  return withLatency(
    buildRelationshipProfile(input.observations, input.declared, input.experience),
  );
}

/** ⚠️ MBTI를 인자로 받지 않는다 — 동기화율은 관계 행동 신호만으로 계산한다. */
export async function calculateCompatibility(input: {
  declared: DeclaredPreference;
  target: TargetProfile;
}): Promise<CompatibilityResult> {
  return withLatency(buildCompatibility(input.declared, input.target));
}

export async function generateConversationQuestions(
  result: CompatibilityResult,
): Promise<ConversationQuestion[]> {
  return withLatency(buildConversationQuestions(result));
}

/** Supporting Lens — 두 MBTI가 모두 있을 때만 결과가 있다(없으면 null). */
export async function generateMbtiLens(input: {
  mbti: MbtiType | null;
  targetMbti: MbtiType | null;
}): Promise<MbtiLensReport | null> {
  return withLatency(buildMbtiLens(input.mbti, input.targetMbti));
}

export async function generateMirrorInsights(input: {
  declared: DeclaredPreference;
  experience: RelationshipExperience;
}): Promise<MirrorReport> {
  return withLatency(buildMirrorReport(input.declared, input.experience));
}

export async function generateHomeHighlights(input: {
  declared: DeclaredPreference;
  experience: RelationshipExperience;
}): Promise<{ key: string; value: string }[]> {
  return withLatency(buildHomeHighlights(input.declared, input.experience));
}

/* -------------------------------------------------------------------------- */
/* 동기 셀렉터                                                                 */
/* 이미 로컬에 답변이 있는 화면(결과 재방문 등)에서는 로딩을 다시 보여주지 않고    */
/* 같은 로직을 동기적으로 재사용한다. 계산식은 한 곳(lib/logic)에만 존재한다.     */
/* -------------------------------------------------------------------------- */

export const aiSelectors = {
  observedTraits: buildObservedTraits,
  compatibility: buildCompatibility,
  conversationQuestions: buildConversationQuestions,
  mbtiLens: buildMbtiLens,
  mbtiQuestions: buildMbtiQuestions,
  mirror: buildMirrorReport,
  profile: buildRelationshipProfile,
  homeHighlights: buildHomeHighlights,
};
