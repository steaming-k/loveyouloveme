import { NextResponse } from 'next/server';

import { ROUTES } from '@/lib/routes';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * GET /auth/callback — v1.47 이메일 로그인 링크(Magic Link)의 도착지
 *
 * 링크의 `code`를 세션 쿠키로 바꾸고 Privacy(계정 저장 안내가 있는 곳)로 돌려보낸다.
 * Supabase 설정이 없거나 code가 없으면 **아무것도 하지 않고** 같은 곳으로 보낸다.
 *
 * ⚠️ 로그인했다고 업로드하지 않는다. 기기 데이터 저장은 Privacy에서 사용자가 고른다.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const supabase = await createServerSupabase();
  if (supabase && code) {
    await supabase.auth.exchangeCodeForSession(code).catch(() => null);
  }
  return NextResponse.redirect(new URL(ROUTES.privacy, url.origin));
}
