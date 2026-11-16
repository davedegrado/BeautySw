import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { Cake, Megaphone, Smartphone } from "lucide-react";
import { db, t } from "@/db";
import { saveNotificationSettingsAction } from "@/actions/admin";
import { ActionForm } from "@/components/client-ui";
import { Check, Field, PageHeader, SectionTitle, Stat } from "@/components/ui";
import { fmt } from "@/lib/dates";
import { fullName } from "@/lib/format";
import { requireRole } from "@/lib/session";
import { BroadcastForm } from "./form";

export const metadata = { title: "Notifiche" };

export default async function NotificationsAdmin() {
  const s = await requireRole("admin");
  const c = s.center;
  const [clients, history, [devices]] = await Promise.all([
    db.select({ id: t.users.id, firstName: t.users.firstName, lastName: t.users.lastName }).from(t.users).where(and(eq(t.users.centerId, c.id), eq(t.users.role, "client"), eq(t.users.active, true), isNotNull(t.users.passwordHash))).orderBy(asc(t.users.firstName)),
    db.select().from(t.broadcasts).where(eq(t.broadcasts.centerId, c.id)).orderBy(desc(t.broadcasts.createdAt)).limit(30),
    db
      .select({ n: sql<number>`count(distinct ${t.pushSubscriptions.userId})::int` })
      .from(t.pushSubscriptions)
      .innerJoin(t.users, eq(t.users.id, t.pushSubscriptions.userId))
      .where(and(eq(t.users.centerId, c.id), eq(t.users.role, "client"))),
  ]);
  return (
    <>
      <PageHeader eyebrow="Comunicazione" title="Notifiche" subtitle="Invia comunicazioni ai clienti e configura i messaggi automatici. Ogni notifica arriva nell'app e, sui dispositivi abilitati, come notifica push." />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label="Clienti raggiungibili" value={clients.length} hint="con accesso all'app" icon={<Megaphone className="h-5 w-5" strokeWidth={1.3} />} />
        <Stat label="Con push attive" value={devices.n} hint="almeno un dispositivo abilitato" icon={<Smartphone className="h-5 w-5" strokeWidth={1.3} />} />
        <Stat label="Comunicazioni inviate" value={history.length} icon={<Cake className="h-5 w-5" strokeWidth={1.3} />} />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="mb-1 text-2xl">Nuova comunicazione</h2>
          <p className="mb-5 text-sm text-smoke">A tutti i clienti o a un gruppo selezionato.</p>
          <BroadcastForm clients={clients.map((u) => ({ id: u.id, name: fullName(u) }))} />
        </section>

        <section className="card p-6">
          <h2 className="mb-1 text-2xl">Notifiche automatiche</h2>
          <p className="mb-5 text-sm text-smoke">Conferme, modifiche, disdette, premi sbloccati, nuove promozioni ed eventi vengono notificati in automatico. Qui personalizzi promemoria e compleanni.</p>
          <ActionForm action={saveNotificationSettingsAction} submitLabel="Salva impostazioni">
            <Field label="Promemoria appuntamento (ore prima)" hint="Es. 24 = il cliente riceve il promemoria il giorno prima.">
              <input name="reminderHours" type="number" min={1} max={168} required defaultValue={c.reminderHours} className="input" />
            </Field>
            <div className="gold-line" />
            <Check name="birthdayEnabled" label="Invia gli auguri di compleanno" hint="Il giorno del compleanno, in automatico, in base alla data di nascita del cliente." defaultChecked={c.birthdayEnabled} />
            <Field label="Messaggio di auguri" hint="Usa {nome} per inserire il nome del cliente.">
              <textarea name="birthdayMessage" required maxLength={400} defaultValue={c.birthdayMessage} className="input" />
            </Field>
            <Field label="Regalo di compleanno (facoltativo)" hint="Viene aggiunto al messaggio. Es. “20% di sconto su un trattamento a scelta”.">
              <input name="birthdayGift" maxLength={200} defaultValue={c.birthdayGift} className="input" />
            </Field>
            <Field label="Punti omaggio di compleanno" hint="0 = nessun punto in regalo.">
              <input name="birthdayBonusPoints" type="number" min={0} required defaultValue={c.birthdayBonusPoints} className="input" />
            </Field>
          </ActionForm>
        </section>
      </div>

      <div className="mt-10">
        <SectionTitle title="Storico comunicazioni" />
        {history.length === 0 ? (
          <p className="text-sm text-smoke">Non hai ancora inviato comunicazioni.</p>
        ) : (
          <ul className="card divide-y divide-cream">
            {history.map((b) => (
              <li key={b.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{b.title}</p>
                  <p className="text-sm text-smoke">{b.body}</p>
                </div>
                <div className="shrink-0 text-right text-xs text-smoke">
                  <p>{fmt(b.createdAt, c.timezone, "d MMM yyyy · HH:mm")}</p>
                  <p className="mt-1">
                    <span className="badge">{b.audience}</span> <span className="badge badge-gold">{b.recipients} destinatari</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
