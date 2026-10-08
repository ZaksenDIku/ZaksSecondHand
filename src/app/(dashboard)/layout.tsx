import Link from "next/link";
import { redirect } from "next/navigation";
import { CommandPalette } from "@/components/domain/command-palette";
import { NavBar } from "@/components/domain/nav-bar";
import { ensureBootstrap } from "@/lib/db/bootstrap";
import { getAppSettings } from "@/lib/db/settings";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await ensureBootstrap();
  if (!getAppSettings().setupComplete) redirect("/setup");

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="sticky top-0 z-40 border-b border-line bg-panel/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1720px] items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-panel-2">
                <span className="text-lg leading-none">Z</span>
                <span className="live-dot absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-steal" />
              </div>
              <div>
                <h1 className="text-[14px] font-semibold leading-none text-ink">ZaksSecondHand</h1>
                <p className="mt-0.5 text-[10px] text-dim">🍏 Deal Center · local-first deal engine</p>
              </div>
            </Link>
            <div className="hidden w-72 sm:block">
              <CommandPalette />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/import"
              className="hidden rounded-md bg-accent px-2.5 py-1.5 text-[12.5px] font-medium text-black transition-opacity hover:opacity-90 sm:block"
            >
              📥 Import
            </Link>
            <Link
              href="/alerts"
              className="rounded-md border border-line bg-panel-2 px-2.5 py-1.5 text-[12.5px] text-ink transition-colors hover:border-line-2"
            >
              🔔 Alerts
            </Link>
          </div>
        </div>
        <NavBar />
      </header>
      <main className="mx-auto w-full max-w-[1720px] flex-1 px-4 py-6 sm:px-6">{children}</main>
      <footer className="border-t border-line px-4 py-3 text-center text-[11px] text-dim sm:px-6">
        ZaksSecondHand — local-first · 🟢 REAL · 🔵 IMPORTED · 🟣 AI PARSED · 🟡 STALE · ⚪ DEMO · ingen
        automatiseret bulk-scraping uden udtrykkelig tilladelse
      </footer>
    </div>
  );
}
