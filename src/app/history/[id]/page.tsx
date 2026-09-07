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
import { OBSERVED_CATEGORY_LABEL } from '@/lib/logic/observedSignals';
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
import {
  historyAudienceOf,
  soloSnapshotPairs,
  soloSnapshotSignalText,
  SOLO_SOURCE_LABEL,
} from '@/lib/logic/soloHistory';

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
  const { entries, getEntry, deleteEntry } = useHistory();
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
  /**
   * v1.34 P4-B — Solo 관찰에는 상대도 Mirror 판정도 없다.
   *
   * ⚠️ **커플용 자리를 빈 채로 남겨두지 않는다.** 이 분기가 없으면 Solo 기록에서
   * `이때의 Mirror 판정`은 제목만 있고 목록이 비고, 관계 경험 칩은 "기록이 없어"만
   * 뜨고, 화면 상단에는 사실이 아닌 `Relationship Mirror` 라벨이 붙는다.
   * 없는 것은 자리도 만들지 않는다(§24).
   */
  const isSolo = historyAudienceOf(entry) === 'solo';

  /**
   * '그때의 나 vs 지금의 나' — **같은 audience의 최신 기록**과 비교한다.
   *
   * ⚠️ v1.35 §10 — 예전에는 `useHistory().latest`(전체 History의 마지막 항목)와
   * 비교했다. Solo 관찰이 마지막에 저장돼 있으면 커플 기록이 **Mirror 판정이 없는
   * Solo 기록과 비교**되어 전 축이 INSUFFICIENT가 되고, 화면에는 "이때와 지금 사이에
   * 크게 달라진 기준은 없었어"가 떴다 — 비교하지 않은 것을 '차이가 없다'로 말한 것이다
   * (Mixed History 실측 버그).
   */
  const sameAudience = entries.filter((item) => historyAudienceOf(item) === historyAudienceOf(entry));
  const audienceLatest = sameAudience.length > 0 ? sameAudience[sameAudience.length - 1]! : null;
  const isLatest = audienceLatest?.id === entry.id;

  const comparison =
    !isLatest && audienceLatest ? buildHistoryChanges(entry, audienceLatest) : [];
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
            caption={`${formatEntryDate(entry.createdAt)} · ${isSolo ? '나의 관찰' : 'Relationship Mirror'}`}
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

          {/*
            ⑦ 현재 기준과 비교 — 최신 기록이면 비교 대상이 없다.

            ⚠️ Solo 기록에는 붙이지 않는다. `meaningful`은 Mirror 스냅샷을 비교한
            결과인데 Solo에는 그 판정이 없어서 항상 "크게 달라진 기준은 없었어"만
            나온다 — 비교하지 않은 것을 '차이가 없다'로 말하지 않는다.
            Solo의 시간축 비교는 `/first-contact`의 WHAT CHANGED가 담당한다.
          */}
          {isSolo ? null : isLatest ? (
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

          {/*
            ② 당시 Declared Me — **커플 기록에서만** 칩으로 보여준다.

            Solo 기록은 같은 값을 아래 `SoloSnapshotSections`가 그때의 문장으로 되돌려
            보여준다. 둘을 함께 렌더하면 같은 답이 숫자 칩과 문장으로 두 번 나온다.
          */}
          {isSolo && entry.soloSnapshot ? (
            /*
              v1.35 §11 — **Solo 기록의 본문을 다 보여준다.**

              저장은 v1.34부터 했지만 상세 화면은 `soloSnapshot`을 읽지 않았다. 그래서
              Solo 기록 상세는 Declared 칩과 MBTI metadata만 남고, 그때의 기준 문장·함께
              나타난 신호·러비 관찰·쓸 수 있던 정보 종류는 어디에도 보이지 않았다
              (P4-B Audit).

              ⚠️ 여기서 **현재 answers로 다시 계산하지 않는다**(§12). 얼려둔 단계 값과
              규칙 id만 읽어서 그때의 문장을 되돌린다.
            */
            <SoloSnapshotSections
              snapshot={entry.soloSnapshot}
              /* 문구가 바뀌어 단계를 못 찾으면 그때 답한 값 자체는 남아 있다 — 칩으로 대신 보여준다 */
              fallbackChips={declaredChips(entry)}
            />
          ) : (
            <ChipSection title="이때 말한 나 (DECLARED)" items={declaredChips(entry)} />
          )}

          {/* ③ 당시 Relationship Evidence — Solo에는 관계 경험 자체가 없을 수 있다 */}
          {isSolo ? null : (
            <ChipSection title="이때의 관계 경험 (RELATIONSHIP)" items={evidenceChips(entry)} />
          )}

          {/* ④ 당시 Mirror Snapshot — Solo에는 Mirror 판정이 없다(빈 섹션을 만들지 않는다) */}
          {isSolo ? null : (
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
          )}

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

/**
 * Solo 기록의 본문 (v1.35 · §11)
 *
 *   이때 함께 나타난 신호   `pairIds` → 규칙 문장
 *   러비 관찰               그때 화면 맨 위에 보인 한 문장
 *   당시 source             그때 쓸 수 있던 정보 종류
 *
 * ⚠️ 저장된 것은 **값과 규칙 id뿐**이다. 문장은 여기서 다시 만들고, 규칙을 못 찾으면
 * 그 줄은 아예 없다 — 없는 값을 지어내지 않는다.
 */
function SoloSnapshotSections({
  snapshot,
  fallbackChips,
}: {
  snapshot: NonNullable<RelationshipHistoryEntry['soloSnapshot']>;
  fallbackChips: string[];
}) {
  const pairs = soloSnapshotPairs(snapshot.pairIds);
  const signals = snapshot.signals
    .map((signal) => ({
      axis: signal.axis,
      label: MIRROR_AXES.find((axis) => axis.key === signal.axis)?.label ?? signal.axis,
      text: soloSnapshotSignalText(signal.axis, signal.level),
    }))
    .filter((signal): signal is { axis: typeof signal.axis; label: string; text: string } =>
      signal.text !== null,
    );

  return (
    <>
      {signals.length === 0 ? (
        <ChipSection title="이때의 나의 기준" items={fallbackChips} />
      ) : (
        <section className="flex flex-col gap-2.5">
          <SectionLabel>이때의 나의 기준</SectionLabel>
          <ul className="flex flex-col gap-2">
            {signals.map((signal) => (
              <li
                key={signal.axis}
                className="flex flex-col gap-1 rounded-row border border-line bg-surface p-3.5"
              >
                <span className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
                  {signal.label}
                </span>
                <span className="text-[12.5px] keep-all leading-relaxed text-ink-sub">
                  {signal.text}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pairs.length > 0 ? (
        <section className="flex flex-col gap-2.5">
          <SectionLabel>이때 함께 나타난 신호</SectionLabel>
          <ul className="flex flex-col gap-2">
            {pairs.map((pair) => (
              <li
                key={pair.id}
                className="flex flex-col gap-1.5 rounded-row border border-line bg-surface p-3.5"
              >
                <span className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
                  {pair.labels}
                </span>
                <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">
                  {pair.observation}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {snapshot.headline ? (
        <section className="flex flex-col gap-2">
          <SectionLabel>이때 러비가 본 것</SectionLabel>
          <p className="rounded-chip bg-sunken px-3.5 py-3 text-[12.5px] keep-all leading-relaxed text-[#555]">
            {snapshot.headline}
          </p>
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <SectionLabel>당시 쓸 수 있던 정보</SectionLabel>
        <ul className="flex flex-wrap gap-1.5">
          {snapshot.sources.map((source) => (
            <MetaChip key={source} label={SOLO_SOURCE_LABEL[source]} />
          ))}
        </ul>
        {/*
          §5 — 사진은 **활동 범주만** 남긴다. 사진 원본·base64·AI 서술 원문은 저장하지
          않으므로 보여줄 것도 없다. 그래서 여기 나오는 건 장면의 이름뿐이다.
        */}
        {snapshot.observed && snapshot.observed.length > 0 ? (
          <p className="px-1 text-[11px] keep-all leading-relaxed text-ink-faint">
            이때 사진에서 보인 장면 ·{' '}
            {snapshot.observed
              .map((item) => OBSERVED_CATEGORY_LABEL[item.category])
              .join(' · ')}
          </p>
        ) : null}
      </section>
    </>
  );
}

function MetaChip({ label }: { label: string }) {
  return (
    <li className="rounded-tag border border-line bg-surface px-2.5 py-1.5 text-[12px] text-ink-sub">
      {label}
    </li>
  );
}
