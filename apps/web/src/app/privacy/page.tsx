import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — PropNinja CRM",
  description:
    "Privacy policy for PropNinja CRM, including how we collect, use, and protect lead and customer data.",
};

const LAST_UPDATED = "July 8, 2026";
const CONTACT_EMAIL = "yashassk@propninja.com";
const COMPANY_NAME = "PropNinja CRM";
const WEBSITE = "https://www.ninjamarketing.in";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-muted/30 px-4 py-12">
      <article className="mx-auto max-w-3xl space-y-8 rounded-xl border bg-background p-6 shadow-sm md:p-10">
        <header className="space-y-2 border-b pb-6 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {COMPANY_NAME}
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
        </header>

        <p className="text-sm leading-relaxed text-muted-foreground">
          This Privacy Policy describes how{" "}
          <strong className="text-foreground">{COMPANY_NAME}</strong> (&quot;we&quot;,
          &quot;us&quot;, or &quot;our&quot;) collects, uses, stores, and protects information when
          you use our customer relationship management platform at{" "}
          <a href={WEBSITE} className="text-primary underline-offset-4 hover:underline">
            {WEBSITE}
          </a>{" "}
          (the &quot;Service&quot;). The Service is used by authorised real-estate sales teams to
          manage leads, site visits, calls, and related business operations.
        </p>

        <Section title="1. Who this policy applies to">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground">Business users</strong> — employees, agents,
              managers, and administrators who log in to the CRM.
            </li>
            <li>
              <strong className="text-foreground">Leads and prospects</strong> — individuals whose
              contact details are stored because they enquired about a property or responded to a
              marketing campaign.
            </li>
            <li>
              <strong className="text-foreground">Website visitors</strong> — anyone who visits our
              public pages (for example, login or site-visit scheduling links).
            </li>
          </ul>
        </Section>

        <Section title="2. Information we collect">
          <p>
            <strong className="text-foreground">Account and business data:</strong> name, email,
            role, authentication credentials, lead records (name, phone, email, city, property
            interest, notes), call history, site visits, projects, documents, and tasks.
          </p>
          <p>
            <strong className="text-foreground">Third-party integrations</strong> (when enabled by
            your administrator):
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground">Meta (Facebook / Instagram) Lead Ads</strong> —
              lead form submissions and campaign metadata.
            </li>
            <li>
              <strong className="text-foreground">Google Ads</strong> — lead form submissions.
            </li>
            <li>
              <strong className="text-foreground">Property portals</strong> — enquiry data via
              webhooks.
            </li>
            <li>
              <strong className="text-foreground">Google Calendar</strong> — event data when a user
              connects their account.
            </li>
          </ul>
          <p>
            <strong className="text-foreground">Automatic data:</strong> IP address, browser type,
            device information, usage logs, session cookies, and error reports.
          </p>
        </Section>

        <Section title="3. How we use information">
          <ul className="list-disc space-y-2 pl-5">
            <li>Provide, operate, and improve the CRM Service.</li>
            <li>Authenticate users and enforce role-based access.</li>
            <li>Assign and manage leads for authorised sales teams.</li>
            <li>Send notifications and reminders configured by your organisation.</li>
            <li>Generate reports and analytics for managers and administrators.</li>
            <li>Detect fraud, abuse, and security incidents.</li>
            <li>Comply with applicable law.</li>
          </ul>
          <p>
            We do <strong className="text-foreground">not</strong> sell personal information. We do
            not use lead data for our own unrelated marketing.
          </p>
        </Section>

        <Section title="4. How we share information">
          <ul className="list-disc space-y-2 pl-5">
            <li>Within your organisation, according to user roles.</li>
            <li>
              With service providers (hosting, database, email, monitoring) under appropriate
              safeguards.
            </li>
            <li>With integrations your administrator enables (Meta, Google, WhatsApp, etc.).</li>
            <li>When required by law or to protect rights and safety.</li>
          </ul>
        </Section>

        <Section title="5. Data retention and security">
          <p>
            We retain data while your organisation uses the Service and as needed for legitimate
            business purposes. Administrators may archive or delete leads per your
            organisation&apos;s policies.
          </p>
          <p>
            We use HTTPS, access controls, password hashing, and role-based permissions. No method
            of storage is 100% secure.
          </p>
        </Section>

        <Section title="6. Your rights and data deletion">
          <p id="data-deletion">
            Depending on applicable law, you may request access, correction, deletion, or
            restriction of your personal data.
          </p>
          <p>
            <strong className="text-foreground">Lead form submissions:</strong> If you enquired via
            Facebook, Instagram, Google, or a property portal and want your data removed, email{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
            . We will forward your request to the relevant business and process deletion where
            appropriate.
          </p>
          <p>
            <strong className="text-foreground">CRM users:</strong> Contact your organisation&apos;s
            administrator first. Admins can update or delete lead records in the CRM.
          </p>
          <p>
            <strong className="text-foreground">Account deletion:</strong> Email{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>{" "}
            with subject <em>Data deletion request</em>. We respond within 30 days.
          </p>
        </Section>

        <Section title="7. Meta (Facebook) platform">
          <p>
            When your organisation connects Meta Lead Ads, lead data is received via Meta&apos;s
            webhook and stored in the CRM for follow-up by authorised agents. Meta&apos;s privacy
            policy also applies:{" "}
            <a
              href="https://www.facebook.com/privacy/policy/"
              className="text-primary underline-offset-4 hover:underline"
              rel="noopener noreferrer"
              target="_blank"
            >
              Meta Privacy Policy
            </a>
            .
          </p>
        </Section>

        <Section title="8. Children">
          <p>
            The Service is for business use and is not directed at children under 18. We do not
            knowingly collect data from children.
          </p>
        </Section>

        <Section title="9. Changes and contact">
          <p>
            We may update this policy. The date at the top reflects the latest version. For
            questions or requests, contact{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <footer className="border-t pt-6 text-center text-sm text-muted-foreground">
          <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
            Back to sign in
          </Link>
          <span className="mx-2">·</span>
          <Link href="/status" className="underline underline-offset-4 hover:text-foreground">
            System status
          </Link>
        </footer>
      </article>
    </main>
  );
}
