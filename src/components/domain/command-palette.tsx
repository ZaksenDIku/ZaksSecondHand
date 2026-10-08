"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, Loader2 } from "lucide-react";

interface Hit {
  type: "command" | "listing" | "page" | "watch";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  /** Enter also triggers a server action for non-navigation commands. */
  action?: "record-purchase" | "watchlist-toggle";
}

/** ⌘K commands. Filtering happens client-side so they are always available. */
const COMMANDS: Hit[] = [
  { type: "command", id: "hot", title: "🔥 Vis hot deals", subtitle: "DealScore 85+", href: "/live?min=85" },
  { type: "command", id: "urgent", title: "🚨 Vis urgente deals", subtitle: "Steal-niveau nu", href: "/live?min=93" },
  { type: "command", id: "newest", title: "⚡ Vis nyeste annoncer", subtitle: "Live feed", href: "/live?sort=newest" },
  { type: "command", id: "gems", title: "💎 Vis hidden gems", subtitle: "Vagt annoncer, stærk udledning", href: "/live?gems=1" },
  { type: "command", id: "drops", title: "📉 Vis prisfald", subtitle: "Fald siden første hentning", href: "/live?drops=1" },
  { type: "command", id: "watchlist", title: "👀 Åbn Watchlist", subtitle: "Regler og gemte fund", href: "/watchlist" },
  {
    type: "command",
    id: "record-purchase",
    title: "💸 Registrer køb",
    subtitle: "Åbn Flips og opret en ny post",
    href: "/flips?new=1",
  },
  { type: "command", id: "market", title: "📊 Market Intel", subtitle: "Medianer, trends, købsgrænser", href: "/heatmap" },
  { type: "command", id: "alerts", title: "🔔 Åbn Alerts", subtitle: "Urgent, prisfald, target hit", href: "/alerts" },
  { type: "command", id: "import", title: "📥 Importér data", subtitle: "URL, tekst, CSV, JSON, e-mail", href: "/import" },
  { type: "command", id: "settings", title: "⚙️ Settings", subtitle: "Vægtning, kilder, notifikationer", href: "/settings" },
];

/** ⌘K / Ctrl+K global search across listings, watch rules and pages. */
export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<Hit[]>([]);
  /** The query the current `hits` belong to, so stale responses are detectable. */
  const [loadedFor, setLoadedFor] = React.useState<string | null>(null);
  const [cursor, setCursor] = React.useState(0);
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);

  function openPalette() {
    // Reset in the handler that opens: avoids a state-sync effect and keeps the
    // previous session's query from leaking into the next one.
    setQ("");
    setHits([]);
    setLoadedFor(null);
    setCursor(0);
    setOpen(true);
  }

  function closePalette() {
    setOpen(false);
  }

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => {
          if (v) return false;
          queueMicrotask(openPalette);
          return true;
        });
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(t);
  }, [open]);

  const needle = q.trim();
  const searching = needle.length >= 2;

  React.useEffect(() => {
    if (needle.length < 2) return;
    const controller = new AbortController();
    const query = needle;
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((d: { results: Hit[] }) => {
          setHits(d.results ?? []);
          setLoadedFor(query);
        })
        .catch(() => undefined);
    }, 160);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [needle]);

  const loading = searching && loadedFor !== needle;

  const shown: Hit[] = !searching
    ? COMMANDS
    : loading
      ? []
      : COMMANDS.filter(
          (c) => c.title.toLowerCase().includes(needle.toLowerCase()) || c.subtitle.toLowerCase().includes(needle.toLowerCase())
        ).concat(hits);

  function go(hit: Hit) {
    closePalette();
    router.push(hit.href);
  }

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        className="flex w-full items-center gap-2 rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-left text-xs text-muted transition-colors hover:border-line-2 hover:text-ink"
        aria-label="Søg (Cmd+K)"
      >
        <Search className="size-3.5" />
        <span className="hidden flex-1 sm:block">Søg</span>
        <kbd className="hidden rounded border border-line px-1 py-0.5 font-mono text-[10px] text-muted sm:block">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Søg"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closePalette();
          }}
        >
          <div className="w-full max-w-xl overflow-hidden rounded-xl border border-line-2 bg-panel shadow-2xl">
            <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
              {loading ? (
                <Loader2 className="size-4 animate-spin text-muted" />
              ) : (
                <Search className="size-4 text-muted" />
              )}
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setCursor(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setCursor((c) => Math.min(c + 1, shown.length - 1));
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setCursor((c) => Math.max(c - 1, 0));
                  }
                  if (e.key === "Enter" && shown[cursor]) go(shown[cursor]);
                }}
                placeholder="Søg modeller, markedspladser, sider…"
                className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
              />
              <kbd className="rounded border border-line px-1 py-0.5 font-mono text-[10px] text-muted">
                esc
              </kbd>
            </div>

            <div className="max-h-[52vh] overflow-y-auto p-1.5">
              {shown.length === 0 && !loading ? (
                <p className="px-3 py-6 text-center text-xs text-muted">
                  {searching ? 'Ingen træf. Prøv en model som “iPhone 16 Pro”.' : "Ingen kommando matcher."}
                </p>
              ) : (
                shown.map((hit, i) => (
                  <button
                    key={`${hit.type}-${hit.id}`}
                    type="button"
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => go(hit)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                      i === cursor ? "bg-panel-2" : "hover:bg-panel-2/60"
                    }`}
                  >
                    <span className="w-4 shrink-0 text-center text-[11px]">
                      {hit.type === "command" ? "⌘" : hit.type === "watch" ? "👀" : "🔎"}
                    </span>
                    <span className="flex-1 truncate text-sm text-ink">{hit.title}</span>
                    <span className="hidden shrink-0 text-[11px] text-muted sm:block">{hit.subtitle}</span>
                    {i === cursor && <CornerDownLeft className="size-3 shrink-0 text-muted" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
