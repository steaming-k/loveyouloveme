'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, type ReactNode } from 'react';

import { EASE, MOTION } from '@/lib/motion';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}

/** 바텀 시트 — AI 결과 수정 등 짧은 편집에 사용 */
export function BottomSheet({ open, onClose, title, description, children }: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);

    // 시트가 열리면 첫 입력 요소로 포커스를 옮긴다.
    const focusable = panelRef.current?.querySelector<HTMLElement>(
      'textarea, input, button:not([aria-label="닫기"])',
    );
    focusable?.focus();

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="absolute inset-0 z-40 flex items-end" role="dialog" aria-modal="true" aria-label={title}>
          <motion.button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="absolute inset-0 bg-black/35"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            /* v1.46 §26 — backdrop fade. 숫자를 여기 적지 않고 토큰을 쓴다 */
            transition={{ duration: reduceMotion ? 0 : MOTION.enter / 1000, ease: EASE.standard }}
          />

          <motion.div
            ref={panelRef}
            className="relative w-full rounded-t-[22px] bg-surface px-gutter pt-5 pb-safe"
            initial={{ y: reduceMotion ? 0 : '100%' }}
            animate={{ y: 0 }}
            exit={{ y: reduceMotion ? 0 : '100%' }}
            /*
              §26 — sheet translateY. 들어올 때는 감속(`observe`)이 맞다.
              ⚠️ backdrop(220ms)보다 조금 길게 둔다 — 배경이 먼저 어두워지고 시트가
              올라와야 두 요소가 같은 동작의 앞뒤로 읽힌다.
            */
            transition={{ duration: reduceMotion ? 0 : MOTION.normal / 1000, ease: EASE.observe }}
          >
            <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-line-strong" aria-hidden />
            <h2 className="text-insight keep-all">{title}</h2>
            {description ? (
              <p className="mt-2 text-caption keep-all text-ink-sub">{description}</p>
            ) : null}
            <div className="mt-4">{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
