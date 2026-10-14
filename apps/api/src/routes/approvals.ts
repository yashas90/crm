import { Hono } from "hono";
import { forbidden } from "../lib/errors.js";
import { jsonError, jsonOk } from "../lib/response.js";
import { validate } from "../lib/validate.js";
import {
  approvalFilterSchema,
  calculateAppraisalSchema,
  calculateIncentiveSchema,
  disburseBodySchema,
  idParamSchema,
  overrideIncentiveSchema,
  rejectReasonSchema,
} from "../lib/validators/approvals.js";
import type { AuthUser } from "../middleware/auth.js";
import { createApprovalService } from "../services/approvalService.js";

const ADMIN_ONLY = "Only an admin can approve incentives and appraisals";

function adminOrForbid(user: AuthUser) {
  if (user.role !== "admin") throw forbidden(ADMIN_ONLY);
}

export const approvalRoutes = new Hono();

approvalRoutes.use("*", async (c, next) => {
  const user = c.get("authUser") as AuthUser | undefined;
  if (!user || user.role !== "admin") {
    return jsonError(c, "FORBIDDEN", ADMIN_ONLY, 403);
  }
  await next();
});

approvalRoutes.get("/summary", async (c) => {
  const user = c.get("authUser") as AuthUser;
  adminOrForbid(user);
  return jsonOk(c, await createApprovalService(c.get("db")).summary(user));
});

approvalRoutes.get("/incentives/export", validate("query", approvalFilterSchema), async (c) => {
  const user = c.get("authUser") as AuthUser;
  adminOrForbid(user);
  const file = await createApprovalService(c.get("db")).exportIncentives(
    user,
    c.req.valid("query"),
  );
  return c.body(file.body, 200, {
    "Content-Type": "application/vnd.ms-excel; charset=utf-8",
    "Content-Disposition": `attachment; filename="${file.filename}"`,
  });
});

approvalRoutes.get(
  "/incentives/disbursement",
  validate("query", approvalFilterSchema),
  async (c) => {
    const user = c.get("authUser") as AuthUser;
    adminOrForbid(user);
    const data = await createApprovalService(c.get("db")).quarterlyBundle(
      user,
      c.req.valid("query").quarter,
    );
    return jsonOk(c, data);
  },
);

approvalRoutes.get("/incentives", validate("query", approvalFilterSchema), async (c) => {
  const user = c.get("authUser") as AuthUser;
  adminOrForbid(user);
  const rows = await createApprovalService(c.get("db")).listIncentives(user, c.req.valid("query"));
  return jsonOk(c, rows);
});

approvalRoutes.post(
  "/incentives/calculate",
  validate("json", calculateIncentiveSchema),
  async (c) => {
    const user = c.get("authUser") as AuthUser;
    adminOrForbid(user);
    const data = await createApprovalService(c.get("db")).calculateIncentives(
      user,
      c.req.valid("json").month,
    );
    return jsonOk(c, data);
  },
);

approvalRoutes.post(
  "/incentives/approve-eligible",
  validate("json", approvalFilterSchema),
  async (c) => {
    const user = c.get("authUser") as AuthUser;
    adminOrForbid(user);
    const data = await createApprovalService(c.get("db")).approveEligibleIncentives(
      user,
      c.req.valid("json"),
    );
    return jsonOk(c, data);
  },
);

approvalRoutes.post("/incentives/disburse", validate("json", disburseBodySchema), async (c) => {
  const user = c.get("authUser") as AuthUser;
  adminOrForbid(user);
  const data = await createApprovalService(c.get("db")).disburse(user, c.req.valid("json"));
  return jsonOk(c, data);
});

approvalRoutes.post("/incentives/:id/approve", validate("param", idParamSchema), async (c) => {
  const user = c.get("authUser") as AuthUser;
  adminOrForbid(user);
  const data = await createApprovalService(c.get("db")).approveIncentive(
    user,
    c.req.valid("param").id,
  );
  return jsonOk(c, data);
});

approvalRoutes.post(
  "/incentives/:id/reject",
  validate("param", idParamSchema),
  validate("json", rejectReasonSchema),
  async (c) => {
    const user = c.get("authUser") as AuthUser;
    adminOrForbid(user);
    const data = await createApprovalService(c.get("db")).rejectIncentive(
      user,
      c.req.valid("param").id,
      c.req.valid("json").reason,
    );
    return jsonOk(c, data);
  },
);

approvalRoutes.patch(
  "/incentives/:id",
  validate("param", idParamSchema),
  validate("json", overrideIncentiveSchema),
  async (c) => {
    const user = c.get("authUser") as AuthUser;
    adminOrForbid(user);
    const data = await createApprovalService(c.get("db")).overrideIncentive(
      user,
      c.req.valid("param").id,
      c.req.valid("json"),
    );
    return jsonOk(c, data);
  },
);

approvalRoutes.get("/appraisals/export", validate("query", approvalFilterSchema), async (c) => {
  const user = c.get("authUser") as AuthUser;
  adminOrForbid(user);
  const file = await createApprovalService(c.get("db")).exportAppraisals(
    user,
    c.req.valid("query"),
  );
  return c.body(file.body, 200, {
    "Content-Type": "application/vnd.ms-excel; charset=utf-8",
    "Content-Disposition": `attachment; filename="${file.filename}"`,
  });
});

approvalRoutes.get("/appraisals", validate("query", approvalFilterSchema), async (c) => {
  const user = c.get("authUser") as AuthUser;
  adminOrForbid(user);
  const rows = await createApprovalService(c.get("db")).listAppraisals(user, c.req.valid("query"));
  return jsonOk(c, rows);
});

approvalRoutes.post(
  "/appraisals/calculate",
  validate("json", calculateAppraisalSchema),
  async (c) => {
    const user = c.get("authUser") as AuthUser;
    adminOrForbid(user);
    const data = await createApprovalService(c.get("db")).calculateAppraisals(
      user,
      c.req.valid("json").quarter,
    );
    return jsonOk(c, data);
  },
);

approvalRoutes.post(
  "/appraisals/approve-eligible",
  validate("json", approvalFilterSchema),
  async (c) => {
    const user = c.get("authUser") as AuthUser;
    adminOrForbid(user);
    const data = await createApprovalService(c.get("db")).approveEligibleAppraisals(
      user,
      c.req.valid("json"),
    );
    return jsonOk(c, data);
  },
);

approvalRoutes.post("/appraisals/:id/approve", validate("param", idParamSchema), async (c) => {
  const user = c.get("authUser") as AuthUser;
  adminOrForbid(user);
  const data = await createApprovalService(c.get("db")).approveAppraisal(
    user,
    c.req.valid("param").id,
  );
  return jsonOk(c, data);
});

approvalRoutes.post(
  "/appraisals/:id/reject",
  validate("param", idParamSchema),
  validate("json", rejectReasonSchema),
  async (c) => {
    const user = c.get("authUser") as AuthUser;
    adminOrForbid(user);
    const data = await createApprovalService(c.get("db")).rejectAppraisal(
      user,
      c.req.valid("param").id,
      c.req.valid("json").reason,
    );
    return jsonOk(c, data);
  },
);
