import {
  transactionClosureEvents,
  transactionClosureShares,
  transactionClosures,
  users,
} from "@propninja/db";
import { and, desc, eq, exists, ilike, or, sql } from "drizzle-orm";
import { ZodError } from "zod";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import type { Database } from "../lib/db.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import {
  type TcfFormInput,
  readTcfForm,
  submitErrors,
} from "../lib/validators/transactionClosures.js";
import type { AuthUser } from "../middleware/auth.js";
import { createNotificationService } from "./notificationService.js";

type Status = "draft" | "pending_approval" | "approved" | "rejected";

function parseForm(input: unknown) {
  try {
    return readTcfForm(input);
  } catch (error) {
    if (error instanceof ZodError) throw badRequest("The TCF form is incomplete or invalid");
    throw error;
  }
}

function money(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return "0";
  return parsed.toFixed(2);
}

function dateOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 10) : null;
}

function canSeeAll(user: AuthUser) {
  return user.role === "admin" || user.role === "manager";
}

function headerFromForm(form: TcfFormInput) {
  return {
    segment: form.segment.trim() || null,
    channel: form.channel.trim() || null,
    currency: form.currency.trim() || "INR",
    coolOffEndDate: dateOrNull(form.coolOffEndDate),
    productName: form.productName.trim() || null,
    dealClosureDate: dateOrNull(form.dealClosureDate),
    clientAccess: form.clientAccess,
    initialPaymentVerified: form.initialPaymentVerified,
    invoiceStatus: form.payment.invoiceStatus,
    netRevenue: money(form.payment.netRevenue),
    convertible: form.payment.convertible,
    primaryApplicant: form.client.primaryApplicant.trim() || null,
    clientMobile: form.client.mobile.trim() || null,
    form: form as unknown as Record<string, unknown>,
  };
}

async function nextCode(db: Database) {
  const today = new Date();
  const stamp = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `TCF-${stamp}-`;
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transactionClosures)
    .where(ilike(transactionClosures.tcfCode, `${prefix}%`));
  const sequence = Number(row?.count ?? 0) + 1;
  return `${prefix}${String(sequence).padStart(4, "0")}`;
}

async function loadShares(db: Database, tcfId: string) {
  return db
    .select()
    .from(transactionClosureShares)
    .where(eq(transactionClosureShares.tcfId, tcfId));
}

async function replaceShares(db: Database, tcfId: string, form: TcfFormInput) {
  const rows = form.shares
    .filter((share) => share.employeeName.trim())
    .map((share) => {
      const percent = Number(share.sharePercent || 0);
      if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
        throw badRequest("Each share must be between 0 and 100");
      }
      return {
        tcfId,
        userId: share.userId || null,
        employeeName: share.employeeName.trim(),
        sharePercent: percent.toFixed(2),
      };
    });
  const total = rows.reduce((sum, share) => sum + Number(share.sharePercent), 0);
  if (total > 100.001) throw badRequest("Share percentages cannot exceed 100");
  await db.delete(transactionClosureShares).where(eq(transactionClosureShares.tcfId, tcfId));
  if (rows.length > 0) {
    await db.insert(transactionClosureShares).values(rows);
  }
}

async function addEvent(
  db: Database,
  tcfId: string,
  actorId: string,
  action: string,
  note?: string,
) {
  await db.insert(transactionClosureEvents).values({
    tcfId,
    actorId,
    action,
    note: note ?? null,
  });
}

function present(
  row: typeof transactionClosures.$inferSelect,
  shares: (typeof transactionClosureShares.$inferSelect)[],
  events: (typeof transactionClosureEvents.$inferSelect)[],
) {
  const form = readTcfForm(row.form);
  form.shares = shares.map((share) => ({
    userId: share.userId,
    employeeName: share.employeeName,
    sharePercent: share.sharePercent,
  }));
  form.payment.invoiceStatus = row.invoiceStatus as TcfFormInput["payment"]["invoiceStatus"];
  form.payment.convertible = row.convertible;
  form.payment.netRevenue = row.netRevenue;
  const counted =
    row.status === "approved" ? "eligible" : ("not_counted" as "eligible" | "not_counted");
  return {
    ...row,
    form,
    shares,
    events,
    incentiveEligible: counted === "eligible",
    incentiveStatus: counted,
    incentiveNote:
      row.status === "approved"
        ? row.invoiceStatus === "collected"
          ? "Approved and collected. Included in earned incentive."
          : "Approved. Incentive stays provisional until the invoice is collected."
        : "Incentive is counted only after an admin approves this TCF.",
  };
}

async function getRow(db: Database, id: string) {
  const [row] = await db
    .select()
    .from(transactionClosures)
    .where(and(eq(transactionClosures.id, id), eq(transactionClosures.orgId, SINGLE_TENANT_ORG_ID)))
    .limit(1);
  if (!row) throw notFound("Transaction closure not found");
  return row;
}

function assertCanEdit(user: AuthUser, row: typeof transactionClosures.$inferSelect) {
  if (row.status === "pending_approval" || row.status === "approved") {
    throw badRequest("This TCF is locked. Reject it before editing, or update the invoice only.");
  }
  if (user.role !== "admin" && row.createdBy !== user.id) {
    throw forbidden("You can only edit your own draft");
  }
}

export function createTransactionClosureService(db: Database) {
  return {
    async list(
      user: AuthUser,
      query: { status?: Status; search?: string; page: number; pageSize: number },
    ) {
      const filters = [eq(transactionClosures.orgId, SINGLE_TENANT_ORG_ID)];
      if (!canSeeAll(user)) {
        const sharedWithUser = exists(
          db
            .select({ id: transactionClosureShares.id })
            .from(transactionClosureShares)
            .where(
              and(
                eq(transactionClosureShares.tcfId, transactionClosures.id),
                eq(transactionClosureShares.userId, user.id),
              ),
            ),
        );
        const visible = or(eq(transactionClosures.createdBy, user.id), sharedWithUser);
        if (visible) filters.push(visible);
      }
      if (query.status) filters.push(eq(transactionClosures.status, query.status));
      if (query.search?.trim()) {
        const term = `%${query.search.trim()}%`;
        const search = or(
          ilike(transactionClosures.tcfCode, term),
          ilike(transactionClosures.productName, term),
          ilike(transactionClosures.primaryApplicant, term),
        );
        if (search) filters.push(search);
      }
      const where = and(...filters);
      const [countRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(transactionClosures)
        .where(where);
      const rows = await db
        .select()
        .from(transactionClosures)
        .where(where)
        .orderBy(desc(transactionClosures.createdAt))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);
      return {
        items: rows.map((row) => present(row, [], [])),
        page: query.page,
        pageSize: query.pageSize,
        total: Number(countRow?.count ?? 0),
      };
    },

    async get(user: AuthUser, id: string) {
      const row = await getRow(db, id);
      if (!canSeeAll(user) && row.createdBy !== user.id) {
        const shares = await loadShares(db, id);
        if (!shares.some((share) => share.userId === user.id)) {
          throw forbidden("You cannot view this TCF");
        }
      }
      const [shares, events] = await Promise.all([
        loadShares(db, id),
        db
          .select()
          .from(transactionClosureEvents)
          .where(eq(transactionClosureEvents.tcfId, id))
          .orderBy(desc(transactionClosureEvents.createdAt)),
      ]);
      return present(row, shares, events);
    },

    async create(user: AuthUser, input: unknown) {
      const form = parseForm(input);
      const code = await nextCode(db);
      const [row] = await db
        .insert(transactionClosures)
        .values({
          orgId: SINGLE_TENANT_ORG_ID,
          tcfCode: code,
          status: "draft",
          createdBy: user.id,
          ...headerFromForm(form),
        })
        .returning();
      if (!row) throw badRequest("Could not create the TCF");
      await replaceShares(db, row.id, form);
      await addEvent(db, row.id, user.id, "created");
      return this.get(user, row.id);
    },

    async update(user: AuthUser, id: string, input: unknown) {
      const row = await getRow(db, id);
      assertCanEdit(user, row);
      const form = parseForm(input);
      await db
        .update(transactionClosures)
        .set({ ...headerFromForm(form), updatedAt: new Date() })
        .where(eq(transactionClosures.id, id));
      await replaceShares(db, id, form);
      await addEvent(db, id, user.id, "updated");
      return this.get(user, id);
    },

    async submit(user: AuthUser, id: string) {
      const row = await getRow(db, id);
      if (user.role !== "admin" && row.createdBy !== user.id) {
        throw forbidden("You can only submit your own TCF");
      }
      if (row.status !== "draft" && row.status !== "rejected") {
        throw badRequest("Only a draft or rejected TCF can be submitted");
      }
      const current = await this.get(user, id);
      const errors = submitErrors(current.form);
      if (errors.length > 0) throw badRequest(errors.join(". "));
      await db
        .update(transactionClosures)
        .set({
          status: "pending_approval",
          submittedAt: new Date(),
          rejectionReason: null,
          updatedAt: new Date(),
        })
        .where(eq(transactionClosures.id, id));
      await addEvent(db, id, user.id, "submitted");
      const admins = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.orgId, SINGLE_TENANT_ORG_ID),
            eq(users.role, "admin"),
            eq(users.isActive, true),
          ),
        );
      const notifications = createNotificationService(db);
      await Promise.all(
        admins.map((admin) =>
          notifications.createNotification(admin.id, "tcf_submitted", {
            title: "TCF waiting for approval",
            message: `${row.tcfCode} was submitted for approval`,
            tcfId: id,
          }),
        ),
      );
      return this.get(user, id);
    },

    async decide(user: AuthUser, id: string, decision: "approved" | "rejected", reason?: string) {
      if (user.role !== "admin") throw forbidden("Only an admin can approve or reject a TCF");
      const row = await getRow(db, id);
      if (row.status !== "pending_approval") {
        throw badRequest("This TCF is not waiting for approval");
      }
      await db
        .update(transactionClosures)
        .set({
          status: decision,
          reviewedBy: user.id,
          reviewedAt: new Date(),
          rejectionReason: decision === "rejected" ? (reason ?? "Rejected") : null,
          updatedAt: new Date(),
        })
        .where(eq(transactionClosures.id, id));
      await addEvent(db, id, user.id, decision, reason);
      if (row.createdBy) {
        await createNotificationService(db).createNotification(row.createdBy, "tcf_reviewed", {
          title: decision === "approved" ? "TCF approved" : "TCF rejected",
          message:
            decision === "approved"
              ? `${row.tcfCode} is approved. Incentive stays provisional until the invoice is collected.`
              : `${row.tcfCode} was rejected. ${reason ?? ""}`.trim(),
          tcfId: id,
        });
      }
      return this.get(user, id);
    },

    async setInvoice(
      user: AuthUser,
      id: string,
      invoiceStatus: "not_raised" | "raised" | "collected",
    ) {
      const row = await getRow(db, id);
      if (user.role !== "admin" && row.createdBy !== user.id) {
        throw forbidden("You cannot update this invoice");
      }
      if (row.status !== "approved" && user.role !== "admin") {
        throw badRequest("Set the invoice after the TCF is approved");
      }
      const form = readTcfForm(row.form);
      form.payment.invoiceStatus = invoiceStatus;
      await db
        .update(transactionClosures)
        .set({ invoiceStatus, form, updatedAt: new Date() })
        .where(eq(transactionClosures.id, id));
      await addEvent(db, id, user.id, "invoice_updated", invoiceStatus);
      return this.get(user, id);
    },

    async duplicate(user: AuthUser, id: string) {
      const current = await this.get(user, id);
      return this.create(user, current.form);
    },

    async remove(user: AuthUser, id: string) {
      const row = await getRow(db, id);
      if (row.status === "approved" || row.status === "pending_approval") {
        throw badRequest("Approved and pending TCFs cannot be deleted");
      }
      if (user.role !== "admin" && row.createdBy !== user.id) {
        throw forbidden("You can only delete your own draft");
      }
      await db.delete(transactionClosures).where(eq(transactionClosures.id, id));
      return { id };
    },
  };
}
