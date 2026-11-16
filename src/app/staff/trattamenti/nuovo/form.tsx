"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { staffSaveTreatmentAction } from "@/actions/staff";
import { ActionForm, ImageField } from "@/components/client-ui";
import { Check, Field } from "@/components/ui";

export function NewTreatmentForm({ categories }: { categories: { id: string; name: string }[] }): ReactNode {
  const router = useRouter();
  return (
    <ActionForm action={staffSaveTreatmentAction} submitLabel="Salva trattamento" onSuccess={() => router.push("/staff/trattamenti")}>
      <Field label="Nome del trattamento">
        <input name="name" required maxLength={120} className="input" placeholder="Es. Massaggio viso Kobido" />
      </Field>
      <Field label="Descrizione">
        <textarea name="description" className="input" maxLength={3000} placeholder="Descrivi il trattamento, i benefici e a chi è consigliato." />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Categoria">
          <select name="categoryId" className="input" defaultValue="">
            <option value="">— Nessuna —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Durata (minuti)">
          <input name="duration" type="number" min={5} max={600} step={5} required defaultValue={60} className="input" />
        </Field>
        <Field label="Prezzo (€)">
          <input name="price" inputMode="decimal" required className="input" placeholder="0,00" />
        </Field>
      </div>
      <ImageField label="Immagine (facoltativa)" />
      <Field label="Note (facoltative)" hint="Visibili solo allo staff: prodotti utilizzati, controindicazioni, preparazione…">
        <textarea name="notes" className="input !min-h-16" maxLength={1000} />
      </Field>
      <Check name="active" label="Trattamento disponibile" hint="Disattiva se il trattamento non è ancora pronto per essere offerto." defaultChecked />
    </ActionForm>
  );
}
