'use client';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/common/Button';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { NoticeBox, PageHeading } from '@/components/common/primitives';
import { DimensionAccordion } from '@/components/compatibility/DimensionAccordion';
import { PRIVACY } from '@/data/copy';
import { ROUTES } from '@/lib/routes';
import { useCompatibility } from '@/hooks/useAnalysis';

/**
 * S22 Why — 점수의 근거
 * 항목별로 나 / 상대 / 근거 / 상황을 펼쳐볼 수 있게 한다.
 * 차이가 가장 큰 항목을 기본으로 열어두어 Evidence를 찾기 쉽게 만든다.
 */
export default function CompatibilityWhyPage() {
  const router = useRouter();
  const result = useCompatibility();

  const defaultOpenKey = result.frictionSignals[0]?.key ?? result.dimensions[0]?.key;

  return (
    <ScreenLayout
      header={<ScreenHeader backHref={ROUTES.compatibility} title="궁합 근거" />}
      footer={
        <Button onClick={() => router.push(ROUTES.goodSignal)}>잘 맞는 신호 보기</Button>
      }
      bodyClassName="pt-1.5 pb-4"
    >
      <div className="flex flex-col gap-4">
        <PageHeading
          lines={[`${result.score ?? '?'}에는 이유가 있어.`]}
          caption={`${result.totalCount}개 항목의 신호를 비교했어. 항목을 누르면 근거를 볼 수 있어.`}
          size="question"
        />

        <DimensionAccordion dimensions={result.dimensions} defaultOpenKey={defaultOpenKey} />

        <NoticeBox>{PRIVACY.unknownExcluded}</NoticeBox>
      </div>
    </ScreenLayout>
  );
}
