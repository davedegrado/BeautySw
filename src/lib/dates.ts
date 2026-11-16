import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { it } from "date-fns/locale";

export const DEFAULT_TZ = "Europe/Rome";
const pad = (n: number) => String(n).padStart(2, "0");

/** Data+minuti locali del centro → istante UTC. */
export function zoned(dateStr: string, minutes: number, tz: string): Date {
  return fromZonedTime(`${dateStr}T${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:00`, tz);
}
/** "YYYY-MM-DDTHH:mm" locale del centro → istante UTC. */
export function zonedFromInput(value: string, tz: string): Date {
  return fromZonedTime(value.length === 16 ? `${value}:00` : value, tz);
}
export function localDate(d: Date, tz: string): string {
  return formatInTimeZone(d, tz, "yyyy-MM-dd");
}
export function localMinutes(d: Date, tz: string): number {
  const [h, m] = formatInTimeZone(d, tz, "HH:mm").split(":").map(Number);
  return h * 60 + m;
}
export function fmt(d: Date, tz: string, pattern: string): string {
  return formatInTimeZone(d, tz, pattern, { locale: it });
}
export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}
/** Lunedì della settimana che contiene la data. */
export function startOfWeek(dateStr: string): string {
  return addDays(dateStr, -((weekdayOf(dateStr) + 6) % 7));
}
export function minutesToTime(m: number): string {
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}
export function timeToMinutes(v: string): number {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + (m || 0);
}
/** Formatta una data pura (YYYY-MM-DD) senza conversioni di fuso. */
export function fmtDay(dateStr: string, pattern = "d MMMM yyyy"): string {
  return formatInTimeZone(new Date(`${dateStr}T12:00:00Z`), "UTC", pattern, { locale: it });
}
export const WEEKDAYS = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
