import { exportCenter } from "@/lib/backup";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Download del backup completo del centro (solo amministratore). */
export async function GET() {
  const s = await getSession();
  if (!s || s.user.role !== "admin") return new Response("Non autorizzato", { status: 401 });
  const data = await exportCenter(s.center.id);
  const name = `backup-${s.center.slug}-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
