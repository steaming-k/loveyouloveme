'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { getPrimaryKpi } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { ROUTES, SCREEN_BOARD, type ScreenBoardEntry } from '@/lib/routes';
import { useCompatibility, useMirror } from '@/hooks/useAnalysis';
import { useSession } from '@/state/SessionProvider';

const GROUP_CHIP: Record<ScreenBoardEntry['group'], string> = {
  Key: 'bg-brand-tint text-brand-pressed',
  Core: 'bg-black/[0.06] text-[#555]',
  Edge: 'bg-chip text-[#555]',
  Future: 'bg-chip text-[#555]',
  Share: 'bg-chip text-[#555]',
  'Add-on': 'bg-chip text-[#555]',
};

/**
 * 데스크톱 전용 프로토타입 패널 (와이어프레임 1a 사이드 패널과 동일한 역할)
 * 답변을 바꾸면 동기화율·신호·Mirror GAP이 실시간으로 어떻게 달라지는지 보여준다.
 */
export function PrototypePanel() {
  const pathname = usePathname();
  const router = useRouter();
  const { answers, hydrated, reset, loadSampleSession } = useSession();
  const compatibility = useCompatibility();
  const mirror = useMirror();
  const [kpi, setKpi] = useState<ReturnType<typeof getPrimaryKpi> | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    setKpi(getPrimaryKpi());
  }, [hydrated, pathname, answers]);

  const current =
    SCREEN_BOARD.find((entry) => entry.href === pathname) ??
    SCREEN_BOARD.find((entry) => pathname.startsWith(entry.href) && entry.href !== '/');

  return (
    <aside className="hidden w-[262px] flex-none flex-col gap-4 self-center lg:flex">
      <section className="flex flex-col gap-1">
        <h2 className="text-label text-ink-muted">NOW SHOWING</h2>
        <p className="text-[15px] font-semibold tracking-[-0.2px] text-ink">
          {current ? `${current.short} · ${current.name}` : pathname}
        </p>
      </section>

      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => router.push(ROUTES.splash)}
          className="flex-1 rounded-tag border border-line bg-surface py-2.5 text-meta text-ink transition-colors hover:bg-sunken"
        >
          처음부터
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            router.push(ROUTES.splash);
          }}
          className="flex-1 rounded-tag border border-line bg-surface py-2.5 text-meta text-ink transition-colors hover:bg-sunken"
        >
          답변 초기화
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          loadSampleSession();
          router.push(ROUTES.profileResult);
        }}
        className="rounded-tag border border-brand-edge bg-brand-tint py-2.5 text-meta font-medium text-brand-pressed transition-colors hover:bg-[#E9E2FD]"
      >
        김지수 샘플 세션 불러오기
      </button>

      <div className="h-px bg-line-soft" />

      <section className="flex flex-col gap-1.5">
        <h2 className="text-label text-ink-muted">현재 계산값</h2>
        <PanelRow label="동기화율" value={compatibility.score ?? '—'} highlight />
        <PanelRow label="잘 맞는 신호" value={compatibility.goodSignals.length} />
        <PanelRow label="관찰 필요 신호" value={compatibility.frictionSignals.length} />
        <PanelRow label="비교한 항목" value={`${compatibility.comparedCount}/${compatibility.totalCount}`} />
        <PanelRow label="Mirror GAP" value={mirror.gapCount} />
      </section>

      <div className="h-px bg-line-soft" />

      <section className="flex flex-col gap-1.5">
        <h2 className="text-label text-ink-muted">PRIMARY KPI</h2>
        <PanelRow
          label="Mirror 진입률"
          value={kpi?.entryRate === null || kpi === null ? '—' : `${kpi.entryRate}%`}
          highlight
        />
        <p className="text-[11px] leading-relaxed text-ink-muted">
          relationship_mirror_entry_click / compatibility_result_view
        </p>
      </section>

      <div className="h-px bg-line-soft" />

      <section className="flex flex-col gap-2">
        <h2 className="text-label text-ink-muted">SCREEN JUMP</h2>
        <div className="flex flex-wrap gap-1">
          {SCREEN_BOARD.map((entry) => (
            <Link
              key={entry.id}
              href={entry.href}
              className={cn(
                'rounded-[5px] px-1.5 py-1 font-mono text-[10px] font-semibold transition-opacity hover:opacity-70',
                GROUP_CHIP[entry.group],
                entry.href === pathname && 'ring-1 ring-brand',
              )}
              title={`${entry.short} · ${entry.name}`}
            >
              {entry.short}
            </Link>
          ))}
        </div>
      </section>
    </aside>
  );
}

function PanelRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between text-[12.5px] text-[#555]">
      <span>{label}</span>
      <span className={cn('tnum', highlight ? 'font-semibold text-brand' : 'text-ink')}>{value}</span>
    </div>
  );
}
