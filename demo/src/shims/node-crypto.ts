import { Buffer } from "buffer";

export function randomBytes(n: number) {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(n)));
}

export function randomInt(a: number, b?: number) {
  const [min, max] = b === undefined ? [0, a] : [a, b];
  const range = max - min;
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / range) * range;
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return min + (buf[0] % range);
}

export function randomUUID() {
  return crypto.randomUUID();
}

export default { randomBytes, randomInt, randomUUID };
