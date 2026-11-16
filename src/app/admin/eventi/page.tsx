import Link from "next/link";
import { Plus } from "lucide-react";
import { saveEventAction } from "@/actions/admin";
import { EventCard } from "@/components/cards";
import { FormDialog } from "@/components/client-ui";
import { EventFields } from "@/components/event-fields";
import { Empty, PageHeader, SectionTitle } from "@/components/ui";
import { eventsWithSeats } from "@/lib/queries";
import { requireRole } from "@/lib/session";

export const metadata = { title: "Eventi" };

export default async function EventsAdmin() {
  const s = await requireRole("admin");
  const tz = s.center.timezone;
  const all = await eventsWithSeats(s.center.id);
  const now = Date.now();
  const upcoming = all.filter((e) => e.event.startsAt.getTime() >= now).reverse();
  const past = all.filter((e) => e.event.startsAt.getTime() < now);
  const grid = (list: typeof all) => (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {list.map(({ event, taken }) => (
        <EventCard
          key={event.id}
          event={event}
          taken={taken}
          tz={tz}
          href={`/admin/eventi/${event.id}`}
          footer={
            <Link href={`/admin/eventi/${event.id}`} className="btn btn-outline btn-sm w-full">
              Gestisci evento e iscrizioni
            </Link>
          }
        />
      ))}
    </div>
  );
  return (
    <>
      <PageHeader eyebrow="Vita del centro" title="Eventi" subtitle="Open day, serate beauty, masterclass: crea l'evento e gestisci iscrizioni e posti disponibili.">
        <FormDialog trigger={<><Plus className="h-3.5 w-3.5" /> Nuovo evento</>} title="Nuovo evento" action={saveEventAction} submitLabel="Crea evento" wide>
          <EventFields tz={tz} />
        </FormDialog>
      </PageHeader>
      {all.length === 0 ? (
        <Empty title="Nessun evento" text="Crea il primo evento e invita i tuoi clienti con una notifica." />
      ) : (
        <>
          <SectionTitle title="In programma" />
          {upcoming.length ? grid(upcoming) : <p className="text-sm text-smoke">Nessun evento in programma.</p>}
          {past.length > 0 && (
            <div className="mt-10 opacity-75">
              <SectionTitle title="Eventi passati" />
              {grid(past)}
            </div>
          )}
        </>
      )}
    </>
  );
}
