import { DEFAULT_PERMISSIONS } from "@/db/schema";
import { ExceptionsPanel, ShiftsEditor } from "@/components/forms";
import { ProfileSections } from "@/components/profile";
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/session";

export const metadata = { title: "Il mio profilo" };

export default async function StaffProfile() {
  const s = await requireRole("employee");
  const perms = s.user.permissions ?? DEFAULT_PERMISSIONS;
  return (
    <>
      <PageHeader eyebrow="Area staff" title="Il mio profilo" />
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="mb-3 text-2xl">I miei orari di lavoro</h2>
          <ShiftsEditor employeeId={s.user.id} readOnly />
          <p className="mt-3 text-xs text-smoke">I turni settimanali sono gestiti dall&apos;amministrazione.</p>
        </section>
        <section className="card p-6">
          <h2 className="mb-3 text-2xl">Ferie e disponibilità</h2>
          <ExceptionsPanel employeeId={s.user.id} center={s.center} canEdit={perms.manageAvailability} />
        </section>
      </div>
      <ProfileSections session={s} />
    </>
  );
}
