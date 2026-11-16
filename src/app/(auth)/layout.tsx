import Link from "next/link";
import type { ReactNode } from "react";
import { Logo, Mandala } from "@/components/mandala";

export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-ink p-12 text-ivory lg:flex lg:flex-col lg:justify-between">
        <Mandala className="pointer-events-none absolute left-1/2 top-1/2 h-[46rem] w-[46rem] -translate-x-1/2 -translate-y-1/2 text-gold/25" spin />
        <Link href="/" className="relative">
          <Logo light />
        </Link>
        <div className="relative">
          <p className="eyebrow mb-4 !text-gold">Beauty · Wellness · Luxury</p>
          <p className="max-w-md font-serif text-5xl leading-tight">
            Dove ogni dettaglio è un <em className="gold-text">gesto di cura</em>.
          </p>
        </div>
        <p className="relative text-xs tracking-wide text-ivory/40">Prenotazioni · Promozioni · Eventi · Luxury Rewards</p>
      </aside>
      <main className="flex flex-col justify-center px-6 pb-10 pt-[calc(env(safe-area-inset-top)+2.5rem)] sm:px-12">
        <div className="mx-auto w-full max-w-md animate-rise">
          <Link href="/" className="mb-10 inline-block lg:hidden">
            <Logo />
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
