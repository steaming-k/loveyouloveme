import type { Metadata, Viewport } from 'next';

import { ToastProvider } from '@/components/common/ToastProvider';
import { AppShell } from '@/components/shell/AppShell';
import { GaScriptLoader } from '@/components/shell/GaScriptLoader';
import { MotionProvider } from '@/components/shell/MotionProvider';
import { HistoryProvider } from '@/state/HistoryProvider';
import { SessionProvider } from '@/state/SessionProvider';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: '럽유럽미 · Love U Love Me',
  description:
    '상대를 사랑하는 과정에서 나에 대해 더 깊게 이해하고, 나를 사랑하는 방법을 알아가는 서비스. 궁합은 시작점이고, 관계 속의 나를 보는 것이 핵심이다.',
  applicationName: '럽유럽미',
  other: { 'format-detection': 'telephone=no' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  // §13 — 브라우저 UI(주소창)도 페이지 배경과 같은 순백으로 맞춘다
  themeColor: '#FFFFFF',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <GaScriptLoader />
        <MotionProvider>
          <SessionProvider>
            <HistoryProvider>
              <ToastProvider>
                <AppShell>{children}</AppShell>
              </ToastProvider>
            </HistoryProvider>
          </SessionProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
