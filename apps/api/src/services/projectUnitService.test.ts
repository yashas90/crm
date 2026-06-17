import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  UNIT_STATUS_TRANSITIONS,
  assertValidStatusTransition,
  createProjectUnitService,
} from "../services/projectUnitService.js";

const dbMocks = vi.hoisted(() => {
  const state = {
    units: [] as Array<{
      id: string;
      projectId: string;
      unitNumber: string;
      floor: number;
      bedrooms: number;
      areaSqFt: string;
      status: string;
      priceListedRs: number;
      priceFinalRs: number | null;
      assignedLeadId: string | null;
      notes: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>,
    leads: [
      { id: "lead-1", firstName: "Ravi", lastName: "Kumar", orgId: "org-1", deletedAt: null },
    ],
    projectExists: true,
    nextId: 1,
  };

  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => {
            if (table && typeof table === "object" && table !== null && "name" in table) {
              return state.projectExists ? [{ id: "proj-1", name: "Test" }] : [];
            }
            return [];
          },
          orderBy: async () => [],
          groupBy: async () => [],
        }),
        leftJoin: () => ({
          where: () => ({
            orderBy: async () => [],
          }),
        }),
        innerJoin: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
    }),
    insert: () => ({
      values: (rows: unknown) => ({
        returning: async () => {
          const list = Array.isArray(rows) ? rows : [rows];
          return list.map((row) => {
            const unit = {
              id: `unit-${state.nextId++}`,
              createdAt: new Date(),
              updatedAt: new Date(),
              priceFinalRs: null,
              assignedLeadId: null,
              notes: null,
              ...(row as object),
            };
            state.units.push(unit);
            return unit;
          });
        },
      }),
    }),
    update: () => ({
      set: (patch: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            const unit = state.units[0];
            if (!unit) return [];
            Object.assign(unit, patch);
            return [unit];
          },
        }),
      }),
    }),
    delete: () => ({
      where: () => ({
        returning: async () => (state.units.length > 0 ? [state.units[0]!] : []),
      }),
    }),
  };

  return { state, db };
});

vi.mock("../lib/db.js", () => ({
  db: dbMocks.db,
}));

vi.mock("./projectService.js", () => ({
  createProjectService: () => ({
    getProjectById: async (id: string) => {
      if (!dbMocks.state.projectExists) throw new Error("not found");
      return { id, name: "Test Project" };
    },
  }),
}));

describe("projectUnitService", () => {
  beforeEach(() => {
    dbMocks.state.units = [];
    dbMocks.state.nextId = 1;
    dbMocks.state.projectExists = true;
    vi.clearAllMocks();
  });

  describe("assertValidStatusTransition", () => {
    it("allows defined transitions", () => {
      expect(() => assertValidStatusTransition("available", "reserved")).not.toThrow();
      expect(() => assertValidStatusTransition("reserved", "booked")).not.toThrow();
      expect(() => assertValidStatusTransition("sold", "available")).not.toThrow();
    });

    it("allows no-op when status unchanged", () => {
      expect(() => assertValidStatusTransition("available", "available")).not.toThrow();
    });

    it("sold units can move back to available", () => {
      expect(() => assertValidStatusTransition("sold", "available")).not.toThrow();
    });

    it("documents all statuses have outbound transitions", () => {
      for (const status of Object.keys(UNIT_STATUS_TRANSITIONS) as Array<
        keyof typeof UNIT_STATUS_TRANSITIONS
      >) {
        expect(UNIT_STATUS_TRANSITIONS[status].length).toBeGreaterThan(0);
      }
    });
  });

  describe("createUnits bulk", () => {
    it("creates multiple units from a range", async () => {
      const service = createProjectUnitService(dbMocks.db as never);
      const created = await service.createUnits("proj-1", {
        bulk: {
          unitNumberFrom: "A-101",
          unitNumberTo: "A-103",
          floor: 1,
          bedrooms: 2,
          areaSqFt: 850,
          priceListedRs: 4_500_000,
        },
      });

      expect(created).toHaveLength(3);
      expect(created.map((u) => u.unitNumber)).toEqual(["A-101", "A-102", "A-103"]);
      expect(created.every((u) => u.status === "available")).toBe(true);
    });
  });
});
