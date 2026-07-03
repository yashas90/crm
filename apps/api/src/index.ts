import "dotenv/config";
import "./instrument.js";
import type { Server } from "node:http";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { startFollowupNotificationJob } from "./jobs/followupNotificationJob.js";
import { startGoogleAdsLeadSync } from "./jobs/googleAdsLeadJob.js";
import { startReportEmailJob } from "./jobs/reportEmailJob.js";
import { startBackgroundJobs } from "./jobs/startBackgroundJobs.js";
import { resolveCorsOrigins } from "./lib/cors.js";
import { env } from "./lib/env.js";
import { logger } from "./lib/logger.js";
import { jsonError } from "./lib/response.js";
import { startTokenBlocklistRefresh } from "./lib/tokenBlocklist.js";
import { authMiddleware } from "./middleware/auth.js";
import { csrfProtectionMiddleware } from "./middleware/csrfProtection.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authenticatedUserRateLimit, publicIpRateLimitMiddleware } from "./middleware/rateLimit.js";
import { requestContextMiddleware } from "./middleware/requestContext.js";
import { responseCacheMiddleware } from "./middleware/responseCache.js";
import { securityHeadersMiddleware } from "./middleware/securityHeaders.js";
import {
  healIpBlockForAuthenticatedUser,
  ipBlocklistMiddleware,
  securityMonitoringMiddleware,
} from "./middleware/securityMonitoring.js";
import { sentryRequestMiddleware, sentryUserMiddleware } from "./middleware/sentry.js";
import { adminRoutes } from "./routes/admin.js";
import { agentTargetsRoutes } from "./routes/agentTargets.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { assignmentRulesRoutes } from "./routes/assignmentRules.js";
import { auditLogsRoutes } from "./routes/auditLogs.js";
import { authRoutes } from "./routes/auth.js";
import { bookingsRoutes } from "./routes/bookings.js";
import { callsRoute } from "./routes/calls.js";
import { documentViewRoutes, documentsRoutes } from "./routes/documents.js";
import { emailRoutes } from "./routes/email.js";
import { funnelRoutes } from "./routes/funnel.js";
import { googleCalendarRoutes } from "./routes/googleCalendar.js";
import { healthRoutes } from "./routes/health.js";
import { integrationsRoutes } from "./routes/integrations.js";
import { metaIntegrationsRoute } from "./routes/integrationsMeta.js";
import { portalIntegrationsRoute } from "./routes/integrationsPortal.js";
import { whatsappIntegrationsRoute } from "./routes/integrationsWhatsApp.js";
import { leadsRoute } from "./routes/leads.js";
import { messageTemplatesRoutes } from "./routes/messageTemplates.js";
import { notificationsRoutes } from "./routes/notifications.js";
import { orgRoutes } from "./routes/org.js";
import { pipelineStagesRoutes } from "./routes/pipelineStages.js";
import { projectComparisonRoutes } from "./routes/projectComparison.js";
import { projectsRoutes } from "./routes/projects.js";
import { reportsRoutes } from "./routes/reports.js";
import { securityRoutes } from "./routes/security.js";
import { siteVisitsRoutes } from "./routes/siteVisits.js";
import { slaRoutes } from "./routes/sla.js";
import { smsRoutes } from "./routes/sms.js";
import { tasksRoutes } from "./routes/tasks.js";
import { tcfRoutes } from "./routes/tcf.js";
import { userRolesRoutes } from "./routes/userRoles.js";
import { usersRoutes } from "./routes/users.js";
import { whatsappRoute } from "./routes/whatsapp.js";

const app = new Hono();

app.use("*", requestContextMiddleware);
app.use("*", sentryRequestMiddleware);
app.use("*", publicIpRateLimitMiddleware);
app.use("*", securityHeadersMiddleware);

const corsOrigins = resolveCorsOrigins();
if (env.NODE_ENV === "production") {
  logger.info("CORS origins configured", { origins: corsOrigins });
}

app.use(
  "*",
  cors({
    origin: corsOrigins,
    credentials: true,
    allowMethods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type", "Accept", "X-Requested-With"],
    maxAge: 86_400,
  }),
);

app.route("/health", healthRoutes);
app.route("/api/integrations/meta", metaIntegrationsRoute);
app.route("/api/integrations/portal", portalIntegrationsRoute);
app.route("/api/integrations/whatsapp", whatsappIntegrationsRoute);
app.route("/api/documents", documentViewRoutes);

app.use("/api/*", ipBlocklistMiddleware);
app.use("/api/*", csrfProtectionMiddleware);

app.use("/api/*", authMiddleware);
app.use("/api/*", healIpBlockForAuthenticatedUser);
app.use("/api/*", securityMonitoringMiddleware);
app.use("/api/*", responseCacheMiddleware);
app.use("/api/*", authenticatedUserRateLimit);
app.use("/api/*", sentryUserMiddleware);

app.route("/api/bookings", bookingsRoutes);
app.route("/api/auth", authRoutes);
app.route("/api/leads", leadsRoute);
app.route("/api/calls", callsRoute);
app.route("/api/reports", reportsRoutes);
app.route("/api/users", usersRoutes);
app.route("/api/user-roles", userRolesRoutes);
app.route("/api/projects", projectsRoutes);
app.route("/api/analytics", analyticsRoutes);
app.route("/api/org", orgRoutes);
app.route("/api/integrations", integrationsRoutes);
app.route("/api/tcf", tcfRoutes);
app.route("/api/audit-logs", auditLogsRoutes);
app.route("/api/notifications", notificationsRoutes);
app.route("/api/tasks", tasksRoutes);
app.route("/api/admin", adminRoutes);
app.route("/api/site-visits", siteVisitsRoutes);
app.route("/api/documents", documentsRoutes);
app.route("/api/whatsapp", whatsappRoute);
app.route("/api/sms", smsRoutes);
app.route("/api/message-templates", messageTemplatesRoutes);
app.route("/api/security", securityRoutes);
app.route("/api/agent-targets", agentTargetsRoutes);
app.route("/api/assignment-rules", assignmentRulesRoutes);
app.route("/api/email", emailRoutes);
app.route("/api/sla", slaRoutes);
app.route("/api/reports/funnel", funnelRoutes);
app.route("/api/pipeline-stages", pipelineStagesRoutes);
app.route("/api/google-calendar", googleCalendarRoutes);
app.route("/api/projects/compare", projectComparisonRoutes);

app.notFound((c) => jsonError(c, "NOT_FOUND", "Route not found", 404));

app.onError(errorHandler);

/** Railway edge keep-alive is 60s; Node defaults to 5s — mismatch causes intermittent 502s on Android. */
function tuneHttpKeepAlive(server: Server) {
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 70_000;
}

// Skip binding a port when Vitest imports this module for integration tests.
if (process.env.VITEST !== "true") {
  const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    logger.info(`PropNinja API listening on http://localhost:${info.port}`);
    startTokenBlocklistRefresh();
    startGoogleAdsLeadSync();
    startFollowupNotificationJob();
    startReportEmailJob();
    void startBackgroundJobs();
  });
  tuneHttpKeepAlive(server as Server);
}

export default app;
export type AppType = typeof app;
