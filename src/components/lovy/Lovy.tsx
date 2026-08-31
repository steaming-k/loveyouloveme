import Image from 'next/image';

import { LOVY_ASSETS, type LovyPose } from '@/data/lovy';
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
  const height = Math.round((size * asset.height) / asset.width);

  return (
    <Image
      src={asset.src}
      alt={decorative ? '' : asset.alt}
      width={size}
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
