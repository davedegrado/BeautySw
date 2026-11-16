import Link from "next/link";
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { AlertCircle, Cake, CalendarDays, Crown, Euro, PartyPopper, Tag, UserPlus, Users } from "lucide-react";
import { db, t } from "@/db";
import { ApptList } from "@/components/appt-list";
import { NewAppointmentButton } from "@/components/calendar-client";
import { BarChart, RankList } from "@/components/charts";
import { PageHeader, Stat } from "@/components/ui";
import { appointmentFormData } from "@/lib/admin-data";
import { toVM } from "@/lib/calendar";
import { addDays, fmt, fmtDay, localDate, startOfWeek, zoned } from "@/lib/dates";
import { eur, fullName } from "@/lib/format";
import { activePromotions, appointmentRows, eventsWithSeats } from "@/lib/queries";
import { requireRole } from "@/lib/session";

export const metadata = { title: "Dashboard" };

const PERIODS = [
  ["7", "7 giorni"],
  ["30", "30 giorni"],
  ["90", "3 mesi"],
  ["365", "12 mesi"],
] as const;

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const s = await requireRole("admin");
  const c = s.center;
  const tz = c.timezone;
  const { periodo } = await searchParams;
  const days = Number(PERIODS.find(([k]) => k === periodo)?.[0] ?? 30);
  const today = localDate(new Date(), tz);
  const dayStart = zoned(today, 0, tz);
  const dayEnd = zoned(addDays(today, 1), 0, tz);
  const weekStart = zoned(startOfWeek(today), 0, tz);
  const weekEnd = zoned(addDays(startOfWeek(today), 7), 0, tz);
  const periodFrom = addDays(today, -(days - 1));
  const since = zoned(periodFrom, 0, tz);
  const A = t.appointments;
  const inCenter = eq(A.centerId, c.id);
  const live = sql`${A.status} in ('confirmed','completed')`;
  const count = sql<number>`count(*)::int`;
  const bucket = days <= 31 ? "day" : days <= 92 ? "week" : "month";
  const bucketExpr = sql<string>`to_char(date_trunc(${sql.raw(`'${bucket}'`)}, ${A.startAt} at time zone ${tz}), 'YYYY-MM-DD')`;

  const [todayRows, [week], [clients], [newClients], [revenue], series, topTreatments, topEmployees, promos, events, birthdays, [points], [pending], form] = await Promise.all([
    appointmentRows(c.id, and(gte(A.startAt, dayStart), lt(A.startAt, dayEnd), sql`${A.status} <> 'cancelled'`)),
    db.select({ n: count }).from(A).where(and(inCenter, live, gte(A.startAt, weekStart), lt(A.startAt, weekEnd))),
    db.select({ n: count }).from(t.users).where(and(eq(t.users.centerId, c.id), eq(t.users.role, "client"), eq(t.users.active, true))),
    db.select({ n: count }).from(t.users).where(and(eq(t.users.centerId, c.id), eq(t.users.role, "client"), gte(t.users.createdAt, since))),
    db
      .select({ total: sql<number>`coalesce(sum(${A.priceCents}), 0)::int`, n: count })
      .from(A)
      .where(and(inCenter, eq(A.status, "completed"), eq(A.paid, true), gte(A.startAt, since), lt(A.startAt, dayEnd))),
    db
      .select({ k: bucketExpr, total: sql<number>`coalesce(sum(case when ${A.status} = 'completed' and ${A.paid} then ${A.priceCents} else 0 end), 0)::int`, n: count })
      .from(A)
      .where(and(inCenter, live, gte(A.startAt, since), lt(A.startAt, dayEnd)))
      .groupBy(sql`1`), // stessa espressione della prima colonna
    db
      .select({ label: t.treatments.name, value: count })
      .from(A)
      .innerJoin(t.treatments, eq(t.treatments.id, A.treatmentId))
      .where(and(inCenter, live, gte(A.startAt, since), lt(A.startAt, dayEnd)))
      .groupBy(t.treatments.name)
      .orderBy(desc(count))
      .limit(5),
    db
      .select({ label: t.users.firstName, color: t.users.color, value: count })
      .from(A)
      .innerJoin(t.users, eq(t.users.id, A.employeeId))
      .where(and(inCenter, live, gte(A.startAt, since), lt(A.startAt, dayEnd)))
      .groupBy(t.users.id, t.users.firstName, t.users.color)
      .orderBy(desc(count))
      .limit(5),
    activePromotions(c.id, tz),
    eventsWithSeats(c.id, { upcomingOnly: true }),
    db
      .select()
      .from(t.users)
      .where(and(eq(t.users.centerId, c.id), eq(t.users.role, "client"), eq(t.users.active, true), sql`to_char(${t.users.birthDate}, 'MM') = ${today.slice(5, 7)}`))
      .orderBy(asc(sql`to_char(${t.users.birthDate}, 'DD')`)),
    db
      .select({
        earned: sql<number>`coalesce(sum(case when ${t.pointsTransactions.delta} > 0 then ${t.pointsTransactions.delta} else 0 end), 0)::int`,
        redeemed: sql<number>`coalesce(sum(case when ${t.pointsTransactions.type} = 'redeem' then -${t.pointsTransactions.delta} else 0 end), 0)::int`,
      })
      .from(t.pointsTransactions)
      .where(and(eq(t.pointsTransactions.centerId, c.id), gte(t.pointsTransactions.createdAt, since))),
    db.select({ n: count }).from(t.treatments).where(and(eq(t.treatments.centerId, c.id), eq(t.treatments.status, "pending"))),
    appointmentFormData(c),
  ]);

  // Serie temporale completa (anche i periodi senza appuntamenti).
  const byKey = new Map(series.map((r) => [r.k, r]));
  const points_: { label: string; title: string; revenue: number; n: number }[] = [];
  if (bucket === "day") for (let i = 0; i < days; i++) { const d = addDays(periodFrom, i); points_.push({ label: fmtDay(d, "d/M"), title: fmtDay(d, "EEEE d MMMM"), revenue: byKey.get(d)?.total ?? 0, n: byKey.get(d)?.n ?? 0 }); }
  else if (bucket === "week") for (let d = startOfWeek(periodFrom); d <= today; d = addDays(d, 7)) points_.push({ label: fmtDay(d, "d/M"), title: `Settimana del ${fmtDay(d, "d MMMM")}`, revenue: byKey.get(d)?.total ?? 0, n: byKey.get(d)?.n ?? 0 });
  else {
    const cur = new Date(`${periodFrom.slice(0, 8)}01T12:00:00Z`);
    while (cur.toISOString().slice(0, 10) <= today) {
      const d = cur.toISOString().slice(0, 10);
      points_.push({ label: fmtDay(d, "MMM"), title: fmtDay(d, "MMMM yyyy"), revenue: byKey.get(d)?.total ?? 0, n: byKey.get(d)?.n ?? 0 });
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
  }
  const todayAppts = todayRows.map((r) => toVM(r, c));
  const upcomingEvents = events.slice(0, 3);

  return (
    <>
      <PageHeader eyebrow={fmt(new Date(), tz, "EEEE d MMMM yyyy")} title={`${Number(fmt(new Date(), tz, "H")) < 13 ? "Buongiorno" : Number(fmt(new Date(), tz, "H")) < 18 ? "Buon pomeriggio" : "Buonasera"}, ${s.user.firstName}`}>
        <NewAppointmentButton data={form} />
      </PageHeader>

      {pending.n > 0 && (
        <Link href="/admin/trattamenti?stato=pending" className="mb-6 flex items-center gap-3 rounded-xl border border-gold/60 bg-gold/10 px-4 py-3 text-sm transition hover:bg-gold/20">
          <AlertCircle className="h-4 w-4 text-gold-deep" />
          {pending.n === 1 ? "C'è 1 trattamento proposto dallo staff" : `Ci sono ${pending.n} trattamenti proposti dallo staff`} in attesa di approvazione.
          <span className="ml-auto text-xs uppercase tracking-[0.18em] text-gold-deep">Rivedi</span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Appuntamenti oggi" value={todayAppts.length} hint={`${week.n} questa settimana`} icon={<CalendarDays className="h-5 w-5" strokeWidth={1.3} />} />
        <Stat label="Clienti registrati" value={clients.n} hint={`+${newClients.n} nuovi nel periodo`} icon={<Users className="h-5 w-5" strokeWidth={1.3} />} />
        <Stat label="Promozioni attive" value={promos.length} hint={`${events.length} eventi in programma`} icon={<Tag className="h-5 w-5" strokeWidth={1.3} />} />
        <Stat label="Compleanni del mese" value={birthdays.length} hint={fmtDay(today, "MMMM")} icon={<Cake className="h-5 w-5" strokeWidth={1.3} />} />
      </div>

      <div className="mb-4 mt-9 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl">Andamento</h2>
        <div className="flex gap-1.5">
          {PERIODS.map(([k, label]) => (
            <Link key={k} href={`/admin?periodo=${k}`} scroll={false} className={`tab ${Number(k) === days ? "tab-active" : ""}`}>
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="label mb-1">Fatturato incassato</p>
              <p className="font-serif text-5xl leading-none">{eur(revenue.total)}</p>
            </div>
            <p className="text-xs text-smoke">
              {revenue.n} trattamenti pagati · scontrino medio {eur(revenue.n ? Math.round(revenue.total / revenue.n) : 0)}
            </p>
          </div>
          <div className="mt-4">
            <BarChart data={points_.map((p) => ({ label: p.label, title: p.title, value: p.revenue / 100 }))} format={(v) => eur(v * 100)} />
          </div>
        </section>
        <section className="card-dark relative overflow-hidden p-5">
          <div className="flex items-start justify-between">
            <p className="eyebrow !text-gold">Luxury Rewards</p>
            <Crown className="h-5 w-5 text-gold" strokeWidth={1.3} />
          </div>
          <p className="mt-4 font-serif text-5xl leading-none text-gold-light">{points.earned.toLocaleString("it-IT")}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ivory/50">punti assegnati</p>
          <div className="gold-line my-5 opacity-40" />
          <p className="font-serif text-5xl leading-none">{points.redeemed.toLocaleString("it-IT")}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ivory/50">punti riscattati</p>
          <Link href="/admin/fedelta" className="btn btn-outline btn-sm mt-6 !border-gold/60 !text-gold-light hover:!text-ink">
            Programma fedeltà
          </Link>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="card p-5">
          <p className="label mb-4">Appuntamenti nel periodo</p>
          <BarChart data={points_.map((p) => ({ label: p.label, title: p.title, value: p.n }))} height={190} width={320} />
        </section>
        <section className="card p-5">
          <p className="label mb-4">Trattamenti più richiesti</p>
          <RankList items={topTreatments} />
        </section>
        <section className="card p-5">
          <p className="label mb-4">Dipendenti più prenotati</p>
          <RankList items={topEmployees} />
        </section>
      </div>

      <div className="mt-9 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl">Agenda di oggi</h2>
            <Link href="/admin/calendario" className="text-xs uppercase tracking-[0.18em] text-gold-deep hover:underline">
              Apri calendario
            </Link>
          </div>
          {todayAppts.length ? <ApptList appts={todayAppts} mode="admin" data={form} showEmployee /> : <div className="card p-8 text-center text-sm text-smoke">Nessun appuntamento in agenda per oggi.</div>}
        </section>
        <div className="space-y-6">
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="label mb-0">Prossimi eventi</p>
              <PartyPopper className="h-4 w-4 text-gold" strokeWidth={1.3} />
            </div>
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-smoke">Nessun evento in programma.</p>
            ) : (
              <ul className="divide-y divide-cream">
                {upcomingEvents.map(({ event, taken }) => (
                  <li key={event.id}>
                    <Link href={`/admin/eventi/${event.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-gold-deep">
                      <span className="min-w-0">
                        <span className="block truncate">{event.title}</span>
                        <span className="text-xs text-smoke">{fmt(event.startsAt, tz, "d MMM · HH:mm")}</span>
                      </span>
                      <span className="badge shrink-0">
                        {taken}
                        {event.maxParticipants ? `/${event.maxParticipants}` : ""} iscritti
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="label mb-0">Compleanni di {fmtDay(today, "MMMM")}</p>
              <Cake className="h-4 w-4 text-gold" strokeWidth={1.3} />
            </div>
            {birthdays.length === 0 ? (
              <p className="text-sm text-smoke">Nessun compleanno questo mese.</p>
            ) : (
              <ul className="divide-y divide-cream">
                {birthdays.map((u) => (
                  <li key={u.id}>
                    <Link href={`/admin/clienti/${u.id}`} className="flex items-center justify-between py-2.5 text-sm hover:text-gold-deep">
                      {fullName(u)}
                      <span className={`badge ${u.birthDate!.slice(5) === today.slice(5) ? "badge-gold" : ""}`}>{u.birthDate!.slice(5) === today.slice(5) ? "Oggi 🎂" : fmtDay(`${today.slice(0, 4)}-${u.birthDate!.slice(5)}`, "d MMMM")}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Nuovi clienti" value={newClients.n} hint="nel periodo" icon={<UserPlus className="h-5 w-5" strokeWidth={1.3} />} />
            <Stat label="Incasso medio" value={eur(revenue.n ? Math.round(revenue.total / revenue.n) : 0)} hint="per trattamento" icon={<Euro className="h-5 w-5" strokeWidth={1.3} />} />
          </div>
        </div>
      </div>
    </>
  );
}
