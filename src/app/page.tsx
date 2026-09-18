'use client';

import { useRouter } from 'next/navigation';

import { LovySequence } from '@/components/lovy/LovySequence';
import { BRAND } from '@/data/copy';
import { ROUTES } from '@/lib/routes';
import { useSession } from '@/state/SessionProvider';

/**
 * Splash (S01) — **editorial cover + brand poster + 관찰의 시작** (v1.48)
 *
 * ══ 무엇을 고쳤나 ═══════════════════════════════════════════════════════════
 *
 * 예전 구조는 화면 정중앙의 세로 stack 하나였다:
 *
 * ```
 *          LOVE RESEARCH : EARTH
 *                 [러비]
 *                 럽유럽미
 *           ● 인간의 사랑을 관찰 중
 * ```
 *
 * 이 배치의 문제는 **모든 것이 가운데 정렬**이라는 점이었다 — 캐릭터도, 이름도,
 * 설명도 한 축에 쌓이면 그건 브랜드 표지가 아니라 마스코트 소개 카드가 된다.
 *
 * ══ 지금 구조 ═══════════════════════════════════════════════════════════════
 *
 * ```
 * ──────────── LOVE RESEARCH : EARTH        ← 상단 편집 marker + rule (좌측)
 *
 *                  ╭─ 러비 ─╮               ← 가로 가운데
 *                  ╰────────╯
 *                   럽유럽미                  ← 가운데 · 화면에서 가장 강한 타이포
 *                     ───
 *              인간의 사랑을 관찰 중
 *
 * ──────────────────────────────────────    ← 하단 서명 rule
 *   화면을 탭하면 관찰이 시작돼                ← 좌측
 * ```
 *
 * 러비와 브랜드 서명이 같은 세로축에 선다. **좌측에 남는 것은 상단 marker와 하단
 * 서명 줄 두 개**이고, 그 둘이 편집면의 위아래를 잡아준다 — 가운데 덩어리가
 * 떠 있지 않게 하는 것이 그 선들의 역할이다.
 *
 * ⚠️ **움직이는 것은 `LovySequence` 하나뿐이다**(§20 — 의미 있는 motion만).
 * ⚠️ **화면 전체 tap은 그대로다.** 라우팅 조건(`completed.profile`)도 그대로다.
 * ⚠️ 우주·별·행성을 그리지 않는다. 이 화면에 남은 선은 상단 marker rule과 하단 서명
 * rule 둘뿐이고, 둘 다 **편집면을 여닫는 선**이지 장식이 아니다.
 */
export default function SplashPage() {
  const router = useRouter();
  const { answers, hydrated } = useSession();

  // 이미 관찰 기록이 있는 사용자는 홈으로 보낸다.
  const destination = hydrated && answers.completed.profile ? ROUTES.home : ROUTES.onboarding;

  return (
    <div className="flex h-full flex-col">
      <button
        type="button"
        onClick={() => router.push(destination)}
        aria-label="관찰 시작하기"
        className="flex flex-1 flex-col px-gutter pt-[58px] pb-[10px] text-left"
      >
        {/* ── 상단 편집 marker ─────────────────────────────────────────────
            rule이 왼쪽 여백에서 시작해 라벨로 이어진다. 라벨을 가운데 띄우지
            않는 것만으로 '표지'와 '캐릭터 소개'가 갈린다. */}
        <span className="flex items-center gap-2.5">
          <span className="h-px w-7 flex-none bg-rule-ink" aria-hidden />
          <span className="text-[10px] font-semibold tracking-[0.26em] text-ink-muted">
            {BRAND.splashLabel}
          </span>
        </span>

        {/* 장면 + 서명을 한 덩어리로 묶어 남은 높이 안에서 시각 중앙에 둔다 —
            상단 marker와 하단 서명 줄은 표지의 위/아래 끝에 고정된다. */}
        <span className="flex flex-1 flex-col justify-center">
          {/* ── 관찰 장면 ──────────────────────────────────────────────────
              러비를 가로 가운데에 둔다.

              ⚠️ 왼쪽에 있던 `관찰 마크 + 연결선 + 점`은 없다. 마크를 빼자 선과 점만
              남았고 그건 '관찰의 자국'이 아니라 지우다 만 흔적으로 읽혔다 — 빈 자리를
              채우려고 선이나 점을 다시 두지 않는다. */}
          <span className="flex items-center justify-center">
            <LovySequence size={178} priority />
          </span>

          {/* ── 브랜드 서명 ────────────────────────────────────────────────
              화면에서 가장 큰 활자. 예전 30px에서 올렸고, 아래에 짧은 rule을
              붙여 이름이 '제목'으로 읽히게 한다.

              `items-center`로 서비스명 · rule · 서명 줄을 러비와 같은 세로축에
              세운다. 각 자식이 내용 폭만큼만 차지하므로 부모의 `text-left`는
              이 블록의 가로 위치에 영향을 주지 않는다. */}
          <span className="mt-[46px] flex flex-col items-center gap-3">
            <span className="text-[40px] leading-[1.1] font-bold tracking-[-1.6px] text-ink">
              {BRAND.name}
            </span>
            <span className="h-[2px] w-9 bg-brand" aria-hidden />
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 animate-lovy-pulse rounded-full bg-brand" aria-hidden />
              <span className="text-sub text-ink-sub">{BRAND.splashCopy}</span>
            </span>
          </span>
        </span>
      </button>

      {/* 하단 서명 줄 — 표지의 밑단. rule 하나로 화면을 닫는다 */}
      <div className="flex-none px-gutter pb-[30px]">
        <div className="field-rule mb-3" />
        <p className="text-meta text-ink-faint">화면을 탭하면 관찰이 시작돼</p>
      </div>
    </div>
  );
}
