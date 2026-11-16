/** Stato della navigazione della demo (sostituisce il router di Next.js). */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Listener = (kind: "navigate" | "refresh") => void;
const listeners = new Set<Listener>();

export function withBase(path: string) {
  if (!path.startsWith("/")) return path;
  return BASE + path;
}

/** Percorso dell'app (senza il prefisso di GitHub Pages). */
export function appPath(pathname = location.pathname) {
  if (BASE && (pathname === BASE || pathname.startsWith(BASE + "/"))) pathname = pathname.slice(BASE.length) || "/";
  return pathname;
}

export function currentUrl() {
  return { pathname: appPath(), search: location.search };
}

export function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function emit(kind: "navigate" | "refresh") {
  for (const l of listeners) l(kind);
}

export function navigate(href: string, opts: { replace?: boolean } = {}) {
  const url = new URL(href, location.origin + withBase(appPath()));
  const target = withBase(appPath(url.pathname)) + url.search + url.hash;
  if (opts.replace) history.replaceState(null, "", target);
  else history.pushState(null, "", target);
  emit("navigate");
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
/** Ricarica i dati della pagina corrente (equivalente di revalidatePath / router.refresh). */
export function refresh() {
  if (refreshTimer) return;
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    emit("refresh");
  }, 0);
}

addEventListener("popstate", () => emit("navigate"));
