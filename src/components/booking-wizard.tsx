"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Clock, Loader2, Sparkles, Users } from "lucide-react";
import { availabilityAction, bookAction } from "@/actions/client";
import type { Slot } from "@/lib/availability";
import { duration, eur, imageUrl, initials } from "@/lib/format";
import { Mandala } from "./mandala";

type Treatment = {
  id: string; name: string; description: string; durationMinutes: number; priceCents: number;
  categoryId: string | null; imageId: string | null; cancellationHours: number; employeeIds: string[];
};
type Employee = { id: string; firstName: string; lastName: string; jobTitle: string };
type Promo = { id: string; title: string; treatmentId: string | null; promoPriceCents: number | null };

const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const PAGE = 14;
const STEPS = ["Trattamento", "Professionista", "Data e ora", "Conferma"];

export function BookingWizard({
  categories, treatments, employees, promo, initialTreatmentId, tz, today, horizonDays,
}: {
  categories: { id: string; name: string }[];
  treatments: Treatment[];
  employees: Employee[];
  promo: Promo | null;
  initialTreatmentId: string | null;
  tz: string;
  today: string;
  horizonDays: number;
}) {
  const initial = treatments.find((x) => x.id === initialTreatmentId) ?? null;
  const [step, setStep] = useState(initial ? 1 : 0);
  const [treatment, setTreatment] = useState<Treatment | null>(initial);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [cat, setCat] = useState<string>("all");
  const [from, setFrom] = useState(today);
  const [slots, setSlots] = useState<Record<string, Slot[]>>({});
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTx] = useTransition();
  const [done, setDone] = useState<{ when: string; employee: string; deadline: string } | null>(null);

  const timeFmt = useMemo(() => new Intl.DateTimeFormat("it-IT", { timeZone: tz, hour: "2-digit", minute: "2-digit" }), [tz]);
  const hourOf = (iso: string) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(new Date(iso)));
  const dayFmt = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", ...o }).format(new Date(`${d}T12:00:00Z`));

  const price = treatment && promo && promo.treatmentId === treatment.id && promo.promoPriceCents != null ? promo.promoPriceCents : (treatment?.priceCents ?? 0);
  const staff = treatment ? employees.filter((e) => treatment.employeeIds.includes(e.id)) : [];
  const usedCats = categories.filter((c) => treatments.some((x) => x.categoryId === c.id));
  const visible = treatments.filter((x) => cat === "all" || x.categoryId === cat);

  // Carica la disponibilità per la finestra di date visualizzata.
  useEffect(() => {
    if (step !== 2 || !treatment) return;
    let alive = true;
    setLoading(true);
    availabilityAction({ treatmentId: treatment.id, employeeId, fromDate: from, days: PAGE })
      .then((r) => {
        if (!alive) return;
        setSlots(r);
        setDate((cur) => (cur && r[cur]?.length ? cur : (Object.keys(r).find((d) => r[d].length) ?? null)));
      })
      .catch(() => alive && setError("Impossibile caricare gli orari. Riprova."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [step, treatment, employeeId, from]);

  const daySlots = date ? (slots[date] ?? []) : [];
  const groups = [
    ["Mattina", daySlots.filter((s) => hourOf(s.start) < 13)],
    ["Pomeriggio", daySlots.filter((s) => hourOf(s.start) >= 13 && hourOf(s.start) < 18)],
    ["Sera", daySlots.filter((s) => hourOf(s.start) >= 18)],
  ] as const;
  const deadline = start && treatment ? new Date(new Date(start).getTime() - treatment.cancellationHours * 3600000) : null;
  const longFmt = new Intl.DateTimeFormat("it-IT", { timeZone: tz, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

  function confirm() {
    if (!treatment || !start) return;
    setError(null);
    const fd = new FormData();
    fd.set("treatmentId", treatment.id);
    if (employeeId) fd.set("employeeId", employeeId);
    fd.set("start", start);
    fd.set("notes", notes);
    if (promo) fd.set("promotionId", promo.id);
    startTx(async () => {
      const r = await bookAction(null, fd);
      if (r.ok) setDone(r.data as { when: string; employee: string; deadline: string });
      else {
        setError(r.error);
        // L'orario potrebbe essere stato appena prenotato: torna alla scelta e ricarica.
        setStart(null);
        setStep(2);
        setFrom((f) => f);
        setSlots({});
        availabilityAction({ treatmentId: treatment.id, employeeId, fromDate: from, days: PAGE }).then(setSlots).catch(() => {});
      }
    });
  }

  if (done && treatment)
    return (
      <div className="card-dark relative mx-auto max-w-xl animate-rise overflow-hidden px-6 py-12 text-center sm:px-12">
        <Mandala className="pointer-events-none absolute left-1/2 top-1/2 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 text-gold/15" spin />
        <div className="relative">
          <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-gold text-gold">
            <Check className="h-6 w-6" strokeWidth={1.4} />
          </span>
          <p className="eyebrow mb-2 !text-gold">Prenotazione confermata</p>
          <h2 className="text-4xl">{treatment.name}</h2>
          <p className="mt-3 capitalize text-ivory/80">{done.when}</p>
          <p className="text-sm text-ivory/60">con {done.employee} · {eur(price)}</p>
          <div className="gold-line my-6 opacity-50" />
          <p className="text-xs leading-relaxed text-ivory/55">Disdetta gratuita fino a {done.deadline}. Ti abbiamo inviato una notifica di conferma e riceverai un promemoria prima dell&apos;appuntamento.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/app/appuntamenti" className="btn btn-gold">
              I miei appuntamenti
            </Link>
            <Link href="/app" className="btn btn-outline !border-white/25 !text-ivory hover:!text-ink">
              Torna alla home
            </Link>
          </div>
        </div>
      </div>
    );

  return (
    <div>
      {promo && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-gold/50 bg-gold/10 px-4 py-3 text-sm">
          <Sparkles className="h-4 w-4 shrink-0 text-gold-deep" />
          <span>
            Stai prenotando con la promozione <strong className="font-medium">{promo.title}</strong>
            {!promo.treatmentId && " — il prezzo promozionale verrà applicato in istituto."}
          </span>
        </div>
      )}

      {/* Indicatore dei passaggi */}
      <ol className="mb-7 flex items-center gap-2 sm:gap-3">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2 sm:gap-3">
            <button
              type="button"
              disabled={i >= step}
              onClick={() => setStep(i)}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs transition ${
                i < step ? "border-gold bg-gold text-ink" : i === step ? "border-ink bg-ink text-gold-light" : "border-line bg-white text-smoke"
              }`}
              aria-label={`Passaggio ${i + 1}: ${label}`}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </button>
            <span className={`hidden text-[0.66rem] uppercase tracking-[0.18em] md:block ${i === step ? "text-ink" : "text-smoke"}`}>{label}</span>
            {i < STEPS.length - 1 && <span className={`h-px flex-1 ${i < step ? "bg-gold" : "bg-line"}`} />}
          </li>
        ))}
      </ol>

      {step > 0 && (
        <button type="button" className="mb-4 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-smoke hover:text-ink" onClick={() => setStep(step - 1)}>
          <ArrowLeft className="h-3.5 w-3.5" /> Indietro
        </button>
      )}

      {/* 1 · Trattamento */}
      {step === 0 && (
        <div className="animate-rise">
          <div className="scroll-x -mx-4 mb-5 flex gap-2 px-4 pb-1 sm:mx-0 sm:px-0">
            <button type="button" className={`tab ${cat === "all" ? "tab-active" : ""}`} onClick={() => setCat("all")}>
              Tutti
            </button>
            {usedCats.map((c) => (
              <button type="button" key={c.id} className={`tab ${cat === c.id ? "tab-active" : ""}`} onClick={() => setCat(c.id)}>
                {c.name}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((x) => {
              const img = imageUrl(x.imageId);
              const promoPrice = promo && promo.treatmentId === x.id ? promo.promoPriceCents : null;
              return (
                <button
                  type="button"
                  key={x.id}
                  onClick={() => {
                    setTreatment(x);
                    setEmployeeId(null);
                    setStart(null);
                    setDate(null);
                    setStep(1);
                  }}
                  className="card group flex gap-4 p-4 text-left transition duration-300 hover:-translate-y-0.5 hover:border-gold"
                >
                  <span className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ink">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {img ? <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <Mandala className="h-24 w-24 shrink-0 text-gold/60" petals={12} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-serif text-xl leading-tight">{x.name}</span>
                    <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-smoke">{x.description}</span>
                    <span className="mt-2 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1 text-xs text-smoke">
                        <Clock className="h-3.5 w-3.5 text-gold" /> {duration(x.durationMinutes)}
                      </span>
                      <span className="font-serif text-lg text-gold-deep">
                        {promoPrice != null && <s className="mr-2 text-sm text-smoke">{eur(x.priceCents)}</s>}
                        {eur(promoPrice ?? x.priceCents)}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2 · Professionista */}
      {step === 1 && treatment && (
        <div className="animate-rise">
          <h2 className="mb-1 text-2xl">Con chi desideri prenotare?</h2>
          <p className="mb-5 text-sm text-smoke">{treatment.name} · {duration(treatment.durationMinutes)} · {eur(price)}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <button type="button" onClick={() => { setEmployeeId(null); setStart(null); setStep(2); }} className="card flex items-center gap-4 p-4 text-left transition hover:-translate-y-0.5 hover:border-gold">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold text-gold-deep">
                <Users className="h-5 w-5" strokeWidth={1.3} />
              </span>
              <span>
                <span className="block font-serif text-xl">Nessuna preferenza</span>
                <span className="text-xs text-smoke">Più disponibilità di orari</span>
              </span>
            </button>
            {staff.map((e) => (
              <button type="button" key={e.id} onClick={() => { setEmployeeId(e.id); setStart(null); setStep(2); }} className="card flex items-center gap-4 p-4 text-left transition hover:-translate-y-0.5 hover:border-gold">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/60 bg-ink text-xs tracking-widest text-gold-light">{initials(e)}</span>
                <span>
                  <span className="block font-serif text-xl">{e.firstName} {e.lastName}</span>
                  <span className="text-xs text-smoke">{e.jobTitle || "Beauty specialist"}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3 · Data e ora */}
      {step === 2 && treatment && (
        <div className="animate-rise">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-2xl capitalize">{dayFmt(from, { month: "long", year: "numeric" })}</h2>
            <div className="flex gap-1">
              <button type="button" className="icon-btn border border-line bg-white disabled:opacity-30" disabled={from <= today || loading} onClick={() => setFrom(addDays(from, -PAGE) < today ? today : addDays(from, -PAGE))} aria-label="Date precedenti">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" className="icon-btn border border-line bg-white disabled:opacity-30" disabled={addDays(from, PAGE) > addDays(today, horizonDays) || loading} onClick={() => setFrom(addDays(from, PAGE))} aria-label="Date successive">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="scroll-x -mx-4 flex gap-2 px-4 pb-2 sm:mx-0 sm:px-0">
            {Array.from({ length: PAGE }, (_, i) => addDays(from, i)).map((d) => {
              const n = slots[d]?.length ?? 0;
              const active = d === date;
              return (
                <button
                  type="button"
                  key={d}
                  disabled={!n}
                  onClick={() => { setDate(d); setStart(null); }}
                  className={`flex w-[3.7rem] shrink-0 flex-col items-center rounded-xl border py-2.5 transition ${
                    active ? "border-ink bg-ink text-gold-light" : n ? "border-line bg-white hover:border-gold" : "border-transparent bg-cream/60 text-smoke/50"
                  }`}
                >
                  <span className="text-[0.6rem] uppercase tracking-[0.16em]">{dayFmt(d, { weekday: "short" }).replace(".", "")}</span>
                  <span className="font-serif text-2xl leading-tight">{Number(d.slice(8))}</span>
                  <span className={`mt-0.5 h-1 w-1 rounded-full ${n ? "bg-gold" : "bg-transparent"}`} />
                </button>
              );
            })}
          </div>

          <div className="mt-6 min-h-40">
            {loading ? (
              <p className="flex items-center gap-2 text-sm text-smoke">
                <Loader2 className="h-4 w-4 animate-spin text-gold" /> Ricerca degli orari disponibili…
              </p>
            ) : !date ? (
              <div className="card p-6 text-center text-sm text-smoke">Nessun orario disponibile in queste date. Prova con le date successive{employeeId ? " o seleziona “Nessuna preferenza”" : ""}.</div>
            ) : (
              <>
                <p className="mb-4 text-sm capitalize text-anthracite">{dayFmt(date, { weekday: "long", day: "numeric", month: "long" })}</p>
                {groups.filter(([, list]) => list.length).map(([label, list]) => (
                  <div key={label} className="mb-5">
                    <p className="label">{label}</p>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                      {list.map((s) => (
                        <button
                          type="button"
                          key={s.start}
                          onClick={() => setStart(s.start)}
                          className={`rounded-lg border py-2.5 text-sm transition ${start === s.start ? "border-gold bg-gold text-ink shadow-md" : "border-line bg-white hover:border-gold"}`}
                        >
                          {timeFmt.format(new Date(s.start))}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
          {error && <p className="mb-3 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2.5 text-sm text-danger">{error}</p>}
          <div className="sticky bottom-20 z-10 mt-4 flex justify-end lg:static">
            <button type="button" className="btn btn-gold shadow-xl" disabled={!start} onClick={() => { setError(null); setStep(3); }}>
              Continua
            </button>
          </div>
        </div>
      )}

      {/* 4 · Riepilogo */}
      {step === 3 && treatment && start && (
        <div className="mx-auto max-w-xl animate-rise">
          <div className="card overflow-hidden">
            <div className="bg-ink px-6 py-5 text-ivory">
              <p className="eyebrow mb-1 !text-gold">Riepilogo</p>
              <h2 className="text-3xl">{treatment.name}</h2>
            </div>
            <dl className="divide-y divide-cream px-6 text-sm">
              {[
                ["Quando", <span key="w" className="capitalize">{longFmt.format(new Date(start))}</span>],
                ["Durata", duration(treatment.durationMinutes)],
                ["Professionista", employeeId ? `${staff.find((e) => e.id === employeeId)?.firstName ?? ""}` : "Nessuna preferenza"],
                ["Prezzo", <span key="p" className="font-serif text-2xl text-gold-deep">{eur(price)}</span>],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex items-center justify-between gap-4 py-3.5">
                  <dt className="label mb-0">{k}</dt>
                  <dd className="text-right">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="space-y-4 px-6 pb-6 pt-2">
              {deadline && (
                <p className="rounded-lg bg-cream/70 px-4 py-3 text-xs leading-relaxed text-anthracite">
                  {deadline.getTime() > Date.now() ? (
                    <>Disdetta gratuita online fino a <strong className="font-medium capitalize">{longFmt.format(deadline)}</strong> ({treatment.cancellationHours} ore prima dell&apos;appuntamento).</>
                  ) : (
                    <>Questo appuntamento rientra già nel periodo di preavviso minimo ({treatment.cancellationHours} ore): per un&apos;eventuale disdetta sarà necessario contattare il centro.</>
                  )}
                </p>
              )}
              <label className="block">
                <span className="label">Note per il centro (facoltative)</span>
                <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Allergie, preferenze, richieste particolari…" />
              </label>
              {error && <p className="rounded-lg border border-danger/40 bg-danger/5 px-3 py-2.5 text-sm text-danger">{error}</p>}
              <button type="button" className="btn btn-gold w-full" disabled={pending} onClick={confirm}>
                {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Conferma prenotazione
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
