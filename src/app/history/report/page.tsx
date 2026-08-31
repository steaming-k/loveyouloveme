'use client';

import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { PageHeading, Tag } from '@/components/common/primitives';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { HISTORY_COPY, LOVY_LINES } from '@/data/copy';
import { ROUTES } from '@/lib/routes';

const TAG_TONE = {
  up: 'brand',
  down: 'neutral',
  keep: 'mint',
} as const;

/** F2 변화 리포트 — Future Concept */
export default function HistoryReportPage() {
  return (
    <ScreenLayout
      header={
        <ScreenHeader
          backHref={ROUTES.history}
          action={<Tag tone="neutral">{HISTORY_COPY.badge}</Tag>}
        />
      }
      bodyClassName="pt-1.5 pb-6"
    >
      <div className="flex flex-col gap-4">
        <PageHeading lines={['관계 3개를 지나며', '달라진 것']} />

        <ul className="flex flex-col gap-2.5">
          {HISTORY_COPY.changes.map((change) => (
            <li
              key={change.label}
              className="flex flex-col gap-2.5 rounded-row border border-line bg-surface p-[15px]"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[14.5px] font-medium">{change.label}</h3>
                <Tag tone={TAG_TONE[change.tone]}>{change.tag}</Tag>
              </div>
              <p className="text-[12.5px] keep-all leading-relaxed text-[#555]">{change.body}</p>
            </li>
          ))}
        </ul>

        <LovyMessage pose="calendar" size={66}>
          {LOVY_LINES.historyReport}
        </LovyMessage>
      </div>
    </ScreenLayout>
  );
}
