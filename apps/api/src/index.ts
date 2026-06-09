import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { startGoogleAdsLeadSync } from "./jobs/googleAdsLeadJob.js";
import { env } from "./lib/env.js";
import { logger } from "./lib/logger.js";
import { jsonError } from "./lib/response.js";
import { authMiddleware } from "./middleware/auth.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestContextMiddleware } from "./middleware/requestContext.js";
import { authRoutes } from "./routes/auth.js";
import { callsRoute } from "./routes/calls.js";
import { healthRoutes } from "./routes/health.js";
import { integrationsRoutes } from "./routes/integrations.js";
import { metaIntegrationsRoute } from "./routes/integrationsMeta.js";
import { leadsRoute } from "./routes/leads.js";
import { orgRoutes } from "./routes/org.js";
import { projectsRoutes } from "./routes/projects.js";
import { reportsRoutes } from "./routes/reports.js";
import { tcfRoutes } from "./routes/tcf.js";
import { userRolesRoutes } from "./routes/userRoles.js";
import { usersRoutes } from "./routes/users.js";

const app = new Hono();

app.use("*", requestContextMiddleware);

const defaultOrigins = ["http://localhost:3000", "http://localhost:8081"];

function parseCorsOrigins(): string[] {
  const fromEnv = process.env.CORS_ORIGINS?.split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return fromEnv?.length ? [...defaultOrigins, ...fromEnv] : defaultOrigins;
}

app.use(
  "*",
  cors({
    origin: parseCorsOrigins(),
    credentials: true,
  }),
);

app.route("/health", healthRoutes);
app.route("/api/integrations/meta", metaIntegrationsRoute);

app.use("/api/*", authMiddleware);

app.route("/api/auth", authRoutes);
app.route("/api/leads", leadsRoute);
app.route("/api/calls", callsRoute);
app.route("/api/reports", reportsRoutes);
app.route("/api/users", usersRoutes);
app.route("/api/user-roles", userRolesRoutes);
app.route("/api/projects", projectsRoutes);
app.route("/api/org", orgRoutes);
app.route("/api/integrations", integrationsRoutes);
app.route("/api/tcf", tcfRoutes);

app.notFound((c) => jsonError(c, "NOT_FOUND", "Route not found", 404));

app.onError(errorHandler);

// Skip binding a port when Vitest imports this module for integration tests.
if (process.env.VITEST !== "true") {
  serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    logger.info(`PropNinja API listening on http://localhost:${info.port}`);
    startGoogleAdsLeadSync();
  });
}

export default app;
export type AppType = typeof app;
