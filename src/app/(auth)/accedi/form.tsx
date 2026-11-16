"use client";

import { useRef } from "react";
import { loginAction } from "@/actions/auth";
import { ActionForm } from "@/components/client-ui";
import { Field } from "@/components/ui";

const DEMO = [
  ["Amministratore", "admin@aurea.demo"],
  ["Dipendente", "giulia@aurea.demo"],
  ["Cliente", "elena@aurea.demo"],
];

export function LoginForm({ demo }: { demo: boolean }) {
  const email = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);
  return (
    <>
      <ActionForm action={loginAction} submitLabel="Accedi" submitClass="btn btn-gold w-full">
        <Field label="Email">
          <input ref={email} name="email" type="email" autoComplete="email" required className="input" placeholder="nome@email.it" />
        </Field>
        <Field label="Password">
          <input ref={password} name="password" type="password" autoComplete="current-password" required className="input" />
        </Field>
      </ActionForm>
      <p className="mt-4 text-center text-xs text-smoke">Password dimenticata? Contatta il centro: la reimposteremo insieme a te.</p>
      {demo && (
        <div className="mt-8 rounded-xl border border-dashed border-gold/60 bg-cream/60 p-4">
          <p className="label">Account dimostrativi · password Aurea2026!</p>
          <div className="flex flex-wrap gap-2">
            {DEMO.map(([label, mail]) => (
              <button
                key={mail}
                type="button"
                className="tab"
                onClick={() => {
                  if (email.current) email.current.value = mail;
                  if (password.current) password.current.value = "Aurea2026!";
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
