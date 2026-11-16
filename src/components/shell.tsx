"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Bell, CalendarDays, CalendarHeart, CalendarPlus, ClipboardList, Crown, Gift, Home, LayoutDashboard, LogOut, Megaphone, Menu,
  PartyPopper, PlusCircle, Settings, Sparkles, Tag, User, Users, UserCog, X, type LucideIcon,
} from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { Logo, Mandala } from "./mandala";

type Item = { href: string; label: string; icon: LucideIcon; primary?: boolean; accent?: boolean };

const NAV: Record<string, Item[]> = {
  client: [
    { href: "/app", label: "Home", icon: Home, primary: true },
    { href: "/app/prenota", label: "Prenota", icon: CalendarPlus, primary: true },
    { href: "/app/appuntamenti", label: "I miei appuntamenti", icon: CalendarDays, primary: true },
    { href: "/app/promozioni", label: "Promozioni", icon: Tag },
    { href: "/app/eventi", label: "Eventi", icon: PartyPopper },
    { href: "/app/punti", label: "I miei punti", icon: Crown, primary: true },
    { href: "/app/profilo", label: "Profilo", icon: User },
  ],
  admin: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard, primary: true },
    { href: "/admin/calendario", label: "Calendario", icon: CalendarDays, primary: true },
    { href: "/admin/clienti", label: "Clienti", icon: Users, primary: true },
    { href: "/admin/dipendenti", label: "Dipendenti", icon: UserCog },
    { href: "/admin/trattamenti", label: "Trattamenti", icon: Sparkles, primary: true },
    { href: "/admin/promozioni", label: "Promozioni", icon: Tag },
    { href: "/admin/eventi", label: "Eventi", icon: PartyPopper },
    { href: "/admin/fedelta", label: "Programma fedeltà", icon: Crown },
    { href: "/admin/notifiche", label: "Notifiche", icon: Megaphone },
    { href: "/admin/impostazioni", label: "Impostazioni", icon: Settings },
  ],
  employee: [
    { href: "/staff", label: "Home", icon: Home, primary: true },
    { href: "/staff/calendario", label: "Il mio calendario", icon: CalendarHeart, primary: true },
    { href: "/staff/appuntamenti", label: "I miei appuntamenti", icon: ClipboardList, primary: true },
    { href: "/staff/trattamenti", label: "I miei trattamenti", icon: Gift },
    { href: "/staff/trattamenti/nuovo", label: "Nuovo trattamento", icon: PlusCircle, primary: true, accent: true },
    { href: "/staff/profilo", label: "Il mio profilo", icon: User },
  ],
};
const SHORT: Record<string, string> = {
  "I miei appuntamenti": "Agenda",
  "I miei punti": "Punti",
  "Il mio calendario": "Calendario",
  "Nuovo trattamento": "Nuovo",
  "Programma fedeltà": "Fedeltà",
};
const INBOX: Record<string, string> = { client: "/app/notifiche", admin: "/admin/avvisi", employee: "/staff/notifiche" };
const ROLE_LABEL: Record<string, string> = { client: "Area cliente", admin: "Amministrazione", employee: "Area staff" };

export function Shell({
  role,
  userName,
  centerName,
  unread,
  children,
}: {
  role: "client" | "admin" | "employee";
  userName: string;
  centerName: string;
  unread: number;
  children: ReactNode;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV[role];
  const root = items[0].href;
  // La voce attiva è quella con il percorso più specifico che corrisponde alla pagina.
  const activeHref = items
    .filter((i) => (i.href === root ? path === root : path === i.href || path.startsWith(`${i.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const isActive = (i: Item) => i.href === activeHref;

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  const links = (
    <nav className="flex flex-col gap-0.5">
      {items.map((i) => {
        const active = isActive(i);
        return (
          <Link
            key={i.href}
            href={i.href}
            className={`group relative flex items-center gap-3.5 rounded-lg px-4 py-2.5 text-[0.82rem] tracking-wide transition-all duration-200 ${
              active ? "bg-white/[0.06] text-gold-light" : i.accent ? "text-gold hover:bg-white/[0.04]" : "text-ivory/65 hover:bg-white/[0.04] hover:text-ivory"
            }`}
          >
            <span className={`absolute left-0 top-1/2 h-5 w-px -translate-y-1/2 bg-gold transition-opacity ${active ? "opacity-100" : "opacity-0"}`} />
            <i.icon className={`h-[1.05rem] w-[1.05rem] shrink-0 ${active || i.accent ? "text-gold" : "text-gold/60 group-hover:text-gold"}`} strokeWidth={1.4} />
            {i.label}
          </Link>
        );
      })}
    </nav>
  );

  const userBox = (
    <div className="border-t border-white/10 pt-4">
      <p className="truncate px-4 text-sm text-ivory">{userName}</p>
      <p className="px-4 text-[0.62rem] uppercase tracking-[0.2em] text-gold/70">{ROLE_LABEL[role]}</p>
      <form action={logoutAction} className="mt-3">
        <button className="flex w-full items-center gap-3.5 rounded-lg px-4 py-2.5 text-[0.82rem] text-ivory/60 transition hover:bg-white/[0.04] hover:text-ivory">
          <LogOut className="h-[1.05rem] w-[1.05rem] text-gold/60" strokeWidth={1.4} />
          Esci
        </button>
      </form>
    </div>
  );

  const bell = (dark: boolean) => (
    <Link href={INBOX[role]} className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full transition ${dark ? "text-gold-light hover:bg-white/10" : "text-anthracite hover:bg-cream"}`} aria-label={`Notifiche${unread ? ` (${unread} non lette)` : ""}`}>
      <Bell className="h-5 w-5" strokeWidth={1.4} />
      {unread > 0 && (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[0.6rem] font-semibold text-ink">{unread > 9 ? "9+" : unread}</span>
      )}
    </Link>
  );

  return (
    <div className="min-h-dvh lg:pl-[17rem]">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[17rem] flex-col overflow-hidden bg-ink px-4 py-7 lg:flex">
        <Mandala className="pointer-events-none absolute -bottom-28 -left-28 h-80 w-80 text-gold/[0.13]" spin />
        <Link href={root} className="mb-1 px-3">
          <Logo light />
        </Link>
        <p className="mb-6 truncate px-3 pl-[3.6rem] text-[0.6rem] uppercase tracking-[0.25em] text-ivory/40">{centerName}</p>
        <div className="gold-line mb-5 opacity-50" />
        <div className="relative flex-1 overflow-y-auto">{links}</div>
        <div className="relative">{userBox}</div>
      </aside>

      {/* Barra superiore mobile */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gold/20 bg-ink px-4 pb-2.5 pt-[calc(env(safe-area-inset-top)+0.625rem)] lg:hidden">
        <Link href={root}>
          <Logo light small />
        </Link>
        <div className="flex items-center gap-1">
          {bell(true)}
          <button type="button" onClick={() => setOpen(true)} className="inline-flex h-10 w-10 items-center justify-center rounded-full text-gold-light hover:bg-white/10" aria-label="Apri menu">
            <Menu className="h-5 w-5" strokeWidth={1.4} />
          </button>
        </div>
      </header>

      {/* Barra superiore desktop */}
      <div className="sticky top-0 z-20 hidden items-center justify-end gap-3 border-b border-line/70 bg-ivory/85 px-10 py-2.5 backdrop-blur lg:flex">
        <span className="text-xs tracking-wide text-smoke">{centerName}</span>
        {bell(false)}
      </div>

      {/* Menu laterale mobile */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade bg-ink/70" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[19rem] max-w-[88vw] animate-fade flex-col overflow-hidden bg-ink px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-[calc(env(safe-area-inset-top)+1.25rem)]">
            <Mandala className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 text-gold/[0.13]" />
            <div className="mb-5 flex items-center justify-between px-2">
              <Logo light small />
              <button type="button" onClick={() => setOpen(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-full text-gold-light hover:bg-white/10" aria-label="Chiudi menu">
                <X className="h-5 w-5" strokeWidth={1.4} />
              </button>
            </div>
            <div className="relative flex-1 overflow-y-auto">{links}</div>
            <div className="relative">{userBox}</div>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-[82rem] px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-14 lg:pt-8">{children}</main>

      {/* Navigazione inferiore mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-gold/25 bg-ink pb-[env(safe-area-inset-bottom)] lg:hidden">
        {items
          .filter((i) => i.primary)
          .slice(0, 4)
          .map((i) => {
            const active = isActive(i);
            return (
              <Link key={i.href} href={i.href} className={`flex flex-col items-center gap-1 px-1 py-2.5 text-[0.56rem] uppercase tracking-[0.12em] transition ${active || i.accent ? "text-gold" : "text-ivory/55"}`}>
                <i.icon className="h-5 w-5" strokeWidth={active ? 1.8 : 1.3} />
                <span className="max-w-full truncate">{SHORT[i.label] ?? i.label}</span>
              </Link>
            );
          })}
        <button type="button" onClick={() => setOpen(true)} className="flex flex-col items-center gap-1 px-1 py-2.5 text-[0.56rem] uppercase tracking-[0.12em] text-ivory/55">
          <Menu className="h-5 w-5" strokeWidth={1.3} />
          Menu
        </button>
      </nav>
    </div>
  );
}
