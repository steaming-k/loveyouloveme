'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect } from 'react';

import { Button } from './Button';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 되돌리기 어려운 동작(분석 제외·삭제) 확인 모달 */
export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = '취소',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open ? (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center px-6"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.button
            type="button"
            aria-label="닫기"
            onClick={onCancel}
            className="absolute inset-0 bg-black/35"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
          />

          <motion.div
            className="relative flex w-full max-w-[321px] flex-col gap-3.5 rounded-[16px] border border-line bg-surface p-[18px] shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
            initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.96 }}
            transition={{ duration: reduceMotion ? 0 : 0.22 }}
          >
            <h2 className="text-lead font-semibold keep-all">{title}</h2>
            {description ? (
              <p className="text-caption keep-all text-ink-sub">{description}</p>
            ) : null}
            <div className="flex gap-2">
              <Button variant="secondary" className="h-[46px] flex-1" onClick={onCancel}>
                {cancelLabel}
              </Button>
              <Button className="h-[46px] flex-1 text-sub" onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
