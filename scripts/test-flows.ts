import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db, pool, t } from "../src/db";
import { computeAvailability } from "../src/lib/availability";
import { bookAppointment, cancelAppointment, completeAppointment, updateAppointment, type Actor } from "../src/lib/booking";
import { addDays, localDate, weekdayOf, zoned } from "../src/lib/dates";
import { AppError } from "../src/lib/errors";
import { registerToEvent } from "../src/lib/events";
import { runScheduledJobs } from "../src/lib/jobs";
import { adjustPoints, redeemReward } from "../src/lib/loyalty";

/**
 * Test end-to-end dei flussi principali su un centro temporaneo (eliminato a fine test):
 * prenotazione, doppie prenotazioni, disdetta, punti, premi, eventi, isolamento tra centri.
 * Esecuzione: `npm run test:flows`
 */
let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) passed++;
  else failed++;
  console.log(`${cond ? "  ✓" : "  ✗"} ${name}${cond ? "" : ` ${extra}`}`);
}
async function rejects(name: string, fn: () => Promise<unknown>, contains?: string) {
  try {
    await fn();
    check(name, false, "(nessun errore sollevato)");
  } catch (e) {
    check(name, e instanceof AppError && (!contains || e.message.includes(contains)), `(${(e as Error).message})`);
  }
}

async function makeCenter(slug: string) {
  const [center] = await db.insert(t.centers).values({ slug, name: slug, cancellationHours: 24, bufferMinutes: 10, birthdayBonusPoints: 30 }).returning();
  const mk = async (role: "admin" | "employee" | "client", firstName: string, extra: Partial<typeof t.users.$inferInsert> = {}) =>
    (await db.insert(t.users).values({ centerId: center.id, role, firstName, email: `${firstName}@${slug}.test`, passwordHash: "x", ...extra }).returning())[0];
  return { center, mk };
}

async function main() {
  const stamp = Date.now().toString(36);
  const A = await makeCenter(`test-a-${stamp}`);
  const B = await makeCenter(`test-b-${stamp}`);
  const { center } = A;
  const tz = center.timezone;
  try {
    const admin = await A.mk("admin", "admin");
    const emp1 = await A.mk("employee", "emp1");
    const emp2 = await A.mk("employee", "emp2");
    const today = localDate(new Date(), tz);
    const anna = await A.mk("client", "anna", { birthDate: `1990-${today.slice(5)}` });
    const bea = await A.mk("client", "bea");
    const [tr] = await db.insert(t.treatments).values({ centerId: center.id, name: "Massaggio", durationMinutes: 60, priceCents: 12000 }).returning();
    await db.insert(t.employeeTreatments).values([{ employeeId: emp1.id, treatmentId: tr.id }, { employeeId: emp2.id, treatmentId: tr.id }]);
    for (const e of [emp1, emp2])
      for (let wd = 0; wd < 7; wd++)
        await db.insert(t.workShifts).values([
          { centerId: center.id, employeeId: e.id, weekday: wd, startMinute: 540, endMinute: 780 },
          { centerId: center.id, employeeId: e.id, weekday: wd, startMinute: 840, endMinute: 1140 },
        ]);
    await db.insert(t.rewards).values([{ centerId: center.id, name: "Express", pointsCost: 100 }, { centerId: center.id, name: "Luxury", pointsCost: 1000 }]);
    const actor = (u: { id: string; role: Actor["role"] }): Actor => ({ id: u.id, role: u.role, centerId: center.id });
    const day = addDays(today, 5);
    void weekdayOf;

    console.log("\nDisponibilità");
    let av = await computeAvailability({ center, treatmentId: tr.id, employeeId: emp1.id, fromDate: day, days: 1 });
    const times = av[day].map((s) => s.start);
    const at = (m: number) => zoned(day, m, tz);
    check("orari dentro il turno, primo slot 09:00", times[0] === at(540).toISOString());
    check("ultimo slot del mattino 12:00 (termina alle 13:00)", times.includes(at(720).toISOString()) && !times.includes(at(735).toISOString()));
    check("nessuno slot durante la pausa 13–14", !times.some((s) => new Date(s) >= at(725) && new Date(s) < at(840)));
    check("ultimo slot 18:00", times[times.length - 1] === at(1080).toISOString());

    console.log("\nPrenotazione");
    const a1 = await bookAppointment({ center, actor: actor(anna), clientId: anna.id, treatmentId: tr.id, employeeId: emp1.id, start: at(600) });
    check("prenotazione confermata con prezzo del trattamento", a1.status === "confirmed" && a1.priceCents === 12000);
    const [n1] = await db.select().from(t.notifications).where(and(eq(t.notifications.userId, anna.id), eq(t.notifications.type, "booking")));
    check("notifica di conferma al cliente", !!n1);
    const staffNotes = await db.select().from(t.notifications).where(and(eq(t.notifications.userId, emp1.id), eq(t.notifications.type, "booking")));
    check("notifica al dipendente", staffNotes.length === 1);
    await rejects("doppia prenotazione stesso orario rifiutata", () => bookAppointment({ center, actor: actor(bea), clientId: bea.id, treatmentId: tr.id, employeeId: emp1.id, start: at(600) }));
    await rejects("sovrapposizione parziale rifiutata", () => bookAppointment({ center, actor: actor(bea), clientId: bea.id, treatmentId: tr.id, employeeId: emp1.id, start: at(630) }));
    await rejects("tempo di preparazione rispettato (11:00 troppo vicino)", () => bookAppointment({ center, actor: actor(bea), clientId: bea.id, treatmentId: tr.id, employeeId: emp1.id, start: at(660) }));
    await rejects("fuori orario di lavoro rifiutato", () => bookAppointment({ center, actor: actor(bea), clientId: bea.id, treatmentId: tr.id, employeeId: emp1.id, start: at(1200) }));
    await rejects("cliente non può prenotare per un altro cliente", () => bookAppointment({ center, actor: actor(bea), clientId: anna.id, treatmentId: tr.id, employeeId: emp2.id, start: at(600) }));
    const a2 = await bookAppointment({ center, actor: actor(bea), clientId: bea.id, treatmentId: tr.id, employeeId: null, start: at(600) });
    check('"nessuna preferenza" assegna l\'operatore libero', a2.employeeId === emp2.id);
    await rejects("orario esaurito per tutti gli operatori", () => bookAppointment({ center, actor: actor(bea), clientId: bea.id, treatmentId: tr.id, employeeId: null, start: at(600) }));

    const race = await Promise.allSettled(
      [anna, bea].map((u) => bookAppointment({ center, actor: actor(u), clientId: u.id, treatmentId: tr.id, employeeId: emp1.id, start: at(900) })),
    );
    check("due prenotazioni simultanee: una sola va a buon fine", race.filter((r) => r.status === "fulfilled").length === 1);
    const raceAppt = (race.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<typeof a1>).value;

    await db.insert(t.availabilityExceptions).values({ centerId: center.id, employeeId: emp1.id, kind: "unavailable", startAt: zoned(addDays(day, 1), 0, tz), endAt: zoned(addDays(day, 2), 0, tz), reason: "Ferie" });
    av = await computeAvailability({ center, treatmentId: tr.id, employeeId: emp1.id, fromDate: addDays(day, 1), days: 1 });
    check("ferie: nessuna disponibilità", av[addDays(day, 1)].length === 0);
    await rejects("forzatura admin non aggira la sovrapposizione", () => bookAppointment({ center, actor: actor(admin), clientId: bea.id, treatmentId: tr.id, employeeId: emp1.id, start: at(615), force: true }));
    const forced = await bookAppointment({ center, actor: actor(admin), clientId: bea.id, treatmentId: tr.id, employeeId: emp1.id, start: at(1200), force: true });
    check("admin può inserire un appuntamento fuori orario", forced.status === "confirmed");

    console.log("\nIsolamento tra centri");
    const cliB = await B.mk("client", "clib");
    await rejects("cliente di un altro centro non può prenotare", () => bookAppointment({ center: B.center, actor: { id: cliB.id, role: "client", centerId: B.center.id }, clientId: cliB.id, treatmentId: tr.id, employeeId: emp1.id, start: at(960) }));
    const adminB = await B.mk("admin", "adminb");
    await rejects("admin di un altro centro non può annullare", () => cancelAppointment(B.center, { id: adminB.id, role: "admin", centerId: B.center.id }, a1.id));

    console.log("\nDisdetta");
    await rejects("cliente non può disdire appuntamenti altrui", () => cancelAppointment(center, actor(bea), a1.id));
    const soon = await bookAppointment({ center, actor: actor(admin), clientId: anna.id, treatmentId: tr.id, employeeId: emp2.id, start: new Date(Date.now() + 5 * 3600000), force: true });
    await rejects("disdetta oltre il termine rifiutata al cliente", () => cancelAppointment(center, actor(anna), soon.id), "termine");
    await cancelAppointment(center, actor(admin), soon.id, "test");
    check("l'amministratore può annullare sempre", (await db.select().from(t.appointments).where(eq(t.appointments.id, soon.id)))[0].status === "cancelled");
    await cancelAppointment(center, actor(anna), raceAppt.clientId === anna.id ? raceAppt.id : a1.id);
    const cancelledId = raceAppt.clientId === anna.id ? raceAppt.id : a1.id;
    check("disdetta entro i termini riuscita", (await db.select().from(t.appointments).where(eq(t.appointments.id, cancelledId)))[0].status === "cancelled");
    await rejects("doppia disdetta rifiutata", () => cancelAppointment(center, actor(anna), cancelledId));
    if (cancelledId === a1.id) {
      const again = await bookAppointment({ center, actor: actor(bea), clientId: bea.id, treatmentId: tr.id, employeeId: emp1.id, start: at(540) });
      check("lo slot liberato torna prenotabile", again.status === "confirmed");
    } else {
      const again = await bookAppointment({ center, actor: actor(bea), clientId: bea.id, treatmentId: tr.id, employeeId: emp1.id, start: at(900) });
      check("lo slot liberato torna prenotabile", again.status === "confirmed");
    }
    const moved = await updateAppointment(center, actor(admin), { appointmentId: a2.id, start: at(960) });
    check("spostamento appuntamento", moved.startAt.getTime() === at(960).getTime());
    await rejects("dipendente non può spostare", () => updateAppointment(center, actor(emp2), { appointmentId: a2.id, start: at(1020) }));

    console.log("\nPunti fedeltà e premi");
    await rejects("dipendente non può completare appuntamenti di colleghi", () => completeAppointment(center, actor(emp1), a2.id));
    await rejects("cliente non può completare", () => completeAppointment(center, actor(bea), a2.id));
    const bal = async (id: string) => (await db.select().from(t.users).where(eq(t.users.id, id)))[0].pointsBalance;
    check("prima del completamento nessun punto", (await bal(bea.id)) === 0);
    const done = await completeAppointment(center, actor(emp2), a2.id);
    check("completato dal dipendente: 120 punti (1 punto per euro)", done.points === 120 && (await bal(bea.id)) === 120);
    await completeAppointment(center, actor(admin), a2.id);
    check("completamento ripetuto non duplica i punti", (await bal(bea.id)) === 120);
    const unlocked = await db.select().from(t.notifications).where(and(eq(t.notifications.userId, bea.id), eq(t.notifications.type, "reward")));
    check("notifica premio sbloccato (soglia 100)", unlocked.length === 1);
    const [express] = await db.select().from(t.rewards).where(and(eq(t.rewards.centerId, center.id), eq(t.rewards.pointsCost, 100)));
    const [luxury] = await db.select().from(t.rewards).where(and(eq(t.rewards.centerId, center.id), eq(t.rewards.pointsCost, 1000)));
    await rejects("premio non riscattabile senza punti sufficienti", () => redeemReward(center.id, bea.id, luxury.id), "insufficienti");
    const red = await redeemReward(center.id, bea.id, express.id);
    check("riscatto premio: codice generato e punti scalati", /^LUX-/.test(red.code) && (await bal(bea.id)) === 20);
    await rejects("riscatto da un altro centro rifiutato", () => redeemReward(B.center.id, bea.id, express.id));
    await rejects("sottrazione oltre il saldo rifiutata", () => db.transaction((tx) => adjustPoints(tx, { centerId: center.id, userId: bea.id, delta: -500, type: "refund", reason: "test" })));
    const hist = await db.select().from(t.pointsTransactions).where(eq(t.pointsTransactions.userId, bea.id));
    check("storico punti coerente con il saldo", hist.reduce((s, h) => s + h.delta, 0) === 20);

    console.log("\nEventi");
    const [ev] = await db.insert(t.events).values({ centerId: center.id, title: "Open day", startsAt: new Date(Date.now() + 7 * 86400000), maxParticipants: 1 }).returning();
    await registerToEvent(center.id, ev.id, anna.id);
    await rejects("iscrizione doppia rifiutata / posti esauriti", () => registerToEvent(center.id, ev.id, anna.id));
    await rejects("posti esauriti", () => registerToEvent(center.id, ev.id, bea.id), "esauriti");

    console.log("\nJob automatici");
    const tomorrow = await bookAppointment({ center, actor: actor(admin), clientId: anna.id, treatmentId: tr.id, employeeId: emp2.id, start: new Date(Date.now() + 30 * 3600000), force: true });
    await db.update(t.appointments).set({ reminderSentAt: null }).where(eq(t.appointments.id, tomorrow.id));
    await db.update(t.centers).set({ reminderHours: 48 }).where(eq(t.centers.id, center.id));
    await runScheduledJobs();
    await runScheduledJobs();
    const rem = await db.select().from(t.notifications).where(and(eq(t.notifications.userId, anna.id), eq(t.notifications.type, "reminder")));
    check("promemoria inviato una sola volta", rem.length === 1);
    const bday = await db.select().from(t.notifications).where(and(eq(t.notifications.userId, anna.id), eq(t.notifications.type, "birthday")));
    check("auguri di compleanno inviati una sola volta", bday.length === 1);
    check("punti omaggio di compleanno accreditati", (await bal(anna.id)) === 30);
  } finally {
    for (const c of [A.center, B.center]) {
      await db.delete(t.appointments).where(eq(t.appointments.centerId, c.id));
      await db.delete(t.centers).where(eq(t.centers.id, c.id));
    }
    await pool.end();
  }
  console.log(`\n${passed} superati, ${failed} falliti`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
