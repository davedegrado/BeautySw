"use server";

import { and, eq, gte, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { DEFAULT_PERMISSIONS, PROMO_CATEGORIES, type TreatmentStatus } from "@/db/schema";
import { form, run } from "@/lib/action";
import { clientFromForm, startFromForm } from "@/lib/booking-form";
import { bookAppointment, cancelAppointment, completeAppointment, markNoShow, updateAppointment } from "@/lib/booking";
import { fmt, fmtDay, localDate, timeToMinutes, zonedFromInput } from "@/lib/dates";
import { AppError, type ActionResult } from "@/lib/errors";
import { registerToEvent } from "@/lib/events";
import { eur } from "@/lib/format";
import { imageFromForm } from "@/lib/images";
import { adjustPoints, cancelRedemption, notifyUnlockedRewards } from "@/lib/loyalty";
import { notify, notifySafe } from "@/lib/notify";
import { hashPassword } from "@/lib/password";
import { actionSession, actorOf, type Session } from "@/lib/session";

type R = ActionResult | null;
const admin = () => actionSession("admin");

async function clientIds(centerId: string) {
  const rows = await db
    .select({ id: t.users.id })
    .from(t.users)
    .where(and(eq(t.users.centerId, centerId), eq(t.users.role, "client"), eq(t.users.active, true), isNotNull(t.users.passwordHash)));
  return rows.map((r) => r.id);
}

async function assertUser(s: Session, id: string, role?: "client" | "employee") {
  const [u] = await db.select().from(t.users).where(and(eq(t.users.id, id), eq(t.users.centerId, s.center.id)));
  if (!u || (role && u.role !== role)) throw new AppError("Utente non trovato.");
  return u;
}

async function assertEmailFree(email: string | null, exceptId?: string) {
  if (!email) return;
  const [dup] = await db.select({ id: t.users.id }).from(t.users).where(sql`lower(${t.users.email}) = ${email}`);
  if (dup && dup.id !== exceptId) throw new AppError("Questa email è già associata a un altro account.");
}

/* ------------------------------------------------------------------ Appuntamenti */

export async function adminSaveAppointmentAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await admin();
    const f = form(fd);
    const id = f.optId("id");
    // L'orario arriva o da uno slot libero (ISO) o da un inserimento manuale "fuori orario".
    const { start, manual } = startFromForm(s, f);
    const price = f.cents("price", "Prezzo", true);
    if (id) {
      await updateAppointment(s.center, actorOf(s), {
        appointmentId: id,
        treatmentId: f.id("treatmentId", "Trattamento"),
        employeeId: f.id("employeeId", "Operatore"),
        start,
        priceCents: price ?? undefined,
        notes: f.str("notes", 1000),
      });
      return "Appuntamento aggiornato.";
    }
    await bookAppointment({
      center: s.center,
      actor: actorOf(s),
      clientId: await clientFromForm(s, f),
      treatmentId: f.id("treatmentId", "Trattamento"),
      employeeId: f.id("employeeId", "Operatore"),
      start,
      notes: f.str("notes", 1000),
      force: manual,
      priceCents: price ?? undefined,
    });
    return "Appuntamento creato.";
  });
}

export async function adminCancelAppointmentAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await admin();
    const f = form(fd);
    await cancelAppointment(s.center, actorOf(s), f.id("id"), f.str("reason", 300));
    return "Appuntamento annullato.";
  });
}

export async function adminDeleteAppointmentAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await admin();
    const id = form(fd).id("id");
    const [a] = await db.select().from(t.appointments).where(and(eq(t.appointments.id, id), eq(t.appointments.centerId, s.center.id)));
    if (!a) throw new AppError("Appuntamento non trovato.");
    if (a.pointsAwarded) throw new AppError("Appuntamento con punti già accreditati: annullalo invece di eliminarlo.");
    await db.delete(t.appointments).where(eq(t.appointments.id, id));
    return "Appuntamento eliminato.";
  });
}

/** Condivisa da amministratore e dipendente (il dipendente solo sui propri appuntamenti). */
export async function completeAppointmentAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await actionSession("admin", "employee");
    const f = form(fd);
    const { points } = await completeAppointment(s.center, actorOf(s), f.id("id"));
    return points > 0 ? `Appuntamento completato: ${points} punti accreditati al cliente.` : "Appuntamento completato.";
  });
}

export async function noShowAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await actionSession("admin", "employee");
    await markNoShow(s.center, actorOf(s), form(fd).id("id"));
    return "Segnato come non presentato.";
  });
}

/* ------------------------------------------------------------------ Clienti */

export async function saveClientAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await admin();
    const f = form(fd);
    const id = f.optId("id");
    const email = f.email("email", false);
    await assertEmailFree(email, id ?? undefined);
    const values = {
      firstName: f.req("firstName", "Nome", 80),
      lastName: f.str("lastName", 80),
      email,
      phone: f.str("phone", 40),
      birthDate: f.date("birthDate", "Data di nascita", true),
      notes: f.str("notes", 2000),
    };
    if (id) {
      await assertUser(s, id, "client");
      await db.update(t.users).set(values).where(eq(t.users.id, id));
      return "Scheda cliente aggiornata.";
    }
    const pwd = String(fd.get("password") ?? "");
    if (pwd && !email) throw new AppError("Per creare le credenziali di accesso serve un'email.");
    await db.insert(t.users).values({ ...values, centerId: s.center.id, role: "client", passwordHash: pwd ? await hashPassword(f.password("password")) : null });
    return "Cliente creato.";
  });
}

export async function setUserActiveAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await admin();
    const f = form(fd);
    const u = await assertUser(s, f.id("id"));
    if (u.id === s.user.id) throw new AppError("Non puoi disattivare il tuo account.");
    const active = f.bool("active");
    await db.update(t.users).set({ active, sessionVersion: u.sessionVersion + 1 }).where(eq(t.users.id, u.id));
    return active ? "Account riattivato." : "Account disattivato.";
  });
}

export async function resetPasswordAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await admin();
    const f = form(fd);
    const u = await assertUser(s, f.id("id"));
    if (!u.email) throw new AppError("Aggiungi prima un'email alla scheda per poter creare l'accesso.");
    await db
      .update(t.users)
      .set({ passwordHash: await hashPassword(f.password("password")), sessionVersion: u.sessionVersion + 1 })
      .where(eq(t.users.id, u.id));
    return "Nuova password impostata. Comunicala all'utente in modo riservato.";
  });
}

export async function adjustPointsAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await admin();
    const f = form(fd);
    const u = await assertUser(s, f.id("userId", "Cliente"), "client");
    const amount = f.int("amount", "Punti", { min: 1, max: 100000 })!;
    const sign = f.oneOf("direction", ["add", "subtract"] as const, "Operazione") === "add" ? 1 : -1;
    const reason = f.req("reason", "Motivazione", 200);
    const bal = await db.transaction((tx) =>
      adjustPoints(tx, { centerId: s.center.id, userId: u.id, delta: sign * amount, type: sign > 0 ? "manual" : "refund", reason, createdBy: s.user.id }),
    );
    if (sign > 0) {
      await notifySafe(s.center.id, [u.id], { type: "points", title: `Hai ricevuto ${amount} punti`, body: reason, url: "/app/punti" });
      await notifyUnlockedRewards(s.center.id, u.id, bal.before, bal.after);
    }
    return `Saldo aggiornato: ${bal.after} punti.`;
  });
}

/* ------------------------------------------------------------------ Dipendenti */

export async function saveEmployeeAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await admin();
    const f = form(fd);
    const id = f.optId("id");
    const email = f.email("email")!;
    await assertEmailFree(email, id ?? undefined);
    const values = {
      firstName: f.req("firstName", "Nome", 80),
      lastName: f.str("lastName", 80),
      email,
      phone: f.str("phone", 40),
      jobTitle: f.str("jobTitle", 80),
      notes: f.str("notes", 1000),
      color: /^#[0-9a-f]{6}$/i.test(f.str("color")) ? f.str("color") : "#C9A96E",
      permissions: {
        manageAvailability: f.bool("perm_manageAvailability"),
        createTreatments: f.bool("perm_createTreatments"),
        viewClientContacts: f.bool("perm_viewClientContacts"),
      },
    };
    const treatmentIds = f.ids("treatmentIds");
    const valid = treatmentIds.length
      ? (await db.select({ id: t.treatments.id }).from(t.treatments).where(and(eq(t.treatments.centerId, s.center.id), inArray(t.treatments.id, treatmentIds)))).map((r) => r.id)
      : [];
    await db.transaction(async (tx) => {
      let empId = id;
      if (empId) {
        await assertUser(s, empId, "employee");
        await tx.update(t.users).set(values).where(eq(t.users.id, empId));
      } else {
        const [row] = await tx
          .insert(t.users)
          .values({ ...values, centerId: s.center.id, role: "employee", passwordHash: await hashPassword(f.password("password")) })
          .returning({ id: t.users.id });
        empId = row.id;
        // Turno predefinito: lun–sab 9–13 / 14–19
        await tx.insert(t.workShifts).values(
          [1, 2, 3, 4, 5, 6].flatMap((weekday) => [
            { centerId: s.center.id, employeeId: row.id, weekday, startMinute: 540, endMinute: 780 },
            { centerId: s.center.id, employeeId: row.id, weekday, startMinute: 840, endMinute: 1140 },
          ]),
        );
      }
      await tx.delete(t.employeeTreatments).where(eq(t.employeeTreatments.employeeId, empId));
      if (valid.length) await tx.insert(t.employeeTreatments).values(valid.map((treatmentId) => ({ employeeId: empId!, treatmentId })));
    });
    return id ? "Profilo dipendente aggiornato." : "Dipendente creato con turno predefinito lun–sab.";
  });
}

export async function saveShiftsAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await admin();
    const f = form(fd);
    const emp = await assertUser(s, f.id("employeeId", "Dipendente"), "employee");
    const rows: (typeof t.workShifts.$inferInsert)[] = [];
    for (let wd = 0; wd < 7; wd++)
      for (const band of [1, 2]) {
        const a = f.str(`s_${wd}_${band}_start`);
        const b = f.str(`s_${wd}_${band}_end`);
        if (!a && !b) continue;
        if (!a || !b || timeToMinutes(b) <= timeToMinutes(a)) throw new AppError("Controlla gli orari: ogni fascia deve avere inizio e fine, con la fine successiva all'inizio.");
        rows.push({ centerId: s.center.id, employeeId: emp.id, weekday: wd, startMinute: timeToMinutes(a), endMinute: timeToMinutes(b) });
      }
    await db.transaction(async (tx) => {
      await tx.delete(t.workShifts).where(eq(t.workShifts.employeeId, emp.id));
      if (rows.length) await tx.insert(t.workShifts).values(rows);
    });
    return "Turni salvati.";
  });
}

/** Ferie/indisponibilità o disponibilità straordinarie. Il dipendente può gestire le proprie se autorizzato. */
export async function saveExceptionAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await actionSession("admin", "employee");
    const f = form(fd);
    let employeeId = s.user.id;
    if (s.user.role === "admin") employeeId = (await assertUser(s, f.id("employeeId", "Dipendente"), "employee")).id;
    else if (!(s.user.permissions ?? DEFAULT_PERMISSIONS).manageAvailability) throw new AppError("Non hai il permesso di modificare la tua disponibilità. Rivolgiti all'amministrazione.");
    const tz = s.center.timezone;
    const startAt = zonedFromInput(f.datetime("startAt", "Inizio")!, tz);
    const endAt = zonedFromInput(f.datetime("endAt", "Fine")!, tz);
    if (endAt <= startAt) throw new AppError("La fine deve essere successiva all'inizio.");
    const kind = f.oneOf("kind", ["unavailable", "available"] as const, "Tipo");
    if (kind === "unavailable") {
      const [{ n }] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(t.appointments)
        .where(and(eq(t.appointments.employeeId, employeeId), eq(t.appointments.status, "confirmed"), lt(t.appointments.startAt, endAt), gte(t.appointments.endAt, startAt)));
      await db.insert(t.availabilityExceptions).values({ centerId: s.center.id, employeeId, kind, startAt, endAt, reason: f.str("reason", 200) });
      return n > 0 ? `Indisponibilità salvata. Attenzione: ${n} appuntamenti già confermati in questo periodo vanno spostati.` : "Indisponibilità salvata.";
    }
    await db.insert(t.availabilityExceptions).values({ centerId: s.center.id, employeeId, kind, startAt, endAt, reason: f.str("reason", 200) });
    return "Disponibilità straordinaria salvata.";
  });
}

export async function deleteExceptionAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await actionSession("admin", "employee");
    const id = form(fd).id("id");
    if (s.user.role === "employee" && !(s.user.permissions ?? DEFAULT_PERMISSIONS).manageAvailability) throw new AppError("Permesso non concesso.");
    await db
      .delete(t.availabilityExceptions)
      .where(
        and(
          eq(t.availabilityExceptions.id, id),
          eq(t.availabilityExceptions.centerId, s.center.id),
          s.user.role === "employee" ? eq(t.availabilityExceptions.employeeId, s.user.id) : undefined,
        ),
      );
    return "Eliminato.";
  });
}

/* ------------------------------------------------------------------ Trattamenti */

export async function saveTreatmentAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await admin();
    const f = form(fd);
    const id = f.optId("id");
    const [existing] = id ? await db.select().from(t.treatments).where(and(eq(t.treatments.id, id), eq(t.treatments.centerId, s.center.id))) : [];
    if (id && !existing) throw new AppError("Trattamento non trovato.");
    const values = {
      name: f.req("name", "Nome", 120),
      description: f.str("description", 3000),
      notes: f.str("notes", 1000),
      categoryId: f.optId("categoryId"),
      durationMinutes: f.int("duration", "Durata", { min: 5, max: 600 })!,
      priceCents: f.cents("price", "Prezzo")!,
      cancellationHours: f.int("cancellationHours", "Regola di disdetta", { min: 0, max: 720, optional: true }),
      active: f.bool("active"),
      status: f.oneOf("status", ["approved", "pending", "rejected"] as const, "Stato") as TreatmentStatus,
      imageId: await imageFromForm(s.center.id, fd, existing?.imageId ?? null),
    };
    const employeeIds = f.ids("employeeIds");
    const valid = employeeIds.length
      ? (await db.select({ id: t.users.id }).from(t.users).where(and(eq(t.users.centerId, s.center.id), eq(t.users.role, "employee"), inArray(t.users.id, employeeIds)))).map((r) => r.id)
      : [];
    const treatmentId = await db.transaction(async (tx) => {
      let tid = id;
      if (tid) await tx.update(t.treatments).set(values).where(eq(t.treatments.id, tid));
      else tid = (await tx.insert(t.treatments).values({ ...values, centerId: s.center.id, createdBy: s.user.id }).returning({ id: t.treatments.id }))[0].id;
      await tx.delete(t.employeeTreatments).where(eq(t.employeeTreatments.treatmentId, tid));
      if (valid.length) await tx.insert(t.employeeTreatments).values(valid.map((employeeId) => ({ employeeId, treatmentId: tid! })));
      return tid;
    });
    // Avvisa il dipendente che aveva proposto il trattamento quando cambia lo stato.
    if (existing && existing.status !== values.status && existing.createdBy && existing.createdBy !== s.user.id)
      await notifySafe(s.center.id, [existing.createdBy], {
        type: "treatment",
        title: values.status === "approved" ? "Trattamento approvato" : values.status === "rejected" ? "Trattamento non approvato" : "Trattamento in revisione",
        body: `"${values.name}" ${values.status === "approved" ? "è ora prenotabile dai clienti." : "è stato aggiornato dall'amministrazione."}`,
        url: "/staff/trattamenti",
      });
    void treatmentId;
    return id ? "Trattamento aggiornato." : "Trattamento creato.";
  });
}

export async function deleteTreatmentAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await admin();
    const id = form(fd).id("id");
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(t.appointments).where(eq(t.appointments.treatmentId, id));
    if (n > 0) {
      await db.update(t.treatments).set({ active: false }).where(and(eq(t.treatments.id, id), eq(t.treatments.centerId, s.center.id)));
      return "Il trattamento ha uno storico di appuntamenti: è stato disattivato invece che eliminato.";
    }
    await db.delete(t.treatments).where(and(eq(t.treatments.id, id), eq(t.treatments.centerId, s.center.id)));
    return "Trattamento eliminato.";
  });
}

export async function saveCategoryAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await admin();
    const f = form(fd);
    const id = f.optId("id");
    const name = f.req("name", "Nome categoria", 60);
    if (id) await db.update(t.categories).set({ name }).where(and(eq(t.categories.id, id), eq(t.categories.centerId, s.center.id)));
    else {
      const [{ m }] = await db.select({ m: sql<number>`coalesce(max(${t.categories.sort}), 0)::int` }).from(t.categories).where(eq(t.categories.centerId, s.center.id));
      await db.insert(t.categories).values({ centerId: s.center.id, name, sort: m + 1 });
    }
    return "Categoria salvata.";
  });
}

export async function deleteCategoryAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await admin();
    await db.delete(t.categories).where(and(eq(t.categories.id, form(fd).id("id")), eq(t.categories.centerId, s.center.id)));
    return "Categoria eliminata.";
  });
}

/* ------------------------------------------------------------------ Promozioni */

export async function savePromotionAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await admin();
    const f = form(fd);
    const id = f.optId("id");
    const [existing] = id ? await db.select().from(t.promotions).where(and(eq(t.promotions.id, id), eq(t.promotions.centerId, s.center.id))) : [];
    if (id && !existing) throw new AppError("Promozione non trovata.");
    const startsOn = f.date("startsOn", "Data di inizio")!;
    const endsOn = f.date("endsOn", "Data di fine")!;
    if (endsOn < startsOn) throw new AppError("La data di fine deve essere successiva alla data di inizio.");
    const treatmentId = f.optId("treatmentId");
    if (treatmentId) {
      const [tr] = await db.select({ id: t.treatments.id }).from(t.treatments).where(and(eq(t.treatments.id, treatmentId), eq(t.treatments.centerId, s.center.id)));
      if (!tr) throw new AppError("Trattamento collegato non trovato.");
    }
    const values = {
      title: f.req("title", "Titolo", 140),
      description: f.str("description", 3000),
      category: f.oneOf("category", PROMO_CATEGORIES.map((c) => c[0]), "Categoria"),
      originalPriceCents: f.cents("originalPrice", "Prezzo originale", true),
      promoPriceCents: f.cents("promoPrice", "Prezzo promozionale", true),
      treatmentId,
      startsOn,
      endsOn,
      active: f.bool("active"),
      imageId: await imageFromForm(s.center.id, fd, existing?.imageId ?? null),
    };
    if (id) await db.update(t.promotions).set(values).where(eq(t.promotions.id, id));
    else await db.insert(t.promotions).values({ ...values, centerId: s.center.id });
    let sent = 0;
    if (f.bool("notify") && values.active)
      sent = await notify(s.center.id, await clientIds(s.center.id), {
        type: "promotion",
        title: `Nuova promozione: ${values.title}`,
        body: `${values.promoPriceCents != null ? `A soli ${eur(values.promoPriceCents)}. ` : ""}Valida fino al ${fmtDay(endsOn, "d MMMM")}.`,
        url: "/app/promozioni",
      });
    return `Promozione salvata${sent ? ` e notificata a ${sent} clienti` : ""}.`;
  });
}

export async function deletePromotionAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await admin();
    await db.delete(t.promotions).where(and(eq(t.promotions.id, form(fd).id("id")), eq(t.promotions.centerId, s.center.id)));
    return "Promozione eliminata.";
  });
}

/* ------------------------------------------------------------------ Eventi */

export async function saveEventAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await admin();
    const f = form(fd);
    const id = f.optId("id");
    const tz = s.center.timezone;
    const [existing] = id ? await db.select().from(t.events).where(and(eq(t.events.id, id), eq(t.events.centerId, s.center.id))) : [];
    if (id && !existing) throw new AppError("Evento non trovato.");
    const startsAt = zonedFromInput(f.datetime("startsAt", "Data e ora di inizio")!, tz);
    const endRaw = f.datetime("endsAt", "Fine", true);
    const endsAt = endRaw ? zonedFromInput(endRaw, tz) : null;
    if (endsAt && endsAt <= startsAt) throw new AppError("L'orario di fine deve essere successivo all'inizio.");
    const values = {
      title: f.req("title", "Titolo", 140),
      description: f.str("description", 4000),
      location: f.str("location", 200),
      startsAt,
      endsAt,
      maxParticipants: f.int("maxParticipants", "Posti disponibili", { min: 1, max: 100000, optional: true }),
      priceCents: f.cents("price", "Prezzo", true) ?? 0,
      published: f.bool("published"),
      imageId: await imageFromForm(s.center.id, fd, existing?.imageId ?? null),
    };
    let eventId = id;
    if (id) await db.update(t.events).set(values).where(eq(t.events.id, id));
    else eventId = (await db.insert(t.events).values({ ...values, centerId: s.center.id }).returning({ id: t.events.id }))[0].id;
    let sent = 0;
    if (f.bool("notify") && values.published)
      sent = await notify(s.center.id, await clientIds(s.center.id), {
        type: "event",
        title: `Nuovo evento: ${values.title}`,
        body: `${fmt(startsAt, tz, "EEEE d MMMM 'alle' HH:mm")}${values.location ? ` · ${values.location}` : ""}. Riserva il tuo posto.`,
        url: `/app/eventi/${eventId}`,
      });
    return `Evento salvato${sent ? ` e notificato a ${sent} clienti` : ""}.`;
  });
}

export async function deleteEventAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await admin();
    await db.delete(t.events).where(and(eq(t.events.id, form(fd).id("id")), eq(t.events.centerId, s.center.id)));
    return "Evento eliminato.";
  });
}

export async function addParticipantAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await admin();
    const f = form(fd);
    const client = await assertUser(s, f.id("userId", "Cliente"), "client");
    await registerToEvent(s.center.id, f.id("eventId", "Evento"), client.id);
    return "Partecipante aggiunto.";
  });
}

export async function removeParticipantAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await admin();
    await db.delete(t.eventRegistrations).where(and(eq(t.eventRegistrations.id, form(fd).id("id")), eq(t.eventRegistrations.centerId, s.center.id)));
    return "Partecipante rimosso.";
  });
}

/* ------------------------------------------------------------------ Fedeltà */

export async function saveLoyaltySettingsAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await admin();
    const f = form(fd);
    const perEuro = Number(f.req("pointsPerEuro", "Punti per euro").replace(",", "."));
    if (Number.isNaN(perEuro) || perEuro < 0 || perEuro > 100) throw new AppError("Punti per euro non valido.");
    await db
      .update(t.centers)
      .set({ pointsPerEuro: Math.round(perEuro * 100), pointsPerTreatment: f.int("pointsPerTreatment", "Punti per trattamento", { min: 0, max: 10000 })! })
      .where(eq(t.centers.id, s.center.id));
    return "Regole del programma fedeltà aggiornate.";
  });
}

export async function saveRewardAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await admin();
    const f = form(fd);
    const id = f.optId("id");
    const values = {
      name: f.req("name", "Nome del premio", 120),
      description: f.str("description", 600),
      pointsCost: f.int("pointsCost", "Punti necessari", { min: 1, max: 1000000 })!,
      active: f.bool("active"),
    };
    if (id) await db.update(t.rewards).set(values).where(and(eq(t.rewards.id, id), eq(t.rewards.centerId, s.center.id)));
    else await db.insert(t.rewards).values({ ...values, centerId: s.center.id });
    return "Premio salvato.";
  });
}

export async function deleteRewardAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await admin();
    await db.delete(t.rewards).where(and(eq(t.rewards.id, form(fd).id("id")), eq(t.rewards.centerId, s.center.id)));
    return "Premio eliminato.";
  });
}

export async function useRedemptionAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await admin();
    const done = await db
      .update(t.redemptions)
      .set({ status: "used", usedAt: new Date() })
      .where(and(eq(t.redemptions.id, form(fd).id("id")), eq(t.redemptions.centerId, s.center.id), eq(t.redemptions.status, "active")))
      .returning();
    if (!done.length) throw new AppError("Riscatto non trovato o già utilizzato.");
    return "Premio segnato come utilizzato.";
  });
}

export async function cancelRedemptionAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await admin();
    const red = await cancelRedemption(s.center.id, form(fd).id("id"), s.user.id);
    return `Riscatto annullato: ${red.pointsSpent} punti restituiti.`;
  });
}

/* ------------------------------------------------------------------ Notifiche */

export async function sendBroadcastAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await admin();
    const f = form(fd);
    const title = f.req("title", "Titolo", 80);
    const body = f.req("body", "Messaggio", 400);
    const audience = f.oneOf("audience", ["all", "birthday_month", "min_points", "inactive", "new", "manual"] as const, "Destinatari");
    const base = and(eq(t.users.centerId, s.center.id), eq(t.users.role, "client"), eq(t.users.active, true), isNotNull(t.users.passwordHash));
    const today = localDate(new Date(), s.center.timezone);
    let cond;
    let label = "Tutti i clienti";
    if (audience === "birthday_month") {
      cond = sql`to_char(${t.users.birthDate}, 'MM') = ${today.slice(5, 7)}`;
      label = "Compleanni del mese";
    } else if (audience === "min_points") {
      const min = f.int("minPoints", "Punti minimi", { min: 1 })!;
      cond = gte(t.users.pointsBalance, min);
      label = `Clienti con almeno ${min} punti`;
    } else if (audience === "inactive") {
      const days = f.int("inactiveDays", "Giorni di inattività", { min: 1, max: 3650 })!;
      const since = new Date(Date.now() - days * 86400000);
      cond = sql`not exists (select 1 from ${t.appointments} a where a.client_id = ${t.users.id} and a.status <> 'cancelled' and a.start_at >= ${since})`;
      label = `Clienti inattivi da ${days} giorni`;
    } else if (audience === "new") {
      cond = gte(t.users.createdAt, new Date(Date.now() - 30 * 86400000));
      label = "Nuovi clienti (30 giorni)";
    } else if (audience === "manual") {
      const ids = f.ids("userIds");
      if (!ids.length) throw new AppError("Seleziona almeno un cliente.");
      cond = inArray(t.users.id, ids);
      label = "Selezione manuale";
    }
    const targets = await db.select({ id: t.users.id }).from(t.users).where(and(base, cond));
    if (!targets.length) throw new AppError("Nessun cliente corrisponde ai destinatari selezionati.");
    const sent = await notify(s.center.id, targets.map((u) => u.id), { type: "broadcast", title, body, url: f.str("url", 200) || "/app" });
    await db.insert(t.broadcasts).values({ centerId: s.center.id, title, body, audience: label, recipients: sent });
    return `Comunicazione inviata a ${sent} clienti.`;
  });
}

export async function saveNotificationSettingsAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await admin();
    const f = form(fd);
    await db
      .update(t.centers)
      .set({
        birthdayEnabled: f.bool("birthdayEnabled"),
        birthdayMessage: f.req("birthdayMessage", "Messaggio di auguri", 400),
        birthdayGift: f.str("birthdayGift", 200),
        birthdayBonusPoints: f.int("birthdayBonusPoints", "Punti omaggio", { min: 0, max: 100000 })!,
        reminderHours: f.int("reminderHours", "Anticipo promemoria", { min: 1, max: 168 })!,
      })
      .where(eq(t.centers.id, s.center.id));
    return "Impostazioni notifiche salvate.";
  });
}

/* ------------------------------------------------------------------ Impostazioni */

export async function saveCenterSettingsAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await admin();
    const f = form(fd);
    await db
      .update(t.centers)
      .set({
        name: f.req("name", "Nome del centro", 120),
        tagline: f.str("tagline", 160),
        address: f.str("address", 200),
        phone: f.str("phone", 40),
        email: f.str("email", 120),
      })
      .where(eq(t.centers.id, s.center.id));
    return "Dati del centro aggiornati.";
  });
}

export async function saveBookingRulesAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await admin();
    const f = form(fd);
    await db
      .update(t.centers)
      .set({
        cancellationHours: f.int("cancellationHours", "Termine di disdetta", { min: 0, max: 720 })!,
        bufferMinutes: f.int("bufferMinutes", "Tempo di preparazione", { min: 0, max: 120 })!,
        slotIntervalMinutes: f.int("slotIntervalMinutes", "Intervallo orari", { min: 5, max: 120 })!,
        bookingHorizonDays: f.int("bookingHorizonDays", "Giorni prenotabili", { min: 1, max: 365 })!,
        minAdvanceMinutes: f.int("minAdvanceMinutes", "Anticipo minimo", { min: 0, max: 10080 })!,
      })
      .where(eq(t.centers.id, s.center.id));
    return "Regole di prenotazione aggiornate.";
  });
}

export async function createAdminAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await admin();
    const f = form(fd);
    const email = f.email("email")!;
    await assertEmailFree(email);
    await db.insert(t.users).values({
      centerId: s.center.id,
      role: "admin",
      email,
      firstName: f.req("firstName", "Nome", 80),
      lastName: f.str("lastName", 80),
      passwordHash: await hashPassword(f.password("password")),
    });
    return "Nuovo amministratore creato.";
  });
}
