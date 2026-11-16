/** Cookie della demo: salvati nel localStorage del browser. */
const KEY = (name: string) => `aurea-demo:cookie:${name}`;

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

const store = {
  get(name: string) {
    const value = safe(() => localStorage.getItem(KEY(name)), null);
    return value == null ? undefined : { name, value };
  },
  set(name: string, value: string) {
    safe(() => localStorage.setItem(KEY(name), value), undefined);
  },
  delete(name: string) {
    safe(() => localStorage.removeItem(KEY(name)), undefined);
  },
  has(name: string) {
    return store.get(name) !== undefined;
  },
};

export async function cookies() {
  return store;
}

export async function headers() {
  return new Headers();
}
