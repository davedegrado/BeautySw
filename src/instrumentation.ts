/**
 * Timer interno: quando l'app gira come server Node (npm start, Docker, VPS)
 * i job pianificati vengono eseguiti ogni 10 minuti senza configurazioni esterne.
 * Su piattaforme serverless usare invece l'endpoint /api/cron.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.DISABLE_INTERNAL_CRON === "true") return;
  const g = globalThis as unknown as { __jobsTimer?: NodeJS.Timeout };
  if (g.__jobsTimer) return;
  const tick = async () => {
    try {
      const { runScheduledJobs } = await import("./lib/jobs");
      await runScheduledJobs();
    } catch (e) {
      console.error("[jobs] esecuzione fallita:", (e as Error).message);
    }
  };
  g.__jobsTimer = setInterval(tick, 10 * 60 * 1000);
  g.__jobsTimer.unref?.();
  setTimeout(tick, 15_000).unref?.();
}
