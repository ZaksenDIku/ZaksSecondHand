import { ensureBootstrap } from "@/lib/db/bootstrap";
import { observationStats } from "@/lib/db/queries";
import { PageHeader } from "@/components/domain/page-header";
import { ImportForm } from "@/components/domain/import-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  await ensureBootstrap();
  const stats = observationStats();

  return (
    <>
      <PageHeader
        title="📥 Import"
        subtitle="Alle veje ind i appen. Importerede data markeres 🔵 IMPORTED og gennemgår præcis samme pipeline som alt andet: normalisering, markedsværdi, DealScore, RiskScore, dubletter."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-[13px]">Tilføj data</CardTitle>
          </CardHeader>
          <CardContent>
            <ImportForm />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[13px]">📊 Datagrundlag</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-[12px]">
                <li className="flex justify-between">
                  <span className="text-muted">Prisobservationer i alt</span>
                  <span className="mono text-ink">{stats.total}</span>
                </li>
                {stats.byOrigin.map((o) => (
                  <li key={o.origin} className="flex justify-between">
                    <span className="text-muted">
                      {o.origin === "DEMO" ? "⚪ DEMO" : o.origin === "IMPORTED" ? "🔵 IMPORTED" : o.origin === "REAL" ? "🟢 REAL" : `🟡 ${o.origin}`}
                    </span>
                    <span className="mono text-ink">{o.count}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-dim">
                Markedsværdier og købsgrænser beregnes udelukkende fra disse observationer. Jo flere rigtige
                importer, desto bedre estimater — og ingen DEMO-blanding i købsgrænserne, når DEMO er slået fra.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[13px]">🧩 Understøttede CSV-kolonner</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mono text-[11.5px] text-muted">
                title*, price*, url, description, image, location, posted, id, seller, marketplace, storage, ram, chip,
                condition, battery
              </p>
              <p className="mt-2 text-[11px] text-dim">
                Kolonnenavne matches også på dansk (titel, pris, sted, lager, batteri …). Adskillere: komma, semikolon
                eller tabulatoring.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[13px]">🛡 Hvad vi ikke gør</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-[11.5px] text-muted">
                <li>⛔ Ingen CAPTCHA-omgåelse</li>
                <li>⛔ Ingen proxy-rotation eller fingerprint-spoofing</li>
                <li>⛔ Ingen scraping af markedspladser, der forbyder det</li>
                <li>🔐 Ingen gemte markedsplads-adgangskoder — kun API-nøgler i .env.local</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
