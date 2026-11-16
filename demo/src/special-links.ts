import { exportCenter } from "@/lib/backup";
import { getSession } from "@/lib/session";

/** Endpoint API che nella demo vengono eseguiti nel browser. */
export function handleSpecialLink(path: string, e: MouseEvent) {
  if (path !== "/api/backup") return false;
  e.preventDefault();
  (async () => {
    const s = await getSession();
    if (!s || s.user.role !== "admin") return;
    const data = await exportCenter(s.center.id);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `backup-${s.center.slug}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  })().catch((err) => console.error(err));
  return true;
}
