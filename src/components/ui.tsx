import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

// ---------- Button ----------

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md';
}

export function Button({ variant = 'secondary', size = 'md', className, ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-moss-500';
  const sizes = size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm';
  const variants: Record<string, string> = {
    primary: 'bg-moss-700 text-white hover:bg-moss-800',
    secondary: 'bg-white border border-ink-200 text-ink-800 hover:bg-ink-50 dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100 dark:hover:bg-ink-800',
    ghost: 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800',
    destructive: 'bg-clay-600 text-white hover:bg-clay-700',
  };
  return <button className={clsx(base, sizes, variants[variant], className)} {...props} />;
}

// ---------- Badge ----------

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  const tones: Record<string, string> = {
    neutral: 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200',
    good: 'bg-moss-100 text-moss-800 dark:bg-moss-900/40 dark:text-moss-200',
    warn: 'bg-amber-100 text-amber-800',
    bad: 'bg-clay-100 text-clay-800 dark:bg-clay-900/40 dark:text-clay-200',
  };
  return <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', tones[tone], className)} {...props} />;
}

// ---------- Card ----------

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx('rounded-lg border border-ink-200 bg-white shadow-card dark:bg-ink-900 dark:border-ink-800', className)}
      {...props}
    />
  );
}

// ---------- Alert ----------

interface AlertProps {
  tone?: 'info' | 'warn' | 'bad' | 'good';
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Alert({ tone = 'info', title, children, className }: AlertProps) {
  const tones: Record<string, string> = {
    info: 'border-ink-300 bg-ink-100 text-ink-800 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100',
    warn: 'border-amber-300 bg-amber-50 text-amber-900',
    bad: 'border-clay-300 bg-clay-50 text-clay-900 dark:border-clay-800 dark:bg-clay-900/30 dark:text-clay-100',
    good: 'border-moss-300 bg-moss-50 text-moss-900 dark:border-moss-800 dark:bg-moss-900/30 dark:text-moss-100',
  };
  return (
    <div role={tone === 'bad' ? 'alert' : 'status'} className={clsx('rounded-md border px-3.5 py-2.5 text-sm', tones[tone], className)}>
      {title && <p className="font-medium">{title}</p>}
      <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div>
    </div>
  );
}

// ---------- ProgressBar ----------

export function ProgressBar({ value, tone = 'moss' }: { value: number; tone?: 'moss' | 'clay' }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={clsx('h-full rounded-full transition-all', tone === 'moss' ? 'bg-moss-600' : 'bg-clay-500')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ---------- Tabs ----------

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="tablist" aria-label="Sections" className="flex gap-1 overflow-x-auto scrollbar-thin">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={clsx(
            'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            value === t.id
              ? 'bg-moss-700 text-white'
              : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ---------- EmptyState ----------

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-ink-300 bg-white px-6 py-16 text-center dark:border-ink-700 dark:bg-ink-900">
      <h3 className="font-display text-lg text-ink-800 dark:text-ink-100">{title}</h3>
      <p className="max-w-sm text-sm text-ink-500 dark:text-ink-400">{description}</p>
      {action}
    </div>
  );
}

// ---------- ConfirmDialog ----------

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <Card className="w-full max-w-md p-5">
        <h2 id="confirm-title" className="font-display text-lg text-ink-900 dark:text-ink-50">
          {title}
        </h2>
        <div className="mt-2 text-sm text-ink-600 dark:text-ink-300">{description}</div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={destructive ? 'destructive' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ---------- Dialog (generic modal) ----------

export function Dialog({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <Card className={clsx('max-h-[85vh] w-full overflow-y-auto p-5', wide ? 'max-w-2xl' : 'max-w-md')}>
        <div className="flex items-center justify-between">
          <h2 id="dialog-title" className="font-display text-lg text-ink-900 dark:text-ink-50">
            {title}
          </h2>
          <button aria-label="Close dialog" onClick={onClose} className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800">
            ✕
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </Card>
    </div>
  );
}

// ---------- Section ----------

export function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="p-4">
      <h3 className="font-display text-base text-ink-800 dark:text-ink-100">{title}</h3>
      {description && <p className="mt-0.5 text-xs text-ink-400">{description}</p>}
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </Card>
  );
}

// ---------- Field ----------

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-ink-700 dark:text-ink-200">{label}</span>
      {children}
    </label>
  );
}

export const selectClass =
  'rounded-md border border-ink-200 bg-white px-2.5 py-1.5 text-sm text-ink-800 focus-visible:outline-2 focus-visible:outline-moss-500 dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100';
export const inputClass = selectClass;
