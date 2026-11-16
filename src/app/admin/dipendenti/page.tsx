import Link from "next/link";
import { and, asc, eq, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db, t } from "@/db";
import { saveEmployeeAction } from "@/actions/admin";
import { FormDialog } from "@/components/client-ui";
import { EmployeeFields } from "@/components/forms";
import { Avatar, Empty, PageHeader } from "@/components/ui";
import { fullName } from "@/lib/format";
import { requireRole } from "@/lib/session";

export const metadata = { title: "Dipendenti" };

export default async function EmployeesPage() {
  const s = await requireRole("admin");
  const U = t.users;
  const [rows, treatments] = await Promise.all([
    db
      .select({
        u: U,
        treatments: sql<number>`(select count(*)::int from employee_treatments et where et.employee_id = ${U.id})`,
        upcoming: sql<number>`(select count(*)::int from appointments a where a.employee_id = ${U.id} and a.status = 'confirmed' and a.start_at >= now())`,
      })
      .from(U)
      .where(and(eq(U.centerId, s.center.id), eq(U.role, "employee")))
      .orderBy(asc(U.firstName)),
    db.select({ id: t.treatments.id, name: t.treatments.name }).from(t.treatments).where(eq(t.treatments.centerId, s.center.id)).orderBy(asc(t.treatments.name)),
  ]);
  return (
    <>
      <PageHeader eyebrow="Il team" title="Dipendenti" subtitle="Profili, permessi, trattamenti offerti e turni di lavoro.">
        <FormDialog trigger={<><Plus className="h-3.5 w-3.5" /> Nuovo dipendente</>} title="Nuovo dipendente" action={saveEmployeeAction} submitLabel="Crea profilo" wide>
          <EmployeeFields treatments={treatments} />
        </FormDialog>
      </PageHeader>
      {rows.length === 0 ? (
        <Empty title="Nessun dipendente" text="Crea il primo profilo per iniziare a ricevere prenotazioni." />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ u, treatments, upcoming }) => (
            <Link key={u.id} href={`/admin/dipendenti/${u.id}`} className={`card group p-6 transition duration-300 hover:-translate-y-0.5 hover:border-gold ${u.active ? "" : "opacity-60"}`}>
              <div className="flex items-center gap-4">
                <Avatar user={u} size="lg" color={u.color} />
                <div className="min-w-0">
                  <h2 className="truncate text-2xl leading-tight">{fullName(u)}</h2>
                  <p className="truncate text-sm text-smoke">{u.jobTitle || "Beauty specialist"}</p>
                </div>
              </div>
              <div className="gold-line my-4" />
              <div className="flex items-center justify-between text-sm">
                <span>
                  <strong className="font-serif text-2xl font-medium">{treatments}</strong> <span className="text-smoke">trattamenti</span>
                </span>
                <span>
                  <strong className="font-serif text-2xl font-medium">{upcoming}</strong> <span className="text-smoke">in agenda</span>
                </span>
                {!u.active && <span className="badge badge-red">Disattivato</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
