import { notFound } from 'next/navigation';

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

  return <DeclaredStepView step={parsed as DeclaredStep} />;
}
