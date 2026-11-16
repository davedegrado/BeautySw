"use client";

import { useEffect, useState, useTransition } from "react";
import { BellOff, BellRing, Loader2 } from "lucide-react";
import { subscribePushAction, testPushAction, unsubscribePushAction, vapidKeyAction } from "@/actions/account";
import { useToast } from "./client-ui";

function b64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type State = "loading" | "unsupported" | "denied" | "off" | "on";

/** Attivazione/disattivazione delle notifiche push sul dispositivo corrente. */
export function PushToggle({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<State>("loading");
  const [pending, start] = useTransition();
  const toast = useToast();

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
      setState((await reg.pushManager.getSubscription()) ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  const enable = () =>
    start(async () => {
      try {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          setState(perm === "denied" ? "denied" : "off");
          return toast("Permesso per le notifiche non concesso.", true);
        }
        const reg = await navigator.serviceWorker.ready;
        const key = await vapidKeyAction();
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
        const r = await subscribePushAction(sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } });
        if (r.ok) {
          setState("on");
          toast(r.message ?? "Notifiche attivate.");
        } else toast(r.error, true);
      } catch {
        toast("Impossibile attivare le notifiche su questo dispositivo.", true);
      }
    });

  const disable = () =>
    start(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribePushAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      toast("Notifiche push disattivate su questo dispositivo.");
    });

  if (state === "loading") return compact ? null : <p className="text-sm text-smoke">Verifica delle notifiche in corso…</p>;
  if (compact && state !== "off") return null;
  if (state === "unsupported")
    return (
      <p className="text-sm text-smoke">
        Questo browser non supporta le notifiche push. Su iPhone e iPad aggiungi prima l&apos;app alla schermata Home (Condividi → &quot;Aggiungi a Home&quot;) e riapri da lì. Le
        notifiche restano sempre disponibili nell&apos;app, nella sezione con la campanella.
      </p>
    );
  if (state === "denied") return <p className="text-sm text-smoke">Le notifiche sono bloccate nelle impostazioni del browser. Riattivale dalle impostazioni del sito per riceverle.</p>;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {state === "on" ? (
        <>
          <span className="badge badge-green">
            <BellRing className="h-3 w-3" /> Attive su questo dispositivo
          </span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await testPushAction();
                toast(r.ok ? (r.message ?? "") : r.error, !r.ok);
              })
            }
          >
            Invia prova
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={disable}>
            <BellOff className="h-3.5 w-3.5" /> Disattiva
          </button>
        </>
      ) : (
        <button type="button" className={compact ? "btn btn-gold btn-sm" : "btn btn-gold"} disabled={pending} onClick={enable}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />}
          Attiva notifiche push
        </button>
      )}
    </div>
  );
}
