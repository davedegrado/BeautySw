import { desc, eq } from "drizzle-orm";
import { Crown, Lock } from "lucide-react";
import { db, t } from "@/db";
import { redeemAction } from "@/actions/client";
import { ActionButton } from "@/components/client-ui";
import { Mandala } from "@/components/mandala";
import { PageHeader, SectionTitle, StatusBadge } from "@/components/ui";
import { fmt } from "@/lib/dates";
import { loyaltySummary } from "@/lib/loyalty";
import { requireRole } from "@/lib/session";

export const metadata = { title: "Luxury Rewards" };

export default async function PointsPage() {
  const s = await requireRole("client");
  const tz = s.center.timezone;
  const balance = s.user.pointsBalance;
  const [loyalty, redemptions, history] = await Promise.all([
    loyaltySummary(s.center.id, balance),
    db.select().from(t.redemptions).where(eq(t.redemptions.userId, s.user.id)).orderBy(desc(t.redemptions.createdAt)),
    db.select().from(t.pointsTransactions).where(eq(t.pointsTransactions.userId, s.user.id)).orderBy(desc(t.pointsTransactions.createdAt)).limit(60),
  ]);
  const perEuro = s.center.pointsPerEuro / 100;
  const rule = [
    perEuro > 0 ? `${perEuro.toLocaleString("it-IT")} ${perEuro === 1 ? "punto" : "punti"} per ogni euro di trattamento` : null,
    s.center.pointsPerTreatment > 0 ? `${s.center.pointsPerTreatment} punti per ogni trattamento` : null,
  ].filter(Boolean).join(" + ");

  return (
    <>
      <PageHeader eyebrow="Programma fedeltà" title="Il mio programma Luxury Rewards" />

      <section className="card-dark relative mb-8 animate-rise overflow-hidden p-7 sm:p-10">
        <Mandala className="pointer-events-none absolute -right-20 top-1/2 h-[26rem] w-[26rem] -translate-y-1/2 text-gold/25" spin />
        <div className="relative max-w-xl">
          <p className="eyebrow mb-3 !text-gold">Saldo disponibile</p>
          <p className="font-serif text-7xl leading-none sm:text-8xl">
            <span className="gold-text">{balance}</span>
            <span className="ml-3 text-2xl text-ivory/60">punti</span>
          </p>
          <div className="mt-7 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-gold-light via-gold to-gold-deep transition-all duration-1000" style={{ width: `${loyalty.progress}%` }} />
          </div>
          <p className="mt-3 text-sm text-ivory/70">
            {loyalty.next ? (
              <>
                Ti mancano <strong className="font-medium text-gold-light">{loyalty.missing} punti</strong> per sbloccare «{loyalty.next.name}»
              </>
            ) : loyalty.rewards.length ? (
              "Complimenti: hai sbloccato tutti i premi del programma."
            ) : (
              "I premi saranno presto disponibili."
            )}
          </p>
          {rule && <p className="mt-1 text-xs text-ivory/45">Come funziona: {rule}, accreditati dopo aver effettuato il trattamento.</p>}
        </div>
      </section>

      <SectionTitle title="Premi disponibili" />
      {loyalty.rewards.length === 0 ? (
        <p className="mb-8 text-sm text-smoke">Nessun premio configurato al momento.</p>
      ) : (
        <div className="mb-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {loyalty.rewards.map((r) => {
            const unlocked = balance >= r.pointsCost;
            return (
              <article key={r.id} className={`card flex flex-col p-5 transition ${unlocked ? "border-gold shadow-[0_0_0_1px_var(--color-gold)]" : ""}`}>
                <div className="mb-3 flex items-center justify-between">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-full border ${unlocked ? "border-gold bg-gold/10 text-gold-deep" : "border-line text-smoke"}`}>
                    {unlocked ? <Crown className="h-4 w-4" strokeWidth={1.4} /> : <Lock className="h-4 w-4" strokeWidth={1.4} />}
                  </span>
                  <span className="font-serif text-2xl text-gold-deep">{r.pointsCost.toLocaleString("it-IT")} pt</span>
                </div>
                <h3 className="text-xl leading-tight">{r.name}</h3>
                {r.description && <p className="mt-1 text-xs leading-relaxed text-smoke">{r.description}</p>}
                <div className="mt-auto pt-4">
                  {unlocked ? (
                    <ActionButton
                      action={redeemAction}
                      fields={{ rewardId: r.id }}
                      className="btn btn-gold btn-sm w-full"
                      confirm={`Vuoi riscattare «${r.name}» utilizzando ${r.pointsCost} punti? Riceverai un codice da mostrare in istituto.`}
                      confirmLabel="Riscatta"
                    >
                      Riscatta premio
                    </ActionButton>
                  ) : (
                    <>
                      <div className="h-1 overflow-hidden rounded-full bg-cream">
                        <div className="h-full rounded-full bg-gold" style={{ width: `${Math.round((balance / r.pointsCost) * 100)}%` }} />
                      </div>
                      <p className="mt-1.5 text-xs text-smoke">Ancora {r.pointsCost - balance} punti</p>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <SectionTitle title="I miei premi riscattati" />
          {redemptions.length === 0 ? (
            <p className="text-sm text-smoke">Non hai ancora riscattato premi.</p>
          ) : (
            <ul className="space-y-3">
              {redemptions.map((r) => (
                <li key={r.id} className={`card flex items-center justify-between gap-4 p-4 ${r.status === "cancelled" ? "opacity-60" : ""}`}>
                  <div className="min-w-0">
                    <p className="font-serif text-xl leading-tight">{r.rewardName}</p>
                    <p className="text-xs text-smoke">
                      {fmt(r.createdAt, tz, "d MMMM yyyy")} · {r.pointsSpent} punti
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="rounded-md border border-dashed border-gold bg-gold/5 px-2.5 py-1 font-mono text-sm tracking-wider">{r.code}</p>
                    <div className="mt-1.5">
                      <StatusBadge status={r.status} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <SectionTitle title="Storico punti" />
          {history.length === 0 ? (
            <p className="text-sm text-smoke">I tuoi movimenti punti appariranno qui dopo il primo trattamento.</p>
          ) : (
            <ul className="card divide-y divide-cream">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">{h.reason || "Movimento punti"}</p>
                    <p className="text-xs text-smoke">{fmt(h.createdAt, tz, "d MMM yyyy")}</p>
                  </div>
                  <span className={`shrink-0 font-serif text-xl ${h.delta > 0 ? "text-success" : "text-danger"}`}>
                    {h.delta > 0 ? "+" : ""}
                    {h.delta}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
