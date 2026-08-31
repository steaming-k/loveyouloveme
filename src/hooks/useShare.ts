'use client';

import { useCallback, useState } from 'react';

import { trackEvent } from '@/lib/analytics';

export type ShareOutcome = 'shared' | 'copied' | 'unsupported' | 'cancelled';

/**
 * Web Share API — feature detection 후 사용하고, 없으면 클립보드 복사로 대체한다.
 * 민감한 입력 데이터(사진·관계 경험·상대 정보)는 호출하는 쪽에서 제외한 텍스트만 넘긴다.
 */
export function useShare(kind: 'compatibility' | 'mirror') {
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);

  const share = useCallback(
    async (payload: { title: string; text: string }): Promise<ShareOutcome> => {
      const result = await (async (): Promise<ShareOutcome> => {
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
          try {
            await navigator.share({ title: payload.title, text: payload.text });
            return 'shared';
          } catch {
            // 사용자가 시트를 닫은 경우도 여기로 온다.
            return 'cancelled';
          }
        }

        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          try {
            await navigator.clipboard.writeText(`${payload.title}\n${payload.text}`);
            return 'copied';
          } catch {
            return 'unsupported';
          }
        }

        return 'unsupported';
      })();

      setOutcome(result);
      trackEvent('share_card_action', { kind, result });
      return result;
    },
    [kind],
  );

  return { share, outcome };
}
