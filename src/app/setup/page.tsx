import { redirect } from "next/navigation";
import { ensureBootstrap } from "@/lib/db/bootstrap";
import { getAppSettings } from "@/lib/db/settings";
import { SetupForm } from "@/components/domain/setup-form";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  await ensureBootstrap();
  const s = getAppSettings();
  if (s.setupComplete) redirect("/");

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="border-b border-line px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-panel-2 text-lg leading-none">
            Z
          </div>
          <div>
            <h1 className="text-[14px] font-semibold leading-none text-ink">ZaksSecondHand</h1>
            <p className="mt-0.5 text-[10px] text-dim">🍏 Førstegangsopsætning</p>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:px-6">
        <div className="w-full">
          <SetupForm defaults={s.profile} />
          <Card className="mx-auto mt-5 max-w-2xl">
            <CardContent className="p-4 text-[11.5px] text-dim">
              🔐 Appen kører 100 % lokalt. Ingen data sendes til tredjeparter, og ingen markedsplads-API-nøgler
              indlejres i koden. Hvis du senere vil forbinde Vinted Pro, lægges nøglerne i <span className="mono">.env.local</span>.
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
