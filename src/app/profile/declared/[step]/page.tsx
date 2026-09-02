import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { DECLARED_STEPS, type DeclaredStep } from '@/data/declaredQuestions';
import { DeclaredStepView } from './DeclaredStepView';

export function generateStaticParams() {
  return DECLARED_STEPS.map((step) => ({ step: String(step) }));
}

export default async function DeclaredStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { step } = await params;
  const parsed = Number(step);

  if (!DECLARED_STEPS.includes(parsed as DeclaredStep)) notFound();

  // v1.11 — DeclaredStepView가 Edit Return(§27)을 위해 useSearchParams()를 쓴다.
  return (
    <Suspense fallback={null}>
      <DeclaredStepView step={parsed as DeclaredStep} />
    </Suspense>
  );
}
