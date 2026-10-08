"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  Bolt,
  Eye,
  Flame,
  Laptop,
  PiggyBank,
  Plug,
  Settings,
  Smartphone,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Purpose-specific navigation. There is deliberately no generic "Dashboard"
 * item — the specialist home screen is 🔥 Deal Center.
 */
export const NAV = [
  { href: "/", label: "🔥 Deal Center", icon: Flame },
  { href: "/live", label: "⚡ Live Deals", icon: Bolt },
  { href: "/iphones", label: "📱 iPhones", icon: Smartphone },
  { href: "/macbooks", label: "💻 MacBooks", icon: Laptop },
  { href: "/watchlist", label: "👀 Watchlist", icon: Eye },
  { href: "/heatmap", label: "📊 Market Intel", icon: TrendingUp },
  { href: "/flips", label: "💸 Flips", icon: PiggyBank },
  { href: "/alerts", label: "🔔 Alerts", icon: Bell },
  { href: "/sources", label: "🔌 Sources", icon: Plug },
  { href: "/analytics", label: "📈 Analytics", icon: BarChart3 },
  { href: "/settings", label: "⚙️ Settings", icon: Settings },
];

export function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="mx-auto flex max-w-[1720px] items-center gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
      {NAV.map((n) => {
        const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1.5 text-[12.5px] transition-colors",
              active
                ? "border-line-2 bg-panel-2 font-medium text-ink"
                : "border-transparent text-muted hover:bg-panel-2 hover:text-ink"
            )}
          >
            <n.icon size={14} className={active ? "text-accent" : undefined} />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
