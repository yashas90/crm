import { randomUUID } from "node:crypto";
import { leads, portalWebhooks } from "@propninja/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import { resetRateLimitStoreForTests } from "../lib/rateLimitStore.js";
import { createPortalWebhookService } from "./portalWebhookService.js";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe("portalWebhookService", () => {
  const service = createPortalWebhookService(db);
  let webhookToken: string;
  let webhookId: string;

  beforeEach(async ({ skip }) => {
    if (!hasDatabase) {
      skip();
      return;
    }

    resetRateLimitStoreForTests();
    webhookToken = randomUUID();
    const [row] = await db
      .insert(portalWebhooks)
      .values({
        portalName: "99acres",
        webhookToken,
        fieldMapping: {
          name: "sender_name",
          phone: "sender_phone",
          email: "sender_email",
          message: "message",
          projectInterest: "property_name",
        },
        isActive: true,
      })
      .returning();
    webhookId = row!.id;
  });

  afterEach(async ({ skip }) => {
    if (!hasDatabase) {
      skip();
      return;
    }

    await db.delete(leads).where(eq(leads.phone, "+919988776655"));
    if (webhookId) {
      await db.delete(portalWebhooks).where(eq(portalWebhooks.id, webhookId));
    }
    resetRateLimitStoreForTests();
  });

  it("ingests a valid portal payload into a lead", async ({ skip }) => {
    if (!hasDatabase) {
      skip();
      return;
    }

    const webhook = await service.getByToken(webhookToken);
    expect(webhook).toBeTruthy();

    const result = await service.ingestFromWebhook(webhook!, {
      sender_name: "Portal Lead",
      sender_phone: "9988776655",
      sender_email: "portal@example.com",
      message: "Need callback",
      property_name: "Tower A",
    });

    expect(result.received).toBe(true);
    expect(result.leadId).toBeTruthy();

    const [lead] = await db.select().from(leads).where(eq(leads.id, result.leadId!)).limit(1);
    expect(lead?.firstName).toBe("Portal");
    expect(lead?.phone).toBe("+919988776655");
    expect(lead?.leadSource).toBe("99acres");
    expect(lead?.orgId).toBe(SINGLE_TENANT_ORG_ID);
  });

  it("merges duplicate phone numbers", async ({ skip }) => {
    if (!hasDatabase) {
      skip();
      return;
    }

    const webhook = await service.getByToken(webhookToken);
    const payload = {
      sender_name: "Portal Lead",
      sender_phone: "9988776655",
      message: "First inquiry",
      property_name: "Tower A",
    };

    const first = await service.ingestFromWebhook(webhook!, payload);
    const second = await service.ingestFromWebhook(webhook!, {
      ...payload,
      sender_name: "Portal Lead Updated",
      message: "Second inquiry",
    });

    expect(second.leadId).toBe(first.leadId);

    const [lead] = await db.select().from(leads).where(eq(leads.id, first.leadId!)).limit(1);
    expect(lead?.firstName).toBe("Portal");
    expect(lead?.notes).toBe("Second inquiry");
  });

  it("rejects invalid Indian phone numbers", async ({ skip }) => {
    if (!hasDatabase) {
      skip();
      return;
    }

    const webhook = await service.getByToken(webhookToken);

    await expect(
      service.ingestFromWebhook(webhook!, {
        sender_name: "Bad Phone",
        sender_phone: "5123456789",
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
