const sentryDsn = process.env.SENTRY_DSN_WEB ?? process.env.NEXT_PUBLIC_SENTRY_DSN_WEB;

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@propninja/ui", "@propninja/types"],
  env: {
    NEXT_PUBLIC_SENTRY_DSN_WEB: sentryDsn ?? "",
  },
};

export default nextConfig;
