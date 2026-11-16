import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from "react";
import { navigate, withBase } from "../nav";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string | { pathname?: string; query?: Record<string, string> };
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean | null;
  children?: ReactNode;
};

const Link = forwardRef<HTMLAnchorElement, Props>(function Link({ href, replace, scroll: _s, prefetch: _p, onClick, ...rest }, ref) {
  const url = typeof href === "string" ? href : (href.pathname ?? "") + (href.query ? "?" + new URLSearchParams(href.query) : "");
  return (
    <a
      ref={ref}
      href={withBase(url)}
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || rest.target) return;
        e.preventDefault();
        navigate(url, { replace });
      }}
    />
  );
});

export default Link;
