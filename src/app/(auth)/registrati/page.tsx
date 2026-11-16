import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { registerAction } from "@/actions/auth";
import { ActionForm } from "@/components/client-ui";
import { Field } from "@/components/ui";
import { getSession, homeFor } from "@/lib/session";

export const metadata = { title: "Registrati" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ centro?: string }> }) {
  const s = await getSession();
  if (s) redirect(homeFor(s.user.role));
  const { centro } = await searchParams;
  const [center] = centro
    ? await db.select().from(t.centers).where(eq(t.centers.slug, centro))
    : await db.select().from(t.centers).orderBy(asc(t.centers.createdAt)).limit(1);
  if (!center) redirect("/setup");
  return (
    <>
      <p className="eyebrow mb-2">{center.name}</p>
      <h1 className="mb-8 text-4xl">Crea il tuo profilo</h1>
      <ActionForm action={registerAction} submitLabel="Registrati" submitClass="btn btn-gold w-full">
        <input type="hidden" name="center" value={center.slug} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome">
            <input name="firstName" required autoComplete="given-name" className="input" />
          </Field>
          <Field label="Cognome">
            <input name="lastName" required autoComplete="family-name" className="input" />
          </Field>
        </div>
        <Field label="Email">
          <input name="email" type="email" required autoComplete="email" className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefono">
            <input name="phone" type="tel" autoComplete="tel" className="input" />
          </Field>
          <Field label="Data di nascita">
            <input name="birthDate" type="date" className="input" />
          </Field>
        </div>
        <Field label="Password" hint="Almeno 8 caratteri.">
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
        </Field>
        <label className="flex items-start gap-2.5 text-xs leading-relaxed text-smoke">
          <input type="checkbox" name="privacy" required className="check mt-0.5" />
          <span>Acconsento al trattamento dei miei dati personali per la gestione delle prenotazioni e del programma fedeltà, secondo l&apos;informativa privacy del centro.</span>
        </label>
      </ActionForm>
      <p className="mt-8 text-center text-sm text-smoke">
        Hai già un profilo?{" "}
        <Link href="/accedi" className="text-ink underline decoration-gold underline-offset-4">
          Accedi
        </Link>
      </p>
    </>
  );
}
