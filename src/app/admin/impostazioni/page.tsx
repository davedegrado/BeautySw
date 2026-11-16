import { and, asc, eq } from "drizzle-orm";
import { Download } from "lucide-react";
import { db, t } from "@/db";
import { createAdminAction, saveBookingRulesAction, saveCenterSettingsAction } from "@/actions/admin";
import { ActionForm, FormDialog } from "@/components/client-ui";
import { ProfileSections } from "@/components/profile";
import { Field, PageHeader } from "@/components/ui";
import { fullName } from "@/lib/format";
import { requireRole } from "@/lib/session";

export const metadata = { title: "Impostazioni" };

export default async function SettingsPage() {
  const s = await requireRole("admin");
  const c = s.center;
  const admins = await db.select().from(t.users).where(and(eq(t.users.centerId, c.id), eq(t.users.role, "admin"))).orderBy(asc(t.users.createdAt));
  const appUrl = process.env.APP_URL?.replace(/\/$/, "") ?? "";
  return (
    <>
      <PageHeader eyebrow="Configurazione" title="Impostazioni" />
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="mb-4 text-2xl">Il centro</h2>
          <ActionForm action={saveCenterSettingsAction} submitLabel="Salva">
            <Field label="Nome del centro">
              <input name="name" required defaultValue={c.name} className="input" />
            </Field>
            <Field label="Frase di benvenuto">
              <input name="tagline" defaultValue={c.tagline} maxLength={160} className="input" />
            </Field>
            <Field label="Indirizzo">
              <input name="address" defaultValue={c.address} className="input" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Telefono">
                <input name="phone" defaultValue={c.phone} className="input" />
              </Field>
              <Field label="Email">
                <input name="email" type="email" defaultValue={c.email} className="input" />
              </Field>
            </div>
          </ActionForm>
          <div className="gold-line my-5" />
          <p className="label">Link di registrazione per i clienti</p>
          <p className="break-all rounded-lg bg-cream/70 px-3 py-2 font-mono text-xs">{appUrl}/registrati?centro={c.slug}</p>
        </section>

        <section className="card p-6">
          <h2 className="mb-1 text-2xl">Regole di prenotazione e disdetta</h2>
          <p className="mb-4 text-sm text-smoke">Valgono per tutte le prenotazioni online. Puoi impostare un termine di disdetta diverso sul singolo trattamento.</p>
          <ActionForm action={saveBookingRulesAction} submitLabel="Salva regole">
            <Field label="Disdetta gratuita fino a (ore prima)" hint="Es. 24, 48 o 72. Oltre questo termine il cliente non può disdire online.">
              <input name="cancellationHours" type="number" min={0} max={720} required defaultValue={c.cancellationHours} className="input" list="cancel-presets" />
              <datalist id="cancel-presets">
                <option value="24" />
                <option value="48" />
                <option value="72" />
              </datalist>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Preparazione tra trattamenti (min)" hint="Pausa tecnica tra un appuntamento e il successivo.">
                <input name="bufferMinutes" type="number" min={0} max={120} required defaultValue={c.bufferMinutes} className="input" />
              </Field>
              <Field label="Intervallo orari proposti (min)" hint="Es. 15 = 9:00, 9:15, 9:30…">
                <input name="slotIntervalMinutes" type="number" min={5} max={120} step={5} required defaultValue={c.slotIntervalMinutes} className="input" />
              </Field>
              <Field label="Anticipo minimo (minuti)" hint="Quanto prima deve prenotare il cliente.">
                <input name="minAdvanceMinutes" type="number" min={0} required defaultValue={c.minAdvanceMinutes} className="input" />
              </Field>
              <Field label="Prenotabile fino a (giorni)" hint="Orizzonte massimo dell'agenda online.">
                <input name="bookingHorizonDays" type="number" min={1} max={365} required defaultValue={c.bookingHorizonDays} className="input" />
              </Field>
            </div>
          </ActionForm>
        </section>

        <section className="card p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-2xl">Amministratori</h2>
            <FormDialog trigger="Aggiungi" triggerClass="btn btn-outline btn-sm" title="Nuovo amministratore" action={createAdminAction} submitLabel="Crea amministratore">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nome">
                  <input name="firstName" required className="input" />
                </Field>
                <Field label="Cognome">
                  <input name="lastName" className="input" />
                </Field>
              </div>
              <Field label="Email">
                <input name="email" type="email" required className="input" />
              </Field>
              <Field label="Password" hint="Almeno 8 caratteri.">
                <input name="password" type="text" required minLength={8} autoComplete="off" className="input" />
              </Field>
            </FormDialog>
          </div>
          <ul className="divide-y divide-cream text-sm">
            {admins.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2.5">
                <span>
                  {fullName(a)} {a.id === s.user.id && <span className="badge badge-gold ml-1">Tu</span>}
                </span>
                <span className="text-smoke">{a.email}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-6">
          <h2 className="mb-1 text-2xl">Backup dei dati</h2>
          <p className="mb-4 text-sm text-smoke">Scarica una copia completa dei dati del centro (clienti, appuntamenti, trattamenti, promozioni, eventi, punti e immagini) in formato JSON. Conservala in un luogo sicuro: contiene dati personali.</p>
          <a href="/api/backup" className="btn btn-dark" download>
            <Download className="h-3.5 w-3.5" /> Scarica backup
          </a>
        </section>
      </div>

      <h2 className="mb-4 text-2xl">Il mio account</h2>
      <ProfileSections session={s} />
    </>
  );
}
