import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft, CalendarDays, Mail, Pencil, Phone } from "lucide-react";
import { db, t } from "@/db";
import { DEFAULT_PERMISSIONS } from "@/db/schema";
import { resetPasswordAction, saveEmployeeAction, setUserActiveAction } from "@/actions/admin";
import { ActionButton, FormDialog } from "@/components/client-ui";
import { EmployeeFields, ExceptionsPanel, ShiftsEditor } from "@/components/forms";
import { Avatar, Field, StatusBadge } from "@/components/ui";
import { duration, eur, fullName } from "@/lib/format";
import { requireRole } from "@/lib/session";

export default async function EmployeeDetail({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireRole("admin");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [u] = await db.select().from(t.users).where(and(eq(t.users.id, id), eq(t.users.centerId, s.center.id), eq(t.users.role, "employee")));
  if (!u) notFound();
  const [all, mine] = await Promise.all([
    db.select({ id: t.treatments.id, name: t.treatments.name }).from(t.treatments).where(eq(t.treatments.centerId, s.center.id)).orderBy(asc(t.treatments.name)),
    db
      .select({ tr: t.treatments })
      .from(t.employeeTreatments)
      .innerJoin(t.treatments, eq(t.treatments.id, t.employeeTreatments.treatmentId))
      .where(eq(t.employeeTreatments.employeeId, u.id))
      .orderBy(asc(t.treatments.name)),
  ]);
  const p = u.permissions ?? DEFAULT_PERMISSIONS;
  const perms = [
    [p.manageAvailability, "Gestisce la propria disponibilità"],
    [p.createTreatments, "Propone nuovi trattamenti"],
    [p.viewClientContacts, "Vede i contatti dei clienti"],
  ] as const;

  return (
    <>
      <Link href="/admin/dipendenti" className="mb-4 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-smoke hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Dipendenti
      </Link>
      <header className="card mb-6 flex flex-wrap items-center gap-5 p-6">
        <Avatar user={u} size="lg" color={u.color} />
        <div className="min-w-0 flex-1">
          <h1 className="text-4xl leading-tight">{fullName(u)}</h1>
          <p className="text-sm text-smoke">{u.jobTitle || "Beauty specialist"}</p>
          <p className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm text-smoke">
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-gold" /> {u.email}
            </span>
            {u.phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-gold" /> {u.phone}
              </span>
            )}
          </p>
          <p className="mt-2 flex flex-wrap gap-1.5">
            {!u.active && <span className="badge badge-red">Account disattivato</span>}
            {perms.map(([on, label]) => (
              <span key={label} className={`badge ${on ? "badge-gold" : "opacity-50 line-through"}`}>
                {label}
              </span>
            ))}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/calendario?vista=settimana&dip=${u.id}`} className="btn btn-dark">
            <CalendarDays className="h-3.5 w-3.5" /> Calendario
          </Link>
          <FormDialog trigger={<><Pencil className="h-3.5 w-3.5" /> Modifica</>} triggerClass="btn btn-outline" title="Profilo dipendente" action={saveEmployeeAction} wide>
            <EmployeeFields employee={u} treatments={all} selected={mine.map((m) => m.tr.id)} />
          </FormDialog>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="mb-4 text-2xl">Orari e turni di lavoro</h2>
          <ShiftsEditor employeeId={u.id} />
        </section>
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="mb-3 text-2xl">Ferie e disponibilità</h2>
            <ExceptionsPanel employeeId={u.id} center={s.center} canEdit asAdmin />
          </section>
          <section className="card p-6">
            <h2 className="mb-3 text-2xl">Trattamenti offerti</h2>
            {mine.length === 0 ? (
              <p className="text-sm text-smoke">Nessun trattamento associato: usa “Modifica” per assegnarli.</p>
            ) : (
              <ul className="divide-y divide-cream text-sm">
                {mine.map(({ tr }) => (
                  <li key={tr.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0 truncate">
                      {tr.name}
                      {tr.status !== "approved" && (
                        <span className="ml-2">
                          <StatusBadge status={tr.status} />
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-smoke">
                      {duration(tr.durationMinutes)} · {eur(tr.priceCents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card p-6">
            <h2 className="mb-3 text-2xl">Account</h2>
            <div className="flex flex-wrap gap-2">
              <FormDialog trigger="Reimposta password" triggerClass="btn btn-outline btn-sm" title="Reimposta password" action={resetPasswordAction} submitLabel="Imposta password">
                <input type="hidden" name="id" value={u.id} />
                <Field label="Nuova password" hint="Almeno 8 caratteri. Le sessioni attive verranno chiuse.">
                  <input name="password" type="text" required minLength={8} autoComplete="off" className="input" />
                </Field>
              </FormDialog>
              <ActionButton
                action={setUserActiveAction}
                fields={{ id: u.id, active: u.active ? "false" : "true" }}
                className={`btn btn-sm ${u.active ? "btn-danger" : "btn-outline"}`}
                confirm={u.active ? "Disattivare l'account? Il dipendente non potrà più accedere e non sarà più prenotabile. Gli appuntamenti già fissati restano in agenda." : undefined}
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
