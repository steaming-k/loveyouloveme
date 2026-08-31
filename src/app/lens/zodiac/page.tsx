import { redirect } from 'next/navigation';

import { ROUTES } from '@/lib/routes';

/**
 * v1.3 Route 호환 — `/lens/zodiac` → `/lens/astrology`
 *
 * v1.4에서 Astrology Lens가 '별자리 직접 선택'에서 '생년월일 기반 계산'으로 바뀌면서 Route
 * 이름도 `astrology`로 정리했다. 기존 링크·북마크·프로토타입 패널 참조가 깨지지 않도록
 * 이 경로는 남겨두고 리다이렉트만 한다.
 */
export default function ZodiacLensRedirect() {
  redirect(ROUTES.lensAstrology);
}
