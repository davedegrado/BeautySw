import type { ReactNode } from "react";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, t } from "@/db";
import type { Role } from "@/db/schema";
import { fullName } from "@/lib/format";
import { requireRole } from "@/lib/session";
import { Shell } from "./shell";

/** Layout protetto: verifica il ruolo sul server prima di mostrare qualsiasi pagina dell'area. */
export async function RoleLayout({ role, children }: { role: Role; children: ReactNode }) {
  const s = await requireRole(role);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(t.notifications)
    .where(and(eq(t.notifications.userId, s.user.id), isNull(t.notifications.readAt)));
  return (
    <Shell role={role} userName={fullName(s.user)} centerName={s.center.name} unread={n}>
      {children}
    </Shell>
  );
}
