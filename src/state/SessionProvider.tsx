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
import type {
  DeclaredPreference,
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

  toggleSavedQuestion: (id: TargetAxisKey) => boolean;

  setCoreVerdict: (verdict: Verdict) => void;
  setCoreCorrection: (text: string) => void;

  setMbti: (value: MbtiType | null) => void;
  setZodiac: (value: ZodiacSign | null) => void;

  setShareOption: (key: keyof SessionAnswers['share'], value: boolean) => void;

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

    return {
      ...base,
      ...parsed,
      declared: { ...base.declared, ...parsed.declared },
      experience: { ...base.experience, ...parsed.experience },
      target: { ...base.target, ...parsed.target },
      share: { ...base.share, ...parsed.share },
      completed: { ...base.completed, ...parsed.completed },
      photos,
      observations: parsed.observations ?? {},
      savedQuestions: Array.isArray(parsed.savedQuestions) ? parsed.savedQuestions : [],
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
    trackEvent('target_mbti_set', { mbti: value ?? '' });
  }, []);

  /** @returns 저장된 상태인지 (true = 방금 저장, false = 저장 해제) */
  const toggleSavedQuestion = useCallback((id: TargetAxisKey) => {
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
    trackEvent('lens_mbti_set', { mbti: value ?? '' });
  }, []);

  const setZodiac = useCallback((value: ZodiacSign | null) => {
    setAnswers((prev) => ({ ...prev, zodiac: value }));
    trackEvent('lens_zodiac_set', { zodiac: value ?? '' });
  }, []);

  const setShareOption = useCallback((key: keyof SessionAnswers['share'], value: boolean) => {
    setAnswers((prev) => ({ ...prev, share: { ...prev.share, [key]: value } }));
  }, []);

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
      setZodiac,
      setShareOption,
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
      setZodiac,
      setShareOption,
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
