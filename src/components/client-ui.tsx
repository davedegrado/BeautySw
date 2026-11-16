"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Check, ImagePlus, Loader2, X } from "lucide-react";
import type { ActionResult } from "@/lib/errors";
import { imageUrl } from "@/lib/format";

/* ------------------------------------------------------------------ Toast */

type Toast = { id: number; text: string; error?: boolean };
const ToastCtx = createContext<(text: string, error?: boolean) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, error = false) => {
    const id = Date.now() + Math.random();
    setItems((l) => [...l, { id, text, error }]);
    setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), error ? 6500 : 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[100] flex flex-col items-center gap-2 px-4 lg:bottom-8" aria-live="polite">
        {items.map((x) => (
          <div
            key={x.id}
            className={`pointer-events-auto flex max-w-md animate-rise items-center gap-3 rounded-lg border bg-ink px-4 py-3 text-sm text-ivory shadow-2xl ${x.error ? "border-danger" : "border-gold/60"}`}
          >
            {x.error ? <AlertCircle className="h-4 w-4 shrink-0 text-danger" /> : <Check className="h-4 w-4 shrink-0 text-gold" />}
            {x.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ------------------------------------------------------------------ Modal */

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade bg-ink/60 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative flex max-h-[92dvh] w-full animate-rise flex-col rounded-t-2xl border border-gold/30 bg-ivory shadow-2xl sm:rounded-2xl ${wide ? "sm:max-w-3xl" : "sm:max-w-xl"}`}>
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-7">
          <h2 className="text-2xl">{title}</h2>
          <button type="button" onClick={onClose} className="icon-btn" aria-label="Chiudi">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5 sm:px-7">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ Form collegati alle server action */

export type FormAction = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

export function ActionForm({
  action,
  children,
  onSuccess,
  submitLabel = "Salva",
  className = "space-y-4",
  submitClass = "btn btn-gold",
  footer,
  resetOnSuccess,
}: {
  action: FormAction;
  children: ReactNode;
  onSuccess?: (r: ActionResult & { ok: true }) => void;
  submitLabel?: ReactNode;
  className?: string;
  submitClass?: string;
  footer?: ReactNode;
  resetOnSuccess?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const ref = useRef<HTMLFormElement>(null);
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const r = await action(null, fd);
      if (!r) return;
      if (r.ok) {
        if (r.message) toast(r.message);
        if (resetOnSuccess) ref.current?.reset();
        onSuccess?.(r);
      } else setError(r.error);
    });
  }
  return (
    <form ref={ref} onSubmit={onSubmit} className={className}>
      {children}
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        {footer}
        <button type="submit" disabled={pending} className={submitClass}>
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

/** Pulsante che apre una finestra con un form; si chiude al salvataggio riuscito. */
export function FormDialog({
  trigger,
  triggerClass = "btn btn-gold",
  title,
  action,
  children,
  submitLabel,
  wide,
  ariaLabel,
}: {
  trigger: ReactNode;
  triggerClass?: string;
  title: string;
  action: FormAction;
  children: ReactNode;
  submitLabel?: ReactNode;
  wide?: boolean;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={triggerClass} onClick={() => setOpen(true)} aria-label={ariaLabel} title={ariaLabel}>
        {trigger}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} wide={wide}>
        <ActionForm
          action={action}
          submitLabel={submitLabel}
          onSuccess={() => setOpen(false)}
          footer={
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Annulla
            </button>
          }
        >
          {children}
        </ActionForm>
      </Modal>
    </>
  );
}

/** Pulsante che esegue direttamente una server action, con conferma opzionale. */
export function ActionButton({
  action,
  fields,
  children,
  className = "btn btn-outline btn-sm",
  confirm,
  confirmLabel = "Conferma",
  ariaLabel,
  onDone,
  disabled,
}: {
  action: FormAction;
  fields: Record<string, string>;
  children: ReactNode;
  className?: string;
  confirm?: string;
  confirmLabel?: string;
  ariaLabel?: string;
  onDone?: (r: ActionResult & { ok: true }) => void;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const toast = useToast();
  const exec = () =>
    start(async () => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(fields)) fd.set(k, v);
      const r = await action(null, fd);
      setAsking(false);
      if (!r) return;
      if (r.ok) {
        if (r.message) toast(r.message);
        onDone?.(r);
      } else toast(r.error, true);
    });
  return (
    <>
      <button type="button" className={className} disabled={pending || disabled} onClick={() => (confirm ? setAsking(true) : exec())} aria-label={ariaLabel} title={ariaLabel}>
        {pending && !confirm ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : children}
      </button>
      {confirm && (
        <Modal open={asking} onClose={() => setAsking(false)} title="Conferma">
          <p className="text-sm leading-relaxed text-anthracite">{confirm}</p>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setAsking(false)}>
              Indietro
            </button>
            <button type="button" className="btn btn-dark" disabled={pending} onClick={exec}>
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

/** Campo di caricamento immagine con anteprima. */
export function ImageField({ name = "image", current, label = "Immagine" }: { name?: string; current?: string | null; label?: string }) {
  const [preview, setPreview] = useState<string | null>(imageUrl(current));
  const [removed, setRemoved] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="relative flex h-24 w-36 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-gold/70 bg-cream text-gold-deep transition hover:bg-gold/10"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview ? <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <ImagePlus className="h-6 w-6" />}
        </button>
        <div className="space-y-1 text-xs text-smoke">
          <p>JPG, PNG o WebP · max 4 MB</p>
          <button type="button" className="underline decoration-gold underline-offset-4" onClick={() => input.current?.click()}>
            {preview ? "Sostituisci immagine" : "Carica immagine"}
          </button>
          {preview && (
            <button
              type="button"
              className="ml-3 text-danger underline underline-offset-4"
              onClick={() => {
                setPreview(null);
                setRemoved(true);
                if (input.current) input.current.value = "";
              }}
            >
              Rimuovi
            </button>
          )}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        name={name}
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            setPreview(URL.createObjectURL(f));
            setRemoved(false);
          }
        }}
      />
      {removed && <input type="hidden" name={`${name}_remove`} value="on" />}
    </div>
  );
}
