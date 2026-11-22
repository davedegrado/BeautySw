import Link from "next/link";
import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { Crown, Pencil, Plus, Trash2 } from "lucide-react";
import { db, t } from "@/db";
import type { Reward } from "@/db/schema";
import { adjustPointsAction, cancelRedemptionAction, deleteRewardAction, saveLoyaltySettingsAction, saveRewardAction, useRedemptionAction } from "@/actions/admin";
import { ActionButton, ActionForm, FormDialog } from "@/components/client-ui";
import { Avatar, Check, Field, PageHeader, SectionTitle, Stat, StatusBadge } from "@/components/ui";
import { fmt } from "@/lib/dates";
import { fullName } from "@/lib/format";
import { requireRole } from "@/lib/session";

export const metadata = { title: "Programma fedeltà" };

function RewardFields({ reward }: { reward?: Reward }) {
  return (
    <>
      {reward && <input type="hidden" name="id" value={reward.id} />}
      <Field label="Nome del premio">
        <input name="name" required maxLength={120} defaultValue={reward?.name} className="input" placeholder="Es. Massaggio relax gratuito" />
      </Field>
      <Field label="Descrizione">
        <textarea name="description" defaultValue={reward?.description} className="input !min-h-16" maxLength={600} />
      </Field>
      <Field label="Punti necessari">
        <input name="pointsCost" type="number" min={1} required defaultValue={reward?.pointsCost} className="input" />
      </Field>
      <Check name="active" label="Premio attivo e riscattabile" defaultChecked={reward?.active ?? true} />
    </>
  );
}

export default async function LoyaltyAdmin() {
  const s = await requireRole("admin");
  const c = s.center;
  const tz = c.timezone;
  const P = t.pointsTransactions;
  const [rewards, top, redemptions, [totals], clients] = await Promise.all([
    db.select().from(t.rewards).where(eq(t.rewards.centerId, c.id)).orderBy(asc(t.rewards.pointsCost)),
    db.select().from(t.users).where(and(eq(t.users.centerId, c.id), eq(t.users.role, "client"), gt(t.users.pointsBalance, 0))).orderBy(desc(t.users.pointsBalance)).limit(10),
    db
      .select({ r: t.redemptions, firstName: t.users.firstName, lastName: t.users.lastName })
      .from(t.redemptions)
      .innerJoin(t.users, eq(t.users.id, t.redemptions.userId))
      .where(eq(t.redemptions.centerId, c.id))
      .orderBy(desc(t.redemptions.createdAt))
      .limit(30),
    db
      .select({
        earned: sql<number>`coalesce(sum(case when ${P.delta} > 0 then ${P.delta} else 0 end), 0)::int`,
        redeemed: sql<number>`coalesce(sum(case when ${P.type} = 'redeem' then -${P.delta} else 0 end), 0)::int`,
      })
      .from(P)
      .where(eq(P.centerId, c.id)),
    db.select({ id: t.users.id, firstName: t.users.firstName, lastName: t.users.lastName, pointsBalance: t.users.pointsBalance }).from(t.users).where(and(eq(t.users.centerId, c.id), eq(t.users.role, "client"), eq(t.users.active, true))).orderBy(asc(t.users.firstName)),
  ]);
  const [{ circulating }] = await db.select({ circulating: sql<number>`coalesce(sum(${t.users.pointsBalance}), 0)::int` }).from(t.users).where(and(eq(t.users.centerId, c.id), eq(t.users.role, "client")));
  const toUse = redemptions.filter((x) => x.r.status === "active").length;

  return (
    <>
      <PageHeader eyebrow="Luxury Rewards" title="Programma fedeltà" subtitle="Regole di accumulo, premi, riscatti e clienti più fidelizzati.">
        <FormDialog trigger="Assegna / sottrai punti" triggerClass="btn btn-outline" title="Modifica punti di un cliente" action={adjustPointsAction} submitLabel="Conferma">
          <Field label="Cliente">
            <select name="userId" required className="input" defaultValue="">
              <option value="" disabled>
                Seleziona cliente…
              </option>
              {clients.map((u) => (
                <option key={u.id} value={u.id}>
                  {fullName(u)} · {u.pointsBalance} pt
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Operazione">
              <select name="direction" className="input" defaultValue="add">
                <option value="add">Assegna punti</option>
                <option value="subtract">Sottrai punti (errore / rimborso)</option>
              </select>
            </Field>
            <Field label="Punti">
              <input name="amount" type="number" min={1} required className="input" />
            </Field>
          </div>
          <Field label="Motivazione" hint="Visibile al cliente nello storico punti.">
            <input name="reason" required maxLength={200} className="input" />
          </Field>
        </FormDialog>
        <FormDialog trigger={<><Plus className="h-3.5 w-3.5" /> Nuovo premio</>} title="Nuovo premio" action={saveRewardAction} submitLabel="Crea premio">
          <RewardFields />
        </FormDialog>
      </PageHeader>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Punti assegnati" value={totals.earned.toLocaleString("it-IT")} hint="dall'avvio del programma" icon={<Crown className="h-5 w-5" strokeWidth={1.3} />} />
        <Stat label="Punti riscattati" value={totals.redeemed.toLocaleString("it-IT")} />
        <Stat label="Punti in circolazione" value={circulating.toLocaleString("it-IT")} hint="saldo totale dei clienti" />
        <Stat label="Premi da consegnare" value={toUse} hint="riscatti non ancora utilizzati" />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-8">
          <section className="card p-6">
            <h2 className="mb-1 text-2xl">Regole di accumulo</h2>
            <p className="mb-4 text-sm text-smoke">I punti vengono accreditati quando un trattamento viene segnato come completato, in base al prezzo di listino.</p>
            <ActionForm action={saveLoyaltySettingsAction} submitLabel="Salva regole">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Punti per ogni euro di trattamento" hint="Es. 1 = 1 punto per euro · 0,5 = 1 punto ogni 2 euro.">
                  <input name="pointsPerEuro" inputMode="decimal" required defaultValue={(c.pointsPerEuro / 100).toString().replace(".", ",")} className="input" />
                </Field>
                <Field label="Punti fissi per trattamento" hint="Bonus aggiunto a ogni trattamento completato.">
                  <input name="pointsPerTreatment" type="number" min={0} required defaultValue={c.pointsPerTreatment} className="input" />
                </Field>
              </div>
            </ActionForm>
          </section>

          <section>
            <SectionTitle title="Premi" />
            {rewards.length === 0 ? (
              <p className="text-sm text-smoke">Nessun premio configurato.</p>
            ) : (
              <ul className="space-y-3">
                {rewards.map((r) => (
                  <li key={r.id} className={`card flex items-center gap-4 p-4 ${r.active ? "" : "opacity-60"}`}>
                    <span className="flex h-14 w-20 shrink-0 flex-col items-center justify-center rounded-lg bg-ink text-gold-light">
                      <span className="font-serif text-xl leading-none">{r.pointsCost.toLocaleString("it-IT")}</span>
                      <span className="text-[0.55rem] uppercase tracking-[0.2em] text-ivory/50">punti</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-serif text-xl leading-tight">{r.name}</span>
                      <span className="block truncate text-xs text-smoke">{r.active ? r.description : "Non attivo"}</span>
                    </span>
                    <FormDialog trigger={<Pencil className="h-4 w-4" />} triggerClass="icon-btn" ariaLabel="Modifica premio" title="Modifica premio" action={saveRewardAction}>
                      <RewardFields reward={r} />
                    </FormDialog>
                    <ActionButton action={deleteRewardAction} fields={{ id: r.id }} className="icon-btn !text-danger" ariaLabel="Elimina premio" confirm={`Eliminare il premio “${r.name}”? I riscatti già effettuati restano validi.`}>
                      <Trash2 className="h-4 w-4" />
                    </ActionButton>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-8">
          <section>
            <SectionTitle title="Clienti più fidelizzati" />
            {top.length === 0 ? (
              <p className="text-sm text-smoke">Ancora nessun cliente con punti.</p>
            ) : (
              <ol className="card divide-y divide-cream">
                {top.map((u, i) => (
                  <li key={u.id}>
                    <Link href={`/admin/clienti/${u.id}`} className="flex items-center gap-4 px-5 py-3 transition hover:bg-cream/50">
                      <span className={`w-6 font-serif text-xl ${i < 3 ? "text-gold-deep" : "text-smoke"}`}>{i + 1}</span>
                      <Avatar user={u} size="sm" />
                      <span className="flex-1 truncate">{fullName(u)}</span>
                      <span className="font-serif text-xl text-gold-deep">{u.pointsBalance.toLocaleString("it-IT")}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section>
            <SectionTitle title="Riscatti recenti" />
            {redemptions.length === 0 ? (
              <p className="text-sm text-smoke">Nessun premio riscattato finora.</p>
            ) : (
              <ul className="card divide-y divide-cream">
                {redemptions.map(({ r, firstName, lastName }) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.rewardName}</span>
                      <span className="block truncate text-xs text-smoke">
                        {fullName({ firstName, lastName })} · <span className="font-mono">{r.code}</span> · {fmt(r.createdAt, tz, "d MMM yyyy")}
                      </span>
                    </span>
                    {r.status === "active" ? (
                      <span className="flex gap-1.5">
                        <ActionButton action={useRedemptionAction} fields={{ id: r.id }} className="btn btn-gold btn-sm">
                          Utilizzato
                        </ActionButton>
                        <ActionButton action={cancelRedemptionAction} fields={{ id: r.id }} className="btn btn-ghost btn-sm" confirm="Annullare il riscatto e restituire i punti al cliente?">
                          Annulla
                        </ActionButton>
                      </span>
                    ) : (
                      <StatusBadge status={r.status === "cancelled" ? "cancelled" : r.status} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
