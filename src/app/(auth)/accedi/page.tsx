import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { getSession, homeFor } from "@/lib/session";
import { LoginForm } from "./form";

export const metadata = { title: "Accedi" };

export default async function LoginPage() {
  const s = await getSession();
  if (s) redirect(homeFor(s.user.role));
  // Gli account dimostrativi vengono suggeriti solo se il centro demo è presente.
  const [demo] = await db.select({ id: t.users.id }).from(t.users).where(eq(t.users.email, "admin@aurea.demo"));
  return (
    <>
      <p className="eyebrow mb-2">Bentornata</p>
      <h1 className="mb-8 text-4xl">Accedi al tuo profilo</h1>
      <LoginForm demo={!!demo} />
      <p className="mt-8 text-center text-sm text-smoke">
        Non hai ancora un profilo?{" "}
        <Link href="/registrati" className="text-ink underline decoration-gold underline-offset-4">
          Registrati
        </Link>
      </p>
    </>
  );
}
