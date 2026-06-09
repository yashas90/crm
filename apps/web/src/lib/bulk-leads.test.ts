import { summarizeBulkResult } from "@/lib/bulk-leads";
import { toast } from "@/lib/toast";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("summarizeBulkResult", () => {
  it("shows success toast when all succeed", () => {
    summarizeBulkResult({ succeeded: ["a", "b"], failed: [] }, (count) => `${count} ok`);
    expect(toast.success).toHaveBeenCalledWith("2 ok");
  });

  it("shows partial failure info", () => {
    summarizeBulkResult(
      { succeeded: ["a"], failed: [{ id: "b", message: "Forbidden" }] },
      (count) => `${count} ok`,
    );
    expect(toast.success).toHaveBeenCalledWith("1 ok");
    expect(toast.info).toHaveBeenCalledWith("1 lead(s) could not be updated");
  });
});
