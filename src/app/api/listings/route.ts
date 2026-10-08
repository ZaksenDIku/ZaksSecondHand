import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureBootstrap } from "@/lib/db/bootstrap";
import { setListingFlag, markContacted, markPurchased } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

const schema = z.object({
  id: z.string().min(1),
  action: z.enum(["watch", "unwatch", "ignore", "contact", "purchase"]),
});

export async function POST(req: Request) {
  await ensureBootstrap();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ugyldig forespørgsel" }, { status: 400 });
  }
  const { id, action } = parsed.data;

  // Each action touches exactly the flag it owns — never a neighbour.
  let exists: boolean;
  switch (action) {
    case "watch":
      exists = setListingFlag(id, "watchlisted", true);
      if (exists) setListingFlag(id, "ignored", false);
      break;
    case "unwatch":
      exists = setListingFlag(id, "watchlisted", false);
      break;
    case "ignore":
      exists = setListingFlag(id, "ignored", true);
      break;
    case "contact":
      exists = markContacted(id);
      break;
    case "purchase":
      exists = markPurchased(id);
      if (exists) setListingFlag(id, "watchlisted", false);
      break;
  }
  if (!exists) return NextResponse.json({ error: "Annonce ikke fundet" }, { status: 404 });

  return NextResponse.json({ ok: true, id, action });
}
