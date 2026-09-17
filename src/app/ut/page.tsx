'use client';

import { notFound } from 'next/navigation';

import { UtOperatorConsole } from '@/components/ut/UtOperatorConsole';
import { UT_OPERATOR_TOOLS_ENABLED } from '@/lib/utMode';

/**
 * /ut — **UT 운영자 화면** (Health Check · UT 결과 내보내기 · 다음 참가자 초기화)
 *
 * ⚠️ 참가자에게 보이는 화면 어디에서도 이 경로로 가는 링크를 두지 않는다.
 * ⚠️ 개발 서버 또는 `NEXT_PUBLIC_UT_MODE=true` 배포에서만 열린다. 일반 Production은 `?mode=ut`를 붙여도 404.
 */
export default function UtOperatorPage() {
  if (!UT_OPERATOR_TOOLS_ENABLED) notFound();
  return <UtOperatorConsole />;
}
