'use client';

import { useMemo, useState } from 'react';

import { SectionLabel } from '@/components/common/primitives';
import {
  SAVED_RELATIONSHIPS_COPY,
  savedRelationshipRows,
  type SavedRelationshipRow,
} from '@/lib/persistence/savedRelationships';
import { useAccount } from '@/state/AccountProvider';

/**
 * v1.47 — Home의 **저장한 관계** (최소 UI). 새 화면 · 내비게이션을 만들지 않는다.
 *
 * ⚠️ 로그인한 사용자에게만 그린다. Guest · Supabase 미설정이면 아무것도 그리지 않는다(Home 불변).
 * ⚠️ 목록 행은 자르지 않은 별칭을 말줄임(CSS)으로만 줄인다.
 */

export function SavedRelationshipList({
  rows,
  openingId,
  onOpen,
}: {
  rows: readonly SavedRelationshipRow[];
  openingId: string | null;
  onOpen: (cloudTargetId: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-1 rounded-row border border-dashed border-line-strong bg-canvas-warm px-4 py-3.5">
        <p className="text-caption keep-all text-ink-sub">{SAVED_RELATIONSHIPS_COPY.emptyTitle}</p>
        <p className="text-[12px] keep-all text-ink-faint">{SAVED_RELATIONSHIPS_COPY.emptyDetail}</p>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => {
        const opening = openingId === row.cloudTargetId;
        return (
          <li key={row.cloudTargetId}>
            <button
              type="button"
              disabled={row.current || openingId !== null}
              aria-current={row.current ? 'true' : undefined}
              onClick={() => onOpen(row.cloudTargetId)}
              className="flex w-full min-h-11 items-center justify-between gap-3 rounded-row border border-line bg-surface p-[15px] text-left active:bg-sunken disabled:cursor-default"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-sub font-semibold">
                  {row.title}
                  {row.statusLabel ? <span className="font-normal text-ink-sub"> · {row.statusLabel}</span> : null}
                </span>
                <span className="truncate text-[12px] text-ink-muted">{row.analysisLine}</span>
              </span>
              <span
                className={
                  row.current
                    ? 'flex-none rounded-[6px] bg-sunken px-2 py-1.5 text-label font-semibold text-ink-sub'
                    : 'flex-none rounded-[6px] bg-brand-tint px-2 py-1.5 text-label font-semibold text-brand-pressed'
                }
              >
                {row.current
                  ? SAVED_RELATIONSHIPS_COPY.current
                  : opening
                    ? SAVED_RELATIONSHIPS_COPY.opening
                    : SAVED_RELATIONSHIPS_COPY.open}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function SavedRelationshipsSection({ onOpened }: { onOpened?: () => void }) {
  const account = useAccount();
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [openFailed, setOpenFailed] = useState(false);
  const rows = useMemo(
    () => savedRelationshipRows(account.savedRelationships ?? [], { currentCloudTargetId: account.activeCloudTargetId }),
    [account.savedRelationships, account.activeCloudTargetId],
  );

  if (account.status !== 'signed_in') return null;

  const open = async (cloudTargetId: string) => {
    setOpeningId(cloudTargetId);
    setOpenFailed(false);
    const outcome = await account.openSavedRelationship(cloudTargetId);
    setOpeningId(null);
    if (!outcome.ok) {
      setOpenFailed(true);
      return;
    }
    onOpened?.();
  };

  return (
    <section className="flex flex-col gap-2.5">
      <SectionLabel>{SAVED_RELATIONSHIPS_COPY.label}</SectionLabel>
      {account.savedRelationshipsStatus === 'failed' ? (
        <div className="flex items-center justify-between gap-3 rounded-row border border-line bg-surface px-4 py-3">
          <p className="text-[12px] keep-all leading-relaxed text-ink-faint">{SAVED_RELATIONSHIPS_COPY.failed}</p>
          <button
            type="button"
            onClick={() => void account.refreshSavedRelationships()}
            className="flex min-h-11 flex-none items-center text-[12px] font-medium text-brand-pressed"
          >
            {SAVED_RELATIONSHIPS_COPY.retry}
          </button>
        </div>
      ) : account.savedRelationships === null ? (
        <p className="px-1 text-[12.5px] keep-all text-ink-sub">{SAVED_RELATIONSHIPS_COPY.loading}</p>
      ) : (
        <SavedRelationshipList rows={rows} openingId={openingId} onOpen={(id) => void open(id)} />
      )}
      {openFailed ? (
        <p className="px-1 text-[12px] keep-all leading-relaxed text-ink-faint">{SAVED_RELATIONSHIPS_COPY.failed}</p>
      ) : null}
    </section>
  );
}
