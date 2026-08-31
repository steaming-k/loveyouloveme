'use client';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/common/Button';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { Lovy } from '@/components/lovy/Lovy';
import { ROUTES } from '@/lib/routes';

export default function NotFound() {
  const router = useRouter();

  return (
    <ScreenLayout
      centered
      footer={<Button onClick={() => router.push(ROUTES.home)}>홈으로 가기</Button>}
    >
      <div className="flex flex-col items-center gap-4 pb-10 text-center">
        <Lovy pose="question" size={120} decorative />
        <h1 className="text-section keep-all">이 좌표에는 아무것도 없네.</h1>
        <p className="text-sub leading-relaxed text-ink-sub">
          관측 범위를 벗어난 것 같아. 홈으로 돌아가서 다시 시작해보자.
        </p>
      </div>
    </ScreenLayout>
  );
}
