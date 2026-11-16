// Deve essere importato per primo: alcune librerie leggono `process` e `Buffer` al caricamento.
import { Buffer } from "buffer";

const g = globalThis as unknown as { process?: { env: Record<string, string | undefined> }; Buffer?: typeof Buffer };
g.process ??= { env: {} };
g.process.env ??= {};
g.process.env.NODE_ENV ??= import.meta.env.MODE;
g.Buffer ??= Buffer;

// Nella demo c'è un service worker dedicato (demo/sw.js): cache dei file e installazione come app.
// Anche le registrazioni fatte dall'app ("/sw.js") puntano a quello.
if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  const sw = navigator.serviceWorker;
  const register = sw.register.bind(sw);
  const demoSw = import.meta.env.BASE_URL + "demo-sw.js";
  sw.register = (url: string | URL, opts?: RegistrationOptions) =>
    register(typeof url === "string" && url.endsWith("/sw.js") ? demoSw : url, opts);
  if (import.meta.env.PROD) addEventListener("load", () => register(demoSw).catch(() => {}));
}
