// Deve essere importato per primo: alcune librerie leggono `process` e `Buffer` al caricamento.
import { Buffer } from "buffer";

const g = globalThis as unknown as { process?: { env: Record<string, string | undefined> }; Buffer?: typeof Buffer };
g.process ??= { env: {} };
g.process.env ??= {};
g.process.env.NODE_ENV ??= import.meta.env.MODE;
g.Buffer ??= Buffer;

// Il service worker dell'app è registrato come "/sw.js": su GitHub Pages va cercato sotto /<repository>/.
if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  const sw = navigator.serviceWorker;
  const register = sw.register.bind(sw);
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  sw.register = (url: string | URL, opts?: RegistrationOptions) =>
    register(typeof url === "string" && url.startsWith("/") ? base + url : url, opts);
}
