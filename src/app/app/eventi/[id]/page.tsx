import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { ArrowLeft, CalendarDays, Clock, MapPin, Users } from "lucide-react";
import { db, t } from "@/db";
import { joinEventAction, leaveEventAction } from "@/actions/client";
import { ActionButton } from "@/components/client-ui";
import { Cover } from "@/components/ui";
import { fmt } from "@/lib/dates";
import { eur } from "@/lib/format";
import { requireRole } from "@/lib/session";

export default async function EventDetail({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireRole("client");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const tz = s.center.timezone;
  const [ev] = await db.select().from(t.events).where(and(eq(t.events.id, id), eq(t.events.centerId, s.center.id), eq(t.events.published, true)));
  if (!ev) notFound();
  const [{ taken }] = await db.select({ taken: sql<number>`coalesce(sum(${t.eventRegistrations.seats}), 0)::int` }).from(t.eventRegistrations).where(eq(t.eventRegistrations.eventId, ev.id));
  const [mine] = await db.select().from(t.eventRegistrations).where(and(eq(t.eventRegistrations.eventId, ev.id), eq(t.eventRegistrations.userId, s.user.id)));
  const left = ev.maxParticipants != null ? Math.max(0, ev.maxParticipants - taken) : null;
  const past = ev.startsAt.getTime() < Date.now();

  return (
    <div className="animate-rise">
      <Link href="/app/eventi" className="mb-4 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-smoke hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Tutti gli eventi
      </Link>
      <div className="card overflow-hidden">
        <Cover imageId={ev.imageId} alt={ev.title} className="h-56 sm:h-80">
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 text-ivory sm:p-10">
            <p className="eyebrow mb-2 !text-gold">Evento</p>
            <h1 className="max-w-3xl text-4xl leading-tight sm:text-5xl">{ev.title}</h1>
          </div>
        </Cover>
        <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_20rem]">
          <div className="whitespace-pre-line text-[0.95rem] leading-relaxed text-anthracite">{ev.description || "Maggiori dettagli in arrivo."}</div>
          <aside className="h-fit rounded-xl border border-gold/40 bg-ivory p-6">
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-3">
                <CalendarDays className="h-4 w-4 text-gold" strokeWidth={1.4} />
                <span className="capitalize">{fmt(ev.startsAt, tz, "EEEE d MMMM yyyy")}</span>
              </li>
              <li className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-gold" strokeWidth={1.4} />
                {fmt(ev.startsAt, tz, "HH:mm")}
                {ev.endsAt && ` – ${fmt(ev.endsAt, tz, "HH:mm")}`}
              </li>
              {ev.location && (
                <li className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-gold" strokeWidth={1.4} />
                  {ev.location}
                </li>
              )}
              <li className="flex items-center gap-3">
                <Users className="h-4 w-4 text-gold" strokeWidth={1.4} />
                {left == null ? "Posti illimitati" : left === 0 ? "Posti esauriti" : `${left} posti disponibili su ${ev.maxParticipants}`}
              </li>
            </ul>
            <div className="gold-line my-5" />
            <p className="font-serif text-3xl text-gold-deep">{ev.priceCents ? eur(ev.priceCents) : "Ingresso gratuito"}</p>
            {ev.priceCents > 0 && <p className="text-xs text-smoke">Quota di partecipazione da saldare in istituto.</p>}
            <div className="mt-5">
              {past ? (
                <p className="text-sm text-smoke">Questo evento si è già svolto.</p>
              ) : mine ? (
                <>
                  <p className="badge badge-green mb-3">Partecipazione confermata</p>
                  <ActionButton action={leaveEventAction} fields={{ eventId: ev.id }} className="btn btn-danger w-full" confirm="Vuoi annullare la tua partecipazione a questo evento?" confirmLabel="Annulla partecipazione">
                    Annulla partecipazione
                  </ActionButton>
                </>
              ) : left === 0 ? (
                <button className="btn btn-dark w-full" disabled>
                  Al completo
                </button>
              ) : (
                <ActionButton action={joinEventAction} fields={{ eventId: ev.id }} className="btn btn-gold w-full">
                  Partecipa all&apos;evento
                </ActionButton>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
