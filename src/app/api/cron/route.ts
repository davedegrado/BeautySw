import { runScheduledJobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";

/**
 * Endpoint per scheduler esterni (Vercel Cron, cron-job.org, GitHub Actions…):
 *   GET /api/cron?secret=CRON_SECRET   oppure   Authorization: Bearer CRON_SECRET
 * Invia promemoria appuntamenti e auguri di compleanno. È idempotente.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET non configurato" }, { status: 503 });
  const given = new URL(req.url).searchParams.get("secret") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (given !== secret) return Response.json({ error: "Non autorizzato" }, { status: 401 });
  try {
    return Response.json({ ok: true, ...(await runScheduledJobs()) });
  } catch (e) {
    console.error("[cron]", e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
