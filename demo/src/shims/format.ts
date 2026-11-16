export * from "../../../src/lib/format";
import { demoImageUrl } from "../images";

/** Le immagini sono salvate nel database del browser: vengono servite come URL blob. */
export function imageUrl(id: string | null | undefined) {
  return demoImageUrl(id);
}
