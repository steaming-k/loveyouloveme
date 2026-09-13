'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import { supabaseConfig } from './config';

/**
 * v1.47 — 브라우저 Supabase client (공식 `@supabase/ssr`)
 *
 * ⚠️ 설정이 없으면 `null`을 돌려준다. 호출부는 반드시 null을 처리하고, null이면
 *    **로컬 흐름을 그대로** 탄다(Guest local-first).
 * ⚠️ UI 컴포넌트가 이 client로 `.from()`을 직접 부르지 않는다 — `lib/persistence`의
 *    repository만 쓴다.
 */
let browserClient: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient | null {
  const config = supabaseConfig();
  if (!config) return null;
  if (!browserClient) browserClient = createBrowserClient(config.url, config.anonKey);
  return browserClient;
}
