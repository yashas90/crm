import { describe, expect, it } from "vitest";
import { agentForRoundRobinIndex } from "./round-robin";

describe("agentForRoundRobinIndex", () => {
  it("cycles through agents", () => {
    const agents = ["a", "b", "c"];
    expect(agentForRoundRobinIndex(agents, 0)).toBe("a");
    expect(agentForRoundRobinIndex(agents, 1)).toBe("b");
    expect(agentForRoundRobinIndex(agents, 2)).toBe("c");
    expect(agentForRoundRobinIndex(agents, 3)).toBe("a");
  });
});
