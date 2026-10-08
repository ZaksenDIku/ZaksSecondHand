"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {Copy, Check, Plus, Loader2} from "lucide-react";
import { Button } from "@/components/ui/button";


export function ActionButton({
  listingId,
  action,
  label,
  active,
  tone = "default",
  size = "sm",
  done,
}: {
  listingId: string;
  action: "watch" | "unwatch" | "ignore" | "contact" | "purchase";
  label: React.ReactNode;
  active?: boolean;
  tone?: "default" | "primary";
  size?: "sm" | "md" | "lg";
  done?: boolean;
}) {
  const [busy, setBusy] = React.useState(false);
  const [ok, setOk] = React.useState(false);
  const router = useRouter();

  async function run() {
    setBusy(true);
    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: listingId, action }),
    });
    setBusy(false);
    if (res.ok) {
      setOk(true);
      setTimeout(() => setOk(false), 1600);
      router.refresh();
    }
  }

  return (
    <Button
      size={size}
      variant={tone === "primary" ? "primary" : active ? "outline" : "outline"}
      onClick={run}
      disabled={busy}
      className={active ? "border-accent/60 text-accent" : undefined}
      title={done ? "Klik for at kopiere" : undefined}
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : ok ? <Check size={12} className="text-good" /> : done ? <Copy size={12} /> : null}
      {ok ? "Gemt" : label}
    </Button>
  );
}

export function AddToWatchButton({ listingId, name }: { listingId: string; name: string }) {
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-1.5">
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await fetch("/api/watch", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name, listingId, matchKind: "model" }),
          });
          const d = (await res.json()) as { error?: string };
          setMsg(res.ok ? "👀 Overvåger nu" : `⛔ ${d.error ?? "fejl"}`);
          setBusy(false);
        }}
      >
        <Plus size={11} /> 👀 Overvåg model
      </Button>
      {msg && <span className="text-[11px] text-dim">{msg}</span>}
    </span>
  );
}
