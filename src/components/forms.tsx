import { asc, eq, gte, and } from "drizzle-orm";
import { Trash2 } from "lucide-react";
import { db, t } from "@/db";
import type { Center, Treatment, User } from "@/db/schema";
import { deleteExceptionAction, saveExceptionAction, saveShiftsAction } from "@/actions/admin";
import { fmt, minutesToTime, WEEK_ORDER, WEEKDAYS } from "@/lib/dates";
import { ActionButton, ActionForm, FormDialog, ImageField } from "./client-ui";
import { Check, Field } from "./ui";

/** Campi comuni del trattamento (usati da amministratore e dipendente). */
export function TreatmentFields({ treatment, categories }: { treatment?: Treatment; categories: { id: string; name: string }[] }) {
  return (
    <>
      {treatment && <input type="hidden" name="id" value={treatment.id} />}
      <Field label="Nome del trattamento">
        <input name="name" required maxLength={120} defaultValue={treatment?.name} className="input" />
      </Field>
      <Field label="Descrizione">
        <textarea name="description" defaultValue={treatment?.description} className="input" maxLength={3000} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Categoria">
          <select name="categoryId" defaultValue={treatment?.categoryId ?? ""} className="input">
            <option value="">— Nessuna —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Durata (minuti)">
          <input name="duration" type="number" min={5} max={600} step={5} required defaultValue={treatment?.durationMinutes ?? 60} className="input" />
        </Field>
        <Field label="Prezzo (€)">
          <input name="price" inputMode="decimal" required defaultValue={treatment ? (treatment.priceCents / 100).toString().replace(".", ",") : ""} className="input" placeholder="0,00" />
        </Field>
      </div>
      <ImageField current={treatment?.imageId} />
      <Field label="Note interne" hint="Visibili solo allo staff (prodotti utilizzati, controindicazioni…).">
        <textarea name="notes" defaultValue={treatment?.notes} className="input !min-h-16" maxLength={1000} />
      </Field>
      <Check name="active" label="Trattamento disponibile" hint="Se disattivato non è prenotabile dai clienti." defaultChecked={treatment?.active ?? true} />
    </>
  );
}

/** Turni settimanali: due fasce al giorno (la pausa è l'intervallo tra le due). */
export async function ShiftsEditor({ employeeId, readOnly }: { employeeId: string; readOnly?: boolean }) {
  const shifts = await db.select().from(t.workShifts).where(eq(t.workShifts.employeeId, employeeId)).orderBy(asc(t.workShifts.startMinute));
  const rows = WEEK_ORDER.map((wd) => ({ wd, bands: shifts.filter((s) => s.weekday === wd) }));
  if (readOnly)
    return (
      <ul className="divide-y divide-cream text-sm">
        {rows.map(({ wd, bands }) => (
          <li key={wd} className="flex items-center justify-between py-2.5">
            <span>{WEEKDAYS[wd]}</span>
            <span className={bands.length ? "" : "text-smoke"}>{bands.length ? bands.map((b) => `${minutesToTime(b.startMinute)}–${minutesToTime(b.endMinute)}`).join("  ·  ") : "Riposo"}</span>
          </li>
        ))}
      </ul>
    );
  return (
    <ActionForm action={saveShiftsAction} submitLabel="Salva turni" className="space-y-2">
      <input type="hidden" name="employeeId" value={employeeId} />
      <div className="grid grid-cols-[5.5rem_1fr_1fr] items-center gap-x-3 gap-y-2 text-sm">
        <span />
        <span className="label mb-0">Prima fascia</span>
        <span className="label mb-0">Seconda fascia</span>
        {rows.map(({ wd, bands }) => (
          <div key={wd} className="contents">
            <span>{WEEKDAYS[wd]}</span>
            {[0, 1].map((i) => (
              <span key={i} className="flex items-center gap-1">
                <input type="time" name={`s_${wd}_${i + 1}_start`} defaultValue={bands[i] ? minutesToTime(bands[i].startMinute) : ""} className="input !min-h-0 !px-2 !py-1.5" step={300} aria-label={`${WEEKDAYS[wd]} fascia ${i + 1} inizio`} />
                <span className="text-smoke">–</span>
                <input type="time" name={`s_${wd}_${i + 1}_end`} defaultValue={bands[i] ? minutesToTime(bands[i].endMinute) : ""} className="input !min-h-0 !px-2 !py-1.5" step={300} aria-label={`${WEEKDAYS[wd]} fascia ${i + 1} fine`} />
              </span>
            ))}
          </div>
        ))}
      </div>
      <p className="text-xs text-smoke">Lascia vuote le fasce dei giorni di riposo. L&apos;intervallo tra prima e seconda fascia è la pausa.</p>
    </ActionForm>
  );
}

/** Ferie, indisponibilità e disponibilità straordinarie. */
export async function ExceptionsPanel({ employeeId, center, canEdit, asAdmin }: { employeeId: string; center: Center; canEdit: boolean; asAdmin?: boolean }) {
  const list = await db
    .select()
    .from(t.availabilityExceptions)
    .where(and(eq(t.availabilityExceptions.employeeId, employeeId), gte(t.availabilityExceptions.endAt, new Date())))
    .orderBy(asc(t.availabilityExceptions.startAt));
  const tz = center.timezone;
  return (
    <div>
      {list.length === 0 ? (
        <p className="text-sm text-smoke">Nessuna indisponibilità o disponibilità straordinaria in programma.</p>
      ) : (
        <ul className="divide-y divide-cream text-sm">
          {list.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <span className={`badge mr-2 ${e.kind === "unavailable" ? "badge-red" : "badge-green"}`}>{e.kind === "unavailable" ? "Non disponibile" : "Disponibilità extra"}</span>
                <span className="whitespace-nowrap">{fmt(e.startAt, tz, "d MMM HH:mm")}</span> → <span className="whitespace-nowrap">{fmt(e.endAt, tz, "d MMM HH:mm")}</span>
                {e.reason && <span className="ml-2 text-smoke">· {e.reason}</span>}
              </div>
              {canEdit && (
                <ActionButton action={deleteExceptionAction} fields={{ id: e.id }} className="icon-btn !text-danger" ariaLabel="Elimina" confirm="Eliminare questa voce?">
                  <Trash2 className="h-4 w-4" />
                </ActionButton>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit ? (
        <div className="mt-4">
          <FormDialog trigger="Aggiungi ferie / disponibilità" triggerClass="btn btn-outline btn-sm" title="Disponibilità" action={saveExceptionAction}>
            {asAdmin && <input type="hidden" name="employeeId" value={employeeId} />}
            <Field label="Tipo">
              <select name="kind" className="input" defaultValue="unavailable">
                <option value="unavailable">Non disponibile (ferie, permesso, malattia…)</option>
                <option value="available">Disponibilità straordinaria (fuori turno)</option>
              </select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Dal">
                <input type="datetime-local" name="startAt" required className="input" />
              </Field>
              <Field label="Al">
                <input type="datetime-local" name="endAt" required className="input" />
              </Field>
            </div>
            <Field label="Motivo (facoltativo)">
              <input name="reason" className="input" maxLength={200} />
            </Field>
          </FormDialog>
        </div>
      ) : (
        <p className="mt-3 text-xs text-smoke">Per modificare la disponibilità rivolgiti all&apos;amministrazione.</p>
      )}
    </div>
  );
}

export function ClientFields({ client }: { client?: User }) {
  return (
    <>
      {client && <input type="hidden" name="id" value={client.id} />}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome">
          <input name="firstName" required defaultValue={client?.firstName} className="input" />
        </Field>
        <Field label="Cognome">
          <input name="lastName" defaultValue={client?.lastName} className="input" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email">
          <input name="email" type="email" defaultValue={client?.email ?? ""} className="input" />
        </Field>
        <Field label="Telefono">
          <input name="phone" type="tel" defaultValue={client?.phone} className="input" />
        </Field>
      </div>
      <Field label="Data di nascita">
        <input name="birthDate" type="date" defaultValue={client?.birthDate ?? ""} className="input" />
      </Field>
      <Field label="Note interne" hint="Allergie, preferenze, ricorrenze. Visibili solo allo staff.">
        <textarea name="notes" defaultValue={client?.notes} className="input" />
      </Field>
      {!client && (
        <Field label="Password di accesso (facoltativa)" hint="Se la imposti (con un'email), il cliente potrà accedere all'app. Altrimenti resta una scheda gestita dal centro.">
          <input name="password" type="text" minLength={8} autoComplete="off" className="input" />
        </Field>
      )}
    </>
  );
}


export function EmployeeFields({ employee, treatments, selected = [] }: { employee?: User; treatments: { id: string; name: string }[]; selected?: string[] }) {
  const p = employee?.permissions ?? { manageAvailability: true, createTreatments: true, viewClientContacts: true };
  return (
    <>
      {employee && <input type="hidden" name="id" value={employee.id} />}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome">
          <input name="firstName" required defaultValue={employee?.firstName} className="input" />
        </Field>
        <Field label="Cognome">
          <input name="lastName" defaultValue={employee?.lastName} className="input" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email (per l'accesso)">
          <input name="email" type="email" required defaultValue={employee?.email ?? ""} className="input" />
        </Field>
        <Field label="Telefono">
          <input name="phone" type="tel" defaultValue={employee?.phone} className="input" />
        </Field>
      </div>
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <Field label="Qualifica">
          <input name="jobTitle" defaultValue={employee?.jobTitle} className="input" placeholder="Es. Estetista senior" />
        </Field>
        <Field label="Colore agenda">
          <input name="color" type="color" defaultValue={employee?.color ?? "#C9A96E"} className="input !p-1" />
        </Field>
      </div>
      {!employee && (
        <Field label="Password iniziale" hint="Almeno 8 caratteri. Il dipendente potrà cambiarla dal proprio profilo.">
          <input name="password" type="text" required minLength={8} autoComplete="off" className="input" />
        </Field>
      )}
      <Field label="Presentazione">
        <textarea name="notes" defaultValue={employee?.notes} className="input !min-h-16" />
      </Field>
      <fieldset>
        <legend className="label">Permessi</legend>
        <div className="space-y-2.5 rounded-lg border border-line bg-white p-4">
          <Check name="perm_manageAvailability" label="Può inserire disponibilità e indisponibilità" defaultChecked={p.manageAvailability} />
          <Check name="perm_createTreatments" label="Può proporre nuovi trattamenti" hint="Restano in attesa finché non li approvi." defaultChecked={p.createTreatments} />
          <Check name="perm_viewClientContacts" label="Può vedere telefono ed email dei clienti" defaultChecked={p.viewClientContacts} />
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">Trattamenti offerti</legend>
        {treatments.length === 0 ? (
          <p className="text-sm text-smoke">Nessun trattamento creato.</p>
        ) : (
          <div className="grid max-h-52 gap-2 overflow-y-auto rounded-lg border border-line bg-white p-4 sm:grid-cols-2">
            {treatments.map((x) => (
              <label key={x.id} className="flex items-center gap-2.5 text-sm">
                <input type="checkbox" name="treatmentIds" value={x.id} defaultChecked={selected.includes(x.id)} className="check" />
                {x.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>
    </>
  );
}
