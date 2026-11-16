import { randomInt } from "node:crypto";
import { and, asc, eq, gt, lte, sql } from "drizzle-orm";
import { db, t, type Tx } from "@/db";
import type { Center, PointsType } from "@/db/schema";
import { AppError } from "./errors";
import { notifySafe } from "./notify";

export function pointsFor(center: Pick<Center, "pointsPerEuro" | "pointsPerTreatment">, priceCents: number): number {
  return Math.floor((priceCents * center.pointsPerEuro) / 10000) + center.pointsPerTreatment;
}

type Adjust = {
  centerId: string;
  userId: string;
  delta: number;
  type: PointsType;
  reason: string;
  appointmentId?: string | null;
  createdBy?: string | null;
};

/** Modifica il saldo punti in modo atomico e registra il movimento nello storico. */
export async function adjustPoints(tx: Tx, a: Adjust): Promise<{ before: number; after: number }> {
  const [u] = await tx
    .select({ balance: t.users.pointsBalance })
    .from(t.users)
    .where(and(eq(t.users.id, a.userId), eq(t.users.centerId, a.centerId)))
    .for("update");
  if (!u) throw new AppError("Cliente non trovato.");
  const after = u.balance + a.delta;
  if (after < 0) throw new AppError(`Punti insufficienti: saldo attuale ${u.balance}.`);
  if (a.delta !== 0) {
    await tx.update(t.users).set({ pointsBalance: after }).where(eq(t.users.id, a.userId));
    await tx.insert(t.pointsTransactions).values({
      centerId: a.centerId,
      userId: a.userId,
      delta: a.delta,
      type: a.type,
      reason: a.reason,
      appointmentId: a.appointmentId ?? null,
      createdBy: a.createdBy ?? null,
    });
  }
  return { before: u.balance, after };
}

/** Notifica i premi appena sbloccati passando dal saldo `before` al saldo `after`. */
export async function notifyUnlockedRewards(centerId: string, userId: string, before: number, after: number) {
  if (after <= before) return;
  const unlocked = await db
    .select()
    .from(t.rewards)
    .where(and(eq(t.rewards.centerId, centerId), eq(t.rewards.active, true), gt(t.rewards.pointsCost, before), lte(t.rewards.pointsCost, after)))
    .orderBy(asc(t.rewards.pointsCost));
  for (const r of unlocked) {
    await notifySafe(centerId, [userId], {
      type: "reward",
      title: "Hai sbloccato un premio ✨",
      body: `Con ${after} punti puoi riscattare: ${r.name}.`,
      url: "/app/punti",
    });
  }
}

function makeCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += alphabet[randomInt(alphabet.length)];
  return `LUX-${s.slice(0, 4)}-${s.slice(4)}`;
}

export async function redeemReward(centerId: string, userId: string, rewardId: string) {
  return db.transaction(async (tx) => {
    const [reward] = await tx
      .select()
      .from(t.rewards)
      .where(and(eq(t.rewards.id, rewardId), eq(t.rewards.centerId, centerId), eq(t.rewards.active, true)));
    if (!reward) throw new AppError("Premio non disponibile.");
    await adjustPoints(tx, { centerId, userId, delta: -reward.pointsCost, type: "redeem", reason: `Riscatto premio: ${reward.name}`, createdBy: userId });
    const [red] = await tx
      .insert(t.redemptions)
      .values({ centerId, userId, rewardId: reward.id, rewardName: reward.name, pointsSpent: reward.pointsCost, code: makeCode() })
      .returning();
    return red;
  });
}

/** Annulla un riscatto non ancora utilizzato e restituisce i punti. */
export async function cancelRedemption(centerId: string, redemptionId: string, actorId: string) {
  return db.transaction(async (tx) => {
    const [red] = await tx
      .select()
      .from(t.redemptions)
      .where(and(eq(t.redemptions.id, redemptionId), eq(t.redemptions.centerId, centerId)))
      .for("update");
    if (!red || red.status !== "active") throw new AppError("Riscatto non annullabile.");
    await tx.update(t.redemptions).set({ status: "cancelled" }).where(eq(t.redemptions.id, red.id));
    await adjustPoints(tx, { centerId, userId: red.userId, delta: red.pointsSpent, type: "refund", reason: `Riscatto annullato: ${red.rewardName}`, createdBy: actorId });
    return red;
  });
}

export async function loyaltySummary(centerId: string, balance: number) {
  const rewards = await db
    .select()
    .from(t.rewards)
    .where(and(eq(t.rewards.centerId, centerId), eq(t.rewards.active, true)))
    .orderBy(asc(t.rewards.pointsCost));
  const next = rewards.find((r) => r.pointsCost > balance) ?? null;
  const prevCost = [...rewards].reverse().find((r) => r.pointsCost <= balance)?.pointsCost ?? 0;
  const progress = next ? Math.min(100, Math.round(((balance - prevCost) / (next.pointsCost - prevCost)) * 100)) : 100;
  return { rewards, next, missing: next ? next.pointsCost - balance : 0, progress };
}

export const pointsSum = (cond: "pos" | "neg") =>
  cond === "pos"
    ? sql<number>`coalesce(sum(case when ${t.pointsTransactions.delta} > 0 then ${t.pointsTransactions.delta} else 0 end), 0)::int`
    : sql<number>`coalesce(sum(case when ${t.pointsTransactions.type} = 'redeem' then -${t.pointsTransactions.delta} else 0 end), 0)::int`;
