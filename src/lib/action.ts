import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { AppError, type ActionResult } from "./errors";

/** Esegue una server action con gestione uniforme degli errori e aggiornamento delle pagine. */
export async function run<T = unknown>(fn: () => Promise<{ message?: string; data?: T } | string | void>): Promise<ActionResult<T>> {
  try {
    const out = await fn();
    revalidatePath("/", "layout");
    if (typeof out === "string") return { ok: true, message: out };
    return { ok: true, message: out?.message, data: out?.data };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof AppError) return { ok: false, error: e.message };
    const code = (e as { code?: string; cause?: { code?: string } })?.cause?.code ?? (e as { code?: string })?.code;
    if (code === "23505") return { ok: false, error: "Esiste già un elemento con questi dati (es. email già registrata)." };
    if (code === "23503") return { ok: false, error: "Impossibile completare: l'elemento è collegato ad altri dati." };
    console.error("[action] errore inatteso", e);
    return { ok: false, error: "Si è verificato un errore inatteso. Riprova tra qualche istante." };
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lettura e validazione dei campi di un form. */
export function form(fd: FormData) {
  const raw = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" ? v.trim() : "";
  };
  return {
    str: (k: string, max = 4000) => raw(k).slice(0, max),
    req(k: string, label: string, max = 300) {
      const v = raw(k);
      if (!v) throw new AppError(`Il campo "${label}" è obbligatorio.`);
      return v.slice(0, max);
    },
    email(k: string, required = true) {
      const v = raw(k).toLowerCase();
      if (!v && !required) return null;
      if (!EMAIL.test(v)) throw new AppError("Inserisci un indirizzo email valido.");
      return v;
    },
    password(k: string) {
      const v = fd.get(k);
      if (typeof v !== "string" || v.length < 8) throw new AppError("La password deve contenere almeno 8 caratteri.");
      if (v.length > 200) throw new AppError("Password troppo lunga.");
      return v;
    },
    int(k: string, label: string, o: { min?: number; max?: number; optional?: boolean } = {}) {
      const v = raw(k);
      if (!v && o.optional) return null;
      const n = Number(v);
      if (!v || !Number.isInteger(n)) throw new AppError(`"${label}" deve essere un numero intero.`);
      if (o.min != null && n < o.min) throw new AppError(`"${label}" deve essere almeno ${o.min}.`);
      if (o.max != null && n > o.max) throw new AppError(`"${label}" non può superare ${o.max}.`);
      return n;
    },
    cents(k: string, label: string, optional = false) {
      const v = raw(k).replace(/\s|€/g, "").replace(",", ".");
      if (!v && optional) return null;
      const n = Number(v);
      if (!v || Number.isNaN(n) || n < 0 || n > 1_000_000) throw new AppError(`"${label}" non è un importo valido.`);
      return Math.round(n * 100);
    },
    bool: (k: string) => ["on", "true", "1"].includes(raw(k)),
    id(k: string, label = "Elemento") {
      const v = raw(k);
      if (!UUID.test(v)) throw new AppError(`${label} non valido.`);
      return v;
    },
    optId(k: string) {
      const v = raw(k);
      return UUID.test(v) ? v : null;
    },
    ids: (k: string) => fd.getAll(k).filter((v): v is string => typeof v === "string" && UUID.test(v)),
    date(k: string, label: string, optional = false) {
      const v = raw(k);
      if (!v && optional) return null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw new AppError(`"${label}" non è una data valida.`);
      return v;
    },
    datetime(k: string, label: string, optional = false) {
      const v = raw(k);
      if (!v && optional) return null;
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) throw new AppError(`"${label}" non è una data/ora valida.`);
      return v.slice(0, 16);
    },
    oneOf<const T extends string>(k: string, values: readonly T[], label: string): T {
      const v = raw(k) as T;
      if (!values.includes(v)) throw new AppError(`"${label}" non valido.`);
      return v;
    },
  };
}
