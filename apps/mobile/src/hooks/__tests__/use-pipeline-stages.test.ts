import { buildStageConfig } from "@/hooks/use-pipeline-stages";

describe("buildStageConfig", () => {
  it("returns defaults when API returns no stages", () => {
    const config = buildStageConfig([]);
    expect(config.fromApi).toBe(false);
    expect(config.all.map((s) => s.key)).toEqual([
      "new",
      "contacted",
      "qualified",
      "negotiation",
      "won",
      "lost",
    ]);
  });

  it("maps API stages with colors and closed flags", () => {
    const config = buildStageConfig([
      {
        id: "s1",
        name: "Fresh Lead",
        color: "#111111",
        position: 0,
        isDefault: true,
        mapsToStatus: "new",
      },
      {
        id: "s2",
        name: "Booked",
        color: "#22c55e",
        position: 5,
        isDefault: true,
        mapsToStatus: "won",
      },
    ]);

    expect(config.fromApi).toBe(true);
    expect(config.active).toHaveLength(1);
    expect(config.active[0]?.label).toBe("Fresh Lead");
    expect(config.active[0]?.color).toBe("#111111");
    expect(config.closed).toHaveLength(1);
    expect(config.closed[0]?.collapsible).toBe(true);
  });
});
