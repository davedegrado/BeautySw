import { changePasswordAction, updateProfileAction } from "@/actions/account";
import { logoutAction } from "@/actions/auth";
import type { Session } from "@/lib/session";
import { ActionForm } from "./client-ui";
import { PushToggle } from "./push";
import { Avatar, Field } from "./ui";

/** Dati personali, password e notifiche: condiviso dai tre ruoli. */
export function ProfileSections({ session }: { session: Session }) {
  const u = session.user;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card p-6">
        <div className="mb-5 flex items-center gap-4">
          <Avatar user={u} size="lg" />
          <div>
            <h2 className="text-2xl">Dati personali</h2>
            <p className="text-sm text-smoke">{session.center.name}</p>
          </div>
        </div>
        <ActionForm action={updateProfileAction} submitLabel="Salva modifiche">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome">
              <input name="firstName" defaultValue={u.firstName} required className="input" />
            </Field>
            <Field label="Cognome">
              <input name="lastName" defaultValue={u.lastName} className="input" />
            </Field>
          </div>
          <Field label="Email">
            <input name="email" type="email" defaultValue={u.email ?? ""} required className="input" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefono">
              <input name="phone" type="tel" defaultValue={u.phone} className="input" />
            </Field>
            <Field label="Data di nascita" hint={u.role === "client" ? "Per ricevere il nostro regalo di compleanno." : undefined}>
              <input name="birthDate" type="date" defaultValue={u.birthDate ?? ""} className="input" />
            </Field>
          </div>
          {u.role === "employee" && (
            <Field label="Presentazione">
              <textarea name="notes" defaultValue={u.notes} className="input" />
            </Field>
          )}
        </ActionForm>
      </section>
      <div className="space-y-6">
        <section className="card p-6">
          <h2 className="mb-1 text-2xl">Notifiche push</h2>
          <p className="mb-4 text-sm text-smoke">Conferme, promemoria e novità su questo dispositivo.</p>
          <PushToggle />
        </section>
        <section className="card p-6">
          <h2 className="mb-4 text-2xl">Sicurezza</h2>
          <ActionForm action={changePasswordAction} submitLabel="Aggiorna password" submitClass="btn btn-dark" resetOnSuccess>
            <Field label="Password attuale">
              <input name="current" type="password" required autoComplete="current-password" className="input" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nuova password">
                <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
              </Field>
              <Field label="Conferma">
                <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className="input" />
              </Field>
            </div>
          </ActionForm>
        </section>
        <form action={logoutAction}>
          <button className="btn btn-outline w-full">Esci dall&apos;account</button>
        </form>
      </div>
    </div>
  );
}
