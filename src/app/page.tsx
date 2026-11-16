import Link from "next/link";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { CalendarCheck, Crown, Gift, Sparkles } from "lucide-react";
import { db, t } from "@/db";
import { Logo, Mandala } from "@/components/mandala";
import { getSession, homeFor } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Landing() {
  const s = await getSession();
  if (s) redirect(homeFor(s.user.role));
  const [center] = await db.select().from(t.centers).orderBy(asc(t.centers.createdAt)).limit(1);
  if (!center) redirect("/setup");
  const features = [
    [CalendarCheck, "Prenota in pochi istanti", "Scegli trattamento, professionista e orario: la conferma è immediata."],
    [Crown, "Luxury Rewards", "Ogni trattamento ti avvicina a premi esclusivi pensati per te."],
    [Gift, "Promozioni riservate", "Offerte e pacchetti dedicati, in anteprima per le nostre clienti."],
    [Sparkles, "Eventi esclusivi", "Serate beauty, open day e masterclass a posti limitati."],
  ] as const;
  return (
    <div className="min-h-dvh bg-ink text-ivory">
      <div className="relative overflow-hidden">
        <Mandala className="pointer-events-none absolute -right-40 -top-40 h-[42rem] w-[42rem] text-gold/25" spin />
        <Mandala className="pointer-events-none absolute -bottom-56 -left-48 h-[34rem] w-[34rem] text-gold/10" petals={12} />
        <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 pb-6 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
          <Logo light />
          <Link href="/accedi" className="btn btn-outline !border-gold/70 !text-gold-light hover:!text-ink">
            Accedi
          </Link>
        </header>
        <section className="relative mx-auto max-w-6xl px-6 pb-24 pt-16 sm:pt-28">
          <p className="eyebrow mb-5 !text-gold animate-rise">{center.name}</p>
          <h1 className="max-w-3xl animate-rise text-5xl leading-[1.05] sm:text-7xl">
            Il tuo rituale di <em className="gold-text font-normal">bellezza</em>,<br /> a portata di mano.
          </h1>
          <p className="mt-6 max-w-xl animate-rise text-base leading-relaxed text-ivory/65 [animation-delay:120ms]">
            {center.tagline || "Prenota i tuoi trattamenti, scopri promozioni ed eventi riservati e accumula punti con il programma Luxury Rewards."}
          </p>
          <div className="mt-10 flex animate-rise flex-wrap gap-3 [animation-delay:200ms]">
            <Link href="/registrati" className="btn btn-gold">
              Crea il tuo profilo
            </Link>
            <Link href="/accedi" className="btn btn-outline !border-white/25 !text-ivory hover:!border-gold hover:!text-ink">
              Ho già un account
            </Link>
          </div>
        </section>
      </div>
      <div className="gold-line opacity-60" />
      <section className="mx-auto grid max-w-6xl gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
        {features.map(([Icon, title, text]) => (
          <div key={title} className="bg-ink px-6 py-10">
            <Icon className="mb-5 h-6 w-6 text-gold" strokeWidth={1.2} />
            <h2 className="text-2xl">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ivory/55">{text}</p>
          </div>
        ))}
      </section>
      <footer className="mx-auto max-w-6xl px-6 py-10 text-center text-xs tracking-wide text-ivory/40">
        {center.name}
        {center.address && ` · ${center.address}`}
        {center.phone && ` · ${center.phone}`}
      </footer>
    </div>
  );
}
