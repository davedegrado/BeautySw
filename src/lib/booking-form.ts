import { db, t } from "@/db";
import type { form } from "./action";
import { zonedFromInput } from "./dates";
import type { Session } from "./session";

type F = ReturnType<typeof form>;

/** Cliente scelto nel form oppure, con "Nuovo cliente", una nuova scheda creata al volo (senza accesso all'app). */
export async function clientFromForm(s: Session, f: F): Promise<string> {
  if (f.str("clientId") !== "__new") return f.id("clientId", "Cliente");
  const [row] = await db
    .insert(t.users)
    .values({
      centerId: s.center.id,
      role: "client",
      firstName: f.req("newFirstName", "Nome del cliente", 80),
      lastName: f.str("newLastName", 80),
      phone: f.str("newPhone", 40),
    })
    .returning({ id: t.users.id });
  return row.id;
}

/** Orario scelto: uno slot libero (ISO) oppure, in modalità manuale, data e ora inserite a mano. */
export function startFromForm(s: Session, f: F): { start: Date; manual: boolean } {
  const manual = f.bool("manual");
  const start = manual ? zonedFromInput(`${f.date("date", "Data")}T${f.req("time", "Orario")}`, s.center.timezone) : new Date(f.req("start", "Orario"));
  return { start, manual };
}
