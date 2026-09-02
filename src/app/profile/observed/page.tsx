'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';

import { BottomSheet } from '@/components/common/BottomSheet';
import { Button } from '@/components/common/Button';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { InlineError, NoticeBox, PageHeading, Tag } from '@/components/common/primitives';
import { useToast } from '@/components/common/ToastProvider';
import { Lovy } from '@/components/lovy/Lovy';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { ObservationCard } from '@/components/profile/ObservationCard';
import { UtRatingCard } from '@/components/ut/UtRatingCard';
import { LOVY_LINES, PRIVACY } from '@/data/copy';
import { trackEvent } from '@/lib/analytics';
import { observedEvidenceLabel } from '@/lib/logic/observed';
import { resolveReturnDestination } from '@/lib/returnTo';
import { ROUTES } from '@/lib/routes';
import { isObservedReviewComplete } from '@/lib/validation';
import { useSession } from '@/state/SessionProvider';
import type { AiMode, ObservedAnalysisState } from '@/types';

/**
 * 관찰이 0개일 때의 문구 (v1.10 · §7 · §8).
 *
 * ⚠️ **네 가지를 절대 같은 말로 처리하지 않는다:**
 *   A. 분석은 됐는데 쓸 만한 장면이 없음  B. Provider 실패
 *   C. Demo/Mock 모드                    D. 사진이 부족함
 * 예전에는 A와 C가 같은 화면 문구를 썼고, 그래서 실제 분석이 붙어도 '데모야'라고 말했다.
 */
function emptyStateCopy(
  state: ObservedAnalysisState | null,
  mode: AiMode,
): { title: string; body: string } {
  if (state === null) {
    return {
      title: '아직 사진을 관찰하지 않았어.',
      body: '사진을 고르고 관찰을 시작하면 여기에 결과가 보여.',
    };
  }

  switch (state) {
    case 'insufficient_photos':
      return {
        title: '관찰에 쓸 사진이 조금 부족했어.',
        body: '사진이 조금 더 있으면 반복되는 모습을 확인하기 쉬워. 없는 걸 있다고 하진 않을게.',
      };
    case 'provider_failed':
      return {
        title: '사진 분석을 완료하지 못했어.',
        body: '내 쪽 문제라 사진 내용을 읽지 못했어. 다시 시도하거나 질문으로 계속해도 괜찮아.',
      };
    case 'demo':
    case 'mock':
      return {
        title: mode === 'mock' ? '지금은 개발용 MOCK 분석이야.' : '지금은 데모 분석을 사용 중이야.',
        body: '실제 사진 내용을 분석하지 않았어. 그래서 관찰 결과도 만들지 않았어.',
      };
    default:
      return {
        title: '사진은 봤는데, 관찰로 쓸 만한 장면을 못 찾았어.',
        body: '무엇을 하고 있는 장면인지 읽히지 않았어. 없는 걸 있다고 하진 않을게.',
      };
  }
}

/** S09 Observed Me 결과 — 러비의 관찰은 초안이고, 사용자가 고칠 수 있다. */
export default function ObservedResultPage() {
  // v1.11 — 아래 View가 Edit Return(§27)을 위해 useSearchParams()를 쓴다.
  return (
    <Suspense fallback={null}>
      <ObservedResultView />
    </Suspense>
  );
}

function ObservedResultView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const {
    answers,
    setObservationVerdict,
    correctObservation,
    toggleObservationExcluded,
    markComplete,
  } = useSession();

  /**
   * v1.6 — 저장된 분석 결과를 읽는다.
   * 예전에는 사진 개수로 매 렌더 재계산했지만, 실제 AI 결과는 재계산할 수 없다.
   */
  const analysis = answers.observedAnalysis;
  const traits = useMemo(() => analysis?.traits ?? [], [analysis]);
  const mode = analysis?.meta.mode ?? 'demo';
  const coverage = analysis?.evidenceCoverage;
  /**
   * §8 — '분석 실패'와 '반복 없음'을 화면에서도 분리한다. 예전 세션에 저장된 결과에는
   * 이 값이 없으므로(optional) null로 두고, 없으면 예전처럼 mode만 보고 말한다.
   */
  const observedState = analysis?.observedState ?? null;
  const repeatedCount = useMemo(
    () => traits.filter((trait) => trait.signal && trait.signal.strength !== 'single').length,
    [traits],
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [excludeTargetId, setExcludeTargetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const editingTrait = traits.find((trait) => trait.id === editingId) ?? null;

  const openEditor = (id: string) => {
    const current = answers.observations[id]?.correctedText ?? '';
    setDraft(current);
    setEditingId(id);
  };

  const saveCorrection = () => {
    if (!editingId) return;
    const text = draft.trim();
    if (text.length === 0) {
      showToast('어떻게 다른지 한 줄만 적어줘', 'warning');
      return;
    }
    const target = traits.find((trait) => trait.id === editingId);
    correctObservation(editingId, text);
    trackEvent('observed_result_edit', { trait: editingId });
    // §22 — 수정 **내용**은 보내지 않는다. 어떤 분류의 신호가 고쳐졌는지만 센다.
    trackEvent('photo_observation_correct', {
      category: target?.signal?.category ?? 'unknown',
      strength: target?.signal?.strength ?? 'unknown',
      ai_mode: mode,
    });
    setEditingId(null);
    showToast('관찰 기록을 고쳤어');
  };

  const handleNext = () => {
    if (!isObservedReviewComplete(answers)) {
      setError('하나라도 맞는지 알려줘. 그게 다음 관찰의 기준이 돼.');
      return;
    }
    markComplete('observed');
    trackEvent('observed_profile_complete', {
      confirmed: Object.values(answers.observations).filter((f) => f.verdict === 'ok').length,
      corrected: Object.values(answers.observations).filter((f) => f.correctedText).length,
      excluded: Object.values(answers.observations).filter((f) => f.excluded).length,
    });
    // v1.11 — Profile Revisit에서 '사진 관찰 다시 보기'로 들어온 거면 Declared Funnel로
    // 계속 밀지 않고 Profile Revisit으로 돌려보낸다(§27) — 새 입력 UI를 만들지 않는다.
    router.push(resolveReturnDestination(searchParams, ROUTES.declared(1)));
  };

  /**
   * §62 — Trait 0개는 **실패가 아니다.** '근거를 못 찾았다'는 정상 상태이고,
   * 사진 분석이 약하다고 Core Funnel을 막지 않는다(§63) — 질문으로 계속할 길을 함께 준다.
   */
  if (traits.length === 0) {
    const empty = emptyStateCopy(analysis === null ? null : observedState, mode);

    return (
      <ScreenLayout
        header={<ScreenHeader backHref={ROUTES.photos} title="관찰 기록" />}
        footer={
          <div className="flex flex-col gap-0.5">
            <Button onClick={() => router.push(ROUTES.photos)}>사진 더 고르기</Button>
            <Button variant="text" onClick={() => router.push(ROUTES.declared(1))}>
              질문으로 계속하기
            </Button>
          </div>
        }
      >
        <div className="flex h-full flex-col items-center justify-center gap-4 px-3.5 pb-10 text-center">
          <Lovy pose="question" size={120} decorative />
          <h2 className="text-section keep-all">{empty.title}</h2>
          <p className="text-sub keep-all leading-relaxed text-ink-sub">{empty.body}</p>
          {analysis && analysis.limitations.length > 0 ? (
            <ul className="flex flex-col gap-1.5 pt-1">
              {analysis.limitations.map((item) => (
                <li key={item} className="text-meta keep-all leading-relaxed text-ink-faint">
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </ScreenLayout>
    );
  }

  return (
    <>
      <ScreenLayout
        header={<ScreenHeader backHref={ROUTES.photos} progress={30} counter="2/3" />}
        footer={
          <div className="flex flex-col gap-2">
            {error ? <InlineError message={error} /> : null}
            <Button onClick={handleNext}>다음</Button>
          </div>
        }
        bodyClassName="pt-1.5 pb-3"
      >
        <div className="flex flex-col gap-3.5">
          <PageHeading
            lines={[
              // §6 — '생활 패턴'이라고 부르지 않는다. 반복 근거가 있을 때만 '반복해서'라고 쓴다.
              observedState === 'repeated_found'
                ? '사진에서 반복해서 보인 활동이야.'
                : observedState === 'single_only'
                  ? '사진에서 이런 장면이 보였어.'
                  : '사진에서 이런 모습이 보였어.',
            ]}
            eyebrow={
              <div className="flex flex-wrap items-center gap-1.5">
                <Tag tone="brand">OBSERVED ME</Tag>
                {/*
                  근거 배지는 '사진 N장'이 아니라 **실제로 쓰인 근거**를 말한다(§11).
                  사진 8장을 올렸어도 쓸 만한 근거가 2개면 그렇게 표시한다.
                */}
                {(mode === 'real' || mode === 'mock') && coverage ? (
                  <Tag tone="mint">
                    근거: 사진 {coverage.usableImageCount}/{coverage.imageCount}장
                  </Tag>
                ) : (
                  <Tag tone="mint">{observedEvidenceLabel(answers.photos)}</Tag>
                )}
                {/* 실제 분석이면 DEMO 배지를 붙이지 않는다. fallback은 사실대로 알린다(§39) */}
                {mode === 'real' ? <Tag tone="neutral">AI OBSERVATION</Tag> : null}
                {/* 개발 전용 mock을 실제 AI로 표시하지 않는다 (v1.7 §5) */}
                {mode === 'mock' ? <Tag tone="friction">MOCK AI</Tag> : null}
                {mode === 'demo' || mode === 'legacy-demo' ? (
                  <Tag tone="neutral">DEMO AI</Tag>
                ) : null}
                {mode === 'fallback' ? <Tag tone="friction">규칙 기반 대체</Tag> : null}
              </div>
            }
          />

          {/*
            §7 — No Pattern ≠ No Information. 반복이 없다고 화면을 비우지 않는다.
            한 번 나온 장면은 그대로 보여주되, 그게 '평소 생활'이 아니라는 걸 먼저 말한다.
          */}
          {observedState === 'single_only' ? (
            <NoticeBox>
              사진은 잘 봤어. 다만 같은 활동이 여러 번 반복해서 보이지는 않았어. 한 번 나온
              장면만으로 평소 생활이라고 단정하진 않을게.
            </NoticeBox>
          ) : null}

          <ul className="flex flex-col gap-2.5">
            {traits.map((trait) => (
              <ObservationCard
                key={trait.id}
                trait={trait}
                feedback={answers.observations[trait.id]}
                onVerdict={(verdict) => {
                  setObservationVerdict(trait.id, verdict);
                  setError(null);
                  if (verdict === 'ok') {
                    // §22 — 어떤 분류·강도의 신호가 사용자에게 '맞다'고 확인됐는지만 센다.
                    trackEvent('photo_observation_confirm', {
                      category: trait.signal?.category ?? 'unknown',
                      strength: trait.signal?.strength ?? 'unknown',
                      ai_mode: mode,
                    });
                  }
                }}
                onRequestEdit={() => openEditor(trait.id)}
                onToggleExcluded={() => {
                  if (answers.observations[trait.id]?.excluded) {
                    toggleObservationExcluded(trait.id);
                    return;
                  }
                  setExcludeTargetId(trait.id);
                }}
              />
            ))}
          </ul>

          <LovyMessage pose="question" size={40}>
            {LOVY_LINES.observedResult}
          </LovyMessage>

          {/* 이 분석이 못 한 것을 숨기지 않는다 */}
          {analysis && analysis.limitations.length > 0 ? (
            <ul className="flex flex-col gap-1.5 px-1">
              {analysis.limitations.map((item) => (
                <li
                  key={item}
                  className="flex gap-2 text-[11.5px] keep-all leading-relaxed text-ink-sub"
                >
                  <span className="flex-none text-ink-faint" aria-hidden>
                    ·
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          ) : null}

          {/* §44 — UT Mode에서만. '나 같다' 유사도는 관찰 결과를 본 직후에 묻는 게 맞다 */}
          <UtRatingCard
            question="이 관찰 결과가 평소의 나와 얼마나 비슷해?"
            event="ut_analysis_similarity_rate"
            properties={{
              task: 'observed',
              mode,
              trait_count: traits.length,
              repeated_signal_count: repeatedCount,
              usable_evidence_count: coverage?.usableImageCount ?? 0,
            }}
            lowLabel="전혀 다름"
            highLabel="매우 비슷함"
          />

          <NoticeBox>{PRIVACY.aiResult}</NoticeBox>
          {/*
            §14 — 실제 Vision이 붙은 상태에서는 '사진을 분석하지 않는다'는 문구를 쓰지 않고,
            실제로 일어난 일(서버 전송·관찰·미저장)만 말한다.
          */}
          {mode === 'real' ? <NoticeBox>{PRIVACY.photoTransfer}</NoticeBox> : null}
          {mode === 'mock' ? (
            <NoticeBox>
              개발용 MOCK 모드야. 실제 AI Provider를 호출하지 않았고, 사진 내용을 읽은 결과가
              아니야.
            </NoticeBox>
          ) : null}
          {mode === 'demo' || mode === 'legacy-demo' ? (
            <NoticeBox>{PRIVACY.demoAi}</NoticeBox>
          ) : null}
          {mode === 'fallback' ? (
            <NoticeBox>
              사진 분석에 실패해서 일부 결과를 간단한 규칙 기반으로 보여주고 있어. 사진 내용을
              읽은 결과가 아니야.
            </NoticeBox>
          ) : null}
        </div>
      </ScreenLayout>

      <BottomSheet
        open={editingId !== null}
        onClose={() => setEditingId(null)}
        title="어떻게 다른지 알려줘"
        description={
          editingTrait
            ? `러비의 관찰: "${editingTrait.observation}" — 네 말로 고쳐 적으면 이 문장을 대신 쓸게.`
            : undefined
        }
      >
        <div className="flex flex-col gap-3">
          <label className="sr-only" htmlFor="observation-correction">
            관찰 수정
          </label>
          <textarea
            id="observation-correction"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={80}
            rows={3}
            placeholder="예) 영화보다는 전시를 더 자주 봐"
            className="w-full resize-none rounded-row border border-line bg-surface p-3.5 text-sub leading-relaxed outline-none focus:border-brand"
          />
          <div className="flex items-center justify-between px-1">
            <span className="text-meta text-ink-muted">{draft.length}/80</span>
            <button
              type="button"
              onClick={() => {
                if (!editingId) return;
                correctObservation(editingId, '');
                setObservationVerdict(editingId, null);
                setEditingId(null);
                showToast('원래 관찰로 되돌렸어');
              }}
              className="flex min-h-11 items-center text-meta text-ink-muted"
            >
              원래 관찰로 되돌리기
            </button>
          </div>
          <Button onClick={saveCorrection}>이렇게 고칠게</Button>
        </div>
      </BottomSheet>

      <ConfirmModal
        open={excludeTargetId !== null}
        title="이 관찰을 분석에서 제외할까?"
        description="제외하면 관찰 기록과 이후 분석에서 이 항목이 빠져. 언제든 다시 포함할 수 있어."
        confirmLabel="제외"
        onCancel={() => setExcludeTargetId(null)}
        onConfirm={() => {
          if (excludeTargetId) {
            toggleObservationExcluded(excludeTargetId);
            trackEvent('observation_excluded', { trait: excludeTargetId });
            showToast('분석에서 제외했어');
          }
          setExcludeTargetId(null);
        }}
      />
    </>
  );
}
