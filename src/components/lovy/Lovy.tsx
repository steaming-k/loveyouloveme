import Image from 'next/image';

import { LOVY_ASSETS, LOVY_VISUAL_SCALE, type LovyPose } from '@/data/lovy';
import { cn } from '@/lib/cn';

interface LovyProps {
  pose: LovyPose;
  /** 표시 폭(px). 사용 규칙은 docs/design-guide.md §2 참고 */
  size: number;
  className?: string;
  /** 안테나가 살짝 떠오르는 관찰 모션 */
  float?: boolean | 'fast';
  priority?: boolean;
  /** 장식으로만 쓰일 때(옆에 같은 내용의 텍스트가 있을 때) alt를 비운다 */
  decorative?: boolean;
}

export function Lovy({
  pose,
  size,
  className,
  float = false,
  priority = false,
  decorative = false,
}: LovyProps) {
  const asset = LOVY_ASSETS[pose];
  // 새 캐릭터 에셋은 여백이 있는 균일 캔버스라 `size`를 그대로 쓰면 몸통이 작게 보인다 —
  // 화면 코드의 size 숫자는 건드리지 않고, 여기서 포즈별 실측 배율만큼 키운다.
  const renderWidth = Math.round(size * (LOVY_VISUAL_SCALE[pose] ?? 1));
  const height = Math.round((renderWidth * asset.height) / asset.width);

  return (
    <Image
      src={asset.src}
      alt={decorative ? '' : asset.alt}
      width={renderWidth}
      height={height}
      priority={priority}
      aria-hidden={decorative || undefined}
      className={cn(
        'flex-none object-contain',
        float === true && 'animate-lovy-float',
        float === 'fast' && 'animate-lovy-float-fast',
        className,
      )}
    />
  );
}
