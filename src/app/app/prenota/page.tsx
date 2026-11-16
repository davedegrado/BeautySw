import { and, asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { BookingWizard } from "@/components/booking-wizard";
import { Empty, PageHeader } from "@/components/ui";
import { localDate } from "@/lib/dates";
import { activePromotions } from "@/lib/queries";
import { requireRole } from "@/lib/session";

export const metadata = { title: "Prenota" };

export default async function BookPage({ searchParams }: { searchParams: Promise<{ promo?: string; trattamento?: string }> }) {
  const s = await requireRole("client");
  const sp = await searchParams;
  const c = s.center;
  const [categories, treatments, links, employees, promos] = await Promise.all([
    db.select().from(t.categories).where(eq(t.categories.centerId, c.id)).orderBy(asc(t.categories.sort)),
    db
      .select()
      .from(t.treatments)
      .where(and(eq(t.treatments.centerId, c.id), eq(t.treatments.active, true), eq(t.treatments.status, "approved")))
      .orderBy(asc(t.treatments.name)),
    db
      .select({ employeeId: t.employeeTreatments.employeeId, treatmentId: t.employeeTreatments.treatmentId })
      .from(t.employeeTreatments)
      .innerJoin(t.users, eq(t.users.id, t.employeeTreatments.employeeId))
      .where(and(eq(t.users.centerId, c.id), eq(t.users.active, true), eq(t.users.role, "employee"))),
    db
      .select({ id: t.users.id, firstName: t.users.firstName, lastName: t.users.lastName, jobTitle: t.users.jobTitle })
      .from(t.users)
      .where(and(eq(t.users.centerId, c.id), eq(t.users.role, "employee"), eq(t.users.active, true)))
      .orderBy(asc(t.users.firstName)),
    activePromotions(c.id, c.timezone),
  ]);
  // Sono prenotabili solo i trattamenti con almeno un operatore attivo.
  const bookable = treatments
    .map((tr) => ({
      id: tr.id,
      name: tr.name,
      description: tr.description,
      durationMinutes: tr.durationMinutes,
      priceCents: tr.priceCents,
      categoryId: tr.categoryId,
      imageId: tr.imageId,
      cancellationHours: tr.cancellationHours ?? c.cancellationHours,
      employeeIds: links.filter((l) => l.treatmentId === tr.id).map((l) => l.employeeId),
    }))
    .filter((tr) => tr.employeeIds.length > 0);
  const promo = promos.find((p) => p.id === sp.promo) ?? null;

  return (
    <>
      <PageHeader eyebrow="Prenotazione" title="Prenota un trattamento" />
      {bookable.length === 0 ? (
        <Empty title="Nessun trattamento prenotabile" text="Il centro non ha ancora pubblicato trattamenti prenotabili online." />
      ) : (
        <BookingWizard
          categories={categories.map((x) => ({ id: x.id, name: x.name }))}
          treatments={bookable}
          employees={employees}
          promo={promo ? { id: promo.id, title: promo.title, treatmentId: promo.treatmentId, promoPriceCents: promo.promoPriceCents } : null}
          initialTreatmentId={promo?.treatmentId ?? sp.trattamento ?? null}
          tz={c.timezone}
          today={localDate(new Date(), c.timezone)}
          horizonDays={c.bookingHorizonDays}
        />
      )}
    </>
  );
}
