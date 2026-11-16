"use client";

import { useEffect } from "react";
import { markAllReadAction } from "@/actions/account";

/** Segna le notifiche come lette dopo qualche secondo di permanenza sulla pagina. */
export function MarkRead() {
  useEffect(() => {
    const id = setTimeout(() => void markAllReadAction(), 2500);
    return () => clearTimeout(id);
  }, []);
  return null;
}
