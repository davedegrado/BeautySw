import Link from "next/link";
import { Mandala } from "@/components/mandala";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-ink px-6 text-center text-ivory">
      <Mandala className="mb-6 h-28 w-28 text-gold" spin />
      <p className="eyebrow mb-2 !text-gold">Errore 404</p>
      <h1 className="text-4xl">Pagina non trovata</h1>
      <p className="mt-3 max-w-md text-sm text-ivory/60">La pagina che cerchi non esiste o è stata spostata.</p>
      <Link className="btn btn-gold mt-7" href="/">
        Torna alla home
      </Link>
    </div>
  );
}
