import Link from "next/link";
import { eq } from "drizzle-orm";
import { CalendarDays, Clock, User } from "lucide-react";
import { t } from "@/db";
import { cancelOwnAppointmentAction } from "@/actions/client";
import { ActionButton } from "@/components/client-ui";
import { Empty, PageHeader, SectionTitle, StatusBadge } from "@/components/ui";
import { cancellationDeadline } from "@/lib/booking";
import { fmt } from "@/lib/dates";
import { eur } from "@/lib/format";
import { appointmentRows } from "@/lib/queries";
import { requireRole } from "@/lib/session";

export const metadata = { title: "I miei appuntamenti" };

export default async function MyAppointments() {
  const s = await requireRole("client");
  const tz = s.center.timezone;
  const rows = await appointmentRows(s.center.id, eq(t.appointments.clientId, s.user.id), "desc", 300);
  const now = Date.now();
  const upcoming = rows.filter((r) => r.status === "confirmed" && r.endAt.getTime() >= now).reverse();
  const past = rows.filter((r) => !(r.status === "confirmed" && r.endAt.getTime() >= now));

  return (
    <>
      <PageHeader eyebrow="Agenda personale" title="I miei appuntamenti">
        <Link href="/app/prenota" className="btn btn-gold">
          Nuova prenotazione
        </Link>
      </PageHeader>

      <SectionTitle title="In programma" />
      {upcoming.length === 0 ? (
        <Empty title="Nessun appuntamento in programma" text="Scegli il tuo prossimo momento di benessere.">
          <Link href="/app/prenota" className="btn btn-outline">
            Prenota un trattamento
          </Link>
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {upcoming.map((a) => {
            const deadline = cancellationDeadline(a.startAt, s.center, a.treatmentCancellationHours);
            const canCancel = deadline.getTime() > now;
            return (
              <article key={a.id} className="card flex gap-5 p-5">
                <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-ink py-3 text-ivory">
                  <span className="text-[0.6rem] uppercase tracking-[0.2em] text-gold-light">{fmt(a.startAt, tz, "MMM")}</span>
                  <span className="font-serif text-3xl leading-none">{fmt(a.startAt, tz, "d")}</span>
                  <span className="mt-1 text-[0.6rem] uppercase tracking-[0.16em] text-ivory/60">{fmt(a.startAt, tz, "EEE")}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-2xl leading-tight">{a.treatmentName}</h3>
                  <ul className="mt-2 space-y-1 text-sm text-anthracite">
                    <li className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-gold" /> {fmt(a.startAt, tz, "HH:mm")} – {fmt(a.endAt, tz, "HH:mm")}
                    </li>
                    <li className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-gold" /> con {a.employeeFirst}
                      <span className="ml-auto font-serif text-lg text-gold-deep">{eur(a.priceCents)}</span>
                    </li>
                  </ul>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-cream pt-3">
                    <p className="text-xs text-smoke">
                      {canCancel ? <>Disdetta gratuita entro {fmt(deadline, tz, "EEE d MMM, HH:mm")}</> : <>Termine di disdetta scaduto: contatta il centro{s.center.phone ? ` (${s.center.phone})` : ""}</>}
                    </p>
                    {canCancel && (
                      <ActionButton
                        action={cancelOwnAppointmentAction}
                        fields={{ id: a.id }}
                        className="btn btn-danger btn-sm"
                        confirm={`Vuoi disdire l'appuntamento per ${a.treatmentName} di ${fmt(a.startAt, tz, "EEEE d MMMM 'alle' HH:mm")}?`}
                        confirmLabel="Disdici"
                      >
                        Disdici
                      </ActionButton>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="mt-10">
        <SectionTitle title="Storico trattamenti" />
        {past.length === 0 ? (
          <p className="text-sm text-smoke">Lo storico dei tuoi trattamenti apparirà qui.</p>
        ) : (
          <div className="card scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Trattamento</th>
                  <th>Professionista</th>
                  <th>Prezzo</th>
                  <th>Punti</th>
                  <th>Stato</th>
                </tr>
              </thead>
              <tbody>
                {past.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap">
                      <CalendarDays className="mr-1.5 inline h-3.5 w-3.5 text-gold" />
                      {fmt(a.startAt, tz, "d MMM yyyy · HH:mm")}
                    </td>
                    <td className="font-serif text-lg">{a.treatmentName}</td>
                    <td>{a.employeeFirst}</td>
                    <td>{eur(a.priceCents)}</td>
                    <td>{a.pointsAwarded ? `+${a.pointsAwarded}` : "—"}</td>
                    <td>
                      <StatusBadge status={a.status === "confirmed" ? "completed" : a.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
