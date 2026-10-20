import { Link, NavLink, Outlet } from "react-router";
import { cn } from "@/lib/utils";

export function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col print:block print:min-h-0">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-surface px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur-md print:hidden">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-6 px-4 sm:px-6">
          <Link to="/invoices" className="flex items-center gap-2.5 rounded-md" aria-label="Lumen & Oak Studio — invoices">
            <span
              aria-hidden
              className="flex size-8 items-center justify-center rounded-full bg-accent font-display text-[0.8rem] font-semibold text-white"
            >
              L&amp;O
            </span>
            <span className="font-display text-[1.05rem] font-semibold tracking-tight">
              Lumen &amp; Oak
              <span className="ml-1.5 hidden font-sans text-sm font-normal text-ink-muted sm:inline">
                Studio
              </span>
            </span>
          </Link>
          <nav aria-label="Main">
            <NavLink
              to="/invoices"
              end={false}
              className={({ isActive }) =>
                cn(
                  "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                  isActive ? "bg-ink/[0.06] text-ink" : "text-ink-muted hover:text-ink",
                )
              }
            >
              Invoices
            </NavLink>
          </nav>
        </div>
      </header>
      <main id="main" className="flex flex-1 flex-col print:block">
        <Outlet />
      </main>
    </div>
  );
}
