import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { PAST_STEPS, type PastStep } from '@/data/pastQuestions';
import { PastStepView } from './PastStepView';

export function generateStaticParams() {
  return PAST_STEPS.map((step) => ({ step: String(step) }));
}

export default async function PastStepPage({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  const parsed = Number(step);

  if (!PAST_STEPS.includes(parsed as PastStep)) notFound();

  // v1.11 — PastStepView가 Edit Return(§27)을 위해 useSearchParams()를 쓴다.
  return (
    <Suspense fallback={null}>
      <PastStepView step={parsed as PastStep} />
    </Suspense>
  );
}
