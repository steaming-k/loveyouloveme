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
import { PHOTO_MAX_COUNT, SAMPLE_PHOTOS, DEMO_PHOTO_IDS } from '@/data/samplePhotos';
import { clearSessionDedup, trackEvent } from '@/lib/analytics';
import { createEmptyBirthProfile } from '@/lib/logic/birth';
import { buildDemoObservedResult } from '@/services/ai/fallback';
import type {
  ObservedProfileResult,
  BirthProfile,
  ConversationQuestionId,
  DeclaredPreference,
  DeepAnalysisAnswer,
  HardestMoment,
  MbtiType,
  MirrorAxisKey,
  PastFactor,
  PhotoAsset,
  RelationshipStatus,
  SelfGapAnswer,
  SessionAnswers,
  TargetAxisKey,
  TargetLevel,
  TargetRelation,
  Verdict,
  ZodiacSign,
} from '@/types';
import { createEmptyAnswers, createSampleAnswers } from './defaultAnswers';

const STORAGE_KEY = 'lym.session.v1';

type CompletionKey = keyof SessionAnswers['completed'];

/** Birth Profile의 주체 — 나 / 내가 알고 있는 상대 */
export type BirthSubject = 'self' | 'target';

interface SessionContextValue {
  answers: SessionAnswers;
  /** localStorage 복원이 끝났는지. 라우트 가드는 이 값이 true가 된 뒤에만 판단한다. */
  hydrated: boolean;

  setStatus: (status: RelationshipStatus) => void;

  toggleSamplePhoto: (id: string) => void;
  addUploadedPhotos: (photos: PhotoAsset[]) => void;
  removePhoto: (id: string) => void;
  applyDemoPhotos: () => void;
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
  skipExperience: () => void;
  resumeExperience: () => void;

  setTargetRelation: (value: TargetRelation) => void;
  setTargetLevel: (key: TargetAxisKey, value: TargetLevel) => void;
  setTargetMbti: (value: MbtiType | null) => void;

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
      declared: { ...base.declared, ...parsed.declared },
      experience: { ...base.experience, ...parsed.experience },
      target: {
        ...base.target,
        ...parsed.target,
        birthProfile: { ...base.target.birthProfile, ...parsed.target?.birthProfile },
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

  const toggleSamplePhoto = useCallback((id: string) => {
    setAnswers((prev) => {
      const exists = prev.photos.some((photo) => photo.id === id);
      if (exists) {
        return { ...prev, photos: prev.photos.filter((photo) => photo.id !== id) };
      }
      if (prev.photos.length >= PHOTO_MAX_COUNT) return prev;

      const sample = SAMPLE_PHOTOS.find((photo) => photo.id === id);
      if (!sample) return prev;
      return { ...prev, photos: [...prev.photos, { ...sample }] };
    });
  }, []);

  const addUploadedPhotos = useCallback((photos: PhotoAsset[]) => {
    photos.forEach((photo) => {
      if (photo.objectUrl) objectUrls.current.push(photo.objectUrl);
    });
    setAnswers((prev) => ({
      ...prev,
      photos: [...prev.photos, ...photos].slice(0, PHOTO_MAX_COUNT),
    }));
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

  const applyDemoPhotos = useCallback(() => {
    setAnswers((prev) => ({
      ...prev,
      photos: SAMPLE_PHOTOS.filter((photo) =>
        (DEMO_PHOTO_IDS as readonly string[]).includes(photo.id),
      ).map((photo) => ({ ...photo })),
    }));
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
      // 분석이 바뀌면 이전 관찰에 대한 피드백은 의미가 없다 — trait id가 달라지기 때문이다.
      const sameFingerprint =
        prev.observedAnalysis?.meta.inputFingerprint === result?.meta.inputFingerprint;
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
    trackEvent('target_mbti_select', { mbti: value ?? '' });
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

  const setCoreVerdict = useCallback((verdict: Verdict) => {
    setAnswers((prev) => ({ ...prev, coreVerdict: verdict }));
  }, []);

  const setCoreCorrection = useCallback((text: string) => {
    setAnswers((prev) => ({ ...prev, coreCorrection: text, coreVerdict: 'no' }));
  }, []);

  const setMbti = useCallback((value: MbtiType | null) => {
    setAnswers((prev) => ({ ...prev, mbti: value }));
    trackEvent('self_mbti_select', { mbti: value ?? '' });
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
      toggleSamplePhoto,
      addUploadedPhotos,
      removePhoto,
      applyDemoPhotos,
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
      skipExperience,
      resumeExperience,
      setTargetRelation,
      setTargetLevel,
      setTargetMbti,
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
      loadSampleSession,
      reset,
      deleteAllData,
    }),
    [
      answers,
      hydrated,
      setStatus,
      toggleSamplePhoto,
      addUploadedPhotos,
      removePhoto,
      applyDemoPhotos,
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
      skipExperience,
      resumeExperience,
      setTargetRelation,
      setTargetLevel,
      setTargetMbti,
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
