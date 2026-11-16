import Link from "next/link";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { CalendarDays, CheckCircle2, Plus, Sparkles } from "lucide-react";
import { db, t } from "@/db";
import { DEFAULT_PERMISSIONS } from "@/db/schema";
import { ApptList } from "@/components/appt-list";
import { Mandala } from "@/components/mandala";
import { Empty, SectionTitle, Stat } from "@/components/ui";
import { toVM } from "@/lib/calendar";
import { addDays, fmt, localDate, startOfWeek, zoned } from "@/lib/dates";
import { appointmentRows } from "@/lib/queries";
import { requireRole } from "@/lib/session";

export const metadata = { title: "Home staff" };

export default async function StaffHome() {
  const s = await requireRole("employee");
  const tz = s.center.timezone;
  const perms = s.user.permissions ?? DEFAULT_PERMISSIONS;
  const today = localDate(new Date(), tz);
  const dayStart = zoned(today, 0, tz);
  const dayEnd = zoned(addDays(today, 1), 0, tz);
  const weekStart = zoned(startOfWeek(today), 0, tz);
  const weekEnd = zoned(addDays(startOfWeek(today), 7), 0, tz);
  const mine = eq(t.appointments.employeeId, s.user.id);
  const [todayRows, [week], [done], [offered]] = await Promise.all([
    appointmentRows(s.center.id, and(mine, gte(t.appointments.startAt, dayStart), lt(t.appointments.startAt, dayEnd), sql`${t.appointments.status} <> 'cancelled'`)),
    db.select({ n: sql<number>`count(*)::int` }).from(t.appointments).where(and(mine, gte(t.appointments.startAt, weekStart), lt(t.appointments.startAt, weekEnd), sql`${t.appointments.status} in ('confirmed','completed')`)),
    db.select({ n: sql<number>`count(*)::int` }).from(t.appointments).where(and(mine, eq(t.appointments.status, "completed"), gte(t.appointments.startAt, new Date(Date.now() - 30 * 86400000)))),
    db.select({ n: sql<number>`count(*)::int` }).from(t.employeeTreatments).where(eq(t.employeeTreatments.employeeId, s.user.id)),
  ]);
  const appts = todayRows.map((r) => toVM(r, s.center, { hideContacts: !perms.viewClientContacts }));

  return (
    <div className="space-y-8">
      <section className="card-dark relative animate-rise overflow-hidden p-7 sm:p-10">
        <Mandala className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 text-gold/25" spin />
        <div className="relative">
          <p className="eyebrow mb-2 !text-gold capitalize">{fmt(new Date(), tz, "EEEE d MMMM")}</p>
          <h1 className="text-4xl sm:text-5xl">
            Ciao, <em className="gold-text">{s.user.firstName}</em>
          </h1>
          <p className="mt-2 text-sm text-ivory/60">
            {appts.length ? `Oggi hai ${appts.length} ${appts.length === 1 ? "appuntamento" : "appuntamenti"} in agenda.` : "Oggi non hai appuntamenti in agenda."}
          </p>
          {perms.createTreatments && (
            <Link href="/staff/trattamenti/nuovo" className="btn btn-gold mt-7 !px-7 !py-4 !text-[0.8rem]">
              <Plus className="h-4 w-4" /> Nuovo trattamento
            </Link>
          )}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Questa settimana" value={week.n} hint="appuntamenti in agenda" icon={<CalendarDays className="h-5 w-5" strokeWidth={1.3} />} />
        <Stat label="Ultimi 30 giorni" value={done.n} hint="trattamenti completati" icon={<CheckCircle2 className="h-5 w-5" strokeWidth={1.3} />} />
        <Stat label="I miei trattamenti" value={offered.n} hint="trattamenti che offri" icon={<Sparkles className="h-5 w-5" strokeWidth={1.3} />} />
      </div>

      <section>
        <SectionTitle
          title="Agenda di oggi"
          action={
            <Link href="/staff/calendario" className="text-xs uppercase tracking-[0.18em] text-gold-deep hover:underline">
              Apri calendario
            </Link>
          }
        />
        {appts.length === 0 ? <Empty title="Giornata libera" text="Nessun appuntamento assegnato per oggi." /> : <ApptList appts={appts} mode="staff" />}
      </section>
    </div>
  );
}
