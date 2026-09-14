'use client';

import { notFound, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';

import { SavedRelationshipList } from '@/components/account/SavedRelationshipsSection';
import { SectionLabel } from '@/components/common/primitives';
import { SAVED_RELATIONSHIPS_COPY, savedRelationshipRows } from '@/lib/persistence/savedRelationships';
import type { RelationshipStatus } from '@/types';

/**
 * /dev/saved-relationships?count=0|1|3|10 — **개발 전용** 저장한 관계 목록 레이아웃 미리보기
 *
 * 실제 목록은 로그인 + Supabase 연결이 있어야 보인다. 연결 전에도 393px 레이아웃 · 긴 별칭 · 10개 스크롤을
 * 확인하려고 **합성 요약**을 제품 함수(`savedRelationshipRows`)와 제품 컴포넌트(`SavedRelationshipList`)로 그린다.
 * ⚠️ 네트워크 · AI · 저장소를 쓰지 않는다. ⚠️ Production에서는 404.
 */
export default function SavedRelationshipsPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <Suspense fallback={null}>
      <Preview />
    </Suspense>
  );
}

const LABELS: (string | null)[] = [
  '민수',
  null,
  '아주 오래 알고 지낸 동아리 선배라서 별칭이 조금 긴 편인 사람',
  '지원',
  '회사 동료',
  '소개팅',
  null,
  '하늘',
  '여행에서 만난 사람',
  '예전 연인',
];
const STATUSES: RelationshipStatus[] = ['crush', 'dating', 'dating', 'crush', 'married', 'crush', 'dating', 'ended', 'crush', 'ended'];

function Preview() {
  const count = Math.min(10, Math.max(0, Number(useSearchParams().get('count') ?? '3') || 0));
  const [openingId, setOpeningId] = useState<string | null>(null);
  const rows = useMemo(
    () =>
      savedRelationshipRows(
        Array.from({ length: count }, (_, index) => ({
          id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
          label: LABELS[index] ?? null,
          relationStatus: STATUSES[index] ?? null,
          lastAnalysisAt: index % 3 === 2 ? null : new Date(Date.UTC(2026, 8, 14 - index, 3)).toISOString(),
          archived: false,
        })),
        { currentCloudTargetId: count > 0 ? '00000000-0000-4000-8000-000000000001' : null },
      ),
    [count],
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-4 bg-canvas px-4 py-6">
      <p className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted">DEV PREVIEW · 합성 데이터 {count}개</p>
      <section className="flex flex-col gap-2.5">
        <SectionLabel>{SAVED_RELATIONSHIPS_COPY.label}</SectionLabel>
        <SavedRelationshipList
          rows={rows}
          openingId={openingId}
          onOpen={(id) => {
            setOpeningId(id);
            setTimeout(() => setOpeningId(null), 1200);
          }}
        />
      </section>
    </main>
  );
}
