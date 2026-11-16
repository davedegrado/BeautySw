export function eur(cents: number | null | undefined): string {
  const v = (cents ?? 0) / 100;
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
  }).format(v);
}
export function fullName(u: { firstName: string; lastName?: string | null }): string {
  return `${u.firstName} ${u.lastName ?? ""}`.trim();
}
export function initials(u: { firstName: string; lastName?: string | null }): string {
  return `${u.firstName[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase();
}
export function duration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
export function imageUrl(id: string | null | undefined): string | null {
  return id ? `/api/images/${id}` : null;
}
export function discountPct(original: number | null, promo: number | null): number | null {
  if (!original || promo == null || promo >= original) return null;
  return Math.round((1 - promo / original) * 100);
}
export const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confermato",
  completed: "Completato",
  cancelled: "Annullato",
  no_show: "Non presentato",
};
