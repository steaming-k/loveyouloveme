'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Button } from '@/components/common/Button';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { useToast } from '@/components/common/ToastProvider';
import { Lovy } from '@/components/lovy/Lovy';
import { BRAND, PRIVACY } from '@/data/copy';
import { trackEvent } from '@/lib/analytics';
import { ROUTES } from '@/lib/routes';
import { downloadShareCard } from '@/lib/shareCard';
import { useMirror } from '@/hooks/useAnalysis';
import { useShare } from '@/hooks/useShare';

/**
 * SH2 Mirror 공유 카드
 * 궁합 카드(Purple 배경 · 숫자 중심)와 다르게, 자기 발견 문장이 주인공이다.
 * 상대 정보와 개인 답변은 카드에 넣지 않는다.
 */
export default function ShareMirrorPage() {
  const router = useRouter();
  const mirror = useMirror();
  const { showToast } = useToast();
  const { share } = useShare('mirror');

  useEffect(() => {
    trackEvent('share_card_open', { kind: 'mirror' });
  }, []);

  const focus =
    mirror.insights.find((insight) => insight.key === mirror.teaser.axisKey) ?? mirror.insights[0]!;

  const headlineLines =
    focus.key === 'contact' && focus.state === 'GAP'
      ? ['나는 생각보다', '연결감을 중요하게', '보는 사람이었다.']
      : focus.state === 'CHANGE'
        ? ['나는 관계를 지나며', `${focus.label}의 기준이`, '달라진 사람이었다.']
        : [`나는 ${focus.label}에`, '생각보다 민감한', '사람이었다.'];

  const declaredWidth = `${((focus.declared - 1) / 4) * 90 + 10}%`;
  const relationshipWidth = `${((focus.relationship - 1) / 4) * 90 + 10}%`;

  const shareText = [headlineLines.join(' '), `${BRAND.name} · ${BRAND.tagline}`].join('\n');

  return (
    <ScreenLayout
      header={<ScreenHeader backHref={ROUTES.mirror} title="Mirror 공유" />}
      footer={
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="h-[52px] flex-1"
            onClick={async () => {
              const ok = await downloadShareCard(
                {
                  variant: 'mirror',
                  eyebrow: 'RELATIONSHIP MIRROR',
                  headlineLines,
                  footnote: `${BRAND.name} · ${BRAND.tagline}`,
                  lovySrc: '/lovy/wand.png',
                },
                'loveuloveme-mirror.png',
              );
              showToast(
                ok ? '카드를 이미지로 저장했어요' : '이미지를 만들지 못했어요',
                ok ? 'default' : 'warning',
              );
            }}
          >
            이미지 저장
          </Button>
          <Button
            className="h-[52px] flex-1 text-[15px]"
            onClick={async () => {
              const outcome = await share({
                title: `${BRAND.name} · Relationship Mirror`,
                text: shareText,
              });
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
        <section className="flex flex-col gap-[18px] rounded-hero border border-line bg-surface px-[22px] py-[26px]">
          <p className="text-[10.5px] font-semibold tracking-[0.14em] text-brand-pressed">
            RELATIONSHIP MIRROR
          </p>

          <h1 className="text-[23px] font-semibold leading-[1.5] tracking-[-0.6px] keep-all">
            {headlineLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>

          <div className="flex items-center gap-3.5">
            <div className="flex flex-1 flex-col gap-1.5">
              <p className="text-[10.5px] text-ink-muted">말한 나</p>
              <div className="h-[5px] rounded-sm bg-track">
                <div
                  className="h-[5px] rounded-sm bg-ink-faint"
                  style={{ width: declaredWidth }}
                />
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <p className="text-[10.5px] text-brand-pressed">관계 속 나</p>
              <div className="h-[5px] rounded-sm bg-track">
                <div className="h-[5px] rounded-sm bg-brand" style={{ width: relationshipWidth }} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 border-t border-line-soft pt-3.5">
            <Lovy pose="wand" size={34} decorative />
            <p className="text-[11px] leading-relaxed text-ink-muted">
              {BRAND.name} · {BRAND.tagline}
            </p>
          </div>
        </section>

        <p className="text-center text-meta leading-relaxed text-ink-muted">
          {PRIVACY.shareMirror}
        </p>

        <Button variant="text" onClick={() => router.push(ROUTES.mirror)}>
          Mirror로 돌아가기
        </Button>
      </div>
    </ScreenLayout>
  );
}
