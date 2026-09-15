'use client';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/common/Button';
import { BottomSheet } from '@/components/common/BottomSheet';
import { FillDataRow } from '@/components/common/StateScreens';
import { trackEvent } from '@/lib/analytics';
import { formatBirthSummary } from '@/lib/logic/birth';
import { ROUTES } from '@/lib/routes';
import { useSession } from '@/state/SessionProvider';

/**
 * 결과 수정 허브 — **"분석 수정은 어떻게 하는 건지?"에 대한 답** (260915 UT P0-2 §11)
 *
 * ══ 왜 만들었나 ═══════════════════════════════════════════════════════════
 *
 * 이 시트 자체는 원래 `/profile/result`에만 있었다. 그래서 **분석 결과 화면에서는
 * 고칠 방법이 보이지 않았다** — Compatibility에는 `상대 정보 수정` 한 줄만 있었고,
 * 내 답변이나 관계 경험을 고치려면 '나' 탭 → 프로필 → 수정까지 스스로 찾아가야 했다.
 * UT 참가자의 첫 질문이 정확히 그것이었다.
 *
 * 그래서 시트를 컴포넌트로 빼고 결과 화면 세 곳이 같은 것을 연다. **새 Route도, 새
 * 데이터 모델도 만들지 않는다** — 목적지는 전부 이미 있던 편집 경로 그대로다.
 *
 * ⚠️ 순서는 '사용자가 방금 본 것'에서 가까운 쪽부터다. Compatibility에서 열면
 * 상대 정보가 맨 위에 오고, 프로필에서 열면 내 쪽이 먼저다.
 *
 * ⚠️ 여기서 아무것도 다시 계산하지 않는다. 편집 화면으로 보내기만 하고, 재계산은
 * 각 입력 화면과 기존 분석 파이프라인이 원래 하던 대로 한다.
 */

export type ResultEditOrigin = 'compatibility' | 'mirror' | 'profile';

/** 편집 목적지 — 전부 기존 Route다 */
type EditSection = 'target' | 'photos' | 'observed' | 'declared' | 'experience' | 'birth';

export function ResultEditSheet({
  open,
  onClose,
  origin,
  /** `/profile/result`처럼 편집 후 돌아올 주소를 붙여야 하는 화면이 넘긴다 */
  hrefOf = (href) => href,
}: {
  open: boolean;
  onClose: () => void;
  origin: ResultEditOrigin;
  hrefOf?: (href: string) => string;
}) {
  const router = useRouter();
  const { answers } = useSession();

  const go = (section: EditSection, href: string) => {
    trackEvent('result_edit_entry', { section, origin });
    router.push(href);
  };

  const rows: { section: EditSection; label: string; href: string }[] = [
    { section: 'target', label: '상대 정보 고치기', href: ROUTES.target },
    { section: 'declared', label: '내 관계 성향 답변 고치기', href: hrefOf(ROUTES.declared(1)) },
    { section: 'experience', label: '관계 경험 답변 고치기', href: hrefOf(ROUTES.past(1)) },
    { section: 'photos', label: '사진 추가·수정', href: hrefOf(ROUTES.photos) },
    { section: 'observed', label: '사진 관찰 다시 보기', href: hrefOf(ROUTES.observed) },
    {
      section: 'birth',
      label: `생년월일 · ${formatBirthSummary(answers.birthProfile)}`,
      href: ROUTES.lensBirth,
    },
  ];

  /* 방금 본 화면에서 가까운 것부터 — 상대를 보던 사람에게 '사진 수정'을 먼저 묻지 않는다 */
  const ordered =
    origin === 'profile'
      ? [...rows.filter((row) => row.section !== 'target'), ...rows.filter((row) => row.section === 'target')]
      : rows;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="어디를 고칠까?"
      description="상대 정보·관계 성향·관계 경험을 바꾸면 동기화율과 Relationship Mirror도 함께 다시 계산돼. 사진을 바꾸면 사진 관찰만 다시 분석돼."
    >
      <div className="flex flex-col gap-2">
        {ordered.map((row) => (
          <FillDataRow
            key={row.section}
            label={row.label}
            actionLabel="이동"
            onClick={() => go(row.section, row.href)}
          />
        ))}
        <Button variant="secondary" className="mt-1.5" onClick={onClose}>
          그대로 둘게
        </Button>
      </div>
    </BottomSheet>
  );
}
