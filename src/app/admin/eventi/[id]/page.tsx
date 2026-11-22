import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, notInArray } from "drizzle-orm";
import { ArrowLeft, CalendarDays, MapPin, Pencil, Trash2, UserMinus, Users } from "lucide-react";
import { db, t } from "@/db";
import { addParticipantAction, removeParticipantAction, saveEventAction } from "@/actions/admin";
import { ActionButton, FormDialog } from "@/components/client-ui";
import { EventFields } from "@/components/event-fields";
import { Avatar, Cover, Field, Stat } from "@/components/ui";
import { fmt } from "@/lib/dates";
import { eur, fullName } from "@/lib/format";
import { requireRole } from "@/lib/session";
import { DeleteEventButton } from "./delete";

export default async function EventAdminDetail({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireRole("admin");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const tz = s.center.timezone;
  const [ev] = await db.select().from(t.events).where(and(eq(t.events.id, id), eq(t.events.centerId, s.center.id)));
  if (!ev) notFound();
  const regs = await db
    .select({ reg: t.eventRegistrations, user: t.users })
    .from(t.eventRegistrations)
    .innerJoin(t.users, eq(t.users.id, t.eventRegistrations.userId))
    .where(eq(t.eventRegistrations.eventId, ev.id))
    .orderBy(asc(t.eventRegistrations.createdAt));
  const others = await db
    .select({ id: t.users.id, firstName: t.users.firstName, lastName: t.users.lastName })
    .from(t.users)
    .where(and(eq(t.users.centerId, s.center.id), eq(t.users.role, "client"), eq(t.users.active, true), regs.length ? notInArray(t.users.id, regs.map((r) => r.user.id)) : undefined))
    .orderBy(asc(t.users.firstName));
  const taken = regs.reduce((n, r) => n + r.reg.seats, 0);
  const left = ev.maxParticipants != null ? Math.max(0, ev.maxParticipants - taken) : null;

  return (
    <>
      <Link href="/admin/eventi" className="mb-4 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-smoke hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Eventi
      </Link>
      <div className="card mb-6 overflow-hidden">
        <Cover imageId={ev.imageId} alt={ev.title} className="h-48 sm:h-64">
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 p-6 text-ivory">
            <div>
              {!ev.published && <span className="badge mb-2">Bozza · non visibile ai clienti</span>}
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
            <div className="flex gap-2">
              <FormDialog trigger={<><Pencil className="h-3.5 w-3.5" /> Modifica</>} triggerClass="btn btn-gold btn-sm" title="Modifica evento" action={saveEventAction} wide>
                <EventFields event={ev} tz={tz} />
              </FormDialog>
              <DeleteEventButton id={ev.id} title={ev.title}>
                <Trash2 className="h-3.5 w-3.5" /> Elimina
              </DeleteEventButton>
            </div>
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-2xl">Partecipanti</h2>
          <FormDialog trigger="Aggiungi partecipante" triggerClass="btn btn-outline btn-sm" title="Aggiungi partecipante" action={addParticipantAction} submitLabel="Iscrivi">
            <input type="hidden" name="eventId" value={ev.id} />
            <Field label="Cliente">
              <select name="userId" required className="input" defaultValue="">
                <option value="" disabled>
                  Seleziona cliente…
                </option>
                {others.map((c) => (
                  <option key={c.id} value={c.id}>
                    {fullName(c)}
                  </option>
                ))}
              </select>
            </Field>
          </FormDialog>
        </div>
        {regs.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-smoke">Nessun iscritto per ora.</p>
        ) : (
          <ul className="divide-y divide-cream">
            {regs.map(({ reg, user }, i) => (
              <li key={reg.id} className="flex items-center gap-4 px-5 py-3">
                <span className="w-6 font-serif text-lg text-gold-deep">{i + 1}</span>
                <Avatar user={user} size="sm" />
                <span className="min-w-0 flex-1">
                  <Link href={`/admin/clienti/${user.id}`} className="block truncate font-medium hover:text-gold-deep">
                    {fullName(user)}
                  </Link>
                  <span className="block truncate text-xs text-smoke">
                    {[user.phone, user.email].filter(Boolean).join(" · ")} · iscritta il {fmt(reg.createdAt, tz, "d MMM")}
                  </span>
                </span>
                <ActionButton action={removeParticipantAction} fields={{ id: reg.id }} className="icon-btn !text-danger" ariaLabel="Rimuovi partecipante" confirm={`Rimuovere ${fullName(user)} dall'evento?`}>
                  <UserMinus className="h-4 w-4" />
                </ActionButton>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
