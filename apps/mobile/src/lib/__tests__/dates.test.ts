import { formatDuration, formatRelativeTime } from "@/lib/dates";

describe("formatDuration", () => {
  it("formats zero seconds", () => {
    expect(formatDuration(0)).toBe("0:00");
  });

  it("formats under a minute", () => {
    expect(formatDuration(45)).toBe("0:45");
  });

  it("pads seconds with leading zero", () => {
    expect(formatDuration(61)).toBe("1:01");
  });

  it("formats multi-minute durations", () => {
    expect(formatDuration(125)).toBe("2:05");
    expect(formatDuration(3600)).toBe("60:00");
  });
});

describe("formatRelativeTime", () => {
  it("returns Never for null/undefined", () => {
    expect(formatRelativeTime(null)).toBe("Never");
    expect(formatRelativeTime(undefined)).toBe("Never");
  });

  it("returns Today for timestamps earlier today", () => {
    const now = new Date();
    now.setHours(now.getHours() - 1);
    expect(formatRelativeTime(now.toISOString())).toBe("Today");
  });

  it("returns '1 day ago' for yesterday", () => {
    const yesterday = new Date(Date.now() - 86_400_000 - 1000);
    expect(formatRelativeTime(yesterday.toISOString())).toBe("1 day ago");
  });

  it("returns N days ago for older timestamps", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000 - 1000);
    expect(formatRelativeTime(threeDaysAgo.toISOString())).toBe("3 days ago");
  });

  it("returns formatted date for future timestamps", () => {
    const future = new Date(Date.now() + 86_400_000 * 30);
    const result = formatRelativeTime(future.toISOString());
    // Should not be "Today", "1 day ago", or "Never"
    expect(result).not.toBe("Never");
    expect(result).not.toMatch(/days? ago/);
  });
});
