import { eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { db, t } from "@/db";
import { getOrCreateConfig } from "./config";

export type NotificationInput = { type: string; title: string; body: string; url?: string };

let vapidReady: Promise<string> | null = null;

/** Restituisce la chiave pubblica VAPID, configurando web-push al primo utilizzo. */
export function getVapidPublicKey(): Promise<string> {
  if (!vapidReady) {
    vapidReady = (async () => {
      let pub = process.env.VAPID_PUBLIC_KEY;
      let priv = process.env.VAPID_PRIVATE_KEY;
      if (!pub || !priv) {
        const stored = JSON.parse(
          await getOrCreateConfig("vapid_keys", () => JSON.stringify(webpush.generateVAPIDKeys())),
        ) as { publicKey: string; privateKey: string };
        pub = stored.publicKey;
        priv = stored.privateKey;
      }
      webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:info@example.com", pub, priv);
      return pub;
    })().catch((e) => {
      vapidReady = null;
      throw e;
    });
  }
  return vapidReady;
}

/**
 * Salva la notifica nella casella in-app di ogni destinatario e la inoltra
 * come notifica push a tutti i dispositivi registrati. L'invio push è best-effort:
 * un errore non blocca mai l'operazione che ha generato la notifica.
 */
export async function notify(centerId: string, userIds: string[], n: NotificationInput): Promise<number> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return 0;
  const url = n.url ?? "/";
  await db.insert(t.notifications).values(ids.map((userId) => ({ centerId, userId, type: n.type, title: n.title, body: n.body, url })));
  try {
    const subs = await db.select().from(t.pushSubscriptions).where(inArray(t.pushSubscriptions.userId, ids));
    if (subs.length) {
      await getVapidPublicKey();
      const payload = JSON.stringify({ title: n.title, body: n.body, url });
      await Promise.allSettled(
        subs.map(async (s) => {
          try {
            await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 });
          } catch (e) {
            const code = (e as { statusCode?: number }).statusCode;
            if (code === 404 || code === 410) await db.delete(t.pushSubscriptions).where(eq(t.pushSubscriptions.id, s.id));
            else console.error("[push] invio fallito", code ?? e);
          }
        }),
      );
    }
  } catch (e) {
    console.error("[push] errore", e);
  }
  return ids.length;
}

export async function notifySafe(centerId: string, userIds: string[], n: NotificationInput) {
  try {
    return await notify(centerId, userIds, n);
  } catch (e) {
    console.error("[notify] errore", e);
    return 0;
  }
}
