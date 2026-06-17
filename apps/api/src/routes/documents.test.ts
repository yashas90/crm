import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const upload = vi.fn();
const getSignedUrl = vi.fn();
const share = vi.fn();
const trackView = vi.fn();
const list = vi.fn();
const getById = vi.fn();
const getLeadById = vi.fn();

vi.mock("../services/documentService.js", () => ({
  documentService: {
    upload,
    getSignedUrl,
    share,
    trackView,
    list,
    getById,
    delete: vi.fn(),
    listLeadDocuments: vi.fn(),
  },
}));

vi.mock("../services/leadService.js", () => ({
  leadService: { getLeadById },
}));

vi.mock("../lib/r2Storage.js", () => ({
  isR2Configured: () => true,
  SIGNED_URL_EXPIRY_SECONDS: 3600,
}));

vi.mock("../middleware/rateLimit.js", () => ({
  documentUploadRateLimit: async (_c: unknown, next: () => Promise<void>) => next(),
}));

vi.mock("../middleware/documentUpload.js", () => ({
  documentUploadConcurrencyLimit: async (_c: unknown, next: () => Promise<void>) => next(),
  rejectOversizedUploadByContentLength: () => null,
  mapDocumentUploadError: () => null,
}));

const adminUser = {
  id: "00000000-0000-4000-8000-000000000099",
  orgId: "00000000-0000-0000-0000-0000000000aa",
  email: "admin@demo.test",
  name: "Admin",
  role: "admin" as const,
};

const sampleDoc = {
  id: "doc-1",
  orgId: adminUser.orgId,
  name: "Brochure",
};

describe("POST /api/documents/upload", () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { documentsRoutes } = await import("../routes/documents.js");
    app = new Hono();
    app.use("*", async (c, next) => {
      c.set("authUser", adminUser);
      c.set("db", {});
      await next();
    });
    app.route("/api/documents", documentsRoutes);
  });

  it("uploads a document via multipart form", async () => {
    upload.mockResolvedValue({
      id: "doc-1",
      name: "Brochure",
      fileType: "pdf",
      fileUrl: "https://cdn.example.com/doc.pdf",
      fileSizeMb: 0.001,
    });

    const form = new FormData();
    form.append(
      "file",
      new File([new Uint8Array([1, 2, 3])], "brochure.pdf", { type: "application/pdf" }),
    );
    form.append("name", "Brochure");
    form.append("isGlobal", "true");

    const res = await app.request("/api/documents/upload", { method: "POST", body: form });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.name).toBe("Brochure");
    expect(upload).toHaveBeenCalledOnce();
  });
});

describe("GET /api/documents/:id/signed-url", () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { documentsRoutes } = await import("../routes/documents.js");
    app = new Hono();
    app.use("*", async (c, next) => {
      c.set("authUser", adminUser);
      await next();
    });
    app.route("/api/documents", documentsRoutes);
  });

  it("returns a signed download URL", async () => {
    getById.mockResolvedValue(sampleDoc);
    getSignedUrl.mockResolvedValue({
      signedUrl: "https://signed.example.com/file.pdf",
      expiresInSeconds: 3600,
      document: { id: "doc-1", name: "Brochure" },
    });

    const res = await app.request("/api/documents/doc-1/signed-url");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.signedUrl).toContain("signed.example.com");
    expect(body.data.expiresInSeconds).toBe(3600);
  });
});

describe("POST /api/documents/:id/share", () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { documentsRoutes } = await import("../routes/documents.js");
    app = new Hono();
    app.use("*", async (c, next) => {
      c.set("authUser", adminUser);
      c.set("db", {});
      await next();
    });
    app.route("/api/documents", documentsRoutes);
  });

  it("logs a document share with view URL", async () => {
    getById.mockResolvedValue(sampleDoc);
    getLeadById.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000010",
      assignedTo: adminUser.id,
      orgId: adminUser.orgId,
    });
    share.mockResolvedValue({
      id: "share-1",
      shareToken: "token-abc",
      sharedVia: "whatsapp",
      document: { id: "doc-1", name: "Brochure" },
    });

    const res = await app.request("/api/documents/doc-1/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: "00000000-0000-4000-8000-000000000010",
        sharedVia: "whatsapp",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.sharedVia).toBe("whatsapp");
    expect(body.data.viewUrl).toContain("token=token-abc");
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: "doc-1", sharedVia: "whatsapp" }),
    );
  });
});

describe("GET /api/documents/:id/view", () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { documentViewRoutes } = await import("../routes/documents.js");
    app = new Hono();
    app.route("/api/documents", documentViewRoutes);
  });

  it("redirects to signed URL and tracks view", async () => {
    trackView.mockResolvedValue("https://signed.example.com/brochure.pdf");

    const res = await app.request("/api/documents/doc-1/view?token=token-abc");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://signed.example.com/brochure.pdf");
    expect(trackView).toHaveBeenCalledWith("doc-1", "token-abc", null);
  });
});
