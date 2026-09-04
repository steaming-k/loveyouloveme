'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/common/Button';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { HydrationGate } from '@/components/common/HydrationGate';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { useToast } from '@/components/common/ToastProvider';
import { Lines, PageHeading, SectionLabel, Tag } from '@/components/common/primitives';
import { HistoryChangeRow } from '@/components/history/HistoryChangeRow';
import { Lovy } from '@/components/lovy/Lovy';
import { MIRROR_AXES } from '@/data/axes';
import { HISTORY_COPY } from '@/data/copy';
import {
  AFFECTION_LABEL,
  CONFLICT_LABEL,
  HARDEST_LABEL,
  HOBBY_LABEL,
  PAST_FACTOR_LABEL,
} from '@/data/labels';
import { trackEvent } from '@/lib/analytics';
import { formatEntryDate } from '@/lib/historyFormat';
import { buildHistoryChanges } from '@/lib/logic/history';
import { ROUTES } from '@/lib/routes';
import { useHistory } from '@/state/HistoryProvider';
import type { RelationshipHistoryEntry } from '@/types';

/**
 * F1-a History Detail (§13/§14) — '그때의 나 vs 지금의 나'
 *
 * 이 화면의 주체는 상대가 아니라 나다. 상대 이름·사진·자유서술 원문은 애초에 저장하지 않으므로
 * 보여줄 것도 없다. MBTI는 당시 Snapshot metadata로만 표시하고 변화를 해석하지 않는다(§4/§25).
 */
export default function HistoryEntryPage() {
  return (
    <HydrationGate>
      <HistoryEntryView />
    </HydrationGate>
  );
}

function HistoryEntryView() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { showToast } = useToast();
  const { entries, getEntry, deleteEntry, latest } = useHistory();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const id = typeof params.id === 'string' ? params.id : '';
  const entry = getEntry(id);

  useEffect(() => {
    if (entry) trackEvent('relationship_history_entry_view', { entry_id: entry.id });
  }, [entry]);

  if (!entry) {
    return (
      <ScreenLayout
        header={<ScreenHeader backHref={ROUTES.history} title="관찰 기록" />}
        footer={<Button onClick={() => router.replace(ROUTES.history)}>기록 목록으로</Button>}
      >
        <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
          <Lovy pose="question" size={110} decorative />
          <p className="text-sub keep-all text-ink-sub">
            이 관찰 기록은 없어. 삭제됐을 수도 있어.
          </p>
        </div>
      </ScreenLayout>
    );
  }

  const insight = entry.coreInsight.userCorrection?.trim() || entry.coreInsight.original;
  const isLatest = latest?.id === entry.id;

  // '그때의 나 vs 지금의 나' — 최신 기록과 비교한다. 자기 자신이 최신이면 비교하지 않는다.
  const comparison = !isLatest && latest ? buildHistoryChanges(entry, latest) : [];
  const meaningful = comparison.filter(
    (change) => change.state === 'SHIFT' || change.state === 'NEW',
  );

  return (
    <>
      <ScreenLayout
        header={
          <ScreenHeader
            backHref={ROUTES.history}
            action={<Tag tone="neutral">{formatEntryDate(entry.createdAt)}</Tag>}
          />
        }
        footer={
          <Button variant="secondary" onClick={() => router.push(ROUTES.history)}>
            기록 목록으로
          </Button>
        }
        bodyClassName="pt-1.5 pb-4"
      >
        <div className="flex flex-col gap-5">
          <PageHeading
            lines={['이때의 관찰']}
            caption={`${formatEntryDate(entry.createdAt)} · Relationship Mirror`}
          />

          {/* ① 당시 Core Insight */}
          <section className="flex flex-col gap-2.5 rounded-card bg-brand-tint px-[18px] py-5">
            <p className="text-[10.5px] font-semibold tracking-[0.1em] text-brand-pressed">
              CORE INSIGHT
            </p>
            <p className="text-[17px] font-semibold leading-[1.5] tracking-[-0.4px] keep-all text-brand-ink">
              {insight || '핵심 관찰 문장이 없어'}
            </p>
            {entry.coreInsight.userCorrection ? (
              <p className="text-[11.5px] text-brand-pressed">네가 고친 문장이야.</p>
            ) : null}
          </section>

          {/* ⑦ 현재 기준과 비교 — 최신 기록이면 비교 대상이 없다 */}
          {isLatest ? (
            <p className="rounded-chip bg-sunken px-3.5 py-3 text-meta keep-all leading-relaxed text-ink-sub">
              <Lines lines={HISTORY_COPY.entryLatest} />
            </p>
          ) : meaningful.length > 0 ? (
            <section className="flex flex-col gap-2.5">
              <SectionLabel>이때와 지금의 차이</SectionLabel>
              <ul className="flex flex-col gap-2.5">
                {meaningful.map((change) => (
                  <HistoryChangeRow key={change.axis} change={change} />
                ))}
              </ul>
            </section>
          ) : (
            <p className="rounded-chip bg-sunken px-3.5 py-3 text-meta keep-all leading-relaxed text-ink-sub">
              이때와 지금 사이에 크게 달라진 기준은 없었어.
            </p>
          )}

          {/* ② 당시 Declared Me */}
          <ChipSection title="이때 말한 나 (DECLARED)" items={declaredChips(entry)} />

          {/* ③ 당시 Relationship Evidence */}
          <ChipSection title="이때의 관계 경험 (RELATIONSHIP)" items={evidenceChips(entry)} />

          {/* ④ 당시 Mirror Snapshot */}
          <section className="flex flex-col gap-2.5">
            <SectionLabel>이때의 Mirror 판정</SectionLabel>
            <ul className="flex flex-col gap-2">
              {entry.mirrorSnapshot.insights.map((snapshot) => (
                <li
                  key={snapshot.axis}
                  className="flex flex-col gap-1.5 rounded-row border border-line bg-surface p-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-caption font-medium">
                      {MIRROR_AXES.find((axis) => axis.key === snapshot.axis)?.label ??
                        snapshot.axis}
                    </span>
                    <Tag tone={snapshot.state === 'GAP' ? 'friction' : snapshot.state === 'MATCH' ? 'mint' : 'brand'}>
                      {snapshot.state}
                    </Tag>
                  </div>
                  <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">
                    {snapshot.relationshipSignal}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {/* ⑥ 당시 Profile Metadata — MBTI는 참고 정보로만 */}
          <section className="flex flex-col gap-2">
            <SectionLabel>이때의 참고 정보</SectionLabel>
            <ul className="flex flex-wrap gap-1.5">
              <MetaChip label={`관측 정보 ${coverageLabel(entry.evidenceCoverage)}`} />
              {entry.profileSnapshot.mbti ? (
                <MetaChip label={`당시 MBTI · ${entry.profileSnapshot.mbti}`} />
              ) : null}
            </ul>
            <p className="px-1 text-[11px] keep-all leading-relaxed text-ink-faint">
              MBTI는 당시 참고 정보로만 남겨둔 값이야. 유형이 달라졌다고 성격이 변했다고 보진 않아.
            </p>
          </section>

          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="flex min-h-11 items-center justify-center text-meta text-ink-faint"
          >
            이 관찰 기록 삭제
          </button>
        </div>
      </ScreenLayout>

      <ConfirmModal
        open={deleteOpen}
        title={HISTORY_COPY.deleteEntryTitle}
        description={HISTORY_COPY.deleteEntryBody}
        confirmLabel="삭제"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          trackEvent('relationship_history_entry_delete', { entry_id: entry.id });
          deleteEntry(entry.id);
          setDeleteOpen(false);
          showToast('관찰 기록을 삭제했어');
          router.replace(entries.length > 1 ? ROUTES.history : ROUTES.home);
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ 보조 */

function coverageLabel(coverage: RelationshipHistoryEntry['evidenceCoverage']): string {
  return coverage === 'high' ? '충분' : coverage === 'medium' ? '보통' : '부족';
}

function declaredChips(entry: RelationshipHistoryEntry): string[] {
  const declared = entry.declaredSnapshot;
  const items: string[] = [];
  if (declared.contact !== null) items.push(`연락 ${declared.contact}/5`);
  if (declared.conflict !== null) items.push(CONFLICT_LABEL[declared.conflict]);
  if (declared.alone !== null) items.push(`개인 시간 ${declared.alone}/5`);
  if (declared.affection !== null) items.push(AFFECTION_LABEL[declared.affection]);
  if (declared.hobby !== null) items.push(`취미 ${HOBBY_LABEL[declared.hobby]}`);
  return items;
}

function evidenceChips(entry: RelationshipHistoryEntry): string[] {
  const evidence = entry.relationshipEvidence;
  const items = evidence.important.map((factor) => PAST_FACTOR_LABEL[factor]);
  if (evidence.hardest) items.push(HARDEST_LABEL[evidence.hardest]);
  return items;
}

function ChipSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>{title}</SectionLabel>
      {items.length > 0 ? (
        <ul className="flex flex-wrap gap-[5px]">
          {items.map((item, index) => (
            <li
              key={`${item}-${index}`}
              className="rounded-tag bg-sunken px-2.5 py-1.5 text-[12.5px] keep-all text-[#555]"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-1 text-meta text-ink-muted">기록이 없어</p>
      )}
    </section>
  );
}

function MetaChip({ label }: { label: string }) {
  return (
    <li className="rounded-tag border border-line bg-surface px-2.5 py-1.5 text-[12px] text-ink-sub">
      {label}
    </li>
  );
}
