'use client';

import { Bookmark, Share2 } from 'lucide-react';

import { cn } from '@/lib/cn';
import type { ConversationQuestion } from '@/types';

/** 대화 질문 카드 (S25) — 저장 상태는 실제로 세션에 남는다. */
export function ConversationCard({
  question,
  saved,
  onToggleSave,
  onShare,
}: {
  question: ConversationQuestion;
  saved: boolean;
  onToggleSave: () => void;
  onShare: () => void;
}) {
  return (
    <li className="flex flex-col gap-3.5 rounded-card border border-line bg-surface p-4">
      <p className="text-[10.5px] font-semibold tracking-[0.04em] text-brand-pressed">
        {question.tag}
      </p>

      <p className="text-lead keep-all">{question.text}</p>

      <div className="flex gap-[7px] border-t border-line-soft pt-2.5">
        <button
          type="button"
          aria-pressed={saved}
          onClick={onToggleSave}
          className={cn(
            'flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[9px] border py-2.5 text-caption transition-colors duration-200',
            saved
              ? 'border-brand bg-brand-tint font-semibold text-brand-pressed'
              : 'border-line bg-surface text-ink active:bg-sunken',
          )}
        >
          <Bookmark size={14} fill={saved ? 'currentColor' : 'none'} aria-hidden />
          {saved ? '저장됨' : '저장'}
        </button>

        <button
          type="button"
          onClick={onShare}
          className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[9px] border border-line bg-surface py-2.5 text-caption text-ink-sub active:bg-sunken"
        >
          <Share2 size={14} aria-hidden />
          공유
        </button>
      </div>
    </li>
  );
}
