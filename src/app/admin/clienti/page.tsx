import Link from "next/link";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Cake, Plus, Search } from "lucide-react";
import { db, t } from "@/db";
import { saveClientAction } from "@/actions/admin";
import { FormDialog } from "@/components/client-ui";
import { ClientFields } from "@/components/forms";
import { Avatar, Empty, PageHeader } from "@/components/ui";
import { fmtDay, localDate } from "@/lib/dates";
import { fullName } from "@/lib/format";
import { requireRole } from "@/lib/session";

export const metadata = { title: "Clienti" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; ordine?: string }> }) {
  const s = await requireRole("admin");
  const { q = "", ordine = "nome" } = await searchParams;
  const like = `%${q.trim()}%`;
  const U = t.users;
  const visits = sql<number>`(select count(*)::int from appointments a where a.client_id = ${U.id} and a.status = 'completed')`;
  const lastVisit = sql<Date | null>`(select max(a.start_at) from appointments a where a.client_id = ${U.id} and a.status = 'completed')`;
  const rows = await db
    .select({ u: U, visits, lastVisit })
    .from(U)
    .where(and(eq(U.centerId, s.center.id), eq(U.role, "client"), q.trim() ? or(ilike(U.firstName, like), ilike(U.lastName, like), ilike(U.email, like), ilike(U.phone, like), ilike(sql`${U.firstName} || ' ' || ${U.lastName}`, like)) : undefined))
    .orderBy(...(ordine === "punti" ? [desc(U.pointsBalance)] : ordine === "recenti" ? [desc(U.createdAt)] : [asc(U.firstName), asc(U.lastName)]))
    .limit(500);
  const today = localDate(new Date(), s.center.timezone);
  const month = today.slice(5, 7);

  return (
    <>
      <PageHeader eyebrow="Anagrafica" title="Clienti" subtitle={`${rows.length} ${rows.length === 1 ? "cliente" : "clienti"}${q ? ` per “${q}”` : " registrati"}`}>
        <FormDialog trigger={<><Plus className="h-3.5 w-3.5" /> Nuovo cliente</>} title="Nuovo cliente" action={saveClientAction} submitLabel="Crea cliente">
          <ClientFields />
        </FormDialog>
      </PageHeader>
      <form className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-smoke" />
          <input name="q" defaultValue={q} placeholder="Cerca per nome, email o telefono…" className="input !pl-9" />
        </div>
        <input type="hidden" name="ordine" value={ordine} />
        <button className="btn btn-dark">Cerca</button>
        <div className="flex gap-1.5">
          {[["nome", "A–Z"], ["punti", "Più fedeli"], ["recenti", "Più recenti"]].map(([k, l]) => (
            <Link key={k} href={`/admin/clienti?ordine=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={`tab ${ordine === k ? "tab-active" : ""}`}>
              {l}
            </Link>
          ))}
        </div>
      </form>
      {rows.length === 0 ? (
        <Empty title="Nessun cliente trovato" text={q ? "Prova con un altro termine di ricerca." : "Crea la prima scheda cliente o invita i clienti a registrarsi."} />
      ) : (
        <div className="card scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Contatti</th>
                <th>Compleanno</th>
                <th>Visite</th>
                <th>Ultima visita</th>
                <th className="text-right">Punti</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ u, visits, lastVisit }) => (
                <tr key={u.id} className={u.active ? "" : "opacity-50"}>
                  <td>
                    <Link href={`/admin/clienti/${u.id}`} className="flex items-center gap-3 hover:text-gold-deep">
                      <Avatar user={u} size="sm" />
                      <span className="font-medium">{fullName(u)}</span>
                      {!u.passwordHash && <span className="badge">Senza accesso</span>}
                      {!u.active && <span className="badge badge-red">Disattivato</span>}
                    </Link>
                  </td>
                  <td className="text-smoke">
                    {u.email}
                    {u.email && u.phone && <br />}
                    {u.phone}
                  </td>
                  <td className="whitespace-nowrap">
                    {u.birthDate ? (
                      <span className={u.birthDate.slice(5, 7) === month ? "text-gold-deep" : ""}>
                        {u.birthDate.slice(5, 7) === month && <Cake className="mr-1 inline h-3.5 w-3.5" />}
                        {fmtDay(u.birthDate, "d MMMM")}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{visits}</td>
                  <td className="whitespace-nowrap text-smoke">{lastVisit ? fmtDay(new Date(lastVisit).toISOString().slice(0, 10), "d MMM yyyy") : "—"}</td>
                  <td className="text-right font-serif text-xl text-gold-deep">{u.pointsBalance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
