'use client';

import { useState } from 'react';

import { BottomSheet } from '@/components/common/BottomSheet';
import { cn } from '@/lib/cn';
import { trackEvent } from '@/lib/analytics';
import { saveDeepReportUtAnswer, completeDeepReportUt } from '@/lib/deepReportUtStore';
import type { DeepReportUtResponse } from '@/types';

/**
 * Deep Report UT 5문항 (v1.10 · §11~§22)
 *
 * ⚠️ 기존 v1.7 UT(`UtRatingCard`)와 다른 것을 측정한다 — "AI 설명이 좋았나"가 아니라
 * "연결해서 보여준 것 자체가 가치 있었나"다. 그래서 별도 흐름으로 분리했다: 5개 질문을
 * 한 화면에 쌓지 않고, BottomSheet 안에서 질문당 1개씩 스텝으로 넘긴다(§17).
 *
 * ⚠️ 이 점수는 분석 로직에 전혀 쓰이지 않는다. `SessionAnswers`가 아니라 별도 저장소
 * (`lym.ut.deep.v1`)에 `analysisId` 기준으로만 쌓인다.
 */

const SCALE = [1, 2, 3, 4, 5] as const;
const TOTAL_STEPS = 5;
const MISSING_VALUE_MAX = 500;

type WtpChoice = DeepReportUtResponse['wtp'];

export function DeepReportUtFlow({
  open,
  onClose,
  analysisId,
  properties,
}: {
  open: boolean;
  onClose: () => void;
  analysisId: string;
  /** analysis_id 외에 함께 보낼 공통 property(§25) — 자유서술·AI 문장은 넣지 않는다 */
  properties?: Record<string, string | number | boolean>;
}) {
  const [step, setStep] = useState(1);
  const [missingValueDraft, setMissingValueDraft] = useState('');

  const advance = () => {
    if (step >= TOTAL_STEPS) {
      completeDeepReportUt(analysisId);
      onClose();
      return;
    }
    setStep((prev) => prev + 1);
  };

  const answerScale = (
    field: 'newInsight' | 'genericness' | 'crossSourceValue',
    event: 'ut_new_insight_rate' | 'ut_genericness_rate' | 'ut_cross_source_value_rate',
    value: number,
  ) => {
    saveDeepReportUtAnswer(analysisId, { [field]: value });
    trackEvent(event, { ...properties, analysis_id: analysisId, score: value });
    advance();
  };

  const answerWtp = (value: WtpChoice) => {
    saveDeepReportUtAnswer(analysisId, { wtp: value });
    trackEvent('ut_deep_report_wtp', { ...properties, analysis_id: analysisId, choice: value });
    advance();
  };

  const submitMissingValue = () => {
    const text = missingValueDraft.trim().slice(0, MISSING_VALUE_MAX);
    if (text) {
      saveDeepReportUtAnswer(analysisId, { missingValue: text });
      // 원문은 analytics로 보내지 않는다 — 로컬 저장소에만 남긴다(§16/§36).
      trackEvent('ut_deep_report_missing_value', {
        ...properties,
        analysis_id: analysisId,
        has_text: true,
        char_length: text.length,
      });
    } else {
      trackEvent('ut_deep_report_missing_value', {
        ...properties,
        analysis_id: analysisId,
        has_text: false,
        char_length: 0,
      });
    }
    completeDeepReportUt(analysisId);
    onClose();
  };

  const skipStep = () => advance();

  return (
    <BottomSheet open={open} onClose={onClose} title="분석 어땠어?" description="답한 내용은 분석 결과에 영향을 주지 않아. 언제든 건너뛸 수 있어.">
      <div className="flex flex-col gap-4">
        <p className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted">
          {step} / {TOTAL_STEPS}
        </p>

        {step === 1 ? (
          <ScaleQuestion
            question="이 결과에서 새롭게 알게 된 내용이 있었어?"
            lowLabel="전혀 없었어"
            highLabel="새롭게 생각해볼 내용이 많았어"
            onSelect={(value) => answerScale('newInsight', 'ut_new_insight_rate', value)}
          />
        ) : null}

        {step === 2 ? (
          <ScaleQuestion
            question="이 분석 결과는 다른 사람에게도 비슷하게 나올 것 같아?"
            lowLabel="전혀 그렇지 않아"
            highLabel="누구에게나 비슷할 것 같아"
            onSelect={(value) => answerScale('genericness', 'ut_genericness_rate', value)}
          />
        ) : null}

        {step === 3 ? (
          <ScaleQuestion
            question="내가 입력한 여러 정보를 연결해서 분석했다고 느꼈어?"
            lowLabel="전혀 그렇지 않아"
            highLabel="확실히 연결해서 봤다고 느꼈어"
            onSelect={(value) => answerScale('crossSourceValue', 'ut_cross_source_value_rate', value)}
          />
        ) : null}

        {step === 4 ? (
          <div className="flex flex-col gap-2.5">
            <p className="text-caption keep-all leading-relaxed">
              이 정도의 정밀 분석이라면 4,900원을 내고 다시 볼 의향이 있어?
            </p>
            <p className="text-[10.5px] keep-all text-ink-faint">
              실제 결제가 아니라 의향을 묻는 질문이야.
            </p>
            <div className="flex flex-col gap-1.5">
              {(
                [
                  { value: 'yes' as const, label: '있어' },
                  { value: 'maybe' as const, label: '조금 고민될 것 같아' },
                  { value: 'no' as const, label: '없어' },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => answerWtp(option.value)}
                  className="min-h-11 rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-left text-caption active:bg-sunken"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="flex flex-col gap-2.5">
            <p className="text-caption keep-all leading-relaxed">
              돈을 내고 본다면 어떤 내용이 더 있어야 할 것 같아? (선택)
            </p>
            <textarea
              value={missingValueDraft}
              onChange={(event) => setMissingValueDraft(event.target.value.slice(0, MISSING_VALUE_MAX))}
              maxLength={MISSING_VALUE_MAX}
              rows={3}
              aria-label="더 있어야 할 것 같은 내용"
              placeholder="자유롭게 적어줘 (선택)"
              className="w-full resize-none rounded-[10px] border border-line bg-sunken p-3 text-[12.5px] keep-all outline-none"
            />
            <p className="text-right text-[10.5px] text-ink-faint">
              {missingValueDraft.length}/{MISSING_VALUE_MAX}
            </p>
            <p className="text-[10.5px] keep-all leading-relaxed text-ink-faint">
              적어준 내용은 이 기기에만 남고, 외부로는 글자 수만 전달돼요.
            </p>
            <button
              type="button"
              onClick={submitMissingValue}
              className="min-h-11 rounded-[10px] bg-brand text-caption font-semibold text-white"
            >
              완료
            </button>
          </div>
        ) : null}

        <button
          type="button"
          onClick={skipStep}
          className="min-h-11 text-center text-[11.5px] text-ink-muted"
        >
          {step >= TOTAL_STEPS ? '건너뛰고 닫기' : '다음에 답할게'}
        </button>
      </div>
    </BottomSheet>
  );
}

function ScaleQuestion({
  question,
  lowLabel,
  highLabel,
  onSelect,
}: {
  question: string;
  lowLabel: string;
  highLabel: string;
  onSelect: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-caption keep-all leading-relaxed">{question}</p>
      <div className="flex gap-1.5" role="group" aria-label={question}>
        {SCALE.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onSelect(value)}
            className={cn(
              'min-h-11 flex-1 rounded-[10px] border border-line bg-surface text-[13px] tnum text-ink-sub',
              'active:border-brand active:bg-brand-tint active:font-semibold active:text-ink',
            )}
          >
            {value}
          </button>
        ))}
      </div>
      <div className="flex justify-between px-1 text-[10.5px] keep-all text-ink-faint">
        <span>{lowLabel}</span>
        <span className="text-right">{highLabel}</span>
      </div>
    </div>
  );
}
