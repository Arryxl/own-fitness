"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, type ComponentProps, type ReactNode } from "react";

export function Card({ className, children, ...rest }: ComponentProps<"section">) {
  return (
    <section className={clsx("glass rounded-[var(--radius-card)] p-4 sm:p-5", className)} {...rest}>
      {children}
    </section>
  );
}

export function CardHeader({ title, action, subtitle }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-bold leading-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

type Variant = "primary" | "accent" | "soft" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-strong shadow-sm",
  accent: "bg-accent-strong text-on-accent hover:opacity-90 shadow-sm",
  soft: "bg-primary-soft text-primary-strong hover:brightness-95",
  ghost: "bg-transparent text-ink hover:bg-sunken",
  danger: "bg-danger-soft text-danger hover:brightness-95",
  outline: "border border-line bg-surface-strong text-ink hover:bg-sunken",
};
const sizes: Record<Size, string> = {
  sm: "min-h-9 px-3 text-sm rounded-xl gap-1.5",
  md: "min-h-12 px-4 text-[0.95rem] rounded-2xl gap-2",
  lg: "min-h-14 px-6 text-base rounded-full gap-2",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return clsx(
    "inline-flex select-none items-center justify-center font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...rest
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

export function IconButton({ label, className, children, ...rest }: ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        "inline-flex size-12 shrink-0 items-center justify-center rounded-2xl text-ink transition hover:bg-sunken active:scale-95 disabled:opacity-40",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

const tones = {
  primary: "bg-primary-soft text-primary-strong",
  accent: "bg-accent-soft text-accent-strong",
  violet: "bg-violet-soft text-violet",
  amber: "bg-amber-soft text-amber",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-sunken text-muted",
} as const;
export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}

export function IconTile({ tone = "primary", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={clsx("inline-flex size-10 shrink-0 items-center justify-center rounded-xl", tones[tone], className)}>{children}</span>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={clsx("flex gap-1 rounded-full bg-sunken p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "min-h-10 flex-1 rounded-full px-3 text-sm font-semibold transition",
            value === o.value ? "bg-primary text-on-primary shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Circular progress like the "Today's Progress" ring in the reference design. */
export function Ring({
  value,
  size = 96,
  stroke = 10,
  color = "var(--primary)",
  children,
  label,
}: {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
  label: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ring-track)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function ProgressBar({ value, color = "var(--primary)", label }: { value: number; color?: string; label: string }) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-sunken" role="progressbar" aria-label={label} aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${v * 100}%`, background: color }} />
    </div>
  );
}

export function Stat({ label, value, unit, hint, className }: { label: string; value: ReactNode; unit?: string; hint?: ReactNode; className?: string }) {
  return (
    <div className={clsx("min-w-0", className)}>
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="num mt-0.5 truncate text-xl font-bold">
        {value}
        {unit && <span className="ml-1 text-sm font-semibold text-muted">{unit}</span>}
      </div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton", className)} aria-hidden />;
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
      {icon && <IconTile tone="neutral" className="size-12">{icon}</IconTile>}
      <p className="font-semibold">{title}</p>
      {children && <div className="max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export const inputClass =
  "min-h-12 w-full rounded-2xl border border-line bg-surface-strong px-4 text-base text-ink placeholder:text-muted/70 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30";

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={clsx(inputClass, className)} {...rest} />;
}

export function TextArea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={clsx(inputClass, "min-h-24 py-3", className)} {...rest} />;
}

export function Select({ className, ...rest }: ComponentProps<"select">) {
  return <select className={clsx(inputClass, "appearance-none pr-10", className)} {...rest} />;
}

/** Parses a decimal typed with comma or dot ("72,5" → 72.5). Empty → null. */
export function parseNum(v: string): number | null {
  const t = v.replace(",", ".").trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Bottom sheet on mobile, centered dialog on desktop. Uses native <dialog> for focus trapping. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none bg-transparent p-0 text-ink backdrop:bg-black/40 backdrop:backdrop-blur-sm sm:m-auto sm:max-w-lg"
    >
      {open && (
        <div className="animate-rise flex max-h-[92dvh] flex-col rounded-t-[1.75rem] border border-line bg-surface-strong shadow-2xl sm:rounded-[1.75rem]">
          <div className="flex items-center justify-between gap-2 px-5 pt-4">
            <h2 className="text-lg font-bold">{title}</h2>
            <IconButton label="Cerrar" onClick={onClose}>
              <X className="size-5" />
            </IconButton>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
          {footer && <div className="safe-bottom border-t border-line px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function PageHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-4 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className="relative h-7 w-12 shrink-0 rounded-full bg-sunken transition peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5"
      />
    </label>
  );
}
