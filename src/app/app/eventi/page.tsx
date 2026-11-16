import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { EventCard } from "@/components/cards";
import { Empty, PageHeader } from "@/components/ui";
import { eventsWithSeats } from "@/lib/queries";
import { requireRole } from "@/lib/session";

export const metadata = { title: "Eventi" };

export default async function EventsPage() {
  const s = await requireRole("client");
  const [events, mine] = await Promise.all([
    eventsWithSeats(s.center.id, { upcomingOnly: true, publishedOnly: true }),
    db.select({ eventId: t.eventRegistrations.eventId }).from(t.eventRegistrations).where(eq(t.eventRegistrations.userId, s.user.id)),
  ]);
  const joined = new Set(mine.map((m) => m.eventId));
  return (
    <>
      <PageHeader eyebrow="Vivi il centro" title="Eventi" subtitle="Serate beauty, open day e masterclass: momenti esclusivi a posti limitati." />
      {events.length === 0 ? (
        <Empty title="Nessun evento in programma" text="I prossimi eventi ti verranno annunciati con una notifica." />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {events.map(({ event, taken }) => (
            <EventCard
              key={event.id}
              event={event}
              taken={taken}
              tz={s.center.timezone}
              href={`/app/eventi/${event.id}`}
              footer={
                <div className="flex items-center justify-between gap-2">
                  {joined.has(event.id) ? <span className="badge badge-green">Partecipi</span> : <span />}
                  <Link href={`/app/eventi/${event.id}`} className="btn btn-outline btn-sm">
                    {joined.has(event.id) ? "Dettagli" : "Scopri e partecipa"}
                  </Link>
                </div>
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
