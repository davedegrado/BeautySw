import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { ToastProvider } from "@/components/client-ui";
import GlobalError from "@/app/error";
import NotFound from "@/app/not-found";
import { DemoBar } from "./DemoBar";
import { syncImages } from "./images";
import { appPath, currentUrl, navigate, subscribe } from "./nav";
import { render } from "./router";
import { RedirectError } from "./shims/next-navigation";
import { handleSpecialLink } from "./special-links";

class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    const { error } = this.state;
    // Un redirect lanciato da una server action: la navigazione è già in corso.
    if (error instanceof RedirectError) return null;
    if (error) return <GlobalError error={error} reset={() => this.setState({ error: null })} />;
    return this.props.children;
  }
}

export function App() {
  const [view, setView] = useState<{ key: string; node: ReactNode } | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const load = async (kind: "navigate" | "refresh") => {
      const id = ++seq.current;
      const { pathname, search } = currentUrl();
      setLoading(true);
      try {
        await syncImages();
        const v = await render(pathname, search);
        if (id !== seq.current) return;
        if ("redirect" in v) return navigate(v.redirect, { replace: true });
        if ("notFound" in v) setView({ key: pathname, node: <NotFound /> });
        else {
          document.title = v.title ? `${v.title} · Aurea` : "Aurea · Beauty Management";
          setView({ key: pathname, node: v.node });
        }
        if (kind === "navigate" && !location.hash) window.scrollTo(0, 0);
      } catch (e) {
        if (id !== seq.current) return;
        console.error(e);
        setView({ key: pathname, node: <GlobalError error={e as Error} reset={() => load("refresh")} /> });
      } finally {
        if (id === seq.current) setLoading(false);
      }
    };
    const off = subscribe(load);
    load("navigate");

    // Link HTML semplici (<a href="/...">): restano nell'app invece di uscire da GitHub Pages.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const href = a.getAttribute("href");
      if (!href || !href.startsWith("/") || href.startsWith("//")) return;
      const url = new URL(href, location.origin);
      if (handleSpecialLink(appPath(url.pathname), e)) return;
      if (a.target) return;
      e.preventDefault();
      navigate(appPath(url.pathname) + url.search + url.hash);
    };
    document.addEventListener("click", onClick);
    return () => {
      off();
      document.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <ToastProvider>
      <div className={`fixed inset-x-0 top-0 z-[60] h-0.5 bg-gold transition-opacity duration-300 ${loading ? "opacity-100 animate-pulse" : "opacity-0"}`} />
      {view && <Boundary key={view.key}>{view.node}</Boundary>}
      <DemoBar />
    </ToastProvider>
  );
}
