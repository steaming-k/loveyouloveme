import type { Metadata, Viewport } from 'next';

import { ToastProvider } from '@/components/common/ToastProvider';
import { AppShell } from '@/components/shell/AppShell';
import { MotionProvider } from '@/components/shell/MotionProvider';
import { SessionProvider } from '@/state/SessionProvider';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: '럽유럽미 · Love U Love Me',
  description:
    '상대를 사랑하는 과정에서 나에 대해 더 깊게 이해하고, 나를 사랑하는 방법을 알아가는 서비스. 궁합은 시작점이고, 관계 속의 나를 보는 것이 핵심입니다.',
  applicationName: '럽유럽미',
  other: { 'format-detection': 'telephone=no' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#FAFAF7',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <MotionProvider>
          <SessionProvider>
            <ToastProvider>
              <AppShell>{children}</AppShell>
            </ToastProvider>
          </SessionProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
