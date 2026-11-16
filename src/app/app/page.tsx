import Link from "next/link";
import { and, eq, gte } from "drizzle-orm";
import { ArrowRight, CalendarDays, Clock, Crown, User } from "lucide-react";
import { t } from "@/db";
import { EventCard, PromoCard } from "@/components/cards";
import { Mandala } from "@/components/mandala";
import { PushToggle } from "@/components/push";
import { SectionTitle } from "@/components/ui";
import { fmt } from "@/lib/dates";
import { loyaltySummary } from "@/lib/loyalty";
import { activePromotions, appointmentRows, eventsWithSeats } from "@/lib/queries";
import { requireRole } from "@/lib/session";

export const metadata = { title: "Home" };

export default async function ClientHome() {
  const s = await requireRole("client");
  const tz = s.center.timezone;
  const [[next], loyalty, promos, events] = await Promise.all([
    appointmentRows(s.center.id, and(eq(t.appointments.clientId, s.user.id), eq(t.appointments.status, "confirmed"), gte(t.appointments.startAt, new Date())), "asc", 1),
    loyaltySummary(s.center.id, s.user.pointsBalance),
    activePromotions(s.center.id, tz),
    eventsWithSeats(s.center.id, { upcomingOnly: true, publishedOnly: true }),
  ]);
  const hour = Number(fmt(new Date(), tz, "H"));
  const greeting = hour < 13 ? "Buongiorno" : hour < 18 ? "Buon pomeriggio" : "Buonasera";

  return (
    <div className="space-y-10">
      <section className="card-dark relative animate-rise overflow-hidden p-7 sm:p-10">
        <Mandala className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 text-gold/25" spin />
        <div className="relative">
          <p className="eyebrow mb-2 !text-gold">{greeting}</p>
          <h1 className="text-4xl sm:text-5xl">
            Bentornata, <em className="gold-text">{s.user.firstName}</em>
          </h1>
          <p className="mt-2 max-w-lg text-sm text-ivory/60">{s.center.tagline || "Il tuo spazio personale di bellezza e benessere."}</p>
          <Link href="/app/prenota" className="btn btn-gold mt-7">
            Prenota un trattamento <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card animate-rise p-6 [animation-delay:80ms]">
          <p className="eyebrow mb-3">Prossimo appuntamento</p>
          {next ? (
            <>
              <h2 className="text-3xl leading-tight">{next.treatmentName}</h2>
              <ul className="mt-4 space-y-2 text-sm text-anthracite">
                <li className="flex items-center gap-2.5">
                  <CalendarDays className="h-4 w-4 text-gold" strokeWidth={1.4} />
                  <span className="capitalize">{fmt(next.startAt, tz, "EEEE d MMMM yyyy")}</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Clock className="h-4 w-4 text-gold" strokeWidth={1.4} />
                  {fmt(next.startAt, tz, "HH:mm")} – {fmt(next.endAt, tz, "HH:mm")}
                </li>
                <li className="flex items-center gap-2.5">
                  <User className="h-4 w-4 text-gold" strokeWidth={1.4} />
                  con {next.employeeFirst}
                </li>
              </ul>
              <Link href="/app/appuntamenti" className="btn btn-outline btn-sm mt-5">
                Gestisci
              </Link>
            </>
          ) : (
            <>
              <p className="font-serif text-2xl">Nessun appuntamento in programma</p>
              <p className="mt-1 text-sm text-smoke">Concediti un momento tutto per te.</p>
              <Link href="/app/prenota" className="btn btn-outline btn-sm mt-5">
                Prenota ora
              </Link>
            </>
          )}
        </section>

        <section className="card animate-rise p-6 [animation-delay:140ms]">
          <div className="flex items-start justify-between">
            <p className="eyebrow mb-3">Luxury Rewards</p>
            <Crown className="h-5 w-5 text-gold" strokeWidth={1.3} />
          </div>
          <p className="font-serif text-6xl leading-none">
            {s.user.pointsBalance}
            <span className="ml-2 text-xl text-smoke">punti</span>
          </p>
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-cream">
            <div className="h-full rounded-full bg-gradient-to-r from-gold-light via-gold to-gold-deep transition-all duration-1000" style={{ width: `${loyalty.progress}%` }} />
          </div>
          <p className="mt-2 text-sm text-smoke">
            {loyalty.next ? (
              <>
                Ancora <strong className="font-medium text-ink">{loyalty.missing} punti</strong> per: {loyalty.next.name}
              </>
            ) : loyalty.rewards.length ? (
              "Hai raggiunto tutti i premi disponibili."
            ) : (
              "Accumula punti a ogni trattamento."
            )}
          </p>
          <Link href="/app/punti" className="btn btn-outline btn-sm mt-5">
            I miei premi
          </Link>
        </section>
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-3 p-5 empty:hidden [&:not(:has(button))]:hidden">
        <p className="text-sm text-anthracite">Attiva le notifiche per ricevere conferme, promemoria e offerte riservate.</p>
        <PushToggle compact />
      </div>

      {promos.length > 0 && (
        <section>
          <SectionTitle
            title="Promozioni del momento"
            action={
              <Link href="/app/promozioni" className="text-xs uppercase tracking-[0.18em] text-gold-deep hover:underline">
                Vedi tutte
              </Link>
            }
          />
          <div className="scroll-x -mx-4 flex snap-x gap-4 px-4 pb-2 sm:mx-0 sm:px-0">
            {promos.slice(0, 6).map((p) => (
              <Link key={p.id} href="/app/promozioni" className="w-72 shrink-0 snap-start">
                <PromoCard promo={p} compact />
              </Link>
            ))}
          </div>
        </section>
      )}

      {events.length > 0 && (
        <section>
          <SectionTitle
            title="Eventi in programma"
            action={
              <Link href="/app/eventi" className="text-xs uppercase tracking-[0.18em] text-gold-deep hover:underline">
                Vedi tutti
              </Link>
            }
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.slice(0, 3).map(({ event, taken }) => (
              <EventCard key={event.id} event={event} taken={taken} tz={tz} href={`/app/eventi/${event.id}`} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
