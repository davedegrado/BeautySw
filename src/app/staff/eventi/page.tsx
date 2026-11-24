import Link from "next/link";
import { EventCard } from "@/components/cards";
import { Empty, PageHeader, SectionTitle } from "@/components/ui";
import { eventsWithSeats } from "@/lib/queries";
import { requireRole } from "@/lib/session";

export const metadata = { title: "Eventi" };

export default async function StaffEvents() {
  const s = await requireRole("employee");
  const tz = s.center.timezone;
  const all = await eventsWithSeats(s.center.id, { publishedOnly: true });
  const now = Date.now();
  const upcoming = all.filter((e) => (e.event.endsAt ?? e.event.startsAt).getTime() >= now).reverse();
  const past = all.filter((e) => (e.event.endsAt ?? e.event.startsAt).getTime() < now).slice(0, 6);
  const grid = (list: typeof all) => (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {list.map(({ event, taken }) => (
        <EventCard
          key={event.id}
          event={event}
          taken={taken}
          tz={tz}
          href={`/staff/eventi/${event.id}`}
          footer={
            <Link href={`/staff/eventi/${event.id}`} className="btn btn-outline btn-sm w-full">
              Dettagli e partecipanti
            </Link>
          }
        />
      ))}
    </div>
  );
  return (
    <>
      <PageHeader eyebrow="Vita del centro" title="Eventi" subtitle="Gli eventi organizzati dal centro, con i posti disponibili e l'elenco dei partecipanti." />
      {upcoming.length === 0 ? <Empty title="Nessun evento in programma" text="I nuovi eventi pubblicati dall'amministrazione appariranno qui." /> : (
        <>
          <SectionTitle title="In programma" />
          {grid(upcoming)}
        </>
      )}
      {past.length > 0 && (
        <div className="mt-10 opacity-75">
          <SectionTitle title="Eventi passati" />
          {grid(past)}
        </div>
      )}
    </>
  );
}
