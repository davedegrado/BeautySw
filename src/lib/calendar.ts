import type { Center } from "@/db/schema";
import { fmt, localDate, localMinutes } from "./dates";
import { fullName } from "./format";
import type { ApptRow } from "./queries";

/** Appuntamento pronto per la visualizzazione (orari già convertiti nel fuso del centro). */
export type ApptVM = {
  id: string;
  status: string;
  paid: boolean;
  startISO: string;
  date: string;
  startMin: number;
  endMin: number;
  time: string;
  dayLabel: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  clientNotes: string;
  employeeId: string;
  employeeName: string;
  color: string;
  treatmentId: string;
  treatmentName: string;
  priceCents: number;
  notes: string;
  pointsAwarded: number | null;
  past: boolean;
};

export function toVM(a: ApptRow, center: Pick<Center, "timezone">, opts: { hideContacts?: boolean } = {}): ApptVM {
  const tz = center.timezone;
  const startMin = localMinutes(a.startAt, tz);
  return {
    id: a.id,
    status: a.status,
    paid: a.paid,
    startISO: a.startAt.toISOString(),
    date: localDate(a.startAt, tz),
    startMin,
    endMin: startMin + Math.round((a.endAt.getTime() - a.startAt.getTime()) / 60000),
    time: `${fmt(a.startAt, tz, "HH:mm")} – ${fmt(a.endAt, tz, "HH:mm")}`,
    dayLabel: fmt(a.startAt, tz, "EEEE d MMMM yyyy"),
    clientId: a.clientId,
    clientName: fullName({ firstName: a.clientFirst, lastName: a.clientLast }),
    clientPhone: opts.hideContacts ? "" : a.clientPhone,
    clientEmail: opts.hideContacts ? "" : (a.clientEmail ?? ""),
    clientNotes: a.clientNotes,
    employeeId: a.employeeId,
    employeeName: a.employeeFirst,
    color: a.employeeColor,
    treatmentId: a.treatmentId,
    treatmentName: a.treatmentName,
    priceCents: a.priceCents,
    notes: a.notes,
    pointsAwarded: a.pointsAwarded,
    past: a.endAt.getTime() < Date.now(),
  };
}

/** Dispone in corsie affiancate gli appuntamenti che si sovrappongono (vista settimanale con più operatori). */
export function layoutLanes<T extends { startMin: number; endMin: number }>(items: T[]): (T & { lane: number; lanes: number })[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const out: (T & { lane: number; lanes: number })[] = [];
  let cluster: (T & { lane: number; lanes: number })[] = [];
  let clusterEnd = -1;
  let laneEnds: number[] = [];
  const flush = () => {
    for (const c of cluster) c.lanes = laneEnds.length;
    out.push(...cluster);
    cluster = [];
    laneEnds = [];
  };
  for (const it of sorted) {
    if (cluster.length && it.startMin >= clusterEnd) flush();
    let lane = laneEnds.findIndex((e) => e <= it.startMin);
    if (lane === -1) lane = laneEnds.push(it.endMin) - 1;
    else laneEnds[lane] = it.endMin;
    cluster.push({ ...it, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, it.endMin);
  }
  flush();
  return out;
}
