import { useSyncExternalStore } from "react";
import { appPath, navigate, refresh, subscribe } from "../nav";

export class RedirectError extends Error {
  constructor(public url: string) {
    super(`redirect ${url}`);
  }
}
export class NotFoundError extends Error {
  constructor() {
    super("not found");
  }
}

export function redirect(url: string): never {
  setTimeout(() => navigate(url, { replace: true }), 0);
  throw new RedirectError(url);
}
export const permanentRedirect = redirect;

export function notFound(): never {
  throw new NotFoundError();
}

export function unstable_rethrow(e: unknown) {
  if (e instanceof RedirectError || e instanceof NotFoundError) throw e;
}

const sub = (cb: () => void) => subscribe(cb);

export function usePathname() {
  return useSyncExternalStore(sub, () => appPath(), () => "/");
}

export function useSearchParams() {
  const search = useSyncExternalStore(sub, () => location.search, () => "");
  return new URLSearchParams(search);
}

const router = {
  push: (href: string) => navigate(href),
  replace: (href: string) => navigate(href, { replace: true }),
  refresh: () => refresh(),
  back: () => history.back(),
  forward: () => history.forward(),
  prefetch: () => {},
};
export function useRouter() {
  return router;
}
