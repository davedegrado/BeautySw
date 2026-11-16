// Nella demo non c'è un server che invia notifiche push: restano le notifiche in-app (campanella).
export function PushToggle({ compact = false }: { compact?: boolean }) {
  if (compact) return null;
  return <p className="text-xs text-smoke">Nella versione demo le notifiche push non sono attive: trovi tutte le notifiche nella campanella.</p>;
}
