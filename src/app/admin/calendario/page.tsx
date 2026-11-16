import { and, eq, gte, lt } from "drizzle-orm";
import { t } from "@/db";
import { ApptList } from "@/components/appt-list";
import { Calendar, calendarRange, type CalView } from "@/components/calendar";
import { NewAppointmentButton } from "@/components/calendar-client";
import { PageHeader } from "@/components/ui";
import { appointmentFormData } from "@/lib/admin-data";
import { toVM } from "@/lib/calendar";
import { addDays, localDate, zoned } from "@/lib/dates";
import { appointmentRows } from "@/lib/queries";
import { requireRole } from "@/lib/session";

export const metadata = { title: "Calendario" };

export default async function AdminCalendar({ searchParams }: { searchParams: Promise<{ vista?: string; data?: string; dip?: string }> }) {
  const s = await requireRole("admin");
  const sp = await searchParams;
  const tz = s.center.timezone;
  const today = localDate(new Date(), tz);
  const view = (["giorno", "settimana", "mese"].includes(sp.vista ?? "") ? sp.vista : "giorno") as CalView;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.data ?? "") ? sp.data! : today;
  const { from, days } = calendarRange(view, date);
  const form = await appointmentFormData(s.center);
  const dip = form.employeesFull.some((e) => e.id === sp.dip) ? sp.dip! : "";
  const rows = await appointmentRows(
    s.center.id,
    and(gte(t.appointments.startAt, zoned(from, 0, tz)), lt(t.appointments.startAt, zoned(addDays(from, days), 0, tz)), dip ? eq(t.appointments.employeeId, dip) : undefined),
    "asc",
    2000,
  );
  const appts = rows.map((r) => toVM(r, s.center));
  const cancelled = appts.filter((a) => a.status === "cancelled");
  return (
    <>
      <PageHeader eyebrow="Agenda del centro" title="Calendario" />
      <Calendar
        view={view}
        date={date}
        today={today}
        appts={appts}
        employees={form.employeesFull}
        employeeFilter={dip}
        basePath="/admin/calendario"
        mode="admin"
        data={form}
        actions={<NewAppointmentButton data={form} defaults={{ date: view === "giorno" ? date : today, employeeId: dip || undefined }} />}
      />
      {cancelled.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-2xl">Disdette nel periodo</h2>
          <ApptList appts={cancelled} mode="admin" data={form} showDate showEmployee />
        </section>
      )}
    </>
  );
}
