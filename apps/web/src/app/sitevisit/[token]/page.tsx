import { PublicSiteVisitClient } from "@/components/site-visits/public-site-visit-client";
import { fetchPublicSiteVisit } from "@/lib/public-site-visit-api";

type PageProps = {
  params: Promise<{ token: string }>;
};

export const metadata = {
  title: "Site Visit Confirmation",
  robots: { index: false, follow: false },
};

export default async function SiteVisitPublicPage({ params }: PageProps) {
  const { token } = await params;
  const visit = await fetchPublicSiteVisit(token);
  if (!visit) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-4xl" aria-hidden>
          🔗
        </p>
        <h1 className="text-xl font-bold">Link not found</h1>
        <p className="max-w-sm text-muted-foreground">
          This visit link may have expired or is no longer valid. Please contact your sales
          consultant for a new link.
        </p>
      </div>
    );
  }

  return <PublicSiteVisitClient token={token} initial={visit} />;
}
