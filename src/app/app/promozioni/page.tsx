import Link from "next/link";
import { PROMO_CATEGORIES } from "@/db/schema";
import { PromoCard } from "@/components/cards";
import { Empty, PageHeader } from "@/components/ui";
import { activePromotions } from "@/lib/queries";
import { requireRole } from "@/lib/session";

export const metadata = { title: "Promozioni" };

export default async function PromotionsPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const s = await requireRole("client");
  const { cat } = await searchParams;
  const all = await activePromotions(s.center.id, s.center.timezone);
  const cats = PROMO_CATEGORIES.filter(([k]) => all.some((p) => p.category === k));
  const list = cat ? all.filter((p) => p.category === cat) : all;
  return (
    <>
      <PageHeader eyebrow="Riservato a te" title="Promozioni" subtitle="Offerte, pacchetti e trattamenti esclusivi selezionati dal nostro team." />
      {all.length === 0 ? (
        <Empty title="Nessuna promozione attiva" text="Torna presto: le nuove offerte ti verranno comunicate con una notifica." />
      ) : (
        <>
          <div className="scroll-x -mx-4 mb-6 flex gap-2 px-4 pb-1 sm:mx-0 sm:px-0">
            <Link href="/app/promozioni" className={`tab ${!cat ? "tab-active" : ""}`}>
              Tutte
            </Link>
            {cats.map(([k, label]) => (
              <Link key={k} href={`/app/promozioni?cat=${k}`} className={`tab ${cat === k ? "tab-active" : ""}`}>
                {label}
              </Link>
            ))}
          </div>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((p) => (
              <PromoCard
                key={p.id}
                promo={p}
                action={
                  <Link href={`/app/prenota?promo=${p.id}`} className="btn btn-gold w-full">
                    Prenota ora
                  </Link>
                }
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}
