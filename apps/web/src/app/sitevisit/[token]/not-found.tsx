import Link from "next/link";

export default function SiteVisitNotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-bold">Visit not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This link may be invalid or expired. Contact your sales consultant for help.
        </p>
        <Link href="/login" className="mt-4 inline-block text-sm font-medium text-primary">
          Agent login
        </Link>
      </div>
    </div>
  );
}
