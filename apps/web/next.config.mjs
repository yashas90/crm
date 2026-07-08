import { withSentryConfig } from "@sentry/nextjs";

const sentryDsn = process.env.SENTRY_DSN_WEB ?? process.env.NEXT_PUBLIC_SENTRY_DSN_WEB;

const PRODUCTION_API_ORIGIN = "https://crm-production-e81d.up.railway.app";

function originFromUrl(value) {
  if (!value?.trim()) return "";
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function buildContentSecurityPolicy() {
  const apiOrigin = originFromUrl(process.env.NEXT_PUBLIC_API_URL) || PRODUCTION_API_ORIGIN;
  const sentryOrigin = originFromUrl(sentryDsn);

  const r2Origin = originFromUrl(process.env.NEXT_PUBLIC_R2_PUBLIC_URL);
  const connectSrc = ["'self'", apiOrigin, sentryOrigin, "https://*.ingest.sentry.io"]
    .filter(Boolean)
    .join(" ");

  const imgSrc = ["'self'", "data:", "blob:", r2Origin].filter(Boolean).join(" ");

  return [
    "default-src 'self'",
    `connect-src ${connectSrc}`,
    `img-src ${imgSrc}`,
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "form-action 'self' https://wa.me https://api.whatsapp.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
  ].join("; ");
}

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: buildContentSecurityPolicy(),
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
];

function resolveApiRewriteBase() {
  return originFromUrl(process.env.NEXT_PUBLIC_API_URL) || PRODUCTION_API_ORIGIN;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@propninja/ui", "@propninja/types"],
  async rewrites() {
    const apiBase = resolveApiRewriteBase();
    return [
      {
        source: "/backend/:path*",
        destination: `${apiBase}/:path*`,
      },
    ];
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    };
    return config;
  },
  env: {
    NEXT_PUBLIC_SENTRY_DSN_WEB: sentryDsn ?? "",
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? "",
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

const sentryBuildOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  telemetry: false,
};

export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, sentryBuildOptions)
  : nextConfig;
