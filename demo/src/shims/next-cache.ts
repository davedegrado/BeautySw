import { refresh } from "../nav";

export function revalidatePath(_path?: string, _type?: string) {
  refresh();
}
export function revalidateTag(_tag?: string) {
  refresh();
}
