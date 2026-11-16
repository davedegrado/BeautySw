"use client";

import { useEffect } from "react";
import { Mandala } from "@/components/mandala";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-ivory px-6 text-center">
      <Mandala className="mb-6 h-24 w-24 text-gold" />
      <p className="eyebrow mb-2">Qualcosa non ha funzionato</p>
      <h1 className="text-4xl">Si è verificato un imprevisto</h1>
      <p className="mt-3 max-w-md text-sm text-smoke">Nessun dato è andato perso. Riprova: se il problema persiste contatta l&apos;assistenza indicando il codice {error.digest ?? "—"}.</p>
      <div className="mt-7 flex gap-3">
        <button className="btn btn-gold" onClick={reset}>
          Riprova
        </button>
        <a className="btn btn-outline" href="/">
          Torna alla home
        </a>
      </div>
    </div>
  );
}
