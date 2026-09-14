'use client';

import { useState } from 'react';

import { Button } from '@/components/common/Button';
import { useAccount, type AccountOutcome } from '@/state/AccountProvider';

/**
 * v1.47 — 이메일 로그인 코드(OTP) · 메일 링크 **인라인 폼**
 *
 * Privacy의 계정 섹션과 '이 관계 저장하기'가 같은 폼을 쓴다 — 새 auth 화면을 만들지 않는다.
 * ⚠️ 로그인만으로는 아무것도 올리지 않는다. 저장은 로그인 뒤 동의 버튼에서만 일어난다.
 */

export const ACCOUNT_REASON_COPY: Record<Exclude<AccountOutcome, { ok: true }>['reason'], string> = {
  disabled: '지금은 계정 저장을 쓸 수 없어.',
  invalid_email: '이메일 주소를 다시 확인해줘.',
  invalid_code: '코드가 맞지 않거나 시간이 지났어. 새 코드를 받아줘.',
  rate_limited: '요청이 많았어. 잠시 뒤에 다시 해줘.',
  failed: '지금은 연결이 안 돼. 이 기기에 입력한 정보는 그대로 있어.',
};

export const ACCOUNT_INPUT_CLASS =
  'h-[46px] w-full rounded-[12px] border border-line bg-sunken px-3.5 text-[13px] text-ink outline-none focus:border-line-strong';

export function InlineAuth({ intro }: { intro?: string }) {
  const account = useAccount();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (account.status !== 'signed_out') return null;

  const run = async (task: () => Promise<AccountOutcome>, success: string | null) => {
    setBusy(true);
    setNotice(null);
    try {
      const outcome = await task();
      setNotice(outcome.ok ? success : ACCOUNT_REASON_COPY[outcome.reason]);
      return outcome.ok;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      {intro ? <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">{intro}</p> : null}
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="이메일"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className={ACCOUNT_INPUT_CLASS}
      />
      {codeSent ? (
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="메일로 받은 코드"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className={ACCOUNT_INPUT_CLASS}
        />
      ) : null}
      <Button
        variant="secondary"
        className="h-[46px] text-[13px]"
        disabled={busy}
        onClick={async () => {
          if (codeSent && code.trim()) {
            await run(() => account.verifyCode(email, code), null);
            return;
          }
          const sent = await run(() => account.sendCode(email), '메일로 로그인 코드를 보냈어. 메일 속 링크를 눌러도 돼.');
          if (sent) setCodeSent(true);
        }}
      >
        {codeSent && code.trim() ? '로그인' : codeSent ? '코드 다시 받기' : '로그인 코드 받기'}
      </Button>
      {notice ? <p className="text-[12px] keep-all leading-relaxed text-ink-faint">{notice}</p> : null}
    </div>
  );
}
