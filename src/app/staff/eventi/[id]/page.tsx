import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft, CalendarDays, MapPin, Users } from "lucide-react";
import { db, t } from "@/db";
import { DEFAULT_PERMISSIONS } from "@/db/schema";
import { Avatar, Cover, Stat } from "@/components/ui";
import { fmt } from "@/lib/dates";
import { eur, fullName } from "@/lib/format";
import { requireRole } from "@/lib/session";

/** Dettaglio evento per lo staff: sola lettura, con l'elenco dei partecipanti. */
export default async function StaffEventDetail({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireRole("employee");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const tz = s.center.timezone;
  const [ev] = await db.select().from(t.events).where(and(eq(t.events.id, id), eq(t.events.centerId, s.center.id), eq(t.events.published, true)));
  if (!ev) notFound();
  const regs = await db
    .select({ reg: t.eventRegistrations, user: t.users })
    .from(t.eventRegistrations)
    .innerJoin(t.users, eq(t.users.id, t.eventRegistrations.userId))
    .where(eq(t.eventRegistrations.eventId, ev.id))
    .orderBy(asc(t.eventRegistrations.createdAt));
  const showContacts = (s.user.permissions ?? DEFAULT_PERMISSIONS).viewClientContacts;
  const taken = regs.reduce((n, r) => n + r.reg.seats, 0);
  const left = ev.maxParticipants != null ? Math.max(0, ev.maxParticipants - taken) : null;

  return (
    <>
      <Link href="/staff/eventi" className="mb-4 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-smoke hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Eventi
      </Link>
      <div className="card mb-6 overflow-hidden">
        <Cover imageId={ev.imageId} alt={ev.title} className="h-48 sm:h-64">
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 text-ivory">
            <h1 className="text-4xl leading-tight">{ev.title}</h1>
            <p className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ivory/75">
              <span className="inline-flex items-center gap-1.5 capitalize">
                <CalendarDays className="h-4 w-4 text-gold" strokeWidth={1.4} /> {fmt(ev.startsAt, tz, "EEEE d MMMM yyyy · HH:mm")}
                {ev.endsAt && ` – ${fmt(ev.endsAt, tz, "HH:mm")}`}
              </span>
              {ev.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-gold" strokeWidth={1.4} /> {ev.location}
                </span>
              )}
            </p>
          </div>
        </Cover>
        {ev.description && <p className="whitespace-pre-line p-6 text-sm leading-relaxed text-anthracite">{ev.description}</p>}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label="Iscritti" value={taken} icon={<Users className="h-5 w-5" strokeWidth={1.3} />} />
        <Stat label="Posti disponibili" value={left ?? "∞"} hint={ev.maxParticipants ? `su ${ev.maxParticipants} totali` : "posti illimitati"} />
        <Stat label="Quota" value={ev.priceCents ? eur(ev.priceCents) : "Gratuito"} />
      </div>

      <section className="card">
        <h2 className="border-b border-line px-5 py-4 text-2xl">Partecipanti</h2>
        {regs.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-smoke">Nessun iscritto per ora.</p>
        ) : (
          <ul className="divide-y divide-cream">
            {regs.map(({ reg, user }, i) => (
              <li key={reg.id} className="flex items-center gap-4 px-5 py-3">
                <span className="w-6 font-serif text-lg text-gold-deep">{i + 1}</span>
                <Avatar user={user} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{fullName(user)}</span>
                  {showContacts && (user.phone || user.email) && <span className="block truncate text-xs text-smoke">{[user.phone, user.email].filter(Boolean).join(" · ")}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-line px-5 py-3 text-xs text-smoke">Iscrizioni e posti sono gestiti dall&apos;amministrazione.</p>
      </section>
    </>
  );
}
