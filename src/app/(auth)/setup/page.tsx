import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { db, t } from "@/db";
import { setupAction } from "@/actions/auth";
import { ActionForm } from "@/components/client-ui";
import { Field } from "@/components/ui";

export const metadata = { title: "Configurazione iniziale" };

export default async function SetupPage() {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(t.centers);
  const extra = n > 0;
  if (extra && !process.env.SETUP_KEY) redirect("/accedi");
  return (
    <>
      <p className="eyebrow mb-2">{extra ? "Nuovo centro" : "Benvenuta"}</p>
      <h1 className="mb-2 text-4xl">Configura il tuo centro</h1>
      <p className="mb-8 text-sm text-smoke">Crea il centro estetico e l&apos;account amministratore. Potrai personalizzare tutto in seguito dalle impostazioni.</p>
      <ActionForm action={setupAction} submitLabel="Crea il centro" submitClass="btn btn-gold w-full">
        <Field label="Nome del centro">
          <input name="centerName" required className="input" placeholder="Es. Maison de Beauté" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefono">
            <input name="phone" className="input" />
          </Field>
          <Field label="Indirizzo">
            <input name="address" className="input" />
          </Field>
        </div>
        <div className="gold-line my-2" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Il tuo nome">
            <input name="firstName" required className="input" />
          </Field>
          <Field label="Cognome">
            <input name="lastName" className="input" />
          </Field>
        </div>
        <Field label="Email amministratore">
          <input name="email" type="email" required className="input" />
        </Field>
        <Field label="Password" hint="Almeno 8 caratteri.">
          <input name="password" type="password" required minLength={8} className="input" />
        </Field>
        {extra && (
          <Field label="Chiave di configurazione (SETUP_KEY)">
            <input name="setupKey" type="password" required className="input" />
          </Field>
        )}
      </ActionForm>
    </>
  );
}
