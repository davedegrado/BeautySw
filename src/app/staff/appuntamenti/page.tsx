import Link from "next/link";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { t } from "@/db";
import { DEFAULT_PERMISSIONS } from "@/db/schema";
import { ApptList } from "@/components/appt-list";
import { NewAppointmentButton } from "@/components/calendar-client";
import { Empty, PageHeader } from "@/components/ui";
import { staffAppointmentFormData } from "@/lib/admin-data";
import { toVM } from "@/lib/calendar";
import { appointmentRows } from "@/lib/queries";
import { requireRole } from "@/lib/session";

export const metadata = { title: "I miei appuntamenti" };

export default async function StaffAppointments({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const s = await requireRole("employee");
  const history = (await searchParams).vista === "storico";
  const mine = eq(t.appointments.employeeId, s.user.id);
  const cutoff = new Date(Date.now() - 12 * 3600000);
  const rows = history
    ? await appointmentRows(s.center.id, and(mine, lt(t.appointments.startAt, new Date()), sql`${t.appointments.status} <> 'confirmed'`), "desc", 200)
    : await appointmentRows(s.center.id, and(mine, eq(t.appointments.status, "confirmed"), gte(t.appointments.startAt, cutoff)), "asc", 200);
  const hide = !(s.user.permissions ?? DEFAULT_PERMISSIONS).viewClientContacts;
  const appts = rows.map((r) => toVM(r, s.center, { hideContacts: hide }));
  const form = await staffAppointmentFormData(s.center, s.user.id);
  return (
    <>
      <PageHeader eyebrow="Agenda" title="I miei appuntamenti" subtitle="Tocca un appuntamento per vedere i dati del cliente e segnarlo come completato.">
        <NewAppointmentButton data={form} mode="staff" />
      </PageHeader>
      <div className="mb-5 flex gap-2">
        <Link href="/staff/appuntamenti" className={`tab ${!history ? "tab-active" : ""}`}>
          In programma
        </Link>
        <Link href="/staff/appuntamenti?vista=storico" className={`tab ${history ? "tab-active" : ""}`}>
          Storico trattamenti
        </Link>
      </div>
      {appts.length === 0 ? (
        <Empty title={history ? "Nessun trattamento nello storico" : "Nessun appuntamento in programma"} />
      ) : (
        <ApptList appts={appts} mode="staff" showDate />
      )}
    </>
  );
}
