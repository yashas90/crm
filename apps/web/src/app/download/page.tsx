import { Badge } from "@/components/ui/badge";
import { fetchMobileHealth, resolveMobileApkUrl } from "@/lib/mobile-download";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { Download, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Download App — PropNinja CRM",
  description:
    "Download the PropNinja mobile app for Android field agents — manage leads, follow-ups, and call logging on the go.",
};

export const revalidate = 60;

const INSTALL_STEPS = [
  "Download the APK using the button below (or ask your admin for the latest file).",
  "Open the downloaded file on your Android phone.",
  "If prompted, allow installs from your browser or file manager (Settings → Install unknown apps).",
  "Open PropNinja, sign in with your work email, and allow notifications for follow-up reminders.",
];

export default async function DownloadPage() {
  const health = await fetchMobileHealth();
  const apkUrl = resolveMobileApkUrl();
  const minVersion = health.minVersion ?? "1.0.7";

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-12">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
        <header className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Smartphone className="h-7 w-7 text-primary" aria-hidden />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">PropNinja Mobile</h1>
            <p className="text-sm text-muted-foreground">
              Real estate CRM for field agents — leads, follow-ups, and SIM call logging.
            </p>
          </div>
          <Badge variant="secondary" className="text-xs">
            Required version: {minVersion}+
          </Badge>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Download for Android</CardTitle>
            <CardDescription>
              Install the latest PropNinja APK on your work phone. iOS builds are distributed
              separately by your admin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {apkUrl ? (
              <Button asChild className="w-full" size="lg">
                <a href={apkUrl} download rel="noopener noreferrer">
                  <Download className="mr-2 h-4 w-4" aria-hidden />
                  Download PropNinja {minVersion}
                </a>
              </Button>
            ) : (
              <div className="rounded-lg border border-dashed bg-muted/40 px-4 py-5 text-center text-sm text-muted-foreground">
                <p className="font-medium text-foreground">APK link not configured yet</p>
                <p className="mt-2">
                  Ask your administrator for the latest PropNinja APK, or check your team&apos;s
                  WhatsApp / email for the Expo build link.
                </p>
              </div>
            )}

            {health.error ? (
              <p className="text-xs text-muted-foreground">Version check: {health.error}</p>
            ) : null}

            <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
              {INSTALL_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Already installed?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              If you see &quot;This app version is no longer supported&quot; when signing in, you
              need to install version <strong className="text-foreground">{minVersion}</strong> or
              newer. Uninstall the old app first if the install fails.
            </p>
            <p>
              The web dashboard works in any browser —{" "}
              <Link href="/login" className="text-primary underline-offset-4 hover:underline">
                sign in here
              </Link>{" "}
              if you need access before updating your phone.
            </p>
          </CardContent>
        </Card>

        <footer className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
            Sign in to dashboard
          </Link>
          <span className="mx-2">·</span>
          <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
            Privacy policy
          </Link>
          <span className="mx-2">·</span>
          <Link href="/status" className="underline underline-offset-4 hover:text-foreground">
            System status
          </Link>
        </footer>
      </div>
    </main>
  );
}
