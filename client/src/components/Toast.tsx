interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastProps {
  toasts: ToastItem[];
}

const ICONS = { success: '✅', error: '❌', info: 'ℹ️' };
const COLORS = {
  success: 'bg-[var(--c-surface)] border-[var(--c-accent)]/30 text-[var(--c-text)]',
  error:   'bg-[var(--c-surface)] border-red-500/30 text-[var(--c-text)]',
  info:    'bg-[var(--c-surface)] border-[var(--c-border)] text-[var(--c-text)]',
};

export type { ToastItem };

export default function ToastContainer({ toasts }: ToastProps) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium animate-toast-in ${COLORS[t.type]}`}
        >
          <span>{ICONS[t.type]}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
