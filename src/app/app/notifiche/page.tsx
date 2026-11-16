import { Inbox } from "@/components/inbox";
import { requireRole } from "@/lib/session";

export const metadata = { title: "Notifiche" };

export default async function Page() {
  return <Inbox session={await requireRole("client")} />;
}
