import type { ReactNode } from "react";
import { imageUrl, initials } from "@/lib/format";
import { Mandala } from "./mandala";

export function PageHeader({ eyebrow, title, children, subtitle }: { eyebrow?: string; title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4 animate-rise">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="text-[2rem] leading-tight sm:text-[2.5rem]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-smoke">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-2xl">{title}</h2>
      {action}
    </div>
  );
}

export function Empty({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <Mandala className="mb-4 h-16 w-16 text-gold/70" petals={12} />
      <p className="font-serif text-xl">{title}</p>
      {text && <p className="mt-1 max-w-md text-sm text-smoke">{text}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

export function Avatar({ user, size = "md", color }: { user: { firstName: string; lastName?: string | null }; size?: "sm" | "md" | "lg"; color?: string }) {
  const s = size === "sm" ? "h-8 w-8 text-[0.65rem]" : size === "lg" ? "h-16 w-16 text-xl" : "h-10 w-10 text-xs";
  return (
    <span
      className={`${s} inline-flex shrink-0 items-center justify-center rounded-full border border-gold/60 bg-ink font-medium tracking-widest text-gold-light`}
      style={color ? { borderColor: color } : undefined}
    >
      {initials(user)}
    </span>
  );
}

/** Immagine di copertina; in assenza di immagine mostra un fondo nero con mandala dorato. */
export function Cover({ imageId, alt, className = "", children }: { imageId?: string | null; alt: string; className?: string; children?: ReactNode }) {
  const src = imageUrl(imageId);
  return (
    <div className={`relative overflow-hidden bg-ink ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
      ) : (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,#2a2620,transparent_60%)]" />
          <Mandala className="absolute -right-10 -top-10 h-56 w-56 text-gold/45 transition-transform duration-1000 group-hover:rotate-12" />
          <Mandala className="absolute -bottom-16 -left-12 h-44 w-44 text-gold/20" petals={12} />
        </>
      )}
      {children}
    </div>
  );
}

export function Stat({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card relative overflow-hidden p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="label mb-0">{label}</p>
        {icon && <span className="text-gold">{icon}</span>}
      </div>
      <p className="mt-2 font-serif text-4xl leading-none">{value}</p>
      {hint && <p className="mt-2 text-xs text-smoke">{hint}</p>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    confirmed: ["Confermato", "badge-gold"],
    completed: ["Completato", "badge-green"],
    cancelled: ["Annullato", "badge-red"],
    no_show: ["Non presentato", "badge-red"],
    approved: ["Approvato", "badge-green"],
    pending: ["In attesa", "badge-gold"],
    rejected: ["Non approvato", "badge-red"],
    active: ["Da utilizzare", "badge-gold"],
    used: ["Utilizzato", "badge-green"],
  };
  const [label, cls] = map[status] ?? [status, ""];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function Field({ label, children, hint, className = "" }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-smoke">{hint}</span>}
    </label>
  );
}

export function Check({ name, label, defaultChecked, hint }: { name: string; label: string; defaultChecked?: boolean; hint?: string }) {
  return (
    <label className="flex items-start gap-2.5 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="check mt-0.5" />
      <span>
        {label}
        {hint && <span className="block text-xs text-smoke">{hint}</span>}
      </span>
    </label>
  );
}
