import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { ArrowLeft, Cake, Mail, Pencil, Phone } from "lucide-react";
import { db, t } from "@/db";
import { adjustPointsAction, cancelRedemptionAction, resetPasswordAction, saveClientAction, setUserActiveAction, useRedemptionAction } from "@/actions/admin";
import { ApptList } from "@/components/appt-list";
import { NewAppointmentButton } from "@/components/calendar-client";
import { ActionButton, FormDialog } from "@/components/client-ui";
import { ClientFields } from "@/components/forms";
import { Avatar, Field, SectionTitle, Stat, StatusBadge } from "@/components/ui";
import { appointmentFormData } from "@/lib/admin-data";
import { toVM } from "@/lib/calendar";
import { fmt, fmtDay } from "@/lib/dates";
import { fullName } from "@/lib/format";
import { appointmentRows } from "@/lib/queries";
import { requireRole } from "@/lib/session";

export default async function ClientDetail({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireRole("admin");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const tz = s.center.timezone;
  const [u] = await db.select().from(t.users).where(and(eq(t.users.id, id), eq(t.users.centerId, s.center.id), eq(t.users.role, "client")));
  if (!u) notFound();
  const [rows, history, redemptions, form] = await Promise.all([
    appointmentRows(s.center.id, eq(t.appointments.clientId, u.id), "desc", 300),
    db.select().from(t.pointsTransactions).where(eq(t.pointsTransactions.userId, u.id)).orderBy(desc(t.pointsTransactions.createdAt)).limit(40),
    db.select().from(t.redemptions).where(eq(t.redemptions.userId, u.id)).orderBy(desc(t.redemptions.createdAt)),
    appointmentFormData(s.center),
  ]);
  const appts = rows.map((r) => toVM(r, s.center));
  const upcoming = appts.filter((a) => a.status === "confirmed" && !a.past).reverse();
  const past = appts.filter((a) => !(a.status === "confirmed" && !a.past));
  const completed = rows.filter((r) => r.status === "completed");
  const lastVisit = completed[0]?.startAt ?? null;

  return (
    <>
      <Link href="/admin/clienti" className="mb-4 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-smoke hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Clienti
      </Link>
      <header className="card mb-6 flex flex-wrap items-center gap-5 p-6">
        <Avatar user={u} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-4xl leading-tight">{fullName(u)}</h1>
          <p className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm text-smoke">
            {u.email && (
              <a href={`mailto:${u.email}`} className="inline-flex items-center gap-1.5 hover:text-ink">
                <Mail className="h-3.5 w-3.5 text-gold" /> {u.email}
              </a>
            )}
            {u.phone && (
              <a href={`tel:${u.phone}`} className="inline-flex items-center gap-1.5 hover:text-ink">
                <Phone className="h-3.5 w-3.5 text-gold" /> {u.phone}
              </a>
            )}
            {u.birthDate && (
              <span className="inline-flex items-center gap-1.5">
                <Cake className="h-3.5 w-3.5 text-gold" /> {fmtDay(u.birthDate)}
              </span>
            )}
          </p>
          <p className="mt-2 flex flex-wrap gap-1.5">
            <span className="badge">Cliente dal {fmt(u.createdAt, tz, "MMMM yyyy")}</span>
            {!u.passwordHash && <span className="badge">Senza accesso all&apos;app</span>}
            {!u.active && <span className="badge badge-red">Disattivato</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <NewAppointmentButton data={form} defaults={{ clientId: u.id }} label="Prenota" />
          <FormDialog trigger={<><Pencil className="h-3.5 w-3.5" /> Modifica</>} triggerClass="btn btn-outline" title="Scheda cliente" action={saveClientAction}>
            <ClientFields client={u} />
          </FormDialog>
        </div>
      </header>

      {u.notes && (
        <div className="mb-6 rounded-xl border border-gold/40 bg-gold/[0.07] px-5 py-4 text-sm">
          <p className="label">Note interne</p>
          <p className="whitespace-pre-line">{u.notes}</p>
        </div>
      )}

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Punti disponibili" value={u.pointsBalance} />
        <Stat label="Trattamenti completati" value={completed.length} />
        <Stat label="Ultima visita" value={lastVisit ? fmt(lastVisit, tz, "d MMM") : "—"} hint={lastVisit ? fmt(lastVisit, tz, "yyyy") : undefined} />
        <Stat label="Prossimi appuntamenti" value={upcoming.length} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-8">
          <section>
            <SectionTitle title="Prossimi appuntamenti" />
            {upcoming.length ? <ApptList appts={upcoming} mode="admin" data={form} showDate showEmployee /> : <p className="text-sm text-smoke">Nessun appuntamento in programma.</p>}
          </section>
          <section>
            <SectionTitle title="Storico trattamenti" />
            {past.length ? <ApptList appts={past} mode="admin" data={form} showDate showEmployee /> : <p className="text-sm text-smoke">Nessun trattamento nello storico.</p>}
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-2xl">Punti fedeltà</h2>
              <FormDialog trigger="Assegna / sottrai" triggerClass="btn btn-outline btn-sm" title="Modifica punti" action={adjustPointsAction} submitLabel="Conferma">
                <input type="hidden" name="userId" value={u.id} />
                <p className="text-sm text-smoke">Saldo attuale: <strong className="font-medium text-ink">{u.pointsBalance} punti</strong></p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Operazione">
                    <select name="direction" className="input" defaultValue="add">
                      <option value="add">Assegna punti</option>
                      <option value="subtract">Sottrai punti (errore / rimborso)</option>
                    </select>
                  </Field>
                  <Field label="Punti">
                    <input name="amount" type="number" min={1} required className="input" />
                  </Field>
                </div>
                <Field label="Motivazione" hint="Visibile al cliente nello storico punti.">
                  <input name="reason" required maxLength={200} className="input" placeholder="Es. Omaggio di benvenuto" />
                </Field>
              </FormDialog>
            </div>
            {history.length === 0 ? (
              <p className="text-sm text-smoke">Nessun movimento.</p>
            ) : (
              <ul className="max-h-80 divide-y divide-cream overflow-y-auto text-sm">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate">{h.reason}</span>
                      <span className="text-xs text-smoke">{fmt(h.createdAt, tz, "d MMM yyyy")}</span>
                    </span>
                    <span className={`font-serif text-lg ${h.delta > 0 ? "text-success" : "text-danger"}`}>
                      {h.delta > 0 ? "+" : ""}
                      {h.delta}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 text-2xl">Premi riscattati</h2>
            {redemptions.length === 0 ? (
              <p className="text-sm text-smoke">Nessun premio riscattato.</p>
            ) : (
              <ul className="divide-y divide-cream text-sm">
                {redemptions.map((r) => (
                  <li key={r.id} className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{r.rewardName}</span>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-smoke">
                      <span className="font-mono">{r.code}</span> · {fmt(r.createdAt, tz, "d MMM yyyy")} · {r.pointsSpent} punti
                    </p>
                    {r.status === "active" && (
                      <div className="mt-2 flex gap-2">
                        <ActionButton action={useRedemptionAction} fields={{ id: r.id }} className="btn btn-gold btn-sm">
                          Segna utilizzato
                        </ActionButton>
                        <ActionButton action={cancelRedemptionAction} fields={{ id: r.id }} className="btn btn-ghost btn-sm" confirm="Annullare il riscatto e restituire i punti al cliente?">
                          Annulla e rimborsa
                        </ActionButton>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 text-2xl">Account</h2>
            <div className="flex flex-wrap gap-2">
              <FormDialog trigger={u.passwordHash ? "Reimposta password" : "Crea accesso all'app"} triggerClass="btn btn-outline btn-sm" title="Password di accesso" action={resetPasswordAction} submitLabel="Imposta password">
                <input type="hidden" name="id" value={u.id} />
                <p className="text-sm text-smoke">Imposta una nuova password per {fullName(u)} e comunicala in modo riservato. Le sessioni attive verranno chiuse.</p>
                <Field label="Nuova password" hint="Almeno 8 caratteri.">
                  <input name="password" type="text" required minLength={8} autoComplete="off" className="input" />
                </Field>
              </FormDialog>
              <ActionButton
                action={setUserActiveAction}
                fields={{ id: u.id, active: u.active ? "false" : "true" }}
                className={`btn btn-sm ${u.active ? "btn-danger" : "btn-outline"}`}
                confirm={u.active ? "Disattivare l'account? Il cliente non potrà più accedere né prenotare." : undefined}
              >
                {u.active ? "Disattiva account" : "Riattiva account"}
              </ActionButton>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
