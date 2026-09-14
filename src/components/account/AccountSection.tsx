'use client';

import { useState } from 'react';

import { Button } from '@/components/common/Button';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { SectionLabel } from '@/components/common/primitives';
import type { MigrationReport } from '@/lib/persistence/localMigration';
import { MIGRATION_CONSENT_COPY } from '@/lib/persistence/types';
import { useAccount, type AccountOutcome } from '@/state/AccountProvider';

/**
 * v1.47 — 계정에 저장(선택). Privacy 화면 안의 작은 섹션 하나다 — 새 화면 · 내비게이션을 만들지 않는다.
 *
 * ⚠️ Supabase 설정이 없으면 **아무것도 그리지 않는다**(Guest 화면 불변).
 * ⚠️ 로그인해도 자동으로 올리지 않는다. `이 기기에 입력한 정보를 계정에 저장할까?`에 사용자가
 *    답해야 migration이 돈다.
 */

const REASON_COPY: Record<Exclude<AccountOutcome, { ok: true }>['reason'], string> = {
  disabled: '지금은 계정 저장을 쓸 수 없어.',
  invalid_email: '이메일 주소를 다시 확인해줘.',
  invalid_code: '코드가 맞지 않거나 시간이 지났어. 새 코드를 받아줘.',
  rate_limited: '요청이 많았어. 잠시 뒤에 다시 해줘.',
  failed: '지금은 연결이 안 돼. 이 기기에 입력한 정보는 그대로 있어.',
};

function migrationCopy(report: MigrationReport): string {
  switch (report.status) {
    case 'completed':
      return '계정에 저장했어. 다시 저장해도 같은 내용이 두 번 쌓이지 않아.';
    case 'completed_with_conflicts':
      return '계정에 저장했어. 계정에 이미 다른 내용이 있던 항목은 바꾸지 않았어.';
    case 'completed_with_rejections':
      return `계정에 저장했어. 너무 크거나 사진·파일 같은 내용이 섞인 항목 ${report.rejected.length}개는 올리지 않았어 — 이 기기에는 그대로 있어.`;
    case 'nothing_to_migrate':
      return '아직 계정에 옮길 정보가 없어.';
    case 'partial':
      return '연결이 끊겨서 일부만 저장됐어. 다시 저장하면 남은 것만 이어서 올라가.';
    case 'offline':
    case 'failed':
      return '지금은 저장하지 못했어. 이 기기에 입력한 정보는 그대로 있어.';
    case 'unauthorized':
      return '로그인이 풀렸어. 다시 로그인한 뒤 저장해줘.';
    case 'consent_required':
      return MIGRATION_CONSENT_COPY.question;
  }
}

const INPUT_CLASS =
  'h-[46px] w-full rounded-[12px] border border-line bg-sunken px-3.5 text-[13px] text-ink outline-none focus:border-line-strong';

export function AccountSection() {
  const account = useAccount();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [consentDismissed, setConsentDismissed] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (account.status === 'disabled') return null;

  const run = async (task: () => Promise<AccountOutcome>, success: string | null) => {
    setBusy(true);
    setNotice(null);
    try {
      const outcome = await task();
      setNotice(outcome.ok ? success : REASON_COPY[outcome.reason]);
      return outcome.ok;
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-2.5 rounded-[16px] border border-line bg-surface p-4">
      <SectionLabel>계정에 저장 (선택)</SectionLabel>

      {account.status === 'loading' ? (
        <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">계정 상태를 확인하고 있어.</p>
      ) : null}

      {account.status === 'signed_out' ? (
        <>
          <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">
            로그인하지 않아도 모든 기능을 그대로 쓸 수 있어. 계정에 저장하면 관계 정보가 클라우드에 남아서
            다른 기기에서도 이어볼 수 있어.
          </p>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="이메일"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={INPUT_CLASS}
          />
          {codeSent ? (
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="메일로 받은 코드"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className={INPUT_CLASS}
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
        </>
      ) : null}

      {account.status === 'signed_in' ? (
        <>
          <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">
            {account.email ? `${account.email}로 로그인돼 있어.` : '로그인돼 있어.'} 이 기기에 입력한 정보는 그대로
            남아 있어.
          </p>

          {account.hasDeviceData && !account.migrationReport && !consentDismissed ? (
            <div className="flex flex-col gap-2 rounded-chip bg-sunken px-3.5 py-3">
              <p className="text-[13px] font-medium keep-all text-ink">{MIGRATION_CONSENT_COPY.question}</p>
              <p className="text-[12px] keep-all leading-relaxed text-ink-sub">{MIGRATION_CONSENT_COPY.detail}</p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="h-[42px] flex-1 text-[13px]"
                  disabled={account.migrationRunning}
                  onClick={() => setConsentDismissed(true)}
                >
                  {MIGRATION_CONSENT_COPY.later}
                </Button>
                <Button
                  className="h-[42px] flex-1 text-[13px]"
                  disabled={account.migrationRunning}
                  onClick={() => void account.saveDeviceData()}
                >
                  {account.migrationRunning ? '저장하는 중' : MIGRATION_CONSENT_COPY.confirm}
                </Button>
              </div>
            </div>
          ) : null}

          {account.migrationReport ? (
            <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">{migrationCopy(account.migrationReport)}</p>
          ) : null}

          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="h-[42px] flex-1 text-[13px]"
              disabled={busy}
              onClick={() => void account.signOut()}
            >
              로그아웃
            </Button>
            <Button
              variant="secondary"
              className="h-[42px] flex-1 text-[13px]"
              disabled={busy}
              onClick={() => setDeleteOpen(true)}
            >
              계정 저장분 삭제
            </Button>
          </div>
        </>
      ) : null}

      {notice ? <p className="text-[12px] keep-all leading-relaxed text-ink-faint">{notice}</p> : null}

      <ConfirmModal
        open={deleteOpen}
        title="계정에 저장한 정보를 지울까?"
        description="계정에 올린 내 답변, 상대 정보, 적어둔 장면, 분석 기록을 지워. 이 기기에 있는 정보는 지우지 않아. 되돌릴 수 없어."
        confirmLabel="계정 저장분 삭제"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          setDeleteOpen(false);
          void run(() => account.deleteCloudData(), '계정에 저장한 정보를 지웠어.');
        }}
      />
    </section>
  );
}
