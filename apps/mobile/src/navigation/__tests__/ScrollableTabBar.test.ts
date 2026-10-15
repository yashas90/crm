import { shouldRecenterTabBar } from "@/navigation/ScrollableTabBar";

describe("shouldRecenterTabBar", () => {
  it("centers a tab that has not been placed yet", () => {
    expect(shouldRecenterTabBar(null, 4)).toBe(true);
  });

  it("does not scroll the bar again after that tab is already in view", () => {
    expect(shouldRecenterTabBar(4, 4)).toBe(false);
  });

  it("centers again when the user selects a different tab", () => {
    expect(shouldRecenterTabBar(4, 0)).toBe(true);
  });
});
