import { ensureBootstrap } from "@/lib/db/bootstrap";
import { getAllStatuses, hasLiveProvider } from "@/lib/providers/registry";
import { getMarketplaces, observationStats } from "@/lib/db/queries";
import { getAppSettings } from "@/lib/db/settings";
import { PageHeader } from "@/components/domain/page-header";
import { SourceCard, type SourceCardData } from "@/components/domain/source-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  await ensureBootstrap();
  const statuses = (await getAllStatuses()) as unknown as SourceCardData[];
  const settings = getAppSettings();
  const rows = getMarketplaces();
  const stats = observationStats();

  return (
    <>
      <PageHeader
        title="🔌 Sources"
        subtitle="Hver datakilde fortæller ærligt, hvad den kan og ikke kan. Ingen kilde simulerer data den ikke har adgang til."
      />

      {!hasLiveProvider() && (
        <div className="mb-5 rounded-lg border border-warn/35 bg-warn/8 px-3.5 py-3 text-[12.5px] text-warn">
          ⚠️ Ingen automatisk datakilde er forbundet lige nu. Alt du ser i appen kommer fra din egen import
          ({stats.total} prisobservationer) — medmindre DEMO er slået til.
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {statuses.map((s) => (
          <SourceCard key={s.key} s={s} />
        ))}
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle className="text-[13px]">Adgangskrav i praksis</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="eyebrow">🟢 DBA</div>
            <p className="mt-1 text-[12px] text-muted">
              Ingen offentlig API. Vi henter aldrig lister selv: kun den ene URL du indsætter, kun metadata, robots.txt
              respekteres.
            </p>
          </div>
          <div>
            <div className="eyebrow">⚪ Facebook Marketplace</div>
            <p className="mt-1 text-[12px] text-muted">
              Ingen tilgængelig API til private salg. Brug søgnings-alerts, som du videresender, eller CSV/JSON.
            </p>
          </div>
          <div>
            <div className="eyebrow">🟡 Vinted Pro</div>
            <p className="mt-1 text-[12px] text-muted">
              Officiel Pro Integrations-API findes, men kræver allow-listed konto og signatur. Sæt VINTED_ACCESS_KEY og
              VINTED_SIGNING_KEY, så skifter kilden til LIMITED.
            </p>
          </div>
          <div>
            <div className="eyebrow">📥 Manuel import</div>
            <p className="mt-1 text-[12px] text-muted">
              Altid tilgængelig: URL, fritekst, CSV, JSON og e-mail-alerts gennem den samme pipeline.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-[13px]">Datakilder i databasen</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-line">
            {rows.map((m) => (
              <li key={m.key} className="flex flex-wrap items-center gap-2 px-3 py-2 text-[12px]">
                <span className="mono w-24 text-ink">{m.key}</span>
                <span className="text-muted">{m.name}</span>
                <span className="mono text-dim">{m.accessStatus}</span>
                <span className="mono text-dim">{m.accessMode}</span>
                {m.notes && <span className="text-dim">{m.notes}</span>}
                {m.docsUrl && (
                  <a href={m.docsUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-accent hover:underline">
                    ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="mt-3 text-[11px] text-dim">
        DEMO er aktuelt {settings.demo.enabled ? "slået til ⚪" : "slået fra 🔵"}. DEMO-data bliver aldrig blandet i
        estimater for rigtige data, og DEMO-records udløser aldrig alarmer.
      </p>
    </>
  );
}
