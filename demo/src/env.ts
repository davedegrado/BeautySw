// Deve essere importato per primo: alcune librerie leggono `process` e `Buffer` al caricamento.
import { Buffer } from "buffer";

const g = globalThis as unknown as { process?: { env: Record<string, string | undefined> }; Buffer?: typeof Buffer };
g.process ??= { env: {} };
g.process.env ??= {};
g.process.env.NODE_ENV ??= import.meta.env.MODE;
g.Buffer ??= Buffer;

// iPhone/iPad (soprattutto i modelli meno recenti): Safari può rifiutare con "Out of memory"
// la prenotazione dei 2 GB di memoria massima chiesti dal database WebAssembly, anche se ne
// userà una piccola parte. Sui dispositivi Apple il massimo viene ridotto in partenza e, ovunque,
// se la richiesta fallisce si riprova con valori via via più bassi.
{
  const Native = WebAssembly.Memory;
  const PAGES_PER_MB = 16;
  const ua = navigator.userAgent;
  const apple = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const Patched = function (this: unknown, d: WebAssembly.MemoryDescriptor) {
    if (d.shared || !d.maximum) return new Native(d);
    const caps = [d.maximum, 1024 * PAGES_PER_MB, 512 * PAGES_PER_MB, 384 * PAGES_PER_MB, 256 * PAGES_PER_MB]
      .filter((m) => m <= d.maximum! && m >= d.initial && (!apple || m <= 512 * PAGES_PER_MB));
    if (!caps.length) caps.push(Math.max(d.initial, Math.min(d.maximum, 512 * PAGES_PER_MB)));
    let last: unknown;
    for (const maximum of caps) {
      try {
        return new Native({ ...d, maximum });
      } catch (e) {
        last = e;
      }
    }
    throw last;
  } as unknown as typeof WebAssembly.Memory;
  Patched.prototype = Native.prototype;
  WebAssembly.Memory = Patched;
}

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
