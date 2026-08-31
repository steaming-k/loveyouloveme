'use client';

import { useEffect } from 'react';

import { Button } from '@/components/common/Button';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { ToggleRow } from '@/components/common/Toggle';
import { useToast } from '@/components/common/ToastProvider';
import { Lovy } from '@/components/lovy/Lovy';
import { BRAND, PRIVACY } from '@/data/copy';
import { trackEvent } from '@/lib/analytics';
import { ROUTES } from '@/lib/routes';
import { downloadShareCard } from '@/lib/shareCard';
import { useCompatibility } from '@/hooks/useAnalysis';
import { useShare } from '@/hooks/useShare';
import { useSession } from '@/state/SessionProvider';

/**
 * SH1 궁합 공유 카드
 * 사진·관계 경험·상대 정보 같은 민감한 입력은 기본으로 카드에 넣지 않는다.
 */
export default function ShareCompatibilityPage() {
  const result = useCompatibility();
  const { answers, setShareOption } = useSession();
  const { showToast } = useToast();
  const { share } = useShare('compatibility');

  useEffect(() => {
    trackEvent('share_card_open', { kind: 'compatibility' });
  }, []);

  const goodLabel = result.goodSignals[0]?.label ?? '대화';
  const frictionLabel = result.frictionSignals[0]?.label;

  const headline = frictionLabel
    ? [`${goodLabel}은 잘 통하지만`, `${frictionLabel}은 조금 다름.`]
    : [`${goodLabel}에서 비슷한 신호가 보임.`];

  const items = answers.share.includeDimensionScores
    ? result.dimensions
        .filter((dimension) => dimension.alignment !== null)
        .map((dimension) => `${dimension.label} ${dimension.alignment}/5`)
    : undefined;

  const shareText = [
    `동기화율 ${result.score ?? '?'}`,
    headline.join(' '),
    '입력된 정보 기준 비교 결과 · 연애 성공확률이 아니에요',
  ].join('\n');

  return (
    <ScreenLayout
      header={<ScreenHeader backHref={ROUTES.compatibility} title="결과 공유" />}
      footer={
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="h-[52px] flex-1"
            onClick={async () => {
              const ok = await downloadShareCard(
                {
                  variant: 'compatibility',
                  eyebrow: 'LOVE U LOVE ME · SYNC',
                  bigValue: String(result.score ?? '?'),
                  bigValueCaption: '동기화율',
                  headlineLines: headline,
                  footnote: '입력된 정보 기준 비교 결과 · 연애 성공확률이 아니에요',
                  items,
                  lovySrc: '/lovy/cool.png',
                },
                'loveuloveme-sync.png',
              );
              showToast(ok ? '카드를 이미지로 저장했어요' : '이미지를 만들지 못했어요', ok ? 'default' : 'warning');
            }}
          >
            이미지 저장
          </Button>
          <Button
            className="h-[52px] flex-1 text-[15px]"
            onClick={async () => {
              const outcome = await share({ title: `${BRAND.name} · 동기화율`, text: shareText });
              showToast(
                outcome === 'copied'
                  ? '공유 문구를 복사했어요'
                  : outcome === 'shared'
                    ? '공유했어요'
                    : outcome === 'cancelled'
                      ? '공유를 취소했어요'
                      : '이 브라우저에서는 공유를 지원하지 않아요',
                outcome === 'unsupported' ? 'warning' : 'default',
              );
            }}
          >
            공유
          </Button>
        </div>
      }
      bodyClassName="pt-2.5 pb-4"
    >
      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-[18px] rounded-hero bg-brand px-[22px] py-[26px] text-white">
          <div className="flex items-center justify-between">
            <p className="text-[10.5px] font-semibold tracking-[0.16em] opacity-85">
              LOVE U LOVE ME
            </p>
            <p className="text-[10.5px] font-semibold tracking-[0.1em] opacity-70">SYNC</p>
          </div>

          <div className="flex items-end gap-2.5">
            <p className="text-[82px] font-semibold leading-[0.95] tracking-[-4px] tnum">
              {result.score ?? '?'}
            </p>
            <p className="pb-3 text-sub opacity-85">동기화율</p>
          </div>

          <p className="text-body leading-relaxed opacity-95">
            {headline.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </p>

          {items ? (
            <ul className="flex flex-wrap gap-1.5">
              {items.map((item) => (
                <li
                  key={item}
                  className="rounded-[6px] bg-white/15 px-2.5 py-1.5 text-[11.5px] font-medium"
                >
                  {item}
                </li>
              ))}
            </ul>
          ) : null}

          {answers.share.includeTargetInfo ? (
            <p className="rounded-[10px] bg-white/12 px-3 py-2.5 text-[12px] leading-relaxed opacity-90">
              상대 성향: {result.dimensions
                .filter((dimension) => dimension.theirsValue !== null)
                .map((dimension) => `${dimension.label} ${dimension.theirsPhrase}`)
                .join(' · ')}
            </p>
          ) : null}

          <div className="flex items-center gap-2.5 border-t border-white/25 pt-3.5">
            <Lovy pose="cool" size={34} decorative />
            <p className="text-[11px] leading-relaxed opacity-80">
              입력된 정보 기준 비교 결과 · 연애 성공확률이 아니에요
            </p>
          </div>
        </section>

        <div className="flex flex-col gap-2">
          <ToggleRow
            label="상대 정보 표시"
            description="켜면 네가 입력한 상대 성향 요약이 카드에 들어가요"
            checked={answers.share.includeTargetInfo}
            onChange={(value) => setShareOption('includeTargetInfo', value)}
          />
          <ToggleRow
            label="항목별 점수 표시"
            checked={answers.share.includeDimensionScores}
            onChange={(value) => setShareOption('includeDimensionScores', value)}
          />
        </div>

        <p className="text-center text-meta leading-relaxed text-ink-muted">{PRIVACY.share}</p>
      </div>
    </ScreenLayout>
  );
}
