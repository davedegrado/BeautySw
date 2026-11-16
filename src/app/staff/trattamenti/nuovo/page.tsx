import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { DEFAULT_PERMISSIONS } from "@/db/schema";
import { Empty, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/session";
import { NewTreatmentForm } from "./form";

export const metadata = { title: "Nuovo trattamento" };

export default async function NewTreatment() {
  const s = await requireRole("employee");
  const categories = await db.select({ id: t.categories.id, name: t.categories.name }).from(t.categories).where(eq(t.categories.centerId, s.center.id)).orderBy(asc(t.categories.sort));
  return (
    <>
      <PageHeader eyebrow="Il mio listino" title="Nuovo trattamento" subtitle="Il trattamento viene salvato e associato al tuo profilo. Sarà prenotabile dai clienti dopo l'approvazione dell'amministrazione." />
      {(s.user.permissions ?? DEFAULT_PERMISSIONS).createTreatments ? (
        <div className="card max-w-2xl p-6 sm:p-8">
          <NewTreatmentForm categories={categories} />
        </div>
      ) : (
        <Empty title="Funzione non abilitata" text="Il tuo profilo non è abilitato alla creazione di trattamenti. Rivolgiti all'amministrazione." />
      )}
    </>
  );
}
