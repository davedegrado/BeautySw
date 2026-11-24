import { and, eq, gte, lt } from "drizzle-orm";
import { t } from "@/db";
import { DEFAULT_PERMISSIONS } from "@/db/schema";
import { Calendar, calendarRange, type CalView } from "@/components/calendar";
import { NewAppointmentButton } from "@/components/calendar-client";
import { PageHeader } from "@/components/ui";
import { staffAppointmentFormData } from "@/lib/admin-data";
import { toVM } from "@/lib/calendar";
import { addDays, localDate, zoned } from "@/lib/dates";
import { fullName } from "@/lib/format";
import { appointmentRows } from "@/lib/queries";
import { requireRole } from "@/lib/session";

export const metadata = { title: "Il mio calendario" };

export default async function StaffCalendar({ searchParams }: { searchParams: Promise<{ vista?: string; data?: string }> }) {
  const s = await requireRole("employee");
  const sp = await searchParams;
  const tz = s.center.timezone;
  const today = localDate(new Date(), tz);
  const view = (["giorno", "settimana", "mese"].includes(sp.vista ?? "") ? sp.vista : "settimana") as CalView;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.data ?? "") ? sp.data! : today;
  const { from, days } = calendarRange(view, date);
  const rows = await appointmentRows(s.center.id, and(eq(t.appointments.employeeId, s.user.id), gte(t.appointments.startAt, zoned(from, 0, tz)), lt(t.appointments.startAt, zoned(addDays(from, days), 0, tz))));
  const hide = !(s.user.permissions ?? DEFAULT_PERMISSIONS).viewClientContacts;
  const form = await staffAppointmentFormData(s.center, s.user.id);
  return (
    <>
      <PageHeader eyebrow="Agenda" title="Il mio calendario" />
      <Calendar
        view={view} date={date} today={today} appts={rows.map((r) => toVM(r, s.center, { hideContacts: hide }))} employees={[{ id: s.user.id, name: fullName(s.user), color: s.user.color }]} basePath="/staff/calendario"
        mode="staff"
        actions={<NewAppointmentButton data={form} mode="staff" defaults={{ date: view === "giorno" && date >= today ? date : today }} />}
      />
    </>
  );
}
