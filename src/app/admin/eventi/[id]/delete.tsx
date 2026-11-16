"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { deleteEventAction } from "@/actions/admin";
import { ActionButton } from "@/components/client-ui";

export function DeleteEventButton({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <ActionButton
      action={deleteEventAction}
      fields={{ id }}
      className="btn btn-sm border-white/30 text-ivory hover:bg-danger"
      confirm={`Eliminare l'evento “${title}” e tutte le iscrizioni?`}
      confirmLabel="Elimina evento"
      onDone={() => router.push("/admin/eventi")}
    >
      {children}
    </ActionButton>
  );
}
