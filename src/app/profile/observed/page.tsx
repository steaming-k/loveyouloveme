'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

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
import { LOVY_LINES, PRIVACY } from '@/data/copy';
import { trackEvent } from '@/lib/analytics';
import { observedEvidenceLabel } from '@/lib/logic/observed';
import { ROUTES } from '@/lib/routes';
import { isObservedReviewComplete } from '@/lib/validation';
import { useSession } from '@/state/SessionProvider';

/** S09 Observed Me 결과 — 러비의 관찰은 초안이고, 사용자가 고칠 수 있다. */
export default function ObservedResultPage() {
  const router = useRouter();
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
    correctObservation(editingId, text);
    trackEvent('observed_result_edit', { trait: editingId });
    setEditingId(null);
    showToast('관찰 기록을 고쳤어요');
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
    router.push(ROUTES.declared(1));
  };

  /**
   * §62 — Trait 0개는 **실패가 아니다.** '근거를 못 찾았다'는 정상 상태이고,
   * 사진 분석이 약하다고 Core Funnel을 막지 않는다(§63) — 질문으로 계속할 길을 함께 준다.
   */
  if (traits.length === 0) {
    const analyzed = analysis !== null;

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
          <h2 className="text-section keep-all">
            {analyzed
              ? '사진은 봤는데, 아직 반복되는 신호를 못 찾았어.'
              : '아직 사진을 관찰하지 않았어.'}
          </h2>
          <p className="text-sub keep-all leading-relaxed text-ink-sub">
            {analyzed
              ? '생활 패턴이라고 부를 만큼 반복되는 장면이 안 보였어. 없는 걸 있다고 하진 않을게.'
              : '사진을 고르고 관찰을 시작하면 여기에 결과가 보여.'}
          </p>
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
            lines={['사진에서 이런 모습이 보였어.']}
            eyebrow={
              <div className="flex flex-wrap items-center gap-1.5">
                <Tag tone="brand">OBSERVED ME</Tag>
                {/*
                  근거 배지는 '사진 N장'이 아니라 **실제로 쓰인 근거**를 말한다(§11).
                  사진 8장을 올렸어도 쓸 만한 근거가 2개면 그렇게 표시한다.
                */}
                {mode === 'real' && coverage ? (
                  <Tag tone="mint">
                    근거: 사진 {coverage.usableImageCount}/{coverage.imageCount}장
                  </Tag>
                ) : (
                  <Tag tone="mint">{observedEvidenceLabel(answers.photos)}</Tag>
                )}
                {/* 실제 분석이면 DEMO 배지를 붙이지 않는다. fallback은 사실대로 알린다(§39) */}
                {mode === 'real' ? <Tag tone="neutral">AI OBSERVATION</Tag> : null}
                {mode === 'demo' || mode === 'legacy-demo' ? (
                  <Tag tone="neutral">DEMO AI</Tag>
                ) : null}
                {mode === 'fallback' ? <Tag tone="friction">규칙 기반 대체</Tag> : null}
              </div>
            }
          />

          <ul className="flex flex-col gap-2.5">
            {traits.map((trait) => (
              <ObservationCard
                key={trait.id}
                trait={trait}
                feedback={answers.observations[trait.id]}
                onVerdict={(verdict) => {
                  setObservationVerdict(trait.id, verdict);
                  setError(null);
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

          <NoticeBox>{PRIVACY.aiResult}</NoticeBox>
          {mode === 'real' ? <NoticeBox>{PRIVACY.photoTransfer}</NoticeBox> : null}
          {mode === 'demo' || mode === 'legacy-demo' ? (
            <NoticeBox>{PRIVACY.demoAi}</NoticeBox>
          ) : null}
          {mode === 'fallback' ? (
            <NoticeBox>
              사진 분석에 실패해서 일부 결과를 간단한 규칙 기반으로 보여주고 있어요. 사진 내용을
              읽은 결과가 아니에요.
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
                showToast('원래 관찰로 되돌렸어요');
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
        description="제외하면 관찰 기록과 이후 분석에서 이 항목이 빠져요. 언제든 다시 포함할 수 있어요."
        confirmLabel="제외"
        onCancel={() => setExcludeTargetId(null)}
        onConfirm={() => {
          if (excludeTargetId) {
            toggleObservationExcluded(excludeTargetId);
            trackEvent('observation_excluded', { trait: excludeTargetId });
            showToast('분석에서 제외했어요');
          }
          setExcludeTargetId(null);
        }}
      />
    </>
  );
}
