import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { init, parse } from "es-module-lexer";
import { defineConfig, type Plugin } from "vite";

/**
 * Demo statica (GitHub Pages): esegue nel browser lo stesso codice dell'app Next.js.
 * Il database è PostgreSQL compilato in WebAssembly (PGlite) e salvato in IndexedDB;
 * le parti specifiche di Next.js (navigazione, cookie, cache) sono sostituite da piccoli adattatori.
 */
const src = fileURLToPath(new URL("../src/", import.meta.url));
const shim = (f: string) => fileURLToPath(new URL(`./src/shims/${f}`, import.meta.url));

/** Marca i componenti "server" (file senza "use client") così il router li esegue prima del rendering. */
function markServerComponents(): Plugin {
  return {
    name: "aurea-mark-server-components",
    enforce: "post",
    async transform(code, id) {
      const file = id.split("?")[0];
      if (!file.startsWith(src) || !/\/(app|components)\/.*\.tsx$/.test(file)) return;
      if (/^\s*["']use client["']/.test(readFileSync(file, "utf8"))) return;
      await init;
      const [, exports] = parse(code);
      const names = exports.map((e) => e.localName).filter((n): n is string => !!n && /^[A-Za-z_$][\w$]*$/.test(n));
      if (!names.length) return;
      return { code: `${code}\n;for (const f of [${names.join(",")}]) if (typeof f === "function") f.__rsc = true;`, map: null };
    },
  };
}

/** GitHub Pages: 404.html = index.html, così i link diretti alle pagine interne funzionano. */
/** Manifest PWA generato da src/app/manifest.ts, con percorsi relativi (funziona sotto /<repository>/). */
function webManifest(): Plugin {
  return {
    name: "aurea-web-manifest",
    async generateBundle() {
      const { default: manifest } = await import("../src/app/manifest");
      const m = manifest();
      const rel = (u: string) => (u.startsWith("/") ? "." + u : u);
      const out = {
        ...m,
        id: "./",
        start_url: "./",
        scope: "./",
        icons: m.icons?.map((i) => ({ ...i, src: rel(i.src) })),
      };
      this.emitFile({ type: "asset", fileName: "manifest.webmanifest", source: JSON.stringify(out, null, 2) });
    },
  };
}

function spaFallback(): Plugin {
  return {
    name: "aurea-spa-fallback",
    apply: "build",
    writeBundle(opts) {
      const out = opts.dir!;
      copyFileSync(`${out}/index.html`, `${out}/404.html`);
      copyFileSync(fileURLToPath(new URL("./sw.js", import.meta.url)), `${out}/demo-sw.js`);
      writeFileSync(`${out}/.nojekyll`, "");
    },
  };
}

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: process.env.DEMO_BASE || "/",
  publicDir: fileURLToPath(new URL("../public", import.meta.url)),
  plugins: [react(), tailwindcss(), markServerComponents(), webManifest(), spaFallback()],
  resolve: {
    alias: [
      { find: /^@\/db$/, replacement: fileURLToPath(new URL("./src/db.ts", import.meta.url)) },
      { find: /^@\/lib\/format$/, replacement: shim("format.ts") },
      { find: /^(@\/components|\.)\/push$/, replacement: shim("push.tsx") },
      { find: /^@\//, replacement: src },
      { find: /^next\/link$/, replacement: shim("next-link.tsx") },
      { find: /^next\/navigation$/, replacement: shim("next-navigation.ts") },
      { find: /^next\/headers$/, replacement: shim("next-headers.ts") },
      { find: /^next\/cache$/, replacement: shim("next-cache.ts") },
      { find: /^node:crypto$/, replacement: shim("node-crypto.ts") },
      { find: /^web-push$/, replacement: shim("web-push.ts") },
      { find: /^server-only$/, replacement: shim("empty.ts") },
    ],
  },
  optimizeDeps: { exclude: ["@electric-sql/pglite"] },
  worker: { format: "es" },
  build: { outDir: "dist", emptyOutDir: true, chunkSizeWarningLimit: 4000, target: "es2022" },
});
