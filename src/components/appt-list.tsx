import { ChevronRight } from "lucide-react";
import type { ApptVM } from "@/lib/calendar";
import { eur } from "@/lib/format";
import { ApptTrigger, type FormData_ } from "./calendar-client";
import { StatusBadge } from "./ui";

/** Elenco di appuntamenti cliccabili (apre il dettaglio con le azioni consentite al ruolo). */
export function ApptList({ appts, mode, data, showDate, showEmployee }: { appts: ApptVM[]; mode: "admin" | "staff"; data?: FormData_; showDate?: boolean; showEmployee?: boolean }) {
  return (
    <ul className="card divide-y divide-cream overflow-hidden">
      {appts.map((a) => (
        <li key={a.id}>
          <ApptTrigger appt={a} mode={mode} data={data} className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition hover:bg-cream/50 sm:px-5">
            <span className="w-1 self-stretch rounded-full" style={{ background: a.color }} />
            <span className="w-24 shrink-0">
              <span className="block font-serif text-xl leading-none">{a.time.slice(0, 5)}</span>
              {showDate && <span className="mt-1 block text-[0.68rem] capitalize text-smoke">{a.dayLabel.split(" ").slice(0, 3).join(" ")}</span>}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{a.clientName}</span>
              <span className="block truncate text-sm text-smoke">
                {a.treatmentName}
                {showEmployee && ` · ${a.employeeName}`}
              </span>
            </span>
            <span className="hidden text-sm text-anthracite sm:block">{eur(a.priceCents)}</span>
            <StatusBadge status={a.status} />
            <ChevronRight className="h-4 w-4 shrink-0 text-smoke" />
          </ApptTrigger>
        </li>
      ))}
    </ul>
  );
}
