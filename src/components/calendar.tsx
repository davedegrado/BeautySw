import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { layoutLanes, type ApptVM } from "@/lib/calendar";
import { addDays, fmtDay, minutesToTime, startOfWeek } from "@/lib/dates";
import { ApptTrigger, SelectNav, type FormData_ } from "./calendar-client";

export type CalView = "giorno" | "settimana" | "mese";
type Emp = { id: string; name: string; color: string };

const PX = 1.15; // pixel per minuto

export function calendarRange(view: CalView, date: string): { from: string; days: number } {
  if (view === "giorno") return { from: date, days: 1 };
  if (view === "settimana") return { from: startOfWeek(date), days: 7 };
  return { from: startOfWeek(`${date.slice(0, 8)}01`), days: 42 };
}

function Block({ a, mode, data, showEmployee, style }: { a: ApptVM; mode: "admin" | "staff"; data?: FormData_; showEmployee?: boolean; style: React.CSSProperties }) {
  const done = a.status === "completed";
  const short = a.endMin - a.startMin < 40;
  return (
    <ApptTrigger
      appt={a}
      mode={mode}
      data={data}
      style={{ ...style, borderLeftColor: a.color }}
      className={`absolute flex flex-col justify-start overflow-hidden rounded-md border border-l-[3px] px-2 py-1 text-left text-[0.72rem] leading-tight shadow-sm transition hover:z-10 hover:shadow-lg ${
        done ? "border-line bg-cream/80 text-smoke" : a.status === "no_show" ? "border-danger/30 bg-danger/5 text-danger" : "border-gold/40 bg-white text-ink"
      }`}
    >
      <span className="block truncate font-medium">
        {minutesToTime(a.startMin)} {a.clientName}
        {done && " ✓"}
      </span>
      {!short && <span className="block truncate text-smoke">{a.treatmentName}</span>}
      {!short && showEmployee && <span className="block truncate text-[0.62rem] uppercase tracking-wider text-gold-deep">{a.employeeName}</span>}
    </ApptTrigger>
  );
}

function TimeGrid({ columns, startMin, endMin, mode, data, showEmployee }: { columns: { key: string; title: React.ReactNode; highlight?: boolean; appts: ApptVM[] }[]; startMin: number; endMin: number; mode: "admin" | "staff"; data?: FormData_; showEmployee?: boolean }) {
  const hours = Array.from({ length: Math.ceil((endMin - startMin) / 60) }, (_, i) => startMin + i * 60);
  const height = (endMin - startMin) * PX;
  return (
    <div className="card scroll-x">
      <div className="grid" style={{ gridTemplateColumns: `3.2rem repeat(${columns.length}, minmax(${columns.length > 4 ? "6.6rem" : "10rem"}, 1fr))`, minWidth: "fit-content" }}>
        <div className="sticky left-0 z-10 border-b border-line bg-white" />
        {columns.map((c) => (
          <div key={c.key} className={`border-b border-l border-line px-2 py-3 text-center ${c.highlight ? "bg-gold/10" : ""}`}>
            {c.title}
          </div>
        ))}
        <div className="sticky left-0 z-10 bg-white" style={{ height }}>
          {hours.map((h) => (
            <div key={h} className="pr-2 text-right text-[0.65rem] text-smoke" style={{ height: 60 * PX }}>
              <span className="relative -top-1.5">{minutesToTime(h)}</span>
            </div>
          ))}
        </div>
        {columns.map((c) => (
          <div key={c.key} className={`relative border-l border-line ${c.highlight ? "bg-gold/[0.04]" : ""}`} style={{ height }}>
            {hours.map((h) => (
              <div key={h} className="border-b border-cream" style={{ height: 60 * PX }}>
                <div className="h-1/2 border-b border-dashed border-cream/70" />
              </div>
            ))}
            {layoutLanes(c.appts).map((a) => (
              <Block
                key={a.id}
                a={a}
                mode={mode}
                data={data}
                showEmployee={showEmployee}
                style={{
                  top: (a.startMin - startMin) * PX + 1,
                  height: Math.max(22, (a.endMin - a.startMin) * PX - 2),
                  left: `calc(${(a.lane / a.lanes) * 100}% + 2px)`,
                  width: `calc(${100 / a.lanes}% - 4px)`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Calendar({
  view, date, today, appts, employees, employeeFilter, basePath, mode, data, actions,
}: {
  view: CalView;
  date: string;
  today: string;
  appts: ApptVM[];
  employees: Emp[];
  /** Operatore selezionato nel filtro ("" = tutti). Solo amministratore. */
  employeeFilter?: string;
  basePath: string;
  mode: "admin" | "staff";
  data?: FormData_;
  actions?: React.ReactNode;
}) {
  const visible = appts.filter((a) => a.status !== "cancelled");
  const qs = (o: { vista?: string; data?: string }) => {
    const p = new URLSearchParams({ vista: o.vista ?? view, data: o.data ?? date });
    if (employeeFilter) p.set("dip", employeeFilter);
    return `${basePath}?${p}`;
  };
  const step = view === "giorno" ? 1 : view === "settimana" ? 7 : 0;
  const shiftMonth = (n: number) => {
    const d = new Date(`${date.slice(0, 8)}01T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + n);
    return d.toISOString().slice(0, 10);
  };
  const prev = step ? addDays(date, -step) : shiftMonth(-1);
  const next = step ? addDays(date, step) : shiftMonth(1);
  const { from } = calendarRange(view, date);
  const title =
    view === "giorno" ? fmtDay(date, "EEEE d MMMM yyyy") : view === "settimana" ? `${fmtDay(from, "d MMM")} – ${fmtDay(addDays(from, 6), "d MMM yyyy")}` : fmtDay(date, "MMMM yyyy");

  const startMin = Math.min(8 * 60, ...visible.map((a) => Math.floor(a.startMin / 60) * 60));
  const endMin = Math.max(20 * 60, ...visible.map((a) => Math.ceil(a.endMin / 60) * 60));
  const shownEmployees = employeeFilter ? employees.filter((e) => e.id === employeeFilter) : employees;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Link href={qs({ data: prev })} className="icon-btn border border-line bg-white" aria-label="Precedente">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <Link href={qs({ data: next })} className="icon-btn border border-line bg-white" aria-label="Successivo">
            <ChevronRight className="h-4 w-4" />
          </Link>
          <Link href={qs({ data: today })} className="tab ml-1">
            Oggi
          </Link>
          <h2 className="ml-3 text-2xl capitalize">{title}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mode === "admin" && employees.length > 1 && (
            <SelectNav value={employeeFilter ?? ""} param="dip" base={qs({})} options={[["", "Tutti gli operatori"], ...employees.map((e) => [e.id, e.name] as [string, string])]} />
          )}
          <div className="flex gap-1">
            {(["giorno", "settimana", "mese"] as const).map((v) => (
              <Link key={v} href={qs({ vista: v })} className={`tab ${view === v ? "tab-active" : ""}`}>
                {v}
              </Link>
            ))}
          </div>
          {actions}
        </div>
      </div>

      {view === "giorno" && (
        <TimeGrid
          mode={mode}
          data={data}
          startMin={startMin}
          endMin={endMin}
          columns={shownEmployees.map((e) => ({
            key: e.id,
            title: (
              <span className="inline-flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: e.color }} />
                {e.name}
              </span>
            ),
            appts: visible.filter((a) => a.employeeId === e.id && a.date === date),
          }))}
        />
      )}

      {view === "settimana" && (
        <TimeGrid
          mode={mode}
          data={data}
          startMin={startMin}
          endMin={endMin}
          showEmployee={mode === "admin" && !employeeFilter}
          columns={Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((d) => ({
            key: d,
            highlight: d === today,
            title: (
              <Link href={qs({ vista: "giorno", data: d })} className="block hover:text-gold-deep">
                <span className="block text-[0.6rem] uppercase tracking-[0.18em] text-smoke">{fmtDay(d, "EEE")}</span>
                <span className="font-serif text-2xl leading-none">{fmtDay(d, "d")}</span>
              </Link>
            ),
            appts: visible.filter((a) => a.date === d && (!employeeFilter || a.employeeId === employeeFilter)),
          }))}
        />
      )}

      {view === "mese" && (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-line text-center text-[0.6rem] uppercase tracking-[0.18em] text-smoke">
            {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((d) => (
              <div key={d} className="py-2.5">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: 42 }, (_, i) => addDays(from, i)).map((d) => {
              const list = visible.filter((a) => a.date === d && (!employeeFilter || a.employeeId === employeeFilter)).sort((a, b) => a.startMin - b.startMin);
              const inMonth = d.slice(0, 7) === date.slice(0, 7);
              return (
                <Link key={d} href={qs({ vista: "giorno", data: d })} className={`min-h-[4.5rem] border-b border-r border-cream p-1.5 transition hover:bg-gold/10 sm:min-h-28 sm:p-2 ${inMonth ? "" : "bg-cream/40 text-smoke/60"}`}>
                  <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full font-serif text-lg ${d === today ? "bg-ink text-gold-light" : ""}`}>{Number(d.slice(8))}</span>
                  <span className="mt-1 hidden space-y-0.5 sm:block">
                    {list.slice(0, 3).map((a) => (
                      <span key={a.id} className="block truncate rounded border-l-2 bg-ivory px-1.5 py-0.5 text-[0.66rem]" style={{ borderLeftColor: a.color }}>
                        {minutesToTime(a.startMin)} {a.clientName}
                      </span>
                    ))}
                    {list.length > 3 && <span className="block px-1.5 text-[0.62rem] text-gold-deep">+{list.length - 3} altri</span>}
                  </span>
                  {list.length > 0 && <span className="mt-1 block text-center text-[0.62rem] text-gold-deep sm:hidden">● {list.length}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
