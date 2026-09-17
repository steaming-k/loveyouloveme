'use client';

import { useState } from 'react';

import { InlineAuth } from '@/components/account/InlineAuth';
import { Button } from '@/components/common/Button';
import { cn } from '@/lib/cn';
import { SAVE_RELATIONSHIP_COPY, saveRelationshipStage } from '@/lib/persistence/saveRelationshipFlow';
import { hasTargetContext } from '@/lib/persistence/targetRegistry';
import { useAccount } from '@/state/AccountProvider';
import { useSession } from '@/state/SessionProvider';

/**
 * v1.47 Integration — **'이 관계 저장하기'** (결과를 본 뒤에만)
 *
 * ```
 * offer → (Guest) 인라인 로그인 → 동의 질문 → 저장 → 저장됨
 *       → (로그인됨) 동의 질문 → 저장 → 저장됨
 * ```
 *
 * ⚠️ 단계 판정은 `saveRelationshipStage` 한 곳이다. 이 컴포넌트는 그린다.
 * ⚠️ Supabase 설정이 없으면 아무것도 그리지 않는다(Guest 화면 불변).
 * ⚠️ 로그인만으로 업로드하지 않는다 — `saveActiveRelationship()`은 동의 버튼에서만 부른다.
 */
export function SaveRelationshipCard({ hasValue, className }: { hasValue: boolean; className?: string }) {
  const account = useAccount();
  const { answers } = useSession();
  const [intent, setIntent] = useState<'none' | 'requested'>('none');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const stage = saveRelationshipStage({
    accountStatus: account.status,
    hasValue,
    hasTargetContext: hasTargetContext(answers),
    linked: account.activeRelationshipSaved,
    intent,
    saving,
    failed,
  });
  if (stage === 'hidden') return null;

  const later = () => {
    setIntent('none');
    setFailed(false);
  };

  return (
    <section className={cn('flex flex-col gap-2.5 rounded-[16px] border border-line bg-surface p-4', className)}>
      {stage === 'saved' ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">{SAVE_RELATIONSHIP_COPY.savedDetail}</p>
          <span className="flex-none rounded-tag bg-sunken px-2.5 py-1 text-[11.5px] font-semibold text-ink-sub">
            {SAVE_RELATIONSHIP_COPY.saved}
          </span>
        </div>
      ) : (
        <>
          <p className="text-[14px] font-semibold keep-all text-ink">{SAVE_RELATIONSHIP_COPY.offerTitle}</p>
          <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">{SAVE_RELATIONSHIP_COPY.offerDetail}</p>
        </>
      )}

      {stage === 'offer' ? (
        <Button variant="secondary" className="h-[44px] text-[13px]" onClick={() => setIntent('requested')}>
          {SAVE_RELATIONSHIP_COPY.cta}
        </Button>
      ) : null}

      {stage === 'auth' ? (
        <>
          <InlineAuth intro={SAVE_RELATIONSHIP_COPY.authLead} />
          <Button variant="text" className="text-[12.5px]" onClick={later}>
            {SAVE_RELATIONSHIP_COPY.later}
          </Button>
        </>
      ) : null}

      {stage === 'consent' || stage === 'saving' ? (
        <div className="flex flex-col gap-2 rounded-chip bg-sunken px-3.5 py-3">
          <p className="text-[13px] font-medium keep-all text-ink">{SAVE_RELATIONSHIP_COPY.consentQuestion}</p>
          <p className="text-[12px] keep-all leading-relaxed text-ink-sub">{SAVE_RELATIONSHIP_COPY.consentDetail}</p>
          <div className="flex gap-2">
            <Button variant="secondary" className="h-[42px] flex-1 text-[13px]" disabled={saving} onClick={later}>
              {SAVE_RELATIONSHIP_COPY.later}
            </Button>
            <Button
              className="h-[42px] flex-1 text-[13px]"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                setFailed(false);
                const outcome = await account.saveActiveRelationship();
                setSaving(false);
                if (!outcome.ok) setFailed(true);
              }}
            >
              {saving ? SAVE_RELATIONSHIP_COPY.saving : SAVE_RELATIONSHIP_COPY.consentConfirm}
            </Button>
          </div>
        </div>
      ) : null}

      {stage === 'failed' ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] keep-all leading-relaxed text-ink-faint">{SAVE_RELATIONSHIP_COPY.failed}</p>
          <Button variant="text" className="flex-none text-[12.5px]" onClick={() => setFailed(false)}>
            {SAVE_RELATIONSHIP_COPY.retry}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
