"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { sendBroadcastAction } from "@/actions/admin";
import { ActionForm } from "@/components/client-ui";
import { Field } from "@/components/ui";

const AUDIENCES = [
  ["all", "Tutti i clienti"],
  ["birthday_month", "Chi compie gli anni questo mese"],
  ["min_points", "Clienti più fedeli (punti minimi)"],
  ["inactive", "Clienti che non vengono da tempo"],
  ["new", "Nuovi clienti (ultimi 30 giorni)"],
  ["manual", "Selezione manuale"],
] as const;

export function BroadcastForm({ clients }: { clients: { id: string; name: string }[] }) {
  const [audience, setAudience] = useState<string>("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  return (
    <ActionForm
      action={sendBroadcastAction}
      submitLabel={<><Send className="h-3.5 w-3.5" /> Invia comunicazione</>}
      onSuccess={() => {
        setTitle("");
        setBody("");
      }}
    >
      <Field label="Titolo">
        <input name="title" required maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="Es. Chiusura straordinaria" />
      </Field>
      <Field label="Messaggio" hint={`${body.length}/400 caratteri`}>
        <textarea name="body" required maxLength={400} value={body} onChange={(e) => setBody(e.target.value)} className="input" />
      </Field>
      <Field label="Destinatari">
        <select name="audience" value={audience} onChange={(e) => setAudience(e.target.value)} className="input">
          {AUDIENCES.map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      {audience === "min_points" && (
        <Field label="Punti minimi">
          <input name="minPoints" type="number" min={1} required defaultValue={250} className="input" />
        </Field>
      )}
      {audience === "inactive" && (
        <Field label="Nessun appuntamento da almeno (giorni)">
          <input name="inactiveDays" type="number" min={1} required defaultValue={60} className="input" />
        </Field>
      )}
      {audience === "manual" && (
        <div className="grid max-h-48 gap-2 overflow-y-auto rounded-lg border border-line bg-white p-4 sm:grid-cols-2">
          {clients.map((c) => (
            <label key={c.id} className="flex items-center gap-2.5 text-sm">
              <input type="checkbox" name="userIds" value={c.id} className="check" />
              {c.name}
            </label>
          ))}
        </div>
      )}
      <Field label="Pagina da aprire al tocco">
        <select name="url" className="input" defaultValue="/app">
          <option value="/app">Home</option>
          <option value="/app/promozioni">Promozioni</option>
          <option value="/app/eventi">Eventi</option>
          <option value="/app/prenota">Prenota</option>
          <option value="/app/punti">Luxury Rewards</option>
        </select>
      </Field>
      {(title || body) && (
        <div className="rounded-xl bg-ink p-4 text-ivory">
          <p className="mb-1 text-[0.6rem] uppercase tracking-[0.2em] text-gold">Anteprima</p>
          <p className="text-sm font-medium">{title || "Titolo"}</p>
          <p className="text-sm text-ivory/70">{body}</p>
        </div>
      )}
    </ActionForm>
  );
}
