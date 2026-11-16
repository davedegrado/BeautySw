import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { Check as CheckIcon, Clock, Pencil, Plus, Trash2 } from "lucide-react";
import { db, t } from "@/db";
import type { Treatment } from "@/db/schema";
import { deleteCategoryAction, deleteTreatmentAction, saveCategoryAction, saveTreatmentAction } from "@/actions/admin";
import { ActionButton, FormDialog } from "@/components/client-ui";
import { TreatmentFields } from "@/components/forms";
import { Cover, Empty, Field, PageHeader, StatusBadge } from "@/components/ui";
import { duration, eur, fullName } from "@/lib/format";
import { requireRole } from "@/lib/session";

export const metadata = { title: "Trattamenti" };

type Emp = { id: string; firstName: string; lastName: string };

function AdminTreatmentFields({ treatment, categories, employees, selected, center }: { treatment?: Treatment; categories: { id: string; name: string }[]; employees: Emp[]; selected: string[]; center: { cancellationHours: number } }) {
  return (
    <>
      <TreatmentFields treatment={treatment} categories={categories} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Stato">
          <select name="status" defaultValue={treatment?.status ?? "approved"} className="input">
            <option value="approved">Approvato (prenotabile)</option>
            <option value="pending">In attesa di approvazione</option>
            <option value="rejected">Non approvato</option>
          </select>
        </Field>
        <Field label="Disdetta gratuita (ore prima)" hint={`Vuoto = regola del centro (${center.cancellationHours} ore).`}>
          <input name="cancellationHours" type="number" min={0} max={720} defaultValue={treatment?.cancellationHours ?? ""} className="input" placeholder={String(center.cancellationHours)} />
        </Field>
      </div>
      <fieldset>
        <legend className="label">Dipendenti che eseguono il trattamento</legend>
        <div className="grid gap-2 rounded-lg border border-line bg-white p-4 sm:grid-cols-2">
          {employees.length === 0 && <p className="text-sm text-smoke">Nessun dipendente attivo.</p>}
          {employees.map((e) => (
            <label key={e.id} className="flex items-center gap-2.5 text-sm">
              <input type="checkbox" name="employeeIds" value={e.id} defaultChecked={selected.includes(e.id)} className="check" />
              {fullName(e)}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}

export default async function TreatmentsPage({ searchParams }: { searchParams: Promise<{ cat?: string; stato?: string }> }) {
  const s = await requireRole("admin");
  const sp = await searchParams;
  const cid = s.center.id;
  const [categories, treatments, links, employees, creators] = await Promise.all([
    db.select().from(t.categories).where(eq(t.categories.centerId, cid)).orderBy(asc(t.categories.sort)),
    db.select().from(t.treatments).where(eq(t.treatments.centerId, cid)).orderBy(asc(t.treatments.name)),
    db.select().from(t.employeeTreatments),
    db.select({ id: t.users.id, firstName: t.users.firstName, lastName: t.users.lastName }).from(t.users).where(and(eq(t.users.centerId, cid), eq(t.users.role, "employee"), eq(t.users.active, true))).orderBy(asc(t.users.firstName)),
    db.select({ id: t.users.id, firstName: t.users.firstName, lastName: t.users.lastName, role: t.users.role }).from(t.users).where(eq(t.users.centerId, cid)),
  ]);
  const cats = categories.map((c) => ({ id: c.id, name: c.name }));
  const pending = treatments.filter((x) => x.status === "pending");
  const list = treatments.filter((x) => (sp.stato === "pending" ? x.status === "pending" : true) && (sp.cat ? (sp.cat === "none" ? !x.categoryId : x.categoryId === sp.cat) : true));
  const empOf = (id: string) => links.filter((l) => l.treatmentId === id).map((l) => l.employeeId);
  const name = (id: string) => employees.find((e) => e.id === id)?.firstName;

  return (
    <>
      <PageHeader eyebrow="Listino" title="Trattamenti" subtitle="Prezzi, durate, categorie e dipendenti che eseguono ogni trattamento.">
        <FormDialog trigger="Categorie" triggerClass="btn btn-outline" title="Categorie" action={saveCategoryAction} submitLabel="Aggiungi categoria">
          <ul className="divide-y divide-cream rounded-lg border border-line bg-white text-sm">
            {categories.length === 0 && <li className="px-4 py-3 text-smoke">Nessuna categoria.</li>}
            {categories.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-4 py-2">
                {c.name}
                <ActionButton action={deleteCategoryAction} fields={{ id: c.id }} className="icon-btn !text-danger" ariaLabel={`Elimina ${c.name}`} confirm={`Eliminare la categoria “${c.name}”? I trattamenti collegati resteranno senza categoria.`}>
                  <Trash2 className="h-4 w-4" />
                </ActionButton>
              </li>
            ))}
          </ul>
          <Field label="Nuova categoria">
            <input name="name" required maxLength={60} className="input" placeholder="Es. Rituali Luxury" />
          </Field>
        </FormDialog>
        <FormDialog trigger={<><Plus className="h-3.5 w-3.5" /> Nuovo trattamento</>} title="Nuovo trattamento" action={saveTreatmentAction} submitLabel="Crea trattamento" wide>
          <AdminTreatmentFields categories={cats} employees={employees} selected={[]} center={s.center} />
        </FormDialog>
      </PageHeader>

      <div className="scroll-x -mx-4 mb-6 flex gap-2 px-4 pb-1 sm:mx-0 sm:px-0">
        <Link href="/admin/trattamenti" className={`tab ${!sp.cat && !sp.stato ? "tab-active" : ""}`}>
          Tutti · {treatments.length}
        </Link>
        {pending.length > 0 && (
          <Link href="/admin/trattamenti?stato=pending" className={`tab !border-gold ${sp.stato === "pending" ? "tab-active" : ""}`}>
            Da approvare · {pending.length}
          </Link>
        )}
        {categories.map((c) => (
          <Link key={c.id} href={`/admin/trattamenti?cat=${c.id}`} className={`tab ${sp.cat === c.id ? "tab-active" : ""}`}>
            {c.name}
          </Link>
        ))}
        {treatments.some((x) => !x.categoryId) && (
          <Link href="/admin/trattamenti?cat=none" className={`tab ${sp.cat === "none" ? "tab-active" : ""}`}>
            Senza categoria
          </Link>
        )}
      </div>

      {list.length === 0 ? (
        <Empty title="Nessun trattamento" text="Crea il primo trattamento del tuo listino." />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((tr) => {
            const emps = empOf(tr.id);
            const creator = creators.find((c) => c.id === tr.createdBy);
            return (
              <article key={tr.id} className={`card group flex flex-col overflow-hidden ${tr.active ? "" : "opacity-70"}`}>
                <Cover imageId={tr.imageId} alt={tr.name} className="h-32">
                  <div className="absolute left-3 top-3 flex gap-1.5">
                    {tr.status !== "approved" && <StatusBadge status={tr.status} />}
                    {!tr.active && <span className="badge">Disattivato</span>}
                  </div>
                </Cover>
                <div className="flex flex-1 flex-col p-5">
                  <p className="eyebrow mb-1">{categories.find((c) => c.id === tr.categoryId)?.name ?? "Senza categoria"}</p>
                  <h2 className="text-2xl leading-tight">{tr.name}</h2>
                  <p className="mt-1.5 line-clamp-2 text-sm text-smoke">{tr.description}</p>
                  {creator?.role === "employee" && <p className="mt-2 text-xs text-gold-deep">Proposto da {fullName(creator)}</p>}
                  <p className="mt-2 text-xs text-smoke">{emps.length ? `Eseguito da: ${emps.map(name).filter(Boolean).join(", ")}` : "Nessun dipendente assegnato: non prenotabile"}</p>
                  <div className="mt-auto flex items-center justify-between pt-4">
                    <span className="flex items-center gap-1.5 text-sm text-smoke">
                      <Clock className="h-4 w-4 text-gold" strokeWidth={1.4} /> {duration(tr.durationMinutes)}
                    </span>
                    <span className="font-serif text-2xl text-gold-deep">{eur(tr.priceCents)}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 border-t border-cream pt-3">
                    <FormDialog
                      trigger={tr.status === "pending" ? <><CheckIcon className="h-3.5 w-3.5" /> Rivedi e approva</> : <><Pencil className="h-3.5 w-3.5" /> Modifica</>}
                      triggerClass={`btn btn-sm ${tr.status === "pending" ? "btn-gold" : "btn-outline"}`}
                      title={tr.status === "pending" ? "Approva trattamento" : "Modifica trattamento"}
                      action={saveTreatmentAction}
                      wide
                    >
                      {tr.status === "pending" && <p className="rounded-lg bg-gold/10 px-4 py-3 text-sm">Controlla i dati, scegli i dipendenti che possono eseguirlo e imposta lo stato su “Approvato” per renderlo prenotabile.</p>}
                      <AdminTreatmentFields treatment={tr.status === "pending" ? { ...tr, status: "approved" } : tr} categories={cats} employees={employees} selected={emps} center={s.center} />
                    </FormDialog>
                    <ActionButton action={deleteTreatmentAction} fields={{ id: tr.id }} className="icon-btn ml-auto !text-danger" ariaLabel="Elimina" confirm={`Eliminare “${tr.name}”? Se ha uno storico di appuntamenti verrà solo disattivato.`}>
                      <Trash2 className="h-4 w-4" />
                    </ActionButton>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
