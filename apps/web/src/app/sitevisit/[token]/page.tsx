import { PublicSiteVisitClient } from "@/components/site-visits/public-site-visit-client";
import { fetchPublicSiteVisit } from "@/lib/public-site-visit-api";
import { notFound } from "next/navigation";

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
    notFound();
  }

  return <PublicSiteVisitClient token={token} initial={visit} />;
}
