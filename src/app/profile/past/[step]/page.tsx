import { notFound } from 'next/navigation';

import { PAST_STEPS, type PastStep } from '@/data/pastQuestions';
import { PastStepView } from './PastStepView';

export function generateStaticParams() {
  return PAST_STEPS.map((step) => ({ step: String(step) }));
}

export default async function PastStepPage({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  const parsed = Number(step);

  if (!PAST_STEPS.includes(parsed as PastStep)) notFound();

  return <PastStepView step={parsed as PastStep} />;
}
