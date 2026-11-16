import type { ReactNode } from "react";
import { RoleLayout } from "@/components/role-layout";

export const dynamic = "force-dynamic";

export default function Layout({ children }: { children: ReactNode }) {
  return <RoleLayout role="client">{children}</RoleLayout>;
}
