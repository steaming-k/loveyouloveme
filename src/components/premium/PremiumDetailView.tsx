import { NoticeBox, SectionLabel, Tag } from '@/components/common/primitives';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { PREMIUM_COPY } from '@/data/premium';
import { IS_DEMO_AI } from '@/lib/env';
import type { PremiumDetailReport } from '@/types';

/**
 * Premium Detail 렌더러 (Paywall Preview / 개발용 Preview 공용)
 *
 * 디자인 방향(§24): 금색·왕관·Countdown 없이 **Editorial Deep Report**처럼. 기존 디자인
 * 시스템과 Primary Purple을 그대로 쓴다. 'Premium이면 더 정확'하다는 인상을 주지 않는다.
 */
export function PremiumDetailView({ report }: { report: PremiumDetailReport }) {
  if (!report.available) {
    return (
      <NoticeBox>
        {report.limitations[0] ?? '지금은 이 상세를 만들 근거가 부족해.'}
      </NoticeBox>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {IS_DEMO_AI ? <NoticeBox>{PREMIUM_COPY.demoNotice}</NoticeBox> : null}

      <section className="flex flex-col gap-2.5">
        <SectionLabel>축별 상세</SectionLabel>
        <ul className="flex flex-col gap-2.5">
          {report.sections.map((section, index) => (
            <li
              key={`${section.label}-${index}`}
              className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-caption font-semibold">{section.label}</h3>
                {section.badge ? <Tag tone="neutral">{section.badge}</Tag> : null}
              </div>

              {section.mine || section.theirs ? (
                <dl className="flex flex-col gap-1.5 rounded-[10px] bg-sunken px-3 py-2.5">
                  {section.mine ? (
                    <div className="flex gap-2.5">
                      <dt className="w-[34px] flex-none text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
                        나
                      </dt>
                      <dd className="min-w-0 text-[12.5px] keep-all">{section.mine}</dd>
                    </div>
                  ) : null}
                  {section.theirs ? (
                    <div className="flex gap-2.5">
                      <dt className="w-[34px] flex-none text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
                        상대
                      </dt>
                      <dd className="min-w-0 text-[12.5px] keep-all">{section.theirs}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}

              {section.scene ? (
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
                    일어날 수 있는 상황
                  </p>
                  <p className="text-[12.5px] keep-all leading-relaxed text-ink">
                    {section.scene}
                  </p>
                </div>
              ) : null}

              {section.evidence ? (
                <p className="border-t border-line-soft pt-2 text-[12px] keep-all leading-relaxed text-[#555]">
                  {section.evidence}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {report.prompts.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionLabel>이야기해볼 질문</SectionLabel>
          <ul className="flex flex-col gap-2">
            {report.prompts.map((prompt) => (
              <li
                key={prompt}
                className="rounded-row border border-line bg-surface px-3.5 py-3 text-caption keep-all leading-relaxed"
              >
                {prompt}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {report.closing ? (
        <LovyMessage pose="chart" size={52}>
          {report.closing}
        </LovyMessage>
      ) : null}

      {report.limitations.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionLabel>이 상세의 한계</SectionLabel>
          <ul className="flex flex-col gap-1.5">
            {report.limitations.map((item) => (
              <li key={item} className="flex gap-2 text-[12px] keep-all leading-relaxed text-ink-sub">
                <span className="flex-none text-ink-faint" aria-hidden>
                  ·
                </span>
                {item}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
