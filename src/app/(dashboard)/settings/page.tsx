import { ensureBootstrap } from "@/lib/db/bootstrap";
import { getAppSettings, DEFAULT_SETTINGS } from "@/lib/db/settings";
import { PageHeader } from "@/components/domain/page-header";
import { SettingsForm } from "@/components/domain/settings-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_WEIGHTS } from "@/lib/core/deal-score";
import { FLIP_DEFAULTS } from "@/lib/core/flip";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await ensureBootstrap();
  const s = getAppSettings();

  return (
    <>
      <PageHeader
        title="⚙️ Settings"
        subtitle="Alt gemmes lokalt i SQLite. API-nøgler opbevares aldrig i frontend-koden og returneres aldrig til browseren i klar tekst."
      />

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SettingsForm
            initial={{
              freshnessHours: s.freshnessHours,
              demo: s.demo,
              weights: s.weights as unknown as Record<string, number>,
              flip: s.flip,
              profile: s.profile,
              notifications: s.notifications,
            }}
          />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[13px]">🛡 Standardværdier</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[11.5px] text-muted">
                Nødvendige for at genskabe en standardvægtning, hvis du har justeret for meget.
              </p>
              <pre className="mono mt-2 overflow-x-auto rounded-md border border-line bg-panel-2 p-2 text-[10.5px] text-dim">
                {JSON.stringify({ weights: DEFAULT_WEIGHTS, flip: FLIP_DEFAULTS, profile: DEFAULT_SETTINGS.profile }, null, 2)}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[13px]">🔐 Hemmeligheder</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-[12px] text-muted">
                <li>• Nøgler til Vinted Pro læses fra <span className="mono">.env.local</span>, aldrig fra databasen.</li>
                <li>• Notifikationsnøgler gemmes i SQLite og maskeres i alle API-svar.</li>
                <li>• Der gemmes aldrig markedsplads-brugernavne eller adgangskoder.</li>
                <li>• <span className="mono">.env.local</span> skal ikke committes — se <span className="mono">.env.example</span>.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[13px]">🎯 Sådan læses scoren</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-[12px] text-muted">
                <li>🔵 NORMAL &lt; 60 · 🟢 GOOD 60–74 · 🟠 GREAT 75–84 · 🔥 HOT 85–92 · 🚨 URGENT 93+</li>
                <li>🚨 kræver samtidig stærkt rabat, frisk annonce og reel margin.</li>
                <li>🛡 Risiko vurderes uafhængigt: 🔴 høj risiko sænker aldrig en høj pris til at være et godt køb.</li>
                <li>💨 Hastighed er et estimat baseret på alder, rabat, popularitet og historik.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
