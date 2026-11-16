import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { AppError } from "./errors";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Gestisce il campo immagine di un form:
 * - nuovo file caricato → lo salva e restituisce il nuovo id
 * - spunta "rimuovi" → null
 * - altrimenti mantiene l'immagine attuale
 */
export async function imageFromForm(centerId: string, fd: FormData, current: string | null = null, field = "image"): Promise<string | null> {
  const file = fd.get(field);
  if (file instanceof File && file.size > 0) {
    if (!ALLOWED.includes(file.type)) throw new AppError("Formato immagine non supportato (usa JPG, PNG o WebP).");
    if (file.size > MAX_BYTES) throw new AppError("L'immagine supera i 4 MB.");
    const [row] = await db
      .insert(t.images)
      .values({ centerId, mime: file.type, data: Buffer.from(await file.arrayBuffer()) })
      .returning({ id: t.images.id });
    if (current) await db.delete(t.images).where(and(eq(t.images.id, current), eq(t.images.centerId, centerId)));
    return row.id;
  }
  if (fd.get(`${field}_remove`) === "on" && current) {
    await db.delete(t.images).where(and(eq(t.images.id, current), eq(t.images.centerId, centerId)));
    return null;
  }
  return current;
}
