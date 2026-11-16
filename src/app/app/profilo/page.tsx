import { ProfileSections } from "@/components/profile";
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/session";

export const metadata = { title: "Profilo" };

export default async function ProfilePage() {
  const s = await requireRole("client");
  return (
    <>
      <PageHeader eyebrow="Area personale" title="Il mio profilo" />
      <ProfileSections session={s} />
    </>
  );
}
