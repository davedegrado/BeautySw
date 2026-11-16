import type { EventRow } from "@/db/schema";
import { fmt } from "@/lib/dates";
import { ImageField } from "./client-ui";
import { Check, Field } from "./ui";

export function EventFields({ event, tz }: { event?: EventRow; tz: string }) {
  const local = (d?: Date | null) => (d ? fmt(d, tz, "yyyy-MM-dd'T'HH:mm") : "");
  return (
    <>
      {event && <input type="hidden" name="id" value={event.id} />}
      <Field label="Titolo evento">
        <input name="title" required maxLength={140} defaultValue={event?.title} className="input" />
      </Field>
      <ImageField current={event?.imageId} label="Immagine di copertina" />
      <Field label="Descrizione">
        <textarea name="description" defaultValue={event?.description} className="input !min-h-28" maxLength={4000} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Inizio">
          <input name="startsAt" type="datetime-local" required defaultValue={local(event?.startsAt)} className="input" />
        </Field>
        <Field label="Fine (facoltativa)">
          <input name="endsAt" type="datetime-local" defaultValue={local(event?.endsAt)} className="input" />
        </Field>
      </div>
      <Field label="Luogo">
        <input name="location" defaultValue={event?.location} className="input" maxLength={200} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Posti disponibili" hint="Vuoto = illimitati.">
          <input name="maxParticipants" type="number" min={1} defaultValue={event?.maxParticipants ?? ""} className="input" />
        </Field>
        <Field label="Prezzo (€)" hint="Vuoto o 0 = gratuito.">
          <input name="price" inputMode="decimal" defaultValue={event?.priceCents ? (event.priceCents / 100).toString().replace(".", ",") : ""} className="input" />
        </Field>
      </div>
      <Check name="published" label="Evento pubblicato" hint="Visibile ai clienti, che possono iscriversi." defaultChecked={event?.published ?? true} />
      <Check name="notify" label="Invia una notifica push a tutti i clienti" defaultChecked={!event} />
    </>
  );
}
