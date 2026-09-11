'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { MAX_PAST_FACTORS } from '@/data/labels';
import { PHOTO_MAX_COUNT } from '@/data/samplePhotos';
import {
  RELATIONSHIP_EVENT_DESCRIPTION_MAX_LENGTH,
  RELATIONSHIP_EVENT_MAX,
  RELATIONSHIP_EVENT_REACTION_MAX_LENGTH,
} from '@/data/relationshipEvents';
import { TARGET_INTEREST_MAX, TARGET_CUSTOM_INTEREST_MAX_LENGTH } from '@/data/targetPreferences';
import { clearSessionDedup, trackEvent } from '@/lib/analytics';
import { createEmptyBirthProfile } from '@/lib/logic/birth';
import { sameAnalysisFingerprint } from '@/lib/aiMeta';
import { sanitizeRelationshipEvents } from '@/lib/logic/relationshipEvents';
import { clearPreviewUnlocks } from '@/lib/premiumAccess';
import {
  sanitizeAffection,
  sanitizeConflict,
  sanitizeCurrentSignals,
  sanitizeHardest,
  sanitizeHobby,
  sanitizePastFactors,
  sanitizeScale,
  sanitizeSelfGap,
  sanitizeStatus,
  sanitizeTargetLevels,
  sanitizeTargetRelation,
} from '@/lib/sessionSanitize';
import { clearPremiumIntents } from '@/lib/premiumIntentStore';
import { buildDemoObservedResult } from '@/services/ai/fallback';
import type {
  ObservedProfileResult,
  BirthProfile,
  ConversationQuestionId,
  CurrentSignalAnswer,
  DeclaredPreference,
  DeepAnalysisAnswer,
  HardestMoment,
  MbtiType,
  MirrorAxisKey,
  PastFactor,
  PhotoAsset,
  RelationshipEvent,
  RelationshipEventType,
  RelationshipStatus,
  SelfGapAnswer,
  SessionAnswers,
  TargetAxisKey,
  TargetInterest,
  TargetInterestCategory,
  TargetLevel,
  TargetRelation,
  Verdict,
  ZodiacSign,
} from '@/types';
import { createEmptyAnswers, createEmptyTargetProfile, createSampleAnswers } from './defaultAnswers';

const STORAGE_KEY = 'lym.session.v1';

type CompletionKey = keyof SessionAnswers['completed'];

/** Birth Profile의 주체 — 나 / 내가 알고 있는 상대 */
export type BirthSubject = 'self' | 'target';

interface SessionContextValue {
  answers: SessionAnswers;
  /** localStorage 복원이 끝났는지. 라우트 가드는 이 값이 true가 된 뒤에만 판단한다. */
  hydrated: boolean;

  setStatus: (status: RelationshipStatus) => void;

  addUploadedPhotos: (photos: PhotoAsset[]) => void;
  removePhoto: (id: string) => void;
  clearPhotos: () => void;

  /**
   * 사진 AI 분석 결과 저장 (v1.6).
   * 실제 AI 결과는 재계산할 수 없으므로 세션에 보관한다.
   */
  setObservedAnalysis: (result: ObservedProfileResult | null) => void;

  setObservationVerdict: (id: string, verdict: Verdict) => void;
  correctObservation: (id: string, text: string) => void;
  toggleObservationExcluded: (id: string) => void;

  setDeclared: <K extends keyof DeclaredPreference>(
    field: K,
    value: DeclaredPreference[K],
  ) => void;

  togglePastFactor: (factor: PastFactor) => boolean;
  setHardest: (value: HardestMoment) => void;
  setSelfGap: (value: SelfGapAnswer) => void;
  setPastNote: (value: string) => void;
  setAdaptiveAnswer: (axis: MirrorAxisKey, optionId: string) => void;
  /** v1.41 — 지금 관계 근거 (S30 · Optional) */
  setCurrentSignal: (axis: MirrorAxisKey, value: CurrentSignalAnswer) => void;
  clearCurrentSignal: (axis: MirrorAxisKey) => void;
  markCurrentEvidenceAsked: () => void;
  skipExperience: () => void;
  resumeExperience: () => void;

  setTargetRelation: (value: TargetRelation) => void;
  setTargetLevel: (key: TargetAxisKey, value: TargetLevel) => void;
  setTargetMbti: (value: MbtiType | null) => void;
  /** v1.13 — '좋아하는 것' 미리 정의 카테고리 토글. 최대 개수 초과 시 false */
  toggleTargetInterest: (category: Exclude<TargetInterestCategory, 'custom'>, label: string) => boolean;
  /** v1.13 — 직접 입력. 빈 문자열이거나 최대 개수 초과 시 false */
  addCustomTargetInterest: (text: string) => boolean;
  removeTargetInterest: (id: string) => void;

  /**
   * v1.46 §8 — 관계 사건 추가. 본문이 비었거나 최대 개수(3)를 넘으면 false.
   *
   * ⚠️ 상대에 종속된 값이라 `resetTargetContext()`가 함께 비운다(§14).
   */
  addRelationshipEvent: (
    type: RelationshipEventType,
    description: string,
    myReaction?: string,
  ) => boolean;
  /** v1.46 §14 — 이미 적은 사건 수정. 본문이 비면 아무 일도 하지 않는다(삭제는 별도) */
  updateRelationshipEvent: (
    id: string,
    patch: { type?: RelationshipEventType; description?: string; myReaction?: string },
  ) => void;
  removeRelationshipEvent: (id: string) => void;

  toggleSavedQuestion: (id: ConversationQuestionId) => boolean;

  setCoreVerdict: (verdict: Verdict) => void;
  setCoreCorrection: (text: string) => void;

  setMbti: (value: MbtiType | null) => void;

  /** Entertainment Lens 공용 출생정보. subject로 나/상대를 구분한다 */
  setBirthProfile: (subject: BirthSubject, patch: Partial<BirthProfile>) => void;
  /** 개별 Lens 정보 초기화 (§33) */
  clearBirthProfile: (subject: BirthSubject) => void;

  setShareOption: (key: keyof SessionAnswers['share'], value: boolean) => void;

  /** v1.9 — Premium Adaptive Deep Question 답변 추가. 같은 questionId면 교체(재답변) */
  addDeepAnswer: (answer: DeepAnalysisAnswer) => void;
  /** v1.9 — Deep Insight 카드 확인/수정(§33). '조금 달라요'는 correctedText와 함께 온다 */
  setDeepInsightFeedback: (insightId: string, verdict: Verdict, correctedText?: string) => void;

  markComplete: (key: CompletionKey) => void;
  /** v1.11 — Home '최근 궁합'/'최근 Mirror' 카드에 보여줄 타임스탬프만 갱신한다(§42) */
  markResultViewed: (kind: 'compatibility' | 'mirror') => void;
  /**
   * v1.11.1 — '새로운 사람과 궁합 보기'의 Source of Truth(§5/§6).
   *
   * SELF(사진·관찰·Declared·Relationship 경험·내 MBTI·내 출생정보)와 History는 전부
   * 유지하고, **상대(Target)에 종속된 데이터만** 초기화한다. Mirror는 Target을 계산에
   * 쓰지 않으므로(Declared vs Relationship) `completed.mirror`는 건드리지 않는다 —
   * 이미 본 Mirror 결과는 새 상대와 무관하게 여전히 유효하다.
   */
  resetTargetContext: () => void;
  loadSampleSession: () => void;
  reset: () => void;
  /** 사용자가 명시적으로 요청한 전체 삭제. reset()과 동작은 같지만 analytics 이벤트가 다르다. */
  deleteAllData: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/** 저장 시 blob object URL은 제외한다 (새로고침 후 무효한 URL이 되므로) */
function serialize(answers: SessionAnswers): string {
  const photos = answers.photos.map((photo) => ({
    id: photo.id,
    label: photo.label,
    source: photo.source,
    tone: photo.tone,
  }));
  return JSON.stringify({ ...answers, photos });
}

function deserialize(raw: string): SessionAnswers | null {
  try {
    const parsed = JSON.parse(raw) as Partial<SessionAnswers>;
    const base = createEmptyAnswers();

    // 업로드한 사진의 objectUrl은 애초에 저장하지 않는다(serialize 참고). 새로고침 후에는
    // 다시 보여줄 방법이 없으므로, 존재하지 않는 사진을 유효한 것처럼 개수에 넣지 않기 위해
    // 업로드 출처 사진은 복원 시점에 세션에서 제거한다 — 샘플 사진은 tone만으로 다시 그릴 수
    // 있으니 그대로 유지한다.
    const restoredPhotos = Array.isArray(parsed.photos) ? parsed.photos : [];
    const photos = restoredPhotos.filter((photo) => photo.source !== 'upload');

    // v1.3 이전 세션에는 `zodiac`(직접 고른 별자리)만 있고 birthProfile이 없다.
    // 그 값으로 생년월일을 임의로 만들어내지 않는다 — legacyZodiac으로 옮겨 표시만 하고,
    // 새 Birth Profile은 비어 있는 상태로 두어 사용자가 직접 입력하게 안내한다(§42).
    const legacy = parsed as Partial<SessionAnswers> & { zodiac?: ZodiacSign | null };
    const legacyZodiac = parsed.legacyZodiac ?? legacy.zodiac ?? null;

    /**
     * v1.6 Migration (§84) — v1.5 이전 세션에는 `observedAnalysis`가 없다.
     *
     * 그 시절 관찰은 사진 개수만 보고 매 렌더 재계산하던 데모 결과였고, 이미지 단위 evidence가
     * 애초에 존재하지 않았다. **없던 evidence를 만들어내지 않는다** — 사용자가 이미 확인·수정한
     * 피드백(observations)은 그대로 살리되, 분석 결과는 `legacy-demo`로 재구성한다.
     */
    const observedAnalysis =
      parsed.observedAnalysis ??
      (photos.length > 0
        ? buildDemoObservedResult({
            photoCount: photos.length,
            inputFingerprint: 'legacy',
            mode: 'legacy-demo',
          })
        : null);

    return {
      ...base,
      ...parsed,
      observedAnalysis,
      /**
       * v1.44 BUG-002 — **값까지 검사한다.** 예전에는 `...parsed.declared`로 그대로
       * 펼쳐서 `contact:'abc'`·`conflict:99` 같은 값이 판정 경로로 흘렀다. 유효하지
       * 않으면 추정하지 않고 **미입력(null)으로 강등**한다(`@/lib/sessionSanitize`).
       */
      status: sanitizeStatus(parsed.status),
      declared: {
        contact: sanitizeScale(parsed.declared?.contact),
        conflict: sanitizeConflict(parsed.declared?.conflict),
        alone: sanitizeScale(parsed.declared?.alone),
        affection: sanitizeAffection(parsed.declared?.affection),
        hobby: sanitizeHobby(parsed.declared?.hobby),
      },
      experience: {
        ...base.experience,
        ...parsed.experience,
        // `'notanarray'`가 들어오면 `.length`가 문자열 길이로 읽혀 '관계 경험 11'이 된다
        important: sanitizePastFactors(parsed.experience?.important),
        hardest: sanitizeHardest(parsed.experience?.hardest),
        selfGap: sanitizeSelfGap(parsed.experience?.selfGap),
        note: typeof parsed.experience?.note === 'string' ? parsed.experience.note : '',
        skipped: parsed.experience?.skipped === true,
      },
      /**
       * v1.41 Migration (§39.14) — v1.40 이전 세션에는 이 필드가 없다.
       *
       * ⚠️ **소급 추정하지 않는다.** 그 세션의 사용자가 `dating`이었더라도 현재 관계
       * 근거를 답한 적은 없으므로, 비어 있는 상태로 복원하고 Mirror는 과거 근거로
       * 판정한다 — v1.40.1과 글자 하나 다르지 않다(fixture E0).
       *
       * ⚠️ v1.44 BUG-002 — 예전 주석은 "알 수 없는 키가 들어와도 `MIRROR_AXES`만
       * 조회하므로 조용히 무시된다"고 적었는데 그건 **축**에만 해당했다. 값이
       * `'BOGUS'`면 축은 조회되고 답만 이상한 상태가 된다. 이제 축과 답을 모두 검사한다.
       */
      currentRelationship: {
        signals: sanitizeCurrentSignals(parsed.currentRelationship?.signals),
        askedAt:
          typeof parsed.currentRelationship?.askedAt === 'string'
            ? parsed.currentRelationship.askedAt
            : null,
      },
      target: {
        ...base.target,
        ...parsed.target,
        // v1.44 BUG-002 — relation은 enum, 4축은 `'x'`(모름)로 강등한다
        relation: sanitizeTargetRelation(parsed.target?.relation),
        ...sanitizeTargetLevels(parsed.target as Record<string, unknown> | undefined),
        birthProfile: { ...base.target.birthProfile, ...parsed.target?.birthProfile },
        // v1.13 이전 세션에는 preferences가 없다 — 빈 값으로 안전 복원한다(§57).
        preferences: {
          interests: Array.isArray(parsed.target?.preferences?.interests)
            ? parsed.target.preferences.interests
            : [],
        },
        /**
         * v1.46 §14 — v1.45 이전 세션에는 `events`가 없다. 빈 배열로 복원하고
         * **소급 추정하지 않는다**(v1.41 `currentRelationship` 복원과 같은 규칙).
         *
         * ⚠️ 모양만 보지 않고 값도 본다 — 종류가 유효하지 않거나 본문이 빈 항목은
         * 목록에서 빠진다(v1.44 BUG-002).
         */
        events: sanitizeRelationshipEvents(parsed.target?.events),
      },
      birthProfile: { ...base.birthProfile, ...parsed.birthProfile },
      legacyZodiac,
      share: { ...base.share, ...parsed.share },
      completed: { ...base.completed, ...parsed.completed },
      photos,
      observations: parsed.observations ?? {},
      savedQuestions: Array.isArray(parsed.savedQuestions) ? parsed.savedQuestions : [],
      // v1.9 이전 세션에는 없던 필드 — 빈 값으로 마이그레이션한다.
      deepAnswers: Array.isArray(parsed.deepAnswers) ? parsed.deepAnswers : [],
      deepInsightFeedback: parsed.deepInsightFeedback ?? {},
      // v1.11 이전 세션에는 없다 — 없는 걸 있다고 만들지 않고 그대로 undefined로 둔다.
      currentAnalysisMeta: parsed.currentAnalysisMeta,
    };
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [answers, setAnswers] = useState<SessionAnswers>(createEmptyAnswers);
  const [hydrated, setHydrated] = useState(false);
  /** 해제해야 할 object URL 목록 */
  const objectUrls = useRef<string[]>([]);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const restored = deserialize(raw);
      if (restored) setAnswers(restored);
    }
    setHydrated(true);
  }, []);

  /**
   * v1.12 §20 — 모든 세션은 언젠가 `funnelAnalysisId`를 가져야 한다. 새 상대는
   * `resetTargetContext()`가 즉시 새로 발급하지만, 이 값이 아직 없는 세션(첫 분석 · v1.12
   * 이전 세션)은 hydration 이후에 한 번 채워 넣는다 — SSR과 값이 달라지면 안 되므로
   * useState 초기값이 아니라 반드시 이 effect(클라이언트 전용)에서만 생성한다.
   */
  useEffect(() => {
    if (!hydrated) return;
    setAnswers((prev) => {
      if (prev.currentAnalysisMeta?.funnelAnalysisId) return prev;
      return {
        ...prev,
        currentAnalysisMeta: {
          ...prev.currentAnalysisMeta,
          funnelAnalysisId: crypto.randomUUID(),
          updatedAt: prev.currentAnalysisMeta?.updatedAt ?? new Date().toISOString(),
        },
      };
    });
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, serialize(answers));
    } catch {
      // 저장 실패가 흐름을 막지 않는다.
    }
  }, [answers, hydrated]);

  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const setStatus = useCallback((status: RelationshipStatus) => {
    setAnswers((prev) => ({ ...prev, status }));
  }, []);

  /**
   * ⚠️ **상한은 업로드 사진만 센다.**
   *
   * 예전에는 `photos` 전체를 `PHOTO_MAX_COUNT`로 잘랐다. S07에서 샘플 타일을 직접 고를 수
   * 있던 동안에는 그게 맞았지만, 지금 세션에 남아 있을 수 있는 비-upload 사진은 두 경로뿐이고
   * 둘 다 **사용자가 S07에서 고른 것이 아니다**: ① `loadSampleSession()`의 데모 세션,
   * ② 이 변경 이전에 샘플 타일을 골라둔 채 저장된 localStorage 세션(`deserialize()`가
   * 비-upload 사진을 그대로 복원한다).
   *
   * 전체 길이로 자르면 그 사진들이 **보이지도 않는 채 업로드 칸을 잡아먹는다** — 화면에는
   * 0장인데 6장까지만 올라가는 상태가 된다. 상한의 단위를 실제 분석 대상(`usablePhotoCount`)과
   * 맞춘다.
   */
  const addUploadedPhotos = useCallback((photos: PhotoAsset[]) => {
    photos.forEach((photo) => {
      if (photo.objectUrl) objectUrls.current.push(photo.objectUrl);
    });
    setAnswers((prev) => {
      const others = prev.photos.filter((photo) => photo.source !== 'upload');
      const uploads = [
        ...prev.photos.filter((photo) => photo.source === 'upload'),
        ...photos,
      ].slice(0, PHOTO_MAX_COUNT);
      return { ...prev, photos: [...others, ...uploads] };
    });
  }, []);

  const removePhoto = useCallback((id: string) => {
    setAnswers((prev) => {
      const target = prev.photos.find((photo) => photo.id === id);
      if (target?.objectUrl) {
        URL.revokeObjectURL(target.objectUrl);
        objectUrls.current = objectUrls.current.filter((url) => url !== target.objectUrl);
      }
      return { ...prev, photos: prev.photos.filter((photo) => photo.id !== id) };
    });
  }, []);

  const clearPhotos = useCallback(() => {
    setAnswers((prev) => {
      prev.photos.forEach((photo) => {
        if (photo.objectUrl) URL.revokeObjectURL(photo.objectUrl);
      });
      objectUrls.current = [];
      return { ...prev, photos: [] };
    });
  }, []);

  const setObservedAnalysis = useCallback((result: ObservedProfileResult | null) => {
    setAnswers((prev) => {
      /**
       * 분석이 바뀌면 이전 관찰에 대한 피드백은 의미가 없다 — trait id가 달라지기 때문이다.
       *
       * ⚠️ v1.44 BUG-003 — `?.meta.inputFingerprint`는 `observedAnalysis`만 방어하고
       * `meta`는 방어하지 않았다. 이 객체는 **세션 스토리지에서도 복원된다**(손상된
       * 세션이면 `meta`가 없을 수 있다). 둘 다 없으면 `undefined === undefined`가
       * true가 되어 '같은 분석'으로 오판하므로, 지문을 못 읽으면 **다른 분석으로
       * 취급**해 피드백을 비운다 — 남은 피드백을 새 trait에 잘못 붙이는 것보다 낫다.
       */
      const sameFingerprint = sameAnalysisFingerprint(prev.observedAnalysis, result);
      return {
        ...prev,
        observedAnalysis: result,
        observations: sameFingerprint ? prev.observations : {},
      };
    });
  }, []);

  const setObservationVerdict = useCallback((id: string, verdict: Verdict) => {
    setAnswers((prev) => ({
      ...prev,
      observations: {
        ...prev.observations,
        [id]: { ...prev.observations[id], verdict },
      },
    }));
  }, []);

  const correctObservation = useCallback((id: string, text: string) => {
    setAnswers((prev) => ({
      ...prev,
      observations: {
        ...prev.observations,
        [id]: { ...prev.observations[id], verdict: 'no', correctedText: text },
      },
    }));
  }, []);

  const toggleObservationExcluded = useCallback((id: string) => {
    setAnswers((prev) => {
      const current = prev.observations[id];
      const excluded = !current?.excluded;
      return {
        ...prev,
        observations: {
          ...prev.observations,
          [id]: { verdict: current?.verdict ?? null, correctedText: current?.correctedText, excluded },
        },
      };
    });
  }, []);

  const setDeclared = useCallback(
    <K extends keyof DeclaredPreference>(field: K, value: DeclaredPreference[K]) => {
      setAnswers((prev) => ({ ...prev, declared: { ...prev.declared, [field]: value } }));
    },
    [],
  );

  /** @returns 선택이 반영됐는지 (최대 개수 초과 시 false) */
  const togglePastFactor = useCallback((factor: PastFactor) => {
    let accepted = true;
    setAnswers((prev) => {
      const list = prev.experience.important;
      if (list.includes(factor)) {
        return {
          ...prev,
          experience: { ...prev.experience, important: list.filter((item) => item !== factor) },
        };
      }
      if (list.length >= MAX_PAST_FACTORS) {
        accepted = false;
        return prev;
      }
      return { ...prev, experience: { ...prev.experience, important: [...list, factor] } };
    });
    return accepted;
  }, []);

  const setHardest = useCallback((value: HardestMoment) => {
    setAnswers((prev) => ({ ...prev, experience: { ...prev.experience, hardest: value } }));
  }, []);

  const setSelfGap = useCallback((value: SelfGapAnswer) => {
    setAnswers((prev) => ({ ...prev, experience: { ...prev.experience, selfGap: value } }));
  }, []);

  const setPastNote = useCallback((value: string) => {
    setAnswers((prev) => ({ ...prev, experience: { ...prev.experience, note: value } }));
  }, []);

  const setAdaptiveAnswer = useCallback((axis: MirrorAxisKey, optionId: string) => {
    setAnswers((prev) => ({
      ...prev,
      experience: { ...prev.experience, adaptive: { axis, optionId } },
    }));
    trackEvent('relationship_adaptive_answer', { axis, option: optionId });
  }, []);

  /**
   * v1.41 §39.4 — 지금 관계 근거 하나를 기록한다 (S30).
   *
   * ⚠️ `experience`를 건드리지 않는다. 두 source는 나란히 존재하고, 현재 답변이
   * 과거 답변을 덮으면 Premium의 `Current × Past` 연결이 애초에 만들어질 수 없다.
   *
   * ⚠️ **Analytics 이벤트를 발생시키지 않는다**(§39.21). 새 이벤트 0건이 이 버전의
   * 약속이고, 축별 답변은 그 자체로 관계에 대한 서술이라 외부로 보내지 않는다.
   * 관찰이 필요한 지표(현재 근거를 가진 사용자가 결과를 보는가)는 기존
   * `compatibility_result_view`에 붙은 저카디널리티 `evidence_scope` 하나로 본다.
   */
  const setCurrentSignal = useCallback((axis: MirrorAxisKey, value: CurrentSignalAnswer) => {
    setAnswers((prev) => ({
      ...prev,
      currentRelationship: {
        signals: { ...prev.currentRelationship.signals, [axis]: value },
        askedAt: prev.currentRelationship.askedAt ?? new Date().toISOString(),
      },
    }));
  }, []);

  /**
   * 사용자가 이 축의 답을 **되돌린다**(선택 해제). 축 하나를 지우면 Mirror는 그 축만
   * 과거 근거로 되돌아간다 — 전체를 초기화하지 않는다.
   */
  const clearCurrentSignal = useCallback((axis: MirrorAxisKey) => {
    setAnswers((prev) => {
      const next = { ...prev.currentRelationship.signals };
      delete next[axis];
      return {
        ...prev,
        currentRelationship: { ...prev.currentRelationship, signals: next },
      };
    });
  }, []);

  /** S30을 열었다는 사실만 기록한다 — 답하지 않고 나가도 같은 권유를 반복하지 않는다 */
  const markCurrentEvidenceAsked = useCallback(() => {
    setAnswers((prev) =>
      prev.currentRelationship.askedAt
        ? prev
        : {
            ...prev,
            currentRelationship: {
              ...prev.currentRelationship,
              askedAt: new Date().toISOString(),
            },
          },
    );
  }, []);

  const skipExperience = useCallback(() => {
    setAnswers((prev) => ({
      ...prev,
      experience: {
        important: [],
        hardest: null,
        selfGap: null,
        note: '',
        skipped: true,
        adaptive: null,
      },
    }));
    trackEvent('relationship_experience_skip');
  }, []);

  const resumeExperience = useCallback(() => {
    setAnswers((prev) => ({ ...prev, experience: { ...prev.experience, skipped: false } }));
  }, []);

  const setTargetRelation = useCallback((value: TargetRelation) => {
    setAnswers((prev) => ({ ...prev, target: { ...prev.target, relation: value } }));
  }, []);

  const setTargetLevel = useCallback((key: TargetAxisKey, value: TargetLevel) => {
    setAnswers((prev) => ({ ...prev, target: { ...prev.target, [key]: value } }));
  }, []);

  const setTargetMbti = useCallback((value: MbtiType | null) => {
    setAnswers((prev) => ({ ...prev, target: { ...prev.target, mbti: value } }));
    // v1.24 P3-1 Audit — 유형 원문 대신 '설정했는가'만 남긴다(§35 Analytics Privacy).
    trackEvent('target_mbti_select', { selected: value !== null });
  }, []);

  /**
   * v1.13 §5~§9 — 미리 정의된 카테고리 토글(다시 누르면 해제). 최대 개수를 넘으면
   * 아무 일도 하지 않는다 — validation 조건에 넣지 않고 조용히 무시한다(§9).
   * @returns 실제로 추가/해제됐는지
   */
  const toggleTargetInterest = useCallback(
    (category: Exclude<TargetInterestCategory, 'custom'>, label: string) => {
      let changed = true;
      setAnswers((prev) => {
        const interests = prev.target.preferences.interests;
        const exists = interests.some((item) => item.category === category);
        if (exists) {
          return {
            ...prev,
            target: {
              ...prev.target,
              preferences: { interests: interests.filter((item) => item.category !== category) },
            },
          };
        }
        if (interests.length >= TARGET_INTEREST_MAX) {
          changed = false;
          return prev;
        }
        const interest: TargetInterest = { id: category, category, label };
        return {
          ...prev,
          target: { ...prev.target, preferences: { interests: [...interests, interest] } },
        };
      });
      if (changed) trackEvent('target_preference_add', { source: 'predefined' });
      return changed;
    },
    [],
  );

  /** v1.13 §6 — 직접 입력. 길이 제한만 두고 Analytics에는 raw text를 보내지 않는다(§40) */
  const addCustomTargetInterest = useCallback((text: string) => {
    const trimmed = text.trim().slice(0, TARGET_CUSTOM_INTEREST_MAX_LENGTH);
    if (!trimmed) return false;
    let added = true;
    setAnswers((prev) => {
      if (prev.target.preferences.interests.length >= TARGET_INTEREST_MAX) {
        added = false;
        return prev;
      }
      const interest: TargetInterest = {
        id: `custom-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`,
        category: 'custom',
        label: trimmed,
      };
      return {
        ...prev,
        target: {
          ...prev.target,
          preferences: { interests: [...prev.target.preferences.interests, interest] },
        },
      };
    });
    if (added) trackEvent('target_preference_add', { source: 'custom' });
    return added;
  }, []);

  const removeTargetInterest = useCallback((id: string) => {
    setAnswers((prev) => ({
      ...prev,
      target: {
        ...prev.target,
        preferences: { interests: prev.target.preferences.interests.filter((item) => item.id !== id) },
      },
    }));
  }, []);

  /* ───────────────────────── v1.46 관계 사건 (User-reported Relationship Event) */

  /**
   * §8 — 사건 추가. 최대 개수를 넘으면 **조용히 무시한다**(false만 돌려준다) —
   * validation 조건으로 흐름을 막지 않는다. `preferences`(v1.13 §9)와 같은 규칙이다.
   *
   * ⚠️ Analytics에는 **종류와 개수만** 보낸다. `description`·`myReaction`은 사용자가
   * 직접 쓴 문장이므로 외부로 나가지 않는다(§40 · `lib/logic/relationshipEvents.ts` 참고).
   */
  const addRelationshipEvent = useCallback(
    (type: RelationshipEventType, description: string, myReaction?: string) => {
      const trimmed = description.trim().slice(0, RELATIONSHIP_EVENT_DESCRIPTION_MAX_LENGTH);
      if (!trimmed) return false;
      const reaction = (myReaction ?? '').trim().slice(0, RELATIONSHIP_EVENT_REACTION_MAX_LENGTH);

      let added = true;
      let nextCount = 0;
      setAnswers((prev) => {
        if (prev.target.events.length >= RELATIONSHIP_EVENT_MAX) {
          added = false;
          return prev;
        }
        const event: RelationshipEvent = {
          id: `evt-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`,
          type,
          description: trimmed,
          ...(reaction ? { myReaction: reaction } : {}),
        };
        const events = [...prev.target.events, event];
        nextCount = events.length;
        return { ...prev, target: { ...prev.target, events } };
      });

      if (added) {
        trackEvent('target_event_add', {
          event_type: type,
          has_reaction: reaction.length > 0,
          event_count: nextCount,
        });
      }
      return added;
    },
    [],
  );

  /** §14 — 수정. 본문을 비우는 것은 삭제가 아니므로 **무시한다**(삭제는 명시적 버튼) */
  const updateRelationshipEvent = useCallback(
    (
      id: string,
      patch: { type?: RelationshipEventType; description?: string; myReaction?: string },
    ) => {
      setAnswers((prev) => {
        const index = prev.target.events.findIndex((item) => item.id === id);
        if (index < 0) return prev;
        const current = prev.target.events[index]!;

        const description =
          patch.description === undefined
            ? current.description
            : patch.description.trim().slice(0, RELATIONSHIP_EVENT_DESCRIPTION_MAX_LENGTH);
        if (!description) return prev;

        const reaction =
          patch.myReaction === undefined
            ? current.myReaction
            : patch.myReaction.trim().slice(0, RELATIONSHIP_EVENT_REACTION_MAX_LENGTH) || undefined;

        const next: RelationshipEvent = {
          id: current.id,
          type: patch.type ?? current.type,
          description,
          ...(reaction ? { myReaction: reaction } : {}),
        };
        const events = [...prev.target.events];
        events[index] = next;
        return { ...prev, target: { ...prev.target, events } };
      });
    },
    [],
  );

  const removeRelationshipEvent = useCallback((id: string) => {
    setAnswers((prev) => ({
      ...prev,
      target: { ...prev.target, events: prev.target.events.filter((item) => item.id !== id) },
    }));
    trackEvent('target_event_remove');
  }, []);

  /** @returns 저장된 상태인지 (true = 방금 저장, false = 저장 해제) */
  const toggleSavedQuestion = useCallback((id: ConversationQuestionId) => {
    let saved = true;
    setAnswers((prev) => {
      if (prev.savedQuestions.includes(id)) {
        saved = false;
        return { ...prev, savedQuestions: prev.savedQuestions.filter((item) => item !== id) };
      }
      return { ...prev, savedQuestions: [...prev.savedQuestions, id] };
    });
    return saved;
  }, []);

  /**
   * v1.44 BUG-001 — **`ok`는 `coreCorrection`을 함께 비운다.**
   *
   * ══ 무엇이 모순이었나 ═══════════════════════════════════════════════════
   *
   * 화면의 headline은 `coreCorrection`**만** 보고 정해진다
   * (`mirror/page.tsx` — `coreCorrection.trim() || aiHeadline || core.headline`).
   * 그런데 `맞는 것 같아`는 `coreVerdict`만 바꿨다. 그래서 수정을 저장한 뒤 동의를
   * 누르면 이런 상태가 됐다:
   *
   * ```
   * coreVerdict     'ok'          ← 사용자의 최신 명시적 행동
   * coreCorrection  '연락보다…'    ← 그 이전 행동
   * 화면            사용자 수정문 + '네가 고친 문장이야' + AI 요약 숨김
   * ```
   *
   * 두 값이 서로 다른 말을 하고, 화면은 **오래된 쪽**을 따랐다.
   *
   * ══ 왜 setter 안에서 처리하나 ════════════════════════════════════════════
   *
   * 호출부에서 `setCoreCorrection('')` + `setCoreVerdict('ok')`를 연달아 부르는 방법도
   * 있지만, `setCoreCorrection`이 verdict를 `'no'`로 되돌리므로 **호출 순서에 정답이
   * 하나뿐인** 코드가 된다. 순서에 의존하는 두 번의 상태 갱신이 정확히 이 버그를 만든
   * 구조다. 불변식("동의했다면 남아 있는 수정문은 없다")을 Source of Truth 한 곳에
   * 두면 이후 어떤 호출부도 모순을 다시 만들 수 없다.
   *
   * ⚠️ `'no'`·`null`에는 손대지 않는다. `원래 관찰로 되돌리기`(verdict `null` + 수정문
   * 비움)와 `맞는 것 같아`(verdict `'ok'` + 수정문 비움)는 **다른 의미**이고, 그 구분을
   * 합치지 않는다.
   *
   * ⚠️ 이미 저장된 History Snapshot은 건드리지 않는다 — 스냅샷은 저장 시점의 값을 복사해
   * 둔 것이고, 이후 저장분만 `verdict:'ok' / userCorrection:null`로 남는다.
   */
  const setCoreVerdict = useCallback((verdict: Verdict) => {
    setAnswers((prev) =>
      verdict === 'ok'
        ? { ...prev, coreVerdict: 'ok', coreCorrection: '' }
        : { ...prev, coreVerdict: verdict },
    );
  }, []);

  const setCoreCorrection = useCallback((text: string) => {
    setAnswers((prev) => ({ ...prev, coreCorrection: text, coreVerdict: 'no' }));
  }, []);

  const setMbti = useCallback((value: MbtiType | null) => {
    setAnswers((prev) => ({ ...prev, mbti: value }));
    // v1.24 P3-1 Audit — 유형 원문 대신 '설정했는가'만 남긴다(§35 Analytics Privacy).
    trackEvent('self_mbti_select', { selected: value !== null });
  }, []);

  const setBirthProfile = useCallback((subject: BirthSubject, patch: Partial<BirthProfile>) => {
    setAnswers((prev) => {
      const current = subject === 'self' ? prev.birthProfile : prev.target.birthProfile;
      const next = { ...current, ...patch };

      trackEvent('birth_profile_edit', {
        subject,
        has_date: Boolean(next.date),
        has_time: Boolean(next.time),
        time_unknown: next.timeUnknown,
        calendar_type: next.calendarType,
        has_location: Boolean(next.location?.city),
      });

      return subject === 'self'
        ? { ...prev, birthProfile: next }
        : { ...prev, target: { ...prev.target, birthProfile: next } };
    });
  }, []);

  const clearBirthProfile = useCallback((subject: BirthSubject) => {
    setAnswers((prev) =>
      subject === 'self'
        ? { ...prev, birthProfile: createEmptyBirthProfile() }
        : { ...prev, target: { ...prev.target, birthProfile: createEmptyBirthProfile() } },
    );
  }, []);

  const setShareOption = useCallback((key: keyof SessionAnswers['share'], value: boolean) => {
    setAnswers((prev) => ({ ...prev, share: { ...prev.share, [key]: value } }));
  }, []);

  /**
   * v1.9 — 기존 답변을 덮어쓰지 않는다(§11). 같은 질문에 다시 답하면(재답변) 그 항목만
   * 교체하고, 새 질문이면 추가한다.
   */
  const addDeepAnswer = useCallback((answer: DeepAnalysisAnswer) => {
    setAnswers((prev) => ({
      ...prev,
      deepAnswers: [
        ...prev.deepAnswers.filter((item) => item.questionId !== answer.questionId),
        answer,
      ],
    }));
    trackEvent('deep_question_complete', { insight: answer.insightId, axis: answer.axis ?? '' });
  }, []);

  const setDeepInsightFeedback = useCallback(
    (insightId: string, verdict: Verdict, correctedText?: string) => {
      setAnswers((prev) => ({
        ...prev,
        deepInsightFeedback: {
          ...prev.deepInsightFeedback,
          [insightId]: { verdict, correctedText },
        },
      }));
      trackEvent('deep_insight_feedback', {
        insight: insightId,
        verdict: verdict === 'ok' ? 'agree' : verdict === 'no' ? 'correction' : 'unsure',
      });
    },
    [],
  );

  const markComplete = useCallback((key: CompletionKey) => {
    setAnswers((prev) =>
      prev.completed[key] ? prev : { ...prev, completed: { ...prev.completed, [key]: true } },
    );
  }, []);

  const markResultViewed = useCallback((kind: 'compatibility' | 'mirror') => {
    setAnswers((prev) => {
      const now = new Date().toISOString();
      return {
        ...prev,
        currentAnalysisMeta: {
          ...prev.currentAnalysisMeta,
          [kind === 'compatibility' ? 'compatibilityViewedAt' : 'mirrorViewedAt']: now,
          updatedAt: now,
        },
      };
    });
  }, []);

  /**
   * v1.11.1 §6 — 상대(Target)에 종속된 상태만 초기화한다.
   *
   * 초기화 대상: target(관계 행동 4축·상대 MBTI·상대 출생정보) · savedQuestions(전부
   * 상대 궁합 축 또는 상대 MBTI 비교에서 나온 질문 id라 상대와 무관한 항목이 없다) ·
   * completed.compatibility(다시 그 화면에 도달하기 전까지 Home '최근 궁합' 카드를
   * 보여주지 않기 위해) · currentAnalysisMeta.compatibilityViewedAt.
   *
   * 유지 대상: SELF 데이터 전부, Relationship History 전부, completed.mirror(Mirror는
   * Target을 쓰지 않는다), deepAnswers/deepInsightFeedback(사용자 자신의 관계 성찰 —
   * 참조하는 insightId가 새 상대로 재계산되며 자연히 못 쓰게 될 뿐 잘못 노출되지 않는다),
   * AI Narrative 캐시(fingerprint에 이미 target이 들어있어 새 상대는 별도 키로 계산된다 —
   * 재사용 위험이 없는 캐시까지 지우지 않는다, §13 최소 무효화 원칙).
   *
   * v1.15 — Premium Intent(`lym.premium-intent.v1`)도 여기서 함께 지운다. 이 저장소는
   * `feature`(예: `relationship_deep_report`)로만 키를 잡아 Target을 구분하지 않으므로,
   * 지우지 않으면 이전 상대에게서 나온 '출시되면 알려줘' 클릭이 새 상대의 Paywall에
   * 그대로 남아있는 것처럼 보인다(Audit에서 발견한 실제 누수). Compatibility/Mirror/History
   * 계산에는 어차피 관여하지 않는 저장소라 지워도 분석 결과에는 영향이 없다.
   */
  /**
   * v1.35 P4-B §4 — **History는 Target lifecycle과 분리된다.**
   *
   *   NEW TARGET   새 분석 context만 초기화한다
   *   HISTORY      사용자가 별도로 삭제하지 않는 한 유지된다
   *
   * 이 함수는 `SessionAnswers`만 다루고, History는 완전히 다른 저장소
   * (`lym.history.v1` · `historyRepository`)에 있다. 그래서 여기서 History를 지우지
   * 않는 것은 '깜빡한 것'이 아니라 **구조적으로 닿지 않는 것**이다 — Solo/Couple
   * 관찰 기록은 '누구와의 분석인가'가 아니라 '내 기준이 어떻게 움직였나'의 기록이므로
   * 상대가 바뀌어도 주어가 그대로다.
   *
   * History를 지우는 경로는 **사용자가 명시적으로 고른 두 곳뿐**이다:
   *   - Home '내 관찰 데이터 삭제'에서 '기록도 함께 삭제'를 체크한 경우
   *   - UT_MODE의 '다음 참가자를 위해 초기화'
   * 두 경로 모두 `useHistory().clearAll()`을 화면에서 직접 부른다.
   */
  const resetTargetContext = useCallback(() => {
    clearPremiumIntents();
    // vNext — Preview Unlock도 분석 단위 상태다. 새 상대로 넘어가면 함께 비운다.
    clearPreviewUnlocks();
    setAnswers((prev) => ({
      ...prev,
      // v1.13 §38 — target.preferences(좋아하는 것)는 TargetProfile 안에 있어서
      // createEmptyTargetProfile() 하나로 함께 초기화된다. 별도 처리가 필요 없다.
      target: createEmptyTargetProfile(),
      /**
       * v1.41 §39.20 — **현재 관계 근거는 새 상대에게 따라가지 않는다.**
       *
       * `Ended → 새 상대`가 이 함수를 부르는 경로이고, S30의 답변은 `그 관계에서
       * 내가 어땠는가`다. 그 값을 새 사람에게 그대로 들고 가면 **아직 한 번도
       * 관찰하지 않은 관계에 대해 근거가 있다고 말하는 것**이 된다 — v1.41이
       * 고치려던 결함과 정확히 같은 형태이고 방향만 반대다.
       *
       * ⚠️ 반대로 `dating → ended`에서는 **지우지 않는다.** 그 경로는 이 함수를
       * 부르지 않고(단계 변경은 `setStatus` 하나다), 회고에는 그 근거가 필요하다.
       * SELF 데이터(`declared`·`experience`)는 여기서도 그대로 유지된다 —
       * 현재 근거만 상대에 종속된 값이다.
       *
       * ⚠️ **이미 저장된 History Snapshot에는 손대지 않는다.** 그때 그 관계에서
       * 실제로 답한 값이고, 새 상대를 만났다는 사실이 과거 기록을 거짓으로
       * 만들지 않는다.
       */
      currentRelationship: { signals: {}, askedAt: null },
      savedQuestions: [],
      completed: { ...prev.completed, compatibility: false },
      // v1.12 §20 — 새 상대 = 새 funnel 단위. 랜덤 UUID만 쓰고 상대 개인정보는 담지 않는다.
      currentAnalysisMeta: {
        mirrorViewedAt: prev.currentAnalysisMeta?.mirrorViewedAt,
        updatedAt: new Date().toISOString(),
        funnelAnalysisId: crypto.randomUUID(),
      },
    }));
  }, []);

  const loadSampleSession = useCallback(() => {
    setAnswers(createSampleAnswers());
  }, []);

  const clearSession = useCallback(() => {
    setAnswers((prev) => {
      prev.photos.forEach((photo) => {
        if (photo.objectUrl) URL.revokeObjectURL(photo.objectUrl);
      });
      objectUrls.current = [];
      return createEmptyAnswers();
    });
    clearSessionDedup();
  }, []);

  const reset = useCallback(() => {
    clearSession();
    trackEvent('session_reset');
  }, [clearSession]);

  /** 사용자가 직접 요청한 전체 삭제 (Home의 '내 관찰 데이터 삭제'). reset()과 동작은 같지만
   * '개발용 초기화'가 아니라 '실제 삭제 요청'이라는 걸 analytics에서 구분한다. */
  const deleteAllData = useCallback(() => {
    clearSession();
    trackEvent('session_data_deleted');
  }, [clearSession]);

  const value = useMemo<SessionContextValue>(
    () => ({
      answers,
      hydrated,
      setStatus,
      addUploadedPhotos,
      removePhoto,
      clearPhotos,
      setObservedAnalysis,
      setObservationVerdict,
      correctObservation,
      toggleObservationExcluded,
      setDeclared,
      togglePastFactor,
      setHardest,
      setSelfGap,
      setPastNote,
      setAdaptiveAnswer,
      setCurrentSignal,
      clearCurrentSignal,
      markCurrentEvidenceAsked,
      skipExperience,
      resumeExperience,
      setTargetRelation,
      setTargetLevel,
      setTargetMbti,
      toggleTargetInterest,
      addCustomTargetInterest,
      removeTargetInterest,
      addRelationshipEvent,
      updateRelationshipEvent,
      removeRelationshipEvent,
      toggleSavedQuestion,
      setCoreVerdict,
      setCoreCorrection,
      setMbti,
      setBirthProfile,
      clearBirthProfile,
      setShareOption,
      addDeepAnswer,
      setDeepInsightFeedback,
      markComplete,
      markResultViewed,
      resetTargetContext,
      loadSampleSession,
      reset,
      deleteAllData,
    }),
    [
      answers,
      hydrated,
      setStatus,
      addUploadedPhotos,
      removePhoto,
      clearPhotos,
      setObservedAnalysis,
      setObservationVerdict,
      correctObservation,
      toggleObservationExcluded,
      setDeclared,
      togglePastFactor,
      setHardest,
      setSelfGap,
      setPastNote,
      setAdaptiveAnswer,
      setCurrentSignal,
      clearCurrentSignal,
      markCurrentEvidenceAsked,
      skipExperience,
      resumeExperience,
      setTargetRelation,
      setTargetLevel,
      setTargetMbti,
      toggleTargetInterest,
      addCustomTargetInterest,
      removeTargetInterest,
      addRelationshipEvent,
      updateRelationshipEvent,
      removeRelationshipEvent,
      toggleSavedQuestion,
      setCoreVerdict,
      setCoreCorrection,
      setMbti,
      setBirthProfile,
      clearBirthProfile,
      setShareOption,
      addDeepAnswer,
      setDeepInsightFeedback,
      markComplete,
      markResultViewed,
      resetTargetContext,
      loadSampleSession,
      reset,
      deleteAllData,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside <SessionProvider>');
  return context;
}
