import { Hono } from "hono";
import { jsonOk } from "../lib/response.js";
import { validate } from "../lib/validate.js";
import {
  invoicePatchSchema,
  listTcfQuerySchema,
  rejectTcfSchema,
} from "../lib/validators/transactionClosures.js";
import type { AuthUser } from "../middleware/auth.js";
import { createTransactionClosureService } from "../services/transactionClosureService.js";

export const transactionClosureRoutes = new Hono();

transactionClosureRoutes.get("/", validate("query", listTcfQuerySchema), async (c) => {
  const user = c.get("authUser") as AuthUser;
  const data = await createTransactionClosureService(c.get("db")).list(user, c.req.valid("query"));
  return jsonOk(c, data);
});

transactionClosureRoutes.post("/", async (c) => {
  const user = c.get("authUser") as AuthUser;
  const body = await c.req.json().catch(() => ({}));
  const data = await createTransactionClosureService(c.get("db")).create(user, body);
  return jsonOk(c, data, undefined, 201);
});

transactionClosureRoutes.get("/:id", async (c) => {
  const user = c.get("authUser") as AuthUser;
  const data = await createTransactionClosureService(c.get("db")).get(user, c.req.param("id"));
  return jsonOk(c, data);
});

transactionClosureRoutes.patch("/:id", async (c) => {
  const user = c.get("authUser") as AuthUser;
  const body = await c.req.json().catch(() => ({}));
  const data = await createTransactionClosureService(c.get("db")).update(
    user,
    c.req.param("id"),
    body,
  );
  return jsonOk(c, data);
});

transactionClosureRoutes.post("/:id/submit", async (c) => {
  const user = c.get("authUser") as AuthUser;
  const data = await createTransactionClosureService(c.get("db")).submit(user, c.req.param("id"));
  return jsonOk(c, data);
});

transactionClosureRoutes.post("/:id/approve", async (c) => {
  const user = c.get("authUser") as AuthUser;
  const data = await createTransactionClosureService(c.get("db")).decide(
    user,
    c.req.param("id"),
    "approved",
  );
  return jsonOk(c, data);
});

transactionClosureRoutes.post("/:id/reject", validate("json", rejectTcfSchema), async (c) => {
  const user = c.get("authUser") as AuthUser;
  const data = await createTransactionClosureService(c.get("db")).decide(
    user,
    c.req.param("id"),
    "rejected",
    c.req.valid("json").reason,
  );
  return jsonOk(c, data);
});

transactionClosureRoutes.patch("/:id/invoice", validate("json", invoicePatchSchema), async (c) => {
  const user = c.get("authUser") as AuthUser;
  const data = await createTransactionClosureService(c.get("db")).setInvoice(
    user,
    c.req.param("id"),
    c.req.valid("json").invoiceStatus,
  );
  return jsonOk(c, data);
});

transactionClosureRoutes.post("/:id/duplicate", async (c) => {
  const user = c.get("authUser") as AuthUser;
  const data = await createTransactionClosureService(c.get("db")).duplicate(
    user,
    c.req.param("id"),
  );
  return jsonOk(c, data);
});

transactionClosureRoutes.delete("/:id", async (c) => {
  const user = c.get("authUser") as AuthUser;
  const data = await createTransactionClosureService(c.get("db")).remove(user, c.req.param("id"));
  return jsonOk(c, data);
});
