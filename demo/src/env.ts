// Deve essere importato per primo: alcune librerie leggono `process` e `Buffer` al caricamento.
import { Buffer } from "buffer";

const g = globalThis as unknown as { process?: { env: Record<string, string | undefined> }; Buffer?: typeof Buffer };
g.process ??= { env: {} };
g.process.env ??= {};
g.process.env.NODE_ENV ??= import.meta.env.MODE;
g.Buffer ??= Buffer;
