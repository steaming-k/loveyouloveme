/* ⚠️ 서버 전용 모듈이다(`next/headers`). 클라이언트 컴포넌트에서 import하지 않는다. */
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import { supabaseConfig } from './config';

/**
 * v1.47 — 서버(Route Handler · Server Component)용 Supabase client
 *
 * 사용자 쿠키 세션으로만 동작한다 — RLS가 그대로 적용된다. service_role은 쓰지 않는다.
 * 설정이 없으면 `null`.
 *
 * ⚠️ Server Component에서는 쿠키를 쓸 수 없어 `setAll`이 예외를 던질 수 있다. 세션 갱신은
 *    Route Handler(`/auth/callback`)나 브라우저 client가 맡으므로 여기서는 삼킨다.
 */
export async function createServerSupabase(): Promise<SupabaseClient | null> {
  const config = supabaseConfig();
  if (!config) return null;
  const cookieStore = await cookies();
  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component 렌더 중 — 무시한다(위 주석)
        }
      },
    },
  });
}
