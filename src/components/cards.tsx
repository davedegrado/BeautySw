import Link from "next/link";
import { CalendarDays, MapPin, Users } from "lucide-react";
import type { EventRow, Promotion } from "@/db/schema";
import { PROMO_CATEGORIES } from "@/db/schema";
import { fmt, fmtDay } from "@/lib/dates";
import { discountPct, eur } from "@/lib/format";
import type { ReactNode } from "react";
import { Cover } from "./ui";

export const promoLabel = (c: string) => PROMO_CATEGORIES.find((x) => x[0] === c)?.[1] ?? c;

export function PromoCard({ promo, action, compact }: { promo: Promotion; action?: ReactNode; compact?: boolean }) {
  const pct = discountPct(promo.originalPriceCents, promo.promoPriceCents);
  return (
    <article className="card group flex h-full flex-col overflow-hidden">
      <Cover imageId={promo.imageId} alt={promo.title} className={compact ? "h-36" : "h-52"}>
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-transparent" />
        <span className="badge badge-dark absolute left-3 top-3 !border-gold/50">{promoLabel(promo.category)}</span>
        {pct && <span className="absolute right-3 top-3 flex h-12 w-12 items-center justify-center rounded-full border border-gold bg-ink/80 font-serif text-lg text-gold-light">-{pct}%</span>}
      </Cover>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-2xl leading-tight">{promo.title}</h3>
        {!compact && promo.description && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-smoke">{promo.description}</p>}
        <div className="mt-auto pt-4">
          <div className="flex items-baseline gap-3">
            {promo.promoPriceCents != null && <span className="font-serif text-3xl text-gold-deep">{eur(promo.promoPriceCents)}</span>}
            {promo.originalPriceCents != null && promo.originalPriceCents !== promo.promoPriceCents && <span className="text-sm text-smoke line-through">{eur(promo.originalPriceCents)}</span>}
          </div>
          <p className="mt-1 text-xs text-smoke">Valida fino al {fmtDay(promo.endsOn)}</p>
          {action && <div className="mt-4">{action}</div>}
        </div>
      </div>
    </article>
  );
}

export function EventCard({ event, taken, tz, href, footer }: { event: EventRow; taken: number; tz: string; href?: string; footer?: ReactNode }) {
  const left = event.maxParticipants != null ? Math.max(0, event.maxParticipants - taken) : null;
  const body = (
    <>
      <Cover imageId={event.imageId} alt={event.title} className="h-44">
        <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-transparent" />
        <div className="absolute bottom-3 left-4 text-ivory">
          <p className="font-serif text-4xl leading-none">{fmt(event.startsAt, tz, "d")}</p>
          <p className="text-[0.62rem] uppercase tracking-[0.22em] text-gold-light">{fmt(event.startsAt, tz, "MMMM yyyy")}</p>
        </div>
        {!event.published && <span className="badge absolute right-3 top-3">Bozza</span>}
        {left === 0 && <span className="badge badge-dark absolute right-3 top-3 !border-gold/50">Al completo</span>}
      </Cover>
      <div className="p-5">
        <h3 className="text-2xl leading-tight">{event.title}</h3>
        <ul className="mt-3 space-y-1.5 text-sm text-anthracite">
          <li className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-gold" strokeWidth={1.4} />
            {fmt(event.startsAt, tz, "EEEE d MMMM · HH:mm")}
          </li>
          {event.location && (
            <li className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gold" strokeWidth={1.4} />
              {event.location}
            </li>
          )}
          <li className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gold" strokeWidth={1.4} />
            {left == null ? `${taken} partecipanti` : left === 0 ? "Posti esauriti" : `${left} posti disponibili su ${event.maxParticipants}`}
            <span className="ml-auto font-serif text-lg text-gold-deep">{event.priceCents ? eur(event.priceCents) : "Gratuito"}</span>
          </li>
        </ul>
      </div>
    </>
  );
  return (
    <article className="card group flex h-full flex-col overflow-hidden">
      {href ? (
        <Link href={href} className="block flex-1">
          {body}
        </Link>
      ) : (
        <div className="flex-1">{body}</div>
      )}
      {footer && <div className="border-t border-line px-5 py-3">{footer}</div>}
    </article>
  );
}
