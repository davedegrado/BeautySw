import { useEffect, useState } from "react";
import { inArray } from "drizzle-orm";
import { FlaskConical, Loader2, RotateCcw, X } from "lucide-react";
import { createSession, destroySession, getSession, homeFor } from "@/lib/session";
import type { User } from "@/db/schema";
import { db, t } from "./db";
import { navigate } from "./nav";
import { resetDemo } from "./setup";

const PROFILES = [
  ["admin@aurea.demo", "Amministratore", "Gestione completa del centro"],
  ["giulia@aurea.demo", "Dipendente", "Calendario e trattamenti di Giulia"],
  ["elena@aurea.demo", "Cliente", "Prenotazioni, punti e promozioni di Elena"],
] as const;

/** Pannello della demo: accesso rapido ai tre ruoli e ripristino dei dati. */
export function DemoBar() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    db.select()
      .from(t.users)
      .where(inArray(t.users.email, PROFILES.map((p) => p[0])))
      .then(setUsers);
    getSession().then((s) => setCurrent(s?.user.email ?? null));
  }, [open]);

  const loginAs = async (email: string) => {
    const u = users.find((x) => x.email === email);
    if (!u) return;
    setBusy(email);
    await createSession(u);
    setBusy(null);
    setOpen(false);
    navigate(homeFor(u.role));
  };

  const reset = async () => {
    if (!confirm("Ripristinare i dati dimostrativi? Le modifiche fatte in questa demo andranno perse.")) return;
    setBusy("reset");
    await destroySession();
    await resetDemo();
    location.reload();
  };

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] right-3 z-50 lg:bottom-4 lg:right-4">
      {open && (
        <div className="mb-2 w-72 rounded-2xl border border-gold/30 bg-ink/95 p-4 text-ivory shadow-2xl backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <p className="eyebrow !text-gold">Versione demo</p>
            <button onClick={() => setOpen(false)} className="text-ivory/50 hover:text-ivory" aria-label="Chiudi">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-ivory/60">
            Dati di prova salvati solo su questo dispositivo. Entra con un ruolo per provare l&apos;app:
          </p>
          <div className="space-y-1.5">
            {PROFILES.map(([email, role, desc]) => (
              <button
                key={email}
                disabled={!!busy}
                onClick={() => loginAs(email)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition hover:border-gold ${current === email ? "border-gold bg-gold/10" : "border-white/10"}`}
              >
                <span>
                  <span className="block text-sm">{role}</span>
                  <span className="block text-[11px] text-ivory/50">{desc}</span>
                </span>
                {busy === email && <Loader2 className="h-4 w-4 animate-spin text-gold" />}
              </button>
            ))}
          </div>
          <button disabled={!!busy} onClick={reset} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs text-ivory/60 transition hover:text-gold">
            {busy === "reset" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            Ripristina dati demo
          </button>
        </div>
      )}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Demo: cambia ruolo"
          className="ml-auto flex items-center gap-1.5 rounded-full border border-gold/40 bg-ink/90 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-gold shadow-lg backdrop-blur transition hover:border-gold lg:gap-2 lg:px-4 lg:py-2 lg:text-[11px]"
        >
          <FlaskConical className="h-3.5 w-3.5" strokeWidth={1.5} /> Demo<span className="hidden lg:inline"> · Cambia ruolo</span>
        </button>
      )}
    </div>
  );
}
