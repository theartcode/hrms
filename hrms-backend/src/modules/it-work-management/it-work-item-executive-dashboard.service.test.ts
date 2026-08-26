import { describe, it, expect } from "vitest";
import { computeProjectRiskReasons } from "./it-work-item-executive-dashboard.service";

// The only DB-independent logic in it-work-item-executive-dashboard.service.ts
// — the exact-reuse "At Risk" rule from Part 8 of the Phase 1E-C brief
// (itself the Phase 1E-A rule, verbatim). See that file's Testing note and
// the Phase 1E-C report for why the rest of the service isn't covered by an
// integration-test harness this codebase has never used elsewhere.

describe("computeProjectRiskReasons (Part 8 — the exact Phase 1E-A At Risk rule)", () => {
  it("returns no reasons for a healthy project", () => {
    expect(computeProjectRiskReasons({ overdue: 0, blocked: 0 }, "2099-01-01", "2026-01-01")).toEqual([]);
    expect(computeProjectRiskReasons({ overdue: 0, blocked: 0 }, null, "2026-01-01")).toEqual([]);
  });

  it("flags overdue Work Items, singular vs plural", () => {
    expect(computeProjectRiskReasons({ overdue: 1, blocked: 0 }, null, "2026-01-01")).toEqual([
      "1 overdue Work Item",
    ]);
    expect(computeProjectRiskReasons({ overdue: 3, blocked: 0 }, null, "2026-01-01")).toEqual([
      "3 overdue Work Items",
    ]);
  });

  it("flags blocked Work Items, singular vs plural", () => {
    expect(computeProjectRiskReasons({ overdue: 0, blocked: 1 }, null, "2026-01-01")).toEqual([
      "1 blocked Work Item",
    ]);
    expect(computeProjectRiskReasons({ overdue: 0, blocked: 2 }, null, "2026-01-01")).toEqual([
      "2 blocked Work Items",
    ]);
  });

  it("flags a passed target date", () => {
    expect(computeProjectRiskReasons({ overdue: 0, blocked: 0 }, "2025-01-01", "2026-01-01")).toEqual([
      "Target date passed",
    ]);
  });

  it("does not flag a target date that is today or in the future", () => {
    expect(computeProjectRiskReasons({ overdue: 0, blocked: 0 }, "2026-01-01", "2026-01-01")).toEqual([]);
    expect(computeProjectRiskReasons({ overdue: 0, blocked: 0 }, "2026-06-01", "2026-01-01")).toEqual([]);
  });

  it("combines all three reasons when every condition applies", () => {
    const reasons = computeProjectRiskReasons({ overdue: 2, blocked: 1 }, "2025-01-01", "2026-01-01");
    expect(reasons).toEqual(["2 overdue Work Items", "1 blocked Work Item", "Target date passed"]);
  });
});
