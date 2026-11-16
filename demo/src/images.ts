import { notInArray } from "drizzle-orm";
import { db, t } from "./db";

const urls = new Map<string, string>();

export function demoImageUrl(id: string | null | undefined) {
  return id ? (urls.get(id) ?? null) : null;
}

/** Carica nel browser le immagini nuove (caricate dall'amministratore) come URL blob. */
export async function syncImages() {
  const known = [...urls.keys()];
  const rows = await db
    .select()
    .from(t.images)
    .where(known.length ? notInArray(t.images.id, known) : undefined);
  for (const r of rows) urls.set(r.id, URL.createObjectURL(new Blob([new Uint8Array(r.data)], { type: r.mime })));
}
