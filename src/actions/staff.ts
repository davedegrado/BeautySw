"use server";

import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { DEFAULT_PERMISSIONS } from "@/db/schema";
import { form, run } from "@/lib/action";
import { AppError, type ActionResult } from "@/lib/errors";
import { fullName } from "@/lib/format";
import { bookAppointment } from "@/lib/booking";
import { clientFromForm, startFromForm } from "@/lib/booking-form";
import { imageFromForm } from "@/lib/images";
import { notifySafe } from "@/lib/notify";
import { actionSession, actorOf } from "@/lib/session";

type R = ActionResult | null;

/**
 * "+ NUOVO TRATTAMENTO": il dipendente propone un trattamento, che viene associato
 * al suo profilo e resta "in attesa" finché l'amministratore non lo approva.
 * La modifica di un trattamento proprio lo riporta in revisione.
 */
export async function staffSaveTreatmentAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await actionSession("employee");
    if (!(s.user.permissions ?? DEFAULT_PERMISSIONS).createTreatments) throw new AppError("Non hai il permesso di creare trattamenti. Rivolgiti all'amministrazione.");
    const f = form(fd);
    const id = f.optId("id");
    const [existing] = id
      ? await db.select().from(t.treatments).where(and(eq(t.treatments.id, id), eq(t.treatments.centerId, s.center.id), eq(t.treatments.createdBy, s.user.id)))
      : [];
    if (id && !existing) throw new AppError("Puoi modificare solo i trattamenti creati da te.");
    const values = {
      name: f.req("name", "Nome del trattamento", 120),
      description: f.str("description", 3000),
      notes: f.str("notes", 1000),
      categoryId: f.optId("categoryId"),
      durationMinutes: f.int("duration", "Durata", { min: 5, max: 600 })!,
      priceCents: f.cents("price", "Prezzo")!,
      active: f.bool("active"),
      status: "pending" as const,
      imageId: await imageFromForm(s.center.id, fd, existing?.imageId ?? null),
    };
    if (existing) await db.update(t.treatments).set(values).where(eq(t.treatments.id, existing.id));
    else
      await db.transaction(async (tx) => {
        const [row] = await tx.insert(t.treatments).values({ ...values, centerId: s.center.id, createdBy: s.user.id }).returning({ id: t.treatments.id });
        await tx.insert(t.employeeTreatments).values({ employeeId: s.user.id, treatmentId: row.id });
      });
    const admins = await db.select({ id: t.users.id }).from(t.users).where(and(eq(t.users.centerId, s.center.id), eq(t.users.role, "admin"), eq(t.users.active, true)));
    await notifySafe(s.center.id, admins.map((a) => a.id), {
      type: "treatment",
      title: "Trattamento da approvare",
      body: `${fullName(s.user)} ha ${existing ? "modificato" : "proposto"} "${values.name}".`,
      url: "/admin/trattamenti?stato=pending",
    });
    return existing ? "Trattamento aggiornato e inviato in revisione." : "Trattamento salvato e associato al tuo profilo. Sarà prenotabile dopo l'approvazione dell'amministrazione.";
  });
}

/**
 * "Nuovo appuntamento" dal calendario del dipendente: l'appuntamento è sempre assegnato
 * a lui. Valgono le stesse regole delle prenotazioni (orari liberi, nessuna sovrapposizione),
 * quindi l'orario diventa subito non prenotabile dai clienti con quel dipendente.
 */
export async function staffCreateAppointmentAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await actionSession("employee");
    const f = form(fd);
    const { start, manual } = startFromForm(s, f);
    await bookAppointment({
      center: s.center,
      actor: actorOf(s),
      clientId: await clientFromForm(s, f),
      treatmentId: f.id("treatmentId", "Trattamento"),
      employeeId: s.user.id,
      start,
      notes: f.str("notes", 1000),
      force: manual,
    });
    return "Appuntamento inserito in agenda.";
  });
}
