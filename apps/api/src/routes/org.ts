import { Hono } from "hono";
import { jsonOk } from "../lib/response.js";
import { createOrgService } from "../services/orgService.js";

export const orgRoutes = new Hono();

orgRoutes.get("/", async (c) => {
  const service = createOrgService(c.get("db"));
  const org = await service.get();

  return jsonOk(c, org);
});
