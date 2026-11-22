import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { DEFAULT_PERMISSIONS } from "@/db/schema";
import { addDays, localDate, weekdayOf, zoned } from "@/lib/dates";
import { adjustPoints, pointsFor } from "@/lib/loyalty";
import { hashPassword } from "@/lib/password";

/**
 * Centro dimostrativo "Aurea Beauty Lounge" con staff, clienti, trattamenti, promozioni,
 * eventi e due mesi di storico. Le date sono relative al giorno in cui viene creato.
 * Usato da `npm run db:seed` e dalla demo statica (GitHub Pages).
 */
export const DEMO_PASSWORD = "Aurea2026!";
const PASSWORD = DEMO_PASSWORD;
const SLUG = "aurea";
const TZ = "Europe/Rome";

/** Crea il centro demo. Restituisce null se esiste già (a meno di `reset`). */
export async function seedDemoCenter(opts: { reset?: boolean } = {}) {
  const [existing] = await db.select().from(t.centers).where(eq(t.centers.slug, SLUG));
  if (existing) {
    if (!opts.reset) return null;
    await db.delete(t.centers).where(eq(t.centers.id, existing.id));
  }
  const hash = await hashPassword(PASSWORD);
  const [center] = await db
    .insert(t.centers)
    .values({
      slug: SLUG,
      name: "Aurea Beauty Lounge",
      tagline: "L'arte del benessere, su misura per te",
      address: "Via della Spiga 12, Milano",
      phone: "+39 02 1234 5678",
      email: "info@aurea.demo",
      birthdayGift: "20% di sconto su un trattamento a tua scelta, valido 30 giorni.",
      birthdayBonusPoints: 50,
    })
    .returning();
  const c = center.id;

  await db.insert(t.users).values({ centerId: c, role: "admin", email: "admin@aurea.demo", passwordHash: hash, firstName: "Beatrice", lastName: "Conti" });

  const staff = await db
    .insert(t.users)
    .values(
      [
        ["Giulia", "Moretti", "Estetista senior · Viso", "#C9A96E"],
        ["Sofia", "Ricci", "Massoterapista", "#8E7CC3"],
        ["Martina", "Galli", "Beauty specialist", "#6FA8A0"],
      ].map(([firstName, lastName, jobTitle, color]) => ({
        centerId: c,
        role: "employee" as const,
        email: `${firstName.toLowerCase()}@aurea.demo`,
        passwordHash: hash,
        firstName,
        lastName,
        jobTitle,
        color,
        permissions: DEFAULT_PERMISSIONS,
      })),
    )
    .returning();

  const y = new Date().getFullYear();
  const today = localDate(new Date(), TZ);
  const clients = await db
    .insert(t.users)
    .values(
      [
        ["Elena", "Bianchi", `1990-${today.slice(5)}`, 2],
        ["Chiara", "Romano", "1985-03-14", 40],
        ["Francesca", "Marino", `1992-${today.slice(5, 7)}-05`, 75],
        ["Valentina", "Greco", "1988-09-22", 12],
        ["Alessia", "Ferri", "1996-12-02", 100],
        ["Laura", "De Luca", "1979-06-30", 150],
      ].map(([firstName, lastName, birthDate, daysAgo]) => ({
        centerId: c,
        role: "client" as const,
        email: `${String(firstName).toLowerCase()}@aurea.demo`,
        passwordHash: hash,
        firstName: String(firstName),
        lastName: String(lastName),
        phone: "+39 333 000 0000",
        birthDate: String(birthDate),
        createdAt: new Date(Date.now() - Number(daysAgo) * 86400000),
      })),
    )
    .returning();
  void y;

  const cats = await db
    .insert(t.categories)
    .values(["Viso", "Corpo", "Massaggi", "Estetica", "Rituali Luxury"].map((name, sort) => ({ centerId: c, name, sort })))
    .returning();
  const cat = Object.fromEntries(cats.map((x) => [x.name, x.id]));

  // [nome, categoria, minuti, euro, descrizione, indici dipendenti]
  const defs: [string, string, number, number, string, number[]][] = [
    ["Pulizia viso profonda", "Viso", 60, 65, "Detersione, vapore, estrazione delicata e maschera riequilibrante per una pelle luminosa.", [0, 2]],
    ["Trattamento viso anti-age all'oro", "Viso", 75, 120, "Siero all'oro 24k, massaggio liftante e maschera al collagene per un effetto tensore immediato.", [0]],
    ["Trattamento viso express", "Viso", 30, 39, "Detersione, esfoliazione e maschera idratante in soli trenta minuti.", [0, 2]],
    ["Scrub corpo ai sali del Mar Morto", "Corpo", 45, 55, "Esfoliazione rigenerante che lascia la pelle setosa e pronta ad assorbire i principi attivi.", [1, 2]],
    ["Bendaggio drenante", "Corpo", 60, 70, "Bendaggi freddi ad azione drenante e tonificante per gambe leggere.", [2]],
    ["Massaggio relax", "Massaggi", 50, 60, "Manovre lente e avvolgenti con oli caldi per sciogliere tensioni e stress.", [1]],
    ["Massaggio decontratturante", "Massaggi", 50, 70, "Lavoro profondo sui punti di tensione di schiena, collo e spalle.", [1]],
    ["Massaggio hot stone", "Massaggi", 75, 95, "Pietre laviche calde e oli essenziali per un rilassamento profondo.", [1]],
    ["Manicure spa", "Estetica", 45, 35, "Cura completa di mani e unghie con scrub, maschera e smalto.", [2]],
    ["Pedicure estetico", "Estetica", 50, 42, "Pediluvio aromatico, trattamento completo e massaggio plantare.", [2]],
    ["Laminazione ciglia", "Estetica", 60, 60, "Ciglia incurvate, nutrite e definite fino a otto settimane.", [0, 2]],
    ["Rituale Aurea Signature", "Rituali Luxury", 120, 220, "Il nostro rituale esclusivo: scrub, massaggio all'olio dorato e trattamento viso illuminante.", [0, 1]],
    ["Rituale di coppia Hammam", "Rituali Luxury", 90, 180, "Percorso ispirato alla tradizione hammam con savon noir, gommage e massaggio.", [1]],
  ];
  const treatments = await db
    .insert(t.treatments)
    .values(defs.map(([name, k, durationMinutes, price, description]) => ({ centerId: c, categoryId: cat[k], name, description, durationMinutes, priceCents: price * 100 })))
    .returning();
  await db.insert(t.employeeTreatments).values(defs.flatMap((d, i) => d[5].map((e) => ({ employeeId: staff[e].id, treatmentId: treatments[i].id }))));
  // Un trattamento proposto da una dipendente, in attesa di approvazione.
  const [pending] = await db
    .insert(t.treatments)
    .values({ centerId: c, categoryId: cat["Viso"], name: "Massaggio viso Kobido", description: "Antica tecnica giapponese di lifting manuale.", durationMinutes: 50, priceCents: 8500, status: "pending", createdBy: staff[0].id })
    .returning();
  await db.insert(t.employeeTreatments).values({ employeeId: staff[0].id, treatmentId: pending.id });

  // Turni: lun–ven 9–13 / 14–19, sabato 9–14 (Sofia riposa il lunedì).
  await db.insert(t.workShifts).values(
    staff.flatMap((e, i) =>
      [1, 2, 3, 4, 5, 6].flatMap((weekday) => {
        if (i === 1 && weekday === 1) return [];
        if (weekday === 6) return [{ centerId: c, employeeId: e.id, weekday, startMinute: 540, endMinute: 840 }];
        return [
          { centerId: c, employeeId: e.id, weekday, startMinute: 540, endMinute: 780 },
          { centerId: c, employeeId: e.id, weekday, startMinute: 840, endMinute: 1140 },
        ];
      }),
    ),
  );

  await db.insert(t.rewards).values([
    { centerId: c, name: "Trattamento express gratuito", description: "Un trattamento viso express in omaggio.", pointsCost: 100 },
    { centerId: c, name: "Massaggio relax gratuito", description: "50 minuti di puro relax offerti da noi.", pointsCost: 250 },
    { centerId: c, name: "Trattamento viso premium gratuito", description: "Il nostro anti-age all'oro in omaggio.", pointsCost: 500 },
    { centerId: c, name: "Trattamento Luxury esclusivo", description: "Il Rituale Aurea Signature, completamente gratuito.", pointsCost: 1000 },
  ]);

  const byName = (n: string) => treatments.find((x) => x.name === n)!;
  await db.insert(t.promotions).values([
    { centerId: c, title: "Golden Glow", description: "Il trattamento viso anti-age all'oro a un prezzo speciale per tutto il mese.", category: "viso", originalPriceCents: 12000, promoPriceCents: 8900, treatmentId: byName("Trattamento viso anti-age all'oro").id, startsOn: addDays(today, -5), endsOn: addDays(today, 25) },
    { centerId: c, title: "Relax d'autunno", description: "Massaggio hot stone con tisana di benvenuto e percorso aromatico.", category: "massaggi", originalPriceCents: 9500, promoPriceCents: 7500, treatmentId: byName("Massaggio hot stone").id, startsOn: addDays(today, -2), endsOn: addDays(today, 40) },
    { centerId: c, title: "Pacchetto Silhouette", description: "3 bendaggi drenanti + 1 scrub corpo. Il percorso ideale per rimodellare.", category: "pacchetti", originalPriceCents: 26500, promoPriceCents: 19900, startsOn: addDays(today, -10), endsOn: addDays(today, 50) },
    { centerId: c, title: "Linea Skincare Oro -20%", description: "Tutta la linea domiciliare all'oro colloidale in promozione in istituto.", category: "prodotti", originalPriceCents: 8000, promoPriceCents: 6400, startsOn: addDays(today, -1), endsOn: addDays(today, 20) },
    { centerId: c, title: "Aurea Signature Experience", description: "Il nostro rituale più esclusivo con calice di benvenuto.", category: "luxury", originalPriceCents: 22000, promoPriceCents: 18500, treatmentId: byName("Rituale Aurea Signature").id, startsOn: addDays(today, -3), endsOn: addDays(today, 60) },
  ]);

  const [ev1] = await db
    .insert(t.events)
    .values([
      { centerId: c, title: "Serata Beauty: i segreti della skincare", description: "Una serata esclusiva con la nostra skin expert: analisi della pelle, consigli personalizzati e aperitivo.\n\nPosti limitati.", startsAt: zoned(addDays(today, 12), 19 * 60, TZ), endsAt: zoned(addDays(today, 12), 21 * 60 + 30, TZ), location: "Aurea Beauty Lounge", maxParticipants: 20, priceCents: 0 },
      { centerId: c, title: "Open Day: nuovi rituali d'inverno", description: "Vieni a scoprire in anteprima i nuovi rituali con mini-trattamenti gratuiti e omaggi.", startsAt: zoned(addDays(today, 26), 10 * 60, TZ), endsAt: zoned(addDays(today, 26), 18 * 60, TZ), location: "Aurea Beauty Lounge", maxParticipants: 40, priceCents: 0 },
      { centerId: c, title: "Masterclass di automassaggio viso", description: "Impara le tecniche di automassaggio per un effetto lifting naturale. Kit incluso.", startsAt: zoned(addDays(today, 40), 18 * 60, TZ), location: "Sala Zen", maxParticipants: 12, priceCents: 2500 },
    ])
    .returning();
  await db.insert(t.eventRegistrations).values([1, 2].map((i) => ({ centerId: c, eventId: ev1.id, userId: clients[i].id })));

  // Storico: appuntamenti completati negli ultimi 60 giorni (deterministico).
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const hours = [9 * 60, 11 * 60, 14 * 60 + 30, 16 * 60 + 30];
  for (let d = 60; d >= 1; d--) {
    const date = addDays(today, -d);
    const wd = weekdayOf(date);
    if (wd === 0) continue;
    for (let e = 0; e < staff.length; e++) {
      if (e === 1 && wd === 1) continue;
      for (const h of wd === 6 ? hours.slice(0, 2) : hours) {
        if (rnd() > 0.22) continue;
        const options = defs.map((x, i) => ({ x, i })).filter(({ x }) => x[5].includes(e) && x[2] <= 90);
        const pick = options[Math.floor(rnd() * options.length)];
        const tr = treatments[pick.i];
        // Distribuzione non uniforme: alcune clienti sono più assidue di altre.
        const client = clients[Math.floor(Math.sqrt(rnd()) * clients.length)];
        const startAt = zoned(date, h, TZ);
        const [appt] = await db
          .insert(t.appointments)
          .values({ centerId: c, clientId: client.id, employeeId: staff[e].id, treatmentId: tr.id, startAt, endAt: new Date(startAt.getTime() + tr.durationMinutes * 60000), status: "completed", priceCents: tr.priceCents, pointsAwarded: pointsFor(center, tr.priceCents), reminderSentAt: startAt, createdAt: new Date(startAt.getTime() - 5 * 86400000) })
          .returning();
        await db.transaction(async (tx) => {
          await adjustPoints(tx, { centerId: c, userId: client.id, delta: appt.pointsAwarded!, type: "earn", reason: `Trattamento: ${tr.name}`, appointmentId: appt.id });
        });
        await db.update(t.pointsTransactions).set({ createdAt: startAt }).where(eq(t.pointsTransactions.appointmentId, appt.id));
      }
    }
  }
  // Prossimi appuntamenti.
  let placed = 0;
  for (let d = 0; d <= 9 && placed < 16; d++) {
    const date = addDays(today, d);
    const wd = weekdayOf(date);
    if (wd === 0) continue;
    for (let e = 0; e < staff.length; e++) {
      if (e === 1 && wd === 1) continue;
      for (const h of wd === 6 ? hours.slice(0, 2) : hours) {
        const startAt = zoned(date, h, TZ);
        if (startAt.getTime() < Date.now() + 3 * 3600000 || rnd() > 0.35) continue;
        const options = defs.map((x, i) => ({ x, i })).filter(({ x }) => x[5].includes(e) && x[2] <= 90);
        const tr = treatments[options[Math.floor(rnd() * options.length)].i];
        const client = clients[placed === 0 ? 0 : Math.floor(rnd() * clients.length)];
        await db.insert(t.appointments).values({ centerId: c, clientId: client.id, employeeId: staff[e].id, treatmentId: tr.id, startAt, endAt: new Date(startAt.getTime() + tr.durationMinutes * 60000), priceCents: tr.priceCents });
        placed++;
      }
    }
  }

  return center;
}
