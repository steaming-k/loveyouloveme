'use client';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/common/Button';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { PageHeading, SectionLabel } from '@/components/common/primitives';
import { useAnalyticsConsent } from '@/hooks/useAnalyticsConsent';
import { GA_MEASUREMENT_ID } from '@/lib/env';
import { ROUTES } from '@/lib/routes';

/**
 * Privacy (v1.12 §28)
 *
 * 실제 데이터 동작 그대로만 설명한다 — 법률 자문을 거친 약관이 아니다(`docs/privacy-policy.md`
 * 와 같은 내용을 화면용으로 짧게 옮긴 것). 새로운 대형 Settings 페이지를 만들지 않는다 —
 * 이 화면 하나가 Privacy 안내와 Consent 변경을 함께 담당한다.
 */
export default function PrivacyPage() {
  const router = useRouter();
  const [consent, setConsent] = useAnalyticsConsent();

  const consentLabel =
    consent === 'granted' ? '동의함' : consent === 'denied' ? '필수 기능만 사용 중' : '아직 선택 안 함';

  return (
    <ScreenLayout
      header={<ScreenHeader backHref={ROUTES.home} title="Privacy" />}
      footer={<Button onClick={() => router.push(ROUTES.home)}>홈으로</Button>}
      bodyClassName="pt-2 pb-4"
    >
      <div className="flex flex-col gap-5">
        <PageHeading
          lines={['어디로 가고, 어디에 남는지']}
          caption="확인하지 않은 사실은 보장하지 않아. 우리가 실제로 하는 일만 정확히 말할게."
        />

        <Section title="브라우저에만 저장되는 것">
          진행 중인 분석(사진 선택 기록·관계 답변·상대 정보)은 이 기기의 브라우저에만
          저장돼. 계정도 서버 DB도 없어서 다른 기기에서는 볼 수 없어. 홈의 &apos;내 관찰
          데이터 삭제&apos;로 즉시 지울 수 있어.
        </Section>

        <Section title="Relationship History">
          Mirror 결과를 저장하면 그 시점 요약이 별도로 쌓여. 지금 세션을 지워도 History는
          남고, 삭제할 때 History도 함께 지울지 선택할 수 있어.
        </Section>

        <Section title="AI 분석 (실제 모드일 때만)">
          선택한 사진과 답변 일부가 관찰·설명을 만들기 위해 AI Provider로 전송될 수 있어.
          분석이 끝나면 앱 기록에는 관찰 결과와 근거만 남고 사진 원본은 저장하지 않아.
          Provider가 그 데이터를 얼마나 보관하는지는 우리가 확인하지 않았어 — 그래서 &apos;즉시
          완전히 삭제된다&apos;고 말하지 않아. Demo 모드에서는 이 전송 자체가 없어.
        </Section>

        <Section title="다가가는 힌트">
          상대가 좋아하는 것으로 네가 알려준 내용은 이 기기 안에서만 계산에 쓰여 — 외부로
          전송하지 않아. 동기화율이나 Relationship Mirror에도 들어가지 않고, History에
          통째로 저장하지도 않아. 각 항목은 언제든 지울 수 있어.
        </Section>

        <Section title="Analytics">
          로컬 기록은 항상 이 기기에만 남아. 외부 전송(GA4)은 아래에서 동의했을 때만
          시작되고, 이름·사진·관계 답변 원문 같은 건 절대 보내지 않아.
        </Section>

        <Section title="삭제에 대해">
          &apos;내 관찰 데이터 삭제&apos;는 이 기기에 저장된 것만 지워. 이미 외부로 전송된
          Analytics 이벤트나 AI Provider 로그까지 지우는 건 아니야.
        </Section>

        <section className="flex flex-col gap-2.5 rounded-[16px] border border-line bg-surface p-4">
          <SectionLabel>분석 데이터 사용 동의</SectionLabel>
          <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">
            현재 상태: <span className="font-medium text-ink">{consentLabel}</span>
            {!GA_MEASUREMENT_ID ? (
              <span className="block text-ink-faint">
                (지금은 GA4가 연결돼 있지 않아 실제로 전송되진 않아)
              </span>
            ) : null}
          </p>
          <div className="flex gap-2">
            <Button
              variant={consent === 'denied' ? 'primary' : 'secondary'}
              className="h-[46px] flex-1 text-[13px]"
              onClick={() => setConsent('denied')}
            >
              필수 기능만 사용
            </Button>
            <Button
              variant={consent === 'granted' ? 'primary' : 'secondary'}
              className="h-[46px] flex-1 text-[13px]"
              onClick={() => setConsent('granted')}
            >
              동의
            </Button>
          </div>
        </section>
      </div>
    </ScreenLayout>
  );
}

function Section({ title, children }: { title: string; children: string }) {
  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>{title}</SectionLabel>
      <p className="px-1 text-caption keep-all leading-relaxed text-ink-sub">{children}</p>
    </section>
  );
}
