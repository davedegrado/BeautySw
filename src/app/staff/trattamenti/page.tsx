import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { Clock, Pencil, Plus } from "lucide-react";
import { db, t } from "@/db";
import { DEFAULT_PERMISSIONS } from "@/db/schema";
import { staffSaveTreatmentAction } from "@/actions/staff";
import { FormDialog } from "@/components/client-ui";
import { TreatmentFields } from "@/components/forms";
import { Cover, Empty, PageHeader, StatusBadge } from "@/components/ui";
import { duration, eur } from "@/lib/format";
import { requireRole } from "@/lib/session";

export const metadata = { title: "I miei trattamenti" };

export default async function StaffTreatments() {
  const s = await requireRole("employee");
  const canCreate = (s.user.permissions ?? DEFAULT_PERMISSIONS).createTreatments;
  const [rows, categories] = await Promise.all([
    db
      .select({ tr: t.treatments, category: t.categories.name })
      .from(t.employeeTreatments)
      .innerJoin(t.treatments, eq(t.treatments.id, t.employeeTreatments.treatmentId))
      .leftJoin(t.categories, eq(t.categories.id, t.treatments.categoryId))
      .where(eq(t.employeeTreatments.employeeId, s.user.id))
      .orderBy(asc(t.treatments.name)),
    db.select({ id: t.categories.id, name: t.categories.name }).from(t.categories).where(eq(t.categories.centerId, s.center.id)).orderBy(asc(t.categories.sort)),
  ]);
  return (
    <>
      <PageHeader eyebrow="Il mio listino" title="I miei trattamenti" subtitle="I trattamenti che offri. Quelli proposti da te sono prenotabili dopo l'approvazione dell'amministrazione.">
        {canCreate && (
          <Link href="/staff/trattamenti/nuovo" className="btn btn-gold !px-6 !py-3.5">
            <Plus className="h-4 w-4" /> Nuovo trattamento
          </Link>
        )}
      </PageHeader>
      {rows.length === 0 ? (
        <Empty title="Nessun trattamento associato" text="Proponi il tuo primo trattamento o chiedi all'amministrazione di associarti a quelli esistenti." />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ tr, category }) => (
            <article key={tr.id} className="card group flex flex-col overflow-hidden">
              <Cover imageId={tr.imageId} alt={tr.name} className="h-32">
                <div className="absolute left-3 top-3 flex gap-1.5">
                  {tr.status !== "approved" && <StatusBadge status={tr.status} />}
                  {!tr.active && <span className="badge">Non disponibile</span>}
                </div>
              </Cover>
              <div className="flex flex-1 flex-col p-5">
                <p className="eyebrow mb-1">{category ?? "Senza categoria"}</p>
                <h3 className="text-2xl leading-tight">{tr.name}</h3>
                <p className="mt-1.5 line-clamp-2 text-sm text-smoke">{tr.description}</p>
                <div className="mt-auto flex items-center justify-between pt-4">
                  <span className="flex items-center gap-1.5 text-sm text-smoke">
                    <Clock className="h-4 w-4 text-gold" strokeWidth={1.4} /> {duration(tr.durationMinutes)}
                  </span>
                  <span className="font-serif text-2xl text-gold-deep">{eur(tr.priceCents)}</span>
                </div>
                {canCreate && tr.createdBy === s.user.id && (
                  <div className="mt-3 border-t border-cream pt-3">
                    <FormDialog trigger={<><Pencil className="h-3.5 w-3.5" /> Modifica</>} triggerClass="btn btn-outline btn-sm" title="Modifica trattamento" action={staffSaveTreatmentAction} submitLabel="Salva e invia in revisione" wide>
                      <TreatmentFields treatment={tr} categories={categories} />
                    </FormDialog>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
