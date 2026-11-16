import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Bell, CalendarCheck, CalendarX, Crown, Gift, Megaphone, PartyPopper, Sparkles, Tag } from "lucide-react";
import { db, t } from "@/db";
import { fmt } from "@/lib/dates";
import type { Session } from "@/lib/session";
import { MarkRead } from "./mark-read";
import { PushToggle } from "./push";
import { Empty, PageHeader } from "./ui";

const ICONS: Record<string, typeof Bell> = {
  booking: CalendarCheck, reminder: CalendarCheck, change: CalendarCheck, cancellation: CalendarX, promotion: Tag, event: PartyPopper,
  reward: Crown, points: Crown, birthday: Gift, broadcast: Megaphone, treatment: Sparkles, welcome: Sparkles,
};

/** Casella delle notifiche in-app, condivisa dai tre ruoli. */
export async function Inbox({ session }: { session: Session }) {
  const rows = await db.select().from(t.notifications).where(eq(t.notifications.userId, session.user.id)).orderBy(desc(t.notifications.createdAt)).limit(80);
  const unread = rows.some((r) => !r.readAt);
  return (
    <>
      <PageHeader eyebrow="Aggiornamenti" title="Notifiche" />
      <div className="card mb-6 flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="font-serif text-xl">Notifiche push</p>
          <p className="text-sm text-smoke">Ricevi conferme, promemoria e novità direttamente su questo dispositivo.</p>
        </div>
        <PushToggle />
      </div>
      {unread && <MarkRead />}
      {rows.length === 0 ? (
        <Empty title="Nessuna notifica" text="Qui troverai conferme, promemoria e comunicazioni del centro." />
      ) : (
        <ul className="card divide-y divide-cream overflow-hidden">
          {rows.map((n) => {
            const Icon = ICONS[n.type] ?? Bell;
            return (
              <li key={n.id}>
                <Link href={n.url || "/"} className={`flex gap-4 px-5 py-4 transition hover:bg-cream/50 ${n.readAt ? "" : "bg-gold/[0.07]"}`}>
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/50 text-gold-deep">
                    <Icon className="h-4 w-4" strokeWidth={1.4} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className={`truncate ${n.readAt ? "" : "font-medium"}`}>{n.title}</span>
                      <span className="shrink-0 text-xs text-smoke">{fmt(n.createdAt, session.center.timezone, "d MMM · HH:mm")}</span>
                    </span>
                    <span className="mt-0.5 block text-sm text-smoke">{n.body}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
