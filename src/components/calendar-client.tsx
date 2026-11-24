"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Check, Clock, Loader2, Mail, Phone, Plus, StickyNote, User } from "lucide-react";
import { adminCancelAppointmentAction, adminDeleteAppointmentAction, adminSaveAppointmentAction, completeAppointmentAction, noShowAction } from "@/actions/admin";
import { availabilityAction } from "@/actions/client";
import { staffCreateAppointmentAction } from "@/actions/staff";
import type { Slot } from "@/lib/availability";
import type { ApptVM } from "@/lib/calendar";
import { eur } from "@/lib/format";
import { ActionButton, ActionForm, Modal } from "./client-ui";
import { StatusBadge } from "./ui";

export type FormData_ = {
  clients: { id: string; name: string }[];
  treatments: { id: string; name: string; durationMinutes: number; priceCents: number; employeeIds: string[] }[];
  employees: { id: string; name: string }[];
  tz: string;
  today: string;
};

/** Menu a tendina che naviga cambiando un parametro dell'URL. */
export function SelectNav({ value, options, param, base, className = "input !w-auto !min-h-0 !py-2 text-sm" }: { value: string; options: [string, string][]; param: string; base: string; className?: string }) {
  const router = useRouter();
  return (
    <select
      className={className}
      value={value}
      aria-label="Filtro"
      onChange={(e) => {
        const u = new URL(base, window.location.origin);
        if (e.target.value) u.searchParams.set(param, e.target.value);
        else u.searchParams.delete(param);
        router.push(u.pathname + u.search);
      }}
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

/* ------------------------------------------------------------------ Form appuntamento (amministratore e dipendente) */

export function AppointmentForm({ data, appt, defaults, onDone, mode = "admin" }: { data: FormData_; appt?: ApptVM; defaults?: { date?: string; employeeId?: string; clientId?: string }; onDone: () => void; mode?: "admin" | "staff" }) {
  const isStaff = mode === "staff";
  const [clientId, setClientId] = useState(defaults?.clientId ?? "");
  const [treatmentId, setTreatmentId] = useState(appt?.treatmentId ?? "");
  const [employeeId, setEmployeeId] = useState(appt?.employeeId ?? defaults?.employeeId ?? (isStaff ? (data.employees[0]?.id ?? "") : ""));
  const [date, setDate] = useState(appt?.date ?? defaults?.date ?? data.today);
  const [manual, setManual] = useState(false);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [start, setStart] = useState(appt?.startISO ?? "");
  const treatment = data.treatments.find((x) => x.id === treatmentId);
  const staff = treatment ? data.employees.filter((e) => treatment.employeeIds.includes(e.id)) : data.employees;
  const timeFmt = useMemo(() => new Intl.DateTimeFormat("it-IT", { timeZone: data.tz, hour: "2-digit", minute: "2-digit" }), [data.tz]);

  useEffect(() => {
    if (treatment && employeeId && !treatment.employeeIds.includes(employeeId)) setEmployeeId("");
  }, [treatment, employeeId]);

  useEffect(() => {
    if (!treatmentId || !employeeId || !date || manual) return setSlots(null);
    let alive = true;
    setSlots(null);
    availabilityAction({ treatmentId, employeeId, fromDate: date, days: 1, excludeAppointmentId: appt?.id })
      .then((r) => {
        if (!alive) return;
        const list = r[date] ?? [];
        setSlots(list);
        setStart((cur) => (list.some((s) => s.start === cur) ? cur : (list[0]?.start ?? "")));
      })
      .catch(() => alive && setSlots([]));
    return () => {
      alive = false;
    };
  }, [treatmentId, employeeId, date, manual, appt?.id]);

  return (
    <ActionForm action={isStaff ? staffCreateAppointmentAction : adminSaveAppointmentAction} submitLabel={appt ? "Salva modifiche" : "Crea appuntamento"} onSuccess={onDone}>
      {appt && <input type="hidden" name="id" value={appt.id} />}
      {appt ? (
        <p className="rounded-lg bg-cream/70 px-4 py-2.5 text-sm">
          Cliente: <strong className="font-medium">{appt.clientName}</strong>
        </p>
      ) : (
        <div>
          <label className="block">
            <span className="label">Cliente</span>
            <select name="clientId" required className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="" disabled>
                Seleziona cliente…
              </option>
              <option value="__new">+ Nuovo cliente (non registrato)</option>
              {data.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {clientId === "__new" && (
            <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-gold/40 bg-gold/5 p-3 sm:grid-cols-3">
              <input name="newFirstName" required placeholder="Nome" className="input" aria-label="Nome del nuovo cliente" />
              <input name="newLastName" placeholder="Cognome" className="input" aria-label="Cognome del nuovo cliente" />
              <input name="newPhone" type="tel" placeholder="Telefono" className="input col-span-2 sm:col-span-1" aria-label="Telefono del nuovo cliente" />
            </div>
          )}
        </div>
      )}
      <label className="block">
        <span className="label">Trattamento</span>
        <select name="treatmentId" required className="input" value={treatmentId} onChange={(e) => setTreatmentId(e.target.value)}>
          <option value="" disabled>
            Seleziona trattamento…
          </option>
          {data.treatments.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name} · {x.durationMinutes} min · {eur(x.priceCents)}
            </option>
          ))}
        </select>
      </label>
      <div className={isStaff ? "" : "grid grid-cols-2 gap-3"}>
        {isStaff ? (
          <input type="hidden" name="employeeId" value={employeeId} />
        ) : (
        <label className="block">
          <span className="label">Operatore</span>
          <select name="employeeId" required className="input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="" disabled>
              Seleziona…
            </option>
            {staff.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        )}
        <label className="block">
          <span className="label">Data</span>
          <input type="date" name="date" required className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>

      <div>
        <span className="label">Orario</span>
        {manual ? (
          <input type="time" name="time" required className="input" defaultValue={appt ? appt.time.slice(0, 5) : "09:00"} step={300} />
        ) : !treatmentId || !employeeId ? (
          <p className="text-sm text-smoke">{isStaff ? "Seleziona il trattamento per vedere i tuoi orari liberi." : "Seleziona trattamento e operatore per vedere gli orari disponibili."}</p>
        ) : slots === null ? (
          <p className="flex items-center gap-2 text-sm text-smoke">
            <Loader2 className="h-4 w-4 animate-spin text-gold" /> Ricerca orari liberi…
          </p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-danger">{isStaff ? "Non hai orari liberi in questa data per il trattamento scelto." : <>Nessun orario libero in questa data per l&apos;operatore scelto.</>}</p>
        ) : (
          <>
            <input type="hidden" name="start" value={start} />
            <div className="grid max-h-40 grid-cols-5 gap-1.5 overflow-y-auto sm:grid-cols-7">
              {slots.map((s) => (
                <button type="button" key={s.start} onClick={() => setStart(s.start)} className={`rounded-md border py-1.5 text-sm transition ${start === s.start ? "border-gold bg-gold text-ink" : "border-line bg-white hover:border-gold"}`}>
                  {timeFmt.format(new Date(s.start))}
                </button>
              ))}
            </div>
          </>
        )}
        <label className="mt-3 flex items-center gap-2 text-xs text-smoke">
          <input type="checkbox" name="manual" className="check" checked={manual} onChange={(e) => setManual(e.target.checked)} />
          Inserisci un orario libero, anche fuori dal turno (resta vietata la sovrapposizione con altri appuntamenti)
        </label>
      </div>

      <div className={isStaff ? "" : "grid grid-cols-[8rem_1fr] gap-3"}>
        {!isStaff && (
        <label className="block">
          <span className="label">Prezzo €</span>
          <input name="price" inputMode="decimal" className="input" key={treatmentId} defaultValue={appt && appt.treatmentId === treatmentId ? (appt.priceCents / 100).toString().replace(".", ",") : ""} placeholder={treatment ? (treatment.priceCents / 100).toString() : "listino"} />
        </label>
        )}
        <label className="block">
          <span className="label">Note</span>
          <input name="notes" className="input" defaultValue={appt?.notes ?? ""} maxLength={1000} />
        </label>
      </div>
    </ActionForm>
  );
}

export function NewAppointmentButton({ data, defaults, label = "Nuovo appuntamento", className = "btn btn-gold", mode = "admin" }: { data: FormData_; defaults?: { date?: string; employeeId?: string; clientId?: string }; label?: ReactNode; className?: string; mode?: "admin" | "staff" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Nuovo appuntamento">
        {open && <AppointmentForm data={data} defaults={defaults} mode={mode} onDone={() => setOpen(false)} />}
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ Dettaglio appuntamento */

export function ApptTrigger({ appt, mode, data, className, style, children }: { appt: ApptVM; mode: "admin" | "staff"; data?: FormData_; className?: string; style?: CSSProperties; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const close = () => {
    setOpen(false);
    setEditing(false);
  };
  const active = appt.status === "confirmed";
  return (
    <>
      <button type="button" className={className} style={style} onClick={() => setOpen(true)} aria-label={`${appt.time} ${appt.clientName}, ${appt.treatmentName}`}>
        {children}
      </button>
      <Modal open={open} onClose={close} title={editing ? "Modifica appuntamento" : appt.treatmentName}>
        {editing && data ? (
          <AppointmentForm data={data} appt={appt} onDone={close} />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={appt.status} />
              {appt.pointsAwarded ? <span className="badge badge-gold">+{appt.pointsAwarded} punti</span> : null}
            </div>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-center gap-3">
                <Clock className="h-4 w-4 shrink-0 text-gold" strokeWidth={1.4} />
                <span>
                  <span className="capitalize">{appt.dayLabel}</span> · {appt.time}
                </span>
              </li>
              <li className="flex items-center gap-3">
                <User className="h-4 w-4 shrink-0 text-gold" strokeWidth={1.4} />
                {mode === "admin" ? (
                  <Link href={`/admin/clienti/${appt.clientId}`} className="underline decoration-gold underline-offset-4">
                    {appt.clientName}
                  </Link>
                ) : (
                  appt.clientName
                )}
                <span className="text-smoke">· con {appt.employeeName}</span>
              </li>
              {appt.clientPhone && (
                <li className="flex items-center gap-3">
                  <Phone className="h-4 w-4 shrink-0 text-gold" strokeWidth={1.4} />
                  <a href={`tel:${appt.clientPhone}`}>{appt.clientPhone}</a>
                </li>
              )}
              {appt.clientEmail && (
                <li className="flex items-center gap-3">
                  <Mail className="h-4 w-4 shrink-0 text-gold" strokeWidth={1.4} />
                  <a href={`mailto:${appt.clientEmail}`}>{appt.clientEmail}</a>
                </li>
              )}
              {(appt.notes || appt.clientNotes) && (
                <li className="flex items-start gap-3">
                  <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-gold" strokeWidth={1.4} />
                  <span className="whitespace-pre-line text-anthracite">
                    {appt.notes}
                    {appt.notes && appt.clientNotes ? "\n" : ""}
                    {appt.clientNotes && <em className="text-smoke">Scheda cliente: {appt.clientNotes}</em>}
                  </span>
                </li>
              )}
            </ul>
            <p className="font-serif text-3xl text-gold-deep">{eur(appt.priceCents)}</p>
            <div className="gold-line" />
            <div className="flex flex-wrap gap-2">
              {active && (
                <ActionButton action={completeAppointmentAction} fields={{ id: appt.id }} className="btn btn-gold btn-sm" onDone={close}>
                  <Check className="h-3.5 w-3.5" /> Segna come completato
                </ActionButton>
              )}
              {active && appt.past && (
                <ActionButton action={noShowAction} fields={{ id: appt.id }} className="btn btn-ghost btn-sm" onDone={close} confirm="Segnare il cliente come non presentato?">
                  Non presentato
                </ActionButton>
              )}
              {mode === "admin" && appt.status !== "cancelled" && (
                <button type="button" className="btn btn-dark btn-sm" onClick={() => setEditing(true)}>
                  Modifica / sposta
                </button>
              )}
              {mode === "admin" && active && (
                <ActionButton action={adminCancelAppointmentAction} fields={{ id: appt.id }} className="btn btn-danger btn-sm" onDone={close} confirm={`Annullare l'appuntamento di ${appt.clientName}? Il cliente riceverà una notifica.`} confirmLabel="Annulla appuntamento">
                  Annulla
                </ActionButton>
              )}
              {mode === "admin" && !appt.pointsAwarded && (
                <ActionButton action={adminDeleteAppointmentAction} fields={{ id: appt.id }} className="btn btn-ghost btn-sm !text-danger" onDone={close} confirm="Eliminare definitivamente questo appuntamento? L'operazione non invia notifiche e non è reversibile.">
                  Elimina
                </ActionButton>
              )}
            </div>
            {mode === "staff" && active && <p className="text-xs text-smoke">Per spostare o annullare l&apos;appuntamento rivolgiti all&apos;amministrazione.</p>}
          </div>
        )}
      </Modal>
    </>
  );
}
