import { cloneElement, createElement, Fragment, isValidElement, type ComponentType, type ReactElement, type ReactNode } from "react";
import { NotFoundError, RedirectError } from "./shims/next-navigation";

type Mod = { default: ComponentType<any>; metadata?: { title?: string | { default?: string } } };
type Loader = () => Promise<Mod>;

const pages = import.meta.glob<Mod>("../../src/app/**/page.tsx");
const layouts = import.meta.glob<Mod>("../../src/app/**/layout.tsx");

/** Cartella (relativa a src/app) → segmenti dell'URL. "(gruppo)" non compare nell'URL. */
function dirOf(file: string) {
  return file.replace(/^.*\/src\/app\/?/, "").replace(/\/?(page|layout)\.tsx$/, "");
}

type Route = { segments: string[]; page: Loader; layouts: Loader[] };

const routes: Route[] = Object.entries(pages).map(([file, page]) => {
  const dir = dirOf(file);
  const parts = dir ? dir.split("/") : [];
  const chain: Loader[] = [];
  // Il layout radice (html/body) è sostituito dall'App della demo.
  for (let i = 1; i <= parts.length; i++) {
    const key = Object.keys(layouts).find((f) => dirOf(f) === parts.slice(0, i).join("/"));
    if (key) chain.push(layouts[key]);
  }
  return { segments: parts.filter((p) => !/^\(.*\)$/.test(p)), page, layouts: chain };
});
// Le rotte statiche hanno la precedenza su quelle con parametri.
routes.sort((a, b) => a.segments.filter((s) => s.startsWith("[")).length - b.segments.filter((s) => s.startsWith("[")).length);

function match(pathname: string) {
  const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  for (const r of routes) {
    if (r.segments.length !== parts.length) continue;
    const params: Record<string, string> = {};
    if (r.segments.every((s, i) => (s.startsWith("[") ? ((params[s.slice(1, -1)] = parts[i]), true) : s === parts[i]))) return { route: r, params };
  }
  return null;
}

type Fn = ((props: unknown) => unknown) & { __rsc?: boolean };
const isServer = (f: unknown): f is Fn =>
  typeof f === "function" && ((f as Fn).__rsc === true || f.constructor.name === "AsyncFunction");

/**
 * Esegue nel browser i "server component" (anche asincroni) e restituisce un albero React
 * composto solo da elementi HTML e componenti client: lo stesso lavoro che Next.js fa sul server.
 */
async function resolve(node: unknown): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map(resolve));
  if (node && typeof (node as PromiseLike<unknown>).then === "function") return resolve(await node);
  if (!isValidElement(node)) return node as ReactNode;
  const el = node as ReactElement<Record<string, unknown>>;
  if (isServer(el.type)) {
    const out = await resolve(await el.type(el.props));
    return el.key != null ? createElement(Fragment, { key: el.key }, out) : out;
  }
  const next: Record<string, unknown> = {};
  let changed = false;
  for (const [k, v] of Object.entries(el.props ?? {})) {
    if (k === "children" || isValidElement(v) || (Array.isArray(v) && v.some(isValidElement)) || (v && typeof (v as PromiseLike<unknown>).then === "function" && k !== "params" && k !== "searchParams")) {
      next[k] = await resolve(v);
      changed = true;
    }
  }
  return changed ? cloneElement(el, next) : el;
}

function findAsync(n: unknown, path = ""): void {
  if (Array.isArray(n)) return n.forEach((c) => findAsync(c, path));
  if (n && typeof (n as PromiseLike<unknown>).then === "function") console.error("PROMISE", path);
  if (!isValidElement(n)) return;
  const el = n as ReactElement<Record<string, unknown>>;
  const name = typeof el.type === "function" ? el.type.name : String(el.type);
  if (isServer(el.type)) console.error("UNRESOLVED", path + "/" + name);
  for (const v of Object.values(el.props ?? {})) findAsync(v, path + "/" + name);
}

export type View = { node: ReactNode; title?: string } | { notFound: true } | { redirect: string };

export async function render(pathname: string, search: string): Promise<View> {
  const m = match(pathname);
  if (!m) return { notFound: true };
  try {
    const [page, ...chain] = await Promise.all([m.route.page(), ...m.route.layouts.map((l) => l())]);
    const params = Promise.resolve(m.params);
    const searchParams = Promise.resolve(Object.fromEntries(new URLSearchParams(search)));
    let tree: ReactNode = createElement(page.default, { params, searchParams });
    for (const l of chain.reverse()) tree = createElement(l.default, { params }, tree);
    const node = await resolve(tree);
    if (import.meta.env.DEV) findAsync(node);
    const t = page.metadata?.title;
    return { node, title: typeof t === "string" ? t : t?.default };
  } catch (e) {
    if (e instanceof RedirectError) return { redirect: e.url };
    if (e instanceof NotFoundError) return { notFound: true };
    throw e;
  }
}
