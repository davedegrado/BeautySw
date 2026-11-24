import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { db, t } from "@/db";
import { PromoCard } from "@/components/cards";
import { Empty, PageHeader } from "@/components/ui";
import { localDate } from "@/lib/dates";
import { requireRole } from "@/lib/session";

export const metadata = { title: "Promozioni" };

/** Promozioni attive o programmate collegate ai trattamenti che il dipendente esegue. */
export default async function StaffPromotions() {
  const s = await requireRole("employee");
  const today = localDate(new Date(), s.center.timezone);
  const mine = await db
    .select({ id: t.employeeTreatments.treatmentId, name: t.treatments.name })
    .from(t.employeeTreatments)
    .innerJoin(t.treatments, eq(t.treatments.id, t.employeeTreatments.treatmentId))
    .where(eq(t.employeeTreatments.employeeId, s.user.id));
  const promos = mine.length
    ? await db
        .select()
        .from(t.promotions)
        .where(and(eq(t.promotions.centerId, s.center.id), eq(t.promotions.active, true), gte(t.promotions.endsOn, today), inArray(t.promotions.treatmentId, mine.map((m) => m.id))))
        .orderBy(asc(t.promotions.startsOn))
    : [];
  const treatmentName = (id: string | null) => mine.find((m) => m.id === id)?.name;

  return (
    <>
      <PageHeader eyebrow="Il mio listino" title="Promozioni" subtitle="Le promozioni in corso e in arrivo sui trattamenti che esegui: così sai cosa propongono i clienti quando prenotano." />
      {promos.length === 0 ? (
        <Empty title="Nessuna promozione sui tuoi trattamenti" text="Quando l'amministrazione pubblicherà una promozione collegata a uno dei tuoi trattamenti, la troverai qui." />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {promos.map((p) => (
            <PromoCard
              key={p.id}
              promo={p}
              action={
                <div className="flex flex-wrap items-center gap-2 border-t border-cream pt-3">
                  <span className={`badge ${p.startsOn > today ? "badge-gold" : "badge-green"}`}>{p.startsOn > today ? "Programmata" : "In corso"}</span>
                  <span className="text-xs text-smoke">Su: {treatmentName(p.treatmentId)}</span>
                </div>
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
