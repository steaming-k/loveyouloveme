'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { cn } from '@/lib/cn';

type ToastTone = 'default' | 'positive' | 'warning';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 2400;

const DOT_CLASS: Record<ToastTone, string> = {
  default: 'bg-mint',
  positive: 'bg-mint',
  warning: 'bg-friction',
};

/** Error를 alert()로 처리하지 않기 위한 최소 토스트. 화면 하단에 겹쳐 뜬다. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const showToast = useCallback((message: string, tone: ToastTone = 'default') => {
    const id = nextId.current++;
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);

    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
      timers.current.delete(id);
    }, TOAST_DURATION_MS);

    timers.current.set(id, timer);
  }, []);

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((timer) => clearTimeout(timer));
      map.clear();
    };
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[92px] z-50 flex flex-col items-center gap-2 px-6"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="flex max-w-[353px] items-center gap-2.5 rounded-chip bg-ink px-4 py-3 text-caption text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
          >
            <span className={cn('h-1.5 w-1.5 flex-none rounded-full', DOT_CLASS[toast.tone])} />
            <span className="keep-all">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
