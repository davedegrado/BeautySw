import { asc, desc, eq } from "drizzle-orm";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { db, t } from "@/db";
import { PROMO_CATEGORIES, type Promotion } from "@/db/schema";
import { deletePromotionAction, savePromotionAction } from "@/actions/admin";
import { PromoCard } from "@/components/cards";
import { ActionButton, FormDialog, ImageField } from "@/components/client-ui";
import { Check, Empty, Field, PageHeader } from "@/components/ui";
import { addDays, localDate } from "@/lib/dates";
import { requireRole } from "@/lib/session";

export const metadata = { title: "Promozioni" };

const money = (c: number | null | undefined) => (c == null ? "" : (c / 100).toString().replace(".", ","));

function PromoFields({ promo, treatments, today }: { promo?: Promotion; treatments: { id: string; name: string }[]; today: string }) {
  return (
    <>
      {promo && <input type="hidden" name="id" value={promo.id} />}
      <Field label="Titolo">
        <input name="title" required maxLength={140} defaultValue={promo?.title} className="input" />
      </Field>
      <Field label="Descrizione">
        <textarea name="description" defaultValue={promo?.description} className="input" maxLength={3000} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Categoria">
          <select name="category" defaultValue={promo?.category ?? "massaggi"} className="input">
            {PROMO_CATEGORIES.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Trattamento collegato" hint="Se collegato, “Prenota ora” applica il prezzo promozionale.">
          <select name="treatmentId" defaultValue={promo?.treatmentId ?? ""} className="input">
            <option value="">— Nessuno (prodotti, pacchetti…) —</option>
            {treatments.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Prezzo originale (€)">
          <input name="originalPrice" inputMode="decimal" defaultValue={money(promo?.originalPriceCents)} className="input" />
        </Field>
        <Field label="Prezzo promozionale (€)" hint="La percentuale di sconto è calcolata in automatico.">
          <input name="promoPrice" inputMode="decimal" defaultValue={money(promo?.promoPriceCents)} className="input" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valida dal">
          <input name="startsOn" type="date" required defaultValue={promo?.startsOn ?? today} className="input" />
        </Field>
        <Field label="Fino al">
          <input name="endsOn" type="date" required defaultValue={promo?.endsOn ?? addDays(today, 30)} className="input" />
        </Field>
      </div>
      <ImageField current={promo?.imageId} />
      <Check name="active" label="Promozione pubblicata" defaultChecked={promo?.active ?? true} />
      <Check name="notify" label="Invia una notifica push a tutti i clienti" hint="Annuncia la promozione al salvataggio." defaultChecked={!promo} />
    </>
  );
}

export default async function PromotionsAdmin() {
  const s = await requireRole("admin");
  const today = localDate(new Date(), s.center.timezone);
  const [promos, treatments] = await Promise.all([
    db.select().from(t.promotions).where(eq(t.promotions.centerId, s.center.id)).orderBy(desc(t.promotions.endsOn)),
    db.select({ id: t.treatments.id, name: t.treatments.name }).from(t.treatments).where(eq(t.treatments.centerId, s.center.id)).orderBy(asc(t.treatments.name)),
  ]);
  const state = (p: Promotion) => (!p.active ? ["Bozza", ""] : p.endsOn < today ? ["Scaduta", "badge-red"] : p.startsOn > today ? ["Programmata", "badge-gold"] : ["Attiva", "badge-green"]);
  return (
    <>
      <PageHeader eyebrow="Marketing" title="Promozioni" subtitle="Crea offerte, pacchetti e promo prodotti. Puoi annunciarle ai clienti con una notifica push.">
        <FormDialog trigger={<><Plus className="h-3.5 w-3.5" /> Nuova promozione</>} title="Nuova promozione" action={savePromotionAction} submitLabel="Pubblica" wide>
          <PromoFields treatments={treatments} today={today} />
        </FormDialog>
      </PageHeader>
      {promos.length === 0 ? (
        <Empty title="Nessuna promozione" text="Crea la tua prima promozione per farla conoscere ai clienti." />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {promos.map((p) => {
            const [label, cls] = state(p);
            return (
              <div key={p.id} className={p.active && p.endsOn >= today ? "" : "opacity-70"}>
                <PromoCard
                  promo={p}
                  action={
                    <div className="flex items-center gap-2 border-t border-cream pt-3">
                      <span className={`badge ${cls}`}>{label}</span>
                      <span className="ml-auto" />
                      <FormDialog trigger={<><Pencil className="h-3.5 w-3.5" /> Modifica</>} triggerClass="btn btn-outline btn-sm" title="Modifica promozione" action={savePromotionAction} wide>
                        <PromoFields promo={p} treatments={treatments} today={today} />
                      </FormDialog>
                      <ActionButton action={deletePromotionAction} fields={{ id: p.id }} className="icon-btn !text-danger" ariaLabel="Elimina" confirm={`Eliminare la promozione “${p.title}”?`}>
                        <Trash2 className="h-4 w-4" />
                      </ActionButton>
                    </div>
                  }
                />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
